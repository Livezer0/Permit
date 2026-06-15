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
Permit class (Scheduled / Emergency / Outage), PTW no. (auto `PTW-<year>-NNN`)
and Work Order no., followed by Section 1 (Application).

After the application details, an **"Applicable Permits & Documents"** picker
lets you tick which supporting forms the job requires — **Task Risk Assessment
(TRA)**, Gas Testing, Energy Isolation (LOTO), Hot Works, Confined Space Entry,
Working at Heights, Excavation, Lifting Operation, Fire/Gas System Impairment.
Only the ticked items expand into fillable sections, so you fill in exactly what
applies. The TRA item links an existing risk assessment (or lets you create a new
one). The core sections (Commencement, Cancellation/Suspension, Turn Over,
Review, Restoration, Closeout) are always present.

Permit status workflow: Draft → Submitted → Approved → Active →
Suspended / Cancelled → Closed.

### Layout & printing
The editors are faithful on‑screen replicas of the source forms — the **TRA in
landscape** (grid header, risk table with shaded vulnerability columns, parties
tables, the coloured 5×5 risk matrix and authority legend) and the **PTW in
portrait** (grey "Section X.0" header bars and bordered cells). Each editor has a
**Print / PDF** button that prints the sheet in the correct page orientation, so
you can export a filled‑in form that matches the original document.

## Running it

### Easiest: one command, one port

The backend also serves the frontend, so you only need to run **one** thing:

```bash
cd backend
npm install
npm start
```

Then open **http://localhost:4000/** in your browser. (The terminal will sit on
`PTW/TRA app running on http://localhost:4000` — that's expected; the page opens
in the browser, not the terminal.)

The SQLite database is created at `backend/data/ptw.db` on first run and seeded
with one example TRA and one linked permit.

### Optional: run the frontend separately

If you'd rather serve the frontend on its own (e.g. with a different dev server),
run the backend as above, then in another terminal:

```bash
cd frontend
python3 -m http.server 5173
```

…and set the API URL in `frontend/config.js`:
```js
window.PTW_API_BASE = "http://localhost:4000";
```
Leave it empty (`""`) when the backend serves the frontend (same origin).

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
