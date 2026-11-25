/* tools/_audit_labels.mjs — 按钮文案 ↔ 动作 一致性（R-19 收口后的机器门禁）
   口径：同一个 action 在全站只允许一个文案；两类例外白名单化并写明理由：
     - common.export：对象不同（导出剧本 / 导出台账 / 导出日志…），保留对象前缀更易识别
     - quality.judge：接受 / 返工 / 驳回是决策值，不是文案分歧（由 data-value 区分）
   用法：node tools/_audit_labels.mjs */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const WHITELIST = {
  "common.export": "对象不同：导出剧本 / 导出档案 / 导出台账…保留对象前缀",
  "quality.judge": "决策值不同：接受 / 返工 / 驳回由 data-value 区分",
  "projects.wfDelivery": "同一动作按交付状态切换互斥 CTA：待确认 → 确认交付并冻结；门禁满足 → 生成交付包",
};

const files = [
  ...fs.readdirSync(path.join(root, "modules")).map((m) => `modules/${m}/pages.js`),
  "assets/js/ui.js",
  "assets/js/app.js",
];
const byAction = new Map();
const RE = /U\.btn\(\s*"([^"]+)"\s*,\s*"([^"]+)"/g;

files.forEach((rel) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return;
  const src = fs.readFileSync(p, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    RE.lastIndex = 0;
    let m;
    while ((m = RE.exec(line))) {
      const [, label, action] = m;
      if (!byAction.has(action)) byAction.set(action, []);
      byAction.get(action).push({ label, where: `${rel}:${i + 1}` });
    }
  });
});

const offenders = [];
[...byAction.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([action, list]) => {
  const labels = [...new Set(list.map((x) => x.label))];
  if (labels.length <= 1) return;
  if (WHITELIST[action]) return;
  offenders.push({ action, labels, sites: list });
});

const lines = ["## 同动作多文案（R-19 门禁：0 才通过）"];
if (!offenders.length) lines.push("无");
offenders.forEach((o) => {
  lines.push(`- ${o.action}：${o.labels.join(" / ")}`);
  o.sites.forEach((s) => lines.push(`    ${s.where}  ${s.label}`));
});
lines.push("", "## 白名单（保留多文案并写明理由）");
Object.entries(WHITELIST).forEach(([a, why]) => {
  const n = [...new Set((byAction.get(a) || []).map((x) => x.label))].length;
  lines.push(`- ${a}：${n} 个文案 · ${why}`);
});
const txt = lines.join("\n");
fs.writeFileSync(path.join(root, "tools", "_ia_labels.txt"), txt + "\n", "utf8");
console.log(`动作 ${byAction.size} 个 · 同动作多文案 ${offenders.length} 组`);
console.log(offenders.length ? offenders.map((o) => `${o.action} → ${o.labels.join(" / ")}`).join("\n") : "无（白名单 " + Object.keys(WHITELIST).join(" / ") + "）");
