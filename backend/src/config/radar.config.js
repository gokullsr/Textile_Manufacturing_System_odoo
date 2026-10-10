/**
 * Central configuration for LoomIQ Delay Radar calculation engine.
 * Tunable timezone, calendar shift rules, and calculation tolerances.
 */
module.exports = {
  // Factory operating timezone (default: Indian Standard Time Asia/Kolkata)
  FACTORY_TIMEZONE: process.env.FACTORY_TIMEZONE || 'Asia/Kolkata',

  // Non-working days of the week (0 = Sun, 1 = Mon, ..., 6 = Sat).
  // Default empty array [] signifies a standard 7-day continuous textile mill operation.
  NON_WORKING_WEEKDAYS: [],

  // Floating-point comparison tolerance to prevent precision boundary issues
  TOLERANCE: 1e-9,
};
