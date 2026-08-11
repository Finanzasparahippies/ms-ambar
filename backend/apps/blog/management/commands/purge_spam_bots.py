import os
import re
import logging
from datetime import datetime
from django.core.management.base import BaseCommand
from django.db import models, transaction
from django.contrib.auth import get_user_model
from django.conf import settings
from apps.blog.models import NewsletterSubscriber
from apps.tickets.models import Ticket

User = get_user_model()
logger = logging.getLogger(__name__)


def normalize_email(email: str) -> str:
    """
    Normaliza un correo electrónico para comparaciones de seguridad.
    En Gmail/Googlemail, elimina alias (+etiqueta) y puntos internos.
    """
    if not email or '@' not in email:
        return (email or '').strip().lower()
    
    email_clean = email.strip().lower()
    local_part, domain = email_clean.split('@', 1)
    
    if domain in ('gmail.com', 'googlemail.com'):
        local_part = local_part.split('+')[0]
        local_part = local_part.replace('.', '')
        
    return f"{local_part}@{domain}"


def detect_spam_reason(email: str) -> str:
    """
    Evalúa si un correo coincide con patrones conocidos de spam/bots.
    """
    if not email or '@' not in email:
        return None
        
    email_clean = email.strip().lower()
    local_part, domain = email_clean.split('@', 1)
    
    # a) Dot-Stuffing: Correos de Gmail con 4 o más puntos en el nombre de usuario
    if domain in ('gmail.com', 'googlemail.com') and local_part.count('.') >= 4:
        return "Dot-Stuffing (4+ puntos en Gmail)"
        
    # b) Pasarelas SMS/MMS
    sms_gateways = {'txt.att.net', 'tmomail.net', 'vtext.com', 'mms.att.net'}
    if domain in sms_gateways:
        return f"Pasarela SMS/MMS ({domain})"
        
    # c) Patrones repetitivos: Secuencias intercaladas excesivas (RegEx ([a-z]\.){3,})
    if re.search(r'([a-z]\.){3,}', local_part, re.IGNORECASE):
        return "Patrón repetitivo ([a-z].){3,}"
        
    # d) Dominios de prueba/Scraped o TLDs raros no comerciales (.ru, .xyz, .top, xwf.google.com)
    if domain == 'xwf.google.com' or domain.endswith(('.ru', '.xyz', '.top')):
        return f"Dominio de prueba/bot TLD ({domain})"
        
    return None


class Command(BaseCommand):
    help = "Depura y purga registros de spam/bots en NewsletterSubscriber respetando compradores, staff y superusuarios."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Evalúa y lista los registros detectados como spam sin eliminarlos físicamente de la base de datos.'
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        mode_str = "DRY RUN (Simulación)" if dry_run else "REAL EXECUTION (Purga activa)"
        
        self.stdout.write(self.style.NOTICE(f"=== INICIANDO DEPURACIÓN DE SPAM BOTS ({mode_str}) ==="))

        # 1. Optimización N+1 Queries: Precargar sets de emails protegidos (Tickets + Staff/Superusers)
        self.stdout.write("Precargando registros de compradores y usuarios privilegiados...")
        
        buyer_emails_raw = Ticket.objects.exclude(user_email='').values_list('user_email', flat=True).distinct()
        staff_emails_raw = User.objects.filter(
            models.Q(is_staff=True) | models.Q(is_superuser=True)
        ).exclude(email='').values_list('email', flat=True).distinct()

        protected_emails = {normalize_email(e) for e in buyer_emails_raw if e}
        protected_emails.update({normalize_email(e) for e in staff_emails_raw if e})
        
        self.stdout.write(f"Emails protegidos en memoria: {len(protected_emails)}")

        # 2. Configurar Registro de Auditoría Persistente
        log_dir = getattr(settings, 'BASE_DIR', None)
        if log_dir:
            logs_path = os.path.join(log_dir, 'logs')
        else:
            logs_path = 'logs'
            
        os.makedirs(logs_path, exist_ok=True)
        audit_log_file = os.path.join(logs_path, 'purge_bots.log')

        evaluated_count = 0
        spam_count = 0
        purged_count = 0
        excluded_count = 0

        # 3. Iterar suscriptores eficientemente usando chunk_size=1000
        subscribers_qs = NewsletterSubscriber.objects.all().order_by('id')
        
        with open(audit_log_file, 'a', encoding='utf-8') as log_file:
            log_file.write(f"\n--- SESIÓN {datetime.now().isoformat()} | {mode_str} ---\n")
            
            for subscriber in subscribers_qs.iterator(chunk_size=1000):
                evaluated_count += 1
                email = subscriber.email or ''
                norm_email = normalize_email(email)
                tags_lower = (subscriber.tags or '').lower()

                # REGLA DE EXCLUSIÓN ESTRICTA
                if 'comprador' in tags_lower or norm_email in protected_emails:
                    excluded_count += 1
                    continue

                # REGLAS DE DETECCIÓN DE SPAM
                reason = detect_spam_reason(email)
                if reason:
                    spam_count += 1
                    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    
                    if dry_run:
                        status_msg = f"[DRY-RUN DETECTED] ID={subscriber.id} | Email={email} | Motivo: {reason}"
                        self.stdout.write(self.style.WARNING(status_msg))
                        log_file.write(f"[{timestamp}] [DRY-RUN] ID={subscriber.id} | Email={email} | Motivo: {reason}\n")
                    else:
                        subscriber.delete()
                        purged_count += 1
                        status_msg = f"[PURGED] ID={subscriber.id} | Email={email} | Motivo: {reason}"
                        self.stdout.write(self.style.SUCCESS(status_msg))
                        log_file.write(f"[{timestamp}] [PURGED] ID={subscriber.id} | Email={email} | Motivo: {reason}\n")

        # 4. Resumen final
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write(self.style.SUCCESS(f"RESUMEN DE EJECUCIÓN ({mode_str}):"))
        self.stdout.write(f"  - Total registros evaluados: {evaluated_count}")
        self.stdout.write(f"  - Registros excluidos (Compradores/Staff): {excluded_count}")
        self.stdout.write(f"  - Spam/Bots identificados: {spam_count}")
        if dry_run:
            self.stdout.write(self.style.WARNING("  - Registros eliminados: 0 (Modo Dry-Run activo)"))
        else:
            self.stdout.write(self.style.SUCCESS(f"  - Registros eliminados de la BD: {purged_count}"))
        self.stdout.write(f"  - Log de auditoría guardado en: {audit_log_file}")
        self.stdout.write("=" * 50 + "\n")
