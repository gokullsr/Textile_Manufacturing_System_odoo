/**
 * Pure Business Logic Engine for LoomIQ Explainable Delay Radar.
 * Computes deterministic rule-based delay estimates with full mathematical traceability.
 * Zero database or React dependencies — 100% unit testable with injected `now`.
 */
const { FACTORY_TIMEZONE, NON_WORKING_WEEKDAYS, TOLERANCE } = require('../config/radar.config');

/**
 * Calculates the end-of-day deadline (23:59:59.999) in the factory's operating timezone.
 * @param {Date|string} dueDateInput - The order's due date
 * @param {string} [timeZone=FACTORY_TIMEZONE] - IANA Timezone string
 * @returns {Date} Instant corresponding to 23:59:59.999 in the specified timezone
 */
const getEndOfDayInTimezone = (dueDateInput, timeZone = FACTORY_TIMEZONE) => {
  if (!dueDateInput) return null;
  const d = new Date(dueDateInput);
  if (isNaN(d.getTime())) return null;

  // Extract date components in target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(d);
  const year = parts.find((p) => p.type === 'year').value;
  const month = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;

  // Midday reference on that date in UTC to accurately determine timezone offset
  const midUtc = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
  const utcDate = new Date(midUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(midUtc.toLocaleString('en-US', { timeZone }));
  const offsetMinutes = (tzDate.getTime() - utcDate.getTime()) / (60 * 1000);

  // End of local day: 23:59:59.999 local minus offset
  const localEndOfDayUtcMillis = Date.UTC(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    23,
    59,
    59,
    999
  ) - offsetMinutes * 60 * 1000;

  return new Date(localEndOfDayUtcMillis);
};

/**
 * Calculates available production days between two instants, skipping non-working days.
 */
const calculateAvailableProductionDays = (
  now,
  deadline,
  nonWorkingWeekdays = NON_WORKING_WEEKDAYS,
  timeZone = FACTORY_TIMEZONE
) => {
  const startMillis = new Date(now).getTime();
  const endMillis = new Date(deadline).getTime();

  if (startMillis >= endMillis) {
    return 0;
  }

  const msPerDay = 24 * 60 * 60 * 1000;

  // Standard 7-day continuous operation
  if (!nonWorkingWeekdays || nonWorkingWeekdays.length === 0) {
    return (endMillis - startMillis) / msPerDay;
  }

  // Count working calendar fractions if custom non-working days configured
  let current = new Date(startMillis);
  let availableDays = 0;

  while (current.getTime() < endMillis) {
    const nextDay = new Date(current.getTime() + msPerDay);
    const dayOfWeek = current.getDay();

    if (!nonWorkingWeekdays.includes(dayOfWeek)) {
      const windowEnd = Math.min(nextDay.getTime(), endMillis);
      availableDays += (windowEnd - current.getTime()) / msPerDay;
    }
    current = nextDay;
  }

  return availableDays;
};

/**
 * Advances a timestamp by a specified number of production days.
 */
const advanceByProductionDays = (
  startDate,
  productionDays,
  nonWorkingWeekdays = NON_WORKING_WEEKDAYS
) => {
  if (productionDays === null || productionDays === undefined || isNaN(productionDays) || !isFinite(productionDays)) {
    return null;
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  const startMillis = new Date(startDate).getTime();

  if (!nonWorkingWeekdays || nonWorkingWeekdays.length === 0) {
    return new Date(startMillis + productionDays * msPerDay);
  }

  let remaining = productionDays;
  let current = new Date(startMillis);

  while (remaining > 0) {
    const dayOfWeek = current.getDay();
    if (!nonWorkingWeekdays.includes(dayOfWeek)) {
      if (remaining <= 1) {
        current = new Date(current.getTime() + remaining * msPerDay);
        remaining = 0;
      } else {
        current = new Date(current.getTime() + msPerDay);
        remaining -= 1;
      }
    } else {
      current = new Date(current.getTime() + msPerDay);
    }
  }

  return current;
};

/**
 * Formats numbers for step expressions with clean rounding.
 */
const fmt = (num, decimals = 1) => {
  if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return 'N/A';
  return Number(num).toFixed(decimals).replace(/\.0$/, '');
};

/**
 * Main Assessment Engine.
 * Evaluates an order and returns a complete explainable calculation contract.
 *
 * @param {Object} order - Plain production order object
 * @param {Date} [referenceDate=new Date()] - Reference instant `now`
 * @param {Object} [options] - Context containing available same-type machines and roll defects
 * @returns {Object} Complete Assessment Contract
 */
const evaluateOrderRisk = (order, referenceDate = new Date(), options = {}) => {
  const now = new Date(referenceDate);
  const { availableSameTypeMachines = [], sharedActiveOrdersCount = 0, rejectReworkRolls = null } = options;

  const buyer = order.customer || order.buyer || 'Unknown Buyer';
  const orderNumber = order.orderNumber || 'UNKNOWN';
  const fabricType = order.fabricType || 'Unspecified';
  const orderStatus = order.status || 'queued';
  const priority = order.priority || 'medium';
  const unit = order.unit || 'meters';

  const rawReq = order.requiredQuantity ?? order.quantity;
  const rawProd = order.producedQuantity;
  const safeReq = (rawReq !== null && rawReq !== undefined && !isNaN(Number(rawReq)) && isFinite(Number(rawReq))) ? Number(rawReq) : null;
  const safeProd = (rawProd !== null && rawProd !== undefined && !isNaN(Number(rawProd)) && isFinite(Number(rawProd))) ? Number(rawProd) : null;

  // Base Assessment Envelope
  const baseResult = {
    orderNumber,
    buyer,
    fabricType,
    orderStatus,
    priority,
    dueDate: order.dueDate || null,
    deadlineAt: null,
    status: 'INSUFFICIENT_DATA',
    unit,
    requiredQuantity: safeReq,
    producedQuantity: safeProd,
    remainingQuantity: null,
    rate: { value: null, unit: null, source: null, machineCode: null },
    estimatedProductionDays: null,
    availableProductionDays: null,
    slackDays: null,
    daysLate: null,
    requiredRatePerDay: null,
    estimatedCompletionAt: null,
    reasonCode: null,
    reason: null,
    suggestedAction: { code: 'NO_ACTION', text: 'No action needed.' },
    calculation: [],
    warnings: [],
    isEstimate: true,
  };

  // 1. Order Completed -> COMPLETED
  if (orderStatus === 'completed') {
    return {
      ...baseResult,
      status: 'COMPLETED',
      remainingQuantity: 0,
      reasonCode: 'ORDER_COMPLETED',
      reason: 'Order is completed. No remaining production required.',
      suggestedAction: { code: 'NO_ACTION', text: 'Order completed.' },
      calculation: [{ label: 'Status check', expression: 'order.status == completed', result: 'COMPLETED' }],
    };
  }

  // 2. Validate Quantities
  const reqQty = Number(order.requiredQuantity ?? order.quantity);
  const prodQty = Number(order.producedQuantity ?? 0);

  if (
    isNaN(reqQty) ||
    !isFinite(reqQty) ||
    reqQty <= 0 ||
    isNaN(prodQty) ||
    !isFinite(prodQty) ||
    prodQty < 0 ||
    prodQty > reqQty
  ) {
    return {
      ...baseResult,
      status: 'INSUFFICIENT_DATA',
      reasonCode: 'INVALID_QUANTITY',
      reason: `Invalid order quantities (Required: ${reqQty}, Produced: ${prodQty}). Quantities must be positive numbers with produced ≤ required.`,
      suggestedAction: {
        code: 'CORRECT_QUANTITIES',
        text: 'Correct the required and produced quantities on the work order.',
      },
      calculation: [{ label: 'Quantity validation', expression: `${prodQty} produced ≤ ${reqQty} required`, result: 'INVALID' }],
    };
  }

  const remainingQuantity = reqQty - prodQty;
  baseResult.requiredQuantity = reqQty;
  baseResult.producedQuantity = prodQty;
  baseResult.remainingQuantity = remainingQuantity;

  // 3. Validate Due Date & Deadline
  if (!order.dueDate) {
    return {
      ...baseResult,
      status: 'INSUFFICIENT_DATA',
      reasonCode: 'INVALID_DEADLINE',
      reason: 'Order delivery due date is missing or invalid.',
      suggestedAction: { code: 'SET_DUE_DATE', text: 'Specify a valid target delivery due date.' },
      calculation: [{ label: 'Deadline validation', expression: 'dueDate == null', result: 'INVALID' }],
    };
  }

  const deadlineAt = getEndOfDayInTimezone(order.dueDate, FACTORY_TIMEZONE);
  if (!deadlineAt || isNaN(deadlineAt.getTime())) {
    return {
      ...baseResult,
      status: 'INSUFFICIENT_DATA',
      reasonCode: 'INVALID_DEADLINE',
      reason: `Due date '${order.dueDate}' could not be parsed into a valid factory deadline.`,
      suggestedAction: { code: 'SET_DUE_DATE', text: 'Specify a valid target delivery due date.' },
    };
  }
  baseResult.deadlineAt = deadlineAt.toISOString();

  // 4. Check All Produced but Not Completed
  const warnings = [];
  if (orderStatus === 'on_hold') {
    warnings.push({ code: 'ORDER_ON_HOLD', message: 'Order is currently on hold. Production progress is paused.' });
  }
  if (orderStatus === 'queued') {
    warnings.push({ code: 'ORDER_NOT_STARTED', message: 'Order is queued. The estimate assumes production begins immediately.' });
  }
  if (order.assignedMachine?.status === 'maintenance' || order.assignedMachine?.status === 'breakdown') {
    warnings.push({ code: 'MACHINE_IN_MAINTENANCE', message: `Assigned machine ${order.assignedMachine.code} is in maintenance. Rate used is nominal.` });
  }
  if (sharedActiveOrdersCount > 1) {
    warnings.push({ code: 'SHARED_MACHINE', message: `Machine is assigned to ${sharedActiveOrdersCount} active orders. Estimate assumes full daily capacity for this order.` });
  }
  if (rejectReworkRolls && rejectReworkRolls.count > 0 && unit === 'meters') {
    warnings.push({
      code: 'REJECTED_OR_REWORK_ROLLS',
      message: `${rejectReworkRolls.count} roll(s) (${rejectReworkRolls.metres}m) flagged REJECT/REWORK. Produced quantity may overstate sellable output.`,
    });
  }

  if (remainingQuantity === 0) {
    warnings.push({ code: 'ALL_PRODUCED_NOT_COMPLETED', message: 'All required quantity has been produced. Mark the order completed.' });
    return {
      ...baseResult,
      status: 'ON_TRACK',
      estimatedProductionDays: 0,
      slackDays: calculateAvailableProductionDays(now, deadlineAt),
      daysLate: 0,
      reasonCode: 'ALL_PRODUCED',
      reason: '100% of required quantity produced. Work order is ready to be closed.',
      suggestedAction: { code: 'MARK_COMPLETED', text: 'Mark the work order status as completed.' },
      calculation: [
        { label: 'Remaining quantity', expression: `${reqQty} - ${prodQty}`, result: '0 ' + unit },
        { label: 'Estimated days', expression: '0 / rate', result: '0.0 days' },
      ],
      warnings,
    };
  }

  // Calculate available production days
  const availableProductionDays = calculateAvailableProductionDays(now, deadlineAt);
  baseResult.availableProductionDays = availableProductionDays;

  // 5. Check Overdue
  const isOverdue = now.getTime() > deadlineAt.getTime();

  // 6. Resolve Rate
  let resolvedRate = null;
  let rateSource = null;
  let rateMachineCode = null;
  let rateUnit = null;

  // Order Override Precedence
  if (order.productionRatePerDay !== undefined && order.productionRatePerDay !== null) {
    const overrideVal = Number(order.productionRatePerDay);
    if (isNaN(overrideVal) || !isFinite(overrideVal) || overrideVal <= 0) {
      return {
        ...baseResult,
        status: isOverdue ? 'OVERDUE' : 'INSUFFICIENT_DATA',
        reasonCode: 'INVALID_RATE',
        reason: `Order production rate override (${order.productionRatePerDay}) is invalid. It must be a positive finite number.`,
        suggestedAction: { code: 'CORRECT_RATE', text: 'Set a valid productionRatePerDay override on the order or remove it to use machine capacity.' },
        warnings,
      };
    }
    resolvedRate = overrideVal;
    rateSource = 'ORDER_OVERRIDE';
    rateUnit = unit; // Override is in order's unit
    rateMachineCode = order.assignedMachine?.code || null;
  } else if (order.assignedMachine) {
    const machine = order.assignedMachine;
    rateMachineCode = machine.code || null;
    const machineCap = Number(machine.dailyCapacity ?? machine.capacity);

    if (isNaN(machineCap) || !isFinite(machineCap) || machineCap <= 0) {
      return {
        ...baseResult,
        status: isOverdue ? 'OVERDUE' : 'INSUFFICIENT_DATA',
        reasonCode: 'MACHINE_RATE_MISSING',
        reason: `Assigned machine '${rateMachineCode}' has no configured daily capacity.`,
        suggestedAction: { code: 'SET_MACHINE_CAPACITY', text: `Configure dailyCapacity on machine ${rateMachineCode}.` },
        warnings,
      };
    }

    // Unit compatibility check
    let machineUnit = (machine.capacityUnit || 'meters').toLowerCase();
    if (machineUnit === 'meters/hour' || machineUnit === 'meters/day') machineUnit = 'meters';
    if (machineUnit === 'kg/batch' || machineUnit === 'kg/day') machineUnit = 'kg';

    const orderUnitNorm = unit.toLowerCase();
    if (machineUnit !== orderUnitNorm) {
      return {
        ...baseResult,
        status: isOverdue ? 'OVERDUE' : 'INSUFFICIENT_DATA',
        reasonCode: 'UNIT_MISMATCH',
        reason: `Unit mismatch: Machine capacity is in '${machine.capacityUnit}', but order requires '${unit}'.`,
        suggestedAction: { code: 'ALIGN_UNITS', text: `Align measurement units between order (${unit}) and machine (${machine.capacityUnit}).` },
        warnings,
      };
    }

    resolvedRate = machineCap;
    rateSource = 'MACHINE_CAPACITY';
    rateUnit = machine.capacityUnit || unit;
  } else {
    // No machine assigned and no override
    return {
      ...baseResult,
      status: isOverdue ? 'OVERDUE' : 'INSUFFICIENT_DATA',
      reasonCode: 'NO_MACHINE_ASSIGNED',
      reason: 'No machine workcenter is assigned to this order and no production rate override was specified.',
      suggestedAction: { code: 'ASSIGN_MACHINE', text: 'Assign an available machine workcenter to this order.' },
      warnings,
    };
  }

  baseResult.rate = {
    value: resolvedRate,
    unit: rateUnit,
    source: rateSource,
    machineCode: rateMachineCode,
  };

  // 7. Calculate Math & Timelines
  const estimatedProductionDays = remainingQuantity / resolvedRate;
  const slackDays = availableProductionDays - estimatedProductionDays;
  const daysLate = Math.max(0, estimatedProductionDays - availableProductionDays);
  const requiredRatePerDay = availableProductionDays > 0 ? remainingQuantity / availableProductionDays : null;
  const estimatedCompletionAt = advanceByProductionDays(now, estimatedProductionDays);

  baseResult.estimatedProductionDays = estimatedProductionDays;
  baseResult.slackDays = slackDays;
  baseResult.daysLate = daysLate;
  baseResult.requiredRatePerDay = requiredRatePerDay;
  baseResult.estimatedCompletionAt = estimatedCompletionAt ? estimatedCompletionAt.toISOString() : null;

  // Build step-by-step calculation trace
  const calculation = [
    {
      label: 'Remaining quantity',
      expression: `${reqQty} ${unit} (required) − ${prodQty} ${unit} (produced)`,
      result: `${fmt(remainingQuantity, 2)} ${unit}`,
    },
    {
      label: 'Estimated production time',
      expression: `${fmt(remainingQuantity, 2)} ${unit} ÷ ${fmt(resolvedRate, 1)} ${unit}/day (${rateSource === 'ORDER_OVERRIDE' ? 'Order override' : rateMachineCode})`,
      result: `${fmt(estimatedProductionDays, 1)} production days`,
    },
    {
      label: 'Available production time',
      expression: `Time until ${deadlineAt.toLocaleDateString('en-US')} 23:59 (${FACTORY_TIMEZONE})`,
      result: `${fmt(availableProductionDays, 1)} production days`,
    },
  ];

  // 8. Handle Overdue with valid rate
  if (isOverdue) {
    const msOverdue = now.getTime() - deadlineAt.getTime();
    const daysOverdue = Math.max(1, Math.floor(msOverdue / (24 * 60 * 60 * 1000)));

    const projectedStr = estimatedCompletionAt ? estimatedCompletionAt.toLocaleDateString('en-US') : 'unknown date';
    const reason = `Delivery deadline passed ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago (${deadlineAt.toLocaleDateString('en-US')}). ${fmt(remainingQuantity)} ${unit} remaining.`;
    const actionText = `Deadline passed ${daysOverdue} day(s) ago with ${fmt(remainingQuantity)} ${unit} remaining. Contact buyer (${buyer}) now; projected completion ${projectedStr}.`;

    calculation.push({
      label: 'Delay verdict',
      expression: 'now > deadlineAt',
      result: 'OVERDUE',
    });

    return {
      ...baseResult,
      status: 'OVERDUE',
      reasonCode: 'DEADLINE_PASSED',
      reason,
      suggestedAction: { code: 'EXPEDITE_OR_NOTIFY', text: actionText },
      calculation,
      warnings,
    };
  }

  // 9. Compare estimated vs available
  calculation.push({
    label: 'Schedule comparison',
    expression: `${fmt(estimatedProductionDays, 1)} days needed vs ${fmt(availableProductionDays, 1)} days available (Slack: ${fmt(slackDays, 1)}d)`,
    result: estimatedProductionDays > availableProductionDays + TOLERANCE ? 'AT_RISK' : 'ON_TRACK',
  });

  if (estimatedProductionDays > availableProductionDays + TOLERANCE) {
    // AT_RISK
    const neededRate = fmt(requiredRatePerDay, 1);
    const currRate = fmt(resolvedRate, 1);
    const lateDays = fmt(daysLate, 1);
    const compStr = estimatedCompletionAt ? estimatedCompletionAt.toLocaleDateString('en-US') : 'N/A';

    // Check if an available same-type machine can rescue this order
    const rescueMachine = availableSameTypeMachines.find((m) => {
      const rescueCap = Number(m.dailyCapacity ?? m.capacity);
      if (isNaN(rescueCap) || rescueCap <= 0) return false;
      const combinedRate = resolvedRate + rescueCap;
      const combinedDays = remainingQuantity / combinedRate;
      return combinedDays <= availableProductionDays + TOLERANCE;
    });

    let suggestedAction;
    if (rescueMachine) {
      const rescueCode = rescueMachine.code;
      const rescueCap = fmt(rescueMachine.dailyCapacity ?? rescueMachine.capacity, 1);
      suggestedAction = {
        code: 'REALLOCATE_OR_SPLIT',
        text: `Consider running part of this order on ${rescueCode} (available, ${rescueCap} ${unit}/day). Needs about ${neededRate} ${unit}/day to finish on time; current rate is ${currRate} ${unit}/day.`,
      };
    } else {
      suggestedAction = {
        code: 'NOTIFY_BUYER',
        text: `Cannot meet the deadline at current capacity. Estimated completion ${compStr} (${lateDays} days late). Contact ${buyer} to agree a revised date or a partial shipment of ${fmt(prodQty)} ${unit}.`,
      };
    }

    return {
      ...baseResult,
      status: 'AT_RISK',
      reasonCode: 'RATE_INSUFFICIENT',
      reason: `Needs ${fmt(estimatedProductionDays, 1)} days at current rate (${currRate} ${unit}/day) but only ${fmt(availableProductionDays, 1)} days remain before deadline. Estimated ${lateDays} days late.`,
      suggestedAction,
      calculation,
      warnings,
    };
  }

  // ON_TRACK
  const actionText = warnings.length > 0
    ? `On track (Slack: ${fmt(slackDays, 1)} days). Monitor active warning flags.`
    : `No action needed. On schedule with ${fmt(slackDays, 1)} days of buffer slack.`;

  return {
    ...baseResult,
    status: 'ON_TRACK',
    reasonCode: 'ON_SCHEDULE',
    reason: `On track to finish on time. Estimated production requires ${fmt(estimatedProductionDays, 1)} days, with ${fmt(availableProductionDays, 1)} days available (Slack: ${fmt(slackDays, 1)}d).`,
    suggestedAction: { code: 'NO_ACTION', text: actionText },
    calculation,
    warnings,
  };
};

module.exports = {
  getEndOfDayInTimezone,
  calculateAvailableProductionDays,
  advanceByProductionDays,
  evaluateOrderRisk,
};
