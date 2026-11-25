/* tools/_probe_tab.mjs — 合并页 tab 渲染探针
   用法：node tools/_probe_tab.mjs quality/reports gates
         node tools/_probe_tab.mjs post/delivery works
   打印该路由在指定 tab 下的 HTML 长度与关键区块数量，用于确认"并入的 tab 真的渲染了"。 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const targetPath = process.argv[2];
const tabValue = process.argv[3] || "";
const projectId = process.argv[4] || "SP-26015";
const tabKey = process.argv[5] || "tab";

if (!targetPath) {
  console.log("用法：node tools/_probe_tab.mjs <route> <tab> [projectId]");
  process.exit(1);
}

const sandbox = { console };
sandbox.window = sandbox;
sandbox.location = { hash: "#/" + targetPath };
sandbox.document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, createElement() { return { style: {}, appendChild() {}, setAttribute() {}, classList: { add() {} } }; } };
vm.createContext(sandbox);
vm.runInContext(read("assets/js/data.js"), sandbox, { filename: "data.js" });
vm.runInContext(read("assets/js/ui.js"), sandbox, { filename: "ui.js" });

const registered = [];
const state = {};
sandbox.window.AppModule = { register: (cfg) => registered.push(cfg) };
sandbox.window.App = {
  on() {}, guard() { return true; },
  get(s, k, d) { return (k in state) ? state[k] : d; },
  set(s, k, v) { state[k] = v; },
  mem() { return {}; }, go() {}, toast() {}, modal() {}, confirm() {}, drawer() {}, refresh() {}, can() { return true; }, exportCsv() {},
  identity() { return sandbox.window.DB.identities.find((i) => i.id === "i-owner"); },
  role() { return sandbox.window.DB.roles[0]; },
  home() { return "workspace/home"; }, current() { return { path: targetPath, query: { id: projectId }, route: null }; },
  currentProject(q) { const db = sandbox.window.DB; return db.projects.find((p) => p.id === ((q && q.id) || projectId)) || null; },
  routes() { return []; }, groups() { return []; }
};

vm.runInContext(read("assets/js/store.js"), sandbox, { filename: "store.js" });
sandbox.window.DB.state.bind({ identity: () => sandbox.window.App.identity(), role: () => sandbox.window.App.role() });
vm.runInContext(read("assets/js/derived.js"), sandbox, { filename: "derived.js" });
sandbox.window.DB.derived.bind({ identity: () => sandbox.window.App.identity() });
fs.readdirSync(path.join(root, "modules")).filter((d) => fs.statSync(path.join(root, "modules", d)).isDirectory())
  .forEach((m) => vm.runInContext(read(`modules/${m}/pages.js`), sandbox, { filename: `${m}/pages.js` }));

const route = registered.flatMap((c) => c.routes).find((r) => r.path === targetPath);
if (!route) { console.log("路由不存在：" + targetPath + "（可能已并入其它页，见 app.js LEGACY）"); process.exit(1); }

["", tabValue].filter((v, i, a) => a.indexOf(v) === i).forEach((tab) => {
  if (tab) Object.keys(state).forEach((k) => delete state[k]);
  if (tab) state[tabKey] = tab;
  const html = route.render({ id: projectId });
  const cards = (html.match(/<section class="card/g) || html.match(/class="card"/g) || []).length;
  const metrics = (html.match(/class="metric/g) || []).length;
  const bad = /undefined|NaN|\[object Object\]/.test(html);
  const probe = process.argv[6] || "";
  const hasProbe = probe ? html.indexOf(probe) >= 0 : null;
  console.log(`${targetPath} tab=${tab || "(默认)"} → ${html.length} 字符 · 卡片 ${cards} · 指标 ${metrics}${bad ? " · ⚠ 含 undefined/NaN" : ""}${hasProbe === null ? "" : " · 含「" + probe + "」=" + hasProbe}`);
});
