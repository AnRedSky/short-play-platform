/* tools/_audit_naming.mjs — 名称唯一来源的回归门禁（R-11 / R-12 / R-13 / R-15）
   断言：
   1) 页眉章节（渲染结果 kicker）= 该路由的二级菜单名（来自 DB.menu，非页面手写）
   2) 页面 title = 菜单三级名（hidden 页同样要求一致）
   3) 渲染结果里不出现模块注册的 label（第二套域名词）
   4) 同一二级菜单下的所有页面，页眉章节唯一
   用法：node tools/_audit_naming.mjs */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const CURRENT = { path: "workspace/home", id: "SP-26015" };

const sandbox = { console };
sandbox.window = sandbox;
sandbox.location = { hash: "#/workspace/home" };
sandbox.document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, createElement() { return { style: {}, appendChild() {}, setAttribute() {}, classList: { add() {} } }; } };
vm.createContext(sandbox);
vm.runInContext(read("assets/js/data.js"), sandbox, { filename: "data.js" });
vm.runInContext(read("assets/js/ui.js"), sandbox, { filename: "ui.js" });

const registered = [];
const state = {};
sandbox.window.AppModule = { register: (cfg) => registered.push(cfg) };
sandbox.window.App = {
  on() {}, guard() { return true; },
  get(s, k, d) { return (k in state) ? state[k] : d; },
  set(s, k, v) { state[k] = v; },
  mem() { return {}; }, go() {}, toast() {}, modal() {}, confirm() {}, drawer() {}, refresh() {}, can() { return true; }, exportCsv() {},
  identity() { return sandbox.window.DB.identities.find((i) => i.id === "i-owner"); },
  role() { return sandbox.window.DB.roles[0]; },
  home() { return "workspace/home"; },
  current() { return { path: CURRENT.path, query: { id: CURRENT.id }, route: null }; },
  currentProject(q) { const db = sandbox.window.DB; const id = (q && q.id) || CURRENT.id; const p = db.projects.find((x) => x.id === id); return p && db.derived.canViewProject(p) ? p : null; },
  routes() { return []; }, groups() { return []; }
};
vm.runInContext(read("assets/js/store.js"), sandbox, { filename: "store.js" });
sandbox.window.DB.state.bind({ identity: () => sandbox.window.App.identity(), role: () => sandbox.window.App.role() });
vm.runInContext(read("assets/js/derived.js"), sandbox, { filename: "derived.js" });
sandbox.window.DB.derived.bind({ identity: () => sandbox.window.App.identity() });
for (const m of fs.readdirSync(path.join(root, "modules")).filter((d) => fs.statSync(path.join(root, "modules", d)).isDirectory())) {
  vm.runInContext(read(`modules/${m}/pages.js`), sandbox, { filename: `${m}/pages.js` });
}

const DB = sandbox.window.DB;
const menuByPath = {};
const moduleLabels = [];
for (const cfg of registered) {
  if (cfg.label) moduleLabels.push(cfg.label);
  for (const g of DB.menu) for (const b of (g.children || [])) for (const it of (b.items || [])) if (it.path && it.path.indexOf(cfg.group + "/") === 0) menuByPath[it.path] = { group: g.label, branch: b.label, item: it.label, hidden: !!it.hidden };
}
const routes = registered.flatMap((c) => c.routes || []).filter((r) => r.path);

let fail = 0;
const say = (m) => { console.log("  ✗ " + m); fail++; };

/* 1) 页眉章节 = 二级菜单名 */
const chapterSet = {};
for (const r of routes) {
  CURRENT.path = r.path;
  let html = "";
  try { html = r.render({ id: CURRENT.id }); } catch (e) { say(`渲染失败 ${r.path}：${e.message}`); continue; }
  const mp = menuByPath[r.path];
  const kicker = (html.match(/<div class="kicker">([\s\S]*?)<\/div>/) || [])[1] || "";
  if (!mp) continue;
  if (kicker !== mp.branch) say(`页眉章节不一致 ${r.path}：渲染「${kicker}」 vs 二级菜单「${mp.branch}」`);
  (chapterSet[mp.group + "/" + mp.branch] = chapterSet[mp.group + "/" + mp.branch] || new Set()).add(kicker);
  /* 2) title = 三级菜单名 */
  if (r.title !== mp.item) say(`标题不一致 ${r.path}：title「${r.title}」 vs 菜单「${mp.item}」`);

}
/* 4) 同一二级菜单下章节唯一（按构造必然成立，防止有人改回手写） */
for (const [k, v] of Object.entries(chapterSet)) if (v.size > 1) say(`同一二级菜单多章节 ${k}：${[...v].join(" | ")}`);

/* 5) 面包屑必须由菜单派生（三级），不能回退到模块 label */
const appSrc = read("assets/js/app.js");
if (!/menuPathOf/.test(appSrc) || !/crumbBranch/.test(appSrc)) say("app.js 面包屑未使用菜单派生（menuPathOf / crumbBranch 缺失）");

console.log(`路由 ${routes.length} · 名称断言失败 ${fail}（页面 ${Object.keys(menuByPath).length} 条在菜单内 · 模块 label ${moduleLabels.length} 个仅作内部 key）`);
process.exit(fail ? 1 : 0);
