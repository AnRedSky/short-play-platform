import fs from "fs";
const f="modules/director/pages.js";
const lines=fs.readFileSync(f,"utf8").split(/\r?\n/);
const start=lines.findIndex(l=>l.includes("App.on(\"director.replan\""));
const end=lines.findIndex(l=>l.includes("App.on(\"director.sceneShots\""));
console.log(start+1,end+1,lines[start].trim(),lines[end].trim());
lines.splice(start,end-start);
fs.writeFileSync(f,lines.join("\n"));
