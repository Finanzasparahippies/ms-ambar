# MS AMBAR — Plataforma Inmersiva & Taquilla Digital

```
   __/\__
  \      /
  /_  _  _\  MS AMBAR — TOUR OFICIAL 2026
    \/      Fusión de Luz, Sonido y Escenografía Modular
```

MS AMBAR es una plataforma digital de vanguardia diseñada para la venta de boletos, reserva de experiencias exclusivas y difusión artística del tour oficial 2026. Combina una landing page inmersiva, un visualizador interactivo de teatros y asientos en tiempo real, pasarelas de pago fluidas con Stripe y una consola de simulación acústico-lumínica.

---

## 🏗️ Arquitectura & Stack Tecnológico

El proyecto está diseñado bajo una arquitectura desacoplada utilizando contenedores Docker para garantizar consistencia entre los entornos de desarrollo, staging y producción.

### 💻 Frontend (Next.js App)
- **Framework**: Next.js 14 (React) con TypeScript.
- **Estilos**: TailwindCSS con un sistema de diseño oscuro de alta gama basado en tonos ámbar y miel (`#FFBF00`).
- **Animaciones**: Framer Motion para transiciones fluidas de página e inmersión de modales.
- **Interactividad**: HTML5 Canvas para constelaciones dinámicas y **Web Audio API** para síntesis de sonido analógico virtual en el modulador de la página de inicio.
- **Ubicación**: [/frontend](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend)

### ⚙️ Backend (Django REST Framework)
- **Framework**: Django 5 + Django REST Framework.
- **Base de Datos**: PostgreSQL 16 (Alpine).
- **Envío de Correos**: Sistema de envío con failover automatizado (Brevo SMTP -> Amazon SES SMTP -> Zoho Mail) para notificaciones de compra, contratos de booking y boletines oficiales.
- **Pagos**: Pasarela e integración de Webhooks con **Stripe API** (Modos Live y Test).
- **Ubicación**: [/backend](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/backend)

---

## 📁 Estructura del Repositorio

```
ms-ambar/
├── backend/                  # Código fuente de Django API
│   ├── apps/                 # Aplicaciones Django (blog, bookings, tickets, users...)
│   └── config/               # Configuración central del proyecto (settings.py, urls.py)
├── frontend/                 # Aplicación Web Next.js
│   ├── src/
│   │   ├── components/       # Componentes reusables (Navbar, Layout, SeatingChart...)
│   │   ├── pages/            # Enrutador de páginas (index, tour, blog, contact...)
│   │   └── styles/           # CSS global y tokens de estilo
├── docker/                   # Archivos de configuración para entornos Docker
├── nectar.sh                 # CLI de Nectar Labs para orquestar contenedores
├── docker-compose.yml        # Configuración de Docker Compose (Desarrollo)
├── docker-compose.staging.yml # Configuración de Docker Compose (Staging)
└── README.md                 # Documento principal
```

---

## 🕹️ CLI de Nectar Labs (`nectar.sh`)

Para simplificar las tareas de desarrollo y despliegue, hemos desarrollado una interfaz de comandos de terminal interactiva (`nectar.sh`).

### Comandos de Desarrollo
```bash
./nectar.sh dev             # Inicia el entorno local con reconstrucción de imágenes
./nectar.sh stop            # Detiene y limpia los contenedores locales
./nectar.sh restart         # Reinicia los contenedores de desarrollo
./nectar.sh logs            # Muestra los logs en tiempo real
./nectar.sh migrate         # Aplica las migraciones de base de datos
./nectar.sh createsuperuser # Crea un administrador de Django
./nectar.sh frontend        # Arranca el servidor Next.js local (fuera de Docker)
```

### Comandos de Staging (Hetzner)
```bash
./nectar.sh build-staging        # Construye las imágenes Docker para Staging
./nectar.sh up-staging           # Levanta el entorno Staging (con variables .env.staging)
./nectar.sh down-staging         # Detiene el entorno de Staging
./nectar.sh migrate-staging      # Aplica migraciones en el contenedor de Staging
./nectar.sh createsuperuser-staging # Crea administrador en Staging
```

---

## 🎨 Sistema de Diseño & Estética (Nectar Labs Premium)

El sitio web está regido por una estética nocturna inmersiva que busca conectar la luz con la acústica:

1. **Brillo de Estrellas Nocturnas**: Se duplicó el resplandor de las estrellas de fondo (`opacity: 0.30` en [globals.css](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/styles/globals.css)) para simular un cielo estrellado y elegante sobre el fondo degradado oscuro (`#0b0d17` a `#05060b`).
2. **Paleta de Colores**:
   - `amber-honey`: `#FFBF00` (Foco principal, glows, enlaces y botones de acción)
   - `amber-cognac`: `#9F2B00` (Degradados de transición y bordes sutiles)
   - `nature-night`: `#0B0D17` (Fondos de tarjetas y contenedores glassmorphic)
3. **Tipografía**: Fuente premium `Outfit` combinada con `Inter` para jerarquías tipográficas claras y vanguardistas.

---

## ⚡ Nodos del Hero Responsivos al Mouse

La sección Hero de la página de inicio incluye una red de nodos y constelaciones interactivas que responden a la posición del mouse del usuario sobre el viewport. Esta red está desarrollada de forma nativa en un componente HTML5 Canvas optimizado para no sobrecargar el hilo principal de renderizado de la web.

👉 **Para conocer los algoritmos, fórmulas de atracción y optimizaciones utilizadas en este fondo interactivo, consulta la guía técnica:** [README-HERO-NODES.md](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/README-HERO-NODES.md)

---

## 📧 Motor de Newsletter & Failover SMTP

El sistema de boletines y newsletter está completamente automatizado a nivel backend:
- Al registrarse un correo en [index.tsx](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/pages/index.tsx), la API almacena el correo en el modelo `NewsletterSubscriber` y dispara automáticamente un correo de bienvenida estilizado en HTML.
- **Configuración SMTP con Failover**: Enrutamiento automático que intenta enviar primero mediante Brevo (hasta agotar el límite diario de 300 correos), luego mediante Amazon SES (con el remitente verificado `hola@msambar.com`), y finalmente recurre a Zoho Mail como último recurso de failover.
- **Desuscripción Segura**: Cada correo enviado incluye un enlace de desuscripción directo en el pie de página. Al hacer clic, redirige al usuario a la página del Blog, lee el parámetro `?unsubscribe=correo@email.com` y ejecuta una petición `POST` al endpoint de desuscripción de la API para desactivar la suscripción de forma transparente.
