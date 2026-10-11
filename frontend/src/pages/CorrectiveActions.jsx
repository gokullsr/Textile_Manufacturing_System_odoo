import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { correctiveActionService } from '../services/correctiveActionService';
import { qualityService } from '../services/qualityService';
import { getMachines } from '../services/machineService';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { formatDate } from '../utils/formatters';
import {
  ClipboardList,
  Plus,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  User,
  Calendar,
  Layers,
  Cpu,
  X,
  Search,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

const ROOT_CAUSES = ['MACHINE', 'MATERIAL', 'METHOD', 'OPERATOR', 'ENVIRONMENT', 'UNKNOWN'];

export const CorrectiveActions = () => {
  const [searchParams] = useSearchParams();
  const [actions, setActions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [page, setPage] = useState(1);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: searchParams.get('defectCode') ? `Eliminate ${searchParams.get('defectCode')} recurrence on ${searchParams.get('machineCode') || 'workcenter'}` : '',
    stage: searchParams.get('stage') || 'GREY',
    defectCode: searchParams.get('defectCode') || '',
    machineCode: searchParams.get('machineCode') || '',
    rollId: searchParams.get('rollId') || '',
    rootCauseCategory: 'MACHINE',
    description: '',
    owner: '',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Transition Modal State (for VERIFIED notes or updates)
  const [selectedAction, setSelectedAction] = useState(null);
  const [transitionStatus, setTransitionStatus] = useState('');
  const [verificationNote, setVerificationNote] = useState('');
  const [transitionSubmitting, setTransitionSubmitting] = useState(false);
  const [transitionError, setTransitionError] = useState(null);

  // Config and machines for selects
  const [qualityConfig, setQualityConfig] = useState(null);
  const [machinesList, setMachinesList] = useState([]);

  // Auto-open create modal if navigated from alert shortcut
  useEffect(() => {
    if (searchParams.get('machineCode') || searchParams.get('defectCode')) {
      setIsCreateOpen(true);
    }
  }, [searchParams]);

  const fetchActions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [actionRes, cfgRes, machRes] = await Promise.all([
        correctiveActionService.getActions({
          status: statusFilter || undefined,
          stage: stageFilter || undefined,
          overdue: overdueFilter ? 'true' : undefined,
          page,
          limit: 20,
        }),
        qualityService.getConfig().catch(() => null),
        getMachines().catch(() => ({ machines: [] })),
      ]);
      setActions(actionRes.actions || []);
      setPagination(actionRes.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      setQualityConfig(cfgRes);
      setMachinesList(machRes.machines || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, stageFilter, overdueFilter, page]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setCreateError(null);

    try {
      await correctiveActionService.createAction({
        ...createForm,
        defectCode: createForm.defectCode.trim() || undefined,
        machineCode: createForm.machineCode.trim() || undefined,
        rollId: createForm.rollId.trim() || undefined,
      });
      setIsCreateOpen(false);
      setCreateForm({
        title: '',
        stage: 'GREY',
        defectCode: '',
        machineCode: '',
        rollId: '',
        rootCauseCategory: 'MACHINE',
        description: '',
        owner: '',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      fetchActions();
    } catch (err) {
      setCreateError(err.message || 'Failed to create corrective action');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleTransitionAction = async (action, targetStatus) => {
    if (targetStatus === 'VERIFIED') {
      setSelectedAction(action);
      setTransitionStatus('VERIFIED');
      setVerificationNote('');
      setTransitionError(null);
      return;
    }

    try {
      await correctiveActionService.updateAction(action.actionNumber, {
        status: targetStatus,
      });
      fetchActions();
    } catch (err) {
      alert(`Status transition failed: ${err.message}`);
    }
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAction) return;

    setTransitionSubmitting(true);
    setTransitionError(null);

    try {
      await correctiveActionService.updateAction(selectedAction.actionNumber, {
        status: 'VERIFIED',
        verificationNote: verificationNote.trim(),
      });
      setSelectedAction(null);
      fetchActions();
    } catch (err) {
      setTransitionError(err.message || 'Verification update failed');
    } finally {
      setTransitionSubmitting(false);
    }
  };

  // Filtered actions based on search query
  const filteredActions = actions.filter((act) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      act.actionNumber?.toLowerCase().includes(q) ||
      act.title?.toLowerCase().includes(q) ||
      act.machine?.code?.toLowerCase().includes(q) ||
      act.defectCode?.toLowerCase().includes(q) ||
      act.owner?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              <ClipboardList className="w-3.5 h-3.5" />
              Module 4C: Closed-Loop CAPA
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Post-Fix Recurrence Tracker
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-2">Corrective Actions & Preventive Actions</h1>
          <p className="text-xs text-slate-500 mt-1">
            Eradicate process defects at the root machine workcenter and track recurrences across live inspection records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/quality"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 shadow-xs transition-all"
          >
            <span>Control Tower</span>
          </Link>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Open New CAPA</span>
          </button>

          <button
            onClick={fetchActions}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-xs transition-all"
            title="Refresh CAPA Actions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: '', label: 'All Actions' },
            { id: 'OPEN', label: 'Open' },
            { id: 'IN_PROGRESS', label: 'In Progress' },
            { id: 'DONE', label: 'Done (Pending Verification)' },
            { id: 'VERIFIED', label: 'Verified & Closed' },
          ].map((chip) => {
            const isSelected = statusFilter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => {
                  setStatusFilter(chip.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Live Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action #, machine, owner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Main List / Table */}
      {loading ? (
        <LoadingState message="Loading corrective actions..." />
      ) : error ? (
        <ErrorState title="Failed to retrieve corrective actions" error={error} onRetry={fetchActions} />
      ) : filteredActions.length === 0 ? (
        <EmptyState
          title="No corrective actions found"
          description="Zero CAPA actions match your search and filter criteria."
          icon={ClipboardList}
          action={
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create first CAPA</span>
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {filteredActions.map((act) => {
              const isOverdue = new Date(act.dueDate) < new Date() && act.status !== 'VERIFIED';
              const rec = act.recurrence || {};

              return (
                <div
                  key={act._id}
                  className={`bg-white border rounded-2xl p-5 shadow-sm space-y-3 transition-all ${
                    rec.verificationFailed
                      ? 'border-rose-400 ring-2 ring-rose-300/40 bg-rose-50/10'
                      : rec.recurred
                      ? 'border-amber-300 bg-amber-50/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono font-bold text-slate-900 text-sm bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                        {act.actionNumber}
                      </span>
                      <StatusBadge type="actionStatus" value={act.status} />
                      <StatusBadge type="stage" value={act.stage} />
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {act.rootCauseCategory}
                      </span>
                      {isOverdue && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                          Overdue
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                      <span>Owner: <strong>{act.owner}</strong></span>
                      <span>• Due: {formatDate(act.dueDate)}</span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-900 text-sm">{act.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{act.description}</p>
                  </div>

                  {/* Machine & Defect Metadata Tags */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    {act.machine && (
                      <div className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-slate-400" />
                        <span>Machine:</span>
                        <strong className="text-slate-800">{act.machine.code} ({act.machine.name})</strong>
                      </div>
                    )}
                    {act.defectCode && (
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                        <span>Target Defect:</span>
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {act.defectCode}
                        </span>
                      </div>
                    )}
                    {act.sourceRoll && (
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span>Source Roll:</span>
                        <Link to={`/rolls/${act.sourceRoll.rollId}`} className="font-mono text-teal-700 hover:underline">
                          {act.sourceRoll.rollId}
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Post-Fix Recurrence Tracker Card */}
                  {act.status === 'DONE' || act.status === 'VERIFIED' ? (
                    <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                      rec.verificationFailed
                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                        : rec.recurred
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5">
                          {rec.recurred ? (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          <span>Post-Fix Defect Recurrence Tracker</span>
                        </span>
                        {rec.recurrencesSinceFix > 0 ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900">
                            {rec.recurrencesSinceFix} Recurrence(s)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                            Zero Recurrences
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">{rec.explanation}</p>
                    </div>
                  ) : null}

                  {/* Verification Note if closed */}
                  {act.status === 'VERIFIED' && act.verificationNote && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Verification Sign-off Note:
                      </span>
                      <p className="italic text-slate-600 pl-5">"{act.verificationNote}"</p>
                    </div>
                  )}

                  {/* Action State Transition Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      Created on {formatDate(act.createdAt)}
                    </span>

                    <div className="flex items-center gap-2">
                      {act.status === 'OPEN' && (
                        <button
                          onClick={() => handleTransitionAction(act, 'IN_PROGRESS')}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-all"
                        >
                          Start Investigation (IN_PROGRESS)
                        </button>
                      )}

                      {act.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleTransitionAction(act, 'DONE')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs"
                        >
                          Mark Fix Completed (DONE)
                        </button>
                      )}

                      {act.status === 'DONE' && (
                        <>
                          <button
                            onClick={() => handleTransitionAction(act, 'IN_PROGRESS')}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all"
                          >
                            Re-open
                          </button>
                          <button
                            onClick={() => handleTransitionAction(act, 'VERIFIED')}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verify & Close</span>
                          </button>
                        </>
                      )}

                      {act.status === 'VERIFIED' && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Action Resolved & Terminal</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE NEW CAPA MODAL */}
      {/* ========================================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Open New Corrective Action (CAPA)</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Action Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Re-align stenter guider to prevent selvage dye streaks"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Origin Stage *</label>
                  <select
                    value={createForm.stage}
                    onChange={(e) => setCreateForm({ ...createForm, stage: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="GREY">Grey Weaving / Knitting</option>
                    <option value="DYEING">Dyeing & Processing</option>
                    <option value="FINISHING">Finishing Range</option>
                    <option value="FINAL">Final Inspection</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Root Cause Category *</label>
                  <select
                    value={createForm.rootCauseCategory}
                    onChange={(e) => setCreateForm({ ...createForm, rootCauseCategory: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    {ROOT_CAUSES.map((rc) => (
                      <option key={rc} value={rc}>{rc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Machine Workcenter</label>
                  <select
                    value={createForm.machineCode}
                    onChange={(e) => setCreateForm({ ...createForm, machineCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- None / Factory Wide --</option>
                    {machinesList.map((m) => (
                      <option key={m.code} value={m.code}>{m.code} ({m.name})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Defect Code</label>
                  <input
                    type="text"
                    placeholder="e.g. WEFT_BAR, DYE_STAIN"
                    value={createForm.defectCode}
                    onChange={(e) => setCreateForm({ ...createForm, defectCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Detailed Root Cause & Action Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain the technical root cause mechanism and preventative engineering steps..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Lead Owner *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh K. (Maintenance Lead)"
                    value={createForm.owner}
                    onChange={(e) => setCreateForm({ ...createForm, owner: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Due Date *</label>
                  <input
                    type="date"
                    required
                    value={createForm.dueDate}
                    onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs transition-all disabled:opacity-50"
                >
                  {createSubmitting ? 'Opening CAPA...' : 'Open CAPA Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VERIFICATION SIGN-OFF MODAL */}
      {/* ========================================================================= */}
      {selectedAction && transitionStatus === 'VERIFIED' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Verify & Close CAPA</h3>
              </div>
              <button
                onClick={() => setSelectedAction(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Action <strong className="font-mono">{selectedAction.actionNumber}</strong>: {selectedAction.title}
            </p>

            {transitionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {transitionError}
              </div>
            )}

            <form onSubmit={handleVerificationSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Verification Note & Proof of Elimination *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Document physical calibration results, test run rolls, and technician sign-off..."
                  value={verificationNote}
                  onChange={(e) => setVerificationNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedAction(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transitionSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-all disabled:opacity-50"
                >
                  {transitionSubmitting ? 'Closing...' : 'Sign & Close Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorrectiveActions;
