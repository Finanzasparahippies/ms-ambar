from django.urls import path
from .views import (
    AnalyticsOverview,
    AnalyticsUnitDataView,
    AnalyticsExportCSVView,
    SystemMetricsView,
    DashboardOrdersView,
    DashboardExpensesView,
    AdsPerformanceView,
    DashboardAddonsView,
    DashboardAddonToggleView,
    DashboardAddonReallocateView
)

urlpatterns = [
    path('analytics/', AnalyticsOverview.as_view(), name='analytics_overview'),
    path('analytics/unit-data/', AnalyticsUnitDataView.as_view(), name='analytics_unit_data'),
    path('analytics/export-csv/', AnalyticsExportCSVView.as_view(), name='analytics_export_csv'),
    path('ads/', AdsPerformanceView.as_view(), name='dashboard_ads_performance'),
    path('system/', SystemMetricsView.as_view(), name='system_metrics'),
    path('orders/', DashboardOrdersView.as_view(), name='dashboard_orders'),
    path('orders/<int:pk>/', DashboardOrdersView.as_view(), name='dashboard_order_detail'),
    path('expenses/', DashboardExpensesView.as_view(), name='dashboard_expenses'),
    path('addons/', DashboardAddonsView.as_view(), name='dashboard_addons'),
    path('addons/<str:addon_type>/toggle/', DashboardAddonToggleView.as_view(), name='dashboard_addon_toggle'),
    path('addons/reallocate/', DashboardAddonReallocateView.as_view(), name='dashboard_addon_reallocate'),
]

