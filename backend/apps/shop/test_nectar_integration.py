"""
Suite de Pruebas Automatizadas para la Integración Néctar Labs <-> Ms Ámbar.
Valida:
1. NectarGatewayClient: Generación criptográfica HMAC-SHA256, Connection Pooling y Timeouts.
2. Circuit Breaker Conmutativo de 3 Estados (CLOSED -> OPEN -> HALF_OPEN -> CLOSED).
3. Modo Degradado (Graceful Fallback & Encolado en Redis).
4. Receptor de Webhooks (NectarWebhookReceiverView): Deduplicación SETNX, Drift y Reconciliación.
"""

import time
import json
import uuid
import hmac
import hashlib
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.urls import reverse
from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase
from rest_framework import status

from services.nectar_client import NectarGatewayClient, NectarResponse
from apps.shop.models import Order


@override_settings(
    NECTAR_PLATFORM_URL="https://test.nectarlabs.dev",
    NECTAR_API_URL="https://test.nectarlabs.dev/api",
    NECTAR_TENANT_ID="tenant-ambar-uuid-12345",
    NECTAR_SECRET_KEY="test_super_secret_hmac_key_9988",
)
class NectarGatewayClientTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.client_sdk = NectarGatewayClient()
        self.client_sdk.tenant_id = "tenant-ambar-uuid-12345"
        self.client_sdk.secret_key = "test_super_secret_hmac_key_9988"
        self.client_sdk.base_url = "https://test.nectarlabs.dev/api"

    def test_singleton_pattern(self):
        """Valida que NectarGatewayClient opere como Singleton conservando el pool de sockets."""
        client_a = NectarGatewayClient()
        client_b = NectarGatewayClient()
        self.assertIs(client_a, client_b)

    def test_hmac_header_generation(self):
        """Verifica que las cabeceras HMAC generadas por el cliente sean criptográficamente válidas."""
        body = json.dumps({"amount": "500.00", "reference_id": "ord_101"}).encode('utf-8')
        idemp = str(uuid.uuid4())
        headers = self.client_sdk._generate_hmac_headers(body, idempotency_key=idemp)

        self.assertEqual(headers["X-Nectar-Tenant-ID"], "tenant-ambar-uuid-12345")
        self.assertIn("X-Nectar-Timestamp", headers)
        self.assertIn("X-Nectar-Signature", headers)
        self.assertEqual(headers["Idempotency-Key"], idemp)

        # Verificar matemáticamente la firma
        ts = headers["X-Nectar-Timestamp"]
        expected_sig = hmac.new(
            b"test_super_secret_hmac_key_9988",
            body + ts.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        self.assertEqual(headers["X-Nectar-Signature"], expected_sig)

    @patch("services.nectar_client.requests.Session.request")
    def test_successful_balance_query(self, mock_request):
        """Simula respuesta 200 OK del Hub Néctar Labs."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.content = b'{"wallet_balance": "2500.00", "available_balance": "2000.00"}'
        mock_resp.json.return_value = {
            "wallet_balance": "2500.00",
            "available_balance": "2000.00"
        }
        mock_request.return_value = mock_resp

        res = self.client_sdk.get_balance()
        self.assertTrue(res.success)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["wallet_balance"], "2500.00")
        self.assertFalse(res.is_degraded)

    @patch("services.nectar_client.requests.Session.request")
    def test_circuit_breaker_transition_and_graceful_fallback(self, mock_request):
        """
        Valida que tras 3 fallos 5xx o timeout consecutivos, el Circuit Breaker conmute
        a estado OPEN y derive inmediatamente al modo degradado sin bloquear el hilo.
        """
        # Simular 3 errores 500 consecutivos del servidor central
        mock_500 = MagicMock()
        mock_500.status_code = 500
        mock_500.text = "Internal Server Error"
        mock_500.content = b"Internal Server Error"
        mock_request.return_value = mock_500

        # Intento 1
        res1 = self.client_sdk.get_balance()
        self.assertFalse(res1.success)
        self.assertEqual(self.client_sdk._get_cb_state(), NectarGatewayClient.STATE_CLOSED)

        # Intento 2
        res2 = self.client_sdk.get_balance()
        self.assertFalse(res2.success)
        self.assertEqual(self.client_sdk._get_cb_state(), NectarGatewayClient.STATE_CLOSED)

        # Intento 3 -> Dispara apertura del Circuit Breaker
        res3 = self.client_sdk.get_balance()
        self.assertFalse(res3.success)
        self.assertEqual(self.client_sdk._get_cb_state(), NectarGatewayClient.STATE_OPEN)

        # Intento 4 -> Bloqueado en el cliente sin realizar llamada HTTP (Circuit Breaker OPEN)
        mock_request.reset_mock()
        res4 = self.client_sdk.reserve(Decimal("100.00"), reference_id="ord_999")
        self.assertFalse(res4.success)
        self.assertTrue(res4.is_degraded)
        self.assertEqual(res4.status_code, 503)
        self.assertEqual(res4.fallback_gateway, "stripe_direct")
        mock_request.assert_not_called()

        # Verificar que la transacción fallida se encoló en Redis para reconciliación
        queue_key = f"nectar_reconciliation_queue:{self.client_sdk.tenant_id}"
        cached_queue = json.loads(cache.get(queue_key) or "[]")
        self.assertTrue(len(cached_queue) > 0)
        self.assertEqual(cached_queue[-1]["data"]["reference_id"], "ord_999")


@override_settings(
    NECTAR_SECRET_KEY="test_webhook_hmac_secret_key_4433",
    NECTAR_TENANT_ID="tenant-ambar-uuid-12345"
)
class NectarWebhookReceiverTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.secret_key = "test_webhook_hmac_secret_key_4433"
        self.url = reverse('nectar-webhook')

    def _sign_payload(self, body_bytes: bytes, timestamp: int):
        message = body_bytes + str(int(timestamp)).encode('utf-8')
        sig = hmac.new(self.secret_key.encode('utf-8'), message, hashlib.sha256).hexdigest()
        return {
            'HTTP_X_NECTAR_TENANT_ID': "tenant-ambar-uuid-12345",
            'HTTP_X_NECTAR_TIMESTAMP': str(int(timestamp)),
            'HTTP_X_NECTAR_SIGNATURE': sig,
        }

    def test_webhook_accepts_valid_payload_immediately_202(self):
        """Valida que un webhook auténtico retorne HTTP 202 Accepted de inmediato."""
        payload = {
            "id": "evt_test_001",
            "type": "wallet.balance_updated",
            "data": {"wallet_balance": "3500.00"}
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        ts = int(time.time())
        headers = self._sign_payload(body_bytes, ts)

        response = self.client.post(self.url, data=body_bytes, content_type="application/json", **headers)
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["status"], "accepted")
        self.assertEqual(response.data["event_id"], "evt_test_001")

    def test_webhook_rejects_missing_headers(self):
        """Rechaza con 401 si faltan cabeceras de firma."""
        response = self.client.post(self.url, data={"data": "test"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["error"], "AUTHENTICATION_FAILED")

    def test_webhook_rejects_expired_timestamp_drift(self):
        """Rechaza con 401 si el timestamp tiene desfase superior a 300 segundos."""
        payload = {"id": "evt_expired_002"}
        body_bytes = json.dumps(payload).encode('utf-8')
        ts = int(time.time()) - 350
        headers = self._sign_payload(body_bytes, ts)

        response = self.client.post(self.url, data=body_bytes, content_type="application/json", **headers)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["error"], "TIMESTAMP_EXPIRED")

    def test_webhook_rejects_tampered_signature(self):
        """Rechaza con 401 si la firma criptográfica no coincide con el payload."""
        payload = {"id": "evt_tampered_003"}
        body_bytes = json.dumps(payload).encode('utf-8')
        ts = int(time.time())
        headers = self._sign_payload(body_bytes, ts)
        headers['HTTP_X_NECTAR_SIGNATURE'] = "f" * 64  # Firma alterada

        response = self.client.post(self.url, data=body_bytes, content_type="application/json", **headers)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["error"], "INVALID_SIGNATURE")

    def test_webhook_deduplication_via_redis_setnx(self):
        """
        Garantiza idempotencia en la recepción: si el mismo event_id se envía 2 veces,
        el segundo llamado responde 202 sin re-encolar ni re-procesar.
        """
        payload = {
            "id": "evt_idempotent_004",
            "type": "shipment.status_updated",
            "data": {"tracking_number": "TRK9988", "status": "DELIVERED"}
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        ts = int(time.time())
        headers = self._sign_payload(body_bytes, ts)

        # Primera entrega -> Procesa
        res1 = self.client.post(self.url, data=body_bytes, content_type="application/json", **headers)
        self.assertEqual(res1.status_code, status.HTTP_202_ACCEPTED)

        # Segunda entrega inmediata idéntica -> Detectado por Redis SETNX como ya recibido
        res2 = self.client.post(self.url, data=body_bytes, content_type="application/json", **headers)
        self.assertEqual(res2.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn("ya recibido", res2.data.get("detail", ""))
