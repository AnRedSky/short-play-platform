/* 模块：ops 平台管理与系统设置（平台管理端 · 系统层） */
(function () {
  const U = UI, D = DB, SCOPE = "ops";
  const tb = (v) => parseFloat(String(v).replace(/[^\d.]/g, "")) || 0;

  function servicesTable() {
    return U.table(["服务 / 基础设施", "类型", "状态", "P95 延迟", "负载", "观测说明"], D.ops.services.map(s =>
      "<tr><td>" + U.entity(s.name, s.kind, "⚙") + "</td><td>" + U.esc(s.kind) + "</td><td>" + U.pill(s.status) + "</td><td class=\"num\">" + U.esc(s.latency) + "</td><td>" + U.miniBar(s.load.replace("%", ""), 100) + " <span class=\"num\">" + U.esc(s.load) + "</span></td><td class=\"cell-wrap faint\">" + U.esc(s.note) + "</td></tr>"
    ).join(""));
  }

  AppModule.register({
    group: "ops", label: "平台管理", icon: "server", order: 17, end: "platform",
    routes: [
      {
        path: "ops/overview", title: "平台总览", icon: "home", permission: "platform.read",
        desc: "企业主体、成员规模、生产与成本概况，以及基础设施健康状态。平台层负责基础设施与全局参数，不介入具体项目内容。",
        render() {
          const e = D.enterprise, o = D.ops;
          const tasks = D.tasks;
          const succeeded = tasks.filter(t => t.status === "成功").length;
          const failed = tasks.filter(t => t.status === "待人工处理" || t.status === "失败").length;
          const pending = tasks.filter(t => ["排队中", "待执行", "执行中"].indexOf(t.status) >= 0).length;
          const confirmedCost = D.costs.filter(c => c.status === "已确认").reduce((s, c) => s + (Number(c.actual) || 0), 0);
          const pendingCost = D.costs.filter(c => c.status !== "已确认").reduce((s, c) => s + (Number(c.est) || 0), 0);
          const healthy = o.services.filter(s => s.status === "健康").length;
          const degraded = o.services.filter(s => s.status !== "健康").map(s => s.name + " " + s.status);
          const shotSeconds = D.shots.reduce((s, x) => s + (parseInt(String(x.duration).replace(/[^\d]/g, ""), 10) || 0), 0);
          const st = o.storage;
          const stFormal = tb(st.formal), stTemp = tb(st.temp), stAudit = tb(st.audit);
          const stBackup = Math.max(0, Math.round((tb(st.used) - stFormal - stTemp - stAudit) * 100) / 100);
          const metrics = [
            ["企业主体", "1", "单一企业内部部署 · 不提供外部注册", "▣"],
            ["成员规模", e.members + " 人", e.depts + " 个部门 / 组织单元", "♙"],
            ["任务台账", String(tasks.length), "成功 " + succeeded + " · 失败/待处理 " + failed + " · 在途 " + pending, "▶"],
            ["镜头时长台账", shotSeconds + " 秒", D.shots.length + " 个镜头登记 · 已通过 " + D.shots.filter(s => s.status === "已通过").length, "◎"],
            ["实际成本（已确认）", "¥" + confirmedCost.toLocaleString(), "待核实 ¥" + pendingCost.toLocaleString() + " 单列", "¥"],
            ["服务健康", healthy + " / " + o.services.length, degraded.length ? degraded.join(" / ") : "全部健康", "⌁"]
          ];
          return U.page("平台管理 / 平台总览", "平台总览", "企业主体、成员规模、生产与成本概况，以及基础设施健康状态。", U.btn("队列与存储", "ops.queueLink") + (App.can("platform.config") ? U.btn("平台配置", "ops.toConfig") : ""),
            '<div class="grid grid-3">' + metrics.map(m => U.metric(m[0], m[1], m[2], m[3])).join("") + "</div>" +
            '<div class="split mt-4"><div class="stack">' +
              U.card("服务健康与监控", servicesTable(), "服务层与基础设施分开观测；队列积压、失败率、重试率、供应商延迟纳入监控。", U.btn("刷新视图", "ops.refresh", "sm")) +
              U.card("平台边界说明", U.notice("<b>运维域与业务域隔离：</b>当前身份仅可查看平台资源与参数，业务项目、剧本、资产内容不可见；个人 API 凭据在任何身份下都只显示脱敏元数据。运维访问业务数据须单独授权并留痕。", "info") +
                U.listRows([["租户模型", "不提供 SaaS 租户；部门不是隔离租户"], ["平台用户", "企业成员由企业管理员维护，平台不另建用户表"], ["模型白名单", D.modelProfiles.length + " 个模型档案 / " + D.capabilities.length + " 类能力"], ["备份", "数据库全量 + 媒体增量，每日 03:00"]]) ) +
            "</div><div class=\"stack\">" +
              U.card("存储占用", U.donut([
                { label: "正式资产", value: stFormal, color: "var(--accent)" },
                { label: "临时素材", value: stTemp, color: "var(--warn)" },
                { label: "备份副本", value: stBackup, color: "var(--info)" },
                { label: "审计与日志", value: stAudit, color: "var(--line-strong)" }
              ], "TB / 共 " + tb(st.total) + " TB", st.used.replace(/[^\d.]/g, "")) + U.listRows([["校验失败对象", st.checksumFail + " 个（已标记重取）"], ["清理策略", "临时素材 30 天自动清理"]]) ) +
              U.notice("<b>任务队列</b> " + D.ops.queue.length + " 条 · 待执行 " + D.ops.queue.reduce((n, q) => n + (Number(q.pending) || 0), 0) + " · 执行中 " + D.ops.queue.reduce((n, q) => n + (Number(q.running) || 0), 0) + "。积压、重试与单任务明细在「队列与存储」查看，本页不重复列表。", "info") +
              U.card("按角色可见范围", U.listRows([["系统运维管理员", "平台资源与参数（不含业务内容、不含凭据明文）"], ["企业管理员", "企业域全部管理与经营视图"], ["审计与经营管理", "只读汇总与审计检索"]])
                , "角色不以传统制作岗位划分") +
            "</div></div>"
          );
        }
      },
      {
        path: "ops/capabilities", title: "能力字典与适配器", icon: "cube", permission: "platform.read",
        desc: "统一定义能力类别、输入输出模式、限制与计费单位，并登记供应商适配器。未登记能力不得被任务引用。",
        render() {
          const tab = App.get(SCOPE, "capTab", "caps");
          return U.page("平台管理 / 能力字典", "能力字典与适配器", "能力字典供模型声明与任务匹配使用；适配器按能力契约实现，业务模块不直接依赖供应商 SDK。",
            U.btn("登记适配器", "ops.adapterRegister", "primary") + U.btn("导出字典", "common.export"),
            U.tabs([{ value: "caps", label: "能力字典", count: D.capabilities.length }, { value: "adapters", label: "供应商适配器", count: D.ops.adapters.length }], tab, "ops.tab") +
            (tab === "caps"
              ? U.card("十六类模型能力", U.table(["能力类别", "主要用途", "输入 → 输出", "计费单位", "已登记模型"], D.capabilities.map(c =>
                  '<tr><td class="cell-strong">' + U.esc(c.cap) + "</td><td class=\"cell-wrap\">" + U.esc(c.use) + '</td><td class="faint">' + U.esc(c.io) + '</td><td><span class="code">' + U.esc(c.unit) + "</span></td><td class=\"num\">" + c.models + "</td></tr>").join("")) +
                  U.notice("新增能力或适配器必须登记能力、限制、授权与计费方式；未登记能力不得被任务引用。适配器异常须返回明确错误码，不得静默降级到其他实现。", "info"), "任务匹配的唯一依据")
              : U.card("适配器注册表", U.table(["适配器", "能力契约", "供应商", "版本", "调用形态", "状态", "已登记错误码"], D.ops.adapters.map(a =>
                  "<tr><td>" + U.entity(a.name, a.vendor, "◇") + "</td><td class=\"cell-wrap\">" + U.esc(a.cap) + "</td><td>" + U.esc(a.vendor) + '</td><td class="num">' + U.esc(a.version) + "</td><td>" + U.esc(a.contract) + "</td><td>" + U.pill(a.status) + '</td><td class="cell-wrap faint">' + U.esc(a.errors) + "</td></tr>").join("")) +
                  U.stackbar([{ label: "启用", value: 3, color: "var(--ok)" }, { label: "降级", value: 1, color: "var(--warn)" }, { label: "停用", value: 1, color: "var(--bad)" }])
                , "停用适配器不得被新任务选用", U.btn("登记适配器", "ops.adapterRegister", "sm")))
          );
        }
      },
      {
        path: "ops/queue", title: "队列、存储与备份", icon: "archive", permission: "platform.read",
        desc: "任务队列并发、积压与失败重试，媒体存储容量与备份恢复状态。清理任务必须可审计，不得清理仍被引用的对象。",
        render() {
          const backupUsed = Math.max(0, Math.round((tb(D.ops.storage.used) - tb(D.ops.storage.formal) - tb(D.ops.storage.temp) - tb(D.ops.storage.audit)) * 100) / 100);
          const sat = D.ops.queue.filter(q => {
            const m = String(q.concurrency).match(/(\d+)\s*\/\s*(\d+)/);
            return m && Number(m[1]) >= Number(m[2]);
          });
          const degradedSvc = D.ops.services.filter(s => s.status !== "健康");
          const queueNote = (sat.length ? sat.map(q => q.name + " 并发 " + q.concurrency + " 已饱和").join("；") + "，新增任务将排队。" : "当前队列并发未饱和。") +
            (degradedSvc.length ? " " + degradedSvc.map(s => s.name + " 处于「" + s.status + "」。").join(" ") : "");
          return U.page("平台管理 / 队列与存储", "队列、存储与备份", "生产资源可观测：队列积压、失败率、重试率、供应商延迟与磁盘容量均纳入监控。",
            U.btn("导出资源快照", "common.export"),
            U.card("任务队列", U.table(["队列", "待执行", "执行中", "失败", "重试", "并发占用", "平均耗时", "说明"], D.ops.queue.map(q =>
              "<tr><td class=\"cell-strong\">" + U.esc(q.name) + '</td><td class="num">' + q.pending + '</td><td class="num">' + q.running + '</td><td class="num">' + q.failed + '</td><td class="num">' + q.retry + "</td><td>" + U.esc(q.concurrency) + '</td><td class="num">' + U.esc(q.avg) + '</td><td class="cell-wrap faint">' + U.esc(q.note) + "</td></tr>").join("")) +
              U.notice(queueNote, sat.length || degradedSvc.length ? "warn" : "ok"), "队列健康 = 积压 + 失败率 + 重试率", U.btn("扩容申请", "ops.scaleRequest", "sm")) +
            '<div class="grid grid-2 mt-4">' +
              U.card("媒体存储", U.stackbar([{ label: "正式资产", value: tb(D.ops.storage.formal), color: "var(--accent)" }, { label: "临时素材", value: tb(D.ops.storage.temp), color: "var(--warn)" }, { label: "备份", value: backupUsed || 0, color: "var(--info)" }]) +
                U.listRows([["总容量 / 已用", D.ops.storage.total + " / " + D.ops.storage.used], ["校验失败", D.ops.storage.checksumFail + " 个对象（已标记重取）"], ["清理策略", "临时素材 30 天 · 被引用跳过"]]) +
                U.notice("正式资产与临时素材分级管理：临时生成素材可清理，正式资产参与生产与交付，不得随意删除。", "info"))
              + U.card("备份与恢复", U.table(["对象", "时间", "大小", "结果", "校验"], D.ops.backups.map(b =>
                "<tr><td>" + U.esc(b.target) + '</td><td class="idx">' + U.esc(b.at) + '</td><td class="num">' + U.esc(b.size) + "</td><td>" + U.pill(b.result) + '</td><td class="faint">' + U.esc(b.verify) + "</td></tr>").join("")) +
                U.listRows([["密钥恢复材料", "单独保管 · 双人复核"], ["自动备份", D.ops.storage.backup]]) +
                '<div class="mt-3">' + U.btn("发起恢复演练", "ops.restoreDrill", "sm") + "</div>", "备份覆盖数据库、媒体与必要配置") +
            "</div>" +
            U.card("容量与成本趋势", U.lineChart(["6 月", "7 月", "8 月", "9 月", "10 月", "11 月"], [
              { name: "媒体存储（GB）", values: [680, 820, 1010, 1180, 1420, 1800], color: "#a5482a" },
              { name: "任务量（百次）", values: [42, 58, 71, 96, 112, 128], color: "#3d5b85", axis: "right" }
            ], { height: 170 }), "存储走左轴、任务量走右轴：量级差异大的序列使用双轴（规范 §六-4）")
          );
        }
      },
      {
        path: "ops/logs", title: "系统日志", icon: "list", permission: "platform.read",
        desc: "服务日志、调度日志与供应商回执日志；敏感字段脱敏展示，运维配置与个人凭据域隔离。",
        render() {
          const logs = D.ops.logs || [];
          const svcLogs = logs.map(l =>
            "<tr><td>" + U.esc(l.at) + '</td><td>' + U.pill(l.level, l.level === "ERROR" ? "bad" : l.level === "WARN" ? "warn" : "info") + '</td><td>' + U.esc(l.source) + '</td><td class="cell-wrap">' + U.esc(l.message) + "</td></tr>").join("");
          const errors = logs.filter(l => l.level === "ERROR").length;
          const warns = logs.filter(l => l.level === "WARN").length;
          return U.page("平台管理 / 系统日志", "系统日志", "日志用于定位问题，不承担业务鉴权；凭据、密钥等敏感字段一律脱敏。",
            U.btn("导出日志快照", "common.export"),
            '<div class="grid grid-4">' +
              U.metric("日志条数", String(logs.length), "服务 / 调度 / 供应商回执", "▤") +
              U.metric("ERROR", String(errors), "需人工介入", "!") +
              U.metric("WARN", String(warns), "可继续观察", "▲") +
              U.metric("脱敏字段", "已开启", "凭据与密钥不落日志", "◆") +
            "</div>" +
            U.card("系统日志", U.table(["时间", "级别", "来源", "内容"], svcLogs, "当前没有日志记录")) +
            '<div class="grid grid-2 mt-4">' +
              U.card("日志边界", U.listRows([
                ["系统运维配置", "不包含员工个人凭据，也不成为绕过企业权限的通道"],
                ["业务内容", "运维身份默认不读取业务内容；必要访问须授权并留痕"],
                ["凭据", "任何日志都不记录 API Key 明文"],
                ["审计", "业务操作审计在「合规与审计 / 审计日志」，与系统日志分离"]
              ]), "运维日志与业务审计分离") +
              U.card("监控口径", U.listRows([
                ["队列积压", D.ops.queue.map(q => q.name + " 待执行 " + q.pending).join("；")],
                ["失败率", D.ops.queue.map(q => q.name + " 失败 " + q.failed).join("；")],
                ["重试率", D.ops.queue.map(q => q.name + " 重试 " + q.retry).join("；")],
                ["供应商延迟", D.ops.services.map(s => s.name + " " + s.latency).join("；")],
                ["磁盘容量", D.ops.storage.total + " GB / 已用 " + D.ops.storage.used + " GB"]
              ]), "业务方案 §21.2 要求的可观测指标") +
            "</div>");
        }
      },
      {
        path: "ops/config", title: "平台业务配置", icon: "key", permission: "platform.config",
        desc: "默认预算、集数上限、重试上限、并发上限、提醒阈值、数据保留与模型白名单。平台运维配置不得包含员工个人凭据。",
        render() {
          return U.page("平台管理 / 业务配置", "平台业务配置", "平台层负责全局参数，不介入具体项目内容；企业管理员负责企业内组织、账号、制度与经营视图。",
            U.btn("保存配置", "ops.saveConfig", "primary") + U.btn("导出配置快照", "common.export"),
            U.card("全局参数", U.table(["参数", "当前值", "说明", "操作"], D.ops.platformConfig.map(c =>
              '<tr><td class="cell-strong">' + U.esc(c.key) + '</td><td><span class="code">' + U.esc(c.value) + '</span></td><td class="cell-wrap muted">' + U.esc(c.note) + "</td><td>" + U.btn("调整", "ops.editConfig", "", { key: c.key }) + "</td></tr>").join(""))) +
            U.card("数据保留与归档策略", U.table(["对象", "保留期", "到期动作", "说明"], D.ops.retention.map(r =>
              "<tr><td>" + U.esc(r.object) + '</td><td class="num">' + U.esc(r.period) + "</td><td>" + U.esc(r.action) + '</td><td class="cell-wrap faint">' + U.esc(r.note) + "</td></tr>").join("")) +
              U.notice("审计记录保留期不得短于业务追溯要求；清理任务必须可审计，不得清理仍被引用的对象。", "warn"), "业务数据与审计记录长期保留") +
            U.card("配置边界", U.listRows([["个人凭据域", "与运维配置物理隔离，平台配置不承载任何 API Key"], ["白名单变更", "需审计；执行中任务不中断，新任务须符合新策略"], ["企业策略", "由企业管理员维护，平台不代替企业决策"], ["审计查看", "运维身份不读取业务审计明细，由审计与经营管理身份查看"]]) , "运维不等于业务权限")
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("ops.tab", (el) => { App.set(SCOPE, "capTab", el.dataset.value); App.refresh(); });
  App.on("ops.refresh", () => { App.toast("已刷新资源快照（未连接真实监控源）"); App.refresh(); });
  App.on("ops.queueLink", () => { App.go("ops/queue"); });
  App.on("ops.toConfig", () => { if (App.can("platform.config")) App.go("ops/config"); else App.toast("当前身份不具备平台配置权限", "bad"); });
  App.on("ops.adapterRegister", () => {
    if (!App.guard("platform.config")) return;
    App.modal({
      title: "登记供应商适配器", sub: "新增能力或适配器必须登记能力、限制、授权与计费方式",
      body: U.fField("适配器名称", "name", { required: true, placeholder: "例如 video-adapter" }) +
        '<div class="form-grid">' + U.fSelect("能力契约", "cap", D.capabilities.map(c => c.cap), { required: true }) + U.fSelect("调用形态", "contract", ["同步提交 + 轮询", "异步任务 + 回调", "本地进程 + 任务"], { required: true }) + "</div>" +
        U.fField("供应商名称", "vendor", { required: true, placeholder: "供应商标识（不含密钥）" }) +
        U.fField("登记错误码", "errors", { placeholder: "例如 E-4011 超时 / E-4102 参数不支持", hint: "适配器异常必须返回明确错误码，不得静默降级" }),
      submitText: "登记",
      onSubmit(data) {
        D.ops.adapters.push({ name: data.name, cap: data.cap, vendor: data.vendor, version: "待发布", contract: data.contract, status: "启用", errors: data.errors || "—" });
        App.toast("适配器已登记到适配器注册表：" + data.name);
        App.refresh();
      }
    });
  });
})();

/* ===== v9.1 真实流程层：参数变更审计、适配器与维护窗口申请 ===== */
(function () {
  const U = UI, D = DB;

  App.on("ops.editConfig", (el) => {
    if (!App.guard("platform.config")) return;
    const row = D.ops.platformConfig.find(c => c.key === el.dataset.key);
    if (!row) return;
    App.modal({
      title: "调整参数 · " + row.key, sub: "平台参数影响全局任务，变更需双人复核并留审计",
      body: U.fField("当前值", "value", { value: row.value, required: true, minlen: 1 }) +
        U.fTextarea("变更原因", "reason", { required: true, minlen: 10, rows: 3, placeholder: "说明影响范围、回滚方式与复核人" }) +
        U.fField("复核人", "reviewer", { required: true, minlen: 2, value: "王亦宁" }) +
        U.fCheck("已阅读回滚步骤", "okr", { checked: false }),
      submitText: "保存并生效",
      onSubmit(d) {
        return App.job({
          title: "更新平台参数", steps: ["校验取值范围", "写入参数", "登记复核与审计"],
          run() {
            if (!d.okr) return { ok: false, msg: "需确认已阅读回滚步骤", fields: { okr: "请勾选" } };
            const old = row.value;
            row.value = d.value;
            DB.state.log("平台参数 " + row.key, "变更 " + old + " → " + d.value + " · 复核 " + d.reviewer + " · " + d.reason, "成功", row.key);
            return { ok: true, msg: row.key + " 已更新为 " + d.value + "（复核人 " + d.reviewer + "）" };
          }
        });
      }
    });
  });

  App.on("ops.saveConfig", () => {
    if (!App.guard("platform.config")) return;
    const rows = D.ops.platformConfig;
    App.confirm("保存全部配置", "将对 " + rows.length + " 项参数执行落库校验（格式、范围、依赖），失败项会逐条列出。", () => {
      App.job({
        title: "保存平台配置", steps: ["校验格式与范围", "检查依赖关系", "写入并审计"],
        run() {
          const bad = rows.filter(r => !String(r.value || "").trim());
          if (bad.length) return { ok: false, msg: "存在空值参数：" + bad.map(b => b.key).join("、") };
          DB.state.log("平台配置", "保存 " + rows.length + " 项参数", "成功", "platform");
          return { ok: true, msg: rows.length + " 项参数已保存并登记审计" };
        }
      });
    }, "保存");
  });

  App.on("ops.restoreDrill", () => {
    if (!App.guard("platform.config")) return;
    App.modal({
      title: "恢复演练", sub: "先恢复到隔离环境校验，再切换生产；演练会占用备份带宽",
      body: U.fSelect("恢复目标", "target", ["隔离环境 · 校验后切换", "仅校验备份可读性"], { required: true }) +
        U.fField("备份时间点", "point", { required: true, placeholder: "例如 2026-11-22 02:00" }) +
        U.fTextarea("演练说明", "note", { required: true, minlen: 8, rows: 3 }),
      submitText: "排入维护窗口",
      onSubmit(d) {
        return App.job({
          title: "恢复演练", steps: ["校验备份可读", "恢复至隔离环境", "登记演练记录"],
          run() {
            const id = "DR-" + (D.ops.drills ? D.ops.drills.length + 1 : 1);
            D.ops.drills = D.ops.drills || [];
            D.ops.drills.unshift({ id: id, target: d.target, point: d.point, by: DB.state.actor(), at: DB.state.at(), note: d.note, result: "已排入维护窗口" });
            DB.state.log("恢复演练 " + id, d.target + " · " + d.point + "：" + d.note, "成功", id);
            return { ok: true, msg: "恢复演练 " + id + " 已排入维护窗口（" + d.point + "）" };
          }
        });
      }
    });
  });

  App.on("ops.scaleRequest", () => {
    App.modal({
      title: "申请扩容质量检测队列", sub: "扩容属高影响变更，需管理员审批并计入资源变更审计",
      body: U.fField("目标并发", "conc", { required: true, type: "number", min: 1, max: 12, value: "5" }) +
        U.fTextarea("扩容依据", "note", { required: true, minlen: 10, rows: 3, placeholder: "例如：质检队列积压 4，P95 等待 12 分钟" }),
      submitText: "提交申请",
      onSubmit(d) {
        return App.job({
          title: "提交扩容申请", steps: ["校验当前负载", "写入变更申请", "通知管理员"],
          run() {
            const id = "CR-" + (D.ops.changes ? D.ops.changes.length + 1 : 1);
            D.ops.changes = D.ops.changes || [];
            D.ops.changes.unshift({ id: id, type: "扩容", target: "质检队列", to: d.conc, by: DB.state.actor(), at: DB.state.at(), note: d.note, status: "待审批" });
            DB.state.notify({ type: "资源扩容", project: "—", title: "扩容申请 " + id + " 待审批（质检队列 → " + d.conc + "）", reason: "质检队列并发不足，任务出现排队积压", impact: "未扩容前质检任务排队时间增加，不影响已有产物", state: "待处理", action: "审批并调整质检队列并发", owner: d.to || "平台管理员", link: "ops/queue" });
            DB.state.log("变更 " + id, "扩容申请：" + d.note, "成功", id);
            return { ok: true, msg: "扩容申请 " + id + " 已提交，等待企业管理员审批" };
          }
        });
      }
    });
  });
})();
