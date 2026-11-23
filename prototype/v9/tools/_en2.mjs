import fs from "fs";
const glob=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?glob(d+"/"+e.name):[d+"/"+e.name]);
const files=glob("modules").filter(f=>f.endsWith("pages.js"));
for(const f of files){const s=fs.readFileSync(f,"utf8");const re=/U\.btn\(\s*"([^"]+)"/g;let m;while(m=re.exec(s)){if(/[A-Za-z]{2,}/.test(m[1]))console.log(f+" :: "+m[1]);}}
