/**
 * Tier 1 Comprehensive Security & Authentication Test Suite.
 * Validates default-deny, opaque sessions, CSRF, rate-limiting, timing mitigations,
 * invitation lifecycle, privilege escalation prevention, and the complete permissions matrix.
 */
const assert = require('assert');
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/env');
const { User, Session, Invitation } = require('../src/models');
const { PERMISSIONS, ROLE_PERMISSIONS_MAP, getPermissionsForRole } = require('../src/utils/permissions');
const {
  validatePasswordPolicy,
  hashPassword,
  verifyPassword,
  generateOpaqueToken,
  hashToken,
} = require('../src/utils/security');
const { resetAllBuckets } = require('../src/middleware/rateLimiter');

let server;
let baseUrl;
let port = 5199;

const TEST_DB_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/loomiq_tier1_test';

let passed = 0;
let failed = 0;

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
};

// HTTP Request helper
const request = ({
  method = 'GET',
  path = '/',
  headers = {},
  body = null,
  cookie = null,
  token = null,
}) => {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Accept': 'application/json',
      'Origin': 'http://localhost:5173', // Valid dev origin
    };

    if (body) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    if (cookie) {
      defaultHeaders['Cookie'] = cookie;
    } else if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const finalHeaders = { ...defaultHeaders, ...headers };
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

    if (payload && !finalHeaders['Content-Length']) {
      finalHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      `${baseUrl}${path}`,
      {
        method,
        headers: finalHeaders,
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
            body: json,
            raw: rawData,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
};

const runTier1Tests = async () => {
  console.log('\n====================================================');
  console.log('🧪 RUNNING TIER 1: AUTHENTICATION, RBAC & SECURITY TESTS');
  console.log('====================================================\n');

  // 1. Setup isolated test DB
  await mongoose.connect(TEST_DB_URI);
  await mongoose.connection.dropDatabase();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // --- SECTION 1: Password & Crypto Utilities ---
    console.log('--- 1. Password Policy & Cryptography Verification ---');
    await test('Password policy accepts >= 12 chars', () => {
      const p = validatePasswordPolicy('SecureFactoryPass123', 'user@loomiq.internal');
      assert.strictEqual(p.valid, true);
    });

    await test('Password policy rejects < 12 chars', () => {
      const p = validatePasswordPolicy('short99', 'user@loomiq.internal');
      assert.strictEqual(p.valid, false);
    });

    await test('Password policy rejects password matching email', () => {
      const p = validatePasswordPolicy('user@loomiq.internal', 'user@loomiq.internal');
      assert.strictEqual(p.valid, false);
    });

    await test('Bcrypt hashing produces non-plaintext and verifies', async () => {
      const plain = 'MySecretPassword123';
      const hash = await hashPassword(plain);
      assert.notStrictEqual(hash, plain);
      assert.strictEqual(await verifyPassword(plain, hash), true);
      assert.strictEqual(await verifyPassword('WrongPassword', hash), false);
    });

    // --- SECTION 2: User Creation & Login Lifecycle ---
    console.log('\n--- 2. Authentication & Session Rotation ---');
    const ownerPass = 'FactoryOwnerKey2026!';
    const ownerHash = await hashPassword(ownerPass);
    const ownerUser = await User.create({
      name: 'Root Owner',
      email: 'owner@loomiq.internal',
      passwordHash: ownerHash,
      role: 'owner',
      isActive: true,
    });

    let ownerSessionCookie;
    let ownerToken;

    await test('Valid login sets HttpOnly cookie and returns user + permissions', async () => {
      resetAllBuckets();
      const res = await request({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'OWNER@loomiq.internal', password: ownerPass }, // Case insensitivity check
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.user.email, 'owner@loomiq.internal');
      assert.strictEqual(res.body.user.role, 'owner');
      assert.strictEqual(res.body.user.passwordHash, undefined);
      assert(Array.isArray(res.body.permissions) && res.body.permissions.includes('manage:team'));

      // Check cookie headers
      const setCookie = res.headers['set-cookie'];
      assert(setCookie && setCookie.length > 0);
      const cookieStr = setCookie[0];
      assert(cookieStr.toLowerCase().includes('httponly'));
      assert(cookieStr.toLowerCase().includes('samesite=lax'));

      ownerSessionCookie = cookieStr.split(';')[0];
      ownerToken = res.body.token;
    });

    await test('GET /api/auth/me returns profile using session cookie', async () => {
      const res = await request({
        method: 'GET',
        path: '/api/auth/me',
        cookie: ownerSessionCookie,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.user.email, 'owner@loomiq.internal');
      assert.strictEqual(res.body.user.role, 'owner');
      assert.strictEqual(res.body.user.passwordHash, undefined);
    });

    await test('Generic error response equality for unknown email vs wrong password', async () => {
      resetAllBuckets();
      const resWrongPass = await request({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'owner@loomiq.internal', password: 'WrongPassword123' },
      });

      const resUnknownUser = await request({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'nonexistent@loomiq.internal', password: 'AnyPassword1234' },
      });

      assert.strictEqual(resWrongPass.status, 401);
      assert.strictEqual(resUnknownUser.status, 401);
      assert.deepStrictEqual(resWrongPass.body, resUnknownUser.body);
      assert.strictEqual(resWrongPass.body.error.code, 'INVALID_CREDENTIALS');
    });

    await test('Inactive account returns identical generic 401 response', async () => {
      resetAllBuckets();
      const inactiveHash = await hashPassword('InactivePass123!');
      await User.create({
        name: 'Disabled User',
        email: 'disabled@loomiq.internal',
        passwordHash: inactiveHash,
        role: 'manager',
        isActive: false,
      });

      const resInactive = await request({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'disabled@loomiq.internal', password: 'InactivePass123!' },
      });

      const resUnknown = await request({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'ghost@loomiq.internal', password: 'InactivePass123!' },
      });

      assert.strictEqual(resInactive.status, 401);
      assert.deepStrictEqual(resInactive.body, resUnknown.body);
    });

    // --- SECTION 3: Rate Limiting ---
    console.log('\n--- 3. Rate Limiting Tests ---');
    await test('Triggers 429 RATE_LIMITED after 5 failed attempts with Retry-After header', async () => {
      resetAllBuckets();
      const targetEmail = 'ratelimit-test@loomiq.internal';

      for (let i = 0; i < 5; i++) {
        const r = await request({
          method: 'POST',
          path: '/api/auth/login',
          body: { email: targetEmail, password: 'BadPassword1234' },
        });
        assert.strictEqual(r.status, 401);
      }

      // 6th attempt must be 429
      const blockedRes = await request({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: targetEmail, password: 'BadPassword1234' },
      });

      assert.strictEqual(blockedRes.status, 429);
      assert.strictEqual(blockedRes.body.error.code, 'RATE_LIMITED');
      assert(blockedRes.headers['retry-after'] !== undefined);
      resetAllBuckets();
    });

    // --- SECTION 4: CSRF Protection ---
    console.log('\n--- 4. CSRF Defense Tests ---');
    await test('POST request with disallowed foreign Origin returns 403 CSRF_BLOCKED', async () => {
      const res = await request({
        method: 'POST',
        path: '/api/auth/login',
        headers: {
          'Origin': 'https://malicious-attacker.com',
          'Referer': 'https://malicious-attacker.com/evil',
        },
        body: { email: 'owner@loomiq.internal', password: ownerPass },
      });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error.code, 'CSRF_BLOCKED');
    });

    await test('POST request with non-JSON Content-Type returns 403 CSRF_BLOCKED', async () => {
      const res = await request({
        method: 'POST',
        path: '/api/auth/login',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'email=owner@loomiq.internal',
      });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error.code, 'CSRF_BLOCKED');
    });

    // --- SECTION 5: Manager Invitation Flow ---
    console.log('\n--- 5. Invitation Lifecycle & Privilege Integrity ---');
    let inviteToken;
    let inviteId;

    await test('Owner creates manager invitation -> returns single-use link once', async () => {
      const res = await request({
        method: 'POST',
        path: '/api/invitations',
        cookie: ownerSessionCookie,
        body: { email: 'manager1@loomiq.internal' },
      });

      assert.strictEqual(res.status, 201);
      assert(res.body.inviteLink.startsWith('/accept-invite/'));
      assert.strictEqual(res.body.invitation.email, 'manager1@loomiq.internal');
      assert.strictEqual(res.body.invitation.role, 'manager');
      assert.strictEqual(res.body.invitation.tokenHash, undefined);

      inviteToken = res.body.inviteLink.replace('/accept-invite/', '');
      inviteId = res.body.invitation.id;
    });

    await test('Public endpoint GET /api/auth/invitations/:token returns validity and email', async () => {
      const res = await request({
        method: 'GET',
        path: `/api/auth/invitations/${inviteToken}`,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.invitation.email, 'manager1@loomiq.internal');
      assert.strictEqual(res.body.invitation.role, 'manager');
      assert.strictEqual(res.body.invitation.tokenHash, undefined);
    });

    let managerCookie;
    await test('Accept invitation sets name & password, signs in as manager, and marks token used', async () => {
      const res = await request({
        method: 'POST',
        path: '/api/auth/accept-invite',
        body: {
          token: inviteToken,
          name: 'Manager Bob',
          password: 'ManagerPassword2026!',
          role: 'owner', // Malicious attempt to escalate role
        },
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.user.role, 'manager'); // Role MUST be manager, ignoring payload
      assert.strictEqual(res.body.user.name, 'Manager Bob');
      assert(res.body.permissions.includes('read:orders'));
      assert(!res.body.permissions.includes('manage:team'));

      managerCookie = res.headers['set-cookie'][0].split(';')[0];
    });

    await test('Atomic single-use: Accepting already-used token is rejected', async () => {
      const res = await request({
        method: 'POST',
        path: '/api/auth/accept-invite',
        body: {
          token: inviteToken,
          name: 'Imposter',
          password: 'AnotherPassword123!',
        },
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'INVALID_INVITATION');
    });

    await test('Manager calling owner-restricted endpoint GET /api/users gets 403 FORBIDDEN', async () => {
      const res = await request({
        method: 'GET',
        path: '/api/users',
        cookie: managerCookie,
      });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });

    await test('Manager calling owner-restricted POST /api/invitations gets 403 FORBIDDEN', async () => {
      const res = await request({
        method: 'POST',
        path: '/api/invitations',
        cookie: managerCookie,
        body: { email: 'another@loomiq.internal' },
      });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });

    // --- SECTION 6: Privilege Escalation & Team Safety ---
    console.log('\n--- 6. Privilege Escalation & Admin Safety Rules ---');
    await test('Owner cannot deactivate their own account', async () => {
      const res = await request({
        method: 'PATCH',
        path: `/api/users/${ownerUser._id}`,
        cookie: ownerSessionCookie,
        body: { isActive: false },
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'CANNOT_DEACTIVATE_SELF');
    });

    await test('PATCH /api/users/:id with disallowed field role returns 422', async () => {
      const managerUser = await User.findOne({ email: 'manager1@loomiq.internal' });
      const res = await request({
        method: 'PATCH',
        path: `/api/users/${managerUser._id}`,
        cookie: ownerSessionCookie,
        body: { isActive: true, role: 'owner' },
      });

      assert.strictEqual(res.status, 422);
      assert.strictEqual(res.body.error.code, 'UNEXPECTED_FIELD');
    });

    await test('Deactivating manager immediately terminates their session', async () => {
      const managerUser = await User.findOne({ email: 'manager1@loomiq.internal' });
      const deactRes = await request({
        method: 'PATCH',
        path: `/api/users/${managerUser._id}`,
        cookie: ownerSessionCookie,
        body: { isActive: false },
      });
      assert.strictEqual(deactRes.status, 200);

      // Manager's next request with their cookie must be 401
      const checkRes = await request({
        method: 'GET',
        path: '/api/auth/me',
        cookie: managerCookie,
      });

      assert.strictEqual(checkRes.status, 401);
      assert.strictEqual(checkRes.body.error.code, 'UNAUTHENTICATED');
    });

    // --- SECTION 7: Programmatic Route Inventory Test ---
    console.log('\n--- 7. Default-Deny Route Inventory Audit ---');
    await test('Programmatic route inventory: Every route is on allowlist or returns 401 without auth', async () => {
      const publicAllowlist = new Set([
        'GET /api/health',
        'POST /api/auth/login',
        'GET /api/auth/invitations/:token',
        'POST /api/auth/accept-invite',
      ]);

      const discoveredRoutes = [];

      const extractRoutesFromRouter = (router, basePath = '') => {
        if (!router || !router.stack) return;
        router.stack.forEach((layer) => {
          if (layer.route) {
            const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
            methods.forEach((m) => {
              const fullRoutePath = `${basePath}/${layer.route.path}`.replace(/\/+/g, '/');
              discoveredRoutes.push({ method: m, path: fullRoutePath });
            });
          } else if (layer.name === 'router' && layer.handle) {
            let prefix = '';
            if (layer.regexp) {
              const str = layer.regexp.source || '';
              const match = str.match(/\^?\\\/([a-zA-Z0-9_\-\\\/]+)/);
              if (match) {
                prefix = '/' + match[1].replace(/\\\//g, '/').replace(/\\\-/g, '-').replace(/\/\?$/, '');
              }
            }
            extractRoutesFromRouter(layer.handle, `${basePath}/${prefix}`.replace(/\/+/g, '/'));
          }
        });
      };

      extractRoutesFromRouter(app._router, '');

      assert(discoveredRoutes.length > 10, `Discovered ${discoveredRoutes.length} registered Express endpoints`);

      for (const r of discoveredRoutes) {
        // Normalize path
        const normalizedPath = ('/' + r.path).replace(/\/+/g, '/').replace(/\/\?\(?=\\\/\|\$\)\/i?/, '');
        const cleanPath = (normalizedPath.length > 1 ? normalizedPath.replace(/\/+$/, '') : normalizedPath);
        const routeKey = `${r.method} ${cleanPath}`;

        if (publicAllowlist.has(routeKey)) {
          continue;
        }

        // Test calling without authentication (sample dummy IDs for params)
        const sampleUrl = cleanPath
          .replace(':token', 'sample-token')
          .replace(':id', new mongoose.Types.ObjectId().toString())
          .replace(':orderNumber', 'PO-2026-0001')
          .replace(':rollId', 'FR-2026-000001')
          .replace(':actionNumber', 'CA-2026-0001')
          .replace(':code', 'LM-01');

        const testRes = await request({
          method: r.method,
          path: sampleUrl,
        });

        assert.strictEqual(
          testRes.status,
          401,
          `Route ${routeKey} (tested at ${sampleUrl}) MUST return 401 without auth, but returned ${testRes.status}`
        );
      }
    });

    // --- SECTION 7B: Table-Driven Permission Matrix Conformance ---
    console.log('\n--- 7B. Permission Matrix Table-Driven Conformance ---');
    // Matrix test cases: endpoint, method, expected anonymous (always 401), expected manager, expected owner
    const matrixRows = [
      { path: '/api/dashboard/summary', method: 'GET', manager: 200, owner: 200 },
      { path: '/api/orders', method: 'GET', manager: 200, owner: 200 },
      { path: '/api/machines', method: 'GET', manager: 200, owner: 200 },
      { path: '/api/rolls', method: 'GET', manager: 200, owner: 200 },
      { path: '/api/delay-radar', method: 'GET', manager: 200, owner: 200 },
      { path: '/api/stock', method: 'GET', manager: 200, owner: 200 },
      { path: '/api/quality/summary', method: 'GET', manager: 200, owner: 200 },
      { path: '/api/users', method: 'GET', manager: 403, owner: 200 },
      { path: '/api/invitations', method: 'GET', manager: 403, owner: 200 },
    ];

    // Re-activate or create manager for matrix tests
    const testManagerHash = await hashPassword('MatrixManagerPass123!');
    const matrixManager = await User.create({
      name: 'Matrix Manager',
      email: 'matrix-mgr@loomiq.internal',
      passwordHash: testManagerHash,
      role: 'manager',
      isActive: true,
    });

    resetAllBuckets();
    const mgrLoginRes = await request({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'matrix-mgr@loomiq.internal', password: 'MatrixManagerPass123!' },
    });
    const matrixMgrCookie = mgrLoginRes.headers['set-cookie'][0].split(';')[0];

    for (const row of matrixRows) {
      await test(`Matrix Conformance: ${row.method} ${row.path} -> Anon: 401, Mgr: ${row.manager}, Owner: ${row.owner}`, async () => {
        // 1. Anonymous -> 401
        const anonRes = await request({ method: row.method, path: row.path });
        assert.strictEqual(anonRes.status, 401, 'Anonymous request must return 401');

        // 2. Manager -> Expected status
        const mgrRes = await request({ method: row.method, path: row.path, cookie: matrixMgrCookie });
        assert.strictEqual(mgrRes.status, row.manager, `Manager request must return ${row.manager}`);

        // 3. Owner -> Expected status
        const ownerRes = await request({ method: row.method, path: row.path, cookie: ownerSessionCookie });
        assert.strictEqual(ownerRes.status, row.owner, `Owner request must return ${row.owner}`);
      });
    }

    // --- SECTION 8: Open Redirect Sanitization Unit Tests ---
    console.log('\n--- 8. Open Redirect Sanitization Tests ---');
    const { sanitizeRedirectPath } = require('../../frontend/src/utils/redirectSanitizer');

    await test('sanitizeRedirectPath accepts safe internal paths', () => {
      assert.strictEqual(sanitizeRedirectPath('/rolls/FR-2026-000001'), '/rolls/FR-2026-000001');
      assert.strictEqual(sanitizeRedirectPath('/stock?level=low'), '/stock?level=low');
      assert.strictEqual(sanitizeRedirectPath('/delay-radar'), '/delay-radar');
    });

    await test('sanitizeRedirectPath rejects open redirect attack vectors', () => {
      assert.strictEqual(sanitizeRedirectPath('//evil.com'), '/');
      assert.strictEqual(sanitizeRedirectPath('https://evil.com'), '/');
      assert.strictEqual(sanitizeRedirectPath('/\\evil.com'), '/');
      assert.strictEqual(sanitizeRedirectPath('javascript:alert(1)'), '/');
      assert.strictEqual(sanitizeRedirectPath(''), '/');
      assert.strictEqual(sanitizeRedirectPath(null), '/');
    });

  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  console.log(`TIER 1 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runTier1Tests();
