import logging
from typing import Dict, Any, List
from django.utils import timezone
from django.db import transaction
from .client import SkydropxClient
from .labels import backup_remote_label_pdf
from .common import ShippingStatus

logger = logging.getLogger("apps")


def reconcile_order_shipping(order: Any, dry_run: bool = False) -> Dict[str, Any]:
    """
    Reconcilia el estado logístico de un pedido con Skydropx Pro:
    1. Bloqueo atómico select_for_update() para evitar condiciones de carrera.
    2. Si ya tiene shipment_id registrado, consulta su estatus y URL de guía actual.
    3. Si quedó en 'reconciliation_required' sin shipment_id, busca en el registro
       de auditoría ShippingEvent para evitar duplicar envíos.
    4. Si no existe ningún registro previo y el pedido está pagado (status in ['paid', 'shipped', 'delivered']),
       re-intenta la emisión oficial (respetando dry_run).
    """
    from apps.shop.models import Order, ShippingEvent

    with transaction.atomic():
        locked_order = Order.objects.select_for_update().get(id=order.id)
        current_status = getattr(locked_order, "shipping_status", ShippingStatus.PENDING.value)
        shipment_id = getattr(locked_order, "skydropx_shipment_id", "") or getattr(locked_order, "shipping_id", "")
        tracking = getattr(locked_order, "tracking_number", "")

        # Si ya está completada con guía oficial
        if current_status == ShippingStatus.COMPLETED.value and tracking and not tracking.startswith("TRACK-AMBAR"):
            return {
                "reconciled": True,
                "dry_run": dry_run,
                "order_id": locked_order.id,
                "status": ShippingStatus.COMPLETED.value,
                "tracking_number": tracking,
                "message": "La orden ya se encuentra completada y conciliada."
            }

        client = SkydropxClient()

        # 1. Si existe shipment_id, consultar estado en Skydropx
        if shipment_id:
            logger.info(f"[Reconciliación] Consultando estado en Skydropx para Pedido #{locked_order.id} (Shipment: {shipment_id})")
            res = client.get_shipment(shipment_id)
            if res.get("success"):
                data = res.get("data", {})
                attrs = data.get("attributes", data)
                remote_status = str(attrs.get("status") or "").lower()
                tracking_number = attrs.get("master_tracking_number") or attrs.get("tracking_number")
                label_url = attrs.get("label_url")

                if dry_run:
                    return {
                        "reconciled": True,
                        "dry_run": True,
                        "order_id": locked_order.id,
                        "action_planned": "Actualizar datos desde Skydropx (sin mutar DB)",
                        "current_status": current_status,
                        "planned_status": ShippingStatus.COMPLETED.value if label_url else (ShippingStatus.LABEL_PENDING.value if tracking_number else current_status),
                        "tracking_number": tracking_number,
                        "label_url": label_url
                    }

                if tracking_number:
                    locked_order.tracking_number = tracking_number
                    locked_order.tracking_url = attrs.get("tracking_url") or f"https://track.skydropx.com/?q={tracking_number}"

                if label_url:
                    local_pdf = backup_remote_label_pdf(label_url, locked_order.id)
                    locked_order.shipping_label_pdf = local_pdf or label_url
                    locked_order.shipping_status = ShippingStatus.COMPLETED.value
                    locked_order.shipping_error = ""
                elif tracking_number:
                    locked_order.shipping_status = ShippingStatus.LABEL_PENDING.value

                locked_order.save()
                return {
                    "reconciled": True,
                    "dry_run": False,
                    "order_id": locked_order.id,
                    "status": locked_order.shipping_status,
                    "tracking_number": locked_order.tracking_number,
                    "label_url": locked_order.shipping_label_pdf
                }
            else:
                logger.warning(f"[Reconciliación] Consulta de envío {shipment_id} falló: {res.get('error')}")

        # 2. Si no hay shipment_id, verificar si se creó en auditoría ShippingEvent
        recent_events = ShippingEvent.objects.filter(order=locked_order, http_status__in=[200, 201, 202]).order_by("-created_at")
        for ev in recent_events:
            resp = ev.response_payload or {}
            data = resp.get("data", {})
            attrs = data.get("attributes", data)
            candidate_id = str(data.get("id") or attrs.get("id") or resp.get("id") or "")
            if candidate_id:
                logger.info(f"[Reconciliación] Recuperado shipment_id {candidate_id} desde ShippingEvent para Pedido #{locked_order.id}")
                if dry_run:
                    return {
                        "reconciled": True,
                        "dry_run": True,
                        "order_id": locked_order.id,
                        "action_planned": f"Vincular shipment_id {candidate_id} recuperado de ShippingEvent",
                        "current_status": current_status
                    }
                locked_order.skydropx_shipment_id = candidate_id
                locked_order.shipping_id = candidate_id
                locked_order.save(update_fields=["skydropx_shipment_id", "shipping_id"])
                return reconcile_order_shipping(locked_order, dry_run=False)

        # 3. Si no existe ningún envío previo y la orden está pagada, re-intentar emisión limpia
        order_is_paid = locked_order.status in ["paid", "shipped", "delivered"] or getattr(locked_order, "payment_status", "") in ["paid", "succeeded", "complete"]
        if order_is_paid:
            if dry_run:
                return {
                    "reconciled": False,
                    "dry_run": True,
                    "order_id": locked_order.id,
                    "action_planned": "Re-intentar emisión oficial generate_shipping_label (descontaría saldo)",
                    "current_status": current_status,
                    "message": "[DRY-RUN] Orden pagada sin envío previo detectado; se re-intentaría emisión oficial."
                }

            logger.info(f"[Reconciliación] Re-intentando emisión limpia de guía para Pedido #{locked_order.id}")
            from .shipments import generate_shipping_label
            success = generate_shipping_label(locked_order)
            locked_order.refresh_from_db()
            return {
                "reconciled": success,
                "dry_run": False,
                "order_id": locked_order.id,
                "status": locked_order.shipping_status,
                "tracking_number": locked_order.tracking_number,
                "error": locked_order.shipping_error
            }

        return {
            "reconciled": False,
            "dry_run": dry_run,
            "order_id": locked_order.id,
            "status": current_status,
            "message": f"La orden #{locked_order.id} no se encuentra en estado de pago confirmado (status='{locked_order.status}') para reconciliar."
        }


def reconcile_pending_shipments(dry_run: bool = False, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Reconcilia en lote todos los pedidos con guías pendientes, en proceso o con error.
    Soporta dry_run para auditar acciones sin impacto en base de datos ni cargos de saldo.
    """
    from apps.shop.models import Order
    pending_orders = Order.objects.filter(
        shipping_status__in=[
            ShippingStatus.REQUESTED.value,
            ShippingStatus.PROCESSING.value,
            ShippingStatus.LABEL_PENDING.value,
            ShippingStatus.RECONCILIATION_REQUIRED.value
        ]
    ).order_by("-id")[:limit]

    results = []
    for order in pending_orders:
        res = reconcile_order_shipping(order, dry_run=dry_run)
        results.append(res)

    return results
