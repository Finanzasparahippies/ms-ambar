"""
SDK Cliente de Alto Rendimiento y Resiliencia para el Tenant Autónomo (ms-ambar).
Integra Connection Pooling persistente, Timeouts Quirúrgicos, Circuit Breaker
conmutativo de 3 estados, firma criptográfica HMAC-SHA256 y Modo Degradado (Graceful Fallback).
"""

import os
import time
import json
import uuid
import hmac
import hashlib
import logging
from decimal import Decimal
from dataclasses import dataclass, field
from typing import Optional, Dict, Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Timeouts quirúrgicos
TIMEOUT_READ_SECONDS = 2.5
TIMEOUT_MUTATION_SECONDS = 4.0

# Circuit Breaker thresholds
CIRCUIT_BREAKER_MAX_FAILURES = 3
CIRCUIT_BREAKER_RESET_TIMEOUT = 30  # segundos en estado OPEN antes de probar HALF_OPEN


@dataclass
class NectarResponse:
    success: bool
    status_code: int = 0
    data: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    is_degraded: bool = False
    fallback_gateway: Optional[str] = None
    idempotency_key: Optional[str] = None


class CircuitBreakerOpenException(Exception):
    """Lanzada cuando el Circuit Breaker está en estado OPEN y se rechaza la llamada."""
    pass


class NectarGatewayClient:
    """
    Cliente oficial para consumo seguro de microservicios de Néctar Labs.
    """

    STATE_CLOSED = "CLOSED"
    STATE_OPEN = "OPEN"
    STATE_HALF_OPEN = "HALF_OPEN"

    _instance = None
    _session = None

    def __new__(cls, *args, **kwargs):
        """Patrón Singleton para compartir el Pool de conexiones HTTP en todo el proceso."""
        if cls._instance is None:
            cls._instance = super(NectarGatewayClient, cls).__new__(cls)
            cls._instance._init_client()
        return cls._instance

    def _init_client(self):
        # Configuración de URLs y credenciales desde settings o entorno
        self.base_url = (
            getattr(settings, "NECTAR_API_URL", None) or
            os.getenv("NECTAR_API_URL", "https://nectarlabs.dev/api")
        ).rstrip('/')

        self.tenant_id = (
            getattr(settings, "NECTAR_TENANT_ID", None) or
            os.getenv("NECTAR_TENANT_ID", "")
        ).strip()

        self.secret_key = (
            getattr(settings, "NECTAR_SECRET_KEY", None) or
            getattr(settings, "NECTAR_API_KEY", None) or
            os.getenv("NECTAR_SECRET_KEY", os.getenv("NECTAR_API_KEY", ""))
        ).strip()

        # Inicialización del Pool de Conexiones persistentes
        self.session = requests.Session()
        retries = Retry(
            total=1,  # 1 reintento para fallos de transporte puros, sin retener requests largos
            backoff_factor=0.3,
            status_forcelist=[502, 503, 504],
            raise_on_status=False
        )
        adapter = HTTPAdapter(
            pool_connections=20,
            pool_maxsize=50,
            max_retries=retries
        )
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

    # --------------------------------------------------------------------------
    # Circuit Breaker (Gestión de Estados en Redis con fallback local)
    # --------------------------------------------------------------------------
    def _get_cb_state(self) -> str:
        state = cache.get(f"nectar_cb_state:{self.tenant_id}")
        return state or self.STATE_CLOSED

    def _set_cb_state(self, state: str, timeout: int = 3600):
        cache.set(f"nectar_cb_state:{self.tenant_id}", state, timeout=timeout)

    def _record_success(self):
        state = self._get_cb_state()
        if state == self.STATE_HALF_OPEN:
            logger.info("[CircuitBreaker] Prueba exitosa en HALF_OPEN. Restableciendo a CLOSED.")
            self._set_cb_state(self.STATE_CLOSED)
        cache.delete(f"nectar_cb_failures:{self.tenant_id}")

    def _record_failure(self):
        fail_key = f"nectar_cb_failures:{self.tenant_id}"
        current_fails = cache.get(fail_key, 0)
        try:
            current_fails = int(current_fails) + 1
        except Exception:
            current_fails = 1

        cache.set(fail_key, current_fails, timeout=CIRCUIT_BREAKER_RESET_TIMEOUT * 2)

        if current_fails >= CIRCUIT_BREAKER_MAX_FAILURES:
            logger.critical(
                f"[CircuitBreaker] {current_fails} fallos consecutivos detectados hacia Néctar Labs. "
                f"Conmutando a estado OPEN por {CIRCUIT_BREAKER_RESET_TIMEOUT}s."
            )
            self._set_cb_state(self.STATE_OPEN, timeout=CIRCUIT_BREAKER_RESET_TIMEOUT)

    def _can_execute(self) -> bool:
        state = self._get_cb_state()
        if state == self.STATE_CLOSED:
            return True
        if state == self.STATE_OPEN:
            # Si la clave expiró en Redis, intentar HALF_OPEN
            # Verificamos si aún existe la clave
            if cache.get(f"nectar_cb_state:{self.tenant_id}") is None:
                self._set_cb_state(self.STATE_HALF_OPEN, timeout=15)
                logger.info("[CircuitBreaker] Transición de OPEN -> HALF_OPEN (petición de prueba).")
                return True
            return False
        if state == self.STATE_HALF_OPEN:
            return True
        return True

    # --------------------------------------------------------------------------
    # Generador Criptográfico HMAC-SHA256
    # --------------------------------------------------------------------------
    def _generate_hmac_headers(self, raw_body_bytes: bytes, idempotency_key: Optional[str] = None) -> Dict[str, str]:
        timestamp = str(int(time.time()))
        payload = raw_body_bytes or b""
        message = payload + timestamp.encode('utf-8')
        signature = hmac.new(self.secret_key.encode('utf-8'), message, hashlib.sha256).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Nectar-Tenant-ID": self.tenant_id,
            "X-Nectar-Timestamp": timestamp,
            "X-Nectar-Signature": signature,
        }
        if idempotency_key:
            headers["Idempotency-Key"] = str(idempotency_key)
        return headers

    # --------------------------------------------------------------------------
    # Ejecutor HTTP Resiliente
    # --------------------------------------------------------------------------
    def _execute_request(
        self,
        method: str,
        path: str,
        data: Optional[Dict] = None,
        timeout: float = TIMEOUT_MUTATION_SECONDS,
        idempotency_key: Optional[str] = None
    ) -> NectarResponse:
        url = f"{self.base_url}{path}"
        serialized_body = json.dumps(data).encode('utf-8') if data else b""

        # Validación de Circuit Breaker
        if not self._can_execute():
            logger.warning(f"[NectarGatewayClient] Llamada a {path} bloqueada: Circuit Breaker está OPEN.")
            return self._trigger_graceful_fallback(path, data, idempotency_key, "CIRCUIT_BREAKER_OPEN")

        headers = self._generate_hmac_headers(serialized_body, idempotency_key=idempotency_key)

        try:
            response = self.session.request(
                method=method,
                url=url,
                data=serialized_body,
                headers=headers,
                timeout=timeout
            )

            # Éxito 2xx
            if 200 <= response.status_code < 300:
                self._record_success()
                resp_json = response.json() if response.content else {}
                return NectarResponse(
                    success=True,
                    status_code=response.status_code,
                    data=resp_json,
                    idempotency_key=idempotency_key
                )

            # Error del cliente 4xx (no dispara Circuit Breaker, es error de negocio)
            if 400 <= response.status_code < 500:
                err_json = response.json() if response.content else {}
                return NectarResponse(
                    success=False,
                    status_code=response.status_code,
                    data=err_json,
                    error=err_json.get("detail") or err_json.get("error") or response.text,
                    idempotency_key=idempotency_key
                )

            # Error 5xx del servidor central
            logger.error(f"[NectarGatewayClient] Error 5xx ({response.status_code}) desde {url}: {response.text}")
            self._record_failure()
            return self._trigger_graceful_fallback(path, data, idempotency_key, f"HTTP_{response.status_code}")

        except (requests.Timeout, requests.ConnectionError) as net_err:
            logger.error(f"[NectarGatewayClient] Fallo de conectividad/timeout contra {url}: {net_err}")
            self._record_failure()
            return self._trigger_graceful_fallback(path, data, idempotency_key, "TIMEOUT_OR_CONNECTION_ERROR")
        except Exception as ex:
            logger.critical(f"[NectarGatewayClient] Excepción no controlada llamando a {url}: {ex}", exc_info=True)
            self._record_failure()
            return self._trigger_graceful_fallback(path, data, idempotency_key, f"CLIENT_EXCEPTION: {str(ex)}")

    # --------------------------------------------------------------------------
    # Modo Degradado (Graceful Fallback & Offline Reconciliation)
    # --------------------------------------------------------------------------
    def _trigger_graceful_fallback(
        self,
        path: str,
        data: Optional[Dict],
        idempotency_key: Optional[str],
        reason: str
    ) -> NectarResponse:
        """
        Garantiza que la experiencia del usuario no se interrumpa.
        Encola la transacción para reconciliación asíncrona y sugiere pasarela de contingencia.
        """
        recon_payload = {
            "path": path,
            "data": data,
            "idempotency_key": idempotency_key or str(uuid.uuid4()),
            "reason": reason,
            "failed_at": time.time()
        }
        try:
            # Encolar en cola de reconciliación en Redis
            queue_key = f"nectar_reconciliation_queue:{self.tenant_id}"
            cache_raw = cache.get(queue_key) or "[]"
            queue_items = json.loads(cache_raw) if isinstance(cache_raw, str) else []
            queue_items.append(recon_payload)
            # Mantener últimas 500 transacciones pendientes
            cache.set(queue_key, json.dumps(queue_items[-500:]), timeout=86400 * 7)
            logger.info(f"[GracefulFallback] Transacción {idempotency_key} encolada exitosamente para reconciliación diferida.")
        except Exception as e:
            logger.error(f"[GracefulFallback] Error al encolar en Redis: {e}")

        return NectarResponse(
            success=False,
            status_code=503,
            error=reason,
            is_degraded=True,
            fallback_gateway="stripe_direct",
            idempotency_key=idempotency_key,
            data={
                "message": "Néctar Wallet temporalmente fuera de línea. Derivando a pasarela de contingencia.",
                "queued_for_reconciliation": True
            }
        )

    # --------------------------------------------------------------------------
    # Operaciones de la Billetera (Néctar Wallet)
    # --------------------------------------------------------------------------
    def get_balance(self) -> NectarResponse:
        """Consulta el saldo de la billetera (Timeout 2.5s)."""
        return self._execute_request(
            method="GET",
            path="/v1/wallet/balance/",
            timeout=TIMEOUT_READ_SECONDS
        )

    def reserve(
        self,
        amount: Decimal,
        reference_id: str,
        service_type: str = "ECOMMERCE_CHECKOUT",
        description: str = "",
        expires_in_seconds: int = 900,
        idempotency_key: Optional[str] = None
    ) -> NectarResponse:
        """Fase 1: Congelar saldo durante el checkout (Timeout 4.0s)."""
        key = idempotency_key or str(uuid.uuid4())
        payload = {
            "amount": str(amount),
            "reference_id": str(reference_id),
            "service_type": service_type,
            "description": description or f"Reserva para orden {reference_id}",
            "expires_in_seconds": expires_in_seconds,
        }
        return self._execute_request(
            method="POST",
            path="/v1/wallet/reserve/",
            data=payload,
            timeout=TIMEOUT_MUTATION_SECONDS,
            idempotency_key=key
        )

    def capture(
        self,
        reservation_id: Optional[str] = None,
        reference_id: Optional[str] = None,
        idempotency_key: Optional[str] = None
    ) -> NectarResponse:
        """Fase 2: Confirmar y debitar definitivamente (Timeout 4.0s)."""
        key = idempotency_key or str(uuid.uuid4())
        payload = {}
        if reservation_id:
            payload["reservation_id"] = str(reservation_id)
        if reference_id:
            payload["reference_id"] = str(reference_id)

        return self._execute_request(
            method="POST",
            path="/v1/wallet/capture/",
            data=payload,
            timeout=TIMEOUT_MUTATION_SECONDS,
            idempotency_key=key
        )

    def release(
        self,
        reservation_id: Optional[str] = None,
        reference_id: Optional[str] = None,
        idempotency_key: Optional[str] = None
    ) -> NectarResponse:
        """Liberar / desbloquear saldo retenido tras cancelación (Timeout 4.0s)."""
        key = idempotency_key or str(uuid.uuid4())
        payload = {}
        if reservation_id:
            payload["reservation_id"] = str(reservation_id)
        if reference_id:
            payload["reference_id"] = str(reference_id)

        return self._execute_request(
            method="POST",
            path="/v1/wallet/release/",
            data=payload,
            timeout=TIMEOUT_MUTATION_SECONDS,
            idempotency_key=key
        )

    def debit(
        self,
        amount: Decimal,
        reference_id: str,
        service_type: str = "OTHER",
        description: str = "",
        idempotency_key: Optional[str] = None
    ) -> NectarResponse:
        """Débito directo atómico e idempotente (Timeout 4.0s)."""
        key = idempotency_key or str(uuid.uuid4())
        payload = {
            "amount": str(amount),
            "reference_id": str(reference_id),
            "service_type": service_type,
            "description": description or f"Cobro por {service_type}",
        }
        return self._execute_request(
            method="POST",
            path="/v1/wallet/debit/",
            data=payload,
            timeout=TIMEOUT_MUTATION_SECONDS,
            idempotency_key=key
        )

    def credit(
        self,
        amount: Decimal,
        reference_id: str,
        service_type: str = "RECHARGE",
        description: str = "",
        idempotency_key: Optional[str] = None
    ) -> NectarResponse:
        """Abono o recarga de saldo (Timeout 4.0s)."""
        key = idempotency_key or str(uuid.uuid4())
        payload = {
            "amount": str(amount),
            "reference_id": str(reference_id),
            "service_type": service_type,
            "description": description or "Recarga de saldo",
        }
        return self._execute_request(
            method="POST",
            path="/v1/wallet/credit/",
            data=payload,
            timeout=TIMEOUT_MUTATION_SECONDS,
            idempotency_key=key
        )
