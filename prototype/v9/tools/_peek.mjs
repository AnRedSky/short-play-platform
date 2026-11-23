import fs from "fs";import vm from "vm";
const s={console};s.window=s;s.location={hash:"#/"};s.document={addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},getElementById(){return null},createElement(){return{style:{},appendChild(){},setAttribute(){},classList:{add(){}}}}};vm.createContext(s);vm.runInContext(fs.readFileSync("assets/js/data.js","utf8"),s);const D=s.window.DB;
console.log(JSON.stringify(D.episodes.filter(e=>e.project==="SP-26031").slice(0,6)));
console.log(JSON.stringify(D.projects.find(p=>p.id==="SP-26031")).slice(0,1000));
console.log(D.episodes.filter(e=>e.project==="SP-26031").map(e=>e.no).join(","));
