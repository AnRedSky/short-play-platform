/* 模块：workspace 员工工作台（员工端） */
(function () {
  const U = UI, D = DB, SCOPE = "workspace";
  const me = () => App.identity();

  function myProjects() {
    return DB.derived.myProjects(me());
  }

  AppModule.register({
    group: "workspace", label: "我的工作台", icon: "home", order: 1, end: "workspace",
    routes: [
      {
        path: "workspace/home", title: "工作台首页", icon: "home", permission: ["project.read", "platform.read"],
        desc: "一名员工可独立完成整部短剧：从创意到交付的全部入口都在这里，跨部门协作是可选的授权行为。",
        render() {
          const mine = myProjects();
          const h = DB.derived.home(me());
          const ids = DB.derived.visibleProjects(me()).map(p => p.id);
          const actor = DB.derived.actorUser(me()) || {};
          /* 待我处理：唯一取数口（通知表）。禁止再按 owner 姓名或 type 各过滤一遍。 */
          const duty = DB.derived.duties(me());
          const todos = duty.items.slice(0, 5);
          const risks = D.risks.filter(r => ids.indexOf(r.project) >= 0 && r.status !== "已闭环").slice(0, 2);
          const blocked = D.tasks.filter(t => ids.indexOf(t.project) >= 0 && t.status === "待人工处理").slice(0, 2);
          const ctxProject = App.currentProject();
          const feat = (ctxProject && mine.find(p => p.id === ctxProject.id)) || mine.find(p => p.status === "生产中") || mine[0];
          const wf = feat ? DB.derived.workflow(feat) : null;
          const eps = wf ? wf.eps : [];
          const selNo = Number(App.get(SCOPE, "ep", (eps.find(e => e.qc !== "PASS") || eps[0] || {}).no || 0));
          const selEp = eps.find(e => e.no === selNo) || eps[0];
          const mineShots = wf ? wf.shots : [];
          const hot = mine.filter(p => { const b = DB.derived.budgetOfProject(p); return b.set && b.pct >= (D.pricing ? D.pricing.budgetWarnRate * 100 : 85); })[0] || null;
          const u = DB.derived.actorUser(me());
          const badProviders = D.providers.filter(x => x.status !== "启用" && u && x.ownerId === u.id).slice(0, 1);
          const pct = wf ? wf.pct : 0;
          const stagePage = { script: "creation/script", breakdown: "creation/breakdown", plan: "director/plan", video: "video/production", post: "audio/subtitle", qc: "quality/reports", final: "post/review", delivery: "post/delivery" };
          const pipe = wf ? wf.stages.map(s => [s.label, s.meta, s.state === "done" ? "done" : s.state === "now" ? "now" : "wait", stagePage[s.key]]) : [];
          const suggestions = []
            .concat(blocked.map(t => [t.id + " · " + t.kind, "待人工处理：" + t.failReason]))
            .concat(risks.map(r => [r.project, r.type + "（" + r.status + "）→ " + (r.action || "需确认处置")]))
            .concat(hot ? [[hot.id, "已用 " + DB.derived.budgetOfProject(hot).pct + "%，需负责人确认或追加预算"]] : [])
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
          const q = feat ? DB.derived.qualityOf(feat) : { pass: 0, review: 0, fail: 0 };
          /* 待我处理：与上方待办卡、mini-kpi 共用同一份列表（DB.derived.duties），禁止各算一遍 */
          const reviewOpenList = duty.items.slice(0, 8);
          const reviewOpen = duty.total;
          /* 最近交付作品：仅终审通过并确认交付的作品计入有效产出 */
          const deliveries = D.deliveries.filter(d => ids.indexOf(d.project) >= 0 && ["已交付", "已归档"].indexOf(d.status) >= 0).slice(0, 6);
          /* 个人资源可用状态：本人名下配置（企业托管资源单列） */
          const ownProviders = D.providers.filter(x => u && x.ownerId === u.id);
          /* R-21：链路只留一行摘要，逐阶段明细属于制作流水线 */
          const pipeDone = wf ? wf.stages.filter(s => s.state === "done").length : 0;
          const pipeTotal = wf ? wf.stages.length : 0;
          const pipeNow = (wf && (wf.stages.find(s => s.state === "now") || {}).label) || "未开始";
          return U.page("工作台 / 今日制作台", "今天继续把这部戏做完", "从「下一步」直接进入制作，不用先翻一遍后台数据；待决策、阻塞与预算风险统一收在这一页。",
            U.btn("新建项目", "projects.new") + U.btn("制作流水线", "projects.wfOpen", "primary", { pid: feat ? feat.id : "" }),
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
                    U.btn("生产队列", "workspace.toVideo", "", { pid: feat ? feat.id : "" }) + U.btn("镜头计划", "workspace.toDirector", "", { pid: feat ? feat.id : "" }) + "</div>" +
                  '<div class="hero-scrub"><div class="bar"><i style="width:' + pct + '%"></i></div><div class="meta"><span>全剧进度 ' + pct + "%</span><span>预算已用 " + (feat ? DB.derived.budgetOfProject(feat).pct : 0) + "% · 质检 " + q.pass + " 项通过</span></div></div>" +
                "</div>" +
              "</section>" +
              '<aside class="next-panel"><div class="np-head"><div><b>下一步</b><small>按状态机、门禁与阻塞实时计算</small></div>' + U.pill((wf ? wf.next.length : 0) + " 项", "accent") + "</div>" +
                '<div class="next-list">' +
                  (wf ? wf.next.slice(0, 4).map((x, i) =>
                    '<div class="next-item' + (i === 0 ? " on" : "") + '"><span class="no">' + (i + 1) + "</span><div><b>" + U.esc(x.title) + "</b><small>" + U.esc(x.why) + "</small></div>" +
                    U.btn(x.cta, x.action, "sm", { pid: feat.id }) + "</div>").join("") : U.empty("暂无项目", "先新建一个项目。")) +
                "</div>" +
                '<div class="next-foot">' + U.btn("查看全部待办", "workspace.toNotify") + "</div>" +
              "</aside>" +
            "</div>" +
            U.notice('<b>制作链路</b> ' + pipeDone + " / " + pipeTotal + " 阶段完成 · 当前阶段：" + U.esc(pipeNow) + "。阶段逐项状态、闸门与集级明细在制作流水线查看。", "info") +
            '<div class="mt-4">' + U.card("分集", '<div class="ep-strip">' + eps.map(e => '<button type="button" class="ep-card' + (e.no === (selEp ? selEp.no : 0) ? " on" : "") + '" data-action="workspace.viewEp" data-ep="' + e.no + '">' +
              '<span class="ep-thumb">' + '<img src="' + U.esc(epCover(e)) + '" alt="">' + '<span class="ep-no">E' + String(e.no).padStart(2, "0") + '</span><span class="ep-state">' + U.esc(e.status) + "</span></span>" +
              '<span class="ep-body"><b>' + U.esc(e.title) + "</b><small>" + e.scenes + " 场 · " + e.shots + " 镜 · " + U.esc(e.duration) + "</small></span></button>").join("") +
              '<button type="button" class="tile-add" style="flex:0 0 130px;min-height:0" data-action="post.toEpisodes" data-id="' + U.esc(feat ? feat.id : "") + '"><b class="ta-num">' + (feat ? feat.episodes : 0) + '</b><span>全部集数</span><small>打开分集生产板 →</small></button></div>', "点击集卡切换上方预览") + "</div>" +
            U.card("今日待办", U.notice(suggestions[0][1], "warn") + (todos.length ? todos.map(n => '<div class="decision-row"><div><b>' + U.esc(n.title) + '</b><small>' + U.esc(n.type) + " · " + U.esc(n.impact || n.reason || "") + '</small></div><button class="btn sm" data-action="notify.handle" data-id="' + U.esc(n.id) + '">处理</button></div>').join("") : U.empty("今天没有待我处理事项", "负责人是本人的审核、阻塞与风险通知都为空。")),
              "按阻塞影响排序，不按时间倒序；计数与指标同一份 duties", U.pill(reviewOpen + " 件", "accent")) +
            /* 工作台信息展示十项（业务方案 §20.3）：待审核事项 / 最近交付作品 / AI 生成消耗 / 个人资源可用状态 */
            '<div class="grid grid-3 mt-4">' +
              U.metric("最近交付作品", String(h.deliveries), "已交付 / 已归档 " + h.deliveredEpisodes + " 集", "交") +
              U.metric("AI 生成消耗", "¥" + h.cost.toLocaleString("zh-CN"), "预算 ¥" + h.budget.toLocaleString("zh-CN") + " · 已用 " + h.budgetPct + "%", "¥") +
              U.metric("个人资源可用", String(ownProviders.length) + " / " + String(ownProviders.length + badProviders.length), badProviders.length ? "失效 " + badProviders.length + " 项，任务已暂停" : "全部通过连通性测试", "⚙") +
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
                ['新建一部 60 集都市情感短剧', '根据当前创意生成完整剧本', '检查当前剧本的人物与剧情逻辑', '按剧本开始自动制作', '检查人物视觉一致性', '重新生成第 8 集不合格镜头', '优化第 10 集剧情节奏', '暂停当前视频生产', '检查整部短剧的音视频质量', '把审核通过的内容整理成交付包'].map(t => '<button type="button" class="chip" data-action="workspace.sample" data-value="' + U.esc(t) + '">' + U.esc(t) + "</button>").join("") +
                "</div>" +
                '<div class="btn-row-inline">' + U.btn("解析指令", "workspace.parse", "primary") + U.btn("清空", "workspace.clearCmd") + "</div>", "解析过程对用户可见") +
              (parsed ? U.card("解析结果 · " + parsed.intent, '<div class="kv-grid">' + U.kv("识别目标", parsed.intent) + U.kv("置信", parsed.confidence) + U.kv("抽取参数", parsed.params) + U.kv("命中项目", parsed.project) + U.kv("权限校验", parsed.perm) + U.kv("预算预检", parsed.budget) + "</div>" +
                U.notice(parsed.note, parsed.kind || "info") +
                U.desc([["将执行的动作", parsed.action], ["影响范围", parsed.scope], ["是否需二次确认", parsed.confirm ? "是（高风险动作）" : "否"]]) +
                (parsed.needTarget ? '<div class="field-wrap full"><span class="field-label">目标不唯一，请先指定项目</span><select class="field" id="cmd-target">' + (parsed.candidates || []).map(c => '<option value="' + U.esc(c.id) + '">' + U.esc(c.label) + "</option>").join("") + '</select><span class="field-hint">指令未指明目标项目且存在多个可见项目，必须先确认目标，不允许凭猜测执行。</span></div>' +
                  '<div class="btn-row-inline">' + U.btn("指定项目并重新解析", "workspace.pickTarget", "primary") + "</div>"
                  : '<div class="btn-row-inline">' + U.btn(parsed.confirm ? "确认执行（高风险）" : "执行", "workspace.run", "primary") + U.btn("修改参数", "workspace.editParams") + "</div>"),
                "解析不等于执行")
                : U.empty("尚未解析指令", "输入一句话或点选上方示例，静态原型会按关键词识别目标类型并展示抽取结果。")) +
              U.card("可识别的目标类型（业务方案 §20.4）", U.table(["目标类型", "触发词示例", "落到的业务流程", "风险等级"], [
                ["新建项目", "新建 / 创建一部…短剧", "项目创建 → 创意设定", "低"],
                ["生成候选剧本", "生成完整剧本 / 根据当前创意生成剧本", "剧本生成 → 待剧本审核", "低"],
                ["剧本逻辑自检", "检查剧本的人物与剧情逻辑", "结构与逻辑自检（只读）", "只读"],
                ["优化剧情节奏", "优化第 N 集剧情节奏", "剧本修订 → 回到剧本创作中", "高（需确认）"],
                ["人物视觉一致性检查", "检查人物视觉一致性 / 抽检", "视觉资产一致性抽检", "只读"],
                ["整剧质量检测", "检查整部短剧的音视频质量", "整剧级检测 → 返工 / 终审", "低"],
                ["按剧本启动生产", "按剧本开始自动制作", "镜头任务提交 → 下载持久化 → 质检", "高（需确认）"],
                ["发起返工", "重新生成 / 返工 / 换一版", "质量返工 → 局部任务", "中"],
                ["终止项目", "终止项目 / 放弃项目", "记录原因 → 取消未执行任务", "高（需确认）"],
                ["删除已确认资产", "删除某素材 / 资产", "引用检查 → 逻辑删除", "高（需确认）"],
                ["调整预算", "追加预算 / 预算超限", "预算调整 → 重新预检派发", "高（需确认）"],
                ["发起交付", "交付 / 出包 / 打包", "终审校验 → 交付执行", "高（需确认）"],
                ["查询成本", "花了多少钱 / 成本", "成本台账只读查询", "只读"],
                ["暂停任务", "暂停 / 停下", "任务暂停 → 释放排队", "中"],
                ["查询进度", "做到哪一集 / 进度如何", "项目与集进度只读查询", "只读"]
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
              U.notice("口径与规则见《口径与规则汇总》§R-43：静态原型说明", "info") +
            "</div></div>"
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
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
  App.on("workspace.toScript", (el) => App.go("creation/script", { id: (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "") }));
  App.on("workspace.toCast", (el) => App.go("director/cast", { id: (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "") }));
  App.on("workspace.toQuality", (el) => App.go("quality/reports", { id: (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "") }));
  App.on("workspace.toCost", (el) => App.go("cost/ledger", { id: (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "") }));

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
      /* 规则顺序即匹配优先级；每条规则都落到一个既定业务动作上（业务方案 §20.4） */
      { k: /新建|创建|立项|来一部|做一部/, intent: "新建项目", action: "创建项目草稿并进入创意设定", scope: "新建对象，不修改既有项目", confirm: false, permCode: "project.create", budget: "按默认单集预算 ¥800 预占", params: "集数 / 题材 / 时长（未给则用默认）", confidence: "高", note: "已识别为立项指令：将生成项目草稿，不会自动开始生产。", kind: "ok", needProject: false },
      { k: /生成完整剧本|生成剧本|写剧本|根据.*创意.*剧本/, intent: "生成候选剧本", action: "按已选定创意方案生成候选剧本版本 → 进入待剧本审核", scope: "当前项目；生成新版本，不覆盖历史版本", confirm: false, permCode: "creation.write", budget: "预计 ¥8（文本生成）；预算不足时阻止启动", params: "项目 / 集数 / 时长（取自项目属性）", confidence: "高", note: "生成的是候选版本，必须经剧本审核（节点 A）锁定后才能作为下游基准。", kind: "ok", needProject: true },
      { k: /检查.*剧本|人物.*逻辑|剧情逻辑|自检|连续性检查/, intent: "剧本逻辑自检", action: "对当前正式剧本执行结构与逻辑自检（动机 / 时间线 / 设定冲突 / 重复对白）", scope: "只读检查，输出问题位置，不修改剧本", confirm: false, permCode: "creation.write", budget: "不涉及", params: "项目 / 剧本版本", confidence: "中", note: "自检只输出结论与定位，不自动改写剧本；修改需走剧本变更流程。", kind: "info", needProject: true },
      { k: /优化.*节奏|节奏.*优化|调整.*节奏/, intent: "优化剧情节奏", action: "按目标集发起剧本节奏修订（回到剧本创作中）", scope: "指定集；该集及下游需重新审核", confirm: true, permCode: "script.review", budget: "预计 ¥8（文本生成）", params: "集号 / 优化目标", confidence: "中", note: "正式剧本重大变更需二次确认；确认后创建修订任务并回到剧本创作中。", kind: "warn", needProject: true },
      { k: /视觉一致|人物一致|一致性检查|抽检/, intent: "人物视觉一致性检查", action: "对人物参考资产执行一致性抽检并输出检查项", scope: "当前项目的人物 / 场景视觉档案", confirm: false, permCode: "director.write", budget: "不涉及", params: "项目 / 资产范围", confidence: "中", note: "抽检不合格的资产不得固化；修改需产生新版本。", kind: "info", needProject: true },
      { k: /音视频质量|整剧.*质量|质量检测|质检/, intent: "整剧质量检测", action: "执行整剧级检测（剧情连续性 / 风格统一 / 集数完整 / 合规 / 交付完整）", scope: "当前项目全剧；不通过项进入返工", confirm: false, permCode: "quality.read", budget: "预计 ¥14（质检模型）", params: "项目 / 检测层级", confidence: "高", note: "检测结果按 PASS / 需人工判断 / 未通过分级；未通过项不可进入终审。", kind: "info", needProject: true },
      { k: /开始自动制作|按剧本.*制作|开始生产|自动制作|开始制作/, intent: "按剧本启动生产", action: "提交镜头生产任务 → 下载持久化 → 镜头级质检", scope: "当前项目待生产分集（批量）", confirm: true, permCode: "production.write", budget: "按镜头任务计费，逐镜扣费", params: "项目 / 起始集", confidence: "高", note: "批量返工与批量生产属于高风险动作，确认后按集推进并在预算不足处自动阻断。", kind: "warn", needProject: true },
      { k: /重新生成|返工|换一版|重做/, intent: "发起返工", action: "创建局部重生成任务（仅指定镜头）", scope: "E17 / S03 / SH-05，其余镜头不变", confirm: false, permCode: "production.write", budget: "预计 ¥44，预算余额充足", params: "集 / 场 / 镜头 / 参考版本", confidence: "中", note: "返工按镜头粒度执行，不整集重跑；新尝试单独计费并保留原结果。", kind: "warn", needProject: true },
      { k: /终止项目|终止.*项目|放弃项目/, intent: "终止项目", action: "记录终止原因并取消未执行的下游任务", scope: "整个项目；已完成资产、任务记录与费用保留", confirm: true, permCode: "project.manage", budget: "已发生费用仍入账", params: "项目 / 终止原因", confidence: "高", note: "项目终止为终态：下游计划取消，历史记录不可改写。", kind: "bad", needProject: true },
      { k: /删除.*资产|删掉.*素材|删除素材/, intent: "删除已确认资产", action: "执行删除前引用检查 → 逻辑删除", scope: "指定资产；被引用资产一律阻断", confirm: true, permCode: "asset.manage", budget: "不涉及", params: "资产编号 / 原因", confidence: "中", note: "删除已确认资产属于高风险动作；存在引用时必须先解除引用或改为归档。", kind: "bad", needProject: true },
      { k: /追加预算|提高预算|调预算|超预算|预算不够/, intent: "调整预算", action: "调整项目预算并重算预算状态", scope: "当前项目预算", confirm: true, permCode: "cost.manage", budget: "调整后重新预检任务派发", params: "项目 / 目标金额 / 理由", confidence: "高", note: "预算超限需二次确认；预算冻结时禁止派发新任务，已发生费用仍入账。", kind: "warn", needProject: true },
      { k: /交付|出包|打包|上线/, intent: "发起交付", action: "执行终审校验 → 生成交付包", scope: "整剧 12 集，将冻结交付 V1", confirm: true, permCode: "delivery.execute", budget: "交付本身不计费；校验不计费", params: "项目 → 长街旧梦 SP-26019", confidence: "高", note: "高风险动作：交付后版本冻结，新版本只能追加链，不能覆盖。", kind: "warn", needProject: true },
      { k: /花|成本|费用/, intent: "查询成本", action: "读取成本台账与预算状态", scope: "只读本人可见范围", confirm: false, permCode: "cost.read", budget: "不涉及", params: "时间范围 → 本月", confidence: "高", note: "本月实际 ¥4,280，含失败任务 ¥612；待核实 ¥0。", kind: "info", needProject: true },
      { k: /暂停|停下|先别跑/, intent: "暂停任务", action: "暂停当前项目待执行任务", scope: "仅待执行 / 排队中任务；执行中任务不强制中断", confirm: false, permCode: "task.operate", budget: "已发生费用仍入账", params: "范围 → 当前项目待执行", confidence: "高", note: "暂停只停止派发，不取消已提交供应商的任务，避免产生不可回收费用。", kind: "warn", needProject: true },
      { k: /进度|做到哪|完成到|第几集/, intent: "查询进度", action: "读取项目阶段与集进度", scope: "只读，不产生费用", confirm: false, permCode: "project.read", budget: "不涉及", params: "项目名 → 已匹配「雾城来信 SP-26031」", confidence: "高", note: "进度：已完成 16 / 24 集，当前阶段「视频生产」。", kind: "info", needProject: true }
    ];
    const hit = rules.find(r => r.k.test(text));
    if (!hit) {
      App.set(SCOPE, "parsed", { intent: "未识别", confidence: "低", params: "—", project: "—", perm: "不适用", budget: "不适用", action: "拒绝执行", scope: "—", confirm: false, note: "指令未落到既定动作清单上。请改用具体动作，例如「重新生成第 17 集 03 场 SH-05」「检查整部短剧的音视频质量」。", kind: "bad" });
      App.refresh();
      return;
    }
    /* 权限校验按当前身份的真实权限码判定，不使用固定文案（业务方案 §20.4-5） */
    const hasPerm = App.can(hit.permCode);
    const permText = hasPerm ? hit.permCode + " 已具备" : "缺少权限码 " + hit.permCode + "，当前身份「" + App.role().name + "」不可执行";
    if (!hasPerm) {
      App.set(SCOPE, "parsed", { intent: hit.intent, confidence: hit.confidence, params: "—", project: "—", perm: permText, budget: "不适用", action: "拒绝执行", scope: "—", confirm: false, note: "指令已识别为「" + hit.intent + "」，但当前身份不具备 " + hit.permCode + " 权限，已拒绝执行。请切换到具备该权限的身份，或由管理员授予权限码。", kind: "bad", permCode: hit.permCode });
      App.refresh();
      return;
    }
    const visible = D.projects.filter(DB.derived.canViewProject);
    const named = visible.find(p => text.indexOf(p.name) >= 0);
    const fallbackId = ((App.currentProject() || {}).id || "");
    let target = named || (visible.length === 1 ? visible[0] : null);
    /* 无法唯一确定目标时必须追问，不得凭猜测执行（业务方案 §20.4-4） */
    if (hit.needProject && !target) {
      const candidates = named ? [] : visible;
      if (candidates.length > 1) {
        App.set(SCOPE, "parsed", {
          intent: hit.intent, confidence: hit.confidence, params: "待指定项目", project: "待确认",
          perm: permText, budget: hit.budget, action: hit.action, scope: "需先指定目标项目", confirm: hit.confirm,
          note: "指令未指明目标项目，且当前可见项目有 " + candidates.length + " 个，无法唯一确定目标。请先选择目标项目再执行。",
          kind: "warn", needTarget: true, candidates: candidates.map(p => ({ id: p.id, label: p.id + " · " + p.name }))
        });
        App.refresh();
        return;
      }
      target = visible[0] || null;
    }
    if (hit.needProject && !target) {
      App.set(SCOPE, "parsed", { intent: hit.intent, confidence: hit.confidence, params: "—", project: "—", perm: permText, budget: "不适用", action: "拒绝执行", scope: "当前没有可见项目", confirm: false, note: "当前身份没有可进入的可见项目，指令无法执行。", kind: "bad" });
      App.refresh();
      return;
    }
    const pendingShot = target ? (D.shots.find(s => s.project === target.id && s.status !== "已通过") || D.shots.find(s => s.project === target.id)) : null;
    const bg = target ? DB.state.budgetOf(target.id) : null;
    let params = hit.params, scope = hit.scope, note = hit.note, budget = hit.budget;
    if (target) {
      params = "项目 → " + target.id + " " + target.name;
      if (hit.intent === "查询进度") {
        note = "进度：" + target.done + " / " + target.episodes + " 集，当前阶段「" + target.phase + "」，状态「" + target.status + "」。";
      } else if (hit.intent === "发起返工") {
        scope = pendingShot ? "E" + pendingShot.ep + " / S" + pendingShot.scene + " / " + pendingShot.id + "，其余镜头不变" : "当前项目没有可返工镜头";
        note = pendingShot ? "返工按镜头粒度执行，不整集重跑；新尝试单独计费并保留原结果。" : "当前项目没有可分镜镜头，执行阶段会被阻断。";
        budget = "按镜头任务计费" + (bg ? "；项目预算剩余 ¥" + DB.state.money(Math.max(0, bg.total - bg.used)) : "；项目尚未建立预算");
      } else if (hit.intent === "发起交付") {
        scope = "整剧 " + target.episodes + " 集，执行前会重新校验交付门禁";
        note = "高风险动作：交付后版本冻结，新版本只能追加链，不能覆盖。";
      } else if (hit.intent === "查询成本") {
        const tb = target ? DB.derived.budgetOfProject(target) : null;
        note = tb ? "项目已入账 ¥" + DB.state.money(tb.used) + "，预算 ¥" + DB.state.money(tb.total) + "；失败任务成本同样入账。" : "项目尚未建立预算账本。";
      } else if (hit.intent === "暂停任务") {
        const queued = D.tasks.filter(t => t.project === target.id && ["待执行", "排队中"].indexOf(t.status) >= 0);
        scope = queued.length ? "《" + target.name + "》待执行 / 排队中 " + queued.length + " 个任务，执行中任务不强制中断" : "《" + target.name + "》当前没有待执行或排队中任务";
        note = queued.length ? "暂停只停止派发，恢复后重新排队；已发生费用仍入账。" : "没有可暂停任务时不会伪造暂停结果。";
      }
    }
    App.set(SCOPE, "parsed", {
      intent: hit.intent, confidence: hit.confidence, params: params, project: target ? target.id : "按上下文推断",
      perm: permText, budget: budget, action: hit.action, scope: scope, confirm: hit.confirm, note: note, kind: hit.kind,
      permCode: hit.permCode, candidates: []
    });
    App.refresh();
  });
  App.on("workspace.pickTarget", () => {
    const p = App.get(SCOPE, "parsed", null);
    if (!p || !p.needTarget) return;
    const sel = document.getElementById("cmd-target");
    const pid = sel ? sel.value : "";
    if (!pid) { App.toast("请先选择目标项目", "bad"); return; }
    const proj = D.projects.find(x => x.id === pid);
    if (!proj) { App.toast("目标项目不存在", "bad"); return; }
    /* 目标确认后回到解析，把项目名写回指令原文并重新解析 */
    const text = App.get(SCOPE, "cmd", "");
    App.set(SCOPE, "cmd", text + " " + proj.name);
    App.set(SCOPE, "parsed", null);
    App.toast("已指定目标项目《" + proj.name + "》，请重新解析确认");
    App.refresh();
  });
  App.on("workspace.cmdHelp", () => {
    App.drawer("可用指令清单（业务方案 §20.4 · 十类示例全覆盖）", U.table(["目标", "示例话术", "风险"], [
      ["新建项目", "新建一部 60 集都市情感短剧", "低"],
      ["生成候选剧本", "根据当前创意生成完整剧本", "低"],
      ["剧本逻辑自检", "检查当前剧本的人物与剧情逻辑", "只读"],
      ["优化剧情节奏", "优化第 10 集剧情节奏", "高 · 需确认"],
      ["人物视觉一致性检查", "检查人物视觉一致性", "只读"],
      ["整剧质量检测", "检查整部短剧的音视频质量", "低"],
      ["按剧本启动生产", "按剧本开始自动制作", "高 · 需确认"],
      ["发起返工", "重新生成第 8 集不合格镜头", "中"],
      ["终止项目", "终止项目", "高 · 需确认"],
      ["删除已确认资产", "删除已确认素材", "高 · 需确认"],
      ["调整预算", "预算超限，追加预算", "高 · 需确认"],
      ["发起交付", "把审核通过的内容整理成交付包", "高 · 需确认"],
      ["查询成本", "这个月花了多少钱", "只读"],
      ["暂停任务", "暂停当前视频生产", "中"],
      ["查询进度", "《雾城来信》现在做到哪一集了", "只读"]
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
  /* 这些高风险意图自带二次确认表单，不再叠加外层确认弹窗 */
  const SELF_CONFIRM = ["优化剧情节奏", "终止项目", "删除已确认资产", "调整预算"];

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
    if (p.needTarget) { App.toast("目标项目尚未唯一确定，请先选择目标项目", "bad"); return; }
    const text = App.get(SCOPE, "cmd", "");
    const requested = /^SP-\d{5}$/.test(String(p.project)) ? p.project : "";
    const pj = requested ? App.currentProject({ id: requested }) : App.currentProject({});
    if (!pj) { App.toast("当前没有可执行的项目，或指令指向的项目不在可见范围", "bad"); return; }
    const highRisk = p.confirm && SELF_CONFIRM.indexOf(p.intent) < 0;

    const exec = () => {
      if (p.intent === "新建项目") {
        App.set(SCOPE, "parsed", null);
        recordCmd(p.intent, text, "已跳转立项页，待确认名称与预算");
        App.toast("立项需确认名称与预算，已进入立项页");
        App.go("projects/new");
        return;
      }
      /* 生成候选剧本（业务方案 §6.1） */
      if (p.intent === "生成候选剧本") {
        App.set(SCOPE, "parsed", null);
        App.job({
          title: "按指令生成候选剧本", steps: ["校验方案与项目状态", "调用推理模型生成", "写入候选版本与成本"],
          run() { return DB.state.generateScript(pj.id); },
          after(out) {
            recordCmd(p.intent, text, out && out.ok ? out.msg : "生成失败");
            App.go("projects/workflow", { id: pj.id });
          }
        });
        return;
      }
      /* 剧本逻辑自检（只读检查，不改写剧本） */
      if (p.intent === "剧本逻辑自检") {
        App.set(SCOPE, "parsed", null);
        const script = D.scripts.find(x => x.project === pj.id && x.locked) || D.scripts.find(x => x.project === pj.id);
        const shots = D.shots.filter(x => x.project === pj.id);
        const noChar = shots.filter(x => !x.chars || x.chars === "—").length;
        const noLine = shots.filter(x => !x.line || x.line === "—").length;
        const items = [
          ["人物动机与设定冲突", noChar ? noChar + " 个镜头未绑定人物" : "镜头均已绑定人物", noChar ? "需人工判断" : "通过"],
          ["对白完整性", noLine ? noLine + " 个镜头无对白（按剧情可为空）" : "对白条目齐备", noLine ? "需人工判断" : "通过"],
          ["时间线与设定一致", shots.length ? "已按 " + (script ? script.id : "未锁定版本") + " 拆解" : "尚未拆解", shots.length ? "通过" : "待处理"],
          ["结构完整性", script ? script.episodes + " 集 / " + script.scenes + " 场 / " + script.shots + " 镜" : "无剧本版本", script ? "通过" : "待处理"]
        ];
        recordCmd(p.intent, text, "自检完成，" + items.filter(i => i[2] === "通过").length + " / " + items.length + " 项通过");
        App.drawer("剧本逻辑自检 · " + pj.name, U.table(["检查项", "结论", "结果"], items.map(i =>
          "<tr><td class=\"cell-strong\">" + i[0] + '</td><td class="cell-wrap">' + U.esc(i[1]) + "</td><td>" + U.pill(i[2]) + "</td></tr>").join("")) +
          U.notice("自检只输出结论与定位，不自动改写剧本；修改需走剧本变更流程并重新审核。", "info") +
          '<div class="btn-row-inline">' + U.btn("打开剧本版本", "workspace.toScript", "primary", { id: pj.id }) + "</div>");
        DB.state.log("指令助手", "剧本逻辑自检：" + text, "成功", pj.id);
        return;
      }
      /* 优化剧情节奏：正式剧本重大变更，需二次确认 */
      if (p.intent === "优化剧情节奏") {
        App.modal({
          title: "优化剧情节奏 · " + pj.name, sub: "正式剧本重大变更需二次确认；确认后创建修订任务并回到剧本创作中",
          body: U.fField("目标集号", "ep", { required: true, placeholder: "例如：10" }) +
            U.fTextarea("优化目标与理由", "note", { required: true, minlen: 8, rows: 3 }) +
            U.notice("变更后该集及下游需重新走剧本审核；已通过版本不被覆盖。", "warn"),
          submitText: "确认并创建修订任务",
          onSubmit(d) {
            return App.job({
              title: "创建节奏修订任务", steps: ["校验集号与项目状态", "创建修订任务", "写审计"],
              run() {
                const mv = DB.state.moveTo(pj, "剧本创作中", "指令：优化第 " + d.ep + " 集剧情节奏");
                if (!mv.ok) return mv;
                const task = { id: "T-CMD-" + Date.now().toString().slice(-4), project: pj.id, ep: d.ep, scene: "—", shot: "—", kind: "剧本修订", stage: "创意与剧本", status: "待执行", priority: "高", deps: [], parallelGroup: "SCR", input: "E" + d.ep + " · " + d.note, output: "修订候选版本", model: "文本模型 A", config: "PRV-08", executor: App.role().name, resourceOwner: App.role().name, attempt: 0, maxAttempts: 3, est: 8, actual: 0, failedCost: 0, submitAt: "—", failReason: "—", qc: "—" };
                D.tasks.unshift(task);
                DB.state.log("指令助手", "优化剧情节奏（E" + d.ep + "）：" + d.note, "成功", task.id);
                return { ok: true, msg: "已创建节奏修订任务 " + task.id + "，项目回到剧本创作中" };
              },
              after(out) { if (out && out.ok) App.go("creation/script", { id: pj.id }); }
            });
          }
        });
        return;
      }
      /* 人物视觉一致性检查（只读） */
      if (p.intent === "人物视觉一致性检查") {
        App.set(SCOPE, "parsed", null);
        const chars = D.characters.filter(c => c.project === pj.id);
        const locs = D.locations.filter(l => l.project === pj.id);
        const rows = chars.concat(locs).map(a => "<tr><td>" + U.esc(a.name) + '</td><td>' + U.esc(a.id) + '</td><td>' + U.esc(a.version || "v1") + '</td><td>' + U.pill(a.status) + "</td><td>" + U.esc(a.refs || "—") + "</td></tr>").join("");
        recordCmd(p.intent, text, "抽检 " + (chars.length + locs.length) + " 项视觉资产");
        App.drawer("视觉一致性抽检 · " + pj.name, U.table(["资产", "编号", "版本", "状态", "参考图"], rows) +
          U.notice("抽检不合格的资产不得固化；修改需产生新版本，旧版本保留以支持历史项目复现。", "warn") +
          '<div class="btn-row-inline">' + U.btn("打开视觉档案", "workspace.toCast", "primary", { id: pj.id }) + "</div>");
        DB.state.log("指令助手", "人物视觉一致性检查：" + text, "成功", pj.id);
        return;
      }
      /* 整剧质量检测 */
      if (p.intent === "整剧质量检测") {
        App.set(SCOPE, "parsed", null);
        App.job({
          title: "整剧质量检测", steps: ["读取质检结论", "定位未通过项", "写审计"],
          run() {
            const g = DB.state.gate(pj.id, "交付");
            const bad = g.items.filter(i => !i.ok);
            return { ok: true, msg: pj.id + " 整剧检测：" + (bad.length ? "存在 " + bad.length + " 项阻断（" + bad.map(b => b.label).join("、") + "）" : "全部通过") };
          },
          after(out) {
            recordCmd(p.intent, text, out && out.msg ? out.msg : "检测完成");
            App.go("quality/reports", { id: pj.id });
          }
        });
        return;
      }
      /* 按剧本启动生产（批量，高风险） */
      if (p.intent === "按剧本启动生产") {
        App.set(SCOPE, "parsed", null);
        App.job({
          title: "按剧本启动生产", steps: ["校验项目状态与预算", "按集提交镜头任务", "逐镜质检"],
          run() { return DB.state.batchProduce(pj.id, 1); },
          after(out) {
            recordCmd(p.intent, text, out && out.msg ? out.msg : "生产已阻断");
            App.go("video/production", { id: pj.id });
          }
        });
        return;
      }
      /* 终止项目（高风险） */
      if (p.intent === "终止项目") {
        App.modal({
          title: "终止项目 · " + pj.name, sub: "项目终止为终态：取消未执行任务，已完成资产、记录与费用全部保留",
          body: U.fTextarea("终止原因", "reason", { required: true, minlen: 10, rows: 3 }) +
            U.notice("终止后项目只读可查；如需继续生产，请复制为新项目重新立项。", "bad"),
          submitText: "确认终止项目",
          onSubmit(d) {
            return App.job({
              title: "终止项目", steps: ["校验项目状态", "取消未执行任务", "写生命周期与审计"],
              run() { return DB.state.terminate(pj.id, d.reason); },
              after(out) { if (out && out.ok) { recordCmd(p.intent, text, "已终止：" + d.reason); App.go("projects/detail", { id: pj.id }); } }
            });
          }
        });
        return;
      }
      /* 删除已确认资产（高风险） */
      if (p.intent === "删除已确认资产") {
        App.set(SCOPE, "parsed", null);
        const list = D.assets.filter(a => a.project === pj.id && (a.refs || 0) === 0 && !a.formal);
        App.modal({
          title: "删除已确认资产 · " + pj.name, sub: "仅允许删除当前项目内无引用且非正式的资产；其余一律阻断",
          body: U.fSelect("资产", "id", list.length ? list.map(a => ({ value: a.id, label: a.id + " · " + a.name })) : [{ value: "", label: "当前项目没有可删除资产" }], { required: true }) +
            U.fTextarea("删除原因", "note", { required: true, minlen: 8, rows: 3 }) +
            U.notice("正式资产不可删除，只能新版本替代；已归档资产只读可查。", "warn"),
          submitText: "确认删除",
          onSubmit(d) {
            if (!d.id) return { ok: false, msg: "当前没有满足删除条件的资产" };
            return App.job({
              title: "删除资产", steps: ["校验引用与正式状态", "逻辑删除", "写审计"],
              run() { return DB.state.removeAsset(d.id); },
              after(out) { if (out && out.ok) recordCmd(p.intent, text, out.msg); }
            });
          }
        });
        return;
      }
      /* 调整预算（高风险） */
      if (p.intent === "调整预算") {
        App.set(SCOPE, "parsed", null);
        const bg = DB.state.budgetOf(pj.id);
        App.modal({
          title: "调整预算 · " + pj.name, sub: "预算超限需二次确认；调整后重新预检任务派发",
          body: U.fField("目标金额", "total", { required: true, type: "number", value: bg ? bg.total : pj.budget }) +
            U.fTextarea("调整理由", "reason", { required: true, minlen: 8, rows: 3 }) +
            U.notice("预算冻结时禁止派发新任务，已发生费用仍可入账。", "warn"),
          submitText: "确认调整",
          onSubmit(d) {
            return App.job({
              title: "调整预算", steps: ["校验预算规则", "写入新预算", "重算预算状态"],
              run() { return DB.state.adjustBudget(pj.id, d.total, d.reason); },
              after(out) { if (out && out.ok) { recordCmd(p.intent, text, out.msg); App.go("cost/budget", { id: pj.id }); } }
            });
          }
        });
        return;
      }
      if (p.intent === "查询进度") {
        App.set(SCOPE, "parsed", null);
        recordCmd(p.intent, text, "已查询 " + pj.name + "：" + DB.derived.progressOf(pj).done + " / " + DB.derived.progressOf(pj).total + " 集");
        const pb = DB.derived.budgetOfProject(pj);
        App.drawer("进度查询 · " + pj.name, U.desc([["项目", pj.id + " · " + pj.name], ["状态", pj.status], ["阶段", pj.phase], ["集进度", DB.derived.progressOf(pj).done + " / " + DB.derived.progressOf(pj).total], ["预算", "¥" + pb.total + "（已用 ¥" + pb.used + " · " + pb.pct + "%）"], ["更新时间", String(pj.updated)]]) +
          '<div class="btn-row-inline">' + U.btn("进入项目", "projects.detail", "primary", { id: pj.id }) + "</div>");
        DB.state.log("指令助手", "查询进度：" + text, "成功", "cmd");
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
            const r = DB.state.submitTask({ project: s.project, shot: s.id, model: "视频模型 A", priority: "高" });
            if (!r.ok) return r;
            DB.state.log("指令助手", "返工指令：" + text + " → " + r.data.id, "成功", r.data.id);
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
            const g = DB.state.gate(pj.id, "交付");
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
        DB.state.log("指令助手", "成本查询：" + text, "成功", "cmd");
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
            DB.state.log("指令助手", "暂停《" + pj.name + "》" + queued.length + " 个待执行任务：" + text, "成功", "cmd");
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
        onSubmit(d) { DB.state.log("指令助手", "高风险指令确认：" + text + " · " + d.note, "成功", "cmd"); exec(); }
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

