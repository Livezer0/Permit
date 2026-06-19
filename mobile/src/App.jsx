import React, { useEffect, useMemo, useState } from "react";
import { getPermits, getTras, getMeta } from "./api.js";

/* Status groups for the compilation. */
const GROUPS = [
  { key: "live", label: "Live", statuses: ["Draft", "Submitted", "Approved", "Active"] },
  { key: "suspended", label: "Suspended", statuses: ["Suspended"] },
  { key: "closed", label: "Closed", statuses: ["Closed", "Cancelled"] }
];
const groupOf = (status) => (GROUPS.find(g => g.statuses.includes(status)) || GROUPS[0]).key;

const FALLBACK_LEVELS = {
  low: { label: "Low", color: "#4f8f00" }, moderate: { label: "Moderate", color: "#ffd100" },
  high: { label: "High", color: "#ff6a00" }, critical: { label: "Critical", color: "#ee0000" }
};

const CLEARANCE_LABELS = {
  loto: "Energy Isolation (LOTO)", hotWorks: "Hot Works", confinedSpace: "Confined Space",
  workingAtHeights: "Working at Heights", excavation: "Excavation", lifting: "Lifting",
  fireSuppression: "Fire/Gas Impairment", fireGasDetection: "Fire/Gas Detection"
};

function fmtDate(s) {
  if (!s) return "–";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

export default function App() {
  const [permits, setPermits] = useState([]);
  const [tras, setTras] = useState([]);
  const [levels, setLevels] = useState(FALLBACK_LEVELS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");        // all | live | suspended | closed
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // permit id

  async function load() {
    setLoading(true); setError("");
    try {
      const [p, t, m] = await Promise.all([getPermits(), getTras(), getMeta().catch(() => null)]);
      setPermits(p); setTras(t);
      if (m && m.levels) setLevels(m.levels);
    } catch (e) {
      setError(e.message || "Could not reach the API");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { all: permits.length, live: 0, suspended: 0, closed: 0 };
    permits.forEach(p => { c[groupOf(p.status)]++; });
    return c;
  }, [permits]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return permits
      .filter(p => tab === "all" || groupOf(p.status) === tab)
      .filter(p => !q || [p.ptwNo, p.workDescription, p.areaLocation, p.permitReceiver, p.traNo]
        .some(v => (v || "").toLowerCase().includes(q)))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [permits, tab, query]);

  const grouped = useMemo(() => GROUPS.map(g => ({
    ...g, items: filtered.filter(p => groupOf(p.status) === g.key)
  })).filter(g => g.items.length), [filtered]);

  const selectedPermit = permits.find(p => p.id === selected);
  const selectedTra = selectedPermit && tras.find(t => t.traRef === selectedPermit.traNo);

  if (selectedPermit) {
    return (
      <Detail permit={selectedPermit} tra={selectedTra} levels={levels} onBack={() => setSelected(null)} />
    );
  }

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr-row">
          <div>
            <h1>Permit to Work</h1>
            <p className="sub">Permit register &amp; compilation</p>
          </div>
          <button className="icon-btn" onClick={load} title="Refresh">⟳</button>
        </div>
        <input className="search" placeholder="Search permits…" value={query}
          onChange={e => setQuery(e.target.value)} />
        <nav className="segments">
          {[{ k: "all", l: "All" }, ...GROUPS.map(g => ({ k: g.key, l: g.label }))].map(s => (
            <button key={s.k} className={"seg" + (tab === s.k ? " on" : "")} onClick={() => setTab(s.k)}>
              {s.l}<span className="seg-count">{counts[s.k] ?? 0}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="list">
        {loading && <p className="muted center">Loading…</p>}
        {error && !loading && (
          <div className="error-box">
            <p>Can’t reach the API.</p>
            <p className="muted small">{error}</p>
            <p className="muted small">Set <code>VITE_API_BASE</code> to your backend URL and rebuild.</p>
            <button className="btn" onClick={load}>Retry</button>
          </div>
        )}
        {!loading && !error && grouped.length === 0 && <p className="muted center">No permits found.</p>}
        {!loading && !error && grouped.map(g => (
          <section key={g.key} className="group">
            <div className={"group-head g-" + g.key}>{g.label} <span>{g.items.length}</span></div>
            {g.items.map(p => (
              <PermitCard key={p.id} permit={p} tra={tras.find(t => t.traRef === p.traNo)} levels={levels}
                onClick={() => setSelected(p.id)} />
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}

function PermitCard({ permit, tra, levels, onClick }) {
  const hrv = tra && tra.hrv;
  const lvl = hrv && hrv.level ? (levels[hrv.level] || {}) : null;
  return (
    <button className="card" onClick={onClick}>
      <div className="card-top">
        <span className="ptwno">{permit.ptwNo || "—"}</span>
        <span className={"pill s-" + (permit.status || "Draft")}>{permit.status || "Draft"}</span>
      </div>
      <div className="card-title">{permit.workDescription || "(untitled)"}</div>
      <div className="card-meta">
        <span>{permit.areaLocation || "—"}</span>
        <span>·</span>
        <span>{permit.permitClass || "—"}</span>
        {permit.dateOfExpiry && <><span>·</span><span>exp {fmtDate(permit.dateOfExpiry)}</span></>}
      </div>
      <div className="card-foot">
        <span className="muted small">{permit.traNo ? "TRA " + permit.traNo : "No TRA"}</span>
        {lvl && <span className="hrv" style={{ background: lvl.color }}>{hrv.value} {lvl.label}</span>}
      </div>
    </button>
  );
}

function Detail({ permit, tra, levels, onBack }) {
  const hrv = tra && tra.hrv;
  const lvl = hrv && hrv.level ? (levels[hrv.level] || {}) : null;
  const clearances = Object.entries(permit.clearances || {}).filter(([, v]) => v).map(([k]) => CLEARANCE_LABELS[k] || k);
  const attached = [];
  if (permit.traNo) attached.push("Task Risk Assessment (" + permit.traNo + ")");
  attached.push("Take 5 & Toolbox Talk");
  if (permit.gasTestingRequired === "Yes") attached.push("Gas Testing");
  clearances.forEach(c => attached.push(c));

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr-row">
          <button className="icon-btn" onClick={onBack}>‹ Back</button>
          <span className={"pill s-" + (permit.status || "Draft")}>{permit.status || "Draft"}</span>
        </div>
        <h1 className="detail-title">{permit.ptwNo || "—"}</h1>
        <p className="sub">{permit.workDescription || "(untitled)"}</p>
      </header>
      <main className="detail">
        <Field label="Permit class" value={permit.permitClass} />
        <Field label="Location" value={permit.areaLocation} />
        <Field label="Permit Receiver" value={permit.permitReceiver} />
        <Field label="Work Order No." value={permit.workOrderNo} />
        <Field label="Valid until" value={fmtDate(permit.dateOfExpiry)} />

        <h2>Task Risk Assessment</h2>
        {tra ? (
          <div className="tra-box">
            <div className="row"><span>{tra.traRef}</span>
              {lvl && <span className="hrv" style={{ background: lvl.color }}>HRV {hrv.value} {lvl.label}</span>}</div>
            <p className="muted small">{tra.workDescription}</p>
            <p className="muted small">{(tra.steps || []).length} step(s)</p>
          </div>
        ) : <p className="muted">No TRA linked.</p>}

        <h2>Attached forms</h2>
        <ul className="chips">
          {attached.map((a, i) => <li key={i} className="chip">{a}</li>)}
        </ul>
      </main>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="field">
      <span className="f-label">{label}</span>
      <span className="f-value">{value || "—"}</span>
    </div>
  );
}
