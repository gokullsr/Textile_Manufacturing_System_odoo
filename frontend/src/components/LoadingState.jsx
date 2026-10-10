import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingState = ({ message = 'Loading factory data...' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="p-3 rounded-2xl bg-teal-50 text-teal-600 mb-4 border border-teal-200 shadow-xs">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
      <p className="text-slate-800 text-sm font-semibold">{message}</p>
      <p className="text-slate-500 text-xs mt-1">Querying LoomIQ production backend...</p>
    </div>
  );
};

export default LoadingState;
