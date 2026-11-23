/* 模块：workspace 员工工作台（员工端） */
(function () {
  const U = UI, D = DB, SCOPE = "workspace";
  const me = () => App.identity();

  function myProjects() {
    return Derived.myProjects(me());
  }

  AppModule.register({
    group: "workspace", label: "我的工作台", icon: "home", order: 1, end: "workspace",
    routes: [
      {
        path: "workspace/home", title: "工作台首页", icon: "home", permission: "analytics.own",
        desc: "一名员工可独立完成整部短剧：从创意到交付的全部入口都在这里，跨部门协作是可选的授权行为。",
        render() {
          const mine = myProjects();
          const h = Derived.home(me());
          const ids = Derived.visibleProjects(me()).map(p => p.id);
          const actor = Derived.actorUser(me()) || {};
          const todos = D.notifications.filter(n => n.owner === actor.name && (n.unread || n.state === "待处理" || n.state === "处理中") && (!n.project || ids.indexOf(n.project) >= 0)).slice(0, 5);
          const risks = D.risks.filter(r => ids.indexOf(r.project) >= 0 && r.status !== "已闭环").slice(0, 2);
          const blocked = D.tasks.filter(t => ids.indexOf(t.project) >= 0 && t.status === "待人工处理").slice(0, 2);
          const ctxProject = App.currentProject();
          const feat = (ctxProject && mine.find(p => p.id === ctxProject.id)) || mine.find(p => p.status === "生产中") || mine[0];
          const wf = feat ? Derived.workflow(feat) : null;
          const eps = wf ? wf.eps : [];
          const selNo = Number(App.get(SCOPE, "ep", (eps.find(e => e.qc !== "PASS") || eps[0] || {}).no || 0));
          const selEp = eps.find(e => e.no === selNo) || eps[0];
          const mineShots = wf ? wf.shots : [];
          const hot = mine.filter(p => p.budget && p.actual / p.budget >= 0.85)[0] || null;
          const u = Derived.actorUser(me());
          const badProviders = D.providers.filter(x => x.status !== "启用" && u && x.ownerId === u.id).slice(0, 1);
          const pct = wf ? wf.pct : 0;
          const stagePage = { script: "creation/script", breakdown: "creation/breakdown", plan: "director/plan", video: "video/production", post: "audio/subtitle", qc: "quality/reports", final: "post/review", delivery: "post/delivery" };
          const pipe = wf ? wf.stages.map(s => [s.label, s.meta, s.state === "done" ? "done" : s.state === "now" ? "now" : "wait", stagePage[s.key]]) : [];
          const suggestions = []
            .concat(blocked.map(t => [t.id + " · " + t.kind, "待人工处理：" + t.failReason]))
            .concat(risks.map(r => [r.project, r.type + "（" + r.status + "）→ " + (r.action || "需确认处置")]))
            .concat(hot ? [[hot.id, "已用 " + Math.round(hot.actual / hot.budget * 100) + "%，需负责人确认或追加预算"]] : [])
            .concat(badProviders.length ? [[badProviders[0].name, "状态 " + badProviders[0].status + "，相关任务已暂停"]] : []);
          if (!suggestions.length) suggestions.push(["暂无", "没有需要立即处置的质量、风险或预算事项"]);
          const activity = mineShots
            .filter(s => s.status.indexOf("已通过") >= 0 || s.status === "执行中")
            .slice(0, 3)
            .map(s => ({ id: s.id, ep: s.ep, no: s.no, desc: s.desc, frame: s.frame, status: s.status }));
          const cover = feat ? U.cover(feat.id) : "";
          const epCover = (e) => ["assets/img/covers/shot-read.jpg", "assets/img/covers/wucheng.jpg", "assets/img/covers/shot-post2.jpg", "assets/img/covers/shot-street.jpg"][Number(e.no) % 4];
          const heroShot = feat ? D.shots.find(s => s.project === feat.id && s.ep === selNo) : null;
          const heroImg = (heroShot && U.storyFrame(heroShot)) || (selEp ? epCover(selEp) : cover);
          const q = feat ? Derived.qualityOf(feat) : { pass: 0, review: 0, fail: 0 };
          return U.page("工作台 / 今日制作台", "今天继续把这部戏做完", "从「下一步」直接进入制作，不用先翻一遍后台数据；待决策、阻塞与预算风险统一收在这一页。",
            U.btn("新建项目", "workspace.newProject") + U.btn("全部项目", "workspace.toProjects", "primary"),
            '<div class="studio-desk">' +
              '<section class="work-hero">' +
                (heroImg ? '<img src="' + U.esc(heroImg) + '" alt="' + U.esc(feat ? feat.name : "项目主视觉") + '">' : "") +
                '<div class="hero-top"><div class="left">' + U.pill(selEp ? selEp.status : (feat ? feat.status : "—")) + U.pill("第 " + (selEp ? selEp.no : "—") + " 集", "info") + "</div>" +
                  '<span class="est">' + U.esc(feat ? feat.ratio : "9:16") + " · " + U.esc(feat ? feat.duration : "90 秒 / 集") + "</span></div>" +
                '<div class="hero-body">' +
                  '<div class="hero-kicker">当前制作 · ' + U.esc(feat ? feat.name : "暂无项目") + "</div>" +
                  '<div class="hero-title">' + U.esc(selEp ? selEp.title : "还没有正在制作的项目") + "</div>" +
                  '<div class="hero-ep"><b>第 ' + (selEp ? selEp.no : "—") + " 集</b><span>" + (selEp ? selEp.scenes + " 场 · " + selEp.shots + " 镜 · " + selEp.duration : "") + "</span><span>已通过 " + (wf ? wf.passEps.length : 0) + " / " + (feat ? feat.episodes : 0) + " 集</span></div>" +
                  '<div class="hero-actions">' + U.btn("继续这一集", "workspace.openEp", "primary", { ep: selEp ? selEp.no : 0, pid: feat ? feat.id : "" }) +
                    U.btn("查看生成结果", "workspace.toVideo", "", { pid: feat ? feat.id : "" }) + U.btn("剧本与分镜", "workspace.toDirector", "", { pid: feat ? feat.id : "" }) + "</div>" +
                  '<div class="hero-scrub"><div class="bar"><i style="width:' + pct + '%"></i></div><div class="meta"><span>全剧进度 ' + pct + "%</span><span>预算已用 " + (feat ? Math.round(feat.actual / feat.budget * 100) : 0) + "% · 质检 " + q.pass + " 项通过</span></div></div>" +
                "</div>" +
              "</section>" +
              '<aside class="next-panel"><div class="np-head"><div><b>下一步</b><small>按状态机、门禁与阻塞实时计算</small></div>' + U.pill((wf ? wf.next.length : 0) + " 项", "accent") + "</div>" +
                '<div class="next-list">' +
                  (wf ? wf.next.slice(0, 4).map((x, i) =>
                    '<div class="next-item' + (i === 0 ? " on" : "") + '"><span class="no">' + (i + 1) + "</span><div><b>" + U.esc(x.title) + "</b><small>" + U.esc(x.why) + "</small></div>" +
                    U.btn(x.cta, x.action, "sm", { pid: feat.id }) + "</div>").join("") : U.empty("暂无项目", "先新建一个项目。")) +
                "</div>" +
                '<div class="next-foot">' + U.btn("打开制作流水线", "projects.wfOpen", "primary", { pid: feat ? feat.id : "" }) + U.btn("查看全部待办", "workspace.toNotify") + "</div>" +
              "</aside>" +
            "</div>" +
            U.card("生产链路", '<div class="pipeline">' + pipe.map((x, i) => '<a class="pipe-step ' + x[2] + '" href="#/' + U.esc(x[3]) + '?id=' + encodeURIComponent(feat ? feat.id : "") + '" title="进入' + U.esc(x[0]) + '阶段"><div class="ps-top"><span class="ps-no">' + String(i + 1).padStart(2, "0") + "</span><span class=\"dot\" style=\"color:" + (x[2] === "done" ? "#61d3a3" : x[2] === "now" ? "#eda45c" : "#3a4350") + '"></span></div><b>' + U.esc(x[0]) + "</b><small>" + U.esc(x[1]) + "</small></a>").join("") + "</div>",
              "完成度取自项目状态与任务事实；点击任意阶段进入该阶段页面") +
            '<div class="mt-4">' + U.card("分集", '<div class="ep-strip">' + eps.map(e => '<button type="button" class="ep-card' + (e.no === (selEp ? selEp.no : 0) ? " on" : "") + '" data-action="workspace.viewEp" data-ep="' + e.no + '">' +
              '<span class="ep-thumb">' + '<img src="' + U.esc(epCover(e)) + '" alt="">' + '<span class="ep-no">E' + String(e.no).padStart(2, "0") + '</span><span class="ep-state">' + U.esc(e.status) + "</span></span>" +
              '<span class="ep-body"><b>' + U.esc(e.title) + "</b><small>" + e.scenes + " 场 · " + e.shots + " 镜 · " + U.esc(e.duration) + "</small></span></button>").join("") +
              '<button type="button" class="tile-add" style="flex:0 0 130px;min-height:0" data-action="post.toEpisodes" data-id="' + U.esc(feat ? feat.id : "") + '"><b class="ta-num">' + (feat ? feat.episodes : 0) + '</b><span>全部集数</span><small>打开分集生产板 →</small></button></div>', "点击集卡切换上方预览") + "</div>" +
            '<div class="desk-bottom mt-4">' +
              U.card("待我决策", todos.length ? todos.slice(0, 4).map(n => '<div class="decision-row"><div><b>' + U.esc(n.title) + '</b><small>' + U.esc(n.type) + " · " + U.esc(n.impact || n.reason || "") + '</small></div><button class="btn sm" data-action="notify.handle" data-id="' + U.esc(n.id) + '">处理</button></div>').join("") : U.empty("今天没有待我决策事项", "负责人是本人的审核、阻塞与风险通知都为空。"),
                "按阻塞影响排序，不按时间倒序") +
              U.card("最近产出", '<div class="asset-strip">' + (activity.length ? activity.map(s => '<div class="asset-thumb">' + (U.storyFrame(s) ? '<img src="' + U.esc(U.storyFrame(s)) + '" alt="">' : "") + '<span>E' + s.ep + " " + U.esc(s.no) + "</span></div>").join("") : U.empty("暂无产出", "本集生成后将出现在这里。")) + "</div>" +
                '<div class="btn-row-inline">' + U.btn("查看本集结果", "workspace.toVideo", "sm", { pid: feat ? feat.id : "", ep: selEp ? selEp.no : 0 }) + U.btn("全部分镜", "workspace.toDirector", "sm", { pid: feat ? feat.id : "" }) + "</div>", "只展示当前项目最近生成") + "</div>" +
              U.card("成本与风险", '<div class="mini-kpis">' +
                '<div class="mini-kpi"><span>可见项目成本</span><b>¥' + h.cost.toLocaleString("zh-CN") + "</b><small>预算 ¥" + h.budget.toLocaleString("zh-CN") + " · 已用 " + h.budgetPct + "%</small></div>" +
                '<div class="mini-kpi"><span>进行中任务</span><b>' + h.tasks + "</b><small>排队 " + h.queued + " · 执行 " + h.running + "</small></div>" +
                '<div class="mini-kpi"><span>待我决策</span><b>' + todos.length + "</b><small>负责人是本人的待办通知</small></div>" +
                '<div class="mini-kpi"><span>质量通过</span><b>' + (q.pass + q.review + q.fail) + "</b><small>通过 " + q.pass + " · 需判 " + q.review + " · 未通过 " + q.fail + "</small></div></div>" +
                U.notice(suggestions[0][1], "info"), "口径与页脚一致，不做预测") +
            "</div>"
          );
        }
      },
      {
        path: "workspace/assistant", title: "指令式生产助手", icon: "pen", permission: "creation.write", menuOrder: 1,
        desc: "结构化动作解析：识别六类指令目标、抽取参数、校验权限/预算/资源，再交给现有业务流程执行。不做自由推理，不绕过校验。",
        render() {
          const parsed = App.get(SCOPE, "parsed", null);
          const history = App.get(SCOPE, "cmdHistory", []);
          return U.page("工作台 / 指令式生产助手", "指令式生产助手", "它不是一个会自己编排一切的 Agent：每条指令都必须落到既定动作上，超出动作清单的请求会被明确拒绝。",
            U.btn("查看可用指令", "workspace.cmdHelp") + U.btn("指令历史", "workspace.cmdHistory"),
            '<div class="split"><div class="stack">' +
              U.card("输入指令", '<label class="field-wrap full"><span class="field-label">自然语言指令（按关键词解析）</span><textarea class="field" id="cmd-input" rows="4" placeholder="例如：把《雾城来信》第 18 集第 1 场重新生成一版">' + U.esc(App.get(SCOPE, "cmd", "")) + '</textarea></label>' +
                '<div class="chip-row">' +
                ['新建一部 12 集都市悬疑短剧', '《雾城来信》现在做到哪一集了', '第 17 集 03 场 SH-05 重新生成', '发起《长街旧梦》交付', '这个月花了多少钱', '暂停《雾城来信》待执行任务'].map(t => '<button type="button" class="chip" data-action="workspace.sample" data-value="' + U.esc(t) + '">' + U.esc(t) + "</button>").join("") +
                "</div>" +
                '<div class="btn-row-inline">' + U.btn("解析指令", "workspace.parse", "primary") + U.btn("清空", "workspace.clearCmd") + "</div>", "解析过程对用户可见") +
              (parsed ? U.card("解析结果 · " + parsed.intent, '<div class="kv-grid">' + U.kv("识别目标", parsed.intent) + U.kv("置信", parsed.confidence) + U.kv("抽取参数", parsed.params) + U.kv("命中项目", parsed.project) + U.kv("权限校验", parsed.perm) + U.kv("预算预检", parsed.budget) + "</div>" +
                U.notice(parsed.note, parsed.kind || "info") +
                U.desc([["将执行的动作", parsed.action], ["影响范围", parsed.scope], ["是否需二次确认", parsed.confirm ? "是（高风险动作）" : "否"]]) +
                '<div class="btn-row-inline">' + U.btn(parsed.confirm ? "确认执行（高风险）" : "执行", "workspace.run", "primary") + U.btn("修改参数", "workspace.editParams") + "</div>", "解析不等于执行")
                : U.empty("尚未解析指令", "输入一句话或点选上方示例，静态原型会按关键词识别目标类型并展示抽取结果。", U.btn("解析示例指令", "workspace.parse"))) +
              U.card("可识别的六类目标", U.table(["目标类型", "触发词示例", "落到的业务流程", "风险等级"], [
                ["新建项目", "新建 / 创建一部…短剧", "项目创建 → 创意设定", "低"],
                ["查询进度", "做到哪一集 / 进度如何", "项目与集进度只读查询", "只读"],
                ["发起返工", "重新生成 / 返工 / 换一版", "质量返工 → 局部任务", "中"],
                ["发起交付", "交付 / 出包 / 打包", "终审校验 → 交付执行", "高（需确认）"],
                ["查询成本", "花了多少钱 / 成本", "成本台账只读查询", "只读"],
                ["暂停任务", "暂停 / 停下", "任务暂停 → 释放排队", "中"]
              ].map(r => "<tr><td class=\"cell-strong\">" + r[0] + '</td><td class="cell-wrap muted">' + r[1] + '</td><td class="cell-wrap">' + r[2] + "</td><td>" + U.pill(r[3]) + "</td></tr>").join("")), "超出清单的请求直接拒绝，不做「猜你想做」") +
              U.card("本次会话执行记录", U.table(["时间", "指令", "识别目标", "结果"], history.map(h =>
                '<tr><td class="idx">' + U.esc(h.time) + "</td><td class=\"cell-wrap\">" + U.esc(h.text) + "</td><td>" + U.esc(h.intent) + '</td><td class="cell-wrap">' + U.esc(h.result) + "</td></tr>").join(""), "本次会话尚未执行任何指令"), "只记录真实执行，不预置演示历史") +
            '</div><div class="stack">' +
              U.card("能力边界", U.listRows([
                ["不做的事", "自由推理与自主规划、跨项目自动编排、替用户决定预算或授权"],
                ["必须做的事", "每条指令落到既定动作、执行前校验权限/预算/资源、高风险动作二次确认"],
                ["越权请求", "识别后直接拒绝并说明所需权限，不尝试绕过"],
                ["凭据", "只使用当前员工本人或已授权的企业配置，不读取明文"],
                ["可追溯", "指令原文、解析结果、执行动作与结果写入审计"]
              ]), "结构化解析，不是 Agent") +
              U.card("确认机制", U.notice("「发起交付」「终止项目」「批量为全部集重跑」属于高风险动作：解析后展示影响范围与成本预估，必须由本人二次确认。", "warn") +
                U.listRows([["影响预估", "涉及集数、镜头数、预计成本、是否影响已交付版本"], ["撤销", "确认后 5 分钟内可撤回未派发任务"], ["记录", "确认人、时间、指令原文一并写入审计"]]) , "确认不是走形式") +
              U.card("静态原型说明", U.notice("本页展示指令解析与校验流程，不接入任何语言模型；解析结果由关键词规则生成，用于评审交互与信息结构。", "info")) +
            "</div></div>"
          );
        }
      },
      {
        path: "workspace/projects", title: "我的项目", icon: "folder", permission: "project.read",
        desc: "按「我负责 / 我参与 / 待我审核」三种关系组织，避免把授权参与等同于负责。",
        render() {
          const tab = App.get(SCOPE, "projTab", "own");
          const me = App.identity();
          const uid = me.userId;
          const visible = D.projects.filter(Derived.canViewProject);
          const own = visible.filter(p => p.ownerId === uid);
          const joined = visible.filter(p => p.ownerId !== uid && (p.members || []).some(m => m.userId === uid));
          const review = visible.filter(p => p.status.indexOf("待") >= 0 && (p.ownerId === uid || (p.members || []).some(m => m.userId === uid && m.role === "审核")));
          const list = tab === "own" ? own : tab === "join" ? joined : review;
          const roleOf = (p) => {
            if (p.ownerId === uid) return "负责人";
            const m = (p.members || []).find(x => x.userId === uid);
            return m ? m.role : "—";
          };
          return U.page("工作台 / 我的项目", "我的项目", "同一名员工可同时是某项目的负责人、另一项目的审核人；权限按项目独立判定。",
            U.btn("新建项目", "workspace.newProject", "primary"),
            U.card("", U.tabs([
              { value: "own", label: "我负责", count: own.length },
              { value: "join", label: "我参与", count: joined.length },
              { value: "review", label: "待我审核", count: review.length }
            ], tab, "workspace.tab") +
              U.table(["项目", "负责人", "我的角色", "阶段", "集数", "预算使用", "状态", "更新", "操作"], list.map(p =>
                '<tr><td>' + U.entity(p.name, p.id, "剧") + "</td><td>" + U.esc(p.owner) + '</td><td>' + U.pill(roleOf(p), p.ownerId === uid ? "accent" : "info") + "</td><td>" + U.esc(p.phase) + '</td><td class="num">' + p.done + " / " + p.episodes + "</td><td>" + U.miniBar(p.actual, p.budget) + '</td><td>' + U.pill(p.status) + '</td><td class="idx">' + U.esc(p.updated) + "</td><td>" + U.btn("打开", "projects.detail", "sm", { id: p.id }) + "</td></tr>").join(""), "该分类下暂无项目。"),
              "关系不同，操作权限不同") +
            '<div class="grid grid-3 mt-4">' +
              U.metric("我负责", String(own.length), "可编辑、可返还工、可发起交付", "▦") +
              U.metric("我参与", String(joined.length), "仅按授予的项目角色操作", "◇") +
              U.metric("待我审核", String(review.length), "审核结论留痕，不覆盖历史", "!") +
            "</div>"
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("workspace.newProject", () => App.go("projects/new"));
  App.on("workspace.toProjects", () => App.go("projects/list"));
  App.on("workspace.viewEp", (el) => {
    if (el && el.dataset && el.dataset.ep) App.set(SCOPE, "ep", Number(el.dataset.ep));
    App.refresh();
  });
  App.on("workspace.openEp", (el) => {
    const ep = Number(el && el.dataset && el.dataset.ep) || 0;
    if (ep) App.set(SCOPE, "ep", ep);
    const q = { id: (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "") };
    if (ep) q.ep = ep;
    App.go("video/production", q);
  });
  App.on("workspace.assistantLink", () => App.go("workspace/assistant"));
  App.on("workspace.toNotify", () => App.go("notify/inbox"));
  App.on("workspace.toCreation", (el) => App.go("creation/brief", { id: (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "") }));
  App.on("workspace.toDirector", (el) => App.go("director/plan", { id: (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "") }));
  App.on("workspace.toVideo", (el) => {
    const q = { id: (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "") };
    const ep = Number(el && el.dataset && el.dataset.ep) || 0;
    if (ep) q.ep = ep;
    App.go("video/production", q);
  });
  App.on("workspace.toPost", (el) => App.go("post/timeline", { id: (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "") }));
  App.on("workspace.toQuality", (el) => App.go("quality/reports", { id: (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "") }));
  App.on("workspace.toCost", (el) => App.go("cost/ledger", { id: (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "") }));
  App.on("workspace.tab", (el) => { App.set(SCOPE, "projTab", el.dataset.value); App.refresh(); });

  App.on("workspace.sample", (el) => {
    App.set(SCOPE, "cmd", el.dataset.value);
    App.set(SCOPE, "parsed", null);
    App.refresh();
  });
  App.on("workspace.clearCmd", () => { App.set(SCOPE, "cmd", ""); App.set(SCOPE, "parsed", null); App.refresh(); });
  App.on("workspace.parse", () => {
    if (!App.guard("creation.write")) return;
    const input = document.getElementById("cmd-input");
    const text = (input && input.value) || App.get(SCOPE, "cmd", "");
    App.set(SCOPE, "cmd", text);
    if (!text.trim()) { App.toast("请输入指令内容", "bad"); return; }
    const rules = [
      { k: /新建|创建|立项|来一部|做一部/, intent: "新建项目", action: "创建项目草稿并进入创意设定", scope: "新建对象，不修改既有项目", confirm: false, perm: "project.create 已具备", budget: "按默认单集预算 ¥800 预占", params: "集数 / 题材 / 时长（未给则用默认）", confidence: "高", note: "已识别为立项指令：将生成项目草稿，不会自动开始生产。", kind: "ok" },
      { k: /进度|做到哪|完成到|第几集/, intent: "查询进度", action: "读取项目阶段与集进度", scope: "只读，不产生费用", confirm: false, perm: "project.read 已具备", budget: "不涉及", params: "项目名 → 已匹配「雾城来信 SP-26031」", confidence: "高", note: "进度：已完成 16 / 24 集，当前阶段「视频生产」。", kind: "info" },
      { k: /重新生成|返工|换一版|重做/, intent: "发起返工", action: "创建局部重生成任务（仅指定镜头）", scope: "E17 / S03 / SH-05，其余镜头不变", confirm: false, perm: "production.write 已具备", budget: "预计 ¥44，预算余额充足", params: "集 / 场 / 镜头 / 参考版本", confidence: "中", note: "返工按镜头粒度执行，不整集重跑；新尝试单独计费并保留原结果。", kind: "warn" },
      { k: /交付|出包|打包|上线/, intent: "发起交付", action: "执行终审校验 → 生成交付包", scope: "整剧 12 集，将冻结交付 V1", confirm: true, perm: "delivery.execute 已具备", budget: "交付本身不计费；校验不计费", params: "项目 → 长街旧梦 SP-26019", confidence: "高", note: "高风险动作：交付后版本冻结，新版本只能追加链，不能覆盖。", kind: "warn" },
      { k: /花|成本|费用|预算/, intent: "查询成本", action: "读取成本台账与预算状态", scope: "只读本人可见范围", confirm: false, perm: "cost.read 已具备", budget: "不涉及", params: "时间范围 → 本月", confidence: "高", note: "本月实际 ¥4,280，含失败任务 ¥612；待核实 ¥0。", kind: "info" },
      { k: /暂停|停下|先别跑/, intent: "暂停任务", action: "暂停当前项目待执行任务", scope: "仅待执行 / 排队中任务；执行中任务不强制中断", confirm: false, perm: "task.operate 已具备", budget: "已发生费用仍入账", params: "范围 → 当前项目待执行", confidence: "高", note: "暂停只停止派发，不取消已提交供应商的任务，避免产生不可回收费用。", kind: "warn" }
    ];
    const hit = rules.find(r => r.k.test(text));
    if (!hit) {
      App.set(SCOPE, "parsed", { intent: "未识别", confidence: "低", params: "—", project: "—", perm: "不适用", budget: "不适用", action: "拒绝执行", scope: "—", confirm: false, note: "指令未落到六类既定动作上。请改用具体动作，例如「重新生成第 17 集 03 场 SH-05」。", kind: "bad" });
      App.refresh();
      return;
    }
    const visible = D.projects.filter(Derived.canViewProject);
    const named = visible.find(p => text.indexOf(p.name) >= 0);
    const fallbackId = ((App.currentProject() || {}).id || "");
    const target = named || visible.find(p => p.id === fallbackId) || visible[0];
    const pendingShot = target ? (D.shots.find(s => s.project === target.id && s.status !== "已通过") || D.shots.find(s => s.project === target.id)) : null;
    const bg = target ? Store.budgetOf(target.id) : null;
    let params = hit.params, scope = hit.scope, note = hit.note, budget = hit.budget;
    if (target) {
      params = "项目 → " + target.id + " " + target.name;
      if (hit.intent === "查询进度") {
        note = "进度：" + target.done + " / " + target.episodes + " 集，当前阶段「" + target.phase + "」，状态「" + target.status + "」。";
      } else if (hit.intent === "发起返工") {
        scope = pendingShot ? "E" + pendingShot.ep + " / S" + pendingShot.scene + " / " + pendingShot.id + "，其余镜头不变" : "当前项目没有可返工镜头";
        note = pendingShot ? "返工按镜头粒度执行，不整集重跑；新尝试单独计费并保留原结果。" : "当前项目没有可分镜镜头，执行阶段会被阻断。";
        budget = "按镜头任务计费" + (bg ? "；项目预算剩余 ¥" + Store.money(Math.max(0, bg.total - bg.used)) : "；项目尚未建立预算");
      } else if (hit.intent === "发起交付") {
        scope = "整剧 " + target.episodes + " 集，执行前会重新校验交付门禁";
        note = "高风险动作：交付后版本冻结，新版本只能追加链，不能覆盖。";
      } else if (hit.intent === "查询成本") {
        note = "项目已入账 ¥" + Store.money(target.actual) + "，预算 ¥" + Store.money(target.budget) + "；失败任务成本同样入账。";
      } else if (hit.intent === "暂停任务") {
        const queued = D.tasks.filter(t => t.project === target.id && ["待执行", "排队中"].indexOf(t.status) >= 0);
        scope = queued.length ? "《" + target.name + "》待执行 / 排队中 " + queued.length + " 个任务，执行中任务不强制中断" : "《" + target.name + "》当前没有待执行或排队中任务";
        note = queued.length ? "暂停只停止派发，恢复后重新排队；已发生费用仍入账。" : "没有可暂停任务时不会伪造暂停结果。";
      }
    }
    App.set(SCOPE, "parsed", {
      intent: hit.intent, confidence: hit.confidence, params: params, project: target ? target.id : "按上下文推断",
      perm: hit.perm, budget: budget, action: hit.action, scope: scope, confirm: hit.confirm, note: note, kind: hit.kind
    });
    App.refresh();
  });
  App.on("workspace.cmdHelp", () => {
    App.drawer("可用指令清单", U.table(["目标", "示例话术", "风险"], [
      ["新建项目", "新建一部 12 集都市悬疑短剧", "低"],
      ["查询进度", "《雾城来信》现在做到哪一集了", "只读"],
      ["发起返工", "第 17 集 03 场 SH-05 重新生成", "中"],
      ["发起交付", "发起《长街旧梦》交付", "高 · 需确认"],
      ["查询成本", "这个月花了多少钱", "只读"],
      ["暂停任务", "暂停《雾城来信》待执行任务", "中"]
    ].map(r => "<tr><td>" + r[0] + '</td><td class="cell-wrap">' + r[1] + "</td><td>" + U.pill(r[2]) + "</td></tr>").join("")) +
      U.notice("不支持「把整部剧自动做完」这类开放式编排请求：原型与业务都不提供全自动导演 Agent。", "warn"));
  });
  App.on("workspace.cmdHistory", () => {
    const history = App.get(SCOPE, "cmdHistory", []);
    App.drawer("指令执行记录 · 本次会话", history.length
      ? U.timeline(history.map(h => ({ time: h.time, title: h.intent + " · " + h.result, desc: h.text })))
      : U.empty("本次会话还没有执行记录", "解析指令并点击执行后，真实动作与结果会记录在这里。"));
  });
})();

/* ===== v9.1 真实流程层：一句话指令按意图调用真实动作 ===== */
(function () {
  const U = UI, D = DB;
  const SCOPE = "workspace";

  function recordCmd(intent, text, result) {
    const now = new Date();
    const time = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    const list = App.get(SCOPE, "cmdHistory", []);
    list.unshift({ time: time, intent: intent, text: text, result: result });
    App.set(SCOPE, "cmdHistory", list.slice(0, 20));
  }

  App.on("workspace.run", () => {
    const p = App.get(SCOPE, "parsed", null);
    if (!p) { App.toast("请先解析指令", "bad"); return; }
    const text = App.get(SCOPE, "cmd", "");
    const requested = /^SP-\d{5}$/.test(String(p.project)) ? p.project : "";
    const pj = requested ? App.currentProject({ id: requested }) : App.currentProject({});
    if (!pj) { App.toast("当前没有可执行的项目，或指令指向的项目不在可见范围", "bad"); return; }
    const highRisk = p.confirm;

    const exec = () => {
      if (p.intent === "新建项目") {
        App.set(SCOPE, "parsed", null);
        recordCmd(p.intent, text, "已跳转立项页，待确认名称与预算");
        App.toast("立项需确认名称与预算，已进入立项页");
        App.go("projects/new");
        return;
      }
      if (p.intent === "查询进度") {
        App.set(SCOPE, "parsed", null);
        recordCmd(p.intent, text, "已查询 " + pj.name + "：" + pj.done + " / " + pj.episodes + " 集");
        App.drawer("进度查询 · " + pj.name, U.desc([["项目", pj.id + " · " + pj.name], ["状态", pj.status], ["阶段", pj.phase], ["集进度", pj.done + " / " + pj.episodes], ["预算", "¥" + pj.budget + "（已用 ¥" + pj.actual + "）"], ["更新时间", String(pj.updated)]]) +
          '<div class="btn-row-inline">' + U.btn("进入项目", "projects.detail", "primary", { id: pj.id }) + "</div>");
        Store.log("指令助手", "查询进度：" + text, "成功", "cmd");
        return;
      }
      if (p.intent === "发起返工") {
        if (["已交付", "已归档"].indexOf(pj.status) >= 0) { App.toast("《" + pj.name + "》已交付，不能直接返工；请新建版本链后再执行", "bad"); return; }
        const s = D.shots.find(x => x.project === pj.id && x.status !== "已通过") || D.shots.find(x => x.project === pj.id);
        if (!s) { App.toast("《" + pj.name + "》没有可分镜镜头，无法按指令返工", "bad"); return; }
        App.set(SCOPE, "parsed", null);
        App.job({
          title: "按指令发起返工", steps: ["校验镜头状态", "创建任务并排队", "写审计"],
          run() {
            const r = Store.ops.submitTask({ project: s.project, shot: s.id, model: "视频模型 A", priority: "高" });
            if (!r.ok) return r;
            Store.log("指令助手", "返工指令：" + text + " → " + r.data.id, "成功", r.data.id);
            return { ok: true, msg: "已按指令创建返工任务 " + r.data.id + "（镜头 " + s.id + "，其余不变）", taskId: r.data.id };
          },
          after(out) {
            if (out && out.ok) recordCmd(p.intent, text, "已创建任务 " + (out.taskId || ""));
            App.refresh();
          }
        });
        return;
      }
      if (p.intent === "发起交付") {
        App.set(SCOPE, "parsed", null);
        App.job({
          title: "交付前门禁校验", steps: ["读取交付门禁", "校验审核与授权", "定位缺口"],
          run() {
            const g = Store.gate(pj.id, "交付");
            const bad = g.items.filter(i => !i.ok);
            return { ok: true, msg: pj.id + " 交付门禁：" + (bad.length ? "未通过 " + bad.length + " 项（" + bad.map(b => b.label).join("、") + "）" : "全部通过") + "；已跳转交付页复核" };
          },
          after(out) {
            recordCmd(p.intent, text, out && out.msg ? out.msg : "已执行交付门禁校验");
            App.go("post/delivery", { id: pj.id });
          }
        });
        return;
      }
      if (p.intent === "查询成本") {
        App.set(SCOPE, "parsed", null);
        recordCmd(p.intent, text, "已打开 " + pj.name + " 成本台账");
        Store.log("指令助手", "成本查询：" + text, "成功", "cmd");
        App.go("cost/ledger", { id: pj.id });
        return;
      }
      if (p.intent === "暂停任务") {
        const queued = D.tasks.filter(t => t.project === pj.id && ["待执行", "排队中"].indexOf(t.status) >= 0);
        if (!queued.length) {
          recordCmd(p.intent, text, "《" + pj.name + "》没有待执行任务，未执行暂停");
          App.toast("《" + pj.name + "》当前没有待执行或排队中任务", "bad");
          return;
        }
        App.set(SCOPE, "parsed", null);
        App.job({
          title: "暂停项目任务", steps: ["读取当前项目待执行任务", "标记为已暂停", "写审计"],
          run() {
            queued.forEach(t => { t.status = "已暂停"; });
            Store.log("指令助手", "暂停《" + pj.name + "》" + queued.length + " 个待执行任务：" + text, "成功", "cmd");
            return { ok: true, msg: "《" + pj.name + "》已暂停 " + queued.length + " 个待执行任务；执行中任务保持运行" };
          },
          after(out) { recordCmd(p.intent, text, out && out.ok ? out.msg : "暂停失败"); App.refresh(); }
        });
        return;
      }
      App.set(SCOPE, "parsed", null);
      recordCmd(p.intent, text, "未执行：需在对应模块完成具体操作");
      App.toast("该意图需在对应模块中完成具体操作，指令助手只做定位与跳转");
      App.go("workspace/home");
    };

    if (highRisk) {
      App.modal({
        title: "确认执行高风险指令", sub: "影响范围：" + p.scope,
        body: U.notice("指令原文：" + text, "info") + U.fTextarea("确认说明", "note", { required: true, minlen: 8, rows: 3, placeholder: "说明确认依据与影响接受情况" }),
        submitText: "确认执行",
        onSubmit(d) { Store.log("指令助手", "高风险指令确认：" + text + " · " + d.note, "成功", "cmd"); exec(); }
      });
      return;
    }
    exec();
  });

  App.on("workspace.editParams", () => {
    const p = App.get(SCOPE, "parsed", null);
    if (!p) { App.toast("请先解析指令", "bad"); return; }
    App.modal({
      title: "补全指令参数", sub: "修正解析结果后再执行，避免误操作",
      body: U.fTextarea("指令原文", "cmd", { required: true, minlen: 4, rows: 3, value: App.get(SCOPE, "cmd", "") }) +
        U.notice("修改后将重新解析；原解析结果作废。", "warn"),
      submitText: "重新解析",
      onSubmit(d) {
        App.set(SCOPE, "cmd", d.cmd);
        App.set(SCOPE, "parsed", null);
        App.toast("已更新指令原文，请重新解析");
        App.refresh();
      }
    });
  });
})();

