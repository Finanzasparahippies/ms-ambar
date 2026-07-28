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

El sistema incluye un algoritmo de **Descuentos Preventivos / Venta Anticipada (Early-Bird)** regulado por la regla de seguridad de **Precio Piso (Floor Price Cap)** de Nectar Labs.

### 1. Fórmulas de Cálculo Backend (`apps/tickets/models.py`)

Para cualquier tipo de entrada (Boleto General Sin Asiento o Asiento Numerado), el precio final se calcula mediante la función `Event.get_dynamic_price(base_amount)`:

$$\text{meses\_diff} = \max(0, \text{mes\_evento} - \text{mes\_compra})$$
$$\text{descuento\_bruto} = \text{meses\_diff} \times \text{incremento\_mensual}$$
$$\text{descuento\_máximo} = \text{precio\_base} \times 0.30$$
$$\text{descuento\_efectivo} = \min(\text{descuento\_bruto}, \text{descuento\_máximo})$$
$$\text{precio\_final} = \max(\text{precio\_base} \times 0.70, \text{precio\_base} - \text{descuento\_efectivo})$$

#### 🛡️ Reglas de Seguridad Anti-Cero (Price Floor Safety):
- **Tope de Descuento (30%)**: El descuento total por venta anticipada jamás puede superar el 30% del valor base nominal del boleto.
- **Precio Piso Mínimo (70%)**: La entrada garantiza un precio mínimo cobrable equivalente al 70% de su valor base (evitando que compras con varios meses de anticipación caigan a $0.00 MXN o precios negativos).
- **Fallback Automático**: Si el evento no tiene precio asignado o `base_amount <= 0`, se aplica un valor por defecto ($300.00 MXN para General y $400.00 MXN para Asientos).

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
