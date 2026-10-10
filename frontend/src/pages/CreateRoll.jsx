import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createRoll } from '../services/rollService';
import { getOrders } from '../services/orderService';
import { getMachines } from '../services/machineService';
import LoadingState from '../components/LoadingState';
import { ArrowLeft, PlusCircle, AlertTriangle, QrCode } from 'lucide-react';

export const CreateRoll = () => {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [machines, setMachines] = useState([]);
  const [fetchingOptions, setFetchingOptions] = useState(true);

  // Form State
  const [orderNumber, setOrderNumber] = useState('');
  const [machineCode, setMachineCode] = useState('');
  const [quantityMetres, setQuantityMetres] = useState('');
  const [weight, setWeight] = useState('');
  const [rollId, setRollId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    const fetchOptions = async () => {
      setFetchingOptions(true);
      try {
        const [ordersRes, machinesRes] = await Promise.all([
          getOrders({ limit: 50 }),
          getMachines(),
        ]);
        const availableOrders = ordersRes.orders || [];
        setOrders(availableOrders);
        if (availableOrders.length > 0) {
          setOrderNumber(availableOrders[0].orderNumber);
        }

        const availableMachines = machinesRes.machines || [];
        setMachines(availableMachines);
        if (availableMachines.length > 0) {
          setMachineCode(availableMachines[0].code || availableMachines[0].machineCode);
        }
      } catch (err) {
        setServerError('Failed to load active orders and machines. Please verify server is running.');
      } finally {
        setFetchingOptions(false);
      }
    };

    fetchOptions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setServerError(null);

    const payload = {
      orderNumber,
      machineCode,
      quantityMetres: Number(quantityMetres),
    };

    if (weight) payload.weight = Number(weight);
    if (rollId.trim()) payload.rollId = rollId.trim().toUpperCase();

    try {
      const res = await createRoll(payload);
      if (res.roll?.rollId) {
        navigate(`/rolls/${res.roll.rollId}`);
      } else {
        navigate('/rolls');
      }
    } catch (err) {
      setServerError(err.message || 'Failed to create fabric roll.');
    } finally {
      setSubmitting(false);
    }
  };

  if (fetchingOptions) {
    return <LoadingState message="Loading factory work orders and machine stations..." />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Back Nav */}
      <Link
        to="/rolls"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Fabric Roll Registry</span>
      </Link>

      {/* Main Form Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Generate Fabric Roll Passport</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign digital identity, link parent work order, and allocate manufacturing loom/vat.
              </p>
            </div>
          </div>
        </div>

        {serverError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Order Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Production Work Order <span className="text-rose-500">*</span>
            </label>
            <select
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-mono"
            >
              {orders.map((ord) => (
                <option key={ord.orderNumber} value={ord.orderNumber}>
                  {ord.orderNumber} — {ord.customer} ({ord.fabricType})
                </option>
              ))}
            </select>
          </div>

          {/* Machine Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Originating Machine Workcenter <span className="text-rose-500">*</span>
            </label>
            <select
              value={machineCode}
              onChange={(e) => setMachineCode(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-mono"
            >
              {machines.map((m) => {
                const code = m.code || m.machineCode;
                return (
                  <option key={m._id} value={code}>
                    {code} — {m.name} ({m.type?.replace('_', ' ')})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Quantity Metres */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Roll Length in Metres <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="5000"
              placeholder="e.g. 125.50"
              value={quantityMetres}
              onChange={(e) => setQuantityMetres(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Between 0.01 m and 5,000.00 m (max 2 decimal places).</span>
          </div>

          {/* Optional Weight */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Roll Weight (kg) <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 24.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Optional Custom Roll ID */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Custom Roll ID <span className="text-slate-400 font-normal">(Optional — server auto-generates if blank)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. FR-2026-000099"
              value={rollId}
              onChange={(e) => setRollId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono uppercase text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <Link
              to="/rolls"
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{submitting ? 'Registering Passport...' : 'Create & Open Passport'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoll;
