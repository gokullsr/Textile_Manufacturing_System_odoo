
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardSummary } from '../services/dashboardService';
import StatusBadge from '../components/StatusBadge';
import ProgressBar from '../components/ProgressBar';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { formatNumber, formatDate, formatRelativeDays } from '../utils/formatters';
import {
  ClipboardCheck,
  AlertOctagon,
  Cpu,
  Boxes,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDashboardSummary();
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) return <LoadingState message="Loading Command Center telemetry..." />;
  if (error && !data) return <ErrorState title="Failed to load dashboard metrics" error={error} onRetry={fetchData} />;

  const { kpis, attentionOrders, stockWarnings, ordersByStatus, machineSummary } = data || {
    kpis: { activeOrders: 0, completedOrders: 0, delayedOrders: 0, atRiskOrders: 0, machines: { available: 0, running: 0, maintenance: 0, total: 0 }, stock: { outOfStock: 0, lowStock: 0 } },
    attentionOrders: [],
    stockWarnings: [],
    ordersByStatus: [],
    machineSummary: [],
  };

  const chartColors = {
    in_progress: '#0d9488',
    completed: '#10b981',
    queued: '#6366f1',
    on_hold: '#f59e0b',
    draft: '#64748b',
    planned: '#0284c7',
    cancelled: '#e11d48',
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-teal-600">
            Factory Command Center
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mt-1">
            Plant Operations Telemetry
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Live manufacturing orders, active looms, spindle workcenters, and raw fiber stock levels.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-semibold shadow-sm shadow-teal-600/20 transition-all disabled:opacity-50 self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh Telemetry'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-600 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Work Orders</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 font-mono">{formatNumber(kpis.activeOrders)}</div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-600">
            <span className="text-emerald-700 font-semibold">{kpis.onTrackOrders || 0} on track</span>
            <span>•</span>
            <span className="text-slate-500">{kpis.totalOrders} total in system</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-600 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Delivery Risk Orders</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-rose-600 font-mono">
            {formatNumber((kpis.delayedOrders || 0) + (kpis.atRiskOrders || 0))}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="text-rose-700 font-semibold">{kpis.delayedOrders || 0} Overdue</span>
            <span className="text-slate-400">•</span>
            <span className="text-amber-700 font-semibold">{kpis.atRiskOrders || 0} At Risk</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-600 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Machine Utilization</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 font-mono">
            {kpis.machines.running} <span className="text-sm font-normal text-slate-500">/ {kpis.machines.total} busy</span>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-600">
            <span className="text-emerald-700 font-semibold">{kpis.machines.available} available</span>
            <span>•</span>
            <span className="text-amber-700 font-semibold">{kpis.machines.maintenance} maint</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-600 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stock Critical Warnings</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-amber-600 font-mono">
            {formatNumber((kpis.stock.outOfStock || 0) + (kpis.stock.lowStock || 0))}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="text-rose-700 font-semibold">{kpis.stock.outOfStock || 0} Out of Stock</span>
            <span className="text-slate-400">•</span>
            <span className="text-amber-700 font-semibold">{kpis.stock.lowStock || 0} Low Stock</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <div>
                <h2 className="font-bold text-slate-900 text-base">Orders Needing Attention</h2>
                <p className="text-xs text-slate-500">Prioritized by overdue days and schedule progress lag</p>
              </div>
            </div>
            <Link
              to="/orders"
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700"
            >
              <span>View all orders</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          {attentionOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
              <p className="text-sm font-semibold text-slate-800">All orders are running on track!</p>
              <p className="text-xs text-slate-500 mt-0.5">No overdue deadlines or severe schedule lag detected.</p>
            </div>
          ) : (
            <div className="space-y-4 flex-1">
              {attentionOrders.map((order) => (
                <Link
                  key={order.orderNumber}
                  to={`/orders/${order.orderNumber}`}
                  className="block bg-slate-50/70 hover:bg-slate-100/90 border border-slate-200 rounded-xl p-4 transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">{order.orderNumber}</span>
                      <span className="text-xs text-slate-600 font-medium">• {order.customer}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge type="delay" value={order.delayStatus} />
                      <StatusBadge type="order" value={order.status} />
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 font-medium mb-3">{order.fabricType}</p>
                  {order.reason && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 mb-3 flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-600" />
                      <span>{order.reason}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block">Produced / Target</span>
                      <span className="font-mono text-slate-900 font-bold">
                        {formatNumber(order.producedQuantity)} / {formatNumber(order.requiredQuantity)} {order.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Due Date</span>
                      <span className="text-slate-800 font-medium">
                        {formatDate(order.dueDate)} ({formatRelativeDays(order.daysRemaining)})
                      </span>
                    </div>
                    <div className="flex flex-col justify-center">
                      <ProgressBar percent={order.progressPercent} size="sm" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="mb-4 pb-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 text-base">Work Orders by Status</h2>
            <p className="text-xs text-slate-500">Live order state distribution in factory</p>
          </div>
          <div className="h-64 w-full flex-1">
            {ordersByStatus.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No orders data to graph
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ordersByStatus} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis
                    dataKey="status"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '0.75rem',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: '#0f766e', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {ordersByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[entry.status] || '#0284c7'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-teal-600" />
              <h2 className="font-bold text-slate-900 text-base">Machine Workcenters</h2>
            </div>
            <Link to="/machines" className="text-xs font-semibold text-teal-600 hover:text-teal-700">
              View all machines &rarr;
            </Link>
          </div>
          <div className="space-y-3">
            {machineSummary.slice(0, 5).map((m) => (
              <div
                key={m._id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{m.code}</span>
                    <span className="text-slate-600 font-medium truncate max-w-[150px]">{m.name}</span>
                  </div>
                  {m.currentOrderNumber ? (
                    <span className="text-[11px] text-teal-700 font-mono font-medium mt-0.5 block">
                      Order: {m.currentOrderNumber} ({m.buyer})
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 mt-0.5 block">No active work order</span>
                  )}
                </div>
                <StatusBadge type="machine" value={m.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-slate-900 text-base">Critical Stock Shortfalls</h2>
            </div>
            <Link to="/stock" className="text-xs font-semibold text-teal-600 hover:text-teal-700">
              Manage inventory &rarr;
            </Link>
          </div>
          {stockWarnings.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No inventory shortfalls. All materials above reorder thresholds.
            </div>
          ) : (
            <div className="space-y-3">
              {stockWarnings.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{item.sku}</span>
                      <span className="text-slate-700 font-semibold truncate max-w-[180px]">{item.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-3">
                      <span>
                        Stock: <strong className="text-slate-900 font-mono font-semibold">{formatNumber(item.quantityOnHand)} {item.unit}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Reorder: <strong className="text-slate-700 font-mono">{formatNumber(item.reorderLevel)} {item.unit}</strong>
                      </span>
                      {item.shortfall > 0 && (
                        <span className="text-rose-700 font-bold">
                          (Shortfall: -{formatNumber(item.shortfall)} {item.unit})
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge type="stock" value={item.stockLevel} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
