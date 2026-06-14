// Seeds one example TRA and one linked Permit when the database is empty.
import * as store from "./db.js";

export function seedIfEmpty() {
  if (store.countTras() > 0 || store.countPermits() > 0) return;

  const today = new Date().toISOString().slice(0, 10);

  const tra = store.createTra({
    workDescription: "Replace failed circulation pump motor in Plant Room B",
    woSwmsNo: "WO-44821",
    equipment: "Circulation Pump P-204 / 3-phase motor",
    location: "Plant Room B, Level 2",
    datePrepared: today,
    contractor: "Acme Mechanical Ltd",
    workSponsor: "Facilities Engineering",
    deptInCharge: "Maintenance",
    steps: [
      {
        workStep: "Isolate and disconnect motor wiring",
        hazards: "Live electrical conductors — risk of electric shock / arc flash",
        inherentS: 5, inherentP: 4,
        controlMeasures: "Safe isolation, lock-off/tag-out, prove dead, insulated tools, arc-rated PPE",
        controlType: "Engineering",
        residualS: 5, residualP: 1,
        remarks: "Isolation by authorised person only"
      },
      {
        workStep: "Remove motor (35 kg) and install replacement",
        hazards: "Manual handling — musculoskeletal injury / dropped load",
        inherentS: 3, inherentP: 3,
        controlMeasures: "Two-person lift, mechanical lifting aid, clear access route",
        controlType: "Administrative",
        residualS: 2, residualP: 2,
        remarks: ""
      }
    ],
    parties: {
      facilitator: { name: "R. Okafor", designation: "SHE - Maintenance", signature: "", date: today },
      contractorLead: { name: "T. Nguyen", designation: "Lead Fitter - Acme", signature: "", date: today },
      areaOwner: { name: "D. Cole", designation: "Operations Rep", signature: "", date: today },
      auxiliary: []
    },
    approver: { name: "S. Patel", designation: "Facility Head", signature: "", date: today }
  });

  store.createPermit({
    permitClass: "Scheduled",
    workOrderNo: "WO-44821",
    traNo: tra.traRef,
    workDescription: "Replace failed circulation pump motor in Plant Room B",
    areaLocation: "Plant Room B, Level 2",
    permitReceiver: "J. Rivera",
    contactNumber: "+1 555 0142",
    dateOfApplication: today,
    timeOfApplication: "08:30",
    equipmentToWorkOn: "Circulation Pump P-204",
    workParty: "Acme Mechanical Ltd",
    workToBePerformed: "Isolate, remove and replace the failed circulation pump motor.",
    newInstallation: "No",
    modification: "No",
    gasTestingRequired: "No",
    clearances: { loto: true, fireSuppression: false, hotWorks: false },
    specialMeasures: "Isolation clearance to be attached. Operations to be notified before energising.",
    electricalIsolationOfficer: "K. Adeyemi",
    initialWorkDuration: "4 hours",
    dateOfExpiry: today,
    status: "Approved"
  });

  console.log("Seeded example TRA and Permit.");
}
