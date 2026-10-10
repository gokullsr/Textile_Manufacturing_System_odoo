import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getMachines } from '../services/machineService';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { Cpu, RefreshCw, ArrowUpRight, Activity } from 'lucide-react';

export const Machines = () => {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchMachineList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMachines(statusFilter);
      setMachines(res.machines || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchMachineList();
  }, [fetchMachineList]);

  const runningCount = machines.filter((m) => m.status === 'running').length;
  const availableCount = machines.filter((m) => m.status === 'available' || m.status === 'idle').length;
  const maintCount = machines.filter((m) => m.status === 'maintenance' || m.status === 'breakdown').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Shopfloor Operations</span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Machine Workcenters</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Real-time status of air-jet looms, rapier weaving stations, dyeing vats, and stenter finishing ranges.
          </p>
        </div>

        <button
          onClick={fetchMachineList}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition-all self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs & Quick Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              statusFilter === ''
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Machines ({machines.length})
          </button>
          <button
            onClick={() => setStatusFilter('running')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              statusFilter === 'running'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Busy / Running ({runningCount})
          </button>
          <button
            onClick={() => setStatusFilter('available')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              statusFilter === 'available'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Available ({availableCount})
          </button>
          <button
            onClick={() => setStatusFilter('maintenance')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              statusFilter === 'maintenance'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Maintenance ({maintCount})
          </button>
        </div>
      </div>

      {/* Machine Cards Grid */}
      {loading ? (
        <LoadingState message="Checking shopfloor machines..." />
      ) : error ? (
        <ErrorState title="Failed to retrieve machine status" error={error} onRetry={fetchMachineList} />
      ) : machines.length === 0 ? (
        <EmptyState
          title="No machines found"
          description="No machines match the selected operational status."
          icon={Cpu}
          action={
            <button
              onClick={() => setStatusFilter('')}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              Show all machines
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {machines.map((m) => (
            <div
              key={m._id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-base">{m.code}</span>
                    <span className="text-[11px] uppercase tracking-wider text-slate-600 font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                      {m.type?.replace('_', ' ')}
                    </span>
                  </div>
                  <StatusBadge type="machine" value={m.status} />
                </div>

                <h3 className="text-sm font-bold text-slate-900">{m.name}</h3>

                <div className="text-xs text-slate-600 mt-2 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-teal-600" />
                  <span>Rated Capacity: <strong className="text-slate-900 font-mono font-bold">{m.capacity} {m.capacityUnit}</strong></span>
                </div>
              </div>

              {/* Current Assigned Order Card */}
              <div className="pt-3 border-t border-slate-100">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block mb-1.5">
                  Assigned Work Order
                </span>

                {m.currentOrder ? (
                  <Link
                    to={`/orders/${m.currentOrder.orderNumber}`}
                    className="block p-3 rounded-xl bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-200 transition-all group"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono font-bold text-teal-700 group-hover:text-teal-800">
                        {m.currentOrder.orderNumber}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600" />
                    </div>
                    <div className="text-xs text-slate-800 font-semibold">{m.currentOrder.buyer}</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{m.currentOrder.fabricType}</div>
                  </Link>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 italic">
                    {m.status === 'maintenance' ? 'Offline for maintenance' : 'Idle — ready for new work order allocation'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Machines;
