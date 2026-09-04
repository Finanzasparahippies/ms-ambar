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
        "country_code": "MX",
        "tax_id_number": "XAXX010101000"
    }
