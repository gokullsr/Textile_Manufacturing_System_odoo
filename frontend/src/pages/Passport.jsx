import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getRollByRollId, submitInspection, updateDispatchStatus } from '../services/rollService';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { buildRollUrl, DEFAULT_LAN_IP, DEFAULT_ONLINE_URL } from '../utils/qrUtils';
import { formatNumber, formatDate } from '../utils/formatters';
import {
  ArrowLeft,
  QrCode,
  Printer,
  Calendar,
  Layers,
  Cpu,
  User,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Send,
  RotateCcw,
  Truck,
  Search,
  ExternalLink,
  Copy,
  Smartphone,
  Globe,
  Wifi,
} from 'lucide-react';

export const Passport = () => {
  const { rollId } = useParams();
  const [roll, setRoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Host configuration state for real-time QR scanning (defaults to online public URL)
  const [selectedHostMode, setSelectedHostMode] = useState('online'); // 'online' | 'lan' | 'current' | 'custom'
  const [customHostUrl, setCustomHostUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Inspection form state
  const [inspectionResult, setInspectionResult] = useState('PASS');
  const [defectNotes, setDefectNotes] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [inspectionSubmitting, setInspectionSubmitting] = useState(false);
  const [inspectionError, setInspectionError] = useState(null);
  const [inspectionSuccess, setInspectionSuccess] = useState(false);

  // Dispatch action state
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
  const [dispatchError, setDispatchError] = useState(null);
  const [dispatchSuccess, setDispatchSuccess] = useState(false);

  // Custom search box for 404 state
  const [notFoundSearch, setNotFoundSearch] = useState('');

  const fetchPassport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRollByRollId(rollId);
      setRoll(res.roll);
      setDefectNotes('');
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [rollId]);

  useEffect(() => {
    fetchPassport();
  }, [fetchPassport]);

  const getActiveQrBaseUrl = () => {
    if (selectedHostMode === 'online') {
      return (
        import.meta.env?.VITE_PUBLIC_APP_URL ||
        DEFAULT_ONLINE_URL ||
        (typeof window !== 'undefined' ? window.location.origin : '')
      );
    }
    if (selectedHostMode === 'lan') {
      return `http://${DEFAULT_LAN_IP}:5173`;
    }
    if (selectedHostMode === 'custom' && customHostUrl.trim()) {
      return customHostUrl.trim();
    }
    return typeof window !== 'undefined' ? window.location.origin : DEFAULT_ONLINE_URL;
  };

  const activeQrUrl = roll ? buildRollUrl(roll.rollId, getActiveQrBaseUrl()) : '';

  const handleCopyLink = () => {
    if (activeQrUrl) {
      navigator.clipboard.writeText(activeQrUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleInspectionSubmit = async (e) => {
    e.preventDefault();

    if (inspectionResult === 'REJECT') {
      const confirmed = window.confirm(
        '⚠️ Are you sure you want to REJECT this roll? This flags the material as scrap or quarantine.'
      );
      if (!confirmed) return;
    }

    setInspectionSubmitting(true);
    setInspectionError(null);
    setInspectionSuccess(false);

    try {
      const payload = {
        result: inspectionResult,
        defectNotes,
        inspectorName: inspectorName.trim() || undefined,
      };
      const res = await submitInspection(roll.rollId, payload);
      setRoll(res.roll);
      setDefectNotes('');
      setInspectionSuccess(true);
      setTimeout(() => setInspectionSuccess(false), 4000);
    } catch (err) {
      setInspectionError(err.message || 'Inspection submission failed');
    } finally {
      setInspectionSubmitting(false);
    }
  };

  const handleDispatchTransition = async (targetStatus) => {
    if (targetStatus === 'DISPATCHED') {
      const confirmed = window.confirm(
        '🚚 Are you sure you want to mark this roll as DISPATCHED? This is a terminal state and cannot be undone.'
      );
      if (!confirmed) return;
    }

    setDispatchSubmitting(true);
    setDispatchError(null);
    setDispatchSuccess(false);

    try {
      const res = await updateDispatchStatus(roll.rollId, { dispatchStatus: targetStatus });
      setRoll(res.roll);
      setDispatchSuccess(true);
      setTimeout(() => setDispatchSuccess(false), 4000);
    } catch (err) {
      setDispatchError(err.message || 'Dispatch status update failed');
    } finally {
      setDispatchSubmitting(false);
    }
  };

  const handlePrintLabel = () => {
    window.print();
  };

  if (loading) return <LoadingState message={`Accessing Fabric Passport for ${rollId}...`} />;

  // 404 Roll Not Found
  if (error && (error.status === 404 || error.code === 'ROLL_NOT_FOUND')) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 inline-block shadow-sm">
          <QrCode className="w-12 h-12 text-rose-500 mx-auto" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fabric Roll Passport Not Found</h1>
          <p className="text-xs font-mono text-slate-700 mt-2 bg-slate-100 py-1.5 px-3 rounded-lg inline-block border border-slate-200">
            Scanned ID: <span className="text-rose-600 font-bold">{rollId}</span>
          </p>
          <p className="text-sm text-slate-600 mt-2">
            No digital passport exists with this identifier. The roll may have been deleted or the QR code is invalid.
          </p>
        </div>

        {/* Quick Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
          <label className="block text-xs font-bold text-slate-700 text-left">Search Roll Registry</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. FR-2026-000001"
              value={notFoundSearch}
              onChange={(e) => setNotFoundSearch(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 uppercase focus:outline-none focus:border-teal-500 font-mono"
            />
            <Link
              to={`/rolls/${notFoundSearch.trim().toUpperCase()}`}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-xs"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </Link>
          </div>
        </div>

        <div>
          <Link
            to="/rolls"
            className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700 hover:text-teal-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Fabric Rolls Registry</span>
          </Link>
        </div>
      </div>
    );
  }

  // 400 Bad Roll ID Format
  if (error && (error.status === 400 || error.code === 'INVALID_ROLL_ID_FORMAT')) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-4">
        <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 inline-block">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Invalid Fabric Roll ID Format</h1>
        <p className="text-xs font-mono text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
          '{rollId}'
        </p>
        <p className="text-xs text-slate-600">
          Roll IDs must be 3-40 uppercase alphanumeric characters (e.g. <code className="text-teal-700 font-bold">FR-2026-000001</code>).
        </p>
        <div className="pt-2">
          <Link to="/rolls" className="text-xs font-semibold text-teal-700 hover:text-teal-800">
            &larr; Back to registry
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load Fabric Passport" error={error} onRetry={fetchPassport} />;
  }

  if (!roll) return null;

  const allowed = roll.allowedActions || { canInspect: true, canMarkReady: false, canUnready: false, canDispatch: false };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Printable Label Section (Hidden on Screen, Visible on Print) */}
      <div className="hidden print:block print:p-8 print:text-black print:bg-white text-center space-y-4 font-mono">
        <h1 className="text-2xl font-bold uppercase tracking-wider">LoomIQ Fabric Roll Passport</h1>
        <div className="flex justify-center my-4">
          <QRCodeSVG value={activeQrUrl} size={220} level="M" />
        </div>
        <div className="text-xl font-bold">{roll.rollId}</div>
        <div className="text-sm">Order: {roll.order?.orderNumber || 'N/A'} ({roll.order?.buyer || 'Standard'})</div>
        <div className="text-sm">Machine: {roll.machine?.machineCode || roll.machine?.code || 'N/A'}</div>
        <div className="text-sm">Length: {formatNumber(roll.quantityMetres)} Metres</div>
        <div className="text-xs text-gray-500 mt-4">Scan QR to view full digital quality audit history on any device</div>
      </div>

      {/* Screen Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <Link
          to="/rolls"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Fabric Rolls</span>
        </Link>

        <button
          onClick={handlePrintLabel}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition-all self-start sm:self-center"
        >
          <Printer className="w-3.5 h-3.5 text-teal-600" />
          <span>Print Physical QR Label</span>
        </button>
      </div>

      {/* Main Passport Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm print:hidden space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl md:text-3xl font-bold font-mono text-slate-900 tracking-tight flex items-center gap-2">
                <QrCode className="w-7 h-7 text-teal-600" />
                {roll.rollId}
              </span>
              <StatusBadge type="quality" value={roll.qualityStatus} />
              <StatusBadge type="dispatch" value={roll.dispatchStatus} />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Fabric Roll Digital Passport & Live Traceability Audit
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-mono">
              Registered: {formatDate(roll.createdAt)}
            </span>
          </div>
        </div>

        {/* Notifications */}
        {inspectionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs font-medium shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>Inspection result logged successfully! Digital quality passport updated.</span>
          </div>
        )}

        {dispatchSuccess && (
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 flex items-center gap-3 text-teal-900 text-xs font-medium shadow-xs">
            <Truck className="w-5 h-5 text-teal-600 flex-shrink-0" />
            <span>Dispatch status updated successfully!</span>
          </div>
        )}

        {/* 2-Column Passport Layout (Traceability Info + QR Code Card) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Traceability Matrix */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-teal-700 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>Manufacturing Traceability</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Production Work Order</span>
                {roll.order ? (
                  <Link
                    to={`/orders/${roll.order.orderNumber}`}
                    className="font-mono font-bold text-teal-700 hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>{roll.order.orderNumber}</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                ) : (
                  <span className="text-slate-400 italic">Unlinked</span>
                )}
                <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                  Buyer: {roll.order?.buyer || '—'}
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Assigned Loom / Station</span>
                <span className="font-mono font-bold text-slate-900 text-sm block mt-0.5">
                  {roll.machine?.machineCode || roll.machine?.code || '—'}
                </span>
                <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                  {roll.machine?.name || 'Standard Loom'} ({roll.machine?.type?.replace('_', ' ')})
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Roll Length</span>
                <span className="text-lg font-bold font-mono text-slate-900 mt-0.5 block">
                  {formatNumber(roll.quantityMetres)} <span className="text-xs font-normal text-slate-500">metres</span>
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Fabric Specification</span>
                <span className="font-bold text-slate-800 truncate block mt-0.5">
                  {roll.order?.fabricType || 'Standard Textile'}
                </span>
              </div>
            </div>

            {/* Latest Inspection Assessment */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-bold">Latest Inspection Note</span>
                <span className="text-[11px] text-slate-500">
                  {roll.inspectedAt ? formatDate(roll.inspectedAt) : 'Pending Inspection'}
                </span>
              </div>
              <p className="text-xs text-slate-700 italic">
                {roll.defectNotes ? `"${roll.defectNotes}"` : 'No quality defects or remarks logged.'}
              </p>
            </div>
          </div>

          {/* Right 1 Col: Real-Time Scannable QR Identity Card */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center space-y-4 shadow-2xs">
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Live Scannable QR</span>
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Real-Time
              </span>
            </div>

            {/* High-Contrast Crisp QR SVG */}
            <div className="p-3.5 bg-white rounded-2xl shadow-xs border border-slate-200 inline-block">
              <QRCodeSVG
                value={activeQrUrl}
                size={165}
                level="Q"
                includeMargin={false}
              />
            </div>

            {/* Network / Host Switcher for Scanning */}
            <div className="w-full space-y-2 text-left">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-700">QR Target URL:</span>
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>

              <div className="text-[10px] font-mono text-slate-800 bg-white p-2 rounded-xl border border-slate-200 break-all select-all shadow-2xs">
                {activeQrUrl}
              </div>

              {/* Host Selector Toggle */}
              <div className="pt-1 space-y-2">
                <div className="flex gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setSelectedHostMode('online')}
                    className={`flex-1 py-1.5 px-2 rounded-lg font-bold border transition-all flex items-center justify-center gap-1 ${
                      selectedHostMode === 'online'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Accessible globally from any phone, cellular data, or remote network"
                  >
                    <Globe className="w-3 h-3" />
                    <span>Live Online (Any Device)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedHostMode('lan')}
                    className={`py-1.5 px-2 rounded-lg font-semibold border transition-all flex items-center justify-center gap-1 ${
                      selectedHostMode === 'lan'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Accessible by devices on the local Wi-Fi"
                  >
                    <Wifi className="w-3 h-3" />
                    <span>Wi-Fi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedHostMode('current')}
                    className={`py-1.5 px-2 rounded-lg font-semibold border transition-all ${
                      selectedHostMode === 'current'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Localhost only"
                  >
                    Local
                  </button>
                </div>

                <p className="text-[10px] text-slate-500 leading-tight">
                  📱 <strong>Scan from Any Device Online:</strong> Scan with your phone camera on <strong>cellular 4G/5G or any Wi-Fi</strong>. It directly opens this live fabric roll record with real-time quality & dispatch controls!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Operations: Quality Inspection & Dispatch Transitions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        {/* Left Col: Quality Inspection Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
              <h2 className="font-bold text-slate-900 text-base">Quality Inspection</h2>
            </div>
            <StatusBadge type="quality" value={roll.qualityStatus} />
          </div>

          {!allowed.canInspect ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600 flex-shrink-0" />
              <span>
                Roll is <strong>DISPATCHED</strong>. Quality state is locked and cannot be re-inspected.
              </span>
            </div>
          ) : (
            <form onSubmit={handleInspectionSubmit} className="space-y-4">
              {inspectionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{inspectionError}</span>
                </div>
              )}

              {/* 3 Labeled Outcome Options */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Inspection Grade Decision <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setInspectionResult('PASS')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      inspectionResult === 'PASS'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ✓ PASS
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectionResult('REWORK')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      inspectionResult === 'REWORK'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ↻ REWORK
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectionResult('REJECT')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      inspectionResult === 'REJECT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ✕ REJECT
                  </button>
                </div>
              </div>

              {/* Defect Notes with Counter */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Defect Notes & Observations{' '}
                    {(inspectionResult === 'REWORK' || inspectionResult === 'REJECT') && (
                      <span className="text-rose-500 font-bold">* (Required)</span>
                    )}
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {defectNotes.length}/500
                  </span>
                </div>
                <textarea
                  rows="3"
                  maxLength={500}
                  value={defectNotes}
                  onChange={(e) => setDefectNotes(e.target.value)}
                  placeholder={
                    inspectionResult === 'PASS'
                      ? 'Optional remarks (e.g. 4-point inspection approved, uniform tension)'
                      : 'Describe defects, slub locations, shade variations, or needle line damage...'
                  }
                  required={inspectionResult === 'REWORK' || inspectionResult === 'REJECT'}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Inspector Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Inspector Name / ID <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={80}
                  placeholder="e.g. Devon Vance (QA Lead)"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={inspectionSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{inspectionSubmitting ? 'Recording Audit...' : 'Submit Quality Inspection'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Col: Dispatch Management */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-teal-600" />
                <h2 className="font-bold text-slate-900 text-base">Dispatch Lifecycle</h2>
              </div>
              <StatusBadge type="dispatch" value={roll.dispatchStatus} />
            </div>

            {dispatchError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{dispatchError}</span>
              </div>
            )}

            <div className="mt-4 space-y-3 text-xs">
              <p className="text-slate-600">
                Dispatch progression is strictly gated by Quality Assurance. Only rolls with verified <strong>PASS</strong> status can be staged in packaging or dispatched to buyers.
              </p>

              {roll.qualityStatus !== 'PASS' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    Dispatch actions locked: Current quality status is <strong>{roll.qualityStatus}</strong>.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-4 border-t border-slate-100">
            {/* Mark Ready */}
            {allowed.canMarkReady && (
              <button
                onClick={() => handleDispatchTransition('READY_FOR_DISPATCH')}
                disabled={dispatchSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Ready for Dispatch</span>
              </button>
            )}

            {/* Undo Ready */}
            {allowed.canUnready && (
              <button
                onClick={() => handleDispatchTransition('NOT_DISPATCHED')}
                disabled={dispatchSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Undo Ready Status</span>
              </button>
            )}

            {/* Mark Dispatched */}
            {allowed.canDispatch && (
              <button
                onClick={() => handleDispatchTransition('DISPATCHED')}
                disabled={dispatchSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Truck className="w-4 h-4" />
                <span>Mark Dispatched (Ship to Buyer)</span>
              </button>
            )}

            {roll.dispatchStatus === 'DISPATCHED' && (
              <div className="py-2.5 px-4 rounded-xl bg-sky-50 border border-sky-200 text-center text-xs text-sky-800 font-semibold flex items-center justify-center gap-2">
                <Truck className="w-4 h-4" />
                <span>Fabric Roll Shipped ({formatDate(roll.dispatchedAt)})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quality Inspection Audit Timeline */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm print:hidden space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" />
            <h2 className="font-bold text-slate-900 text-base">Quality Inspection History (Audit Trail)</h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {roll.inspections?.length || 0} event{(roll.inspections?.length || 0) === 1 ? '' : 's'} recorded
          </span>
        </div>

        {(!roll.inspections || roll.inspections.length === 0) ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No inspection entries logged yet. Roll is awaiting initial shopfloor QA check.
          </div>
        ) : (
          <div className="space-y-3">
            {roll.inspections.map((entry, idx) => (
              <div
                key={entry._id || idx}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge type="quality" value={entry.result} />
                    {entry.inspectorName && (
                      <span className="font-semibold text-slate-800">
                        • {entry.inspectorName}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {formatDate(entry.inspectedAt)} ({new Date(entry.inspectedAt).toLocaleTimeString()})
                  </span>
                </div>

                {entry.defectNotes && (
                  <p className="text-slate-700 pt-1 text-xs">
                    {entry.defectNotes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Passport;
