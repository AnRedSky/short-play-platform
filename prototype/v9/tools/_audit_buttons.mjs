/* tools/_audit_buttons.mjs — 按钮密度与同动作多文案审计（R-18 / R-31 后半）
   判定口径（与 docs/PLAN-IA-REMEDIATION-V9.7.0.md R-18 一致）：
     ① 同一页（含各 tab）里同一个 data-action 只允许出现 1 个按钮
     ② 同一页独立动作数 ≤ 6（合并页按 tab 分别判定，不叠加）
     ③ 同一动作在全站允许 1 个文案（白名单：common.export / quality.judge / projects.wfDelivery，见 R-19 豁免）
   用法：node tools/_audit_buttons.mjs [--write]
         --write 时把明细写入 tools/_ia_btn2.txt */
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
  get(s, k, d) { return (k in state) ? state[k] : d; },
  set(s, k, v) { state[k] = v; },
  mem() { return {}; }, go() {}, toast() {}, modal() {}, confirm() {}, drawer() {}, refresh() {}, can() { return true; }, exportCsv() {},
  identity() { return sandbox.window.DB.identities.find((i) => i.id === "i-owner"); },
  role() { return sandbox.window.DB.roles[0]; },
  home() { return "workspace/home"; },
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

/* tab / 视图状态键（合并页与 view 型页面） */
const TABS = {
  "projects/list": ["list", "rel"],
  "quality/reports": ["reports", "issues", "gates"],
  "post/delivery": ["delivery", "works"],
  "video/preview": ["preview", "versions"],
  "director/shots": ["table", "board"],
  "assets/library": ["list", "refs"],
  "cost/ledger": ["ledger", "usage"],
  "compliance/risks": ["risks", "dispose"],
  "analytics/enterprise": ["enterprise", "depts", "emps"]
};
const TABKEY = { "director/shots": "view", "projects/list": "rel" };

const WHITELIST_LABELS = ["common.export", "quality.judge", "projects.wfDelivery"]; // 按对象命名 / 判罚选项 / 交付状态互斥 CTA
const WHITELIST_CONTROL = ["video.preview"]; // 画面控件：缩略图磁贴与播放浮层，标签随镜头号/图标变化，不是操作文案

const stripTags = (s) => s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const uniq = (a) => Array.from(new Set(a));
/* 表格行内的按钮是"每行一份"，按设计重复；带 data-value 的按钮是筛选/取值控件（tab、chip、筛选器），
   两者都不计入"同页冗余"判定。R-18 只约束页面级操作按钮。 */
const dropRows = (html) => html.replace(/<tr[\s\S]*?<\/tr>/g, "");
const parseBtns = (html) => [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => {
  const attrs = m[1];
  const action = (attrs.match(/data-action="([^"#]+)"/) || [])[1] || "";
  const value = (attrs.match(/data-value="([^"]*)"/) || [])[1];
  const id = (attrs.match(/data-id="([^"]*)"/) || [])[1];
  const pid = (attrs.match(/data-pid="([^"]*)"/) || [])[1];
  return { action, value, id, pid, label: stripTags(m[2]) };
});

const labelOf = new Map(); // action -> Set(labels)
const lines = [];
let overActions = 0, dupOnPage = 0, sizeBig = 0;

const routes = registered.flatMap((c) => c.routes).sort((a, b) => a.path.localeCompare(b.path));
for (const r of routes) {
  const tabs = ["", ...(TABS[r.path] || [])];
  for (const tab of tabs) {
    Object.keys(state).forEach((k) => delete state[k]);
    if (tab) state[TABKEY[r.path] || "tab"] = tab;
    CURRENT = { path: r.path, query: r.query && r.query.id ? r.query : { id: "SP-26015" } };
    let html = "";
    try { html = r.render(CURRENT.query) || ""; } catch (e) { lines.push(`${r.path} tab=${tab || "-"} 渲染异常 ${e.message}`); continue; }
    const btns = parseBtns(html);
    /* 页面级操作按钮 = 不在表格行内、且不绑定条目（无 value / id / pid）。
       绑定条目或取值的按钮随数据条数重复，属设计行为，不计入 R-18 密度判定。 */
    const ops = parseBtns(dropRows(html)).filter((b) => b.action && !b.value && !b.id && !b.pid);
    const acts = ops.map((b) => b.action);
    const dupes = uniq(acts).filter((a) => acts.filter((x) => x === a).length > 1);
    const distinct = uniq(acts).length;
    ops.forEach((b) => { if (b.label) { if (!labelOf.has(b.action)) labelOf.set(b.action, new Set()); labelOf.get(b.action).add(b.label); } });
    const bad = [];
    if (dupes.length) { dupOnPage += dupes.length; bad.push(`同页重复动作 ${dupes.join(",")}`); }
    if (distinct > 6) { overActions++; bad.push(`动作 ${distinct} > 6 [${uniq(ops.map((b) => b.action || "-")).join(",")}]`); }
    if (html.length >= 12000) { sizeBig++; bad.push(`体量 ${html.length} ≥ 12KB`); }
    lines.push(`${r.path} tab=${tab || "-"} · ${html.length} 字符 · 按钮 ${btns.length}（操作 ${ops.length}）· 独立操作动作 ${distinct}${bad.length ? " · ⚠ " + bad.join(" / ") : " · ok"}`);
  }
}

const multi = [];
for (const [a, set] of labelOf) {
  if (set.size > 1 && !WHITELIST_LABELS.includes(a) && !WHITELIST_CONTROL.includes(a)) multi.push(`${a} → ${[...set].join(" / ")}`);
}

const out = [
  "## 页面按钮密度（每 tab 一行）",
  ...lines,
  "",
  "## 同动作多文案（已剔除 R-19 白名单）",
  multi.length ? multi.join("\n") : "无",
  "",
  `合计：页面快照 ${lines.length} · 同页重复动作 ${dupOnPage} 项 · 动作超 6 的页 ${overActions} 个 · 体量 ≥12KB 的页 ${sizeBig} 个 · 同动作多文案 ${multi.length} 组`
].join("\n");

if (write) fs.writeFileSync(path.join(root, "tools", "_ia_btn2.txt"), out + "\n", "utf8");
console.log(out.split("\n").slice(-6).join("\n"));
console.log(`白名单：${WHITELIST_LABELS.join(" / ")}（R-19 豁免：按对象命名 / 判罚选项 / 交付状态互斥 CTA）`);
if (write) console.log("明细已写入 tools/_ia_btn2.txt");
