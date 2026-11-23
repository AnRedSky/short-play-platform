/* 模块：notify 通知与异常（员工端 + 企业管理端） */
(function () {
  const U = UI, D = DB, SCOPE = "notify";

  AppModule.register({
    group: "notify", label: "通知与异常", icon: "bell", order: 13, end: "workspace",
    routes: [
      {
        path: "notify/inbox", title: "待办与通知", icon: "bell", permission: "notify.handle",
        desc: "通知必须说明「为什么通知我、阻塞了什么、下一步做什么」。静默失败与无归属通知都视为缺陷。",
        render() {
          const tab = App.get(SCOPE, "tab", "all");
          const visPids = Derived.visibleProjects().map(p => p.id);
          const notes = D.notifications.filter(n => visPids.indexOf(n.project) >= 0);
          const meName = (Derived.actorUser(App.identity()) || {}).name || "";
          const isMine = (n) => n.owner === meName;
          const myTodo = notes.filter(n => isMine(n) && (n.state === "待处理" || n.state === "处理中"));
          const list = notes.filter(n => tab === "all" ? true : tab === "unread" ? n.unread : tab === "todo" ? myTodo.indexOf(n) >= 0 : n.state === "已升级");
          const unread = notes.filter(n => n.unread);
          const pending = myTodo.filter(n => n.state === "待处理");
          const escalated = notes.filter(n => n.state === "已升级");
          const closed = notes.filter(n => n.state === "已完成" || n.state === "已处理");
          const pendingTypes = pending.length ? pending.map(n => n.type).slice(0, 3).join(" · ") : (myTodo.length ? myTodo.map(n => n.type).slice(0, 3).join(" · ") : "无待我处理事项");
          return U.page("通知与异常 / 待办与通知", "待办与通知", "按「需我决策」优先；已升级事项置顶并标明升级对象。",
            U.btn("全部标记已读", "notify.readAll") + U.btn("去异常中心", "notify.toIncidents", "primary"),
            '<div class="grid grid-4">' +
              U.metric("未读", String(unread.length), "可见通知 " + notes.length + " 条", "●") +
              U.metric("待我处理", String(myTodo.length), pendingTypes, "!") +
              U.metric("已升级", String(escalated.length), escalated.length ? "需上级介入" : "无升级事项", "↑") +
              U.metric("已闭环", String(closed.length), "处理后回写结论", "✓") +
            "</div>" +
            U.card("", U.tabs([
              { value: "all", label: "全部", count: notes.length },
              { value: "unread", label: "未读", count: unread.length },
              { value: "todo", label: "待我处理", count: myTodo.length },
              { value: "esc", label: "已升级", count: escalated.length }
            ], tab, "notify.tab") +
              U.table(["类型 / 事项", "项目", "原因", "阻塞影响", "状态", "时间", "操作"], list.map(n =>
                '<tr><td><b>' + U.esc(n.type) + "</b><div class=\"faint small\">" + U.esc(n.title) + (n.unread ? ' <span class="pill accent">未读</span>' : "") + "</div></td><td>" + U.code(n.project) + '</td><td class="cell-wrap muted">' + U.esc(n.reason) + '</td><td class="cell-wrap">' + U.esc(n.impact) + "</td><td>" + U.pill(n.state) + '</td><td class="idx">' + U.esc(n.at) + "</td><td>" +
                U.btn("处理", "notify.handle", "sm", { id: n.id }) + (n.state !== "已完成" ? " " + U.btn("转待办", "notify.toTask", "sm", { id: n.id }) : "") + "</td></tr>").join(""), "该分类下暂无通知。"),
              "共 " + notes.length + " 条可见通知 · 通知对象为负责人或配置人；非成员项目通知不展示") +
            '<div class="grid grid-2 mt-4">' +
              U.card("升级规则", U.table(["条件", "升级对象", "通知渠道"], [
                ["异常超 4 小时未处理", "企业管理员", "站内 + 邮件"],
                ["同一对象连续 3 次失败", "项目负责人", "站内"],
                ["预算接近 / 已超限", "项目负责人 + 部门管理员", "站内 + 邮件"],
                ["合规高风险阻断", "企业管理员 + 项目负责人", "站内 + 短信"],
                ["授权 30 天内到期", "项目负责人", "站内"]
              ].map(r => "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td><td class=\"muted\">" + r[2] + "</td></tr>").join("")), "升级不改变业务状态，只扩大通知范围") +
              U.card("通知要素与渠道", (function () {
                const p = App.get(SCOPE, "prefs", { in: true, mail: true, sms: false, call: false });
                const on = [["站内", p.in], ["邮件", p.mail], ["短信", p.sms], ["电话", p.call]].filter(x => x[1]).map(x => x[0]);
                return U.listRows([
                  ["必备要素", "事项类型、触发原因、阻塞影响、建议动作、责任人与时限"],
                  ["已启用渠道", on.length ? on.join(" / ") : "未启用任何渠道（保存后按站内兜底）"],
                  ["渠道", "站内（默认）；邮件/短信/电话升级为通知渠道配置"],
                  ["去重", "同一对象同一原因 30 分钟内合并为一条，避免刷屏"],
                  ["闭环", "处理后需回写结果，未闭环事项保留在列表"],
                  ["隐私", "通知正文不含凭据、密钥与个人敏感信息"]
                ]);
              })(), "通知不替代审计记录", U.btn("通知偏好", "notify.prefs", "sm")) +
            "</div>"
          );
        }
      },
      {
        path: "notify/incidents", title: "异常中心", icon: "alert", permission: "notify.handle",
        desc: "异常按影响范围局部暂停，不整项目静默全停；处理必须留下决策、责任人与下一步。",
        render() {
          const visPids = Derived.visibleProjects().map(p => p.id);
          const inc = D.incidents.filter(i => visPids.indexOf(i.project) >= 0);
          const open = inc.filter(i => i.result !== "已闭环");
          const escalatedInc = inc.filter(i => String(i.level).indexOf("升级") >= 0);
          const incProjects = [...new Set(inc.map(i => i.project))];
          return U.page("通知与异常 / 异常中心", "异常中心", "异常来源：重试达上限、资源不可用、预算触发、合规高风险、质量阻断。",
            U.btn("导出异常台账", "common.export") + U.btn("查看任务链路", "notify.toTasks", "primary"),
            '<div class="grid grid-4">' +
              U.metric("未闭环", String(open.length), "可见异常 " + inc.length + " 项", "!") +
              U.metric("处理中", String(inc.filter(i => i.result === "处理中").length), "已派发处置动作", "+") +
              U.metric("已升级", String(escalatedInc.length), "超出项目内处置范围", "↑") +
              U.metric("涉及项目", String(incProjects.length), "非成员项目异常不展示", "▤") +
            "</div>" +
            U.card("异常台账", U.table(["异常", "项目", "类型", "首次 / 最近", "处置动作", "决策与责任人", "下一步", "结果", "级别"], inc.map(i =>
              '<tr><td>' + U.code(i.id) + "</td><td>" + U.esc(i.project) + '</td><td class="cell-wrap">' + U.esc(i.type) + '</td><td class="idx">' + U.esc(i.first) + "<br>" + U.esc(i.last) + '</td><td class="cell-wrap">' + U.esc(i.action) + '</td><td class="cell-wrap muted">' + U.esc(i.decision) + "</td><td class=\"cell-wrap\">" + U.esc(i.next) + "</td><td>" + U.pill(i.result) + "</td><td>" + U.pill(i.level, i.level.indexOf("企业") >= 0 ? "bad" : "info") + "</td><td>" +
              U.btn("处置", "notify.incidentAction", "sm", { id: i.id }) + "</td></tr>").join("")), "异常关闭需回写结果与验证方式") +
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
            "</div>"
          );
        }
      }
    ]
  });

  App.on("notify.tab", (el) => { App.set(SCOPE, "tab", el.dataset.value); App.refresh(); });
  App.on("notify.toIncidents", () => App.go("notify/incidents"));
  App.on("notify.toTasks", () => App.go("tasks/list"));
  const canSeeProject = (pid) => {
    const p = D.projects.find(x => x.id === pid);
    return !!p && Derived.canViewProject(p);
  };
  App.on("notify.readAll", () => {
    const notes = D.notifications.filter(n => canSeeProject(n.project));
    notes.forEach(n => { n.unread = false; });
    App.toast("已将 " + notes.length + " 条可见通知标记为已读"); App.refresh();
  });
  App.on("notify.read", (el) => {
    const n = D.notifications.find(x => x.id === el.dataset.id);
    if (!n || !canSeeProject(n.project)) return;
    n.unread = false; App.toast("已标记已读：" + n.type); App.refresh();
  });
  App.on("notify.jump", (el) => {
    const n = D.notifications.find(x => x.id === el.dataset.id);
    if (!n || !canSeeProject(n.project)) { App.toast("该项目通知不在当前可见范围", "bad"); return; }
    const meName = (Derived.actorUser(App.identity()) || {}).name || "";
    if (/^models\/providers/.test(n.link || "") && !App.can("models.manage") && n.owner !== meName) {
      App.toast("该配置归属「" + n.owner + "」，请转待办给归属人或升级处理", "bad");
      return;
    }
    n.unread = false;
    App.closeDrawer();
    const link = el.dataset.link || "workspace/home";
    const scoped = /^(creation|director|video|audio|post|quality|assets|cost|compliance|tasks)\//.test(link);
    App.go(link, scoped && n.project ? { id: n.project } : undefined);
  });
  App.on("notify.prefs", () => {
    const cur = App.get(SCOPE, "prefs", { in: true, mail: true, sms: false, call: false });
    App.modal({
      title: "通知偏好", sub: "渠道开关保存后立即体现在通知页「已启用渠道」，不发送真实消息",
      body: U.fCheck("站内消息（默认）", "in", { checked: cur.in }) + U.fCheck("邮件摘要（每日 18:00）", "mail", { checked: cur.mail }) + U.fCheck("短信（仅升级事件）", "sms", { checked: cur.sms }) + U.fCheck("电话（仅合规阻断）", "call", { checked: cur.call }) +
        U.notice("关闭站内消息后，通知仍保留在列表与审计中，只是不再推送提醒。", "info"),
      submitText: "保存偏好",
      onSubmit(d) {
        return App.job({
          title: "保存通知偏好", steps: ["读取渠道开关", "写入偏好", "刷新通知页"],
          run() {
            const next = { in: !!d.in, mail: !!d.mail, sms: !!d.sms, call: !!d.call };
            App.set(SCOPE, "prefs", next);
            Store.log("通知偏好", "站内 " + (next.in ? "开" : "关") + " · 邮件 " + (next.mail ? "开" : "关") + " · 短信 " + (next.sms ? "开" : "关") + " · 电话 " + (next.call ? "开" : "关"), "成功", "notify");
            return { ok: true, msg: "通知偏好已保存并生效" };
          }
        });
      }
    });
  });
})();

/* ===== v9.1 真实流程层：通知闭环 / 转待办 / 升级异常 ===== */
(function () {
  const U = UI, D = DB;
  const canSeeProject = (pid) => {
    const p = D.projects.find(x => x.id === pid);
    return !!p && Derived.canViewProject(p);
  };
  const noteById = (id) => {
    const n = D.notifications.find(x => x.id === id);
    return n && canSeeProject(n.project) ? n : null;
  };
  const nextTaskId = () => {
    const max = D.tasks.reduce((m, t) => {
      const hit = String(t.id).match(/^T-(\d+)$/);
      return hit ? Math.max(m, Number(hit[1])) : m;
    }, 0);
    return "T-" + String(max + 1).padStart(4, "0");
  };

  App.on("notify.handle", (el) => {
    const n = noteById(el.dataset.id);
    if (!n) { App.toast("该通知不在当前可见范围", "bad"); return; }
    const meName = (Derived.actorUser(App.identity()) || {}).name || "";
    const to = (n.link || "workspace/home");
    const techLink = /^models\/providers/.test(to);
    const canJump = !techLink || App.can("models.manage") || n.owner === meName;
    App.drawer(n.type + " · " + n.title, U.desc([["项目", n.project], ["触发原因", n.reason], ["阻塞影响", n.impact], ["建议动作", n.action], ["责任人", n.owner], ["当前状态", n.state], ["时间", n.at]]) +
      U.notice("仅关闭通知而不处理业务对象视为未闭环；关闭需给出结论。", "info") +
      (techLink && !canJump ? U.notice("该配置归属「" + n.owner + "」，你当前不能代替其更新凭据；请转待办指派给归属人，或升级企业管理员处理。", "warn") : "") +
      '<div class="btn-row-inline">' + (canJump ? U.btn("去业务页处理", "notify.jump", "primary", { link: to, id: n.id }) : "") +
      U.btn(techLink && !canJump ? "转待办给归属人" : "转待办", "notify.toTask", canJump ? "" : "primary", { id: n.id }) +
      (canJump ? U.btn("记录处理结论", "notify.close", "", { id: n.id }) : "") + (n.state !== "已升级" ? U.btn("升级", "notify.escalate", "sm", { id: n.id }) : "") + "</div>");
  });

  App.on("notify.close", (el) => {
    const n = noteById(el.dataset.id);
    if (!n) { App.toast("该通知不在当前可见范围", "bad"); return; }
    const meName = (Derived.actorUser(App.identity()) || {}).name || "";
    if (/^models\/providers/.test(n.link || "") && !App.can("models.manage") && n.owner !== meName) {
      App.toast("你不能代替「" + n.owner + "」关闭资源配置通知；请转待办或升级", "bad");
      return;
    }
    App.closeDrawer();
    App.modal({
      title: "记录处理结论 · " + n.id, sub: "需要指明业务对象已发生的实际变化，不能只写「已处理」",
      body: U.fSelect("结论类型", "kind", ["已在业务页处理完成", "接受现状并留理由", "转人工决策", "误报关闭"], { required: true }) +
        U.fTextarea("处理结论", "note", { required: true, minlen: 10, rows: 3, placeholder: "例如：SH-05 已局部重生成并复检通过，报告 QR-26031-E17-03 已转 PASS" }),
      submitText: "关闭通知",
      onSubmit(d) {
        return App.job({
          title: "关闭通知", steps: ["校验结论完整性", "更新通知状态", "写审计"],
          run() {
            n.state = "已处理"; n.unread = false; n.decision = d.kind + "：" + d.note;
            Store.log("通知 " + n.id, d.kind + " · " + d.note, "成功", n.id);
            return { ok: true, msg: "通知 " + n.id + " 已处理并留痕" };
          }
        });
      }
    });
  });

  App.on("notify.toTask", (el) => {
    const n = noteById(el.dataset.id);
    if (!n) { App.toast("该通知不在当前可见范围", "bad"); return; }
    const due = (() => { const d = new Date(Date.now() + 86400000); const p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " 18:00"; })();
    const ownerUser = D.users.find(u => u.name === n.owner) || null;
    const ownerOpts = D.users.map(u => u.name + "（" + u.role + "）");
    App.closeDrawer();
    App.modal({
      title: "转为待办 · " + n.id, sub: "待办需指定负责人与截止时间，避免无限延期；默认责任人为原通知责任人",
      body: U.fField("待办标题", "title", { required: true, minlen: 6, value: n.title }) +
        U.fSelect("负责人", "owner", ownerOpts, { required: true, value: ownerUser ? ownerUser.name + "（" + ownerUser.role + "）" : ownerOpts[0] }) +
        U.fField("截止时间", "due", { required: true, placeholder: "YYYY-MM-DD HH:mm", value: due, rule: "date" }) +
        U.fSelect("优先级", "prio", ["高", "中", "低"]),
      submitText: "创建待办",
      onSubmit(d) {
        return App.job({
          title: "创建待办", steps: ["校验负责人与截止时间", "写入任务清单", "回写通知状态"],
          run() {
            const id = nextTaskId();
            D.tasks.unshift({ id: id, project: n.project, ep: "—", scene: "—", shot: "—", kind: "待办", stage: "待办", status: "待执行", priority: d.prio, deps: [], parallelGroup: "—", input: n.title, output: "处理结论", model: "—", config: "—", executor: d.owner.split("（")[0], resourceOwner: "企业", attempt: 0, maxAttempts: 1, est: 0, actual: 0, failedCost: 0, submitAt: Store.time(), failReason: "—", qc: "—", due: d.due });
            n.state = "已转待办"; n.unread = false; n.task = id;
            Store.notify("待办 " + id + " 已指派：" + d.owner);
            Store.log("通知 " + n.id, "转待办 " + id + "（截止 " + d.due + "）", "成功", id);
            return { ok: true, msg: "已创建待办 " + id + "，负责人 " + d.owner + "，截止 " + d.due };
          }
        });
      }
    });
  });

  App.on("notify.escalate", (el) => {
    const n = noteById(el.dataset.id);
    if (!n) { App.toast("该通知不在当前可见范围", "bad"); return; }
    App.closeDrawer();
    App.modal({
      title: "升级通知 · " + n.id, sub: "升级将同步企业管理员并计入异常台账，业务状态不变",
      body: U.fSelect("升级对象", "to", ["企业管理员", "部门负责人", "合规负责人"], { required: true }) +
        U.fTextarea("升级原因", "reason", { required: true, minlen: 8, rows: 3, placeholder: "说明为何项目内无法闭环" }),
      submitText: "确认升级",
      onSubmit(d) {
        return App.job({
          title: "升级通知", steps: ["校验升级理由", "写入异常台账", "通知上级"],
          run() {
            n.state = "已升级"; n.unread = false; n.escalatedTo = d.to;
            n.escalatedAt = Store.at();
            const id = "IN-" + String(D.incidents.length + 1).padStart(4, "0");
            D.incidents.unshift({ id: id, project: n.project, type: n.type, first: Store.at(), handled: 1, last: Store.at(), action: "由通知升级进入异常台账", decision: String(D.identities.find(i => i.id === D.currentIdentity).name) + " · " + d.reason, result: "未闭环", next: n.action, level: d.to });
            Store.notify("通知 " + n.id + " 已升级至" + d.to);
            Store.log("通知 " + n.id, "升级至" + d.to + "：" + d.reason, "成功", id);
            return { ok: true, msg: "已升级至" + d.to + "，异常台账 " + id + " 已建立" };
          }
        });
      }
    });
  });

  App.on("notify.incidentAction", (el) => {
    if (!App.guard("notify.handle")) return;
    const i = D.incidents.find(x => x.id === el.dataset.id);
    if (!i) return;
    if (!canSeeProject(i.project)) { App.toast("该异常所属项目不在当前可见范围", "bad"); return; }
    const ways = ["局部暂停并重生成", "接受并记录理由", "替换素材后重跑", "指派他人处理", "升级企业管理员"];
    App.modal({
      title: "处置异常 · " + i.id, sub: i.type + " · " + i.project,
      body: U.fSelect("处置方式", "way", ways, { required: true }) +
        U.fTextarea("决策说明", "note", { required: true, minlen: 10, value: i.decision, rows: 3 }) +
        U.fField("验证方式", "verify", { required: true, minlen: 6, placeholder: "例如：抽检 3 帧并与相邻镜头比对" }) +
        U.notice("「已闭环」必须给出验证结果；合规类异常不接受纯自动重跑。", "warn"),
      submitText: "提交处置",
      onSubmit(d) {
        return App.job({
          title: "处置异常", steps: ["校验处置方式", "执行联动动作", "写台账与验证要求"],
          run() {
            if (i.type.indexOf("合规") >= 0 && d.way === "局部暂停并重生成") return { ok: false, msg: "合规类异常不接受纯自动重跑，需人工决策或替换素材", fields: { way: "合规需人工" } };
            i.action = d.way; i.decision = String(D.identities.find(x => x.id === D.currentIdentity).name) + " · " + d.note;
            i.next = d.verify; i.last = Store.at(); i.handled = (i.handled || 0) + 1;
            if (d.way === "接受并记录理由") i.result = "已闭环（接受）";
            else if (d.way === "指派他人处理") i.result = "处理中";
            else if (d.way === "升级企业管理员") { i.result = "未闭环"; i.level = "升级至企业管理员"; }
            else i.result = "处理中";
            if (d.way === "局部暂停并重生成" || d.way === "替换素材后重跑") {
              const s = D.shots.find(x => x.project === i.project && x.status !== "已通过") || D.shots.find(x => x.project === i.project);
              if (s) { s.status = "需返工"; Store.log("镜头 " + s.id, "异常处置联动返工：" + d.way, "成功", i.id); }
            }
            Store.log("异常 " + i.id, d.way + " · " + d.note + " · 验证：" + d.verify, "成功", i.id);
            return { ok: true, msg: "异常 " + i.id + " 已处置（" + i.result + "），验证要求：" + d.verify };
          }
        });
      }
    });
  });
})();
