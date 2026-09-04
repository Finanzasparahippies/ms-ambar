import logging
from typing import Dict, Any, List
from django.utils import timezone
from .client import SkydropxClient
from .labels import backup_remote_label_pdf

logger = logging.getLogger("apps")


def reconcile_order_shipping(order: Any) -> Dict[str, Any]:
    """
    Reconcilia el estado logístico de un pedido con Skydropx Pro:
    1. Si ya tiene shipment_id registrado, consulta su estatus y URL de guía actual.
    2. Si quedó en 'reconciliation_required' sin shipment_id, busca en el registro
       de auditoría ShippingEvent para evitar duplicar envíos.
    3. Si no existe ningún registro previo y el pedido está pagado, re-intenta la emisión.
    """
    client = SkydropxClient()
    current_status = getattr(order, "shipping_status", "pending")
    shipment_id = getattr(order, "skydropx_shipment_id", "") or getattr(order, "shipping_id", "")

    # Si ya está completada con guía oficial
    if current_status == "completed" and order.tracking_number and not order.tracking_number.startswith("TRACK-AMBAR"):
        return {
            "reconciled": True,
            "order_id": order.id,
            "status": "completed",
            "tracking_number": order.tracking_number,
            "message": "La orden ya se encuentra completada y conciliada."
        }

    # 1. Si existe shipment_id, consultar estado en Skydropx
    if shipment_id:
        logger.info(f"[Reconciliación] Consultando estado en Skydropx para Pedido #{order.id} (Shipment: {shipment_id})")
        res = client.get_shipment(shipment_id)
        if res.get("success"):
            data = res.get("data", {})
            attrs = data.get("attributes", data)
            remote_status = str(attrs.get("status") or "").lower()
            tracking_number = attrs.get("master_tracking_number") or attrs.get("tracking_number")
            label_url = attrs.get("label_url")

            if tracking_number:
                order.tracking_number = tracking_number
                order.tracking_url = attrs.get("tracking_url") or f"https://track.skydropx.com/?q={tracking_number}"

            if label_url:
                local_pdf = backup_remote_label_pdf(label_url, order.id)
                order.shipping_label_pdf = local_pdf or label_url
                order.shipping_status = "completed"
                order.shipping_error = ""
            elif tracking_number:
                order.shipping_status = "label_pending"

            order.save()
            return {
                "reconciled": True,
                "order_id": order.id,
                "status": order.shipping_status,
                "tracking_number": order.tracking_number,
                "label_url": order.shipping_label_pdf
            }
        else:
            logger.warning(f"[Reconciliación] Consulta de envío {shipment_id} falló: {res.get('error')}")

    # 2. Si no hay shipment_id, verificar si se creó en auditoría ShippingEvent
    from apps.shop.models import ShippingEvent
    recent_events = ShippingEvent.objects.filter(order=order, status_code__in=[200, 201, 202]).order_by("-created_at")
    for ev in recent_events:
        resp = ev.response_body or {}
        data = resp.get("data", {})
        attrs = data.get("attributes", data)
        candidate_id = str(data.get("id") or attrs.get("id") or resp.get("id") or "")
        if candidate_id:
            logger.info(f"[Reconciliación] Recuperado shipment_id {candidate_id} desde ShippingEvent para Pedido #{order.id}")
            order.skydropx_shipment_id = candidate_id
            order.shipping_id = candidate_id
            order.save(update_fields=["skydropx_shipment_id", "shipping_id"])
            return reconcile_order_shipping(order)

    # 3. Si no existe ningún envío creado y la orden está pagada, re-intentar emisión
    if getattr(order, "payment_status", "") in ["paid", "succeeded", "complete"]:
        logger.info(f"[Reconciliación] Re-intentando emisión limpia de guía para Pedido #{order.id}")
        from .shipments import generate_shipping_label
        success = generate_shipping_label(order)
        order.refresh_from_db()
        return {
            "reconciled": success,
            "order_id": order.id,
            "status": order.shipping_status,
            "tracking_number": order.tracking_number,
            "error": order.shipping_error
        }

    return {
        "reconciled": False,
        "order_id": order.id,
        "status": current_status,
        "message": "La orden no se encuentra en estado de pago confirmado para reconciliar."
    }


def reconcile_pending_shipments() -> List[Dict[str, Any]]:
    """
    Reconcilia en lote todos los pedidos con guías pendientes, en proceso o con error.
    """
    from apps.shop.models import Order
    pending_orders = Order.objects.filter(
        shipping_status__in=["requested", "processing", "label_pending", "reconciliation_required"]
    ).order_by("-id")[:50]

    results = []
    for order in pending_orders:
        res = reconcile_order_shipping(order)
        results.append(res)

    return results
