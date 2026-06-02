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

class NewsletterSubscriber(models.Model):
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
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


