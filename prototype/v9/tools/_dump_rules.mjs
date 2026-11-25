/* tools/_dump_rules.mjs — 把散落各页的规则/口径卡抽成《口径与规则汇总》正文（R-17 第一步）
   产物：docs/RULES-V9.7.0.md（按域分节，每条 §R-xx）+ tools/_rules_index.json（供折叠脚本引用）
   用法：node tools/_dump_rules.mjs */
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

const RULE = /口径|规则|说明|边界|约定|注意|原则|提示|须知|定义|数据来源|对比口径/;
const txt = (h) => h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<\/p>/g, "\n").replace(/<\/tr>/g, "\n").replace(/<\/li>/g, "\n")
  .replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const routes = registered.flatMap((c) => c.routes).sort((a, b) => a.path.localeCompare(b.path));
const found = [];
for (const r of routes) {
  Object.keys(state).forEach((k) => delete state[k]);
  CURRENT = { path: r.path, query: r.query && r.query.id ? r.query : { id: "SP-26015" } };
  let html = "";
  try { html = r.render(CURRENT.query) || ""; } catch { continue; }
  const secs = [...html.matchAll(/<section class="card[^"]*">([\s\S]*?)<\/section>/g)].map((m) => m[1]);
  secs.forEach((sec) => {
    const t = (sec.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/) || sec.match(/<div class="card-title"[^>]*>([\s\S]*?)<\/div>/) || [])[1];
    if (!t) return;
    const title = txt(t);
    if (!RULE.test(title)) return;
    found.push({ domain: r.path.split("/")[0], route: r.path, title, body: txt(sec).slice(0, 900) });
  });
}

/* 同域内标题去重（同一张卡在默认视图与 tab 视图里各渲染一次） */
const uniq = [];
found.forEach((f) => { if (!uniq.some((u) => u.route === f.route && u.title === f.title)) uniq.push(f); });

const index = {};
let n = 0;
uniq.forEach((f) => {
  n += 1;
  f.id = "R-" + String(n).padStart(2, "0");
  (index[f.domain] = index[f.domain] || []).push({ id: f.id, route: f.route, title: f.title });
});

let md = ["# 口径与规则汇总（V9.7.0）", "",
  "> 页面只保留每个域一张「口径与规则」卡；同域其余规则条文收在本文件，页面以一行提示回指对应 §。",
  "> 生成方式：`node tools/_dump_rules.mjs`（渲染各页后抽取规则卡正文，非手写）。", ""].join("\n");
const domains = Object.keys(index);
domains.forEach((d) => {
  md += `\n## ${d}\n\n`;
  uniq.filter((u) => u.domain === d).forEach((u) => {
    md += `### §${u.id} ${u.title}（${u.route}）\n\n${u.body}\n\n`;
  });
});
fs.writeFileSync(path.join(root, "docs", "RULES-V9.7.0.md"), md, "utf8");
fs.writeFileSync(path.join(root, "tools", "_rules_index.json"), JSON.stringify(index, null, 2), "utf8");
console.log(`抽取规则卡 ${uniq.length} 张 · 域 ${domains.length} 个 → docs/RULES-V9.7.0.md`);
Object.keys(index).forEach((d) => console.log(`${d}: ${index[d].length} 张`));
