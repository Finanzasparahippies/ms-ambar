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
    OrderDownloadLabelView
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
    path('shipping/postal-code/<str:postal_code>/', PostalCodeLookupView.as_view(), name='postal-code-lookup'),
]

