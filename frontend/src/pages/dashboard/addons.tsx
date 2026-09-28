import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  Layers, ShieldCheck, CheckCircle2, Clock, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, Wallet, RefreshCw, Power,
  Coins, ArrowLeft, X, Sparkles, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../lib/api';
import { showToast, showAlert, showConfirm } from '../../lib/notifications';

interface ServiceBudget {
  allocated_balance: string;
  used_balance: string;
}

interface AddonItem {
  id: string;
  name: string;
  addon_type: 'FACTURAPI_CFDI' | 'LOGISTICS_NATIONAL' | 'NECTAR_DRIVER' | 'AWS_SES_CAMPAIGNS' | 'STRIPE_CONNECT_PAYOUTS';
  description: string;
  status: 'INACTIVE' | 'PROVISIONING_48H' | 'ACTIVE' | 'SUSPENDED_LOW_BALANCE' | 'ERROR';
  badge_label: string;
  icon_path: string;
  budget: ServiceBudget;
}

interface WalletOverview {
  unallocated_balance: string;
  total_allocated: string;
  total_balance: string;
}

interface ApiResponse {
  addons: AddonItem[];
  wallet: WalletOverview;
  hub_connected: boolean;
}

export default function DashboardAddonsPage() {
  const [addons, setAddons] = useState<AddonItem[]>([]);
  const [wallet, setWallet] = useState<WalletOverview>({
    unallocated_balance: '0.00',
    total_allocated: '0.00',
    total_balance: '0.00'
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [modalAddon, setModalAddon] = useState<AddonItem | null>(null);
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferType, setTransferType] = useState<'INJECT' | 'WITHDRAW'>('INJECT');
  const [hubConnected, setHubConnected] = useState<boolean>(true);

  const fetchAddonsData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const response = await api.get<ApiResponse>('/dashboard/addons/');
      if (response?.data) {
        setAddons(response.data.addons || []);
        setWallet(response.data.wallet || {
          unallocated_balance: '0.00',
          total_allocated: '0.00',
          total_balance: '0.00'
        });
        setHubConnected(Boolean(response.data.hub_connected));
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error al conectar con el Hub de Néctar Labs';
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAddonsData();
  }, [fetchAddonsData]);

  const handleToggleAddon = async (addon: AddonItem) => {
    const isActivating = addon.status !== 'ACTIVE';
    const confirmPrompt = isActivating
      ? `¿Deseas activar el addon "${addon.name}"? Los servicios regulados requieren verificación técnica de hasta 48 hrs.`
      : `¿Estás seguro de pausar el addon "${addon.name}"? Los servicios asociados detendrán temporalmente sus consultas.`;

    const confirmed = await showConfirm(confirmPrompt, isActivating ? 'Activar Addon' : 'Pausar Addon');
    if (!confirmed) return;

    setActionInProgress(addon.id);
    try {
      const res = await api.post(`/dashboard/addons/${addon.addon_type}/toggle/`);
      const msg = res.data?.message || 'Estado del addon actualizado correctamente.';
      showToast(msg, 'success');
      await fetchAddonsData(true);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Fallo en la comunicación con Néctar Labs.';
      showToast(errorMsg, 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleBudgetTransfer = async () => {
    if (!modalAddon) return;
    const numericAmount = parseFloat(transferAmount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      showToast('Ingresa un monto válido estrictamente superior a $0.00 MXN.', 'error');
      return;
    }

    const unallocated = parseFloat(wallet.unallocated_balance || '0.00');
    const allocated = parseFloat(modalAddon.budget?.allocated_balance || '0.00');

    if (transferType === 'INJECT' && numericAmount > unallocated) {
      showToast(`Saldo Libre insuficiente ($${unallocated.toFixed(2)} MXN disponibles).`, 'error');
      return;
    }

    if (transferType === 'WITHDRAW' && numericAmount > allocated) {
      showToast(`Saldo insuficiente en la bolsa de ${modalAddon.name} ($${allocated.toFixed(2)} MXN asignados).`, 'error');
      return;
    }

    setActionInProgress(modalAddon.id);
    try {
      const payload = {
        addon_type: modalAddon.addon_type,
        amount: numericAmount.toFixed(2),
        direction: transferType
      };
      const res = await api.post('/dashboard/addons/reallocate/', payload);
      showToast(res.data?.message || 'Presupuesto reasignado de manera atómica.', 'success');
      setModalAddon(null);
      setTransferAmount('');
      await fetchAddonsData(true);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Fallo de reasignación presupuestaria.';
      showToast(errorMsg, 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDefensiveActionCheck = (addon: AddonItem, actionName: string) => {
    const allocated = parseFloat(addon.budget?.allocated_balance || '0.00');
    if (allocated <= 0) {
      showAlert(
        `Saldo agotado para "${addon.name}". Recarga tu bolsa asignando fondos desde tu Néctar Wallet principal para ejecutar esta acción.`,
        'Saldo Insuficiente en Bolsa',
        'warning'
      );
      return false;
    }
    showToast(`Iniciando ${actionName}...`, 'info');
    return true;
  };

  const activeAddonsCount = useMemo(() => {
    return addons.filter(a => a.status === 'ACTIVE').length;
  }, [addons]);

  return (
    <>
      <Head>
        <title>Suite de Addons & Servicios Satélite | Néctar Hub</title>
      </Head>

      <div className="min-h-screen bg-[#07090E] text-slate-100 font-sans selection:bg-purple-600 selection:text-white pb-20">
        {/* Background ambient lighting */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px]" />
          <div className="absolute top-1/2 right-10 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          {/* Top Bar Navigation */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al Dashboard</span>
            </Link>

            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                hubConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                <span className={`w-2 h-2 rounded-full ${hubConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                {hubConnected ? 'Néctar Zero-Trust RPC Conectado' : 'Sin Conexión con Hub'}
              </span>

              <button
                type="button"
                onClick={() => fetchAddonsData(true)}
                disabled={refreshing}
                className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-slate-300 hover:text-white transition-all disabled:opacity-50"
                title="Sincronizar"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Néctar Labs Marketplace</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                Suite de Addons & Servicios
              </h1>
              <p className="text-slate-400 text-sm mt-2 max-w-2xl leading-relaxed">
                Administración de microservicios, timbrado fiscal SAT, dispersión de fondos,
                y control atómico de presupuestos con doble partida contable.
              </p>
            </div>

            {/* Wallet Balance Widget */}
            <div className="flex flex-wrap items-center gap-4 p-5 rounded-2xl bg-[#0F1420]/80 border border-white/10 backdrop-blur-xl shadow-2xl">
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Saldo Libre Néctar Wallet</p>
                <p className="text-2xl font-black text-emerald-400">
                  ${wallet?.unallocated_balance ?? '0.00'} <span className="text-xs text-slate-400 font-medium">MXN</span>
                </p>
              </div>
              <div className="h-10 w-px bg-white/10 hidden sm:block" />
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">En Bolsas de Servicio</p>
                <p className="text-lg font-bold text-slate-200">
                  ${wallet?.total_allocated ?? '0.00'} <span className="text-xs text-slate-500 font-medium">MXN</span>
                </p>
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Addons Activos</span>
              <span className="text-base font-bold text-purple-400">{activeAddonsCount} / {addons.length}</span>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">SLA de Aprovisionamiento</span>
              <span className="text-base font-bold text-amber-400">Hasta 48h hábiles</span>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Garantía Contable</span>
              <span className="text-base font-bold text-emerald-400">Atomic 2PC Ledger</span>
            </div>
          </div>

          {/* Catalog Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-80 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
              ))}
            </div>
          ) : addons.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {addons.map((addon) => {
                const allocated = parseFloat(addon.budget?.allocated_balance || '0.00');
                const used = parseFloat(addon.budget?.used_balance || '0.00');
                const total = allocated + used;
                const percentage = total > 0 ? Math.min(100, Math.round((allocated / total) * 100)) : 0;
                const isZeroBudget = allocated <= 0;

                return (
                  <motion.div
                    key={addon.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative flex flex-col justify-between rounded-2xl bg-[#0D121D]/70 border border-white/10 hover:border-purple-500/30 backdrop-blur-xl p-6 transition-all duration-300 shadow-xl group"
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-purple-400 group-hover:scale-105 transition-transform">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={addon.icon_path} />
                          </svg>
                        </div>

                        <div>
                          {addon.status === 'ACTIVE' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              ACTIVO
                            </span>
                          )}
                          {addon.status === 'PROVISIONING_48H' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              <Clock className="w-3.5 h-3.5 animate-spin" />
                              CONFIGURACIÓN 48H
                            </span>
                          )}
                          {addon.status === 'INACTIVE' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-white/5">
                              INACTIVO
                            </span>
                          )}
                          {addon.status === 'SUSPENDED_LOW_BALANCE' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <AlertCircle className="w-3.5 h-3.5" />
                              FONDOS AGOTADOS
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                        {addon.name}
                      </h3>
                      <p className="text-slate-400 text-xs mt-2 leading-relaxed min-h-[3.25rem]">
                        {addon.description}
                      </p>
                    </div>

                    {/* Operational & Budget Section */}
                    <div className="mt-6 pt-5 border-t border-white/5 space-y-4">
                      {addon.status === 'PROVISIONING_48H' && (
                        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                          <div className="flex justify-between text-xs text-amber-300 font-semibold">
                            <span>Sincronizando con Proveedor</span>
                            <span>SLA 48h</span>
                          </div>
                          <div className="w-full bg-amber-950/40 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-amber-400 h-1.5 rounded-full w-3/4 animate-pulse" />
                          </div>
                          <p className="text-[11px] text-amber-200/70">
                            Néctar Labs está configurando sellos SAT o credenciales delegadas para este portal.
                          </p>
                        </div>
                      )}

                      {addon.status === 'ACTIVE' && (
                        <div>
                          <div className="flex justify-between items-center text-xs mb-1.5">
                            <span className="text-slate-400 font-medium">Presupuesto Asignado</span>
                            <span className="font-bold text-white">${addon.budget?.allocated_balance ?? '0.00'} MXN</span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                isZeroBudget ? 'bg-rose-500' : percentage < 25 ? 'bg-amber-400' : 'bg-purple-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>

                          <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
                            <span>Consumido: ${addon.budget?.used_balance ?? '0.00'} MXN</span>
                            {isZeroBudget ? (
                              <span className="text-rose-400 font-semibold">Bolsa agotada</span>
                            ) : (
                              <span className="text-emerald-400 font-semibold">Saldo disponible</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleToggleAddon(addon)}
                          disabled={actionInProgress === addon.id}
                          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                            addon.status === 'ACTIVE'
                              ? 'bg-white/5 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 border border-white/10'
                              : 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-600/25'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          {actionInProgress === addon.id
                            ? 'Procesando...'
                            : addon.status === 'ACTIVE'
                            ? 'Pausar Addon'
                            : 'Activar Addon'}
                        </button>

                        {addon.status === 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() => setModalAddon(addon)}
                            className="py-2.5 px-3 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-all flex items-center gap-1.5"
                            title="Distribuir Saldo"
                          >
                            <Coins className="w-3.5 h-3.5 text-amber-400" />
                            <span>Bolsa</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-24 rounded-2xl bg-white/[0.02] border border-white/5 text-slate-400">
              <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-base font-bold text-white">Catálogo No Disponible</p>
              <p className="text-xs text-slate-500 mt-1">Verifica las credenciales HMAC y conectividad con Néctar Labs.</p>
            </div>
          )}
        </div>

        {/* Modal Reasignación de Fondos */}
        <AnimatePresence>
          {modalAddon && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-[#0F1420] border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6"
              >
                <div className="flex justify-between items-center pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Gestión de Presupuesto</h3>
                      <p className="text-xs text-slate-400">{modalAddon.name}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalAddon(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Balances Card */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-xs">
                  <div>
                    <p className="text-slate-400 font-medium">Asignado en Bolsa</p>
                    <p className="text-base font-bold text-white mt-0.5">${modalAddon.budget?.allocated_balance ?? '0.00'} MXN</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Libre Néctar Wallet</p>
                    <p className="text-base font-bold text-emerald-400 mt-0.5">${wallet?.unallocated_balance ?? '0.00'} MXN</p>
                  </div>
                </div>

                {/* Direction Switcher */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => setTransferType('INJECT')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      transferType === 'INJECT' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    Asignar a Bolsa
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferType('WITHDRAW')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      transferType === 'WITHDRAW' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    Retirar a Libre
                  </button>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Monto a Transferir (MXN)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1.00"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="250.00"
                      className="w-full pl-8 pr-4 py-3 bg-[#07090E] border border-white/10 rounded-xl text-white placeholder-slate-600 text-sm font-semibold focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Confirm & Cancel Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalAddon(null)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-slate-300 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleBudgetTransfer}
                    disabled={actionInProgress === modalAddon.id}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold text-white shadow-lg shadow-purple-600/25 transition-all disabled:opacity-50"
                  >
                    {actionInProgress === modalAddon.id ? 'Confirmando...' : 'Reasignar Saldo'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
