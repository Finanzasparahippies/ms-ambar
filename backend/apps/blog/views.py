from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils.html import strip_tags
from django.conf import settings
from django.utils import timezone
from .models import Category, Post, NewsletterSubscriber, SESIdentityVerification, EmailCampaign, CampaignTemplateImage
from .serializers import CategorySerializer, PostSerializer, NewsletterSubscriberSerializer, SESIdentityVerificationSerializer, EmailCampaignSerializer, CampaignTemplateImageSerializer
from .utils import send_failover_email
import logging
import requests
import threading

logger = logging.getLogger(__name__)

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated and request.user.is_staff

def send_newsletter_email(post):
    subscribers = NewsletterSubscriber.objects.filter(is_active=True)
    if not subscribers.exists():
        return
        
    subject = f"✨ Nueva Crónica: {post.title} - Ms Ambar"
    
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
    for sub in subscribers:
        html_content = f"""
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800;900&display=swap');
              body, table, td, a {{
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              }}
            </style>
          </head>
          <body style="background-color: #080C0A; color: #F4F6F0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px 20px; margin: 0; -webkit-font-smoothing: antialiased;">
            <div style="max-width: 600px; margin: 0 auto; background: #0B0F0D; border: 1px solid rgba(229, 169, 59, 0.12); padding: 40px; border-radius: 32px; box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 50px rgba(229, 169, 59, 0.02);">
              
              <!-- Header/Logo -->
              <div style="text-align: center; margin-bottom: 40px;">
                <div style="display: inline-block; width: 60px; height: 60px; background-color: #080C0A; border: 1px solid rgba(229, 169, 59, 0.35); border-radius: 50%; overflow: hidden; text-align: center; padding: 6px; box-sizing: border-box; box-shadow: 0 0 20px rgba(229, 169, 59, 0.12); vertical-align: middle;">
                  <img src="{settings.FRONTEND_URL}/logos/ms_ambar_monograma_b.png" alt="A" style="width: 100%; height: 100%; object-fit: contain; display: block; margin: 0 auto;" />
                </div>
                <h1 style="color: #F4F6F0; font-size: 26px; font-weight: 900; letter-spacing: -0.05em; margin-top: 15px; margin-bottom: 5px; text-transform: uppercase; font-style: italic;">Ms Ambar</h1>
                <div style="height: 1px; width: 40px; background-color: rgba(229, 169, 59, 0.3); margin: 8px auto;"></div>
                <p style="color: #E5A93B; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; margin: 0;">Club Exclusivo</p>
              </div>
              
              <!-- Post cover image if exists -->
              {f"<div style='border-radius: 24px; overflow: hidden; margin-bottom: 30px; border: 1px solid rgba(255,255,255,0.05);'><img src='{image_url}' style='width: 100%; height: auto; display: block;' /></div>" if image_url else ""}
              
              <!-- Content -->
              <h2 style="color: #F4F6F0; font-size: 28px; font-weight: 900; line-height: 1.2; margin-top: 0; margin-bottom: 20px; letter-spacing: -0.02em;">{post.title}</h2>
              
              <div style="color: rgba(244, 246, 240, 0.8); font-size: 15px; line-height: 1.8; margin-bottom: 30px;">
                {post.content}
              </div>
              
              <!-- Button link -->
              <div style="text-align: center; margin-bottom: 45px;">
                <a href="{settings.FRONTEND_URL}/ambar-te-escribe" style="background-color: #E5A93B; color: #080C0A; padding: 16px 32px; border-radius: 16px; font-size: 12px; font-weight: 900; text-transform: uppercase; text-decoration: none; display: inline-block; letter-spacing: 1px;">
                  Leer Entrada Completa
                </a>
              </div>
              
              <!-- Footer -->
              <div style="text-align: center; border-top: 1px solid rgba(244, 246, 240, 0.06); padding-top: 25px; margin-top: 45px; color: rgba(244, 246, 240, 0.35); font-size: 11px; line-height: 1.6;">
                <p style="margin: 0 0 10px 0; font-weight: 500;">Recibiste este correo porque estás suscrito a las cartas de Ms Ambar.</p>
                <p style="margin: 0;">
                  <a href="{settings.FRONTEND_URL}/ambar-te-escribe?unsubscribe={sub.email}" style="color: #E5A93B; text-decoration: none; border-bottom: 1px solid rgba(229, 169, 59, 0.25); font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Desuscribirse</a>
                </p>
                <!-- Premium Watermark Signature -->
                <p style="margin: 30px 0 0 0; font-size: 8px; color: rgba(244, 246, 240, 0.15); letter-spacing: 2px; text-transform: uppercase; font-weight: bold;">
                  Diseñado con alma por <a href="https://nectarlabs.dev" target="_blank" style="color: rgba(229, 169, 59, 0.45); text-decoration: none; border-bottom: 1px solid rgba(229, 169, 59, 0.2); font-weight: 800; transition: all 0.3s;">Nectar Labs</a>
                </p>
              </div>
              
            </div>
          </body>
        </html>
        """
        text_content = strip_tags(html_content)
        try:
            send_failover_email(subject, html_content, text_content, [sub.email])
        except Exception as e:
            logger.error(f"Error sending newsletter email to {sub.email} via all failover providers: {e}")

def send_welcome_email(subscriber):
    subject = "✨ Bienvenido al Newsletter de Ms Ambar"
    
    # Beautiful HTML layout matching ms-ambar aesthetics
    html_content = f"""
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800;900&display=swap');
          body, table, td, a {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }}
        </style>
      </head>
      <body style="background-color: #080C0A; color: #F4F6F0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px 20px; margin: 0; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 600px; margin: 0 auto; background: #0B0F0D; border: 1px solid rgba(229, 169, 59, 0.12); padding: 40px; border-radius: 32px; box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 50px rgba(229, 169, 59, 0.02);">
          
          <!-- Header/Logo -->
          <div style="text-align: center; margin-bottom: 40px;">
            <div style="display: inline-block; width: 60px; height: 60px; background-color: #080C0A; border: 1px solid rgba(229, 169, 59, 0.35); border-radius: 50%; overflow: hidden; text-align: center; padding: 6px; box-sizing: border-box; box-shadow: 0 0 20px rgba(229, 169, 59, 0.12); vertical-align: middle;">
              <img src="{settings.FRONTEND_URL}/logos/ms_ambar_monograma_b.png" alt="A" style="width: 100%; height: 100%; object-fit: contain; display: block; margin: 0 auto;" />
            </div>
            <h1 style="color: #F4F6F0; font-size: 26px; font-weight: 900; letter-spacing: -0.05em; margin-top: 15px; margin-bottom: 5px; text-transform: uppercase; font-style: italic;">Ms Ambar</h1>
            <div style="height: 1px; width: 40px; background-color: rgba(229, 169, 59, 0.3); margin: 8px auto;"></div>
            <p style="color: #E5A93B; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; margin: 0;">Club Exclusivo</p>
          </div>
          
          <!-- Content -->
          <h2 style="color: #F4F6F0; font-size: 24px; font-weight: 900; line-height: 1.2; margin-top: 0; margin-bottom: 20px; letter-spacing: -0.02em; text-align: center;">
            {f"¡Hola, {subscriber.name}!" if subscriber.name else "¡Gracias por unirte a nuestro viaje!"}
          </h2>
          
          <div style="color: rgba(244, 246, 240, 0.8); font-size: 15px; line-height: 1.8; margin-bottom: 30px; text-align: center;">
            {f"Gracias por unirte a nuestro viaje. " if subscriber.name else ""}A partir de ahora, recibirás antes que nadie nuestras crónicas, fechas de presentaciones, sets exclusivos y actualizaciones del universo sonoro y visual de Ms Ambar.
          </div>
          
          <!-- Button link -->
          <div style="text-align: center; margin-bottom: 45px;">
            <a href="{settings.FRONTEND_URL}/tour" style="background-color: #E5A93B; color: #080C0A; padding: 16px 32px; border-radius: 16px; font-size: 12px; font-weight: 900; text-transform: uppercase; text-decoration: none; display: inline-block; letter-spacing: 1px;">
              Ver Próximas Fechas del Tour
            </a>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; border-top: 1px solid rgba(244, 246, 240, 0.06); padding-top: 25px; margin-top: 45px; color: rgba(244, 246, 240, 0.35); font-size: 11px; line-height: 1.6;">
            <p style="margin: 0 0 10px 0; font-weight: 500;">Recibiste este correo porque te suscribiste en nuestro sitio web.</p>
            <p style="margin: 0;"><a href="{settings.FRONTEND_URL}/ambar-te-escribe?unsubscribe={subscriber.email}" style="color: #E5A93B; text-decoration: none; border-bottom: 1px solid rgba(229, 169, 59, 0.25); font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Desuscribirse</a></p>
            <!-- Premium Watermark Signature -->
            <p style="margin: 30px 0 0 0; font-size: 8px; color: rgba(244, 246, 240, 0.15); letter-spacing: 2px; text-transform: uppercase; font-weight: bold;">
              Diseñado con alma por <a href="https://nectarlabs.dev" target="_blank" style="color: rgba(229, 169, 59, 0.45); text-decoration: none; border-bottom: 1px solid rgba(229, 169, 59, 0.2); font-weight: 800; transition: all 0.3s;">Nectar Labs</a>
            </p>
          </div>
          
        </div>
      </body>
    </html>
    """
    
    text_content = strip_tags(html_content)
    try:
        send_failover_email(subject, html_content, text_content, [subscriber.email])
    except Exception as e:
        logger.error(f"Error sending welcome newsletter email to {subscriber.email} via all failover providers: {e}")

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
            threading.Thread(target=send_newsletter_email, args=(post,), daemon=True).start()
            post.is_notified = True
            post.save()

    def perform_update(self, serializer):
        post = serializer.save()
        if post.is_published and not post.is_notified:
            threading.Thread(target=send_newsletter_email, args=(post,), daemon=True).start()
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
        threading.Thread(target=send_welcome_email, args=(subscriber,), daemon=True).start()

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def unsubscribe(self, request):
        email = request.data.get('email')
        if not email:
            return Response({"error": "El correo electrónico es requerido."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            subscriber = NewsletterSubscriber.objects.get(email=email)
            subscriber.is_active = False
            subscriber.save()
            return Response({"message": "Te has desuscrito con éxito del newsletter de Ms Ambar."}, status=status.HTTP_200_OK)
        except NewsletterSubscriber.DoesNotExist:
            return Response({"error": "Este correo no se encuentra registrado."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'], url_path='import_csv', permission_classes=[permissions.IsAdminUser])
    def import_csv(self, request):
        import csv
        import io
        import datetime
        from django.utils.dateparse import parse_datetime
        
        file = request.FILES.get('file')
        if not file:
            return Response({"error": "No se proporcionó ningún archivo CSV."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Let's decode safely with utf-8-sig to handle BOM if present
            csv_data = file.read().decode('utf-8-sig')
            csv_file = io.StringIO(csv_data)
            # Support comma, semicolon, or tab separation if needed, but csv.DictReader is standard
            # We can sniff delimiter or default to comma
            sample = csv_data[:1024]
            delimiter = ','
            if '\t' in sample:
                delimiter = '\t'
            elif ';' in sample and ',' not in sample:
                delimiter = ';'
            
            csv_file.seek(0)
            reader = csv.DictReader(csv_file, delimiter=delimiter)
        except Exception as e:
            return Response({"error": f"Error al leer el archivo: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        imported_count = 0
        errors = []
        for row in reader:
            # Clean keys by stripping whitespace, ignoring None keys, and preventing strip errors on lists/None values
            row = { k.strip(): (v.strip() if isinstance(v, str) else '') for k, v in row.items() if k }
            
            email = row.get('email')
            if not email:
                email_key = next((k for k in row.keys() if k and 'email' in k.lower()), None)
                if email_key:
                    email = row[email_key]
            
            if not email:
                continue
                
            email = email.strip()
            
            status_val = row.get('status', '').lower().strip()
            is_active = True
            if status_val in ['inactive', 'unsubscribed', 'unactive', 'false', '0']:
                is_active = False
            
            name_val = row.get('name', '').strip()
            subscriber_id_val = row.get('subscriber_id') or None
            api_subscription_id_val = row.get('api_subscription_id') or None
            tags_val = row.get('tags', '').strip()
            
            # Map 'premium?' or 'premium'
            premium_raw = row.get('premium?') or row.get('premium', '')
            is_premium_val = premium_raw.lower().strip() in ['true', '1', 'yes', 'si', 'y']
            
            created_at_raw = row.get('created_at', '').strip()
            created_at_val = None
            if created_at_raw:
                created_at_val = parse_datetime(created_at_raw)
                if not created_at_val:
                    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
                        try:
                            naive_dt = datetime.datetime.strptime(created_at_raw, fmt)
                            created_at_val = timezone.make_aware(naive_dt)
                            break
                        except Exception:
                            continue
            
            try:
                defaults = {
                    'is_active': is_active,
                    'name': name_val,
                    'subscriber_id': subscriber_id_val,
                    'api_subscription_id': api_subscription_id_val,
                    'tags': tags_val,
                    'is_premium': is_premium_val,
                }
                if created_at_val:
                    defaults['created_at'] = created_at_val
                    
                subscriber, created = NewsletterSubscriber.objects.get_or_create(
                    email=email,
                    defaults=defaults
                )
                if not created:
                    subscriber.is_active = is_active
                    if name_val:
                        subscriber.name = name_val
                    if subscriber_id_val:
                        subscriber.subscriber_id = subscriber_id_val
                    if api_subscription_id_val:
                        subscriber.api_subscription_id = api_subscription_id_val
                    if tags_val:
                        subscriber.tags = tags_val
                    subscriber.is_premium = is_premium_val
                    if created_at_val:
                        subscriber.created_at = created_at_val
                    subscriber.save()
                imported_count += 1
            except Exception as e:
                errors.append(f"Error con {email}: {str(e)}")
                
        return Response({
            "message": f"Se procesaron {imported_count} suscriptores con éxito.",
            "errors": errors
        }, status=status.HTTP_200_OK)

class SESIdentityVerificationViewSet(viewsets.ModelViewSet):
    queryset = SESIdentityVerification.objects.all()
    serializer_class = SESIdentityVerificationSerializer
    
    def get_permissions(self):
        if self.action == 'webhook':
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    @action(detail=False, methods=['post'], url_path='webhook')
    def webhook(self, request):
        """
        Webhook Endpoint to process notifications of AWS SNS about Bounces and Complaints
        from Amazon SES.
        """
        import json
        
        # AWS SNS sends payload as raw body content
        try:
            data = json.loads(request.body)
        except ValueError:
            return Response("Invalid JSON", status=status.HTTP_400_BAD_REQUEST)

        # 1. Process AWS SNS subscription confirmation
        message_type = request.headers.get('x-amz-sns-message-type')
        if message_type == 'SubscriptionConfirmation':
            subscribe_url = data.get('SubscribeURL')
            if subscribe_url:
                requests.get(subscribe_url)
                logger.info("SNS Subscription confirmed successfully.")
                return Response("Subscribed", status=status.HTTP_200_OK)

        # 2. Process delivery notification
        if message_type == 'Notification':
            message = json.loads(data.get('Message', '{}'))
            notification_type = message.get('notificationType')

            # Bounces
            if notification_type == 'Bounce':
                bounce = message.get('bounce', {})
                bounce_type = bounce.get('bounceType')
                
                if bounce_type == 'Permanent':
                    bounced_recipients = bounce.get('bouncedRecipients', [])
                    for recipient in bounced_recipients:
                        email = recipient.get('emailAddress')
                        try:
                            sub = NewsletterSubscriber.objects.get(email=email)
                            sub.is_active = False
                            sub.save()
                            logger.info(f"Subscriber {email} deactivated due to Hard Bounce.")
                        except NewsletterSubscriber.DoesNotExist:
                            pass

            # Complaints
            elif notification_type == 'Complaint':
                complaint = message.get('complaint', {})
                complained_recipients = complaint.get('complainedRecipients', [])
                for recipient in complained_recipients:
                    email = recipient.get('emailAddress')
                    try:
                        sub = NewsletterSubscriber.objects.get(email=email)
                        sub.is_active = False
                        sub.save()
                        logger.info(f"Subscriber {email} deactivated due to Complaint/Spam report.")
                    except NewsletterSubscriber.DoesNotExist:
                        pass

        return Response("OK", status=status.HTTP_200_OK)


def get_campaign_html_template(campaign, sub_email):
    style = campaign.template_type
    
    # Defaults (minimalist Carbon style)
    bg_color = "#06070b"
    card_bg = "#0c0d13"
    border_style = "1px solid rgba(255, 255, 255, 0.05)"
    text_color = "#F4F6F0"
    accent_color = "#f59e0b"
    font_family = "Georgia, Garamond, serif"
    badge_bg = "rgba(255, 191, 0, 0.15)"
    
    if style == 'moss':
        bg_color = "#0b130e"
        card_bg = "#122017"
        border_style = "1px solid #2e4d38"
        text_color = "#f5fbf7"
        accent_color = "#82c99b"
        font_family = "'Garamond', serif"
        badge_bg = "rgba(130, 201, 155, 0.15)"
    elif style == 'cosmic':
        bg_color = "#05050f"
        card_bg = "#0c0a1a"
        border_style = "1px solid #4a154b"
        text_color = "#F4F6F0"
        accent_color = "#c084fc"
        font_family = "'Georgia', serif"
        badge_bg = "rgba(192, 132, 252, 0.15)"
    elif style == 'glow':
        bg_color = "#0f0b07"
        card_bg = "#1a130c"
        border_style = "1px solid #d97706"
        text_color = "#fffdfa"
        accent_color = "#f59e0b"
        font_family = "'Georgia', serif"
        badge_bg = "rgba(245, 158, 11, 0.15)"
    elif style == 'mist':
        bg_color = "#0f1115"
        card_bg = "#181b22"
        border_style = "1px solid #374151"
        text_color = "#f3f4f6"
        accent_color = "#06b6d4"
        font_family = "'Georgia', serif"
        badge_bg = "rgba(6, 182, 212, 0.15)"
        
    # Map and load custom premium typography if selected
    font_configs = {
        'serif': {
            'import': "",
            'family': "Georgia, Garamond, serif"
        },
        'playfair': {
            'import': "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap');",
            'family': "'Playfair Display', Georgia, serif"
        },
        'cinzel': {
            'import': "@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&display=swap');",
            'family': "'Cinzel', Georgia, serif"
        },
        'garamond': {
            'import': "@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400&display=swap');",
            'family': "'Cormorant Garamond', 'Times New Roman', serif"
        },
        'montserrat': {
            'import': "@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap');",
            'family': "'Montserrat', Helvetica, Arial, sans-serif"
        },
        'pinyon': {
            'import': "@import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&display=swap');",
            'family': "'Pinyon Script', cursive"
        }
    }

    title_font_key = getattr(campaign, 'title_font_family', 'serif')
    body_font_key = getattr(campaign, 'font_family', 'serif')
    footer_font_key = getattr(campaign, 'footer_font_family', 'serif')

    title_font_config = font_configs.get(title_font_key, font_configs['serif'])
    body_font_config = font_configs.get(body_font_key, font_configs['serif'])
    footer_font_config = font_configs.get(footer_font_key, font_configs['serif'])

    unique_imports = {title_font_config['import'], body_font_config['import'], footer_font_config['import']}
    font_import = "\n".join([imp for imp in unique_imports if imp])

    title_font_family = title_font_config['family']
    body_font_family = body_font_config['family']
    footer_font_family = footer_font_config['family']

    bg_style = ""
    if campaign.bg_image:
        bg_url = campaign.bg_image.url
        if not bg_url.startswith('http'):
            api_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8000')
            bg_url = f"{api_url}{bg_url}"
            
        overlay_alpha = round(1.0 - campaign.bg_opacity, 2)
        if overlay_alpha < 0: overlay_alpha = 0
        if overlay_alpha > 1: overlay_alpha = 1
        
        theme_rgb = "12, 13, 19"
        if style == 'moss':
            theme_rgb = "18, 32, 23"
        elif style == 'cosmic':
            theme_rgb = "12, 10, 26"
        elif style == 'glow':
            theme_rgb = "26, 19, 12"
        elif style == 'mist':
            theme_rgb = "24, 27, 34"
            
        bg_style = f"background-image: linear-gradient(rgba({theme_rgb}, {overlay_alpha}), rgba({theme_rgb}, {overlay_alpha})), url('{bg_url}'); background-position: {campaign.bg_position}; background-repeat: no-repeat; background-size: cover; filter: saturate({campaign.bg_saturation}%);"

    image_html = ""
    if campaign.image:
        image_url = campaign.image.url
        if not image_url.startswith('http'):
            api_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8000')
            image_url = f"{api_url}{image_url}"
            
        img_style = campaign.image_style or {}
        width = img_style.get('width', '100%')
        align = img_style.get('align', 'center')
        radius = img_style.get('radius', '20px')
        
        wrapper_style = "margin-bottom: 30px;"
        if align == 'center':
            wrapper_style += " text-align: center;"
        elif align == 'left':
            wrapper_style += " text-align: left;"
        elif align == 'right':
            wrapper_style += " text-align: right;"
            
        image_html = f"""
        <div style="{wrapper_style}">
            <img src="{image_url}" style="width: {width}; max-width: 100%; height: auto; border-radius: {radius}; border: {border_style}; display: inline-block;" />
        </div>
        """

    custom_styles = getattr(campaign, 'custom_styles', {}) or {}
    sender_name = custom_styles.get('sender_name', 'Ms Ambar')
    
    # Title Styles
    title_color = custom_styles.get('title_color', '#F4F6F0')
    title_bg_color = custom_styles.get('title_bg_color', 'transparent')
    title_bg_image = custom_styles.get('title_bg_image', '')
    title_padding = custom_styles.get('title_padding', '0px')
    title_radius = custom_styles.get('title_radius', '0px')
    
    # Body Styles
    body_color = custom_styles.get('body_color', '') or text_color
    body_bg_color = custom_styles.get('body_bg_color', 'transparent')
    body_bg_image = custom_styles.get('body_bg_image', '')
    body_padding = custom_styles.get('body_padding', '0px')
    body_radius = custom_styles.get('body_radius', '0px')
    
    # Footer Styles
    footer_color = custom_styles.get('footer_color', 'rgba(244, 246, 240, 0.35)')
    footer_bg_color = custom_styles.get('footer_bg_color', 'transparent')
    footer_bg_image = custom_styles.get('footer_bg_image', '')
    footer_padding = custom_styles.get('footer_padding', '0px')
    footer_radius = custom_styles.get('footer_radius', '0px')

    def get_section_bg_style(bg_img, bg_col):
        styles = []
        if bg_col and bg_col != 'transparent':
            styles.append(f"background-color: {bg_col}")
        if bg_img:
            img_url = bg_img
            if not img_url.startswith('http'):
                api_url_val = getattr(settings, 'BACKEND_URL', 'http://localhost:8000')
                img_url = f"{api_url_val}{img_url}"
            styles.append(f"background-image: url('{img_url}')")
            styles.append("background-position: center")
            styles.append("background-repeat: no-repeat")
            styles.append("background-size: cover")
        return "; ".join(styles) if styles else ""

    title_bg_style = get_section_bg_style(title_bg_image, title_bg_color)
    body_bg_style = get_section_bg_style(body_bg_image, body_bg_color)
    footer_bg_style = get_section_bg_style(footer_bg_image, footer_bg_color)

    cta_html = ""
    if campaign.ctas:
        cta_buttons = []
        for cta in campaign.ctas:
            btn_text = cta.get('text', '')
            btn_link = cta.get('link', '')
            btn_bg = cta.get('bg_color') or accent_color
            btn_color = cta.get('text_color', '#080C0A')
            btn_radius = cta.get('radius', '12px')
            
            # Additional CTA customizations
            btn_border_width = cta.get('border_width', '0px')
            btn_border_style = cta.get('border_style', 'solid')
            btn_border_color = cta.get('border_color', '') or btn_bg
            btn_border = f"{btn_border_width} {btn_border_style} {btn_border_color}" if btn_border_width != '0px' else 'none'
            
            # Shadow/Glow customization
            btn_shadow_style = cta.get('shadow_style', 'default')
            if btn_shadow_style == 'none':
                btn_shadow = 'none'
            elif btn_shadow_style == 'sutil':
                btn_shadow = '0 2px 5px rgba(0,0,0,0.1)'
            elif btn_shadow_style == 'glow':
                btn_shadow = f"0 0 15px {btn_bg}66"
            elif btn_shadow_style == 'hard':
                btn_shadow = '4px 4px 0px rgba(0,0,0,0.3)'
            else: # default
                btn_shadow = '0 5px 15px rgba(0,0,0,0.2)'
                
            # Padding customization
            btn_padding_size = cta.get('padding_size', 'medium')
            if btn_padding_size == 'small':
                btn_padding = '10px 20px'
            elif btn_padding_size == 'large':
                btn_padding = '18px 36px'
            else: # medium
                btn_padding = '14px 28px'
                
            # Full width display
            btn_display = 'block' if cta.get('is_full_width', False) else 'inline-block'
            btn_margin = '10px auto' if cta.get('is_full_width', False) else '5px 10px'
            
            if btn_text and btn_link:
                cta_buttons.append(f"""
                <a href="{btn_link}" style="background-color: {btn_bg}; color: {btn_color}; padding: {btn_padding}; border-radius: {btn_radius}; font-size: 13px; font-weight: bold; text-decoration: none; display: {btn_display}; margin: {btn_margin}; letter-spacing: 1px; text-transform: uppercase; box-shadow: {btn_shadow}; border: {btn_border}; text-align: center;">
                    {btn_text}
                </a>
                """)
        if cta_buttons:
            cta_html = f"""
            <div style="text-align: center; margin-top: 35px; margin-bottom: 25px;">
                {"".join(cta_buttons)}
            </div>
            """
    elif campaign.cta_text and campaign.cta_link:
        cta_html = f"""
        <div style="text-align: center; margin-top: 35px; margin-bottom: 25px;">
            <a href="{campaign.cta_link}" style="background-color: {accent_color}; color: #080C0A; padding: 14px 28px; border-radius: 12px; font-size: 13px; font-weight: bold; text-decoration: none; display: inline-block; letter-spacing: 1px; text-transform: uppercase; box-shadow: 0 5px 15px rgba(0,0,0,0.2);">
                {campaign.cta_text}
            </a>
        </div>
        """

    unsubscribe_url = f"{settings.FRONTEND_URL}/ambar-te-escribe?unsubscribe={sub_email}"
    
    if "<p" in campaign.poem_text or "<br" in campaign.poem_text or "<div" in campaign.poem_text:
        poem_paragraphs = campaign.poem_text
    else:
        poem_paragraphs = "".join([f"<p style='margin: 0 0 16px 0;'>{line.strip()}</p>" if line.strip() else "<div style='height: 16px;'></div>" for line in campaign.poem_text.split('\n')])

    # Determine absolute URL for media conversions
    api_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8000')
    def make_urls_absolute(text):
        if not text:
            return ""
        text = text.replace('src="/media/', f'src="{api_url}/media/')
        text = text.replace("src='/media/", f"src='{api_url}/media/")
        return text

    poem_paragraphs = make_urls_absolute(poem_paragraphs)

    email_title_to_render = getattr(campaign, 'email_title', '')
    if not email_title_to_render:
        email_title_to_render = campaign.subject
    email_title_to_render = make_urls_absolute(email_title_to_render)

    footer_text_to_render = getattr(campaign, 'footer_text', '')
    if footer_text_to_render:
        footer_html = f"<div style='margin: 0 0 10px 0;'>{footer_text_to_render}</div>"
    else:
        footer_html = "<p style='margin: 0 0 10px 0; font-weight: 500;'>Recibiste este correo porque eres parte del club de Ms Ambar.</p>"
    footer_html = make_urls_absolute(footer_html)

    html_content = f"""
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          {font_import}
        </style>
      </head>
      <body style="background-color: {bg_color}; color: {text_color}; font-family: {body_font_family}; padding: 40px 20px; margin: 0; text-align: center; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 600px; margin: 0 auto; background: {card_bg}; {bg_style} border: {border_style}; padding: 40px; border-radius: 32px; box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 50px rgba(229, 169, 59, 0.02); text-align: left;">
          
          <!-- Header/Logo -->
          <div style="text-align: center; margin-bottom: 40px;">
            <div style="display: inline-block; width: 60px; height: 60px; background-color: #080C0A; border: 1px solid rgba(229, 169, 59, 0.35); border-radius: 50%; overflow: hidden; text-align: center; padding: 6px; box-sizing: border-box; box-shadow: 0 0 20px rgba(229, 169, 59, 0.12); vertical-align: middle;">
              <img src="{settings.FRONTEND_URL}/logos/ms_ambar_monograma_b.png" alt="A" style="width: 100%; height: 100%; object-fit: contain; display: block; margin: 0 auto;" />
            </div>
            <h1 style="color: #F4F6F0; font-size: 26px; font-weight: 900; letter-spacing: -0.05em; margin-top: 15px; margin-bottom: 5px; text-transform: uppercase; font-style: italic;">{sender_name}</h1>
            <div style="height: 1px; width: 40px; background-color: rgba(229, 169, 59, 0.3); margin: 8px auto;"></div>
            <p style="color: {accent_color}; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; margin: 0;">Ambar te escribe • Poesía</p>
          </div>
          
          <!-- Cover image if exists -->
          {image_html}
          
          <!-- Subject / Title Block -->
          <div style="color: {title_color}; font-family: {title_font_family}; padding: {title_padding}; border-radius: {title_radius}; {title_bg_style}; margin-bottom: 30px; box-sizing: border-box;">
            <h2 style="color: inherit; font-size: 24px; font-weight: 900; line-height: 1.3; margin: 0; letter-spacing: -0.02em; text-align: center; font-style: italic; font-family: inherit;">
              {email_title_to_render}
            </h2>
          </div>
          
          <!-- Poem content / Body Block -->
          <div style="color: {body_color}; font-family: {body_font_family}; padding: {body_padding}; border-radius: {body_radius}; {body_bg_style}; margin-bottom: 40px; box-sizing: border-box;">
            <div style="color: inherit; font-size: 16px; line-height: 1.8; text-align: center; font-style: italic; opacity: 0.9; font-family: inherit; padding: 10px;">
              {poem_paragraphs}
            </div>
          </div>
          
          <!-- Dynamic CTA Button -->
          {cta_html}
          
          <!-- Footer Block -->
          <div style="color: {footer_color}; font-family: {footer_font_family}; padding: {footer_padding}; border-radius: {footer_radius}; {footer_bg_style}; text-align: center; border-top: 1px solid rgba(244, 246, 240, 0.06); padding-top: 25px; margin-top: 45px; line-height: 1.6; box-sizing: border-box;">
            {footer_html}
            <p style="margin: 0;"><a href="{unsubscribe_url}" style="color: {accent_color}; text-decoration: none; border-bottom: 1px solid rgba(229, 169, 59, 0.25); font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Desuscribirse del boletín</a></p>
            <!-- Premium Watermark Signature -->
            <p style="margin: 30px 0 0 0; font-size: 8px; color: rgba(244, 246, 240, 0.15); letter-spacing: 2px; text-transform: uppercase; font-weight: bold;">
              Diseñado con amor por <a href="https://nectarlabs.dev" target="_blank" style="color: {accent_color}; text-decoration: none; border-bottom: 1px solid rgba(229, 169, 59, 0.2); font-weight: 800; transition: all 0.3s;">Nectar Labs</a>
            </p>
          </div>
          
        </div>
      </body>
    </html>
    """
    return html_content


def send_campaign_emails(campaign):
    subscribers = NewsletterSubscriber.objects.filter(is_active=True)
    if not subscribers.exists():
        campaign.is_sent = True
        campaign.sent_at = timezone.now()
        campaign.save()
        return

    campaign.sent_at = timezone.now()
    campaign.is_sent = True
    campaign.save()

    for sub in subscribers:
        html_content = get_campaign_html_template(campaign, sub.email)
        text_content = strip_tags(html_content)
        try:
            send_failover_email(campaign.subject, html_content, text_content, [sub.email])
        except Exception as e:
            logger.error(f"Error sending campaign email to {sub.email} via all failover providers: {e}")


class EmailCampaignViewSet(viewsets.ModelViewSet):
    queryset = EmailCampaign.objects.all().order_by('-created_at')
    serializer_class = EmailCampaignSerializer
    permission_classes = [permissions.IsAdminUser]

    @action(detail=True, methods=['post'])
    def send_campaign(self, request, pk=None):
        campaign = self.get_object()
        if campaign.is_sent:
            return Response({"error": "Esta campaña ya ha sido enviada anteriormente."}, status=status.HTTP_400_BAD_REQUEST)
        
        threading.Thread(target=send_campaign_emails, args=(campaign,), daemon=True).start()
        return Response({"message": "La campaña de correos ha comenzado a enviarse en segundo plano."}, status=status.HTTP_200_OK)


class CampaignTemplateImageViewSet(viewsets.ModelViewSet):
    queryset = CampaignTemplateImage.objects.all().order_by('-created_at')
    serializer_class = CampaignTemplateImageSerializer
    permission_classes = [permissions.IsAdminUser]




