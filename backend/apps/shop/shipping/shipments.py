import hashlib
import json
import logging
import uuid
import requests
from typing import Optional, Dict, Any
from django.conf import settings
from django.db import transaction
from .client import SkydropxClient
from .common import (
    get_origin_address, 
    normalize_mexican_state,
    calculate_order_package,
    validate_shipment_payload_contract,
    ShippingStatus
)
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
    POST /api/v1/shipments (Opción A):
    Crea el envío a partir del rate_id y descuenta el saldo en la cartera de Skydropx.
    Encapsula el payload rigurosamente bajo {"shipment": ...} conforme a la API de Skydropx Pro.
    """
    if not client.is_configured or not rate_id:
        return None

    origin = address_from or get_origin_address()
    dest = address_to or {}

    # Consultar saldo previo para auditoría financiera
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

    # Paquetes calculados dinámicamente con Carta Porte y dimensiones obligatorias
    packages_payload = calculate_order_package(order=order)

    shipment_data = {
        "rate_id": rate_id,
        "printing_format": printing_format,
        "sync_label_creation": True,
        "unique_shipment": True,
        "address_from": from_payload,
        "address_to": to_payload,
        "packages": packages_payload
    }

    is_sandbox = str(client.environment).lower() in ["staging", "sandbox", "pro_staging", "pro_sandbox", "test"]
    is_not_prod = client.environment not in ["production", "prod", "pro_production"] and getattr(settings, "ENVIRONMENT", "").lower() not in ["production", "prod"]
    if is_sandbox and is_not_prod and getattr(settings, "SKYDROPX_AUTO_ADVANCE", False):
        shipment_data["auto_advance"] = True

    payload = {"shipment": shipment_data}

    # Validación estricta de contrato previo al despacho HTTP
    is_valid, contract_errors = validate_shipment_payload_contract(payload)
    if not is_valid:
        err_desc = f"Violación de contrato de carga: {'; '.join(contract_errors)}"
        logger.error(f"[Shipments] {err_desc}")
        return {
            "success": False,
            "status_code": 400,
            "error": err_desc
        }

    endpoint = "shipments"
    response = None
    error_msg = ""
    status_code = 0

    try:
        response = client.request(
            "POST", 
            endpoint, 
            json_data=payload,
            idempotency_key=getattr(order, 'shipping_attempt_id', None)
        )
        status_code = response.status_code
    except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
        error_msg = f"Network timeout / connection drop: {e}"
        logger.error(f"[Shipments] Timeout/Connection error contactando POST /{endpoint}: {e}")
        status_code = 504
    except Exception as e:
        error_msg = str(e)
        logger.error(f"[Shipments] Excepción contactando POST /{endpoint}: {e}")

    # Consultar saldo posterior para auditoría financiera
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
        correlation_id=client.correlation_id,
        shipment_id=None
    )

    # Aceptar 200 OK, 201 Created y 202 Accepted (asíncrono canónico)
    if status_code not in (200, 201, 202):
        logger.error(f"[Shipments] Error creating shipment from rate ({status_code}): {resp_json}")
        return {
            "success": False,
            "status_code": status_code,
            "error": resp_json.get("message") or resp_json.get("error") or f"HTTP {status_code}"
        }

    shipment_data_res = resp_json.get("data", {})
    attrs = shipment_data_res.get("attributes", shipment_data_res)
    shipment_id = str(shipment_data_res.get("id") or attrs.get("id") or resp_json.get("id") or "")
    tracking_number = attrs.get("master_tracking_number") or attrs.get("tracking_number") or resp_json.get("tracking_number") or ""
    carrier_name = attrs.get("carrier_name") or resp_json.get("carrier_name") or "Paquetería"
    label_url = attrs.get("label_url") or resp_json.get("label_url") or ""

    # Persistencia preliminar inmediata de shipment_id antes de iniciar polling
    if order and shipment_id:
        try:
            order.skydropx_shipment_id = str(shipment_id)
            order.shipping_id = str(shipment_id)
            if tracking_number:
                order.tracking_number = str(tracking_number)
                order.tracking_url = f"https://track.skydropx.com/?q={tracking_number}"
            if carrier_name:
                order.shipping_provider = carrier_name
            order.shipping_status = ShippingStatus.PROCESSING.value if status_code == 202 else (ShippingStatus.COMPLETED.value if label_url else ShippingStatus.CREATED.value)
            fields = ["skydropx_shipment_id", "shipping_id", "shipping_status"]
            if tracking_number:
                fields.extend(["tracking_number", "tracking_url"])
            if carrier_name:
                fields.append("shipping_provider")
            order.save(update_fields=list(set(fields)))
            logger.info(f"[Shipments] Persistido inmediatamente shipment_id={shipment_id} para Pedido #{order.id} (Status={order.shipping_status})")
        except Exception as pe:
            logger.error(f"[Shipments] Error en persistencia preliminar en Pedido #{getattr(order, 'id', None)}: {pe}")

    # Si fue HTTP 202 o no tenemos tracking/etiqueta sincrónica, consultar polling con backoff + jitter
    if status_code == 202 or not tracking_number or not label_url:
        logger.info(f"[Shipments] Envío {shipment_id} aceptado asíncronamente (HTTP {status_code}). Iniciando polling con backoff y jitter...")
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
    POST /api/v1/rate/shipments (Opción B):
    Crea el envío directo con transportista/servicio predeterminado sin necesidad de cotización previa.
    Encapsula el payload bajo {"shipment": ...}.
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

    packages_payload = calculate_order_package(order=order, parcel_override=parcel)

    carrier = carrier_name or "fedex"
    service = service_name or "standard"

    shipment_data = {
        "carrier": carrier.lower(),
        "service_name": service,
        "printing_format": printing_format,
        "sync_label_creation": True,
        "unique_shipment": True,
        "address_from": from_payload,
        "address_to": to_payload,
        "packages": packages_payload
    }

    is_sandbox = str(client.environment).lower() in ["staging", "sandbox", "pro_staging", "pro_sandbox", "test"]
    is_not_prod = client.environment not in ["production", "prod", "pro_production"] and getattr(settings, "ENVIRONMENT", "").lower() not in ["production", "prod"]
    if is_sandbox and is_not_prod and getattr(settings, "SKYDROPX_AUTO_ADVANCE", False):
        shipment_data["auto_advance"] = True

    payload = {"shipment": shipment_data}

    is_valid, contract_errors = validate_shipment_payload_contract(payload)
    if not is_valid:
        err_desc = f"Violación de contrato de carga (direct rate): {'; '.join(contract_errors)}"
        logger.error(f"[Shipments] {err_desc}")
        return {
            "success": False,
            "status_code": 400,
            "error": err_desc
        }

    endpoint = "rate/shipments"
    response = None
    error_msg = ""
    status_code = 0

    try:
        response = client.request(
            "POST", 
            endpoint, 
            json_data=payload,
            idempotency_key=getattr(order, 'shipping_attempt_id', None)
        )
        status_code = response.status_code
    except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
        error_msg = f"Network timeout / connection drop: {e}"
        logger.error(f"[Shipments] Timeout/Connection error en POST /{endpoint}: {e}")
        status_code = 504
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
        correlation_id=client.correlation_id,
        shipment_id=None
    )

    if status_code not in (200, 201, 202):
        logger.error(f"[Shipments] Error in direct rate shipment ({status_code}): {resp_json}")
        return {
            "success": False,
            "status_code": status_code,
            "error": resp_json.get("message") or resp_json.get("error") or f"HTTP {status_code}"
        }

    shipment_data_res = resp_json.get("data", {})
    attrs = shipment_data_res.get("attributes", shipment_data_res)
    shipment_id = str(shipment_data_res.get("id") or attrs.get("id") or resp_json.get("id") or "")
    tracking_number = attrs.get("master_tracking_number") or attrs.get("tracking_number") or resp_json.get("tracking_number") or ""
    carrier_res = attrs.get("carrier_name") or resp_json.get("carrier_name") or carrier
    label_url = attrs.get("label_url") or resp_json.get("label_url") or ""

    if order and shipment_id:
        try:
            order.skydropx_shipment_id = str(shipment_id)
            order.shipping_id = str(shipment_id)
            if tracking_number:
                order.tracking_number = str(tracking_number)
                order.tracking_url = f"https://track.skydropx.com/?q={tracking_number}"
            if carrier_res:
                order.shipping_provider = carrier_res
            order.shipping_status = ShippingStatus.PROCESSING.value if status_code == 202 else (ShippingStatus.COMPLETED.value if label_url else ShippingStatus.CREATED.value)
            fields = ["skydropx_shipment_id", "shipping_id", "shipping_status"]
            if tracking_number:
                fields.extend(["tracking_number", "tracking_url"])
            if carrier_res:
                fields.append("shipping_provider")
            order.save(update_fields=list(set(fields)))
        except Exception as pe:
            logger.error(f"[Shipments] Error en persistencia preliminar direct shipment #{shipment_id}: {pe}")

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
    endpoint = f"shipments/{shipment_id}/cancel"
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
        correlation_id=client.correlation_id,
        shipment_id=shipment_id
    )
    return {"success": status_code in (200, 201, 204), "status_code": status_code, "data": resp_json}


def generate_shipping_label(order: Any, correlation_id: Optional[str] = None) -> bool:
    """
    Despachador logístico principal para emisión de guías tras confirmación de pago.
    1. Bloqueo atómico select_for_update() e Idempotencia (previene dobles emisiones y race conditions).
    2. Valida la máquina de estados ShippingStatus.
    3. Nunca recurre a fallbacks ciegos ante timeouts de red (HTTP 504 / drop): pasa a 'reconciliation_required'.
    4. Conecta a Skydropx Pro con Correlation ID e Idempotency Key trazables.
    """
    from apps.shop.models import Order, ShopShippingConfig

    # 1. Bloqueo atómico y chequeo estricto de concurrencia
    with transaction.atomic():
        locked_order = Order.objects.select_for_update().get(id=order.id)
        current_status = getattr(locked_order, "shipping_status", ShippingStatus.PENDING.value)
        tracking = getattr(locked_order, "tracking_number", "")

        # Si ya cuenta con guía emitida o tracking real
        if current_status in [ShippingStatus.CREATED.value, ShippingStatus.COMPLETED.value] or (tracking and not tracking.startswith("TRACK-AMBAR")):
            logger.info(f"[Logística] Pedido #{locked_order.id} ya cuenta con guía emitida ({tracking}). Operación idempotente.")
            return True

        # Prevención de Race Condition: si otro proceso ya inició la emisión
        if current_status == ShippingStatus.CREATING.value:
            logger.warning(f"[Logística] Pedido #{locked_order.id} ya se encuentra en estado 'creating' por otro hilo. Abortando doble emisión.")
            return False

        # Asignar o preservar shipping_attempt_id estable
        if not locked_order.shipping_attempt_id:
            locked_order.shipping_attempt_id = f"att_{uuid.uuid4().hex[:12]}"
        locked_order.shipping_status = ShippingStatus.CREATING.value
        locked_order.save(update_fields=["shipping_attempt_id", "shipping_status"])

    cid = correlation_id or f"shipping:order-{order.id}:attempt-{uuid.uuid4().hex[:8]}"
    client = SkydropxClient(correlation_id=cid)

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
        logger.info(f"[Logística/Mock] Generación de guía simulada para Pedido #{order.id} (entorno sin credenciales).")
        order.tracking_number = f"TRACK-AMBAR-{order.id}MX"
        order.tracking_url = f"https://track.skydropx.com/?q={order.tracking_number}"
        order.shipping_provider = order.shipping_provider or "Paquetería Nacional (Mock)"
        sample_pdf = generate_sample_shipping_label_pdf(order)
        order.shipping_label_pdf = sample_pdf or f"https://labels.skydropx.com/sample_{order.id}.pdf"
        order.shipping_status = ShippingStatus.COMPLETED.value
        order.save(update_fields=["tracking_number", "tracking_url", "shipping_provider", "shipping_label_pdf", "shipping_status"])
        return True

    # Obtener configuración logística activa
    config = ShopShippingConfig.get_solo()
    method_mode = config.method_mode

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

        # Regla P0 de Idempotencia: si falló por timeout de red (502/503/504), NO cotizar en vivo para no duplicar envío
        if shipment_result and shipment_result.get("status_code") in (502, 503, 504):
            logger.warning(f"[Logística] Incertidumbre de red en emisión para Pedido #{order.id} (HTTP {shipment_result.get('status_code')}). Transicionando a 'reconciliation_required' sin emitir duplicado.")
            order.shipping_status = ShippingStatus.RECONCILIATION_REQUIRED.value
            order.shipping_error = f"Incertidumbre o timeout de red con pasarela (HTTP {shipment_result.get('status_code')}); en espera de reconciliación segura."
            order.save(update_fields=["shipping_status", "shipping_error"])
            return False

        # A.2 Si no había tarifa previa o fue rechazada por expiración (422), cotizar en vivo
        if not shipment_result or not shipment_result.get("success"):
            logger.info(f"[Logística] Cotizando tarifa en vivo para Pedido #{order.id} (force_refresh=True)")
            from .quotations import quote_shipping_rates
            rates = quote_shipping_rates(origin_address["zip_code"], destination_address["postal_code"], force_refresh=True)
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

    # Procesar resultado exitoso
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
            order.shipping_status = ShippingStatus.COMPLETED.value
        else:
            order.shipping_status = ShippingStatus.LABEL_PENDING.value if order.tracking_number else ShippingStatus.PROCESSING.value

        order.save(update_fields=["skydropx_shipment_id", "shipping_id", "tracking_number", "tracking_url", "shipping_provider", "shipping_error", "shipping_label_pdf", "shipping_status"])
        logger.info(
            f"[Logística] ✅ Envío registrado exitosamente para Pedido #{order.id}. "
            f"Tracking: {order.tracking_number}, Status: {order.shipping_status}"
        )
        return True

    # Fallo o Incertidumbre: Transición formal a reconciliation_required sin fallos silenciosos
    err_str = (shipment_result or {}).get("error", "Error indeterminado contactando Skydropx")
    logger.error(
        f"[Logística] ❌ No se pudo emitir guía para Pedido #{order.id} en Skydropx: {err_str}. "
        f"Marcando orden como 'reconciliation_required'."
    )
    order.shipping_status = ShippingStatus.RECONCILIATION_REQUIRED.value
    order.shipping_error = str(err_str)[:500]
    order.save(update_fields=["shipping_status", "shipping_error"])
    return False

