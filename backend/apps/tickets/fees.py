"""
Módulo de cálculo de comisiones de Stripe para ms-ambar.

Tarifas oficiales de Stripe en México:
  - Tarjeta Nacional: 3.6% + $3.00 MXN + 16% IVA sobre la comisión de Stripe
    Tasa efectiva real: 4.176% + $3.48 MXN
  - Tarjeta Internacional / Adaptive Pricing (USD): 4.4% + $3.00 MXN + 16% IVA sobre la comisión
    Tasa efectiva real: 5.104% + $3.48 MXN

Para que la taquilla o el artista reciba SIEMPRE el 100% de su precio base neto (sin faltantes por IVA o tarifas internacionales),
la fórmula de Gross-Up / Recargo considera la deducción neta total de Stripe (comisión + IVA):

  total = (base_price + FLAT_FEE_CON_IVA) / (1 - PCT_FEE_CON_IVA)
"""

STRIPE_PCT_FEE_DOMESTIC: float = 0.036          # 3.6% base
STRIPE_PCT_FEE_INTL: float = 0.044              # 4.4% tarjetas internacionales / Adaptive Pricing
STRIPE_FLAT_FEE: float = 3.00                   # $3.00 MXN fijo
STRIPE_IVA_RATE: float = 0.16                   # 16% IVA retenido por Stripe sobre su comisión

# Tarifas efectivas con IVA (16%)
EFFECTIVE_PCT_DOMESTIC: float = round(STRIPE_PCT_FEE_DOMESTIC * (1 + STRIPE_IVA_RATE), 5)  # 0.04176 (4.176%)
EFFECTIVE_PCT_INTL: float = round(STRIPE_PCT_FEE_INTL * (1 + STRIPE_IVA_RATE), 5)          # 0.05104 (5.104%)
EFFECTIVE_FLAT_FEE: float = round(STRIPE_FLAT_FEE * (1 + STRIPE_IVA_RATE), 2)              # $3.48 MXN


def calculate_total_with_fee(base_amount: float, is_international: bool = False) -> dict:
    """
    Calcula el total a cobrar en Stripe garantizando que tras la deducción de la comisión
    e IVA de Stripe (y recargo internacional si aplica), el negocio/artista reciba exactamente
    el precio base íntegro (base_amount).
    """
    if base_amount <= 0:
        return {"base_price": 0.0, "service_fee": 0.0, "total": 0.0, "is_international": is_international}

    base_price = round(float(base_amount), 2)
    pct_fee = EFFECTIVE_PCT_INTL if is_international else EFFECTIVE_PCT_DOMESTIC

    total = round((base_price + EFFECTIVE_FLAT_FEE) / (1 - pct_fee), 2)
    service_fee = round(total - base_price, 2)

    return {
        "base_price": base_price,
        "service_fee": service_fee,
        "total": total,
        "is_international": is_international,
    }


def get_fee_config(is_international: bool = False) -> dict:
    """
    Retorna la configuración de las comisiones para exponerla en el frontend.
    """
    pct = EFFECTIVE_PCT_INTL if is_international else EFFECTIVE_PCT_DOMESTIC
    return {
        "stripe_pct_fee": pct,
        "stripe_flat_fee": EFFECTIVE_FLAT_FEE,
        "description": "Cargo de servicio de procesamiento seguro Stripe (incluye IVA sobre comisión)",
    }
