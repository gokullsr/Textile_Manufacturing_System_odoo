/**
 * Idempotent Seed Script for LoomIQ Platform.
 * Populates realistic textile manufacturing dataset including Fabric Rolls with QR digital passports.
 * Supports safe '--reset' flag to recreate only demo records without touching user data.
 */
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { ProductionOrder, Machine, MaterialStock, FabricRoll, Counter } = require('../src/models');

const isReset = process.argv.includes('--reset');

const seed = async () => {
  // 1. Guard against running in production
  if (process.env.NODE_ENV === 'production' || config.nodeEnv === 'production') {
    console.error('⛔ [SAFETY LOCK] Seeding is prohibited in production environments.');
    process.exit(1);
  }

  console.log('🌱 Starting LoomIQ database seed operation...');
  await connectDB(config.mongoUri);

  try {
    // 2. Safe reset if requested (only deletes isDemo: true records)
    if (isReset) {
      console.log('🧹 Flag --reset detected: Cleaning up previous demo records...');
      const delOrders = await ProductionOrder.deleteMany({ isDemo: true });
      const delMachines = await Machine.deleteMany({ isDemo: true });
      const delStock = await MaterialStock.deleteMany({ isDemo: true });
      const delRolls = await FabricRoll.deleteMany({ isDemo: true });
      await Counter.deleteMany({});
      console.log(`   Removed: ${delOrders.deletedCount} orders, ${delMachines.deletedCount} machines, ${delStock.deletedCount} stock items, ${delRolls.deletedCount} fabric rolls.`);
    }

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;

    // ----------------------------------------------------
    // 3. SEED MACHINES (with dailyCapacity convention)
    // ----------------------------------------------------
    // Check if any existing machines lack dailyCapacity
    const existingWithoutDailyCap = await Machine.countDocuments({ isDemo: true, dailyCapacity: { $exists: false } });
    if (existingWithoutDailyCap > 0) {
      console.warn(`⚠️ [NOTICE] Found ${existingWithoutDailyCap} legacy demo machine(s) lacking 'dailyCapacity'. Run with --reset to migrate.`);
    }

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

    let machinesInserted = 0;
    let machinesExisted = 0;
    const machineMap = {};

    for (const m of machineDefs) {
      const res = await Machine.findOneAndUpdate(
        { code: m.code },
        { $set: m },
        { upsert: true, new: true, rawResult: true }
      );
      if (res.lastErrorObject?.updatedExisting) {
        machinesExisted++;
      } else {
        machinesInserted++;
      }
      machineMap[m.code] = res.value || (await Machine.findOne({ code: m.code }));
    }

    console.log(`🏭 Machines: ${machinesInserted} created, ${machinesExisted} existing.`);

    // ----------------------------------------------------
    // 4. SEED MATERIAL STOCK
    // ----------------------------------------------------
    const stockDefs = [
      { sku: 'DYE-IND-01', name: 'Indigo Reactive Dye Blue 5R', quantityOnHand: 0, unit: 'kg', reorderLevel: 150, supplier: 'ColorChem Synthetics', isDemo: true },
      { sku: 'YRN-COT-30S', name: '30s Ne Combed Ring-Spun Cotton', quantityOnHand: 180, unit: 'kg', reorderLevel: 500, supplier: 'Apex Spun Mills', isDemo: true },
      { sku: 'CHM-SFT-02', name: 'Silicone Fabric Softener Emulsion', quantityOnHand: 45, unit: 'liters', reorderLevel: 100, supplier: 'AuxiTex Industries', isDemo: true },
      { sku: 'YRN-VIS-40S', name: '40s Viscose Staple Fiber Yarn', quantityOnHand: 80, unit: 'kg', reorderLevel: 250, supplier: 'Eastern Fiber Corp.', isDemo: true },
      { sku: 'YRN-PLY-150D', name: '150D Textured Polyester DTY', quantityOnHand: 2400, unit: 'kg', reorderLevel: 600, supplier: 'Reliance Poly Mills', isDemo: true },
      { sku: 'DYE-BLK-02', name: 'Reactive Black Dye B-133', quantityOnHand: 850, unit: 'kg', reorderLevel: 200, supplier: 'ColorChem Synthetics', isDemo: true },
      { sku: 'CHM-BLC-01', name: 'Hydrogen Peroxide Bleach 50%', quantityOnHand: 1200, unit: 'liters', reorderLevel: 300, supplier: 'Global Chem Traders', isDemo: true },
      { sku: 'YRN-ELAS-40D', name: '40D Spandex Core Yarn', quantityOnHand: 950, unit: 'kg', reorderLevel: 200, supplier: 'FlexiStretch Yarns', isDemo: true },
      { sku: 'PKG-ROLL-TUBE', name: 'Heavy Duty Paper Roll Cores', quantityOnHand: 1500, unit: 'rolls', reorderLevel: 400, supplier: 'CorePack Solutions', isDemo: true },
      { sku: 'PKG-POLY-WRAP', name: 'Polyethylene Roll Protective Wrap', quantityOnHand: 800, unit: 'kg', reorderLevel: 250, supplier: 'PolySeal Packaging', isDemo: true },
    ];

    let stockInserted = 0;
    let stockExisted = 0;

    for (const s of stockDefs) {
      const res = await MaterialStock.findOneAndUpdate(
        { sku: s.sku },
        { $setOnInsert: s },
        { upsert: true, new: true, rawResult: true }
      );
      if (res.lastErrorObject?.updatedExisting) {
        stockExisted++;
      } else {
        stockInserted++;
      }
    }

    console.log(`📦 Material Stock: ${stockInserted} created, ${stockExisted} existing.`);

    // ----------------------------------------------------
    // 5. SEED PRODUCTION ORDERS (Designed for Delay Radar Scenarios)
    // ----------------------------------------------------
    const orderDefs = [
      // 1. ON_TRACK (Slack ~6.5 days >= 2 days)
      { orderNumber: 'PO-2026-0001', customer: 'Meridian Apparel Co.', fabricType: '100% Combed Cotton Single Jersey 180 GSM', requiredQuantity: 6000, producedQuantity: 3600, unit: 'meters', startDate: new Date(now.getTime() - 10 * day), dueDate: new Date(now.getTime() + 10 * day), status: 'in_progress', currentStage: 'weaving', priority: 'high', assignedMachine: machineMap['LM-01']?._id, notes: 'Export grade fabric for Summer Casuals collection.', isDemo: true },
      // 2. ON_TRACK (Uses productionRatePerDay override of 800 m/day vs 500 machine capacity)
      { orderNumber: 'PO-2026-0002', customer: 'Aura Fashion Group', fabricType: '98/2 Cotton Spandex Twill Denim 11.5 Oz', requiredQuantity: 8000, producedQuantity: 5600, unit: 'meters', productionRatePerDay: 800, startDate: new Date(now.getTime() - 14 * day), dueDate: new Date(now.getTime() + 8 * day), status: 'in_progress', currentStage: 'weaving', priority: 'urgent', assignedMachine: machineMap['LM-02']?._id, notes: 'Fast-track denim line running with speed override.', isDemo: true },
      // 3. AT_RISK (Rescuable by available LM-04 loom)
      { orderNumber: 'PO-2026-0003', customer: 'Cascade Sportswear', fabricType: '100% Polyester Quick-Dry Birdseye Mesh', requiredQuantity: 4500, producedQuantity: 1500, unit: 'meters', startDate: new Date(now.getTime() - 4 * day), dueDate: new Date(now.getTime() + 4 * day), status: 'in_progress', currentStage: 'weaving', priority: 'medium', assignedMachine: machineMap['LM-03']?._id, notes: 'Antimicrobial and UV coating specification. Needs rescue loom.', isDemo: true },
      // 4. INSUFFICIENT_DATA (In-progress order with NO assigned machine and no override)
      { orderNumber: 'PO-2026-0004', customer: 'Loom & Linen Corp.', fabricType: '60/40 Linen Cotton Plain Weave 160 GSM', requiredQuantity: 3000, producedQuantity: 1200, unit: 'meters', startDate: new Date(now.getTime() - 5 * day), dueDate: new Date(now.getTime() + 15 * day), status: 'in_progress', currentStage: 'weaving', priority: 'low', assignedMachine: null, notes: 'Awaiting loom workcenter assignment.', isDemo: true },
      // 5. COMPLETED
      { orderNumber: 'PO-2026-0005', customer: 'Vanguard Uniforms Ltd.', fabricType: '65/35 Poly-Cotton Heavy Drill 240 GSM', requiredQuantity: 5000, producedQuantity: 5000, unit: 'meters', startDate: new Date(now.getTime() - 20 * day), dueDate: new Date(now.getTime() - 2 * day), status: 'completed', currentStage: 'dispatched', priority: 'high', assignedMachine: null, notes: 'Quality inspection passed grade A. Shipped on schedule.', isDemo: true },
      // 6. COMPLETED
      { orderNumber: 'PO-2026-0006', customer: 'Meridian Apparel Co.', fabricType: '100% Cotton Poplin Solid Dyed 120 GSM', requiredQuantity: 4000, producedQuantity: 4000, unit: 'meters', startDate: new Date(now.getTime() - 15 * day), dueDate: new Date(now.getTime() - 1 * day), status: 'completed', currentStage: 'dispatched', priority: 'medium', assignedMachine: null, notes: 'Dispatched to central warehouse.', isDemo: true },
      // 7. COMPLETED
      { orderNumber: 'PO-2026-0007', customer: 'Nordic Knitwear Co.', fabricType: '100% Viscose Rib Knit 220 GSM', requiredQuantity: 2500, producedQuantity: 2500, unit: 'meters', startDate: new Date(now.getTime() - 12 * day), dueDate: new Date(now.getTime() - 3 * day), status: 'completed', currentStage: 'dispatched', priority: 'low', assignedMachine: null, notes: 'Fabric rolls packaged with moisture barrier.', isDemo: true },
      // 8. AT_RISK (Not Rescuable, machine in maintenance, unit kg)
      { orderNumber: 'PO-2026-0008', customer: 'Aura Fashion Group', fabricType: '100% Rayon Challis Botanical Print Yarn', requiredQuantity: 5000, producedQuantity: 1000, unit: 'kg', startDate: new Date(now.getTime() - 9 * day), dueDate: new Date(now.getTime() + 2 * day), status: 'in_progress', currentStage: 'dyeing', priority: 'urgent', assignedMachine: machineMap['DY-01']?._id, notes: 'Dyeing vat undergoing valve maintenance.', isDemo: true },
      // 9. ON_TRACK (On hold, shares machine LM-01 with PO-2026-0001)
      { orderNumber: 'PO-2026-0009', customer: 'Vanguard Uniforms Ltd.', fabricType: '100% Nylon Oxford Waterproof 210D', requiredQuantity: 3500, producedQuantity: 2000, unit: 'meters', startDate: new Date(now.getTime() - 10 * day), dueDate: new Date(now.getTime() + 12 * day), status: 'on_hold', currentStage: 'finishing', priority: 'high', assignedMachine: machineMap['LM-01']?._id, notes: 'On hold awaiting buyer lab dip shade approval.', isDemo: true },
      // 10. OVERDUE (Past deadline)
      { orderNumber: 'PO-2026-0010', customer: 'Cascade Sportswear', fabricType: '88/12 Poly-Spandex Interlock 260 GSM', requiredQuantity: 4000, producedQuantity: 2800, unit: 'meters', startDate: new Date(now.getTime() - 15 * day), dueDate: new Date(now.getTime() - 3 * day), status: 'in_progress', currentStage: 'quality_inspection', priority: 'urgent', assignedMachine: machineMap['LM-02']?._id, notes: 'Overdue order. Finishing station bottleneck resolved.', isDemo: true },
      // 11. OVERDUE (Past deadline)
      { orderNumber: 'PO-2026-0011', customer: 'Apex Textiles Ltd.', fabricType: '100% Combed Cotton Oxford 150 GSM', requiredQuantity: 6500, producedQuantity: 4200, unit: 'meters', startDate: new Date(now.getTime() - 14 * day), dueDate: new Date(now.getTime() - 1 * day), status: 'in_progress', currentStage: 'finishing', priority: 'high', assignedMachine: machineMap['LM-03']?._id, notes: 'Expedited transport booked to mitigate delivery delay.', isDemo: true },
      // 12. ON_TRACK (Queued status with defect rolls)
      { orderNumber: 'PO-2026-0012', customer: 'Loom & Linen Corp.', fabricType: '55/45 Cotton Poly Slub Yarn Fabric', requiredQuantity: 7000, producedQuantity: 2000, unit: 'meters', startDate: new Date(now.getTime() + 1 * day), dueDate: new Date(now.getTime() + 20 * day), status: 'queued', currentStage: 'spinning', priority: 'medium', assignedMachine: machineMap['LM-02']?._id, notes: 'Yarn allocated in warehouse. Awaiting loom start.', isDemo: true },
    ];

    let ordersInserted = 0;
    let ordersExisted = 0;
    const orderMap = {};

    for (const ord of orderDefs) {
      const res = await ProductionOrder.findOneAndUpdate(
        { orderNumber: ord.orderNumber },
        { $set: ord },
        { upsert: true, new: true, rawResult: true }
      );
      if (res.lastErrorObject?.updatedExisting) {
        ordersExisted++;
      } else {
        ordersInserted++;
      }
      orderMap[ord.orderNumber] = res.value || (await ProductionOrder.findOne({ orderNumber: ord.orderNumber }));

      if (ord.assignedMachine && ord.status === 'in_progress') {
        const savedOrder = res.value || (await ProductionOrder.findOne({ orderNumber: ord.orderNumber }));
        if (savedOrder) {
          await Machine.findByIdAndUpdate(ord.assignedMachine, {
            currentAssignedOrder: savedOrder._id,
          });
        }
      }
    }

    console.log(`📋 Production Orders: ${ordersInserted} created, ${ordersExisted} existing.`);

    // ----------------------------------------------------
    // 6. SEED FABRIC ROLLS (14 rolls with realistic passport data)
    // ----------------------------------------------------
    const rollDefs = [
      // 1. PENDING (Fresh off loom)
      {
        rollId: 'FR-2026-000001',
        order: orderMap['PO-2026-0001']?._id,
        machine: machineMap['LM-01']?._id,
        quantityMetres: 120.5,
        weight: 24.2,
        stage: 'weaving',
        qualityStatus: 'PENDING',
        defectNotes: '',
        inspectedAt: null,
        dispatchStatus: 'NOT_DISPATCHED',
        dispatchedAt: null,
        inspections: [],
        isDemo: true,
      },
      // 2. PENDING (Fresh off knitting station)
      {
        rollId: 'FR-2026-000002',
        order: orderMap['PO-2026-0001']?._id,
        machine: machineMap['LM-01']?._id,
        quantityMetres: 118.0,
        weight: 23.8,
        stage: 'weaving',
        qualityStatus: 'PENDING',
        defectNotes: '',
        inspectedAt: null,
        dispatchStatus: 'NOT_DISPATCHED',
        dispatchedAt: null,
        inspections: [],
        isDemo: true,
      },
      // 3. PENDING
      {
        rollId: 'FR-2026-000003',
        order: orderMap['PO-2026-0002']?._id,
        machine: machineMap['LM-02']?._id,
        quantityMetres: 240.0,
        weight: 48.0,
        stage: 'weaving',
        qualityStatus: 'PENDING',
        defectNotes: '',
        inspectedAt: null,
        dispatchStatus: 'NOT_DISPATCHED',
        dispatchedAt: null,
        inspections: [],
        isDemo: true,
      },
      // 4. PASS (Not dispatched)
      {
        rollId: 'FR-2026-000004',
        order: orderMap['PO-2026-0001']?._id,
        machine: machineMap['LM-01']?._id,
        quantityMetres: 125.0,
        weight: 25.1,
        stage: 'inspected',
        qualityStatus: 'PASS',
        defectNotes: 'Clear weave pattern, zero yarn slubs, uniform tension.',
        inspectedAt: new Date(now.getTime() - 2 * day),
        dispatchStatus: 'NOT_DISPATCHED',
        dispatchedAt: null,
        inspections: [
          {
            result: 'PASS',
            defectNotes: 'Clear weave pattern, zero yarn slubs, uniform tension.',
            inspectorName: 'Devon Vance (QA Lead)',
            inspectedAt: new Date(now.getTime() - 2 * day),
          },
        ],
        isDemo: true,
      },
      // 5. PASS (Ready for dispatch)
      {
        rollId: 'FR-2026-000005',
        order: orderMap['PO-2026-0002']?._id,
        machine: machineMap['LM-02']?._id,
        quantityMetres: 250.0,
        weight: 51.2,
        stage: 'packaged',
        qualityStatus: 'PASS',
        defectNotes: 'Denim twill density 3/1 verified. 4-point inspection score: 12 pts.',
        inspectedAt: new Date(now.getTime() - 3 * day),
        dispatchStatus: 'READY_FOR_DISPATCH',
        dispatchedAt: null,
        inspections: [
          {
            result: 'PASS',
            defectNotes: 'Denim twill density 3/1 verified. 4-point inspection score: 12 pts.',
            inspectorName: 'Sarah Lin (Senior QA)',
            inspectedAt: new Date(now.getTime() - 3 * day),
          },
        ],
        isDemo: true,
      },
      // 6. PASS (Ready for dispatch)
      {
        rollId: 'FR-2026-000006',
        order: orderMap['PO-2026-0003']?._id,
        machine: machineMap['LM-03']?._id,
        quantityMetres: 180.0,
        weight: 36.4,
        stage: 'packaged',
        qualityStatus: 'PASS',
        defectNotes: 'Quick-dry wicking rate verified within ASTM standards.',
        inspectedAt: new Date(now.getTime() - 1 * day),
        dispatchStatus: 'READY_FOR_DISPATCH',
        dispatchedAt: null,
        inspections: [
          {
            result: 'PASS',
            defectNotes: 'Quick-dry wicking rate verified within ASTM standards.',
            inspectorName: 'Marcus Cole',
            inspectedAt: new Date(now.getTime() - 1 * day),
          },
        ],
        isDemo: true,
      },
      // 7. PASS (Dispatched)
      {
        rollId: 'FR-2026-000007',
        order: orderMap['PO-2026-0005']?._id,
        machine: machineMap['LM-01']?._id,
        quantityMetres: 300.0,
        weight: 62.0,
        stage: 'dispatched',
        qualityStatus: 'PASS',
        defectNotes: 'Heavy drill uniform weave, moisture barrier applied.',
        inspectedAt: new Date(now.getTime() - 5 * day),
        dispatchStatus: 'DISPATCHED',
        dispatchedAt: new Date(now.getTime() - 2 * day),
        inspections: [
          {
            result: 'PASS',
            defectNotes: 'Heavy drill uniform weave, moisture barrier applied.',
            inspectorName: 'Devon Vance (QA Lead)',
            inspectedAt: new Date(now.getTime() - 5 * day),
          },
        ],
        isDemo: true,
      },
      // 8. PASS (Dispatched)
      {
        rollId: 'FR-2026-000008',
        order: orderMap['PO-2026-0006']?._id,
        machine: machineMap['LM-04']?._id,
        quantityMetres: 200.0,
        weight: 41.0,
        stage: 'dispatched',
        qualityStatus: 'PASS',
        defectNotes: '100% Poplin solid dyed batch approved.',
        inspectedAt: new Date(now.getTime() - 4 * day),
        dispatchStatus: 'DISPATCHED',
        dispatchedAt: new Date(now.getTime() - 1 * day),
        inspections: [
          {
            result: 'PASS',
            defectNotes: '100% Poplin solid dyed batch approved.',
            inspectorName: 'Sarah Lin (Senior QA)',
            inspectedAt: new Date(now.getTime() - 4 * day),
          },
        ],
        isDemo: true,
      },
      // 9. REWORK (Active Rework)
      {
        rollId: 'FR-2026-000009',
        order: orderMap['PO-2026-0002']?._id,
        machine: machineMap['LM-02']?._id,
        quantityMetres: 210.5,
        weight: 43.0,
        stage: 'inspection',
        qualityStatus: 'REWORK',
        defectNotes: 'Uneven selvedge tension causing 10m wavy edge. Trim and re-edge required.',
        inspectedAt: new Date(now.getTime() - 1 * day),
        dispatchStatus: 'NOT_DISPATCHED',
        dispatchedAt: null,
        inspections: [
          {
            result: 'REWORK',
            defectNotes: 'Uneven selvedge tension causing 10m wavy edge. Trim and re-edge required.',
            inspectorName: 'Sarah Lin (Senior QA)',
            inspectedAt: new Date(now.getTime() - 1 * day),
          },
        ],
        isDemo: true,
      },
      // 10. REWORK with Multi-Entry History (REWORK -> Re-inspected as PASS)
      {
        rollId: 'FR-2026-000010',
        order: orderMap['PO-2026-0001']?._id,
        machine: machineMap['LM-01']?._id,
        quantityMetres: 145.0,
        weight: 29.5,
        stage: 'packaged',
        qualityStatus: 'PASS',
        defectNotes: 'Re-inspection after heat setting: weft skew straightened within 1.5% tolerance.',
        inspectedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        dispatchStatus: 'READY_FOR_DISPATCH',
        dispatchedAt: null,
        inspections: [
          {
            result: 'REWORK',
            defectNotes: 'Excessive weft skew (3.8%) observed at roll end. Send for re-stenter framing.',
            inspectorName: 'Devon Vance (QA Lead)',
            inspectedAt: new Date(now.getTime() - 2 * day),
          },
          {
            result: 'PASS',
            defectNotes: 'Re-inspection after heat setting: weft skew straightened within 1.5% tolerance.',
            inspectorName: 'Sarah Lin (Senior QA)',
            inspectedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
          },
        ],
        isDemo: true,
      },
      // 11. REJECT 1 (Severe Weft Bar defect)
      {
        rollId: 'FR-2026-000011',
        order: orderMap['PO-2026-0008']?._id,
        machine: machineMap['DY-01']?._id,
        quantityMetres: 160.0,
        weight: 32.0,
        stage: 'quarantine',
        qualityStatus: 'REJECT',
        defectNotes: 'Severe dye shade variation (Delta-E > 4.5) and multiple dye spots across center 40m. Quarantined.',
        inspectedAt: new Date(now.getTime() - 2 * day),
        dispatchStatus: 'NOT_DISPATCHED',
        dispatchedAt: null,
        inspections: [
          {
            result: 'REJECT',
            defectNotes: 'Severe dye shade variation (Delta-E > 4.5) and multiple dye spots across center 40m. Quarantined.',
            inspectorName: 'Devon Vance (QA Lead)',
            inspectedAt: new Date(now.getTime() - 2 * day),
          },
        ],
        isDemo: true,
      },
      // 12. REJECT 2 (Needle line and hole damage)
      {
        rollId: 'FR-2026-000012',
        order: orderMap['PO-2026-0010']?._id,
        machine: machineMap['KN-01']?._id,
        quantityMetres: 95.0,
        weight: 19.2,
        stage: 'quarantine',
        qualityStatus: 'REJECT',
        defectNotes: 'Broken latch needle caused continuous drop stitches and holes throughout 60m of fabric. Scrap.',
        inspectedAt: new Date(now.getTime() - 1 * day),
        dispatchStatus: 'NOT_DISPATCHED',
        dispatchedAt: null,
        inspections: [
          {
            result: 'REJECT',
            defectNotes: 'Broken latch needle caused continuous drop stitches and holes throughout 60m of fabric. Scrap.',
            inspectorName: 'Marcus Cole',
            inspectedAt: new Date(now.getTime() - 1 * day),
          },
        ],
        isDemo: true,
      },
      // 13. PASS (Fresh pass)
      {
        rollId: 'FR-2026-000013',
        order: orderMap['PO-2026-0003']?._id,
        machine: machineMap['LM-03']?._id,
        quantityMetres: 175.0,
        weight: 35.0,
        stage: 'finished',
        qualityStatus: 'PASS',
        defectNotes: 'Zero structural flaws. GSM 260 verified within 1% spec.',
        inspectedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
        dispatchStatus: 'NOT_DISPATCHED',
        dispatchedAt: null,
        inspections: [
          {
            result: 'PASS',
            defectNotes: 'Zero structural flaws. GSM 260 verified within 1% spec.',
            inspectorName: 'Sarah Lin (Senior QA)',
            inspectedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
          },
        ],
        isDemo: true,
      },
      // 14. PASS (Finished)
      {
        rollId: 'FR-2026-000014',
        order: orderMap['PO-2026-0004']?._id,
        machine: machineMap['LM-04']?._id,
        quantityMetres: 110.0,
        weight: 22.0,
        stage: 'finished',
        qualityStatus: 'PASS',
        defectNotes: 'Linen blend weave natural slubs acceptable per buyer aesthetic spec.',
        inspectedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
        dispatchStatus: 'NOT_DISPATCHED',
        dispatchedAt: null,
        inspections: [
          {
            result: 'PASS',
            defectNotes: 'Linen blend weave natural slubs acceptable per buyer aesthetic spec.',
            inspectorName: 'Devon Vance (QA Lead)',
            inspectedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
          },
        ],
        isDemo: true,
      },
    ];

    let rollsInserted = 0;
    let rollsExisted = 0;

    for (const r of rollDefs) {
      if (!r.order || !r.machine) {
        console.warn(`⚠️ Skipping roll ${r.rollId}: parent order or machine reference not found.`);
        continue;
      }
      const res = await FabricRoll.findOneAndUpdate(
        { rollId: r.rollId },
        { $setOnInsert: r },
        { upsert: true, new: true, rawResult: true }
      );
      if (res.lastErrorObject?.updatedExisting) {
        rollsExisted++;
      } else {
        rollsInserted++;
      }
    }

    console.log(`🎫 Fabric Rolls: ${rollsInserted} created, ${rollsExisted} existing.`);

    // Initialize sequence counter so next generated roll starts at 15
    const currentYear = new Date().getFullYear();
    await Counter.findOneAndUpdate(
      { name: `roll_${currentYear}` },
      { $max: { seq: 14 } },
      { upsert: true }
    );

    console.log('✅ LoomIQ database seed operation completed successfully.');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
};

seed();
