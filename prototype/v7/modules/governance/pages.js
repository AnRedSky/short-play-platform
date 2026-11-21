/* 模块：企业治理（governance）— 内部租户、租户档案与跨租户授权 */
(function () {
  function budgetRate(tenant) {
    if (!tenant.budget) return 0;
    return Math.round(tenant.used / tenant.budget * 100);
  }

  function nowStamp() {
    return new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-');
  }

  function tenantCounts(t) {
    return {
      members: DB.users.filter(u => u.tenant === t.id).length,
      projects: DB.projects.filter(p => p.tenant === t.id).length
    };
  }

  function tenantRow(t) {
    const counts = tenantCounts(t);
    return `<tr data-row data-status="${UI.esc(t.status)}" data-search="${UI.esc(t.name)} ${UI.esc(t.code)} ${UI.esc(t.owner)}" id="tenant-${UI.esc(t.id)}"><td><div class="entity"><div class="entity-mark" aria-hidden="true">${UI.esc(t.name.slice(0, 1))}</div><div><div class="entity-name">${UI.esc(t.name)}</div><div class="entity-meta mono">${UI.esc(t.code)}</div></div></div></td><td>${UI.esc(t.owner)}</td><td>${counts.members}</td><td>${counts.projects}</td><td><div class="progress-cell">${UI.progress(Math.min(100, budgetRate(t)), '预算使用 ' + budgetRate(t) + '%')}</div></td><td>${UI.tag(t.status, t.status === '运行中' ? 'green' : t.status === '已停用' ? 'orange' : '')}</td><td class="row-actions">${UI.btn('查看', 'go:governance/tenant-detail?id=' + t.id, 'btn-sm')}${t.status === '已归档' ? '<span class="tiny muted">只读归档</span>' : `<button type="button" class="btn btn-sm" data-action="tenant:edit" data-id="${UI.esc(t.id)}">编辑</button>${t.status === '运行中' ? `<button type="button" class="btn btn-sm btn-ghost" data-action="tenant:disable" data-id="${UI.esc(t.id)}">停用</button><button type="button" class="btn btn-sm btn-danger" data-action="tenant:archive" data-id="${UI.esc(t.id)}">归档</button>` : `<button type="button" class="btn btn-sm btn-ghost" data-action="tenant:restore" data-id="${UI.esc(t.id)}">恢复</button><button type="button" class="btn btn-sm btn-danger" data-action="tenant:archive" data-id="${UI.esc(t.id)}">归档</button>`}`}</td></tr>`;
  }

  AppModule.register({
    group: 'governance',
    label: '02 / 企业治理',
    icon: '▦',
    routes: [
      {
        path: 'governance/tenants',
        stage: 'governance',
        title: '租户空间',
        icon: '▦',
        permission: 'governance',
        render() {
          const rows = DB.tenants.map(tenantRow).join('');
          const archivedCount = DB.tenants.filter(t => t.status === '已归档').length;
          return UI.page('ENTERPRISE / GOVERNANCE', '内部租户空间', '按事业部、部门、制作中心或业务单元建立隔离工作空间。', UI.btn('新建租户', 'tenant:new', 'btn-primary'), `
    <div class="notice">企业主体只有一个。租户是企业内部的数据与权限边界，不代表独立法人或独立 SaaS 客户。停用与归档不得删除历史项目。</div>
    <div class="grid grid-3 section-gap">${UI.metric('内部租户', String(DB.tenants.length), '含 ' + archivedCount + ' 个归档空间', '▦')}${UI.metric('在用成员', String(DB.users.filter(u => u.status === '正常').length), '跨租户成员关系按授权建立', '♙')}${UI.metric('租户项目', String(DB.projects.length), '按当前业务归属统计', '▣')}</div>
    <div class="card section-gap"><div class="toolbar"><div class="toolbar-left"><b class="small">租户目录</b><span class="tiny muted">默认严格隔离</span></div><div class="toolbar-right"><select class="field toolbar-select" data-row-filter="status" aria-label="按租户状态筛选"><option value="all">全部状态</option><option value="运行中">运行中</option><option value="已停用">已停用</option><option value="已归档">已归档</option></select><input class="search" data-filter placeholder="搜索租户名称 / 编码"></div></div>${UI.table(['租户空间', '负责人', '成员', '项目', '预算', '状态', '操作'], rows, '没有符合条件的租户空间', UI.btn('清除筛选', 'filter:clear', 'btn-sm'))}</div>`);
        }
      },
      {
        path: 'governance/tenant-detail',
        stage: 'governance',
        title: '租户详情',
        icon: '◧',
        permission: 'governance',
        render(params) {
          const tenant = App.resolveTenant(params ? params.get('id') : '');
          if (!tenant) {
            return UI.page('ENTERPRISE / TENANT PROFILE', '租户治理档案', '租户配置、成员关系、资源配额与审计边界。', UI.btn('返回租户列表', 'go:governance/tenants', 'btn'), `<div class="card">${UI.empty('尚未选择租户空间', '当前身份没有可查看的租户，请先在顶部切换工作空间。', UI.btn('返回租户列表', 'go:governance/tenants', 'btn-primary'))}</div>`);
          }
          const archived = tenant.status === '已归档';
          const counts = tenantCounts(tenant);
          const members = DB.users.filter(u => u.tenant === tenant.id);
          const memberRows = members.map(u => `<tr data-row><td>${UI.esc(u.name)}</td><td>${UI.esc(DB.roleNames[u.role] || u.role)}</td><td>${escStatus(u.status)}</td><td class="mono">${UI.esc(u.joined || '—')}</td></tr>`).join('');
          return UI.page('ENTERPRISE / TENANT PROFILE', '租户治理档案 · ' + tenant.name, '租户配置、成员关系、资源配额与审计边界。', `<div class="head-actions">${archived ? '' : `<button type="button" class="btn" data-action="tenant:edit" data-id="${UI.esc(tenant.id)}">编辑档案</button>`}${UI.btn('返回租户列表', 'go:governance/tenants', 'btn')}</div>`, `
    <div class="grid grid-3"><div class="card"><div class="eyebrow">CURRENT TENANT</div><h2 class="entity-title">${UI.esc(tenant.name)}</h2><div class="mono tiny muted">${UI.esc(tenant.code)}</div><div class="section-gap">${UI.tag(tenant.status, archived ? '' : tenant.status === '已停用' ? 'orange' : 'green')}</div><div class="tiny muted section-gap">创建于 ${UI.esc(tenant.createdAt || '—')} · 更新 ${UI.esc(tenant.updated || '—')}</div></div>${UI.metric('成员关系', String(counts.members), '当前租户授权成员', '♙')}${UI.metric('项目归属', String(counts.projects), '含历史项目', '▣')}</div>
    <div class="grid grid-2 section-gap"><div class="card"><div class="card-title">租户资源与预算策略</div>${UI.kpi('负责人', UI.esc(tenant.owner))}${UI.kpi('预算上限', '¥' + tenant.budget.toLocaleString())}${UI.kpi('已消耗', '¥' + tenant.used.toLocaleString())}${UI.kpi('预算使用率', (budgetRate(tenant) || 0) + '%')}${UI.kpi('模型策略', UI.esc(tenant.modelPolicy || '继承企业白名单'))}${UI.kpi('数据保留', UI.esc(tenant.retention || '标准保留策略'))}${archived ? `<div class="notice warn section-gap">该租户已归档，仅保留历史项目与审计记录，不可新增生产任务。</div>` : tenant.status === '已停用' ? `<div class="notice warn section-gap">该租户已停用，成员暂不能进入工作空间，可恢复后继续生产。</div>` : ''}<div class="section-gap btn-row">${tenant.status === '运行中' ? `<button type="button" class="btn btn-sm btn-ghost" data-action="tenant:disable" data-id="${UI.esc(tenant.id)}">停用租户</button>` : tenant.status === '已停用' ? `<button type="button" class="btn btn-sm" data-action="tenant:restore" data-id="${UI.esc(tenant.id)}">恢复租户</button>` : ''}${archived ? '' : `<button type="button" class="btn btn-sm btn-danger" data-action="tenant:archive" data-id="${UI.esc(tenant.id)}">归档租户</button>`}</div></div>
    <div class="card"><div class="card-title">租户成员</div>${members.length ? UI.table(['姓名', '角色', '状态', '加入时间'], memberRows, '该租户暂无成员') : UI.empty('该租户暂无成员', '成员关系决定访问范围，可在成员与权限中邀请。', UI.btn('前往成员管理', 'go:people/members', 'btn-sm'))}</div></div>
    <div class="card section-gap"><div class="card-title">租户边界检查</div><div class="timeline section-gap"><div class="timeline-item"><i class="timeline-dot done" aria-hidden="true"></i><div><div class="timeline-title">项目与任务强制绑定 tenantId</div><div class="timeline-meta">项目、生产任务、成本与交付记录</div></div></div><div class="timeline-item"><i class="timeline-dot done" aria-hidden="true"></i><div><div class="timeline-title">成员关系决定访问范围</div><div class="timeline-meta">账号本身不代表全租户访问权</div></div></div><div class="timeline-item"><i class="timeline-dot done" aria-hidden="true"></i><div><div class="timeline-title">跨租户访问留痕</div><div class="timeline-meta">按职责授权，记录范围、用途与期限</div></div></div></div></div>`);
        }
      },
      {
        path: 'governance/cross-access',
        stage: 'governance',
        title: '跨租户授权',
        icon: '⇄',
        permission: 'governance',
        render() {
          const rows = DB.crossAuthorizations.map(a => {
            const scope = a.tenantIds.map(id => {
              const tenant = DB.tenants.find(t => t.id === id);
              return tenant ? tenant.name : id;
            }).join('、');
            return `<tr data-row data-status="${UI.esc(a.status)}" data-search="${UI.esc(a.actor)} ${UI.esc(a.purpose)} ${UI.esc(a.permission)}"><td class="mono">${UI.esc(a.id)}</td><td>${UI.esc(a.actor)}</td><td>${UI.esc(scope)}</td><td>${UI.esc(a.permission)}</td><td>${UI.esc(a.purpose)}</td><td>${UI.esc(a.expires)}</td><td>${UI.tag(a.status, a.status === '有效' ? 'green' : '')}</td><td>${a.status === '有效' ? UI.btn('撤销', 'cross:revoke', 'btn-sm btn-danger', { id: a.id }) : '—'}</td></tr>`;
          }).join('');
          const active = DB.crossAuthorizations.filter(a => a.status === '有效').length;

          return UI.page('ENTERPRISE / DELEGATED ACCESS', '跨租户授权管理', '跨租户访问必须明确对象、租户范围、权限类型、用途与有效期限，并支持撤销。', UI.btn('新增授权', 'cross:new', 'btn-primary'), `
    <div class="notice warn">企业级汇总查看权限不自动等于项目内容读取或修改权限。授权按最小范围生效，所有访问均进入审计。</div>
    <div class="grid grid-3 section-gap">${UI.metric('授权记录', String(DB.crossAuthorizations.length), '含已撤销记录', '⇄')}${UI.metric('当前有效', String(active), '按最小范围生效', '✓')}${UI.metric('覆盖租户', String(DB.tenants.length), '授权范围显式列出', '▦')}</div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">当前授权关系</div><div class="card-sub">撤销后立即失效，历史访问记录保留</div></div></div>
    <div class="toolbar"><div class="toolbar-left"><b class="small">授权清单</b></div><div class="toolbar-right"><select class="field toolbar-select" data-row-filter="status" aria-label="按授权状态筛选"><option value="all">全部状态</option><option value="有效">有效</option><option value="已撤销">已撤销</option></select><input class="search" data-filter placeholder="搜索授权对象 / 用途"></div></div>
    ${UI.table(['授权编号', '授权对象', '明确租户范围', '权限类型', '用途', '有效期', '状态', '操作'], rows, '没有符合条件的授权关系', UI.btn('清除筛选', 'filter:clear', 'btn-sm'))}</div>
    <div class="card section-gap"><div class="card-title">授权检查清单</div><div class="grid grid-2 section-gap"><div class="notice">授权对象：指定员工或管理角色，不对整个企业默认开放。</div><div class="notice">租户范围：显式列出租户 ID，不提供默认全租户授权。</div><div class="notice">权限类型：区分汇总查看、项目只读、内容编辑和资源调配。</div><div class="notice">用途与期限：必须填写业务目的、有效期，并支持提前撤销。</div></div></div>`);
        }
      }
    ]
  });

  function escStatus(status) {
    return UI.tag(status, status === '正常' ? 'green' : '');
  }

  App.onAction('tenant:edit', trigger => {
    const tenant = DB.tenants.find(t => t.id === trigger.dataset.id);
    if (!tenant) { App.toast('租户不存在', 'error'); return; }
    if (tenant.status === '已归档') { App.toast('归档租户为只读状态，不能编辑档案', 'warning'); return; }
    App.tenantEditingId = tenant.id;
    App.modal('编辑租户档案', `<div class="form-grid">${UI.fField('租户名称', 'name', { value: tenant.name, required: true, minlength: 2, maxlength: 24, msg: '租户名称需 2–24 个字符' })}${UI.fField('租户编码', 'code', { value: tenant.code, readonly: true, hint: '编码创建后不可修改' })}${UI.fField('负责人', 'owner', { value: tenant.owner, required: true, maxlength: 20, msg: '请填写负责人' })}${UI.fField('月度预算上限（元）', 'budget', { value: tenant.budget, type: 'number', min: 1000, max: 10000000, step: 1000, required: true, msg: '预算需在 1,000–10,000,000 之间' })}${UI.fSelect('模型策略', 'modelPolicy', [
      { value: '继承企业白名单', label: '继承企业白名单' },
      { value: '仅允许国产模型', label: '仅允许国产模型' },
      { value: '仅允许高性价比模型', label: '仅允许高性价比模型' },
      { value: '租户独立白名单', label: '租户独立白名单' }
    ], { value: tenant.modelPolicy || '继承企业白名单', required: true })}${UI.fSelect('数据保留策略', 'retention', [
      { value: '标准保留（180 天）', label: '标准保留（180 天）' },
      { value: '延长保留（365 天）', label: '延长保留（365 天）' },
      { value: '最短保留（90 天）', label: '最短保留（90 天）' }
    ], { value: tenant.retention || '标准保留（180 天）', required: true })}</div>`, '保存修改', 'tenant:update', { subtitle: tenant.code });
  });

  App.onSubmit('tenant:update', form => {
    const tenant = DB.tenants.find(t => t.id === App.tenantEditingId);
    if (!tenant) { App.toast('租户不存在，请刷新后重试', 'error'); return false; }
    const name = String(form.get('name') || '').trim();
    const owner = String(form.get('owner') || '').trim();
    const budget = Number(form.get('budget'));
    if (name.length < 2 || name.length > 24) { App.toast('租户名称需 2–24 个字符', 'error'); return false; }
    if (!owner) { App.toast('请填写负责人', 'error'); return false; }
    if (!Number.isFinite(budget) || budget < 1000 || budget > 10000000) { App.toast('预算需在 1,000–10,000,000 元之间', 'error'); return false; }
    if (DB.tenants.some(t => t.id !== tenant.id && t.name === name)) { App.toast('租户名称已存在，请更换', 'error'); return false; }
    if (budget < tenant.used) { App.toast('预算上限不能低于已消耗 ¥' + tenant.used.toLocaleString(), 'error'); return false; }
    tenant.name = name;
    tenant.owner = owner;
    tenant.budget = budget;
    tenant.modelPolicy = String(form.get('modelPolicy') || tenant.modelPolicy);
    tenant.retention = String(form.get('retention') || tenant.retention);
    tenant.updated = nowStamp();
    App.logAudit('更新租户档案', name + ' / 预算上限 ¥' + budget.toLocaleString(), '成功', '项目');
    App.save();
    App.closeModal();
    App.renderShell();
    App.renderRoute();
    App.toast('租户档案已更新', 'success', '已保存');
    return true;
  });

  App.onAction('tenant:disable', trigger => {
    const tenant = DB.tenants.find(t => t.id === trigger.dataset.id);
    if (!tenant) { return; }
    if (tenant.status !== '运行中') { App.toast('仅运行中的租户可以停用', 'warning'); return; }
    App.confirm('停用租户 · ' + tenant.name, '停用后该租户成员无法进入工作空间，历史项目与审计记录保留。', '确认停用', () => {
      tenant.status = '已停用';
      tenant.updated = nowStamp();
      App.logAudit('停用租户空间', tenant.name + ' / ' + tenant.code, '成功', '项目');
      App.save();
      App.renderRoute();
      App.toast(tenant.name + ' 已停用', 'warning', '已停用');
    }, { details: [{ key: '租户', value: tenant.name }, { key: '成员', value: String(tenantCounts(tenant).members) }, { key: '项目', value: String(tenantCounts(tenant).projects) }], danger: true });
  });

  App.onAction('tenant:restore', trigger => {
    const tenant = DB.tenants.find(t => t.id === trigger.dataset.id);
    if (!tenant) { return; }
    if (tenant.status === '已归档') { App.toast('归档是终态，不能恢复生产', 'error'); return; }
    if (tenant.status === '运行中') { App.toast('该租户已在运行中', 'warning'); return; }
    App.confirm('恢复租户 · ' + tenant.name, '恢复后成员可重新进入，生产任务按原状态继续。', '确认恢复', () => {
      tenant.status = '运行中';
      tenant.updated = nowStamp();
      App.logAudit('恢复租户空间', tenant.name + ' / ' + tenant.code, '成功', '项目');
      App.save();
      App.renderRoute();
      App.toast(tenant.name + ' 已恢复运行', 'success', '已恢复');
    });
  });

  App.onAction('tenant:archive', trigger => {
    const tenant = DB.tenants.find(t => t.id === trigger.dataset.id);
    if (!tenant) { return; }
    if (tenant.status === '已归档') { App.toast('该租户已归档', 'warning'); return; }
    App.confirm('归档租户 · ' + tenant.name, '归档为终态，仅保留历史项目与审计记录，不可再恢复生产。', '确认归档', () => {
      tenant.status = '已归档';
      tenant.updated = nowStamp();
      App.logAudit('归档租户空间', tenant.name + ' / ' + tenant.code, '成功', '项目');
      App.save();
      App.renderRoute();
      App.toast(tenant.name + ' 已归档', 'warning', '已归档');
    }, { details: [{ key: '租户', value: tenant.name }, { key: '历史项目', value: String(tenantCounts(tenant).projects) }, { key: '不可逆', value: '归档后不能恢复' }], danger: true });
  });

  App.onAction('cross:new', () => {
    const userOptions = DB.users.map(u => ({ value: u.id, label: u.name + ' · ' + u.role }));
    const tenantChecks = DB.tenants.filter(t => t.status === '运行中').map(t => UI.fCheck(t.name + '（' + t.code + '）', 'tenantIds', { value: t.id })).join('');
    const defaultExpires = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    App.modal('新增跨租户授权', `<div class="form-grid">${UI.fSelect('授权对象', 'actor', userOptions, { required: true })}${UI.fSelect('权限类型', 'permission', [
      { value: '汇总查看', label: '汇总查看' },
      { value: '项目只读', label: '项目只读' },
      { value: '内容编辑', label: '内容编辑' },
      { value: '资源调配', label: '资源调配' }
    ], { required: true })}${UI.fField('有效期', 'expires', { value: defaultExpires, type: 'date', required: true, hint: '到期后自动失效' })}${UI.fTextarea('用途说明', 'purpose', { placeholder: '说明跨租户访问的业务目的与范围', required: true, minlength: 6, maxlength: 120, msg: '用途说明至少 6 个字符', rows: 3 })}<div class="field-wrap full"><span class="field-label">明确租户范围<i class="req" aria-hidden="true">*</i></span><div class="check-grid">${tenantChecks}</div><span class="field-error" data-tenant-error hidden></span><span class="field-hint">至少选择一个租户，不提供默认全租户授权</span></div></div>`, '提交授权', 'cross:create');
  });

  App.onSubmit('cross:create', form => {
    const actorId = String(form.get('actor') || '');
    const user = DB.users.find(u => u.id === actorId);
    if (!user) { App.toast('请选择有效的授权对象', 'error'); return false; }
    const tenantIds = form.getAll('tenantIds').map(String);
    if (!tenantIds.length) { App.toast('请至少选择一个租户范围', 'error'); return false; }
    const purpose = String(form.get('purpose') || '').trim();
    if (purpose.length < 6) { App.toast('用途说明至少 6 个字符', 'error'); return false; }
    const expires = String(form.get('expires') || '');
    const expiresDate = expires ? new Date(expires + 'T23:59:59') : null;
    if (!expiresDate || Number.isNaN(expiresDate.getTime())) { App.toast('请选择有效的授权到期日', 'error'); return false; }
    if (expiresDate.getTime() < Date.now()) { App.toast('授权到期日不能早于今天', 'error'); return false; }
    if (DB.crossAuthorizations.some(a => a.status === '有效' && a.actor === user.name && a.tenantIds.join() === tenantIds.join())) {
      App.toast('该对象对所选租户已有有效授权，请勿重复提交', 'warning'); return false;
    }
    const serial = 'XA-' + String(26040 + DB.crossAuthorizations.length + 1).slice(-5);
    DB.crossAuthorizations.unshift({
      id: serial, actor: user.name, tenantIds: tenantIds,
      permission: String(form.get('permission') || '项目只读'),
      purpose, expires: expires.replace(/-/g, '.'), status: '有效', createdAt: nowStamp()
    });
    App.logAudit('新增跨租户授权', user.name + ' / ' + tenantIds.join('、') + ' / ' + purpose, '成功', '授权');
    App.save();
    App.closeModal();
    App.renderRoute();
    App.toast('跨租户授权已创建，编号 ' + serial, 'success', '授权成功');
    return true;
  });
})();
