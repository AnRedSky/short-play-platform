/* tools/_audit_kpi.mjs — 口径一致性回归（B1 收口后新增）
   校验：预算唯一账本 / 集进度 / 任务拆分 / 待我处理 / 首页汇总 是否只有一个算法。
   用法：node tools/_audit_kpi.mjs   （任一项失败即以非 0 退出） */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read("assets/js/data.js"), sandbox, { filename: "data.js" });
vm.runInContext(read("assets/js/store.js"), sandbox, { filename: "store.js" });
vm.runInContext(read("assets/js/derived.js"), sandbox, { filename: "derived.js" });

const DB = sandbox.window.DB;
const D = DB.derived;
const problems = [];
const ok = [];
const check = (cond, msg) => { if (cond) ok.push(msg); else problems.push(msg); };

/* 1. 预算唯一账本 */
DB.projects.forEach((p) => {
  const led = DB.budgets.find((b) => b.scope === "项目" && String(b.name).indexOf(p.id) === 0);
  check(!!led, `项目 ${p.id} 缺少项目预算账本`);
  const b = D.budgetOfProject(p);
  if (led) {
    check(Number(p.budget) === Number(led.total), `项目 ${p.id} 预算总额与账本不一致：${p.budget} vs ${led.total}`);
    check(Number(p.actual) === Number(led.used), `项目 ${p.id} 已用金额与账本不一致：${p.actual} vs ${led.used}`);
  }
  check(b.pct === (b.total ? Math.round(b.used / b.total * 100) : 0), `项目 ${p.id} 预算百分比与统一口径不一致`);
  check(["正常", "接近阈值", "已超限", "已冻结", "未设置"].indexOf(b.state) >= 0, `项目 ${p.id} 预算状态不在五态内：${b.state}`);
});

/* 2. 集进度 */
DB.projects.forEach((p) => {
  const g = D.progressOf(p);
  check(g.total === Number(p.episodes || 0), `项目 ${p.id} 集进度分母不是项目集数`);
  check(g.done <= g.total, `项目 ${p.id} 已完成集数超过总集数`);
  check(g.pct === (g.total ? Math.round(g.done / g.total * 100) : 0), `项目 ${p.id} 集进度百分比不一致`);
});

/* 3. 任务拆分自洽 + 4. 待我处理自洽 + 5. 首页汇总 = 单项目之和 */
DB.identities.forEach((idf) => {
  const ts = D.taskStats(idf);
  check(ts.open === ts.queued + ts.running, `${idf.name} 任务口径不自洽：open=${ts.open} 排队=${ts.queued} 执行=${ts.running}`);

  const du = D.duties(idf);
  check(du.total === du.items.length, `${idf.name} 待我处理总数与列表长度不一致`);
  check(du.total === du.review + du.quality + du.budget + du.other, `${idf.name} 待我处理分类之和与总数不一致`);
  const mineIds = D.myProjects(idf).map((p) => p.id);
  check(du.items.every((n) => !n.project || mineIds.indexOf(n.project) >= 0), `${idf.name} 的待我处理包含非本人项目`);

  const h = D.home(idf);
  const mine = D.myProjects(idf);
  const sumUsed = mine.reduce((s, p) => s + D.budgetOfProject(p).used, 0);
  const sumTotal = mine.reduce((s, p) => s + D.budgetOfProject(p).total, 0);
  check(Math.abs(h.cost - sumUsed) < 0.01, `${idf.name} 首页成本与单项目账本之和不一致：${h.cost} vs ${sumUsed}`);
  check(Math.abs(h.budget - sumTotal) < 0.01, `${idf.name} 首页预算与单项目账本之和不一致`);
  check(typeof h.decisions === "undefined", `${idf.name} 首页仍返回未渲染的 decisions 派生值`);
  check(h.duties && h.duties.total === du.total, `${idf.name} 首页待办数与 duties() 不一致`);
});

/* 6. 记账后双写仍一致（防止再次漂移） */
{
  const p = DB.projects[0];
  const before = D.budgetOfProject(p).used;
  DB.state.spend(p.id, 10, { cap: "视频生成", task: "T-KPI-01" });
  const after = D.budgetOfProject(p);
  check(Math.abs(after.used - (before + 10)) < 0.01, `记账后账本未同步：${before} → ${after.used}`);
  check(Math.abs(Number(p.actual) - after.used) < 0.01, `记账后项目字段与账本不同步：${p.actual} vs ${after.used}`);
}

/* 7. 阈值判定只允许一处（store），模块不得再写死 85% */
check(typeof DB.state.budgetStateFor === "function", "budgetStateFor 未挂到 DB.state（模块无法复用阈值判定）");
{
  const s = DB.state.budgetStateFor;
  check(s(0, 10000, false) === "正常", "budgetStateFor(0/10000) 应为正常");
  check(s(9000, 10000, false) !== "正常", "budgetStateFor(90%) 应为预警态");
  check(s(10000, 10000, false) === "已超限", "budgetStateFor(100%) 应为已超限");
  check(s(5000, 10000, true) === "已冻结", "budgetStateFor 冻结参数未生效");
  check(s(0, 0, false) === "未设置", "budgetStateFor 未设置态不正确");
}

/* 8. 静态取数卫生：页面不得自算预算/进度/阈值 */
{
  const banned = [
    { re: /\.done\s*\/\s*[A-Za-z_.]*\.episodes/, msg: "集进度用 done/episodes 自算，应走 progressOf()" },
    { re: /\.actual\s*\/\s*[A-Za-z_.]*\.budget/, msg: "预算百分比用 actual/budget 自算，应走 budgetOfProject()" },
    { re: /\.budget\s*-\s*[A-Za-z_.]*\.actual/, msg: "预算余额用 budget-actual 自算，应走 budgetOfProject()" },
    { re: /\*\s*0\.85\b/, msg: "85% 预算阈值硬编码，应走 DB.pricing.budgetWarnRate" },
    { re: /\*\s*0\.3\b/, msg: "字幕单价系数硬编码，应走 DB.pricing.subtitlePerLine" },
    { re: /Math\.round\(\s*[A-Za-z_.]*\.actual\s*\*/, msg: "成本系数硬编码" }
  ];
  const dir = path.join(root, "modules");
  fs.readdirSync(dir).forEach((m) => {
    const f = path.join(dir, m, "pages.js");
    if (!fs.existsSync(f)) return;
    fs.readFileSync(f, "utf8").split(/\r?\n/).forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) return;
      banned.forEach((b) => {
        if (b.re.test(line)) problems.push(`${m}/pages.js:${i + 1} ${b.msg}`);
      });
    });
  });
}

/* 6. R-32：部门 / 企业预算投影必须等于 DB.budgets 账本 */
DB.analytics.depts.forEach((d) => {
  const led = DB.budgets.find((b) => b.scope === "部门" && b.name === d.dept);
  check(!!led, `部门 ${d.dept} 缺少部门预算账本`);
  if (led) {
    check(Number(d.budget) === Number(led.total), `部门 ${d.dept} 预算总额与账本不一致：${d.budget} vs ${led.total}`);
    check(Number(d.cost) === Number(led.used), `部门 ${d.dept} 已用金额与账本不一致：${d.cost} vs ${led.used}`);
  }
});
(function () {
  const ent = DB.enterprise;
  const led = DB.budgets.find((b) => b.scope === "企业");
  check(!!led, "缺少企业预算账本");
  if (led && ent) {
    check(Number(ent.budget) === Number(led.total), `企业预算总额与账本不一致：${ent.budget} vs ${led.total}`);
    check(Number(ent.used) === Number(led.used), `企业已用金额与账本不一致：${ent.used} vs ${led.used}`);
  }
})();

console.log(`通过 ${ok.length} 项`);
if (problems.length) {
  console.log("\n❌ 失败：");
  problems.slice(0, 40).forEach((x) => console.log(" - " + x));
  process.exit(1);
}
console.log("✅ 口径一致：预算、集进度、任务、待办、首页汇总均为单一算法");
