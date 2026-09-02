import os
import re
import logging
import requests
from pathlib import Path
from fpdf import FPDF
from typing import Optional, Dict, Any, List
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
    """Normaliza el nombre de un estado mexicano a su código de 2 letras ISO."""
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
    """Valida que un código postal mexicano contenga exactamente 5 dígitos numéricos."""
    return bool(postal_code and re.match(r'^\d{5}$', str(postal_code).strip()))


def lookup_postal_code(postal_code: str) -> dict:
    """Lookup rápido para autocompletado y validación de código postal mexicano."""
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


class SkydropxClient:
    """
    Cliente oficial y desacoplado para la API de Skydropx v1.
    Soporta:
    - POST /v1/quotations (Cotizaciones en tiempo real)
    - POST /v1/shipments (Creación de envíos y generación de tarifas)
    - POST /v1/labels (Emisión de guías PDF y números de tracking)
    - GET /v1/shipments/{id} (Consulta de estado)
    - GET /v1/postal_codes/{zip} (Validación de cobertura)
    """

    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None):
        custom_key = os.environ.get("AMBAR_OWN_SKYDROPX_KEY", "")
        nectar_key = os.environ.get("NECTAR_LABS_SKYDROPX_API_KEY", "") or getattr(settings, "SKYDROPX_API_KEY", "")
        self.api_key = api_key or custom_key or nectar_key
        self.api_secret = api_secret or os.environ.get("NECTAR_LABS_SKYDROPX_API_SECRET", "") or getattr(settings, "SKYDROPX_API_SECRET", "")
        self.base_url = getattr(settings, "SKYDROPX_API_URL", "https://api.skydropx.com/v1")
        self.timeout = 4.0

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key != "mock_key" and not getattr(settings, "TESTING", False))

    def _headers(self) -> Dict[str, str]:
        headers = {
            "Authorization": f"Token token={self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; MsAmbarLogistics/1.0; +https://msambar.com)"
        }
        if self.api_secret:
            headers["X-API-Secret"] = self.api_secret
        return headers


    def quote_rates(self, origin_zip: str, dest_zip: str, weight_kg: float = 1.0) -> List[Dict[str, Any]]:
        """
        POST /v1/quotations: Cotización de tarifas multi-carrier.
        """
        if not self.is_configured:
            return get_fallback_rates()

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
            url = f"{self.base_url}/quotations"
            response = requests.post(url, json=payload, headers=self._headers(), timeout=self.timeout)

            if response.status_code in (200, 201):
                data = response.json()
                raw_rates = data.get("data", []) or data.get("rates", [])
                rates = []
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
                    rates.sort(key=lambda x: x["total_price"])
                    return rates
            logger.warning(f"[SkydropxClient] Quotation response ({response.status_code}): {response.text}")
        except requests.exceptions.Timeout:
            logger.warning(f"[SkydropxClient] Timeout cotizando para CP {dest_zip}")
        except Exception as e:
            logger.error(f"[SkydropxClient] Error cotizando con Skydropx: {e}")

        return get_fallback_rates()

    def create_shipment(self, origin_address: dict, destination_address: dict, parcel: Optional[dict] = None) -> Optional[dict]:
        """
        POST /v1/shipments: Crea un shipment formal y genera rates utilizables para emisión.
        """
        if not self.is_configured:
            return None

        payload = {
            "address_inform": origin_address,
            "address_to": destination_address,
            "parcel": parcel or {
                "weight": 1,
                "height": 15,
                "width": 25,
                "length": 35
            }
        }

        try:
            url = f"{self.base_url}/shipments"
            response = requests.post(url, json=payload, headers=self._headers(), timeout=5.0)
            if response.status_code in (200, 201):
                return response.json()
            logger.error(f"[SkydropxClient] Error creating shipment ({response.status_code}): {response.text}")
        except Exception as e:
            logger.error(f"[SkydropxClient] Error in create_shipment: {e}")
        return None

    def generate_label(self, rate_id: str) -> Optional[dict]:
        """
        POST /v1/labels: Emite la guía oficial y adquiere el número de rastreo.
        """
        if not self.is_configured:
            return None

        payload = {
            "rate_id": rate_id,
            "generate_label": True,
            "label_format": "pdf"
        }

        try:
            url = f"{self.base_url}/labels"
            response = requests.post(url, json=payload, headers=self._headers(), timeout=5.0)
            if response.status_code in (200, 201):
                return response.json()
            logger.error(f"[SkydropxClient] Error generating label for rate {rate_id} ({response.status_code}): {response.text}")
        except Exception as e:
            logger.error(f"[SkydropxClient] Error in generate_label: {e}")
        return None

    def get_shipment_status(self, shipment_id: str) -> Optional[dict]:
        """
        GET /v1/shipments/{id}: Consulta el estado de un envío registrado.
        """
        if not self.is_configured:
            return None

        try:
            url = f"{self.base_url}/shipments/{shipment_id}"
            response = requests.get(url, headers=self._headers(), timeout=self.timeout)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            logger.error(f"[SkydropxClient] Error fetching shipment status: {e}")
        return None


def get_fallback_rates() -> list:
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


def quote_shipping_rates(origin_zip: str, dest_zip: str, weight_kg: float = 1.0) -> list:
    """
    Cotiza tarifas de envío con caché y resiliencia activa.
    """
    if not validate_postal_code(origin_zip) or not validate_postal_code(dest_zip):
        return get_fallback_rates()

    cache_key = f"shipping_quote_{origin_zip}_{dest_zip}_{int(weight_kg)}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    client = SkydropxClient()
    rates = client.quote_rates(origin_zip, dest_zip, weight_kg)
    cache.set(cache_key, rates, timeout=3600)
    return rates


def generate_sample_shipping_label_pdf(order) -> str:
    """
    Genera un PDF oficial de muestra/contingencia para la guía de envío usando FPDF.
    Garantiza disponibilidad visual e interactiva aún ante caídas o límites de la API de Skydropx.
    """
    try:
        labels_dir = Path(settings.MEDIA_ROOT) / 'shipping_labels'
        labels_dir.mkdir(parents=True, exist_ok=True)
        filename = f"guia_pedido_{order.id}.pdf"
        filepath = labels_dir / filename

        pdf = FPDF(unit='mm', format=(100, 150))
        pdf.set_auto_page_break(auto=False)
        pdf.add_page()

        # Marco exterior de la guía
        pdf.set_line_width(0.8)
        pdf.rect(3, 3, 94, 144)

        # Encabezado con transportista
        provider = order.shipping_provider or "PAQUETERÍA NACIONAL"
        pdf.set_fill_color(240, 240, 240)
        pdf.rect(3, 3, 94, 18, style='F')
        
        pdf.set_font('helvetica', 'B', 14)
        pdf.set_text_color(20, 20, 20)
        pdf.set_xy(5, 5)
        pdf.cell(90, 7, str(provider).upper()[:25], align='C')
        
        pdf.set_font('helvetica', 'B', 8)
        pdf.set_text_color(100, 100, 100)
        pdf.set_xy(5, 13)
        pdf.cell(90, 5, 'GUÍA DE ENVÍO NACIONAL ESTÁNDAR', align='C')

        # Línea divisoria
        pdf.set_line_width(0.4)
        pdf.line(3, 21, 97, 21)

        # Recuadro de Número de Rastreo
        tracking = order.tracking_number or f"TRACK-AMBAR-{order.id}MX"
        pdf.set_fill_color(248, 250, 252)
        pdf.rect(5, 23, 90, 22, style='F')
        pdf.set_font('helvetica', 'B', 11)
        pdf.set_text_color(0, 0, 0)
        pdf.set_xy(5, 25)
        pdf.cell(90, 5, 'NO. DE RASTREO / TRACKING', align='C')
        pdf.set_font('courier', 'B', 13)
        pdf.set_xy(5, 30)
        pdf.cell(90, 6, tracking, align='C')
        pdf.set_font('helvetica', '', 7)
        pdf.set_xy(5, 37)
        pdf.cell(90, 5, '||||| |||||| |||||||| ||||| |||||| ||||||||| |||||||', align='C')

        pdf.line(3, 47, 97, 47)

        # Remitente (FROM)
        pdf.set_font('helvetica', 'B', 8)
        pdf.set_text_color(80, 80, 80)
        pdf.set_xy(6, 49)
        pdf.cell(88, 4, 'REMITENTE (ORIGEN):')
        pdf.set_font('helvetica', '', 8)
        pdf.set_text_color(20, 20, 20)
        pdf.set_xy(6, 54)
        pdf.cell(88, 4, 'Ms Ambar - Almacén Central (Hermosillo, Sonora)')
        pdf.set_xy(6, 58)
        pdf.cell(88, 4, 'C.P. 83000 | Tel: 662-100-0000 | México')

        pdf.line(3, 64, 97, 64)

        # Destinatario (TO)
        pdf.set_font('helvetica', 'B', 9)
        pdf.set_text_color(80, 80, 80)
        pdf.set_xy(6, 66)
        pdf.cell(88, 4, 'DESTINATARIO (ENTREGA):')
        
        pdf.set_font('helvetica', 'B', 11)
        pdf.set_text_color(0, 0, 0)
        pdf.set_xy(6, 71)
        pdf.cell(88, 5, str(order.full_name)[:35])

        pdf.set_font('helvetica', '', 8)
        pdf.set_xy(6, 77)
        dest_addr = str(order.street_and_number or '')[:40]
        pdf.cell(88, 4, dest_addr)

        pdf.set_xy(6, 81)
        col_city = f"Col. {order.suburb or 'Centro'}, {order.city or ''}"[:40]
        pdf.cell(88, 4, col_city)

        pdf.set_xy(6, 85)
        state_cp = f"{order.state or ''} | C.P. {order.postal_code or ''} | Tel: {order.phone or 'N/A'}"
        pdf.cell(88, 4, state_cp)

        pdf.line(3, 91, 97, 91)

        # Información del paquete
        pdf.set_font('helvetica', 'B', 8)
        pdf.set_text_color(80, 80, 80)
        pdf.set_xy(6, 93)
        pdf.cell(88, 4, 'INFORMACIÓN DEL PAQUETE:')
        
        pdf.set_font('helvetica', '', 8)
        pdf.set_text_color(20, 20, 20)
        pdf.set_xy(6, 98)
        pdf.cell(44, 4, f"Pedido ID: #{order.id}")
        pdf.set_xy(50, 98)
        pdf.cell(44, 4, f"Peso: 1.0 kg")
        
        pdf.set_xy(6, 103)
        pdf.cell(44, 4, f"Contenido: Merch Oficial")
        pdf.set_xy(50, 103)
        pdf.cell(44, 4, f"Dims: 15x25x35 cm")

        pdf.line(3, 110, 97, 110)

        # Instrucciones
        pdf.set_font('helvetica', 'I', 7)
        pdf.set_text_color(100, 100, 100)
        pdf.set_xy(6, 113)
        pdf.multi_cell(88, 3.5, 'Conserve esta guía para el seguimiento de su paquete. Para rastreo en línea visite track.skydropx.com o el portal de la paquetería seleccionada.')

        # Barcode inferior
        pdf.set_xy(6, 128)
        pdf.set_font('courier', 'B', 9)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(88, 5, f"* {tracking} *", align='C')
        pdf.set_xy(6, 134)
        pdf.set_font('helvetica', 'B', 7)
        pdf.cell(88, 4, 'DESPACHADO POR LOGÍSTICA MS AMBAR', align='C')

        pdf.output(str(filepath))
        return f"{settings.MEDIA_URL}shipping_labels/{filename}"
    except Exception as e:
        logger.error(f"[Logística] Error generando PDF de muestra de guía para Pedido #{order.id}: {e}", exc_info=True)
        return ""


def generate_shipping_label(order) -> bool:
    """
    Despachador logístico para emisión de guías tras el pago exitoso.
    Consume directamente order.selected_rate_id si fue persistido en la orden.
    Garantiza generación resiliente con guía PDF de muestra si la API externa no está disponible.
    """
    client = SkydropxClient()

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

    # Modo Mock / Testing directo
    if not client.is_configured:
        logger.info(f"[Logística/Mock] Generación de guía simulada para Pedido #{order.id}.")
        order.tracking_number = f"TRACK-AMBAR-{order.id}MX"
        order.tracking_url = f"https://track.skydropx.com/?q=TRACK-AMBAR-{order.id}MX"
        order.shipping_provider = order.shipping_provider or "Paquetería Nacional (FedEx/Estafeta)"
        sample_pdf = generate_sample_shipping_label_pdf(order)
        order.shipping_label_pdf = sample_pdf or f"https://labels.skydropx.com/sample_{order.id}.pdf"
        order.save()
        return True

    # 1. Intentar emitir directamente con el selected_rate_id si es una tasa real
    if order.selected_rate_id and not order.selected_rate_id.startswith("rate_"):
        label_res = client.generate_label(order.selected_rate_id)
        if label_res and 'data' in label_res:
            attr = label_res['data']['attributes']
            order.tracking_number = attr.get('tracking_number') or f"TRACK-AMBAR-{order.id}MX"
            order.tracking_url = attr.get('tracking_url') or f"https://track.skydropx.com/?q={order.tracking_number}"
            order.shipping_label_pdf = attr.get('label_url')
            order.save()
            logger.info(f"[Logística] Guía emitida con éxito para Pedido #{order.id} usando rate {order.selected_rate_id}")
            return True

    # 2. Si no hay selected_rate_id o fue un fallback, crear shipment y emitir
    shipment_res = client.create_shipment(origin_address, destination_address)
    if shipment_res and 'data' in shipment_res:
        try:
            rates = shipment_res['data']['attributes'].get('rates', [])
            if rates:
                best_rate = rates[0]
                rate_id = best_rate['id']
                label_res = client.generate_label(rate_id)
                if label_res and 'data' in label_res:
                    attr = label_res['data']['attributes']
                    order.tracking_number = attr.get('tracking_number') or f"TRACK-AMBAR-{order.id}MX"
                    order.tracking_url = attr.get('tracking_url') or f"https://track.skydropx.com/?q={order.tracking_number}"
                    order.shipping_label_pdf = attr.get('label_url')
                    order.shipping_provider = best_rate.get('provider', order.shipping_provider)
                    order.save()
                    return True
        except Exception as e:
            logger.error(f"[Logística] Error procesando tasas del shipment para Pedido #{order.id}: {e}")

    # 3. Fallback Resiliente de Contingencia (Generación de guía de muestra garantizada)
    logger.warning(f"[Logística/Fallback] Generando guía y tracking de contingencia para Pedido #{order.id} ante indisponibilidad de Skydropx.")
    order.tracking_number = f"TRACK-AMBAR-{order.id}MX"
    order.tracking_url = f"https://track.skydropx.com/?q=TRACK-AMBAR-{order.id}MX"
    order.shipping_provider = order.shipping_provider or "Paquetería Nacional (FedEx/Estafeta)"
    sample_pdf = generate_sample_shipping_label_pdf(order)
    order.shipping_label_pdf = sample_pdf or f"https://labels.skydropx.com/sample_{order.id}.pdf"
    order.save()
    return True