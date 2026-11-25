/* 模块：compliance 授权、风险与审计 */
(function () {
  const U = UI, D = DB, SCOPE = "compliance";

  /* ---------- 处置（原 notify/incidents，B2·M8 并入风险与异常的「处置」tab） ----------
     异常按影响范围局部暂停，不整项目静默全停；处理必须留下决策、责任人与下一步。 */
  const incidentBlock = (p) => {
    const visPids = DB.derived.visibleProjects().map(x => x.id);
    const inc = p ? D.incidents.filter(i => i.project === p.id) : D.incidents.filter(i => visPids.indexOf(i.project) >= 0);
    const open = inc.filter(i => i.result !== "已闭环");
    const escalatedInc = inc.filter(i => String(i.level).indexOf("升级") >= 0);
    const incProjects = [...new Set(inc.map(i => i.project))];
    const rows = inc.map(i => {
      const pj = D.projects.find(x => x.id === i.project);
      return '<tr><td>' + U.code(i.id) + "</td><td>" + U.esc(i.project) + '<div class="faint small">' + U.pill(pj ? pj.status : "待确认") + '</div></td><td class="cell-wrap">' + U.esc(i.type) + '<div class="faint small">' + U.pill(i.level, i.level.indexOf("企业") >= 0 ? "bad" : "info") + '</div></td><td class="idx">' + U.esc(i.first) + "<br>" + U.esc(i.last) + '<div class="faint small">' + U.esc(String(i.handled || 0)) + ' 次</div></td><td class="cell-wrap">' + U.esc(i.action) + '</td><td class="cell-wrap muted">' + U.esc(i.decision) + "</td><td class=\"cell-wrap\">" + U.esc(i.next) + '<div class="faint small">结果：' + U.esc(i.result) + "</div></td><td>" +
        U.btn("处置", "notify.incidentAction", "sm", { id: i.id }) + "</td></tr>";
    }).join("");
    return '<div class="grid grid-4">' +
        U.metric("未闭环", String(open.length), "可见异常 " + inc.length + " 项", "!") +
        U.metric("处理中", String(inc.filter(i => i.result === "处理中").length), "已派发处置动作", "+") +
        U.metric("已升级", String(escalatedInc.length), "超出项目内处置范围", "↑") +
        U.metric("涉及项目", String(incProjects.length), "非成员项目异常不展示", "▤") +
      "</div>" +
      U.card("异常台账", U.table(["异常", "项目 · 状态", "类型 · 级别", "首次 / 最近 · 次数", "处置动作", "决策与责任人", "下一步 · 结果", "操作"], rows, "异常关闭需回写结果与验证方式"), "级别并入类型、处理次数并入时间、项目状态并入项目") +
      '<div class="grid grid-2 mt-4">' +
        U.card("处置原则", U.listRows([
          ["局部优先", "仅暂停受影响镜头 / 任务链路，其余镜头继续生产"],
          ["不静默", "任何暂停、降级、切换模型都必须通知到责任人与配置人"],
          ["不覆盖", "返工产生新尝试与新资产版本，原结果保留可追溯"],
          ["费用", "失败、重试与取消均入账，不因异常而丢失成本记录"],
          ["闭环", "关闭异常需给出验证方式与验证结果"]
        ]), "异常处理结果进入项目生命周期记录") +
        U.card("高频异常与处置口径", U.table(["异常类型", "建议处置"], [
          ["合规高风险", "阻断下游 → 替换素材 / 调整提示词 → 重生成 → 抽检"],
          ["人物严重不一致", "重建参考资产 → 局部重生成 → 与相邻镜头比对"],
          ["模型不可用 / 鉴权失败", "暂停依赖任务 → 配置人更新凭据 → 重做可用性检查"],
          ["预算触发", "暂停高成本任务 → 调整预算或缩减范围 → 记录决策"],
          ["质量阻断", "按镜头返工，不整集重跑；保留原报告"]
        ].map(r => "<tr><td class=\"cell-strong\">" + r[0] + '</td><td class="cell-wrap muted">' + r[1] + "</td></tr>").join("")), "处置建议不等于自动执行") +
      "</div>";
  };
  function auditTokens(pids) {
    const tokens = [];
    const add = (v) => { const s = String(v || ""); if (s && tokens.indexOf(s) < 0) tokens.push(s); };
    (pids || []).forEach(pid => {
      add(pid); add(String(pid).replace("SP-", ""));
      D.tasks.filter(t => t.project === pid).forEach(t => add(t.id));
      (D.assets || []).filter(a => a.project === pid).forEach(a => add(a.id));
      D.deliveries.filter(x => x.project === pid).forEach(x => add(x.id));
      D.rights.filter(r => r.project === pid).forEach(r => add(r.id));
    });
    return tokens;
  }

/* 审计事件类型 → 匹配关键词（业务方案 §16.8 的 11 类事件类型按动作语义归类） */
  const AUDIT_TYPE_KEYS = {
    "登录与身份变化": ["登录", "身份", "会话", "账号"],
    "角色与权限调整": ["角色", "权限", "授权"],
    "项目创建 / 移交 / 归档 / 终止": ["创建项目", "移交", "归档", "终止"],
    "个人凭据配置变更（仅元数据）": ["凭据", "资源配置", "连通性"],
    "模型路由变化": ["模型", "路由", "切换"],
    "任务提交 / 重试 / 取消 / 暂停": ["任务", "提交", "重试", "取消", "暂停"],
    "预算与费用修正": ["预算", "费用", "成本"],
    "资产下载 / 删除 / 导出": ["资产", "导出", "删除"],
    "审核结论": ["审核", "通过", "退回", "终审"],
    "交付执行": ["交付"],
    "数据导出": ["导出"]
  };
  function matchAuditType(a, type) {
    const keys = AUDIT_TYPE_KEYS[type];
    if (!keys) return true;
    const hay = String(a.action || "") + " " + String(a.object || "");
    return keys.some(k => hay.indexOf(k) >= 0);
  }

  AppModule.register({
    group: "compliance", label: "合规与审计", icon: "shield", order: 15, end: "workspace",
    routes: [
      {
        path: "compliance/rights", title: "权利与授权台账", icon: "shield", permission: "compliance.read",
        desc: "授权台账登记来源、证明、使用范围、区域、期限与限制；无证明或来源不明一律阻断交付。",
        render(query) {
          const pid = (query && query.id) || "";
          const p = pid ? (D.projects.find(x => x.id === pid) || null) : null;
          if (pid && (!p || !DB.derived.canViewProject(p))) return U.page("合规与审计 / 权利与授权", "项目授权不在可见范围", "只能查看自己负责、参与或经授权项目的授权台账；跨项目授权不渲染。", U.btn("返回项目列表", "common.projects", "primary"), U.empty("无法读取授权台账", "项目不存在或当前身份不可见。"));
          const visPids = DB.derived.visibleProjects().map(x => x.id);
          const scoped = pid ? D.rights.filter(r => r.project === pid || !r.project) : D.rights.filter(r => !r.project || visPids.indexOf(r.project) >= 0);
          const rows = scoped.map(r =>
            '<tr><td>' + U.code(r.id) + "</td><td>" + U.esc(r.project || "平台级") + '<div class="faint small">' + U.esc(r.subject) + '</div></td><td>' + U.esc(r.type) + '</td><td>' + U.esc(r.owner) + '<div class="faint small cell-wrap">' + U.esc(r.proof) + '</div></td><td class="cell-wrap">' + U.esc(r.use) + '<div class="faint small">' + U.esc(r.region) + '</div></td><td>' + U.esc(r.term) + '</td><td class="cell-wrap">' + U.esc(r.commercial) + " · " + U.pill(r.review) + "</td><td>" + U.pill(r.status) + "</td><td>" +
            U.btn("详情", "compliance.rightDetail", "sm", { id: r.id }) + "</td></tr>").join("");
          const blocked = scoped.filter(r => String(r.status).indexOf("阻断") >= 0);
          const expiring = scoped.filter(r => String(r.status).indexOf("到期") >= 0);
          const bad = blocked[0];
          const soon = expiring[0];
          const typeCounts = {};
          scoped.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
          return U.page("合规与审计 / 权利与授权" + (p ? " · " + p.name : ""), "权利与授权台账", "授权复核有期限：到期前 30 天必须提醒并复核，过期未续即视为不可用。",
            (App.can("compliance.write") ? U.btn("新增授权记录", "compliance.newRight", "primary", p ? { id: p.id } : {}) : "") + U.btn("风险视图", "compliance.toRisks", "", p ? { id: p.id } : {}) + U.btn("导出台账", "common.export"),
            '<div class="grid grid-4">' +
              U.metric("授权记录", String(scoped.length), p ? "当前项目 + 平台条款" : "内容 / 声音 / 音乐 / 字体 / 条款", "▤") +
              U.metric("有效", String(scoped.filter(r => r.status === "有效").length), "可直接使用", "✓") +
              U.metric("快到期", String(expiring.length), soon ? soon.id + " · " + soon.subject : "当前范围没有到期项", "!") +
              U.metric("阻断交付", String(blocked.length), bad ? bad.id + " · " + bad.subject : "当前范围没有阻断", "×") +
            "</div>" +
            U.card("授权台账 · " + scoped.length + " 项" + (p ? " · " + U.esc(p.name) : ""), U.table(["编号", "项目 · 对象", "类型", "权利人 / 证明", "使用范围 · 区域", "期限", "商用性 · 复核", "状态", "操作"], rows, "当前项目没有授权记录"), "证明与区域并入对应列；完整字段在「详情」抽屉") +
            '<div class="split mt-4"><div class="stack">' +
              (bad ? U.card(bad.id + " · 阻断交付", U.notice(bad.subject + "：来源或证明缺失，当前项目交付已被阻断；补授权或替换素材后才能解除。", "bad") +
                '<div class="btn-row-inline">' + U.btn("登记续期", "compliance.renew", "sm", { id: bad.id }) + U.btn("替换素材", "compliance.replace", "sm", { id: bad.id }) + "</div>", "来源不明不得交付")
                : U.card("交付阻断", U.notice("当前范围没有阻断交付的授权记录。", "ok"), "按项目实时计算")) +
              U.card("授权有效期规则", U.listRows([["复核周期", "长期授权每 12 个月复核一次"], ["到期提醒", "到期前 30 天提醒权利人使用者"], ["到期后果", "阻止新生成，已交付内容不受影响"], ["续期", "登记新证明后解除阻断"]]) , "到期不等于自动失效") +
            '</div><div class="stack">' +
              (soon ? U.card(soon.id + " · 快到期的授权", U.desc([["对象", soon.subject], ["证明", soon.proof], ["期限", soon.term], ["商用性", soon.commercial], ["限制", soon.limit], ["状态", soon.status]]) +
                '<div class="btn-row-inline">' + U.btn("登记续期", "compliance.renew", "sm", { id: soon.id }) + U.btn("停用", "compliance.disable", "sm", { id: soon.id }) + "</div>", "到期前必须续期或替换")
                : U.card("到期提醒", U.notice("当前范围没有 30 天内到期的授权。", "ok"), "按项目实时计算")) +
              U.card("权利类型分布", U.donut(Object.keys(typeCounts).map((k, i) => ({ label: k, value: typeCounts[k], color: i % 3 === 0 ? "var(--accent)" : i % 3 === 1 ? "var(--warn)" : "var(--info)" })), "记录", String(scoped.length)), "按权利类型计") +
            "</div></div>"
          );
        }
      },
      {
        path: "compliance/risks", title: "风险与异常", icon: "alert", permission: "compliance.read",
        desc: "风险按等级与处置动作管理：高风险阻断下游，中等风险局部返工，低风险提醒并观察。",
        render(query) {
          const pid = (query && query.id) || "";
          const p = pid ? (D.projects.find(x => x.id === pid) || null) : null;
          if (pid && (!p || !DB.derived.canViewProject(p))) return U.page("合规与审计 / 风险与异常", "项目风险不在可见范围", "只能查看自己负责、参与或经授权项目的风险与异常；跨项目记录不渲染。", U.btn("返回项目列表", "common.projects", "primary"), U.empty("无法读取风险记录", "项目不存在或当前身份不可见。"));
          const visPids = DB.derived.visibleProjects().map(x => x.id);
          const risks = pid ? D.risks.filter(r => r.project === pid) : D.risks.filter(r => visPids.indexOf(r.project) >= 0);
          const incidents = pid ? D.incidents.filter(i => i.project === pid) : D.incidents.filter(i => visPids.indexOf(i.project) >= 0);
          const rows = risks.map(r =>
            '<tr><td>' + U.code(r.id) + "</td><td>" + U.esc(r.project) + "</td><td>" + U.esc(r.type) + '<div class="faint small">' + U.pill(r.level) + '</div></td><td class="cell-wrap">' + U.esc(r.where) + "</td><td>" + U.pill(r.status) + '<div class="faint small">' + U.esc(r.at) + '</div></td><td class="cell-wrap">' + U.esc(r.action) + "</td><td>" + U.esc(r.owner) + "</td><td>" +
            U.btn("详情", "compliance.riskDetail", "sm", { id: r.id }) + "</td></tr>").join("");
          const openRisks = risks.filter(r => String(r.status).indexOf("已") < 0);
          const high = risks.filter(r => r.level === "高");
          const openInc = incidents.find(i => String(i.result).indexOf("已") < 0);
          const tab = App.get(SCOPE, "tab", "risks");
          const tabsBar = U.card("", U.tabs([{ value: "risks", label: "风险清单", count: risks.length }, { value: "dispose", label: "处置", count: incidents.filter(i => String(i.result) !== "已闭环").length }], tab, "compliance.tab"));
          return U.page("合规与审计 / 风险与异常" + (p ? " · " + p.name : ""), tab === "dispose" ? "异常处置" : "风险与异常", tab === "dispose" ? "异常来源：重试达上限、资源不可用、预算触发、合规高风险、质量阻断。" : "异常事件保留处理轮次与决策人；升级规则明确（4 小时未处理自动升级）。",
            (App.can("compliance.write") ? U.btn("登记风险", "compliance.newRisk", "primary", p ? { id: p.id } : {}) : "") + U.btn("审计日志", "compliance.toAudit", "", p ? { id: p.id } : {}),
            tabsBar + (tab === "dispose" ? incidentBlock(p) : '<div class="grid grid-4">' +
              U.metric("未闭环风险", String(openRisks.length), p ? "当前项目" : "全库", "!") +
              U.metric("高风险", String(high.length), high.length ? "阻断下游" : "当前没有高风险", "×") +
              U.metric("异常事件", String(incidents.length), openInc ? "含未闭环事件" : "全部已闭环", "◐") +
              U.metric("升级规则", "4 小时", "未处理自动升级", "⏱") +
            "</div>" +
            U.card("风险清单 · " + risks.length + " 项" + (p ? " · " + U.esc(p.name) : ""), U.table(["风险", "项目", "类型 · 等级", "定位", "状态 · 发现时间", "处置动作", "负责人", "操作"], rows, "当前项目没有风险记录")) +
            '<div class="grid grid-2 mt-4">' +
              U.card("等级与处置", U.table(["等级", "处置", "是否阻断"], [
                ["高", "阻断下游全部动作", "是"],
                ["中", "局部返工，其余继续", "否"],
                ["低", "提醒并观察", "否"]
              ].map(r => "<tr><td>" + U.pill(r[0]) + '</td><td class="cell-wrap">' + r[1] + '</td><td>' + U.pill(r[2], r[2] === "是" ? "bad" : "ok") + "</td></tr>").join("")), "阻断范围要写清") +
              (openInc ? U.card(openInc.id + " · 未闭环", U.notice(openInc.project + " " + openInc.type + "：" + openInc.action + "，当前结果为「" + openInc.result + "」。", "bad") + U.listRows([["首次", openInc.at || "未记录"], ["处理轮次", String(openInc.rounds || 1) + " 次"], ["最近更新", openInc.updated || "未记录"], ["下一步", openInc.next]]) , "未闭环事件每日跟踪")
                : U.card("未闭环事件", U.notice("当前范围没有未闭环异常事件。", "ok"), "按项目实时计算")) +
            "</div>)")
          );
        }
      },
      {
        path: "compliance/audit", title: "审计日志", icon: "list", permission: "compliance.read",
        desc: "审计覆盖 11 类事件；日志只增不改，凭据类事件仅记录元数据，不记录明文。",
        render(query) {
          const pid = (query && query.id) || "";
          const p = pid ? (D.projects.find(x => x.id === pid) || null) : null;
          if (pid && (!p || !DB.derived.canViewProject(p))) return U.page("合规与审计 / 审计日志", "项目日志不在可见范围", "只能查看自己负责、参与或经授权项目的审计日志；跨项目日志不渲染。", U.btn("返回项目列表", "common.projects", "primary"), U.empty("无法读取审计日志", "项目不存在或当前身份不可见。"));
          const allScope = App.can("audit.read");
          const pids = pid ? [pid] : (allScope ? null : DB.derived.visibleProjects().map(x => x.id));
          const tokens = pids ? auditTokens(pids) : null;
          const base = tokens
            ? D.audits.filter(a => tokens.some(t => (a.object + " " + a.action + " " + a.link).indexOf(t) >= 0))
            : D.audits;
          const kw = App.get(SCOPE, "kw", "");
          /* 审计检索维度（业务方案 §16.8）：时间范围、事件类型、对象类型、员工 */
          const from = App.get(SCOPE, "from", "");
          const to = App.get(SCOPE, "to", "");
          const etype = App.get(SCOPE, "etype", "全部");
          const actorName = App.get(SCOPE, "actor", "");
          const byType = base.filter(a => {
            if (etype !== "全部" && !matchAuditType(a, etype)) return false;
            if (actorName && a.actor.indexOf(actorName) < 0) return false;
            const day = String(a.time || "").slice(0, 10);
            if (from && day < from) return false;
            if (to && day > to) return false;
            return true;
          });
          const list = byType.filter(a => !kw || (a.actor + a.object + a.action).indexOf(kw) >= 0);
          const rows = list.map(a =>
            '<tr><td>' + U.esc(a.time) + "</td><td>" + U.entity(a.actor, a.result, a.actor.slice(0, 1)) + '</td><td class="cell-wrap">' + U.esc(a.object) + "</td><td>" + U.esc(a.action) + '</td><td>' + U.esc(a.src) + "</td><td>" + U.code(a.link) + "</td></tr>").join("");
          const toolbar = '<div class="toolbar"><span class="field-wrap"><input class="field" data-filter="compliance.kw" name="kw" placeholder="搜索操作人 / 对象 / 动作" value="' + U.esc(kw) + '"></span>' +
            '<span class="field-wrap"><input class="field" type="date" name="from" data-filter="compliance.from" data-filter-mode="state" value="' + U.esc(from) + '" title="起始日期"></span>' +
            '<span class="field-wrap"><input class="field" type="date" name="to" data-filter="compliance.to" data-filter-mode="state" value="' + U.esc(to) + '" title="结束日期"></span>' +
            '<span class="field-wrap"><input class="field" data-filter="compliance.actor" data-filter-mode="state" name="actor" placeholder="按操作人筛选" value="' + U.esc(actorName) + '"></span>' +
            '<span class="grow"></span>' + U.seg(["全部"].concat(D.auditTypes), etype, "compliance.etype") +
            (App.can("audit.export") ? U.btn("导出日志", "compliance.exportAudit", "primary") : U.btn("导出日志", "common.export", "primary")) + "</div>";
          return U.page("合规与审计 / 审计日志" + (p ? " · " + p.name : ""), "审计日志", "日志用于追溯而非考核；导出本身也是一次审计事件。",
            U.btn("授权台账", "compliance.toRights", "", p ? { id: p.id } : {}) + U.btn("风险视图", "compliance.toRisks", "", p ? { id: p.id } : {}),
            U.card("日志 · 当前 " + list.length + " 条" + (p ? " · " + U.esc(p.name) : (allScope ? " · 全企业" : " · 我负责的项目")), toolbar + U.table(["时间", "操作人", "对象", "动作", "来源", "关联"], rows, pid ? "当前项目没有匹配的审计日志" : (allScope ? "无匹配日志" : "当前可见项目没有匹配的审计日志")), "日志只增不改，操作即留痕") +
            '<div class="grid grid-2 mt-4">' +
              U.card("11 类审计事件", U.table(["事件类型"], D.auditTypes.map((t, i) => '<tr><td class="num">' + (i + 1) + '</td><td class="cell-wrap">' + U.esc(t) + "</td></tr>")), "全部需记录") +
              U.notice("口径与规则见《口径与规则汇总》§R-10：留痕规则", "info") +
            "</div>"
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("compliance.toRights", (el) => { const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id; App.go("compliance/rights", pid ? { id: pid } : undefined); });
  App.on("compliance.toRisks", (el) => { const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id; App.go("compliance/risks", pid ? { id: pid } : undefined); });
  App.on("compliance.toAudit", (el) => { const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id; App.go("compliance/audit", pid ? { id: pid } : undefined); });
  App.on("compliance.tab", (el) => { App.set(SCOPE, "tab", el.dataset.value || "risks"); App.refresh(); });
  App.on("compliance.etype", (el) => { App.set(SCOPE, "etype", el.dataset.value); App.refresh(); });
  /* 审计导出：导出行为本身也是审计事件（业务方案 §16.8） */
  App.on("compliance.exportAudit", (el) => {
    if (!App.guard("audit.export")) return;
    const rows = D.audits.length;
    App.confirm("导出审计日志", "将导出 " + rows + " 条审计记录（含时间、操作人、对象、动作、来源与关联 ID）。导出动作本身也会写入审计。", () => {
      DB.state.log("审计日志", "导出审计日志（" + rows + " 条）", "成功", "AUDIT-EXPORT");
      App.exportCsv("audit-log.csv");
      App.refresh();
    }, "确认导出");
  });
  App.on("compliance.newRight", (el) => {
    if (!App.guard("compliance.write")) return;
    const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id || "";
    App.modal({
      wide: true,
      title: "新增授权记录", sub: "证明编号与使用范围必填；平台级条款仅企业管理员可登记",
      body: U.fSelect("归属", "project", (App.can("org.manage") ? [{ value: "", label: "平台级条款（所有项目适用）" }] : []).concat(DB.derived.visibleProjects().map(x => ({ value: x.id, label: x.id + " · " + x.name }))), { value: pid || (DB.derived.visibleProjects()[0] || {}).id }) +
        U.fField("授权对象", "subject", { required: true }) + U.fSelect("类型", "type", ["生成内容", "声音", "音乐", "字体", "模型条款", "第三方素材"], { required: true }) +
        U.fField("权利人", "owner", { required: true }) + U.fField("证明编号", "proof", { required: true }) +
        U.fField("使用范围", "use", { required: true }) + U.fSelect("区域", "region", ["中国大陆", "全球", "境内"]) +
        U.fField("期限", "term", { placeholder: "例如 长期 / 至 2027-12-31" }) + U.fSelect("商用性", "commercial", ["可商用", "可商用 · 不含二次销售", "不可商用", "不明确"]),
      submitText: "登记",
      onSubmit(d) {
        if (d.commercial === "不明确") { App.toast("商用性不明确不能登记为可用授权", "bad"); return false; }
        if (d.project) {
          const target = D.projects.find(x => x.id === d.project);
          if (!target || !DB.derived.canViewProject(target)) { App.toast("归属项目不存在或不在当前身份可见范围", "bad"); return false; }
        }
        const n = D.rights.reduce((m, x) => { const hit = String(x.id).match(/^RT-(\d+)$/); return hit ? Math.max(m, Number(hit[1])) : m; }, 0) + 1;
        D.rights.push({ id: "RT-" + String(n).padStart(2, "0"), project: d.project || undefined, subject: d.subject, type: d.type, owner: d.owner, proof: d.proof, use: d.use, region: d.region, term: d.term || "长期", commercial: d.commercial, limit: "未登记", review: "待复核", status: "待复核" });
        DB.state.log("授权 " + d.subject, "登记授权：" + (d.project || "平台级"), "成功", d.project || "平台级");
        App.toast("授权已登记：" + d.subject); App.refresh();
      }
    });
  });
})();

/* ===== v9.1 真实流程层：授权台账与风险闭环 ===== */
(function () {
  const U = UI, D = DB;
  const canSeeProject = (pid) => {
    if (!pid) return true;
    const p = D.projects.find(x => x.id === pid);
    return !!p && DB.derived.canViewProject(p);
  };
  const rightById = (id) => {
    const r = D.rights.find(x => x.id === id);
    return r && canSeeProject(r.project) ? r : null;
  };
  const riskById = (id) => {
    const r = D.risks.find(x => x.id === id);
    return r && canSeeProject(r.project) ? r : null;
  };

  App.on("compliance.rightDetail", (el) => {
    const r = rightById(el.dataset.id);
    if (!r) { App.toast("该授权记录不在当前可见范围", "bad"); return; }
    App.drawer("授权 · " + r.id, U.desc([["对象 · 项目", r.subject + " · " + (r.project || "平台级")], ["类型 · 权利方", r.type + " · " + r.owner], ["使用范围 · 区域", r.use + " · " + r.region], ["期限 · 商用", r.term + " · " + r.commercial], ["限制", r.limit], ["凭证", r.proof], ["复核 · 状态", r.review + " · " + r.status]]) +
      '<div class="btn-row-inline">' + U.btn("登记续期", "compliance.renew", "primary", { id: r.id }) + U.btn("替换素材", "compliance.replace", "", { id: r.id }) +
      (r.status === "有效" ? U.btn("停用", "compliance.disable", "sm", { id: r.id }) : "") + "</div>");
  });

  App.on("compliance.renew", (el) => {
    if (!App.guard("compliance.write")) return;
    const r = rightById(el.dataset.id);
    if (!r) { App.toast("该授权记录不在当前可见范围", "bad"); return; }
    App.closeDrawer();
    App.modal({
      title: "授权续期 · " + r.id, sub: "续期以供应商回执为准，回执缺失不得标记有效",
      body: U.fField("续期至", "until", { required: true, placeholder: "2027-11-30", rule: "date" }) +
        U.fField("回执编号", "proof", { required: true, minlen: 6 }) + U.fTextarea("说明", "note", { rows: 2 }),
      submitText: "提交续期",
      onSubmit(d) {
        return App.job({
          title: "授权续期", steps: ["校验回执", "更新有效期", "写审计"],
          run() {
            const res = DB.state.renewRights(r.id, d.until);
            if (!res.ok) return res;
            r.proof = d.proof;
            DB.state.log("授权 " + r.id, "续期至 " + d.until + "，回执 " + d.proof, "成功", r.id);
            return { ok: true, msg: res.msg + "；回执已登记" };
          }
        });
      }
    });
  });

  App.on("compliance.replace", (el) => {
    if (!App.guard("compliance.write")) return;
    const id = el.dataset.id;
    const r = rightById(id);
    if (!r) { App.toast("该授权记录不在当前可见范围", "bad"); return; }
    App.modal({
      title: "替换授权素材 · " + id, sub: "替换后需重混并重新质检，旧版本保留",
      body: U.fField("替换素材编号", "asset", { required: true, minlen: 4, placeholder: "例如 AU-26031-BGM-07" }) +
        U.fTextarea("替换原因", "note", { required: true, minlen: 8, rows: 3 }),
      submitText: "替换并标记重做",
      onSubmit(d) {
        return App.job({
          title: "替换授权素材", steps: ["校验新素材授权", "更新台账", "标记下游重做"],
          run() {
            const a = D.audioAssets.find(x => x.id === d.asset) || D.assets.find(x => x.id === d.asset);
            if (!a) return { ok: false, msg: "替换素材不存在：" + d.asset, fields: { asset: "素材不存在" } };
            if (r.project && a.project && a.project !== r.project) return { ok: false, msg: "替换素材属于 " + a.project + "，不能用于 " + r.project + " 的授权替换", fields: { asset: "项目不匹配" } };
            const res = DB.state.replaceRightsAsset(id);
            if (!res.ok) return res;
            r.proof = "替换为 " + d.asset;
            D.timelines.filter(t => t.project === r.project).forEach(t => { t.stale = (t.stale || 0) + 1; });
            DB.state.log("授权 " + id, "替换素材 " + d.asset + "：" + d.note, "成功", id);
            return { ok: true, msg: "已替换为 " + d.asset + "；下游时间线已标脏，需重混与复检" };
          }
        });
      }
    });
  });

  App.on("compliance.disable", (el) => {
    if (!App.guard("compliance.write")) return;
    const r = rightById(el.dataset.id);
    if (!r) { App.toast("该授权记录不在当前可见范围", "bad"); return; }
    App.modal({
      title: "停用授权 · " + r.id, sub: "停用后引用该素材的成片不可交付",
      body: U.fTextarea("停用原因", "note", { required: true, minlen: 8, rows: 3 }),
      submitText: "确认停用",
      onSubmit(d) {
        return App.job({
          title: "停用授权", steps: ["校验下游引用", "更新状态", "标记交付阻断"],
          run() {
            r.status = "停用"; r.review = "已停用";
            DB.state.log("授权 " + r.id, "停用：" + d.note, "成功", r.id);
            return { ok: true, msg: "授权 " + r.id + " 已停用，引用该素材的成片将阻断交付" };
          }
        });
      }
    });
  });

  App.on("compliance.riskDetail", (el) => {
    const r = riskById(el.dataset.id);
    if (!r) { App.toast("该风险记录不在当前可见范围", "bad"); return; }
    App.drawer("风险 · " + r.id, U.desc([["项目", r.project], ["类型", r.type], ["定位", r.where], ["等级", r.level], ["状态", r.status], ["发现", r.at], ["责任人", r.owner], ["建议动作", r.action], ["结论", r.decision]]) +
      '<div class="btn-row-inline">' + (r.status !== "已闭环" ? U.btn("闭环", "compliance.closeRisk", "primary", { id: r.id }) + U.btn("升级", "compliance.escalate", "", { id: r.id }) : "") + "</div>");
  });

  App.on("compliance.closeRisk", (el) => {
    if (!App.guard("compliance.write")) return;
    const r = riskById(el.dataset.id);
    if (!r) { App.toast("该风险记录不在当前可见范围", "bad"); return; }
    App.closeDrawer();
    App.modal({
      title: "风险闭环 · " + r.id, sub: "闭环必须给出处理结论与验证方式，否则仍为未闭环",
      body: U.fTextarea("处理结论", "note", { required: true, minlen: 8, rows: 3, placeholder: "例如：已替换素材并重混，抽检 3 处无异常" }) +
        U.fField("验证方式", "verify", { required: true, minlen: 6 }) +
        U.fCheck("已通知下游负责人", "okn", { checked: true }),
      submitText: "确认闭环",
      onSubmit(d) {
        return App.job({
          title: "风险闭环", steps: ["校验结论与验证", "更新风险台账", "写审计"],
          run() {
            const res = DB.state.closeRisk(r.id, d.note + " · 验证：" + d.verify);
            if (!res.ok) return res;
            return { ok: true, msg: res.msg + "，验证方式已记录" };
          }
        });
      }
    });
  });

  App.on("compliance.escalate", (el) => {
    if (!App.guard("compliance.write")) return;
    const r = riskById(el.dataset.id);
    if (!r) { App.toast("该风险记录不在当前可见范围", "bad"); return; }
    App.closeDrawer();
    App.modal({
      title: "升级风险 · " + r.id, sub: "升级到企业级需说明项目内为何无法闭环",
      body: U.fSelect("升级至", "to", ["企业管理员", "合规负责人"], { required: true }) + U.fTextarea("升级原因", "reason", { required: true, minlen: 8, rows: 3 }),
      submitText: "确认升级",
      onSubmit(d) {
        return App.job({
          title: "升级风险", steps: ["校验理由", "更新等级", "通知上级"],
          run() {
            r.level = d.to; r.status = "升级处理中";
            DB.state.notify({ type: "异常升级", project: r.project, title: "风险 " + r.id + " 升级至" + d.to, reason: d.reason, impact: "该风险在处理前会阻断相关项目推进", state: "待处理", action: "按升级对象完成处置并回填结论", owner: d.to, link: "compliance/risks" });
            DB.state.log("风险 " + r.id, "升级至" + d.to + "：" + d.reason, "成功", r.id);
            return { ok: true, msg: "风险 " + r.id + " 已升级至" + d.to };
          }
        });
      }
    });
  });

  App.on("compliance.newRisk", (el) => {
    if (!App.guard("compliance.write")) return;
    const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id || ((App.currentProject() || {}).id || "");
    App.modal({
      wide: true,
      title: "登记风险", sub: "风险必须可定位到项目、对象与责任人才可跟踪",
      body: U.fSelect("项目", "project", DB.derived.visibleProjects().map(x => ({ value: x.id, label: x.id + " · " + x.name })), { required: true, value: pid }) +
        U.fSelect("类型", "type", ["授权风险", "内容合规", "质量风险", "预算风险", "数据安全"]) +
        U.fField("对象", "object", { required: true, minlen: 4, placeholder: "例如 SH-26015-E09-02 / AU-26015-BGM-03" }) +
        U.fSelect("等级", "level", ["高", "中", "低"]) + U.fField("责任人", "owner", { required: true, value: (App.identity() && App.identity().name) || "负责人" }) +
        U.fTextarea("现象与影响", "note", { required: true, minlen: 10, rows: 3 }),
      submitText: "登记风险",
      onSubmit(d) {
        return App.job({
          title: "登记风险", steps: ["校验项目、对象与责任人", "写入风险台账"],
          run() {
            const target = D.projects.find(x => x.id === d.project);
            if (!target) return { ok: false, msg: "项目不存在：" + d.project };
            if (!DB.derived.canViewProject(target)) return { ok: false, msg: "项目不在当前身份可见范围：" + d.project };
            const n = D.risks.reduce((m, x) => { const hit = String(x.id).match(/^RK-(\d+)$/); return hit ? Math.max(m, Number(hit[1])) : m; }, 0) + 1;
            const id = "RK-" + String(n).padStart(4, "0");
            D.risks.unshift({ id: id, project: d.project, type: d.type, where: d.object, level: d.level, owner: d.owner, status: "待处理", at: DB.state.at(), action: d.note, decision: "未闭环" });
            DB.state.log("风险 " + id, "登记：" + d.note + " · " + d.project, "成功", id);
            return { ok: true, msg: "风险 " + id + " 已登记（" + target.name + " · " + d.level + " 级）" };
          }
        });
      }
    });
  });
})();

