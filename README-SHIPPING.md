# 📦 Manual de Arquitectura, Configuración y Uso de Envíos (Logística Skydropx Pro) — Ms Ambar

Este documento detalla la arquitectura técnica, el flujo de cotización en tiempo real, la autenticación OAuth2, la emisión automatizada de guías con descuento de saldo y las herramientas de diagnóstico para el sistema logístico de la tienda oficial de **Ms Ambar**.

---

## 1. Arquitectura y Flujo End-to-End de Envíos (Skydropx Pro)

```
[ FRONTEND (CartDrawer / Checkout) ]
       │
       ├─ 1. Ingreso de CP (5 dígitos)
       │    └─► GET /api/shop/shipping/postal-code/<cp>/ (Validación & Normalización ISO 3166-2:MX)
       │
       ├─ 2. Cotización Multi-Carrier en Tiempo Real
       │    └─► POST /api/shop/shipping/quote/ 
       │          ├─ Handshake OAuth2: POST /api/v1/oauth/token (Bearer Token en caché 2h)
       │          ├─ Solicitud inicial: POST /api/v1/quotations
       │          ├─ Sondeo asíncrono: GET /api/v1/quotations/{id} (espera a carriers)
       │          └─ Fallback de contingencia: $150.00 / $220.00 MXN si la API externa no responde
       │
       ├─ 3. Selección de Paquetería & Checkout
       │    └─► POST /api/shop/checkout/ (Persiste selected_rate_id UUID, shipping_cost, shipping_provider)
       │
[ STRIPE GATEWAY ]
       │
       └─► Pago Exitoso (checkout.session.completed)
             │
[ BACKEND (Django Shop Fulfillment) ]
       │
       ├─► generate_shipping_label(order)
       │     ├─ Si selected_rate_id es UUID real ──► POST /api/v1/shipments (Crea envío & descuenta saldo de Skydropx)
       │     ├─ Si fue Fallback / Sin rate_id    ──► Cotiza en vivo + POST /api/v1/shipments
       │     ├─ Sondeo de Guía: GET /api/v1/shipments/{id} (captura label_url y tracking)
       │     └─ Respaldo Local: Descarga el PDF oficial a MEDIA_ROOT/shipping_labels/
       │
       ├─► send_order_confirmation_email(order) (Email HTML con número de rastreo y enlace a guía PDF)
       │
[ SKYDROPX WEBHOOK ]
       │
       └─► POST /api/shop/webhook/skydropx/ (Actualiza Order a 'shipped' y 'delivered' en tiempo real)
```

---

## 2. Variables de Entorno de Configuración

Configura las siguientes variables en `.env`, `.env.staging` o `.env.prod`:

```ini
# ==============================================================================
# LOGÍSTICA Y PAQUETERÍAS (SKYDROPX PRO)
# ==============================================================================
# Entorno de operación: 'staging' (Sandbox) o 'production' (Producción)
SKYDROPX_ENVIRONMENT=staging

# Credenciales OAuth2 de Skydropx Pro
SKYDROPX_API_KEY=tu_client_id_aqui
SKYDROPX_API_SECRET=tu_client_secret_aqui

# (Opcional) Nombres legacy compatibles si existen en tus secrets actuales:
# NECTAR_LABS_SKYDROPX_API_KEY=tu_client_id_aqui
# NECTAR_LABS_SKYDROPX_API_SECRET=tu_client_secret_aqui

# Token HMAC para validación de webhooks entrantes de Skydropx
SKYDROPX_WEBHOOK_SECRET=kPxZv17KoHJYNGZgsIxRFHWFw50knp0YdGlD6hmpgGQ

# ==============================================================================
# ALMACÉN DE ORIGEN (REMITENTE DE ENVÍOS)
# ==============================================================================
SHIPPING_ORIGIN_NAME=Almacén Oficial Ms Ambar
SHIPPING_ORIGIN_PHONE=6622140000
SHIPPING_ORIGIN_STREET=Blvd. Kino 456
SHIPPING_ORIGIN_SUBURB=Pitic
SHIPPING_ORIGIN_CITY=Hermosillo
SHIPPING_ORIGIN_STATE=Sonora
SHIPPING_ORIGIN_POSTAL_CODE=83150
```

> [!NOTE]
> **Modo Mock / Contingencia:** Si `SKYDROPX_API_KEY` está vacía o es `"mock_key"`, el sistema funciona en modo simulado: cotiza con tarifas de respaldo ($150 / $220 MXN) y genera guías de muestra en PDF con números de tracking virtuales (`TRACK-AMBAR-{id}MX`) sin interrumpir la experiencia del comprador.

---

## 3. Endpoints Oficiales de Skydropx Pro

| Entorno | Base URL | OAuth2 Token URL |
| :--- | :--- | :--- |
| **Staging / Sandbox** | `https://sb-pro.skydropx.com/api/v1` | `https://sb-pro.skydropx.com/api/v1/oauth/token` |
| **Producción** | `https://app.skydropx.com/api/v1` | `https://app.skydropx.com/api/v1/oauth/token` |

### Flujo de Autenticación OAuth2
1. `POST /api/v1/oauth/token` con payload `{"grant_type": "client_credentials", "client_id": "...", "client_secret": "..."}`.
2. Retorna `access_token` con expiración de 7200s (2 horas).
3. `SkydropxClient` almacena el token en la caché de Django (`cache.set`) con un margen de seguridad de 5 minutos.
4. Las llamadas subsiguientes envían `Authorization: Bearer <access_token>`. Ante un `401 Unauthorized`, el cliente invalida la caché y reintenta automáticamente.

---

## 4. Especificación de Endpoints REST (Ms Ambar API)

### 4.1. Lookup y Autocompletado de Código Postal
- **Endpoint:** `GET /api/shop/shipping/postal-code/<postal_code>/`
- **Permisos:** Público (`AllowAny`)
- **Respuesta Exitosa (200 OK):**
```json
{
  "valid": true,
  "postal_code": "83100",
  "state_name": "Sonora",
  "state_iso": "SO",
  "country": "MX"
}
```

---

### 4.2. Cotización de Tarifas Multi-Carrier en Tiempo Real
- **Endpoint:** `POST /api/shop/shipping/quote/`
- **Permisos:** Público (`AllowAny`)
- **Payload:**
```json
{
  "postal_code": "83100",
  "weight_kg": 1.0
}
```
- **Respuesta Exitosa (200 OK):**
```json
{
  "origin_postal_code": "83150",
  "dest_postal_code": "83100",
  "rates": [
    {
      "id": "dc35dac7-2f1a-408b-91fa-17be8a3729eb",
      "provider": "Paquetexpress",
      "service_level_name": "Nacional Sin Recolección",
      "total_price": 168.96,
      "currency": "MXN",
      "days": "1 días hábiles",
      "is_fallback": false
    },
    {
      "id": "ee72d9ef-01c3-49e1-a619-08b8f45dadb8",
      "provider": "DHL",
      "service_level_name": "Standard",
      "total_price": 185.52,
      "currency": "MXN",
      "days": "1 días hábiles",
      "is_fallback": false
    },
    {
      "id": "794f7503-f7f3-4a44-b786-6e1421519fb8",
      "provider": "Estafeta",
      "service_level_name": "Servicio Express",
      "total_price": 204.02,
      "currency": "MXN",
      "days": "1 días hábiles",
      "is_fallback": false
    }
  ]
}
```

---

### 4.3. Creación de Orden y Checkout
- **Endpoint:** `POST /api/shop/checkout/`
- **Permisos:** Público (`AllowAny`)
- **Payload:**
```json
{
  "email": "cliente@ejemplo.com",
  "full_name": "Juan Pérez",
  "phone": "6621234567",
  "postal_code": "83100",
  "state": "Sonora",
  "city": "Hermosillo",
  "suburb": "Centro",
  "street_and_number": "Calle Juárez 123",
  "country": "México",
  "shipping_rate_id": "dc35dac7-2f1a-408b-91fa-17be8a3729eb",
  "shipping_amount": 168.96,
  "shipping_provider": "Paquetexpress",
  "items": [
    {
      "product_id": 1,
      "quantity": 2
    }
  ]
}
```
- **Respuesta (201 Created):**
```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_live_...",
  "order_id": 18
}
```

---

### 4.4. Emisión de Guías y Descuento de Saldo (Fulfillment Post-Stripe)
Cuando el webhook de Stripe confirma el pago de la orden:
1. `generate_shipping_label(order)` llama a `POST /api/v1/shipments` con el `rate_id` seleccionado:
   ```json
   {
     "shipment": {
       "rate_id": "dc35dac7-2f1a-408b-91fa-17be8a3729eb",
       "printing_format": "standard",
       "sync_label_creation": true,
       "unique_shipment": true
     }
   }
   ```
2. Skydropx emite la guía oficial y **deduce automáticamente el costo del saldo/créditos de la cuenta (`payment_status: paid`)**.
3. Se almacena el `tracking_number`, `tracking_url` y `label_url` oficial.
4. El backend descarga una copia local del PDF en `MEDIA_ROOT/shipping_labels/guia_pedido_{order.id}.pdf`.
5. Se envía el correo de confirmación al comprador con la información del transportista y enlace a su guía.

---

### 4.5. Webhook de Actualización de Tracking (Skydropx)
- **Endpoint:** `POST /api/shop/webhook/skydropx/`
- **Headers soportados:**
  - `X-Skydropx-Token: <SKYDROPX_WEBHOOK_SECRET>`
  - `X-Skydropx-Signature: <HMAC_SHA256>`
  - `Authorization: Token token=<SKYDROPX_WEBHOOK_SECRET>`
- **Comportamiento:**
  - Eventos de tránsito (`tracking.updated`, `in_transit`) ➔ `order.status = 'shipped'`.
  - Eventos de entrega (`shipment.delivered`, `delivered`) ➔ `order.status = 'delivered'`.

---

## 5. Herramientas de Diagnóstico y Monitoreo (CLI)

### Diagnóstico de Conexión y Cotización en Vivo
Ejecuta el comando de gestión para probar el handshake OAuth2, la cotización de tarifas y el saldo disponible:

```bash
# Probar Staging / Sandbox
docker exec -it ambar_staging_backend python manage.py check_skydropx --dest-cp 83100 --env staging

# Probar Producción
docker exec -it ambar_staging_backend python manage.py check_skydropx --dest-cp 83100 --env production

# Sondeo exploratorio de todos los gateways OAuth2
docker exec -it ambar_staging_backend python manage.py check_skydropx --probe
```

### Ejemplo de Salida Exitosa del Diagnóstico:
```
=== 📦 DIAGNÓSTICO DE CONEXIÓN SKYDROPX PRO (MS AMBAR) ===
• Entorno Evaluado:      STAGING
• Endpoint Activo:       https://sb-pro.skydropx.com/api/v1
• OAuth2 Token URL:      https://sb-pro.skydropx.com/api/v1/oauth/token
• API Key (Client ID):   vWWDX0IJ...STjU
• API Secret Presente:   Sí
• Dirección de Origen:   Blvd. Kino 456, Pitic, Hermosillo, SO (CP 83150)
• CP de Destino Test:    83100

⏳ Verificando autenticación OAuth2 y cotizando en Skydropx Pro...
• Handshake OAuth2:      ✅ Exitoso (Bearer Token Adquirido)
• Latencia:              6248 ms
• Código HTTP:           200
• Saldo / Créditos:      {'balance': 1000.0, 'currency': 'MXN'}

✅ CONEXIÓN EXITOSA CON SKYDROPX PRO (9 transportistas encontrados):
   [1] Paquetexpress (Nacional Sin Recolección) -> $168.96 MXN (Entrega: 1 días hábiles)
   [2] DHL (Standard) -> $185.52 MXN (Entrega: 1 días hábiles)
   [3] Estafeta (Servicio Express) -> $204.02 MXN (Entrega: 1 días hábiles)
   [4] Paquetexpress (Nacional) -> $213.15 MXN (Entrega: 3 días hábiles)
   [5] Paquetexpress (Express Next Day) -> $229.39 MXN (Entrega: 1 días hábiles)
   [6] Paquetexpress (Express Second Day) -> $229.39 MXN (Entrega: 2 días hábiles)
   [7] UPS (Express Saver) -> $250.87 MXN (Entrega: 1 días hábiles)
   [8] DHL (Express) -> $383.23 MXN (Entrega: 1 días hábiles)
   [9] FedEx (Express Saver) -> $500.74 MXN (Entrega: 2 días hábiles)

🎉 Tu integración con Skydropx Pro está lista, cotizando y apta para emitir guías descontando saldo.
```
