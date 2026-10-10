/**
 * Models Schema Validation Verification Script.
 * Instantiates and validates sample instances of each Mongoose model in memory
 * to verify schema constraints, types, enums, and required fields without writing to DB.
 */
const mongoose = require('mongoose');
const { ProductionOrder, Machine, FabricRoll, MaterialStock } = require('../src/models');

const testModels = () => {
  console.log('[TEST] Starting Mongoose schema validation check...');
  let hasErrors = false;

  // 1. ProductionOrder validation test
  const testOrder = new ProductionOrder({
    orderNumber: 'PO-2026-0001',
    customer: 'Apex Textiles Ltd.',
    fabricType: '100% Combed Cotton Single Jersey 180 GSM',
    quantity: 5000,
    unit: 'meters',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'in_progress',
    currentStage: 'spinning',
    priority: 'high',
    notes: 'Urgent export order for Spring collection',
  });

  const orderErr = testOrder.validateSync();
  if (orderErr) {
    console.error('❌ ProductionOrder validation failed:', orderErr.message);
    hasErrors = true;
  } else {
    console.log('✅ ProductionOrder schema valid');
  }

  // 2. Machine validation test
  const testMachine = new Machine({
    code: 'LOOM-A01',
    name: 'Picanol OmniPlus Air-Jet Loom #1',
    type: 'loom',
    status: 'running',
    capacity: 120,
    capacityUnit: 'meters/hour',
    currentAssignedOrder: testOrder._id,
  });

  const machineErr = testMachine.validateSync();
  if (machineErr) {
    console.error('❌ Machine validation failed:', machineErr.message);
    hasErrors = true;
  } else {
    console.log('✅ Machine schema valid');
  }

  // 3. FabricRoll validation test
  const testRoll = new FabricRoll({
    rollId: 'ROLL-2026-0001',
    productionOrder: testOrder._id,
    machine: testMachine._id,
    length: 120.5,
    weight: 24.8,
    grade: 'A',
    stage: 'greige',
    producedAt: new Date(),
  });

  const rollErr = testRoll.validateSync();
  if (rollErr) {
    console.error('❌ FabricRoll validation failed:', rollErr.message);
    hasErrors = true;
  } else {
    console.log('✅ FabricRoll schema valid');
  }

  // 4. MaterialStock validation test
  const testStock = new MaterialStock({
    name: '30s Ne Carded Cotton Yarn',
    sku: 'YRN-COT-30S-WHT',
    quantityOnHand: 1450,
    unit: 'kg',
    reorderLevel: 300,
    supplier: 'Vardhman Yarns Corp.',
  });

  const stockErr = testStock.validateSync();
  if (stockErr) {
    console.error('❌ MaterialStock validation failed:', stockErr.message);
    hasErrors = true;
  } else {
    console.log('✅ MaterialStock schema valid');
  }

  if (hasErrors) {
    console.error('[TEST FAIL] One or more models failed validation.');
    process.exit(1);
  } else {
    console.log('[TEST PASS] All 4 Mongoose models validated successfully in memory!');
    process.exit(0);
  }
};

testModels();
