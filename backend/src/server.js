// Permit to Work / Task Risk Assessment — REST API server (Express + SQLite).
import express from "express";
import cors from "cors";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { router as permitsRouter } from "./permits.js";
import { router as trasRouter } from "./tras.js";
import { seedIfEmpty } from "./seed.js";
import { META } from "./domain.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "2mb" }));

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", time: Date.now() }));

// Expose form metadata so the frontend stays in sync with the domain model.
app.get("/api/meta", (_req, res) => res.json(META));

app.use("/api/tras", trasRouter);
app.use("/api/permits", permitsRouter);

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// Convenience: also serve the static frontend so the whole app runs from one
// port (the frontend talks to /api on the same origin). The folders stay
// separate — this just saves running a second server.
const FRONTEND_DIR = process.env.PTW_FRONTEND_DIR || join(__dirname, "..", "..", "frontend");
if (existsSync(join(FRONTEND_DIR, "index.html"))) {
  app.use(express.static(FRONTEND_DIR));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

seedIfEmpty();

app.listen(PORT, () => {
  console.log(`PTW/TRA app running on http://localhost:${PORT}`);
  console.log(`  • UI:  http://localhost:${PORT}/`);
  console.log(`  • API: http://localhost:${PORT}/api`);
});
