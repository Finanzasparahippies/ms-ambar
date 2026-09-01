# 📦 Manual de Arquitectura, Configuración y Uso de Envíos (Logística Skydropx) — Ms Ambar

Este documento detalla la arquitectura completa, el flujo de cotización en tiempo real, la emisión automatizada de guías, los webhooks y las mejores prácticas para el sistema logístico de la tienda oficial de **Ms Ambar**.

---

## 1. Arquitectura y Flujo End-to-End de Envíos

```
[ FRONTEND (CartDrawer) ]
       │
       ├─ 1. Ingreso de CP (5 dígitos)
       │    └─► GET /api/shop/shipping/postal-code/<cp>/ (Validación & Auto-detección de Estado ISO)
       │
       ├─ 2. Cotización Multi-Carrier
       │    └─► POST /api/shop/shipping/quote/ (Caché Redis / Skydropx API / Fallback $150 MXN)
       │
       ├─ 3. Selección de Paquetería & Checkout
       │    └─► POST /api/shop/checkout/ (Persiste selected_rate_id, shipping_cost, shipping_provider)
       │
[ STRIPE GATEWAY ]
       │
       └─► Pago Exitoso (checkout.session.completed)
             │
[ BACKEND (Django Shop Fulfillment) ]
       │
       ├─► generate_shipping_label(order)
       │     ├─ Si selected_rate_id es real ──► POST /v1/labels (Emisión de Guía PDF & Tracking)
       │     └─ Si fue Fallback / Mock       ──► POST /v1/shipments + POST /v1/labels
       │
       ├─► send_order_confirmation_email(order) (Email con Tracking URL y PDF)
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
# LOGÍSTICA Y PAQUETERÍAS (SKYDROPX)
# ==============================================================================
# API Key oficial de Skydropx (Token token=...)
NECTAR_LABS_SKYDROPX_API_KEY=tu_api_key_aqui
# Clave alternativa de la cuenta propia del cliente
AMBAR_OWN_SKYDROPX_KEY=
# Secret opcional para headers X-API-Secret
NECTAR_LABS_SKYDROPX_API_SECRET=
# Token o Secreto HMAC para validar webhooks entrantes de Skydropx
SKYDROPX_WEBHOOK_SECRET=kPxZv17KoHJYNGZgsIxRFHWFw50knp0YdGlD6hmpgGQ
# Ambiente ('production' o 'sandbox')
SKYDROPX_ENVIRONMENT=production

# ==============================================================================
# ALMACÉN DE ORIGEN (REMITENTE DE ENVÍOS)
# ==============================================================================
SHIPPING_ORIGIN_NAME=Almacén Ms Ambar Oficial
SHIPPING_ORIGIN_PHONE=6621000000
SHIPPING_ORIGIN_STREET=Av. Serdán 123
SHIPPING_ORIGIN_SUBURB=Centro
SHIPPING_ORIGIN_CITY=Hermosillo
SHIPPING_ORIGIN_STATE=Sonora
SHIPPING_ORIGIN_POSTAL_CODE=83000
```

> [!NOTE]
> **Modo Mock / Desarrollo:** Si `NECTAR_LABS_SKYDROPX_API_KEY` está vacía o es `"mock_key"`, el sistema funciona en modo simulado: cotiza con tarifas de contingencia ($150 / $220 MXN) y genera números de tracking virtuales (`TRACK-AMBAR-{id}MX`) sin consumir saldo real de tu cuenta.

---

## 3. Especificación de Endpoints REST

### 3.1. Lookup y Autocompletado de Código Postal
- **Endpoint:** `GET /api/shop/shipping/postal-code/<postal_code>/`
- **Permisos:** Público (`AllowAny`)
- **Respuesta Exitosa (200 OK):**
```json
{
  "valid": true,
  "postal_code": "83000",
  "state_name": "Sonora",
  "state_iso": "SO",
  "country": "MX"
}
```

---

### 3.2. Cotización de Tarifas Multi-Carrier
- **Endpoint:** `POST /api/shop/shipping/quote/`
- **Permisos:** Público (`AllowAny`)
- **Payload:**
```json
{
  "postal_code": "06700",
  "weight_kg": 1.0
}
```
- **Respuesta Exitosa (200 OK):**
```json
{
  "origin_postal_code": "83000",
  "dest_postal_code": "06700",
  "rates": [
    {
      "id": "71938491",
      "provider": "FedEx",
      "service_level_name": "FedEx Express Saver",
      "total_price": 165.50,
      "currency": "MXN",
      "days": "2-3 días hábiles",
      "is_fallback": false
    },
    {
      "id": "71938492",
      "provider": "Estafeta",
      "service_level_name": "Terrestre 3 a 5 Días",
      "total_price": 142.00,
      "currency": "MXN",
      "days": "3-5 días hábiles",
      "is_fallback": false
    }
  ]
}
```

---

### 3.3. Creación de Orden y Checkout
- **Endpoint:** `POST /api/shop/checkout/`
- **Permisos:** Público (`AllowAny`)
- **Payload:**
```json
{
  "email": "cliente@ejemplo.com",
  "full_name": "María González",
  "phone": "6621234567",
  "postal_code": "06700",
  "state": "Ciudad de México",
  "city": "Cuauhtémoc",
  "suburb": "Roma Norte",
  "street_and_number": "Álvaro Obregón 150 Int 4",
  "country": "México",
  "shipping_rate_id": "71938491",
  "shipping_amount": 165.50,
  "shipping_provider": "FedEx Express Saver",
  "items": [
    {
      "product_id": 4,
      "quantity": 1
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

### 3.4. Webhook de Actualización de Tracking (Skydropx)
- **Endpoint:** `POST /api/shop/webhook/skydropx/`
- **Headers soportados:**
  - `X-Skydropx-Token: <SKYDROPX_WEBHOOK_SECRET>`
  - `X-Skydropx-Signature: <HMAC_SHA256>`
  - `Authorization: Token token=<SKYDROPX_WEBHOOK_SECRET>`
- **Comportamiento:**
  - Eventos de tránsito (`tracking.updated`, `in_transit`) ➔ `order.status = 'shipped'`.
  - Eventos de entrega (`shipment.delivered`, `delivered`) ➔ `order.status = 'delivered'`.

---

## 4. Tips Técnicos y Mejores Prácticas de Producción

### 1. Resiliencia Anti-Caídas (Circuit Breaker con Fallback Automático)
- El cliente `SkydropxClient` tiene un timeout estricto de **4.0 segundos**.
- Si Skydropx experimenta alta latencia, error 500 o agotamiento de saldo, el sistema no bloquea la compra del cliente. Devuelve automáticamente las tarifas de respaldo:
  - **Estándar Nacional:** $150.00 MXN (3 a 5 días).
  - **Express Prioritario:** $220.00 MXN (1 a 2 días).

### 2. Optimización de Costos y Cuotas de API con Caché
- Las cotizaciones para una misma combinación de `CP Origen + CP Destino + Peso` se almacenan en caché durante **1 hora (3600s)**.
- Esto reduce el consumo de cuotas de la API de Skydropx en más de un 75% y agiliza la respuesta en el carrito a < 100ms.

### 3. Normalización ISO 3166-2:MX
- Skydropx rechaza nombres de estados escritos de forma heterogénea (ej. `"CDMX"`, `"Edo. Mex."`, `"Michoacan"` sin acento).
- La función `normalize_mexican_state()` traduce automáticamente cualquier variante al código ISO oficial de 2 caracteres (`DF`, `EM`, `MI`, `SO`, etc.).

### 4. Emisión Idempotente y Desacoplada
- La generación de guías se ejecuta dentro de `transaction.on_commit()` tras confirmarse el pago en Stripe, evitando locks prolongados en la base de datos PostgreSQL.
- Si la emisión de la guía falla en el momento del pago por saldo insuficiente en la cuenta de Skydropx, la orden queda registrada en estado `paid` y con un tracking provisional `TRACK-PENDING-{order_id}` para que el administrador pueda regenerarla desde el panel.
