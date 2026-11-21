/* 组件层：无状态渲染助手。输入数据，返回标记，不持有业务状态、不操作页面容器。 */
window.UI = {
  esc(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  /* 文本兜底：空值统一显示占位说明，不出现 undefined / null / NaN / [object Object] */
  text(value, fallback = '—') {
    const str = String(value === null || value === undefined ? '' : value).trim();
    return str && str !== 'undefined' && str !== 'null' && str !== 'NaN' && str !== '[object Object]' ? str : fallback;
  },

  tag(text, tone = '') {
    return `<span class="tag ${this.esc(tone)}">${this.esc(this.text(text))}</span>`;
  },

  /* dataset 用于挂行内标识，避免把多层引号表达式写进内联事件 */
  btn(text, action, kind = '', dataset) {
    const attrs = dataset ? Object.keys(dataset).map(key => ` data-${this.esc(key)}="${this.esc(dataset[key])}"`).join('') : '';
    return `<button type="button" class="btn ${this.esc(kind)}" data-action="${this.esc(action)}"${attrs}>${this.esc(text)}</button>`;
  },

  metric(label, value, foot, mark = '↗') {
    return `<article class="card metric"><span class="metric-mark" aria-hidden="true">${this.esc(mark)}</span><div class="metric-label">${this.esc(this.text(label))}</div><div class="metric-value">${this.esc(this.text(value))}</div><div class="metric-foot">${this.esc(this.text(foot))}</div></article>`;
  },

  page(kicker, title, desc, actions = '', body = '') {
    const rawActions = String(actions || '').trim();
    const actionHtml = /^<div class="head-actions"/.test(rawActions) ? rawActions : `<div class="head-actions">${rawActions}</div>`;
    return `<section class="page"><header class="page-head"><div><div class="eyebrow">${this.esc(this.text(kicker))}</div><h1 class="page-title">${this.esc(this.text(title))}</h1><p class="page-desc">${this.esc(this.text(desc))}</p></div>${actionHtml}</header>${body}</section>`;
  },

  card(title, content, sub = '') {
    return `<section class="card"><div class="card-head"><div><div class="card-title">${this.esc(this.text(title))}</div>${sub ? `<div class="card-sub">${this.esc(this.text(sub))}</div>` : ''}</div></div>${content}</section>`;
  },

  /* 表格：列定义与行数据分离，行入参兼容数组与字符串；空结果行由筛选助手控制显隐 */
  table(headers, rows, emptyText = '没有符合条件的记录') {
    const body = Array.isArray(rows) ? rows.join('') : String(rows === null || rows === undefined ? '' : rows);
    return `<div class="table-wrap"><table class="table"><thead><tr>${headers.map(h => `<th>${this.esc(this.text(h))}</th>`).join('')}</tr></thead><tbody>${body}<tr class="table-empty-row" data-empty-row ${body.trim() ? 'hidden' : ''}><td colspan="${headers.length}"><div class="empty"><div class="empty-icon" aria-hidden="true">◌</div><b>${this.esc(emptyText)}</b><p>调整搜索关键词或筛选条件后重试。</p></div></td></tr></tbody></table></div>`;
  },

  field(label, name, value = '', type = 'text', hint = '', dataset) {
    const attrs = dataset ? Object.keys(dataset).map(key => ` data-${this.esc(key)}="${this.esc(dataset[key])}"`).join('') : '';
    return `<label class="field-wrap"><span class="field-label">${this.esc(label)}</span><input class="field" name="${this.esc(name)}" type="${this.esc(type)}" value="${this.esc(value)}"${attrs}>${hint ? `<span class="field-hint">${this.esc(hint)}</span>` : ''}</label>`;
  },

  select(label, name, options, value = '', dataset) {
    const attrs = dataset ? Object.keys(dataset).map(key => ` data-${this.esc(key)}="${this.esc(dataset[key])}"`).join('') : '';
    return `<label class="field-wrap"><span class="field-label">${this.esc(label)}</span><select class="field" name="${this.esc(name)}"${attrs}>${options.map(o => `<option value="${this.esc(o.value)}" ${o.value === value ? 'selected' : ''}>${this.esc(o.label)}</option>`).join('')}</select></label>`;
  },

  /* ---------- 表单控件（带校验占位）：统一 required / minlength / 提示与错误位 ---------- */
  fField(label, name, opts = {}) {
    const { value = '', type = 'text', placeholder = '', required = false, hint = '', min, max, step, minlength, maxlength, msg = '', full = false, readonly = false, dataset } = opts;
    const attrs = [
      required ? 'required' : '', min !== undefined ? `min="${this.esc(min)}"` : '', max !== undefined ? `max="${this.esc(max)}"` : '',
      step !== undefined ? `step="${this.esc(step)}"` : '', minlength !== undefined ? `minlength="${this.esc(minlength)}"` : '',
      maxlength !== undefined ? `maxlength="${this.esc(maxlength)}"` : '', msg ? `data-msg="${this.esc(msg)}"` : '',
      readonly ? 'readonly' : '',
      dataset ? Object.keys(dataset).map(key => ` data-${this.esc(key)}="${this.esc(dataset[key])}"`).join('') : ''
    ].filter(Boolean).join(' ');
    return `<label class="field-wrap${full ? ' full' : ''}"><span class="field-label">${this.esc(label)}${required ? '<i class="req" aria-hidden="true">*</i>' : ''}</span><input class="field" name="${this.esc(name)}" type="${this.esc(type)}" value="${this.esc(value)}" placeholder="${this.esc(placeholder)}" ${attrs}><span class="field-error" hidden></span>${hint ? `<span class="field-hint">${this.esc(hint)}</span>` : ''}</label>`;
  },

  fSelect(label, name, options, opts = {}) {
    const { value = '', required = false, hint = '', full = false, dataset, msg = '' } = opts;
    const attrs = [
      required ? 'required' : '', msg ? `data-msg="${this.esc(msg)}"` : '',
      dataset ? Object.keys(dataset).map(key => ` data-${this.esc(key)}="${this.esc(dataset[key])}"`).join('') : ''
    ].filter(Boolean).join(' ');
    return `<label class="field-wrap${full ? ' full' : ''}"><span class="field-label">${this.esc(label)}${required ? '<i class="req" aria-hidden="true">*</i>' : ''}</span><select class="field" name="${this.esc(name)}" ${attrs}>${options.map(o => `<option value="${this.esc(o.value)}" ${o.value === value ? 'selected' : ''}>${this.esc(o.label)}</option>`).join('')}</select><span class="field-error" hidden></span>${hint ? `<span class="field-hint">${this.esc(hint)}</span>` : ''}</label>`;
  },

  fTextarea(label, name, opts = {}) {
    const { value = '', placeholder = '', required = false, hint = '', rows = 4, maxlength, minlength, full = true, msg = '', dataset } = opts;
    const attrs = [
      required ? 'required' : '', minlength !== undefined ? `minlength="${this.esc(minlength)}"` : '',
      maxlength !== undefined ? `maxlength="${this.esc(maxlength)}"` : '', msg ? `data-msg="${this.esc(msg)}"` : '',
      dataset ? Object.keys(dataset).map(key => ` data-${this.esc(key)}="${this.esc(dataset[key])}"`).join('') : ''
    ].filter(Boolean).join(' ');
    return `<label class="field-wrap${full ? ' full' : ''}"><span class="field-label">${this.esc(label)}${required ? '<i class="req" aria-hidden="true">*</i>' : ''}</span><textarea class="field" name="${this.esc(name)}" rows="${rows}" placeholder="${this.esc(placeholder)}" ${attrs}>${this.esc(value)}</textarea><span class="field-error" hidden></span>${hint ? `<span class="field-hint">${this.esc(hint)}</span>` : ''}</label>`;
  },

  fCheck(label, name, opts = {}) {
    const { checked = false, value = '1', hint = '' } = opts;
    return `<label class="check-line"><input type="checkbox" name="${this.esc(name)}" value="${this.esc(value)}" ${checked ? 'checked' : ''}><span>${this.esc(label)}</span></label>${hint ? `<div class="field-hint">${this.esc(hint)}</div>` : ''}`;
  },

  iconBtn(text, action, label, extra = '', dataset) {
    const attrs = dataset ? Object.keys(dataset).map(key => ` data-${this.esc(key)}="${this.esc(dataset[key])}"`).join('') : '';
    return `<button type="button" class="icon-btn ${this.esc(extra)}" data-action="${this.esc(action)}" aria-label="${this.esc(label || text)}" title="${this.esc(label || text)}"${attrs}>${this.esc(text)}</button>`;
  },

  empty(title, desc, action = '') {
    return `<div class="empty"><div class="empty-icon" aria-hidden="true">◌</div><b>${this.esc(this.text(title))}</b><p>${this.esc(this.text(desc))}</p>${action}</div>`;
  },

  kpi(label, value) {
    return `<div class="kpi-line"><span>${this.esc(label)}</span><b>${value}</b></div>`;
  },

  chart(values, labels) {
    const list = (Array.isArray(values) ? values : []).map(v => Math.max(2, Math.min(100, Number(v) || 0)));
    if (!list.length) return this.empty('暂无图表数据', '接入真实数据后在此展示趋势。');
    return `<div class="chart-bars">${list.map((v, i) => `<div class="chart-col"><div class="chart-bar ${i === list.length - 1 ? 'em' : ''}" style="height:${v}%"></div><span class="chart-label">${this.esc(this.text(labels && labels[i], '—'))}</span></div>`).join('')}</div>`;
  },

  progress(value, label) {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    return `<div class="progress-label"><span>${this.esc(this.text(label))}</span><b>${pct}%</b></div><div class="progress"><span style="width:${pct}%"></span></div>`;
  }
};
