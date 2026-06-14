// Shared domain model for the PTW / TRA app — mirrors the paper forms.

// Risk levels (colours sampled from the form's classification legend).
export const LEVELS = {
  low:      { key: "low",      label: "Low",      color: "#4f8f00", authority: "Operations Superintendent / Supervisor" },
  moderate: { key: "moderate", label: "Moderate", color: "#ffd100", authority: "Operations Head" },
  high:     { key: "high",     label: "High",     color: "#ff6a00", authority: "Facility Head" },
  critical: { key: "critical", label: "Critical", color: "#ee0000", authority: "Regional O&M Head" }
};
export const LEVEL_ORDER = ["low", "moderate", "high", "critical"];

// 5x5 risk matrix from the form: RISK_MATRIX[probability][severity] => level key.
// Probability (likelihood) rows 1-5, Severity (consequence) columns 1-5.
export const RISK_MATRIX = {
  5: { 1: "high",     2: "high",     3: "critical", 4: "critical", 5: "critical" },
  4: { 1: "moderate", 2: "high",     3: "high",     4: "critical", 5: "critical" },
  3: { 1: "low",      2: "moderate", 3: "high",     4: "high",     5: "critical" },
  2: { 1: "low",      2: "low",      3: "moderate", 4: "high",     5: "critical" },
  1: { 1: "low",      2: "low",      3: "moderate", 4: "high",     5: "high" }
};
export const CONSEQUENCE_LABELS = ["Negligible", "Low", "Moderate", "High", "Catastrophic"];
export const LIKELIHOOD_LABELS  = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];

export function vuln(s, p) { return (parseInt(s, 10) || 0) * (parseInt(p, 10) || 0); }

export function levelKeyFor(s, p) {
  s = parseInt(s, 10); p = parseInt(p, 10);
  if (!s || !p) return "";
  return (RISK_MATRIX[p] && RISK_MATRIX[p][s]) || "";
}

// Highest Residual Vulnerability: max residual V, with the worst residual level.
export function hrvFor(steps) {
  let value = 0, worst = -1;
  (steps || []).forEach(s => {
    const v = vuln(s.residualS, s.residualP);
    if (v > value) value = v;
    const key = levelKeyFor(s.residualS, s.residualP);
    const idx = LEVEL_ORDER.indexOf(key);
    if (idx > worst) worst = idx;
  });
  const key = worst >= 0 ? LEVEL_ORDER[worst] : "";
  const meta = key ? LEVELS[key] : { label: "–", color: "#cccccc", authority: "" };
  return { value, level: key, label: meta.label, color: meta.color, authority: meta.authority };
}

// Hierarchy of controls (most to least effective).
export const CONTROL_TYPES = ["Elimination", "Substitution", "Engineering", "Administrative", "PPE"];

// Clearances / special measures (Section 3.0 of the PTW form).
export const CLEARANCES = [
  { key: "loto", label: "LOTO" },
  { key: "workingAtHeights", label: "Working at Heights" },
  { key: "lifting", label: "Lifting" },
  { key: "excavation", label: "Excavation" },
  { key: "fireGasDetection", label: "Fire/Gas Detection and Alarm" },
  { key: "fireSuppression", label: "Fire Suppression" },
  { key: "hotWorks", label: "Hot Works" },
  { key: "confinedSpace", label: "Confined Space" },
  { key: "workOverWater", label: "Work Over / Under Water" },
  { key: "others", label: "Others" }
];

export const PERMIT_CLASSES = ["Scheduled", "Emergency", "Outage"];
export const PERMIT_STATUSES = ["Draft", "Submitted", "Approved", "Active", "Suspended", "Cancelled", "Closed"];

export const META = {
  levels: LEVELS, levelOrder: LEVEL_ORDER, matrix: RISK_MATRIX,
  consequenceLabels: CONSEQUENCE_LABELS, likelihoodLabels: LIKELIHOOD_LABELS,
  controlTypes: CONTROL_TYPES, clearances: CLEARANCES,
  permitClasses: PERMIT_CLASSES, permitStatuses: PERMIT_STATUSES
};
