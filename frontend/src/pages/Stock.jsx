import React, { useState, useEffect, useCallback } from 'react';
import { getStock, createStock, updateStock, deleteStock } from '../services/stockService';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { formatNumber } from '../utils/formatters';
import {
  Boxes,
  RefreshCw,
  AlertOctagon,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  ArrowDownCircle,
  PackagePlus,
} from 'lucide-react';

const STOCK_UNITS = ['kg', 'meters', 'liters', 'cones', 'bags', 'rolls'];

export const Stock = () => {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [levelFilter, setLevelFilter] = useState('');

  // Notification Banner
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null); // item being edited
  const [deleteItem, setDeleteItem] = useState(null); // item being deleted

  // Add Item Form State
  const [addForm, setAddForm] = useState({
    sku: '',
    name: '',
    quantityOnHand: '',
    unit: 'kg',
    reorderLevel: '100',
    supplier: '',
  });
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Adjust Form State
  const [adjustForm, setAdjustForm] = useState({
    quantityOnHand: '',
    reorderLevel: '',
    name: '',
    supplier: '',
  });
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Delete Action State
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchStockList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStock(levelFilter);
      setStock(res.stock || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [levelFilter]);

  useEffect(() => {
    fetchStockList();
  }, [fetchStockList]);

  // Handle Add Item Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.sku.trim()) {
      showFeedback('error', 'Material name and SKU are required.');
      return;
    }

    setAddSubmitting(true);
    try {
      await createStock({
        ...addForm,
        quantityOnHand: Number(addForm.quantityOnHand) || 0,
        reorderLevel: Number(addForm.reorderLevel) || 0,
      });
      setIsAddModalOpen(false);
      setAddForm({ sku: '', name: '', quantityOnHand: '', unit: 'kg', reorderLevel: '100', supplier: '' });
      showFeedback('success', `Material ${addForm.sku.toUpperCase()} registered successfully.`);
      fetchStockList();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to register material.');
    } finally {
      setAddSubmitting(false);
    }
  };

  // Open Adjust Modal
  const openAdjustModal = (item) => {
    setAdjustItem(item);
    setAdjustForm({
      quantityOnHand: item.quantityOnHand,
      reorderLevel: item.reorderLevel,
      name: item.name,
      supplier: item.supplier || '',
    });
  };

  // Handle Adjust / Revoke Submit
  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustItem) return;

    setAdjustSubmitting(true);
    try {
      await updateStock(adjustItem._id, {
        quantityOnHand: Number(adjustForm.quantityOnHand),
        reorderLevel: Number(adjustForm.reorderLevel),
        name: adjustForm.name.trim(),
        supplier: adjustForm.supplier.trim(),
      });
      setAdjustItem(null);
      showFeedback('success', `Material ${adjustItem.sku} adjusted successfully.`);
      fetchStockList();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to update stock.');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;

    setDeleteSubmitting(true);
    try {
      await deleteStock(deleteItem._id);
      setDeleteItem(null);
      showFeedback('success', `Material ${deleteItem.sku} (${deleteItem.name}) deleted from inventory.`);
      fetchStockList();
    } catch (err) {
      showFeedback('error', err.message || 'Failed to delete stock item.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const outCount = stock.filter((s) => s.stockLevel === 'out').length;
  const lowCount = stock.filter((s) => s.stockLevel === 'low').length;

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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Inventory Management</span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Material Stock & Reorder Levels</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Raw yarns, reactive dyes, finishing chemicals, and packaging materials with live shortfall computation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Material</span>
          </button>
          <button
            onClick={fetchStockList}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setLevelFilter('')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              levelFilter === ''
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Materials ({stock.length})
          </button>
          <button
            onClick={() => setLevelFilter('warning')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              levelFilter === 'warning'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Critical Warnings ({outCount + lowCount})
          </button>
          <button
            onClick={() => setLevelFilter('out')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              levelFilter === 'out'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Out of Stock ({outCount})
          </button>
          <button
            onClick={() => setLevelFilter('low')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              levelFilter === 'low'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Low Stock ({lowCount})
          </button>
        </div>
      </div>

      {/* Main Stock Table */}
      {loading ? (
        <LoadingState message="Auditing inventory levels..." />
      ) : error ? (
        <ErrorState title="Failed to retrieve stock records" error={error} onRetry={fetchStockList} />
      ) : stock.length === 0 ? (
        <EmptyState
          title="No stock items found"
          description="No materials match the selected inventory status filter."
          icon={Boxes}
          action={
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              Add First Material
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase font-bold tracking-wider">
                  <th className="py-3.5 px-4">SKU / Code</th>
                  <th className="py-3.5 px-4">Material Name</th>
                  <th className="py-3.5 px-4">Quantity on Hand</th>
                  <th className="py-3.5 px-4">Safety Reorder Level</th>
                  <th className="py-3.5 px-4">Inventory Shortfall</th>
                  <th className="py-3.5 px-4">Supplier</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stock.map((item) => (
                  <tr
                    key={item._id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      item.stockLevel === 'out'
                        ? 'bg-rose-50/50'
                        : item.stockLevel === 'low'
                        ? 'bg-amber-50/40'
                        : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{item.sku}</td>

                    <td className="py-3.5 px-4 font-bold text-slate-800">{item.name}</td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {formatNumber(item.quantityOnHand)}{' '}
                      <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {formatNumber(item.reorderLevel)}{' '}
                      <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      {item.shortfall > 0 ? (
                        <span className="text-rose-600 font-bold">
                          -{formatNumber(item.shortfall)} {item.unit}
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium">0 {item.unit} (Surplus)</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500">{item.supplier || '—'}</td>

                    <td className="py-3.5 px-4">
                      <StatusBadge type="stock" value={item.stockLevel} />
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openAdjustModal(item)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 transition-colors"
                          title="Adjust / Revoke Stock Quantity"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteItem(item)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 transition-colors"
                          title="Delete Material Item"
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

          {/* Mobile Card View (< 768px) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {stock.map((item) => (
              <div
                key={item._id}
                className={`p-5 rounded-2xl border shadow-xs space-y-3 ${
                  item.stockLevel === 'out'
                    ? 'bg-rose-50/60 border-rose-200'
                    : item.stockLevel === 'low'
                    ? 'bg-amber-50/50 border-amber-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900">{item.sku}</span>
                  <StatusBadge type="stock" value={item.stockLevel} />
                </div>

                <div className="font-bold text-slate-900 text-sm">{item.name}</div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100">
                  <div>
                    <span className="text-slate-500 block">Stock on Hand:</span>
                    <strong className="font-mono text-slate-900 text-sm">
                      {formatNumber(item.quantityOnHand)} {item.unit}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Reorder Level:</span>
                    <strong className="font-mono text-slate-700">
                      {formatNumber(item.reorderLevel)} {item.unit}
                    </strong>
                  </div>
                </div>

                {item.shortfall > 0 && (
                  <div className="text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>
                      Purchase Shortfall: -{formatNumber(item.shortfall)} {item.unit}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 truncate max-w-[150px]">
                    {item.supplier || 'Standard Mill'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openAdjustModal(item)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200 text-xs inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Adjust</span>
                    </button>
                    <button
                      onClick={() => setDeleteItem(item)}
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
        </div>
      )}

      {/* --- MODAL 1: ADD NEW MATERIAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-slate-900 text-base">Register New Material Stock</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    SKU / Material Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. YARN-COT-40S"
                    value={addForm.sku}
                    onChange={(e) => setAddForm({ ...addForm, sku: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Measurement Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={addForm.unit}
                    onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-teal-600"
                  >
                    {STOCK_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Material Name & Description <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 40s Combed Cotton Yarn - Optical White"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Stock on Hand <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="0"
                    value={addForm.quantityOnHand}
                    onChange={(e) => setAddForm({ ...addForm, quantityOnHand: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Safety Reorder Level <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="100"
                    value={addForm.reorderLevel}
                    onChange={(e) => setAddForm({ ...addForm, reorderLevel: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supplier / Mill Name</label>
                <input
                  type="text"
                  placeholder="e.g. Vardhman Textiles Ltd"
                  value={addForm.supplier}
                  onChange={(e) => setAddForm({ ...addForm, supplier: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-teal-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs disabled:opacity-50"
                >
                  {addSubmitting ? 'Registering...' : 'Save Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: ADJUST / REVOKE STOCK --- */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-teal-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Adjust Stock & Safety Level</h3>
                  <span className="font-mono text-xs text-slate-500 font-bold">{adjustItem.sku}</span>
                </div>
              </div>
              <button
                onClick={() => setAdjustItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Material Name</label>
                <input
                  type="text"
                  value={adjustForm.name}
                  onChange={(e) => setAdjustForm({ ...adjustForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Current Stock ({adjustItem.unit}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={adjustForm.quantityOnHand}
                    onChange={(e) => setAdjustForm({ ...adjustForm, quantityOnHand: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-teal-600"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Set 0 to mark as Out of Stock / Write-off
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reorder Level ({adjustItem.unit}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={adjustForm.reorderLevel}
                    onChange={(e) => setAdjustForm({ ...adjustForm, reorderLevel: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supplier</label>
                <input
                  type="text"
                  value={adjustForm.supplier}
                  onChange={(e) => setAdjustForm({ ...adjustForm, supplier: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-teal-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs disabled:opacity-50"
                >
                  {adjustSubmitting ? 'Updating...' : 'Save Adjustments'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: DELETE MATERIAL CONFIRMATION --- */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-rose-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Delete Material Item?</h3>
                  <p className="text-xs text-slate-500">This action permanently removes this stock record.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="font-mono font-bold text-slate-900">{deleteItem.sku}</div>
                <div className="text-slate-700 font-semibold">{deleteItem.name}</div>
                <div className="text-slate-500">
                  Current Stock: {formatNumber(deleteItem.quantityOnHand)} {deleteItem.unit}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={deleteSubmitting}
                  onClick={() => setDeleteItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteSubmitting}
                  onClick={handleDeleteConfirm}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs disabled:opacity-50"
                >
                  {deleteSubmitting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stock;
