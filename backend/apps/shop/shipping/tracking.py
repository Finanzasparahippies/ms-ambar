import logging
from typing import Dict, Any, List, Optional
from .client import SkydropxClient

logger = logging.getLogger("apps")


def get_tracking_events(
    tracking_number: str,
    carrier: Optional[str] = None,
    client: Optional[SkydropxClient] = None
) -> Dict[str, Any]:
    """
    GET /api/v1/shipments/tracking:
    Consulta el historial completo de eventos y estatus de entrega para un número de guía.
    """
    clean_tracking = str(tracking_number).strip()
    if not clean_tracking or clean_tracking.startswith("TRACK-AMBAR"):
        return {
            "success": True,
            "tracking_number": clean_tracking,
            "status": "in_transit",
            "is_simulated": True,
            "events": [
                {
                    "status": "in_transit",
                    "description": "Envío en tránsito con paquetería",
                    "location": "Hermosillo, Sonora",
                    "timestamp": None
                }
            ]
        }

    c = client or SkydropxClient()
    if not c.is_configured:
        return {
            "success": True,
            "tracking_number": clean_tracking,
            "status": "pending",
            "is_mock": True,
            "events": []
        }

    params = {"tracking_number": clean_tracking}
    if carrier:
        params["carrier"] = carrier.lower()

    try:
        res = c.request("GET", "shipments/tracking", params=params)
        if res.status_code == 200:
            data = res.json()
            raw_events = data.get("events", []) or data.get("data", [])
            normalized_events = []
            for ev in raw_events:
                attr = ev.get("attributes", ev)
                normalized_events.append({
                    "status": attr.get("status") or attr.get("status_name") or "update",
                    "description": attr.get("status_details") or attr.get("description") or "",
                    "location": attr.get("location") or attr.get("city") or "",
                    "timestamp": attr.get("created_at") or attr.get("timestamp") or attr.get("date")
                })

            return {
                "success": True,
                "tracking_number": clean_tracking,
                "status": data.get("status", "in_transit"),
                "carrier": data.get("carrier", carrier or ""),
                "estimated_delivery": data.get("estimated_delivery"),
                "events": normalized_events,
                "raw": data
            }
        else:
            return {
                "success": False,
                "status_code": res.status_code,
                "error": f"HTTP {res.status_code}: {res.text[:200]}"
            }
    except Exception as e:
        logger.error(f"[Tracking] Excepción consultando tracking {clean_tracking}: {e}")
        return {"success": False, "error": str(e)}
