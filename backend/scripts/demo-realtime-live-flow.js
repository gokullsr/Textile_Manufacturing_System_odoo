/**
 * LoomIQ Full Real-Time End-to-End Live Workflow Verification Script
 * Executes against live running backend (http://localhost:5000)
 */

const API_BASE = 'http://localhost:5000/api';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${path}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function runLiveWorkflow() {
  console.log('🚀 Starting LoomIQ Full Real-Time Live Workflow Execution...\n');

  // Step 1: Health Check
  console.log('1️⃣ Checking API Health...');
  const health = await request('/health');
  console.log(`   ✅ API Status: ${health.status} | MongoDB: ${health.database?.status}\n`);

  // Step 2: Create a New Real Production Order
  console.log('2️⃣ Submitting New Real-Time Production Order (POST /api/orders)...');
  const orderPayload = {
    customer: 'Apex Global Luxury Mills',
    fabricType: '100% Linen 200 GSM Jacquard',
    requiredQuantity: 4500,
    dueDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +8 days
    priority: 'high',
    machineCode: 'LM-01',
    currentStage: 'weaving',
    notes: 'Premium linen run with bespoke jacquard selvedge pattern.',
  };

  const createdOrderRes = await request('/orders', {
    method: 'POST',
    body: JSON.stringify(orderPayload),
  });
  const newOrder = createdOrderRes.order;
  console.log(`   ✅ Order Created in MongoDB: ${newOrder.orderNumber}`);
  console.log(`      Buyer: ${newOrder.customer}`);
  console.log(`      Fabric: ${newOrder.fabricType}`);
  console.log(`      Required: ${newOrder.requiredQuantity} ${newOrder.unit}`);
  console.log(`      Machine: ${newOrder.assignedMachine?.code} (${newOrder.assignedMachine?.name})`);
  console.log(`      Initial Delay Status: ${newOrder.delayStatus || 'N/A'}\n`);

  // Step 3: Generate a Fabric Roll Passport
  console.log(`3️⃣ Generating Digital Fabric Passport for ${newOrder.orderNumber} (POST /api/rolls)...`);
  const rollPayload = {
    orderNumber: newOrder.orderNumber,
    machineCode: 'LM-01',
    quantityMetres: 250.75,
    weight: 48.2,
  };

  const createdRollRes = await request('/rolls', {
    method: 'POST',
    body: JSON.stringify(rollPayload),
  });
  const newRoll = createdRollRes.roll;
  console.log(`   ✅ Fabric Roll Registered: ${newRoll.rollId}`);
  console.log(`      Length: ${newRoll.quantityMetres} m | Weight: ${newRoll.weight} kg`);
  console.log(`      QR URL: ${newRoll.qrCodeUrl}`);
  console.log(`      Quality Status: ${newRoll.qualityStatus} | Dispatch Status: ${newRoll.dispatchStatus}\n`);

  // Step 4: Perform Quality Inspection
  console.log(`4️⃣ Logging Quality Inspection for ${newRoll.rollId} (PATCH /api/rolls/:rollId/inspection)...`);
  const inspectRes = await request(`/rolls/${newRoll.rollId}/inspection`, {
    method: 'PATCH',
    body: JSON.stringify({
      result: 'PASS',
      defectNotes: 'Zero weave flaws, uniform yarn tension verified across selvedge.',
    }),
  });
  console.log(`   ✅ Quality Status Updated: ${inspectRes.roll.qualityStatus}`);
  console.log(`      Allowable Actions: ${JSON.stringify(inspectRes.allowableActions)}\n`);

  // Step 5: Transition Dispatch Status: READY_FOR_DISPATCH -> DISPATCHED
  console.log(`5️⃣ Transitioning Dispatch Lifecycle for ${newRoll.rollId} (PATCH /api/rolls/:rollId/dispatch)...`);
  const readyRes = await request(`/rolls/${newRoll.rollId}/dispatch`, {
    method: 'PATCH',
    body: JSON.stringify({ dispatchStatus: 'READY_FOR_DISPATCH' }),
  });
  console.log(`   ✅ Dispatch State 1: ${readyRes.roll.dispatchStatus}`);

  const dispatchedRes = await request(`/rolls/${newRoll.rollId}/dispatch`, {
    method: 'PATCH',
    body: JSON.stringify({ dispatchStatus: 'DISPATCHED' }),
  });
  console.log(`   ✅ Dispatch State 2 (Terminal): ${dispatchedRes.roll.dispatchStatus}`);
  console.log(`      Dispatched At: ${dispatchedRes.roll.dispatchedAt}\n`);

  // Step 6: Live PATCH Progress Update on the Work Order
  console.log(`6️⃣ Updating Order Production Progress (PATCH /api/orders/${newOrder.orderNumber})...`);
  const patchOrderRes = await request(`/orders/${newOrder.orderNumber}`, {
    method: 'PATCH',
    body: JSON.stringify({
      producedQuantity: 3800,
      status: 'in_progress',
    }),
  });
  const updatedOrder = patchOrderRes.order;
  console.log(`   ✅ Progress Updated: ${updatedOrder.producedQuantity} / ${updatedOrder.requiredQuantity} (${updatedOrder.progressPercent}%)`);
  console.log(`      Remaining Quantity: ${updatedOrder.remainingQuantity} ${updatedOrder.unit}`);
  console.log(`      Live Recalculated Delay Status: ${updatedOrder.delayStatus}\n`);

  // Step 7: Inspect Explainable Delay Radar Math Breakdown
  console.log(`7️⃣ Fetching Explainable Delay Radar Assessment (GET /api/delay-radar/${newOrder.orderNumber})...`);
  const radarRes = await request(`/delay-radar/${newOrder.orderNumber}`);
  const assessment = radarRes.assessment;
  console.log(`   ✅ Rule-Based Verdict: ${assessment.status}`);
  console.log(`      Remaining Qty: ${assessment.remainingQuantity} ${assessment.unit}`);
  console.log(`      Daily Capacity: ${assessment.rate?.value} ${assessment.rate?.unit}/day (${assessment.rate?.machineCode})`);
  console.log(`      Est. Production Days: ${assessment.estimatedProductionDays} d`);
  console.log(`      Working Days Avail: ${assessment.availableProductionDays?.toFixed(1)} d`);
  console.log(`      Buffer Slack: ${assessment.slackDays?.toFixed(1)} d`);
  console.log(`      Human Explanation: "${assessment.reason}"`);
  console.log(`      Action Recommendation: "${assessment.suggestedAction?.text}"\n`);

  // Step 8: Factory Dashboard Live Summary
  console.log('8️⃣ Verifying Dashboard Live Aggregation (GET /api/dashboard/summary)...');
  const summaryRes = await request('/dashboard/summary');
  const kpis = summaryRes.kpis;
  console.log(`   ✅ Total Orders in System: ${kpis.totalOrders}`);
  console.log(`   ✅ Active Orders in Factory: ${kpis.activeOrders}`);
  console.log(`   ✅ Completed Orders: ${kpis.completedOrders}`);
  console.log(`   ✅ Delayed (Overdue) Orders: ${kpis.delayedOrders}`);
  console.log(`   ✅ At Risk Orders: ${kpis.atRiskOrders}`);
  console.log(`   ✅ On Track Orders: ${kpis.onTrackOrders}`);
  console.log(`   ✅ Factory Machines Running: ${kpis.machines?.running} / ${kpis.machines?.total}`);
  console.log(`   ✅ Inventory Stock Alerts: ${kpis.stock?.outOfStock} out, ${kpis.stock?.lowStock} low\n`);

  console.log('🎉 100% END-TO-END REAL-TIME WORKFLOW SUCCESSFULLY VERIFIED!');
}

runLiveWorkflow().catch((err) => {
  console.error('❌ Live Workflow Error:', err.message);
  process.exit(1);
});
