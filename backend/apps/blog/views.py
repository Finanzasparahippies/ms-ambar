from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.mail import EmailMultiAlternatives
from django.utils.html import strip_tags
from django.conf import settings
from .models import Category, Post, NewsletterSubscriber
from .serializers import CategorySerializer, PostSerializer, NewsletterSubscriberSerializer

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated and request.user.is_staff

def send_newsletter_email(post):
    subscribers = NewsletterSubscriber.objects.filter(is_active=True)
    if not subscribers.exists():
        return
        
    subject = f"✨ Nueva Crónica: {post.title} - MS AMBAR"
    
    # Generate full absolute URL for image if present
    image_url = ""
    if post.image:
        image_url = post.image.url
        # If it's a relative path, prefix with frontend or api URL
        if not image_url.startswith('http'):
            # Fallback to local host default or settings configuration
            api_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8000')
            image_url = f"{api_url}{image_url}"

    # Beautiful HTML layout matching ms-ambar aesthetics
    html_content = f"""
    <html>
      <body style="background-color: #06070b; color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px 20px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background: #0c0d13; border: 1px solid rgba(255, 255, 255, 0.05); padding: 40px; border-radius: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
          
          <!-- Header/Logo -->
          <div style="text-align: center; margin-bottom: 40px;">
            <div style="display: inline-block; width: 50px; height: 50px; background-color: #f59e0b; border-radius: 50%; line-height: 50px; text-align: center; font-weight: 900; font-size: 24px; color: #030303;">A</div>
            <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: -0.05em; margin-top: 15px; margin-bottom: 5px;">MS AMBAR</h1>
            <p style="color: #f59e0b; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; margin: 0;">Journal - Bitácora de Luz & Sonido</p>
          </div>
          
          <!-- Post cover image if exists -->
          {f"<div style='border-radius: 20px; overflow: hidden; margin-bottom: 30px; border: 1px solid rgba(255,255,255,0.05);'><img src='{image_url}' style='width: 100%; height: auto; display: block;' /></div>" if image_url else ""}
          
          <!-- Content -->
          <h2 style="color: #ffffff; font-size: 28px; font-weight: 900; line-height: 1.2; margin-top: 0; margin-bottom: 20px; letter-spacing: -0.02em;">{post.title}</h2>
          
          <div style="color: rgba(255,255,255,0.7); font-size: 15px; line-height: 1.8; margin-bottom: 30px;">
            {post.content}
          </div>
          
          <!-- Button link -->
          <div style="text-align: center; margin-bottom: 40px;">
            <a href="{settings.FRONTEND_URL}/blog" style="background-color: #f59e0b; color: #030303; padding: 16px 32px; border-radius: 16px; font-size: 13px; font-weight: 900; text-transform: uppercase; text-decoration: none; display: inline-block; letter-spacing: 1px;">
              Leer Entrada Completa
            </a>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; margin-top: 40px; color: rgba(255,255,255,0.3); font-size: 11px;">
            <p style="margin: 0 0 10px 0;">Recibiste este correo porque estás suscrito al círculo de MS AMBAR.</p>
            <p style="margin: 0;"><a href="{settings.FRONTEND_URL}/blog?unsubscribe={sub.email}" style="color: #f59e0b; text-decoration: underline;">Desuscribirse</a></p>
          </div>
          
        </div>
      </body>
    </html>
    """
    
    text_content = strip_tags(html_content)
    
    for sub in subscribers:
        try:
            email = EmailMultiAlternatives(
                subject,
                text_content,
                settings.DEFAULT_FROM_EMAIL,
                [sub.email]
            )
            email.attach_alternative(html_content, "text/html")
            email.send()
        except Exception as e:
            import logging
            logging.error(f"Error sending newsletter email to {sub.email}: {e}")

def send_welcome_email(subscriber):
    subject = "✨ Bienvenido al Newsletter de MS AMBAR"
    
    # Beautiful HTML layout matching ms-ambar aesthetics
    html_content = f"""
    <html>
      <body style="background-color: #06070b; color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px 20px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background: #0c0d13; border: 1px solid rgba(255, 255, 255, 0.05); padding: 40px; border-radius: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
          
          <!-- Header/Logo -->
          <div style="text-align: center; margin-bottom: 40px;">
            <div style="display: inline-block; width: 50px; height: 50px; background-color: #f59e0b; border-radius: 50%; line-height: 50px; text-align: center; font-weight: 900; font-size: 24px; color: #030303;">A</div>
            <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: -0.05em; margin-top: 15px; margin-bottom: 5px;">MS AMBAR</h1>
            <p style="color: #f59e0b; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; margin: 0;">Journal - Bitácora de Luz & Sonido</p>
          </div>
          
          <!-- Content -->
          <h2 style="color: #ffffff; font-size: 24px; font-weight: 900; line-height: 1.2; margin-top: 0; margin-bottom: 20px; letter-spacing: -0.02em; text-align: center;">¡Gracias por unirte a nuestro viaje!</h2>
          
          <div style="color: rgba(255,255,255,0.7); font-size: 15px; line-height: 1.8; margin-bottom: 30px; text-align: center;">
            A partir de ahora, recibirás antes que nadie nuestras crónicas, fechas de presentaciones, sets exclusivos y actualizaciones del universo sonoro y visual de MS AMBAR.
          </div>
          
          <!-- Button link -->
          <div style="text-align: center; margin-bottom: 40px;">
            <a href="{settings.FRONTEND_URL}/tour" style="background-color: #f59e0b; color: #030303; padding: 16px 32px; border-radius: 16px; font-size: 13px; font-weight: 900; text-transform: uppercase; text-decoration: none; display: inline-block; letter-spacing: 1px;">
              Ver Próximas Fechas del Tour
            </a>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; margin-top: 40px; color: rgba(255,255,255,0.3); font-size: 11px;">
            <p style="margin: 0 0 10px 0;">Recibiste este correo porque te suscribiste en nuestro sitio web.</p>
            <p style="margin: 0;"><a href="{settings.FRONTEND_URL}/blog?unsubscribe={subscriber.email}" style="color: #f59e0b; text-decoration: underline;">Desuscribirse</a></p>
          </div>
          
        </div>
      </body>
    </html>
    """
    
    text_content = strip_tags(html_content)
    
    try:
        email = EmailMultiAlternatives(
            subject,
            text_content,
            settings.DEFAULT_FROM_EMAIL,
            [subscriber.email]
        )
        email.attach_alternative(html_content, "text/html")
        email.send()
    except Exception as e:
        import logging
        logging.error(f"Error sending welcome newsletter email to {subscriber.email}: {e}")

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user and user.is_authenticated and user.is_staff:
            return Post.objects.all().order_by('-created_at')
        return Post.objects.filter(is_published=True).order_by('-created_at')

    def perform_create(self, serializer):
        post = serializer.save()
        if post.is_published and not post.is_notified:
            send_newsletter_email(post)
            post.is_notified = True
            post.save()

    def perform_update(self, serializer):
        post = serializer.save()
        if post.is_published and not post.is_notified:
            send_newsletter_email(post)
            post.is_notified = True
            post.save()

class NewsletterSubscriberViewSet(viewsets.ModelViewSet):
    queryset = NewsletterSubscriber.objects.all()
    serializer_class = NewsletterSubscriberSerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'destroy']:
            # Require staff/admin to view/delete subscribers
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        subscriber = serializer.save()
        send_welcome_email(subscriber)

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def unsubscribe(self, request):
        email = request.data.get('email')
        if not email:
            return Response({"error": "El correo electrónico es requerido."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            subscriber = NewsletterSubscriber.objects.get(email=email)
            subscriber.is_active = False
            subscriber.save()
            return Response({"message": "Te has desuscrito con éxito del newsletter de MS AMBAR."}, status=status.HTTP_200_OK)
        except NewsletterSubscriber.DoesNotExist:
            return Response({"error": "Este correo no se encuentra registrado."}, status=status.HTTP_404_NOT_FOUND)


