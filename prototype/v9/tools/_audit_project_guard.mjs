/* tools/_audit_project_guard.mjs — 无可见项目时，项目域页面必须阻断而不是渲染空表。
   用法：node tools/_audit_project_guard.mjs */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const sandbox = { console };
sandbox.window = sandbox;
sandbox.location = { hash: "#/" };
sandbox.document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, createElement() { return { style: {}, appendChild() {}, setAttribute() {}, classList: { add() {} } }; } };
vm.createContext(sandbox);
vm.runInContext(read("assets/js/data.js"), sandbox, { filename: "data.js" });
vm.runInContext(read("assets/js/ui.js"), sandbox, { filename: "ui.js" });
const registered = [];
sandbox.window.AppModule = { register: (cfg) => registered.push(cfg) };
sandbox.window.App = {
  on() {}, guard() { return true; }, get(s, k, d) { return d; }, set() {}, mem() { return {}; },
  go() {}, toast() {}, modal() {}, confirm() {}, drawer() {}, refresh() {}, can() { return true; }, exportCsv() {},
  identity() { return sandbox.window.DB.identities.find(i => i.id === "i-owner"); },
  role() { return sandbox.window.DB.roles.find(r => r.code === "owner"); },
  home() { return "workspace/home"; },
  current() { return { path: "", query: {}, route: null }; },
  currentProject() { return null; },
  routes() { return []; }, groups() { return []; }
};
sandbox.window.Store = { FLOW: {}, canMove() { return { ok: true, msg: "" }; }, money(n) { return String(n); }, gate() { return { ok: true, items: [] }; }, budgetOf() { return null; } };
vm.runInContext(read("assets/js/derived.js"), sandbox, { filename: "derived.js" });
for (const m of fs.readdirSync(path.join(root, "modules")).filter(d => fs.statSync(path.join(root, "modules", d)).isDirectory())) {
  vm.runInContext(read(`modules/${m}/pages.js`), sandbox, { filename: `${m}/pages.js` });
}
const routes = new Map();
for (const cfg of registered) for (const r of cfg.routes || []) routes.set(r.path, r);
const scoped = [
  "creation/brief", "creation/plan", "creation/script", "creation/review", "creation/breakdown",
  "director/plan", "director/cast", "director/world", "director/shots", "director/storyboard",
  "video/production", "video/results", "video/preview",
  "audio/dialogue", "audio/voice", "audio/bgm", "audio/subtitle",
  "post/timeline", "post/episodes", "post/review", "post/delivery", "post/versions",
  "quality/gates", "quality/reports", "quality/rework",
  "projects/workflow"
];
let pass = 0;
let fail = 0;
for (const pathName of scoped) {
  const r = routes.get(pathName);
  if (!r) { console.log("✗ 路由缺失 " + pathName); fail++; continue; }
  let html = "";
  try { html = r.render({ id: "SP-26011", ep: "17", shot: "SH-26011-E17-03" }); } catch (e) { console.log("✗ 渲染异常 " + pathName + "：" + e.message); fail++; continue; }
  const guarded = html.indexOf("项目不在可见范围") >= 0 && /返回项目(列|库)/.test(html);
  if (guarded) { pass++; console.log("✅ " + pathName + " 已阻断"); }
  else { fail++; console.log("✗ " + pathName + " 未阻断：无项目时仍渲染业务内容"); }
}
console.log(`合计：通过 ${pass} · 失败 ${fail}`);
if (fail) process.exit(1);
