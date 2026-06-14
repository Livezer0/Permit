/* Permit to Work & Task Risk Assessment — frontend SPA.
 * Editors are faithful replicas of the TRA (landscape) and PTW (portrait) forms. */
(function () {
  "use strict";

  const API = (window.PTW_API_BASE || "http://localhost:4000") + "/api";

  /* ---------- Fallback domain model (overridden by /api/meta) ---------- */
  let META = {
    levels: {
      low: { key: "low", label: "Low", color: "#4f8f00", authority: "Operations Superintendent / Supervisor" },
      moderate: { key: "moderate", label: "Moderate", color: "#ffd100", authority: "Operations Head" },
      high: { key: "high", label: "High", color: "#ff6a00", authority: "Facility Head" },
      critical: { key: "critical", label: "Critical", color: "#ee0000", authority: "Regional O&M Head" }
    },
    levelOrder: ["low", "moderate", "high", "critical"],
    matrix: {
      5: { 1: "high", 2: "high", 3: "critical", 4: "critical", 5: "critical" },
      4: { 1: "moderate", 2: "high", 3: "high", 4: "critical", 5: "critical" },
      3: { 1: "low", 2: "moderate", 3: "high", 4: "high", 5: "critical" },
      2: { 1: "low", 2: "low", 3: "moderate", 4: "high", 5: "critical" },
      1: { 1: "low", 2: "low", 3: "moderate", 4: "high", 5: "high" }
    },
    consequenceLabels: ["Negligible", "Low", "Moderate", "High", "Catastrophic"],
    likelihoodLabels: ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"],
    controlTypes: ["Elimination", "Substitution", "Engineering", "Administrative", "PPE"],
    clearances: [
      { key: "loto", label: "LOTO" }, { key: "workingAtHeights", label: "Working at Heights" },
      { key: "lifting", label: "Lifting" }, { key: "excavation", label: "Excavation" },
      { key: "fireGasDetection", label: "Fire/Gas Detection and Alarm" }, { key: "fireSuppression", label: "Fire Suppression" },
      { key: "hotWorks", label: "Hot Works" }, { key: "confinedSpace", label: "Confined Space" },
      { key: "workOverWater", label: "Work Over / Under Water" }, { key: "others", label: "Others" }
    ],
    permitClasses: ["Scheduled", "Emergency", "Outage"],
    permitStatuses: ["Draft", "Submitted", "Approved", "Active", "Suspended", "Cancelled", "Closed"]
  };

  /* ---------- Risk helpers ---------- */
  const vuln = (s, p) => (parseInt(s, 10) || 0) * (parseInt(p, 10) || 0);
  function levelKeyFor(s, p) {
    s = parseInt(s, 10); p = parseInt(p, 10);
    if (!s || !p) return "";
    return (META.matrix[p] && META.matrix[p][s]) || "";
  }
  const levelMeta = (key) => META.levels[key] || { label: "–", color: "#cfcfcf", authority: "" };
  function hrvOf(steps) {
    let value = 0, worst = -1;
    (steps || []).forEach(s => {
      const v = vuln(s.residualS, s.residualP);
      if (v > value) value = v;
      const idx = META.levelOrder.indexOf(levelKeyFor(s.residualS, s.residualP));
      if (idx > worst) worst = idx;
    });
    const key = worst >= 0 ? META.levelOrder[worst] : "";
    return { value, key, ...levelMeta(key) };
  }

  /* ---------- DOM helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(c => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
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
    toastTimer = setTimeout(() => t.classList.add("hidden"), 3000);
  }
  function fmtDate(s) {
    if (!s) return "–";
    const d = new Date(s);
    return isNaN(d) ? s : d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
  }

  /* ---------- Nested get/set for data-bound sheets ---------- */
  function gp(obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function sp(obj, path, val) {
    const keys = path.split(".");
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null || typeof o[keys[i]] !== "object") o[keys[i]] = {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = val;
  }
  // Wire all [data-k] controls inside root to state.
  function bindSheet(root, state, after) {
    $$("[data-k]", root).forEach(node => {
      const path = node.getAttribute("data-k");
      const tag = node.tagName, type = node.type;
      if (tag === "INPUT" && type === "checkbox") {
        node.checked = !!gp(state, path);
        node.addEventListener("change", () => { sp(state, path, node.checked); if (after) after(path); });
      } else if (tag === "INPUT" && type === "radio") {
        node.checked = gp(state, path) === node.value;
        node.addEventListener("change", () => { if (node.checked) { sp(state, path, node.value); if (after) after(path); } });
      } else {
        const v = gp(state, path);
        node.value = v == null ? "" : v;
        node.addEventListener("input", () => { sp(state, path, node.value); if (after) after(path); });
      }
    });
  }

  /* ---------- API client ---------- */
  async function api(path, options) {
    const res = await fetch(API + path, { headers: { "Content-Type": "application/json" }, ...options });
    if (res.status === 204) return null;
    let body = null;
    try { body = await res.json(); } catch { /* none */ }
    if (!res.ok) throw new Error((body && (body.details ? body.details.join("; ") : body.error)) || ("HTTP " + res.status));
    return body;
  }

  /* ---------- State ---------- */
  let permits = [], tras = [], curPermit = null, curTra = null;
  async function refresh() {
    try { [permits, tras] = await Promise.all([api("/permits"), api("/tras")]); return true; }
    catch (e) { toast("Cannot reach API: " + e.message, "err"); return false; }
  }

  /* ---------- Navigation + print orientation ---------- */
  function setPageOrient(mode) {
    let s = $("#page-orient");
    if (!s) { s = el("style", { id: "page-orient" }); document.head.appendChild(s); }
    s.textContent = "@media print{@page{size:A4 " + mode + ";margin:8mm}}";
  }
  function showView(name) {
    $$(".view").forEach(v => v.classList.remove("active"));
    $("#view-" + name).classList.add("active");
    const top = name.startsWith("permit") ? "permits" : name.startsWith("tra") ? "tras" : name;
    $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === top));
    document.body.classList.toggle("printing-permit", name === "permit-editor");
    document.body.classList.toggle("printing-tra", name === "tra-editor");
    if (name === "tra-editor") setPageOrient("landscape");
    else if (name === "permit-editor") setPageOrient("portrait");
    window.scrollTo(0, 0);
  }

  /* ========================================================
     TASK RISK ASSESSMENT — landscape form sheet
     ======================================================== */
  function blankTra() {
    return {
      workDescription: "", woSwmsNo: "", equipment: "", location: "", datePrepared: "",
      contractor: "", workSponsor: "", deptInCharge: "",
      steps: [], parties: { facilitator: {}, contractorLead: {}, areaOwner: {}, auxiliary: [] }, approver: {}
    };
  }

  function inp(path, attrs) { return `<input class="cell-in" data-k="${path}" ${attrs || ""}/>`; }
  function txt(path) { return `<textarea class="cell-in" data-k="${path}" rows="2"></textarea>`; }

  function riskMatrixHtml() {
    let h = `<table class="matrix"><tr>
      <td class="mx-corner" colspan="2" rowspan="2"></td>
      <td class="mx-axis" colspan="5">CONSEQUENCE OR IMPACT</td></tr><tr>`;
    META.consequenceLabels.forEach((l, i) => h += `<td class="mx-head">${esc(l)}<br>(${i + 1})</td>`);
    h += `</tr>`;
    for (let p = 5; p >= 1; p--) {
      h += `<tr>`;
      if (p === 5) h += `<td class="mx-axis mx-vert" rowspan="5">LIKELIHOOD OF&nbsp;OCCURRENCE</td>`;
      h += `<td class="mx-head">${esc(META.likelihoodLabels[p - 1])}<br>(${p})</td>`;
      for (let s = 1; s <= 5; s++) {
        const m = levelMeta(META.matrix[p][s]);
        h += `<td class="mx-cell" style="background:${m.color}">${p * s}</td>`;
      }
      h += `</tr>`;
    }
    h += `</table>`;
    return h;
  }
  function authoritiesHtml() {
    let h = `<table class="auth-table"><tr><td class="sec-bar" colspan="2">Risk Level Authorities to approve the created TRAs.</td></tr>`;
    META.levelOrder.forEach(k => {
      const m = META.levels[k];
      h += `<tr><td class="auth-lvl" style="background:${m.color}">${m.label}</td><td>${esc(m.authority)}</td></tr>`;
    });
    h += `</table>`;
    h += `<div class="classif"><span class="muted small">Vulnerability (Risk Rating) Classification</span><div class="classif-row">`;
    META.levelOrder.forEach(k => { const m = META.levels[k]; h += `<span class="classif-cell" style="background:${m.color}">${m.label}</span>`; });
    h += `</div></div>`;
    return h;
  }

  function buildTraSheet() {
    const body = $("#tra-form-body");
    body.innerHTML = `
    <div class="sheet-scroll"><div class="sheet sheet-landscape" id="tra-sheet">
      <div class="sheet-title">TASK RISK ASSESSMENT</div>

      <table class="hdr">
        <tr>
          <td class="lbl">Work Description:</td>
          <td colspan="3" rowspan="2">${txt("workDescription")}</td>
          <td class="lbl">TRA Reference No. :</td><td>${inp("traRef", "disabled")}</td>
        </tr>
        <tr><td class="lbl"></td><td class="lbl">WO/ SWMS No. :</td><td>${inp("woSwmsNo")}</td></tr>
        <tr>
          <td class="lbl">Equipment Involved:</td><td>${inp("equipment")}</td>
          <td class="lbl">Location:</td><td>${inp("location")}</td>
          <td class="lbl">Date Prepared:</td><td>${inp("datePrepared", 'type="date"')}</td>
        </tr>
        <tr>
          <td class="lbl">Contractor:</td><td>${inp("contractor")}</td>
          <td class="lbl">Work Sponsor:</td><td>${inp("workSponsor")}</td>
          <td class="lbl">Department In-charge:</td><td>${inp("deptInCharge")}</td>
        </tr>
      </table>

      <table class="ra">
        <thead>
          <tr>
            <th rowspan="2" class="c-num">#</th>
            <th rowspan="2">Work Step Description</th>
            <th rowspan="2">Hazard(s)<br><span class="th-sub">(state the cause and effect)</span></th>
            <th colspan="3" class="grp">Inherent</th>
            <th rowspan="2">Control Measures<br><span class="th-sub">(be specific)</span></th>
            <th rowspan="2" class="th-blue">Type of control</th>
            <th colspan="3" class="grp">Residual</th>
            <th rowspan="2">Remarks</th>
            <th rowspan="2" class="c-del"></th>
          </tr>
          <tr>
            <th class="c-sp">Severity</th><th class="c-sp">Probability</th><th class="c-v">Vuln.<br>(S x P)</th>
            <th class="c-sp">Severity</th><th class="c-sp">Probability</th><th class="c-v">Vuln.<br>(S x P)</th>
          </tr>
        </thead>
        <tbody id="tra-steps-body"></tbody>
        <tfoot>
          <tr class="hrv-row">
            <td colspan="9" class="hrv-label">Highest Residual Vulnerability (HRV)</td>
            <td class="c-v" id="hrv-cell">–</td><td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
      <button type="button" class="btn ghost small noprint" data-action="add-step">+ Add work step</button>

      <div class="tra-foot">
        <div class="tra-foot-left">
          <table class="parties">
            <tr><td class="sec-bar" colspan="5">TRA Creation Essential Parties</td></tr>
            <tr class="phead"><td>Role</td><td>Name</td><td>Designation - Dep't.</td><td>Signature</td><td>Date</td></tr>
            <tr><td class="role">Facilitator (i.e. MNT, FSM, SEC, SHE)</td>
              <td>${inp("parties.facilitator.name")}</td><td>${inp("parties.facilitator.designation")}</td>
              <td>${inp("parties.facilitator.signature")}</td><td>${inp("parties.facilitator.date", 'type="date"')}</td></tr>
            <tr><td class="role">Contractor Lead (when applicable)</td>
              <td>${inp("parties.contractorLead.name")}</td><td>${inp("parties.contractorLead.designation")}</td>
              <td>${inp("parties.contractorLead.signature")}</td><td>${inp("parties.contractorLead.date", 'type="date"')}</td></tr>
            <tr><td class="role">Area Owner / Operations Representative</td>
              <td>${inp("parties.areaOwner.name")}</td><td>${inp("parties.areaOwner.designation")}</td>
              <td>${inp("parties.areaOwner.signature")}</td><td>${inp("parties.areaOwner.date", 'type="date"')}</td></tr>
          </table>
          <table class="parties">
            <tr><td class="sec-bar" colspan="6">TRA Creation Auxiliary Parties</td></tr>
            <tr class="phead"><td>Role</td><td>Name</td><td>Designation - Dep't.</td><td>Signature</td><td>Date</td><td class="c-del noprint"></td></tr>
            <tbody id="tra-aux-body"></tbody>
          </table>
          <button type="button" class="btn ghost small noprint" data-action="add-aux">+ Add auxiliary party</button>

          <table class="parties appr">
            <tr><td class="sec-bar" colspan="5">TRA Approved by:</td></tr>
            <tr class="phead"><td>Highest Residual Vulnerability (HRV)<br><span class="th-sub">(state color)</span></td>
              <td>Name of Approver</td><td>Designation - Dep't.</td><td>Signature</td><td>Date</td></tr>
            <tr>
              <td id="appr-hrv" class="appr-hrv">–</td>
              <td>${inp("approver.name")}</td><td>${inp("approver.designation")}</td>
              <td>${inp("approver.signature")}</td><td>${inp("approver.date", 'type="date"')}</td></tr>
          </table>
        </div>
        <div class="tra-foot-right">
          ${riskMatrixHtml()}
          ${authoritiesHtml()}
        </div>
      </div>
    </div></div>`;

    // value of the disabled traRef input
    const refIn = $('[data-k="traRef"]', body);
    if (refIn) refIn.value = curTra.traRef || "";

    bindSheet(body, curTra);
    renderTraSteps();
    renderAux();
    updateHrv();
  }

  function scoreInput(step, key, onAfter) {
    const i = el("input", { class: "cell-in score", type: "number", min: 1, max: 5 });
    i.value = step[key] || "";
    i.addEventListener("input", () => {
      let v = parseInt(i.value, 10);
      v = isNaN(v) ? "" : Math.max(1, Math.min(5, v));
      i.value = v; step[key] = v; onAfter();
    });
    return i;
  }
  function cellTa(step, key) {
    const t = el("textarea", { class: "cell-in", rows: 2 });
    t.value = step[key] || "";
    t.addEventListener("input", () => { step[key] = t.value; });
    return t;
  }
  function vulnCell() { return el("td", { class: "c-v vuln-cell" }); }
  function paintVuln(td, s, p) {
    const v = vuln(s, p);
    td.textContent = v || "";
    const m = levelMeta(levelKeyFor(s, p));
    td.style.background = v ? m.color : "";
  }

  function traStepRow(step, idx) {
    const tr = el("tr");
    const inhV = vulnCell(), resV = vulnCell();
    const recalc = () => { paintVuln(inhV, step.inherentS, step.inherentP); paintVuln(resV, step.residualS, step.residualP); updateHrv(); };

    const typeSel = el("select", { class: "cell-in" });
    typeSel.appendChild(el("option", { value: "" }, [""]));
    META.controlTypes.forEach(t => typeSel.appendChild(el("option", { value: t, ...(step.controlType === t ? { selected: "selected" } : {}) }, [t])));
    typeSel.value = step.controlType || "";
    typeSel.addEventListener("change", () => { step.controlType = typeSel.value; });

    tr.appendChild(el("td", { class: "c-num" }, [String(idx + 1)]));
    tr.appendChild(el("td", null, [cellTa(step, "workStep")]));
    tr.appendChild(el("td", null, [cellTa(step, "hazards")]));
    tr.appendChild(el("td", { class: "c-sp" }, [scoreInput(step, "inherentS", recalc)]));
    tr.appendChild(el("td", { class: "c-sp" }, [scoreInput(step, "inherentP", recalc)]));
    tr.appendChild(inhV);
    tr.appendChild(el("td", null, [cellTa(step, "controlMeasures")]));
    tr.appendChild(el("td", null, [typeSel]));
    tr.appendChild(el("td", { class: "c-sp" }, [scoreInput(step, "residualS", recalc)]));
    tr.appendChild(el("td", { class: "c-sp" }, [scoreInput(step, "residualP", recalc)]));
    tr.appendChild(resV);
    tr.appendChild(el("td", null, [cellTa(step, "remarks")]));
    tr.appendChild(el("td", { class: "c-del noprint" }, [
      el("button", { class: "row-del", type: "button", title: "Remove",
        onClick: () => { curTra.steps = curTra.steps.filter(x => x !== step); renderTraSteps(); updateHrv(); } }, ["×"])
    ]));
    paintVuln(inhV, step.inherentS, step.inherentP);
    paintVuln(resV, step.residualS, step.residualP);
    return tr;
  }
  function renderTraSteps() {
    const tb = $("#tra-steps-body");
    tb.innerHTML = "";
    if (!curTra.steps.length) curTra.steps.push({});
    curTra.steps.forEach((s, i) => tb.appendChild(traStepRow(s, i)));
  }
  function auxRow(p, idx) {
    const tr = el("tr");
    const mk = key => { const i = el("input", { class: "cell-in" }); i.value = p[key] || ""; i.addEventListener("input", () => { p[key] = i.value; }); return el("td", null, [i]); };
    const dt = el("input", { class: "cell-in", type: "date" }); dt.value = p.date || ""; dt.addEventListener("input", () => { p.date = dt.value; });
    tr.appendChild(mk("role")); tr.appendChild(mk("name")); tr.appendChild(mk("designation")); tr.appendChild(mk("signature"));
    tr.appendChild(el("td", null, [dt]));
    tr.appendChild(el("td", { class: "c-del noprint" }, [
      el("button", { class: "row-del", type: "button", onClick: () => { curTra.parties.auxiliary.splice(idx, 1); renderAux(); } }, ["×"])]));
    return tr;
  }
  function renderAux() {
    const tb = $("#tra-aux-body");
    tb.innerHTML = "";
    curTra.parties.auxiliary = curTra.parties.auxiliary || [];
    if (!curTra.parties.auxiliary.length) curTra.parties.auxiliary.push({});
    curTra.parties.auxiliary.forEach((p, i) => tb.appendChild(auxRow(p, i)));
  }
  function updateHrv() {
    const h = hrvOf(curTra.steps);
    const cell = $("#hrv-cell");
    if (cell) { cell.textContent = h.value || "–"; cell.style.background = h.value ? h.color : ""; }
    const appr = $("#appr-hrv");
    if (appr) {
      appr.textContent = h.key ? h.label : "–";
      appr.style.background = h.key ? h.color : "";
      appr.title = h.authority ? "Approval authority: " + h.authority : "";
    }
  }

  function openTraEditor(id) {
    curTra = id ? JSON.parse(JSON.stringify(tras.find(t => t.id === id))) : blankTra();
    curTra.parties = curTra.parties || { facilitator: {}, contractorLead: {}, areaOwner: {}, auxiliary: [] };
    curTra.parties.facilitator = curTra.parties.facilitator || {};
    curTra.parties.contractorLead = curTra.parties.contractorLead || {};
    curTra.parties.areaOwner = curTra.parties.areaOwner || {};
    curTra.approver = curTra.approver || {};
    const isNew = !curTra.id;
    $("#tra-editor-title").textContent = isNew ? "New Task Risk Assessment" : "Edit Risk Assessment";
    $("#tra-editor-no").textContent = curTra.traRef || "TRA reference assigned on save";
    $("#tra-delete").classList.toggle("hidden", isNew);
    buildTraSheet();
    showView("tra-editor");
  }
  async function saveTra() {
    if (!curTra.workDescription || !curTra.workDescription.trim()) { toast("Work Description is required.", "err"); return; }
    curTra.steps = curTra.steps.filter(s => s.workStep || s.hazards || s.controlMeasures || s.remarks ||
      s.inherentS || s.inherentP || s.residualS || s.residualP || s.controlType);
    curTra.parties.auxiliary = (curTra.parties.auxiliary || []).filter(p => p.role || p.name || p.designation || p.signature || p.date);
    try {
      const saved = curTra.id ? await api("/tras/" + curTra.id, { method: "PUT", body: JSON.stringify(curTra) })
        : await api("/tras", { method: "POST", body: JSON.stringify(curTra) });
      await refresh(); toast("Saved " + (saved ? saved.traRef : "TRA") + ".", "ok");
      renderTraRegister(); showView("tras");
    } catch (e) { toast("Save failed: " + e.message, "err"); }
  }
  async function deleteTra() {
    if (!curTra || !curTra.id) return;
    const used = permits.find(p => p.traNo === curTra.traRef);
    if (used) { toast("Cannot delete: linked to permit " + used.ptwNo + ".", "err"); return; }
    if (!confirm("Delete " + curTra.traRef + "?")) return;
    try { await api("/tras/" + curTra.id, { method: "DELETE" }); await refresh(); toast("Deleted."); renderTraRegister(); showView("tras"); }
    catch (e) { toast("Delete failed: " + e.message, "err"); }
  }

  /* ========================================================
     PERMIT TO WORK — portrait form sheet
     ======================================================== */
  function blankPermit() { return { permitClass: "Scheduled", status: "Draft", clearances: {}, workDescription: "", permitReceiver: "" }; }

  function cls(val) { return `<label class="tick"><input type="checkbox" data-class="${val}"/> ${val}</label>`; }
  function ck(path, label) { return `<label class="tick"><input type="checkbox" data-k="${path}"/> ${label}</label>`; }
  function yn(path, opts) {
    const o = opts || ["Yes", "No"];
    return `<span class="yn">` + o.map(v =>
      `<label class="tick"><input type="radio" name="${path.replace(/\./g, '_')}" data-k="${path}" value="${v}"/> ${v}</label>`).join("") + `</span>`;
  }
  // labelled cell: small label above an input
  function lc(label, path, attrs) { return `<div class="mini-lbl">${label}</div>${inp(path, attrs)}`; }
  function lcTa(label, path) { return `<div class="mini-lbl">${label}</div>${txt(path)}`; }

  function buildPermitSheet() {
    const body = $("#permit-form-body");
    const traOpts = `<option value="">— select TRA —</option>` +
      tras.map(t => `<option value="${esc(t.traRef)}">${esc(t.traRef)} — ${esc(t.workDescription || "")}</option>`).join("");
    const statusOpts = META.permitStatuses.map(s => `<option value="${s}">${s}</option>`).join("");

    body.innerHTML = `
    <div class="sheet-scroll"><div class="sheet sheet-portrait" id="permit-sheet">
      <table class="ptw-top">
        <tr>
          <td class="title-cell" rowspan="3"><div class="sheet-title">PERMIT TO WORK</div>
            <div class="permit-class">${cls("Scheduled")}${cls("Emergency")}${cls("Outage")}</div></td>
          <td class="lbl">PTW No.:</td><td>${inp("ptwNo", "disabled")}</td></tr>
        <tr><td class="lbl">Work Order No.:</td><td>${inp("workOrderNo")}</td></tr>
        <tr><td class="lbl">TRA No.:</td><td><select class="cell-in" data-k="traNo">${traOpts}</select></td></tr>
        <tr><td class="lbl">Status:</td><td colspan="2"><select class="cell-in" data-k="status">${statusOpts}</select></td></tr>
      </table>
      <p class="ptw-note">Note: Put N/A if not applicable.</p>

      <div class="sec-bar">Section 1.0: APPLICATION — Work Description (Permit Receiver)</div>
      <table class="ptw">
        <tr><td colspan="4">${lcTa("Work to be performed / description", "workDescription")}</td></tr>
        <tr>
          <td>${lc("Date of Application", "dateOfApplication", 'type="date"')}</td>
          <td>${lc("Time of Application", "timeOfApplication", 'type="time"')}</td>
          <td>${lc("Equipment to work on", "equipmentToWorkOn")}</td>
          <td>${lc("Name of Permit Receiver", "permitReceiver")}</td></tr>
        <tr>
          <td>${lc("Contact Number", "contactNumber")}</td>
          <td>${lc("Area, Location, or Site", "areaLocation")}</td>
          <td>${lc("Work Party", "workParty")}</td>
          <td>${lc("Engine Status (N/A if n.a.)", "engineStatus")}</td></tr>
        <tr>
          <td>${lc("Master PTW No. (Outage)", "masterPtwNo")}</td>
          <td>New installation? ${yn("newInstallation")}</td>
          <td>Modification affecting process/etc.? ${yn("modification")}</td>
          <td>${lc("MOC Ref. No. (or N/A)", "mocRef")}</td></tr>
      </table>

      <div class="sec-bar">Section 2.0: GAS TESTING (Permit Issuer &amp; Gas Tester)</div>
      <table class="ptw">
        <tr>
          <td>Gas testing required? ${yn("gasTestingRequired")}</td>
          <td colspan="2">${lc("Gas Tester Name &amp; Signature", "gasTesterName")}</td>
          <td>${lc("Gas Monitoring Log No.", "gasMonitoringLogNo")}</td></tr>
        <tr>
          <td>${lc("%O2 (19.5–23.5%)", "o2")}</td>
          <td>${lc("H2S (0 ppm)", "h2s")}</td>
          <td>${lc("LEL (0%)", "lel")}</td>
          <td>${lc("CO (0 ppm)", "co")}</td></tr>
        <tr><td colspan="4">${lc("Other Gases", "otherGases")}</td></tr>
      </table>

      <div class="sec-bar">Section 3.0: CLEARANCES &amp; SPECIAL MEASURES (Permit Issuer)</div>
      <table class="ptw">
        <tr><td colspan="4" class="clears">${META.clearances.map(c => ck("clearances." + c.key, c.label)).join("")}</td></tr>
        <tr>
          <td colspan="2">${lc("Others (specify)", "othersSpecify")}</td>
          <td colspan="2">${lc("Affected Areas", "affectedAreas")}</td></tr>
        <tr><td colspan="4">${lcTa("Protective Safety System Impairment — equipment &amp; description", "impairmentDescription")}</td></tr>
        <tr><td colspan="4">${lcTa("Special measures / requirements (indicate N/A if none)", "specialMeasures")}</td></tr>
      </table>

      <div class="sec-bar">Section 4.0: LOCK-OUT, TAG-OUT (Isolation Officer)</div>
      <table class="ptw">
        <tr><td>${lc("Electrical Isolation — Officer", "electricalIsolationOfficer")}</td>
          <td>${lc("Date", "electricalIsolationDate", 'type="date"')}</td>
          <td>${lc("Time", "electricalIsolationTime", 'type="time"')}</td>
          <td rowspan="3">${lcTa("Special Measures for Isolation", "isolationSpecialMeasures")}</td></tr>
        <tr><td>${lc("Mechanical Isolation — Officer", "mechanicalIsolationOfficer")}</td>
          <td>${lc("Date", "mechanicalIsolationDate", 'type="date"')}</td>
          <td>${lc("Time", "mechanicalIsolationTime", 'type="time"')}</td></tr>
        <tr><td>${lc("Zero Energy Test — Officer", "zeroEnergyTestOfficer")}</td>
          <td>${lc("Date", "zeroEnergyTestDate", 'type="date"')}</td>
          <td>${lc("Time", "zeroEnergyTestTime", 'type="time"')}</td></tr>
      </table>

      <div class="sec-bar">Section 5.0: COMMENCEMENT OF WORK (Permit Issuer)</div>
      <table class="ptw">
        <tr><td>${lc("Initial work duration", "initialWorkDuration")}</td>
          <td>${lc("Date of work Release", "dateOfRelease", 'type="date"')}</td>
          <td>${lc("Time of work Release", "timeOfRelease", 'type="time"')}</td>
          <td>${lc("Permit Issuer", "permitIssuer")}</td></tr>
        <tr><td>${lc("Date of Work Expiry", "dateOfExpiry", 'type="date"')}</td>
          <td>${lc("Time of Work Expiry", "timeOfExpiry", 'type="time"')}</td>
          <td>${lc("Extension duration (if needed)", "extensionDuration")}</td>
          <td>${lc("2nd Work Expiry Date", "secondExpiryDate", 'type="date"')}</td></tr>
        <tr><td colspan="4">${lc("Reason for extension", "reasonForExtension")}</td></tr>
      </table>

      <div class="sec-bar">Section 6.0: PERMIT CANCELLATION &amp; SUSPENSION (Permit Issuer &amp; Receiver)</div>
      <table class="ptw">
        <tr><td>${lc("Cancellation reason", "cancellationReason")}</td>
          <td>${lc("Cancellation Date", "cancellationDate", 'type="date"')}</td>
          <td>${lc("Time", "cancellationTime", 'type="time"')}</td>
          <td>${lc("Permit Issuer", "cancellationIssuer")}</td></tr>
        <tr><td>${lc("Suspension reason", "suspensionReason")}</td>
          <td>${lc("Suspension Date", "suspensionDate", 'type="date"')}</td>
          <td>${lc("Time", "suspensionTime", 'type="time"')}</td>
          <td>${lc("Resumption Date", "resumptionDate", 'type="date"')}</td></tr>
        <tr><td colspan="4">${lc("Reason for cancellation or suspension", "cancelSuspendNotes")}</td></tr>
      </table>

      <div class="sec-bar">Section 7.0: WORKSITE TURN OVER (Permit Receiver)</div>
      <table class="ptw">
        <tr><td>Modifications/substitutions made? ${yn("modificationsMade")}</td>
          <td>Work is Completed? ${yn("workCompleted")}</td>
          <td>${lc("Permit Receiver", "turnoverReceiver")}</td>
          <td>${lc("Date", "turnoverDate", 'type="date"')}</td></tr>
        <tr><td colspan="4">${lcTa("State modifications made", "modificationsDesc")}</td></tr>
      </table>

      <div class="sec-bar">Section 8.0: WORKSITE TURNOVER REVIEW (Permit Issuer)</div>
      <table class="ptw">
        <tr><td>EMOC required? ${yn("emocRequired", ["Yes", "No", "N/A"])}</td>
          <td>De-isolation implemented? ${yn("deisolationImplemented", ["Yes", "No", "N/A"])}</td>
          <td>Special measures relieved? ${yn("specialMeasuresRelieved", ["Yes", "No", "N/A"])}</td></tr>
        <tr><td colspan="3">${lcTa("Actions if EMOC is required", "emocActions")}</td></tr>
      </table>

      <div class="sec-bar">Section 9.0: RESTORATION TO OPERATIONAL READINESS (Permit Issuer)</div>
      <table class="ptw">
        <tr><td>Functional checks made &amp; equipment restored? ${yn("functionalChecks")}</td>
          <td colspan="3">${lcTa("If NO, state actions to be done", "restorationActions")}</td></tr>
      </table>

      <div class="sec-bar">Section 10.0: CLOSEOUT (Permit Issuer)</div>
      <table class="ptw">
        <tr><td>${lc("Name", "closeoutName")}</td><td>${lc("Signature", "closeoutSignature")}</td>
          <td>${lc("Date", "closeoutDate", 'type="date"')}</td><td>${lc("Time", "closeoutTime", 'type="time"')}</td></tr>
      </table>
    </div></div>`;

    // permit class tick boxes are exclusive — wire manually
    const refIn = $('[data-k="ptwNo"]', body); if (refIn) refIn.value = curPermit.ptwNo || "";
    bindSheet(body, curPermit);
    $('[data-k="status"]', body).value = curPermit.status || "Draft";
    $('[data-k="traNo"]', body).value = curPermit.traNo || "";
    $$('[data-class]', body).forEach(cb => {
      const v = cb.getAttribute("data-class");
      cb.checked = curPermit.permitClass === v;
      cb.addEventListener("change", () => {
        curPermit.permitClass = cb.checked ? v : "";
        $$('[data-class]', body).forEach(ob => { if (ob !== cb) ob.checked = false; });
      });
    });
  }

  function openPermitEditor(id) {
    curPermit = id ? JSON.parse(JSON.stringify(permits.find(p => p.id === id))) : blankPermit();
    curPermit.clearances = curPermit.clearances || {};
    const isNew = !curPermit.id;
    $("#permit-editor-title").textContent = isNew ? "New Permit to Work" : "Edit Permit";
    $("#permit-editor-no").textContent = curPermit.ptwNo || "Permit number assigned on save";
    $("#permit-delete").classList.toggle("hidden", isNew);
    buildPermitSheet();
    showView("permit-editor");
  }
  async function savePermit() {
    if (!curPermit.workDescription || !curPermit.workDescription.trim()) { toast("Work Description is required.", "err"); return; }
    if (!curPermit.permitReceiver || !curPermit.permitReceiver.trim()) { toast("Permit Receiver is required.", "err"); return; }
    try {
      const saved = curPermit.id ? await api("/permits/" + curPermit.id, { method: "PUT", body: JSON.stringify(curPermit) })
        : await api("/permits", { method: "POST", body: JSON.stringify(curPermit) });
      await refresh(); toast("Saved " + (saved ? saved.ptwNo : "permit") + ".", "ok");
      renderPermitRegister(); showView("permits");
    } catch (e) { toast("Save failed: " + e.message, "err"); }
  }
  async function deletePermit() {
    if (!curPermit || !curPermit.id) return;
    if (!confirm("Delete " + curPermit.ptwNo + "?")) return;
    try { await api("/permits/" + curPermit.id, { method: "DELETE" }); await refresh(); toast("Deleted."); renderPermitRegister(); showView("permits"); }
    catch (e) { toast("Delete failed: " + e.message, "err"); }
  }

  /* ========================================================
     Registers
     ======================================================== */
  function statTile(n, label) { return el("div", { class: "stat" }, [el("div", { class: "n" }, [String(n)]), el("div", { class: "l" }, [label])]); }
  function riskBadge(v, levelKey) {
    const m = levelMeta(levelKey || "");
    const b = el("span", { class: "risk-badge" }, [v ? v + " " + m.label : "–"]);
    if (levelKey) { b.style.background = m.color; b.style.color = "#1a1a1a"; }
    return b;
  }

  function renderPermitRegister() {
    const fS = $("#permit-filter-status"); if (fS.children.length <= 1) META.permitStatuses.forEach(s => fS.appendChild(el("option", null, [s])));
    const fC = $("#permit-filter-class"); if (fC.children.length <= 1) META.permitClasses.forEach(c => fC.appendChild(el("option", null, [c])));
    const stats = $("#permit-stats"); stats.innerHTML = "";
    const by = s => permits.filter(p => p.status === s).length;
    stats.appendChild(statTile(permits.length, "Total"));
    stats.appendChild(statTile(by("Active"), "Active"));
    stats.appendChild(statTile(by("Submitted"), "Awaiting approval"));
    stats.appendChild(statTile(by("Suspended"), "Suspended"));
    renderPermitRows();
  }
  function renderPermitRows() {
    const q = $("#permit-search").value.trim().toLowerCase();
    const fs = $("#permit-filter-status").value, fc = $("#permit-filter-class").value;
    const rows = permits.filter(p => !fs || p.status === fs).filter(p => !fc || p.permitClass === fc)
      .filter(p => !q || [p.ptwNo, p.workDescription, p.areaLocation, p.permitReceiver, p.traNo].some(v => (v || "").toLowerCase().includes(q)));
    const tb = $("#permit-tbody"); tb.innerHTML = "";
    $("#permit-empty").classList.toggle("hidden", rows.length > 0);
    rows.forEach(p => tb.appendChild(el("tr", { class: "clickable", onClick: () => openPermitEditor(p.id) }, [
      el("td", null, [p.ptwNo || "–"]), el("td", null, [p.workDescription || "(untitled)"]),
      el("td", null, [p.permitClass || "–"]), el("td", null, [p.areaLocation || "–"]),
      el("td", null, [p.traNo || "–"]), el("td", { class: "small muted" }, [fmtDate(p.dateOfExpiry)]),
      el("td", null, [el("span", { class: "pill " + (p.status || "Draft") }, [p.status || "Draft"])]),
      el("td", null, [el("button", { class: "btn ghost small", onClick: e => { e.stopPropagation(); openPermitEditor(p.id); } }, ["Open"])])
    ])));
  }
  function renderTraRegister() {
    const fL = $("#tra-filter-level"); if (fL.children.length <= 1) META.levelOrder.forEach(k => fL.appendChild(el("option", { value: META.levels[k].label }, [META.levels[k].label])));
    const stats = $("#tra-stats"); stats.innerHTML = "";
    const c = key => tras.filter(t => t.hrv && t.hrv.level === key).length;
    stats.appendChild(statTile(tras.length, "Total"));
    stats.appendChild(statTile(c("high") + c("critical"), "High / Critical"));
    stats.appendChild(statTile(c("moderate"), "Moderate"));
    stats.appendChild(statTile(c("low"), "Low"));
    renderTraRows();
  }
  function renderTraRows() {
    const q = $("#tra-search").value.trim().toLowerCase(), fl = $("#tra-filter-level").value;
    const rows = tras.filter(t => !fl || (t.hrv && t.hrv.label === fl))
      .filter(t => !q || [t.traRef, t.workDescription, t.equipment, t.location].some(v => (v || "").toLowerCase().includes(q)));
    const tb = $("#tra-tbody"); tb.innerHTML = "";
    $("#tra-empty").classList.toggle("hidden", rows.length > 0);
    rows.forEach(t => tb.appendChild(el("tr", { class: "clickable", onClick: () => openTraEditor(t.id) }, [
      el("td", null, [t.traRef || "–"]), el("td", null, [t.workDescription || "(untitled)"]),
      el("td", null, [t.equipment || "–"]), el("td", null, [t.location || "–"]),
      el("td", { class: "muted" }, [String((t.steps || []).length)]),
      el("td", null, [riskBadge(t.hrv ? t.hrv.value : 0, t.hrv ? t.hrv.level : "")]),
      el("td", null, [el("button", { class: "btn ghost small", onClick: e => { e.stopPropagation(); openTraEditor(t.id); } }, ["Open"])])
    ])));
  }

  /* ========================================================
     Wire up
     ======================================================== */
  async function init() {
    try { META = (await api("/meta")) || META; } catch { /* fallback */ }
    await refresh();
    renderPermitRegister();
    renderTraRegister();

    document.addEventListener("click", e => {
      const nav = e.target.closest(".nav-btn");
      if (nav) { showView(nav.dataset.view); return; }
      const a = e.target.closest("[data-action]");
      if (!a) return;
      switch (a.dataset.action) {
        case "new-permit": openPermitEditor(null); break;
        case "save-permit": savePermit(); break;
        case "cancel-permit": renderPermitRegister(); showView("permits"); break;
        case "delete-permit": deletePermit(); break;
        case "print-permit": window.print(); break;
        case "new-tra": openTraEditor(null); break;
        case "save-tra": saveTra(); break;
        case "cancel-tra": renderTraRegister(); showView("tras"); break;
        case "delete-tra": deleteTra(); break;
        case "print-tra": window.print(); break;
        case "add-step": curTra.steps.push({}); renderTraSteps(); updateHrv(); break;
        case "add-aux": curTra.parties.auxiliary.push({}); renderAux(); break;
      }
    });

    $("#permit-search").addEventListener("input", renderPermitRows);
    $("#permit-filter-status").addEventListener("change", renderPermitRows);
    $("#permit-filter-class").addEventListener("change", renderPermitRows);
    $("#tra-search").addEventListener("input", renderTraRows);
    $("#tra-filter-level").addEventListener("change", renderTraRows);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
