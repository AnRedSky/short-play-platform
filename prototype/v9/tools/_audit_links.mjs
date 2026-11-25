/* tools/_audit_links.mjs — 页面内链与路由注册的静态交叉检查。
   渲染每个路由（带基线项目上下文），提取 a[href^="#/"]，验证目标路由存在；
   同时统计每页跳转目标与后续业务动作数量，暴露“只展示不落地”的页面。
   用法：node tools/_audit_links.mjs */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const CURRENT = { id: "" };
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
  current() { return { path: "", query: CURRENT, route: null }; },
  currentProject(q) {
    const db = sandbox.window.DB;
    const id = (q && q.id) || CURRENT.id;
    if (id) { const p = db.projects.find(x => x.id === id); return p && db.derived.canViewProject(p) ? p : null; }
    return db.derived.visibleProjects()[0] || null;
  },
  routes() { return []; }, groups() { return []; }
};
/* 载入真实状态层与派生层，保证链接检查基于真实枚举与门禁 */
vm.runInContext(read("assets/js/store.js"), sandbox, { filename: "store.js" });
sandbox.window.DB.state.bind({
  identity: () => sandbox.window.DB.identities.find(i => i.id === "i-owner"),
  role: () => sandbox.window.DB.roles.find(r => r.code === "owner")
});
vm.runInContext(read("assets/js/derived.js"), sandbox, { filename: "derived.js" });
sandbox.window.DB.derived.bind({ identity: () => sandbox.window.DB.identities.find(i => i.id === "i-owner") });
for (const m of fs.readdirSync(path.join(root, "modules")).filter(d => fs.statSync(path.join(root, "modules", d)).isDirectory())) {
  vm.runInContext(read(`modules/${m}/pages.js`), sandbox, { filename: `${m}/pages.js` });
}
const UI = sandbox.window.UI;
const routes = [];
for (const cfg of registered) for (const r of cfg.routes || []) routes.push({ path: r.path, group: cfg.group, title: r.title, render: r.render });
const routeSet = new Set(routes.map(r => r.path));
const problems = [];
let links = 0;
let actions = 0;
const noAction = [];
for (const r of routes) {
  let html = "";
  try { html = r.render({ id: r.group === "post" ? "SP-26031" : "SP-26031", ep: "17", shot: "SH-26031-E17-03" }); } catch (e) { problems.push(`渲染失败 ${r.path}：${e.message}`); continue; }
  const hrefs = [...html.matchAll(/href="#\/([^"]+)"/g)].map(m => m[1]);
  links += hrefs.length;
  for (const raw of hrefs) {
    const href = raw.split("?")[0];
    if (!routeSet.has(href)) problems.push(`内链失效 ${r.path} → ${raw}`);
  }
  const actCount = (html.match(/data-action="[^"]+"/g) || []).length;
  actions += actCount;
  if (!hrefs.length && !actCount) noAction.push(`${r.path}（${r.title}）`);
}
console.log(`路由 ${routes.length} · 内链 ${links} · 动作 ${actions} · 失效内链 ${problems.length}`);
for (const p of problems) console.log("  ✗ " + p);
console.log("无跳转且无动作的页面：" + (noAction.length ? "\n  " + noAction.join("\n  ") : "无"));

/* LEGACY 转发校验：被并掉的旧地址必须映射到一个仍然存在、且能渲染出内容的宿主页 */
const appSrc = read("assets/js/app.js");
const legacyBlock = appSrc.match(/LEGACY\s*=\s*\{([\s\S]*?)\}/);
if (!legacyBlock) {
  console.log("  ✗ 未找到 LEGACY 映射表");
} else {
  const pairs = [...legacyBlock[1].matchAll(/["']?([\w/-]+)["']?\s*:\s*["']([\w/-]+)["']/g)].map(m => [m[1], m[2]]);
  let ok = 0;
  for (const [from, to] of pairs) {
    if (routeSet.has(from)) { console.log(`  ✗ 旧地址仍在路由表：${from}`); continue; }
    if (!routeSet.has(to)) { console.log(`  ✗ 转发目标不存在：${from} → ${to}`); continue; }
    const host = routes.find(r => r.path === to);
    let html = "";
    try { html = host.render({ id: "SP-26031", ep: "17", shot: "SH-26031-E17-03" }); } catch (e) { console.log(`  ✗ 宿主页渲染失败：${to}（${e.message}）`); continue; }
    if (html.length < 500) { console.log(`  ✗ 宿主页渲染过短：${from} → ${to}（${html.length} 字符）`); continue; }
    ok++;
  }
  console.log(`LEGACY 转发 ${pairs.length} 条 · 通过 ${ok} · 异常 ${pairs.length - ok}`);
}
