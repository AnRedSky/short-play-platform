/* 模块：tasks 生产任务、队列与尝试记录 */
(function () {
  const U = UI, D = DB, SCOPE = "tasks";
  const STATES = ["待提交", "排队中", "执行中", "成功", "质量检测中", "失败（可重试）", "失败（不可重试）", "待人工处理", "已取消", "已暂停", "已跳过"];
  const visiblePids = () => Derived.visibleProjects().map(p => p.id);
  const visTask = (t) => visiblePids().indexOf(t.project) >= 0;

  AppModule.register({
    group: "tasks", label: "任务与队列", icon: "list", order: 9, end: "workspace",
    routes: [
      {
        path: "tasks/list", title: "生产任务", icon: "list", permission: ["task.operate", "audit.read"],
        desc: "任务是最小执行记录：一次失败产生新的 Attempt，任务本身不被覆盖；重试、取消、切换备用模型都要留痕。",
        render(query) {
          const kw = App.get(SCOPE, "kw", "");
          const st = App.get(SCOPE, "st", "全部");
          const pid = (query && query.id) || "";
          const projects = Derived.visibleProjects();
          const scopedProject = projects.find(p => p.id === pid) || null;
          if (pid && !scopedProject) {
            return U.page("任务与队列 / 生产任务", "项目不在可见范围", "该链接指向的项目不存在或当前身份无权查看。",
              U.btn("查看全部任务", "tasks.toList", "primary"),
              U.empty("无法读取任务", "请从项目或任务列表重新进入，系统不会回退到其他项目的任务。"));
          }
          const exhausted = D.tasks.filter(visTask).filter(t => !pid || t.project === pid).find(t => t.status === "待人工处理" && t.attempt >= t.maxAttempts) || null;
          const list = D.tasks.filter(visTask).filter(t =>
            (!pid || t.project === pid) &&
            (st === "全部" || t.status === st) &&
            (!kw || (t.id + t.project + t.kind + t.shot + t.executor).indexOf(kw) >= 0));
          const rows = list.map(t =>
            '<tr><td>' + U.code(t.id) + '<div class="faint small">' + U.esc(t.kind) + "</div></td><td>" + U.esc(t.project) + '<div class="faint small">E' + t.ep + " / S" + t.scene + "</div></td><td>" + U.esc(t.shot) + "</td><td>" +
            U.pill(t.status) + "</td><td>" + U.esc(t.priority) + '</td><td class="cell-wrap muted">' + U.esc(t.model) + " · " + U.esc(t.config) + '</td><td class="num">' + t.attempt + " / " + t.maxAttempts + '</td><td class="num">¥' + t.est + '</td><td class="num">¥' + t.actual + "</td><td>" + U.esc(t.submitAt) + "</td><td>" +
            U.btn("详情", "tasks.detail", "sm", { id: t.id }) + " " + U.btn("尝试", "tasks.toAttempts", "sm", { id: t.id }) + "</td></tr>").join("");
          const toolbar = '<div class="toolbar"><span class="field-wrap"><input class="field" data-filter="tasks.kw" name="kw" placeholder="搜索任务 / 项目 / 执行人" value="' + U.esc(kw) + '"></span>' +
            U.seg(["全部"].concat(STATES.slice(0, 7)), st, "tasks.st") +
            '<span class="grow"></span>' + U.btn("批量重试", "tasks.batchRetry", "", { pid: pid }) + U.btn("暂停队列", "tasks.pauseQueue", "primary", { pid: pid }) + "</div>" +
            '<div class="toolbar mt-2"><span class="faint small">项目范围</span>' +
            U.seg([{ value: "", label: "全部可见项目" }].concat(projects.map(p => ({ value: p.id, label: p.name }))), pid, "tasks.scope") +
            '<span class="faint small">' + (scopedProject ? "只显示《" + U.esc(scopedProject.name) + "》的任务；切回全部不会改变任务状态" : "聚合 " + projects.length + " 个可见项目的任务") + "</span></div>";
          return U.page("任务与队列 / 生产任务", "生产任务", "任务、尝试、调用三层记录；失败成本与重试成本一律入账。",
            U.btn("资源池与队列", "tasks.toQueue") + U.btn("尝试与调用", "tasks.toAttempts"),
            U.card("任务列表 · 当前 " + list.length + " 条", toolbar + U.table(["任务", "项目 / 集", "镜头", "状态", "优先级", "模型 / 配置", "尝试", "预计", "实际", "提交", "操作"], rows, "当前筛选条件下没有任务"), list.length ? "筛选只影响当前视图，不改变任务状态" : "当前筛选条件下没有任务") +
            U.tableFoot("共 " + D.tasks.filter(visTask).length + " 条可见任务 · 当前视图 " + list.length + " 条", "筛选只影响当前视图，不改变任务状态；非成员项目任务不可见") +
            '<div class="split mt-4"><div class="stack">' +
              U.card("任务状态（11 类）", U.table(["状态", "含义", "可执行操作"], [
                ["待提交", "已固化未入队", "入队 / 取消"],
                ["排队中", "等待资源", "提优先级 / 取消"],
                ["执行中", "资源占用中", "暂停 / 取消"],
                ["成功", "输出已产出", "送质检"],
                ["质量检测中", "系统自动进入", "等待结论"],
                ["失败（可重试）", "供应商 / 超时类", "重试（新建 Attempt）"],
                ["失败（不可重试）", "合规 / 输入非法", "改输入或人工决策"],
                ["待人工处理", "超轮次或需判断", "人工决策"]
              ].map(r => "<tr><td>" + U.pill(r[0]) + '</td><td class="cell-wrap">' + r[1] + '</td><td class="cell-wrap muted">' + r[2] + "</td></tr>").join("")), "状态由系统流转") +
            '</div><div class="stack">' +
              U.card(exhausted ? exhausted.id + " · 已用尽尝试" : "待人工处理", exhausted ? U.notice("该任务 " + exhausted.attempt + " / " + exhausted.maxAttempts + " 次尝试全部失败：" + (exhausted.failReason || "—") + "。失败成本 ¥" + Number(exhausted.failedCost || 0).toFixed(1) + " 已入账。", "bad") +
                '<div class="btn-row-inline">' + U.btn("查看尝试", "tasks.toAttempts", "sm", { id: exhausted.id }) + U.btn("人工决策", "tasks.decide", "sm", { id: exhausted.id }) + "</div>" : U.empty(scopedProject ? "《" + scopedProject.name + "》没有待人工任务" : "当前可见范围没有待人工任务", "轮次用尽或合规阻断的任务会出现在这里"), exhausted ? "轮次用尽必须人工决策" : "按项目范围实时计算") +
              U.card("重试规则", U.listRows([["Attempt", "每次重试新建 Attempt，不覆盖历史"], ["轮次", "默认上限 3 次"], ["可重试", "超时 / 供应商 5xx / 质量不合格"], ["不可重试", "合规阻断 / 输入非法"], ["备用模型", "切换前必须做兼容校验"]]) , "重试不改变原任务记录") +
            "</div></div>"
          );
        }
      },
      {
        path: "tasks/queue", title: "资源池与队列", icon: "board", permission: ["task.operate", "audit.read"],
        desc: "队列按资源池划分：谁持有资源、当前并发多少、谁在等待。资源不足时排队而非失败。",
        render() {
          const q = D.ops.queue;
          const conf = App.get(SCOPE, "concurrency", { v: 3, a: 2, q: 2 });
          const limit = Number(conf.v) + Number(conf.a) + Number(conf.q);
          const poolLimit = (name) => String(name).indexOf("视频") >= 0 ? conf.v : String(name).indexOf("语音") >= 0 ? conf.a : String(name).indexOf("质量检测") >= 0 ? conf.q : null;
          const cols = [
            { title: "排队中", items: D.tasks.filter(visTask).filter(t => t.status === "排队中").map(t => ({ title: t.id + " · " + t.kind, sub: t.project + " E" + t.ep + " · " + t.executor, tags: [t.priority] })) },
            { title: "执行中", items: D.tasks.filter(visTask).filter(t => t.status === "执行中").map(t => ({ title: t.id + " · " + t.kind, sub: t.model, tags: ["运行"] })) },
            { title: "待人工", items: D.tasks.filter(visTask).filter(t => t.status === "待人工处理").map(t => ({ title: t.id + " · 合规阻断", sub: t.failReason, tags: ["人工"] })) }
          ];
          return U.page("任务与队列 / 资源池与队列", "资源池与队列", "资源池按能力划分且为平台级；任务看板与等待原因只统计当前身份可见项目，两者口径在卡片上分别标注。",
            U.btn("任务列表", "tasks.toList", "primary") + (App.can("task.operate") ? U.btn("调整并发", "tasks.setConcurrency") : '<span class="faint small">并发配置需任务操作权限</span>'),
            '<div class="grid grid-4">' +
              U.metric("执行中", String(D.tasks.filter(visTask).filter(t => t.status === "执行中").length), "当前可见项目", "◐") +
              U.metric("排队中", String(D.tasks.filter(visTask).filter(t => t.status === "排队中").length), "当前可见项目", "○") +
              U.metric("待人工", String(D.tasks.filter(visTask).filter(t => t.status === "待人工处理").length), "当前可见项目", "!") +
              U.metric("平台并发上限", limit + " / 池", "视频池 " + conf.v + " · 语音池 " + conf.a + " · 质检池 " + conf.q, "▤") +
            "</div>" +
            U.card("队列看板", U.kanban(cols), "当前可见项目 · 按状态分列") +
            '<div class="split mt-4"><div class="stack">' +
              U.card("资源池", U.table(["队列", "等待", "执行中", "失败", "待重试", "并发", "平均耗时", "状态说明"], q.map(x => {
                const lim = poolLimit(x.name);
                return '<tr><td class="cell-strong">' + U.esc(x.name) + '</td><td class="num">' + x.pending + '</td><td class="num">' + x.running + '</td><td class="num">' + x.failed + '</td><td class="num">' + x.retry + "</td><td>" + (lim === null ? U.esc(x.concurrency) : '<span class="cell-strong">' + lim + " / " + U.esc(String(x.concurrency).split("/")[1].trim()) + "</span>") + "</td><td>" + U.esc(x.avg) + '</td><td class="cell-wrap muted">' + U.esc(x.note) + "</td></tr>";
              }).join(""), "暂无队列") +
                U.notice("资源归属为「个人自持」时，任务只能用该员工的凭据执行；不得借用他人配置完成交付。并发值即「调整并发」保存后的生效值。", "info"), "平台资源池总览 · 等待 / 执行口径为全平台") +
            '</div><div class="stack">' +
              U.card("等待原因 · 实时", U.table(["原因", "对象", "处理"], (() => {
                const vis = D.tasks.filter(visTask);
                const queued = vis.filter(t => t.status === "排队中");
                const running = vis.filter(t => t.status === "执行中");
                const budget = Derived.visibleProjects().filter(p => p.budgetState && p.budgetState !== "正常");
                const rows = [];
                if (queued.length) rows.push(["等待资源派发", queued[0].id, "队列中 " + queued.length + " 个任务，按优先级与提交时间入池"]);
                if (running.length) rows.push(["资源池占用", running[0].id, "执行中 " + running.length + " 个；并发上限见资源池表"]);
                budget.forEach(p => rows.push(["预算状态 " + p.budgetState, p.id, "预算受限时新任务应暂停提交"]));
                return rows.length ? rows.map(r => '<tr><td class="cell-wrap">' + U.esc(r[0]) + "</td><td>" + U.code(r[1]) + '</td><td class="cell-wrap muted">' + U.esc(r[2]) + "</td></tr>").join("") : '<tr><td colspan="3" class="cell-wrap muted">当前可见项目没有排队或预算受限任务</td></tr>';
              })(), "无需排队")) +
              U.card("队列原则", U.listRows([["优先级", "高优先级先入池，同优先级按提交时间"], ["依赖", "依赖未满足不入队"], ["预算", "预算超限自动暂停新任务"], ["公平性", "单员工并发不超过 2"]]) , "排队不产生费用") +
            "</div></div>"
          );
        }
      },
      {
        path: "tasks/attempt", title: "尝试与调用记录", icon: "chain", permission: ["task.operate", "audit.read"],
        desc: "Attempt 与模型调用是两层证据：Attempt 说明重试过程，调用说明实际消耗与计费。",
        render() {
          const tid = App.get(SCOPE, "task", "");
          const visibleIds = D.tasks.filter(visTask).map(t => t.id);
          if (tid && visibleIds.indexOf(tid) < 0) {
            return U.page("任务与队列 / 尝试与调用", "任务不在可见范围", "该任务不存在或所属项目不在当前身份可见范围。",
              U.btn("清除任务筛选", "tasks.clearTask", "primary"),
              U.empty("无法读取尝试记录", "任务级记录不会回退显示其他任务的数据。"));
          }
          const at = D.attempts.filter(a => visibleIds.indexOf(a.task) >= 0 && (!tid || a.task === tid));
          const inv = D.invocations.filter(x => visibleIds.indexOf(x.task) >= 0 && (!tid || x.task === tid));
          const sample = tid ? D.tasks.find(t => t.id === tid && visTask(t)) : (D.tasks.filter(visTask).find(t => t.id === "T-8821") || D.tasks.filter(visTask).filter(t => t.attempt >= t.maxAttempts)[0] || null);
          const sampleAttempts = sample ? D.attempts.filter(a => a.task === sample.id).slice(0, 3) : [];
          const atRows = at.map(a =>
            '<tr><td>' + U.code(a.id) + "</td><td>" + U.code(a.task) + "</td><td>" + U.esc(a.at) + "</td><td>" + U.pill(a.status) + '</td><td class="cell-wrap">' + U.esc(a.model) + '</td><td class="cell-wrap muted">' + U.esc(a.reason) + '</td><td class="num">¥' + a.cost.toFixed(1) + "</td></tr>").join("");
          const invRows = inv.map(x =>
            '<tr><td>' + U.code(x.id) + "</td><td>" + U.code(x.task) + "</td><td>" + U.esc(x.provider) + '</td><td class="cell-wrap">' + U.esc(x.model) + '<span class="faint small"> · ' + U.esc(x.vendorTask) + '</span></td><td>' + U.esc(x.cap) + '</td><td class="cell-wrap muted">' + U.esc(x.input) + '</td><td>' + U.esc(x.usage) + '</td><td class="num">¥' + x.cost.toFixed(1) + "</td><td>" + U.pill(x.status) + "</td><td>" + U.esc(x.at) + "</td></tr>").join("");
          return U.page("任务与队列 / 尝试与调用", "尝试与调用记录", "每次失败都保留：原因分类决定是否可重试，计费说明决定成本归属。",
            (tid ? U.btn("清除筛选", "tasks.clearTask") : "") + U.btn("任务列表", "tasks.toList") + U.btn("导出记录", "common.export"),
            U.card("尝试记录" + (tid ? " · " + tid : ""), U.table(["Attempt", "任务", "时间", "结果", "模型", "原因", "计费"], atRows)) +
            U.card("模型调用记录", U.table(["调用", "任务", "供应商", "模型 / 上游任务", "能力", "输入摘要", "用量", "成本", "状态", "时间"], invRows)) +
            '<div class="split mt-4"><div class="stack">' +
              U.card(sample ? sample.id + " · " + sampleAttempts.length + " 次尝试 / 上限 " + sample.maxAttempts : "尝试记录为空", sampleAttempts.length ? U.timeline(sampleAttempts.map((a, i) => ({ time: U.esc(a.at).slice(-5), title: "第 " + (i + 1) + " 次 · " + a.status, desc: (a.reason || "—") + "；计费 ¥" + Number(a.cost || 0).toFixed(1) }))) : U.empty(tid ? "该任务暂无尝试记录" : "当前可见任务暂无尝试记录", "提交生产任务后，每次调用都会保留 Attempt 与计费"), sampleAttempts.length ? "失败成本全部入账" : "尚无失败记录") +
              U.card("失败分类", U.table(["原因", "可重试", "处理"], [
                ["供应商超时 / 5xx", "是", "退避后重试"],
                ["质量不合格", "是", "重试或调整参数"],
                ["输入非法", "否", "修正输入"],
                ["合规阻断", "否", "换素材 / 人工决策"]
              ].map(r => "<tr><td>" + r[0] + "</td><td>" + U.pill(r[1], r[1] === "是" ? "ok" : "bad") + '</td><td class="cell-wrap muted">' + r[2] + "</td></tr>").join("")), "分类决定后续动作") +
            '</div><div class="stack">' +
              U.card("成本口径", U.desc([["预计成本", "提交时按模型单价 × 用量"], ["实际成本", "以调用记录为准"], ["失败成本", "单独计入，不摊入成功项"], ["重试成本", "每次尝试 单独记账"], ["企业侧", "按部门口径汇总"]]) , "成本不可事后估算") +
              U.card("凭据隔离", U.notice("调用记录仅展示脱敏凭据与上游任务号，任何角色均不可读取明文密钥。", "info")) +
            "</div></div>"
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("tasks.toList", () => App.go("tasks/list"));
  App.on("tasks.toQueue", () => App.go("tasks/queue"));
  App.on("tasks.toAttempts", (el) => { App.set(SCOPE, "task", (el && el.dataset && el.dataset.id) || ""); App.go("tasks/attempt"); });
  App.on("tasks.clearTask", () => { App.set(SCOPE, "task", ""); App.toast("已清除任务筛选"); App.refresh(); });
  App.on("tasks.st", (el) => { App.set(SCOPE, "st", el.dataset.value); App.refresh(); });
  App.on("tasks.scope", (el) => { App.go("tasks/list", { id: (el && el.dataset && el.dataset.value) || "" }); });
})();

/* ===== v9.1 真实流程层：任务执行 / 重试 / 换模型 / 队列与并发 ===== */
(function () {
  const U = UI, D = DB;
  const visibleTasks = () => {
    const ids = Derived.visibleProjects().map(p => p.id);
    return D.tasks.filter(t => ids.indexOf(t.project) >= 0);
  };

  function shotOf(t) {
    const s = D.shots.find(x => x.id === t.shot);
    if (s) return s;
    const alt = D.shots.find(x => x.project === t.project && x.ep === Number(t.ep) && x.no === t.shot);
    if (alt && alt.id !== t.shot) t.shot = alt.id;
    return alt || null;
  }

  App.on("tasks.detail", (el) => {
    const t = D.tasks.find(x => x.id === el.dataset.id);
    if (!t) return;
    shotOf(t);
    const acts = [];
    if (["排队中", "待执行", "待质检"].indexOf(t.status) >= 0) acts.push(U.btn("执行任务", "tasks.execute", "primary", { id: t.id }));
    if (t.status === "失败" || t.status === "待人工处理") acts.push(U.btn("人工决策", "tasks.decide", "primary", { id: t.id }));
    if (t.status !== "成功" && t.status !== "已取消") acts.push(U.btn("取消任务", "tasks.cancel", "sm", { id: t.id }));
    if (t.status !== "成功" && t.status !== "已取消") acts.push(U.btn("切换模型", "tasks.switchModel", "sm", { id: t.id }));
    App.drawer("任务 · " + t.id, U.desc([["类型 / 阶段", t.kind + " · " + t.stage], ["项目 / 集 / 场 / 镜头", t.project + " · E" + t.ep + " / S" + t.scene + " / " + t.shot], ["状态", t.status], ["优先级", t.priority], ["依赖", (t.deps || []).join("；") || "无"], ["并行组", t.parallelGroup], ["输入", t.input], ["输出", t.output], ["模型 / 配置", t.model + " · " + t.config], ["执行人 / 资源归属", t.executor + " / " + t.resourceOwner], ["尝试", t.attempt + " / " + t.maxAttempts], ["预计 / 实际 / 失败", "¥" + t.est + " / ¥" + t.actual + " / ¥" + (t.failedCost || 0)], ["质量", t.qc]]) +
      (t.failReason && t.failReason !== "—" ? U.notice(t.failReason, "bad") : "") +
      '<div class="btn-row-inline">' + acts.join("") + U.btn("查看尝试记录", "tasks.toAttempts", "sm", { id: t.id }) + "</div>");
  });

  App.on("tasks.execute", (el) => {
    if (!App.guard("task.operate")) return;
    const t = D.tasks.find(x => x.id === el.dataset.id);
    if (!t) return;
    App.closeDrawer();
    shotOf(t);
    if (t.status === "待质检") {
      App.job({ title: "镜头级质量检测", steps: ["读取契约检测项", "比对参考资产", "写入报告"], run() { return Store.ops.qcShot(t.shot); } });
      return;
    }
    App.job({
      title: "执行任务 " + t.id, sub: "依赖校验 → 供应商调用 → 结果持久化",
      steps: ["校验依赖与配额", "提交供应商调用", "持久化结果", "更新镜头状态"],
      run() {
        const r = Store.ops.runTask(t.id);
        if (!r.ok) return r;
        const q = Store.ops.qcShot(t.shot);
        return q.ok ? r : { ok: true, msg: r.msg + "；" + q.msg };
      }
    });
  });

  App.on("tasks.batchRetry", (el) => {
    if (!App.guard("task.operate")) return;
    const pid = (el && el.dataset && el.dataset.pid) || (App.current().query || {}).id || "";
    const proj = pid ? D.projects.find(p => p.id === pid) : null;
    if (pid && !proj) { App.toast("项目不存在：" + pid, "bad"); return; }
    const list = visibleTasks().filter(t => (!pid || t.project === pid) && t.status === "失败" && t.attempt < t.maxAttempts);
    if (!list.length) { App.toast((proj ? "《" + proj.name + "》" : "当前可见项目") + "没有可重试的失败任务（或已达重试上限）", "bad"); return; }
    App.modal({
      title: "批量重试" + (proj ? " · " + proj.name : ""), sub: "共 " + list.length + " 个可重试任务；每次重试创建新一次尝试 并计费",
      body: U.fTextarea("重试说明", "note", { required: true, minlen: 8, rows: 3 }) + U.fCheck("重试后自动执行并质检", "auto", { checked: true }) + U.notice("合规类失败不会自动重试，需人工决策。", "warn"),
      submitText: "提交重试",
      onSubmit(d) {
        return App.job({
          title: "批量重试", steps: ["校验重试上限", "批量创建尝试记录", "逐个执行"],
          run() {
            const blocked = [];
            const ok = [];
            list.forEach(t => {
              if (String(t.kind).indexOf("合规") >= 0) { blocked.push(t.id); return; }
              const r = Store.ops.retryTask(t.id);
              if (!r.ok) { blocked.push(t.id); return; }
              if (d.auto) { shotOf(t); Store.ops.runTask(t.id); Store.ops.qcShot(t.shot); }
              ok.push(t.id);
            });
            Store.log("任务批量", "重试 " + ok.length + " 个：" + d.note, ok.length ? "成功" : "阻断", "batch-retry");
            return { ok: ok.length > 0, msg: "已重试 " + ok.length + " 个" + (blocked.length ? "；" + blocked.length + " 个被拦（" + blocked.slice(0, 3).join("、") + "）" : "") };
          }
        });
      }
    });
  });

  App.on("tasks.switchModel", (el) => {
    if (!App.guard("task.operate")) return;
    const t = D.tasks.find(x => x.id === el.dataset.id);
    if (!t) return;
    App.closeDrawer();
    App.modal({
      title: "切换模型 · " + t.id, sub: "当前 " + t.model + " · 切换前执行兼容校验",
      body: U.fSelect("目标模型", "model", ["视频模型 B（备用）", "视频模型 A", "Audio Model A2（备用）"], { required: true }) +
        U.fTextarea("切换原因", "note", { required: true, minlen: 8, rows: 3 }) +
        U.notice("备用模型分辨率与参考图上限更严；不兼容时会被拦截。", "warn"),
      submitText: "校验并切换",
      onSubmit(d) {
        return App.job({
          title: "切换模型", steps: ["执行兼容校验", "更新任务配置", "写入审计"],
          run() {
            const r = Store.ops.switchModel(t.id, d.model);
            if (!r.ok) return r;
            Store.log("任务 " + t.id, "切换模型至 " + d.model + "：" + d.note, "成功", t.id);
            return { ok: true, msg: r.msg };
          }
        });
      }
    });
  });

  App.on("tasks.pauseQueue", (el) => {
    if (!App.guard("task.operate")) return;
    const pid = (el && el.dataset && el.dataset.pid) || (App.current().query || {}).id || "";
    const proj = pid ? D.projects.find(p => p.id === pid) : null;
    if (pid && !proj) { App.toast("项目不存在：" + pid, "bad"); return; }
    const scopeAll = proj ? "《" + proj.name + "》本项目任务" : "当前可见项目全部任务";
    const pools = [scopeAll, "视频生成任务", "音频任务", "文本与脚本任务"];
    App.modal({
      title: "暂停任务派发" + (proj ? " · " + proj.name : ""), sub: "只作用于" + (proj ? "《" + proj.name + "》" : "当前身份可见项目") + "中的排队中新任务；执行中、已完成与已产生费用的任务不受影响",
      body: U.fSelect("范围", "scope", pools, { required: true }) +
        U.fField("原因", "reason", { required: true, minlen: 6, placeholder: "例如：预算接近阈值，暂停新任务" }),
      submitText: "确认暂停",
      onSubmit(d) {
        return App.job({
          title: "暂停任务派发", steps: ["校验可见范围与依赖", "标记排队任务为已暂停", "写审计"],
          run() {
            const map = { "视频生成任务": "视频生产", "音频任务": "音频", "文本与脚本任务": "创意与剧本" };
            const key = map[d.scope];
            const list = visibleTasks().filter(t => (!pid || t.project === pid) && t.status === "排队中" && (d.scope === pools[0] || t.stage === key));
            if (!list.length) return { ok: false, msg: "当前范围没有排队中任务，未执行暂停" };
            list.forEach(t => { t.status = "已暂停"; });
            App.set("tasks", "paused", d.scope);
            Store.log("任务队列", "暂停 " + d.scope + "（" + list.length + " 个）：" + d.reason, "成功", "queue");
            return { ok: true, msg: d.scope + " 已暂停，受影响任务 " + list.length + " 个；执行中任务保持运行" };
          }
        });
      }
    });
  });

  App.on("tasks.decide", (el) => {
    if (!App.guard("task.operate")) return;
    const t = D.tasks.find(x => x.id === el.dataset.id);
    if (!t) return;
    shotOf(t);
    App.closeDrawer();
    App.modal({
      title: "人工决策 · " + t.id, sub: t.failReason,
      body: U.radioCards("decide", [
        { value: "fix", label: "修正输入后重试", desc: "需说明修改内容，重新提交" },
        { value: "switch", label: "切换备用模型", desc: "切换前必须通过兼容校验" },
        { value: "skip", label: "跳过此镜头", desc: "下游需相应调整，留审计" }
      ], "fix") + U.fTextarea("决策说明", "note", { required: true, minlen: 8, rows: 3 }),
      submitText: "提交决策",
      onSubmit(d) {
        return App.job({
          title: "人工决策", steps: ["校验决策依据", "执行决策", "联动下游与费用"],
          run() {
            if (d.decide === "switch") {
              const r = Store.ops.switchModel(t.id, "视频模型 B（备用）");
              if (!r.ok) return r;
              Store.log("任务 " + t.id, "人工切换备用模型：" + d.note, "成功", t.id);
              return { ok: true, msg: r.msg };
            }
            if (d.decide === "skip") {
              t.status = "已跳过"; t.failReason = "人工跳过：" + d.note;
              const s = D.shots.find(x => x.id === t.shot);
              if (s) s.status = "已跳过";
              Store.notify("任务 " + t.id + " 被人工跳过：" + d.note);
              Store.log("任务 " + t.id, "人工跳过：" + d.note, "成功", t.id);
              return { ok: true, msg: "已跳过该镜头，下游时间线需调整并留审计" };
            }
            const r = Store.ops.retryTask(t.id);
            if (!r.ok) return r;
            Store.log("任务 " + t.id, "修正输入后重试：" + d.note, "成功", t.id);
            return { ok: true, msg: "已创建新一次尝试，排队中" };
          }
        });
      }
    });
  });

  App.on("tasks.cancel", (el) => {
    if (!App.guard("task.operate")) return;
    const t = D.tasks.find(x => x.id === el.dataset.id);
    if (!t) return;
    App.closeDrawer();
    App.modal({
      title: "取消任务 · " + t.id, sub: "取消后已产生费用仍入账，任务不可恢复",
      body: U.fSelect("取消原因", "reason", ["需求变更", "重复提交", "预算收回", "模型不可用"], { required: true }) +
        U.fTextarea("补充说明", "note", { required: true, minlen: 8, rows: 3 }),
      submitText: "确认取消",
      onSubmit(d) { return App.job({ title: "取消任务", steps: ["校验状态", "结算已发生费用"], run() { return Store.ops.cancelTask(t.id, d.reason + "：" + d.note); } }); }
    });
  });

  App.on("tasks.setConcurrency", () => {
    if (!App.guard("task.operate")) return;
    const conf = App.get("tasks", "concurrency", { v: 3, a: 2, q: 2 });
    App.modal({
      title: "调整并发", sub: "仅调整本组织资源配额，保存后队列页立即按新并发展示",
      body: U.fField("视频池并发", "v", { required: true, type: "number", min: 1, max: 8, value: String(conf.v) }) +
        U.fField("语音池并发", "a", { required: true, type: "number", min: 1, max: 8, value: String(conf.a) }) +
        U.fField("质检池并发", "q", { required: true, type: "number", min: 1, max: 8, value: String(conf.q) }) +
        U.fTextarea("调整原因", "note", { required: true, minlen: 6, rows: 3 }),
      submitText: "保存",
      onSubmit(d) {
        return App.job({
          title: "调整并发", steps: ["校验配额上限", "写入并发配置", "写审计"],
          run() {
            App.set("tasks", "concurrency", { v: Number(d.v), a: Number(d.a), q: Number(d.q) });
            Store.log("任务并发", "视频 " + d.v + " · 语音 " + d.a + " · 质检 " + d.q + "：" + d.note, "成功", "concurrency");
            return { ok: true, msg: "并发已更新：视频 " + d.v + " · 语音 " + d.a + " · 质检 " + d.q + "（队列页已同步）" };
          }
        });
      }
    });
  });
})();
