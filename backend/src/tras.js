// REST routes for Task Risk Assessments (TRA).
import { Router } from "express";
import * as store from "./db.js";

export const router = Router();

function validate(body) {
  const errors = [];
  if (!body.workDescription || !String(body.workDescription).trim()) {
    errors.push("workDescription is required");
  }
  if (body.steps && !Array.isArray(body.steps)) errors.push("steps must be an array");
  return errors;
}

router.get("/", (_req, res) => res.json(store.listTras()));

router.get("/:id", (req, res) => {
  const tra = store.getTra(req.params.id);
  if (!tra) return res.status(404).json({ error: "TRA not found" });
  res.json(tra);
});

router.post("/", (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: "Validation failed", details: errors });
  res.status(201).json(store.createTra(req.body));
});

router.put("/:id", (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: "Validation failed", details: errors });
  const updated = store.updateTra(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "TRA not found" });
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  if (!store.deleteTra(req.params.id)) return res.status(404).json({ error: "TRA not found" });
  res.status(204).end();
});
