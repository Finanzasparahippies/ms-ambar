import os
import re
import logging
import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger("apps")

# Mapeo oficial ISO 3166-2:MX para las 32 entidades federativas
MEXICO_STATES_ISO = {
    "AGUASCALIENTES": "AG",
    "BAJA CALIFORNIA": "BC",
    "BAJA CALIFORNIA SUR": "BS",
    "CAMPECHE": "CM",
    "CHIAPAS": "CS",
    "CHIHUAHUA": "CH",
    "CIUDAD DE MEXICO": "DF",
    "CDMX": "DF",
    "DISTRITO FEDERAL": "DF",
    "COAHUILA": "CO",
    "COLIMA": "CL",
    "DURANGO": "DG",
    "ESTADO DE MEXICO": "EM",
    "EDOMEX": "EM",
    "MEXICO": "EM",
    "GUANAJUATO": "GT",
    "GUERRERO": "GR",
    "HIDALGO": "HG",
    "JALISCO": "JA",
    "MICHOACAN": "MI",
    "MORELOS": "MO",
    "NAYARIT": "NA",
    "NUEVO LEON": "NL",
    "OAXACA": "OA",
    "PUEBLA": "PU",
    "QUERETARO": "QE",
    "QUINTANA ROO": "QR",
    "SAN LUIS POTOSI": "SL",
    "SINALOA": "SI",
    "SONORA": "SO",
    "TABASCO": "TB",
    "TAMAULIPAS": "TM",
    "TLAXCALA": "TL",
    "VERACRUZ": "VE",
    "YUCATAN": "YU",
    "ZACATECAS": "ZA",
}

# Prefijos de Código Postal para pre-detección de Entidad Federativa
POSTAL_CODE_PREFIX_TO_STATE = {
    "0": ("Ciudad de México", "DF"),
    "1": ("Ciudad de México / EdoMex", "DF"),
    "2": ("Baja California / BCS / Sonora", "SO"),
    "3": ("Chihuahua / Coahuila / Durango", "CH"),
    "4": ("Jalisco / Colima / Michoacán", "JA"),
    "5": ("Estado de México", "EM"),
    "6": ("Morelos / Guerrero / Michoacán", "MO"),
    "7": ("Puebla / Tlaxcala / Oaxaca / Veracruz", "PU"),
    "8": ("Sonora / Sinaloa / Tabasco", "SO"),
    "9": ("Yucatán / Quintana Roo / Campeche / Chiapas", "YU"),
}

def normalize_mexican_state(state_name: str) -> str:
    """Normaliza el nombre de un estado mexicano a su código de 2 letras."""
    if not state_name:
        return "SO"
    
    clean_name = re.sub(r'[^A-Za-z0-9]', '', state_name).upper()
    if clean_name in MEXICO_STATES_ISO.values():
        return clean_name
        
    for key, iso in MEXICO_STATES_ISO.items():
        clean_key = re.sub(r'[^A-Za-z0-9]', '', key).upper()
        if clean_key == clean_name or clean_key in clean_name or clean_name in clean_key:
            return iso
            
    return state_name[:2].upper()


def validate_postal_code(postal_code: str) -> bool:
    """Valida que un código postal mexicano contenga exactamente 5 dígitos."""
    return bool(postal_code and re.match(r'^\d{5}$', str(postal_code).strip()))


def lookup_postal_code(postal_code: str) -> dict:
    """
    Lookup rápido para código postal de 5 dígitos.
    Retorna información base de estado y sugerencia de zona.
    """
    clean_cp = str(postal_code).strip()
    if not validate_postal_code(clean_cp):
        return {"valid": False, "error": "El código postal debe tener exactamente 5 dígitos numéricos."}
        
    prefix = clean_cp[0]
    state_name, state_iso = POSTAL_CODE_PREFIX_TO_STATE.get(prefix, ("Sonora", "SO"))
    
    return {
        "valid": True,
        "postal_code": clean_cp,
        "state_name": state_name,
        "state_iso": state_iso,
        "country": "MX"
    }


def get_skydropx_api_key() -> str:
    """Obtiene la clave de Skydropx priorizando la cuenta propia del artista."""
    custom_key = os.environ.get("AMBAR_OWN_SKYDROPX_KEY", "")
    nectar_key = os.environ.get("NECTAR_LABS_SKYDROPX_KEY", "")
    return custom_key if custom_key else nectar_key


def get_fallback_rates() -> list:
    """Retorna tarifas planas de respaldo cuando la API externa no responde."""
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


def quote_shipping_rates(origin_zip: str, dest_zip: str, weight_kg: float = 1.0) -> list:
    """
    Cotiza tarifas de envío con Skydropx con resiliencia activa:
    - Timeout estricto de 4.0s
    - Caché por pares de CP (TTL 1 hora)
    - Fallback garantizado a tarifa plana ($150 MXN) si Skydropx está caído o sin credenciales
    """
    if not validate_postal_code(origin_zip) or not validate_postal_code(dest_zip):
        logger.warning(f"[Logística/Quote] CP inválido: origen={origin_zip}, destino={dest_zip}")
        return get_fallback_rates()

    cache_key = f"shipping_quote_{origin_zip}_{dest_zip}_{int(weight_kg)}"
    cached_rates = cache.get(cache_key)
    if cached_rates:
        logger.info(f"[Logística/Cache] Cotización recuperada de caché para {origin_zip} -> {dest_zip}")
        return cached_rates

    api_key = get_skydropx_api_key()
    if not api_key or api_key == "mock_key" or getattr(settings, "TESTING", False):
        logger.info(f"[Logística/Mock] Retornando tarifas de contingencia por modo local/mock.")
        fallback = get_fallback_rates()
        cache.set(cache_key, fallback, timeout=3600)
        return fallback

    headers = {
        "Authorization": f"Token token={api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "address_from": {
            "country": "MX",
            "zip": str(origin_zip)
        },
        "address_to": {
            "country": "MX",
            "zip": str(dest_zip)
        },
        "parcels": [
            {
                "weight": float(weight_kg),
                "height": 15,
                "width": 25,
                "length": 35
            }
        ]
    }

    try:
        response = requests.post(
            "https://api.skydropx.com/v1/quotations",
            json=payload,
            headers=headers,
            timeout=4.0
        )

        if response.status_code in (200, 201):
            data = response.json()
            rates = []
            raw_rates = data.get("data", []) or data.get("rates", [])
            for r in raw_rates:
                attr = r.get("attributes", r)
                rates.append({
                    "id": str(r.get("id", attr.get("id", ""))),
                    "provider": attr.get("provider", "Paquetería Nacional"),
                    "service_level_name": attr.get("service_level_name", "Servicio Regular"),
                    "total_price": float(attr.get("total_price", attr.get("amount", 150.0))),
                    "currency": "MXN",
                    "days": f"{attr.get('days', '3-5')} días hábiles",
                    "is_fallback": False
                })
            
            if rates:
                # Ordenar por precio ascendente
                rates.sort(key=lambda x: x["total_price"])
                cache.set(cache_key, rates, timeout=3600)
                return rates

        logger.warning(f"[Logística/Skydropx] Respuesta no exitosa ({response.status_code}): {response.text}")
    except requests.exceptions.Timeout:
        logger.warning(f"[Logística/Timeout] Skydropx tardó más de 4s en responder para CP {dest_zip}. Activando tarifa plana de respaldo.")
    except Exception as e:
        logger.error(f"[Logística/Error] Fallo al consultar cotizador de Skydropx: {e}")

    # Retornar tarifa plana de respaldo
    fallback = get_fallback_rates()
    cache.set(cache_key, fallback, timeout=1800)
    return fallback


def generate_shipping_label(order):
    """
    Genera la guía de paquetería para la orden confirmada.
    Fallback simulado y robusto en caso de entorno de pruebas o fallo externo.
    """
    api_key = get_skydropx_api_key()

    origin_address = {
        "name": os.environ.get("SHIPPING_ORIGIN_NAME", "Almacén Ms Ambar"),
        "phone": os.environ.get("SHIPPING_ORIGIN_PHONE", "6621000000"),
        "street": os.environ.get("SHIPPING_ORIGIN_STREET", "Av. Serdán 123"),
        "suburb": os.environ.get("SHIPPING_ORIGIN_SUBURB", "Centro"),
        "city": os.environ.get("SHIPPING_ORIGIN_CITY", "Hermosillo"),
        "state": normalize_mexican_state(os.environ.get("SHIPPING_ORIGIN_STATE", "Sonora")),
        "zip_code": os.environ.get("SHIPPING_ORIGIN_POSTAL_CODE", "83000"),
        "country": "MX"
    }

    destination_address = {
        "name": order.full_name,
        "phone": order.phone or "6620000000",
        "street": order.street_and_number,
        "suburb": order.suburb or "Centro",
        "city": order.city or "Ciudad",
        "state": normalize_mexican_state(order.state),
        "zip_code": order.postal_code or "83000",
        "country": "MX"
    }

    # Fallback Simulado por seguridad en Local o Pruebas
    if not api_key or api_key == "mock_key" or getattr(settings, "TESTING", False):
        logger.info(f"[Logística/Mock] Generación de guía simulada para Pedido #{order.id}.")
        order.tracking_number = f"TRACK-AMBAR-{order.id}MX"
        order.tracking_url = f"https://track.skydropx.com/?q=TRACK-AMBAR-{order.id}MX"
        order.shipping_label_pdf = f"https://labels.skydropx.com/sample_{order.id}.pdf"
        order.shipping_provider = "FedEx Express (Simulado)"
        order.save()
        return True

    # Conexión Real con Skydropx API
    try:
        headers = {
            "Authorization": f"Token token={api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "address_inform": origin_address,
            "address_to": destination_address,
            "parcel": {
                "weight": 1,
                "height": 15,
                "width": 25,
                "length": 35
            }
        }

        response = requests.post("https://api.skydropx.com/v1/shipments", json=payload, headers=headers, timeout=5.0)
        if response.status_code != 201:
            raise Exception(f"Skydropx Shipment Error: {response.text}")
        
        shipment_data = response.json()
        best_rate = shipment_data['data']['attributes']['rates'][0]
        
        label_payload = {"generate_label": True, "rate_id": best_rate['id']}
        label_response = requests.post("https://api.skydropx.com/v1/labels", json=label_payload, headers=headers, timeout=5.0)
        
        if label_response.status_code == 201:
            label_data = label_response.json()
            order.tracking_number = label_data['data']['attributes']['tracking_number']
            order.tracking_url = label_data['data']['attributes']['tracking_url']
            order.shipping_label_pdf = label_data['data']['attributes']['label_url']
            order.shipping_provider = best_rate.get('provider', 'Paquetería')
            order.save()
            return True
        else:
            raise Exception(f"Skydropx Label Error: {label_response.text}")
            
    except Exception as e:
        logger.error(f"[Logística/Error] Error al emitir guía para Pedido #{order.id}: {e}")
        # Asignar datos de contingencia para no detener el despacho
        order.tracking_number = f"TRACK-PENDING-{order.id}"
        order.shipping_provider = "Paquetería Nacional (En Proceso de Despacho)"
        order.save()
        return False