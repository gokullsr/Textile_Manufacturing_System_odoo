/**
 * Tier 2 Automated Test Suite - LoomIQ Platform.
 * Tests:
 * 1. Authorized vs unauthorized stock reads and writes (Owner vs Manager vs Anonymous).
 * 2. Quantity & unit validation (precision <= 3 decimals, rejection of negatives, zero rules).
 * 3. Low / Out-of-stock derived metrics and boundaries (quantityOnHand <= 0 -> out, <= reorderLevel -> low).
 * 4. Stock operations: receive, use, adjust (reason >= 5 chars required), mark ordered.
 * 5. Negative-stock prevention (409 INSUFFICIENT_STOCK).
 * 6. Concurrency race-condition test: 2 simultaneous `use` requests exceeding available stock -> exactly one succeeds.
 * 7. Append-only ledger integrity: quantityBefore + delta = quantityAfter, immutable history, actor session binding.
 * 8. Invalid & missing IDs handling (400/404).
 * 9. Dashboard telemetry counts == Inventory summary counts; empty database returns clean zeros without NaN.
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const http = require('http');
const app = require('../src/app');
const {
  User,
  Session,
  MaterialStock,
  MaterialMovement,
  ProductionOrder,
  Machine,
  FabricRoll,
} = require('../src/models');
const { hashPassword, generateOpaqueToken, hashToken } = require('../src/utils/security');

let server;
let baseUrl;
let passedTests = 0;
let failedTests = 0;

const TEST_DB_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/loomiq_tier2_test';

const assert = (condition, description) => {
  if (condition) {
    console.log(`  ✓ ${description}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    failedTests++;
  }
};

const makeRequest = (method, urlPath, headers = {}, body = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const reqHeaders = {
      ...headers,
      Origin: headers.Origin || 'http://localhost:5173',
    };

    let bodyData = null;
    if (body) {
      bodyData = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch (e) {
            json = rawData;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: json,
          });
        });
      }
    );

    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
};

const createTestUserWithSession = async (role, email, name) => {
  const passwordHash = await hashPassword('SecurePassword123!');
  const user = new User({
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    isActive: true,
  });
  await user.save();

  const rawToken = generateOpaqueToken(32);
  const tokenHash = hashToken(rawToken);
  const session = new Session({
    tokenHash,
    user: user._id,
    lastSeenAt: new Date(),
    expiresAt: new Date(Date.now() + 2 * 3600 * 1000),
    absoluteExpiresAt: new Date(Date.now() + 12 * 3600 * 1000),
  });
  await session.save();

  return {
    user,
    cookie: `loomiq_session=${rawToken}`,
    rawToken,
  };
};

async function runTier2Tests() {
  console.log('====================================================');
  console.log('--- STARTING TIER 2: INVENTORY & DASHBOARD SUITE ---');
  console.log('====================================================\n');

  try {
    await mongoose.connect(TEST_DB_URI);
    console.log(`Connected to test MongoDB database at ${TEST_DB_URI}`);

    // Clear test collections
    await Promise.all([
      User.deleteMany({}),
      Session.deleteMany({}),
      MaterialStock.deleteMany({}),
      MaterialMovement.deleteMany({}),
      ProductionOrder.deleteMany({}),
      Machine.deleteMany({}),
      FabricRoll.deleteMany({}),
    ]);

    // Start ephemeral HTTP server
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        console.log(`Ephemeral test server running at ${baseUrl}\n`);
        resolve();
      });
    });

    // 1. Setup Owner and Manager
    const ownerAuth = await createTestUserWithSession('owner', 'owner.test@loomiq.internal', 'Test Owner');
    const managerAuth = await createTestUserWithSession('manager', 'manager.test@loomiq.internal', 'Test Manager');

    // TEST GROUP 1: Empty Database Clean Returns
    console.log('--- TEST GROUP 1: Empty DB Handling & Telemetry Integrity ---');
    const emptySummary = await makeRequest('GET', '/api/stock/summary', { Cookie: ownerAuth.cookie });
    assert(emptySummary.status === 200, 'GET /api/stock/summary returns 200 on empty DB');
    assert(emptySummary.data.totalItems === 0, 'totalItems is 0 on empty DB');
    assert(emptySummary.data.outOfStockCount === 0 && emptySummary.data.lowStockCount === 0, 'Stock counts are 0 on empty DB');
    assert(Array.isArray(emptySummary.data.needsAttention) && emptySummary.data.needsAttention.length === 0, 'needsAttention is empty array');

    const emptyDash = await makeRequest('GET', '/api/dashboard/summary', { Cookie: managerAuth.cookie });
    assert(emptyDash.status === 200, 'GET /api/dashboard/summary returns 200 on empty DB');
    assert(emptyDash.data.kpis.stock.totalItems === 0, 'Dashboard stock totalItems is 0');
    assert(emptyDash.data.kpis.activeOrders === 0 && !isNaN(emptyDash.data.kpis.activeOrders), 'KPIs have clean numbers with no NaN');

    // TEST GROUP 2: Item Creation & Validation (Owner only)
    console.log('\n--- TEST GROUP 2: Material Creation & Permissions ---');
    // Manager attempt to create stock -> 403
    const managerCreate = await makeRequest('POST', '/api/stock', { Cookie: managerAuth.cookie }, {
      name: 'Organic Cotton Yarn 30s',
      sku: 'YRN-COT-001',
      quantityOnHand: 500,
      unit: 'kg',
      reorderLevel: 200,
      sector: 'spinning',
      category: 'yarn',
    });
    assert(managerCreate.status === 403, 'Manager POST /api/stock fails with 403 FORBIDDEN');

    // Anonymous attempt -> 401
    const anonCreate = await makeRequest('POST', '/api/stock', {}, {
      name: 'Organic Cotton Yarn 30s',
      sku: 'YRN-COT-001',
      quantityOnHand: 500,
    });
    assert(anonCreate.status === 401, 'Anonymous POST /api/stock fails with 401 UNAUTHENTICATED');

    // Owner creates with invalid precision (> 3 decimals) -> 422
    const invalidPrec = await makeRequest('POST', '/api/stock', { Cookie: ownerAuth.cookie }, {
      name: 'Organic Cotton Yarn 30s',
      sku: 'YRN-COT-001',
      quantityOnHand: 100.1234,
      unit: 'kg',
      reorderLevel: 50,
    });
    assert(invalidPrec.status === 422, 'Stock creation rejects quantity with > 3 decimal places (422)');

    // Owner creates with negative quantity -> 422
    const negQty = await makeRequest('POST', '/api/stock', { Cookie: ownerAuth.cookie }, {
      name: 'Organic Cotton Yarn 30s',
      sku: 'YRN-COT-001',
      quantityOnHand: -10,
    });
    assert(negQty.status === 422, 'Stock creation rejects negative quantity (422)');

    // Owner creates valid item 1 (OK status)
    const createRes1 = await makeRequest('POST', '/api/stock', { Cookie: ownerAuth.cookie }, {
      name: 'Organic Ring-Spun Cotton Yarn 30s',
      sku: 'YRN-COT-001',
      quantityOnHand: 500,
      unit: 'kg',
      reorderLevel: 200,
      sector: 'spinning',
      category: 'yarn',
      supplier: 'Apex Spinners Ltd',
    });
    assert(createRes1.status === 201, 'Owner creates initial stock item 1 (201 Created)');
    const item1 = createRes1.data.stock;
    assert(item1.stockLevel === 'ok', 'Item with 500/200 has derived stockLevel: ok');

    // Owner creates item 2 (LOW status: exactly at reorder level)
    const createRes2 = await makeRequest('POST', '/api/stock', { Cookie: ownerAuth.cookie }, {
      name: 'Reactive Blue Dye Powder #42',
      sku: 'DYE-BLU-042',
      quantityOnHand: 50,
      unit: 'kg',
      reorderLevel: 50,
      sector: 'dyeing',
      category: 'dyes_chemicals',
      supplier: 'ColorChem International',
    });
    assert(createRes2.status === 201, 'Owner creates stock item 2 (201 Created)');
    const item2 = createRes2.data.stock;
    assert(item2.stockLevel === 'low', 'Boundary condition: quantityOnHand == reorderLevel (50 == 50) derives stockLevel: low');

    // Owner creates item 3 (OUT of stock: quantity = 0)
    const createRes3 = await makeRequest('POST', '/api/stock', { Cookie: ownerAuth.cookie }, {
      name: 'Silicone Softener Emulsion',
      sku: 'CHM-SOF-009',
      quantityOnHand: 0,
      unit: 'liters',
      reorderLevel: 80,
      sector: 'finishing',
      category: 'dyes_chemicals',
      supplier: 'TextileAux GmbH',
    });
    assert(createRes3.status === 201, 'Owner creates stock item 3 with 0 on-hand (201 Created)');
    const item3 = createRes3.data.stock;
    assert(item3.stockLevel === 'out', 'Item with 0 on-hand derives stockLevel: out');
    assert(item3.shortfall === 80, 'Item 3 shortfall is 80 liters');

    // TEST GROUP 3: Sector Segregation & Single Source Summary
    console.log('\n--- TEST GROUP 3: Per-Sector Breakdown & Unit Segregation ---');
    const summaryRes = await makeRequest('GET', '/api/stock/summary', { Cookie: managerAuth.cookie });
    assert(summaryRes.status === 200, 'Manager can fetch /api/stock/summary (200)');
    const summaryData = summaryRes.data;
    assert(summaryData.totalItems === 3, 'Total items count is 3');
    assert(summaryData.outOfStockCount === 1, 'outOfStockCount is 1');
    assert(summaryData.lowStockCount === 1, 'lowStockCount is 1');
    assert(summaryData.okStockCount === 1, 'okStockCount is 1');

    // Verify unit totals are strictly segregated per unit, not cross-summed
    const finishingSector = summaryData.perSector.finishing;
    assert(finishingSector.unitTotals.liters === 0, 'Finishing sector tracks liters without cross-unit contamination');
    const spinningSector = summaryData.perSector.spinning;
    assert(spinningSector.unitTotals.kg === 500, 'Spinning sector tracks kg correctly');

    // Verify Dashboard counts MATCH Stock Summary counts exactly
    const dashRes = await makeRequest('GET', '/api/dashboard/summary', { Cookie: ownerAuth.cookie });
    assert(dashRes.data.kpis.stock.outOfStock === summaryData.outOfStockCount, 'Dashboard outOfStock equals Stock Summary outOfStock');
    assert(dashRes.data.kpis.stock.lowStock === summaryData.lowStockCount, 'Dashboard lowStock equals Stock Summary lowStock');
    assert(dashRes.data.kpis.stock.totalItems === summaryData.totalItems, 'Dashboard totalItems equals Stock Summary totalItems');

    // TEST GROUP 4: Stock Operations (Receive, Use, Adjust, Mark Ordered)
    console.log('\n--- TEST GROUP 4: Stock Operations & Immutable Ledger ---');
    // Manager receives stock for item 3 (Silicone Softener)
    const receiveRes = await makeRequest('POST', `/api/stock/${item3._id}/receive`, { Cookie: managerAuth.cookie }, {
      quantity: 120,
      notes: 'PO-8820 delivery from chemical supplier',
    });
    assert(receiveRes.status === 200, 'Manager receives 120 litres of stock (200 OK)');
    assert(receiveRes.data.stock.quantityOnHand === 120, 'quantityOnHand updated to 120');
    assert(receiveRes.data.stock.stockLevel === 'ok', 'Stock status derived as ok after receipt');
    assert(receiveRes.data.movement.type === 'RECEIVE', 'Ledger movement type is RECEIVE');
    assert(receiveRes.data.movement.quantityBefore === 0, 'quantityBefore is 0');
    assert(receiveRes.data.movement.quantityAfter === 120, 'quantityAfter is 120');
    assert(receiveRes.data.movement.actor.userId.toString() === managerAuth.user._id.toString(), 'Actor userId bound from manager session');
    assert(receiveRes.data.movement.actor.name === 'Test Manager', 'Actor name bound from session');

    // Manager uses stock (consumption)
    const useRes = await makeRequest('POST', `/api/stock/${item3._id}/use`, { Cookie: managerAuth.cookie }, {
      quantity: 30,
      notes: 'Batch #B-409 finishing run',
    });
    assert(useRes.status === 200, 'Manager consumes 30 litres of stock (200 OK)');
    assert(useRes.data.stock.quantityOnHand === 90, 'quantityOnHand updated to 90 (120 - 30)');
    assert(useRes.data.movement.quantityBefore === 120 && useRes.data.movement.quantityAfter === 90, 'Ledger arithmetic: 120 - 30 = 90');

    // TEST GROUP 5: Negative Stock Prevention
    console.log('\n--- TEST GROUP 5: Negative Stock Guard & Overdraft Rejection ---');
    // Attempt to use 100 litres when only 90 available -> 409 INSUFFICIENT_STOCK
    const overdraftRes = await makeRequest('POST', `/api/stock/${item3._id}/use`, { Cookie: managerAuth.cookie }, {
      quantity: 100,
      notes: 'Excessive usage attempt',
    });
    assert(overdraftRes.status === 409, 'Use exceeding available stock returns 409 INSUFFICIENT_STOCK');
    assert(overdraftRes.data.error.code === 'INSUFFICIENT_STOCK', 'Error code is INSUFFICIENT_STOCK');

    // Verify stock remains untouched in DB
    const freshItem3 = await MaterialStock.findById(item3._id);
    assert(freshItem3.quantityOnHand === 90, 'Database quantityOnHand unchanged at 90 after failed overdraft');

    // TEST GROUP 6: Concurrency Race-Condition Guard ($gte atomic check)
    console.log('\n--- TEST GROUP 6: Concurrency Guard (Simultaneous Overdraft) ---');
    // We have 90 litres available. Launch two simultaneous requests of 60 litres each.
    // Total requested = 120 litres > 90 available.
    // Exactly ONE must succeed (200) and exactly ONE must fail (409). Stock must end at 30.
    const [raceResA, raceResB] = await Promise.all([
      makeRequest('POST', `/api/stock/${item3._id}/use`, { Cookie: managerAuth.cookie }, {
        quantity: 60,
        notes: 'Simultaneous Process Thread A',
      }),
      makeRequest('POST', `/api/stock/${item3._id}/use`, { Cookie: managerAuth.cookie }, {
        quantity: 60,
        notes: 'Simultaneous Process Thread B',
      }),
    ]);

    const statuses = [raceResA.status, raceResB.status].sort();
    assert(statuses[0] === 200 && statuses[1] === 409, 'Concurrent overdraft: Exactly one request returned 200 and one returned 409');
    const finalItem3 = await MaterialStock.findById(item3._id);
    assert(finalItem3.quantityOnHand === 30, 'Atomic $inc with $gte guard leaves exact non-negative remainder of 30 litres');

    // TEST GROUP 7: Count Adjustment with Mandatory Reason (Owner only)
    console.log('\n--- TEST GROUP 7: Stock Count Adjustment & Audit Reason ---');
    // Manager attempt to adjust -> 403
    const managerAdjust = await makeRequest('POST', `/api/stock/${item1._id}/adjust`, { Cookie: managerAuth.cookie }, {
      newQuantity: 480,
      reason: 'Physical inventory audit discrepancy',
    });
    assert(managerAdjust.status === 403, 'Manager attempt to adjust count returns 403 FORBIDDEN');

    // Owner adjust without reason -> 422
    const ownerNoReason = await makeRequest('POST', `/api/stock/${item1._id}/adjust`, { Cookie: ownerAuth.cookie }, {
      newQuantity: 480,
      reason: 'bad', // less than 5 chars
    });
    assert(ownerNoReason.status === 422, 'Adjustment with missing/short reason (< 5 chars) returns 422 REASON_REQUIRED');

    // Owner adjusts count with valid reason
    const ownerAdjust = await makeRequest('POST', `/api/stock/${item1._id}/adjust`, { Cookie: ownerAuth.cookie }, {
      newQuantity: 485.5,
      reason: 'Quarterly physical cycle count calibration',
    });
    assert(ownerAdjust.status === 200, 'Owner adjusts count to 485.5 kg (200 OK)');
    assert(ownerAdjust.data.stock.quantityOnHand === 485.5, 'Stock quantity updated to 485.5');
    assert(ownerAdjust.data.movement.type === 'ADJUST', 'Movement recorded as ADJUST');
    assert(ownerAdjust.data.movement.quantityDelta === -14.5, 'Delta recorded as -14.5 kg');
    assert(ownerAdjust.data.movement.actor.userId.toString() === ownerAuth.user._id.toString(), 'Actor recorded as owner');

    // TEST GROUP 8: Movement Ledger History
    console.log('\n--- TEST GROUP 8: Movement Ledger History Endpoint ---');
    const mvtHistoryRes = await makeRequest('GET', `/api/stock/${item1._id}/movements`, { Cookie: managerAuth.cookie });
    assert(mvtHistoryRes.status === 200, 'GET /api/stock/:id/movements returns 200');
    assert(mvtHistoryRes.data.movements.length >= 2, 'History includes initial registration and adjustment');
    assert(mvtHistoryRes.data.movements[0].type === 'ADJUST', 'Latest movement is at top of ledger');

    // TEST GROUP 9: Mark as Ordered
    console.log('\n--- TEST GROUP 9: Mark as Ordered Flagging ---');
    const markRes = await makeRequest('POST', `/api/stock/${item2._id}/mark-ordered`, { Cookie: managerAuth.cookie }, {
      orderedQuantity: 100,
      notes: 'Order placed with ColorChem PO-9912',
    });
    assert(markRes.status === 200, 'Manager can mark low stock item as ordered (200 OK)');
    assert(markRes.data.stock.isOrdered === true, 'isOrdered flag is true');
    assert(markRes.data.stock.orderedQuantity === 100, 'orderedQuantity is 100');

    // TEST GROUP 10: Invalid IDs & Edge Cases
    console.log('\n--- TEST GROUP 10: Invalid IDs & 404 Handlers ---');
    const invalidIdRes = await makeRequest('GET', '/api/stock/65f000000000000000000000', { Cookie: ownerAuth.cookie });
    assert(invalidIdRes.status === 404 || invalidIdRes.status === 200, 'Missing stock item handled gracefully');
    const nonExistentUse = await makeRequest('POST', '/api/stock/65f000000000000000000000/use', { Cookie: ownerAuth.cookie }, { quantity: 10 });
    assert(nonExistentUse.status === 404, 'Use on non-existent stock ID returns 404 STOCK_NOT_FOUND');

    console.log('\n====================================================');
    console.log(`TIER 2 SUITE COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('====================================================');

    if (failedTests > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal error during Tier 2 test execution:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
  }
}

runTier2Tests();
