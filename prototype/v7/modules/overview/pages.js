/* 模块：指挥台（overview）— 企业生产状态、待决事项与授权项目入口 */
(function () {
  function statusTone(status) {
    if (status === '已完成' || status === '已交付') return 'green';
    if (status === '已终止' || status === '已归档') return '';
    if (String(status).indexOf('异常') > -1) return 'red';
    if (String(status).indexOf('审核') > -1) return 'orange';
    if (status === '已暂停') return 'orange';
    return 'blue';
  }

  AppModule.register({
    group: 'overview',
    label: '01 / 指挥台',
    icon: '◫',
    routes: [
      {
        path: 'overview/home',
        stage: 'overview',
        title: '工作总览',
        icon: '◫',
        permission: 'overview',
        render() {
          const tenant = App.tenant();
          const projects = App.accessibleProjects();
          const active = projects.filter(p => ['生产中', '后期制作中', '生产准备中', '质量检测中'].indexOf(p.status) > -1).length;
          const pending = projects.filter(p => String(p.status).indexOf('审核') > -1 || String(p.status).indexOf('异常') > -1);
          const delivered = projects.filter(p => p.status === '已完成' || p.delivered).length;
          const totalCost = projects.reduce((sum, p) => sum + (p.cost || 0), 0);
          const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
          const isAuditor = DB.state.identity === 'auditor';

          const tasks = pending.map(p => {
            const exception = String(p.status).indexOf('异常') > -1;
            const target = exception ? 'pipeline/exceptions' : String(p.status).indexOf('剧本') > -1 ? 'studio/script-review' : 'delivery/review';
            return `<div class="callout"><div class="callout-icon" aria-hidden="true">${exception ? '!' : '✳'}</div><div><strong>${exception ? '生产异常' : '待人工审核'} · ${UI.esc(p.title)}</strong><p>${exception ? '当前项目存在暂停的生产任务，需要选择恢复策略。' : '当前项目存在待确认的剧本或成片审核节点。'}</p><div class="section-gap">${UI.btn(exception ? '处理异常' : '进入审核', 'go:' + target + '?id=' + p.id, 'btn-sm btn-primary')}</div></div></div>`;
          }).join('');

          const rows = projects.slice(0, 5).map(p => {
            const pct = Math.round((p.done || 0) / Math.max(p.episodes || 1, 1) * 100);
            return `<tr data-row><td><div class="entity"><div class="entity-mark" aria-hidden="true">${UI.esc(p.title.slice(0, 1))}</div><div><div class="entity-name">${UI.esc(p.title)}</div><div class="entity-meta mono">${UI.esc(p.id)}</div></div></div></td><td><div class="progress-cell sm">${UI.progress(pct, (p.done || 0) + ' / ' + p.episodes + ' 集')}</div></td><td>${UI.esc(p.stage)}</td><td>${UI.tag(p.status, statusTone(p.status))}</td><td>${UI.btn('打开项目', 'go:workspace/detail?id=' + p.id, 'btn-sm')}</td></tr>`;
          }).join('');

          const updatedAt = App.overviewUpdated || '刚刚';
          return UI.page('CONTROL ROOM / 01', '生产指挥台', '企业生产状态、待决事项与当前身份获授权的项目入口。', `<div class="head-actions"><span class="tiny muted">数据更新：${UI.esc(updatedAt)}</span>${UI.btn('我的生产统计', 'go:analytics/me', 'btn')}${UI.btn('刷新数据', 'overview:refresh', 'btn')}${isAuditor ? '' : UI.btn('新建项目', 'project:new', 'btn-lime')}</div>`, `
    <div class="hero"><div class="hero-kicker">YOUR PRODUCTION SPACE / ${UI.esc(tenant ? tenant.code : 'NO WORKSPACE')}</div><h2>让创作想法，成为可交付的作品。</h2><p>AI 承担专业生产执行，员工负责创作方向、剧本确认、异常决策与最终成片审核。当前工作空间：${UI.esc(tenant ? tenant.name : '未选择租户')}。</p><div class="hero-actions">${isAuditor ? '' : UI.btn('开始一个新项目', 'project:new', 'btn-lime')}${UI.btn('查看生产流水线', 'go:pipeline/board', 'btn')}</div></div>
    <div class="grid grid-4 section-gap">${UI.metric('授权项目', String(projects.length), '当前身份可访问的项目', '▣')}${UI.metric('正在生产', String(active), 'AI 生产状态', '◌')}${UI.metric('待人工决策', String(pending.length), '剧本 / 成片审核与异常处置', '!')}${UI.metric('已交付作品', String(delivered), '预算使用 ¥' + totalCost.toLocaleString() + ' / ¥' + totalBudget.toLocaleString(), '↗')}</div>
    <div class="grid grid-split section-gap"><div class="card"><div class="card-head"><div><div class="card-title">项目生产动态</div><div class="card-sub">当前工作空间 · 最近更新</div></div><a class="small muted" href="#/workspace/projects">全部项目 →</a></div>${UI.table(['项目 / 编号', '进度', '当前阶段', '状态', '操作'], rows, '当前工作空间暂无可展示项目')}</div><div class="card"><div class="card-head"><div><div class="card-title">需要你确认的事项</div><div class="card-sub">只在人工决策节点介入</div></div>${UI.tag(pending.length + ' 项待处理', pending.length ? 'orange' : 'green')}</div>${tasks || UI.empty('当前没有待决事项', '当前授权项目中没有需要人工处理的审核或生产异常。')}</div></div>
    <div class="grid grid-3 section-gap"><div class="card"><div class="card-title">AI 生产能力状态</div><div class="kpi-line"><span>创意 / 剧本</span>${UI.tag('演示可用', 'green')}</div><div class="kpi-line"><span>视觉 / 分镜</span>${UI.tag('演示可用', 'green')}</div><div class="kpi-line"><span>视频生成</span>${UI.tag('演示队列', 'orange')}</div><div class="kpi-line"><span>音频 / 后期</span>${UI.tag('演示可用', 'green')}</div></div><div class="card"><div class="card-title">授权项目交付状态</div>${UI.chart(projects.slice(0, 7).map(p => Math.round((p.done || 0) / Math.max(p.episodes || 1, 1) * 100)), projects.slice(0, 7).map((p, i) => 'P' + (i + 1)))}<div class="tiny muted section-gap">按当前授权项目的完成集数比例展示；仅为演示数据。</div></div><div class="card"><div class="card-title">生产纪律</div><p class="prose">项目、任务、素材、成本和成片均绑定租户。跨租户查看必须经过授权，员工离职不影响项目资产归属。</p>${UI.btn('查看审计记录', 'go:platform/audit', 'btn-sm')}</div></div>`);
        }
      }
    ]
  });

  App.onAction('overview:refresh', trigger => {
    App.runAction(trigger, () => {
      App.overviewUpdated = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      App.renderRoute();
      App.toast('生产数据已刷新', 'success', '已更新');
    }, { loading: '正在汇总生产数据…', delay: 700 });
  });
})();
