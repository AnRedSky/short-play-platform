/* 模块：经营分析（analytics）— 企业交付口径与员工产出核算 */
(function () {
  function average(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function enterpriseProjects() {
    return DB.projects;
  }

  function tenantStats(tenantId) {
    const projects = enterpriseProjects().filter(p => p.tenant === tenantId);
    const delivered = projects.filter(p => p.delivered);
    const qualities = projects.filter(p => p.quality).map(p => p.quality);
    return {
      projects: projects.length,
      delivered: delivered.length,
      quality: qualities.length ? average(qualities).toFixed(1) : '—',
      completion: projects.length ? Math.round(projects.reduce((sum, p) => sum + (p.done || 0), 0) / Math.max(1, projects.reduce((sum, p) => sum + p.episodes, 0)) * 100) : 0
    };
  }

  function ownerQuality(owner) {
    const qualities = DB.projects.filter(p => p.owner === owner && p.quality).map(p => p.quality);
    return qualities.length ? average(qualities).toFixed(1) : '—';
  }

  const PERIODS = [
    { id: 'week', label: '本周', points: 2 },
    { id: 'month', label: '本月', points: 4 },
    { id: 'quarter', label: '本季', points: 7 },
    { id: 'all', label: '全部', points: 7 }
  ];

  function currentPeriod() {
    return App.analyticsPeriod || 'month';
  }

  function periodMeta() {
    return PERIODS.find(p => p.id === currentPeriod()) || PERIODS[1];
  }

  function periodBar(active) {
    return `<div class="segmented" role="group" aria-label="统计周期">${PERIODS.map(p => `<button type="button" class="seg-btn${p.id === active ? ' is-active' : ''}" data-action="analytics:period" data-id="${p.id}">${p.label}</button>`).join('')}</div>`;
  }

  function projectRowsOf(owner) {
    return DB.projects.filter(p => p.owner === owner).map(p => `<tr data-row><td>${UI.esc(p.title)}</td><td class="mono">${UI.esc(p.id)}</td><td>${p.done || 0} / ${p.episodes}</td><td>${UI.tag(p.status, p.delivered ? 'green' : 'orange')}</td><td>${p.quality || '—'}</td></tr>`).join('');
  }

  AppModule.register({
    group: 'analytics',
    label: '09 / 经营分析',
    icon: '▥',
    routes: [
      {
        path: 'analytics/enterprise',
        stage: 'insight',
        title: '企业经营看板',
        icon: '▥',
        permission: 'analytics',
        render() {
          const projects = enterpriseProjects();
          const delivered = projects.filter(p => p.delivered);
          const deliveredEpisodes = delivered.reduce((sum, p) => sum + p.episodes, 0);
          const qualityValues = delivered.filter(p => p.quality).map(p => p.quality);
          const totalCost = projects.reduce((sum, p) => sum + (p.cost || 0), 0);
          const activeTenants = DB.tenants.filter(t => t.status !== '已归档');
          const meta = periodMeta();
          const chartValues = DB.analytics.weeklyDeliveries.slice(-meta.points);
          const chartLabels = DB.analytics.weeklyLabels.slice(-meta.points);
          const completed = projects.filter(p => p.status === '已完成' || p.delivered).length;
          const inProgress = projects.filter(p => ['生产中', '后期制作中', '生产准备中', '质量检测中'].indexOf(p.status) > -1).length;
          const terminated = projects.filter(p => p.terminated || p.status === '已终止').length;
          const completionRate = projects.length ? Math.round(completed / projects.length * 100) : 0;
          const plannedEpisodes = projects.reduce((sum, p) => sum + (p.episodes || 0), 0);
          const totalMinutes = projects.reduce((sum, p) => sum + (p.episodes || 0) * (p.duration || 2), 0);
          const taskList = DB.productionTasks || [];
          const taskDone = taskList.filter(t => t.status === '已完成').length;
          const aiSuccess = taskList.length ? (taskDone / taskList.length * 100).toFixed(1) : '0.0';
          const failedCost = taskList.reduce((sum, t) => sum + (t.failedCost || 0), 0);
          const retries = taskList.reduce((sum, t) => sum + Math.max(0, (t.attempt || 0) - 1), 0);
          const projectCostRows = projects.map(p => `<tr data-row data-search="${UI.esc(p.title)} ${UI.esc(p.owner)}"><td>${UI.esc(p.title)}<div class="tiny muted mono">${UI.esc(p.id)}</div></td><td>${UI.esc(p.owner)}</td><td>${p.episodes} 集</td><td class="mono">¥${(p.cost || 0).toLocaleString()}</td><td class="mono">¥${Math.round((p.cost || 0) / Math.max(p.episodes || 1, 1)).toLocaleString()}</td><td class="mono">¥${(p.budget || 0).toLocaleString()}</td><td>${p.budget ? Math.round((p.cost || 0) / p.budget * 100) + '%' : '未设置'}</td></tr>`).join('');
          const snapshots = (DB.analyticsSnapshots || []).slice(0, 6);
          const snapshotRows = snapshots.map(s => `<tr data-row><td class="mono">${UI.esc(s.capturedAt)}</td><td>${s.projects}</td><td>${s.deliveredWorks}</td><td>${s.deliveredEpisodes}</td><td>${s.quality}</td><td class="mono">¥${(s.cost || 0).toLocaleString()}</td><td class="mono">¥${(s.failedCost || 0).toLocaleString()}</td><td>${UI.esc(s.operator)}</td></tr>`).join('');

          const contributions = activeTenants.map(t => {
            const stats = tenantStats(t.id);
            return `<div class="section-gap">${UI.progress(stats.completion, t.name)}</div>`;
          }).join('');

          const rows = activeTenants.map(t => {
            const stats = tenantStats(t.id);
            return `<tr data-row data-search="${UI.esc(t.name)} ${UI.esc(t.code)}"><td><b>${UI.esc(t.name)}</b></td><td>${stats.projects}</td><td>${stats.delivered}</td><td>${stats.quality}</td><td class="mono">¥${(t.used || 0).toLocaleString()}</td><td>${t.budget ? Math.round(t.used / t.budget * 100) + '%' : '—'}</td></tr>`;
          }).join('');

          return UI.page('BUSINESS INTELLIGENCE / ENTERPRISE', '企业生产经营分析', '以真实交付作品、作品质量、生产效率与 AI 成本为核心口径，不以任务数量简单考核。', `<div class="head-actions">${periodBar(meta.id)}${UI.btn('生成统计快照', 'analytics:snapshot', 'btn')}${UI.btn('导出经营摘要', 'analytics:export-enterprise', 'btn')}</div>`, `
    <div class="grid grid-4">${UI.metric('项目总数', String(projects.length), '进行中 ' + inProgress + ' / 已终止 ' + terminated, '▣')}${UI.metric('已完成 / 完成率', completed + ' / ' + completionRate + '%', '含已交付作品', '✓')}${UI.metric('交付集数', String(deliveredEpisodes), '计划 ' + plannedEpisodes + ' 集', '▤')}${UI.metric('成片总时长', totalMinutes.toLocaleString() + ' 分钟', '视频生成 ' + DB.analytics.renderedMinutes.toLocaleString() + ' 分钟', '◷')}</div>
    <div class="grid grid-4 section-gap">${UI.metric('平均质量评分', qualityValues.length ? average(qualityValues).toFixed(1) : '待检测', '十维质检 + 人工终审', '✳')}${UI.metric('AI 任务成功率', aiSuccess + '%', '自动重试 ' + retries + ' 次', '⌗')}${UI.metric('交付作品', String(delivered.length), '正式归档交付', '↗')}${UI.metric('AI 生产成本', '¥' + totalCost.toLocaleString(), '失败成本 ¥' + failedCost.toLocaleString(), '￥')}</div>
    <div class="grid grid-4 section-gap">${UI.metric('剧本通过率', DB.analytics.scriptPassRate + '%', '人工确认口径', '✎')}${UI.metric('终审通过率', DB.analytics.finalPassRate + '%', '最终成片审核', '✓')}${UI.metric('镜头返工率', DB.analytics.reworkRate + '%', '音频异常 ' + DB.analytics.audioIssueRate + '%', '↺')}${UI.metric('平均项目周期', DB.analytics.avgProjectDays + ' 天', '单集 ' + DB.analytics.avgEpisodeDays + ' 天', '◷')}</div>
    <div class="grid grid-2 section-gap"><div class="card"><div class="card-head"><div><div class="card-title">交付趋势</div><div class="card-sub">企业整体 · ${UI.esc(meta.label)}</div></div>${UI.tag(meta.label, 'blue')}</div>${UI.chart(chartValues, chartLabels)}<div class="tiny muted section-gap">趋势曲线为演示占位数据，正式接入后由交付记录聚合生成；当前展示 ${chartValues.length} 个周期点。</div></div><div class="card"><div class="card-title">租户生产完成度</div>${contributions}<div class="tiny muted section-gap">按租户内项目的完成集数比例计算。</div></div></div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">项目成本明细</div><div class="card-sub">按项目、单集成本、预算使用与失败成本拆分；当前为演示归集值</div></div><span class="tiny muted">成本口径：AI 调用 + 失败重试 + 后期处理</span></div>${UI.table(['项目', '负责人', '集数', '实际成本', '单集成本', '预算', '预算使用'], projectCostRows, '暂无项目成本记录')}</div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">租户经营指标</div><div class="card-sub">交付作品与质量按演示项目记录聚合</div></div><div class="toolbar-right"><input class="search" data-filter placeholder="搜索租户名称 / 编码"></div></div>${UI.table(['租户', '项目数', '交付作品', '平均质量', 'AI 成本', '预算使用'], rows, '没有符合条件的租户', UI.btn('清除筛选', 'filter:clear', 'btn-sm'))}</div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">历史统计快照</div><div class="card-sub">冻结项目数、交付作品、交付集数、质量、成本与失败成本，避免后续修改项目状态影响历史经营数据</div></div>${UI.tag('最近 ' + snapshots.length + ' 次', 'blue')}</div>${snapshots.length ? UI.table(['快照时间', '项目数', '交付作品', '交付集数', '平均质量', 'AI 成本', '失败成本', '操作人'], snapshotRows, '暂无统计快照') : UI.empty('暂无统计快照', '生成统计快照后可对比历史经营数据。')}</div>
    <div class="notice section-gap">统计口径：项目完成率按已完成项目/全部项目；单集成本按项目实际成本/计划集数；任务成功率按已完成任务/全部任务。历史经营数据以快照为准，实时看板仅用于当期经营判断。</div>`);
        }
      },
      {
        path: 'analytics/employee',
        stage: 'insight',
        title: '员工产出分析',
        icon: '♙',
        permission: 'analytics',
        render() {
          const productive = DB.users.filter(u => u.delivered > 0);
          const deliveredWorks = productive.reduce((sum, u) => sum + u.delivered, 0);
          const perCapita = productive.length ? (deliveredWorks / productive.length).toFixed(1) : '0';
          const deliveredEpisodes = DB.projects.filter(p => p.delivered).reduce((sum, p) => sum + p.episodes, 0);
          const sampleCost = productive.reduce((sum, u) => sum + (u.cost || 0), 0);
          const perEpisodeCost = deliveredEpisodes ? Math.round(sampleCost / deliveredEpisodes) : 0;

          const rows = DB.users.map(u => {
            const tenant = DB.tenants.find(t => t.id === u.tenant);
            const memberships = (u.tenants || [{ tenant: u.tenant, role: u.role }]).map(m => {
              const t = DB.tenants.find(x => x.id === m.tenant);
              return (t ? t.name : m.tenant) + '（' + (DB.roleNames[m.role] || m.role) + '）';
            }).join('、');
            return `<tr data-row data-search="${UI.esc(u.name)} ${UI.esc(u.email)} ${UI.esc(tenant ? tenant.name : '')} ${UI.esc(memberships)}"><td><b>${UI.esc(u.name)}</b><div class="tiny muted">${UI.esc(u.email)}</div></td><td>${UI.esc(memberships)}</td><td>${u.projects}</td><td>${u.completed != null ? u.completed : '—'}</td><td>${u.delivered}</td><td>${u.episodes != null ? u.episodes : '—'}</td><td>${ownerQuality(u.name)}</td><td class="mono">¥${(u.cost || 0).toLocaleString()}</td><td><button type="button" class="btn btn-sm" data-action="analytics:member" data-id="${UI.esc(u.id)}">详情</button></td></tr>`;
          }).join('');

          return UI.page('BUSINESS INTELLIGENCE / PEOPLE', '员工产出与效率', '从最终作品、交付集数、质量、周期和成本综合观察个人生产表现。员工在多个租户任职时分别保留成员关系。', UI.btn('导出员工产出', 'analytics:export-people', 'btn'), `
    <div class="grid grid-4">${UI.metric('在册成员', String(DB.analytics.employeeTotal), '企业在册成员（聚合值）', '♙')}${UI.metric('人均交付作品', perCapita, '按有交付记录的样本成员核算', '▣')}${UI.metric('平均单集成本', '¥' + perEpisodeCost, '按样本成员成本与交付集数核算', '￥')}${UI.metric('多租户成员', String(DB.users.filter(u => (u.tenants || []).length > 1).length), '同一员工可加入多个租户', '⇄')}</div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">员工产出样例</div><div class="card-sub">质量为当前用户名下项目的平均值；成员关系与项目访问权分开管理</div></div></div><div class="toolbar"><div class="toolbar-left"><b class="small">成员产出</b></div><div class="toolbar-right"><input class="search" data-filter placeholder="搜索员工姓名 / 邮箱 / 租户"></div></div>${UI.table(['员工', '租户成员关系', '负责项目', '完成项目', '交付作品', '交付集数', '质量评分', 'AI 成本', '操作'], rows, '没有符合条件的员工', UI.btn('清除筛选', 'filter:clear', 'btn-sm'))}</div>
    <div class="notice section-gap">不以生成任务数、镜头数或素材数量代替作品产出；统计必须可追溯到正式交付记录。原型中的成员与交付量为演示样本。</div>`);
        }
      },
      {
        path: 'analytics/me',
        stage: 'insight',
        title: '我的生产统计',
        icon: '◉',
        permission: 'analytics-self',
        render() {
          const me = DB.users.find(u => u.name === App.identity().user) || DB.users[0];
          const myProjects = DB.projects.filter(p => p.owner === me.name);
          const active = myProjects.filter(p => ['生产中', '后期制作中', '生产准备中', '质量检测中'].indexOf(p.status) > -1);
          const delivered = myProjects.filter(p => p.delivered);
          const episodes = myProjects.reduce((sum, p) => sum + (p.done || 0), 0);
          const deliveredEpisodes = delivered.reduce((sum, p) => sum + p.episodes, 0);
          const cost = myProjects.reduce((sum, p) => sum + (p.cost || 0), 0);
          const qualities = myProjects.filter(p => p.quality).map(p => p.quality);
          const myTasks = (DB.productionTasks || []).filter(t => myProjects.some(p => p.id === t.project));
          const doneTasks = myTasks.filter(t => t.status === '已完成').length;
          const retries = myTasks.reduce((sum, t) => sum + Math.max(0, (t.attempt || 0) - 1), 0);
          const failedCost = myTasks.reduce((sum, t) => sum + (t.failedCost || 0), 0);
          const pendingProjects = myProjects.filter(p => String(p.status).indexOf('审核') > -1 || String(p.status).indexOf('异常') > -1 || p.status === '已暂停');
          const memberships = (me.tenants || [{ tenant: me.tenant, role: me.role }]).map(m => {
            const t = DB.tenants.find(x => x.id === m.tenant);
            return (t ? t.name : m.tenant) + ' · ' + (DB.roleNames[m.role] || m.role);
          });
          const rows = myProjects.map(p => `<tr data-row><td><b>${UI.esc(p.title)}</b><div class="tiny muted mono">${UI.esc(p.id)}</div></td><td>${p.done || 0} / ${p.episodes} 集</td><td>${UI.esc(p.stage)}</td><td>${UI.tag(p.status, p.delivered ? 'green' : String(p.status).indexOf('异常') > -1 ? 'red' : 'orange')}</td><td>${p.quality || '—'}</td><td class="mono">¥${(p.cost || 0).toLocaleString()}</td><td>${UI.btn('打开项目', 'go:workspace/detail?id=' + p.id, 'btn-sm')}</td></tr>`).join('');
          return UI.page('MY WORKSPACE / PERSONAL OUTPUT', '我的生产统计', '只统计当前账号本人负责项目与任务，不暴露其他员工明细。产出以正式交付为准。', `<div class="head-actions">${UI.btn('导出我的产出', 'analytics:me-export', 'btn', { id: me.id })}</div>`, `
    <div class="grid grid-4"><div class="card"><div class="eyebrow">CURRENT USER</div><div class="entity-title">${UI.esc(me.name)}</div><div class="tiny muted">${UI.esc(me.email)}</div><div class="section-gap">${UI.tag(DB.roleNames[me.role] || me.role, 'blue')}</div><div class="tiny muted section-gap">${UI.esc(memberships.join(' / '))}</div></div>${UI.metric('负责项目', String(myProjects.length), '进行中 ' + active.length + ' 个', '▣')}${UI.metric('交付作品 / 集数', delivered.length + ' / ' + deliveredEpisodes, '累计完成 ' + episodes + ' 集', '↗')}${UI.metric('平均质量分', qualities.length ? average(qualities).toFixed(1) : '待检测', '本人项目质量均值', '✳')}</div>
    <div class="grid grid-4 section-gap">${UI.metric('完成任务', doneTasks + ' / ' + myTasks.length, 'AI 任务成功率 ' + (myTasks.length ? Math.round(doneTasks / myTasks.length * 100) : 0) + '%', '⌗')}${UI.metric('自动重试', String(retries), '失败成本 ¥' + failedCost.toLocaleString(), '↺')}${UI.metric('AI 成本', '¥' + cost.toLocaleString(), '本人项目累计归集', '￥')}${UI.metric('待我处理', String(pendingProjects.length), '审核 / 异常 / 暂停项目', pendingProjects.length ? '!' : '✓')}</div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">我的项目产出</div><div class="card-sub">按项目完成集数、质量、成本与正式交付追溯</div></div>${UI.tag('仅本人', 'blue')}</div>${myProjects.length ? UI.table(['项目', '完成集数', '当前阶段', '状态', '质量', '成本', '操作'], rows, '暂无本人项目') : UI.empty('暂无本人负责项目', '可在项目中心创建或由管理员移交项目。', UI.btn('前往项目中心', 'go:workspace/projects', 'btn-sm'))}</div>
    <div class="grid grid-2 section-gap"><div class="card"><div class="card-title">项目访问权限</div>${UI.kpi('成员关系', UI.esc(memberships.join(' / ')))}${UI.kpi('项目访问范围', UI.esc(me.access || '本人项目 + 授权项目'))}${UI.kpi('账号状态', UI.esc(me.status))}${UI.kpi('最近活跃', UI.esc(me.lastActive || '—'))}<div class="tiny muted section-gap">员工可加入多个租户；项目访问权与成员关系分开授予，离职时需移交未完成项目。</div></div><div class="card"><div class="card-title">产出说明</div><p class="prose">个人统计仅用于工作复盘与资源申请，不直接作为排名或处罚依据。失败任务与重试成本单独展示，不隐藏失败。</p><div class="notice section-gap">统计基于当前演示数据实时聚合，尚未形成历史快照。</div></div></div>`);
        }
      }
    ]
  });

  App.onAction('analytics:period', trigger => {
    App.analyticsPeriod = trigger.dataset.id;
    App.renderRoute();
    App.toast('统计周期已切换为' + (periodMeta().label), 'info');
  });

  App.onAction('analytics:snapshot', trigger => {
    App.runAction(trigger, () => {
      const projects = DB.projects;
      const delivered = projects.filter(p => p.delivered || p.status === '已完成');
      const qualities = delivered.filter(p => p.quality).map(p => p.quality);
      const tasks = DB.productionTasks || [];
      const now = new Date();
      const stamp = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      const snap = {
        id: 'SN-' + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0'),
        capturedAt: stamp,
        projects: projects.length,
        deliveredWorks: delivered.length,
        deliveredEpisodes: delivered.reduce((sum, p) => sum + (p.episodes || 0), 0),
        quality: qualities.length ? average(qualities).toFixed(1) : 0,
        cost: projects.reduce((sum, p) => sum + (p.cost || 0), 0),
        failedCost: tasks.reduce((sum, t) => sum + (t.failedCost || 0), 0),
        operator: App.identity().user,
        note: '手工生成，按当前实时记录冻结'
      };
      DB.analyticsSnapshots = DB.analyticsSnapshots || [];
      DB.analyticsSnapshots.unshift(snap);
      App.logAudit('生成经营统计快照', snap.id + ' / ' + snap.capturedAt, '成功', '组织');
      App.save();
      App.renderRoute();
      App.toast('统计快照已生成，共 ' + DB.analyticsSnapshots.length + ' 条历史记录', 'success', '快照已生成');
    }, { loading: '正在冻结经营指标…', delay: 700 });
  });

  App.onAction('analytics:export-enterprise', trigger => {
    App.runAction(trigger, () => {
      const rows = DB.tenants.filter(t => t.status !== '已归档').map(t => {
        const s = tenantStats(t.id);
        return [t.name, t.code, s.projects, s.delivered, s.quality, t.used, (t.budget ? Math.round(t.used / t.budget * 100) : 0) + '%'];
      });
      App.download('企业经营摘要_' + periodMeta().label + '.csv', App.toCSV(['租户', '编码', '项目数', '交付作品', '平均质量', 'AI 成本', '预算使用'], rows), 'text/csv;charset=utf-8');
      App.logAudit('导出经营摘要', '企业租户经营指标 / ' + periodMeta().label, '成功', '组织');
      App.renderRoute();
      App.toast('经营摘要已导出', 'success', '导出完成');
    }, { loading: '正在聚合数据…', delay: 700 });
  });

  App.onAction('analytics:export-people', trigger => {
    App.runAction(trigger, () => {
      const rows = DB.users.map(u => {
        const tenant = DB.tenants.find(t => t.id === u.tenant);
        return [u.name, u.email, tenant ? tenant.name : '', (u.tenants || []).length, u.projects, u.completed || 0, u.delivered, u.episodes || 0, ownerQuality(u.name), u.cost || 0];
      });
      App.download('员工产出_' + periodMeta().label + '.csv', App.toCSV(['员工', '邮箱', '主租户', '租户成员关系数', '负责项目', '完成项目', '交付作品', '交付集数', '质量评分', 'AI 成本'], rows), 'text/csv;charset=utf-8');
      App.logAudit('导出员工产出', '员工产出与效率 / ' + periodMeta().label, '成功', '组织');
      App.renderRoute();
      App.toast('员工产出已导出', 'success', '导出完成');
    }, { loading: '正在聚合数据…', delay: 700 });
  });

  App.onAction('analytics:me-export', trigger => {
    const me = DB.users.find(u => u.id === trigger.dataset.id) || DB.users.find(u => u.name === App.identity().user);
    if (!me) { return; }
    App.runAction(trigger, () => {
      const rows = DB.projects.filter(p => p.owner === me.name).map(p => [p.id, p.title, p.done || 0, p.episodes, p.status, p.quality || 0, p.cost || 0, p.budget || 0]);
      App.download(me.name + '_我的产出.csv', App.toCSV(['项目编号', '项目', '完成集数', '计划集数', '状态', '质量', '成本', '预算'], rows), 'text/csv;charset=utf-8');
      App.logAudit('导出本人产出', me.name + ' / ' + rows.length + ' 个项目', '成功', '组织');
    }, { loading: '生成个人产出…', delay: 600 });
  });

  App.onAction('analytics:member', trigger => {
    const user = DB.users.find(u => u.id === trigger.dataset.id);
    if (!user) { App.toast('成员不存在', 'error'); return; }
    const tenant = DB.tenants.find(t => t.id === user.tenant);
    const projects = DB.projects.filter(p => p.owner === user.name);
    const memberships = (user.tenants || [{ tenant: user.tenant, role: user.role }]).map(m => {
      const t = DB.tenants.find(x => x.id === m.tenant);
      return (t ? t.name : m.tenant) + ' · ' + (DB.roleNames[m.role] || m.role);
    }).join(' / ');
    App.drawer('产出详情 · ' + user.name, `${UI.kpi('所属租户', UI.esc(tenant ? tenant.name : '未知'))}${UI.kpi('租户成员关系', UI.esc(memberships))}${UI.kpi('角色', UI.esc(DB.roleNames[user.role] || user.role))}${UI.kpi('项目访问范围', UI.esc(user.access || '本人项目 + 授权项目'))}${UI.kpi('负责项目', String(user.projects))}${UI.kpi('完成项目', String(user.completed || 0))}${UI.kpi('已交付作品', String(user.delivered))}${UI.kpi('交付集数', String(user.episodes || 0))}${UI.kpi('质量评分', ownerQuality(user.name))}${UI.kpi('累计成本', '¥' + (user.cost || 0).toLocaleString())}<div class="section-gap"><div class="card-title">名下项目</div>${projects.length ? UI.table(['作品', '项目编号', '集数', '状态', '质量'], projectRowsOf(user.name), '暂无项目') : UI.empty('暂无项目记录', '该成员当前没有负责的项目。')}</div><div class="notice section-gap">产出以正式交付记录为准；成本为演示归集值，不代表真实结算。员工离职前需完成项目移交。</div>`, { subtitle: user.email, footer: UI.btn('关闭', 'overlay:close', 'btn') });
  });
})();
