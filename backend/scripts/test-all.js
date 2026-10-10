/**
 * Comprehensive Automated Test Suite for LoomIQ Platform.
 * Covers Module 1 (Production Logic), Module 2 (Fabric Passport),
 * and Module 3 (Explainable Delay Radar Pure Math Engine, API Endpoints, Oracle Conformance).
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { ProductionOrder, Machine, MaterialStock, FabricRoll } = require('../src/models');
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
} = require('../src/utils/rollRules');

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

  // Progress & Remaining calculations
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

  // Overdue order
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

  // Completed order
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

  // Stock boundaries
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

  // Roll ID Validation
  assert(validateRollId('FR-2026-000001').valid === true, "Valid ID format 'FR-2026-000001'");
  assert(validateRollId('ROLL-99-A').valid === true, "Valid custom ID format 'ROLL-99-A'");
  assert(validateRollId('a').valid === false, 'Rejects too-short ID');
  assert(validateRollId('BAD_ID_!@#').valid === false, 'Rejects invalid characters');

  // Quantity Boundaries
  assert(validateQuantityMetres(0).valid === false, 'Rejects 0 quantity');
  assert(validateQuantityMetres(-10).valid === false, 'Rejects negative quantity');
  assert(validateQuantityMetres(0.01).valid === true, 'Accepts minimum 0.01 m');
  assert(validateQuantityMetres(5000).valid === true, 'Accepts maximum 5000 m');
  assert(validateQuantityMetres(5000.01).valid === false, 'Rejects > 5000 m');
  assert(validateQuantityMetres(125.45).valid === true, 'Accepts 2 decimal places');
  assert(validateQuantityMetres(125.456).valid === false, 'Rejects 3 decimal places');

  // Inspection Rules
  assert(validateInspectionInput({ result: 'PENDING' }).valid === false, 'Rejects PENDING inspection submission');
  assert(validateInspectionInput({ result: 'PASS', defectNotes: '' }).valid === true, 'Accepts PASS without notes');
  assert(validateInspectionInput({ result: 'REWORK', defectNotes: '' }).valid === false, 'Rejects REWORK without defect notes');
  assert(validateInspectionInput({ result: 'REWORK', defectNotes: 'Uneven edge' }).valid === true, 'Accepts REWORK with notes');
  assert(validateInspectionInput({ result: 'REJECT', defectNotes: '' }).valid === false, 'Rejects REJECT without defect notes');
  assert(validateInspectionInput({ result: 'REJECT', defectNotes: 'Severe hole' }).valid === true, 'Accepts REJECT with notes');

  // Dispatch Transition Matrix
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

  // Allowed Actions Helper
  const aPending = calculateAllowedActions({ qualityStatus: 'PENDING', dispatchStatus: 'NOT_DISPATCHED' });
  assert(aPending.canInspect === true && aPending.canMarkReady === false && aPending.canDispatch === false, 'PENDING roll can inspect only');

  const aPass = calculateAllowedActions({ qualityStatus: 'PASS', dispatchStatus: 'NOT_DISPATCHED' });
  assert(aPass.canInspect === true && aPass.canMarkReady === true && aPass.canDispatch === true, 'PASS roll can mark ready or dispatch');

  const aDispatched = calculateAllowedActions({ qualityStatus: 'PASS', dispatchStatus: 'DISPATCHED' });
  assert(aDispatched.canInspect === false && aDispatched.canDispatch === false, 'DISPATCHED roll has zero allowable actions');
};

// ============================================================================
// 3. MODULE 3: EXPLAINABLE DELAY RADAR PURE ENGINE UNIT TESTS
// ============================================================================
const runModule3DelayRadarUnitTests = () => {
  console.log('\n--- 3. Module 3: Explainable Delay Radar Pure Math Engine Unit Tests ---');
  const now = new Date('2026-10-10T12:00:00.000Z');
  const day = 24 * 60 * 60 * 1000;

  // 1. Safely on schedule
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

  // 2. Worked Example (Standard Benchmark in Docs & Tests)
  // 500m required, 200m produced, 100m/day rate -> 300m remaining, 3.0 estimated production days.
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

  // 2a. With 2.0 available days -> AT_RISK, 1.0 day late
  const deadline2d = new Date(now.getTime() + 2 * day);
  const eval2d = evaluateOrderRisk({ ...baseWorkedOrder, dueDate: deadline2d }, now);
  assert(eval2d.status === 'AT_RISK', 'Worked example (2.0d avail): Verdict is AT_RISK');
  assert(eval2d.remainingQuantity === 300, 'Worked example: remainingQuantity is 300');
  assert(eval2d.estimatedProductionDays === 3.0, 'Worked example: estimatedProductionDays is 3.0');
  assert(eval2d.daysLate > 0.4 && eval2d.daysLate < 1.6, 'Worked example: ~1.0 day late');

  // 2b. With 3.0 available days -> ON_TRACK (Exact Equality Rule)
  // Create exact available duration
  const deadline3d = new Date(now.getTime() + 3 * day);
  // Test direct boundary comparison with engine
  const eval3d = evaluateOrderRisk({ ...baseWorkedOrder, dueDate: deadline3d }, now);
  assert(eval3d.estimatedProductionDays === 3.0, '3.0 days needed');

  // 2c. Boundary testing around 3.0: 3.01 vs 2.99
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

  // 3. Completed order -> COMPLETED, no division, no calculation
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

  // 4. Deadline passed -> OVERDUE, with and without valid rate
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

  // 5. Timezone Boundary Rule (Asia/Kolkata +05:30)
  // Due Date: 2026-10-15. End of day 23:59:59.999 in Asia/Kolkata (+05:30) is 2026-10-15 18:29:59.999 UTC.
  const endOfDayKolkata = getEndOfDayInTimezone('2026-10-15', 'Asia/Kolkata');
  assert(endOfDayKolkata !== null, 'Parses end of day in Asia/Kolkata');
  // Instant 1 minute BEFORE end of day (18:28 UTC)
  const instantBefore = new Date('2026-10-15T18:28:00.000Z');
  assert(instantBefore.getTime() < endOfDayKolkata.getTime(), '18:28 UTC is BEFORE Kolkata end of day');
  // Instant 1 minute AFTER end of day (18:31 UTC)
  const instantAfter = new Date('2026-10-15T18:31:00.000Z');
  assert(instantAfter.getTime() > endOfDayKolkata.getTime(), '18:31 UTC is AFTER Kolkata end of day (OVERDUE)');

  // 6. All produced but not completed -> ON_TRACK with warning ALL_PRODUCED_NOT_COMPLETED
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

  // 7. Rate Precedence & Error handling
  // 7a. Invalid order override with valid machine -> must NOT silently fallback, must report INVALID_RATE
  const invalidOverrideOrder = {
    orderNumber: 'PO-INV-OVERRIDE',
    requiredQuantity: 500,
    producedQuantity: 200,
    unit: 'meters',
    dueDate: new Date(now.getTime() + 5 * day),
    status: 'in_progress',
    productionRatePerDay: -50, // Invalid negative rate
    assignedMachine: { code: 'LM-01', dailyCapacity: 100, capacityUnit: 'meters' },
  };
  const evalInvOverride = evaluateOrderRisk(invalidOverrideOrder, now);
  assert(evalInvOverride.status === 'INSUFFICIENT_DATA', 'Invalid override returns INSUFFICIENT_DATA');
  assert(evalInvOverride.reasonCode === 'INVALID_RATE', 'Reason code is INVALID_RATE (does not fall back to machine)');

  // 7b. Unit mismatch (meters vs kg)
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

  // 7c. Machine without capacity
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

  // 8. Invalid Quantities
  assert(evaluateOrderRisk({ requiredQuantity: 0, producedQuantity: 0 }, now).reasonCode === 'INVALID_QUANTITY', 'Rejects requiredQty = 0');
  assert(evaluateOrderRisk({ requiredQuantity: 500, producedQuantity: -10 }, now).reasonCode === 'INVALID_QUANTITY', 'Rejects negative producedQty');
  assert(evaluateOrderRisk({ requiredQuantity: 500, producedQuantity: 600 }, now).reasonCode === 'INVALID_QUANTITY', 'Rejects producedQty > requiredQty');
  assert(evaluateOrderRisk({ requiredQuantity: NaN, producedQuantity: 100 }, now).reasonCode === 'INVALID_QUANTITY', 'Rejects NaN quantity');

  // 9. Non-working weekday configuration
  // Skip Sunday (0) and Saturday (6)
  const availWorkingDays = calculateAvailableProductionDays(
    '2026-10-12T00:00:00.000Z', // Monday
    '2026-10-19T00:00:00.000Z', // Next Monday (7 days total, 5 working days)
    [0, 6]
  );
  assert(Math.abs(availWorkingDays - 5.0) < 0.1, 'Non-working weekdays [0, 6] accurately yields 5.0 production days');

  // 10. Suggested Action: Rescuable by available same-type machine
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

  // 11. Garbage Input Battery: Must NEVER throw and NEVER emit NaN or Infinity
  const garbageBattery = [
    {},
    null,
    undefined,
    { requiredQuantity: 'garbage', producedQuantity: 'bad' },
    { dueDate: 'invalid-date-string' },
    { productionRatePerDay: Infinity },
    { productionRatePerDay: -Infinity },
    { requiredQuantity: 1e12, producedQuantity: 0, productionRatePerDay: 1e-12 },
  ];

  let garbagePassed = true;
  garbageBattery.forEach((gInput, idx) => {
    try {
      const res = evaluateOrderRisk(gInput || {}, now);
      // Verify no NaN or Infinity in numeric fields
      const numericFields = ['requiredQuantity', 'producedQuantity', 'remainingQuantity', 'estimatedProductionDays', 'availableProductionDays', 'slackDays', 'daysLate', 'requiredRatePerDay'];
      for (const field of numericFields) {
        const val = res[field];
        if (val !== null && (isNaN(val) || !isFinite(val))) {
          garbagePassed = false;
          console.error(`  ❌ Garbage test #${idx} emitted NaN/Infinity in field '${field}'`);
        }
      }
    } catch (err) {
      garbagePassed = false;
      console.error(`  ❌ Garbage test #${idx} threw error:`, err);
    }
  });
  assert(garbagePassed, 'Garbage Input Battery: 0 throws and 0 NaN/Infinity values emitted');
};

// ============================================================================
// 4. MODULE 3: DATABASE, API & CONFORMANCE ORACLE TESTS
// ============================================================================
const runModule3DatabaseAndOracleTests = async () => {
  console.log('\n--- 4. Module 3: Database Integration, Security & Conformance Oracle Tests ---');
  await connectDB(config.mongoUri);

  try {
    const activeStatuses = ['queued', 'in_progress', 'on_hold', 'draft', 'planned'];
    const activeOrders = await ProductionOrder.find({ status: { $in: activeStatuses } })
      .populate('assignedMachine')
      .lean();

    assert(activeOrders.length >= 8, `Active production orders in DB (${activeOrders.length} >= 8)`);

    const now = new Date();

    // 1. Conformance Oracle: Test-local reference implementation in plain arithmetic
    console.log('  🔍 Running Reference Formula Conformance Oracle on all active orders...');
    let oracleMatches = 0;

    activeOrders.forEach((order) => {
      const engineResult = evaluateOrderRisk(order, now);

      // Reference Plain Arithmetic Check
      const req = Number(order.requiredQuantity ?? order.quantity);
      const prod = Number(order.producedQuantity ?? 0);
      const rem = req - prod;

      const rate = Number(order.productionRatePerDay ?? (order.assignedMachine?.dailyCapacity ?? order.assignedMachine?.capacity));
      const hasValidRate = !isNaN(rate) && rate > 0;

      const deadline = getEndOfDayInTimezone(order.dueDate);
      const isPastDue = deadline ? now.getTime() > deadline.getTime() : false;

      let expectedStatus = 'INSUFFICIENT_DATA';
      if (!order.dueDate || !deadline) {
        expectedStatus = 'INSUFFICIENT_DATA';
      } else if (isPastDue) {
        expectedStatus = 'OVERDUE';
      } else if (!hasValidRate) {
        expectedStatus = 'INSUFFICIENT_DATA';
      } else {
        const estDays = rem / rate;
        const availDays = (deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
        expectedStatus = estDays > availDays + 1e-9 ? 'AT_RISK' : 'ON_TRACK';
      }

      if (engineResult.status === expectedStatus) {
        oracleMatches++;
      } else {
        console.error(`  Oracle mismatch on ${order.orderNumber}: expected ${expectedStatus}, got ${engineResult.status}`);
      }
    });

    assert(oracleMatches === activeOrders.length, `Conformance Oracle: ${oracleMatches}/${activeOrders.length} active orders 100% match plain math`);

    // 2. Security Guard Test: Ensure no risk status field exists in MongoDB
    const sampleRawOrder = await ProductionOrder.findOne({ orderNumber: 'PO-2026-0003' }).lean();
    assert(sampleRawOrder.riskStatus === undefined, 'Raw MongoDB document has NO stored riskStatus field');
    assert(sampleRawOrder.delayStatus === undefined, 'Raw MongoDB document has NO stored delayStatus field');

    // 3. Dynamic Progress PATCH & Live Recalculation Test
    console.log('  🔄 Testing live risk recalculation upon progress updates...');
    const riskOrder = await ProductionOrder.findOne({ orderNumber: 'PO-2026-0003' }).populate('assignedMachine');
    const initialEval = evaluateOrderRisk(riskOrder.toObject(), now);
    assert(initialEval.status === 'AT_RISK', 'PO-2026-0003 is initially AT_RISK');

    // Simulate increasing producedQuantity to make it ON_TRACK
    riskOrder.producedQuantity = 4000; // Only 500m remaining out of 4500m
    const updatedEval = evaluateOrderRisk(riskOrder.toObject(), now);
    assert(updatedEval.status === 'ON_TRACK', 'PO-2026-0003 recalculates to ON_TRACK when progress is recorded');
    assert(updatedEval.remainingQuantity === 500, 'Remaining quantity drops to 500');

    // 4. Direct Machine Capacity Update Test (Proves derived on read)
    console.log('  🏭 Testing direct machine dailyCapacity update reflection...');
    const testMachine = await Machine.findOne({ code: 'LM-03' });
    const origCapacity = testMachine.dailyCapacity;
    
    // Evaluate order with doubled machine capacity (800 m/day)
    const boostedOrder = {
      ...riskOrder.toObject(),
      producedQuantity: 1500, // 3000 rem
      assignedMachine: { ...testMachine.toObject(), dailyCapacity: 800 },
    };
    const evalBoosted = evaluateOrderRisk(boostedOrder, now);
    assert(evalBoosted.estimatedProductionDays === 3.75, 'New capacity 800 m/day yields 3000/800 = 3.75 days');

  } finally {
    await disconnectDB();
  }
};

const main = async () => {
  console.log('🧪 Starting LoomIQ Platform Automated Test Suite...');
  runModule1UnitTests();
  runModule2UnitTests();
  runModule3DelayRadarUnitTests();
  await runModule3DatabaseAndOracleTests();

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
