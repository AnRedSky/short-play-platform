/* 模块：平台与审计（platform）— 审计事件、模型治理与系统运行 */
(function () {
  const MODEL_OPTIONS = {
    '大语言模型': ['Text Studio Pro', 'Text Studio Lite', '私有剧本模型'],
    '推理模型': ['Logic Reasoner R2', 'Logic Reasoner R1', '私有推理模型'],
    '图像生成': ['Vision Render X', 'Vision Render S', '私有图像模型'],
    '视频生成': ['Motion Forge 2', 'Motion Forge 1', '私有视频模型'],
    '数字人口型': ['Avatar LipSync', 'Avatar LipSync Lite', '私有数字人模型'],
    '语音生成': ['Voice Studio', 'Voice Studio Backup', '私有语音模型'],
    '音乐生成': ['Music Forge', 'Music Forge Lite', '私有音乐模型'],
    '视频处理': ['Post Master', 'Post Lite', '私有后期模型'],
    '语音识别': ['ASR Transcript', 'ASR Lite', '私有转写模型'],
    '视觉审核': ['Vision Audit Pro', 'Vision Audit S', '私有质检模型']
  };

  function nowStamp() {
    return new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-');
  }

  AppModule.register({
    group: 'platform',
    label: '10 / 平台与审计',
    icon: '≋',
    routes: [
      {
        path: 'platform/overview',
        stage: 'platform',
        title: '平台运营总览',
        icon: '◫',
        permission: 'platform',
        render() {
          const ent = DB.enterprise;
          const users = DB.users;
          const projects = DB.projects;
          const tasks = DB.productionTasks || [];
          const totalCost = projects.reduce((sum, p) => sum + (p.cost || 0), 0);
          const taskCost = tasks.reduce((sum, t) => sum + (t.cost || 0), 0);
          const failedCost = tasks.reduce((sum, t) => sum + (t.failedCost || 0), 0);
          const delivered = projects.filter(p => p.delivered).length;
          const tenantRows = DB.tenants.map(t => `<tr data-row data-search="${UI.esc(t.name)} ${UI.esc(t.unit || '')} ${UI.esc(t.admin || '')}"><td><b>${UI.esc(t.name)}</b><div class="tiny muted mono">${UI.esc(t.code)}</div></td><td>${UI.esc(t.unit || '—')}<div class="tiny muted">管理员 ${UI.esc(t.admin || t.owner)}</div></td><td>${DB.users.filter(u => u.tenant === t.id).length}</td><td>${DB.projects.filter(p => p.tenant === t.id).length}</td><td class="mono">¥${(t.used || 0).toLocaleString()} / ¥${(t.budget || 0).toLocaleString()}</td><td>${t.quotaConcurrency || 0} / ${t.quotaStorage || 0}GB</td><td>${UI.tag(t.status, t.status === '运行中' ? 'green' : '')}</td></tr>`).join('');
          const userRows = users.map(u => `<tr data-row data-search="${UI.esc(u.name)} ${UI.esc(u.email)} ${UI.esc(u.role)}"><td>${UI.esc(u.name)}<div class="tiny muted">${UI.esc(u.email)}</div></td><td>${UI.esc(DB.roleNames[u.role] || u.role)}</td><td>${UI.esc((DB.tenants.find(t => t.id === u.tenant) || {}).name || '—')}</td><td>${UI.tag(u.status, u.status === '正常' ? 'green' : 'orange')}</td><td>${u.projects}</td><td class="mono">¥${(u.cost || 0).toLocaleString()}</td></tr>`).join('');
          const projectRows = projects.map(p => `<tr data-row><td>${UI.esc(p.title)}<div class="tiny muted mono">${UI.esc(p.id)} / ${UI.esc(p.owner)}</div></td><td>${p.episodes} 集</td><td>${UI.esc(p.status)}</td><td>${p.quality || '—'}</td><td class="mono">¥${(p.cost || 0).toLocaleString()}</td><td class="mono">¥${(p.budget || 0).toLocaleString()}</td></tr>`).join('');
          return UI.page('PLATFORM / OPERATIONS', '平台运营总览', '平台管理员视角：企业主体、租户资源、平台用户、模型能力、生产量与成本汇总。', `<div class="head-actions">${UI.btn('业务配置', 'go:platform/config', 'btn')}${UI.btn('模型能力治理', 'go:platform/models', 'btn')}</div>`, `
    <div class="notice">平台管理员默认只拥有平台与基础设施权限；查看业务内容需临时授权并留痕。演示数据不代表真实运营指标。</div>
    <div class="grid grid-4 section-gap">${UI.metric('企业主体', '1', ent.status + ' · ' + ent.code, '▤')}${UI.metric('租户 / 用户', DB.tenants.length + ' / ' + users.length, '运行中 ' + DB.tenants.filter(t => t.status === '运行中').length + ' 个租户', '▦')}${UI.metric('项目 / 交付', projects.length + ' / ' + delivered, 'AI 任务 ' + tasks.length + ' 个', '▣')}${UI.metric('AI 总成本', '¥' + totalCost.toLocaleString(), '失败 ¥' + failedCost.toLocaleString() + ' · 任务 ¥' + taskCost.toLocaleString(), '￥')}</div>
    <div class="grid grid-2 section-gap"><div class="card"><div class="card-title">企业主体</div>${UI.kpi('名称', UI.esc(ent.name))}${UI.kpi('管理员', UI.esc(ent.admin))}${UI.kpi('状态', UI.tag(ent.status, 'green'))}${UI.kpi('企业预算', '¥' + Number(ent.budget).toLocaleString() + ' / ¥' + Number(ent.used).toLocaleString() + ' 已用')}<div class="tiny muted section-gap">${UI.esc(ent.intro)}</div></div><div class="card"><div class="card-title">平台能力与成本</div>${UI.kpi('模型能力', DB.models.length + ' 类 / ' + DB.models.length * 2 + ' 个模型')}${UI.kpi('任务成功率', (tasks.length ? Math.round(tasks.filter(t => t.status === '已完成').length / tasks.length * 100) : 0) + '%')}${UI.kpi('今日调用', DB.runtime.callsToday)}${UI.kpi('系统健康', DB.runtime.health)}<div class="tiny muted section-gap">失败成本单独归集，不混入正常生产成本。</div></div></div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">企业资源分配</div><div class="card-sub">租户组织单元、管理员、成员/项目真实计数、预算与并发/存储配额</div></div>${UI.btn('企业管理', 'go:platform/overview', 'btn-sm')}</div>${UI.table(['租户', '组织单元 / 管理员', '成员', '项目', '成本 / 预算', '配额', '状态'], tenantRows, '暂无租户')}</div>
    <div class="grid grid-2 section-gap"><div class="card"><div class="card-title">平台用户总表</div>${UI.table(['用户', '角色', '主租户', '状态', '负责项目', '成本'], userRows, '暂无平台用户')}</div><div class="card"><div class="card-title">生产与项目成本</div>${UI.table(['项目', '集数', '状态', '质量', '成本', '预算'], projectRows, '暂无项目')}</div></div>
    <div class="notice section-gap">平台总览不替代企业级经营分析；企业管理员仍按企业内部租户授权查看，不因平台身份自动获得内容编辑权。</div>`);
        }
      },
      {
        path: 'platform/config',
        stage: 'platform',
        title: '平台业务配置',
        icon: '⚒',
        permission: 'platform',
        render() {
          const c = DB.runtime.config;
          return UI.page('PLATFORM / BUSINESS CONFIG', '平台业务配置', '平台级默认参数：项目预算、重试上限、并发、预算提醒、数据保留、模型白名单与审核策略。', `<div class="head-actions">${UI.btn('编辑业务配置', 'platform:config-edit', 'btn-primary')}</div>`, `
    <div class="notice warn">业务配置影响新项目与新任务，不回溯修改历史成本、审核记录与交付档案。生产环境需二次确认并留痕。</div>
    <div class="grid grid-3 section-gap">${UI.metric('默认项目预算', '¥' + Number(c.defaultProjectBudget).toLocaleString(), '新项目默认上限', '￥')}${UI.metric('失败重试上限', c.retryLimit + ' 次', '达到上限转异常', '↺')}${UI.metric('全局并发', c.maxConcurrency + ' 任务', '平台级调度上限', '⌁')}</div>
    <div class="grid grid-2 section-gap"><div class="card"><div class="card-title">生产默认参数</div>${UI.kpi('默认集数', c.defaultEpisodes + ' 集')}${UI.kpi('预算提醒阈值', c.alertThreshold + '%')}${UI.kpi('数据保留', UI.esc(c.retention))}${UI.kpi('模型白名单', UI.esc(c.modelWhitelist))}${UI.kpi('最近更新', UI.esc(c.updated))}</div><div class="card"><div class="card-title">账号与审核策略</div>${UI.kpi('成员邀请', UI.esc(c.invitePolicy))}${UI.kpi('审核策略', UI.esc(c.reviewPolicy))}${UI.kpi('剧本审核', '人工确认后锁定正式版本')}${UI.kpi('成片终审', '人工确认后进入交付')}<div class="notice section-gap">平台配置不替代企业级资源策略；企业与租户可在上限内进一步收紧。</div></div></div>
    <div class="card section-gap"><div class="card-title">配置生效边界</div><p class="prose">平台级配置用于初始化企业、租户与项目参数。预算、配额与模型白名单的最终约束以企业级策略和租户配置为准；任何配置修改均进入审计。</p></div>`);
        }
      },
      {
        path: 'platform/audit',
        stage: 'platform',
        title: '审计事件',
        icon: '≋',
        permission: 'audit',
        render() {
          const validGrants = DB.crossAuthorizations.filter(a => a.status === '有效').length;
          const rows = DB.audits.map((a, index) => `<tr data-row data-status="${UI.esc(a.result)}" data-type="${UI.esc(a.type || '项目')}" data-search="${UI.esc(a.actor)} ${UI.esc(a.action)} ${UI.esc(a.target)} ${UI.esc(a.type || '')}"><td class="mono">${UI.esc(a.time)}</td><td>${UI.esc(a.actor)}</td><td>${UI.esc(a.action)}</td><td>${UI.esc(a.type || '项目')}</td><td>${UI.esc(a.target)}</td><td>${UI.tag(a.result, a.result === '成功' ? 'green' : 'orange')}</td><td><button type="button" class="btn btn-sm" data-action="audit:view" data-id="${index}">详情</button></td></tr>`).join('');

          return UI.page('GOVERNANCE / AUDIT TRAIL', '审计事件记录', '记录身份变更、跨租户访问、项目操作、生产异常、导出和交付行为。', UI.btn('导出审计摘要', 'audit:export', 'btn'), `
    <div class="grid grid-3">${UI.metric('本月审计事件', DB.analytics.auditEventsThisMonth, '包含系统与人工操作（演示值）', '≋')}${UI.metric('跨租户授权', String(validGrants), '当前有效授权关系', '⌘')}${UI.metric('高风险操作', String(DB.analytics.highRiskEvents), '待调查事件', '✓')}</div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">最近事件</div><div class="card-sub">保留最近 ${DB.audits.length} 条，本页操作即时追加</div></div>${UI.btn('刷新', 'audit:refresh', 'btn-sm')}</div>
    <div class="toolbar"><div class="toolbar-left"><b class="small">审计清单</b></div><div class="toolbar-right"><select class="field toolbar-select" data-row-filter="type" aria-label="按事件类型筛选"><option value="all">全部类型</option><option value="授权">授权</option><option value="项目">项目</option><option value="生产">生产</option><option value="交付">交付</option><option value="组织">组织</option></select><select class="field toolbar-select" data-row-filter="status" aria-label="按结果筛选"><option value="all">全部结果</option><option value="成功">成功</option><option value="待处置">待处置</option></select><input class="search" data-filter placeholder="搜索操作人 / 事件 / 对象"></div></div>
    ${UI.table(['时间', '操作主体', '操作行为', '类型', '目标对象', '结果', '操作'], rows, '没有符合条件的审计事件', UI.btn('清除筛选', 'filter:clear', 'btn-sm'))}</div>
    <div class="notice section-gap">审计记录只追加不覆盖；页面内的创建项目、剧本确认、生产启动、异常恢复、授权与交付归档会即时写入上方列表。</div>`);
        }
      },
      {
        path: 'platform/models',
        stage: 'platform',
        title: '模型能力治理',
        icon: '✳',
        permission: 'platform',
        render() {
          const rows = DB.models.map((m, index) => `<tr data-row data-search="${UI.esc(m.type)} ${UI.esc(m.primary)} ${UI.esc(m.backup)}"><td>${UI.esc(m.type)}</td><td><b>${UI.esc(m.primary)}</b></td><td>${UI.esc(m.backup)}</td><td>${UI.tag(m.status, m.tone)}</td><td>${UI.esc(m.rule)}</td><td class="row-actions"><button type="button" class="btn btn-sm" data-action="model:switch" data-id="${index}">切换</button><button type="button" class="btn btn-sm btn-ghost" data-action="model:test" data-id="${index}">测试</button></div></td></tr>`).join('');
          const tested = DB.runtime.lastModelTest || '尚未测试';

          return UI.page('PLATFORM / MODEL GOVERNANCE', '模型与生产能力', '企业统一接入模型能力，按租户配额、能力白名单和预算策略分配。', '', `
    <div class="grid grid-3">${UI.metric('已接入能力', String(DB.models.length), '大语言 / 推理 / 图像 / 视频 / 数字人 / 语音 / 音乐 / 后期 / 转写 / 质检', '✳')}${UI.metric('模型条目', String(DB.models.length * 2), '含主模型与备用模型', '✓')}${UI.metric('今日调用', DB.runtime.callsToday, '按租户记录成本（演示值）', '↗')}</div>
    <div class="card section-gap"><div class="toolbar"><div class="toolbar-left"><b class="small">能力与模型清单</b><span class="tiny muted">最近连通性测试：${UI.esc(tested)}</span></div><div class="toolbar-right"><input class="search" data-filter placeholder="搜索能力类型 / 模型名称"></div></div>${UI.table(['能力类型', '主模型', '备用策略', '状态', '治理规则', '操作'], rows, '没有符合条件的模型条目', UI.btn('清除筛选', 'filter:clear', 'btn-sm'))}</div>
    <div class="notice section-gap">模型名称和调用量为原型演示数据，不代表已接入真实模型服务。平台运维配置不自动授予业务内容读取权。</div>`);
        }
      },
      {
        path: 'platform/system',
        stage: 'platform',
        title: '系统运行配置',
        icon: '⚙',
        permission: 'platform',
        render() {
          const components = DB.runtime.components.map(item => UI.kpi(item.name, UI.tag(item.status, item.tone))).join('');
          return UI.page('PLATFORM / OPERATIONS', '系统运行与安全', '运维管理基础设施、运行状态、备份恢复与安全配置。', `<div class="head-actions">${UI.btn('立即备份', 'system:backup', 'btn')}<button type="button" class="btn btn-ghost" data-action="system:cache">清理缓存</button></div>`, `
    <div class="grid grid-3">${UI.metric('系统健康度', DB.runtime.health, '演示监控指标', '✓')}${UI.metric('任务队列', DB.runtime.queue, '运行中 / 等待中', '⌁')}${UI.metric('最近备份', DB.runtime.backup, '每日增量备份策略', '▣')}</div>
    <div class="grid grid-2 section-gap"><div class="card"><div class="card-title">运行组件</div>${components}<div class="section-gap btn-row"><button type="button" class="btn btn-sm btn-ghost" data-action="system:restart">重启应用服务</button><button type="button" class="btn btn-sm btn-danger" data-action="system:reset">重置演示数据</button></div></div><div class="card"><div class="card-title">运维访问原则</div><p class="prose">平台运维人员默认只拥有基础设施权限。必要业务内容访问需走临时授权、明确目的和审计留痕。备份、恢复和系统配置操作均需记录操作者。</p><div class="notice section-gap">平台身份只看到平台与审计业务域，业务内容页面按权限返回 403。</div><div class="tiny muted section-gap">近一次备份：${UI.esc(DB.runtime.backup)} · 备份策略：每日增量 + 每周全量</div></div></div>`);
        }
      }
    ]
  });

  App.onAction('platform:config-edit', () => {
    const c = DB.runtime.config;
    App.modal('编辑平台业务配置', `<div class="form-grid">${UI.fField('默认项目预算（元）', 'defaultProjectBudget', { value: c.defaultProjectBudget, type: 'number', min: 1000, max: 500000, step: 1000, required: true })}${UI.fField('默认集数', 'defaultEpisodes', { value: c.defaultEpisodes, type: 'number', min: 1, max: 100, required: true })}${UI.fField('失败重试上限（次）', 'retryLimit', { value: c.retryLimit, type: 'number', min: 1, max: 8, required: true })}${UI.fField('预算提醒阈值（%）', 'alertThreshold', { value: c.alertThreshold, type: 'number', min: 50, max: 100, required: true })}${UI.fField('全局并发任务', 'maxConcurrency', { value: c.maxConcurrency, type: 'number', min: 1, max: 100, required: true })}${UI.fField('数据保留策略', 'retention', { value: c.retention, required: true, maxlength: 80 })}<label class="field-wrap full"><span class="field-label">模型白名单</span><textarea class="field" name="modelWhitelist" rows="2" maxlength="100">${UI.esc(c.modelWhitelist)}</textarea><span class="field-error" hidden></span></label>${UI.fSelect('成员邀请策略', 'invitePolicy', [{ value: '企业管理员邀请，成员需确认后生效', label: '企业管理员邀请，成员需确认后生效' }, { value: '租户管理员邀请，企业备案', label: '租户管理员邀请，企业备案' }, { value: '关闭自助邀请', label: '关闭自助邀请' }], { value: c.invitePolicy })}${UI.fSelect('审核策略', 'reviewPolicy', [{ value: '剧本审核与成片终审均需人工确认', label: '剧本审核与成片终审均需人工确认' }, { value: '成片仅人工终审', label: '成片仅人工终审' }, { value: '重要项目双人审核', label: '重要项目双人审核' }], { value: c.reviewPolicy })}</div><div class="notice section-gap">配置只影响新项目与新任务，历史记录不回溯。</div>`, '保存业务配置', 'platform:config-update', { subtitle: '平台级默认参数' });
  });

  App.onSubmit('platform:config-update', form => {
    const c = DB.runtime.config;
    const budget = Number(form.get('defaultProjectBudget') || 0);
    const retry = Number(form.get('retryLimit') || 0);
    const alert = Number(form.get('alertThreshold') || 0);
    const concurrency = Number(form.get('maxConcurrency') || 0);
    if (budget < 1000 || retry < 1 || alert < 50 || alert > 100 || concurrency < 1) { App.toast('业务配置参数不合法', 'error'); return false; }
    c.defaultProjectBudget = budget;
    c.defaultEpisodes = Math.max(1, Math.min(100, Number(form.get('defaultEpisodes') || 12)));
    c.retryLimit = retry;
    c.alertThreshold = alert;
    c.maxConcurrency = concurrency;
    c.retention = String(form.get('retention') || c.retention).trim();
    c.modelWhitelist = String(form.get('modelWhitelist') || c.modelWhitelist).trim();
    c.invitePolicy = String(form.get('invitePolicy') || c.invitePolicy);
    c.reviewPolicy = String(form.get('reviewPolicy') || c.reviewPolicy);
    c.updated = nowStamp();
    DB.enterprise.policies.retryLimit = retry;
    DB.enterprise.policies.alertThreshold = alert;
    DB.enterprise.policies.concurrency = concurrency;
    App.logAudit('更新平台业务配置', '默认预算 ¥' + budget.toLocaleString() + ' / 重试 ' + retry + ' 次', '成功', '组织');
    App.save();
    App.closeModal();
    App.renderRoute();
    App.toast('平台业务配置已保存', 'success', '已生效');
    return true;
  });

  App.onAction('audit:view', trigger => {
    const audit = DB.audits[Number(trigger.dataset.id)];
    if (!audit) { App.toast('审计事件不存在', 'error'); return; }
    App.drawer('审计事件详情', `${UI.kpi('时间', UI.esc(audit.time))}${UI.kpi('操作主体', UI.esc(audit.actor))}${UI.kpi('操作行为', UI.esc(audit.action))}${UI.kpi('事件类型', UI.esc(audit.type || '项目'))}${UI.kpi('目标对象', UI.esc(audit.target))}${UI.kpi('执行结果', UI.tag(audit.result, audit.result === '成功' ? 'green' : 'orange'))}<div class="notice section-gap">审计记录只追加不覆盖，不可编辑或删除；导出内容包含完整字段。</div>`, { subtitle: '只追加记录 · 不可编辑', footer: UI.btn('关闭', 'overlay:close', 'btn') });
  });

  App.onAction('audit:refresh', trigger => {
    App.runAction(trigger, () => {
      App.renderRoute();
      App.toast('审计事件已刷新', 'success');
    }, { loading: '正在刷新…', delay: 400 });
  });

  App.onAction('audit:export', trigger => {
    App.runAction(trigger, () => {
      const rows = DB.audits.map(a => [a.time, a.actor, a.action, a.type || '项目', a.target, a.result]);
      App.download('审计摘要_' + nowStamp() + '.csv', App.toCSV(['时间', '操作主体', '操作行为', '类型', '目标对象', '结果'], rows), 'text/csv;charset=utf-8');
      App.logAudit('导出审计摘要', '最近 ' + DB.audits.length + ' 条事件', '成功', '组织');
      App.renderRoute();
      App.toast('审计摘要已导出', 'success', '导出完成');
    }, { loading: '正在生成 CSV…', delay: 600 });
  });

  App.onAction('model:switch', trigger => {
    const model = DB.models[Number(trigger.dataset.id)];
    if (!model) { return; }
    App.modelIndex = Number(trigger.dataset.id);
    const options = (MODEL_OPTIONS[model.type] || [model.primary]).map(name => ({ value: name, label: name }));
    App.modal('切换主模型 · ' + model.type, `<div class="form-grid">${UI.fSelect('主模型', 'primary', options, { value: model.primary, required: true })}${UI.fSelect('备用策略', 'backup', [
      { value: model.backup, label: model.backup },
      { value: '同类备用模型自动切换', label: '同类备用模型自动切换' },
      { value: '异常暂停并通知运维', label: '异常暂停并通知运维' }
    ], { value: model.backup, required: true })}</div><div class="notice section-gap">切换后新任务按新主模型执行；已排队任务保持原模型，失败时按备用策略处理。</div>`, '确认切换', 'model:switch-submit', { subtitle: model.type });
  });

  App.onSubmit('model:switch-submit', form => {
    const model = DB.models[App.modelIndex];
    if (!model) { App.toast('模型条目不存在', 'error'); return false; }
    const primary = String(form.get('primary') || '');
    const backup = String(form.get('backup') || '');
    if (!primary) { App.toast('请选择主模型', 'error'); return false; }
    if (primary === model.primary && backup === model.backup) { App.toast('模型配置未变化', 'info'); App.closeModal(); return true; }
    const old = model.primary;
    model.primary = primary;
    model.backup = backup;
    App.logAudit('切换生产主模型', model.type + ' / ' + old + ' → ' + primary, '成功', '生产');
    App.save();
    App.closeModal();
    App.renderRoute();
    App.toast(model.type + ' 主模型已切换为 ' + primary, 'success', '已生效');
    return true;
  });

  App.onAction('model:test', trigger => {
    const model = DB.models[Number(trigger.dataset.id)];
    if (!model) { return; }
    App.runAction(trigger, () => {
      DB.runtime.lastModelTest = nowStamp() + ' · ' + model.primary + ' 连通正常';
      App.logAudit('模型连通性测试', model.type + ' / ' + model.primary, '成功', '生产');
      App.save();
      App.renderRoute();
      App.toast(model.primary + ' 连通性正常（演示响应 320ms）', 'success', '测试通过');
    }, { loading: '正在测试连通性…', delay: 900 });
  });

  App.onAction('system:backup', trigger => {
    App.runAction(trigger, () => {
      DB.runtime.backup = nowStamp();
      App.logAudit('执行手动备份', '数据库与对象存储 / 手动全量', '成功', '生产');
      App.save();
      App.renderRoute();
      App.toast('手动备份已完成（演示记录）', 'success', '备份完成');
    }, { loading: '正在备份…', delay: 1000 });
  });

  App.onAction('system:cache', trigger => {
    App.confirm('清理运行缓存', '清理后下一次访问会重新加载静态资源与页面数据，不影响业务记录。', '确认清理', () => {
      App.logAudit('清理运行缓存', '静态资源与页面缓存', '成功', '生产');
      App.save();
      App.toast('运行缓存已清理（演示状态）', 'success', '已清理');
    });
  });

  App.onAction('system:restart', trigger => {
    App.confirm('重启应用服务', '重启期间演示系统不可用约 2 分钟，请确认当前没有进行中的审核或交付操作。', '确认重启', () => {
      const components = DB.runtime.components;
      components.forEach(c => { c.status = '重启中'; c.tone = 'orange'; });
      App.renderRoute();
      window.setTimeout(() => {
        components.forEach(c => { c.status = '正常'; c.tone = 'green'; });
        DB.runtime.health = '99.6%';
        App.logAudit('重启应用服务', '全部运行组件', '成功', '生产');
        App.save();
        App.renderRoute();
        App.toast('应用服务重启完成，组件恢复运行', 'success', '重启完成');
      }, 1400);
      App.toast('应用服务重启中，请稍候…', 'warning', '重启中');
    }, { details: [{ key: '影响范围', value: '全部运行组件' }, { key: '预计耗时', value: '约 2 分钟（演示 1.4 秒）' }], danger: true });
  });

  App.onAction('system:reset', trigger => {
    App.confirm('重置演示数据', '将清除本地保存的项目、授权、审计与排期改动，恢复到 V7.5 初始演示状态。', '确认重置', () => App.resetDemo(), { details: [{ key: '影响范围', value: '本地演示状态（localStorage）' }, { key: '不可逆', value: '重置后无法恢复已做的演示操作' }], danger: true });
  });
})();
