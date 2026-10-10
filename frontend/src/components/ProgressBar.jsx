
import React from 'react';

export const ProgressBar = ({ percent = 0, showLabel = true, size = 'md', className = '' }) => {
  const clamped = Math.min(100, Math.max(0, Math.round(Number(percent) || 0)));

  const getHeight = () => {
    switch (size) {
      case 'sm': return 'h-1.5';
      case 'lg': return 'h-3';
      default: return 'h-2';
    }
  };

  const getColor = () => {
    if (clamped >= 100) return 'bg-emerald-500';
    if (clamped >= 60) return 'bg-teal-500';
    if (clamped >= 30) return 'bg-sky-500';
    return 'bg-indigo-500';
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs text-slate-600 mb-1 font-medium">
          <span>Progress</span>
          <span className="text-slate-900 font-mono font-semibold">{clamped}%</span>
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/80 ${getHeight()}`}>
        <div
          className={`${getColor()} ${getHeight()} rounded-full transition-all duration-500 ease-out shadow-xs`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
