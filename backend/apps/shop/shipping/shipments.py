import hashlib
import json
import logging
import uuid
from typing import Optional, Dict, Any
from django.conf import settings
from .client import SkydropxClient
from .common import get_origin_address, normalize_mexican_state
from .polling import poll_shipment_resolution
from .labels import backup_remote_label_pdf, generate_sample_shipping_label_pdf
from .finance import get_credits, check_wallet_balance_alert

logger = logging.getLogger("apps")


def _record_shipping_event(
    order: Any,
    event_type: str,
    endpoint: str,
    payload: dict,
    status_code: int,
    response_body: Any,
    balance_before: Optional[float] = None,
    balance_after: Optional[float] = None,
    error_message: str = "",
    correlation_id: str = "",
    shipment_id: Optional[str] = None
):
    """Registra de forma inmutable un evento en la tabla de auditoría ShippingEvent."""
    try:
        from apps.shop.models import ShippingEvent
        payload_str = json.dumps(payload, sort_keys=True)
        request_hash = hashlib.sha256(payload_str.encode("utf-8")).hexdigest()

        resp_dict = response_body if isinstance(response_body, dict) else {"raw": str(response_body)}
        
        # Extraer shipment_id si no vino explícito
        extracted_shipment_id = shipment_id or getattr(order, 'skydropx_shipment_id', None)
        if not extracted_shipment_id and isinstance(resp_dict, dict):
            extracted_shipment_id = resp_dict.get('id') or resp_dict.get('data', {}).get('id')

        # Normalizar event_type si viene en minúsculas
        event_type_upper = str(event_type).upper()
        if "FROM_RATE" in event_type_upper:
            event_type_key = "SHIPMENT_ACCEPTED_202" if status_code == 202 else ("SHIPMENT_CREATED_SYNC" if status_code in (200, 201) else "SHIPMENT_FAILED")
        elif "CANCEL" in event_type_upper:
            event_type_key = "SHIPMENT_CANCELLED"
        elif "RATE_SHIPMENT" in event_type_upper:
            event_type_key = "SHIPMENT_ACCEPTED_202" if status_code == 202 else ("SHIPMENT_CREATED_SYNC" if status_code in (200, 201) else "SHIPMENT_FAILED")
        else:
            event_type_key = event_type_upper

        ShippingEvent.objects.create(
            order=order,
            shipment_id=str(extracted_shipment_id) if extracted_shipment_id else None,
            event_type=event_type_key,
            correlation_id=correlation_id or getattr(order, 'shipping_attempt_id', None),
            idempotency_key=getattr(order, 'shipping_attempt_id', None),
            http_status=status_code,
            request_payload_hash=request_hash,
            response_payload=resp_dict,
            balance_before=balance_before,
            balance_after=balance_after
        )
    except Exception as e:
        logger.warning(f"[Audit] No se pudo persistir ShippingEvent para Pedido {getattr(order, 'id', None)}: {e}")


def create_shipment_from_rate(
    client: SkydropxClient,
    rate_id: str,
    address_from: Optional[dict] = None,
    address_to: Optional[dict] = None,
    order: Any = None,
    printing_format: str = "standard"
) -> Optional[Dict[str, Any]]:
    """
    POST /api/v1/shipments/ (Opción A):
    Crea el envío a partir del rate_id y descuenta el saldo en la cartera de Skydropx.
    Cumple con el estándar del SAT ('4G', '53102400'), trailing slash y manejo de HTTP 202 Accepted.
    """
    if not client.is_configured or not rate_id:
        return None

    origin = address_from or get_origin_address()
    dest = address_to or {}

    # Consultar saldo previo para auditoría
    balance_before = None
    try:
        credits_before = client.get_credits()
        if credits_before.get("success"):
            balance_before = credits_before.get("credits", {}).get("balance")
    except Exception:
        pass

    from_payload = {
        "name": origin.get("name") or "Almacén Oficial Ms Ambar",
        "company": origin.get("company") or "Ms Ambar",
        "phone": str(origin.get("phone") or "6622140000")[:10],
        "email": origin.get("email") or getattr(settings, "DEFAULT_FROM_EMAIL", "contacto@msambar.com"),
        "street1": origin.get("street") or origin.get("street1") or "Blvd. Kino 456",
        "reference": origin.get("reference") or "Almacén Principal Ms Ambar",
        "country_code": "MX",
        "postal_code": str(origin.get("zip_code") or origin.get("postal_code") or "83150").strip(),
        "area_level1": normalize_mexican_state(origin.get("state") or "SO"),
        "area_level2": origin.get("city") or "Hermosillo",
        "area_level3": origin.get("suburb") or "Pitic",
        "tax_id_number": origin.get("tax_id_number") or "XAXX010101000"
    }

    dest_state = normalize_mexican_state(dest.get("state") or "SO")
    to_payload = {
        "name": dest.get("name") or dest.get("full_name") or "Cliente Ms Ambar",
        "company": dest.get("company") or "Particular",
        "phone": str(dest.get("phone") or "6620000000")[:10],
        "email": dest.get("email") or dest.get("user_email") or "cliente@msambar.com",
        "street1": dest.get("street") or dest.get("street1") or dest.get("street_and_number") or "Domicilio Conocido",
        "reference": dest.get("reference") or f"Col. {dest.get('suburb', 'Centro')}".strip() or "Entrega a domicilio",
        "country_code": "MX",
        "postal_code": str(dest.get("zip_code") or dest.get("postal_code") or "83000").strip(),
        "area_level1": dest_state,
        "area_level2": dest.get("city") or "Hermosillo",
        "area_level3": dest.get("suburb") or "Centro",
        "tax_id_number": dest.get("tax_id_number") or "XAXX010101000"
    }

    packages_payload = [
        {
            "package_number": 1,
            "package_protected": False,
            "declared_value": 100.0,
            "consignment_note": "53102400",
            "package_type": "4G"
        }
    ]

    payload = {
        "rate_id": rate_id,
        "printing_format": printing_format,
        "sync_label_creation": True,
        "unique_shipment": True,
        "address_from": from_payload,
        "address_to": to_payload,
        "packages": packages_payload
    }

    endpoint = "shipments/"
    response = None
    error_msg = ""
    status_code = 0

    try:
        response = client.request("POST", endpoint, json_data=payload)
        status_code = response.status_code
    except Exception as e:
        error_msg = str(e)
        logger.error(f"[Shipments] Excepción contactando POST /{endpoint}: {e}")

    # Consultar saldo posterior para auditoría
    balance_after = None
    try:
        credits_after = client.get_credits()
        if credits_after.get("success"):
            balance_after = credits_after.get("credits", {}).get("balance")
            check_wallet_balance_alert(balance_after)
    except Exception:
        pass

    resp_json = {}
    if response is not None:
        try:
            resp_json = response.json()
        except Exception:
            resp_json = {"text": response.text}

    _record_shipping_event(
        order=order,
        event_type="shipment_from_rate",
        endpoint=endpoint,
        payload=payload,
        status_code=status_code,
        response_body=resp_json,
        balance_before=balance_before,
        balance_after=balance_after,
        error_message=error_msg or (resp_json.get("error") if status_code >= 400 else ""),
        correlation_id=client.correlation_id
    )

    # Aceptar 200, 201 y 202 Accepted
    if status_code not in (200, 201, 202):
        logger.error(f"[Shipments] Error creating shipment from rate ({status_code}): {resp_json}")
        return {
            "success": False,
            "status_code": status_code,
            "error": resp_json.get("message") or resp_json.get("error") or f"HTTP {status_code}"
        }

    shipment_data = resp_json.get("data", {})
    attrs = shipment_data.get("attributes", shipment_data)
    shipment_id = str(shipment_data.get("id") or attrs.get("id") or resp_json.get("id") or "")
    tracking_number = attrs.get("master_tracking_number") or attrs.get("tracking_number") or resp_json.get("tracking_number") or ""
    carrier_name = attrs.get("carrier_name") or resp_json.get("carrier_name") or "Paquetería"
    label_url = attrs.get("label_url") or resp_json.get("label_url") or ""

    # Si fue HTTP 202 o no tenemos tracking/etiqueta sincrónica, consultar polling
    if status_code == 202 or not tracking_number or not label_url:
        logger.info(f"[Shipments] Envío {shipment_id} aceptado asíncronamente (HTTP {status_code}). Iniciando polling...")
        poll_res = poll_shipment_resolution(client, shipment_id)
        if poll_res.get("success"):
            tracking_number = poll_res.get("tracking_number") or tracking_number
            label_url = poll_res.get("label_url") or label_url
            carrier_name = poll_res.get("carrier_name") or carrier_name

    return {
        "success": True,
        "shipment_id": shipment_id,
        "tracking_number": tracking_number,
        "tracking_url": f"https://track.skydropx.com/?q={tracking_number}" if tracking_number else "",
        "carrier_name": carrier_name,
        "label_url": label_url,
        "status_code": status_code,
        "raw": resp_json
    }


def create_rate_shipment(
    client: SkydropxClient,
    origin_address: dict,
    destination_address: dict,
    parcel: Optional[dict] = None,
    carrier_name: Optional[str] = None,
    service_name: Optional[str] = None,
    order: Any = None,
    printing_format: str = "standard"
) -> Optional[Dict[str, Any]]:
    """
    POST /api/v1/rate/shipments/ (Opción B):
    Crea el envío directo con transportista/servicio predeterminado sin necesidad de cotización previa.
    """
    if not client.is_configured:
        return None

    origin = origin_address or get_origin_address()
    dest = destination_address or {}

    balance_before = None
    try:
        credits_before = client.get_credits()
        if credits_before.get("success"):
            balance_before = credits_before.get("credits", {}).get("balance")
    except Exception:
        pass

    from_payload = {
        "name": origin.get("name") or "Almacén Oficial Ms Ambar",
        "company": origin.get("company") or "Ms Ambar",
        "phone": str(origin.get("phone") or "6622140000")[:10],
        "email": origin.get("email") or getattr(settings, "DEFAULT_FROM_EMAIL", "contacto@msambar.com"),
        "street1": origin.get("street") or origin.get("street1") or "Blvd. Kino 456",
        "reference": origin.get("reference") or "Almacén Principal Ms Ambar",
        "country_code": "MX",
        "postal_code": str(origin.get("zip_code") or origin.get("postal_code") or "83150").strip(),
        "area_level1": normalize_mexican_state(origin.get("state") or "SO"),
        "area_level2": origin.get("city") or "Hermosillo",
        "area_level3": origin.get("suburb") or "Pitic",
        "tax_id_number": origin.get("tax_id_number") or "XAXX010101000"
    }

    dest_state = normalize_mexican_state(dest.get("state") or "SO")
    to_payload = {
        "name": dest.get("name") or dest.get("full_name") or "Cliente Ms Ambar",
        "company": dest.get("company") or "Particular",
        "phone": str(dest.get("phone") or "6620000000")[:10],
        "email": dest.get("email") or dest.get("user_email") or "cliente@msambar.com",
        "street1": dest.get("street") or dest.get("street1") or dest.get("street_and_number") or "Domicilio Conocido",
        "reference": dest.get("reference") or f"Col. {dest.get('suburb', 'Centro')}".strip() or "Entrega a domicilio",
        "country_code": "MX",
        "postal_code": str(dest.get("zip_code") or dest.get("postal_code") or "83000").strip(),
        "area_level1": dest_state,
        "area_level2": dest.get("city") or "Hermosillo",
        "area_level3": dest.get("suburb") or "Centro",
        "tax_id_number": dest.get("tax_id_number") or "XAXX010101000"
    }

    p = parcel or {}
    packages_payload = [
        {
            "package_number": 1,
            "package_protected": False,
            "declared_value": float(p.get("declared_value", 100.0)),
            "weight": float(p.get("weight", 1.0)),
            "length": float(p.get("length", 35.0)),
            "width": float(p.get("width", 25.0)),
            "height": float(p.get("height", 15.0)),
            "consignment_note": "53102400",
            "package_type": "4G"
        }
    ]

    carrier = carrier_name or "fedex"
    service = service_name or "standard"

    payload = {
        "carrier": carrier.lower(),
        "service_name": service,
        "printing_format": printing_format,
        "sync_label_creation": True,
        "unique_shipment": True,
        "address_from": from_payload,
        "address_to": to_payload,
        "packages": packages_payload
    }

    endpoint = "rate/shipments/"
    response = None
    error_msg = ""
    status_code = 0

    try:
        response = client.request("POST", endpoint, json_data=payload)
        status_code = response.status_code
    except Exception as e:
        error_msg = str(e)
        logger.error(f"[Shipments] Excepción en direct shipment POST /{endpoint}: {e}")

    balance_after = None
    try:
        credits_after = client.get_credits()
        if credits_after.get("success"):
            balance_after = credits_after.get("credits", {}).get("balance")
            check_wallet_balance_alert(balance_after)
    except Exception:
        pass

    resp_json = {}
    if response is not None:
        try:
            resp_json = response.json()
        except Exception:
            resp_json = {"text": response.text}

    _record_shipping_event(
        order=order,
        event_type="rate_shipment",
        endpoint=endpoint,
        payload=payload,
        status_code=status_code,
        response_body=resp_json,
        balance_before=balance_before,
        balance_after=balance_after,
        error_message=error_msg or (resp_json.get("error") if status_code >= 400 else ""),
        correlation_id=client.correlation_id
    )

    if status_code not in (200, 201, 202):
        logger.error(f"[Shipments] Error in direct rate shipment ({status_code}): {resp_json}")
        return {
            "success": False,
            "status_code": status_code,
            "error": resp_json.get("message") or resp_json.get("error") or f"HTTP {status_code}"
        }

    shipment_data = resp_json.get("data", {})
    attrs = shipment_data.get("attributes", shipment_data)
    shipment_id = str(shipment_data.get("id") or attrs.get("id") or resp_json.get("id") or "")
    tracking_number = attrs.get("master_tracking_number") or attrs.get("tracking_number") or resp_json.get("tracking_number") or ""
    carrier_res = attrs.get("carrier_name") or resp_json.get("carrier_name") or carrier
    label_url = attrs.get("label_url") or resp_json.get("label_url") or ""

    if status_code == 202 or not tracking_number or not label_url:
        poll_res = poll_shipment_resolution(client, shipment_id)
        if poll_res.get("success"):
            tracking_number = poll_res.get("tracking_number") or tracking_number
            label_url = poll_res.get("label_url") or label_url
            carrier_res = poll_res.get("carrier_name") or carrier_res

    return {
        "success": True,
        "shipment_id": shipment_id,
        "tracking_number": tracking_number,
        "tracking_url": f"https://track.skydropx.com/?q={tracking_number}" if tracking_number else "",
        "carrier_name": carrier_res,
        "label_url": label_url,
        "status_code": status_code,
        "raw": resp_json
    }


def cancel_shipment(client: SkydropxClient, shipment_id: str, reason: str = "Cancelado por el cliente", order: Any = None) -> Dict[str, Any]:
    """POST /api/v1/shipments/{id}/cancel/: Cancela un envío y solicita reembolso de guía."""
    endpoint = f"shipments/{shipment_id}/cancel/"
    payload = {"reason": reason}
    status_code = 0
    resp_json = {}
    try:
        res = client.request("POST", endpoint, json_data=payload)
        status_code = res.status_code
        try:
            resp_json = res.json()
        except Exception:
            resp_json = {"text": res.text}
    except Exception as e:
        resp_json = {"error": str(e)}

    _record_shipping_event(
        order=order,
        event_type="cancel_shipment",
        endpoint=endpoint,
        payload=payload,
        status_code=status_code,
        response_body=resp_json,
        correlation_id=client.correlation_id
    )
    return {"success": status_code in (200, 201, 204), "status_code": status_code, "data": resp_json}


def generate_shipping_label(order: Any) -> bool:
    """
    Despachador logístico principal para emisión de guías tras confirmación de pago.
    1. Valida idempotencia (no re-emite si ya cuenta con tracking real de Skydropx).
    2. Determina el método configurado (Option A: quotation con rate_id vs Option B: direct rate shipment).
    3. Conecta a Skydropx Pro con Correlation ID trazable.
    4. En caso de timeout o indisponibilidad externa, marca 'reconciliation_required' sin fallar silenciosamente
       ni regalar guías de contingencia que oculten el problema de cobro/cartera.
    """
    correlation_id = f"shipping:order-{order.id}:attempt-{uuid.uuid4().hex[:8]}"
    client = SkydropxClient(correlation_id=correlation_id)

    # 1. Idempotencia: Verificar si ya tiene guía válida emitida
    current_status = getattr(order, "shipping_status", "pending")
    tracking = getattr(order, "tracking_number", "")
    if current_status in ["created", "completed"] or (tracking and not tracking.startswith("TRACK-AMBAR")):
        logger.info(f"[Logística] Pedido #{order.id} ya cuenta con guía emitida ({tracking}). Operación idempotente.")
        return True

    # Asignar shipping_attempt_id y estado solicitado
    if not getattr(order, "shipping_attempt_id", None):
        order.shipping_attempt_id = f"att_{uuid.uuid4().hex[:12]}"
    order.shipping_status = "requested"
    order.save(update_fields=["shipping_attempt_id", "shipping_status"])

    origin_address = get_origin_address()
    destination_address = {
        "name": order.full_name,
        "phone": order.phone or "6620000000",
        "email": order.user_email or "cliente@msambar.com",
        "street": order.street_and_number,
        "street1": order.street_and_number,
        "street_and_number": order.street_and_number,
        "suburb": order.suburb or "Centro",
        "city": order.city or "Hermosillo",
        "state": normalize_mexican_state(order.state or "SO"),
        "zip_code": order.postal_code or "83000",
        "postal_code": order.postal_code or "83000",
        "country": "MX",
        "country_code": "MX"
    }

    # Modo Mock / Testing cuando las credenciales no están configuradas
    if not client.is_configured:
        logger.info(f"[Logística/Mock] Generación de guía simulada para Pedido #{order.id} (entorno de pruebas).")
        order.tracking_number = f"TRACK-AMBAR-{order.id}MX"
        order.tracking_url = f"https://track.skydropx.com/?q={order.tracking_number}"
        order.shipping_provider = order.shipping_provider or "Paquetería Nacional (FedEx/Estafeta)"
        sample_pdf = generate_sample_shipping_label_pdf(order)
        order.shipping_label_pdf = sample_pdf or f"https://labels.skydropx.com/sample_{order.id}.pdf"
        order.shipping_status = "completed"
        order.save()
        return True

    # Obtener configuración logística activa
    from apps.shop.models import ShopShippingConfig
    config = ShopShippingConfig.get_solo()
    method_mode = config.method_mode  # 'quotation' o 'direct_rate'

    shipment_result = None

    # Método B: Direct Rate Shipment
    if method_mode == "direct_rate":
        logger.info(f"[Logística] Emisión de envío directo (Opción B) con transportista: {config.default_carrier}")
        shipment_result = create_rate_shipment(
            client=client,
            origin_address=origin_address,
            destination_address=destination_address,
            carrier_name=config.default_carrier,
            service_name=config.default_service,
            order=order
        )

    # Método A: Quotation con rate_id
    else:
        # A.1 Si el cliente ya seleccionó una tarifa con UUID de Skydropx
        if order.selected_rate_id and not order.selected_rate_id.startswith("rate_"):
            logger.info(f"[Logística] Creando envío en Skydropx usando selected_rate_id: {order.selected_rate_id}")
            shipment_result = create_shipment_from_rate(
                client=client,
                rate_id=order.selected_rate_id,
                address_from=origin_address,
                address_to=destination_address,
                order=order
            )

        # A.2 Si no había tarifa previa o era fallback local, cotizar en vivo
        if not shipment_result or not shipment_result.get("success"):
            logger.info(f"[Logística] Cotizando tarifa en vivo para Pedido #{order.id}")
            from .quotations import quote_shipping_rates
            rates = quote_shipping_rates(origin_address["zip_code"], destination_address["postal_code"])
            real_rates = [r for r in rates if not r.get("is_fallback") and r.get("id")]
            if real_rates:
                chosen_rate = real_rates[0]
                logger.info(f"[Logística] Seleccionada tarifa óptima {chosen_rate['id']} ({chosen_rate['provider']})")
                shipment_result = create_shipment_from_rate(
                    client=client,
                    rate_id=chosen_rate["id"],
                    address_from=origin_address,
                    address_to=destination_address,
                    order=order
                )

    # Procesar resultado
    if shipment_result and shipment_result.get("success"):
        order.skydropx_shipment_id = str(shipment_result.get("shipment_id") or "")
        order.shipping_id = order.skydropx_shipment_id
        order.tracking_number = shipment_result.get("tracking_number") or ""
        order.tracking_url = shipment_result.get("tracking_url") or ""
        order.shipping_provider = shipment_result.get("carrier_name") or order.shipping_provider
        order.shipping_error = ""

        remote_label_url = shipment_result.get("label_url")
        if remote_label_url:
            local_url = backup_remote_label_pdf(remote_label_url, order.id)
            order.shipping_label_pdf = local_url or remote_label_url
            order.shipping_status = "completed"
        else:
            # Si el tracking está listo pero la etiqueta sigue procesándose en el transportista
            order.shipping_status = "label_pending" if order.tracking_number else "processing"

        order.save()
        logger.info(
            f"[Logística] ✅ Envío registrado exitosamente para Pedido #{order.id}. "
            f"Tracking: {order.tracking_number}, Status: {order.shipping_status}"
        )
        return True

    # Fallo o Timeout externo: NO generar guía falsa sin reconciliación
    err_str = (shipment_result or {}).get("error", "Error indeterminado contactando Skydropx")
    logger.error(
        f"[Logística] ❌ No se pudo emitir guía para Pedido #{order.id} en Skydropx: {err_str}. "
        f"Marcando orden como 'reconciliation_required'."
    )
    order.shipping_status = "reconciliation_required"
    order.shipping_error = str(err_str)[:500]
    order.save(update_fields=["shipping_status", "shipping_error"])
    return False
