/* _audit_ia.mjs：信息架构与口径静态核查（只读）
 * 输出：每条路由的标题/权限/页眉章节/卡片标题/指标标签/取数函数/按钮文案，
 *       以及跨页重复的卡片标题、指标标签、按钮目标、硬编码 ID、系数造假等可疑项。
 * 用法：node tools/_audit_ia.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd());
const DIRS = readdirSync(join(ROOT, "modules")).filter(d => statSync(join(ROOT, "modules", d)).isDirectory());

function read(p) { return readFileSync(join(ROOT, p), "utf8"); }

/* ---------- 菜单 ---------- */
const dataSrc = read("assets/js/data.js");
const menu = [];
{
  const menuBlock = dataSrc.slice(dataSrc.indexOf("menu: ["), dataSrc.indexOf("/* ---------- 平台管理与系统 ---------- */"));
  /* 逐个 group / branch / item 粗解析：依靠缩进层级 */
  const lines = menuBlock.split("\n");
  let g = null, b = null;
  for (const line of lines) {
    const mG = line.match(/^\s{6}id: "([^"]+)", label: "([^"]+)"/);
    const mB = line.match(/^\s{6}\{ id: "([^"]+)", label: "([^"]+)", items: \[/);
    const mI = line.match(/^\s{8}\{ id: "([^"]+)", label: "([^"]+)"(.*)$/);
    if (mG) { g = { id: mG[1], label: mG[2], branches: [] }; menu.push(g); b = null; }
    else if (mB && g) { b = { id: mB[1], label: mB[2], items: [] }; g.branches.push(b); }
    else if (mI && b) {
      const path = (mI[3].match(/path: "([^"]+)"/) || [])[1] || "";
      const hidden = /hidden: true/.test(mI[3]);
      b.items.push({ id: mI[1], label: mI[2], path: path, hidden: hidden });
    }
  }
}
const menuByPath = {};
menu.forEach(g => g.branches.forEach(b => b.items.forEach(i => {
  if (i.path) menuByPath[i.path] = { group: g.label, branch: b.label, label: i.label, hidden: i.hidden };
})));

/* ---------- 路由块 ---------- */
const routes = [];
for (const dir of DIRS) {
  const src = read(`modules/${dir}/pages.js`);
  const chunks = src.split(/\n        path: "/).slice(1);
  for (const chunk of chunks) {
    const head = chunk.slice(0, 300);
    const path = (head.match(/^([a-z]+\/[a-z]+)"/) || [])[1];
    if (!path) continue;
    const title = (head.match(/title: "([^"]*)"/) || [])[1] || "";
    const perm = (head.match(/permission: (\[[^\]]*\]|"[^"]*")/) || [])[1] || "";
    const projectScoped = /projectScoped: true/.test(head);
    const menuOff = /menu: false/.test(head);
    const body = chunk;
    routes.push({
      module: dir, path, title, perm: perm.replace(/"/g, ""), projectScoped, menuOff,
      menu: menuByPath[path] || null,
      len: body.length,
      pageHeader: (body.match(/U\.page\(\s*"([^"]*)"\s*,\s*"([^"]*)"/) || []).slice(1),
      cards: [...body.matchAll(/U\.card\("([^"]*)"/g)].map(m => m[1]),
      metrics: [...body.matchAll(/U\.metric\("([^"]*)"/g)].map(m => m[1]),
      btns: [...body.matchAll(/U\.btn\("([^"]+)", "([a-zA-Z0-9_.]+)"/g)].map(m => m[1] + "→" + m[2]),
      data: {
        visibleProjects: (body.match(/derived\.visibleProjects\(/g) || []).length,
        myProjects: (body.match(/derived\.myProjects\(/g) || []).length,
        currentProject: (body.match(/App\.currentProject\(/g) || []).length,
        rawProjects: (body.match(/D\.projects\.filter|DB\.projects\.filter/g) || []).length,
        rawTasks: (body.match(/D\.tasks\.filter/g) || []).length,
        home: (body.match(/derived\.home\(/g) || []).length,
        workflow: (body.match(/derived\.workflow\(/g) || []).length,
        scopeLabel: (body.match(/scopeLabel\(/g) || []).length,
        qualityOf: (body.match(/derived\.qualityOf\(/g) || []).length,
      },
      hardIds: [...body.matchAll(/"SP-26[0-9]{3}"/g)].map(m => m[0]),
      coeffs: [...body.matchAll(/Math\.round\([^)]*\*\s*0\.\d+/g)].map(m => m[0]),
      tables: [...body.matchAll(/U\.table\(\[([^\]]*)\]/g)].map(m => m[1].replace(/"/g, "").replace(/\s+/g, "")),
      empties: [...body.matchAll(/U\.empty\("([^"]*)"/g)].map(m => m[1]),
      hasGuard: /projectGuard|canViewProject/.test(body),
    });
  }
}

/* ---------- 输出 ---------- */
const out = [];
const log = (...a) => out.push(a.join(" "));

log("=== 1. 路由 × 菜单 × 页眉 一致性 ===");
log("path | 菜单(组/分支/名) | 页面 title | 页眉章节 | 权限 | 菜单可见 | projectScoped | 长度");
routes.forEach(r => {
  const m = r.menu ? `${r.menu.group}/${r.menu.branch}/${r.menu.label}` : "（不在菜单）";
  const hdr = r.pageHeader.length ? r.pageHeader[0] : "（无 U.page 首参）";
  log([r.path, m, r.title, hdr, r.perm, r.menu ? (r.menu.hidden ? "hidden" : "yes") : "no", r.projectScoped ? "Y" : "-", r.len].join(" | "));
});

log("");
log("=== 2. 菜单 label 与页面 title 不一致 ===");
routes.filter(r => r.menu && r.menu.label !== r.title).forEach(r => log(`${r.path}: 菜单「${r.menu.label}」 vs title「${r.title}」`));

log("");
log("=== 3b. 页眉章节名 vs 二级菜单名 ===");
routes.filter(r => r.menu && r.pageHeader.length).forEach(r => {
  const br = r.menu.branch;
  const seg = String(r.pageHeader[0]).split(/\s*\/\s*/)[0];
  if (seg !== br) log(`${r.path}: 页眉「${seg}」 vs 二级菜单「${br}」`);
});

log("");
log("=== 3c. 同一二级菜单下出现多个页眉章节 ===");
const branchHeader = {};
routes.forEach(r => {
  if (!r.menu || !r.pageHeader.length) return;
  const k = r.menu.group + "/" + r.menu.branch;
  (branchHeader[k] = branchHeader[k] || []).push(r.path + "→" + r.pageHeader[0]);
});
Object.entries(branchHeader).forEach(([k, v]) => {
  const set = new Set(v.map(x => x.split("→")[1].split(/\s*\/\s*/)[0]));
  if (set.size > 1) log(`${k}: ${v.join(" | ")}`);
});

log("");
log("=== 3d. 同一按钮文案不同动作 ===");
const labelAction = {};
routes.forEach(r => r.btns.forEach(b => {
  const [label, act] = b.split("→");
  const k = label;
  labelAction[k] = labelAction[k] || {};
  (labelAction[k][act] = labelAction[k][act] || []).push(r.path);
}));
Object.entries(labelAction).forEach(([k, acts]) => {
  if (Object.keys(acts).length > 1) {
    log(`「${k}」: ${Object.entries(acts).map(([a, v]) => a + "(" + v.length + "页)").join(" / ")}`);
  }
});


log("");
log("=== 4. 跨页重复卡片标题（同标题出现≥2 页）===");
const cardMap = {};
routes.forEach(r => r.cards.forEach(c => {
  const key = c.replace(/（.*?）/g, "").replace(/·.*/, "").trim();
  (cardMap[key] = cardMap[key] || []).push(r.path);
}));
Object.entries(cardMap).filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length)
  .forEach(([k, v]) => log(`${k} → ${v.join(", ")}`));

log("");
log("=== 5. 跨页重复指标标签 ===");
const metMap = {};
routes.forEach(r => r.metrics.forEach(c => {
  const key = c.trim();
  (metMap[key] = metMap[key] || []).push(r.path);
}));
Object.entries(metMap).filter(([, v]) => v.length > 1).forEach(([k, v]) => log(`${k} → ${v.join(", ")}`));

log("");
log("=== 6. 页面内 metric 与 card 同义重复（页内）===");
routes.forEach(r => {
  /* 只把「卡名与指标名实质相同」算重复：去括号补充说明、去 · 后缀、去空格后仍相等 */
  const norm = (s) => String(s).replace(/（.*?）/g, "").replace(/·.*$/, "").replace(/\s/g, "");
  const same = r.metrics.filter(m => r.cards.some(c => norm(c) === norm(m)));
  if (same.length) log(`${r.path}: metric ${same.join(" / ")} ↔ cards ${r.cards.join(" / ")}`);
});

log("");
log("=== 7. 同一按钮目标的多页入口（新建/清单类）===");
const btnMap = {};
routes.forEach(r => r.btns.forEach(b => { (btnMap[b] = btnMap[b] || []).push(r.path); }));
Object.entries(btnMap).filter(([k, v]) => v.length > 2).sort((a, b) => b[1].length - a[1].length).slice(0, 40)
  .forEach(([k, v]) => log(`${k} (${v.length}) → ${v.join(", ")}`));

log("");
log("=== 8. 取数函数分布 ===");
routes.forEach(r => {
  const d = r.data;
  const parts = Object.entries(d).filter(([, n]) => n > 0).map(([k, n]) => `${k}:${n}`);
  log(`${r.path} | ${parts.join(" ")}${r.hasGuard ? " | guard" : ""}`);
});

log("");
log("=== 9. 硬编码项目 ID / 系数造假 ===");
routes.forEach(r => {
  if (r.hardIds.length || r.coeffs.length) log(`${r.path}: ids=${r.hardIds.join(",") || "-"} coeff=${r.coeffs.join(",") || "-"}`);
});

log("");
log("=== 10. 权限码语义分布 ===");
const permMap = {};
routes.forEach(r => { (permMap[r.perm] = permMap[r.perm] || []).push(r.path); });
Object.entries(permMap).sort((a, b) => b[1].length - a[1].length).forEach(([k, v]) => log(`${k} (${v.length}): ${v.join(", ")}`));

log("");
log("=== 11. 逐页区块清单（卡片 / 指标 / 按钮）===");
routes.forEach(r => {
  log(`--- ${r.path} [${r.cardCount = r.cards.length} 卡 / ${r.metrics.length} 指标 / ${r.btns.length} 按钮] ${r.menu ? r.menu.group + "/" + r.menu.branch : ""}`);
  if (r.metrics.length) log(`  指标: ${r.metrics.join(" | ")}`);
  if (r.cards.length) log(`  卡片: ${r.cards.join(" | ")}`);
  if (r.btns.length) log(`  按钮: ${r.btns.join(" | ")}`);
});

const text = out.join("\n");
console.log(text);
