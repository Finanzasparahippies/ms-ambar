from rest_framework import serializers
from .models import Event, Theater, Seat, Ticket, GADeclaration, SiteSettings, Coupon
from .fees import calculate_total_with_fee, get_fee_config


class HybridImageField(serializers.ImageField):
    """
    Soporta tanto archivos binarios (multipart upload) como URLs directas
    en string (Cloudinary o CDN tras optimización), garantizando siempre
    la entrega de URLs seguras absolutas en la API.
    """
    def to_internal_value(self, data):
        if data == '' or data is None:
            if self.allow_null:
                return None
            return ''
        if isinstance(data, str):
            return data.strip()
        return super().to_internal_value(data)

    def to_representation(self, value):
        if not value:
            return None

        val_str = getattr(value, 'name', None) or str(value) or ''

        import re

        # 1. Si ya contiene res.cloudinary.com, asegurar esquema https limpio y sin dobles barras
        if 'res.cloudinary.com' in val_str:
            idx = val_str.find('res.cloudinary.com')
            path_part = val_str[idx + len('res.cloudinary.com'):]
            clean_url = f"https://res.cloudinary.com{path_part}"
            clean_url = re.sub(r'(https://res\.cloudinary\.com)/+', r'\1/', clean_url)
            return clean_url.replace('/ms_ambar/prod/ms-ambar/', '/ms-ambar/').replace('/ms_ambar/staging/ms-ambar/', '/ms-ambar/')

        if val_str.startswith('http://') or val_str.startswith('https://'):
            return val_str

        # 2. Si es un FieldFile con storage
        try:
            url = getattr(value, 'url', None)
            if url and isinstance(url, str):
                if 'res.cloudinary.com' in url:
                    idx = url.find('res.cloudinary.com')
                    path_part = url[idx + len('res.cloudinary.com'):]
                    clean_url = f"https://res.cloudinary.com{path_part}"
                    clean_url = re.sub(r'(https://res\.cloudinary\.com)/+', r'\1/', clean_url)
                    return clean_url.replace('/ms_ambar/prod/ms-ambar/', '/ms-ambar/').replace('/ms_ambar/staging/ms-ambar/', '/ms-ambar/')
                return url
        except (ValueError, AttributeError):
            pass
        except Exception as exc:
            import logging
            logging.getLogger('apps.tickets').debug(f"Error accediendo a value.url en HybridImageField: {exc}")

        # 3. Construir URL limpia sin prefijos duplicados
        from django.conf import settings
        cloud_name = getattr(settings, 'CLOUDINARY_STORAGE', {}).get('CLOUD_NAME', '')
        if cloud_name and val_str:
            clean_path = val_str.lstrip('/')
            prefix = getattr(settings, 'CLOUDINARY_STORAGE', {}).get('PREFIX', '')
            if prefix and not clean_path.startswith(prefix) and not clean_path.startswith('ms_ambar/') and not clean_path.startswith('ms-ambar/'):
                clean_path = f"{prefix}{clean_path}"
            clean_path = re.sub(r'/+', '/', clean_path)
            return f"https://res.cloudinary.com/{cloud_name}/image/upload/{clean_path}"
        return str(value)


SafeImageField = HybridImageField


class SeatSerializer(serializers.ModelSerializer):
    row_label = serializers.SerializerMethodField()
    row_letter = serializers.SerializerMethodField()
    is_complimentary_eligible = serializers.SerializerMethodField()

    class Meta:
        model = Seat
        fields = [
            'id', 'section', 'row', 'number', 'category', 'status',
            'base_price', 'x', 'y', 'angle', 'color', 'row_label',
            'row_letter', 'is_complimentary_eligible'
        ]

    def get_row_letter(self, obj):
        import re
        r = str(obj.row or '').strip()
        cleaned = re.sub(r'^fila\s*', '', r, flags=re.IGNORECASE).strip()
        if cleaned and not cleaned.lower().startswith('mesa'):
            return cleaned.upper()
        return ''

    def get_row_label(self, obj):
        r = str(obj.row or '').strip()
        if not r:
            return ''
        low = r.lower()
        if low.startswith('mesa') or low.startswith('table'):
            return r if low.startswith('mesa') else f"Mesa {r[5:].strip()}"
        if low.startswith('fila'):
            return r
        return f"Fila {r.upper()}"

    def get_is_complimentary_eligible(self, obj):
        allowed_rows = self.context.get('allowed_complimentary_rows')
        if not allowed_rows or not isinstance(allowed_rows, list):
            return False
        from apps.tickets.services.coupon_validator import normalize_row_name
        seat_norm = normalize_row_name(obj.row)
        for allowed in allowed_rows:
            if normalize_row_name(allowed) == seat_norm:
                return True
        return False


class GADeclarationSerializer(serializers.ModelSerializer):
    class Meta:
        model = GADeclaration
        fields = '__all__'


class TheaterSerializer(serializers.ModelSerializer):
    seats = SeatSerializer(many=True, read_only=True)
    ga_zones = GADeclarationSerializer(many=True, read_only=True)

    class Meta:
        model = Theater
        fields = '__all__'


class CouponSerializer(serializers.ModelSerializer):
    event_title = serializers.ReadOnlyField(source='event.title', default=None)

    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'discount_type', 'discount_value', 'max_uses', 'times_used',
            'is_active', 'event', 'event_title', 'assigned_email', 'allowed_emails',
            'requires_seat', 'is_complimentary', 'complimentary_allocation_mode',
            'complimentary_rows_priority',
            'expiration_date', 'created_at'
        ]


class EventSerializer(serializers.ModelSerializer):
    theater_name = serializers.SerializerMethodField()
    theater_location = serializers.SerializerMethodField()
    image = HybridImageField(required=False, allow_null=True)
    flyer = HybridImageField(required=False, allow_null=True)
    image_url = serializers.SerializerMethodField()
    flyer_url = serializers.SerializerMethodField()
    local_date = serializers.SerializerMethodField()
    local_doors_open = serializers.SerializerMethodField()
    base_price = serializers.SerializerMethodField()
    numbered_seat_base_price = serializers.SerializerMethodField()
    price_with_fee = serializers.SerializerMethodField()
    theme_config = serializers.ReadOnlyField(source='get_theme_config')

    class Meta:
        model = Event
        fields = [
            'id', 'title', 'artist', 'date', 'doors_open',
            'timezone', 'local_date', 'local_doors_open',
            'venue_name', 'venue_address', 'duration_minutes',
            'theater', 'theater_name', 'theater_location',
            'image', 'image_url', 'flyer', 'flyer_url',
            'is_active', 'mg_price', 'mg_limit', 'mg_available',
            'allow_seatless_tickets', 'allow_numbered_tickets', 'seatless_ticket_price', 'numbered_ticket_price',
            'enable_dynamic_pricing', 'monthly_price_increment', 'effective_seatless_ticket_price',
            'price_multiplier', 'event_type',
            'stripe_product_id', 'stripe_price_id',
            'base_price', 'numbered_seat_base_price', 'price_with_fee',
            'theme_config',
            'complimentary_rows_priority',
            'primary_color', 'secondary_color', 'background_start', 'background_end',
            'accent_color', 'card_background', 'text_color', 'particle_shape', 'particle_density', 'particle_speed', 'particle_color', 'particle_shadow',
            'card_style', 'background_pattern', 'font_preset', 'custom_css', 'section_themes'
        ]
        extra_kwargs = {
            'venue_name': {'required': False, 'allow_blank': True},
            'venue_address': {'required': False, 'allow_blank': True},
        }

    def _resolve_media_url(self, value, fallback=None):
        if not value:
            return fallback

        val_str = getattr(value, 'name', None) or str(value) or ''
        if not val_str:
            return fallback

        import re

        # 1. Si ya es una URL de Cloudinary, normalizar a https y limpiar dobles barras
        if 'res.cloudinary.com' in val_str:
            idx = val_str.find('res.cloudinary.com')
            path_part = val_str[idx + len('res.cloudinary.com'):]
            clean_url = f"https://res.cloudinary.com{path_part}"
            clean_url = re.sub(r'(https://res\.cloudinary\.com)/+', r'\1/', clean_url)
            return clean_url.replace('/ms_ambar/prod/ms-ambar/', '/ms-ambar/').replace('/ms_ambar/staging/ms-ambar/', '/ms-ambar/')

        if val_str.startswith('http://') or val_str.startswith('https://'):
            return val_str

        # 2. Intentar resolver vía storage del FieldFile
        try:
            url = getattr(value, 'url', None)
            if url and isinstance(url, str):
                if 'res.cloudinary.com' in url:
                    idx = url.find('res.cloudinary.com')
                    path_part = url[idx + len('res.cloudinary.com'):]
                    clean_url = f"https://res.cloudinary.com{path_part}"
                    clean_url = re.sub(r'(https://res\.cloudinary\.com)/+', r'\1/', clean_url)
                    return clean_url.replace('/ms_ambar/prod/ms-ambar/', '/ms-ambar/').replace('/ms_ambar/staging/ms-ambar/', '/ms-ambar/')
                request = self.context.get('request')
                if request and not url.startswith('http'):
                    return request.build_absolute_uri(url)
                return url
        except (ValueError, AttributeError):
            pass
        except Exception as exc:
            import logging
            logging.getLogger('apps.tickets').debug(f"Error accediendo a value.url en _resolve_media_url: {exc}")

        # 3. Fallback inteligente a Cloudinary URL con prefijo
        from django.conf import settings
        cloud_name = getattr(settings, 'CLOUDINARY_STORAGE', {}).get('CLOUD_NAME', '')
        if cloud_name and val_str:
            clean_path = val_str.lstrip('/')
            prefix = getattr(settings, 'CLOUDINARY_STORAGE', {}).get('PREFIX', '')
            if prefix and not clean_path.startswith(prefix) and not clean_path.startswith('ms_ambar/') and not clean_path.startswith('ms-ambar/'):
                clean_path = f"{prefix}{clean_path}"
            clean_path = re.sub(r'/+', '/', clean_path)
            return f"https://res.cloudinary.com/{cloud_name}/image/upload/{clean_path}"

        return fallback

    def get_theater_name(self, obj):
        return obj.theater.name if obj.theater else None

    def get_theater_location(self, obj):
        return obj.theater.location if obj.theater else None

    def get_image_url(self, obj):
        return self._resolve_media_url(obj.image, fallback=None)

    def get_flyer_url(self, obj):
        if not obj.flyer:
            return None
        return self._resolve_media_url(obj.flyer, fallback='/static/images/placeholder-event.webp')

    def get_local_date(self, obj):
        try:
            ld = obj.get_local_date()
            return ld.isoformat() if ld else None
        except Exception as exc:
            import logging
            logging.getLogger('apps.tickets').warning(f"Error al serializar local_date para Event #{obj.id}: {exc}")
            return obj.date.isoformat() if obj.date else None

    def get_local_doors_open(self, obj):
        try:
            ldo = obj.get_local_doors_open()
            return ldo.isoformat() if ldo else None
        except Exception as exc:
            import logging
            logging.getLogger('apps.tickets').warning(f"Error al serializar local_doors_open para Event #{obj.id}: {exc}")
            return obj.doors_open.isoformat() if obj.doors_open else None

    def get_base_price(self, obj):
        return obj.base_price

    def get_numbered_seat_base_price(self, obj):
        return obj.numbered_seat_base_price

    def get_price_with_fee(self, obj):
        """Returns fee breakdown for the lowest-priced ticket in this event."""
        return calculate_total_with_fee(obj.base_price)


class TicketSerializer(serializers.ModelSerializer):
    event_title = serializers.CharField(source='event.title', read_only=True)
    event_date = serializers.DateTimeField(source='event.date', read_only=True)
    event_artist = serializers.CharField(source='event.artist', read_only=True)
    theater_name = serializers.SerializerMethodField()
    theater_location = serializers.SerializerMethodField()
    seat_display = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = '__all__'

    def get_theater_name(self, obj):
        return obj.event.theater.name if obj.event and obj.event.theater else "Convivencia"

    def get_theater_location(self, obj):
        return obj.event.theater.location if obj.event and obj.event.theater else "Plataforma Digital"

    def get_seat_display(self, obj):
        if obj.seat:
            from apps.tickets.utils import format_seat_assignment
            return format_seat_assignment(obj.seat)
        if obj.ga_zone:
            return f"GA: {obj.ga_zone.name}"
        if obj.event and obj.event.event_type == 'meet_greet':
            return "Meet & Greet"
        return "General / Sin Asiento"


class SiteSettingsSerializer(serializers.ModelSerializer):
    fee_config = serializers.SerializerMethodField()
    theme_config = serializers.ReadOnlyField(source='get_theme_config')
    bio_image_url = serializers.SerializerMethodField()
    bio_image = SafeImageField(required=False, allow_null=True)

    class Meta:
        model = SiteSettings
        fields = [
            'tickets_page_subtitle', 'homepage_cta_text', 'fee_config', 'theme_config',
            'bio_badge', 'bio_title', 'bio_image', 'bio_image_url', 'bio_location', 'bio_content', 'bio_cta_text', 'bio_cta_url',
            'theme_mode', 'primary_color', 'secondary_color', 'background_start', 'background_end',
            'background_gradient', 'accent_color', 'card_background', 'card_box_shadow',
            'border_width', 'border_opacity', 'border_style_preset', 'text_color',
            'button_hover_bg', 'button_hover_text', 'button_focus_ring',
            'card_hover_bg', 'card_hover_border', 'card_focus_ring',
            'element_hover_color', 'element_focus_ring',
            'particle_shape', 'particle_density', 'particle_speed', 'particle_color', 'particle_shadow', 'card_style', 'background_pattern', 'font_preset', 'allow_canvas_zoom', 'custom_css', 'section_themes'
        ]

    def _sanitize_css_str(self, value: str, field_name: str) -> str:
        if not value:
            return ""
        val_lower = value.lower()
        forbidden_tokens = ['javascript:', 'expression(', 'behavior:', 'url(data:', '<script', '</script', '@import', 'binding:']
        for token in forbidden_tokens:
            if token in val_lower:
                raise serializers.ValidationError(f"Contenido no permitido o potencialmente peligroso en {field_name}.")
        return value

    def validate_custom_css(self, value):
        return self._sanitize_css_str(value, 'custom_css')

    def validate_background_gradient(self, value):
        return self._sanitize_css_str(value, 'background_gradient')

    def validate_card_box_shadow(self, value):
        return self._sanitize_css_str(value, 'card_box_shadow')

    def get_bio_image_url(self, obj):
        request = self.context.get('request')
        if obj.bio_image and getattr(obj.bio_image, 'name', None):
            try:
                if request:
                    return request.build_absolute_uri(obj.bio_image.url)
                return obj.bio_image.url
            except (ValueError, AttributeError):
                return None
        return None

    def get_fee_config(self, obj):
        return get_fee_config()


class AdminTicketSerializer(serializers.ModelSerializer):
    folio = serializers.SerializerMethodField()
    token = serializers.UUIDField(read_only=True)
    buyer = serializers.SerializerMethodField()
    buyer_name = serializers.SerializerMethodField()
    buyer_email = serializers.CharField(source='user_email', read_only=True)
    buyer_phone = serializers.CharField(source='user_phone', read_only=True)
    event = serializers.SerializerMethodField()
    event_id = serializers.IntegerField(source='event.id', read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    zone = serializers.SerializerMethodField()
    desglose = serializers.SerializerMethodField()
    row_letter = serializers.SerializerMethodField()
    table_number = serializers.SerializerMethodField()
    seat_number = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    raw_status = serializers.CharField(source='status', read_only=True)
    payment_reference = serializers.SerializerMethodField()
    coupon = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            'id',
            'folio',
            'token',
            'buyer',
            'buyer_name',
            'buyer_email',
            'buyer_phone',
            'event',
            'event_id',
            'event_title',
            'zone',
            'desglose',
            'row_letter',
            'table_number',
            'seat_number',
            'status',
            'raw_status',
            'is_scanned',
            'scanned_at',
            'amount_paid',
            'has_mg',
            'payment_reference',
            'coupon',
            'created_at',
            'updated_at',
        ]

    def get_folio(self, obj):
        return f"TKT-{obj.id:06d}"

    def get_buyer_name(self, obj):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.filter(email__iexact=obj.user_email).first()
        if user:
            full = f"{user.first_name} {user.last_name}".strip()
            if full:
                return full
            if user.username:
                return user.username
        email_prefix = (obj.user_email or '').split('@')[0]
        return email_prefix.replace('.', ' ').replace('_', ' ').replace('-', ' ').title() or 'Asistente'

    def get_buyer(self, obj):
        return {
            'name': self.get_buyer_name(obj),
            'email': obj.user_email,
            'phone': obj.user_phone or ''
        }

    def get_event(self, obj):
        ev = obj.event
        if not ev:
            return None
        return {
            'id': ev.id,
            'title': ev.title,
            'artist': ev.artist,
            'date': ev.date.isoformat() if ev.date else None,
            'venue_name': ev.venue_name or (ev.theater.name if ev.theater else 'London Pub'),
            'venue_address': ev.venue_address or (ev.theater.location if ev.theater else '')
        }

    def get_zone(self, obj):
        if obj.seat:
            return obj.seat.section or "Zona General"
        if obj.ga_zone:
            return obj.ga_zone.name
        if obj.has_mg or (obj.event and obj.event.event_type == 'meet_greet'):
            return "Meet & Greet"
        return "General (Sin Asiento)"

    def _extract_seat_info(self, obj):
        import re
        import math
        if not obj.seat:
            return {'row_letter': None, 'table_number': None, 'seat_number': None, 'table_label': None}

        seat = obj.seat
        row_raw = str(getattr(seat, 'row', '') or '').strip()
        row_clean = re.sub(r'^fila\s*:?\s*', '', row_raw, flags=re.IGNORECASE).strip()
        row_letter = row_clean.upper() if row_clean and not row_clean.lower().startswith('mesa') else ''

        table_number = None
        table_label = None

        theater = getattr(seat, 'theater', None)
        if theater and isinstance(theater.layout, dict):
            layout_seats = theater.layout.get('seats', [])
            layout_elements = theater.layout.get('map_elements', [])
            table_id = None
            for ls in layout_seats:
                if ls.get('id') == seat.id or (ls.get('number') == seat.number and (ls.get('row') == seat.row or ls.get('row') == row_clean)):
                    table_id = ls.get('tableId') or ls.get('table_id')
                    break
            for el in layout_elements:
                if table_id and str(el.get('id')) == str(table_id):
                    table_label = el.get('label')
                    break
                if not table_id and (el.get('type') == 'table' or el.get('tableShape')):
                    if math.hypot(el.get('x', 0) - getattr(seat, 'x', 0), el.get('y', 0) - getattr(seat, 'y', 0)) <= 80:
                        table_label = el.get('label')
                        break

        if table_label:
            num_match = re.search(r'\d+', str(table_label))
            if num_match:
                table_number = int(num_match.group(0))
        elif row_raw.lower().startswith('mesa'):
            num_match = re.search(r'\d+', row_raw)
            if num_match:
                table_number = int(num_match.group(0))
                table_label = f"Mesa {table_number}"

        return {
            'row_letter': row_letter or None,
            'table_number': table_number,
            'seat_number': seat.number,
            'table_label': table_label
        }

    def get_row_letter(self, obj):
        info = self._extract_seat_info(obj)
        return info['row_letter']

    def get_table_number(self, obj):
        info = self._extract_seat_info(obj)
        return info['table_number']

    def get_seat_number(self, obj):
        return obj.seat.number if obj.seat else None

    def get_desglose(self, obj):
        from apps.tickets.utils import format_seat_assignment
        info = self._extract_seat_info(obj)
        formatted = format_seat_assignment(obj.seat) if obj.seat else self.get_zone(obj)
        return {
            'row_letter': info['row_letter'],
            'table_number': info['table_number'],
            'seat_number': info['seat_number'],
            'formatted': formatted,
            'chips': {
                'row': f"Fila: {info['row_letter']}" if info['row_letter'] else None,
                'table': f"Mesa: {info['table_number']}" if info['table_number'] else None,
                'seat': f"Asiento: {info['seat_number']}" if info['seat_number'] else None,
            }
        }

    def get_status(self, obj):
        if obj.status == 'cancelled':
            return 'CANCELLED'
        if obj.is_scanned or obj.status == 'used':
            return 'CHECKED_IN'
        if obj.used_coupon and (obj.used_coupon.is_complimentary or obj.used_coupon.discount_type == 'free_vip'):
            return 'COMPLIMENTARY'
        return 'ACTIVE'

    def get_payment_reference(self, obj):
        if obj.used_coupon and (obj.used_coupon.is_complimentary or obj.used_coupon.discount_type == 'free_vip'):
            return f"CORTESIA:{obj.used_coupon.code}"
        if obj.stripe_session_id:
            return obj.stripe_session_id
        if obj.used_coupon:
            return f"CUPON:{obj.used_coupon.code}"
        return "PAGO-DIRECTO"

    def get_coupon(self, obj):
        if not obj.used_coupon:
            return None
        c = obj.used_coupon
        return {
            'id': c.id,
            'code': c.code,
            'discount_type': c.discount_type,
            'discount_value': float(c.discount_value),
            'is_complimentary': c.is_complimentary
        }


