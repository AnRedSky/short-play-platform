import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const modDir = path.join(root, "modules");
const rows = [];
for (const dom of fs.readdirSync(modDir)) {
  const f = path.join(modDir, dom, "pages.js");
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, "utf8");
  const routes = [...s.matchAll(/path:\s*"([^"]+)"/g)].map((m) => m[1]);
  const acts = [...s.matchAll(/App\.on\("([^"]+)"/g)].map((m) => m[1]);
  const last = s.slice(s.lastIndexOf("v9.1 真实流程层"));
  const v = [...last.matchAll(/App\.on\("([^"]+)"/g)].map((m) => m[1]);
  rows.push({ dom, routes: routes.length, actions: acts.length, v91: v.join(",") });
}
for (const r of rows) console.log("\n## " + r.dom + " · routes " + r.routes + " · actions " + r.actions + "\n" + r.v91);
