from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EventViewSet, TheaterViewSet, TicketViewSet, CouponViewSet,
    SiteSettingsView, ActiveThemeView, TicketManagementViewSet,
    TicketCheckInView
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
    path('', include(router.urls)),
    path('settings/', SiteSettingsView.as_view(), name='site-settings'),
    path('theme/active/', ActiveThemeView.as_view(), name='active-theme'),
]
