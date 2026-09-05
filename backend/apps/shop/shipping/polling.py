import time
import random
import logging
from typing import Dict, Any, Optional
from django.conf import settings
from .common import ShippingStatus, map_skydropx_status

logger = logging.getLogger("apps")

DEFAULT_BACKOFF_INTERVALS = [1.0, 2.0, 4.0, 8.0, 16.0]
MAX_POLL_TIMEOUT_SECONDS = 45.0


def poll_shipment_resolution(
    client,
    shipment_id: str,
    max_timeout: float = MAX_POLL_TIMEOUT_SECONDS,
    intervals: Optional[list] = None,
    auto_advance_sandbox: bool = False
) -> Dict[str, Any]:
    """
    Sondea la resolución asíncrona de un envío (guía y tracking) en Skydropx Pro
    utilizando backoff exponencial con jitter para evitar sobrecargar la API.
    
    Retorna un diccionario con:
      - success: bool
      - status: str ('completed', 'processing', 'failed', 'timeout', etc.)
      - shipment_id: str
      - tracking_number: str
      - tracking_url: str
      - label_url: str
      - carrier_name: str
      - raw_data: dict
    """
    if intervals is None:
        intervals = DEFAULT_BACKOFF_INTERVALS

    start_time = time.time()
    last_response = None
    step = 0

    # Auto-advance en sandbox si está explícitamente activado y no estamos en prod
    can_auto_advance = (
        auto_advance_sandbox or getattr(settings, "SKYDROPX_AUTO_ADVANCE", False)
    ) and str(getattr(client, "environment", "")).lower() not in ["production", "prod", "pro_production"] and getattr(settings, "ENVIRONMENT", "").lower() not in ["production", "prod"]

    if can_auto_advance:
        try:
            logger.info(f"[Skydropx Polling] Intentando auto-advance de sandbox para envío {shipment_id}")
            advance_res = client.auto_advance_shipment(shipment_id)
            if advance_res.get("success"):
                logger.info(f"[Skydropx Polling] Auto-advance aplicado exitosamente para {shipment_id}")
        except Exception as e:
            logger.warning(f"[Skydropx Polling] Falló auto-advance de sandbox: {e}")

    for base_interval in intervals:
        elapsed = time.time() - start_time
        if elapsed >= max_timeout:
            break

        step += 1
        # Consultar estado actual del envío
        shipment_data = client.get_shipment(shipment_id)
        last_response = shipment_data

        if shipment_data.get("success"):
            data = shipment_data.get("data") or {}
            # El backend de Skydropx puede devolver data anidada o plana
            attrs = data.get("attributes", data)
            current_status = str(attrs.get("status") or "").lower()
            label_url = attrs.get("label_url") or attrs.get("label") or attrs.get("url") or ""
            tracking_number = attrs.get("tracking_number") or attrs.get("tracking") or ""
            carrier_name = attrs.get("carrier_name") or attrs.get("carrier") or ""

            mapped_status, is_known = map_skydropx_status(current_status)
            if not is_known:
                logger.warning(
                    f"[Skydropx Polling] ⚠️ Código o estado externo no reconocido: '{current_status}' "
                    f"para shipment_id {shipment_id}. Mapeado a internal_status='{mapped_status}'."
                )

            logger.info(
                f"[Skydropx Polling] Intento #{step} para {shipment_id} - "
                f"Estado: {current_status} (interno: {mapped_status}), Tracking: {bool(tracking_number)}, Label: {bool(label_url)}"
            )

            # Si ya tenemos tracking number o status completado
            if mapped_status == ShippingStatus.COMPLETED.value or (tracking_number and label_url):
                return {
                    "success": True,
                    "status": "completed",
                    "shipment_id": shipment_id,
                    "tracking_number": tracking_number,
                    "tracking_url": attrs.get("tracking_url") or f"https://track.skydropx.com/?q={tracking_number}",
                    "label_url": label_url,
                    "carrier_name": carrier_name,
                    "raw_data": data
                }

            if mapped_status in [ShippingStatus.FAILED.value, ShippingStatus.CANCELLED.value]:
                error_msg = attrs.get("error_message") or attrs.get("message") or f"Envío finalizó con status: {current_status}"
                logger.error(f"[Skydropx Polling] Envío {shipment_id} terminó con status de error: {error_msg}")
                return {
                    "success": False,
                    "status": mapped_status,
                    "shipment_id": shipment_id,
                    "error": error_msg,
                    "raw_data": data
                }

        # Calcular tiempo de espera con jitter (+/- 25%)
        jitter = random.uniform(-0.25, 0.25) * base_interval
        sleep_duration = max(0.5, base_interval + jitter)

        # No dormir más allá de max_timeout
        if (time.time() - start_time) + sleep_duration > max_timeout:
            sleep_duration = max(0.1, max_timeout - (time.time() - start_time))

        time.sleep(sleep_duration)

    # Si se agota el tiempo de polling, retornar estado actual sin marcar error fatal
    logger.warning(
        f"[Skydropx Polling] Timeout ({max_timeout}s) alcanzado para envío {shipment_id}. "
        f"Permanecerá en procesamiento asíncrono para reconciliación o webhook."
    )
    
    status_label = "processing"
    label_url = ""
    tracking_number = ""
    carrier_name = ""
    raw = {}

    if last_response and last_response.get("success"):
        raw = last_response.get("data") or {}
        attrs = raw.get("attributes", raw)
        status_label = attrs.get("status") or "processing"
        label_url = attrs.get("label_url") or ""
        tracking_number = attrs.get("tracking_number") or ""
        carrier_name = attrs.get("carrier_name") or ""

    return {
        "success": bool(tracking_number),
        "status": "label_pending" if tracking_number and not label_url else status_label,
        "shipment_id": shipment_id,
        "tracking_number": tracking_number,
        "tracking_url": f"https://track.skydropx.com/?q={tracking_number}" if tracking_number else "",
        "label_url": label_url,
        "carrier_name": carrier_name,
        "timeout": True,
        "raw_data": raw
    }
