import fs from "fs";
const files=["modules/creation/pages.js","modules/projects/pages.js","modules/workspace/pages.js","assets/js/store.js"];
const map=[
['基于创意设定 产出','基于创意设定产出'],
['"返回 brief"','"返回创意设定"'],
['符合 brief 受众','符合创意设定受众'],
['"上游引用", "brief CB-','"上游引用", "创意设定 CB-'],
['"生成 brief"','"生成创意设定"'],
['"brief 已生成','"创意设定已生成'],
['"brief · "','"创意设定 · "'],
['brief 更改会生成新版本','创意设定更改会生成新版本'],
['派生 brief 新版本','派生创意设定新版本'],
['"brief → 剧本追溯"','"创意设定 → 剧本追溯"'],
['["brief", "CB-26031-03"','["创意设定", "CB-26031-03"'],
['基于当前 brief','基于当前创意设定'],
['可填写 brief 的项目','可填写创意设定的项目'],
['"brief 已确认："','"创意设定已确认："'],
['可派生的 brief','可派生的创意设定'],
['DB.state.log("brief "','DB.state.log("创意设定 "'],
['读取已确认 brief','读取已确认创意设定'],
['未提交 brief 前','未提交创意设定前'],
['不可提交 brief','不可提交创意设定'],
['"brief 已确认，已启动','"创意设定已确认，已启动'],
['无已确认 brief','无已确认创意设定'],
['由 brief 生成','由创意设定生成']
];
for(const f of files){let s=fs.readFileSync(f,"utf8");for(const [k,v] of map){s=s.split(k).join(v);}fs.writeFileSync(f,s);}
console.log("done");
