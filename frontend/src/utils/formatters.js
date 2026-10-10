/**
 * Formatting utilities for dates, numbers, units, and percentages.
 */

export const formatDate = (dateInput) => {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatRelativeDays = (daysRemaining) => {
  if (daysRemaining === undefined || daysRemaining === null) return '—';
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)}d overdue`;
  if (daysRemaining === 0) return 'Due today';
  if (daysRemaining === 1) return 'Due tomorrow';
  return `${daysRemaining}d left`;
};

export const formatNumber = (val) => {
  if (val === undefined || val === null) return '0';
  return Number(val).toLocaleString('en-US');
};

export const formatPercent = (val) => {
  if (val === undefined || val === null) return '0%';
  return `${Math.round(Number(val))}%`;
};
