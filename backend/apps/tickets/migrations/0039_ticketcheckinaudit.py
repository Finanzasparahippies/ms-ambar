from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('tickets', '0038_coupon_max_tickets_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='TicketCheckInAudit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('scanned_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('scanner_device_id', models.CharField(default='door-1', help_text='Identificador único del dispositivo escáner o torniquete', max_length=100)),
                ('location', models.CharField(default='Acceso Principal', help_text='Punto de acceso físico (ej. Puerta Norte, VIP, Acceso Principal)', max_length=150)),
                ('operator_name', models.CharField(blank=True, default='', max_length=150)),
                ('idempotency_key', models.CharField(blank=True, db_index=True, help_text='Llave de idempotencia del escáner para evitar doble check-in ante reintentos de red', max_length=120, null=True)),
                ('status_result', models.CharField(choices=[('SUCCESS', 'Acceso Exitoso'), ('ALREADY_USED', 'Ya Utilizado (Rechazado)'), ('INVALID', 'QR Inválido o Falsificado'), ('ERROR', 'Error de Procesamiento')], default='SUCCESS', max_length=30)),
                ('response_payload', models.JSONField(blank=True, default=dict, help_text='Copia de la respuesta JSON entregada al escáner')),
                ('notes', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('operator', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='operator_checkins', to=settings.AUTH_USER_MODEL)),
                ('ticket', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='checkin_audits', to='tickets.ticket')),
            ],
            options={
                'verbose_name': 'Auditoría de Check-In',
                'verbose_name_plural': 'Auditorías de Check-In',
                'ordering': ['-scanned_at'],
            },
        ),
    ]
