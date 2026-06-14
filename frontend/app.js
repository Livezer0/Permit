/* Permit to Work — Task Risk Assessment
 * Frontend SPA. Talks to the backend REST API; the database lives server-side. */
(function () {
  "use strict";

  const API = (window.PTW_API_BASE || "http://localhost:4000") + "/api";

  const HAZARDS = [
    "Working at height", "Hot work / fire", "Confined space", "Electricity",
    "Stored energy", "Hazardous substances", "Manual handling", "Noise",
    "Falling objects", "Moving machinery", "Slips, trips & falls", "Excavation",
    "Lifting operations", "Pressure systems", "Asbestos", "Lone working"
  ];

  /* ---------- Risk model (5x5 matrix) ---------- */
  function riskBand(score) {
    if (score <= 0) return { key: "", label: "–", css: "" };
    if (score <= 4) return { key: "low", label: "Low", css: "low" };
    if (score <= 9) return { key: "med", label: "Medium", css: "med" };
    if (score <= 14) return { key: "high", label: "High", css: "high" };
    return { key: "extreme", label: "Extreme", css: "extreme" };
  }
  function riskColor(css) {
    return { low: "#30a46c", med: "#d9a514", high: "#e8801c", extreme: "#e5484d" }[css] || "#2a3547";
  }

  /* ---------- API client ---------- */
  async function api(path, options) {
    const res = await fetch(API + path, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    if (res.status === 204) return null;
    let body = null;
    try { body = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
      const msg = body && (body.details ? body.details.join("; ") : body.error) || ("HTTP " + res.status);
      throw new Error(msg);
    }
    return body;
  }
  const apiList = () => api("/permits");
  const apiCreate = (p) => api("/permits", { method: "POST", body: JSON.stringify(p) });
  const apiUpdate = (id, p) => api("/permits/" + id, { method: "PUT", body: JSON.stringify(p) });
  const apiDelete = (id) => api("/permits/" + id, { method: "DELETE" });

  async function refresh() {
    try {
      permits = await apiList();
      return true;
    } catch (e) {
      toast("Cannot reach API: " + e.message, "err");
      return false;
    }
  }

  /* ---------- App state ---------- */
  let permits = [];   // cache of permits loaded from the API
  let current = null; // permit being edited

  /* ---------- DOM helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") node.className = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(c => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return node;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  let toastTimer;
  function toast(msg, kind) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast " + (kind || "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
  }

  /* ---------- Navigation ---------- */
  function showView(name) {
    $$(".view").forEach(v => v.classList.remove("active"));
    $("#view-" + name).classList.add("active");
    $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name));
    window.scrollTo(0, 0);
  }

  /* ---------- Dashboard ---------- */
  function permitResidual(p) {
    const scores = (p.risks || []).map(r => (+r.rl || 0) * (+r.rs || 0));
    return scores.length ? Math.max.apply(null, scores) : 0;
  }
  function permitInitial(p) {
    const scores = (p.risks || []).map(r => (+r.l || 0) * (+r.s || 0));
    return scores.length ? Math.max.apply(null, scores) : 0;
  }

  function renderStats() {
    const by = (s) => permits.filter(p => p.status === s).length;
    const stats = [
      { l: "Total", n: permits.length },
      { l: "Active", n: by("Active") },
      { l: "Awaiting approval", n: by("Submitted") },
      { l: "High / Extreme residual", n: permits.filter(p => permitResidual(p) >= 10).length }
    ];
    const row = $("#stat-row");
    row.innerHTML = "";
    stats.forEach(s => row.appendChild(
      el("div", { class: "stat" }, [
        el("div", { class: "n" }, [String(s.n)]),
        el("div", { class: "l" }, [s.l])
      ])
    ));
  }

  function fmtDate(s) {
    if (!s) return "–";
    const d = new Date(s);
    if (isNaN(d)) return "–";
    return d.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function renderTypeFilter() {
    const sel = $("#filter-type");
    const cur = sel.value;
    const types = Array.from(new Set(permits.map(p => p.type).filter(Boolean))).sort();
    sel.innerHTML = '<option value="">All types</option>' +
      types.map(t => `<option${t === cur ? " selected" : ""}>${esc(t)}</option>`).join("");
  }

  function renderTable() {
    const q = $("#search").value.trim().toLowerCase();
    const fs = $("#filter-status").value;
    const ft = $("#filter-type").value;

    const rows = permits
      .filter(p => !fs || p.status === fs)
      .filter(p => !ft || p.type === ft)
      .filter(p => {
        if (!q) return true;
        return [p.title, p.permitNo, p.location, p.applicant, p.type]
          .some(v => (v || "").toLowerCase().includes(q));
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const tbody = $("#permit-tbody");
    tbody.innerHTML = "";
    $("#empty-state").classList.toggle("hidden", rows.length > 0);

    rows.forEach(p => {
      const res = riskBand(permitResidual(p));
      const tr = el("tr", { class: "clickable", onClick: () => openEditor(p.id) }, [
        el("td", null, [p.permitNo || "–"]),
        el("td", null, [p.title || "(untitled)"]),
        el("td", null, [p.type || "–"]),
        el("td", null, [p.location || "–"]),
        el("td", { class: "small muted" }, [fmtDate(p.validFrom) + " → " + fmtDate(p.validTo)]),
        el("td", null, [el("span", { class: "risk-badge " + res.css }, [res.label])]),
        el("td", null, [el("span", { class: "pill " + (p.status || "Draft") }, [p.status || "Draft"])]),
        el("td", null, [el("button", { class: "btn ghost small", onClick: (e) => { e.stopPropagation(); openEditor(p.id); } }, ["Open"])])
      ]);
      tbody.appendChild(tr);
    });
  }

  function renderDashboard() {
    renderStats();
    renderTypeFilter();
    renderTable();
  }

  /* ---------- Editor ---------- */
  function blankPermit() {
    // No id / permitNo yet — the server assigns these on create.
    return {
      title: "", type: "", location: "", applicant: "", company: "",
      personnel: 1, validFrom: "", validTo: "", description: "",
      hazards: [], risks: [],
      status: "Draft", approver: "", ppe: "", emergency: "", notes: "", ack: false
    };
  }

  function openEditor(id) {
    current = id ? JSON.parse(JSON.stringify(permits.find(p => p.id === id))) : blankPermit();
    const isNew = !current.id;
    $("#editor-title").textContent = isNew ? "New Permit to Work" : "Edit Permit";
    $("#editor-permitno").textContent = current.permitNo || "Permit number assigned on save";
    $("#delete-btn").classList.toggle("hidden", isNew);

    const f = $("#permit-form");
    f.title.value = current.title;
    f.type.value = current.type;
    f.location.value = current.location;
    f.applicant.value = current.applicant;
    f.company.value = current.company;
    f.personnel.value = current.personnel || 1;
    f.validFrom.value = current.validFrom;
    f.validTo.value = current.validTo;
    f.description.value = current.description;
    f.status.value = current.status;
    f.approver.value = current.approver;
    f.ppe.value = current.ppe;
    f.emergency.value = current.emergency;
    f.notes.value = current.notes;
    f.ack.checked = !!current.ack;

    renderHazardChips();
    renderRARows();
    updateRiskSummary();
    showView("editor");
  }

  function renderHazardChips() {
    const wrap = $("#hazard-chips");
    wrap.innerHTML = "";
    HAZARDS.forEach(h => {
      const on = current.hazards.includes(h);
      const chip = el("label", { class: "chip" + (on ? " on" : "") }, [
        el("input", { type: "checkbox", ...(on ? { checked: "checked" } : {}) }),
        h
      ]);
      const cb = chip.querySelector("input");
      cb.checked = on;
      cb.addEventListener("change", () => {
        chip.classList.toggle("on", cb.checked);
        if (cb.checked) { if (!current.hazards.includes(h)) current.hazards.push(h); }
        else current.hazards = current.hazards.filter(x => x !== h);
      });
      wrap.appendChild(chip);
    });
  }

  function raRow(r) {
    const tr = el("tr");
    const mk = (name, ph, w) => {
      const td = el("td");
      td.appendChild(el("textarea", { rows: "2", placeholder: ph, style: w ? "width:100%" : "" }));
      const ta = td.querySelector("textarea");
      ta.value = r[name] || "";
      ta.addEventListener("input", () => { r[name] = ta.value; });
      return td;
    };
    const scoreInput = (name) => {
      const td = el("td", { class: "score-cell" });
      const inp = el("input", { type: "number", min: "1", max: "5" });
      inp.value = r[name] || "";
      inp.addEventListener("input", () => {
        let v = parseInt(inp.value, 10);
        if (isNaN(v)) v = "";
        else v = Math.max(1, Math.min(5, v));
        inp.value = v;
        r[name] = v;
        recalcRow();
        updateRiskSummary();
      });
      td.appendChild(inp);
      return td;
    };

    const initialTd = el("td", { class: "ra-cell-risk" });
    const residualTd = el("td", { class: "ra-cell-risk" });

    function recalcRow() {
      const i = (+r.l || 0) * (+r.s || 0);
      const res = (+r.rl || 0) * (+r.rs || 0);
      const bi = riskBand(i), br = riskBand(res);
      initialTd.innerHTML = "";
      residualTd.innerHTML = "";
      initialTd.appendChild(el("span", { class: "risk-badge " + bi.css }, [i ? i + " " + bi.label : "–"]));
      residualTd.appendChild(el("span", { class: "risk-badge " + br.css }, [res ? res + " " + br.label : "–"]));
    }

    const delTd = el("td", null, [
      el("button", { class: "row-del", title: "Remove", type: "button", onClick: () => {
        current.risks = current.risks.filter(x => x !== r);
        tr.remove();
        updateRiskSummary();
      } }, ["×"])
    ]);

    tr.appendChild(mk("hazard", "Step / hazard"));
    tr.appendChild(scoreInput("l"));
    tr.appendChild(scoreInput("s"));
    tr.appendChild(initialTd);
    tr.appendChild(mk("controls", "Control measures", true));
    tr.appendChild(scoreInput("rl"));
    tr.appendChild(scoreInput("rs"));
    tr.appendChild(residualTd);
    tr.appendChild(delTd);
    recalcRow();
    return tr;
  }

  function renderRARows() {
    const tb = $("#ra-tbody");
    tb.innerHTML = "";
    if (!current.risks.length) addRARow();
    else current.risks.forEach(r => tb.appendChild(raRow(r)));
  }

  function addRARow() {
    const r = { hazard: "", l: "", s: "", controls: "", rl: "", rs: "" };
    current.risks.push(r);
    $("#ra-tbody").appendChild(raRow(r));
  }

  function updateRiskSummary() {
    const i = permitInitial(current), res = permitResidual(current);
    const bi = riskBand(i), br = riskBand(res);
    const si = $("#summary-initial"), sr = $("#summary-residual");
    si.className = "risk-badge " + bi.css;
    si.textContent = i ? i + " " + bi.label : "–";
    sr.className = "risk-badge " + br.css;
    sr.textContent = res ? res + " " + br.label : "–";
  }

  function collectForm() {
    const f = $("#permit-form");
    current.title = f.title.value.trim();
    current.type = f.type.value;
    current.location = f.location.value.trim();
    current.applicant = f.applicant.value.trim();
    current.company = f.company.value.trim();
    current.personnel = +f.personnel.value || 1;
    current.validFrom = f.validFrom.value;
    current.validTo = f.validTo.value;
    current.description = f.description.value.trim();
    current.status = f.status.value;
    current.approver = f.approver.value.trim();
    current.ppe = f.ppe.value.trim();
    current.emergency = f.emergency.value.trim();
    current.notes = f.notes.value.trim();
    current.ack = f.ack.checked;
    // drop fully-empty risk rows
    current.risks = current.risks.filter(r =>
      r.hazard || r.controls || r.l || r.s || r.rl || r.rs);
  }

  function validate() {
    const f = $("#permit-form");
    const required = ["title", "type", "location", "applicant", "validFrom", "validTo"];
    for (const name of required) {
      if (!f[name].value) {
        f[name].focus();
        toast("Please complete: " + name, "err");
        return false;
      }
    }
    if (f.validTo.value && f.validFrom.value && f.validTo.value < f.validFrom.value) {
      toast("‘Valid To’ must be after ‘Valid From’.", "err");
      return false;
    }
    if (["Approved", "Active"].includes(f.status.value) && !f.ack.checked) {
      toast("Confirm the assessment acknowledgement before approving.", "err");
      return false;
    }
    return true;
  }

  async function savePermit() {
    if (!validate()) return;
    collectForm();
    try {
      const saved = current.id
        ? await apiUpdate(current.id, current)
        : await apiCreate(current);
      await refresh();
      toast("Permit " + (saved ? saved.permitNo : "") + " saved.", "ok");
      renderDashboard();
      showView("dashboard");
    } catch (e) {
      toast("Save failed: " + e.message, "err");
    }
  }

  async function deletePermit() {
    if (!current || !current.id) return;
    if (!confirm("Delete permit " + current.permitNo + "? This cannot be undone.")) return;
    try {
      await apiDelete(current.id);
      await refresh();
      toast("Permit deleted.", "");
      renderDashboard();
      showView("dashboard");
    } catch (e) {
      toast("Delete failed: " + e.message, "err");
    }
  }

  /* ---------- Matrix help ---------- */
  function buildMatrixHelp() {
    const likely = ["Rare", "Unlikely", "Possible", "Likely", "Almost certain"];
    const sever = ["Negligible", "Minor", "Moderate", "Major", "Catastrophic"];
    let html = "<p class='muted small'>Risk score = Likelihood &times; Severity. " +
      "Bands: <b>1–4 Low</b>, <b>5–9 Medium</b>, <b>10–14 High</b>, <b>15–25 Extreme</b>.</p>";
    html += "<table class='matrix'><tr><th>L \\ S</th>";
    for (let s = 1; s <= 5; s++) html += `<th>${s}<br><span class='muted small'>${sever[s-1]}</span></th>`;
    html += "</tr>";
    for (let l = 5; l >= 1; l--) {
      html += `<tr><th>${l}<br><span class='muted small'>${likely[l-1]}</span></th>`;
      for (let s = 1; s <= 5; s++) {
        const score = l * s;
        const b = riskBand(score);
        html += `<td class='cell' style='background:${riskColor(b.css)}'>${score}</td>`;
      }
      html += "</tr>";
    }
    html += "</table>";
    $("#matrix-help-body").innerHTML = html;
  }

  /* ---------- Wire up ---------- */
  async function init() {
    buildMatrixHelp();
    await refresh();
    renderDashboard();

    document.addEventListener("click", (e) => {
      const navBtn = e.target.closest(".nav-btn");
      if (navBtn) {
        if (navBtn.dataset.view === "editor") openEditor(null);
        else showView("dashboard");
        return;
      }
      const action = e.target.closest("[data-action]");
      if (!action) return;
      switch (action.dataset.action) {
        case "new-permit": openEditor(null); break;
        case "save-permit": savePermit(); break;
        case "cancel-edit": showView("dashboard"); renderDashboard(); break;
        case "delete-permit": deletePermit(); break;
        case "add-ra-row": addRARow(); break;
      }
    });

    $("#search").addEventListener("input", renderTable);
    $("#filter-status").addEventListener("change", renderTable);
    $("#filter-type").addEventListener("change", renderTable);

    $("#permit-form").addEventListener("submit", (e) => { e.preventDefault(); savePermit(); });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
