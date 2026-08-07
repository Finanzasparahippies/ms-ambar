from rest_framework import serializers
from .models import Event, Theater, Seat, Ticket, GADeclaration, SiteSettings, Coupon
from .fees import calculate_total_with_fee, get_fee_config


class SafeImageField(serializers.ImageField):
    def to_representation(self, value):
        if not value or not getattr(value, 'name', None):
            return None
        try:
            return super().to_representation(value)
        except (ValueError, AttributeError):
            return None


class SeatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Seat
        fields = ['id', 'section', 'row', 'number', 'category', 'status', 'base_price', 'x', 'y', 'angle', 'color']


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
        fields = ['id', 'code', 'discount_type', 'discount_value', 'max_uses', 'times_used', 'is_active', 'event', 'event_title', 'assigned_email', 'expiration_date', 'created_at']


class EventSerializer(serializers.ModelSerializer):
    theater_name = serializers.SerializerMethodField()
    theater_location = serializers.SerializerMethodField()
    image = SafeImageField(required=False, allow_null=True)
    flyer = SafeImageField(required=False, allow_null=True)
    image_url = serializers.SerializerMethodField()
    flyer_url = serializers.SerializerMethodField()
    base_price = serializers.SerializerMethodField()
    numbered_seat_base_price = serializers.SerializerMethodField()
    price_with_fee = serializers.SerializerMethodField()
    theme_config = serializers.ReadOnlyField(source='get_theme_config')

    class Meta:
        model = Event
        fields = [
            'id', 'title', 'artist', 'date', 'doors_open',
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
            'primary_color', 'secondary_color', 'background_start', 'background_end',
            'accent_color', 'card_background', 'text_color', 'particle_shape', 'particle_density', 'particle_speed', 'particle_color', 'particle_shadow',
            'card_style', 'background_pattern', 'font_preset', 'custom_css', 'section_themes'
        ]
        extra_kwargs = {
            'venue_name': {'required': False, 'allow_blank': True},
            'venue_address': {'required': False, 'allow_blank': True},
        }

    def get_theater_name(self, obj):
        return obj.theater.name if obj.theater else None

    def get_theater_location(self, obj):
        return obj.theater.location if obj.theater else None

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and getattr(obj.image, 'name', None) and request:
            try:
                return request.build_absolute_uri(obj.image.url)
            except (ValueError, AttributeError):
                return None
        return None

    def get_flyer_url(self, obj):
        request = self.context.get('request')
        if obj.flyer and getattr(obj.flyer, 'name', None) and request:
            try:
                return request.build_absolute_uri(obj.flyer.url)
            except (ValueError, AttributeError):
                return None
        return None

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
            return f"{obj.seat.row}{obj.seat.number}"
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

