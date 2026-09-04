from django.db import models
from django.utils.text import slugify

class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name) or "categoria"
            slug = base_slug
            counter = 1
            while Category.objects.filter(slug=slug).exclude(id=self.id).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Categories"

class Product(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    description = models.TextField()
    detailed_description = models.TextField(blank=True, default='')
    material = models.CharField(max_length=255, blank=True, default='', help_text="Composición o material")
    dimensions = models.CharField(max_length=255, blank=True, default='', help_text="Dimensiones o tallas disponibles")
    weight = models.CharField(max_length=100, blank=True, default='', help_text="Peso estimado del producto")
    origin = models.CharField(max_length=255, blank=True, default='', help_text="Lugar de fabricación o confección")
    care_instructions = models.TextField(blank=True, default='', help_text="Instrucciones de cuidado y lavado")
    specifications = models.JSONField(default=dict, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    image = models.ImageField(max_length=500, upload_to='products/', blank=True, null=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='products')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    stripe_product_id = models.CharField(max_length=255, blank=True, null=True, help_text="ID del producto en Stripe")
    stripe_price_id = models.CharField(max_length=255, blank=True, null=True, help_text="ID del precio en Stripe")

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name) or "producto"
            slug = base_slug
            counter = 1
            while Product.objects.filter(slug=slug).exclude(id=self.id).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

        from django.conf import settings
        import stripe

        updated = False
        if getattr(settings, "STRIPE_SECRET_KEY", None) and not getattr(settings, "TESTING", False) and (not self.stripe_product_id or not self.stripe_price_id):
            stripe.api_key = settings.STRIPE_SECRET_KEY
            try:
                # Search for existing Stripe Product with this slug or id
                product = None
                for p in stripe.Product.list(limit=100).auto_paging_iter():
                    if p.active and (p.metadata.get("product_slug") == self.slug or p.metadata.get("product_id") == str(self.id)):
                        product = p
                        break
                
                expected_name = f"[Ms Ambar] {self.name}"
                if not product:
                    product = stripe.Product.create(
                        name=expected_name,
                        description=self.description or "",
                        metadata={"product_id": str(self.id), "product_slug": self.slug}
                    )
                else:
                    # Update details if changed
                    updates = {}
                    if product.name != expected_name:
                        updates["name"] = expected_name
                    if product.description != self.description:
                        updates["description"] = self.description
                    current_product_id = product.metadata.get("product_id")
                    current_product_slug = product.metadata.get("product_slug")
                    if current_product_id != str(self.id) or current_product_slug != self.slug:
                        updates["metadata"] = {"product_id": str(self.id), "product_slug": self.slug}
                    if updates:
                        stripe.Product.modify(product.id, **updates)

                self.stripe_product_id = product.id

                # Fetch active prices for this product to avoid duplicates
                prices = stripe.Price.list(product=product.id, active=True)
                price_id = None
                amount_cents = int(self.price * 100)
                for p in prices.data:
                    if not p.recurring and p.unit_amount == amount_cents and p.currency == "mxn":
                        price_id = p.id
                        break

                if not price_id:
                    price_obj = stripe.Price.create(
                        unit_amount=amount_cents,
                        currency="mxn",
                        product=product.id,
                    )
                    price_id = price_obj.id

                self.stripe_price_id = price_id
                updated = True
            except Exception as e:
                import logging
                logging.getLogger("apps").error(f"Error creating Stripe Product/Prices for Product {self.name}: {e}")

        if updated:
            super().save(update_fields=['stripe_product_id', 'stripe_price_id'])

    def __str__(self):
        return self.name

class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(max_length=500, upload_to='products/')
    alt_text = models.CharField(max_length=255, blank=True, default='')
    is_primary = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_primary and self.product_id:
            Product.objects.filter(id=self.product_id).update(image=self.image)
            ProductImage.objects.filter(product_id=self.product_id).exclude(id=self.id).filter(is_primary=True).update(is_primary=False)

    def __str__(self):
        return f"Imagen {self.id} - {self.product.name if self.product else 'Sin producto'}"

class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]
    user_email = models.EmailField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    stripe_session_id = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Address Info
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, default="", help_text="Teléfono del cliente")
    street_and_number = models.TextField(default="", help_text="Calle, número exterior e interior")
    suburb = models.CharField(max_length=255, default="", verbose_name="Colonia")
    city = models.CharField(max_length=100, default="", verbose_name="Ciudad")
    state = models.CharField(max_length=100, default="", verbose_name="Estado")
    postal_code = models.CharField(max_length=10, default="", verbose_name="Código Postal")
    country = models.CharField(max_length=100, default="", verbose_name="País")

    # Datos de la Guía Automatizada y Logística
    SHIPPING_STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('requested', 'Solicitado'),
        ('processing', 'Procesando (HTTP 202)'),
        ('created', 'Creado (Tracking Asignado)'),
        ('label_pending', 'Guía Pendiente de Render'),
        ('completed', 'Completado (Guía Lista)'),
        ('failed', 'Fallido'),
        ('reconciliation_required', 'Requiere Reconciliación'),
        ('cancelled', 'Cancelado'),
    ]

    shipping_status = models.CharField(
        max_length=30, 
        choices=SHIPPING_STATUS_CHOICES, 
        default='pending',
        db_index=True,
        help_text="Estado granular de emisión y ciclo de vida de la guía en Skydropx"
    )
    shipping_attempt_id = models.CharField(
        max_length=100, 
        blank=True, 
        null=True, 
        db_index=True,
        help_text="Clave de idempotencia y correlación única para el intento de emisión"
    )
    skydropx_shipment_id = models.CharField(
        max_length=255, 
        blank=True, 
        null=True, 
        db_index=True,
        help_text="ID oficial del shipment en Skydropx"
    )
    shipping_error = models.TextField(
        blank=True, 
        null=True,
        help_text="Detalle del último error o advertencia logística"
    )

    shipping_id = models.CharField(max_length=255, blank=True, null=True, help_text="ID del envío en Skydropx (compatibilidad)")
    selected_rate_id = models.CharField(max_length=255, blank=True, null=True, help_text="ID de tarifa seleccionado en Skydropx")
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Costo de envío cotizado")
    shipping_provider = models.CharField(max_length=50, blank=True, null=True, help_text="Ej: FedEx, DHL")
    tracking_number = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    tracking_url = models.URLField(max_length=500, blank=True, null=True)
    shipping_label_pdf = models.URLField(max_length=500, blank=True, null=True)

    @property
    def address(self):
        parts = [self.street_and_number, self.suburb, self.city, self.state, self.postal_code, self.country]
        return ", ".join([p for p in parts if p])

    def __str__(self):
        return f"Order {self.id} - {self.user_email}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"


class Expense(models.Model):
    title = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=100, default='General')
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - ${self.amount}"


class StripeEvent(models.Model):
    event_id = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.event_id


class ShopShippingConfig(models.Model):
    """
    Configuración global de logística para la tienda Ms Ambar (Patrón Singleton).
    Permite seleccionar el método de despacho desde el Django Admin y el Dashboard del frontend.
    """
    METHOD_CHOICES = [
        ('quotation', 'Cotización en Tiempo Real (Multi-Carrier con rate_id)'),
        ('direct_rate', 'Envío Directo sin Cotizar (rate/shipments/)'),
    ]

    method_mode = models.CharField(
        max_length=30,
        choices=METHOD_CHOICES,
        default='quotation',
        help_text="Método logístico activo para el checkout y emisión en Skydropx"
    )
    default_carrier = models.CharField(
        max_length=50,
        default='fedex',
        help_text="Carrier predeterminado para envíos directos sin cotizar (ej. fedex, dhl, estafeta)"
    )
    default_service = models.CharField(
        max_length=50,
        default='standard_overnight',
        help_text="Código de servicio predeterminado del carrier (ej. standard_overnight, express)"
    )
    allow_customer_carrier_selection = models.BooleanField(
        default=True,
        help_text="Permite al comprador elegir la tarifa y transportista en el checkout si está en modo cotización"
    )
    auto_advance_sandbox = models.BooleanField(
        default=False,
        help_text="Habilita auto_advance: true en Sandbox para simular avance de tracking automático por minuto"
    )
    min_balance_alert = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=500.00,
        help_text="Umbral de saldo en pesos para emitir alertas de recarga preventiva"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración de Envíos"
        verbose_name_plural = "Configuración de Envíos"

    def __str__(self):
        return f"Configuración de Envíos: {self.get_method_mode_display()}"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj


class ShippingEvent(models.Model):
    """
    Registro append-only de auditoría forense para cada interacción con la API de Skydropx.
    Registra Correlation ID, balances de cartera antes y después, y estados HTTP.
    """
    EVENT_TYPES = [
        ('QUOTE_REQUESTED', 'Cotización Solicitada'),
        ('QUOTE_RECEIVED', 'Cotización Recibida'),
        ('SHIPMENT_REQUESTED', 'Emisión Solicitada'),
        ('SHIPMENT_ACCEPTED_202', 'Emisión Aceptada (HTTP 202)'),
        ('SHIPMENT_CREATED_SYNC', 'Emisión Inmediata (HTTP 200/201)'),
        ('POLLING_ATTEMPT', 'Intento de Polling'),
        ('LABEL_AVAILABLE', 'Guía PDF Disponible'),
        ('TRACKING_UPDATED', 'Tracking Actualizado'),
        ('SHIPMENT_CANCELLED', 'Envío Cancelado'),
        ('SHIPMENT_FAILED', 'Emisión Fallida'),
        ('RECONCILIATION_STARTED', 'Reconciliación Iniciada'),
        ('RECONCILIATION_COMPLETED', 'Reconciliación Finalizada'),
        ('WEBHOOK_PROCESSED', 'Webhook Procesado'),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='shipping_events', null=True, blank=True)
    shipment_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES, db_index=True)
    correlation_id = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    idempotency_key = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    http_status = models.IntegerField(null=True, blank=True)
    request_payload_hash = models.CharField(max_length=64, blank=True, null=True)
    response_payload = models.JSONField(null=True, blank=True)
    balance_before = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    balance_after = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Evento de Auditoría de Envío"
        verbose_name_plural = "Auditoría de Envíos"

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M:%S')}] {self.event_type} - Order #{self.order_id or 'N/A'}"


class SkydropxWebhookEvent(models.Model):
    """
    Tabla de deduplicación estricta para webhooks entrantes de Skydropx.
    Evita procesar eventos duplicados garantizando idempotencia.
    """
    event_id = models.CharField(max_length=255, unique=True, db_index=True)
    tracking_number = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    event_type = models.CharField(max_length=100, blank=True, null=True)
    payload = models.JSONField(default=dict)
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-processed_at']
        verbose_name = "Evento Webhook de Skydropx"
        verbose_name_plural = "Webhooks Skydropx"

    def __str__(self):
        return f"Webhook {self.event_id} ({self.event_type})"

