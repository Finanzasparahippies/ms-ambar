import logging
from django.core.management.base import BaseCommand
from apps.shop.models import Order
from apps.shop.shipping import reconcile_order_shipping, reconcile_pending_shipments

logger = logging.getLogger("apps")


class Command(BaseCommand):
    help = "Reconcilia el estado de los envíos con Skydropx Pro para pedidos pendientes, en procesamiento o con error."

    def add_arguments(self, parser):
        parser.add_argument(
            "--order",
            type=int,
            help="ID específico de la orden a reconciliar",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=50,
            help="Límite máximo de órdenes a procesar en lote (default: 50)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Simula el proceso de reconciliación sin aplicar mutaciones en la base de datos ni deducciones de saldo.",
        )

    def handle(self, *args, **options):
        order_id = options.get("order")
        limit = options.get("limit") or 50
        dry_run = options.get("dry_run", False)

        if dry_run:
            self.stdout.write(self.style.WARNING("🔍 MODO DRY-RUN ACTIVADO: Solo se auditarán y simularán las acciones."))

        if order_id:
            order = Order.objects.filter(id=order_id).first()
            if not order:
                self.stderr.write(self.style.ERROR(f"Orden #{order_id} no encontrada."))
                return

            self.stdout.write(f"Reconciliando Pedido #{order.id} (dry_run={dry_run})...")
            res = reconcile_order_shipping(order, dry_run=dry_run)
            if dry_run:
                self.stdout.write(self.style.NOTICE(
                    f"🔎 [DRY-RUN] Pedido #{order.id}: "
                    f"Acción={res.get('action_planned') or res.get('message')}, "
                    f"Status Actual={res.get('current_status')}, "
                    f"Status Planeado={res.get('planned_status', 'N/A')}"
                ))
            elif res.get("reconciled"):
                self.stdout.write(self.style.SUCCESS(f"✅ Pedido #{order.id} reconciliado: Status={res.get('status')}, Tracking={res.get('tracking_number')}"))
            else:
                self.stdout.write(self.style.WARNING(f"⚠️ Pedido #{order.id} no pudo reconciliarse: {res.get('error') or res.get('message')}"))
            return

        self.stdout.write(f"Iniciando reconciliación por lotes de pedidos pendientes (hasta {limit}, dry_run={dry_run})...")
        results = reconcile_pending_shipments(dry_run=dry_run, limit=limit)
        
        if dry_run:
            self.stdout.write(self.style.NOTICE(f"\n--- Resumen de Simulación Dry-Run ({len(results)} órdenes analizadas) ---"))
            for r in results:
                self.stdout.write(f" - Pedido #{r.get('order_id')}: {r.get('action_planned') or r.get('message')}")
        else:
            reconciled = [r for r in results if r.get("reconciled")]
            self.stdout.write(self.style.SUCCESS(
                f"✅ Proceso finalizado. Total analizados: {len(results)}, Reconciliados exitosamente: {len(reconciled)}"
            ))
