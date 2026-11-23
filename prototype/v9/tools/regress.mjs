/* tools/regress.mjs — 交付前回归：不依赖浏览器与第三方包。
   1) 语法自检由 node --check 负责（见 start 脚本说明）
   2) 本脚本负责：路由注册一致性、渲染不抛错、占位文本审计、权限三层覆盖统计
   用法：node tools/regress.mjs */
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
  identity() { return sandbox.window.DB.identities[0]; }, role() { return sandbox.window.DB.roles[0]; },
  home() { return "workspace/home"; }, current() { return { path: "", query: {}, route: null }; },
  currentProject(q) {
    const db = sandbox.window.DB;
    const qid = q && q.id;
    if (qid) return db.projects.find(p => p.id === qid) || null;
    const stored = db.projects.find(p => p.id === "SP-26031");
    if (stored && sandbox.window.Derived && sandbox.window.Derived.canViewProject && sandbox.window.Derived.canViewProject(stored)) return stored;
    return (sandbox.window.Derived && sandbox.window.Derived.visibleProjects && sandbox.window.Derived.visibleProjects()[0]) || null;
  },
  routes() { return []; }, groups() { return []; }
};
sandbox.window.Store = {
  FLOW: {}, canMove() { return { ok: true, msg: "" }; }, money(n) { return String(n); },
  gate() { return { ok: true, items: [] }; }, budgetOf() { return null; }
};

const modules = fs.readdirSync(path.join(root, "modules")).filter(d => fs.statSync(path.join(root, "modules", d)).isDirectory());
vm.runInContext(read("assets/js/derived.js"), sandbox, { filename: "derived.js" });
for (const m of modules) vm.runInContext(read(`modules/${m}/pages.js`), sandbox, { filename: `${m}/pages.js` });

const DB = sandbox.window.DB;
const UI = sandbox.window.UI;
const problems = [];
const routes = [];

for (const cfg of registered) {
  if (!modules.includes(cfg.group)) problems.push(`模块 ${cfg.group} 的 group 与目录名不一致`);
  for (const r of cfg.routes || []) {
    routes.push({ path: r.path, group: cfg.group, title: r.title, perm: r.permission, render: r.render });
    if (String(r.path).split("/")[0] !== cfg.group) problems.push(`路由 ${r.path} 前缀与模块目录 ${cfg.group} 不一致`);
  }
}
const dup = routes.filter((r, i) => routes.findIndex(x => x.path === r.path) !== i).map(r => r.path);
if (dup.length) problems.push("路由重复：" + dup.join(", "));

const permCodes = new Set(Object.keys(DB.permissions));
for (const r of routes) {
  const codes = Array.isArray(r.perm) ? r.perm : [r.perm];
  for (const c of codes) if (c && !permCodes.has(c)) problems.push(`路由 ${r.path} 使用未定义权限码 ${c}`);
}

const bad = /undefined|null|NaN|\[object Object\]/;
for (const r of routes) {
  let html;
  try { html = r.render({ id: "", shot: "", ep: "" }); } catch (e) { problems.push(`渲染失败 ${r.path}：${e.message}`); continue; }
  if (!html || typeof html !== "string") { problems.push(`渲染返回非字符串 ${r.path}`); continue; }
  if (bad.test(html)) { const idx = html.search(bad); problems.push(`占位文本 ${r.path}：${(html.match(bad) || [])[0]} · …${html.slice(Math.max(0, idx - 48), idx + 48)}…`); }
  if (html.indexOf('class="page"') < 0) problems.push(`缺少 page 骨架 ${r.path}`);
  const count = (html.match(/data-action="/g) || []).length;
  r.actions = count;
}

/* 权限三层：路由级可见性统计（按钮级由各页面内的 guard/can 控制） */
const roles = DB.roles;
for (const role of roles) {
  const perms = role.perms || [];
  const visible = routes.filter(r => {
    const codes = Array.isArray(r.perm) ? r.perm : [r.perm];
    return !r.perm || codes.some(c => perms.indexOf(c) >= 0);
  });
  console.log(`身份 ${role.code.padEnd(8)} 可见路由 ${String(visible.length).padStart(2)} / ${routes.length}`);
}

/* 分组与路由清单 */
const groups = [...new Set(routes.map(r => r.group))];
console.log(`模块 ${groups.length} 个 · 路由 ${routes.length} 条`);
for (const g of groups) {
  const items = routes.filter(r => r.group === g);
  console.log(`  ${g.padEnd(12)} ${String(items.length).padStart(2)} 条  ${items.map(r => r.path).join(", ")}`);
}

/* 数据范围：每个身份都要能把 64 条路由渲染出来（403 也是合法结果） */
const savedIdentity = sandbox.window.App.identity;
for (const idn of DB.identities) {
  sandbox.window.App.identity = () => idn;
  for (const r of routes) {
    try { r.render({ id: "", shot: "", ep: "" }); }
    catch (e) { problems.push(`身份 ${idn.id || idn.code} 渲染失败 ${r.path}：${e.message}`); }
  }
}
sandbox.window.App.identity = savedIdentity;

if (problems.length) {
  console.error("\n❌ 回归发现问题 " + problems.length + " 项：");
  problems.slice(0, 40).forEach(p => console.error(" - " + p));
  process.exit(1);
}
console.log("\n✅ 回归通过：路由前缀、权限码、渲染、占位文本均无异常");
