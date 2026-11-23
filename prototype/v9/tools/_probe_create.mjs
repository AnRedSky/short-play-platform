import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const sandbox = { console };
sandbox.window = sandbox;
sandbox.App = {
  identity() { return sandbox.window.DB.identities.find((i) => i.id === "i-owner"); },
  toast() {}, set() {}, get(s, k, d) { return d; }, refresh() {}, go() {},
};
vm.createContext(sandbox);
vm.runInContext(read("assets/js/data.js"), sandbox, { filename: "data.js" });
vm.runInContext(read("assets/js/store.js"), sandbox, { filename: "store.js" });
const Store = sandbox.window.Store;
const r = Store.ops.createProject({ name: "E2E 直调", genre: "悬疑推理", episodes: "18", duration: "80", budget: "15000", audience: "18–30 岁都市女性" });
console.log(JSON.stringify(r).slice(0, 400));
console.log(sandbox.window.DB.projects[0].id, sandbox.window.DB.projects[0].name);
