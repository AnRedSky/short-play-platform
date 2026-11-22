/* DB：V8 静态原型演示字典。所有数据均为虚构样例，不代表真实生产或成本。 */
window.DB={
 meta:{name:"FRAME",version:"V8.0.1",notice:"静态交互原型 / 演示数据"},
 identities:[
  {id:"enterprise-admin",name:"企业管理员",role:"企业管理员",permissions:["*"]},
  {id:"manager",name:"企业经营管理",role:"企业管理人员",permissions:["overview.read","projects.read","analytics.read","people.read","audit.read"]},
  {id:"employee",name:"制作员工",role:"普通员工",permissions:["overview.read","projects.own","creation.write","production.write","assets.write","models.own","delivery.write","analytics.own"]},
  {id:"auditor",name:"审计人员",role:"审计人员",permissions:["overview.read","projects.read","analytics.read","audit.read"]}
 ],
 currentIdentity:"enterprise-admin",
 nav:[
  {label:"企业管理",items:[["企业总览","enterprise/overview","⌂","overview.read"],["组织与员工","people/members","♙","people.read"],["项目管理","projects/list","▦","projects.read"],["经营分析","analytics/enterprise","▤","analytics.read"],["合规与审计","compliance/audit","◈","audit.read"]]},
  {label:"AI 短剧制作",items:[["我的工作台","projects/workbench","⌘","overview.read"],["创意与剧本","creation/brief","✎","creation.write"],["导演与分镜","production/board","▧","production.write"],["视频与音频","production/generation","▶","production.write"],["后期与交付","production/delivery","⇧","delivery.write"],["数字资产","assets/library","▤","assets.write"]]},
  {label:"个人 AI 资源",items:[["模型与供应商","models/providers","◇","models.own"],["调用记录","models/usage","◷","models.own"]]}
 ],
 projects:[
  {id:"SP-26031",name:"雾城来信",genre:"悬疑 / 都市",owner:"林知远",ownerId:"u1",status:"生产中",episodes:24,done:16,budget:18000,actual:9260,quality:"良好",updated:"今天 10:42"},
  {id:"SP-26028",name:"逆光的约定",genre:"都市 / 情感",owner:"陈可心",ownerId:"u2",status:"待剧本审核",episodes:20,done:0,budget:12000,actual:680,quality:"待审核",updated:"今天 09:18"},
  {id:"SP-26019",name:"长街旧梦",genre:"年代 / 家庭",owner:"王亦宁",ownerId:"u3",status:"已交付",episodes:12,done:12,budget:15000,actual:11840,quality:"通过",updated:"昨天"},
  {id:"SP-26015",name:"第七码头",genre:"悬疑 / 犯罪",owner:"林知远",ownerId:"u1",status:"异常",episodes:16,done:8,budget:16000,actual:7420,quality:"需处理",updated:"昨天"}
 ],
 users:[
  {id:"u1",name:"林知远",email:"lin@example.local",department:"内容创新部",role:"普通员工",status:"在职",projects:2,delivered:1},
  {id:"u2",name:"陈可心",email:"chen@example.local",department:"内容创新部",role:"普通员工",status:"在职",projects:1,delivered:0},
  {id:"u3",name:"王亦宁",email:"wang@example.local",department:"制作中心",role:"普通员工",status:"在职",projects:1,delivered:1},
  {id:"u4",name:"周明",email:"zhou@example.local",department:"经营管理部",role:"企业管理人员",status:"在职",projects:0,delivered:0}
 ],
 providers:[
  {id:"p1",ownerId:"u1",name:"OpenAI Compatible",kind:"自定义兼容接口",models:"文本 / 推理",masked:"sk-••••••••7K2P",status:"已验证",updated:"11-20"},
  {id:"p2",ownerId:"u1",name:"Video Provider A",kind:"视频生成服务",models:"文生视频 / 图生视频",masked:"vp-••••••••1M8Q",status:"已验证",updated:"11-19"},
  {id:"p3",ownerId:"u2",name:"Speech Provider",kind:"语音服务",models:"TTS / ASR",masked:"sp-••••••••3N5R",status:"待验证",updated:"11-18"}
 ],
 tasks:[
  {id:"T-8812",project:"SP-26031",name:"第 17 集镜头 04 视频生成",type:"视频生成",status:"执行中",model:"Video Model A",cost:38,executor:"林知远"},
  {id:"T-8811",project:"SP-26031",name:"第 17 集角色对白配音",type:"语音合成",status:"排队中",model:"Voice Model B",cost:12,executor:"林知远"},
  {id:"T-8803",project:"SP-26015",name:"第 9 集镜头 02 生成",type:"视频生成",status:"待人工处理",model:"Video Model A",cost:46,executor:"林知远"},
  {id:"T-8792",project:"SP-26028",name:"剧本结构生成",type:"文本生成",status:"成功",model:"Reasoning Model",cost:8,executor:"陈可心"}
 ],
 assets:[
  {id:"A-1201",name:"顾沉 · 正面人物设定",type:"人物参考",project:"SP-26031",version:"v3",status:"已确认",owner:"林知远"},
  {id:"A-1198",name:"旧城区雨夜 · 场景",type:"场景参考",project:"SP-26031",version:"v2",status:"已确认",owner:"林知远"},
  {id:"A-1180",name:"第 16 集成片",type:"分集成片",project:"SP-26031",version:"v1",status:"已归档",owner:"林知远"},
  {id:"A-1162",name:"长街旧梦 · 完整剧本",type:"剧本",project:"SP-26019",version:"v5",status:"正式版本",owner:"王亦宁"}
 ],
 audits:[
  {time:"今天 10:42",actor:"林知远",action:"重试视频生成任务",target:"T-8803",result:"待处理"},
  {time:"今天 09:18",actor:"陈可心",action:"提交剧本审核",target:"SP-26028",result:"成功"},
  {time:"昨天 17:30",actor:"企业管理员",action:"更新员工项目授权",target:"u2",result:"成功"}
 ],
 stats:{projects:18,delivered:7,episodes:96,activeEmployees:12,actualCost:126480,successRate:92.4}
};