"""
Módulo de Logística e Integración con Skydropx Pro para Ms Ambar.
Arquitectura modular desacoplada: autenticación OAuth2, cotizaciones, emisión de guías,
sondeo resiliente, reconciliación, auditoría y catálogos oficiales.
"""

from .common import (
    MEXICO_STATES_ISO,
    POSTAL_CODE_PREFIX_TO_STATE,
    normalize_mexican_state,
    validate_postal_code,
    lookup_postal_code,
    get_origin_address,
)

from .auth import OAuthManager
from .client import SkydropxClient

from .finance import (
    get_credits,
    get_extra_charges,
    get_transaction_stats,
    check_wallet_balance_alert,
)

from .quotations import (
    get_fallback_rates,
    quote_shipping_rates,
    parse_rates_from_payload,
)

from .shipments import (
    create_shipment_from_rate,
    create_rate_shipment,
    cancel_shipment,
    generate_shipping_label,
)

from .labels import (
    backup_remote_label_pdf,
    generate_sample_shipping_label_pdf,
)

from .polling import poll_shipment_resolution
from .tracking import get_tracking_events
from .catalogs import (
    get_carrier_services,
    get_consignment_notes,
    get_packagings,
    get_office_points,
)
from .reconciliation import (
    reconcile_order_shipping,
    reconcile_pending_shipments,
)

__all__ = [
    "MEXICO_STATES_ISO",
    "POSTAL_CODE_PREFIX_TO_STATE",
    "normalize_mexican_state",
    "validate_postal_code",
    "lookup_postal_code",
    "get_origin_address",
    "OAuthManager",
    "SkydropxClient",
    "get_credits",
    "get_extra_charges",
    "get_transaction_stats",
    "check_wallet_balance_alert",
    "get_fallback_rates",
    "quote_shipping_rates",
    "parse_rates_from_payload",
    "create_shipment_from_rate",
    "create_rate_shipment",
    "cancel_shipment",
    "generate_shipping_label",
    "backup_remote_label_pdf",
    "generate_sample_shipping_label_pdf",
    "poll_shipment_resolution",
    "get_tracking_events",
    "get_carrier_services",
    "get_consignment_notes",
    "get_packagings",
    "get_office_points",
    "reconcile_order_shipping",
    "reconcile_pending_shipments",
]
