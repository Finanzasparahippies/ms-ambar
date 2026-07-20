from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from apps.users.views import (
    UserRegisterView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    MyTokenObtainPairView,
    UserProfileView,
)

urlpatterns = [
    path('login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', UserRegisterView.as_view(), name='register'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password-reset-confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('profile/', UserProfileView.as_view(), name='profile'),
]
