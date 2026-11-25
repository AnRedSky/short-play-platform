/* _audit_ia3.mjs：按钮文案 → 动作 → 落点路由 的一致性核查（只读） */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DIRS = readdirSync(join(ROOT, "modules")).filter(d => statSync(join(ROOT, "modules", d)).isDirectory());
const src = {};
for (const d of DIRS) src[d] = readFileSync(join(ROOT, "modules", d, "pages.js"), "utf8");
const appSrc = readFileSync(join(ROOT, "assets/js/app.js"), "utf8");

/* 动作 → 目标路由（仅取简单导航：App.on("x", () => App.go("route", ...)) 或单行 App.go） */
const actionGo = {};
const pushGo = (act, route) => { (actionGo[act] = actionGo[act] || []).push(route); };
let m;
for (const d of DIRS) {
  const text = src[d];
  const re = /App\.on\("([^"]+)",\s*(?:\([^)]*\)\s*=>\s*)?(?:\(?\s*)?(?:\{[^}]*?(?:App\.go|App\.open)\(|(?:App\.go|App\.open)\()"([^"]+)"/g;
  while ((m = re.exec(text))) pushGo(m[1], m[2]);
  /* 再兜一层：同一 App.on 块内最近一次 App.go */
  const blocks = text.split(/App\.on\("/).slice(1);
  for (const b of blocks) {
    const name = (b.match(/^([^"]+)"/) || [])[1];
    if (!name || actionGo[name]) continue;
    const head = b.slice(0, 600);
    const g = head.match(/App\.(?:go|open)\("([^"]+)"/);
    if (g) pushGo(name, g[1]);
  }
}
/* app.js 内通用导航 */
/* 通用导航：按 App.on 块切分，块内首个 go/open 即落点（避免跨块串味） */
for (const b of appSrc.split(/App\.on\("/).slice(1)) {
  const name = (b.match(/^([^"]+)"/) || [])[1];
  if (!name) continue;
  const g = b.slice(0, 600).match(/App\.(?:go|open)\("([^"]+)"|\bgo\("([^"]+)"|\bopen\("([^"]+)"/);
  if (g) pushGo(name, g[1] || g[2] || g[3]);
}

/* 路由标题表 */
const titles = {};
for (const d of DIRS) {
  const text = src[d];
  for (const it of text.matchAll(/path: "([a-z]+\/[a-z]+)", title: "([^"]+)"/g)) titles[it[1]] = it[2];
}

const rows = [];
for (const d of DIRS) {
  const text = src[d];
  const chunks = text.split(/\n        path: "/).slice(1);
  for (const chunk of chunks) {
    const page = (chunk.match(/^([a-z]+\/[a-z]+)"/) || [])[1];
    if (!page) continue;
    for (const b of chunk.matchAll(/U\.btn\("([^"]+)", "([a-zA-Z0-9_.]+)"/g)) {
      const label = b[1], act = b[2];
      const go = actionGo[act];
      rows.push({ page, label, act, go: go ? [...new Set(go)][0] : "" });
    }
  }
}

console.log("=== A. 按钮 → 动作 → 落点 ===");
rows.forEach(r => {
  const t = r.go ? (titles[r.go] || "?") : "（弹窗/作业/非导航）";
  console.log(`${r.page} | 「${r.label}」 | ${r.act} → ${r.go || "-"} (${t})`);
});

console.log("");
console.log("=== B. 文案与落点疑似不符 ===");
const kws = [["生成结果", "结果"], ["结果", "结果"], ["分镜", "分镜"], ["剧本", "剧本"], ["项目列表", "项目列表"], ["队列", "队列"], ["尝试", "尝试"], ["资产", "资产"], ["授权", "授权"], ["质量报告", "质量报告"], ["交付", "交付"], ["审核", "审核"], ["台账", "台账"], ["通知", "通知"], ["成本", "成本"], ["预算", "预算"]];
rows.forEach(r => {
  if (!r.go) return;
  const title = titles[r.go] || "";
  const hit = kws.filter(([k]) => r.label.indexOf(k) >= 0);
  if (!hit.length) return;
  const anyMatch = hit.some(([, kw]) => title.indexOf(kw) >= 0);
  if (!anyMatch) console.log(`${r.page} | 「${r.label}」 → ${r.go}「${title}」`);
});

console.log("");
console.log("=== C. 同一动作被多少不同文案使用 ===");
const byAct = {};
rows.forEach(r => (byAct[r.act] = byAct[r.act] || []).push(r.label));
Object.entries(byAct).filter(([, v]) => new Set(v).size > 1).forEach(([a, v]) => console.log(`${a}: ${[...new Set(v)].join(" / ")}`));
