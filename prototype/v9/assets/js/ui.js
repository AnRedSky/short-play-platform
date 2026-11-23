/* ui.js：组件层。纯渲染助手，输入数据返回标记；不持有业务状态、不访问 DOM、不调用 App。 */
window.UI = (function () {
  const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const STATUS_TEXT = { PASS: "通过", FAIL: "未通过", REVIEW: "待人工判断", REVIEW_REQUIRED: "需人工判断" };

  /* ---------- 基础 ---------- */
  function esc(value) {
    let s = String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, c => ESC_MAP[c]);
    return s.replace(/\bREVIEW_REQUIRED\b/g, "需人工判断").replace(/\bREVIEW\b/g, "待人工判断").replace(/\bPASS\b/g, "通过").replace(/\bFAIL\b/g, "未通过");
  }
  function text(value, fallback = "—") {
    const s = String(value === null || value === undefined ? "" : value).trim();
    if (STATUS_TEXT[s]) return STATUS_TEXT[s];
    return s && s !== "undefined" && s !== "null" && s !== "NaN" && s !== "[object Object]" ? s : fallback;
  }
  function toneOf(status) {
    const s = String(status || "");
    const map = (window.DB && DB.enums && DB.enums.toneByStatus) || {};
    if (map[s]) return map[s];
    if (/成功|通过|已交付|已归档|正常|健康|启用|在职|已确认|已计量/.test(s)) return "ok";
    if (/失败|异常|阻断|停用|终止|冻结|需处理|未通过/.test(s)) return "bad";
    if (/待|排队|执行中|处理中|接近|待核实|编辑中/.test(s)) return "warn";
    return "info";
  }
  function pill(label, tone) { return '<span class="pill ' + esc(tone || toneOf(label)) + '">' + esc(text(label)) + "</span>"; }
  function dot(tone) { return '<span class="pill ' + esc(tone) + '"><i class="dot"></i></span>'; }
  function tag(label) { return '<span class="tag">' + esc(text(label)) + "</span>"; }
  function code(label) { return '<span class="code">' + esc(text(label)) + "</span>"; }
  function kv(label, value) { return '<div class="kv"><span>' + esc(label) + "</span><b>" + esc(text(value)) + "</b></div>"; }

  /* ---------- 图标（内联 SVG，统一 1.6 描边，无第三方依赖） ---------- */
  const ICONS = {
    home: "M4 11 12 4l8 7M6 10v8h5v-5h2v5h5v-8",
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    users: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 19c0-3 2.7-5 6-5s6 2 6 5M17 19c0-2 .8-3.4 2-4.2",
    folder: "M3 7h6l2 2h10v9H3z",
    pen: "M4 20l3-1 10-10-2-2-10 10zM14 6l4 4",
    film: "M4 5h16v14H4zM9 5v14M15 5v14",
    video: "M3 8h11v8H3zM14 11l7-4v10l-7-4",
    audio: "M4 10v4h3l4 4V6l-4 4H4zM16 9c1.5 1 1.5 5 0 6",
    scissors: "M7 4l10 16M17 4L7 20M5 6a2 2 0 104 0 2 2 0 00-4 0M15 18a2 2 0 104 0 2 2 0 00-4 0",
    shield: "M12 3l8 3v6c0 5-3.6 7.8-8 9-4.4-1.2-8-4-8-9V6z",
    chart: "M4 20V10M10 20V6M16 20V13M22 20V4",
    wallet: "M3 8h18v10H3zM3 8l3-3h12l3 3M16 13h3",
    key: "M10 12a3 3 0 100-6 3 3 0 000 6zM12 10l8-6M17 5l2 2",
    bell: "M6 17c0-6 2-9 6-9s6 3 6 9H6zM10 19c.5 2 3.5 2 4 0",
    alert: "M12 4l9 16H3zM12 10v4M12 17h.01",
    cube: "M12 4l8 4v8l-8 4-8-4V8zM4 8l8 4 8-4M12 12v8",
    archive: "M4 8h16v11H4zM3 4h18v4H3zM9 12h6",
    check: "M4 12l5 5 11-12",
    list: "M5 7h14M5 12h14M5 17h9",
    board: "M4 5h16v14H4zM9 5v14M14 5v14",
    chain: "M9 13a4 4 0 010-6l2-2a4 4 0 016 6l-1 1M15 11a4 4 0 010 6l-2 2a4 4 0 01-6-6l1-1",
    cpu: "M8 8h8v8H8zM4 10h4M4 14h4M16 10h4M16 14h4M10 4v4M14 4v4M10 16v4M14 16v4",
    route: "M4 6h6l8 12h2M4 18h4M12 6h8",
    gauge: "M4 18a8 8 0 0116 0M12 18l3-5",
    box: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
    doc: "M6 4h8l4 4v12H6zM14 4v4h4",
    rotate: "M4 12a8 8 0 0113-6M17 3v4h-4M20 12a8 8 0 01-13 6M7 21v-4h4",
    user: "M12 11a3 3 0 100-6 3 3 0 000 6zM5 20c0-3.4 3-5.5 7-5.5s7 2.1 7 5.5",
    coin: "M12 21a9 9 0 100-18 9 9 0 000 18zM8 9l4 4 4-4M8 15h8",
    clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v5l3 2",
    server: "M4 5h16v5H4zM4 14h16v5H4zM7 7.5h.01M7 16.5h.01",
    gavel: "M14 4l6 6M11 7l6 6M9 15l6-6M4 20l7-7"
  };
  function ico(name, size) {
    const d = ICONS[name] || ICONS.grid;
    return '<svg viewBox="0 0 24 24" width="' + (size || 16) + '" height="' + (size || 16) + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  function icon(name, size) { return '<span class="nav-ico">' + ico(name, size || 16) + "</span>"; }

  /* ---------- 按钮 ---------- */
  function btn(label, action, kind, dataset) {
    const attrs = dataset ? Object.keys(dataset).map(k => ' data-' + esc(k) + '="' + esc(dataset[k]) + '"').join("") : "";
    return '<button type="button" class="btn ' + esc(kind || "") + '" data-action="' + esc(action) + '"' + attrs + ">" + esc(label) + "</button>";
  }
  function iconBtn(glyph, action, label, dataset) {
    const attrs = dataset ? Object.keys(dataset).map(k => ' data-' + esc(k) + '="' + esc(dataset[k]) + '"').join("") : "";
    return '<button type="button" class="icon-btn" data-action="' + esc(action) + '" aria-label="' + esc(label) + '" title="' + esc(label) + '"' + attrs + ">" + esc(glyph) + "</button>";
  }
  function seg(items, current, actionKey) {
    return '<div class="btn-group">' + items.map(it => {
      const value = typeof it === "string" ? it : it.value;
      const label = typeof it === "string" ? it : it.label;
      return '<button type="button" class="seg' + (value === current ? " on" : "") + '" data-action="' + esc(actionKey) + '" data-value="' + esc(value) + '">' + esc(label) + "</button>";
    }).join("") + "</div>";
  }

  /* ---------- 页面与卡片 ---------- */
  function page(kicker, title, desc, actions, body) {
    const raw = String(actions || "").trim();
    const actionsHtml = !raw ? "" : (/^<div class="head-actions"/.test(raw) ? raw : '<div class="head-actions">' + raw + "</div>");
    return '<section class="page"><header class="page-head"><div><div class="kicker">' + esc(kicker) + "</div><h1>" + esc(title) + '</h1><p>' + esc(desc) + "</p></div>" + actionsHtml + "</header>" + body + "</section>";
  }
  function card(title, body, sub, tools) {
    const head = title ? '<div class="card-head"><div><div class="card-title">' + esc(title) + "</div>" + (sub ? '<div class="card-sub">' + esc(sub) + "</div>" : "") + "</div>" + (tools ? '<div class="card-tools">' + tools + "</div>" : "") + "</div>" : "";
    return '<section class="card">' + head + '<div class="card-body">' + body + "</div></section>";
  }
  function metric(label, value, foot, mark) {
    return '<article class="card metric"><span class="metric-mark" aria-hidden="true">' + esc(mark || "↗") + '</span><div class="metric-label">' + esc(label) + '</div><div class="metric-value">' + value + '</div><div class="metric-foot">' + (foot || "") + "</div></article>";
  }
  function notice(textHtml, kind) {
    return '<div class="notice ' + esc(kind || "") + '">' + textHtml + "</div>";
  }
  function empty(title, desc, action) {
    return '<div class="empty"><div class="empty-icon">◌</div><b>' + esc(text(title)) + "</b><p>" + esc(text(desc)) + "</p>" + (action || "") + "</div>";
  }
  function projectGuard(kicker, note) {
    return page(kicker, "项目不在可见范围", note || "该链接指向的项目不存在，或当前身份无权查看；本页不会回退到其他项目。", btn("返回项目列表", "common.projects", "primary"), empty("无法读取项目", "请从项目中心选择可见项目，或在制作流水线中进入当前阶段。"));
  }

  /* ---------- 表格 ---------- */
  function table(headers, rows, emptyText) {
    const body = Array.isArray(rows) ? rows.join("") : String(rows || "");
    const emptyRow = body.trim() ? "" : '<tr class="table-empty-row"><td colspan="' + headers.length + '">' + empty("没有符合条件的记录", emptyText || "调整搜索关键词或筛选条件后重试。") + "</td></tr>";
    return '<div class="table-wrap"><table class="table"><thead><tr>' + headers.map(h => "<th>" + esc(h) + "</th>").join("") + "</thead><tbody>" + body + emptyRow + "</tbody></table></div>";
  }
  function tableFoot(left, right) {
    return '<div class="table-foot"><span>' + esc(left) + "</span><span>" + esc(right) + "</span></div>";
  }
  function entity(name, sub, glyph) {
    return '<div class="entity"><span class="avatar">' + esc(text(glyph || String(name || "·").slice(0, 1))) + '</span><div><b>' + esc(text(name)) + "</b>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</div></div>";
  }

  /* ---------- 表单控件 ---------- */
  function ruleAttrs(o) {
    return [o.min !== undefined ? 'data-min="' + esc(o.min) + '"' : "", o.max !== undefined ? 'data-max="' + esc(o.max) + '"' : "",
      o.minlen !== undefined ? 'data-minlen="' + esc(o.minlen) + '"' : "", o.pattern ? 'data-pattern="' + esc(o.pattern) + '"' : "",
      o.required ? 'data-required="1"' : "",
      o.rule ? 'data-rule="' + esc(o.rule) + '"' : ""].filter(Boolean).join(" ");
  }
  function fField(label, name, opts) {
    const o = opts || {};
    const attrs = [o.required ? "required" : "", o.type === "number" ? 'inputmode="numeric"' : "", o.readonly ? "readonly" : "", o.value !== undefined ? 'value="' + esc(o.value) + '"' : "", 'placeholder="' + esc(o.placeholder || "") + '"', o.full ? 'data-full="1"' : "", ruleAttrs(o)].filter(Boolean).join(" ");
    return '<label class="field-wrap' + (o.full ? " full" : "") + '"><span class="field-label">' + esc(label) + (o.required ? '<i class="req">*</i>' : "") + '</span><input class="field" name="' + esc(name) + '" type="' + esc(o.type || "text") + '" ' + attrs + '><span class="field-error" hidden></span>' + (o.hint ? '<span class="field-hint">' + esc(o.hint) + "</span>" : "") + "</label>";
  }
  function fSelect(label, name, options, opts) {
    const o = opts || {};
    const list = options.map(v => typeof v === "string" ? { value: v, label: v } : v);
    return '<label class="field-wrap' + (o.full ? " full" : "") + '"><span class="field-label">' + esc(label) + (o.required ? '<i class="req">*</i>' : "") + '</span><select class="field" name="' + esc(name) + '" ' + ruleAttrs(o) + ">" + list.map(it => '<option value="' + esc(it.value) + '"' + (it.value === o.value ? " selected" : "") + ">" + esc(it.label) + "</option>").join("") + '</select><span class="field-error" hidden></span>' + (o.hint ? '<span class="field-hint">' + esc(o.hint) + "</span>" : "") + "</label>";
  }
  function fTextarea(label, name, opts) {
    const o = opts || {};
    return '<label class="field-wrap full"><span class="field-label">' + esc(label) + (o.required ? '<i class="req">*</i>' : "") + '</span><textarea class="field" name="' + esc(name) + '" rows="' + (o.rows || 4) + '" placeholder="' + esc(o.placeholder || "") + '" ' + ruleAttrs(o) + ">" + esc(o.value || "") + '</textarea><span class="field-error" hidden></span>' + (o.hint ? '<span class="field-hint">' + esc(o.hint) + "</span>" : "") + "</label>";
  }
  function fCheck(label, name, opts) {
    const o = opts || {};
    return '<label class="check-line"><input type="checkbox" name="' + esc(name) + '" value="' + esc(o.value || "1") + '"' + (o.checked ? " checked" : "") + "><span>" + esc(label) + "</span></label>";
  }
  function radioCards(name, options, current, opts) {
    const o = opts || {};
    return '<div class="radio-grid"' + (o.action ? ' data-radio-action="' + esc(o.action) + '"' : "") + ">" + options.map(op => '<label class="radio-card' + (op.value === current ? " on" : "") + '"><input type="radio" name="' + esc(name) + '" value="' + esc(op.value) + '"' + (op.value === current ? " checked" : "") + '><div><b>' + esc(op.label) + "</b><span>" + esc(op.desc) + "</span></div></label>").join("") + "</div>";
  }

  /* ---------- 页签 ---------- */
  function tabs(items, current, actionKey) {
    return '<div class="tabs">' + items.map(it => '<button type="button" class="tab' + (it.value === current ? " active" : "") + '" data-action="' + esc(actionKey) + '" data-value="' + esc(it.value) + '">' + esc(it.label) + (it.count !== undefined ? '<span class="count-badge">' + esc(it.count) + "</span>" : "") + "</button>").join("") + "</div>";
  }

  /* ---------- 数据展示 ---------- */
  function desc(pairs) {
    return '<dl class="desc">' + pairs.map(p => "<dt>" + esc(p[0]) + "</dt><dd>" + (p[2] ? p[1] : esc(text(p[1]))) + "</dd>").join("") + "</dl>";
  }
  function listRows(rows) {
    return '<div class="list">' + rows.map(r => '<div class="list-row"><span class="k">' + esc(r[0]) + '</span><span class="v">' + (r[2] ? r[1] : esc(text(r[1]))) + "</span></div>").join("") + "</div>";
  }
  function progress(value, label, cls) {
    const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    return '<div class="progress-label"><span>' + esc(text(label)) + "</span><b class=\"num\">" + pct + '%</b></div><div class="progress"><span class="' + esc(cls || "") + '" style="width:' + pct + '%"></span></div>';
  }
  function stackbar(items) {
    const total = items.reduce((sum, it) => sum + (Number(it.value) || 0), 0) || 1;
    return '<div class="stackbar">' + items.map(it => '<span title="' + esc(it.label + " " + (it.value || 0)) + '" style="width:' + Math.round((Number(it.value) || 0) / total * 100) + "%;background:" + esc(it.color || "var(--accent)") + '"></span>').join("") + '</div><div class="legend">' + items.map(it => '<span><i style="background:' + esc(it.color || "var(--accent)") + '"></i>' + esc(it.label) + " " + esc(it.value) + "</span>").join("") + "</div>";
  }
  function bars(labels, values, suffix) {
    const max = Math.max.apply(null, values.concat([1]));
    return '<div class="bars">' + labels.map((l, i) => '<div class="col"><div class="track"><span' + (i === labels.length - 1 ? ' class="hi"' : "") + ' style="height:' + Math.max(4, Math.round(values[i] / max * 100)) + '%"></span></div><b class="num">' + esc(values[i] + (suffix || "")) + "</b><small>" + esc(l) + "</small></div>").join("") + "</div>";
  }
  function hbar(label, value, max, suffix) {
    const pct = Math.max(2, Math.min(100, Math.round((Number(value) || 0) / (Number(max) || 1) * 100)));
    return '<div class="hbar"><span>' + esc(label) + '</span><div class="track"><span style="width:' + pct + '%"></span></div><span class="val">' + esc((value || 0) + (suffix || "")) + "</span></div>";
  }
  function miniBar(value, max) {
    const pct = Math.max(2, Math.min(100, Math.round((Number(value) || 0) / (Number(max) || 1) * 100)));
    return '<span class="mini-bar"><span class="track"><span style="width:' + pct + '%"></span></span></span>';
  }
  /* 折线图：内联 SVG 手绘，显式传入序列与标签 */
  function lineChart(labels, series, opts) {
    const o = opts || {};
    const w = 640, h = o.height || 168, pad = { l: 34, r: 12, t: 14, b: 24 };
    const max = Math.max.apply(null, series.map(s => Math.max.apply(null, s.values)).concat([1]));
    const stepX = (w - pad.l - pad.r) / Math.max(labels.length - 1, 1);
    const y = v => pad.t + (h - pad.t - pad.b) * (1 - v / max);
    const paths = series.map(s => {
      const pts = s.values.map((v, i) => (pad.l + stepX * i) + "," + y(v));
      const area = 'fill="' + esc(s.color) + '" opacity=".06"';
      return '<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + esc(s.color) + '" stroke-width="1.8" stroke-linejoin="round"/>' +
        '<polygon ' + area + ' points="' + (pad.l + "," + (h - pad.b) + " " + pts.join(" ") + " " + (pad.l + stepX * (labels.length - 1)) + "," + (h - pad.b)) + '"/>' +
        pts.map(p => { const x = p.split(",")[0]; return '<circle cx="' + x + '" cy="' + y(s.values[pts.indexOf(p)]) + '" r="2.4" fill="' + esc(s.color) + '"/>'; }).join("");
    }).join("");
    const grid = [0, .5, 1].map(f => { const gy = Math.round(y(max * f)); return '<line x1="' + pad.l + '" y1="' + gy + '" x2="' + (w - pad.r) + '" y2="' + gy + '" stroke="var(--line)" stroke-width="1"/><text x="4" y="' + (gy + 3) + '" font-size="9" fill="var(--faint)">' + Math.round(max * f) + "</text>"; }).join("");
    const xlab = labels.map((l, i) => '<text x="' + (pad.l + stepX * i) + '" y="' + (h - 6) + '" font-size="9" fill="var(--faint)" text-anchor="middle">' + esc(l) + "</text>").join("");
    return '<svg class="chart" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + esc(o.title || "趋势图") + '">' + grid + paths + xlab + "</svg>" +
      '<div class="chart-legend">' + series.map(s => '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:' + esc(s.color) + ';margin-right:5px"></i>' + esc(s.name) + "</span>").join("") + "</div>";
  }
  function donut(items, centerLabel, centerValue) {
    const total = items.reduce((sum, it) => sum + (Number(it.value) || 0), 0) || 1;
    let acc = 0, paths = "";
    items.forEach(it => {
      const start = acc / total * Math.PI * 2 - Math.PI / 2;
      acc += Number(it.value) || 0;
      const end = acc / total * Math.PI * 2 - Math.PI / 2;
      const r = 54, cx = 64, cy = 64;
      const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start), x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
      paths += '<path d="M' + x1.toFixed(1) + " " + y1.toFixed(1) + " A" + r + " " + r + ' 0 ' + ((end - start) > Math.PI ? 1 : 0) + " 1 " + x2.toFixed(1) + " " + y2.toFixed(1) + '" stroke="' + esc(it.color) + '" stroke-width="14" fill="none"/>';
    });
    return '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="' + esc(centerLabel || "占比") + '">' + paths + '<text x="64" y="60" font-size="20" font-weight="700" text-anchor="middle" fill="var(--ink)">' + esc(centerValue || total) + '</text><text x="64" y="77" font-size="9" text-anchor="middle" fill="var(--muted)">' + esc(centerLabel || "") + "</text></svg>" +
      '<div style="flex:1;min-width:140px">' + items.map(it => '<div class="list-row"><span class="k"><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + esc(it.color) + ';margin-right:6px"></i>' + esc(it.label) + '</span><span class="v">' + esc(it.value) + " · " + Math.round((Number(it.value) || 0) / total * 100) + "%</span></div>").join("") + "</div></div>";
  }
  function matrix(rows, cols) {
    const cellMap = { PASS: "ok", REVIEW_REQUIRED: "warn", REVIEW: "warn", FAIL: "bad" };
    return '<div class="table-wrap matrix"><table><thead><tr><th>检测维度</th>' + cols.map(c => "<th>" + esc(c.label || c) + "</th>").join("") + "</tr></thead><tbody>" +
      rows.map(r => "<tr><td class=\"label\">" + esc(r.dim) + "</td>" + cols.map(c => {
        const v = r[c.key || c];
        return '<td>' + (v === null || v === undefined ? '<span class="cell na">—</span>' : '<span class="cell ' + cellMap[v] + '">' + esc(text(v)) + "</span>") + "</td>";
      }).join("") + "</tr>").join("") + "</tbody></table></div>";
  }
  function timeline(items) {
    return '<div class="timeline">' + items.map(it => '<div class="timeline-item' + (it.mute ? " mute" : "") + '"><time>' + esc(it.time) + "</time><b>" + esc(it.title) + "</b>" + (it.desc ? "<p>" + esc(it.desc) + "</p>" : "") + "</div>").join("") + "</div>";
  }
  function chain(nodes) {
    return '<div class="chain">' + nodes.map((n, i) => '<div class="chain-node ' + esc(n.state || "") + '"><b>' + esc(n.label) + "</b><small>" + esc(n.meta || "") + "</small></div>" + (i < nodes.length - 1 ? '<div class="chain-arrow">→</div>' : "")).join("") + "</div>";
  }
  function shotCard(shot) {
    return '<article class="shot-card"><div class="shot-frame"><span class="frame-tag">' + esc(shot.no || shot.id) + '</span><span class="frame-meta">' + esc([shot.frame, shot.angle, shot.duration].filter(Boolean).join(" · ")) + '</span></div><div class="shot-body"><b>' + esc(text(shot.desc)) + "</b><small>" + esc(text(shot.chars, "无人物")) + " · " + esc(text(shot.status)) + "</small></div></article>";
  }
  function kanban(cols) {
    return '<div class="kanban">' + cols.map(c => '<div class="kanban-col"><h4><span>' + esc(c.title) + '</span><span class="num">' + c.items.length + "</span></h4>" + (c.items.length ? c.items.map(it => '<div class="kanban-item"><b>' + esc(text(it.title)) + "</b>" + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + (it.tags ? '<div class="thread">' + it.tags.map(t => pill(t)).join("") + "</div>" : "") + "</div>").join("") : '<div class="muted small" style="padding:10px 0">该列暂无事项</div>') + "</div>").join("") + "</div>";
  }
  function masked(value) { return '<span class="masked">' + esc(value) + "</span>"; }

  const COVERS = {
    "SP-26031": "assets/img/covers/wucheng.jpg",
    "SP-26032": "assets/img/covers/changye.jpg",
    "SP-26028": "assets/img/covers/changjie.jpg",
    "SP-26015": "assets/img/covers/matou.jpg"
  };
  function cover(projectId) { return COVERS[projectId] || ""; }

  function storyFrame(shot) {
    if (!shot) return "";
    if (shot.project === "SP-26015") return "assets/img/covers/matou.jpg";
    if (shot.project === "SP-26028") return "assets/img/covers/changjie.jpg";
    if (shot.project === "SP-26032") return "assets/img/covers/changye.jpg";
    if (shot.ep === 17 && shot.order === 5) return "assets/img/covers/shot-dialogue.jpg";
    if (shot.ep === 17 && shot.order === 4) return "assets/img/covers/shot-rain.jpg";
    if (shot.ep === 17 && shot.order === 6) return "assets/img/covers/shot-post.jpg";
    return "assets/img/covers/" + (["shot-read.jpg", "shot-post2.jpg", "wucheng.jpg", "shot-street.jpg"][(Number(shot.order) || 0) % 4]);
  }

  return {
    esc, text, toneOf, pill, dot, tag, code, kv, ico, icon,
    btn, iconBtn, seg, page, card, metric, notice, empty, projectGuard,
    table, tableFoot, entity,
    fField, fSelect, fTextarea, fCheck, radioCards,
    tabs, desc, listRows, progress, stackbar, bars, hbar, miniBar,
    lineChart, donut, matrix, timeline, chain, shotCard, kanban, masked,
    cover, storyFrame
  };
})();
