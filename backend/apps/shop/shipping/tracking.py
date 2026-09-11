import logging
from datetime import timedelta
from typing import Dict, Any, List, Optional
from django.utils import timezone
from .client import SkydropxClient

logger = logging.getLogger("apps")

# Mapeo de etapas canónicas para la barra de progreso
STAGE_PERCENTAGES = {
    "confirmed": 15,
    "label_created": 30,
    "picked_up": 50,
    "in_transit": 70,
    "out_for_delivery": 88,
    "delivered": 100,
    "exception": 70,
    "cancelled": 0,
}

STAGE_LABELS = {
    "confirmed": "Pedido Confirmado",
    "label_created": "Guía Generada",
    "picked_up": "Recolectado por Paquetería",
    "in_transit": "En Tránsito a Destino",
    "out_for_delivery": "En Reparto Local",
    "delivered": "Entregado con Éxito",
    "exception": "Incidencia en Tránsito",
    "cancelled": "Envío Cancelado",
}


def get_carrier_tracking_url(tracking_number: str, carrier: Optional[str] = None) -> str:
    """Retorna la URL oficial directa para rastreo según la paquetería detectada."""
    clean = str(tracking_number or "").strip()
    if not clean:
        return "#"
    c_lower = str(carrier or "").lower().strip()
    if "paquetexpress" in c_lower:
        return f"https://www.paquetexpress.com.mx/rastreo?tracking={clean}"
    if "fedex" in c_lower:
        return f"https://www.fedex.com/fedextrack/?trknbr={clean}"
    if "dhl" in c_lower:
        return f"https://www.dhl.com/mx-es/home/rastreo.html?tracking-id={clean}"
    if "estafeta" in c_lower:
        return f"https://www.estafeta.com/Herramientas/Rastreo?rastreo={clean}"
    if "redpack" in c_lower:
        return f"https://www.redpack.com.mx/es/rastreo/?guia={clean}"
    if "sendex" in c_lower:
        return f"https://www.sendex.mx/rastreo/?guia={clean}"
    if "tresguerras" in c_lower:
        return f"https://www.tresguerras.com.mx/3G/rastreo.php?num_guia={clean}"
    if "ups" in c_lower:
        return f"https://www.ups.com/track?tracknum={clean}"
    return f"https://track.skydropx.com/?q={clean}"


def normalize_event_stage(status_str: str, desc_str: str = "") -> str:
    """Determina la etapa canónica a partir del estatus y descripción reportados."""
    combined = f"{str(status_str or '').lower()} {str(desc_str or '').lower()}".strip()
    if any(k in combined for k in ["delivered", "entregado", "recibido", "delivery_successful"]):
        return "delivered"
    if any(k in combined for k in ["out_for_delivery", "en reparto", "en ruta", "reparto"]):
        return "out_for_delivery"
    if any(k in combined for k in ["in_transit", "transit", "en transito", "en camino", "traslado", "arribo"]):
        return "in_transit"
    if any(k in combined for k in ["picked_up", "recolectado", "documentado", "recibido en sucursal", "pickup"]):
        return "picked_up"
    if any(k in combined for k in ["label_created", "created", "guia generada", "creado", "impreso"]):
        return "label_created"
    if any(k in combined for k in ["exception", "incidencia", "reintento", "demora", "retenido"]):
        return "exception"
    if any(k in combined for k in ["cancelled", "cancelado", "voided"]):
        return "cancelled"
    return "in_transit"


def build_synthetic_pre_transit_events(order: Any = None, carrier: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Construye los hitos oficiales garantizados cuando la paquetería aún no registra
    el primer escaneo físico en sucursal (evita errores 404 o pantallas vacías).
    """
    created_at_iso = order.created_at.isoformat() if (order and getattr(order, 'created_at', None)) else timezone.now().isoformat()
    pkg_type = getattr(order, 'packaging_type', 'box') if order else 'box'
    pkg_label = "Bolsa de Seguridad (5M)" if pkg_type == "bag" else "Caja de Envío (4G)"
    carrier_name = carrier or getattr(order, 'shipping_provider', 'Paquetería Nacional') or 'Paquetería Nacional'
    dest_str = f"{getattr(order, 'city', '')}, {getattr(order, 'state', '')}".strip(" ,") if order else "Destino Nacional"

    return [
        {
            "stage": "confirmed",
            "status": "Pedido Confirmado",
            "description": f"Compra procesada y acreditada con éxito. Pedido #{getattr(order, 'id', '')}",
            "location": "Hermosillo, Sonora",
            "timestamp": created_at_iso
        },
        {
            "stage": "label_created",
            "status": "Guía Generada y Empaque Asignado",
            "description": f"Guía oficial emitida con {carrier_name}. Empaque: {pkg_label}.",
            "location": "Almacén Central Ms Ambar (Hermosillo, Sonora)",
            "timestamp": created_at_iso
        },
        {
            "stage": "label_created",
            "status": "En Espera de Recolección",
            "description": f"El paquete está embalado y listo para ser recolectado por el mensajero de {carrier_name}.",
            "location": "Hermosillo, Sonora",
            "timestamp": created_at_iso
        }
    ]


def get_tracking_events(
    tracking_number: str,
    carrier: Optional[str] = None,
    client: Optional[SkydropxClient] = None,
    order: Optional[Any] = None,
    force_live: bool = False
) -> Dict[str, Any]:
    """
    Consulta y normaliza el historial completo de rastreo con tolerancia a fallos,
    soporte de caché de 15 minutos en Order.tracking_history y resiliencia ante retrasos
    del primer escaneo de la paquetería.
    """
    clean_tracking = str(tracking_number or "").strip()
    carrier_name = carrier or (getattr(order, 'shipping_provider', '') if order else '') or 'Paquetería'
    carrier_url = get_carrier_tracking_url(clean_tracking, carrier_name)

    # 1. Verificación de Caché en DB (< 15 minutos o estado terminal)
    now = timezone.now()
    if order and not force_live:
        cached_history = getattr(order, 'tracking_history', None)
        last_checked = getattr(order, 'tracking_last_checked_at', None)
        is_terminal = getattr(order, 'status', '') in ['delivered', 'cancelled']

        if cached_history and isinstance(cached_history, list) and len(cached_history) > 0:
            is_fresh = last_checked and (now - last_checked < timedelta(minutes=15))
            if is_fresh or is_terminal:
                logger.info(f"[Tracking] Sirviendo checkpoints desde caché local para Pedido #{order.id} (Tracking: {clean_tracking})")
                current_stage = cached_history[-1].get("stage", "in_transit") if cached_history else "in_transit"
                return {
                    "success": True,
                    "tracking_number": clean_tracking,
                    "order_id": order.id,
                    "carrier": carrier_name,
                    "carrier_url": carrier_url,
                    "current_stage": current_stage,
                    "status_label": STAGE_LABELS.get(current_stage, "En Tránsito"),
                    "stage_percentage": STAGE_PERCENTAGES.get(current_stage, 50),
                    "packaging_type": getattr(order, 'packaging_type', 'box'),
                    "estimated_delivery": getattr(order, 'estimated_delivery_date', None),
                    "is_cached": True,
                    "events": cached_history
                }

    # 2. Modo Simulado / Mock de Pruebas
    if not clean_tracking or clean_tracking.startswith("TRACK-AMBAR"):
        events = build_synthetic_pre_transit_events(order, carrier_name)
        if clean_tracking:
            events.append({
                "stage": "in_transit",
                "status": "En Tránsito",
                "description": "Envío en tránsito terrestre hacia la sucursal de destino",
                "location": "Centro de Distribución Norte",
                "timestamp": now.isoformat()
            })
        current_stage = "in_transit"
        return {
            "success": True,
            "tracking_number": clean_tracking,
            "order_id": getattr(order, 'id', None),
            "carrier": carrier_name,
            "carrier_url": carrier_url,
            "current_stage": current_stage,
            "status_label": STAGE_LABELS.get(current_stage, "En Tránsito"),
            "stage_percentage": STAGE_PERCENTAGES.get(current_stage, 70),
            "packaging_type": getattr(order, 'packaging_type', 'box') if order else 'box',
            "is_simulated": True,
            "events": events
        }

    # 3. Consulta en vivo con Skydropx Pro API
    c = client or SkydropxClient()
    if not c.is_configured:
        events = build_synthetic_pre_transit_events(order, carrier_name)
        return {
            "success": True,
            "tracking_number": clean_tracking,
            "order_id": getattr(order, 'id', None),
            "carrier": carrier_name,
            "carrier_url": carrier_url,
            "current_stage": "label_created",
            "status_label": STAGE_LABELS["label_created"],
            "stage_percentage": STAGE_PERCENTAGES["label_created"],
            "packaging_type": getattr(order, 'packaging_type', 'box') if order else 'box',
            "is_mock": True,
            "events": events
        }

    params = {"tracking_number": clean_tracking}
    if carrier_name:
        params["carrier"] = carrier_name.lower()

    try:
        res = c.request("GET", "shipments/tracking", params=params)
        if res.status_code == 200:
            data = res.json()
            raw_events = data.get("events", []) or data.get("data", [])
            normalized_events = []
            
            # Incluir siempre el hito inicial de confirmación si tenemos order
            if order:
                normalized_events.append({
                    "stage": "confirmed",
                    "status": "Pedido Confirmado",
                    "description": f"Compra registrada exitosamente en Ms Ambar. Pedido #{order.id}",
                    "location": "Hermosillo, Sonora",
                    "timestamp": order.created_at.isoformat() if getattr(order, 'created_at', None) else now.isoformat()
                })

            for ev in raw_events:
                attr = ev.get("attributes", ev) if isinstance(ev, dict) else {}
                status_raw = attr.get("status") or attr.get("status_name") or attr.get("event") or "update"
                desc_raw = attr.get("status_details") or attr.get("description") or attr.get("message") or ""
                stage = normalize_event_stage(status_raw, desc_raw)
                normalized_events.append({
                    "stage": stage,
                    "status": str(status_raw).title(),
                    "description": desc_raw or STAGE_LABELS.get(stage, "Actualización de tránsito"),
                    "location": attr.get("location") or attr.get("city") or "",
                    "timestamp": attr.get("created_at") or attr.get("timestamp") or attr.get("date") or now.isoformat()
                })

            # Si Skydropx respondió 200 pero la lista de eventos físicos está vacía
            if len(normalized_events) <= (1 if order else 0):
                normalized_events = build_synthetic_pre_transit_events(order, carrier_name)

            current_stage = normalized_events[-1]["stage"] if normalized_events else "label_created"
            estimated_deliv = data.get("estimated_delivery")

            # Persistir en Order si fue provisto
            if order:
                try:
                    order.tracking_history = normalized_events
                    order.tracking_last_checked_at = now
                    if estimated_deliv:
                        order.estimated_delivery_date = estimated_deliv
                    order.save(update_fields=['tracking_history', 'tracking_last_checked_at', 'estimated_delivery_date'])
                except Exception as save_err:
                    logger.warning(f"[Tracking] Error actualizando tracking_history en Pedido #{order.id}: {save_err}")

            return {
                "success": True,
                "tracking_number": clean_tracking,
                "order_id": getattr(order, 'id', None),
                "carrier": data.get("carrier", carrier_name),
                "carrier_url": carrier_url,
                "current_stage": current_stage,
                "status_label": STAGE_LABELS.get(current_stage, "En Tránsito"),
                "stage_percentage": STAGE_PERCENTAGES.get(current_stage, 50),
                "packaging_type": getattr(order, 'packaging_type', 'box') if order else 'box',
                "estimated_delivery": estimated_deliv,
                "events": normalized_events,
                "raw": data
            }

        else:
            # Tolerancia a Carrier Scan Delay (HTTP 404/422 o error de red de paquetería)
            logger.info(f"[Tracking] Skydropx devolvió HTTP {res.status_code} para {clean_tracking}. Retornando hitos pre-tránsito.")
            synthetic_events = build_synthetic_pre_transit_events(order, carrier_name)
            
            if order and not getattr(order, 'tracking_history', None):
                try:
                    order.tracking_history = synthetic_events
                    order.tracking_last_checked_at = now
                    order.save(update_fields=['tracking_history', 'tracking_last_checked_at'])
                except Exception:
                    pass

            return {
                "success": True,
                "tracking_number": clean_tracking,
                "order_id": getattr(order, 'id', None),
                "carrier": carrier_name,
                "carrier_url": carrier_url,
                "current_stage": "label_created",
                "status_label": STAGE_LABELS["label_created"],
                "stage_percentage": STAGE_PERCENTAGES["label_created"],
                "packaging_type": getattr(order, 'packaging_type', 'box') if order else 'box',
                "is_pre_transit": True,
                "events": synthetic_events
            }

    except Exception as e:
        logger.error(f"[Tracking] Excepción consultando tracking {clean_tracking}: {e}", exc_info=True)
        synthetic_events = build_synthetic_pre_transit_events(order, carrier_name)
        return {
            "success": True,
            "tracking_number": clean_tracking,
            "order_id": getattr(order, 'id', None),
            "carrier": carrier_name,
            "carrier_url": carrier_url,
            "current_stage": "label_created",
            "status_label": STAGE_LABELS["label_created"],
            "stage_percentage": STAGE_PERCENTAGES["label_created"],
            "packaging_type": getattr(order, 'packaging_type', 'box') if order else 'box',
            "is_pre_transit": True,
            "events": synthetic_events
        }
