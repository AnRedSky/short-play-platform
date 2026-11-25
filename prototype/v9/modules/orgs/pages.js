/* 模块：orgs 组织与权限（企业管理端 · 企业治理层） */
(function () {
  const U = UI, D = DB, SCOPE = "orgs";
  const roleName = (codes) => (codes || []).map(c => (D.roles.find(r => r.code === c) || {}).name || c).join("、");
  const budgetOf = (p) => D.derived.budgetOfProject(p);
  const progressOf = (p) => D.derived.progressOf(p);
  const leftOf = (p) => { const b = budgetOf(p); return b.total - b.used; };
  /* 企业预算以 DB.budgets 的「企业」记录为准，D.enterprise 上的字段仅作回落 */
  const entBudget = () => {
    const e = D.enterprise, led = D.budgets.find(b => b.scope === "企业");
    const total = Number((led ? led.total : e.budget) || 0);
    const used = Number((led ? led.used : e.used) || 0);
    return { total: total, used: used, pct: total ? Math.round(used / total * 100) : 0, state: (led && led.state) || "" };
  };

  function memberRows(list) {
    return list.map(u => '<tr><td>' + U.entity(u.name, u.email, u.name.slice(0, 1)) + '</td><td>' + U.esc(u.dept) + '</td><td>' + U.esc(u.role) + '</td><td>' + U.pill(u.status) + '</td><td class="num">' + u.projects + '</td><td class="num">' + u.delivered + "</td><td>" +
      U.btn("档案", "orgs.member", "sm", { id: u.id }) + (App.can("org.manage") ? " " + U.btn(u.status === "在职" ? "停用" : "启用", "orgs.toggle", "sm", { id: u.id }) : "") + "</td></tr>").join("");
  }

  AppModule.register({
    group: "orgs", label: "组织与权限", icon: "users", order: 16, end: "enterprise",
    routes: [
      {
        path: "orgs/enterprise", title: "企业主体", icon: "shield", permission: "enterprise.read",
        desc: "唯一企业主体的基础信息、治理范围与企业策略。企业是最高级别的组织与数据治理边界，不提供外部注册与 SaaS 租户服务。",
        render() {
          const e = D.enterprise;
          return U.page("组织与权限 / 企业主体", "企业主体", "企业统一管理部门、账号、角色、策略、预算、合规与企业级数据；停用企业不级联删除任何业务数据。",
            (App.can("enterprise.edit") ? U.btn("编辑企业信息", "orgs.editEnterprise", "primary") + U.btn("调整策略", "orgs.editPolicy") : "") + U.btn("查看企业总览", "orgs.toAnalytics"),
            '<div class="split"><div class="stack">' +
              U.card("企业档案", U.desc([
                ["企业名称", e.name], ["企业标识", e.code], ["企业简介", e.intro], ["企业状态", '<span class="pill ok"><i class="dot"></i>' + e.status + "</span>", true],
                ["企业管理员", e.admin], ["成员数量", e.members + " 人"], ["部门数量", e.depts + " 个"], ["项目总数", e.projects + " 个"],
                ["企业预算", "¥" + entBudget().total.toLocaleString()], ["已用", "¥" + entBudget().used.toLocaleString() + "（" + entBudget().pct + "%）"]
              ]), "企业状态变更保留全部项目、资产、交付与历史记录",
                App.can("enterprise.edit") ? U.btn("停用企业（保留数据）", "orgs.disable", "sm") : "") +
              U.card("统一治理范围", U.listRows([
                ["企业主体", "初始化并维护唯一企业主体信息"], ["部门与组织单元", "创建、调整、停用、归档与层级调整"],
                ["账号与安全", "全局账号、认证与安全策略"], ["策略与规则", "预算制度、合规规则、模型允许范围、数据外发"],
                ["项目规则", "项目创建规则、配额上限、跨部门授权策略"], ["经营与审计", "企业级项目、产出、质量、成本汇总与审计"]
              ]), "不代替员工配置个人凭据") +
            '</div><div class="stack">' +
              U.card("企业策略", U.table(["策略项", "取值", "说明"], e.policies.map(p =>
                '<tr><td class="cell-strong">' + U.esc(p.name) + '</td><td><span class="code">' + U.esc(p.value) + '</td><td class="cell-wrap muted">' + U.esc(p.note) + "</td></tr>").join("")), "企业可定义策略与白名单，但不得导出或读取个人凭据") +
              U.card("治理边界", U.notice("<b>企业与个人之间：</b>企业制定预算、合规与资源范围，但不得代替员工配置凭据，也不得读取任何 API Key 明文。个人凭据属于独立安全域。", "info") +
                U.listRows([["企业根边界", "跨企业数据不共享、不检索、不导出"], ["个人配置归属", "归属员工账号，不归属项目，不随项目移交"], ["原型说明", "企业信息为虚构主体，全部数值为虚构示例数据"]])
                , "凭据隔离是硬约束") +
            "</div></div>"
          );
        }
      },
      {
        path: "orgs/departments", title: "部门与组织单元", icon: "folder", permission: "org.read",
        desc: "部门承载组织归属与管理视图，可按事业部、部门、制作中心或项目团队划分。部门不是 SaaS 租户，不作为数据隔离主键。",
        render() {
          const me = App.identity();
          const list = me.role === "dept" ? D.departments.filter(d => d.name === me.dept) : D.departments;
          const rows = list.map(d => {
            const bg = D.budgets.find(b => b.scope === "部门" && b.name === d.name) || { used: d.used, total: d.budget };
            const members = D.users.filter(u => u.dept === d.name).length;
            const projects = D.projects.filter(p => p.dept === d.name).length;
            return '<tr><td>' + U.entity(d.name, d.code, d.name.slice(0, 1)) + '</td><td><span class="code">' + U.esc(d.code) + "</span></td><td>" + U.esc(d.parent) + "</td><td>" + U.esc(d.leader) + '</td><td class="num">' + members + '</td><td class="num">' + projects + "</td><td>" +
              U.miniBar(bg.used, bg.total) + ' <span class="num">' + Math.round(bg.used / bg.total * 100) + '%</span></td><td>' + U.pill(d.status) + "</td><td>" +
              U.btn("详情", "orgs.deptDetail", "sm", { id: d.id }) + "</td></tr>";
          }).join("");
          return U.page("组织与权限 / 部门与组织", "部门与组织单元", "部门用于人员组织与统计维度；部门之间默认不可互相检索与引用项目资产，跨部门查看须授权并留审计。",
            App.can("org.manage") ? U.btn("新建部门", "orgs.newDept", "primary") : "",
            U.card("部门列表", U.table(["部门", "编码", "上级", "负责人", "成员", "项目", "预算使用", "状态", "操作"], rows), "当前可见范围内没有部门") +
              '<div class="table-foot"><span data-filter-count>共 ' + list.length + " 个组织单元</span><span>可见范围：" + DB.derived.scopeLabel() + "</span></div>" +
              '<div class="grid grid-2 mt-4">' +
              U.notice("口径与规则见《口径与规则汇总》§R-24：组织边界规则", "info") +
              U.card("部门视图授权", U.table(["部门", "视图范围", "可见明细"], D.departments.map(d =>
                "<tr><td>" + U.esc(d.name) + '</td><td class="cell-wrap">' + U.esc(d.view) + "</td><td>" + U.pill(d.view.indexOf("汇总") >= 0 ? "仅汇总" : "项目明细", d.view.indexOf("汇总") >= 0 ? "info" : "ok") + "</td></tr>").join("")) +
                U.notice("跨部门管理与汇总视图由企业管理员授权，访问范围与导出动作须写审计。", "info"), "视图授权只调整可见范围，不改变权限码") +
              "</div>"
          );
        }
      },
      {
        path: "orgs/members", title: "员工账号", icon: "users", permission: "org.read",
        desc: "企业内唯一身份：账号、姓名、部门、角色、状态、加入时间与凭据元数据。停用账号立即失效会话，但历史执行记录保留。",
        render() {
          const dept = App.get(SCOPE, "memberDept", "");
          const status = App.get(SCOPE, "memberStatus", "");
          const visible = DB.derived.visibleMembers();
          const depts = D.departments.filter(d => visible.some(u => u.dept === d.name));
          const list = visible.filter(u => (!dept || u.dept === dept) && (!status || u.status === status));
          const active = visible.filter(u => u.status === "在职").length;
          const owned = D.providers.filter(x => visible.some(u => u.id === x.ownerId)).length;
          return U.page("组织与权限 / 员工账号", "员工账号", "员工凭单一账号即可独立完成整部短剧制作；角色按管理职责划分，不按传统制作岗位划分。数据范围按身份收窄，见页脚。",
            (App.can("org.manage") ? U.btn("邀请员工", "orgs.newMember", "primary") : "") + U.btn("导出名录", "common.export"),
            U.card("成员目录",
              '<div class="toolbar"><input class="search" placeholder="搜索姓名 / 邮箱" data-scope="' + SCOPE + '" data-filter="q">' +
              U.fSelect("部门", "dept", [{ value: "", label: "全部部门" }].concat(depts.map(d => ({ value: d.name, label: d.name }))), { value: dept }) +
              U.fSelect("状态", "status", [{ value: "", label: "全部状态" }, "在职", "停用"], { value: status }) +
              '<span class="faint small" data-filter-count></span></div>' +
              U.table(["员工", "部门", "角色", "状态", "项目", "交付作品", "操作"], memberRows(list), "当前可见范围内没有符合条件的员工。"),
              "当前显示 " + list.length + " 人 · 可见范围：" + DB.derived.scopeLabel(), U.btn("角色与权限对照", "orgs.toRoles", "sm")) +
            U.tableFoot("可见成员 " + visible.length + " 人（企业共 " + D.users.length + " 人）", "数据范围：" + DB.derived.scopeLabel() + "；跨部门查看须授权并留审计") +
            '<div class="grid grid-3 mt-4">' +
              U.metric("在职（可见）", String(active), "停用 " + (visible.length - active) + " 人 · 待移交", "♙") +
              U.metric("个人自持配置", String(owned) + " 项", "凭据仅存密文，界面脱敏", "◇") +
              U.metric("覆盖项目", String(DB.derived.visibleProjects().length) + " 个", "负责人或成员身份", "▤") +
            "</div>"
          );
        }
      },
      {
        path: "orgs/member", title: "员工档案", icon: "users", permission: "org.read", menu: false,
        desc: "员工档案、项目授权、生产记录与产出统计。离职移交不删除任何历史数据。",
        render(query) {
          const uid = (query && query.id) || "";
          const u = D.users.find(x => x.id === uid);
          if (!u) {
            return U.page("组织与权限 / 员工档案", "员工不存在", "该链接指向的员工档案不存在或已清理。", U.btn("返回名录", "orgs.toMembers", "primary"), U.empty("无法读取员工档案", "请从员工名录重新进入，不存在账号不会回退显示其他员工。"));
          }
          const inScope = DB.derived.visibleMembers().some(x => x.id === u.id);
          if (!inScope) {
            return U.page("组织与权限 / 员工档案（无权限）", "员工档案不在可见范围", "当前身份「" + App.identity().name + "」只能查看 " + DB.derived.scopeLabel() + " 的成员档案。",
              U.btn("返回名录", "orgs.toMembers", "primary"),
              U.empty("无访问权限", "跨部门成员档案须由企业管理员授权后查看；授权动作会写入审计。"));
          }
          const visible = DB.derived.visibleProjects();
          const projects = visible.filter(p => p.ownerId === u.id);
          const grants = visible.filter(p => (p.members || []).some(m => m.userId === u.id) && p.ownerId !== u.id);
          return U.page("组织与权限 / 员工账号 / " + u.id, u.name + " · 员工档案", "档案、授权、执行记录与产出统计分开记录；历史贡献不因负责人变更被覆盖。",
            U.btn("返回名录", "orgs.toMembers") + (App.can("grant.manage") ? U.btn("调整项目授权", "orgs.grant", "primary", { id: u.id }) : ""),
            '<div class="split"><div class="stack">' +
              U.card("基础信息", U.desc([["姓名", u.name], ["企业账号", u.email], ["所属部门", u.dept], ["角色", u.role + "（" + roleName(u.roles) + "）"], ["账号状态", '<span class="pill ' + U.toneOf(u.status) + '">' + u.status + "</span>", true], ["加入时间", u.joined], ["资源归属", u.resources], ["凭据", "仅显示脱敏元数据，任何角色不可读明文"]]) +
                U.notice("账号停用立即失效登录与会话；历史执行记录保留并标注状态。企业不得代替员工创建个人凭据。", "info")) +
              U.card("负责与参与项目", U.table(["项目", "角色", "阶段", "进度", "成本"], projects.concat(grants).map(p =>
                '<tr><td>' + U.entity(p.name, p.id, "剧") + "</td><td>" + (p.ownerId === u.id ? U.pill("负责人", "accent") : U.pill((p.members.find(m => m.userId === u.id) || {}).role || "成员", "info")) + "</td><td>" + U.esc(p.phase) + '</td><td class="num">' + progressOf(p).done + " / " + progressOf(p).total + '</td><td class="num">¥' + budgetOf(p).used.toLocaleString() + "</td></tr>").join("")) +
                (projects.length + grants.length === 0 ? U.empty("暂无项目", "该员工尚未被授权参与任何项目。") : ""), "项目是授权与协作边界") +
            '</div><div class="stack">' +
              U.card("个人产出", '<div class="kv-grid">' + U.kv("创建项目", u.projects) + U.kv("交付作品", u.delivered) + U.kv("完成集数", u.episodes) + U.kv("AI 成本", "¥" + u.cost.toLocaleString()) + U.kv("质量评分", u.quality || "—") + U.kv("资源状态", u.resources.split("·")[0]) + "</div>" +
                U.desc([["统计口径", "仅终审通过并交付计入有效产出"], ["贡献分解", "创建 / 执行 / 审核 / 交付分别统计"]]) , "不重复计数同一交付版本") +
              U.card("人员变动", U.listRows([["调岗", "更新部门归属与项目授权，历史执行保持原归属"], ["账号停用", "立即失效会话；进行中任务按策略暂停"], ["离职", "项目移交、待办转交、授权回收"], ["权限调整", "即时生效并写审计"]]) +
                (App.can("grant.manage") ? '<div class="mt-3">' + U.btn("发起离职移交", "orgs.offboard", "sm", { id: u.id }) + "</div>" : ""), "不得删除任何历史数据") +
            "</div></div>"
          );
        }
      },
      {
        path: "orgs/roles", title: "角色与权限", icon: "key", permission: "org.read",
        desc: "RBAC 权限码 + 项目成员授权 + 数据范围三层校验。平台不以传统制作岗位定义角色。",
        render() {
          const codes = Object.keys(D.permissions);
          return U.page("组织与权限 / 角色与权限", "角色与权限", "权限判定顺序：企业根边界 → 数据范围 → 项目授权 → 功能权限码 → 对象状态约束；任一不满足即拒绝。",
            App.can("org.manage") ? U.btn("新建角色", "orgs.newRole", "primary") + U.btn("调整权限码", "orgs.editPerms") : "",
            U.card("六类角色", U.table(["角色", "范围", "主要职责", "权限码数", "边界"], D.roles.map(r =>
              "<tr><td>" + U.entity(r.name, r.code, r.name.slice(0, 1)) + '</td><td class="cell-wrap">' + U.esc(r.scope) + '</td><td class="cell-wrap">' + U.esc(r.duty) + '</td><td class="num">' + r.perms.length + '</td><td class="cell-wrap faint">' + U.esc(r.deny) + "</td><td>" +
              U.btn("查看权限码", "orgs.roleDetail", "sm", { code: r.code }) + "</td></tr>").join("")) +
              U.notice("权限差异体现「不同身份看到的菜单、页面、操作不同」；本原型仅在浏览器侧校验，服务端鉴权、数据隔离与字段级权限由实际系统实现。", "info"), "角色按管理职责与平台使用权限划分") +
            U.card("权限码清单（" + codes.length + " 项）", '<div class="grid grid-2">' + codes.map(c =>
              '<div class="kv"><span class="idx">' + U.esc(c) + '</span><b style="font-size:12px;font-weight:600">' + U.esc(D.permissions[c]) + "</b></div>").join("") + "</div>", "权限码是动作级最小单位，按钮按权限码条件渲染") +
            U.card("三层判定与按钮层示例", U.table(["层级", "判定内容", "原型实现", "拒绝表现"], [
              "<tr><td>身份层</td><td>当前身份与角色码</td><td>顶栏身份切换，内存态</td><td>菜单不展示</td></tr>",
              "<tr><td>路由层</td><td>路由权限表（集中登记）</td><td>未授权直接渲染 403</td><td>403 + 原因</td></tr>",
              "<tr><td>按钮层</td><td>动作权限码</td><td>无权限不渲染按钮</td><td>入口不可见</td></tr>",
              "<tr><td>项目授权</td><td>查看 / 编辑 / 审核 / 管理</td><td>项目成员表 + 授权页</td><td>项目内对象不可见</td></tr>"
            ].join("")) + U.notice("无权限动作不展示入口，而不是置灰后点击报错；这与「置灰再报错」的反模式相反。", "ok"), "权限不足不在入口处制造失败")
          );
        }
      },
      {
        path: "orgs/grants", title: "项目成员授权", icon: "shield", permission: "grant.manage",
        desc: "按项目粒度授予查看、编辑、审核、管理权限；撤销后立即不可通过旧链接访问，历史操作记录保留。协作不等于共享资源。",
        render() {
          const grantAt = (uid) => {
            const hit = D.audits.find(a => (a.object + " " + a.action).indexOf(uid) >= 0);
            return hit ? hit.time : "—";
          };
          return U.page("组织与权限 / 项目授权", "项目成员授权", "项目授权不授予企业级数据范围；成员不得通过项目授权获得他人个人凭据。",
            (App.can("grant.manage") ? U.btn("新增授权", "orgs.grantNew", "primary") : "") + U.btn("导出授权台账", "common.export"),
            U.card("项目 × 成员授权矩阵", U.table(["项目", "成员", "项目角色", "授权范围", "最近变更", "操作"], D.projects.flatMap(p =>
              (p.members || []).map(m => {
                const u = D.users.find(x => x.id === m.userId) || { name: m.userId, dept: "—" };
                return '<tr><td>' + U.entity(p.name, p.id, "剧") + "</td><td>" + U.entity(u.name, u.dept, u.name.slice(0, 1)) + "</td><td>" + U.pill(m.role, m.role === "管理" ? "accent" : "info") + '</td><td class="cell-wrap muted">' + U.esc({ "管理": "查看 + 编辑 + 审核 + 成员管理", "编辑": "查看 + 编辑创作内容", "审核": "查看 + 审核结论" }[m.role] || "查看") + "</td><td class=\"idx\">" + U.esc(grantAt(m.userId)) + "</td><td>" +
                  U.btn("调整", "orgs.editGrant", "sm", { project: p.id, user: m.userId }) + " " + U.btn("撤销", "orgs.revokeGrant", "sm", { project: p.id, user: m.userId }) + "</td></tr>";
              }).join("")
            ).join("")) + '<div class="table-foot"><span data-filter-count>' + D.projects.reduce((n, p) => n + (p.members || []).length, 0) + " 条授权关系</span><span>按项目粒度生效</span></div>", "撤销授权即时生效") +
            '<div class="grid grid-2 mt-4">' +
              U.notice("口径与规则见《口径与规则汇总》§R-26：授权规则", "info")
              + U.card("待处理授权申请", U.empty("暂无待处理申请", "静态原型不接收真实申请；授权动作由具备权限的身份直接执行。") , "申请流为 R5 范围") +
            "</div>"
          );
        }
      },
      {
        path: "orgs/handover", title: "离职与移交", icon: "archive", permission: "grant.manage",
        desc: "员工离职先完成或挂起进行中任务，再移交项目与授权；不得使用原负责人个人配置发起新调用。",
        render() {
          /* 待移交项目 = 负责人账号已停用 / 离职的项目，或处于异常中需要先闭环的项目（不写死成员编号） */
          const offboarded = D.users.filter(u => ["停用", "已停用", "离职"].indexOf(u.status) >= 0).map(u => u.id);
          const candidates = D.projects.filter(p => (p.ownerId && offboarded.indexOf(p.ownerId) >= 0) || p.status === "异常中");
          const activeTask = (pid) => D.tasks.filter(t => t.project === pid && ["排队中", "执行中", "待执行", "待质检", "待人工处理", "失败", "重试中", "已暂停"].indexOf(t.status) >= 0).length;
          const hp = candidates.find(p => p.id === App.get(SCOPE, "handoverProject", "")) || candidates[0] || null;
          const hpTasks = hp ? D.tasks.filter(t => t.project === hp.id && ["排队中", "执行中", "待执行", "待质检", "待人工处理", "失败", "重试中", "已暂停"].indexOf(t.status) >= 0) : [];
          const hpAssets = hp ? D.assets.filter(a => a.project === hp.id) : [];
          const hpOpenRisk = hp ? D.risks.filter(r => r.project === hp.id && String(r.status).indexOf("已") < 0).length : 0;
          const hpBlockRight = hp ? D.rights.filter(r => r.project === hp.id && String(r.status).indexOf("阻断") >= 0).length : 0;
          return U.page("组织与权限 / 离职与移交", "离职与移交", "移交保留原创建人、历史负责人、执行人、调用配置引用与费用归属；项目归属企业不变。",
            U.btn("发起移交", "orgs.transfer", "primary", hp ? { pid: hp.id } : {}) + U.btn("移交历史", "orgs.history"),
            U.card("待移交项目", U.table(["项目", "当前负责人", "阶段", "进行中任务", "待审 / 异常", "预算余额", "移交建议"], candidates.map(p =>
              '<tr><td>' + U.entity(p.name, p.id, "剧") + "</td><td>" + U.esc(p.owner) + "</td><td>" + U.esc(p.phase) + '</td><td class="num">' + activeTask(p.id) + "</td><td>" + U.pill(p.status) + '</td><td class="num">¥' + leftOf(p).toLocaleString() + "</td><td>" + U.esc(p.status === "异常中" ? "先闭环合规阻断，再移交" : "可直接移交，历史记录保留") + "</td><td>" + U.btn("移交预览", "orgs.preview", "sm", { id: p.id }) + "</td></tr>").join("")) +
              U.notice("停用员工名下项目、历史集数与已发生费用全部保留，不随人员变动删除。", "warn"), "移交不等于删除") +
            (hp ? U.card("移交预览要素 · " + U.esc(hp.name), '<div class="kv-grid">' + U.kv("进行中任务", hpTasks.length + " 项") + U.kv("待审 / 异常", hp.status) + U.kv("资产清单", hpAssets.length + " 项") + U.kv("交付状态", hp.delivered + " / " + hp.episodes + " 集已交付") + U.kv("预算余额", "¥" + leftOf(hp).toLocaleString() + "（" + budgetOf(hp).pct + "% 已用）") + U.kv("风险项", "风险 " + hpOpenRisk + " · 授权阻断 " + hpBlockRight) + "</div>" +
              U.listRows([["任务处理", "未完成任务按策略暂停；接手人确认后恢复，不得用原负责人配置发起新调用"], ["接手人自检", "账号状态、项目访问权限、个人资源配置与预算预检重新执行"], ["历史归属", "创建人、历史负责人、执行人、配置引用与费用归属保持原样"]])
              , "移交前必须完成资源可用性与预算预检") : U.card("移交预览", U.empty("没有待移交项目", "停用账号或标记异常的项目会出现在待移交列表。"), "移交前必须完成资源可用性与预算预检")) +
            '<div class="grid grid-2 mt-4">' +
              U.notice("口径与规则见《口径与规则汇总》§R-27：人员变动处理口径", "info") +
              U.card("移交与成员变更记录", (() => {
                const rows = D.audits.filter(a => /成员|账号|移交|授权|停用/.test(a.object + " " + a.action)).slice(0, 4);
                return rows.length ? U.timeline(rows.map(a => ({ time: a.time, title: a.object + " · " + a.action, desc: a.actor + " · " + a.result }))) : U.empty("暂无移交或成员变更记录", "授权、停用与移交动作发生后会写入审计并在此回显。");
              })(), "历史移交记录只增不改") +
            "</div>"
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("orgs.toMembers", () => App.go("orgs/members"));
  App.on("orgs.toRoles", () => App.go("orgs/roles"));
  App.on("orgs.toAnalytics", () => App.go("analytics/enterprise"));
  App.on("orgs.member", (el) => App.go("orgs/member", { id: el.dataset.id }));
  App.on("orgs.editEnterprise", () => {
    if (!App.guard("enterprise.edit")) return;
    App.modal({
      title: "编辑企业信息", sub: "企业主体信息变更写入内存态并生成审计元数据",
      body: U.fField("企业名称", "name", { value: D.enterprise.name, required: true }) + U.fField("企业标识", "code", { value: D.enterprise.code, required: true }) + U.fTextarea("企业简介", "intro", { value: D.enterprise.intro }) + U.fTextarea("变更原因", "reason", { required: true, placeholder: "至少 8 个字" }),
      onSubmit(d) { D.enterprise.name = d.name; D.enterprise.code = d.code; D.enterprise.intro = d.intro; App.toast("企业信息已更新，已记录审计元数据"); App.refresh(); }
    });
  });
  App.on("orgs.editPolicy", () => {
    if (!App.guard("enterprise.edit")) return;
    const p = D.enterprise.policies[0];
    App.modal({
      title: "调整企业策略 · 单项目集数上限", sub: "策略变更须留审计；不得绕过内容合规规则",
      body: U.fSelect("集数上限", "value", ["40 集", "60 集", "80 集"], { value: p.value }) + U.fTextarea("调整说明", "note", { value: p.note, required: true }),
      onSubmit(d) { p.value = d.value; p.note = d.note; App.toast("策略已更新：" + d.value + ""); App.refresh(); }
    });
  });
  App.on("orgs.disable", () => {
    App.confirm("停用企业主体", "停用后立即停止登录与新任务派发；<b>全部项目、资产、交付与历史记录保留</b>，不做级联删除。", () => {
      D.enterprise.status = "停用"; App.toast("企业已停用，业务数据完整保留"); App.refresh();
    }, "停用企业");
  });
  App.on("orgs.newDept", () => {
    if (!App.guard("org.manage")) return;
    App.modal({
      title: "新建部门 / 组织单元", sub: "部门不是 SaaS 租户，不作为数据隔离主键",
      body: U.fField("部门名称", "name", { required: true, placeholder: "例如 悬疑短剧组" }) +
        '<div class="form-grid">' + U.fSelect("上级部门", "parent", ["—"].concat(D.departments.map(d => d.name))) + U.fField("部门编码", "code", { required: true, placeholder: "kebab 或大写编码" }) + "</div>" +
        U.fSelect("负责人", "leader", D.users.map(u => u.name)) + U.fTextarea("部门职责", "duty", { placeholder: "承载的项目类型与统计口径" }),
      onSubmit(d) {
        D.departments.push({ id: "D-" + String(D.departments.length + 1).padStart(2, "0"), name: d.name, code: d.code, parent: d.parent, leader: d.leader, members: 0, projects: 0, status: "启用", budget: 60000, used: 0, view: "项目明细" });
        D.enterprise.depts += 1;
        App.toast("部门已创建：" + d.name + ""); App.refresh();
      }
    });
  });
  App.on("orgs.deptDetail", (el) => {
    const d = D.departments.find(x => x.id === el.dataset.id);
    if (!d) return;
    App.drawer("部门 · " + d.name, U.desc([["编码", d.code], ["上级", d.parent], ["负责人", d.leader], ["成员", d.members + " 人"], ["项目", d.projects + " 个"], ["预算", "¥" + d.budget.toLocaleString()], ["已用", "¥" + d.used.toLocaleString()], ["状态", d.status]]) +
      U.notice("部门数据只用于组织视图与统计维度；跨部门读取项目资产须单独授权。", "info") +
      '<div class="mt-3">' + U.btn("部门统计视图", "orgs.deptStats", "sm", { id: d.id }) + "</div>");
  });
  App.on("orgs.deptStats", () => App.go("analytics/departments"));
  App.on("orgs.roleDetail", (el) => {
    const r = D.roles.find(x => x.code === el.dataset.code);
    if (!r) return;
    App.drawer("角色 · " + r.name, U.desc([["角色码", r.code], ["数据范围", r.scope], ["主要职责", r.duty], ["边界", r.deny]]) +
      "<div class=\"section-label\">权限码（" + r.perms.length + "）</div>" + r.perms.map(p => '<div class="list-row"><span class="k idx">' + p + '</span><span class="v">' + (D.permissions[p] || "—") + "</span></div>").join(""));
  });
  App.on("orgs.newRole", () => { if (App.guard("org.manage")) App.toast("角色模板基于六类既有角色派生，不新建平台级角色"); });
  App.on("orgs.editPerms", () => { if (App.guard("org.manage")) App.toast("权限码变更需同步登记路由表与按钮判定，原型只展示边界不执行真实授权"); });
  App.on("orgs.grant", (el) => {
    if (!App.guard("grant.manage")) return;
    const u = D.users.find(x => x.id === el.dataset.id);
    App.modal({
      title: "调整项目授权 · " + (u ? u.name : "员工"), sub: "授权按项目粒度生效，不授予企业级数据范围",
      body: U.fSelect("项目", "project", D.projects.map(p => ({ value: p.id, label: p.name + "（" + p.id + "）" })), { required: true }) +
        U.fSelect("项目角色", "role", ["查看", "编辑", "审核", "管理"], { required: true, value: "查看" }) +
        U.fTextarea("授权原因", "reason", { required: true, placeholder: "至少 8 个字" }),
      onSubmit(d) {
        const p = D.projects.find(x => x.id === d.project);
        if (!p || !u) return;
        p.members = p.members || [];
        const exist = p.members.find(m => m.userId === u.id);
        if (exist) exist.role = d.role; else p.members.push({ userId: u.id, role: d.role });
        DB.state.log("项目成员 " + u.id, "授予 " + p.id + " " + d.role + " 权限：" + d.reason, "成功", p.id);
        App.toast("已授予 " + u.name + " 在 " + p.name + " 的" + d.role + "权限"); App.refresh();
      }
    });
  });
  App.on("orgs.editGrant", (el) => {
    if (!App.guard("grant.manage")) return;
    const p = D.projects.find(x => x.id === el.dataset.project);
    const m = p && p.members.find(x => x.userId === el.dataset.user);
    if (!m) return;
    App.modal({
      title: "调整项目角色", sub: p.name + " · " + m.userId,
      body: U.fSelect("项目角色", "role", ["查看", "编辑", "审核", "管理"], { value: m.role }),
      onSubmit(d) { m.role = d.role; DB.state.log("项目授权 " + p.id, "成员 " + m.userId + " 角色调整为 " + d.role, "成功", p.id); App.toast("项目角色已更新为「" + d.role + "」"); App.refresh(); }
    });
  });
  App.on("orgs.preview", (el) => {
    const p = D.projects.find(x => x.id === el.dataset.id);
    if (!p) return;
    const activeStatuses = ["排队中", "执行中", "待执行", "待质检", "待人工处理", "失败", "重试中", "已暂停"];
    const tasks = D.tasks.filter(t => t.project === p.id && activeStatuses.indexOf(t.status) >= 0);
    const assets = D.assets.filter(a => a.project === p.id);
    App.drawer("移交预览 · " + p.name, U.desc([["项目编号", p.id], ["当前负责人", p.owner], ["阶段", p.phase], ["进行中任务", tasks.length + " 项"], ["待审 / 异常", p.status], ["预算余额", "¥" + leftOf(p).toLocaleString()], ["资产", assets.length + " 项"]]));
  });
  App.on("orgs.history", () => {
    const rows = D.audits.filter(a => /成员|账号|移交|授权|停用/.test(a.object + " " + a.action));
    App.drawer("移交历史", rows.length ? U.timeline(rows.map(a => ({ time: a.time, title: a.object + " · " + a.action, desc: a.actor + " · " + a.result }))) : U.empty("暂无移交历史", "授权、停用与移交动作写入审计后在此回显。"));
  });
})();

/* ===== v9.1 真实流程层：账号停用、离职移交、协作授权 ===== */
(function () {
  const U = UI, D = DB;

  App.on("orgs.toggle", (el) => {
    if (!App.guard("org.manage")) return;
    const u = D.users.find(x => x.id === el.dataset.id);
    if (!u) return;
    const off = ["停用", "已停用"].indexOf(u.status) >= 0;
    const title = off ? "停用账号 · " + u.name : "恢复账号 · " + u.name;
    const sub = off ? "停用立即冻结会话；该员工未完成任务转为待移交，数据保留" : "恢复登录并按原授权访问项目";
    const body = off
      ? U.fTextarea("停用原因", "note", { required: true, minlen: 8, rows: 3 }) + U.fCheck("同时挂起其进行中任务", "hold", { checked: true })
      : U.fTextarea("恢复说明", "note", { required: true, minlen: 6, rows: 3 });
    App.modal({
      title: title,
      sub: sub,
      body: body,
      submitText: off ? "确认停用" : "确认恢复",
      onSubmit(d) {
        return App.job({
          title: off ? "停用账号" : "恢复账号", steps: ["校验账号状态", "更新会话与任务", "写审计"],
          run() {
            const r = DB.state.memberStatus(u.id, off ? "disable" : "enable");
            if (!r.ok) return r;
            if (off && d.hold) {
              const own = D.tasks.filter(t => t.executor === u.name && ["排队中", "执行中", "待执行"].indexOf(t.status) >= 0);
              own.forEach(t => { t.status = "待移交"; });
              if (own.length) DB.state.notify({ type: "离职移交", project: own.map(x => x.id).join("、"), title: u.name + " 的 " + own.length + " 个任务已挂起待移交", reason: "账号停用，进行中任务按策略暂停", impact: "未完成任务不再派发，已发生费用归属不变", state: "待处理", action: "指定接手人并完成项目移交", owner: u.dept || "企业管理员", link: "orgs/handover" });
            }
            DB.state.log("员工 " + u.id, (off ? "停用账号：" : "恢复账号：") + d.note, "成功", u.id);
            return { ok: true, msg: r.msg + (off && d.hold ? "；进行中任务已挂起" : "") };
          }
        });
      }
    });
  });

  App.on("orgs.offboard", (el) => {
    if (!App.guard("grant.manage")) return;
    const u = D.users.find(x => x.id === el.dataset.id);
    if (!u) return;
    App.modal({
      title: "离职移交 · " + u.name, sub: "先挂起任务与回收授权，再停用账号；历史数据不删除",
      body: U.fSelect("接手员工", "user", D.users.filter(x => ["停用", "已停用"].indexOf(x.status) < 0 && x.id !== u.id).map(x => ({ value: x.id, label: x.name + "（" + x.dept + "）" })), { required: true }) +
        U.fCheck("挂起进行中任务并转交待办", "pause", { checked: true }) +
        U.fCheck("回收项目成员授权（历史记录保留）", "revoke", { checked: true }) +
        U.fCheck("回收其个人配置的托管权限", "cred", { checked: true }) +
        U.fTextarea("移交说明", "note", { required: true, minlen: 10, rows: 3, placeholder: "说明待办、风险、预算余额处理与接手人确认" }),
      submitText: "提交移交",
      onSubmit(d) {
        return App.job({
          title: "离职移交", steps: ["挂起任务", "回收授权", "停用账号并写审计"],
          run() {
            const to = D.users.find(x => x.id === d.user);
            if (!to) return { ok: false, msg: "接手员工不存在", fields: { user: "请选择接手人" } };
            const own = D.tasks.filter(t => t.executor === u.name && ["排队中", "执行中", "待执行"].indexOf(t.status) >= 0);
            if (d.pause) own.forEach(t => { t.status = "待移交"; t.transferTo = to.name; });
            /* 项目负责人变更：离职人不得继续担任负责人（业务方案 §4.8 员工离职） */
            const ownedProjects = D.projects.filter(p => p.ownerId === u.id);
            ownedProjects.forEach(p => {
              p.historyOwners = (p.historyOwners || []).concat([{ owner: p.owner, ownerId: p.ownerId, at: DB.state.at(), reason: "离职移交给 " + to.name }]);
              p.owner = to.name; p.ownerId = to.id;
              p.members = p.members || [];
              if (!p.members.some(m => m.userId === to.id)) p.members.push({ userId: to.id, role: "管理" });
            });
            if (d.revoke) D.projects.forEach(p => { if (p.members) p.members = p.members.filter(m => m.userId !== u.id); });
            const r = DB.state.memberStatus(u.id, "disable");
            if (!r.ok) return r;
            DB.state.log("员工 " + u.id, "离职移交至 " + to.name + "：" + d.note + "；变更负责人项目 " + ownedProjects.length + " 个", "成功", u.id);
            DB.state.notify({ type: "离职移交", project: ownedProjects.map(p => p.id).join("、") || "—", title: u.name + " 已离职并完成移交", reason: d.note, impact: own.length + " 个任务挂起待接手；" + ownedProjects.length + " 个项目负责人变更为 " + to.name + "；历史数据与费用归属不变", state: "已完成", action: "接手人确认预算预检与资源可用性后恢复任务", owner: to.name, link: "orgs/handover" });
            return { ok: true, msg: u.name + " 已移交：" + own.length + " 个任务挂起 → " + to.name + "；" + ownedProjects.length + " 个项目负责人已变更；授权已回收，账号已停用" };
          }
        });
      }
    });
  });

  App.on("orgs.newMember", () => {
    if (!App.guard("org.manage")) return;
    App.modal({
      title: "邀请员工加入企业", sub: "新账号进入「邀请中」，完成认证与授权后才可访问项目",
      body: U.fField("姓名", "name", { required: true, minlen: 2, max: 12 }) + U.fField("企业邮箱", "email", { required: true, pattern: "^[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}$", placeholder: "name@example.local" }) +
        '<div class="form-grid">' + U.fSelect("所属部门", "dept", D.departments.map(d => d.name), { required: true }) + U.fSelect("初始角色", "role", ["普通员工", "项目负责人", "部门管理员"], { required: true }) + "</div>" +
        U.fCheck("同时授予工作台访问权限", "grant", { checked: true }),
      submitText: "发送邀请",
      onSubmit(d) {
        return App.job({
          title: "邀请员工", steps: ["校验邮箱唯一性", "创建账号", "发送邀请"],
          run() {
            if (D.users.some(x => x.email === d.email)) return { ok: false, msg: "该邮箱已存在账号", fields: { email: "邮箱已占用" } };
            const roleMap = { "普通员工": "staff", "项目负责人": "owner", "部门管理员": "dept" };
            const id = "u-" + String(D.users.length + 1).padStart(2, "0");
            D.users.push({ id: id, name: d.name, email: d.email, dept: d.dept, role: d.role, roles: [roleMap[d.role]], status: "邀请中", session: "未激活", joined: DB.state.time(), projects: 0, delivered: 0, episodes: 0, cost: 0, quality: 0, resources: "待配置" });
            if (D.enterprise) D.enterprise.members = (D.enterprise.members || 0) + 1;
            DB.state.log("员工 " + id, "邀请加入：" + d.name + "（" + d.dept + " · " + d.role + "）", "成功", id);
            return { ok: true, msg: "邀请已发送给 " + d.name + "，账号 " + id + " 处于「邀请中」" };
          }
        });
      }
    });
  });

  App.on("orgs.toHandover", (el) => {
    const pid = el && el.dataset && el.dataset.id;
    if (pid) App.set(SCOPE, "handoverProject", pid);
    App.go("orgs/handover");
  });
  App.on("orgs.transfer", (el) => {
    if (!App.guard("grant.manage")) return;
    const requested = (el && el.dataset && el.dataset.pid) || "";
    /* 候选项目 = 当前身份可见范围内由他人负责且未终结的项目（不再固定取第一条） */
    const candidates = D.projects.filter(x => x.status !== "已归档" && x.status !== "已终止" && (!requested || x.id === requested));
    if (!candidates.length) { App.toast("当前没有可移交的项目", "bad"); return; }
    const p = candidates[0];
    App.modal({
      title: "发起项目移交", sub: "移交不转移个人凭据与个人资源，不改变历史执行人与费用归属",
      body: U.fSelect("待移交项目", "project", candidates.map(x => ({ value: x.id, label: x.id + " · " + x.name + "（" + x.status + "）" })), { required: true, value: p.id }) +
        U.fSelect("接手员工", "user", D.users.filter(u => u.status === "在职" && u.id !== p.ownerId).map(u => ({ value: u.id, label: u.name + "（" + u.dept + "）" })), { required: true }) +
        U.fTextarea("移交原因", "reason", { required: true, minlen: 8, rows: 3 }) +
        U.notice("接手人须使用本人模型配置，并重新执行预算预检与资源可用性检查；未完成任务按策略暂停，不得使用原负责人的个人配置发起新调用。", "warn"),
      submitText: "确认移交",
      onSubmit(d) {
        return App.job({
          title: "项目移交", steps: ["生成移交预览", "暂停未完成任务", "变更负责人并重做预算与资源预检", "写审计与通知"],
          run() {
            const proj = D.projects.find(x => x.id === d.project);
            const to = D.users.find(x => x.id === d.user);
            if (!proj || !to) return { ok: false, msg: "项目或接手人不存在" };
            if (to.status !== "在职") return { ok: false, msg: "接手人账号状态为「" + to.status + "」，不能接管项目", fields: { user: "接手人账号非在职状态" } };
            /* 移交预览：进行中任务 / 待审核事项 / 资产清单 / 交付状态 / 预算余额 / 风险项 */
            const running = D.tasks.filter(t => t.project === proj.id && ["排队中", "执行中", "待执行", "重试中"].indexOf(t.status) >= 0);
            const pendingReview = D.reviews.filter(r => r.project === proj.id && r.result !== "通过").length;
            const assetCount = D.assets.filter(a => a.project === proj.id).length;
            const delivery = D.deliveries.filter(dl => dl.project === proj.id && dl.status !== "未生成（集数未齐）").length;
            const bg = DB.state.budgetOf(proj.id);
            const riskCount = D.risks.filter(r => r.project === proj.id && r.status !== "已闭环").length;
            /* 校验接手人个人资源配置状态（业务方案 §5.7 步骤 2） */
            const own = D.providers.filter(pv => pv.ownerId === to.id && pv.status === "启用");
            if (!own.length) return { ok: false, msg: "接手人 " + to.name + " 没有启用的个人模型配置，无法接管项目", fields: { user: "接手人无可用配置" } };
            const from = proj.owner;
            /* 保留原负责人为项目成员并记录历史负责人（业务方案 §5.7 步骤 7） */
            proj.members = proj.members || [];
            if (!proj.members.some(m => m.userId === proj.ownerId)) proj.members.push({ userId: proj.ownerId, role: "查看" });
            proj.historyOwners = (proj.historyOwners || []).concat([{ owner: from, ownerId: proj.ownerId, at: DB.state.at(), reason: d.reason || "负责人变更" }]);
            /* 未完成任务按策略暂停（业务方案 §5.7 步骤 5） */
            running.forEach(t => { t.status = "已暂停"; t.failReason = "项目移交：等待接手人确认后恢复"; });
            /* 不得使用原负责人的个人配置发起新调用（业务方案 §5.7 步骤 5） */
            D.tasks.filter(t => t.project === proj.id && t.config && proj.ownerId).forEach(t => {
              const cfg = D.providers.find(pv => pv.id === t.config);
              if (cfg && cfg.ownerId === proj.ownerId) t.config = own[0].id;
            });
            proj.owner = to.name; proj.ownerId = to.id;
            if (!proj.members.some(m => m.userId === to.id)) proj.members.push({ userId: to.id, role: "管理" });
            /* 接手人重新做预算预检（业务方案 §5.7 步骤 6） */
            const budgetChk = bg ? (bg.used <= bg.total ? "预算余额充足（剩余 ¥" + DB.state.money(bg.total - bg.used) + "）" : "预算已超限，需调整后恢复") : "该项目未建立预算";
            const precheck = "预算预检：" + budgetChk + "；资源预检：接手人可用配置 " + own.length + " 项（" + own.map(c => c.id).join("、") + "）";
            const preview = "移交预览：进行中任务 " + running.length + " 个、待审核 " + pendingReview + " 项、资产 " + assetCount + " 项、交付记录 " + delivery + " 条、预算余额 ¥" + (bg ? DB.state.money(Math.max(0, bg.total - bg.used)) : "0") + "、未闭环风险 " + riskCount + " 项";
            DB.state.notify({ type: "项目移交", project: proj.id, title: "负责人由 " + from + " 移交至 " + to.name, reason: d.reason || "负责人变更", impact: preview + "；个人凭据不随项目转移，" + running.length + " 个未完成任务已暂停并改由接手人本人配置承接", state: "已完成", action: "接手人确认" + precheck + "后恢复任务", owner: to.name, link: "projects/detail" });
            DB.state.log("项目 " + proj.id, "负责人移交 " + from + " → " + to.name + "：" + d.reason + "；" + preview + "；暂停未完成任务 " + running.length + " 个；" + precheck, "成功", proj.id);
            return { ok: true, msg: proj.id + " 已移交至 " + to.name + "；未完成任务 " + running.length + " 个已暂停，" + precheck };
          }
        });
      }
    });
  });

  App.on("orgs.grantNew", () => {
    if (!App.guard("grant.manage")) return;
    App.modal({
      title: "新增项目授权", sub: "非项目成员即使持有功能权限码也不得访问项目内数据",
      body: U.fSelect("项目", "project", D.projects.filter(p => p.status !== "已归档" && p.status !== "已终止").map(p => ({ value: p.id, label: p.id + " · " + p.name })), { required: true }) +
        U.fSelect("员工", "user", D.users.filter(u => u.status === "在职").map(u => ({ value: u.id, label: u.name + "（" + u.dept + "）" })), { required: true }) +
        U.fSelect("项目角色", "role", ["查看", "编辑", "审核", "管理"], { required: true }),
      submitText: "写入授权",
      onSubmit(d) {
        return App.job({
          title: "新增项目授权", steps: ["校验成员关系", "写入项目成员", "写审计"],
          run() {
            const p = D.projects.find(x => x.id === d.project), u = D.users.find(x => x.id === d.user);
            if (!p || !u) return { ok: false, msg: "项目或员工不存在" };
            p.members = p.members || [];
            if (p.members.some(m => m.userId === u.id)) return { ok: false, msg: "该员工已是项目成员，请改用角色变更", fields: { user: "已是成员" } };
            p.members.push({ userId: u.id, role: d.role });
            DB.state.log("项目 " + p.id, "新增成员 " + u.name + "（" + d.role + "）", "成功", p.id);
            return { ok: true, msg: u.name + " 已加入 " + p.id + "，角色 " + d.role };
          }
        });
      }
    });
  });

  App.on("orgs.revokeGrant", (el) => {
    if (!App.guard("grant.manage")) return;
    const p = D.projects.find(x => x.id === (el.dataset.project || ""));
    const uid = el.dataset.user;
    if (!p || !uid) return;
    const m = (p.members || []).find(x => x.userId === uid);
    if (!m) { App.toast("该员工不是项目成员", "bad"); return; }
    App.modal({
      title: "回收项目授权", sub: "回收后该员工立即失去项目数据访问；历史记录保留",
      body: U.fTextarea("回收原因", "note", { required: true, minlen: 8, rows: 3 }),
      submitText: "确认回收",
      onSubmit(d) {
        return App.job({
          title: "回收授权", steps: ["校验成员角色", "移除成员关系", "写审计"],
          run() {
            p.members = p.members.filter(x => x.userId !== uid);
            DB.state.log("项目 " + p.id, "回收成员授权：" + uid + " · " + d.note, "成功", p.id);
            return { ok: true, msg: "已回收 " + uid + " 在 " + p.id + " 的授权" };
          }
        });
      }
    });
  });
})();
