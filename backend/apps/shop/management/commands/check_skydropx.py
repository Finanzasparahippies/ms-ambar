from django.core.management.base import BaseCommand
from django.conf import settings
from apps.shop.shipping import SkydropxClient, get_origin_address
import json

class Command(BaseCommand):
    help = 'Diagnóstico exhaustivo y prueba de conectividad con Skydropx Pro Sandbox/Producción.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dest-cp',
            type=str,
            default='83100',
            help='Código postal de destino para cotización de prueba (default: 83100 Hermosillo).'
        )
        parser.add_argument(
            '--env',
            type=str,
            default=None,
            choices=['production', 'staging', 'sandbox', 'demo', 'pro_production', 'pro_staging', 'pro_sandbox'],
            help='Entorno a evaluar (production | staging | sandbox | pro_production | pro_staging | pro_sandbox).'
        )
        parser.add_argument(
            '--probe',
            action='store_true',
            help='Sondea automáticamente todos los gateways y esquemas de autenticación de Skydropx.'
        )

    def handle(self, *args, **options):
        dest_cp = options['dest_cp']
        target_env = options['env']
        do_probe = options['probe']
        client = SkydropxClient(environment=target_env)
        origin = get_origin_address()

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== 📦 DIAGNÓSTICO DE CONEXIÓN SKYDROPX PRO (MS AMBAR) ==="))
        self.stdout.write(f"• Entorno Evaluado:      {self.style.WARNING(client.environment.upper())}")
        self.stdout.write(f"• Endpoint Activo:       {self.style.HTTP_INFO(client.base_url)}")
        self.stdout.write(f"• OAuth2 Token URL:      {self.style.HTTP_INFO(client.oauth_url)}")
        self.stdout.write(f"• API Key (Client ID):   {client.api_key[:8]}...{client.api_key[-4:] if len(client.api_key) > 12 else ''}")
        self.stdout.write(f"• API Secret Presente:   {'Sí' if client.api_secret else 'No'}")
        self.stdout.write(f"• Dirección de Origen:   {origin['street']}, {origin['suburb']}, {origin['city']}, {origin['state']} (CP {origin['zip_code']})")
        self.stdout.write(f"• CP de Destino Test:    {dest_cp}\n")

        if not client.is_configured:
            self.stdout.write(self.style.ERROR("❌ ERROR: Skydropx no está configurado o está en modo TESTING."))
            self.stdout.write("Verifica que SKYDROPX_API_KEY o NECTAR_LABS_SKYDROPX_API_KEY no esté vacía ni sea 'mock_key'.\n")
            return

        if do_probe:
            self.stdout.write(self.style.NOTICE("🔍 Sondeando todos los gateways de Skydropx...\n"))
            probes = client.probe_all_gateways(dest_zip=dest_cp)
            for p in probes:
                status_color = self.style.SUCCESS if p['success'] else (self.style.WARNING if p['status_code'] == 401 else self.style.ERROR)
                self.stdout.write(f"  • {p['label']:<25} [{status_color(str(p['status_code'] or 'ERR'))}] ({p['latency_ms']}ms) -> {p['summary']}")
            self.stdout.write("")
            return

        self.stdout.write(self.style.NOTICE("⏳ Verificando autenticación OAuth2 y cotizando en Skydropx Pro..."))
        result = client.test_connectivity(dest_zip=dest_cp)

        self.stdout.write(f"• Handshake OAuth2:      {'✅ Exitoso (Bearer Token Adquirido)' if result['oauth_token_acquired'] else '❌ Falló Handshake'}")
        self.stdout.write(f"• Latencia:              {result['latency_ms']} ms")
        self.stdout.write(f"• Código HTTP:           {result['status_code']}")

        if result.get("credits_balance"):
            self.stdout.write(f"• Saldo / Créditos:      {result['credits_balance']}")

        if result['success']:
            self.stdout.write(self.style.SUCCESS(f"\n✅ CONEXIÓN EXITOSA CON SKYDROPX PRO ({len(result['carriers_found'])} transportistas encontrados):"))
            for idx, c in enumerate(result['carriers_found'], 1):
                self.stdout.write(
                    f"   [{idx}] {c['provider']} ({c['service_level_name']}) -> ${c['total_price']} {c['currency']} (Entrega: {c['days']})"
                )
            self.stdout.write(self.style.SUCCESS("\n🎉 Tu integración con Skydropx Pro está lista, cotizando y apta para emitir guías descontando saldo.\n"))
        else:
            self.stdout.write(self.style.ERROR(f"\n❌ FALLÓ LA COMUNICACIÓN CON SKYDROPX ({result['base_url']}):"))
            self.stdout.write(f"• Detalle del Error: {result.get('error')}")
            
            # Ejecutar sondeo automático de diagnóstico
            self.stdout.write(self.style.WARNING("\n🔍 Diagnóstico de endpoints OAuth2 alternativos:"))
            probes = client.probe_all_gateways(dest_zip=dest_cp)
            for p in probes:
                status_color = self.style.SUCCESS if p['success'] else (self.style.WARNING if p['status_code'] == 401 else self.style.ERROR)
                self.stdout.write(f"  • {p['label']:<25} [{status_color(str(p['status_code'] or 'ERR'))}] ({p['latency_ms']}ms) -> {p['summary']}")
            self.stdout.write("")
