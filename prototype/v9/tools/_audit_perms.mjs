import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "assets/js/data.js"), "utf8"), sandbox, { filename: "data.js" });
const perms = Object.keys(sandbox.window.DB.permissions);

const guards = new Set();
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "tools") walk(f); continue; }
    if (!/\.js$/.test(e.name)) continue;
    const s = fs.readFileSync(f, "utf8");
    for (const m of s.matchAll(/guard\("([^"]+)"\)/g)) guards.add(m[1]);
    for (const m of s.matchAll(/can\("([^"]+)"\)/g)) guards.add(m[1]);
  }
})(root);

const missing = [...guards].filter((g) => perms.indexOf(g) < 0);
console.log("permissions defined:", perms.length);
console.log("guard codes used:", guards.size);
console.log("missing:", missing.join(", ") || "none");

const roleUse = sandbox.window.DB.roles.map((r) => r.code + "=" + (r.perms || []).filter((p) => guards.has(p)).length + "/" + (r.perms || []).length);
console.log("role:", roleUse.join(" "));
