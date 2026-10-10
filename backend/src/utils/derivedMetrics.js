const { evaluateOrderRisk } = require('./delayRadarEngine');

/**
 * Escapes regex special characters to prevent ReDoS or injection when searching.
 */
const escapeRegex = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Calculates derived metrics for a production order using the Delay Radar Engine as single source of truth.
 * @param {Object} order - Plain production order object or document
 * @param {Date} [referenceDate=new Date()] - Reference date for deterministic time calculations
 * @returns {Object} Enriched order with progressPercent, remainingQuantity, delayStatus, reason, and daysRemaining
 */
const calculateOrderMetrics = (order, referenceDate = new Date()) => {
  const reqQty = Number(order.requiredQuantity ?? order.quantity) || 1;
  const prodQty = Number(order.producedQuantity) || 0;

  // 1. Compute Progress Percentage (clamped 0 - 100)
  const progressPercent = Math.min(100, Math.max(0, Math.round((prodQty / reqQty) * 100)));

  // 2. Delegate to Delay Radar Engine for exact rule-based risk assessment
  const assessment = evaluateOrderRisk(order, referenceDate);

  const status = order.status || 'queued';
  if (status === 'completed' || assessment.status === 'COMPLETED') {
    return {
      progressPercent,
      remainingQuantity: 0,
      delayStatus: null,
      reason: null,
      daysRemaining: 0,
      expectedProgressPercent: 100,
      assessment,
    };
  }

  // Map status for backward compatibility: OVERDUE -> delayed, AT_RISK -> at_risk, ON_TRACK -> on_track, INSUFFICIENT_DATA -> insufficient_data
  let delayStatus = 'on_track';
  if (assessment.status === 'OVERDUE') delayStatus = 'delayed';
  else if (assessment.status === 'AT_RISK') delayStatus = 'at_risk';
  else if (assessment.status === 'INSUFFICIENT_DATA') delayStatus = 'insufficient_data';
  else if (assessment.status === 'ON_TRACK') delayStatus = 'on_track';

  const daysRemaining = assessment.availableProductionDays !== null 
    ? Math.max(0, Math.ceil(assessment.availableProductionDays)) 
    : 0;

  return {
    progressPercent,
    remainingQuantity: assessment.remainingQuantity ?? Math.max(0, reqQty - prodQty),
    delayStatus,
    reason: assessment.reason,
    daysRemaining,
    expectedProgressPercent: progressPercent,
    assessment,
  };
};

/**
 * Calculates stock level status and shortfall.
 * @param {Object} stock - MaterialStock object
 * @returns {Object} { stockLevel: 'out' | 'low' | 'ok', shortfall: number }
 */
const calculateStockMetrics = (stock) => {
  const qty = Number(stock.quantityOnHand) || 0;
  const reorder = Number(stock.reorderLevel) || 0;

  if (qty <= 0) {
    return {
      stockLevel: 'out',
      shortfall: reorder > 0 ? reorder : Math.abs(qty),
    };
  }

  if (qty <= reorder) {
    return {
      stockLevel: 'low',
      shortfall: reorder - qty,
    };
  }

  return {
    stockLevel: 'ok',
    shortfall: 0,
  };
};

module.exports = {
  escapeRegex,
  calculateOrderMetrics,
  calculateStockMetrics,
};
