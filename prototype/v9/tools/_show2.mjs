import fs from "node:fs";
const s = fs.readFileSync("modules/tasks/pages.js", "utf8");
const keys = ["stage", "parallelGroup", "failedCost", "attempt", "maxAttempts", "qc", "priority", "deps"];
const lines = s.split("\n");
for (const k of keys) {
  const hit = lines.filter((l) => l.includes("t." + k));
  if (hit.length) console.log("[" + k + "] " + hit[0].trim().slice(0, 140));
}
