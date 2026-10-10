import React, { useState, useEffect, useCallback } from 'react';
import { checkHealth } from '../services/api';
import StatusCard from '../components/StatusCard';
import { 
  Activity, 
  Database, 
  Server, 
  Clock, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Cpu,
  Layers,
  ExternalLink
} from 'lucide-react';

export const HealthDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState(null);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [httpStatus, setHttpStatus] = useState(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await checkHealth();
    setHttpStatus(result.status);
    setLastChecked(new Date());

    if (result.ok) {
      setHealthData(result.data);
      setError(null);
    } else {
      if (result.data) {
        // Received structured response with degraded/error status (e.g. 503)
        setHealthData(result.data);
        setError(result.error || 'System is running in degraded mode');
      } else {
        // Complete network / connection failure
        setHealthData(null);
        setError(result.error || 'Failed to reach backend server');
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const formatUptime = (seconds) => {
    if (seconds === undefined || seconds === null) return 'N/A';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const getSystemBadge = () => {
    if (!healthData) return 'danger';
    if (healthData.status === 'ok') return 'success';
    return 'warning';
  };

  const getDatabaseBadge = () => {
    const dbStatus = healthData?.database?.status;
    if (dbStatus === 'connected') return 'success';
    if (dbStatus === 'connecting' || dbStatus === 'disconnecting') return 'warning';
    return 'danger';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">LoomIQ</h1>
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full bg-sky-950 border border-sky-800/80 text-sky-400">
                  Milestone 1: Foundation
                </span>
              </div>
              <p className="text-xs text-slate-400">Textile Factory Operations & Traceability Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="recheck-health-btn"
              onClick={fetchHealth}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white shadow-md shadow-sky-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Checking...' : 'Recheck'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto w-full px-6 py-8 flex-1">
        {/* Banner Alert if Degraded or Offline */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold block text-rose-300">Operational Notice:</span>
              <p className="mt-0.5 text-rose-200/90">{error}</p>
              {httpStatus === 503 && (
                <p className="text-xs text-rose-300/80 mt-1">
                  HTTP 503 Degraded: Backend server is reachable, but the MongoDB database is currently disconnected.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Top Summary Banner */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-sky-400">System Telemetry</span>
              <h2 className="text-2xl font-bold text-white mt-1">System Health Overview</h2>
              <p className="text-sm text-slate-400 mt-1">
                Real-time connection verification between frontend, Express API gateway, and MongoDB database.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Last checked:{' '}
                  <strong className="text-white font-mono">
                    {lastChecked ? lastChecked.toLocaleTimeString() : 'Pending'}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Metrics Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Backend Status */}
          <StatusCard
            title="Backend Service"
            status={
              loading && !healthData
                ? 'Connecting...'
                : healthData
                ? `${healthData.service} (${healthData.status.toUpperCase()})`
                : 'Offline'
            }
            subtitle={
              healthData
                ? `HTTP Status: ${httpStatus || 200}`
                : 'Backend unreachable on configured URL'
            }
            badgeType={getSystemBadge()}
            icon={Server}
          />

          {/* Database Status */}
          <StatusCard
            title="MongoDB Database"
            status={
              loading && !healthData
                ? 'Checking...'
                : healthData?.database?.status
                ? healthData.database.status.toUpperCase()
                : 'Unknown'
            }
            subtitle={
              healthData?.database?.status === 'connected'
                ? 'Ready for manufacturing transactions'
                : 'Check MONGODB_URI connection string'
            }
            badgeType={getDatabaseBadge()}
            icon={Database}
          />

          {/* Uptime */}
          <StatusCard
            title="Backend Uptime"
            status={healthData ? formatUptime(healthData.uptimeSeconds) : '0s'}
            subtitle={
              healthData?.timestamp
                ? `Server Time: ${new Date(healthData.timestamp).toLocaleTimeString()}`
                : 'Server not reporting'
            }
            badgeType={healthData ? 'default' : 'danger'}
            icon={Activity}
          />

          {/* Environment */}
          <StatusCard
            title="Architecture Scope"
            status="Milestone 1 Ready"
            subtitle="Schemas, Health Endpoint & CORS Active"
            badgeType="success"
            icon={Cpu}
          />
        </div>

        {/* Detailed Inspection Payload View */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-sky-400" />
              <h3 className="font-semibold text-white">Live `/api/health` Payload</h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Target: {import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/health
            </span>
          </div>

          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 overflow-x-auto font-mono text-xs">
            {loading && !healthData ? (
              <div className="flex items-center gap-2 text-slate-400 py-4">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                <span>Polling system endpoint...</span>
              </div>
            ) : healthData ? (
              <pre className="text-emerald-400 leading-relaxed">
                {JSON.stringify(healthData, null, 2)}
              </pre>
            ) : (
              <pre className="text-rose-400">
                {JSON.stringify(
                  {
                    error: {
                      message: error || 'Connection refused',
                      code: 'BACKEND_OFFLINE',
                      solution: 'Ensure backend server is running on port 5000 and MONGODB_URI is provided.',
                    },
                  },
                  null,
                  2
                )}
              </pre>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        <p>LoomIQ Platform &copy; 2026. Built for 24-Hour Textile Operations Hackathon.</p>
      </footer>
    </div>
  );
};

export default HealthDashboard;
