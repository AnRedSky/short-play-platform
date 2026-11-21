/* ============================================================
   模块：总览（overview）
   工作台 / 项目总览
   ============================================================ */
(function () {
  function st() { return App.state; }

  function projectMembers() {
    var s = st();
    return s.project.memberIds.map(function (id) {
      return s.members.filter(function (m) { return m.id === id; })[0];
    }).filter(Boolean);
  }

  function memberBadge(m) {
    return '<span class="badge ' + (m.status === "active" ? "b-done" : m.status === "invited" ? "b-warn" : "b-danger") + '">' + App.statusLabel(m.status) + "</span>";
  }

  var PIPE = [
    ["story", "故事"], ["episodes", "分集"], ["assets", "资产"], ["board", "分镜"],
    ["generate", "生成"], ["qa", "质检"], ["timeline", "时间线"], ["export", "导出"]
  ];
  var PIPE_META = {
    story: "18 项设定", episodes: "12 集", assets: "12 项资产", board: "12 镜头",
    generate: "5 / 12 已生成", qa: "待审核", timeline: "未解锁", export: "未解锁"
  };

  function pipelineHTML() {
    var s = st(), p = s.pipeline;
    return '<div class="pipeline">' + PIPE.map(function (x, i) {
      var state = p[x[0]] || "todo";
      return '<div class="step ' + state + '"><div class="st-head"><span class="st-dot">' + (state === "done" ? "✓" : (i + 1)) +
        '</span><span class="st-name">' + x[1] + '</span></div><div class="st-meta">' + (PIPE_META[x[0]] || "") + "</div></div>";
    }).join("") + "</div>";
  }

  function activityRows(limit) {
    return st().activity.slice(0, limit || 6).map(function (a) {
      return '<div class="activity-row"><time>' + a[0] + "</time><b>" + UI.esc(a[1]) + "</b><span>" + UI.esc(a[2]) + "</span></div>";
    }).join("");
  }

  function dashboard() {
    var s = st();
    var p = s.project;
    var heads = '<div class="page-head"><div class="ph-main"><span class="eyebrow">Workspace · 2026 年 11 月 21 日</span>' +
      '<h1 class="page-title">早上好，' + UI.esc(App.currentUser.name) + '。</h1>' +
      '<p class="page-desc">今天有 <b>1 集成片</b>等待审核，<b>' + App.taskRunning() + ' 个 AI 任务</b>需要关注。EP01 已完成剧本与资产，正在推进分镜与画面。</p></div>' +
      '<div class="page-actions"><button class="btn" data-act="open-project">' + UI.icon("compass") + '项目总览</button>' +
      (App.hasPerm("story:write") ? '<button class="btn btn-primary" data-act="new-drama">' + UI.icon("plus") + "新建短剧</button>" : "") +
      "</div></div>";

    var hero = '<section class="hero"><div class="hero-bg" style="background-image:url(' + UI.scene("bookstore") + ')"></div>' +
      '<div class="hero-copy"><span class="eyebrow">Current production · ' + UI.esc(p.code) + '</span>' +
      '<h2 class="hero-title">' + UI.esc(p.name) + '</h2>' +
      '<p class="hero-desc">' + UI.esc(p.tagline) + '</p>' +
      '<div class="hero-meta"><span>12 集 · 9:16 竖屏</span><span>' + UI.esc(p.genre) + '</span><span>交付 ' + UI.esc(p.due) + '</span></div>' +
      '<div class="hero-actions"><a class="btn btn-primary" href="' + App.link("overview/project") + '">' + UI.icon("arrow") + '进入项目' +
      '</a><a class="btn" href="' + App.link("review/qa") + '">' + UI.icon("play") + "查看待审成片</a></div></div>" +
      '<div class="hero-side"><div class="hs-label">EP01 · 雨夜书店</div><div class="hs-name">粗剪 v4</div>' +
      '<div class="hs-row"><span>完成度</span><strong>' + App.epProgress("01") + '%</strong></div><div class="hs-bar"><i style="width:' + App.epProgress("01") + '%"></i></div>' +
      '<div class="hs-row"><span>5 / 8 阶段</span><span>QA 94</span></div></div></section>';

    var stats = '<div class="grid g4 mt-16">' +
      UI.stat({ label: "在制项目", value: "3", unit: "个", delta: "1 个本周交付" }) +
      UI.stat({ label: "本季总集数", value: "26", unit: "集", delta: "12 集已锁版" }) +
      UI.stat({ label: "EP01 完成度", value: App.epProgress("01"), unit: "%", delta: "资产与分镜进行中" }) +
      UI.stat({ label: "本月用量", value: "6,842", unit: "元", delta: "预算 ¥12,000 · 57%" }) + "</div>";

    var inbox = UI.card({
      title: "今日待办", sub: "3 条需要你在今天处理", cls: "mt-16",
      head: '<a class="btn btn-xs" href="' + App.link("review/tasks") + '">全部任务</a>',
      body: '<div class="todo-list">' +
        '<button class="todo-row" data-act="go-qa"><span class="todo-icon hot">' + UI.icon("check", 15) + '</span><span class="todo-main"><span class="todo-title">EP01 成片待审核</span><span class="todo-meta">QA 94 分 · 3 条批注 · 截止今天 18:00</span></span><span class="badge b-warn">待处理</span></button>' +
        '<button class="todo-row" data-act="go-tasks"><span class="todo-icon">' + UI.icon("alert", 15) + '</span><span class="todo-main"><span class="todo-title">T-2039 参考图生成失败</span><span class="todo-meta">FACE_DRIFT · 3/4 候选一致性不足</span></span><span class="badge b-danger">失败</span></button>' +
        '<button class="todo-row" data-act="go-script"><span class="todo-icon">' + UI.icon("feather", 15) + '</span><span class="todo-main"><span class="todo-title">EP03 剧本等待确认</span><span class="todo-meta">顾青提交 · 4 场 · 待导演锁版</span></span><span class="badge b-todo">待确认</span></button>' +
        '<button class="todo-row" data-act="go-assets"><span class="todo-icon">' + UI.icon("image", 15) + '</span><span class="todo-main"><span class="todo-title">2 项资产需要补参考</span><span class="todo-meta">铅字盘、沈知白 · 0 个有效参考</span></span><span class="badge b-warn">待补</span></button>' +
        "</div>", bodyCls: "tight"
    });

    var quickItems = [
      ["script:write", "feather", "写下一场", "EP01 · 8 场已完成", "production/script", { ep: "01" }],
      ["asset:write", "image", "补 2 项资产", "铅字盘、沈知白待补参考", "production/assets"],
      ["task:run", "alert", "处理失败任务", "T-2039 · 一致性不足", "review/tasks"],
      ["qa:review", "check", "终审 EP01", "QA 94 分 · 3 条批注", "review/qa"],
      ["timeline:write", "activity", "排时间线", "4 轨 · 18 片段 · 92 秒", "review/timeline"],
      ["export:run", "download", "导出交付", "质检通过后解锁", "delivery/export"]
    ].filter(function (x) { return App.hasPerm(x[0]); }).map(function (x) {
      return '<a class="quick-tile" href="' + App.link(x[4], x[5]) + '"><span class="quick-icon">' + UI.icon(x[1], 15) + '</span>' +
        '<span class="quick-main"><span class="quick-title">' + x[2] + '</span><span class="quick-sub">' + x[3] + "</span></span></a>";
    }).join("");
    var quick = UI.card({
      title: "快捷开始", sub: "按当前身份可执行的下一步", cls: "mt-16",
      body: '<div class="quick-grid">' + quickItems + "</div>"
    });

    var projects = UI.card({
      title: "项目", sub: "当前身份可访问 " + App.visibleProjects().length + " 个", cls: "mt-16",
      head: '<span class="tiny muted">共 ' + App.visibleProjects().length + " 个</span>",
      body: App.visibleProjects().map(function (x) {
        var cur = x.id === p.id;
        return '<button class="list-row" data-act="project" data-id="' + x.id + '" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;border-top:0">' +
          '<span class="pc-mark" style="width:30px;height:30px;font-size:12px;' + (cur ? "background:" + "var(--accent);color:#fff" : "") + '">' + UI.esc(x.name.charAt(0)) + "</span>" +
          '<span class="lr-main"><span class="lr-title">' + UI.esc(x.name) + '</span><span class="lr-sub">' + UI.esc(x.code) + " · " + x.episodes + " 集 · " + UI.esc(x.stage) + '</span></span>' +
          '<span class="badge ' + (x.progress === 100 ? "b-done" : cur ? "b-active" : "b-todo") + '">' + (cur ? x.progress + "%" : UI.esc(x.status)) + "</span></button>";
      }).join(""), bodyCls: "tight"
    });

    var act = UI.card({
      title: "制作动态", sub: "来自成员与系统", cls: "mt-16",
      body: activityRows(6)
    });

    return '<div class="page">' + heads + hero + stats +
      '<div class="dash-grid mt-16"><div>' + inbox + quick + '</div><div>' + projects + act + "</div></div>" +
      '<div class="card pipeline-card"><div class="card-head"><div><h3>EP01 制作流水线</h3><div class="ch-sub">故事 → 分集 → 资产 → 分镜 → 生成 → 质检 → 时间线 → 导出</div></div>' +
      '<a class="btn btn-xs" href="' + App.link("overview/project") + '">查看阶段详情</a></div><div class="card-body">' + pipelineHTML() + "</div></div>" +
      "</div>";
  }

  function projectPage(params) {
    var s = st(), p = s.project;
    var selected = params && params.id;
    if (selected && selected !== p.id) {
      var x = s.projects.filter(function (a) { return a.id === selected; })[0];
      if (!x) return '<div class="page">' + UI.empty("项目不存在", "项目可能已归档，或当前身份不在成员名单中。", '<a class="btn mt-16" href="' + App.link("overview/dashboard") + '">返回工作台</a>') + "</div>";
      return '<div class="page">' + UI.pageHead({ eyebrow: "Project", title: x.name, desc: "示例项目 · " + x.code, actions: '<a class="btn" href="' + App.link("overview/dashboard") + '">返回工作台</a>' }) +
        '<div class="notice info">' + UI.icon("alert", 15) + "<span>《" + UI.esc(x.name) + "》是项目切换的版式示例，完整业务数据只在《长夜将明》中提供。</span></div></div>";
    }
    var checklist = [
      ["故事圣经", "18 项设定 · v5 已锁版", "done"],
      ["分集与剧本", "12 集 · EP01 已锁版", "done"],
      ["资产参考", "12 项制作资产 · 2 项待补", "active"],
      ["分镜契约", "12 个镜头 · 5 个已就绪", "active"],
      ["画面生成", "5 / 12 镜头完成", "todo"],
      ["配音与字幕", "等待画面锁定", "locked"],
      ["质检审核", "QA 94 分 · 待终审", "todo"],
      ["导出交付", "审核通过后解锁", "locked"]
    ];
    var eps = s.episodes.map(function (e) {
      return '<button class="ep-card' + (e.no === "01" ? " is-current" : "") + '" data-act="ep" data-no="' + e.no + '">' +
        '<span class="ep-no">EP' + e.no + " · " + UI.esc(e.chapters) + '</span><span class="ep-title">' + UI.esc(e.title) + "</span>" +
        '<span class="tiny muted">' + UI.esc(e.hook) + "</span>" +
        '<span class="ep-foot">' + UI.statusBadge(e.status) + '<span class="tiny mono">' + UI.esc(e.duration) + "</span></span></button>";
    }).join("");

    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Project overview", title: p.name, desc: p.synopsis, actions:
        '<button class="btn" data-act="copy-code">' + UI.icon("folder") + "复制项目编号</button>" +
        '<button class="btn" data-act="members">' + UI.icon("users") + "成员</button>" +
        (App.hasPerm("settings:manage") ? '<a class="btn btn-primary" href="' + App.link("system/settings") + '">' + UI.icon("edit") + "项目设置</a>" : "") }) +
      '<div class="project-banner"><div class="pb-cover" style="background-image:url(' + UI.scene("bookstore") + ')"><span>NYJM-26 · KEY VISUAL</span></div>' +
      '<div class="pb-main"><div class="pb-title"><h2>' + UI.esc(p.name) + '</h2><span class="badge b-teal">制作中</span><span class="tag">' + UI.esc(p.code) + "</span></div>" +
      '<div class="pb-sub">' + UI.esc(p.genre) + " · " + p.episodes + " 集 · " + UI.esc(p.ratio) + " · " + p.fps + "fps</div>" +
      '<div class="pb-meta"><div><div class="k">交付日期</div><div class="v">' + UI.esc(p.due) + '</div></div><div><div class="k">当前阶段</div><div class="v">' + UI.esc(p.stage) + '</div></div><div><div class="k">预算 / 已用</div><div class="v">¥12,000 / ¥6,842</div></div><div><div class="k">项目成员</div><div class="v">' + p.members + " 人</div></div></div></div></div>" +

      '<div class="card pipeline-card"><div class="card-head"><div><h3>八阶段流水线</h3><div class="ch-sub">完成 5 / 8 · 当前卡在资产与分镜</div></div><span class="badge b-active">42% 总进度</span></div>' +
      '<div class="card-body">' + UI.progress(42) + '<div class="mt-16">' + pipelineHTML() + "</div></div></div>" +

      '<div class="grid g-2-1 mt-16"><div class="stack">' +
      UI.card({ title: "EP01 制作清单", sub: "雨夜书店 · 1'32\" · 9:16", body: checklist.map(function (c) {
        return '<div class="checklist-row"><span class="ck ' + c[2] + '">' + (c[2] === "done" ? "✓" : c[2] === "active" ? "→" : "·") + '</span><span class="ck-main"><span>' + c[0] + '</span><span class="ck-sub">' + c[1] + "</span></span>" +
          (c[2] === "done" ? UI.badge("完成", "b-done") : c[2] === "active" ? UI.badge("进行中", "b-active") : c[2] === "locked" ? UI.badge("未解锁", "b-locked") : UI.badge("待开始", "b-todo")) + "</div>";
      }).join("") }) +
      UI.card({ title: "12 集季卡", sub: "点击剧集查看剧本；EP01 已锁版", body: '<div class="ep-grid">' + eps + "</div>" }) +
      "</div><div class=\"stack\">" +
      UI.card({ title: "项目信息", body: '<div class="kv"><div class="k">项目编号</div><div class="v mono">' + UI.esc(p.code) + '</div><div class="k">类型</div><div class="v">' + UI.esc(p.genre) + '</div><div class="k">画幅</div><div class="v">9:16 竖屏 · 1080×1920</div><div class="k">帧率</div><div class="v">30 fps</div><div class="k">所有者</div><div class="v">' + UI.esc(p.owner) + '</div><div class="k">成员</div><div class="v">' + p.members + ' 人</div><div class="k">最近更新</div><div class="v">' + UI.esc(p.updated) + "</div></div>" }) +
      UI.card({ title: "成员", sub: projectMembers().length + " 人 · " + projectMembers().filter(function (m) { return m.presence === "online"; }).length + " 人在线", head: '<button class="btn btn-xs" data-act="members">管理</button>', body: projectMembers().slice(0, 5).map(function (m) {
        return '<div class="list-row">' + UI.avatar(m.name, "sm", m.color) + '<span class="lr-main"><span class="lr-title">' + UI.esc(m.name) + '</span><span class="lr-sub">' + UI.esc(m.role) + '</span></span><span class="dot ' + (m.presence === "online" ? "on" : "") + '"></span></div>';
      }).join("") + '<div class="tiny muted mt-8">还有 ' + Math.max(0, projectMembers().length - 5) + ' 位成员，点击「管理」查看全部。</div>' }) +
      UI.card({ title: "最近动态", body: activityRows(4) }) +
      "</div></div></div>";
  }

  var Actions = {
    openNew: function () {
      var body = '<div class="seg" id="newMode" style="margin-bottom:16px"><button class="active" data-mode="original">一句话原创</button><button data-mode="import">导入小说</button></div>' +
        '<div id="newForm"><div class="form-grid"><div class="field span2"><label>剧名<span class="req">*</span></label><input class="input" id="ndTitle" placeholder="例如：雾港来信"><span class="err-msg" id="ndErr">请填写剧名</span></div>' +
        '<div class="field"><label>类型</label><select class="select" id="ndGenre"><option>悬疑</option><option>都市情感</option><option>科幻</option><option>轻喜剧</option></select></div>' +
        '<div class="field"><label>集数</label><select class="select" id="ndEps"><option>6</option><option>8</option><option selected>12</option><option>16</option></select></div>' +
        '<div class="field span2"><label id="ndLabel">一句话故事</label><textarea class="textarea" id="ndIdea" rows="4" placeholder="一句话说清楚主角、困境与钩子。"></textarea><span class="hint" id="ndHint">AI 会扩写为故事圣经与 12 集大纲。</span></div></div></div>';
      var m = App.modal({
        title: "新建短剧", sub: "选择启动方式。原型不调用模型，创建后进入演示流程。",
        size: "lg", body: body,
        footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="ndCreate">创建项目</button>',
        onMount: function (el, close) {
          var mode = "original";
          el.querySelector("#newMode").addEventListener("click", function (e) {
            var b = e.target.closest("[data-mode]"); if (!b) return;
            mode = b.getAttribute("data-mode");
            el.querySelectorAll("[data-mode]").forEach(function (x) { x.classList.toggle("active", x === b); });
            el.querySelector("#ndLabel").textContent = mode === "original" ? "一句话故事" : "小说梗概";
            el.querySelector("#ndHint").textContent = mode === "original" ? "AI 会扩写为故事圣经与 12 集大纲。" : "导入后在「小说改编」中完成章节边界与实体确认。";
            el.querySelector("#ndIdea").placeholder = mode === "original" ? "一句话说清楚主角、困境与钩子。" : "粘贴小说梗概，或上传原文。";
          });
          el.querySelector("#ndCreate").addEventListener("click", function () {
            var title = el.querySelector("#ndTitle").value.trim();
            if (!title) { el.querySelector("#ndErr").classList.add("show"); el.querySelector("#ndTitle").classList.add("err"); return; }
            var item = {
              id: "demo-" + Date.now(), name: title, code: "NEW-" + Math.floor(Math.random() * 90 + 10),
              genre: el.querySelector("#ndGenre").value, episodes: Number(el.querySelector("#ndEps").value),
              ratio: "9:16", progress: 0, stage: mode === "original" ? "故事构思" : "等待导入", status: "草稿", updated: "刚刚"
            };
            App.state.projects.unshift(item);
            close();
            App.toast("项目已创建", "《" + title + "》已加入工作台。原型仅《长夜将明》提供完整数据。", "success");
            App.refresh();
            if (mode === "import") App.navigate("story/import");
          });
        }
      });
    },
    members: function () {
      var list = projectMembers();
      App.modal({
        title: "项目成员", sub: list.length + " 人 · 项目角色由企业角色与数据范围决定", size: "lg",
        body: '<div class="stack">' + list.map(function (m) {
          return '<div class="list-row">' + UI.avatar(m.name, "", m.color) + '<span class="lr-main"><span class="lr-title">' + UI.esc(m.name) + ' · ' + UI.esc(m.role) + '</span><span class="lr-sub">' + UI.esc(m.dept) + " · " + UI.esc(m.email) + '</span></span>' + memberBadge(m) + "</div>";
        }).join("") + "</div>",
        footer: '<button class="btn" data-close>关闭</button>' + (App.hasPerm("member:read") ? '<a class="btn btn-primary" href="' + App.link("system/members") + '">成员与席位</a>' : "")
      });
    },
    copyCode: function () {
      var code = st().project.code;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () { App.toast("已复制", code, "success"); }).catch(function () { App.toast("项目编号", code, "info"); });
      } else App.toast("项目编号", code, "info");
    },
    ep: function (no) {
      if (no === "01") App.navigate("production/script", { ep: "01" });
      else App.toast("演示边界", "EP" + no + " 的剧本内容尚未生成，可先在「分集与剧本」批量生成。", "warn");
    }
  };

  AppModule.register({
    group: "overview", label: "总览", icon: "home",
    routes: [
      {
        path: "overview/dashboard", title: "工作台", icon: "home", render: dashboard,
        mount: function (root) {
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]"); if (!b) return;
            var act = b.getAttribute("data-act");
            if (act === "new-drama") Actions.openNew();
            if (act === "open-project") App.navigate("overview/project");
            if (act === "go-qa") App.navigate("review/qa");
            if (act === "go-tasks") App.navigate("review/tasks");
            if (act === "go-script") App.navigate("production/script", { ep: "03" });
            if (act === "go-assets") App.navigate("production/assets");
            if (act === "project") App.navigate("overview/project", { id: b.getAttribute("data-id") });
          });
        }
      },
      {
        path: "overview/project", title: "项目总览", icon: "compass", render: projectPage,
        mount: function (root) {
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]"); if (!b) return;
            var act = b.getAttribute("data-act");
            if (act === "members") Actions.members();
            if (act === "copy-code") Actions.copyCode();
            if (act === "ep") Actions.ep(b.getAttribute("data-no"));
          });
        }
      }
    ]
  });
})();
