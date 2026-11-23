/* 模块：assets 资产库与引用检查 */
(function () {
  const U = UI, D = DB, SCOPE = "assets";

  AppModule.register({
    group: "assets", label: "资产库", icon: "box", order: 10, end: "workspace",
    routes: [
      {
        path: "assets/library", title: "资产库", icon: "box", permission: "asset.read",
        desc: "资产按八类归档，版本不覆盖：同名同 ID 只增版本，历史版本永久可查、可回指。",
        render(query) {
          const pid = (query && query.id) || "";
          const p = pid ? (D.projects.find(x => x.id === pid) || null) : null;
          if (pid && (!p || !Derived.canViewProject(p))) return U.page("资产 / 资产库", "项目不在可见范围", "请从项目列表进入可见项目，或由负责人授权后再查看项目资产。", U.btn("返回资产库", "assets.toLibrary", "primary"), U.empty("无法读取项目", "跨项目或不存在项目不渲染资产。"));
          const frozen = p && ["已交付", "已归档"].indexOf(p.status) >= 0;
          const cat = App.get(SCOPE, "cat", "全部");
          const kw = App.get(SCOPE, "kw", "");
          const visPids = Derived.visibleProjects().map(x => x.id);
          const scoped = pid ? D.assets.filter(a => a.project === pid) : D.assets.filter(a => visPids.indexOf(a.project) >= 0);
          const list = scoped.filter(a =>
            (cat === "全部" || a.cat === cat) &&
            (!kw || (a.name + a.id + a.project + a.type).indexOf(kw) >= 0));
          const bad = list.find(a => String(a.status).indexOf("临时") >= 0 || String(a.qc).indexOf("FAIL") >= 0);
          const rows = list.map(a =>
            '<tr><td>' + U.code(a.id) + '</td><td>' + U.entity(a.name, a.type, "▣") + '</td><td>' + U.esc(a.cat) + "</td><td>" + U.esc(a.project) + "</td><td>" + U.esc(a.version) + '<span class="faint small"> / ' + a.versions + "</span></td><td>" + U.esc(a.size) + '</td><td class="cell-wrap muted">' + U.esc(a.checksum) + "</td><td>" + U.pill(a.qc) + "</td><td>" + U.pill(a.status) + '</td><td class="num">' + a.refs + "</td><td>" +
            U.btn("详情", "assets.detail", "sm", { id: a.id }) + " " + U.btn("引用", "assets.refs", "sm", { id: a.id }) + "</td></tr>").join("");
          const toolbar = '<div class="toolbar"><span class="field-wrap"><input class="field" data-filter="assets.kw" name="kw" placeholder="搜索资产 / 项目 / 类型" value="' + U.esc(kw) + '"></span>' +
            U.seg(["全部"].concat(D.assetCategories), cat, "assets.cat") + '<span class="grow"></span>' + (frozen ? '<span class="faint small">项目已交付 · 资产只读</span>' : U.btn("上传资产", "assets.upload", "", p ? { id: p.id } : {})) + U.btn("引用检查", "assets.toUsage", "primary", p ? { id: p.id } : {}) + "</div>";
          return U.page("资产 / 资产库", "资产库", "资产是生产的凭证：正式资产可被下游引用，临时素材不得进入交付。",
            U.btn("引用与使用关系", "assets.toUsage", "", p ? { id: p.id } : {}) + U.btn("导出清单", "common.export"),
            U.card("资产目录 · " + list.length + " 项" + (p ? " · " + U.esc(p.name) : " · 可见项目"), toolbar + U.table(["编号", "资产", "分类", "项目", "版本", "规格", "校验", "质检", "状态", "引用", "操作"], rows, "当前分类下暂无资产"), p ? "当前项目资产 · 版本不覆盖" : "可见项目资产 · 版本不覆盖") +
            U.tableFoot("共 " + scoped.length + " 项资产 / 8 类" + (p ? " · 当前项目" : ""), "版本不覆盖，历史版本永久可查") +
            '<div class="grid grid-2 mt-4">' +
              U.card("八类资产", '<div class="chip-row">' + D.assetCategories.map(c => '<span class="chip">' + U.esc(c) + "</span>").join("") + "</div>" + U.listRows([["正式资产", "可被下游引用与交付"], ["临时素材", "不可进入交付包"], ["草稿资产", "仅本人与项目成员可见"]]) , "分类决定可用范围") +
              (bad ? U.card(bad.id + " · 不可交付资产", U.notice("该资产为「" + bad.status + "」（质检 " + bad.qc + "），引用数 " + bad.refs + "，不可进入交付；替换后才允许继续引用。", "bad") + U.desc([["资产", bad.id + " · " + bad.name], ["状态", bad.status], ["质检", bad.qc], ["引用", bad.refs + " 处"], ["处理", "替换后重新生成"]]) , "临时素材不进交付")
                : U.card("不可交付资产", U.empty("当前范围没有不可交付资产", "临时素材或质检 FAIL 的资产会在这里显示。"), "只显示真实资产状态")) +
            "</div>"
          );
        }
      },
      {
        path: "assets/usage", title: "引用与使用关系", icon: "chain", permission: "asset.read",
        desc: "删除或替换任何资产前必须查引用：引用未清理就删除会造成时间线与交付包断链。",
        render(query) {
          const pid = (query && query.id) || "";
          const p = pid ? (D.projects.find(x => x.id === pid) || null) : null;
          if (pid && (!p || !Derived.canViewProject(p))) return U.page("资产 / 引用关系", "项目不在可见范围", "请从项目列表进入可见项目，或由负责人授权后再查看引用关系。", U.btn("返回资产库", "assets.toLibrary", "primary"), U.empty("无法读取项目", "跨项目或不存在项目不渲染引用记录。"));
          const frozen = p && ["已交付", "已归档"].indexOf(p.status) >= 0;
          const visPids = Derived.visibleProjects().map(x => x.id);
          const pool = pid ? D.assets.filter(a => a.project === pid) : D.assets.filter(a => visPids.indexOf(a.project) >= 0);
          const usage = pool.filter(a => Number(a.refs) > 0).map(a => ({
            asset: a.id, target: (pid ? p.name : a.project) + " · " + a.cat, kind: a.cat + "引用", count: Number(a.refs) || 1, deletable: false
          }));
          const rows = usage.map(x =>
            '<tr><td>' + U.code(x.asset) + "</td><td>" + U.esc(x.kind) + '</td><td class="cell-wrap">' + U.esc(x.target) + '</td><td class="num">' + x.count + "</td><td>" + U.pill(x.deletable ? "可删除" : "被引用 · 不可删除", x.deletable ? "ok" : "bad") + "</td><td>" +
            U.btn("查看链路", "assets.trace", "sm", { id: x.asset }) + "</td></tr>").join("");
          const blocked = usage[0];
          return U.page("资产 / 引用关系", "引用与使用关系", "引用关系来自时间线、镜头契约、分镜板与交付包；引用必须在删除前逐条解除。",
            U.btn("资产库", "assets.toLibrary", "primary", p ? { id: p.id } : {}) + (frozen ? '<span class="faint small">项目已交付 · 删除检查只读</span>' : (p ? U.btn("删除前检查", "assets.deleteCheck", "", { id: p.id }) : '<span class="faint small">从单个项目进入后可执行删除检查</span>')),
            U.card("引用关系表" + (p ? " · " + U.esc(p.name) : " · 可见项目"), U.table(["资产", "引用类型", "引用对象", "引用数", "可删除性", "操作"], rows, "当前范围没有资产引用"), p ? "当前项目引用 · 来自资产登记" : "可见项目引用 · 来自资产登记") +
            '<div class="split mt-4"><div class="stack">' +
              U.card("删除前检查流程", U.chain([
                { label: "发起删除", meta: "资产 ID", state: "done" },
                { label: "列引用", meta: "时间线 / 镜头 / 交付", state: "now" },
                { label: "解除引用", meta: "替换或下线", state: "" },
                { label: "执行删除", meta: "写审计", state: "" }
              ]), "有引用即阻断删除") +
              (blocked ? U.card("删除阻断 · " + blocked.asset, U.notice(blocked.asset + " 仍有 " + blocked.count + " 处引用，删除会直接造成下游断链：必须先替换引用对象。", "bad") + U.desc([["资产", blocked.asset], ["引用", blocked.count + " 处"], ["结论", "不可删除"], ["替代方案", "新建版本，保留原版本"]]) , "不允许强制删除")
                : U.card("删除阻断", U.notice("当前项目没有带引用的资产，可按流程删除并写审计。", "ok"), "删除仍须留痕")) +
            '</div><div class="stack">' +
              U.card("引用统计", U.donut([
                { label: "被引用 ≥ 10 次", value: usage.filter(x => x.count >= 10).length, color: "var(--accent)" },
                { label: "被引用 1–9 次", value: usage.filter(x => x.count > 0 && x.count < 10).length, color: "var(--info)" },
                { label: "无引用", value: pool.filter(a => Number(a.refs) === 0).length, color: "var(--line-strong)" }
              ], "资产", String(pool.length)), "按资产计") +
              U.card("资产可见性", U.listRows([["正式资产", "项目成员可见、可引用"], ["临时素材", "仅创建者可用"], ["交付资产", "只读，随交付冻结"], ["删除", "仅管理员可在无引用时执行"]]) , "可见性随角色变化") +
            "</div></div>"
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
    App.go("assets/usage", pid ? { id: pid } : undefined);
  });
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
    return p && Derived.canViewProject(p) ? p : null;
  };
  const frozenPid = (pid) => { const p = D.projects.find(x => x.id === pid); return p && ["已交付", "已归档"].indexOf(p.status) >= 0; };

  App.on("assets.detail", (el) => {
    const a = D.assets.find(x => x.id === el.dataset.id);
    if (!a) return;
    App.drawer("资产 · " + a.id, U.desc([["名称", a.name], ["类型", a.type], ["版本", a.version], ["来源", a.source], ["授权", a.rights], ["状态", a.status], ["正式", a.formal ? "是" : "否"], ["下游引用", (a.refs || 0) + " 处"], ["更新", a.at]]) +
      '<div class="btn-row-inline">' + U.btn("引用检查", "assets.refs", "", { id: a.id }) + U.btn("新版本", "assets.newVersion", "primary", { id: a.id }) +
      U.btn("删除资产", "assets.deleteOne", "sm", { id: a.id }) + "</div>");
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
            const r = Store.ops.removeAsset(d.id);
            if (!r.ok) return r;
            Store.log("资产 " + d.id, "删除：" + d.note, "成功", d.id);
            return { ok: true, msg: r.msg };
          }
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
      App.job({ title: "删除资产", steps: ["校验引用", "移除资产"], run() { return Store.ops.removeAsset(a.id); } });
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
            a.old = (a.old ? a.old + " / " : "") + "v" + n;
            a.version = "v" + (n + 1);
            a.status = "待确认"; a.formal = false; a.at = Store.at();
            if (d.mark) D.shots.filter(s => s.refs && s.refs.indexOf(a.id) >= 0).forEach(s => { s.status = "需复核"; });
            Store.log("资产 " + a.id, "新版本 v" + (n + 1) + "：" + d.note, "成功", a.id);
            return { ok: true, msg: "已创建 v" + (n + 1) + "（待确认），旧版本保留" };
          }
        });
      }
    });
  });

  App.on("assets.upload", (el) => {
    if (!App.guard("asset.manage")) return;
    const visible = Derived.visibleProjects().filter(x => ["已交付", "已归档"].indexOf(x.status) < 0);
    if (!visible.length) { App.toast("可见项目均已交付或归档，资产库只读；变更需新建版本链", "bad"); return; }
    const requested = currentPid(el, true);
    if (frozenPid(requested)) { App.toast("项目已交付，资产库只读；变更需新建版本链", "bad"); return; }
    const defaultPid = visible.some(x => x.id === requested) ? requested : visible[0].id;
    const p = D.projects.find(x => x.id === defaultPid);
    App.modal({
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
            if (!Derived.canViewProject(target)) return { ok: false, msg: "该项目不在当前可见范围：" + d.project };
            const prefix = "A-" + d.project.replace(/^SP-/, "") + "-";
            let seq = 1, id = "";
            do { id = prefix + String(seq).padStart(2, "0"); seq++; } while (D.assets.some(a => a.id === id));
            D.assets.unshift({ id: id, name: d.name, cat: d.type, type: d.type, version: d.version, versions: 1, size: "待采集", checksum: "—", qc: "待检测", source: d.source, rights: d.rights, status: "待确认", formal: false, refs: 0, project: d.project, at: Store.at() });
            Store.log("资产 " + id, "登记：" + d.name + " · " + d.project, "成功", id);
            return { ok: true, msg: "资产已登记：" + id + "（" + target.name + " · 待确认）" };
          }
        });
      }
    });
  });
})();

