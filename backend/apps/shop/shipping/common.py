import re
import os
from typing import Dict
from django.conf import settings

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
    """Normaliza el nombre de un estado mexicano a su código de 2 letras ISO 3166-2:MX."""
    if not state_name:
        return "SO"
    clean_name = re.sub(r'[^A-Za-z0-9]', '', str(state_name)).upper()
    if clean_name in MEXICO_STATES_ISO.values():
        return clean_name
    for key, iso in MEXICO_STATES_ISO.items():
        clean_key = re.sub(r'[^A-Za-z0-9]', '', key).upper()
        if clean_key == clean_name or clean_key in clean_name or clean_name in clean_key:
            return iso
    return str(state_name)[:2].upper() if state_name else "SO"


def validate_postal_code(postal_code: str) -> bool:
    """Valida que un código postal mexicano contenga exactamente 5 dígitos numéricos."""
    return bool(postal_code and re.match(r'^\d{5}$', str(postal_code).strip()))


def lookup_postal_code(postal_code: str) -> dict:
    """Lookup para autocompletado y validación de código postal mexicano."""
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


def get_origin_address() -> Dict[str, str]:
    """Retorna la dirección de origen del remitente desde settings o entorno."""
    return {
        "name": getattr(settings, "SHIPPING_ORIGIN_NAME", os.environ.get("SHIPPING_ORIGIN_NAME", "Almacén Oficial Ms Ambar")),
        "company": "Ms Ambar",
        "phone": str(getattr(settings, "SHIPPING_ORIGIN_PHONE", os.environ.get("SHIPPING_ORIGIN_PHONE", "6622140000")))[:10],
        "email": getattr(settings, "DEFAULT_FROM_EMAIL", "contacto@msambar.com"),
        "street": getattr(settings, "SHIPPING_ORIGIN_STREET", os.environ.get("SHIPPING_ORIGIN_STREET", "Blvd. Kino 456")),
        "street1": getattr(settings, "SHIPPING_ORIGIN_STREET", os.environ.get("SHIPPING_ORIGIN_STREET", "Blvd. Kino 456")),
        "reference": "Almacén Principal Ms Ambar",
        "suburb": getattr(settings, "SHIPPING_ORIGIN_SUBURB", os.environ.get("SHIPPING_ORIGIN_SUBURB", "Pitic")),
        "city": getattr(settings, "SHIPPING_ORIGIN_CITY", os.environ.get("SHIPPING_ORIGIN_CITY", "Hermosillo")),
        "state": normalize_mexican_state(getattr(settings, "SHIPPING_ORIGIN_STATE", os.environ.get("SHIPPING_ORIGIN_STATE", "SO"))),
        "zip_code": str(getattr(settings, "SHIPPING_ORIGIN_POSTAL_CODE", os.environ.get("SHIPPING_ORIGIN_POSTAL_CODE", "83150"))).strip(),
        "postal_code": str(getattr(settings, "SHIPPING_ORIGIN_POSTAL_CODE", os.environ.get("SHIPPING_ORIGIN_POSTAL_CODE", "83150"))).strip(),
        "country": "MX",
    }


from enum import Enum
from typing import Tuple, List, Optional, Any

class ShippingStatus(str, Enum):
    """Máquina de estados granular para ciclo de vida de envíos."""
    PENDING = "pending"
    CREATING = "creating"
    REQUESTED = "requested"
    PROCESSING = "processing"
    CREATED = "created"
    LABEL_PENDING = "label_pending"
    COMPLETED = "completed"
    FAILED = "failed"
    RECONCILIATION_REQUIRED = "reconciliation_required"
    UNKNOWN = "unknown"
    CANCELLED = "cancelled"

    @classmethod
    def is_terminal(cls, status: str) -> bool:
        return status in [cls.COMPLETED.value, cls.FAILED.value, cls.CANCELLED.value]

    @classmethod
    def is_active(cls, status: str) -> bool:
        return status in [cls.CREATING.value, cls.REQUESTED.value, cls.PROCESSING.value, cls.CREATED.value, cls.LABEL_PENDING.value]


def map_skydropx_status(external_status: str) -> Tuple[str, bool]:
    """
    Mapea el código/estado reportado por Skydropx Pro al ShippingStatus interno.
    Retorna (internal_status, is_recognized: bool).
    """
    status_lower = str(external_status or "").lower().strip()
    if not status_lower:
        return ShippingStatus.PROCESSING.value, True

    mapping = {
        "completed": ShippingStatus.COMPLETED.value,
        "delivered": ShippingStatus.COMPLETED.value,
        "in_transit": ShippingStatus.COMPLETED.value,
        "success": ShippingStatus.COMPLETED.value,
        "shipped": ShippingStatus.COMPLETED.value,
        "pending": ShippingStatus.PROCESSING.value,
        "processing": ShippingStatus.PROCESSING.value,
        "creating": ShippingStatus.CREATING.value,
        "label_pending": ShippingStatus.LABEL_PENDING.value,
        "failed": ShippingStatus.FAILED.value,
        "error": ShippingStatus.FAILED.value,
        "cancelled": ShippingStatus.CANCELLED.value,
        "canceled": ShippingStatus.CANCELLED.value,
    }

    if status_lower in mapping:
        return mapping[status_lower], True

    return ShippingStatus.UNKNOWN.value, False


# Parámetros y Defaults SAT / Paquetería
DEFAULT_CONSIGNMENT_NOTE = getattr(settings, "DEFAULT_CONSIGNMENT_NOTE", "53102400")  # Prendas de vestir / Mercancía
DEFAULT_PACKAGE_TYPE = getattr(settings, "DEFAULT_PACKAGE_TYPE", "4G")  # Caja de cartón SAT
DEFAULT_PACKAGE_LENGTH = float(getattr(settings, "DEFAULT_PACKAGE_LENGTH", 35.0))
DEFAULT_PACKAGE_WIDTH = float(getattr(settings, "DEFAULT_PACKAGE_WIDTH", 25.0))
DEFAULT_PACKAGE_HEIGHT = float(getattr(settings, "DEFAULT_PACKAGE_HEIGHT", 15.0))
DEFAULT_PACKAGE_WEIGHT = float(getattr(settings, "DEFAULT_PACKAGE_WEIGHT", 1.0))


def calculate_order_package(
    order: Any = None, 
    parcel_override: Optional[dict] = None
) -> List[Dict[str, Any]]:
    """
    Calcula dinámicamente el arreglo 'packages' para la emisión oficial en Skydropx.
    Deriva peso real a partir de los OrderItems si están disponibles en base de datos,
    o utiliza los overrides/defaults documentados.
    """
    p = parcel_override or {}
    
    total_weight = 0.0
    declared_value = 100.0

    if order is not None:
        try:
            declared_value = float(getattr(order, 'total_amount', 100.0) or 100.0)
            if hasattr(order, 'items'):
                for item in order.items.select_related('product').all():
                    qty = item.quantity or 1
                    prod = getattr(item, 'product', None)
                    if prod and getattr(prod, 'weight', None):
                        raw_w = str(prod.weight).lower().strip()
                        # Extraer dígitos numéricos (soporta '250g', '1.5kg', '0.5')
                        num_match = re.search(r'([0-9]+(?:\.[0-9]+)?)', raw_w)
                        if num_match:
                            val = float(num_match.group(1))
                            if 'g' in raw_w and 'k' not in raw_w:
                                val = val / 1000.0
                            total_weight += (val * qty)
        except Exception:
            pass

    final_weight = max(
        0.1, 
        float(p.get("weight") or (total_weight if total_weight > 0 else DEFAULT_PACKAGE_WEIGHT))
    )
    final_length = float(p.get("length") or DEFAULT_PACKAGE_LENGTH)
    final_width = float(p.get("width") or DEFAULT_PACKAGE_WIDTH)
    final_height = float(p.get("height") or DEFAULT_PACKAGE_HEIGHT)
    final_declared = max(10.0, float(p.get("declared_value") or declared_value))

    consignment_note = str(p.get("consignment_note") or DEFAULT_CONSIGNMENT_NOTE).strip()
    package_type = str(p.get("package_type") or DEFAULT_PACKAGE_TYPE).strip()

    return [
        {
            "package_number": 1,
            "package_protected": bool(p.get("package_protected", False)),
            "declared_value": final_declared,
            "weight": final_weight,
            "length": final_length,
            "width": final_width,
            "height": final_height,
            "consignment_note": consignment_note,
            "package_type": package_type
        }
    ]


def validate_shipment_payload_contract(payload: dict) -> Tuple[bool, List[str]]:
    """
    Contract Test / Validador en tiempo de ejecución:
    Verifica que el payload cumpla con la especificación estricta de Skydropx Pro API
    antes de despachar la llamada HTTP para prevenir errores 422 en origen.
    """
    errors = []
    if not isinstance(payload, dict):
        return False, ["Payload debe ser un diccionario JSON."]

    if "shipment" not in payload:
        errors.append("El payload debe estar encapsulado bajo la clave raíz canónica 'shipment'.")
        return False, errors

    shipment = payload.get("shipment")
    if not isinstance(shipment, dict):
        errors.append("La clave 'shipment' debe ser un objeto JSON.")
        return False, errors

    # Debe contener rate_id o (carrier y service_name)
    has_rate = bool(shipment.get("rate_id"))
    has_direct = bool(shipment.get("carrier") and shipment.get("service_name"))
    if not has_rate and not has_direct:
        errors.append("Debe especificarse 'rate_id' o bien 'carrier' y 'service_name'.")

    # Validar address_from
    addr_from = shipment.get("address_from")
    if not isinstance(addr_from, dict) or not addr_from:
        errors.append("La clave 'address_from' no puede estar en blanco y debe ser un objeto.")
    else:
        for f in ["name", "phone", "street1", "postal_code", "area_level1", "area_level2", "country_code"]:
            if not addr_from.get(f):
                errors.append(f"address_from.{f} es requerido.")

    # Validar address_to
    addr_to = shipment.get("address_to")
    if not isinstance(addr_to, dict) or not addr_to:
        errors.append("La clave 'address_to' no puede estar en blanco y debe ser un objeto.")
    else:
        for f in ["name", "phone", "street1", "postal_code", "area_level1", "area_level2", "country_code"]:
            if not addr_to.get(f):
                errors.append(f"address_to.{f} es requerido.")

    # Validar packages
    packages = shipment.get("packages")
    if not isinstance(packages, list) or not packages:
        errors.append("La clave 'packages' no puede estar en blanco y debe contener al menos un paquete.")
    else:
        for idx, pkg in enumerate(packages):
            if not isinstance(pkg, dict):
                errors.append(f"packages[{idx}] debe ser un objeto.")
                continue
            if not pkg.get("consignment_note"):
                errors.append(f"El atributo consignment_note es requerido en todos los paquetes (paquete {idx+1}).")
            if not pkg.get("package_type"):
                errors.append(f"El atributo package_type es requerido en todos los paquetes (paquete {idx+1}).")
            for dim in ["weight", "length", "width", "height"]:
                val = pkg.get(dim)
                if val is None or float(val) <= 0:
                    errors.append(f"El atributo {dim} debe ser mayor a 0 en el paquete {idx+1}.")

    return len(errors) == 0, errors

