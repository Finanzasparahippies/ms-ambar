from django.db import models
from datetime import timedelta
import uuid

class Theater(models.Model):
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True, default='')
    layout = models.JSONField(help_text="JSON representation of sections and rows", null=True, blank=True, default=dict)

    def __str__(self):
        return self.name

    def sanitize_42_tables_layout(self):
        """
        Sincroniza el layout de forma 100% dinámica respetando todas las mesas y asientos
        configurados en Nectar Studio Designer sin limitaciones fijas.
        """
        return

    def get_layout_bounds(self, seat_padding=20):
        """
        Calcula las métricas de bounding box (min_x, min_y, max_x, max_y, width, height, center_x, center_y)
        del layout 2D guardado en el teatro para referencia y validación de endpoints/UI.
        """
        if not isinstance(self.layout, dict):
            return {
                "min_x": -300.0, "min_y": -200.0, "max_x": 300.0, "max_y": 200.0,
                "width": 600.0, "height": 400.0, "center_x": 0.0, "center_y": 0.0
            }

        seats_data = self.layout.get('seats', [])
        map_elements = self.layout.get('map_elements', [])

        if not isinstance(seats_data, list):
            seats_data = []
        if not isinstance(map_elements, list):
            map_elements = []

        if not seats_data and not map_elements:
            return {
                "min_x": -300.0, "min_y": -200.0, "max_x": 300.0, "max_y": 200.0,
                "width": 600.0, "height": 400.0, "center_x": 0.0, "center_y": 0.0
            }

        min_x = float('inf')
        min_y = float('inf')
        max_x = float('-inf')
        max_y = float('-inf')

        for s in seats_data:
            if isinstance(s, dict) and 'x' in s and 'y' in s:
                try:
                    sx, sy = float(s['x']), float(s['y'])
                    min_x = min(min_x, sx - seat_padding)
                    max_x = max(max_x, sx + seat_padding)
                    min_y = min(min_y, sy - seat_padding)
                    max_y = max(max_y, sy + seat_padding)
                except (ValueError, TypeError):
                    continue

        for el in map_elements:
            if isinstance(el, dict) and 'x' in el and 'y' in el:
                try:
                    ex, ey = float(el['x']), float(el['y'])
                    half_w = float(el.get('w', 100)) / 2.0 + seat_padding
                    half_h = float(el.get('h', 100)) / 2.0 + seat_padding
                    min_x = min(min_x, ex - half_w)
                    max_x = max(max_x, ex + half_w)
                    min_y = min(min_y, ey - half_h)
                    max_y = max(max_y, ey + half_h)
                except (ValueError, TypeError):
                    continue

        if min_x == float('inf') or max_x == float('-inf'):
            return {
                "min_x": -300.0, "min_y": -200.0, "max_x": 300.0, "max_y": 200.0,
                "width": 600.0, "height": 400.0, "center_x": 0.0, "center_y": 0.0
            }

        w = max(50.0, max_x - min_x)
        h = max(50.0, max_y - min_y)
        cx = (min_x + max_x) / 2.0
        cy = (min_y + max_y) / 2.0

        return {
            "min_x": round(min_x, 2),
            "min_y": round(min_y, 2),
            "max_x": round(max_x, 2),
            "max_y": round(max_y, 2),
            "width": round(w, 2),
            "height": round(h, 2),
            "center_x": round(cx, 2),
            "center_y": round(cy, 2)
        }

    def generate_seats(self):
        """
        Generates/updates Seat objects with 2D coordinates and custom colors idempotently.
        Supports matching by seat ID or (section, row, number) composite key.
        """
        import math
        
        # Auto-sanitize table layout if excess tables present (>42)
        self.sanitize_42_tables_layout()

        # Case 1: Direct list or Object with seats key
        seats_data = None
        if isinstance(self.layout, list):
            seats_data = self.layout
        elif isinstance(self.layout, dict) and 'seats' in self.layout:
            seats_data = self.layout['seats']

        if seats_data is not None:
            existing_seats_by_id = {s.id: s for s in Seat.objects.filter(theater=self)}
            existing_seats_by_key = {}
            for s in existing_seats_by_id.values():
                k = (s.section, str(s.row), s.number)
                if k not in existing_seats_by_key:
                    existing_seats_by_key[k] = []
                existing_seats_by_key[k].append(s)

            seats_to_create = []
            seats_to_update = []
            active_ids = set()
            used_batch_keys = set()
            created_count = len(seats_data)

            for seat_data in seats_data:
                sec = seat_data.get('section', 'General')
                rw = str(seat_data.get('row', '1'))
                try:
                    num = int(seat_data.get('number', 1))
                except (ValueError, TypeError):
                    num = 1

                # Disambiguate duplicate keys within the payload batch
                while (sec, rw, num) in used_batch_keys:
                    num += 1
                used_batch_keys.add((sec, rw, num))

                cat = seat_data.get('category', 'standard')
                st = seat_data.get('status', 'available')
                price = seat_data.get('base_price', 1000)
                sx = seat_data.get('x', 0)
                sy = seat_data.get('y', 0)
                ang = seat_data.get('angle', 0)
                clr = seat_data.get('color', '')

                s_id = seat_data.get('id')
                seat = None
                try:
                    if s_id and int(s_id) in existing_seats_by_id:
                        seat = existing_seats_by_id[int(s_id)]
                except (ValueError, TypeError):
                    seat = None

                key = (sec, rw, num)
                if not seat and key in existing_seats_by_key and existing_seats_by_key[key]:
                    seat = existing_seats_by_key[key].pop(0)

                if seat:
                    active_ids.add(seat.id)
                    seat.section = sec
                    seat.row = rw
                    seat.number = num
                    seat.category = cat
                    seat.status = st
                    seat.base_price = price
                    seat.x = sx
                    seat.y = sy
                    seat.angle = ang
                    seat.color = clr
                    seats_to_update.append(seat)
                else:
                    seats_to_create.append(Seat(
                        theater=self,
                        section=sec,
                        row=rw,
                        number=num,
                        category=cat,
                        status=st,
                        base_price=price,
                        x=sx,
                        y=sy,
                        angle=ang,
                        color=clr
                    ))

            # Clean up stale seats not present in active_ids before bulk operations to avoid unique constraint conflicts
            stale_seats = Seat.objects.filter(theater=self).exclude(id__in=active_ids)
            stale_seats.filter(ticket__isnull=True).delete()

            if seats_to_update:
                Seat.objects.bulk_update(
                    seats_to_update,
                    ['section', 'row', 'number', 'category', 'status', 'base_price', 'x', 'y', 'angle', 'color'],
                    batch_size=500
                )

            if seats_to_create:
                Seat.objects.bulk_create(seats_to_create, batch_size=500)

            # Sync GA Zones
            elements_data = self.layout.get('map_elements', []) if isinstance(self.layout, dict) else []
            active_ga_ids = set()
            for el_data in elements_data:
                if el_data.get('isGA'):
                    ext_id = el_data.get('id')
                    active_ga_ids.add(ext_id)
                    GADeclaration.objects.update_or_create(
                        theater=self,
                        external_id=ext_id,
                        defaults={
                            'name': el_data.get('label', 'General Admission'),
                            'capacity': el_data.get('capacity', 0),
                            'category': el_data.get('category', 'standard'),
                            'base_price': el_data.get('base_price', 500)
                        }
                    )
            GADeclaration.objects.filter(theater=self).exclude(external_id__in=active_ga_ids).delete()
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

PARTICLE_SHAPE_CHOICES = [
    ('circle', 'Círculo (Mundo)'),
    ('moon', 'Media Luna'),
    ('cactus', 'Cactus / Desierto'),
    ('star', 'Estrella (Brillo)'),
    ('triangle', 'Triángulo Místico'),
    ('polygon', 'Polígono Geométrico'),
    ('infinity', 'Símbolo Infinito'),
    ('hexagon', 'Hexágono Futuro'),
    ('sun', 'Sol Radiante'),
    ('wave', 'Ondas Fluídas'),
    ('spiral', 'Espiral Mística'),
    ('music', 'Nota Musical'),
    ('eye', 'Ojo / Visión'),
    ('love', 'Corazón / Amor'),
    ('bee', 'Abeja / Colmena'),
    ('eclipse', 'Eclipse Sombra'),
    ('none', 'Partículas Libres (Sin forma)'),
]

CARD_STYLE_CHOICES = [
    ('rounded-full', 'Ultra Suave / Redondeado Total (Píldoras y Cristal)'),
    ('rounded-2xl', 'Moderno (Esquinas Medias Elegantes)'),
    ('rounded-lg', 'Clásico (Esquinas Sutiles)'),
    ('rounded-none', 'Recto / Neobrutalismo'),
]

BACKGROUND_PATTERN_CHOICES = [
    ('stars', 'Estrellas Doradas Flotantes'),
    ('grid', 'Malla Geométrica Futurista'),
    ('dots', 'Puntos Sutiles Minimalistas'),
    ('waves', 'Ondas Gradientes Suaves'),
    ('none', 'Limpio (Solo degradado)'),
]

FONT_PRESET_CHOICES = [
    ('cormorant', 'Cormorant Garamond (Elegante & Místico)'),
    ('outfit', 'Outfit / Inter (Moderno & Tecnológico)'),
    ('cinzel', 'Cinzel Decorative (Editorial & Lujo)'),
    ('syne', 'Syne (Vanguardista & Artístico)'),
]


class Event(models.Model):
    EVENT_TYPES = [
        ('concert', 'Concierto / Venue'),
        ('meet_greet', 'Meet & Greet (Convivencia)'),
    ]
    title = models.CharField(max_length=255)
    slug = models.CharField(max_length=255, default='alguna parte del mundo.')
    artist = models.CharField(max_length=255)
    date = models.DateTimeField()
    doors_open = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(
        default=120, 
        help_text="Duración estimada del evento en minutos. Útil para calcular la hora de finalización."
    )
    venue_name = models.CharField(max_length=255, blank=True, default='')
    venue_address = models.CharField(max_length=255, blank=True, default='')
    theater = models.ForeignKey('Theater', on_delete=models.CASCADE, null=True, blank=True, related_name='events')
    image = models.ImageField(upload_to='events/', null=True, blank=True)
    flyer = models.ImageField(
        upload_to='event_flyers/',
        null=True,
        blank=True,
        help_text="Imagen del flyer oficial del evento. Se muestra en la landing page y en la página de compra de boletos."
    )
    is_active = models.BooleanField(default=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES, default='concert')
    #discount code to validate purchase
    discount_code = models.CharField(max_length=255, blank=True, null=True)

    # Meet & Greet Logic
    mg_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    mg_limit = models.PositiveIntegerField(default=0)

    # Seatless & Numbered Ticket base price options
    allow_seatless_tickets = models.BooleanField(default=True, help_text="Permite la compra de boletos generales sin asiento reservado")
    allow_numbered_tickets = models.BooleanField(default=True, help_text="Permite la compra de boletos numerados reservables en mapa del teatro")
    seatless_ticket_price = models.DecimalField(max_digits=10, decimal_places=2, default=500.00, help_text="Precio base de boleto general sin asiento")
    numbered_ticket_price = models.DecimalField(max_digits=10, decimal_places=2, default=1000.00, help_text="Precio base de boleto numerado reservado")

    # Price multiplier for this specific event
    price_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=1.0)

    # Configurable Monthly Dynamic Pricing Strategy
    enable_dynamic_pricing = models.BooleanField(default=True, help_text="Activa el ajuste dinámico mensual de precios previo al evento")
    monthly_price_increment = models.DecimalField(max_digits=10, decimal_places=2, default=50.00, help_text="Monto de incremento mensual (ej. $50.00 MXN)")

    # Personalización del Tema Visual del Evento (Sobrescribe SiteSettings si se define)
    primary_color = models.CharField(max_length=50, blank=True, null=True, help_text="Color primario de acentos, botones y luces (ej. #E5A93B). Dejar en blanco para usar configuración global.")
    secondary_color = models.CharField(max_length=50, blank=True, null=True, help_text="Color secundario (ej. #22A6B7)")
    background_start = models.CharField(max_length=50, blank=True, null=True, help_text="Color inicio degradado fondo (ej. #080c0a)")
    background_end = models.CharField(max_length=50, blank=True, null=True, help_text="Color fin degradado fondo (ej. #040605)")
    accent_color = models.CharField(max_length=50, blank=True, null=True, help_text="Color de resplandor / detalles (ej. #9F2B00)")
    card_background = models.CharField(max_length=50, blank=True, null=True, help_text="Color de fondo de tarjetas de cristal (ej. #0c0f0d)")
    text_color = models.CharField(max_length=50, blank=True, null=True, help_text="Color principal del texto (ej. #F4F6F0)")
    particle_shape = models.CharField(max_length=50, choices=PARTICLE_SHAPE_CHOICES, blank=True, null=True, help_text="Figura geométrica del Canvas de partículas")
    particle_density = models.IntegerField(default=65, blank=True, null=True, help_text="Densidad de partículas (10 a 200)")
    particle_speed = models.FloatField(default=1.0, blank=True, null=True, help_text="Velocidad de partículas (0.1 a 5.0)")
    particle_color = models.CharField(max_length=50, blank=True, null=True, help_text="Color de partículas (ej. #E5A93B)")
    card_style = models.CharField(max_length=50, choices=CARD_STYLE_CHOICES, blank=True, null=True, help_text="Estilo de bordes de tarjetas y botones")
    background_pattern = models.CharField(max_length=50, choices=BACKGROUND_PATTERN_CHOICES, blank=True, null=True, help_text="Patrón visual de fondo")
    font_preset = models.CharField(max_length=50, choices=FONT_PRESET_CHOICES, blank=True, null=True, help_text="Preset de fuentes tipográficas")
    custom_css = models.TextField(blank=True, null=True, help_text="CSS personalizado para este evento específico")
    section_themes = models.JSONField(default=dict, blank=True, null=True, help_text="Configuración visual granular por sección (Hero, Boletos, Mapa, Contacto, Tarot, etc.)")

    stripe_product_id = models.CharField(max_length=255, blank=True, null=True, help_text="ID del producto en Stripe para este evento")
    stripe_price_id = models.CharField(max_length=255, blank=True, null=True, help_text="ID del precio en Stripe (solo para Meet & Greet o general)")

    def get_theme_config(self):
        site_theme = SiteSettings.get().get_theme_config()
        merged_section_themes = dict(site_theme.get('section_themes', {}) or {})
        if self.section_themes and isinstance(self.section_themes, dict):
            for s_key, s_val in self.section_themes.items():
                if isinstance(s_val, dict):
                    merged_section_themes[s_key] = {**merged_section_themes.get(s_key, {}), **s_val}
                else:
                    merged_section_themes[s_key] = s_val

        return {
            'primary_color': self.primary_color or site_theme['primary_color'],
            'secondary_color': self.secondary_color or site_theme['secondary_color'],
            'background_start': self.background_start or site_theme['background_start'],
            'background_end': self.background_end or site_theme['background_end'],
            'accent_color': self.accent_color or site_theme['accent_color'],
            'card_background': self.card_background or site_theme['card_background'],
            'text_color': self.text_color or site_theme['text_color'],
            'particle_shape': self.particle_shape or site_theme['particle_shape'],
            'particle_density': self.particle_density if self.particle_density is not None else site_theme.get('particle_density', 65),
            'particle_speed': self.particle_speed if self.particle_speed is not None else site_theme.get('particle_speed', 1.0),
            'particle_color': self.particle_color or site_theme.get('particle_color', ''),
            'card_style': self.card_style or site_theme['card_style'],
            'background_pattern': self.background_pattern or site_theme['background_pattern'],
            'font_preset': self.font_preset or site_theme['font_preset'],
            'custom_css': (self.custom_css or '') + ('\n' + site_theme['custom_css'] if site_theme['custom_css'] else ''),
            'section_themes': merged_section_themes,
        }

    def save(self, *args, **kwargs):
        if self.theater:
            if not self.venue_name:
                self.venue_name = self.theater.name
            if not self.venue_address:
                self.venue_address = self.theater.location
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
                discount_product = stripe.Product.create(
                    name=f"[Descuento] {self.title}",
                    description=f"Descuento para el evento {self.title} de {self.artist}.",
                    metadata={"event_id": str(self.id), "event_slug": event_slug}
                )

                if self.event_type == 'meet_greet':
                    # Fetch active prices for this product to avoid duplicates
                    prices = stripe.Price.list(product=product.id, active=True)
                    price_id = None
                    discount_price_id = None
                    discount_amount_cents = int(self.mg_price * 100 * 0.9)
                    amount_cents = int(self.mg_price * 100)
                    for p in prices.data:
                        if not p.recurring and p.unit_amount == discount_amount_cents and p.currency == "mxn":
                            discount_price_id = p.id
                            break
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

                    if not discount_price_id:
                        discount_price_obj = stripe.Price.create(
                            unit_amount=discount_amount_cents,
                            currency="mxn",
                            product=discount_product.id,
                        )
                        discount_price_id = discount_price_obj.id

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

        # Asegurar creación de la MarketingList para el evento
        try:
            from apps.blog.models import MarketingList
            from django.utils.text import slugify
            event_slug = slugify(self.title)
            MarketingList.objects.get_or_create(
                event=self,
                defaults={
                    'name': f"Compradores - {self.title}",
                    'description': f"Contactos que adquirieron boletos para el evento: {self.title}",
                    'slug': f"compradores-{event_slug}-{self.id}"
                }
            )
        except Exception as e:
            import logging
            logging.getLogger("apps").warning(f"Error creating MarketingList for Event {self.title}: {e}")

    def __str__(self):
        return f"{self.title} - {self.date.strftime('%Y-%m-%d')}"

    def get_dynamic_price(self, base_amount, purchase_date=None):
        """
        [Nectar Dynamic Pricing Engine]
        Garantiza un precio mínimo establecido (base_amount) tanto para asientos numerados
        como para asientos generales. La tarifa se mantiene en su mínimo y SOLO AUMENTA
        durante los últimos 3 meses previos hasta el día del evento.
        """
        if base_amount is None:
            return 0.0
        amount = float(base_amount)
        if amount <= 0:
            return 0.0
        if not self.enable_dynamic_pricing or not self.date:
            return round(amount, 2)
        
        from django.utils import timezone
        p_date = purchase_date or timezone.now()
        event_month_idx = self.date.year * 12 + self.date.month
        curr_month_idx = p_date.year * 12 + p_date.month
        months_diff = event_month_idx - curr_month_idx

        # A 2 o más meses de anticipación (ej. agosto o antes para evento en octubre): tarifa base (0 aumentos)
        if months_diff >= 2:
            return round(amount, 2)

        # En los últimos meses antes/del evento: máximo 2 incrementos (1 al pasar de ago a sep, 2 al pasar de sep a oct)
        increments = 2 - max(0, months_diff)
        increment = float(self.monthly_price_increment or 50.00)
        increase = increments * increment

        # Garantizar que nunca sea menor a la tarifa mínima establecida (base_amount)
        final_price = max(amount, amount + increase)
        return round(final_price, 2)

    @property
    def effective_seatless_ticket_price(self):
        """Precio actual del boleto general con tarifa mínima y ajuste dinámico en últimos 3 meses."""
        base = float(self.seatless_ticket_price if self.seatless_ticket_price is not None else 500.00)
        return self.get_dynamic_price(base)

    @property
    def mg_available(self):
        sold = self.tickets.filter(status='paid', has_mg=True).count()
        return max(0, self.mg_limit - sold)

    @property
    def numbered_seat_base_price(self):
        """Retorna el precio dinámico base del boleto numerado."""
        if self.numbered_ticket_price is not None and float(self.numbered_ticket_price) > 0:
            raw_base = float(self.numbered_ticket_price) * float(self.price_multiplier or 1.0)
            return self.get_dynamic_price(raw_base)
        if self.theater:
            from apps.tickets.models import Seat
            min_seat = self.theater.seats.filter(base_price__gt=0).order_by('base_price').first()
            if min_seat:
                raw_base = float(min_seat.base_price * self.price_multiplier)
                return self.get_dynamic_price(raw_base)
        return self.get_dynamic_price(1000.00)

    @property
    def base_price(self):
        """
        [Nectar Base Price Property]
        Retorna el precio de entrada base mínimo del evento (asiento numerado o boleto general).
        Garantiza que nunca se devuelva 0.00 MXN salvo en eventos explícitamente gratuitos.
        """
        if self.event_type == 'meet_greet':
            return float(self.mg_price or 0.0)
        
        prices = []
        if self.allow_seatless_tickets and self.seatless_ticket_price is not None:
            prices.append(float(self.effective_seatless_ticket_price))

        if self.allow_numbered_tickets:
            prices.append(float(self.numbered_seat_base_price))

        if prices:
            return min(prices)
        
        return float(self.effective_seatless_ticket_price or self.numbered_seat_base_price or 0.0)

    @property
    def end_date(self):
        """Calcula de forma dinámica la hora de finalización del show."""
        if self.date and self.duration_minutes:
            return self.date + timedelta(minutes=self.duration_minutes)
        return None

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
    color = models.CharField(max_length=50, blank=True, default='')

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

class Coupon(models.Model):
    COUPON_TYPES = [
        ('free_vip', 'Entrada Gratuita VIP (100% Descuento)'),
        ('percentage', 'Porcentaje de Descuento'),
        ('fixed', 'Monto Fijo de Descuento'),
    ]
    code = models.CharField(max_length=50, unique=True, help_text="Código único del cupón (ej. VIP-AMBAR-2026)")
    discount_type = models.CharField(max_length=20, choices=COUPON_TYPES, default='free_vip')
    discount_value = models.DecimalField(max_digits=7, decimal_places=2, default=100.00, help_text="Porcentaje (0-100) o monto fijo en MXN")
    max_uses = models.PositiveIntegerField(default=1, help_text="Límite de redenciones del cupón")
    times_used = models.PositiveIntegerField(default=0, help_text="Veces que ha sido redimido")
    is_active = models.BooleanField(default=True)
    event = models.ForeignKey(Event, on_delete=models.SET_NULL, null=True, blank=True, related_name='coupons', help_text="Evento específico (opcional)")
    assigned_email = models.EmailField(null=True, blank=True, help_text="Correo electrónico exclusivo al que está asignado este cupón (opcional)")
    expiration_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid_for_event(self, event, user_email=None):
        from django.utils import timezone
        if not self.is_active:
            return False, "Este cupón no está activo."
        if self.expiration_date and timezone.now() > self.expiration_date:
            return False, "Este cupón ha expirado."
        if self.times_used >= self.max_uses:
            return False, "Este cupón ha alcanzado su límite máximo de usos."
        if event and self.event and self.event_id != event.id:
            return False, "Este cupón no es válido para este evento."
        if self.assigned_email:
            if not user_email:
                return False, f"Este cupón es exclusivo y personal. Ingresa el correo del invitado ({self.assigned_email}) para validar."
            if self.assigned_email.strip().lower() != user_email.strip().lower():
                return False, f"Este cupón exclusivo fue asignado a {self.assigned_email} y no es válido para {user_email}."
        return True, "Cupón válido."

    def __str__(self):
        return f"{self.code} ({self.get_discount_type_display()}) - {self.times_used}/{self.max_uses} usos"

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
    used_coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    user_email = models.EmailField()
    user_phone = models.CharField(max_length=20, null=True, blank=True)
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='reserved')
    is_scanned = models.BooleanField(default=False)
    scanned_at = models.DateTimeField(null=True, blank=True)
    
    # Meet & Greet Upgrade
    has_mg = models.BooleanField(default=False)
    
    # Stripe Session ID & Financial Record
    stripe_session_id = models.CharField(max_length=255, blank=True, null=True, help_text="ID de la sesión de checkout de Stripe")
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Monto real cobrado por el boleto al momento de la compra")
    
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

    # Configuración de Biografía (Index)
    bio_badge = models.CharField(max_length=255, default="La Cantautora", help_text="Badge superior de la sección de biografía.")
    bio_title = models.CharField(max_length=255, default="Ms. Ambar", help_text="Título principal de la biografía.")
    bio_image = models.ImageField(upload_to='site_settings/', null=True, blank=True, help_text="Imagen oficial de la biografía en el index.")
    bio_location = models.CharField(max_length=255, default="Hermosillo • México", help_text="Ubicación o pie de biografía.")
    bio_content = models.TextField(
        blank=True, null=True,
        default='Ms. Ambar, nombre artístico de la cantautora originaria de Hermosillo, Sonora, es una figura destacada en la música latina por su fusión de géneros como R&B, soul, regional mexicano y bachata. Su carrera profesional comenzó en 2017 con la banda "Moonset", pero consolidó su relevancia al unirse a la gira del rapero mexicano Charles Ans en 2022, actuando como telonera en grandes escenarios como el Auditorio Nacional.\n\nSu primer álbum formal, "14•28", fue lanzado en octubre de 2024; el título hace referencia a la numerología y a fechas significativas. A través de su música, busca conectar emocionalmente con el público compartiendo historias autobiográficas y reflexiones sobre la vida, la muerte y las memorias.\n\nUn hito reciente en su trayectoria fue su selección para representar a México en la categoría folclórica del Festival de Viña del Mar 2025, con la canción "No te voy a llorar", consolidándose como una de las artistas más prometedoras de la nueva generación musical mexicana.',
        help_text="Texto completo de la biografía. Separa párrafos con salto de línea."
    )
    bio_cta_text = models.CharField(max_length=255, default="Ver Próximos Eventos", help_text="Texto del botón CTA de biografía.")
    bio_cta_url = models.CharField(max_length=255, default="/tour", help_text="URL o enlace del botón CTA de biografía.")

    # Configuración Global de Tema Visual (Valores por defecto para todo el sitio)
    primary_color = models.CharField(max_length=50, default='#E5A93B', help_text="Color primario de acentos, botones y luces (ej. #E5A93B)")
    secondary_color = models.CharField(max_length=50, default='#22A6B7', help_text="Color secundario (ej. #22A6B7)")
    background_start = models.CharField(max_length=50, default='#080c0a', help_text="Color inicio degradado fondo (ej. #080c0a)")
    background_end = models.CharField(max_length=50, default='#040605', help_text="Color fin degradado fondo (ej. #040605)")
    accent_color = models.CharField(max_length=50, default='#9F2B00', help_text="Color de resplandor / detalles (ej. #9F2B00)")
    card_background = models.CharField(max_length=50, default='#0c0f0d', help_text="Color de fondo de tarjetas de cristal (ej. #0c0f0d)")
    text_color = models.CharField(max_length=50, default='#F4F6F0', help_text="Color principal del texto (ej. #F4F6F0)")

    # Estados Interactivos (Hover & Focus - Accesibilidad WCAG AA)
    button_hover_bg = models.CharField(max_length=50, default='#FFC048', help_text="Color de fondo hover en botones")
    button_hover_text = models.CharField(max_length=50, default='#080c0a', help_text="Color de texto hover en botones")
    button_focus_ring = models.CharField(max_length=50, default='#E5A93B', help_text="Color de anillo focus en botones")
    card_hover_bg = models.CharField(max_length=50, default='#121714', help_text="Color de fondo hover en tarjetas")
    card_hover_border = models.CharField(max_length=50, default='#E5A93B', help_text="Color de borde hover en tarjetas")
    card_focus_ring = models.CharField(max_length=50, default='#22A6B7', help_text="Color de anillo focus en tarjetas")
    element_hover_color = models.CharField(max_length=50, default='#FFC048', help_text="Color hover para elementos interactivos")
    element_focus_ring = models.CharField(max_length=50, default='#E5A93B', help_text="Color focus para elementos interactivos")

    # Personalización Avanzada de Secciones y Contenedores (Degradados, Sombras y Bordes)
    background_gradient = models.CharField(max_length=255, default='', blank=True, null=True, help_text="Degradado CSS de fondo (ej. linear-gradient(135deg, #080c0a 0%, #040605 100%))")
    card_box_shadow = models.CharField(max_length=255, default='', blank=True, null=True, help_text="Sombra dinámica de tarjetas (ej. 0 10px 30px rgba(0,0,0,0.5))")
    border_width = models.CharField(max_length=20, default='1px', blank=True, null=True, help_text="Grosor de borde de contenedor (ej. 1px, 2px)")
    border_opacity = models.FloatField(default=0.25, blank=True, null=True, help_text="Opacidad de borde de 0.0 a 1.0")
    border_style_preset = models.CharField(max_length=50, default='solid', blank=True, null=True, help_text="Estilo de borde (solid, glass, dashed, dotted)")

    particle_shape = models.CharField(max_length=50, choices=PARTICLE_SHAPE_CHOICES, default='moon', help_text="Figura geométrica del Canvas de partículas")
    particle_density = models.IntegerField(default=65, help_text="Densidad de partículas (10 a 200)")
    particle_speed = models.FloatField(default=1.0, help_text="Velocidad de partículas (0.1 a 5.0)")
    particle_color = models.CharField(max_length=50, blank=True, null=True, default='', help_text="Color de partículas (ej. #E5A93B)")
    card_style = models.CharField(max_length=50, choices=CARD_STYLE_CHOICES, default='rounded-full', help_text="Estilo de bordes de tarjetas y botones")
    background_pattern = models.CharField(max_length=50, choices=BACKGROUND_PATTERN_CHOICES, default='stars', help_text="Patrón visual de fondo")
    theme_mode = models.CharField(max_length=20, default='global', help_text="Modo de aplicación de tema: 'global' o 'section'")
    font_preset = models.CharField(max_length=50, choices=FONT_PRESET_CHOICES, default='cormorant', help_text="Preset de fuentes tipográficas")
    allow_canvas_zoom = models.BooleanField(default=True, help_text="Permite o bloquea el zoom interactivo en el canvas de selección de asientos")
    pass_fees_to_buyer = models.BooleanField(default=True, help_text="Si está activo, transfiere el recargo (Gross-Up) del 3.6% + $3.00 MXN al comprador en Checkout para recibir el 100% íntegro de la venta en banco.")
    custom_css = models.TextField(blank=True, null=True, default='', help_text="CSS personalizado global para todo el sitio")
    section_themes = models.JSONField(default=dict, blank=True, null=True, help_text="Configuración visual granular por sección del sitio (Hero, Boletos, Mapa, Contacto, Tarot, etc.)")

    def get_theme_config(self):
        bio_image_str = None
        if self.bio_image and getattr(self.bio_image, 'name', None):
            try:
                bio_image_str = self.bio_image.url
            except (ValueError, AttributeError):
                bio_image_str = str(self.bio_image) if self.bio_image.name else None

        sec_themes = self.section_themes or {}
        bio_sec = sec_themes.get('biography', {})
        bio_merged = {
            'bio_badge': bio_sec.get('bio_badge', self.bio_badge),
            'bio_title': bio_sec.get('bio_title', self.bio_title),
            'bio_content': bio_sec.get('bio_content', self.bio_content),
            'bio_image': bio_sec.get('bio_image', bio_image_str),
            'bio_location': bio_sec.get('bio_location', self.bio_location),
            'bio_cta_text': bio_sec.get('bio_cta_text', self.bio_cta_text),
            'bio_cta_url': bio_sec.get('bio_cta_url', self.bio_cta_url),
            **bio_sec
        }
        sec_themes['biography'] = bio_merged

        return {
            'theme_mode': self.theme_mode or 'global',
            'primary_color': self.primary_color or '#E5A93B',
            'secondary_color': self.secondary_color or '#22A6B7',
            'background_start': self.background_start or '#080c0a',
            'background_end': self.background_end or '#040605',
            'background_gradient': getattr(self, 'background_gradient', '') or '',
            'accent_color': self.accent_color or '#9F2B00',
            'card_background': self.card_background or '#0c0f0d',
            'card_box_shadow': getattr(self, 'card_box_shadow', '') or '',
            'border_width': getattr(self, 'border_width', '1px') or '1px',
            'border_opacity': getattr(self, 'border_opacity', 0.25) if getattr(self, 'border_opacity', None) is not None else 0.25,
            'border_style_preset': getattr(self, 'border_style_preset', 'solid') or 'solid',
            'text_color': self.text_color or '#F4F6F0',
            'button_hover_bg': getattr(self, 'button_hover_bg', '#FFC048') or '#FFC048',
            'button_hover_text': getattr(self, 'button_hover_text', '#080c0a') or '#080c0a',
            'button_focus_ring': getattr(self, 'button_focus_ring', '#E5A93B') or '#E5A93B',
            'card_hover_bg': getattr(self, 'card_hover_bg', '#121714') or '#121714',
            'card_hover_border': getattr(self, 'card_hover_border', '#E5A93B') or '#E5A93B',
            'card_focus_ring': getattr(self, 'card_focus_ring', '#22A6B7') or '#22A6B7',
            'element_hover_color': getattr(self, 'element_hover_color', '#FFC048') or '#FFC048',
            'element_focus_ring': getattr(self, 'element_focus_ring', '#E5A93B') or '#E5A93B',
            'particle_shape': self.particle_shape or 'moon',
            'particle_density': getattr(self, 'particle_density', 65) if getattr(self, 'particle_density', None) is not None else 65,
            'particle_speed': getattr(self, 'particle_speed', 1.0) if getattr(self, 'particle_speed', None) is not None else 1.0,
            'particle_color': getattr(self, 'particle_color', '') or '',
            'card_style': self.card_style or 'rounded-full',
            'background_pattern': self.background_pattern or 'stars',
            'font_preset': self.font_preset or 'cormorant',
            'custom_css': self.custom_css or '',
            'bio_badge': self.bio_badge,
            'bio_title': self.bio_title,
            'bio_content': self.bio_content,
            'bio_image': bio_image_str,
            'bio_location': self.bio_location,
            'bio_cta_text': self.bio_cta_text,
            'bio_cta_url': self.bio_cta_url,
            'pass_fees_to_buyer': self.pass_fees_to_buyer,
            'section_themes': sec_themes,
        }

    class Meta:
        verbose_name = "Configuración del Sitio"
        verbose_name_plural = "Configuración del Sitio"

    def save(self, *args, **kwargs):
        """Forzar siempre pk=1 (singleton) y purgar caché del tema en producción."""
        self.pk = 1
        super().save(*args, **kwargs)
        try:
            from django.core.cache import cache
            cache.delete('ms_ambar_active_theme_global')
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error al purgar la caché del tema activo tras guardar SiteSettings: {e}")

    def delete(self, *args, **kwargs):
        """Prevenir la eliminación del registro singleton de configuración."""
        import logging
        from django.core.exceptions import ValidationError
        
        logger = logging.getLogger(__name__)
        logger.warning(f"Intento bloqueado de eliminar el registro singleton SiteSettings con pk={self.pk}")
        
        raise ValidationError("El registro de configuración global (singleton) no puede ser eliminado.")

    @classmethod
    def get(cls):
        """Obtiene (o crea si no existe) la instancia singleton."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Configuración Global del Sitio"
