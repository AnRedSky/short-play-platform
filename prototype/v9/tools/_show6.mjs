import fs from "node:fs";
const s = fs.readFileSync("modules/ops/pages.js", "utf8");
for (const k of ["ops.adapterRegister", "ops.scaleRequest", "ops.restoreDrill", "ops.saveConfig", "ops.editConfig"]) {
  const i = s.indexOf('App.on("' + k + '"');
  if (i < 0) { console.log("MISS " + k); continue; }
  const j = s.indexOf("App.on(", i + 5);
  console.log("\n--- " + k);
  console.log(s.slice(i, j < 0 ? undefined : Math.min(j, i + 900)));
}
const d = fs.readFileSync("assets/js/data.js", "utf8");
const idx = d.indexOf("ops: {");
console.log("\n=== DB.ops\n" + d.slice(idx, idx + 500));
