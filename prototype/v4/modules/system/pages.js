/* ============================================================
   模块：系统（system）
   企业概览 / 组织 / 成员席位 / 角色权限 / 安全 / 审计 /
   集成 / 订阅 / 我的权限 / 工作区设置 / 项目设置
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
  function mfaBadge(m) {
    var map = { enforced: ["b-done", "强制"], enabled: ["b-teal", "已启用"], pending: ["b-warn", "待完成"], disabled: ["b-danger", "未启用"] };
    var v = map[m.mfa] || ["b-todo", m.mfa];
    return '<span class="badge ' + v[0] + '">' + v[1] + "</span>";
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
      UI.pageHead({ eyebrow: "System · My access", title: "我的权限", desc: "企业权限按「身份 → 角色 → 数据范围」三层判定。这里展示当前身份实际可见的路由、可执行操作与项目边界。", actions: '<button class="btn" data-act="request-access">' + UI.icon("lock") + '申请额外权限</button>' + '<a class="btn" href="' + App.link("system/audit") + '">查看审计</a>' }) +
      '<div class="access-hero card card-pad"><div class="account-head" style="padding-top:0">' + UI.avatar(u.name, "lg", u.color) +
      '<div><div class="account-name">' + UI.esc(u.name) + '</div><div class="small muted">' + UI.esc(u.title) + " · " + UI.esc(u.email) + '</div><div class="row wrap mt-8"><span class="badge b-teal">' + UI.esc(u.role) + "</span>" + scopeBadge(u.scope) + '<span class="badge b-outline">' + (u.seatType === "guest" ? "访客席位" : "企业席位") + "</span>" + statusBadge({ status: u.status }) + "</div></div>" +
      '<div class="spacer"></div><div class="access-score"><div class="tiny muted">权限覆盖</div><div class="access-num">' + granted + "/" + total + '</div><div class="tiny muted">' + routeAllowed + " 个页面可访问</div></div></div></div>" +
      '<div class="grid g4 mt-16">' + UI.stat({ label: "当前角色", value: u.role, delta: App.scopeLabel(u.scope) + "数据范围" }) +
      UI.stat({ label: "已授予权限", value: String(granted), unit: "项", delta: "共 " + total + " 项权限" }) +
      UI.stat({ label: "可访问页面", value: String(routeAllowed), unit: "个", delta: "权限不足的页面显示 403" }) +
      UI.stat({ label: "身份安全", value: u.mfa === "enforced" || u.mfa === "enabled" ? "正常" : "待补", delta: "MFA " + UI.esc(u.mfa) }) + "</div>" +
      '<div class="grid g-2-1 mt-16"><div class="card"><div class="card-head"><div><h3>权限明细</h3><div class="ch-sub">按权限组展开 · 未授予项保留可见，便于申请</div></div><span class="tag">' + granted + " / " + total + "</span></div><div class=\"card-body\">" + groupHtml + "</div></div>" +
      '<div class="stack"><div class="card"><div class="card-head"><div><h3>数据范围</h3><div class="ch-sub">角色决定可触达的组织与项目边界</div></div>' + scopeBadge(u.scope) + '</div><div class="card-body"><div class="kv"><div class="k">所属部门</div><div class="v">' + UI.esc(u.dept) + '</div><div class="k">角色范围</div><div class="v">' + App.scopeLabel(u.scope) + '</div><div class="k">项目访问</div><div class="v">' + (projectChips || '<span class="muted">暂无项目</span>') + '</div><div class="k">临时授权</div><div class="v">' + temp + "</div></div></div></div>" +
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
    var seats = App.seatStats();
    var pending = s.accessRequests.filter(function (r) { return r.status === "pending"; });
    var checks = s.securityChecks.map(function (c) {
      return '<div class="sec-check-row"><span class="sec-check-main"><b>' + UI.esc(c.label) + '</b><small>' + UI.esc(c.detail) + '</small></span>' +
        '<span class="sec-check-score">' + c.score + '</span>' + UI.statusBadge(c.status) + "</div>";
    }).join("");
    var requests = pending.length ? pending.map(function (r) {
      return '<div class="request-row"><div class="req-main"><div class="req-title">' + UI.esc(r.requester) + " · " + UI.esc(r.title) + '</div><div class="req-sub">' + UI.esc(r.target) + " · " + UI.esc(r.createdAt) + '</div><div class="tiny muted mt-4">' + UI.esc(r.reason) + "</div></div>" + riskBadge(r.risk) +
        '<div class="row" style="gap:6px"><button class="btn btn-xs" data-act="deny" data-id="' + r.id + '">拒绝</button><button class="btn btn-xs btn-primary" data-act="approve" data-id="' + r.id + '">通过</button></div></div>';
    }).join("") : UI.empty("没有待审批申请", "成员申请会在这里进入审批队列。");
    var roleDist = s.roles.map(function (r) {
      var n = roleMembers(r.id).length;
      return '<div class="role-dist-row"><span class="rd-name">' + UI.esc(r.name) + '</span><div class="progress thin"><i style="width:' + Math.round(n / s.members.length * 100) + '%"></i></div><span class="mono tiny">' + n + "</span></div>";
    }).join("");
    var recent = s.audit.filter(function (a) { return App.inScope(a.deptId, a.projectId); }).slice(0, 5).map(function (a) {
      return '<div class="list-row"><span class="mono tiny" style="width:48px">' + UI.esc(a.time) + '</span><span class="lr-main"><span class="lr-title">' + UI.esc(a.action) + '</span><span class="lr-sub">' + UI.esc(a.actor) + " · " + UI.esc(a.target) + "</span></span>" + resultBadge(a.result) + "</div>";
    }).join("");
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Enterprise · Governance", title: "企业概览", desc: "工作区治理视图：席位、安全态势、访问审批与最近管理动作。仅企业所有者与管理员可见。", actions: (App.hasPerm("member:manage") ? '<button class="btn" data-act="invite">' + UI.icon("users") + '邀请成员</button>' : "") + '<a class="btn btn-primary" href="' + App.link("system/security") + '">' + UI.icon("lock") + "安全策略</a>" }) +
      '<div class="grid g4">' + UI.stat({ label: "已用席位", value: String(seats.total), unit: "/ " + seats.purchased, delta: seats.available + " 席可用 · 企业版" }) +
      UI.stat({ label: "活跃成员", value: String(seats.active), unit: "人", delta: seats.invited + " 待接受 · " + seats.suspended + " 已停用" }) +
      UI.stat({ label: "安全评分", value: "86", unit: "分", delta: "2 项策略待收紧" }) +
      UI.stat({ label: "治理待办", value: String(pending.length), unit: "条", delta: "访问申请待审批" }) + "</div>" +
      '<div class="grid g-2-1 mt-16"><div class="stack">' +
      UI.card({ title: "安全态势", sub: "按身份、会话、网络与审计四个维度检查", head: '<a class="btn btn-xs" href="' + App.link("system/security") + '">去加固</a>', body: '<div class="sec-checks">' + checks + "</div>" }) +
      UI.card({ title: "访问审批", sub: "项目访问、临时权限与下载审批", head: '<span class="tag">' + pending.length + " 待处理</span>", body: requests }) +
      UI.card({ title: "最近管理动作", sub: "当前数据范围内可见的审计事件", head: '<a class="btn btn-xs" href="' + App.link("system/audit") + '">全部审计</a>', body: recent }) +
      "</div><div class=\"stack\">" +
      UI.card({ title: "订阅与席位", sub: s.workspace.planName + " · " + s.billing.cycle, head: '<a class="btn btn-xs" href="' + App.link("system/billing") + '">账单</a>', body: '<div class="plan-mini"><div class="plan-price">' + App.formatMoney(s.billing.amount) + '<small>/ 年</small></div><div class="tiny muted">续费 ' + UI.esc(s.billing.renewal) + " · " + s.billing.seatsPurchased + ' 席</div></div>' +
      '<div class="between mt-12"><span class="tiny muted">席位使用</span><span class="mono tiny">' + seats.total + " / " + seats.purchased + "</span></div>" + UI.progress(Math.round(seats.total / seats.purchased * 100)) +
      '<div class="seat-legend mt-12"><span><i class="lg-dot full"></i>企业席位 ' + (seats.total - seats.guests) + '</span><span><i class="lg-dot guest"></i>访客 ' + seats.guests + "</span></div>" }) +
      UI.card({ title: "角色分布", sub: "按成员实际角色统计", body: '<div class="role-dist">' + roleDist + "</div>" }) +
      UI.card({ title: "治理快捷入口", sub: "企业管理员的高频动作", body: '<div class="quick-grid">' +
        '<a class="quick-tile" href="' + App.link("system/org") + '"><span class="quick-icon">' + UI.icon("folder", 15) + '</span><span class="quick-main"><span class="quick-title">组织架构</span><span class="quick-sub">部门与负责人</span></span></a>' +
        '<a class="quick-tile" href="' + App.link("system/roles") + '"><span class="quick-icon">' + UI.icon("check", 15) + '</span><span class="quick-main"><span class="quick-title">角色权限</span><span class="quick-sub">权限与数据范围</span></span></a>' +
        '<a class="quick-tile" href="' + App.link("system/integrations") + '"><span class="quick-icon">' + UI.icon("grid", 15) + '</span><span class="quick-main"><span class="quick-title">集成与 API</span><span class="quick-sub">SSO · SCIM · Webhook</span></span></a>' +
        '<a class="quick-tile" href="' + App.link("system/audit") + '"><span class="quick-icon">' + UI.icon("list", 15) + '</span><span class="quick-main"><span class="quick-title">审计日志</span><span class="quick-sub">导出与合规</span></span></a>' +
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
      return '<tr><td><b>' + UI.esc(p.name) + '</b><span class="t-sub mono">' + UI.esc(p.code) + '</span></td><td>' + UI.esc(p.ownerId ? (memberById(p.ownerId) || {}).name || "—" : "—") + '</td><td>' + (p.memberIds ? p.memberIds.length : 0) + ' 人</td><td>' + UI.badge(p.visibility === "org" ? "组织可见" : "成员可见", p.visibility === "org" ? "b-teal" : "b-info") + "</td><td>" + UI.esc(p.stage) + "</td></tr>";
    }).join("");
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Enterprise · Organization", title: "组织架构", desc: "部门、负责人和成员归属构成数据范围边界。部门负责人只能查看本部门成员与项目。", actions: (App.hasPerm("dept:manage") ? '<button class="btn" data-act="add-dept">' + UI.icon("plus") + '新增部门</button>' : "") + '<button class="btn" data-act="export-org">' + UI.icon("download") + "导出组织</button>" }) +
      '<div class="grid g4">' + UI.stat({ label: "部门", value: String(s.departments.length), unit: "个", delta: "3 个一级部门" }) +
      UI.stat({ label: "企业成员", value: String(s.members.length), unit: "人", delta: s.members.filter(function (m) { return m.status === "active"; }).length + " 人在职" }) +
      UI.stat({ label: "当前可见", value: String(visibleMembers.length), unit: "人", delta: App.scopeLabel(App.currentUser.scope) + "范围" }) +
      UI.stat({ label: "外部协作", value: String(deptMembers("d-ext").length), unit: "人", delta: "访客席位独立管控" }) + "</div>" +
      '<div class="grid g-2-1 mt-16"><div class="card"><div class="card-head"><div><h3>组织树</h3><div class="ch-sub">点击部门查看成员与负责人</div></div><span class="badge b-teal">' + App.scopeLabel(App.currentUser.scope) + "可见</span></div><div class=\"card-body\">" + (root ? deptNode(root, 0) : UI.empty("暂无组织", "新增根部门开始搭建组织。")) + "</div></div>" +
      '<div class="stack"><div class="card"><div class="card-head"><div><h3>数据范围规则</h3><div class="ch-sub">角色与组织共同决定可见边界</div></div></div><div class="card-body"><div class="scope-rule"><span class="badge b-teal">全组织</span><p>所有者与管理员可查看全部部门、成员和审计。</p></div><div class="scope-rule"><span class="badge b-warn">本部门</span><p>部门负责人仅查看本部门成员；跨部门数据在列表中隐藏。</p></div><div class="scope-rule"><span class="badge b-info">所属项目</span><p>制作角色仅可进入被分配的项目；项目切换器按成员名单过滤。</p></div><div class="scope-rule"><span class="badge b-todo">仅本人</span><p>预留范围，适用于外部顾问的单条数据授权。</p></div></div></div>' +
      UI.card({ title: "当前身份", body: '<div class="account-head" style="padding:0 0 10px">' + UI.avatar(App.currentUser.name, "lg", App.currentUser.color) + '<div><div class="account-name">' + UI.esc(App.currentUser.name) + '</div><div class="small muted">' + UI.esc(App.currentUser.role) + " · " + UI.esc(App.currentUser.dept) + '</div></div></div><div class="kv"><div class="k">数据范围</div><div class="v">' + App.scopeLabel(App.currentUser.scope) + '</div><div class="k">可见成员</div><div class="v">' + visibleMembers.length + " / " + s.members.length + "</div></div>" }) + "</div></div>" +
      '<div class="card mt-16"><div class="card-head"><div><h3>项目成员映射</h3><div class="ch-sub">项目是数据隔离与交付权限的最小单元</div></div></div><div class="card-body tight"><div class="table-wrap"><table><thead><tr><th>项目</th><th>负责人</th><th>成员</th><th>可见性</th><th>阶段</th></tr></thead><tbody>' + projectRows + "</tbody></table></div></div></div></div>";
  }

  function addDept() {
    var body = '<div class="form-grid"><div class="field"><label>部门名称<span class="req">*</span></label><input class="input" id="dpName" placeholder="例如：海外发行"><span class="err-msg" id="dpErr">请填写部门名称</span></div>' +
      '<div class="field"><label>上级部门</label><select class="select" id="dpParent">' + st().departments.map(function (d) { return '<option value="' + d.id + '">' + UI.esc(d.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>负责人</label><select class="select" id="dpLead">' + st().members.filter(function (m) { return m.status === "active"; }).map(function (m) { return '<option value="' + m.id + '">' + UI.esc(m.name) + " · " + UI.esc(m.title) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>部门说明</label><input class="input" id="dpDesc" placeholder="职责范围"></div></div>';
    App.modal({
      title: "新增部门", sub: "部门是数据范围与审批链的一级边界。", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="dpGo">创建部门</button>',
      onMount: function (el, close) {
        el.querySelector("#dpGo").addEventListener("click", function () {
          var name = el.querySelector("#dpName").value.trim();
          if (!name) { el.querySelector("#dpErr").classList.add("show"); return; }
          var lead = memberById(el.querySelector("#dpLead").value);
          st().departments.push({ id: "d-" + Date.now(), name: name, parent: el.querySelector("#dpParent").value, leadId: lead.id, lead: lead.name, type: "team", desc: el.querySelector("#dpDesc").value.trim() || "新建部门" });
          App.logAudit("新增部门", name, "工作区", "建立部门并指定负责人 " + lead.name, "normal", null);
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
          App.logAudit("调整部门负责人", d.name + " → " + lead.name, "工作区", "部门负责人变更", "normal", null);
          close(); App.refresh(); App.toast("负责人已更新", d.name + " → " + lead.name, "success");
        });
      }
    });
  }

  /* ================= 成员与席位 ================= */
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
    var seats = App.seatStats();
    var list = filteredMembers();
    var roleOptions = s.roles.filter(function (r) { return r.id !== "r-owner"; });
    var rows = list.map(function (m) {
      return '<tr class="member-row" data-act="member" data-id="' + m.id + '"><td><div class="member-cell">' + UI.avatar(m.name, "sm", m.color) + '<span><b>' + UI.esc(m.name) + '</b><span class="t-sub">' + UI.esc(m.email) + "</span></span></div></td>" +
        "<td>" + UI.esc(m.dept) + "</td><td><b>" + UI.esc(m.role) + '</b><span class="t-sub">' + App.scopeLabel((App.roleOf(m) || {}).scope) + "</span></td>" +
        "<td>" + (m.seatType === "guest" ? UI.badge("访客", "b-info") : UI.badge("企业", "b-teal")) + '</td><td>' + statusBadge(m) + "</td><td>" + mfaBadge(m) + "</td><td>" + UI.esc(m.last) + '</td><td><button class="btn btn-xs" data-act="member" data-id="' + m.id + '">详情</button></td></tr>';
    }).join("");
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Enterprise · Members", title: "成员与席位", desc: "成员生命周期、角色分配与席位占用。当前数据范围：" + App.scopeLabel(App.currentUser.scope) + "。", actions: (App.hasPerm("member:manage") ? '<button class="btn btn-primary" data-act="invite">' + UI.icon("users") + '邀请成员</button>' : "") + (App.hasPerm("integration:manage") ? '<button class="btn" data-act="scim">' + UI.icon("refresh") + "同步 SCIM</button>" : "") }) +
      '<div class="grid g4">' + UI.stat({ label: "成员", value: String(s.members.filter(function (m) { return App.inScope(m.deptId, null); }).length), unit: "人", delta: "当前可见范围" }) +
      UI.stat({ label: "企业席位", value: String(seats.total - seats.guests), unit: "席", delta: "已购 " + seats.purchased + " 席" }) +
      UI.stat({ label: "访客席位", value: String(seats.guests), unit: "席", delta: "审片与外部协作" }) +
      UI.stat({ label: "待接受", value: String(seats.invited), unit: "人", delta: seats.suspended + " 人已停用" }) + "</div>" +
      '<div class="card mt-16"><div class="card-head"><div><h3>成员目录</h3><div class="ch-sub">按状态、角色与关键词筛选；点击行查看完整档案</div></div></div><div class="card-body">' +
      '<form class="member-toolbar" data-form="member-search"><label class="filter-search">' + UI.icon("search", 14) + '<input class="input" id="mQuery" value="' + UI.esc(pageState.memberQuery) + '" placeholder="搜索姓名、邮箱、部门或角色"></label>' +
      '<select class="select" id="mRole" style="width:150px"><option value="all">全部角色</option>' + (App.hasPerm("member:manage") ? roleOptions : s.roles).map(function (r) { return '<option value="' + r.id + '"' + (pageState.memberRole === r.id ? " selected" : "") + ">" + UI.esc(r.name) + "</option>"; }).join("") + "</select>" +
      '<button class="btn btn-sm" type="submit">筛选</button><button class="btn btn-sm btn-ghost" type="button" data-act="mreset">重置</button></form>' +
      '<div class="row wrap mt-8">' + [["all", "全部"], ["active", "正常"], ["invited", "待接受"], ["suspended", "已停用"]].map(function (x) {
        return '<button class="chip' + (pageState.memberStatus === x[0] ? " on" : "") + '" data-act="mstatus" data-key="' + x[0] + '">' + x[1] + "</button>";
      }).join("") + '<span class="spacer"></span><span class="tiny muted">' + list.length + " / " + s.members.length + " 人</span></div>" +
      (rows ? '<div class="table-wrap mt-12"><table class="member-table"><thead><tr><th>成员</th><th>部门</th><th>角色</th><th>席位</th><th>状态</th><th>MFA</th><th>最近活跃</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>" : UI.empty("没有匹配成员", "调整筛选条件，或邀请新成员。", App.hasPerm("member:manage") ? '<button class="btn btn-primary mt-16" data-act="invite">邀请成员</button>' : "")) +
      "</div></div></div>";
  }

  function inviteMember() {
    var roles = st().roles.filter(function (r) { return r.id !== "r-owner"; });
    var body = '<div class="form-grid"><div class="field"><label>姓名<span class="req">*</span></label><input class="input" id="invName" placeholder="例如：唐宁"><span class="err-msg" id="invNameErr">请填写姓名</span></div>' +
      '<div class="field"><label>企业邮箱<span class="req">*</span></label><input class="input" id="invEmail" placeholder="name@studio.cn"><span class="err-msg" id="invErr">请输入有效邮箱</span></div>' +
      '<div class="field"><label>角色</label><select class="select" id="invRole">' + roles.map(function (r) { return '<option value="' + r.id + '">' + UI.esc(r.name) + " · " + App.scopeLabel(r.scope) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>部门</label><select class="select" id="invDept">' + st().departments.filter(function (d) { return d.parent !== null; }).map(function (d) { return '<option value="' + d.id + '">' + UI.esc(d.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>席位类型</label><select class="select" id="invSeat"><option value="full">企业席位</option><option value="guest">访客席位</option></select></div>' +
      '<div class="field"><label>初始项目</label><select class="select" id="invProject">' + st().projects.map(function (p) { return '<option value="' + p.id + '">' + UI.esc(p.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field span2"><label class="checkline"><input type="checkbox" id="invApproval" checked> 外部访客需要管理员审批后才能下载</label></div></div>' +
      '<div class="notice info mt-12">' + UI.icon("users", 15) + "<span>邀请后成员为「待接受」，席位立即预占；接受后通过 SSO 完成首次登录。</span></div>";
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
          var dept = deptById(el.querySelector("#invDept").value);
          var project = el.querySelector("#invProject").value;
          st().members.push({
            id: "m-" + Date.now(), code: "", demo: false, name: name, email: email, title: role.name,
            deptId: dept.id, dept: dept.name, roleId: role.id, role: role.name,
            seatType: el.querySelector("#invSeat").value, status: "invited", presence: "offline",
            last: "—", lastActive: "—", joined: "待接受", mfa: "pending", source: "invite",
            projects: [project], initial: name.charAt(0), color: "green", tempPerms: []
          });
          App.logAudit("邀请成员", email + " · " + role.name, "成员", "邀请加入 " + dept.name + "，初始项目 " + projectName(project), "normal", project);
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
    var body = '<div class="account-head">' + UI.avatar(m.name, "lg", m.color) + '<div><div class="account-name">' + UI.esc(m.name) + '</div><div class="small muted">' + UI.esc(m.title) + " · " + UI.esc(m.email) + '</div><div class="row wrap mt-8">' + statusBadge(m) + (m.seatType === "guest" ? UI.badge("访客席位", "b-info") : UI.badge("企业席位", "b-teal")) + mfaBadge(m) + "</div></div></div>" +
      '<div class="kv"><div class="k">成员 ID</div><div class="v mono">' + UI.esc(m.id) + '</div><div class="k">部门</div><div class="v">' + UI.esc(m.dept) + '</div><div class="k">加入时间</div><div class="v">' + UI.esc(m.joined) + '</div><div class="k">来源</div><div class="v">' + ({ sso: "企业 SSO", invite: "邮件邀请", scim: "SCIM 同步" })[m.source] + '</div><div class="k">最近活跃</div><div class="v">' + UI.esc(m.lastActive) + "</div></div>" +
      (can ? '<div class="form-grid mt-16"><div class="field"><label>角色</label><select class="select" id="mdRole">' + st().roles.map(function (r) { return '<option value="' + r.id + '"' + (r.id === m.roleId ? " selected" : "") + ">" + UI.esc(r.name) + " · " + App.scopeLabel(r.scope) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label>部门</label><select class="select" id="mdDept">' + st().departments.filter(function (d) { return d.parent !== null; }).map(function (d) { return '<option value="' + d.id + '"' + (d.id === m.deptId ? " selected" : "") + ">" + UI.esc(d.name) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label>席位</label><select class="select" id="mdSeat"><option value="full"' + (m.seatType === "full" ? " selected" : "") + '>企业席位</option><option value="guest"' + (m.seatType === "guest" ? " selected" : "") + ">访客席位</option></select></div></div>" : "") +
      '<div class="eyebrow mt-20">项目范围</div><div class="row wrap mt-8">' + st().projects.map(function (p) {
        var checked = m.projects.indexOf(p.id) > -1;
        return '<label class="chip' + (checked ? " on" : "") + '" style="cursor:pointer"><input type="checkbox" data-mproj="' + p.id + '"' + (checked ? " checked" : "") + (can ? "" : " disabled") + ' style="width:13px;height:13px;margin-right:2px">' + UI.esc(p.name) + "</label>";
      }).join("") + "</div>" +
      '<div class="notice info mt-16">' + UI.icon("lock", 15) + "<span>角色变更只影响该成员下一次会话；已建立的项目上下文会按新数据范围重新判定。</span></div>";
    var footer = '<button class="btn" data-close>关闭</button>';
    if (can && role && role.id !== "r-owner") {
      footer = '<button class="btn" data-close>关闭</button><button class="btn btn-soft" id="mToggle">' + (m.status === "suspended" ? "恢复账号" : "停用账号") + '</button><button class="btn btn-danger" id="mRemove">移除</button><button class="btn btn-primary" id="mSave">保存变更</button>';
    } else if (can) {
      footer = '<button class="btn" data-close>关闭</button><span class="tiny muted" style="margin-right:auto">工作区所有者不可在此降级</span>';
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
          m.seatType = el.querySelector("#mdSeat").value;
          m.projects = [];
          el.querySelectorAll("[data-mproj]").forEach(function (cb) { if (cb.checked) m.projects.push(cb.getAttribute("data-mproj")); });
          if (identity) identity.projectIds = m.projects.slice();
          if (roleChanged) App.logAudit("调整成员角色", m.name + " → " + m.role, "角色", "角色与数据范围同步更新", "normal", m.projects[0] || null);
          App.logAudit("更新成员档案", m.name, "成员", "更新部门、席位与项目范围", "normal", m.projects[0] || null);
          if (App.currentUser.id === m.id) App.currentUser = identity || App.currentUser;
          close(); App.refresh(); App.toast("成员已更新", m.name + " → " + m.role + " · " + m.dept, "success");
        });
        var toggle = el.querySelector("#mToggle");
        if (toggle) toggle.addEventListener("click", function () {
          var suspend = m.status !== "suspended";
          App.confirm({ title: suspend ? "停用账号" : "恢复账号", message: suspend ? "停用 " + m.name + " 后，该成员无法登录，但席位仍保留至本计费周期结束。" : "恢复 " + m.name + " 的登录与项目访问？", danger: suspend, okText: suspend ? "确认停用" : "确认恢复" }).then(function (ok) {
            if (!ok) return;
            App.applyMemberStatus(m.id, suspend ? "suspended" : "active");
            App.logAudit(suspend ? "停用成员" : "恢复成员", m.name, "成员", suspend ? "账号已停用" : "账号已恢复", suspend ? "warning" : "normal", null);
            close(); App.refresh(); App.toast(suspend ? "账号已停用" : "账号已恢复", m.name, suspend ? "warn" : "success");
          });
        });
        var remove = el.querySelector("#mRemove");
        if (remove) remove.addEventListener("click", function () {
          if (m.id === App.currentUser.id) { App.toast("不能移除自己", "请先切换到其他管理员身份。", "danger"); return; }
          App.confirm({ title: "移除成员", message: "移除 " + m.name + " 后，该成员立即失去所有项目访问与企业数据。", detail: "审计记录与历史交付物保留；席位在下一计费周期释放。", danger: true, okText: "确认移除" }).then(function (ok) {
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

  function scimSync() {
    var s = st();
    s.security.scim.lastSync = "今天 " + App.nowStamp();
    s.security.scim.synced = s.members.filter(function (m) { return m.source === "scim" || m.source === "sso"; }).length;
    App.logAudit("SCIM 目录同步", s.security.scim.synced + " 名成员", "集成", "从 Okta 同步成员与部门", "normal", null);
    App.refresh();
    App.toast("目录同步完成", s.security.scim.synced + " 名成员已同步。", "success");
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
      UI.pageHead({ eyebrow: "Enterprise · RBAC", title: "角色与权限", desc: "角色定义权限集合与数据范围，成员通过角色获得访问资格。权限变更需要保存后生效。", actions: '<button class="btn btn-primary" data-act="new-role">' + UI.icon("plus") + '新建角色</button>' }) +
      '<div class="grid g4">' + UI.stat({ label: "角色", value: String(s.roles.length), unit: "个", delta: "1 个系统所有者角色" }) +
      UI.stat({ label: "权限项", value: String(s.permissionCatalog.reduce(function (n, g) { return n + g.items.length; }, 0)), unit: "项", delta: "5 个权限组" }) +
      UI.stat({ label: "部门负责人", value: String(roleMembers("r-manager").length), unit: "人", delta: "本部门数据范围" }) +
      UI.stat({ label: "外部访客", value: String(roleMembers("r-guest").length), unit: "人", delta: "项目只读" }) + "</div>" +
      '<div class="perm-layout mt-16"><div class="role-list">' + roleList + "</div>" +
      '<div class="card"><div class="card-head"><div><h3>' + UI.esc(selected.name) + '</h3><div class="ch-sub">' + UI.esc(selected.desc) + '</div></div><div class="row">' + scopeBadge(selected.scope) + (selected.system ? '<span class="badge b-locked">系统角色</span>' : "") + "</div></div><div class=\"card-body\">" +
      (ownerLocked ? '<div class="notice warn">' + UI.icon("lock", 15) + "<span>工作区所有者拥有全部权限，不能在此降级。订阅与账单权随所有者身份固定。</span></div>" : "") +
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
      title: "新建角色", sub: "新角色从空权限开始，保存后在右侧编辑。", body: body,
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

  /* ================= 安全与登录 ================= */
  function securityPage() {
    var s = st(), sec = s.security;
    var checks = s.securityChecks.map(function (c) {
      return '<div class="sec-check-row"><span class="sec-check-main"><b>' + UI.esc(c.label) + '</b><small>' + UI.esc(c.detail) + '</small></span><span class="sec-check-score">' + c.score + "</span>" + UI.statusBadge(c.status) + "</div>";
    }).join("");
    var ipRows = sec.ip.entries.map(function (e) {
      return '<tr><td class="mono">' + UI.esc(e.cidr) + '</td><td>' + UI.esc(e.label) + '</td><td class="tiny muted">' + UI.esc(e.added) + '</td><td><button class="btn btn-xs" data-act="remove-ip" data-cidr="' + UI.esc(e.cidr) + '">移除</button></td></tr>';
    }).join("");
    var ipCard = '<div class="card mt-16"><div class="card-head"><div><h3>IP 允许清单</h3><div class="ch-sub">' + sec.ip.entries.length + ' 个网段 · ' + (sec.ip.enabled ? "强制拦截" : "观察模式") + " · 不在清单内的登录会被记录或阻断</div></div><button class=\"switch " + (sec.ip.enabled ? "on" : "") + '" data-act="toggle-ip" aria-label="启用 IP 限制"><i></i></button></div><div class="card-body tight"><div class="table-wrap"><table><thead><tr><th>网段</th><th>标签</th><th>添加日期</th><th></th></tr></thead><tbody>' + ipRows + '</tbody></table></div><div class="row mt-8"><button class="btn btn-xs" data-act="add-ip">+ 添加网段</button><span class="tiny muted">建议至少保留一个管理员可访问的固定出口网段。</span></div></div></div>';
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Enterprise · Security", title: "安全与登录", desc: "企业身份源、多因素认证、会话边界与下载管控。高风险策略变更会记录审计。", actions: '<button class="btn" data-act="security-report">' + UI.icon("download") + '下载安全报告</button><a class="btn" href="' + App.link("system/audit") + '">审计日志</a>' }) +
      '<div class="grid g4">' + UI.stat({ label: "安全评分", value: "86", unit: "分", delta: "较上月 +4" }) +
      UI.stat({ label: "SSO 覆盖", value: sec.sso.coverage, delta: sec.sso.enforced ? "已强制登录" : "观察模式" }) +
      UI.stat({ label: "MFA 覆盖", value: String(sec.mfa.coverage), unit: "%", delta: sec.mfa.policy === "required" ? "全员强制" : "可选" }) +
      UI.stat({ label: "风险事件", value: "2", unit: "条", delta: "近 7 天 · 均已阻断" }) + "</div>" +
      '<div class="security-grid mt-16"><div class="card"><div class="card-head"><div><h3>安全态势</h3><div class="ch-sub">按控制项评分，点击右侧策略加固</div></div><span class="ring" style="--p:86;--size:52px"><span>86</span></span></div><div class="card-body">' + checks + "</div></div>" +
      '<div class="stack"><div class="card"><div class="card-head"><div><h3>企业 SSO</h3><div class="ch-sub">' + UI.esc(sec.sso.provider) + " · " + UI.esc(sec.sso.protocol) + '</div></div><button class="switch ' + (sec.sso.enforced ? "on" : "") + '" data-act="toggle-sso" aria-label="强制 SSO"><i></i></button></div><div class="card-body">' +
      '<div class="kv"><div class="k">身份源</div><div class="v">' + UI.esc(sec.sso.provider) + '</div><div class="k">企业域名</div><div class="v">' + UI.esc(sec.sso.domain) + " " + UI.badge("已验证", "b-done") + '</div><div class="k">最近同步</div><div class="v">' + UI.esc(sec.sso.lastSync) + '</div><div class="k">登录地址</div><div class="v mono tiny">' + UI.esc(sec.sso.loginUrl) + "</div></div>" +
      '<div class="row mt-16"><button class="btn btn-sm" data-act="test-sso">测试 SSO</button><button class="btn btn-sm btn-ghost" data-act="sync-scim">同步目录</button></div></div></div>' +
      '<div class="card"><div class="card-head"><div><h3>MFA 与恢复</h3><div class="ch-sub">TOTP / WebAuthn · 宽限 ' + sec.mfa.graceDays + ' 天</div></div><button class="switch ' + (sec.mfa.policy === "required" ? "on" : "") + '" data-act="toggle-mfa" aria-label="强制 MFA"><i></i></button></div><div class="card-body">' + UI.progress(sec.mfa.coverage) + '<div class="between mt-8"><span class="tiny muted">覆盖 ' + sec.mfa.coverage + '%</span><span class="tiny muted">强制于 ' + UI.esc(sec.mfa.enforcedAt) + '</span></div><div class="row wrap mt-12">' + sec.mfa.methods.map(function (m) { return '<span class="chip">' + UI.esc(m) + '</span>'; }).join("") + '<button class="btn btn-xs" data-act="reset-recovery">重置恢复码</button></div></div></div></div>' +
      '<div class="stack"><div class="card"><div class="card-head"><div><h3>会话策略</h3><div class="ch-sub">空闲、最长时长与记住登录</div></div></div><div class="card-body"><div class="form-grid"><div class="field"><label>空闲超时（分钟）</label><input class="input" id="sessIdle" type="number" value="' + sec.session.idle + '"></div><div class="field"><label>最长会话（小时）</label><input class="input" id="sessMax" type="number" value="' + sec.session.max + '"></div><div class="field"><label>记住登录（天）</label><input class="input" id="sessRemember" type="number" value="' + sec.session.remember + '"></div><div class="field"><label class="checkline"><input type="checkbox" id="sessSingle"' + (sec.session.singleDevice ? " checked" : "") + "> 单设备登录</label></div></div><button class=\"btn btn-sm mt-12\" data-act=\"save-session\">保存会话策略</button></div></div>" +
      '<div class="card"><div class="card-head"><div><h3>加固建议</h3><div class="ch-sub">按影响与成本排序</div></div></div><div class="card-body"><div class="scope-rule"><span class="badge b-warn">高优先</span><p>将 IP 允许清单从观察模式切换为强制拦截，先加入上海与北京办公出口。</p></div><div class="scope-rule"><span class="badge b-info">中优先</span><p>外部访客 MFA 完成率仅 50%，在邀请流程中要求首次登录绑定 WebAuthn。</p></div><div class="scope-rule"><span class="badge b-teal">已覆盖</span><p>SSO 强制与下载水印已开启，审计保留 180 天符合企业合规要求。</p></div></div></div></div></div>' +
      ipCard +
      '<div class="card mt-16"><div class="card-head"><div><h3>下载与数据防泄漏</h3><div class="ch-sub">外部访客与交付物下载策略</div></div></div><div class="card-body"><div class="setting-toggle-row"><div><b>审阅版水印</b><div class="tiny muted">导出审阅版自动嵌入成员邮箱与时间戳</div></div><button class="switch ' + (sec.dlp.watermark ? "on" : "") + '" data-act="toggle-dlp" data-key="watermark"><i></i></button></div>' +
      '<div class="setting-toggle-row"><div><b>外部下载审批</b><div class="tiny muted">访客下载成片需要管理员审批</div></div><button class="switch ' + (sec.dlp.downloadApproval ? "on" : "") + '" data-act="toggle-dlp" data-key="downloadApproval"><i></i></button></div>' +
      '<div class="setting-toggle-row"><div><b>允许外部分享链接</b><div class="tiny muted">关闭后只能通过工作区登录查看</div></div><button class="switch ' + (sec.dlp.externalShare ? "on" : "") + '" data-act="toggle-dlp" data-key="externalShare"><i></i></button></div></div></div></div>';
  }

  function addIp() {
    var body = '<div class="form-grid"><div class="field"><label>CIDR / IP<span class="req">*</span></label><input class="input" id="ipCidr" placeholder="203.0.113.0/24"><span class="err-msg" id="ipErr">请输入合法网段</span></div><div class="field"><label>标签</label><input class="input" id="ipLabel" placeholder="例如：北京办公室"></div></div>';
    App.modal({
      title: "添加 IP 网段", sub: "仅在启用强制拦截时生效。", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="ipGo">添加</button>',
      onMount: function (el, close) {
        el.querySelector("#ipGo").addEventListener("click", function () {
          var cidr = el.querySelector("#ipCidr").value.trim();
          if (!/^[0-9a-fA-F:./]+$/.test(cidr)) { el.querySelector("#ipErr").classList.add("show"); return; }
          st().security.ip.entries.push({ cidr: cidr, label: el.querySelector("#ipLabel").value.trim() || "自定义网段", added: "今天" });
          App.logAudit("新增 IP 网段", cidr, "安全", "网络边界允许清单更新", "warning", null);
          close(); App.refresh(); App.toast("网段已添加", cidr, "success");
        });
      }
    });
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
    var cats = ["all", "成员", "安全", "角色", "项目", "剧本", "资产", "导出", "集成", "订阅", "工作区", "审计", "审核"];
    var rows = list.map(function (a) {
      return '<tr><td class="mono tiny">' + UI.esc(a.time) + '</td><td><b>' + UI.esc(a.actor) + '</b><span class="t-sub mono">' + UI.esc(a.ip) + '</span></td><td><b>' + UI.esc(a.action) + '</b><span class="t-sub">' + UI.esc(a.target) + '</span></td><td>' + UI.badge(a.category, "b-outline") + '</td><td>' + resultBadge(a.result) + '</td><td>' + riskBadge(a.severity === "critical" ? "high" : a.severity === "warning" ? "medium" : "low") + '</td><td><button class="btn btn-xs" data-act="audit-detail" data-id="' + a.id + '">详情</button></td></tr>';
    }).join("");
    var filterHtml = '<form class="member-toolbar" data-form="audit-search"><label class="filter-search">' + UI.icon("search", 14) + '<input class="input" id="aQuery" value="' + UI.esc(pageState.auditQuery) + '" placeholder="搜索操作人、动作、目标或 IP"></label>' +
      '<select class="select" id="aSeverity" style="width:130px"><option value="all">全部级别</option><option value="normal"' + (pageState.auditSeverity === "normal" ? " selected" : "") + '>常规</option><option value="warning"' + (pageState.auditSeverity === "warning" ? " selected" : "") + '>警告</option><option value="critical"' + (pageState.auditSeverity === "critical" ? " selected" : "") + '>高风险</option></select><button class="btn btn-sm" type="submit">筛选</button></form>' +
      '<div class="row wrap mt-8">' + cats.map(function (c) { return '<button class="chip' + (pageState.auditCategory === c ? " on" : "") + '" data-act="afilter" data-key="' + c + '">' + (c === "all" ? "全部" : c) + "</button>"; }).join("") + "</div>";
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Enterprise · Audit", title: "审计与合规", desc: "企业级审计覆盖登录、权限、成员、项目、导出与集成。审计按数据范围过滤，保留 " + s.workspace.dataRetention + " 天。", actions: '<button class="btn" data-act="export-audit">' + UI.icon("download") + '导出 CSV</button><button class="btn" data-act="audit-config">审计设置</button>' }) +
      '<div class="grid g4">' + UI.stat({ label: "可见事件", value: String(scoped.length), unit: "条", delta: "全部审计 " + s.audit.length + " 条" }) +
      UI.stat({ label: "高风险", value: String(critical), unit: "条", delta: "异常登录与账号停用" }) +
      UI.stat({ label: "权限变更", value: String(roleChanges), unit: "条", delta: "角色与成员调整" }) +
      UI.stat({ label: "保留周期", value: String(s.workspace.dataRetention), unit: "天", delta: "到期自动归档" }) + "</div>" +
      '<div class="card mt-16"><div class="card-head"><div><h3>审计事件</h3><div class="ch-sub">按时间倒序 · 当前范围：' + App.scopeLabel(App.currentUser.scope) + '</div></div><span class="tag">' + list.length + ' 条</span></div><div class="card-body">' + filterHtml +
      (rows ? '<div class="table-wrap mt-12"><table class="audit-table"><thead><tr><th>时间</th><th>操作人 / IP</th><th>动作 / 目标</th><th>分类</th><th>结果</th><th>级别</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>" : UI.empty("没有匹配审计事件", "调整关键词、分类或级别。")) + "</div></div></div>";
  }

  function auditDrawer(id) {
    var a = st().audit.filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    var body = '<div class="account-head">' + UI.avatar(a.actor, "lg") + '<div><div class="account-name">' + UI.esc(a.action) + '</div><div class="small muted">' + UI.esc(a.actor) + " · " + UI.esc(a.time) + '</div></div></div>' +
      '<div class="kv"><div class="k">事件 ID</div><div class="v mono">' + UI.esc(a.id) + '</div><div class="k">分类</div><div class="v">' + UI.esc(a.category) + '</div><div class="k">目标</div><div class="v">' + UI.esc(a.target) + '</div><div class="k">结果</div><div class="v">' + resultBadge(a.result) + '</div><div class="k">级别</div><div class="v">' + riskBadge(a.severity === "critical" ? "high" : a.severity === "warning" ? "medium" : "low") + '</div><div class="k">来源 IP</div><div class="v mono">' + UI.esc(a.ip) + '</div><div class="k">部门</div><div class="v">' + UI.esc(deptById(a.deptId) ? deptById(a.deptId).name : "—") + '</div><div class="k">项目</div><div class="v">' + UI.esc(a.projectId ? projectName(a.projectId) : "工作区级") + '</div></div><div class="notice info mt-16"><b>事件详情</b><br>' + UI.esc(a.detail) + "</div>";
    App.drawer({ eyebrow: "Audit event", title: a.action, sub: a.id + " · " + a.time, body: body, footer: '<button class="btn" data-close>关闭</button>' });
  }

  function exportAudit() {
    var rows = auditRows();
    var csv = "\uFEFF时间,操作人,动作,目标,分类,结果,级别,IP,详情\n" + rows.map(function (a) {
      return [a.time, a.actor, a.action, a.target, a.category, a.result, a.severity, a.ip, a.detail].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\n");
    App.download("changye_audit_" + Date.now() + ".csv", csv, "text/csv;charset=utf-8");
    App.toast("审计已导出", rows.length + " 条事件 · CSV", "success");
  }

  /* ================= 集成与 API ================= */
  function integrationsPage() {
    var s = st();
    var ints = s.integrations.map(function (it) {
      return '<div class="int-card"><div class="int-top"><span class="int-logo ' + UI.esc(it.color) + '">' + UI.esc(it.initial) + '</span><span class="int-status">' + UI.statusBadge(it.status === "connected" ? "connected" : "unconfigured") + '</span></div>' +
        '<div class="int-name">' + UI.esc(it.name) + '</div><div class="int-desc">' + UI.esc(it.desc) + '</div><div class="int-meta">' + UI.esc(it.meta) + "</div>" +
        '<div class="between mt-12"><span class="tiny muted">' + UI.esc(it.lastSync) + '</span><button class="btn btn-xs" data-act="test-int" data-id="' + it.id + '">' + (it.status === "connected" ? "测试" : "连接") + "</button></div></div>";
    }).join("");
    var keys = s.apiKeys.map(function (k) {
      return '<tr><td><b>' + UI.esc(k.name) + '</b><span class="t-sub mono">' + UI.esc(k.prefix) + '…</span></td><td>' + k.scopes.map(function (p) { return '<span class="chip">' + UI.esc(p) + "</span>"; }).join(" ") + '</td><td>' + UI.esc(k.owner) + '</td><td class="tiny muted">' + UI.esc(k.lastUsed) + '</td><td>' + UI.statusBadge(k.status === "active" ? "active" : "locked", k.status === "active" ? "启用" : "已撤销") + '</td><td class="cell-actions"><button class="btn btn-xs" data-act="rotate-key" data-id="' + k.id + '"' + (k.status === "revoked" ? " disabled" : "") + '>轮换</button><button class="btn btn-xs btn-danger" data-act="revoke-key" data-id="' + k.id + '"' + (k.status === "revoked" ? " disabled" : "") + ">撤销</button></td></tr>";
    }).join("");
    var models = s.models.map(function (m, i) {
      return '<div class="model-row"><span><b>' + UI.esc(m.name) + '</b><span class="t-sub">' + UI.esc(m.cap) + '</span></span><span class="m-ver tiny muted">' + UI.esc(m.version) + '</span><span class="m-lat tiny muted">' + UI.esc(m.latency) + '</span><span class="row" style="justify-content:flex-end;gap:4px">' + UI.statusBadge(m.status === "已连接" ? "connected" : "unconfigured") + '<button class="btn btn-xs" data-act="test-model" data-i="' + i + '">测试</button><button class="btn btn-xs" data-act="config-model" data-i="' + i + '">配置</button></span></div>';
    }).join("");
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Enterprise · Integrations", title: "集成与 API", desc: "身份、协作、存储和模型接入。API Key 按最小权限签发，轮换与撤销立即生效。", actions: '<button class="btn btn-primary" data-act="add-key">' + UI.icon("plus") + '新建 API Key</button>' }) +
      '<div class="grid g4">' + UI.stat({ label: "已连接", value: String(s.integrations.filter(function (i) { return i.status === "connected"; }).length), unit: "个", delta: "共 " + s.integrations.length + " 个集成" }) +
      UI.stat({ label: "API Key", value: String(s.apiKeys.filter(function (k) { return k.status === "active"; }).length), unit: "个", delta: "1 个已撤销" }) +
      UI.stat({ label: "Webhook", value: "3", unit: "个", delta: "签名校验已开启" }) +
      UI.stat({ label: "最近同步", value: "09:42", delta: "SCIM / SSO" }) + "</div>" +
      '<div class="int-grid mt-16">' + ints + "</div>" +
      '<div class="grid g-2-1 mt-16"><div class="card"><div class="card-head"><div><h3>API Key</h3><div class="ch-sub">按作用域签发 · 前端只展示前缀</div></div><span class="tag">' + s.apiKeys.length + "</span></div><div class=\"card-body tight\"><div class=\"table-wrap\"><table><thead><tr><th>名称 / 前缀</th><th>作用域</th><th>负责人</th><th>最近使用</th><th>状态</th><th></th></tr></thead><tbody>" + keys + "</tbody></table></div></div></div>" +
      '<div class="stack"><div class="card"><div class="card-head"><div><h3>Webhook 订阅</h3><div class="ch-sub">交付与任务状态回调</div></div><button class="btn btn-xs" data-act="test-webhook">发送测试</button></div><div class="card-body tight">' +
      [["https://client.changye.cn/hooks/export", "export.completed", "成功 214 次"], ["https://ops.changye.cn/hooks/task", "task.failed", "成功 86 次"], ["https://feishu.cn/open-apis/bot/v2/hook/…", "review.approved", "成功 42 次"]].map(function (w) {
        return '<div class="list-row"><span class="lr-main"><span class="lr-title mono tiny">' + UI.esc(w[0]) + '</span><span class="lr-sub">' + UI.esc(w[1]) + " · " + UI.esc(w[2]) + '</span></span><span class="dot on"></span></div>';
      }).join("") + "</div></div>" +
      '<div class="card"><div class="card-head"><div><h3>策略提示</h3><div class="ch-sub">企业集成的最小权限原则</div></div></div><div class="card-body"><div class="notice info">' + UI.icon("lock", 15) + "<span>生产 Key 不应授予 member:manage 或 billing:manage；外部回调使用单独 Key 并限制 IP。</span></div><div class=\"tiny muted mt-12\">上次安全扫描：今天 09:50 · 未发现泄露</div></div></div></div></div>" +
      '<div class="card mt-16"><div class="card-head"><div><h3>模型接入</h3><div class="ch-sub">文本、图像、视频、语音与质检</div></div><button class="btn btn-sm" data-act="add-model">' + UI.icon("plus") + '新增接入</button></div><div class="card-body tight">' + models + "</div></div></div>";
  }

  function addApiKey() {
    var body = '<div class="form-grid"><div class="field span2"><label>Key 名称<span class="req">*</span></label><input class="input" id="akName" placeholder="例如：客户交付回调"><span class="err-msg" id="akErr">请填写名称</span></div>' +
      '<div class="field span2"><label>作用域</label><div class="row wrap">' + ["project:read", "task:run", "export:read", "qa:read"].map(function (p) { return '<label class="checkline"><input type="checkbox" data-kscope value="' + p + '"> ' + p + "</label>"; }).join("") + "</div></div></div>" +
      '<div class="notice warn mt-12">' + UI.icon("lock", 15) + "<span>Key 只在创建时展示一次。原型会立即写入列表，但不会生成真实密钥。</span></div>";
    App.modal({
      title: "新建 API Key", sub: "最小作用域 · 负责人为当前身份", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="akGo">创建 Key</button>',
      onMount: function (el, close) {
        el.querySelector("#akGo").addEventListener("click", function () {
          var name = el.querySelector("#akName").value.trim();
          if (!name) { el.querySelector("#akErr").classList.add("show"); return; }
          var scopes = [];
          el.querySelectorAll("[data-kscope]").forEach(function (cb) { if (cb.checked) scopes.push(cb.value); });
          if (!scopes.length) { App.toast("缺少作用域", "至少选择一个作用域。", "danger"); return; }
          st().apiKeys.unshift({ id: "key-" + Date.now(), name: name, prefix: "sp_live_" + Math.random().toString(16).slice(2, 6), scopes: scopes, owner: App.currentUser.name, created: "今天", lastUsed: "—", status: "active" });
          App.logAudit("创建 API Key", name, "集成", "作用域：" + scopes.join(", "), "high", null);
          close(); App.refresh(); App.toast("API Key 已创建", name + " · " + scopes.length + " 个作用域", "success");
        });
      }
    });
  }

  /* ================= 订阅与账单 ================= */
  function billingPage() {
    var s = st(), b = s.billing, seats = App.seatStats();
    var invoices = b.invoices.map(function (i) {
      return '<tr><td class="mono">' + UI.esc(i.id) + '</td><td>' + UI.esc(i.period) + '</td><td class="num-cell">' + App.formatMoney(i.amount) + '</td><td>' + UI.statusBadge(i.status === "paid" ? "done" : "pending", i.status === "paid" ? "已支付" : "待支付") + '</td><td class="tiny muted">' + UI.esc(i.issued) + '</td><td><button class="btn btn-xs" data-act="download-invoice" data-id="' + i.id + '">下载</button></td></tr>';
    }).join("");
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Enterprise · Billing", title: "订阅与账单", desc: "企业版按年计费，席位与 AI 用量分开结算。仅工作区所有者可修改付款方式与增购席位。", actions: '<button class="btn btn-primary" data-act="buy-seats">' + UI.icon("plus") + '增购席位</button><button class="btn" data-act="payment">更新付款方式</button>' }) +
      '<div class="grid g4">' + UI.stat({ label: "当前套餐", value: s.workspace.planName, delta: b.cycle + " · 合同至 " + b.renewal }) +
      UI.stat({ label: "年费", value: fmt(b.amount), unit: "元", delta: b.seatsPurchased + " 席 · ¥" + b.unitPrice + "/席" }) +
      UI.stat({ label: "已用席位", value: String(seats.total), unit: "/ " + seats.purchased, delta: seats.available + " 席可分配" }) +
      UI.stat({ label: "本月 AI 用量", value: fmt(s.usage.spent), unit: "元", delta: "预算 " + fmt(s.usage.budget) + " · " + Math.round(s.usage.spent / s.usage.budget * 100) + "%" }) + "</div>" +
      '<div class="grid g-2-1 mt-16"><div class="stack"><div class="card"><div class="card-head"><div><h3>企业版订阅</h3><div class="ch-sub">2026-07-01 起 · 到期自动续费</div></div><span class="badge b-teal">自动续费</span></div><div class="card-body"><div class="plan-summary"><div><div class="plan-name">长夜影视 · 企业版</div><div class="plan-price">' + App.formatMoney(b.amount) + '<small>/ 年</small></div><div class="tiny muted">合同编号 ENT-2026-0718 · 税号 ' + UI.esc(b.taxId) + "</div></div><div class=\"plan-seats\"><div class=\"big\">" + seats.total + "</div><div class=\"tiny muted\">已用 / " + seats.purchased + ' 席</div></div></div>' +
      '<div class="between mt-16"><span class="tiny muted">席位使用</span><span class="mono tiny">' + Math.round(seats.total / seats.purchased * 100) + '%</span></div>' + UI.progress(Math.round(seats.total / seats.purchased * 100)) +
      '<div class="seat-breakdown mt-12"><span>企业席位 ' + (seats.total - seats.guests) + '</span><span>访客 ' + seats.guests + '</span><span>待接受 ' + seats.invited + '</span><span>已停用 ' + seats.suspended + "</span></div></div></div>" +
      '<div class="card"><div class="card-head"><div><h3>发票记录</h3><div class="ch-sub">电子发票 · 下载后可用于报销</div></div></div><div class="card-body tight"><div class="table-wrap"><table><thead><tr><th>发票号</th><th>服务周期</th><th>金额</th><th>状态</th><th>开具日期</th><th></th></tr></thead><tbody>' + invoices + "</tbody></table></div></div></div></div>" +
      '<div class="stack"><div class="card"><div class="card-head"><div><h3>付款与账单联系人</h3><div class="ch-sub">企业银行转账</div></div><button class="btn btn-xs" data-act="payment">编辑</button></div><div class="card-body"><div class="kv"><div class="k">付款方式</div><div class="v">' + UI.esc(b.method) + '</div><div class="k">账单联系人</div><div class="v">' + UI.esc(b.contact) + '</div><div class="k">发票抬头</div><div class="v">' + UI.esc(b.invoiceTitle) + '</div><div class="k">税号</div><div class="v mono">' + UI.esc(b.taxId) + "</div></div></div></div>" +
      '<div class="card"><div class="card-head"><div><h3>席位分布</h3><div class="ch-sub">按部门统计</div></div></div><div class="card-body">' + deptSeatRows() + "</div></div>" +
      '<div class="card"><div class="card-head"><div><h3>AI 用量</h3><div class="ch-sub">本月按能力拆分</div></div><a class="btn btn-xs" href="' + App.link("system/settings") + '">预算</a></div><div class="card-body">' + usageBars() + "</div></div></div></div></div>";
  }

  function deptSeatRows() {
    return st().departments.filter(function (d) { return d.parent !== null; }).map(function (d) {
      var n = deptMembers(d.id).length;
      return '<div class="role-dist-row"><span class="rd-name">' + UI.esc(d.name) + '</span><div class="progress thin"><i style="width:' + Math.round(n / Math.max(1, st().members.length) * 100) + '%"></i></div><span class="mono tiny">' + n + "</span></div>";
    }).join("");
  }

  function usageBars() {
    var u = st().usage;
    var days = [214, 386, 302, 640, 812, 468, 286, 510, 420, 360, 580, 720, 390, 286];
    var max = Math.max.apply(null, days);
    return '<div class="between"><span class="tiny muted">已用 ' + App.formatMoney(u.spent) + '</span><span class="tiny muted">预算 ' + App.formatMoney(u.budget) + " · " + Math.round(u.spent / u.budget * 100) + "%</span></div>" + UI.progress(Math.round(u.spent / u.budget * 100)) +
      '<div class="budget-bar mt-16">' + u.byCap.map(function (c) { return '<div class="budget-row"><span>' + c[0] + '</span><div class="progress thin"><i style="width:' + c[2] + '%"></i></div><span class="mono tiny">¥' + fmt(c[1]) + "</span></div>"; }).join("") + "</div>" +
      '<div class="bars mt-16">' + days.map(function (d) { return '<div class="bar" title="¥' + d + '"><i style="height:' + Math.round(d / max * 100) + '%"></i></div>'; }).join("") + "</div>";
  }

  function buySeats() {
    var s = st();
    var body = '<div class="form-grid"><div class="field"><label>增购席位</label><input class="input" id="bsCount" type="number" min="1" max="30" value="4"></div><div class="field"><label>单价</label><input class="input" value="¥' + s.billing.unitPrice + ' / 席 / 年" disabled></div>' +
      '<div class="field span2"><div class="notice info">' + UI.icon("alert", 15) + "<span>按年付比例计费；席位立即生效，可用于邀请成员或增加访客。</span></div></div></div>";
    App.modal({
      title: "增购席位", sub: "当前 " + App.seatStats().total + " / " + s.workspace.seatsPurchased + " 席", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="bsGo">确认增购</button>',
      onMount: function (el, close) {
        el.querySelector("#bsGo").addEventListener("click", function () {
          var n = Number(el.querySelector("#bsCount").value);
          if (!n || n < 1) { App.toast("数量无效", "请填写至少 1 席。", "danger"); return; }
          s.workspace.seatsPurchased += n;
          s.billing.seatsPurchased = s.workspace.seatsPurchased;
          s.billing.amount = s.workspace.seatsPurchased * s.billing.unitPrice;
          App.logAudit("增购席位", "+ " + n + " 席", "订阅", "席位总数 " + s.workspace.seatsPurchased, "high", null);
          close(); App.refresh(); App.toast("席位已增购", "+" + n + " 席 · 年费 " + App.formatMoney(s.billing.amount), "success");
        });
      }
    });
  }

  function paymentModal() {
    var b = st().billing;
    var body = '<div class="form-grid"><div class="field span2"><label>付款方式</label><input class="input" id="pmMethod" value="' + UI.esc(b.method) + '"></div><div class="field span2"><label>账单联系人</label><input class="input" id="pmContact" value="' + UI.esc(b.contact) + '"></div><div class="field"><label>发票抬头</label><input class="input" id="pmTitle" value="' + UI.esc(b.invoiceTitle) + '"></div><div class="field"><label>税号</label><input class="input" id="pmTax" value="' + UI.esc(b.taxId) + '"></div></div>';
    App.modal({
      title: "更新付款方式", sub: "仅影响后续账单与发票。", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="pmGo">保存</button>',
      onMount: function (el, close) {
        el.querySelector("#pmGo").addEventListener("click", function () {
          b.method = el.querySelector("#pmMethod").value.trim();
          b.contact = el.querySelector("#pmContact").value.trim();
          b.invoiceTitle = el.querySelector("#pmTitle").value.trim();
          b.taxId = el.querySelector("#pmTax").value.trim();
          App.logAudit("更新付款信息", b.contact, "订阅", "付款方式与发票抬头更新", "warning", null);
          close(); App.refresh(); App.toast("付款信息已更新", b.method, "success");
        });
      }
    });
  }

  function downloadInvoice(id) {
    var i = st().billing.invoices.filter(function (x) { return x.id === id; })[0];
    if (!i) return;
    var text = "长夜影视文化传媒有限公司\n电子发票\n\n发票号：" + i.id + "\n服务周期：" + i.period + "\n金额：" + App.formatMoney(i.amount) + "\n状态：" + i.status + "\n开具日期：" + i.issued + "\n说明：" + i.note + "\n\n本文件由静态原型生成，仅用于演示。";
    App.download(i.id + ".txt", text, "text/plain;charset=utf-8");
    App.toast("发票已下载", i.id + " · " + App.formatMoney(i.amount), "success");
  }

  /* ================= 工作区设置 ================= */
  function workspacePage() {
    var s = st();
    var sections = [["general", "工作区信息"], ["project", "项目默认"], ["notify", "通知策略"], ["data", "数据与演示"], ["danger", "危险操作"]];
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Enterprise · Workspace", title: "工作区设置", desc: "工作区名称、区域、项目默认与数据保留。设置只保存在内存，刷新恢复演示初始值。", actions: '<button class="btn" data-act="export-workspace">' + UI.icon("download") + '导出工作区状态</button>' }) +
      '<div class="settings-layout"><div class="settings-nav">' + sections.map(function (x) {
        return '<button class="' + (workspaceSection === x[0] ? "active" : "") + '" data-act="ws-section" data-key="' + x[0] + '">' + x[1] + "</button>";
      }).join("") + '</div><div>' + workspacePanel() + "</div></div></div>";
  }

  function workspacePanel() {
    var w = st().workspace;
    if (workspaceSection === "general") {
      return '<div class="card"><div class="card-head"><div><h3>工作区信息</h3><div class="ch-sub">企业名称、域名与区域决定登录与数据驻留</div></div><span class="badge b-teal">企业版</span></div><div class="card-body">' +
        '<div class="form-grid"><div class="field"><label>工作区名称</label><input class="input" id="wsName" value="' + UI.esc(w.name) + '"></div><div class="field"><label>企业主体</label><input class="input" id="wsLegal" value="' + UI.esc(w.legalName) + '"></div>' +
        '<div class="field"><label>企业域名</label><div class="row"><input class="input" id="wsDomain" value="' + UI.esc(w.domain) + '" disabled>' + UI.badge("已验证", "b-done") + "</div></div>" +
        '<div class="field"><label>数据区域</label><select class="select" id="wsRegion"><option' + (w.region.indexOf("上海") > -1 ? " selected" : "") + ">中国大陆 · 上海</option><option>中国大陆 · 北京</option><option>新加坡</option><option>欧洲 · 法兰克福</option></select></div>" +
        '<div class="field"><label>时区</label><input class="input" id="wsTz" value="' + UI.esc(w.timezone) + '"></div><div class="field"><label>语言</label><select class="select" id="wsLocale"><option value="zh-CN"' + (w.locale === "zh-CN" ? " selected" : "") + '>简体中文</option><option value="en-US"' + (w.locale === "en-US" ? " selected" : "") + ">English</option></select></div></div>" +
        '<div class="row mt-16"><button class="btn btn-primary" data-act="save-workspace">保存工作区</button><span class="tiny muted">创建于 ' + UI.esc(w.createdAt) + " · 合同至 " + UI.esc(w.contractEnd) + "</span></div></div></div>";
    }
    if (workspaceSection === "project") {
      return '<div class="card"><div class="card-head"><div><h3>项目默认</h3><div class="ch-sub">新建项目时应用的模板与生成模型</div></div></div><div class="card-body"><div class="form-grid">' +
        '<div class="field"><label>默认模板</label><select class="select" id="wTemplate"><option' + (w.defaultTemplate.indexOf("12") > -1 ? " selected" : "") + ">竖屏短剧 · 12 集</option><option>横屏短片 · 6 集</option><option>品牌定制 · 8 集</option></select></div>" +
        '<div class="field"><label>默认视频模型</label><select class="select" id="wModel">' + st().models.map(function (m) { return '<option' + (m.name === w.defaultModel ? " selected" : "") + ">" + UI.esc(m.name) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field span2"><label class="checkline"><input type="checkbox" id="wApproval"' + (w.requireProjectApproval ? " checked" : "") + "> 新建项目需要管理员审批</label><label class=\"checkline\"><input type=\"checkbox\" id=\"wGuest\"" + (w.allowGuests ? " checked" : "") + "> 允许外部访客加入项目</label></div></div>" +
        '<button class="btn btn-primary mt-16" data-act="save-project-defaults">保存项目默认</button></div></div>';
    }
    if (workspaceSection === "notify") {
      return '<div class="card"><div class="card-head"><div><h3>通知策略</h3><div class="ch-sub">站内信、邮件与治理摘要</div></div></div><div class="card-body">' + (w.notifications || []).map(function (n) {
        return '<div class="setting-toggle-row"><div><b>' + UI.esc(n.label) + '</b><div class="tiny muted">' + UI.esc(n.desc) + '</div></div><button class="switch ' + (n.on ? "on" : "") + '" data-act="toggle-ws" data-key="' + n.key + '"><i></i></button></div>';
      }).join("") + "</div></div>";
    }
    if (workspaceSection === "data") {
      return '<div class="card"><div class="card-head"><div><h3>数据与演示</h3><div class="ch-sub">审计保留、状态导出与重置</div></div></div><div class="card-body"><div class="kv"><div class="k">存储</div><div class="v">纯内存 · 无 localStorage</div><div class="k">审计保留</div><div class="v">' + w.dataRetention + ' 天</div><div class="k">状态规模</div><div class="v">' + st().members.length + " 成员 / " + st().audit.length + " 审计</div></div>" +
        '<div class="field mt-16" style="max-width:220px"><label>审计保留（天）</label><input class="input" id="wRetention" type="number" value="' + w.dataRetention + '"></div><div class="row mt-12"><button class="btn" data-act="save-retention">保存保留周期</button><button class="btn" data-act="export-workspace">导出状态</button><button class="btn btn-soft" data-act="reset-workspace">重置演示</button></div></div></div>';
    }
    return '<div class="card" style="border-color:#f0cfc9"><div class="card-head"><div><h3 style="color:#8c332b">危险操作</h3><div class="ch-sub">不可逆 · 需二次确认</div></div></div><div class="card-body">' +
      '<div class="between" style="padding:10px 0"><div><b class="small">转移工作区所有权</b><div class="tiny muted">将企业治理与订阅付款转交给另一名管理员。</div></div><button class="btn btn-sm btn-danger" data-act="transfer">转移</button></div>' +
      '<div class="between" style="padding:10px 0;border-top:1px solid #eee9df"><div><b class="small">删除工作区</b><div class="tiny muted">原型只演示确认流程，不会真实删除数据。</div></div><button class="btn btn-sm btn-danger" data-act="delete-workspace">删除</button></div></div></div>';
  }

  /* ================= 项目设置（沿用项目级能力） ================= */
  function projectSettingsPage() {
    var s = st();
    var sections = [["info", "项目信息"], ["models", "模型接入"], ["cost", "用量与预算"], ["notify", "通知"], ["team", "团队"], ["demo", "演示数据"], ["danger", "危险操作"]];
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Settings · NYJM-26", title: "项目设置", desc: "项目信息、模型接入、预算与通知。设置只保存在内存，刷新恢复演示初始值。", actions: '<button class="btn" data-act="state">' + UI.icon("download") + '导出项目状态</button><a class="btn" href="' + App.link("system/members") + '">成员与席位</a>' }) +
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
    var list = st().models;
    return '<div class="card"><div class="card-head"><div><h3>模型接入</h3><div class="ch-sub">文本、图像、视频、语音与质检</div></div><button class="btn btn-sm" data-act="add-model">' + UI.icon("plus") + '新增接入</button></div><div class="card-body tight">' +
      list.map(function (m, i) {
        return '<div class="model-row"><span><b>' + UI.esc(m.name) + '</b><span class="t-sub">' + UI.esc(m.cap) + '</span></span><span class="m-ver tiny muted">' + UI.esc(m.version) + '</span><span class="m-lat tiny muted">' + UI.esc(m.latency) + "</span>" +
          '<span class="row" style="justify-content:flex-end;gap:4px">' + UI.statusBadge(m.status) + '<button class="btn btn-xs" data-act="test-model" data-i="' + i + '">测试</button><button class="btn btn-xs" data-act="config-model" data-i="' + i + '">' + (m.status === "未配置" ? "去配置" : "配置") + "</button></span></div>";
      }).join("") + "</div></div>" +
      '<div class="card mt-16"><div class="card-head"><h3>默认模型</h3><span class="tiny muted">新建任务时使用</span></div><div class="card-body"><div class="grid g2">' +
      ["文本生成", "图像生成", "视频生成", "语音合成"].map(function (cap) {
        var opts = list.filter(function (m) { return m.cap === cap; });
        return '<div class="field"><label>' + cap + '</label><select class="select">' + opts.map(function (m) { return "<option>" + UI.esc(m.name) + "</option>"; }).join("") + "</select></div>";
      }).join("") + "</div></div></div>";
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
      '<div class="card mt-16"><div class="card-head"><h3>预算提醒</h3></div><div class="card-body"><div class="field"><label>月度预算</label><div class="row"><input class="input" style="max-width:160px" value="' + usage.budget + '"><span class="tiny muted">元 / 月</span></div></div>' +
      '<div class="row mt-12"><label class="checkline"><input type="checkbox" checked> 达到 80% 时通知项目所有者</label><label class="checkline"><input type="checkbox" checked> 达到 100% 时暂停生成任务</label></div></div></div>';
  }

  function notifyPanel() {
    return '<div class="card"><div class="card-head"><div><h3>项目通知</h3><div class="ch-sub">站内信 · 邮件 · 失败提醒</div></div></div><div class="card-body">' +
      [["任务失败", "立即通知任务创建者与项目所有者", true], ["成片待审核", "审核任务到达时通知导演", true], ["成员邀请", "邀请发送与接受时通知", true], ["每周用量摘要", "每周一 09:00 发送邮件", false], ["导出完成", "交付完成后通知客户", true]].map(function (n) {
        return '<div class="between" style="padding:11px 0;border-bottom:1px solid #eee9df"><div><b class="small">' + n[0] + '</b><div class="tiny muted">' + n[1] + '</div></div><button class="switch ' + (n[2] ? "on" : "") + '" data-act="toggle" aria-label="切换通知"><i></i></button></div>';
      }).join("") + "</div></div>";
  }

  function teamPanel() {
    var seats = App.seatStats();
    return '<div class="card"><div class="card-head"><div><h3>项目团队</h3><div class="ch-sub">' + seats.total + " 名企业成员 · " + seats.guests + " 名访客</div></div><a class=\"btn btn-sm\" href=\"" + App.link("system/members") + "\">成员与席位</a></div><div class=\"card-body tight\">" +
      st().members.slice(0, 6).map(function (m) {
        return '<div class="list-row">' + UI.avatar(m.name, "sm", m.color) + '<span class="lr-main"><span class="lr-title">' + UI.esc(m.name) + '</span><span class="lr-sub">' + UI.esc(m.email) + " · " + UI.esc(m.role) + '</span></span>' + statusBadge(m) + "</div>";
      }).join("") + '<div class="tiny muted mt-8">仅展示前 6 位成员，完整目录请进入「成员与席位」。</div></div></div>';
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
    var body = '<div class="form-grid"><div class="field span2"><label>模型名称</label><input class="input" value="' + UI.esc(m.name) + '" disabled></div><div class="field"><label>能力</label><input class="input" value="' + UI.esc(m.cap) + '" disabled></div><div class="field"><label>API Base</label><input class="input" value="https://api.mork.local/v1"></div>' +
      '<div class="field span2"><label>密钥</label><input class="input" type="password" value="demo-key-2026"><span class="hint">原型不保存密钥，也不发起真实请求。</span></div></div>' +
      '<div class="notice info mt-12">' + UI.icon("lock", 15) + "<span>离线演示环境不会连接 provider；测试只改变连接状态。</span></div>";
    App.modal({
      title: "配置 " + m.name, sub: m.cap + " · " + m.version, body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="cfgGo">保存并测试</button>',
      onMount: function (el, close) {
        el.querySelector("#cfgGo").addEventListener("click", function () {
          m.status = "已连接"; m.def = true; App.logAudit("配置模型接入", m.name, "集成", m.cap + " · " + m.version, "normal", null); close(); App.refresh(); App.toast("配置已保存", m.name + " 已连接。", "success");
        });
      }
    });
  }

  function addModel() {
    var body = '<div class="form-grid"><div class="field"><label>能力</label><select class="select" id="amCap"><option>文本生成</option><option>图像生成</option><option>视频生成</option><option>语音合成</option><option>质检</option></select></div>' +
      '<div class="field"><label>模型名称</label><input class="input" id="amName" placeholder="例如：local-video-3"></div>' +
      '<div class="field span2"><label>API Base</label><input class="input" value="https://api.local/v1"></div></div><div class="notice info mt-12">新增接入会先进入「未配置」，测试成功后变为「已连接」。</div>';
    App.modal({
      title: "新增模型接入", sub: "离线环境只维护配置记录", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="amGo">保存</button>',
      onMount: function (el, close) {
        el.querySelector("#amGo").addEventListener("click", function () {
          var name = el.querySelector("#amName").value.trim(); if (!name) { App.toast("缺少名称", "请填写模型名称。", "danger"); return; }
          st().models.push({ name: name, cap: el.querySelector("#amCap").value, version: "—", status: "未配置", latency: "—", cost: "—", def: false });
          close(); App.refresh(); App.toast("已新增", name + " 等待配置。", "success");
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
    var s = st();
    var lines = ["长夜影视 · 企业安全报告", "生成时间：" + new Date().toLocaleString("zh-CN"), "安全评分：86 / 100", ""];
    s.securityChecks.forEach(function (c) { lines.push("- " + c.label + "：" + c.score + " 分 · " + c.detail); });
    lines.push("", "SSO：" + s.security.sso.provider + " · " + (s.security.sso.enforced ? "已强制" : "观察模式"));
    lines.push("MFA 覆盖：" + s.security.mfa.coverage + "%");
    lines.push("IP 白名单：" + s.security.ip.entries.length + " 个网段 · " + (s.security.ip.enabled ? "强制" : "观察"));
    App.download("changye_security_report.txt", lines.join("\n"), "text/plain;charset=utf-8");
    App.toast("安全报告已下载", "包含 7 项控制评分与策略状态。", "success");
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
      scim: scimSync,
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
    group: "system", label: "企业系统", icon: "sliders",
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
      { path: "system/members", title: "成员与席位", icon: "users", render: membersPage, mount: memberPageMount },
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
      { path: "system/security", title: "安全与登录", icon: "lock", render: securityPage,
        mount: function (root) {
          bindPage(root, {
            "toggle-sso": function (b) {
              var s = st(); var target = !s.security.sso.enforced;
              App.confirm({ title: target ? "强制企业 SSO" : "关闭 SSO 强制", message: target ? "未通过 Okta 登录的成员将被拒绝访问。" : "成员可使用邮箱密码登录，安全评分会下降。", danger: !target, okText: "确认变更" }).then(function (ok) {
                if (!ok) return;
                s.security.sso.enforced = target;
                App.logAudit(target ? "启用 SSO 强制登录" : "关闭 SSO 强制登录", "studio.cn", "安全", "企业登录策略变更", "high", null);
                App.refresh(); App.toast("SSO 策略已更新", target ? "已强制企业登录" : "已切换为观察模式", target ? "success" : "warn");
              });
            },
            "test-sso": function (b) {
              var old = b.textContent; b.disabled = true; b.textContent = "测试中…";
              setTimeout(function () { b.disabled = false; b.textContent = old; st().security.sso.lastSync = "今天 " + App.nowStamp(); App.logAudit("测试 SSO 连接", st().security.sso.provider, "安全", "SAML 断言校验通过", "normal", null); App.refresh(); App.toast("SSO 连接正常", "SAML 断言与属性映射通过。", "success"); }, 900);
            },
            "sync-scim": scimSync,
            "toggle-mfa": function (b) {
              var s = st(); s.security.mfa.policy = s.security.mfa.policy === "required" ? "optional" : "required";
              App.logAudit("更新 MFA 策略", s.security.mfa.policy === "required" ? "全员强制" : "可选", "安全", "MFA 策略变更", "high", null);
              App.refresh(); App.toast("MFA 策略已更新", s.security.mfa.policy === "required" ? "全员强制" : "仅建议启用", "success");
            },
            "reset-recovery": function () {
              App.confirm({ title: "重置恢复码", message: "重新生成 10 组一次性恢复码，旧码立即失效。", detail: "新恢复码只在原型中演示，不会真实展示。", danger: true, okText: "确认重置" }).then(function (ok) {
                if (!ok) return;
                App.logAudit("重置恢复码", "工作区所有者", "安全", "一次性恢复码已重新生成", "warning", null);
                App.toast("恢复码已重置", "旧恢复码已全部失效。", "success");
              });
            },
            "save-session": function () {
              var sec = st().security.session;
              sec.idle = Number(document.getElementById("sessIdle").value) || 30;
              sec.max = Number(document.getElementById("sessMax").value) || 12;
              sec.remember = Number(document.getElementById("sessRemember").value) || 14;
              sec.singleDevice = document.getElementById("sessSingle").checked;
              App.logAudit("更新会话策略", "空闲 " + sec.idle + " 分钟", "安全", "会话与记住登录策略变更", "normal", null);
              App.refresh(); App.toast("会话策略已保存", "空闲 " + sec.idle + " 分钟 · 最长 " + sec.max + " 小时", "success");
            },
            "toggle-ip": function () {
              var sec = st().security; var target = !sec.ip.enabled;
              App.confirm({ title: target ? "启用 IP 强制" : "关闭 IP 强制", message: target ? "不在允许清单内的登录会被阻断。" : "IP 清单保留，但仅记录不阻断。", okText: "确认" }).then(function (ok) {
                if (!ok) return;
                sec.ip.enabled = target;
                App.logAudit(target ? "启用 IP 强制" : "关闭 IP 强制", sec.ip.entries.length + " 个网段", "安全", "网络边界策略变更", "high", null);
                App.refresh(); App.toast("IP 策略已更新", target ? "强制拦截" : "观察模式", "success");
              });
            },
            "add-ip": addIp,
            "remove-ip": function (b) {
              var cidr = b.getAttribute("data-cidr");
              App.confirm({ title: "移除网段", message: "移除 " + cidr + " 后，该网络将不再被识别。", danger: true, okText: "移除" }).then(function (ok) {
                if (!ok) return;
                var sec = st().security; sec.ip.entries = sec.ip.entries.filter(function (x) { return x.cidr !== cidr; });
                App.logAudit("移除 IP 网段", cidr, "安全", "网络允许清单更新", "warning", null);
                App.refresh(); App.toast("网段已移除", cidr, "warn");
              });
            },
            "toggle-dlp": function (b) {
              var key = b.getAttribute("data-key"); var dlp = st().security.dlp; dlp[key] = !dlp[key];
              App.logAudit("更新下载策略", key + " → " + (dlp[key] ? "开启" : "关闭"), "安全", "数据防泄漏策略变更", "high", null);
              App.refresh(); App.toast("下载策略已更新", key + " · " + (dlp[key] ? "已开启" : "已关闭"), "success");
            },
            "security-report": securityReport
          });
        }
      },
      { path: "system/audit", title: "审计与合规", icon: "list", render: auditPage,
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
      { path: "system/integrations", title: "集成与 API", icon: "grid", render: integrationsPage,
        mount: function (root) {
          bindPage(root, {
            "test-int": function (b) {
              var it = st().integrations.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0];
              if (!it) return;
              if (it.status === "connected") { App.toast("连接正常", it.name + " · " + it.meta, "success"); return; }
              App.confirm({ title: "连接 " + it.name, message: "允许 " + it.name + " 使用企业身份与通知权限？", okText: "连接" }).then(function (ok) {
                if (!ok) return;
                it.status = "connected"; it.meta = "连接成功 · 待配置"; it.lastSync = "今天 " + App.nowStamp();
                App.logAudit("连接集成", it.name, "集成", "OAuth 授权完成", "normal", null);
                App.refresh(); App.toast("已连接", it.name + "，请继续配置作用域。", "success");
              });
            },
            "add-key": addApiKey,
            "rotate-key": function (b) {
              var k = st().apiKeys.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0];
              if (!k) return;
              App.confirm({ title: "轮换 API Key", message: "旧 Key 将立即失效，使用方需要更新配置。", danger: true, okText: "轮换" }).then(function (ok) {
                if (!ok) return;
                k.prefix = "sp_live_" + Math.random().toString(16).slice(2, 6); k.lastUsed = "刚刚";
                App.logAudit("轮换 API Key", k.name, "集成", "旧密钥立即失效", "high", null);
                App.refresh(); App.toast("Key 已轮换", k.name + " · 新前缀 " + k.prefix + "…", "success");
              });
            },
            "revoke-key": function (b) {
              var k = st().apiKeys.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0];
              if (!k) return;
              App.confirm({ title: "撤销 API Key", message: "撤销 " + k.name + " 后，所有调用立即失败。", danger: true, okText: "撤销" }).then(function (ok) {
                if (!ok) return;
                k.status = "revoked";
                App.logAudit("撤销 API Key", k.name, "集成", "密钥已失效", "critical", null);
                App.refresh(); App.toast("Key 已撤销", k.name, "warn");
              });
            },
            "test-model": function (b) {
              var idx = Number(b.getAttribute("data-i")), m = st().models[idx];
              var old = b.textContent; b.textContent = "测试中…"; b.disabled = true;
              setTimeout(function () { b.textContent = old; b.disabled = false; m.status = "已连接"; m.latency = "1.2s"; App.refresh(); App.toast("连接正常", m.name + " · " + m.latency, "success"); }, 900);
            },
            "config-model": function (b) { configModel(Number(b.getAttribute("data-i"))); },
            "add-model": addModel,
            "test-webhook": function () { App.toast("测试已发送", "3 个 Webhook 均返回 200。", "success"); }
          });
        }
      },
      { path: "system/billing", title: "订阅与账单", icon: "download", render: billingPage,
        mount: function (root) {
          bindPage(root, {
            "buy-seats": buySeats,
            payment: paymentModal,
            "download-invoice": function (b) { downloadInvoice(b.getAttribute("data-id")); }
          });
        }
      },
      { path: "system/workspace", title: "工作区设置", icon: "sliders", render: workspacePage,
        mount: function (root) {
          bindPage(root, {
            "ws-section": function (b) { workspaceSection = b.getAttribute("data-key"); App.refresh(); },
            "save-workspace": function () {
              var w = st().workspace;
              w.name = document.getElementById("wsName").value.trim() || w.name;
              w.legalName = document.getElementById("wsLegal").value.trim();
              w.region = document.getElementById("wsRegion").value;
              w.timezone = document.getElementById("wsTz").value.trim();
              w.locale = document.getElementById("wsLocale").value;
              App.logAudit("更新工作区信息", w.name, "工作区", w.region + " · " + w.timezone, "normal", null);
              App.refresh(); App.toast("工作区已保存", w.name + " · " + w.region, "success");
            },
            "save-project-defaults": function () {
              var w = st().workspace;
              w.defaultTemplate = document.getElementById("wTemplate").value;
              w.defaultModel = document.getElementById("wModel").value;
              w.requireProjectApproval = document.getElementById("wApproval").checked;
              w.allowGuests = document.getElementById("wGuest").checked;
              App.logAudit("更新项目默认", w.defaultTemplate, "工作区", "默认模型 " + w.defaultModel, "normal", null);
              App.refresh(); App.toast("项目默认已保存", w.defaultTemplate + " · " + w.defaultModel, "success");
            },
            "toggle-ws": function (b) {
              var key = b.getAttribute("data-key");
              var n = (st().workspace.notifications || []).filter(function (x) { return x.key === key; })[0];
              if (!n) return;
              n.on = !n.on; App.refresh(); App.toast("通知策略已更新", n.label + " · " + (n.on ? "开启" : "关闭"), "success");
            },
            "save-retention": function () {
              var w = st().workspace;
              w.dataRetention = Number(document.getElementById("wRetention").value) || 180;
              App.logAudit("修改数据保留周期", w.dataRetention + " 天", "工作区", "审计与导出记录保留周期", "normal", null);
              App.refresh(); App.toast("保留周期已保存", w.dataRetention + " 天", "success");
            },
            "export-workspace": function () {
              var s = st();
              App.download("changye_workspace.json", JSON.stringify({ workspace: s.workspace, departments: s.departments, roles: s.roles, security: s.security, billing: s.billing }, null, 2), "application/json;charset=utf-8");
              App.toast("工作区状态已导出", "JSON · 含组织、角色与安全策略", "success");
            },
            "reset-workspace": resetDemo,
            transfer: function () {
              var candidates = st().members.filter(function (m) { return m.status === "active" && m.roleId !== "r-owner" && m.roleId !== "r-guest"; });
              var body = '<div class="form-grid"><div class="field span2"><label>新所有者</label><select class="select" id="trOwner">' + candidates.map(function (m) { return '<option value="' + m.id + '">' + UI.esc(m.name) + " · " + UI.esc(m.role) + "</option>"; }).join("") + '</select></div></div><div class="notice danger mt-12">转移后当前所有者将降为管理员，订阅与账单权一并转移。</div>';
              App.modal({ title: "转移工作区所有权", sub: "高风险操作 · 需要二次确认", body: body, footer: '<button class="btn" data-close>取消</button><button class="btn btn-danger" id="trGo">确认转移</button>',
                onMount: function (el, close) {
                  el.querySelector("#trGo").addEventListener("click", function () {
                    var id = el.querySelector("#trOwner").value;
                    st().workspace.ownerId = id;
                    App.logAudit("转移工作区所有权", (memberById(id) || {}).name, "工作区", "企业治理与订阅权转移", "critical", null);
                    close(); App.refresh(); App.toast("所有权已转移", "请重新登录确认权限。", "warn");
                  });
                }
              });
            },
            "delete-workspace": function () { confirmed("删除工作区", "原型不会真实删除工作区。", "确认删除", true); }
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
              App.logAudit("更新项目信息", name, "工作区", "项目名称、简介与交付日期", "normal", st().project.id);
              App.refresh(); App.toast("已保存", "项目信息已更新。", "success");
            },
            "test-model": function (b) {
              var idx = Number(b.getAttribute("data-i")), m = st().models[idx];
              var old = b.textContent; b.textContent = "测试中…"; b.disabled = true;
              setTimeout(function () { b.textContent = old; b.disabled = false; m.status = "已连接"; m.latency = "1.2s"; App.refresh(); App.toast("连接正常", m.name + " · " + m.latency, "success"); }, 900);
            },
            "config-model": function (b) { configModel(Number(b.getAttribute("data-i"))); },
            "add-model": addModel,
            toggle: function (b) { b.classList.toggle("on"); App.toast("通知设置已更新", b.classList.contains("on") ? "已开启" : "已关闭", "success"); },
            reset: resetDemo,
            state: exportState,
            archive: function () { confirmed("归档项目", "归档后成员只读，导出历史保留。", "确认归档"); },
            delete: function () { confirmed("删除项目", "原型中不会真实删除，仅演示二次确认。", "确认删除", true); }
          });
        }
      },
      { path: "system/team", title: "成员与席位", icon: "users", nav: false, navParent: "system/members", render: membersPage, mount: memberPageMount }
    ]
  });
})();
