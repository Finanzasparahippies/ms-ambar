from django.contrib import admin
from .models import Theater, Event, Seat, Ticket

@admin.register(Theater)
class TheaterAdmin(admin.ModelAdmin):
    list_display = ('name', 'location')

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'artist', 'date', 'is_active')
    list_filter = ('is_active', 'date')

@admin.register(Seat)
class SeatAdmin(admin.ModelAdmin):
    list_display = ('theater', 'row', 'number', 'category', 'base_price')
    list_filter = ('theater', 'category')

@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ('event', 'seat', 'user_email', 'status', 'created_at')
    list_filter = ('status', 'event')
    readonly_fields = ('token',)
