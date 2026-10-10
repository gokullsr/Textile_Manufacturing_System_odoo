# LoomIQ – Textile Factory Operations & Traceability Platform

**Milestone 1 & Module 2:** Production Dashboard, Digital Fabric Passport, QR Traceability, Quality Auditing, and Dispatch Control.

## 1. Project Architecture

```text
loomiq/
├── frontend/                 # React, Vite, Tailwind CSS
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Dashboard, Orders, Rolls, Passport, Machines, Stock
│   │   ├── services/         # Backend API integration
│   │   ├── utils/            # QR generation and formatters
│   │   └── App.jsx           # Routing
│   ├── .env.example
│   ├── vercel.json
│   └── package.json
│
├── backend/                  # Node.js, Express, MongoDB
│   ├── src/
│   │   ├── config/           # Environment and database setup
│   │   ├── models/           # Database schemas
│   │   ├── routes/            # API routes
│   │   ├── controllers/      # Business logic
│   │   ├── utils/            # Production and roll rules
│   │   ├── middleware/       # Error handling
│   │   ├── app.js
│   │   └── server.js
│   ├── scripts/              # Seed and test scripts
│   ├── .env.example
│   └── package.json
│
├── .gitignore
└── README.md
```

## 2. Module 3: Explainable Delay Radar

Identifies production orders that may miss their delivery deadlines using rule-based calculations.

- **Calculation:** Estimates remaining production time using pending quantity and production rate.
- **Single source of truth:** `delayRadarEngine.js` powers both the radar view and dashboard KPIs.
- **Explainable results:** Displays calculations and suggested actions.
- **Documentation:** `docs/DELAY_RADAR.md`

## 3. Module 2: Digital Fabric Passport

Each fabric roll receives a unique digital passport accessible through a QR code.

1. **QR Code:** Links to `/rolls/:rollId` and uses SVG rendering with error-correction level M.
2. **Manufacturing Details:** Displays the linked production order, buyer, fabric specifications, and originating machine.
3. **Quality Audit Trail:** Records PASS, REWORK, and REJECT decisions, inspector names, defect notes, and server timestamps.
4. **Dispatch Control:** Only quality-approved rolls can move to `READY_FOR_DISPATCH` and `DISPATCHED`.
5. **Audit Integrity:** Inspection history is append-only through normal API operations, and dispatched rolls cannot transition to another state.

## 4. Installation

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd ../frontend
npm install
```

## 5. Environment Configuration

**Backend — `backend/.env`**

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/loomiq
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

**Frontend — `frontend/.env`**

```env
VITE_API_URL=http://localhost:5000
VITE_PUBLIC_APP_URL=http://localhost:5173
```

## 6. Mobile QR Testing

To scan fabric passport QR codes using a phone on the same Wi-Fi network:

1. Find your computer's local IP address using `ipconfig` on Windows.
2. Update `CORS_ORIGINS` in the backend `.env` with your frontend URL using that IP.
3. Set `VITE_API_URL` and `VITE_PUBLIC_APP_URL` in the frontend `.env` to use your computer's IP address.
4. Start the frontend:

```bash
npm --prefix frontend run dev -- --host
```

5. Ensure the phone and computer are on the same network, then scan the QR code.

Replace the example IP address with your computer's actual local IP.

## 7. Database Seeding and Testing

**Seed demo data:**

```bash
cd backend
npm run seed
```

**Reset demo data:**

```bash
npm run seed:reset
```

**Run automated tests:**

```bash
npm test
```

The test suite is intended to verify production calculations, delay rules, roll validation, dispatch transitions, and database consistency.

**Run the end-to-end passport test** from the project root:

```bash
node backend/scripts/verify-e2e-passport.js
```

## 8. Run the Application

**Terminal 1 — Backend**

```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** to access the LoomIQ Production Command Center and Digital Fabric Passport.
