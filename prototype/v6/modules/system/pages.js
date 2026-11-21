/* ============================================================
   模块：系统（system）
   系统（system）
   企业概览 / 组织 / 用户成员 / 角色权限 / 安全访问 / 审计 /
   Provider 与模型 / 用量预算 / 我的权限 / 系统设置 / 项目设置
   ============================================================ */
(function () {
  function st() { return App.state; }

  var pageState = {
    memberStatus: "all", memberQuery: "", memberRole: "all",
    auditCategory: "all", auditQuery: "", auditSeverity: "all",
    selectedRole: "r-owner", selectedDept: null
  };
  var settingsSection = "info";
  var workspaceSection = "general";

  /* ---------- 通用助手 ---------- */
  function memberById(id) { return App.memberById(id); }
  function deptById(id) { return st().departments.filter(function (d) { return d.id === id; })[0] || null; }
  function deptMembers(id) { return st().members.filter(function (m) { return m.deptId === id; }); }
  function roleMembers(id) { return st().members.filter(function (m) { return m.roleId === id; }); }
  function projectName(id) {
    var p = st().projects.filter(function (x) { return x.id === id; })[0];
    return p ? p.name : id;
  }
  function scopeBadge(scope) {
    var tone = scope === "org" ? "b-teal" : scope === "dept" ? "b-warn" : "b-info";
    return '<span class="badge ' + tone + '">' + App.scopeLabel(scope) + "</span>";
  }
  function statusBadge(m) {
    var tone = m.status === "active" ? "b-done" : m.status === "invited" ? "b-warn" : "b-danger";
    return '<span class="badge ' + tone + '"><span class="dot"></span>' + App.statusLabel(m.status) + "</span>";
  }
  function riskBadge(risk) {
    var map = { low: ["b-teal", "低风险"], medium: ["b-warn", "中风险"], high: ["b-danger", "高风险"] };
    var v = map[risk] || ["b-todo", risk];
    return '<span class="badge ' + v[0] + '">' + v[1] + "</span>";
  }
  function resultBadge(result) {
    if (result === "failed") return UI.badge("失败", "b-danger");
    if (result === "blocked") return UI.badge("已阻断", "b-warn");
    return UI.badge("成功", "b-done");
  }
  function fmt(n) { return Number(n || 0).toLocaleString("zh-CN"); }
  function personRow(m) {
    return '<div class="list-row">' + UI.avatar(m.name, "sm", m.color) + '<span class="lr-main"><span class="lr-title">' + UI.esc(m.name) + " · " + UI.esc(m.role) + '</span><span class="lr-sub">' + UI.esc(m.dept) + " · " + UI.esc(m.email) + "</span></span>" + statusBadge(m) + "</div>";
  }

  /* ================= 我的权限 ================= */
  function accessPage() {
    var u = App.currentUser;
    var s = st();
    var granted = 0, total = 0;
    s.permissionCatalog.forEach(function (g) { g.items.forEach(function (it) { total++; if (App.hasPerm(it.key)) granted++; }); });
    var routeAllowed = App.routes().filter(function (r) { return App.routeAllowed(r); }).length;
    var groupHtml = s.permissionCatalog.map(function (g) {
      var yes = g.items.filter(function (it) { return App.hasPerm(it.key); }).length;
      return '<div class="perm-group"><div class="perm-group-head"><div><b>' + UI.esc(g.label) + '</b><small>' + UI.esc(g.desc) + '</small></div><span class="tag">' + yes + " / " + g.items.length + "</span></div>" +
        g.items.map(function (it) {
          var has = App.hasPerm(it.key);
          return '<div class="perm-row' + (has ? " granted" : "") + '"><span class="perm-check">' + (has ? "✓" : "—") + '</span><span class="perm-main"><span class="perm-name">' + UI.esc(it.label) + '</span><span class="perm-key mono">' + UI.esc(it.key) + '</span></span><span class="perm-desc">' + UI.esc(it.desc) + "</span>" + riskBadge(it.risk) + "</div>";
        }).join("") + "</div>";
    }).join("");
    var routesByGroup = {};
    App.routes().forEach(function (r) {
      if (!App.routeAllowed(r)) return;
      (routesByGroup[r.groupLabel] = routesByGroup[r.groupLabel] || []).push(r);
    });
    var routeHtml = Object.keys(routesByGroup).map(function (label) {
      return '<div class="access-group"><div class="eyebrow">' + UI.esc(label) + '</div><div class="row wrap mt-8">' +
        routesByGroup[label].map(function (r) { return '<a class="chip soft" href="' + App.link(r.path) + '">' + UI.icon(r.icon, 12) + UI.esc(r.title) + "</a>"; }).join("") + "</div></div>";
    }).join("");
    var projectChips = App.visibleProjects().map(function (p) { return '<span class="chip">' + UI.esc(p.name) + " · " + UI.esc(p.code) + "</span>"; }).join("");
    var temp = (u.tempPerms || []).length ? u.tempPerms.map(function (p) { return '<span class="chip">' + UI.esc(p) + "</span>"; }).join("") : '<span class="tiny muted">没有临时授权。临时权限到期后自动失效。</span>';

    return '<div class="page">' +
      UI.pageHead({ eyebrow: "System · My access", title: "我的权限", desc: "系统权限只决定管理能力；进入任何项目资源还要通过项目成员授权。这里展示当前身份的系统权限、项目成员关系与可见路由。", actions: '<button class="btn" data-act="request-access">' + UI.icon("lock") + '申请项目授权</button>' + '<a class="btn" href="' + App.link("system/audit") + '">查看审计</a>' }) +
      '<div class="access-hero card card-pad"><div class="account-head" style="padding-top:0">' + UI.avatar(u.name, "lg", u.color) +
      '<div><div class="account-name">' + UI.esc(u.name) + '</div><div class="small muted">' + UI.esc(u.title) + " · " + UI.esc(u.email) + '</div><div class="row wrap mt-8"><span class="badge b-teal">' + UI.esc(u.role) + "</span>" + scopeBadge(u.scope) + '<span class="badge b-outline">' + (u.accountType === "external" ? "外部审片账号" : "内部成员账号") + "</span>" + statusBadge({ status: u.status }) + "</div></div>" +
      '<div class="spacer"></div><div class="access-score"><div class="tiny muted">权限覆盖</div><div class="access-num">' + granted + "/" + total + '</div><div class="tiny muted">' + routeAllowed + " 个页面可访问</div></div></div></div>" +
      '<div class="grid g4 mt-16">' + UI.stat({ label: "当前角色", value: u.role, delta: App.scopeLabel(u.scope) }) +
      UI.stat({ label: "已授予权限", value: String(granted), unit: "项", delta: "共 " + total + " 项系统权限" }) +
      UI.stat({ label: "可访问页面", value: String(routeAllowed), unit: "个", delta: "权限不足的页面显示 403" }) +
      UI.stat({ label: "项目成员授权", value: String(projectChips ? App.visibleProjects().length : 0), unit: "个", delta: "跨项目资源默认拒绝" }) + "</div>" +
      '<div class="grid g-2-1 mt-16"><div class="card"><div class="card-head"><div><h3>权限明细</h3><div class="ch-sub">系统 RBAC · 未授予项保留可见，便于申请</div></div><span class="tag">' + granted + " / " + total + "</span></div><div class=\"card-body\">" + groupHtml + "</div></div>" +
      '<div class="stack"><div class="card"><div class="card-head"><div><h3>项目成员授权</h3><div class="ch-sub">双层校验的第二层，独立于系统角色</div></div>' + scopeBadge(u.scope) + '</div><div class="card-body"><div class="kv"><div class="k">所属部门</div><div class="v">' + UI.esc(u.dept) + '</div><div class="k">系统角色范围</div><div class="v">' + App.scopeLabel(u.scope) + '</div><div class="k">可进入项目</div><div class="v">' + (projectChips || '<span class="muted">暂无项目授权</span>') + '</div><div class="k">临时授权</div><div class="v">' + temp + "</div></div>" +
      '<div class="notice info mt-12">' + UI.icon("lock", 15) + "<span>组织单元与租户是两层关系；项目、剧本、镜头、任务和导出需同时校验 tenant_id、project_id 与项目成员关系。</span></div></div></div>" +
      '<div class="card"><div class="card-head"><div><h3>可访问路由</h3><div class="ch-sub">侧栏、搜索与直达 URL 使用同一份权限表</div></div><span class="tag">' + routeAllowed + "</span></div><div class=\"card-body\">" + routeHtml + "</div></div></div></div></div>";
  }

  function requestAccess() {
    var body = '<div class="form-grid"><div class="field"><label>申请类型</label><select class="select" id="reqType"><option value="project">项目访问</option><option value="permission">临时权限</option><option value="download">下载审批</option></select></div>' +
      '<div class="field"><label>目标</label><input class="input" id="reqTarget" placeholder="例如：项目访问 / export:run"></div>' +
      '<div class="field span2"><label>申请原因<span class="req">*</span></label><textarea class="textarea" id="reqReason" rows="4" placeholder="说明业务场景、使用时长与复核人。"></textarea><span class="err-msg" id="reqErr">请填写申请原因</span></div></div>' +
      '<div class="notice info mt-12">' + UI.icon("lock", 15) + "<span>提交后进入管理员审批队列。原型不发送真实审批，但会写入审计日志与待办。</span></div>";
    App.modal({
      title: "申请额外权限", sub: "当前身份：" + App.currentUser.name + " · " + App.currentUser.role, size: "lg", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="reqGo">提交申请</button>',
      onMount: function (el, close) {
        el.querySelector("#reqGo").addEventListener("click", function () {
          var reason = el.querySelector("#reqReason").value.trim();
          if (!reason) { el.querySelector("#reqErr").classList.add("show"); return; }
          var type = el.querySelector("#reqType").value;
          var target = el.querySelector("#reqTarget").value.trim() || ({ project: "《长夜将明》项目访问", permission: "临时操作权限", download: "审阅版下载" })[type];
          st().accessRequests.unshift({
            id: "R-" + (1049 + st().accessRequests.length), type: type,
            requesterId: App.currentUser.id, requester: App.currentUser.name,
            title: type === "project" ? "申请项目访问" : type === "permission" ? "申请临时权限" : "申请下载审批",
            target: target, reason: reason, risk: type === "permission" ? "medium" : "low",
            status: "pending", createdAt: "今天 " + App.nowStamp(), approver: ""
          });
          App.logAudit("提交权限申请", target, "成员", reason, "normal", null);
          close(); App.refresh(); App.toast("申请已提交", "管理员会在治理待办中看到这条申请。", "success");
        });
      }
    });
  }

  /* ================= 企业概览 ================= */
  function enterpriseOverview() {
    var s = st();
    var ms = App.memberStats();
    var projects = App.visibleProjects();
    var usage = s.orgUsage;
    var pending = s.accessRequests.filter(function (r) { return r.status === "pending"; });
    var providerOk = s.providers.filter(function (p) { return p.enabled && p.configured; }).length;
    var checks = s.securityChecks.map(function (c) {
      return '<div class="sec-check-row"><span class="sec-check-main"><b>' + UI.esc(c.label) + '</b><small>' + UI.esc(c.detail) + '</small></span>' +
        '<span class="sec-check-score">' + c.score + '</span>' + UI.statusBadge(c.status) + "</div>";
    }).join("");
    var requests = pending.length ? pending.map(function (r) {
      return '<div class="request-row"><div class="req-main"><div class="req-title">' + UI.esc(r.requester) + " · " + UI.esc(r.title) + '</div><div class="req-sub">' + UI.esc(r.target) + " · " + UI.esc(r.createdAt) + '</div><div class="tiny muted mt-4">' + UI.esc(r.reason) + "</div></div>" + riskBadge(r.risk) +
        '<div class="row" style="gap:6px"><button class="btn btn-xs" data-act="deny" data-id="' + r.id + '">拒绝</button><button class="btn btn-xs btn-primary" data-act="approve" data-id="' + r.id + '">通过</button></div></div>';
    }).join("") : UI.empty("没有待审批申请", "项目授权申请会在这里进入审批队列。");
    var roleDist = s.roles.map(function (r) {
      var n = roleMembers(r.id).length;
      return '<div class="role-dist-row"><span class="rd-name">' + UI.esc(r.name) + '</span><div class="progress thin"><i style="width:' + Math.round(n / s.members.length * 100) + '%"></i></div><span class="mono tiny">' + n + "</span></div>";
    }).join("");
    var recent = s.audit.filter(function (a) { return App.inScope(a.deptId, a.projectId); }).slice(0, 5).map(function (a) {
      return '<div class="list-row"><span class="mono tiny" style="width:48px">' + UI.esc(a.time) + '</span><span class="lr-main"><span class="lr-title">' + UI.esc(a.action) + '</span><span class="lr-sub">' + UI.esc(a.actor) + " · " + UI.esc(a.target) + "</span></span>" + resultBadge(a.result) + "</div>";
    }).join("");
    var projectRows = projects.map(function (p) {
      var owner = memberById(p.ownerId);
      return '<div class="list-row"><span class="lr-main"><span class="lr-title">' + UI.esc(p.name) + '</span><span class="lr-sub mono">' + UI.esc(p.code) + " · " + (p.memberIds || []).length + ' 人</span></span><span class="badge b-outline">' + UI.esc(owner ? owner.name : "—") + "</span></div>";
    }).join("") || UI.empty("当前没有项目授权", "项目负责人由组织管理员授予项目成员资格。");
    var budgetPct = Math.round(usage.spent / usage.budget * 100);
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "System · Governance", title: "企业概览", desc: "私有化部署的内部生产治理视图：用户、项目授权、Provider、用量与审计。仅具备系统权限的身份可见。", actions: (App.hasPerm("member:manage") ? '<button class="btn" data-act="invite">' + UI.icon("users") + '邀请成员</button>' : "") + '<a class="btn btn-primary" href="' + App.link("system/providers") + '">' + UI.icon("grid") + "Provider 与模型</a>" }) +
      '<div class="grid g4">' + UI.stat({ label: "用户账号", value: String(ms.total), unit: "人", delta: ms.active + " 正常 · " + ms.invited + " 待接受" }) +
      UI.stat({ label: "项目授权", value: String(projects.length), unit: "个", delta: ms.projectMemberships + " 条成员授权" }) +
      UI.stat({ label: "生产 Provider", value: String(providerOk), unit: "个", delta: "Mork 默认 · Mock 仅测试" }) +
      UI.stat({ label: "本月用量", value: Math.round(budgetPct) + "%", delta: App.formatMoney(usage.spent) + " / " + App.formatMoney(usage.budget) }) + "</div>" +
      '<div class="grid g-2-1 mt-16"><div class="stack">' +
      UI.card({ title: "系统能力", sub: "企业内部平台的管理范围，不含租户计费与自助开通", body: '<div class="quick-grid">' +
        '<a class="quick-tile" href="' + App.link("system/org") + '"><span class="quick-icon">' + UI.icon("folder", 15) + '</span><span class="quick-main"><span class="quick-title">组织与部门</span><span class="quick-sub">人员组织，不是 SaaS tenant</span></span></a>' +
        '<a class="quick-tile" href="' + App.link("system/roles") + '"><span class="quick-icon">' + UI.icon("check", 15) + '</span><span class="quick-main"><span class="quick-title">系统 RBAC</span><span class="quick-sub">角色、权限与管理范围</span></span></a>' +
        '<a class="quick-tile" href="' + App.link("system/providers") + '"><span class="quick-icon">' + UI.icon("grid", 15) + '</span><span class="quick-main"><span class="quick-title">Provider 与模型</span><span class="quick-sub">凭据、能力注册与路由</span></span></a>' +
        '<a class="quick-tile" href="' + App.link("system/security") + '"><span class="quick-icon">' + UI.icon("lock", 15) + '</span><span class="quick-main"><span class="quick-title">数据外发策略</span><span class="quick-sub">默认拒绝 · 合同审查</span></span></a>' +
        '<a class="quick-tile" href="' + App.link("system/usage") + '"><span class="quick-icon">' + UI.icon("download", 15) + '</span><span class="quick-main"><span class="quick-title">用量与预算</span><span class="quick-sub">项目 / 镜头 / 模型</span></span></a>' +
        '<a class="quick-tile" href="' + App.link("system/audit") + '"><span class="quick-icon">' + UI.icon("list", 15) + '</span><span class="quick-main"><span class="quick-title">审计日志</span><span class="quick-sub">不可变 · request_id</span></span></a>' +
        "</div>" }) +
      UI.card({ title: "安全基线", sub: "项目授权、凭据、外发、会话、上传、审计与媒体处理", head: '<a class="btn btn-xs" href="' + App.link("system/security") + '">查看策略</a>', body: '<div class="sec-checks">' + checks + "</div>" }) +
      UI.card({ title: "访问审批", sub: "项目成员授权、临时权限与下载审批", head: '<span class="tag">' + pending.length + " 待处理</span>", body: requests }) +
      UI.card({ title: "最近管理动作", sub: "当前数据范围内可见的审计事件", head: '<a class="btn btn-xs" href="' + App.link("system/audit") + '">全部审计</a>', body: recent }) +
      "</div><div class=\"stack\">" +
      UI.card({ title: "预算执行", sub: usage.period, head: '<a class="btn btn-xs" href="' + App.link("system/usage") + '">明细</a>', body: '<div class="plan-mini"><div class="plan-price">' + App.formatMoney(usage.spent) + '<small> / ' + App.formatMoney(usage.budget) + '</small></div><div class="tiny muted">预计月末 ' + App.formatMoney(usage.estimatedMonth) + " · 阈值 " + usage.threshold + '%</div></div>' +
        '<div class="between mt-12"><span class="tiny muted">组织预算执行</span><span class="mono tiny">' + budgetPct + '%</span></div>' + UI.progress(budgetPct) +
        '<div class="tiny muted mt-12">项目 ' + projects.length + ' · 模型 ' + App.state.models.length + " · 成员 " + App.memberStats().total + '</div>' }) +
      UI.card({ title: "项目成员授权", sub: "当前管理范围内可见的项目与负责人", head: '<span class="tag">' + projects.length + "</span>", body: projectRows }) +
      UI.card({ title: "角色分布", sub: "仅统计系统角色；项目成员不计入", body: '<div class="role-dist">' + roleDist + "</div>" }) +
      UI.card({ title: "系统入口", sub: "管理员的常用治理动作", body: '<div class="quick-grid">' +
        '<a class="quick-tile" href="' + App.link("system/providers") + '"><span class="quick-icon">' + UI.icon("grid", 15) + '</span><span class="quick-main"><span class="quick-title">Provider</span><span class="quick-sub">凭据与模型</span></span></a>' +
        '<a class="quick-tile" href="' + App.link("system/usage") + '"><span class="quick-icon">' + UI.icon("download", 15) + '</span><span class="quick-main"><span class="quick-title">用量预算</span><span class="quick-sub">成本与阈值</span></span></a>' +
        '<a class="quick-tile" href="' + App.link("system/audit") + '"><span class="quick-icon">' + UI.icon("list", 15) + '</span><span class="quick-main"><span class="quick-title">审计日志</span><span class="quick-sub">不可变记录</span></span></a>' +
        '<a class="quick-tile" href="' + App.link("system/workspace") + '"><span class="quick-icon">' + UI.icon("sliders", 15) + '</span><span class="quick-main"><span class="quick-title">系统设置</span><span class="quick-sub">部署、存储与备份</span></span></a>' +
        "</div>" }) + "</div></div></div>";
  }

  function decideRequest(id, approve) {
    var req = st().accessRequests.filter(function (r) { return r.id === id; })[0];
    if (!req || req.status !== "pending") return;
    req.status = approve ? "approved" : "denied";
    req.approver = App.currentUser.name;
    var member = memberById(req.requesterId);
    if (approve && req.type === "project" && member) {
      if (member.projects.indexOf("nyjm") < 0) member.projects.push("nyjm");
      if (st().project.memberIds.indexOf(member.id) < 0) { st().project.memberIds.push(member.id); st().project.members++; }
      var identity = st().identities.filter(function (x) { return x.id === member.id; })[0];
      if (identity && identity.projectIds.indexOf("nyjm") < 0) identity.projectIds.push("nyjm");
    }
    if (approve && req.type === "permission" && member) {
      var perm = req.target.split("·")[0].trim();
      member.tempPerms = member.tempPerms || [];
      if (member.tempPerms.indexOf(perm) < 0) member.tempPerms.push(perm);
      var idn = st().identities.filter(function (x) { return x.id === member.id; })[0];
      if (idn) { idn.tempPerms = idn.tempPerms || []; if (idn.tempPerms.indexOf(perm) < 0) idn.tempPerms.push(perm); }
    }
    App.logAudit(approve ? "通过访问申请" : "拒绝访问申请", req.requester + " · " + req.title, "成员", req.reason, "warning", null);
    App.refresh();
    App.toast(approve ? "申请已通过" : "申请已拒绝", req.requester + " · " + req.title, approve ? "success" : "warn");
  }

  /* ================= 组织架构 ================= */
  function subtreeMembers(id) {
    var own = deptMembers(id).length;
    var children = st().departments.filter(function (x) { return x.parent === id; });
    return own + children.reduce(function (n, c) { return n + subtreeMembers(c.id); }, 0);
  }
  function deptNode(d, depth) {
    var children = st().departments.filter(function (x) { return x.parent === d.id; });
    if (App.currentUser.scope !== "org") {
      children = children.filter(function (x) { return App.inScope(x.id, null); });
    }
    var visible = subtreeMembers(d.id);
    return '<div class="org-node"><button class="org-dept" data-act="dept" data-id="' + d.id + '">' +
      '<span class="org-mark">' + UI.esc(d.name.charAt(0)) + '</span><span class="org-main"><span class="org-name">' + UI.esc(d.name) + '</span><span class="org-desc">' + UI.esc(d.desc) + '</span></span>' +
      '<span class="org-meta"><span>负责人 ' + UI.esc(d.lead) + "</span><span>" + visible + " 人</span></span>" + UI.icon("arrow", 13) + "</button>" +
      (children.length ? '<div class="org-children">' + children.map(function (c) { return deptNode(c, depth + 1); }).join("") + "</div>" : "") + "</div>";
  }

  function orgPage() {
    var s = st();
    var root = s.departments.filter(function (d) { return d.parent === null; })[0];
    var visibleMembers = s.members.filter(function (m) { return App.inScope(m.deptId, null); });
    var projectRows = s.projects.map(function (p) {
      return '<tr><td><b>' + UI.esc(p.name) + '</b><span class="t-sub mono">' + UI.esc(p.code) + '</span></td><td>' + UI.esc(p.ownerId ? (memberById(p.ownerId) || {}).name || "—" : "—") + '</td><td>' + (p.memberIds ? p.memberIds.length : 0) + ' 人</td><td>' + UI.badge("项目成员授权", "b-info") + "</td><td>" + UI.esc(p.stage) + "</td></tr>";
    }).join("");
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "System · Organization", title: "组织架构", desc: "部门、负责人和成员归属用于人员组织与管理，不等同 SaaS tenant。任何项目内容访问仍由项目成员授权决定。", actions: (App.hasPerm("dept:manage") ? '<button class="btn" data-act="add-dept">' + UI.icon("plus") + '新增部门</button>' : "") + '<button class="btn" data-act="export-org">' + UI.icon("download") + "导出组织</button>" }) +
      '<div class="grid g4">' + UI.stat({ label: "部门", value: String(s.departments.length), unit: "个", delta: "3 个一级部门" }) +
      UI.stat({ label: "企业成员", value: String(s.members.length), unit: "人", delta: s.members.filter(function (m) { return m.status === "active"; }).length + " 人正常" }) +
      UI.stat({ label: "当前可见", value: String(visibleMembers.length), unit: "人", delta: App.scopeLabel(App.currentUser.scope) }) +
      UI.stat({ label: "项目成员授权", value: String(App.memberStats().projectMemberships), unit: "条", delta: "项目边界独立于部门" }) + "</div>" +
      '<div class="grid g-2-1 mt-16"><div class="card"><div class="card-head"><div><h3>组织树</h3><div class="ch-sub">点击部门查看成员与负责人</div></div><span class="badge b-teal">' + App.scopeLabel(App.currentUser.scope) + "可见</span></div><div class=\"card-body\">" + (root ? deptNode(root, 0) : UI.empty("暂无组织", "新增根部门开始搭建组织。")) + "</div></div>" +
      '<div class="stack"><div class="card"><div class="card-head"><div><h3>双层校验规则</h3><div class="ch-sub">系统 RBAC 只决定管理能力，项目成员授权决定内容访问</div></div></div><div class="card-body">' +
      '<div class="scope-rule"><span class="badge b-teal">全组织</span><p>系统管理员与组织管理员可管理组织、用户、角色、Provider 与审计；不自动读取未授权项目内容。</p></div>' +
      '<div class="scope-rule"><span class="badge b-warn">本部门</span><p>部门负责人只管理本部门人员与组织信息；项目内容仍需项目成员授权。</p></div>' +
      '<div class="scope-rule"><span class="badge b-info">项目成员</span><p>读取、修改、生成、审核和导出项目资源时，服务端必须校验 project_id 与成员资格。</p></div>' +
      '<div class="scope-rule"><span class="badge b-danger">禁止跨项目</span><p>资产只归属单一 project_id；跨项目搜索、引用、共享默认拒绝，管理员也不例外。</p></div></div></div>' +
      UI.card({ title: "当前身份", body: '<div class="account-head" style="padding:0 0 10px">' + UI.avatar(App.currentUser.name, "lg", App.currentUser.color) + '<div><div class="account-name">' + UI.esc(App.currentUser.name) + '</div><div class="small muted">' + UI.esc(App.currentUser.role) + " · " + UI.esc(App.currentUser.dept) + '</div></div></div><div class="kv"><div class="k">管理范围</div><div class="v">' + App.scopeLabel(App.currentUser.scope) + '</div><div class="k">可见成员</div><div class="v">' + visibleMembers.length + " / " + s.members.length + '</div><div class="k">项目授权</div><div class="v">' + App.visibleProjects().length + " 个项目</div></div>" }) + "</div></div>" +
      '<div class="card mt-16"><div class="card-head"><div><h3>项目成员映射</h3><div class="ch-sub">项目是协作、资产与授权的唯一边界；组织管理员也不会自动获得项目内容</div></div></div><div class="card-body tight"><div class="table-wrap"><table><thead><tr><th>项目</th><th>负责人</th><th>成员</th><th>授权方式</th><th>阶段</th></tr></thead><tbody>' + projectRows + "</tbody></table></div></div></div></div>";
  }

  function addDept() {
    var body = '<div class="form-grid"><div class="field"><label>部门名称<span class="req">*</span></label><input class="input" id="dpName" placeholder="例如：海外发行"><span class="err-msg" id="dpErr">请填写部门名称</span></div>' +
      '<div class="field"><label>上级部门</label><select class="select" id="dpParent">' + st().departments.map(function (d) { return '<option value="' + d.id + '">' + UI.esc(d.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>负责人</label><select class="select" id="dpLead">' + st().members.filter(function (m) { return m.status === "active"; }).map(function (m) { return '<option value="' + m.id + '">' + UI.esc(m.name) + " · " + UI.esc(m.title) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>部门说明</label><input class="input" id="dpDesc" placeholder="职责范围"></div></div>';
    App.modal({
      title: "新增部门", sub: "部门只用于人员组织与管理，不授予项目内容访问。", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="dpGo">创建部门</button>',
      onMount: function (el, close) {
        el.querySelector("#dpGo").addEventListener("click", function () {
          var name = el.querySelector("#dpName").value.trim();
          if (!name) { el.querySelector("#dpErr").classList.add("show"); return; }
          var lead = memberById(el.querySelector("#dpLead").value);
          st().departments.push({ id: "d-" + Date.now(), name: name, parent: el.querySelector("#dpParent").value, leadId: lead.id, lead: lead.name, type: "team", desc: el.querySelector("#dpDesc").value.trim() || "新建部门" });
          App.logAudit("新增部门", name, "组织", "建立部门并指定负责人 " + lead.name, "normal", null);
          close(); App.refresh(); App.toast("部门已创建", name + " · 负责人 " + lead.name, "success");
        });
      }
    });
  }

  function deptDrawer(id) {
    var d = deptById(id);
    if (!d) return;
    var members = deptMembers(d.id).filter(function (m) { return App.inScope(m.deptId, null); });
    var can = App.hasPerm("dept:manage");
    var body = '<div class="account-head">' + UI.avatar(d.name, "lg") + '<div><div class="account-name">' + UI.esc(d.name) + '</div><div class="small muted">' + UI.esc(d.desc) + " · 负责人 " + UI.esc(d.lead) + "</div></div></div>" +
      '<div class="kv"><div class="k">部门 ID</div><div class="v mono">' + UI.esc(d.id) + '</div><div class="k">成员</div><div class="v">' + members.length + ' 人可见</div><div class="k">上级</div><div class="v">' + UI.esc(d.parent ? deptById(d.parent).name : "根组织") + "</div></div>" +
      (can ? '<div class="field mt-16"><label>调整负责人</label><select class="select" id="dLead">' + st().members.filter(function (m) { return m.status === "active"; }).map(function (m) { return '<option value="' + m.id + '"' + (m.id === d.leadId ? " selected" : "") + ">" + UI.esc(m.name) + " · " + UI.esc(m.title) + "</option>"; }).join("") + "</select></div>" : "") +
      '<div class="eyebrow mt-20">部门成员</div><div class="stack mt-8">' + (members.length ? members.map(personRow).join("") : '<div class="notice info">' + UI.icon("lock", 15) + "<span>当前数据范围不包含该部门成员。</span></div>") + "</div>";
    App.drawer({
      eyebrow: "Department", title: d.name, sub: d.lead + " · " + members.length + " 人可见", body: body,
      footer: '<button class="btn" data-close>关闭</button>' + (can ? '<button class="btn btn-primary" id="dSave">保存负责人</button>' : ""),
      onMount: function (el, close) {
        var save = el.querySelector("#dSave");
        if (save) save.addEventListener("click", function () {
          var lead = memberById(el.querySelector("#dLead").value);
          d.leadId = lead.id; d.lead = lead.name;
          App.logAudit("调整部门负责人", d.name + " → " + lead.name, "组织", "部门负责人变更", "normal", null);
          close(); App.refresh(); App.toast("负责人已更新", d.name + " → " + lead.name, "success");
        });
      }
    });
  }

  /* ================= 用户与成员 ================= */
  function filteredMembers() {
    var q = pageState.memberQuery.toLowerCase();
    return st().members.filter(function (m) {
      if (!App.inScope(m.deptId, null)) return false;
      if (pageState.memberStatus !== "all" && m.status !== pageState.memberStatus) return false;
      if (pageState.memberRole !== "all" && m.roleId !== pageState.memberRole) return false;
      if (!q) return true;
      return (m.name + " " + m.email + " " + m.title + " " + m.dept + " " + m.role).toLowerCase().indexOf(q) > -1;
    });
  }

  function membersPage() {
    var s = st();
    var ms = App.memberStats();
    var list = filteredMembers();
    var roleOptions = s.roles.filter(function (r) { return r.id !== "r-owner"; });
    var rows = list.map(function (m) {
      var projects = (m.projects || []).map(function (id) { return projectName(id); });
      return '<tr class="member-row" data-act="member" data-id="' + m.id + '"><td><div class="member-cell">' + UI.avatar(m.name, "sm", m.color) + '<span><b>' + UI.esc(m.name) + '</b><span class="t-sub">' + UI.esc(m.email) + "</span></span></div></td>" +
        "<td>" + UI.esc(m.dept) + "</td><td><b>" + UI.esc(m.role) + '</b><span class="t-sub">' + App.scopeLabel((App.roleOf(m) || {}).scope) + "</span></td>" +
        '<td>' + (m.accountType === "external" ? UI.badge("外部审片", "b-info") : UI.badge("内部成员", "b-teal")) + "</td>" +
        '<td><b class="mono tiny">' + projects.length + "</b><span class=\"t-sub\">" + (projects.slice(0, 2).join("、") || "未授权项目") + "</span></td><td>" + statusBadge(m) + "</td><td>" + UI.esc(m.last) + '</td><td><button class="btn btn-xs" data-act="member" data-id="' + m.id + '">详情</button></td></tr>';
    }).join("");
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "System · Users & members", title: "用户与成员", desc: "账号生命周期、系统角色与项目成员授权。系统角色不替代项目授权；当前管理范围：" + App.scopeLabel(App.currentUser.scope) + "。", actions: (App.hasPerm("member:manage") ? '<button class="btn btn-primary" data-act="invite">' + UI.icon("users") + '邀请成员</button>' : "") + '<a class="btn" href="' + App.link("system/roles") + '">角色与权限</a>' }) +
      '<div class="grid g4">' + UI.stat({ label: "用户账号", value: String(ms.total), unit: "人", delta: "当前可见 " + s.members.filter(function (m) { return App.inScope(m.deptId, null); }).length + " 人" }) +
      UI.stat({ label: "正常账号", value: String(ms.active), unit: "人", delta: ms.external + " 个外部审片账号" }) +
      UI.stat({ label: "待接受 / 停用", value: String(ms.invited) + " / " + String(ms.suspended), delta: "停用即撤销会话与项目访问" }) +
      UI.stat({ label: "项目成员授权", value: String(ms.projectMemberships), unit: "条", delta: "覆盖 " + ms.projectsCovered + " 个项目" }) + "</div>" +
      '<div class="card mt-16"><div class="card-head"><div><h3>成员目录</h3><div class="ch-sub">按状态、角色与关键词筛选；点击行查看账号档案与项目授权</div></div></div><div class="card-body">' +
      '<form class="member-toolbar" data-form="member-search"><label class="filter-search">' + UI.icon("search", 14) + '<input class="input" id="mQuery" value="' + UI.esc(pageState.memberQuery) + '" placeholder="搜索姓名、邮箱、部门或角色"></label>' +
      '<select class="select" id="mRole" style="width:150px"><option value="all">全部角色</option>' + (App.hasPerm("member:manage") ? roleOptions : s.roles).map(function (r) { return '<option value="' + r.id + '"' + (pageState.memberRole === r.id ? " selected" : "") + ">" + UI.esc(r.name) + "</option>"; }).join("") + "</select>" +
      '<button class="btn btn-sm" type="submit">筛选</button><button class="btn btn-sm btn-ghost" type="button" data-act="mreset">重置</button></form>' +
      '<div class="row wrap mt-8">' + [["all", "全部"], ["active", "正常"], ["invited", "待接受"], ["suspended", "已停用"]].map(function (x) {
        return '<button class="chip' + (pageState.memberStatus === x[0] ? " on" : "") + '" data-act="mstatus" data-key="' + x[0] + '">' + x[1] + "</button>";
      }).join("") + '<span class="spacer"></span><span class="tiny muted">' + list.length + " / " + s.members.length + " 人</span></div>" +
      (rows ? '<div class="table-wrap mt-12"><table class="member-table"><thead><tr><th>成员</th><th>部门</th><th>系统角色</th><th>账号类型</th><th>项目授权</th><th>状态</th><th>最近活跃</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>" : UI.empty("没有匹配成员", "调整筛选条件，或邀请新成员。", App.hasPerm("member:manage") ? '<button class="btn btn-primary mt-16" data-act="invite">邀请成员</button>' : "")) +
      "</div></div></div>";
  }

  function inviteMember() {
    var roles = st().roles.filter(function (r) { return r.id !== "r-owner"; });
    var body = '<div class="form-grid"><div class="field"><label>姓名<span class="req">*</span></label><input class="input" id="invName" placeholder="例如：唐宁"><span class="err-msg" id="invNameErr">请填写姓名</span></div>' +
      '<div class="field"><label>企业邮箱<span class="req">*</span></label><input class="input" id="invEmail" placeholder="name@studio.cn"><span class="err-msg" id="invErr">请输入有效邮箱</span></div>' +
      '<div class="field"><label>角色</label><select class="select" id="invRole">' + roles.map(function (r) { return '<option value="' + r.id + '">' + UI.esc(r.name) + " · " + App.scopeLabel(r.scope) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>部门</label><select class="select" id="invDept">' + st().departments.filter(function (d) { return d.parent !== null; }).map(function (d) { return '<option value="' + d.id + '">' + UI.esc(d.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>账号类型</label><select class="select" id="invAccount"><option value="internal">内部成员账号</option><option value="external">外部审片账号</option></select></div>' +
      '<div class="field"><label>初始项目授权</label><select class="select" id="invProject">' + st().projects.map(function (p) { return '<option value="' + p.id + '">' + UI.esc(p.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field span2"><label class="checkline"><input type="checkbox" id="invApproval" checked> 外部审片账号默认禁止内部制作页与导出下载</label></div></div>' +
      '<div class="notice info mt-12">' + UI.icon("users", 15) + "<span>邀请后账号为「待接受」。系统角色决定管理能力，项目成员授权单独生效；外部账号不会自动获得内部制作权限。</span></div>";
    App.modal({
      title: "邀请成员", sub: "按角色与部门授予最小权限，邀请会写入审计。", size: "lg", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="invGo">发送邀请</button>',
      onMount: function (el, close) {
        el.querySelector("#invGo").addEventListener("click", function () {
          var name = el.querySelector("#invName").value.trim();
          var email = el.querySelector("#invEmail").value.trim();
          var okName = !!name, okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
          el.querySelector("#invNameErr").classList.toggle("show", !okName);
          el.querySelector("#invErr").classList.toggle("show", !okEmail);
          if (!okName || !okEmail) return;
          if (st().members.some(function (m) { return m.email.toLowerCase() === email.toLowerCase(); })) {
            App.toast("成员已存在", email + " 已在成员目录中。", "warn"); return;
          }
          var role = App.roleById(el.querySelector("#invRole").value);
          var accountType = el.querySelector("#invAccount").value;
          if (accountType === "external") role = App.roleById("r-guest");
          var dept = deptById(el.querySelector("#invDept").value);
          var project = el.querySelector("#invProject").value;
          st().members.push({
            id: "m-" + Date.now(), code: "", demo: false, name: name, email: email, title: role.name,
            deptId: dept.id, dept: dept.name, roleId: role.id, role: role.name,
            accountType: accountType, status: "invited", presence: "offline",
            last: "—", lastActive: "—", joined: "待接受", source: "invite",
            projects: [project], initial: name.charAt(0), color: "green", tempPerms: []
          });
          App.logAudit("邀请成员", email + " · " + role.name, "成员", "邀请加入 " + dept.name + "，项目成员授权 " + projectName(project), "normal", project);
          close(); App.refresh(); App.toast("邀请已发送", email + " · " + role.name + "，等待接受。", "success");
        });
      }
    });
  }

  function memberDrawer(id) {
    var m = memberById(id);
    if (!m) return;
    var role = App.roleOf(m);
    var can = App.hasPerm("member:manage");
    var body = '<div class="account-head">' + UI.avatar(m.name, "lg", m.color) + '<div><div class="account-name">' + UI.esc(m.name) + '</div><div class="small muted">' + UI.esc(m.title) + " · " + UI.esc(m.email) + '</div><div class="row wrap mt-8">' + statusBadge(m) + (m.accountType === "external" ? UI.badge("外部审片账号", "b-info") : UI.badge("内部成员账号", "b-teal")) + "</div></div></div>" +
      '<div class="kv"><div class="k">成员 ID</div><div class="v mono">' + UI.esc(m.id) + '</div><div class="k">部门</div><div class="v">' + UI.esc(m.dept) + '</div><div class="k">加入时间</div><div class="v">' + UI.esc(m.joined) + '</div><div class="k">来源</div><div class="v">' + ({ local: "本地账号", invite: "邮件邀请" })[m.source] + '</div><div class="k">最近活跃</div><div class="v">' + UI.esc(m.lastActive) + "</div></div>" +
      (can ? '<div class="form-grid mt-16"><div class="field"><label>系统角色</label><select class="select" id="mdRole">' + st().roles.map(function (r) { return '<option value="' + r.id + '"' + (r.id === m.roleId ? " selected" : "") + ">" + UI.esc(r.name) + " · " + App.scopeLabel(r.scope) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label>部门</label><select class="select" id="mdDept">' + st().departments.filter(function (d) { return d.parent !== null; }).map(function (d) { return '<option value="' + d.id + '"' + (d.id === m.deptId ? " selected" : "") + ">" + UI.esc(d.name) + "</option>"; }).join("") + "</select></div></div>" : "") +
      '<div class="eyebrow mt-20">项目成员授权</div><div class="stack mt-8">' +
      (m.projects || []).map(function (pid) {
        var p = st().projects.filter(function (x) { return x.id === pid; })[0];
        if (!p) return "";
        return '<div class="list-row"><span class="lr-main"><span class="lr-title">' + UI.esc(p.name) + '</span><span class="lr-sub mono">' + UI.esc(p.code) + " · 项目 ID " + UI.esc(p.id) + '</span></span><span class="badge b-info">' + UI.esc(App.projectRoleOf(m, pid)) + "</span></div>";
      }).join("") + "</div>" +
      '<div class="eyebrow mt-20">调整项目授权</div><div class="row wrap mt-8">' + st().projects.map(function (p) {
        var checked = m.projects.indexOf(p.id) > -1;
        return '<label class="chip' + (checked ? " on" : "") + '" style="cursor:pointer"><input type="checkbox" data-mproj="' + p.id + '"' + (checked ? " checked" : "") + (can ? "" : " disabled") + ' style="width:13px;height:13px;margin-right:2px">' + UI.esc(p.name) + "</label>";
      }).join("") + "</div>" +
      '<div class="notice info mt-16">' + UI.icon("lock", 15) + "<span>角色变更立即影响后续请求，但不会篡改历史审计；项目授权变更只影响该成员在对应项目内的资源访问。</span></div>";
    var footer = '<button class="btn" data-close>关闭</button>';
    if (can && role && role.id !== "r-owner") {
      footer = '<button class="btn" data-close>关闭</button><button class="btn btn-soft" id="mToggle">' + (m.status === "suspended" ? "恢复账号" : "停用账号") + '</button><button class="btn btn-danger" id="mRemove">移除</button><button class="btn btn-primary" id="mSave">保存变更</button>';
    } else if (can) {
      footer = '<button class="btn" data-close>关闭</button><span class="tiny muted" style="margin-right:auto">系统管理员不可在此降级</span>';
    }
    App.drawer({
      eyebrow: "Member profile", title: m.name, sub: m.role + " · " + m.dept, body: body, footer: footer,
      onMount: function (el, close) {
        var save = el.querySelector("#mSave");
        if (save) save.addEventListener("click", function () {
          var roleId = el.querySelector("#mdRole").value;
          var dept = deptById(el.querySelector("#mdDept").value);
          var roleChanged = roleId !== m.roleId;
          App.applyMemberRole(m.id, roleId);
          m.deptId = dept.id; m.dept = dept.name;
          var identity = st().identities.filter(function (x) { return x.id === m.id; })[0];
          if (identity) { identity.deptId = dept.id; identity.dept = dept.name; }
          m.projects = [];
          el.querySelectorAll("[data-mproj]").forEach(function (cb) { if (cb.checked) m.projects.push(cb.getAttribute("data-mproj")); });
          if (identity) identity.projectIds = m.projects.slice();
          if (roleChanged) App.logAudit("调整成员角色", m.name + " → " + m.role, "角色", "系统 RBAC 角色与管理范围同步更新", "normal", m.projects[0] || null);
          App.logAudit("更新成员授权", m.name, "成员", "更新部门与项目成员授权：" + m.projects.join("、"), "normal", m.projects[0] || null);
          if (App.currentUser.id === m.id) App.currentUser = identity || App.currentUser;
          close(); App.refresh(); App.toast("成员已更新", m.name + " → " + m.role + " · " + m.dept, "success");
        });
        var toggle = el.querySelector("#mToggle");
        if (toggle) toggle.addEventListener("click", function () {
          var suspend = m.status !== "suspended";
          App.confirm({ title: suspend ? "停用账号" : "恢复账号", message: suspend ? "停用 " + m.name + " 后，该账号无法登录，现有会话立即撤销，并失去全部项目访问。" : "恢复 " + m.name + " 的登录与已有项目授权？", danger: suspend, okText: suspend ? "确认停用" : "确认恢复" }).then(function (ok) {
            if (!ok) return;
            App.applyMemberStatus(m.id, suspend ? "suspended" : "active");
            App.logAudit(suspend ? "停用成员" : "恢复成员", m.name, "成员", suspend ? "账号已停用" : "账号已恢复", suspend ? "warning" : "normal", null);
            close(); App.refresh(); App.toast(suspend ? "账号已停用" : "账号已恢复", m.name, suspend ? "warn" : "success");
          });
        });
        var remove = el.querySelector("#mRemove");
        if (remove) remove.addEventListener("click", function () {
          if (m.id === App.currentUser.id) { App.toast("不能移除自己", "请先切换到其他管理员身份。", "danger"); return; }
          App.confirm({ title: "移除成员", message: "移除 " + m.name + " 后，该账号立即失去所有项目访问与内部数据权限。", detail: "审计记录、资产版本与历史交付物保留；账号不可恢复。", danger: true, okText: "确认移除" }).then(function (ok) {
            if (!ok) return;
            App.logAudit("移除成员", m.name, "成员", "成员与登录资格已移除", "critical", null);
            st().members = st().members.filter(function (x) { return x.id !== m.id; });
            st().identities = st().identities.filter(function (x) { return x.id !== m.id; });
            st().project.memberIds = st().project.memberIds.filter(function (x) { return x !== m.id; });
            close(); App.refresh(); App.toast("成员已移除", m.name, "warn");
          });
        });
      }
    });
  }

  /* ================= 角色与权限 ================= */
  function rolesPage() {
    var s = st();
    var selected = App.roleById(pageState.selectedRole) || s.roles[0];
    var ownerLocked = selected.id === "r-owner";
    var roleList = s.roles.map(function (r) {
      var n = roleMembers(r.id).length;
      return '<button class="role-card' + (r.id === selected.id ? " active" : "") + '" data-act="role" data-id="' + r.id + '"><span class="role-mark" style="background:' + (r.color === "red" ? "#e2553d" : r.color === "blue" ? "#3d6b9e" : r.color === "green" ? "#2f6f68" : "#b0853c") + '">' + UI.esc(r.name.charAt(0)) + '</span><span class="role-main"><b>' + UI.esc(r.name) + '</b><small>' + UI.esc(r.desc) + '</small><span class="row mt-4">' + scopeBadge(r.scope) + '<span class="tiny muted">' + n + " 人</span></span></span></button>";
    }).join("");
    var groups = s.permissionCatalog.map(function (g) {
      return '<div class="perm-group"><div class="perm-group-head"><div><b>' + UI.esc(g.label) + '</b><small>' + UI.esc(g.desc) + '</small></div><div class="row" style="gap:4px"><button class="btn btn-xs" data-act="perm-group" data-group="' + g.id + '" data-mode="all">全选</button><button class="btn btn-xs" data-act="perm-group" data-group="' + g.id + '" data-mode="none">清空</button></div></div>' +
        g.items.map(function (it) {
          var on = selected.perms.indexOf("*") > -1 || selected.perms.indexOf(it.key) > -1;
          return '<label class="perm-edit-row"><input type="checkbox" data-perm="' + it.key + '" data-group="' + g.id + '"' + (on ? " checked" : "") + (ownerLocked ? " disabled" : "") + '><span class="perm-edit-main"><b>' + UI.esc(it.label) + '</b><span class="mono tiny">' + UI.esc(it.key) + '</span></span><span class="perm-edit-desc">' + UI.esc(it.desc) + "</span>" + riskBadge(it.risk) + "</label>";
        }).join("") + "</div>";
    }).join("");
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "System · RBAC", title: "角色与权限", desc: "系统 RBAC 定义管理能力与管理范围；项目内容访问仍由项目成员授权二次校验。权限变更保存后立即影响后续请求。", actions: '<button class="btn btn-primary" data-act="new-role">' + UI.icon("plus") + '新建角色</button>' }) +
      '<div class="grid g4">' + UI.stat({ label: "角色", value: String(s.roles.length), unit: "个", delta: "1 个系统管理员角色" }) +
      UI.stat({ label: "权限项", value: String(s.permissionCatalog.reduce(function (n, g) { return n + g.items.length; }, 0)), unit: "项", delta: String(s.permissionCatalog.length) + " 个权限组" }) +
      UI.stat({ label: "项目负责人", value: String(roleMembers("r-manager").length), unit: "人", delta: "项目成员授权" }) +
      UI.stat({ label: "外部审片", value: String(roleMembers("r-guest").length), unit: "人", delta: "只读项目内容" }) + "</div>" +
      '<div class="notice info mt-16">' + UI.icon("lock", 15) + "<span>系统管理员和组织管理员也只管理平台，不自动读取项目资产。组织、部门与角色都不等于 SaaS tenant；每个项目资源请求都必须同时校验 project_id 与项目成员资格。</span></div>" +
      '<div class="perm-layout mt-16"><div class="role-list">' + roleList + "</div>" +
      '<div class="card"><div class="card-head"><div><h3>' + UI.esc(selected.name) + '</h3><div class="ch-sub">' + UI.esc(selected.desc) + '</div></div><div class="row">' + scopeBadge(selected.scope) + (selected.system ? '<span class="badge b-locked">系统角色</span>' : "") + "</div></div><div class=\"card-body\">" +
      (ownerLocked ? '<div class="notice warn">' + UI.icon("lock", 15) + "<span>系统管理员拥有全部权限，不能在此降级。其项目访问仍受项目成员授权约束。</span></div>" : "") +
      '<div class="between"><div><div class="eyebrow">数据范围</div><div class="tiny muted mt-4">决定该角色可查看的组织、成员与项目</div></div><select class="select" id="roleScope" style="width:150px"' + (ownerLocked ? " disabled" : "") + '>' + ["org", "dept", "project", "own"].map(function (x) { return '<option value="' + x + '"' + (selected.scope === x ? " selected" : "") + ">" + App.scopeLabel(x) + "</option>"; }).join("") + "</select></div>" +
      '<div class="perm-groups mt-16">' + groups + '</div><div class="row mt-16"><button class="btn btn-primary" data-act="save-role"' + (ownerLocked ? " disabled" : "") + ">保存角色策略</button><span class=\"tiny muted\">变更会同步给 " + roleMembers(selected.id).length + " 名成员</span></div></div></div></div></div>";
  }

  function saveRole() {
    var selected = App.roleById(pageState.selectedRole);
    if (!selected || selected.id === "r-owner") return;
    var scope = document.getElementById("roleScope").value;
    var perms = [];
    document.querySelectorAll("[data-perm]").forEach(function (cb) { if (cb.checked) perms.push(cb.getAttribute("data-perm")); });
    selected.scope = scope;
    selected.perms = perms;
    var affected = st().identities.filter(function (u) { return u.roleId === selected.id; });
    affected.forEach(function (u) { u.scope = scope; u.perms = perms.slice(); });
    if (App.currentUser.roleId === selected.id) App.currentUser = affected[0] || App.currentUser;
    App.logAudit("更新角色策略", selected.name + " · " + perms.length + " 项权限", "角色", "数据范围：" + App.scopeLabel(scope), "high", null);
    App.refresh(); App.toast("角色已保存", selected.name + " · " + perms.length + " 项权限 · " + App.scopeLabel(scope), "success");
  }

  function newRole() {
    var body = '<div class="form-grid"><div class="field"><label>角色名称<span class="req">*</span></label><input class="input" id="nrName" placeholder="例如：海外发行"><span class="err-msg" id="nrErr">请填写角色名称</span></div>' +
      '<div class="field"><label>数据范围</label><select class="select" id="nrScope"><option value="project">所属项目</option><option value="dept">本部门</option><option value="org">全组织</option><option value="own">仅本人</option></select></div>' +
      '<div class="field span2"><label>角色说明</label><textarea class="textarea" id="nrDesc" rows="2" placeholder="这个角色负责什么，不负责什么。"></textarea></div></div>';
    App.modal({
      title: "新建角色", sub: "新角色从空权限开始；项目内容访问仍由项目成员授权单独控制。", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="nrGo">创建角色</button>',
      onMount: function (el, close) {
        el.querySelector("#nrGo").addEventListener("click", function () {
          var name = el.querySelector("#nrName").value.trim();
          if (!name) { el.querySelector("#nrErr").classList.add("show"); return; }
          var role = { id: "r-" + Date.now(), name: name, short: name.slice(0, 4), desc: el.querySelector("#nrDesc").value.trim() || "自定义角色", scope: el.querySelector("#nrScope").value, color: "blue", system: false, perms: [] };
          st().roles.push(role);
          pageState.selectedRole = role.id;
          App.logAudit("新建角色", name, "角色", "创建自定义角色，初始无权限", "normal", null);
          close(); App.refresh(); App.toast("角色已创建", name + "，请配置权限。", "success");
        });
      }
    });
  }

  /* ================= 安全与访问 ================= */
  function securityPage() {
    var s = st(), sec = s.security;
    var checks = s.securityChecks.map(function (c) {
      return '<div class="sec-check-row"><span class="sec-check-main"><b>' + UI.esc(c.label) + '</b><small>' + UI.esc(c.detail) + '</small></span><span class="sec-check-score">' + c.score + "</span>" + UI.statusBadge(c.status) + "</div>";
    }).join("");
    var policy = sec.dataPolicy;
    var policyChips = policy.sensitiveClasses.map(function (x) { return '<span class="chip">' + UI.esc(x) + "</span>"; }).join("");
    var mimeChips = sec.upload.allowedMime.map(function (x) { return '<span class="chip mono">' + UI.esc(x) + "</span>"; }).join("");
    var avgScore = Math.round(s.securityChecks.reduce(function (n, c) { return n + c.score; }, 0) / s.securityChecks.length);
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "System · Security & access", title: "安全与访问", desc: "项目访问复核、Provider 凭据、数据外发、上传与媒体处理、部署安全。高风险变更全部进入不可变审计。", actions: '<button class="btn" data-act="security-report">' + UI.icon("download") + '下载安全基线</button><a class="btn" href="' + App.link("system/audit") + '">审计日志</a>' }) +
      '<div class="grid g4">' + UI.stat({ label: "安全基线", value: String(avgScore), unit: "分", delta: "7 项控制检查" }) +
      UI.stat({ label: "项目访问复核", value: sec.access.projectMembership ? "开启" : "关闭", delta: "跨项目默认拒绝" }) +
      UI.stat({ label: "数据外发", value: policy.defaultAction === "deny" ? "默认拒绝" : "允许", delta: "仅 Mork · 中国大陆" }) +
      UI.stat({ label: "审计保留", value: String(s.workspace.dataRetention), unit: "天", delta: "append-only" }) + "</div>" +
      '<div class="grid g-2-1 mt-16"><div class="stack">' +
      UI.card({ title: "安全态势", sub: "按项目访问、凭据、外发、会话、上传、审计与媒体处理检查", head: '<span class="ring" style="--p:' + avgScore + ';--size:52px"><span>' + avgScore + "</span></span>", body: checks }) +
      UI.card({ title: "数据外发策略", sub: "外部模型调用前的强制检查，不存在静默允许", head: UI.badge(policy.defaultAction === "deny" ? "DENY BY DEFAULT" : "ALLOW", policy.defaultAction === "deny" ? "b-teal" : "b-danger"), body:
        '<div class="kv"><div class="k">允许 Provider</div><div class="v">' + policy.allowedProviders.map(function (id) { return UI.esc(id.toUpperCase()); }).join("、") + '</div>' +
        '<div class="k">允许区域</div><div class="v">' + policy.allowedRegions.join("、") + '</div>' +
        '<div class="k">合同与条款</div><div class="v">' + UI.esc(policy.contractReview) + " " + UI.badge("已审查", "b-done") + '</div>' +
        '<div class="k">敏感数据外发</div><div class="v">' + (policy.allowSensitive ? "允许" : "禁止") + '</div>' +
        '<div class="k">请求体日志</div><div class="v">' + (policy.logPayload ? "记录" : "不记录 · 仅元数据") + '</div>' +
        '<div class="k">外部存储</div><div class="v">' + (policy.externalStorage ? "允许" : "禁止") + '</div></div>' +
        '<div class="eyebrow mt-16">默认禁止外发的数据类别</div><div class="row wrap mt-8">' + policyChips + '</div>' +
        '<div class="notice warn mt-12">' + UI.icon("lock", 15) + "<span>剧本原文、未公开角色设定与未发布成片默认不发送到外部 Provider；命中策略时任务在创建前失败，不产生计费。</span></div>" +
        '<div class="row mt-12"><button class="btn btn-sm" data-act="run-outbound-check">运行外发自检</button><a class="btn btn-sm btn-ghost" href="' + App.link("system/providers") + '">查看 Provider</a></div>' }) +
      UI.card({ title: "上传与媒体处理", sub: "所有上传与 FFmpeg 调用的安全基线", body:
        '<div class="kv"><div class="k">允许 MIME</div><div class="v">' + mimeChips + '</div><div class="k">单文件上限</div><div class="v">' + UI.esc(sec.upload.maxFile) + '</div>' +
        '<div class="k">文件签名</div><div class="v">' + (sec.upload.magicCheck ? "校验 magic bytes" : "未校验") + '</div><div class="k">完整性</div><div class="v">' + UI.esc(sec.upload.checksum) + '</div>' +
        '<div class="k">恶意文件</div><div class="v">' + UI.esc(sec.upload.antivirus) + '</div><div class="k">FFmpeg</div><div class="v">' + UI.esc(sec.media.ffmpeg) + " · " + (sec.media.resourceLimit ? "资源受限" : "未限制") + '</div>' +
        '<div class="k">临时文件</div><div class="v">' + UI.esc(sec.media.tempDir) + '</div><div class="k">成片校验</div><div class="v">' + UI.esc(sec.media.probe) + '</div></div>' }) +
      "</div><div class=\"stack\">" +
      UI.card({ title: "会话与访问控制", sub: "账号停用、角色变更与项目授权立即影响后续请求", body:
        '<div class="form-grid"><div class="field"><label>空闲超时（分钟）</label><input class="input" id="sessIdle" type="number" value="' + sec.session.idle + '"></div>' +
        '<div class="field"><label>最长会话（小时）</label><input class="input" id="sessMax" type="number" value="' + sec.session.max + '"></div>' +
        '<div class="field"><label>刷新周期（天）</label><input class="input" id="sessRefresh" type="number" value="' + sec.session.refresh + '"></div></div>' +
        '<div class="setting-toggle-row"><div><b>停用即撤销会话</b><div class="tiny muted">离职、停用与角色移除同步失效</div></div>' + (sec.session.revokeOnSuspend ? UI.badge("开启", "b-done") : UI.badge("关闭", "b-danger")) + "</div>" +
        '<div class="setting-toggle-row"><div><b>项目访问双层校验</b><div class="tiny muted">每个项目请求校验 project_id 与成员关系</div></div>' + (sec.access.projectMembership ? UI.badge("开启", "b-done") : UI.badge("关闭", "b-danger")) + "</div>" +
        '<div class="setting-toggle-row"><div><b>跨项目搜索 / 引用</b><div class="tiny muted">资产只在所属项目内共享</div></div>' + (!sec.access.crossProject ? UI.badge("禁止", "b-done") : UI.badge("允许", "b-danger")) + "</div>" +
        '<div class="row mt-12"><button class="btn btn-sm" data-act="save-session">保存会话策略</button><span class="tiny muted">上次复核 ' + UI.esc(sec.access.lastReview) + "</span></div>" }) +
      UI.card({ title: "Provider 凭据", sub: "应用层加密，材料独立注入，界面只显示引用掩码", body:
        '<div class="kv"><div class="k">加密算法</div><div class="v mono">' + UI.esc(sec.credentials.algorithm) + '</div><div class="k">存储方式</div><div class="v mono">' + UI.esc(sec.credentials.storage) + '</div>' +
        '<div class="k">界面展示</div><div class="v">' + (sec.credentials.masked ? "仅掩码" : "明文") + '</div><div class="k">轮换周期</div><div class="v">' + sec.credentials.rotationDays + ' 天</div>' +
        '<div class="k">最近轮换</div><div class="v">' + UI.esc(sec.credentials.lastRotation) + '</div><div class="k">注入来源</div><div class="v">' + UI.esc(sec.credentials.injectedBy) + '</div></div>' +
        '<div class="notice info mt-12">' + UI.icon("lock", 15) + "<span>数据库不保存明文密钥；secret_ref 只供 API 进程读取，导出与审计日志不包含凭据材料。</span></div>" }) +
      UI.card({ title: "部署安全", sub: "私有化容器与日志边界", body:
        '<div class="kv"><div class="k">容器用户</div><div class="v">' + UI.esc(s.workspace.runtime.containerUser) + '</div><div class="k">存储</div><div class="v">' + UI.esc(s.workspace.runtime.storage) + '</div>' +
        '<div class="k">配置注入</div><div class="v">部署环境变量 / Secret Manager</div><div class="k">日志脱敏</div><div class="v">token、密钥、台词正文不落日志</div>' +
        '<div class="k">备份</div><div class="v">' + UI.esc(s.workspace.backup.last) + ' · ' + UI.esc(s.workspace.backup.lastSize) + '</div></div>' +
        '<div class="row mt-12"><a class="btn btn-sm" href="' + App.link("system/workspace") + '">系统设置</a><button class="btn btn-sm btn-ghost" data-act="security-report">导出基线</button></div>' }) +
      "</div></div></div>";
  }

  /* ================= 审计日志 ================= */
  function auditRows() {
    var q = pageState.auditQuery.toLowerCase();
    return st().audit.filter(function (a) {
      if (!App.inScope(a.deptId, a.projectId)) return false;
      if (pageState.auditCategory !== "all" && a.category !== pageState.auditCategory) return false;
      if (pageState.auditSeverity !== "all" && a.severity !== pageState.auditSeverity) return false;
      if (!q) return true;
      return (a.actor + " " + a.action + " " + a.target + " " + a.detail + " " + a.ip).toLowerCase().indexOf(q) > -1;
    });
  }

  function auditPage() {
    var s = st();
    var list = auditRows();
    var scoped = s.audit.filter(function (a) { return App.inScope(a.deptId, a.projectId); });
    var critical = scoped.filter(function (a) { return a.severity === "critical"; }).length;
    var roleChanges = scoped.filter(function (a) { return a.category === "角色"; }).length;
    var cats = ["all", "成员", "组织", "角色", "项目", "安全", "Provider", "用量", "系统", "剧本", "资产", "导出", "审计", "审核"];
    var rows = list.map(function (a) {
      return '<tr><td class="mono tiny">' + UI.esc(a.time) + '</td><td><b>' + UI.esc(a.actor) + '</b><span class="t-sub mono">' + UI.esc(a.ip) + '</span></td><td><b>' + UI.esc(a.action) + '</b><span class="t-sub">' + UI.esc(a.target) + '</span></td><td>' + UI.badge(a.category, "b-outline") + '</td><td>' + resultBadge(a.result) + '</td><td>' + riskBadge(a.severity === "critical" ? "high" : a.severity === "warning" ? "medium" : "low") + '</td><td><button class="btn btn-xs" data-act="audit-detail" data-id="' + a.id + '">详情</button></td></tr>';
    }).join("");
    var filterHtml = '<form class="member-toolbar" data-form="audit-search"><label class="filter-search">' + UI.icon("search", 14) + '<input class="input" id="aQuery" value="' + UI.esc(pageState.auditQuery) + '" placeholder="搜索操作人、动作、目标或 IP"></label>' +
      '<select class="select" id="aSeverity" style="width:130px"><option value="all">全部级别</option><option value="normal"' + (pageState.auditSeverity === "normal" ? " selected" : "") + '>常规</option><option value="warning"' + (pageState.auditSeverity === "warning" ? " selected" : "") + '>警告</option><option value="critical"' + (pageState.auditSeverity === "critical" ? " selected" : "") + '>高风险</option></select><button class="btn btn-sm" type="submit">筛选</button></form>' +
      '<div class="row wrap mt-8">' + cats.map(function (c) { return '<button class="chip' + (pageState.auditCategory === c ? " on" : "") + '" data-act="afilter" data-key="' + c + '">' + (c === "all" ? "全部" : c) + "</button>"; }).join("") + "</div>";
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "System · Audit", title: "审计日志", desc: "不可变审计覆盖登录、权限、成员、项目授权、Provider、用量、系统设置与导出。字段包含 actor / action / resource / time / request_id。", actions: '<button class="btn" data-act="export-audit">' + UI.icon("download") + '导出 CSV</button><button class="btn" data-act="audit-config">保留策略</button>' }) +
      '<div class="grid g4">' + UI.stat({ label: "可见事件", value: String(scoped.length), unit: "条", delta: "全部审计 " + s.audit.length + " 条" }) +
      UI.stat({ label: "高风险", value: String(critical), unit: "条", delta: "凭据、停用与阻断" }) +
      UI.stat({ label: "权限变更", value: String(roleChanges), unit: "条", delta: "角色、项目授权" }) +
      UI.stat({ label: "保留周期", value: String(s.workspace.dataRetention), unit: "天", delta: "到期归档 · 不可修改" }) + "</div>" +
      '<div class="card mt-16"><div class="card-head"><div><h3>审计事件</h3><div class="ch-sub">按时间倒序 · 当前范围：' + App.scopeLabel(App.currentUser.scope) + ' · 项目事件仅在项目成员授权范围内可见</div></div><span class="tag">' + list.length + ' 条</span></div><div class="card-body">' + filterHtml +
      (rows ? '<div class="table-wrap mt-12"><table class="audit-table"><thead><tr><th>时间</th><th>操作人 / IP</th><th>动作 / 目标</th><th>分类</th><th>结果</th><th>级别</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>" : UI.empty("没有匹配审计事件", "调整关键词、分类或级别。")) + "</div></div></div>";
  }

  function auditDrawer(id) {
    var a = st().audit.filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    var body = '<div class="account-head">' + UI.avatar(a.actor, "lg") + '<div><div class="account-name">' + UI.esc(a.action) + '</div><div class="small muted">' + UI.esc(a.actor) + " · " + UI.esc(a.time) + '</div></div></div>' +
      '<div class="kv"><div class="k">事件 ID</div><div class="v mono">' + UI.esc(a.id) + '</div><div class="k">request_id</div><div class="v mono">' + UI.esc(a.requestId) + '</div><div class="k">资源</div><div class="v mono">' + UI.esc(a.resource) + '</div><div class="k">分类</div><div class="v">' + UI.esc(a.category) + '</div><div class="k">目标</div><div class="v">' + UI.esc(a.target) + '</div><div class="k">结果</div><div class="v">' + resultBadge(a.result) + '</div><div class="k">级别</div><div class="v">' + riskBadge(a.severity === "critical" ? "high" : a.severity === "warning" ? "medium" : "low") + '</div><div class="k">来源 IP</div><div class="v mono">' + UI.esc(a.ip) + '</div><div class="k">部门</div><div class="v">' + UI.esc(deptById(a.deptId) ? deptById(a.deptId).name : "—") + '</div><div class="k">项目</div><div class="v">' + UI.esc(a.projectId ? projectName(a.projectId) : "系统级") + '</div></div><div class="notice info mt-16"><b>事件详情</b><br>' + UI.esc(a.detail) + "</div>";
    App.drawer({ eyebrow: "Audit event", title: a.action, sub: a.id + " · " + a.time, body: body, footer: '<button class="btn" data-close>关闭</button>' });
  }

  function exportAudit() {
    var rows = auditRows();
    var csv = "\uFEFF时间,操作人,动作,目标,分类,结果,级别,IP,资源,request_id,详情\n" + rows.map(function (a) {
      return [a.time, a.actor, a.action, a.target, a.category, a.result, a.severity, a.ip, a.resource, a.requestId, a.detail].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\n");
    App.download("changye_audit_" + Date.now() + ".csv", csv, "text/csv;charset=utf-8");
    App.toast("审计已导出", rows.length + " 条事件 · CSV", "success");
  }

  /* ================= Provider 与模型 ================= */
  function providersPage() {
    var s = st();
    var cards = s.providers.map(function (p) {
      var status = p.enabled ? UI.statusBadge("connected") : (p.id === "mock" ? UI.badge("受限", "b-warn") : UI.statusBadge("unconfigured"));
      var caps = p.capabilities.map(function (c) { return '<span class="chip">' + UI.esc(c) + '</span>'; }).join("");
      return '<div class="int-card"><div class="int-top"><span class="int-logo ' + UI.esc(p.color) + '">' + UI.esc(p.initial) + '</span><span class="int-status">' + status + '</div>' +
        '<div class="int-name">' + UI.esc(p.name) + '</div><div class="int-desc">' + UI.esc(p.desc) + '</div>' +
        '<div class="int-meta mono tiny">' + UI.esc(p.baseUrl) + '</div>' +
        '<div class="kv mt-12" style="grid-template-columns:70px 1fr"><div class="k">凭据</div><div class="v mono tiny">' + UI.esc(p.secretRef) + '</div>' +
        '<div class="k">掩码</div><div class="v mono tiny">' + UI.esc(p.secretMasked) + '</div>' +
        '<div class="k">超时</div><div class="v">' + p.timeout + ' 秒</div><div class="k">限流</div><div class="v">' + UI.esc(p.rateLimit) + '</div>' +
        '<div class="k">区域</div><div class="v">' + UI.esc(p.region) + '</div><div class="k">合同</div><div class="v tiny">' + UI.esc(p.contract) + '</div></div>' +
        '<div class="row wrap mt-12">' + caps + '</div>' +
        '<div class="between mt-12"><span class="tiny muted">' + (p.lastCheck === '—' ? '未校验' : '校验 ' + UI.esc(p.lastCheck)) + '</span><div class="row" style="gap:4px">' +
        '<button class="btn btn-xs" data-act="test-provider" data-id="' + p.id + '">测试</button>' +
        (App.hasPerm('provider:manage') ? '<button class="btn btn-xs" data-act="toggle-provider" data-id="' + p.id + '">' + (p.enabled ? '停用' : '启用') + '</button><button class="btn btn-xs" data-act="rotate-secret" data-id="' + p.id + '">轮换凭据</button><button class="btn btn-xs" data-act="config-provider" data-id="' + p.id + '">配置</button>' : '') + '</div></div></div>';
    }).join("");
    var modelRows = s.models.map(function (m, i) {
      var isInternal = m.providerId === 'internal';
      return '<tr><td><b class="mono">' + UI.esc(m.modelId) + '</b><span class="t-sub">' + UI.esc(m.version) + '</span></td><td>' + UI.esc(m.provider) + '</td><td><span class="chip">' + UI.esc(m.cap) + '</span></td><td class="mono tiny">' + UI.esc((m.capabilities || []).join(' / ')) + '</td><td>' + m.timeout + 's</td><td class="mono tiny">P' + m.priority + '</td><td class="tiny">' + UI.esc(m.cost) + '</td><td>' + UI.statusBadge(m.enabled ? 'connected' : 'unconfigured', m.enabled ? '已启用' : '已停用') + '</td><td class="cell-actions"><button class="btn btn-xs" data-act="toggle-model" data-i="' + i + '">' + (m.enabled ? '停用' : '启用') + '</button>' + (isInternal ? '' : '<button class="btn btn-xs" data-act="config-model" data-i="' + i + '">配置</button>') + '</td></tr>';
    }).join("");
    var routes = s.providerRoutes.map(function (r) {
      return '<div class="list-row"><span class="lr-main"><span class="lr-title">' + UI.esc(r.cap) + ' · ' + UI.esc(r.label) + '</span><span class="lr-sub mono">' + UI.esc(r.defaultId) + '</span></span><span class="badge b-teal">默认路由</span><span class="tiny muted">不可用则任务失败</span></div>';
    }).join("");
    return '<div class="page">' +
      UI.pageHead({ eyebrow: 'System · Providers & models', title: 'Provider 与模型', desc: '私有化部署的外部模型适配层：凭据、能力、模型与路由。默认生产适配器为 Mork；Mock 仅用于 CI 与显式演示。', actions: (App.hasPerm('provider:manage') ? '<button class="btn" data-act="test-providers">' + UI.icon('refresh') + '校验全部</button><button class="btn btn-primary" data-act="add-provider">' + UI.icon('plus') + '新增 Provider</button>' : '') }) +
      '<div class="grid g4">' + UI.stat({ label: '生产 Provider', value: String(s.providers.filter(function (p) { return p.enabled && p.id !== 'mock'; }).length), unit: '个', delta: 'Mork Adapter' }) +
      UI.stat({ label: '注册模型', value: String(s.models.filter(function (m) { return m.enabled; }).length), unit: '个', delta: '6 个外部能力 · 1 个内部规则' }) +
      UI.stat({ label: '能力路由', value: String(s.providerRoutes.length), unit: '条', delta: '无静默降级' }) +
      UI.stat({ label: 'Mock', value: '禁用', delta: '仅 CI / 显式演示' }) + '</div>' +
      '<div class="notice warn mt-16">' + UI.icon('lock', 15) + '<span>未配置 Provider 时任务创建直接返回 <b class="mono">PROVIDER_NOT_CONFIGURED</b>，不会静默回退到 Mock；凭据只以 secret_ref 掩码展示，不进入前端与审计日志。</span></div>' +
      '<div class="grid g2 mt-16">' + cards + '</div>' +
      '<div class="card mt-16"><div class="card-head"><div><h3>模型能力注册</h3><div class="ch-sub">provider_key · model_id · capabilities · timeout · rate_limit</div></div><span class="tag">' + s.models.length + ' 个模型</span></div><div class="card-body tight"><div class="table-wrap"><table><thead><tr><th>model_id</th><th>Provider</th><th>能力</th><th>capabilities</th><th>超时</th><th>优先级</th><th>计价</th><th>状态</th><th></th></tr></thead><tbody>' + modelRows + '</tbody></table></div></div></div>' +
      '<div class="grid g2 mt-16"><div class="card"><div class="card-head"><div><h3>能力路由</h3><div class="ch-sub">每类能力绑定默认模型，不做多供应商自动降级</div></div></div><div class="card-body">' + routes + '</div></div>' +
      '<div class="card"><div class="card-head"><div><h3>Mock 边界</h3><div class="ch-sub">测试替身，不是生产兜底</div></div></div><div class="card-body"><div class="scope-rule"><span class="badge b-info">CI</span><p>自动化测试可显式启用 Mock，生成结果标记 mock_artifact。</p></div><div class="scope-rule"><span class="badge b-warn">演示</span><p>演示环境需显式开关；生产环境拒绝静默回退。</p></div><div class="scope-rule"><span class="badge b-danger">不可用</span><p>Provider 未配置、超时或限流时任务失败并保留 Attempt，等待重试。</p></div></div></div></div></div>';
  }

  function configProvider(id) {
    var p = st().providers.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var caps = ['文本', '图像', '视频', '语音合成', '语音识别', '音乐'];
    var body = '<div class="form-grid"><div class="field"><label>provider_key</label><input class="input" id="cpKey" value="' + UI.esc(p.key) + '"></div>' +
      '<div class="field"><label>base_url</label><input class="input" id="cpBase" value="' + UI.esc(p.baseUrl) + '"></div>' +
      '<div class="field"><label>secret_ref</label><input class="input mono" id="cpSecret" value="' + UI.esc(p.secretRef) + '" placeholder="secret://provider/..."></div>' +
      '<div class="field"><label>model_id（默认）</label><input class="input mono" id="cpModel" value="' + UI.esc(p.id === 'mork' ? 'mork-video-2' : 'mock-video') + '"></div>' +
      '<div class="field"><label>timeout（秒）</label><input class="input" id="cpTimeout" type="number" value="' + p.timeout + '"></div>' +
      '<div class="field"><label>rate_limit</label><input class="input" id="cpRate" value="' + UI.esc(p.rateLimit) + '"></div>' +
      '<div class="field span2"><label>capabilities</label><div class="row wrap">' + caps.map(function (c) { return '<label class="checkline"><input type="checkbox" data-cpcap value="' + c + '"' + (p.capabilities.indexOf(c) > -1 ? ' checked' : '') + '> ' + c + '</label>'; }).join('') + '</div></div>' +
      '<div class="field span2"><label class="checkline"><input type="checkbox" id="cpEnabled"' + (p.enabled ? ' checked' : '') + '> 启用该 Provider（生产任务可路由）</label></div></div>' +
      '<div class="notice info mt-12">' + UI.icon('lock', 15) + '<span>原型不保存密钥，也不发起真实外部请求；secret_ref 仅表示部署环境中的引用。</span></div>';
    App.modal({
      title: '配置 ' + p.name, sub: p.kind + ' · ' + p.baseUrl, body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="cpGo">保存配置</button>',
      onMount: function (el, close) {
        el.querySelector('#cpGo').addEventListener('click', function () {
          var base = el.querySelector('#cpBase').value.trim();
          if (!/^https?:\/\//.test(base) && p.id !== 'mock') { App.toast('base_url 无效', '必须为 http(s) 地址。', 'danger'); return; }
          var selected = [];
          el.querySelectorAll('[data-cpcap]').forEach(function (cb) { if (cb.checked) selected.push(cb.value); });
          if (!selected.length) { App.toast('缺少能力', '至少选择一个 capability。', 'danger'); return; }
          p.key = el.querySelector('#cpKey').value.trim();
          p.baseUrl = base;
          p.secretRef = el.querySelector('#cpSecret').value.trim();
          p.timeout = Number(el.querySelector('#cpTimeout').value) || 120;
          p.rateLimit = el.querySelector('#cpRate').value.trim();
          p.capabilities = selected;
          p.enabled = el.querySelector('#cpEnabled').checked;
          p.configured = p.secretRef !== '—';
          p.lastCheck = '今天 ' + App.nowStamp();
          p.health = p.enabled ? 'healthy' : 'restricted';
          App.logAudit('保存 Provider 配置', p.name, 'Provider', p.baseUrl + ' · ' + selected.join('、') + ' · ' + (p.enabled ? '启用' : '停用'), 'high', null);
          close(); App.refresh(); App.toast('Provider 配置已保存', p.name + ' · ' + selected.length + ' 项能力', 'success');
        });
      }
    });
  }

  function addProvider() {
    var body = '<div class="form-grid"><div class="field"><label>provider_key<span class="req">*</span></label><input class="input" id="npKey" placeholder="例如：mork-backup"></div>' +
      '<div class="field"><label>显示名称<span class="req">*</span></label><input class="input" id="npName" placeholder="例如：Mork 备用适配器"></div>' +
      '<div class="field span2"><label>base_url</label><input class="input" id="npBase" placeholder="https://provider.internal/v1"></div>' +
      '<div class="field"><label>secret_ref</label><input class="input mono" id="npSecret" placeholder="secret://provider/backup"></div>' +
      '<div class="field"><label>timeout / rate_limit</label><div class="row"><input class="input" id="npTimeout" type="number" value="300" style="width:90px"><input class="input" id="npRate" value="60 req/min"></div></div></div>' +
      '<div class="notice warn mt-12">新增 Provider 默认未启用。保存后必须先校验连接，再在能力路由中绑定模型。</div>';
    App.modal({
      title: '新增 Provider', sub: '企业私有化部署的外部模型适配器', body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="npGo">创建</button>',
      onMount: function (el, close) {
        el.querySelector('#npGo').addEventListener('click', function () {
          var key = el.querySelector('#npKey').value.trim(), name = el.querySelector('#npName').value.trim();
          if (!key || !name) { App.toast('信息不完整', 'provider_key 与显示名称必填。', 'danger'); return; }
          st().providers.push({ id: key, key: key, name: name, kind: '自建配置', desc: '待校验的外部模型适配器。', baseUrl: el.querySelector('#npBase').value.trim() || 'https://provider.internal/v1', secretRef: el.querySelector('#npSecret').value.trim() || '—', secretMasked: '待配置', secretStatus: '待注入', secretUpdated: '—', timeout: Number(el.querySelector('#npTimeout').value) || 300, rateLimit: el.querySelector('#npRate').value.trim() || '60 req/min', enabled: false, configured: false, health: 'unconfigured', lastCheck: '—', capabilities: ['文本'], models: 0, contract: '待合同审查', region: '中国大陆', initial: name.charAt(0), color: 'blue' });
          App.logAudit('新增 Provider', name, 'Provider', 'provider_key=' + key + '，等待凭据与能力校验', 'high', null);
          close(); App.refresh(); App.toast('Provider 已创建', name + ' · 待校验', 'success');
        });
      }
    });
  }

  function toggleProvider(id) {
    var p = st().providers.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (p.id === 'mock' && !p.enabled) { App.toast('Mock 不可在生产启用', 'Mock 只能在 CI 或显式演示环境启用。', 'danger'); return; }
    App.confirm({ title: (p.enabled ? '停用' : '启用') + ' Provider', message: p.name + (p.enabled ? ' 停用后，绑定该 Provider 的任务会返回 PROVIDER_NOT_CONFIGURED，不会回退 Mock。' : ' 启用前请确认凭据、合同与 data policy 均已通过。'), danger: p.enabled, okText: '确认' + (p.enabled ? '停用' : '启用') }).then(function (ok) {
      if (!ok) return;
      p.enabled = !p.enabled;
      p.health = p.enabled ? 'healthy' : 'restricted';
      App.logAudit((p.enabled ? '启用' : '停用') + ' Provider', p.name, 'Provider', '生产路由状态更新', 'high', null);
      App.refresh(); App.toast('Provider 状态已更新', p.name + ' · ' + (p.enabled ? '启用' : '停用'), 'success');
    });
  }

  function testProvider(id) {
    var p = st().providers.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (!p.configured || p.secretRef === '—') {
      App.logAudit('Provider 校验失败', p.name, 'Provider', 'PROVIDER_NOT_CONFIGURED', 'warning', null);
      App.toast('PROVIDER_NOT_CONFIGURED', '缺少 base_url / secret_ref，任务不会回退 Mock。', 'danger'); return;
    }
    p.lastCheck = '今天 ' + App.nowStamp(); p.health = p.enabled ? 'healthy' : 'restricted';
    App.logAudit('校验 Provider', p.name + ' · ' + p.models + ' 个模型', 'Provider', '连接与能力检查通过', 'normal', null);
    App.refresh(); App.toast('Provider 可用', p.name + ' · ' + (p.enabled ? '生产启用' : '仅测试'), 'success');
  }

  function rotateSecret(id) {
    var p = st().providers.filter(function (x) { return x.id === id; })[0];
    if (!p || p.secretRef === '—') return;
    App.confirm({ title: '轮换 Provider 凭据', message: '轮换 ' + p.name + ' 的 secret_ref 后，旧凭据立即失效；正在运行的任务使用已注入的旧连接完成或失败。', detail: '新凭据由部署环境注入，界面只保留掩码引用。', danger: false, okText: '确认轮换' }).then(function (ok) {
      if (!ok) return;
      p.secretUpdated = '今天 ' + App.nowStamp();
      p.lastCheck = p.secretUpdated;
      p.secretMasked = p.id + '_live_••••' + Math.random().toString(16).slice(2, 6);
      App.logAudit('轮换 Provider 凭据', p.name + ' · ' + p.secretRef, 'Provider', '旧凭据失效，新凭据由部署环境注入', 'high', null);
      App.refresh(); App.toast('凭据已轮换', p.name + ' · 旧凭据已失效', 'success');
    });
  }

  function testModel(i) {
    var m = st().models[i]; if (!m) return;
    if (!m.enabled) { App.toast('模型已停用', m.name + ' 当前不可路由。', 'danger'); return; }
    App.toast('模型校验通过', m.name + ' · ' + m.latency, 'success');
  }

  function toggleModel(i) {
    var m = st().models[i]; if (!m) return;
    if (m.providerId === 'internal') { App.toast('内部规则不可停用', '质量门禁规则由系统内置维护。', 'warning'); return; }
    m.enabled = !m.enabled;
    m.status = m.enabled ? '已连接' : '已停用';
    App.logAudit((m.enabled ? '启用' : '停用') + '模型', m.modelId, 'Provider', m.cap + ' · ' + (m.enabled ? '可路由' : '停止路由'), 'high', null);
    App.refresh(); App.toast('模型状态已更新', m.modelId + ' · ' + (m.enabled ? '启用' : '停用'), 'success');
  }

  /* ================= 用量与预算 ================= */
  function usagePage() {
    var s = st(), u = s.orgUsage;
    var pct = Math.round(u.spent / u.budget * 100);
    var projectRows = u.byProject.map(function (p) {
      var used = Math.round(p.estimated / p.budget * 100);
      return '<tr><td><b>' + UI.esc(p.name) + '</b><span class="t-sub mono">' + UI.esc(p.id) + '</span></td><td>' + p.episodes + ' 集</td><td>' + p.shots + ' 镜</td><td class="mono tiny">' + UI.esc(p.tokens) + '</td><td>' + App.formatMoney(p.vendorBilled) + '</td><td>' + App.formatMoney(p.estimated) + '</td><td>' + App.formatMoney(p.budget) + '</td><td><div class="row" style="gap:8px"><div class="progress thin" style="width:70px"><i style="width:' + used + '%"></i></div><span class="tiny">' + used + '%</span></div></td><td>' + (p.status === 'warning' ? UI.badge('接近阈值', 'b-warn') : UI.badge('正常', 'b-done')) + '</td></tr>';
    }).join('');
    var modelRows = u.byModel.map(function (m) {
      return '<tr><td><b class="mono">' + UI.esc(m.model) + '</b><span class="t-sub">' + UI.esc(m.provider) + '</span></td><td><span class="chip">' + UI.esc(m.cap) + '</span></td><td>' + m.calls + '</td><td>' + UI.esc(m.units) + '</td><td>' + App.formatMoney(m.estimated) + '</td><td><div class="row" style="gap:8px"><div class="progress thin" style="width:70px"><i style="width:' + m.share + '%"></i></div><span class="tiny">' + m.share + '%</span></div></td></tr>';
    }).join('');
    var deptRows = u.byDept.map(function (d) { return '<div class="role-dist-row"><span class="rd-name">' + UI.esc(d.name) + '</span><div class="progress thin"><i style="width:' + d.share + '%"></i></div><span class="mono tiny">' + App.formatMoney(d.estimated) + '</span></div>'; }).join('');
    var userRows = u.byUser.map(function (x) { return '<div class="list-row"><span class="lr-main"><span class="lr-title">' + UI.esc(x.name) + '</span><span class="lr-sub">' + UI.esc(x.role) + '</span></span><span class="mono tiny">' + App.formatMoney(x.estimated) + '</span></div>'; }).join('');
    var alerts = u.alerts.map(function (a) { return '<div class="scope-rule"><span class="badge ' + (a.level === 'warning' ? 'b-warn' : 'b-info') + '">' + (a.level === 'warning' ? '预警' : '信息') + '</span><p>' + UI.esc(a.text) + '<span class="tiny muted"> · ' + UI.esc(a.at) + '</span></p></div>'; }).join('');
    return '<div class="page">' +
      UI.pageHead({ eyebrow: 'System · Usage & budget', title: '用量与预算', desc: '按用户、部门、项目、剧集、镜头、Provider 和模型核算 token、时长与金额。任务创建前检查预算，超限不静默放行。', actions: (App.hasPerm('usage:manage') ? '<button class="btn" data-act="edit-budget">' + UI.icon('plus') + '调整预算</button>' : '') + '<button class="btn" data-act="export-usage">' + UI.icon('download') + '导出用量</button>' }) +
      '<div class="grid g4">' + UI.stat({ label: '本月已用', value: App.formatMoney(u.spent), delta: u.period }) +
      UI.stat({ label: '组织预算', value: App.formatMoney(u.budget), delta: '阈值 ' + u.threshold + '% · 超限阻断' }) +
      UI.stat({ label: '预计月末', value: App.formatMoney(u.estimatedMonth), delta: Math.round(u.estimatedMonth / u.budget * 100) + '% 的预算' }) +
      UI.stat({ label: '项目数', value: String(u.byProject.length), unit: '个', delta: '按项目独立预算' }) + '</div>' +
      '<div class="grid g-2-1 mt-16">' +
      UI.card({ title: '预算执行', sub: u.period + ' · 最后更新 ' + UI.esc(u.lastUpdated), head: UI.badge(pct + '%', pct >= u.threshold ? 'b-warn' : 'b-teal'), body: '<div class="plan-mini"><div class="plan-price">' + App.formatMoney(u.spent) + '<small> / ' + App.formatMoney(u.budget) + '</small></div><div class="tiny muted">供应商账单与平台估算分列，报表标注口径。</div></div>' + '<div class="between mt-12"><span class="tiny muted">已用</span><span class="mono tiny">' + pct + '%</span></div>' + UI.progress(pct) + '<div class="row mt-12"><span class="tiny muted">达到 ' + u.threshold + '% 通知系统管理员与项目负责人；达到 100% 阻止新生成任务。</span></div><div class="grid g3 mt-16"><div><div class="tiny muted">剩余预算</div><div class="mono">' + App.formatMoney(u.budget - u.spent) + '</div></div><div><div class="tiny muted">预计月末</div><div class="mono">' + App.formatMoney(u.estimatedMonth) + '</div></div><div><div class="tiny muted">超限动作</div><div class="mono">' + (u.blockOnExceed ? '阻止新任务' : '仅告警') + '</div></div></div>' }) +
      UI.card({ title: '预算提示', sub: '预警与阻断规则', body: alerts }) +
      '</div>' +
      UI.card({ cls: 'mt-16', title: '按项目', sub: '剧集、镜头、token、供应商账单、平台估算与预算', head: '<span class="tag">' + u.byProject.length + ' 个项目</span>', body: '<div class="table-wrap"><table class="usage-project-table"><thead><tr><th>项目</th><th>剧集</th><th>镜头</th><th>token</th><th>供应商账单</th><th>平台估算</th><th>预算</th><th>执行</th><th>状态</th></tr></thead><tbody>' + projectRows + '</tbody></table></div>' }) +
      UI.card({ cls: 'mt-16', title: '按 Provider / 模型', sub: '调用量、计量单位与估算成本', body: '<div class="table-wrap"><table><thead><tr><th>模型</th><th>能力</th><th>调用</th><th>用量</th><th>估算成本</th><th>占比</th></tr></thead><tbody>' + modelRows + '</tbody></table></div>' }) +
      '<div class="grid g3 mt-16">' +
      UI.card({ title: '部门成本', sub: '按成员所属部门聚合', body: '<div class="role-dist">' + deptRows + '</div>' }) +
      UI.card({ title: '高用量成员', sub: '用于复核任务归属与预算责任', body: userRows }) +
      UI.card({ title: '口径说明', sub: '三种成本口径不可混用', body: '<div class="scope-rule"><span class="badge b-info">供应商账单</span><p>Provider 结算金额，可能有延迟与最小计费单位。</p></div><div class="scope-rule"><span class="badge b-info">返回 usage</span><p>响应中的 token、秒数或字符数，用于核对调用。</p></div><div class="scope-rule"><span class="badge b-teal">平台估算</span><p>按能力单价估算，任务创建前用于预算检查。</p></div></div>' }) +
      '</div></div>';
  }

  function editBudget() {
    var u = st().orgUsage;
    var body = '<div class="form-grid"><div class="field"><label>组织月度预算（元）</label><input class="input" id="ubBudget" type="number" value="' + u.budget + '"></div><div class="field"><label>预警阈值（%）</label><input class="input" id="ubThreshold" type="number" value="' + u.threshold + '"></div><div class="field span2"><label class="checkline"><input type="checkbox" id="ubBlock"' + (u.blockOnExceed ? ' checked' : '') + '> 达到预算时阻止新生成任务</label></div></div><div class="notice info mt-12">预算只影响任务创建前的检查；已提交任务继续执行并记录用量。</div>';
    App.modal({
      title: '调整组织预算', sub: '当前周期 ' + u.period, body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="ubGo">保存</button>',
      onMount: function (el, close) {
        el.querySelector('#ubGo').addEventListener('click', function () {
          var b = Number(el.querySelector('#ubBudget').value), t = Number(el.querySelector('#ubThreshold').value);
          if (!b || b < 1 || !t || t < 1 || t > 100) { App.toast('预算无效', '请填写正数预算与 1–100 的阈值。', 'danger'); return; }
          u.budget = b; u.threshold = t; u.blockOnExceed = el.querySelector('#ubBlock').checked;
          App.logAudit('调整组织预算', App.formatMoney(b) + ' · ' + t + '%', '用量', '超限动作：' + (u.blockOnExceed ? '阻止新任务' : '仅告警'), 'normal', null);
          close(); App.refresh(); App.toast('预算已保存', App.formatMoney(b) + ' · 阈值 ' + t + '%', 'success');
        });
      }
    });
  }

  function exportUsage() {
    var u = st().orgUsage;
    var csv = '\uFEFF口径,项目/模型,剧集,镜头,token,供应商账单,平台估算,预算,占比\n' + u.byProject.map(function (p) {
      return ['项目', p.name, p.episodes, p.shots, p.tokens, p.vendorBilled, p.estimated, p.budget, ''].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
    }).concat(u.byModel.map(function (m) {
      return ['模型', m.model, '', '', m.units, '', m.estimated, '', m.share].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
    })).join('\n');
    App.download('changye_usage_' + Date.now() + '.csv', csv, 'text/csv;charset=utf-8');
    App.toast('用量已导出', u.period + ' · ' + u.byProject.length + ' 个项目', 'success');
  }
  /* ================= 系统设置 ================= */
  function workspacePage() {
    var sections = [["general", "通用信息"], ["runtime", "运行与存储"], ["backup", "备份恢复"], ["project", "项目默认"], ["notify", "通知策略"], ["danger", "危险操作"]];
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "System · Settings", title: "系统设置", desc: "私有化部署的通用信息、运行约束、存储、备份恢复与默认行为。设置只保存在原型内存，刷新恢复演示初始值。", actions: '<button class="btn" data-act="export-workspace">' + UI.icon("download") + '导出系统配置</button>' }) +
      '<div class="settings-layout"><div class="settings-nav">' + sections.map(function (x) {
        return '<button class="' + (workspaceSection === x[0] ? "active" : "") + '" data-act="ws-section" data-key="' + x[0] + '">' + x[1] + "</button>";
      }).join("") + '</div><div>' + workspacePanel() + "</div></div></div>";
  }

  function workspacePanel() {
    var w = st().workspace;
    if (workspaceSection === "general") {
      return '<div class="card"><div class="card-head"><div><h3>通用信息</h3><div class="ch-sub">企业主体、部署方式与数据驻留</div></div><span class="badge b-teal">私有化</span></div><div class="card-body">' +
        '<div class="form-grid"><div class="field"><label>平台名称</label><input class="input" id="wsName" value="' + UI.esc(w.name) + '"></div><div class="field"><label>企业主体</label><input class="input" id="wsLegal" value="' + UI.esc(w.legalName) + '"></div>' +
        '<div class="field"><label>企业邮箱域名</label><div class="row"><input class="input" id="wsDomain" value="' + UI.esc(w.emailDomain) + '" disabled>' + UI.badge("内部账号", "b-outline") + "</div></div>" +
        '<div class="field"><label>部署方式</label><input class="input" value="' + UI.esc(w.deployment) + '" disabled></div>' +
        '<div class="field"><label>数据区域</label><input class="input" value="' + UI.esc(w.region) + '" disabled><span class="hint">私有化部署固定数据驻留，不提供多区域切换</span></div>' +
        '<div class="field"><label>时区</label><input class="input" id="wsTz" value="' + UI.esc(w.timezone) + '"></div><div class="field"><label>语言</label><select class="select" id="wsLocale"><option value="zh-CN"' + (w.locale === "zh-CN" ? " selected" : "") + '>简体中文</option><option value="en-US"' + (w.locale === "en-US" ? " selected" : "") + ">English</option></select></div></div>" +
        '<div class="row mt-16"><button class="btn btn-primary" data-act="save-workspace">保存通用设置</button><span class="tiny muted">创建于 ' + UI.esc(w.createdAt) + " · 最近更新 " + UI.esc(w.updatedAt) + "</span></div></div></div>";
    }
    if (workspaceSection === "runtime") {
      var r = w.runtime;
      return '<div class="card"><div class="card-head"><div><h3>运行与存储</h3><div class="ch-sub">Docker Compose 私有化部署的固定约束</div></div><span class="badge b-outline">只读</span></div><div class="card-body"><div class="kv" style="grid-template-columns:130px 1fr">' +
        '<div class="k">编排</div><div class="v mono">' + UI.esc(r.compose) + '</div><div class="k">Web</div><div class="v">' + UI.esc(r.web) + '</div><div class="k">API</div><div class="v">' + UI.esc(r.api) + '</div>' +
        '<div class="k">队列</div><div class="v">' + UI.esc(r.queue) + '</div><div class="k">Worker</div><div class="v">' + UI.esc(r.worker) + '</div><div class="k">数据库</div><div class="v">' + UI.esc(r.database) + '</div>' +
        '<div class="k">对象存储</div><div class="v">' + UI.esc(r.storage) + '</div><div class="k">媒体处理</div><div class="v">' + UI.esc(r.ffmpeg) + '</div><div class="k">上传上限</div><div class="v">' + UI.esc(r.maxUpload) + '</div>' +
        '<div class="k">容器用户</div><div class="v">' + UI.esc(r.containerUser) + '</div></div>' +
        '<div class="notice info mt-16">' + UI.icon("lock", 15) + "<span>不部署 Ollama / vLLM / ComfyUI，不自建 GPU 推理；外部模型通过 Provider Adapter 调用。配置只通过部署环境注入，仓库不保存生产密钥。</span></div></div></div>";
    }
    if (workspaceSection === "backup") {
      var b = w.backup;
      return '<div class="card"><div class="card-head"><div><h3>备份与恢复</h3><div class="ch-sub">数据库、资产元数据与导出物的私有备份</div></div></div><div class="card-body"><div class="kv"><div class="k">最近备份</div><div class="v">' + UI.esc(b.last) + ' · ' + UI.esc(b.lastSize) + '</div><div class="k">备份目标</div><div class="v mono">' + UI.esc(b.target) + '</div><div class="k">保留周期</div><div class="v">' + b.retention + ' 天</div><div class="k">恢复演练</div><div class="v">' + UI.esc(b.restoreDrill) + '</div><div class="k">备份范围</div><div class="v">PostgreSQL、项目元数据、资产清单与导出记录</div></div>' +
        '<div class="row mt-16"><button class="btn" data-act="run-backup">立即备份</button><button class="btn btn-ghost" data-act="restore-drill">恢复演练</button></div>' +
        '<div class="notice warn mt-12">恢复演练在隔离环境执行；生产恢复必须停止写入并二次确认。</div></div></div>';
    }
    if (workspaceSection === "project") {
      return '<div class="card"><div class="card-head"><div><h3>项目默认</h3><div class="ch-sub">新建项目应用的模板、模型与成员审批</div></div></div><div class="card-body"><div class="form-grid">' +
        '<div class="field"><label>默认模板</label><select class="select" id="wTemplate"><option' + (w.defaultTemplate.indexOf("12") > -1 ? " selected" : "") + ">竖屏短剧 · 12 集</option><option>横屏短片 · 6 集</option><option>品牌定制 · 8 集</option></select></div>" +
        '<div class="field"><label>默认视频模型</label><select class="select" id="wModel">' + st().models.map(function (m) { return '<option' + (m.id === w.defaultModel ? " selected" : "") + ">" + UI.esc(m.id) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field span2"><label class="checkline"><input type="checkbox" id="wApproval"' + (w.requireProjectApproval ? " checked" : "") + "> 新建项目需要管理员审批</label><label class=\"checkline\"><input type=\"checkbox\" id=\"wGuest\"" + (w.allowExternalReviewer ? " checked" : "") + "> 允许外部审片账号加入项目</label></div></div>" +
        '<button class="btn btn-primary mt-16" data-act="save-project-defaults">保存项目默认</button></div></div>';
    }
    if (workspaceSection === "notify") {
      return '<div class="card"><div class="card-head"><div><h3>通知策略</h3><div class="ch-sub">站内信、邮件与治理摘要</div></div></div><div class="card-body">' + (w.notifications || []).map(function (n) {
        return '<div class="setting-toggle-row"><div><b>' + UI.esc(n.label) + '</b><div class="tiny muted">' + UI.esc(n.desc) + '</div></div><button class="switch ' + (n.on ? "on" : "") + '" data-act="toggle-ws" data-key="' + n.key + '"><i></i></button></div>';
      }).join("") + "</div></div>";
    }
    return '<div class="card" style="border-color:#f0cfc9"><div class="card-head"><div><h3 style="color:#8c332b">危险操作</h3><div class="ch-sub">不可逆 · 需二次确认</div></div></div><div class="card-body">' +
      '<div class="between" style="padding:10px 0"><div><b class="small">转移系统管理员</b><div class="tiny muted">将平台治理责任转交给另一名内部管理员，不改变项目成员授权与项目资产归属。</div></div><button class="btn btn-sm btn-danger" data-act="transfer">转移</button></div>' +
      '<div class="between" style="padding:10px 0;border-top:1px solid #eee9df"><div><b class="small">重置演示数据</b><div class="tiny muted">仅恢复原型内存状态，不会删除真实文件或数据库。</div></div><button class="btn btn-sm btn-danger" data-act="reset-workspace">重置</button></div></div></div>';
  }
  /* ================= 项目设置（沿用项目级能力） ================= */
  function projectSettingsPage() {
    var s = st();
    var sections = [["info", "项目信息"], ["team", "成员与授权"], ["models", "模型路由"], ["cost", "用量与预算"], ["notify", "通知"], ["demo", "演示数据"], ["danger", "危险操作"]];
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Project settings · NYJM-26", title: "项目设置", desc: "项目是协作、资产与授权的唯一边界。这里管理项目信息、项目成员、模型路由、预算与通知，不提供 Provider 凭据配置。", actions: '<button class="btn" data-act="state">' + UI.icon("download") + '导出项目状态</button><a class="btn" href="' + App.link("system/members") + '">用户与成员</a>' }) +
      '<div class="settings-layout"><div class="settings-nav">' + sections.map(function (x) {
        return '<button class="' + (settingsSection === x[0] ? "active" : "") + '" data-act="section" data-key="' + x[0] + '">' + x[1] + "</button>";
      }).join("") + '</div><div>' + settingsPanel() + "</div></div></div>";
  }

  function settingsPanel() {
    if (settingsSection === "info") return infoPanel();
    if (settingsSection === "models") return modelsPanel();
    if (settingsSection === "cost") return costPanel();
    if (settingsSection === "notify") return notifyPanel();
    if (settingsSection === "team") return teamPanel();
    if (settingsSection === "demo") return demoPanel();
    return dangerPanel();
  }

  function infoPanel() {
    var p = st().project;
    return '<div class="card"><div class="card-head"><div><h3>项目信息</h3><div class="ch-sub">显示名称、简介与交付日期</div></div><span class="badge b-teal">' + UI.esc(p.code) + '</span></div><div class="card-body">' +
      '<div class="form-grid"><div class="field span2"><label>项目名称<span class="req">*</span></label><input class="input" id="pName" value="' + UI.esc(p.name) + '"><span class="err-msg" id="pErr">名称不能为空</span></div>' +
      '<div class="field"><label>类型</label><input class="input" id="pGenre" value="' + UI.esc(p.genre) + '"></div><div class="field"><label>交付日期</label><input class="input" id="pDue" type="date" value="' + UI.esc(p.due) + '"></div>' +
      '<div class="field span2"><label>一句话简介</label><textarea class="textarea" id="pTagline" rows="2">' + UI.esc(p.tagline) + '</textarea></div>' +
      '<div class="field"><label>画幅</label><select class="select"><option>9:16 竖屏</option><option>16:9 横屏</option></select></div><div class="field"><label>帧率</label><select class="select"><option>30 fps</option><option>24 fps</option></select></div></div>' +
      '<div class="row mt-16"><button class="btn btn-primary" data-act="save-info">保存项目信息</button><span class="tiny muted">最近更新 ' + UI.esc(p.updated) + "</span></div></div></div>" +
      '<div class="card mt-16"><div class="card-head"><h3>项目编号</h3></div><div class="card-body"><div class="row"><span class="mono">' + UI.esc(p.code) + '</span><span class="tiny muted">用于导出命名与审计追踪</span></div></div></div>';
  }

  function modelsPanel() {
    var list = st().models.filter(function (m) { return m.enabled && m.providerId !== "internal"; });
    return '<div class="card"><div class="card-head"><div><h3>项目模型路由</h3><div class="ch-sub">继承系统 Provider 与模型配置，项目只选择可用模型</div></div></div><div class="card-body tight">' +
      list.map(function (m) {
        return '<div class="model-row"><span><b class="mono">' + UI.esc(m.modelId) + '</b><span class="t-sub">' + UI.esc(m.cap) + " · " + UI.esc(m.provider) + '</span></span><span class="m-ver tiny muted">' + UI.esc(m.version) + '</span><span class="m-lat tiny muted">' + UI.esc(m.latency) + "</span>" +
          '<span class="row" style="justify-content:flex-end;gap:4px">' + UI.statusBadge(m.enabled ? "connected" : "unconfigured") + '<span class="badge b-outline">系统注册</span></span></div>';
      }).join("") + '<div class="notice info mt-8">' + UI.icon("lock", 15) + "<span>项目内不配置 base_url、secret_ref 或 API Key；Provider 凭据由系统管理员在系统域维护。</span></div></div></div>" +
      '<div class="card mt-16"><div class="card-head"><h3>项目默认模型</h3><span class="tiny muted">新建任务时使用</span></div><div class="card-body"><div class="grid g2">' +
      ["文本生成", "图像生成", "视频生成", "语音合成"].map(function (cap) {
        var opts = list.filter(function (m) { return m.cap === cap; });
        return '<div class="field"><label>' + cap + '</label><select class="select">' + (opts.map(function (m) { return "<option>" + UI.esc(m.modelId) + "</option>"; }).join("") || "<option>未注册</option>") + "</select></div>";
      }).join("") + '</div><div class="tiny muted mt-8">若系统未配置对应能力，任务返回 PROVIDER_NOT_CONFIGURED，不回退 Mock。</div></div></div>';
  }

  function costPanel() {
    var usage = st().usage;
    var days = [214, 386, 302, 640, 812, 468, 286, 510, 420, 360, 580, 720, 390, 286];
    var max = Math.max.apply(null, days);
    return '<div class="card"><div class="card-head"><div><h3>用量与预算</h3><div class="ch-sub">本月 · 按能力拆分</div></div><span class="tag">预算 ' + App.formatMoney(usage.budget) + '</span></div><div class="card-body">' +
      '<div class="between"><span class="tiny muted">已用 ' + App.formatMoney(usage.spent) + '</span><span class="tiny muted">剩余 ' + App.formatMoney(usage.budget - usage.spent) + " · " + Math.round(usage.spent / usage.budget * 100) + "%</span></div>" +
      UI.progress(Math.round(usage.spent / usage.budget * 100)) + '<div class="budget-bar mt-16">' +
      usage.byCap.map(function (c) { return '<div class="budget-row"><span>' + c[0] + '</span><div class="progress thin"><i style="width:' + c[2] + '%"></i></div><span class="mono tiny">¥' + fmt(c[1]) + "</span></div>"; }).join("") +
      '</div><div class="eyebrow mt-20">近 14 天消耗</div><div class="bars">' + days.map(function (d) { return '<div class="bar" title="¥' + d + '"><i style="height:' + Math.round(d / max * 100) + '%"></i></div>'; }).join("") + "</div>" +
      '<div class="bar-labels">' + ["11-08","11-09","11-10","11-11","11-12","11-13","11-14","11-15","11-16","11-17","11-18","11-19","11-20","11-21"].map(function (d) { return "<span>" + d.slice(3) + "</span>"; }).join("") + "</div></div></div>" +
      '<div class="card mt-16"><div class="card-head"><h3>预算提醒</h3></div><div class="card-body"><div class="field"><label>项目月度预算</label><div class="row"><input class="input" style="max-width:160px" value="' + usage.budget + '" disabled><span class="tiny muted">元 / 月 · 在系统用量页调整</span></div></div>' +
      '<div class="row mt-12"><label class="checkline"><input type="checkbox" checked disabled> 达到 80% 时通知项目经理</label><label class="checkline"><input type="checkbox" checked disabled> 达到 100% 时阻止新生成任务</label></div><div class="row mt-12"><a class="btn btn-sm" href="' + App.link("system/usage") + '">查看项目用量</a></div></div></div>';
  }

  function notifyPanel() {
    return '<div class="card"><div class="card-head"><div><h3>项目通知</h3><div class="ch-sub">站内信 · 邮件 · 失败提醒</div></div></div><div class="card-body">' +
      [["任务失败", "立即通知任务创建者与项目负责人", true], ["质量门禁待审核", "出现 REVIEW_REQUIRED 时通知项目审核人", true], ["项目成员变更", "邀请、移除与授权调整时通知项目负责人", true], ["每周用量摘要", "每周一 09:00 发送项目预算摘要", false], ["导出完成", "交付完成后通知项目成员", true]].map(function (n) {
        return '<div class="between" style="padding:11px 0;border-bottom:1px solid #eee9df"><div><b class="small">' + n[0] + '</b><div class="tiny muted">' + n[1] + '</div></div><button class="switch ' + (n[2] ? "on" : "") + '" data-act="toggle" aria-label="切换通知"><i></i></button></div>';
      }).join("") + "</div></div>";
  }

  function teamPanel() {
    var p = st().project;
    var members = App.projectMembers(p.id);
    return '<div class="card"><div class="card-head"><div><h3>项目成员与授权</h3><div class="ch-sub">' + members.length + " 名项目成员 · 项目负责人 " + UI.esc((memberById(p.ownerId) || {}).name || "—") + '</div></div><a class="btn btn-sm" href="' + App.link("system/members") + '">用户与成员</a></div><div class="card-body tight">' +
      members.map(function (m) {
        return '<div class="list-row">' + UI.avatar(m.name, "sm", m.color) + '<span class="lr-main"><span class="lr-title">' + UI.esc(m.name) + '</span><span class="lr-sub">' + UI.esc(m.role) + " · " + UI.esc(m.dept) + '</span></span><span class="badge ' + (m.id === p.ownerId ? "b-teal" : "b-info") + '">' + UI.esc(App.projectRoleOf(m, p.id)) + "</span></div>";
      }).join("") + '<div class="notice info mt-8">' + UI.icon("lock", 15) + "<span>项目负责人不可被移除；移除其他成员会立即撤销其项目访问与未完成任务的查看权限。</span></div></div></div>";
  }

  function demoPanel() {
    return '<div class="card"><div class="card-head"><div><h3>演示数据</h3><div class="ch-sub">当前状态仅保存在内存，刷新页面恢复初始演示数据</div></div></div><div class="card-body">' +
      '<div class="kv"><div class="k">状态</div><div class="v">已初始化 · ' + st().members.length + " 成员 / " + st().roles.length + ' 角色</div><div class="k">存储</div><div class="v">内存 · 无 localStorage</div><div class="k">审计</div><div class="v">' + st().audit.length + " 条 · 保留 " + st().workspace.dataRetention + ' 天</div></div>' +
      '<div class="row mt-16"><button class="btn" data-act="state">' + UI.icon("download") + '导出演示状态</button><button class="btn btn-soft" data-act="reset">重置全部演示数据</button></div></div></div>';
  }

  function dangerPanel() {
    return '<div class="card" style="border-color:#f0cfc9"><div class="card-head"><div><h3 style="color:#8c332b">危险操作</h3><div class="ch-sub">不可逆 · 需二次确认</div></div></div><div class="card-body">' +
      '<div class="between" style="padding:10px 0"><div><b class="small">归档项目</b><div class="tiny muted">归档后成员只读，导出历史保留。</div></div><button class="btn btn-sm btn-danger" data-act="archive">归档</button></div>' +
      '<div class="between" style="padding:10px 0;border-top:1px solid #eee9df"><div><b class="small">删除项目</b><div class="tiny muted">原型中仅演示确认流程，不会真实删除数据。</div></div><button class="btn btn-sm btn-danger" data-act="delete">删除</button></div></div></div>';
  }

  /* ================= 弹层与动作 ================= */
  function configModel(i) {
    var m = st().models[i]; if (!m) return;
    var provider = st().providers.filter(function (p) { return p.id === m.providerId; })[0];
    var body = '<div class="form-grid"><div class="field"><label>model_id</label><input class="input mono" value="' + UI.esc(m.modelId) + '" disabled></div>' +
      '<div class="field"><label>Provider</label><input class="input" value="' + UI.esc(provider ? provider.name : '内部规则') + '" disabled></div>' +
      '<div class="field"><label>能力</label><input class="input" value="' + UI.esc(m.cap) + '" disabled></div>' +
      '<div class="field"><label>capabilities</label><input class="input mono" value="' + UI.esc((m.capabilities || []).join(', ')) + '" disabled></div>' +
      '<div class="field"><label>timeout（秒）</label><input class="input" id="cmTimeout" type="number" value="' + m.timeout + '"></div>' +
      '<div class="field"><label>优先级</label><input class="input" id="cmPriority" type="number" value="' + m.priority + '"></div>' +
      '<div class="field"><label>计价</label><input class="input" id="cmCost" value="' + UI.esc(m.cost) + '"></div>' +
      '<div class="field"><label class="checkline"><input type="checkbox" id="cmEnabled"' + (m.enabled ? ' checked' : '') + '> 允许生产任务路由</label></div></div>' +
      '<div class="notice info mt-12">' + UI.icon('lock', 15) + '<span>模型配置不包含 base_url 与 secret_ref；这些字段属于 Provider，只由系统管理员维护。</span></div>';
    App.modal({
      title: '配置模型 ' + m.modelId, sub: m.cap + ' · ' + m.version, body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="cmGo">保存模型配置</button>',
      onMount: function (el, close) {
        el.querySelector('#cmGo').addEventListener('click', function () {
          m.timeout = Number(el.querySelector('#cmTimeout').value) || 120;
          m.priority = Number(el.querySelector('#cmPriority').value) || 1;
          m.cost = el.querySelector('#cmCost').value.trim();
          m.enabled = el.querySelector('#cmEnabled').checked;
          m.status = m.enabled ? '已连接' : '已停用';
          App.logAudit('保存模型配置', m.modelId, 'Provider', m.cap + ' · timeout ' + m.timeout + 's · ' + (m.enabled ? '启用' : '停用'), 'high', null);
          close(); App.refresh(); App.toast('模型配置已保存', m.modelId + ' · ' + (m.enabled ? '可路由' : '已停用'), 'success');
        });
      }
    });
  }
  function resetDemo() {
    App.confirm({ title: "重置演示数据", message: "把所有项目、审核、任务、成员、角色与安全策略恢复到初始状态？", detail: "当前内存中的修改会丢失；页面刷新也会得到同样结果。", okText: "重置并刷新" }).then(function (ok) {
      if (!ok) return;
      App.resetDemo(); App.toast("已重置", "演示数据回到初始状态。", "success");
    });
  }

  function exportState() {
    var s = st();
    App.download(s.project.code + "_state.json", JSON.stringify({ project: s.project, pipeline: s.pipeline, qa: s.qa, timeline: s.timeline, exports: s.exports }, null, 2), "application/json;charset=utf-8");
    App.toast("状态已导出", s.project.code + "_state.json", "success");
  }

  function confirmed(title, msg, okText, danger) {
    App.confirm({ title: title, message: msg, danger: danger, okText: okText }).then(function (ok) {
      if (!ok) return;
      App.toast(title + "已演示", "原型不会真实修改或删除项目数据。", "warn");
    });
  }

  function securityReport() {
    var s = st(), sec = s.security, p = sec.dataPolicy;
    var avg = Math.round(s.securityChecks.reduce(function (n, c) { return n + c.score; }, 0) / s.securityChecks.length);
    var lines = ["长夜影视 · 企业安全基线", "生成时间：" + new Date().toLocaleString("zh-CN"), "安全评分：" + avg + " / 100", ""];
    s.securityChecks.forEach(function (c) { lines.push("- " + c.label + "：" + c.score + " 分 · " + c.detail); });
    lines.push("", "项目访问复核：" + (sec.access.projectMembership ? "开启" : "关闭"));
    lines.push("跨项目搜索 / 引用：" + (sec.access.crossProject ? "允许" : "禁止"));
    lines.push("数据外发默认动作：" + p.defaultAction);
    lines.push("允许 Provider：" + p.allowedProviders.join(", "));
    lines.push("允许区域：" + p.allowedRegions.join(", "));
    lines.push("敏感数据外发：" + (p.allowSensitive ? "允许" : "禁止"));
    lines.push("请求体日志：" + (p.logPayload ? "记录" : "不记录"));
    lines.push("Provider 凭据：" + sec.credentials.algorithm + " · " + sec.credentials.storage);
    lines.push("会话：空闲 " + sec.session.idle + " 分钟 · 最长 " + sec.session.max + " 小时");
    lines.push("上传：" + sec.upload.allowedMime.join(" / ") + " · " + sec.upload.maxFile);
    lines.push("媒体：" + sec.media.ffmpeg + " · " + sec.media.tempDir);
    App.download("changye_security_baseline.txt", lines.join("\n"), "text/plain;charset=utf-8");
    App.toast("安全基线已下载", "项目访问、外发、凭据、上传与媒体处理", "success");
  }

  function exportOrg() {
    var s = st();
    var csv = "\uFEFF部门,负责人,人数,说明\n" + s.departments.map(function (d) {
      return [d.name, d.lead, deptMembers(d.id).length, d.desc].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\n");
    App.download("changye_org.csv", csv, "text/csv;charset=utf-8");
    App.toast("组织架构已导出", s.departments.length + " 个部门 · CSV", "success");
  }

  /* ---------- 页面事件绑定 ---------- */
  function bindPage(root, handlers) {
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (b) {
        var fn = handlers[b.getAttribute("data-act")];
        if (fn) { fn(b); }
        return;
      }
      var row = e.target.closest("[data-act='member']");
      if (row && handlers.member) handlers.member(row);
    });
    root.addEventListener("submit", function (e) {
      var form = e.target.closest("[data-form]");
      if (!form) return;
      e.preventDefault();
      var fn = handlers["form:" + form.getAttribute("data-form")];
      if (fn) fn(form);
    });
  }

  function memberPageMount(root, params) {
    bindPage(root, {
      member: function (b) { memberDrawer(b.getAttribute("data-id")); },
      mstatus: function (b) { pageState.memberStatus = b.getAttribute("data-key"); App.refresh(); },
      invite: inviteMember,
      mreset: function () { pageState.memberStatus = "all"; pageState.memberQuery = ""; pageState.memberRole = "all"; App.refresh(); },
      "form:member-search": function (form) {
        pageState.memberQuery = form.querySelector("#mQuery").value.trim();
        pageState.memberRole = form.querySelector("#mRole").value;
        App.refresh();
      }
    });
    if (params && params.member) setTimeout(function () { memberDrawer(params.member); }, 20);
  }

  /* ---------- 路由注册 ---------- */
  AppModule.register({
    group: "system", label: "系统管理", icon: "sliders",
    routes: [
      { path: "system/access", title: "我的权限", icon: "lock", render: accessPage,
        mount: function (root) { bindPage(root, { "request-access": requestAccess }); }
      },
      { path: "system/overview", title: "企业概览", icon: "activity", render: enterpriseOverview,
        mount: function (root) {
          bindPage(root, {
            approve: function (b) { decideRequest(b.getAttribute("data-id"), true); },
            deny: function (b) { decideRequest(b.getAttribute("data-id"), false); },
            invite: inviteMember
          });
        }
      },
      { path: "system/org", title: "组织架构", icon: "folder", render: orgPage,
        mount: function (root) {
          bindPage(root, {
            "add-dept": addDept,
            dept: function (b) { deptDrawer(b.getAttribute("data-id")); },
            "export-org": exportOrg
          });
        }
      },
      { path: "system/members", title: "用户与成员", icon: "users", render: membersPage, mount: memberPageMount },
      { path: "system/roles", title: "角色与权限", icon: "check", render: rolesPage,
        mount: function (root) {
          bindPage(root, {
            role: function (b) { pageState.selectedRole = b.getAttribute("data-id"); App.refresh(); },
            "save-role": saveRole,
            "new-role": newRole,
            "perm-group": function (b) {
              var group = b.getAttribute("data-group"), mode = b.getAttribute("data-mode");
              root.querySelectorAll('[data-perm][data-group="' + group + '"]').forEach(function (cb) { cb.checked = mode === "all"; });
            }
          });
        }
      },
      { path: "system/security", title: "安全与访问", icon: "lock", render: securityPage,
        mount: function (root) {
          bindPage(root, {
            "save-session": function () {
              var sec = st().security.session;
              sec.idle = Number(document.getElementById("sessIdle").value) || 30;
              sec.max = Number(document.getElementById("sessMax").value) || 12;
              sec.refresh = Number(document.getElementById("sessRefresh").value) || 7;
              App.logAudit("更新会话策略", "空闲 " + sec.idle + " 分钟 · 最长 " + sec.max + " 小时", "安全", "会话与项目访问复核策略变更", "normal", null);
              App.refresh(); App.toast("会话策略已保存", "空闲 " + sec.idle + " 分钟 · 最长 " + sec.max + " 小时", "success");
            },
            "run-outbound-check": function () {
              var s = st(), p = s.security.dataPolicy, bad = [];
              if (p.defaultAction !== "deny") bad.push("默认动作不是拒绝");
              if (p.allowedProviders.indexOf("mork") < 0) bad.push("Mork 未在允许清单");
              if (p.allowedRegions.indexOf("中国大陆") < 0) bad.push("区域不在中国大陆");
              if (p.allowSensitive) bad.push("敏感数据允许外发");
              if (p.logPayload) bad.push("请求体写入日志");
              if (bad.length) { App.logAudit("数据外发自检失败", bad.join("；"), "安全", "策略不满足 MVP 基线", "critical", null); App.toast("外发自检未通过", bad.join("；"), "danger"); }
              else { p.lastReview = "今天 " + App.nowStamp(); App.logAudit("运行数据外发自检", "Mork · 中国大陆 · 默认拒绝", "安全", "8 项外发检查全部通过", "normal", null); App.refresh(); App.toast("外发自检通过", "Mork · 中国大陆 · 敏感内容禁止外发", "success"); }
            },
            "security-report": securityReport
          });
        }
      },
      { path: "system/audit", title: "审计日志", icon: "list", render: auditPage,
        mount: function (root) {
          bindPage(root, {
            afilter: function (b) { pageState.auditCategory = b.getAttribute("data-key"); App.refresh(); },
            "audit-detail": function (b) { auditDrawer(b.getAttribute("data-id")); },
            "export-audit": exportAudit,
            "audit-config": function () {
              var s = st();
              var body = '<div class="form-grid"><div class="field"><label>审计保留（天）</label><input class="input" id="acRet" type="number" value="' + s.workspace.dataRetention + '"></div><div class="field"><label class="checkline"><input type="checkbox" checked> 导出与下载写入审计</label></div></div><div class="notice info mt-12">仅所有者与安全管理员可修改保留周期。</div>';
              App.modal({ title: "审计设置", sub: "保留周期与导出策略", body: body, footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="acGo">保存</button>',
                onMount: function (el, close) {
                  el.querySelector("#acGo").addEventListener("click", function () {
                    s.workspace.dataRetention = Number(el.querySelector("#acRet").value) || 180;
                    App.logAudit("修改审计保留", s.workspace.dataRetention + " 天", "审计", "审计保留周期变更", "normal", null);
                    close(); App.refresh(); App.toast("审计设置已保存", "保留 " + s.workspace.dataRetention + " 天", "success");
                  });
                }
              });
            },
            "form:audit-search": function (form) {
              pageState.auditQuery = form.querySelector("#aQuery").value.trim();
              pageState.auditSeverity = form.querySelector("#aSeverity").value;
              App.refresh();
            }
          });
        }
      },
      { path: "system/providers", title: "Provider 与模型", icon: "grid", render: providersPage,
        mount: function (root) {
          bindPage(root, {
            "test-provider": function (b) { testProvider(b.getAttribute("data-id")); },
            "test-providers": function () { st().providers.forEach(function (p) { testProvider(p.id); }); },
            "config-provider": function (b) { configProvider(b.getAttribute("data-id")); },
            "add-provider": addProvider,
            "toggle-provider": function (b) { toggleProvider(b.getAttribute("data-id")); },
            "rotate-secret": function (b) { rotateSecret(b.getAttribute("data-id")); },
            "test-model": function (b) { testModel(Number(b.getAttribute("data-i"))); },
            "toggle-model": function (b) { toggleModel(Number(b.getAttribute("data-i"))); },
            "config-model": function (b) { configModel(Number(b.getAttribute("data-i"))); }
          });
        }
      },
      { path: "system/usage", title: "用量与预算", icon: "download", render: usagePage,
        mount: function (root) {
          bindPage(root, {
            "edit-budget": editBudget,
            "export-usage": exportUsage
          });
        }
      },
      { path: "system/workspace", title: "系统设置", icon: "sliders", render: workspacePage,
        mount: function (root) {
          bindPage(root, {
            "ws-section": function (b) { workspaceSection = b.getAttribute("data-key"); App.refresh(); },
            "save-workspace": function () {
              var w = st().workspace;
              w.name = document.getElementById("wsName").value.trim() || w.name;
              w.legalName = document.getElementById("wsLegal").value.trim();
              w.timezone = document.getElementById("wsTz").value.trim();
              w.locale = document.getElementById("wsLocale").value;
              w.updatedAt = "今天 " + App.nowStamp();
              App.logAudit("更新系统通用信息", w.name, "系统", w.timezone + " · " + w.locale, "normal", null);
              App.refresh(); App.toast("系统设置已保存", w.name + " · " + w.timezone, "success");
            },
            "save-project-defaults": function () {
              var w = st().workspace;
              w.defaultTemplate = document.getElementById("wTemplate").value;
              w.defaultModel = document.getElementById("wModel").value;
              w.requireProjectApproval = document.getElementById("wApproval").checked;
              w.allowExternalReviewer = document.getElementById("wGuest").checked;
              App.logAudit("更新项目默认", w.defaultTemplate, "系统", "默认模型 " + w.defaultModel + " · 外部审片 " + (w.allowExternalReviewer ? "允许" : "禁止"), "normal", null);
              App.refresh(); App.toast("项目默认已保存", w.defaultTemplate + " · " + w.defaultModel, "success");
            },
            "toggle-ws": function (b) {
              var key = b.getAttribute("data-key");
              var n = (st().workspace.notifications || []).filter(function (x) { return x.key === key; })[0];
              if (!n) return;
              n.on = !n.on; App.refresh(); App.toast("通知策略已更新", n.label + " · " + (n.on ? "开启" : "关闭"), "success");
            },
            "run-backup": function () {
              var w = st().workspace;
              w.backup.last = "今天 " + App.nowStamp();
              App.logAudit("执行系统备份", w.backup.target, "系统", "PostgreSQL 与项目元数据备份完成", "normal", null);
              App.refresh(); App.toast("备份完成", w.backup.target + " · " + w.backup.last, "success");
            },
            "restore-drill": function () {
              App.confirm({ title: "恢复演练", message: "在隔离环境从最近备份恢复 PostgreSQL 与资产清单，验证可读性后丢弃演练实例。", detail: "不会影响生产数据。", okText: "开始演练" }).then(function (ok) {
                if (!ok) return;
                var w = st().workspace;
                w.backup.restoreDrill = "今天 " + App.nowStamp() + " · 通过";
                App.logAudit("执行恢复演练", w.backup.lastSize, "系统", "隔离环境恢复通过，生产未变更", "warning", null);
                App.refresh(); App.toast("恢复演练通过", "隔离环境校验成功", "success");
              });
            },
            "export-workspace": function () {
              var s = st();
              App.download("changye_system_config.json", JSON.stringify({ workspace: s.workspace, providers: s.providers, models: s.models, security: s.security, roles: s.roles }, null, 2), "application/json;charset=utf-8");
              App.toast("系统配置已导出", "JSON · 不含 Provider 凭据材料", "success");
            },
            "reset-workspace": resetDemo,
            transfer: function () {
              var candidates = st().members.filter(function (m) { return m.status === "active" && m.roleId !== "r-owner" && m.roleId !== "r-guest"; });
              var body = '<div class="form-grid"><div class="field span2"><label>新系统管理员</label><select class="select" id="trOwner">' + candidates.map(function (m) { return '<option value="' + m.id + '">' + UI.esc(m.name) + " · " + UI.esc(m.role) + "</option>"; }).join("") + '</select></div></div><div class="notice danger mt-12">转移后当前系统管理员降为组织管理员；平台治理责任转移，项目成员授权与项目资产归属不变。</div>';
              App.modal({ title: "转移系统管理员", sub: "高风险操作 · 需要二次确认", body: body, footer: '<button class="btn" data-close>取消</button><button class="btn btn-danger" id="trGo">确认转移</button>',
                onMount: function (el, close) {
                  el.querySelector("#trGo").addEventListener("click", function () {
                    var id = el.querySelector("#trOwner").value;
                    st().workspace.ownerId = id;
                    App.logAudit("转移系统管理员", (memberById(id) || {}).name, "系统", "平台治理责任转移", "critical", null);
                    close(); App.refresh(); App.toast("系统管理员已转移", "请重新登录确认权限。", "warn");
                  });
                }
              });
            }
          });
        }
      },
      { path: "system/settings", title: "项目设置", icon: "sliders", render: projectSettingsPage,
        mount: function (root) {
          bindPage(root, {
            section: function (b) { settingsSection = b.getAttribute("data-key"); App.refresh(); },
            "save-info": function () {
              var name = document.getElementById("pName").value.trim();
              if (!name) { document.getElementById("pErr").classList.add("show"); return; }
              st().project.name = name;
              st().project.tagline = document.getElementById("pTagline").value.trim();
              st().project.due = document.getElementById("pDue").value;
              st().project.genre = document.getElementById("pGenre").value;
              st().project.updated = "刚刚";
              App.logAudit("更新项目信息", name, "项目", "项目名称、简介与交付日期", "normal", st().project.id);
              App.refresh(); App.toast("已保存", "项目信息已更新。", "success");
            },
            toggle: function (b) { b.classList.toggle("on"); App.toast("通知设置已更新", b.classList.contains("on") ? "已开启" : "已关闭", "success"); },
            reset: resetDemo,
            state: exportState,
            archive: function () { confirmed("归档项目", "归档后成员只读，导出历史保留。", "确认归档"); },
            delete: function () { confirmed("删除项目", "原型中不会真实删除，仅演示二次确认。", "确认删除", true); }
          });
        }
      },
      { path: "system/team", title: "用户与成员", icon: "users", nav: false, navParent: "system/members", render: membersPage, mount: memberPageMount }
    ]
  });
})();
