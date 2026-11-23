import fs from "node:fs";
const f = "modules/audio/pages.js";
let s = fs.readFileSync(f, "utf8");
const lines = s.split("\n");
const out = lines.map((ln) => {
  const m = ln.match(/Store\.spend\((d\.project|"SP-26031"),\s*"(音频|字幕)",\s*([0-9.]+),\s*(.+)\);\s*$/);
  if (!m) return ln;
  const cap = m[2] === "音频" ? "音频生成" : "字幕生成";
  const indent = ln.match(/^\s*/)[0];
  return `${indent}Store.spend(${m[1]}, ${m[3]}, { cap: "${cap}", note: ${m[4]} });`;
});
fs.writeFileSync(f, out.join("\n"));
console.log(out.filter((l) => l.includes("Store.spend(")).join("\n"));
