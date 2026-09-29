import React, { useState, useCallback, useMemo } from 'react';

export interface SubWalletBudget {
  service_type: string;
  allocated_balance: string;
  used_balance: string;
}

export interface TenantHealthReport {
  tenant_id: string;
  subdomain: string;
  status: 'HEALTHY' | 'DEGRADED' | 'STANDBY';
  rtt_ms: number;
  connection_type: 'DOCKER_INTERNAL' | 'WAN_REMOTE';
  hmac_valid: boolean;
  time_drift_seconds: number;
  database_alive: boolean;
  redis_alive: boolean;
  budgets: SubWalletBudget[];
  raw_log: string[];
}

interface TenantHealthDashboardProps {
  tenantId: string;
  tenantName: string;
  initialReport?: TenantHealthReport | null;
  onRefresh?: (tenantId: string) => Promise<TenantHealthReport>;
}

export const TenantHealthDashboard: React.FC<TenantHealthDashboardProps> = ({
  tenantId,
  tenantName,
  initialReport = null,
  onRefresh,
}) => {
  const [report, setReport] = useState<TenantHealthReport | null>(initialReport);
  const [loading, setLoading] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRunDiagnostics = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      if (onRefresh) {
        const fresh = await onRefresh(tenantId);
        setReport(fresh);
      } else {
        const res = await fetch(`/api/v1/tenants/${tenantId}/diagnose/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Fallo al ejecutar diagnóstico`);
        }
        const data: TenantHealthReport = await res.json();
        setReport(data);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido al sondear tenant';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }, [loading, onRefresh, tenantId]);

  const badgeStyle = useMemo(() => {
    switch (report?.status) {
      case 'HEALTHY':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'DEGRADED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'STANDBY':
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
    }
  }, [report?.status]);

  return (
    <div className="w-full rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-6 backdrop-blur-xl shadow-2xl text-zinc-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/60 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-white">{tenantName}</h2>
            <span className="font-mono text-xs text-zinc-400">({report?.subdomain ?? 'cargando...'})</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">UUID: {tenantId}</p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${badgeStyle}`}>
            {report?.status ?? 'STANDBY'}
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={handleRunDiagnostics}
            className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            ) : (
              '⚡ Sondeo en Vivo'
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Grid de Métricas Perimetrales */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Latencia RTT */}
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4">
          <span className="text-xs text-zinc-400">Latencia RTT</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-white">
              {report?.rtt_ms !== undefined ? `${report.rtt_ms.toFixed(1)} ms` : '--'}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {report?.connection_type === 'DOCKER_INTERNAL' ? 'Docker Bridge' : 'WAN'}
            </span>
          </div>
        </div>

        {/* Handshake HMAC */}
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4">
          <span className="text-xs text-zinc-400">Handshake Criptográfico</span>
          <div className="mt-2 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${report?.hmac_valid ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className="text-sm font-semibold">
              {report?.hmac_valid ? 'Firma Válida' : 'Firma Inválida'}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 block mt-1">
            Drift: {report?.time_drift_seconds !== undefined ? `${report.time_drift_seconds.toFixed(2)}s` : '--'}
          </span>
        </div>

        {/* PostgreSQL Inquilino */}
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4">
          <span className="text-xs text-zinc-400">Base de Datos</span>
          <div className="mt-2 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${report?.database_alive ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className="text-sm font-semibold">
              {report?.database_alive ? 'Conexión OK' : 'Sin Respuesta'}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 block mt-1">SELECT 1 Safe Probe</span>
        </div>

        {/* Caché Redis */}
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4">
          <span className="text-xs text-zinc-400">Caché Perimetral</span>
          <div className="mt-2 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${report?.redis_alive ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className="text-sm font-semibold">
              {report?.redis_alive ? 'Redis En Línea' : 'Caído / Degradado'}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 block mt-1">LRU Map & Nonces</span>
        </div>
      </div>

      {/* Sub-Wallets Allocations */}
      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
          Sub-Presupuestos Etiquetados (Sub-Wallets)
        </h3>
        {report?.budgets && report.budgets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {report.budgets.map((b) => {
              const allocated = parseFloat(b.allocated_balance) || 0;
              const used = parseFloat(b.used_balance) || 0;
              const pct = allocated > 0 ? Math.min(100, (used / allocated) * 100) : 0;
              return (
                <div key={b.service_type} className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-zinc-200">{b.service_type}</span>
                    <span className="text-zinc-400 font-mono">${allocated.toFixed(2)} MXN</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${pct > 85 ? 'bg-rose-500' : 'bg-amber-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] text-zinc-500 font-mono">
                    <span>Consumido: ${used.toFixed(2)}</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/20 p-4 text-center text-xs text-zinc-500">
            Sin bolsas de presupuesto asignadas actualmente.
          </div>
        )}
      </div>

      {/* Botón Consola Forense */}
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-4 transition"
        >
          Inspeccionar Registro de Handshake y RPC (Drawer)
        </button>
      </div>

      {/* Drawer de Telemetría */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-zinc-950 border-l border-zinc-800 p-6 flex flex-col h-full shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Consola de Telemetría RPC</h3>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                ✕ Cerrar
              </button>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto font-mono text-[11px] bg-zinc-900/80 rounded-xl p-4 border border-zinc-800 text-zinc-300 space-y-1">
              {report?.raw_log && report.raw_log.length > 0 ? (
                report.raw_log.map((logLine, idx) => (
                  <div key={idx} className="leading-relaxed whitespace-pre-wrap">
                    {logLine}
                  </div>
                ))
              ) : (
                <div className="text-zinc-500">Sin logs de sondeo registrados.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
