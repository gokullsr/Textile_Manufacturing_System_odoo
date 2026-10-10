import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calculator,
  Clock,
  AlertTriangle,
  Zap,
  Cpu,
  Calendar,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { getOrderAssessment } from '../services/delayRadarService';
import StatusBadge from '../components/StatusBadge';
import ProgressBar from '../components/ProgressBar';

export const RadarExplainPanel = () => {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);

  const fetchAssessment = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setErrorCode(null);
      const res = await getOrderAssessment(orderNumber);
      setData(res);
    } catch (err) {
      console.error('Error fetching order assessment:', err);
      setError(err.message || 'Failed to retrieve Delay Radar assessment');
      setErrorCode(err.code || 'UNKNOWN_ERROR');
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    if (orderNumber) {
      fetchAssessment();
    }
  }, [orderNumber, fetchAssessment]);

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-600 bg-white rounded-2xl border border-slate-200 animate-fade-in shadow-xs">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-3" />
        <p className="text-sm font-semibold">Trace-calculating deterministic schedule for {orderNumber}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-4 animate-fade-in shadow-sm">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">
          {errorCode === 'ORDER_NOT_FOUND' ? 'Order Not Found' : 'Assessment Error'}
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          {errorCode === 'INVALID_ORDER_NUMBER'
            ? `Order number '${orderNumber}' is malformed. Valid format example: PO-2026-0001.`
            : error}
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={fetchAssessment}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-xs font-semibold text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const assessment = data?.assessment;
  const assumptions = data?.assumptions;

  if (!assessment) return null;

  const progressPercent = assessment.requiredQuantity > 0 
    ? Math.min(100, Math.round((assessment.producedQuantity / assessment.requiredQuantity) * 100))
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/delay-radar"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Delay Radar</span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span>Order: <strong className="text-slate-900">{assessment.orderNumber}</strong></span>
        </div>
      </div>

      {/* Main Card Header */}
      <div className="p-6 md:p-8 rounded-2xl bg-white border border-slate-200 space-y-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold font-mono tracking-tight text-slate-900">
                {assessment.orderNumber}
              </h1>
              <StatusBadge type="radar" value={assessment.status} />
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                Priority: {assessment.priority}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900">{assessment.buyer}</p>
            <p className="text-xs text-slate-500">{assessment.fabricType}</p>
          </div>

          <div className="flex flex-col md:items-end gap-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Due: {assessment.dueDate ? new Date(assessment.dueDate).toLocaleDateString('en-US') : 'N/A'}</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Deadline: 23:59:59.999 ({assumptions?.factoryTimezone || 'Asia/Kolkata'})
            </div>
          </div>
        </div>

        {/* Real Numbers Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Required Quantity</span>
            <div className="mt-1 text-base font-bold text-slate-900 font-mono">
              {assessment.requiredQuantity?.toLocaleString()} <span className="text-xs font-normal text-slate-500">{assessment.unit}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Produced So Far</span>
            <div className="mt-1 text-base font-bold text-teal-700 font-mono">
              {assessment.producedQuantity?.toLocaleString()} <span className="text-xs font-normal text-slate-500">{assessment.unit}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Remaining Balance</span>
            <div className="mt-1 text-base font-bold text-amber-700 font-mono">
              {assessment.remainingQuantity?.toLocaleString() ?? 0} <span className="text-xs font-normal text-slate-500">{assessment.unit}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Resolved Rate</span>
            <div className="mt-1 text-base font-bold text-slate-900 font-mono truncate">
              {assessment.rate?.value ? (
                <span>
                  {assessment.rate.value} <span className="text-xs font-normal text-slate-500">{assessment.unit}/d</span>
                </span>
              ) : (
                <span className="text-slate-400 text-xs italic">Missing</span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-500">Order Progress</span>
            <span className="text-slate-900 font-mono font-bold">{progressPercent}%</span>
          </div>
          <ProgressBar percent={progressPercent} />
        </div>

        {/* Reason Statement & Suggested Action */}
        <div className="space-y-3 pt-2">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <span className="font-bold text-slate-900">Engine Reason: </span>
            {assessment.reason}
          </div>

          {assessment.suggestedAction && (
            <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-teal-800">Suggested Action ({assessment.suggestedAction.code}): </strong>
                {assessment.suggestedAction.text}
              </div>
            </div>
          )}
        </div>

        {/* Warnings */}
        {assessment.warnings && assessment.warnings.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-bold uppercase text-amber-700 tracking-wider">Active Warnings</span>
            <div className="space-y-1.5">
              {assessment.warnings.map((w, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-xs p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-medium"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="font-mono text-[11px]">{w.code}:</strong> {w.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Step-by-Step Mathematical Calculation Trace */}
      <div className="p-6 md:p-8 rounded-2xl bg-white border border-slate-200 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Mathematical Calculation Trace
              </h2>
              <p className="text-xs text-slate-500">
                Transparent step-by-step arithmetic returned directly by the API
              </p>
            </div>
          </div>

          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold">
            Pure Math Trace
          </span>
        </div>

        {/* Step List rendered from calculation array */}
        <div className="space-y-3">
          {assessment.calculation && assessment.calculation.length > 0 ? (
            assessment.calculation.map((step, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-mono text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{step.label}</span>
                  </div>
                  <p className="text-xs font-mono text-slate-600 pl-7">{step.expression}</p>
                </div>

                <div className="pl-7 sm:pl-0 sm:text-right">
                  <span className="text-xs font-mono font-bold text-teal-700 px-2.5 py-1 rounded bg-white border border-slate-200 shadow-2xs">
                    {step.result}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 italic">No arithmetic steps applicable for this status.</p>
          )}
        </div>

        {/* Rate Comparison Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-teal-600" />
              Assigned Capacity Source
            </span>
            <div className="text-xs text-slate-700 space-y-1">
              <p>
                • <strong className="text-slate-800">Source:</strong>{' '}
                {assessment.rate?.source === 'ORDER_OVERRIDE'
                  ? 'Order productionRatePerDay override'
                  : assessment.rate?.source === 'MACHINE_CAPACITY'
                  ? `Machine Nominal Capacity (${assessment.rate.machineCode})`
                  : 'None / Unassigned'}
              </p>
              <p>
                • <strong className="text-slate-800">Current Rate:</strong>{' '}
                {assessment.rate?.value ? `${assessment.rate.value} ${assessment.unit}/day` : 'N/A'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Required Rate vs Current
            </span>
            <div className="text-xs text-slate-700 space-y-1">
              <p>
                • <strong className="text-slate-800">Rate Needed to Finish on Time:</strong>{' '}
                {assessment.requiredRatePerDay
                  ? `${Number(assessment.requiredRatePerDay).toFixed(1)} ${assessment.unit}/day`
                  : 'N/A (Past deadline or missing)'}
              </p>
              <p>
                • <strong className="text-slate-800">Projected Completion Date:</strong>{' '}
                {assessment.estimatedCompletionAt
                  ? new Date(assessment.estimatedCompletionAt).toLocaleDateString('en-US')
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer Label */}
        <div className="pt-2 text-center">
          <p className="text-[11px] text-slate-400 italic">
            Deterministic rule-based estimate calculated from machine daily capacity. Not a guarantee.
          </p>
        </div>
      </div>

      {/* Link to order detail */}
      <div className="flex justify-between items-center px-2">
        <Link
          to={`/orders/${assessment.orderNumber}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>View full order workcenter specifications & fabric passport</span>
        </Link>
      </div>
    </div>
  );
};

export default RadarExplainPanel;
