/* tools/_journey.mjs — 9.4.0 全链路验收：新建项目 → 创意 → 方案 → 剧本 → 审核 → 拆解 → 资产 → 计划 → 视频 → 字幕 → 质检 → 终审 → 交付 → 归档。
   用法：node tools/_journey.mjs */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const sandbox = { console };
sandbox.window = sandbox;
sandbox.App = {
  identity() { return sandbox.window.DB.identities.find((i) => i.id === "i-owner"); },
  role() { return { name: "项目负责人", code: "owner" }; },
  toast() {}, set() {}, get(s, k, d) { return d; }, refresh() {}, go() {},
};
vm.createContext(sandbox);
vm.runInContext(read("assets/js/data.js"), sandbox, { filename: "data.js" });
vm.runInContext(read("assets/js/store.js"), sandbox, { filename: "store.js" });

const Store = sandbox.window.Store;
const DB = sandbox.window.DB;
let pass = 0;
let fail = 0;
const ok = (label, r) => {
  if (r && r.ok) { pass += 1; console.log("✅ " + label + " → " + r.msg); return r; }
  fail += 1; console.log("❌ " + label + " → " + (r ? r.msg : "no result")); return r;
};
const no = (label, r) => {
  if (r && !r.ok) { pass += 1; console.log("✅ " + label + " 被拦截 → " + r.msg); return r; }
  fail += 1; console.log("❌ " + label + " 应被拦截，却通过了"); return r;
};

const created = ok("创建 4 集项目", Store.ops.createProject({ name: "全链路验收剧", episodes: 4, budget: 12000 }));
if (!created.ok) { console.log("FATAL 无法创建项目"); process.exit(1); }
const pid = created.data.id;
const brief = ok("提交创意设定", Store.ops.submitBrief(pid, { text: "雨夜旧城里的一封错投信件，牵出四集人物关系与一次迟到十年的道歉；克制叙事，结尾留一个未解动作。", mode: "自由描述" }));
const plan = ok("生成创意方案", Store.ops.generatePlans(pid));
if (plan.ok) ok("选定创意方案 " + plan.data.id, Store.ops.choosePlan(plan.data.id));
const script = ok("生成候选剧本", Store.ops.generateScript(pid));
if (script.ok) ok("审核锁定剧本 " + script.data.id, Store.ops.approveScript(script.data.id, { note: "逐集检查人物关系、场景连续性与结尾钩子，确认可作为下游唯一基准。" }));
const br = ok("拆解剧本", Store.ops.breakdown(pid));

const pendingAssets = DB.characters.filter(x => x.project === pid && x.status !== "已确认").map(x => ["character", x.id])
  .concat(DB.locations.filter(x => x.project === pid && x.status !== "已确认").map(x => ["location", x.id]))
  .concat(DB.props.filter(x => x.project === pid && x.status !== "已确认").map(x => ["prop", x.id]));
pendingAssets.forEach(([kind, id]) => ok("确认资产 " + id, Store.ops.confirmAsset(kind, id)));
const pp = DB.plans.filter(x => x.project === pid).slice(-1)[0];
if (pp) ok("固化生产计划 " + pp.id, Store.ops.freezePlan(pp.id));

const batch = ok("连续生产 1–4 集", Store.ops.batchProduce(pid, 1));
const post1 = Store.ops.finishPost(pid);
console.log("· 首次后期：" + post1.msg);
const idleSubs = DB.subtitles.filter(s => s.project === pid && s.status !== "已通过");
idleSubs.forEach(s => { s.status = "已通过"; s.asr = "错字 0 · 校对完成"; });
const post2 = ok("字幕校对后完成后期（" + idleSubs.length + " 集）", Store.ops.finishPost(pid));
const qc = ok("整集质检", Store.ops.qcAll(pid));
const final = ok("终审通过", Store.ops.finalReview(pid, { decision: "pass", note: "剧情、人物一致性、镜头质量、字幕与授权均已逐项核对，允许交付。" }));
const delivery = final.ok ? ok("生成交付包", Store.ops.generateDelivery(pid)) : { ok: false };
const confirmed = delivery.ok ? ok("确认交付", Store.ops.confirmDelivery(delivery.data.id, "企业内容库")) : { ok: false };
const archived = confirmed.ok ? ok("归档项目", Store.ops.archive(pid)) : { ok: false };

console.log("\n最终状态：" + (Store.prj(pid) ? Store.prj(pid).status : "项目不存在"));
console.log("合计：通过 " + pass + " · 失败 " + fail);
if (fail) process.exit(1);
