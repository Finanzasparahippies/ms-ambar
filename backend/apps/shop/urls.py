from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet, 
    ProductViewSet, 
    stripe_webhook, 
    skydropx_webhook,
    ShopCheckoutView, 
    ShippingQuoteView, 
    PostalCodeLookupView,
    OrderBySessionView,
    OrderDownloadLabelView,
    ShippingHealthCheckView,
    ShopShippingConfigView,
    ShippingReconcileView,
    ShippingEventsListView,
    ShippingCatalogsView
)

router = DefaultRouter()
router.register('categories', CategoryViewSet)
router.register('products', ProductViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('webhook/', stripe_webhook, name='stripe-webhook'),
    path('webhook/skydropx/', skydropx_webhook, name='skydropx-webhook'),
    path('checkout/', ShopCheckoutView.as_view(), name='shop-checkout'),
    path('orders/by_session/', OrderBySessionView.as_view(), name='order-by-session'),
    path('orders/<int:pk>/label/', OrderDownloadLabelView.as_view(), name='order-download-label'),
    path('shipping/quote/', ShippingQuoteView.as_view(), name='shipping-quote'),
    path('shipping/health-check/', ShippingHealthCheckView.as_view(), name='shipping-health-check'),
    path('shipping/postal-code/<str:postal_code>/', PostalCodeLookupView.as_view(), name='postal-code-lookup'),
    path('shipping/config/', ShopShippingConfigView.as_view(), name='shipping-config'),
    path('shipping/reconcile/', ShippingReconcileView.as_view(), name='shipping-reconcile'),
    path('shipping/events/', ShippingEventsListView.as_view(), name='shipping-events'),
    path('shipping/catalogs/', ShippingCatalogsView.as_view(), name='shipping-catalogs'),
]


