# MS AMBAR - Taquilla Digital

Proyecto para la venta de boletos del tour de la artista MS AMBAR, con renderizado de asientos de teatro e integración con Stripe.

## Estructura del Proyecto

- `backend/`: Django REST Framework API.
  - Gestión de eventos, teatros y asientos.
  - Integración con Stripe Webhooks.
  - Generación de códigos QR y entrega vía Email/WhatsApp/Telegram.
- `frontend/`: Next.js Web App.
  - Mapa de asientos interactivo con Framer Motion.
  - Proceso de checkout fluido.
  - Vista de boleto digital.

## Configuración y Ejecución

1. **Requisitos:**
   - Docker y Docker Compose.

2. **Pasos:**
   - Clonar el repositorio.
   - El archivo `.env` ya contiene las credenciales de Stripe necesarias.
   - Ejecutar el proyecto:
     ```bash
     docker-compose up --build
     ```

3. **URLs:**
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:8000/api`
   - Admin Django: `http://localhost:8000/admin`

## Funcionalidades Implementadas

- [x] Selección de asientos en tiempo real.
- [x] Integración con Stripe Checkout Sessions.
- [x] Generación de códigos QR únicos por boleto.
- [x] Lógica de envío multicanal (Email, WhatsApp, Telegram).
- [x] Diseño premium con modo oscuro y animaciones fluidas.
