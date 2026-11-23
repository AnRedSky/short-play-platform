import fs from "fs";
for(const f of ["assets/js/app.js","index.html","README.md"]){
  let s=fs.readFileSync(f,"utf8");
  s=s.split("ENTERPRISE STUDIO · V9").join("企业版 · 第 9 版");
  s=s.split("FRAME 短剧工场 · V9 静态原型").join("FRAME 短剧工场 · 第 9 版静态原型");
  s=s.split("FRAME 短剧工场 · V9").join("FRAME 短剧工场 · 第 9 版");
  fs.writeFileSync(f,s);
}
console.log("ok");
