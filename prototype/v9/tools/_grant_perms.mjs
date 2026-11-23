import fs from "node:fs";

const f = "assets/js/data.js";
let s = fs.readFileSync(f, "utf8");
const map = [
  ['"cost.export", "analytics.read", "audit.read", "audit.export", "notify.handle"]', '"cost.export", "cost.manage", "models.manage", "compliance.write", "analytics.read", "audit.read", "audit.export", "notify.handle"]'],
  ['"project.manage", "cost.read", "analytics.read", "notify.handle"]', '"project.manage", "cost.read", "cost.manage", "compliance.write", "analytics.read", "notify.handle"]'],
  ['"asset.read", "asset.manage", "cost.read", "analytics.own", "notify.handle"]', '"asset.read", "asset.manage", "cost.read", "compliance.write", "analytics.own", "notify.handle"]'],
];
for (const [a, b] of map) {
  if (s.indexOf(a) < 0) { console.log("MISS " + a.slice(0, 30)); continue; }
  s = s.split(a).join(b);
  console.log("ok " + a.slice(0, 30));
}
fs.writeFileSync(f, s);
