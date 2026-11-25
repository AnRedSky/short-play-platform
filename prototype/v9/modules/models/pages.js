/* 模块：models 模型资源、供应商与路由策略 */
(function () {
  const U = UI, D = DB, SCOPE = "models";

  AppModule.register({
    group: "models", label: "模型与资源", icon: "cpu", order: 11, end: "workspace",
    routes: [
      {
        path: "models/config", title: "资源配置", icon: "cpu", permission: ["models.own", "models.manage"],
        desc: "资源归属分「个人自持」与「企业托管」：个人自持使用本人凭据与额度，企业托管由企业统一分配配额。",
        render() {
          const me = App.identity();
          const mine = D.providers.filter(p => p.ownerId === me.userId);
          const selfP = mine.filter(p => String(p.quota).indexOf("个人额度") >= 0);
          const allocated = mine.filter(p => String(p.quota).indexOf("企业配额") >= 0);
          const bad = mine.filter(p => p.status !== "启用");
          const usedPct = selfP.length ? Math.round(selfP.reduce((sum, p) => {
            const m = String(p.quota).match(/(\d+)%/);
            return sum + (m ? Number(m[1]) : 0);
          }, 0) / selfP.length) : 0;
          const bars = selfP.slice(0, 4).map(p => ({ label: String(p.capabilities).split(" / ")[0], value: (String(p.quota).match(/(\d+)%/) || [0, "0"])[1] }));
          /* 管理员视图（R-27）：企业托管资源的分配与额度，不是「我的资源」的另一份复制 */
          const entList = D.providers.filter(p => p.mode === "企业托管" || String(p.quota).indexOf("企业配额") >= 0);
          const entBlock = App.can("models.manage")
            ? U.card("企业托管资源与额度（管理员视图）", U.table(["资源", "归属", "能力", "额度归属", "状态", "凭据可见性"], entList.map(p =>
              '<tr><td class="cell-strong">' + U.esc(p.name) + '<div class="faint small">' + U.esc(p.id) + '</div></td><td>' + U.esc(p.owner) + '</td><td class="cell-wrap">' + U.esc(p.capabilities) + '</td><td class="cell-wrap">' + U.esc(p.quota) + '</td><td>' + U.pill(p.status) + '</td><td class="cell-wrap muted">全员仅见脱敏值，管理员也不得读取明文</td></tr>').join("")), "分配对象与额度来自企业托管配置，不与个人自持混算")
            : "";
          const rows = mine.map(p =>
            '<tr><td>' + U.entity(p.name, p.id, "◉") + '</td><td>' + U.pill(p.mode || "个人自持", p.mode === "企业托管" ? "info" : "accent") + '</td><td class="cell-wrap">' + U.esc(p.kind) + '</td><td class="cell-wrap">' + U.esc(p.capabilities) + '</td><td class="cell-wrap muted">' + U.esc(p.endpoint) + '</td><td>' + U.esc(p.quota) + "</td><td>" + U.masked(p.masked) + "</td><td>" + U.pill(p.status) + "</td><td>" +
            U.btn("测试", "models.test", "sm", { id: p.id }) + " " + U.btn("设为默认", "models.setDefault", "sm", { id: p.id }) + " " +
            U.btn("更新凭据", "models.updateCredential", "sm", { id: p.id }) + " " +
            U.btn(p.status === "启用" ? "停用" : "启用", "models.toggle", "sm", { id: p.id }) + " " +
            U.btn("删除", "models.remove", "sm", { id: p.id }) + "</td></tr>").join("");
          return U.page("模型与资源 / 资源配置", "资源配置", "每个任务执行时明确归属：使用谁的配置、谁的额度，避免「借用他人配置」这类不可审计的做法。",
            (App.can("models.manage")
              ? U.btn("供应商与模型", "models.toProviders", "primary") + U.btn("路由策略", "models.toRouting")
              : U.btn("新增资源", "models.newProvider", "primary")),
            '<div class="grid grid-4">' +
              U.metric("个人自持", String(selfP.length), "使用本人凭据与个人额度", "◉") +
              U.metric("企业托管资源", String(allocated.length), allocated.length ? allocated.map(p => p.name).join(" / ") : "当前无企业分配资源", "◇") +
              U.metric("已用额度", usedPct + "%", "个人额度平均占用", "▮") +
              U.metric("异常资源", String(bad.length), bad.length ? bad.map(p => p.id + " " + p.status).join(" / ") : "当前无异常", "!") +
            "</div>" +
            U.card("我的资源配置", U.table(["供应商", "供给模式", "类型", "能力", "端点", "额度", "凭据（脱敏）", "状态", "操作"], rows)) +
            (entBlock ? '<div class="mt-4">' + entBlock + "</div>" : "") +
            '<div class="split mt-4"><div class="stack">' +
              U.card("资源归属与可见性", U.table(["归属", "凭据可见性", "额度归属", "适用角色"], [
                ["个人自持", "仅本人可见脱敏值", "计入个人额度", "员工 / 负责人"],
                ["企业托管", "全员仅见脱敏", "按部门分配", "部门 / 企业管理员"],
                ["运维域", "不可见（独立安全域）", "平台级", "系统运维管理员"]
              ].map(r => '<tr><td class="cell-strong">' + r[0] + '</td><td class="cell-wrap">' + r[1] + '</td><td class="cell-wrap muted">' + r[2] + "</td><td>" + r[3] + "</td></tr>").join("")), "凭据永不明文展示") +
              U.card("PRV 资源异常" + (bad.length ? " · " + bad.length + " 项" : ""), bad.length ? U.notice(bad.map(p => p.id + " " + p.name + " 停用： " + p.test).join("；") + "。停用状态下引用它的任务会直接失败，不会静默回退。", "bad") : U.notice("当前身份名下资源全部启用。", "ok")) +
            '</div><div class="stack">' +
              U.card("额度占用", bars.length ? U.bars(bars.map(x => x.label), bars.map(x => Number(x.value)), "%") : U.empty("没有个人资源", "当前身份没有个人自持资源。"), "个人额度按能力统计") +
              U.card("资源验证记录", mine.length ? U.listRows(mine.map(p => [p.id + " " + p.name, p.test + " · " + p.status])) : U.empty("没有验证记录", "个人资源接入后会在这里显示最近验证结果。"), "来自供应商真实验证状态") +
              U.notice("口径与规则见《口径与规则汇总》§R-17：安全边界", "info") +
            "</div></div>"
          );
        }
      },
      {
        path: "models/providers", title: "供应商与模型", icon: "cpu", permission: "models.manage",
        desc: "供应商与模型档案：接入方式、区域、能力、单价与许可都要登记，才允许被路由选中。",
        render() {
          const prow = D.providers.map(p =>
            '<tr><td>' + U.code(p.id) + '</td><td class="cell-strong">' + U.esc(p.name) + '<div class="faint small">' + U.esc(p.kind) + " · " + U.esc(p.owner) + '</div></td><td class="cell-wrap muted">' + U.esc(p.endpoint) + '</td><td>' + U.esc(p.auth) + '<div class="faint small">' + U.esc(p.region) + '</div></td><td class="cell-wrap">' + U.esc(p.capabilities) + '</td><td>' + U.masked(p.masked) + "</td><td>" + U.esc(p.test) + "</td><td>" + U.pill(p.status) + "</td><td>" +
            U.btn("测试", "models.test", "sm", { id: p.id }) + "</td></tr>").join("");
          const mrow = D.modelProfiles.map(m =>
            '<tr><td>' + U.code(m.id) + '</td><td>' + U.code(m.provider) + '</td><td class="cell-strong">' + U.esc(m.model) + '</td><td>' + U.esc(m.cap) + '</td><td class="cell-wrap">' + U.esc(m.io) + '</td><td class="cell-wrap muted">' + U.esc(m.limits) + '</td><td>' + U.esc(m.price) + '</td><td class="cell-wrap">' + U.esc(m.license) + "</td></tr>").join("");
          return U.page("模型与资源 / 供应商与模型", "供应商与模型", "接入失败不是「模型不行」：必须区分鉴权、限流、参数不支持与上游故障。",
            U.btn("新增资源", "models.newProvider", "primary") + U.btn("查看调用日志", "models.toLogs"),
            U.card("供应商（" + D.providers.length + " 家）", U.table(["编号", "供应商 · 归属人", "端点", "鉴权 · 区域", "能力", "凭据", "验证", "状态", "操作"], prow), "归属人与区域并入列；凭据只显示脱敏串") +
            U.card("模型能力档案（" + D.modelProfiles.length + " 个）", U.table(["档案", "供应商", "模型", "能力", "输入 / 输出", "限制", "单价", "许可"], mrow)) +
            '<div class="grid grid-2 mt-4">' +
              U.card("接入方式", U.listRows([["内置适配器", "平台维护、开箱即用"], ["兼容接口", "标准 OpenAI 兼容协议"], ["自定义 HTTP", "需登记签名与重试规则"]]) , "自定义接入需运维审批") +
              U.card("错误分类", U.table(["错误码", "含义", "处理"], [["E-4011", "供应商超时", "退避 60s 重试"], ["E-4101", "鉴权失败", "停用并要求重新授权"], ["E-4102", "参数不支持", "降级或换模型"], ["E-4203", "音色不存在", "修正档案引用"]].map(r => '<tr><td>' + U.code(r[0]) + '</td><td class="cell-wrap">' + r[1] + '</td><td class="cell-wrap muted">' + r[2] + "</td></tr>").join("")), "错误决定后续动作") +
            "</div>"
          );
        }
      },
      {
        path: "models/routing", title: "能力与路由", icon: "route", permission: "models.manage",
        desc: "路由策略绑定项目与能力：主模型、辅助能力、备用模型与兼容校验结论一并固化，切换备用前必须逐项通过。",
        render() {
          const capRows = D.capabilities.map(c =>
            '<tr><td class="cell-strong">' + U.esc(c.cap) + '</td><td class="cell-wrap">' + U.esc(c.use) + '</td><td>' + U.esc(c.io) + "</td><td>" + U.esc(c.unit) + '</td><td class="num">' + c.models + "</td></tr>").join("");
          const compatRows = D.routePolicy.compat.map(c =>
            "<tr><td>" + U.esc(c.item) + '</td><td class="cell-wrap">' + U.esc(c.primary) + '</td><td class="cell-wrap">' + U.esc(c.backup) + "</td><td>" + U.pill(c.ok ? "通过" : "不满足", c.ok ? "ok" : "bad") + "</td></tr>").join("");
          const vc = D.videoCapabilities.slice(0, 7);
          const noCompat = D.routePolicy.compat.filter(c => !c.ok);
          const noCompatText = noCompat.map(c => c.item).join("、");
          return U.page("模型与资源 / 能力与路由", "能力与路由", "备用模型不是自动兜底：兼容项不满足时不允许切换，只能人工决策或调整镜头设计。",
            U.btn("修改路由策略", "models.editRoute", "primary") + U.btn("供应商与模型", "models.toProviders"),
            '<div class="grid grid-4">' +
              U.metric("能力项", String(D.capabilities.length), "文本到成片全链路", "▤") +
              U.metric("视频能力", String(D.videoCapabilities.length), "已接入 / 受限 / 规则实现", "▦") +
              U.metric("后期能力", String(D.postCapabilities.length), "剪辑到输出", "✂") +
              U.metric("兼容不满足", String(noCompat.length) + " 项", noCompatText || "全部兼容项通过", "!") +
            "</div>" +
            U.card("路由策略 · " + D.routePolicy.version, U.desc([["项目", D.routePolicy.project], ["能力", D.routePolicy.capability], ["主模型", D.routePolicy.primary], ["辅助", D.routePolicy.aux], ["备用", D.routePolicy.backup], ["依据", D.routePolicy.basis], ["更新", D.routePolicy.updated + " · " + D.routePolicy.by]]) +
              (noCompat.length ? U.notice("备用模型 " + noCompat.length + " 项兼容不满足（" + noCompatText + "）：切换到备用会产生画质与一致性降级，必须人工确认。", "warn") : U.notice("备用模型兼容校验全部通过。", "ok")), "策略与兼容结论一起固化") +
            U.card("备用切换兼容校验", U.table(["兼容项", "主模型", "备用模型", "结论"], compatRows), "无兼容校验") +
            '<div class="split mt-4"><div class="stack">' +
              U.card("能力清单", U.table(["能力", "典型用途", "输入 / 输出", "计价单位", "模型数"], capRows)) +
              U.card("剪辑与后期能力", '<div class="chip-row">' + D.postCapabilities.map(x => '<span class="chip">' + U.esc(x) + "</span>").join("") + "</div>", "后期能力由转码与合成能力组合实现") +
            '</div><div class="stack">' +
              U.card("视频能力可用性", U.table(["能力", "状态", "说明"], vc.map(x => '<tr><td>' + U.esc(x.item) + "</td><td>" + U.pill(x.status) + '</td><td class="cell-wrap muted">' + U.esc(x.note) + "</td></tr>").join(""), "暂无能力记录")) +
              U.card("路由原则", U.listRows([["主模型", "默认质量优先，预算内"], ["辅助", "只做校验类调用，不产出正式资产"], ["备用", "仅故障时启用，需兼容校验"], ["记录", "每次切换写审计与成本归因"]]) , "路由变更需留痕") +
            "</div></div>"
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("models.toRouting", () => App.go("models/routing"));
  App.on("models.toProviders", () => App.go("models/providers"));
  App.on("models.toLogs", () => App.go("tasks/attempt"));
})();

/* ===== v9.1 真实流程层：配置连通性、默认模型与路由 ===== */
(function () {
  const U = UI, D = DB;

  App.on("models.test", (el) => {
    if (!App.guard(["models.own", "models.manage"])) return;
    const id = el.dataset.id;
    const p = D.providers.find(x => x.id === id);
    if (!p) return;
    const actor = App.identity();
    if (!App.can("models.manage") && p.ownerId !== actor.userId) { App.toast("只能测试本人自持的资源配置", "bad"); return; }
    App.job({
      title: "连通性测试 · " + id, steps: ["读取脱敏凭据", "发起探测请求", "记录结果"],
      run() {
        const r = DB.state.testProvider(id);
        if (!r.ok) return r;
        return { ok: true, msg: r.msg };
      }
    });
  });

  /* 凭据更新（业务方案 §13.5 第 7 步）：只保存脱敏元数据，明文不可回显 */
  App.on("models.updateCredential", (el) => {
    if (!App.guard(["models.own", "models.manage"])) return;
    const id = el.dataset.id;
    const p = D.providers.find(x => x.id === id);
    if (!p) return;
    const actor = App.identity();
    if (!App.can("models.manage") && p.ownerId !== actor.userId) { App.toast("只能更新本人自持的资源配置", "bad"); return; }
    App.modal({
      title: "更新凭据 · " + id, sub: "凭据在服务端加密保存，界面只显示脱敏值；审计只记录变更元数据",
      body: U.fField("当前凭据（脱敏）", "cur", { value: p.masked, readonly: true }) +
        U.fField("新 API Key / Token", "key", { required: true, minlen: 8, placeholder: "至少 8 位" }) +
        U.notice("更新后新任务使用新版本；历史任务保留配置引用标识但不回显密钥。", "info"),
      submitText: "更新凭据",
      onSubmit(d) {
        return App.job({
          title: "更新凭据", steps: ["校验凭据格式", "加密写入并生成新版本", "写审计（仅元数据）"],
          run() { return DB.state.updateCredential(id, d.key); }
        });
      }
    });
  });

  /* 启用 / 停用资源配置（业务方案 §13.7：配置失效时暂停相关任务并通知配置人） */
  App.on("models.toggle", (el) => {
    if (!App.guard(["models.own", "models.manage"])) return;
    const id = el.dataset.id;
    const p = D.providers.find(x => x.id === id);
    if (!p) return;
    const actor = App.identity();
    if (!App.can("models.manage") && p.ownerId !== actor.userId) { App.toast("只能调整本人自持的资源配置", "bad"); return; }
    const on = p.status !== "启用";
    App.confirm((on ? "启用" : "停用") + "资源配置 · " + id, on
      ? "启用后该配置可被新任务选用；历史任务保留原引用标识。"
      : "停用后引用该配置的任务将直接失败（不会静默改用他人凭据），并需通知配置人更新凭据。", () => {
        App.job({
          title: (on ? "启用" : "停用") + "资源配置", steps: ["校验归属与状态", "更新配置状态", "联动受影响任务"],
          run() {
            const r = DB.state.toggleProvider(id, on);
            if (!r.ok) return r;
            if (!on) {
              const hit = D.tasks.filter(t => t.config === id && ["排队中", "执行中", "待执行", "重试中"].indexOf(t.status) >= 0);
              hit.forEach(t => { t.status = "已暂停"; t.failReason = "资源配置已停用：" + id; });
              if (hit.length) {
                DB.state.notify({ type: "资源失效", project: hit[0].project, title: "资源配置 " + id + " 已停用，" + hit.length + " 个任务暂停", reason: "配置状态变更为停用", impact: "相关任务不再派发；不得静默改用其他员工凭据", state: "待处理", action: "更新凭据并重新做连通性测试后恢复任务", owner: p.owner || "配置人", link: "tasks/list" });
              }
              return { ok: true, msg: r.msg + "；已暂停引用该配置的 " + hit.length + " 个任务并通知配置人" };
            }
            return { ok: true, msg: r.msg };
          }
        });
      }, on ? "确认启用" : "确认停用");
  });

  /* 删除资源配置：被任务引用的配置保留历史快照，禁止直接删除 */
  App.on("models.remove", (el) => {
    if (!App.guard(["models.own", "models.manage"])) return;
    const id = el.dataset.id;
    const p = D.providers.find(x => x.id === id);
    if (!p) return;
    const actor = App.identity();
    if (!App.can("models.manage") && p.ownerId !== actor.userId) { App.toast("只能删除本人自持的资源配置", "bad"); return; }
    const refs = D.tasks.filter(t => t.config === id);
    if (refs.length) { App.toast("该配置已被 " + refs.length + " 个任务引用，删除会破坏历史追溯，已阻断；请改为停用", "bad"); return; }
    App.confirm("删除资源配置 · " + id, "删除后不可恢复。被任务引用的配置会保留历史快照，不得删除。", () => {
      App.job({
        title: "删除资源配置", steps: ["校验引用关系", "移除配置", "写审计"],
        run() {
          const i = D.providers.indexOf(p);
          if (i < 0) return { ok: false, msg: "配置不存在" };
          D.providers.splice(i, 1);
          DB.state.log("个人凭据 " + id, "删除资源配置（仅记录元数据）", "成功", id);
          return { ok: true, msg: "资源配置已删除：" + id };
        }
      });
    }, "确认删除");
  });

  App.on("models.setDefault", (el) => {
    if (!App.guard(["models.own", "models.manage"])) return;
    const id = el.dataset.id;
    const p = D.providers.find(x => x.id === id);
    if (!p) return;
    const actor = App.identity();
    if (!App.can("models.manage") && p.ownerId !== actor.userId) { App.toast("只能把本人自持的配置设为默认", "bad"); return; }
    if (p.status !== "启用") { App.toast("停用或待验证配置不能设为默认：" + id, "bad"); return; }
    if (p.test && p.test.indexOf("失效") >= 0) { App.toast("配置连通性未通过，不能设为默认：" + id, "bad"); return; }
    App.confirm("设为默认模型", p.name + " 将成为新任务的默认模型；已提交任务不追溯。", () => {
      App.job({
        title: "设为默认", steps: ["校验启用与连通性", "写入默认模型"],
        run() { D.providers.forEach(x => { x.isDefault = x.id === id; }); DB.state.log("配置 " + id, "设为默认模型", "成功", id); return { ok: true, msg: p.name + " 已设为默认模型" }; }
      });
    }, "设为默认");
  });

  App.on("models.newProvider", () => {
    if (!App.guard(["models.own", "models.manage"])) return;
    App.modal({
      title: "新增资源配置", sub: "凭据只保存脱敏元数据，不落明文",
      body: U.fField("名称", "name", { required: true, minlen: 3 }) +
        U.fSelect("类型", "type", ["视频生成", "图像生成", "语音合成", "质量检测"]) +
        U.fField("Base URL", "url", { required: true, pattern: "^https://[\\w./-]+$", placeholder: "https://api.example.com/v1" }) +
        U.fField("API Key", "key", { required: true, minlen: 8, hint: "仅保存脱敏展示，写入后不可回显" }),
      submitText: "创建配置",
      onSubmit(d) {
        return App.job({
          title: "创建资源配置", steps: ["校验 URL 与凭据格式", "写入配置", "提示连通性测试"],
          run() {
            const actor = App.identity();
            const user = D.users.find(u => u.id === actor.userId) || { name: actor.name.split(" · ")[0] };
            const ids = D.providers.map(p => Number(String(p.id).replace(/[^\d]/g, "")) || 0);
            const id = "PRV-" + String((ids.length ? Math.max.apply(null, ids) : 0) + 1).padStart(2, "0");
            D.providers.unshift({ id: id, ownerId: actor.userId, owner: user.name, name: d.name, kind: "自定义 HTTP", capabilities: d.type, endpoint: d.url, auth: "Bearer Token", region: "境内", quota: "个人额度 · 已用 0%", masked: d.key.slice(0, 3) + "••••••••" + d.key.slice(-4), status: "待验证", test: "待验证", defaultFor: "—" });
            DB.state.log("配置 " + id, "新增：" + d.name + " · " + user.name, "成功", id);
            return { ok: true, msg: "配置 " + id + " 已创建，请执行连通性测试后再用于生产" };
          }
        });
      }
    });
  });

  App.on("models.editRoute", () => {
    if (!App.guard("models.manage")) return;
    App.modal({
      title: "编辑路由策略", sub: "路由变更影响新任务，不追溯已提交任务",
      body: U.fSelect("默认视频模型", "video", D.providers.filter(p => p.status === "启用").map(p => p.name), { required: true }) +
        U.fSelect("备用模型", "backup", ["无备用", "视频模型 B（备用）"], { required: true }) +
        U.fField("失败自动切换阈值（次）", "retry", { required: true, type: "number", min: 1, max: 3, value: "2" }) +
        U.fTextarea("变更原因", "note", { required: true, minlen: 8, rows: 3 }),
      submitText: "保存路由",
      onSubmit(d) {
        return App.job({
          title: "保存路由策略", steps: ["校验备用模型兼容", "写入路由", "写审计"],
          run() {
            if (d.backup !== "无备用") {
              const bad = (D.routePolicy.compat || []).filter(c => !c.ok);
              if (bad.length) return { ok: false, msg: "备用模型兼容校验未通过：" + bad.map(b => b.item).join("、"), fields: { backup: "兼容校验未通过" } };
            }
            D.routePolicy.video = d.video; D.routePolicy.backup = d.backup; D.routePolicy.retry = Number(d.retry);
            DB.state.log("路由策略", d.video + " / " + d.backup + "：" + d.note, "成功", "route");
            return { ok: true, msg: "路由已更新：" + d.video + "，备用 " + d.backup };
          }
        });
      }
    });
  });
})();
