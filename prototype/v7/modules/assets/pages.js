/* 模块：数字资产（assets）— 项目资产目录、版本与归属追溯 */
AppModule.register({
  group: 'assets',
  label: '07 / 数字资产',
  icon: '▧',
  routes: [
    {
      path: 'assets/library',
      stage: 'assets',
      title: '素材资产',
      icon: '▧',
      permission: 'assets',
      render(params) {
        const project = App.resolveProject(params ? params.get('id') : '');
        if (!project) {
          return UI.page('DIGITAL ASSET / LIBRARY', '尚未选择项目', '选择项目后查看该项目的数字资产与版本关系。', '', `<div class="card">${UI.empty('没有可用项目', '当前身份没有可访问的项目。', UI.btn('返回项目中心', 'go:workspace/projects', 'btn-primary'))}</div>`);
        }
        const list = DB.assets.filter(a => a.tenant === project.tenant && a.project === project.id);
        const countOf = type => list.filter(a => a.type === type).length;
        const types = ['人物设定', '场景设定', '分镜', '视频', '音频', '成片', '剧本'];
        const typeOptions = types.map(t => `<option value="${UI.esc(t)}">${UI.esc(t)}</option>`).join('');
        const rows = list.map(a => `<tr data-row data-type="${UI.esc(a.type)}" data-search="${UI.esc(a.name)} ${UI.esc(a.id)} ${UI.esc(a.owner)} ${UI.esc(a.version)}"><td><div class="entity"><div class="entity-mark" aria-hidden="true">${UI.esc(a.type.slice(0, 1))}</div><div><div class="entity-name">${UI.esc(a.name)}</div><div class="entity-meta mono">${UI.esc(a.id)}</div></div></div></td><td>${UI.esc(a.type)}</td><td>${UI.esc(project.title)}</td><td class="mono">${UI.esc(a.version)}</td><td>${UI.esc(a.owner)}</td><td>${UI.esc(a.date)}</td><td class="row-actions"><button type="button" class="btn btn-sm" data-action="asset:view" data-id="${UI.esc(a.id)}">详情</button><button type="button" class="btn btn-sm" data-action="asset:version" data-id="${UI.esc(a.id)}">新版本</button></td></tr>`).join('');

        return UI.page('DIGITAL ASSET / LIBRARY', '数字资产中心', '当前项目：' + project.title + ' · 统一管理剧本、人物、场景、分镜、视频、音频与成片资产。', `<div class="head-actions">${UI.btn('上传资产', 'asset:new', 'btn-primary', { id: project.id })}${UI.btn('查看项目档案', 'go:workspace/detail?id=' + project.id, 'btn')}</div>`, `
    <div class="grid grid-4">${UI.metric('当前项目资产', String(list.length), '仅展示所选项目资产', '▧')}${UI.metric('人物 / 场景', countOf('人物设定') + ' / ' + countOf('场景设定'), '可追溯视觉身份档案', '♙')}${UI.metric('分镜 / 音频', countOf('分镜') + ' / ' + countOf('音频'), '关联镜头生产单元', '♫')}${UI.metric('正式成片', String(countOf('成片')), '当前项目归档资产', '▶')}</div>
    <div class="card section-gap"><div class="toolbar"><div class="toolbar-left"><b class="small">资产目录 · ${UI.esc(project.title)}</b><span class="tiny muted mono">${UI.esc(project.id)}</span></div><div class="toolbar-right"><select class="field toolbar-select" data-row-filter="type" aria-label="按资产类型筛选"><option value="all">全部类型</option>${typeOptions}</select><input class="search" data-filter placeholder="搜索资产名称 / 编号"><button class="btn btn-sm" data-action="filter:clear">重置</button></div></div>${UI.table(['资产名称', '类型', '来源项目', '版本', '创建者', '更新时间', '操作'], rows, '当前项目暂无资产')}</div>
    ${list.length ? '' : `<div class="card section-gap">${UI.empty('当前项目暂无资产', '上传首个资产，或进入 AI 创作与生产流程自动生成资产。', UI.btn('上传资产', 'asset:new', 'btn-primary', { id: project.id }))}</div>`}
    <div class="notice section-gap">资产复用遵循租户边界。跨租户引用需要明确授权，不因企业级汇总权限自动获得素材读取或修改权。</div>`);
      }
    }
  ]
});

/* ---------- 资产操作 ---------- */
App.onAction('asset:new', trigger => {
  const project = App.project();
  if (!project) { App.toast('请先选择项目', 'error'); return; }
  App.modal('上传数字资产 · ' + project.title, `<div class="notice">演示环境不上传真实文件，仅登记资产元信息与版本。</div><div class="form-grid section-gap">${UI.fField('资产名称', 'name', { required: true, minlength: 2, maxlength: 40 })}${UI.fSelect('资产类型', 'type', [{ value: '', label: '请选择类型' }, { value: '人物设定', label: '人物设定' }, { value: '场景设定', label: '场景设定' }, { value: '分镜', label: '分镜' }, { value: '视频', label: '视频' }, { value: '音频', label: '音频' }, { value: '成片', label: '成片' }, { value: '剧本', label: '剧本' }], { required: true })}${UI.fField('初始版本', 'version', { value: 'V1', required: true, hint: '如 V1 / V2' })}${UI.fField('格式', 'format', { value: 'PNG', required: true })}${UI.fField('资产说明', 'note', { full: true, maxlength: 120 })}</div>`, '上传资产', 'asset:create', { subtitle: '归属 ' + project.id + ' / ' + project.tenant });
});

App.onSubmit('asset:create', (form) => {
  const project = App.project();
  if (!project) { App.toast('项目上下文已失效，请刷新后重试', 'error'); return false; }
  const name = String(form.get('name') || '').trim();
  const type = String(form.get('type') || '');
  if (!name || !type) { App.toast('请填写资产名称并选择类型', 'error'); return false; }
  const version = String(form.get('version') || 'V1').trim().toUpperCase();
  const asset = {
    id: 'AS-' + String(1000 + DB.assets.length + 1),
    name: name,
    type: type,
    project: project.id,
    version: version,
    owner: App.identity().user,
    date: new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }).replace(/\//g, '-'),
    tenant: project.tenant,
    format: String(form.get('format') || 'PNG'),
    note: String(form.get('note') || ''),
    size: '—'
  };
  DB.assets.unshift(asset);
  App.logAudit('上传数字资产', asset.name + ' / ' + asset.id, '成功', '项目');
  App.save();
  App.closeModal();
  App.renderRoute();
  App.toast('资产「' + asset.name + '」已登记到当前项目', 'success', '上传成功');
  return true;
});

App.onAction('asset:view', trigger => {
  const asset = DB.assets.find(a => a.id === trigger.dataset.id);
  if (!asset) { App.toast('资产记录不存在', 'error'); return; }
  const project = DB.projects.find(p => p.id === asset.project && p.tenant === asset.tenant);
  const history = Array.isArray(asset.history) ? asset.history : [];
  const historyRows = history.map(h => `<tr data-row><td class="mono">${UI.esc(h.version)}</td><td>${UI.esc(h.date)}</td><td>${UI.esc(h.owner || asset.owner)}</td><td>${UI.esc(h.note || '—')}</td></tr>`).join('');
  App.drawer('资产详情 · ' + asset.name, `<div class="mono tiny muted">${UI.esc(asset.id)}</div><div class="grid grid-2 section-gap">${UI.kpi('类型', UI.esc(asset.type))}${UI.kpi('当前版本', UI.esc(asset.version))}${UI.kpi('来源项目', UI.esc(project ? project.title : '项目已删除'))}${UI.kpi('归属租户', UI.esc((DB.tenants.find(t => t.id === asset.tenant) || {}).name || '未知'))}${UI.kpi('创建者', UI.esc(asset.owner))}${UI.kpi('更新时间', UI.esc(asset.date))}</div><div class="notice section-gap">${UI.esc(asset.note || '未填写资产说明。')}</div><div class="card-title section-gap">历史版本</div>${history.length ? UI.table(['版本', '时间', '操作人', '变更说明'], historyRows, '暂无历史版本') : UI.empty('暂无历史版本', '创建新版本后，旧版本会保留在此处供追溯。')}<div class="section-gap">${project ? UI.btn('打开来源项目', 'go:workspace/detail?id=' + project.id, 'btn') : ''}${UI.btn('下载资产（演示）', 'asset:download', 'btn', { id: asset.id })}</div>`, { subtitle: asset.type + ' · ' + asset.version, footer: UI.btn('关闭', 'overlay:close', 'btn') });
});

App.onAction('asset:download', trigger => {
  const asset = DB.assets.find(a => a.id === trigger.dataset.id);
  if (!asset) { return; }
  const sourceProject = DB.projects.find(p => p.id === asset.project && p.tenant === asset.tenant);
  App.runAction(trigger, () => App.download(asset.name + '_' + asset.version + '.txt', '资产：' + asset.name + '\n类型：' + asset.type + '\n项目：' + (sourceProject ? sourceProject.title : '—') + '\n版本：' + asset.version + '\n\n（演示占位文件，不包含真实媒体内容。）', 'text/plain;charset=utf-8'), { loading: '准备下载…' });
});

App.onAction('asset:version', trigger => {
  const asset = DB.assets.find(a => a.id === trigger.dataset.id);
  if (!asset) { App.toast('资产记录不存在', 'error'); return; }
  const next = 'V' + (Number(String(asset.version).replace(/\D/g, '')) + 1);
  App.modal('创建资产新版本', `<div class="notice">新版本不会覆盖旧版本，历史版本仍可追溯。</div><div class="form-grid section-gap">${UI.fField('资产名称', 'name', { value: asset.name, required: true })}${UI.fField('新版本号', 'version', { value: next, required: true })}${UI.fField('变更说明', 'note', { full: true, required: true, minlength: 5, maxlength: 160, value: '', msg: '请填写至少 5 个字符的变更说明' })}</div>`, '创建版本', 'asset:version-submit', { subtitle: asset.id });
  App.editingAssetId = asset.id;
});

App.onSubmit('asset:version-submit', (form) => {
  const asset = DB.assets.find(a => a.id === App.editingAssetId);
  if (!asset) { App.toast('资产记录不存在，请刷新后重试', 'error'); return false; }
  const newVersion = String(form.get('version') || '').trim().toUpperCase();
  const newNote = String(form.get('note') || '').trim();
  if (!/^V\d+$/.test(newVersion)) { App.toast('版本号格式应为 V1、V2 这样的形式', 'error'); return false; }
  if (newVersion === asset.version) { App.toast('新版本号不能与当前版本相同', 'warning'); return false; }
  if (newNote.length < 5) { App.toast('变更说明至少 5 个字符', 'error'); return false; }
  asset.history = Array.isArray(asset.history) ? asset.history : [];
  asset.history.unshift({ version: asset.version, date: asset.date, owner: App.identity().user, note: asset.note || '' });
  asset.name = String(form.get('name') || asset.name).trim();
  asset.version = newVersion;
  asset.note = newNote;
  asset.date = new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  App.logAudit('创建资产新版本', asset.name + ' / ' + asset.version, '成功', '项目');
  App.save();
  App.closeModal();
  App.renderRoute();
  App.toast('已创建 ' + asset.version + ' 版本，旧版本保持可追溯', 'success', '版本创建成功');
  return true;
});

App.onAction('asset:delete', trigger => {
  const asset = DB.assets.find(a => a.id === trigger.dataset.id);
  if (!asset) { App.toast('资产记录不存在', 'error'); return; }
  App.confirm('移除资产', '移除后该资产不再出现在当前项目目录，历史版本记录同步移除。', '确认移除', () => {
    DB.assets = DB.assets.filter(a => a.id !== asset.id);
    App.logAudit('移除数字资产', asset.name + ' / ' + asset.id, '成功', '项目');
    App.save();
    App.renderRoute();
    App.toast('资产已从当前项目移除', 'success', '已移除');
  }, { details: [{ key: '资产', value: asset.name }, { key: '编号', value: asset.id }, { key: '版本', value: asset.version }], danger: true, note: '移除操作只影响当前项目的资产目录。' });
});
