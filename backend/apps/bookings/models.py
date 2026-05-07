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
