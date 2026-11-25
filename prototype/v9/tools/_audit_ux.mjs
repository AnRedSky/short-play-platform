/* tools/_audit_ux.mjs — 交互盘点：每个页面「怎么查、怎么看、怎么改、怎么往下走」
   量化：表行数 / 查询控件（search + seg-chip）/ 页面级按钮 / 行内动作 / 单行最多动作 /
   动作承载分类（抽屉 · 弹窗 · 跳转 · 状态切换 · 导出 · 写入 · 未注册）。
   标记：无查询区（表≥1 且 最长表 ≥10 行 且 无查询控件）、行内过载（单行 ≥3）、
        只读死端（无写入/无跳转/无导出）、页面功能定位。
   用法：node tools/_audit_ux.mjs [--write]（快照 tools/_ia_ux.txt） */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = process.argv.includes("--write");

/* ---------- 动作 → 承载方式（解析 App.on 处理体） ---------- */
const handler = {};
const mods = fs.readdirSync(path.join(root, "modules")).filter((d) => fs.statSync(path.join(root, "modules", d)).isDirectory());
mods.forEach((m) => {
  const src = read(`modules/${m}/pages.js`);
  const hits = [...src.matchAll(/App\.on\(\s*"([^"]+)"\s*,\s*/g)];
  hits.forEach((h, i) => {
    const start = h.index + h[0].length;
    const end = i + 1 < hits.length ? hits[i + 1].index : Math.min(src.length, start + 500);
    handler[h[1]] = src.slice(start, end);
  });
});
const kindOf = (name) => {
  const b = handler[name];
  if (b === undefined) return "未注册";
  if (/App\.drawer\(/.test(b)) return "抽屉";
  if (/App\.(modal|confirm|submitModal)\(/.test(b)) return "弹窗";
  if (/App\.exportCsv\(/.test(b)) return "导出";
  if (/App\.go\(/.test(b)) return "跳转";
  if (/App\.(set|toggle)\(/.test(b) && !/App\.(refresh|toast)\([\s\S]{0,40}(已|成功)/.test(b)) return "状态切换";
  return "写入";
};
/* 全局动作（app.js 里的 common.* / 通用导航） */
const appSrc = read("assets/js/app.js");
const appHits = [...appSrc.matchAll(/\bon\(\s*"([^"]+)"\s*,\s*/g)];
appHits.forEach((h, i) => {
  const start = h.index + h[0].length;
  const end = i + 1 < appHits.length ? appHits[i + 1].index : Math.min(appSrc.length, start + 500);
  handler[h[1]] = appSrc.slice(start, end);
});

/* ---------- 渲染沙箱 ---------- */
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
  mem() { return {}; }, go() {}, toast() {}, modal() {}, confirm() {}, submitModal() {}, drawer() {}, refresh() {}, can() { return true; }, exportCsv() {},
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
const rows = routes.map((route) => {
  Object.keys(state).forEach((k) => delete state[k]);
  CURRENT = { path: route.path, query: route.query && route.query.id ? route.query : { id: "SP-26015" } };
  let html = "";
  try { html = route.render(CURRENT.query) || ""; } catch (e) { html = ""; }
  const head = (html.match(/<header class="page-head">([\s\S]*?)<\/header>/) || [])[1] || "";
  const body = html.replace(head, "");
  const searches = (html.match(/class="search"/g) || []).length;
  const chips = (html.match(/class="seg-chip/g) || []).length;
  const filters = (html.match(/data-filter="/g) || []).length;
  const pageBtns = (head.match(/data-action="/g) || []).length;
  /* 表格行数与单行动作 */
  let maxRows = 0, maxRowBtns = 0, tableCount = 0;
  [...html.matchAll(/<table[\s\S]*?<\/table>/g)].forEach((m) => {
    tableCount++;
    const trs = m[0].split("<tr").slice(2);
    maxRows = Math.max(maxRows, trs.length);
    trs.forEach((tr) => { maxRowBtns = Math.max(maxRowBtns, (tr.match(/data-action="/g) || []).length); });
  });
  const rowActions = (body.match(/data-action="/g) || []).length;
  const actions = [...new Set([...html.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]))];
  const tally = { 抽屉: 0, 弹窗: 0, 跳转: 0, 状态切换: 0, 导出: 0, 写入: 0, 未注册: 0 };
  actions.forEach((a) => { tally[kindOf(a)] = (tally[kindOf(a)] || 0) + 1; });
  const kinds = Object.keys(tally).filter((k) => tally[k]);
  /* 页面功能定位 */
  const role = tableCount && (tally.写入 || tally.弹窗) ? "台账操作型"
    : tableCount ? "只读台账型"
      : (tally.弹窗 || tally.写入) ? "任务型"
        : (tally.跳转 ? "导航页" : "陈列页");
  const flags = [];
  if (tableCount && maxRows >= 10 && (searches + chips + filters) === 0) flags.push("无查询区");
  if (maxRowBtns >= 3) flags.push("行内过载");
  if (!tally.写入 && !tally.弹窗 && !tally.跳转 && !tally.导出) flags.push("只读死端");
  if (kinds.length >= 4) flags.push("承载≥4种");
  return { path: route.path, chars: html.length, tableCount, maxRows, searches, chips, filters, pageBtns, rowActions, maxRowBtns, tally, kinds, role, flags };
});

const flagged = rows.filter((r) => r.flags.length);
const noQuery = rows.filter((r) => r.flags.includes("无查询区"));
const dead = rows.filter((r) => r.flags.includes("只读死端"));
const hot = rows.filter((r) => r.flags.includes("行内过载"));

/* 全局：含「详情 / 查看 / 明细」的按钮，承载方式是否统一 */
const labelKind = {};
mods.forEach((m) => {
  const src = read(`modules/${m}/pages.js`);
  [...src.matchAll(/(?:U\.btn|btn)\(\s*"([^"]*(?:详情|查看|明细|档案)[^"]*)"\s*,\s*"([^"]+)"/g)].forEach((h) => {
    const k = kindOf(h[2]);
    (labelKind[h[1]] = labelKind[h[1]] || {})[k] = (labelKind[h[1]][k] || 0) + 1;
  });
});
const ambiguous = Object.keys(labelKind).filter((l) => Object.keys(labelKind[l]).length > 1);

const L = [];
L.push(`## 交互盘点 · 页面 ${rows.length} 条 · 有标记 ${flagged.length} 条`);
L.push("", "## 页面功能定位");
["台账操作型", "只读台账型", "任务型", "导航页", "陈列页"].forEach((k) => {
  const g = rows.filter((r) => r.role === k);
  L.push(`- ${k} ${g.length} 页：${g.map((r) => r.path).join(" / ") || "—"}`);
});
L.push("", "## 查询能力覆盖");
const withQuery = rows.filter((r) => r.tableCount && (r.searches + r.chips + r.filters) > 0);
L.push(`- 有查询区 ${withQuery.length} 页 / 有表格 ${rows.filter((r) => r.tableCount).length} 页`);
L.push(`- 无查询区且最长表 ≥10 行：**${noQuery.length} 页**`);
noQuery.sort((a, b) => b.maxRows - a.maxRows).forEach((r) => L.push(`  - ${r.path} · 表${r.tableCount} 行${r.maxRows} 页内动作${r.rowActions}`));
L.push("", "## 只读死端（无写入 / 无跳转 / 无导出）");
dead.forEach((r) => L.push(`- ${r.path} · 表${r.tableCount} 行${r.maxRows} · 动作：${r.kinds.join("/") || "无"}`));
L.push("", "## 行内过载（单行 ≥3 个动作）");
hot.forEach((r) => L.push(`- ${r.path} · 单行最多 ${r.maxRowBtns} 个 · 表${r.tableCount}`));
L.push("", "## 同名「详情 / 查看」语义承载不一致");
ambiguous.forEach((l) => L.push(`- ${l} → ${Object.keys(labelKind[l]).map((k) => k + " " + labelKind[l][k]).join(" / ")}`));
L.push("", "## 承载方式分布（按页面动作种类数）");
rows.filter((r) => r.kinds.length >= 4).sort((a, b) => b.kinds.length - a.kinds.length)
  .forEach((r) => L.push(`- ${r.path} · ${r.kinds.length} 种：${r.kinds.map((k) => k + " " + r.tally[k]).join(" / ")}`));
L.push("", "## 明细");
L.push("path\t角色\t表\t最长表行\tsearch\tchip\t页面按钮\t行内动作\t单行最多\t抽屉\t弹窗\t跳转\t写入\t标记");
rows.forEach((r) => L.push([r.path, r.role, r.tableCount, r.maxRows, r.searches, r.chips, r.pageBtns, r.rowActions, r.maxRowBtns, r.tally.抽屉, r.tally.弹窗, r.tally.跳转, r.tally.写入, r.flags.join("、") || "—"].join("\t")));

const txt = L.join("\n");
if (write) fs.writeFileSync(path.join(root, "tools", "_ia_ux.txt"), txt + "\n", "utf8");
console.log(txt.split("## 明细")[0]);

