/* 模块：director 导演规划（员工工作台） */
(function () {
  const U = UI, D = DB, SCOPE = "director";
  const shotsOf = (p) => D.shots.filter(s => !p || s.project === p);

  /* ---------- 分镜视图（原 director/storyboard，B2·M4 并入镜头契约的「分镜视图」） ----------
     按生产状态组织镜头：待执行、执行中、待人工、已通过。分镜板用于评审画面语言，不用于伪造完成度。 */
  const boardBlock = (p) => {
    const pid = p.id;
    const all = shotsOf(pid);
    if (App.get(SCOPE, "boardPid", "") !== pid) {
      App.set(SCOPE, "boardPid", pid);
      App.set(SCOPE, "boardEp", "all");
      App.set(SCOPE, "boardState", "all");
      App.set(SCOPE, "boardShot", "");
    }
    const ep = App.get(SCOPE, "boardEp", "all");
    const st = App.get(SCOPE, "boardState", "all");
    const epList = Array.from(new Set(all.map(s => s.ep)));
    const list = all.filter(s => (ep === "all" || String(s.ep) === String(ep)) &&
      (st === "all" || (st === "passed" ? s.status.indexOf("已通过") >= 0 : s.status.indexOf(st) >= 0)));
    const selId = App.get(SCOPE, "boardShot", list[0] ? list[0].id : "");
    const sel = list.find(s => s.id === selId) || list[0];
    return '<div class="board-toolbar"><div class="seg-chips">' +
        '<button type="button" class="seg-chip' + (ep === "all" ? " on" : "") + '" data-action="director.boardEp" data-value="all">全部集</button>' +
        epList.map(n => '<button type="button" class="seg-chip' + (String(ep) === String(n) ? " on" : "") + '" data-action="director.boardEp" data-value="' + n + '">E' + n + "</button>").join("") +
        '</div><span class="grow"></span><div class="seg-chips">' +
        [["all", "全部"], ["passed", "已通过"], ["待执行", "待执行"], ["执行中", "执行中"], ["待人工", "待人工"]].map(x =>
          '<button type="button" class="seg-chip' + (st === x[0] ? " on" : "") + '" data-action="director.boardState" data-value="' + x[0] + '">' + x[1] + "</button>").join("") +
        '</div><span class="faint small">' + list.length + " 个镜头</span></div>" +
      '<div class="split-wide"><div class="stack">' +
        '<div class="board-grid">' + list.map(s => '<button type="button" class="shot-tile' + (sel && s.id === sel.id ? " on" : "") + '" data-action="director.boardShot" data-id="' + U.esc(s.id) + '">' +
          '<span class="tile-media">' + (U.storyFrame(s) ? '<img src="' + U.esc(U.storyFrame(s)) + '" alt="' + U.esc(s.desc) + ' 关键帧">' : "") +
            '<span class="tile-no">E' + s.ep + " " + U.esc(s.no) + '</span><span class="tile-state">' + U.pill(s.status) + '</span><span class="tile-dur">' + U.esc(s.duration) + "</span></span>" +
          '<span class="tile-body"><b>' + U.esc(s.desc) + "</b><small>" + U.esc(s.frame + " · " + s.angle + " · " + s.move) + "</small>" +
            '<span class="tile-tags"><span class="tag">' + U.esc(s.chars) + '</span><span class="tag">' + U.esc(s.version) + "</span></span></span></button>").join("") +
          '<button type="button" class="tile-add" data-action="director.newShot" data-pid="' + U.esc(pid) + '">+ 新增镜头契约</button></div>' +
        U.card("画面语言检查", U.listRows([
          ["景别节奏", "同一场景内不连续 3 个同景别镜头"], ["轴线", "对话镜头保持同侧，不越轴"],
          ["场景连续性", "光线、雨量与道具状态在相邻镜头一致"], ["人物视线", "对白镜头视线方向与站位一致"]
        ]), "检查项用于评审，不自动改画面") +
      '</div><aside class="stack">' +
        (sel ? U.card("镜头契约 · " + sel.id,
          (U.storyFrame(sel) ? '<div class="shot-preview"><img src="' + U.esc(U.storyFrame(sel)) + '" alt="' + U.esc(sel.desc) + '"></div>' : "") +
          U.desc([["集 / 场", "E" + sel.ep + " / S" + sel.scene], ["景别 / 角度", sel.frame + " · " + sel.angle], ["运镜", sel.move], ["镜头倾向", sel.lens],
            ["时长", sel.duration], ["人物", sel.chars], ["情绪", sel.emotion], ["台词", sel.line], ["参考", sel.refs], ["模型", sel.model], ["状态", sel.status + " · " + sel.version]]) +
          '<div class="btn-row-inline">' + U.btn("重新生成", "director.regenerate", "primary", { id: sel.id }) + U.btn("查看完整契约", "director.shotDetail", "", { id: sel.id }) + "</div>" +
          U.notice("重新生成只影响这一镜，保留旧结果与新尝试记录；不会整集重跑。", "info"), "当前选中镜头") : U.empty("当前项目还没有镜头", "先在剧本拆解中生成镜头契约，或在左侧新增一镜。")) +
        U.card("重生成入口", U.notice("按镜头粒度执行，失败成本单独入账。", "info") + '<div class="btn-row-inline">' + U.btn("选择镜头重生成", "director.pickRegen", "sm", { pid: pid }) + "</div>", "返工按镜头计费") +
      "</aside></div>";
  };

  AppModule.register({
    group: "director", label: "导演规划", icon: "film", order: 4, end: "workspace",
    routes: [
      {
        path: "director/plan", title: "镜头生产计划", icon: "film", permission: "director.write",
        desc: "把锁定剧本翻译成可执行的镜头生产计划：场次、参考资产、镜头契约、并行分组与门禁条件。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.page("导演规划 / 镜头生产计划", "项目不在可见范围", "该链接指向的项目不存在或当前身份无权查看；镜头计划不会回退到其他项目。", U.btn("返回项目列表", "common.projects"), U.empty("无法读取项目", "请从项目列表或制作流水线进入可见项目。"));
          const pid = p.id;
          const eps = D.episodes.filter(e => e.project === pid).sort((a, b) => a.no - b.no);
          const shots = D.shots.filter(s => s.project === pid);
          const script = D.scripts.find(s => s.project === pid && (s.status === "已锁定" || s.locked)) || D.scripts.find(s => s.project === pid);
          const plan = D.plans.find(x => x.project === pid && x.status !== "已固化") || D.plans.find(x => x.project === pid);
          const chars = D.characters.filter(c => c.project === pid);
          const locs = D.locations.filter(l => l.project === pid);
          const props = D.props.filter(o => o.project === pid);
          const assets = chars.concat(locs, props);
          const readyAssets = assets.filter(a => a.status === "已确认" || a.status === "抽检通过" || a.consistency === "3 处出场外观一致" || a.consistency === "5 处出场一致");
          const contract = shots.filter(s => s.scene && s.desc && s.duration && s.chars);
          const totalScenes = eps.reduce((n, e) => n + (Number(e.scenes) || 0), 0);
          const gate = DB.state.gate(pid, "生产");
          const inProd = ["生产中", "后期制作中", "质量检测中", "待最终审核", "已完成", "已交付", "已归档"].indexOf(p.status) >= 0;
          const canPlan = p.status === "生产准备中";
          const pendingAssets = assets.filter(a => readyAssets.indexOf(a) < 0);
          const chain = U.chain([
            { label: "剧本锁定", meta: script ? script.id : "未锁定", state: script && (script.locked || script.status === "已锁定") ? "done" : "now" },
            { label: "人物 / 场景 / 道具", meta: readyAssets.length + " / " + assets.length + " 就绪", state: readyAssets.length === assets.length ? "done" : "now" },
            { label: "场次与镜头", meta: totalScenes + " 场 / " + shots.length + " 镜", state: eps.length ? "done" : "" },
            { label: "镜头契约固化", meta: contract.length + " / " + shots.length + " 字段完整", state: contract.length === shots.length ? "done" : "now" },
            { label: inProd ? "视频生产" : "进入视频生产", meta: inProd ? "已在生产 · " + p.status : (gate.ok ? "门禁通过" : "门禁未满足"), state: inProd || gate.ok ? "done" : "" }
          ]);
          const rows = eps.map(e => {
            const es = shots.filter(s => s.ep === e.no);
            const pass = es.filter(s => s.status === "已通过").length;
            return '<tr><td class="num">E' + e.no + '</td><td class="cell-wrap">' + U.esc(e.title) + '</td><td class="num">' + e.scenes + '</td><td class="num">' + es.length + '</td><td class="num">' + pass + '</td><td>' + U.pill(e.status) + '</td><td>' + U.btn("查看镜头", "director.sceneShots", "sm", { id: "E" + e.no, pid: pid }) + "</td></tr>";
          }).join("");
          return U.page("导演规划 / 镜头生产计划", "镜头生产计划 · " + p.name, "计划只固化可执行的镜头契约；参考资产未就绪、剧本未锁定的场次不进入生产队列。",
            (canPlan ? U.btn("重新规划", "director.replan", "", { id: pid }) + U.btn("固化生产计划", "director.freezePlan", "primary", { id: pid }) : (inProd ? U.btn("查看生产流水线", "projects.wfOpen", "primary", { pid: pid }) : (p.status === "创意策划中" ? U.btn("先选定创意方案", "creation.toPlan", "primary", { id: pid }) : U.btn("先完成剧本审核", "creation.toScript", "primary", { id: pid })))) + U.btn("进入分镜板", "director.toStoryboard", "", { id: pid }) + (inProd || canPlan ? U.btn("去视频生产", "director.toVideo", "", { id: pid }) : ""),
            U.card("规划链路", chain, "规划阶段不产生视频成本") +
            '<div class="grid grid-4 mt-4">' +
              U.metric("镜头总数", String(shots.length), "契约完整 " + contract.length + " · 待补 " + (shots.length - contract.length), "▤") +
              U.metric("场次数", String(totalScenes), "已拆解 " + eps.length + " 集", "▦") +
              U.metric("参考资产就绪", readyAssets.length + " / " + assets.length, pendingAssets.length ? pendingAssets.length + " 项待处理" : "全部就绪", "◇") +
              U.metric("契约固化率", (shots.length ? Math.round(contract.length / shots.length * 100) : 0) + "%", inProd ? "已在生产 · 待补 " + pendingAssets.length + " 项" : (gate.ok ? "生产门禁已通过" : "生产门禁未通过"), "✓") +
            "</div>" +
            '<div class="split mt-4"><div class="stack">' +
              U.card("场次规划 · " + p.name, U.table(["集", "标题", "场", "镜头", "通过", "状态", "操作"], rows), "按集次顺序固化，未就绪场次保留在计划中") +
              U.card("并行分组与门禁", U.listRows([
                ["并行分组", "同一场景内可并行的镜头归入一组，跨场景不并行抢占配额"],
                ["前置门禁", "参考资产就绪 + 契约固化 + 预算未触发"],
                ["依赖", "后镜头依赖前镜头衔接时按顺序排队，不并行提交"],
                ["失败处理", "失败只影响本镜头与下游依赖，不整场重跑"]
              ]), "分组不改变集次结构", U.btn("查看队列", "director.toQueue", "sm", { id: pid })) +
            '</div><div class="stack">' +
              U.card("镜头契约必填字段", U.listRows([["景别 / 机位 / 运镜", "决定画面语言"], ["时长 / 画幅", "决定成本与输出规格"], ["人物与造型版本", "引用 CH 版本号"], ["场景 / 道具版本", "引用 LC / PR 版本号"], ["对白与情绪", "口型与表演依据"], ["质量要求", "进入检测项，不写空话"]]) , "字段缺失不允许提交生产") +
              U.card("规划待处理", pendingAssets.length ? U.table(["事项", "对象", "影响"], pendingAssets.slice(0, 6).map(a => ["<span class=\"cell-wrap\">" + U.esc(a.name) + " · " + U.esc(a.status || a.consistency || "待确认") + "</span>", U.code(a.id), inProd ? "已生产镜头不追溯，交付前复核" : "相关引用镜头不可固化"]).map(r => "<tr><td>" + r[0] + "</td><td>" + r[1] + '</td><td class="muted">' + r[2] + "</td></tr>").join("")) : U.empty("参考资产全部就绪", "角色、场景与道具均已确认"), "待处理项不进入队列") +
              U.card("规划口径", U.notice("镜头是唯一生产单元：任何「重做一集」的需求都拆成具体镜头；不允许用整集重跑替代局部返工。", "info")) +
            "</div></div>"
          );
        }
      },
      {
        path: "director/cast", title: "人物视觉档案", icon: "users", permission: "director.write",
        desc: "人物设定与视觉档案：外观、造型、禁用项、参考资产与版本。禁用项会写入提示词负面约束，避免跨集漂移。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.page("导演规划 / 人物视觉档案", "项目不在可见范围", "该链接指向的项目不存在或当前身份无权查看；人物档案不会回退到其他项目。", U.btn("返回项目列表", "common.projects"), U.empty("无法读取项目", "请从项目列表或制作流水线进入可见项目。"));
          const pid = p.id;
          const chars = D.characters.filter(c => c.project === pid);
          const sel = chars[0];
          const pending = chars.filter(c => c.status !== "已确认" || Number(c.refs || 0) < 3);
          const rows = chars.map(c =>
            '<tr><td>' + U.entity(c.name, c.id, String(c.name).slice(0, 1)) + "</td><td>" + U.esc(c.age) + '</td><td class="cell-wrap">' + U.esc(c.look) + '</td><td class="cell-wrap muted">' + U.esc(c.costume) + '</td><td class="cell-wrap">' + U.esc(c.forbid) + '</td><td class="num">' + (c.refs || 0) + "</td><td>" + U.code(c.version) + "</td><td>" + U.pill(c.status) + "</td><td>" +
            U.btn("档案", "director.charDetail", "sm", { id: c.id }) + "</td></tr>").join("");
          return U.page("导演规划 / 人物视觉档案", "人物视觉档案 · " + p.name, "人物一致性靠固定参考与禁用项约束，不靠每次重新描述；这里只显示当前项目的档案。",
            U.btn("新建人物档案", "director.newChar", "primary", { pid: pid }) + U.btn("一致性抽检", "director.check", "primary", { pid: pid }) + U.btn("导出档案", "common.export"),
            U.card("人物档案表", U.table(["人物", "年龄", "外观特征", "造型", "禁用项", "参考", "版本", "状态", "操作"], rows, "当前项目还没有人物档案"), "档案版本变更需列出受影响镜头") +
            '<div class="split mt-4"><div class="stack">' +
              (sel
                ? U.card(sel.name + " · 视觉档案（" + sel.id + " " + sel.version + "）", U.desc([["外观", sel.look], ["体型", sel.build], ["发型", sel.hair], ["固定造型", sel.costume], ["禁用项", sel.forbid], ["参考资产", (sel.refs || 0) + " 张"], ["适用集次", sel.reuse], ["权利状态", sel.rights]]) +
                  '<div class="btn-row-inline">' + U.btn("追加参考资产", "director.addRef", "sm", { id: sel.id }) + U.btn("新建版本", "director.versionChar", "sm", { id: sel.id }) + "</div>", "变更参考需重做受影响的已生成镜头")
                : U.empty("当前项目还没有人物档案", "先建立第一个人物，再作为镜头引用基准")) +
              U.card("档案待处理", pending.length
                ? U.table(["人物", "状态", "参考资产", "处理建议"], pending.map(c => ["<span class=\"cell-wrap\">" + U.esc(c.name) + "</span>", U.pill(c.status), (c.refs || 0) + " 张 / 至少 3 张", (c.refs || 0) < 3 ? "补参考资产后再确认" : "确认视觉设定"]).map(r => "<tr><td>" + r[0] + "</td><td>" + r[1] + '</td><td class="num">' + r[2] + '</td><td class="muted">' + r[3] + "</td></tr>").join(""))
                : U.empty("全部档案已确认", "当前项目的人物参考资产均满足生产基准"), "未确认档案引用的镜头不可固化") +
            '</div><div class="stack">' +
              U.notice("口径与规则见《口径与规则汇总》§R-15：档案规则", "info") +
              U.card("当前项目人物", chars.length ? U.listRows(chars.map(c => [c.name + "（" + c.id + "）", c.version + " · " + c.status]), "点击档案可查看禁用项") : U.empty("暂无人物", "新建人物档案后在这里汇总"),
                U.btn("全部档案", "director.toCast", "sm", { id: pid })) +
            "</div></div>"
          );
        }
      },
      {
        path: "director/world", title: "场景与道具", icon: "cube", permission: "director.write",
        desc: "场景决定光线与色彩基准，道具决定跨集连续性。两者都以版本管理，引用时必须锁定版本号。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.page("导演规划 / 场景与道具", "项目不在可见范围", "该链接指向的项目不存在或当前身份无权查看；场景与道具不会回退到其他项目。", U.btn("返回项目列表", "common.projects"), U.empty("无法读取项目", "请从项目列表或制作流水线进入可见项目。"));
          const pid = p.id;
          const locs = D.locations.filter(l => l.project === pid);
          const props = D.props.filter(x => x.project === pid);
          const locRows = locs.map(l =>
            '<tr><td>' + U.entity(l.name, l.id, "景") + "</td><td>" + U.esc(l.type) + '</td><td class="cell-wrap">' + U.esc(l.layout) + '</td><td class="cell-wrap muted">' + U.esc(l.light) + '</td><td class="cell-wrap">' + U.esc(l.color) + '</td><td class="num">' + (l.refs || 0) + "</td><td>" + U.code(l.version) + "</td><td>" + U.pill(l.status) + "</td><td>" +
            U.btn("查看", "director.locDetail", "sm", { id: l.id }) + "</td></tr>").join("");
          const propRows = props.map(x =>
            '<tr><td>' + U.entity(x.name, x.id, "物") + "</td><td>" + U.esc(x.type) + '</td><td class="cell-wrap">' + U.esc(x.look) + '</td><td class="cell-wrap muted">' + U.esc(x.state) + "</td><td>" + U.esc(x.owner) + '</td><td class="num">' + (x.refs || 0) + "</td><td>" + U.code(x.version) + "</td><td>" + U.pill(x.consistency) + "</td><td>" +
            U.btn("查看", "director.propDetail", "sm", { id: x.id }) + "</td></tr>").join("");
          return U.page("导演规划 / 场景与道具", "场景与道具 · " + p.name, "场景与道具的连续性靠版本与状态追踪，不靠记忆；当前只显示本项目的场景与道具。",
            U.btn("新增场景", "director.newLoc", "", { pid: pid }) + U.btn("新增道具", "director.newProp", "primary", { pid: pid }),
            U.card("场景（" + locs.length + "）", U.table(["场景", "类型", "布局", "光线", "色彩", "参考", "版本", "状态", "操作"], locRows, "当前项目还没有场景档案"), "场景参考不足时不允许生产该场次") +
            U.card("道具（" + props.length + "）", U.table(["道具", "类型", "外观", "状态变化", "归属", "参考", "版本", "一致性", "操作"], propRows, "当前项目还没有道具档案"), "道具状态变化必须标注集次", U.btn("一致性报告", "director.check", "sm", { pid: pid })) +
            '<div class="grid grid-2 mt-4">' +
              U.card("场景一致性要求", U.listRows([["光线基准", "同一场景跨集复用必须保持同一光线版本"], ["构图基准", "关键物件位置在画面中的基准不得随集次漂移"], ["复用", "同一场景跨集复用需保持同一版本"], ["抽检", "新场次首次生成必须抽检 1 帧"]]) , "场景变更影响整场镜头") +
              U.card("道具连续性", (props.length
                ? U.table(["道具", "状态变化", "归属"], props.map(x => ["<span class=\"cell-wrap\">" + U.esc(x.id) + " " + U.esc(x.name) + "</span>", U.esc(x.state || "全程同一状态"), U.esc(x.owner || "—")]).map(r => "<tr><td>" + r[0] + '</td><td class="cell-wrap">' + r[1] + '</td><td class="idx">' + r[2] + "</td></tr>").join(""))
                : U.empty("当前项目还没有道具档案", "新增道具后在这里追踪状态变化")) +
                U.notice("道具状态一旦在剧本中变化，必须在对应集次切换版本，否则视为画面缺陷。", "warn"), "状态变化需同步提示词") +
            "</div>"
          );
        }
      },
      {
        path: "director/shots", title: "镜头契约", icon: "scissors", permission: "director.write",
        desc: "ShotContract 是生产的最小契约：景别、机位、运镜、时长、人物、场景、道具、对白、情绪与质量要求缺一不可。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.page("导演规划 / 镜头契约", "项目不在可见范围", "该链接指向的项目不存在或当前身份无权查看；镜头契约不会回退到其他项目。", U.btn("返回项目列表", "common.projects"), U.empty("无法读取项目", "请从项目列表或制作流水线进入可见项目。"));
          const pid = p.id;
          const list = shotsOf(pid).slice().sort((a, b) => a.ep - b.ep || a.order - b.order);
          const eps = Array.from(new Set(list.map(s => Number(s.ep)))).sort((a, b) => a - b);
          const epRange = eps.length ? "E" + eps[0] + (eps.length > 1 ? "–E" + eps[eps.length - 1] : "") : "暂无镜头";
          const contract = list.filter(s => s.scene && s.desc && s.duration && s.chars && s.model && s.refs);
          const ready = list.filter(s => ["待生成", "待执行"].indexOf(s.status) >= 0 && s.model && s.model !== "待选择");
          const bg = DB.state.budgetOf(pid);
          const pct = bg && bg.total ? Math.round(bg.used / bg.total * 100) : 0;
          const rows = list.map(s =>
            '<tr><td>' + U.code(s.no) + '<div class="faint small">E' + s.ep + " / S" + s.scene + "</div></td><td class=\"cell-wrap\">" + U.esc(s.desc) + "</td><td>" + U.esc(s.frame) + " · " + U.esc(s.angle) + " · " + U.esc(s.move) + '</td><td class="num">' + U.esc(s.duration) + '</td><td class="cell-wrap muted">' + U.esc(s.chars) + '</td><td class="cell-wrap">' + U.esc(s.refs) + "</td><td>" + U.pill(s.status) + "</td><td>" +
            U.btn("详情", "director.shotDetail", "sm", { id: s.id }) + " " + U.btn("提交生产", "director.submitShot", "sm", { id: s.id }) + "</td></tr>").join("");
          const view = App.get(SCOPE, "view", "table");
          const tabsBar = U.card("", U.tabs([
            { value: "table", label: "镜头清单", count: list.length },
            { value: "board", label: "分镜视图", count: list.length }
          ], view, "director.view"));
          return U.page("导演规划 / 镜头契约", view === "board" ? "分镜视图 · " + p.name : "镜头契约 · " + p.name,
            view === "board" ? "先看画面再谈镜头：每张卡是一份可执行的镜头契约，状态来自任务，不靠拖动伪造。" : "契约固化后才允许提交生成；缺字段、参考未就绪或预算触发的镜头不允许进入队列。",
            U.btn("新建镜头", "director.newShot", "primary", { pid: pid }) + U.btn("批量提交", "director.batchSubmit", "", { pid: pid }) + (view === "board" ? U.btn("一致性抽检", "director.check", "", { pid: pid }) : ""),
            tabsBar + (view === "board" ? boardBlock(p) : U.card("镜头清单 · " + epRange, U.table(["镜头", "画面描述", "景别 / 机位 / 运镜", "时长", "人物", "引用资产", "状态", "操作"], rows, "当前项目还没有镜头契约"), "镜头清单只包含当前项目") +
            '<div class="split mt-4"><div class="stack">' +
              (list.length ? U.card("镜头卡预览", '<div class="shot-grid">' + list.slice(0, 3).map(s => U.shotCard(s)).join("") + "</div>", "镜头卡用于分镜评审，不代替契约字段") : U.empty("没有可预览的镜头", "先完成剧本拆解或新建镜头契约")) +
              U.card("批量提交校验", U.table(["校验项", "结果", "说明"], [
                ["契约完整性", contract.length === list.length ? "通过" : "待补", contract.length + " / " + list.length + " 个镜头字段齐全"],
                ["可提交镜头", ready.length ? "通过" : "注意", ready.length + " 个待生成/待执行镜头"],
                ["预算", bg ? (pct < 85 ? "通过" : "注意") : "待补", bg ? p.name + " 已用 " + pct + "%（¥" + DB.state.money(bg.used) + " / ¥" + DB.state.money(bg.total) + "）" : "未建立项目预算"],
                ["引用资产", list.filter(s => s.refs && s.refs !== "—").length === list.length ? "通过" : "待补", "引用版本需与人物/场景/道具当前版本一致"],
                ["并行上限", "按规则", "同一场景内并行 2 个，跨场景不抢占配额"]
              ].map(r => "<tr><td>" + r[0] + "</td><td>" + U.pill(r[1]) + '</td><td class="cell-wrap muted">' + r[2] + "</td></tr>").join("")), "校验失败项不进入队列") +
            '</div><div class="stack">' +
              U.card("契约字段组（10 项）", U.listRows([
                ["画面", "景别、机位、运镜、镜头倾向"], ["时间", "时长、节奏点"], ["人物", "出场人物与造型版本"],
                ["环境", "场景与光线版本"], ["道具", "关键道具与状态"], ["对白", "台词与语气"],
                ["表演", "情绪与动作指示"], ["声音", "环境声与音效要求"], ["质量", "检测项与阈值"], ["引用", "资产版本号与来源"]
              ]), "缺任意一项视为契约未完成") +
            "</div></div>")
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("director.view", (el) => { App.set(SCOPE, "view", el.dataset.value || "table"); App.refresh(); });
  App.on("director.toStoryboard", (el) => { App.set(SCOPE, "view", "board"); App.go("director/shots", { id: (el && el.dataset.id) || ((App.currentProject() || {}).id || "") }); });
  App.on("director.boardEp", (el) => { App.set(SCOPE, "boardEp", el.dataset.value || "all"); App.set(SCOPE, "boardShot", ""); App.refresh(); });
  App.on("director.boardState", (el) => { App.set(SCOPE, "boardState", el.dataset.value || "all"); App.set(SCOPE, "boardShot", ""); App.refresh(); });
  App.on("director.boardShot", (el) => { App.set(SCOPE, "boardShot", el.dataset.id || ""); App.refresh(); });
  App.on("director.toShots", (el) => { App.set(SCOPE, "view", "table"); App.go("director/shots", { id: (el && el.dataset.id) || ((App.currentProject() || {}).id || "") }); });
  App.on("director.toCast", (el) => App.go("director/cast", { id: (el && el.dataset.id) || ((App.currentProject() || {}).id || "") }));
  App.on("director.toVideo", (el) => App.go("video/production", { id: (el && el.dataset.id) || ((App.currentProject() || {}).id || "") }));
  App.on("director.toQueue", (el) => App.go("video/production", { id: (el && el.dataset.id) || ((App.currentProject() || {}).id || "") }));
  App.on("director.shotDetail", (el) => {
    const s = D.shots.find(x => x.id === (el && el.dataset.id));
    if (!s) return;
    App.drawer("镜头契约 · " + s.id, U.desc([["集 / 场", "E" + s.ep + " / S" + s.scene], ["镜头", s.no + " · " + s.frame + " · " + s.angle],
      ["运镜 / 镜头倾向", s.move + " · " + s.lens], ["时长", s.duration], ["人物 / 情绪", s.chars + " · " + s.emotion],
      ["台词", s.line], ["参考", s.refs], ["模型 / 质检项", s.model + " · " + s.quality], ["状态 / 版本", s.status + " · " + s.version]]) +
      U.notice("下游只引用具体镜头契约与版本；改契约必须新建版本并重新提交生成。", "info") +
      '<div class="btn-row-inline">' + U.btn("重新生成这一镜", "director.regenerate", "primary", { id: s.id }) + "</div>");
  });
  App.on("director.sceneShots", (el) => { if (App.guard("director.write")) App.go("director/shots", { id: (el && el.dataset.pid) || ((App.currentProject() || {}).id || "") }); else App.go("director/shots"); });
})();


/* ===== v9.1 真实流程层：导演规划按镜头契约执行 ===== */
(function () {
  const U = UI, D = DB;
  const currentPid = (el) => (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "");
  function nextId(prefix, list) {
    const max = Math.max(0, ...list.map(x => Number(String(x.id).split("-").pop()) || 0));
    return prefix + "-" + String(max + 1).padStart(2, "0");
  }

  App.on("director.freezePlan", (el) => {
    if (!App.guard("director.write")) return;
    const pid = (el && el.dataset.id) || ((App.currentProject() || {}).id || "");
    const plan = D.plans.find(x => x.project === pid && x.status !== "已固化") || D.plans.find(x => x.project === pid);
    if (!plan) { App.toast("没有可固化的生产计划：请先完成剧本拆解", "bad"); return; }
    const g = DB.state.gate(pid, "生产");
    if (!g.ok) { App.toast("生产门禁未通过：" + g.items.filter(i => !i.ok).map(i => i.label).join("、"), "bad"); return; }
    App.modal({
      title: "固化镜头生产计划 · " + plan.id, sub: "固化后不得再静默修改；变更须新建计划版本",
      body: U.card("生产门禁", '<div class="block-list">' + g.items.map(i => '<div class="block-item ' + (i.ok ? "ok" : "no") + '"><span class="dot"></span><span><span class="t">' + U.esc(i.label) + '</span><span class="n">' + U.esc(i.note) + "</span></span></div>").join("") + "</div>", "门禁全部通过才可固化") +
        U.fTextarea("固化说明", "note", { required: true, minlen: 10, rows: 3, placeholder: "说明并行分组、依赖顺序与预算控制口径" }),
      submitText: "固化并进入生产",
      onSubmit(d) {
        return App.job({
          title: "固化管理计划", sub: "校验门禁 → 写入计划版本 → 项目进入生产中",
          steps: ["校验生产门禁", "写入固化时间与操作者", "推进项目状态", "通知生产队列"],
          run() {
            const r = DB.state.freezePlan(plan.id);
            if (r.ok) DB.state.log("计划 " + plan.id, "固化说明：" + d.note, "成功", plan.id);
            return r;
          },
          after(out) { if (out && out.ok) App.go("projects/workflow", { id: pid }); }
        });
      }
    });
  });

  App.on("director.charDetail", (el) => {
    const c = D.characters.find(x => x.id === el.dataset.id);
    if (!c) return;
    App.drawer("人物档案 · " + c.name, U.desc([["编号", c.id], ["视觉年龄", c.age], ["外观", c.look], ["体型", c.build], ["发型", c.hair], ["造型", c.costume], ["禁用项", c.forbid], ["参考资产", c.refs + " 张"], ["版本", c.version], ["权利", c.rights], ["适用集次", c.reuse], ["状态", c.status]]) +
      (c.status === "已确认" ? U.notice("该档案已确认，可作为生产基准。", "ok") : U.notice("档案未确认前，引用它的镜头不可固化。", "warn")) +
      '<div class="btn-row-inline">' +
      (c.status === "已确认" ? "" : U.btn("确认视觉设定", "director.confirmChar", "primary", { id: c.id })) +
      U.btn("追加参考资产", "director.addRef", "sm", { id: c.id }) + U.btn("新建版本", "director.versionChar", "sm", { id: c.id }) + "</div>");
  });
  App.on("director.confirmChar", (el) => {
    if (!App.guard("director.write")) return;
    const c = D.characters.find(x => x.id === el.dataset.id);
    if (!c) return;
    if (c.refs < 3) { App.toast("参考资产不足 3 张，无法确认：" + c.name, "bad"); return; }
    App.job({ title: "确认识别设定", steps: ["校验参考资产数量", "锁定版本", "写审计"], run() { return DB.state.confirmAsset("character", c.id); }, after() { App.closeDrawer(); } });
  });

  App.on("director.locDetail", (el) => {
    const l = D.locations.find(x => x.id === el.dataset.id);
    if (!l) return;
    App.drawer("场景 · " + l.name, U.desc([["编号", l.id], ["类型", l.type], ["布局", l.layout], ["光线", l.light], ["色彩", l.color], ["道具", l.props], ["参考", l.refs + " 张"], ["版本", l.version], ["权利", l.rights], ["状态", l.status]]) +
      '<div class="btn-row-inline">' + (l.status === "已确认" ? "" : U.btn("确认场景设定", "director.confirmLoc", "primary", { id: l.id })) + "</div>");
  });
  App.on("director.confirmLoc", (el) => {
    if (!App.guard("director.write")) return;
    const l = D.locations.find(x => x.id === el.dataset.id);
    if (!l) return;
    if (l.refs < 2) { App.toast("场景参考不足 2 张，无法确认", "bad"); return; }
    App.job({ title: "确认场景设定", steps: ["校验参考资产", "锁定版本", "写审计"], run() { return DB.state.confirmAsset("location", l.id); }, after() { App.closeDrawer(); } });
  });

  App.on("director.propDetail", (el) => {
    const x = D.props.find(p => p.id === el.dataset.id);
    if (!x) return;
    App.drawer("道具 · " + x.name, U.desc([["编号", x.id], ["类型", x.type], ["外观", x.look], ["状态变化", x.state], ["归属", x.owner], ["参考", x.refs + " 张"], ["版本", x.version], ["一致性", x.consistency]]) +
      U.notice("道具状态变化必须在剧本对应集次同步，否则画面连续性视为缺陷。", "warn") +
      '<div class="btn-row-inline">' + U.btn("确认道具设定", "director.confirmProp", "primary", { id: x.id }) + "</div>");
  });
  App.on("director.confirmProp", (el) => {
    if (!App.guard("director.write")) return;
    App.job({ title: "确认道具设定", steps: ["校验版本", "锁定一致性口径"], run() { return DB.state.confirmAsset("prop", el.dataset.id); } });
  });

  App.on("director.submitShot", (el) => {
    if (!App.guard("production.write")) return;
    const s = D.shots.find(x => x.id === el.dataset.id);
    if (!s) return;
    if (s.status === "已通过") { App.toast(s.id + " 已通过质检，如需重做请走「重新生成」并说明理由", "bad"); return; }
    if (s.status === "排队中" || s.status === "执行中") { App.toast(s.id + " 已存在执行中任务，不能重复提交", "bad"); return; }
    if (!s.model || s.model === "待选择") { App.toast("镜头契约未选定模型，无法提交", "bad"); return; }
    App.modal({
      title: "提交镜头生产 · " + s.no, sub: "单镜头提交，进入同组队列；提交前做预算与依赖预检",
      body: U.desc([["镜头", s.id], ["集 / 场", "E" + s.ep + " / S" + s.scene], ["时长", s.duration], ["引用资产", s.refs], ["模型", s.model], ["质量要求", s.quality]]) +
        U.fSelect("优先级", "priority", ["高", "中", "低"], { value: "中" }) +
        U.fTextarea("提交说明", "note", { required: true, minlen: 6, rows: 2, placeholder: "例如：衔接 SH-04，需保持雨量一致" }),
      submitText: "提交任务",
      onSubmit(d) {
        return App.job({
          title: "提交镜头生产", sub: "预检 → 排队 → 写入任务台账",
          steps: ["校验镜头契约与模型", "预算与依赖预检", "写入任务并排队"],
          run() {
            const r = DB.state.submitTask({ project: s.project, shot: s.id, model: s.model, priority: d.priority });
            if (r.ok) DB.state.log("镜头 " + s.id, "提交生产任务 " + r.data.id + "：" + d.note, "成功", r.data.id);
            return r;
          },
          after() { App.closeDrawer(); }
        });
      }
    });
  });

  App.on("director.batchSubmit", (el) => {
    if (!App.guard("production.write")) return;
    const pid = currentPid(el);
    const pend = D.shots.filter(s => s.project === pid && ["待生成", "待执行"].indexOf(s.status) >= 0);
    if (!pend.length) { App.toast("没有可提交的待执行镜头", "bad"); return; }
    const sum = pend.reduce((n, s) => n + 38, 0);
    App.confirm("批量提交镜头", "将逐个提交 " + pend.length + " 个待执行镜头（并行上限 2，其余排队）。预计成本 ¥" + sum + "；预算不足的镜头会被拦下并给出原因。", () => {
      App.job({
        title: "批量提交镜头任务", steps: ["逐个校验预算与依赖", "提交并行组", "写入队列"],
        run() {
          let ok = 0, block = [];
          pend.forEach(s => {
            const r = DB.state.submitTask({ project: s.project, shot: s.id, model: s.model });
            if (r.ok) ok += 1; else block.push(s.id + "：" + r.msg);
          });
          return { ok: ok > 0, msg: "已提交 " + ok + " 个镜头" + (block.length ? "；" + block.length + " 个被拦下：" + block[0] : "") };
        }
      });
    }, "逐个提交");
  });

  App.on("director.regenerate", (el) => {
    if (!App.guard("production.write")) return;
    const s = D.shots.find(x => x.id === el.dataset.id);
    if (!s) return;
    App.modal({
      title: "重新生成镜头 · " + (s.no || s.id), sub: "原结果保留并作为历史版本；本次生成单独计费",
      body: U.fSelect("返工范围", "scope", ["单镜头局部重生成", "同场景全部重生成（不推荐）"]) +
        U.fTextarea("调整说明", "note", { required: true, minlen: 8, rows: 3, placeholder: "例如：加强眉疤可见度，雨量减小" }) +
        U.fCheck("沿用原参考资产版本", "keep", { checked: true }),
      submitText: "创建重生成任务",
      onSubmit(d) {
        return App.job({
          title: "创建重生成任务", steps: ["校验镜头当前状态", "创建新一次尝试 任务", "写入返工台账"],
          run() {
            if (d.scope !== "单镜头局部重生成" && s.status === "已通过") return { ok: false, msg: "整场重生成会浪费已通过镜头，已阻断；请选择单镜头局部重生成" };
            const r = DB.state.submitTask({ project: s.project, shot: s.id, model: s.model, priority: "高" });
            if (!r.ok) return r;
            s.status = "排队中";
            DB.state.log("镜头 " + s.id, "重新生成：" + d.note, "成功", r.data.id);
            return { ok: true, msg: "已创建重生成任务 " + r.data.id + "，原结果保留" };
          },
          after() { App.closeDrawer(); }
        });
      }
    });
  });

  App.on("director.pickRegen", (el) => {
    if (!App.guard("production.write")) return;
    const pid = currentPid(el);
    const shots = D.shots.filter(s => s.project === pid);
    if (!shots.length) { App.toast("当前项目还没有可重生成的镜头", "bad"); return; }
    App.modal({
      title: "选择镜头重生成", sub: "按镜头执行，不整集重跑",
      body: U.fSelect("镜头", "shot", shots.map(s => ({ value: s.id, label: s.no + " · E" + s.ep + " / S" + s.scene + "（" + s.status + "）" })), { required: true }) +
        U.fTextarea("调整说明", "note", { required: true, minlen: 8, rows: 3 }) +
        U.fCheck("沿用原参考资产版本", "keep", { checked: true }),
      submitText: "创建重生成",
      onSubmit(d) {
        return App.job({
          title: "创建重生成任务", steps: ["校验镜头状态", "创建任务"],
          run() {
            const s = D.shots.find(x => x.id === d.shot);
            const r = DB.state.submitTask({ project: s.project, shot: s.id, model: s.model, priority: "高" });
            if (r.ok) DB.state.log("镜头 " + s.id, "重生成：" + d.note, "成功", r.data.id);
            return r;
          }
        });
      }
    });
  });

  App.on("director.replan", (el) => {
    if (!App.guard("director.write")) return;
    const pid = (el && el.dataset.id) || ((App.currentProject() || {}).id || "");
    const p = DB.state.prj(pid);
    if (!p || p.status !== "生产准备中") { App.toast("仅「生产准备中」可重新规划（当前：" + (p ? p.status : "—") + "）", "bad"); return; }
    App.confirm("重新规划镜头契约", "将基于锁定剧本重建场次与镜头契约；已有镜头版本保留，冲突项进入待处理。", () => {
      App.job({ title: "重新规划镜头 · " + pid, steps: ["读取锁定剧本", "重建场次", "重建镜头契约"], run() { return DB.state.breakdown(p.id); }, after(out) { if (out && out.ok) App.go("director/plan", { id: pid }); } });
    }, "重新规划");
  });

  App.on("director.addRef", (el) => {
    if (!App.guard("director.write")) return;
    const c = D.characters.find(x => x.id === (el && el.dataset.id));
    if (!c) { App.toast("未找到人物档案", "bad"); return; }
    App.modal({
      title: "追加参考资产 · " + c.name, sub: "参考图仅用于内部生成，不对外发布",
      body: U.fSelect("资产来源", "src", ["本地上传", "企业资产库", "生成结果另存"], { required: true }) +
        U.fSelect("视图类型", "view", ["正脸", "侧脸", "半身", "全身", "特写"], { required: true }) +
        U.fTextarea("用途说明", "note", { required: true, minlen: 6, rows: 3, placeholder: "例如：补充雨夜灯光下的侧脸参考" }),
      submitText: "追加",
      onSubmit(d) {
        return App.job({
          title: "追加参考资产", steps: ["校验来源与视图", "写入资产引用", "刷新档案版本"],
          run() {
            c.refs = (c.refs || 0) + 1;
            DB.state.log("人物 " + c.id, "追加参考资产（" + d.view + "）", "成功", c.id);
            return { ok: true, msg: "已追加 " + d.view + " 参考，共 " + c.refs + " 张" };
          }
        });
      }
    });
  });

  App.on("director.versionChar", (el) => {
    if (!App.guard("director.write")) return;
    const c = D.characters.find(x => x.id === (el && el.dataset.id));
    if (!c) { App.toast("未找到人物档案", "bad"); return; }
    App.modal({
      title: "新建人物版本 · " + c.name, sub: "版本不覆盖：旧版本保留，受影响的已生成镜头标记需复核",
      body: U.fTextarea("变更内容", "note", { required: true, minlen: 8, rows: 3, placeholder: "例如：风衣改为深灰 v3，增加雨水浸湿质感" }),
      submitText: "新建版本",
      onSubmit(d) {
        return App.job({
          title: "新建人物版本", steps: ["复制当前档案", "写入新版本", "标记受影响镜头"],
          run() {
            const n = Number(String(c.version).replace("v", "")) + 1;
            c.version = "v" + n; c.status = "待确认";
            const affected = D.shots.filter(s => s.project === c.project && s.refs.indexOf(c.id) >= 0);
            affected.forEach(s => { if (s.status === "已通过") s.status = "需复核"; });
            DB.state.log("人物 " + c.id, "新建版本 v" + n + "：" + d.note, "成功", c.id);
            return { ok: true, msg: "已创建 v" + n + "，受影响镜头 " + affected.length + " 个标记需复核" };
          },
          after() { App.closeDrawer(); }
        });
      }
    });
  });

  App.on("director.check", (el) => {
    if (!App.guard("director.write")) return;
    const pid = currentPid(el);
    const shots = D.shots.filter(s => s.project === pid);
    if (!shots.length) { App.toast("当前项目还没有镜头，无法抽检", "bad"); return; }
    App.job({
      title: "执行一致性抽检", sub: "按价目与规则常量抽取 " + (D.pricing ? Math.round(D.pricing.qcSampleRate * 100) : 20) + "% 镜头比对人物 / 场景 / 道具与版本；不产生视频生成费用",
      steps: ["确定抽检样本", "比对参考资产版本", "写入质量报告"],
      run() {
        const rate = D.pricing ? D.pricing.qcSampleRate : 0.2;
        const minN = D.pricing ? D.pricing.qcMinSample : 2;
        const sample = shots.slice(0, Math.max(minN, Math.round(shots.length * rate)));
        const bad = sample.filter(s => s.status !== "已通过");
        const report = { id: "QR-" + pid.replace("SP-", "") + "-C" + sample.length + "-" + (D.qualityReports.length + 1), project: pid, object: pid + " / 一致性抽检", level: "镜头级", version: "抽检 " + sample.length + " 个", result: bad.length ? "REVIEW_REQUIRED" : "PASS", items: sample.length * (D.pricing ? D.pricing.qcItemsPerShot : 3), issues: bad.length, review: bad.length, fail: 0, engine: "视觉模型 V2", at: DB.state.at(), note: "抽检样本 " + sample.length + " 个（比例 " + Math.round(rate * 100) + "%，最少 " + minN + " 个）" };
        D.qualityReports.unshift(report);
        bad.forEach(s => D.qualityIssues.unshift({ report: report.id, project: pid, dim: "人物一致性", where: s.id, level: "中", action: "局部重生成", auto: "否" }));
        DB.state.log("一致性抽检", "抽检 " + sample.length + " 个镜头，问题 " + bad.length + " 项", bad.length ? "待处理" : "成功", report.id);
        return { ok: true, msg: "抽检完成：样本 " + sample.length + " 个，" + (bad.length ? bad.length + " 项待人工判断" : "全部通过") };
      }
    });
  });

  App.on("director.newShot", (el) => {
    if (!App.guard("director.write")) return;
    const pid = currentPid(el);
    const p = D.projects.find(x => x.id === pid);
    if (!p) { App.toast("未找到项目，无法新建镜头", "bad"); return; }
    const eps = D.episodes.filter(e => e.project === pid).sort((a, b) => a.no - b.no);
    if (!eps.length) { App.toast("项目还没有分集结构，请先完成剧本拆解", "bad"); return; }
    App.modal({
      title: "新建镜头契约 · " + p.name, sub: "契约字段缺一不可，缺失项不允许提交生产",
      body: '<div class="form-grid">' + U.fSelect("集", "ep", eps.map(e => ({ value: String(e.no), label: "E" + e.no + " · " + e.title })), { required: true }) + U.fSelect("场", "scene", ["01", "02", "03", "04", "05", "06"], { required: true }) + "</div>" +
        U.fTextarea("画面描述", "desc", { required: true, minlen: 12, rows: 3 }) +
        '<div class="form-grid">' + U.fSelect("景别", "frame", ["远景", "中景", "近景", "特写"]) + U.fSelect("机位", "angle", ["平视", "略仰", "俯拍", "低机位"]) + "</div>" +
        '<div class="form-grid">' + U.fSelect("运镜", "move", ["固定", "手持轻微跟随", "缓慢后拉", "横移"]) + U.fField("时长（秒）", "duration", { required: true, type: "number", min: 2, max: 12, value: "6" }) + "</div>" +
        U.fField("人物", "chars", { required: true, minlen: 1, placeholder: "例如：顾沉、苏眠；无人物写「环境」" }) +
        U.fField("引用资产（版本号）", "refs", { required: true, pattern: "^CH-[0-9]{2} v[0-9]+", placeholder: "CH-01 v3 · LC-01 v2" }) +
        U.fSelect("模型", "model", ["视频模型 A", "视频模型 B（备用）"], { required: true, hint: "备用模型不支持 3 张以上参考图" }),
      submitText: "创建契约",
      onSubmit(d) {
        return App.job({
          title: "创建镜头契约", steps: ["校验字段完整", "写入契约", "登记到生产计划"],
          run() {
            const ep = Number(d.ep);
            const epShots = D.shots.filter(s => s.project === pid && s.ep === ep);
            const maxNo = Math.max(0, ...epShots.map(s => Number(String(s.id).split("-").pop()) || 0));
            const nextNo = String(maxNo + 1).padStart(2, "0");
            const id = "SH-" + pid.replace("SP-", "") + "-E" + ep + "-" + nextNo;
            if (D.shots.some(s => s.id === id)) return { ok: false, msg: "镜头编号冲突：" + id };
            const order = Math.max(0, ...epShots.map(s => Number(s.order) || 0)) + 1;
            D.shots.push({ id: id, project: pid, ep: ep, scene: d.scene, no: "SH-" + nextNo, order: order, frame: d.frame, angle: d.angle, move: d.move, lens: "35mm 倾向", desc: d.desc, chars: d.chars, emotion: "—", line: "—", voice: "—", duration: d.duration + " 秒", refs: d.refs, model: d.model, quality: "人物一致性 / 画面异常 / 时长", status: "待生成", version: "—", qc: "" });
            DB.state.log("镜头 " + id, "新建镜头契约", "成功", id);
            return { ok: true, msg: "镜头契约已创建：" + id };
          }
        });
      }
    });
  });

  App.on("director.newLoc", (el) => {
    if (!App.guard("director.write")) return;
    const pid = currentPid(el);
    App.modal({
      title: "新增场景 · " + pid, sub: "场景需要明确布局、光线与色彩基准",
      body: U.fField("场景名称", "name", { required: true, minlen: 2 }) + U.fSelect("类型", "type", ["外景", "内景"]) +
        U.fTextarea("布局", "layout", { required: true, minlen: 8, placeholder: "空间结构、关键物件位置" }) +
        '<div class="form-grid">' + U.fField("光线基准", "light", { required: true }) + U.fField("色彩基准", "color", { required: true }) + "</div>",
      onSubmit(d) {
        return App.job({
          title: "新增场景", steps: ["校验字段", "写入场景档案"],
          run() {
            const id = nextId("LC", D.locations);
            D.locations.push({ id: id, project: pid, name: d.name, type: d.type, layout: d.layout, light: d.light, color: d.color, props: "—", refs: 0, version: "v1", rights: "AI 生成 · 无需授权", status: "待确认" });
            DB.state.log("场景 " + id, "新增场景档案：" + pid, "成功", id);
            return { ok: true, msg: "场景已新增：" + d.name + "，待确认参考后可进入生产" };
          }
        });
      }
    });
  });

  App.on("director.newProp", (el) => {
    if (!App.guard("director.write")) return;
    const pid = currentPid(el);
    App.modal({
      title: "新增道具 · " + pid, sub: "关键道具需要标注状态变化与归属",
      body: U.fField("道具名称", "name", { required: true, minlen: 2 }) + U.fSelect("类型", "type", ["关键道具", "服装道具", "环境道具"]) +
        U.fField("外观", "look", { required: true, minlen: 4 }) + U.fField("状态变化", "state", { placeholder: "例如：完整 → 第 19 集被撕开" }) + U.fField("归属人物", "owner"),
      onSubmit(d) {
        return App.job({
          title: "新增道具", steps: ["校验字段", "写入道具档案"],
          run() {
            const id = nextId("PR", D.props);
            D.props.push({ id: id, project: pid, name: d.name, type: d.type, look: d.look, state: d.state || "全程同一状态", owner: d.owner || "—", refs: 0, version: "v1", consistency: "待抽检" });
            DB.state.log("道具 " + id, "新增道具档案：" + pid, "成功", id);
            return { ok: true, msg: "道具已新增：" + d.name };
          }
        });
      }
    });
  });

  App.on("director.newChar", (el) => {
    if (!App.guard("director.write")) return;
    const pid = currentPid(el);
    App.modal({
      title: "新建人物档案 · " + pid, sub: "参考资产不足 3 张时档案保持「待确认」，不可作为生产基准",
      body: '<div class="form-grid">' + U.fField("人物名称", "name", { required: true, minlen: 1 }) + U.fField("视觉年龄", "age", { required: true, type: "number", min: 16, max: 80, value: "28" }) + "</div>" +
        U.fField("外观特征", "look", { required: true, minlen: 6 }) + U.fField("体型", "build", { required: true }) +
        U.fField("固定造型", "costume", { required: true, minlen: 4 }) +
        U.fTextarea("禁用项", "forbid", { required: true, minlen: 6, placeholder: "必须具体可执行，例如「不得戴眼镜」" }) +
        U.fSelect("权利来源", "rights", ["AI 生成 · 无需真人授权", "真人授权（需上传授权书）"], { required: true }),
      submitText: "创建档案",
      onSubmit(d) {
        return App.job({
          title: "创建人物档案", steps: ["校验设定完整", "写入档案", "初始化参考资产"],
          run() {
            const id = nextId("CH", D.characters);
            D.characters.push({ id: id, project: pid, name: d.name, age: d.age, look: d.look, build: d.build, hair: "—", costume: d.costume, forbid: d.forbid, refs: 0, version: "v1", rights: d.rights, status: "待确认", reuse: "待定" });
            DB.state.log("人物 " + id, "创建人物档案：" + pid, "成功", id);
            return { ok: true, msg: "档案已创建：" + d.name + "；参考资产 0 张，暂不可提交生产" };
          }
        });
      }
    });
  });
})();

