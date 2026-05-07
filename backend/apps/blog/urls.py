from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, PostViewSet

router = DefaultRouter()
router.register('categories', CategoryViewSet)
router.register('posts', PostViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
