# 🎟️ MS AMBAR — Guía de Uso, Administración de Taquilla, Pagos e Impuestos

Bienvenida al manual oficial de administración de taquilla, precios, comisiones e impuestos para el tour de **Ms. Ambar**. Este documento explica en términos sencillos cómo funciona el sistema de precios, la pasarela de pagos con Stripe, el cargo de servicio, la protección contra transacciones rechazadas y el módulo de facturación electrónica (SAT CFDI 4.0).

---

## 🌟 1. Tipos de Boletos Disponibles en los Eventos

En la plataforma web, tus fans pueden adquirir 3 modalidades de accesos según la configuración del evento:

1. **🎟️ Entrada General (Sin Asiento Reservado)**:
   - Permite acceso de pie a la zona general del recinto con excelente visibilidad y movilidad.
   - Ideal para conciertos de gran capacidad.

2. **🪑 Asiento Numerado en Mesas (Planta Baja / VIP)**:
   - Permite al fan seleccionar su mesa y butaca exacta en el mapa interactivo 2D del recinto.
   - El plano está distribuido de forma elegante en 42 mesas con 4 butacas cada una (168 lugares exclusivos).

3. **🤝 Pase Especial Meet & Greet (Convivencia VIP)**:
   - Acceso exclusivo para convivir en privado con Ms. Ambar, firma de autógrafos y fotografía digital oficial.
   - Puede venderse como un evento exclusivo de convivencia o como un pase adicional opcional al comprar un boleto de concierto.

---

## 📈 2. ¿Cómo Funciona el Descuento Automático por Venta Anticipada?

El sistema incluye una tecnología de **Precios Dinámicos por Venta Anticipada (Early Bird)** que premia a los fans que compran sus accesos con meses de anticipación:

- **Recompensa por Comprar Antes**: Si el concierto se anuncia con varios meses de anticipación (ejemplo: comprar en julio para un show en octubre), el sistema aplica automáticamente un descuento por cada mes de antelación.
- **🛡️ Garantía de Precio Piso de Seguridad**: Para cuidar los ingresos del evento y evitar que los precios caigan a $0 o montos ilógicos, el sistema tiene una **Regla de Oro**:
  - **Descuento Máximo**: Nunca superará el 30% de descuento sobre el precio base.
  - **Precio Mínimo Garantizado**: La entrada siempre cobrará al menos el 70% de su valor oficial.

---

## 💳 3. Transparencia en el Cobro y Cargos de Servicio (Stripe MX)

### ¿Cómo funciona el procesamiento bancario?
Para procesar cobros de tarjetas de débito y crédito en línea de forma segura, el sistema utiliza **Stripe**, la pasarela de pagos líder a nivel mundial.

### El Modelo de Cargo de Servicio (Protección del 100% de tus Ingresos)
Las comisiones bancarias de Stripe en México corresponden a un **3.6% + $3.00 MXN** por transacción exitosa (más el 16% de IVA sobre dicha comisión).

Para garantizar que el artista o la taquilla reciba **íntegro el 100% del precio oficial del boleto**, el sistema calcula de forma transparente un **Cargo de Servicio** que se añade al carrito de compra del cliente.

#### 📊 Ejemplo Numérico: Compra de Boletos por $20,000.00 MXN

1. **Tus Ingresos Oficiales (Subtotal Boletos)**: **$20,000.00 MXN**
2. **Cargo de Servicio Calculado (Stripe)**: **$750.00 MXN**
3. **Total Cobrado a la Tarjeta del Fan**: **$20,750.00 MXN**
4. **Comisión Retenida por Stripe**: $750.00 MXN
5. **Depósito Neto Recibido en tu Cuenta Bancaria**: **$20,000.00 MXN** *(Recibes exactamente tu precio base sin deducciones bancarias)*.

---

## 🛡️ 4. Garantía de Seguridad: Compras Rechazadas o Fallidas

> [!IMPORTANT]
> **Tranquilidad Operativa**: Si la tarjeta de un fan es rechazada por fondos insuficientes, sospecha de fraude o si el usuario abandona la pasarela de pago, **NUNCA se emite un boleto ni se descuenta el inventario de asientos**.

- El sistema solo emite boletos oficiales con código QR cuando **Stripe confirma la recepción exitosa del dinero**.
- Los intentos de pago fallidos quedan descartados automáticamente y el asiento numerado se libera de inmediato para que otro fan pueda comprarlo.

---

## 🏛️ 5. Impuestos y Facturación Electrónica SAT (CFDI 4.0 con Facturapi)

### ¿Cómo se manejan los Impuestos actualmente?
1. **Precios con IVA Incluido**: Los precios fijados para los boletos ($300.00, $500.00, etc.) ya consideran el 16% de IVA dentro de su valor base exhibido al público.
2. **IVA de la Comisión Stripe**: Stripe emite mensualmente a tu favor una factura fiscal (CFDI) por las comisiones cobradas ($750 MXN en el ejemplo anterior). Este IVA ($120 MXN) es **acreditable** y tu contador lo puede deducir de los impuestos a pagar.

### 🧾 Sistema de Autofacturación para los Fans
Para cumplir con la legislación fiscal del SAT en México sin cargar de trabajo operativo a tu equipo, la plataforma se integra con **Facturapi**:

1. **Portal de Autofacturación Self-Service**: Los asistentes pueden ingresar a la sección `/autofacturacion` en la página web con su **Número de Folio** o **Código QR** dentro de los 30 días posteriores al evento.
2. **Emisión Inmediata de CFDI 4.0**: El fan ingresa su RFC, Razón Social, Régimen Fiscal, Código Postal y Uso de CFDI, y el sistema le entrega al instante sus archivos **PDF** y **XML** timbrados ante el SAT.
3. **Factura Global Mensual para la Contabilidad del Proyecto**: Al cierre de cada mes, todas las ventas de boletos que no fueron facturadas individualmente por los fans se agrupan automáticamente en una **Factura Global de Público en General**, permitiendo a tu contador declarar el 100% de la taquilla ante el SAT con total transparencia y legalidad.

---

## 🛠️ 6. Pasos para Configurar Precios en el Panel Administrador (Django Admin)

Para crear o modificar los precios de un show:

1. Ingresa a la consola de administración con tus credenciales.
2. Ve a la sección **Tickets > Events** y selecciona el evento.
3. Ajusta los siguientes campos clave:
   - **`Seatless ticket price`**: Precio oficial del boleto general.
   - **`Monthly price increment`**: Ajuste mensual por venta anticipada.
   - **`Enable dynamic pricing`**: Marca la casilla para activar el beneficio por venta anticipada.
   - **`Mg price`**: Precio del Pase de Convivencia Meet & Greet.
   - **`Mg limit`**: Número de pases Meet & Greet disponibles.
4. Haz clic en **Guardar**. Los precios en la Landing Page y en la página de Compra de Boletos se actualizarán instantáneamente.
