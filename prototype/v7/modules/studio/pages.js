/* 模块：AI 创作工作台（studio）— 创作输入、剧本版本与人工剧本审核 */
(function () {
  const AUDIENCES = ['18–35 岁都市观众', '女性成长向', '泛悬疑受众', '家庭向全龄观众'];
  const STYLES = ['电影感写实', '高饱和商业短剧', '国风美学', '轻喜剧明亮'];
  const RISKS = [
    { key: '剧情逻辑检查', status: '演示待复核', tone: 'orange' },
    { key: '敏感内容检查', status: '需人工确认', tone: 'orange' },
    { key: '版权素材检查', status: '需核对授权', tone: 'blue' }
  ];

  function options(list) {
    return [{ value: '', label: '请选择' }].concat(list.map(item => ({ value: item, label: item })));
  }

  AppModule.register({
    group: 'studio',
    label: '05 / AI 创作工作台',
    icon: '✳',
    routes: [
      {
        path: 'studio/brief',
        stage: 'script',
        title: '创作需求',
        icon: '✳',
        permission: 'studio',
        render(params) {
          const project = App.resolveProject(params ? params.get('id') : '');
          if (!project) {
            return UI.page('CREATIVE DESK / 01', '尚未选择项目', '先创建项目或切换到已授权的项目，再开始创作。', UI.btn('创建项目', 'project:new', 'btn-primary'), `<div class="card">${UI.empty('没有可用项目', '当前租户和身份范围内没有可访问的项目。', UI.btn('返回项目中心', 'go:workspace/projects', 'btn-primary'))}</div>`);
          }
          const tenant = DB.tenants.find(t => t.id === project.tenant);
          const versions = DB.scriptVersions.filter(v => v.project === project.id);
          const briefLen = String(project.brief || '').trim().length;
          return UI.page('CREATIVE DESK / 01', 'AI 创作助手', '以当前项目为上下文输入创作目标，后续生产对象均关联该项目。', `<div class="head-actions">${UI.btn('历史版本', 'script:versions', 'btn', { id: project.id })}${UI.btn('项目档案', 'go:workspace/detail?id=' + project.id, 'btn')}</div>`, `
    <div class="grid grid-2"><div class="card"><div class="eyebrow">CURRENT PROJECT / ${UI.esc(project.id)}</div><h2 class="entity-title">${UI.esc(project.title)}</h2><p class="small muted">${UI.esc(project.genre)} · ${project.episodes} 集 · 归属 ${UI.esc(tenant ? tenant.name : '未知租户')}</p><div class="divider"></div>
    <label class="field-wrap"><span class="field-label">项目创作需求<i class="req" aria-hidden="true">*</i></span><textarea class="field" rows="6" name="creativeBrief" data-project-field="brief" minlength="20" maxlength="500" data-msg="创作需求至少 20 个字符">${UI.esc(project.brief || '')}</textarea><span class="field-error" hidden></span><span class="field-hint"><span data-brief-count>${briefLen}</span>/500 字 · 至少 20 字，描述题材、核心冲突、人物关系与风格</span></label>
    <div class="grid grid-2 section-gap">${UI.fSelect('目标受众', 'audience', options(AUDIENCES), { value: project.audience || '', required: true, dataset: { 'project-field': 'audience' } })}${UI.fSelect('视觉风格', 'visualStyle', options(STYLES), { value: project.visualStyle || '', required: true, dataset: { 'project-field': 'visualStyle' } })}</div>
    <div class="section-gap btn-row">${UI.btn('保存草稿', 'script:draft', 'btn')}${UI.btn('✳ 生成创意与剧本', 'script:generate', 'btn-lime')}</div>
    <div class="tiny muted section-gap">生成任务会占用当前项目的剧本版本号，完成后进入剧本审核；演示环境不调用真实模型。</div>
    ${project.scriptApproved ? `<div class="notice success section-gap">剧本 V${project.scriptVersion || 1} 已通过审核并锁定。如需修改，请先在剧本审核台退回。</div>` : ''}</div>
    <div class="card card-dark"><div class="eyebrow lime-text">AI ORCHESTRATOR</div><h2 class="entity-title">项目 AI 制作统筹</h2><p class="prose on-dark">围绕当前项目，将创作需求拆解为可追溯的生产对象，而不是把多个孤立 AI 工具简单堆在一起。</p><div class="divider dark"></div>${['分析题材与受众定位', '构建故事世界观与人物关系', '规划分集剧情与集尾钩子', '生成完整剧本及对白', '预检逻辑、内容与版权风险'].map((item, index) => `<div class="kpi-line on-dark"><span>${String(index + 1).padStart(2, '0')} / ${UI.esc(item)}</span><span class="lime-text">AI</span></div>`).join('')}<div class="notice dark section-gap">人工正式审核点：确认当前项目的剧本版本。审核通过后才进入正式生产。</div></div></div>
    <div class="grid grid-3 section-gap"><div class="card"><div class="card-title">创作输入</div><p class="prose">题材、核心冲突、人物关系、受众、集数和风格偏好。</p></div><div class="card"><div class="card-title">AI 生成资产</div><p class="prose">故事大纲、世界观、人物档案、分集剧情、正式剧本候选版本。</p></div><div class="card"><div class="card-title">人工决策</div><p class="prose">确认故事方向、内容合规与剧本正式版本；不承担专业编剧执行。</p></div></div>`);
        }
      },
      {
        path: 'studio/script-review',
        stage: 'script',
        title: '剧本编辑',
        icon: '▤',
        permission: 'studio',
        render(params) {
          const project = App.resolveProject(params ? params.get('id') : '');
          if (!project) {
            return UI.page('HUMAN GATE / SCRIPT', '暂无可审核项目', '选择当前租户内有待审核剧本的项目。', '', `<div class="card">${UI.empty('没有可审核项目', '先创建项目并提交创意与剧本生成流程。', UI.btn('返回项目中心', 'go:workspace/projects', 'btn-primary'))}</div>`);
          }
          const version = 'V' + (project.scriptVersion || 1);
          const approved = !!project.scriptApproved;
          const remaining = Math.max(0, project.episodes - (project.done || 0));
          const versions = DB.scriptVersions.filter(v => v.project === project.id);
          const latest = versions.sort((a, b) => b.version - a.version)[0];
          const impact = (DB.impactAnalyses || []).find(a => a.project === project.id);
          return UI.page('HUMAN GATE / SCRIPT', '剧本审核台', '人工审核节点 A：确认当前项目的故事方向、分集结构、人物设定、逻辑与合规。', `<div class="head-actions">${UI.btn('下载剧本', 'script:download', 'btn', { id: project.id })}${UI.btn('历史版本', 'script:versions', 'btn', { id: project.id })}${UI.btn('打开创作助手', 'go:studio/brief?id=' + project.id, 'btn')}</div>`, `
    <div class="notice warn">剧本审核是正式生产前的人工决策门。未审核通过的当前项目不能启动导演分镜与后续生产。</div>
    <div class="grid grid-3 section-gap">${UI.metric('当前项目', project.title, '项目编号 ' + project.id, '▤')}${UI.metric('剧本版本', version, latest ? '最近生成 ' + latest.createdAt : '当前候选版本', '↗')}${UI.metric('审核状态', approved ? '已通过' : '待审核', approved ? '正式版本已锁定' : '等待人工决策', approved ? '✓' : '!')}</div>
    <div class="grid grid-2 section-gap"><div class="card"><div class="card-head"><div><div class="card-title">${UI.esc(project.title)} · 剧本 ${version}</div><div class="card-sub">${UI.esc(project.genre)} · ${project.episodes} 集 ${latest ? '· ' + latest.words.toLocaleString() + ' 字' : ''}</div></div>${UI.tag(approved ? '已通过' : '待审核', approved ? 'green' : 'orange')}</div>
    <div class="tabs" role="tablist"><button class="tab active" type="button" role="tab" aria-selected="true" data-action="tab" data-target="outline">故事大纲</button><button class="tab" type="button" role="tab" aria-selected="false" data-action="tab" data-target="episodes">分集结构</button><button class="tab" type="button" role="tab" aria-selected="false" data-action="tab" data-target="risk">合规预检</button></div>
    <div data-tab-panel="outline"><h3 class="section-title">当前项目创作需求</h3><p class="prose">${UI.esc(project.brief || '该项目尚未填写创作需求。请返回 AI 创作助手补充项目故事方向后再进行审核。')}</p><div class="divider"></div><div class="small"><b>项目状态：</b>${UI.esc(project.status)} · ${UI.esc(project.stage || '待启动')}</div>${latest ? `<div class="notice section-gap"><b>V${latest.version} 变更说明：</b>${UI.esc(latest.note)}</div>` : ''}</div>
    <div data-tab-panel="episodes" hidden>${UI.kpi('计划集数', project.episodes + ' 集')}${UI.kpi('已完成集数', (project.done || 0) + ' 集')}${UI.kpi('待制作集数', remaining + ' 集')}${UI.kpi('镜头生产单元', String(project.shotCount || project.episodes * 8))}${UI.kpi('平均单集字数', latest ? Math.round(latest.words / Math.max(1, project.episodes)).toLocaleString() + ' 字' : '—')}</div>
    <div data-tab-panel="risk" hidden>${RISKS.map(r => `<div class="kpi-line"><span>${UI.esc(r.key)}</span>${UI.tag(r.status, r.tone)}</div>`).join('')}<div class="notice warn section-gap">风险提示为演示状态，需人工结合实际内容确认，平台不伪造检测结论。</div></div>
    <div class="divider"></div><div class="small muted">审核记录绑定当前项目与版本；版本变更应形成新快照，不覆盖已确认版本。</div></div>
    <div class="card"><div class="card-title">审核决策</div><div class="callout"><div class="callout-icon" aria-hidden="true">✓</div><div><strong>审核提示</strong><p>请结合当前项目创作需求、分集计划和风险提示作出人工判断。原型不伪造真实 AI 检测结果。</p></div></div><label class="field-wrap section-gap"><span class="field-label">审核意见</span><textarea class="field" data-project-field="scriptReviewNote" placeholder="填写通过意见或退回修改建议">${UI.esc(project.scriptReviewNote || '')}</textarea><span class="field-error" hidden></span></label><div class="grid grid-2 section-gap">${UI.btn('退回修改', 'script:return', 'btn')}${approved ? '<button type="button" class="btn btn-lime" disabled>已确认正式版本</button>' : UI.btn('通过并锁定 ' + version, 'script:approve', 'btn-lime')}</div><p class="tiny muted section-gap">通过后形成当前项目的正式版本状态，后续修改应创建新版本并触发影响分析。</p></div></div>
    ${impact ? `<div class="card section-gap"><div class="card-head"><div><div class="card-title">剧本修改影响分析 · ${UI.esc(impact.version)}</div><div class="card-sub">基线 ${UI.esc(impact.baseVersion)} · ${UI.esc(impact.createdAt)} · 只重生产受影响对象</div></div>${UI.tag(impact.status, impact.status === '已确认' ? 'green' : 'orange')}</div><div class="grid grid-4 section-gap">${UI.kpi('受影响集次', UI.esc(impact.episodes))}${UI.kpi('场景', impact.scenes + ' 个')}${UI.kpi('人物 / 对白', impact.characters + ' / ' + impact.dialogues)}${UI.kpi('镜头 / 音频', impact.shots + ' / ' + impact.audio)}</div><p class="prose section-gap">${UI.esc(impact.note)}</p><div class="notice section-gap">关联任务：${UI.esc((impact.tasks || []).join('、'))} · 时间轴 ${impact.timeline} 条。未受影响集次不重做，避免整剧返工。</div><div class="section-gap">${impact.status === '已确认' ? UI.tag('受影响对象已进入重生产', 'green') : UI.btn('确认仅重生产受影响内容', 'impact:apply', 'btn-lime', { id: impact.id })}${UI.btn('查看生产任务', 'go:pipeline/tasks?id=' + project.id, 'btn-sm')}</div></div>` : ''}`);
        }
      }
    ]
  });

  App.onAction('impact:apply', trigger => {
    const impact = (DB.impactAnalyses || []).find(a => a.id === trigger.dataset.id);
    if (!impact) { App.toast('影响分析记录不存在', 'error'); return; }
    const project = DB.projects.find(p => p.id === impact.project);
    if (!project) { return; }
    App.confirm('确认局部重生产', '仅重生成 ' + impact.episodes + ' 的 ' + impact.shots + ' 个镜头与 ' + impact.audio + ' 段音频，其他集次保持不变。', '确认重生产', () => {
      impact.status = '已确认';
      impact.confirmedAt = '刚刚';
      const exists = (DB.productionTasks || []).some(t => t.project === project.id && t.stage === '剧本影响重生产');
      if (!exists) {
        DB.productionTasks.unshift({
          id: 'PT-' + project.id.replace('SP-', '') + '-IA', project: project.id, tenant: project.tenant, stage: '剧本影响重生产',
          episode: 7, scene: '第 7–8 集 / 反转铺垫', shot: impact.shots + ' 个受影响镜头', capability: '视频生成',
          status: '待执行', model: 'Motion Forge 2', backup: 'Motion Forge 1', attempt: 0, maxAttempts: DB.enterprise.policies.retryLimit,
          cost: 0, failedCost: 0, failure: '', dependsOn: impact.tasks || [], input: '正式剧本 ' + impact.version + ' / 影响分析 ' + impact.id,
          output: '受影响镜头与音频重生成', startedAt: '', finishedAt: '', quality: 0
        });
      }
      App.logAudit('确认剧本影响重生产', project.title + ' / ' + impact.version + ' / ' + impact.shots + ' 镜头', '成功', '生产');
      App.save();
      App.renderRoute();
      App.toast('已确认局部重生产，仅处理受影响镜头与音频', 'success', '影响分析已确认');
    }, { details: [{ key: '剧本版本', value: impact.version }, { key: '受影响集次', value: impact.episodes }, { key: '镜头 / 音频', value: impact.shots + ' / ' + impact.audio }], note: '不会整剧重做。' });
  });

  /* ---------- 创作操作 ---------- */
  App.onAction('script:draft', trigger => {
    const brief = document.querySelector('[data-project-field="brief"]');
    const project = App.project();
    if (!project || !brief) { App.toast('未找到当前项目或创作需求字段', 'error'); return; }
    if (String(brief.value).trim().length < 20) {
      App.setFieldError(brief, '创作需求至少 20 个字符后再保存');
      brief.focus();
      App.toast('创作需求过短，至少 20 个字符', 'error', '保存失败');
      return;
    }
    App.clearFieldError(brief);
    project.brief = brief.value;
    if (project.status === '草稿') { project.status = '创作中'; project.stage = '创意策划'; }
    project.updated = '刚刚';
    App.save();
    App.logAudit('保存创作需求草稿', project.title + ' / ' + project.id);
    App.runAction(trigger, () => App.toast('创作需求草稿已保存到当前项目', 'success', '已保存'), { loading: '保存中…' });
  });

  App.onAction('script:versions', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id) || App.project();
    if (!project) { App.toast('未找到项目', 'error'); return; }
    const versions = DB.scriptVersions.filter(v => v.project === project.id).sort((a, b) => b.version - a.version);
    const body = versions.length ? `<div class="timeline">${versions.map(v => `<div class="timeline-item"><i class="timeline-dot ${v.status === '已通过' ? 'done' : ''}" aria-hidden="true"></i><div><div class="timeline-title">V${v.version} · ${UI.esc(v.status)}</div><div class="timeline-meta">${UI.esc(v.createdAt)} · ${UI.esc(v.author)} · ${v.words.toLocaleString()} 字</div><div class="small muted">${UI.esc(v.note)}</div></div></div>`).join('')}</div>` : UI.empty('暂无版本快照', '生成剧本后自动记录版本。');
    App.drawer('剧本版本 · ' + project.title, body, { subtitle: '版本只追加不覆盖，审核结论绑定版本', footer: UI.btn('关闭', 'overlay:close', 'btn') });
  });

  App.onAction('script:download', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id) || App.project();
    if (!project) { App.toast('未找到项目', 'error'); return; }
    App.runAction(trigger, () => {
      const versions = DB.scriptVersions.filter(v => v.project === project.id).sort((a, b) => b.version - a.version);
      const latest = versions[0];
      const content = [
        '项目：' + project.title + ' / ' + project.id,
        '题材：' + project.genre,
        '集数：' + project.episodes + ' 集',
        '剧本版本：V' + (project.scriptVersion || 1),
        latest ? '生成时间：' + latest.createdAt + ' / 字数：' + latest.words : '',
        '',
        '创作需求：',
        project.brief || '未填写',
        '',
        '（演示文件，仅包含项目元信息，不包含真实剧本文本。）'
      ].join('\n');
      App.download(project.title + '_剧本_V' + (project.scriptVersion || 1) + '.txt', content, 'text/plain;charset=utf-8');
    }, { loading: '正在生成文件…', delay: 500 });
  });

  App.onAction('script:return', () => {
    const project = App.project();
    if (!project) { App.toast('没有可退回的当前项目', 'error'); return; }
    App.modal('退回剧本修改 · ' + project.title, `<div class="notice warn">退回后当前版本不会进入正式生产，需重新生成或修改后再提交审核。</div><label class="field-wrap section-gap"><span class="field-label">退回原因<i class="req" aria-hidden="true">*</i></span><textarea class="field" name="reason" rows="4" required minlength="10" maxlength="300" data-msg="退回原因至少 10 个字符，便于编剧与 AI 修改"></textarea><span class="field-error" hidden></span></label>`, '确认退回', 'script:return-submit', { danger: true, subtitle: 'V' + (project.scriptVersion || 1) + ' · ' + project.id });
  });

  App.onSubmit('script:return-submit', (form) => {
    const reason = String(form.get('reason') || '').trim();
    if (reason.length < 10) { App.toast('退回原因至少 10 个字符', 'error'); return false; }
    App.closeModal();
    App.runAction(null, () => App.returnScript(reason), { delay: 200 });
    return true;
  });

  App.onAction('script:approve', trigger => {
    const project = App.project();
    if (!project) { App.toast('没有可审核的当前项目', 'error'); return; }
    if (project.scriptApproved) { App.toast('当前剧本版本已确认，无需重复审核', 'info'); return; }
    App.confirm('确认正式剧本版本', '通过后当前项目锁定剧本 V' + (project.scriptVersion || 1) + '，后续修改需创建新版本并触发影响分析。', '通过并锁定版本', () => App.approveScript(), {
      details: [{ key: '项目', value: project.title + ' / ' + project.id }, { key: '剧本版本', value: 'V' + (project.scriptVersion || 1) }, { key: '审核意见', value: project.scriptReviewNote || '未填写' }],
      note: '通过后剧本版本将作为正式生产依据。'
    });
  });
})();
