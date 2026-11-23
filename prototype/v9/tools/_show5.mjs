import fs from "node:fs";
const s = fs.readFileSync("modules/orgs/pages.js", "utf8");
for (const k of ["orgs.toggle", "orgs.offboard", "orgs.newMember", "orgs.transfer", "orgs.grantNew"]) {
  const i = s.indexOf('App.on("' + k + '"');
  if (i < 0) { console.log("MISS " + k); continue; }
  const j = s.indexOf("App.on(", i + 5);
  console.log("\n--- " + k);
  console.log(s.slice(i, j < 0 ? undefined : Math.min(j, i + 1100)));
}
