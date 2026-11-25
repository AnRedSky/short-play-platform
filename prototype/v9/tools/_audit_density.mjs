/* tools/_audit_density.mjs — 页面密度复核（R-17 折叠后遗症）
   判定：渲染 < 1400 字符 = 过薄；卡≤1、无表格且 < 3000 字符 = 结构单薄（下钻空态白名单 orgs/member）。
   用法：node tools/_audit_density.mjs [--write] */
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
sandbox.window.AppModule = { register: (c) => registered.push(c) };
sandbox.window.App = {
  on() {}, guard() { return true; }, get(s, k, d) { return (k in state) ? state[k] : d; }, set(s, k, v) { state[k] = v; },
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

const r = registered.flatMap((c) => c.routes).sort((a, b) => a.path.localeCompare(b.path));
const rows = [];
r.forEach((route) => {
  Object.keys(state).forEach((k) => delete state[k]);
  CURRENT = { path: route.path, query: route.query && route.query.id ? route.query : { id: "SP-26015" } };
  let html = "";
  try { html = route.render(CURRENT.query) || ""; } catch (e) { rows.push({ path: route.path, len: -1, cards: 0, notes: 0, err: e.message }); return; }
  const cards = (html.match(/<section class="card/g) || []).length;
  const notes = (html.match(/class="notice/g) || []).length;
  const tables = (html.match(/<table/g) || []).length;
  const EMPTY_OK = ["orgs/member"];
  const thin = !EMPTY_OK.includes(route.path) && (html.length < 1400 || (cards <= 1 && tables === 0 && html.length < 3000));
  rows.push({ path: route.path, len: html.length, cards, notes, tables, thin });
});
const flagged = rows.filter((x) => x.thin || x.err);
const lines = flagged.map((x) => x.err ? `${x.path} 渲染异常 ${x.err}` : `${x.path} · ${x.len} 字符 · 卡 ${x.cards} · 提示 ${x.notes} · 表 ${x.tables}`);
const out = ["## 过薄页面（<1400 字符，或 卡≤1 无表且 <3000）", ...lines, "",
  "## 全部页面体量", ...rows.map((x) => `${x.path}\t${x.len}\t卡${x.cards}\t提示${x.notes}\t表${x.tables}`)].join("\n");
if (write) fs.writeFileSync(path.join(root, "tools", "_ia_density.txt"), out + "\n", "utf8");
console.log(`过薄 ${flagged.length} 页 / 共 ${rows.length} 页`);
console.log(lines.join("\n"));
