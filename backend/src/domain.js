// Shared domain constants & risk model for the PTW / TRA app.

// Severity (S) x Probability (P) = Vulnerability (V), each 1-5, V in 1..25.
export const RISK_LEVELS = [
  { key: "low",      label: "Low",      min: 1,  max: 4,  color: "#30a46c", authority: "Operations Superintendent / Supervisor" },
  { key: "moderate", label: "Moderate", min: 5,  max: 9,  color: "#d9a514", authority: "Operations Head" },
  { key: "high",     label: "High",     min: 10, max: 14, color: "#e8801c", authority: "Facility Head" },
  { key: "critical", label: "Critical", min: 15, max: 25, color: "#e5484d", authority: "Regional O&M Head" }
];

export function riskLevel(v) {
  const score = Number(v) || 0;
  if (score <= 0) return { key: "", label: "–", color: "#2a3547", authority: "" };
  return RISK_LEVELS.find(l => score >= l.min && score <= l.max) || RISK_LEVELS[RISK_LEVELS.length - 1];
}

// Hierarchy of controls (most to least effective).
export const CONTROL_TYPES = [
  "Elimination", "Substitution", "Engineering", "Administrative", "PPE"
];

// Clearances / special measures (Section 3 of the PTW form).
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

export const PERMIT_STATUSES = [
  "Draft", "Submitted", "Approved", "Active", "Suspended", "Cancelled", "Closed"
];
