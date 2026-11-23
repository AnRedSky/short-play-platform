import fs from "node:fs";
const s = fs.readFileSync("modules/notify/pages.js", "utf8");
for (const k of ["notify.toTask", "notify.read", "notify.readAll", "notify.jump"]) {
  const i = s.indexOf('App.on("' + k);
  if (i < 0) { console.log("MISS " + k); continue; }
  const j = s.indexOf("App.on(", i + 5);
  console.log("--- " + k);
  console.log(s.slice(i, j < 0 ? undefined : Math.min(j, i + 700)));
}
