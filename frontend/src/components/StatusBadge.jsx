import React from 'react';

/**
 * Universal StatusBadge component for LoomIQ platform (Light Theme).
 * Supports Order statuses, Delay flags, Machine operational states, Stock alerts,
 * Quality inspection grades, and Dispatch lifecycle states.
 */
export const StatusBadge = ({ type = 'order', value, className = '' }) => {
  if (!value) return null;

  const normalized = String(value).toUpperCase();

  const getBadgeConfig = () => {
    // 1. Quality Inspection Status
    if (type === 'quality' || type === 'qualityStatus') {
      switch (normalized) {
        case 'PASS':
          return { label: 'PASS', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
        case 'REWORK':
          return { label: 'REWORK', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500 animate-pulse' };
        case 'REJECT':
          return { label: 'REJECT', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' };
        case 'PENDING':
        default:
          return { label: 'PENDING', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
      }
    }

    // 2. Dispatch Lifecycle Status
    if (type === 'dispatch' || type === 'dispatchStatus') {
      switch (normalized) {
        case 'DISPATCHED':
          return { label: 'Dispatched', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' };
        case 'READY_FOR_DISPATCH':
          return { label: 'Ready for Dispatch', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500 animate-pulse' };
        case 'NOT_DISPATCHED':
        default:
          return { label: 'Not Dispatched', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };
      }
    }

    // 3. Order Statuses
    if (type === 'order') {
      switch (normalized) {
        case 'IN_PROGRESS':
          return { label: 'In Progress', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500 animate-pulse' };
        case 'COMPLETED':
          return { label: 'Completed', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
        case 'ON_HOLD':
          return { label: 'On Hold', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
        case 'QUEUED':
          return { label: 'Queued', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' };
        case 'CANCELLED':
          return { label: 'Cancelled', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' };
        default:
          return { label: value, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
      }
    }

    // 4. Delay & Radar Statuses
    if (type === 'delay' || type === 'radar') {
      switch (normalized) {
        case 'OVERDUE':
        case 'DELAYED':
          return { label: 'OVERDUE', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500 animate-ping' };
        case 'AT_RISK':
          return { label: 'AT RISK', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500 animate-pulse' };
        case 'ON_TRACK':
          return { label: 'ON TRACK', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
        case 'INSUFFICIENT_DATA':
        case 'INSUFFICIENT_DATA_ORDERS':
          return { label: 'INSUFFICIENT DATA', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
        case 'COMPLETED':
          return { label: 'COMPLETED', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' };
        default:
          return null;
      }
    }

    // 5. Machine States
    if (type === 'machine') {
      switch (normalized) {
        case 'RUNNING':
          return { label: 'Busy (Running)', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500 animate-pulse' };
        case 'AVAILABLE':
        case 'IDLE':
          return { label: 'Available', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
        case 'MAINTENANCE':
        case 'BREAKDOWN':
          return { label: 'Maintenance', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
        case 'OFFLINE':
          return { label: 'Offline', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' };
        default:
          return { label: value, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
      }
    }

    // 6. Stock Levels
    if (type === 'stock') {
      switch (normalized) {
        case 'OUT':
          return { label: 'Out of Stock', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500 animate-pulse' };
        case 'LOW':
          return { label: 'Low Stock', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
        case 'OK':
          return { label: 'Healthy', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
        default:
          return { label: value, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
      }
    }

    return { label: value, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
  };

  const config = getBadgeConfig();
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border} shadow-2xs ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
      <span className="tracking-wide">{config.label}</span>
    </span>
  );
};

export default StatusBadge;
