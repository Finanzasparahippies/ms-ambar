from rest_framework import serializers
from .models import Category, Post, NewsletterSubscriber

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class PostSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    class Meta:
        model = Post
        fields = ['id', 'title', 'slug', 'content', 'image', 'category', 'category_name', 'created_at', 'is_published', 'is_notified']

class NewsletterSubscriberSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsletterSubscriber
        fields = '__all__'

