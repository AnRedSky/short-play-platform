/* tools/_peek_home.mjs — 打印工作台首页关键口径片段，用于人工复核（只读） */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const sandbox = { console };
sandbox.window = sandbox;
sandbox.location = { hash: "#/workspace/home" };
sandbox.document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, createElement() { return { style: {}, appendChild() {}, setAttribute() {}, classList: { add() {} } }; } };
vm.createContext(sandbox);
vm.runInContext(read("assets/js/data.js"), sandbox, { filename: "data.js" });
vm.runInContext(read("assets/js/ui.js"), sandbox, { filename: "ui.js" });
const registered = [];
sandbox.window.AppModule = { register: (c) => registered.push(c) };
const DB = () => sandbox.window.DB;
sandbox.window.App = {
  on() {}, guard() { return true; }, get(s, k, d) { return d; }, set() {}, mem() { return {}; },
  go() {}, toast() {}, modal() {}, confirm() {}, drawer() {}, refresh() {}, can() { return true; }, exportCsv() {},
  identity() { return DB().identities.find((i) => i.id === "i-owner"); }, role() { return DB().roles.find((r) => r.code === "owner"); },
  home() { return "workspace/home"; }, current() { return { path: "workspace/home", query: {}, route: null }; },
  currentProject() { return DB().projects.find((p) => p.id === "SP-26031"); },
  routes() { return []; }, groups() { return []; }
};
vm.runInContext(read("assets/js/store.js"), sandbox, { filename: "store.js" });
sandbox.window.DB.state.bind({ identity: () => sandbox.window.App.identity(), role: () => sandbox.window.App.role() });
vm.runInContext(read("assets/js/derived.js"), sandbox, { filename: "derived.js" });
for (const m of fs.readdirSync(path.join(root, "modules"))) {
  if (!fs.statSync(path.join(root, "modules", m)).isDirectory()) continue;
  vm.runInContext(read(`modules/${m}/pages.js`), sandbox, { filename: `${m}/pages.js` });
}
const home = registered.find((c) => c.group === "workspace").routes.find((r) => r.path === "workspace/home");
const html = home.render({ id: "", shot: "", ep: "" });
const text = html.replace(/<[^>]+>/g, "\n").replace(/\n{2,}/g, "\n");
[
  "预算已用",
  "我负责项目成本（合计）",
  "待我处理",
  "待处理事项",
  "进行中任务",
  "质量通过",
  "全剧进度"
].forEach((kw) => {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => l.indexOf(kw) >= 0);
  if (i >= 0) console.log(`【${kw}】` + lines.slice(i, i + 3).join(" / ").trim());
});
console.log("\n项目预算表：");
DB().projects.forEach((p) => {
  const b = DB().derived.budgetOfProject(p);
  console.log(`  ${p.id} ${p.name} · 账本 ¥${b.used}/${b.total} = ${b.pct}% · ${b.state} · source=${b.source}`);
});
console.log("\n待我处理（owner 身份）：");
DB().derived.duties(sandbox.window.App.identity()).items.forEach((n) => console.log(`  [${n.type}] ${n.title}`));
