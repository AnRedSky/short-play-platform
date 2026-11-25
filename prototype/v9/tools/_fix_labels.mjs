/* tools/_fix_labels.mjs — R-19 收口：把同一 action 的多处文案统一为单一文案
   做法：按「"<旧文案>", "<动作>"」整对替换，替换前逐条打印命中数，避免误伤同名字符串。
   幂等：旧文案被替换后不再命中。用 Node 读写（UTF-8），不使用 PowerShell 批量替换。
   注：`projects.wfDelivery` 保留两支文案（待确认 → 确认交付并冻结 / 门禁满足 → 生成交付包），
       属同一动作按交付状态切换的互斥 CTA，已在 `_audit_labels.mjs` 白名单写明理由。 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const PAIRS = [
  ["modules/projects/pages.js", '"查看审计流水", "compliance.toAudit"', '"审计日志", "compliance.toAudit"', 1],
  ["modules/director/pages.js", '"先选定创意方案", "creation.toPlan"', '"查看方案", "creation.toPlan"', 1],
  ["modules/director/pages.js", '"先完成剧本审核", "creation.toScript"', '"剧本版本", "creation.toScript"', 1],
  ["modules/director/pages.js", '"查看生产流水线", "projects.wfOpen"', '"制作流水线", "projects.wfOpen"', 1],
  ["modules/video/pages.js", '"查看项目档案", "projects.detail"', '"项目档案", "projects.detail"', 1],
  ["modules/workspace/pages.js", '"进入项目", "projects.detail"', '"项目档案", "projects.detail"', 1],
  ["modules/post/pages.js", '"打开制作流水线", "projects.wfOpen"', '"制作流水线", "projects.wfOpen"', 2],
];

PAIRS.forEach(([rel, from, to, expect]) => {
  const p = path.join(root, rel);
  let src = fs.readFileSync(p, "utf8");
  const n = src.split(from).length - 1;
  if (!n) { console.log(`SKIP ${rel} 未命中 ${from}`); return; }
  if (expect && n !== expect) { console.log(`WARN ${rel} 命中 ${n} 次（预期 ${expect}）：${from}`); }
  src = src.split(from).join(to);
  fs.writeFileSync(p, src, "utf8");
  console.log(`OK ${rel} ${n} 处 ${from.split(",")[0]} → ${to.split(",")[0]}`);
});
