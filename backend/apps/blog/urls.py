from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, PostViewSet, NewsletterSubscriberViewSet, SESIdentityVerificationViewSet, EmailCampaignViewSet, CampaignTemplateImageViewSet, MarketingListViewSet

router = DefaultRouter()
router.register('categories', CategoryViewSet, basename='category')
router.register('posts', PostViewSet, basename='post')
router.register('subscribers', NewsletterSubscriberViewSet, basename='subscriber')
router.register('ses-verification', SESIdentityVerificationViewSet, basename='ses-verification')
router.register('campaigns', EmailCampaignViewSet, basename='campaign')
router.register('campaign-template-images', CampaignTemplateImageViewSet, basename='campaign-template-image')
router.register('marketing-lists', MarketingListViewSet, basename='marketing-list')

urlpatterns = [
    path('', include(router.urls)),
]
