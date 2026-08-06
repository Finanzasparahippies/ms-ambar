from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
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

