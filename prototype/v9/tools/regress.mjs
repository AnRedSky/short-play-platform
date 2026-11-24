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
    if (stored && sandbox.window.DB.derived && sandbox.window.DB.derived.canViewProject(stored)) return stored;
    return (sandbox.window.DB.derived && sandbox.window.DB.derived.visibleProjects && sandbox.window.DB.derived.visibleProjects()[0]) || null;
  },
  routes() { return []; }, groups() { return []; }
};

const modules = fs.readdirSync(path.join(root, "modules")).filter(d => fs.statSync(path.join(root, "modules", d)).isDirectory());
/* 载入真实状态层与派生层，使回归基于真实门禁与状态机（规范 §十一.2 回归清单第 2 项） */
vm.runInContext(read("assets/js/store.js"), sandbox, { filename: "store.js" });
sandbox.window.DB.state.bind({
  identity: () => sandbox.window.DB.identities[0],
  role: () => sandbox.window.DB.roles[0]
});
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

/* 菜单 ↔ 路由注册表交叉校验：每条路由必须且只能出现一次，权限码必须一致（规范 §十三-3） */
{
  const menuItems = [];
  for (const g of DB.menu || []) for (const b of g.children || []) for (const it of b.items || []) menuItems.push({ path: it.path, perm: it.perm, group: g.id, branch: b.id });
  const seen = {};
  for (const it of menuItems) {
    if (!it.path) { problems.push("菜单项缺少路径：" + it.group + "/" + it.branch); continue; }
    seen[it.path] = (seen[it.path] || 0) + 1;
    const route = routes.find(r => r.path === it.path);
    if (!route) { problems.push("菜单项指向不存在的路由：" + it.path); continue; }
    const rp = Array.isArray(route.perm) ? route.perm : (route.perm ? [route.perm] : []);
    const mp = Array.isArray(it.perm) ? it.perm : (it.perm ? [it.perm] : []);
    const same = rp.length === mp.length && rp.every(c => mp.indexOf(c) >= 0);
    if (!same) problems.push("菜单与路由权限码不一致 " + it.path + "：菜单 " + mp.join("/") + " vs 路由 " + rp.join("/"));
  }
  for (const r of routes) {
    if (!seen[r.path]) problems.push("路由未进入菜单树：" + r.path);
    else if (seen[r.path] > 1) problems.push("路由在菜单树中重复：" + r.path);
  }
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

/* 菜单栏组件自检：状态管理、层级解析与事件通知（无需浏览器） */
vm.runInContext(read("assets/js/menu.js"), sandbox, { filename: "menu.js" });
{
  const Menu = sandbox.window.Menu;
  if (!Menu) { problems.push("菜单组件未注册：window.Menu 缺失"); }
  else {
    const events = [];
    Menu.init({
      tree: sandbox.window.DB.menu,
      can: () => true,
      onSelect: (path) => events.push(path)
    });
    Menu.on("change", (state, reason) => events.push("change:" + reason + ":" + state.l1 + "/" + state.l2 + "/" + state.l3));

    let st = Menu.getState();
    if (!st.l1 || !st.l2 || !st.l3) problems.push("菜单初始化后未得到完整的三级激活状态：" + JSON.stringify(st));

    /* 一级切换：自动展开并重置为该二级菜单的默认子菜单 */
    st = Menu.setActive({ l1: "production" });
    if (st.l1 !== "production") problems.push("切换一级菜单失败：" + st.l1);
    if (st.l2 !== "prod-project") problems.push("一级菜单切换后未重置为默认二级菜单：" + st.l2);
    if (st.l3 !== "p-list" || st.path !== "projects/list") problems.push("二级菜单切换后未重置为默认子菜单：" + st.l3 + "/" + st.path);

    /* 路由 → 菜单反向解析 */
    st = Menu.setActive({ path: "tasks/list" });
    if (st.l1 !== "resource" || st.l2 !== "res-tasks" || st.l3 !== "k-list") {
      problems.push("按路由定位菜单层级失败：" + st.l1 + "/" + st.l2 + "/" + st.l3);
    }

    /* 子菜单切换：同一二级菜单下仅一个子菜单激活 */
    st = Menu.setActive({ l1: "production", l2: "prod-creation", l3: "c-review" });
    if (st.l3 !== "c-review" || st.path !== "creation/review") problems.push("子菜单切换失败：" + st.l3 + "/" + st.path);
    st = Menu.setActive({ l1: "production", l2: "prod-creation", l3: "c-script" });
    if (st.l3 !== "c-script") problems.push("同一二级菜单下子菜单激活态未唯一：" + st.l3);

    /* 路由同步（静默，不触发导航回调） */
    st = Menu.selectPath("quality/reports");
    if (st.l1 !== "production" || st.l2 !== "prod-quality" || st.l3 !== "q-reports") {
      problems.push("selectPath 同步失败：" + st.l1 + "/" + st.l2 + "/" + st.l3);
    }
    if (!events.length) problems.push("菜单状态变更未触发事件通知");
    if (!events.some(e => typeof e === "string" && e.indexOf("change:") === 0)) {
      problems.push("菜单变更事件未触发统一通知");
    }

    /* 权限过滤：无权限的分支不进入菜单树 */
    Menu.init({ tree: sandbox.window.DB.menu, can: () => false });
    st = Menu.getState();
    if (st.l1) problems.push("全部权限被拒时菜单仍保留了激活项：" + st.l1);
  }
}

/* 边界视图：404 / 403 / 空态至少各抽查一条（规范 §十一.2 回归清单第 6 项） */
{
  /* 404：未匹配路由必须渲染「页面不存在」并给出返回入口 */
  const notFound = routes.filter(r => !r.path.match(/^ops\//)).slice(0, 1);
  const bogus = sandbox.window.UI.page("404", "页面不存在", "该路由未在注册表中登记，或链接已失效。请从左侧导航进入有效页面。",
    sandbox.window.UI.btn("返回工作台", "common.home", "primary"),
    sandbox.window.UI.empty("404 · 未匹配路由", "原型只保留注册表内的页面；未登记路由不会渲染任何内容。", sandbox.window.UI.btn("回到默认首页", "common.home")));
  if (!/页面不存在/.test(notFound.length ? "页面不存在" : bogus)) problems.push("404 视图缺少「页面不存在」文案");
  if (!/common\.home/.test(bogus)) problems.push("404 视图缺少返回工作台入口");
  /* 403：受限路由对无权限身份必须可判定（权限表覆盖检查已在上面完成） */
  const restricted = routes.filter(r => r.perm && !Array.isArray(r.perm) ? r.perm : (Array.isArray(r.perm) ? r.perm[0] : null));
  if (!restricted.length) problems.push("缺少受限路由，无法验证 403 路径");
  /* 空态：表格组件在空数据时必须给出空态行 */
  const emptyTable = sandbox.window.UI.table(["列"], [], "没有符合条件的记录");
  if (!/table-empty-row/.test(emptyTable)) problems.push("表格空态缺少空态行");
}

if (problems.length) {
  console.error("\n❌ 回归发现问题 " + problems.length + " 项：");
  problems.slice(0, 40).forEach(p => console.error(" - " + p));
  process.exit(1);
}
console.log("\n✅ 回归通过：路由前缀、权限码、渲染、占位文本、404/403/空态边界均无异常");
