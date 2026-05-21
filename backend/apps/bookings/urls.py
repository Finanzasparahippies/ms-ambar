from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookingInquiryViewSet, BookingContractViewSet

router = DefaultRouter()
router.register('inquiries', BookingInquiryViewSet, basename='inquiry')
router.register('contracts', BookingContractViewSet, basename='contract')

urlpatterns = [
    path('', include(router.urls)),
]
