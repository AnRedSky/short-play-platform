/* 模块：projects 项目中心（企业管理端 + 员工端共用） */
(function () {
  const U = UI, D = DB, SCOPE = "projects";
  const pct = (p) => DB.derived.budgetOfProject(p).pct;
  const budgetText = (p) => {
    const b = DB.derived.budgetOfProject(p);
    return "¥" + b.used.toLocaleString("zh-CN") + " / ¥" + b.total.toLocaleString("zh-CN");
  };

  function stageChain(p) {
    const idx = D.stagePipeline.findIndex(s => p.phase.indexOf(s.name.replace("后期合成", "后期")) >= 0 || p.phase.indexOf(s.name) >= 0);
    const current = idx >= 0 ? idx : (p.status === "已交付" || p.status === "已归档" ? 7 : 0);
    return U.chain(D.stagePipeline.map((s, i) => ({
      label: s.name,
      meta: s.gate,
      state: i < current ? "done" : i === current ? (p.status === "异常中" ? "blocked" : "now") : ""
    })));
  }

  AppModule.register({
    group: "projects", label: "项目中心", icon: "folder", order: 2, end: "enterprise",
    routes: [
      {
        path: "projects/list", title: "项目列表", icon: "folder", permission: "project.read",
        desc: "项目是短剧制作的容器，也是资产、任务、成本与交付的唯一归属单元。列表展示真实状态字段，不由前端文案伪造。",
        render() {
          const st = App.get(SCOPE, "status", ""), dept = App.get(SCOPE, "dept", "");
          const rel = App.get(SCOPE, "rel", "");
          const visible = DB.derived.visibleProjects();
          const me = App.identity();
          const uid = me.userId;
          const own = visible.filter(p => p.ownerId === uid);
          const joined = visible.filter(p => p.ownerId !== uid && (p.members || []).some(m => m.userId === uid));
          const review = visible.filter(p => p.status.indexOf("待") >= 0 && (p.ownerId === uid || (p.members || []).some(m => m.userId === uid && m.role === "审核")));
          const roleOf = (p) => (p.ownerId === uid ? "负责人" : ((p.members || []).find(m => m.userId === uid) || {}).role || "—");
          const inRel = (p) => (rel === "own" ? p.ownerId === uid : rel === "join" ? p.ownerId !== uid && (p.members || []).some(m => m.userId === uid) : rel === "review" ? p.status.indexOf("待") >= 0 && (p.ownerId === uid || (p.members || []).some(m => m.userId === uid && m.role === "审核")) : true);
          const scope = DB.derived.scopeLabel();
          const list = visible.filter(p => (!st || p.status === st) && (!dept || p.dept === dept) && inRel(p));
          const counts = {
            active: visible.filter(p => ["生产中", "后期制作中", "质量检测中", "待最终审核", "生产准备中"].indexOf(p.status) >= 0).length,
            review: visible.filter(p => p.status.indexOf("待") >= 0).length,
            risk: visible.filter(p => p.status === "异常中").length,
            done: visible.filter(p => ["已交付", "已归档", "已完成"].indexOf(p.status) >= 0).length,
            draft: visible.filter(p => p.status === "草稿").length,
            production: visible.filter(p => ["生产中", "后期制作中"].indexOf(p.status) >= 0).length,
            delivered: visible.filter(p => ["已交付", "已归档"].indexOf(p.status) >= 0).length
          };
          return U.page("项目中心 / 项目列表", "在做的戏", "按当前身份可见范围展示；海报、进度与下一步都来自项目真实字段，跨范围项目不渲染内容。",
            (App.can("project.create") ? U.btn("新建项目", "projects.new", "primary") : "") + U.btn("导出项目台账", "common.export"),
            '<div class="project-toolbar"><div class="seg-chips">' +
              [["", "全部 " + visible.length], ["生产中", "进行中 " + counts.active], ["待剧本审核", "待审 " + counts.review], ["已交付", "已交付 " + counts.delivered], ["草稿", "草稿 " + counts.draft]].map(x =>
                '<button type="button" class="seg-chip' + (st === x[0] ? " on" : "") + '" data-action="projects.setStatus" data-value="' + x[0] + '">' + U.esc(x[1]) + "</button>").join("") +
              "</div>" +
              '<div class="seg-chips">' +
              [["", "全部关系"], ["own", "我负责 " + own.length], ["join", "我参与 " + joined.length], ["review", "待我审核 " + review.length]].map(x =>
                '<button type="button" class="seg-chip' + (rel === x[0] ? " on" : "") + '" data-action="projects.setRel" data-value="' + x[0] + '">' + U.esc(x[1]) + "</button>").join("") +
              "</div>" +
              '<div class="toolbar" style="margin:0"><input class="search" placeholder="搜索项目 / 编号 / 负责人" data-scope="' + SCOPE + '" data-filter="q">' +
              '<span class="faint small" data-filter-count></span></div></div>' +
            '<div class="project-grid">' + list.map(p => {
              const cover = U.cover(p.id);
              const wf = DB.derived.workflow(p);
              return '<article class="project-card">' +
                '<div class="project-cover">' + (cover ? '<img src="' + U.esc(cover) + '" alt="' + U.esc(p.name) + ' 主视觉">' : "") +
                  '<div class="pc-state">' + U.pill(p.status) + '</div><span class="pc-dur">' + p.episodes + " 集 · " + U.esc(p.duration) + "</span>" +
                  '<div class="pc-title"><b>' + U.esc(p.name) + '</b><small>' + U.esc(p.id) + " · " + U.esc(p.genre) + "</small></div></div>" +
                '<div class="project-body">' +
                  '<div class="project-meta"><span>负责人 ' + U.esc(p.owner) + " · " + U.esc(p.dept) + "</span><span>" + (roleOf(p) === "—" ? "" : U.pill("我的角色 " + roleOf(p), p.ownerId === uid ? "accent" : "info") + " ") + U.pill(p.quality) + "</span></div>" +
                  '<div class="project-progress"><div class="progress-label"><span>已通过 ' + wf.passEps.length + " / " + p.episodes + "</span><span>完成 " + wf.pct + "%</span></div>" +
                    '<div class="progress"><span style="width:' + wf.pct + '%"></span></div></div>' +
                  '<div class="project-meta"><span>下一步</span><b>' + U.esc(wf.next[0].title) + '</b></div>' +
                  '<div class="project-meta"><span>预算</span><b>' + budgetText(p) + "</b></div>" +
                  '<div class="project-foot"><span class="who">' + U.ico("clock", 12) + " " + U.esc(p.updated) + '</span><button class="btn sm primary" data-action="projects.wfOpen" data-pid="' + U.esc(p.id) + '">继续制作</button></div>' +
                "</div></article>";
            }).join("") +
            (list.length ? "" : '<div class="tile-add" style="grid-column:1/-1;min-height:160px">没有符合条件的项目，清空筛选或换关键词</div>') +
            "</div>" +
            '<div class="table-foot" style="margin-top:14px"><span data-filter-count>共 ' + list.length + ' 个项目</span><span>可见范围：' + U.esc(scope) + " · 状态与进度由业务层写入</span></div>" +
            '<div class="grid grid-2 mt-4">' +
              U.card("项目状态分布", U.donut([
                { label: "生产 / 后期", value: counts.production, color: "var(--accent)" },
                { label: "待审核", value: counts.review, color: "var(--warn)" },
                { label: "异常", value: counts.risk, color: "var(--bad)" },
                { label: "已交付 / 归档", value: counts.delivered, color: "var(--ok)" },
                { label: "草稿", value: counts.draft, color: "var(--line-strong)" }
              ], "共 " + visible.length + " 个项目", String(visible.length)), "按当前可见项目的真实状态归类") +
              U.card("状态机提示", U.notice("主流程不允许跨阶段跳跃：例如从「剧本创作中」不可直接进入「生产中」。质量检测与待最终审核由系统自动进出，不靠人工点按钮伪造。", "info") +
                U.listRows([["连续失败", "重试达上限 → 转人工 → 异常中"], ["预算触发", "暂停受影响任务，不整项目静默继续"], ["终止", "取消未执行任务，保留记录与已发生费用"]]), "详见项目生命周期页",
                U.btn("查看状态机", "projects.lifecycleLink", "sm")) +
            "</div>"
          );
        }
      },
      {
        path: "projects/workflow", title: "制作流水线", icon: "play", permission: "project.read", projectScoped: true,
        desc: "把锁定剧本 → 拆解 → 资产确认 → 计划固化 → 连续生产 → 字幕合成 → 整集质检 → 终审 → 交付串成一条可操作链路，每步都写入同一项目状态。",
        render(query) {
          const p = App.currentProject(query);
          if (!p || !DB.derived.canViewProject(p)) {
            return U.page("项目中心 / 制作流水线", "项目不在可见范围", "切换到有权限的身份，或由负责人授权后再进入。",
              U.btn("返回项目列表", "common.projects", "primary"), U.empty("无访问权限", "跨项目访问不渲染任何业务内容。"));
          }
          const wf = DB.derived.workflow(p);
          const n = wf.next[0];
          const more = wf.next.slice(1, 4);
          const preProduction = ["草稿", "创意策划中", "剧本创作中", "待剧本审核", "生产准备中"].indexOf(p.status) >= 0;
          const g = preProduction ? wf.gateProduction : wf.gateDelivery;
          const gTitle = preProduction ? "生产门禁 · 固化计划前" : "交付门禁 · 生成交付包前";
          const activeTasks = D.tasks.filter(t => t.project === p.id && ["排队中", "执行中", "待执行"].indexOf(t.status) >= 0);
          const recentTasks = D.tasks.filter(t => t.project === p.id).slice(0, 4);
          const totalShots = wf.shots.length;
          const passedShots = wf.passedShots.length;
          const epState = (e) => e.qc === "PASS" ? "ok" : ["生产中", "视频已齐 · 待后期", "后期完成 · 待质检", "待人工判断"].indexOf(e.status) >= 0 ? "now" : "wait";
          const stagePage = { script: "creation/script", breakdown: "creation/breakdown", plan: "director/plan", video: "video/production", post: "audio/subtitle", qc: "quality/reports", final: "post/review", delivery: "post/delivery" };
          return U.page("项目中心 / " + p.id + " / 制作流水线", p.name + " · 从剧本到交付", "不是功能目录，而是这部戏今天真实走到哪一步。每个按钮都落到项目状态、任务、成本与质检记录上。",
            U.btn("项目档案", "projects.detail", "", { id: p.id }) +
            (App.can("project.manage") && DB.state.canMove(p, "已暂停").ok ? U.btn("暂停项目", "projects.pause", "", { id: p.id }) : "") +
            U.btn("返回项目列表", "common.projects"),
            '<section class="wf-hero">' +
              '<div class="wf-cover">' + (U.cover(p.id) ? '<img src="' + U.esc(U.cover(p.id)) + '" alt="">' : "") +
                '<span class="wf-cover-pill">' + U.pill(p.status) + '</span></div>' +
              '<div class="wf-main">' +
                '<div class="wf-kicker">' + U.esc(p.id) + " · " + U.esc(p.genre) + " · " + U.esc(p.owner) + "</div>" +
                '<h2 class="wf-title">' + U.esc(p.name) + '</h2>' +
                '<div class="wf-progress"><div class="progress"><span style="width:' + wf.pct + '%"></span></div>' +
                  '<div class="wf-progress-meta"><b>' + wf.passEps.length + " / " + p.episodes + ' 集通过质检</b><span>' + wf.pct + "% · 当前阶段 " + U.esc(p.phase) + "</span></div></div>" +
                '<div class="wf-kpis">' +
                  '<div><span>镜头</span><b>' + passedShots + " / " + totalShots + "</b></div>" +
                  '<div><span>预算</span><b>' + budgetText(p) + "</b></div>" +
                  '<div><span>进行中任务</span><b>' + activeTasks.length + "</b></div>" +
                  '<div><span>待确认资产</span><b>' + wf.pendingAssets.length + "</b></div>" +
                "</div>" +
              "</div>" +
            "</section>" +
            '<div class="wf-rail">' + wf.stages.map((s, i) => '<a class="wf-stage ' + s.state + '" href="#/' + stagePage[s.key] + '?id=' + encodeURIComponent(p.id) + '" title="进入' + U.esc(s.label) + '阶段"><span class="wf-dot">' + String(i + 1).padStart(2, "0") + '</span><b>' + U.esc(s.label) + '</b><small>' + U.esc(s.meta) + "</small></a>").join("") + "</div>" +
            '<div class="wf-grid mt-4">' +
              '<div class="wf-action-card">' +
                '<div class="wf-action-head"><span class="wf-now">当前动作</span><h3>' + U.esc(n.title) + '</h3><p>' + U.esc(n.why) + '</p></div>' +
                '<div class="wf-action-btns">' + U.btn(n.cta, n.action, "primary", { pid: p.id }) + "</div>" +
                (more.length ? '<div class="wf-more"><span>还可以做</span>' + more.map(x => U.btn(x.cta, x.action, "sm", { pid: p.id })).join("") + "</div>" : "") +
                '<div class="wf-facts">' + U.desc([
                  ["正式剧本", wf.locked ? wf.locked.id : "未锁定"],
                  ["剪辑版本", p.timelineVersion],
                  ["字幕完成", wf.subs.filter(s => s.status === "已通过").length + " / " + p.episodes + " 集"],
                  ["时间线标脏", wf.stale ? wf.stale + " 处" : "无"],
                  ["待人工镜头", wf.humanShots.length ? wf.humanShots.length + " 个" : "无"],
                  ["预算状态", p.budgetState]
                ]) + "</div>" +
                '<div class="wf-inline-history"><b>最近执行</b>' +
                  '<div class="wf-history">' + recentTasks.map(t => '<div><b>' + U.esc(t.id) + " · E" + U.esc(t.ep) + " · " + U.esc(t.shot || "—") + '</b><small>' + U.pill(t.status) + " · " + U.esc(t.model) + " · ¥" + Number(t.actual || 0) + "</small></div>").join("") + "</div>" +
                "</div>" +
              "</div>" +
              '<aside class="wf-side">' +
                '<div class="wf-gate"><div class="wf-gate-head"><b>' + gTitle + '</b>' + U.pill(g.ok ? "通过" : "未通过", g.ok ? "ok" : "warn") + "</div>" +
                  g.items.map(it => '<div class="wf-gate-row ' + (it.ok ? "ok" : "bad") + '"><span class="wf-gate-icon">' + (it.ok ? "✓" : "!") + '</span><div><b>' + U.esc(it.label) + '</b><small>' + U.esc(it.note) + "</small></div></div>").join("") +
                "</div>" +
                '<div class="wf-side-block"><b>角色 / 场景参考</b>' +
                  (wf.chars.length ? wf.chars.map(c => '<div class="wf-asset-row"><span>' + U.entity(c.name, c.id, c.name.slice(0, 1)) + '</span>' + U.pill(c.status, c.status === "已确认" ? "ok" : "warn") + "</div>").join("") : '<small class="muted">拆解后生成</small>') +
                  (wf.locs.map(l => '<div class="wf-asset-row"><span>' + U.entity(l.name, l.id, "景") + '</span>' + U.pill(l.status, l.status === "已确认" ? "ok" : "warn") + "</div>").join("")) +
                "</div>" +
              "</aside>" +
            "</div>" +
            U.card("全 " + p.episodes + " 集生产板", '<div class="wf-ep-grid">' + wf.eps.map(e => {
              const sh = wf.shots.filter(s => s.ep === e.no);
              const pass = sh.filter(s => s.status === "已通过").length;
              return '<button type="button" class="wf-ep ' + epState(e) + '" data-action="projects.wfEpDetail" data-pid="' + U.esc(p.id) + '" data-ep="' + e.no + '">' +
                '<span class="wf-ep-no">E' + String(e.no).padStart(2, "0") + '</span>' +
                '<b>' + U.esc(e.title) + '</b>' +
                '<small>' + U.esc(e.status) + '</small>' +
                '<span class="wf-ep-bar"><i style="width:' + (sh.length ? Math.round(pass / sh.length * 100) : 0) + '%"></i></span>' +
                '<span class="wf-ep-meta">' + pass + " / " + sh.length + " 镜 · " + (e.qc === "PASS" ? "PASS" : U.esc(e.qc || "未检")) + "</span></button>";
            }).join("") + "</div>", "点击任意一集查看该集镜头、时间线与质检记录") +
            '<div class="wf-latest mt-4">' +
              U.card("最近质检", U.table(["报告", "对象", "结果", "问题", "时间"], D.qualityReports.filter(r => String(r.object).indexOf(p.id) === 0).slice(0, 6).map(r =>
                '<tr><td>' + U.code(r.id) + '</td><td class="cell-wrap">' + U.esc(r.object) + '</td><td>' + U.pill(r.result) + '</td><td class="num">' + r.issues + '</td><td class="idx">' + U.esc(r.at) + "</td></tr>").join("")), "报告绑定被检版本") +
              U.card("成本与预算", U.desc([
                ["已用", "¥" + DB.derived.budgetOfProject(p).used.toLocaleString("zh-CN")],
                ["剩余", "¥" + Math.max(0, DB.derived.budgetOfProject(p).total - DB.derived.budgetOfProject(p).used).toLocaleString("zh-CN")],
                ["单镜均价", "¥" + (D.pricing ? D.pricing.videoPerShot : "—") + "（演示价目）"],
                ["已通过镜头", passedShots + " / " + totalShots]
              ]), "费用随任务执行实时写入成本台账") +
            "</div>"
          );
        }
      },
      {
        path: "projects/new", title: "新建项目", icon: "pen", permission: "project.create", menu: false,
        desc: "填写项目属性与创意要求，系统校验必填项、取值范围、预算格式、集数与时长组合、个人资源可用性后生成唯一项目编号。",
        render() {
          const mode = App.get(SCOPE, "newMode", "自由描述");
          const copyFrom = App.get(SCOPE, "copyFrom", "不复制");
          return U.page("项目中心 / 新建项目", "新建项目", "项目创建本身不要求模型调用成功；创建成功与生成成功是两件事。无可用 AI 配置时允许保存草稿，但阻止启动生成。",
            U.btn("返回项目列表", "common.projects"),
            '<div class="split"><div class="stack">' +
              U.card("项目属性（必填项标 *）", '<div class="form-grid">' +
                U.fField("项目名称", "name", { required: true, placeholder: "例如：雾城来信" }) +
                U.fSelect("项目类型 / 题材", "genre", ["都市情感", "悬疑推理", "古装传奇", "家庭伦理", "青春成长", "科幻悬疑"], { required: true }) +
                U.fField("目标受众", "audience", { required: true, placeholder: "例如：18–30 岁都市女性" }) +
                U.fField("计划集数", "episodes", { required: true, type: "number", value: "24", min: 4, max: 60, hint: "企业策略上限 60 集" }) +
                U.fField("单集时长", "duration", { required: true, value: "90 秒", minlen: 2, hint: "30–180 秒；非数字字符会被忽略" }) +
                U.fSelect("画幅与分辨率", "ratio", ["9:16 · 1080×1920", "16:9 · 1920×1080", "1:1 · 1080×1080"], { required: true }) +
                U.fSelect("语言", "language", ["普通话", "普通话 + 方言点缀", "普通话 + 粤语片段"], { required: true }) +
                U.fSelect("所属部门", "dept", D.departments.map(d => d.name), { required: true, value: "内容创新部" }) +
                U.fField("预计预算", "budget", { required: true, value: "18000", rule: "money", hint: "提交时校验部门与企业可用余额" }) +
                U.fSelect("交付格式与要求", "delivery", ["分集 MP4 + 整剧打包 + 字幕文件", "分集 MP4 + 封面素材"], { required: true }) +
                U.fField("风格要求", "style", { placeholder: "影响视觉档案与提示词" }) +
                U.fField("负责人", "owner", { value: "当前员工（创建者）", readonly: true }) +
                U.fTextarea("内容禁忌与边界", "constraints", { placeholder: "进入合规预检条件，例如：禁止血腥正面镜头" }) +
                "</div>", "缺失项在校验阶段定位到具体字段") +
              U.card("创意输入", U.radioCards("mode", D.briefModes.map(m => ({ value: m.mode, label: m.mode, desc: m.input })), mode) +
                U.fTextarea("创意内容", "brief", { required: true, rows: 5, placeholder: "描述灵感、人物、冲突或场景；系统将提取题材、主题、冲突、受众与约束", hint: "提交后版本化保存，记录操作者与资料来源" }), "七种输入方式均为业务流程内的输入路径") +
            '</div><div class="stack">' +
              U.card("创建校验", U.listRows([
                ["必填项", "缺失则阻止保存，不生成半成品项目"], ["集数与时长", "正整数且受企业策略上限约束"],
                ["预算格式", "超出制度上限 / 格式错误 / 额度不足分别提示"], ["个人资源", "至少一项匹配可用配置，否则只能存草稿"],
                ["重复提交", "使用幂等键避免生成重复项目"], ["归属记录", "创建人、负责人、所属部门分别记录"]
              ]), "校验失败要定位到字段") +
              U.card("从既有项目复制", U.fSelect("复制来源", "copy", ["不复制"].concat(D.projects.filter(p => p.status !== "已归档").map(p => p.name)), { value: copyFrom }) +
                U.notice("仅复制题材、风格、规格与交付要求等非敏感配置；<b>不复制凭据与历史任务</b>。", "info"), "复制配置不复制执行痕迹") +
              U.card("预算与资源预检", (function () {
                const me = App.identity();
                const u = DB.derived.actorUser(me) || {};
                const deptBg = D.budgets.find(b => b.scope === "部门" && b.name === u.dept);
                const entBg = D.budgets.find(b => b.scope === "企业");
                const mine = D.providers.filter(x => x.ownerId === u.id && x.status === "启用");
                return '<div class="kv-grid">' +
                  U.kv("部门可用余额", deptBg ? "¥" + (deptBg.total - deptBg.used - deptBg.reserve).toLocaleString("zh-CN") : "—") +
                  U.kv("企业可用余额", entBg ? "¥" + (entBg.total - entBg.used - entBg.reserve).toLocaleString("zh-CN") : "—") +
                  U.kv("可用个人配置", mine.length + " 项") +
                  U.kv("可覆盖能力", mine.length ? mine.map(x => String(x.capabilities).split(" / ")[0]).join(" / ") : "未配置") + "</div>" +
                  U.notice("预算在提交时按部门与企业余额校验，超出可用余额会定位到预算字段并阻止创建；无可用能力时只能保存草稿，不能启动生成。", "warn");
              })(), "预检结果实时计算，不使用固定示例值") +
              '<div class="form-error" hidden></div>' +
              '<div class="form-actions" style="border:0;padding:0">' + U.btn("保存草稿", "projects.saveDraft") + U.btn("创建并入工作台", "projects.create", "primary") + "</div>" +
            "</div></div>"
          );
        }
      },
      {
        path: "projects/detail", title: "项目详情", icon: "folder", permission: "project.read", menu: false, projectScoped: true,
        desc: "项目档案、阶段进度、创作基准、预算、质量、成员与生命周期记录。关键决策点必须能看到版本、质量报告与成本依据。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) {
            return U.page("项目中心 / 无权限", "项目不存在或不可见", "请从项目列表重新选择；直接访问不存在的项目不会自动跳转到其他项目。",
              U.btn("返回项目列表", "common.projects", "primary"),
              U.empty("项目不存在", "检查项目编号，或从项目列表进入。"));
          }
          if (!DB.derived.canViewProject(p)) {
            return U.page("项目中心 / 无权限", "项目不在可见范围", "当前身份「" + App.identity().name + "」的可见范围是：" + DB.derived.scopeLabel() + "。跨项目访问必须由项目负责人或企业管理员授权，未授权时不渲染任何项目内容。",
              U.btn("返回项目列表", "common.projects", "primary") + U.btn("查看角色权限", "projects.lifecycleLink"),
              U.empty("无访问权限", "如确需参与该项目，请由项目负责人授予项目角色后再访问；授权动作会写入审计。"));
          }
          const sum = DB.derived.projectSummary(p);
          const grantable = App.can("grant.manage");
          const actions = [];
          actions.push(U.btn("打开制作流水线", "projects.wfOpen", "primary", { pid: p.id }));
          if (App.can("project.manage") && DB.state.canMove(p, "已暂停").ok) actions.push(U.btn("暂停项目", "projects.pause", "", { id: p.id }));
          if (grantable) actions.push(U.btn("发起移交", "orgs.transfer"));
          if (App.can("delivery.execute") && ["待最终审核", "已完成"].indexOf(p.status) >= 0) actions.push(U.btn("进入交付", "projects.deliveryLink", "primary", { id: p.id }));
          const members = (p.members || []).map(m => {
            const u = D.users.find(x => x.id === m.userId) || { name: m.userId, dept: "—" };
            return "<tr><td>" + U.entity(u.name, m.userId, u.name.slice(0, 1)) + "</td><td>" + U.pill(m.role, "info") + "</td><td class=\"faint\">" + U.esc(u.dept) + "</td><td>" + (grantable ? U.btn("调整", "orgs.editGrant", "sm", { project: p.id, user: m.userId }) : '<span class="faint small">按授权只读</span>') + "</td></tr>";
          }).join("");
          const q = sum.quality;
          const reviewLatest = sum.reviews[0];
          const deliveryLatest = sum.deliveries[0];
          const riskLatest = sum.risks[0];
          const events = [{ time: p.created, title: "项目创建", desc: "归属企业 · 负责人 " + p.owner + " · 部门 " + p.dept }]
            .concat(sum.reviews.map(r => ({ time: r.at, title: r.node + " · " + r.result, desc: r.note })))
            .concat(sum.deliveries.map(d => ({ time: d.at, title: "交付包 " + d.id + " · " + d.status, desc: d.episodes + " 集 · 校验 " + d.checksum })))
            .concat([{ time: p.updated, title: "当前状态 · " + p.status, desc: p.phase + " · 更新人 " + p.owner }]);
          return U.page("项目中心 / " + p.id, p.name, "项目归属企业，由员工独立推进；协作是授权行为。动作按「权限 + 状态 + 前置条件」渲染，不可用动作不显示。",
            actions.join("") || '<span class="faint small">当前状态无可执行的项目级动作</span>',
            U.card("阶段进度", stageChain(p) + '<div class="mt-3">' + U.desc([["当前阶段", p.phase], ["项目状态", '<span class="pill ' + U.toneOf(p.status) + '">' + p.status + "</span>", true], ["已完成集数", DB.derived.progressOf(p).done + " / " + DB.derived.progressOf(p).total + "（" + DB.derived.progressOf(p).pct + "%）"], ["最近更新", p.updated]]) + "</div>", "阶段门禁不满足时任务保持待执行") +
            '<div class="split mt-4"><div class="stack">' +
              U.card("项目档案", U.desc([
                ["项目编号", p.id], ["题材 / 受众", p.genre + " · " + p.audience], ["计划集数 / 单集时长", p.episodes + " 集 / " + p.duration],
                ["画幅与分辨率", p.ratio], ["语言", p.language], ["交付要求", p.delivery || "—"], ["风格要求", p.style], ["内容禁忌", p.constraints],
                ["所属部门", p.dept], ["负责人", p.owner], ["创建时间", p.created]
              ]), "项目档案是下游生成的输入，不允许页面直接改写") +
              U.card("创作基准（下游唯一依据）", U.desc([["正式剧本版本", p.scriptVersion], ["时间线版本", p.timelineVersion], ["剧本锁定", p.scriptVersion.indexOf("锁定") >= 0 ? '<span class="pill ok">已锁定</span>' : '<span class="pill warn">未锁定</span>', true], ["引用规则", "下游必须锁定具体版本号，不得引用「当前最新」"]]) +
                U.notice("已通过审核并锁定的正式版本不得静默覆盖；变更必须产生新版本并重新走审核。", "info"), "版本变更触发影响分析") +
              U.card("成员与授权", U.table(["成员", "项目角色", "部门", "操作"], members), "非成员即使持有功能权限码也不得访问项目内对象",
                grantable ? U.btn("新增授权", "orgs.grantNew", "sm") : "") +
            '</div><div class="stack">' +
              U.card("预算与成本", U.progress(pct(p), "已用 " + budgetText(p), pct(p) > (D.pricing ? D.pricing.budgetWarnRate * 100 : 85) ? "warn" : "") +
                U.listRows([["预计成本", "¥" + p.estimated.toLocaleString()], ["实际成本", "¥" + DB.derived.budgetOfProject(p).used.toLocaleString()], ["预算状态", '<span class="pill ' + U.toneOf(DB.derived.budgetOfProject(p).state) + '">' + DB.derived.budgetOfProject(p).state + "</span>", true], ["计费依据", "供应商用量或账单，不用估算替代实际"]]) +
                '<div class="mt-3">' + U.btn("成本明细", "cost.ledgerLink", "sm", { project: p.id }) + "</div>", "预计与实际分栏展示") +
              U.card("质量与审核", U.desc([
                ["项目质量", '<span class="pill ' + U.toneOf(p.quality) + '">' + p.quality + "</span>", true],
                ["质量报告", q.reports.length ? q.reports.length + " 份 · PASS " + q.pass + " · 待人工 " + q.review + (q.fail ? " · FAIL " + q.fail : "") : "尚无报告"],
                ["最近报告", q.last ? q.last.id + " · " + q.last.result : "—"],
                ["审核记录", sum.reviews.length ? sum.reviews.length + " 条 · 最近 " + reviewLatest.result : "尚无审核记录"]
              ]) +
                '<div class="mt-3">' + U.btn("质量报告", "projects.qcLink", "sm", { id: p.id }) + "</div>", "质量报告绑定被检对象版本") +
              U.card("风险与待办", U.listRows([
                ["未闭环风险", sum.risks.length ? sum.risks.length + " 项 · " + riskLatest.type : "无"],
                ["待审核", p.status.indexOf("待") >= 0 ? "1 项" : "无"],
                ["交付包", deliveryLatest ? deliveryLatest.id + " · " + deliveryLatest.status : "未生成"],
                ["待办归属", p.owner]
              ]) +
                U.notice("项目进入异常时只暂停受影响链路，不整项目全停；通知到项目负责人与资源配置人。", "warn"), "异常处理需形成闭环记录") +
            "</div></div>" +
            U.card("生命周期记录", U.timeline(events), "状态迁移保留前后状态、触发动作、操作者与关联任务")
          );
        }
      },
      {
        path: "projects/lifecycle", title: "生命周期与状态机", icon: "clock", permission: "project.manage",
        desc: "12 个主流程状态 + 3 个干涉状态。状态迁移必须由真实业务动作或系统回执触发，禁止页面手工随意改状态。",
        render() {
          const visible = DB.derived.visibleProjects();
          const paused = visible.filter(p => p.status === "已暂停").length;
          const abnormal = visible.filter(p => p.status === "异常中").length;
          const active = visible.filter(p => ["生产中", "生产准备中", "后期制作中", "质量检测中", "待最终审核"].indexOf(p.status) >= 0).length;
          return U.page("项目中心 / 生命周期", "生命周期与状态机", "每次迁移保留迁移记录：迁移前后状态、触发动作、操作者或系统主体、时间、关联任务。",
            U.btn("批量暂停项目", "projects.pauseAll") + U.btn("批量恢复项目", "projects.resumeAll") + U.btn("终止指定项目", "projects.terminate", "danger"),
            U.card("状态定义与进入条件", U.table(["状态", "含义", "进入条件", "是否可终止"], D.projectStates.map(s =>
              "<tr><td>" + U.pill(s.name) + '</td><td class="cell-wrap">' + U.esc(s.mean) + '</td><td class="cell-wrap muted">' + U.esc(s.enter) + "</td><td>" + U.esc(s.end) + "</td></tr>").join("")), "状态与业务结果分离") +
            '<div class="grid grid-2 mt-4">' +
              U.card("迁移规则", U.listRows([
                ["顺序", "主流程按业务动作顺序推进，不允许跨阶段跳跃"],
                ["自动进出", "「质量检测中」由分集成片输出自动进入；无阻断项自动进入「待最终审核」"],
                ["干涉状态", "「已暂停」「异常中」可挂在任一进行中状态之上，恢复回到被挂起前状态"],
                ["终止", "取消尚未执行的下游计划与任务，保留已产生记录与费用"],
                ["返工", "「已完成」后可退回后期或生产，但必须保留原终审记录"],
                ["记录", "状态变更写入项目生命周期记录，含原因、操作者、时间与关联任务"]
              ]), "禁止手工改状态伪造完成数量") +
              U.card("可见项目状态分布", U.stackbar([{ label: "已暂停", value: paused, color: "var(--warn)" }, { label: "异常中", value: abnormal, color: "var(--bad)" }, { label: "进行中", value: active, color: "var(--ok)" }, { label: "其他", value: Math.max(0, visible.length - paused - abnormal - active), color: "var(--line-strong)" }]) +
                U.listRows([["暂停", "阻止新任务派发；按供应商能力取消或等待运行中任务收口"], ["恢复", "重新计算可执行任务集合，不重复提交已成功任务"], ["异常恢复", "重新做预算预检与资源可用性检查"]]) +
                '<div class="mt-3">' + U.btn("查看异常中心", "projects.incidentsLink", "sm") + "</div>", "计数来自当前可见项目，不使用固定示例值") +
            "</div>" +
            U.card("项目当前状态", U.table(["项目", "当前状态", "阶段", "负责人", "更新时间", "下一步"], visible.map(p => {
              const next = DB.derived.workflow(p).next[0];
              return '<tr><td>' + U.entity(p.name, p.id, "剧") + '</td><td>' + U.pill(p.status) + '</td><td class="cell-wrap">' + U.esc(p.phase) + '</td><td>' + U.esc(p.owner) + '</td><td class="idx">' + U.esc(p.updated) + '</td><td class="cell-wrap muted">' + U.esc(next ? next.title : "无待办") + "</td></tr>";
            }).join(""), "当前可见范围内没有项目"), "状态迁移由动作写入审计，本页只显示当前快照") +
            '<div class="mt-4">' + U.btn("查看审计流水", "compliance.toAudit") + "</div>"
          );
        }
      }
    ]
  });

  App.on("projects.new", () => App.go("projects/new"));
  App.on("projects.setStatus", (el) => { App.set(SCOPE, "status", el.dataset.value || ""); App.refresh(); });
  App.on("projects.setRel", (el) => { App.set(SCOPE, "rel", el.dataset.value || ""); App.refresh(); });
  App.on("projects.lifecycleLink", () => App.go("projects/lifecycle"));
  App.on("projects.incidentsLink", () => App.go("notify/incidents"));
  App.on("projects.qcLink", (el) => App.go("quality/reports", el && el.dataset.id ? { id: el.dataset.id } : undefined));
  App.on("projects.deliveryLink", (el) => { const pid = el && el.dataset && el.dataset.id; App.go("post/delivery", pid ? { id: pid } : undefined); });
  App.on("projects.detail", (el) => { App.go("projects/detail", { id: el.dataset.id }); });
  /* 项目 CRUD 动作只在 v9.1 层注册一次，避免同名动作被覆盖成两套交互 */
})();

/* ===== v9.1 真实流程层：立项 / 暂停恢复 / 终止 ===== */
(function () {
  const U = UI, D = DB;

  /* 立项唯一入口：projects/new 页表单。页面即表单，弹窗不再重复收一遍字段。 */
  function submitProjectForm(asDraft) {
    if (!App.guard("project.create")) return;
    const view = document.getElementById("view");
    if (!view) return;
    const d = App.collect(view);
    if (asDraft && !String(d.name || "").trim()) {
      let n = 1;
      while (D.projects.some(p => p.name === "未命名项目 " + n)) n += 1;
      d.name = "未命名项目 " + n;
    }
    if (!asDraft) {
      const errs = App.validateFields(view, d);
      const keys = Object.keys(errs);
      if (keys.length) {
        keys.forEach(k => App.fieldError(view, k, errs[k]));
        App.formError(view, "有 " + keys.length + " 项需要修正后再创建；当前输入已保留。");
        return;
      }
    }
    App.job({
      title: asDraft ? "保存项目草稿" : "创建项目",
      sub: asDraft ? "草稿不占用生产资源，可稍后补全必填项" : "校验通过后生成唯一项目编号并进入项目详情",
      steps: ["校验名称唯一性与预算余额", "生成项目编号", "写入项目与预算台账"],
      refresh: false,
      run() {
        const r = DB.state.createProject(d);
        if (!r.ok) return r;
        DB.state.log("项目 " + r.data.id, (asDraft ? "保存草稿：" : "创建项目：") + d.name, "成功", r.data.id);
        App.set("projects", "last", r.data.id);
        return { ok: true, msg: (asDraft ? "草稿已保存：" : "项目已创建：") + r.data.id + " · " + d.name, data: r.data };
      },
      after(out) {
        if (!out || !out.ok) {
          App.formError(view, (out && out.msg) || "创建未完成");
          Object.keys((out && out.fields) || {}).forEach(k => App.fieldError(view, k, out.fields[k]));
          return;
        }
        App.go(asDraft ? "projects/detail" : "projects/workflow", { id: out.data.id });
      }
    });
  }

  App.on("projects.saveDraft", () => submitProjectForm(true));

  App.on("projects.create", () => submitProjectForm(false));

  App.on("projects.pause", (el) => {
    if (!App.guard("project.manage")) return;
    const id = (el && el.dataset && el.dataset.id) || ((App.currentProject() || {}).id || "");
    if (!id) { App.toast("缺少项目上下文，未执行暂停；请从项目详情或流水线进入", "bad"); return; }
    const p = D.projects.find(x => x.id === id);
    if (!p || !DB.derived.canViewProject(p)) { App.toast("项目不存在或不在可见范围，未执行暂停", "bad"); return; }
    const gate = DB.state.canMove(p, "已暂停");
    if (!gate.ok) { App.toast(p.name + "：" + gate.msg, "bad"); return; }
    App.modal({
      title: "暂停项目 · " + p.name, sub: "暂停后停止派发新任务；运行中任务按供应商能力收口，已发生费用仍入账",
      body: U.fTextarea("暂停原因", "reason", { required: true, minlen: 8, rows: 3, placeholder: "例如：预算接近阈值，等待追加审批" }) +
        U.notice("暂停后项目状态为「已暂停」，恢复时任务重新进入排队。", "warn"),
      submitText: "确认暂停",
      onSubmit(d) {
        return App.job({
          title: "暂停项目", steps: ["校验项目状态", "停止任务派发", "写入生命周期记录"],
          run() { return DB.state.pause(p.id, d.reason); }
        });
      }
    });
  });

  App.on("projects.resumeAll", () => {
    if (!App.guard("project.manage")) return;
    const list = D.projects.filter(p => p.status === "已暂停");
    if (!list.length) { App.toast("当前没有已暂停项目", "bad"); return; }
    App.confirm("批量恢复项目", "将恢复 " + list.length + " 个项目，暂停任务重新排队；请确认预算与资源已就绪。", () => {
      App.job({
        title: "批量恢复", steps: ["校验预算", "恢复项目状态", "任务重新排队"],
        run() {
          const bad = [];
          list.forEach(p => { const r = DB.state.resume(p.id); if (!r.ok) bad.push(p.id + "：" + r.msg); });
          return { ok: bad.length < list.length, msg: "已恢复 " + (list.length - bad.length) + " 个项目" + (bad.length ? "；失败 " + bad.length + " 个（" + bad[0] + "）" : "") };
        }
      });
    }, "恢复");
  });

  App.on("projects.pauseAll", () => {
    if (!App.guard("project.manage")) return;
    App.modal({
      title: "批量暂停", sub: "批量暂停将同时影响多个项目，需记录统一原因",
      body: U.fSelect("范围", "scope", ["生产中项目", "异常中项目", "全部进行中项目"], { required: true }) +
        U.fTextarea("暂停原因", "reason", { required: true, minlen: 8, rows: 3 }) + U.fCheck("已通知各项目负责人", "okn", { checked: false }),
      submitText: "批量暂停",
      onSubmit(d) {
        return App.job({
          title: "批量暂停", steps: ["筛选目标项目", "逐个暂停", "通知负责人"],
          run() {
            if (!d.okn) return { ok: false, msg: "需先通知项目负责人并勾选确认", fields: { okn: "请勾选" } };
            const targets = D.projects.filter(p => d.scope === "生产中项目" ? p.status === "生产中" : d.scope === "异常中项目" ? p.status === "异常中" : ["生产中", "异常中", "生产准备中"].indexOf(p.status) >= 0);
            const ok = [];
            targets.forEach(p => { const r = DB.state.pause(p.id, d.reason); if (r.ok) { ok.push(p.id); DB.state.notify({ type: "项目暂停", project: p.id, title: "项目 " + p.id + " 已暂停", reason: d.reason, impact: "该项目的排队与执行中任务已挂起，费用照常入账", state: "待处理", action: "恢复项目或终止并记录原因", owner: p.owner, link: "projects/workflow" }); } });
            return { ok: ok.length > 0, msg: "已暂停 " + ok.length + " 个项目" + (ok.length ? "（" + ok.join("、") + "）" : "") };
          }
        });
      }
    });
  });

  App.on("projects.terminate", () => {
    if (!App.guard("project.manage")) return;
    const list = D.projects.filter(p => ["已交付", "已归档", "已终止"].indexOf(p.status) < 0);
    App.modal({
      title: "终止项目", sub: "终止为终态：重复步骤不可逆，历史资产与费用保留",
      body: U.fSelect("项目", "project", list.map(p => ({ value: p.id, label: p.id + " · " + p.name + "（" + p.status + "）" })), { required: true }) +
        U.fTextarea("终止原因", "reason", { required: true, minlen: 10, rows: 3, placeholder: "说明影响范围、确认人，以及下游如何处理" }) +
        U.fCheck("已确认下游交付/合同影响", "oka", { checked: false }) +
        U.notice("终止将取消未执行任务；已完成资产、尝试记录与费用不删除。", "bad"),
      submitText: "确认终止",
      onSubmit(d) {
        return App.job({
          title: "终止项目", steps: ["校验项目状态", "取消未执行任务", "写生命周期与审计"],
          run() {
            if (!d.oka) return { ok: false, msg: "需确认下游交付与合同影响", fields: { oka: "请勾选确认" } };
            return DB.state.terminate(d.project, d.reason);
          }
        });
      }
    });
  });

  /* ===== v9.3 项目制作流水线：每个按钮都落到真实 Store 操作 ===== */
  function wfProject(el) {
    const id = (el && el.dataset ? el.dataset.pid : "") || ((App.currentProject() || {}).id || "");
    const p = id ? D.projects.find(x => x.id === id) : null;
    return p && DB.derived.canViewProject(p) ? p : null;
  }
  function wfNeed(el) {
    const p = wfProject(el);
    if (!p) { App.toast("缺少当前项目上下文或项目不在可见范围，已阻断，请从项目中心重新进入", "bad"); return null; }
    return p;
  }

  App.on("projects.wfOpen", (el) => {
    const p = wfNeed(el);
    if (!p) return;
    App.set("projects", "wfCurrent", p.id);
    App.go("projects/workflow", { id: p.id });
  });

  App.on("projects.wfBrief", (el) => {
    const p = wfNeed(el);
    if (!p) return;
    if (p) App.set("projects", "wfCurrent", p.id);
    App.go("creation/brief", p ? { id: p.id } : undefined);
  });
  App.on("projects.wfGoReview", (el) => {
    const p = wfNeed(el);
    if (!p) return;
    if (p) App.set("projects", "wfCurrent", p.id);
    App.go("creation/review", p ? { id: p.id } : undefined);
  });

  App.on("projects.wfGenerateScript", (el) => {
    if (!App.guard("creation.write")) return;
    const p = wfNeed(el);
    if (!p) return;
    if (!p) return;
    App.job({
      title: "生成候选剧本", sub: "基于已选定方案生成完整分集稿，完成后进入待审核",
      steps: ["校验方案与项目状态", "调用推理模型生成", "写入候选版本与成本"],
      run() { return DB.state.generateScript(p.id); },
      after(out) { if (out && out.ok) App.go("projects/workflow", { id: p.id }); }
    });
  });

  App.on("projects.wfApprove", (el) => {
    if (!App.guard("script.review")) return;
    const p = wfNeed(el);
    if (!p) return;
    const s = D.scripts.find(x => x.project === p.id && x.status === "待审核");
    if (!s) { App.toast("当前没有待审核候选剧本", "bad"); return; }
    App.modal({
      title: "剧本审核 · " + p.name, sub: "通过后锁定 " + s.id + " 为全剧唯一正式版本，拆解与生产才可启动",
      body: U.fTextarea("审核依据", "note", { required: true, minlen: 10, rows: 4, value: "已逐集检查主线、人物动机、钩子与合规边界；结局与原著一致，无残留阻断项。" }) +
        U.notice("审核依据必须覆盖剧情、人物、节奏与合规；锁定后修改只能派生新版本。", "info"),
      submitText: "通过并锁定",
      onSubmit(d) {
        return App.job({
          title: "剧本审核 · 节点 A", steps: ["校验审核依据", "锁定正式版本", "启动生产准备"],
          run() { return DB.state.approveScript(s.id, { note: d.note, positions: "全 " + p.episodes + " 集" }); },
          after(out) { if (out && out.ok) App.go("projects/workflow", { id: p.id }); }
        });
      }
    });
  });

  App.on("projects.wfBreakdown", (el) => {
    if (!App.guard("creation.write")) return;
    const p = wfNeed(el);
    if (!p) return;
    App.confirm("拆解剧本", "将把 " + p.episodes + " 集剧本拆成场、人物、场景、道具与镜头契约；拆解结果引用锁定版本，不会改动剧本。", () => {
      App.job({
        title: "拆解剧本", sub: "生成全部分集与镜头契约，同时建立角色 / 场景资产",
        steps: ["读取锁定剧本", "生成集 / 场 / 人物 / 场景", "写入镜头契约与生产计划"],
        run() { return DB.state.breakdown(p.id); },
        after(out) { if (out && out.ok) App.go("projects/workflow", { id: p.id }); }
      });
    }, "开始拆解");
  });

  App.on("projects.wfAssets", (el) => {
    if (!App.guard("director.write")) return;
    const p = wfNeed(el);
    if (!p) return;
    const wf = DB.derived.workflow(p);
    if (!wf.pendingAssets.length) { App.toast("本项目没有待确认资产", "bad"); return; }
    App.modal({
      title: "确认视觉设定 · " + p.name, sub: "以下资产将作为全剧人物与场景的唯一参考，确认后固化版本",
      body: '<div class="wf-asset-list">' + wf.pendingAssets.map(a => '<div class="wf-asset-line"><span>' + U.entity(a.name, a.id, a.name.slice(0, 1)) + '</span><small>' + U.esc(a.look || a.layout || a.type || "") + '</small><span class="pill warn">待确认</span></div>').join("") + "</div>" +
        U.notice("确认前请核对人物识别点、服装、场景光位与道具连续性；确认后如变更需派生新版本。", "warn"),
      submitText: "确认全部（" + wf.pendingAssets.length + "）",
      onSubmit() {
        return App.job({
          title: "确认视觉资产", steps: ["逐项核对引用图", "锁定版本", "写入资产台账"],
          run() {
            const bad = [];
            wf.pendingAssets.forEach(a => {
              const kind = D.characters.some(x => x.id === a.id) ? "character" : "location";
              const r = DB.state.confirmAsset(kind, a.id);
              if (!r.ok) bad.push(a.name + "：" + r.msg);
            });
            return bad.length ? { ok: false, msg: bad[0] } : { ok: true, msg: "已确认 " + wf.pendingAssets.length + " 个资产" };
          },
          after(out) { if (out && out.ok) App.go("projects/workflow", { id: p.id }); }
        });
      }
    });
  });

  App.on("projects.wfFreeze", (el) => {
    if (!App.guard("director.write")) return;
    const p = wfNeed(el);
    if (!p) return;
    const plan = D.plans.filter(x => x.project === p.id).slice(-1)[0];
    if (!plan) { App.toast("没有生产计划可固化，请先拆解", "bad"); return; }
    App.confirm("固化生产计划", "固化后镜头契约、资产版本与预算即锁定；项目进入生产中，可按集提交生产任务。", () => {
      App.job({
        title: "固化生产计划", steps: ["校验生产门禁", "锁定镜头契约与资产", "项目进入生产中"],
        run() { return DB.state.freezePlan(plan.id); },
        after(out) { if (out && out.ok) App.go("projects/workflow", { id: p.id }); }
      });
    }, "固化并开始生产");
  });

  App.on("projects.wfBatch", (el) => {
    if (!App.guard("production.write")) return;
    const p = wfNeed(el);
    if (!p) return;
    const wf = DB.derived.workflow(p);
    const first = (wf.eps.filter(e => e.qc !== "PASS")[0] || {}).no || 1;
    const remain = wf.eps.filter(e => e.qc !== "PASS").length;
    App.modal({
      title: "连续生产 · " + p.name, sub: "按镜头提交 → 供应商执行 → 下载持久化 → 镜头质检；失败即停，不跳过、不伪造 PASS",
      body: U.fField("起始集", "fromEp", { required: true, type: "number", value: String(first), min: 1, max: p.episodes, hint: "从该集起连续处理剩余 " + remain + " 集" }) +
        U.notice("预计每镜 ¥" + (D.pricing ? D.pricing.videoPerShot : "—") + "（演示价目）；当前预算剩余 ¥" + Math.max(0, DB.derived.budgetOfProject(p).total - DB.derived.budgetOfProject(p).used) + "。预算不足会在集边界停止。", "info"),
      submitText: "开始连续生产",
      onSubmit(d) {
        return App.job({
          title: "连续生产", sub: "逐镜头执行，完成后统一进入后期",
          steps: ["预算与待人工镜头预检", "逐镜提交并等待回执", "下载结果并跑镜头质检", "汇总分集与成本"],
          refresh: true,
          run() { return DB.state.batchProduce(p.id, Number(d.fromEp)); },
          after(out) {
            App.go("projects/workflow", { id: p.id });
            if (out && !out.ok) App.toast(out.msg, "bad");
          }
        });
      }
    });
  });

  App.on("projects.wfTimeline", (el) => {
    if (!App.guard("post.write")) return;
    const p = wfNeed(el);
    if (!p) return;
    const tl = D.timelines.find(t => t.project === p.id && t.stale > 0);
    if (!tl) { App.toast("没有标脏时间线", "bad"); return; }
    App.modal({
      title: "重出第 " + tl.ep + " 集时间线", sub: "先采用新镜头版本替换标脏片段，再输出新版本；旧版本保留",
      body: U.fTextarea("替换说明", "note", { required: true, minlen: 8, rows: 3, value: "已采用第 " + tl.ep + " 集最新镜头版本替换标脏片段，复核同场景衔接后重出。" }),
      submitText: "替换并重出",
      onSubmit(d) {
        return App.job({
          title: "重出时间线", steps: ["替换标脏片段", "重算片段时长", "输出新版本"],
          run() { return DB.state.resolveTimeline(p.id, tl.ep, d.note); },
          after(out) { if (out && out.ok) App.go("projects/workflow", { id: p.id }); }
        });
      }
    });
  });

  App.on("projects.wfSubtitle", (el) => {
    if (!App.guard("post.write")) return;
    const p = wfNeed(el);
    if (!p) return;
    const subs = D.subtitles.filter(s => s.project === p.id && s.status !== "已通过");
    if (!subs.length) { App.toast("当前项目没有待校对字幕", "bad"); return; }
    App.go("audio/subtitle", { id: p.id });
    App.toast("已打开字幕与口型：待校对 E" + subs.map(s => s.ep).join("、E"));
  });

  App.on("projects.wfFinishPost", (el) => {
    if (!App.guard("post.write")) return;
    const p = wfNeed(el);
    if (!p) return;
    App.confirm("完成字幕、混音与合成", "将为全部分集生成字幕、清点音轨并输出分集时间线；字幕未校对、镜头未通过或时间线标脏都会阻断。", () => {
      App.job({
        title: "字幕 · 混音 · 合成", steps: ["检查逐集镜头", "生成字幕草稿", "合成时间线", "项目进入质量检测"],
        run() { return DB.state.finishPost(p.id); },
        after(out) { App.go("projects/workflow", { id: p.id }); }
      });
    }, "开始后期");
  });

  App.on("projects.wfQcAll", (el) => {
    if (!App.guard("quality.operate")) return;
    const p = wfNeed(el);
    if (!p) return;
    const wf = DB.derived.workflow(p);
    App.confirm("整集质检", "将逐集检测剩余 " + (p.episodes - wf.passEps.length) + " 集；任一项阻断即停止，不把集数数量当通过率。", () => {
      App.job({
        title: "整集质检", steps: ["检查镜头与时间线", "逐集跑检测", "写入质量报告", "自动进入待终审"],
        run() { return DB.state.qcAll(p.id); },
        after(out) { App.go("projects/workflow", { id: p.id }); }
      });
    }, "开始质检");
  });

  App.on("projects.wfFinal", (el) => {
    if (!App.guard("final.review")) return;
    const p = wfNeed(el);
    if (!p) return;
    App.modal({
      title: "最终成片审核 · 节点 B", sub: "终审结论决定能否生成交付包；非通过结论必须指定集 / 场 / 镜头与时间点",
      body: U.fSelect("结论", "decision", [
        { value: "pass", label: "通过交付 · 进入交付流程" },
        { value: "rework", label: "指定镜头 / 片段返工 · 仅重做指定内容" },
        { value: "back", label: "退回后期 · 重做时间线或合成" },
        { value: "terminate", label: "终止交付 · 记录原因并取消交付" }
      ], { required: true }) +
        U.fTextarea("审核依据 / 返工说明", "note", { required: true, minlen: 10, rows: 4, value: "已抽检全剧开头、集中冲突与结尾钩子；人物一致、字幕同步、无合规阻断，交付规格符合 9:16 要求。" }) +
        U.fField("问题位置（非通过必填）", "positions", { placeholder: "例如：E18 / S03 / SH-05 / 00:12" }) +
        U.notice("终审意见必须关联具体版本与问题位置（集、场、镜头、时间点），不允许只写整体评价。终止交付会取消交付流程并保留全部记录与费用。", "warn"),
      submitText: "提交终审",
      onSubmit(d) {
        return App.job({
          title: "终审 · 节点 B", steps: ["校验结论与依据", "写入审核记录", "推进或退回项目"],
          run() { return DB.state.finalReview(p.id, { decision: d.decision, note: d.note, positions: d.positions }); },
          after(out) { if (out && out.ok) App.go("projects/workflow", { id: p.id }); }
        });
      }
    });
  });

  App.on("projects.wfDelivery", (el) => {
    if (!App.guard("delivery.execute")) return;
    const p = wfNeed(el);
    if (!p) return;
    const wf = DB.derived.workflow(p);
    if (!wf.gateDelivery.ok) {
      App.toast("交付门禁未通过，先处理 " + wf.gateDelivery.items.filter(i => !i.ok).map(i => i.label).join("、"), "bad");
      return;
    }
    const pending = D.deliveries.find(d => d.project === p.id && d.status === "待确认");
    if (pending) {
      App.confirm("确认交付并冻结版本", pending.id + " 已生成，包含 " + pending.episodes + " 集；确认后交付 V1 冻结，历史不可覆盖。", () => {
        App.job({
          title: "确认交付", steps: ["复核交付清单", "冻结版本", "写入作品库"],
          run() { return DB.state.confirmDelivery(pending.id, "企业内容库"); },
          after(out) { if (out && out.ok) App.go("projects/workflow", { id: p.id }); }
        });
      }, "确认交付");
      return;
    }
    App.confirm("生成交付包", "将通过交付门禁校验后生成 V1 交付包；生成后仍需二次确认才会冻结。", () => {
      App.job({
        title: "生成交付包", steps: ["校验交付门禁", "汇总视频 / 字幕 / 封面", "生成校验摘要"],
        run() { return DB.state.generateDelivery(p.id); },
        after(out) { App.go("projects/workflow", { id: p.id }); }
      });
    }, "生成交付包");
  });

  App.on("projects.wfRights", (el) => {
    if (!App.guard("project.manage")) return;
    const p = wfNeed(el);
    if (!p) return;
    const wf = DB.derived.workflow(p);
    const bad = wf.gateDelivery.items.filter(i => !i.ok);
    if (!bad.length) { App.toast("交付门禁已通过，可直接生成交付包", "good"); return; }
    const rights = D.rights.filter(r => r.project === p.id && (r.status === "阻断交付" || r.status === "未通过" || r.review === "未通过"));
    if (!rights.length) {
      App.go("compliance/rights", { id: p.id });
      return;
    }
    const target = rights[0];
    App.modal({
      title: "解除交付授权阻断", wide: true,
      sub: target.id + " · " + target.subject + " 当前「" + target.status + "」；交付门禁要求全部素材授权有效。",
      body: U.fSelect("处理方式", "fix", [
        { value: "replace", label: "替换为平台已授权素材（推荐）" },
        { value: "renew", label: "补签授权并登记到期日" }
      ], { required: true, value: "replace" }) +
        U.fField("新授权到期日", "term", { value: "2027-12-31", hint: "补签授权时必填，格式 YYYY-MM-DD", placeholder: "YYYY-MM-DD" }) +
        U.fTextarea("处理说明", "note", { rows: 3, value: "停用来源不明的第三方配乐，改用平台曲库中已获全渠道商用授权的替代曲目，并复核第 8–9 集混音。" }),
      submitText: "执行并复核",
      onSubmit(d) {
        return App.job({
          title: "解除授权阻断", steps: ["锁定阻断素材", d.fix === "renew" ? "补签授权与到期日" : "替换为已授权素材", "重跑交付门禁"],
          run() {
            if (d.fix === "renew") return DB.state.renewRights(target.id, d.term);
            return DB.state.replaceRightsAsset(target.id);
          },
          after(out) { if (out && out.ok) App.go("projects/workflow", { id: p.id }); }
        });
      }
    });
  });

  App.on("projects.wfArchive", (el) => {
    if (!App.guard("delivery.execute")) return;
    const p = wfNeed(el);
    if (!p) return;
    App.confirm("归档项目", "归档后项目与交付资产转只读；可查不可改。", () => {
      App.job({
        title: "归档项目", steps: ["校验交付状态", "冻结资产", "写入归档记录"],
        run() { return DB.state.archive(p.id); },
        after(out) { if (out && out.ok) App.go("projects/workflow", { id: p.id }); }
      });
    }, "归档");
  });

  App.on("projects.wfBudget", (el) => {
    if (!App.guard("project.manage")) return;
    const p = wfNeed(el);
    if (!p) return;
    const b = DB.derived.budgetOfProject(p);
    App.modal({
      title: "调整项目预算", sub: "当前已用 ¥" + b.used + "；追加后才能继续提交生产任务",
      body: U.fField("新预算总额", "total", { required: true, type: "number", value: String(Math.max(b.total, Math.ceil(b.used * 1.3))) }) +
        U.fTextarea("调整理由", "reason", { required: true, minlen: 8, rows: 3, value: "全剧镜头与质检成本高于初始估算，按实际剩余集数追加预算。" }),
      submitText: "保存预算",
      onSubmit(d) {
        return App.job({
          title: "调整预算", steps: ["校验已用金额", "更新项目与部门预算", "写入审计"],
          run() { return DB.state.adjustBudget(p.id, Number(d.total), d.reason); },
          after(out) { if (out && out.ok) App.go("projects/workflow", { id: p.id }); }
        });
      }
    });
  });

  App.on("projects.wfResume", (el) => {
    if (!App.guard("project.manage")) return;
    const p = wfNeed(el);
    if (!p) return;
    App.job({ title: "恢复项目", steps: ["校验暂停状态", "恢复排队任务", "写生命周期"], run() { return DB.state.resume(p.id); } });
  });

  App.on("projects.wfQuality", (el) => {
    const p = wfNeed(el);
    if (!p) return;
    App.go("quality/reports", { id: p.id });
  });

  App.on("projects.wfEpDetail", (el) => {
    const p = wfNeed(el);
    if (!p) return;
    const ep = Number(el.dataset.ep);
    const e = D.episodes.find(x => x.project === p.id && x.no === ep);
    const shots = D.shots.filter(s => s.project === p.id && s.ep === ep);
    const tl = D.timelines.find(t => t.project === p.id && t.ep === ep);
    const sub = D.subtitles.find(s => s.project === p.id && s.ep === ep);
    const reports = D.qualityReports.filter(r => String(r.object).indexOf(p.id + " / 第 " + ep + " ") >= 0);
    App.drawer("E" + String(ep).padStart(2, "0") + " · " + (e ? e.title : ""),
      U.desc([["状态", e ? e.status : "—"], ["质检", e ? e.qc : "—"], ["场 / 镜", (e ? e.scenes : 0) + " 场 / " + shots.length + " 镜"],
        ["通过镜头", shots.filter(s => s.status === "已通过").length + " / " + shots.length],
        ["时间线", tl ? tl.version + (tl.stale ? " · 标脏 " + tl.stale : " · 无标脏") : "未生成"],
        ["字幕", sub ? sub.version + " · " + sub.status : "未生成"]]) +
      U.table(["镜头", "景别", "时长", "状态", "质检"], shots.slice(0, 10).map(s =>
        '<tr><td>' + U.code(s.id) + "</td><td>" + U.esc(s.frame) + "</td><td>" + U.esc(s.duration) + "</td><td>" + U.pill(s.status) + "</td><td>" + U.esc(s.qc || "—") + "</td></tr>").join("")) +
      (reports.length ? U.table(["报告", "结果", "问题"], reports.map(r => '<tr><td>' + U.code(r.id) + "</td><td>" + U.pill(r.result) + '</td><td class="num">' + r.issues + "</td></tr>").join("")) : U.empty("尚无质检报告", "该集完成后期后才会有整集报告。")) +
      '<div class="btn-row-inline">' + U.btn("打开分镜板", "projects.wfToShots", "sm", { pid: p.id }) + U.btn("打开视频生产", "projects.wfToProduction", "sm", { pid: p.id }) + "</div>"
    );
  });

  App.on("projects.wfToShots", (el) => App.go("director/shots", { id: (el && el.dataset.pid) || ((App.currentProject() || {}).id || "") }));
  App.on("projects.wfToProduction", (el) => App.go("video/production", { id: (el && el.dataset.pid) || ((App.currentProject() || {}).id || "") }));
  App.on("projects.wfToQuality", (el) => App.go("quality/reports", { id: (el && el.dataset.pid) || ((App.currentProject() || {}).id || "") }));

})();



