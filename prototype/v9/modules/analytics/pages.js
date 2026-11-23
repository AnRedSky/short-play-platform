/* 模块：analytics 经营分析 */
(function () {
  const U = UI, D = DB, SCOPE = "analytics";
  const A = D.analytics;
  const money = (n) => "¥" + Number(n || 0).toLocaleString("zh-CN");

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
          return U.page("经营分析 / 企业整体", "企业整体数据", "数据按下钻口径组织：先看整体，再定位部门与员工，不做无来源的推测。",
            U.btn("部门对比", "analytics.toDepts") + U.btn("导出报表", "common.export", "primary"),
            '<div class="grid grid-4">' + metrics + "</div>" +
            '<div class="grid grid-2 mt-4">' +
              U.card("交付与成本趋势", U.lineChart(A.trend.labels, [
                { name: "交付作品（部）", color: "var(--accent)", values: A.trend.delivered },
                { name: "累计成本（千元）", color: "var(--info)", values: A.trend.cost.map(v => Math.round(v / 1000)) }
              ], { height: 196 }) + U.listRows([["交付曲线", "9 月下旬起加速，11 月趋稳"], ["成本曲线", "与交付量同步上升，单集成本下降中"]]) , "两条曲线单位不同，仅作趋势对照") +
              U.card("数据口径", U.table(["数据类别", "含义", "用途"], [
                ["生成过程数据", "调用量、成功率、返工率", "生产管理"],
                ["项目完成数据", "完成集数、周期", "项目考核"],
                ["有效交付数据", "终审通过并交付", "经营结算"]
              ].map(r => '<tr><td class="cell-strong">' + r[0] + '</td><td class="cell-wrap">' + r[1] + '</td><td class="cell-wrap muted">' + r[2] + "</td></tr>").join("")), "三类数据不得混用") +
            "</div>" +
            U.card("定时快照（不可回溯篡改）", U.table(["快照", "时间", "项目", "交付", "集数", "质量", "成本", "失败成本", "状态"], snapRows)) +
            '<div class="grid grid-3 mt-4">' +
              U.card("企业预算", U.progress(40.5, "年度 ¥1,200,000 · 已用 ¥486,300", "") + U.listRows([["预留", "¥96,000"], ["待核实", "¥24,120"], ["失败成本", "¥38,640"]]) , "预算使用率按已确认成本计算") +
              U.card("质量与返工", U.listRows([["镜头成功率", "91.2%"], ["返工率", "8.4%"], ["终审通过率", "87.5%"], ["平均周期", "18.4 天"]]) , "分母口径见指标说明") +
              U.card("对比入口", U.listRows([["部门对比", "4 个部门横向比较"], ["员工对比", "任务 / 交付 / 成本 / 质量"], ["个人视图", "本人数据与明细"]]) + '<div class="btn-row-inline">' + U.btn("部门对比", "analytics.toDepts", "sm") + U.btn("员工对比", "analytics.toEmployees", "sm") + "</div>", "下钻不丢失口径") +
            "</div>"
          );
        }
      },
      {
        path: "analytics/departments", title: "部门对比", icon: "chart", permission: "analytics.read",
        desc: "部门是组织结构而非法人租户：数据可比但要标注人数与项目规模差异，避免直接排名。",
        render() {
          const rows = A.depts.map(d => {
            const rate = Math.round(d.cost / d.budget * 100);
            return "<tr><td class=\"cell-strong\">" + U.esc(d.dept) + '</td><td class="num">' + d.members + '</td><td class="num">' + d.projects + '</td><td class="num">' + d.delivered + '</td><td class="num">' + d.episodes + "</td><td class=\"num\">" + money(d.cost) + "</td><td class=\"cell-wide\">" + U.progress(rate, rate + "%", rate >= 85 ? "bad" : "") + "</td><td>" + d.quality + "%</td><td class=\"num\">" + d.cycle + " 天</td></tr>";
          }).join("");
          return U.page("经营分析 / 部门对比", "部门对比", "横向对比看人均产出与单位成本，不单看总量。",
            U.btn("企业整体", "analytics.toEnterprise") + U.btn("员工对比", "analytics.toEmployees", "primary"),
            U.card("部门数据（4 个）", U.table(["部门", "人数", "项目", "交付", "集数", "成本", "预算使用", "质量分", "平均周期"], rows)) +
            '<div class="split mt-4"><div class="stack">' +
              U.card("人均产出对比", U.bars(A.depts.map(d => d.dept), A.depts.map(d => d.members ? Math.round(d.episodes / d.members) : 0), " 集/人"), "按人数折算") +
              U.card("单位成本对比", A.depts.map(d => U.hbar(d.dept, d.episodes ? Math.round(d.cost / d.episodes) : 0, 5000, " 元/集")).join(""), "单集成本越低不代表越好：质量与周期需一并看") +
              U.card("对比注意事项", U.listRows([["人数差异", "小部门人均波动大"], ["阶段差异", "同处生产中期才有可比性"], ["质量差异", "低质量低成本不构成优势"], ["口径", "成本按已确认计"]]) , "对比结论需标注差异") +
            '</div><div class="stack">' +
              U.card("部门预算使用率", U.bars(A.depts.map(d => d.dept), A.depts.map(d => Math.round(d.cost / d.budget * 100)), "%"), "按部门预算台账口径"),
              U.card("短剧二组说明", U.notice("该部门 4 个项目均处创作期，交付为 0、周期较长属阶段正常；不应据此判定绩效偏低。", "info")) +
              U.card("数据来源", U.listRows([["项目", "项目管理模块"], ["成本", "成本台账已确认"], ["质量", "质量报告 PASS 率"], ["周期", "生产启动至交付"]]) , "所有指标可回指") +
            "</div></div>"
          );
        }
      },
      {
        path: "analytics/employees", title: "员工对比", icon: "users", permission: "analytics.read",
        desc: "员工横向对比覆盖创建、执行、审核、交付、成本与质量六个维度，只看贡献结构，不做单一排名。",
        render() {
          const rows = A.contribution.map(c => {
            const u = D.users.find(x => x.name === c.user);
            return "<tr><td>" + U.entity(c.user, u ? u.dept + " · " + u.role : "员工", c.user.slice(0, 1)) + '</td><td class="num">' + c.created + '</td><td class="num">' + c.executed + '</td><td class="num">' + c.reviewed + '</td><td class="num">' + c.delivered + '</td><td class="num">' + money(c.cost) + '</td><td class="num">' + c.quality + '%</td><td>' +
              U.miniBar(c.quality, 100) + "</td><td>" + U.btn("明细", "analytics.empDetail", "sm", { name: c.user }) + "</td></tr>";
          }).join("");
          return U.page("经营分析 / 员工对比", "员工对比", "成本高不等于效率低：要看交付量与质量；反之亦然。",
            U.btn("部门对比", "analytics.toDepts") + U.btn("个人视图", "analytics.toMe", "primary"),
            U.card("员工贡献对比（" + A.contribution.length + " 人）", U.table(["员工", "创建", "执行", "审核", "交付", "成本", "质量分", "质量", "操作"], rows)) +
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
            "</div>"
          );
        }
      },
      {
        path: "analytics/me", title: "我的数据", icon: "user", permission: ["analytics.own", "analytics.read"],
        desc: "个人视角只看本人可归因数据：个人承担与企业承担分列，避免把企业成本算成个人消耗。",
        render() {
          const me = App.identity();
          const month = App.get(SCOPE, "month", "2026-11");
          const u = Derived.actorUser(me);
          const mine = Derived.myProjects(me);
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
          const costs = Derived.visibleCosts().filter(c => mineIds.indexOf(c.project) >= 0);
          const personalCost = costs.filter(c => String(c.bearer).indexOf("个人") >= 0).reduce((s, c) => s + c.actual + c.failed, 0);
          const entCost = costs.filter(c => String(c.bearer).indexOf("个人") < 0).reduce((s, c) => s + c.actual + c.failed, 0);
          const total = personalCost + entCost;
          const share = total ? Math.round(personalCost / total * 100) : 0;
          const home = Derived.home(me);
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
              U.card("项目完成度", mine.length ? U.bars(mine.map(p => p.id.slice(-5)), mine.map(p => Math.round(p.done / p.episodes * 100)), "%") : U.empty("暂无项目", "无可见项目。"), "按已完成集数占比") +
              U.card("复盘提示", U.notice("失败任务 " + failed + " 个；失败集中项需在质量报告里回指任务与镜头，便于定位原因。", failed ? "warn" : "ok")) +
              U.card("口径说明", U.listRows([["统计月份", month + "（仅切换视图标注，历史快照不可改写）"], ["任务成功率", "终态任务为分母，取消不计入"], ["返工率", "返工镜头 / 已生产镜头"], ["成本", "仅可归因到本人或本人承担的部分"]]) , "与企业口径保持一致") +
            "</div></div>"
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("analytics.toEnterprise", () => App.go("analytics/enterprise"));
  App.on("analytics.toDepts", () => App.go("analytics/departments"));
  App.on("analytics.toEmployees", () => App.go("analytics/employees"));
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
