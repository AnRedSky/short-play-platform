/* tools/_cols.mjs — 单页表格列数逐表打印
   用法：node tools/_cols.mjs tasks/list */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const target = process.argv[2];
if (!target) { console.log("usage: node tools/_cols.mjs <route>"); process.exit(0); }

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

const route = registered.flatMap((c) => c.routes).find((r) => r.path === target);
if (!route) { console.log("no route: " + target); process.exit(1); }
CURRENT = { path: target, query: route.query && route.query.id ? route.query : { id: "SP-26015" } };
const html = route.render(CURRENT.query) || "";
[...html.matchAll(/<table[\s\S]*?<\/table>/g)].forEach((m, i) => {
  const th = (m[0].match(/<th/g) || []).length;
  const head = ((m[0].match(/<thead>[\s\S]*?<\/thead>/) || [""])[0].replace(/<[^>]+>/g, "|")).slice(0, 600);
  console.log(`table#${i + 1}: th=${th} ${head}`);
});
