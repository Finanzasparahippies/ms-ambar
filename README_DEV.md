# MS AMBAR — Guía Técnica para Desarrolladores & Arquitectura del Motor de Taquilla

```
   __/\__
  \      /    MS AMBAR — TAQUILLA DIGITAL & MOTOR DINÁMICO DE PRECIOS
  /_  _  _\   Documentación Técnica de Ingeniería (Nectar Labs Architecture)
    \/
```

---

## 📌 Visión General del Sistema

El módulo de taquilla digital de **MS AMBAR** implementa un motor de cálculo dinámico de precios, reservas de asientos numerados en mapas interactivos 2D (mesas x butacas), compra de entradas generales sin asiento y pasarelas de pago seguras mediante **Stripe API** y **Nectar Gateway**.

---

## 🧮 Arquitectura del Motor de Precios Dinámicos (`Dynamic Pricing Engine`)

El sistema incluye un algoritmo de **Aumento Progresivo de Precios** previo al evento regulado por la regla de máximo 2 incrementos.

### 1. Fórmulas de Cálculo Backend (`apps/tickets/models.py`)

Para cualquier tipo de entrada (Boleto General Sin Asiento o Asiento Numerado), el precio final se calcula mediante la función `Event.get_dynamic_price(base_amount)`:

$$\text{meses\_diff} = \text{mes\_evento} - \text{mes\_compra}$$

- **$\text{meses\_diff} \ge 2$ (ej. Agosto o antes para evento en Octubre)**: $\text{precio\_final} = \text{precio\_base}$ (0 incrementos).
- **$\text{meses\_diff} = 1$ (Septiembre - Transición Agosto $\rightarrow$ Septiembre)**: $\text{precio\_final} = \text{precio\_base} + (1 \times \text{incremento})$.
- **$\text{meses\_diff} \le 0$ (Octubre - Transición Septiembre $\rightarrow$ Octubre / Mes del evento)**: $\text{precio\_final} = \text{precio\_base} + (2 \times \text{incremento})$.

#### 🛡️ Reglas de Seguridad:
- **Garantía de Tarifa Base Mínima**: El precio final nunca será menor al `base_amount` configurado para el evento o asiento.
- **Límite de Incrementos**: Se restringe a un máximo de 2 incrementos durante el ciclo previo al evento.

---

## 💳 Espejo de Tarifas e Impuestos Stripe (`Stripe Fee Mirror`)

Tanto el backend ([fees.py](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/backend/apps/tickets/fees.py)) como el frontend ([comprar-boletos.tsx](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/pages/comprar-boletos.tsx)) aplican la misma fórmula de comisión transparente:

$$\text{cargo\_servicio} = (\text{subtotal\_base} \times 0.036) + 3.00\text{ MXN}$$
$$\text{precio\_neto\_boleto} = \text{total} - \text{cargo\_servicio}$$

---

## 🗄️ Modelos Principales (`apps/tickets/models.py`)

1. **`Event`**:
   - `seatless_ticket_price`: Decimal (Precio base nominal entrada general, por defecto $300.00 MXN).
   - `monthly_price_increment`: Decimal (Monto de incremento/descuento por mes, por defecto $25.00 MXN).
   - `enable_dynamic_pricing`: Boolean (Activa/Desactiva el algoritmo dinámico).
   - `price_multiplier`: Decimal (Multiplicador por evento para precios de butacas en teatros).
   - `effective_seatless_ticket_price`: Property (Regresa el precio dinámico actual del boleto general).
   - `base_price`: Property (Regresa el precio mínimo real de acceso al evento).

2. **`Theater`**:
   - Administra el layout JSON interactivo de mesas (sanitizado automáticamente a exactamente 42 mesas y 168 asientos numerados).

3. **`Ticket`**:
   - Almacena el token único de acceso, código QR, estado de pago (`pending`, `paid`, `cancelled`), datos del comprador y referencia de Stripe Session.

---

## 🛠️ Comandos de Mantenimiento & Tests

### Ejecutar Migraciones
```bash
python backend/manage.py migrate
```

### Sanitizar Precios y Generar Datos Semilla
```bash
python backend/seed_db.py
```

---

## 📂 Archivos Clave del Código
- [models.py](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/backend/apps/tickets/models.py#L372-L415): Algoritmo `get_dynamic_price`, `effective_seatless_ticket_price` y `base_price`.
- [views.py](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/backend/apps/tickets/views.py#L122-L135): Endpoint `/api/tickets/events/{id}/seats/` con aplicación de multiplicador y dinámica.
- [index.tsx](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/pages/index.tsx#L856-L875): Renderizado responsivo de tarifas en la Landing Page.
- [comprar-boletos.tsx](file:///c:/Users/Agent/OneDrive/Documents/proyects/ms-ambar/frontend/src/pages/comprar-boletos.tsx#L268-L325): Carrito de compra, cálculo de asientos numerados y pasarela Nectar Gateway.
