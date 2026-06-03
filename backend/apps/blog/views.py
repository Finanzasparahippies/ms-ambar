from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils.html import strip_tags
from django.conf import settings
from django.utils import timezone
from .models import Category, Post, NewsletterSubscriber, SESIdentityVerification, EmailCampaign
from .serializers import CategorySerializer, PostSerializer, NewsletterSubscriberSerializer, SESIdentityVerificationSerializer, EmailCampaignSerializer
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
    for sub in subscribers:
        html_content = f"""
        <html>
          <body style="background-color: #06070b; color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px 20px; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: #0c0d13; border: 1px solid rgba(255, 255, 255, 0.05); padding: 40px; border-radius: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
              
              <!-- Header/Logo -->
              <div style="text-align: center; margin-bottom: 40px;">
                <div style="display: inline-block; width: 50px; height: 50px; background-color: #f59e0b; border-radius: 50%; line-height: 50px; text-align: center; font-weight: 900; font-size: 24px; color: #030303;">A</div>
                <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: -0.05em; margin-top: 15px; margin-bottom: 5px;">MS AMBAR</h1>
                <p style="color: #f59e0b; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; margin: 0;">Cartas desde el escenario</p>
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
                <a href="{settings.FRONTEND_URL}/ambar-te-escribe" style="background-color: #f59e0b; color: #030303; padding: 16px 32px; border-radius: 16px; font-size: 13px; font-weight: 900; text-transform: uppercase; text-decoration: none; display: inline-block; letter-spacing: 1px;">
                  Leer Entrada Completa
                </a>
              </div>
              
              <!-- Footer -->
              <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; margin-top: 40px; color: rgba(255,255,255,0.3); font-size: 11px;">
                <p style="margin: 0 0 10px 0;">Recibiste este correo porque estás suscrito a las cartas de MS AMBAR.</p>
                <p style="margin: 0;"><a href="{settings.FRONTEND_URL}/ambar-te-escribe?unsubscribe={sub.email}" style="color: #f59e0b; text-decoration: underline;">Desuscribirse</a></p>
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
            <p style="color: #f59e0b; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; margin: 0;">Cartas desde el escenario</p>
          </div>
          
          <!-- Content -->
          <h2 style="color: #ffffff; font-size: 24px; font-weight: 900; line-height: 1.2; margin-top: 0; margin-bottom: 20px; letter-spacing: -0.02em; text-align: center;">
            {f"¡Hola, {subscriber.name}!" if subscriber.name else "¡Gracias por unirte a nuestro viaje!"}
          </h2>
          
          <div style="color: rgba(255,255,255,0.7); font-size: 15px; line-height: 1.8; margin-bottom: 30px; text-align: center;">
            {f"Gracias por unirte a nuestro viaje. " if subscriber.name else ""}A partir de ahora, recibirás antes que nadie nuestras crónicas, fechas de presentaciones, sets exclusivos y actualizaciones del universo sonoro y visual de MS AMBAR.
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
            <p style="margin: 0;"><a href="{settings.FRONTEND_URL}/ambar-te-escribe?unsubscribe={subscriber.email}" style="color: #f59e0b; text-decoration: underline;">Desuscribirse</a></p>
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
            return Response({"message": "Te has desuscrito con éxito del newsletter de MS AMBAR."}, status=status.HTTP_200_OK)
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
    text_color = "#ffffff"
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
        text_color = "#ffffff"
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
    user_font = getattr(campaign, 'font_family', 'serif')
    font_import = ""
    if user_font and user_font != 'serif':
        font_configs = {
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
        if user_font in font_configs:
            font_import = font_configs[user_font]['import']
            font_family = font_configs[user_font]['family']

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
        image_html = f"""
        <div style="border-radius: 20px; overflow: hidden; margin-bottom: 30px; border: {border_style};">
            <img src="{image_url}" style="width: 100%; height: auto; display: block;" />
        </div>
        """

    cta_html = ""
    if campaign.cta_text and campaign.cta_link:
        cta_html = f"""
        <div style="text-align: center; margin-top: 35px; margin-bottom: 25px;">
            <a href="{campaign.cta_link}" style="background-color: {accent_color}; color: #030303; padding: 14px 28px; border-radius: 12px; font-size: 13px; font-weight: bold; text-decoration: none; display: inline-block; letter-spacing: 1px; text-transform: uppercase; box-shadow: 0 5px 15px rgba(0,0,0,0.2);">
                {campaign.cta_text}
            </a>
        </div>
        """

    unsubscribe_url = f"{settings.FRONTEND_URL}/ambar-te-escribe?unsubscribe={sub_email}"
    
    poem_paragraphs = "".join([f"<p style='margin: 0 0 16px 0;'>{line.strip()}</p>" if line.strip() else "<div style='height: 16px;'></div>" for line in campaign.poem_text.split('\n')])

    html_content = f"""
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          {font_import}
        </style>
      </head>
      <body style="background-color: {bg_color}; color: {text_color}; font-family: {font_family}; padding: 40px 20px; margin: 0; text-align: center;">
        <div style="max-width: 600px; margin: 0 auto; background: {card_bg}; {bg_style} border: {border_style}; padding: 40px; border-radius: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); text-align: left;">
          
          <!-- Header/Logo -->
          <div style="text-align: center; margin-bottom: 40px;">
            <div style="display: inline-block; width: 50px; height: 50px; background-color: {accent_color}; border-radius: 50%; line-height: 50px; text-align: center; font-weight: 900; font-size: 24px; color: #030303;">A</div>
            <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: -0.05em; margin-top: 15px; margin-bottom: 5px;">MS AMBAR</h1>
            <p style="color: {accent_color}; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; margin: 0;">Ambar Te Escribe • Poesía</p>
          </div>
          
          <!-- Cover image if exists -->
          {image_html}
          
          <!-- Subject / Title -->
          <h2 style="color: #ffffff; font-size: 24px; font-weight: 900; line-height: 1.3; margin-top: 0; margin-bottom: 30px; letter-spacing: -0.02em; text-align: center; font-style: italic;">
            {campaign.subject}
          </h2>
          
          <!-- Poem content with custom styling -->
          <div style="color: {text_color}; font-size: 16px; line-height: 1.8; margin-bottom: 40px; text-align: center; font-style: italic; opacity: 0.9;">
            {poem_paragraphs}
          </div>
          
          <!-- Dynamic CTA Button -->
          {cta_html}
          
          <!-- Footer -->
          <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; margin-top: 40px; color: rgba(255,255,255,0.3); font-size: 11px;">
            <p style="margin: 0 0 10px 0;">Recibiste este poema porque eres parte de las cartas de MS AMBAR.</p>
            <p style="margin: 0;"><a href="{unsubscribe_url}" style="color: {accent_color}; text-decoration: underline;">Desuscribirse del boletín</a></p>
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




