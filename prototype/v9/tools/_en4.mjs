import fs from "fs";
const files=["assets/js/store.js","modules/quality/pages.js","modules/tasks/pages.js","modules/director/pages.js"];
const map=[
["新 Attempt","新一次尝试"],["次 Attempt","次尝试"],["创建 Attempt","创建尝试记录"],["创建新 Attempt 任务","创建新的尝试任务"],["创建 Attempt","创建尝试记录"],
["报告已转 PASS","报告已转为通过"],["集级质检 PASS","集级质检通过"],["6 项 PASS · 2 项 REVIEW_REQUIRED","6 项通过 · 2 项需人工判断"],["Attempt 记录","尝试记录"]
];
for(const f of files){let s=fs.readFileSync(f,"utf8");for(const [k,v] of map)s=s.split(k).join(v);fs.writeFileSync(f,s);}
console.log("ok");
