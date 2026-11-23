import fs from "node:fs";
const files = {
  "modules/projects/pages.js": ['App.on("projects.saveDraft"', 'App.on("projects.create"', 'App.on("projects.pause"', 'App.on("projects.terminate"'],
  "modules/workspace/pages.js": ['App.on("workspace.parse"', 'App.on("workspace.run"'],
  "modules/notify/pages.js": ['App.on("notify.handle"', 'App.on("notify.escalate"', 'App.on("notify.incidentAction"'],
};
for (const [f, keys] of Object.entries(files)) {
  const s = fs.readFileSync(f, "utf8");
  for (const k of keys) {
    const i = s.indexOf(k);
    if (i < 0) { console.log("MISS " + k); continue; }
    const end = s.indexOf('App.on(', i + 5);
    console.log("\n===== " + f + " :: " + k);
    console.log(s.slice(i, end < 0 ? undefined : Math.min(end, i + 1600)));
  }
}
