import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getOrders, createOrder, updateOrder, deleteOrder } from '../services/orderService';
import { getMachines } from '../services/machineService';
import StatusBadge from '../components/StatusBadge';
import ProgressBar from '../components/ProgressBar';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { formatNumber, formatDate, formatRelativeDays } from '../utils/formatters';
import {
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Ban,
} from 'lucide-react';

export const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [delayFilter, setDelayFilter] = useState('');
  const [page, setPage] = useState(1);

  // Quick Action Modals
  const [cancelTarget, setCancelTarget] = useState(null); // order object
  const [deleteTarget, setDeleteTarget] = useState(null); // order object
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Create Order Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableMachines, setAvailableMachines] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);

  const [formData, setFormData] = useState({
    customer: '',
    fabricType: '',
    requiredQuantity: '',
    dueDate: '',
    priority: 'medium',
    machineCode: '',
    currentStage: 'spinning',
    notes: '',
  });

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchOrdersList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getOrders({
        search: searchTerm,
        status: statusFilter,
        delayStatus: delayFilter,
        page,
        limit: 15,
      });
      setOrders(result.orders || []);
      setPagination(result.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, delayFilter, page]);

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setActionLoading(true);
    try {
      await updateOrder(cancelTarget.orderNumber, { status: 'cancelled' });
      setCancelTarget(null);
      showFeedback('success', `Order ${cancelTarget.orderNumber} revoked and cancelled.`);
      fetchOrdersList();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to cancel order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteOrder(deleteTarget.orderNumber);
      setDeleteTarget(null);
      showFeedback('success', `Order ${deleteTarget.orderNumber} deleted successfully.`);
      fetchOrdersList();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to delete order.');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdersList();
  }, [fetchOrdersList]);

  // Load machines for creation modal
  const openCreateModal = async () => {
    setIsModalOpen(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const res = await getMachines();
      const machs = res.machines || [];
      setAvailableMachines(machs);
      if (machs.length > 0 && !formData.machineCode) {
        setFormData((prev) => ({ ...prev, machineCode: machs[0].code || machs[0].machineCode }));
      }
    } catch (e) {
      console.error('Failed to load machines', e);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchOrdersList();
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      const payload = {
        customer: formData.customer.trim(),
        fabricType: formData.fabricType.trim(),
        requiredQuantity: Number(formData.requiredQuantity),
        dueDate: formData.dueDate,
        priority: formData.priority,
        currentStage: formData.currentStage,
      };

      if (formData.machineCode) {
        payload.machineCode = formData.machineCode;
      }
      if (formData.notes.trim()) {
        payload.notes = formData.notes.trim();
      }

      const res = await createOrder(payload);
      setCreateSuccess(`Work order ${res.order?.orderNumber || 'created'} registered in MongoDB!`);
      setTimeout(() => {
        setIsModalOpen(false);
        setCreateSuccess(null);
        setFormData({
          customer: '',
          fabricType: '',
          requiredQuantity: '',
          dueDate: '',
          priority: 'medium',
          machineCode: '',
          currentStage: 'spinning',
          notes: '',
        });
        fetchOrdersList();
      }, 1200);
    } catch (err) {
      setCreateError(err.message || 'Failed to create work order.');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold shadow-sm animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Order Management</span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Production Work Orders</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Monitor real-time work order progress, machine allocations, and delivery timelines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Work Order</span>
          </button>

          <button
            onClick={fetchOrdersList}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by order ID, buyer, or fabric..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition-colors"
          />
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-teal-500 focus:bg-white"
          >
            <option value="">All Statuses</option>
            <option value="in_progress">In Progress</option>
            <option value="queued">Queued</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>

          {/* Delay Status Filter */}
          <select
            value={delayFilter}
            onChange={(e) => {
              setDelayFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-teal-500 focus:bg-white"
          >
            <option value="">All Delay Flags</option>
            <option value="delayed">Delayed (Overdue)</option>
            <option value="at_risk">At Risk</option>
            <option value="on_track">On Track</option>
          </select>
        </div>
      </div>

      {/* Main Table / Card List */}
      {loading ? (
        <LoadingState message="Fetching production orders..." />
      ) : error ? (
        <ErrorState title="Failed to retrieve orders" error={error} onRetry={fetchOrdersList} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No work orders found"
          description="No production orders match the selected search terms or filters."
          action={
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setDelayFilter('');
                setPage(1);
              }}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              Clear all filters
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase font-bold tracking-wider">
                  <th className="py-3.5 px-4">Order ID</th>
                  <th className="py-3.5 px-4">Buyer & Fabric</th>
                  <th className="py-3.5 px-4">Production Progress</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Machine</th>
                  <th className="py-3.5 px-4">Status & Risk</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr
                    key={order.orderNumber}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      <Link to={`/orders/${order.orderNumber}`} className="hover:text-teal-600">
                        {order.orderNumber}
                      </Link>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{order.customer}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[220px]">{order.fabricType}</div>
                    </td>

                    <td className="py-3.5 px-4 w-52">
                      <div className="flex justify-between text-[11px] mb-1 font-mono">
                        <span className="text-slate-900 font-bold">{formatNumber(order.producedQuantity)}</span>
                        <span className="text-slate-500">/ {formatNumber(order.requiredQuantity)} {order.unit}</span>
                      </div>
                      <ProgressBar percent={order.progressPercent} showLabel={false} size="sm" />
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 font-medium">{formatDate(order.dueDate)}</div>
                      <div className="text-[11px] text-slate-500">{formatRelativeDays(order.daysRemaining)}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      {order.assignedMachine ? (
                        <span className="inline-flex items-center gap-1 font-mono text-teal-700 font-bold">
                          {order.assignedMachine.code}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge type="order" value={order.status} />
                        {order.delayStatus && <StatusBadge type="delay" value={order.delayStatus} />}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/orders/${order.orderNumber}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 text-xs font-semibold border border-slate-200 transition-all"
                          title="View order details and history"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </Link>

                        {order.status !== 'cancelled' && (
                          <button
                            onClick={() => setCancelTarget(order)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 transition-colors"
                            title="Revoke / Cancel Work Order"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => setDeleteTarget(order)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 transition-colors"
                          title="Delete Order Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Card View (< 1024px) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
            {orders.map((order) => (
              <div
                key={order.orderNumber}
                className="block bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 transition-all"
              >
                <div className="flex items-center justify-between">
                  <Link
                    to={`/orders/${order.orderNumber}`}
                    className="font-mono font-bold text-slate-900 text-sm hover:text-teal-600"
                  >
                    {order.orderNumber}
                  </Link>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge type="order" value={order.status} />
                    {order.delayStatus && <StatusBadge type="delay" value={order.delayStatus} />}
                  </div>
                </div>

                <div>
                  <div className="font-bold text-slate-900 text-sm">{order.customer}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{order.fabricType}</div>
                </div>

                <div className="py-2 border-y border-slate-100">
                  <div className="flex justify-between text-xs mb-1 font-mono">
                    <span className="text-slate-500">Produced:</span>
                    <span className="text-slate-900 font-bold">
                      {formatNumber(order.producedQuantity)} / {formatNumber(order.requiredQuantity)} {order.unit}
                    </span>
                  </div>
                  <ProgressBar percent={order.progressPercent} size="sm" />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <div>
                    <span>Due: </span>
                    <strong className="text-slate-800">{formatDate(order.dueDate)}</strong>
                  </div>
                  <div>
                    {order.assignedMachine ? (
                      <span className="font-mono text-teal-700 font-bold">{order.assignedMachine.code}</span>
                    ) : (
                      <span className="text-slate-400 italic">No Machine</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <Link
                    to={`/orders/${order.orderNumber}`}
                    className="text-xs font-bold text-teal-700 hover:underline inline-flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Detail</span>
                  </Link>
                  <div className="flex items-center gap-1.5">
                    {order.status !== 'cancelled' && (
                      <button
                        onClick={() => setCancelTarget(order)}
                        className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 inline-flex items-center gap-1"
                      >
                        <Ban className="w-3 h-3" />
                        <span>Revoke</span>
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(order)}
                      className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white border border-slate-200 px-4 py-3 rounded-xl text-xs text-slate-600 shadow-xs">
              <span>
                Showing page <strong className="text-slate-900">{pagination.page}</strong> of{' '}
                <strong className="text-slate-900">{pagination.totalPages}</strong> ({pagination.total} orders)
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

      {/* Create Work Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Create Production Work Order</h2>
                <p className="text-xs text-slate-500 mt-0.5">Register new buyer contract, machine target, and delivery due date.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{createSuccess}</span>
              </div>
            )}

            {createError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Buyer / Customer <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Global Fashion"
                    value={formData.customer}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Fabric Specification <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 100% Linen 200 GSM"
                    value={formData.fabricType}
                    onChange={(e) => setFormData({ ...formData, fabricType: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Required Quantity (metres) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 5000"
                    value={formData.requiredQuantity}
                    onChange={(e) => setFormData({ ...formData, requiredQuantity: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Delivery Due Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Order Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Assigned Machine</label>
                  <select
                    value={formData.machineCode}
                    onChange={(e) => setFormData({ ...formData, machineCode: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-mono"
                  >
                    <option value="">-- Auto/Unassigned --</option>
                    {availableMachines.map((m) => {
                      const code = m.code || m.machineCode;
                      return (
                        <option key={m._id} value={code}>
                          {code} ({m.name})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Factory Stage</label>
                  <select
                    value={formData.currentStage}
                    onChange={(e) => setFormData({ ...formData, currentStage: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                  >
                    <option value="spinning">Spinning</option>
                    <option value="weaving">Weaving</option>
                    <option value="dyeing">Dyeing</option>
                    <option value="finishing">Finishing</option>
                    <option value="inspection">Inspection</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Production Notes & Instructions <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows="2"
                  placeholder="Special warp tensions, dye vat numbers, or shipping packaging notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{createLoading ? 'Registering...' : 'Create Order'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CANCEL / REVOKE ORDER CONFIRMATION --- */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-amber-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Revoke & Cancel Order?</h3>
                  <p className="text-xs text-slate-500">Halts active manufacturing & frees loom allocation.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-sans">
                <div className="font-mono font-bold text-slate-900">{cancelTarget.orderNumber}</div>
                <div className="text-slate-700 font-semibold">{cancelTarget.customer} — {cancelTarget.fabricType}</div>
                <div className="text-slate-500">
                  Target: {formatNumber(cancelTarget.requiredQuantity)} {cancelTarget.unit} | Produced: {formatNumber(cancelTarget.producedQuantity)} {cancelTarget.unit}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setCancelTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200"
                >
                  Keep Active
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleCancelConfirm}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Cancelling...' : 'Confirm Revocation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: DELETE ORDER CONFIRMATION --- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-rose-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Permanently Delete Order?</h3>
                  <p className="text-xs text-slate-500">This action permanently deletes the order from MongoDB.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-sans">
                <div className="font-mono font-bold text-slate-900">{deleteTarget.orderNumber}</div>
                <div className="text-slate-700 font-semibold">{deleteTarget.customer}</div>
                <div className="text-rose-600 font-semibold">
                  ⚠️ This cannot be undone.
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleDeleteConfirm}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
