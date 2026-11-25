/* app.js：应用层。路由注册表、导航派生、内存态、权限判定、弹窗与统一反馈。
   侧栏菜单由模块注册表派生，不手写第二份菜单结构；刷新后状态重置属预期行为。 */
window.App = (function () {
  const S = {
    groups: [],
    routes: [],
    identityId: DB.currentIdentity,
    memory: {},
    menuOpen: false,
    modalSubmit: null,
    modalValidate: null,
    jobActive: false,
    drawerOpen: false
  };
  const actions = {};
  const esc = UI.esc;

  /* ---------- 身份与权限 ---------- */
  function identity() { return DB.identities.find(i => i.id === S.identityId) || DB.identities[0]; }
  function role() { return DB.roles.find(r => r.code === identity().role) || DB.roles[0]; }
  function perms() { return role().perms || []; }
  function can(code) {
    if (!code) return true;
    if (Array.isArray(code)) return code.some(c => can(c));
    /* 平台级身份：自动放行平台域路由与动作（规范 §九.3）；
       业务域权限码仍按角色授予范围判定——运维身份默认不具备业务内容访问权（业务方案 §4.6.1 / §4.4）。 */
    if (identity().platform && String(code).indexOf("platform.") === 0) return true;
    return perms().indexOf(code) >= 0;
  }
  function guard(code, message) {
    if (can(code)) return true;
    toast(message || "当前身份无此操作权限（" + role().name + "）", "bad");
    return false;
  }

  /* ---------- 注册 ---------- */
  function registerModule(cfg) {
    const group = {
      key: cfg.group,
      label: cfg.label,
      icon: cfg.icon || "grid",
      order: cfg.order || 100,
      end: cfg.end || "enterprise",
      routes: []
    };
    S.groups.push(group);
    (cfg.routes || []).forEach(r => {
      let routeGroup = group;
      if (r.group && r.group !== group.key) {
        routeGroup = S.groups.find(x => x.key === r.group);
        if (!routeGroup) {
          routeGroup = {
            key: r.group,
            label: r.groupLabel || r.group,
            icon: r.groupIcon || cfg.icon || "grid",
            order: Number.isFinite(r.groupOrder) ? r.groupOrder : (cfg.order || 100),
            end: cfg.end || "enterprise",
            routes: []
          };
          S.groups.push(routeGroup);
        }
      }
      const route = {
        path: r.path,
        title: r.title,
        icon: r.icon || cfg.icon || "grid",
        permission: r.permission || null,
        badge: r.badge || "",
        desc: r.desc || "",
        menu: r.menu !== false,
        menuOrder: Number.isFinite(r.menuOrder) ? r.menuOrder : 0,
        projectScoped: !!r.projectScoped,
        render: r.render,
        group: routeGroup.key
      };
      routeGroup.routes.push(route);
      S.routes.push(route);
    });
  }

  /* ---------- 路由 ---------- */
  function parseHash() {
    const raw = (location.hash || "").replace(/^#\/?/, "");
    const [pathPart, queryPart] = raw.split("?");
    const path = pathPart || "";
    const query = {};
    (queryPart || "").split("&").forEach(pair => {
      if (!pair) return;
      const [k, v] = pair.split("=");
      query[decodeURIComponent(k)] = decodeURIComponent(v || "");
    });
    return { path, query };
  }
  /* 已合并路由的旧地址（B2 归并台账 M1–M9）：老链接不报 404，直接落到新归属页。
     只做转发，不做兼容页——避免又长出一份重复实现。 */
  const LEGACY = {
    "workspace/projects": "projects/list",
    "quality/gates": "quality/reports",
    "post/works": "post/delivery",
    "video/results": "video/preview",
    "director/storyboard": "director/shots",
    "assets/usage": "assets/library",
    "cost/usage": "cost/ledger",
    "notify/incidents": "compliance/risks",
    "analytics/departments": "analytics/enterprise",
    "analytics/employees": "analytics/enterprise"
  };
  function current() {
    const { path, query } = parseHash();
    const target = LEGACY[path] || path;
    const route = S.routes.find(r => r.path === target);
    return route ? { route, query, path: target } : { route: null, query, path };
  }
  /* 名称唯一来源：一级 / 二级 / 三级全部取 DB.menu，模块注册的 label 只作内部 key */
  function menuPathOf(path) {
    for (const g of DB.menu) for (const b of (g.children || [])) for (const it of (b.items || [])) {
      if (it.path === path) return { group: g.label, branch: b.label, item: it.label };
    }
    return null;
  }
  function go(path, query) {
    const qs = query ? "?" + Object.keys(query).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(query[k])).join("&") : "";
    location.hash = "#/" + path + qs;
  }
  function home() {
    const map = { ops: "ops/overview", admin: "orgs/enterprise", dept: "projects/list", owner: "workspace/home", staff: "workspace/home", auditor: "analytics/enterprise" };
    return map[identity().role] || "workspace/home";
  }

  /* ---------- 内存态 ---------- */
  function mem(scope) { if (!S.memory[scope]) S.memory[scope] = {}; return S.memory[scope]; }
  function get(scope, key, fallback) { const bag = mem(scope); return key in bag ? bag[key] : fallback; }
  function set(scope, key, value) { mem(scope)[key] = value; }

  /* ---------- 组件：外壳 ---------- */
  /* 菜单栏由 Menu 组件负责渲染与状态管理（assets/js/menu.js）：
     左侧一级菜单垂直排列、二级菜单折叠展开、三级子菜单在工作区顶部横向呈现。
     应用层只负责注入菜单数据、权限判定与选中回调，并按路由反向同步状态。 */
  let menuReady = false;
  function ensureMenu() {
    if (menuReady || !window.Menu) return;
    menuReady = true;
    Menu.init({
      tree: DB.menu,
      can: can,
      iconOf: (name, size) => UI.ico(name, size),
      onSelect: (path) => { go(path); }
    });
  }

  function projectContext(proj, query) {
    const delivered = ["已交付", "已归档"].indexOf(proj.status) >= 0;
    let epText;
    if (delivered) {
      epText = proj.status + " · 共 " + proj.episodes + " 集";
    } else if (query.ep) {
      epText = "第 " + Number(query.ep) + " 集 · 共 " + proj.episodes + " 集";
    } else {
      const eps = DB.episodes.filter(e => e.project === proj.id).sort((a, b) => (a.no || a.ep) - (b.no || b.ep));
      const open = eps.find(e => e.qc !== "PASS" && e.status !== "已通过");
      epText = eps.length ? "第 " + (open ? (open.no || open.ep) : (eps[0].no || eps[0].ep)) + " 集 · 共 " + proj.episodes + " 集" : "共 " + proj.episodes + " 集";
    }
    return '<div class="project-ctx"><span class="ctx-label">当前项目</span><div class="ctx-value"><b>' + esc(proj.name) + "</b><small>" + esc(proj.id) + " · " + esc(epText) + "</small></div>" +
      '<div class="ctx-actions"><button type="button" class="ctx-btn" data-action="common.switchProject">切换</button>' +
      (current().path === "projects/workflow" ? "" : '<a class="ctx-link" href="#/projects/workflow?id=' + encodeURIComponent(proj.id) + '">流水线</a>') + "</div></div>";
  }

  function shell() {
    const me = identity();
    const cur = current();
    const mp = cur.route ? menuPathOf(cur.route.path) : null;
    const crumbGroup = mp ? mp.group : (cur.route ? (S.groups.find(g => g.key === cur.route.group) || {}).label || "工作空间" : "工作空间");
    const crumbBranch = mp ? mp.branch : "";
    const crumbItem = cur.route ? (mp ? mp.item : cur.route.title) : "页面不存在";
    const app = document.getElementById("app");
    const qid = cur.query && cur.query.id;
    const qProject = qid ? DB.projects.find(p => p.id === qid) : null;
    const canSeeQ = qProject && DB.derived.canViewProject(qProject);
    if (canSeeQ) set("projects", "wfCurrent", qid);
    const inProjectModule = cur.route && (["creation", "director", "video", "audio", "post", "delivery", "quality"].indexOf(cur.route.group) >= 0 || cur.route.projectScoped);
    const activeProject = qid ? (canSeeQ ? DB.projects.find(p => p.id === qid) : null) : (inProjectModule ? currentProject({}) : null);
    if (inProjectModule && activeProject && get("projects", "wfCurrent", "") !== activeProject.id) set("projects", "wfCurrent", activeProject.id);
    const projId = activeProject ? activeProject.id : "";
    const proj = projId ? DB.projects.find(p => p.id === projId) : null;
    const projCtx = proj ? projectContext(proj, cur.query || {}) : "";
    app.innerHTML =
      '<div class="shell">' +
        '<aside class="sidebar' + (S.menuOpen ? " open" : "") + '" id="sidebar">' +
          '<div class="sidebar-brand"><span class="mark">FR</span><div><b>FRAME 短剧工场</b><small>AI 短剧创作工作台 · 第 9.7.1 版</small></div></div>' +
          '<nav class="nav" id="menu-root" aria-label="主导航"></nav>' +
          '<div class="sidebar-foot">一人一部戏 · 从创意到交付<br>静态原型 · 全部数据为虚构演示</div>' +
        "</aside>" +
        '<main class="main">' +
          '<header class="topbar"><div style="display:flex;align-items:center;gap:10px;min-width:0">' +
            '<div class="crumb"><button type="button" class="btn ghost" data-action="common.menu" aria-label="切换导航">☰</button>' +
            "<span>" + esc(crumbGroup) + "</span><span class=\"faint\">/</span>" + (crumbBranch ? "<span>" + esc(crumbBranch) + "</span><span class=\"faint\">/</span>" : "") + "<b>" + esc(crumbItem) + "</b></div>" +
            (proj ? projCtx : "") +
            "</div>" +
            '<div class="top-actions"><span class="pill info" title="主线：一名项目负责人 + AI 独立跑完整部短剧">单人主线</span><span class="pill">本地演示</span>' +
            '<button class="btn sm" data-action="common.reset" title="清除本机业务状态，恢复初始演示数据">恢复初始数据</button>' +
            '<span class="faint small" title="身份切换仅用于评审不同角色的视角，不属于单人主线">评审模式</span>' +
            '<select class="filter" id="identity-switch" aria-label="评审模式：切换身份查看不同角色视角">' + DB.identities.map(i => '<option value="' + esc(i.id) + '"' + (i.id === me.id ? " selected" : "") + ">" + esc(i.name) + "</option>").join("") + "</select>" +
            '<span class="avatar" title="' + esc(role().name) + '">' + esc(me.avatar) + "</span></div>" +
          "</header>" +
          /* 子菜单条位于内容区导航栏（顶栏）下方，随页面内容一起滚动 */
          '<div class="submenu-wrap" id="submenu-root"></div>' +
          '<div id="menu-status" class="sr-only" role="status" aria-live="polite"></div>' +
          '<div class="demo-strip">' + UI.ico("alert", 13) + "<span><b>本地已落库</b> · 项目、任务、成本与质检结果保存在本机，刷新后继续上次进度；右上角可恢复初始演示数据。</span></div>" +
          '<div class="content" id="view"></div>' +
        "</main>" +
      "</div>" +
      '<div id="overlay-root"></div><div id="toast-root" class="toast-root" aria-live="polite"></div>' +
      '<div id="drawer-root"></div>';
    ensureMenu();
    if (menuReady) Menu.build();
    renderView();
    /* 路由 → 菜单反向同步：保证侧栏高亮、横向子菜单条与当前页面一致 */
    if (window.Menu) Menu._sync(cur.path);
  }

  function renderView() {
    const view = document.getElementById("view");
    if (!view) return;
    const cur = current();
    if (!cur.route) {
      view.innerHTML = UI.page("404", "页面不存在", "该路由未在注册表中登记，或链接已失效。请从左侧导航进入有效页面。", UI.btn("返回工作台", "common.home", "primary"), UI.empty("404 · 未匹配路由", "原型只保留注册表内的页面；未登记路由不会渲染任何内容。", UI.btn("回到默认首页", "common.home")));
      return;
    }
    if (!can(cur.route.permission)) {
      view.innerHTML = UI.page("403", "暂无权限", "当前身份「" + role().name + "」不具备此页面的访问权限。权限在前端按身份与角色码校验，服务端鉴权与数据隔离由实际系统实现。", UI.btn("返回可用首页", "common.home", "primary") + UI.btn("切换身份查看", "common.focusIdentity"),
        UI.card("为什么会被拒绝", UI.listRows([
          ["当前身份", identity().name],
          ["角色权限范围", role().scope],
          ["缺少权限码", (Array.isArray(cur.route.permission) ? cur.route.permission : [cur.route.permission]).join(" / ")],
          ["处理建议", "由企业管理员在「角色与权限」中授予对应权限码，或切换到具备该权限的身份"]
        ]) + UI.notice("拒绝原因返回的是可理解文案，不泄露对象是否存在之外的敏感信息。", "info")));
      return;
    }
    const qid = cur.query && cur.query.id;
    if (qid && /^SP-\d{5}$/.test(String(qid))) {
      const target = DB.projects.find(p => p.id === qid);
      if (!target) {
        view.innerHTML = UI.page("项目不存在", "项目不存在", "该链接指向的项目已不存在或已被清理。", UI.btn("返回项目列表", "common.projects", "primary"), UI.empty("没有可展示的业务数据", "请从项目列表重新进入；不存在项目不会被其他项目内容替代。"));
        return;
      }
      if (!DB.derived.canViewProject(target)) {
        view.innerHTML = UI.page("项目不在可见范围", "无权查看该项目", "当前身份「" + role().name + "」不是该项目负责人或项目成员，项目内的剧本、任务、成本与授权均不展示。", UI.btn("返回项目列表", "common.projects", "primary") + UI.btn("切换身份查看", "common.focusIdentity"), UI.empty("项目不在可见范围", "如需查看，请由该项目的负责人或管理员把当前账号加入项目成员，或切换到具备权限的身份。"));
        return;
      }
    }
    try {
      view.innerHTML = cur.route.render(cur.query) + '<div class="footer-note">页面数据来源：本机业务状态 · ' + esc(DB.meta.basis) + " · 当前身份：" + esc(role().name) + "。操作会写入本机，刷新后继续。</div>";
    } catch (err) {
      view.innerHTML = UI.page("error", "页面渲染异常", "该页面渲染过程中出现异常，已回退到安全视图。", "", UI.empty("渲染异常", String(err && err.message || err)));
      if (window.console) console.error(err);
    }
  }

  function refresh() {
    const keep = document.activeElement;
    const key = keep && keep.dataset ? keep.dataset.filter : null;
    const caret = keep && keep.selectionStart !== undefined ? keep.selectionStart : null;
    renderView();
    applyFilters();
    if (key) {
      const el = document.querySelector('[data-filter="' + key + '"]');
      if (el && el.focus) { el.focus(); if (caret !== null && el.setSelectionRange) { try { el.setSelectionRange(caret, caret); } catch (e) { /* 非文本控件忽略 */ } } }
    }
  }

  /* ---------- 表格客户端的即时过滤（条件同时存入内存态） ---------- */
  function applyFilters() {
    const view = document.getElementById("view");
    if (!view) return;
    const qs = view.querySelectorAll("[data-filter]");
    const query = {};
    qs.forEach(el => { if (el.dataset.filterMode === "state") return; if (el.value) query[el.dataset.filter] = el.value.toLowerCase(); });
    const keys = Object.keys(query);
    if (!keys.length) return;
    view.querySelectorAll("tbody tr:not(.table-empty-row)").forEach(row => {
      const hit = keys.every(k => row.textContent.toLowerCase().indexOf(query[k]) >= 0);
      row.hidden = !hit;
    });
    view.querySelectorAll(".table-wrap").forEach(wrap => {
      const rows = Array.from(wrap.querySelectorAll("tbody tr:not(.table-empty-row)"));
      const visible = rows.filter(r => !r.hidden).length;
      const emptyRow = wrap.querySelector(".table-empty-row");
      if (emptyRow) emptyRow.hidden = visible > 0;
    });
    /* 计数按整页聚合：多表页面共用一个 [data-filter-count]，避免只统计最后一张表 */
    const allRows = Array.from(view.querySelectorAll(".table-wrap tbody tr:not(.table-empty-row)"));
    const shown = allRows.filter(r => !r.hidden).length;
    view.querySelectorAll("[data-filter-count]").forEach(c => { c.textContent = "显示 " + shown + " / " + allRows.length + " 条"; });
  }

  /* ---------- 反馈 ---------- */
  function toast(message, kind) {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const el = document.createElement("div");
    el.className = "toast " + (kind === "bad" ? "bad" : "");
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2800);
  }

  function closeModal() {
    const root = document.getElementById("overlay-root");
    if (root) root.innerHTML = "";
    S.modalSubmit = null;
    S.modalValidate = null;
  }
  function modal(opts) {
    const o = opts || {};
    const root = document.getElementById("overlay-root");
    if (!root) return;
    S.modalSubmit = o.onSubmit || null;
    S.modalValidate = o.validate || null;
    root.innerHTML = '<div class="modal-backdrop" data-action="common.backdrop"><div class="modal' + (o.wide ? " wide" : "") + '" role="dialog" aria-modal="true">' +
      '<div class="modal-head"><div><h3>' + esc(o.title || "确认") + "</h3>" + (o.sub ? "<p>" + esc(o.sub) + "</p>" : "") + "</div>" + UI.iconBtn("✕", "common.closeModal", "关闭") + "</div>" +
      '<form id="app-form" autocomplete="off" novalidate>' + (o.body || "") + '<div class="form-error" hidden></div>' +
      '<div class="modal-foot">' + UI.btn(o.cancelText || "取消", "common.closeModal") + '<button type="submit" class="btn primary">' + esc(o.submitText || "确认") + "</button></div>" +
      "</form></div></div>";
    const first = root.querySelector("input,select,textarea");
    if (first) first.focus();
  }
  function confirm(title, bodyHtml, onConfirm, submitText) {
    modal({ title: title, sub: "不可逆或高影响操作，确认后写入业务记录。", body: '<div class="notice">' + bodyHtml + "</div>", submitText: submitText || "确认执行", onSubmit: () => { onConfirm(); return true; } });
  }
  function drawer(title, html) {
    const root = document.getElementById("drawer-root");
    if (!root) return;
    S.drawerOpen = true;
    root.innerHTML = '<div class="backdrop" data-action="common.closeDrawer"></div><aside class="drawer" role="dialog" aria-modal="true"><div class="modal-head"><div><h3>' + esc(title) + "</h3></div>" + UI.iconBtn("✕", "common.closeDrawer", "关闭") + '</div><div id="drawer-body">' + html + "</div></aside>";
  }
  function closeDrawer() { const root = document.getElementById("drawer-root"); if (root) root.innerHTML = ""; S.drawerOpen = false; }

  /* 导出文件名由「当前页面标题 + 项目编号 + 日期」派生，同名按钮不再共用固定文件名 */
  function exportFileName() {
    const cur = current();
    const qid = cur.query && cur.query.id;
    const p = qid ? DB.projects.find(x => x.id === qid) : null;
    const d = new Date();
    const stamp = String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    const title = String((cur.route && cur.route.title) || "导出").replace(/[\\/:*?"<>|\s]/g, "-");
    return title + (p ? "-" + p.id : "") + "-" + stamp + ".csv";
  }

  function exportCsv(name) {
    const table = document.querySelector("#view .table-wrap table");
    if (!table) { toast("当前页面没有可导出的表格"); return; }
    const file = name || exportFileName();
    const rows = Array.from(table.querySelectorAll("tr")).map(tr => Array.from(tr.querySelectorAll("th,td")).map(td => '"' + td.innerText.replace(/"/g, '""') + '"').join(","));
    const blob = new Blob(["\uFEFF" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = file; link.click();
    URL.revokeObjectURL(url);
    toast("已导出「" + file + "」（演示数据，不含真实账单与凭据）");
  }

  /* ---------- 表单校验（字段级 + 表单级）与异步作业 ---------- */
  function clearErrors(form) {
    form.querySelectorAll(".field-error").forEach(x => { x.hidden = true; x.textContent = ""; });
    const box = form.querySelector(".form-error");
    if (box) { box.hidden = true; box.textContent = ""; }
    form.querySelectorAll(".field").forEach(el => el.classList.remove("invalid"));
  }
  function setFieldError(form, name, msg) {
    const el = form.querySelector('[name="' + name + '"]');
    if (!el) return;
    const holder = el.closest(".field-wrap");
    const slot = holder ? holder.querySelector(".field-error") : null;
    if (slot) { slot.hidden = false; slot.textContent = msg; }
    el.classList.add("invalid");
  }
  function formError(form, msg) {
    const box = form.querySelector(".form-error");
    if (box) { box.hidden = false; box.textContent = msg; }
  }
  function busy(form, on) {
    const modalEl = form.closest(".modal");
    const btn = form.querySelector('.modal-foot button[type="submit"]');
    if (modalEl) modalEl.classList.toggle("is-busy", !!on);
    if (btn) { btn.disabled = !!on; btn.textContent = on ? "处理中…" : btn.dataset.label || btn.textContent; }
  }
  function validateFields(scopeEl, data) {
    const errs = {};
    (scopeEl || document).querySelectorAll(".field").forEach(el => {
      if (!el.name) return;
      const v = String(data[el.name] === undefined ? "" : data[el.name]).trim();
      if ((el.hasAttribute("required") || el.dataset.required === "1") && !v) { errs[el.name] = "必填项，不能为空"; return; }
      if (!v) return;
      const min = el.dataset.min, max = el.dataset.max, minlen = el.dataset.minlen, pat = el.dataset.pattern, rule = el.dataset.rule;
      if (min !== undefined && Number(v) < Number(min)) errs[el.name] = "不得小于 " + min;
      if (max !== undefined && Number(v) > Number(max)) errs[el.name] = "不得大于 " + max;
      if (minlen && v.length < Number(minlen)) errs[el.name] = "至少 " + minlen + " 个字符（当前 " + v.length + "）";
      if (pat && !new RegExp(pat).test(v)) errs[el.name] = "格式不正确";
      if (rule === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errs[el.name] = "日期格式应为 YYYY-MM-DD";
      if (rule === "money" && !/^\d+(\.\d{1,2})?$/.test(v)) errs[el.name] = "金额需为数字，最多两位小数";
      if (rule === "code" && !/^[A-Za-z0-9-]{3,}$/.test(v)) errs[el.name] = "编号仅允许字母、数字与短横线";
    });
    return errs;
  }
  function collect(scopeEl) {
    const out = {};
    (scopeEl || document).querySelectorAll("[name]").forEach(el => {
      if (!el.name) return;
      if (el.type === "checkbox") { out[el.name] = !!el.checked; return; }
      if (el.type === "radio") { if (el.checked) out[el.name] = el.value; return; }
      out[el.name] = String(el.value || "").trim();
    });
    return out;
  }

  function job(opts) {
    const o = opts || {};
    if (S.jobActive) { toast("上一个操作尚未完成，请稍候", "bad"); return Promise.resolve({ ok: false, msg: "busy" }); }
    const root = document.getElementById("job-root") || (function () {
      const el = document.createElement("div");
      el.id = "job-root";
      document.body.appendChild(el);
      return el;
    })();
    if (!root) return Promise.resolve({ ok: false, msg: "界面未就绪" });
    S.jobActive = true;
    const steps = (o.steps || ["校验权限与前置条件", "提交业务请求", "写入业务状态"]).slice();
    root.innerHTML = '<div class="job-mask"><div class="job-card" role="status" aria-live="polite">' +
      '<div class="job-head"><span class="job-spin"></span><b>' + esc(o.title || "正在执行") + "</b></div>" +
      '<div class="job-sub">' + esc(o.sub || "完成后自动刷新页面数据，无需手动重载") + "</div>" +
      '<ol class="job-steps">' + steps.map((s, i) => '<li data-step="' + i + '"' + (i === 0 ? ' class="active"' : "") + ">" + esc(s) + "</li>").join("") + "</ol></div></div>";
    const list = root.querySelectorAll(".job-steps li");
    return new Promise(resolve => {
      let i = 0;
      const timer = setInterval(() => {
        if (i >= list.length) { clearInterval(timer); finish(); return; }
        list[i].classList.remove("active"); list[i].classList.add("done"); i += 1;
        if (list[i]) list[i].classList.add("active");
      }, 420);
      function finish() {
        let out;
        try { out = o.run ? o.run() : { ok: true }; } catch (e) { out = { ok: false, msg: (e && e.message) || "执行失败" }; }
        S.jobActive = false;
        root.innerHTML = "";
        if (o.refresh !== false) { try { refresh(); } catch (e) { /* 渲染异常由 renderView 兜底 */ } }
        if (out && out.ok) toast(out.msg || o.success || "操作完成");
        else toast((out && out.msg) || o.fail || "操作未完成", "bad");
        if (o.after) { try { o.after(out); } catch (e) { /* 回调异常不影响主流程 */ } }
        resolve(out);
      }
    });
  }
  function delay(ms) { return new Promise(r => setTimeout(r, ms || 400)); }

  /* ---------- 动作分发 ---------- */
  const FROZEN_ACTIONS = [
    "creation.regenPlan", "creation.choosePlan", "creation.newBrief", "creation.deriveBrief",
    "creation.generateScript", "creation.submitReview",
    "creation.approveScript", "creation.rejectScript", "creation.lock", "creation.editScript",
    "creation.partialScript", "creation.rerunBreakdown",
    "director.freezePlan", "director.confirmChar", "director.confirmLoc", "director.confirmProp",
    "director.submitShot", "director.batchSubmit", "director.regenerate", "director.pickRegen",
    "director.replan", "director.addRef", "director.versionChar", "director.check",
    "director.newShot", "director.newLoc", "director.newProp", "director.newChar",
    "audio.batchDialogue", "audio.regenLine", "audio.newVoice", "audio.disableVoice", "audio.enableVoice",
    "audio.renew", "audio.replaceVoice", "audio.rightsCheck", "audio.newAsset", "audio.confirmAsset",
    "audio.replaceAsset", "audio.fixRights", "audio.proofSub", "audio.genSub", "audio.batchLip", "audio.redoLip",
    "post.newTimeline", "post.exportTimeline", "post.runEpQc",
    "quality.judge", "quality.rerun", "quality.newRework"
  ];
  function frozenActionProject(name, el) {
    if (FROZEN_ACTIONS.indexOf(name) < 0) return null;
    const q = (current().query || {}).id || "";
    const d = (el && el.dataset) || {};
    const pid = /^SP-\d{5}$/.test(q) ? q
      : /^SP-\d{5}$/.test(d.pid || "") ? d.pid
      : /^SP-\d{5}$/.test(d.id || "") ? d.id
      : get("projects", "wfCurrent", "");
    const p = (window.DB && DB.projects || []).find(x => x.id === pid);
    return p && ["已交付", "已归档"].indexOf(p.status) >= 0 ? p : null;
  }
  function on(name, handler) { actions[name] = handler; }
  function dispatch(name, el, event) {
    const frozen = frozenActionProject(name, el);
    if (frozen) { toast("《" + frozen.name + "》当前状态「" + frozen.status + "」，该页面只读；如需修改请新建版本链", "bad"); return; }
    const handler = actions[name];
    if (!handler) { toast("该动作未在静态原型中实现：" + name, "bad"); return; }
    try { handler(el, event); } catch (e) { toast("操作未完成，已回退：" + (e && e.message ? e.message : "未知错误"), "bad"); if (window.console) console.error(e); }
  }

  /* ---------- 通用动作 ---------- */
  on("common.home", () => { go(home()); });
  on("common.projects", () => { go("projects/list"); });
  on("common.switchProject", () => {
    const list = DB.derived.visibleProjects();
    if (!list.length) { toast("当前身份没有可进入的可见项目", "bad"); return; }
    drawer("切换项目", '<div class="ctx-list">' + list.map(p => '<div class="ctx-row"><div><b>' + esc(p.name) + '</b><small>' + esc(p.id) + " · " + esc(p.status) + " · " + esc(p.owner) + '</small></div><span class="ctx-row-side">' + UI.pill(p.status) + '<button type="button" class="btn sm primary" data-action="common.useProject" data-pid="' + esc(p.id) + '">进入</button></span></div>').join("") + "</div>", "按当前身份可见范围列出；切换后保持当前菜单页面");
  });
  on("common.useProject", (el) => {
    const pid = el && el.dataset ? el.dataset.pid : "";
    if (!pid) { toast("缺少项目标识，未切换", "bad"); return; }
    const path = current().path || "projects/workflow";
    closeDrawer();
    go(path, { id: pid });
  });
  on("common.reset", () => {
    if (!window.DB || !DB.state || !DB.state.reset) return;
    job({
      title: "恢复初始演示数据",
      sub: "清除本机保存的项目、任务、成本与质检记录",
      steps: ["确认操作范围", "写入初始数据", "重建页面上下文"],
      run() { return DB.state.reset(); },
      after() { S.identityId = DB.currentIdentity; S.memory = {}; shell(); go(home()); }
    });
  });
  on("common.menu", () => { S.menuOpen = !S.menuOpen; const sb = document.getElementById("sidebar"); if (sb) sb.classList.toggle("open", S.menuOpen); });
  on("common.closeModal", () => { closeModal(); });
  on("common.closeDrawer", () => { closeDrawer(); });
  on("common.backdrop", (el, e) => { if (e.target.classList.contains("modal-backdrop")) closeModal(); });
  on("common.focusIdentity", () => { const sel = document.getElementById("identity-switch"); if (sel) { sel.focus(); } });
  on("common.export", () => { exportCsv(); });
  on("common.noop", () => { toast("该入口在原型中为只读展示，不执行真实动作。"); });
  on("common.tab", (el) => { const scope = el.dataset.scope || "tab"; set(scope, "tab", el.dataset.value); refresh(); });
  on("common.filter", (el) => { set(el.dataset.scope || "filter", el.dataset.filter, el.value); });

  /* ---------- 事件绑定 ---------- */
  function bind() {
    document.addEventListener("click", e => {
      const el = e.target.closest("[data-action]");
      if (!el) return;
      const name = el.dataset.action;
      if (!name) return;
      e.preventDefault();
      dispatch(name, el, e);
    });
    document.addEventListener("submit", e => {
      if (e.target.id !== "app-form") return;
      e.preventDefault();
      const form = e.target;
      if (form.classList.contains("busy")) return;
      const data = {};
      new FormData(form).forEach((v, k) => { data[k] = typeof v === "string" ? v.trim() : v; });
      clearErrors(form);
      const errs = validateFields(form, data);
      let custom = {};
      if (S.modalValidate) {
        try { custom = S.modalValidate(data, form) || {}; } catch (err) { custom = { _: String(err && err.message || err) }; }
      }
      Object.keys(custom).forEach(k => { if (custom[k]) errs[k] = custom[k]; });
      const keys = Object.keys(errs).filter(k => errs[k]);
      if (keys.length) {
        keys.forEach(k => { if (k !== "_") setFieldError(form, k, errs[k]); });
        formError(form, errs._ || ("有 " + keys.length + " 项未通过校验，请按提示修正后重试"));
        toast(errs._ || ("有 " + keys.length + " 项未通过校验，请检查表单"), "bad");
        const first = form.querySelector('[name="' + (keys[0] === "_" ? "" : keys[0]) + '"]');
        if (first && first.focus) first.focus();
        return;
      }
      const submit = S.modalSubmit;
      if (!submit) { closeModal(); return; }
      let result;
      try { result = submit(data, form); } catch (err) {
        formError(form, "提交失败：" + (err && err.message ? err.message : "未知错误"));
        toast("提交失败，请检查后重试", "bad");
        return;
      }
      if (result && typeof result.then === "function") {
        busy(form, true);
        result.then(out => {
          busy(form, false);
          if (out && out.ok === false) {
            if (out.fields) Object.keys(out.fields).forEach(k => { if (out.fields[k]) setFieldError(form, k, out.fields[k]); });
            if (out.msg) formError(form, out.msg);
            toast(out.msg || "操作未通过业务校验", "bad");
            return;
          }
          closeModal();
          refresh();
          if (out && out.msg) toast(out.msg);
        }).catch(err => {
          busy(form, false);
          formError(form, "请求失败：" + (err && err.message ? err.message : "网络或服务异常"));
          toast("请求失败，已保留表单内容，可重试", "bad");
        });
        return;
      }
      if (result === false) return;
      closeModal();
    });
    document.addEventListener("input", e => {
      const el = e.target;
      if (!el.dataset || !el.dataset.filter) return;
      set(el.dataset.scope || "filter", el.dataset.filter, el.value);
      applyFilters();
    });
    document.addEventListener("change", e => {
      const el = e.target;
      if (el.id === "identity-switch") {
        S.identityId = el.value;
        S.memory = {};
        const route = current().route;
        if (route && !can(route.permission)) { shell(); go(home()); return; }
        shell();
        if (window.Menu) Menu.build();
        return;
      }
      const grid = el.closest ? el.closest(".radio-grid") : null;
      if (grid && el.type === "radio") {
        grid.querySelectorAll(".radio-card").forEach(c => c.classList.toggle("on", c.contains(el)));
        if (grid.dataset.radioAction) dispatch(grid.dataset.radioAction, el);
        return;
      }
      if (!el.dataset || !el.dataset.filter) return;
      set(el.dataset.scope || "filter", el.dataset.filter, el.value);
      applyFilters();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        if (S.drawerOpen) closeDrawer();
        closeModal();
      }
    });
    window.addEventListener("hashchange", () => { S.menuOpen = false; closeDrawer(); shell(); });
  }

  function currentProject(query) {
    const qid = query && query.id;
    if (qid) {
      const hit = DB.projects.find(p => p.id === qid);
      return hit && DB.derived.canViewProject(hit) ? hit : null;
    }
    const storedId = get("projects", "wfCurrent", "");
    const stored = DB.projects.find(p => p.id === storedId);
    if (stored && DB.derived.canViewProject(stored)) return stored;
    return DB.derived.myProjects()[0] || DB.derived.visibleProjects()[0] || null;
  }

  function start() {
    bind();
    /* 向数据层扩展（DB.state / DB.derived）注入运行时身份与角色，
       使状态层与派生层保持单向依赖，不反向调用应用层（规范 §四 依赖方向：数据层 → 组件层 → 应用层 → 模块层）。 */
    if (window.DB && DB.state && DB.state.bind) DB.state.bind({ identity: identity, role: role });
    if (window.DB && DB.derived && DB.derived.bind) DB.derived.bind({ identity: identity });
    if (!location.hash || location.hash === "#") location.hash = "#/" + home();
    else shell();
  }

  return {
    module: registerModule, on, start, go, refresh, toast, modal, confirm, drawer, closeModal, closeDrawer, exportCsv,
    job, delay, fieldError: setFieldError, formError, validateFields, collect,
    can, guard, get, set, mem, identity, role, home, current, currentProject,
    routes() { return S.routes.slice(); },
    groups() { return S.groups.slice(); }
  };
})();

/* 模块注册入口：模块文件只登记路由与动作，不直接改写应用状态。 */
window.AppModule = {
  register(cfg) { App.module(cfg); }
};


