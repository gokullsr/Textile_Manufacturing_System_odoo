
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Radar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Search,
  ChevronRight,
  Info,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  Calendar,
  Zap,
} from 'lucide-react';
import { getDelayRadarAssessments } from '../services/delayRadarService';
import StatusBadge from '../components/StatusBadge';
import ProgressBar from '../components/ProgressBar';

export const DelayRadar = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFormulaInfo, setShowFormulaInfo] = useState(false);

  const fetchRadarData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      const res = await getDelayRadarAssessments(params);
      setData(res);
    } catch (err) {
      console.error('Failed to load Delay Radar data:', err);
      setError(err.message || 'Unable to retrieve Delay Radar calculations.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    fetchRadarData();
  }, [fetchRadarData]);

  const summary = data?.summary || {
    overdue: 0,
    atRisk: 0,
    onTrack: 0,
    insufficientData: 0,
    total: 0,
  };
  const orders = data?.orders || [];
  const highRiskOrders = orders.filter(
    (o) => o.status === 'OVERDUE' || o.status === 'AT_RISK'
  );
  const insufficientDataOrders = orders.filter(
    (o) => o.status === 'INSUFFICIENT_DATA'
  );

  const formatAsOfTime = (isoString) => {
    if (!isoString) return 'Just now';
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
              <Radar className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Explainable Delay Radar
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Rule-based estimates from machine capacity, not an AI prediction
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowFormulaInfo(!showFormulaInfo)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 transition-colors"
          >
            <Info className="w-3.5 h-3.5 text-teal-600" />
            <span>How this is calculated</span>
          </button>

          <div className="text-xs text-slate-600 font-mono px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
            As of:{' '}
            <span className="text-slate-900 font-bold">
              {formatAsOfTime(data?.generatedAt)}
            </span>
          </div>

          <button
            onClick={fetchRadarData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-xs font-semibold text-white transition-all shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {showFormulaInfo && data?.assumptions && (
        <div className="p-5 rounded-2xl bg-teal-50/50 border border-teal-200 text-xs text-slate-700 space-y-3 animate-fade-in shadow-xs">
          <div className="flex items-center justify-between border-b border-teal-200 pb-2">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-teal-600" />
              Transparent Rule-Based Calculation Engine
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-300 font-bold">
              Deterministic Math Model
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-bold text-slate-900 mb-1">Core Formula:</p>
              <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-slate-700">
                <li>Remaining Qty = Required Qty − Produced Qty</li>
                <li>Estimated Days = Remaining Qty ÷ Resolved Rate</li>
                <li>Slack Days = Available Days − Estimated Days</li>
                <li>Verdict: Estimated Days &gt; Available Days → AT RISK</li>
              </ul>
            </div>

            <div>
              <p className="font-bold text-slate-900 mb-1">Active Assumptions:</p>
              <ul className="space-y-1 text-slate-600">
                <li>
                  • <strong className="text-slate-800">Timezone:</strong>{' '}
                  {data.assumptions.factoryTimezone}
                </li>
                <li>
                  • <strong className="text-slate-800">Deadline Rule:</strong>{' '}
                  {data.assumptions.deadlineRule}
                </li>
                <li>
                  • <strong className="text-slate-800">Rate Precedence:</strong>{' '}
                  {data.assumptions.ratePrecedence}
                </li>
                <li>
                  • <strong className="text-slate-800">Tolerance:</strong>{' '}
                  {data.assumptions.tolerance} (zero floating drift)
                </li>
              </ul>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic border-t border-teal-200 pt-2">
            Note: All calculations represent deterministic estimates based on nominal factory capacity and do not constitute machine-learning forecasts.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <button
          onClick={() => setStatusFilter(statusFilter === 'OVERDUE' ? '' : 'OVERDUE')}
          className={`p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'OVERDUE'
              ? 'bg-rose-50 border-rose-300 shadow-sm ring-2 ring-rose-400'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-slate-900 font-mono">
              {summary.overdue}
            </span>
            <span className="text-[11px] text-slate-500">orders</span>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'AT_RISK' ? '' : 'AT_RISK')}
          className={`p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'AT_RISK'
              ? 'bg-amber-50 border-amber-300 shadow-sm ring-2 ring-amber-400'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">At Risk</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-slate-900 font-mono">
              {summary.atRisk}
            </span>
            <span className="text-[11px] text-slate-500">orders</span>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'ON_TRACK' ? '' : 'ON_TRACK')}
          className={`p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'ON_TRACK'
              ? 'bg-emerald-50 border-emerald-300 shadow-sm ring-2 ring-emerald-400'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">On Track</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-slate-900 font-mono">
              {summary.onTrack}
            </span>
            <span className="text-[11px] text-slate-500">orders</span>
          </div>
        </button>

        <button
          onClick={() =>
            setStatusFilter(
              statusFilter === 'INSUFFICIENT_DATA' ? '' : 'INSUFFICIENT_DATA'
            )
          }
          className={`p-4 rounded-xl border text-left transition-all ${
            statusFilter === 'INSUFFICIENT_DATA'
              ? 'bg-slate-100 border-slate-300 shadow-sm ring-2 ring-slate-400'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Needs Data</span>
            <HelpCircle className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-slate-900 font-mono">
              {summary.insufficientData}
            </span>
            <span className="text-[11px] text-slate-500">orders</span>
          </div>
        </button>
      </div>

      {loading && !data && (
        <div className="p-12 text-center text-slate-600 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-3" />
          <p className="text-sm font-semibold">
            Computing deterministic delay estimates...
          </p>
        </div>
      )}

      {error && (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex flex-col items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-rose-600" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={fetchRadarData}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white transition-colors"
          >
            Retry Calculation
          </button>
        </div>
      )}

      {!loading && !error && highRiskOrders.length > 0 && !statusFilter && !searchTerm && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              High-Priority Delay Risks ({highRiskOrders.length})
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Ranked by deadline severity
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {highRiskOrders.map((order) => {
              const progressPct =
                order.requiredQuantity > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (order.producedQuantity / order.requiredQuantity) * 100
                      )
                    )
                  : 0;

              return (
                <div
                  key={order.orderNumber}
                  className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                    order.status === 'OVERDUE'
                      ? 'bg-rose-50/40 border-rose-200 shadow-xs hover:shadow-sm'
                      : 'bg-amber-50/40 border-amber-200 shadow-xs hover:shadow-sm'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 font-mono text-base">
                            {order.orderNumber}
                          </span>
                          <StatusBadge type="radar" value={order.status} />
                        </div>
                        <p className="text-xs text-slate-700 font-semibold mt-0.5">
                          {order.buyer}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate max-w-sm">
                          {order.fabricType}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] text-slate-500 font-mono flex items-center justify-end gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>
                            Due:{' '}
                            {order.dueDate
                              ? new Date(order.dueDate).toLocaleDateString('en-US')
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="mt-1">
                          {order.status === 'OVERDUE' ? (
                            <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                              Past Due
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                              Shortfall: {order.daysLate ? Number(order.daysLate).toFixed(1) : '0.0'}d late
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 font-medium">Production Progress</span>
                        <span className="text-slate-900 font-mono font-bold">
                          {order.producedQuantity?.toLocaleString()} /{' '}
                          {order.requiredQuantity?.toLocaleString()} {order.unit} (
                          {progressPct}%)
                        </span>
                      </div>
                      <ProgressBar percent={progressPct} />
                      <div className="flex justify-between text-[11px] text-slate-500 font-mono pt-0.5">
                        <span>
                          Remaining: {order.remainingQuantity?.toLocaleString()} {order.unit}
                        </span>
                        <span>
                          {order.estimatedProductionDays !== null
                            ? `Needs ${Number(order.estimatedProductionDays).toFixed(1)}d / Has ${Number(order.availableProductionDays).toFixed(1)}d`
                            : 'Rate Missing'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 shadow-2xs">
                      <span className="font-bold text-slate-900">Calculation: </span>
                      {order.reason}
                    </div>

                    {order.suggestedAction && (
                      <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-start gap-2 shadow-2xs">
                        <Zap className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-teal-800">Suggested Action: </strong>
                          {order.suggestedAction.text}
                        </div>
                      </div>
                    )}

                    {order.warnings && order.warnings.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {order.warnings.map((w, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {w.code}: {w.message}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-200 mt-4 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 italic">
                      Deterministic Estimate
                    </span>
                    <Link
                      to={`/delay-radar/${order.orderNumber}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-xs font-semibold text-teal-700 border border-slate-200 hover:border-teal-300 shadow-2xs transition-colors"
                    >
                      <span>Why is this at risk?</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !error && insufficientDataOrders.length > 0 && (statusFilter === 'INSUFFICIENT_DATA' || !statusFilter) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-slate-500" />
              Orders Needing Data Configuration ({insufficientDataOrders.length})
            </h2>
            <span className="text-xs text-slate-500">
              Missing parameters prevent reliable estimate
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insufficientDataOrders.map((order) => (
              <div
                key={order.orderNumber}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono">
                          {order.orderNumber}
                        </span>
                        <StatusBadge type="radar" value="INSUFFICIENT_DATA" />
                      </div>
                      <p className="text-xs text-slate-700 font-semibold mt-0.5">
                        {order.buyer}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                      {order.reasonCode || 'INCOMPLETE_DATA'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 mt-2.5">{order.reason}</p>

                  <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                    <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900">Suggested Fix: </strong>
                      {order.suggestedAction?.text || 'Review order and machine configurations.'}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <Link
                    to={`/delay-radar/${order.orderNumber}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                  >
                    <span>View Inspection Trace</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-600" />
            All Active Factory Orders ({orders.length})
          </h2>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search order or buyer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-teal-500"
            >
              <option value="">All Statuses</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="AT_RISK">AT RISK</option>
              <option value="ON_TRACK">ON TRACK</option>
              <option value="INSUFFICIENT_DATA">INSUFFICIENT DATA</option>
            </select>
          </div>
        </div>

        {!loading && !error && orders.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Order Number</th>
                  <th className="px-4 py-3">Buyer &amp; Fabric</th>
                  <th className="px-4 py-3">Radar Status</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Production Rate</th>
                  <th className="px-4 py-3">Time Needed / Avail</th>
                  <th className="px-4 py-3">Slack / Late</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((ord) => (
                  <tr
                    key={ord.orderNumber}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                      <Link
                        to={`/delay-radar/${ord.orderNumber}`}
                        className="hover:text-teal-600 transition-colors"
                      >
                        {ord.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{ord.buyer}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">
                        {ord.fabricType}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge type="radar" value={ord.status} />
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-800">
                      {ord.dueDate
                        ? new Date(ord.dueDate).toLocaleDateString('en-US')
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-800">
                      {ord.rate?.value ? (
                        <span>
                          {ord.rate.value} {ord.unit}/d{' '}
                          <span className="text-[10px] text-slate-400">
                            ({ord.rate.machineCode || 'override'})
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono">
                      {ord.estimatedProductionDays !== null ? (
                        <span>
                          {Number(ord.estimatedProductionDays).toFixed(1)}d /{' '}
                          <span className="text-slate-500">
                            {Number(ord.availableProductionDays).toFixed(1)}d
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold">
                      {ord.status === 'OVERDUE' && (
                        <span className="text-rose-600">Overdue</span>
                      )}
                      {ord.status === 'AT_RISK' && (
                        <span className="text-amber-600">
                          -{Number(ord.daysLate || 0).toFixed(1)}d
                        </span>
                      )}
                      {ord.status === 'ON_TRACK' && (
                        <span className="text-emerald-600">
                          +{Number(ord.slackDays || 0).toFixed(1)}d
                        </span>
                      )}
                      {ord.status === 'INSUFFICIENT_DATA' && (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        to={`/delay-radar/${ord.orderNumber}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                      >
                        <span>Explain</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-base font-bold text-slate-800">
              {statusFilter || searchTerm
                ? 'No orders match your filters'
                : 'No active orders'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {statusFilter || searchTerm
                ? 'Try clearing the search query or status filter above.'
                : 'All production orders are currently marked completed or cancelled.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DelayRadar;
