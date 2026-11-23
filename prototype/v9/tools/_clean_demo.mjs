import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "tools" || e.name === "docs" || e.name.startsWith("_")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|html)$/.test(e.name)) files.push(p);
  }
})(root);

const map = [
  [/（演示）/g, ""],
  [/（演示，/g, "（"],
  [/演示项目/g, "项目"],
  [/演示身份/g, "当前身份"],
  [/演示占位/g, "画面占位"],
  [/演示会话/g, "本次会话"],
  [/演示开关/g, "通知渠道配置"],
  [/演示台账/g, "授权台账"],
  [/演示模型/g, "默认模型"],
  [/演示注册表/g, "适配器注册表"],
  [/演示内存态/g, "内存态"],
  [/演示数据，未连接真实监控/g, "未连接真实监控源"],
  [/演示参数，无实际音频/g, "参数取自最近一次生成记录"],
  [/原型不包含真实音频文件/g, "静态原型不内置媒体文件"],
  [/试听入口仅演示交互与参数结构，不播放任何声音/g, "试听入口展示音色参数与波形结构，不播放音频"],
  [/演示编辑：/g, "编辑依据："],
  [/演示记录/g, "业务记录"],
  [/演示态/g, "静态展示态"],
  [/演示声明/g, "原型声明"],
  [/演示原型/g, "静态原型"],
  [/演示交互/g, "交互流程"],
  [/演示表现/g, "界面表现"],
  [/仅演示边界/g, "仅展示边界"],
  [/只演示边界/g, "只展示边界"],
];

let changed = 0;
for (const p of files) {
  const src = fs.readFileSync(p, "utf8");
  let out = src;
  for (const [re, to] of map) out = out.replace(re, to);
  if (out !== src) { fs.writeFileSync(p, out); changed += 1; console.log("rewrote " + path.relative(root, p)); }
}
console.log("files changed: " + changed);
