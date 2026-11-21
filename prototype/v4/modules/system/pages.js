/* ============================================================
   模块：系统（system）
   团队与权限 / 模型与用量
   ============================================================ */
(function () {
  function st() { return App.state; }
  var auditFilter = "all";
  var settingsSection = "info";

  /* ================= 团队 ================= */
  function teamPage() {
    var s = st();
    var members = s.members;
    var audits = s.audit.filter(function (a) { return auditFilter === "all" || a[3] === auditFilter; });
    var matrixPerms = ["项目", "剧情", "资产", "分镜", "生成", "审核", "剪辑", "导出", "成员"];
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Workspace · Team", title: "团队与权限", desc: "项目是权限边界。成员按角色获得菜单、页面与操作入口；邀请会写入审计日志。",
        actions: '<button class="btn" data-act="invite">' + UI.icon("users") + '邀请成员</button><button class="btn btn-primary" data-act="audit">' + UI.icon("list") + "查看审计</button>" }) +
      '<div class="grid g4 mb-16">' + UI.stat({ label: "项目成员", value: String(members.length), unit: "人", delta: "3 人在线 · 1 待接受" }) +
      UI.stat({ label: "角色", value: "6", unit: "类", delta: "所有者 / 导演 / 编剧 / 美术 / 剪辑 / 审核" }) +
      UI.stat({ label: "待接受邀请", value: "1", unit: "人", delta: "周可 · 审核员" }) +
      UI.stat({ label: "近 30 天审计", value: "28", unit: "条", delta: "2 条权限变更" }) + "</div>" +
      '<div class="card"><div class="card-head"><div><h3>成员</h3><div class="ch-sub">6 人 · 按角色授予权限</div></div><span class="badge b-teal">' + App.currentUser.role + '视角</span></div><div class="card-body">' +
      '<div class="member-grid">' + members.map(function (m) {
        var id = s.identities.filter(function (u) { return u.name === m.name; })[0];
        return '<button class="member-card" data-member="' + UI.esc(m.name) + '" style="text-align:left"><div class="member-head">' + UI.avatar(m.name, "lg", m.color) +
          '<div><div class="member-name">' + UI.esc(m.name) + '</div><div class="member-role">' + UI.esc(m.role) + " · " + UI.esc(m.dept) + '</div></div><span class="dot ' + (m.status === "在线" ? "on" : "") + '" style="margin-left:auto"></span></div>' +
          '<div class="member-foot"><span>' + UI.esc(m.email) + '</span>' + UI.badge(m.status === "在线" ? "在线" : "离线", m.status === "在线" ? "b-done" : "b-todo") + "</div>" +
          (id ? '<div class="tiny muted mt-8">演示身份 · 可切换为 ' + UI.esc(id.role) + "</div>" : "") + "</button>";
      }).join("") + "</div></div></div>" +

      '<div class="grid g-2-1 mt-16"><div class="card"><div class="card-head"><div><h3>角色权限矩阵</h3><div class="ch-sub">✓ 允许 · — 不可见 · 权限为前端内存判定</div></div></div><div class="card-body tight" style="overflow:auto">' +
      '<table class="matrix"><thead><tr><th>角色</th>' + matrixPerms.map(function (p) { return "<th>" + p + "</th>"; }).join("") + "</tr></thead><tbody>" +
      s.roles.map(function (r) {
        return '<tr><td><b>' + UI.esc(r.name) + '</b><span class="t-sub">' + UI.esc(r.desc) + "</span></td>" + matrixPerms.map(function (p) {
          var yes = r.perms.indexOf(p) > -1;
          return '<td class="' + (yes ? "yes" : "no") + '">' + (yes ? "✓" : "—") + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table></div></div>" +
      '<div class="card"><div class="card-head"><div><h3>审计日志</h3><div class="ch-sub">最近 6 条 · 只读</div></div></div><div class="card-body tight"><div class="row wrap mb-8">' +
      ["all", "成员", "剧本", "资产", "导出", "设置"].map(function (x) {
        return '<button class="chip' + (auditFilter === x ? " on" : "") + '" data-act="afilter" data-key="' + x + '">' + (x === "all" ? "全部" : x) + "</button>";
      }).join("") + '</div><div class="audit-scroll">' + audits.map(function (a) {
        return '<div class="list-row"><span class="mono tiny" style="width:52px">' + a[0] + '</span><span class="lr-main"><span class="lr-title">' + UI.esc(a[2]) + '</span><span class="lr-sub">' + UI.esc(a[1]) + " · " + UI.esc(a[3]) + "</span></span></div>";
      }).join("") + "</div></div></div></div></div>";
  }

  function invite() {
    var roles = st().roles.map(function (r) { return r.name; });
    var body = '<div class="form-grid"><div class="field span2"><label>邮箱<span class="req">*</span></label><input class="input" id="invEmail" placeholder="name@studio.cn"><span class="err-msg" id="invErr">请输入有效邮箱</span></div>' +
      '<div class="field"><label>角色</label><select class="select" id="invRole">' + roles.map(function (r) { return "<option>" + r + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>部门</label><select class="select"><option>制作中心</option><option>内容组</option><option>视觉组</option><option>后期组</option><option>质控组</option></select></div>' +
      '<div class="field span2"><label class="checkline"><input type="checkbox" checked> 发送邀请邮件并附项目说明</label></div></div>' +
      '<div class="notice info mt-12">' + UI.icon("users", 15) + "<span>被邀请者会先看到「待接受」状态；原型不发送真实邮件。</span></div>";
    App.modal({
      title: "邀请成员", sub: "邀请后立即加入成员列表，权限按角色生效。", size: "lg", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="invGo">发送邀请</button>',
      onMount: function (el, close) {
        el.querySelector("#invGo").addEventListener("click", function () {
          var email = el.querySelector("#invEmail").value.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { el.querySelector("#invErr").classList.add("show"); el.querySelector("#invEmail").classList.add("err"); return; }
          var role = el.querySelector("#invRole").value;
          var name = email.split("@")[0];
          st().members.push({ name: name, email: email, role: role, dept: "制作中心", status: "待接受", last: "刚刚", initial: name.charAt(0).toUpperCase(), color: "green" });
          st().audit.unshift(["今天 " + App.nowStamp(), App.currentUser.name, "邀请 " + email + " 以「" + role + "」加入项目", "成员"]);
          close(); App.refresh(); App.toast("邀请已发送", email + " · " + role + "，等待接受。", "success");
        });
      }
    });
  }

  function memberDrawer(name) {
    var m = st().members.filter(function (x) { return x.name === name; })[0]; if (!m) return;
    var body = '<div class="account-head">' + UI.avatar(m.name, "lg", m.color) + '<div><div class="account-name">' + UI.esc(m.name) + '</div><div class="small muted">' + UI.esc(m.email) + " · " + UI.esc(m.dept) + "</div></div></div>" +
      '<div class="kv"><div class="k">角色</div><div class="v">' + UI.esc(m.role) + '</div><div class="k">状态</div><div class="v">' + UI.esc(m.status) + '</div><div class="k">最近活跃</div><div class="v">' + UI.esc(m.last) + '</div><div class="k">项目</div><div class="v">长夜将明（NYJM-26）</div></div>' +
      '<div class="field mt-16"><label>调整角色</label><select class="select" id="mRole">' + st().roles.map(function (r) { return '<option' + (r.name === m.role ? " selected" : "") + ">" + r.name + "</option>"; }).join("") + '</select></div>' +
      '<div class="notice info mt-12">角色变更只影响前端菜单与按钮可见性，不实现真实鉴权。</div>';
    App.drawer({
      eyebrow: "Member", title: m.name, sub: m.role + " · " + m.dept, body: body,
      footer: '<button class="btn" data-close>关闭</button><button class="btn btn-primary" id="mSave">保存角色</button>',
      onMount: function (el, close) {
        el.querySelector("#mSave").addEventListener("click", function () {
          var role = el.querySelector("#mRole").value;
          m.role = role;
          st().audit.unshift(["今天 " + App.nowStamp(), App.currentUser.name, "将 " + m.name + " 的角色调整为「" + role + "」", "成员"]);
          close(); App.refresh(); App.toast("角色已更新", m.name + " → " + role, "success");
        });
      }
    });
  }

  /* ================= 设置 ================= */
  function settingsPage() {
    var s = st();
    var p = s.project, usage = s.usage;
    var sections = [
      ["info", "项目信息"], ["models", "模型接入"], ["cost", "用量与预算"], ["notify", "通知"],
      ["team", "团队"], ["demo", "演示数据"], ["danger", "危险操作"]
    ];
    var nav = sections.map(function (x) {
      return '<button class="' + (settingsSection === x[0] ? "active" : "") + '" data-act="section" data-key="' + x[0] + '">' + x[1] + "</button>";
    }).join("");
    var panel = "";
    if (settingsSection === "info") panel = infoPanel();
    if (settingsSection === "models") panel = modelsPanel();
    if (settingsSection === "cost") panel = costPanel();
    if (settingsSection === "notify") panel = notifyPanel();
    if (settingsSection === "team") panel = teamPanel();
    if (settingsSection === "demo") panel = demoPanel();
    if (settingsSection === "danger") panel = dangerPanel();
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Settings · NYJM-26", title: "模型与用量", desc: "项目信息、模型接入、预算与通知。设置只保存在内存，刷新恢复演示初始值。",
        actions: '<button class="btn" data-act="state">' + UI.icon("download") + '导出项目状态</button><a class="btn" href="' + App.link("system/team") + '">团队与权限</a>' }) +
      '<div class="settings-layout"><div class="settings-nav">' + nav + "</div><div>" + panel + "</div></div></div>";
  }

  function infoPanel() {
    var p = st().project;
    return '<div class="card"><div class="card-head"><div><h3>项目信息</h3><div class="ch-sub">显示名称、简介与交付日期</div></div><span class="badge b-teal">' + UI.esc(p.code) + "</span></div><div class=\"card-body\">" +
      '<div class="form-grid"><div class="field span2"><label>项目名称<span class="req">*</span></label><input class="input" id="pName" value="' + UI.esc(p.name) + '"><span class="err-msg" id="pErr">名称不能为空</span></div>' +
      '<div class="field"><label>类型</label><input class="input" id="pGenre" value="' + UI.esc(p.genre) + '"></div><div class="field"><label>交付日期</label><input class="input" id="pDue" type="date" value="' + UI.esc(p.due) + '"></div>' +
      '<div class="field span2"><label>一句话简介</label><textarea class="textarea" id="pTagline" rows="2">' + UI.esc(p.tagline) + "</textarea></div>" +
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
        return '<div class="field"><label>' + cap + '</label><select class="select">' + opts.map(function (m) { return "<option>" + m.name + "</option>"; }).join("") + "</select></div>";
      }).join("") + "</div></div></div>";
  }

  function costPanel() {
    var usage = st().usage;
    var days = [214, 386, 302, 640, 812, 468, 286, 510, 420, 360, 580, 720, 390, 286];
    var max = Math.max.apply(null, days);
    return '<div class="card"><div class="card-head"><div><h3>用量与预算</h3><div class="ch-sub">本月 · 按能力拆分</div></div><span class="tag">预算 ¥' + usage.budget.toLocaleString() + "</span></div><div class=\"card-body\">" +
      '<div class="between"><span class="tiny muted">已用 ¥' + usage.spent.toLocaleString() + '</span><span class="tiny muted">剩余 ¥' + (usage.budget - usage.spent).toLocaleString() + " · " + Math.round(usage.spent / usage.budget * 100) + "%</span></div>" +
      UI.progress(Math.round(usage.spent / usage.budget * 100)) + '<div class="budget-bar mt-16">' +
      usage.byCap.map(function (c) { return '<div class="budget-row"><span>' + c[0] + '</span><div class="progress thin"><i style="width:' + c[2] + '%"></i></div><span class="mono tiny">¥' + c[1].toLocaleString() + "</span></div>"; }).join("") +
      '</div><div class="eyebrow mt-20">近 14 天消耗</div><div class="bars">' + days.map(function (d) { return '<div class="bar" title="¥' + d + '"><i style="height:' + Math.round(d / max * 100) + '%"></i></div>'; }).join("") + "</div>" +
      '<div class="bar-labels">' + ["11-08","11-09","11-10","11-11","11-12","11-13","11-14","11-15","11-16","11-17","11-18","11-19","11-20","11-21"].map(function (d) { return "<span>" + d.slice(3) + "</span>"; }).join("") + "</div></div></div>" +
      '<div class="card mt-16"><div class="card-head"><h3>预算提醒</h3></div><div class="card-body"><div class="field"><label>月度预算</label><div class="row"><input class="input" style="max-width:160px" value="' + usage.budget + '"><span class="tiny muted">元 / 月</span></div></div>' +
      '<div class="row mt-12"><label class="checkline"><input type="checkbox" checked> 达到 80% 时通知项目所有者</label><label class="checkline"><input type="checkbox" checked> 达到 100% 时暂停生成任务</label></div></div></div>';
  }

  function notifyPanel() {
    return '<div class="card"><div class="card-head"><div><h3>通知</h3><div class="ch-sub">站内信 · 邮件 · 失败提醒</div></div></div><div class="card-body">' +
      [["任务失败", "立即通知任务创建者与项目所有者", true], ["成片待审核", "审核任务到达时通知导演", true], ["成员邀请", "邀请发送与接受时通知", true], ["每周用量摘要", "每周一 09:00 发送邮件", false], ["导出完成", "交付完成后通知客户", true]].map(function (n) {
        return '<div class="between" style="padding:11px 0;border-bottom:1px solid #eee9df"><div><b class="small">' + n[0] + '</b><div class="tiny muted">' + n[1] + '</div></div><button class="switch ' + (n[2] ? "on" : "") + '" data-act="toggle" aria-label="切换通知"><i></i></button></div>';
      }).join("") + "</div></div>";
  }

  function teamPanel() {
    return '<div class="card"><div class="card-head"><div><h3>团队</h3><div class="ch-sub">' + st().members.length + ' 人 · 权限由角色决定</div></div><a class="btn btn-sm" href="' + App.link("system/team") + '">管理成员</a></div><div class="card-body tight">' +
      st().members.map(function (m) {
        return '<div class="list-row">' + UI.avatar(m.name, "sm", m.color) + '<span class="lr-main"><span class="lr-title">' + UI.esc(m.name) + '</span><span class="lr-sub">' + UI.esc(m.email) + " · " + UI.esc(m.role) + '</span></span><span class="badge ' + (m.status === "在线" ? "b-done" : "b-todo") + '">' + UI.esc(m.status) + "</span></div>";
      }).join("") + "</div></div>";
  }

  function demoPanel() {
    return '<div class="card"><div class="card-head"><div><h3>演示数据</h3><div class="ch-sub">当前状态仅保存在内存，刷新页面恢复初始演示数据</div></div></div><div class="card-body">' +
      '<div class="kv"><div class="k">状态</div><div class="v">已初始化 · 1 个项目 / 12 集 / 18 项资产</div><div class="k">存储</div><div class="v">内存 · 无 localStorage</div><div class="k">最近刷新</div><div class="v">页面加载时</div></div>' +
      '<div class="row mt-16"><button class="btn" data-act="state">' + UI.icon("download") + '导出演示状态</button><button class="btn btn-soft" data-act="reset">重置全部演示数据</button></div></div></div>';
  }

  function dangerPanel() {
    return '<div class="card" style="border-color:#f0cfc9"><div class="card-head"><div><h3 style="color:#8c332b">危险操作</h3><div class="ch-sub">不可逆 · 需二次确认</div></div></div><div class="card-body">' +
      '<div class="between" style="padding:10px 0"><div><b class="small">归档项目</b><div class="tiny muted">归档后成员只读，导出历史保留。</div></div><button class="btn btn-sm btn-danger" data-act="archive">归档</button></div>' +
      '<div class="between" style="padding:10px 0;border-top:1px solid #eee9df"><div><b class="small">删除项目</b><div class="tiny muted">原型中仅演示确认流程，不会真实删除数据。</div></div><button class="btn btn-sm btn-danger" data-act="delete">删除</button></div></div></div>';
  }

  AppModule.register({
    group: "system", label: "系统", icon: "sliders",
    routes: [
      { path: "system/team", title: "团队与权限", icon: "users", render: teamPage,
        mount: function (root) {
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]"); if (b) {
              var act = b.getAttribute("data-act");
              if (act === "invite") invite();
              if (act === "afilter") { auditFilter = b.getAttribute("data-key"); App.refresh(); }
              if (act === "audit") { auditFilter = "all"; App.refresh(); }
              return;
            }
            var m = e.target.closest("[data-member]"); if (m) memberDrawer(m.getAttribute("data-member"));
          });
        }
      },
      { path: "system/settings", title: "模型与用量", icon: "sliders", render: settingsPage,
        mount: function (root) {
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]"); if (!b) return;
            var act = b.getAttribute("data-act");
            if (act === "section") { settingsSection = b.getAttribute("data-key"); App.refresh(); return; }
            if (act === "save-info") {
              var name = document.getElementById("pName").value.trim();
              if (!name) { document.getElementById("pErr").classList.add("show"); return; }
              st().project.name = name;
              st().project.tagline = document.getElementById("pTagline").value.trim();
              st().project.due = document.getElementById("pDue").value;
              st().project.genre = document.getElementById("pGenre").value;
              st().project.updated = "刚刚";
              st().audit.unshift(["今天 " + App.nowStamp(), App.currentUser.name, "更新项目信息：" + name, "设置"]);
              App.refresh(); App.toast("已保存", "项目信息已更新。", "success");
              return;
            }
            if (act === "test-model") {
              var idx = Number(b.getAttribute("data-i")), m = st().models[idx];
              var old = b.textContent; b.textContent = "测试中…"; b.disabled = true;
              setTimeout(function () {
                b.textContent = old; b.disabled = false;
                m.status = "已连接"; m.latency = "1.2s";
                App.refresh(); App.toast("连接正常", m.name + " · " + m.latency, "success");
              }, 900);
              return;
            }
            if (act === "config-model") { configModel(Number(b.getAttribute("data-i"))); return; }
            if (act === "add-model") { addModel(); return; }
            if (act === "toggle") { b.classList.toggle("on"); App.toast("通知设置已更新", b.classList.contains("on") ? "已开启" : "已关闭", "success"); return; }
            if (act === "reset") { resetDemo(); return; }
            if (act === "state") { exportState(); return; }
            if (act === "archive") { confirmed("归档项目", "归档后成员只读，导出历史保留。", "确认归档"); return; }
            if (act === "delete") { confirmed("删除项目", "原型中不会真实删除，仅演示二次确认。", "确认删除", true); return; }
          });
        }
      }
    ]
  });

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
          m.status = "已连接"; m.def = true; close(); App.refresh(); App.toast("配置已保存", m.name + " 已连接。", "success");
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
    App.confirm({ title: "重置演示数据", message: "把所有项目、审核、任务和时间线恢复到初始状态？", detail: "当前内存中的修改会丢失；页面刷新也会得到同样结果。", okText: "重置并刷新" }).then(function (ok) {
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
})();
