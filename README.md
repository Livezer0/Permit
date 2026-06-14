# Permit to Work & Task Risk Assessment

A web application modelled on two real safety forms:

- **Task Risk Assessment (TRA)** — break a task into steps and score each on
  Severity × Probability = **Vulnerability**, before and after controls.
- **Permit to Work (PTW)** — a 10‑section permit that references a TRA and
  governs the lifecycle of high‑risk work.

The two are linked: a permit cites a **TRA No.**, and a permit cannot be moved to
*Approved*/*Active* without a valid TRA on file.

The project is split into a separate **frontend**, **backend** and **database**:

```
Permit/
├── frontend/   Static SPA (HTML + CSS + vanilla JS) — talks to the API
└── backend/    REST API (Node + Express) + SQLite database
```

## Modules & fields

### Task Risk Assessment (TRA)
- **Task details** — work description, TRA reference (auto `TRA-<year>-NNN`),
  WO/SWMS no., equipment, location, date prepared, contractor, work sponsor,
  department in‑charge.
- **Risk assessment steps** — per step: work step, hazard(s), inherent S/P/V,
  control measures, type of control (Elimination → Substitution → Engineering →
  Administrative → PPE), residual S/P/V, remarks. Vulnerability (V = S × P) and
  its risk level are computed live.
- **Highest Residual Vulnerability (HRV)** — the maximum residual V across steps,
  mapped to a risk level and the **required approval authority**:

  | Risk level | V score | Approval authority |
  |------------|---------|--------------------|
  | Low        | 1–4     | Operations Superintendent / Supervisor |
  | Moderate   | 5–9     | Operations Head |
  | High       | 10–14   | Facility Head |
  | Critical   | 15–25   | Regional O&M Head |

- **Creation parties** — Facilitator, Contractor Lead, Area Owner, plus any
  auxiliary parties — and the **approver** sign‑off block.

### Permit to Work (PTW)
Permit class (Scheduled / Emergency / Outage), PTW no. (auto `PTW-<year>-NNN`),
Work Order no. and linked TRA no., followed by the ten form sections:

1. Application · 2. Gas Testing · 3. Clearances & Special Measures ·
4. Lock‑out / Tag‑out · 5. Commencement of Work · 6. Cancellation & Suspension ·
7. Worksite Turn Over · 8. Turnover Review · 9. Restoration to Operational
Readiness · 10. Closeout.

Permit status workflow: Draft → Submitted → Approved → Active →
Suspended / Cancelled → Closed.

## Running it

You need two processes: the API and a static server for the frontend.

**1. Backend (API + database):**
```bash
cd backend
npm install
npm start            # http://localhost:4000
```
The SQLite database is created at `backend/data/ptw.db` on first run and seeded
with one example TRA and one linked permit.

**2. Frontend:**
```bash
cd frontend
python3 -m http.server 5173
# open http://localhost:5173
```
If the API isn't on `http://localhost:4000`, edit `frontend/config.js`.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/meta` | Risk levels, control types, clearances, statuses |
| GET/POST | `/api/tras` | List / create TRAs |
| GET/PUT/DELETE | `/api/tras/:id` | Read / update / delete a TRA |
| GET/POST | `/api/permits` | List / create permits |
| GET/PUT/DELETE | `/api/permits/:id` | Read / update / delete a permit |

See [`backend/README.md`](backend/README.md) for the data model and details.

## Notes & limitations

- No authentication is implemented — add an auth/role layer before any real
  deployment (e.g. so only the named authority can approve a given risk level).
- Sign‑off fields capture typed names/signatures; this is a practical tool, not a
  certified e‑signature or safety‑management system.
