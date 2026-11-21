/* 模块：项目工作区（workspace）— 项目中心与项目档案 */
(function () {
  function statusTone(status) {
    if (status === '已交付') return 'green';
    if (status === '已归档') return '';
    if (String(status).indexOf('异常') > -1) return 'red';
    if (String(status).indexOf('审核') > -1) return 'orange';
    return 'blue';
  }

  const TIMELINE = [
    { title: '创意策划与剧本', meta: 'AI 自动生产 / 系统记录' },
    { title: '人工剧本审核', meta: '人工审核节点 A' },
    { title: '导演分镜与视觉设计', meta: 'AI 自动生产 / 系统记录' },
    { title: '视频镜头生产', meta: 'AI 自动生产 / 系统记录' },
    { title: '音频与后期合成', meta: 'AI 自动生产 / 系统记录' },
    { title: 'AI 质检与人工终审', meta: '人工审核节点 B' },
    { title: '正式交付与归档', meta: '交付记录与审计留痕' }
  ];

  function reachedStep(project) {
    if (project.delivered) return 7;
    if (project.finalApproved) return 6;
    if (project.productionStarted) return 5;
    if (project.scriptApproved) return 3;
    return 1;
  }

  function projectForm(p, mode) {
    const isNew = mode === 'new';
    return `<div class="form-grid">${UI.fField('项目名称', 'title', { value: p ? p.title : '', required: true, minlength: 2, maxlength: 30 })}${UI.fSelect('题材方向', 'genre', [{ value: '', label: '请选择题材' }, { value: '都市 / 情感', label: '都市 / 情感' }, { value: '悬疑 / 反转', label: '悬疑 / 反转' }, { value: '古装 / 爱情', label: '古装 / 爱情' }, { value: '现实 / 成长', label: '现实 / 成长' }], { value: p ? p.genre : '', required: true })}${UI.fField('计划集数', 'episodes', { value: p ? p.episodes : 12, type: 'number', min: 1, max: 100, required: true, readonly: !isNew })}${UI.fField('单集时长（分钟）', 'duration', { value: p ? (p.duration || 2) : 2, type: 'number', min: 1, max: 15, required: true })}${UI.fField('计划预算（元）', 'budget', { value: p ? (p.budget || 0) : 30000, type: 'number', min: 0, step: 1000 })}${UI.fField('截止日期', 'deadline', { value: p ? (p.deadline || '') : '', type: 'date' })}${UI.fSelect('优先级', 'priority', [{ value: '普通', label: '普通' }, { value: '高', label: '高' }, { value: '紧急', label: '紧急' }], { value: p ? (p.priority || '普通') : '普通' })}${UI.fField('项目归属', 'tenantName', { value: p ? (DB.tenants.find(t => t.id === p.tenant) || {}).name || '当前租户' : App.tenantName(), readonly: true })}<label class="field-wrap full"><span class="field-label">创作目标</span><textarea class="field" name="brief" rows="4" maxlength="500" placeholder="题材、核心冲突、人物关系、受众与风格偏好">${UI.esc(p ? p.brief || '' : '')}</textarea><span class="field-error" hidden></span></label></div>`;
  }

  AppModule.register({
    group: 'workspace',
    label: '04 / 项目工作区',
    icon: '▣',
    routes: [
      {
        path: 'workspace/projects',
        stage: 'project',
        title: '项目创建',
        icon: '▣',
        permission: 'workspace',
        render() {
          const projects = App.accessibleProjects();
          const statuses = Array.from(new Set(projects.map(p => p.status)));
          const statusOptions = statuses.map(s => `<option value="${UI.esc(s)}">${UI.esc(s)}</option>`).join('');
          const rows = projects.map(p => {
            const pct = Math.round((p.done || 0) / Math.max(p.episodes || 1, 1) * 100);
            const archived = !!p.archived || p.status === '已归档';
            return `<tr data-row data-status="${UI.esc(p.status)}" data-search="${UI.esc(p.title)} ${UI.esc(p.id)} ${UI.esc(p.owner)} ${UI.esc(p.genre)}"><td><div class="entity"><div class="entity-mark" aria-hidden="true">${UI.esc(p.title.slice(0, 1))}</div><div><div class="entity-name">${UI.esc(p.title)}</div><div class="entity-meta mono">${UI.esc(p.id)}</div></div></div></td><td>${UI.esc(p.genre)}</td><td>${UI.esc(p.owner)}</td><td><div class="progress-cell sm">${UI.progress(pct, (p.done || 0) + '/' + p.episodes + ' 集')}</div></td><td>${UI.esc(p.stage)}</td><td>${UI.tag(p.status, statusTone(p.status))}</td><td class="muted">${UI.esc(p.updated)}</td><td class="row-actions">${UI.btn('档案', 'go:workspace/detail?id=' + p.id, 'btn-sm')}${archived ? '' : `<button type="button" class="btn btn-sm" data-action="project:edit" data-id="${UI.esc(p.id)}">编辑</button>`}${archived ? `<button type="button" class="btn btn-sm" data-action="project:restore" data-id="${UI.esc(p.id)}">恢复</button>` : `<button type="button" class="btn btn-sm btn-ghost" data-action="project:archive" data-id="${UI.esc(p.id)}">归档</button>`}</td></tr>`;
          }).join('');
          const isAuditor = DB.state.identity === 'auditor';

          return UI.page('WORKSPACE / PROJECTS', '创作项目中心', '项目是短剧生产的主业务对象，承载剧本版本、生产计划、镜头单元、资产与交付。', isAuditor ? UI.btn('导出项目清单', 'project:export', 'btn') : `<div class="head-actions">${UI.btn('导出项目清单', 'project:export', 'btn')}${UI.btn('＋ 新建项目', 'project:new', 'btn-primary')}</div>`, `
    <div class="grid grid-4">${UI.metric('全部项目', String(projects.length), '当前租户归属', '▣')}${UI.metric('制作中', String(projects.filter(p => p.status === '制作中').length), 'AI 任务运行中', '◌')}${UI.metric('待审核', String(projects.filter(p => String(p.status).indexOf('审核') > -1).length), '需要人工决策', '!')}${UI.metric('已交付', String(projects.filter(p => p.status === '已交付').length), '正式交付记录', '↗')}</div>
    <div class="card section-gap"><div class="toolbar"><div class="toolbar-left"><b class="small">项目列表</b><select class="field toolbar-select" data-row-filter="status" aria-label="按项目状态筛选"><option value="all">全部状态</option>${statusOptions}</select></div><div class="toolbar-right"><input class="search" data-filter placeholder="搜索项目名称 / 编号 / 负责人"><button class="btn btn-sm" data-action="filter:clear">重置筛选</button></div></div>${UI.table(['项目', '题材', '负责人', '集数进度', '当前阶段', '状态', '更新', '操作'], rows, '当前工作空间暂无可展示项目')}</div>`);
        }
      },
      {
        path: 'workspace/detail',
        stage: 'project',
        title: '项目档案',
        icon: '◧',
        permission: 'workspace',
        render(params) {
          const project = App.resolveProject(params ? params.get('id') : '');
          if (!project) {
            return UI.page('WORKSPACE / PROJECT FILE', '尚未选择项目', '选择当前身份有权访问的项目，查看项目主档与追溯关系。', '', `<div class="card">${UI.empty('没有可用项目', '创建项目或切换到已授权的租户空间。', UI.btn('返回项目中心', 'go:workspace/projects', 'btn-primary'))}</div>`);
          }
          const tenant = DB.tenants.find(t => t.id === project.tenant);
          const projectAssets = DB.assets.filter(a => a.tenant === project.tenant && a.project === project.id);
          const visualCount = projectAssets.filter(a => a.type !== '音频').length;
          const audioCount = projectAssets.filter(a => a.type === '音频').length;
          const quality = project.quality ? project.quality + '/100' : '待检测';
          const step = reachedStep(project);
          const timeline = TIMELINE.map((node, index) => `<div class="timeline-item"><i class="timeline-dot ${index < step ? 'done' : ''}" aria-hidden="true"></i><div><div class="timeline-title">${node.title}</div><div class="timeline-meta">${index < step ? '当前项目已到达' : '等待上游依赖'} · ${node.meta}</div></div></div>`).join('');
          const versions = DB.scriptVersions.filter(v => v.project === project.id);
          const versionRows = versions.map(v => `<tr data-row><td class="mono">V${UI.esc(v.version)}</td><td>${UI.tag(v.status, v.status === '已通过' ? 'green' : v.status === '待审核' ? 'orange' : '')}</td><td>${UI.esc(v.author)}</td><td class="mono">${UI.esc(v.createdAt)}</td><td>${v.words.toLocaleString()} 字</td></tr>`).join('');
          const archived = !!project.archived || project.status === '已归档';

          return UI.page('WORKSPACE / PROJECT FILE', '项目档案 · ' + project.title, '统一查看当前项目主档、剧本版本、生产计划、数字资产和最终交付。', `<div class="head-actions">${archived ? '' : UI.btn('编辑档案', 'project:edit', 'btn', { id: project.id })}${archived ? UI.btn('恢复项目', 'project:restore', 'btn', { id: project.id }) : UI.btn('归档项目', 'project:archive', 'btn-danger', { id: project.id })}${archived ? '' : UI.btn('进入 AI 创作', 'go:studio/brief?id=' + project.id, 'btn-lime')}</div>`, `
    ${archived ? '<div class="notice warn">当前项目已归档，仅保留历史记录与追溯关系，不能启动新的生产任务。</div>' : ''}
    <div class="grid grid-3 section-gap"><div class="card"><div class="eyebrow">PROJECT ID</div><div class="mono id-line">${UI.esc(project.id)}</div>${UI.tag(project.status, statusTone(project.status))}<div class="tiny muted section-gap">最近更新 ${UI.esc(project.updated)}</div></div>${UI.metric('计划集数', String(project.episodes), '当前已完成 ' + (project.done || 0) + ' 集', '▤')}${UI.metric('累计生产成本', '¥' + (project.cost || 0).toLocaleString(), '关联当前项目的生产任务', '￥')}</div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">项目基础信息</div><div class="card-sub">${archived ? '项目已归档，档案与生产链路只读' : '只读汇总，修改请使用右上角“编辑档案”'}</div></div>${UI.tag(project.priority || '普通', project.priority === '紧急' ? 'red' : project.priority === '高' ? 'orange' : '')}</div><div class="grid grid-4 section-gap">${UI.kpi('题材', UI.esc(project.genre))}${UI.kpi('单集时长', (project.duration || 2) + ' 分钟')}${UI.kpi('计划预算', project.budget ? '¥' + project.budget.toLocaleString() : '未设置')}${UI.kpi('截止日期', UI.esc(project.deadline || '未设置'))}${UI.kpi('剧本版本', 'V' + (project.scriptVersion || 1))}${UI.kpi('镜头生产单元', String(project.shotCount || project.episodes * 8))}${UI.kpi('视觉 / 音频资产', visualCount + ' / ' + audioCount)}${UI.kpi('质检综合分', quality)}</div><p class="prose section-gap">${UI.esc(project.brief || '尚未填写创作需求。')}</p></div>
    <div class="grid grid-2 section-gap"><div class="card"><div class="card-title">生产链路</div><div class="timeline section-gap">${timeline}</div></div><div class="card"><div class="card-title">剧本版本快照</div>${versions.length ? UI.table(['版本', '状态', '生成方', '时间', '字数'], versionRows, '暂无版本记录') : UI.empty('暂无剧本版本', archived ? '项目已归档，历史版本状态已冻结。' : '在创作需求页生成剧本后，此处记录每个版本快照。', archived ? '' : UI.btn('进入 AI 创作', 'go:studio/brief?id=' + project.id, 'btn-sm'))}<div class="section-gap">${UI.btn('查看剧本审核', 'go:studio/script-review?id=' + project.id, 'btn-sm')}${UI.btn('查看数字资产', 'go:assets/library?id=' + project.id, 'btn-sm')}</div></div></div>
    ${archived ? '' : `<div class="card section-gap"><div class="card-title">下一步操作</div><div class="grid grid-3 section-gap"><div class="notice">剧本与生产：${UI.btn(project.scriptApproved ? '查看剧本审核' : '补充创作需求', 'go:' + (project.scriptApproved ? 'studio/script-review' : 'studio/brief') + '?id=' + project.id, 'btn-sm')}</div><div class="notice">拍摄与后期：${UI.btn('查看拍摄排期', 'go:pipeline/schedule?id=' + project.id, 'btn-sm')}</div><div class="notice">审核与交付：${UI.btn('查看成片终审', 'go:delivery/review?id=' + project.id, 'btn-sm')}</div></div></div>`}`);
        }
      }
    ]
  });

  /* ---------- 项目操作：编辑、归档、恢复、导出 ---------- */
  App.onAction('project:edit', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id) || App.project();
    if (!project) { App.toast('未找到要编辑的项目', 'error'); return; }
    if (project.archived || project.status === '已归档') { App.toast('已归档项目为只读状态，请先恢复项目', 'warning'); return; }
    App.editingProjectId = project.id;
    App.modal('编辑项目档案 · ' + project.title, `<div class="notice">项目编号与归属租户不可修改；集数在剧本锁定后不可调整。</div><div class="form-grid section-gap">${UI.fField('项目名称', 'title', { value: project.title, required: true, minlength: 2, maxlength: 30 })}${UI.fField('题材方向', 'genre', { value: project.genre, required: true })}${UI.fField('计划集数', 'episodes', { value: project.episodes, type: 'number', min: 1, max: 100, required: true, readonly: !!project.scriptApproved, hint: project.scriptApproved ? '剧本已锁定，集数不可修改' : '' })}${UI.fField('单集时长（分钟）', 'duration', { value: project.duration || 2, type: 'number', min: 1, max: 15, required: true })}${UI.fField('计划预算（元）', 'budget', { value: project.budget || 0, type: 'number', min: 0, step: 1000 })}${UI.fField('截止日期', 'deadline', { value: project.deadline || '', type: 'date' })}${UI.fSelect('优先级', 'priority', [{ value: '普通', label: '普通' }, { value: '高', label: '高' }, { value: '紧急', label: '紧急' }], { value: project.priority || '普通' })}<label class="field-wrap full"><span class="field-label">创作目标</span><textarea class="field" name="brief" rows="4" maxlength="500">${UI.esc(project.brief || '')}</textarea><span class="field-error" hidden></span></label></div>`, '保存修改', 'project:update', { subtitle: project.id + ' · ' + project.owner });
  });

  App.onSubmit('project:update', (form) => {
    const target = DB.projects.find(p => p.id === App.editingProjectId);
    if (!target) { App.toast('项目已不存在，请刷新后重试', 'error'); return false; }
    if (target.archived || target.status === '已归档') { App.toast('已归档项目为只读状态，不能保存修改', 'warning'); return false; }
    const title = String(form.get('title') || '').trim();
    if (title.length < 2) { App.toast('项目名称至少 2 个字符', 'error'); return false; }
    target.title = title;
    target.genre = String(form.get('genre') || target.genre);
    if (!target.scriptApproved) target.episodes = Math.max(1, Math.min(100, Number(form.get('episodes') || target.episodes)));
    target.duration = Math.max(1, Number(form.get('duration') || 2));
    target.budget = Math.max(0, Number(form.get('budget') || 0));
    target.deadline = String(form.get('deadline') || '');
    target.priority = String(form.get('priority') || '普通');
    target.brief = String(form.get('brief') || '');
    target.updated = '刚刚';
    App.logAudit('更新项目档案', target.title + ' / ' + target.id);
    App.closeModal();
    App.renderShell();
    App.renderRoute();
    App.toast('项目「' + target.title + '」档案已保存', 'success', '保存成功');
    return true;
  });

  App.onAction('project:archive', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id);
    if (!project) { App.toast('未找到该项目', 'error'); return; }
    if (project.archived) { App.toast('项目已处于归档状态', 'info'); return; }
    App.confirm('归档项目 · ' + project.title, '归档后项目不再出现在默认生产流程中，历史剧本、资产、成本与审计记录全部保留。', '确认归档', () => {
      project.archived = true;
      project.status = '已归档';
      project.stage = '已归档';
      project.updated = '刚刚';
      App.logAudit('归档创作项目', project.title + ' / ' + project.id, '成功', '项目');
      App.renderShell();
      App.renderRoute();
      App.toast('项目已归档，可在项目列表中恢复', 'success', '归档完成');
    }, { details: [{ key: '项目编号', value: project.id }, { key: '当前集数', value: (project.done || 0) + ' / ' + project.episodes }, { key: '保留内容', value: '剧本版本、资产、成本与审计' }], note: '归档不等于删除，历史记录不可篡改。' });
  });

  App.onAction('project:restore', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id);
    if (!project) { App.toast('未找到该项目', 'error'); return; }
    project.archived = false;
    project.status = project.delivered ? '已交付' : '制作中';
    project.stage = project.delivered ? '已归档' : '视频生产';
    project.updated = '刚刚';
    App.logAudit('恢复归档项目', project.title + ' / ' + project.id, '成功', '项目');
    App.renderShell();
    App.renderRoute();
    App.toast('项目「' + project.title + '」已恢复', 'success', '恢复成功');
  });

  App.onAction('project:export', trigger => {
    App.runAction(trigger, () => {
      const projects = App.accessibleProjects();
      App.download('项目清单_' + new Date().toISOString().slice(0, 10) + '.csv', App.toCSV(
        ['项目编号', '项目名称', '题材', '负责人', '集数', '已完成', '阶段', '状态', '成本', '更新'],
        projects.map(p => [p.id, p.title, p.genre, p.owner, p.episodes, p.done || 0, p.stage, p.status, p.cost || 0, p.updated])
      ));
    }, { loading: '正在导出…', delay: 500 });
  });
})();
