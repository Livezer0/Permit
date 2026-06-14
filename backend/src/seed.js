// Inserts one example permit if the database is empty.
import * as store from "./db.js";

export function seedIfEmpty() {
  if (store.count() > 0) return;

  const now = new Date();
  const from = new Date(now.getTime() + 3600e3);
  const to = new Date(now.getTime() + 5 * 3600e3);
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  store.createPermit({
    title: "Replace pump motor — Plant Room B",
    type: "Electrical / Isolation",
    location: "Plant Room B, Level 2",
    applicant: "J. Rivera",
    company: "Acme Mechanical Ltd",
    personnel: 2,
    validFrom: iso(from),
    validTo: iso(to),
    description: "Isolate, remove and replace the failed circulation pump motor.",
    hazards: ["Electricity", "Stored energy", "Manual handling", "Slips, trips & falls"],
    risks: [
      { hazard: "Electric shock during disconnection", l: 4, s: 5, controls: "Safe isolation, lock-off/tag-out, prove dead, insulated tools", rl: 1, rs: 5 },
      { hazard: "Manual handling of motor (35 kg)", l: 3, s: 3, controls: "Two-person lift, mechanical aid, clear route", rl: 2, rs: 2 }
    ],
    status: "Approved",
    approver: "S. Patel (Authorised Person)",
    ppe: "Hard hat, safety boots, insulated gloves, eye protection",
    emergency: "First-aider: M. Lin (ext 204). Muster point: North car park.",
    ack: true
  });

  console.log("Seeded example permit.");
}
