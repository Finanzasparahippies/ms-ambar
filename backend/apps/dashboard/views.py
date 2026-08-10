import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Sum, Avg, Count, F
from django.utils import timezone
from datetime import datetime, timedelta, timezone as dt_timezone
from django.db import connection

# Import models from sibling apps
from apps.tickets.models import Ticket, Event, Seat, GADeclaration
from apps.shop.models import Order, Product, OrderItem, Expense
from apps.dashboard.services.ads_service import AdsIntegrationService

try:
    from apps.performance.models import PerformanceMetric
except ImportError as e:
    PerformanceMetric = None

# Safe import for psutil
try:
    import psutil
except ImportError:
    psutil = None

User = get_user_model()
logger = logging.getLogger("apps.dashboard")


def get_ticket_actual_price(t):
    """
    Calcula el precio real pagado por un boleto de forma precisa e inmutable.
    1. Si 'amount_paid' está guardado en el boleto, usa ese monto exacto.
    2. De lo contrario, calcula el precio dinámico utilizando t.created_at como fecha de compra,
       garantizando que la variación dinámica futura no infle los ingresos del pasado.
    """
    try:
        if getattr(t, 'amount_paid', None) is not None:
            return round(float(t.amount_paid), 2)

        event = getattr(t, 'event', None)
        if not event:
            return 0.0

        seat = getattr(t, 'seat', None)
        ga_zone = getattr(t, 'ga_zone', None)
        event_type = getattr(event, 'event_type', 'concert')
        created_at = getattr(t, 'created_at', None)

        if event_type == 'meet_greet':
            price = float(getattr(event, 'mg_price', 0.0) or 0.0)
        elif seat:
            event_num_price = float(getattr(event, 'numbered_ticket_price', 0) or 0)
            seat_db_price = float(getattr(seat, 'base_price', 0.0) or 0.0)

            if event_num_price > 0:
                if seat_db_price > 0 and seat_db_price not in [500.0, 1000.0]:
                    seat_base = event_num_price * (seat_db_price / 1000.0)
                else:
                    seat_base = event_num_price
            elif seat_db_price > 0:
                seat_base = seat_db_price
            else:
                seat_base = 1000.0

            multiplier = float(getattr(event, 'price_multiplier', 1.0) or 1.0)
            raw_seat_price = seat_base * multiplier
            price = event.get_dynamic_price(raw_seat_price, purchase_date=created_at) if hasattr(event, 'get_dynamic_price') else raw_seat_price
            if getattr(t, 'has_mg', False):
                price += float(getattr(event, 'mg_price', 0.0) or 0.0)
        elif ga_zone:
            raw_price = float(getattr(ga_zone, 'base_price', 0.0) or 0.0)
            price = event.get_dynamic_price(raw_price, purchase_date=created_at) if hasattr(event, 'get_dynamic_price') else raw_price
            if getattr(t, 'has_mg', False):
                price += float(getattr(event, 'mg_price', 0.0) or 0.0)
        else:
            seatless_base = float(getattr(event, 'seatless_ticket_price', 500.00) or 500.00)
            multiplier = float(getattr(event, 'price_multiplier', 1.0) or 1.0)
            raw_price = seatless_base * multiplier
            price = event.get_dynamic_price(raw_price, purchase_date=created_at) if hasattr(event, 'get_dynamic_price') else raw_price
            if getattr(t, 'has_mg', False):
                price += float(getattr(event, 'mg_price', 0.0) or 0.0)

        # Aplicar cupones de descuento si existen
        used_coupon = getattr(t, 'used_coupon', None)
        if used_coupon:
            dt = getattr(used_coupon, 'discount_type', '')
            dp = float(getattr(used_coupon, 'discount_percent', 0.0) or (getattr(used_coupon, 'discount_value', 0.0) if dt == 'percentage' else 0.0))
            da = float(getattr(used_coupon, 'discount_amount', 0.0) or (getattr(used_coupon, 'discount_value', 0.0) if dt == 'fixed' else 0.0))
            if dt == 'free_vip':
                price = 0.0
            elif dp > 0:
                price = price * (1.0 - (dp / 100.0))
            elif da > 0:
                price = max(0.0, price - da)

        return round(float(price), 2)
    except (ObjectDoesNotExist, AttributeError, ValueError, TypeError) as ex:
        logger.warning(f"[get_ticket_actual_price] Fallback for ticket #{getattr(t, 'id', 'unknown')}: {ex}")
        return 0.0
    except Exception as ex:
        logger.error(f"[get_ticket_actual_price] Error calculating ticket #{getattr(t, 'id', 'unknown')}: {ex}", exc_info=True)
        return 0.0


class AnalyticsOverview(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        try:
            # 1. Date range for charts and period financial metrics (Default last 30 days or specified period)
            period_param = str(request.query_params.get('period', '30d')).lower()
            now_utc = timezone.now()

            if period_param == '7d':
                period_days = 6
            elif period_param == '90d':
                period_days = 89
            elif period_param in ['365d', '1y']:
                period_days = 364
            else:
                period_days = 29

            has_custom_start = bool(request.query_params.get('start_date'))
            has_custom_end = bool(request.query_params.get('end_date'))
            end_date = now_utc

            if has_custom_end:
                try:
                    parsed_end = datetime.fromisoformat(request.query_params['end_date'])
                    if parsed_end.time() == datetime.min.time():
                        parsed_end = datetime.combine(parsed_end.date(), datetime.max.time())
                    if parsed_end.tzinfo is None:
                        parsed_end = parsed_end.replace(tzinfo=dt_timezone.utc)
                    else:
                        parsed_end = parsed_end.astimezone(dt_timezone.utc)
                    end_date = parsed_end
                except (ValueError, TypeError) as err:
                    logger.warning(f"Formato de end_date inválido ({request.query_params.get('end_date')}), usando por defecto: {err}")

            if has_custom_start:
                try:
                    parsed_start = datetime.fromisoformat(request.query_params['start_date'])
                    if parsed_start.tzinfo is None:
                        parsed_start = parsed_start.replace(tzinfo=dt_timezone.utc)
                    else:
                        parsed_start = parsed_start.astimezone(dt_timezone.utc)
                    start_date = parsed_start
                except (ValueError, TypeError) as err:
                    logger.warning(f"Formato de start_date inválido ({request.query_params.get('start_date')}), usando por defecto: {err}")
                    start_date = end_date - timedelta(days=period_days)
            elif period_param == 'all':
                earliest_ticket = Ticket.objects.filter(status__in=['paid', 'used']).order_by('created_at').first()
                earliest_order = Order.objects.filter(status__in=['paid', 'shipped', 'delivered']).order_by('created_at').first()
                earliest_dates = [d for d in [getattr(earliest_ticket, 'created_at', None), getattr(earliest_order, 'created_at', None)] if d]
                start_date = min(earliest_dates) if earliest_dates else datetime(2020, 1, 1, tzinfo=dt_timezone.utc)
            else:
                start_date = end_date - timedelta(days=period_days)

            # Smart Fallback & Date Anchor: si en el periodo solicitado no existen transacciones activas,
            # anclamos end_date al registro comercial más reciente en la BD para que las gráficas y contenedores reflejen datos reales.
            is_historical_fallback = False
            if not has_custom_start and not has_custom_end and period_param != 'all':
                recent_tickets_exist = Ticket.objects.filter(status__in=['paid', 'used'], created_at__gte=start_date, created_at__lte=end_date).exists()
                recent_orders_exist = Order.objects.filter(status__in=['paid', 'shipped', 'delivered'], created_at__gte=start_date, created_at__lte=end_date).exists()

                if not recent_tickets_exist and not recent_orders_exist:
                    latest_ticket = Ticket.objects.filter(status__in=['paid', 'used']).order_by('-created_at').first()
                    latest_order = Order.objects.filter(status__in=['paid', 'shipped', 'delivered']).order_by('-created_at').first()
                    latest_dates = [d for d in [getattr(latest_ticket, 'created_at', None), getattr(latest_order, 'created_at', None)] if d]
                    if latest_dates:
                        end_date = max(latest_dates)
                        start_date = end_date - timedelta(days=period_days)
                        is_historical_fallback = True

            # 2. Financial Metrics - Tickets & Orders
            period_tickets = Ticket.objects.filter(
                status__in=['paid', 'used'],
                created_at__gte=start_date,
                created_at__lte=end_date
            ).select_related('event', 'seat', 'ga_zone', 'used_coupon')

            period_orders = Order.objects.filter(
                status__in=['paid', 'shipped', 'delivered'],
                created_at__gte=start_date,
                created_at__lte=end_date
            )

            ticket_sales = 0.0
            mg_upgrades_sold = 0
            mg_revenue = 0.0

            for t in period_tickets:
                try:
                    event = getattr(t, 'event', None)
                    if event and (getattr(t, 'has_mg', False) or getattr(event, 'event_type', '') == 'meet_greet'):
                        mg_upgrades_sold += 1
                        mg_revenue += float(getattr(event, 'mg_price', 0.0) or 0.0)
                    ticket_sales += get_ticket_actual_price(t)
                except Exception as ex:
                    logger.warning(f"[AnalyticsOverview] Error processing paid ticket #{getattr(t, 'id', 'unknown')}: {ex}", exc_info=True)
                    continue

            total_tickets_sold = period_tickets.count()
            total_orders_count = period_orders.count()
            shop_sales = float(period_orders.aggregate(Sum('total_amount'))['total_amount__sum'] or 0)
            gross_sales = ticket_sales + shop_sales

            # 3b. Expenses & Net Profit for active period
            period_expenses = Expense.objects.filter(
                created_at__gte=start_date,
                created_at__lte=end_date
            ).aggregate(Sum('amount'))['amount__sum'] or 0
            total_expenses = float(period_expenses)
            net_profit = gross_sales - total_expenses
            
            # 4. Inventory Alerts
            low_stock_products = Product.objects.filter(stock__lt=5).count()
            total_products_count = Product.objects.count()
            
            # Top Merchandise Products
            product_revenue = {}
            for item in OrderItem.objects.filter(order__status__in=['paid', 'shipped', 'delivered']).select_related('product'):
                try:
                    if not item.product:
                        continue
                    name = item.product.name
                    qty = item.quantity
                    rev = float(item.price) * qty
                    if name not in product_revenue:
                        product_revenue[name] = {'name': name, 'quantity': 0, 'revenue': 0.0}
                    product_revenue[name]['quantity'] += qty
                    product_revenue[name]['revenue'] += rev
                except Exception as ex:
                    logger.warning(f"[AnalyticsOverview] Error processing order item #{getattr(item, 'id', 'unknown')}: {ex}")
                    continue
            
            top_products = sorted(product_revenue.values(), key=lambda x: x['revenue'], reverse=True)[:5]

            # 5. Core Web Vitals averages
            vitals = []
            if PerformanceMetric:
                try:
                    for metric_name, display_name in PerformanceMetric.METRIC_TYPES:
                        avg_val = PerformanceMetric.objects.filter(name=metric_name).aggregate(Avg('value'))['value__avg']
                        if avg_val is not None:
                            vitals.append({
                                'name': metric_name,
                                'display': display_name,
                                'value': round(avg_val, 2)
                            })
                except Exception as ex:
                    logger.warning(f"[AnalyticsOverview] Error calculating PerformanceMetrics: {ex}", exc_info=True)
                    vitals = []

            # 6. Chart Data (Daily ticket sales and shop sales for the 30 days up to end_date)
            daily_stats = []
            daily_start_base = end_date - timedelta(days=29)
            for i in range(30):
                try:
                    current_dt = daily_start_base + timedelta(days=i)
                    date_str = current_dt.strftime('%d %b')
                    
                    d_start = datetime.combine(current_dt.date(), datetime.min.time(), tzinfo=dt_timezone.utc)
                    d_end = datetime.combine(current_dt.date(), datetime.max.time(), tzinfo=dt_timezone.utc)

                    date_tickets = Ticket.objects.filter(
                        status__in=['paid', 'used'],
                        created_at__gte=d_start,
                        created_at__lte=d_end
                    ).select_related('event', 'seat', 'ga_zone', 'used_coupon')
                    t_daily_sales = sum(get_ticket_actual_price(t) for t in date_tickets)
                        
                    date_orders = Order.objects.filter(
                        status__in=['paid', 'shipped', 'delivered'],
                        created_at__gte=d_start,
                        created_at__lte=d_end
                    )
                    s_daily_sales = float(date_orders.aggregate(Sum('total_amount'))['total_amount__sum'] or 0)
                    
                    d_users = User.objects.filter(date_joined__gte=d_start, date_joined__lte=d_end).count()
                    d_failed = Ticket.objects.filter(status='cancelled', created_at__gte=d_start, created_at__lte=d_end).count() + Order.objects.filter(status='cancelled', created_at__gte=d_start, created_at__lte=d_end).count()
                    d_successful = date_tickets.count() + date_orders.count()

                    daily_stats.append({
                        'date': date_str,
                        'tickets': round(t_daily_sales, 2),
                        'shop': round(s_daily_sales, 2),
                        'total': round(t_daily_sales + s_daily_sales, 2),
                        'new_users': d_users,
                        'successful_payments': d_successful,
                        'failed_payments': d_failed
                    })
                except Exception as ex:
                    logger.warning(f"[AnalyticsOverview] Error calculating daily stats iteration i={i}: {ex}")
                    continue

            # 7. Monthly Chart Data (Last 12 months aggregated)
            monthly_stats = []
            now = end_date
            for i in range(11, -1, -1):
                try:
                    yr = now.year
                    mo = now.month - i
                    while mo <= 0:
                        mo += 12
                        yr -= 1
                    
                    m_start = datetime(yr, mo, 1, 0, 0, 0, tzinfo=dt_timezone.utc)
                    if mo == 12:
                        m_end = datetime(yr + 1, 1, 1, 0, 0, 0, tzinfo=dt_timezone.utc) - timedelta(seconds=1)
                    else:
                        m_end = datetime(yr, mo + 1, 1, 0, 0, 0, tzinfo=dt_timezone.utc) - timedelta(seconds=1)

                    m_label = m_start.strftime('%b %Y')
                    
                    m_tickets = Ticket.objects.filter(
                        status__in=['paid', 'used'],
                        created_at__gte=m_start,
                        created_at__lte=m_end
                    ).select_related('event', 'seat', 'ga_zone', 'used_coupon')
                    t_m_sales = sum(get_ticket_actual_price(t) for t in m_tickets)

                    s_m_sales = Order.objects.filter(
                        status__in=['paid', 'shipped', 'delivered'],
                        created_at__gte=m_start,
                        created_at__lte=m_end
                    ).aggregate(Sum('total_amount'))['total_amount__sum'] or 0
                    s_m_sales = float(s_m_sales)

                    m_users = User.objects.filter(date_joined__gte=m_start, date_joined__lte=m_end).count()
                    m_failed = Ticket.objects.filter(status='cancelled', created_at__gte=m_start, created_at__lte=m_end).count() + Order.objects.filter(status='cancelled', created_at__gte=m_start, created_at__lte=m_end).count()
                    m_successful = m_tickets.count() + Order.objects.filter(status__in=['paid', 'shipped', 'delivered'], created_at__gte=m_start, created_at__lte=m_end).count()

                    monthly_stats.append({
                        'date': m_label,
                        'month_key': m_start.strftime('%Y-%m'),
                        'tickets': round(t_m_sales, 2),
                        'shop': round(s_m_sales, 2),
                        'total': round(t_m_sales + s_m_sales, 2),
                        'new_users': m_users,
                        'successful_payments': m_successful,
                        'failed_payments': m_failed
                    })
                except Exception as ex:
                    logger.warning(f"[AnalyticsOverview] Error calculating monthly stats iteration i={i}: {ex}")
                    continue

            # 8. Weekly Chart Data (Last 12 weeks)
            weekly_stats = []
            for i in range(11, -1, -1):
                try:
                    w_start = end_date - timedelta(weeks=i+1)
                    w_end = end_date - timedelta(weeks=i)
                    w_label = f"Sem {12-i}"

                    w_tickets = Ticket.objects.filter(
                        status__in=['paid', 'used'],
                        created_at__gte=w_start,
                        created_at__lte=w_end
                    ).select_related('event', 'seat', 'ga_zone', 'used_coupon')
                    t_w_sales = sum(get_ticket_actual_price(t) for t in w_tickets)

                    s_w_sales = Order.objects.filter(
                        status__in=['paid', 'shipped', 'delivered'],
                        created_at__gte=w_start,
                        created_at__lte=w_end
                    ).aggregate(Sum('total_amount'))['total_amount__sum'] or 0
                    s_w_sales = float(s_w_sales)

                    weekly_stats.append({
                        'date': w_label,
                        'range': f"{w_start.strftime('%d %b')} - {w_end.strftime('%d %b')}",
                        'tickets': round(t_w_sales, 2),
                        'shop': round(s_w_sales, 2),
                        'total': round(t_w_sales + s_w_sales, 2)
                    })
                except Exception as ex:
                    logger.warning(f"[AnalyticsOverview] Error calculating weekly stats iteration i={i}: {ex}")
                    continue

            # 9. Event-level sales breakdown
            event_stats = []
            try:
                for ev in Event.objects.all().order_by('-date'):
                    ev_tickets = Ticket.objects.filter(event=ev, status__in=['paid', 'used']).select_related('event', 'seat', 'ga_zone', 'used_coupon')
                    ev_t_sold = ev_tickets.count()
                    ev_t_revenue = sum(get_ticket_actual_price(t) for t in ev_tickets)
                    ev_mg_count = sum(1 for t in ev_tickets if getattr(t, 'has_mg', False))
                    ev_mg_revenue = ev_mg_count * float(getattr(ev, 'mg_price', 0.0) or 0.0)

                    event_stats.append({
                        'id': ev.id,
                        'date': ev.date.strftime('%d %b %Y') if getattr(ev, 'date', None) else '',
                        'event_title': ev.title,
                        'artist': ev.artist,
                        'tickets_sold': ev_t_sold,
                        'ticket_revenue': round(ev_t_revenue, 2),
                        'mg_upgrades': ev_mg_count,
                        'mg_revenue': round(ev_mg_revenue, 2),
                        'total': round(ev_t_revenue, 2)
                    })
            except Exception as ex:
                logger.warning(f"[AnalyticsOverview] Error calculating event stats: {ex}")
                event_stats = []

            # 10. Revenue distribution breakdown for Pie/Donut Chart
            total_rev_pool = max(1.0, gross_sales)
            revenue_breakdown = [
                {'category': 'Boletos General/Numerado', 'amount': round(max(0.0, ticket_sales - mg_revenue), 2), 'percentage': round((max(0.0, ticket_sales - mg_revenue) / total_rev_pool) * 100, 1)},
                {'category': 'Upgrades Meet & Greet', 'amount': round(mg_revenue, 2), 'percentage': round((mg_revenue / total_rev_pool) * 100, 1)},
                {'category': 'Mercancía Tienda', 'amount': round(shop_sales, 2), 'percentage': round((shop_sales / total_rev_pool) * 100, 1)},
                {'category': 'Gastos Operativos', 'amount': round(total_expenses, 2), 'percentage': round((total_expenses / total_rev_pool) * 100, 1)}
            ]

            # 11. Métricas de Usuarios y Embudo de Transacciones
            new_users_count = User.objects.filter(date_joined__gte=start_date, date_joined__lte=end_date).count()
            total_users_count = User.objects.count()
            failed_tickets_count = Ticket.objects.filter(status='cancelled', created_at__gte=start_date, created_at__lte=end_date).count()
            failed_orders_count = Order.objects.filter(status='cancelled', created_at__gte=start_date, created_at__lte=end_date).count()
            total_failed_count = failed_tickets_count + failed_orders_count
            total_successful_count = total_tickets_sold + total_orders_count

            # 12. Métricas de Pauta Publicitaria (Google Ads & Meta Ads)
            ads_performance = AdsIntegrationService.get_ads_performance(period=period_param)

            metrics = {
                'financials': {
                    'gross_sales': round(gross_sales, 2),
                    'ticket_sales': round(ticket_sales, 2),
                    'shop_sales': round(shop_sales, 2),
                    'mg_revenue': round(mg_revenue, 2),
                    'total_expenses': round(total_expenses, 2),
                    'net_profit': round(net_profit, 2),
                },
                'users': {
                    'new_users': new_users_count,
                    'total_users': total_users_count,
                },
                'funnel': {
                    'successful_count': total_successful_count,
                    'successful_amount': round(gross_sales, 2),
                    'failed_count': total_failed_count,
                },
                'ads': ads_performance,
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
                    'daily_sales': daily_stats,
                    'weekly_sales': weekly_stats,
                    'monthly_sales': monthly_stats,
                    'event_sales': event_stats,
                    'revenue_breakdown': revenue_breakdown
                },
                'is_historical_fallback': is_historical_fallback,
                'status': 'success'
            }
            return Response(metrics)
        except Exception as e:
            logger.error(f"[AnalyticsOverview] Unhandled Error in analytics: {e}", exc_info=True)
            return Response({'error': str(e), 'status': 'error'}, status=500)


class AnalyticsUnitDataView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        if not request.user.is_superuser:
            return Response({'error': 'Acceso denegado.'}, status=403)

        data_type = request.query_params.get('type', 'tickets')
        search_query = request.query_params.get('search', '').strip().lower()

        try:
            if data_type == 'tickets':
                qs = Ticket.objects.filter(status__in=['paid', 'used']).select_related('event', 'seat', 'ga_zone', 'used_coupon').order_by('-created_at')
                results = []
                for t in qs:
                    user_email = t.user_email or 'Invitado'
                    event_title = t.event.title if getattr(t, 'event', None) else 'Evento'
                    seat_str = f"Fila {t.seat.row} - #{t.seat.number}" if getattr(t, 'seat', None) else (t.ga_zone.name if getattr(t, 'ga_zone', None) else "General")
                    
                    price = get_ticket_actual_price(t)

                    row = {
                        'id': t.id,
                        'buyer': user_email,
                        'event': event_title,
                        'seat': seat_str,
                        'has_mg': getattr(t, 'has_mg', False),
                        'coupon': t.used_coupon.code if getattr(t, 'used_coupon', None) else 'Ninguno',
                        'status': t.status,
                        'amount': round(price, 2),
                        'created_at': t.created_at.isoformat() if getattr(t, 'created_at', None) else ''
                    }

                    if search_query:
                        if (search_query in user_email.lower() or 
                            search_query in event_title.lower() or 
                            search_query in seat_str.lower() or 
                            search_query in str(t.id)):
                            results.append(row)
                    else:
                        results.append(row)
                return Response({'type': 'tickets', 'count': len(results), 'data': results[:200]})

            elif data_type == 'orders':
                qs = Order.objects.filter(status__in=['paid', 'shipped', 'delivered']).prefetch_related('items__product').order_by('-created_at')
                results = []
                for o in qs:
                    items_str = ", ".join([f"{item.quantity}x {item.product.name if item.product else 'Prod'}" for item in o.items.all()])
                    row = {
                        'id': o.id,
                        'buyer': f"{o.full_name} ({o.user_email})",
                        'items_summary': items_str or 'Sin items',
                        'city': f"{o.city}, {o.country}",
                        'status': o.status,
                        'amount': float(o.total_amount),
                        'created_at': o.created_at.isoformat()
                    }
                    if search_query:
                        if (search_query in o.full_name.lower() or 
                            search_query in o.user_email.lower() or 
                            search_query in items_str.lower() or 
                            search_query in str(o.id)):
                            results.append(row)
                    else:
                        results.append(row)
                return Response({'type': 'orders', 'count': len(results), 'data': results[:200]})

            elif data_type == 'expenses':
                qs = Expense.objects.all().order_by('-created_at')
                results = []
                for e in qs:
                    row = {
                        'id': e.id,
                        'title': e.title,
                        'category': e.category,
                        'description': e.description,
                        'amount': float(e.amount),
                        'created_at': e.created_at.isoformat()
                    }
                    if search_query:
                        if (search_query in e.title.lower() or 
                            search_query in e.category.lower() or 
                            search_query in (e.description or '').lower()):
                            results.append(row)
                    else:
                        results.append(row)
                return Response({'type': 'expenses', 'count': len(results), 'data': results[:200]})

            elif data_type == 'mg_upgrades':
                qs = Ticket.objects.filter(has_mg=True, status__in=['paid', 'used']).select_related('event').order_by('-created_at')
                results = []
                for t in qs:
                    user_email = t.user_email or 'Invitado'
                    event_title = t.event.title if getattr(t, 'event', None) else 'Evento'
                    mg_price = float(getattr(t.event, 'mg_price', 0.0) or 0.0) if getattr(t, 'event', None) else 0.0
                    row = {
                        'id': t.id,
                        'buyer': user_email,
                        'event': event_title,
                        'mg_price': mg_price,
                        'status': t.status,
                        'created_at': t.created_at.isoformat() if getattr(t, 'created_at', None) else ''
                    }
                    if search_query:
                        if (search_query in user_email.lower() or search_query in event_title.lower()):
                            results.append(row)
                    else:
                        results.append(row)
                return Response({'type': 'mg_upgrades', 'count': len(results), 'data': results[:200]})

            else:
                return Response({'error': 'Tipo de dato no válido.'}, status=400)

        except Exception as ex:
            logger.error(f"[AnalyticsUnitDataView] Error fetching unit data: {ex}", exc_info=True)
            return Response({'error': str(ex)}, status=500)


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
        except Exception as e:
            logger.warning(f"[SystemMetricsView] DB connection check failed: {e}")
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
                logger.warning(f"[SystemMetricsView] Metric collection failed, serving fallback: {e}", exc_info=True)
                return Response(self._get_fallback_metrics(db_status, str(e)))
        else:
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
                    prod = getattr(item, 'product', None)
                    items_data.append({
                        'product_id': prod.id if prod else None,
                        'product_name': prod.name if prod else "Producto descontinuado",
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
            logger.error(f"[DashboardOrdersView] Error listing orders: {e}", exc_info=True)
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
            logger.error(f"[DashboardOrdersView] Error updating order status: {e}", exc_info=True)
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
            logger.error(f"[DashboardExpensesView] Error listing expenses: {e}", exc_info=True)
            return Response({'error': str(e)}, status=500)

    def post(self, request):
        if not request.user.is_superuser:
            return Response({"error": "No tienes permisos para registrar gastos."}, status=403)
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
            logger.error(f"[DashboardExpensesView] Error creating expense: {e}", exc_info=True)
            return Response({'error': str(e)}, status=500)


class AdsPerformanceView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        period = str(request.query_params.get('period', '30d')).lower()
        force_refresh = request.query_params.get('refresh') == 'true'
        try:
            ads_data = AdsIntegrationService.get_ads_performance(period=period, force_refresh=force_refresh)
            return Response(ads_data)
        except Exception as e:
            logger.error(f"[AdsPerformanceView] Error al consultar métricas de anuncios: {e}", exc_info=True)
            return Response({'error': str(e)}, status=500)
