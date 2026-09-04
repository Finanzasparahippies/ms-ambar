import logging
from typing import Optional, Dict, Any
from django.conf import settings

logger = logging.getLogger("apps")
SKYDROPX_MIN_BALANCE_ALERT = float(getattr(settings, "SKYDROPX_MIN_BALANCE_ALERT", 500.0))


def check_wallet_balance_alert(balance_amount: Optional[float], currency: str = "MXN") -> None:
    """Dispara log crítico si el saldo en cartera baja del umbral de seguridad."""
    if balance_amount is not None:
        try:
            numeric_balance = float(balance_amount)
            if numeric_balance < SKYDROPX_MIN_BALANCE_ALERT:
                logger.error(
                    f"[SKYDROPX_WALLET_CRITICAL] Saldo en cartera de Skydropx crítico: ${numeric_balance:.2f} {currency} "
                    f"(umbral de alerta: ${SKYDROPX_MIN_BALANCE_ALERT:.2f} {currency}). "
                    f"Recargue saldo inmediatamente en https://app.skydropx.com/ para prevenir interrupciones de despacho."
                )
        except (ValueError, TypeError):
            pass


def get_credits(client) -> Dict[str, Any]:
    """GET /api/v1/finance/credits: Consulta el saldo actual y créditos disponibles en Skydropx."""
    if not client.is_configured:
        return {"success": False, "error": "Skydropx no está configurado."}

    try:
        res = client._request("GET", "finance/credits")
        if res.status_code in (200, 201):
            data = res.json()
            credits_info = data.get("data", data)
            if isinstance(credits_info, dict):
                bal = credits_info.get("balance") or credits_info.get("amount") or credits_info.get("credits")
                curr = credits_info.get("currency") or credits_info.get("currency_code", "MXN")
                check_wallet_balance_alert(bal, currency=curr)

            return {
                "success": True,
                "status_code": res.status_code,
                "credits": credits_info,
                "raw": data
            }
        return {
            "success": False,
            "status_code": res.status_code,
            "error": f"HTTP {res.status_code}: {res.text[:200]}"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_extra_charges(client, page: int = 1, per_page: int = 20) -> Dict[str, Any]:
    """GET /api/v1/finance/extra-charges: Consulta lista de cargos extra o sobrepesos."""
    if not client.is_configured:
        return {"success": False, "error": "Skydropx no está configurado."}

    try:
        res = client._request("GET", "finance/extra-charges", params={"page": page, "per_page": per_page})
        if res.status_code == 200:
            return {"success": True, "data": res.json()}
        return {"success": False, "status_code": res.status_code, "error": res.text[:200]}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_transaction_stats(client, page: int = 1, kind: str = "all") -> Dict[str, Any]:
    """GET /api/v1/transaction_stats: Historial de movimientos contables y débitos."""
    if not client.is_configured:
        return {"success": False, "error": "Skydropx no está configurado."}

    try:
        params = {"page": page, "kind": kind}
        res = client._request("GET", "transaction_stats", params=params)
        if res.status_code == 200:
            return {"success": True, "data": res.json()}
        return {"success": False, "status_code": res.status_code, "error": res.text[:200]}
    except Exception as e:
        return {"success": False, "error": str(e)}
