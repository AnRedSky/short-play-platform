/* 模块：tasks 生产任务、队列与尝试记录 */
(function () {
  const U = UI, D = DB, SCOPE = "tasks";
  /* 任务状态枚举（业务方案 §12.2）：十一种状态，口径由状态层统一维护，模块只引用不另写一份。 */
  const STATES = DB.state.taskStates().map(s => s.key);
  const STATE_DESC = DB.state.taskStates();
  /* 失败类型与差异化重试策略（业务方案 §12.5） */
  const FAIL_TYPES = DB.state.failTypes();
  const visiblePids = () => DB.derived.visibleProjects().map(p => p.id);
  const visTask = (t) => visiblePids().indexOf(t.project) >= 0;

  AppModule.register({
    group: "tasks", label: "任务与队列", icon: "list", order: 9, end: "workspace",
    routes: [
      {
        path: "tasks/list", title: "生产任务", icon: "list", permission: "task.read",
        desc: "任务是最小执行记录：一次失败产生新的 Attempt，任务本身不被覆盖；重试、取消、切换备用模型都要留痕。",
        render(query) {
          const kw = App.get(SCOPE, "kw", "");
          const st = App.get(SCOPE, "st", "全部");
          const pid = (query && query.id) || "";
          const projects = DB.derived.visibleProjects();
          const scopedProject = projects.find(p => p.id === pid) || null;
          if (pid && !scopedProject) {
            return U.page("任务与队列 / 生产任务", "项目不在可见范围", "该链接指向的项目不存在或当前身份无权查看。",
              U.btn("生产任务", "tasks.toList", "primary"),
              U.empty("无法读取任务", "请从项目或任务列表重新进入，系统不会回退到其他项目的任务。"));
          }
          const exhausted = D.tasks.filter(visTask).filter(t => !pid || t.project === pid).find(t => t.status === "待人工处理" && t.attempt >= t.maxAttempts) || null;
          const list = D.tasks.filter(visTask).filter(t =>
            (!pid || t.project === pid) &&
            (st === "全部" || t.status === st) &&
            (!kw || (t.id + t.project + t.kind + t.shot + t.executor).indexOf(kw) >= 0));
          const rows = list.map(t => {
            const steps = t.steps || { vendor: "未开始", download: "未开始", persist: "未开始", qc: "未开始" };
            return '<tr><td>' + U.code(t.id) + '<div class="faint small">' + U.esc(t.kind) + "</div></td><td>" + U.esc(t.project) + '<div class="faint small">E' + t.ep + " / S" + t.scene + "</div></td><td>" + U.esc(t.shot) + "</td><td>" +
            U.pill(t.status) + "</td><td>" + U.esc(t.priority) + '</td><td class="cell-wrap muted">' + U.esc(t.model) + " · " + U.esc(t.config) + '</td><td class="idx">' + U.pill(steps.vendor) + " " + U.pill(steps.download) + " " + U.pill(steps.persist) + " " + U.pill(steps.qc) + '</td><td class="num">' + t.attempt + " / " + t.maxAttempts + '</td><td class="cell-wrap">' + (t.failType && t.failType !== "—" ? U.pill(t.failType, FAIL_TYPES[t.failType] && FAIL_TYPES[t.failType].retryable ? "warn" : "bad") : "—") + '</td><td class="num">¥' + t.est + '</td><td class="num">¥' + t.actual + "</td><td>" + U.esc(t.submitAt) + "</td><td>" +
            U.btn("详情", "tasks.detail", "sm", { id: t.id }) + " " + U.btn("尝试与调用记录", "tasks.toAttempts", "sm", { id: t.id }) + "</td></tr>";
          }).join("");
          const toolbar = '<div class="toolbar"><span class="field-wrap"><input class="field" data-filter="tasks.kw" name="kw" placeholder="搜索任务 / 项目 / 执行人" value="' + U.esc(kw) + '"></span>' +
            U.seg(["全部"].concat(STATES), st, "tasks.st") +
            '<span class="grow"></span>' + (App.can("task.operate") ? U.btn("批量重试", "tasks.batchRetry", "", { pid: pid }) + U.btn("暂停队列", "tasks.pauseQueue", "primary", { pid: pid }) : '<span class="faint small">当前身份只读，无任务操作权限</span>') + "</div>" +
            '<div class="toolbar mt-2"><span class="faint small">项目范围</span>' +
            U.seg([{ value: "", label: "全部可见项目" }].concat(projects.map(p => ({ value: p.id, label: p.name }))), pid, "tasks.scope") +
            '<span class="faint small">' + (scopedProject ? "只显示《" + U.esc(scopedProject.name) + "》的任务；切回全部不会改变任务状态" : "聚合 " + projects.length + " 个可见项目的任务") + "</span></div>";
          return U.page("任务与队列 / 生产任务", "生产任务", "任务、尝试、调用三层记录；失败成本与重试成本一律入账。",
            U.btn("资源池与队列", "tasks.toQueue") + U.btn("尝试与调用记录", "tasks.toAttempts"),
            U.card("任务列表 · 当前 " + list.length + " 条", toolbar + U.table(["任务", "项目 / 集", "镜头", "状态", "优先级", "模型 / 配置", "四状态（供应商 / 下载 / 持久化 / 质检）", "尝试", "失败类型", "预计", "实际", "提交", "操作"], rows, "当前筛选条件下没有任务"), list.length ? "筛选只影响当前视图，不改变任务状态" : "当前筛选条件下没有任务") +
            U.tableFoot("共 " + D.tasks.filter(visTask).length + " 条可见任务 · 当前视图 " + list.length + " 条", "筛选只影响当前视图，不改变任务状态；非成员项目任务不可见") +
            '<div class="split mt-4"><div class="stack">' +
              U.card("任务状态（业务方案 §12.2 · " + STATE_DESC.length + " 类）", U.table(["状态", "含义", "可执行操作"], STATE_DESC.map(s => {
                const acts = {
                  "待执行": "入队 / 取消", "排队中": "提优先级 / 取消", "执行中": "暂停 / 取消",
                  "成功": "送质检", "失败": "按失败类型重试或转人工", "取消中": "等待供应商确认",
                  "已取消": "重新提交（新建任务）", "暂停中": "等待运行中步骤收口", "已暂停": "恢复",
                  "重试中": "等待新 Attempt", "待人工处理": "人工决策：换模型 / 缩范围 / 接受现状"
                };
                return "<tr><td>" + U.pill(s.key) + '</td><td class="cell-wrap">' + U.esc(s.desc) + '</td><td class="cell-wrap muted">' + U.esc(acts[s.key] || "—") + "</td></tr>";
              }).join("")), "状态由系统流转，前端不可手工置入") +
              U.card("失败类型与差异化策略（业务方案 §12.5）", U.table(["失败类型", "是否自动重试", "处理策略"], Object.keys(FAIL_TYPES).map(k =>
                "<tr><td>" + U.pill(k, FAIL_TYPES[k].retryable ? "warn" : "bad") + '</td><td>' + U.esc(FAIL_TYPES[k].retryable ? "可重试" : "不可重试") + '</td><td class="cell-wrap muted">' + U.esc(FAIL_TYPES[k].strategy) + "</td></tr>").join("")), "不同失败类型采取不同策略，不得统一盲重试") +
            '</div><div class="stack">' +
              U.card(exhausted ? exhausted.id + " · 已用尽尝试" : "待人工处理", exhausted ? U.notice("该任务 " + exhausted.attempt + " / " + exhausted.maxAttempts + " 次尝试全部失败：" + (exhausted.failReason || "—") + "。失败成本 ¥" + Number(exhausted.failedCost || 0).toFixed(1) + " 已入账。", "bad") +
                '<div class="btn-row-inline">' + U.btn("尝试与调用记录", "tasks.toAttempts", "sm", { id: exhausted.id }) + (App.can("task.operate") ? U.btn("人工决策", "tasks.decide", "sm", { id: exhausted.id }) : "") + "</div>" : U.empty(scopedProject ? "《" + scopedProject.name + "》没有待人工任务" : "当前可见范围没有待人工任务", "轮次用尽或合规阻断的任务会出现在这里"), exhausted ? "轮次用尽必须人工决策" : "按项目范围实时计算") +
              U.card("重试规则", U.listRows([["Attempt", "每次重试新建 Attempt，不覆盖历史"], ["轮次", "默认上限 3 次"], ["可重试", "超时 / 供应商 5xx / 质量不合格"], ["不可重试", "合规阻断 / 输入非法"], ["备用模型", "切换前必须做兼容校验"]]) , "重试不改变原任务记录") +
            "</div></div>"
          );
        }
      },
      {
        path: "tasks/queue", title: "资源池与队列", icon: "board", permission: "task.read",
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
            U.btn("生产任务", "tasks.toList", "primary") + (App.can("task.operate") ? U.btn("调整并发", "tasks.setConcurrency") : '<span class="faint small">并发配置需任务操作权限</span>'),
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
                const budget = DB.derived.visibleProjects().filter(p => p.budgetState && p.budgetState !== "正常");
                const rows = [];
                if (queued.length) rows.push(["等待资源派发", queued[0].id, "队列中 " + queued.length + " 个任务，按优先级与提交时间入池"]);
                if (running.length) rows.push(["资源池占用", running[0].id, "执行中 " + running.length + " 个；并发上限见资源池表"]);
                budget.forEach(p => rows.push(["预算状态 " + p.budgetState, p.id, "预算受限时新任务应暂停提交"]));
                return rows.length ? rows.map(r => '<tr><td class="cell-wrap">' + U.esc(r[0]) + "</td><td>" + U.code(r[1]) + '</td><td class="cell-wrap muted">' + U.esc(r[2]) + "</td></tr>").join("") : '<tr><td colspan="3" class="cell-wrap muted">当前可见项目没有排队或预算受限任务</td></tr>';
              })(), "无需排队")) +
              U.notice("口径与规则见《口径与规则汇总》§R-39：队列原则", "info") +
            "</div></div>"
          );
        }
      },
      {
        path: "tasks/attempt", title: "尝试与调用记录", icon: "chain", permission: "task.read",
        desc: "Attempt 与模型调用是两层证据：Attempt 说明重试过程，调用说明实际消耗与计费。",
        render() {
          const tid = App.get(SCOPE, "task", "");
          const visibleIds = D.tasks.filter(visTask).map(t => t.id);
          if (tid && visibleIds.indexOf(tid) < 0) {
            return U.page("任务与队列 / 尝试与调用", "任务不在可见范围", "该任务不存在或所属项目不在当前身份可见范围。",
              U.btn("清除筛选", "tasks.clearTask", "primary"),
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
            (tid ? U.btn("清除筛选", "tasks.clearTask") : "") + U.btn("生产任务", "tasks.toList") + U.btn("导出记录", "common.export"),
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
              U.notice("口径与规则见《口径与规则汇总》§R-37：成本口径", "info") +
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
    const ids = DB.derived.visibleProjects().map(p => p.id);
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
    if (App.can("task.operate")) {
      if (["排队中", "待执行", "待质检"].indexOf(t.status) >= 0) acts.push(U.btn("执行任务", "tasks.execute", "primary", { id: t.id }));
      if (t.status === "失败" || t.status === "待人工处理") acts.push(U.btn("人工决策", "tasks.decide", "primary", { id: t.id }));
      if (t.status !== "成功" && t.status !== "已取消") acts.push(U.btn("取消任务", "tasks.cancel", "sm", { id: t.id }));
      if (t.status !== "成功" && t.status !== "已取消") acts.push(U.btn("切换模型", "tasks.switchModel", "sm", { id: t.id }));
    }
    const steps = t.steps || { vendor: "未开始", download: "未开始", persist: "未开始", qc: "未开始" };
    const fc = t.fileCheck;
    /* 生产衔接门禁（业务方案 §12.7）：四条条件逐条可见，不满足时给出具体阻塞原因 */
    const gateRows = [
      ["上游对象处于有效版本且未被标记过期", t.status === "待执行" ? "满足" : "按状态判定", String(t.shot || "—") + (String(shotOf(t) && shotOf(t).status).indexOf("需复核") >= 0 ? " 需复核" : "")],
      ["上游质量结果为 PASS（或 REVIEW_REQUIRED 已人工确认）", steps.qc === "通过" ? "满足" : steps.qc === "待检" ? "未开始检测" : "不满足", steps.qc],
      ["下游所需资产、配置与预算均可用", t.config ? "配置 " + t.config + " 已登记" : "未登记配置", t.config ? "预算由任务预检实时判定" : "需先配置模型资源"],
      ["未处于暂停、异常或终止状态", ["已暂停", "已取消"].indexOf(t.status) >= 0 ? "不满足" : "满足", t.status]
    ];
    App.drawer("任务 · " + t.id,
      U.card("四状态分离（业务方案 §8.2 · 强制）", U.table(["环节", "状态", "说明"], [
        ["供应商任务成功", U.pill(steps.vendor), steps.vendor === "成功" ? "供应商已受理并返回结果" : steps.vendor === "失败" ? "供应商环节失败，未进入下载" : "尚未提交"],
        ["文件下载成功", U.pill(steps.download), steps.download === "成功" ? "文件类型 / 大小 / 时长 / 分辨率 / 可播放性校验通过" : steps.download === "失败" ? "下载后校验未通过，资产未持久化" : "未执行"],
        ["资产持久化成功", U.pill(steps.persist), steps.persist === "成功" ? "已写入资产存储并生成校验摘要" : steps.persist === "失败" ? "持久化失败" : "未执行"],
        ["质量检测通过", U.pill(steps.qc), steps.qc === "通过" ? "镜头级检测通过" : steps.qc === "待检" ? "等待镜头级检测" : steps.qc === "未通过" ? "检测未通过，进入返工" : "未执行"]
      ].map(r => "<tr><td class=\"cell-strong\">" + r[0] + "</td><td>" + r[1] + '</td><td class="cell-wrap muted">' + r[2] + "</td></tr>").join("")), "四者互相独立，不得合并为一个「成功」") +
      (fc ? U.card("文件校验明细", U.desc([["格式", fc.format], ["文件大小", fc.sizeMB + " MB（上限 " + fc.limitMB + " MB）"], ["时长", fc.durationSec + " 秒"], ["分辨率", fc.resolution], ["分辨率校验", fc.resolutionCheck], ["可播放性", fc.playable], ["校验摘要", fc.checksum]])) : "") +
      /* 任务模型字段组（业务方案 §12.1） */
      U.desc([
        ["标识", t.id + " · " + t.kind + " · " + t.stage],
        ["项目 / 集 / 场 / 镜头", t.project + " · E" + t.ep + " / S" + t.scene + " / " + t.shot],
        ["状态 / 优先级 / 重试", t.status + " / " + t.priority + " / " + t.attempt + " / " + t.maxAttempts],
        ["依赖（前置 / 并行组）", (t.deps || []).join("；") || "无" + " · " + t.parallelGroup],
        ["输入 / 输出", t.input + " → " + t.output],
        ["执行主体", "执行人 " + t.executor + " / 资源配置人 " + t.resourceOwner + " / 配置 " + t.config + " / 模型 " + t.model],
        ["外部关联", "供应商任务 ID " + (t.vendorTaskId || "—") + " · 请求摘要 " + (t.requestSummary || "—")],
        ["成本", "预计 ¥" + t.est + " / 实际 ¥" + t.actual + " / 失败 ¥" + (t.failedCost || 0) + " · 承担方 " + (t.bearer || "—")],
        ["时间", "创建 " + (t.createdAt || "—") + " / 开始 " + (t.submitAt || "—") + " / 最后更新 " + (t.updatedAt || "—")],
        ["异常", "错误码 " + (t.errorCode || "—") + " · 失败类型 " + (t.failType || "—") + " · 处理结论 " + (t.conclusion || "—")],
        ["质量结果", steps.qc]
      ]) +
      U.card("生产衔接门禁（业务方案 §12.7）", U.table(["门禁条件", "判定", "阻塞说明"], gateRows.map(r =>
        "<tr><td class=\"cell-wrap\">" + r[0] + '</td><td>' + U.pill(r[1], r[1] === "满足" ? "ok" : r[1] === "不满足" ? "bad" : "warn") + '</td><td class="cell-wrap muted">' + U.esc(r[2]) + "</td></tr>").join("")), "门禁不满足时任务保持待执行，并给出具体阻塞原因") +
      (t.failReason && t.failReason !== "—" ? U.notice(t.failReason, "bad") : "") +
      '<div class="btn-row-inline">' + acts.join("") + U.btn("尝试与调用记录", "tasks.toAttempts", "sm", { id: t.id }) + "</div>");
  });

  App.on("tasks.execute", (el) => {
    if (!App.guard("task.operate")) return;
    const t = D.tasks.find(x => x.id === el.dataset.id);
    if (!t) return;
    App.closeDrawer();
    shotOf(t);
    if (t.status === "待质检") {
      App.job({ title: "镜头级质量检测", steps: ["读取契约检测项", "比对参考资产", "写入报告"], run() { return DB.state.qcShot(t.shot); } });
      return;
    }
    App.job({
      title: "执行任务 " + t.id, sub: "依赖校验 → 供应商调用 → 结果持久化",
      steps: ["校验依赖与配额", "提交供应商调用", "持久化结果", "更新镜头状态"],
      run() {
        const r = DB.state.runTask(t.id);
        if (!r.ok) return r;
        const q = DB.state.qcShot(t.shot);
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
              /* 合规类失败不可自动重试：按失败类型判定，不按任务类型名（任务类型不含「合规」字样） */
              const ft = t.failType || "";
              const reason = String(t.failReason || "");
              if (ft === "不可重试" || ft === "授权缺失" || /合规|违规|授权/.test(reason)) { blocked.push(t.id + "（" + (ft || "合规阻断") + "）"); return; }
              const r = DB.state.retryTask(t.id);
              if (!r.ok) { blocked.push(t.id + "（" + r.msg + "）"); return; }
              if (d.auto) { shotOf(t); DB.state.runTask(t.id); DB.state.qcShot(t.shot); }
              ok.push(t.id);
            });
            DB.state.log("任务批量", "重试 " + ok.length + " 个：" + d.note, ok.length ? "成功" : "阻断", "batch-retry");
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
            const r = DB.state.switchModel(t.id, d.model);
            if (!r.ok) return r;
            DB.state.log("任务 " + t.id, "切换模型至 " + d.model + "：" + d.note, "成功", t.id);
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
            DB.state.log("任务队列", "暂停 " + d.scope + "（" + list.length + " 个）：" + d.reason, "成功", "queue");
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
        { value: "accept", label: "接受当前质量并记录理由", desc: "仅非合规项可用，必须写明理由与风险" },
        { value: "shrink", label: "缩小返工范围", desc: "把问题限定到最小单元，其余继续生产" }
      ], "fix") + U.fTextarea("决策说明", "note", { required: true, minlen: 8, rows: 3 }) +
        U.notice("不允许以「跳过」方式强行推进（业务方案 §12.7）；合规阻断项必须返工或终止项目，不得人工接受现状。", "warn"),
      submitText: "提交决策",
      onSubmit(d) {
        return App.job({
          title: "人工决策", steps: ["校验决策依据", "执行决策", "联动下游与费用"],
          run() {
            if (d.decide === "switch") {
              const r = DB.state.switchModel(t.id, "视频模型 B（备用）");
              if (!r.ok) return r;
              DB.state.log("任务 " + t.id, "人工切换备用模型：" + d.note, "成功", t.id);
              return { ok: true, msg: r.msg };
            }
            if (d.decide === "accept") {
              /* 接受现状必须记录理由（业务方案 §16.5 / §11.5） */
              if (/合规|违规|授权/.test(String(t.failReason || "")) || t.failType === "不可重试" || t.failType === "授权缺失") {
                return { ok: false, msg: "合规与不可重试类型不允许接受现状，请改为返工、换模型或终止项目" };
              }
              t.status = "待人工处理";
              t.conclusion = "接受当前质量：" + d.note;
              DB.state.log("任务 " + t.id, "接受当前质量并记录理由：" + d.note, "待人工处理", t.id);
              DB.state.notify({ type: "人工决策", project: t.project, title: "任务 " + t.id + " 已接受当前质量", reason: d.note, impact: "该镜头保持未通过状态，不计入有效产出与交付", state: "已决策", action: "如需正式交付，需重新生成该镜头", owner: "项目负责人", link: "tasks/list" });
              return { ok: true, msg: "已接受当前质量并记录理由；该镜头不计入有效产出" };
            }
            if (d.decide === "shrink") {
              t.status = "待人工处理";
              t.conclusion = "缩小返工范围：" + d.note;
              const s = D.shots.find(x => x.id === t.shot);
              if (s) s.status = "需复核";
              DB.state.log("任务 " + t.id, "缩小返工范围：" + d.note, "待人工处理", t.id);
              DB.state.notify({ type: "人工决策", project: t.project, title: "任务 " + t.id + " 已缩小返工范围", reason: d.note, impact: "问题限定到该镜头，其余链路继续生产", state: "已决策", action: "按缩小后的范围重新提交", owner: "项目负责人", link: "tasks/list" });
              return { ok: true, msg: "已记录缩小返工范围的决策" };
            }
            const r = DB.state.retryTask(t.id);
            if (!r.ok) return r;
            DB.state.log("任务 " + t.id, "修正输入后重试：" + d.note, "成功", t.id);
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
      onSubmit(d) { return App.job({ title: "取消任务", steps: ["校验状态", "结算已发生费用"], run() { return DB.state.cancelTask(t.id, d.reason + "：" + d.note); } }); }
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
            DB.state.log("任务并发", "视频 " + d.v + " · 语音 " + d.a + " · 质检 " + d.q + "：" + d.note, "成功", "concurrency");
            return { ok: true, msg: "并发已更新：视频 " + d.v + " · 语音 " + d.a + " · 质检 " + d.q + "（队列页已同步）" };
          }
        });
      }
    });
  });
})();
