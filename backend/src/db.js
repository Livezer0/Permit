// SQLite data layer for the Permit to Work API.
// Uses Node's built-in node:sqlite (no native build step required).
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.PTW_DATA_DIR || join(__dirname, "..", "data");
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.PTW_DB || join(DATA_DIR, "ptw.db");

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS permits (
    id          TEXT PRIMARY KEY,
    permit_no   TEXT NOT NULL UNIQUE,
    title       TEXT NOT NULL,
    type        TEXT,
    location    TEXT,
    applicant   TEXT,
    company     TEXT,
    personnel   INTEGER DEFAULT 1,
    valid_from  TEXT,
    valid_to    TEXT,
    description TEXT,
    hazards     TEXT DEFAULT '[]',   -- JSON array
    status      TEXT DEFAULT 'Draft',
    approver    TEXT,
    ppe         TEXT,
    emergency   TEXT,
    notes       TEXT,
    ack         INTEGER DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS risks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    permit_id  TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    hazard     TEXT,
    l          INTEGER,
    s          INTEGER,
    controls   TEXT,
    rl         INTEGER,
    rs         INTEGER,
    FOREIGN KEY (permit_id) REFERENCES permits(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_risks_permit ON risks(permit_id);
`);

/* ---------- Mapping helpers ---------- */
function rowToPermit(row, risks) {
  return {
    id: row.id,
    permitNo: row.permit_no,
    title: row.title,
    type: row.type,
    location: row.location,
    applicant: row.applicant,
    company: row.company,
    personnel: row.personnel,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    description: row.description,
    hazards: safeParse(row.hazards, []),
    status: row.status,
    approver: row.approver,
    ppe: row.ppe,
    emergency: row.emergency,
    notes: row.notes,
    ack: !!row.ack,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    risks: (risks || []).map(r => ({
      hazard: r.hazard, l: r.l, s: r.s,
      controls: r.controls, rl: r.rl, rs: r.rs
    }))
  };
}

function safeParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

/* ---------- Queries ---------- */
const qAllPermits = db.prepare("SELECT * FROM permits ORDER BY updated_at DESC");
const qPermit = db.prepare("SELECT * FROM permits WHERE id = ?");
const qRisks = db.prepare("SELECT * FROM risks WHERE permit_id = ? ORDER BY sort_order ASC, id ASC");
const qDeleteRisks = db.prepare("DELETE FROM risks WHERE permit_id = ?");
const qInsertRisk = db.prepare(`
  INSERT INTO risks (permit_id, sort_order, hazard, l, s, controls, rl, rs)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const qInsertPermit = db.prepare(`
  INSERT INTO permits
    (id, permit_no, title, type, location, applicant, company, personnel,
     valid_from, valid_to, description, hazards, status, approver, ppe,
     emergency, notes, ack, created_at, updated_at)
  VALUES
    (@id, @permit_no, @title, @type, @location, @applicant, @company, @personnel,
     @valid_from, @valid_to, @description, @hazards, @status, @approver, @ppe,
     @emergency, @notes, @ack, @created_at, @updated_at)
`);
const qUpdatePermit = db.prepare(`
  UPDATE permits SET
    title=@title, type=@type, location=@location, applicant=@applicant,
    company=@company, personnel=@personnel, valid_from=@valid_from,
    valid_to=@valid_to, description=@description, hazards=@hazards,
    status=@status, approver=@approver, ppe=@ppe, emergency=@emergency,
    notes=@notes, ack=@ack, updated_at=@updated_at
  WHERE id=@id
`);
const qDeletePermit = db.prepare("DELETE FROM permits WHERE id = ?");
const qMaxSeq = db.prepare(
  "SELECT permit_no FROM permits WHERE permit_no LIKE ? ORDER BY permit_no DESC LIMIT 1"
);

function clampScore(v) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(1, Math.min(5, n));
}

function writeRisks(permitId, risks) {
  qDeleteRisks.run(permitId);
  (risks || []).forEach((r, i) => {
    const hazard = (r.hazard || "").trim();
    const controls = (r.controls || "").trim();
    const l = clampScore(r.l), s = clampScore(r.s);
    const rl = clampScore(r.rl), rs = clampScore(r.rs);
    // Skip entirely-empty rows.
    if (!hazard && !controls && l == null && s == null && rl == null && rs == null) return;
    qInsertRisk.run(permitId, i, hazard, l, s, controls, rl, rs);
  });
}

/* ---------- Public API ---------- */
export function listPermits() {
  return qAllPermits.all().map(row => rowToPermit(row, qRisks.all(row.id)));
}

export function getPermit(id) {
  const row = qPermit.get(id);
  if (!row) return null;
  return rowToPermit(row, qRisks.all(id));
}

export function nextPermitNo() {
  const year = new Date().getFullYear();
  const prefix = `PTW-${year}-`;
  const row = qMaxSeq.get(prefix + "%");
  let n = 1;
  if (row) {
    const m = row.permit_no.match(/(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return prefix + String(n).padStart(3, "0");
}

function toRow(p) {
  return {
    id: p.id,
    permit_no: p.permitNo,
    title: p.title,
    type: p.type ?? null,
    location: p.location ?? null,
    applicant: p.applicant ?? null,
    company: p.company ?? null,
    personnel: Number.isFinite(+p.personnel) ? +p.personnel : 1,
    valid_from: p.validFrom ?? null,
    valid_to: p.validTo ?? null,
    description: p.description ?? null,
    hazards: JSON.stringify(Array.isArray(p.hazards) ? p.hazards : []),
    status: p.status || "Draft",
    approver: p.approver ?? null,
    ppe: p.ppe ?? null,
    emergency: p.emergency ?? null,
    notes: p.notes ?? null,
    ack: p.ack ? 1 : 0,
    created_at: p.createdAt,
    updated_at: p.updatedAt
  };
}

export function createPermit(input) {
  const now = Date.now();
  const id = "p_" + now.toString(36) + Math.random().toString(36).slice(2, 7);
  const permit = {
    ...input,
    id,
    permitNo: nextPermitNo(),
    createdAt: now,
    updatedAt: now
  };
  db.exec("BEGIN");
  try {
    qInsertPermit.run(toRow(permit));
    writeRisks(id, input.risks);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return getPermit(id);
}

export function updatePermit(id, input) {
  const existing = qPermit.get(id);
  if (!existing) return null;
  const now = Date.now();
  const permit = {
    ...input,
    id,
    permitNo: existing.permit_no, // permit number is immutable
    createdAt: existing.created_at,
    updatedAt: now
  };
  const row = toRow(permit);
  delete row.permit_no;   // immutable; not part of the UPDATE statement
  delete row.created_at;  // immutable; not part of the UPDATE statement
  db.exec("BEGIN");
  try {
    qUpdatePermit.run(row);
    writeRisks(id, input.risks);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return getPermit(id);
}

export function deletePermit(id) {
  const res = qDeletePermit.run(id);
  return res.changes > 0;
}

export function count() {
  return db.prepare("SELECT COUNT(*) c FROM permits").get().c;
}
