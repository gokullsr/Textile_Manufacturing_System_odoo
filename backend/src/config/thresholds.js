/**
 * Central configuration for operational business rule thresholds.
 * Easily tunable parameters for delay detection, stock warning levels, pagination, and fabric roll limits.
 */
module.exports = {
  // Number of percentage points behind expected progress required to trigger 'at_risk'
  AT_RISK_LAG_PERCENT_POINTS: 15,

  // Days before due date when an 'on_hold' order gets flagged as 'at_risk'
  ON_HOLD_RISK_DAYS: 7,

  // Default and maximum pagination limits
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },

  // Fabric Roll Business Limits
  ROLL_LIMITS: {
    MIN_QUANTITY_METRES: 0.01,
    MAX_QUANTITY_METRES: 5000,
    MAX_DECIMAL_PLACES: 2,
    MAX_DEFECT_NOTES_LENGTH: 500,
    MAX_INSPECTOR_NAME_LENGTH: 80,
  },

  // Roll ID Validation Regex (3 to 40 uppercase alphanumeric and hyphens)
  ROLL_ID_REGEX: /^[A-Z0-9][A-Z0-9-]{2,39}$/,

  // Allowed sort fields for orders list
  ALLOWED_ORDER_SORT_FIELDS: [
    'orderNumber',
    'dueDate',
    'startDate',
    'createdAt',
    'status',
    'quantity',
    'requiredQuantity',
    'producedQuantity',
    'customer',
    'priority',
  ],

  // Allowed sort fields for rolls list
  ALLOWED_ROLL_SORT_FIELDS: [
    'rollId',
    'createdAt',
    'producedAt',
    'inspectedAt',
    'quantityMetres',
    'qualityStatus',
    'dispatchStatus',
  ],
};
