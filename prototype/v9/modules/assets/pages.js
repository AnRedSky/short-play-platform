/* 模块：assets 资产库与引用检查 */

/* 引用关系反向检索（业务方案 §14.4）：某资产被哪些镜头、时间线与交付引用。
   引用数量以真实对象为准，不按分类拼造。本文件内两个装配块共用。 */
function assetReferences(a) {
  const out = [];
  const key = String(a.name || "").split("·")[0].trim();
  DB.shots.filter(s => s.project === a.project && ((s.asset && s.asset === a.id) || (key && String(s.refs || "").indexOf(key) >= 0))).forEach(s => {
    out.push({ kind: "镜头契约引用", target: s.id, where: "E" + s.ep + " / " + s.scene + " / " + s.no });
  });
  DB.timelines.filter(t => t.project === a.project && t.assetVersion === a.version).forEach(t => {
    out.push({ kind: "时间线引用", target: t.version, where: "E" + t.ep + " · " + t.version });
  });
  DB.deliveries.filter(d => d.project === a.project && d.status !== "未生成（集数未齐）").forEach(d => {
    out.push({ kind: "交付包引用", target: d.id, where: d.version + " · " + d.status });
  });
  return out;
}

(function () {
  const U = UI, D = DB, SCOPE = "assets";

  /* ---------- 引用（原 assets/usage，B2·M5 并入资产库的「引用」tab） ----------
     删除或替换任何资产前必须查引用：引用未清理就删除会造成时间线与交付包断链。 */
  const usageOf = (p) => {
    const pid = p ? p.id : "";
    const visPids = DB.derived.visibleProjects().map(x => x.id);
    const pool = pid ? D.assets.filter(a => a.project === pid) : D.assets.filter(a => visPids.indexOf(a.project) >= 0);
    /* 引用关系来自真实下游对象（镜头契约 / 时间线 / 交付包），不按分类拼造（业务方案 §14.4） */
    const usage = [];
    pool.forEach(a => {
      assetReferences(a).forEach(r => usage.push({ asset: a.id, kind: r.kind, target: r.target, where: r.where, count: 1, deletable: false }));
    });
    return usage;
  };

  const usageBlock = (p) => {
    const frozen = p && ["已交付", "已归档"].indexOf(p.status) >= 0;
    const usage = usageOf(p);
    const rows = usage.map(x =>
      '<tr><td>' + U.code(x.asset) + "</td><td>" + U.esc(x.kind) + '</td><td class="cell-wrap">' + U.esc(x.target) + '</td><td class="idx">' + U.esc(x.where) + '</td><td>' + U.pill("被引用 · 不可删除", "bad") + "</td><td>" +
      U.btn("查看链路", "assets.trace", "sm", { id: x.asset }) + "</td></tr>").join("");
    const blocked = usage[0];
    return U.card("引用关系表" + (p ? " · " + U.esc(p.name) : " · 可见项目"), U.table(["资产", "引用类型", "引用对象", "引用位置", "可删除性", "操作"], rows, "当前范围没有资产引用"), p ? "当前项目引用 · 来自镜头 / 时间线 / 交付包" : "可见项目引用 · 来自镜头 / 时间线 / 交付包") +
      '<div class="split mt-4"><div class="stack">' +
        U.card("删除前检查流程", U.chain([
          { label: "发起删除", meta: "资产 ID", state: "done" },
          { label: "列引用", meta: "时间线 / 镜头 / 交付", state: "now" },
          { label: "解除引用", meta: "替换或下线", state: "" },
          { label: "执行删除", meta: "写审计", state: "" }
        ]), "有引用即阻断删除") +
        (blocked ? U.card("删除阻断 · " + blocked.asset, U.notice(blocked.asset + " 存在 " + usage.filter(x => x.asset === blocked.asset).length + " 处引用（" + usage.filter(x => x.asset === blocked.asset).map(x => x.kind).join("、") + "），删除会直接造成下游断链：必须先替换引用对象。", "bad") + U.desc([["资产", blocked.asset], ["引用", usage.filter(x => x.asset === blocked.asset).length + " 处"], ["结论", "不可删除"], ["替代方案", "新建版本，保留原版本"]]) , "不允许强制删除")
          : U.card("删除阻断", U.notice("当前项目没有带引用的资产，可按流程删除并写审计。", "ok"), "删除仍须留痕")) +
      '</div><div class="stack">' +
        U.card("引用统计", U.donut([
          { label: "镜头契约引用", value: usage.filter(x => x.kind === "镜头契约引用").length, color: "var(--accent)" },
          { label: "时间线引用", value: usage.filter(x => x.kind === "时间线引用").length, color: "var(--info)" },
          { label: "交付包引用", value: usage.filter(x => x.kind === "交付包引用").length, color: "var(--line-strong)" }
        ], "引用条目", String(usage.length)), "按引用类型计") +
        U.card("资产可见性", U.listRows([["正式资产", "项目成员可见、可引用"], ["临时素材", "仅创建者可用"], ["交付资产", "只读，随交付冻结"], ["删除", "仅管理员可在无引用时执行"]]) , "可见性随角色变化") +
        (frozen ? '<span class="faint small">项目已交付 · 删除检查只读</span>' : (p ? '<div class="btn-row-inline">' + U.btn("删除前检查", "assets.deleteCheck", "", { id: p.id }) + "</div>" : '<span class="faint small">从单个项目进入后可执行删除检查</span>')) +
      "</div></div>";
  };

  AppModule.register({
    group: "assets", label: "资产库", icon: "box", order: 10, end: "workspace",
    routes: [
      {
        path: "assets/library", title: "资产库", icon: "box", permission: "asset.read",
        desc: "资产按八类归档，版本不覆盖：同名同 ID 只增版本，历史版本永久可查、可回指。",
        render(query) {
          const pid = (query && query.id) || "";
          const p = pid ? (D.projects.find(x => x.id === pid) || null) : null;
          if (pid && (!p || !DB.derived.canViewProject(p))) return U.page("资产 / 资产库", "项目不在可见范围", "请从项目列表进入可见项目，或由负责人授权后再查看项目资产。", U.btn("返回资产库", "assets.toLibrary", "primary"), U.empty("无法读取项目", "跨项目或不存在项目不渲染资产。"));
          const frozen = p && ["已交付", "已归档"].indexOf(p.status) >= 0;
          const cat = App.get(SCOPE, "cat", "全部");
          const kw = App.get(SCOPE, "kw", "");
          const visPids = DB.derived.visibleProjects().map(x => x.id);
          const scoped = pid ? D.assets.filter(a => a.project === pid) : D.assets.filter(a => visPids.indexOf(a.project) >= 0);
          const list = scoped.filter(a =>
            (cat === "全部" || a.cat === cat) &&
            (!kw || (a.name + a.id + a.project + a.type).indexOf(kw) >= 0));
          const bad = list.find(a => String(a.status).indexOf("临时") >= 0 || String(a.qc).indexOf("FAIL") >= 0);
          const rows = list.map(a =>
            '<tr><td>' + U.code(a.id) + '</td><td>' + U.entity(a.name, a.type, "▣") + '</td><td>' + U.esc(a.cat) + '<span class="faint small"> / ' + U.esc(a.project) + "</span></td><td>" + U.esc(a.version) + '<span class="faint small"> / ' + a.versions + "</span></td><td>" + U.esc(a.size) + '</td><td class="cell-wrap muted">' + U.esc(a.checksum) + '<div>' + U.pill(a.qc) + "</div></td><td>" + U.pill(a.status) + '</td><td class="num">' + a.refs + "</td><td>" +
            U.btn("详情", "assets.detail", "sm", { id: a.id }) + " " + U.btn("引用检查", "assets.refs", "sm", { id: a.id }) + "</td></tr>").join("");
          const toolbar = '<div class="toolbar"><span class="field-wrap"><input class="field" data-filter="assets.kw" name="kw" placeholder="搜索资产 / 项目 / 类型" value="' + U.esc(kw) + '"></span>' +
            U.seg(["全部"].concat(D.assetCategories), cat, "assets.cat") + '<span class="grow"></span>' + (frozen ? '<span class="faint small">项目已交付 · 资产只读</span>' : (App.can("asset.manage") ? U.btn("上传资产", "assets.upload", "", p ? { id: p.id } : {}) : "")) + U.btn("引用检查", "assets.toUsage", "primary", p ? { id: p.id } : {}) + "</div>";
          const tab = App.get(SCOPE, "tab", "list");
          const refCount = usageOf(p).length;
          const tabsBar = U.card("", U.tabs([
            { value: "list", label: "资产目录", count: scoped.length },
            { value: "refs", label: "引用", count: refCount }
          ], tab, "assets.tab"));
          return U.page("资产 / 资产库", tab === "refs" ? "引用与使用关系" : "资产库", tab === "refs" ? "引用关系来自时间线、镜头契约、分镜板与交付包；引用必须在删除前逐条解除。" : "资产是生产的凭证：正式资产可被下游引用，临时素材不得进入交付。",
            (p ? (frozen ? "" : (App.can("asset.manage") ? U.btn("上传资产", "assets.upload", "primary", { id: p.id }) : "")) : "") + U.btn("导出清单", "common.export"),
            tabsBar + (tab === "refs" ? usageBlock(p) : U.card("资产目录 · " + list.length + " 项" + (p ? " · " + U.esc(p.name) : " · 可见项目"), toolbar + U.table(["编号", "资产", "分类 · 项目", "版本", "规格", "校验 · 质检", "状态", "引用", "操作"], rows, "当前分类下暂无资产"), p ? "当前项目资产 · 版本不覆盖" : "可见项目资产 · 版本不覆盖") +
            U.tableFoot("共 " + scoped.length + " 项资产 / 8 类" + (p ? " · 当前项目" : ""), "版本不覆盖，历史版本永久可查") +
            '<div class="grid grid-2 mt-4">' +
              U.card("八类资产", '<div class="chip-row">' + D.assetCategories.map(c => '<span class="chip">' + U.esc(c) + "</span>").join("") + "</div>" + U.listRows([["正式资产", "可被下游引用与交付"], ["临时素材", "不可进入交付包"], ["草稿资产", "仅本人与项目成员可见"]]) , "分类决定可用范围") +
              (bad ? U.card(bad.id + " · 不可交付资产", U.notice("该资产为「" + bad.status + "」（质检 " + bad.qc + "），引用数 " + bad.refs + "，不可进入交付；替换后才允许继续引用。", "bad") + U.desc([["资产", bad.id + " · " + bad.name], ["状态", bad.status], ["质检", bad.qc], ["引用", bad.refs + " 处"], ["处理", "替换后重新生成"]]) , "临时素材不进交付")
                : U.card("不可交付资产", U.empty("当前范围没有不可交付资产", "临时素材或质检 FAIL 的资产会在这里显示。"), "只显示真实资产状态")) +
            "</div>)")
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("assets.toLibrary", (el) => {
    const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id;
    App.go("assets/library", pid ? { id: pid } : undefined);
  });
  App.on("assets.toUsage", (el) => {
    const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id;
    App.set(SCOPE, "tab", "refs");
    App.go("assets/library", pid ? { id: pid } : undefined);
  });
  App.on("assets.tab", (el) => { App.set(SCOPE, "tab", el.dataset.value || "list"); App.refresh(); });
  App.on("assets.cat", (el) => { App.set(SCOPE, "cat", el.dataset.value); App.refresh(); });
  App.on("assets.trace", (el) => {
    const a = D.assets.find(x => x.id === el.dataset.id);
    if (!a) return App.toast("未找到资产：" + el.dataset.id, "bad");
    const p = D.projects.find(x => x.id === a.project);
    App.drawer("引用链路 · " + a.id, U.desc([["资产", a.name], ["项目", a.project + (p ? " · " + p.name : "")], ["分类", a.cat], ["版本", a.version], ["下游引用", (a.refs || 0) + " 处"], ["质检", a.qc], ["状态", a.status]]) +
      U.notice((a.refs || 0) > 0 ? "该资产有 " + a.refs + " 处下游引用；替换或删除前必须逐条解除，否则时间线与交付包会断链。" : "该资产当前没有下游引用，可按流程替换或删除。", (a.refs || 0) > 0 ? "warn" : "ok"));
  });
})();

/* ===== v9.1 真实流程层：资产版本、引用删除阻断、批量上传登记 ===== */
(function () {
  const U = UI, D = DB;
  const currentPid = (el, allowId) => (el && el.dataset && ((allowId && el.dataset.id) || el.dataset.pid)) || (App.current().query || {}).id || ((App.currentProject() || {}).id || "");
  const assetProject = (a) => {
    const p = D.projects.find(x => x.id === a.project);
    return p && DB.derived.canViewProject(p) ? p : null;
  };
  const frozenPid = (pid) => { const p = D.projects.find(x => x.id === pid); return p && ["已交付", "已归档"].indexOf(p.status) >= 0; };

  App.on("assets.detail", (el) => {
    const a = D.assets.find(x => x.id === el.dataset.id);
    if (!a) return;
    /* 资产详情字段（业务方案 §14.2）：类型、名称、企业与项目归属、创建人、执行人、
       来源（模型调用与参数摘要）、版本、存储位置与校验摘要、格式 / 时长 / 尺寸、质量状态、
       授权信息、引用关系、创建与更新时间 */
    const pj = D.projects.find(x => x.id === a.project);
    const refList = assetReferences(a);
    App.drawer("资产 · " + a.id,
      U.desc([
        ["名称 · 类型", a.name + " · " + a.cat + " / " + a.type],
        ["归属", (a.project + (pj ? " · " + pj.name : "")) + " · 企业私有化"],
        ["创建 / 执行", (a.creator || "—") + " → " + (a.executor || "—")],
        ["来源（模型调用与参数）", a.origin || "—"],
        ["版本", a.version + " / 共 " + a.versions + " 版"],
        ["存储 · 校验", (a.storage || "企业媒体存储 / " + a.project) + " · " + (a.checksum || "—")],
        ["格式 / 尺寸 / 时长 · 质量", (a.size || "—") + " · " + (a.qc || "—")],
        ["授权信息", a.rights || "—"],
        ["引用关系", refList.length ? refList.length + " 处：" + refList.map(r => r.where).join("、") : "无下游引用"],
        ["归档状态", a.archived ? "已归档 · 只读可查（仍参与历史统计）" : "未归档"],
        ["创建 / 更新时间", a.at || "—"]
      ]) +
      (a.archiveNote ? U.notice("归档说明：" + a.archiveNote, "info") : "") +
      U.card("版本历史与使用位置", U.table(["版本", "时间", "变更说明", "被引用位置"], (a.versionLog || []).slice().reverse().map(v =>
        "<tr><td>" + U.esc(v.version) + '</td><td class="idx">' + U.esc(v.at) + '</td><td class="cell-wrap">' + U.esc(v.note) + '</td><td class="cell-wrap muted">' + U.esc(v.usedBy || "—") + "</td></tr>").join(""),
        "当前仅有一个版本，尚未产生版本差异") , "版本不覆盖，旧版本永久可查") +
      U.card("引用位置明细", U.table(["引用类型", "引用对象", "位置"], refList.map(r =>
        "<tr><td>" + U.esc(r.kind) + '</td><td class="cell-wrap">' + U.esc(r.target) + '</td><td class="idx">' + U.esc(r.where) + "</td></tr>").join(""),
        "该资产当前没有下游引用"), "引用关系必须可查询（业务方案 §14.4）") +
      '<div class="btn-row-inline">' + U.btn("引用检查", "assets.refs", "", { id: a.id }) + (App.can("asset.manage") ? U.btn("新版本", "assets.newVersion", "primary", { id: a.id }) : "") +
      (App.can("asset.manage") ? U.btn("归档", "assets.archiveOne", "sm", { id: a.id }) : "") +
      (App.can("asset.manage") ? U.btn("删除资产", "assets.deleteOne", "sm", { id: a.id }) : "") + "</div>");
  });

  App.on("assets.refs", (el) => {
    const a = D.assets.find(x => x.id === el.dataset.id);
    if (!a) return;
    App.closeDrawer();
    App.drawer("引用检查 · " + a.id, U.desc([["资产", a.name], ["状态", a.status], ["正式", a.formal ? "是" : "否"], ["下游引用", (a.refs || 0) + " 处"]]) +
      ((a.refs || 0) > 0 ? U.notice("存在 " + a.refs + " 处下游引用（时间线 / 镜头契约 / 交付包），删除会破坏历史，已阻断。", "bad") : U.notice("无下游引用，可删除（需二次确认）", "ok")));
  });

  App.on("assets.deleteCheck", (el) => {
    if (!App.guard("asset.manage")) return;
    const pid = currentPid(el, true);
    const p = D.projects.find(x => x.id === pid);
    if (frozenPid(pid)) { App.toast("项目已交付，资产库只读；变更需新建版本链", "bad"); return; }
    const list = D.assets.filter(a => a.project === pid && (a.refs || 0) === 0 && !a.formal);
    App.modal({
      title: "删除资产" + (p ? " · " + p.name : ""), sub: "仅允许删除当前项目内无引用且非正式的资产；其余一律阻断",
      body: U.fSelect("资产", "id", list.length ? list.map(a => ({ value: a.id, label: a.id + " · " + a.name })) : [{ value: "", label: "当前项目没有可删除资产" }], { required: true }) +
        U.fTextarea("删除原因", "note", { required: true, minlen: 8, rows: 3 }) +
        U.notice("正式资产不可删除，只能新版本替代；有引用资产会破坏历史。", "warn"),
      submitText: "确认删除",
      onSubmit(d) {
        if (!d.id) { App.toast("当前没有满足删除条件的资产", "bad"); return false; }
        const target = D.assets.find(a => a.id === d.id);
        if (!target || target.project !== pid) { App.toast("只能删除当前项目内的资产", "bad"); return false; }
        return App.job({
          title: "删除资产", steps: ["校验引用与正式状态", "移除资产", "写审计"],
          run() {
            const r = DB.state.removeAsset(d.id);
            if (!r.ok) return r;
            DB.state.log("资产 " + d.id, "删除：" + d.note, "成功", d.id);
            return { ok: true, msg: r.msg };
          }
        });
      }
    });
  });

  App.on("assets.archiveOne", (el) => {
    if (!App.guard("asset.manage")) return;
    const a = D.assets.find(x => x.id === el.dataset.id);
    if (!a) return;
    if (!assetProject(a)) { App.toast("该资产所属项目不在可见范围", "bad"); return; }
    if (frozenPid(a.project)) { App.toast("项目已交付，资产只读；变更需新建版本链", "bad"); return; }
    App.closeDrawer();
    App.modal({
      title: "归档资产 · " + a.id, sub: "归档后资产只读可查，仍参与历史统计与追溯，不等于删除",
      body: U.fTextarea("归档原因", "note", { required: true, minlen: 8, rows: 3, placeholder: "例如：临时素材已被正式版本替代" }) +
        U.notice("已归档资产不得物理删除；需要修复时基于历史版本新建版本。", "warn"),
      submitText: "确认归档",
      onSubmit(d) {
        return App.job({
          title: "归档资产", steps: ["校验权限与归属", "写入归档记录", "写审计"],
          run() { return DB.state.archiveAsset(a.id, d.note); }
        });
      }
    });
  });

  App.on("assets.deleteOne", (el) => {
    if (!App.guard("asset.manage")) return;
    const a = D.assets.find(x => x.id === el.dataset.id);
    if (!a) return;
    if (!assetProject(a)) { App.toast("该资产所属项目不在可见范围", "bad"); return; }
    if (frozenPid(a.project)) { App.toast("项目已交付，资产只读；变更需新建版本链", "bad"); return; }
    App.closeDrawer();
    if ((a.refs || 0) > 0 || a.formal) {
      App.toast("删除被阻断：" + (a.formal ? "正式资产不可删除" : "存在 " + a.refs + " 处下游引用"), "bad");
      return;
    }
    App.confirm("删除资产 · " + a.id, "删除后不可恢复；请确认无下游引用。", () => {
      App.job({ title: "删除资产", steps: ["校验引用", "移除资产"], run() { return DB.state.removeAsset(a.id); } });
    }, "删除");
  });

  App.on("assets.newVersion", (el) => {
    if (!App.guard("asset.manage")) return;
    const a = D.assets.find(x => x.id === el.dataset.id);
    if (!a) return;
    if (!assetProject(a)) { App.toast("该资产所属项目不在可见范围", "bad"); return; }
    if (frozenPid(a.project)) { App.toast("项目已交付，资产只读；变更需新建版本链", "bad"); return; }
    App.closeDrawer();
    App.modal({
      title: "资产新版本 · " + a.id, sub: "新版本不覆盖旧版本；引用旧版本的下游将标记需复核",
      body: U.fTextarea("变更说明", "note", { required: true, minlen: 8, rows: 3 }) +
        U.fSelect("来源", "source", ["本地重制", "AI 生成", "供应商替换"], { required: true }) +
        U.fCheck("同步标记下游引用需复核", "mark", { checked: true }),
      submitText: "创建新版本",
      onSubmit(d) {
        return App.job({
          title: "创建资产新版本", steps: ["校验版本序列", "写入新版本", "标记下游复核"],
          run() {
            const n = Number(String(a.version).replace(/[^\d]/g, "")) || 1;
            const usedBy = assetReferences(a).map(r => r.target).join("、");
            a.versionLog = (a.versionLog || []).concat([{ version: a.version, at: a.at || "—", note: "当前有效版本", usedBy: usedBy || "—" }]);
            a.old = (a.old ? a.old + " / " : "") + "v" + n;
            a.version = "v" + (n + 1);
            a.versions = n + 1;
            a.status = "待确认"; a.formal = false; a.at = DB.state.at();
            if (d.mark) D.shots.filter(s => s.refs && s.refs.indexOf(a.id) >= 0).forEach(s => { s.status = "需复核"; });
            DB.state.log("资产 " + a.id, "新版本 v" + (n + 1) + "：" + d.note + "（来源：" + d.source + "）", "成功", a.id);
            return { ok: true, msg: "已创建 v" + (n + 1) + "（待确认），旧版本保留" };
          }
        });
      }
    });
  });

  App.on("assets.upload", (el) => {
    if (!App.guard("asset.manage")) return;
    const visible = DB.derived.visibleProjects().filter(x => ["已交付", "已归档"].indexOf(x.status) < 0);
    if (!visible.length) { App.toast("可见项目均已交付或归档，资产库只读；变更需新建版本链", "bad"); return; }
    const requested = currentPid(el, true);
    if (frozenPid(requested)) { App.toast("项目已交付，资产库只读；变更需新建版本链", "bad"); return; }
    const defaultPid = visible.some(x => x.id === requested) ? requested : visible[0].id;
    const p = D.projects.find(x => x.id === defaultPid);
    App.modal({
      wide: true,
      title: "登记资产" + (p ? " · " + p.name : ""), sub: "资产必须登记来源与授权，未确认前不得进入正式引用",
      body: U.fSelect("归属项目", "project", visible.map(x => ({ value: x.id, label: x.id + " · " + x.name })), { required: true, value: defaultPid }) +
        U.fField("名称", "name", { required: true, minlen: 2 }) +
        U.fSelect("类型", "type", ["人物参考", "场景参考", "道具参考", "音频素材", "字幕文件"]) +
        U.fField("版本", "version", { required: true, value: "v1" }) +
        U.fSelect("来源", "source", ["AI 生成", "企业素材库", "外部采购（需授权书）", "本地重制"], { required: true }) +
        U.fField("授权范围", "rights", { required: true, minlen: 4, placeholder: "例如 平台授权 · 全渠道" }),
      submitText: "登记资产",
      onSubmit(d) {
        return App.job({
          title: "登记资产", steps: ["校验归属项目与授权", "写入资产库"],
          run() {
            const target = D.projects.find(x => x.id === d.project);
            if (!target) return { ok: false, msg: "项目不存在：" + d.project };
            if (!DB.derived.canViewProject(target)) return { ok: false, msg: "该项目不在当前可见范围：" + d.project };
            const prefix = "A-" + d.project.replace(/^SP-/, "") + "-";
            let seq = 1, id = "";
            do { id = prefix + String(seq).padStart(2, "0"); seq++; } while (D.assets.some(a => a.id === id));
            D.assets.unshift({ id: id, name: d.name, cat: d.type, type: d.type, version: d.version, versions: 1, size: "待采集", checksum: "—", qc: "待检测", origin: d.source, creator: DB.state.actor(), executor: DB.state.actor(), storage: "企业媒体存储 / " + d.project, rights: d.rights, status: "待确认", formal: false, refs: 0, project: d.project, at: DB.state.at() });
            DB.state.log("资产 " + id, "登记：" + d.name + " · " + d.project, "成功", id);
            return { ok: true, msg: "资产已登记：" + id + "（" + target.name + " · 待确认）" };
          }
        });
      }
    });
  });
})();

