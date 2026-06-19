# PTW Mobile — React PWA

A mobile-first **Progressive Web App** (React + Vite) for the Permit to Work
system. It reads the existing backend REST API and shows the permit
**compilation grouped into Live / Suspended / Closed**, with search and a
read-only permit detail (status, linked TRA + HRV, attached forms).

Being a PWA, it installs to a phone's home screen ("Add to Home Screen") and
works from a URL — no app store needed.

## Run it

```bash
cd mobile
npm install

# point it at your backend (no trailing slash); leave empty for same origin
echo "VITE_API_BASE=http://localhost:4000" > .env

npm run dev        # http://localhost:5174
```

Build for production:

```bash
npm run build      # outputs to dist/
npm run preview    # serve the built app locally
```

### Pointing at the backend

The app calls `${VITE_API_BASE}/api`. Set `VITE_API_BASE` in `.env`:

- **Local:** `VITE_API_BASE=http://localhost:4000`
- **Codespaces:** forward the backend's port `4000`, set its **Public** URL, e.g.
  `VITE_API_BASE=https://<name>-4000.app.github.dev`
- **Same origin** (served behind the same host as the API): leave it empty.

The backend already sends permissive CORS (`*`), so the PWA can call it
cross-origin.

## Features

- **Compilation by status** — segmented control (All / Live / Suspended / Closed)
  with live counts, plus grouped sections in the list.
- **Search** across PTW no., work description, location, receiver, TRA no.
- **Permit detail** — key fields, linked TRA with HRV badge, and the list of
  attached forms (TRA, Take 5, clearances).
- **Installable PWA** — manifest + service worker (app shell cached; API calls
  always hit the network).

## Notes

This first version is **read-only** (a field-friendly register/compilation).
Creating and editing permits still happens in the web app under `../frontend`.
Editing on mobile can be added next, reusing the same API.
