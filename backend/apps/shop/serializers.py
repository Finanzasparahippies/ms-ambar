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
                specs = json.loads(specs)
            except Exception:
                specs = {}
        
        if isinstance(specs, dict):
            # Sync flat fields from specifications dict if provided
            if 'material' in specs and not ret.get('material'):
                ret['material'] = str(specs['material'] or '').strip()
            if 'dimensions' in specs and not ret.get('dimensions'):
                ret['dimensions'] = str(specs['dimensions'] or '').strip()
            if 'weight' in specs and not ret.get('weight'):
                ret['weight'] = str(specs['weight'] or '').strip()
            if 'origin' in specs and not ret.get('origin'):
                ret['origin'] = str(specs['origin'] or '').strip()
            if 'care_instructions' in specs and not ret.get('care_instructions'):
                ret['care_instructions'] = str(specs['care_instructions'] or '').strip()
            ret['specifications'] = specs
        elif specs is None:
            ret['specifications'] = {}
        return ret

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Ensure specifications dict is always populated from flat columns
        ret['specifications'] = {
            'material': instance.material or ret.get('specifications', {}).get('material', ''),
            'dimensions': instance.dimensions or ret.get('specifications', {}).get('dimensions', ''),
            'weight': instance.weight or ret.get('specifications', {}).get('weight', ''),
            'origin': instance.origin or ret.get('specifications', {}).get('origin', ''),
            'care_instructions': instance.care_instructions or ret.get('specifications', {}).get('care_instructions', ''),
        }
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
            'material', 'dimensions', 'weight', 'origin', 'care_instructions',
            'specifications', 'price', 'stock',
            'image', 'images', 'uploaded_images', 'category', 'category_name', 'is_active',
            'created_at', 'stripe_product_id', 'stripe_price_id'
        ]
        read_only_fields = ['id', 'created_at', 'stripe_product_id', 'stripe_price_id']

class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    product_image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'product_image', 'quantity', 'price']

    def get_product_image(self, obj):
        if obj.product and obj.product.image:
            val = obj.product.image
            if isinstance(val, str):
                return val
            try:
                return val.url
            except Exception:
                return str(val)
        return None

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'user_email', 'status', 'total_amount', 'items', 'created_at',
            'full_name', 'phone', 'street_and_number', 'suburb', 'city', 'state',
            'postal_code', 'country', 'address', 'selected_rate_id', 'shipping_cost',
            'shipping_provider', 'tracking_number', 'tracking_url', 'shipping_label_pdf',
            'shipping_status', 'shipping_attempt_id', 'skydropx_shipment_id', 'shipping_error'
        ]


class ShopShippingConfigSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import ShopShippingConfig
        model = ShopShippingConfig
        fields = [
            'id', 'method_mode', 'default_carrier', 'default_service',
            'allow_customer_carrier_selection', 'auto_advance_sandbox',
            'min_balance_alert', 'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']


class ShippingEventSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import ShippingEvent
        model = ShippingEvent
        fields = [
            'id', 'order', 'shipment_id', 'event_type', 'correlation_id',
            'idempotency_key', 'http_status', 'request_payload_hash',
            'response_payload', 'balance_before', 'balance_after', 'created_at'
        ]
        read_only_fields = fields

