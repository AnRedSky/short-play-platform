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

          const contributions = activeTenants.map(t => {
            const stats = tenantStats(t.id);
            return `<div class="section-gap">${UI.progress(stats.completion, t.name)}</div>`;
          }).join('');

          const rows = activeTenants.map(t => {
            const stats = tenantStats(t.id);
            return `<tr data-row data-search="${UI.esc(t.name)} ${UI.esc(t.code)}"><td><b>${UI.esc(t.name)}</b></td><td>${stats.projects}</td><td>${stats.delivered}</td><td>${stats.quality}</td><td class="mono">¥${(t.used || 0).toLocaleString()}</td><td>${t.budget ? Math.round(t.used / t.budget * 100) + '%' : '—'}</td></tr>`;
          }).join('');

          return UI.page('BUSINESS INTELLIGENCE / ENTERPRISE', '企业生产经营分析', '以真实交付作品、作品质量、生产效率与 AI 成本为核心口径，不以任务数量简单考核。', `<div class="head-actions">${periodBar(meta.id)}${UI.btn('导出经营摘要', 'analytics:export-enterprise', 'btn')}</div>`, `
    <div class="grid grid-4">${UI.metric('正式交付作品', String(delivered.length), meta.label + '口径 · 已归档交付', '✓')}${UI.metric('交付集数', String(deliveredEpisodes), '通过终审并归档', '▤')}${UI.metric('平均质量评分', qualityValues.length ? average(qualityValues).toFixed(1) : '待检测', 'AI 质检 + 人工终审', '✳')}${UI.metric('AI 生产成本', '¥' + totalCost.toLocaleString(), '演示项目累计归集', '￥')}</div>
    <div class="grid grid-2 section-gap"><div class="card"><div class="card-head"><div><div class="card-title">交付趋势</div><div class="card-sub">企业整体 · ${UI.esc(meta.label)}</div></div>${UI.tag(meta.label, 'blue')}</div>${UI.chart(chartValues, chartLabels)}<div class="tiny muted section-gap">趋势曲线为演示占位数据，正式接入后由交付记录聚合生成；当前展示 ${chartValues.length} 个周期点。</div></div><div class="card"><div class="card-title">租户生产完成度</div>${contributions}<div class="tiny muted section-gap">按租户内项目的完成集数比例计算。</div></div></div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">租户经营指标</div><div class="card-sub">交付作品与质量按演示项目记录聚合</div></div><div class="toolbar-right"><input class="search" data-filter placeholder="搜索租户名称 / 编码"></div></div>${UI.table(['租户', '项目数', '交付作品', '平均质量', 'AI 成本', '预算使用'], rows, '没有符合条件的租户', UI.btn('清除筛选', 'filter:clear', 'btn-sm'))}</div>
    <div class="notice section-gap">经营统计按租户授权范围聚合；本页面为企业级管理视角。仅有汇总查看权限时，不会自动开放项目内容编辑。</div>`);
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
            return `<tr data-row data-search="${UI.esc(u.name)} ${UI.esc(u.email)} ${UI.esc(tenant ? tenant.name : '')}"><td><b>${UI.esc(u.name)}</b></td><td>${UI.esc(tenant ? tenant.name : '未知租户')}</td><td>${u.projects}</td><td>${u.delivered}</td><td>${ownerQuality(u.name)}</td><td class="mono">¥${(u.cost || 0).toLocaleString()}</td><td><button type="button" class="btn btn-sm" data-action="analytics:member" data-id="${UI.esc(u.id)}">详情</button></td></tr>`;
          }).join('');

          return UI.page('BUSINESS INTELLIGENCE / PEOPLE', '员工产出与效率', '从最终作品、交付集数、质量、周期和成本综合观察个人生产表现。', UI.btn('导出员工产出', 'analytics:export-people', 'btn'), `
    <div class="grid grid-3">${UI.metric('在册成员', String(DB.analytics.employeeTotal), '企业在册成员（聚合值）', '♙')}${UI.metric('人均交付作品', perCapita, '按有交付记录的样本成员核算', '▣')}${UI.metric('平均单集成本', '¥' + perEpisodeCost, '按样本成员成本与交付集数核算', '￥')}</div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">员工产出样例</div><div class="card-sub">质量为当前用户名下项目的平均值</div></div></div><div class="toolbar"><div class="toolbar-left"><b class="small">成员产出</b></div><div class="toolbar-right"><input class="search" data-filter placeholder="搜索员工姓名 / 邮箱 / 租户"></div></div>${UI.table(['员工', '所属租户', '负责项目', '交付作品', '质量评分', 'AI 成本', '操作'], rows, '没有符合条件的员工', UI.btn('清除筛选', 'filter:clear', 'btn-sm'))}</div>
    <div class="notice section-gap">不以生成任务数、镜头数或素材数量代替作品产出；统计必须可追溯到正式交付记录。原型中的成员与交付量为演示样本。</div>`);
        }
      }
    ]
  });

  App.onAction('analytics:period', trigger => {
    App.analyticsPeriod = trigger.dataset.id;
    App.renderRoute();
    App.toast('统计周期已切换为' + (periodMeta().label), 'info');
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
        return [u.name, u.email, tenant ? tenant.name : '', u.projects, u.delivered, ownerQuality(u.name), u.cost || 0];
      });
      App.download('员工产出_' + periodMeta().label + '.csv', App.toCSV(['员工', '邮箱', '租户', '负责项目', '交付作品', '质量评分', 'AI 成本'], rows), 'text/csv;charset=utf-8');
      App.logAudit('导出员工产出', '员工产出与效率 / ' + periodMeta().label, '成功', '组织');
      App.renderRoute();
      App.toast('员工产出已导出', 'success', '导出完成');
    }, { loading: '正在聚合数据…', delay: 700 });
  });

  App.onAction('analytics:member', trigger => {
    const user = DB.users.find(u => u.id === trigger.dataset.id);
    if (!user) { App.toast('成员不存在', 'error'); return; }
    const tenant = DB.tenants.find(t => t.id === user.tenant);
    const projects = DB.projects.filter(p => p.owner === user.name);
    App.drawer('产出详情 · ' + user.name, `${UI.kpi('所属租户', UI.esc(tenant ? tenant.name : '未知'))}${UI.kpi('角色', UI.esc(DB.roleNames[user.role] || user.role))}${UI.kpi('负责项目', String(user.projects))}${UI.kpi('已交付作品', String(user.delivered))}${UI.kpi('质量评分', ownerQuality(user.name))}${UI.kpi('累计成本', '¥' + (user.cost || 0).toLocaleString())}<div class="section-gap"><div class="card-title">名下项目</div>${projects.length ? UI.table(['作品', '项目编号', '集数', '状态', '质量'], projectRowsOf(user.name), '暂无项目') : UI.empty('暂无项目记录', '该成员当前没有负责的项目。')}</div><div class="notice section-gap">产出以正式交付记录为准；成本为演示归集值，不代表真实结算。</div>`, { subtitle: user.email, footer: UI.btn('关闭', 'overlay:close', 'btn') });
  });
})();
