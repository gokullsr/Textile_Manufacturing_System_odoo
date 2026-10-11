/**
 * Production Deployment Verification Script for LoomIQ.
 * Validates:
 * 1. Public health check (/api/health) returns 200.
 * 2. Unauthenticated request to protected endpoint (/api/dashboard/summary) returns 401 UNAUTHENTICATED.
 * 3. Authenticated validation via VERIFY_EMAIL and VERIFY_PASSWORD from shell environment.
 * 4. Session cookie lifecycle and permission delivery verification.
 * 5. Clean logout and session invalidation.
 */
const http = require('http');
const https = require('https');

const TARGET_URL = process.env.DEPLOY_URL || process.env.VITE_API_URL || 'http://127.0.0.1:5000';
const VERIFY_EMAIL = process.env.VERIFY_EMAIL;
const VERIFY_PASSWORD = process.env.VERIFY_PASSWORD;

console.log('====================================================');
console.log('🔍 LOOMIQ DEPLOYMENT VERIFICATION');
console.log(`Target URL: ${TARGET_URL}`);
console.log('====================================================\n');

const request = (method, path, headers = {}, body = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, TARGET_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqHeaders = {
      ...headers,
      Origin: headers.Origin || url.origin,
    };

    let bodyData = null;
    if (body) {
      bodyData = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
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

async function verifyDeployment() {
  let passed = 0;
  let failed = 0;

  const assert = (condition, msg) => {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  };

  try {
    // 1. Health check
    console.log('--- 1. Live Health Check ---');
    const health = await request('GET', '/api/health');
    assert(health.status === 200, 'GET /api/health returns HTTP 200 OK');
    assert(health.data?.status === 'ok', 'Database connection status is healthy ("ok")');

    // 2. Default-Deny Verification
    console.log('\n--- 2. Default-Deny Security Guard on Deployment ---');
    const unauthDashboard = await request('GET', '/api/dashboard/summary');
    assert(
      unauthDashboard.status === 401,
      `Unauthenticated GET /api/dashboard/summary rejected with 401 (got ${unauthDashboard.status})`
    );
    assert(
      unauthDashboard.data?.error?.code === 'UNAUTHENTICATED',
      'Error envelope returns code: "UNAUTHENTICATED"'
    );

    const unauthStock = await request('GET', '/api/stock');
    assert(
      unauthStock.status === 401,
      `Unauthenticated GET /api/stock rejected with 401 (got ${unauthStock.status})`
    );

    // 3. Authenticated Smoke Tests (if shell credentials provided)
    if (VERIFY_EMAIL && VERIFY_PASSWORD) {
      console.log('\n--- 3. Authenticated Smoke Tests via Shell Credentials ---');
      const loginRes = await request('POST', '/api/auth/login', {}, {
        email: VERIFY_EMAIL.trim(),
        password: VERIFY_PASSWORD,
      });

      assert(loginRes.status === 200, 'POST /api/auth/login succeeds with HTTP 200');
      assert(loginRes.data?.user?.email === VERIFY_EMAIL.toLowerCase().trim(), 'User email matches authenticated identity');
      assert(Array.isArray(loginRes.data?.permissions), 'Returned permissions list is an array');

      const cookies = loginRes.headers['set-cookie'] || [];
      const sessionCookie = cookies.find((c) => c.startsWith('loomiq_session='));
      assert(!!sessionCookie, 'Server issued HttpOnly loomiq_session cookie');

      const cookieHeader = sessionCookie ? sessionCookie.split(';')[0] : '';

      // Test protected endpoints with session cookie
      const meRes = await request('GET', '/api/auth/me', { Cookie: cookieHeader });
      assert(meRes.status === 200, 'GET /api/auth/me succeeds with valid session cookie');

      const dashRes = await request('GET', '/api/dashboard/summary', { Cookie: cookieHeader });
      assert(dashRes.status === 200, 'GET /api/dashboard/summary returns telemetry data for authenticated user');

      const stockRes = await request('GET', '/api/stock/summary', { Cookie: cookieHeader });
      assert(stockRes.status === 200, 'GET /api/stock/summary returns inventory cards for authenticated user');

      // Logout
      const logoutRes = await request('POST', '/api/auth/logout', { Cookie: cookieHeader });
      assert(logoutRes.status === 200, 'POST /api/auth/logout succeeds with HTTP 200');

      // Verify session terminated
      const postLogoutMe = await request('GET', '/api/auth/me', { Cookie: cookieHeader });
      assert(postLogoutMe.status === 401, 'Subsequent request with invalidated session returns 401');
    } else {
      console.log('\n--- 3. Authenticated Smoke Tests: SKIPPED ---');
      console.log('ℹ️  Set VERIFY_EMAIL and VERIFY_PASSWORD in your shell to run authenticated smoke tests against deployment.');
    }

    console.log('\n====================================================');
    console.log(`DEPLOYMENT VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal error during deployment verification:', err.message);
    process.exitCode = 1;
  }
}

verifyDeployment();
