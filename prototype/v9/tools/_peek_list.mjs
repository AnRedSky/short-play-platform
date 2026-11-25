/* tools/_peek_list.mjs — projects/list 关系筛选人工复核（B2·M1）
   打印 owner 身份下四种关系筛选的项目名与卡片关键字段，便于确认合并后没有丢范围。
   用法：node tools/_peek_list.mjs */
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
let currentIdentity = "i-owner";
sandbox.window.AppModule = { register: (cfg) => registered.push(cfg) };
sandbox.window.App = {
  on() {}, guard() { return true; },
  get(s, k, d) { return (k in state) ? state[k] : d; },
  set(s, k, v) { state[k] = v; },
  mem() { return {}; }, go() {}, toast() {}, modal() {}, confirm() {}, drawer() {}, refresh() {}, can() { return true; }, exportCsv() {},
  identity() { return sandbox.window.DB.identities.find((i) => i.id === currentIdentity) || sandbox.window.DB.identities[0]; },
  role() { return sandbox.window.DB.roles[0]; },
  home() { return "workspace/home"; }, current() { return { path: "", query: {}, route: null }; },
  currentProject() { return sandbox.window.DB.projects[0]; },
  routes() { return []; }, groups() { return []; }
};

vm.runInContext(read("assets/js/store.js"), sandbox, { filename: "store.js" });
sandbox.window.DB.state.bind({ identity: () => sandbox.window.App.identity(), role: () => sandbox.window.App.role() });
vm.runInContext(read("assets/js/derived.js"), sandbox, { filename: "derived.js" });
fs.readdirSync(path.join(root, "modules")).filter((d) => fs.statSync(path.join(root, "modules", d)).isDirectory())
  .forEach((m) => vm.runInContext(read(`modules/${m}/pages.js`), sandbox, { filename: `${m}/pages.js` }));

const DB = sandbox.window.DB;
DB.derived.bind({ identity: () => sandbox.window.App.identity() });
const listRoute = registered.flatMap((c) => c.routes).find((r) => r.path === "projects/list");
const visible = DB.derived.visibleProjects();
const uid = sandbox.window.App.identity().userId;
const own = visible.filter((p) => p.ownerId === uid).length;
const joined = visible.filter((p) => p.ownerId !== uid && (p.members || []).some((m) => m.userId === uid)).length;
const review = visible.filter((p) => p.status.indexOf("待") >= 0 && (p.ownerId === uid || (p.members || []).some((m) => m.userId === uid && m.role === "审核"))).length;

console.log(`身份 ${sandbox.window.App.identity().name}（${uid}）· 可见 ${visible.length} 个项目 · 我负责 ${own} / 我参与 ${joined} / 待我审核 ${review}`);
["", "own", "join", "review"].forEach((rel) => {
  state.rel = rel;
  const html = listRoute.render({});
  const cards = (html.match(/class="project-card"/g) || []).length;
  const chips = (html.match(/class="seg-chip/g) || []).length;
  const role = (html.match(/我的角色/g) || []).length;
  const counters = (html.match(/ data-filter-count/g) || []).length;
  console.log(`rel=${rel || "(全部)"} → 卡片 ${cards} 张 · 筛选按钮 ${chips} 个 · 角色标记 ${role} 个 · 计数位 ${counters} 处`);
  if (rel === "own" && cards !== own) console.log(`  ⚠ 我负责筛选结果 ${cards} ≠ 统计 ${own}`);
  if (rel === "join" && cards !== joined) console.log(`  ⚠ 我参与筛选结果 ${cards} ≠ 统计 ${joined}`);
  if (rel === "review" && cards !== review) console.log(`  ⚠ 待我审核筛选结果 ${cards} ≠ 统计 ${review}`);
  if (rel === "" && cards !== visible.length) console.log(`  ⚠ 全部筛选结果 ${cards} ≠ 可见 ${visible.length}`);
});
