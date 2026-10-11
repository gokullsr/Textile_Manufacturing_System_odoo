import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getOrderByNumber,
  updateOrder,
  deleteOrder
} from '../services/orderService';
import { getRolls } from '../services/rollService';
import StatusBadge from '../components/StatusBadge';
import ProgressBar from '../components/ProgressBar';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import {
  formatNumber,
  formatDate,
  formatRelativeDays
} from '../utils/formatters';
import {
  ArrowLeft,
  Calendar,
  Layers,
  Cpu,
  User,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Edit3,
  Save,
  FileText,
  TrendingUp,
  QrCode,
  ExternalLink,
  Plus,
  Trash2,
  Ban,
  RotateCcw,
  X
} from 'lucide-react';

export const OrderDetail = () => {
  const { orderNumber } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [rolls, setRolls] = useState([]);
  const [rollsLoading, setRollsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [producedInput, setProducedInput] = useState('');
  const [statusInput, setStatusInput] = useState('');
  const [patchLoading, setPatchLoading] = useState(false);
  const [patchSuccess, setPatchSuccess] = useState(false);
  const [patchError, setPatchError] = useState(null);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrderAndRolls = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await getOrderByNumber(orderNumber);

      setOrder(res.order);
      setProducedInput(res.order.producedQuantity);
      setStatusInput(res.order.status);

      setRollsLoading(true);

      const rollsRes = await getRolls({
        orderNumber: res.order.orderNumber,
        limit: 50
      });

      setRolls(rollsRes.rolls || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setRollsLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    fetchOrderAndRolls();
  }, [fetchOrderAndRolls]);

  const handlePatchSubmit = async (e) => {
    e.preventDefault();

    setPatchLoading(true);
    setPatchError(null);
    setPatchSuccess(false);

    try {
      const updates = {
        producedQuantity: Number(producedInput),
        status: statusInput
      };

      const res = await updateOrder(orderNumber, updates);

      setOrder(res.order);
      setProducedInput(res.order.producedQuantity);
      setStatusInput(res.order.status);
      setPatchSuccess(true);
      setIsEditing(false);

      setTimeout(() => setPatchSuccess(false), 4000);
    } catch (err) {
      setPatchError(err.message || 'Failed to update order');
    } finally {
      setPatchLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    setActionLoading(true);
    setPatchError(null);

    try {
      const res = await updateOrder(orderNumber, {
        status: 'cancelled'
      });

      setOrder(res.order);
      setStatusInput('cancelled');
      setIsCancelModalOpen(false);
      setPatchSuccess(true);

      setTimeout(() => setPatchSuccess(false), 4000);
    } catch (err) {
      setPatchError(err.message || 'Failed to cancel order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOrder = async () => {
    setActionLoading(true);
    setPatchError(null);

    try {
      await deleteOrder(orderNumber);
      setIsDeleteModalOpen(false);
      navigate('/orders');
    } catch (err) {
      setPatchError(err.message || 'Failed to delete order');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <LoadingState
        message={`Fetching details for ${orderNumber}...`}
      />
    );
  }

  if (error) {
    if (error.status === 404 || error.code === 'ORDER_NOT_FOUND') {
      return (
        <EmptyState
          title="Order Not Found"
          description={`No production order exists with order number '${orderNumber}'.`}
          action={
            <Link
              to="/orders"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Orders List</span>
            </Link>
          }
        />
      );
    }

    return (
      <ErrorState
        title="Failed to load order details"
        error={error}
        onRetry={fetchOrderAndRolls}
      />
    );
  }

  if (!order) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Top Back Navigation & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Orders</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Update Progress (Live PATCH)</span>
              </button>

              {order.status !== 'cancelled' && (
                <button
                  onClick={() => setIsCancelModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition-all"
                  title="Revoke and cancel this order"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Revoke / Cancel</span>
                </button>
              )}

              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-all"
                title="Permanently delete order"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setIsEditing(false);
                setProducedInput(order.producedQuantity);
                setStatusInput(order.status);
                setPatchError(null);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {patchSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs font-medium shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>
            Order updated successfully in MongoDB! Dashboard KPIs and live delay metrics have recalculated.
          </span>
        </div>
      )}

      {/* Error Notification */}
      {patchError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-800 text-xs font-medium shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{patchError}</span>
        </div>
      )}

      {/* Live PATCH Editing Form */}
      {isEditing && (
        <form
          onSubmit={handlePatchSubmit}
          className="bg-white border-2 border-teal-500/40 rounded-2xl p-6 shadow-md space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Update Production Quantities
              </h3>

              <p className="text-xs text-slate-500">
                Directly updates{' '}
                <code className="text-teal-700 font-mono">
                  PATCH /api/orders/{order.orderNumber}
                </code>
              </p>
            </div>

            <span className="text-xs text-teal-700 font-mono font-bold">
              Target: {order.requiredQuantity} {order.unit}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Produced Quantity ({order.unit})
              </label>

              <input
                type="number"
                min="0"
                max={order.requiredQuantity}
                value={producedInput}
                onChange={(e) => setProducedInput(e.target.value)}
                required
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white"
              />

              <span className="text-[11px] text-slate-500 mt-1 block">
                Reaching {order.requiredQuantity} automatically sets status to 'completed'.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Work Order Status
              </label>

              <select
                value={statusInput}
                onChange={(e) => setStatusInput(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white"
              >
                <option value="queued">Queued</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={patchLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>
                {patchLoading ? 'Saving...' : 'Apply Live Changes'}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Main Order Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold font-mono text-slate-900">
                {order.orderNumber}
              </h1>

              <StatusBadge type="order" value={order.status} />

              {order.delayStatus && (
                <StatusBadge type="delay" value={order.delayStatus} />
              )}
            </div>

            <p className="text-sm text-slate-600 mt-1">
              Fabric Work Order for{' '}
              <strong className="text-slate-900">
                {order.customer}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700">
              <span className="text-slate-500 mr-1.5">Priority:</span>
              <strong className="text-slate-900 uppercase tracking-wider font-semibold">
                {order.priority}
              </strong>
            </div>
          </div>
        </div>

        {/* Delay Reason Notice */}
        {order.reason && (
          <div className="mt-6 p-4 rounded-xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />

              <div>
                <span className="font-bold block text-amber-800 text-xs uppercase tracking-wider">
                  Delay Radar Estimate
                </span>

                <p className="text-sm mt-0.5 font-medium text-slate-800">
                  {order.reason}
                </p>
              </div>
            </div>

            <Link
              to={`/delay-radar/${order.orderNumber}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs whitespace-nowrap transition-all"
            >
              <span>Explain Calculation</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Production Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block mb-1">
              Required Quantity
            </span>

            <span className="text-2xl font-bold font-mono text-slate-900">
              {formatNumber(order.requiredQuantity)}{' '}
              <span className="text-xs font-normal text-slate-500">
                {order.unit}
              </span>
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block mb-1">
              Produced Quantity
            </span>

            <span className="text-2xl font-bold font-mono text-teal-700">
              {formatNumber(order.producedQuantity)}{' '}
              <span className="text-xs font-normal text-slate-500">
                {order.unit}
              </span>
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block mb-1">
              Remaining Shortfall
            </span>

            <span className="text-2xl font-bold font-mono text-slate-700">
              {formatNumber(order.remainingQuantity)}{' '}
              <span className="text-xs font-normal text-slate-500">
                {order.unit}
              </span>
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <ProgressBar percent={order.progressPercent} size="lg" />
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Fabric Specification */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 pb-3 border-b border-slate-100">
            <Layers className="w-4 h-4 text-teal-600" />
            <span>Fabric Specification</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Buyer / Customer</span>
              <span className="font-bold text-slate-900">
                {order.customer}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Fabric Type</span>
              <span className="font-medium text-slate-800 text-right max-w-[260px]">
                {order.fabricType}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Current Factory Stage</span>
              <span className="font-bold uppercase text-teal-700 tracking-wider">
                {order.currentStage}
              </span>
            </div>

            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Order Unit</span>
              <span className="font-bold text-slate-900">
                {order.unit}
              </span>
            </div>
          </div>
        </div>

        {/* Machine & Schedule Allocation */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 pb-3 border-b border-slate-100">
            <Clock className="w-4 h-4 text-teal-600" />
            <span>Schedule & Workcenter Allocation</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Production Start Date</span>
              <span className="font-medium text-slate-800">
                {formatDate(order.startDate)}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Target Due Date</span>
              <span className="font-bold text-slate-900">
                {formatDate(order.dueDate)} ({formatRelativeDays(order.daysRemaining)})
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Assigned Machine</span>

              {order.assignedMachine ? (
                <span className="font-mono text-teal-700 font-bold">
                  {order.assignedMachine.code} ({order.assignedMachine.name})
                </span>
              ) : (
                <span className="text-slate-400 italic">
                  Unassigned (Loom allocation pending)
                </span>
              )}
            </div>

            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Created In System</span>
              <span className="text-slate-600">
                {formatDate(order.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Fabric Rolls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-teal-600" />

            <div>
              <h2 className="font-bold text-slate-900 text-base">
                Fabric Rolls & Digital Passports
              </h2>

              <p className="text-xs text-slate-500">
                Physical fabric cuts registered under this work order
              </p>
            </div>
          </div>

          <Link
            to="/rolls/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Roll</span>
          </Link>
        </div>

        {rollsLoading ? (
          <div className="py-6 text-center text-xs text-slate-500">
            Querying linked fabric rolls...
          </div>
        ) : rolls.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No discrete fabric rolls logged for this order yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rolls.map((r) => (
              <Link
                key={r._id}
                to={`/rolls/${r.rollId}`}
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-teal-500/50 transition-all flex flex-col justify-between space-y-2 group shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900 text-xs group-hover:text-teal-700">
                    {r.rollId}
                  </span>

                  <StatusBadge
                    type="quality"
                    value={r.qualityStatus}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-medium">
                    {formatNumber(r.quantityMetres)} m
                  </span>

                  <StatusBadge
                    type="dispatch"
                    value={r.dispatchStatus}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Operational Notes */}
      {order.notes && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <span>Manufacturing Batch Instructions</span>
          </h2>

          <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
            {order.notes}
          </p>
        </div>
      )}

      {/* Cancel Order Confirmation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-amber-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                  <Ban className="w-5 h-5" />
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Revoke & Cancel Order?
                  </h3>

                  <p className="text-xs text-slate-500">
                    Halts active manufacturing & releases machine allocation.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-sans">
                <div className="font-mono font-bold text-slate-900">
                  {order.orderNumber}
                </div>

                <div className="text-slate-700 font-semibold">
                  {order.customer} — {order.fabricType}
                </div>

                <div className="text-slate-500">
                  Target: {formatNumber(order.requiredQuantity)} {order.unit} |
                  Produced: {formatNumber(order.producedQuantity)} {order.unit}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200"
                >
                  Keep Order Active
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleCancelOrder}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Cancelling...' : 'Confirm Revocation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Order Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-rose-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Permanently Delete Order?
                  </h3>

                  <p className="text-xs text-slate-500">
                    This action permanently removes the record from MongoDB.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-sans">
                <div className="font-mono font-bold text-slate-900">
                  {order.orderNumber}
                </div>

                <div className="text-slate-700 font-semibold">
                  {order.customer}
                </div>

                <div className="text-rose-600 font-semibold">
                  ⚠️ This cannot be undone.
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleDeleteOrder}
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

export default OrderDetail;
