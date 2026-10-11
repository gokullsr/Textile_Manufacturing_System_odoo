/**
 * Idempotent Seed Script for LoomIQ Platform (Modules 1, 2, 3, 4A, 4B, 4C).
 * Populates realistic textile manufacturing dataset including Stage Quality Gates,
 * Quality Control Tower alerts, escapes, hotspots, and CAPA corrective actions.
 * Supports safe '--reset' flag to recreate only demo records without touching user data.
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
  Counter,
  CorrectiveAction,
} = require('../src/models');

const isReset = process.argv.includes('--reset');

const seed = async () => {
  if (process.env.NODE_ENV === 'production' || config.nodeEnv === 'production') {
    console.error('⛔ [SAFETY LOCK] Seeding is prohibited in production environments.');
    process.exit(1);
  }

  console.log('🌱 Starting LoomIQ database seed operation...');
  await connectDB(config.mongoUri);

  try {
    if (isReset) {
      console.log('🧹 Flag --reset detected: Cleaning up previous demo records...');
      const delOrders = await ProductionOrder.deleteMany({ isDemo: true });
      const delMachines = await Machine.deleteMany({ isDemo: true });
      const delStock = await MaterialStock.deleteMany({ isDemo: true });
      const delRolls = await FabricRoll.deleteMany({ isDemo: true });
      const delCAs = await CorrectiveAction.deleteMany({ isDemo: true });
      await Counter.deleteMany({});
      console.log(`   Removed: ${delOrders.deletedCount} orders, ${delMachines.deletedCount} machines, ${delStock.deletedCount} stock items, ${delRolls.deletedCount} rolls, ${delCAs.deletedCount} CAs.`);
    }

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const hour = 60 * 60 * 1000;

    // ----------------------------------------------------
    // 1. SEED MACHINES
    // ----------------------------------------------------
    const machineDefs = [
      { code: 'LM-01', name: 'Air-Jet Loom Alpha 1', type: 'loom', status: 'running', dailyCapacity: 600, capacity: 600, capacityUnit: 'meters', isDemo: true },
      { code: 'LM-02', name: 'Air-Jet Loom Alpha 2', type: 'loom', status: 'running', dailyCapacity: 500, capacity: 500, capacityUnit: 'meters', isDemo: true },
      { code: 'LM-03', name: 'Rapier Loom Beta 1', type: 'loom', status: 'running', dailyCapacity: 400, capacity: 400, capacityUnit: 'meters', isDemo: true },
      { code: 'LM-04', name: 'Rapier Loom Beta 2', type: 'loom', status: 'available', dailyCapacity: 500, capacity: 500, capacityUnit: 'meters', isDemo: true },
      { code: 'KN-01', name: 'Circular Knit Station 1', type: 'knitting_machine', status: 'available', dailyCapacity: 350, capacity: 350, capacityUnit: 'meters', isDemo: true },
      { code: 'KN-02', name: 'Flatbed Knit Station 2', type: 'knitting_machine', status: 'available', dailyCapacity: 300, capacity: 300, capacityUnit: 'meters', isDemo: true },
      { code: 'DY-01', name: 'High-Temp Jet Dyeing Vat', type: 'dyeing_vat', status: 'running', dailyCapacity: 800, capacity: 800, capacityUnit: 'kg', isDemo: true },
      { code: 'FN-01', name: 'Stenter Finishing Range', type: 'finishing_range', status: 'running', dailyCapacity: 700, capacity: 700, capacityUnit: 'meters', isDemo: true },
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
    // 2. SEED MATERIAL STOCK
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
    // 3. SEED PRODUCTION ORDERS
    // ----------------------------------------------------
    const orderDefs = [
      { orderNumber: 'PO-2026-0001', customer: 'Meridian Apparel Co.', fabricType: '100% Combed Cotton Single Jersey 180 GSM', requiredQuantity: 6000, producedQuantity: 3600, unit: 'meters', startDate: new Date(now.getTime() - 10 * day), dueDate: new Date(now.getTime() + 10 * day), status: 'in_progress', currentStage: 'weaving', priority: 'high', assignedMachine: machineMap['LM-01']?._id, notes: 'Export grade fabric for Summer Casuals collection.', isDemo: true },
      { orderNumber: 'PO-2026-0002', customer: 'Aura Fashion Group', fabricType: '98/2 Cotton Spandex Twill Denim 11.5 Oz', requiredQuantity: 8000, producedQuantity: 5600, unit: 'meters', productionRatePerDay: 800, startDate: new Date(now.getTime() - 14 * day), dueDate: new Date(now.getTime() + 8 * day), status: 'in_progress', currentStage: 'weaving', priority: 'urgent', assignedMachine: machineMap['LM-02']?._id, notes: 'Fast-track denim line running with speed override.', isDemo: true },
      { orderNumber: 'PO-2026-0003', customer: 'Cascade Sportswear', fabricType: '100% Polyester Quick-Dry Birdseye Mesh', requiredQuantity: 4500, producedQuantity: 1500, unit: 'meters', startDate: new Date(now.getTime() - 4 * day), dueDate: new Date(now.getTime() + 4 * day), status: 'in_progress', currentStage: 'weaving', priority: 'medium', assignedMachine: machineMap['LM-03']?._id, notes: 'Antimicrobial and UV coating specification. Needs rescue loom.', isDemo: true },
      { orderNumber: 'PO-2026-0004', customer: 'Loom & Linen Corp.', fabricType: '60/40 Linen Cotton Plain Weave 160 GSM', requiredQuantity: 3000, producedQuantity: 1200, unit: 'meters', startDate: new Date(now.getTime() - 5 * day), dueDate: new Date(now.getTime() + 15 * day), status: 'in_progress', currentStage: 'weaving', priority: 'low', assignedMachine: null, notes: 'Awaiting loom workcenter assignment.', isDemo: true },
      { orderNumber: 'PO-2026-0005', customer: 'Vanguard Uniforms Ltd.', fabricType: '65/35 Poly-Cotton Heavy Drill 240 GSM', requiredQuantity: 5000, producedQuantity: 5000, unit: 'meters', startDate: new Date(now.getTime() - 20 * day), dueDate: new Date(now.getTime() - 2 * day), status: 'completed', currentStage: 'dispatched', priority: 'high', assignedMachine: null, notes: 'Quality inspection passed grade A. Shipped on schedule.', isDemo: true },
      { orderNumber: 'PO-2026-0006', customer: 'Meridian Apparel Co.', fabricType: '100% Cotton Poplin Solid Dyed 120 GSM', requiredQuantity: 4000, producedQuantity: 4000, unit: 'meters', startDate: new Date(now.getTime() - 15 * day), dueDate: new Date(now.getTime() - 1 * day), status: 'completed', currentStage: 'dispatched', priority: 'medium', assignedMachine: null, notes: 'Dispatched to central warehouse.', isDemo: true },
      { orderNumber: 'PO-2026-0007', customer: 'Nordic Knitwear Co.', fabricType: '100% Viscose Rib Knit 220 GSM', requiredQuantity: 2500, producedQuantity: 2500, unit: 'meters', startDate: new Date(now.getTime() - 12 * day), dueDate: new Date(now.getTime() - 3 * day), status: 'completed', currentStage: 'dispatched', priority: 'low', assignedMachine: null, notes: 'Fabric rolls packaged with moisture barrier.', isDemo: true },
      { orderNumber: 'PO-2026-0008', customer: 'Aura Fashion Group', fabricType: '100% Rayon Challis Botanical Print Yarn', requiredQuantity: 5000, producedQuantity: 1000, unit: 'kg', startDate: new Date(now.getTime() - 9 * day), dueDate: new Date(now.getTime() + 2 * day), status: 'in_progress', currentStage: 'dyeing', priority: 'urgent', assignedMachine: machineMap['DY-01']?._id, notes: 'Dyeing vat undergoing valve maintenance.', isDemo: true },
      { orderNumber: 'PO-2026-0009', customer: 'Vanguard Uniforms Ltd.', fabricType: '100% Nylon Oxford Waterproof 210D', requiredQuantity: 3500, producedQuantity: 2000, unit: 'meters', startDate: new Date(now.getTime() - 10 * day), dueDate: new Date(now.getTime() + 12 * day), status: 'on_hold', currentStage: 'finishing', priority: 'high', assignedMachine: machineMap['LM-01']?._id, notes: 'On hold awaiting buyer lab dip shade approval.', isDemo: true },
      { orderNumber: 'PO-2026-0010', customer: 'Cascade Sportswear', fabricType: '88/12 Poly-Spandex Interlock 260 GSM', requiredQuantity: 4000, producedQuantity: 2800, unit: 'meters', startDate: new Date(now.getTime() - 15 * day), dueDate: new Date(now.getTime() - 3 * day), status: 'in_progress', currentStage: 'quality_inspection', priority: 'urgent', assignedMachine: machineMap['LM-02']?._id, notes: 'Overdue order. Finishing station bottleneck resolved.', isDemo: true },
      { orderNumber: 'PO-2026-0011', customer: 'Apex Textiles Ltd.', fabricType: '100% Combed Cotton Oxford 150 GSM', requiredQuantity: 6500, producedQuantity: 4200, unit: 'meters', startDate: new Date(now.getTime() - 14 * day), dueDate: new Date(now.getTime() - 1 * day), status: 'in_progress', currentStage: 'finishing', priority: 'high', assignedMachine: machineMap['LM-03']?._id, notes: 'Expedited transport booked to mitigate delivery delay.', isDemo: true },
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
    // 4. SEED FABRIC ROLLS (24 rolls covering all Module 4 requirements)
    // ----------------------------------------------------
    const rollDefs = [
      // 1. GREY - PENDING (Fresh off loom)
      {
        rollId: 'FR-2026-000001',
        order: orderMap['PO-2026-0001']?._id,
        machine: machineMap['LM-01']?._id,
        quantityMetres: 120.5,
        weight: 24.2,
        stage: 'GREY',
        stageEnteredAt: new Date(now.getTime() - 2 * hour),
        stageHistory: [{ stage: 'GREY', machineCode: 'LM-01', enteredAt: new Date(now.getTime() - 2 * hour), exitedAt: null }],
        qualityStatus: 'PENDING',
        defectNotes: '',
        inspectedAt: null,
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [],
        isDemo: true,
      },
      // 2. GREY - OVERDUE INSPECTION (Breaches 4h SLA, entered 6h ago)
      {
        rollId: 'FR-2026-000002',
        order: orderMap['PO-2026-0001']?._id,
        machine: machineMap['LM-01']?._id,
        quantityMetres: 118.0,
        weight: 23.8,
        stage: 'GREY',
        stageEnteredAt: new Date(now.getTime() - 6 * hour),
        stageHistory: [{ stage: 'GREY', machineCode: 'LM-01', enteredAt: new Date(now.getTime() - 6 * hour), exitedAt: null }],
        qualityStatus: 'PENDING',
        defectNotes: '',
        inspectedAt: null,
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [],
        isDemo: true,
      },
      // 3. GREY - PASS (Healthy machine LM-01)
      {
        rollId: 'FR-2026-000003',
        order: orderMap['PO-2026-0001']?._id,
        machine: machineMap['LM-01']?._id,
        quantityMetres: 125.0,
        weight: 25.1,
        stage: 'GREY',
        stageEnteredAt: new Date(now.getTime() - 1 * day),
        stageHistory: [{ stage: 'GREY', machineCode: 'LM-01', enteredAt: new Date(now.getTime() - 1 * day), exitedAt: null }],
        qualityStatus: 'PASS',
        defectNotes: 'Minor broken end within tolerance.',
        inspectedAt: new Date(now.getTime() - 1 * day + 1 * hour),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [{ code: 'BROKEN_END', severity: 'MINOR', quantity: 2 }],
            defectPoints: 2,
            pointsPer100m: 1.6,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-01',
            defectNotes: 'Minor broken end within tolerance.',
            inspectorName: 'Devon Vance (QA Lead)',
            inspectedAt: new Date(now.getTime() - 1 * day + 1 * hour),
          },
        ],
        isDemo: true,
      },
      // 4. GREY -> REJECT (Caught at GREY: Critical hole defect)
      {
        rollId: 'FR-2026-000004',
        order: orderMap['PO-2026-0002']?._id,
        machine: machineMap['LM-02']?._id,
        quantityMetres: 100.0,
        weight: 20.0,
        stage: 'GREY',
        stageEnteredAt: new Date(now.getTime() - 2 * day),
        stageHistory: [{ stage: 'GREY', machineCode: 'LM-02', enteredAt: new Date(now.getTime() - 2 * day), exitedAt: null }],
        qualityStatus: 'REJECT',
        defectNotes: 'Large continuous hole from shuttle smash. Fabric scrap.',
        inspectedAt: new Date(now.getTime() - 2 * day + 2 * hour),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'REJECT',
            defects: [{ code: 'HOLE', severity: 'CRITICAL', quantity: 1 }],
            defectPoints: 5,
            pointsPer100m: 5.0,
            recommendedResult: 'REJECT',
            isOverride: false,
            machineCode: 'LM-02',
            defectNotes: 'Large continuous hole from shuttle smash. Fabric scrap.',
            inspectorName: 'Sarah Lin (Senior QA)',
            inspectedAt: new Date(now.getTime() - 2 * day + 2 * hour),
          },
        ],
        isDemo: true,
      },
      // 5. LM-02 Hotspot sample 1: REWORK (Weft bar defect)
      {
        rollId: 'FR-2026-000005',
        order: orderMap['PO-2026-0002']?._id,
        machine: machineMap['LM-02']?._id,
        quantityMetres: 100.0,
        weight: 20.5,
        stage: 'GREY',
        stageEnteredAt: new Date(now.getTime() - 3 * day),
        stageHistory: [{ stage: 'GREY', machineCode: 'LM-02', enteredAt: new Date(now.getTime() - 3 * day), exitedAt: null }],
        qualityStatus: 'REWORK',
        defectNotes: 'Multiple weft bars across middle 30m.',
        inspectedAt: new Date(now.getTime() - 3 * day + 2 * hour),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'REWORK',
            defects: [{ code: 'WEFT_BAR', severity: 'MAJOR', quantity: 8 }],
            defectPoints: 24,
            pointsPer100m: 24.0,
            recommendedResult: 'REWORK',
            isOverride: false,
            machineCode: 'LM-02',
            defectNotes: 'Multiple weft bars across middle 30m.',
            inspectorName: 'Sarah Lin (Senior QA)',
            inspectedAt: new Date(now.getTime() - 3 * day + 2 * hour),
          },
        ],
        isDemo: true,
      },
      // 6. LM-02 Hotspot sample 2: REWORK (Weft bar defect)
      {
        rollId: 'FR-2026-000006',
        order: orderMap['PO-2026-0002']?._id,
        machine: machineMap['LM-02']?._id,
        quantityMetres: 100.0,
        weight: 21.0,
        stage: 'GREY',
        stageEnteredAt: new Date(now.getTime() - 4 * day),
        stageHistory: [{ stage: 'GREY', machineCode: 'LM-02', enteredAt: new Date(now.getTime() - 4 * day), exitedAt: null }],
        qualityStatus: 'REWORK',
        defectNotes: 'Persistent weft bar banding.',
        inspectedAt: new Date(now.getTime() - 4 * day + 1 * hour),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'REWORK',
            defects: [{ code: 'WEFT_BAR', severity: 'MAJOR', quantity: 9 }],
            defectPoints: 27,
            pointsPer100m: 27.0,
            recommendedResult: 'REWORK',
            isOverride: false,
            machineCode: 'LM-02',
            defectNotes: 'Persistent weft bar banding.',
            inspectorName: 'Marcus Cole',
            inspectedAt: new Date(now.getTime() - 4 * day + 1 * hour),
          },
        ],
        isDemo: true,
      },
      // 7. LM-02 Hotspot sample 3: REWORK (Weft bar defect -> Recurrence Alert!)
      {
        rollId: 'FR-2026-000007',
        order: orderMap['PO-2026-0002']?._id,
        machine: machineMap['LM-02']?._id,
        quantityMetres: 100.0,
        weight: 20.0,
        stage: 'GREY',
        stageEnteredAt: new Date(now.getTime() - 5 * day),
        stageHistory: [{ stage: 'GREY', machineCode: 'LM-02', enteredAt: new Date(now.getTime() - 5 * day), exitedAt: null }],
        qualityStatus: 'REWORK',
        defectNotes: 'Weft bar recurrence on LM-02.',
        inspectedAt: new Date(now.getTime() - 5 * day + 1 * hour),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'REWORK',
            defects: [{ code: 'WEFT_BAR', severity: 'MAJOR', quantity: 8 }],
            defectPoints: 24,
            pointsPer100m: 24.0,
            recommendedResult: 'REWORK',
            isOverride: false,
            machineCode: 'LM-02',
            defectNotes: 'Weft bar recurrence on LM-02.',
            inspectorName: 'Sarah Lin (Senior QA)',
            inspectedAt: new Date(now.getTime() - 5 * day + 1 * hour),
          },
        ],
        isDemo: true,
      },
      // 8. LM-02 Hotspot sample 4: PASS
      {
        rollId: 'FR-2026-000008',
        order: orderMap['PO-2026-0002']?._id,
        machine: machineMap['LM-02']?._id,
        quantityMetres: 100.0,
        weight: 20.0,
        stage: 'GREY',
        stageEnteredAt: new Date(now.getTime() - 6 * day),
        stageHistory: [{ stage: 'GREY', machineCode: 'LM-02', enteredAt: new Date(now.getTime() - 6 * day), exitedAt: null }],
        qualityStatus: 'PASS',
        defectNotes: 'Clean weave pass.',
        inspectedAt: new Date(now.getTime() - 6 * day + 1 * hour),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [{ code: 'SLUB', severity: 'MINOR', quantity: 3 }],
            defectPoints: 3,
            pointsPer100m: 3.0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-02',
            defectNotes: 'Clean weave pass.',
            inspectorName: 'Devon Vance (QA Lead)',
            inspectedAt: new Date(now.getTime() - 6 * day + 1 * hour),
          },
        ],
        isDemo: true,
      },
      // 9. LM-02 Hotspot sample 5: PASS
      {
        rollId: 'FR-2026-000009',
        order: orderMap['PO-2026-0002']?._id,
        machine: machineMap['LM-02']?._id,
        quantityMetres: 100.0,
        weight: 20.0,
        stage: 'GREY',
        stageEnteredAt: new Date(now.getTime() - 6 * day + 4 * hour),
        stageHistory: [{ stage: 'GREY', machineCode: 'LM-02', enteredAt: new Date(now.getTime() - 6 * day + 4 * hour), exitedAt: null }],
        qualityStatus: 'PASS',
        defectNotes: 'Pass grade A.',
        inspectedAt: new Date(now.getTime() - 6 * day + 5 * hour),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0.0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-02',
            defectNotes: 'Pass grade A.',
            inspectorName: 'Devon Vance (QA Lead)',
            inspectedAt: new Date(now.getTime() - 6 * day + 5 * hour),
          },
        ],
        isDemo: true,
      },
      // 10. LM-02 Hotspot sample 6: PASS (Total: 6 first-pass on LM-02, 3 non-pass = 50% critical hotspot!)
      {
        rollId: 'FR-2026-000010',
        order: orderMap['PO-2026-0002']?._id,
        machine: machineMap['LM-02']?._id,
        quantityMetres: 100.0,
        weight: 20.0,
        stage: 'GREY',
        stageEnteredAt: new Date(now.getTime() - 5 * day + 4 * hour),
        stageHistory: [{ stage: 'GREY', machineCode: 'LM-02', enteredAt: new Date(now.getTime() - 5 * day + 4 * hour), exitedAt: null }],
        qualityStatus: 'PASS',
        defectNotes: 'Grade A.',
        inspectedAt: new Date(now.getTime() - 5 * day + 6 * hour),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0.0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-02',
            defectNotes: 'Grade A.',
            inspectorName: 'Sarah Lin (Senior QA)',
            inspectedAt: new Date(now.getTime() - 5 * day + 6 * hour),
          },
        ],
        isDemo: true,
      },
      // 11. GREY - REWORK LIMIT REACHED (2 reworks already at GREY)
      {
        rollId: 'FR-2026-000011',
        order: orderMap['PO-2026-0003']?._id,
        machine: machineMap['LM-03']?._id,
        quantityMetres: 100.0,
        weight: 20.0,
        stage: 'GREY',
        stageEnteredAt: new Date(now.getTime() - 3 * day),
        stageHistory: [{ stage: 'GREY', machineCode: 'LM-03', enteredAt: new Date(now.getTime() - 3 * day), exitedAt: null }],
        qualityStatus: 'REWORK',
        defectNotes: 'Second rework attempt still showing tension slubs.',
        inspectedAt: new Date(now.getTime() - 1 * day),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'REWORK',
            defects: [{ code: 'SLUB', severity: 'MAJOR', quantity: 8 }],
            defectPoints: 24,
            pointsPer100m: 24.0,
            recommendedResult: 'REWORK',
            isOverride: false,
            machineCode: 'LM-03',
            defectNotes: 'First rework inspection.',
            inspectorName: 'Devon Vance (QA Lead)',
            inspectedAt: new Date(now.getTime() - 2 * day),
          },
          {
            stage: 'GREY',
            result: 'REWORK',
            defects: [{ code: 'SLUB', severity: 'MAJOR', quantity: 7 }],
            defectPoints: 21,
            pointsPer100m: 21.0,
            recommendedResult: 'REWORK',
            isOverride: false,
            machineCode: 'LM-03',
            defectNotes: 'Second rework attempt still showing tension slubs.',
            inspectorName: 'Sarah Lin (Senior QA)',
            inspectedAt: new Date(now.getTime() - 1 * day),
          },
        ],
        isDemo: true,
      },
      // 12. DYEING - PENDING (Advanced from GREY to DYEING on DY-01)
      {
        rollId: 'FR-2026-000012',
        order: orderMap['PO-2026-0001']?._id,
        machine: machineMap['DY-01']?._id,
        quantityMetres: 120.0,
        weight: 24.0,
        stage: 'DYEING',
        stageEnteredAt: new Date(now.getTime() - 2 * hour),
        stageHistory: [
          { stage: 'GREY', machineCode: 'LM-01', enteredAt: new Date(now.getTime() - 2 * day), exitedAt: new Date(now.getTime() - 2 * hour) },
          { stage: 'DYEING', machineCode: 'DY-01', enteredAt: new Date(now.getTime() - 2 * hour), exitedAt: null },
        ],
        qualityStatus: 'PENDING',
        defectNotes: '',
        inspectedAt: null,
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [{ code: 'SLUB', severity: 'MINOR', quantity: 2 }],
            defectPoints: 2,
            pointsPer100m: 1.67,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-01',
            defectNotes: 'Grey inspection passed.',
            inspectorName: 'Devon Vance',
            inspectedAt: new Date(now.getTime() - 2 * day + 2 * hour),
          },
        ],
        isDemo: true,
      },
      // 13. DYEING - REJECT (Caught at DYEING: Severe shade variation)
      {
        rollId: 'FR-2026-000013',
        order: orderMap['PO-2026-0008']?._id,
        machine: machineMap['DY-01']?._id,
        quantityMetres: 100.0,
        weight: 20.0,
        stage: 'DYEING',
        stageEnteredAt: new Date(now.getTime() - 3 * day),
        stageHistory: [
          { stage: 'GREY', machineCode: 'LM-01', enteredAt: new Date(now.getTime() - 5 * day), exitedAt: new Date(now.getTime() - 3 * day) },
          { stage: 'DYEING', machineCode: 'DY-01', enteredAt: new Date(now.getTime() - 3 * day), exitedAt: null },
        ],
        qualityStatus: 'REJECT',
        defectNotes: 'Severe dye shade variation across entire bolt.',
        inspectedAt: new Date(now.getTime() - 2 * day),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-01',
            defectNotes: 'Grey clear.',
            inspectorName: 'Devon Vance',
            inspectedAt: new Date(now.getTime() - 4 * day),
          },
          {
            stage: 'DYEING',
            result: 'REJECT',
            defects: [{ code: 'SHADE_VARIATION', severity: 'MAJOR', quantity: 9 }],
            defectPoints: 27,
            pointsPer100m: 27.0,
            recommendedResult: 'REJECT',
            isOverride: false,
            machineCode: 'DY-01',
            defectNotes: 'Severe dye shade variation across entire bolt.',
            inspectorName: 'Sarah Lin',
            inspectedAt: new Date(now.getTime() - 2 * day),
          },
        ],
        isDemo: true,
      },
      // 14. DYEING - PASS (Dyeing machine DY-01 recurrence sample 1)
      {
        rollId: 'FR-2026-000014',
        order: orderMap['PO-2026-0001']?._id,
        machine: machineMap['DY-01']?._id,
        quantityMetres: 100.0,
        weight: 20.0,
        stage: 'DYEING',
        stageEnteredAt: new Date(now.getTime() - 4 * day),
        stageHistory: [
          { stage: 'GREY', machineCode: 'LM-01', enteredAt: new Date(now.getTime() - 6 * day), exitedAt: new Date(now.getTime() - 4 * day) },
          { stage: 'DYEING', machineCode: 'DY-01', enteredAt: new Date(now.getTime() - 4 * day), exitedAt: null },
        ],
        qualityStatus: 'PASS',
        defectNotes: 'Slight shade variation within Delta-E 0.8 tolerance.',
        inspectedAt: new Date(now.getTime() - 3 * day),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-01',
            defectNotes: 'Grey passed.',
            inspectorName: 'Devon Vance',
            inspectedAt: new Date(now.getTime() - 5 * day),
          },
          {
            stage: 'DYEING',
            result: 'PASS',
            defects: [{ code: 'SHADE_VARIATION', severity: 'MINOR', quantity: 3 }],
            defectPoints: 3,
            pointsPer100m: 3.0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'DY-01',
            defectNotes: 'Slight shade variation within Delta-E 0.8 tolerance.',
            inspectorName: 'Sarah Lin',
            inspectedAt: new Date(now.getTime() - 3 * day),
          },
        ],
        isDemo: true,
      },
      // 15. DYEING - PASS (Dyeing machine DY-01 recurrence sample 2)
      {
        rollId: 'FR-2026-000015',
        order: orderMap['PO-2026-0001']?._id,
        machine: machineMap['DY-01']?._id,
        quantityMetres: 100.0,
        weight: 20.0,
        stage: 'DYEING',
        stageEnteredAt: new Date(now.getTime() - 5 * day),
        stageHistory: [
          { stage: 'GREY', machineCode: 'LM-01', enteredAt: new Date(now.getTime() - 7 * day), exitedAt: new Date(now.getTime() - 5 * day) },
          { stage: 'DYEING', machineCode: 'DY-01', enteredAt: new Date(now.getTime() - 5 * day), exitedAt: null },
        ],
        qualityStatus: 'PASS',
        defectNotes: 'Minor dye spots cleaned up in wash.',
        inspectedAt: new Date(now.getTime() - 4 * day),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-01',
            defectNotes: 'Grey passed.',
            inspectorName: 'Devon Vance',
            inspectedAt: new Date(now.getTime() - 6 * day),
          },
          {
            stage: 'DYEING',
            result: 'PASS',
            defects: [{ code: 'SHADE_VARIATION', severity: 'MINOR', quantity: 4 }],
            defectPoints: 4,
            pointsPer100m: 4.0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'DY-01',
            defectNotes: 'Minor dye spots cleaned up in wash.',
            inspectorName: 'Devon Vance',
            inspectedAt: new Date(now.getTime() - 4 * day),
          },
        ],
        isDemo: true,
      },
      // 16. FINISHING - PENDING
      {
        rollId: 'FR-2026-000016',
        order: orderMap['PO-2026-0001']?._id,
        machine: machineMap['FN-01']?._id,
        quantityMetres: 100.0,
        weight: 20.0,
        stage: 'FINISHING',
        stageEnteredAt: new Date(now.getTime() - 1 * hour),
        stageHistory: [
          { stage: 'GREY', machineCode: 'LM-01', enteredAt: new Date(now.getTime() - 5 * day), exitedAt: new Date(now.getTime() - 3 * day) },
          { stage: 'DYEING', machineCode: 'DY-01', enteredAt: new Date(now.getTime() - 3 * day), exitedAt: new Date(now.getTime() - 1 * hour) },
          { stage: 'FINISHING', machineCode: 'FN-01', enteredAt: new Date(now.getTime() - 1 * hour), exitedAt: null },
        ],
        qualityStatus: 'PENDING',
        defectNotes: '',
        inspectedAt: null,
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-01',
            defectNotes: 'Grey pass.',
            inspectorName: 'Devon Vance',
            inspectedAt: new Date(now.getTime() - 4 * day),
          },
          {
            stage: 'DYEING',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'DY-01',
            defectNotes: 'Dyeing pass.',
            inspectorName: 'Sarah Lin',
            inspectedAt: new Date(now.getTime() - 2 * day),
          },
        ],
        isDemo: true,
      },
      // 17. FINISHING - PASS (With Lenient Override & Valid Reason)
      {
        rollId: 'FR-2026-000017',
        order: orderMap['PO-2026-0001']?._id,
        machine: machineMap['FN-01']?._id,
        quantityMetres: 100.0,
        weight: 20.0,
        stage: 'FINISHING',
        stageEnteredAt: new Date(now.getTime() - 2 * day),
        stageHistory: [
          { stage: 'GREY', machineCode: 'LM-01', enteredAt: new Date(now.getTime() - 6 * day), exitedAt: new Date(now.getTime() - 4 * day) },
          { stage: 'DYEING', machineCode: 'DY-01', enteredAt: new Date(now.getTime() - 4 * day), exitedAt: new Date(now.getTime() - 2 * day) },
          { stage: 'FINISHING', machineCode: 'FN-01', enteredAt: new Date(now.getTime() - 2 * day), exitedAt: null },
        ],
        qualityStatus: 'PASS',
        defectNotes: 'Minor handfeel stiffness approved per buyer waiver.',
        inspectedAt: new Date(now.getTime() - 1 * day),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-01',
            defectNotes: 'Grey pass.',
            inspectorName: 'Devon Vance',
            inspectedAt: new Date(now.getTime() - 5 * day),
          },
          {
            stage: 'DYEING',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'DY-01',
            defectNotes: 'Dyeing pass.',
            inspectorName: 'Sarah Lin',
            inspectedAt: new Date(now.getTime() - 3 * day),
          },
          {
            stage: 'FINISHING',
            result: 'PASS',
            defects: [{ code: 'HANDFEEL_ISSUE', severity: 'MAJOR', quantity: 4 }],
            defectPoints: 12,
            pointsPer100m: 12.0,
            recommendedResult: 'REWORK',
            isOverride: true,
            overrideReason: 'Approved by buyer QA team under concession waiver #WAIV-2026-08',
            machineCode: 'FN-01',
            defectNotes: 'Minor handfeel stiffness approved per buyer waiver.',
            inspectorName: 'Devon Vance (QA Lead)',
            inspectedAt: new Date(now.getTime() - 1 * day),
          },
        ],
        isDemo: true,
      },
      // 18. FINAL - ESCAPE DETECTED (GREY defect 'WEFT_BAR' escaped and caught at FINAL)
      {
        rollId: 'FR-2026-000018',
        order: orderMap['PO-2026-0002']?._id,
        machine: machineMap['FN-01']?._id,
        quantityMetres: 100.0,
        weight: 20.0,
        stage: 'FINAL',
        stageEnteredAt: new Date(now.getTime() - 1 * day),
        stageHistory: [
          { stage: 'GREY', machineCode: 'LM-02', enteredAt: new Date(now.getTime() - 8 * day), exitedAt: new Date(now.getTime() - 5 * day) },
          { stage: 'DYEING', machineCode: 'DY-01', enteredAt: new Date(now.getTime() - 5 * day), exitedAt: new Date(now.getTime() - 3 * day) },
          { stage: 'FINISHING', machineCode: 'FN-01', enteredAt: new Date(now.getTime() - 3 * day), exitedAt: new Date(now.getTime() - 1 * day) },
          { stage: 'FINAL', machineCode: null, enteredAt: new Date(now.getTime() - 1 * day), exitedAt: null },
        ],
        qualityStatus: 'REWORK',
        defectNotes: 'Escaped weft bar from weaving discovered during final inspection.',
        inspectedAt: new Date(now.getTime() - 12 * hour),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-02',
            defectNotes: 'Grey passed.',
            inspectorName: 'Devon Vance',
            inspectedAt: new Date(now.getTime() - 6 * day),
          },
          {
            stage: 'DYEING',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'DY-01',
            defectNotes: 'Dyeing passed.',
            inspectorName: 'Sarah Lin',
            inspectedAt: new Date(now.getTime() - 4 * day),
          },
          {
            stage: 'FINISHING',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'FN-01',
            defectNotes: 'Finishing passed.',
            inspectorName: 'Marcus Cole',
            inspectedAt: new Date(now.getTime() - 2 * day),
          },
          {
            stage: 'FINAL',
            result: 'REWORK',
            defects: [{ code: 'WEFT_BAR', severity: 'MAJOR', quantity: 3 }],
            defectPoints: 9,
            pointsPer100m: 9.0,
            recommendedResult: 'REWORK',
            isOverride: false,
            machineCode: 'FN-01',
            defectNotes: 'Escaped weft bar from weaving discovered during final inspection.',
            inspectorName: 'Devon Vance (QA Lead)',
            inspectedAt: new Date(now.getTime() - 12 * hour),
          },
        ],
        isDemo: true,
      },
      // 19. FINAL - REJECT (Late detection: Caught at FINAL)
      {
        rollId: 'FR-2026-000019',
        order: orderMap['PO-2026-0003']?._id,
        machine: machineMap['FN-01']?._id,
        quantityMetres: 100.0,
        weight: 20.0,
        stage: 'FINAL',
        stageEnteredAt: new Date(now.getTime() - 1 * day),
        stageHistory: [
          { stage: 'GREY', machineCode: 'LM-03', enteredAt: new Date(now.getTime() - 7 * day), exitedAt: new Date(now.getTime() - 4 * day) },
          { stage: 'DYEING', machineCode: 'DY-01', enteredAt: new Date(now.getTime() - 4 * day), exitedAt: new Date(now.getTime() - 2 * day) },
          { stage: 'FINISHING', machineCode: 'FN-01', enteredAt: new Date(now.getTime() - 2 * day), exitedAt: new Date(now.getTime() - 1 * day) },
          { stage: 'FINAL', machineCode: null, enteredAt: new Date(now.getTime() - 1 * day), exitedAt: null },
        ],
        qualityStatus: 'REJECT',
        defectNotes: 'Gross packing and label defects with uncorrectable selvage tear. Roll rejected.',
        inspectedAt: new Date(now.getTime() - 10 * hour),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-03',
            defectNotes: 'Grey pass.',
            inspectorName: 'Devon Vance',
            inspectedAt: new Date(now.getTime() - 5 * day),
          },
          {
            stage: 'DYEING',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'DY-01',
            defectNotes: 'Dyeing pass.',
            inspectorName: 'Sarah Lin',
            inspectedAt: new Date(now.getTime() - 3 * day),
          },
          {
            stage: 'FINISHING',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'FN-01',
            defectNotes: 'Finishing pass.',
            inspectorName: 'Marcus Cole',
            inspectedAt: new Date(now.getTime() - 1 * day),
          },
          {
            stage: 'FINAL',
            result: 'REJECT',
            defects: [
              { code: 'PACKING_DEFECT', severity: 'MAJOR', quantity: 3 },
              { code: 'LABEL_ERROR', severity: 'MAJOR', quantity: 3 },
            ],
            defectPoints: 18,
            pointsPer100m: 18.0,
            recommendedResult: 'REJECT',
            isOverride: false,
            machineCode: null,
            defectNotes: 'Gross packing and label defects with uncorrectable selvage tear. Roll rejected.',
            inspectorName: 'Devon Vance (QA Lead)',
            inspectedAt: new Date(now.getTime() - 10 * hour),
          },
        ],
        isDemo: true,
      },
      // 20. FINAL - PASS (READY_FOR_DISPATCH)
      {
        rollId: 'FR-2026-000020',
        order: orderMap['PO-2026-0005']?._id,
        machine: machineMap['LM-01']?._id,
        quantityMetres: 200.0,
        weight: 40.0,
        stage: 'FINAL',
        stageEnteredAt: new Date(now.getTime() - 3 * day),
        stageHistory: [
          { stage: 'GREY', machineCode: 'LM-01', enteredAt: new Date(now.getTime() - 10 * day), exitedAt: new Date(now.getTime() - 7 * day) },
          { stage: 'DYEING', machineCode: 'DY-01', enteredAt: new Date(now.getTime() - 7 * day), exitedAt: new Date(now.getTime() - 5 * day) },
          { stage: 'FINISHING', machineCode: 'FN-01', enteredAt: new Date(now.getTime() - 5 * day), exitedAt: new Date(now.getTime() - 3 * day) },
          { stage: 'FINAL', machineCode: null, enteredAt: new Date(now.getTime() - 3 * day), exitedAt: null },
        ],
        qualityStatus: 'PASS',
        defectNotes: 'All 4 gates passed flawlessly. Staged for shipping.',
        inspectedAt: new Date(now.getTime() - 2 * day),
        dispatchStatus: 'READY_FOR_DISPATCH',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-01',
            defectNotes: 'Grey passed.',
            inspectorName: 'Devon Vance',
            inspectedAt: new Date(now.getTime() - 8 * day),
          },
          {
            stage: 'DYEING',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'DY-01',
            defectNotes: 'Dyeing passed.',
            inspectorName: 'Sarah Lin',
            inspectedAt: new Date(now.getTime() - 6 * day),
          },
          {
            stage: 'FINISHING',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'FN-01',
            defectNotes: 'Finishing passed.',
            inspectorName: 'Marcus Cole',
            inspectedAt: new Date(now.getTime() - 4 * day),
          },
          {
            stage: 'FINAL',
            result: 'PASS',
            defects: [{ code: 'PACKING_DEFECT', severity: 'MINOR', quantity: 1 }],
            defectPoints: 1,
            pointsPer100m: 0.5,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: null,
            defectNotes: 'All 4 gates passed flawlessly. Staged for shipping.',
            inspectorName: 'Sarah Lin (Senior QA)',
            inspectedAt: new Date(now.getTime() - 2 * day),
          },
        ],
        isDemo: true,
      },
      // 21. FINAL - PASS (DISPATCHED)
      {
        rollId: 'FR-2026-000021',
        order: orderMap['PO-2026-0005']?._id,
        machine: machineMap['LM-01']?._id,
        quantityMetres: 250.0,
        weight: 50.0,
        stage: 'FINAL',
        stageEnteredAt: new Date(now.getTime() - 5 * day),
        stageHistory: [
          { stage: 'GREY', machineCode: 'LM-01', enteredAt: new Date(now.getTime() - 12 * day), exitedAt: new Date(now.getTime() - 9 * day) },
          { stage: 'DYEING', machineCode: 'DY-01', enteredAt: new Date(now.getTime() - 9 * day), exitedAt: new Date(now.getTime() - 7 * day) },
          { stage: 'FINISHING', machineCode: 'FN-01', enteredAt: new Date(now.getTime() - 7 * day), exitedAt: new Date(now.getTime() - 5 * day) },
          { stage: 'FINAL', machineCode: null, enteredAt: new Date(now.getTime() - 5 * day), exitedAt: new Date(now.getTime() - 2 * day) },
        ],
        qualityStatus: 'PASS',
        defectNotes: 'Dispatched to buyer.',
        inspectedAt: new Date(now.getTime() - 4 * day),
        dispatchStatus: 'DISPATCHED',
        dispatchedAt: new Date(now.getTime() - 2 * day),
        inspections: [
          {
            stage: 'FINAL',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: null,
            defectNotes: 'Dispatched to buyer.',
            inspectorName: 'Sarah Lin',
            inspectedAt: new Date(now.getTime() - 4 * day),
          },
        ],
        isDemo: true,
      },
      // 22. FINAL - PASS (DISPATCHED)
      {
        rollId: 'FR-2026-000022',
        order: orderMap['PO-2026-0006']?._id,
        machine: machineMap['LM-04']?._id,
        quantityMetres: 180.0,
        weight: 36.0,
        stage: 'FINAL',
        stageEnteredAt: new Date(now.getTime() - 6 * day),
        stageHistory: [
          { stage: 'GREY', machineCode: 'LM-04', enteredAt: new Date(now.getTime() - 14 * day), exitedAt: new Date(now.getTime() - 10 * day) },
          { stage: 'DYEING', machineCode: 'DY-01', enteredAt: new Date(now.getTime() - 10 * day), exitedAt: new Date(now.getTime() - 8 * day) },
          { stage: 'FINISHING', machineCode: 'FN-01', enteredAt: new Date(now.getTime() - 8 * day), exitedAt: new Date(now.getTime() - 6 * day) },
          { stage: 'FINAL', machineCode: null, enteredAt: new Date(now.getTime() - 6 * day), exitedAt: new Date(now.getTime() - 3 * day) },
        ],
        qualityStatus: 'PASS',
        defectNotes: 'Dispatched on schedule.',
        inspectedAt: new Date(now.getTime() - 5 * day),
        dispatchStatus: 'DISPATCHED',
        dispatchedAt: new Date(now.getTime() - 3 * day),
        inspections: [
          {
            stage: 'FINAL',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: null,
            defectNotes: 'Dispatched on schedule.',
            inspectorName: 'Devon Vance',
            inspectedAt: new Date(now.getTime() - 5 * day),
          },
        ],
        isDemo: true,
      },
      // 23. GREY - PASS (Healthy machine LM-04)
      {
        rollId: 'FR-2026-000023',
        order: orderMap['PO-2026-0004']?._id,
        machine: machineMap['LM-04']?._id,
        quantityMetres: 150.0,
        weight: 30.0,
        stage: 'GREY',
        stageEnteredAt: new Date(now.getTime() - 1 * day),
        stageHistory: [{ stage: 'GREY', machineCode: 'LM-04', enteredAt: new Date(now.getTime() - 1 * day), exitedAt: null }],
        qualityStatus: 'PASS',
        defectNotes: 'High speed loom run passed without defects.',
        inspectedAt: new Date(now.getTime() - 18 * hour),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [],
            defectPoints: 0,
            pointsPer100m: 0,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-04',
            defectNotes: 'High speed loom run passed without defects.',
            inspectorName: 'Devon Vance',
            inspectedAt: new Date(now.getTime() - 18 * hour),
          },
        ],
        isDemo: true,
      },
      // 24. GREY - PASS (Healthy machine LM-01)
      {
        rollId: 'FR-2026-000024',
        order: orderMap['PO-2026-0001']?._id,
        machine: machineMap['LM-01']?._id,
        quantityMetres: 130.0,
        weight: 26.0,
        stage: 'GREY',
        stageEnteredAt: new Date(now.getTime() - 20 * hour),
        stageHistory: [{ stage: 'GREY', machineCode: 'LM-01', enteredAt: new Date(now.getTime() - 20 * hour), exitedAt: null }],
        qualityStatus: 'PASS',
        defectNotes: 'Selvedge tension uniform.',
        inspectedAt: new Date(now.getTime() - 16 * hour),
        dispatchStatus: 'NOT_DISPATCHED',
        inspections: [
          {
            stage: 'GREY',
            result: 'PASS',
            defects: [{ code: 'OIL_STAIN', severity: 'MINOR', quantity: 1 }],
            defectPoints: 1,
            pointsPer100m: 0.77,
            recommendedResult: 'PASS',
            isOverride: false,
            machineCode: 'LM-01',
            defectNotes: 'Selvedge tension uniform.',
            inspectorName: 'Sarah Lin',
            inspectedAt: new Date(now.getTime() - 16 * hour),
          },
        ],
        isDemo: true,
      },
    ];

    let rollsInserted = 0;
    let rollsExisted = 0;

    for (const r of rollDefs) {
      if (!r.order || !r.machine) {
        console.warn(`⚠️ Skipping roll ${r.rollId}: missing order or machine.`);
        continue;
      }
      const res = await FabricRoll.findOneAndUpdate(
        { rollId: r.rollId },
        { $set: r },
        { upsert: true, new: true, rawResult: true }
      );
      if (res.lastErrorObject?.updatedExisting) {
        rollsExisted++;
      } else {
        rollsInserted++;
      }
    }
    console.log(`🎫 Fabric Rolls: ${rollsInserted} created, ${rollsExisted} existing.`);

    // Initialize sequence counter so next generated roll starts at 25
    const currentYear = new Date().getFullYear();
    await Counter.findOneAndUpdate(
      { name: `roll_${currentYear}` },
      { $max: { seq: 24 } },
      { upsert: true }
    );

    // ----------------------------------------------------
    // 5. SEED CORRECTIVE ACTIONS (4C: CAPA Records)
    // ----------------------------------------------------
    const caDefs = [
      // 1. OPEN (Investigation initiated on LM-02 Weft Bar)
      {
        actionNumber: 'CA-2026-0001',
        title: 'Weft Tension Guide Realignment & Calibration',
        stage: 'GREY',
        defectCode: 'WEFT_BAR',
        machine: machineMap['LM-02']?._id,
        rootCauseCategory: 'MACHINE',
        description: 'Repeated weft bars observed during denim weaving. Investigate pneumatic insertion nozzle pressure and check electronic yarn brake wear.',
        owner: 'Ramesh Kumar (Mechanical Lead)',
        dueDate: new Date(now.getTime() + 4 * day),
        status: 'OPEN',
        isDemo: true,
      },
      // 2. IN_PROGRESS (Dyeing Jet Nozzle Descaling)
      {
        actionNumber: 'CA-2026-0002',
        title: 'Jet Dyeing Vat DY-01 Flow Sensor Overhaul',
        stage: 'DYEING',
        defectCode: 'SHADE_VARIATION',
        machine: machineMap['DY-01']?._id,
        rootCauseCategory: 'MACHINE',
        description: 'Uneven liquor ratio causing longitudinal shade variance. Cleaning internal heat exchanger and recalibrating dosing valves.',
        owner: 'Priya Sharma (Chemical Engineer)',
        dueDate: new Date(now.getTime() + 2 * day),
        status: 'IN_PROGRESS',
        isDemo: true,
      },
      // 3. DONE (With recurrences tracked since fix date)
      {
        actionNumber: 'CA-2026-0003',
        title: 'Loom-02 Shuttle Box Buffer Replacement',
        stage: 'GREY',
        defectCode: 'WEFT_BAR',
        machine: machineMap['LM-02']?._id,
        rootCauseCategory: 'MACHINE',
        description: 'Replaced hydraulic shock absorbers on left weft cutter.',
        owner: 'Anil Mehta (Maintenance Tech)',
        dueDate: new Date(now.getTime() - 2 * day),
        status: 'DONE',
        doneAt: new Date(now.getTime() - 6 * day), // Marked done 6 days ago -> subsequent weft bar inspections on LM-02 trigger recurrence!
        isDemo: true,
      },
      // 4. VERIFIED (Successful fix with verification note)
      {
        actionNumber: 'CA-2026-0004',
        title: 'Stenter Heat Chamber Temperature Sensor Calibration',
        stage: 'FINISHING',
        defectCode: 'HANDFEEL_ISSUE',
        machine: machineMap['FN-01']?._id,
        rootCauseCategory: 'METHOD',
        description: 'Calibrated thermocouples in zones 3 & 4. Verified with pyrometer during 5 consecutive production batches.',
        owner: 'Devon Vance (QA Lead)',
        dueDate: new Date(now.getTime() - 3 * day),
        status: 'VERIFIED',
        doneAt: new Date(now.getTime() - 5 * day),
        verifiedAt: new Date(now.getTime() - 2 * day),
        verificationNote: 'Zero handfeel stiffness defects recorded across 1,200m of finished goods in the past 48 hours.',
        isDemo: true,
      },
    ];

    let caInserted = 0;
    let caExisted = 0;

    for (const ca of caDefs) {
      const res = await CorrectiveAction.findOneAndUpdate(
        { actionNumber: ca.actionNumber },
        { $set: ca },
        { upsert: true, new: true, rawResult: true }
      );
      if (res.lastErrorObject?.updatedExisting) {
        caExisted++;
      } else {
        caInserted++;
      }
    }
    console.log(`🛠️ Corrective Actions: ${caInserted} created, ${caExisted} existing.`);

    // Initialize CA counter so next starts at 5
    await Counter.findOneAndUpdate(
      { name: `ca_${currentYear}` },
      { $max: { seq: 4 } },
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

if (require.main === module) {
  seed();
}

module.exports = seed;
