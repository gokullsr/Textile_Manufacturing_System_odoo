
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const ErrorState = ({ title = 'Failed to load data', error, onRetry }) => {
  const errorMessage = error?.message || (typeof error === 'string' ? error : 'An unexpected network error occurred.');

  return (
    <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 my-4 text-center shadow-xs">
      <div className="inline-flex p-3 rounded-xl bg-rose-100 text-rose-600 mb-3 border border-rose-200">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-rose-900">{title}</h3>
      <p className="text-xs text-rose-700 mt-1 max-w-lg mx-auto font-mono">{errorMessage}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Request</span>
        </button>
      )}
    </div>
  );
};

export default ErrorState;
