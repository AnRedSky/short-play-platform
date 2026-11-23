import fs from "fs";
const glob=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?glob(d+"/"+e.name):[d+"/"+e.name]);
const files=glob("modules").filter(f=>f.endsWith("pages.js"));
const set=new Map();
for(const f of files){const s=fs.readFileSync(f,"utf8");const re=/U\.page\(\s*"([^"]+)"/g;let m;while(m=re.exec(s)){set.set(m[1],(set.get(m[1])||0)+1);}}
console.log([...set.entries()].map(([k,v])=>v+"  "+k).join("\n"));
