// SQLite data layer for the Permit to Work / Task Risk Assessment API.
// Uses Node's built-in node:sqlite (no native build step required).
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { hrvFor } from "./domain.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.PTW_DATA_DIR || join(__dirname, "..", "data");
mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.PTW_DB || join(DATA_DIR, "ptw.db");

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS tras (
    id               TEXT PRIMARY KEY,
    tra_ref          TEXT NOT NULL UNIQUE,
    work_description TEXT NOT NULL,
    wo_swms_no       TEXT,
    equipment        TEXT,
    location         TEXT,
    date_prepared    TEXT,
    contractor       TEXT,
    work_sponsor     TEXT,
    dept_in_charge   TEXT,
    parties          TEXT DEFAULT '{}',   -- JSON: facilitator, contractorLead, areaOwner, auxiliary[]
    approver         TEXT DEFAULT '{}',   -- JSON: {name, designation, signature, date}
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tra_steps (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    tra_id           TEXT NOT NULL,
    sort_order       INTEGER DEFAULT 0,
    work_step        TEXT,
    hazards          TEXT,
    inherent_s       INTEGER,
    inherent_p       INTEGER,
    control_measures TEXT,
    control_type     TEXT,
    residual_s       INTEGER,
    residual_p       INTEGER,
    remarks          TEXT,
    FOREIGN KEY (tra_id) REFERENCES tras(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_steps_tra ON tra_steps(tra_id);

  CREATE TABLE IF NOT EXISTS permits (
    id                 TEXT PRIMARY KEY,
    ptw_no             TEXT NOT NULL UNIQUE,
    work_order_no      TEXT,
    tra_no             TEXT,
    permit_class       TEXT,
    work_description   TEXT,
    area_location      TEXT,
    permit_receiver    TEXT,
    date_of_application TEXT,
    date_of_expiry     TEXT,
    status             TEXT DEFAULT 'Draft',
    data               TEXT DEFAULT '{}',   -- JSON: full section payload (Sections 1-10)
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL
  );
`);

/* ---------- helpers ---------- */
function safeParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}
function clampScore(v) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(1, Math.min(5, n));
}
function uid(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function nextRef(prefix, table, column) {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const row = db.prepare(
    `SELECT ${column} AS c FROM ${table} WHERE ${column} LIKE ? ORDER BY ${column} DESC LIMIT 1`
  ).get(like);
  let n = 1;
  if (row && row.c) {
    const m = String(row.c).match(/(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${prefix}-${year}-${String(n).padStart(3, "0")}`;
}

/* =========================================================
   TRA — Task Risk Assessment
   ========================================================= */
function stepToObj(r) {
  return {
    workStep: r.work_step, hazards: r.hazards,
    inherentS: r.inherent_s, inherentP: r.inherent_p,
    inherentV: (r.inherent_s || 0) * (r.inherent_p || 0),
    controlMeasures: r.control_measures, controlType: r.control_type,
    residualS: r.residual_s, residualP: r.residual_p,
    residualV: (r.residual_s || 0) * (r.residual_p || 0),
    remarks: r.remarks
  };
}

function traToObj(row, steps) {
  const stepObjs = (steps || []).map(stepToObj);
  return {
    id: row.id,
    traRef: row.tra_ref,
    workDescription: row.work_description,
    woSwmsNo: row.wo_swms_no,
    equipment: row.equipment,
    location: row.location,
    datePrepared: row.date_prepared,
    contractor: row.contractor,
    workSponsor: row.work_sponsor,
    deptInCharge: row.dept_in_charge,
    parties: safeParse(row.parties, {}),
    approver: safeParse(row.approver, {}),
    steps: stepObjs,
    hrv: hrvFor(stepObjs),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const qTraSteps = db.prepare("SELECT * FROM tra_steps WHERE tra_id = ? ORDER BY sort_order, id");
const qInsertStep = db.prepare(`
  INSERT INTO tra_steps
    (tra_id, sort_order, work_step, hazards, inherent_s, inherent_p,
     control_measures, control_type, residual_s, residual_p, remarks)
  VALUES (@tra_id, @sort_order, @work_step, @hazards, @inherent_s, @inherent_p,
          @control_measures, @control_type, @residual_s, @residual_p, @remarks)
`);
const qDeleteSteps = db.prepare("DELETE FROM tra_steps WHERE tra_id = ?");

function writeSteps(traId, steps) {
  qDeleteSteps.run(traId);
  (steps || []).forEach((s, i) => {
    const hasContent = s.workStep || s.hazards || s.controlMeasures || s.remarks ||
      s.inherentS || s.inherentP || s.residualS || s.residualP || s.controlType;
    if (!hasContent) return;
    qInsertStep.run({
      tra_id: traId, sort_order: i,
      work_step: s.workStep || null, hazards: s.hazards || null,
      inherent_s: clampScore(s.inherentS), inherent_p: clampScore(s.inherentP),
      control_measures: s.controlMeasures || null, control_type: s.controlType || null,
      residual_s: clampScore(s.residualS), residual_p: clampScore(s.residualP),
      remarks: s.remarks || null
    });
  });
}

export function listTras() {
  return db.prepare("SELECT * FROM tras ORDER BY updated_at DESC").all()
    .map(row => traToObj(row, qTraSteps.all(row.id)));
}
export function getTra(id) {
  const row = db.prepare("SELECT * FROM tras WHERE id = ?").get(id);
  if (!row) return null;
  return traToObj(row, qTraSteps.all(id));
}
export function getTraByRef(ref) {
  const row = db.prepare("SELECT * FROM tras WHERE tra_ref = ?").get(ref);
  if (!row) return null;
  return traToObj(row, qTraSteps.all(row.id));
}

const qInsertTra = db.prepare(`
  INSERT INTO tras
    (id, tra_ref, work_description, wo_swms_no, equipment, location, date_prepared,
     contractor, work_sponsor, dept_in_charge, parties, approver, created_at, updated_at)
  VALUES (@id, @tra_ref, @work_description, @wo_swms_no, @equipment, @location, @date_prepared,
          @contractor, @work_sponsor, @dept_in_charge, @parties, @approver, @created_at, @updated_at)
`);
const qUpdateTra = db.prepare(`
  UPDATE tras SET
    work_description=@work_description, wo_swms_no=@wo_swms_no, equipment=@equipment,
    location=@location, date_prepared=@date_prepared, contractor=@contractor,
    work_sponsor=@work_sponsor, dept_in_charge=@dept_in_charge,
    parties=@parties, approver=@approver, updated_at=@updated_at
  WHERE id=@id
`);

function traRow(t) {
  return {
    id: t.id,
    tra_ref: t.traRef,
    work_description: t.workDescription,
    wo_swms_no: t.woSwmsNo ?? null,
    equipment: t.equipment ?? null,
    location: t.location ?? null,
    date_prepared: t.datePrepared ?? null,
    contractor: t.contractor ?? null,
    work_sponsor: t.workSponsor ?? null,
    dept_in_charge: t.deptInCharge ?? null,
    parties: JSON.stringify(t.parties || {}),
    approver: JSON.stringify(t.approver || {}),
    created_at: t.createdAt,
    updated_at: t.updatedAt
  };
}

export function createTra(input) {
  const now = Date.now();
  const id = uid("t");
  const tra = { ...input, id, traRef: nextRef("TRA", "tras", "tra_ref"), createdAt: now, updatedAt: now };
  db.exec("BEGIN");
  try {
    qInsertTra.run(traRow(tra));
    writeSteps(id, input.steps);
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  return getTra(id);
}

export function updateTra(id, input) {
  const existing = db.prepare("SELECT * FROM tras WHERE id = ?").get(id);
  if (!existing) return null;
  const now = Date.now();
  const tra = { ...input, id, traRef: existing.tra_ref, createdAt: existing.created_at, updatedAt: now };
  const row = traRow(tra);
  delete row.tra_ref; delete row.created_at;
  db.exec("BEGIN");
  try {
    qUpdateTra.run(row);
    writeSteps(id, input.steps);
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  return getTra(id);
}

export function deleteTra(id) {
  return db.prepare("DELETE FROM tras WHERE id = ?").run(id).changes > 0;
}
export function countTras() {
  return db.prepare("SELECT COUNT(*) c FROM tras").get().c;
}

/* =========================================================
   PTW — Permit to Work
   ========================================================= */
function permitToObj(row) {
  return {
    id: row.id,
    ptwNo: row.ptw_no,
    workOrderNo: row.work_order_no,
    traNo: row.tra_no,
    permitClass: row.permit_class,
    workDescription: row.work_description,
    areaLocation: row.area_location,
    permitReceiver: row.permit_receiver,
    dateOfApplication: row.date_of_application,
    dateOfExpiry: row.date_of_expiry,
    status: row.status,
    // Spread the full section payload back onto the object.
    ...safeParse(row.data, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Columns promoted out of the JSON payload for listing/search.
const PROMOTED = new Set([
  "id", "ptwNo", "workOrderNo", "traNo", "permitClass", "workDescription",
  "areaLocation", "permitReceiver", "dateOfApplication", "dateOfExpiry",
  "status", "createdAt", "updatedAt"
]);

function permitRow(p) {
  const data = {};
  for (const k in p) if (!PROMOTED.has(k)) data[k] = p[k];
  return {
    id: p.id,
    ptw_no: p.ptwNo,
    work_order_no: p.workOrderNo ?? null,
    tra_no: p.traNo ?? null,
    permit_class: p.permitClass ?? null,
    work_description: p.workDescription ?? null,
    area_location: p.areaLocation ?? null,
    permit_receiver: p.permitReceiver ?? null,
    date_of_application: p.dateOfApplication ?? null,
    date_of_expiry: p.dateOfExpiry ?? null,
    status: p.status || "Draft",
    data: JSON.stringify(data),
    created_at: p.createdAt,
    updated_at: p.updatedAt
  };
}

const qInsertPermit = db.prepare(`
  INSERT INTO permits
    (id, ptw_no, work_order_no, tra_no, permit_class, work_description, area_location,
     permit_receiver, date_of_application, date_of_expiry, status, data, created_at, updated_at)
  VALUES (@id, @ptw_no, @work_order_no, @tra_no, @permit_class, @work_description, @area_location,
          @permit_receiver, @date_of_application, @date_of_expiry, @status, @data, @created_at, @updated_at)
`);
const qUpdatePermit = db.prepare(`
  UPDATE permits SET
    work_order_no=@work_order_no, tra_no=@tra_no, permit_class=@permit_class,
    work_description=@work_description, area_location=@area_location, permit_receiver=@permit_receiver,
    date_of_application=@date_of_application, date_of_expiry=@date_of_expiry,
    status=@status, data=@data, updated_at=@updated_at
  WHERE id=@id
`);

export function listPermits() {
  return db.prepare("SELECT * FROM permits ORDER BY updated_at DESC").all().map(permitToObj);
}
export function getPermit(id) {
  const row = db.prepare("SELECT * FROM permits WHERE id = ?").get(id);
  return row ? permitToObj(row) : null;
}

export function createPermit(input) {
  const now = Date.now();
  const id = uid("p");
  const permit = { ...input, id, ptwNo: nextRef("PTW", "permits", "ptw_no"), createdAt: now, updatedAt: now };
  qInsertPermit.run(permitRow(permit));
  return getPermit(id);
}

export function updatePermit(id, input) {
  const existing = db.prepare("SELECT * FROM permits WHERE id = ?").get(id);
  if (!existing) return null;
  const now = Date.now();
  const permit = { ...input, id, ptwNo: existing.ptw_no, createdAt: existing.created_at, updatedAt: now };
  const row = permitRow(permit);
  delete row.ptw_no; delete row.created_at;
  qUpdatePermit.run(row);
  return getPermit(id);
}

export function deletePermit(id) {
  return db.prepare("DELETE FROM permits WHERE id = ?").run(id).changes > 0;
}
export function countPermits() {
  return db.prepare("SELECT COUNT(*) c FROM permits").get().c;
}
