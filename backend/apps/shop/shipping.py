import requests
import os
import logging
from django.conf import settings

logger = logging.getLogger("apps")

def generate_shipping_label(order):
    """
    Despachador Logístico para el proyecto Ms Ambar.
    Detecta si se usa la llave propia de la artista o la cuenta master de Néctar Labs.
    """
    # 1. Esquema Híbrido de API Keys
    custom_key = os.environ.get("AMBAR_OWN_SKYDROPX_KEY", "")
    nectar_key = os.environ.get("NECTAR_LABS_SKYDROPX_KEY", "")
    
    if custom_key:
        api_key = custom_key
        logger.info(f"[Logística] Generando guía con cuenta propia del cliente (Ms Ambar).")
    else:
        api_key = nectar_key
        logger.info(f"[Logística] Generando guía con cuenta corporativa Néctar Labs.")

    # 2. Dirección de Origen Fija de la Artista (Almacén/Oficina de Despacho)
    origin_address = {
        "name": os.environ.get("SHIPPING_ORIGIN_NAME", "Almacén Ms Ambar"),
        "phone": os.environ.get("SHIPPING_ORIGIN_PHONE", "6621000000"),
        "street": os.environ.get("SHIPPING_ORIGIN_STREET", "Av. Serdán 123"),
        "suburb": os.environ.get("SHIPPING_ORIGIN_SUBURB", "Centro"),
        "city": os.environ.get("SHIPPING_ORIGIN_CITY", "Hermosillo"),
        "state": os.environ.get("SHIPPING_ORIGIN_STATE", "SO"), # Sonora
        "zip_code": os.environ.get("SHIPPING_ORIGIN_POSTAL_CODE", "83000"),
        "country": "MX"
    }

    # 3. Datos de Destino (Comprador)
    destination_address = {
        "name": order.full_name,
        "phone": order.phone or "6620000000",
        "street": order.street_and_number,
        "suburb": order.suburb,
        "city": order.city,
        "state": order.state[:2].upper(), # Skydropx prefiere códigos de 2 letras
        "zip_code": order.postal_code,
        "country": "MX"
    }

    # Fallback Simulado por seguridad en Local o Pruebas de la CLI
    if not api_key or api_key == "mock_key" or getattr(settings, "TESTING", False):
        logger.warning("[Logística/Mock] Generación de guía simulada exitosamente.")
        order.tracking_number = "TRACK-AMBAR-MX99"
        order.tracking_url = "https://track.skydropx.com/?q=TRACK-AMBAR-MX99"
        order.shipping_label_pdf = "https://labels.skydropx.com/sample.pdf"
        order.shipping_provider = "FedEx Express Mock"
        order.save()
        return True

    # 4. Conexión Real con el API Rest de Skydropx
    try:
        headers = {
            "Authorization": f"Token token={api_key}",
            "Content-Type": "application/json"
        }
        
        # Dimensión estándar combinada para Merch (Playeras/Discos)
        payload = {
            "address_inform": origin_address,
            "address_to": destination_address,
            "parcel": {
                "weight": 1, # 500 gramos promedio
                "height": 15,  # 10 cm
                "width": 25,   # 20 cm
                "length": 35   # 30 cm
            }
        }

        # Paso A: Registrar el envío para cotizar
        response = requests.post("https://api.skydropx.com/v1/shipments", json=payload, headers=headers, timeout=10)
        if response.status_code != 201:
            raise Exception(f"Skydropx Shipment Error: {response.text}")
        
        shipment_data = response.json()
        # Seleccionamos la tarifa económica más rápida disponible en el arreglo
        best_rate = shipment_data['data']['attributes']['rates'][0]
        
        # Paso B: Emitir la etiqueta de paquetería
        label_payload = {"generate_label": True, "rate_id": best_rate['id']}
        label_response = requests.post("https://api.skydropx.com/v1/labels", json=label_payload, headers=headers, timeout=10)
        
        if label_response.status_code == 201:
            label_data = label_response.json()
            order.tracking_number = label_data['data']['attributes']['tracking_number']
            order.tracking_url = label_data['data']['attributes']['tracking_url']
            order.shipping_label_pdf = label_data['data']['attributes']['label_url']
            order.shipping_provider = best_rate['provider']
            order.save()
            return True
            
    except Exception as e:
        logger.error(f"[Logística/Fatal] Error al emitir guía para Pedido #{order.id}: {e}")
        return False