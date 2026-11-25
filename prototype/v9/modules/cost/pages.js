/* 模块：cost 成本、预算与用量 */
(function () {
  const U = UI, D = DB, SCOPE = "cost";
  const money = (n) => "¥" + Number(n || 0).toLocaleString("zh-CN");

  /* ---------- 用量（原 cost/usage，B2·M6 并入成本台账的「用量」tab） ----------
     用量以调用记录为准：供应商用量与平台用量并列，差异必须解释，不允许只保留平台估算。 */
  const usageBlock = (pid) => {
    const p = pid ? (D.projects.find(x => x.id === pid) || null) : null;
    const visPids = DB.derived.visibleProjects().map(x => x.id);
    const usage = pid ? D.usage.filter(u => u.project === pid) : D.usage.filter(u => visPids.indexOf(u.project) >= 0);
    const rows = usage.map(x =>
      '<tr><td>' + U.code(x.id) + "</td><td>" + U.esc(x.project) + "</td><td>" + U.code(x.task) + "</td><td>" + U.esc(x.cap) + "</td><td>" + U.esc(x.unit) + '</td><td class="cell-wrap">' + U.esc(x.vendorQty) + '</td><td class="cell-wrap">' + U.esc(x.platformQty) + "</td><td>" + U.esc(x.src) + "</td><td>" + U.pill(x.status) + "</td><td>" + U.esc(x.at) + "</td></tr>").join("");
    const diff = usage.find(x => String(x.vendorQty).replace(/\s/g, "") !== String(x.platformQty).replace(/\s/g, "")) || null;
    const caps = {};
    usage.forEach(u => { caps[u.cap] = (caps[u.cap] || 0) + 1; });
    return U.card("用量明细" + (p ? " · " + U.esc(p.name) : ""), U.table(["用量号", "项目", "任务", "能力", "单位", "供应商用量", "平台用量", "来源", "状态", "时间"], rows, "当前范围暂无用量记录")) +
      '<div class="split mt-4"><div class="stack">' +
        (diff ? U.card("计量差异 · " + diff.id, U.notice("供应商用量 " + diff.vendorQty + "，平台有效产出 " + diff.platformQty + "；差异必须保留说明，不允许抹平。", "warn") +
          U.desc([["供应商用量", diff.vendorQty], ["平台有效", diff.platformQty], ["来源", diff.src], ["说明", "失败重试照常计费"]]) , "差异不允许抹平")
          : U.card("计量差异", U.notice(usage.length ? "当前范围供应商用量与平台有效产出一致，没有计量差异。" : "当前范围没有用量记录。", "ok"), "只显示真实差异")) +
        U.card("常见差异原因", U.listRows([["失败重试", "多次调用只产出一次"], ["超时截断", "调用完成但输出不可用"], ["降级输出", "分辨率降级导致重复生成"], ["上游截断", "长文本分批调用"]]) , "差异需在报告说明") +
      '</div><div class="stack">' +
        U.card("按能力用量", Object.keys(caps).length ? U.donut(Object.keys(caps).map((k, i) => ({ label: k, value: caps[k], color: ["var(--accent)", "var(--ok)", "var(--info)", "var(--warn)"][i % 4] })), "记录", String(usage.length)) : U.empty("暂无用量", "当前范围没有用量记录。"), "单位混合，仅示意记录数占比") +
        U.card("计费口径", U.listRows([["视频生成", "按秒 · 含失败"], ["语音合成", "按字符 / 秒"], ["视觉理解", "按帧"], ["推理", "按千 tokens"], ["转码", "按分钟"]]) , "口径与企业合同一致") +
      "</div></div>";
  };

  AppModule.register({
    group: "cost", label: "成本与预算", icon: "coin", order: 12, end: "workspace",
    routes: [
      {
        path: "cost/ledger", title: "成本台账", icon: "coin", permission: "cost.read",
        desc: "预计与实际分列、失败与重试必入账；每笔成本都能回指任务、镜头与账单。",
        render(query) {
          const all = DB.derived.visibleCosts();
          const projIds = ["全部"];
          all.forEach(c => { if (projIds.indexOf(c.project) < 0) projIds.push(c.project); });
          const requested = (query && query.id) || "";
          if (requested) {
            const rp = D.projects.find(x => x.id === requested);
            if (!rp || !DB.derived.canViewProject(rp)) return U.page("成本与预算 / 成本台账", "项目成本不在可见范围", "只能查看自己负责、参与或经授权项目的成本；跨项目成本不渲染。", U.btn("返回项目列表", "common.projects", "primary"), U.empty("无法读取成本台账", "项目不存在或当前身份不可见。"));
          }
          const saved = App.get(SCOPE, "proj", "全部");
          const proj = requested || (projIds.indexOf(saved) >= 0 ? saved : "全部");
          const list = all.filter(c => proj === "全部" || c.project === proj);
          const rows = list.map(c =>
            '<tr><td>' + U.code(c.id) + "</td><td>" + U.esc(c.project) + " · E" + c.ep + " · " + U.esc(c.shot) + "</td><td>" + U.esc(c.cap) + '</td><td class="num">¥' + c.est.toFixed(1) + '</td><td class="num">¥' + c.actual.toFixed(1) + '</td><td class="num">' + (c.failed ? '<span class="text-bad">¥' + c.failed.toFixed(1) + "</span>" : "—") + "</td><td>" + U.esc(c.bearer + " · " + c.source) + "</td><td>" + U.pill(c.status) + "</td><td>" +
            (App.can("cost.manage") ? U.btn("核验", "cost.verify", "sm", { id: c.id }) + " " + U.btn("费用调整", "cost.adjust", "sm", { id: c.id }) : U.btn("核验", "cost.verify", "sm", { id: c.id })) + "</td></tr>").join("");
          const toolbar = '<div class="toolbar"><span class="faint small">可见范围：' + U.esc(DB.derived.scopeLabel()) + " · " + (projIds.length - 1) + " 个项目</span><span class=\"grow\"></span>" + U.seg(projIds, proj, "cost.proj") + U.btn("导出明细", "common.export") + "</div>";
          const est = list.reduce((s, c) => s + c.est, 0);
          const act = list.reduce((s, c) => s + c.actual, 0);
          const fail = list.reduce((s, c) => s + c.failed, 0);
          const personal = list.filter(c => String(c.bearer).indexOf("个人") >= 0).length;
          const failedOne = list.filter(c => c.failed > 0)[0] || null;
          const tab = App.get(SCOPE, "tab", "ledger");
          const useCnt = (proj === "全部" ? D.usage.filter(u => DB.derived.visibleProjects().map(x => x.id).indexOf(u.project) >= 0) : D.usage.filter(u => u.project === proj)).length;
          const tabsBar = U.card("", U.tabs([
            { value: "ledger", label: "台账明细", count: list.length },
            { value: "usage", label: "用量", count: useCnt }
          ], tab, "cost.tab"));
          return U.page("成本与预算 / 成本台账", tab === "usage" ? "用量与计量" : "成本台账", tab === "usage" ? "计量差异（含失败重试）必须显式展示：供应商按调用计费，平台按有效产出统计。" : "成本口径固定：预计、实际、失败三列并存，任何一列都不允许被「合并成总账」而丢失。",
            U.btn("预算视图", "cost.toBudget", "primary") + (tab === "usage" ? U.btn("导出用量", "common.export") : ""),
            tabsBar + (tab === "usage" ? usageBlock(proj === "全部" ? "" : proj) : '<div class="grid grid-4">' +
              U.metric("预计合计", money(est), "当前视图 " + list.length + " 笔", "≈") +
              U.metric("实际合计", money(act), "以调用记录为准", "¥") +
              U.metric("失败成本", money(fail), "不摊入成功项", "×") +
              U.metric("个人承担", personal + " 笔", "员工个人账户扣费", "人") +
            "</div>" +
            U.card("成本明细 · " + list.length + " 笔", toolbar + U.table(["成本号", "项目 · 集 · 镜头", "能力", "预计", "实际", "失败", "承担方 · 来源", "状态", "操作"], rows), "列表只留金额与定位；归属七维（资源配置人 / 执行人 / 部门 / 供应商 / 账单 / 调整记录）在「核验」抽屉里逐项留痕，不进表格") +
            U.tableFoot("共 " + all.length + " 笔 · 当前筛选 " + list.length + " 笔", "可见范围：" + DB.derived.scopeLabel() + "；预计 / 实际 / 失败三列并列，不合并展示") +
            '<div class="grid grid-2 mt-4">' +
              U.card("十维成本口径", '<div class="chip-row">' + D.costDimensions.map(x => '<span class="chip">' + U.esc(x) + "</span>").join("") + "</div>" + U.listRows([["项目 / 单集 / 单镜头", "按结构逐层汇总"], ["能力维度", "图像 / 视频 / 音频 / 后期"], ["失败与重试", "单列，不回填到成功项"], ["存储与转码", "按体积与时长计量"]]) , "统计按维度可下钻") +
              (failedOne
                ? U.card(failedOne.id + " · 失败成本示例", U.notice("该任务失败成本 " + money(failedOne.failed) + " 已入账，承担方为「" + failedOne.bearer + "」。", "warn") + U.desc([["预计", money(failedOne.est)], ["实际", money(failedOne.actual)], ["失败成本", money(failedOne.failed)], ["承担方", failedOne.bearer], ["账单", failedOne.bill]]) , "无产出也要记账")
                : U.card("失败与重试成本明细", U.empty("当前可见范围内没有失败成本", "失败与重试会在发生时单列入账。"), "无产出也要记账")) +
            "</div>")
          );
        }
      },
      {
        path: "cost/budget", title: "预算与阈值", icon: "gauge", permission: "cost.read",
        desc: "预算两级控制（项目总预算 + 单集预算），接近阈值提醒、超限即暂停受影响任务，不做整项目静默继续。",
        render(query) {
          const pid = (query && query.id) || "";
          const p = pid ? (D.projects.find(x => x.id === pid) || null) : null;
          if (pid && (!p || !DB.derived.canViewProject(p))) return U.page("成本与预算 / 预算与阈值", "项目预算不在可见范围", "只能查看自己负责、参与或经授权项目的预算；跨项目预算不渲染。", U.btn("返回项目列表", "common.projects", "primary"), U.empty("无法读取项目预算", "项目不存在或当前身份不可见。"));
          const visible = DB.derived.visibleBudgets();
          const budgets = pid ? visible.filter(b => String(b.name).indexOf(pid) === 0 || b.project === pid) : visible;
          const rows = budgets.map(b => {
            const usedPct = b.total ? Math.round(b.used / b.total * 100) : 0;
            const epBudget = b.scope === "项目" ? Math.round(b.total / Math.max(1, (D.projects.find(p => String(b.name).indexOf(p.id) === 0) || {}).episodes || 1)) : null;
            return "<tr><td>" + U.esc(b.scope) + '</td><td class="cell-strong">' + U.esc(b.name) + '</td><td class="num">' + money(b.total) + '</td><td class="num">' + money(b.used) + '</td><td class="num">' + money(b.reserve) + '</td><td class="num">' + (epBudget === null ? "—" : money(epBudget)) + '</td><td class="cell-wide">' + U.progress(usedPct, usedPct + "%", usedPct >= 85 ? "bad" : usedPct >= 70 ? "warn" : "") + '</td><td>' + U.pill(b.state) + "</td><td>" + U.esc(b.owner) + "</td><td>" +
              (App.can("cost.manage") ? U.btn("调整", "cost.adjustBudget", "sm", { name: b.name }) + " " +
                (b.scope === "项目" ? U.btn(b.state === "已冻结" ? "解冻" : "冻结", "cost.freeze", "sm", { name: b.name }) : "") : '<span class="faint small">按权限只读</span>') + "</td></tr>";
          }).join("");
          const labels = budgets.map(b => b.scope === "项目" ? String(b.name).split(" ")[0] : b.scope === "部门" ? "部门 · " + b.name : "企业");
          const values = budgets.map(b => b.total ? Number((b.used / b.total * 100).toFixed(1)) : 0);
          const hot = budgets.filter(b => b.total && b.used / b.total >= 0.85)[0] || null;
          const hotPct = hot ? Math.round(hot.used / hot.total * 100) : 0;
          return U.page("成本与预算 / 预算与阈值", "预算与阈值", "预算超限不是「提醒一下」：受影响任务必须暂停并给出阻塞原因，恢复需负责人确认。",
            U.btn("成本台账", "cost.toLedger", "", p ? { id: p.id } : {}) + (App.can("cost.manage") ? U.btn("调整阈值", "cost.setThreshold", "primary") : ""),
            U.card("预算表 · " + (p ? U.esc(p.name) : "可见 " + budgets.length + " 项"), U.table(["层级", "名称", "总额", "已用", "预留", "单集预算（总额 ÷ 集数）", "使用率", "状态", "负责人", "操作"], rows, p ? "当前项目未建立独立预算" : "当前可见范围内没有预算记录"), p && !budgets.length ? "该项目未建立项目预算，成本只能按企业 / 部门额度归集" : "按项目、部门、企业三级展示；预算状态五态：未设置 / 正常 / 接近阈值 / 已超限 / 已冻结") +
            U.tableFoot("可见范围：" + DB.derived.scopeLabel(), "口径：总额 − 已用 − 预留 = 可用余额") +
            '<div class="split mt-4"><div class="stack">' +
              U.notice("口径与规则见《口径与规则汇总》§R-12：预算规则（6 条）", "info") +
              U.card("预检与阻塞", U.notice("任务提交前先估算并做预算预检；超限任务保持「待执行」并写明阻塞原因（预算超限 / 单集超限 / 需负责人审批）。", "info")) +
            '</div><div class="stack">' +
              (hot
                ? U.card(hot.name + " 预算告警", U.notice("已用 " + hotPct + "%（" + money(hot.used) + " / " + money(hot.total) + "），扣除预留 " + money(hot.reserve) + " 后可用余额 " + money(hot.total - hot.used - hot.reserve) + "。达到暂停阈值时受影响任务必须暂停，恢复需负责人确认或追加预算。", hotPct >= 90 ? "bad" : "warn") +
                  '<div class="btn-row-inline">' + (App.can("cost.manage") ? U.btn("追加预算", "cost.addBudget", "sm", { name: hot.name }) + U.btn("恢复任务", "cost.resume", "sm") : "") + "</div>", "接近阈值不等于可继续")
                : U.card("预算告警", U.empty("当前可见范围内没有接近阈值的预算", "使用率超过 85% 会在这里显示并阻止继续派发。"), "阈值可配置")) +
              U.card("使用率分布", labels.length ? U.bars(labels, values, "%") : U.empty("没有可用预算", "预算台账为空时无法绘制分布。"), "按当前可见层级展示，数值来自预算表") +
              U.notice("口径与规则见《口径与规则汇总》§R-13：阈值口径", "info") +
            "</div></div>"
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("cost.toLedger", (el) => {
    const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id;
    App.go("cost/ledger", pid ? { id: pid } : undefined);
  });
  App.on("cost.toBudget", (el) => {
    const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id;
    App.go("cost/budget", pid ? { id: pid } : undefined);
  });
  App.on("cost.toUsage", (el) => {
    const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id;
    App.set(SCOPE, "tab", "usage");
    App.go("cost/ledger", pid ? { id: pid } : undefined);
  });
  App.on("cost.tab", (el) => { App.set(SCOPE, "tab", el.dataset.value || "ledger"); App.refresh(); });
  App.on("cost.ledgerLink", (el) => {
    const id = (el && el.dataset && el.dataset.project) || "";
    if (id && !DB.derived.canViewProject(D.projects.find(p => p.id === id))) {
      App.toast("该项目成本不在当前可见范围：" + id, "bad");
      return;
    }
    App.set(SCOPE, "proj", id || "全部");
    App.go("cost/ledger");
  });
  App.on("cost.proj", (el) => { App.set(SCOPE, "proj", el.dataset.value); App.refresh(); });
  App.on("cost.verify", (el) => {
    const c = D.costs.find(x => x.id === el.dataset.id);
    if (!c) return;
    if (!DB.derived.visibleCosts().some(x => x.id === c.id)) { App.toast("该成本记录不在当前可见范围", "bad"); return; }
    App.drawer("成本核验 · " + c.id, U.desc([["项目 / 集 / 镜头", c.project + " · E" + c.ep + " / " + c.shot], ["任务 · 能力", c.task + " · " + c.cap], ["预计 / 实际", money(c.est) + " / " + money(c.actual)], ["失败成本", money(c.failed)], ["承担方 · 来源", c.bearer + " · " + c.source], ["配置人 / 执行人", (c.resourceOwner || "—") + " / " + (c.executor || "—")], ["部门 · 供应商", (c.dept || "—") + " · " + c.provider], ["状态", c.status], ["账单", c.bill], ["调整记录", c.adjustment || "无"]]) +
      U.notice(c.status === "待核实" ? "该笔尚未与账单核对，不得计入已确认成本。" : "已与供应商账单核对一致。", c.status === "待核实" ? "warn" : "ok"));
  });

  /* 费用调整：保留原值、调整人、原因与凭据（业务方案 §15.3） */
  App.on("cost.adjust", (el) => {
    if (!App.guard("cost.manage")) return;
    const c = D.costs.find(x => x.id === el.dataset.id);
    if (!c) { App.toast("成本记录不存在", "bad"); return; }
    if (!DB.derived.visibleCosts().some(x => x.id === c.id)) { App.toast("该成本记录不在当前可见范围", "bad"); return; }
    App.modal({
      title: "费用调整 · " + c.id, sub: "调整必须保留原值、调整人、原因与账单凭据；不得直接覆盖原记录",
      body: U.fField("当前实际金额", "cur", { value: String(c.actual), readonly: true }) +
        U.fField("调整后金额", "actual", { required: true, type: "number", min: 0, value: String(c.actual) }) +
        U.fTextarea("调整原因", "reason", { required: true, minlen: 8, rows: 3, placeholder: "例如：供应商账单与计量差异，按账单据实调整" }) +
        U.fField("账单凭据", "bill", { required: true, minlen: 4, value: c.bill && c.bill !== "—" ? c.bill : "", placeholder: "例如：INV-2026-11-0231" }),
      submitText: "提交调整",
      onSubmit(d) {
        return App.job({
          title: "费用调整", steps: ["校验调整依据", "写入调整记录", "写审计"],
          run() { return DB.state.adjustCost(c.id, d.actual, d.reason, d.bill); }
        });
      }
    });
  });
})();

/* ===== v9.1 真实流程层：预算调整、阈值与追加 ===== */
(function () {
  const U = UI, D = DB;

  function budgetByName(name) { return D.budgets.find(b => b.name && (b.name === name || name.indexOf(b.name) === 0)); }

  /* 预算冻结 / 解冻（业务方案 §15.5）：冻结时禁止派发新任务，已发生费用仍可入账 */
  App.on("cost.freeze", (el) => {
    if (!App.guard("cost.manage")) return;
    const bg = budgetByName(el && el.dataset && el.dataset.name ? el.dataset.name : "");
    if (!bg) { App.toast("未找到预算行", "bad"); return; }
    const pid = String(bg.name).split(" ")[0];
    const on = bg.state !== "已冻结";
    App.modal({
      title: (on ? "冻结" : "解冻") + "预算 · " + bg.name,
      sub: on ? "冻结后禁止派发新任务；已发生费用仍可入账" : "解冻后按当前使用率重新判定预算状态",
      body: U.fTextarea(on ? "冻结原因" : "解冻原因", "reason", { required: true, minlen: 8, rows: 3, placeholder: "例如：合规复核期间暂停派发" }) +
        U.notice(on ? "冻结会暂停该项目排队中、执行中、待执行与重试中的任务。" : "解冻不会自动恢复已暂停任务，需要另行恢复。", "warn"),
      submitText: on ? "确认冻结" : "确认解冻",
      onSubmit(d) {
        return App.job({
          title: on ? "冻结预算" : "解冻预算", steps: ["校验预算状态", "更新预算状态", "联动任务派发"],
          run() { return DB.state.freezeBudget(pid, on, d.reason); }
        });
      }
    });
  });

  App.on("cost.adjustBudget", (el) => {
    if (!App.guard("cost.manage")) return;
    const bg = budgetByName(el && el.dataset && el.dataset.name ? el.dataset.name : "");
    if (!bg) { App.toast("未找到预算行", "bad"); return; }
    App.modal({
      title: "调整预算 · " + bg.name, sub: "预算是硬约束：低于已用金额不可保存，超过 85% 触发提醒",
      body: U.fField("当前总额", "cur", { value: String(bg.total), readonly: true }) +
        U.fField("已用", "used", { value: String(bg.used), readonly: true }) +
        U.fField("新总额（元）", "total", { required: true, type: "number", min: 1, value: String(bg.total) }) +
        U.fTextarea("调整原因", "note", { required: true, minlen: 8, rows: 3, placeholder: "例如：追加第 17–24 集预算，审批人 王亦宁" }),
      submitText: "保存预算",
      onSubmit(d) {
        const isProject = bg.scope === "项目";
        const pid = isProject ? String(bg.name).split(" ")[0] : bg.scope;
        const next = Number(d.total);
        return App.job({
          title: "调整预算", steps: ["校验金额下限", "更新预算台账", "写审计"],
          run() {
            if (next < bg.used) {
              return { ok: false, msg: "新总额不得低于已用 ¥" + DB.state.money(bg.used), fields: { total: "不得低于已用 ¥" + DB.state.money(bg.used) } };
            }
            if (isProject) {
              const r = DB.state.adjustBudget(pid, next, d.note);
              if (!r.ok) return r;
              DB.state.log("预算 " + bg.name, "调整为 ¥" + next + "：" + d.note, "成功", pid);
              return { ok: true, msg: r.msg };
            }
            bg.total = next;
            if (bg.state !== "已冻结") bg.state = DB.state.budgetStateFor(bg.used, next, false);
            DB.state.log("预算 " + bg.name, "总额调整为 ¥" + next + "：" + d.note, "成功", pid);
            return { ok: true, msg: bg.name + " 总额已调整为 ¥" + DB.state.money(next) };
          }
        });
      }
    });
  });

  App.on("cost.setThreshold", () => {
    if (!App.guard("cost.manage")) return;
    App.modal({
      title: "设置预算提醒阈值", sub: "阈值用于提醒与告警，不自动阻断任务",
      body: U.fSelect("作用范围", "scope", ["项目", "部门", "企业"]) +
        U.fField("阈值（%）", "pct", { required: true, type: "number", min: 50, max: 100, value: "85" }) +
        U.fTextarea("设置依据", "note", { required: true, minlen: 8, rows: 3 }),
      submitText: "保存阈值",
      onSubmit(d) {
        return App.job({
          title: "保存阈值", steps: ["校验阈值范围", "写入成本配置"],
          run() {
            App.set("cost", "threshold", { scope: d.scope, pct: Number(d.pct) });
            DB.state.log("成本阈值", d.scope + " " + d.pct + "%：" + d.note, "成功", "cost");
            return { ok: true, msg: d.scope + " 阈值已设为 " + d.pct + "%" };
          }
        });
      }
    });
  });

  App.on("cost.addBudget", (el) => {
    if (!App.guard("cost.manage")) return;
    const name = el && el.dataset && el.dataset.name ? el.dataset.name : "";
    const bg = budgetByName(name);
    if (!bg) { App.toast("缺少预算行上下文，未执行追加", "bad"); return; }
    App.modal({
      title: "追加预算 · " + bg.name, sub: "追加需记录审批人；追加后重算占用比例",
      body: U.fField("追加金额（元）", "amount", { required: true, type: "number", min: 1, value: "2000" }) +
        U.fField("审批人", "by", { required: true, minlen: 2, value: (App.identity() && App.identity().name) || "负责人" }) +
        U.fTextarea("追加原因", "note", { required: true, minlen: 8, rows: 3 }),
      submitText: "确认追加",
      onSubmit(d) {
        return App.job({
          title: "追加预算", steps: ["校验审批记录", "累加总额", "重算占用比例"],
          run() {
            const pid = String(bg.name).split(" ")[0];
            const total = Number(bg.total) + Number(d.amount);
            const r = DB.state.adjustBudget(pid, total, "追加 " + d.amount + "（审批 " + d.by + "）：" + d.note);
            if (!r.ok) return r;
            return { ok: true, msg: "已追加 ¥" + d.amount + "，新总额 ¥" + total };
          }
        });
      }
    });
  });

  App.on("cost.resume", (el) => {
    if (!App.guard("cost.manage")) return;
    const qid = (App.current().query || {}).id || "";
    const visPids = DB.derived.visibleProjects().map(p => p.id);
    const fallbackTask = D.tasks.find(t => t.status === "已暂停" && visPids.indexOf(t.project) >= 0);
    const pid = qid || (fallbackTask && fallbackTask.project);
    if (!pid) { App.toast("没有可恢复任务的项目", "bad"); return; }
    if (visPids.indexOf(pid) < 0) { App.toast("该项目不在当前可见范围，不能恢复其任务", "bad"); return; }
    const list = D.tasks.filter(t => t.project === pid && t.status === "已暂停");
    if (!list.length) { App.toast("当前项目没有因预算暂停的任务", "bad"); return; }
    const bg = D.budgets.find(b => b.scope === "项目" && b.name.indexOf(pid) === 0);
    if (!bg) { App.toast("当前项目没有独立预算，无法校验恢复余额", "bad"); return; }
    App.confirm("恢复受限任务 · " + pid, "当前项目已用 ¥" + DB.state.money(bg.used) + " / 总额 ¥" + DB.state.money(bg.total) + "；恢复后将重新计费，请确认余额充足。", () => {
      App.job({
        title: "恢复受限任务", steps: ["校验预算余额", "任务重新排队"],
        run() {
          const ok = [];
          list.forEach(t => { t.status = "排队中"; ok.push(t.id); });
          DB.state.log("预算恢复", "恢复任务 " + ok.join("、") + " · " + pid, "成功", pid);
          return { ok: true, msg: "已恢复 " + ok.length + " 个任务（" + ok.slice(0, 4).join("、") + "）" };
        }
      });
    }, "确认恢复");
  });
})();
