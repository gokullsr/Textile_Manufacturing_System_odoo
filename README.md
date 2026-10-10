# LoomIQ - Textile Factory Operations & Traceability Platform

> **Milestone 1 & Module 2 Architecture:**  
> Production Command Center & Digital Fabric Passport with QR Code Traceability, Quality Inspection Auditing, and Gated Dispatch Workflows.

---

## Architecture Overview

```
loomiq/
├── frontend/                     # React 19 + Vite + Tailwind CSS + QRCode.react + Recharts
│   ├── src/
│   │   ├── components/           # UI Components (Layout, StatusBadge, ProgressBar, State cards)
│   │   ├── pages/                # Dashboard, Orders, OrderDetail, Rolls, CreateRoll, Passport, Machines, Stock
│   │   ├── services/             # API Client, rollService, orderService, dashboardService, etc.
│   │   ├── utils/                # qrUtils (buildRollUrl), formatters
│   │   └── App.jsx               # React Router configuration
│   ├── vercel.json               # SPA routing rewrite configuration for direct deep linking
│   ├── .env.example              # Frontend environment template
│   └── package.json
├── backend/                      # Node.js + Express + Mongoose (MongoDB)
│   ├── src/
│   │   ├── config/               # Env validation, thresholds, MongoDB connection
│   │   ├── models/               # FabricRoll, ProductionOrder, Machine, MaterialStock, Counter
│   │   ├── routes/               # roll.routes, order.routes, dashboard.routes, machine.routes, stock.routes, health.routes
│   │   ├── controllers/          # Business logic handlers
│   │   ├── utils/                # Pure business logic (derivedMetrics, rollRules)
│   │   ├── middleware/           # Central error handler, 404 handler
│   │   ├── app.js                # Express app setup (Helmet, CORS allowlist)
│   │   └── server.js             # HTTP listener with graceful shutdown
│   ├── scripts/                  # Idempotent seed script & automated test runner
│   ├── .env.example              # Backend environment template
│   └── package.json
├── .gitignore
└── README.md
```

---

## Module 3: Explainable Delay Radar
Identifies active production orders that may miss their delivery deadline using a deterministic, rule-based mathematical estimate (zero machine learning or black-box forecasting).
- **Mathematical Specification & Formula:** [docs/DELAY_RADAR.md](file:///d:/study_files/HACKATON/Odoo-Textile%20_Manufac_Sys/docs/DELAY_RADAR.md)
- **Single Source of Truth:** Centralized in `delayRadarEngine.js` for both radar view and executive dashboard KPIs.
- **Explainable Traceability:** Provides step-by-step arithmetic (`500 - 200 = 300 m`, `300 / 100 = 3.0 days`) and deterministic suggested actions.

---

## Module 2: Fabric Passport & QR Traceability

Every manufactured fabric roll receives a **Digital Passport** carrying:
1. **QR Identity:** Encodes `<PUBLIC_APP_URL>/rolls/<rollId>` as an SVG QR with level M error correction.
2. **Manufacturing Traceability:** Live populated links to the parent **Production Order** (buyer, fabric specs) and originating **Machine** (loom/spindle station).
3. **Quality Inspection Audit Trail:** Append-only history logging inspection decisions (`PASS`, `REWORK`, `REJECT`), mandatory defect notes for rework/rejects, inspector names, and immutable server timestamps.
4. **Gated Dispatch Transitions:** Strict quality enforcement ensuring only verified `PASS` rolls can transition to `READY_FOR_DISPATCH` and `DISPATCHED` (terminal state).

---

## Quickstart & Installation

```bash
# 1. Install Backend Dependencies
cd backend
npm install

# 2. Install Frontend Dependencies
cd ../frontend
npm install
```

---

## Environment Setup

### Backend Configuration (`backend/.env`)

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/loomiq
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend Configuration (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000
VITE_PUBLIC_APP_URL=http://localhost:5173
```

---

## Testing QR Code Scanning on Mobile Phones (Local Wi-Fi)

To test scanning QR codes with a physical phone before cloud deployment:

1. **Find your computer's local Wi-Fi IP address:**
   - **Windows:** Run `ipconfig` (e.g. `192.168.1.100`)
   - **Mac/Linux:** Run `ifconfig` or `ip a`
2. **Update `backend/.env`:**
   ```env
   CORS_ORIGINS=http://localhost:5173,http://192.168.1.100:5173
   ```
3. **Update `frontend/.env`:**
   ```env
   VITE_API_URL=http://192.168.1.100:5000
   VITE_PUBLIC_APP_URL=http://192.168.1.100:5173
   ```
4. **Start Vite with the `--host` flag:**
   ```bash
   npm --prefix frontend run dev -- --host
   ```
5. Point your smartphone camera at the on-screen QR code or printed label to instantly open the live Fabric Passport.

---

## Seed & Automated Test Execution

### 1. Seed Demo Dataset (Idempotent Upsert)
```bash
cd backend
npm run seed
```

### 2. Reset Only Demo Records Cleanly
```bash
cd backend
npm run seed:reset
```

### 3. Run Automated Unit, Validation & Integration Tests
```bash
cd backend
npm test
```
*(Executes 44 automated tests verifying progress math, delay rules, roll validations, dispatch state machine, and database consistency).*

### 4. Run Live E2E Passport Workflow Test
```bash
node backend/scripts/verify-e2e-passport.js
```

---

## Running the Application (Two Terminals)

### Terminal 1: Backend API
```bash
cd backend
npm run dev
```

### Terminal 2: Frontend Client
```bash
cd frontend
npm run dev
```
*Open `http://localhost:5173` to access the LoomIQ Command Center & Fabric Passport.*
