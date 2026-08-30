from rest_framework import serializers
from .models import Category, Product, ProductImage, Order, OrderItem

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

class ProductImageSerializer(serializers.ModelSerializer):
    image = HybridImageField(required=True)

    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'alt_text', 'is_primary', 'order', 'created_at']
        read_only_fields = ['id', 'created_at']

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    image = HybridImageField(required=False, allow_null=True)
    images = ProductImageSerializer(many=True, read_only=True)
    uploaded_images = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        write_only=True
    )
    category_name = serializers.ReadOnlyField(source='category.name')
    specifications = serializers.JSONField(required=False, default=dict)

    def to_internal_value(self, data):
        ret = super().to_internal_value(data)
        specs = ret.get('specifications')
        if isinstance(specs, str):
            import json
            try:
                ret['specifications'] = json.loads(specs)
            except Exception:
                ret['specifications'] = {}
        elif specs is None:
            ret['specifications'] = {}
        return ret

    def create(self, validated_data):
        images_data = validated_data.pop('uploaded_images', [])
        product = super().create(validated_data)
        if images_data:
            self._sync_images(product, images_data)
        return product

    def update(self, instance, validated_data):
        images_data = validated_data.pop('uploaded_images', None)
        product = super().update(instance, validated_data)
        if images_data is not None:
            self._sync_images(product, images_data)
        return product

    def _sync_images(self, product, images_data):
        from django.db import transaction
        with transaction.atomic():
            product.images.all().delete()
            for idx, img_item in enumerate(images_data):
                if isinstance(img_item, dict):
                    img_url = img_item.get('image', '')
                    is_primary = img_item.get('is_primary', idx == 0)
                    alt_text = img_item.get('alt_text', '')
                    order = img_item.get('order', idx)
                else:
                    img_url = str(img_item)
                    is_primary = (idx == 0)
                    alt_text = ''
                    order = idx

                if img_url:
                    ProductImage.objects.create(
                        product=product,
                        image=img_url,
                        is_primary=is_primary,
                        alt_text=alt_text,
                        order=order
                    )
            # Sync primary cover to product.image
            primary_img = product.images.filter(is_primary=True).first() or product.images.first()
            if primary_img and primary_img.image:
                Product.objects.filter(id=product.id).update(image=primary_img.image)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'slug', 'description', 'detailed_description',
            'specifications', 'price', 'stock',
            'image', 'images', 'uploaded_images', 'category', 'category_name', 'is_active',
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
