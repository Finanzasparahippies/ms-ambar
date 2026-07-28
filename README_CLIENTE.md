# 🎟️ MS AMBAR — Guía de Uso & Administración de Taquilla Digital

Bienvenida al manual oficial de administración de taquilla y precios para el tour de **Ms. Ambar**. Este documento explica en términos sencillos cómo funciona el sistema de precios, los tipos de boletos, el descuento automático por compra anticipada y cómo gestionar tus conciertos desde el panel de control.

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

## 🛠️ 3. Pasos para Configurar Precios en el Panel Administrador (Django Admin)

Para crear o modificar los precios de un show:

1. Ingresa a la consola de administración con tus credenciales.
2. Ve a la sección **Tickets > Events** y selecciona el evento (ejemplo: *"Ms. Ambar en concierto Hadas en el Desierto"*).
3. Ajusta los siguientes campos clave:
   - **`Seatless ticket price`**: Precio oficial del boleto general (ejemplo: `$300.00 MXN`).
   - **`Monthly price increment`**: Descuento/ajuste mensual por venta anticipada (ejemplo: `$25.00 MXN`).
   - **`Enable dynamic pricing`**: Marca la casilla para activar el beneficio por venta anticipada.
   - **`Mg price`**: Precio del Pase de Convivencia Meet & Greet (ejemplo: `$500.00 MXN`).
   - **`Mg limit`**: Número de pases Meet & Greet disponibles antes de marcar "Agotado".
4. Haz clic en **Guardar**. Los precios en la Landing Page y en la página de Compra de Boletos se actualizarán instantáneamente.

---

## 💳 4. Transparencia en el Cobro y Cargos de Servicio

- El resumen de compra muestra de forma transparente el desglose del precio base del boleto y el cargo de servicio por procesamiento bancario seguro (Stripe).
- El fan recibe sus boletos digitales con código QR único inmediatamente en su pantalla y en su correo electrónico.
