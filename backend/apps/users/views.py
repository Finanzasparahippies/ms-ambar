import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.users.serializers import (
    UserRegisterSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    MyTokenObtainPairSerializer,
    UserProfileSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)

class UserRegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Generate JWT Token for immediate login
            refresh = RefreshToken.for_user(user)
            return Response({
                "message": "Usuario registrado exitosamente.",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username,
                    "is_staff": user.is_staff
                },
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                # To prevent user enumeration, we return success even if the email doesn't exist.
                # However, for developer convenience in debug mode, we can add a flag.
                return Response({
                    "message": "Si el correo electrónico está registrado, recibirás un enlace de recuperación.",
                    "status": "sent"
                }, status=status.HTTP_200_OK)

            # Generate token and uid
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            
            # Build reset URL targeting the Next.js frontend
            reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}&email={email}"
            
            # Log to console for local developer testing
            logger.info("=========================================")
            logger.info(f"SOLICITUD DE RECUPERACIÓN DE CONTRASEÑA")
            logger.info(f"Usuario: {user.email}")
            logger.info(f"Enlace de reinicio: {reset_url}")
            logger.info("=========================================")
            print("\n=========================================")
            print(f"SOLICITUD DE RECUPERACIÓN DE CONTRASEÑA")
            print(f"Usuario: {user.email}")
            print(f"Enlace de reinicio: {reset_url}")
            print("=========================================\n")

            # Try to send real email
            email_sent = False
            try:
                context = {
                    'username': user.username,
                    'reset_url': reset_url,
                    'frontend_url': settings.FRONTEND_URL,
                }
                html_content = render_to_string('users/emails/password_reset.html', context)
                text_content = strip_tags(html_content)

                email_msg = EmailMultiAlternatives(
                    subject="Restablece tu contraseña - MS AMBAR",
                    body=text_content,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[email],
                )
                email_msg.attach_alternative(html_content, "text/html")
                email_msg.send(fail_silently=False)
                email_sent = True
            except Exception as e:
                logger.error(f"Error al enviar correo electrónico de recuperación: {e}")
                # We continue since we already logged it to console for the dev to use.

            response_data = {
                "message": "Si el correo electrónico está registrado, recibirás un enlace de recuperación.",
                "status": "sent"
            }
            
            # For developer convenience in local debug mode, return the reset url directly
            if settings.DEBUG:
                response_data["_dev_reset_url"] = reset_url
                response_data["_dev_info"] = "DEBUG Mode: Enlace retornado directamente en la respuesta JSON para pruebas locales."

            return Response(response_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            uidb64 = request.data.get('uid')
            token = serializer.validated_data['token']
            password = serializer.validated_data['password']

            try:
                # Decode User ID
                uid = force_str(urlsafe_base64_decode(uidb64))
                user = User.objects.get(pk=uid)
            except (TypeError, ValueError, OverflowError, User.DoesNotExist):
                return Response({"error": "Enlace de recuperación inválido o alterado."}, status=status.HTTP_400_BAD_REQUEST)

            # Check Token Validity
            if not default_token_generator.check_token(user, token):
                return Response({"error": "El enlace de recuperación ha expirado o ya ha sido utilizado."}, status=status.HTTP_400_BAD_REQUEST)

            # Update User Password
            user.set_password(password)
            user.save()

            return Response({
                "message": "Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña."
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "Información personal actualizada exitosamente.",
                "user": serializer.data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
