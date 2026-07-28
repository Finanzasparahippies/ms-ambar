from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EventViewSet, TheaterViewSet, TicketViewSet, CouponViewSet, SiteSettingsView

router = DefaultRouter()
router.register(r'events', EventViewSet)
router.register(r'theaters', TheaterViewSet)
router.register(r'tickets', TicketViewSet)
router.register(r'coupons', CouponViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('settings/', SiteSettingsView.as_view(), name='site-settings'),
]
