import logging
from typing import Dict, Any, List, Optional
from django.core.cache import cache
from .client import SkydropxClient

logger = logging.getLogger("apps")


def get_carrier_services(carrier_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    GET /api/v1/carrier_services:
    Obtiene el catálogo de transportistas disponibles y sus niveles de servicio asociados.
    """
    cache_key = f"skydropx_carrier_services_{carrier_name or 'all'}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    client = SkydropxClient()
    if not client.is_configured:
        return [
            {"carrier": "fedex", "name": "FedEx", "services": ["standard", "express"]},
            {"carrier": "dhl", "name": "DHL Express", "services": ["express"]},
            {"carrier": "estafeta", "name": "Estafeta", "services": ["terrestre", "dia_siguiente"]},
            {"carrier": "paquetexpress", "name": "Paquetexpress", "services": ["estandar"]},
        ]

    params = {}
    if carrier_name:
        params["carrier"] = carrier_name.lower()

    try:
        res = client.request("GET", "carrier_services", params=params)
        if res.status_code == 200:
            data = res.json()
            items = data.get("data", [])
            cache.set(cache_key, items, timeout=86400)  # Caché de 24 horas
            return items
    except Exception as e:
        logger.warning(f"[Catalogs] Error consultando carrier_services: {e}")

    return []


def get_consignment_notes(search: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    GET /api/v1/consignment_notes:
    Consulta las claves de producto/servicio del SAT para la Carta Porte (ej. 53102400 para camisetas/merch).
    """
    client = SkydropxClient()
    if not client.is_configured:
        return [
            {"code": "53102400", "description": "Camisetas y prendas de vestir"},
            {"code": "55121600", "description": "Etiquetas y accesorios"},
            {"code": "43230000", "description": "Software y medios digitales"}
        ]

    params = {}
    if search:
        params["q"] = search

    try:
        res = client.request("GET", "consignment_notes", params=params)
        if res.status_code == 200:
            return res.json().get("data", [])
    except Exception as e:
        logger.warning(f"[Catalogs] Error consultando consignment_notes: {e}")

    return [{"code": "53102400", "description": "Prendas de vestir / Mercancía textil"}]


def get_packagings() -> List[Dict[str, Any]]:
    """
    GET /api/v1/packagings:
    Obtiene los embalajes predeterminados configurados en Skydropx.
    """
    client = SkydropxClient()
    if not client.is_configured:
        return [
            {"id": "box_s", "name": "Caja Chica (Ms Ambar)", "length": 25, "width": 20, "height": 10, "weight": 0.5},
            {"id": "box_m", "name": "Caja Mediana (Ms Ambar)", "length": 35, "width": 25, "height": 15, "weight": 1.0},
            {"id": "envelope", "name": "Sobre / Bolsa Courier", "length": 30, "width": 20, "height": 5, "weight": 0.3}
        ]

    try:
        res = client.request("GET", "packagings")
        if res.status_code == 200:
            return res.json().get("data", [])
    except Exception as e:
        logger.warning(f"[Catalogs] Error consultando packagings: {e}")

    return []


def get_office_points(carrier: str, postal_code: str) -> List[Dict[str, Any]]:
    """
    GET /api/v1/office_points:
    Consulta sucursales / puntos de entrega ocurre para el transportista y código postal.
    """
    client = SkydropxClient()
    if not client.is_configured:
        return []

    params = {"carrier": carrier.lower(), "postal_code": str(postal_code).strip()}
    try:
        res = client.request("GET", "office_points", params=params)
        if res.status_code == 200:
            return res.json().get("data", [])
    except Exception as e:
        logger.warning(f"[Catalogs] Error consultando office_points: {e}")

    return []
