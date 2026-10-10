# LoomIQ Explainable Delay Radar — Specification & Mathematical Model

## 1. Overview
The **LoomIQ Explainable Delay Radar** is a deterministic, rule-based operations intelligence engine that evaluates active textile production orders against delivery deadlines.

> **Important Operational Principle:**
> All outputs are **rule-based mathematical estimates**, **not** machine learning predictions or AI forecasts. Every decision step and arithmetic calculation is returned transparently to operators.

---

## 2. Core Mathematical Formula

$$\text{Remaining Quantity} = \text{Required Quantity} - \text{Produced Quantity}$$

$$\text{Estimated Production Days} = \frac{\text{Remaining Quantity}}{\text{Resolved Rate}}$$

$$\text{Slack Days} = \text{Available Production Days} - \text{Estimated Production Days}$$

$$\text{Days Late} = \max(0, \text{Estimated Production Days} - \text{Available Production Days})$$

$$\text{Required Rate Per Day} = \frac{\text{Remaining Quantity}}{\text{Available Production Days}} \quad (\text{when } \text{Available} > 0)$$

---

## 3. Configuration & Conventions

### 3.1 Unit Convention
- Rate is measured as **quantity per production day** in the machine's capacity unit or order override unit (e.g. `meters/day` or `kg/day`).
- **No unit conversion** is performed silently. An order in `meters` assigned to a machine configured in `kg` triggers a `UNIT_MISMATCH` reason code.

### 3.2 Operating Timezone & Delivery Deadline Rule
- **Factory Timezone:** Configured via `FACTORY_TIMEZONE` in `radar.config.js` (Default: `Asia/Kolkata`, UTC+05:30).
- **Delivery Deadline Rule:** The order's due date expires at the exact end of that calendar day (**23:59:59.999**) in the factory's local operating timezone.
  - *Example:* A due date of `2026-10-15` in `Asia/Kolkata` (+05:30) represents the instant `2026-10-15T18:29:59.999Z` in UTC.

### 3.3 Available Production Days Calculation
- Calculated as the continuous production duration between the current instant (`now`) and the calculated `deadlineAt`.
- If `NON_WORKING_WEEKDAYS` are configured in `radar.config.js`, non-working calendar days are excluded from available production time and completion date projection.

### 3.4 Rate Resolution & Precedence
1. **Order Specific Override (`order.productionRatePerDay`):** If present on the order document, this value takes top precedence.
   - If the override value is invalid ($\le 0$, non-numeric, `NaN`), the evaluation halts immediately with status `INSUFFICIENT_DATA` (reason `INVALID_RATE`). **It will never silently fall back to machine capacity.**
2. **Assigned Machine Nominal Capacity (`machine.dailyCapacity`):** If no order override is set, the engine uses the daily capacity of the assigned `Machine`.
3. **No Machine Assigned:** If no machine is assigned and no order override exists, the status is `INSUFFICIENT_DATA` (reason `NO_MACHINE_ASSIGNED`).

---

## 4. Status Definitions & Evaluation Order

The evaluation halts at the first matching rule in the following deterministic sequence:

| Priority | Condition | Assigned Status | Description / Action |
|---|---|---|---|
| 1 | `order.status === 'completed'` | `COMPLETED` | Order finished. No production remaining. |
| 2 | Missing, non-numeric, $req \le 0$, $prod < 0$, or $prod > req$ | `INSUFFICIENT_DATA` (`INVALID_QUANTITY`) | Data entry correction required. |
| 3 | Missing or unparseable `dueDate` | `INSUFFICIENT_DATA` (`INVALID_DEADLINE`) | Target due date required. |
| 4 | $remainingQuantity == 0$ but status not completed | `ON_TRACK` (`ALL_PRODUCED`) | Ready to close with warning `ALL_PRODUCED_NOT_COMPLETED`. |
| 5 | Instant $now > deadlineAt$ | `OVERDUE` (`DEADLINE_PASSED`) | Delivery deadline has elapsed. |
| 6 | Unresolvable, non-positive, or mismatched rate | `INSUFFICIENT_DATA` (`NO_MACHINE_ASSIGNED`, `MACHINE_RATE_MISSING`, `INVALID_RATE`, `UNIT_MISMATCH`) | Configuration or assignment fix required. |
| 7 | $estimatedProductionDays > availableProductionDays + 10^{-9}$ | `AT_RISK` (`RATE_INSUFFICIENT`) | Production shortfall detected; deadline will be missed at current rate. |
| 8 | $estimatedProductionDays \le availableProductionDays + 10^{-9}$ | `ON_TRACK` (`ON_SCHEDULE`) | On schedule with buffer slack. Note: Equality counts as `ON_TRACK`. |

---

## 5. Worked Example (Standard Benchmark)

- **Order Parameters:** Required = $500\text{ m}$, Produced = $200\text{ m}$, Resolved Rate = $100\text{ m/day}$.
- **Step 1:** Remaining Quantity = $500 - 200 = 300\text{ m}$.
- **Step 2:** Estimated Production Days = $300\text{ m} \div 100\text{ m/day} = 3.0\text{ production days}$.

### Scenario Outcomes:
1. **With $2.0$ days available:**
   - Comparison: $3.0 > 2.0 \implies$ **`AT_RISK`**
   - Shortfall: $1.0\text{ day late}$, Slack: $-1.0\text{ days}$.
2. **With $3.0$ days available (Exact Equality Boundary):**
   - Comparison: $3.0 \le 3.0 + 10^{-9} \implies$ **`ON_TRACK`**
   - Shortfall: $0.0\text{ days}$, Slack: $0.0\text{ days}$.
3. **With $5.0$ days available:**
   - Comparison: $3.0 \le 5.0 \implies$ **`ON_TRACK`**
   - Slack: $+2.0\text{ days buffer}$.

---

## 6. Informational Warnings (Non-Status Modifiers)

Warnings flag operational nuances without corrupting the mathematical status formula:

- `ORDER_ON_HOLD`: Work order is paused; progress halted until release.
- `ORDER_NOT_STARTED`: Order is queued; calculation assumes immediate start.
- `MACHINE_IN_MAINTENANCE`: Assigned machine is undergoing maintenance; nominal rate assumed.
- `SHARED_MACHINE`: Machine is concurrently assigned to multiple active orders.
- `REJECTED_OR_REWORK_ROLLS`: Roll inspection defects flagged in Fabric Passport (Module 2); gross produced quantity may exceed net sellable yield.

---

## 7. Suggested Actions Generation

Action suggestions are pure deterministic recommendations based on real numbers:

- **`AT_RISK` with an available same-type machine whose combined capacity rescues the order:**
  > *"Consider running part of this order on LM-04 (available, 500 m/day). Needs about 666.7 m/day to finish on time; current rate is 400 m/day."*
- **`AT_RISK` with no rescue machine:**
  > *"Cannot meet the deadline at current capacity. Estimated completion Oct 18, 2026 (3.0 days late). Contact buyer to agree a revised date or a partial shipment of 1500 m."*
- **`OVERDUE`:**
  > *"Deadline passed 3 days ago with 1200 m remaining. Contact buyer now; projected completion Oct 13, 2026."*
- **`INSUFFICIENT_DATA`:**
  > Specific corrective instruction tailored to the reason code (`ASSIGN_MACHINE`, `SET_MACHINE_CAPACITY`, `CORRECT_RATE`, `ALIGN_UNITS`, `CORRECT_QUANTITIES`, `SET_DUE_DATE`).
- **`ON_TRACK`:**
  > *"No action needed. On schedule with 6.5 days of buffer slack."*

---

## 8. Limitations & Assumptions

1. **Nominal Constant Rate:** The estimate assumes the machine or process runs continuously at nominal daily capacity without unexpected mid-run speed fluctuations.
2. **No Dynamic Queueing / Stacking:** Active orders sharing a machine are evaluated independently with full nominal machine capacity and flagged with the `SHARED_MACHINE` warning.
3. **No Automated Downtime Simulation:** Maintenance periods apply informational warnings rather than speculative queue reordering.
4. **Deterministic Estimate, Not a Guarantee:** The Delay Radar is a transparent decision-support tool designed to provide textile floor managers with actionable visibility.
