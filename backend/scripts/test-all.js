/**
 * Comprehensive Automated Test Suite for LoomIQ Platform.
 * Covers:
 * - Module 1: Production Logic & Single Source of Truth
 * - Module 2: Fabric Roll & Digital Passport
 * - Module 3: Explainable Delay Radar Pure Math Engine & Conformance Oracle
 * - Module 4A: Stage Quality Gates & Deterministic Verdict Engine
 * - Module 4B: Quality Control Tower, Alerts & Analytics Engine
 * - Module 4C: Corrective Actions (CAPA) Loop & Recurrence Tracking
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const {
  ProductionOrder,
  Machine,
  MaterialStock,
  FabricRoll,
  CorrectiveAction,
  Counter,
} = require('../src/models');
const { calculateOrderMetrics, calculateStockMetrics } = require('../src/utils/derivedMetrics');
const {
  getEndOfDayInTimezone,
  calculateAvailableProductionDays,
  advanceByProductionDays,
  evaluateOrderRisk,
} = require('../src/utils/delayRadarEngine');
const {
  validateRollId,
  validateQuantityMetres,
  validateInspectionInput,
  validateDispatchTransition,
  calculateAllowedActions,
  checkAdvanceEligibility,
} = require('../src/utils/rollRules');
const {
  STAGE_ORDER,
  SEVERITY_WEIGHTS,
  QUALITY_RULES,
  STAGE_CONFIG,
  getCatalogForStage,
} = require('../src/config/qualityStages.config');
const {
  validateDefects,
  evaluateInspection,
  validateOverride,
  calculateEnhancedAllowedActions,
  computeQualityAnalytics,
  calculateActionRecurrence,
} = require('../src/utils/qualityGateEngine');

let passedTests = 0;
let failedTests = 0;

const assert = (condition, description) => {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failedTests++;
  }
};

// ============================================================================
// 1. MODULE 1: PRODUCTION LOGIC & SINGLE SOURCE OF TRUTH TESTS
// ============================================================================
const runModule1UnitTests = () => {
  console.log('\n--- 1. Module 1: Production Logic & Single Source of Truth Unit Tests ---');
  const now = new Date('2026-10-10T12:00:00.000Z');
  const day = 24 * 60 * 60 * 1000;

  const order1 = {
    orderNumber: 'PO-TEST-001',
    requiredQuantity: 1000,
    producedQuantity: 450,
    unit: 'meters',
    dueDate: new Date(now.getTime() + 10 * day),
    status: 'in_progress',
    assignedMachine: { code: 'LM-01', dailyCapacity: 100, capacityUnit: 'meters' },
  };
  const m1 = calculateOrderMetrics(order1, now);
  assert(m1.progressPercent === 45, 'Computes 45% progress (450/1000)');
  assert(m1.remainingQuantity === 550, 'Computes 550 remaining quantity (1000 - 450)');
  assert(m1.delayStatus === 'on_track', 'Delegates to Delay Radar: 550 rem / 100 rate = 5.5d <= 10.5d avail -> on_track');

  const overdueOrder = {
    orderNumber: 'PO-TEST-002',
    requiredQuantity: 1000,
    producedQuantity: 500,
    unit: 'meters',
    dueDate: new Date(now.getTime() - 2 * day),
    status: 'in_progress',
    assignedMachine: { code: 'LM-01', dailyCapacity: 100, capacityUnit: 'meters' },
  };
  const mOverdue = calculateOrderMetrics(overdueOrder, now);
  assert(mOverdue.delayStatus === 'delayed', 'Past due order maps OVERDUE -> delayed');

  const completedOrder = {
    orderNumber: 'PO-TEST-003',
    requiredQuantity: 1000,
    producedQuantity: 1000,
    unit: 'meters',
    dueDate: new Date(now.getTime() - 2 * day),
    status: 'completed',
  };
  const mCompleted = calculateOrderMetrics(completedOrder, now);
  assert(mCompleted.delayStatus === null, 'Completed order has null delayStatus');
  assert(mCompleted.remainingQuantity === 0, 'Completed order remainingQuantity is 0');

  const s1 = calculateStockMetrics({ quantityOnHand: 0, reorderLevel: 100 });
  assert(s1.stockLevel === 'out' && s1.shortfall === 100, '0 qty triggers out of stock with shortfall=100');
  const s2 = calculateStockMetrics({ quantityOnHand: 100, reorderLevel: 100 });
  assert(s2.stockLevel === 'low' && s2.shortfall === 0, 'Exact reorder level triggers low stock with shortfall=0');
};

// ============================================================================
// 2. MODULE 2: FABRIC PASSPORT & ROLL RULES TESTS
// ============================================================================
const runModule2UnitTests = () => {
  console.log('\n--- 2. Module 2: Fabric Roll & Passport Unit Tests ---');

  assert(validateRollId('FR-2026-000001').valid === true, "Valid ID format 'FR-2026-000001'");
  assert(validateRollId('ROLL-99-A').valid === true, "Valid custom ID format 'ROLL-99-A'");
  assert(validateRollId('a').valid === false, 'Rejects too-short ID');
  assert(validateRollId('BAD_ID_!@#').valid === false, 'Rejects invalid characters');

  assert(validateQuantityMetres(0).valid === false, 'Rejects 0 quantity');
  assert(validateQuantityMetres(-10).valid === false, 'Rejects negative quantity');
  assert(validateQuantityMetres(0.01).valid === true, 'Accepts minimum 0.01 m');
  assert(validateQuantityMetres(5000).valid === true, 'Accepts maximum 5000 m');
  assert(validateQuantityMetres(5000.01).valid === false, 'Rejects > 5000 m');
  assert(validateQuantityMetres(125.45).valid === true, 'Accepts 2 decimal places');
  assert(validateQuantityMetres(125.456).valid === false, 'Rejects 3 decimal places');

  assert(validateInspectionInput({ result: 'PENDING' }).valid === false, 'Rejects PENDING inspection submission');
  assert(validateInspectionInput({ result: 'PASS', defectNotes: '' }).valid === true, 'Accepts PASS without notes');
  assert(validateInspectionInput({ result: 'REWORK', defectNotes: '' }).valid === false, 'Rejects REWORK without defect notes');
  assert(validateInspectionInput({ result: 'REWORK', defectNotes: 'Uneven edge' }).valid === true, 'Accepts REWORK with notes');
  assert(validateInspectionInput({ result: 'REJECT', defectNotes: '' }).valid === false, 'Rejects REJECT without defect notes');
  assert(validateInspectionInput({ result: 'REJECT', defectNotes: 'Severe hole' }).valid === true, 'Accepts REJECT with notes');

  const d1 = validateDispatchTransition('NOT_DISPATCHED', 'PASS', 'READY_FOR_DISPATCH');
  assert(d1.valid === true, 'Allows PASS roll: NOT_DISPATCHED -> READY_FOR_DISPATCH');

  const d2 = validateDispatchTransition('NOT_DISPATCHED', 'REWORK', 'READY_FOR_DISPATCH');
  assert(d2.valid === false && d2.status === 409, 'Blocks REWORK roll from READY_FOR_DISPATCH (409)');

  const d3 = validateDispatchTransition('NOT_DISPATCHED', 'REJECT', 'DISPATCHED');
  assert(d3.valid === false && d3.status === 409, 'Blocks REJECT roll from DISPATCHED (409)');

  const d4 = validateDispatchTransition('READY_FOR_DISPATCH', 'PASS', 'NOT_DISPATCHED');
  assert(d4.valid === true, 'Allows unready: READY_FOR_DISPATCH -> NOT_DISPATCHED');

  const d5 = validateDispatchTransition('READY_FOR_DISPATCH', 'PASS', 'DISPATCHED');
  assert(d5.valid === true, 'Allows PASS roll: READY_FOR_DISPATCH -> DISPATCHED');

  const d6 = validateDispatchTransition('DISPATCHED', 'PASS', 'READY_FOR_DISPATCH');
  assert(d6.valid === false && d6.status === 409, 'Blocks modifying DISPATCHED roll (terminal state, 409)');

  const aPending = calculateAllowedActions({ qualityStatus: 'PENDING', dispatchStatus: 'NOT_DISPATCHED' });
  assert(aPending.canInspect === true && aPending.canMarkReady === false && aPending.canDispatch === false, 'PENDING roll can inspect only');

  const aPass = calculateAllowedActions({ qualityStatus: 'PASS', dispatchStatus: 'NOT_DISPATCHED' });
  assert(aPass.canInspect === true && aPass.canMarkReady === true && aPass.canDispatch === true, 'PASS roll can mark ready or dispatch');

  const aDispatched = calculateAllowedActions({ qualityStatus: 'PASS', dispatchStatus: 'DISPATCHED' });
  assert(aDispatched.canInspect === false && aDispatched.canDispatch === false, 'DISPATCHED roll has zero allowable actions');
};

// ============================================================================
// 3. MODULE 3: DELAY RADAR PURE MATH ENGINE TESTS
// ============================================================================
const runModule3DelayRadarUnitTests = () => {
  console.log('\n--- 3. Module 3: Explainable Delay Radar Pure Math Engine Unit Tests ---');
  const now = new Date('2026-10-10T12:00:00.000Z');
  const day = 24 * 60 * 60 * 1000;

  const safeOrder = {
    orderNumber: 'PO-SAFE-1',
    requiredQuantity: 500,
    producedQuantity: 450,
    unit: 'meters',
    dueDate: new Date(now.getTime() + 5 * day),
    status: 'in_progress',
    assignedMachine: { code: 'LM-01', dailyCapacity: 100, capacityUnit: 'meters' },
  };
  const evalSafe = evaluateOrderRisk(safeOrder, now);
  assert(evalSafe.status === 'ON_TRACK', '500 req, 450 prod, 100/d rate -> ON_TRACK');
  assert(Math.abs(evalSafe.slackDays - 5.0) < 0.6, 'Calculates correct buffer slack');

  const baseWorkedOrder = {
    orderNumber: 'PO-BENCH-1',
    customer: 'Test Buyer',
    fabricType: 'Standard Cotton',
    requiredQuantity: 500,
    producedQuantity: 200,
    unit: 'meters',
    status: 'in_progress',
    assignedMachine: { code: 'LM-01', dailyCapacity: 100, capacityUnit: 'meters' },
  };

  const deadline2d = new Date(now.getTime() + 2 * day);
  const eval2d = evaluateOrderRisk({ ...baseWorkedOrder, dueDate: deadline2d }, now);
  assert(eval2d.status === 'AT_RISK', 'Worked example (2.0d avail): Verdict is AT_RISK');
  assert(eval2d.remainingQuantity === 300, 'Worked example: remainingQuantity is 300');
  assert(eval2d.estimatedProductionDays === 3.0, 'Worked example: estimatedProductionDays is 3.0');
  assert(eval2d.daysLate > 0.4 && eval2d.daysLate < 1.6, 'Worked example: ~1.0 day late');

  const deadline3d = new Date(now.getTime() + 3 * day);
  const eval3d = evaluateOrderRisk({ ...baseWorkedOrder, dueDate: deadline3d }, now);
  assert(eval3d.estimatedProductionDays === 3.0, '3.0 days needed');

  const evalSafeBound = evaluateOrderRisk({
    ...baseWorkedOrder,
    dueDate: new Date(now.getTime() + 3.05 * day),
  }, now);
  assert(evalSafeBound.status === 'ON_TRACK', 'Boundary 3.05d available -> ON_TRACK');

  const evalRiskBound = evaluateOrderRisk({
    ...baseWorkedOrder,
    dueDate: new Date(now.getTime() + 2.0 * day),
  }, now);
  assert(evalRiskBound.status === 'AT_RISK', 'Boundary 2.0d available -> AT_RISK');

  const compOrder = {
    orderNumber: 'PO-COMP-1',
    requiredQuantity: 500,
    producedQuantity: 500,
    status: 'completed',
  };
  const evalComp = evaluateOrderRisk(compOrder, now);
  assert(evalComp.status === 'COMPLETED', 'Completed order evaluates to COMPLETED');
  assert(evalComp.remainingQuantity === 0, 'Completed order remainingQuantity is 0');
  assert(evalComp.rate.value === null, 'Completed order rate is null (no division executed)');

  const overdueNoRate = {
    orderNumber: 'PO-OVERDUE-1',
    requiredQuantity: 500,
    producedQuantity: 200,
    dueDate: new Date(now.getTime() - 2 * day),
    status: 'in_progress',
    assignedMachine: null,
  };
  const evalOverdueNoRate = evaluateOrderRisk(overdueNoRate, now);
  assert(evalOverdueNoRate.status === 'OVERDUE', 'Past due order with no machine evaluates to OVERDUE');

  const endOfDayKolkata = getEndOfDayInTimezone('2026-10-15', 'Asia/Kolkata');
  assert(endOfDayKolkata !== null, 'Parses end of day in Asia/Kolkata');
  const instantBefore = new Date('2026-10-15T18:28:00.000Z');
  assert(instantBefore.getTime() < endOfDayKolkata.getTime(), '18:28 UTC is BEFORE Kolkata end of day');
  const instantAfter = new Date('2026-10-15T18:31:00.000Z');
  assert(instantAfter.getTime() > endOfDayKolkata.getTime(), '18:31 UTC is AFTER Kolkata end of day (OVERDUE)');

  const allProdOrder = {
    orderNumber: 'PO-ALL-PROD',
    requiredQuantity: 500,
    producedQuantity: 500,
    dueDate: new Date(now.getTime() + 5 * day),
    status: 'in_progress',
    assignedMachine: { code: 'LM-01', dailyCapacity: 100, capacityUnit: 'meters' },
  };
  const evalAllProd = evaluateOrderRisk(allProdOrder, now);
  assert(evalAllProd.status === 'ON_TRACK', 'All produced evaluates to ON_TRACK');
  assert(
    evalAllProd.warnings.some((w) => w.code === 'ALL_PRODUCED_NOT_COMPLETED'),
    'Includes warning ALL_PRODUCED_NOT_COMPLETED'
  );

  const invalidOverrideOrder = {
    orderNumber: 'PO-INV-OVERRIDE',
    requiredQuantity: 500,
    producedQuantity: 200,
    unit: 'meters',
    dueDate: new Date(now.getTime() + 5 * day),
    status: 'in_progress',
    productionRatePerDay: -50,
    assignedMachine: { code: 'LM-01', dailyCapacity: 100, capacityUnit: 'meters' },
  };
  const evalInvOverride = evaluateOrderRisk(invalidOverrideOrder, now);
  assert(evalInvOverride.status === 'INSUFFICIENT_DATA', 'Invalid override returns INSUFFICIENT_DATA');
  assert(evalInvOverride.reasonCode === 'INVALID_RATE', 'Reason code is INVALID_RATE (does not fall back to machine)');

  const unitMismatchOrder = {
    orderNumber: 'PO-UNIT-MISMATCH',
    requiredQuantity: 500,
    producedQuantity: 200,
    unit: 'meters',
    dueDate: new Date(now.getTime() + 5 * day),
    status: 'in_progress',
    assignedMachine: { code: 'DY-01', dailyCapacity: 500, capacityUnit: 'kg' },
  };
  const evalMismatch = evaluateOrderRisk(unitMismatchOrder, now);
  assert(evalMismatch.status === 'INSUFFICIENT_DATA' && evalMismatch.reasonCode === 'UNIT_MISMATCH', 'Catches UNIT_MISMATCH');

  const noCapMachineOrder = {
    orderNumber: 'PO-NO-CAP',
    requiredQuantity: 500,
    producedQuantity: 200,
    unit: 'meters',
    dueDate: new Date(now.getTime() + 5 * day),
    status: 'in_progress',
    assignedMachine: { code: 'LM-01', dailyCapacity: 0, capacity: 0 },
  };
  const evalNoCap = evaluateOrderRisk(noCapMachineOrder, now);
  assert(evalNoCap.reasonCode === 'MACHINE_RATE_MISSING', 'Catches MACHINE_RATE_MISSING');

  assert(evaluateOrderRisk({ requiredQuantity: 0, producedQuantity: 0 }, now).reasonCode === 'INVALID_QUANTITY', 'Rejects requiredQty = 0');
  assert(evaluateOrderRisk({ requiredQuantity: 500, producedQuantity: -10 }, now).reasonCode === 'INVALID_QUANTITY', 'Rejects negative producedQty');
  assert(evaluateOrderRisk({ requiredQuantity: 500, producedQuantity: 600 }, now).reasonCode === 'INVALID_QUANTITY', 'Rejects producedQty > requiredQty');
  assert(evaluateOrderRisk({ requiredQuantity: NaN, producedQuantity: 100 }, now).reasonCode === 'INVALID_QUANTITY', 'Rejects NaN quantity');

  const availWorkingDays = calculateAvailableProductionDays(
    '2026-10-12T00:00:00.000Z',
    '2026-10-19T00:00:00.000Z',
    [0, 6]
  );
  assert(Math.abs(availWorkingDays - 5.0) < 0.1, 'Non-working weekdays [0, 6] accurately yields 5.0 production days');

  const rescuableOrder = {
    orderNumber: 'PO-RESCUE-1',
    customer: 'Cascade Sportswear',
    fabricType: 'Mesh',
    requiredQuantity: 4500,
    producedQuantity: 1500,
    unit: 'meters',
    dueDate: new Date(now.getTime() + 4 * day),
    status: 'in_progress',
    assignedMachine: { code: 'LM-03', type: 'loom', dailyCapacity: 400, capacityUnit: 'meters' },
  };
  const availableLoom = { code: 'LM-04', type: 'loom', dailyCapacity: 500, capacityUnit: 'meters', status: 'available' };
  const evalRescue = evaluateOrderRisk(rescuableOrder, now, { availableSameTypeMachines: [availableLoom] });
  assert(evalRescue.status === 'AT_RISK', 'Rescuable order is AT_RISK');
  assert(evalRescue.suggestedAction.code === 'REALLOCATE_OR_SPLIT', 'Suggested action code is REALLOCATE_OR_SPLIT');
  assert(evalRescue.suggestedAction.text.includes('LM-04'), 'Suggested action mentions available rescue machine LM-04');
};

// ============================================================================
// 4. MODULE 4A: STAGE QUALITY GATES & VERDICT RULES UNIT TESTS
// ============================================================================
const runModule4AUnitTests = () => {
  console.log('\n--- 4. Module 4A: Stage Quality Gates & Verdict Rules Unit Tests ---');

  // 1. Defect points & pointsPer100m math
  const eval1 = evaluateInspection({
    stage: 'GREY',
    quantityMetres: 120,
    defects: [
      { code: 'BROKEN_END', severity: 'MINOR', quantity: 4 }, // 4 * 1 = 4
      { code: 'WEFT_BAR', severity: 'MAJOR', quantity: 3 },   // 3 * 3 = 9
    ],
  });
  assert(eval1.defectPoints === 13, 'Calculates 13 points (4 MINOR + 3 MAJOR)');
  assert(eval1.pointsPer100m === 10.83, 'Calculates 13 / 120m * 100 = 10.83 pts/100m');
  assert(eval1.recommendedResult === 'PASS', '10.83 pts/100m <= 20 threshold -> PASS at GREY');
  assert(eval1.calculation.length >= 3, 'Returns calculation trace array');

  // 2. Verdict boundaries (Equal to threshold passes that band)
  // GREY Pass limit: 20 pts/100m. Exactly 20 pts on 100m -> PASS
  const evalExactPass = evaluateInspection({
    stage: 'GREY',
    quantityMetres: 100,
    defects: [{ code: 'WEFT_BAR', severity: 'MAJOR', quantity: 6 }, { code: 'BROKEN_END', severity: 'MINOR', quantity: 2 }], // 6*3 + 2*1 = 20 pts
  });
  assert(evalExactPass.pointsPer100m === 20.0, 'Exact 20.0 pts/100m');
  assert(evalExactPass.recommendedResult === 'PASS', 'Exact boundary (20.0 pts/100m <= 20.0) -> PASS');

  // GREY Rework limit: 40 pts/100m. Exactly 40 pts on 100m -> REWORK
  const evalExactRework = evaluateInspection({
    stage: 'GREY',
    quantityMetres: 100,
    defects: [{ code: 'WEFT_BAR', severity: 'MAJOR', quantity: 13 }, { code: 'BROKEN_END', severity: 'MINOR', quantity: 1 }], // 13*3 + 1 = 40 pts
  });
  assert(evalExactRework.pointsPer100m === 40.0, 'Exact 40.0 pts/100m');
  assert(evalExactRework.recommendedResult === 'REWORK', 'Exact boundary (40.0 pts/100m <= 40.0) -> REWORK');

  // Above Rework limit (41 pts/100m) -> REJECT
  const evalOverRework = evaluateInspection({
    stage: 'GREY',
    quantityMetres: 100,
    defects: [{ code: 'WEFT_BAR', severity: 'MAJOR', quantity: 14 }], // 14*3 = 42 pts
  });
  assert(evalOverRework.recommendedResult === 'REJECT', 'Above rework limit (42 pts/100m > 40.0) -> REJECT');

  // Any CRITICAL severity -> Immediate REJECT
  const evalCrit = evaluateInspection({
    stage: 'GREY',
    quantityMetres: 500,
    defects: [{ code: 'HOLE', severity: 'CRITICAL', quantity: 1 }], // 5 pts on 500m is only 1 pt/100m, but CRITICAL
  });
  assert(evalCrit.hasCritical === true && evalCrit.recommendedResult === 'REJECT', 'Any CRITICAL severity defect triggers immediate REJECT');

  // Rework limit reached (reworkCountAtStage >= 2 and points > passMax) -> REJECT
  const evalReworkLimit = evaluateInspection({
    stage: 'GREY',
    quantityMetres: 100,
    defects: [{ code: 'WEFT_BAR', severity: 'MAJOR', quantity: 8 }], // 24 pts (REWORK band)
    reworkCountAtStage: 2,
  });
  assert(evalReworkLimit.recommendedResult === 'REJECT', 'reworkCountAtStage >= 2 with points > passMax -> REJECT (Rework limit reached)');

  // 3. Override Rules
  // Stricter override: Recommended PASS, Inspector chooses REWORK or REJECT -> valid without reason
  const overStricter = validateOverride('PASS', 'REWORK', null);
  assert(overStricter.valid === true && overStricter.isOverride === true, 'Stricter override (PASS -> REWORK) is valid without reason');

  // Lenient override: Recommended REWORK, Inspector chooses PASS without reason -> invalid
  const overLenientNoReason = validateOverride('REWORK', 'PASS', '');
  assert(overLenientNoReason.valid === false && overLenientNoReason.code === 'OVERRIDE_REASON_REQUIRED', 'Lenient override (REWORK -> PASS) without reason rejected');

  // Lenient override with short reason (< 10 chars) -> invalid
  const overShortReason = validateOverride('REJECT', 'PASS', 'Too short');
  assert(overShortReason.valid === false && overShortReason.code === 'OVERRIDE_REASON_REQUIRED', 'Override reason < 10 characters rejected');

  // Lenient override with valid reason (>= 10 chars) -> valid
  const overValid = validateOverride('REWORK', 'PASS', 'Approved under concession waiver #WAIV-001');
  assert(overValid.valid === true && overValid.isOverride === true, 'Lenient override with valid reason (>= 10 chars) accepted');

  // 4. Stage Gate Advance Eligibility
  const passGreyRoll = { stage: 'GREY', qualityStatus: 'PASS', dispatchStatus: 'NOT_DISPATCHED' };
  const dyeingMachine = { code: 'DY-01', type: 'dyeing_vat' };
  const loomMachine = { code: 'LM-01', type: 'loom' };

  const advPass = checkAdvanceEligibility(passGreyRoll, dyeingMachine);
  assert(advPass.canAdvance === true && advPass.nextStage === 'DYEING', 'PASS roll at GREY with dyeing_vat can advance to DYEING');

  const advWrongMach = checkAdvanceEligibility(passGreyRoll, loomMachine);
  assert(advWrongMach.canAdvance === false && advWrongMach.code === 'MACHINE_TYPE_MISMATCH', 'Advancing to DYEING with loom machine rejected (MACHINE_TYPE_MISMATCH)');

  const advPending = checkAdvanceEligibility({ stage: 'GREY', qualityStatus: 'PENDING' }, dyeingMachine);
  assert(advPending.canAdvance === false && advPending.code === 'GATE_NOT_PASSED', 'PENDING roll cannot advance (GATE_NOT_PASSED)');

  const advRework = checkAdvanceEligibility({ stage: 'GREY', qualityStatus: 'REWORK' }, dyeingMachine);
  assert(advRework.canAdvance === false && advRework.code === 'GATE_NOT_PASSED', 'REWORK roll cannot advance (GATE_NOT_PASSED)');

  const advReject = checkAdvanceEligibility({ stage: 'GREY', qualityStatus: 'REJECT' }, dyeingMachine);
  assert(advReject.canAdvance === false && advReject.code === 'GATE_NOT_PASSED', 'REJECT roll cannot advance (GATE_NOT_PASSED)');

  const advFinal = checkAdvanceEligibility({ stage: 'FINAL', qualityStatus: 'PASS' });
  assert(advFinal.canAdvance === false && advFinal.code === 'FINAL_STAGE_REACHED', 'FINAL stage roll cannot advance further');

  // 5. Dispatch Rule Extension
  const dispGreyPass = validateDispatchTransition('NOT_DISPATCHED', 'PASS', 'DISPATCHED', 'GREY');
  assert(dispGreyPass.valid === false && dispGreyPass.code === 'DISPATCH_STAGE_INVALID', 'PASS roll at GREY stage cannot dispatch (must be FINAL)');

  const dispFinalPass = validateDispatchTransition('NOT_DISPATCHED', 'PASS', 'DISPATCHED', 'FINAL');
  assert(dispFinalPass.valid === true, 'PASS roll at FINAL stage can dispatch');
};

// ============================================================================
// 5. MODULE 4B: QUALITY CONTROL TOWER PURE ANALYTICS UNIT TESTS
// ============================================================================
const runModule4BUnitTests = () => {
  console.log('\n--- 5. Module 4B: Quality Control Tower & Alerts Pure Analytics Unit Tests ---');
  const now = new Date('2026-10-10T12:00:00.000Z');
  const day = 24 * 60 * 60 * 1000;
  const hour = 60 * 60 * 1000;

  // 1. FPY & RTY with Sample Size Guard
  // Build 6 rolls at GREY (all first-pass), 5 PASS, 1 REWORK -> FPY = 5/6 = 83.3%
  const testRolls = [];
  for (let i = 1; i <= 6; i++) {
    testRolls.push({
      rollId: `FR-TEST-G${i}`,
      stage: 'GREY',
      quantityMetres: 100,
      stageEnteredAt: new Date(now.getTime() - 2 * day),
      qualityStatus: i === 6 ? 'REWORK' : 'PASS',
      machine: { code: 'LM-01' },
      inspections: [
        {
          stage: 'GREY',
          result: i === 6 ? 'REWORK' : 'PASS',
          defectPoints: i === 6 ? 24 : 0,
          defects: i === 6 ? [{ code: 'WEFT_BAR', severity: 'MAJOR', quantity: 8 }] : [],
          inspectedAt: new Date(now.getTime() - 1 * day),
          machineCode: 'LM-01',
        },
      ],
    });
  }

  const analytics1 = computeQualityAnalytics({
    rolls: testRolls,
    machines: [{ code: 'LM-01' }],
    correctiveActions: [],
    windowDays: 30,
    now,
  });

  const greySummary = analytics1.stages.find((s) => s.stage === 'GREY');
  assert(greySummary.sampleSize === 6 && greySummary.lowSample === false, 'GREY meets MIN_SAMPLE (6 >= 5)');
  assert(greySummary.fpy === 83.3, 'GREY FPY = 5/6 = 83.3%');

  const dyeingSummary = analytics1.stages.find((s) => s.stage === 'DYEING');
  assert(dyeingSummary.lowSample === true && dyeingSummary.fpy === null, 'DYEING with 0 samples returns lowSample=true and fpy=null');
  assert(analytics1.rty === null, 'RTY is null when any stage is below MIN_SAMPLE');

  // 2. Escape Detection
  // Add a roll inspected at FINAL with a GREY defect ('WEFT_BAR')
  const escapeRoll = {
    rollId: 'FR-ESCAPE-1',
    stage: 'FINAL',
    quantityMetres: 100,
    stageEnteredAt: new Date(now.getTime() - 1 * day),
    qualityStatus: 'REWORK',
    machine: { code: 'FN-01' },
    inspections: [
      {
        stage: 'FINAL',
        result: 'REWORK',
        defects: [{ code: 'WEFT_BAR', severity: 'MAJOR', quantity: 2 }],
        inspectedAt: new Date(now.getTime() - 12 * hour),
        machineCode: 'FN-01',
      },
    ],
  };

  const analyticsEscape = computeQualityAnalytics({
    rolls: [escapeRoll],
    machines: [],
    correctiveActions: [],
    windowDays: 30,
    now,
  });
  assert(analyticsEscape.escapes.count === 1, 'Detects 1 defect escape');
  assert(analyticsEscape.escapes.topEscapes[0].originStage === 'GREY', 'Identifies origin stage of escape as GREY');
  assert(analyticsEscape.escapes.topEscapes[0].detectedStage === 'FINAL', 'Identifies detected stage of escape as FINAL');

  // 3. Late Detection Rate
  // 1 reject at GREY, 1 reject at FINAL -> total 2 rejects, final rejects 1 -> 50% late detection rate
  const lateRolls = [
    {
      rollId: 'FR-REJ-G',
      stage: 'GREY',
      quantityMetres: 100,
      inspections: [{ stage: 'GREY', result: 'REJECT', inspectedAt: new Date(now.getTime() - 1 * day) }],
    },
    {
      rollId: 'FR-REJ-F',
      stage: 'FINAL',
      quantityMetres: 100,
      inspections: [{ stage: 'FINAL', result: 'REJECT', inspectedAt: new Date(now.getTime() - 1 * day) }],
    },
  ];
  const analyticsLate = computeQualityAnalytics({
    rolls: lateRolls,
    machines: [],
    correctiveActions: [],
    windowDays: 30,
    now,
  });
  assert(analyticsLate.totalRejects === 2, 'Total rejects = 2');
  assert(analyticsLate.finalRejects === 1, 'Final rejects = 1');
  assert(analyticsLate.lateDetectionRate === 50.0, 'Late detection rate = 50.0% (1/2)');

  // 4. Alert Boundary Tests
  // 4a. Machine defect rate: 4 samples with 2 non-PASS (50%) -> n=4 < MIN_SAMPLE (5) -> No alert
  const rollsUnderMin = [];
  for (let i = 1; i <= 4; i++) {
    rollsUnderMin.push({
      rollId: `FR-M-UNDER-${i}`,
      stage: 'GREY',
      quantityMetres: 100,
      inspections: [{
        stage: 'GREY',
        result: i <= 2 ? 'REWORK' : 'PASS',
        defects: i <= 2 ? [{ code: 'WEFT_BAR', severity: 'MAJOR', quantity: 5 }] : [],
        inspectedAt: new Date(now.getTime() - 2 * day),
        machineCode: 'LM-TEST',
      }],
    });
  }
  const alertsUnder = computeQualityAnalytics({ rolls: rollsUnderMin, machines: [{ code: 'LM-TEST' }], now }).alerts;
  assert(!alertsUnder.some((a) => a.type === 'MACHINE_DEFECT_RATE'), 'MIN_SAMPLE - 1 (n=4) does NOT trigger MACHINE_DEFECT_RATE alert');

  // 4b. Exactly MIN_SAMPLE (5) with 2 non-pass = 40% (>= 30% WARN threshold) -> Triggers WARN alert
  const rollsExactMin = [
    ...rollsUnderMin,
    {
      rollId: 'FR-M-EXACT-5',
      stage: 'GREY',
      quantityMetres: 100,
      inspections: [{
        stage: 'GREY',
        result: 'PASS',
        defects: [],
        inspectedAt: new Date(now.getTime() - 2 * day),
        machineCode: 'LM-TEST',
      }],
    },
  ];
  const alertsExact = computeQualityAnalytics({ rolls: rollsExactMin, machines: [{ code: 'LM-TEST' }], now }).alerts;
  assert(
    alertsExact.some((a) => a.type === 'MACHINE_DEFECT_RATE' && a.severity === 'WARN'),
    'MIN_SAMPLE=5 with 40% non-pass triggers MACHINE_DEFECT_RATE (WARN)'
  );

  // 4c. Overdue SLA: entered 4.1 hours ago without inspection -> triggers INSPECTION_OVERDUE
  const overdueRoll = {
    rollId: 'FR-SLA-1',
    stage: 'GREY',
    stageEnteredAt: new Date(now.getTime() - 4.1 * hour),
    qualityStatus: 'PENDING',
    dispatchStatus: 'NOT_DISPATCHED',
    inspections: [],
  };
  const alertsSla = computeQualityAnalytics({ rolls: [overdueRoll], machines: [], now }).alerts;
  assert(alertsSla.some((a) => a.type === 'INSPECTION_OVERDUE'), 'Stage age > 4.0h triggers INSPECTION_OVERDUE alert');

  // 4d. Recurrence Alert: exactly 3 occurrences of same defect on same machine within 14 days -> triggers RECURRING_DEFECT
  const recurringRolls = [1, 2, 3].map((i) => ({
    rollId: `FR-REC-${i}`,
    stage: 'GREY',
    inspections: [{
      stage: 'GREY',
      result: 'REWORK',
      defects: [{ code: 'WEFT_BAR', severity: 'MAJOR', quantity: 2 }],
      inspectedAt: new Date(now.getTime() - (i * 2) * day),
      machineCode: 'LM-02',
    }],
  }));
  const alertsRec = computeQualityAnalytics({ rolls: recurringRolls, machines: [{ code: 'LM-02' }], now }).alerts;
  assert(alertsRec.some((a) => a.type === 'RECURRING_DEFECT'), 'Threshold 3 occurrences triggers RECURRING_DEFECT alert');

  // 5. Garbage input battery for analytics
  const garbageAnalytics = computeQualityAnalytics({
    rolls: [{}, null, undefined, { inspections: [null, {}] }],
    machines: [null, {}],
    windowDays: 30,
    now,
  });
  assert(garbageAnalytics.stages.length === 4, 'Garbage input battery produces safe 4-stage analytics structure');
  assert(!isNaN(garbageAnalytics.lateDetectionRate), 'Late detection rate is never NaN');
};

// ============================================================================
// 6. MODULE 4C: CORRECTIVE ACTIONS (CAPA) PURE LOGIC UNIT TESTS
// ============================================================================
const runModule4CUnitTests = () => {
  console.log('\n--- 6. Module 4C: Corrective Actions (CAPA) Pure Logic Unit Tests ---');
  const now = new Date('2026-10-10T12:00:00.000Z');
  const day = 24 * 60 * 60 * 1000;

  // 1. Recurrence tracking after doneAt
  const caDone = {
    actionNumber: 'CA-2026-0001',
    defectCode: 'WEFT_BAR',
    machineCode: 'LM-02',
    status: 'DONE',
    doneAt: new Date(now.getTime() - 5 * day),
  };

  // Inspection after doneAt (3 days ago) with 2 WEFT_BAR defects
  const rollsAfter = [
    {
      rollId: 'FR-AFTER-1',
      stage: 'GREY',
      inspections: [
        {
          stage: 'GREY',
          result: 'REWORK',
          defects: [{ code: 'WEFT_BAR', severity: 'MAJOR', quantity: 2 }],
          inspectedAt: new Date(now.getTime() - 3 * day),
          machineCode: 'LM-02',
        },
      ],
    },
  ];

  const recResult = calculateActionRecurrence(caDone, rollsAfter, now);
  assert(recResult.recurred === true, 'Detects defect recurrence after doneAt');
  assert(recResult.recurrencesSinceFix === 2, 'Counts 2 recurrences since fix');
  assert(recResult.explanation.includes('occurred 2 time(s) on LM-02'), 'Provides plain-language explanation of recurrence');

  // 2. Verification Failed flag if status is VERIFIED and defect recurred
  const caVerifiedRecurred = {
    ...caDone,
    status: 'VERIFIED',
    verifiedAt: new Date(now.getTime() - 2 * day),
  };
  const recVerified = calculateActionRecurrence(caVerifiedRecurred, rollsAfter, now);
  assert(recVerified.verificationFailed === true, 'VERIFIED action with subsequent recurrence flags verificationFailed=true');
};

// ============================================================================
// 7. DATABASE INTEGRATION & CONFORMANCE ORACLE TESTS
// ============================================================================
const runDatabaseAndOracleTests = async () => {
  console.log('\n--- 7. Database Integration & Conformance Oracle Tests ---');
  await connectDB(config.mongoUri);

  try {
    const activeOrders = await ProductionOrder.find({ status: { $in: ['in_progress', 'on_hold', 'queued', 'draft'] } })
      .populate('assignedMachine')
      .lean();

    assert(activeOrders.length >= 8, `Active production orders in DB (${activeOrders.length} >= 8)`);

    const now = new Date();

    // Conformance Oracle on orders
    let oracleMatches = 0;
    activeOrders.forEach((order) => {
      const engineResult = evaluateOrderRisk(order, now);
      const req = Number(order.requiredQuantity ?? order.quantity);
      const prod = Number(order.producedQuantity ?? 0);
      const rem = req - prod;
      const rate = Number(order.productionRatePerDay ?? (order.assignedMachine?.dailyCapacity ?? order.assignedMachine?.capacity));
      const hasValidRate = !isNaN(rate) && rate > 0;
      const deadline = getEndOfDayInTimezone(order.dueDate);
      const isPastDue = deadline ? now.getTime() > deadline.getTime() : false;

      let expectedStatus = 'INSUFFICIENT_DATA';
      if (!order.dueDate || !deadline) expectedStatus = 'INSUFFICIENT_DATA';
      else if (isPastDue) expectedStatus = 'OVERDUE';
      else if (!hasValidRate) expectedStatus = 'INSUFFICIENT_DATA';
      else {
        const estDays = rem / rate;
        const availDays = (deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
        expectedStatus = estDays > availDays + 1e-9 ? 'AT_RISK' : 'ON_TRACK';
      }

      if (engineResult.status === expectedStatus) oracleMatches++;
    });
    assert(oracleMatches === activeOrders.length, `Delay Radar Oracle: ${oracleMatches}/${activeOrders.length} active orders match plain math`);

    // Derived on Read Check: No alert or yield fields stored in FabricRoll documents
    const sampleRollDoc = await FabricRoll.findOne({ rollId: 'FR-2026-000005' }).lean();
    assert(sampleRollDoc.fpy === undefined, 'FabricRoll document has NO stored fpy field');
    assert(sampleRollDoc.alerts === undefined, 'FabricRoll document has NO stored alerts field');
    assert(sampleRollDoc.hotspot === undefined, 'FabricRoll document has NO stored hotspot field');

    // Quality Summary Oracle Check
    const [allRolls, allMachines, allCAs] = await Promise.all([
      FabricRoll.find().populate('machine'),
      Machine.find(),
      CorrectiveAction.find(),
    ]);

    const liveSummary = computeQualityAnalytics({
      rolls: allRolls,
      machines: allMachines,
      correctiveActions: allCAs,
      windowDays: 30,
      now,
    });
    assert(liveSummary.stages.length === 4, 'Quality summary computed across all 4 stages');
    assert(liveSummary.alerts.length >= 2, `Control Tower generated ${liveSummary.alerts.length} active alerts`);

    // CAPA Model checks
    const sampleCA = await CorrectiveAction.findOne({ actionNumber: 'CA-2026-0003' }).lean();
    assert(sampleCA !== null, 'Found seeded CAPA action CA-2026-0003');
    assert(sampleCA.status === 'DONE', 'CA-2026-0003 status is DONE');

  } finally {
    await disconnectDB();
  }
};

const main = async () => {
  console.log('🧪 Starting LoomIQ Platform Automated Test Suite (Modules 1, 2, 3, 4)...');
  runModule1UnitTests();
  runModule2UnitTests();
  runModule3DelayRadarUnitTests();
  runModule4AUnitTests();
  runModule4BUnitTests();
  runModule4CUnitTests();
  await runDatabaseAndOracleTests();

  console.log('\n======================================');
  console.log(`Test Results: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

main();
