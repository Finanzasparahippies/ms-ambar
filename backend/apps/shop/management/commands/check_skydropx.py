from django.core.management.base import BaseCommand
from django.conf import settings
from apps.shop.shipping import SkydropxClient, get_origin_address, SKYDROPX_MIN_BALANCE_ALERT
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
        parser.add_argument(
            '--test-shipment',
            action='store_true',
            help='Intenta emitir una guía de prueba en vivo/sandbox con la mejor tarifa cotizada para validar el endpoint POST /shipments.'
        )

    def handle(self, *args, **options):
        dest_cp = options['dest_cp']
        target_env = options['env']
        do_probe = options['probe']
        do_test_shipment = options['test_shipment']
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
            cred = result["credits_balance"]
            self.stdout.write(f"• Saldo / Créditos:      {cred}")
            # Alerta proactiva en consola
            if isinstance(cred, dict):
                bal = cred.get("balance") or cred.get("amount") or cred.get("credits")
                if bal is not None and float(bal) < SKYDROPX_MIN_BALANCE_ALERT:
                    self.stdout.write(self.style.ERROR(
                        f"⚠️ ALERTA DE SALDO: Cartera por debajo del umbral mínimo (${bal} < ${SKYDROPX_MIN_BALANCE_ALERT} MXN). Recargar saldo."
                    ))

        if result['success']:
            self.stdout.write(self.style.SUCCESS(f"\n✅ CONEXIÓN EXITOSA CON SKYDROPX PRO ({len(result['carriers_found'])} transportistas encontrados):"))
            for idx, c in enumerate(result['carriers_found'], 1):
                self.stdout.write(
                    f"   [{idx}] {c['provider']} ({c['service_level_name']}) -> ${c['total_price']} {c['currency']} (Entrega: {c['days']})"
                )

            # Prueba de emisión de guía si se especificó el flag
            if do_test_shipment and result['carriers_found']:
                best_rate = result['carriers_found'][0]
                self.stdout.write(self.style.NOTICE(
                    f"\n📦 Probando emisión de guía con tarifa {best_rate['provider']} ({best_rate['id']})..."
                ))
                test_dest = {
                    "name": "Cliente de Prueba Staging",
                    "phone": "6621234567",
                    "email": "test-staging@msambar.com",
                    "street": "Calle Morelos 100",
                    "suburb": "Centro",
                    "city": "Hermosillo",
                    "state": "SO",
                    "postal_code": dest_cp,
                    "country": "MX"
                }
                shipment_res = client.create_shipment_from_rate(
                    best_rate["id"],
                    address_from=origin,
                    address_to=test_dest
                )
                if shipment_res and shipment_res.get("success"):
                    self.stdout.write(self.style.SUCCESS(
                        f"🎉 Guía emitida exitosamente: ID {shipment_res['shipment_id']} | "
                        f"Tracking: {shipment_res['tracking_number']} | URL: {shipment_res.get('label_url')}"
                    ))
                else:
                    self.stdout.write(self.style.ERROR(
                        f"❌ Error emitiendo guía en Skydropx: {shipment_res}"
                    ))

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
