# LoomIQ Production Deployment & Security Architecture Guide

This document specifies the deployment topology, security hardening, credential management, owner provisioning, and verification workflows for the **LoomIQ** platform.

---

## 1. System Architecture & Topology

```
                      ┌────────────────────────────────────────┐
                      │              Web Browser               │
                      │  (Credentials stored in HttpOnly Ck)   │
                      └──────────────────┬─────────────────────┘
                                         │  Same-Origin Requests
                                         │  (e.g., https://loomiq.vercel.app/api/*)
                                         ▼
                      ┌────────────────────────────────────────┐
                      │         Vercel Edge Platform           │
                      │  - Static SPA Hosting                  │
                      │  - Security Headers (nosniff, frame)   │
                      │  - Reverse Proxy: /api/:path* rewrite  │
                      └──────────────────┬─────────────────────┘
                                         │  Proxied Backend Traffic
                                         ▼
                      ┌────────────────────────────────────────┐
                      │         Node.js Express Backend        │
                      │  - Default-Deny Session Auth Guard     │
                      │  - CSRF & Origin Allowlist Enforcer    │
                      │  - Multi-Dimensional Rate Limiting     │
                      │  - RBAC Permission Gate Engine         │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │            MongoDB Atlas               │
                      │  - Users, SHA-256 Sessions (TTL Index) │
                      │  - Append-Only Movement Ledgers        │
                      │  - Fabric Passport Audit Trails        │
                      └────────────────────────────────────────┘
```

---

## 2. Authentication & Security Boundaries

### 2.1 Server-Side Opaque Sessions
- **Session Tokens**: 32-byte cryptographically secure random values (`crypto.randomBytes(32)`).
- **Storage**: The backend stores **only the SHA-256 hash** of the token in MongoDB (`Session.tokenHash`). The raw token is sent to the client once in a cookie and never stored in plaintext or logged.
- **Session Lifespans**:
  - **Idle Sliding Timeout**: 2 hours (extended automatically on active requests).
  - **Absolute Timeout**: 12 hours (session terminates regardless of activity).
  - **Database Auto-Purge**: MongoDB native TTL index on `expiresAt` automatically cleans expired records.
- **Session Invalidation**:
  - `POST /api/auth/logout` deletes the current session immediately.
  - User deactivation terminates all active sessions for that user instantly.
  - Password change destroys all other active sessions for that user.

### 2.2 Cookie Policy & Same-Origin Proxy
To eliminate cross-site cookie restrictions (such as Safari ITP and third-party cookie blocking), the client communicates with the API exclusively through its **own origin**:
- In production, `frontend/vercel.json` rewrites `/api/:path*` to the deployed backend URL.
- The cookie is issued with:
  - `HttpOnly: true` (JavaScript cannot read or extract tokens).
  - `SameSite: Lax` (protects against cross-site leakage).
  - `Secure: true` in production (`NODE_ENV=production`).
  - `Path: /`

### 2.3 CSRF Protection
Every state-changing HTTP request (`POST`, `PUT`, `PATCH`, `DELETE`) is protected by dual guards:
1. **Origin Verification**: The request `Origin` (or `Referer`) header must match the backend's `CORS_ORIGINS` allowlist. Disallowed or foreign origins are blocked with `403 CSRF_BLOCKED`.
2. **Content-Type Enforcement**: Must be `application/json`.

### 2.4 Cryptographic Hashing & Timing Attack Defense
- **Password Hashing**: Bcrypt with cost factor 12 (`bcryptjs`).
- **Timing Defense**: Failed logins for non-existent emails verify credentials against a pre-computed dummy hash (`$2a$12$...`) so response times are indistinguishable from real accounts.
- **Generic Errors**: Unregistered email, incorrect password, and deactivated accounts all return identical HTTP 401 `INVALID_CREDENTIALS` payloads.

---

## 3. Environment Variables Specification

### Backend (`backend/.env`)

| Variable | Required | Secret? | Description / Example |
|---|---|---|---|
| `NODE_ENV` | Yes | No | Set to `production` in live environments. |
| `PORT` | Yes | No | Server listen port (e.g. `5000`). |
| `MONGODB_URI` | Yes | **YES** | MongoDB connection string (e.g. `mongodb+srv://user:pass@cluster.mongodb.net/loomiq`). |
| `CORS_ORIGINS` | Yes | No | Comma-separated list of trusted origins (e.g. `https://loomiq.vercel.app,http://localhost:5173`). |
| `TRUST_PROXY` | No | No | Number of upstream proxy hops (e.g. `1` or `true` for cloud hosts behind Vercel/Cloudflare). |

### Frontend (`frontend/.env`)

| Variable | Required | Secret? | Description / Example |
|---|---|---|---|
| `VITE_API_URL` | Yes | No | In production, use `/api` (relative rewrite). In dev, leave empty to use Vite dev proxy. |

> [!IMPORTANT]
> No secrets are ever packaged or shipped to the frontend client. The application requires no JWT secret or static setup key.

---

## 4. Owner Provisioning & Team Onboarding

### 4.1 First Owner Provisioning (CLI)
There is **no public signup endpoint**. The initial factory owner is provisioned via the secure interactive CLI:

```bash
# Run locally or against Atlas database from your own terminal
cd backend
npm run create-owner
```

**CLI Execution Flow:**
1. Verifies `MONGODB_URI` connectivity.
2. Checks whether an active owner already exists. If an owner is present, it **refuses execution** unless the explicit `--additional` flag is provided.
3. Prompts interactively with **hidden input** (passwords are masked in terminal and never logged).
4. Validates minimum 12-character password policy (must not equal email).
5. Hashes password using bcrypt (cost 12) and creates the owner account.

### 4.2 Manager Invitation Workflow
1. The Factory Owner logs in and navigates to **Team Management** (`/team`).
2. Owner clicks **Invite Manager** and inputs the invitee's email.
3. The server generates a single-use random token, hashes it in MongoDB (`Invitation.tokenHash`), and returns the invite link **once**.
4. The Owner copies the invite link (`https://loomiq.vercel.app/accept-invite/<TOKEN>`) and transmits it privately to the manager.
5. The invitee opens the link, sets their full name and password (>= 12 characters), and is onboarded as a **Manager**.
6. Single-use enforcement is **atomic** (`findOneAndUpdate` on `usedAt: null`), rejecting duplicate, expired (48h), or revoked tokens.

---

## 5. Deployment Procedure

### 5.1 Backend Deployment (e.g. Render / Railway / AWS ECS)
1. Configure Environment Variables in host dashboard:
   - `NODE_ENV=production`
   - `MONGODB_URI=<Atlas connection string>`
   - `CORS_ORIGINS=https://your-frontend.vercel.app`
   - `TRUST_PROXY=1`
2. Build & Start Command:
   - Start: `npm start`
3. Verify public health check: `GET https://your-backend.onrender.com/api/health` -> `{"status":"ok"}`.

### 5.2 Frontend Deployment (Vercel)
1. In `frontend/vercel.json`, verify the `/api/:path*` rewrite points to your live backend service:
   ```json
   {
     "source": "/api/:path*",
     "destination": "https://your-backend.onrender.com/api/:path*"
   }
   ```
2. In Vercel Project Settings, set:
   - `VITE_API_URL=/api`
3. Deploy frontend via Git or Vercel CLI.

---

## 6. Deployment Verification (`verify:deploy`)

To test the live deployment end-to-end without committing credentials:

```bash
# In your local shell (credentials are not stored or committed):
export DEPLOY_URL="https://your-frontend.vercel.app"
export VERIFY_EMAIL="owner@loomiq.internal"
export VERIFY_PASSWORD="YourSecurePassword123!"

npm --prefix backend run verify:deploy
```

**Verification Script Performs:**
1. Validates live database health via `GET /api/health`.
2. Proves default-deny by asserting unauthenticated `GET /api/dashboard/summary` returns HTTP 401.
3. Performs authenticated login, tests cookie reception, checks user profile & permissions, verifies telemetry & inventory reads, and confirms clean session invalidation upon logout.
