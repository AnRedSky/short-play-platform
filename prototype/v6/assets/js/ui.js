/* ============================================================
   长夜制作台 V5 · 组件层
   无状态渲染助手：输入数据，返回 HTML 字符串。
   不持有业务状态，不操作 DOM，不依赖应用层。
   ============================================================ */
window.UI = (function () {
  var icons = {
    home: '<path d="M3 10.8 12 3.2l9 7.6"/><path d="M5.5 9.6V20.5h13V9.6"/><path d="M9.5 20.5v-6h5v6"/>',
    compass: '<circle cx="12" cy="12" r="8.6"/><path d="M15.8 8.2l-2.1 5.6-5.6 2.1 2.1-5.6z"/>',
    book: '<path d="M4.5 5.2c2.6-1.1 5.2-1.1 7.5.4v13.6c-2.3-1.5-4.9-1.5-7.5-.4z"/><path d="M19.5 5.2c-2.6-1.1-5.1-1.1-7.5.4v13.6c2.4-1.5 4.9-1.5 7.5-.4z"/>',
    feather: '<path d="M20 4c-7.5.4-12.3 4-14 11.6l-2 4.9 4.9-2C16.3 16.8 19.6 11.8 20 4z"/><path d="M4 21l7.4-7.4"/><path d="M12.6 12.9 9.7 10"/>',
    image: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.7"/><path d="M5 18l4.8-5 3.5 3.3 3.2-2.8 2.5 2.4"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
    activity: '<path d="M3 12h4l2.6-6 4.8 12 2.7-6H21"/>',
    check: '<circle cx="12" cy="12" r="8.6"/><path d="m8.6 12.2 2.4 2.4 4.6-4.6"/>',
    scissors: '<circle cx="6.5" cy="7" r="2.8"/><circle cx="6.5" cy="17" r="2.8"/><path d="M9 8.8 20 19"/><path d="M9 15.2 20 5"/>',
    download: '<path d="M12 3.5v11"/><path d="m7.8 10.6 4.2 4.2 4.2-4.2"/><path d="M4.5 16.5v3.2h15v-3.2"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.8 19.5c.4-3.4 2.5-5.2 5.2-5.2s4.8 1.8 5.2 5.2"/><circle cx="17" cy="8.6" r="2.6"/><path d="M15.6 14.4c2.6.2 4.2 1.8 4.6 4.6"/>',
    sliders: '<path d="M4 7h9"/><circle cx="16.5" cy="7" r="2"/><path d="M4 17h3"/><circle cx="10.5" cy="17" r="2"/><path d="M15.5 17h5.5"/><path d="M4 12h16"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.4"/><path d="m15.5 15.5 5 5"/>',
    bell: '<path d="M6 9.5a6 6 0 0 1 12 0c0 4.2 1.6 5.6 2.2 6.3H3.8c.6-.7 2.2-2.1 2.2-6.3z"/><path d="M10 19c.3.9.9 1.3 2 1.3s1.7-.4 2-1.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    down: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
    arrow: '<path d="M4 12h15"/><path d="m14 7 5 5-5 5"/>',
    x: '<path d="M6 6l12 12M18 6l-12 12"/>',
    alert: '<path d="M12 3.6 21 20H3z"/><path d="M12 9v5"/><circle cx="12" cy="17" r=".8"/>',
    clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.5V12l3.2 2"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/>',
    play: '<path d="M8 5.5v13l10-6.5z"/>',
    pause: '<path d="M9 6v12M15 6v12"/>',
    filter: '<path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    spark: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8z"/><path d="M19 15.5l.8 2.2 2.2.8-2.2.8-.8-2.2-2.2-.8z"/>',
    edit: '<path d="M5 18.8 5.9 14.5 15.8 4.6l3.6 3.6L9.5 18.1z"/><path d="M13.8 6.6l3.6 3.6"/>',
    upload: '<path d="M12 16.5V5.5"/><path d="m7.8 9.4 4.2-4.2 4.2 4.2"/><path d="M4.5 16.5v3.2h15v-3.2"/>',
    folder: '<path d="M3.5 6.5h6l2 2h9v10.5h-17z"/>',
    more: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
    trash: '<path d="M4.5 7h15"/><path d="M9 7V5h6v2"/><path d="M6.5 7l.8 13h9.4l.8-13"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.3"/><path d="M4 5v5h5"/><path d="M4 13a8 8 0 0 0 14.6 4.3"/><path d="M20 19v-5h-5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r=".9"/><circle cx="4" cy="12" r=".9"/><circle cx="4" cy="18" r=".9"/>',
    eye: '<path d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6z"/><circle cx="12" cy="12" r="2.6"/>'
  };

  var SCENES = {
    bookstore: "assets/img/still-bookstore.png",
    alley: "assets/img/still-alley.png",
    room: "assets/img/still-room.png"
  };

  function esc(v) {
    return String(v === undefined || v === null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function icon(name, size) {
    var d = icons[name] || icons.grid;
    return '<svg viewBox="0 0 24 24" width="' + (size || 16) + '" height="' + (size || 16) +
      '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  }

  function pageHead(o) {
    return '<div class="page-head"><div class="ph-main">' +
      (o.eyebrow ? '<span class="eyebrow">' + esc(o.eyebrow) + "</span>" : "") +
      '<h1 class="page-title">' + esc(o.title) + "</h1>" +
      (o.desc ? '<p class="page-desc">' + o.desc + "</p>" : "") +
      "</div>" + (o.actions ? '<div class="page-actions">' + o.actions + "</div>" : "") + "</div>";
  }

  function card(o) {
    return '<section class="card ' + (o.cls || "") + '">' +
      (o.title ? '<div class="card-head"><div><h3>' + esc(o.title) + "</h3>" +
        (o.sub ? '<div class="ch-sub">' + o.sub + "</div>" : "") + "</div>" + (o.head ? o.head : "") + "</div>" : "") +
      '<div class="card-body ' + (o.bodyCls || "") + '">' + o.body + "</div>" +
      (o.foot ? '<div class="card-foot">' + o.foot + "</div>" : "") + "</section>";
  }

  function stat(o) {
    return '<div class="card stat"><div class="s-label">' + esc(o.label) + '</div><div class="s-val">' +
      esc(o.value) + (o.unit ? "<small>" + esc(o.unit) + "</small>" : "") + "</div>" +
      '<div class="s-delta">' + (o.delta || "") + "</div></div>";
  }

  function progress(value, cls) {
    var n = Math.max(0, Math.min(100, Number(value) || 0));
    return '<div class="progress ' + (cls || "") + '"><i style="width:' + n + '%"></i></div>';
  }

  function ring(value, size) {
    var n = Math.max(0, Math.min(100, Number(value) || 0));
    return '<div class="ring" style="--p:' + n + ';--size:' + (size || 56) + 'px"><span>' + n + "</span></div>";
  }

  function statusBadge(status, text) {
    var map = {
      done: ["b-done", "已完成"], active: ["b-active", "进行中"], review: ["b-warn", "待审核"],
      todo: ["b-todo", "待开始"], locked: ["b-locked", "未解锁"], failed: ["b-danger", "失败"],
      running: ["b-active", "进行中"], queued: ["b-todo", "排队中"], succeeded: ["b-done", "已完成"],
      cancelled: ["b-todo", "已取消"], ready: ["b-teal", "已就绪"], draft: ["b-info", "草稿"],
      pending: ["b-todo", "待生成"], approved: ["b-done", "审核通过"], rejected: ["b-danger", "已退回"],
      connected: ["b-done", "已连接"], unconfigured: ["b-todo", "未配置"], parsed: ["b-teal", "已解析"],
      confirmed: ["b-done", "已确认"], generating: ["b-active", "生成中"], warning: ["b-warn", "有警告"]
    };
    var m = map[status] || ["b-todo", text || status];
    return '<span class="badge ' + m[0] + '"><span class="dot"></span>' + esc(text || m[1]) + "</span>";
  }

  function badge(text, tone) {
    return '<span class="badge ' + (tone || "b-todo") + '"><span class="dot"></span>' + esc(text) + "</span>";
  }

  function avatar(name, size, color) {
    return '<span class="avatar ' + (size || "") + ' ' + (color || "") + '">' + esc(String(name || "?").charAt(0)) + "</span>";
  }

  function empty(title, desc, action) {
    return '<div class="empty"><div class="e-icon">' + icon("folder", 20) + '</div><div class="e-title">' + esc(title) +
      '</div><div class="e-desc">' + (desc || "") + "</div>" + (action || "") + "</div>";
  }

  function assetThumb(a, cls) {
    var color = a.color || "#7a6a55";
    var shell = '<div class="asset-thumb ' + (cls || "") + '" style="background:linear-gradient(155deg,' + hexA(color, .2) + "," + color + ')">';
    if (a.thumb) {
      return shell + '<img src="' + esc(a.thumb) + '" alt="' + esc(a.name) + '" loading="lazy">' +
        '<span class="at-badge badge b-todo" style="background:rgba(255,255,255,.88)">' + esc(a.version || "") + "</span></div>";
    }
    return shell +
      '<span class="at-glyph">' + esc(a.initial || String(a.name || "?").charAt(0)) + "</span>" +
      '<span class="at-badge badge b-todo" style="background:rgba(255,255,255,.88)">' + esc(a.version || "") + "</span></div>";
  }

  function hexA(hex, alpha) {
    var h = String(hex || "#7a6a55").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0;
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function scene(name) {
    return SCENES[name] || SCENES.bookstore;
  }

  function tabs(items, active, act) {
    return '<div class="tabs">' + items.map(function (it) {
      return '<button class="tab' + (it.key === active ? " active" : "") + '" data-act="' + act + '" data-key="' + it.key + '">' +
        esc(it.label) + (it.count !== undefined ? '<span class="tab-count">' + it.count + "</span>" : "") + "</button>";
    }).join("") + "</div>";
  }

  function table(cols, rows, cls) {
    if (!rows.length) return empty("没有匹配结果", "调整筛选条件，或新建一条记录。");
    return '<div class="table-wrap ' + (cls || "") + '"><table><thead><tr>' + cols.map(function (c) {
      return "<th>" + esc(c) + "</th>";
    }).join("") + "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>";
  }

  return {
    icon: icon, esc: esc, pageHead: pageHead, card: card, stat: stat, progress: progress, ring: ring,
    statusBadge: statusBadge, badge: badge, avatar: avatar, empty: empty, assetThumb: assetThumb,
    hexA: hexA, scene: scene, tabs: tabs, table: table
  };
})();
