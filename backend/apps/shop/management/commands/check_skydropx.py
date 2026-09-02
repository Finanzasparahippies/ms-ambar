from django.core.management.base import BaseCommand
from django.conf import settings
from apps.shop.shipping import SkydropxClient, get_origin_address
import json

class Command(BaseCommand):
    help = 'Diagnóstico exhaustivo y prueba de conectividad con Skydropx Sandbox/Producción.'

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
            choices=['production', 'staging', 'sandbox', 'demo', 'pro_production', 'pro_sandbox'],
            help='Entorno a evaluar (production | staging | sandbox | demo | pro_production | pro_sandbox).'
        )

    def handle(self, *args, **options):
        dest_cp = options['dest_cp']
        target_env = options['env']
        client = SkydropxClient(environment=target_env)
        origin = get_origin_address()

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== 📦 DIAGNÓSTICO DE CONEXIÓN SKYDROPX (MS AMBAR) ==="))
        self.stdout.write(f"• Entorno Evaluado:    {self.style.WARNING(client.environment.upper())}")
        self.stdout.write(f"• Endpoint Activo:     {self.style.HTTP_INFO(client.base_url)}")
        self.stdout.write(f"• Dirección de Origen: {origin['street']}, {origin['suburb']}, {origin['city']}, {origin['state']} (CP {origin['zip_code']})")
        self.stdout.write(f"• CP de Destino Test:  {dest_cp}\n")


        if not client.is_configured:
            self.stdout.write(self.style.ERROR("❌ ERROR: Skydropx no está configurado o está en modo TESTING."))
            self.stdout.write("Verifica que NECTAR_LABS_SKYDROPX_API_KEY no esté vacía ni sea 'mock_key'.\n")
            return

        self.stdout.write(self.style.NOTICE("⏳ Enviando cotización de prueba a Skydropx..."))
        result = client.test_connectivity(dest_zip=dest_cp)

        self.stdout.write(f"• Latencia:            {result['latency_ms']} ms")
        self.stdout.write(f"• Código HTTP:         {result['status_code']}")

        if result['success']:
            self.stdout.write(self.style.SUCCESS(f"\n✅ CONEXIÓN EXITOSA CON SKYDROPX ({len(result['carriers_found'])} transportistas encontrados):"))
            for idx, c in enumerate(result['carriers_found'], 1):
                self.stdout.write(
                    f"   [{idx}] {c['provider']} ({c['service']}) -> ${c['total_price']} {c['currency']} (Entrega: {c['days']})"
                )
            self.stdout.write(self.style.SUCCESS("\n🎉 Tu integración con Skydropx Sandbox está lista y cotizando en tiempo real.\n"))
        else:
            self.stdout.write(self.style.ERROR(f"\n❌ FALLÓ LA COMUNICACIÓN CON SKYDROPX:"))
            self.stdout.write(f"• Detalle del Error: {result.get('error')}")
            if result.get('raw_response'):
                self.stdout.write(f"• Respuesta Cruda:  {json.dumps(result['raw_response'], indent=2, ensure_ascii=False) if isinstance(result['raw_response'], dict) else result['raw_response']}")
            self.stdout.write(self.style.WARNING("\nSugerencia: Revisa que SKYDROPX_API_URL corresponda al sandbox correcto (https://api-demo.skydropx.com/v1 o https://sb-pro.skydropx.com/api/v1) y que la API key coincida con ese ambiente.\n"))
