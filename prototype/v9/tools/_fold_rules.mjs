/* tools/_fold_rules.mjs — R-17 第二步：同域只留 1 张「口径与规则」卡，其余折叠为一行回指提示
   依据 tools/_rules_index.json（由 _dump_rules.mjs 生成）与下方 KEEP 表。
   折叠 = 把 `U.card("标题", …)` 整段替换为 `U.notice("口径与规则见《口径与规则汇总》§R-xx：标题", "info")`，
   正文已收录在 docs/RULES-V9.7.0.md，不丢信息。
   用法：node tools/_fold_rules.mjs [--apply]   （不带 --apply 只打印计划） */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const idx = JSON.parse(fs.readFileSync(path.join(root, "tools", "_rules_index.json"), "utf8"));
const apply = process.argv.includes("--apply");

/* 每个域保留的那一张（口径定义型、跨 tab 通用） */
const KEEP = {
  analytics: "企业指标口径（业务方案 §19.3 五组 · §19.5 口径定义）",
  audio: "生成与校验规则",
  compliance: "授权有效期规则",
  cost: "十维成本口径",
  director: "规划口径",
  models: "路由原则",
  notify: "升级规则",
  ops: "平台边界说明",
  orgs: "治理边界",
  post: "审核结论口径（业务方案 §16.3 · 四种结论）",
  projects: "状态定义与进入条件",
  quality: "报告可信口径",
  tasks: "重试规则",
  video: "四状态分离口径",
  workspace: "能力边界"
};

/* 从 `U.card(` 起做括号配对扫描（识别 " ' ` 三种引号与转义），返回整段调用的结束下标 */
function matchCall(src, start) {
  let i = start + "U.card".length;      // 指向 '('
  let depth = 0;
 let quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

const plan = [];
Object.keys(idx).forEach((d) => {
  const keep = KEEP[d];
  idx[d].forEach((c) => {
    if (c.title === keep) return;
    plan.push({ domain: d, ...c });
  });
});

console.log(`计划折叠 ${plan.length} 张（保留 ${Object.keys(KEEP).length} 张）`);
plan.forEach((p) => console.log(` - ${p.id} ${p.route} 「${p.title}」`));
if (!apply) process.exit(0);

const files = new Map();
let folded = 0, missed = [];
plan.forEach((p) => {
  const file = path.join(root, "modules", p.domain, "pages.js");
  if (!files.has(file)) files.set(file, fs.readFileSync(file, "utf8"));
  let src = files.get(file);
  const needle = `U.card("${p.title}"`;
  const at = src.indexOf(needle);
  if (at < 0) { missed.push(`${p.domain} 「${p.title}」未在源码中定位到`); return; }
  const end = matchCall(src, at);
  if (end < 0) { missed.push(`${p.domain} 「${p.title}」括号配对失败`); return; }
  const repl = `U.notice("口径与规则见《口径与规则汇总》§${p.id}：${p.title}", "info")`;
  src = src.slice(0, at) + repl + src.slice(end + 1);
  files.set(file, src);
  folded++;
});
files.forEach((src, file) => fs.writeFileSync(file, src, "utf8"));
console.log(`已折叠 ${folded} 张${missed.length ? "；未命中 " + missed.length + " 条:\n - " + missed.join("\n - ") : ""}`);
