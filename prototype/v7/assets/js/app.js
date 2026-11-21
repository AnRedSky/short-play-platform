/* Application layer: route registry, navigation, project context, access checks and feedback. */
window.App={
 routes:[],groups:[],current:null,menuState:{},
 menuStorageKey:'framework-v7-menu-open',
 start(){
  this.menuState=this.readMenuState();
  this.renderShell();
  document.addEventListener('click',e=>this.handleClick(e));
  document.addEventListener('change',e=>this.handleChange(e));
  document.addEventListener('input',e=>{if(e.target.matches('[data-filter]'))this.applyFilter(e.target);});
  document.addEventListener('submit',e=>this.handleSubmit(e));
  window.addEventListener('hashchange',()=>this.renderRoute());
  if(!location.hash)location.hash='#/overview/home';
  this.renderRoute();
 },
 readMenuState(){
  try{const saved=JSON.parse(localStorage.getItem(this.menuStorageKey)||'{}');return saved&&typeof saved==='object'?saved:{};}catch(_){return {};}
 },
 saveMenuState(){try{localStorage.setItem(this.menuStorageKey,JSON.stringify(this.menuState));}catch(_){this.toast('浏览器未允许保存菜单状态，本次会话仍可正常使用','error');}},
 toggleGroup(key){this.menuState[key]=this.menuState[key]===false;this.saveMenuState();const panel=document.querySelector('[data-nav-panel="'+key+'"]');const toggle=document.querySelector('[data-nav-group="'+key+'"]');if(panel)panel.hidden=!this.menuState[key];if(toggle)toggle.setAttribute('aria-expanded',String(!!this.menuState[key]));},
 allowed(route){const role=DB.state.identity;const p=DB.permissions[role]||[];return p.includes('*')||p.includes(route.permission||route.group);},
 tenant(){return DB.tenants.find(t=>t.id===DB.state.tenant)||null;},
 identity(){return DB.identities.find(i=>i.role===DB.state.identity)||DB.identities[0];},
 availableTenants(){const identity=this.identity();return DB.tenants.filter(t=>(identity?.tenants||[]).includes(t.id)&&t.status!=='已归档');},
 accessibleProjects(){const identity=this.identity();const tenantIds=this.availableTenants().map(t=>t.id);return DB.projects.filter(p=>p.tenant===DB.state.tenant&&tenantIds.includes(p.tenant)&&(DB.state.identity!=='employee'||p.owner===identity.user));},
 project(){const list=this.accessibleProjects();return list.find(p=>p.id===DB.state.projectId)||list[0]||null;},
 projectName(){return this.project()?.title||'未选择项目';},
 tenantName(){return this.tenant()?.name||(DB.state.identity==='platform'?'平台运维域':'未选择租户');},
 syncContext(){
  const tenants=this.availableTenants();
  if(!tenants.some(t=>t.id===DB.state.tenant))DB.state.tenant=tenants[0]?.id||'';
  const projects=this.accessibleProjects();
  if(!projects.some(p=>p.id===DB.state.projectId))DB.state.projectId=projects[0]?.id||'';
 },
 renderShell(){
  this.syncContext();
  const nav=this.groups.map(g=>{
   const rs=g.routes.filter(r=>this.allowed(r));if(!rs.length)return '';
   const open=this.menuState[g.group]!==false;
   return `<section class="nav-group"><button class="nav-group-toggle" type="button" data-nav-group="${g.group}" aria-expanded="${open}" aria-controls="nav-${g.group}"><span class="nav-group-icon">${g.icon||'◈'}</span><span class="nav-group-title">${g.label}</span><span class="nav-group-chevron">${open?'−':'＋'}</span></button><div class="nav-submenu" id="nav-${g.group}" data-nav-panel="${g.group}" ${open?'':'hidden'}>${rs.map(r=>`<a class="nav-link" href="#/${r.path}" data-route="${r.path}"><span class="nav-icon">${r.icon||'·'}</span><span>${r.title}</span>${r.badge?`<span class="nav-count">${r.badge}</span>`:''}</a>`).join('')}</div></section>`;
  }).join('');
  const tenants=this.availableTenants(),projects=this.accessibleProjects(),identity=this.identity();
  document.getElementById('app').innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-symbol">F.</div><div><div class="brand-name">FRAMEWORK</div><div class="brand-sub">AI PRODUCTION OS / 07</div></div></div><div class="side-context"><small>当前工作空间</small><strong><i class="tenant-dot"></i><span id="side-tenant">${this.tenantName()}</span></strong></div><nav class="side-navigation" aria-label="业务主导航">${nav}</nav><div class="sidebar-foot"><b>V7 / FROM ZERO</b><br>企业内部多租户 · AI 独立制作<br>演示数据仅存在当前页面内存</div></aside><main class="main"><header class="topbar"><div class="crumb">FRAMEWORK <span class="muted">/</span> <b id="crumb-title">工作总览</b></div><div class="top-actions"><select class="top-select" id="tenant-select" aria-label="切换租户" ${tenants.length?'':'hidden'}>${tenants.map(t=>`<option value="${UI.esc(t.id)}" ${t.id===DB.state.tenant?'selected':''}>${UI.esc(t.name)}</option>`).join('')}</select><select class="top-select project-select" id="project-select" aria-label="当前项目" ${projects.length?'':'hidden'}>${projects.map(p=>`<option value="${UI.esc(p.id)}" ${p.id===DB.state.projectId?'selected':''}>${UI.esc(p.title)}</option>`).join('')}</select><select class="top-select" id="identity-select" aria-label="切换演示身份">${DB.identities.map(i=>`<option value="${i.role}" ${i.role===DB.state.identity?'selected':''}>${UI.esc(i.label)}</option>`).join('')}</select><div class="avatar" id="user-avatar">${UI.esc(identity.user.slice(0,1))}</div><div class="user-meta"><b id="user-name">${UI.esc(identity.user)}</b><span id="user-role">${UI.esc(DB.roleNames[DB.state.identity])}</span></div></div></header><div id="view" aria-live="polite"></div></main></div>`;
 },
 renderRoute(){
  this.syncContext();
  const path=decodeURIComponent(location.hash.replace(/^#\/?/,'')||'overview/home').split('?')[0];
  const route=this.routes.find(r=>r.path===path),view=document.getElementById('view');if(!view)return;
  if(!route){view.innerHTML=UI.page('SYSTEM / 404','页面不存在','该页面没有注册在当前版本的导航中。','',`<div class="card">${UI.empty('找不到此页面','检查路由地址或返回工作总览',UI.btn('返回总览','go:overview/home','btn-primary'))}</div>`);return;}
  if(!this.allowed(route)){view.innerHTML=UI.page('ACCESS / 403','访问范围受限','当前身份没有访问此业务域的权限。','',`<div class="card">${UI.empty('没有访问权限','请切换到有授权的身份，或联系企业管理员开通权限。',UI.btn('返回工作总览','go:overview/home','btn-primary'))}</div>`);return;}
  this.current=route;document.getElementById('crumb-title').textContent=route.title;
  document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active',a.dataset.route===path));
  const group=this.groups.find(g=>g.routes.some(r=>r.path===path));
  if(group&&this.menuState[group.group]===false)this.toggleGroup(group.group);
  view.innerHTML=route.render();
  this.refreshProjectSelector();
 },
 refreshProjectSelector(){
  const select=document.getElementById('project-select');if(!select)return;
  const projects=this.accessibleProjects();select.hidden=!projects.length;
  select.innerHTML=projects.map(p=>`<option value="${UI.esc(p.id)}" ${p.id===DB.state.projectId?'selected':''}>${UI.esc(p.title)}</option>`).join('');
 },
 navigate(path){location.hash='#/'+path;},
 toast(message,type='success'){
  const root=document.getElementById('toast-root');const node=document.createElement('div');node.className='toast '+type;node.setAttribute('role','status');node.textContent=message;root.replaceChildren(node);
  window.clearTimeout(this.toastTimer);this.toastTimer=window.setTimeout(()=>{if(node.parentNode===root)root.removeChild(node);},2800);
 },
 runAction(button,work){
  if(button?.disabled)return;
  const old=button?.innerHTML;if(button){button.disabled=true;button.setAttribute('aria-busy','true');button.innerHTML='<span class="button-spinner"></span>处理中…';}
  window.requestAnimationFrame(()=>{try{work();}catch(err){console.error(err);this.toast(err?.message||'操作未能完成，请检查输入后重试','error');}finally{if(button?.isConnected){button.disabled=false;button.removeAttribute('aria-busy');button.innerHTML=old;}}});
 },
 modal(title,body,submitLabel='确认',action='modal:close'){
  document.getElementById('overlay-root').innerHTML=`<div class="modal-backdrop" data-action="modal:backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="${UI.esc(title)}"><header class="modal-head"><div class="modal-title">${UI.esc(title)}</div><button class="icon-btn" type="button" data-action="modal:close" aria-label="关闭">×</button></header><form id="modal-form"><div class="modal-body">${body}</div><footer class="modal-foot"><button type="button" class="btn" data-action="modal:close">取消</button><button type="submit" class="btn btn-primary" data-submit-action="${action}">${UI.esc(submitLabel)}</button></footer></form></section></div>`;
  document.querySelector('#modal-form input, #modal-form textarea, #modal-form select')?.focus();
 },
 closeModal(){document.getElementById('overlay-root').innerHTML='';},
 applyFilter(input){const q=input.value.trim().toLowerCase();const target=input.dataset.filterTarget;const scope=target?document.querySelector(target):input.closest('.card')||document;scope?.querySelectorAll('tr[data-search]').forEach(r=>r.hidden=!r.dataset.search.toLowerCase().includes(q));},
 handleChange(e){
  if(e.target.id==='tenant-select'){DB.state.tenant=e.target.value;this.syncContext();this.renderShell();this.renderRoute();this.toast('工作空间已切换，项目与列表已按授权范围刷新');}
  if(e.target.id==='project-select'){DB.state.projectId=e.target.value;this.renderRoute();this.toast('当前项目已切换：'+this.projectName());}
  if(e.target.id==='project-status'){const v=e.target.value;document.querySelectorAll('[data-project-row]').forEach(r=>r.hidden=v!=='all'&&r.dataset.status!==v);}if(e.target.matches('[data-project-field]')){const p=this.project();if(p)p[e.target.dataset.projectField]=e.target.value;}if(e.target.matches('[data-review-check]')){const p=this.project();if(p){p.reviewChecks=p.reviewChecks||[];const n=Number(e.target.dataset.reviewCheck);p.reviewChecks=e.target.checked?[...new Set([...p.reviewChecks,n])]:p.reviewChecks.filter(x=>x!==n);}}
  if(e.target.id==='identity-select'){DB.state.identity=e.target.value;this.syncContext();this.renderShell();this.renderRoute();this.toast('演示身份已切换：'+DB.roleNames[DB.state.identity]);}
 },
 handleClick(e){
  const group=e.target.closest('[data-nav-group]');if(group){this.toggleGroup(group.dataset.navGroup);return;}
  const el=e.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;
  if(a.startsWith('go:'))this.navigate(a.slice(3));
  else if(a==='modal:close')this.closeModal();
  else if(a==='modal:backdrop'&&e.target===el)this.closeModal();
  else if(a==='project:new')this.newProject();
  else if(a==='script:generate')this.runAction(el,()=>this.generateScript());
  else if(a==='script:approve')this.runAction(el,()=>this.approveScript());
  else if(a==='script:return')this.runAction(el,()=>this.returnScript());
  else if(a==='production:start')this.runAction(el,()=>this.startProduction());
  else if(a==='exception:resolve')this.runAction(el,()=>this.resolveException());
  else if(a==='final:approve')this.runAction(el,()=>this.approveFinal());
  else if(a==='delivery:publish')this.runAction(el,()=>this.publishDelivery());
  else if(a==='tenant:new')this.newTenant();
  else if(a==='member:invite')this.inviteMember();
  else if(a==='project:open'){DB.state.projectId=el.dataset.id;this.navigate('workspace/detail');}else if(a==='project:task'){DB.state.projectId=el.dataset.id;this.navigate(el.dataset.route||'workspace/detail');}
  else if(a==='cross:revoke'){const item=DB.crossAuthorizations.find(x=>x.id===el.dataset.id);if(item){item.status='已撤销';this.toast('跨租户授权已撤销');this.renderRoute();}}
  else if(a==='asset:open')this.toast('资产详情已打开：版本、来源项目和租户归属可追溯');
  else if(a==='tab'){document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===el));document.querySelectorAll('[data-tab-panel]').forEach(p=>p.hidden=p.dataset.tabPanel!==el.dataset.target);}
  else if(a==='filter:clear'){const input=document.querySelector('[data-filter]');if(input){input.value='';this.applyFilter(input);}}
  else if(a==='audit:export')this.runAction(el,()=>this.toast('审计清单导出任务已创建（演示状态）'));
 },
 handleSubmit(e){
  if(e.target.id!=='modal-form')return;e.preventDefault();
  const form=new FormData(e.target),action=e.submitter?.dataset.submitAction,submit=e.submitter;
  if(submit){submit.disabled=true;submit.setAttribute('aria-busy','true');submit.innerHTML='<span class="button-spinner"></span>提交中…';}
  window.requestAnimationFrame(()=>{try{this.processModalSubmit(form,action,submit);}catch(err){console.error(err);this.toast(err?.message||'提交失败，请检查后重试','error');if(submit?.isConnected){submit.disabled=false;submit.removeAttribute('aria-busy');submit.textContent='重试';}}});
 },
 processModalSubmit(form,action,submit){
  if(action==='project:create'){
   const title=String(form.get('title')||'').trim();if(!title){this.toast('请填写项目名称','error');if(submit){submit.disabled=false;submit.removeAttribute('aria-busy');submit.textContent='创建项目';}return;}
   const episodes=Math.max(1,Number(form.get('episodes')||12));const p={id:'SP-260'+String(50+DB.projects.length),title,genre:form.get('genre'),owner:this.identity()?.user||'当前员工',tenant:DB.state.tenant,episodes,done:0,status:'创意待启动',updated:'刚刚',stage:'创意策划',cost:0,quality:0,brief:String(form.get('brief')||''),scriptVersion:1,shotCount:episodes*8,coverAssets:0};
   DB.projects.unshift(p);DB.state.projectId=p.id;this.closeModal();this.renderShell();this.toast('项目已创建，已切换到该项目的 AI 创作工作台');this.navigate('studio/brief');
  }else if(action==='tenant:create'){
   const name=String(form.get('name')||'').trim();if(!name){this.toast('请填写租户名称','error');if(submit){submit.disabled=false;submit.removeAttribute('aria-busy');}return;}
   DB.tenants.unshift({id:'tn-'+Date.now(),name,code:'NEW-'+String(DB.tenants.length+1).padStart(2,'0'),owner:form.get('owner')||'待指定',members:0,projects:0,budget:Number(form.get('budget')||0),used:0,status:'运行中'});
   const identity=DB.identities.find(i=>i.role===DB.state.identity);if(identity&&!identity.tenants.includes(DB.tenants[0].id))identity.tenants.push(DB.tenants[0].id);
   DB.state.tenant=DB.tenants[0].id;this.closeModal();this.renderShell();this.renderRoute();this.toast('内部租户空间已创建并切换');
  }else if(action==='member:invite'){
   const name=String(form.get('name')||'').trim(),email=String(form.get('email')||'').trim();if(!name||!email){this.toast('请填写员工姓名和企业邮箱','error');submit.disabled=false;submit.removeAttribute('aria-busy');return;}
   DB.users.unshift({id:'u'+Date.now(),name,email,role:form.get('role'),tenant:DB.state.tenant,status:'待邀请',projects:0,delivered:0,cost:0});this.closeModal();this.toast('员工邀请已加入待发送队列（演示状态）');this.renderRoute();
  }
 },
 newProject(){this.modal('创建短剧项目',`<div class="form-grid">${UI.field('项目名称','title','','text','填写暂定片名，后续可修改')}${UI.select('题材方向','genre',[{value:'都市 / 情感',label:'都市 / 情感'},{value:'悬疑 / 反转',label:'悬疑 / 反转'},{value:'古装 / 爱情',label:'古装 / 爱情'},{value:'现实 / 成长',label:'现实 / 成长'}])}${UI.field('计划集数','episodes','12','number')}<div class="field-wrap"><span class="field-label">项目归属</span><div class="field" aria-readonly="true">${UI.esc(this.tenantName())}</div></div><label class="field-wrap full"><span class="field-label">创作目标（可稍后补充）</span><textarea class="field" name="brief" placeholder="题材、核心冲突、受众、风格等"></textarea></label></div>`,'创建项目','project:create');},
 newTenant(){this.modal('新建内部租户空间',`<div class="notice">租户是企业内部组织与数据隔离单元，不是独立企业或 SaaS 客户。</div><div class="form-grid section-gap">${UI.field('租户名称','name')}${UI.field('负责人','owner')}${UI.field('预算上限（元）','budget','30000','number')}</div>`,'创建租户','tenant:create');},
 inviteMember(){this.modal('邀请员工加入当前租户',`<div class="form-grid">${UI.field('员工姓名','name')}${UI.field('企业邮箱','email','','email')}${UI.select('租户内角色','role',[{value:'employee',label:'普通员工'},{value:'tenant',label:'租户管理员'},{value:'auditor',label:'审计查看'}])}</div>`,'加入邀请队列','member:invite');},
 generateScript(){const p=this.project();if(!p){this.toast('请先创建或选择一个项目','error');return;}p.status='剧本待审核';p.stage='剧本审核';p.scriptVersion=(p.scriptVersion||2)+1;this.toast('「'+p.title+'」的 AI 剧本生成任务已进入演示队列；未调用真实模型');this.renderRoute();},
 approveScript(){const p=this.project();if(!p){this.toast('没有可审核的当前项目','error');return;}p.status='制作准备中';p.stage='导演分镜';p.scriptApproved=true;this.toast('「'+p.title+'」剧本版本已确认，演示流程进入视觉规划');this.renderRoute();},
 returnScript(){const p=this.project();if(!p){this.toast('没有可退回的当前项目','error');return;}p.status='剧本修改中';p.stage='剧本修改';p.scriptApproved=false;this.toast('「'+p.title+'」剧本已退回修改，当前版本未锁定','error');this.renderRoute();},
 startProduction(){const p=this.project();if(!p){this.toast('请先选择项目','error');return;}if(!p.scriptApproved){this.toast('请先完成当前项目的剧本审核','error');return;}p.productionStarted=true;p.status='制作中';p.stage='视频生产';this.toast('「'+p.title+'」生产计划已启动（演示状态），任务依赖已展开');this.renderRoute();},
 resolveException(){const p=this.project();if(!p||!p.status.includes('异常')){this.toast('当前项目没有待处置的生产异常','error');return;}p.exceptionResolved=true;p.status='制作中';p.stage='音频合成';this.toast('「'+p.title+'」已切换备用模型并恢复受影响任务（演示状态）');this.renderRoute();},
 approveFinal(){const p=this.project();if(!p){this.toast('没有可终审的当前项目','error');return;}p.finalApproved=true;p.status='待交付';p.stage='交付准备';this.toast('「'+p.title+'」最终成片审核通过，允许创建交付包');this.renderRoute();},
 publishDelivery(){const p=this.project();if(!p){this.toast('请先选择项目','error');return;}if(!p.finalApproved&&p.status!=='待交付'){this.toast('请先完成当前项目的最终成片审核','error');return;}p.delivered=true;p.status='已交付';p.stage='已归档';p.done=p.episodes;this.toast('「'+p.title+'」交付包已生成并归档（演示状态）');this.renderRoute();}
};
