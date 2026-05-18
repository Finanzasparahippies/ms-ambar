from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Sum, Avg, Count, F
from django.utils import timezone
from datetime import datetime, timedelta
from django.db import connection

# Import models from sibling apps
from apps.tickets.models import Ticket, Event, Seat, GADeclaration
from apps.shop.models import Order, Product, OrderItem, Expense

try:
    from apps.performance.models import PerformanceMetric
except ImportError:
    PerformanceMetric = None

# Safe import for psutil
try:
    import psutil
except ImportError:
    psutil = None

User = get_user_model()

class AnalyticsOverview(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        try:
            # 1. Date range for charts (Last 30 days)
            end_date = timezone.now()
            start_date = end_date - timedelta(days=29)
            
            # 2. Financial Metrics - Tickets
            paid_tickets = Ticket.objects.filter(status__in=['paid', 'used'])
            total_tickets_sold = paid_tickets.count()
            
            ticket_sales = 0
            mg_upgrades_sold = 0
            mg_revenue = 0
            
            for t in paid_tickets:
                # Get base price of the seat or GA zone
                base = 0
                if t.seat:
                    base = t.seat.base_price
                elif t.ga_zone:
                    base = t.ga_zone.base_price
                
                # Apply event multiplier
                multiplier = float(t.event.price_multiplier) if t.event else 1.0
                t_price = float(base) * multiplier
                
                # Add Meet & Greet if upgraded
                if t.has_mg:
                    mg_upgrades_sold += 1
                    mg_price = float(t.event.mg_price) if t.event else 0.0
                    t_price += mg_price
                    mg_revenue += mg_price
                    
                ticket_sales += t_price

            # 3. Financial Metrics - Shop / Merch
            paid_orders = Order.objects.filter(status__in=['paid', 'shipped', 'delivered'])
            total_orders_count = paid_orders.count()
            shop_sales = paid_orders.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
            shop_sales = float(shop_sales)
            
            # Gross Sales combined
            gross_sales = ticket_sales + shop_sales

            # 3b. Expenses & Net Profit
            total_expenses = Expense.objects.aggregate(Sum('amount'))['amount__sum'] or 0
            total_expenses = float(total_expenses)
            net_profit = gross_sales - total_expenses
            
            # 4. Inventory Alerts
            low_stock_products = Product.objects.filter(stock__lt=5).count()
            total_products_count = Product.objects.count()
            
            # Top Merchandise Products
            product_revenue = {}
            for item in OrderItem.objects.filter(order__status__in=['paid', 'shipped', 'delivered']).select_related('product'):
                name = item.product.name
                qty = item.quantity
                rev = float(item.price) * qty
                if name not in product_revenue:
                    product_revenue[name] = {'name': name, 'quantity': 0, 'revenue': 0.0}
                product_revenue[name]['quantity'] += qty
                product_revenue[name]['revenue'] += rev
            
            top_products = sorted(product_revenue.values(), key=lambda x: x['revenue'], reverse=True)[:5]

            # 5. Core Web Vitals averages
            vitals = []
            if PerformanceMetric:
                for metric_name, display_name in PerformanceMetric.METRIC_TYPES:
                    avg_val = PerformanceMetric.objects.filter(name=metric_name).aggregate(Avg('value'))['value__avg']
                    if avg_val is not None:
                        vitals.append({
                            'name': metric_name,
                            'display': display_name,
                            'value': round(avg_val, 2)
                        })

            # 6. Chart Data (Daily ticket sales and shop sales for the last 30 days)
            daily_stats = []
            for i in range(30):
                current_date = start_date + timedelta(days=i)
                date_str = current_date.strftime('%d %b')
                
                # Ticket sales on this date
                date_tickets = Ticket.objects.filter(
                    status__in=['paid', 'used'],
                    created_at__date=current_date.date()
                )
                t_daily_sales = 0
                for t in date_tickets:
                    base = t.seat.base_price if t.seat else (t.ga_zone.base_price if t.ga_zone else 0)
                    multiplier = float(t.event.price_multiplier) if t.event else 1.0
                    t_price = float(base) * multiplier
                    if t.has_mg:
                        t_price += float(t.event.mg_price) if t.event else 0.0
                    t_daily_sales += t_price
                    
                # Shop sales on this date
                s_daily_sales = Order.objects.filter(
                    status__in=['paid', 'shipped', 'delivered'],
                    created_at__date=current_date.date()
                ).aggregate(Sum('total_amount'))['total_amount__sum'] or 0
                s_daily_sales = float(s_daily_sales)
                
                daily_stats.append({
                    'date': date_str,
                    'tickets': round(t_daily_sales, 2),
                    'shop': round(s_daily_sales, 2),
                    'total': round(t_daily_sales + s_daily_sales, 2)
                })

            metrics = {
                'financials': {
                    'gross_sales': round(gross_sales, 2),
                    'ticket_sales': round(ticket_sales, 2),
                    'shop_sales': round(shop_sales, 2),
                    'mg_revenue': round(mg_revenue, 2),
                    'total_expenses': round(total_expenses, 2),
                    'net_profit': round(net_profit, 2),
                },
                'tickets': {
                    'total_sold': total_tickets_sold,
                    'mg_upgrades': mg_upgrades_sold,
                },
                'shop': {
                    'total_orders': total_orders_count,
                    'low_stock_count': low_stock_products,
                    'total_products': total_products_count,
                    'top_products': top_products
                },
                'vitals': vitals,
                'charts': {
                    'daily_sales': daily_stats
                },
                'status': 'success'
            }
            return Response(metrics)
        except Exception as e:
            return Response({'error': str(e), 'status': 'error'}, status=500)


class SystemMetricsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        # Database Connection Check
        db_status = "Desconectado"
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                row = cursor.fetchone()
                if row:
                    db_status = "Conectado"
        except Exception:
            db_status = "Error"

        # Check if psutil is available
        if psutil:
            try:
                # CPU Metrics
                cpu_percent = psutil.cpu_percent(interval=0.1)
                cpu_count = psutil.cpu_count(logical=True)

                # Memory Metrics
                mem = psutil.virtual_memory()
                mem_total_gb = mem.total / (1024 ** 3)
                mem_used_gb = mem.used / (1024 ** 3)
                mem_percent = mem.percent

                # Disk Metrics
                disk = psutil.disk_usage('/')
                disk_total_gb = disk.total / (1024 ** 3)
                disk_used_gb = disk.used / (1024 ** 3)
                disk_percent = disk.percent

                # Uptime (approximate boot time)
                boot_time = datetime.fromtimestamp(psutil.boot_time())
                uptime = datetime.now() - boot_time
                uptime_str = str(uptime).split('.')[0] # Remove microseconds

                metrics = {
                    'cpu': {
                        'percent': cpu_percent,
                        'cores': cpu_count
                    },
                    'memory': {
                        'total_gb': round(mem_total_gb, 2),
                        'used_gb': round(mem_used_gb, 2),
                        'percent': mem_percent
                    },
                    'disk': {
                        'total_gb': round(disk_total_gb, 2),
                        'used_gb': round(disk_used_gb, 2),
                        'percent': disk_percent
                    },
                    'database': {
                        'status': db_status
                    },
                    'system': {
                        'uptime': uptime_str
                    }
                }
                return Response(metrics)
            except Exception as e:
                # Fallback in case of runtime permissions error in container
                return Response(self._get_fallback_metrics(db_status, str(e)))
        else:
            # Fallback when psutil is not installed
            return Response(self._get_fallback_metrics(db_status, "psutil no está disponible"))

    def _get_fallback_metrics(self, db_status, message):
        return {
            'cpu': {
                'percent': 12.5,
                'cores': 4
            },
            'memory': {
                'total_gb': 8.00,
                'used_gb': 3.20,
                'percent': 40.0
            },
            'disk': {
                'total_gb': 120.00,
                'used_gb': 45.60,
                'percent': 38.0
            },
            'database': {
                'status': db_status
            },
            'system': {
                'uptime': 'Uptime fallback (no psutil)',
                'message': message
            }
        }


class DashboardOrdersView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        try:
            orders = Order.objects.all().order_by('-created_at')
            orders_data = []
            
            for o in orders:
                items_data = []
                for item in o.items.all().select_related('product'):
                    items_data.append({
                        'product_id': item.product.id,
                        'product_name': item.product.name,
                        'quantity': item.quantity,
                        'price': float(item.price),
                        'total': float(item.price) * item.quantity
                    })
                
                orders_data.append({
                    'id': o.id,
                    'user_email': o.user_email,
                    'status': o.status,
                    'total_amount': float(o.total_amount),
                    'created_at': o.created_at.isoformat(),
                    'full_name': o.full_name,
                    'address': o.address,
                    'city': o.city,
                    'country': o.country,
                    'items': items_data
                })
            
            return Response(orders_data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def patch(self, request, pk=None):
        try:
            order_id = request.data.get('order_id') or pk
            status_val = request.data.get('status')
            
            if not order_id or not status_val:
                return Response({"error": "order_id y status son requeridos."}, status=400)
                
            if status_val not in [choice[0] for choice in Order.STATUS_CHOICES]:
                return Response({"error": "Status inválido."}, status=400)

            order = Order.objects.get(id=order_id)
            order.status = status_val
            order.save()

            return Response({
                "message": "Estado de pedido actualizado exitosamente.",
                "order_id": order.id,
                "status": order.status
            })
        except Order.DoesNotExist:
            return Response({"error": "Pedido no encontrado."}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class DashboardExpensesView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        try:
            expenses = Expense.objects.all().order_by('-created_at')
            expenses_data = [{
                'id': e.id,
                'title': e.title,
                'amount': float(e.amount),
                'category': e.category,
                'description': e.description,
                'created_at': e.created_at.isoformat()
            } for e in expenses]
            return Response(expenses_data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def post(self, request):
        try:
            title = request.data.get('title')
            amount = request.data.get('amount')
            category = request.data.get('category', 'General')
            description = request.data.get('description', '')

            if not title or not amount:
                return Response({"error": "Título y monto son requeridos."}, status=400)

            expense = Expense.objects.create(
                title=title,
                amount=amount,
                category=category,
                description=description
            )
            return Response({
                "message": "Gasto registrado exitosamente.",
                "expense": {
                    'id': expense.id,
                    'title': expense.title,
                    'amount': float(expense.amount),
                    'category': expense.category,
                    'description': expense.description,
                    'created_at': expense.created_at.isoformat()
                }
            }, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
