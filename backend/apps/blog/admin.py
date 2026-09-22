from django.contrib import admin
from django.core.cache import cache
from .models import Category, Post, NewsletterSubscriber, EmailCampaign, CampaignTemplateImage, DailyEmailQuotaCounter

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'is_published', 'created_at')
    list_filter = ('category', 'is_published')
    prepopulated_fields = {'slug': ('title',)}
    search_fields = ('title', 'content')

@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(admin.ModelAdmin):
    list_display = ('email', 'created_at', 'is_active')
    search_fields = ('email',)
    list_filter = ('created_at', 'is_active')

@admin.register(EmailCampaign)
class EmailCampaignAdmin(admin.ModelAdmin):
    list_display = ('subject', 'template_type', 'is_sent', 'sent_at', 'created_at')
    list_filter = ('template_type', 'is_sent')
    search_fields = ('subject', 'poem_text')


@admin.register(CampaignTemplateImage)
class CampaignTemplateImageAdmin(admin.ModelAdmin):
    list_display = ('id', 'image', 'created_at')


@admin.register(DailyEmailQuotaCounter)
class DailyEmailQuotaCounterAdmin(admin.ModelAdmin):
    list_display = ('provider', 'date', 'sent_count', 'remaining_quota', 'updated_at')
    list_filter = ('provider', 'date')
    search_fields = ('provider',)
    actions = ['reset_quota_to_zero', 'set_quota_to_exhausted_300']

    @admin.action(description="Resetear contadores seleccionados a 0 (Restantes: 300)")
    def reset_quota_to_zero(self, request, queryset):
        updated = 0
        for counter in queryset:
            counter.sent_count = 0
            counter.save(update_fields=['sent_count', 'updated_at'])
            date_str = counter.date.isoformat()
            cache.set(f"{counter.provider}:daily_sent_count:{date_str}", 0, timeout=86400)
            updated += 1
        self.message_user(request, f"Se restablecieron {updated} contadores a 0.")

    @admin.action(description="Marcar contadores seleccionados como Agotados (300 enviados)")
    def set_quota_to_exhausted_300(self, request, queryset):
        updated = 0
        for counter in queryset:
            counter.sent_count = 300
            counter.save(update_fields=['sent_count', 'updated_at'])
            date_str = counter.date.isoformat()
            cache.set(f"{counter.provider}:daily_sent_count:{date_str}", 300, timeout=86400)
            updated += 1
        self.message_user(request, f"Se marcaron {updated} contadores como agotados (300/300).")

    @admin.display(description="Cupo Restante")
    def remaining_quota(self, obj):
        return max(0, 300 - obj.sent_count)


