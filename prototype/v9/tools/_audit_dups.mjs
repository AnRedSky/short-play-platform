/* tools/_audit_dups.mjs — 重复注册同一动作的静态检查。
   用法：node tools/_audit_dups.mjs */
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const files = [path.join(root, "assets/js/app.js")];
for (const m of fs.readdirSync(path.join(root, "modules"))) {
  const p = path.join(root, "modules", m, "pages.js");
  if (fs.existsSync(p)) files.push(p);
}
const hits = new Map();
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  for (const match of src.matchAll(/(?:App\.)?on\(\s*"([^"]+)"/g)) {
    const name = match[1];
    if (!hits.has(name)) hits.set(name, []);
    hits.get(name).push(path.relative(root, file));
  }
}
let dups = 0;
for (const [name, list] of hits) {
  if (list.length > 1) { dups++; console.log("✗ 重复注册 " + name + " → " + list.join(" / ")); }
}
console.log(`动作 ${hits.size} · 重复 ${dups}`);
if (dups) process.exit(1);
