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
    """
    Retorna la dirección de origen del remitente desde DB (ShopShippingConfig)
    con sanitización estricta de email (RFC 5322 a dirección limpia) y fallback a settings / entorno.
    """
    from email.utils import parseaddr

    default_name = getattr(settings, "SHIPPING_ORIGIN_NAME", os.environ.get("SHIPPING_ORIGIN_NAME", "Almacén Oficial Ms Ambar"))
    default_company = "Ms Ambar"
    default_phone = re.sub(r'\D', '', str(getattr(settings, "SHIPPING_ORIGIN_PHONE", os.environ.get("SHIPPING_ORIGIN_PHONE", "6622140000"))))[:10]
    default_street = getattr(settings, "SHIPPING_ORIGIN_STREET", os.environ.get("SHIPPING_ORIGIN_STREET", "Blvd. Kino 456"))
    default_suburb = getattr(settings, "SHIPPING_ORIGIN_SUBURB", os.environ.get("SHIPPING_ORIGIN_SUBURB", "Pitic"))
    default_city = getattr(settings, "SHIPPING_ORIGIN_CITY", os.environ.get("SHIPPING_ORIGIN_CITY", "Hermosillo"))
    default_state = getattr(settings, "SHIPPING_ORIGIN_STATE", os.environ.get("SHIPPING_ORIGIN_STATE", "SO"))
    default_zip = str(getattr(settings, "SHIPPING_ORIGIN_POSTAL_CODE", os.environ.get("SHIPPING_ORIGIN_POSTAL_CODE", "83150"))).strip()

    raw_default_email = getattr(settings, "SHIPPING_ORIGIN_EMAIL", os.environ.get("SHIPPING_ORIGIN_EMAIL", getattr(settings, "DEFAULT_FROM_EMAIL", "contacto@msambar.com")))
    _, clean_default_email = parseaddr(raw_default_email)
    if not clean_default_email or "@" not in clean_default_email:
        clean_default_email = "contacto@msambar.com"

    try:
        from apps.shop.models import ShopShippingConfig
        config = ShopShippingConfig.get_solo()
        name = (config.origin_name or "").strip() or default_name
        company = (config.origin_company or "").strip() or default_company
        phone = re.sub(r'\D', '', str(config.origin_phone or default_phone))[:10]

        _, clean_config_email = parseaddr(config.origin_email or "")
        email = clean_config_email if (clean_config_email and "@" in clean_config_email) else clean_default_email

        street = (config.origin_street or "").strip() or default_street
        suburb = (config.origin_suburb or "").strip() or default_suburb
        city = (config.origin_city or "").strip() or default_city
        state = normalize_mexican_state(config.origin_state or default_state)
        zip_code = str(config.origin_postal_code or default_zip).strip()
    except Exception:
        name = default_name
        company = default_company
        phone = default_phone
        email = clean_default_email
        street = default_street
        suburb = default_suburb
        city = default_city
        state = normalize_mexican_state(default_state)
        zip_code = default_zip

    return {
        "name": name,
        "company": company,
        "phone": phone if len(phone) == 10 else "6622140000",
        "email": email,
        "street": street,
        "street1": street,
        "reference": "Almacén Principal Ms Ambar",
        "suburb": suburb,
        "city": city,
        "state": state,
        "zip_code": zip_code,
        "postal_code": zip_code,
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
        "created": ShippingStatus.CREATED.value,
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
    parcel_override: Optional[dict] = None,
    packaging_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Calcula dinámicamente el arreglo 'packages' para la emisión oficial en Skydropx.
    Deriva peso real a partir de los OrderItems si están disponibles en base de datos,
    o utiliza los overrides/defaults documentados respetando el tipo de empaque (Caja 4G vs Bolsa 5M).
    """
    p = parcel_override or {}
    
    cfg = None
    try:
        from apps.shop.models import ShopShippingConfig
        cfg = ShopShippingConfig.get_solo()
    except Exception:
        pass

    pkg_type = str(
        packaging_type or 
        (p.get("packaging_type") if p else None) or 
        getattr(order, 'packaging_type', None) or 
        (getattr(cfg, 'default_packaging_type', None) or 'box')
    ).lower().strip()

    if pkg_type == 'bag':
        default_sat_type = DEFAULT_PACKAGE_TYPE  # "4G" (Estándar SAT universal aceptado por Skydropx Pro API)
        default_length = getattr(cfg, 'bag_length', 30.0) if cfg else 30.0
        default_width = getattr(cfg, 'bag_width', 20.0) if cfg else 20.0
        default_height = getattr(cfg, 'bag_height', 5.0) if cfg else 5.0
        default_weight = getattr(cfg, 'bag_weight', 0.5) if cfg else 0.5
    else:
        default_sat_type = DEFAULT_PACKAGE_TYPE  # "4G" (Cajas de cartón SAT)
        default_length = getattr(cfg, 'box_length', DEFAULT_PACKAGE_LENGTH) if cfg else DEFAULT_PACKAGE_LENGTH
        default_width = getattr(cfg, 'box_width', DEFAULT_PACKAGE_WIDTH) if cfg else DEFAULT_PACKAGE_WIDTH
        default_height = getattr(cfg, 'box_height', DEFAULT_PACKAGE_HEIGHT) if cfg else DEFAULT_PACKAGE_HEIGHT
        default_weight = getattr(cfg, 'box_weight', DEFAULT_PACKAGE_WEIGHT) if cfg else DEFAULT_PACKAGE_WEIGHT

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
        float(p.get("weight") or (total_weight if total_weight > 0 else default_weight))
    )
    final_length = float(p.get("length") or default_length)
    final_width = float(p.get("width") or default_width)
    final_height = float(p.get("height") or default_height)
    final_declared = max(10.0, float(p.get("declared_value") or declared_value))

    consignment_note = str(p.get("consignment_note") or DEFAULT_CONSIGNMENT_NOTE).strip()
    raw_package_type = str(p.get("package_type") or default_sat_type).strip()

    # Skydropx Pro API valida estrictamente package_type contra su catálogo interno ('4G' es el estándar universal de paquetería SAT).
    # Valores como '5M' son rechazados por Skydropx con error 422 ("El valor 5M no está incluido en la lista").
    if raw_package_type in ("5M", "5H", "bag", "box", "") or not raw_package_type:
        package_type = "4G"
    else:
        package_type = raw_package_type

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
        for f in ["name", "phone", "street1", "postal_code", "area_level1", "area_level2", "country_code", "email"]:
            if not addr_from.get(f):
                errors.append(f"address_from.{f} es requerido.")
        from_email = str(addr_from.get("email") or "").strip()
        if from_email and not re.match(r'^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$', from_email):
            errors.append(f"address_from.email '{from_email}' no es un correo electrónico válido (no debe contener corchetes ni nombres).")

    # Validar address_to
    addr_to = shipment.get("address_to")
    if not isinstance(addr_to, dict) or not addr_to:
        errors.append("La clave 'address_to' no puede estar en blanco y debe ser un objeto.")
    else:
        for f in ["name", "phone", "street1", "postal_code", "area_level1", "area_level2", "country_code", "email"]:
            if not addr_to.get(f):
                errors.append(f"address_to.{f} es requerido.")
        to_email = str(addr_to.get("email") or "").strip()
        if to_email and not re.match(r'^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$', to_email):
            errors.append(f"address_to.email '{to_email}' no es un correo electrónico válido.")

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


def parse_skydropx_shipment_response(response_data: Any) -> Dict[str, Any]:
    """
    Parsea de forma resiliente la respuesta de Skydropx Pro tanto en formato JSON:API
    como en formato plano o anidado.
    
    Estructura JSON:API canónica de Skydropx Pro:
      data: {
        id: "...",
        type: "shipments",
        attributes: {
          id: "...",
          workflow_status: "completed" / "processing",
          master_tracking_number: "...",
          carrier_name: "fedex",
          payment_status: "paid",
          ...
        },
        relationships: {
          packages: { data: [{ id: "...", type: "packages" }] }
        }
      },
      included: [
        {
          id: "...",
          type: "packages",
          attributes: {
            tracking_number: "...",
            label_url: "https://...",
            tracking_url_provider: "https://..."
          }
        }
      ]
    """
    if not isinstance(response_data, dict):
        return {
            "shipment_id": "",
            "workflow_status": "",
            "internal_status": ShippingStatus.PENDING.value,
            "tracking_number": "",
            "tracking_url": "",
            "label_url": "",
            "carrier_name": "",
            "is_completed": False
        }

    data = response_data.get("data")
    if isinstance(data, dict):
        attrs = data.get("attributes") or data
        top_id = data.get("id") or attrs.get("id") or response_data.get("id")
    else:
        attrs = response_data.get("attributes") or response_data
        top_id = response_data.get("id")

    shipment_id = str(top_id or "").strip()

    # 1. Estado / Workflow Status
    raw_status = (
        attrs.get("workflow_status") or 
        attrs.get("status") or 
        response_data.get("workflow_status") or 
        response_data.get("status") or 
        ""
    )
    raw_status = str(raw_status).lower().strip()
    internal_status, _ = map_skydropx_status(raw_status)

    # 2. Tracking Number
    tracking_number = (
        attrs.get("master_tracking_number") or 
        attrs.get("tracking_number") or 
        attrs.get("tracking") or 
        response_data.get("master_tracking_number") or 
        response_data.get("tracking_number") or 
        ""
    )
    tracking_number = str(tracking_number).strip()

    # 3. Label URL
    label_url = (
        attrs.get("label_url") or 
        attrs.get("label") or 
        attrs.get("url") or 
        response_data.get("label_url") or 
        ""
    )
    label_url = str(label_url).strip()

    # 4. Carrier Name & Tracking URL Provider
    carrier_name = (
        attrs.get("carrier_name") or 
        attrs.get("carrier") or 
        response_data.get("carrier_name") or 
        ""
    )
    carrier_name = str(carrier_name).strip()

    tracking_url = (
        attrs.get("tracking_url_provider") or 
        attrs.get("tracking_url") or 
        response_data.get("tracking_url") or 
        ""
    )
    tracking_url = str(tracking_url).strip()

    # 5. Extraer desde 'included' (JSON:API paquetes)
    included = response_data.get("included") or (data.get("included") if isinstance(data, dict) else None) or []
    if isinstance(included, list):
        for item in included:
            if not isinstance(item, dict):
                continue
            item_type = str(item.get("type") or "").lower()
            item_attrs = item.get("attributes") or {}
            if item_type in ["packages", "package"]:
                if not label_url:
                    candidate_label = item_attrs.get("label_url") or item_attrs.get("url") or item_attrs.get("label")
                    if candidate_label:
                        label_url = str(candidate_label).strip()
                if not tracking_number:
                    candidate_tracking = item_attrs.get("tracking_number") or item_attrs.get("master_tracking_number")
                    if candidate_tracking:
                        tracking_number = str(candidate_tracking).strip()
                if not tracking_url and item_attrs.get("tracking_url_provider"):
                    tracking_url = str(item_attrs.get("tracking_url_provider")).strip()

    # Si hay tracking number pero no tracking_url, construir url estándar de Skydropx
    if tracking_number and not tracking_url:
        tracking_url = f"https://track.skydropx.com/?q={tracking_number}"

    # Si el estado es 'completed' o ya tenemos tanto guía como tracking
    is_completed = (
        raw_status in ["completed", "delivered", "in_transit", "shipped"] or
        internal_status in [ShippingStatus.COMPLETED.value] or
        bool(tracking_number and label_url)
    )

    if is_completed and internal_status == ShippingStatus.PROCESSING.value:
        internal_status = ShippingStatus.COMPLETED.value

    return {
        "shipment_id": shipment_id,
        "workflow_status": raw_status,
        "internal_status": internal_status,
        "status": internal_status,
        "tracking_number": tracking_number,
        "tracking_url": tracking_url,
        "label_url": label_url,
        "carrier_name": carrier_name,
        "is_completed": is_completed
    }


