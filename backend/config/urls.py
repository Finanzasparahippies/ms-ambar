from django.contrib import admin
from django.urls import path, include
from apps.blog.views import BrevoWebhookView
from config.cloudinary_storage import cloudinary_signature_view

urlpatterns = [
    path('admin/cloudinary/signature/', cloudinary_signature_view, name='admin-cloudinary-signature'),
    path('admin/', admin.site.urls),
    path('api/webhooks/brevo', BrevoWebhookView.as_view(), name='brevo-webhook-root'),
    path('api/tickets/', include('apps.tickets.urls')),
    path('api/shop/', include('apps.shop.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/performance/', include('apps.performance.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/blog/', include('apps.blog.urls')),
    path('api/bookings/', include('apps.bookings.urls')),
    path('api/gallery/', include('apps.gallery.urls')),
    path('api/music/', include('apps.music.urls')),
]

