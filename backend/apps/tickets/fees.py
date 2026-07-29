"""
Módulo de cálculo de comisiones de Stripe para ms-ambar.

Las comisiones de Stripe en México son aproximadamente:
  - 3.6% del monto total
  - $3.00 MXN por transacción (tarifa fija)

Para que el negocio siempre reciba el precio base íntegro,
la comisión se cobra al cliente y se calcula así:

  total = (base_price + FLAT_FEE) / (1 - PCT_FEE)
  service_fee = total - base_price

Ejemplo: base_price = $180 MXN
  total = (180 + 3) / (1 - 0.036) = 183 / 0.964 ≈ $189.83 MXN
  service_fee ≈ $9.83 MXN → redondeado a $9.83
"""

# Tarifas vigentes de Stripe MX (tarjetas nacionales e internacionales)
STRIPE_PCT_FEE: float = 0.036    # 3.6%
STRIPE_FLAT_FEE: float = 3.00    # $3.00 MXN fijo por transacción


def calculate_total_with_fee(base_amount: float) -> dict:
    """
    Calcula el total a cobrar en Stripe utilizando la fórmula de Recargo/Gross-Up:
        total = (base_price + FLAT_FEE) / (1 - PCT_FEE)
        service_fee = total - base_price

    Esto garantiza que tras la deducción de la comisión por parte de Stripe (3.6% + $3.00 MXN sobre el total),
    el negocio/artista reciba exactamente el precio base íntegro (base_amount).
    """
    if base_amount <= 0:
        return {"base_price": 0.0, "service_fee": 0.0, "total": 0.0}

    base_price = round(float(base_amount), 2)
    total = round((base_price + STRIPE_FLAT_FEE) / (1 - STRIPE_PCT_FEE), 2)
    service_fee = round(total - base_price, 2)

    return {
        "base_price": base_price,
        "service_fee": service_fee,
        "total": total,
    }


def get_fee_config() -> dict:
    """
    Retorna la configuración de las comisiones para exponerla en el frontend.
    """
    return {
        "stripe_pct_fee": STRIPE_PCT_FEE,
        "stripe_flat_fee": STRIPE_FLAT_FEE,
        "description": "Cargo de servicio de plataforma (Stripe MX)",
    }
