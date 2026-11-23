import fs from "node:fs";
const f = process.argv[2];
const s = fs.readFileSync(f, "utf8");
const i = s.indexOf('App.on("quality.rerun');
const j = s.indexOf('App.on("tasks.toList');
console.log(f.includes("tasks") ? s.slice(j) : s.slice(i));
