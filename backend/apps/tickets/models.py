from django.db import models
import uuid

class Theater(models.Model):
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    layout = models.JSONField(help_text="JSON representation of sections and rows")

    def __str__(self):
        return self.name

    def generate_seats(self):
        """
        Generates Seat objects based on the layout JSON.
        Expected format: 
        {
            "sections": [
                {
                    "name": "VIP Frontal",
                    "position": "front",
                    "rows": [
                        {"label": "A", "count": 10, "category": "vip", "base_price": 2500},
                        ...
                    ]
                }
            ]
        }
        """
        sections = self.layout.get('sections', [])
        created_count = 0
        for section in sections:
            sec_name = section.get('name')
            pos = section.get('position', 'front')
            for row_data in section.get('rows', []):
                label = row_data.get('label')
                count = row_data.get('count', 0)
                cat = row_data.get('category', 'standard')
                price = row_data.get('base_price', 1000)
                
                for i in range(1, count + 1):
                    Seat.objects.get_or_create(
                        theater=self,
                        section=sec_name,
                        position=pos,
                        row=label,
                        number=i,
                        defaults={
                            'category': cat,
                            'base_price': price
                        }
                    )
                    created_count += 1
        return created_count

class Event(models.Model):
    title = models.CharField(max_length=255)
    artist = models.CharField(max_length=255)
    date = models.DateTimeField()
    theater = models.ForeignKey(Theater, on_delete=models.CASCADE, related_name='events')
    image = models.ImageField(upload_to='events/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    # Meet & Greet Logic
    mg_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    mg_limit = models.PositiveIntegerField(default=0)
    
    # Price multiplier for this specific event
    price_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=1.0)

    def __str__(self):
        return f"{self.title} - {self.date.strftime('%Y-%m-%d')}"

    @property
    def mg_available(self):
        sold = self.tickets.filter(status='paid', has_mg=True).count()
        return max(0, self.mg_limit - sold)

class Seat(models.Model):
    CATEGORY_CHOICES = [
        ('standard', 'Standard'),
        ('vip', 'VIP'),
        ('general_a', 'General A'),
        ('general_b', 'General B'),
        ('accessible', 'Accessible'),
    ]
    POSITION_CHOICES = [
        ('front', 'Frontal'),
        ('side_left', 'Lateral Izquierda'),
        ('side_right', 'Lateral Derecha'),
        ('back', 'Posterior'),
    ]
    theater = models.ForeignKey(Theater, on_delete=models.CASCADE, related_name='seats')
    section = models.CharField(max_length=100, default='General')
    position = models.CharField(max_length=20, choices=POSITION_CHOICES, default='front')
    row = models.CharField(max_length=10)
    number = models.IntegerField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='standard')
    base_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ('theater', 'section', 'row', 'number')

    def __str__(self):
        return f"{self.theater.name} - {self.section} {self.row}{self.number}"

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
    
    # Meet & Greet Upgrade
    has_mg = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('event', 'seat')

    def __str__(self):
        return f"Ticket for {self.event.title} - Seat {self.seat.row}{self.seat.number}"
