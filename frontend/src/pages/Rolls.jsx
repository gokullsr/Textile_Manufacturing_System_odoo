import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getRolls } from '../services/rollService';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { formatNumber, formatDate } from '../utils/formatters';
import { QrCode, Plus, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

export const Rolls = () => {
  const [rolls, setRolls] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [dispatchFilter, setDispatchFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchRollsList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRolls({
        search: searchTerm,
        qualityStatus: qualityFilter,
        dispatchStatus: dispatchFilter,
        page,
        limit: 15,
      });
      setRolls(res.rolls || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, qualityFilter, dispatchFilter, page]);

  useEffect(() => {
    fetchRollsList();
  }, [fetchRollsList]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Module 2: Traceability</span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Fabric Roll Digital Passports</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            QR digital identity registry for physical fabric rolls, quality inspection history, and dispatch gating.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/rolls/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Generate New Roll</span>
          </Link>

          <button
            onClick={fetchRollsList}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-xs transition-all"
            title="Refresh roll registry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by Roll ID (e.g. FR-2026-000001)..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <select
            value={qualityFilter}
            onChange={(e) => {
              setQualityFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-teal-500"
          >
            <option value="">All Quality Grades</option>
            <option value="PASS">PASS</option>
            <option value="PENDING">PENDING</option>
            <option value="REWORK">REWORK</option>
            <option value="REJECT">REJECT</option>
          </select>

          <select
            value={dispatchFilter}
            onChange={(e) => {
              setDispatchFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-teal-500"
          >
            <option value="">All Dispatch States</option>
            <option value="NOT_DISPATCHED">Not Dispatched</option>
            <option value="READY_FOR_DISPATCH">Ready for Dispatch</option>
            <option value="DISPATCHED">Dispatched</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <LoadingState message="Loading fabric roll passports..." />
      ) : error ? (
        <ErrorState title="Failed to retrieve fabric rolls" error={error} onRetry={fetchRollsList} />
      ) : rolls.length === 0 ? (
        <EmptyState
          title="No fabric rolls found"
          description="No rolls match the selected filters or search terms."
          icon={QrCode}
          action={
            <Link
              to="/rolls/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create first roll</span>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase font-bold tracking-wider">
                  <th className="py-3.5 px-4">Roll ID (QR)</th>
                  <th className="py-3.5 px-4">Production Order</th>
                  <th className="py-3.5 px-4">Machine</th>
                  <th className="py-3.5 px-4">Quantity (m)</th>
                  <th className="py-3.5 px-4">Quality Status</th>
                  <th className="py-3.5 px-4">Dispatch Status</th>
                  <th className="py-3.5 px-4">Last Inspected</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rolls.map((roll) => (
                  <tr
                    key={roll._id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      <Link
                        to={`/rolls/${roll.rollId}`}
                        className="hover:text-teal-600 flex items-center gap-1.5"
                      >
                        <QrCode className="w-4 h-4 text-teal-600" />
                        <span>{roll.rollId}</span>
                      </Link>
                    </td>

                    <td className="py-3.5 px-4">
                      {roll.order ? (
                        <div>
                          <span className="font-mono font-bold text-slate-900">{roll.order.orderNumber}</span>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[180px]">
                            {roll.order.buyer}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {roll.machine?.machineCode || roll.machine?.code || '—'}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {formatNumber(roll.quantityMetres)} <span className="text-xs font-normal text-slate-500">m</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusBadge type="quality" value={roll.qualityStatus} />
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusBadge type="dispatch" value={roll.dispatchStatus} />
                    </td>

                    <td className="py-3.5 px-4 text-slate-500">
                      {roll.inspectedAt ? formatDate(roll.inspectedAt) : 'Pending inspection'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/rolls/${roll.rollId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-700 text-xs font-semibold border border-slate-200 hover:border-teal-600 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Passport</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Card View (< 1024px) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
            {rolls.map((roll) => (
              <Link
                key={roll._id}
                to={`/rolls/${roll.rollId}`}
                className="block bg-white border border-slate-200 hover:border-teal-500/50 rounded-2xl p-5 shadow-xs hover:shadow-md space-y-3 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-teal-600" />
                    <span className="font-mono font-bold text-slate-900 text-sm">{roll.rollId}</span>
                  </div>
                  <StatusBadge type="quality" value={roll.qualityStatus} />
                </div>

                <div className="text-xs text-slate-600">
                  <span>Order: </span>
                  <strong className="text-slate-900 font-mono">{roll.order?.orderNumber}</strong> ({roll.order?.buyer})
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100">
                  <div>
                    <span className="text-slate-500 block">Length:</span>
                    <strong className="font-mono text-slate-900 text-sm">{formatNumber(roll.quantityMetres)} m</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Machine:</span>
                    <strong className="font-mono text-teal-700">{roll.machine?.machineCode || roll.machine?.code}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500">Dispatch:</span>
                  <StatusBadge type="dispatch" value={roll.dispatchStatus} />
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white border border-slate-200 px-4 py-3 rounded-xl text-xs text-slate-600 shadow-xs">
              <span>
                Showing page <strong className="text-slate-900">{pagination.page}</strong> of{' '}
                <strong className="text-slate-900">{pagination.totalPages}</strong> ({pagination.total} rolls)
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="p-1.5 rounded-lg bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Rolls;
