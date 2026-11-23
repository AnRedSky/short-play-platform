import fs from "fs";
const glob=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?glob(d+"/"+e.name):[d+"/"+e.name]);
for(const f of glob("modules").filter(f=>f.endsWith("pages.js"))){
  const s=fs.readFileSync(f,"utf8");
  for(const re of [/title:\s*"([^"]+)"/g,/label:\s*"([^"]+)"/g]){
    let m;while(m=re.exec(s)){if(/[A-Za-z]{3,}/.test(m[1]))console.log(f+" :: "+m[1]);}
  }
}
