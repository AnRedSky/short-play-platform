// 原型质量门禁：一条命令跑完 16 条脚本级审计与回归，硬指标不过直接 exit 1。
// 用途：本地提交前自查 + CI（.github/workflows/ci.yml 的 prototype-quality job）。
//
// 用法：node tools/check.mjs [--quiet]
// 说明：浏览器侧三项（_smoke / _e2e / _pixel）依赖真实 Chromium，不进本门禁，见 README「浏览器侧」。
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const QUIET = process.argv.includes("--quiet");
const run = (tool) => spawnSync(process.execPath, [resolve(ROOT, "tools", tool + ".mjs")], { cwd: ROOT, encoding: "utf8" });

/* 每条审计只断言「收口结论」那一行，避免把整段输出当契约（措辞调整不该炸门禁） */
const CHECKS = [
  { tool: "regress", name: "回归：路由/权限/渲染/空态", expect: [/回归通过/] },
  { tool: "_audit_links", name: "内链：失效 0 + LEGACY 转发全通", expect: [/失效内链 0/, /LEGACY 转发 10 条 · 通过 10/] },
  { tool: "_audit_actions", name: "动作：无未注册动作", expect: [/unregistered: 0/] },
  { tool: "_audit_perms", name: "权限：权限码全覆盖", expect: [/missing: none/] },
  { tool: "_audit_kpi", name: "指标口径一致", expect: [/口径一致/] },
  { tool: "_audit_dups", name: "动作无重复", expect: [/重复 0/] },
  { tool: "_audit_project_guard", name: "项目页阻断", expect: [/失败 0/] },
  { tool: "_audit_naming", name: "页面命名唯一", expect: [/名称断言失败 0/] },
  { tool: "_audit_buttons", name: "按钮密度与文案唯一", expect: [/同动作多文案 0 组/] },
  { tool: "_audit_rules", name: "规则卡 ≤14 张且单页 ≤1", expect: [/超标页 0/] },
  { tool: "_audit_labels", name: "动作文案唯一", expect: [/多文案 0 组/] },
  { tool: "_audit_density", name: "无过薄页", expect: [/过薄 0 页/] },
  { tool: "_audit_layout", name: "布局硬指标 0 阻断", expect: [/硬指标阻断 0 条/] },
  { tool: "_audit_overlap", name: "重复功能：真双入口 0", expect: [/无（其余均为导航/] },
  { tool: "_audit_carry", name: "承载选择：弹窗/抽屉/跳转均不过载", expect: [/弹窗过重[^\n]*· 0 条/, /跳转过碎[^\n]*· 0 条/, /抽屉过载[^\n]*· 0 条/] },
  { tool: "flow", name: "业务流 18 步", expect: [/失败 0/] },
  { tool: "_journey", name: "项目全生命周期 22 步", expect: [/失败 0/] }
];

/* 只报告不阻断：承载方式多样性、交互盘点属于观察项，没有硬阈值 */
const OBSERVE = [
  { tool: "_audit_ux", name: "交互盘点（观察）" },
  { tool: "_audit_chain", name: "短剧制作链路（观察）", note: "死端/零入边/关口动作位置见 docs/REVIEW-PRODUCTION-FLOW-V9.7.8.md" }
];

let failed = 0;
const rows = [];

for (const c of CHECKS) {
  const t0 = Date.now();
  const r = run(c.tool);
  const out = (r.stdout || "") + (r.stderr || "");
  const missing = c.expect.filter((re) => !re.test(out));
  const ok = r.status === 0 && missing.length === 0;
  if (!ok) failed += 1;
  rows.push({ name: c.name, ok, ms: Date.now() - t0, reason: ok ? "" : (missing.length ? "未命中：" + missing.map(String).join(" / ") : "退出码 " + r.status) });
  if (!ok && !QUIET) {
    console.log("\n---- " + c.tool + ".mjs 输出（末 12 行）----");
    console.log(out.trim().split("\n").slice(-12).join("\n"));
  }
}

for (const c of OBSERVE) {
  const r = run(c.tool);
  const out = (r.stdout || "") + (r.stderr || "");
  const marked = /有标记 (\d+) 条/.exec(out);
  const chainDead = /## 4\. 死端页[\s\S]*?\n- (✗ [^\n]+)/.exec(out);
  rows.push({
    name: c.name, ok: r.status === 0, ms: 0, observe: true,
    reason: c.note ? c.note : marked ? "标记 " + marked[1] + " 条（观察项，不阻断）" : chainDead ? "死端：" + chainDead[1].replace("✗ ", "") : ""
  });
}

console.log("");
console.log("原型质量门禁 · 17 条脚本审计" + (failed ? " · 失败 " + failed : " · 全部通过"));
for (const row of rows) {
  const tag = row.observe ? "观察" : row.ok ? "PASS" : "FAIL";
  console.log("  " + tag.padEnd(4) + " " + row.name + (row.ms ? "（" + row.ms + "ms）" : "") + (row.reason ? " · " + row.reason : ""));
}
console.log("");
process.exit(failed ? 1 : 0);
