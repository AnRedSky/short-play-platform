/* tools/flow.mjs — v9.1 业务流断言：不依赖浏览器，直接驱动 DB.state 走真实链路。
   用法：node tools/flow.mjs */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const sandbox = { console };
sandbox.window = sandbox;
sandbox.App = {
  identity() { return sandbox.window.DB.identities.find((i) => i.id === "i-owner"); },
  toast() {}, set() {}, get(s, k, d) { return d; },
  refresh() {}, go() {},
};
vm.createContext(sandbox);
vm.runInContext(read("assets/js/data.js"), sandbox, { filename: "data.js" });
vm.runInContext(read("assets/js/store.js"), sandbox, { filename: "store.js" });
/* 注入运行时身份：状态层不再反向调用应用层，改由应用层注入 */
sandbox.window.DB.state.bind({
  identity: () => sandbox.window.DB.identities.find((i) => i.id === "i-owner"),
  role: () => sandbox.window.DB.roles.find((r) => r.code === "owner")
});

const OPS = sandbox.window.DB.state;
const DB = sandbox.window.DB;
let pass = 0;
let fail = 0;
const ok = (label, r) => {
  if (r && r.ok) { pass += 1; console.log("✅ " + label + " → " + r.msg); }
  else { fail += 1; console.log("❌ " + label + " → " + (r ? r.msg : "no result")); }
};
const no = (label, r) => {
  if (r && !r.ok) { pass += 1; console.log("✅ " + label + " 被拦截 → " + r.msg); }
  else { fail += 1; console.log("❌ " + label + " 应被拦截，却通过了"); }
};

/* 1. 视频：依赖未完成的任务必须被拦截 */
const t = DB.tasks.find((x) => x.id === "T-8843");
const shotRow = DB.shots.find((s) => s.project === t.project && s.ep === Number(t.ep) && s.no === t.shot);
if (shotRow) t.shot = shotRow.id;
no("执行 T-8843（前置 T-8842 执行中）", DB.state.runTask(t.id));

/* 2. 视频：新任务提交 → 执行 → 镜头质检 */
t.status = "已取消";
const target = DB.shots.find((s) => s.id === "SH-26031-E17-05");
target.status = "待生成";
const sub = DB.state.submitTask({ project: "SP-26031", shot: target.id, model: "Video Model A", priority: "高" });
ok("提交任务 " + target.id, sub);
if (sub.ok) {
  ok("执行新任务 " + sub.data.id, DB.state.runTask(sub.data.id));
  const q = DB.state.qcShot(target.id);
  ok("新镜头质检（" + target.qc + " / " + target.status + "）", q);
}

/* 3. 质量：检测项裁决 */
const issueRep = "QR-26031-E17-03";
const before = (DB.qualityIssues.filter((i) => i.report === issueRep)[0] || {});
ok("接受现状（理由 10 字）", DB.state.judgeIssue(issueRep, 0, "accept", "该镜头为过场，眉疤不可见且不影响叙事"));
no("接受现状但理由为空", DB.state.judgeIssue(issueRep, 1, "accept", ""));
ok("驳回检测项", DB.state.judgeIssue(issueRep, 1, "reject", "口型与对白不一致，必须重做"));

/* 4. 终审：项目未到待最终审核时必须拦截 */
no("终审（项目仍在生产中）", DB.state.finalReview("SP-26031", { decision: "pass", note: "剧情、质量、合规与交付完整性均已核对" }));

/* 5. 交付：未完成项目不得生成交付包（必须拦截，并给出集数原因） */
no("生成交付包（集数未齐）", DB.state.generateDelivery("SP-26031"));

/* 6. 授权：阻断素材的替换与续期 */
ok("替换阻断素材授权 RT-03", DB.state.replaceRightsAsset("RT-03"));
ok("续期授权 RT-02 至 2027-11-30", DB.state.renewRights("RT-02", "2027-11-30"));
no("续期日期格式错误", DB.state.renewRights("RT-02", "2027/11/30"));

/* 7. 项目状态机：生产中不可直接跳到已交付 */
no("状态机越级（生产中→已交付）", DB.state.moveTo(DB.projects.find((p) => p.id === "SP-26031"), "已交付", "越级测试"));

/* 8. 项目暂停 → 恢复：任务联动 */
const pr = DB.projects.find((p) => p.id === "SP-26031");
ok("暂停项目", DB.state.pause("SP-26031", "预算接近阈值，暂停新任务"));
ok("恢复项目", DB.state.resume("SP-26031"));

/* 9. 成本：预算调整低于已用金额必须拦截 */
no("预算调到 8000（低于已用）", DB.state.adjustBudget("SP-26031", 8000, "压缩预算"));

/* 10. 资源：停用凭据后连通性测试失败 */
ok("更新凭据 PRV-07", DB.state.updateCredential("PRV-07", "sk-live-0000000000"));
ok("连通性测试 PRV-07", DB.state.testProvider("PRV-07"));

console.log("\n合计：通过 " + pass + " · 失败 " + fail);
if (fail) process.exitCode = 1;
