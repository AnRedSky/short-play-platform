// 扫描：页面声明的动作 vs 已注册的 App.on 处理
import fs from "fs";
import path from "path";

const root = process.cwd();
const jsFiles = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (f.endsWith(".js")) jsFiles.push(p);
  }
}
walk(path.join(root, "modules"));
const appSrc = fs.readFileSync(path.join(root, "assets/js/app.js"), "utf8");

const registered = new Set();
const onRe = /(?:App\.)?on\(\s*"([^"]+)"/g;
for (const f of jsFiles.concat([path.join(root, "assets/js/app.js")])) {
  const src = fs.readFileSync(f, "utf8");
  let m;
  while ((m = onRe.exec(src))) {
    // App.on 与模块内裸 on 均视为注册
    registered.add(m[1]);
  }
}

const used = new Map();
for (const f of jsFiles) {
  const src = fs.readFileSync(f, "utf8");
  let m;
  const re = /(?:U\.btn\(\s*"[^"]*"\s*,\s*"([^"]+)"|data-action="([^"]+)")/g;
  while ((m = re.exec(src))) {
    const name = m[1] || m[2];
    if (!name || name.indexOf("+") >= 0) continue;
    if (!used.has(name)) used.set(name, new Set());
    used.get(name).add(path.basename(path.dirname(f)));
  }
}

const missing = [...used.keys()].filter(n => !registered.has(n)).sort();
console.log("registered actions:", registered.size, "| referenced:", used.size, "| unregistered:", missing.length);
for (const n of missing) console.log("  MISSING", n, "->", [...used.get(n)].join(","));
