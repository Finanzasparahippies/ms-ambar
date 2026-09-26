"""
Receptor Asíncrono de Webhooks de Néctar Labs para ms-ambar.
Procesa eventos de conciliación de billetera, facturación y logística con respuesta
inmediata (HTTP 202 Accepted), deduplicación vía SETNX en Redis y reintentos con backoff.
"""

import time
import json
import hmac
import hashlib
import random
import logging
import threading
from typing import Dict, Any

from django.conf import settings
from django.core.cache import cache
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)

# Intervalos de reintento: 1m, 5m, 15m, 1h
RETRY_INTERVALS = [60, 300, 900, 3600]
TIMESTAMP_DRIFT_LIMIT = 300  # 5 minutos


@method_decorator(csrf_exempt, name='dispatch')
class NectarWebhookReceiverView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        tenant_id = request.META.get('HTTP_X_NECTAR_TENANT_ID', '')
        timestamp_str = request.META.get('HTTP_X_NECTAR_TIMESTAMP', '')
        signature = request.META.get('HTTP_X_NECTAR_SIGNATURE', '')

        # 1. Validación de presencia de cabeceras
        if not tenant_id or not timestamp_str or not signature:
            logger.warning("[NectarWebhook] Petición rechazada: Faltan cabeceras de firma HMAC.")
            return Response(
                {"error": "AUTHENTICATION_FAILED", "detail": "Cabeceras HMAC ausentes."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # 2. Validación de Timestamp Drift (<= 300s)
        try:
            timestamp = float(timestamp_str)
            if abs(time.time() - timestamp) > TIMESTAMP_DRIFT_LIMIT:
                return Response(
                    {"error": "TIMESTAMP_EXPIRED", "detail": "Desfase de tiempo excesivo."},
                    status=status.HTTP_401_UNAUTHORIZED
                )
        except Exception:
            return Response({"error": "INVALID_TIMESTAMP"}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Validación Criptográfica HMAC-SHA256
        secret_key = (
            getattr(settings, "NECTAR_SECRET_KEY", None) or
            getattr(settings, "NECTAR_API_KEY", None) or
            ""
        ).strip()

        raw_body = request.body or b""
        message = raw_body + str(int(timestamp)).encode('utf-8')
        expected_sig = hmac.new(secret_key.encode('utf-8'), message, hashlib.sha256).hexdigest()

        if not hmac.compare_digest(expected_sig.lower(), signature.strip().lower()):
            # Fallback en caso de que se haya enviado float crudo
            message_raw = raw_body + timestamp_str.strip().encode('utf-8')
            expected_sig_raw = hmac.new(secret_key.encode('utf-8'), message_raw, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expected_sig_raw.lower(), signature.strip().lower()):
                logger.error("[NectarWebhook] Firma HMAC inválida detectada.")
                return Response(
                    {"error": "INVALID_SIGNATURE", "detail": "Firma no coincide."},
                    status=status.HTTP_401_UNAUTHORIZED
                )

        try:
            payload = json.loads(raw_body.decode('utf-8'))
        except Exception:
            payload = {}

        event_id = payload.get("id") or payload.get("event_id") or f"evt_{hashlib.md5(raw_body).hexdigest()}"
        event_type = payload.get("type") or payload.get("event") or "generic.event"

        # 4. Deduplicación atómica vía Redis SETNX
        dedup_cache_key = f"nectar_webhook_event:{event_id}"
        is_new_event = cache.add(dedup_cache_key, "1", timeout=86400)
        if not is_new_event:
            logger.info(f"[NectarWebhook] Evento {event_id} duplicado ya recibido previamente. Respondiendo 202.")
            return Response(
                {"status": "accepted", "event_id": event_id, "detail": "Evento ya recibido previamente."},
                status=status.HTTP_202_ACCEPTED
            )

        # 5. Encolado desacoplado y respuesta inmediata HTTP 202 Accepted
        self._enqueue_async_processing(event_id, event_type, payload)

        return Response(
            {
                "status": "accepted",
                "event_id": event_id,
                "event_type": event_type,
                "received_at": time.time(),
                "detail": "Evento encolado para procesamiento asíncrono."
            },
            status=status.HTTP_202_ACCEPTED
        )

    def _enqueue_async_processing(self, event_id: str, event_type: str, payload: Dict[str, Any]):
        """
        Despacha la ejecución del evento en un hilo asíncrono con tolerancia a caídas
        y reintentos automáticos con backoff exponencial y jitter.
        """
        def _worker():
            attempt = 0
            max_attempts = len(RETRY_INTERVALS)

            while attempt <= max_attempts:
                try:
                    logger.info(f"[NectarWebhookWorker] Procesando evento {event_id} ({event_type}), intento {attempt + 1}")
                    self._process_event_business_logic(event_id, event_type, payload)
                    logger.info(f"[NectarWebhookWorker] Evento {event_id} procesado con éxito.")
                    return
                except Exception as ex:
                    attempt += 1
                    if attempt > max_attempts:
                        logger.critical(
                            f"[NectarWebhookWorker] Evento {event_id} agotó todos los reintentos. Error: {ex}",
                            exc_info=True
                        )
                        # Registrar en cola de fallos para auditoría
                        dead_letter_key = f"nectar_dead_letter_events"
                        cache.set(f"nectar_dlq:{event_id}", json.dumps({
                            "event_id": event_id,
                            "type": event_type,
                            "payload": payload,
                            "error": str(ex),
                            "failed_at": time.time()
                        }), timeout=86400 * 30)
                        return

                    interval = RETRY_INTERVALS[attempt - 1]
                    # Jitter aleatorio (+/- 15%) para evitar tormentas de reintentos concurrentes
                    jitter = random.uniform(0.85, 1.15)
                    delay = interval * jitter
                    logger.warning(
                        f"[NectarWebhookWorker] Error procesando evento {event_id}: {ex}. "
                        f"Reintentando en {delay:.1f}s (intento {attempt}/{max_attempts})..."
                    )
                    time.sleep(delay)

        thread = threading.Thread(target=_worker, daemon=True)
        thread.start()

    def _process_event_business_logic(self, event_id: str, event_type: str, payload: Dict[str, Any]):
        """
        Lógica de reconciliación de eventos para ms-ambar.
        """
        data = payload.get("data", {})

        if event_type in ["wallet.balance_updated", "wallet.recharge.completed"]:
            logger.info(f"[Reconciliation] Saldo actualizado por Néctar Labs: {data}")
            # Invalidar la caché de saldo local en ms-ambar
            tenant_id = getattr(settings, "NECTAR_TENANT_ID", "")
            cache.delete(f"nectar_local_balance:{tenant_id}")

        elif event_type in ["shipment.status_updated", "delivery.status_changed"]:
            tracking_number = data.get("tracking_number")
            new_status = data.get("status")
            logger.info(f"[Reconciliation] Estado de guía {tracking_number} actualizado a {new_status}")
            from apps.shop.models import Order
            order = Order.objects.filter(tracking_number=tracking_number).first()
            if order:
                order.shipping_status = new_status
                order.save(update_fields=['shipping_status'])

        elif event_type in ["invoice.stamped", "billing.invoice.created"]:
            invoice_uuid = data.get("uuid") or data.get("invoice_id")
            order_id = data.get("reference_id")
            logger.info(f"[Reconciliation] Factura SAT {invoice_uuid} generada para orden {order_id}")
            from apps.shop.models import Order
            if order_id:
                Order.objects.filter(id=order_id).update(billing_uuid=invoice_uuid)

        else:
            logger.info(f"[Reconciliation] Evento genérico recibido: {event_type}")
