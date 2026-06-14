/* Permit to Work & Task Risk Assessment — frontend SPA.
 * Modelled on the PTW and TRA forms. Talks to the backend REST API. */
(function () {
  "use strict";

  const API = (window.PTW_API_BASE || "http://localhost:4000") + "/api";

  /* ---------- Fallback domain model (overridden by /api/meta) ---------- */
  let META = {
    riskLevels: [
      { key: "low", label: "Low", min: 1, max: 4, color: "#30a46c", authority: "Operations Superintendent / Supervisor" },
      { key: "moderate", label: "Moderate", min: 5, max: 9, color: "#d9a514", authority: "Operations Head" },
      { key: "high", label: "High", min: 10, max: 14, color: "#e8801c", authority: "Facility Head" },
      { key: "critical", label: "Critical", min: 15, max: 25, color: "#e5484d", authority: "Regional O&M Head" }
    ],
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

  function levelFor(v) {
    const s = Number(v) || 0;
    if (s <= 0) return { key: "", label: "–", color: "#2a3547", authority: "" };
    return META.riskLevels.find(l => s >= l.min && s <= l.max) || META.riskLevels[META.riskLevels.length - 1];
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

  /* ---------- API client ---------- */
  async function api(path, options) {
    const res = await fetch(API + path, { headers: { "Content-Type": "application/json" }, ...options });
    if (res.status === 204) return null;
    let body = null;
    try { body = await res.json(); } catch { /* none */ }
    if (!res.ok) {
      const msg = (body && (body.details ? body.details.join("; ") : body.error)) || ("HTTP " + res.status);
      throw new Error(msg);
    }
    return body;
  }

  /* ---------- App state ---------- */
  let permits = [];
  let tras = [];
  let curPermit = null;
  let curTra = null;

  async function refresh() {
    try {
      [permits, tras] = await Promise.all([api("/permits"), api("/tras")]);
      return true;
    } catch (e) {
      toast("Cannot reach API: " + e.message, "err");
      return false;
    }
  }

  /* ---------- Navigation ---------- */
  function showView(name) {
    $$(".view").forEach(v => v.classList.remove("active"));
    $("#view-" + name).classList.add("active");
    const top = name.startsWith("permit") ? "permits" : name.startsWith("tra") ? "tras" : name;
    $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === top));
    window.scrollTo(0, 0);
  }

  /* ========================================================
     Generic schema-driven form controls
     ======================================================== */
  function controlEl(def, value, onInput) {
    const t = def.type || "text";
    let node;
    if (t === "textarea") {
      node = el("textarea", { rows: def.rows || 2 });
      node.value = value || "";
      node.addEventListener("input", () => onInput(node.value));
    } else if (t === "select") {
      node = el("select");
      node.appendChild(el("option", { value: "" }, [def.placeholder || "Select…"]));
      (def.options || []).forEach(o => {
        const v = typeof o === "object" ? o.value : o;
        const lbl = typeof o === "object" ? o.label : o;
        node.appendChild(el("option", { value: v }, [lbl]));
      });
      node.value = value || "";
      node.addEventListener("change", () => onInput(node.value));
    } else if (t === "radio") {
      node = el("div", { class: "radio-group" });
      (def.options || ["Yes", "No"]).forEach(o => {
        const lab = el("label", { class: "radio" + (value === o ? " on" : "") }, [
          el("input", { type: "radio", name: def.key + "_" + Math.random().toString(36).slice(2, 6) }), o
        ]);
        const inp = lab.querySelector("input");
        inp.checked = value === o;
        inp.addEventListener("change", () => {
          onInput(o);
          $$(".radio", node).forEach(c => c.classList.remove("on"));
          lab.classList.add("on");
        });
        node.appendChild(lab);
      });
    } else {
      node = el("input", { type: t });
      node.value = value == null ? "" : value;
      node.addEventListener("input", () => onInput(node.value));
    }
    return node;
  }

  // Render one labelled field bound to state[def.key].
  function field(def, state, after) {
    const wrap = el("label", { class: def.full ? "full" : "" });
    const head = el("span", { class: "field-label" }, [def.label || def.key]);
    if (def.hint) head.appendChild(el("span", { class: "hint" }, [" " + def.hint]));
    wrap.appendChild(head);
    wrap.appendChild(controlEl(def, state[def.key], v => { state[def.key] = v; if (after) after(); }));
    return wrap;
  }

  function sectionCard(title, fieldsOrNode, state, after) {
    const fs = el("fieldset", { class: "card" });
    fs.appendChild(el("legend", null, [title]));
    if (Array.isArray(fieldsOrNode)) {
      const grid = el("div", { class: "grid" });
      fieldsOrNode.forEach(def => grid.appendChild(field(def, state, after)));
      fs.appendChild(grid);
    } else if (fieldsOrNode) {
      fs.appendChild(fieldsOrNode);
    }
    return fs;
  }

  const YN = ["Yes", "No"];
  const YNNA = ["Yes", "No", "N/A"];

  /* ========================================================
     TASK RISK ASSESSMENT (TRA) editor
     ======================================================== */
  const TRA_HEADER = [
    { key: "workDescription", label: "Work Description", type: "textarea", full: true },
    { key: "woSwmsNo", label: "WO / SWMS No." },
    { key: "equipment", label: "Equipment Involved" },
    { key: "location", label: "Location" },
    { key: "datePrepared", label: "Date Prepared", type: "date" },
    { key: "contractor", label: "Contractor" },
    { key: "workSponsor", label: "Work Sponsor" },
    { key: "deptInCharge", label: "Department In-charge" }
  ];
  const PERSON_FIELDS = [
    { key: "name", label: "Name" },
    { key: "designation", label: "Designation - Dep't." },
    { key: "signature", label: "Signature" },
    { key: "date", label: "Date", type: "date" }
  ];

  function blankTra() {
    return {
      workDescription: "", woSwmsNo: "", equipment: "", location: "", datePrepared: "",
      contractor: "", workSponsor: "", deptInCharge: "",
      steps: [], parties: { facilitator: {}, contractorLead: {}, areaOwner: {}, auxiliary: [] },
      approver: {}
    };
  }

  function vuln(s, p) { return (parseInt(s, 10) || 0) * (parseInt(p, 10) || 0); }

  function traHrv() {
    const vals = (curTra.steps || []).map(s => vuln(s.residualS, s.residualP));
    return vals.length ? Math.max(...vals) : 0;
  }

  function riskBadge(v) {
    const lv = levelFor(v);
    const b = el("span", { class: "risk-badge" }, [v ? v + " " + lv.label : "–"]);
    if (lv.key) { b.style.background = lv.color; b.style.color = "#0c1018"; }
    return b;
  }

  function traStepRow(step, idx) {
    const tr = el("tr");
    tr.appendChild(el("td", { class: "muted" }, [String(idx + 1)]));

    const ta = (key, ph) => {
      const td = el("td");
      const t = el("textarea", { rows: 2, placeholder: ph || "" });
      t.value = step[key] || "";
      t.addEventListener("input", () => { step[key] = t.value; });
      td.appendChild(t); return td;
    };
    const scoreCell = (key) => {
      const td = el("td", { class: "score-cell" });
      const inp = el("input", { type: "number", min: 1, max: 5 });
      inp.value = step[key] || "";
      inp.addEventListener("input", () => {
        let v = parseInt(inp.value, 10);
        v = isNaN(v) ? "" : Math.max(1, Math.min(5, v));
        inp.value = v; step[key] = v;
        recalc(); updateTraHrv();
      });
      td.appendChild(inp); return td;
    };
    const vIn = el("td", { class: "ra-cell-risk" });
    const vRes = el("td", { class: "ra-cell-risk" });
    function recalc() {
      vIn.innerHTML = ""; vRes.innerHTML = "";
      vIn.appendChild(riskBadge(vuln(step.inherentS, step.inherentP)));
      vRes.appendChild(riskBadge(vuln(step.residualS, step.residualP)));
    }
    const typeTd = el("td");
    const sel = controlEl({ type: "select", options: META.controlTypes, placeholder: "Type…" },
      step.controlType, v => { step.controlType = v; });
    typeTd.appendChild(sel);

    const delTd = el("td", null, [
      el("button", { class: "row-del", type: "button", title: "Remove", onClick: () => {
        curTra.steps = curTra.steps.filter(x => x !== step);
        renderTraSteps(); updateTraHrv();
      } }, ["×"])
    ]);

    tr.appendChild(ta("workStep", "Work step description"));
    tr.appendChild(ta("hazards", "Cause and effect"));
    tr.appendChild(scoreCell("inherentS"));
    tr.appendChild(scoreCell("inherentP"));
    tr.appendChild(vIn);
    tr.appendChild(ta("controlMeasures", "Be specific"));
    tr.appendChild(typeTd);
    tr.appendChild(scoreCell("residualS"));
    tr.appendChild(scoreCell("residualP"));
    tr.appendChild(vRes);
    tr.appendChild(ta("remarks"));
    tr.appendChild(delTd);
    recalc();
    return tr;
  }

  function renderTraSteps() {
    const tb = $("#tra-steps-body");
    tb.innerHTML = "";
    if (!curTra.steps.length) curTra.steps.push({});
    curTra.steps.forEach((s, i) => tb.appendChild(traStepRow(s, i)));
  }

  function updateTraHrv() {
    const v = traHrv();
    const lv = levelFor(v);
    const box = $("#tra-hrv");
    box.innerHTML = "";
    const badge = riskBadge(v);
    box.appendChild(el("div", null, [el("span", { class: "muted small" }, ["Highest Residual Vulnerability (HRV) "]), badge]));
    box.appendChild(el("div", { class: "muted small" }, ["Risk level: ", el("b", null, [lv.label || "–"])]));
    box.appendChild(el("div", { class: "muted small" }, ["Approval authority: ", el("b", null, [lv.authority || "–"])]));
  }

  function personCard(title, obj, withRole) {
    const fs = el("fieldset", { class: "card sub" });
    fs.appendChild(el("legend", null, [title]));
    const grid = el("div", { class: "grid party-grid" });
    const fields = withRole ? [{ key: "role", label: "Role" }, ...PERSON_FIELDS] : PERSON_FIELDS;
    fields.forEach(f => grid.appendChild(field(f, obj)));
    fs.appendChild(grid);
    return fs;
  }

  function buildTraForm() {
    const body = $("#tra-form-body");
    body.innerHTML = "";
    body.appendChild(sectionCard("Task Details", TRA_HEADER, curTra));

    // Risk assessment steps
    const raCard = el("fieldset", { class: "card" });
    raCard.appendChild(el("legend", null, ["Risk Assessment"]));
    raCard.appendChild(el("p", { class: "muted small" }, [
      "Severity (S) × Probability (P) = Vulnerability (V), each scored 1–5. Score the inherent risk, add controls, then the residual risk."
    ]));
    const wrap = el("div", { class: "table-wrap" });
    const table = el("table", { class: "ra-table" });
    table.innerHTML = `<thead><tr>
      <th>#</th><th>Work Step</th><th>Hazard(s)</th>
      <th title="Inherent Severity">S</th><th title="Inherent Probability">P</th><th>V</th>
      <th>Control Measures</th><th>Type of Control</th>
      <th title="Residual Severity">S</th><th title="Residual Probability">P</th><th>V</th>
      <th>Remarks</th><th></th></tr></thead><tbody id="tra-steps-body"></tbody>`;
    wrap.appendChild(table);
    raCard.appendChild(wrap);
    raCard.appendChild(el("button", { class: "btn ghost small", type: "button",
      onClick: () => { curTra.steps.push({}); renderTraSteps(); } }, ["+ Add work step"]));
    raCard.appendChild(el("div", { id: "tra-hrv", class: "hrv-box" }));
    body.appendChild(raCard);

    // Parties
    const parties = el("fieldset", { class: "card" });
    parties.appendChild(el("legend", null, ["TRA Creation — Essential Parties"]));
    curTra.parties = curTra.parties || {};
    curTra.parties.facilitator = curTra.parties.facilitator || {};
    curTra.parties.contractorLead = curTra.parties.contractorLead || {};
    curTra.parties.areaOwner = curTra.parties.areaOwner || {};
    curTra.parties.auxiliary = curTra.parties.auxiliary || [];
    parties.appendChild(personCard("Facilitator (MNT / FSM / SEC / SHE)", curTra.parties.facilitator));
    parties.appendChild(personCard("Contractor Lead (when applicable)", curTra.parties.contractorLead));
    parties.appendChild(personCard("Area Owner / Operations Representative", curTra.parties.areaOwner));

    const auxWrap = el("div", { id: "tra-aux" });
    parties.appendChild(el("h4", { class: "sub-head" }, ["Auxiliary Parties"]));
    parties.appendChild(auxWrap);
    parties.appendChild(el("button", { class: "btn ghost small", type: "button",
      onClick: () => { curTra.parties.auxiliary.push({}); renderAux(); } }, ["+ Add auxiliary party"]));
    body.appendChild(parties);

    // Approver
    const appr = el("fieldset", { class: "card" });
    appr.appendChild(el("legend", null, ["TRA Approved By"]));
    appr.appendChild(el("p", { class: "muted small", id: "tra-appr-note" }, []));
    curTra.approver = curTra.approver || {};
    const ag = el("div", { class: "grid party-grid" });
    PERSON_FIELDS.forEach(f => ag.appendChild(field(f, curTra.approver)));
    appr.appendChild(ag);
    body.appendChild(appr);

    renderTraSteps();
    renderAux();
    updateTraHrv();
    updateApprNote();
  }

  function updateApprNote() {
    const lv = levelFor(traHrv());
    $("#tra-appr-note").textContent = lv.authority
      ? `Based on the HRV (${lv.label}), this TRA should be approved by: ${lv.authority}.`
      : "Add residual scores to determine the required approval authority.";
  }

  function renderAux() {
    const wrap = $("#tra-aux");
    wrap.innerHTML = "";
    curTra.parties.auxiliary.forEach((p, i) => {
      const card = personCard("Auxiliary Party " + (i + 1), p, true);
      card.appendChild(el("button", { class: "btn ghost small", type: "button",
        onClick: () => { curTra.parties.auxiliary.splice(i, 1); renderAux(); } }, ["Remove"]));
      wrap.appendChild(card);
    });
  }

  function openTraEditor(id) {
    curTra = id ? JSON.parse(JSON.stringify(tras.find(t => t.id === id))) : blankTra();
    const isNew = !curTra.id;
    $("#tra-editor-title").textContent = isNew ? "New Task Risk Assessment" : "Edit Risk Assessment";
    $("#tra-editor-no").textContent = curTra.traRef || "TRA reference assigned on save";
    $("#tra-delete").classList.toggle("hidden", isNew);
    buildTraForm();
    // recompute approver note whenever residual scores change
    $("#tra-steps-body").addEventListener("input", updateApprNote);
    showView("tra-editor");
  }

  async function saveTra() {
    if (!curTra.workDescription || !curTra.workDescription.trim()) {
      toast("Work Description is required.", "err"); return;
    }
    curTra.steps = curTra.steps.filter(s =>
      s.workStep || s.hazards || s.controlMeasures || s.remarks ||
      s.inherentS || s.inherentP || s.residualS || s.residualP || s.controlType);
    try {
      const saved = curTra.id ? await api("/tras/" + curTra.id, { method: "PUT", body: JSON.stringify(curTra) })
        : await api("/tras", { method: "POST", body: JSON.stringify(curTra) });
      await refresh();
      toast("Saved " + (saved ? saved.traRef : "TRA") + ".", "ok");
      renderTraRegister(); showView("tras");
    } catch (e) { toast("Save failed: " + e.message, "err"); }
  }

  async function deleteTra() {
    if (!curTra || !curTra.id) return;
    const used = permits.find(p => p.traNo === curTra.traRef);
    if (used) { toast("Cannot delete: linked to permit " + used.ptwNo + ".", "err"); return; }
    if (!confirm("Delete " + curTra.traRef + "?")) return;
    try {
      await api("/tras/" + curTra.id, { method: "DELETE" });
      await refresh();
      toast("Risk assessment deleted.");
      renderTraRegister(); showView("tras");
    } catch (e) { toast("Delete failed: " + e.message, "err"); }
  }

  /* ========================================================
     PERMIT TO WORK (PTW) editor
     ======================================================== */
  function permitSchema() {
    return [
      { title: "Permit", fields: [
        { key: "permitClass", label: "Permit Class", type: "radio", options: META.permitClasses },
        { key: "status", label: "Status", type: "select", options: META.permitStatuses },
        { key: "workOrderNo", label: "Work Order No." },
        { key: "traNo", label: "TRA No.", type: "select", options: tras.map(t => t.traRef) }
      ]},
      { title: "Section 1.0 — Application", fields: [
        { key: "workDescription", label: "Work Description", type: "textarea", full: true },
        { key: "dateOfApplication", label: "Date of Application", type: "date" },
        { key: "timeOfApplication", label: "Time of Application", type: "time" },
        { key: "equipmentToWorkOn", label: "Equipment to work on" },
        { key: "permitReceiver", label: "Name of Permit Receiver" },
        { key: "contactNumber", label: "Contact Number" },
        { key: "areaLocation", label: "Area, Location, or Site" },
        { key: "workParty", label: "Work Party" },
        { key: "engineStatus", label: "Engine Status", hint: "(N/A if not applicable)" },
        { key: "masterPtwNo", label: "Master PTW No. (Outage)", hint: "(N/A if not applicable)" },
        { key: "workToBePerformed", label: "Work to be performed", type: "textarea", full: true },
        { key: "newInstallation", label: "New installation in the facility?", type: "radio", options: YN },
        { key: "modification", label: "Modification affecting process/capacity/etc.?", type: "radio", options: YN },
        { key: "mocRef", label: "MOC Ref. No.", hint: "(or N/A)" }
      ]},
      { title: "Section 2.0 — Gas Testing", fields: [
        { key: "gasTestingRequired", label: "Gas testing required?", type: "radio", options: YN },
        { key: "gasTesterName", label: "Gas Tester Name & Signature" },
        { key: "gasMonitoringLogNo", label: "Gas Monitoring Log No." },
        { key: "o2", label: "%O2", hint: "(19.5% – 23.5%)" },
        { key: "h2s", label: "H2S", hint: "(0 ppm)" },
        { key: "lel", label: "LEL", hint: "(0%)" },
        { key: "co", label: "CO", hint: "(0 ppm)" },
        { key: "otherGases", label: "Other Gases" }
      ]},
      { title: "Section 3.0 — Clearances & Special Measures", clearances: true, fields: [
        { key: "othersSpecify", label: "Others (specify)" },
        { key: "impairmentDescription", label: "Protective system impairment — equipment & description", type: "textarea", full: true },
        { key: "affectedAreas", label: "Affected Areas" },
        { key: "specialMeasures", label: "Special measures / requirements", type: "textarea", full: true }
      ]},
      { title: "Section 4.0 — Lock-out, Tag-out", fields: [
        { key: "electricalIsolationOfficer", label: "Electrical Isolation — Officer" },
        { key: "electricalIsolationDate", label: "Date", type: "date" },
        { key: "electricalIsolationTime", label: "Time", type: "time" },
        { key: "mechanicalIsolationOfficer", label: "Mechanical Isolation — Officer" },
        { key: "mechanicalIsolationDate", label: "Date", type: "date" },
        { key: "mechanicalIsolationTime", label: "Time", type: "time" },
        { key: "zeroEnergyTestOfficer", label: "Zero Energy Test — Officer" },
        { key: "zeroEnergyTestDate", label: "Date", type: "date" },
        { key: "zeroEnergyTestTime", label: "Time", type: "time" },
        { key: "isolationSpecialMeasures", label: "Special measures for isolation", type: "textarea", full: true }
      ]},
      { title: "Section 5.0 — Commencement of Work", fields: [
        { key: "initialWorkDuration", label: "Initial work duration" },
        { key: "dateOfRelease", label: "Date of work Release", type: "date" },
        { key: "timeOfRelease", label: "Time of work Release", type: "time" },
        { key: "dateOfExpiry", label: "Date of Work Expiry", type: "date" },
        { key: "timeOfExpiry", label: "Time of Work Expiry", type: "time" },
        { key: "permitIssuer", label: "Permit Issuer" },
        { key: "extensionDuration", label: "Extension duration (if needed)" },
        { key: "secondExpiryDate", label: "2nd Work Expiry Date", type: "date" },
        { key: "secondExpiryTime", label: "Time of work expiry", type: "time" },
        { key: "reasonForExtension", label: "Reason for extension", type: "textarea", full: true }
      ]},
      { title: "Section 6.0 — Cancellation & Suspension", fields: [
        { key: "cancellationReason", label: "Cancellation", type: "select",
          options: ["Major incident occurred", "Major work scope change", "Work not completed w/in duration"] },
        { key: "cancellationDate", label: "Cancellation Date", type: "date" },
        { key: "cancellationTime", label: "Time", type: "time" },
        { key: "suspensionReason", label: "Suspension", type: "select",
          options: ["Minor incident occurred", "Unavailability of supplies", "New potential threat"] },
        { key: "suspensionDate", label: "Suspension Date", type: "date" },
        { key: "suspensionTime", label: "Time", type: "time" },
        { key: "resumptionDate", label: "Resumption Date", type: "date" },
        { key: "resumptionTime", label: "Time", type: "time" },
        { key: "cancelSuspendNotes", label: "Reason for cancellation or suspension", type: "textarea", full: true }
      ]},
      { title: "Section 7.0 — Worksite Turn Over", fields: [
        { key: "modificationsMade", label: "Modifications/substitutions made?", type: "radio", options: YN },
        { key: "modificationsDesc", label: "State modifications made", type: "textarea", full: true },
        { key: "workCompleted", label: "Work is Completed?", type: "radio", options: YN },
        { key: "turnoverReceiver", label: "Permit Receiver" },
        { key: "turnoverDate", label: "Date", type: "date" },
        { key: "turnoverTime", label: "Time", type: "time" }
      ]},
      { title: "Section 8.0 — Worksite Turnover Review", fields: [
        { key: "emocRequired", label: "Is EMOC required?", type: "radio", options: YNNA },
        { key: "deisolationImplemented", label: "De-isolation implemented?", type: "radio", options: YNNA },
        { key: "specialMeasuresRelieved", label: "Special measures relieved?", type: "radio", options: YNNA },
        { key: "emocActions", label: "Actions if EMOC is required", type: "textarea", full: true }
      ]},
      { title: "Section 9.0 — Restoration to Operational Readiness", fields: [
        { key: "functionalChecks", label: "Functional checks made & equipment restored?", type: "radio", options: YN },
        { key: "restorationActions", label: "If NO, state actions to be done", type: "textarea", full: true }
      ]},
      { title: "Section 10.0 — Closeout", fields: [
        { key: "closeoutName", label: "Name" },
        { key: "closeoutSignature", label: "Signature" },
        { key: "closeoutDate", label: "Date", type: "date" },
        { key: "closeoutTime", label: "Time", type: "time" }
      ]}
    ];
  }

  function blankPermit() {
    return { permitClass: "Scheduled", status: "Draft", clearances: {}, workDescription: "", permitReceiver: "" };
  }

  function clearancesBlock() {
    curPermit.clearances = curPermit.clearances || {};
    const box = el("div", null, [
      el("p", { class: "muted small" }, ["Tick the clearances / special measures that apply."])
    ]);
    const chips = el("div", { class: "chips" });
    META.clearances.forEach(c => {
      const on = !!curPermit.clearances[c.key];
      const chip = el("label", { class: "chip" + (on ? " on" : "") }, [el("input", { type: "checkbox" }), c.label]);
      const cb = chip.querySelector("input");
      cb.checked = on;
      cb.addEventListener("change", () => {
        curPermit.clearances[c.key] = cb.checked;
        chip.classList.toggle("on", cb.checked);
      });
      chips.appendChild(chip);
    });
    box.appendChild(chips);
    return box;
  }

  function buildPermitForm() {
    const body = $("#permit-form-body");
    body.innerHTML = "";
    permitSchema().forEach(sec => {
      const card = sectionCard(sec.title, sec.clearances ? null : sec.fields, curPermit);
      if (sec.clearances) {
        card.appendChild(clearancesBlock());
        const grid = el("div", { class: "grid" });
        sec.fields.forEach(def => grid.appendChild(field(def, curPermit)));
        card.appendChild(grid);
      }
      body.appendChild(card);
    });
  }

  function openPermitEditor(id) {
    curPermit = id ? JSON.parse(JSON.stringify(permits.find(p => p.id === id))) : blankPermit();
    const isNew = !curPermit.id;
    $("#permit-editor-title").textContent = isNew ? "New Permit to Work" : "Edit Permit";
    $("#permit-editor-no").textContent = curPermit.ptwNo || "Permit number assigned on save";
    $("#permit-delete").classList.toggle("hidden", isNew);
    buildPermitForm();
    showView("permit-editor");
  }

  async function savePermit() {
    if (!curPermit.workDescription || !curPermit.workDescription.trim()) { toast("Work Description is required.", "err"); return; }
    if (!curPermit.permitReceiver || !curPermit.permitReceiver.trim()) { toast("Permit Receiver is required.", "err"); return; }
    try {
      const saved = curPermit.id ? await api("/permits/" + curPermit.id, { method: "PUT", body: JSON.stringify(curPermit) })
        : await api("/permits", { method: "POST", body: JSON.stringify(curPermit) });
      await refresh();
      toast("Saved " + (saved ? saved.ptwNo : "permit") + ".", "ok");
      renderPermitRegister(); showView("permits");
    } catch (e) { toast("Save failed: " + e.message, "err"); }
  }

  async function deletePermit() {
    if (!curPermit || !curPermit.id) return;
    if (!confirm("Delete " + curPermit.ptwNo + "?")) return;
    try {
      await api("/permits/" + curPermit.id, { method: "DELETE" });
      await refresh();
      toast("Permit deleted.");
      renderPermitRegister(); showView("permits");
    } catch (e) { toast("Delete failed: " + e.message, "err"); }
  }

  /* ========================================================
     Registers (dashboards)
     ======================================================== */
  function statTile(n, label) {
    return el("div", { class: "stat" }, [el("div", { class: "n" }, [String(n)]), el("div", { class: "l" }, [label])]);
  }

  function renderPermitRegister() {
    // filters
    const fStatus = $("#permit-filter-status");
    if (fStatus.children.length <= 1) META.permitStatuses.forEach(s => fStatus.appendChild(el("option", null, [s])));
    const fClass = $("#permit-filter-class");
    if (fClass.children.length <= 1) META.permitClasses.forEach(c => fClass.appendChild(el("option", null, [c])));

    const stats = $("#permit-stats");
    stats.innerHTML = "";
    const by = s => permits.filter(p => p.status === s).length;
    stats.appendChild(statTile(permits.length, "Total"));
    stats.appendChild(statTile(by("Active"), "Active"));
    stats.appendChild(statTile(by("Submitted"), "Awaiting approval"));
    stats.appendChild(statTile(by("Suspended"), "Suspended"));

    renderPermitRows();
  }

  function renderPermitRows() {
    const q = $("#permit-search").value.trim().toLowerCase();
    const fs = $("#permit-filter-status").value;
    const fc = $("#permit-filter-class").value;
    const rows = permits
      .filter(p => !fs || p.status === fs)
      .filter(p => !fc || p.permitClass === fc)
      .filter(p => !q || [p.ptwNo, p.workDescription, p.areaLocation, p.permitReceiver, p.traNo]
        .some(v => (v || "").toLowerCase().includes(q)));
    const tb = $("#permit-tbody");
    tb.innerHTML = "";
    $("#permit-empty").classList.toggle("hidden", rows.length > 0);
    rows.forEach(p => {
      tb.appendChild(el("tr", { class: "clickable", onClick: () => openPermitEditor(p.id) }, [
        el("td", null, [p.ptwNo || "–"]),
        el("td", null, [p.workDescription || "(untitled)"]),
        el("td", null, [p.permitClass || "–"]),
        el("td", null, [p.areaLocation || "–"]),
        el("td", null, [p.traNo || "–"]),
        el("td", { class: "small muted" }, [fmtDate(p.dateOfExpiry)]),
        el("td", null, [el("span", { class: "pill " + (p.status || "Draft") }, [p.status || "Draft"])]),
        el("td", null, [el("button", { class: "btn ghost small", onClick: e => { e.stopPropagation(); openPermitEditor(p.id); } }, ["Open"])])
      ]));
    });
  }

  function renderTraRegister() {
    const fLevel = $("#tra-filter-level");
    if (fLevel.children.length <= 1) META.riskLevels.forEach(l => fLevel.appendChild(el("option", { value: l.label }, [l.label])));

    const stats = $("#tra-stats");
    stats.innerHTML = "";
    const lvlCount = key => tras.filter(t => t.hrv && t.hrv.level === key).length;
    stats.appendChild(statTile(tras.length, "Total"));
    stats.appendChild(statTile(lvlCount("high") + lvlCount("critical"), "High / Critical"));
    stats.appendChild(statTile(lvlCount("moderate"), "Moderate"));
    stats.appendChild(statTile(lvlCount("low"), "Low"));

    renderTraRows();
  }

  function renderTraRows() {
    const q = $("#tra-search").value.trim().toLowerCase();
    const fl = $("#tra-filter-level").value;
    const rows = tras
      .filter(t => !fl || (t.hrv && t.hrv.label === fl))
      .filter(t => !q || [t.traRef, t.workDescription, t.equipment, t.location]
        .some(v => (v || "").toLowerCase().includes(q)));
    const tb = $("#tra-tbody");
    tb.innerHTML = "";
    $("#tra-empty").classList.toggle("hidden", rows.length > 0);
    rows.forEach(t => {
      const v = t.hrv ? t.hrv.value : 0;
      tb.appendChild(el("tr", { class: "clickable", onClick: () => openTraEditor(t.id) }, [
        el("td", null, [t.traRef || "–"]),
        el("td", null, [t.workDescription || "(untitled)"]),
        el("td", null, [t.equipment || "–"]),
        el("td", null, [t.location || "–"]),
        el("td", { class: "muted" }, [String((t.steps || []).length)]),
        el("td", null, [riskBadge(v)]),
        el("td", null, [el("button", { class: "btn ghost small", onClick: e => { e.stopPropagation(); openTraEditor(t.id); } }, ["Open"])])
      ]));
    });
  }

  /* ========================================================
     Wire up
     ======================================================== */
  async function init() {
    try { META = await api("/meta") || META; } catch { /* use fallback */ }
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
        case "new-tra": openTraEditor(null); break;
        case "save-tra": saveTra(); break;
        case "cancel-tra": renderTraRegister(); showView("tras"); break;
        case "delete-tra": deleteTra(); break;
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
