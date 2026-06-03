from django.db import models
from django.utils.text import slugify

class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Categories"

class Post(models.Model):
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    content = models.TextField()
    image = models.ImageField(upload_to='blog/', null=True, blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='posts')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_published = models.BooleanField(default=True)
    is_notified = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

from django.utils import timezone

class NewsletterSubscriber(models.Model):
    name = models.CharField(max_length=255, blank=True, default='')
    email = models.EmailField(unique=True)
    subscriber_id = models.CharField(max_length=255, blank=True, null=True)
    api_subscription_id = models.CharField(max_length=255, blank=True, null=True)
    tags = models.TextField(blank=True, default='')
    is_premium = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.email

class SESIdentityVerification(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending DNS Setup'),
        ('verified', 'Verified / Active'),
        ('failed', 'Verification Failed'),
    ]

    domain = models.CharField(max_length=255, default="msambar.com", unique=True)
    verification_status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='pending')
    
    # Easy DKIM tokens generated from AWS SES
    dkim_token_1 = models.CharField(max_length=255, blank=True, help_text="CNAME Token 1 Name/Value")
    dkim_token_2 = models.CharField(max_length=255, blank=True, help_text="CNAME Token 2 Name/Value")
    dkim_token_3 = models.CharField(max_length=255, blank=True, help_text="CNAME Token 3 Name/Value")
    
    # SPF/MX custom MAIL FROM configuration
    mail_from_domain = models.CharField(max_length=255, default="mail.msambar.com")
    mail_from_mx_target = models.CharField(max_length=255, default="feedback-smtp.us-east-1.amazonses.com")
    spf_record_value = models.CharField(max_length=255, default="v=spf1 include:amazonses.com ~all")
    
    # DMARC Alignment configuration
    dmarc_record_value = models.CharField(max_length=255, default="v=DMARC1; p=none; rua=mailto:dmarc-reports@msambar.com")
    
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.domain} ({self.get_verification_status_display()})"


class EmailCampaign(models.Model):
    TEMPLATE_CHOICES = [
        ('minimalist', 'Minimalist Carbon'),
        ('moss', 'Moss Green'),
        ('cosmic', 'Cosmic Night'),
        ('glow', 'Amber Glow'),
        ('mist', 'Mystic Mist'),
    ]

    subject = models.CharField(max_length=255)
    poem_text = models.TextField()
    template_type = models.CharField(max_length=50, choices=TEMPLATE_CHOICES, default='minimalist')
    image = models.ImageField(upload_to='campaigns/', null=True, blank=True)
    
    # Advanced background settings
    bg_image = models.ImageField(upload_to='campaign_bg/', null=True, blank=True)
    bg_opacity = models.FloatField(default=1.0)
    bg_saturation = models.IntegerField(default=100)
    bg_position = models.CharField(max_length=50, default='center')
    
    # Customizable CTA Button settings
    cta_text = models.CharField(max_length=100, blank=True, default='')
    cta_link = models.URLField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    is_sent = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.subject} ({self.get_template_type_display()})"


