/* tools/_audit_overlap.mjs — 页面功能重复复核（IA 复核口径，替代人眼看）
   对 56 条路由逐页渲染，抽取「卡片标题 / 指标名 / 页面级按钮动作 / tab 动作」，输出三类重叠：
     ① 同一卡片标题出现在 ≥2 页      → 同一块内容被两块页面各画一次
     ② 同一指标出现在 ≥3 页          → KPI 口径重复（≥2 页可能是列表与详情，允许）
     ③ 同一动作被 ≥2 页当作页面级按钮 → 双入口（同一件事两处可做）
     ④ 页面相似度（卡片标题 + 指标 + 页面级动作的 Jaccard）≥ 0.5 → 疑似同功能两块皮
   用法：node tools/_audit_overlap.mjs [--write] */
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
  identity() { return sandbox.window.DB.identities.find((i) => i.id === "i-admin"); },
  role() { return sandbox.window.DB.roles.find((r) => r.id === "r-admin") || sandbox.window.DB.roles[0]; }, home() { return "workspace/home"; },
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

const uniq = (a) => [...new Set(a)];
const pick = (html, re) => uniq([...html.matchAll(re)].map((m) => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean));

const routes = registered.flatMap((c) => c.routes).sort((a, b) => a.path.localeCompare(b.path));
const pages = routes.map((route) => {
  Object.keys(state).forEach((k) => delete state[k]);
  CURRENT = { path: route.path, query: route.query && route.query.id ? route.query : { id: SP() } };
  let html = "";
  try { html = route.render(CURRENT.query) || ""; } catch (e) { html = ""; }
  const head = (html.match(/<header class="page-head">([\s\S]*?)<\/header>/) || [])[1] || "";
  return {
    path: route.path,
    title: route.title,
    inMenu: route.menu !== false,
    html,
    cards: pick(html, /<div class="card-title">([\s\S]*?)<\/div>/g),
    metrics: pick(html, /<div class="metric-label">([\s\S]*?)<\/div>/g),
    actions: pick(head, /data-action="([^"]+)"/g),
    allActions: pick(html, /data-action="([^"]+)"/g),
    tabs: pick(html, /data-action="([a-zA-Z]+\.[a-zA-Z]+)"[^>]*data-value/g).filter((a) => a.endsWith(".tab") || a.endsWith(".view") || a.endsWith(".setRel")),
  };
});
function SP() { return "SP-26015"; }

/* 写操作动作集：handler 体内出现 App.modal / confirm / job / drawer 视为写操作 */
const writeActions = new Set();
fs.readdirSync(path.join(root, "modules")).filter((d) => fs.statSync(path.join(root, "modules", d)).isDirectory()).forEach((m) => {
  const src = read(`modules/${m}/pages.js`);
  const parts = src.split(/App\.on\(/).slice(1);
  parts.forEach((part) => {
    const am = part.match(/^"([^"]+)"/);
    if (!am) return;
    if (/App\.(modal|confirm|job|drawer)\(/.test(part.slice(0, 3000))) writeActions.add(am[1]);
  });
});

/* ① 卡片标题跨页 */
const byCard = new Map();
pages.forEach((p) => p.cards.forEach((c) => { if (!byCard.has(c)) byCard.set(c, []); byCard.get(c).push(p.path); }));
const dupCards = [...byCard.entries()].filter(([, ps]) => uniq(ps).length > 1).sort((a, b) => uniq(b[1]).length - uniq(a[1]).length);

/* ② 指标跨页 */
const byMetric = new Map();
pages.forEach((p) => p.metrics.forEach((m) => { const k = m; if (!byMetric.has(k)) byMetric.set(k, []); byMetric.get(k).push(p.path); }));
const dupMetrics = [...byMetric.entries()].map(([m, ps]) => [m, uniq(ps)]).filter(([, ps]) => ps.length >= 3).sort((a, b) => b[1].length - a[1].length);

/* ③ 页面级动作跨页 */
const byAction = new Map();
pages.forEach((p) => p.actions.forEach((a) => { if (!byAction.has(a)) byAction.set(a, []); byAction.get(a).push(p.path); }));
const dupActions = [...byAction.entries()].map(([a, ps]) => [a, uniq(ps)]).filter(([, ps]) => ps.length >= 2).sort((a, b) => b[1].length - a[1].length);

/* ③b 写操作跨页：同一「写动作」被 ≥2 个菜单页引用 = 同一件事两处可改 */
const byWrite = new Map();
pages.forEach((p) => { if (!p.inMenu) return; p.allActions.forEach((a) => { if (!writeActions.has(a)) return; if (!byWrite.has(a)) byWrite.set(a, []); byWrite.get(a).push(p.path); }); });
const dupWrites = [...byWrite.entries()].map(([a, ps]) => [a, uniq(ps)]).filter(([, ps]) => ps.length >= 2).sort((a, b) => b[1].length - a[1].length);

/* ④ 页面相似度 */
const pairs = [];
for (let i = 0; i < pages.length; i++) {
  for (let j = i + 1; j < pages.length; j++) {
    const A = new Set([...pages[i].cards, ...pages[i].metrics, ...pages[i].actions]);
    const B = new Set([...pages[j].cards, ...pages[j].metrics, ...pages[j].actions]);
    const inter = [...A].filter((x) => B.has(x)).length;
    const uni = new Set([...A, ...B]).size;
    if (uni === 0) continue;
    const sim = inter / uni;
    if (sim >= 0.5) pairs.push([pages[i].path, pages[j].path, sim, inter]);
  }
}

const L = [];
L.push(`## 路由 ${pages.length} 条 · 菜单内 ${pages.filter((p) => p.inMenu).length} 条 · 下钻 ${pages.filter((p) => !p.inMenu).length} 条`, "");
L.push("## ① 同名卡片跨页（同一块内容被两页各画一次）");
if (!dupCards.length) L.push("无");
dupCards.forEach(([c, ps]) => L.push(`- ${c} × ${uniq(ps).length}：${uniq(ps).join(" / ")}`));
L.push("", "## ② 同名指标 ≥3 页");
if (!dupMetrics.length) L.push("无");
dupMetrics.forEach(([m, ps]) => L.push(`- ${m} × ${ps.length}：${ps.join(" / ")}`));
L.push("", "## ③ 同一动作被 ≥2 页当作页面级按钮（双入口）");
const kindOf = (a) => {
  if (a === "common.export") return "页面本地导出（各页导出自己的数据集）";
  if (a === "projects.new") return "全局创建入口（首页 CTA 与项目列表）";
  if (/^common\.|\.to[A-Z]|toList$|toQueue$|toRisks$|wfOpen$|detail$|Link$/.test(a)) return "导航到同一目的地";
  return "业务动作（真双入口）";
};
const realDup = dupActions.filter(([a]) => kindOf(a) === "业务动作（真双入口）");
if (!realDup.length) L.push("无（其余均为导航 / 页面本地导出 / 全局创建入口）");
realDup.forEach(([a, ps]) => L.push(`- ${a} × ${ps.length}：${ps.join(" / ")}`));
L.push("", "### 允许重复的三类");
dupActions.filter(([a]) => kindOf(a) !== "业务动作（真双入口）").forEach(([a, ps]) => L.push(`- ${a} × ${ps.length}（${kindOf(a)}）：${ps.join(" / ")}`));
L.push("", "## ③b 写操作被 ≥2 个菜单页引用（同一件事两处可改）");
if (!dupWrites.length) L.push("无");
dupWrites.forEach(([a, ps]) => L.push(`- ${a} × ${ps.length}：${ps.join(" / ")}`));
L.push("", "## ④ 页面相似度 ≥0.5（疑似同功能两块皮）");
if (!pairs.length) L.push("无");
pairs.sort((a, b) => b[2] - a[2]).forEach(([a, b, s, n]) => L.push(`- ${a} ↔ ${b} 相似度 ${(s * 100).toFixed(0)}%（共有 ${n} 项）`));
L.push("", "## ⑤ 页面功能清单（供人工判定重叠）");
pages.forEach((p) => {
  L.push(`- ${p.path}${p.inMenu ? "" : "（下钻）"} · 卡 ${p.cards.length}：${p.cards.join(" | ") || "—"}`);
  L.push(`    页面级动作：${p.actions.join(" / ") || "—"}${p.tabs.length ? " ｜ tab：" + p.tabs.join(" / ") : ""}`);
});

const txt = L.join("\n");
if (write) fs.writeFileSync(path.join(root, "tools", "_ia_overlap.txt"), txt + "\n", "utf8");
console.log(txt);
