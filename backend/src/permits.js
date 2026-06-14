// REST routes for permits.
import { Router } from "express";
import * as store from "./db.js";

export const router = Router();

const STATUSES = ["Draft", "Submitted", "Approved", "Active", "Suspended", "Closed"];

function validate(body) {
  const errors = [];
  const required = ["title", "type", "location", "applicant", "validFrom", "validTo"];
  for (const f of required) {
    if (!body[f] || String(body[f]).trim() === "") errors.push(`${f} is required`);
  }
  if (body.status && !STATUSES.includes(body.status)) {
    errors.push(`status must be one of: ${STATUSES.join(", ")}`);
  }
  if (body.validFrom && body.validTo && body.validTo < body.validFrom) {
    errors.push("validTo must be on or after validFrom");
  }
  if (["Approved", "Active"].includes(body.status) && !body.ack) {
    errors.push("acknowledgement (ack) is required before Approved/Active");
  }
  if (body.risks && !Array.isArray(body.risks)) {
    errors.push("risks must be an array");
  }
  return errors;
}

// GET /api/permits
router.get("/", (req, res) => {
  res.json(store.listPermits());
});

// GET /api/permits/:id
router.get("/:id", (req, res) => {
  const permit = store.getPermit(req.params.id);
  if (!permit) return res.status(404).json({ error: "Permit not found" });
  res.json(permit);
});

// POST /api/permits
router.post("/", (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: "Validation failed", details: errors });
  const created = store.createPermit(req.body);
  res.status(201).json(created);
});

// PUT /api/permits/:id
router.put("/:id", (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: "Validation failed", details: errors });
  const updated = store.updatePermit(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Permit not found" });
  res.json(updated);
});

// DELETE /api/permits/:id
router.delete("/:id", (req, res) => {
  const ok = store.deletePermit(req.params.id);
  if (!ok) return res.status(404).json({ error: "Permit not found" });
  res.status(204).end();
});
