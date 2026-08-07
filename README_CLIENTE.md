# 🎟️ MS AMBAR — Guía de Uso, Administración de Taquilla, Pagos e Impuestos

Bienvenida y bienvenido al manual oficial de administración de taquilla, precios, comisiones e impuestos para el tour oficial de **Ms. Ambar**. Este documento explica en términos sencillos y prácticos cómo funciona el sistema de precios, la pasarela de pagos con Stripe, el cargo de servicio, la protección contra transacciones rechazadas, la personalización del sitio y el módulo de facturación electrónica (SAT CFDI 4.0).

---

## 📋 Índice de Contenidos

1. [🌟 1. Tipos de Accesos y Boletos Disponibles](#-1-tipos-de-accesos-y-boletos-disponibles)
2. [📈 2. Descuento Automático por Venta Anticipada (Early Bird)](#-2-descuento-automático-por-venta-anticipada-early-bird)
3. [💳 3. Transparencia en el Cobro y Cargos de Servicio (Stripe MX)](#-3-transparencia-en-el-cobro-y-cargos-de-servicio-stripe-mx)
4. [🛡️ 4. Garantía de Seguridad: Compras Rechazadas o Fallidas](#-4-garantía-de-seguridad-compras-rechazadas-o-fallidas)
5. [🏛️ 5. Impuestos y Facturación Electrónica SAT (CFDI 4.0)](#-5-impuestos-y-facturación-electrónica-sat-cfdi-40)
6. [🛠️ 6. Guía Administrador: Configuración de Precios y Eventos](#-6-guía-administrador-configuración-de-precios-y-eventos)
7. [🎨 7. Guía Administrador: Personalización Visual y Tema del Sitio](#-7-guía-administrador-personalización-visual-y-tema-del-sitio)
8. [📊 8. Reportes, Escáner de Boletos y Control de Acceso](#-8-reportes-escáner-de-boletos-y-control-de-acceso)

---

## 🌟 1. Tipos de Accesos y Boletos Disponibles

En la plataforma web, los fans pueden adquirir 3 modalidades de accesos según la configuración del evento:

1. **🎟️ Entrada General (Sin Asiento Reservado)**:
   - Acceso de pie a la zona general del recinto con excelente visibilidad y movilidad.
   - Ideal para conciertos de gran capacidad en recintos abiertos o auditorios.

2. **🪑 Asiento Numerado en Mesas (Planta Baja / VIP)**:
   - Permite al fan seleccionar su mesa y butaca exacta en el mapa interactivo 2D del recinto.
   - Distribución visual modular con capacidad para mesas VIP y lugares numerados.

3. **🤝 Pase Especial Meet & Greet (Convivencia VIP)**:
   - Acceso exclusivo para convivir en privado con Ms. Ambar, firma de autógrafos y fotografía digital oficial.
   - Puede comercializarse como pase independiente o como un complemento (*upgrade*) al comprar un boleto de concierto.

---

## 📈 2. Descuento Automático por Venta Anticipada (Early Bird)

El sistema incluye una tecnología de **Precios Dinámicos por Venta Anticipada** que premia a los fans que compran sus accesos con meses de anticipación:

- **Recompensa por Comprar Antes**: Si el concierto se anuncia con varios meses de anticipación (ejemplo: comprar en julio para un show en octubre), el sistema aplica automáticamente un descuento por cada mes de antelación.
- **🛡️ Garantía de Precio Piso de Seguridad**: Para cuidar los ingresos del evento y evitar que los precios caigan a $0 o montos ilógicos, el sistema tiene dos **Reglas de Oro**:
  - **Descuento Máximo (30%)**: Nunca superará el 30% de descuento sobre el precio base oficial.
  - **Precio Mínimo Garantizado (70%)**: La entrada siempre cobrará al menos el 70% de su valor nominal.

---

## 💳 3. Transparencia en el Cobro y Cargos de Servicio (Stripe MX)

### ¿Cómo funciona el procesamiento bancario?
Para procesar cobros de tarjetas de débito y crédito en línea de forma segura, el sistema utiliza **Stripe**, la pasarela de pagos líder a nivel mundial certificada con PCI-DSS Nivel 1.

### El Modelo de Cargo de Servicio (Protección del 100% de tus Ingresos Netos)
Las comisiones bancarias de Stripe en México corresponden a un **3.6% + $3.00 MXN** por transacción exitosa en tarjetas nacionales (y **4.4% + $3.00 MXN** en tarjetas internacionales/pagos en USD), más el **16% de IVA** sobre la propia comisión bancaria de Stripe.

Para garantizar que la taquilla o la producción reciba **íntegro el 100% del precio base de los boletos**, el sistema calcula de forma transparente un **Cargo de Servicio** (*Gross-Up*) que el comprador cubre durante su checkout.

#### 📊 Caso de Estudio Real: Compra de $1,100.00 MXN Base (2 Boletos + 2 Upgrades M&G)

| Concepto | Tarjeta Nacional (México) | Tarjeta Internacional (USD / Extranjero) |
| :--- | :--- | :--- |
| **Precio Base de la Taquilla** | **$1,100.00 MXN** | **$1,100.00 MXN** |
| **Cargo de Servicio Calculado (Con IVA Stripe)** | **$51.57 MXN** | **$62.83 MXN** |
| **Total Cobrado al Cliente en Pasarela** | **$1,151.57 MXN** | **$1,162.83 MXN** |
| **Deducción de Stripe (Comisión + 16% IVA)** | -$51.57 MXN | -$62.83 MXN |
| **Depósito Neto Recibido en tu Banco** | **$1,100.00 MXN EXACTOS** | **$1,100.00 MXN EXACTOS** |

> [!TIP]
> **Beneficio Directo**: Recibes el 100% del valor del boleto en tu cuenta bancaria sin absorber ninguna comisión bancaria.

---

## 🛡️ 4. Garantía de Seguridad: Compras Rechazadas o Fallidas

> [!IMPORTANT]
> **Tranquilidad Operativa**: Si la tarjeta de un fan es rechazada por fondos insuficientes, sospecha de fraude o si el usuario abandona la pasarela de pago, **NUNCA se emite un boleto ni se descuenta el inventario de asientos**.

- El sistema solo emite boletos oficiales con código QR cuando **Stripe confirma la recepción exitosa del dinero**.
- Los intentos de pago fallidos quedan descartados automáticamente y el asiento numerado se libera de inmediato para que otro fan pueda comprarlo.

---

## 🏛️ 5. Impuestos y Facturación Electrónica SAT (CFDI 4.0)

### ¿Cómo se manejan los Impuestos?
1. **Precios con IVA Incluido**: Los precios fijados para los boletos ($300.00, $500.00, etc.) ya consideran el 16% de IVA dentro de su valor base exhibido al público.
2. **IVA de la Comisión Stripe**: Stripe emite mensualmente a tu favor una factura fiscal (CFDI) por las comisiones cobradas. Este IVA es **acreditable** y tu contador lo puede deducir de los impuestos a pagar en su declaración mensual.

### 🧾 Sistema de Autofacturación para Fans
Para cumplir con la legislación fiscal del SAT en México sin cargar de trabajo operativo a tu equipo, la plataforma se integra con **Facturapi**:

1. **Portal de Autofacturación Self-Service**: Los asistentes pueden ingresar a la sección `/autofacturacion` en la página web con su **Número de Folio** o **Código QR** dentro de los 30 días posteriores al evento.
2. **Emisión Inmediata de CFDI 4.0**: El fan ingresa su RFC, Razón Social, Régimen Fiscal, Código Postal y Uso de CFDI, y el sistema le entrega al instante sus archivos **PDF** y **XML** timbrados ante el SAT.
3. **Factura Global Mensual para la Contabilidad**: Al cierre de cada mes, todas las ventas de boletos que no fueron facturadas individualmente por los fans se agrupan automáticamente en una **Factura Global de Público en General** (RFC `XAXX010101000`), permitiendo a tu contador declarar el 100% de la taquilla ante el SAT con total transparencia.

---

## 🛠️ 6. Guía Administrador: Configuración de Precios y Eventos

Para crear o modificar los precios de un show desde la consola de administración:

1. Ingresa a la consola de administración Django (`/admin`).
2. Navega a **Tickets > Events** y selecciona el evento a editar.
3. Ajusta los siguientes campos principales:
   - **`Seatless ticket price`**: Precio oficial del boleto general.
   - **`Monthly price increment`**: Ajuste mensual por venta anticipada.
   - **`Enable dynamic pricing`**: Marca la casilla para activar el beneficio por venta anticipada.
   - **`Mg price`**: Precio del Pase de Convivencia Meet & Greet.
   - **`Mg limit`**: Número máximo de pases Meet & Greet disponibles.
4. Haz clic en **Guardar**. Los cambios se reflejarán inmediatamente en todo el sitio web.

---

## 🎨 7. Guía Administrador: Personalización Visual y Tema del Sitio

Desde el panel administrativo de Django o el Dashboard oficial, puedes personalizar el sistema visual completo:

1. Navega a **Tickets > Site Settings** (Configuración del Sitio).
2. Podrás cambiar:
   - **Color Primario (`primary_color`)**: Color de luces, botones y acentos (ejemplo: `#E5A93B`).
   - **Figura de Partículas (`particle_shape`)**: Elige entre *luna, sol, estrella, cactus, infinito, hexágono, música, etc.*
   - **Densidad y Velocidad de Partículas**: Controla el dinamismo de la animación Canvas.
   - **Texto de Biografía y Redes Sociales**: Actualiza el contenido oficial de la artista.

---

## 📊 8. Reportes, Escáner de Boletos y Control de Acceso

- **Dashboard Principal (`/dashboard`)**: Visualiza en tiempo real las ventas totales, el desglose de ingresos, el número de suscriptores y los boletos vendidos por zona.
- **Escáner de Acceso QR (`/dashboard/scan-tickets`)**: El equipo de acceso al evento puede usar cualquier smartphone o laptop con cámara para escanear los códigos QR de los boletos en la entrada del concierto, validando accesos en menos de 1 segundo e impidiendo duplicidades.

---

<p center align="center">
  <b>MS AMBAR Administrative Manual</b> • Desarrollado por <b>Nectar Labs</b> © 2026
</p>
