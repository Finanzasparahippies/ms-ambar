from django.urls import path
from .views import AnalyticsOverview, AnalyticsUnitDataView, SystemMetricsView, DashboardOrdersView, DashboardExpensesView

urlpatterns = [
    path('analytics/', AnalyticsOverview.as_view(), name='analytics_overview'),
    path('analytics/unit-data/', AnalyticsUnitDataView.as_view(), name='analytics_unit_data'),
    path('system/', SystemMetricsView.as_view(), name='system_metrics'),
    path('orders/', DashboardOrdersView.as_view(), name='dashboard_orders'),
    path('orders/<int:pk>/', DashboardOrdersView.as_view(), name='dashboard_order_detail'),
    path('expenses/', DashboardExpensesView.as_view(), name='dashboard_expenses'),
]
