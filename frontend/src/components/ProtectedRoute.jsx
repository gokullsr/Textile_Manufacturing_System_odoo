import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, RefreshCw } from 'lucide-react';

/**
 * Sanitizes and validates internal redirect paths to prevent open redirect vulnerabilities.
 * @param {string} url
 * @returns {string} Safe relative path or default '/'
 */
export const sanitizeRedirectPath = (url) => {
  if (!url || typeof url !== 'string') return '/';
  const trimmed = url.trim();

  // Must begin with a single '/' and not '//' or '/\' or containing protocol '://'
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/\\') &&
    !trimmed.includes('://') &&
    !trimmed.toLowerCase().startsWith('javascript:')
  ) {
    return trimmed;
  }

  return '/';
};

export const ProtectedRoute = ({ children, requiredPermission = null, ownerOnly = false }) => {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-4 animate-pulse">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-slate-400 text-sm font-medium">Verifying factory authorization...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    const nextPath = location.pathname + location.search;
    return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
  }

  if (ownerOnly && user?.role !== 'owner') {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 bg-white border border-rose-200 rounded-2xl shadow-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Owner Privilege Required</h2>
        <p className="text-sm text-slate-600 mb-6">
          This operation is restricted exclusively to project owners. Your current role is <strong className="uppercase">{user?.role}</strong>.
        </p>
        <a
          href="/"
          className="inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Return to Dashboard
        </a>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 bg-white border border-amber-200 rounded-2xl shadow-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-600 mb-6">
          You do not have the required permission (<code>{requiredPermission}</code>) to view or perform actions on this resource.
        </p>
        <a
          href="/"
          className="inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Return to Dashboard
        </a>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
