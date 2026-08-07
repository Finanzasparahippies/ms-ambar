# 🌌 MS AMBAR — Plataforma Inmersiva & Taquilla Digital de Alto Rendimiento

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Django REST](https://img.shields.io/badge/Django_REST-5.0-092E20?style=for-the-badge&logo=django)](https://www.django-rest-framework.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)
[![Stripe](https://img.shields.io/badge/Stripe-API_Integrated-6772E5?style=for-the-badge&logo=stripe)](https://stripe.com/)
[![Jest](https://img.shields.io/badge/Jest-Tested-C21325?style=for-the-badge&logo=jest)](https://jestjs.io/)
[![Performance](https://img.shields.io/badge/Performance-60_FPS_Target-00C853?style=for-the-badge)](https://web.dev/vitals/)

```
   __/\__
  \      /    MS AMBAR — TOUR OFICIAL 2026
  /_  _  _\   Fusión de Luz, Sonido y Escenografía Modular
    \/        Plataforma Inmersiva Multi-tenant por Nectar Labs
```

Documentación técnica oficial del ecosistema digital **MS AMBAR**. Este repositorio contiene la arquitectura completa del sistema de taquilla digital, difusión artística, gestión de contenidos místicos, boletines automatizados con resiliencia SMTP y consolas de rendimiento en tiempo real.

---

## 📋 Índice de Navegación

1. [📌 Visión General & Propuesta de Valor](#-visión-general--propuesta-de-valor)
2. [🏛️ Arquitectura del Sistema & Flujo de Datos](#️-arquitectura-del-sistema--flujo-de-datos)
3. [🗺️ Mapeo Exhaustivo de Vistas y Componentes Frontend](#️-mapeo-exhaustivo-de-vistas-y-componentes-frontend)
4. [⚙️ Arquitectura Backend & Patrones de Diseño Django](#️-arquitectura-backend--patrones-de-diseño-django)
5. [⚡ Ingeniería de Rendimiento & Gestión de Recursos (Guía 60 FPS)](#-ingeniería-de-rendimiento--gestión-de-recursos-guía-60-fps)
   - [5.1 Renderizado de Partículas de Alto Rendimiento (`CanvasParticles`)](#51-renderizado-de-partículas-de-alto-rendimiento-canvasparticles)
   - [5.2 Gestión y Control de Audio Desacoplado](#52-gestión-y-control-de-audio-desacoplado)
   - [5.3 Aislamiento de Widgets, IFrames & Resiliencia con `IframeErrorBoundary`](#53-aislamiento-de-widgets-iframes--resiliencia-con-iframeerrorboundary)
6. [🎨 Sistema de Diseño Dinámico & Aislamiento CSS Custom Properties](#-sistema-de-diseño-dinámico--aislamiento-css-custom-properties)
7. [🛡️ Buenas Prácticas de Mantenibilidad & Tipado Estricto](#️-buenas-prácticas-de-mantenibilidad--tipado-estricto)
8. [🧪 Suite de Pruebas Automatizadas (Django & Jest)](#-suite-de-pruebas-automatizadas-django--jest)
9. [🚀 Guía de Instalación, Operación y Despliegue (`nectar.sh`)](#-guía-de-instalación-operación-y-despliegue-nectarsh)
10. [🔧 Troubleshooting / Diagnóstico Común (FAQ)](#-troubleshooting--diagnóstico-común-faq)
11. [🤝 Políticas de Contribución Nectar Labs](#-políticas-de-contribución-nectar-labs)

---

## 📌 Visión General & Propuesta de Valor

**MS AMBAR** es una plataforma digital de vanguardia desarrollada para la cantautora sonorense Ms. Ambar. La plataforma trasciende el concepto tradicional de landing page al integrar:

- **Experiencia Inmersiva & Partículas Dinámicas**: Renderizado continuo a 60 FPS con morfeos geométricos y simulación lumínico-acústica nativa en HTML5 Canvas.
- **Taquilla Digital Interactiva**: Selección de asientos en tiempo real mediante mapas vectoriales SVG/Canvas con cálculo dinámico de recargos e integración directa con **Stripe Checkout API**.
- **Desglose Financiero Gross-Up**: Opción para transferir las comisiones bancarias y de pasarela (3.6% + $3.00 MXN) al comprador, asegurando que la producción reciba el 100% de la venta neta.
- **Motor de Boletines & Failover SMTP**: Sistema automatizado de correos con failover multicanal (Brevo SMTP ➔ Amazon SES SMTP ➔ Zoho Mail) y desuscripción en un solo clic por URL.
- **Resiliencia & Tematización Granular**: Control centralizado del sistema visual por sección con variables CSS dinámicas y arquitectura multi-tenant.

---

## 🏛️ Arquitectura del Sistema & Flujo de Datos

El sistema adopta una **arquitectura desacoplada** orquestada mediante contenedores Docker:

```mermaid
graph TD
    Client[📱 Cliente Web / Next.js 14] -->|HTTPS / REST API| Django[⚙️ Backend Django REST API]
    Client -->|Canvas 2D / 60 FPS| LocalGPU[💻 GPU / Browser Engine]
    Client -->|Audio Previews| AudioStream[🎵 Web Audio API / HTML5 Audio]
    
    Django -->|PostgreSQL 16| DB[(🗄️ Base de Datos Postgres)]
    Django -->|Stripe SDK| Stripe[💳 Pasarela de Pagos Stripe]
    Django -->|Failover Mailer| SMTP{📧 SMTP Failover Engine}
    
    SMTP -->|Primary| Brevo[Brevo API / SMTP]
    SMTP -->|Secondary| SES[Amazon SES]
    SMTP -->|Fallback| Zoho[Zoho Mail]
    
    Subscribers[📩 Suscriptores] <-- Emails Html -- SMTP
```

---

## 🗺️ Mapeo Exhaustivo de Vistas y Componentes Frontend

A continuación se detalla cada vista implementada en `frontend/src/pages/`, su propósito, jerarquía de componentes hijos y patrones visuales aplicados:

| Ruta | Archivo Fuente | Propósito de la Vista | Componentes Hijos Clave | Patrones y Lógica Aplicada |
| :--- | :--- | :--- | :--- | :--- |
| `/` | [`index.tsx`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/pages/index.tsx) | Landing Page principal inmersiva. Muestra la narrativa artística, biografía oficial, modulador sintético y captador de suscripciones. | [`CanvasParticles`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/CanvasParticles.tsx), [`Navbar`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/Navbar.tsx), [`ThemedSection`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/ThemedSection.tsx), [`TourTimeline`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/TourTimeline.tsx), [`Layout`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/Layout.tsx) | Morfeo de partículas (`shape="moon"` / `"sun"`), sintesis analógica con Web Audio API, envío de newsletter con failover. |
| `/ambar-te-escribe` | [`ambar-te-escribe.tsx`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/pages/ambar-te-escribe.tsx) | Módulo íntimo y místico. Tiradas de cartas de tarot interactivas, reflexiones personales y correspondencia exclusiva. | [`ThemedSection`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/ThemedSection.tsx), [`CanvasParticles`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/CanvasParticles.tsx), Modal Reader Drawer | Efectos 3D Flip con CSS transform en tarjetas, consumo de endpoints de tarot `/tickets/tarot/`, animaciones de revelación. |
| `/contacto` | [`contacto.tsx`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/pages/contacto.tsx) | Canal oficial de contratación (booking), prensa y mensaje directo de fans. | [`ThemedSection`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/ThemedSection.tsx), Formulario React Validado, Toasts de notificación | Validación estricta de campos, prevención de dobles clics con estado `loading`, integración con endpoints de booking. |
| `/blog` | [`blog.tsx`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/pages/blog.tsx) | Hub de publicaciones artísticas, detrás de cámaras y anuncios oficiales. | [`ThemedSection`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/ThemedSection.tsx), [`CouponManager`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/CouponManager.tsx), Post Modal Grid | Filtrado dinámico por categorías, procesamiento automático de desuscripción mediante URL param `?unsubscribe=email`. |
| `/musica` | [`musica.tsx`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/pages/musica.tsx) | Discografía interactiva con lanzamientos, playlists oficiales y vídeos de YouTube. | [`ThemedSection`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/ThemedSection.tsx), `IframeErrorBoundary`, Audio Player Bar | Reproducción de previews de 30s con `audioRef`, aislamiento de reproductores Spotify/YouTube dentro de Error Boundaries. |
| `/comprar-boletos` | [`comprar-boletos.tsx`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/pages/comprar-boletos.tsx) | Taquilla digital con mapa interactivo de recintos y Checkout Stripe. | [`SeatingChart`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/SeatingChart.tsx), [`CouponManager`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/CouponManager.tsx), [`ThemedSection`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/ThemedSection.tsx) | Zoom/pan interactivo en Canvas SVG de asientos, cálculo dinámico Gross-Up de comisiones de Stripe, integración con cupones. |
| `/galeria` | [`galeria.tsx`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/pages/galeria.tsx) | Galería fotográfica inmersiva de recitales, backstage y arte conceptual. | [`ImageOptimizerWidget`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/ImageOptimizerWidget.tsx), Lightbox Modal, Masonry Grid | Carga perezosa (*lazy loading*), pre-renderizado de imágenes en resolución óptima y navegación por teclado en Lightbox. |
| `/dashboard` | [`dashboard/index.tsx`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/pages/dashboard/index.tsx) | Consola administrativa para control de ventas, suscriptores y personalización. | [`PerformanceHUD`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/PerformanceHUD.tsx), Tabs de configuración de tema, Tablas de métricas | Control del patrón Singleton de `SiteSettings`, métricas financieras en tiempo real y escáner de boletos QR (`scan-tickets.tsx`). |

---

## ⚙️ Arquitectura Backend & Patrones de Diseño Django

El backend está estructurado modularmente en `backend/apps/` siguiendo las directrices de Django 5 y Django REST Framework:

### Aplicaciones del Sistema (`apps/`)

- **`tickets`**: Contiene la lógica de eventos, mapa de recintos, asientos (`Seat`), compras (`TicketOrder`), cupones y el modelo global **`SiteSettings`**.
- **`blog`**: Gestión de entradas de blog, categorías y suscriptores de la newsletter (`NewsletterSubscriber`). Incluye el backend con failover SMTP (`test_failover_backend.py`).
- **`music`**: Modelos para discos, sencillos, canciones con previews de audio y sincronización con Spotify API (`Album`, `Track`, `Playlist`).
- **`bookings`**: Gestión de solicitudes de contratación para conciertos privados o corporativos.
- **`gallery`**: Álbumes y fotografías clasificadas con almacenamiento de metadatos multimedia.
- **`performance`**: Registro y auditoría de eventos de rendimiento reportados por el cliente.
- **`users`**: Autenticación JWT personalizada, roles de staff y permisos.

### Patrón Singleton (`SiteSettings`)

Para garantizar que solo exista una instancia activa de la configuración visual y operacional del sitio en todo el sistema, el modelo `SiteSettings` en [`backend/apps/tickets/models.py`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/backend/apps/tickets/models.py) fuerza su clave primaria a `1`:

```python
class SiteSettings(models.Model):
    # Campos de configuración de tema, biografía y comisiones...
    
    def save(self, *args, **kwargs):
        """Forzar siempre pk=1 (Singleton) y purgar la instancia previa."""
        self.pk = 1
        super().save(*args, **kwargs)
```

Al exponer la API REST vía `/api/tickets/theme/`, el frontend recibe la configuración consolidada que gobierna colores, figuras de partículas y comisiones.

---

## ⚡ Ingeniería de Rendimiento & Gestión de Recursos (Guía 60 FPS)

Para lograr y mantener **60 FPS constantes** en ordenadores de escritorio y dispositivos móviles, el proyecto aplica optimizaciones de bajo nivel en el motor de renderizado y en la gestión de memoria del navegador.

### 5.1 Renderizado de Partículas de Alto Rendimiento (`CanvasParticles`)

El componente [`CanvasParticles.tsx`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/CanvasParticles.tsx) implementa múltiples capas de optimización matemática y de memoria:

#### 1. Ciclo de Animación & Limpieza Estricta
El bucle principal utiliza `requestAnimationFrame` para sincronizarse con la tasa de refresco del monitor. Al desmontar el componente, se cancela inmediatamente el frame para prevenir fugas de memoria (*memory leaks*):

```typescript
useEffect(() => {
  let animationFrameId: number = 0;
  
  const draw = () => {
    // Cálculo de física y dibujado de partículas...
    animationFrameId = requestAnimationFrame(draw);
  };
  
  draw();
  
  return () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', handleResize);
  };
}, [activeDensity, activeTarget]);
```

#### 2. Capping Adaptativo de Device Pixel Ratio (DPR)
Limitar la resolución de renderizado en pantallas HiDPI/Retina evita el sobrecalentamiento de la GPU y la pérdida de frames en dispositivos móviles:

```typescript
const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
// Limitar DPR a 1.25x en móviles y 2.0x en escritorio
const dpr = Math.min(rawDpr, isMobile ? 1.25 : 2);

canvas.width = Math.floor(width * dpr);
canvas.height = Math.floor(height * dpr);
```

#### 3. Reducción de Densidad Adaptativa por Dispositivo
En smartphones o pantallas menores a 768px, se reduce automáticamente la cantidad de partículas sin degradar la intención artística:

```typescript
const numParticles = isMobile ? Math.max(10, Math.round(baseDensity * 0.35)) : baseDensity;
```

#### 4. Dibujado por Pasadas (*Path Batching*)
En lugar de invocar `ctx.beginPath()`, `ctx.arc()` y `ctx.fill()` individualmente por cada partícula (lo cual genera cientos de llamadas costosas a la API del Canvas por frame), las partículas se agrupan en **2 únicas pasadas de dibujado**:

```typescript
// Pasada 1: Partículas primarias en 1 solo batch
ctx.fillStyle = fillPrimary;
ctx.beginPath();
for (let i = 0; i < particles.length; i += 2) {
  const p = particles[i];
  ctx.moveTo(p.x + p.size, p.y);
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
}
ctx.fill();

// Pasada 2: Partículas secundarias en 1 solo batch
ctx.fillStyle = fillSecondary;
ctx.beginPath();
for (let i = 1; i < particles.length; i += 2) {
  const p = particles[i];
  ctx.moveTo(p.x + p.size, p.y);
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
}
ctx.fill();
```

#### 5. Aislamiento y Reseteo Limpio de Sombras
La aplicación de efectos de sombra (`shadowBlur`) en Canvas puede degradar severamente el rendimiento si se propaga involuntariamente a otros trazados. `CanvasParticles` restablece explícitamente el estado de sombra al terminar el dibujo:

```typescript
// Restablecer inmediatamente para evitar fugas de estilo y ralentización
ctx.shadowColor = 'transparent';
ctx.shadowBlur = 0;
```

#### 6. Cálculo de Conexiones por Distancia al Cuadrado
Para evitar ejecutar la costosa raíz cuadrada (`Math.sqrt`) en la verificación $O(N^2)$ de cercanía entre partículas, se compara directamente la **distancia al cuadrado**. Además, esta característica se deshabilita por completo en dispositivos móviles:

```typescript
if (!isMobile) {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < 14400) { // 120 * 120 (Evita Math.sqrt hasta confirmar umbral)
        const dist = Math.sqrt(distSq);
        // Dibujado de línea conectora...
      }
    }
  }
}
```

---

### 5.2 Gestión y Control de Audio Desacoplado

En [`musica.tsx`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/pages/musica.tsx), la reproducción de muestras de audio de 30 segundos se gestiona mediante una referencia desacoplada a la API nativa de `Audio()`:

- **Instanciación Nativa**: Se utiliza `useRef<HTMLAudioElement | null>(null)` para evitar renders innecesarios en la jerarquía de React durante el progreso del audio.
- **Limpieza de Recursos**: El hook de desmontaje detiene la reproducción activa y destruye la referencia:
  ```typescript
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  ```
- **Manejo Seguro de Autoplay**: Las llamadas a `audioRef.current.play()` están capturadas en bloques `.catch()` para prevenir interrupciones o excepciones si el navegador bloquea la reproducción automática no interactiva.

---

### 5.3 Aislamiento de Widgets, IFrames & Resiliencia con `IframeErrorBoundary`

Los reproductores embebidos de terceros (Spotify Playlists y vídeos de YouTube) están resguardados por un componente especial de React Error Boundary denominado `IframeErrorBoundary`:

```typescript
class IframeErrorBoundary extends React.Component<
  { children: React.ReactNode; title: string },
  { hasError: boolean }
> {
  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.warn('[IframeErrorBoundary] Error al renderizar reproductor embebido:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="amber-glass border border-amber-honey/20 p-8 rounded-[2.5rem] text-center">
          <h4 className="text-sm font-black text-white">Reproductor no disponible</h4>
          <p className="text-xs text-amber-honey/80">
            No se pudo cargar el reproductor para "{this.props.title}".
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Ventajas de esta arquitectura:**
1. **Prevención de Caídas**: Si un script o widget de Spotify/YouTube falla debido a bloqueo de adblockers o políticas CORS, la aplicación Web no se rompe y muestra un contenedor elegante de fallback.
2. **Lazy Loading Nativo**: Todos los iframes contienen el atributo `loading="lazy"` para diferir su carga hasta que entren en el viewport del usuario.

---

## 🎨 Sistema de Diseño Dinámico & Aislamiento CSS Custom Properties

El frontend utiliza una estrategia de **aislamiento de temas visuales por sección** impulsada por el componente [`ThemedSection.tsx`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/components/ThemedSection.tsx). 

En lugar de reescribir clases de Tailwind o modificar el DOM global, `ThemedSection` inyecta un mapa local de **CSS Custom Properties**:

```typescript
const customVars: Record<string, string> = {
  [`--sec-${sectionKey}-bg`]: bgColor,
  [`--sec-${sectionKey}-heading`]: headingColor,
  [`--sec-${sectionKey}-accent`]: accentColor,
  '--primary-color': accentColor,
  '--card-bg': cardBg,
  '--text-color': textColor,
};
```

Esto permite que cada sección (`hero`, `biography`, `musica`, `contacto`) pueda tener su propio esquema cromático y densidad de partículas sin colisionar con las demás secciones ni forzar re-renders masivos.

---

## 🛡️ Buenas Prácticas de Mantenibilidad & Tipado Estricto

En cumplimiento estricto con los estándares de desarrollo de **Nectar Labs**:

1. **Tipado Estricto de TypeScript**:
   - Prohibido el uso de `any` explícito en lógica de producción.
   - Definición de interfaces claras para modelos de la API (`AlbumItem`, `TrackItem`, `PlaylistItem`, `SeatZone`).
2. **Manejo Seguro de Nulos (*Null-Safety*)**:
   - Uso sistemático de encadenamiento opcional (`data?.user?.name`).
3. **Renderizado de Arreglos**:
   - Validación explícita de longitud (`albums.length > 0`) para evitar renderizar un `0` en la interfaz.
4. **Desacoplamiento de Efectos**:
   - Memorización de callbacks con `useCallback` para evitar loops de re-renderizado en listeners de eventos.
5. **Acciones de Backend Anti-Doble Clic**:
   - Los botones de acción de backend se deshabilitan inmediatamente (`disabled={loading}`) al ser presionados.

---

## 🧪 Suite de Pruebas Automatizadas (Django & Jest)

El proyecto cuenta con un conjunto integral de pruebas para validar tanto la lógica de negocio en el backend como la renderización en el frontend.

### Ejecución de Pruebas Backend (Django)

Para ejecutar la suite de pruebas del backend Django:

```bash
# Ejecutar todas las pruebas del backend en Docker
./nectar.sh test-backend

# O ejecutar manualmente en el entorno virtual
cd backend
python manage.py test apps.tickets.tests apps.blog.test_failover_backend apps.tickets.test_theme_customization
```

Las pruebas verifican:
- El patrón Singleton en `SiteSettings`.
- El failover automatizado del motor SMTP.
- La validación del motor de precios Gross-Up en Stripe.

### Ejecución de Pruebas Frontend (Jest & React Testing Library)

Para ejecutar la suite de pruebas unitarias y de integración del frontend:

```bash
# Ejecutar suite Jest en frontend
cd frontend
npm test

# Ejecutar pruebas en modo de observación (watch mode)
npm run test:watch
```

Ubicación de pruebas frontend en [`frontend/src/__tests__/`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/__tests__):
- `seatingBounds.test.ts`: Pruebas de límites de zoom/pan en la selección de asientos.
- `theme_customization_engine.test.tsx`: Verificación de inyección de variables CSS por sección.
- `music.test.tsx`: Pruebas de renderizado y desacoplamiento del reproductor de audio.
- `suscribirse.test.tsx`: Validación de formularios de suscriptores y notificaciones toast.

---

## 🚀 Guía de Instalación, Operación y Despliegue (`nectar.sh`)

El proyecto incluye el CLI interactivo [`nectar.sh`](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/nectar.sh) para simplificar las operaciones diarias.

### Entorno de Desarrollo Local

```bash
# 1. Iniciar los contenedores de desarrollo (Frontend, Backend, PostgreSQL)
./nectar.sh dev

# 2. Aplicar migraciones de base de datos
./nectar.sh migrate

# 3. Crear usuario administrador de Django
./nectar.sh createsuperuser

# 4. Ver logs en tiempo real
./nectar.sh logs

# 5. Detener el entorno local
./nectar.sh stop
```

### Entorno de Staging / Producción (Hetzner)

```bash
# Construir imágenes de staging
./nectar.sh build-staging

# Levantar entorno de staging
./nectar.sh up-staging

# Aplicar migraciones en staging
./nectar.sh migrate-staging
```

---

## 🔧 Troubleshooting / Diagnóstico Común (FAQ)

### 1. Conflictos de Migraciones Django por el Modelo Singleton (`SiteSettings`)
- **Síntoma**: Error `SiteSettings.DoesNotExist` o `IntegrityError: duplicate key value violates unique constraint` al ejecutar `migrate`.
- **Causa**: Múltiples fixtures o semillas intentando insertar registros con claves primarias distintas.
- **Solución**: Ejecutar el script de siembra oficial `./nectar.sh seed` o ejecutar en shell de Django:
  ```python
  from apps.tickets.models import SiteSettings
  SiteSettings.objects.get_or_create(pk=1)
  ```

### 2. Problemas CORS o Bloqueo en WebSockets / EventSource (SSE)
- **Síntoma**: Conexiones rechazadas en desarrollo al conectar el monitor de rendimiento o notificaciones.
- **Solución**: Asegúrate de que `.env` contenga los orígenes autorizados:
  ```env
  CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
  CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
  ```

### 3. Fallos o Incoherencias de Caché en Redis durante Hot-Reload
- **Síntoma**: Modificaciones en `SiteSettings` desde el Django Admin no se reflejan inmediatamente en el frontend.
- **Solución**: Reiniciar la caché en desarrollo ejecutando `./nectar.sh restart` o invalidando mediante la consola administrativa de Django.

### 4. Caída de Tasa de Frames (FPS) en Canvas de Partículas
- **Síntoma**: El indicador `PerformanceHUD` marca menos de 45 FPS.
- **Diagnóstico**: Verificar si el navegador tiene la **Aceleración por Hardware** deshabilitada en la configuración del sistema.
- **Mitigación**: El sistema reducirá automáticamente el DPR a `1.0` y la cantidad de partículas al detectar caídas en la tasa de refresco.

---

## 🤝 Políticas de Contribución Nectar Labs

1. **Ramas y Commits**: Todo cambio debe desarrollarse en una rama descriptiva (`feature/`, `fix/`, `refactor/`) y seguir la convención de *Conventional Commits*.
2. **Revisión de Código**: Ningún commit se fusiona directamente a `main` sin pasar por pruebas automatizadas y revisión de un Arquitecto de Nectar Labs.
3. **Cero Warnings de Lint**: Ejecutar `npm run lint` en frontend y verificar que no existan errores de tipado o de formato antes de solicitar Pull Request.

---

<p center align="center">
  <b>MS AMBAR Digital Platform</b> • Desarrollado por <b>Nectar Labs</b> © 2026
</p>
