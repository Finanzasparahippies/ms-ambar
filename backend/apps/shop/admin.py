from django.contrib import admin
from .models import Category, Product, ProductImage, Order, OrderItem, Expense, ShopShippingConfig, ShippingEvent
from .shipping import reconcile_order_shipping

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ('image', 'is_primary', 'order', 'alt_text')

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'stock', 'category', 'is_active', 'material', 'origin')
    list_filter = ('category', 'is_active', 'origin')
    search_fields = ('name', 'description', 'detailed_description', 'material', 'origin')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ProductImageInline]
    fieldsets = (
        ('Información Básica', {
            'fields': ('name', 'slug', 'category', 'price', 'stock', 'is_active', 'description', 'detailed_description')
        }),
        ('Especificaciones Técnicas', {
            'fields': ('material', 'dimensions', 'weight', 'origin', 'care_instructions', 'specifications')
        }),
        ('Portada & Pasarela', {
            'fields': ('image', 'stripe_product_id', 'stripe_price_id')
        }),
    )

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0

@admin.action(description="Reconciliar guías seleccionadas con Skydropx")
def reconciliar_guias_action(modeladmin, request, queryset):
    count = 0
    for order in queryset:
        res = reconcile_order_shipping(order)
        if res.get("reconciled"):
            count += 1
    modeladmin.message_user(request, f"Se reconciliaron exitosamente {count} pedidos con Skydropx.")

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user_email', 'total_amount', 'status', 'shipping_status', 'shipping_provider', 'tracking_number', 'created_at')
    list_filter = ('status', 'shipping_status', 'created_at')
    search_fields = ('id', 'user_email', 'tracking_number', 'skydropx_shipment_id', 'shipping_attempt_id')
    actions = [reconciliar_guias_action]
    inlines = [OrderItemInline]

@admin.register(ShopShippingConfig)
class ShopShippingConfigAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'method_mode', 'default_carrier', 'default_service', 'auto_advance_sandbox', 'updated_at')
    fieldsets = (
        ('Modo de Operación', {
            'fields': ('method_mode', 'allow_customer_carrier_selection'),
            'description': 'Opción A: Cotización multi-tarifa previa (quotation). Opción B: Emisión directa sin cotización (direct_rate).'
        }),
        ('Valores por Defecto (Opción B)', {
            'fields': ('default_carrier', 'default_service'),
        }),
        ('Entorno y Alertas', {
            'fields': ('auto_advance_sandbox', 'min_balance_alert'),
            'description': 'auto_advance_sandbox fuerza el avance de estados en entorno de prueba. min_balance_alert genera advertencias si la cartera baja de ese saldo.'
        })
    )

@admin.register(ShippingEvent)
class ShippingEventAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'event_type', 'endpoint', 'status_code', 'balance_before', 'balance_after', 'created_at')
    list_filter = ('event_type', 'status_code', 'created_at')
    search_fields = ('order__id', 'correlation_id', 'request_hash', 'endpoint')
    readonly_fields = ('order', 'event_type', 'endpoint', 'request_hash', 'payload', 'status_code', 'response_body', 'balance_before', 'balance_after', 'error_message', 'correlation_id', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('title', 'amount', 'category', 'created_at')
    list_filter = ('category', 'created_at')
    search_fields = ('title', 'description')
