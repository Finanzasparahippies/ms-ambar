from django.contrib import admin
from .models import BookingInquiry

@admin.register(BookingInquiry)
class BookingInquiryAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'venue_type', 'date', 'is_reviewed', 'created_at')
    list_filter = ('venue_type', 'is_reviewed', 'created_at')
    search_fields = ('name', 'email', 'message')
    list_editable = ('is_reviewed',)
