/**
 * Full End-to-End Integration Test Suite for LoomIQ.
 * Tests Phase 1, Phase 2, Phase 3 (Workflows A, B, C), and Phase 4 (Cross-Cutting Checks)
 * against dedicated verification database: loomiq_verify
 */
const http = require('http');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const { ProductionOrder, Machine, MaterialStock, FabricRoll, Counter, User, Session } = require('../src/models');
const app = require('../src/app');
const { evaluateOrderRisk, getEndOfDayInTimezone } = require('../src/utils/delayRadarEngine');
const { hashPassword, generateOpaqueToken, hashToken } = require('../src/utils/security');

const VERIFY_DB_URI = process.env.VERIFY_MONGODB_URI || 'mongodb://127.0.0.1:27017/loomiq_verify';
const EMPTY_DB_URI = 'mongodb://127.0.0.1:27017/loomiq_empty';
const TEST_PORT = 5055;

let server;
let passedTests = 0;
let failedTests = 0;
const defectLog = [];
let authCookie = null;

const assert = (condition, description, defectInfo = null) => {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    if (defectInfo) {
      console.error(`     Details:`, JSON.stringify(defectInfo));
    }
    failedTests++;
    if (defectInfo) {
      defectLog.push(defectInfo);
    }
  }
};

const makeRequest = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Accept': 'application/json',
      'Origin': 'http://localhost:5173',
      ...(authCookie ? { 'Cookie': authCookie } : {}),
    };
    if (postData) {
      defaultHeaders['Content-Type'] = 'application/json';
    }
    const finalHeaders = { ...defaultHeaders, ...(options.headers || {}) };

    const req = http.request({ ...options, headers: finalHeaders }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
};

// Seed dedicated verification database
const seedVerificationDB = async () => {
  console.log('🌱 Seeding dedicated verification database (loomiq_verify)...');
  await connectDB(VERIFY_DB_URI);

  await ProductionOrder.deleteMany({});
  await Machine.deleteMany({});
  await MaterialStock.deleteMany({});
  await FabricRoll.deleteMany({});
  await Counter.deleteMany({});
  await User.deleteMany({});
  await Session.deleteMany({});

  // Create verification owner user & active session
  const verifyPassHash = await hashPassword('VerifyPassword123!');
  const verifyOwner = await User.create({
    name: 'Alex Carter (Senior QA)',
    email: 'verify-owner@loomiq.internal',
    passwordHash: verifyPassHash,
    role: 'owner',
    isActive: true,
  });

  const rawSessionToken = generateOpaqueToken();
  const sessionTokenHash = hashToken(rawSessionToken);
  const now = new Date();

  await Session.create({
    tokenHash: sessionTokenHash,
    user: verifyOwner._id,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
    absoluteExpiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
    ip: '127.0.0.1',
  });

  authCookie = `loomiq_session=${rawSessionToken}`;

  const day = 24 * 60 * 60 * 1000;

  // 1. Machines
  const machineDefs = [
    { code: 'LM-01', name: 'Air-Jet Loom Alpha 1', type: 'loom', status: 'running', dailyCapacity: 600, capacity: 600, capacityUnit: 'meters', isDemo: true },
    { code: 'LM-02', name: 'Air-Jet Loom Alpha 2', type: 'loom', status: 'running', dailyCapacity: 500, capacity: 500, capacityUnit: 'meters', isDemo: true },
    { code: 'LM-03', name: 'Rapier Loom Beta 1', type: 'loom', status: 'running', dailyCapacity: 400, capacity: 400, capacityUnit: 'meters', isDemo: true },
    { code: 'LM-04', name: 'Rapier Loom Beta 2', type: 'loom', status: 'available', dailyCapacity: 500, capacity: 500, capacityUnit: 'meters', isDemo: true },
    { code: 'KN-01', name: 'Circular Knit Station 1', type: 'knitting_machine', status: 'available', dailyCapacity: 350, capacity: 350, capacityUnit: 'meters', isDemo: true },
    { code: 'KN-02', name: 'Flatbed Knit Station 2', type: 'knitting_machine', status: 'available', dailyCapacity: 300, capacity: 300, capacityUnit: 'meters', isDemo: true },
    { code: 'DY-01', name: 'High-Temp Jet Dyeing Vat', type: 'dyeing_vat', status: 'maintenance', dailyCapacity: 800, capacity: 800, capacityUnit: 'kg', isDemo: true },
    { code: 'FN-01', name: 'Stenter Finishing Range', type: 'finishing_range', status: 'maintenance', dailyCapacity: 700, capacity: 700, capacityUnit: 'meters', isDemo: true },
  ];

  const machineMap = {};
  for (const m of machineDefs) {
    const saved = await Machine.create(m);
    machineMap[m.code] = saved;
  }

  // 2. Material Stock
  const stockDefs = [
    { sku: 'DYE-IND-01', name: 'Indigo Reactive Dye Blue 5R', quantityOnHand: 0, unit: 'kg', reorderLevel: 150, supplier: 'ColorChem Synthetics', isDemo: true },
    { sku: 'YRN-COT-30S', name: '30s Ne Combed Ring-Spun Cotton', quantityOnHand: 180, unit: 'kg', reorderLevel: 500, supplier: 'Apex Spun Mills', isDemo: true },
    { sku: 'CHM-SFT-02', name: 'Silicone Fabric Softener Emulsion', quantityOnHand: 45, unit: 'liters', reorderLevel: 100, supplier: 'AuxiTex Industries', isDemo: true },
    { sku: 'YRN-VIS-40S', name: '40s Viscose Staple Fiber Yarn', quantityOnHand: 80, unit: 'kg', reorderLevel: 250, supplier: 'Eastern Fiber Corp.', isDemo: true },
    { sku: 'YRN-PLY-150D', name: '150D Textured Polyester DTY', quantityOnHand: 2400, unit: 'kg', reorderLevel: 600, supplier: 'Reliance Poly Mills', isDemo: true },
    { sku: 'DYE-BLK-02', name: 'Reactive Black Dye B-133', quantityOnHand: 850, unit: 'kg', reorderLevel: 200, supplier: 'ColorChem Synthetics', isDemo: true },
  ];
  await MaterialStock.insertMany(stockDefs);

  // 3. Orders
  const orderDefs = [
    { orderNumber: 'PO-2026-0001', customer: 'Meridian Apparel Co.', fabricType: '100% Combed Cotton Single Jersey 180 GSM', requiredQuantity: 6000, producedQuantity: 3600, unit: 'meters', startDate: new Date(now.getTime() - 10 * day), dueDate: new Date(now.getTime() + 10 * day), status: 'in_progress', currentStage: 'weaving', priority: 'high', assignedMachine: machineMap['LM-01']._id, isDemo: true },
    { orderNumber: 'PO-2026-0002', customer: 'Aura Fashion Group', fabricType: '98/2 Cotton Spandex Twill Denim 11.5 Oz', requiredQuantity: 8000, producedQuantity: 5600, unit: 'meters', productionRatePerDay: 800, startDate: new Date(now.getTime() - 14 * day), dueDate: new Date(now.getTime() + 8 * day), status: 'in_progress', currentStage: 'weaving', priority: 'urgent', assignedMachine: machineMap['LM-02']._id, isDemo: true },
    { orderNumber: 'PO-2026-0003', customer: 'Cascade Sportswear', fabricType: '100% Polyester Quick-Dry Birdseye Mesh', requiredQuantity: 4500, producedQuantity: 1500, unit: 'meters', startDate: new Date(now.getTime() - 4 * day), dueDate: new Date(now.getTime() + 4 * day), status: 'in_progress', currentStage: 'weaving', priority: 'medium', assignedMachine: machineMap['LM-03']._id, isDemo: true },
    { orderNumber: 'PO-2026-0004', customer: 'Loom & Linen Corp.', fabricType: '60/40 Linen Cotton Plain Weave 160 GSM', requiredQuantity: 3000, producedQuantity: 1200, unit: 'meters', startDate: new Date(now.getTime() - 5 * day), dueDate: new Date(now.getTime() + 15 * day), status: 'in_progress', currentStage: 'weaving', priority: 'low', assignedMachine: null, isDemo: true },
    { orderNumber: 'PO-2026-0005', customer: 'Vanguard Uniforms Ltd.', fabricType: '65/35 Poly-Cotton Heavy Drill 240 GSM', requiredQuantity: 5000, producedQuantity: 5000, unit: 'meters', startDate: new Date(now.getTime() - 20 * day), dueDate: new Date(now.getTime() - 2 * day), status: 'completed', currentStage: 'dispatched', priority: 'high', assignedMachine: null, isDemo: true },
    { orderNumber: 'PO-2026-0006', customer: 'Meridian Apparel Co.', fabricType: '100% Cotton Poplin Solid Dyed 120 GSM', requiredQuantity: 4000, producedQuantity: 4000, unit: 'meters', startDate: new Date(now.getTime() - 15 * day), dueDate: new Date(now.getTime() - 1 * day), status: 'completed', currentStage: 'dispatched', priority: 'medium', assignedMachine: null, isDemo: true },
    { orderNumber: 'PO-2026-0007', customer: 'Nordic Knitwear Co.', fabricType: '100% Viscose Rib Knit 220 GSM', requiredQuantity: 2500, producedQuantity: 2500, unit: 'meters', startDate: new Date(now.getTime() - 12 * day), dueDate: new Date(now.getTime() - 3 * day), status: 'completed', currentStage: 'dispatched', priority: 'low', assignedMachine: null, isDemo: true },
    { orderNumber: 'PO-2026-0008', customer: 'Aura Fashion Group', fabricType: '100% Rayon Challis Botanical Print Yarn', requiredQuantity: 5000, producedQuantity: 1000, unit: 'kg', startDate: new Date(now.getTime() - 9 * day), dueDate: new Date(now.getTime() + 2 * day), status: 'in_progress', currentStage: 'dyeing', priority: 'urgent', assignedMachine: machineMap['DY-01']._id, isDemo: true },
    { orderNumber: 'PO-2026-0009', customer: 'Vanguard Uniforms Ltd.', fabricType: '100% Nylon Oxford Waterproof 210D', requiredQuantity: 3500, producedQuantity: 2000, unit: 'meters', startDate: new Date(now.getTime() - 10 * day), dueDate: new Date(now.getTime() + 12 * day), status: 'on_hold', currentStage: 'finishing', priority: 'high', assignedMachine: machineMap['LM-01']._id, isDemo: true },
    { orderNumber: 'PO-2026-0010', customer: 'Cascade Sportswear', fabricType: '88/12 Poly-Spandex Interlock 260 GSM', requiredQuantity: 4000, producedQuantity: 2800, unit: 'meters', startDate: new Date(now.getTime() - 15 * day), dueDate: new Date(now.getTime() - 3 * day), status: 'in_progress', currentStage: 'quality_inspection', priority: 'urgent', assignedMachine: machineMap['LM-02']._id, isDemo: true },
    { orderNumber: 'PO-2026-0011', customer: 'Apex Textiles Ltd.', fabricType: '100% Combed Cotton Oxford 150 GSM', requiredQuantity: 6500, producedQuantity: 4200, unit: 'meters', startDate: new Date(now.getTime() - 14 * day), dueDate: new Date(now.getTime() - 1 * day), status: 'in_progress', currentStage: 'finishing', priority: 'high', assignedMachine: machineMap['LM-03']._id, isDemo: true },
    { orderNumber: 'PO-2026-0012', customer: 'Loom & Linen Corp.', fabricType: '55/45 Cotton Poly Slub Yarn Fabric', requiredQuantity: 7000, producedQuantity: 2000, unit: 'meters', startDate: new Date(now.getTime() + 1 * day), dueDate: new Date(now.getTime() + 20 * day), status: 'queued', currentStage: 'spinning', priority: 'medium', assignedMachine: machineMap['LM-02']._id, isDemo: true },
  ];

  const orderMap = {};
  for (const o of orderDefs) {
    const saved = await ProductionOrder.create(o);
    orderMap[o.orderNumber] = saved;
    if (o.assignedMachine && o.status === 'in_progress') {
      await Machine.findByIdAndUpdate(o.assignedMachine, { currentAssignedOrder: saved._id });
    }
  }

  // 4. Fabric Rolls
  const rollDefs = [
    { rollId: 'FR-2026-000001', stage: 'GREY', order: orderMap['PO-2026-0001']._id, machine: machineMap['LM-01']._id, quantityMetres: 120.5, qualityStatus: 'PENDING', dispatchStatus: 'NOT_DISPATCHED', isDemo: true },
    { rollId: 'FR-2026-000002', stage: 'GREY', order: orderMap['PO-2026-0001']._id, machine: machineMap['LM-01']._id, quantityMetres: 118.0, qualityStatus: 'PENDING', dispatchStatus: 'NOT_DISPATCHED', isDemo: true },
    { rollId: 'FR-2026-000003', stage: 'GREY', order: orderMap['PO-2026-0002']._id, machine: machineMap['LM-02']._id, quantityMetres: 240.0, qualityStatus: 'PENDING', dispatchStatus: 'NOT_DISPATCHED', isDemo: true },
    { rollId: 'FR-2026-000004', stage: 'GREY', order: orderMap['PO-2026-0001']._id, machine: machineMap['LM-01']._id, quantityMetres: 125.0, qualityStatus: 'PASS', dispatchStatus: 'NOT_DISPATCHED', inspectedAt: new Date(now.getTime() - 2 * day), inspections: [{ stage: 'GREY', result: 'PASS', defectNotes: 'Clear weave pattern', inspectorName: 'Devon Vance', inspectedAt: new Date(now.getTime() - 2 * day) }], isDemo: true },
    { rollId: 'FR-2026-000005', stage: 'FINAL', order: orderMap['PO-2026-0002']._id, machine: machineMap['LM-02']._id, quantityMetres: 250.0, qualityStatus: 'PASS', dispatchStatus: 'READY_FOR_DISPATCH', inspectedAt: new Date(now.getTime() - 3 * day), inspections: [{ stage: 'FINAL', result: 'PASS', defectNotes: 'Uniform denim', inspectorName: 'Sarah Lin', inspectedAt: new Date(now.getTime() - 3 * day) }], isDemo: true },
    { rollId: 'FR-2026-000006', stage: 'FINAL', order: orderMap['PO-2026-0003']._id, machine: machineMap['LM-03']._id, quantityMetres: 180.0, qualityStatus: 'PASS', dispatchStatus: 'READY_FOR_DISPATCH', inspectedAt: new Date(now.getTime() - 1 * day), inspections: [{ stage: 'FINAL', result: 'PASS', defectNotes: 'Wicking verified', inspectorName: 'Marcus Cole', inspectedAt: new Date(now.getTime() - 1 * day) }], isDemo: true },
    { rollId: 'FR-2026-000007', stage: 'FINAL', order: orderMap['PO-2026-0005']._id, machine: machineMap['LM-01']._id, quantityMetres: 300.0, qualityStatus: 'PASS', dispatchStatus: 'DISPATCHED', dispatchedAt: new Date(now.getTime() - 2 * day), inspectedAt: new Date(now.getTime() - 5 * day), inspections: [{ stage: 'FINAL', result: 'PASS', defectNotes: 'Passed A grade', inspectorName: 'Devon Vance', inspectedAt: new Date(now.getTime() - 5 * day) }], isDemo: true },
    { rollId: 'FR-2026-000008', stage: 'FINAL', order: orderMap['PO-2026-0006']._id, machine: machineMap['LM-04']._id, quantityMetres: 200.0, qualityStatus: 'PASS', dispatchStatus: 'DISPATCHED', dispatchedAt: new Date(now.getTime() - 1 * day), inspectedAt: new Date(now.getTime() - 4 * day), inspections: [{ stage: 'FINAL', result: 'PASS', defectNotes: 'Poplin approved', inspectorName: 'Sarah Lin', inspectedAt: new Date(now.getTime() - 4 * day) }], isDemo: true },
    { rollId: 'FR-2026-000009', stage: 'GREY', order: orderMap['PO-2026-0002']._id, machine: machineMap['LM-02']._id, quantityMetres: 210.5, qualityStatus: 'REWORK', dispatchStatus: 'NOT_DISPATCHED', inspectedAt: new Date(now.getTime() - 1 * day), inspections: [{ stage: 'GREY', result: 'REWORK', defectNotes: 'Uneven selvedge tension', inspectorName: 'Sarah Lin', inspectedAt: new Date(now.getTime() - 1 * day) }], isDemo: true },
    { rollId: 'FR-2026-000010', stage: 'FINAL', order: orderMap['PO-2026-0001']._id, machine: machineMap['LM-01']._id, quantityMetres: 145.0, qualityStatus: 'PASS', dispatchStatus: 'READY_FOR_DISPATCH', inspectedAt: new Date(now.getTime() - 6 * 3600000), inspections: [{ stage: 'GREY', result: 'REWORK', defectNotes: 'Excessive weft skew', inspectorName: 'Devon Vance', inspectedAt: new Date(now.getTime() - 2 * day) }, { stage: 'FINAL', result: 'PASS', defectNotes: 'Re-inspection straight', inspectorName: 'Sarah Lin', inspectedAt: new Date(now.getTime() - 6 * 3600000) }], isDemo: true },
    { rollId: 'FR-2026-000011', stage: 'DYEING', order: orderMap['PO-2026-0008']._id, machine: machineMap['DY-01']._id, quantityMetres: 160.0, qualityStatus: 'REJECT', dispatchStatus: 'NOT_DISPATCHED', inspectedAt: new Date(now.getTime() - 2 * day), inspections: [{ stage: 'DYEING', result: 'REJECT', defectNotes: 'Severe dye variation', inspectorName: 'Devon Vance', inspectedAt: new Date(now.getTime() - 2 * day) }], isDemo: true },
    { rollId: 'FR-2026-000012', stage: 'GREY', order: orderMap['PO-2026-0010']._id, machine: machineMap['KN-01']._id, quantityMetres: 95.0, qualityStatus: 'REJECT', dispatchStatus: 'NOT_DISPATCHED', inspectedAt: new Date(now.getTime() - 1 * day), inspections: [{ stage: 'GREY', result: 'REJECT', defectNotes: 'Continuous drop stitches', inspectorName: 'Marcus Cole', inspectedAt: new Date(now.getTime() - 1 * day) }], isDemo: true },
    { rollId: 'FR-2026-000013', stage: 'GREY', order: orderMap['PO-2026-0003']._id, machine: machineMap['LM-03']._id, quantityMetres: 175.0, qualityStatus: 'PASS', dispatchStatus: 'NOT_DISPATCHED', inspectedAt: new Date(now.getTime() - 8 * 3600000), inspections: [{ stage: 'GREY', result: 'PASS', defectNotes: 'Zero flaws', inspectorName: 'Sarah Lin', inspectedAt: new Date(now.getTime() - 8 * 3600000) }], isDemo: true },
    { rollId: 'FR-2026-000014', stage: 'GREY', order: orderMap['PO-2026-0004']._id, machine: machineMap['LM-04']._id, quantityMetres: 110.0, qualityStatus: 'PASS', dispatchStatus: 'NOT_DISPATCHED', inspectedAt: new Date(now.getTime() - 12 * 3600000), inspections: [{ stage: 'GREY', result: 'PASS', defectNotes: 'Linen blend acceptable', inspectorName: 'Devon Vance', inspectedAt: new Date(now.getTime() - 12 * 3600000) }], isDemo: true },
  ];
  await FabricRoll.insertMany(rollDefs);

  const currentYear = new Date().getFullYear();
  await Counter.findOneAndUpdate({ name: `roll_${currentYear}` }, { $max: { seq: 14 } }, { upsert: true });

  console.log('✅ loomiq_verify database seeded successfully.');
};

const runAllTests = async () => {
  console.log('================================================================');
  console.log('🧪 RUNNING LOOMIQ FULL INTEGRATION TEST SUITE');
  console.log('================================================================');

  await seedVerificationDB();

  // Start test server on TEST_PORT
  server = app.listen(TEST_PORT);
  console.log(`📡 Test Express server listening on http://127.0.0.1:${TEST_PORT}`);

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: RUNTIME BASELINE & CORS TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- Section 1: Runtime Baseline & CORS Tests ---');

    // 1. Health check when connected (200 ok)
    const healthRes = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/health', method: 'GET' });
    assert(healthRes.status === 200 && healthRes.body.status === 'ok' && healthRes.body.database.status === 'connected', 'GET /api/health returns 200 ok when DB connected');

    // Test 503 degraded when disconnected
    await disconnectDB();
    const degradedRes = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/health', method: 'GET' });
    assert(degradedRes.status === 503 && degradedRes.body.status === 'degraded' && degradedRes.body.database.status === 'disconnected', 'GET /api/health returns 503 degraded when DB disconnected');
    await connectDB(VERIFY_DB_URI); // Reconnect for remaining tests

    // 2. CORS Preflight for GET, POST, PATCH from Vite dev origin (http://localhost:5173)
    const corsGet = await makeRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/orders',
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert(corsGet.headers['access-control-allow-origin'] === 'http://localhost:5173', 'CORS preflight allows GET from http://localhost:5173');

    const corsPatch = await makeRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/orders/PO-2026-0001',
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    assert(corsPatch.headers['access-control-allow-origin'] === 'http://localhost:5173', 'CORS preflight allows PATCH from http://localhost:5173');
    assert(corsPatch.headers['access-control-allow-methods']?.includes('PATCH'), 'CORS preflight methods include PATCH');

    // 3. CORS blocks disallowed origin
    const corsBlocked = await makeRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/orders',
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://malicious-site.com',
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert(!corsBlocked.headers['access-control-allow-origin'] || corsBlocked.status === 500, 'CORS blocks disallowed origin (http://malicious-site.com)');

    // ------------------------------------------------------------------------
    // SECTION 2: REFERENTIAL INTEGRITY CHECK
    // ------------------------------------------------------------------------
    console.log('\n--- Section 2: Referential Integrity Audit ---');
    const allRolls = await FabricRoll.find().lean();
    const allOrders = await ProductionOrder.find().lean();
    const allMachines = await Machine.find().lean();

    const orderIdSet = new Set(allOrders.map((o) => o._id.toString()));
    const machineIdSet = new Set(allMachines.map((m) => m._id.toString()));

    let rollsValid = true;
    for (const r of allRolls) {
      if (!orderIdSet.has(r.order.toString()) || !machineIdSet.has(r.machine.toString())) {
        rollsValid = false;
        console.error(`Orphan roll detected: ${r.rollId}`);
      }
    }
    assert(rollsValid && allRolls.length >= 14, `Referential Integrity: All ${allRolls.length} fabric rolls reference valid orders and machines`);

    let machineLinksValid = true;
    for (const m of allMachines) {
      if (m.currentAssignedOrder && !orderIdSet.has(m.currentAssignedOrder.toString())) {
        machineLinksValid = false;
        console.error(`Machine ${m.code} references invalid order`);
      }
    }
    assert(machineLinksValid, 'Referential Integrity: All machine assignments reference valid orders');

    // ------------------------------------------------------------------------
    // SECTION 3: WORKFLOW A (PRODUCTION)
    // ------------------------------------------------------------------------
    console.log('\n--- Section 3: Workflow A (Production) ---');

    // Step 1: Dashboard KPIs match independent DB counts
    const dashRes = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/dashboard/summary', method: 'GET' });
    assert(dashRes.status === 200, 'GET /api/dashboard/summary returns 200');
    assert(dashRes.body.kpis.activeOrders === 9, 'Dashboard activeOrders = 9');
    assert(dashRes.body.kpis.completedOrders === 3, 'Dashboard completedOrders = 3');
    assert(dashRes.body.kpis.totalOrders === 12, 'Dashboard totalOrders = 12');
    assert(dashRes.body.kpis.delayedOrders === 2, 'Dashboard delayedOrders = 2');
    assert(dashRes.body.kpis.atRiskOrders === 2, 'Dashboard atRiskOrders = 2');
    assert(dashRes.body.kpis.onTrackOrders === 4, 'Dashboard onTrackOrders = 4');
    assert(dashRes.body.kpis.insufficientData === 1, 'Dashboard insufficientData = 1');
    assert(dashRes.body.kpis.machines.total === 8, 'Dashboard machines total = 8');
    assert(dashRes.body.kpis.stock.totalItems === 6, 'Dashboard stock total = 6');

    // Step 2: Orders table query with filters and search
    const ordersRes = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/orders?status=in_progress', method: 'GET' });
    assert(ordersRes.status === 200 && ordersRes.body.orders.length === 7, 'Filter orders by status=in_progress returns 7 orders');

    const searchRes = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/orders?search=Meridian', method: 'GET' });
    assert(searchRes.status === 200 && searchRes.body.orders.length === 2, 'Search orders by "Meridian" returns 2 orders');

    // Step 3: Order detail retrieval
    const orderDetailRes = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/orders/PO-2026-0001', method: 'GET' });
    assert(orderDetailRes.status === 200, 'GET /api/orders/PO-2026-0001 returns 200');
    assert(orderDetailRes.body.order.buyer === 'Meridian Apparel Co.', 'Order detail buyer matches');
    assert(orderDetailRes.body.order.producedQuantity === 3600, 'Order detail producedQuantity matches');
    assert(orderDetailRes.body.order.remainingQuantity === 2400, 'Order detail remainingQuantity = 6000 - 3600 = 2400');
    assert(orderDetailRes.body.order.assignedMachine?.code === 'LM-01', 'Assigned machine LM-01 populated');

    // Step 4: 404 on unknown order & 400 on malformed ID
    const notFoundOrder = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/orders/PO-9999-9999', method: 'GET' });
    assert(notFoundOrder.status === 404 && notFoundOrder.body.error.code === 'ORDER_NOT_FOUND', 'Unknown order returns 404 ORDER_NOT_FOUND');

    const badOrderNumber = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/orders/invalid!id', method: 'GET' });
    assert(badOrderNumber.status === 400 && badOrderNumber.body.error.code === 'INVALID_ORDER_NUMBER', 'Malformed order ID returns 400 INVALID_ORDER_NUMBER');

    // ------------------------------------------------------------------------
    // SECTION 4: WORKFLOW B (FABRIC PASSPORT)
    // ------------------------------------------------------------------------
    console.log('\n--- Section 4: Workflow B (Fabric Passport) ---');

    // Step 1: Roll list & filtering
    const rollListRes = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/rolls?qualityStatus=PASS', method: 'GET' });
    assert(rollListRes.status === 200 && rollListRes.body.rolls.length === 8, 'Filter rolls by qualityStatus=PASS returns 8 rolls');

    // Step 2: Passport detail lookup
    const passportRes = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/rolls/FR-2026-000004', method: 'GET' });
    assert(passportRes.status === 200, 'GET /api/rolls/FR-2026-000004 returns 200');
    assert(passportRes.body.roll.qualityStatus === 'PASS', 'Passport qualityStatus is PASS');
    assert(passportRes.body.roll.order?.orderNumber === 'PO-2026-0001', 'Passport links to order PO-2026-0001');
    assert(passportRes.body.roll.machine?.code === 'LM-01', 'Passport links to machine LM-01');

    // Step 3: Inspection Form: REWORK/REJECT without defectNotes rejected with 422
    const badInspection = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/rolls/FR-2026-000001/inspection',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      { result: 'REWORK', defectNotes: '' }
    );
    assert(badInspection.status === 422, 'REWORK inspection without notes is rejected with 422');

    // Step 4: Submit valid inspection (PASS) and verify audit trail persistence
    const validInspection = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/rolls/FR-2026-000001/inspection',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      { result: 'PASS', defectNotes: 'Flawless weave inspection verified.', inspectorName: 'Alex Carter (Senior QA)' }
    );
    assert(validInspection.status === 200 && validInspection.body.roll.qualityStatus === 'PASS', 'Valid inspection submitted successfully: PENDING -> PASS');
    assert(validInspection.body.roll.inspections.length === 1, 'Audit trail history gains exactly 1 entry');
    assert(validInspection.body.roll.inspections[0].inspectorName === 'Alex Carter (Senior QA)', 'Audit trail logs inspector name');

    // Step 5: Dispatch Transition Gating
    // Non-PASS cannot be dispatched (FR-2026-000011 is REJECT)
    const rejectDispatch = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/rolls/FR-2026-000011/dispatch',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      { dispatchStatus: 'READY_FOR_DISPATCH' }
    );
    assert(rejectDispatch.status === 409, 'REJECT roll is blocked from READY_FOR_DISPATCH (409 Conflict)');

    // PASS roll transition: READY_FOR_DISPATCH -> DISPATCHED
    const dispatchReady = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/rolls/FR-2026-000005/dispatch',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      { dispatchStatus: 'DISPATCHED' }
    );
    assert(dispatchReady.status === 200 && dispatchReady.body.roll.dispatchStatus === 'DISPATCHED', 'PASS roll transitions to terminal state DISPATCHED');

    // Attempting to modify terminal DISPATCHED roll fails with 409
    const modifyDispatched = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/rolls/FR-2026-000005/dispatch',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      { dispatchStatus: 'READY_FOR_DISPATCH' }
    );
    assert(modifyDispatched.status === 409, 'Terminal DISPATCHED roll cannot be modified (409 Conflict)');

    // Step 6: Create Roll validation & duplicate rejection
    const newRollRes = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/rolls',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        orderNumber: 'PO-2026-0001',
        machineCode: 'LM-01',
        quantityMetres: 150.75,
      }
    );
    assert(newRollRes.status === 201 && newRollRes.body.roll.rollId === 'FR-2026-000015', 'POST /api/rolls creates new sequential roll FR-2026-000015 (201)');

    const dupRollRes = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/rolls',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        rollId: 'FR-2026-000015',
        orderNumber: 'PO-2026-0001',
        machineCode: 'LM-01',
        quantityMetres: 100,
      }
    );
    assert(dupRollRes.status === 409, 'Duplicate roll ID rejected with 409 Conflict');

    // ------------------------------------------------------------------------
    // SECTION 5: WORKFLOW C (DELAY RADAR)
    // ------------------------------------------------------------------------
    console.log('\n--- Section 5: Workflow C (Delay Radar) ---');

    // Step 1: Radar loads and summary counts match
    const radarListRes = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/delay-radar', method: 'GET' });
    assert(radarListRes.status === 200, 'GET /api/delay-radar returns 200');
    assert(radarListRes.body.summary.overdue === 2, 'Radar overdue count = 2');
    assert(radarListRes.body.summary.atRisk === 2, 'Radar atRisk count = 2');
    assert(radarListRes.body.summary.onTrack === 4, 'Radar onTrack count = 4');
    assert(radarListRes.body.summary.insufficientData === 1, 'Radar insufficientData count = 1');
    assert(radarListRes.body.summary.total === 9, 'Radar total active orders = 9');

    // Step 2: Formula Conformance on all active orders
    const nowRef = new Date();
    let oraclePassCount = 0;
    radarListRes.body.orders.forEach((ord) => {
      const plainRem = ord.requiredQuantity - ord.producedQuantity;
      const rateVal = ord.rate?.value;
      if (rateVal && ord.deadlineAt) {
        const estDays = plainRem / rateVal;
        const availDays = (new Date(ord.deadlineAt).getTime() - nowRef.getTime()) / (24 * 60 * 60 * 1000);
        const expected = nowRef.getTime() > new Date(ord.deadlineAt).getTime()
          ? 'OVERDUE'
          : estDays > availDays + 1e-9
          ? 'AT_RISK'
          : 'ON_TRACK';
        if (ord.status === expected) oraclePassCount++;
      } else {
        if (ord.status === 'INSUFFICIENT_DATA') oraclePassCount++;
      }
    });
    assert(oraclePassCount === 9, `Radar Oracle Conformance: 9/9 active orders match plain arithmetic`);

    // Step 3: Single Order Assessment Trace
    const radarDetailRes = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/delay-radar/PO-2026-0003', method: 'GET' });
    assert(radarDetailRes.status === 200 && radarDetailRes.body.assessment.status === 'AT_RISK', 'PO-2026-0003 assessment is AT_RISK');
    assert(radarDetailRes.body.assessment.calculation.length >= 4, 'Includes 4-step mathematical calculation trace');
    assert(radarDetailRes.body.assessment.suggestedAction.code === 'REALLOCATE_OR_SPLIT', 'Suggests rescue machine reallocation (LM-04)');

    // Step 4: Live Progress PATCH recalculates risk
    const patchSafe = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/orders/PO-2026-0003',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      { producedQuantity: 4000 }
    );
    assert(patchSafe.status === 200 && patchSafe.body.order.delayStatus === 'on_track', 'PATCH producedQuantity: 4000 updates order to on_track');

    const radarDetailAfter = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/delay-radar/PO-2026-0003', method: 'GET' });
    assert(radarDetailAfter.body.assessment.status === 'ON_TRACK', 'Delay Radar dynamically evaluates PO-2026-0003 as ON_TRACK');
    assert(radarDetailAfter.body.assessment.remainingQuantity === 500, 'Remaining quantity drops to 500 meters');

    // Security: Disallowed field in PATCH rejected
    const patchSecurity = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/orders/PO-2026-0003',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      { riskStatus: 'AT_RISK' }
    );
    assert(patchSecurity.status === 422, 'Security Guard: Client attempt to PATCH riskStatus is rejected with 422');

    // Restore original quantity
    await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/orders/PO-2026-0003',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      { producedQuantity: 1500 }
    );

    // ------------------------------------------------------------------------
    // SECTION 6: CROSS-CUTTING CHECKS
    // ------------------------------------------------------------------------
    console.log('\n--- Section 6: Cross-Cutting Checks & Empty State ---');

    // 1. Error Response Standardization (No stack trace leaks)
    const errRes = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/orders/nonexistent', method: 'GET' });
    assert(errRes.body.error && errRes.body.error.message && errRes.body.error.code, 'Error envelope adheres to { "error": { "message", "code" } }');
    assert(errRes.body.stack === undefined, 'Error response never leaks stack trace');

    // ------------------------------------------------------------------------
    // SECTION 7: MODULE 4 QUALITY GATES & CAPA INTEGRATION TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- Section 7: Module 4 Quality Gates & Control Tower & CAPA ---');

    // 1. Quality Config endpoint
    const qcConfigRes = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/quality/config', method: 'GET' });
    assert(qcConfigRes.status === 200, 'GET /api/quality/config returns 200 OK');
    assert(Array.isArray(qcConfigRes.body.stageOrder) && qcConfigRes.body.stageOrder.length === 4, 'Quality config lists all 4 stages (GREY, DYEING, FINISHING, FINAL)');
    assert(qcConfigRes.body.defectCatalog && qcConfigRes.body.defectCatalog.GREY, 'Defect catalog contains stage-specific catalogs');

    // 2. Roll Creation & Initial Gate State
    const createRollRes = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/rolls',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        orderNumber: 'PO-2026-0001',
        machineCode: 'LM-01',
        quantityMetres: 150,
      }
    );
    assert(createRollRes.status === 201, 'POST /api/rolls creates roll successfully');
    const createdRoll = createRollRes.body.roll;
    assert(createdRoll.stage === 'GREY', 'New roll initializes at GREY stage');
    assert(createdRoll.qualityStatus === 'PENDING', 'New roll qualityStatus is PENDING');

    // 3. Advance blocked when not PASS
    const advanceBlocked = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: `/api/rolls/${createdRoll.rollId}/advance`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { machineCode: 'DY-01' }
    );
    assert(advanceBlocked.status === 409, 'Advancing PENDING roll is blocked with 409 GATE_NOT_PASSED');

    // 4. Inspection Preview Endpoint
    const previewRes = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: `/api/rolls/${createdRoll.rollId}/inspection/preview`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        defects: [
          { code: 'BROKEN_END', severity: 'MINOR', quantity: 2 },
          { code: 'SLUB', severity: 'MINOR', quantity: 1 },
        ],
      }
    );
    assert(previewRes.status === 200, 'POST /inspection/preview returns 200 OK');
    assert(previewRes.body.preview.defectPoints === 3, 'Preview computes 3 defect points (3 MINOR)');
    assert(previewRes.body.preview.recommendedResult === 'PASS', 'Preview recommends PASS for 2.0 pts/100m <= 20.0 threshold');
    assert(Array.isArray(previewRes.body.preview.calculationTrace), 'Preview returns calculation trace');

    // 5. Submit Inspection: PASS
    const submitInsp = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: `/api/rolls/${createdRoll.rollId}/inspection`,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        qualityStatus: 'PASS',
        defects: [
          { code: 'BROKEN_END', severity: 'MINOR', quantity: 2 },
          { code: 'SLUB', severity: 'MINOR', quantity: 1 },
        ],
        inspectedBy: 'Q-Tech Lead',
      }
    );
    assert(submitInsp.status === 200, 'PATCH /inspection submits inspection and returns 200', submitInsp);
    assert(submitInsp.body && submitInsp.body.roll && submitInsp.body.roll.qualityStatus === 'PASS', 'Roll status updated to PASS', submitInsp.body);
    assert(submitInsp.body && submitInsp.body.roll && submitInsp.body.roll.inspections.length === 1, 'Inspection record saved to inspections array', submitInsp.body);

    // 6. Advance to DYEING with wrong machine type -> rejected
    const badMachineAdvance = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: `/api/rolls/${createdRoll.rollId}/advance`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { machineCode: 'LM-01' }
    );
    assert(badMachineAdvance.status === 422, 'Advancing to DYEING with loom machine is rejected (422 MACHINE_TYPE_MISMATCH)');

    // 7. Advance to DYEING with valid machine (DY-01)
    const validAdvance = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: `/api/rolls/${createdRoll.rollId}/advance`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { machineCode: 'DY-01' }
    );
    assert(validAdvance.status === 200, 'Advancing to DYEING with DY-01 succeeds (200 OK)');
    assert(validAdvance.body.roll.stage === 'DYEING', 'Roll stage transitions to DYEING');
    assert(validAdvance.body.roll.qualityStatus === 'PENDING', 'Roll qualityStatus resets to PENDING for new stage gate');
    assert(validAdvance.body.roll.stageHistory.length >= 2, 'Previous stage recorded in stageHistory');

    // 8. Lenient Override Validation at DYEING
    // 30 points on 150m = 20.0 pts/100m -> DYEING pass threshold is 15.0, reworkMax is 30.0 -> REWORK
    const lenientOverrideNoReason = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: `/api/rolls/${createdRoll.rollId}/inspection`,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        qualityStatus: 'PASS', // Recommended is REWORK
        defects: [
          { code: 'DYE_STAIN', severity: 'MAJOR', quantity: 10 },
        ],
        isOverride: true,
        overrideReason: 'Too short', // < 10 chars
      }
    );
    assert(lenientOverrideNoReason.status === 422, 'Lenient override with short reason is rejected with 422');

    const lenientOverrideValid = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: `/api/rolls/${createdRoll.rollId}/inspection`,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        qualityStatus: 'PASS',
        defects: [
          { code: 'DYE_STAIN', severity: 'MAJOR', quantity: 10 },
        ],
        isOverride: true,
        overrideReason: 'Approved by Plant QA Lead per Customer Concession Waiver #992',
      }
    );
    assert(lenientOverrideValid.status === 200, 'Lenient override with valid reason (>= 10 chars) succeeds with 200 OK');
    assert(lenientOverrideValid.body.roll.qualityStatus === 'PASS', 'Roll qualityStatus updated to overridden PASS');

    // 9. Quality Summary & Alerts Endpoints
    const summaryRes = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/quality/summary', method: 'GET' });
    assert(summaryRes.status === 200, 'GET /api/quality/summary returns 200 OK');
    assert(Array.isArray(summaryRes.body.stages) && summaryRes.body.stages.length === 4, 'Summary includes 4 stage breakdown');
    assert(Array.isArray(summaryRes.body.pareto), 'Summary includes defect Pareto array');
    assert(Array.isArray(summaryRes.body.hotspots), 'Summary includes machine hotspots array');

    const alertsRes = await makeRequest({ hostname: '127.0.0.1', port: TEST_PORT, path: '/api/quality/alerts', method: 'GET' });
    assert(alertsRes.status === 200, 'GET /api/quality/alerts returns 200 OK');
    assert(Array.isArray(alertsRes.body.alerts), 'Alerts returns array of rule-based alerts');

    // 10. Corrective Actions (CAPA) Workflow
    const createCaRes = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/corrective-actions',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        title: 'Re-align Stenter Guiders to prevent Dye Stains',
        defectCode: 'DYE_STAIN',
        machineCode: 'DY-01',
        stage: 'DYEING',
        rootCause: 'Guider edge clamp misalignment causing uneven dye immersion along selvage',
        assignedTo: 'Rajesh K. (Senior Maintenance)',
      }
    );
    assert(createCaRes.status === 201, 'POST /api/corrective-actions creates CAPA action with 201');
    const createdCa = createCaRes.body.action;
    assert(/^CA-\d{4}-\d{4}$/.test(createdCa.actionNumber), `CAPA action number matches CA-YYYY-NNNN format (${createdCa.actionNumber})`);
    assert(createdCa.status === 'OPEN', 'Initial CAPA status is OPEN');

    // Transition OPEN -> IN_PROGRESS
    const caInProgress = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: `/api/corrective-actions/${createdCa.actionNumber}/status`,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      { status: 'IN_PROGRESS' }
    );
    assert(caInProgress.status === 200, 'PATCH status to IN_PROGRESS succeeds');
    assert(caInProgress.body.action.status === 'IN_PROGRESS', 'CAPA status is IN_PROGRESS');

    // Transition IN_PROGRESS -> DONE
    const caDone = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: `/api/corrective-actions/${createdCa.actionNumber}/status`,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      },
      { status: 'DONE' }
    );
    assert(caDone.status === 200, 'PATCH status to DONE succeeds');
    assert(caDone.body.action.status === 'DONE', 'CAPA status is DONE');
    assert(caDone.body.action.doneAt !== null, 'doneAt timestamp recorded automatically');

    // Get CAPA detail and check recurrence analysis structure
    const caDetail = await makeRequest(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: `/api/corrective-actions/${createdCa.actionNumber}`,
        method: 'GET',
      }
    );
    assert(caDetail.body && caDetail.body.action && typeof caDetail.body.action.recurrence?.recurred === 'boolean', 'Recurrence tracker included with boolean recurred flag');
    assert(typeof caDetail.body?.action?.recurrence?.explanation === 'string', 'Recurrence tracker contains plain language explanation');

  } finally {
    if (server) server.close();
    await disconnectDB();
  }

  console.log('\n================================================================');
  console.log(`INTEGRATION SUITE RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
};

runAllTests().catch((err) => {
  console.error('Integration test runner fatal error:', err);
  process.exit(1);
});
