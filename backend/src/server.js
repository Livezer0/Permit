// Permit to Work — REST API server (Express + SQLite).
import express from "express";
import cors from "cors";
import { router as permitsRouter } from "./permits.js";
import { seedIfEmpty } from "./seed.js";

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));

// Simple request log.
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", time: Date.now() }));

app.use("/api/permits", permitsRouter);

// 404 + error handlers.
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

seedIfEmpty();

app.listen(PORT, () => {
  console.log(`PTW API listening on http://localhost:${PORT}`);
});
