/* 模块：组织与身份（people）— 租户成员关系与角色权限矩阵 */
(function () {
  const ROLE_PERMISSIONS = {
    admin: ['租户与成员治理', '项目创建与归档', '生产任务调度', '交付归档审批'],
    producer: ['项目创建', '剧本审核', '排期与生产调度', '成片终审', '交付归档'],
    director: ['剧本与分镜编辑', '拍摄排期', '后期制作', '成片终审（会签）'],
    editor: ['素材上传与版本管理', '后期剪辑', '字幕与音频处理'],
    finance: ['成本与预算查看', '交付记录查看', '经营分析导出'],
    ops: ['平台运维', '模型与存储配置', '审计日志导出'],
    auditor: ['审计记录查看', '跨租户授权查看', '经营分析查看']
  };

  function nowStamp() {
    return new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-');
  }

  function roleOptions() {
    return Object.keys(DB.roleNames).map(key => ({ value: key, label: DB.roleNames[key] }));
  }

  function memberOf(id) {
    return DB.users.find(u => u.id === id);
  }

  AppModule.register({
    group: 'people',
    label: '03 / 组织与身份',
    icon: '♙',
    routes: [
      {
        path: 'people/members',
        stage: 'people',
        title: '成员管理',
        icon: '♙',
        permission: 'people',
        render() {
          const members = DB.users.filter(u => u.tenant === DB.state.tenant);
          const active = members.filter(m => m.status === '正常').length;
          const invited = members.filter(m => m.status === '待邀请').length;
          const roleLabel = m => DB.roleNames[m.role] || '未分配角色';
          const rows = members.map(m => `<tr data-row data-status="${UI.esc(m.status)}" data-search="${UI.esc(m.name)} ${UI.esc(m.email)}"><td><div class="entity"><div class="entity-mark" aria-hidden="true">${UI.esc(m.name.slice(0, 1))}</div><div><div class="entity-name">${UI.esc(m.name)}</div><div class="entity-meta">${UI.esc(m.email)}</div></div></div></td><td>${UI.esc(roleLabel(m))}</td><td>${UI.tag(m.status, m.status === '正常' ? 'green' : m.status === '待邀请' ? 'orange' : '')}</td><td>${m.projects}</td><td>${m.delivered}</td><td class="mono">¥${m.cost.toLocaleString()}</td><td class="row-actions"><button type="button" class="btn btn-sm" data-action="member:view" data-id="${UI.esc(m.id)}">详情</button><button type="button" class="btn btn-sm" data-action="member:access" data-id="${UI.esc(m.id)}">项目授权</button><button type="button" class="btn btn-sm" data-action="member:role" data-id="${UI.esc(m.id)}">改角色</button>${m.status === '待邀请' ? `<button type="button" class="btn btn-sm btn-ghost" data-action="member:resend" data-id="${UI.esc(m.id)}">重发邀请</button>` : m.status === '正常' ? `<button type="button" class="btn btn-sm btn-ghost" data-action="member:disable" data-id="${UI.esc(m.id)}">停用</button>` : `<button type="button" class="btn btn-sm btn-ghost" data-action="member:enable" data-id="${UI.esc(m.id)}">启用</button>`}<button type="button" class="btn btn-sm btn-danger" data-action="member:remove" data-id="${UI.esc(m.id)}">移除</button></td></tr>`).join('');

          return UI.page('PEOPLE / MEMBERS', '成员与身份', '员工账号、租户成员关系及项目资产移交。', UI.btn('邀请员工', 'member:invite', 'btn-primary'), `
    <div class="grid grid-3">${UI.metric('当前租户成员', String(members.length), '展示当前租户的样本成员', '♙')}${UI.metric('正常账号', String(active), '可正常进入当前工作空间', '✓')}${UI.metric('待邀请', String(invited), '等待邀请确认', '＋')}</div>
    <div class="card section-gap"><div class="toolbar"><div class="toolbar-left"><b class="small">当前租户成员</b></div><div class="toolbar-right"><select class="field toolbar-select" data-row-filter="status" aria-label="按账号状态筛选"><option value="all">全部状态</option><option value="正常">正常</option><option value="待邀请">待邀请</option><option value="已停用">已停用</option></select><input class="search" data-filter placeholder="搜索姓名 / 邮箱"></div></div>${UI.table(['成员', '租户角色', '账号状态', '负责项目', '已交付作品', '累计成本', '操作'], rows, '当前租户暂无成员样本', UI.btn('清除筛选', 'filter:clear', 'btn-sm'))}</div>
    <div class="notice warn section-gap">离职处理必须先移交项目负责人、未完成生产任务和资产责任关系；不得删除作品、剧本版本、成本及审计历史。</div>`);
        }
      },
      {
        path: 'people/roles',
        stage: 'people',
        title: '角色与权限',
        icon: '⌘',
        permission: 'people',
        render() {
          const rows = DB.roles.map(r => `<tr data-row data-search="${UI.esc(r.name)} ${UI.esc(r.scope)}"><td><b>${UI.esc(r.name)}</b></td><td>${UI.esc(r.desc)}</td><td>${UI.tag(r.scope, 'blue')}</td><td>${UI.esc(r.limit)}</td><td><button type="button" class="btn btn-sm" data-action="role:view" data-id="${UI.esc(r.name)}">详情</button></td></tr>`).join('');
          return UI.page('PEOPLE / ACCESS CONTROL', '角色与权限矩阵', '权限按职责最小化授予；业务身份与租户上下文共同决定可访问范围。', '', `
    <div class="card"><div class="toolbar"><div class="toolbar-left"><b class="small">角色职责</b></div><div class="toolbar-right"><input class="search" data-filter placeholder="搜索角色 / 权限范围"></div></div>${UI.table(['角色', '职责边界', '权限范围', '关键限制', '操作'], rows, '没有符合条件的角色', UI.btn('清除筛选', 'filter:clear', 'btn-sm'))}</div>
    <div class="card section-gap"><div class="card-title">关键权限原则</div><div class="grid grid-2 section-gap"><div class="notice">平台运维身份只管理基础设施，不自动获得企业业务内容读取权限。</div><div class="notice">企业级管理员可以治理租户，但跨租户访问必须符合职责并留痕。</div><div class="notice">租户管理员只管理当前租户；经营审计角色不因查看汇总数据获得内容修改权。</div><div class="notice">普通员工在授权租户内独立制作，不需要专业岗位协作分工。</div></div></div>`);
        }
      }
    ]
  });

  App.onAction('member:view', trigger => {
    const member = memberOf(trigger.dataset.id);
    if (!member) { App.toast('成员不存在', 'error'); return; }
    App.memberEditingId = member.id;
    const perms = ROLE_PERMISSIONS[member.role] || ['按角色授权'];
    const accessIds = member.projectAccess || [];
    const accessProjects = DB.projects.filter(p => accessIds.indexOf(p.id) > -1);
    App.drawer('成员详情 · ' + member.name, `${UI.kpi('邮箱', UI.esc(member.email))}${UI.kpi('角色', UI.esc(DB.roleNames[member.role] || member.role))}${UI.kpi('账号状态', UI.tag(member.status, member.status === '正常' ? 'green' : 'orange'))}${UI.kpi('加入时间', UI.esc(member.joined || '—'))}${UI.kpi('最近活跃', UI.esc(member.lastActive || '—'))}${UI.kpi('负责项目', String(member.projects))}${UI.kpi('已交付作品', String(member.delivered))}${UI.kpi('累计成本', '¥' + member.cost.toLocaleString())}${UI.kpi('项目访问授权', accessProjects.length + ' 个项目')}<div class="section-gap"><div class="card-title">租户成员关系</div><div class="kpi-line"><span>${UI.esc((DB.tenants.find(t => t.id === member.tenant) || {}).name || member.tenant)}</span>${UI.tag(DB.roleNames[member.role] || member.role, 'blue')}</div>${(member.tenants || []).map(m => { const t = DB.tenants.find(x => x.id === m.tenant); return `<div class="kpi-line"><span>${UI.esc(t ? t.name : m.tenant)}</span>${UI.tag(DB.roleNames[m.role] || m.role, 'blue')}</div>`; }).join('')}</div><div class="section-gap"><div class="card-title">可访问项目</div>${accessProjects.length ? accessProjects.map(p => `<div class="kpi-line"><span>${UI.esc(p.title)} · ${UI.esc(p.id)}</span>${UI.tag(p.status, p.delivered ? 'green' : 'orange')}</div>`).join('') : `<p class="tiny muted">尚未授予项目访问权，仅可见本人项目。</p>`}</div><div class="section-gap"><div class="card-title">角色权限</div><div class="check-grid">${perms.map(p => `<label class="check-line"><input type="checkbox" checked disabled><span>${UI.esc(p)}</span></label>`).join('')}</div></div><div class="notice section-gap">停用或移除前需移交未完成项目与生产任务，历史交付与审计记录不可删除。</div>`, {
      subtitle: member.id + ' · ' + member.email,
      footer: `<button type="button" class="btn" data-action="member:access" data-id="${UI.esc(member.id)}">项目授权</button><button type="button" class="btn" data-action="member:role" data-id="${UI.esc(member.id)}">调整角色</button>${UI.btn('关闭', 'overlay:close', 'btn')}`
    });
  });

  App.onAction('member:access', trigger => {
    const member = memberOf(trigger.dataset.id);
    if (!member) { App.toast('成员不存在', 'error'); return; }
    App.memberEditingId = member.id;
    const projects = DB.projects.filter(p => p.tenant === member.tenant);
    const selected = member.projectAccess || [];
    const projectChecks = projects.length ? projects.map(p => `<label class="check-line"><input type="checkbox" name="projects" value="${UI.esc(p.id)}"${selected.indexOf(p.id) > -1 ? ' checked' : ''}><span>${UI.esc(p.title)} · ${UI.esc(p.id)} <em class="tiny muted">${p.done || 0}/${p.episodes} 集 · ${UI.esc(p.status)}</em></span></label>`).join('') : '<p class="tiny muted">当前租户暂无项目。</p>';
    App.modal('项目访问授权 · ' + member.name, `<div class="notice">项目访问权与租户成员关系分开授予。未勾选时成员仅能访问本人负责项目；授权记录写入审计，离职时随移交一并回收。</div><div class="section-gap"><div class="card-title">可授权项目</div><div class="check-grid">${projectChecks}</div></div>`, '保存授权', 'member:access-submit', { subtitle: member.email });
  });

  App.onSubmit('member:access-submit', form => {
    const member = memberOf(String(App.memberEditingId));
    if (!member) { App.toast('成员不存在，请刷新后重试', 'error'); return false; }
    const ids = form.getAll('projects').map(String).filter(Boolean);
    member.projectAccess = ids;
    member.access = ids.length ? '本人项目 + ' + ids.length + ' 个授权项目' : '仅本人项目';
    App.logAudit('调整成员项目授权', member.name + ' / ' + (ids.length ? ids.join('、') : '仅本人项目'), '成功', '授权');
    App.save();
    App.closeModal();
    App.renderRoute();
    App.toast(member.name + ' 的项目访问授权已更新', 'success', '已保存');
    return true;
  });

  App.onAction('member:role', trigger => {
    const member = memberOf(trigger.dataset.id);
    if (!member) { App.toast('成员不存在', 'error'); return; }
    App.memberEditingId = member.id;
    App.modal('调整成员角色', `<div class="form-grid">${UI.fSelect('成员', 'member', [{ value: member.id, label: member.name + ' · ' + member.email }], { value: member.id, required: true })}${UI.fSelect('角色', 'role', roleOptions(), { value: member.role, required: true })}</div><div class="notice section-gap">角色变更即时生效，已有项目归属与历史记录不变。</div>`, '保存角色', 'member:role-submit', { subtitle: member.name });
  });

  App.onSubmit('member:role-submit', form => {
    const member = memberOf(String(form.get('member') || App.memberEditingId));
    if (!member) { App.toast('成员不存在，请刷新后重试', 'error'); return false; }
    const role = String(form.get('role') || '');
    if (!DB.roleNames[role]) { App.toast('请选择有效角色', 'error'); return false; }
    if (member.role === role) { App.toast('角色未发生变化', 'info'); App.closeModal(); return true; }
    member.role = role;
    App.logAudit('调整成员角色', member.name + ' / ' + (DB.roleNames[role] || role), '成功', '授权');
    App.save();
    App.closeModal();
    App.renderRoute();
    App.toast(member.name + ' 角色已调整为 ' + (DB.roleNames[role] || role), 'success', '已保存');
    return true;
  });

  App.onAction('member:resend', trigger => {
    const member = memberOf(trigger.dataset.id);
    if (!member) { return; }
    App.runAction(trigger, () => {
      member.lastActive = '邀请已重发';
      App.logAudit('重发成员邀请', member.name + ' / ' + member.email, '成功', '组织');
      App.renderRoute();
      App.toast('已重新向 ' + member.email + ' 发送邀请', 'success', '邀请已发送');
    }, { loading: '正在发送…', delay: 600 });
  });

  App.onAction('member:disable', trigger => {
    const member = memberOf(trigger.dataset.id);
    if (!member) { return; }
    App.confirm('停用成员 · ' + member.name, '停用后该成员无法进入当前租户，历史项目、成本与审计记录保留。', '确认停用', () => {
      member.status = '已停用';
      member.lastActive = nowStamp();
      App.logAudit('停用成员账号', member.name + ' / ' + member.email, '成功', '组织');
      App.save();
      App.renderRoute();
      App.toast(member.name + ' 已停用', 'warning', '已停用');
    }, { details: [{ key: '成员', value: member.name }, { key: '负责项目', value: String(member.projects) }, { key: '已交付', value: String(member.delivered) }], danger: true });
  });

  App.onAction('member:enable', trigger => {
    const member = memberOf(trigger.dataset.id);
    if (!member) { return; }
    App.confirm('启用成员 · ' + member.name, '启用后该成员恢复当前租户访问权限。', '确认启用', () => {
      member.status = '正常';
      member.lastActive = nowStamp();
      App.logAudit('启用成员账号', member.name + ' / ' + member.email, '成功', '组织');
      App.save();
      App.renderRoute();
      App.toast(member.name + ' 已启用', 'success', '已启用');
    });
  });

  App.onAction('member:remove', trigger => {
    const member = memberOf(trigger.dataset.id);
    if (!member) { return; }
    App.confirm('移除成员 · ' + member.name, '移除后成员关系解除，项目负责人需先移交；历史交付、成本与审计记录保留。', '确认移除', () => {
      if (member.projects > 0) {
        App.toast('该成员仍负责 ' + member.projects + ' 个项目，请先移交项目负责人', 'error', '存在未移交项目');
        return;
      }
      const tenant = DB.tenants.find(t => t.id === member.tenant);
      DB.users = DB.users.filter(u => u.id !== member.id);
      if (tenant && tenant.members > 0) tenant.members -= 1;
      App.logAudit('移除成员关系', member.name + ' / ' + member.email, '成功', '组织');
      App.save();
      App.closeOverlay();
      App.renderRoute();
      App.toast(member.name + ' 已从当前租户移除', 'success', '已移除');
    }, { details: [{ key: '成员', value: member.name }, { key: '负责项目', value: String(member.projects) }, { key: '记录保留', value: '历史交付与审计不删除' }], danger: true });
  });

  App.onAction('role:view', trigger => {
    const role = DB.roles.find(r => r.name === trigger.dataset.id);
    if (!role) { App.toast('角色不存在', 'error'); return; }
    const key = Object.keys(DB.roleNames).find(k => DB.roleNames[k] === role.name) || '';
    const perms = ROLE_PERMISSIONS[key] || ['按职责授权'];
    const members = DB.users.filter(u => u.role === key);
    App.drawer('角色详情 · ' + role.name, `${UI.kpi('职责边界', UI.esc(role.desc))}${UI.kpi('权限范围', UI.tag(role.scope, 'blue'))}${UI.kpi('关键限制', UI.esc(role.limit))}${UI.kpi('当前成员', String(members.length))}<div class="section-gap"><div class="card-title">可用权限</div><div class="check-grid">${perms.map(p => `<label class="check-line"><input type="checkbox" checked disabled><span>${UI.esc(p)}</span></label>`).join('')}</div></div><div class="section-gap"><div class="card-title">成员</div>${members.length ? members.map(m => `<div class="kpi-line"><span>${UI.esc(m.name)} · ${UI.esc(m.email)}</span>${UI.tag(m.status, m.status === '正常' ? 'green' : 'orange')}</div>`).join('') : `<p class="tiny muted">当前租户暂无该角色成员。</p>`}</div>`, { subtitle: role.scope, footer: UI.btn('关闭', 'overlay:close', 'btn') });
  });
})();
