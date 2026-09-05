import os
import time
import uuid
import logging
import requests
from typing import Optional, Dict, Any, List
from django.conf import settings
from .auth import OAuthManager
from .common import get_origin_address

logger = logging.getLogger("apps")

SKYDROPX_PRO_URLS = {
    "staging": "https://sb-pro.skydropx.com/api/v1",
    "sandbox": "https://sb-pro.skydropx.com/api/v1",
    "pro_staging": "https://sb-pro.skydropx.com/api/v1",
    "pro_sandbox": "https://sb-pro.skydropx.com/api/v1",
    "production": "https://app.skydropx.com/api/v1",
    "prod": "https://app.skydropx.com/api/v1",
    "pro_production": "https://app.skydropx.com/api/v1",
}

SKYDROPX_OAUTH_URLS = {
    "staging": "https://sb-pro.skydropx.com/api/v1/oauth/token",
    "sandbox": "https://sb-pro.skydropx.com/api/v1/oauth/token",
    "pro_staging": "https://sb-pro.skydropx.com/api/v1/oauth/token",
    "pro_sandbox": "https://sb-pro.skydropx.com/api/v1/oauth/token",
    "production": "https://app.skydropx.com/api/v1/oauth/token",
    "prod": "https://app.skydropx.com/api/v1/oauth/token",
    "pro_production": "https://app.skydropx.com/api/v1/oauth/token",
}


class SkydropxClient:
    """
    Cliente oficial modular para Skydropx Pro API.
    Soporta flujos síncronos y asíncronos (HTTP 202), Correlation IDs y auditoría.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        environment: Optional[str] = None,
        base_url: Optional[str] = None,
        correlation_id: Optional[str] = None
    ):
        self.environment = (
            environment or
            getattr(settings, "SKYDROPX_ENVIRONMENT", None) or
            os.environ.get("SKYDROPX_ENVIRONMENT", "staging")
        ).lower().strip()

        # Selección de credenciales según entorno
        if self.environment in ["production", "prod", "pro_production"]:
            key_candidates = [
                api_key,
                os.environ.get("SKYDROPX_PROD_API_KEY", ""),
                os.environ.get("SKYDROPX_API_KEY", ""),
                os.environ.get("AMBAR_OWN_SKYDROPX_KEY", ""),
                os.environ.get("NECTAR_LABS_SKYDROPX_API_KEY", ""),
                getattr(settings, "SKYDROPX_API_KEY", "")
            ]
            secret_candidates = [
                api_secret,
                os.environ.get("SKYDROPX_PROD_API_SECRET", ""),
                os.environ.get("SKYDROPX_API_SECRET", ""),
                os.environ.get("NECTAR_LABS_SKYDROPX_API_SECRET", ""),
                getattr(settings, "SKYDROPX_API_SECRET", "")
            ]
        else:
            key_candidates = [
                api_key,
                os.environ.get("SKYDROPX_SANDBOX_API_KEY", ""),
                os.environ.get("SKYDROPX_API_KEY", ""),
                os.environ.get("NECTAR_LABS_SKYDROPX_API_KEY", ""),
                os.environ.get("AMBAR_OWN_SKYDROPX_KEY", ""),
                getattr(settings, "SKYDROPX_API_KEY", "")
            ]
            secret_candidates = [
                api_secret,
                os.environ.get("SKYDROPX_SANDBOX_API_SECRET", ""),
                os.environ.get("SKYDROPX_API_SECRET", ""),
                os.environ.get("NECTAR_LABS_SKYDROPX_API_SECRET", ""),
                getattr(settings, "SKYDROPX_API_SECRET", "")
            ]

        self.api_key = next((k.strip() for k in key_candidates if k and k.strip()), "")
        self.api_secret = next((s.strip() for s in secret_candidates if s and s.strip()), "")

        if base_url:
            self.base_url = str(base_url).rstrip('/')
        else:
            self.base_url = SKYDROPX_PRO_URLS.get(self.environment, "https://sb-pro.skydropx.com/api/v1")

        self.oauth_url = SKYDROPX_OAUTH_URLS.get(self.environment, f"{self.base_url}/oauth/token")
        self.timeout = 10.0
        self.correlation_id = correlation_id or f"skydropx:req-{uuid.uuid4().hex[:12]}"

        self.oauth_manager = OAuthManager(
            client_id=self.api_key,
            client_secret=self.api_secret,
            oauth_url=self.oauth_url,
            environment=self.environment,
            timeout=self.timeout
        )

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key != "mock_key" and not getattr(settings, "TESTING", False))

    def _headers(self, force_refresh: bool = False, idempotency_key: Optional[str] = None) -> Dict[str, str]:
        token = self.oauth_manager.get_access_token(force_refresh=force_refresh)
        auth_header = f"Bearer {token}" if token else f"Bearer {self.api_key}"
        headers = {
            "Authorization": auth_header,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "MsAmbarLogistics/2.1 (+https://msambar.com)",
            "X-Correlation-ID": self.correlation_id,
        }
        if idempotency_key:
            headers["X-Idempotency-Key"] = str(idempotency_key)
        return headers

    def _request(
        self,
        method: str,
        endpoint: str,
        json_data: Optional[dict] = None,
        params: Optional[dict] = None,
        retry_auth: bool = True,
        idempotency_key: Optional[str] = None
    ) -> requests.Response:
        """
        Ejecuta petición HTTP contra Skydropx Pro asegurando trazabilidad por Correlation-ID,
        soporte de Idempotency Key y reintento transparente si el token expiró (HTTP 401).
        """
        if endpoint.startswith("http"):
            url = endpoint
        else:
            clean_endpoint = endpoint.strip('/')
            url = f"{self.base_url}/{clean_endpoint}/" if endpoint.endswith('/') else f"{self.base_url}/{clean_endpoint}"

        headers = self._headers(idempotency_key=idempotency_key)
        res = requests.request(
            method=method,
            url=url,
            json=json_data,
            params=params,
            headers=headers,
            timeout=self.timeout
        )

        # Si retorna 401 y tenemos secret, refrescar token y reintentar una sola vez
        if res.status_code == 401 and retry_auth and self.api_secret:
            logger.info(f"[{self.correlation_id}] 401 recibido de Skydropx. Refrescando token OAuth2...")
            self.oauth_manager.invalidate_token()
            headers = self._headers(force_refresh=True, idempotency_key=idempotency_key)
            res = requests.request(
                method=method,
                url=url,
                json=json_data,
                params=params,
                headers=headers,
                timeout=self.timeout
            )

        return res

    def request(
        self, 
        method: str, 
        endpoint: str, 
        json_data: Optional[dict] = None, 
        params: Optional[dict] = None, 
        retry_auth: bool = True,
        idempotency_key: Optional[str] = None
    ) -> requests.Response:
        return self._request(
            method=method, 
            endpoint=endpoint, 
            json_data=json_data, 
            params=params, 
            retry_auth=retry_auth,
            idempotency_key=idempotency_key
        )

    def get_shipment(self, shipment_id: str) -> Dict[str, Any]:
        """GET /api/v1/shipments/{id}: Consulta el estado detallado de un envío."""
        clean_id = str(shipment_id).strip()
        try:
            res = self.request("GET", f"shipments/{clean_id}")
            if res.status_code in (200, 201):
                return {"success": True, "status_code": res.status_code, "data": res.json()}
            return {"success": False, "status_code": res.status_code, "error": res.text}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def auto_advance_shipment(self, shipment_id: str) -> Dict[str, Any]:
        """POST /api/v1/sandbox/advance o endpoint similar para sandbox (bloqueado en producción)."""
        if self.environment in ["production", "prod", "pro_production"] or getattr(settings, "ENVIRONMENT", "").lower() in ["production", "prod"]:
            logger.warning("[SkydropxClient] Auto-advance bloqueado estrictamente en entorno de producción.")
            return {"success": False, "error": "Auto-advance is strictly disabled in production environments."}

        clean_id = str(shipment_id).strip()
        try:
            res = self.request("POST", f"sandbox/shipments/{clean_id}/advance")
            if res.status_code in (200, 201, 204):
                return {"success": True, "status_code": res.status_code}
            return {"success": False, "status_code": res.status_code, "error": res.text}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # Métodos fachada delegados
    def quote_rates(self, origin_zip: str, dest_zip: str, weight_kg: float = 1.0, dest_address_extra: Optional[dict] = None) -> List[Dict[str, Any]]:
        from .quotations import quote_shipping_rates
        return quote_shipping_rates(origin_zip, dest_zip, weight_kg, dest_address_extra)

    def create_shipment_from_rate(self, rate_id: str, address_from: Optional[dict] = None, address_to: Optional[dict] = None, order: Any = None) -> Optional[Dict[str, Any]]:
        from .shipments import create_shipment_from_rate
        return create_shipment_from_rate(self, rate_id, address_from, address_to, order)

    def create_shipment_direct(self, origin_address: dict, destination_address: dict, parcel: Optional[dict] = None, carrier_name: Optional[str] = None, service_name: Optional[str] = None, order: Any = None) -> Optional[Dict[str, Any]]:
        from .shipments import create_rate_shipment
        return create_rate_shipment(self, origin_address, destination_address, parcel, carrier_name, service_name, order)

    def get_credits(self) -> Dict[str, Any]:
        from .finance import get_credits
        return get_credits(self)

    def cancel_shipment(self, shipment_id: str, reason: str = "Cancelado por el cliente") -> Dict[str, Any]:
        from .shipments import cancel_shipment
        return cancel_shipment(self, shipment_id, reason)

    def test_connectivity(self, dest_zip: str = "83100") -> Dict[str, Any]:
        start = time.time()
        result = {
            "base_url": self.base_url,
            "oauth_url": self.oauth_url,
            "environment": self.environment,
            "is_configured": self.is_configured,
            "correlation_id": self.correlation_id,
            "oauth_token_acquired": False,
            "status_code": None,
            "latency_ms": 0,
            "success": False,
            "carriers_found": [],
            "credits_balance": None,
            "error": None
        }

        if not self.is_configured:
            result["error"] = "Skydropx no está configurado (faltan credenciales)."
            return result

        token = self.oauth_manager.get_access_token(force_refresh=True)
        result["oauth_token_acquired"] = bool(token)

        origin = get_origin_address()
        try:
            rates = self.quote_rates(origin["zip_code"], dest_zip)
            result["latency_ms"] = int((time.time() - start) * 1000)
            real_rates = [r for r in rates if not r.get("is_fallback")]
            if real_rates:
                result["success"] = True
                result["status_code"] = 200
                result["carriers_found"] = real_rates
            else:
                result["status_code"] = 200
                result["error"] = "Cotización exitosa pero sin tarifas en vivo para ese CP."
        except Exception as e:
            result["latency_ms"] = int((time.time() - start) * 1000)
            result["error"] = str(e)

        credits_res = self.get_credits()
        if credits_res.get("success"):
            result["credits_balance"] = credits_res.get("credits")

        return result

    def probe_all_gateways(self, dest_zip: str = "83100") -> List[Dict[str, Any]]:
        """Sondea los endpoints conocidos de Skydropx para diagnóstico de conectividad."""
        gateways = [
            {"label": "Sandbox / Staging (Pro)", "url": "https://sb-pro.skydropx.com/api/v1"},
            {"label": "Producción (Pro)", "url": "https://app.skydropx.com/api/v1"},
        ]
        results = []
        for gw in gateways:
            t0 = time.time()
            probe_client = SkydropxClient(base_url=gw["url"], environment=self.environment)
            res = probe_client.test_connectivity(dest_zip=dest_zip)
            elapsed = int((time.time() - t0) * 1000)
            summary = "OK" if res["success"] else (res.get("error") or "Fallo")
            results.append({
                "label": gw["label"],
                "status_code": res.get("status_code"),
                "latency_ms": elapsed,
                "success": res["success"],
                "summary": str(summary)[:60]
            })
        return results
