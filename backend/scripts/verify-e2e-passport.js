const http = require('http');

const makeReq = (path, method = 'GET', body = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

(async () => {
  console.log('=== STARTING MODULE 2 E2E TEST WORKFLOW ===\n');

  // 1. Create a new roll with omitted ID (server generates next ID)
  const createRes = await makeReq('/api/rolls', 'POST', {
    orderNumber: 'PO-2026-0001',
    machineCode: 'LM-01',
    quantityMetres: 135.5,
    weight: 27.1
  });
  console.log('1. POST /api/rolls (Create new roll) -> Status:', createRes.status);
  console.log('   Generated Roll ID:', createRes.body.roll?.rollId);
  console.log('   Initial Quality:', createRes.body.roll?.qualityStatus);
  console.log('   Initial Dispatch:', createRes.body.roll?.dispatchStatus);
  console.log('   Allowed Actions:', createRes.body.roll?.allowedActions);

  const newId = createRes.body.roll?.rollId;

  // 2. Query passport via GET /api/rolls/:rollId
  const getRes = await makeReq(`/api/rolls/${newId}`);
  console.log('\n2. GET /api/rolls/' + newId + ' (Inspect Passport) -> Status:', getRes.status);
  console.log('   Order Linked:', getRes.body.roll?.order?.orderNumber, '(', getRes.body.roll?.order?.buyer, ')');
  console.log('   Machine Linked:', getRes.body.roll?.machine?.machineCode, '(', getRes.body.roll?.machine?.name, ')');
  console.log('   Quantity:', getRes.body.roll?.quantityMetres, 'metres');

  // 3. Submit Quality Inspection -> PASS
  const inspRes = await makeReq(`/api/rolls/${newId}/inspection`, 'PATCH', {
    result: 'PASS',
    defectNotes: '4-point inspection approved: Grade A export quality fabric',
    inspectorName: 'Devon Vance (QA Lead)'
  });
  console.log('\n3. PATCH /api/rolls/' + newId + '/inspection (Submit PASS) -> Status:', inspRes.status);
  console.log('   Updated Quality Status:', inspRes.body.roll?.qualityStatus);
  console.log('   Inspected At:', inspRes.body.roll?.inspectedAt);
  console.log('   History Count:', inspRes.body.roll?.inspections?.length);
  console.log('   New Allowed Actions:', inspRes.body.roll?.allowedActions);

  // 4. Dispatch Transition 1 -> READY_FOR_DISPATCH
  const readyRes = await makeReq(`/api/rolls/${newId}/dispatch`, 'PATCH', {
    dispatchStatus: 'READY_FOR_DISPATCH'
  });
  console.log('\n4. PATCH /api/rolls/' + newId + '/dispatch (READY_FOR_DISPATCH) -> Status:', readyRes.status);
  console.log('   Dispatch Status:', readyRes.body.roll?.dispatchStatus);
  console.log('   Allowed Actions:', readyRes.body.roll?.allowedActions);

  // 5. Dispatch Transition 2 -> DISPATCHED
  const dispatchRes = await makeReq(`/api/rolls/${newId}/dispatch`, 'PATCH', {
    dispatchStatus: 'DISPATCHED'
  });
  console.log('\n5. PATCH /api/rolls/' + newId + '/dispatch (DISPATCHED) -> Status:', dispatchRes.status);
  console.log('   Final Dispatch Status:', dispatchRes.body.roll?.dispatchStatus);
  console.log('   Dispatched At:', dispatchRes.body.roll?.dispatchedAt);
  console.log('   Terminal Allowed Actions:', dispatchRes.body.roll?.allowedActions);

  // 6. Negative Rule Checks
  console.log('\n--- Negative & Boundary Security Checks ---');
  // A. Try to inspect a DISPATCHED roll -> Expect 409
  const inspectDispatchedRes = await makeReq(`/api/rolls/${newId}/inspection`, 'PATCH', {
    result: 'PASS',
    defectNotes: 'Attempted reinspection'
  });
  console.log('6A. Inspecting DISPATCHED roll -> Status:', inspectDispatchedRes.status, '(Expected 409)');
  console.log('    Error Message:', inspectDispatchedRes.body?.error?.message);

  // B. Try to dispatch a REJECT roll -> Expect 409
  const dispatchRejectRes = await makeReq('/api/rolls/FR-2026-000011/dispatch', 'PATCH', {
    dispatchStatus: 'READY_FOR_DISPATCH'
  });
  console.log('6B. Dispatching REJECT roll -> Status:', dispatchRejectRes.status, '(Expected 409)');
  console.log('    Error Message:', dispatchRejectRes.body?.error?.message);

  // C. Try to create duplicate roll ID -> Expect 409
  const dupRes = await makeReq('/api/rolls', 'POST', {
    rollId: newId,
    orderNumber: 'PO-2026-0001',
    machineCode: 'LM-01',
    quantityMetres: 100
  });
  console.log('6C. Duplicate custom roll ID -> Status:', dupRes.status, '(Expected 409)');
  console.log('    Error Message:', dupRes.body?.error?.message);

  // D. Query non-existent roll -> Expect 404
  const notFoundRes = await makeReq('/api/rolls/FR-9999-999999');
  console.log('6D. Non-existent roll query -> Status:', notFoundRes.status, '(Expected 404)');

  // E. Non-existent order reference on create -> Expect 422
  const badOrderRes = await makeReq('/api/rolls', 'POST', {
    orderNumber: 'PO-9999-9999',
    machineCode: 'LM-01',
    quantityMetres: 100
  });
  console.log('6E. Non-existent orderNumber on create -> Status:', badOrderRes.status, '(Expected 422)');
  console.log('    Error Code:', badOrderRes.body?.error?.code);

  // 7. Verify order rolls list
  const orderRollsRes = await makeReq('/api/rolls?orderNumber=PO-2026-0001');
  console.log('\n7. GET /api/rolls?orderNumber=PO-2026-0001 -> Status:', orderRollsRes.status);
  console.log('   Linked Rolls for PO-2026-0001:', orderRollsRes.body.rolls?.map(r => r.rollId).join(', '));
  console.log('\n=== E2E TEST WORKFLOW COMPLETED SUCCESSFULLY ===');
})();
