import logging
import time
from typing import List, Dict, Any, Optional
from django.core.cache import cache
from .common import validate_postal_code, normalize_mexican_state, get_origin_address
from .client import SkydropxClient

logger = logging.getLogger("apps")


def get_fallback_rates() -> List[Dict[str, Any]]:
    """Tarifas planas de contingencia garantizadas ($150 MXN Estándar / $220 MXN Express)."""
    return [
        {
            "id": "rate_std_fallback",
            "provider": "Estándar Nacional (FedEx / Estafeta)",
            "service_level_name": "Terrestre Estándar",
            "total_price": 150.00,
            "currency": "MXN",
            "days": "3 a 5 días hábiles",
            "is_fallback": True
        },
        {
            "id": "rate_exp_fallback",
            "provider": "Express Nacional (DHL / FedEx Express)",
            "service_level_name": "Express Prioritario",
            "total_price": 220.00,
            "currency": "MXN",
            "days": "1 a 2 días hábiles",
            "is_fallback": True
        }
    ]


def parse_rates_from_payload(payload_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Parsea las tarifas retornadas por Skydropx Pro tanto en formato plano como JSON:API.
    """
    raw = payload_dict.get("rates", []) or payload_dict.get("data", [])
    if isinstance(raw, dict):
        raw = raw.get("rates", [])
    
    parsed = []
    for r in raw:
        attr = r.get("attributes", r)
        rate_status = attr.get("status", "approved")
        total_val = attr.get("total") or attr.get("total_price") or attr.get("amount") or attr.get("price")
        
        if total_val is not None and str(total_val).strip() and str(total_val) != "None":
            if rate_status and str(rate_status).lower() in ["rejected", "error", "failed", "cancelled"]:
                continue

            rate_id = str(r.get("id") or attr.get("id", ""))
            provider_name = (
                attr.get("provider_display_name") or 
                attr.get("provider_name") or 
                attr.get("carrier_name") or 
                attr.get("provider", "Paquetería Nacional")
            )
            service_name = (
                attr.get("provider_service_name") or 
                attr.get("service_level_name") or 
                attr.get("service_name") or 
                "Servicio Regular"
            )
            
            try:
                total_price = float(total_val)
            except (ValueError, TypeError):
                total_price = 150.0

            days = attr.get("days", attr.get("delivery_days", "3 a 5"))
            days_str = f"{days} días hábiles" if str(days).isdigit() else str(days)

            if rate_id:
                parsed.append({
                    "id": rate_id,
                    "provider": provider_name,
                    "service_level_name": service_name,
                    "total_price": total_price,
                    "currency": attr.get("currency_code", "MXN"),
                    "days": days_str,
                    "is_fallback": False
                })

    return parsed


def quote_shipping_rates(
    origin_zip: str, 
    dest_zip: str, 
    weight_kg: float = 1.0,
    dest_address_extra: Optional[Dict[str, Any]] = None,
    force_refresh: bool = False
) -> List[Dict[str, Any]]:
    """
    Cotiza tarifas multi-carrier en tiempo real usando Skydropx Pro API (POST /api/v1/quotations).
    Caché de 15 minutos (900s) para evitar que expiren los rate_ids generados por Skydropx.
    """
    if not validate_postal_code(origin_zip) or not validate_postal_code(dest_zip):
        logger.warning(f"[Quotations] Códigos postales inválidos: origen={origin_zip}, destino={dest_zip}")
        return get_fallback_rates()

    cache_key = f"shipping_quote_v2_{origin_zip}_{dest_zip}_{int(weight_kg * 10)}"
    if not force_refresh:
        cached = cache.get(cache_key)
        if cached:
            return cached

    client = SkydropxClient()
    if not client.is_configured:
        return get_fallback_rates()

    origin = get_origin_address()
    dest_extra = dest_address_extra or {}
    dest_state = normalize_mexican_state(dest_extra.get("state", "SO"))
    dest_city = dest_extra.get("city", "Hermosillo")
    dest_suburb = dest_extra.get("suburb", "Centro")
    dest_street = dest_extra.get("street", "Calle Principal 100")

    payload = {
        "quotation": {
            "address_from": {
                "country_code": "MX",
                "postal_code": str(origin.get("zip_code", "83150")).strip(),
                "area_level1": origin.get("state", "SO"),
                "area_level2": origin.get("city", "Hermosillo"),
                "area_level3": origin.get("suburb", "Pitic"),
                "street1": origin.get("street", "Blvd. Kino 456")
            },
            "address_to": {
                "country_code": "MX",
                "postal_code": str(dest_zip).strip(),
                "area_level1": dest_state,
                "area_level2": dest_city,
                "area_level3": dest_suburb,
                "street1": dest_street
            },
            "parcels": [
                {
                    "length": 35,
                    "width": 25,
                    "height": 15,
                    "weight": max(0.1, float(weight_kg)),
                    "package_protected": False,
                    "declared_value": 100.0
                }
            ]
        }
    }

    try:
        response = client.request("POST", "quotations", json_data=payload)
        if response.status_code in (200, 201):
            data = response.json()
            quotation_id = data.get("id")
            is_completed = data.get("is_completed", False)
            rates = parse_rates_from_payload(data)

            # Si la cotización en Skydropx Pro es asíncrona, consultar GET /quotations/{id}
            if quotation_id and (not is_completed or not rates):
                for _ in range(5):
                    time.sleep(0.5)
                    get_res = client.request("GET", f"quotations/{quotation_id}")
                    if get_res.status_code in (200, 201):
                        get_data = get_res.json()
                        polled_rates = parse_rates_from_payload(get_data)
                        if polled_rates:
                            rates = polled_rates
                            if get_data.get("is_completed"):
                                break

            if rates:
                rates.sort(key=lambda x: x["total_price"])
                cache.set(cache_key, rates, timeout=900)
                return rates
            else:
                logger.warning(f"[Quotations] Cotización exitosa pero sin tarifas en respuesta: {data}")
        else:
            logger.warning(f"[Quotations] Error en cotización ({response.status_code}): {response.text[:300]}")
    except Exception as e:
        logger.error(f"[Quotations] Excepción cotizando tarifas: {e}")

    return get_fallback_rates()
