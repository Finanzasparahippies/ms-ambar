from django.contrib import admin, messages
from .models import Theater, Event, Seat, Ticket

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
    list_display = ('title', 'artist', 'date', 'is_active')
    list_filter = ('is_active', 'date')
    fieldsets = (
        (None, {'fields': ('title', 'artist', 'date', 'theater', 'image', 'is_active', 'price_multiplier')}),
        ('Meet & Greet', {'fields': ('mg_price', 'mg_limit')}),
    )

@admin.register(Seat)
class SeatAdmin(admin.ModelAdmin):
    list_display = ('theater', 'section', 'row', 'number', 'category', 'position', 'base_price')
    list_filter = ('theater', 'section', 'category', 'position')

@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ('event', 'seat', 'user_email', 'status', 'has_mg', 'created_at')
    list_filter = ('status', 'event', 'has_mg')
    readonly_fields = ('token',)
