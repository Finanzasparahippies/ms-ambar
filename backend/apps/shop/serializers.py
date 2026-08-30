from rest_framework import serializers
from .models import Category, Product, Order, OrderItem

class HybridImageField(serializers.ImageField):
    """
    Soporta tanto archivos binarios (multipart upload) como URLs directas
    en string (Cloudinary o CDN tras optimización).
    """
    def to_internal_value(self, data):
        if isinstance(data, str):
            return data
        return super().to_internal_value(data)

    def to_representation(self, value):
        if not value:
            return None
        val_str = getattr(value, 'name', str(value)) or str(value)
        if isinstance(val_str, str) and (val_str.startswith('http://') or val_str.startswith('https://')):
            return val_str
        try:
            return value.url
        except (ValueError, AttributeError):
            return str(value)

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    image = HybridImageField(required=False, allow_null=True)
    category_name = serializers.ReadOnlyField(source='category.name')

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'slug', 'description', 'price', 'stock',
            'image', 'category', 'category_name', 'is_active',
            'created_at', 'stripe_product_id', 'stripe_price_id'
        ]
        read_only_fields = ['id', 'created_at', 'stripe_product_id', 'stripe_price_id']

class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'quantity', 'price']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    class Meta:
        model = Order
        fields = ['id', 'user_email', 'status', 'total_amount', 'items', 'created_at', 'full_name', 'address', 'city', 'country']
