/* ============================================================
   长夜制作台 V6 · 应用层
   路由注册、导航装配、内存态、权限判定、搜索与反馈组件。
   依赖：DB -> UI -> App -> modules
   ============================================================ */
window.App = (function () {
  var modules = [];
  var routes = [];
  var routeMap = {};
  var currentRoute = null;
  var palette = null;

  /* 路由权限表：集中维护，不在页面内散落判定 */
  var ROUTE_PERMS = {
    "overview/dashboard": null,
    "overview/project": "project:read",
    "overview/playground": "task:read",
    "story/bible": "story:read",
    "story/import": "story:write",
    "production/episodes": "script:read",
    "production/script": "script:read",
    "production/assets": "asset:read",
    "production/storyboard": "board:read",
    "production/canvas": "board:read",
    "production/dubbing": "timeline:read",
    "review/tasks": "task:read",
    "review/preview": "qa:read",
    "review/qa": "qa:read",
    "review/timeline": "timeline:read",
    "delivery/export": "export:read",
    "system/access": null,
    "system/overview": "system:read",
    "system/org": "org:read",
    "system/members": "member:read",
    "system/roles": "role:manage",
    "system/security": "security:manage",
    "system/audit": "audit:read",
    "system/providers": "provider:read",
    "system/usage": "usage:read",
    "system/workspace": "system:manage",
    "system/settings": "settings:manage",
    "system/team": "member:read",
    "tenants/list": "tenant:read", "tenants/detail": "tenant:read", "tenants/members": "tenant:member", "tenants/policy": "tenant:policy", "tenants/access": "tenant:cross"
  };

  var App = {
    state: null,
    currentUser: null,
    groupOrder: ["tenants", "overview", "story", "production", "review", "delivery", "system"]
  };

  /* ---------- 模块注册 ---------- */
  App.registerModule = function (def) {
    if (!def || !def.group || !Array.isArray(def.routes)) throw new Error("模块定义不完整");
    def.routes.forEach(function (r) {
      if (r.path.indexOf(def.group + "/") !== 0) console.warn("路由前缀与分组不一致：" + r.path);
      if (routeMap[r.path]) throw new Error("路由重复：" + r.path);
      r.group = def.group;
      r.groupLabel = def.label;
      routes.push(r);
      routeMap[r.path] = r;
    });
    modules.push(def);
  };
  window.AppModule = { register: App.registerModule };

  /* ---------- 工具 ---------- */
  App.hasPerm = function (perm) {
    if (!perm) return true;
    var u = App.currentUser || {};
    var p = (u.perms || []).concat(u.tempPerms || []);
    return p.indexOf("*") > -1 || p.indexOf(perm) > -1;
  };
  App.can = App.hasPerm;

  App.currentTenant = function(){return (App.state.tenants||[]).filter(function(t){return t.id===App.state.currentTenantId;})[0]||null;};
  App.tenantById = function(id){return (App.state.tenants||[]).filter(function(t){return t.id===id;})[0]||null;};
  App.setTenant = function(id){var t=App.tenantById(id),u=App.currentUser;if(!t||t.status!=="active"||(u.tenantIds||[]).indexOf(id)<0){App.toast("无法切换租户","当前身份未获该租户成员授权，或租户已停用。","warn");App.render();return;}App.state.currentTenantId=id;var p=App.visibleProjects()[0];if(p)App.state.project=p;App.render();App.toast("已切换租户",t.name+" · 数据范围已切换","success");};
  App.memberById = function (id) {
    return App.state.members.filter(function (m) { return m.id === id; })[0] || null;
  };
  App.roleById = function (id) {
    return App.state.roles.filter(function (r) { return r.id === id; })[0] || null;
  };
  App.roleOf = function (member) {
    return member ? App.roleById(member.roleId) : null;
  };
  App.scopeLabel = function (scope) {
    return ({ org: "全组织（管理范围）", dept: "本部门（管理范围）", project: "仅所属项目", own: "仅本人" })[scope] || "未知范围";
  };
  App.statusLabel = function (status) {
    return ({ active: "正常", invited: "待接受", suspended: "已停用", deactivated: "已停用", revoked: "已撤销" })[status] || status;
  };

  /* 数据范围判定：管理范围与项目成员授权分离；项目资源一律要求项目成员关系 */
  App.inScope = function (deptId, projectId) {
    var u = App.currentUser;
    if (!u) return false;
    if ((u.tenantIds || []).indexOf(App.state.currentTenantId) < 0) return false;
    if (projectId) return (u.projectIds || []).indexOf(projectId) > -1;
    if ((u.perms || []).indexOf("*") > -1 || u.scope === "org") return true;
    if (u.scope === "dept") return !deptId || deptId === u.deptId;
    if (u.scope === "project") return !deptId || deptId === u.deptId;
    return false;
  };

  App.memberStats = function () {
    var ms = App.state.members;
    return {
      total: ms.length,
      active: ms.filter(function (m) { return m.status === "active"; }).length,
      invited: ms.filter(function (m) { return m.status === "invited"; }).length,
      suspended: ms.filter(function (m) { return m.status === "suspended" || m.status === "deactivated"; }).length,
      external: ms.filter(function (m) { return m.accountType === "external"; }).length,
      projectMemberships: ms.reduce(function (n, m) { return n + (m.projects || []).length; }, 0),
      projectsCovered: App.state.projects.filter(function (p) { return (p.memberIds || []).length > 0; }).length
    };
  };

  App.visibleProjects = function () {
    var u = App.currentUser;
    if (!u || !App.hasPerm("project:read")) return [];
    return App.state.projects.filter(function (p) {
      return p.tenantId === App.state.currentTenantId && (u.projectIds || []).indexOf(p.id) > -1 && (p.memberIds || []).indexOf(u.id) > -1;
    });
  };

  App.projectMembers = function (projectId) {
    var p = App.state.projects.filter(function (x) { return x.id === projectId; })[0];
    if (!p) return [];
    return (p.memberIds || []).map(function (id) { return App.memberById(id); }).filter(Boolean);
  };

  App.projectRoleOf = function (member, projectId) {
    var p = App.state.projects.filter(function (x) { return x.id === projectId; })[0];
    if (!p || !member) return "—";
    if (p.ownerId === member.id) return "项目负责人";
    if (member.roleId === "r-guest") return "外部审片";
    if (member.roleId === "r-reviewer") return "审核";
    if (member.roleId === "r-editor" || member.roleId === "r-art") return "制作";
    if (member.roleId === "r-writer") return "内容";
    return "项目成员";
  };

  App.logAudit = function (action, target, category, detail, severity, projectId) {
    var u = App.currentUser || {};
    var entry = {
      id: "A-" + (1043 + App.state.audit.length),
      time: "今天 " + App.nowStamp(),
      actor: u.name || "系统",
      actorId: u.id || "system",
      category: category || "系统",
      action: action,
      target: target || "—",
      detail: detail || "",
      requestId: "req_" + Date.now().toString(36),
      resource: projectId ? "project:" + projectId : "workspace:changye",
      ip: "203.0.113.42",
      result: "success",
      severity: severity || "normal",
      deptId: u.deptId || "d-exec",
      projectId: projectId === undefined ? App.state.project.id : projectId
    };
    App.state.audit.unshift(entry);
    return entry;
  };

  App.applyMemberRole = function (memberId, roleId) {
    var m = App.memberById(memberId);
    var role = App.roleById(roleId);
    if (!m || !role) return null;
    m.roleId = role.id;
    m.role = role.name;
    var identity = App.state.identities.filter(function (x) { return x.id === memberId; })[0];
    if (identity) {
      identity.roleId = role.id;
      identity.role = role.name;
      identity.shortRole = role.short;
      identity.scope = role.scope;
      identity.perms = role.perms.slice();
      if (App.currentUser && App.currentUser.id === identity.id) App.currentUser = identity;
    }
    return role;
  };

  App.applyMemberStatus = function (memberId, status) {
    var m = App.memberById(memberId);
    if (!m) return;
    m.status = status;
    var identity = App.state.identities.filter(function (x) { return x.id === memberId; })[0];
    if (identity) identity.status = status;
  };

  App.routeAllowed = function (route) {
    var perm = ROUTE_PERMS[route.path];
    if (perm && !App.hasPerm(perm)) return false;
    return true;
  };
  App.routes = function () { return routes.slice(); };
  App.route = function (path) { return routeMap[path] || null; };

  App.navigate = function (path, params) {
    var q = "";
    if (params) {
      var arr = [];
      Object.keys(params).forEach(function (k) {
        if (params[k] !== undefined && params[k] !== null) arr.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
      });
      if (arr.length) q = "?" + arr.join("&");
    }
    var target = "#/" + path + q;
    if (location.hash === target) App.render();
    else location.hash = target;
  };

  App.link = function (path, params) {
    var q = "";
    if (params) {
      var arr = [];
      Object.keys(params).forEach(function (k) {
        if (params[k] !== undefined && params[k] !== null) arr.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
      });
      if (arr.length) q = "?" + arr.join("&");
    }
    return "#/" + path + q;
  };

  App.refresh = function () { App.render(); };

  App.formatMoney = function (n) {
    return "¥" + Number(n || 0).toLocaleString("zh-CN");
  };

  App.epProgress = function (no) {
    var ep = App.state.episodes.filter(function (e) { return e.no === no; })[0];
    if (!ep) return 0;
    if (App.state.qa.status === "approved") return 100;
    if (no === "01") return 88;
    if (ep.status === "locked") return 100;
    if (ep.status === "draft") return 45;
    return 0;
  };

  App.taskRunning = function () {
    return App.state.tasks.filter(function (t) { return t.status === "running" || t.status === "queued"; }).length;
  };

  App.setIdentity = function (id) {
    var u = App.state.identities.filter(function (x) { return x.id === id; })[0];
    if (!u) return;
    if (u.status !== "active") {
      App.toast("无法切换身份", u.name + " 当前为「" + App.statusLabel(u.status) + "」状态，不能进入平台。", "warn");
      return;
    }
    App.state.currentUserId = id;
    App.currentUser = u;
    if ((u.tenantIds || []).indexOf(App.state.currentTenantId) < 0) App.state.currentTenantId = (u.tenantIds || [])[0] || "tn-prod";
    var firstTenantProject = App.state.projects.filter(function(p){return p.tenantId===App.state.currentTenantId&&(u.projectIds||[]).indexOf(p.id)>-1;})[0]; if(firstTenantProject)App.state.project=firstTenantProject;
    document.querySelectorAll(".drawer-wrap.open, .overlay.open").forEach(function (o) { o.remove(); });
    App.render();
    App.toast("已切换身份", u.name + " · " + u.role + " · " + App.scopeLabel(u.scope), "success");
  };

  App.resetDemo = function () {
    App.state = DB.seed();
    App.currentUser = App.state.identities.filter(function (x) { return x.id === App.state.currentUserId; })[0] || App.state.identities[0];
    App.render();
  };

  /* ---------- 初始化 ---------- */
  App.init = function () {
    App.state = DB.seed();
    App.currentUser = App.state.identities.filter(function (x) { return x.id === App.state.currentUserId; })[0] || App.state.identities[0];
    App.state.currentTenantId = App.state.currentTenantId || "tn-prod";
    bindGlobal();
    if (!location.hash) {
      location.replace("#/overview/dashboard");
    }
    window.addEventListener("hashchange", App.render);
    App.render();
  };

  /* ---------- 渲染 ---------- */
  App.render = function () {
    if (!App.state) return;
    var raw = location.hash.replace(/^#\//, "");
    if (!raw) raw = "overview/dashboard";
    var path = raw.split("?")[0];
    var params = parseQuery(raw.split("?")[1] || "");
    var route = routeMap[path];

    if (!route) {
      currentRoute = null;
      renderShell(null, "页面不存在");
      document.getElementById("view").innerHTML = statusPage("404", "页面不存在", "这条路由没有登记，可能是地址拼写错误或页面已下线。", "返回工作台");
      document.title = "页面不存在 · 长夜制作台";
      return;
    }
    if (!App.routeAllowed(route)) {
      currentRoute = route;
      renderShell(route, "暂无权限");
      document.getElementById("view").innerHTML = statusPage("403", "暂无权限", "当前身份「" + App.currentUser.name + " · " + App.currentUser.role + "」无权访问该页面。切换身份后可继续。", "返回工作台");
      document.title = "暂无权限 · 长夜制作台";
      return;
    }
    if (route.group !== "system" && route.group !== "tenants" && route.path !== "overview/dashboard" && !App.visibleProjects().length) {
      currentRoute = route;
      renderShell(route, "无项目授权");
      document.getElementById("view").innerHTML = statusPage("403", "无项目授权", "系统角色不自动授予项目内容访问权。当前账号不在任何项目成员名单中，请先申请项目访问。", "返回工作台");
      document.title = "无项目授权 · 长夜制作台";
      return;
    }

    currentRoute = route;
    renderShell(route, route.title);
    var oldView = document.getElementById("view");
    var view = oldView.cloneNode(false);
    oldView.parentNode.replaceChild(view, oldView);
    view.innerHTML = route.render(params || {});
    document.title = route.title + " · 长夜制作台";
    if (route.mount) route.mount(view, params || {});
    window.scrollTo(0, 0);
    closeRail();
    setTimeout(function () {
      var focus = view.querySelector("[autofocus]");
      if (focus) focus.focus();
    }, 30);
  };

  function parseQuery(q) {
    var out = {};
    q.split("&").forEach(function (kv) {
      if (!kv) return;
      var p = kv.split("=");
      out[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
    });
    return out;
  }

  function navRoute(path) { return routeMap[path] || null; }

  function navVisible(path, hasProject) {
    var r = routeMap[path];
    if (!r || r.nav === false) return false;
    if (!App.routeAllowed(r)) return false;
    if (r.path !== "overview/dashboard" && r.group !== "system" && r.group !== "tenants" && !hasProject) return false;
    return true;
  }

  var collapsedParents = {};

  /* 菜单注册表：业务组按生产链路归类；children 将同域次要视图收纳为二级入口。
     新增主功能时在此追加组或条目即可，路由权限仍由 ROUTE_PERMS 集中控制。 */
  var NAV_GROUPS = [
    { id: "tenants", label: "企业空间", items: [
      { path: "tenants/list" }, { path: "tenants/members" }, { path: "tenants/policy" }, { path: "tenants/access" }
    ]},
    { id: "overview", label: "概览", items: [
      { path: "overview/project" }
    ]},
    { id: "workspace", label: "工作台", items: [
      { path: "overview/dashboard" },
      { path: "overview/playground" },
      { path: "review/tasks" }
    ]},
    { id: "assets", label: "资产", items: [
      { path: "story/bible", children: ["story/import"] },
      { path: "production/episodes" },
      { path: "production/assets" },
      { path: "production/storyboard", children: ["production/canvas"] },
      { path: "production/dubbing" },
      { path: "review/qa", children: ["review/timeline"] },
      { path: "review/preview" },
      { path: "delivery/export" }
    ]}
  ];

  function navBadge(r) {
    if (r.badge === "tasks" && App.taskRunning() > 0) return '<span class="ni-badge hot">' + App.taskRunning() + "</span>";
    if (r.badge) return '<span class="ni-badge">' + UI.esc(r.badge) + "</span>";
    return "";
  }

  function navItemHTML(r, activePath, level) {
    var active = r.path === activePath || r.navParent === activePath;
    var cls = "nav-item" + (active ? " active" : "") + (level === 2 ? " nav-sub-item" : "");
    return '<a class="' + cls + '" href="' + App.link(r.path) + '">' +
      '<span class="ni-icon">' + UI.icon(r.icon, 15) + "</span><span>" + UI.esc(r.title.split(" · ")[0]) + "</span>" + navBadge(r) + "</a>";
  }

  function parentItemHTML(entry, activePath, hasProject) {
    var r = routeMap[entry.path];
    var kids = (entry.children || []).filter(function (p) { return navVisible(p, hasProject); });
    var selfActive = r.path === activePath || r.navParent === activePath;
    var childActive = kids.indexOf(activePath) > -1;
    var open = childActive || collapsedParents[entry.path] === true;
    var kidsHTML = kids.map(function (p) { return navItemHTML(routeMap[p], activePath, 2); }).join("");
    var caret = kids.length
      ? '<button class="ni-caret" data-app="toggle-parent" data-path="' + entry.path + '" aria-expanded="' + open + '">' + UI.icon("down", 13) + "</button>"
      : "";
    return '<div class="nav-parent' + ((selfActive || childActive) ? " active" : "") + (open ? " open" : "") + '">' +
      '<a class="nav-item' + (selfActive || childActive ? " active" : "") + '" href="' + App.link(r.path) + '">' +
        '<span class="ni-icon">' + UI.icon(r.icon, 15) + "</span><span>" + UI.esc(r.title.split(" · ")[0]) + "</span></a>" +
      caret +
      (kids.length ? '<div class="nav nav--sub">' + kidsHTML + "</div>" : "") + "</div>";
  }

  function groupHTML(group, activePath, hasProject) {
    var visibleItems = group.items.filter(function (it) { return navVisible(it.path, hasProject); });
    if (!visibleItems.length) return "";
    var itemsHTML = visibleItems.map(function (it) {
      var kids = (it.children || []).filter(function (p) { return navVisible(p, hasProject); });
      if (kids.length) return parentItemHTML(it, activePath, hasProject);
      var r = routeMap[it.path];
      return navItemHTML(r, activePath, 1);
    }).join("");

    return '<div class="nav-group"><div class="nav-label">' + UI.esc(group.label) + '</div><div class="nav">' + itemsHTML + "</div></div>";
  }

  function railHTML(activePath) {
    var hasProject = App.visibleProjects().length > 0;
    var groups = NAV_GROUPS.map(function (g) {
      return groupHTML(g, activePath, hasProject);
    }).join("");

    var u = App.currentUser;
    return '<nav class="rail-nav">' + groups + "</nav>" +
      '<div class="rail-foot">' +
      '<button class="rail-user" data-app="account" title="账号与配置">' + UI.avatar(u.name, "", u.color) +
      '<span class="ru-main"><span class="ru-name">' + UI.esc(u.name) + '</span><span class="ru-role">' + UI.esc(u.role) + "</span></span></button>" +
      '<button class="rail-setting" data-app="settings" title="系统配置">' + UI.icon("sliders", 16) + "</button>" +
      "</div>";
  }

  function topbarHTML(route, crumb) {
    var running = App.taskRunning(), tenant = App.currentTenant();
    var tenantOptions = (App.state.tenants || []).filter(function(t){return t.status==="active"&&(App.currentUser.tenantIds||[]).indexOf(t.id)>-1;}).map(function(t){return '<option value="'+t.id+'"'+(tenant&&tenant.id===t.id?" selected":"")+'>'+UI.esc(t.name)+'</option>';}).join("");
    return '<div class="topbar-left"><button class="icon-btn menu-btn" data-app="menu" aria-label="打开导航">' + UI.icon("menu") + "</button>" +
      '<div class="crumb"><span class="crumb-project">' + UI.esc(App.state.workspace.name) + '</span><span class="sep">/</span><b>' + UI.esc(crumb || "") + '</b><span class="badge b-teal">企业内部多租户</span></div></div>' +
      '<div class="spacer"></div>' +
      '<div class="identity-switch tenant-switch"><span class="is-avatar">' + UI.icon("layers",14) + '</span><select data-tenant aria-label="切换租户">' + tenantOptions + '</select></div>' +
      '<button class="search-trigger" data-app="search">' + UI.icon("search", 14) + '<span>搜索页面、成员、角色、镜头…</span><span class="kbd">⌘ K</span></button>' +
      '<button class="task-pill" data-app="tasks"><span class="pulse"></span><span class="tp-count">' + running + '</span><span class="tp-text"> 个任务运行中</span></button>' +
      '<button class="icon-btn notify-btn" data-app="notify" aria-label="通知中心">' + UI.icon("bell", 17) + '<span class="notify-dot"></span></button>';
  }

  function renderShell(route, crumb) {
    var rail = document.getElementById("rail");
    var top = document.getElementById("topbar");
    if (rail) rail.innerHTML = railHTML(route ? route.path : "");
    if (top) top.innerHTML = topbarHTML(route, crumb);
  }

  function statusPage(code, title, desc, action) {
    return '<div class="page"><div class="status-page"><div class="status-code">' + code + "</div><h1>" + title + "</h1><p>" + desc + '</p><a class="btn btn-primary" href="' + App.link("overview/dashboard") + '">' + action + "</a></div></div>";
  }

  /* ---------- 全局交互 ---------- */
  function bindGlobal() {
    document.addEventListener("click", function (e) {
      var el = e.target.closest("[data-app]");
      if (!el) return;
      var act = el.getAttribute("data-app");
      if (act === "menu") openRail();
      if (act === "search") openPalette();
      if (act === "account") openPanel("account");
      if (act === "settings") openPanel("settings");
      if (act === "toggle-parent") {
        e.preventDefault();
        e.stopPropagation();
        var p = el.getAttribute("data-path");
        collapsedParents[p] = !collapsedParents[p];
        App.refresh();
        return;
      }
      if (act === "projects") openProjects();
      if (act === "notify") openNotifications();
      if (act === "tasks") {
        if (App.hasPerm("task:read")) App.navigate("review/tasks");
        else App.toast("暂无权限", "当前身份不能查看 AI 任务。", "warn");
      }
    });
    document.addEventListener("change", function (e) {
      if (e.target.matches("[data-identity]")) App.setIdentity(e.target.value);
      if (e.target.matches("[data-tenant]")) App.setTenant(e.target.value);
    });
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === "k") {
        e.preventDefault(); openPalette();
      }
      if (e.key === "Escape") {
        closePalette(); closeRail();
        document.querySelectorAll(".overlay.open, .drawer-wrap.open").forEach(function (o) { o.remove(); });
      }
    });
    var scrim = document.getElementById("railScrim");
    if (scrim) scrim.addEventListener("click", closeRail);
  }

  function openRail() {
    document.getElementById("rail").classList.add("open");
    document.getElementById("railScrim").classList.add("show");
  }
  function closeRail() {
    var r = document.getElementById("rail");
    var s = document.getElementById("railScrim");
    if (r) r.classList.remove("open");
    if (s) s.classList.remove("show");
  }

  /* ---------- 项目切换 / 账号 ---------- */
  function openProjects() {
    var visible = App.visibleProjects();
    if (!visible.length) {
      App.toast("暂无可见项目", "当前身份不在任何项目的成员名单中。可前往「我的权限」申请项目访问。", "warn");
      return;
    }
    var body = '<div class="stack">' + visible.map(function (p) {
      var cur = p.id === App.state.project.id;
      return '<button class="card card-pad project-choice' + (cur ? " is-current" : "") + '" data-proj="' + p.id + '">' +
        '<span class="pc-mark">' + UI.esc(p.name.charAt(0)) + "</span><span class=\"pc-main\"><b>" + UI.esc(p.name) + "</b>" +
        '<small>' + UI.esc(p.code) + " · " + p.episodes + " 集 · " + UI.esc(p.genre) + " · " + UI.esc(p.stage) + "</small></span>" +
        (cur ? '<span class="badge b-active">当前项目</span>' : '<span class="badge b-todo">' + UI.esc(p.status) + "</span>") + "</button>";
    }).join("") + "</div>" +
      '<div class="notice info mt-16">' + UI.icon("lock", 15) + "<span>项目切换按角色数据范围过滤。外部审片成员仅看到被授权项目；跨项目数据不会带入当前上下文。</span></div>";
    App.modal({
      title: "切换项目", sub: "当前身份「" + App.currentUser.name + " · " + App.currentUser.role + "」，数据范围：" + App.scopeLabel(App.currentUser.scope) + "。", body: body,
      footer: '<button class="btn" data-close>取消</button>',
      onMount: function (el, close) {
        el.addEventListener("click", function (e) {
          var b = e.target.closest("[data-proj]");
          if (!b) return;
          if (b.getAttribute("data-proj") === App.state.project.id) { close(); return; }
          App.toast("示例项目", "该卡片用于演示项目数据隔离，暂无独立生产数据。", "warn");
        });
      }
    });
  }

  var PANEL_GROUPS = [
    { label: "个人", items: ["system/access"] },
    { label: "团队与权限", items: ["system/members", "system/org", "system/roles"] },
    { label: "治理与平台", items: ["system/overview", "system/security", "system/audit", "system/providers", "system/usage"] },
    { label: "配置", items: ["system/workspace", "system/settings"] }
  ];

  function panelEntry(path) {
    var r = routeMap[path];
    if (!r || !App.routeAllowed(r)) return "";
    return '<button class="settings-entry" data-panel-nav="' + path + '">' +
      '<span class="se-icon">' + UI.icon(r.icon, 15) + "</span>" +
      '<span class="se-main"><span class="se-title">' + UI.esc(r.title) + "</span></span>" +
      '<span class="se-go">' + UI.icon("arrow", 13) + "</span></button>";
  }

  function openPanel(anchor) {
    var u = App.currentUser;
    var s = App.state;
    var account = u.accountType === "external" ? "外部审片账号" : "内部成员账号";
    var entryGroups = PANEL_GROUPS.map(function (g) {
      var items = g.items.map(panelEntry).filter(Boolean).join("");
      if (!items) return "";
      return '<div class="settings-group"><div class="settings-group-label">' + UI.esc(g.label) + "</div>" + items + "</div>";
    }).join("");

    var curProject = App.visibleProjects().length ? App.state.project : null;
    var projectEntry = curProject
      ? `<button class="settings-entry" data-app="projects"><span class="se-icon">${UI.icon("folder", 15)}</span><span class="se-main"><span class="se-title">${UI.esc(curProject.name)}</span><span class="se-sub">${UI.esc(curProject.code)} · ${curProject.members} 人 · 项目成员授权</span></span><span class="se-go">${UI.icon("down", 13)}</span></button>`
      : `<button class="settings-entry" data-app="projects"><span class="se-icon">${UI.icon("lock", 15)}</span><span class="se-main"><span class="se-title">无项目授权</span><span class="se-sub">联系项目负责人授予成员资格</span></span><span class="se-go">${UI.icon("down", 13)}</span></button>`;

    var body = '<div class="account-head">' + UI.avatar(u.name, "lg", u.color) +
      '<div><div class="account-name">' + UI.esc(u.name) + '</div><div class="small muted">' + UI.esc(u.email) + " · " + UI.esc(u.title) + "</div>" +
      '<div class="row wrap mt-8"><span class="badge b-teal">' + UI.esc(u.role) + '</span><span class="badge b-outline">' + UI.esc(account) + '</span><span class="badge ' + (u.status === "active" ? "b-done" : "b-warn") + '">' + App.statusLabel(u.status) + "</span></div></div></div>" +

      '<div class="panel-block"><div class="panel-label">演示身份</div>' +
      '<label class="identity-switch block"><select data-identity aria-label="切换演示身份">' +
      App.state.identities.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === u.id ? " selected" : "") + ">" + UI.esc(x.name + " · " + (x.shortRole || x.role)) + "</option>";
      }).join("") + "</select>" + UI.icon("down", 12) + "</label></div>" +

      '<div class="panel-block"><div class="panel-label">当前项目</div>' + projectEntry + "</div>" +

      '<div class="panel-block"><div class="panel-label">账号信息</div>' +
      '<div class="kv"><div class="k">部门</div><div class="v">' + UI.esc(u.dept) + '</div>' +
      '<div class="k">管理范围</div><div class="v">' + App.scopeLabel(u.scope) + '</div>' +
      '<div class="k">项目授权</div><div class="v">' + (App.visibleProjects().map(function (p) { return UI.esc(p.name); }).join("、") || "—") + '</div>' +
      '<div class="k">登录方式</div><div class="v">本地账号 · 会话由管理员维护</div></div></div>' +

      '<div class="panel-block"><div class="panel-label">配置与治理入口</div>' + entryGroups + "</div>" +

      '<div class="notice mt-16">' + UI.icon("lock", 15) + "<span>原型不接真实鉴权。身份切换只改变前端菜单、页面与操作入口；系统权限与项目成员授权由管理员维护，服务端必须二次校验。</span></div>";

    var panel = App.drawer({
      eyebrow: "Account & settings", title: "账号与配置", sub: "企业内部多用户演示身份，切换后立即生效。",
      body: body,
      footer: '<button class="btn" data-close>关闭</button>',
      onMount: function (el, close) {
        el.addEventListener("click", function (e) {
          if (e.target.closest('[data-app="projects"]')) { e.stopPropagation(); close(); openProjects(); return; }
          var b = e.target.closest("[data-panel-nav]");
          if (!b) return;
          var path = b.getAttribute("data-panel-nav");
          close();
          App.navigate(path);
        });
      }
    });
    if (anchor === "settings") {
      var target = panel.el.querySelector('[data-panel-nav="system/workspace"]');
      if (target) target.scrollIntoView({ block: "center" });
    }
  }

  function openNotifications() {
    var notices = App.state.notices || [];
    var body = '<div class="stack">' + notices.map(function (n) {
      return '<button class="list-row notify-row" data-notice="' + UI.esc(n.path || "overview/dashboard") + '" data-params="' + UI.esc(JSON.stringify(n.params || {})) + '">' +
        '<span class="todo-icon">' + UI.icon(n.type === "review" ? "check" : n.type === "member" ? "users" : "alert", 15) + '</span>' +
        '<span class="lr-main"><span class="lr-title">' + UI.esc(n.title) + '</span><span class="lr-sub">' + UI.esc(n.meta) + '</span></span>' +
        '<span class="badge b-warn">待查看</span></button>';
    }).join("") + "</div>" +
      '<div class="notice info mt-16">' + UI.icon("bell", 15) + "<span>通知中心只展示与当前身份和项目授权相关的待办；外部审片成员不会收到内部制作通知。</span></div>";
    App.drawer({
      eyebrow: "Notification center", title: "通知中心", sub: notices.length + " 条待处理 · 站内信与邮件同步",
      body: body,
      footer: '<button class="btn btn-soft" data-act="read-all">全部标记已读</button><button class="btn" data-close>关闭</button>',
      onMount: function (el, close) {
        el.addEventListener("click", function (e) {
          if (e.target.closest('[data-act="read-all"]')) {
            App.state.notices = [];
            close(); App.refresh(); App.toast("已全部标记已读", "通知中心已清空。", "success");
            return;
          }
          var b = e.target.closest("[data-notice]");
          if (!b) return;
          var path = b.getAttribute("data-notice");
          var params = {};
          try { params = JSON.parse(b.getAttribute("data-params") || "{}"); } catch (err) { params = {}; }
          close(); App.navigate(path, params);
        });
      }
    });
  }

  /* ---------- 全局搜索 ---------- */
  function openPalette() {
    closePalette();
    var items = [];
    var hasProject = App.visibleProjects().length > 0;
    routes.forEach(function (r) {
      if (App.routeAllowed(r) && (r.group === "system" || r.path === "overview/dashboard" || hasProject)) items.push({ group: "页面", title: r.title, sub: r.groupLabel + " · " + r.path, path: r.path, icon: r.icon });
    });
    if (hasProject) {
      App.state.episodes.forEach(function (ep) {
        items.push({ group: "剧集", title: "EP" + ep.no + " · " + ep.title, sub: ep.hook, path: "production/script", params: { ep: ep.no }, icon: "book" });
      });
      App.state.characters.forEach(function (c) {
        items.push({ group: "角色", title: c.name, sub: c.role, path: "story/bible", params: { tab: "character", id: c.id }, icon: "users" });
      });
      App.state.assets.forEach(function (a) {
        items.push({ group: "资产", title: a.name, sub: a.version + " · 引用 " + a.refs + " 次", path: "production/assets", params: { id: a.id }, icon: "image" });
      });
      App.state.shots.forEach(function (s) {
        items.push({ group: "镜头", title: s.id + " · " + s.title, sub: "EP" + s.ep + " · " + s.size, path: "production/storyboard", params: { shot: s.id }, icon: "activity" });
      });
    }
    if (App.hasPerm("member:read")) {
      App.state.members.forEach(function (m) {
        if (!App.inScope(m.deptId, null)) return;
        items.push({ group: "成员", title: m.name, sub: m.role + " · " + m.dept + " · " + App.statusLabel(m.status), path: "system/members", params: { member: m.id }, icon: "users" });
      });
    }
    if (App.hasPerm("org:read")) {
      App.state.departments.forEach(function (d) {
        items.push({ group: "部门", title: d.name, sub: "负责人 " + d.lead + " · " + d.desc, path: "system/org", params: { dept: d.id }, icon: "folder" });
      });
    }

    palette = document.createElement("div");
    palette.className = "palette open";
    palette.innerHTML = '<div class="palette-box" role="dialog" aria-label="全局搜索">' +
      '<div class="palette-input">' + UI.icon("search", 16) + '<input id="paletteInput" placeholder="搜索页面、剧集、角色、资产或镜头…" autocomplete="off"><span class="tiny muted mono">ESC 关闭</span></div>' +
      '<div class="palette-list" id="paletteList"></div>' +
      '<div class="palette-foot"><span>↑↓ 移动</span><span>Enter 打开</span><span>⌘K 随时唤起</span></div></div>';
    document.body.appendChild(palette);
    var input = palette.querySelector("#paletteInput");
    var list = palette.querySelector("#paletteList");
    var filtered = items;
    var sel = 0;

    function paint() {
      var groups = {};
      filtered.slice(0, 16).forEach(function (it) { (groups[it.group] = groups[it.group] || []).push(it); });
      var idx = 0;
      list.innerHTML = Object.keys(groups).map(function (g) {
        return '<div class="palette-group-label">' + g + "</div>" + groups[g].map(function (it) {
          var n = idx++;
          return '<button class="palette-item' + (n === sel ? " sel" : "") + '" data-idx="' + n + '">' +
            '<span class="pi-icon">' + UI.icon(it.icon, 14) + '</span><span class="pi-main"><span class="pi-title">' + UI.esc(it.title) +
            '</span><span class="pi-sub truncate">' + UI.esc(it.sub) + '</span></span><span class="pi-key">↵</span></button>';
        }).join("");
      }).join("") || UI.empty("没有匹配结果", "换一个关键词，例如「周砚」「S0107」「审核」。");
    }
    function apply() {
      var q = input.value.trim().toLowerCase();
      filtered = items.filter(function (it) { return !q || (it.title + " " + it.sub).toLowerCase().indexOf(q) > -1; });
      sel = 0; paint();
    }
    function pick(n) {
      var it = filtered[n];
      if (!it) return;
      closePalette();
      App.navigate(it.path, it.params);
    }
    input.addEventListener("input", apply);
    list.addEventListener("click", function (e) {
      var b = e.target.closest("[data-idx]");
      if (b) pick(Number(b.getAttribute("data-idx")));
    });
    list.addEventListener("mousemove", function (e) {
      var b = e.target.closest("[data-idx]");
      if (!b) return;
      sel = Number(b.getAttribute("data-idx")); paint();
    });
    palette.addEventListener("click", function (e) { if (e.target === palette) closePalette(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(filtered.length - 1, sel + 1); paint(); }
      if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
      if (e.key === "Enter") { e.preventDefault(); pick(sel); }
    });
    apply();
    setTimeout(function () { input.focus(); }, 20);
  }
  function closePalette() {
    if (palette) { palette.remove(); palette = null; }
  }

  /* ---------- 弹窗 / 抽屉 / Toast ---------- */
  App.modal = function (o) {
    var overlay = document.createElement("div");
    overlay.className = "overlay open";
    overlay.innerHTML = '<div class="modal ' + (o.size || "") + '" role="dialog" aria-modal="true">' +
      '<div class="modal-head"><div><h3>' + UI.esc(o.title) + "</h3>" + (o.sub ? "<p>" + o.sub + "</p>" : "") + "</div>" +
      '<button class="close-x" data-close aria-label="关闭">✕</button></div>' +
      '<div class="modal-body">' + o.body + "</div>" +
      (o.footer ? '<div class="modal-foot">' + o.footer + "</div>" : "") + "</div>";
    document.body.appendChild(overlay);
    function close() { overlay.remove(); }
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.closest("[data-close]")) close();
    });
    if (o.onMount) o.onMount(overlay.querySelector(".modal"), close);
    return { el: overlay, close: close };
  };

  App.drawer = function (o) {
    var wrap = document.createElement("div");
    wrap.className = "drawer-wrap open";
    wrap.innerHTML = '<div class="drawer" role="dialog" aria-modal="true"><div class="drawer-head"><div>' +
      (o.eyebrow ? '<div class="eyebrow">' + UI.esc(o.eyebrow) + "</div>" : "") +
      '<h3>' + UI.esc(o.title) + "</h3>" + (o.sub ? '<div class="small muted mt-4">' + o.sub + "</div>" : "") +
      '</div><button class="close-x" data-close aria-label="关闭">✕</button></div>' +
      '<div class="drawer-body">' + o.body + "</div>" +
      (o.footer ? '<div class="drawer-foot">' + o.footer + "</div>" : "") + "</div>";
    document.body.appendChild(wrap);
    function close() { wrap.remove(); }
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || e.target.closest("[data-close]")) close();
    });
    if (o.onMount) o.onMount(wrap.querySelector(".drawer"), close);
    return { el: wrap, close: close };
  };

  App.confirm = function (o) {
    return new Promise(function (resolve) {
      var settled = false;
      var m = App.modal({
        title: o.title, sub: o.sub || "",
        body: '<div class="confirm-copy">' + (o.message || "") + "</div>" +
          (o.detail ? '<div class="notice ' + (o.danger ? "danger" : "warn") + ' mt-12">' + UI.icon("alert", 15) + "<span>" + o.detail + "</span></div>" : ""),
        footer: '<button class="btn" data-close>取消</button><button class="btn ' + (o.danger ? "btn-danger" : "btn-primary") + '" id="cfmOk">' + UI.esc(o.okText || "确认") + "</button>",
        onMount: function (el, close) {
          el.querySelector("#cfmOk").addEventListener("click", function () { settled = true; close(); resolve(true); });
          el.querySelectorAll("[data-close]").forEach(function (b) {
            b.addEventListener("click", function () { if (!settled) { settled = true; resolve(false); } });
          });
        }
      });
      m.el.addEventListener("click", function (e) {
        if (e.target === m.el && !settled) { settled = true; resolve(false); }
      });
      m.el.addEventListener("keydown", function (e) { if (e.key === "Escape" && !settled) { settled = true; resolve(false); } });
    });
  };

  App.toast = function (title, msg, type) {
    var wrap = document.getElementById("toasts");
    if (!wrap) { wrap = document.createElement("div"); wrap.id = "toasts"; wrap.className = "toasts"; document.body.appendChild(wrap); }
    var el = document.createElement("div");
    el.className = "toast " + (type || "success");
    el.innerHTML = '<div class="t-main"><div class="t-title">' + UI.esc(title) + "</div>" + (msg ? '<div class="t-msg">' + UI.esc(msg) + "</div>" : "") + "</div>" +
      '<button class="close-x" aria-label="关闭">✕</button>';
    wrap.appendChild(el);
    var timer = setTimeout(remove, 3800);
    function remove() { el.classList.add("out"); setTimeout(function () { el.remove(); }, 220); }
    el.querySelector(".close-x").addEventListener("click", function () { clearTimeout(timer); remove(); });
  };

  App.download = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1200);
  };

  App.nowStamp = function () {
    var d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  };

  return App;
})();
