import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { qualityService } from '../services/qualityService';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { formatNumber, formatDate } from '../utils/formatters';
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Cell,
  Legend,
} from 'recharts';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Flame,
  ArrowRight,
  Clock,
  Layers,
  Cpu,
  BarChart3,
  TrendingDown,
  Info,
  ExternalLink,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  Sliders,
  Eye,
  Filter,
  Activity,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';

export const QualityControlTower = () => {
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [windowDays, setWindowDays] = useState(30);
  const [stageFilter, setStageFilter] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'yields', 'pareto', 'hold'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRtyHelp, setShowRtyHelp] = useState(false);

  const fetchQualityData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, alertData] = await Promise.all([
        qualityService.getSummary({ days: windowDays, stage: stageFilter || undefined }),
        qualityService.getAlerts(),
      ]);
      setSummary(sumData);
      setAlerts(alertData.alerts || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [windowDays, stageFilter]);

  useEffect(() => {
    fetchQualityData();
  }, [fetchQualityData]);

  if (loading) return <LoadingState message="Analyzing stage quality intelligence..." />;
  if (error) return <ErrorState title="Failed to load Quality Control Tower" error={error} onRetry={fetchQualityData} />;
  if (!summary) return null;

  // Chart data preparation
  const fpyChartData = (summary.stages || []).map((s) => ({
    stage: s.shortLabel || s.stage,
    fpy: s.fpy !== null ? s.fpy : 0,
    reworkRate: s.reworkRate || 0,
    rejectRate: s.rejectRate || 0,
    lowSample: s.lowSample,
    sampleSize: s.sampleSize,
  }));

  const paretoChartData = (summary.pareto || []).slice(0, 8).map((p) => ({
    name: p.label || p.code,
    points: p.points,
    occurrences: p.occurrences,
    cumulativePercent: p.cumulativePercent,
  }));

  const hotspotChartData = (summary.hotspots || []).map((h) => ({
    machineCode: h.machineCode,
    nonPassRate: h.nonPassRate !== null ? Math.round(h.nonPassRate * 100) : 0,
    nonPassCount: h.nonPassCount,
    totalFirstPass: h.totalFirstPass,
    lowSample: h.lowSample,
    isHotspot: h.isHotspot,
  }));

  const criticalAlertsCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const warnAlertsCount = alerts.filter((a) => a.severity === 'WARN').length;
  const rollsOnHoldCount = (summary.rollsOnHold || []).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
              <Activity className="w-3.5 h-3.5" />
              Module 4: Quality Control Tower
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Deterministic Math Engine
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-2">Quality Control Tower</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time stage gate verification & early defect analytics across all factory workcenters
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Time Window Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setWindowDays(days)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  windowDays === days ? 'bg-white text-teal-800 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>

          <Link
            to="/quality/actions"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>CAPA Actions</span>
          </Link>

          <button
            onClick={fetchQualityData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-xs transition-all"
            title="Refresh Control Tower"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Status KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Alerts */}
        <div
          onClick={() => setActiveTab('overview')}
          className={`cursor-pointer bg-white p-5 rounded-2xl border transition-all shadow-xs hover:border-slate-300 ${
            activeTab === 'overview' ? 'ring-2 ring-teal-500/20 border-teal-500/50' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quality Alerts</span>
            <span className={`p-2 rounded-xl ${alerts.length > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{alerts.length}</span>
            <span className="text-xs font-medium text-slate-500">active</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px]">
            {criticalAlertsCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold">
                {criticalAlertsCount} Critical
              </span>
            )}
            {warnAlertsCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                {warnAlertsCount} Warning
              </span>
            )}
            {alerts.length === 0 && <span className="text-emerald-700 font-semibold">All Gates Normal</span>}
          </div>
        </div>

        {/* Rolled Throughput Yield (RTY) */}
        <div
          onClick={() => setActiveTab('yields')}
          className={`cursor-pointer bg-white p-5 rounded-2xl border transition-all shadow-xs hover:border-slate-300 ${
            activeTab === 'yields' ? 'ring-2 ring-teal-500/20 border-teal-500/50' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rolled Yield (RTY)</span>
              <button
                onClick={(e) => { e.stopPropagation(); setShowRtyHelp(!showRtyHelp); }}
                className="text-slate-400 hover:text-slate-600"
                title="What is RTY?"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {summary.rty !== null ? `${summary.rty}%` : 'Pending'}
            </span>
            <span className="text-xs font-medium text-slate-500">end-to-end</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 truncate">
            {summary.rty !== null ? 'Cumulative 4-stage yield' : 'Awaiting min. 5 samples per stage'}
          </p>
        </div>

        {/* Late-Detection Escapes */}
        <div
          onClick={() => setActiveTab('pareto')}
          className={`cursor-pointer bg-white p-5 rounded-2xl border transition-all shadow-xs hover:border-slate-300 ${
            activeTab === 'pareto' ? 'ring-2 ring-teal-500/20 border-teal-500/50' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Late Detection Rate</span>
            <span className={`p-2 rounded-xl ${summary.lateDetectionRate > 20 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {summary.lateDetectionRate !== null ? `${summary.lateDetectionRate}%` : '0%'}
            </span>
            <span className="text-xs font-medium text-slate-500">at final QC</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {summary.finalRejects || 0} of {summary.totalRejects || 0} total scrap rejects
          </p>
        </div>

        {/* Rolls on Hold */}
        <div
          onClick={() => setActiveTab('hold')}
          className={`cursor-pointer bg-white p-5 rounded-2xl border transition-all shadow-xs hover:border-slate-300 ${
            activeTab === 'hold' ? 'ring-2 ring-teal-500/20 border-teal-500/50' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quarantine / Hold</span>
            <span className={`p-2 rounded-xl ${rollsOnHoldCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{rollsOnHoldCount}</span>
            <span className="text-xs font-medium text-slate-500">rolls flagged</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {rollsOnHoldCount > 0 ? 'Awaiting inspection or rework' : 'Zero rolls delayed on hold'}
          </p>
        </div>
      </div>

      {/* RTY Help Explanation Accordion */}
      {showRtyHelp && (
        <div className="bg-teal-50/80 border border-teal-200 rounded-2xl p-5 text-xs text-teal-950 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5 text-teal-900">
              <Info className="w-4 h-4 text-teal-700" />
              What is Rolled Throughput Yield (RTY)?
            </span>
            <button onClick={() => setShowRtyHelp(false)} className="text-teal-700 hover:text-teal-900 font-bold">✕</button>
          </div>
          <p>
            <strong>Rolled Throughput Yield (RTY)</strong> is the mathematical probability that a fabric roll will pass through all 4 production stages (<strong>Weaving → Dyeing → Finishing → Final QC</strong>) without requiring a single rework or encountering scrap defects.
          </p>
          <p className="font-mono bg-white/80 p-2 rounded-lg border border-teal-200/60">
            RTY = FPY(Grey) × FPY(Dyeing) × FPY(Finishing) × FPY(Final)
          </p>
          <p className="text-[11px] text-teal-800">
            To prevent skewed statistics, LoomIQ requires a minimum sample of at least 5 inspections per stage before displaying the RTY value.
          </p>
        </div>
      )}

      {/* Interactive Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-1 text-sm font-semibold">
        {[
          { id: 'overview', label: 'Overview & Alerts', icon: ShieldAlert, badge: alerts.length },
          { id: 'yields', label: 'Stage Yields & Gate Health', icon: Layers, badge: null },
          { id: 'pareto', label: 'Defects & Machine Hotspots', icon: BarChart3, badge: null },
          { id: 'hold', label: 'Quarantine & Hold Queue', icon: Clock, badge: rollsOnHoldCount },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition-all border-b-2 font-bold whitespace-nowrap ${
                isActive
                  ? 'border-teal-600 text-teal-800 bg-teal-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== null && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isActive ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & ACTIVE ALERTS */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Active Quality Alerts Grid */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h2 className="font-bold text-slate-900 text-base">Active Rule-Based Quality Alerts ({alerts.length})</h2>
              </div>
              <span className="text-xs text-slate-500">
                Triggered automatically over recorded inspection data
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 bg-emerald-50/60 rounded-2xl border border-emerald-200 flex flex-col items-center justify-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                <span className="font-bold text-emerald-950 text-sm">All Quality Gates Operating Within Tolerance</span>
                <span className="text-emerald-700">Zero machine defect thresholds, rework limits, or SLA breaches detected.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.key}
                    className={`p-4 rounded-xl border transition-all space-y-3 flex flex-col justify-between ${
                      alert.severity === 'CRITICAL'
                        ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-300/40'
                        : 'bg-amber-50/70 border-amber-300'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <StatusBadge type="severity" value={alert.severity} />
                          <span className="text-xs font-bold text-slate-800">{alert.title}</span>
                        </div>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-600">
                          {alert.type}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed">
                        {alert.explanation}
                      </p>

                      {/* Evidence Summary Box */}
                      {alert.evidence && (
                        <div className="bg-white/90 p-2.5 rounded-lg border border-slate-200/80 text-[11px] font-mono text-slate-700 space-y-1">
                          {alert.evidence.machineCode && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Workcenter:</span>
                              <span className="font-bold">{alert.evidence.machineCode}</span>
                            </div>
                          )}
                          {alert.evidence.nonPassRate !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">First-Pass Non-Pass Rate:</span>
                              <span className="font-bold text-rose-700">{alert.evidence.nonPassRate}%</span>
                            </div>
                          )}
                          {alert.evidence.hoursWaiting !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Hours in Stage:</span>
                              <span className="font-bold text-amber-700">{alert.evidence.hoursWaiting}h (SLA: {alert.evidence.slaHours}h)</span>
                            </div>
                          )}
                          {alert.evidence.occurrencesCount !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">14-Day Recurrences:</span>
                              <span className="font-bold text-rose-700">{alert.evidence.occurrencesCount} occurrences</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Suggested Action Bar & Remediation Action Link */}
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-600 font-medium truncate" title={alert.suggestedAction}>
                        💡 {alert.suggestedAction}
                      </span>

                      {/* 1-Click Remediation Shortcut */}
                      {alert.machineCode && alert.evidence?.defectCode ? (
                        <Link
                          to={`/quality/actions?machineCode=${alert.machineCode}&defectCode=${alert.evidence.defectCode}`}
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-all shadow-xs"
                        >
                          <span>Open CAPA</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      ) : alert.relatedRolls && alert.relatedRolls.length > 0 ? (
                        <Link
                          to={`/rolls/${alert.relatedRolls[0]}`}
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold transition-all shadow-xs"
                        >
                          <span>Inspect Roll</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4-Stage Pipeline Visual Overview Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900 text-base">Stage Quality Gate Summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(summary.stages || []).map((s) => (
                <div key={s.stage} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <StatusBadge type="stage" value={s.stage} />
                    <span className="text-[11px] font-mono text-slate-500">n = {s.sampleSize}</span>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-bold text-slate-600">First-Pass Yield</span>
                      <span className={`text-lg font-bold ${
                        s.fpy === null ? 'text-slate-400' : s.fpy >= 80 ? 'text-emerald-700' : 'text-amber-700'
                      }`}>
                        {s.fpy !== null ? `${s.fpy}%` : 'Low Sample'}
                      </span>
                    </div>

                    {/* FPY Progress Bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full rounded-full ${
                          s.fpy >= 80 ? 'bg-emerald-500' : s.fpy >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${s.fpy || 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Rework Rate:</span>
                      <span className="font-bold text-slate-800">{s.reworkRate}%</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Scrap / Reject:</span>
                      <span className="font-bold text-rose-700">{s.rejectRate}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STAGE YIELDS (FPY & RTY) */}
      {/* ========================================================================= */}
      {activeTab === 'yields' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-900 text-base">First-Pass Yield (FPY) by Stage</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Percentage of rolls meeting quality thresholds on first inspection without reprocessing
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500" /> First Pass PASS</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500" /> Rework Rate</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500" /> Reject / Scrap</span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fpyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="stage" tick={{ fill: '#475569', fontSize: 12, fontWeight: 'bold' }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fill: '#64748B', fontSize: 11 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl text-xs space-y-1 shadow-lg">
                            <p className="font-bold border-b border-slate-700 pb-1">{label} Stage Gate</p>
                            <p className="text-emerald-300">FPY: {payload[0]?.value}%</p>
                            <p className="text-amber-300">Rework: {payload[1]?.value}%</p>
                            <p className="text-rose-300">Reject: {payload[2]?.value}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="fpy" fill="#10B981" radius={[6, 6, 0, 0]} name="FPY %" />
                  <Bar dataKey="reworkRate" fill="#F59E0B" radius={[6, 6, 0, 0]} name="Rework %" />
                  <Bar dataKey="rejectRate" fill="#EF4444" radius={[6, 6, 0, 0]} name="Reject %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DEFECT PARETO & MACHINE HOTSPOTS */}
      {/* ========================================================================= */}
      {activeTab === 'pareto' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Defect Pareto Chart */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Defect Pareto Analysis</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Top defect codes ranked by occurrence points (80/20 root cause focus)
              </p>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={45} />
                  <YAxis yAxisId="left" tick={{ fill: '#64748B', fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fill: '#64748B', fontSize: 11 }} />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="points" fill="#6366F1" radius={[4, 4, 0, 0]} name="Points" />
                  <Line yAxisId="right" type="monotone" dataKey="cumulativePercent" stroke="#F43F5E" strokeWidth={2} dot={{ r: 3 }} name="Cumulative %" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Machine Hotspots Analysis */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Machine Workcenter Hotspots</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Workcenters with highest first-pass defect rates requiring calibration
              </p>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hotspotChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="machineCode" tick={{ fill: '#475569', fontSize: 11, fontWeight: 'bold' }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fill: '#64748B', fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="nonPassRate" name="Non-Pass %" radius={[4, 4, 0, 0]}>
                    {hotspotChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isHotspot ? '#EF4444' : entry.nonPassRate > 20 ? '#F59E0B' : '#10B981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: QUARANTINE & ROLLS ON HOLD */}
      {/* ========================================================================= */}
      {activeTab === 'hold' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Rolls on Hold & Awaiting Inspection ({rollsOnHoldCount})</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Rolls blocked by quality non-conformance, rework limits, or SLA delays
              </p>
            </div>
          </div>

          {rollsOnHoldCount === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
              Zero rolls currently quarantined or awaiting inspection.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="p-3">Roll ID</th>
                    <th className="p-3">Stage</th>
                    <th className="p-3">Quality Status</th>
                    <th className="p-3">Hours in Stage</th>
                    <th className="p-3">Defect Notes</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {summary.rollsOnHold.map((r) => (
                    <tr key={r.rollId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-teal-700">{r.rollId}</td>
                      <td className="p-3"><StatusBadge type="stage" value={r.stage} /></td>
                      <td className="p-3"><StatusBadge type="quality" value={r.qualityStatus} /></td>
                      <td className="p-3">
                        <span className={`font-mono font-bold ${r.isOverdue ? 'text-rose-600' : 'text-slate-700'}`}>
                          {r.hoursInStage}h {r.isOverdue && '(SLA Breached)'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate" title={r.defectNotes}>
                        {r.defectNotes || 'Awaiting initial stage gate inspection'}
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          to={`/rolls/${r.rollId}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold border border-teal-200 transition-all"
                        >
                          <span>Open Passport</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QualityControlTower;
