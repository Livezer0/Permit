# PTW / TRA Backend — REST API

Express REST API for the Permit to Work & Task Risk Assessment app, backed by
SQLite via Node's built‑in `node:sqlite` module (no native build step).

## Run

```bash
npm install
npm start          # http://localhost:4000
npm run dev        # auto-restart on changes
```

Configuration via environment variables (see `.env.example`):

| Variable       | Default         | Purpose                                   |
|----------------|-----------------|-------------------------------------------|
| `PORT`         | `4000`          | Port the API listens on                   |
| `CORS_ORIGIN`  | `*`             | Allowed CORS origin (set to frontend URL) |
| `PTW_DATA_DIR` | `./data`        | Directory for the SQLite file             |
| `PTW_DB`       | `<data>/ptw.db` | Full path to the SQLite database          |

Requires Node.js **>= 22.5** (for `node:sqlite`).

## Data model

`backend/src/db.js` defines three tables:

**tras** — `id` (PK), `tra_ref` (unique, immutable), `work_description`,
`wo_swms_no`, `equipment`, `location`, `date_prepared`, `contractor`,
`work_sponsor`, `dept_in_charge`, `parties` (JSON), `approver` (JSON), timestamps.

**tra_steps** (one‑to‑many → tras, `ON DELETE CASCADE`) — `work_step`, `hazards`,
`inherent_s`, `inherent_p`, `control_measures`, `control_type`, `residual_s`,
`residual_p`, `remarks`, `sort_order`. Vulnerability (`s × p`) and the **HRV**
are computed in the API, not stored.

**permits** — promoted/queryable columns (`id`, `ptw_no` unique+immutable,
`work_order_no`, `tra_no`, `permit_class`, `work_description`, `area_location`,
`permit_receiver`, `date_of_application`, `date_of_expiry`, `status`) plus a
`data` JSON column holding the full payload for form Sections 1–10.

TRA create/update wrap the parent row and its step rows in a transaction. Scores
are clamped to 1–5; empty step rows are discarded.

## Domain model (`/api/meta`)

- **Risk levels** (V = S × P): Low 1–4, Moderate 5–9, High 10–14, Critical 15–25,
  each mapped to an approval authority.
- **Control types**: Elimination, Substitution, Engineering, Administrative, PPE.
- **Clearances**: LOTO, Working at Heights, Lifting, Excavation, Fire/Gas
  Detection, Fire Suppression, Hot Works, Confined Space, Work Over/Under Water,
  Others.
- **Permit classes**: Scheduled, Emergency, Outage.
- **Permit statuses**: Draft, Submitted, Approved, Active, Suspended, Cancelled,
  Closed.

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | — |
| GET | `/api/meta` | Domain metadata for the frontend |
| GET | `/api/tras` · `/api/tras/:id` | List / read |
| POST | `/api/tras` | Create (assigns `tra_ref`) |
| PUT | `/api/tras/:id` | Update |
| DELETE | `/api/tras/:id` | Delete |
| GET | `/api/permits` · `/api/permits/:id` | List / read |
| POST | `/api/permits` | Create (assigns `ptw_no`) |
| PUT | `/api/permits/:id` | Update |
| DELETE | `/api/permits/:id` | Delete |

### Validation (`400`)

- **TRA**: `workDescription` required; `steps` must be an array.
- **PTW**: `workDescription` and `permitReceiver` required; `permitClass` and
  `status` must be valid; moving to **Approved/Active** requires a `traNo` that
  references an existing TRA.

Errors return `{ "error": "...", "details": ["..."] }`.
