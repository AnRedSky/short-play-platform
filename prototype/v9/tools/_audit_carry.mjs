/* tools/_audit_carry.mjs — 承载方式选择核查：页面跳转 / 抽屉 / 弹窗 该用哪个
   对每个已注册动作解析处理体，抽取：承载类型、弹窗字段数、抽屉字段数、任务步骤数、目标路由。
   再对每条路由汇总入边（谁跳进来）、体量、写入动作数。
   标记：
   - 「弹窗过重」：弹窗字段 ≥6，或弹窗内含表格/挑选列表
   - 「跳转过碎」：目标页体量 <3000 且无写入动作，且只有 1 条入边（看一眼就走的详情）
   - 「抽屉过载」：抽屉字段 ≥12 或抽屉内写动作 ≥3
   - 「跳转无回程」：目标页没有返回/上一步类跳转
   用法：node tools/_audit_carry.mjs [--write]（快照 tools/_ia_carry.txt） */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = process.argv.includes("--write");
const mods = fs.readdirSync(path.join(root, "modules")).filter((d) => fs.statSync(path.join(root, "modules", d)).isDirectory());

/* ---------- 动作处理体 ---------- */
const handler = {};
const collect = (src, re) => {
  const hits = [...src.matchAll(re)];
  hits.forEach((h, i) => { handler[h[1]] = src.slice(h.index + h[0].length, i + 1 < hits.length ? hits[i + 1].index : src.length); });
};
mods.forEach((m) => collect(read(`modules/${m}/pages.js`), /App\.on\(\s*"([^"]+)"\s*,\s*/g));
collect(read("assets/js/app.js"), /\bon\(\s*"([^"]+)"\s*,\s*/g);

const fields = (b) => (b.match(/U\.(fField|fSelect|fTextarea|fCheck|radioCards)\(/g) || []).length;
const descRows = (b) => {
  const m = b.match(/U\.desc\(\[[\s\S]*?\]\)/);
  return m ? (m[0].match(/\["/g) || []).length : 0;
};
const jobSteps = (b) => {
  const m = b.match(/steps:\s*\[([\s\S]*?)\]/);
  return m ? (m[1].match(/"/g) || []).length / 2 : 0;
};
const target = (b) => {
  const m = b.match(/App\.go\(\s*"([^"]+)"/);
  return m ? m[1] : "";
};
const kindOf = (name) => {
  const b = handler[name] || "";
  if (/App\.drawer\(/.test(b)) return "抽屉";
  if (/App\.(modal|confirm|submitModal)\(/.test(b)) return "弹窗";
  if (/App\.exportCsv\(/.test(b)) return "导出";
  if (/App\.go\(/.test(b)) return "页面跳转";
  if (/App\.(set|toggle)\(/.test(b)) return "页面内切换";
  return "写入";
};

const actions = Object.keys(handler).map((name) => {
  const b = handler[name];
  return {
    name, kind: kindOf(name), fields: fields(b), descRows: descRows(b), steps: jobSteps(b), target: target(b),
    hasTable: /U\.table\(/.test(b), hasPick: /<select/.test(b), wide: /wide:\s*true/.test(b)
  };
});

/* ---------- 页面渲染统计 ---------- */
const sandbox = { console };
sandbox.window = sandbox;
sandbox.location = { hash: "#/" };
sandbox.document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, createElement() { return { style: {}, appendChild() {}, setAttribute() {}, classList: { add() {} } }; } };
vm.createContext(sandbox);
vm.runInContext(read("assets/js/data.js"), sandbox, { filename: "data.js" });
vm.runInContext(read("assets/js/ui.js"), sandbox, { filename: "ui.js" });
const registered = [];
const state = {};
let CURRENT = { path: "", query: {} };
sandbox.window.AppModule = { register: (c) => registered.push(c) };
sandbox.window.App = {
  on() {}, guard() { return true; }, get(s, k, d) { return (k in state) ? state[k] : d; }, set(s, k, v) { state[k] = v; }, mem() { return {}; },
  go() {}, toast() {}, modal() {}, confirm() {}, drawer() {}, refresh() {}, can() { return true; }, exportCsv() {},
  identity() { return sandbox.window.DB.identities.find((i) => i.id === "i-owner"); },
  role() { return sandbox.window.DB.roles[0]; }, home() { return "workspace/home"; },
  current() { return { path: CURRENT.path, query: CURRENT.query, route: null }; },
  currentProject(q) { const db = sandbox.window.DB; return db.projects.find((p) => p.id === ((q && q.id) || "SP-26015")) || null; },
  routes() { return registered.flatMap((c) => c.routes); }, groups() { return []; }
};
vm.runInContext(read("assets/js/store.js"), sandbox, { filename: "store.js" });
sandbox.window.DB.state.bind({ identity: () => sandbox.window.App.identity(), role: () => sandbox.window.App.role() });
vm.runInContext(read("assets/js/derived.js"), sandbox, { filename: "derived.js" });
sandbox.window.DB.derived.bind({ identity: () => sandbox.window.App.identity() });
mods.forEach((m) => vm.runInContext(read(`modules/${m}/pages.js`), sandbox, { filename: `${m}/pages.js` }));

const routes = registered.flatMap((c) => c.routes).sort((a, b) => a.path.localeCompare(b.path));
const pages = routes.map((route) => {
  Object.keys(state).forEach((k) => delete state[k]);
  /* 下钻页的 query 形态不同：员工档案要人 id，立项页不需要 id */
  const q = route.path === "orgs/member" ? { id: "u-03" } : (route.query && route.query.id ? route.query : { id: "SP-26015" });
  CURRENT = { path: route.path, query: q };
  let html = "";
  try { html = route.render(CURRENT.query) || ""; } catch (e) { html = ""; }
  const acts = [...new Set([...html.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]))];
  const writeCount = acts.filter((a) => ["写入", "弹窗"].indexOf(kindOf(a)) >= 0).length;
  return { path: route.path, chars: html.length, writeCount };
});
const inEdges = {};
actions.filter((a) => a.kind === "页面跳转" && a.target).forEach((a) => {
  const t = a.target.split("?")[0];
  inEdges[t] = inEdges[t] || [];
  inEdges[t].push(a.name);
});

/* ---------- 标记 ---------- */
const heavyModal = actions.filter((a) => a.kind === "弹窗" && !a.wide && (a.fields >= 6 || a.hasTable));
const thinJump = actions.filter((a) => a.kind === "页面跳转" && a.target)
  .map((a) => ({ ...a, page: pages.find((p) => p.path === a.target.split("?")[0]) }))
  .filter((a) => a.page && a.page.chars < 3000 && a.page.writeCount === 0 && (inEdges[a.page.path] || []).length === 1);
const heavyDrawer = actions.filter((a) => a.kind === "抽屉" && (a.descRows >= 12 || (handler[a.name].match(/U\.btn\(/g) || []).length >= 6));

const counts = { 页面跳转: 0, 抽屉: 0, 弹窗: 0, 页面内切换: 0, 写入: 0, 导出: 0 };
actions.forEach((a) => counts[a.kind]++);

const L = [];
L.push(`## 承载核查 · 动作 ${actions.length} 条 · 路由 ${pages.length} 条`);
L.push("", "## 承载分布");
Object.keys(counts).forEach((k) => L.push(`- ${k}：${counts[k]} 条`));
L.push("", `## 弹窗过重（字段 ≥6 或弹窗内含表格）· ${heavyModal.length} 条`);
heavyModal.forEach((a) => L.push(`- ${a.name} · 字段${a.fields}${a.hasTable ? " · 含表格" : ""}${a.steps ? " · 步骤" + a.steps : ""}`));
L.push("", `## 跳转过碎（目标页 <3000 字符、无写入、仅 1 条入边）· ${thinJump.length} 条`);
thinJump.forEach((a) => L.push(`- ${a.name} → ${a.page.path}（${a.page.chars} 字符，无写入动作，入边仅此 1 条）`));
L.push("", `## 抽屉过载（字段 ≥12 或动作 ≥4）· ${heavyDrawer.length} 条`);
heavyDrawer.forEach((a) => L.push(`- ${a.name} · 字段${a.descRows} · 动作${(handler[a.name].match(/U\.btn\(/g) || []).length}`));
L.push("", "## 入边为 0 的页面（只能从菜单进入，下钻缺失）");
pages.filter((p) => !inEdges[p.path]).forEach((p) => L.push(`- ${p.path} · ${p.chars} 字符`));
L.push("", "## 明细");
L.push("action\tkind\t字段\t抽屉字段\t步骤\t目标\t含表");
actions.forEach((a) => L.push([a.name, a.kind, a.fields, a.descRows, a.steps, a.target || "—", a.hasTable ? "是" : ""].join("\t")));

const txt = L.join("\n");
if (write) fs.writeFileSync(path.join(root, "tools", "_ia_carry.txt"), txt + "\n", "utf8");
console.log(txt.split("## 明细")[0]);
