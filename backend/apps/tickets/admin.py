from django.contrib import admin, messages
from .models import Theater, Event, Seat, Ticket, SiteSettings, Coupon


@admin.register(Theater)
class TheaterAdmin(admin.ModelAdmin):
    list_display = ('name', 'location')
    actions = ['generate_theater_seats']

    @admin.action(description="Generar asientos desde el layout")
    def generate_theater_seats(self, request, queryset):
        for theater in queryset:
            count = theater.generate_seats()
            self.message_user(request, f"Se han generado {count} asientos para {theater.name}", messages.SUCCESS)


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'artist', 'date', 'event_type', 'allow_seatless_tickets', 'allow_numbered_tickets', 'is_active')
    list_filter = ('is_active', 'event_type', 'date', 'allow_seatless_tickets', 'allow_numbered_tickets')
    fieldsets = (
        ('Información del Evento', {
            'fields': ('title', 'artist', 'date', 'doors_open', 'duration_minutes', 'venue_name', 'venue_address', 'theater', 'is_active', 'event_type', 'price_multiplier')
        }),
        ('Personalización Visual del Tema (Frontend)', {
            'fields': (
                'primary_color', 'secondary_color', 'background_start', 'background_end',
                'accent_color', 'card_background', 'text_color',
                'particle_shape', 'card_style', 'background_pattern', 'font_preset', 'custom_css'
            ),
            'description': 'Configura los colores, figura de partículas, estilo de tarjetas y fuentes para este evento. Si se dejan en blanco, se utilizarán los valores globales del sitio.',
            'classes': ('collapse',),
        }),
        ('Estrategia de Precios Dinámicos Mensuales', {
            'fields': ('enable_dynamic_pricing', 'monthly_price_increment'),
            'description': 'Ajusta automáticamente los precios de boletos por mes previo al evento (ej. -$50.00 MXN por mes de anticipación).'
        }),
        ('Tarifas Base de Boletos', {
            'fields': ('allow_seatless_tickets', 'allow_numbered_tickets', 'seatless_ticket_price', 'numbered_ticket_price'),
            'description': 'Tarifas mínimas base y activación para boletos generales sin asiento y boletos numerados en mesas.'
        }),
        ('Imágenes', {
            'fields': ('image', 'flyer'),
            'description': 'Sube el flyer oficial del evento. Se mostrará en la landing page y en la página de compra.'
        }),
        ('Meet & Greet', {
            'fields': ('mg_price', 'mg_limit'),
            'classes': ('collapse',),
        }),
        ('Integración con Stripe (Solo Lectura)', {
            'fields': ('stripe_product_id', 'stripe_price_id'),
            'classes': ('collapse',),
        }),
    )
    readonly_fields = ('stripe_product_id', 'stripe_price_id')


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_type', 'discount_value', 'times_used', 'max_uses', 'is_active', 'event', 'expiration_date')
    list_filter = ('discount_type', 'is_active', 'event')
    search_fields = ('code',)


@admin.register(Seat)
class SeatAdmin(admin.ModelAdmin):
    list_display = ('theater', 'section', 'row', 'number', 'category', 'position', 'base_price')
    list_filter = ('theater', 'section', 'category', 'position')


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ('event', 'seat', 'user_email', 'status', 'used_coupon', 'has_mg', 'created_at')
    list_filter = ('status', 'event', 'has_mg', 'used_coupon')
    readonly_fields = ('token',)


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    fieldsets = (
        ('Página de Compra de Boletos', {
            'fields': ('tickets_page_subtitle',),
            'description': 'Texto que aparece en la sección de accesos/boletos.'
        }),
        ('Landing Page', {
            'fields': ('homepage_cta_text',),
            'description': 'Texto del badge de CTA cuando no hay eventos próximos programados.'
        }),
        ('Personalización Global del Tema (Frontend Todo el Sitio)', {
            'fields': (
                'primary_color', 'secondary_color', 'background_start', 'background_end',
                'accent_color', 'card_background', 'text_color',
                'particle_shape', 'card_style', 'background_pattern', 'font_preset', 'custom_css'
            ),
            'description': 'Configura la paleta de colores, la figura del canvas de partículas, estilos de tarjetas y fuentes por defecto para todas las páginas del sitio.',
        }),
    )

    def has_add_permission(self, request):
        # Solo permite UNA instancia (singleton)
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

