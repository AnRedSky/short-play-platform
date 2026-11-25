/* tools/_audit_chain.mjs — 短剧制作全流程链路审计（v2：按真实动作处理器建图）。
   数据来源不是手写清单，而是模块注册的函数体：
   - 每个页面渲染出的 data-action 清单；
   - 每个动作处理器源码中的 App.go("…")（跳转）、App.modal/confirm/drawer（弹窗与抽屉）、App.set（状态）。
   由此得到「功能承载分布 / 链路跳数 / 入边 / 死端 / 死表单 / 弹窗重名」六类硬指标。
   用法：node tools/_audit_chain.mjs [--write] */
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
const handlers = {};
sandbox.window.AppModule = { register: (cfg) => registered.push(cfg) };
sandbox.window.App = {
  on(name, fn) { handlers[name] = fn; },
  guard() { return true; }, get(s, k, d) { return d; }, set() {}, mem() { return {}; },
  go() {}, toast() {}, modal() {}, confirm() {}, drawer() {}, refresh() {}, can() { return true; }, exportCsv() {},
  identity() { return sandbox.window.DB.identities.find(i => i.id === "i-owner"); },
  role() { return sandbox.window.DB.roles.find(r => r.code === "owner"); },
  home() { return "workspace/home"; },
  current() { return { path: "", query: {}, route: null }; },
  currentProject() { return sandbox.window.DB.projects.find(x => x.id === "SP-26031"); },
  routes() { return []; }, groups() { return []; }
};
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
/* app.js 内的通用动作（common.* / 框架级）也走同一张注册表，需一并识别，
   否则会把「导出 / 关闭 / 返回」误报成未登记动作。 */
const appSrc = read("assets/js/app.js");
for (const m of appSrc.matchAll(/\bon\(\s*["']([^"']+)["']/g)) {
  if (!handlers[m[1]]) handlers[m[1]] = Object.assign(function appLevelAction() {}, { __appLevel: true });
}
const DB = sandbox.window.DB;
const routes = [];
for (const cfg of registered) for (const r of cfg.routes || []) routes.push({ path: r.path, group: cfg.group, title: r.title, render: r.render });
const routeSet = new Set(routes.map(r => r.path));

const prod = DB.menu.find(x => x.id === "production");
const scope = [];
for (const c of prod.children) for (const it of c.items) if (!it.hidden) scope.push({ stage: c.label, label: it.label, path: it.path });
const scopeSet = new Set(scope.map(s => s.path));

/* ---------- 动作分类（基于真实函数体） ---------- */
const classify = (fn) => {
  const src = fn ? fn.toString() : "";
  const goes = [...src.matchAll(/App\.go\(\s*["']([^"']+)["']/g)].map(m => m[1]);
  const optionalGo = /App\.go\(/.test(src) && !/App\.go\(\s*["']/.test(src);
  return {
    src,
    nav: goes,
    optionalGo,
    modal: /App\.(modal|confirm)\(/.test(src),
    drawer: /App\.drawer\(/.test(src),
    stateOnly: /App\.set\(/.test(src) && !/App\.(modal|confirm|drawer|go)\(/.test(src),
    write: /DB\.state\.(set|push|update)/.test(src) || /\.push\(|\.unshift\(/.test(src)
  };
};
/* 弹窗标题：从源码里抓 title: "…" 或 App.confirm("…" */
const titleOf = (fn) => {
  const src = fn ? fn.toString() : "";
  const m = src.match(/App\.confirm\(\s*["']([^"']+)["']/) || src.match(/title:\s*["']([^"']+)["']/);
  return m ? m[1] : "";
};

/* ---------- 逐页抓取 ---------- */
const pages = [];
const graph = new Map();
for (const r of routes) {
  let html = "";
  try { html = r.render({ id: "SP-26031", ep: "17", shot: "SH-26031-E17-03" }); } catch (e) { pages.push({ path: r.path, error: e.message }); continue; }
  const hrefs = [...new Set([...html.matchAll(/href="#\/([^"?]+)/g)].map(m => m[1]))].filter(h => routeSet.has(h) && h !== r.path);
  const acts = [...new Set([...html.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]))];
  const kinds = { nav: [], modal: [], drawer: [], state: [], write: [], app: [], unknown: [] };
  const targets = new Set(hrefs);
  const modalTitles = [];
  for (const a of acts) {
    if (a === "common.backdrop" || a === "common.closeModal" || a === "common.closeDrawer") continue;
    const h = handlers[a];
    if (!h) { kinds.unknown.push(a); continue; }
    if (h.__appLevel) { kinds.app.push(a); if (a === "common.projects") for (const t of ["projects/list"]) targets.add(t); continue; }
    const c = classify(h);
    for (const t of c.nav) if (routeSet.has(t)) targets.add(t);
    if (c.modal) { kinds.modal.push(a); modalTitles.push(titleOf(h)); }
    else if (c.drawer) kinds.drawer.push(a);
    else if (c.nav.length) kinds.nav.push(a);
    else if (c.stateOnly) kinds.state.push(a);
    else if (c.write) kinds.write.push(a);
    else kinds.unknown.push(a);
  }
  graph.set(r.path, targets);
  pages.push({
    path: r.path, title: r.title, chars: html.length,
    tables: (html.match(/<table/g) || []).length, rows: (html.match(/<tr[ >]/g) || []).length,
    fields: (html.match(/<(input|select|textarea)[ >]/g) || []).length,
    acts, kinds, modalTitles
  });
}
const byPath = new Map(pages.filter(p => !p.error).map(p => [p.path, p]));
const inbound = new Map(pages.filter(p => !p.error).map(p => [p.path, []]));
for (const [from, tos] of graph) for (const to of tos) if (inbound.has(to)) inbound.get(to).push(from);

const hops = (from, to, max = 4) => {
  if (from === to) return 0;
  const seen = new Set([from]); let level = [from];
  for (let d = 1; d <= max; d++) {
    const nx = [];
    for (const n of level) for (const t of graph.get(n) || []) { if (t === to) return d; if (!seen.has(t)) { seen.add(t); nx.push(t); } }
    level = nx;
  }
  return -1;
};

const CHAIN = [
  ["projects/new", "立项"], ["creation/brief", "创意设定"], ["creation/plan", "创意方案"], ["creation/script", "剧本版本"],
  ["creation/review", "剧本审核"], ["creation/breakdown", "剧本拆解"], ["assets/library", "素材库"],
  ["director/plan", "镜头计划"], ["director/cast", "人物档案"], ["director/world", "场景道具"], ["director/shots", "镜头契约"],
  ["video/production", "视频队列"], ["video/preview", "预览校验"], ["audio/dialogue", "对白配音"], ["audio/voice", "声音档案"],
  ["audio/bgm", "配乐音效"], ["audio/subtitle", "字幕口型"], ["post/timeline", "时间线"], ["post/episodes", "分集成片"],
  ["post/review", "成片审核"], ["quality/reports", "质量报告"], ["quality/rework", "返工台账"],
  ["post/delivery", "交付包"], ["post/versions", "版本链"]
];

const out = [];
const table = [];
const breaks = [];
const menuOnly = [];
for (let i = 0; i < CHAIN.length; i++) {
  const [p, label] = CHAIN[i];
  const node = byPath.get(p);
  if (!node) { breaks.push(`${p}：页面未注册`); continue; }
  const next = CHAIN[i + 1] ? CHAIN[i + 1][0] : null;
  const h = next ? hops(p, next) : null;
  const inb = (inbound.get(p) || []).filter(x => scopeSet.has(x) || x === "assets/library");
  table.push(`${String(i + 1).padStart(2)} ${p.padEnd(20)} ${label.padEnd(6)} → ${(next || "—").padEnd(20)} 跳 ${h === null ? "—" : h < 0 ? "✗" : h}  入边 ${String(inb.length).padStart(2)}  出边 ${String((graph.get(p) || []).size).padStart(2)}  动作 ${String(node.acts.length).padStart(2)}（跳${node.kinds.nav.length}/弹${node.kinds.modal.length}/抽${node.kinds.drawer.length}/态${node.kinds.state.length}/写${node.kinds.write.length}/未登记${node.kinds.unknown.length}）表 ${node.tables} 行 ${node.rows} 字段 ${node.fields}`);
  if (next && h < 0) breaks.push(`${p}（${label}）→ ${next}：4 跳内不可达`);
  if (!inb.length) menuOnly.push(`${p}（${label}）`);
}
out.push(`# 短剧制作全链路审计 · ${scope.length} 个菜单节点 / ${CHAIN.length} 链路节点`);
out.push("");
out.push("## 1. 链路逐节点");
out.push("```");
out.push(table.join("\n"));
out.push("```");

out.push("");
out.push("## 2. 端到端可达性（从「立项」projects/new 出发，仅算页面间跳转，不含侧栏）");
const dist = new Map([["projects/new", 0]]);
let level = ["projects/new"];
while (level.length) {
  const nx = [];
  for (const n of level) for (const t of graph.get(n) || []) if (!dist.has(t)) { dist.set(t, dist.get(n) + 1); nx.push(t); }
  level = nx;
}
const unreachable = [...scopeSet].filter(p => !dist.has(p));
const toDelivery = dist.has("post/delivery") ? dist.get("post/delivery") : -1;
out.push(`- 立项可达节点：${scope.size || scope.length} 个菜单节点中 ${scope.length - unreachable.length} 个可达；到「交付包」${toDelivery < 0 ? "不可达" : toDelivery + " 跳"}`);
out.push(unreachable.length ? "- 从立项出发不可达（只能靠侧栏）：" + unreachable.join(" / ") : "- 从立项出发全部可达");

out.push("");
out.push("## 2.1 主链顺序假设下的入口缺口（建议级，不是缺陷）");
out.push("说明：按「立项 → 创意 → 拆解 → 素材 → 导演 → 视频 → 音频 → 后期 → 质量 → 交付」这一条主链逐段试跳；缺口也可能是节点之间本就并联（如人物档案与场景道具），需与业务确认，故本节只作建议。");
out.push(breaks.length ? breaks.map(b => "- " + b).join("\n") : "- 无");

out.push("");
out.push("## 3. 页面间零入边（只能从侧栏菜单进入）");
out.push(menuOnly.length ? menuOnly.map(b => "- " + b).join("\n") : "- 无");

const dead = [...scopeSet].filter(p => !(graph.get(p) || []).size);
out.push("");
out.push("## 4. 死端页（无任何页面间出边）");
out.push(dead.length ? dead.map(p => "- ✗ " + p).join("\n") : "- 无");

/* 死表单：只有字段、没有任何弹窗/写动作承接 */
const badForm = pages.filter(p => !p.error && scopeSet.has(p.path) && p.fields > 0 && p.kinds.modal.length === 0 && p.kinds.write.length === 0 && !p.acts.some(a => /\.(create|save|submit|confirm|apply|register|update|new)/.test(a)));
out.push("");
out.push("## 5. 有输入但无任何承接（死表单）");
out.push(badForm.length ? badForm.map(p => `- ✗ ${p.path} 字段 ${p.fields} · 动作 ${p.acts.join(",")}`).join("\n") : "- 无");

/* 未登记动作 */
const unreg = pages.filter(p => !p.error && p.kinds.unknown.length);
out.push("");
out.push("## 6. 页面引用了未登记动作");
out.push(unreg.length ? unreg.map(p => `- ✗ ${p.path}：${p.kinds.unknown.join(",")}`).join("\n") : "- 无");

/* 弹窗重名 */
const modalMap = new Map();
for (const p of pages.filter(x => !x.error && scopeSet.has(x.path))) {
  p.kinds.modal.forEach((a, i) => {
    const t = p.modalTitles[i] || "(未命名)";
    if (!modalMap.has(t)) modalMap.set(t, []);
    modalMap.get(t).push(`${p.path}:${a}`);
  });
}
const dupModal = [...modalMap].filter(([, v]) => v.length > 1);
out.push("");
out.push("## 7. 同名弹窗（同一标题被多处触发）");
out.push(dupModal.length ? dupModal.map(([t, v]) => `- ${t} ← ${v.join(" / ")}`).join("\n") : "- 无");

/* 体量 */
const heavy = pages.filter(p => !p.error && scopeSet.has(p.path)).sort((a, b) => b.chars - a.chars).slice(0, 6);
out.push("");
out.push("## 8. 体量 Top6");
out.push(heavy.map((p, i) => `${i + 1}. ${p.path} ${p.chars} 字符 · 表 ${p.tables} · 字段 ${p.fields} · 动作 ${p.acts.length}`).join("\n"));

/* 承载统计 */
const agg = { nav: 0, modal: 0, drawer: 0, state: 0, write: 0 };
for (const p of pages.filter(x => !x.error && scopeSet.has(x.path))) for (const k of Object.keys(agg)) agg[k] += p.kinds[k].length;
out.push("");
out.push(`## 9. 承载汇总（${scope.size || scope.length} 页）：跳转 ${agg.nav} · 弹窗 ${agg.modal} · 抽屉 ${agg.drawer} · 状态切换 ${agg.state} · 写入 ${agg.write}`);

const text = out.join("\n");
if (process.argv.includes("--debug")) console.log("REG=" + Object.keys(handlers).length + " | " + Object.keys(handlers).filter(k => /video|projects\./.test(k)).join(","));
console.log(text);
if (process.argv.includes("--write")) fs.writeFileSync(path.join(root, "tools", "_ia_chain.txt"), text + "\n", "utf8");
