/* ============================================================
   长夜制作台 V4 · 全局界面组件
   ============================================================ */
window.SP = window.SP || {};

(function () {
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
    trash: '<path d="M4.5 7h15"/><path d="M9 7V5h6v2"/><path d="M6.5 7l.8 13h9.4l.8-13"/>'
  };

  function icon(name, size) {
    var d = icons[name] || icons.grid;
    return '<svg viewBox="0 0 24 24" width="' + (size || 16) + '" height="' + (size || 16) +
      '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  }

  var NAV = [
    { label: "制作", items: [
      { key: "index", label: "工作台", href: "index.html", icon: "home" },
      { key: "project", label: "项目总览", href: "project.html", icon: "compass" }
    ]},
    { label: "内容", items: [
      { key: "story", label: "故事圣经", href: "story.html", icon: "book" },
      { key: "import", label: "小说改编", href: "import.html", icon: "feather" },
      { key: "episodes", label: "分集与剧本", href: "episodes.html", icon: "grid", badge: "12" },
      { key: "assets", label: "资产库", href: "assets.html", icon: "image" },
      { key: "storyboard", label: "分镜台", href: "storyboard.html", icon: "activity" }
    ]},
    { label: "协作", items: [
      { key: "tasks", label: "AI 任务中心", href: "tasks.html", icon: "spark", badgeFn: "tasks" },
      { key: "review", label: "质检与审核", href: "review.html", icon: "check", badge: "1", hot: true }
    ]},
    { label: "交付", items: [
      { key: "timeline", label: "剪辑时间线", href: "timeline.html", icon: "scissors" },
      { key: "export", label: "导出交付", href: "export.html", icon: "download" }
    ]},
    { label: "系统", items: [
      { key: "team", label: "团队与权限", href: "team.html", icon: "users" },
      { key: "settings", label: "模型与用量", href: "settings.html", icon: "sliders" }
    ]}
  ];

  var PARENT = { script: "episodes" };

  function rail(active) {
    var s = SP.init();
    var running = SP.taskRunning();
    var pct = SP.epProgress("01");
    var activeKey = PARENT[active] || active;
    var groups = NAV.map(function (g) {
      return '<div class="nav-label">' + g.label + '</div><div class="nav" style="margin-bottom:6px">' +
        g.items.map(function (it) {
          var badge = "";
          if (it.badgeFn === "tasks" && running > 0) badge = '<span class="ni-badge hot">' + running + "</span>";
          else if (it.badge) badge = '<span class="ni-badge' + (it.hot ? " hot" : "") + '">' + it.badge + "</span>";
          return '<a class="nav-item' + (it.key === activeKey ? " active" : "") + '" href="' + it.href + '">' +
            '<span class="ni-icon">' + icon(it.icon, 15) + "</span><span>" + it.label + "</span>" + badge + "</a>";
        }).join("") + "</div>";
    }).join("");

    return '<div class="brand">' +
        '<span class="brand-mark"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><path d="M5 19V8.5L12 4l7 4.5V19"/><path d="M9 19v-6h6v6"/><circle cx="12" cy="10" r="1.2" fill="#fff" stroke="none"/></svg></span>' +
        '<span><span class="brand-name">长夜制作台</span><br><span class="brand-sub">Long Night Studio</span></span>' +
      "</div>" +
      '<button class="project-switch" data-act="projects">' +
        '<span class="ps-badge">长</span>' +
        '<span class="ps-main"><span class="ps-name">长夜将明</span><br><span class="ps-meta">' + s.project.code + " · " + s.project.episodes + ' 集 · 9:16</span></span>' +
        '<span class="chev">' + icon("down", 13) + "</span>" +
      "</button>" +
      '<nav style="flex:1;min-height:0;overflow-y:auto;padding-right:4px">' + groups + "</nav>" +
      '<div class="rail-progress">' +
        '<div class="rp-top"><strong>EP01 雨夜书店</strong><span>' + pct + "%</span></div>" +
        '<div class="rp-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="rp-foot"><span>资产与分镜进行中</span><span>5 / 8</span></div>' +
      "</div>" +
      '<div class="rail-user">' +
        '<span class="avatar">' + s.user.initial + "</span>" +
        '<span class="ru-main"><span class="ru-name">' + s.user.name + '</span><br><span class="ru-role">' + s.user.role + "</span></span>" +
        '<button class="icon-btn" data-act="account" title="账号与工作区" style="color:#9d99a3">' + icon("more", 16) + "</button>" +
      "</div>";
  }

  function topbar(active, crumbLabel) {
    var s = SP.init();
    var running = SP.taskRunning();
    return '<div class="row" style="min-width:0">' +
        '<button class="icon-btn" data-act="menu" id="menuBtn" style="display:none" aria-label="打开导航">' + icon("menu") + "</button>" +
        '<div class="crumb"><span>长夜将明</span><span class="sep">/</span><b>' + (crumbLabel || "") + '</b><span class="badge b-teal" style="margin-left:6px">制作中</span></div>' +
      "</div>" +
      '<div class="spacer"></div>' +
      '<button class="search-trigger" data-act="search">' + icon("search", 14) + "<span>搜索页面、角色、镜头…</span><span class=\"kbd\">⌘ K</span></button>" +
      '<a class="task-pill" href="tasks.html" title="查看运行中的 AI 任务"><span class="pulse"></span>' + running + " 个任务运行中</a>" +
      '<a class="icon-btn" href="team.html" title="团队">' + icon("users") + "</a>" +
      '<span class="avatar sm" title="' + s.user.name + " · " + s.user.role + '">' + s.user.initial + "</span>";
  }

  function mount(active, crumbLabel) {
    var aside = document.getElementById("rail");
    if (aside) { aside.innerHTML = rail(active); aside.id = "rail"; }
    var top = document.getElementById("topbar");
    if (top) top.innerHTML = topbar(active, crumbLabel);
    document.body.insertAdjacentHTML("beforeend", '<div class="rail-scrim" id="railScrim"></div>');
    bindGlobal(active);
    var mq = window.matchMedia("(max-width: 980px)");
    if (mq.matches) {
      var mb = document.getElementById("menuBtn");
      if (mb) mb.style.display = "grid";
    }
  }

  function bindGlobal(active) {
    document.addEventListener("click", function (e) {
      var act = e.target.closest("[data-act]");
      if (!act) return;
      var a = act.getAttribute("data-act");
      if (a === "menu") { document.getElementById("rail").classList.add("open"); document.getElementById("railScrim").classList.add("show"); }
      if (a === "search") openPalette();
      if (a === "projects") openProjects();
      if (a === "account") openAccount();
    });
    document.addEventListener("click", function (e) {
      if (e.target.id === "railScrim") {
        document.getElementById("rail").classList.remove("open");
        e.target.classList.remove("show");
      }
    });
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); openPalette();
      }
      if (e.key === "Escape") {
        var p = document.querySelector(".palette.open");
        if (p) closePalette();
        var r = document.getElementById("rail");
        if (r) r.classList.remove("open");
        var sc = document.getElementById("railScrim");
        if (sc) sc.classList.remove("show");
      }
    });
    // 关闭移动导航
    mqListener();
  }

  function mqListener() {
    var mq = window.matchMedia("(max-width: 980px)");
    function apply() {
      var b = document.getElementById("menuBtn");
      if (b) b.style.display = mq.matches ? "grid" : "none";
      if (!mq.matches) {
        var rail = document.getElementById("rail");
        var sc = document.getElementById("railScrim");
        if (rail) rail.classList.remove("open");
        if (sc) sc.classList.remove("show");
      }
    }
    if (mq.addEventListener) mq.addEventListener("change", apply);
    apply();
  }

  /* ---------- 项目切换 ---------- */
  function openProjects() {
    var s = SP.get();
    var body = '<div class="stack">' + s.projects.map(function (p) {
      var current = p.id === "nyjm";
      return '<button class="card card-pad" data-proj="' + p.id + '" style="text-align:left;display:flex;align-items:center;gap:14px;padding:14px 16px;' +
        (current ? "border-color:#e9b3a5;background:#fffbf9;" : "") + '">' +
        '<span style="width:38px;height:38px;border-radius:10px;background:' + (current ? "#e2553d" : "#e9e3d7") + ';color:' + (current ? "#fff" : "#5a554b") + ';display:grid;place-items:center;font-family:var(--font-serif);font-size:15px">' + p.name.charAt(0) + "</span>" +
        '<span style="flex:1;min-width:0"><span style="font-size:13px;font-weight:600">' + p.name + "</span>" +
        '<span class="small muted" style="display:block">' + p.code + " · " + p.episodes + " 集 · " + p.genre + " · " + p.stage + "</span></span>" +
        '<span class="badge ' + (current ? "b-active" : "b-todo") + '">' + (current ? "当前项目" : p.status) + "</span>" +
      "</button>";
    }).join("") + "</div>" +
      '<div class="notice info mt-16">' + icon("alert", 15) + "<span>V4 演示数据完整覆盖《长夜将明》。其余项目为工作台示例卡，不承载独立数据。</span></div>";
    var m = modal({
      title: "切换项目",
      sub: "项目是生产数据与权限的边界，切换后会重新加载项目上下文。",
      body: body,
      footer: '<button class="btn" data-close>取消</button>'
    });
    m.el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-proj]");
      if (!b) return;
      if (b.getAttribute("data-proj") === "nyjm") { m.close(); return; }
      toast("示例项目", "该卡片仅用于演示工作台布局，暂无独立数据。", "warn");
    });
  }

  /* ---------- 账号 ---------- */
  function openAccount() {
    var s = SP.get();
    var body = '<div class="row" style="gap:14px;padding:6px 0 14px">' +
        '<span class="avatar lg">' + s.user.initial + "</span>" +
        '<div><div style="font-family:var(--font-serif);font-size:18px">' + s.user.name + "</div>" +
        '<div class="small muted">' + s.user.email + " · " + s.user.role + "</div></div></div>" +
      '<div class="notice">账号归属「长夜工作室」。项目权限由服务端成员关系决定，原型中以演示状态呈现。</div>' +
      '<div class="grid g2 mt-16">' +
        '<a class="btn" href="team.html">团队与权限</a>' +
        '<a class="btn" href="settings.html">模型与用量</a>' +
      "</div>";
    modal({
      title: "账号与工作区",
      sub: "演示账号已登录，可直接体验全部流程。",
      body: body,
      footer: '<a class="btn" href="login.html" style="border-color:#e7c9c3;color:#a33a29">退出演示账号</a><button class="btn btn-dark" data-close>继续制作</button>'
    });
  }

  /* ---------- 搜索面板 ---------- */
  var paletteEl = null;

  function openPalette() {
    if (paletteEl) { paletteEl.remove(); paletteEl = null; }
    var s = SP.get();
    var pages = [];
    NAV.forEach(function (g) { g.items.forEach(function (i) { pages.push({ group: "页面", title: i.label, sub: "长夜制作台 · " + g.label, href: i.href, icon: i.icon }); }); });
    pages.push({ group: "页面", title: "剧本编辑器", sub: "长夜制作台 · 内容", href: "script.html?ep=01", icon: "feather" });
    pages.push({ group: "页面", title: "登录 / 演示入口", sub: "账号", href: "login.html", icon: "users" });

    var items = pages.slice();
    s.episodes.forEach(function (e) {
      items.push({ group: "剧集", title: "EP" + e.no + " · " + e.title, sub: e.hook, href: "script.html?ep=" + e.no, icon: "book" });
    });
    s.characters.forEach(function (c) {
      items.push({ group: "角色", title: c.name, sub: c.role, href: "story.html?tab=character", icon: "users" });
    });
    s.assets.forEach(function (a) {
      items.push({ group: "资产", title: a.name, sub: a.version + " · 引用 " + a.refs + " 次", href: "assets.html", icon: "image" });
    });
    s.shots.forEach(function (sh) {
      items.push({ group: "镜头", title: sh.id + " · " + sh.title, sub: sh.ep + " 集 · " + sh.size, href: "storyboard.html", icon: "activity" });
    });

    paletteEl = document.createElement("div");
    paletteEl.className = "palette open";
    paletteEl.innerHTML = '<div class="palette-box" role="dialog" aria-label="全局搜索">' +
        '<div class="palette-input">' + icon("search", 16) + '<input id="paletteInput" placeholder="搜索页面、剧集、角色、资产或镜头…" autocomplete="off">' +
        '<span class="tiny muted mono">ESC 关闭</span></div>' +
        '<div class="palette-list" id="paletteList"></div>' +
        '<div style="border-top:1px solid var(--line);padding:8px 16px;display:flex;gap:16px;font-size:10px;color:var(--muted)"><span>↑↓ 移动</span><span>Enter 打开</span><span>⌘K 随时唤起</span></div>' +
      "</div>";
    document.body.appendChild(paletteEl);
    var input = paletteEl.querySelector("#paletteInput");
    var list = paletteEl.querySelector("#paletteList");
    var filtered = items;
    var sel = 0;

    function render() {
      var groups = {};
      filtered.slice(0, 14).forEach(function (it) { (groups[it.group] = groups[it.group] || []).push(it); });
      var idx = 0;
      list.innerHTML = Object.keys(groups).map(function (g) {
        return '<div class="palette-group-label">' + g + "</div>" + groups[g].map(function (it) {
          var current = idx++;
          return '<div class="palette-item' + (current === sel ? " sel" : "") + '" data-idx="' + current + '" data-href="' + it.href + '">' +
            '<span class="pi-icon">' + icon(it.icon, 14) + "</span>" +
            '<span class="pi-main"><span class="pi-title">' + it.title + '</span><span class="pi-sub truncate">' + it.sub + "</span></span>" +
            '<span class="pi-key">↵</span></div>';
        }).join("");
      }).join("") || empty("没有匹配结果", "换一个关键词，例如「周砚」「S0107」「审核」。");
    }
    function apply() {
      var q = input.value.trim().toLowerCase();
      filtered = items.filter(function (it) { return !q || (it.title + it.sub).toLowerCase().indexOf(q) > -1; });
      sel = 0; render();
    }
    function go() {
      var el = list.querySelector('[data-idx="' + sel + '"]');
      if (el) window.location.href = el.getAttribute("data-href");
    }
    input.addEventListener("input", apply);
    list.addEventListener("mousemove", function (e) {
      var el = e.target.closest("[data-idx]");
      if (!el) return;
      sel = Number(el.getAttribute("data-idx")); render();
    });
    list.addEventListener("click", function (e) {
      var el = e.target.closest("[data-href]");
      if (el) window.location.href = el.getAttribute("data-href");
    });
    paletteEl.addEventListener("click", function (e) { if (e.target === paletteEl) closePalette(); });
    document.addEventListener("keydown", onKey);
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); closePalette(); }
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(filtered.length - 1, sel + 1); render(); }
      if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); render(); }
      if (e.key === "Enter") { e.preventDefault(); go(); }
    }
    paletteEl._onKey = onKey;
    apply();
    setTimeout(function () { input.focus(); }, 30);
  }

  function closePalette() {
    if (!paletteEl) return;
    document.removeEventListener("keydown", paletteEl._onKey);
    paletteEl.remove(); paletteEl = null;
  }

  /* ---------- 模态 ---------- */
  function modal(opts) {
    var overlay = document.createElement("div");
    overlay.className = "overlay open";
    overlay.innerHTML = '<div class="modal ' + (opts.size || "") + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><div><h3>' + opts.title + "</h3>" + (opts.sub ? "<p>" + opts.sub + "</p>" : "") + "</div>" +
        '<button class="close-x" data-close aria-label="关闭">✕</button></div>' +
        '<div class="modal-body">' + opts.body + "</div>" +
        (opts.footer ? '<div class="modal-foot">' + opts.footer + "</div>" : "") +
      "</div>";
    document.body.appendChild(overlay);
    function close() { overlay.remove(); }
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.closest("[data-close]")) close();
    });
    if (opts.onMount) opts.onMount(overlay.querySelector(".modal"), close);
    return { el: overlay, close: close };
  }

  function drawer(opts) {
    var wrap = document.createElement("div");
    wrap.className = "drawer-wrap open";
    wrap.innerHTML = '<div class="drawer" role="dialog" aria-modal="true">' +
        '<div class="drawer-head"><div><div class="eyebrow">' + (opts.eyebrow || "详情") + "</div>" +
        '<h3 style="font-family:var(--font-serif);font-size:20px;margin-top:3px">' + opts.title + "</h3>" +
        (opts.sub ? '<div class="small muted" style="margin-top:4px">' + opts.sub + "</div>" : "") + "</div>" +
        '<button class="close-x" data-close aria-label="关闭">✕</button></div>' +
        '<div class="drawer-body">' + opts.body + "</div>" +
        (opts.footer ? '<div class="drawer-foot">' + opts.footer + "</div>" : "") +
      "</div>";
    document.body.appendChild(wrap);
    function close() { wrap.remove(); }
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || e.target.closest("[data-close]")) close();
    });
    if (opts.onMount) opts.onMount(wrap.querySelector(".drawer"), close);
    return { el: wrap, close: close };
  }

  function confirm(opts) {
    return new Promise(function (resolve) {
      var done = false;
      var m = modal({
        title: opts.title,
        sub: opts.sub || "",
        body: '<div class="' + (opts.danger ? "" : "") + '">' + (opts.message || "") + "</div>" +
          (opts.detail ? '<div class="notice ' + (opts.danger ? "danger" : "warn") + ' mt-12">' + icon("alert", 15) + "<span>" + opts.detail + "</span></div>" : ""),
        footer: '<button class="btn" data-close>取消</button>' +
          '<button class="btn ' + (opts.danger ? "btn-danger" : "btn-primary") + '" id="cfmOk">' + (opts.okText || "确认") + "</button>",
        onMount: function (el, close) {
          el.querySelector("#cfmOk").addEventListener("click", function () { done = true; close(); resolve(true); });
          el.addEventListener("click", function (e) {
            if (e.target === el.parentElement && !done) resolve(false);
          });
          el.querySelectorAll("[data-close]").forEach(function (b) {
            b.addEventListener("click", function () { if (!done) resolve(false); });
          });
        }
      });
      m.el.addEventListener("click", function (e) {
        if (e.target === m.el && !done) resolve(false);
      });
    });
  }

  /* ---------- Toast ---------- */
  function toast(title, msg, type) {
    var wrap = document.querySelector(".toasts");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toasts"; document.body.appendChild(wrap); }
    var el = document.createElement("div");
    el.className = "toast " + (type || "success");
    el.innerHTML = '<div style="flex:1"><div class="t-title">' + title + "</div>" + (msg ? '<div class="t-msg">' + msg + "</div>" : "") + "</div>" +
      '<button class="close-x" style="width:20px;height:20px;font-size:12px">✕</button>';
    wrap.appendChild(el);
    var t = setTimeout(remove, 3600);
    function remove() { el.classList.add("out"); setTimeout(function () { el.remove(); }, 220); }
    el.querySelector(".close-x").addEventListener("click", function () { clearTimeout(t); remove(); });
    return el;
  }

  /* ---------- 小工具 ---------- */
  function statusBadge(status, text) {
    var map = {
      done: ["b-done", "已完成"], active: ["b-active", "进行中"], review: ["b-warn", "待审核"],
      todo: ["b-todo", "待开始"], locked: ["b-locked", "未解锁"], failed: ["b-danger", "失败"],
      running: ["b-active", "进行中"], queued: ["b-todo", "排队中"], succeeded: ["b-done", "已完成"],
      cancelled: ["b-todo", "已取消"], ready: ["b-teal", "已就绪"], draft: ["b-info", "草稿"],
      pending: ["b-todo", "待生成"], approved: ["b-done", "审核通过"], rejected: ["b-danger", "已退回"],
      connected: ["b-done", "已连接"], unconfigured: ["b-todo", "未配置"]
    };
    var m = map[status] || ["b-todo", status];
    return '<span class="badge ' + m[0] + '"><span class="dot"></span>' + (text || m[1]) + "</span>";
  }

  function empty(title, desc, action) {
    return '<div class="empty"><div class="e-icon">' + icon("folder", 20) + '</div><div class="e-title">' + title + '</div><div class="e-desc">' + (desc || "") + "</div>" + (action || "") + "</div>";
  }

  function assetThumb(a, cls) {
    var color = a.color || "#7a6a55";
    return '<div class="asset-thumb ' + (cls || "") + '" style="background:linear-gradient(155deg,' + hexA(color, .2) + ", " + color + ')">' +
      '<span class="at-glyph">' + (a.initial || a.name.charAt(0)) + "</span>" +
      '<span class="at-badge badge b-todo" style="background:rgba(255,255,255,.85)">' + (a.version || "") + "</span>" +
      "</div>";
  }

  function hexA(hex, alpha) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function seq(btn, label, done) {
    btn.disabled = true;
    var old = btn.innerHTML;
    btn.innerHTML = label;
    return function (msg) {
      btn.disabled = false; btn.innerHTML = old;
      if (msg) toast("已完成", msg, "success");
      if (done) done();
    };
  }

  function nowStamp() {
    var d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  SP.ui = {
    icon: icon, mount: mount, toast: toast, modal: modal, drawer: drawer, confirm: confirm,
    statusBadge: statusBadge, empty: empty, assetThumb: assetThumb, hexA: hexA, seq: seq,
    nowStamp: nowStamp, toastWrap: null, NAV: NAV
  };
})();
