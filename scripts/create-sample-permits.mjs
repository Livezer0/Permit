// Creates sample TRAs and 10 Permits to Work via the REST API.
// Usage (with the backend running):
//   node scripts/create-sample-permits.mjs            // uses http://localhost:4000
//   node scripts/create-sample-permits.mjs https://<your-forwarded-backend>
//
// This only calls the public API — it does not touch any app code or the DB directly.

const BASE = (process.argv[2] || process.env.PTW_API_BASE || "http://localhost:4000").replace(/\/$/, "");
const API = BASE + "/api";

async function post(path, body) {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${data ? JSON.stringify(data) : ""}`);
  return data;
}

const today = new Date();
const iso = (offsetDays = 0) => {
  const d = new Date(today.getTime() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
};

function tra(workDescription, equipment, location, steps, approverDesignation) {
  return {
    workDescription, equipment, location, datePrepared: iso(0),
    contractor: "Acme Industrial Services", workSponsor: "Facilities Engineering", deptInCharge: "Maintenance",
    steps,
    parties: {
      facilitator: { name: "R. Okafor", designation: "SHE", date: iso(0) },
      contractorLead: { name: "T. Nguyen", designation: "Site Lead", date: iso(0) },
      areaOwner: { name: "D. Cole", designation: "Operations Rep", date: iso(0) },
      auxiliary: []
    },
    approver: { name: "S. Patel", designation: approverDesignation || "Facility Head", date: iso(0) }
  };
}
const step = (workStep, hazards, is, ip, controls, type, rs, rp) =>
  ({ workStep, hazards, inherentS: is, inherentP: ip, controlMeasures: controls, controlType: type, residualS: rs, residualP: rp, remarks: "" });

async function main() {
  console.log("Target API:", API);

  // A few TRAs to link to the live/approved permits.
  const traPump = await post("/tras", tra(
    "Replace failed circulation pump motor", "Circulation Pump P-204", "Plant Room B, Level 2",
    [step("Isolate & disconnect motor", "Electric shock / arc flash", 5, 4, "Safe isolation, LOTO, prove dead, arc PPE", "Engineering", 5, 1),
     step("Manual handling of motor (35 kg)", "Musculoskeletal injury", 3, 3, "Two-person lift, mechanical aid", "Administrative", 2, 2)]));
  const traWeld = await post("/tras", tra(
    "Weld new handrail on roof", "Roof handrail, Block C", "Roof, Block C",
    [step("Hot work / welding", "Fire from sparks", 4, 4, "Fire watch, extinguisher, clear combustibles", "Administrative", 4, 2)]));
  const traCS = await post("/tras", tra(
    "Confined space tank internal inspection", "Storage Tank T-12", "Tank Farm",
    [step("Entry into confined space", "Low oxygen / toxic atmosphere", 5, 4, "Gas testing, ventilation, attendant, rescue plan", "Engineering", 5, 2)]));
  const traDig = await post("/tras", tra(
    "Excavate trench for power cable", "Trench, North Yard", "North Yard",
    [step("Excavation near services", "Buried services strike", 4, 3, "Cable scan, hand-dig, permits", "Administrative", 4, 1)]));
  const traLift = await post("/tras", tra(
    "Crane lift of replacement chiller", "Chiller CH-3", "Roof plant deck",
    [step("Lifting operation", "Dropped load / struck-by", 5, 3, "Lift plan, certified gear, exclusion zone, banksman", "Engineering", 5, 1)]));

  // 10 permits across Live / Suspended / Closed.
  const permits = [
    {
      permitClass: "Scheduled", status: "Active", traNo: traPump.traRef, workOrderNo: "WO-44821",
      workDescription: "Replace failed circulation pump motor in Plant Room B",
      areaLocation: "Plant Room B, Level 2", permitReceiver: "J. Rivera", contactNumber: "+1 555 0142",
      workParty: "Acme Mechanical", dateOfApplication: iso(0), dateOfExpiry: iso(0),
      clearances: { loto: true },
      energyIsolation: { lotoBoxNo: "LOTO-07", identifiedBy: "K. Adeyemi", mechanical: [], electrical: [{ equipmentId: "P-204", pointOfIsolation: "MCC-2 breaker", isolatedState: "Open + locked", lockNo: "L-118", isolatedBy: "K. Adeyemi" }] },
      take5: { task: "Replace pump motor", before: { scope: true, tra: true, ppe: true }, members: [{ name: "J. Rivera", designation: "Fitter" }], hazards: {} }
    },
    {
      permitClass: "Scheduled", status: "Active", traNo: traWeld.traRef, workOrderNo: "WO-44910",
      workDescription: "Weld new handrail on roof, Block C",
      areaLocation: "Roof, Block C", permitReceiver: "A. Smith", workParty: "Steelfix Ltd",
      dateOfApplication: iso(0), dateOfExpiry: iso(0),
      clearances: { hotWorks: true },
      hotWorkClearance: { clearanceNo: "HW-2042", workDescription: "Weld handrail to existing posts", mandatory: { trainedWatcher: true, extinguisher: true }, precautions: { fireBlanket: true, barriers: true }, operators: [{ name: "A. Smith" }], fireWatch: [{ name: "P. Adeola" }], fireWatchHours: "1", gasTestNeeded: "No" }
    },
    {
      permitClass: "Scheduled", status: "Approved", traNo: traCS.traRef, workOrderNo: "WO-45001",
      workDescription: "Confined space internal inspection of storage tank T-12",
      areaLocation: "Tank Farm", permitReceiver: "M. Boateng", workParty: "InspectCo",
      dateOfApplication: iso(0), dateOfExpiry: iso(1),
      clearances: { confinedSpace: true }, gasTestingRequired: "Yes", o2: "20.9", h2s: "0", lel: "0", co: "0"
    },
    {
      permitClass: "Scheduled", status: "Submitted", workOrderNo: "WO-45044",
      workDescription: "Erect scaffold to level 3 for facade repair",
      areaLocation: "South Elevation", permitReceiver: "L. Fernandez", workParty: "HighReach Scaffolding",
      dateOfApplication: iso(0), dateOfExpiry: iso(3), clearances: { workingAtHeights: true }
    },
    {
      permitClass: "Outage", status: "Approved", traNo: traDig.traRef, workOrderNo: "WO-45077",
      workDescription: "Excavate trench for new power cable, North Yard",
      areaLocation: "North Yard", permitReceiver: "B. Larsson", workParty: "GroundWorks",
      dateOfApplication: iso(0), dateOfExpiry: iso(2), clearances: { excavation: true }
    },
    {
      permitClass: "Outage", status: "Active", traNo: traLift.traRef, workOrderNo: "WO-45090",
      workDescription: "Crane lift and install replacement chiller CH-3",
      areaLocation: "Roof plant deck", permitReceiver: "G. Haddad", workParty: "LiftRight Cranes",
      dateOfApplication: iso(0), dateOfExpiry: iso(0), clearances: { lifting: true }
    },
    {
      permitClass: "Scheduled", status: "Draft", workOrderNo: "WO-45102",
      workDescription: "Replace lighting circuit in corridor B",
      areaLocation: "Corridor B, Level 1", permitReceiver: "N. Owens", workParty: "Spark Electrical",
      dateOfApplication: iso(0), dateOfExpiry: iso(5)
    },
    {
      permitClass: "Emergency", status: "Suspended", workOrderNo: "WO-45110",
      workDescription: "Emergency fire pump bearing replacement",
      areaLocation: "Fire Pump House", permitReceiver: "C. Mensah", workParty: "Acme Mechanical",
      dateOfApplication: iso(-1), dateOfExpiry: iso(0), clearances: { loto: true },
      cancelSuspendNotes: "Suspended pending spare parts delivery.", suspensionReason: "Unavailability of supplies", suspensionDate: iso(0)
    },
    {
      permitClass: "Scheduled", status: "Closed", workOrderNo: "WO-44788",
      workDescription: "Repaint structural steel, Warehouse 4",
      areaLocation: "Warehouse 4", permitReceiver: "E. Novak", workParty: "ProCoat",
      dateOfApplication: iso(-4), dateOfExpiry: iso(-1),
      closeoutName: "E. Novak", closeoutDate: iso(-1)
    },
    {
      permitClass: "Scheduled", status: "Cancelled", workOrderNo: "WO-44799",
      workDescription: "Flush and drain pipework, Utility Block",
      areaLocation: "Utility Block", permitReceiver: "F. Kovac", workParty: "FlowServ",
      dateOfApplication: iso(-3), dateOfExpiry: iso(-2),
      cancellationReason: "Major work scope change", cancellationDate: iso(-2),
      cancelSuspendNotes: "Cancelled — scope merged with the chiller outage."
    }
  ];

  let n = 0;
  for (const p of permits) {
    const created = await post("/permits", p);
    n++;
    console.log(`  ${created.ptwNo}  ${created.status.padEnd(9)}  ${created.workDescription}`);
  }
  console.log(`\nCreated ${n} permits (+5 TRAs).`);
}

main().catch(e => { console.error("Failed:", e.message); process.exit(1); });
