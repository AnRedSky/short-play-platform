/* App：路由、导航、内存态、权限、交互动作与统一反馈。刷新重置演示状态为预期行为。 */
window.App=(function(){
 const A={routes:[],identity:DB.currentIdentity,menuOpen:false};
 function can(permission){const me=DB.identities.find(x=>x.id===A.identity);return !!me&&(me.permissions.includes("*")||me.permissions.includes(permission)||permission==="overview.read");}
 function route(path,title,permission,render){A.routes.push({path,title,permission,render});}
 function current(){const key=location.hash.startsWith("#/")?location.hash.slice(2):location.hash.slice(1);return A.routes.find(r=>r.path===key)||null;}
 function go(path){location.hash="#/"+path;}
 function nav(){return DB.nav.map(group=>'<div class="nav-label">'+group.label+'</div>'+group.items.filter(x=>can(x[3])).map(x=>'<a href="#/'+x[1]+'" class="'+((current()&&current().path===x[1])?'active':'')+'"><span class="nav-ico">'+x[2]+'</span>'+x[0]+'</a>').join("")).join("");}
 function shell(){const me=DB.identities.find(x=>x.id===A.identity);document.getElementById("app").innerHTML='<div class="shell"><aside class="sidebar '+(A.menuOpen?'open':'')+'"><div class="brand"><span class="brand-mark">F</span><div>FRAME / 短剧制作<small>ENTERPRISE STUDIO · V8</small></div></div><nav class="nav">'+nav()+'</nav><div class="sidebar-foot">企业内部业务系统<br>原型演示数据 · 不连接生产服务</div></aside><main class="main"><header class="topbar"><div class="crumb"><button class="btn ghost" data-action="menu">☰</button>　企业工作空间　/　'+(current()?current().title:'页面不存在')+'</div><div class="top-actions"><span class="pill blue">内部环境</span><select class="identity" id="identity-switch">'+DB.identities.map(x=>'<option value="'+x.id+'" '+(x.id===A.identity?'selected':'')+'>'+x.name+'</option>').join("")+'</select><span class="avatar">'+me.name.slice(0,1)+'</span></div></header><div class="content" id="view"></div></main></div>';render();}
 function render(){const r=current();if(!r){document.getElementById("view").innerHTML=UI.empty("页面不存在（404）　"+UI.btn("返回工作台","home"));return;}if(!can(r.permission)){document.getElementById("view").innerHTML=UI.empty("当前身份暂无权限访问此页面（403）　"+UI.btn("返回可用首页","home"));return;}try{document.getElementById("view").innerHTML=r.render();}catch(e){document.getElementById("view").innerHTML=UI.empty("页面渲染异常，请返回后重试。");console.error(e);}}
 function toast(msg){const root=document.getElementById("toast-root");root.innerHTML='<div class="toast">'+UI.esc(msg)+'</div>';setTimeout(()=>{root.innerHTML="";},2400);}
 function modal(title,body,submit){document.getElementById("overlay-root").innerHTML='<div class="modal-backdrop" data-action="backdrop"><div class="modal"><div class="modal-head"><h3>'+title+'</h3><button class="btn ghost" data-action="close">✕</button></div><form id="dialog-form" data-submit="'+submit+'">'+body+'<div class="head-actions"><button type="button" class="btn" data-action="close">取消</button><button class="btn primary" type="submit">确认保存</button></div></form></div></div>';}
 function close(){document.getElementById("overlay-root").innerHTML="";}
 function tableProjects(){return DB.projects.map(p=>'<tr><td><div class="entity"><span class="avatar">剧</span><div><strong>'+UI.esc(p.name)+'</strong><small>'+p.id+'</small></div></div></td><td>'+p.owner+'</td><td>'+p.genre+'</td><td>'+p.done+'/'+p.episodes+'</td><td>'+UI.tag(p.status)+'</td><td>¥'+p.actual.toLocaleString()+'</td><td><button class="btn" data-action="project-open" data-id="'+p.id+'">查看</button></td></tr>').join("");}
 function act(action,el){
  if(action==="home"){go("projects/workbench");return;}
  if(action==="menu"){A.menuOpen=!A.menuOpen;document.querySelector(".sidebar").classList.toggle("open",A.menuOpen);return;}
  if(action==="close"){close();return;}
  if(action==="backdrop"&&el.target.classList.contains("modal-backdrop")){close();return;}
  if(action==="new-project"){modal("创建短剧项目",UI.field("项目名称","name","例如：春日来信")+ '<div class="form-grid">'+UI.select("题材","genre",["都市情感","悬疑推理","古装传奇","奇幻","家庭伦理"])+UI.field("计划集数","episodes","24","number")+'</div>'+UI.field("创作目标","brief","描述故事核心、人物或冲突"),"project-create");return;}
  if(action==="new-employee"){modal("添加企业员工",UI.field("员工姓名","name","姓名")+UI.field("企业邮箱","email","name@company.com","email")+UI.select("部门","department",["内容创新部","制作中心","经营管理部","技术支持部"]),"employee-create");return;}
  if(action==="new-provider"){modal("添加个人供应商配置",'<div class="notice warn">API 凭据仅属于当前演示员工。原型不保存真实密钥；真实系统需服务端加密保存并脱敏展示。</div>'+UI.field("供应商名称","name","供应商 / 兼容接口")+UI.field("API Endpoint","endpoint","https://api.example.com")+UI.field("API Key（演示）","key","sk-…")+UI.select("能力类型","capability",["文本 / 推理","图像生成","视频生成","语音 / ASR","音乐 / 音效","视频处理"]),"provider-create");return;}
  if(action==="project-open"){const p=DB.projects.find(x=>x.id===el.dataset.id);if(p){modal("项目档案 · "+p.name,'<div class="list-row"><span>负责人</span><b>'+p.owner+'</b></div><div class="list-row"><span>项目状态</span>'+UI.tag(p.status)+'</div><div class="list-row"><span>进度</span><b>'+p.done+'/'+p.episodes+' 集</b></div><div class="list-row"><span>实际费用（演示）</span><b>¥'+p.actual+'</b></div><p class="small muted">项目归属企业；个人模型凭据不随项目共享或移交。</p><button class="btn primary" type="button" data-action="open-creation">进入制作工作台</button>',"noop");}return;}
  if(action==="open-creation"){close();go("creation/brief");return;}
  if(action==="task-retry"){toast("已创建新的演示重试记录；原失败成本保留。");return;}
  if(action==="task-pause"){toast("演示任务已暂停派发，运行中供应商任务需以回执确认。");return;}
  if(action==="asset-version"){toast("已创建新资产版本；旧版本保留。");return;}
  if(action==="generate"){toast("演示：已创建创意生成任务。未调用真实模型 API。");return;}
  if(action==="approve-script"){toast("演示审核通过：剧本版本已锁定，进入导演规划。");return;}
  if(action==="return-script"){toast("已退回剧本并记录修改意见。");return;}
  if(action==="final-approve"){toast("演示审核通过：可以创建正式交付记录。");return;}
  if(action==="export"){toast("演示导出：当前为样例数据，不含真实业务账单。");return;}
  if(action==="verify-provider"){toast("连通性测试为演示反馈，未向供应商发送请求。");return;}
  if(action==="new-shot"){toast("已追加一个待规划镜头单元（演示内存态）。");return;}
  if(action==="noop"){toast("已保存演示操作。");return;}
 }
 function submit(form){const data=Object.fromEntries(new FormData(form).entries());const action=form.dataset.submit;
  if(action==="project-create"){if(!data.name||data.name.trim().length<2){toast("项目名称至少 2 个字符");return;}const p={id:"SP-DEMO-"+String(DB.projects.length+1).padStart(3,"0"),name:data.name,genre:data.genre,owner:"当前员工",ownerId:"u-demo",status:"草稿",episodes:Math.max(1,Number(data.episodes)||1),done:0,budget:10000,actual:0,quality:"待检测",updated:"刚刚"};DB.projects.unshift(p);close();toast("项目已创建（仅本次页面会话）");go("projects/list");}
  else if(action==="employee-create"){if(!data.name||!data.email){toast("请填写姓名和邮箱");return;}DB.users.unshift({id:"u"+Date.now(),name:data.name,email:data.email,department:data.department,role:"普通员工",status:"邀请中",projects:0,delivered:0});close();toast("员工已加入演示列表");render();}
  else if(action==="provider-create"){if(!data.name||!data.endpoint){toast("请填写供应商名称和 Endpoint");return;}DB.providers.unshift({id:"p"+Date.now(),ownerId:"u1",name:data.name,kind:data.capability,models:data.capability,masked:"••••••••（已脱敏）",status:"待验证",updated:"刚刚"});close();toast("个人配置已添加到演示列表");go("models/providers");}
 }
 function start(){document.addEventListener("click",e=>{const el=e.target.closest("[data-action]");if(el)act(el.dataset.action,el);});document.addEventListener("submit",e=>{if(e.target.matches("#dialog-form")){e.preventDefault();submit(e.target);}});document.addEventListener("change",e=>{if(e.target.id==="identity-switch"){A.identity=e.target.value;shell();}});window.addEventListener("hashchange",()=>{A.menuOpen=false;shell();});if(!location.hash)location.hash="#/projects/workbench";else shell();}
 return {register:route,start,go,toast,modal,tableProjects,can,act,render,getRoutes(){return A.routes.slice();}};
})();
window.AppModule={register(cfg){cfg.routes.forEach(r=>App.register(r.path,r.title,r.permission,r.render));}};