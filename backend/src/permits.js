// REST routes for Permits to Work (PTW).
import { Router } from "express";
import * as store from "./db.js";
import { PERMIT_STATUSES, PERMIT_CLASSES } from "./domain.js";

export const router = Router();

function validate(body) {
  const errors = [];
  if (!body.workDescription || !String(body.workDescription).trim()) {
    errors.push("workDescription is required");
  }
  if (!body.permitReceiver || !String(body.permitReceiver).trim()) {
    errors.push("permitReceiver is required");
  }
  if (body.permitClass && !PERMIT_CLASSES.includes(body.permitClass)) {
    errors.push(`permitClass must be one of: ${PERMIT_CLASSES.join(", ")}`);
  }
  if (body.status && !PERMIT_STATUSES.includes(body.status)) {
    errors.push(`status must be one of: ${PERMIT_STATUSES.join(", ")}`);
  }
  // A TRA must exist before a permit can be approved/issued.
  if (["Approved", "Active"].includes(body.status)) {
    if (!body.traNo) errors.push("a TRA No. is required before Approved/Active");
    else if (!store.getTraByRef(body.traNo)) errors.push(`TRA '${body.traNo}' does not exist`);
  }
  return errors;
}

router.get("/", (_req, res) => res.json(store.listPermits()));

router.get("/:id", (req, res) => {
  const permit = store.getPermit(req.params.id);
  if (!permit) return res.status(404).json({ error: "Permit not found" });
  res.json(permit);
});

router.post("/", (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: "Validation failed", details: errors });
  res.status(201).json(store.createPermit(req.body));
});

router.put("/:id", (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: "Validation failed", details: errors });
  const updated = store.updatePermit(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Permit not found" });
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  if (!store.deletePermit(req.params.id)) return res.status(404).json({ error: "Permit not found" });
  res.status(204).end();
});
