# Permit to Work — Task Risk Assessment

A lightweight **Permit to Work (PTW)** web app with an integrated **task risk
assessment** module. It lets a team raise, assess, approve and track permits for
high‑risk work (hot work, confined space, working at height, electrical
isolation, lifting, excavation, etc.).

Zero dependencies, no build step. It's a static site (HTML + CSS + vanilla JS)
that stores data locally in the browser via `localStorage`.

## Features

- **Permit register / dashboard** — searchable, filterable table of all permits
  with live status pills, validity window and residual‑risk badge, plus summary
  stat tiles.
- **Permit editor** with four sections:
  1. **Permit details** — title, type, location, applicant/contractor, personnel,
     validity window, work description. Permit numbers are auto‑generated
     (`PTW-<year>-NNN`).
  2. **Hazard identification** — quick‑pick chips for common hazards.
  3. **Task risk assessment** — break the task into steps and score each on a
     **5×5 matrix** (Likelihood × Severity). Capture control measures, then score
     the **residual risk** after controls. Initial/residual risk auto‑calculates
     with colour‑coded bands (Low / Medium / High / Extreme), plus a per‑permit
     summary and a built‑in matrix reference.
  4. **Authorisation & status** — workflow status (Draft → Submitted → Approved →
     Active → Suspended → Closed), issuing authority, PPE, emergency
     arrangements and a sign‑off acknowledgement (required before
     Approved/Active).
- Data persisted locally; a seeded example permit appears on first run.

## Risk scoring

`Risk = Likelihood (1–5) × Severity (1–5)`

| Score  | Band     |
|--------|----------|
| 1–4    | Low      |
| 5–9    | Medium   |
| 10–14  | High     |
| 15–25  | Extreme  |

## Running it

No server or install needed — just open `index.html` in a browser.

Or serve it locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project structure

```
index.html   Markup / app shell
styles.css   Styling (dark theme, responsive)
app.js       App logic: state, storage, dashboard, editor, risk model
```

## Notes & limitations

- Data lives in the browser's `localStorage` (per device/browser); there is no
  backend or multi‑user sync. Clearing site data removes saved permits.
- Intended as a practical demo / internal tool, not a certified safety system.
