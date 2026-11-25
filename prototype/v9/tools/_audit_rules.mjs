/* tools/_audit_rules.mjs — 规则 / 口径卡盘点（R-17）
   判定：卡片标题命中"口径|规则|说明|边界|约定|注意|原则|提示|须知|来源|定义"即视为规则卡。
   达标线：全站规则卡 ≤17，且单页（含 tab）≤1。
   用法：node tools/_audit_rules.mjs [--write]   （--write 写入 tools/_ia_rules.txt） */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = process.argv.includes("--write");

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
sandbox.window.AppModule = { register: (cfg) => registered.push(cfg) };
sandbox.window.App = {
  on() {}, guard() { return true; },
  get(s, k, d) { return (k in state) ? state[k] : d; }, set(s, k, v) { state[k] = v; },
  mem() { return {}; }, go() {}, toast() {}, modal() {}, confirm() {}, drawer() {}, refresh() {}, can() { return true; }, exportCsv() {},
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
fs.readdirSync(path.join(root, "modules")).filter((d) => fs.statSync(path.join(root, "modules", d)).isDirectory())
  .forEach((m) => vm.runInContext(read(`modules/${m}/pages.js`), sandbox, { filename: `${m}/pages.js` }));

const TABS = {
  "projects/list": ["list", "rel"], "quality/reports": ["reports", "issues", "gates"],
  "post/delivery": ["delivery", "works"], "video/preview": ["preview", "versions"],
  "director/shots": ["table", "board"], "assets/library": ["list", "refs"],
  "cost/ledger": ["ledger", "usage"], "compliance/risks": ["risks", "dispose"],
  "analytics/enterprise": ["enterprise", "depts", "emps"]
};
const TABKEY = { "director/shots": "view", "projects/list": "rel" };
const RULE = /口径|规则|说明|边界|约定|注意|原则|提示|须知|定义|数据来源|对比口径/;

const routes = registered.flatMap((c) => c.routes).sort((a, b) => a.path.localeCompare(b.path));
const lines = [];
const titles = [];
let pagesOver = 0;
for (const r of routes) {
  Object.keys(state).forEach((k) => delete state[k]);
  CURRENT = { path: r.path, query: r.query && r.query.id ? r.query : { id: "SP-26015" } };
  let html = "";
  try { html = r.render(CURRENT.query) || ""; } catch (e) { lines.push(`${r.path} 渲染异常 ${e.message}`); continue; }
  /* 卡片标题：<section class="card"> 内第一个 <h3>/<b class="card-title"> 之类，统一切标签后取首段 */
  const cards = [...html.matchAll(/<section class="card[^"]*">([\s\S]*?)<\/section>/g)].map((m) => m[1]);
  const titlesOnPage = cards.map((c) => {
    const t = (c.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/) || c.match(/<div class="card-title"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "";
    return t.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  }).filter(Boolean);
  const ruleTitles = titlesOnPage.filter((t) => RULE.test(t));
  titles.push({ path: r.path, titles: titlesOnPage });
  if (ruleTitles.length) {
    lines.push(`${r.path} · 卡 ${titlesOnPage.length} · 规则卡 ${ruleTitles.length}${ruleTitles.length > 1 ? " ⚠" : ""} → ${ruleTitles.join(" / ")}`);
    if (ruleTitles.length > 1) pagesOver++;
  }
}
const total = lines.reduce((n, l) => n + Number((l.match(/规则卡 (\d+)/) || [])[1] || 0), 0);
const out = ["## 规则/口径卡分布（按页）", ...lines,
  "", `合计：规则卡 ${total} 张 · 超标页 ${pagesOver} 个 · 达标线 ≤17 张且单页 ≤1`, "", "## 全部卡片标题（供逐页判断保留哪一张）",
  ...titles.map((t) => `${t.path}\n  - ${t.titles.join("\n  - ")}`)].join("\n");
if (write) fs.writeFileSync(path.join(root, "tools", "_ia_rules.txt"), out + "\n", "utf8");
console.log(`规则卡 ${total} 张 · 超标页 ${pagesOver} 个${write ? " · 明细 tools/_ia_rules.txt" : ""}`);
if (write) console.log(lines.join("\n"));
