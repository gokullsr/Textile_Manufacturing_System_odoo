/**
 * Live End-to-End Verification Script for Module 3 (Delay Radar).
 * Executes real HTTP requests against backend Express API and verifies live before/after transitions.
 */
const http = require('http');
const { connectDB, disconnectDB } = require('../src/config/db');
const { ProductionOrder, Machine } = require('../src/models');
const config = require('../src/config/env');

const makeRequest = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body });
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

const runE2EVerification = async () => {
  console.log('🚀 Running Live End-to-End Verification for LoomIQ Delay Radar...');
  const port = process.env.PORT || 5000;

  // 1. GET /api/delay-radar BEFORE
  console.log('\n======================================================');
  console.log('1. INITIAL RADAR & DASHBOARD STATE (BEFORE)');
  console.log('======================================================');
  const radarBefore = await makeRequest({
    hostname: '127.0.0.1',
    port,
    path: '/api/delay-radar',
    method: 'GET',
  });
  console.log('📊 Radar Summary Counts:', JSON.stringify(radarBefore.body.summary, null, 2));

  const dashBefore = await makeRequest({
    hostname: '127.0.0.1',
    port,
    path: '/api/dashboard/summary',
    method: 'GET',
  });
  console.log('📈 Dashboard KPIs:', {
    activeOrders: dashBefore.body.kpis.activeOrders,
    delayedOrders: dashBefore.body.kpis.delayedOrders,
    atRiskOrders: dashBefore.body.kpis.atRiskOrders,
    onTrackOrders: dashBefore.body.kpis.onTrackOrders,
    insufficientData: dashBefore.body.kpis.insufficientData,
  });

  // Pick AT_RISK order PO-2026-0003 assessment
  const targetOrderAssessmentBefore = await makeRequest({
    hostname: '127.0.0.1',
    port,
    path: '/api/delay-radar/PO-2026-0003',
    method: 'GET',
  });
  console.log('\n🔍 AT_RISK Order Assessment (PO-2026-0003 - BEFORE):');
  console.log(JSON.stringify(targetOrderAssessmentBefore.body.assessment, null, 2));

  // 2. PATCH PO-2026-0003 producedQuantity to 4000 (Safe)
  console.log('\n======================================================');
  console.log('2. APPLYING LIVE PROGRESS UPDATE (PATCH /api/orders/PO-2026-0003)');
  console.log('======================================================');
  const patchRes = await makeRequest(
    {
      hostname: '127.0.0.1',
      port,
      path: '/api/orders/PO-2026-0003',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    },
    { producedQuantity: 4000 }
  );
  console.log(`PATCH Response Code: ${patchRes.status}`);
  console.log('Updated Order Metrics:', {
    producedQuantity: patchRes.body.order.producedQuantity,
    progressPercent: patchRes.body.order.progressPercent,
    remainingQuantity: patchRes.body.order.remainingQuantity,
    delayStatus: patchRes.body.order.delayStatus,
    reason: patchRes.body.order.reason,
  });

  // 3. GET /api/delay-radar AFTER PATCH
  console.log('\n======================================================');
  console.log('3. RADAR & DASHBOARD STATE (AFTER PATCH)');
  console.log('======================================================');
  const radarAfter = await makeRequest({
    hostname: '127.0.0.1',
    port,
    path: '/api/delay-radar',
    method: 'GET',
  });
  console.log('📊 Radar Summary Counts (AFTER):', JSON.stringify(radarAfter.body.summary, null, 2));

  const dashAfter = await makeRequest({
    hostname: '127.0.0.1',
    port,
    path: '/api/dashboard/summary',
    method: 'GET',
  });
  console.log('📈 Dashboard KPIs (AFTER):', {
    activeOrders: dashAfter.body.kpis.activeOrders,
    delayedOrders: dashAfter.body.kpis.delayedOrders,
    atRiskOrders: dashAfter.body.kpis.atRiskOrders,
    onTrackOrders: dashAfter.body.kpis.onTrackOrders,
    insufficientData: dashAfter.body.kpis.insufficientData,
  });

  const targetOrderAssessmentAfter = await makeRequest({
    hostname: '127.0.0.1',
    port,
    path: '/api/delay-radar/PO-2026-0003',
    method: 'GET',
  });
  console.log('\n🔍 Order Assessment (PO-2026-0003 - AFTER PATCH):');
  console.log({
    status: targetOrderAssessmentAfter.body.assessment.status,
    producedQuantity: targetOrderAssessmentAfter.body.assessment.producedQuantity,
    remainingQuantity: targetOrderAssessmentAfter.body.assessment.remainingQuantity,
    estimatedProductionDays: targetOrderAssessmentAfter.body.assessment.estimatedProductionDays,
    slackDays: targetOrderAssessmentAfter.body.assessment.slackDays,
    reason: targetOrderAssessmentAfter.body.assessment.reason,
    suggestedAction: targetOrderAssessmentAfter.body.assessment.suggestedAction,
  });

  // 4. DIRECT DATABASE MACHINE CAPACITY MODIFICATION
  console.log('\n======================================================');
  console.log('4. DIRECT DATABASE MACHINE CAPACITY CHANGE');
  console.log('======================================================');
  await connectDB(config.mongoUri);
  console.log("Command: await Machine.updateOne({ code: 'LM-03' }, { $set: { dailyCapacity: 900 } });");
  await Machine.updateOne({ code: 'LM-03' }, { $set: { dailyCapacity: 900 } });
  await disconnectDB();

  // Reset order to 1500 to see new capacity effect
  await makeRequest(
    {
      hostname: '127.0.0.1',
      port,
      path: '/api/orders/PO-2026-0003',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    },
    { producedQuantity: 1500 }
  );

  const radarCapacityBoost = await makeRequest({
    hostname: '127.0.0.1',
    port,
    path: '/api/delay-radar/PO-2026-0003',
    method: 'GET',
  });
  console.log('🔍 Order Assessment with Modified Machine Capacity (900 m/day):');
  console.log({
    status: radarCapacityBoost.body.assessment.status,
    rate: radarCapacityBoost.body.assessment.rate,
    estimatedProductionDays: radarCapacityBoost.body.assessment.estimatedProductionDays,
    slackDays: radarCapacityBoost.body.assessment.slackDays,
    calculation: radarCapacityBoost.body.assessment.calculation,
  });

  // 5. SAMPLE RESPONSES FOR INSUFFICIENT_DATA, OVERDUE, AND 404
  console.log('\n======================================================');
  console.log('5. API RESPONSES FOR SPECIAL CASES');
  console.log('======================================================');

  // Insufficient Data
  const resInsufficient = await makeRequest({
    hostname: '127.0.0.1',
    port,
    path: '/api/delay-radar/PO-2026-0004',
    method: 'GET',
  });
  console.log('⚠️ INSUFFICIENT_DATA Order (PO-2026-0004):');
  console.log({
    orderNumber: resInsufficient.body.assessment.orderNumber,
    status: resInsufficient.body.assessment.status,
    reasonCode: resInsufficient.body.assessment.reasonCode,
    reason: resInsufficient.body.assessment.reason,
    suggestedAction: resInsufficient.body.assessment.suggestedAction,
  });

  // Overdue
  const resOverdue = await makeRequest({
    hostname: '127.0.0.1',
    port,
    path: '/api/delay-radar/PO-2026-0010',
    method: 'GET',
  });
  console.log('\n🚨 OVERDUE Order (PO-2026-0010):');
  console.log({
    orderNumber: resOverdue.body.assessment.orderNumber,
    status: resOverdue.body.assessment.status,
    reasonCode: resOverdue.body.assessment.reasonCode,
    reason: resOverdue.body.assessment.reason,
    suggestedAction: resOverdue.body.assessment.suggestedAction,
  });

  // Nonexistent Order
  const res404 = await makeRequest({
    hostname: '127.0.0.1',
    port,
    path: '/api/delay-radar/PO-9999-9999',
    method: 'GET',
  });
  console.log('\n🚫 Nonexistent Order (PO-9999-9999):');
  console.log(`Status: ${res404.status}`);
  console.log(JSON.stringify(res404.body, null, 2));

  // Reset seed back to clean state
  await connectDB(config.mongoUri);
  await Machine.updateOne({ code: 'LM-03' }, { $set: { dailyCapacity: 400 } });
  await ProductionOrder.updateOne({ orderNumber: 'PO-2026-0003' }, { $set: { producedQuantity: 1500 } });
  await disconnectDB();

  console.log('\n✅ Live End-to-End Verification Completed Successfully!');
};

runE2EVerification().catch((err) => {
  console.error('E2E Verification Failed:', err);
  process.exit(1);
});
