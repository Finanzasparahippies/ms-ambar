from django.db import models

class BookingInquiry(models.Model):
    VEN_CHOICES = [
        ('festival', 'Festival'),
        ('theater', 'Teatro / Auditorio'),
        ('club', 'Club / Antro'),
        ('private', 'Evento Privado'),
        ('other', 'Otro'),
    ]
    name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    company = models.CharField(max_length=255, null=True, blank=True)
    date = models.DateField(null=True, blank=True)
    venue_type = models.CharField(max_length=20, choices=VEN_CHOICES)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_reviewed = models.BooleanField(default=False)

    def __str__(self):
        return f"Inquiry from {self.name} - {self.venue_type}"

    class Meta:
        verbose_name_plural = "Booking Inquiries"

class BookingContract(models.Model):
    inquiry = models.OneToOneField(BookingInquiry, on_delete=models.CASCADE, related_name='contract')
    fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    signature_base64 = models.TextField(null=True, blank=True) # Signature of organizer (client)
    signed_at = models.DateTimeField(null=True, blank=True)
    manager_signature = models.TextField(null=True, blank=True) # Signature of MS Ambar manager (dev/admin equivalent)
    manager_signed_at = models.DateTimeField(null=True, blank=True)
    is_fully_signed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    pdf_file = models.FileField(upload_to='contracts/', null=True, blank=True)

    def __str__(self):
        return f"Contrato de Booking - {self.inquiry.name} ({self.inquiry.date})"

