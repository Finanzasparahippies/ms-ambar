from django.db import models
import uuid

class Theater(models.Model):
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    layout = models.JSONField(help_text="JSON representation of rows and columns")

    def __str__(self):
        return self.name

class Event(models.Model):
    title = models.CharField(max_length=255)
    artist = models.CharField(max_length=255)
    date = models.DateTimeField()
    theater = models.ForeignKey(Theater, on_delete=models.CASCADE, related_name='events')
    image = models.ImageField(upload_to='events/', null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.title} - {self.date.strftime('%Y-%m-%d')}"

class Seat(models.Model):
    CATEGORY_CHOICES = [
        ('standard', 'Standard'),
        ('vip', 'VIP'),
        ('accessible', 'Accessible'),
    ]
    theater = models.ForeignKey(Theater, on_delete=models.CASCADE, related_name='seats')
    row = models.CharField(max_length=10)
    number = models.IntegerField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='standard')
    base_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ('theater', 'row', 'number')

    def __str__(self):
        return f"{self.theater.name} - {self.row}{self.number}"

class Ticket(models.Model):
    STATUS_CHOICES = [
        ('reserved', 'Reserved'),
        ('paid', 'Paid'),
        ('used', 'Used'),
        ('cancelled', 'Cancelled'),
    ]
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='tickets')
    seat = models.ForeignKey(Seat, on_delete=models.CASCADE)
    user_email = models.EmailField()
    user_phone = models.CharField(max_length=20, null=True, blank=True)
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='reserved')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('event', 'seat')

    def __str__(self):
        return f"Ticket for {self.event.title} - Seat {self.seat.row}{self.seat.number}"
