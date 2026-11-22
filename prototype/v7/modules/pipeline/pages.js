/* 模块：AI 自动生产（pipeline）— 调度、拍摄排期、后期、异常与镜头单元 */
(function () {
  function stagePlan(project, assetCount) {
    const approved = !!project.scriptApproved;
    const started = !!project.productionStarted;
    const delivered = !!project.delivered;
    const remaining = Math.max(0, project.episodes - (project.done || 0));
    return [
      { state: project.brief ? 'done' : 'active', count: project.brief ? '需求已录入' : '待补充创作需求' },
      { state: (project.scriptVersion || 1) > 1 ? 'done' : 'active', count: 'V' + (project.scriptVersion || 1) + ' 版剧本' },
      { state: approved ? 'done' : 'active', count: approved ? '已确认正式版本' : '等待人工审核' },
      { state: approved ? 'done' : 'queued', count: (project.shotCount || project.episodes * 8) + ' 个镜头单元' },
      { state: started ? 'done' : 'queued', count: assetCount + ' 项资产' },
      { state: started ? 'active' : 'queued', count: (project.done || 0) + ' / ' + project.episodes + ' 集' },
      { state: (project.done || 0) > 0 ? 'active' : 'queued', count: '待完成 ' + remaining + ' 集' },
      { state: delivered ? 'done' : 'queued', count: delivered ? '已归档' : '待最终审核' }
    ];
  }

  const STAGE_LABEL = { done: '已完成', active: '执行中', queued: '等待依赖' };
  const STATUS_TONE = { '已完成': 'green', '执行中': 'lime', '已暂停': 'red', '待开工': 'orange', '待排期': 'blue', '异常暂停': 'red', '待终审': 'orange', '待开工': 'blue' };
  const DAY = '2026-';

  function scopeProjects() {
    const tenantIds = App.availableTenants().map(t => t.id);
    const identity = App.identity();
    return DB.projects.filter(p => tenantIds.indexOf(p.tenant) > -1 && (DB.state.identity !== 'employee' || p.owner === identity.user));
  }

  function toISO(md) {
    if (!md) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(md)) return md;
    return DAY + String(md).replace(/[^\d-]/g, '').slice(0, 5);
  }

  function shortDate(iso) {
    if (!iso) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.slice(5).replace('-', '-');
    return iso;
  }

  function ensureScheduleId() {
    const n = DB.schedule.length + 1;
    return 'SC-' + String(1100 + n);
  }

  function scheduleForm(row) {
    const editing = !!row;
    const start = row ? toISO(String(row.window).split('→')[0].trim()) : DAY + '11-25';
    const end = row ? toISO(String(row.window).split('→')[1].trim()) : DAY + '11-27';
    return `<div class="form-grid">${UI.fField('集次范围', 'episodes', { value: row ? row.episodes : '', required: true, placeholder: '如 第 09–10 集', maxlength: 20 })}${UI.fSelect('生产环节', 'stage', [{ value: '', label: '请选择环节' }, { value: '视觉规划', label: '视觉规划' }, { value: '视频生产', label: '视频生产' }, { value: '音频合成', label: '音频合成' }, { value: '整集质检', label: '整集质检' }], { value: row ? row.stage : '', required: true })}${UI.fField('开始日期', 'start', { value: start, type: 'date', required: true })}${UI.fField('结束日期', 'end', { value: end, type: 'date', required: true, hint: '结束日期不得早于开始日期' })}${UI.fField('生产单元数', 'units', { value: row ? row.units : 16, type: 'number', min: 1, max: 200, required: true })}${UI.fSelect('负责能力', 'owner', [{ value: 'AI 导演 / 镜头组', label: 'AI 导演 / 镜头组' }, { value: 'AI 视觉组', label: 'AI 视觉组' }, { value: 'AI 音频组', label: 'AI 音频组' }, { value: 'AI 质检 / 人工终审', label: 'AI 质检 / 人工终审' }], { value: row ? row.owner : 'AI 导演 / 镜头组', required: true })}<label class="field-wrap full"><span class="field-label">排期备注</span><textarea class="field" name="note" rows="3" maxlength="120">${UI.esc(row ? row.note || '' : '')}</textarea><span class="field-error" hidden></span></label></div>`;
  }

  AppModule.register({
    group: 'pipeline',
    label: '06 / AI 自动生产',
    icon: '⌁',
    routes: [
      {
        path: 'pipeline/board',
        stage: 'shoot',
        order: 2,
        title: '排期总览',
        icon: '⌁',
        permission: 'pipeline',
        render(params) {
          const project = App.resolveProject(params ? params.get('id') : '');
          if (!project) {
            return UI.page('AI ORCHESTRATION / FLOW', '尚未选择项目', '请选择项目后查看生产调度和任务依赖。', '', `<div class="card">${UI.empty('没有可用项目', '当前身份没有可访问的项目。', UI.btn('返回项目中心', 'go:workspace/projects', 'btn-primary'))}</div>`);
          }
          const started = !!project.productionStarted;
          const assetCount = DB.assets.filter(a => a.tenant === project.tenant && a.project === project.id).length;
          const plan = stagePlan(project, assetCount);
          const stages = DB.stages.map((stage, index) => ({ stage: stage, plan: plan[index] }));
          const windows = DB.schedule.filter(r => r.project === project.id);
          const activeWindows = windows.filter(r => r.status === '执行中').length;

          return UI.page('AI ORCHESTRATION / FLOW', 'AI 自动生产流水线', '当前项目从剧本正式版本到镜头生产单元、音视频资产、质检与交付的自动依赖调度。', `<div class="head-actions">${UI.btn('拍摄排期', 'go:pipeline/schedule?id=' + project.id, 'btn')}${started ? UI.tag('生产已启动', 'green') : UI.btn('启动生产计划', 'production:start', 'btn-lime')}</div>`, `
    <div class="notice">AI 生产能力中心是系统执行能力，不是人工部门。生产状态、任务依赖和异常恢复均以当前项目为上下文；当前为演示状态。</div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">端到端生产阶段</div><div class="card-sub">当前项目：${UI.esc(project.title)} / ${UI.esc(project.id)}</div></div>${UI.tag(started ? '生产运行中' : project.status, started ? 'green' : 'orange')}</div><div class="pipeline">${stages.map((item, index) => `<div class="stage ${item.plan.state === 'done' ? 'done' : ''} ${item.plan.state === 'active' ? 'active' : ''}"><div class="stage-no">STAGE / 0${index + 1}</div><div class="stage-name">${UI.esc(item.stage.name)}</div><div class="stage-meta">${UI.esc(item.stage.desc)}</div><div class="stage-state">${UI.tag(STAGE_LABEL[item.plan.state], item.plan.state === 'done' ? 'green' : item.plan.state === 'active' ? 'lime' : '')}</div><div class="tiny muted stage-count">${UI.esc(item.plan.count)}</div></div>`).join('')}</div></div>
    <div class="grid grid-3 section-gap">${UI.metric('排期窗口', String(windows.length), '当前项目已登记集次窗口', '▤')}${UI.metric('执行中窗口', String(activeWindows), 'AI 生产单元运行中', '◌')}${UI.metric('异常阻塞', String(scopeProjects().filter(p => String(p.status).indexOf('异常') > -1).length), '需人工决策', '!')}</div>
    <div class="grid grid-2 section-gap"><div class="card"><div class="card-title">任务依赖关系</div><div class="timeline section-gap">${['正式剧本版本', '场次与镜头生产单元拆解', '人物 / 场景视觉参考锁定', '视频镜头生成与质检', '配音 / 配乐 / 字幕合成', '整集合成与质量检测', '人工最终审核与交付'].map((node, index) => {
            const ready = index < (started ? 4 : project.scriptApproved ? 3 : 1);
            return `<div class="timeline-item"><i class="timeline-dot ${ready ? 'done' : ''}" aria-hidden="true"></i><div><div class="timeline-title">${UI.esc(node)}</div><div class="timeline-meta">${ready ? '当前项目上游条件已满足' : '等待当前项目上游依赖'}</div></div></div>`;
          }).join('')}</div></div>
    <div class="card"><div class="card-title">项目资源与成本观察</div>${UI.kpi('计划集数', String(project.episodes))}${UI.kpi('已完成集数', String(project.done || 0))}${UI.kpi('当前累计成本', '¥' + (project.cost || 0).toLocaleString())}${UI.kpi('质量评分', project.quality ? project.quality + ' / 100' : '待检测')}<div class="notice warn section-gap">达到预算阈值或模型不可用时，系统应暂停受影响任务并通知员工决策，不静默超额消耗。</div></div></div>`);
        }
      },
      {
        path: 'pipeline/tasks',
        stage: 'shoot',
        order: 3,
        title: '生产任务台账',
        icon: '⌗',
        permission: 'pipeline',
        badge: function () {
          const project = App.project();
          if (!project) return '';
          const failed = (DB.productionTasks || []).filter(t => t.project === project.id && (t.status === '失败待重试' || t.status === '异常暂停')).length;
          return failed ? String(failed) : '';
        },
        render(params) {
          const project = App.resolveProject(params ? params.get('id') : '');
          if (!project) {
            return UI.page('AI ORCHESTRATION / TASKS', '尚未选择项目', '选择项目后查看 AI 生产任务、依赖、重试与实际成本。', '', `<div class="card">${UI.empty('没有可用项目', '当前身份没有可访问的项目。', UI.btn('返回项目中心', 'go:workspace/projects', 'btn-primary'))}</div>`);
          }
          const list = (DB.productionTasks || []).filter(t => t.project === project.id);
          const summary = App.taskSummary(project);
          const taskRows = list.map(t => `<tr data-row data-status="${UI.esc(t.status)}" data-search="${UI.esc(t.id)} ${UI.esc(t.stage)} ${UI.esc(t.capability)} ${UI.esc(t.model)} ${UI.esc(t.shot)}"><td class="mono">${UI.esc(t.id)}</td><td>第 ${t.episode} 集 · ${UI.esc(t.scene)}<div class="tiny muted mono">${UI.esc(t.shot)}</div></td><td>${UI.esc(t.stage)}<div class="tiny muted">${UI.esc(t.capability)}</div></td><td>${UI.esc(t.model)}<div class="tiny muted">备用 ${UI.esc(t.backup)}</div></td><td>${UI.tag(t.status, t.status === '已完成' ? 'green' : t.status === '执行中' ? 'lime' : t.status === '失败待重试' ? 'orange' : 'red')}</td><td class="mono">${t.attempt} / ${t.maxAttempts}</td><td class="mono">¥${(t.cost || 0).toLocaleString()}<div class="tiny muted">失败 ¥${(t.failedCost || 0).toLocaleString()}</div></td><td class="row-actions"><button type="button" class="btn btn-sm" data-action="task:view" data-id="${UI.esc(t.id)}">详情</button>${t.status === '失败待重试' || t.status === '异常暂停' ? `<button type="button" class="btn btn-sm btn-ghost" data-action="task:retry" data-id="${UI.esc(t.id)}">重试</button><button type="button" class="btn btn-sm btn-ghost" data-action="task:switch-model" data-id="${UI.esc(t.id)}">切备用</button>` : ''}${t.status === '执行中' ? `<button type="button" class="btn btn-sm btn-ghost" data-action="task:pause" data-id="${UI.esc(t.id)}">暂停</button>` : ''}</td></tr>`).join('');

          return UI.page('AI ORCHESTRATION / TASK LEDGER', 'AI 生产任务台账', '每个任务记录输入、输出、依赖、模型、执行状态、重试次数、实际成本与质检结果，失败不可伪装为成功。', `<div class="head-actions">${UI.btn('生产调度', 'go:pipeline/board?id=' + project.id, 'btn')}${UI.btn('导出任务台账', 'task:export', 'btn', { id: project.id })}</div>`, `
    <div class="notice">当前项目：${UI.esc(project.title)} / ${UI.esc(project.id)}。任务状态与成本为演示记录，用于验证调度与追溯交互，不代表真实模型调用。</div>
    <div class="grid grid-4 section-gap">${UI.metric('任务总数', String(summary.total), '当前项目台账', '⌗')}${UI.metric('执行中 / 已完成', summary.running + ' / ' + summary.done, '含并行任务', '◌')}${UI.metric('失败 / 异常暂停', summary.failed + ' / ' + summary.blocked, '需人工决策', '!')}${UI.metric('实际成本', '¥' + summary.cost.toLocaleString(), '失败成本 ¥' + summary.failedCost.toLocaleString(), '￥')}</div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">任务清单 · ${UI.esc(project.title)}</div><div class="card-sub">累计自动重试 ${summary.retries} 次 · 重试上限 ${DB.enterprise.policies.retryLimit} 次</div></div>${UI.tag(project.status, project.status === '异常中' ? 'red' : 'orange')}</div><div class="toolbar"><div class="toolbar-left"><b class="small">执行台账</b></div><div class="toolbar-right"><select class="field toolbar-select" data-row-filter="status" aria-label="按任务状态筛选"><option value="all">全部状态</option><option value="执行中">执行中</option><option value="已完成">已完成</option><option value="失败待重试">失败待重试</option><option value="异常暂停">异常暂停</option><option value="待执行">待执行</option></select><input class="search" data-filter placeholder="搜索任务 / 能力 / 模型 / 镜头"></div></div>${UI.table(['任务', '集次 / 场景', '阶段 / 能力', '模型', '状态', '重试', '成本', '操作'], taskRows, '当前项目暂无生产任务记录', UI.btn('清除筛选', 'filter:clear', 'btn-sm'))}</div>
    <div class="notice warn section-gap">失败任务会保留失败原因与失败成本；达到重试上限后必须转异常暂停并通知员工，不得自动无限重试。</div>`);
        }
      },
      {
        path: 'pipeline/exceptions',
        stage: 'shoot',
        order: 3,
        title: '异常处置',
        icon: '!',
        badge: function () {
          const count = scopeProjects().filter(p => String(p.status).indexOf('异常') > -1).length;
          return count ? String(count) : '';
        },
        permission: 'pipeline',
        render(params) {
          const selected = App.resolveProject(params ? params.get('id') : '');
          const candidates = scopeProjects().filter(p => String(p.status).indexOf('异常') > -1);
          const exceptionProject = selected && String(selected.status).indexOf('异常') > -1 ? selected : candidates[0];
          if (!exceptionProject) {
            return UI.page('AI ORCHESTRATION / EXCEPTIONS', '当前项目暂无待处置异常', '异常中心仅展示当前选择项目中需要人工决策的生产异常。', '', `<div class="card">${UI.empty('暂无待处置异常', '切换到存在异常状态的项目，或等待生产任务触发异常。', UI.btn('返回生产调度', 'go:pipeline/board', 'btn-primary'))}</div>`);
          }
          const exceptionTenant = DB.tenants.find(t => t.id === exceptionProject.tenant);
          const exceptionJobs = DB.postJobs.filter(j => j.project === exceptionProject.id && j.status === '异常暂停');
          const pausedWindows = DB.schedule.filter(s => s.project === exceptionProject.id && s.status === '已暂停');
          return UI.page('AI ORCHESTRATION / EXCEPTIONS', '生产异常处置', '只将必须人工决策的异常交给员工；恢复后由 AI 继续执行受影响任务。', UI.btn('返回生产调度', 'go:pipeline/board?id=' + exceptionProject.id, 'btn'), `
    <div class="grid grid-3">${UI.metric('异常项目', exceptionProject.title, '项目编号 ' + exceptionProject.id, '!')}${UI.metric('当前阶段', exceptionProject.stage || '待定位', '受影响任务已暂停', '↻')}${UI.metric('当前状态', exceptionProject.status, '等待人工决策', '✓')}</div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">异常事件 · ${UI.esc(exceptionProject.title)}</div><div class="card-sub mono">${UI.esc(exceptionProject.id)} / ${UI.esc(exceptionProject.stage || '生产任务')} · ${UI.esc(exceptionTenant ? exceptionTenant.name : '未知租户')}</div></div>${UI.tag(exceptionProject.exceptionResolved ? '已恢复' : '待人工处置', exceptionProject.exceptionResolved ? 'green' : 'red')}</div>
    <div class="grid grid-2"><div><div class="eyebrow">FAILURE CONTEXT</div><p class="prose">当前项目的生产阶段出现异常。系统应暂停受影响任务，保留已完成资产，并避免影响其他项目生产。</p>${UI.kpi('异常项目', UI.esc(exceptionProject.title))}${UI.kpi('失败节点', UI.esc(exceptionProject.stage || '待定位'))}${UI.kpi('影响集数', exceptionProject.episodes + ' 集计划')}${UI.kpi('暂停后期环节', exceptionJobs.length + ' 个')}${UI.kpi('暂停排期窗口', pausedWindows.length + ' 个')}</div>
    <div><div class="eyebrow">AVAILABLE DECISION</div><div class="callout"><div class="callout-icon" aria-hidden="true">↻</div><div><strong>选择恢复策略</strong><p>切换备用能力、降低并发或转人工处理；恢复动作只作用于当前项目。</p></div></div><div class="section-gap btn-row">${UI.btn(exceptionProject.exceptionResolved ? '任务已恢复' : '处理异常', 'exception:resolve', 'btn-lime', { id: exceptionProject.id })}${UI.btn('升级平台协查', 'exception:escalate', 'btn', { id: exceptionProject.id })}</div><div class="tiny muted section-gap">恢复前保留旧版本资产和生产记录，操作写入审计。</div></div></div></div>`);
        }
      },
      {
        path: 'pipeline/shots',
        stage: 'assets',
        title: '镜头与分镜',
        icon: '▧',
        permission: 'pipeline',
        render(params) {
          const project = App.resolveProject(params ? params.get('id') : '');
          if (!project) {
            return UI.page('AI DIRECTOR / SHOT UNITS', '尚未选择项目', '选择项目后查看其镜头生产单元。', '', `<div class="card">${UI.empty('没有可用项目', '当前身份没有可访问的项目。', UI.btn('返回项目中心', 'go:workspace/projects', 'btn-primary'))}</div>`);
          }
          const units = App.ensureShots(project);
          const total = project.shotCount || project.episodes * 8;
          const done = units.filter(u => u.status === '已完成').length;
          const pending = units.filter(u => u.status !== '已完成').length;
          const cards = units.map(u => `<article class="shot" data-row data-state="${u.status === '已完成' ? 'done' : 'pending'}" data-search="${UI.esc(u.title)} ${UI.esc(u.prompt)}"><div class="shot-art"><span>SHOT / ${UI.esc(project.id)} / ${String(u.no).padStart(2, '0')}</span>${UI.tag(u.status, STATUS_TONE[u.status] || 'blue')}</div><div class="shot-body"><div class="shot-title">${UI.esc(u.title)}</div><div class="shot-meta">${UI.esc(u.status === '已完成' ? '已完成 · 待最终抽检' : u.status === '生成中' ? 'AI 生成中…' : '等待上游任务与资源')} · ${u.duration}s</div><div class="btn-row section-gap"><button type="button" class="btn btn-sm" data-action="shot:view" data-id="${UI.esc(u.id)}">查看</button>${u.status === '已完成' ? '' : `<button type="button" class="btn btn-sm btn-ghost" data-action="shot:regen" data-id="${UI.esc(u.id)}">生成</button>`}</div></div></article>`).join('');

          return UI.page('AI DIRECTOR / SHOT UNITS', '镜头生产单元', 'Shot Unit 是导演规划与 AI 视频生产之间的核心业务对象。', `<div class="head-actions">${UI.btn('批量生成待生成镜头', 'shot:batch', 'btn-primary')}${UI.btn('查看生产调度', 'go:pipeline/board?id=' + project.id, 'btn')}</div>`, `
    <div class="grid grid-3">${UI.metric('当前项目', project.title, project.id, '▧')}${UI.metric('镜头总量', String(total), '按当前项目规划统计', '◌')}${UI.metric('已完成 / 待生成', done + ' / ' + pending, '展示前 ' + units.length + ' 个典型单元', '✓')}</div>
    <div class="card section-gap"><div class="toolbar"><div class="toolbar-left"><b class="small">镜头清单 · 当前项目</b><span class="tiny muted">展示前 ${units.length} 个典型单元</span></div><div class="toolbar-right"><select class="field toolbar-select" data-row-filter="state" aria-label="按镜头状态筛选"><option value="all">全部状态</option><option value="done">已完成</option><option value="pending">待生成</option></select><input class="search" data-filter placeholder="搜索镜头 / 场景"><button class="btn btn-sm" data-action="filter:clear">重置</button></div></div><div class="shot-grid">${cards}</div><div class="empty" data-empty-row hidden><div class="empty-icon" aria-hidden="true">◌</div><b>没有符合条件的镜头单元</b><p>调整筛选条件后重试。</p></div></div>`);
        }
      },
      {
        path: 'pipeline/schedule',
        stage: 'shoot',
        order: 1,
        title: '拍摄排期',
        icon: '▤',
        permission: 'pipeline',
        render(params) {
          const project = App.resolveProject(params ? params.get('id') : '');
          if (!project) {
            return UI.page('WORKFLOW / SHOOTING SCHEDULE', '尚未选择项目', '选择项目后查看按集次排定的生产窗口。', '', `<div class="card">${UI.empty('没有可用项目', '当前身份没有可访问的项目。', UI.btn('返回项目创建', 'go:workspace/projects', 'btn-primary'))}</div>`);
          }
          const rowsAll = DB.schedule.filter(r => r.project === project.id && r.tenant === project.tenant);
          const running = rowsAll.filter(r => r.status === '执行中').length;
          const waiting = rowsAll.filter(r => r.status === '待开工' || r.status === '待排期').length;
          const paused = rowsAll.filter(r => r.status === '已暂停').length;
          const rows = rowsAll.map(r => `<tr data-row data-status="${UI.esc(r.status)}" data-search="${UI.esc(r.episodes)} ${UI.esc(r.stage)} ${UI.esc(r.owner)}"><td class="mono">${UI.esc(r.id)}</td><td>${UI.esc(r.episodes)}</td><td>${UI.esc(r.stage)}</td><td class="mono">${UI.esc(r.window)}</td><td>${UI.esc(r.units)} 个单元</td><td>${UI.esc(r.owner)}</td><td>${UI.tag(r.status, r.status === '已完成' ? 'green' : r.status === '已暂停' ? 'red' : r.status === '执行中' ? 'lime' : 'orange')}</td><td class="row-actions"><button type="button" class="btn btn-sm" data-action="schedule:edit" data-id="${UI.esc(r.id)}">编辑</button>${r.status === '已完成' ? '' : r.status === '执行中' ? `<button type="button" class="btn btn-sm btn-ghost" data-action="schedule:pause" data-id="${UI.esc(r.id)}">暂停</button>` : r.status === '已暂停' ? `<button type="button" class="btn btn-sm" data-action="schedule:resume" data-id="${UI.esc(r.id)}">恢复</button>` : `<button type="button" class="btn btn-sm btn-ghost" data-action="schedule:start" data-id="${UI.esc(r.id)}">启动</button>`}<button type="button" class="btn btn-sm btn-ghost" data-action="schedule:delete" data-id="${UI.esc(r.id)}">删除</button></td></tr>`).join('');

          return UI.page('WORKFLOW / SHOOTING SCHEDULE', '拍摄排期', '按当前项目的集次窗口排定生产环节、AI 生产单元与负责能力，排期直接衔接镜头生产与后期制作。', `<div class="head-actions">${UI.btn('新增排期窗口', 'schedule:new', 'btn-primary', { id: project.id })}${UI.btn('查看排期总览', 'go:pipeline/board?id=' + project.id, 'btn')}</div>`, `
    <div class="grid grid-3">${UI.metric('排期条目', String(rowsAll.length), '当前项目已登记窗口', '▤')}${UI.metric('执行中', String(running), 'AI 单元正在生产', '◌')}${UI.metric('待开工 / 已暂停', waiting + ' / ' + paused, '依赖上游或等待处置', '!')}</div>
    <div class="notice section-gap">排期以“集次窗口”为单位，同一窗口内的镜头生产、音频与合成任务共享项目上下文；上游剧本或素材未就绪时，窗口状态保持待开工。</div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">集次排期 · ${UI.esc(project.title)}</div><div class="card-sub mono">${UI.esc(project.id)} · 计划 ${project.episodes} 集 / 已完成 ${project.done || 0} 集</div></div>${UI.btn('镜头与分镜', 'go:pipeline/shots?id=' + project.id, 'btn-sm')}</div>${rowsAll.length ? UI.table(['排期编号', '集次', '生产环节', '计划窗口', '生产单元', '负责能力', '状态', '操作'], rows, '当前项目暂无排期') : UI.empty('当前项目尚未排期', '剧本通过后系统按集次自动生成生产窗口；也可手动新增排期。', UI.btn('新增排期窗口', 'schedule:new', 'btn-sm btn-primary', { id: project.id }))}</div>`);
        }
      },
      {
        path: 'pipeline/quality',
        stage: 'post',
        order: 2,
        title: '质量检测中心',
        icon: '✳',
        permission: 'pipeline',
        badge: function () {
          const project = App.project();
          if (!project) return '';
          const q = App.qualitySummary(project);
          return (q.fail + q.warn) ? String(q.fail + q.warn) : '';
        },
        render(params) {
          const project = App.resolveProject(params ? params.get('id') : '');
          if (!project) {
            return UI.page('QUALITY / INDEPENDENT AUDIT', '尚未选择项目', '选择项目后查看十维质量检测记录。', '', `<div class="card">${UI.empty('没有可用项目', '当前身份没有可访问的项目。', UI.btn('返回项目中心', 'go:workspace/projects', 'btn-primary'))}</div>`);
          }
          const q = App.qualitySummary(project);
          const rows = q.rows.map(item => `<tr data-row data-status="${UI.esc(item.status)}" data-search="${UI.esc(item.dimension)} ${UI.esc(item.note)} ${UI.esc(item.target)}"><td><b>${UI.esc(item.dimension)}</b></td><td>${UI.tag(item.status, item.status === '通过' ? 'green' : item.status === '警告' ? 'orange' : item.status === '不合格' ? 'red' : item.status === '返工中' ? 'orange' : '')}</td><td class="mono">${item.score ? item.score + ' / 100' : '—'}</td><td>${item.issues || 0}</td><td>${UI.esc(item.note)}</td><td class="mono">${UI.esc(item.target)}</td><td class="mono">${UI.esc(item.task)}</td><td class="row-actions">${item.status === '通过' ? '<span class="tiny muted">已通过</span>' : `<button type="button" class="btn btn-sm" data-action="quality:recheck" data-id="${UI.esc(item.id)}">复检</button>`}${item.status === '警告' || item.status === '不合格' || item.status === '返工中' ? `<button type="button" class="btn btn-sm btn-ghost" data-action="quality:rework" data-id="${UI.esc(item.id)}">返工</button>` : ''}</td></tr>`).join('');

          return UI.page('QUALITY / INDEPENDENT AUDIT', '质量检测中心', '十维独立检查：剧本、合规、人物、场景、视频、表演、音频、字幕、剪辑与成片。质检不复用生成模型自评。', `<div class="head-actions">${UI.btn('生产任务台账', 'go:pipeline/tasks?id=' + project.id, 'btn')}${UI.btn('导出质量报告', 'quality:report', 'btn', { id: project.id })}</div>`, `
    <div class="notice">当前项目：${UI.esc(project.title)} / ${UI.esc(project.id)}。测试数据用于验证检查记录与返工定位，不代表真实 AI 质检结论。</div>
    <div class="grid grid-4 section-gap">${UI.metric('综合质量分', q.score ? q.score + ' / 100' : '待检测', '已检测维度平均分', '✳')}${UI.metric('通过维度', q.pass + ' / 10', '独立检查通过', '✓')}${UI.metric('警告 / 不合格', q.warn + ' / ' + q.fail, '需定位返工', '!')}${UI.metric('待检测', String(q.pending), '等待上游任务', '◌')}</div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">十维检查记录 · ${UI.esc(project.title)}</div><div class="card-sub">按镜头、对白、音频或制作任务定位问题，尽量只重生成受影响内容</div></div>${UI.tag(project.qualityState || '待检测', q.fail ? 'red' : q.warn ? 'orange' : q.pending ? '' : 'green')}</div><div class="toolbar"><div class="toolbar-left"><b class="small">检查项</b></div><div class="toolbar-right"><select class="field toolbar-select" data-row-filter="status" aria-label="按质检状态筛选"><option value="all">全部状态</option><option value="通过">通过</option><option value="警告">警告</option><option value="不合格">不合格</option><option value="待检测">待检测</option><option value="返工中">返工中</option></select><input class="search" data-filter placeholder="搜索维度 / 问题 / 定位对象"></div></div>${UI.table(['维度', '状态', '评分', '问题数', '检测结论', '定位对象', '关联任务', '操作'], rows, '没有符合条件的质量记录', UI.btn('清除筛选', 'filter:clear', 'btn-sm'))}</div>
    <div class="grid grid-2 section-gap"><div class="card"><div class="card-title">质检原则</div><p class="prose">质量检查不能完全依赖生成该内容的同一模型自我评价。每个维度保留检查能力、评分、问题数量、定位对象与关联任务，不合格时只重生产受影响镜头、对白、音频或整集。</p><div class="notice warn section-gap">质量问题不会因人工终审通过而自动关闭；返工完成需重新复检并更新质量报告。</div></div><div class="card"><div class="card-title">质量报告构成</div>${UI.kpi('十维检查记录', '10 项')}${UI.kpi('综合评分', q.score ? q.score + ' / 100' : '待检测')}${UI.kpi('未关闭问题', String(q.warn + q.fail))}${UI.kpi('报告版本', 'QC-' + project.id.replace('SP-', '') + ' / V1')}<div class="tiny muted section-gap">导出报告包含维度、状态、评分、问题、定位对象与关联生产任务。</div></div></div>`);
        }
      },
      {
        path: 'pipeline/post',
        stage: 'post',
        title: '后期制作',
        icon: '♫',
        permission: 'pipeline',
        render(params) {
          const project = App.resolveProject(params ? params.get('id') : '');
          if (!project) {
            return UI.page('WORKFLOW / POST PRODUCTION', '尚未选择项目', '选择项目后查看配音、字幕、剪辑与合成环节。', '', `<div class="card">${UI.empty('没有可用项目', '当前身份没有可访问的项目。', UI.btn('返回项目创建', 'go:workspace/projects', 'btn-primary'))}</div>`);
          }
          const jobs = DB.postJobs.filter(j => j.project === project.id && j.tenant === project.tenant);
          const done = jobs.filter(j => j.status === '已完成').length;
          const working = jobs.filter(j => j.status === '执行中').length;
          const blocked = jobs.filter(j => j.status === '异常暂停').length;
          const rows = jobs.map(j => {
            const canStart = j.status === '待开工' || j.status === '异常暂停';
            return `<tr data-row data-status="${UI.esc(j.status)}" data-search="${UI.esc(j.item)} ${UI.esc(j.owner)}"><td>${UI.esc(j.item)}</td><td>${UI.tag(j.status, j.status === '已完成' ? 'green' : j.status === '异常暂停' ? 'red' : j.status === '执行中' ? 'lime' : j.status === '待终审' ? 'orange' : 'blue')}</td><td>${UI.esc(j.owner)}</td><td class="muted mono">${UI.esc(j.updated)}</td><td class="row-actions">${canStart ? `<button type="button" class="btn btn-sm" data-action="post:retry" data-id="${UI.esc(j.item)}">${j.status === '异常暂停' ? '重试' : '启动'}</button>` : ''}<button type="button" class="btn btn-sm btn-ghost" data-action="post:view" data-id="${UI.esc(j.item)}">详情</button></td></tr>`;
          }).join('');
          const allDone = jobs.length > 0 && jobs.every(j => j.status === '已完成' || j.status === '待终审');
          const pendingCount = jobs.filter(j => j.status === '待开工' || j.status === '异常暂停').length;

          return UI.page('WORKFLOW / POST PRODUCTION', '后期制作', '配音、字幕、剪辑、调色、混音与整集合成环节，完成后进入成片终审；异常环节回到异常处置。', `<div class="head-actions">${pendingCount ? UI.btn('启动待开工环节', 'post:start', 'btn-primary') : ''}${UI.btn('进入成片终审', 'go:delivery/review?id=' + project.id, allDone ? 'btn-lime' : 'btn')}</div>`, `
    <div class="grid grid-3">${UI.metric('后期环节', String(jobs.length), '当前项目登记环节', '♫')}${UI.metric('已完成 / 进行中', done + ' / ' + working, '按当前环节状态统计', '✓')}${UI.metric('异常阻塞', String(blocked), '需人工选择恢复策略', '!')}</div>
    ${blocked ? `<div class="notice warn section-gap">当前项目存在 ${blocked} 个后期环节异常暂停，恢复后才能继续整集合成。${UI.btn('前往异常处置', 'go:pipeline/exceptions?id=' + project.id, 'btn-sm btn-primary')}</div>` : ''}
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">后期任务 · ${UI.esc(project.title)}</div><div class="card-sub">${allDone ? '全部环节已完成，可提交成片终审' : '按环节顺序推进，异常环节优先处置'}</div></div>${UI.tag(allDone ? '可提交终审' : '制作中', allDone ? 'green' : 'orange')}</div>${jobs.length ? UI.table(['后期环节', '状态', '执行方', '更新时间', '操作'], rows, '当前项目暂无后期任务') : UI.empty('当前项目尚未进入后期制作', '完成镜头生产后，系统按项目自动创建配音、字幕与合成任务。', UI.btn('查看拍摄排期', 'go:pipeline/schedule?id=' + project.id, 'btn-sm'))}</div>`);
        }
      }
    ]
  });

  /* ---------- 异常处置 ---------- */
  App.onAction('exception:resolve', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id) || App.project();
    if (!project || String(project.status).indexOf('异常') === -1) { App.toast('当前项目没有待处置的生产异常', 'error'); return; }
    App.modal('选择异常恢复策略', `<div class="notice">恢复动作只作用于当前项目，已完成资产与生产记录保留。</div><div class="form-grid section-gap">${UI.fSelect('恢复策略', 'strategy', [{ value: '切换备用模型', label: '切换备用模型' }, { value: '降低并发配额', label: '降低并发配额' }, { value: '转人工处理', label: '转人工处理' }], { required: true })}<label class="field-wrap full"><span class="field-label">处置说明<i class="req" aria-hidden="true">*</i></span><textarea class="field" name="note" rows="3" required minlength="5" maxlength="160" data-msg="请填写至少 5 个字符的处置说明"></textarea><span class="field-error" hidden></span></label></div>`, '确认恢复', 'exception:resolve-submit', { subtitle: project.title + ' / ' + project.id });
    App.exceptionProjectId = project.id;
  });

  App.onSubmit('exception:resolve-submit', (form, app) => {
    const project = DB.projects.find(p => p.id === app.exceptionProjectId);
    if (!project) { app.toast('项目不存在，请刷新后重试', 'error'); return false; }
    const note = String(form.get('note') || '').trim();
    if (note.length < 5) { app.toast('请填写至少 5 个字符的处置说明', 'error'); return false; }
    app.closeModal();
    app.runAction(null, () => {
      app.resolveException(String(form.get('strategy') || '切换备用模型'), note);
    }, { delay: 200 });
    return true;
  });

  App.onAction('exception:escalate', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id) || App.project();
    if (!project) { return; }
    App.confirm('升级平台协查', '将异常升级到平台运维协查，当前项目任务保持暂停直到处置完成。', '确认升级', () => {
      App.logAudit('升级异常至平台协查', project.title + ' / ' + (project.stage || '生产任务'), '待处置', '生产');
      App.toast('已通知平台运维协查，异常保持待处置', 'warning', '已升级');
    }, { details: [{ key: '项目', value: project.title }, { key: '阶段', value: project.stage || '—' }, { key: '当前状态', value: project.status }] });
  });

  /* ---------- 镜头单元 ---------- */
  App.onAction('shot:view', trigger => {
    const shot = (DB.shots || []).find(s => s.id === trigger.dataset.id);
    if (!shot) { App.toast('镜头单元不存在', 'error'); return; }
    App.drawer('镜头单元 · ' + shot.title, `<div class="mono tiny muted">${UI.esc(shot.id)}</div><div class="grid grid-2 section-gap">${UI.kpi('状态', UI.tag(shot.status, STATUS_TONE[shot.status] || 'blue'))}${UI.kpi('时长', shot.duration + ' 秒')}${UI.kpi('所属项目', UI.esc(shot.project))}${UI.kpi('更新时间', UI.esc(shot.updated))}</div><div class="notice section-gap">${UI.esc(shot.prompt)}</div><div class="section-gap">${shot.status === '已完成' ? '' : UI.btn('重新生成该镜头', 'shot:regen', 'btn-lime', { id: shot.id })}</div>`, { subtitle: '生成参数与状态追溯', footer: UI.btn('关闭', 'overlay:close', 'btn') });
  });

  App.onAction('shot:regen', trigger => {
    const shot = (DB.shots || []).find(s => s.id === trigger.dataset.id);
    if (!shot) { App.toast('镜头单元不存在', 'error'); return; }
    if (shot.status === '生成中') { App.toast('该镜头正在生成中，请稍候', 'info'); return; }
    App.closeOverlay();
    App.runAction(trigger, () => {
      shot.status = '生成中';
      App.save();
      App.renderRoute();
      App.toast('镜头 ' + shot.id + ' 已提交生成，完成后自动更新状态', 'info', '任务已提交');
      window.setTimeout(() => {
        shot.status = '已完成';
        shot.updated = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        App.logAudit('完成镜头生成', shot.project + ' / ' + shot.id, '成功', '生产');
        App.save();
        if (App.current && App.current.path === 'pipeline/shots') App.renderRoute();
      }, 2200);
    }, { loading: '提交生成…', delay: 400 });
  });

  App.onAction('shot:batch', trigger => {
    const project = App.project();
    if (!project) { App.toast('请先选择项目', 'error'); return; }
    const pending = (DB.shots || []).filter(s => s.project === project.id && s.status !== '已完成' && s.status !== '生成中');
    if (!pending.length) { App.toast('当前项目没有待生成的镜头单元', 'info'); return; }
    App.confirm('批量生成镜头单元', '将为当前项目 ' + pending.length + ' 个待生成单元提交 AI 视频生成任务。', '提交 ' + pending.length + ' 个任务', () => {
      pending.forEach(s => { s.status = '生成中'; });
      App.logAudit('批量提交镜头生成', project.title + ' / ' + pending.length + ' 个单元', '待处置', '生产');
      App.save();
      App.renderRoute();
      App.toast('已提交 ' + pending.length + ' 个镜头生成任务', 'success', '任务已提交');
      window.setTimeout(() => {
        pending.forEach(s => { s.status = '已完成'; s.updated = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); });
        App.save();
        if (App.current && App.current.path === 'pipeline/shots') App.renderRoute();
        App.toast('镜头生成任务已完成 ' + pending.length + ' 个', 'success', '生成完成');
      }, 2600);
    }, { details: [{ key: '项目', value: project.title }, { key: '待生成单元', value: String(pending.length) }, { key: '预计耗时', value: '约 3 分钟（演示）' }] });
  });

  /* ---------- 拍摄排期 ---------- */
  App.onAction('schedule:new', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id) || App.project();
    if (!project) { App.toast('请先选择项目', 'error'); return; }
    App.scheduleProjectId = project.id;
    App.editingScheduleId = null;
    App.modal('新增排期窗口 · ' + project.title, scheduleForm(null), '保存排期', 'schedule:save', { subtitle: project.id + ' · 按集次窗口排定', wide: true });
  });

  App.onAction('schedule:edit', trigger => {
    const row = DB.schedule.find(s => s.id === trigger.dataset.id);
    if (!row) { App.toast('排期记录不存在', 'error'); return; }
    App.editingScheduleId = row.id;
    App.scheduleProjectId = row.project;
    App.modal('编辑排期窗口 · ' + row.id, scheduleForm(row), '保存修改', 'schedule:save', { subtitle: row.episodes + ' · ' + row.stage, wide: true });
  });

  App.onSubmit('schedule:save', (form) => {
    const project = DB.projects.find(p => p.id === App.scheduleProjectId);
    if (!project) { App.toast('项目上下文已失效，请刷新重试', 'error'); return false; }
    const start = String(form.get('start') || '');
    const end = String(form.get('end') || '');
    if (start && end && start > end) { App.toast('结束日期不得早于开始日期', 'error'); return false; }
    const payload = {
      episodes: String(form.get('episodes') || '').trim(),
      stage: String(form.get('stage') || ''),
      window: shortDate(start) + ' → ' + shortDate(end),
      units: Math.max(1, Number(form.get('units') || 1)),
      owner: String(form.get('owner') || ''),
      note: String(form.get('note') || '')
    };
    if (!payload.episodes || !payload.stage) { App.toast('请填写集次范围并选择生产环节', 'error'); return false; }
    if (App.editingScheduleId) {
      const target = DB.schedule.find(s => s.id === App.editingScheduleId);
      if (!target) { App.toast('排期记录不存在', 'error'); return false; }
      Object.assign(target, payload);
      App.logAudit('更新拍摄排期', project.title + ' / ' + target.id + ' ' + target.episodes, '成功', '生产');
      App.toast('排期窗口已更新', 'success', '保存成功');
    } else {
      if (project.scriptApproved === false) { App.toast('剧本尚未审核通过，不能新增拍摄排期', 'error'); return false; }
      DB.schedule.push(Object.assign({ id: ensureScheduleId(), project: project.id, tenant: project.tenant, status: '待开工' }, payload));
      App.logAudit('新增拍摄排期', project.title + ' / ' + payload.episodes, '成功', '生产');
      App.toast('新的排期窗口已创建，状态为待开工', 'success', '排期已创建');
    }
    App.save();
    App.closeModal();
    App.renderRoute();
    return true;
  });

  function setScheduleStatus(trigger, next, message) {
    const row = DB.schedule.find(s => s.id === trigger.dataset.id);
    if (!row) { App.toast('排期记录不存在', 'error'); return; }
    row.status = next;
    App.logAudit('更新排期状态为' + next, row.id + ' / ' + row.episodes, '成功', '生产');
    App.save();
    App.renderRoute();
    App.toast(message, 'success', '状态已更新');
  }

  App.onAction('schedule:start', trigger => setScheduleStatus(trigger, '执行中', '排期窗口已启动，AI 生产单元开始执行'));
  App.onAction('schedule:resume', trigger => setScheduleStatus(trigger, '执行中', '排期窗口已恢复执行'));
  App.onAction('schedule:pause', trigger => {
    App.confirm('暂停排期窗口', '暂停后该窗口内未完成的生产单元停止调度，已生成资产保留。', '确认暂停', () => setScheduleStatus(trigger, '已暂停', '排期窗口已暂停'), { details: [{ key: '排期编号', value: trigger.dataset.id }] });
  });
  App.onAction('schedule:delete', trigger => {
    const row = DB.schedule.find(s => s.id === trigger.dataset.id);
    if (!row) { App.toast('排期记录不存在', 'error'); return; }
    App.confirm('删除排期窗口', '删除后该窗口不再参与生产调度，历史审计仍保留。', '确认删除', () => {
      DB.schedule = DB.schedule.filter(s => s.id !== row.id);
      App.logAudit('删除拍摄排期', row.id + ' / ' + row.episodes, '成功', '生产');
      App.save();
      App.renderRoute();
      App.toast('排期窗口已删除', 'success', '已删除');
    }, { details: [{ key: '排期编号', value: row.id }, { key: '集次', value: row.episodes }, { key: '状态', value: row.status }], danger: true });
  });

  /* ---------- 质量检测 ---------- */
  function qualityOf(trigger) {
    return (DB.qualityChecks || []).find(q => q.id === trigger.dataset.id);
  }

  App.onAction('quality:recheck', trigger => {
    const item = qualityOf(trigger);
    if (!item) { App.toast('质量检查记录不存在', 'error'); return; }
    const project = DB.projects.find(p => p.id === item.project);
    if (!project) { return; }
    App.runAction(trigger, () => {
      item.status = '通过';
      item.score = 93;
      item.issues = 0;
      item.note = '独立检查能力复检通过，问题已关闭';
      const q = App.qualitySummary(project);
      project.quality = q.score;
      project.qualityState = q.fail ? '待返工' : q.warn ? '部分待复检' : '已通过';
      project.updated = '刚刚';
      App.logAudit('执行质量复检', project.title + ' / ' + item.dimension + ' · ' + item.target, '成功', '生产');
      App.save();
      App.renderRoute();
      App.toast(item.dimension + ' 复检通过', 'success', '质量已更新');
    }, { loading: '执行独立复检…', delay: 800 });
  });

  App.onAction('quality:rework', trigger => {
    const item = qualityOf(trigger);
    if (!item) { App.toast('质量检查记录不存在', 'error'); return; }
    const project = DB.projects.find(p => p.id === item.project);
    if (!project) { return; }
    App.confirm('发起局部返工 · ' + item.dimension, '仅重生产定位对象 ' + item.target + '，保留其他已合格内容；返工完成后需重新执行该维度复检。', '确认发起返工', () => {
      const existing = (DB.productionTasks || []).find(t => t.project === project.id && t.quality === 0 && t.input && t.input.indexOf(item.target) > -1);
      if (!existing) {
        DB.productionTasks.unshift({
          id: 'PT-' + project.id.replace('SP-', '') + '-R' + String((DB.productionTasks || []).length + 1),
          project: project.id,
          tenant: project.tenant,
          stage: '局部返工',
          episode: Number(String(item.target).replace(/[^\d]/g, '').slice(0, 2)) || 1,
          scene: item.dimension + ' 问题返工',
          shot: item.target,
          capability: item.dimension === '音频质量' ? '语音生成' : item.dimension === '字幕质量' ? '语音识别' : '视频生成',
          status: '待执行',
          model: 'Motion Forge 2',
          backup: 'Motion Forge 1',
          attempt: 0,
          maxAttempts: DB.enterprise.policies.retryLimit,
          cost: 0,
          failedCost: 0,
          failure: '',
          dependsOn: item.task && item.task !== '—' ? [item.task] : [],
          input: item.target + ' / 已锁定参考资产',
          output: '返工候选素材',
          startedAt: '',
          finishedAt: '',
          quality: 0
        });
      }
      item.status = '返工中';
      item.note = '已发起局部返工，完成前保持未关闭';
      project.qualityState = '待返工';
      App.logAudit('发起局部返工', project.title + ' / ' + item.dimension + ' / ' + item.target, '待处置', '生产');
      App.save();
      App.renderRoute();
      App.toast('已创建局部返工任务，仅处理 ' + item.target, 'success', '返工已发起');
    }, { details: [{ key: '维度', value: item.dimension }, { key: '定位对象', value: item.target }, { key: '关联任务', value: item.task || '—' }], note: '不会整剧重做。' });
  });

  App.onAction('quality:report', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id) || App.project();
    if (!project) { return; }
    App.runAction(trigger, () => {
      const q = App.qualitySummary(project);
      const rows = q.rows.map(item => [item.dimension, item.status, item.score || 0, item.issues || 0, item.note, item.target, item.task]);
      App.download(project.title + '_质量报告_QC-' + project.id.replace('SP-', '') + '.csv', App.toCSV(['维度', '状态', '评分', '问题数', '检测结论', '定位对象', '关联任务'], rows), 'text/csv;charset=utf-8');
      App.logAudit('导出质量报告', project.title + ' / 综合分 ' + q.score, '成功', '生产');
    }, { loading: '生成质量报告…', delay: 600 });
  });

  /* ---------- 生产任务台账 ---------- */
  function taskOf(trigger) {
    return (DB.productionTasks || []).find(t => t.id === trigger.dataset.id);
  }

  App.onAction('task:view', trigger => {
    const task = taskOf(trigger);
    if (!task) { App.toast('生产任务不存在', 'error'); return; }
    const project = DB.projects.find(p => p.id === task.project);
    App.drawer('生产任务 · ' + task.id, `<div class="grid grid-2">${UI.kpi('所属项目', UI.esc(project ? project.title : task.project))}${UI.kpi('集次 / 场景', '第 ' + task.episode + ' 集 · ' + UI.esc(task.scene))}${UI.kpi('镜头单元', UI.esc(task.shot))}${UI.kpi('阶段 / 能力', UI.esc(task.stage) + ' / ' + UI.esc(task.capability))}${UI.kpi('当前模型', UI.esc(task.model))}${UI.kpi('备用模型', UI.esc(task.backup))}${UI.kpi('执行状态', UI.tag(task.status, task.status === '已完成' ? 'green' : task.status === '执行中' ? 'lime' : task.status === '失败待重试' ? 'orange' : 'red'))}${UI.kpi('重试次数', task.attempt + ' / ' + task.maxAttempts)}${UI.kpi('实际成本', '¥' + (task.cost || 0).toLocaleString())}${UI.kpi('失败成本', '¥' + (task.failedCost || 0).toLocaleString())}${UI.kpi('质量结果', task.quality ? task.quality + ' / 100' : '未检测')}${UI.kpi('前置依赖', UI.esc((task.dependsOn || []).join('、') || '无'))}</div><div class="section-gap"><div class="card-title">输入与输出</div>${UI.kpi('输入资产', UI.esc(task.input || '—'))}${UI.kpi('输出资产', UI.esc(task.output || '—'))}${UI.kpi('开始 / 完成', UI.esc(task.startedAt || '—') + ' → ' + UI.esc(task.finishedAt || '执行中'))}</div>${task.failure ? `<div class="notice warn section-gap"><b>失败原因：</b>${UI.esc(task.failure)}。系统保留失败成本与尝试次数，重试前需确认模型与提示词策略。</div>` : ''}<div class="notice section-gap">任务记录用于追溯企业、员工、项目、镜头、模型、成本与质检结果；演示数据不代表真实模型调用。</div>`, { subtitle: task.project, footer: UI.btn('关闭', 'overlay:close', 'btn') });
  });

  App.onAction('task:retry', trigger => {
    const task = taskOf(trigger);
    if (!task) { App.toast('生产任务不存在', 'error'); return; }
    if (task.status !== '失败待重试' && task.status !== '异常暂停') { App.toast('仅失败或异常暂停任务可以重试', 'info'); return; }
    if ((task.attempt || 0) >= (task.maxAttempts || 3)) {
      task.status = '异常暂停';
      App.logAudit('任务达到重试上限', task.id + ' / ' + task.failure, '待处置', '生产');
      App.save();
      App.renderRoute();
      App.toast('任务已达重试上限，转为异常暂停并等待人工决策', 'warning', '需要处置');
      return;
    }
    App.runAction(trigger, () => {
      task.attempt = (task.attempt || 0) + 1;
      task.cost = (task.cost || 0) + 10;
      task.status = '执行中';
      task.startedAt = '刚刚';
      App.logAudit('重试生产任务', task.id + ' 第 ' + task.attempt + ' 次', '待处置', '生产');
      App.save();
      App.renderRoute();
      App.toast('任务 ' + task.id + ' 已重新提交（第 ' + task.attempt + ' 次）', 'info', '已提交');
      window.setTimeout(() => {
        task.status = '已完成';
        task.quality = 90;
        task.finishedAt = '刚刚';
        task.failure = '';
        App.save();
        if (App.current && App.current.path === 'pipeline/tasks') App.renderRoute();
        App.toast('任务 ' + task.id + ' 重试完成，质量检测通过', 'success', '已完成');
      }, 1600);
    }, { loading: '重新提交任务…', delay: 400 });
  });

  App.onAction('task:switch-model', trigger => {
    const task = taskOf(trigger);
    if (!task) { App.toast('生产任务不存在', 'error'); return; }
    if (!task.backup || task.backup === '—') { App.toast('该任务没有可用备用模型', 'error', '无法切换'); return; }
    App.confirm('切换备用模型 · ' + task.id, '切换到 ' + task.backup + ' 后重新执行当前任务，失败成本与历史尝试保留。', '确认切换', () => {
      const old = task.model;
      task.model = task.backup;
      task.backup = '同类备用模型自动切换';
      task.status = '执行中';
      task.attempt = (task.attempt || 0) + 1;
      task.cost = (task.cost || 0) + 8;
      task.startedAt = '刚刚';
      App.logAudit('切换备用模型', task.id + ' / ' + old + ' → ' + task.model, '待处置', '生产');
      App.save();
      App.renderRoute();
      App.toast('任务已切换至 ' + task.model + ' 并重新执行', 'success', '模型已切换');
      window.setTimeout(() => {
        task.status = '已完成';
        task.quality = 91;
        task.finishedAt = '刚刚';
        task.failure = '';
        App.save();
        if (App.current && App.current.path === 'pipeline/tasks') App.renderRoute();
        App.toast('备用模型执行完成', 'success', '已完成');
      }, 1800);
    }, { details: [{ key: '任务', value: task.id }, { key: '原模型', value: task.model }, { key: '备用模型', value: task.backup }] });
  });

  App.onAction('task:pause', trigger => {
    const task = taskOf(trigger);
    if (!task) { return; }
    App.confirm('暂停生产任务 · ' + task.id, '暂停后该任务停止消耗资源，已生成内容保留，可在任务台账中恢复。', '确认暂停', () => {
      task.status = '异常暂停';
      task.finishedAt = '刚刚';
      App.logAudit('暂停生产任务', task.id + ' / ' + task.capability, '待处置', '生产');
      App.save();
      App.renderRoute();
      App.toast('任务已暂停，等待人工决策', 'warning', '已暂停');
    }, { danger: true });
  });

  App.onAction('task:export', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id) || App.project();
    if (!project) { return; }
    App.runAction(trigger, () => {
      const rows = (DB.productionTasks || []).filter(t => t.project === project.id).map(t => [t.id, t.episode, t.scene, t.shot, t.stage, t.capability, t.model, t.backup, t.status, t.attempt + '/' + t.maxAttempts, t.cost, t.failedCost, t.failure || '—', t.quality || 0]);
      App.download(project.title + '_生产任务台账.csv', App.toCSV(['任务', '集数', '场景', '镜头', '阶段', '能力', '模型', '备用', '状态', '重试', '实际成本', '失败成本', '失败原因', '质检分'], rows), 'text/csv;charset=utf-8');
      App.logAudit('导出生产任务台账', project.title + ' / ' + rows.length + ' 条', '成功', '生产');
    }, { loading: '生成任务台账…', delay: 600 });
  });

  /* ---------- 后期制作 ---------- */
  App.onAction('post:start', trigger => {
    const project = App.project();
    if (!project) { App.toast('请先选择项目', 'error'); return; }
    const pending = DB.postJobs.filter(j => j.project === project.id && (j.status === '待开工' || j.status === '异常暂停'));
    if (!pending.length) { App.toast('当前没有待启动的后期环节', 'info'); return; }
    App.confirm('启动后期制作', '将依次启动当前项目 ' + pending.length + ' 个待开工环节，异常环节会切换备用能力。', '启动 ' + pending.length + ' 个环节', () => {
      pending.forEach(j => { j.status = '执行中'; j.updated = '刚刚'; j.attempts = (j.attempts || 0) + 1; });
      App.logAudit('启动后期制作流水线', project.title + ' / ' + pending.length + ' 个环节', '待处置', '生产');
      App.save();
      App.renderRoute();
      App.toast('已启动 ' + pending.length + ' 个后期环节', 'success', '已启动');
      window.setTimeout(() => {
        pending.forEach(j => { j.status = '已完成'; j.updated = '刚刚'; });
        App.save();
        if (App.current && App.current.path === 'pipeline/post') App.renderRoute();
        App.toast('后期环节已完成，可提交成片终审', 'success', '后期完成');
      }, 2400);
    }, { details: [{ key: '项目', value: project.title }, { key: '待启动', value: String(pending.length) }, { key: '异常环节', value: String(DB.postJobs.filter(j => j.project === project.id && j.status === '异常暂停').length) }] });
  });

  App.onAction('post:retry', trigger => {
    const job = DB.postJobs.find(j => j.project === (App.project() || {}).id && j.item === trigger.dataset.id);
    if (!job) { App.toast('后期环节不存在', 'error'); return; }
    App.runAction(trigger, () => {
      job.status = '执行中';
      job.attempts = (job.attempts || 0) + 1;
      job.updated = '刚刚';
      App.logAudit('重试后期环节', job.project + ' / ' + job.item + ' 第 ' + job.attempts + ' 次', '待处置', '生产');
      App.save();
      App.renderRoute();
      App.toast('「' + job.item + '」已重新提交，执行中', 'info', '任务已提交');
      window.setTimeout(() => {
        job.status = '已完成';
        job.updated = '刚刚';
        App.save();
        if (App.current && App.current.path === 'pipeline/post') App.renderRoute();
      }, 2000);
    }, { loading: '提交中…', delay: 400 });
  });

  App.onAction('post:view', trigger => {
    const project = App.project();
    const job = DB.postJobs.find(j => j.project === project.id && j.item === trigger.dataset.id);
    if (!job) { return; }
    App.drawer('后期环节 · ' + job.item, `<div class="grid grid-2">${UI.kpi('状态', UI.tag(job.status, STATUS_TONE[job.status] || 'blue'))}${UI.kpi('执行方', UI.esc(job.owner))}${UI.kpi('更新时间', UI.esc(job.updated))}${UI.kpi('尝试次数', String(job.attempts || 1))}</div><div class="notice section-gap">该环节由 AI 后期能力执行，异常时保留已完成片段并等待处置。</div>`, { subtitle: project.title, footer: UI.btn('关闭', 'overlay:close', 'btn') });
  });
})();
