from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EventViewSet, TheaterViewSet, TicketViewSet, CouponViewSet,
    SiteSettingsView, ActiveThemeView, TicketManagementViewSet,
    TicketCheckInView
)
from .passkit_views import (
    PassKitDeviceRegistrationView,
    PassKitLatestPassView,
    PassKitLogView
)

router = DefaultRouter()
router.register(r'events', EventViewSet)
router.register(r'theaters', TheaterViewSet)
router.register(r'tickets', TicketViewSet)
router.register(r'coupons', CouponViewSet)
router.register(r'admin/tickets', TicketManagementViewSet, basename='admin-tickets')

urlpatterns = [
    path('scanner/check-in/', TicketCheckInView.as_view(), name='scanner-check-in'),
    path('admin/reserved-sessions/', TicketManagementViewSet.as_view({'get': 'reserved_sessions'}), name='admin-reserved-sessions-direct'),
    path('admin/release-seats/', TicketManagementViewSet.as_view({'post': 'release_seats'}), name='admin-release-seats-direct'),
    path('stuck-reservations/', TicketManagementViewSet.as_view({'get': 'reserved_sessions'}), name='stuck-reservations-alias'),
    path('release/', TicketManagementViewSet.as_view({'post': 'release_seats'}), name='release-seats-alias'),
    path('<str:pk>/apple-pass/', TicketViewSet.as_view({'get': 'apple_pass'}), name='ticket-apple-pass-direct'),
    path('<str:pk>/google-wallet-link/', TicketViewSet.as_view({'get': 'google_wallet_link'}), name='ticket-google-wallet-direct'),
    # Apple PassKit Web Service v1 (Push Notifications & Live Updates)
    path('passkit/v1/devices/<str:device_id>/registrations/<str:pass_type_id>/<str:serial_number>', PassKitDeviceRegistrationView.as_view(), name='passkit-device-registration'),
    path('passkit/v1/passes/<str:pass_type_id>/<str:serial_number>', PassKitLatestPassView.as_view(), name='passkit-latest-pass'),
    path('passkit/v1/log', PassKitLogView.as_view(), name='passkit-log'),
    path('', include(router.urls)),
    path('settings/', SiteSettingsView.as_view(), name='site-settings'),
    path('theme/active/', ActiveThemeView.as_view(), name='active-theme'),
]
