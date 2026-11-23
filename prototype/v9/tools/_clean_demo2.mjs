import fs from "node:fs";

const edits = [
  ["modules/audio/pages.js", "U.card(\"演示说明\"", "U.card(\"静态原型说明\""],
  ["modules/audio/pages.js", "（演示不执行批量重跑）", "（需在生产页逐条重跑受影响对白）"],
  ["modules/creation/pages.js", "标注「只读演示」", "标注「只读」"],
  ["modules/creation/pages.js", "替换简易演示动作", "替换旧版简易动作"],
  ["modules/models/pages.js", "仅用于演示，请勿填写真实密钥", "仅存于内存态，请勿填写真实密钥"],
  ["modules/orgs/pages.js", "[\"演示说明\", \"企业信息为虚构主体，全部数值为演示数据\"]", "[\"原型说明\", \"企业信息为虚构主体，全部数值为虚构示例数据\"]"],
  ["modules/orgs/pages.js", "名员工 · 演示数据", "名员工 · 虚构示例数据"],
  ["modules/post/pages.js", "版本链演示：", "版本链："],
  ["modules/video/pages.js", "以画幅占位与契约摘要演示评审结构，明确标注为静态展示态。", "以画幅占位与契约摘要呈现评审结构，明确标注为静态展示态。"],
  ["modules/workspace/pages.js", "自然语言指令（演示仅做关键词解析）", "自然语言指令（按关键词解析）"],
  ["modules/workspace/pages.js", "U.card(\"演示说明\"", "U.card(\"静态原型说明\""],
  ["modules/workspace/pages.js", "本页仅演示指令解析与校验流程，不接入任何语言模型；解析结果由关键词规则生成，用于评审交互与信息结构。", "本页展示指令解析与校验流程，不接入任何语言模型；解析结果由关键词规则生成，用于评审交互与信息结构。"],
  ["modules/orgs/pages.js", "权限差异用于演示「不同身份看到的菜单、页面、操作不同」；原型不实现真实鉴权、服务端数据隔离与字段级权限。", "权限差异体现「不同身份看到的菜单、页面、操作不同」；本原型仅在浏览器侧校验，服务端鉴权、数据隔离与字段级权限由实际系统实现。"],
  ["modules/projects/pages.js", "不用前端文案模拟。", "不由前端文案伪造。"],
  ["modules/projects/pages.js", "不靠人工点按钮模拟。", "不靠人工点按钮伪造。"],
];

for (const [f, a, b] of edits) {
  const s = fs.readFileSync(f, "utf8");
  if (s.indexOf(a) < 0) { console.log("MISS " + f + " :: " + a.slice(0, 40)); continue; }
  fs.writeFileSync(f, s.split(a).join(b));
  console.log("ok " + f + " :: " + a.slice(0, 24));
}
