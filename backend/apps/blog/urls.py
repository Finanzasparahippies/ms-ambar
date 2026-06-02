from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, PostViewSet, NewsletterSubscriberViewSet, SESIdentityVerificationViewSet

router = DefaultRouter()
router.register('categories', CategoryViewSet, basename='category')
router.register('posts', PostViewSet, basename='post')
router.register('subscribers', NewsletterSubscriberViewSet, basename='subscriber')
router.register('ses-verification', SESIdentityVerificationViewSet, basename='ses-verification')


urlpatterns = [
    path('', include(router.urls)),
]
