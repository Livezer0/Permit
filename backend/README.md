# PTW Backend — REST API

Express REST API for the Permit to Work app, backed by SQLite via Node's
built‑in `node:sqlite` module (no native build step).

## Run

```bash
npm install
npm start          # http://localhost:4000
npm run dev        # same, with auto-restart on file changes
```

Configuration (all optional) via environment variables — see `.env.example`:

| Variable       | Default            | Purpose                                  |
|----------------|--------------------|------------------------------------------|
| `PORT`         | `4000`             | Port the API listens on                  |
| `CORS_ORIGIN`  | `*`                | Allowed CORS origin (set to frontend URL)|
| `PTW_DATA_DIR` | `./data`           | Directory for the SQLite file            |
| `PTW_DB`       | `<data>/ptw.db`    | Full path to the SQLite database         |

Requires Node.js **>= 22.5** (for `node:sqlite`).

## Data model

Two related tables (`backend/src/db.js`):

**permits**
`id` (PK), `permit_no` (unique, immutable), `title`, `type`, `location`,
`applicant`, `company`, `personnel`, `valid_from`, `valid_to`, `description`,
`hazards` (JSON array), `status`, `approver`, `ppe`, `emergency`, `notes`,
`ack`, `created_at`, `updated_at`.

**risks** (task risk assessment rows, one‑to‑many)
`id` (PK), `permit_id` (FK → permits, `ON DELETE CASCADE`), `sort_order`,
`hazard`, `l`, `s` (initial likelihood/severity), `controls`,
`rl`, `rs` (residual likelihood/severity).

Permit create/update are wrapped in a transaction so the permit row and its
risk rows are written atomically. Scores are clamped to 1–5; empty risk rows
are discarded.

## Endpoints

| Method | Path             | Body              | Success      |
|--------|------------------|-------------------|--------------|
| GET    | `/api/health`    | —                 | `200`        |
| GET    | `/api/permits`   | —                 | `200` array  |
| GET    | `/api/permits/:id` | —               | `200` / `404`|
| POST   | `/api/permits`   | permit (no id)    | `201` created|
| PUT    | `/api/permits/:id` | permit          | `200` / `404`|
| DELETE | `/api/permits/:id` | —               | `204` / `404`|

### Validation (`400`)

`title`, `type`, `location`, `applicant`, `validFrom`, `validTo` are required;
`validTo` must be ≥ `validFrom`; `status` must be one of the allowed values; and
`ack` must be true before a permit can be `Approved` or `Active`. Errors return
`{ "error": "...", "details": ["..."] }`.

### Example

```bash
curl -X POST http://localhost:4000/api/permits \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Weld new handrail",
    "type": "Hot Work",
    "location": "Roof, Block C",
    "applicant": "A. Smith",
    "validFrom": "2026-06-14T09:00",
    "validTo": "2026-06-14T12:00",
    "status": "Draft",
    "hazards": ["Hot work / fire"],
    "risks": [
      { "hazard": "Fire from sparks", "l": 4, "s": 4,
        "controls": "Fire watch, extinguisher, clear combustibles", "rl": 2, "rs": 4 }
    ]
  }'
```
