import React from 'react';

/**
 * Reusable StatusCard component for displaying system operational metrics.
 */
export const StatusCard = ({ title, status, subtitle, badgeType = 'default', icon: Icon }) => {
  const getBadgeStyles = () => {
    switch (badgeType) {
      case 'success':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'warning':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'danger':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600';
    }
  };

  const getDotStyles = () => {
    switch (badgeType) {
      case 'success':
        return 'bg-emerald-400 animate-pulse';
      case 'warning':
        return 'bg-amber-400 animate-pulse';
      case 'danger':
        return 'bg-rose-400';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 shadow-lg backdrop-blur-sm transition-all duration-200 hover:border-slate-600">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        {Icon && (
          <div className="p-2 rounded-lg bg-slate-700/50 text-slate-300">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2.5 h-2.5 rounded-full ${getDotStyles()}`} />
        <span className="text-xl font-bold text-white tracking-tight">{status}</span>
      </div>

      {subtitle && (
        <p className="text-xs text-slate-400 mt-2 border-t border-slate-700/40 pt-2">{subtitle}</p>
      )}
    </div>
  );
};

export default StatusCard;
