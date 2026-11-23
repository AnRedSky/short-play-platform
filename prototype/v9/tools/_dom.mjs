import { execFileSync } from "node:child_process";
import fs from "node:fs";

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const routes = [
  "video/production",
  "video/results",
  "audio/dialogue",
  "audio/subtitle",
  "post/timeline",
  "post/review",
  "post/delivery",
  "quality/reports",
  "quality/rework",
  "tasks/list",
  "tasks/queue",
  "tasks/attempt",
];
const dir = process.env.TEMP + "\\v9dom";
fs.mkdirSync(dir, { recursive: true });
for (const r of routes) {
  const out = dir + "\\" + r.replace("/", "_") + ".html";
  try {
    const dom = execFileSync(chrome, [
      "--headless=new", "--disable-gpu", "--virtual-time-budget=2500", "--dump-dom",
      "--user-data-dir=" + process.env.TEMP + "\\chrome-dom-v9",
      "http://localhost:4190/#/" + r,
    ], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 });
    fs.writeFileSync(out, dom);
    const hasRoot = dom.includes('class="screen') || dom.includes("view-head") || dom.includes("page-head");
    const err = /undefined|NaN/.test((dom.match(/<main[^>]*>[\s\S]*?<\/main>/) || [""])[0]);
    console.log(r.padEnd(20), "len=" + dom.length, hasRoot ? "rendered" : "EMPTY", err ? "⚠ undefined/NaN in main" : "");
  } catch (e) {
    console.log(r.padEnd(20), "FAILED", String(e.message).slice(0, 80));
  }
}
