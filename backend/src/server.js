// Permit to Work / Task Risk Assessment — REST API server (Express + SQLite).
import express from "express";
import cors from "cors";
import { router as permitsRouter } from "./permits.js";
import { router as trasRouter } from "./tras.js";
import { seedIfEmpty } from "./seed.js";
import { RISK_LEVELS, CONTROL_TYPES, CLEARANCES, PERMIT_CLASSES, PERMIT_STATUSES } from "./domain.js";

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
app.get("/api/meta", (_req, res) => res.json({
  riskLevels: RISK_LEVELS,
  controlTypes: CONTROL_TYPES,
  clearances: CLEARANCES,
  permitClasses: PERMIT_CLASSES,
  permitStatuses: PERMIT_STATUSES
}));

app.use("/api/tras", trasRouter);
app.use("/api/permits", permitsRouter);

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

seedIfEmpty();

app.listen(PORT, () => {
  console.log(`PTW/TRA API listening on http://localhost:${PORT}`);
});
