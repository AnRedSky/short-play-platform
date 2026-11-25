/* tools/_audit_layout.mjs — 页面简洁度与布局骨架盘点
   对每条路由渲染后量化：卡片数 / 指标数 / 表格数（含最多列数）/ 提示条数 / 页面级按钮数 /
   布局容器种类（grid-2/3/4、split、stack、table-only）/ 单卡占比。
   标记：卡 ≥6、指标 ≥5、表格 ≥3、提示 ≥2、表列 ≥9、单卡占页 ≥40%、布局种类 ≥3。
   用法：node tools/_audit_layout.mjs [--write] */
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

const routes = registered.flatMap((c) => c.routes).sort((a, b) => a.path.localeCompare(b.path));
const rows = routes.map((route) => {
  Object.keys(state).forEach((k) => delete state[k]);
  CURRENT = { path: route.path, query: route.query && route.query.id ? route.query : { id: "SP-26015" } };
  let html = "";
  try { html = route.render(CURRENT.query) || ""; } catch (e) { html = ""; }
  const head = (html.match(/<header class="page-head">([\s\S]*?)<\/header>/) || [])[1] || "";
  const cards = (html.match(/<section class="card/g) || []).length;
  const metrics = (html.match(/class="card metric"/g) || []).length;
  const tables = (html.match(/<table/g) || []).length;
  const notices = (html.match(/class="notice/g) || []).length;
  const btns = (head.match(/data-action="/g) || []).length;
  const grids = ["grid-4", "grid-3", "grid-2", "split", "stack"].filter((k) => new RegExp(`class="[^"]*${k}`).test(html)).length;
  /* 最大表格列数 */
  let maxCols = 0;
  [...html.matchAll(/<table[\s\S]*?<\/table>/g)].forEach((m) => {
    const n = (m[0].match(/<th/g) || []).length;
    if (n > maxCols) maxCols = n;
  });
  /* 单卡最大正文（去标签后的字符数） */
  let maxCard = 0;
  [...html.matchAll(/<section class="card[\s\S]*?<\/section>/g)].forEach((m) => {
    const t = m[0].replace(/<[^>]+>/g, "").length;
    if (t > maxCard) maxCard = t;
  });
  const plain = html.replace(/<[^>]+>/g, "").length;
  const flags = [];
  if (cards >= 6) flags.push("卡≥6");
  if (metrics >= 5) flags.push("指标≥5");
  if (tables >= 3) flags.push("表≥3");
  if (notices >= 2) flags.push("提示≥2");
  if (maxCols >= 9) flags.push("列≥9");
  if (plain && maxCard / plain >= 0.4) flags.push("单卡≥40%");
  if (grids >= 3) flags.push("布局≥3种");
  /* 骨架分型：台账型 = 表≥2；看板型 = 指标≥4 且 卡≥4；评审型 = split；否则 详情型 */
  const skeleton = tables >= 2 ? "台账型" : (metrics >= 4 && cards >= 4 ? "看板型" : (/class="[^"]*split/.test(html) ? "评审型" : "详情型"));
  return { path: route.path, chars: html.length, plain, cards, metrics, tables, maxCols, notices, btns, grids, maxCard, skeleton, flags };
});

const flagged = rows.filter((r) => r.flags.length);
const L = [];
L.push(`## 页面 ${rows.length} 条 · 有标记 ${flagged.length} 条`);
L.push("", "## 骨架分布");
["台账型", "看板型", "评审型", "详情型"].forEach((k) => {
  const g = rows.filter((r) => r.skeleton === k);
  L.push(`- ${k} ${g.length} 页：${g.map((r) => r.path).join(" / ")}`);
});
L.push("", "## 标记页（需简化或重排）");
flagged.sort((a, b) => b.chars - a.chars).forEach((r) => L.push(`- ${r.path} · ${r.chars} 字符 · 卡${r.cards} 指${r.metrics} 表${r.tables}(列${r.maxCols}) 提示${r.notices} 按钮${r.btns} 布局${r.grids}种 单卡${(r.maxCard / Math.max(1, r.plain) * 100).toFixed(0)}% → ${r.flags.join(" / ")}`));
L.push("", "## 体量 Top10");
[...rows].sort((a, b) => b.chars - a.chars).slice(0, 10).forEach((r) => L.push(`- ${r.path} ${r.chars}（卡${r.cards} 指${r.metrics} 表${r.tables} 列${r.maxCols} 提示${r.notices}）`));
L.push("", "## 体量 Bottom8");
[...rows].sort((a, b) => a.chars - b.chars).slice(0, 8).forEach((r) => L.push(`- ${r.path} ${r.chars}（卡${r.cards} 指${r.metrics} 表${r.tables}）`));
L.push("", "## 明细");
L.push("path\tchars\t卡\t指标\t表\t列\t提示\t按钮\t布局种\t单卡占比\t骨架");
rows.forEach((r) => L.push([r.path, r.chars, r.cards, r.metrics, r.tables, r.maxCols, r.notices, r.btns, r.grids, (r.maxCard / Math.max(1, r.plain) * 100).toFixed(0) + "%", r.skeleton].join("\t")));

const txt = L.join("\n");
if (write) fs.writeFileSync(path.join(root, "tools", "_ia_layout.txt"), txt + "\n", "utf8");
console.log(txt.split("## 明细")[0]);
