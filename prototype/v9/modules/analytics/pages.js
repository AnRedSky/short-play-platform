/* 模块：analytics 经营分析 */
(function () {
  const U = UI, D = DB, SCOPE = "analytics";
  const A = D.analytics;
  const money = (n) => "¥" + Number(n || 0).toLocaleString("zh-CN");

  /* ---------- 部门对比（原 analytics/departments，B2·M9 并入企业整体的 tab） ----------
     部门是组织结构而非法人租户：数据可比但要标注人数与项目规模差异，避免直接排名。 */
  const deptBlock = () => {
    /* R-32：部门预算与已用只从 DB.budgets（部门账本）取，D.analytics.depts 的 budget/cost 降级为投影，不再作为数据源 */
    const ledOf = (d) => {
      const b = D.budgets.filter(x => x.scope === "部门" && x.name === d.dept)[0];
      return b ? { total: b.total, used: b.used } : { total: d.budget, used: d.cost };
    };
    const rows = A.depts.map(d => {
      const led = ledOf(d);
      const rate = led.total ? Math.round(led.used / led.total * 100) : 0;
      return "<tr><td class=\"cell-strong\">" + U.esc(d.dept) + '</td><td class="num">' + d.members + '</td><td class="num">' + d.projects + '</td><td class="num">' + d.delivered + '</td><td class="num">' + d.episodes + "</td><td class=\"num\">" + money(led.used) + "</td><td class=\"cell-wide\">" + U.progress(rate, rate + "%", rate >= 85 ? "bad" : "") + "</td><td>" + d.quality + "%</td><td class=\"num\">" + d.cycle + " 天</td></tr>";
    }).join("");
    return U.card("部门数据（4 个）", U.table(["部门", "人数", "项目", "交付", "集数", "成本", "预算使用", "质量分", "平均周期"], rows), "横向对比看人均产出与单位成本，不单看总量") +
      '<div class="split mt-4"><div class="stack">' +
        U.card("人均产出对比", U.bars(A.depts.map(d => d.dept), A.depts.map(d => d.members ? Math.round(d.episodes / d.members) : 0), " 集/人"), "按人数折算") +
        U.card("单位成本对比", A.depts.map(d => U.hbar(d.dept, d.episodes ? Math.round(d.cost / d.episodes) : 0, 5000, " 元/集")).join(""), "单集成本越低不代表越好：质量与周期需一并看") +
        U.card("对比注意事项", U.listRows([["人数差异", "小部门人均波动大"], ["阶段差异", "同处生产中期才有可比性"], ["质量差异", "低质量低成本不构成优势"], ["口径", "成本按已确认计"]]) , "对比结论需标注差异") +
      '</div><div class="stack">' +
        U.card("部门预算使用率", U.bars(A.depts.map(d => d.dept), A.depts.map(d => { const l = ledOf(d); return l.total ? Math.round(l.used / l.total * 100) : 0; }), "%"), "按部门预算台账口径（同 DB.budgets）") +
        U.card("短剧二组说明", U.notice("该部门 4 个项目均处创作期，交付为 0、周期较长属阶段正常；不应据此判定绩效偏低。", "info")) +
        U.card("数据来源", U.listRows([["项目", "项目管理模块"], ["成本", "成本台账已确认"], ["质量", "质量报告 PASS 率"], ["周期", "生产启动至交付"]]) , "所有指标可回指") +
      "</div></div>";
  };

  /* ---------- 员工对比（原 analytics/employees，B2·M9 并入企业整体的 tab） ----------
     员工横向对比覆盖创建、执行、审核、交付、成本与质量六个维度，只看贡献结构，不做单一排名。 */
  const empBlock = () => {
    const rows = A.contribution.map(c => {
      const u = D.users.find(x => x.name === c.user);
      return "<tr><td>" + U.entity(c.user, u ? u.dept + " · " + u.role : "员工", c.user.slice(0, 1)) + '</td><td class="num">' + c.created + '</td><td class="num">' + c.executed + '</td><td class="num">' + c.reviewed + '</td><td class="num">' + c.delivered + '</td><td class="num">' + money(c.cost) + '</td><td class="num">' + c.quality + '%</td><td>' +
        U.miniBar(c.quality, 100) + "</td><td>" + U.btn("明细", "analytics.empDetail", "sm", { name: c.user }) + "</td></tr>";
    }).join("");
    return U.card("员工贡献对比（" + A.contribution.length + " 人）", U.table(["员工", "创建", "执行", "审核", "交付", "成本", "质量分", "质量", "操作"], rows), "成本高不等于效率低：要看交付量与质量") +
      U.card("员工个人指标（业务方案 §19.4 十二项）", U.table(["员工", "创建项目数", "有效生产项目数", "完成项目数", "完成短剧数", "完成集数", "视频生产量", "任务成功率", "作品通过率", "返工率", "平均制作周期", "AI 使用成本"], A.contribution.map(c => {
        const u = D.users.find(x => x.name === c.user);
        const uid = u ? u.id : "";
        const owned = D.projects.filter(p => p.ownerId === uid);
        const withTask = owned.filter(p => D.tasks.some(t => t.project === p.id && t.attempt > 0));
        const finished = owned.filter(p => ["已完成", "已交付", "已归档"].indexOf(p.status) >= 0);
        const eps = D.episodes.filter(e => owned.some(p => p.id === e.project) && e.qc === "PASS").length;
        const shots = D.shots.filter(s => owned.some(p => p.id === s.project) && s.status === "已通过").length;
        const tasks = D.tasks.filter(t => t.executor === c.user);
        const terminal = tasks.filter(t => ["成功", "失败", "已取消"].indexOf(t.status) >= 0);
        const okT = tasks.filter(t => t.status === "成功").length;
        const reworks = D.reworkLedger.filter(r => owned.some(p => p.id === r.project)).length;
        const passedWorks = finished.length;
        const totalWorks = owned.length;
        return "<tr><td>" + U.esc(c.user) + "</td><td class=\"num\">" + owned.length + '</td><td class="num">' + withTask.length + '</td><td class="num">' + finished.length + '</td><td class="num">' + passedWorks + '</td><td class="num">' + eps + '</td><td class="num">' + shots + " 镜</td><td class=\"num\">" + (terminal.length ? Math.round(okT / terminal.length * 100) + "%" : "待补充") + '</td><td class="num">' + (totalWorks ? Math.round(passedWorks / totalWorks * 100) + "%" : "待补充") + '</td><td class="num">' + (shots ? Math.round(reworks / shots * 100) + "%" : "待补充") + '</td><td class="num">待补充</td><td class="num">' + money(c.cost) + "</td></tr>";
      }), "暂无员工贡献数据"), "贡献按创建 / 执行 / 审核 / 交付分别统计，不以最后负责人覆盖历史贡献") +
      '<div class="split mt-4"><div class="stack">' +
        U.card("成本与交付关系", A.contribution.map(c => U.hbar(c.user, c.cost, 90000, " 元")).join(""), "成本为个人可归因部分") +
        U.card("对比维度口径", U.table(["维度", "定义", "注意"], [
          ["创建", "创建且有效归属的项目", "不计草稿与撤销"],
          ["执行", "实际提交并成功执行的任务", "失败单独统计"],
          ["审核", "作为审核人给出的结论数", "不含代审"],
          ["交付", "终审通过并交付的作品", "部分交付单独标注"]
        ].map(r => '<tr><td class="cell-strong">' + r[0] + '</td><td class="cell-wrap">' + r[1] + '</td><td class="cell-wrap muted">' + r[2] + "</td></tr>").join("")), "六维共同构成贡献结构") +
      '</div><div class="stack">' +
        U.card("交付结构", A.contribution.map(c => U.hbar(c.user, c.delivered, Math.max(1, ...A.contribution.map(x => x.delivered)), " 部")).join(""), "按终审通过并交付的作品计") +
        U.card("使用提示", U.notice("员工对比仅用于协作分工与资源配置，不用于公开排名；数据导出需审计留痕。", "warn")) +
      "</div></div>";
  };

  AppModule.register({
    group: "analytics", label: "经营分析", icon: "chart", order: 14, end: "workspace",
    routes: [
      {
        path: "analytics/enterprise", title: "企业整体数据", icon: "chart", permission: "analytics.read",
        desc: "严格区分生成过程数据、项目完成数据与有效交付数据；指标口径固定，不接受临时定义。",
        render() {
          const snapRows = A.snapshots.map(s =>
            '<tr><td>' + U.code(s.id) + "</td><td>" + U.esc(s.at) + '</td><td class="num">' + s.projects + '</td><td class="num">' + s.delivered + '</td><td class="num">' + s.episodes + "</td><td>" + s.quality + "%</td><td class=\"num\">" + money(s.cost) + '</td><td class="num">' + money(s.failed) + "</td><td>" + U.pill(s.frozen ? "已冻结" : "可写", s.frozen ? "info" : "warn") + "</td></tr>").join("");
          const metrics = A.enterprise.map(m => U.metric(m.label, m.value, m.foot, "▚")).join("");
          const tab = App.get(SCOPE, "tab", "enterprise");
          const tabsBar = U.card("", U.tabs([
            { value: "enterprise", label: "企业整体", count: A.enterprise.length },
            { value: "depts", label: "部门对比", count: A.depts.length },
            { value: "emps", label: "员工对比", count: A.contribution.length }
          ], tab, "analytics.tab"));
          return U.page("经营分析 / 企业整体", tab === "depts" ? "部门对比" : tab === "emps" ? "员工对比" : "企业整体数据", "数据按下钻口径组织：先看整体，再定位部门与员工，不做无来源的推测。",
            U.btn("导出报表", "common.export", "primary"),
            tabsBar + (tab === "depts" ? deptBlock() : tab === "emps" ? empBlock() : '<div class="grid grid-4">' + metrics + "</div>" +
            '<div class="toolbar"><input class="search" placeholder="搜索部门 / 员工 / 项目" data-filter="q"><span class="faint small" data-filter-count></span></div>' +
            U.card("交付与成本趋势", U.lineChart(A.trend.labels, [
                { name: "交付作品（部）", color: "var(--accent)", values: A.trend.delivered },
                { name: "累计成本（千元）", color: "var(--info)", values: A.trend.cost.map(v => Math.round(v / 1000)), axis: "right" }
              ], { height: 196 }) + U.listRows([["交付曲线", "9 月下旬起加速，11 月趋稳"], ["成本曲线", "与交付量同步上升，单集成本下降中"], ["双轴口径", "交付量走左轴、成本走右轴，避免量级差异压平曲线"], ["数据类别", "生成过程数据 / 项目完成数据 / 有效交付数据三类不得混用（定义见规范 §19.5）"]]) , "两条曲线单位不同，使用双轴分别标注刻度") +
            U.card("企业指标口径（业务方案 §19.3 五组 · §19.5 口径定义）", (function () {
              const scoped = DB.derived.visibleProjects();
              const ids = scoped.map(p => p.id);
              const costs = D.costs.filter(c => ids.indexOf(c.project) >= 0);
              const delivered = D.deliveries.filter(d => ids.indexOf(d.project) >= 0 && ["已交付", "已归档"].indexOf(d.status) >= 0);
              const passedEp = D.episodes.filter(e => ids.indexOf(e.project) >= 0 && e.qc === "PASS").length;
              const tasks = D.tasks.filter(t => ids.indexOf(t.project) >= 0);
              const done = tasks.filter(t => t.status === "成功").length;
              const terminal = tasks.filter(t => ["成功", "失败", "已取消"].indexOf(t.status) >= 0);
              const reworkShots = D.reworkLedger.filter(r => ids.indexOf(r.project) >= 0);
              const allShots = D.shots.filter(s => ids.indexOf(s.project) >= 0);
              const failCost = costs.reduce((s, c) => s + (c.failed || 0), 0);
              const actual = costs.reduce((s, c) => s + (c.actual || 0), 0);
              const est = costs.reduce((s, c) => s + (c.est || 0), 0);
              const budget = scoped.reduce((s, p) => s + DB.derived.budgetOfProject(p).total, 0);
              const rows = [
                ["项目", "项目总数", String(scoped.length), "可见范围内全部项目"],
                ["项目", "进行中", String(scoped.filter(p => ["草稿", "创意策划中", "剧本创作中", "待剧本审核", "生产准备中", "生产中", "后期制作中", "质量检测中", "待最终审核"].indexOf(p.status) >= 0).length), "未进入终态或归档的项目"],
                ["项目", "已完成", String(scoped.filter(p => ["已完成", "已交付", "已归档"].indexOf(p.status) >= 0).length), "终审通过及以后"],
                ["项目", "已终止", String(scoped.filter(p => p.status === "已终止").length), "终态项目"],
                ["项目", "项目完成率", scoped.length ? Math.round(scoped.filter(p => ["已完成", "已交付", "已归档"].indexOf(p.status) >= 0).length / scoped.length * 100) + "%" : "待补充", "已完成 ÷ 项目总数"],
                ["作品", "完成短剧数", String(scoped.filter(p => ["已完成", "已交付", "已归档"].indexOf(p.status) >= 0).length), "达到项目完成条件"],
                ["作品", "完成集数", String(passedEp), "终审通过并交付的集数"],
                ["作品", "交付作品数", String(delivered.length), "已确认交付的交付包"],
                ["作品", "成片总时长", delivered.length ? delivered.reduce((s, d) => s + (Number(d.episodes) || 0), 0) + " 集" : "待补充", "按交付包集数汇总"],
                ["作品", "视频生成总时长", allShots.length ? String(allShots.filter(s => s.status === "已通过").length) + " 个镜头" : "待补充", "按已通过镜头数折算，精确时长待计量回填"],
                ["质量", "剧本审核通过率", (function () { const rs = D.reviews.filter(r => ids.indexOf(r.project) >= 0 && String(r.node).indexOf("剧本") >= 0); return rs.length ? Math.round(rs.filter(r => r.result === "通过").length / rs.length * 100) + "%" : "待补充"; })(), "节点 A 通过 ÷ 剧本审核总数"],
                ["质量", "终审通过率", (function () { const rs = D.reviews.filter(r => ids.indexOf(r.project) >= 0 && String(r.node).indexOf("成片") >= 0); return rs.length ? Math.round(rs.filter(r => String(r.result).indexOf("通过") >= 0).length / rs.length * 100) + "%" : "待补充"; })(), "节点 B 通过 ÷ 终审总数"],
                ["质量", "镜头生成成功率", terminal.length ? Math.round(done / terminal.length * 100) + "%" : "待补充", "成功任务 ÷ 终态任务"],
                ["质量", "视频返工率", allShots.length ? Math.round(reworkShots.length / allShots.length * 100) + "%" : "待补充", "返工镜头 ÷ 已生产镜头"],
                ["质量", "音频异常率", "待补充", "音频检测项异常占比，需音频质检回填"],
                ["质量", "作品质量评分", "待补充", "质量分仅辅助排序，不替代合规结论"],
                ["效率", "平均项目制作周期", "待补充", "正式生产启动至正式交付，需时间戳回填"],
                ["效率", "平均单集周期", "待补充", "同上"],
                ["效率", "单位时间完成集数", "待补充", "同上"],
                ["效率", "任务成功率", terminal.length ? Math.round(done / terminal.length * 100) + "%" : "待补充", "取消任务是否计入分母已声明：计入终态"],
                ["成本", "企业 AI 总消耗", money(actual), "已确认实际成本，失败成本单列"],
                ["成本", "各项目实际成本", scoped.length ? scoped.map(p => p.id + " ¥" + Math.round(DB.derived.budgetOfProject(p).used)).join("、") : "待补充", "按项目归属分列"],
                ["成本", "单集成本", passedEp ? money(Math.round(actual / passedEp)) : "待补充", "实际成本 ÷ 已交付集数"],
                ["成本", "失败任务成本", money(failCost), "失败与重试费用同样入账"],
                ["成本", "预算使用率", budget ? Math.round(actual / budget * 100) + "%" : "待补充", "实际成本 ÷ 项目预算合计"],
                ["成本", "预计成本合计", money(est), "预计与实际分栏，不混为一项"]
              ];
              /* R-23：只留 10 项核心指标，其余定义归《交互与口径规范》§19.3–§19.5，避免单页超 12KB */
              const core = ["项目总数", "项目完成率", "完成集数", "交付作品数", "终审通过率", "镜头生成成功率", "视频返工率", "企业 AI 总消耗", "失败任务成本", "预算使用率"];
              return U.table(["指标组", "指标", "数值", "口径"], rows.filter(r => core.indexOf(r[1]) >= 0).map(r =>
                "<tr><td>" + U.esc(r[0]) + '</td><td class="cell-strong">' + U.esc(r[1]) + '</td><td class="num">' + U.esc(r[2]) + '</td><td class="cell-wrap muted">' + U.esc(r[3]) + "</td></tr>").join("")) +
                U.notice("本页只展示 10 项核心指标；项目 / 作品 / 质量 / 效率 / 成本 五组的完整定义与计算规则见《交互与口径规范》§19.3–§19.5，指标未取得可靠数据时显示「待补充」，不以估算值填充（业务方案 §19.7）。", "info");
            })(), "指标口径固定，不接受临时定义；口径与下钻页面一致") +
            U.card("定时快照（不可回溯篡改）", U.table(["快照", "时间", "项目", "交付", "集数", "质量", "成本", "失败成本", "状态"], snapRows)) +
            ")")
          );
        }
      },
      {
        path: "analytics/me", title: "我的数据", icon: "user", permission: ["analytics.own", "analytics.read"],
        desc: "个人视角只看本人可归因数据：个人承担与企业承担分列，避免把企业成本算成个人消耗。",
        render() {
          const me = App.identity();
          const month = App.get(SCOPE, "month", "2026-11");
          const u = DB.derived.actorUser(me);
          const mine = DB.derived.myProjects(me);
          if (!mine.length) {
            return U.page("经营分析 / 我的数据", "我的数据", "当前身份「" + me.name + "」没有可归因的生产数据：个人视图只统计本人负责或参与的项目。",
              U.btn("企业整体数据", "analytics.toEnterprise") + U.btn("员工对比", "analytics.toEmployees"),
              U.empty("没有可归因数据", "管理员与审计角色不参与具体生产，个人视图为空是数据范围正确的结果；如需查看企业汇总请进入「企业整体数据」。"));
          }
          const myTasks = u ? D.tasks.filter(t => (t.executor === u.name || t.resourceOwner === u.name) && mine.some(p => p.id === t.project)) : [];
          const done = myTasks.filter(t => t.status === "成功").length;
          const failed = myTasks.filter(t => t.status === "失败" || t.status === "待人工处理").length;
          const rate = myTasks.length ? Math.round(done / myTasks.length * 100) : 0;
          const mineIds = mine.map(p => p.id);
          const costs = DB.derived.visibleCosts().filter(c => mineIds.indexOf(c.project) >= 0);
          const personalCost = costs.filter(c => String(c.bearer).indexOf("个人") >= 0).reduce((s, c) => s + c.actual + c.failed, 0);
          const entCost = costs.filter(c => String(c.bearer).indexOf("个人") < 0).reduce((s, c) => s + c.actual + c.failed, 0);
          const total = personalCost + entCost;
          const share = total ? Math.round(personalCost / total * 100) : 0;
          const home = DB.derived.home(me);
          const records = myTasks.slice(0, 5);
          return U.page("经营分析 / 我的数据", "我的数据", "个人数据用于自我复盘：任务成功率、返工率与成本结构，不含他人数据。",
            U.btn("切换月份", "analytics.month") + U.btn("导出我的数据", "common.export"),
            '<div class="grid grid-4">' +
              U.metric("我的项目", String(mine.length), "负责 " + home.own + " · 参与 " + home.join, "▚") +
              U.metric("任务成功率", rate + "%", "终态 " + myTasks.length + " 个任务", "▚") +
              U.metric("个人承担成本", money(personalCost), "占可归因成本 " + share + "%", "▚") +
              U.metric("有效交付集数", String(home.deliveredEpisodes), home.deliveries + " 个交付包", "▚") +
            "</div>" +
            '<div class="split mt-4"><div class="stack">' +
              U.card("我的近期任务", records.length ? U.table(["任务", "项目 / 集", "能力", "状态", "失败成本"], records.map(t =>
                '<tr><td>' + U.code(t.id) + "</td><td>" + U.esc(t.project + " / E" + t.ep) + "</td><td>" + U.esc(t.kind) + "</td><td>" + U.pill(t.status) + '</td><td class="num">' + (t.failedCost ? money(t.failedCost) : "—") + "</td></tr>").join("")) : U.empty("暂无任务记录", "本人尚未执行任务。"), "仅显示本人执行或承担资源的任务") +
              U.card("成本结构", U.progress(share, "个人 " + money(personalCost) + " / 企业 " + money(entCost), "") +
                U.listRows([["个人承担", money(personalCost) + " · " + share + "%"], ["企业承担", money(entCost) + " · " + (100 - share) + "%"], ["失败成本", money(costs.reduce((s, c) => s + c.failed, 0)) + "（含重试）"]]) , "按承担方分列，不合并成一句总消耗") +
            '</div><div class="stack">' +
              U.card("项目完成度", mine.length ? U.bars(mine.map(p => p.id.slice(-5)), mine.map(p => DB.derived.progressOf(p).pct), "%") : U.empty("暂无项目", "无可见项目。"), "按已完成集数占比") +
              U.notice("复盘口径：失败任务需在质量报告里回指任务与镜头；统计月份只做视图标注，历史快照不可改写（§R-02 / §R-03）。", "info") +
            "</div></div>"
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("analytics.toEnterprise", () => { App.set(SCOPE, "tab", "enterprise"); App.go("analytics/enterprise"); });
  App.on("analytics.tab", (el) => { App.set(SCOPE, "tab", el.dataset.value || "enterprise"); App.refresh(); });
  App.on("analytics.toDepts", () => { App.set(SCOPE, "tab", "depts"); App.go("analytics/enterprise"); });
  App.on("analytics.toEmployees", () => { App.set(SCOPE, "tab", "emps"); App.go("analytics/enterprise"); });
  App.on("analytics.toMe", () => App.go("analytics/me"));
  App.on("analytics.month", () => App.modal({
    title: "切换统计月份", sub: "仅切换当前视图的统计口径标注，不改写历史快照",
    body: U.fSelect("月份", "m", ["2026-11", "2026-10", "2026-09"], { value: App.get(SCOPE, "month", "2026-11") }),
    submitText: "应用",
    onSubmit(d) { App.set(SCOPE, "month", d.m); App.toast("统计月份已切换为 " + d.m); App.refresh(); }
  }));
  App.on("analytics.empDetail", (el) => {
    const u = D.users.find(x => x.name === el.dataset.name);
    const c = A.contribution.find(x => x.user === el.dataset.name);
    if (!c) return;
    App.drawer("员工数据 · " + c.user, U.desc([["部门 / 角色", u ? u.dept + " / " + u.role : "—"], ["创建 / 执行 / 审核 / 交付", c.created + " / " + c.executed + " / " + c.reviewed + " / " + c.delivered], ["可归因成本", money(c.cost)], ["质量分", c.quality + "%"]]) +
      U.notice("对比数据仅用于分工与资源配置，不用于公开排名。", "info"));
  });
})();
