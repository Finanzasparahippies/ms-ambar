from django.db import models
import uuid

class Theater(models.Model):
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    layout = models.JSONField(help_text="JSON representation of sections and rows", null=True, blank=True, default=dict)

    def __str__(self):
        return self.name

    def generate_seats(self):
        """
        Generates Seat objects with 2D coordinates.
        Supports:
        1. Schema-based: {"sections": [...]}
        2. Direct list: [{"row": "A", "number": 1, "x": 100, "y": 100, ...}]
        """
        import math
        
        # Case 1: Direct list or Object with seats key
        seats_data = None
        if isinstance(self.layout, list):
            seats_data = self.layout
        elif isinstance(self.layout, dict) and 'seats' in self.layout:
            seats_data = self.layout['seats']

        if seats_data:
            created_count = 0
            for seat_data in seats_data:
                Seat.objects.update_or_create(
                    theater=self,
                    section=seat_data.get('section', 'General'),
                    row=seat_data.get('row', '1'),
                    number=seat_data.get('number', 1),
                    defaults={
                        'category': seat_data.get('category', 'standard'),
                        'status': seat_data.get('status', 'available'),
                        'base_price': seat_data.get('base_price', 1000),
                        'x': seat_data.get('x', 0),
                        'y': seat_data.get('y', 0),
                        'angle': seat_data.get('angle', 0)
                    }
                )
                created_count += 1
            
            # Sync GA Zones
            elements_data = self.layout.get('map_elements', [])
            for el_data in elements_data:
                if el_data.get('isGA'):
                    GADeclaration.objects.update_or_create(
                        theater=self,
                        external_id=el_data.get('id'),
                        defaults={
                            'name': el_data.get('label', 'General Admission'),
                            'capacity': el_data.get('capacity', 0),
                            'category': el_data.get('category', 'standard'),
                            'base_price': el_data.get('base_price', 500)
                        }
                    )
            return created_count

        # Case 2: Schema-based (current logic)
        sections = self.layout.get('sections', [])
        created_count = 0
        
        for section in sections:
            sec_name = section.get('name')
            layout_type = section.get('layout_type', 'grid') # grid or arc
            
            # Base Position
            base_x = section.get('x', 500)
            base_y = section.get('y', 500)
            sec_angle_deg = section.get('angle', 0)
            sec_angle_rad = math.radians(sec_angle_deg)
            
            row_spacing = section.get('row_spacing', 40)
            seat_spacing = section.get('seat_spacing', 30)
            
            for r_idx, row_data in enumerate(section.get('rows', [])):
                label = row_data.get('label')
                count = row_data.get('count', 0)
                cat = row_data.get('category', 'standard')
                price = row_data.get('base_price', 1000)
                
                for s_idx in range(count):
                    final_x, final_y, final_angle = 0, 0, sec_angle_deg
                    
                    if layout_type == 'grid':
                        # Local grid coordinates
                        local_x = (s_idx - (count - 1) / 2) * seat_spacing
                        local_y = r_idx * row_spacing
                        # Rotation Matrix
                        rotated_x = local_x * math.cos(sec_angle_rad) - local_y * math.sin(sec_angle_rad)
                        rotated_y = local_x * math.sin(sec_angle_rad) + local_y * math.cos(sec_angle_rad)
                        final_x, final_y = base_x + rotated_x, base_y + rotated_y
                    
                    elif layout_type == 'arc':
                        # Radial logic
                        radius = section.get('radius', 300) + (r_idx * row_spacing)
                        aperture = section.get('aperture', 90)
                        seat_angle_step = aperture / max(1, count - 1)
                        seat_angle_deg = sec_angle_deg + (s_idx * seat_angle_step) - (aperture / 2)
                        seat_angle_rad = math.radians(seat_angle_deg)
                        
                        final_x = base_x + radius * math.cos(seat_angle_rad)
                        final_y = base_y + radius * math.sin(seat_angle_rad)
                        # Rotate to face the center of the arc (Nectarlabs logic)
                        final_angle = seat_angle_deg + 180
                    
                    Seat.objects.update_or_create(
                        theater=self,
                        section=sec_name,
                        row=label,
                        number=s_idx + 1,
                        defaults={
                            'category': cat,
                            'base_price': price,
                            'x': final_x,
                            'y': final_y,
                            'angle': final_angle
                        }
                    )
                    created_count += 1
        return created_count

class Event(models.Model):
    EVENT_TYPES = [
        ('concert', 'Concierto / Venue'),
        ('meet_greet', 'Meet & Greet (Convivencia)'),
    ]
    title = models.CharField(max_length=255)
    artist = models.CharField(max_length=255)
    date = models.DateTimeField()
    theater = models.ForeignKey(Theater, on_delete=models.CASCADE, null=True, blank=True, related_name='events')
    image = models.ImageField(upload_to='events/', null=True, blank=True)
    flyer = models.ImageField(
        upload_to='event_flyers/',
        null=True,
        blank=True,
        help_text="Imagen del flyer oficial del evento. Se muestra en la landing page y en la página de compra de boletos."
    )
    is_active = models.BooleanField(default=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES, default='concert')

    # Meet & Greet Logic
    mg_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    mg_limit = models.PositiveIntegerField(default=0)

    # Price multiplier for this specific event
    price_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=1.0)

    stripe_product_id = models.CharField(max_length=255, blank=True, null=True, help_text="ID del producto en Stripe para este evento")
    stripe_price_id = models.CharField(max_length=255, blank=True, null=True, help_text="ID del precio en Stripe (solo para Meet & Greet o general)")

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        from django.conf import settings
        from django.utils.text import slugify
        import stripe

        updated = False
        if getattr(settings, "STRIPE_SECRET_KEY", None) and not getattr(settings, "TESTING", False) and (not self.stripe_product_id or (self.event_type == 'meet_greet' and not self.stripe_price_id)):
            stripe.api_key = settings.STRIPE_SECRET_KEY
            try:
                event_slug = slugify(self.title)
                # Search for existing Stripe Product with this slug or id
                product = None
                for p in stripe.Product.list(limit=100).auto_paging_iter():
                    if p.active and (p.metadata.get("event_slug") == event_slug or p.metadata.get("event_id") == str(self.id)):
                        product = p
                        break
                
                expected_name = f"[Boletos] {self.title}"
                if not product:
                    product = stripe.Product.create(
                        name=expected_name,
                        description=f"Boletos para el evento {self.title} de {self.artist}.",
                        metadata={"event_id": str(self.id), "event_slug": event_slug}
                    )
                else:
                    # Update details if changed
                    updates = {}
                    if product.name != expected_name:
                        updates["name"] = expected_name
                    current_event_id = product.metadata.get("event_id")
                    current_event_slug = product.metadata.get("event_slug")
                    if current_event_id != str(self.id) or current_event_slug != event_slug:
                        updates["metadata"] = {"event_id": str(self.id), "event_slug": event_slug}
                    if updates:
                        stripe.Product.modify(product.id, **updates)

                self.stripe_product_id = product.id

                if self.event_type == 'meet_greet':
                    # Fetch active prices for this product to avoid duplicates
                    prices = stripe.Price.list(product=product.id, active=True)
                    price_id = None
                    amount_cents = int(self.mg_price * 100)
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
                else:
                    # Clear stripe_price_id if it's not a meet & greet event anymore
                    self.stripe_price_id = None
                
                updated = True
            except Exception as e:
                import logging
                logging.getLogger("apps").error(f"Error creating Stripe Product/Prices for Event {self.title}: {e}")

        if updated:
            super().save(update_fields=['stripe_product_id', 'stripe_price_id'])

    def __str__(self):
        return f"{self.title} - {self.date.strftime('%Y-%m-%d')}"

    @property
    def mg_available(self):
        sold = self.tickets.filter(status='paid', has_mg=True).count()
        return max(0, self.mg_limit - sold)

    @property
    def base_price(self):
        """Returns the lowest seat base_price in the event's theater, or 0 if no theater/seats."""
        if self.event_type == 'meet_greet':
            return float(self.mg_price)
        if self.theater:
            from apps.tickets.models import Seat
            min_seat = self.theater.seats.order_by('base_price').first()
            if min_seat:
                return float(min_seat.base_price * self.price_multiplier)
        return 0

class Seat(models.Model):
    CATEGORY_CHOICES = [
        ('standard', 'Standard'),
        ('vip', 'VIP Gold'),
        ('premium', 'Premium'),
        ('disabled', 'Accessible'),
    ]
    POSITION_CHOICES = [
        ('front', 'Frontal'),
        ('side_left', 'Lateral Izquierda'),
        ('side_right', 'Lateral Derecha'),
        ('back', 'Posterior'),
    ]
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('reserved', 'Reserved'),
        ('occupied', 'Occupied'),
        ('blocked', 'Blocked'),
    ]
    theater = models.ForeignKey(Theater, on_delete=models.CASCADE, related_name='seats')
    section = models.CharField(max_length=100, default='General')
    position = models.CharField(max_length=20, choices=POSITION_CHOICES, default='front')
    row = models.CharField(max_length=10)
    number = models.IntegerField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='standard')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Precise positioning
    x = models.FloatField(default=0)
    y = models.FloatField(default=0)
    angle = models.FloatField(default=0) # In degrees

    class Meta:
        unique_together = ('theater', 'section', 'row', 'number')

    def __str__(self):
        return f"{self.theater.name} - {self.section} {self.row}{self.number}"

class GADeclaration(models.Model):
    theater = models.ForeignKey(Theater, on_delete=models.CASCADE, related_name='ga_zones')
    name = models.CharField(max_length=100)
    capacity = models.PositiveIntegerField()
    category = models.CharField(max_length=20, choices=Seat.CATEGORY_CHOICES, default='standard')
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Internal ID from designer to keep sync
    external_id = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return f"{self.theater.name} - GA Zone: {self.name}"

class Ticket(models.Model):
    STATUS_CHOICES = [
        ('reserved', 'Reserved'),
        ('paid', 'Paid'),
        ('used', 'Used'),
        ('cancelled', 'Cancelled'),
    ]
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='tickets')
    seat = models.ForeignKey(Seat, on_delete=models.CASCADE, null=True, blank=True)
    ga_zone = models.ForeignKey(GADeclaration, on_delete=models.CASCADE, null=True, blank=True)
    user_email = models.EmailField()
    user_phone = models.CharField(max_length=20, null=True, blank=True)
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='reserved')
    is_scanned = models.BooleanField(default=False)
    scanned_at = models.DateTimeField(null=True, blank=True)
    
    # Meet & Greet Upgrade
    has_mg = models.BooleanField(default=False)
    
    # Stripe Session ID
    stripe_session_id = models.CharField(max_length=255, blank=True, null=True, help_text="ID de la sesión de checkout de Stripe")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('event', 'seat')

    def __str__(self):
        if self.seat:
            seat_info = f"Asiento {self.seat.row}{self.seat.number}"
        elif self.ga_zone:
            seat_info = f"Zona GA: {self.ga_zone.name}"
        else:
            seat_info = "Pase Meet & Greet"
            
        return f"Ticket #{self.id} | {self.event.title} - {seat_info} ({self.user_email})"

class SiteSettings(models.Model):
    """
    Singleton model para configuración global del sitio.
    Solo puede existir una instancia (pk=1).
    Se administra desde el Django Admin.
    """
    tickets_page_subtitle = models.TextField(
        default="Selecciona tu concierto, explora el mapa de asientos interactivo y reserva tus boletos oficiales.",
        help_text="Subtítulo que aparece en la página de compra de boletos (comprar-boletos)."
    )
    homepage_cta_text = models.TextField(
        default="¡Próximamente nuevo evento!",
        help_text="Texto del badge de próximo evento en la landing page cuando no hay eventos programados."
    )

    class Meta:
        verbose_name = "Configuración del Sitio"
        verbose_name_plural = "Configuración del Sitio"

    def save(self, *args, **kwargs):
        """Forzar siempre pk=1 (singleton)."""
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Prevent deletion of the singleton."""
        pass

    @classmethod
    def get(cls):
        """Obtiene (o crea si no existe) la instancia singleton."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Configuración Global del Sitio"
