/* 模块：quality 质量检测与返工 */
(function () {
  const U = UI, D = DB, SCOPE = "quality";

  AppModule.register({
    group: "quality", label: "质量与返工", icon: "check", order: 8, end: "workspace",
    routes: [
      {
        path: "quality/gates", title: "质量门禁", icon: "check", permission: "quality.read",
        desc: "质量分四级（资产 / 镜头 / 单集 / 整剧）× 十维矩阵，结论只有 PASS / REVIEW_REQUIRED / FAIL 三种，门禁按级别逐层放行。",
        render(query) {
          const p = App.currentProject(query);
          if (!p || !Derived.canViewProject(p)) return U.page("质量与返工 / 质量门禁", "项目不在可见范围", "请从项目列表进入可见项目，或由负责人授权后再查看质量门禁。", U.btn("返回项目列表", "projects.listLink", "primary"), U.empty("无法读取项目", "跨项目或不存在项目不渲染检测内容。"));
          const pid = p.id;
          const wf = Derived.workflow(p);
          const reports = D.qualityReports.filter(r => String(r.object).indexOf(p.id) >= 0);
          const failing = reports.filter(r => r.fail > 0 || r.result === "未通过" || r.result === "FAIL");
          const latest = reports.slice(-1)[0];
          const cols = [{ key: "asset", label: "资产级" }, { key: "shot", label: "镜头级" }, { key: "ep", label: "单集级" }, { key: "all", label: "整剧级" }];
          return U.page("质量与返工 / 质量门禁", "质量门禁", "门禁不是「检测完就通过」：未通过阻断下游，需人工判断必须给出人工结论后才能放行。",
            U.btn("质量报告", "quality.toReports", "primary", { id: p.id }) + U.btn("返工台账", "quality.toRework", "", { id: p.id }),
            '<div class="grid grid-4">' +
              U.metric("检测级别", "4 级", "资产 / 镜头 / 单集 / 整剧", "▤") +
              U.metric("检测维度", "10 维", "剧本到成片全覆盖", "▦") +
              U.metric("当前项目结论", latest ? latest.result : "尚无报告", p.name + " · " + reports.length + " 份报告", "!") +
              U.metric("阻断报告", String(failing.length), failing.length ? failing.map(r => r.id).join("、") : "无硬性阻断", "×") +
            "</div>" +
            U.card("四级 × 十维矩阵（" + U.esc(p.name) + "）", U.matrix(D.qualityMatrix, cols), "「—」表示该维度在此级别不检测") +
            '<div class="split mt-4"><div class="stack">' +
              U.card("四级检测范围", U.table(["级别", "对象", "检测内容"], D.qualityLevels.map(l => "<tr><td class=\"cell-strong\">" + U.esc(l.level) + "</td><td>" + U.esc(l.object) + '</td><td class="cell-wrap muted">' + U.esc(l.check) + "</td></tr>")), "级别不可跳级") +
              U.card("结论与放行", U.table(["结论", "含义", "放行条件"], [
                ["PASS", "全部检测项通过", "直接放行"],
                ["REVIEW_REQUIRED", "存在需人工判断项", "人工结论记录理由后放行"],
                ["FAIL", "存在硬性不通过项", "阻断，必须返工"]
              ].map(r => "<tr><td>" + U.pill(r[0]) + '</td><td class="cell-wrap">' + r[1] + '</td><td class="cell-wrap muted">' + r[2] + "</td></tr>").join("")), "人工结论必须留理由") +
            '</div><div class="stack">' +
              U.card("门禁链路", U.chain([
                { label: "资产", meta: wf.pendingAssets.length ? wf.pendingAssets.length + " 待确认" : "已确认", state: wf.pendingAssets.length ? "wait" : "done" },
                { label: "镜头", meta: wf.passedShots.length + " / " + wf.shots.length + " 通过", state: wf.shots.length && wf.passedShots.length === wf.shots.length ? "done" : "now" },
                { label: "单集", meta: wf.passEps.length + " / " + wf.total + " 集 PASS", state: wf.total && wf.passEps.length === wf.total ? "done" : (wf.passEps.length ? "now" : "wait") },
                { label: "整剧", meta: wf.gateDelivery.ok ? "可交付" : "未满足", state: wf.gateDelivery.ok ? "done" : "wait" }
              ]), "上一级 FAIL 时不进入下一级") +
              U.card("系统自动进出状态", U.notice("「质量检测中」与「待最终审核」由系统自动进入和退出，人工不得直接设置；人工节点只有剧本审核（A）与成片审核（B）。", "info")) +
              U.card("当前阻断项", failing.length
                ? U.notice(failing.map(r => r.id + "（" + r.object + "）" + r.result).join("；"), "bad") + U.listRows([["阻断对象", failing[0].object], ["报告", failing[0].id], ["不通过项", String(failing[0].fail)], ["处置", "按报告定位返工并重跑该级检测"]])
                : U.notice("当前项目没有硬性阻断报告。", "ok") , "阻断期间不得交付") +
            "</div></div>"
          );
        }
      },
      {
        path: "quality/reports", title: "质量报告", icon: "doc", permission: "quality.read",
        desc: "报告可追溯到检测项、检测能力与结论；报告是交付包中的必需内容，不允许手写替代。",
        render(query) {
          const p = App.currentProject(query);
          if (!p || !Derived.canViewProject(p)) return U.page("质量与返工 / 质量报告", "项目不在可见范围", "请从项目列表进入可见项目，或由负责人授权后再查看检测报告。", U.btn("返回项目列表", "projects.listLink", "primary"), U.empty("无法读取项目", "跨项目或不存在项目不渲染检测报告。"));
          const pid = p.id;
          const reports = D.qualityReports.filter(r => String(r.object).indexOf(pid) >= 0);
          const reportIds = new Set(reports.map(r => r.id));
          const issues = D.qualityIssues.filter(i => reportIds.has(i.report));
          const tab = App.get(SCOPE, "tab", "reports");
          const rows = reports.map(r =>
            '<tr><td>' + U.code(r.id) + "</td><td>" + U.esc(r.object) + "</td><td>" + U.esc(r.level) + "</td><td>" + U.esc(r.version) + "</td><td>" + U.pill(r.result) + '</td><td class="num">' + r.items + '</td><td class="num">' + r.issues + '</td><td class="num">' + r.review + '</td><td class="num">' + r.fail + '</td><td class="cell-wrap muted">' + U.esc(r.at) + "</td><td>" +
            U.btn("报告详情", "quality.reportDetail", "sm", { id: r.id }) + "</td></tr>").join("");
          const issueRows = issues.map(i =>
            '<tr><td>' + U.code(i.report) + "</td><td>" + U.esc(i.dim) + '</td><td class="cell-wrap">' + U.esc(i.where) + "</td><td>" + U.pill(i.level) + '</td><td class="cell-wrap">' + U.esc(i.action) + "</td><td>" + (i.auto === "是" ? U.pill("自动处理", "info") : U.pill("需人工", "outline")) + "</td></tr>").join("");
          const body = tab === "reports"
            ? U.table(["报告", "对象", "级别", "版本", "结论", "检测项", "问题", "待审", "不通过", "时间", "操作"], rows, "当前范围暂无质量报告")
            : U.table(["报告", "维度", "定位", "严重度", "处理动作", "处理方式"], issueRows, "当前范围暂无问题项");
          const passN = reports.filter(r => r.result === "通过" || r.result === "PASS").length;
          const reviewN = reports.filter(r => r.result === "需人工判断" || r.result === "REVIEW_REQUIRED").length;
          const failN = reports.filter(r => r.result === "未通过" || r.result === "FAIL").length;
          const latestFail = reports.filter(r => r.fail > 0 || r.result === "未通过" || r.result === "FAIL")[0];
          return U.page("质量与返工 / 质量报告", "质量报告", "检测项、检测能力、定位与处理动作必须写清；结论不接受「整体感觉良好」。",
            U.btn("质量门禁", "quality.toGates", "", p ? { id: p.id } : {}) + U.btn("返工台账", "quality.toRework", "", p ? { id: p.id } : {}),
            U.card("", U.tabs([{ value: "reports", label: "报告", count: reports.length }, { value: "issues", label: "问题项", count: issues.length }], tab, "quality.tab") + body, p ? U.esc(p.name) + " · 按对象与级别检索" : "全库范围 · 按对象与级别检索") +
            '<div class="split mt-4"><div class="stack">' +
              U.card(latestFail ? latestFail.id + " · FAIL" : "当前范围无 FAIL 报告", latestFail
                ? U.desc([["对象", latestFail.object], ["级别", latestFail.level], ["结论", latestFail.result], ["检测项", latestFail.items + "（不通过 " + latestFail.fail + " / 待审 " + latestFail.review + "）"], ["检测能力", "质检模型 + 视觉模型"], ["阻断", "是 · 下游全部暂停"]]) +
                  U.notice("硬性不通过不可人工接受：必须定位到具体项并重做，再重新走该级检测。", "bad")
                : U.notice("当前项目没有 FAIL 报告；仍需按报告结论逐项复核。", "ok"), "阻断项不接受「人工确认继续」") +
              U.card("报告可信口径", U.listRows([["检测项", "逐项列出结论，不汇总成一句"], ["定位", "集 / 场 / 镜头 / 时间码"], ["能力标注", "写明使用的检测能力"], ["人工结论", "必须记录理由与操作者"]]) , "报告进入交付包") +
            '</div><div class="stack">' +
              U.card("检测结果分布", U.donut([
                { label: "PASS", value: passN, color: "var(--ok)" },
                { label: "REVIEW_REQUIRED", value: reviewN, color: "var(--warn)" },
                { label: "FAIL", value: failN, color: "var(--bad)" }
              ], "报告", String(reports.length)), p ? U.esc(p.name) + " · 当前报告" : "全库报告") +
              U.card("报告趋势", U.bars(reports.slice(-6).map(r => r.version), reports.slice(-6).map(r => {
                const denom = Number(r.items) || 1;
                return Math.max(0, Math.round((denom - Number(r.fail || 0) - Number(r.review || 0)) / denom * 100));
              }), "%"), "以单份报告直接通过项占比计量") +
              U.card("报告有效期", U.notice("报告仅对当次对象与版本有效；重新生成或替换版本后必须重跑检测，旧报告自动失效。", "warn")) +
            "</div></div>"
          );
        }
      },
      {
        path: "quality/rework", title: "返工与返工台账", icon: "rotate", permission: "quality.operate",
        desc: "返工按最小单元执行：能只重做一个镜头就不整场重跑；旧版本一律保留，成本单独入账。",
        render(query) {
          const p = App.currentProject(query);
          if (!p || !Derived.canViewProject(p)) return U.page("质量与返工 / 返工台账", "项目不在可见范围", "请从项目列表进入可见项目，或由负责人授权后再查看返工台账。", U.btn("返回项目列表", "projects.listLink", "primary"), U.empty("无法读取项目", "跨项目或不存在项目不渲染返工记录。"));
          const pid = p.id;
          const ledger = D.reworkLedger.filter(r => r.project === pid);
          const rows = ledger.map(r =>
            '<tr><td>' + U.code(r.id) + "</td><td>" + U.esc(r.project) + "</td><td>" + U.code(r.target) + "</td><td>" + U.esc(r.type) + '</td><td class="num">第 ' + r.round + ' 轮</td><td class="num">¥' + r.cost.toFixed(1) + "</td><td>" + U.esc(r.old) + "</td><td>" + U.esc(r.at) + "</td><td>" + U.pill(r.status) + "</td><td>" +
            U.btn("详情", "quality.reworkDetail", "sm", { id: r.id }) + " " + U.btn("重跑", "quality.rerun", "sm", { id: r.id }) + "</td></tr>").join("");
          const totalCost = ledger.reduce((n, r) => n + Number(r.cost || 0), 0);
          const avgRound = ledger.length ? (ledger.reduce((n, r) => n + Number(r.round || 0), 0) / ledger.length).toFixed(1) : "0";
          const manual = ledger.filter(r => String(r.status).indexOf("人工") >= 0 || String(r.type).indexOf("合规") >= 0).length;
          const focus = ledger.filter(r => Number(r.round) >= 3)[0] || ledger.slice(-1)[0];
          const canRework = !p || ["已交付", "已归档"].indexOf(p.status) < 0;
          const byType = {};
          ledger.forEach(r => { byType[r.type] = (byType[r.type] || 0) + Number(r.cost || 0); });
          return U.page("质量与返工 / 返工台账", "返工与返工台账", "返工不改历史：旧版本保留可对比，成本按轮次单独记录，失败成本不摊入成功项。",
            (canRework ? U.btn("发起返工", "quality.newRework", "primary", { id: p ? p.id : "" }) : "") + U.btn("质量报告", "quality.toReports", "", { id: p ? p.id : "" }),
            '<div class="grid grid-4">' +
              U.metric("返工记录", String(ledger.length), p ? p.name : "全库范围", "▤") +
              U.metric("返工成本", "¥" + totalCost.toFixed(1), "含失败重试", "¥") +
              U.metric("平均轮次", avgRound + " 轮", "单镜头上限 3 轮", "↻") +
              U.metric("转人工", String(manual) + " 条", "合规类不可自动", "!") +
            "</div>" +
            U.card("返工台账", U.table(["记录", "项目", "对象", "类型", "轮次", "成本", "旧版本", "时间", "状态", "操作"], rows, "当前范围暂无返工记录")) +
            '<div class="split mt-4"><div class="stack">' +
              U.card("返工规则", U.listRows([["最小单元", "镜头 / 对白 / 字幕，不整集重跑"], ["旧版本", "保留，不覆盖"], ["成本", "按轮次入账，失败也入账"], ["轮次上限", "3 轮后必须人工决策"], ["合规类", "不允许自动重试"]]), "超上限需负责人决策") +
              U.card("自动 vs 人工", U.table(["类型", "处理方式", "原因"], [
                ["口型 / 音量", "自动", "规则明确、可复现"],
                ["人物一致性", "自动重生成 + 人工确认", "需判断是否可接受"],
                ["合规", "人工", "不可自动接受风险"],
                ["剪辑节奏", "人工", "属创作决策"]
              ].map(r => "<tr><td>" + r[0] + "</td><td>" + U.pill(r[1], r[1] === "自动" ? "info" : "outline") + '</td><td class="cell-wrap muted">' + r[2] + "</td></tr>").join("")), "自动处理需留痕") +
            '</div><div class="stack">' +
              (focus ? U.card(focus.id + " · 第 " + focus.round + " 轮", (Number(focus.round) >= 3 ? U.notice("同一对象已返工 " + focus.round + " 轮，已转人工决策：需确认是替换素材还是调整设计。", "warn") : U.notice("当前记录仍在自动重试范围内。", "info")) +
                U.desc([["对象", focus.target], ["类型", focus.type], ["累计成本", "¥" + Number(focus.cost).toFixed(1)], ["旧版本", focus.old], ["下一步", focus.status]]) , "达 3 轮触发人工") : U.card("当前范围暂无返工", U.notice("没有返工记录。", "ok"), "只显示真实台账")) +
              U.card("返工成本分布", ledger.length ? U.bars(Object.keys(byType), Object.keys(byType).map(k => byType[k]), " 元") : U.notice("暂无可统计的返工成本。", "info"), "按类型累计") +
            "</div></div>"
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("quality.toReports", (el) => {
    const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id;
    App.go("quality/reports", pid ? { id: pid } : undefined);
  });
  App.on("quality.toGates", (el) => {
    const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id;
    App.go("quality/gates", pid ? { id: pid } : undefined);
  });
  App.on("quality.toRework", (el) => {
    const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id;
    App.go("quality/rework", pid ? { id: pid } : undefined);
  });
  App.on("quality.tab", (el) => { App.set(SCOPE, "tab", el.dataset.value); App.refresh(); });
  App.on("quality.reworkDetail", (el) => {
    const r = D.reworkLedger.find(x => x.id === el.dataset.id);
    if (!r) return;
    App.drawer("返工记录 · " + r.id, U.desc([["对象", r.target], ["类型", r.type], ["轮次", "第 " + r.round + " 轮"], ["成本", "¥" + r.cost.toFixed(1)], ["旧版本", r.old], ["时间", r.at], ["状态", r.status]]) + U.notice("旧版本保留，可对比后采用；成本单独入账，不摊入成功项。", "info"));
  });
})();

/* ===== v9.1 真实流程层：检测项裁决 → 返工重跑 ===== */
(function () {
  const U = UI, D = DB;

  App.on("quality.reportDetail", (el) => {
    const r = D.qualityReports.find(x => x.id === el.dataset.id);
    if (!r) return;
    const issues = D.qualityIssues.filter(i => i.report === r.id);
    const rows = issues.map((i, idx) => {
      const tag = i.decision ? "已裁决：" + i.decision : "待裁决";
      return '<div class="list-row"><div class="v"><b>' + U.esc(i.dim) + '</b> · ' + U.esc(i.where) + '<br><small>' + U.esc(i.level) + ' 级 · ' + U.esc(i.action) + ' · ' + U.esc(tag) + (i.note ? " · " + U.esc(i.note) : "") + "</small></div>" +
        (i.decision ? '<span class="tag">' + U.esc(i.decision) + "</span>" : '<span class="btn-row-inline">' + U.btn("接受", "quality.judge", "sm", { report: r.id, idx: idx, decide: "accept" }) + U.btn("返工", "quality.judge", "sm", { report: r.id, idx: idx, decide: "rework" }) + U.btn("驳回", "quality.judge", "sm", { report: r.id, idx: idx, decide: "reject" }) + "</span>") + "</div>";
    }).join("");
    App.drawer("质量报告 · " + r.id,
      U.desc([["对象", r.object], ["层级", r.level], ["版本", r.version], ["结论", r.result], ["检测项 / 问题 / 待复核 / 失败", r.items + " / " + r.issues + " / " + (r.review || 0) + " / " + (r.fail || 0)], ["引擎", r.engine], ["时间", r.at]]) +
      U.notice(r.note || "—", r.result === "PASS" ? "ok" : "warn") +
      (rows ? '<div class="block-list">' + rows + "</div>" : U.empty("该报告没有检测项问题")));
  });

  App.on("quality.judge", (el) => {
    if (!App.guard("quality.operate")) return;
    const { report, idx, decide } = el.dataset;
    const issues = D.qualityIssues.filter(i => i.report === report);
    const issue = issues[Number(idx)];
    if (!issue) return;
    const labels = { accept: "接受现状", rework: "建立返工", reject: "驳回并阻断" };
    App.closeDrawer();
    App.modal({
      title: labels[decide] + " · " + issue.dim, sub: issue.where + " · " + issue.level + " 级",
      body: (decide === "accept" ? U.fTextarea("接受理由", "note", { required: true, minlen: 8, rows: 3, placeholder: "说明为什么可接受，不得只写「可以」" }) : "") +
        (decide === "rework" ? U.fTextarea("返工要求", "note", { required: true, minlen: 8, rows: 3 }) + U.fSelect("处理方式", "way", ["仅重做该单元", "重做并人工确认", "转人工决策"], { required: true }) : "") +
        (decide === "reject" ? U.notice("驳回将阻断下游使用，需重新生成后再次送检。", "warn") : ""),
      submitText: labels[decide],
      onSubmit(d) {
        return App.job({
          title: labels[decide], steps: ["校验裁决依据", "写入报告", "联动返工台账"],
          run() {
            const r = Store.ops.judgeIssue(report, Number(idx), decide, d.note || "");
            if (!r.ok) return r;
            Store.log("质量报告 " + report, labels[decide] + "：" + issue.dim + " · " + issue.where, "成功", report);
            return { ok: true, msg: r.msg };
          }
        });
      }
    });
  });

  App.on("quality.rerun", (el) => {
    if (!App.guard("quality.operate")) return;
    const r = D.reworkLedger.find(x => x.id === el.dataset.id);
    if (!r) return;
    if (r.type === "合规风险") { App.toast("合规类返工不允许自动重跑，需人工决策", "bad"); return; }
    if (r.status === "已修复") { App.toast("该返工已修复，无需重跑", "bad"); return; }
    App.modal({
      title: "重跑返工 · " + r.id, sub: "按规则重建一版并保留旧版本；预计 ¥" + r.cost.toFixed(1),
      body: U.fTextarea("重跑依据", "note", { required: true, minlen: 8, rows: 3, placeholder: "说明本轮调整点，避免无效重跑" }) +
        U.fSelect("重跑策略", "policy", ["沿用当前模型与参数", "调整提示词后重跑", "换参考资产后重跑"], { required: true }),
      submitText: "提交重跑",
      onSubmit(d) {
        return App.job({
          title: "重跑返工", steps: ["校验对象状态", "创建尝试记录", "写入返工台账与费用"],
          run() {
            r.round += 1; r.status = "进行中";
            Store.spend(r.project, r.cost, { cap: "返工重跑", task: r.target, note: d.policy });
            Store.log("返工 " + r.id, "第 " + r.round + " 轮重跑：" + d.note, "成功", r.id);
            return { ok: true, msg: "已提交第 " + r.round + " 轮重跑（" + d.policy + "），扣费 ¥" + Store.money(r.cost) };
          }
        });
      }
    });
  });

  App.on("quality.newRework", (el) => {
    if (!App.guard("quality.operate")) return;
    const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id || ((App.currentProject() || {}).id || "");
    App.modal({
      title: "发起返工 · " + pid, sub: "定位到当前项目的最小单元，并关联真实检测报告",
      body: U.fField("对象", "target", { required: true, placeholder: "例如 SH-" + pid.replace("SP-", "") + "-E17-05", pattern: "^(SH|DL|AU|SC|TL|EP)-[A-Z0-9-]+$" }) +
        U.fSelect("类型", "type", ["人物不一致", "画面异常", "音频问题", "字幕问题", "合规风险"], { required: true }) +
        U.fField("依据报告", "report", { required: true, placeholder: "例如 QR-" + pid.replace("SP-", "") + "-E17-03" }) +
        U.fSelect("处理方式", "way", ["仅重做该单元", "重做并人工确认", "转人工决策"], { required: true }) +
        U.fTextarea("说明", "note", { required: true, minlen: 8, rows: 3 }),
      submitText: "提交返工",
      onSubmit(d) {
        return App.job({
          title: "建立返工单", steps: ["校验对象与依据", "写入返工台账", "标记受影响镜头"],
          run() {
            const rep = D.qualityReports.find(x => x.id === d.report);
            if (!rep) return { ok: false, msg: "依据报告不存在：" + d.report, fields: { report: "报告不存在" } };
            const repPid = String(rep.object).split(" / ")[0];
            if (repPid !== pid) return { ok: false, msg: "报告 " + d.report + " 属于 " + repPid + "，不能用于 " + pid + " 的返工", fields: { report: "项目不匹配" } };
            const obj = D.shots.find(s => s.id === d.target && s.project === pid) || D.dialogues.find(x => x.id === d.target && x.project === pid) || D.audioAssets.find(x => x.id === d.target && x.project === pid);
            if (!obj) return { ok: false, msg: "返工对象不存在或不属于当前项目：" + d.target, fields: { target: "对象不存在" } };
            if (d.type === "合规风险" && d.way === "仅重做该单元") return { ok: false, msg: "合规类返工不接受纯自动处理，请选择人工确认或转人工", fields: { way: "合规项需人工" } };
            D.reworkLedger.unshift({ id: "RW-" + String(D.reworkLedger.length + 1).padStart(3, "0") + "-" + Math.floor(Math.random() * 90 + 10), project: pid, target: d.target, type: d.type, round: 1, cost: 0, old: "旧版本保留", status: d.way === "转人工决策" ? "转人工" : "进行中", at: Store.at() });
            const s = D.shots.find(x => x.id === d.target);
            if (s) { s.status = "需返工"; }
            Store.log("返工 " + d.target, d.type + " · " + d.way + " · " + d.note, "成功", d.target);
            return { ok: true, msg: "返工单已建立（" + d.type + " / " + d.way + "），对象已标记需返工" };
          }
        });
      }
    });
  });
})();

