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
        Generates Seat objects with 2D coordinates.
        Supports 'grid' (default) and 'arc' (future) layouts.
        """
        import math
        sections = self.layout.get('sections', [])
        created_count = 0
        
        for section in sections:
            sec_name = section.get('name')
            layout_type = section.get('layout_type', 'grid') # grid or arc
            
            # Base Position
            base_x = section.get('x', 500)
            base_y = section.get('y', 500)
            sec_angle_deg = section.get('angle', 0)
            sec_angle_rad = math.radians(sec_angle_deg)
            
            row_spacing = section.get('row_spacing', 40)
            seat_spacing = section.get('seat_spacing', 30)
            
            for r_idx, row_data in enumerate(section.get('rows', [])):
                label = row_data.get('label')
                count = row_data.get('count', 0)
                cat = row_data.get('category', 'standard')
                price = row_data.get('base_price', 1000)
                
                for s_idx in range(count):
                    final_x, final_y, final_angle = 0, 0, sec_angle_deg
                    
                    if layout_type == 'grid':
                        # Local grid coordinates
                        local_x = (s_idx - (count - 1) / 2) * seat_spacing
                        local_y = r_idx * row_spacing
                        # Rotation Matrix
                        rotated_x = local_x * math.cos(sec_angle_rad) - local_y * math.sin(sec_angle_rad)
                        rotated_y = local_x * math.sin(sec_angle_rad) + local_y * math.cos(sec_angle_rad)
                        final_x, final_y = base_x + rotated_x, base_y + rotated_y
                    
                    elif layout_type == 'arc':
                        # Radial logic: seats distributed along an arc
                        radius = section.get('radius', 300) + (r_idx * row_spacing)
                        # Spread seats over a specific aperture (angle)
                        aperture = section.get('aperture', 90)
                        seat_angle_step = aperture / max(1, count - 1)
                        # Current seat angle relative to section center
                        seat_angle_deg = sec_angle_deg + (s_idx * seat_angle_step) - (aperture / 2)
                        seat_angle_rad = math.radians(seat_angle_deg)
                        
                        final_x = base_x + radius * math.cos(seat_angle_rad)
                        final_y = base_y + radius * math.sin(seat_angle_rad)
                        final_angle = seat_angle_deg + 90 # Face the center
                    
                    Seat.objects.update_or_create(
                        theater=self,
                        section=sec_name,
                        row=label,
                        number=s_idx + 1,
                        defaults={
                            'category': cat,
                            'base_price': price,
                            'x': final_x,
                            'y': final_y,
                            'angle': final_angle
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
    
    # Precise positioning
    x = models.FloatField(default=0)
    y = models.FloatField(default=0)
    angle = models.FloatField(default=0) # In degrees

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
