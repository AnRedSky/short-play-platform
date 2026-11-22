/* 模块：审核与交付（delivery）— 最终成片审核、交付归档与发布上线 */
(function () {
  const CHECKS = ['剧情完整与故事闭环', '人物形象及跨集一致性', '视频画面与镜头衔接', '配音、配乐与音效质量', '字幕准确性与时间轴', '集数完整与交付文件齐全', '内容合规与敏感风险', '版权来源与商业使用授权', '质量报告与生产报告齐备'];

  function nowStamp() {
    return new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-').replace(',', '');
  }

  function channelName(id) {
    return (DB.channels.find(c => c.id === id) || { name: id }).name;
  }

  AppModule.register({
    group: 'delivery',
    label: '08 / 审核与交付',
    icon: '⇧',
    routes: [
      {
        path: 'delivery/review',
        stage: 'deliver',
        title: '成片终审',
        icon: '◉',
        permission: 'delivery',
        render(params) {
          const project = App.resolveProject(params ? params.get('id') : '');
          if (!project) {
            return UI.page('HUMAN GATE / FINAL CUT', '尚未选择项目', '选择当前租户内待终审的项目。', '', `<div class="card">${UI.empty('没有可终审项目', '当前身份没有可访问的项目。', UI.btn('返回项目中心', 'go:workspace/projects', 'btn-primary'))}</div>`);
          }
          const approved = !!project.finalApproved;
          const complete = (project.done || 0) >= project.episodes;
          const checkedList = Array.isArray(project.reviewChecks) ? project.reviewChecks : [];
          const checks = CHECKS.map((item, index) => `<label class="kpi-line"><span>${UI.esc(item)}</span><input type="checkbox" data-review-check="${index}" ${checkedList.indexOf(index) > -1 ? 'checked' : ''} ${complete ? '' : 'disabled'}></label>`).join('');
          const allChecked = checkedList.length >= CHECKS.length;
          const q = App.qualitySummary(project);
          const reviewRows = (DB.reviews || []).filter(r => r.project === project.id).map(r => `<tr data-row data-search="${UI.esc(r.type)} ${UI.esc(r.version)} ${UI.esc(r.reviewer)} ${UI.esc(r.result)}"><td>${UI.esc(r.type)}</td><td class="mono">${UI.esc(r.version)}</td><td>${UI.esc(r.reviewer)}</td><td class="mono">${UI.esc(r.time)}</td><td>${UI.tag(r.result, r.result === '通过' ? 'green' : r.result === '退回修改' ? 'orange' : r.result === '待审核' ? '' : 'red')}</td><td>${UI.esc(r.note)}</td><td class="mono">${UI.esc(r.tasks || '—')}</td><td>${UI.esc(r.followup || '—')}</td></tr>`).join('');

          return UI.page('HUMAN GATE / FINAL CUT', '最终成片审核', '人工审核节点 B：确认当前项目的内容、画面、音频、字幕、集数完整性、合规、版权与报告齐备。', `<div class="head-actions">${UI.btn('质量检测记录', 'go:pipeline/quality?id=' + project.id, 'btn')}${UI.btn('审核记录导出', 'review:export', 'btn', { id: project.id })}${UI.btn('进入交付中心', 'go:delivery/center?id=' + project.id, 'btn')}</div>`, `
    <div class="notice warn">AI 质检通过不等于正式交付。必须由员工完成当前项目的最终成片审核，才能进入交付归档。</div>
    <div class="grid grid-4 section-gap">${UI.metric('当前终审项目', project.title, project.id, '◉')}${UI.metric('质量评分', q.score ? q.score + ' / 100' : '待检测', q.fail ? q.fail + ' 项不合格' : q.warn ? q.warn + ' 项警告' : '十维质检', q.fail ? '!' : '✓')}${UI.metric('集数进度', (project.done || 0) + ' / ' + project.episodes, '当前项目完成情况', complete ? '✓' : '!')}${UI.metric('审核记录', String(reviewRows ? (DB.reviews || []).filter(r => r.project === project.id).length : 0), '含剧本与成片审核', '▤')}</div>
    <div class="grid grid-2 section-gap"><div class="card card-dark self-start"><div class="eyebrow lime-text">FINAL CUT / PREVIEW</div><div class="preview-frame"><div class="preview-play" aria-hidden="true">▶</div><div class="preview-note">演示预览画面 · 不包含真实视频流</div></div><div class="small preview-caption">${UI.esc(project.title)} · ${project.episodes} 集 · 当前候选交付版本</div><div class="section-gap">${UI.btn('查看集次预览', 'review:preview', 'btn', { id: project.id })}</div></div>
    <div class="card"><div class="card-head"><div><div class="card-title">最终审核清单</div><div class="card-sub" data-review-progress>${allChecked ? '全部项目已确认' : '请逐项确认后再提交'}</div></div><span data-review-count>${UI.tag(checkedList.length + ' / ' + CHECKS.length, allChecked ? 'green' : 'orange')}</span></div>${checks}
    <label class="field-wrap section-gap"><span class="field-label">审核意见</span><textarea class="field" data-project-field="finalReviewNote" placeholder="记录当前项目的最终审核结论或指定返修范围">${UI.esc(project.finalReviewNote || '')}</textarea></label>
    <div class="section-gap btn-row">${complete ? `<button type="button" class="btn btn-ghost" data-action="final:reject" data-id="${UI.esc(project.id)}">退回返修</button>` : ''}${approved ? UI.tag('最终审核已通过', 'green') : complete ? UI.btn('审核通过', 'final:approve', 'btn-lime') : `<div class="notice warn">当前项目尚有 ${project.episodes - (project.done || 0)} 集未完成，暂不能提交最终审核。</div>`}</div><p class="tiny muted section-gap">审核结论与清单状态绑定当前项目；退回返修会记录原因并保留已完成集次。</p></div></div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">结构化审核记录 · ${UI.esc(project.title)}</div><div class="card-sub">审核对象、版本、审核人、结果、调整意见、关联任务与后续处理全部留痕</div></div>${UI.btn('导出审核记录', 'review:export', 'btn-sm', { id: project.id })}</div>${reviewRows ? UI.table(['类型', '版本', '审核人', '时间', '结果', '调整意见', '关联任务', '后续处理'], reviewRows, '暂无审核记录') : UI.empty('暂无审核记录', '提交剧本或成片审核后，系统自动记录版本、结论与后续处理。', UI.btn('查看剧本审核', 'go:studio/script-review?id=' + project.id, 'btn-sm'))}</div>`);
        }
      },
      {
        path: 'delivery/center',
        stage: 'deliver',
        title: '交付归档',
        icon: '⇧',
        permission: 'delivery',
        render(params) {
          const project = App.resolveProject(params ? params.get('id') : '');
          if (!project) {
            return UI.page('DELIVERY / RELEASE', '尚未选择项目', '选择项目后查看交付包与归档状态。', '', `<div class="card">${UI.empty('没有可交付项目', '当前身份没有可访问的项目。', UI.btn('返回项目中心', 'go:workspace/projects', 'btn-primary'))}</div>`);
          }
          const delivered = !!project.delivered;
          const approved = !!project.finalApproved;
          const stateText = delivered ? '已归档' : approved ? '待生成交付包' : '待终审';
          const packages = DB.deliveries.filter(d => d.project === project.id);
          const files = delivered ? [
            { name: '完整成片与分集视频 MP4', count: project.episodes, size: '16.8 GB' },
            { name: '字幕 SRT / ASS', count: project.episodes, size: '0.8 MB' },
            { name: '封面与宣传素材', count: (project.coverAssets || 2) + 4, size: '668 MB' },
            { name: '项目剧本与版本记录', count: project.scriptVersion || 1, size: '3.2 MB' },
            { name: '人物设定与场景资产包', count: 12, size: '1.4 GB' },
            { name: '生产报告 / 质量报告', count: 2, size: '206 KB' },
            { name: '版权与来源授权资料', count: 6, size: '24 MB' },
            { name: '交付清单 CSV', count: 1, size: '12 KB' }
          ] : [];
          const q = App.qualitySummary(project);

          return UI.page('DELIVERY / RELEASE', '作品交付与归档', '管理当前项目的正式成片、分集文件、字幕、封面、报告、版权资料、交付清单和版本追溯。', `<div class="head-actions">${UI.btn('质量检测记录', 'go:pipeline/quality?id=' + project.id, 'btn')}${UI.btn('查看终审', 'go:delivery/review?id=' + project.id, 'btn')}${delivered ? UI.btn('导出交付清单', 'delivery:manifest', 'btn', { id: project.id }) : ''}</div>`, `
    <div class="grid grid-4">${UI.metric('当前交付项目', project.title, project.id, '⇧')}${UI.metric('集数完整度', (project.done || 0) + ' / ' + project.episodes, '按当前项目进度展示', '✓')}${UI.metric('交付状态', stateText, '状态与当前项目绑定', '▧')}${UI.metric('质量 / 成本', (q.score || project.quality || 0) + ' / ¥' + (project.cost || 0).toLocaleString(), '十维质检与项目成本', '✳')}</div>
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">交付单 · ${UI.esc(project.title)}</div><div class="card-sub mono">项目 ${UI.esc(project.id)} / ${project.episodes} Episodes</div></div>${UI.tag(stateText, delivered ? 'green' : 'orange')}</div>
    <div class="grid grid-2"><div>${UI.kpi('成片文件', (project.done || 0) + ' / ' + project.episodes + ' 集')}${UI.kpi('字幕文件', (project.done || 0) + ' / ' + project.episodes + ' 集')}${UI.kpi('封面与海报', (project.coverAssets || 0) + ' 项')}${UI.kpi('交付清单', delivered ? '已归档' : approved ? '等待生成' : '等待终审')}</div>
    <div><div class="notice ${approved ? 'success' : 'warn'}">${approved ? '当前项目已通过最终审核，可以生成演示交付记录。' : '交付包需等待当前项目最终审核通过后才能生成。'}</div><div class="section-gap">${delivered ? UI.tag('已完成正式归档', 'green') : approved ? UI.btn('生成交付包并归档', 'delivery:publish', 'btn-lime') : UI.btn('前往最终审核', 'go:delivery/review?id=' + project.id, 'btn')}</div><div class="tiny muted section-gap">演示交互：仅更新当前项目内存状态，不生成真实媒体文件。</div></div></div></div>
    ${delivered ? `<div class="grid grid-2 section-gap"><div class="card"><div class="card-title">交付文件清单</div>${UI.table(['文件类型', '数量', '体积'], files.map(f => `<tr data-row><td>${UI.esc(f.name)}</td><td>${f.count}</td><td class="mono">${UI.esc(f.size)}</td></tr>`).join(''), '暂无交付文件')}</div><div class="card"><div class="card-title">归档记录</div>${packages.map(p => `<div class="kpi-line"><span>${UI.esc(p.manifest)}</span>${UI.tag(p.status, 'green')}</div><div class="tiny muted">${UI.esc(p.createdAt)} · ${UI.esc(p.operator)} · ${p.files} 个文件 / ${UI.esc(p.size)}</div>`).join('')}<div class="section-gap">${UI.btn('导出交付清单', 'delivery:manifest', 'btn-sm', { id: project.id })}</div></div></div>` : ''}
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">交付资料与报告</div><div class="card-sub">正式交付至少包含成片、分集、字幕、封面、宣传素材、剧本、人物设定、生产报告、质量报告与版权来源资料</div></div>${UI.tag(approved ? '可生成' : '待终审', approved ? 'green' : 'orange')}</div><div class="grid grid-2 section-gap"><div class="notice">生产报告：${UI.btn('导出生产报告', 'delivery:report', 'btn-sm', { id: project.id, kind: 'production' })}</div><div class="notice">质量报告：${UI.btn('导出质量报告', 'delivery:report', 'btn-sm', { id: project.id, kind: 'quality' })}</div><div class="notice">合规与版权台账：${UI.btn('导出合规摘要', 'delivery:report', 'btn-sm', { id: project.id, kind: 'compliance' })}</div><div class="notice">项目成本报告：${UI.btn('导出成本报告', 'delivery:report', 'btn-sm', { id: project.id, kind: 'cost' })}</div></div><div class="tiny muted section-gap">报告均带项目、集数、质量、任务与成本口径；演示环境下导出为 CSV 摘要，不代表真实结算或法律意见。</div></div>`);
        }
      },
      {
        path: 'delivery/release',
        stage: 'release',
        title: '发布上线',
        icon: '↗',
        permission: 'delivery',
        render(params) {
          const project = App.resolveProject(params ? params.get('id') : '');
          if (!project) {
            return UI.page('WORKFLOW / RELEASE', '尚未选择项目', '选择项目后查看渠道授权与上线排期。', '', `<div class="card">${UI.empty('没有可用项目', '当前身份没有可访问的项目。', UI.btn('返回项目创建', 'go:workspace/projects', 'btn-primary'))}</div>`);
          }
          const delivered = !!project.delivered;
          const rowsAll = DB.releases.filter(r => r.project === project.id && r.tenant === project.tenant);
          const channelOf = id => DB.channels.find(c => c.id === id) || { name: id, account: '-', status: '未知' };
          const online = rowsAll.filter(r => r.status === '已上线').length;
          const scheduled = rowsAll.filter(r => r.status === '已排期').length;
          const rows = rowsAll.map((r, index) => {
            const channel = channelOf(r.channel);
            return `<tr data-row data-status="${UI.esc(r.status)}" data-search="${UI.esc(channel.name)} ${UI.esc(channel.account)} ${UI.esc(r.note)}"><td>${UI.esc(channel.name)}</td><td class="mono">${UI.esc(channel.account)}</td><td class="mono">${UI.esc(r.slot)}</td><td>${UI.tag(r.status, r.status === '已上线' ? 'green' : r.status === '已排期' ? 'orange' : r.status === '已下线' ? '' : 'blue')}</td><td class="muted">${UI.esc(r.note)}</td><td class="row-actions">${r.status === '已排期' ? `<button type="button" class="btn btn-sm" data-action="release:publish" data-id="${index}">上线</button>` : ''}${r.status === '已上线' ? `<button type="button" class="btn btn-sm btn-ghost" data-action="release:offline" data-id="${index}">下线</button>` : ''}<button type="button" class="btn btn-sm btn-ghost" data-action="release:remove" data-id="${index}">删除</button></td></tr>`;
          }).join('');
          const channels = DB.channels.map(c => `<div class="kpi-line"><span>${UI.esc(c.name)} · ${UI.esc(c.account)} · ${UI.esc(c.expires)}</span><span>${UI.tag(c.status, c.status === '已授权' ? 'green' : 'orange')}${c.status === '待授权' && DB.state.identity === 'enterprise' ? ` <button type="button" class="btn btn-sm" data-action="channel:authorize" data-id="${UI.esc(c.id)}">授权</button>` : ''}</span></div>`).join('');

          return UI.page('WORKFLOW / RELEASE', '发布上线', '交付归档后按渠道排期发布；渠道授权、上线时间与版本记录与当前项目绑定。', `<div class="head-actions">${UI.btn('新增上线排期', 'release:new', delivered ? 'btn-primary' : 'btn', { id: project.id })}${UI.btn('查看交付归档', 'go:delivery/center?id=' + project.id, 'btn')}</div>`, `
    <div class="grid grid-3">${UI.metric('上线渠道', String(rowsAll.length), '当前项目已登记渠道', '↗')}${UI.metric('已上线 / 已排期', online + ' / ' + scheduled, '按当前项目发布状态统计', '✓')}${UI.metric('交付状态', delivered ? '已归档' : '待归档', '发布前置条件', delivered ? '▧' : '!')}</div>
    ${delivered ? '' : `<div class="notice warn section-gap">当前项目尚未完成交付归档，渠道排期需等待终审通过并生成交付包后才能提交。</div>`}
    <div class="card section-gap"><div class="card-head"><div><div class="card-title">渠道排期 · ${UI.esc(project.title)}</div><div class="card-sub mono">${UI.esc(project.id)}</div></div>${UI.tag(delivered ? '可排期' : '待交付', delivered ? 'green' : 'orange')}</div>${rowsAll.length ? UI.table(['渠道', '账号', '计划时间', '状态', '备注', '操作'], rows, '当前项目暂无上线排期') : UI.empty('当前项目尚未提交上线排期', delivered ? '交付包已归档，可提交渠道排期并记录上线时间。' : '完成成片终审与交付归档后，再提交渠道排期。', UI.btn(delivered ? '新增上线排期' : '前往成片终审', delivered ? 'release:new' : 'go:delivery/review', 'btn-sm', delivered ? { id: project.id } : undefined))}</div>
    <div class="card section-gap"><div class="card-title">企业渠道授权</div>${channels}<div class="notice section-gap">渠道账号由企业统一授权，租户只能为已授权渠道排期；发布记录只用于演示，不触达真实平台。</div></div>`);
        }
      }
    ]
  });

  /* ---------- 终审 ---------- */
  App.onAction('final:approve', trigger => {
    const project = App.project();
    if (!project) { App.toast('没有可终审的当前项目', 'error'); return; }
    const checks = Array.isArray(project.reviewChecks) ? project.reviewChecks : [];
    if (checks.length < CHECKS.length) {
      App.toast('请先逐项确认 ' + CHECKS.length + ' 项审核清单（当前 ' + checks.length + ' 项）', 'warning', '清单未完成');
      return;
    }
    App.confirm('通过最终成片审核', '通过后当前项目进入待交付状态，交付包生成与归档不可回退。', '审核通过', () => App.approveFinal(), {
      details: [{ key: '项目', value: project.title }, { key: '集数', value: (project.done || 0) + ' / ' + project.episodes }, { key: '审核清单', value: checks.length + ' / ' + CHECKS.length }]
    });
  });

  App.onAction('final:reject', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id) || App.project();
    if (!project) { return; }
    App.modal('退回返修 · ' + project.title, `<div class="notice warn">退回后项目回到制作中，已完成集次保留，需重新提交终审。</div><label class="field-wrap section-gap"><span class="field-label">返修范围与原因<i class="req" aria-hidden="true">*</i></span><textarea class="field" name="reason" rows="4" required minlength="10" maxlength="300" data-msg="请填写至少 10 个字符的返修说明"></textarea><span class="field-error" hidden></span></label>`, '确认退回', 'final:reject-submit', { danger: true, subtitle: project.id });
    App.rejectProjectId = project.id;
  });

  App.onSubmit('final:reject-submit', form => {
    const project = DB.projects.find(p => p.id === App.rejectProjectId);
    if (!project) { App.toast('项目不存在，请刷新重试', 'error'); return false; }
    const reason = String(form.get('reason') || '').trim();
    if (reason.length < 10) { App.toast('返修说明至少 10 个字符', 'error'); return false; }
    project.finalApproved = false;
    project.status = '后期制作中';
    project.stage = '后期返修';
    project.finalReviewNote = reason;
    project.reviewChecks = [];
    project.updated = '刚刚';
    App.recordReview(project, '成片审核', '退回修改', reason, '退回后期返修，重新提交终审');
    App.logAudit('退回成片返修', project.title + ' / ' + reason, '待处置', '交付');
    App.closeModal();
    App.renderShell();
    App.renderRoute();
    App.toast('成片已退回返修，原因已记录', 'warning', '已退回');
    return true;
  });

  App.onAction('review:preview', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id) || App.project();
    if (!project) { return; }
    const rows = Array.from({ length: Math.min(6, project.episodes) }, (_, i) => `<tr data-row><td>第 ${String(i + 1).padStart(2, '0')} 集</td><td>${i < (project.done || 0) ? '成片已生成' : '待生成'}</td><td class="mono">${i < (project.done || 0) ? '02:1' + (i % 10) : '—'}</td><td>${i < (project.done || 0) ? UI.tag('可预览', 'green') : UI.tag('未完成', 'orange')}</td></tr>`).join('');
    App.drawer('集次预览 · ' + project.title, `<div class="preview-frame"><div class="preview-play" aria-hidden="true">▶</div><div class="preview-note">演示预览画面 · 不包含真实视频流</div></div>${UI.table(['集次', '状态', '时长', '可预览'], rows, '暂无可预览集次')}`, { subtitle: project.episodes + ' 集 · 候选交付版本', footer: UI.btn('关闭', 'overlay:close', 'btn') });
  });

  App.onAction('review:export', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id) || App.project();
    if (!project) { return; }
    App.runAction(trigger, () => {
      const checks = Array.isArray(project.reviewChecks) ? project.reviewChecks : [];
      const reviewRows = (DB.reviews || []).filter(r => r.project === project.id).map(r => [r.type, r.version, r.reviewer, r.time, r.result, r.note, r.tasks || '—', r.followup || '—']);
      const rows = CHECKS.map((item, i) => ['终审清单', item, checks.indexOf(i) > -1 ? '已确认' : '未确认', '—', '—', '—', '—', '—'])
        .concat(reviewRows.map(r => ['审核记录', r[0] + ' ' + r[1], r[2], r[3], r[4], r[5], r[6], r[7]]));
      App.download(project.title + '_审核记录.csv', App.toCSV(['来源', '审核项 / 版本', '审核人', '时间', '结果', '意见', '关联任务', '后续处理'], rows), 'text/csv;charset=utf-8');
      App.logAudit('导出审核记录', project.title + ' / ' + reviewRows.length + ' 条审核记录', '成功', '交付');
    }, { loading: '正在导出…', delay: 500 });
  });

  /* ---------- 交付 ---------- */
  App.onAction('delivery:manifest', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id) || App.project();
    if (!project) { return; }
    App.runAction(trigger, () => {
      const rows = [
        ['完整成片 MP4', project.episodes + ' 集合集', '16.8 GB'],
        ['分集视频 MP4', project.episodes, '16.2 GB'],
        ['字幕 SRT / ASS', project.episodes, '0.8 MB'],
        ['封面与海报', project.coverAssets || 2, '48 MB'],
        ['宣传素材（预告/切片）', 4, '620 MB'],
        ['项目剧本与版本记录', (project.scriptVersion || 1) + ' 个版本', '3.2 MB'],
        ['人物设定与场景资产包', 12, '1.4 GB'],
        ['生产报告', 1, '86 KB'],
        ['质量报告（十维）', 1, '120 KB'],
        ['版权与来源授权资料', 6, '24 MB'],
        ['交付清单与校验文件', 1, '12 KB']
      ];
      App.download(project.title + '_交付清单_V1.csv', App.toCSV(['交付件', '数量', '体积'], rows), 'text/csv;charset=utf-8');
    }, { loading: '生成清单…', delay: 500 });
  });

  App.onAction('delivery:report', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id) || App.project();
    if (!project) { App.toast('请先选择项目', 'error'); return; }
    const kind = trigger.dataset.kind || 'production';
    App.runAction(trigger, () => {
      if (kind === 'quality') {
        const q = App.qualitySummary(project);
        const rows = q.rows.map(item => [item.dimension, item.status, item.score || 0, item.issues || 0, item.note, item.target, item.task]);
        App.download(project.title + '_质量报告.csv', App.toCSV(['维度', '状态', '评分', '问题数', '结论', '定位对象', '关联任务'], rows), 'text/csv;charset=utf-8');
        App.logAudit('导出交付质量报告', project.title + ' / 综合分 ' + q.score, '成功', '交付');
      } else if (kind === 'cost') {
        const tasks = (DB.productionTasks || []).filter(t => t.project === project.id);
        const cost = tasks.reduce((sum, t) => sum + (t.cost || 0), 0);
        const failed = tasks.reduce((sum, t) => sum + (t.failedCost || 0), 0);
        const rows = [['项目总成本', project.cost || 0], ['任务实际成本', cost], ['失败成本', failed], ['计划预算', project.budget || 0], ['预算使用率', (project.budget ? Math.round((project.cost || 0) / project.budget * 100) : 0) + '%'], ['单集成本', Math.round((project.cost || 0) / Math.max(project.episodes || 1, 1))], ['来源项目', project.id], ['口径', 'AI 调用 + 失败重试 + 后期处理']];
        App.download(project.title + '_成本报告.csv', App.toCSV(['指标', '值'], rows), 'text/csv;charset=utf-8');
        App.logAudit('导出交付成本报告', project.title + ' / ¥' + (project.cost || 0).toLocaleString(), '成功', '交付');
      } else if (kind === 'compliance') {
        const assets = DB.assets.filter(a => a.project === project.id);
        const rows = assets.map(a => [a.name, a.type, a.origin || '—', a.license || '—', a.commercial || '—', a.expires || '—']);
        App.download(project.title + '_合规版权摘要.csv', App.toCSV(['资产', '类型', '来源', '授权', '商业范围', '到期'], rows), 'text/csv;charset=utf-8');
        App.logAudit('导出合规版权摘要', project.title + ' / ' + rows.length + ' 项资产', '成功', '交付');
      } else {
        const tasks = (DB.productionTasks || []).filter(t => t.project === project.id);
        const reviews = (DB.reviews || []).filter(r => r.project === project.id);
        const rows = [['项目编号', project.id], ['项目名称', project.title], ['项目类型', project.projectType || '自制短剧'], ['集数', project.episodes], ['完成集数', project.done || 0], ['已交付集数', project.deliveredEpisodes || 0], ['剧本版本', 'V' + (project.scriptVersion || 1)], ['镜头单元', project.shotCount || 0], ['生产任务', tasks.length], ['任务成功率', (tasks.length ? Math.round(tasks.filter(t => t.status === '已完成').length / tasks.length * 100) : 0) + '%'], ['审核记录', reviews.length], ['累计成本', project.cost || 0], ['质量状态', project.qualityState || '待检测']];
        App.download(project.title + '_生产报告.csv', App.toCSV(['指标', '值'], rows), 'text/csv;charset=utf-8');
        App.logAudit('导出生产报告', project.title + ' / ' + tasks.length + ' 个任务', '成功', '交付');
      }
    }, { loading: '生成交付报告…', delay: 700 });
  });

  /* ---------- 发布 ---------- */
  App.onAction('release:new', trigger => {
    const project = DB.projects.find(p => p.id === trigger.dataset.id) || App.project();
    if (!project) { App.toast('请先选择项目', 'error'); return; }
    if (!project.delivered) { App.toast('当前项目尚未交付归档，不能提交上线排期', 'error', '前置条件未满足'); return; }
    const authorized = DB.channels.filter(c => c.status === '已授权');
    if (!authorized.length) { App.toast('当前企业没有已授权渠道，请先在渠道授权中处理', 'error'); return; }
    const options = authorized.map(c => ({ value: c.id, label: c.name + ' · ' + c.account }));
    const later = new Date(Date.now() + 86400000);
    const value = later.toISOString().slice(0, 16);
    App.modal('新增上线排期', `<div class="form-grid">${UI.fSelect('发布渠道', 'channel', options, { required: true })}${UI.fField('计划上线时间', 'slot', { value: value, type: 'datetime-local', required: true, hint: '不得早于当前时间' })}<label class="field-wrap full"><span class="field-label">排期备注</span><input class="field" name="note" maxlength="80" placeholder="首播集数、投放说明等"></label></div>`, '提交排期', 'release:create', { subtitle: project.title + ' / ' + project.id });
    App.releaseProjectId = project.id;
  });

  App.onSubmit('release:create', form => {
    const project = DB.projects.find(p => p.id === App.releaseProjectId);
    if (!project) { App.toast('项目不存在，请刷新重试', 'error'); return false; }
    const channelId = String(form.get('channel') || '');
    const channel = DB.channels.find(c => c.id === channelId);
    if (!channel || channel.status !== '已授权') { App.toast('所选渠道未授权，不能提交排期', 'error'); return false; }
    const raw = String(form.get('slot') || '');
    const when = raw ? new Date(raw) : null;
    if (!when || Number.isNaN(when.getTime())) { App.toast('请选择有效的计划上线时间', 'error'); return false; }
    if (when.getTime() < Date.now() - 60000) { App.toast('计划上线时间不能早于当前时间', 'error'); return false; }
    DB.releases.push({
      project: project.id, tenant: project.tenant, channel: channelId,
      slot: when.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-'),
      status: '已排期', note: String(form.get('note') || '渠道排期已提交'), operator: App.identity().user, updated: nowStamp()
    });
    App.logAudit('提交渠道上线排期', project.title + ' / ' + channel.name, '成功', '交付');
    App.save();
    App.closeModal();
    App.renderRoute();
    App.toast('已提交 ' + channel.name + ' 上线排期', 'success', '排期已创建');
    return true;
  });

  function releaseRowOf(trigger) {
    const project = App.project();
    if (!project) return null;
    const list = DB.releases.filter(r => r.project === project.id && r.tenant === project.tenant);
    return list[Number(trigger.dataset.id)] || null;
  }

  App.onAction('release:publish', trigger => {
    const row = releaseRowOf(trigger);
    if (!row) { App.toast('排期记录不存在', 'error'); return; }
    App.runAction(trigger, () => {
      row.status = '已上线';
      row.slot = nowStamp();
      row.updated = nowStamp();
      App.logAudit('渠道上线', channelName(row.channel) + ' / ' + row.project, '成功', '交付');
      App.save();
      App.renderRoute();
      App.toast('已上线 ' + channelName(row.channel), 'success', '上线成功');
    }, { loading: '上线中…', delay: 600 });
  });

  App.onAction('release:offline', trigger => {
    const row = releaseRowOf(trigger);
    if (!row) { return; }
    App.confirm('下线发布记录', '下线后观众端停止展示，历史上线记录保留。', '确认下线', () => {
      row.status = '已下线';
      row.updated = nowStamp();
      App.logAudit('渠道下线', channelName(row.channel) + ' / ' + row.project, '成功', '交付');
      App.save();
      App.renderRoute();
      App.toast('已下线 ' + channelName(row.channel), 'warning', '已下线');
    }, { details: [{ key: '渠道', value: channelName(row.channel) }, { key: '原上线时间', value: row.slot }], danger: true });
  });

  App.onAction('release:remove', trigger => {
    const row = releaseRowOf(trigger);
    if (!row) { return; }
    App.confirm('删除排期记录', '删除后该渠道排期不再展示，审计记录保留。', '确认删除', () => {
      DB.releases = DB.releases.filter(r => r !== row);
      App.logAudit('删除渠道排期', channelName(row.channel) + ' / ' + row.project, '成功', '交付');
      App.save();
      App.renderRoute();
      App.toast('排期记录已删除', 'success', '已删除');
    }, { danger: true });
  });

  App.onAction('channel:authorize', trigger => {
    const channel = DB.channels.find(c => c.id === trigger.dataset.id);
    if (!channel) { return; }
    App.confirm('授权渠道 · ' + channel.name, '授权后该租户可以为该渠道提交上线排期。', '确认授权', () => {
      channel.status = '已授权';
      channel.scope = '按租户申请范围';
      App.logAudit('授权发布渠道', channel.name + ' / ' + channel.account, '成功', '授权');
      App.save();
      App.renderRoute();
      App.toast(channel.name + ' 已授权', 'success', '授权成功');
    }, { details: [{ key: '渠道', value: channel.name }, { key: '账号', value: channel.account }] });
  });
})();
