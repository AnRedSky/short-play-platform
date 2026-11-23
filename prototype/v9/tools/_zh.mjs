import fs from "fs";
const glob=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?glob(d+"/"+e.name):[d+"/"+e.name]);
const targets=[...glob("modules").filter(f=>f.endsWith("pages.js")),"assets/js/data.js","assets/js/ui.js","assets/js/app.js","assets/js/store.js","assets/js/derived.js"];
const kickers={
"REPORT / ENTERPRISE":"经营分析 / 企业整体","REPORT / DEPARTMENTS":"经营分析 / 部门对比","REPORT / EMPLOYEES":"经营分析 / 员工对比",
"WORKSPACE / MY DATA":"工作台 / 我的数据","WORKSPACE / ASSETS":"资产 / 资产库","WORKSPACE / ASSET REFS":"资产 / 引用关系",
"WORKSPACE / DIALOGUE":"音频与字幕 / 对白配音","WORKSPACE / VOICE":"音频与字幕 / 声音档案","WORKSPACE / MUSIC":"音频与字幕 / 配乐与音效","WORKSPACE / SUBTITLE":"音频与字幕 / 字幕与口型",
"COMPLIANCE / RIGHTS":"合规与审计 / 权利与授权","COMPLIANCE / RISKS":"合规与审计 / 风险与异常","COMPLIANCE / AUDIT":"合规与审计 / 审计日志",
"WORKSPACE / COST":"成本与预算 / 成本台账","WORKSPACE / BUDGET":"成本与预算 / 预算与阈值","WORKSPACE / USAGE":"成本与预算 / 用量与计量",
"CREATION / BRIEF":"创意与剧本 / 创意设定","CREATION / PLAN":"创意与剧本 / 创意方案","CREATION / SCRIPT":"创意与剧本 / 剧本版本","CREATION / REVIEW A":"创意与剧本 / 剧本审核","CREATION / BREAKDOWN":"创意与剧本 / 剧本拆解",
"WORKSPACE / DIRECTOR":"导演规划 / 镜头生产计划","WORKSPACE / CAST":"导演规划 / 人物视觉档案","WORKSPACE / WORLD":"导演规划 / 场景与道具","WORKSPACE / SHOT":"导演规划 / 镜头契约","WORKSPACE / BOARD":"导演规划 / 分镜板",
"WORKSPACE / RESOURCES":"模型与资源 / 资源配置","WORKSPACE / PROVIDERS":"模型与资源 / 供应商与模型","WORKSPACE / ROUTING":"模型与资源 / 能力与路由",
"WORKSPACE / INBOX":"通知与异常 / 待办与通知","WORKSPACE / INCIDENTS":"通知与异常 / 异常中心",
"PLATFORM / OPS":"平台管理 / 平台总览","PLATFORM / DICTIONARY":"平台管理 / 能力字典","PLATFORM / RESOURCES":"平台管理 / 队列与存储","PLATFORM / CONFIG":"平台管理 / 业务配置",
"ENTERPRISE / PEOPLE / 403":"组织与权限 / 员工档案（无权限）","ENTERPRISE / SUBJECT":"组织与权限 / 企业主体","ENTERPRISE / ORG":"组织与权限 / 部门与组织","ENTERPRISE / PEOPLE":"组织与权限 / 员工账号","ENTERPRISE / RBAC":"组织与权限 / 角色与权限","ENTERPRISE / GRANT":"组织与权限 / 项目授权","ENTERPRISE / OFFBOARDING":"组织与权限 / 离职与移交",
"WORKSPACE / TIMELINE":"后期与交付 / 时间线与剪辑","WORKSPACE / EPISODES":"后期与交付 / 分集成片","WORKSPACE / FINAL REVIEW":"后期与交付 / 最终成片审核","WORKSPACE / DELIVERY":"后期与交付 / 交付包","WORKSPACE / WORKS":"后期与交付 / 作品库","WORKSPACE / VERSIONS":"后期与交付 / 版本链",
"PROJECT / CENTER":"项目中心 / 项目列表","PROJECT / CREATE":"项目中心 / 新建项目","PROJECT / 403":"项目中心 / 无权限","PROJECT / LIFECYCLE":"项目中心 / 生命周期",
"WORKSPACE / QUALITY GATE":"质量与返工 / 质量门禁","WORKSPACE / QC REPORTS":"质量与返工 / 质量报告","WORKSPACE / REWORK":"质量与返工 / 返工台账",
"WORKSPACE / TASKS":"任务与队列 / 生产任务","WORKSPACE / QUEUE":"任务与队列 / 资源池与队列","WORKSPACE / ATTEMPTS":"任务与队列 / 尝试与调用",
"WORKSPACE / VIDEO":"视频生产 / 生产队列","WORKSPACE / RESULTS":"视频生产 / 生成结果","WORKSPACE / PREVIEW":"视频生产 / 预览与校验",
"WORKSPACE / HOME":"工作台 / 首页","WORKSPACE / COMMAND":"工作台 / 指令式生产助手","WORKSPACE / PROJECTS":"工作台 / 我的项目"
};
const terms={
"Video Provider A":"视频供应商 A","Vision Provider":"视觉供应商","Speech Provider":"语音供应商","Transcode Provider":"转码供应商","Reasoning Provider":"推理供应商","Image Provider B":"图像供应商 B",
"Video Model A":"视频模型 A","Video Model B":"视频模型 B","Vision Model V2":"视觉模型 V2","Voice Model B":"语音模型 B","QC Model Q1":"质检模型 Q1","Transcode Model T1":"转码模型 T1","Reasoning Model R1":"推理模型 R1","Image Model I1":"图像模型 I1","Image Model I2":"图像模型 I2","Image Model I3":"图像模型 I3","Music Model M1":"配乐模型 M1","SFX Model S2":"音效模型 S2",
"创意 brief":"创意设定","brief 台账":"创意设定台账","新建 brief":"新建创意设定","brief 是整条链路":"创意设定是整条链路","结构化 brief":"结构化创意设定","brief 版本":"创意设定版本","基于 brief":"基于创意设定","方案 + brief 版本号":"方案 + 创意设定版本号","与 brief 版本":"与创意设定版本","brief 内容":"创意设定内容"
};
let changed=0;
for(const f of targets){
  let s=fs.readFileSync(f,"utf8");
  const before=s;
  for(const [k,v] of Object.entries(kickers)) s=s.split(k).join(v);
  for(const [k,v] of Object.entries(terms)) s=s.split(k).join(v);
  if(s!==before){fs.writeFileSync(f,s);changed++;}
}
console.log("files changed:",changed);
