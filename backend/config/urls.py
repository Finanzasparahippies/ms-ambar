from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/tickets/', include('apps.tickets.urls')),
    path('api/shop/', include('apps.shop.urls')),
    path('api/users/', include('apps.users.urls')),
]
