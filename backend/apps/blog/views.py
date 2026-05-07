from rest_framework import viewsets, permissions
from .models import Category, Post
from .serializers import CategorySerializer, PostSerializer

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]

class PostViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Post.objects.filter(is_published=True).order_by('-created_at')
    serializer_class = PostSerializer
    permission_classes = [permissions.AllowAny]
