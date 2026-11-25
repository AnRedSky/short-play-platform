/* 模块：creation 创意与剧本（员工工作台） */
(function () {
  const U = UI, D = DB, SCOPE = "creation";
  const scriptList = (project) => D.scripts.filter(s => !project || s.project === project);

  AppModule.register({
    group: "creation", label: "创意与剧本", icon: "pen", order: 3, end: "workspace",
    routes: [
      {
        path: "creation/brief", title: "创意设定", icon: "pen", permission: "creation.write",
        desc: "七种创意输入方式落到同一份结构化创意设定，也可导入小说全文直接改编；版本化保存，记录操作者与资料来源。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.projectGuard("创意与剧本 / 创意设定", "创意设定只对当前项目生效；未选择项目时不会读取其他项目的草稿或版本。");
          const pid = p.id;
          const briefs = D.briefs.filter(b => b.project === pid).sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
          const cur = briefs[0];
          const frozen = !!p && ["已交付", "已归档"].indexOf(p.status) >= 0;
          const editable = !!p && !frozen && ["草稿", "创意策划中"].indexOf(p.status) >= 0;
          const mode = App.get(SCOPE, "briefMode:" + pid, cur ? cur.mode : "自由描述");
          const rows = briefs.map(b => '<div class="decision-row"><div><b>' + U.esc(b.mode) + " · " + U.esc(b.project) + '</b><small>' + U.code(b.id) + " · " + U.esc(b.version) + " · " + U.esc(b.by) + " · " + U.esc(b.at) + '</small></div><div style="display:flex;gap:6px;align-items:center">' + U.pill(b.status) + U.btn("打开", "creation.openBrief", "sm", { id: b.id }) + "</div></div>").join("");
          return U.page("创意与剧本 / 创意设定 · " + (p ? p.name : pid), "从一个想法，或一部小说开始",
            frozen ? "该项目当前为「" + p.status + "」，创意设定与方案只读；如需修改请从作品库新建 V2 版本链。" : editable ? "所有输入方式最终都收敛为同一份结构化创意设定；版本、授权与来源可追溯，草稿不进入下游。" : "项目已进入「" + p.status + "」，创意设定锁定为历史版本；修改需走剧本变更或新建 V2，不得回写已生产镜头。",
            (frozen ? U.btn("查看方案", "creation.toPlan", "", { id: pid }) + U.btn("新建 V2 版本链", "post.newVersion", "primary", { pid: pid }) : editable ? U.btn("新建创意设定", "creation.newBrief", "primary", { id: pid }) + U.btn("派生新版本", "creation.deriveBrief", "", { id: pid }) + U.btn("查看方案", "creation.toPlan", "", { id: pid }) : U.btn("查看方案", "creation.toPlan", "", { id: pid })) + U.btn("导入小说另立项目", "creation.importNovel"),
            '<div class="brief-layout"><div class="stack">' +
              U.card("当前项目 · " + U.esc(p ? p.name : pid), U.desc([["项目", pid], ["状态", p ? p.status : "—"], ["集数", (p ? p.episodes : 0) + " 集"], ["单集时长", p ? p.duration : "—"], ["预算", "¥" + Number(p ? DB.derived.budgetOfProject(p).total : 0).toLocaleString("zh-CN")], ["创意设定", cur ? cur.id + " · " + cur.version + "（" + cur.status + "）" : "尚未建立"]]), "创意设定只对当前项目生效；需要另立项目请使用导入小说入口") +
              U.card("创意设定台账 · " + U.esc(p ? p.name : pid), (rows || U.empty("当前项目还没有创意设定", "新建创意设定并提交后，系统会生成可比较的创意方案")) +
                '<div class="mt-3">' + (briefs.length ? U.timeline(briefs.slice(0, 5).map(b => ({ time: b.at, title: b.version + " · " + b.status, desc: b.mode + " · " + b.by }))) : U.empty("暂无版本记录", "提交创意设定后按版本留痕")) + "</div>", "草稿不进入下游生产；版本不覆盖，旧版可随时回看") +
              U.card("当前创意设定 · " + (cur ? cur.id : "尚无"), cur ? U.desc([["输入方式", cur.mode], ["创作意图", cur.note, true], ["版本 / 状态", cur.version + " · " + cur.status], ["操作者 / 时间", cur.by + " · " + cur.at], ["项目", cur.project]]) +
                '<div class="btn-row-inline">' + (editable ? U.btn("派生新版本", "creation.deriveBrief", "sm", { id: pid }) : "") + U.btn("与下游剧本比对", "creation.briefTrace", "sm", { id: cur.id }) + "</div>" : U.empty("尚无已确认创意设定", "先提交创作意图，再生成创意方案"), "资料授权不明确时不得进入生成") +
            '</div><aside class="stack">' +
              U.card("输入方式（七选一）", '<div class="brief-mode-grid">' + D.briefModes.map((m, i) => '<button type="button" class="brief-mode' + (mode === m.mode ? " on" : "") + '" data-action="creation.modeSet" data-value="' + U.esc(m.mode) + '">' +
                '<span class="mode-no">' + String(i + 1).padStart(2, "0") + '</span><span><b>' + U.esc(m.mode) + "</b><small>" + U.esc(m.input) + "</small></span>" + (mode === m.mode ? U.pill("当前", "accent") : "") + "</button>").join("") + "</div>" +
                U.notice("方式不同，产物同构：都落成同一份结构化创意设定，便于下游版本化与追溯。", "info"), "参考资料须确认有权使用",
                U.btn("查看该方式说明", "creation.modeDetail", "sm")) +
              U.card("生成前校验", U.listRows([
                ["必填", "题材、受众、时长、风格任一缺失则不启动"],
                ["长度", "不超过单集时长上限，超出提示拆分"],
                ["合规", "禁忌词与敏感设定先做文本预检"],
                ["来源", "参考资料需登记授权来源，未登记则阻断"],
                ["系统提示词", "只读展示摘要，标注「只读」"]
              ]), "校验不通过不消耗模型额度") +
            "</aside></div>"
          );
        }
      },
      {
        path: "creation/plan", title: "创意方案", icon: "grid", permission: "creation.write",
        desc: "基于创意设定产出多个可比较的创意方案：卖点、主题、开场钩子、风险与自检评分。选定方案才进入剧本生成。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.projectGuard("创意与剧本 / 创意方案", "创意方案按项目独立生成与选定；未选择项目时不会展示其他项目的候选。");
          const pid = p.id;
          const plans = D.creativePlans.filter(x => x.project === pid);
          const chosen = plans.find(x => x.chosen) || null;
          const frozen = !!p && ["已交付", "已归档"].indexOf(p.status) >= 0;
          const editable = !!p && !frozen && p.status === "创意策划中";
          return U.page("创意与剧本 / 创意方案 · " + (p ? p.name : pid), "创意方案", frozen ? "该项目当前为「" + p.status + "」，方案只读；下游剧本与镜头均以交付版本为准。" : editable ? "方案对比必须能看出差异与风险，而不是三份换词的同一份。" : "项目当前为「" + p.status + "」，方案已定稿；如需重选请走剧本变更，不得绕过锁定版本。",
            frozen ? U.btn("剧本版本", "creation.toScript", "", { id: pid }) + U.btn("返回创意设定", "creation.toBrief", "", { id: pid }) : editable ? U.btn("重新生成方案", "creation.regenPlan", "", { pid: pid }) + U.btn("返回创意设定", "creation.toBrief", "", { id: pid }) : U.btn("剧本版本", "creation.toScript", "", { id: pid }) + U.btn("返回创意设定", "creation.toBrief", "", { id: pid }),
            (plans.length ? '<div class="grid grid-2">' + plans.map(plan =>
              '<article class="card plan-card' + (plan.id === (chosen ? chosen.id : "") ? " chosen" : "") + '"><div class="card-body">' +
                '<div class="plan-head"><div><span class="kicker">' + U.esc(plan.id) + "</span><h3>" + U.esc(plan.title) + '</h3><div class="faint small">' + U.esc(plan.project) + '</div></div><div class="plan-score"><b>' + plan.score + "</b><span>自检分</span></div></div>" +
                U.desc([["核心卖点", plan.selling], ["主题", plan.theme], ["开场钩子", plan.hook], ["主要风险", plan.risk]]) +
                (plan.chosen ? '<div class="notice ok">当前已选定该方案，下游剧本以此为输入。</div>' : "") +
                '<div class="btn-row-inline">' + (plan.chosen ? U.btn("剧本版本", "creation.toScript", "sm", { id: plan.project }) : editable ? U.btn("选定该方案", "creation.choosePlan", "primary", { id: plan.id }) : "") + U.btn("查看评分依据", "creation.scoreDetail", "sm", { id: plan.id }) + "</div>" +
              "</div></article>").join("") + "</div>" : U.empty(frozen ? "该项目没有留存可比较方案" : "当前项目还没有创意方案", frozen ? "交付项目只保留已选定方案与剧本记录" : "先提交已确认的创意设定，再生成可比较方案")) +
            (plans.length ? U.card("方案对比", U.table(["维度"].concat(plans.map(x => x.id)), [
              ["核心卖点"].concat(plans.map(x => x.selling)),
              ["主题"].concat(plans.map(x => x.theme)),
              ["开场钩子"].concat(plans.map(x => x.hook)),
              ["主要风险"].concat(plans.map(x => x.risk)),
              ["自检分"].concat(plans.map(x => String(x.score)))
            ].map(r => "<tr>" + r.map((c, i) => '<td class="' + (i === 0 ? "cell-strong" : "cell-wrap" + (i > 1 ? " muted" : "")) + '">' + U.esc(c) + "</td>").join("") + "</tr>").join("")), "对比结论由人决定，不让模型自动定稿") : "") +
            U.card("方案到剧本的交接", U.listRows([["输入", "选定方案 + 创意设定版本号"], ["输出", "剧本草稿（候选，未审核）"], ["门禁", "剧本必须经人工审核通过并锁定后才可拆解"], ["追溯", "剧本记录引用的方案 ID 与 创意设定版本"]]) +
              U.notice("创意方案只是候选，不自动替代人工判断；方案与剧本都不锁定，下游一律不可启动。", "info"), "交接记录写审计")
          );
        }
      },
      {
        path: "creation/script", title: "剧本版本", icon: "film", permission: "creation.write",
        desc: "剧本以版本为单位管理：候选、退回、已通过正式版本并存，正式版本锁定后不静默覆盖。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.page("创意与剧本 / 剧本工作台", "项目不在可见范围", "该链接指向的项目不存在或当前身份无权查看；剧本版本不会回退到其他项目。", U.btn("返回项目列表", "common.projects"), U.empty("无法读取项目", "请从项目列表或制作流水线进入可见项目。"));
          const project = p.id;
          const list = scriptList(project);
          const cur = list.find(s => s.locked) || list[0];
          if (!cur || !cur.studioSample) {
            const eps = D.episodes.filter(e => e.project === project).sort((a, b) => a.no - b.no);
            const pname = (D.projects.find(x => x.id === project) || {}).name || project;
            return U.page("创意与剧本 / 剧本工作台 · " + pname, "剧本工作台 · " + pname,
              cur ? "该版本已登记规模与审核状态；正文样本未载入，审核以版本记录与分集覆盖为准。" : "该项目还没有剧本版本。",
              (!cur
                ? (p.status === "创意策划中" ? U.btn("查看方案", "creation.toPlan", "primary", { id: project }) : p.status === "剧本创作中" ? U.btn("生成候选剧本", "creation.generateScript", "primary", { id: project }) : U.btn("制作流水线", "projects.wfOpen", "primary", { pid: project }))
                : U.btn("去剧本审核", "creation.toReview", "primary", { id: project })) + U.btn("制作流水线", "projects.wfOpen", "", { pid: project }),
              U.card("当前版本", cur ? U.desc([["版本", cur.id], ["状态", cur.status], ["规模", cur.episodes + " 集 / " + (cur.scenes || 0) + " 场 / " + (cur.shots || 0) + " 镜 / " + (cur.lines || 0) + " 行"], ["项目", project], ["提交人 / 时间", cur.by + " · " + cur.at], ["说明", cur.note || "—", true]]) : U.empty("暂无剧本版本", "先导入小说或从创意生成候选剧本。"), "未载入正文时不展示虚构内容") +
              U.card("分集覆盖 · " + project, eps.length ? U.table(["集", "标题", "场", "镜头", "时长", "状态"], eps.map(e => '<tr><td class="num">E' + e.no + '</td><td>' + U.esc(e.title) + '</td><td class="num">' + e.scenes + '</td><td class="num">' + e.shots + '</td><td class="num">' + U.esc(e.duration) + '</td><td>' + U.pill(e.status) + "</td></tr>").join("")) : U.empty("尚未拆解分集", "剧本审核锁定后才能生成集、场与镜头契约"), "只展示当前项目真实记录") +
              U.card("剧本流转与当前位置", U.listRows([
                ["1 创意设定", "结构化创意设定确认后才允许生成候选剧本"],
                ["2 候选剧本", "可并存多个候选，未通过不进入生产"],
                ["3 审核锁定", "正式版本锁定后不静默覆盖，修改走变更或新建 V2"],
                ["4 拆集建约", "锁定后拆出集 / 场 / 镜头契约，成为下游唯一依据"]
              ]), "当前停在：" + (!cur ? "未建立剧本版本" : cur.locked ? "已锁定 " + cur.id : "候选 " + cur.id + "（待审核）"))
            );
          }
          const scriptEps = D.episodes.filter(e => e.project === project).sort((a, b) => a.no - b.no);
          const defaultEp = (scriptEps.find(e => e.qc !== "PASS") || scriptEps[0] || {}).no || 1;
          const epNo = Number((query && query.ep) || defaultEp);
          const ep = D.episodes.find(e => e.project === project && e.no === epNo);
          if (!ep) return U.page("创意与剧本 / 剧本工作台 · " + p.name, "第 " + epNo + " 集不存在", "该集不在当前项目范围内；剧本正文与镜头不会被其他集替代展示。",
            U.btn("制作流水线", "projects.wfOpen", "primary", { pid: project }),
            U.empty("无法打开该集", "请选择当前项目已拆解的集次，或从流水线重新进入。"));
          const epShots = D.shots.filter(s => s.project === project && s.ep === epNo);
          const sceneOrder = [];
          const sceneMap = {};
          epShots.forEach(s => {
            const key = String(s.scene || "01").padStart(2, "0");
            if (!sceneMap[key]) { sceneMap[key] = []; sceneOrder.push(key); }
            sceneMap[key].push(s);
          });
          sceneOrder.sort();
          const sceneTitles = { "01": "邮局门口", "02": "雨夜街口", "03": "对峙", "04": "信件架", "05": "未寄出的信", "06": "雨的尽头" };
          const sceneLocs = { "01": "旧城区 · 邮局门口 · 夜 / 外", "02": "旧城区 · 窄街 · 夜 / 外", "03": "旧城区 · 雨夜街口 · 夜 / 外", "04": "邮局旧址 · 夜 / 内", "05": "邮局旧址 · 夜 / 内", "06": "邮局旧址 · 夜 / 内" };
          const scenes = sceneOrder.map(no => {
            const list = sceneMap[no];
            const pass = list.filter(s => s.status === "已通过").length;
            const active = list.some(s => s.status !== "待生成" && s.status !== "已通过");
            return {
              no: "S" + no,
              title: sceneTitles[no] || (list[0].desc || "第 " + no + " 场").slice(0, 12),
              loc: sceneLocs[no] || (list[0].refs || "—"),
              meta: U.esc(list.reduce((n, s) => n + (parseFloat(s.duration) || 0), 0).toFixed(1)) + " 秒 · " + list.length + " 镜",
              state: pass === list.length ? "已拍" : (pass > 0 || active ? "制作中" : "待拍")
            };
          });
          const curScene = scenes.some(s => s.no === App.get(SCOPE, "scriptScene", "S03")) ? App.get(SCOPE, "scriptScene", "S03") : (scenes[0] ? scenes[0].no : "S01");
          const sceneBodies = {
            S01: '<p class="sp-action">雨水沿着邮局铁皮檐口落下。顾沉站在关了一半的窗口前，手里捏着一封没有寄件人的信。</p><p class="sp-char">顾沉</p><p class="sp-paren">（低声，像在确认）</p><p class="sp-dialog">「第三封了。」</p><p class="sp-action">窗口里的人没有抬头，只把一枚旧邮戳推出来。</p>',
            S02: '<p class="sp-action">窄街积水，霓虹被雨打散。苏眠从对街走过，伞沿压得很低，经过顾沉时停了半步。</p><p class="sp-char">苏眠</p><p class="sp-paren">（没有回头）</p><p class="sp-dialog">「别跟着我。」</p><p class="sp-action">顾沉没有动，直到她的伞消失在街角。</p>',
            S03: '<p class="sp-action">雨更密了。顾沉回头停步，信封从他指间滑出，落在积水里。苏眠站在两步之外，没有去捡。</p><p class="sp-char">顾沉</p><p class="sp-paren">（压着呼吸）</p><p class="sp-dialog">「这封信，不该在你手上。」</p><p class="sp-char">苏眠</p><p class="sp-paren">（退半步，声音很轻）</p><p class="sp-dialog">「你认错人了。」</p><p class="sp-action">远处邮筒的投信口发出一声轻响。两个人都没有回头。</p><p class="sp-trans">〔雨声压过对白，切 S04〕</p>',
            S04: '<p class="sp-action">邮局旧址内，灯只开了一盏。顾沉独自站在信件架前，手指沿着年份标签一格一格划过。</p><p class="sp-char">顾沉</p><p class="sp-paren">（旁白）</p><p class="sp-dialog">「信里的字迹，他认得。」</p><p class="sp-action">他抽出一封没有编号的信，封口已经被人拆过。</p>',
            S05: '<p class="sp-action">苏眠坐在窗边，把拆开的信重新折好。她没有读第二遍，只把台灯往信纸上挪近了一点。</p><p class="sp-char">苏眠</p><p class="sp-paren">（很轻）</p><p class="sp-dialog">「这次，换我写。」</p><p class="sp-action">镜头停在她握笔的手上，纸面洇开一小块雨痕。</p>'
          };
          const curSceneItem = scenes.find(s => s.no === curScene) || scenes[0] || { no: "S01", loc: "—" };
          const passCount = epShots.filter(s => s.status === "已通过").length;
          const projRec = D.projects.find(x => x.id === project);
          const canEdit = !cur.locked || (projRec && ["剧本创作中", "待剧本审核"].indexOf(projRec.status) >= 0);
          const charRows = D.characters.filter(c => c.project === project && epShots.some(s => String(s.refs).indexOf(c.id) >= 0)).map(c => [c.name, c.look + " · 本集 " + epShots.filter(s => String(s.refs).indexOf(c.id) >= 0).length + " 镜"]);
          return U.page("创意与剧本 / 剧本工作台", "剧本工作台 · " + ((projRec || {}).name || project), "左边是这一集的场次，中间是可以直接读的稿纸，右边是人物、连续性与版本；改稿产生新版本，不覆盖已锁定版本。",
            ((projRec && projRec.status === "剧本创作中") ? U.btn("生成候选剧本", "creation.generateScript", "primary", { id: project }) : "") + (App.can("script.review") && cur.status === "待审核" ? U.btn("提交审核", "creation.submitReview", "", { id: cur.id }) : "") + U.btn("制作流水线", "projects.wfOpen", "", { pid: project }) + U.btn("导出剧本", "common.export"),
            '<div class="script-studio">' +
              '<aside class="scene-rail">' +
                '<div class="rail-head"><span class="kicker">E' + epNo + ' · ' + U.esc(ep ? ep.title : "未命名") + '</span><b>' + scenes.length + ' 场 · ' + epShots.length + ' 镜</b><small>' + U.esc(ep ? ep.duration : "—") + ' · 竖屏 9:16</small></div>' +
                '<div class="rail-list">' + scenes.map(s =>
                  '<button type="button" class="scene-item' + (s.no === curScene ? " is-cur" : "") + '" data-action="creation.scriptScene" data-id="' + s.no + '">' +
                    '<span class="si-no">' + s.no + '</span><span class="si-body"><b>' + U.esc(s.title) + '</b><small>' + U.esc(s.loc) + '</small><em>' + s.meta + '</em></span>' +
                    '<span class="si-state tone-' + (s.state === "制作中" ? "accent" : s.state === "已拍" ? "ok" : "muted") + '">' + U.esc(s.state) + '</span>' +
                  '</button>').join("") + '</div>' +
                '<div class="rail-foot"><span>E' + Math.max(1, epNo - 1) + ' / E' + epNo + ' / E' + Math.min(24, epNo + 1) + '</span><span>仅展开 E' + epNo + '</span></div>' +
              '</aside>' +
              '<section class="script-main">' +
                '<div class="script-toolbar"><span class="pill ' + (cur.status === "已锁定" || cur.locked ? "ok" : "warn") + '">' + U.esc(cur.id) + " · " + U.esc(cur.status) + '</span><span class="faint small">第 ' + epNo + ' 集 · 第 ' + (scenes.findIndex(s => s.no === curScene) + 1) + ' / ' + scenes.length + ' 场</span><span style="flex:1"></span>' +
                  U.btn("与正式版本比对", "creation.diff", "sm") + '</div>' +
                '<article class="screenplay">' +
                  '<div class="sp-page-mark">FRAME · 剧本稿纸 / 第 ' + epNo + ' 集</div>' +
                  '<h2 class="sp-heading">' + ((curSceneItem.loc || "").indexOf("/ 内") >= 0 ? "内景" : "外景") + ' · ' + U.esc(curSceneItem.loc) + '</h2>' +
                  '<p class="sp-action">第 ' + epNo + ' 集《' + U.esc(ep ? ep.title : "未命名") + '》 · 场 ' + curScene + ' · ' + epShots.filter(s => "S" + String(s.scene).padStart(2, "0") === curScene).length + ' 镜</p>' +
                  '<div class="sp-body">' + (sceneBodies[curScene] || '<p class="sp-action">本场正文尚未载入；当前只登记镜头契约，正文以锁定版本为准。</p>') + '</div>' +
                  '<div class="sp-page-foot"><span>第 ' + (scenes.findIndex(s => s.no === curScene) + 1) + ' 场 / 共 ' + scenes.length + ' 场</span><span>' + U.esc(cur.version) + ' · ' + U.esc(cur.by) + ' · ' + U.esc(cur.at) + '</span></div>' +
                '</article>' +
                '<div class="script-main-foot">' + U.btn(canEdit ? "编辑本场" : "发起局部修改", canEdit ? "creation.editScript" : "creation.partialScript", "primary", { id: cur.id }) + U.btn("剧本拆解", "creation.toBreakdown", "sm", { id: project }) + (App.can("script.review") && !cur.locked ? U.btn("锁定正式版本", "creation.lock", "sm", { id: cur.id }) : "") + '</div>' +
              '</section>' +
              '<aside class="script-side">' +
                U.card("本集概览", U.desc([["集号 / 标题", "E" + epNo + "《" + (ep ? ep.title : "未命名") + "》"], ["场次 / 镜头", scenes.length + " 场 · " + epShots.length + " 镜"], ["时长", ep ? ep.duration : "—"], ["当前阶段", "视频生产 · " + passCount + " / " + epShots.length + " 镜通过"], ["审核基准", cur.id + "（" + cur.status + "）"]]), "改稿不覆盖锁定版本") +
                U.card("人物在场", charRows.length ? U.listRows(charRows) : U.empty("本集未登记人物", "镜头契约未引用任何人物档案"), "人物造型以档案版本为准") +
                U.card("连续性检查", '<ul class="check-list"><li class="ok">场次顺序按 S' + sceneOrder.join(" / S") + ' 排列，未跨日</li><li class="ok">本集镜头引用数为 ' + epShots.filter(s => s.refs).length + " / " + epShots.length + '</li><li class="warn">正文样本只覆盖 E17 前五场；第六场以镜头契约为准</li><li class="ok">改稿从当前稿派生，不覆盖锁定版本</li></ul>', "进入分镜前必须清零") +
                U.card("版本摘要", U.listRows([["版本数量", list.length + " 个"], ["最新版本", list[0] ? list[0].id : "—"], ["锁定版本", (list.find(s => s.locked) || {}).id || "无"], ["本集镜头", passCount + " / " + epShots.length + " 通过"]]), "按版本对版本计算") +
                U.card("审核状态", U.notice((list.find(s => s.locked) || {}).id ? "锁定版本是下游唯一基准；任何修改都从当前稿派生新版本。" : "当前版本尚未锁定，下游拆解不可启动。", (list.find(s => s.locked) ? "info" : "warn")), "", U.btn("去剧本审核", "creation.toReview", "sm", { id: project })) +
              '</aside>' +
            '</div>' +
            '<div class="mt-4">' + U.card("版本台账", U.table(["版本", "状态", "集 / 场 / 镜头 / 对白", "操作者", "时间", "备注"], list.map(s =>
              '<tr><td>' + U.code(s.id) + '</td><td>' + U.pill(s.status) + (s.locked ? " " + U.pill("已锁定", "accent") : "") + '</td><td class="num cell-wrap">' + s.episodes + " / " + s.scenes + " / " + s.shots + " / " + s.lines + "</td><td>" + U.esc(s.by) + '</td><td class="idx">' + U.esc(s.at) + '</td><td class="cell-wrap muted">' + U.esc(s.note) + "</td><td>" +
              U.btn("查看剧本", "creation.openScript", "sm", { id: s.id }) + "</td></tr>").join("")), "共 " + list.length + " 个版本；锁定版本不可覆盖") + '</div>'
          );

        }
      },
      {
        path: "creation/review", title: "剧本审核", icon: "shield", permission: "script.review",
        desc: "节点 A：人工审核剧本。通过则锁定正式版本并进入拆解；退回则必须指出位置与原因，由创作人修订产生新版本。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.page("创意与剧本 / 剧本审核", "项目不在可见范围", "该链接指向的项目不存在或当前身份无权查看；审核记录不会回退到其他项目。", U.btn("返回项目列表", "common.projects"), U.empty("无法读取项目", "请从项目列表或制作流水线进入可见项目。"));
          const projectId = p.id;
          const scoped = D.scripts.filter(s => s.project === projectId);
          const target = scoped.find(s => s.status === "待审核") || scoped.slice().sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
          if (!target) {
            return U.page("创意与剧本 / 剧本审核", "剧本审核", "当前项目没有剧本版本，审核不能跨项目借用其他项目的剧本。",
              U.btn("制作流水线", "projects.wfOpen", "", { pid: projectId || "" }), U.empty("该项目暂无剧本版本", "先导入小说或从创意生成候选剧本，再进入节点 A 审核。"));
          }
          const proj = D.projects.find(p => p.id === target.project);
          const brief = D.briefs.find(b => b.project === target.project);
          const targetEps = D.episodes.filter(e => e.project === target.project).sort((a, b) => a.no - b.no);
          const previewRows = targetEps.length
            ? targetEps.slice(-3).map(e => ["E" + String(e.no).padStart(2, "0"), e.title, e.scenes, e.shots, e.qc === "PASS" ? "已通过质检" : (e.status || "—")])
            : [["E01–E" + String(target.episodes).padStart(2, "0"), target.version + " 候选改编稿", target.scenes, target.shots, "尚未拆解；审核通过后才生成分集、场次与镜头契约"]];
          return U.page("创意与剧本 / 剧本审核", "剧本审核", "审核结论必须可执行：要么锁定版本，要么指出位置与修改方向。模糊结论一律视为未完成审核。",
            U.btn("审核记录", "creation.reviewHistory", "", { id: target.project }) + U.btn("剧本版本", "creation.toScript", "", { id: target.project }),
            '<div class="split"><div class="stack">' +
              U.card("待审对象", U.desc([["剧本版本", target.id], ["项目", target.project + " · " + (proj ? proj.name : "未知项目")], ["版本", target.version + "（" + target.status + "）"],
                ["规模", target.episodes + " 集 / " + target.scenes + " 场 / " + target.lines + " 行对白"], ["提交人", target.by], ["提交时间", target.at],
                ["上游引用", brief ? brief.id + " · " + brief.mode : "—"],
                ["审核边界", "审核人只看被审版本，不可直接改动；修改须退回并由创作人派生新版本"]]) +
                (target.status === "待审核" ? "" : U.notice("该版本当前为「" + target.status + "」，不可重复审核；如需修改请派生新版本。", "warn")) +
                '<div class="mt-3">' + U.table(["集", "标题", "场", "镜头", "状态"], previewRows.map(r =>
                "<tr><td>" + r[0] + '</td><td class="cell-wrap">' + U.esc(r[1]) + '</td><td class="num">' + r[2] + '</td><td class="num">' + r[3] + '</td><td class="cell-wrap muted">' + U.esc(r[4]) + "</td></tr>").join("")) + "</div>", "只展示当前版本真实覆盖；拆解前不伪造场次") +
            '</div><div class="stack">' +
              U.card("审核清单（7 项）", D.reviewChecklist[0].items.map((it, i) =>
                '<label class="check-line"><input type="checkbox"' + (i < 5 ? " checked" : "") + "><span>" + U.esc(it) + (i === 4 ? ' <span class="pill warn">待确认</span>' : "") + "</span></label>").join("") +
                U.notice("未勾选的检查项必须在结论中说明原因；不允许只勾结论不填依据。", "warn"), "清单即审核口径") +
              U.card("审核结论", '<div class="btn-col">' + (target.status === "待审核"
                ? U.btn("通过并锁定正式版本", "creation.approveScript", "primary", { id: target.id }) + U.btn("退回修改（指出位置）", "creation.rejectScript", "", { id: target.id }) + U.btn("局部修改", "creation.partialScript", "", { id: target.id }) + U.btn("终止项目", "creation.terminateScript", "", { id: target.id })
                : U.btn("查看剧本", "creation.openScript", "primary", { id: target.id }) + U.btn("局部修改", "creation.partialScript", "", { id: target.id })) + "</div>" +
                U.desc([["记录项", "通过后必须记录审核人、角色、时间、结论与依据"], ["结论", "通过 / 退回修改 / 终止项目 三选一"], ["锁定", "锁定后下游才可启动，改内容只能派生新版本"]]), "结论写入审核记录与项目生命周期") +
              U.card("变更影响分析（业务方案 §6.4）", (function () {
                const imp = DB.state.impactAnalysis(projectId, target.id);
                if (!imp.ok) return U.empty("无法执行影响分析", "项目不存在。");
                return U.table(["分析维度", "受影响数量", "明细", "处理口径"], imp.dims.map(d =>
                  "<tr><td class=\"cell-strong\">" + U.esc(d.label) + '</td><td class="num">' + d.count + '</td><td class="cell-wrap muted">' + (d.items.length ? U.esc(d.items.slice(0, 3).join("；")) + (d.items.length > 3 ? " 等 " + d.items.length + " 项" : "") : "—") + '</td><td class="cell-wrap muted">' + U.esc(d.note) + "</td></tr>").join("")) +
                  '<div class="btn-row-inline">' + U.btn("查看镜头级受影响清单", "creation.impact", "primary", { id: projectId }) + "</div>";
              })(), "影响分析必须到镜头级清单，不能只给汇总计数") +
              U.card("历史审核", U.table(["记录", "对象", "结论", "审核人", "时间"], D.reviews.filter(r => String(r.node).indexOf("剧本") >= 0 && (!projectId || String(r.object).indexOf(projectId) >= 0)).map(r =>
                '<tr><td>' + U.code(r.id) + "</td><td>" + U.esc(r.object) + "</td><td>" + U.pill(r.result) + "</td><td>" + U.esc(r.auditor) + '</td><td class="idx">' + U.esc(r.at) + "</td></tr>").join("")), "退回原因与指向位置一并留痕") +
            "</div></div>"
          );
        }
      },
      {
        path: "creation/breakdown", title: "剧本拆解", icon: "scissors", permission: "creation.write",
        desc: "把锁定剧本拆成集、场、人物、场景、道具、对白六类独立对象，并建立引用关系；拆解结果进入导演规划。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.page("创意与剧本 / 剧本拆解", "项目不在可见范围", "该链接指向的项目不存在或当前身份无权查看；拆解记录不会回退到其他项目。", U.btn("返回项目列表", "common.projects"), U.empty("无法读取项目", "请从项目列表或制作流水线进入可见项目。"));
          const pid = p.id;
          const eps = D.episodes.filter(e => e.project === pid).sort((a, b) => a.no - b.no);
          const shots = D.shots.filter(s => s.project === pid);
          const chars = D.characters.filter(c => c.project === pid);
          const locs = D.locations.filter(l => l.project === pid);
          const props = D.props.filter(o => o.project === pid);
          const script = D.scripts.find(s => s.project === pid && (s.status === "已锁定" || s.locked)) || D.scripts.find(s => s.project === pid);
          const totalScenes = eps.reduce((n, e) => n + (Number(e.scenes) || 0), 0);
          const stale = D.timelines.filter(tl => tl.project === pid && (tl.stale || 0) > 0);
          const uncovered = eps.filter(e => (Number(e.shots) || 0) !== shots.filter(s => s.ep === e.no).length);
          const assetRows = []
            .concat(chars.filter(c => c.status !== "已确认" && c.status !== "抽检通过").map(c => [c.name, "角色", c.status, shots.filter(s => String(s.refs).indexOf(c.id) >= 0).length]))
            .concat(locs.filter(l => l.status !== "已确认").map(l => [l.name, "场景", l.status, shots.filter(s => String(s.refs).indexOf(l.id) >= 0).length]))
            .concat(props.filter(o => o.consistency === "待抽检").map(o => [o.name, "道具", o.consistency, shots.filter(s => String(s.refs).indexOf(o.id) >= 0).length]));
          const pendingRows = assetRows.map(r => [r[0] + " · " + r[1] + " " + r[2], "全项目", "影响 " + r[3] + " 个镜头；放行前需处理"])
            .concat(uncovered.map(e => ["E" + String(e.no).padStart(2, "0") + " 镜头契约不齐", "E" + String(e.no).padStart(2, "0"), "计划 " + e.shots + " 镜，实际 " + shots.filter(s => s.ep === e.no).length + " 镜"]))
            .concat(stale.map(tl => ["时间线标脏 " + (tl.id || tl.version), "E" + String(tl.ep).padStart(2, "0"), "标脏 " + tl.stale + " 处；后期前必须重出"]));
          const deviations = eps.map(e => {
            const target = parseFloat(e.duration) || 0;
            const sum = shots.filter(s => s.ep === e.no).reduce((n, s) => n + (parseFloat(s.duration) || 0), 0);
            return { ep: e.no, dev: sum - target, tol: Math.max(5, target * 0.1) };
          });
          const worst = deviations.slice().sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev))[0];
          const selfCheck = [
            ["完整性", eps.length === (p.episodes || 0) && totalScenes > 0 && shots.length > 0, (p.episodes || 0) + " 集预期；实际 " + eps.length + " 集 / " + totalScenes + " 场 / " + shots.length + " 镜"],
            ["分集覆盖", uncovered.length === 0, uncovered.length ? uncovered.length + " 集镜头数与契约不符" : "每集镜头数与计划一致"],
            ["引用完整", shots.length > 0 && shots.every(s => s.refs), shots.filter(s => !s.refs).length + " 个镜头缺引用"],
            ["时长", deviations.every(x => Math.abs(x.dev) <= x.tol), worst ? ("最大偏差 " + (worst.dev > 0 ? "+" : "") + worst.dev.toFixed(1) + " 秒（E" + worst.ep + "），容差 " + worst.tol.toFixed(1) + " 秒（10%，最低 5 秒）") : "无分集可校验"],
            ["对象唯一", new Set(shots.map(s => s.id)).size === shots.length, "重复镜头 ID：" + (shots.length - new Set(shots.map(s => s.id)).size)]
          ];
          const canBreak = p.status === "生产准备中";
          const firstEp = eps.find(e => shots.some(s => s.ep === e.no));
          const firstShots = firstEp ? shots.filter(s => s.ep === firstEp.no).slice(0, 2) : [];
          return U.page("创意与剧本 / 剧本拆解", "剧本拆解 · " + p.name, "拆解不是切分文本：每个对象都有独立 ID、版本与引用，镜头契约从这里生成。",
            (canBreak ? U.btn(eps.length ? "重新拆解" : "执行拆解", "creation.rerunBreakdown", "", { id: pid }) : U.btn("制作流水线", "projects.wfOpen", "primary", { pid: pid })) + U.btn("进入导演规划", "creation.toDirector", canBreak ? "primary" : "", { id: pid }),
            U.card("拆解结果 · " + (script ? script.id : "尚无锁定剧本"), '<div class="kv-grid">' + U.kv("集", eps.length) + U.kv("场", totalScenes) + U.kv("人物", chars.length) + U.kv("场景", locs.length) + U.kv("道具", props.length) + U.kv("镜头", shots.length) + "</div>" +
              '<div class="mt-3">' + (script && firstEp && firstShots.length ? U.chain([
                { label: script.id, meta: "锁定剧本", state: "done" },
                { label: "E" + firstEp.no + " " + (firstShots[0].scene ? "S" + firstShots[0].scene : "场"), meta: firstEp.title, state: "done" },
                { label: firstShots.map(s => s.no).join(" · "), meta: "镜头 " + firstShots.length + " 个", state: "now" },
                { label: firstShots[0].refs, meta: "对象引用", state: "" }
              ]) : U.empty("尚无拆解对象", "锁定剧本并拆解后显示引用链")) + "</div>", "引用对象版本，不引用自由文本；数据来自当前项目 " + pid) +
            '<div class="split mt-4"><div class="stack">' +
              U.card("集 / 场", U.table(["集", "标题", "场", "镜头", "时长", "状态"], eps.map(e =>
                '<tr><td class="num">E' + e.no + '</td><td>' + U.esc(e.title) + '</td><td class="num">' + e.scenes + '</td><td class="num">' + e.shots + '</td><td class="num">' + U.esc(e.duration) + "</td><td>" + U.pill(e.status) + "</td></tr>").join("")), "集状态由生产进度回写") +
              U.card("人物", U.table(["人物", "造型关键", "禁用项", "引用镜头", "版本", "状态"], chars.map(c =>
                '<tr><td>' + U.entity(c.name, c.id, c.name.slice(0, 1)) + '</td><td class="cell-wrap muted">' + U.esc(c.look) + '</td><td class="cell-wrap">' + U.esc(c.forbid) + '</td><td class="num">' + shots.filter(s => String(s.refs).indexOf(c.id) >= 0).length + "</td><td>" + U.code(c.version) + "</td><td>" + U.pill(c.status) + "</td></tr>").join("")), "禁用项会进入提示词负面约束") +
              U.card("场景 / 道具", U.table(["对象", "类型", "布局 / 外观", "引用镜头", "版本", "状态"], locs.concat(props).map(o =>
                '<tr><td>' + U.entity(o.name, o.id, "景") + '</td><td>' + U.esc(o.type) + '</td><td class="cell-wrap muted">' + U.esc(o.layout || o.look) + '</td><td class="num">' + shots.filter(s => String(s.refs).indexOf(o.id) >= 0).length + "</td><td>" + U.code(o.version) + "</td><td>" + U.pill(o.status || o.consistency) + "</td></tr>").join("")), "道具状态变化需标注在集次") +
            '</div><div class="stack">' +
              U.card("拆解待处理与自检", (pendingRows.length ? U.table(["事项", "位置", "影响"], pendingRows.map(r => "<tr><td class=\"cell-wrap\">" + U.esc(r[0]) + '</td><td class="idx">' + U.esc(r[1]) + '</td><td class="cell-wrap muted">' + U.esc(r[2]) + "</td></tr>").join("")) : U.empty("暂无待处理项", "资产确认、镜头契约与时间线均无未决项")) +
                '<div class="mt-3">' + U.table(["检查", "结论", "依据"], selfCheck.map(r => "<tr><td>" + U.esc(r[0]) + "</td><td>" + (r[1] ? U.pill("通过") : U.pill("不通过")) + '</td><td class="cell-wrap muted">' + U.esc(r[2]) + "</td></tr>").join("")) + "</div>", "待处理项必须能定位到对象；自检不通过不进入镜头契约固化") +
            "</div></div>"
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("creation.toPlan", (el) => {
    const id = el && (el.dataset.id || el.dataset.pid);
    App.go("creation/plan", id ? { id: id } : undefined);
  });
  App.on("creation.toBrief", (el) => {
    const id = el && (el.dataset.id || el.dataset.pid);
    App.go("creation/brief", id ? { id: id } : undefined);
  });
  App.on("creation.toScript", (el) => {
    const id = el && el.dataset.id;
    if (id) App.set(SCOPE, "scriptProject", id);
    App.go("creation/script", id ? { id: id } : undefined);
  });
  App.on("creation.toReview", (el) => App.go("creation/review", el && el.dataset.id ? { id: el.dataset.id } : undefined));
  App.on("creation.toBreakdown", (el) => App.go("creation/breakdown", el && el.dataset.id ? { id: el.dataset.id } : undefined));
  App.on("creation.toDirector", (el) => App.go("director/plan", el && el.dataset.id ? { id: el.dataset.id } : undefined));
  App.on("creation.modeSet", (el) => {
    const val = el && (el.dataset.value || el.value);
    if (!val) return;
    const pid = (App.currentProject() || {}).id || "";
    App.set(SCOPE, "briefMode:" + pid, val);
    App.toast("输入方式已切换为「" + val + "」");
    App.refresh();
  });
  App.on("creation.modeDetail", () => {
    const pid = (App.currentProject() || {}).id || "";
    const cur = App.get(SCOPE, "briefMode:" + pid, "自由描述");
    const m = D.briefModes.find(x => x.mode === cur) || D.briefModes[0];
    App.drawer("输入方式说明 · " + m.mode, U.desc([["输入", m.input], ["输出", m.output], ["落库", "结构化创意设定（版本化）"], ["校验", "必填、长度、合规、来源授权"]]) +
      U.notice("无论哪种输入方式，产物都是同一结构；差异只在引导与抽取重点。", "info"));
  });
  App.on("creation.importNovel", () => {
    if (!App.guard("creation.write")) return;
    App.modal({
      wide: true,
      title: "导入小说改编为剧本",
      sub: "从小说直接立项：生成创意设定、分集改编稿与待审核剧本；与手动立项共用同一套校验与预算台账。",
      body: '<div class="grid grid-2">' +
        U.fField("小说名（项目名）", "name", { required: true, minlen: 2, placeholder: "例如：长夜将明", hint: "2–20 个字符，企业内不可重名" }) +
        U.fField("原著作者", "author", { required: true, placeholder: "例如：沈砚" }) +
        U.fSelect("改编忠实度", "fidelity", ["忠实原著", "适度改编", "大幅改编"], { required: true }) +
        U.fField("题材 / 类型", "genre", { value: "悬疑 / 都市" }) +
        U.fField("目标受众", "audience", { value: "18–30 岁都市女性" }) +
        U.fSelect("画面风格", "style", ["按原著基调改编", "冷灰低饱和 · 手持近景", "暖调柔光 · 固定机位"], { required: true }) +
        U.fField("集数", "episodes", { required: true, type: "number", min: 4, max: 60, value: "20" }) +
        U.fField("单集时长（秒）", "duration", { required: true, type: "number", min: 30, max: 300, value: "90" }) +
        U.fField("项目预算（元）", "budget", { required: true, rule: "money", value: "22000", hint: "提交后按部门与企业可用余额校验；镜头数与单镜成本按集数估算" }) +
        U.fSelect("归属部门", "dept", ["内容创新部", "制作中心"], { required: true }) +
        '</div>' +
        '<label class="field-wrap full"><span class="field-label">导入原文文件（可选）</span><input type="file" id="novel-file" accept=".txt,.md,text/plain"><span class="field-hint" id="novel-file-info">支持 txt / md。文件只在本机读取并填入下方文本框，不会上传。</span></label>' +
        U.fTextarea("小说原文", "text", { required: true, minlen: 300, rows: 8, placeholder: "粘贴小说全文，或先用上方按钮导入文件；至少 300 字" }) +
        U.fCheck("我确认拥有该小说的改编权或已获得授权", "rights", { checked: false }),
      submitText: "解析并生成改编稿",
      validate(d) {
        const errs = {};
        if (!d.rights) errs.rights = "未确认改编授权，不能解析原文";
        if (String(d.text || "").trim().length < 300) errs.text = "原文至少 300 字（当前 " + String(d.text || "").trim().length + " 字）";
        return errs;
      },
      onSubmit(d) {
        return App.job({
          title: "小说改编", sub: "切分章节并生成分集改编稿，完成后自动进入剧本审核",
          steps: ["校验授权与原文", "按章节切分", "提炼主线与人物", "生成分集改编稿", "写入项目与预算台账"],
          run: () => DB.state.importNovel(d),
          after(out) {
            if (out && out.ok) App.go("projects/detail", { id: out.data.project.id });
          }
        });
      }
    });
    const fileInput = document.getElementById("novel-file");
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const f = fileInput.files && fileInput.files[0];
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) { App.toast("文件需小于 2 MB；更大的稿件请直接粘贴正文", "bad"); fileInput.value = ""; return; }
        const reader = new FileReader();
        reader.onload = () => {
          const form = document.getElementById("app-form");
          const area = form && form.querySelector('[name="text"]');
          const info = document.getElementById("novel-file-info");
          if (area) area.value = String(reader.result || "");
          if (info) info.textContent = "已读取 " + f.name + " · " + String(reader.result || "").trim().length + " 字，已填入文本框";
          const nameEl = form && form.querySelector('[name="name"]');
          if (nameEl && !nameEl.value) nameEl.value = f.name.replace(/\.(txt|md)$/i, "").slice(0, 20);
        };
        reader.readAsText(f, "utf-8");
      });
    }
  });
  App.on("creation.openBrief", (el) => {
    const b = D.briefs.find(x => x.id === el.dataset.id);
    if (!b) return;
    const bp = DB.state.prj(b.project);
    if (!bp || !DB.derived.canViewProject(bp)) { App.toast("该创意设定所属项目不在当前可见范围", "bad"); return; }
    App.drawer("创意设定 · " + b.id, U.desc([["项目", b.project], ["版本", b.version], ["输入方式", b.mode], ["状态", b.status], ["操作者", b.by], ["时间", b.at], ["摘要", b.note]]) +
      U.notice("创意设定更改会生成新版本，下游引用旧版本的剧本不会自动变化，需人工确认影响。", "info"));
  });
  App.on("creation.briefTrace", (el) => {
    const b = D.briefs.find(x => x.id === (el && el.dataset.id)) || D.briefs.find(x => x.project === ((App.currentProject() || {}).id || ""));
    if (!b) { App.toast("当前没有可追溯的创意设定", "bad"); return; }
    const bp = DB.state.prj(b.project);
    if (!bp || !DB.derived.canViewProject(bp)) { App.toast("该创意设定所属项目不在当前可见范围", "bad"); return; }
    const plan = D.creativePlans.find(x => x.project === b.project && x.chosen);
    const script = D.scripts.find(x => x.project === b.project && (x.locked || x.status === "已锁定")) || D.scripts.find(x => x.project === b.project);
    const eps = D.episodes.filter(e => e.project === b.project);
    const shots = D.shots.filter(s => s.project === b.project);
    App.drawer("创意设定 → 剧本追溯 · " + b.project, U.table(["层级", "对象", "版本", "状态"], [
      ["创意设定", b.id, b.version, b.status],
      ["方案", plan ? plan.id : "尚未选定", "—", plan ? "已选定" : "未选定"],
      ["剧本", script ? script.id : "尚未生成", script ? script.version : "—", script ? (script.locked ? "已锁定" : script.status) : "未生成"],
      ["拆解", eps.length ? eps.length + " 集 / " + shots.length + " 镜头" : "尚未拆解", "—", eps.length ? "已固化" : "未拆解"]
    ].map(r => "<tr><td>" + r[0] + "</td><td>" + U.code(r[1]) + "</td><td>" + r[2] + "</td><td>" + U.pill(r[3]) + "</td></tr>").join("")));
  });
  App.on("creation.scoreDetail", (el) => {
    const p = D.creativePlans.find(x => x.id === el.dataset.id);
    if (!p) return;
    const base = Number(p.score) || 80;
    const dims = [["卖点清晰度", Math.min(98, base + 10)], ["钩子强度", Math.min(98, base + 6)], ["受众匹配", Math.min(98, base + 8)], ["制作可行性", Math.max(60, base - 4)], ["风险控制", p.risk && p.risk.length > 20 ? Math.max(60, base - 12) : Math.max(65, base - 2)]];
    App.drawer("自检评分 · " + p.id, U.desc([["总分", base + " / 100"]].concat(dims)) +
      U.notice("评分是参考，不是决策依据；选定方案需人工判断。", "info"));
  });
  App.on("creation.reviewTab", (el) => { App.set(SCOPE, "reviewEp", el.dataset.value); App.refresh(); });
  App.on("creation.scriptScene", (el) => {
    if (!el || !el.dataset.id) return;
    App.set(SCOPE, "scriptScene", el.dataset.id);
    App.refresh();
  });

  App.on("creation.openScript", (el) => {
    const s = D.scripts.find(x => x.id === el.dataset.id);
    if (!s) return;
    const sp = DB.state.prj(s.project);
    if (!sp || !DB.derived.canViewProject(sp)) { App.toast("该剧本所属项目不在当前可见范围", "bad"); return; }
    App.drawer("剧本 · " + s.id, U.desc([["项目", s.project], ["版本", s.version], ["状态", s.status], ["规模", s.episodes + " 集 / " + s.scenes + " 场 / " + s.shots + " 镜头"], ["对白", s.lines + " 行"], ["操作者", s.by], ["时间", s.at], ["锁定", s.locked ? "已锁定（下游基准）" : "未锁定"]]) +
      U.notice(s.note, s.locked ? "ok" : "info") +
      '<div class="mt-3">' + U.btn("与正式版本比对", "creation.diff", "sm", { id: s.id }) + "</div>");
  });
  App.on("creation.diff", (el) => {
    const cur = D.scripts.find(x => x.id === (el && el.dataset && el.dataset.id));
    if (!cur) { App.toast("缺少剧本版本标识，无法比对", "bad"); return; }
    const same = D.scripts.filter(x => x.project === cur.project);
    const prev = same[same.indexOf(cur) + 1] || same.find(x => x.id !== cur.id);
    if (!prev) { App.drawer("版本比对 · " + cur.id, U.empty("没有可比较的历史版本", "该版本是当前项目唯一版本")); return; }
    const delta = (a, b, unit) => a === b ? "不变" : (a > b ? "＋" : "−") + Math.abs(a - b) + " " + unit;
    App.drawer("版本比对 · " + cur.version + " vs " + prev.version, U.desc([["项目", cur.project], ["当前版本", cur.id + " · " + cur.status], ["对比版本", prev.id + " · " + prev.status]]) +
      '<div class="diff-list">' +
      '<div class="diff-row"><span class="tag">' + delta(cur.scenes, prev.scenes, "场") + '</span><p>场次规模：' + U.esc(prev.scenes + " → " + cur.scenes) + "</p></div>" +
      '<div class="diff-row"><span class="tag">' + delta(cur.shots, prev.shots, "镜") + '</span><p>镜头规模：' + U.esc(prev.shots + " → " + cur.shots) + "</p></div>" +
      '<div class="diff-row"><span class="tag">' + delta(cur.lines, prev.lines, "行") + '</span><p>对白行数：' + U.esc(prev.lines + " → " + cur.lines) + "</p></div>" +
      '<div class="diff-row"><span class="tag">说明</span><p>' + U.esc(cur.note || "无版本说明") + "</p></div>" +
      "</div>" + U.notice("差异仅作评审参考，不自动应用到已锁定版本。", "info"));
  });
  App.on("creation.reviewHistory", (el) => {
    const pid = el && el.dataset.id;
    const rows = D.reviews.filter(r => String(r.node).indexOf("剧本") >= 0 && (!pid || String(r.object).indexOf(pid) >= 0));
    App.drawer("剧本审核记录" + (pid ? " · " + pid : ""), U.table(["记录", "对象", "结论", "审核人", "位置", "后续"], rows.map(r =>
      "<tr><td>" + U.code(r.id) + "</td><td>" + U.esc(r.object) + "</td><td>" + U.pill(r.result) + "</td><td>" + U.esc(r.auditor) + '</td><td class="cell-wrap muted">' + U.esc(r.positions) + "</td><td>" + U.esc(r.follow) + "</td></tr>").join("")), pid ? U.notice("仅显示 " + pid + " 的审核记录；跨项目记录不混排。", "info") : "");
  });
})();


/* ===== v9.1 真实流程层：以 Store 改写业务状态，替换旧版简易动作 ===== */
(function () {
  const U = UI, D = DB;

  App.on("creation.newBrief", (el) => {
    if (!App.guard("creation.write")) return;
    const want = (el && (el.dataset.pid || el.dataset.id)) || ((App.currentProject() || {}).id || "");
    const wantProject = want ? DB.state.prj(want) : null;
    if (wantProject && ["草稿", "创意策划中"].indexOf(wantProject.status) < 0) { App.toast("《" + wantProject.name + "》当前为「" + wantProject.status + "」，创意设定已锁定；请走剧本变更或新建 V2", "bad"); return; }
    const pool = D.projects.filter(p => ["草稿", "创意策划中"].indexOf(p.status) >= 0 && DB.derived.canViewProject(p));
    if (!pool.length) { App.toast("没有可填写创意设定的项目：请先在「新建项目」创建草稿项目", "bad"); return; }
    const preset = pool.some(p => p.id === want) ? want : pool[0].id;
    App.modal({
      title: "新建创意设定", sub: "提交后解析为结构化创意设定，并生成可比较的创意方案；不直接生成剧本",
      body: U.fSelect("项目", "project", pool.map(p => ({ value: p.id, label: p.id + " · " + p.name + "（" + p.status + "）" })), { required: true, value: preset }) +
        U.fSelect("输入方式", "mode", D.briefModes.map(m => m.mode), { required: true }) +
        U.fSelect("资料来源", "source", ["内部原创（无第三方素材）", "已登记授权的第三方资料", "未登记来源"], { required: true, hint: "未登记来源会在提交时被阻断" }) +
        U.fTextarea("创作意图", "content", { required: true, minlen: 40, rows: 6, placeholder: "题材、人物、核心冲突、受众、时长、风格与禁忌；至少 40 字" }),
      submitText: "提交并生成方案",
      validate(d) { if (d.source === "未登记来源") return { source: "资料来源未登记授权，不能进入生成" }; return {}; },
      onSubmit(d) {
        return App.job({
          title: "提交创意设定", sub: "文本预检 → 结构化解析 → 生成创意方案",
          steps: ["校验项目状态与权限", "执行敏感词与长度预检", "解析结构化创意设定", "生成可比较的创意方案"],
          run() {
            const a = DB.state.submitBrief(d.project, { text: d.content, mode: d.mode });
            if (!a.ok) return a;
            const b = DB.state.generatePlans(d.project);
            return b.ok ? { ok: true, msg: "创意设定已确认：" + a.data.id + "；已生成方案 " + b.data.id } : b;
          },
          after(out) { if (out && out.ok) App.go("creation/plan", { id: d.project }); }
        });
      }
    });
  });

  App.on("creation.deriveBrief", (el) => {
    if (!App.guard("creation.write")) return;
    const pid = (el && (el.dataset.pid || el.dataset.id)) || ((App.currentProject() || {}).id || "");
    const project = pid ? DB.state.prj(pid) : null;
    if (!project) { App.toast("当前项目不存在，无法派生创意设定", "bad"); return; }
    if (!DB.derived.canViewProject(project)) { App.toast("项目不在当前可见范围，未派生创意设定", "bad"); return; }
    if (["草稿", "创意策划中"].indexOf(project.status) < 0) { App.toast("《" + project.name + "》当前为「" + project.status + "」，创意设定已锁定；请走剧本变更或新建 V2", "bad"); return; }
    const b = D.briefs.find(x => x.project === pid);
    if (!b) { App.toast("当前没有可派生的创意设定", "bad"); return; }
    App.modal({
      title: "派生新 创意设定版本", sub: "版本不覆盖：新版本确认后，旧版本仍可回看；下游剧本需重新比对",
      body: U.fTextarea("补充 / 调整内容", "note", { required: true, minlen: 20, rows: 5, placeholder: "例如：第 6–9 集增加一次主动放弃的抉择" }) + U.fCheck("确认下游已生成内容仅标记需复核，不自动重跑", "mark", { checked: true }),
      submitText: "生成新版本",
      onSubmit(d) {
        return App.job({
          title: "派生 创意设定版本", steps: ["校验版本链", "写入新版本", "标记下游需复核"],
          run() {
            const n = Number(String(b.version).replace(/[^\d]/g, "")) + 1;
            const prefix = String(b.id).replace(/-\d+$/, "");
            const seq = Number(String(b.id).match(/-(\d+)$/) ? String(b.id).match(/-(\d+)$/)[1] : 0) + 1;
            const next = Object.assign({}, b, { id: prefix + "-" + String(seq).padStart(2, "0"), version: "v" + n, status: "已确认", note: d.note, by: String(App.identity().name).split(" · ")[0], at: DB.state.at() });
            b.status = "已被替代";
            D.briefs.unshift(next);
            const p = DB.state.prj(next.project);
            if (p) p.updated = next.at;
            DB.state.log("创意设定 " + next.id, "派生 v" + n + " 并确认，旧版 " + b.id + " 保留", "成功", next.id);
            D.shots.filter(s => s.project === next.project).forEach(s => { if (s.status === "已通过") s.status = "需复核"; });
            return { ok: true, msg: "已生成 " + next.id + " · v" + n + "，旧版本保留可回看；已生成镜头标记为需复核" };
          }
        });
      }
    });
  });

  App.on("creation.regenPlan", (el) => {
    if (!App.guard("creation.write")) return;
    const want = (el && (el.dataset.pid || el.dataset.id)) || ((App.currentProject() || {}).id || "");
    if (!want) { App.toast("缺少项目上下文，未执行；请从创意方案页进入", "bad"); return; }
    const p = DB.state.prj(want);
    if (!p) { App.toast("当前项目不存在，无法生成方案", "bad"); return; }
    if (!DB.derived.canViewProject(p)) { App.toast("项目不在当前可见范围，未生成方案", "bad"); return; }
    if (p.status !== "创意策划中") { App.toast(p.name + " 当前为「" + p.status + "」，不在创意策划阶段", "bad"); return; }
    App.job({
      title: "重新生成创意方案", sub: p.id + " · 旧方案保留，新方案追加到列表便于对比",
      steps: ["读取已确认创意设定", "提交文本模型", "解析为可比较方案", "写入方案列表"],
      run() { return DB.state.generatePlans(p.id); }
    });
  });

  App.on("creation.choosePlan", (el) => {
    if (!App.guard("creation.write")) return;
    const plan = D.creativePlans.find(x => x.id === el.dataset.id);
    if (!plan) return;
    if (plan.chosen) { App.toast("该方案已选定"); return; }
    const project = DB.state.prj(plan.project);
    if (!project) { App.toast("方案所属项目不存在", "bad"); return; }
    if (!DB.derived.canViewProject(project)) { App.toast("方案所属项目不在当前可见范围", "bad"); return; }
    if (project.status !== "创意策划中") { App.toast("《" + project.name + "》当前为「" + project.status + "」，不能重选方案", "bad"); return; }
    App.modal({
      title: "选定方案 · " + plan.title, sub: "选定后项目进入「剧本创作中」，其他方案保留但不再推进",
      body: U.desc([["方案", plan.id + " · " + plan.title], ["自检分", plan.score + " / 100"], ["主要风险", plan.risk]]) +
        U.fCheck("我确认已对比其他方案，并接受该风险", "confirm", { checked: false }),
      submitText: "选定该方案",
      validate(d) { if (!d.confirm) return { confirm: "需勾选确认后才能选定方案" }; return {}; },
      onSubmit(d) {
        return App.job({
          title: "选定创意方案", steps: ["校验项目状态", "写入选定关系", "推进项目状态"],
          run() { return DB.state.choosePlan(plan.id); },
          after(out) { if (out && out.ok) App.go("creation/script", { id: plan.project }); }
        });
      }
    });
  });

  App.on("creation.generateScript", (el) => {
    if (!App.guard("creation.write")) return;
    const want = (el && el.dataset.id) || ((App.currentProject() || {}).id || "");
    if (!want) { App.toast("缺少项目上下文，未生成剧本；请从项目流水线进入", "bad"); return; }
    const p = DB.state.prj(want);
    if (!p) { App.toast("没有处于「剧本创作中」且已选定方案的项目", "bad"); return; }
    if (!DB.derived.canViewProject(p)) { App.toast("项目不在当前可见范围，未生成剧本", "bad"); return; }
    if (p.status !== "剧本创作中") { App.toast(p.name + " 当前为「" + p.status + "」，不在剧本创作阶段", "bad"); return; }
    App.job({
      title: "生成候选剧本", sub: p.id + " · 以选定方案与创意设定版本为输入；生成后进入待剧本审核",
      steps: ["校验方案与创意设定版本", "提交推理模型", "生成分集结构", "自检并写入候选版本", "推进到待剧本审核"],
      run() { return DB.state.generateScript(p.id); },
      after(out) { if (out && out.ok) App.go("creation/review", { id: p.id }); }
    });
  });

  App.on("creation.submitReview", (el) => {
    if (!App.guard("script.review")) return;
    const sid = el && el.dataset ? el.dataset.id : "";
    const curPid = (App.currentProject() || {}).id || "";
    const s = sid ? D.scripts.find(x => x.id === sid) : D.scripts.find(x => x.project === curPid && x.status === "待审核");
    if (!s) { App.toast("当前项目没有待审核候选版本", "bad"); return; }
    const sp = DB.state.prj(s.project);
    if (!sp || !DB.derived.canViewProject(sp)) { App.toast("该剧本所属项目不在当前可见范围", "bad"); return; }
    App.confirm("提交剧本审核", "将 " + s.id + " 提交至项目负责人（节点 A）；审核期间下游保持阻塞。", () => {
      const p = DB.state.prj(s.project);
      if (p && p.status === "剧本创作中") DB.state.moveTo(p, "待剧本审核", "提交审核 " + s.id);
      DB.state.log("剧本 " + s.id, "提交人工审核", "成功", s.id);
      App.toast("已提交审核：" + s.id); App.go("creation/review", { id: s.project });
    }, "提交审核");
  });

  App.on("creation.approveScript", (el) => {
    if (!App.guard("script.review")) return;
    const sid = el && el.dataset ? el.dataset.id : "";
    const curPid = (App.currentProject() || {}).id || "";
    const s = sid ? D.scripts.find(x => x.id === sid) : D.scripts.find(x => x.project === curPid && x.status === "待审核");
    if (!s) { App.toast("当前项目没有待审核版本，无法执行节点 A 审核", "bad"); return; }
    const sp = DB.state.prj(s.project);
    if (!sp || !DB.derived.canViewProject(sp)) { App.toast("该剧本所属项目不在当前可见范围", "bad"); return; }
    if (s.status !== "待审核") { App.toast(s.id + " 当前为「" + s.status + "」，不可重复审核；如需修改请派生新版本", "bad"); return; }
    const p = DB.state.prj(s.project);
    if (!p || p.status !== "待剧本审核") { App.toast("项目当前为「" + (p ? p.status : "—") + "」，不在待剧本审核阶段", "bad"); return; }
    App.modal({
      title: "通过并锁定 · 剧本审核（节点 A）", sub: s.id + " 将成为下游唯一基准版本",
      body: U.fSelect("正式版本号", "version", [s.version + "（正式）", s.version + "（修订）"], { required: true }) +
        U.fField("审核覆盖位置", "positions", { value: "全 " + s.episodes + " 集" }) +
        U.fTextarea("审核依据", "note", { required: true, minlen: 10, rows: 4, placeholder: "逐项说明：故事方向、人物、结构、逻辑、对白、合规、版权" }) +
        U.notice("通过后项目自动进入「生产准备中」，镜头契约才可固化；本操作写入审核记录与审计。", "info"),
      submitText: "通过并锁定",
      onSubmit(d) {
        return App.job({
          title: "剧本审核 · 通过", steps: ["校验审核人权限", "写入审核结论", "锁定正式版本", "推进项目到生产准备中"],
          run() { return DB.state.approveScript(s.id, { version: d.version, note: d.note, positions: d.positions }); },
          after(out) { if (out && out.ok) App.go("projects/workflow", { id: s.project }); }
        });
      }
    });
  });

  App.on("creation.rejectScript", (el) => {
    if (!App.guard("script.review")) return;
    const sid = el && el.dataset ? el.dataset.id : "";
    const curPid = (App.currentProject() || {}).id || "";
    const s = sid ? D.scripts.find(x => x.id === sid) : D.scripts.find(x => x.project === curPid && x.status === "待审核");
    if (!s) { App.toast("当前项目没有待审核版本可退回", "bad"); return; }
    const sp = DB.state.prj(s.project);
    if (!sp || !DB.derived.canViewProject(sp)) { App.toast("该剧本所属项目不在当前可见范围", "bad"); return; }
    if (s.status !== "待审核") { App.toast(s.id + " 当前为「" + s.status + "」，不可退回", "bad"); return; }
    App.modal({
      title: "退回修改 · 剧本审核", sub: "必须指出位置与原因，否则视为无效审核",
      body: U.fField("退回位置", "positions", { required: true, minlen: 3, placeholder: "例如：E14 / S02 / 段 3（须定位到集 / 场 / 段）" }) +
        U.fSelect("退回原因类型", "reason", ["人物动机不足", "节奏问题", "逻辑漏洞", "对白质量", "内容合规", "其他"], { required: true }) +
        U.fTextarea("具体修改建议", "note", { required: true, minlen: 12, rows: 4, placeholder: "可执行的修改方向，不接受「再改改」" }) +
        U.notice("退回位置必须定位到集 / 场 / 段（业务方案 §6.3）；退回后项目回到「剧本创作中」，并自动创建修订任务。", "warn"),
      submitText: "退回",
      onSubmit(d) {
        return App.job({
          title: "剧本审核 · 退回", steps: ["校验退回信息完整性", "写入审核记录", "创建修订任务", "回退项目状态"],
          run() { return DB.state.rejectScript(s.id, { positions: d.positions, reason: d.reason, note: d.note }); }
        });
      }
    });
  });

  /* 终止项目（剧本审核结论之三，业务方案 §6.3 第 6 步） */
  App.on("creation.terminateScript", (el) => {
    if (!App.guard("script.review")) return;
    const sid = el && el.dataset ? el.dataset.id : "";
    const curPid = (App.currentProject() || {}).id || "";
    const s = sid ? D.scripts.find(x => x.id === sid) : D.scripts.find(x => x.project === curPid && x.status === "待审核");
    if (!s) { App.toast("当前项目没有待审核版本", "bad"); return; }
    const sp = DB.state.prj(s.project);
    if (!sp || !DB.derived.canViewProject(sp)) { App.toast("该剧本所属项目不在当前可见范围", "bad"); return; }
    if (s.status !== "待审核") { App.toast(s.id + " 当前为「" + s.status + "」，不可终止", "bad"); return; }
    App.modal({
      title: "终止项目 · " + sp.name, sub: "记录终止原因与确认人；取消尚未执行的下游计划，已产生记录与费用保留",
      body: U.fTextarea("终止原因", "reason", { required: true, minlen: 10, rows: 4, placeholder: "说明内容方向不可继续的原因" }) +
        U.fField("确认人", "who", { required: true, minlen: 2, value: App.role().name }) +
        U.notice("终止后项目进入「已终止」终态：不可回到进行中，只能复制为新项目重新立项。", "bad"),
      submitText: "确认终止项目",
      onSubmit(d) {
        return App.job({
          title: "剧本审核 · 终止项目", steps: ["记录终止原因与确认人", "写入审核记录", "取消未执行的下游计划"],
          run() {
            const r = DB.state.terminate(s.project, d.reason + "（确认人：" + d.who + "）");
            if (!r.ok) return r;
            D.reviews.unshift({ id: "RV-TERM-" + String(D.reviews.length + 1).padStart(4, "0"), project: s.project, node: "剧本审核（节点 A）", object: s.id, version: s.version, auditor: d.who, role: App.role().name, at: DB.state.at(), result: "终止项目", note: d.reason, positions: "全剧", tasks: "取消未执行的下游计划", follow: "项目已终止，记录保留" });
            s.status = "已废弃";
            return { ok: true, msg: "已终止项目并记录原因与确认人" };
          }
        });
      }
    });
  });

  /* 变更影响分析（业务方案 §6.4）：镜头级清单 */
  App.on("creation.impact", (el) => {
    const pid = (el && el.dataset && el.dataset.id) || (App.currentProject() || {}).id || "";
    const sp = DB.state.prj(pid);
    if (!sp || !DB.derived.canViewProject(sp)) { App.toast("项目不在可见范围", "bad"); return; }
    const script = D.scripts.find(x => x.project === pid && x.locked) || D.scripts.find(x => x.project === pid);
    const imp = DB.state.impactAnalysis(pid, script ? script.id : "");
    App.drawer("变更影响分析 · " + sp.name,
      U.desc([["目标版本", imp.newScriptId], ["受影响集", imp.affectedEps.length ? imp.affectedEps.map(e => "E" + e).join("、") : "无"], ["受影响镜头", imp.total + " 个"], ["处理原则", "仅创建受影响的重生产任务；未受影响的已验证资产保留"], ["统计口径", "返工量计入返工率，不计入新增生成量"]]) +
      U.card("八维度影响汇总", U.table(["维度", "数量", "处理口径"], imp.dims.map(d =>
        "<tr><td class=\"cell-strong\">" + U.esc(d.label) + '</td><td class="num">' + d.count + '</td><td class="cell-wrap muted">' + U.esc(d.note) + "</td></tr>").join("")), "影响分析必须覆盖人物 / 场景 / 对白 / 镜头 / 音频 / 时间线 / 任务 / 统计口径八个维度") +
      U.card("镜头级受影响清单", U.table(["镜头", "集", "场", "镜号", "当前状态", "依赖资产", "建议动作"], imp.shotList.map(r =>
        "<tr><td>" + U.code(r.id) + '</td><td class="num">E' + r.ep + '</td><td class="num">' + U.esc(r.scene) + '</td><td class="num">' + U.esc(r.no) + '</td><td>' + U.pill(r.status) + '</td><td class="cell-wrap muted">' + U.esc(r.deps) + '</td><td class="cell-wrap">' + U.esc(r.action) + "</td></tr>").join(""),
        "当前没有受影响的镜头：正式剧本换版未改变既有拆解结果"), "清单必须到镜头级，不能只给汇总计数"));
  });

  App.on("creation.lock", (el) => {
    if (!App.guard("script.review")) return;
    const s = D.scripts.find(x => x.id === el.dataset.id);
    if (!s) return;
    const sp = DB.state.prj(s.project);
    if (!sp || !DB.derived.canViewProject(sp)) { App.toast("该剧本所属项目不在当前可见范围", "bad"); return; }
    if (s.locked) { App.toast(s.id + " 已是锁定正式版本"); return; }
    App.modal({
      title: "锁定正式版本 · " + s.id, sub: "锁定即成为下游唯一基准；后续修改必须新建版本并重新审核",
      body: U.fTextarea("锁定依据", "note", { required: true, minlen: 10, rows: 4 }) +
        U.notice("锁定后该版本状态变为「已通过 · 正式版本」，其他候选版本标记为已废弃。", "info"),
      submitText: "锁定",
      onSubmit(d) {
        return App.job({ title: "锁定剧本版本", steps: ["校验版本状态", "写入锁定标记", "废弃其他候选", "写审计"], run() { return DB.state.approveScript(s.id, { note: d.note, positions: "全剧" }); } });
      }
    });
  });

  App.on("creation.editScript", (el) => {
    if (!App.guard("creation.write")) return;
    const sid = el && el.dataset ? el.dataset.id : "";
    if (!sid) { App.toast("缺少剧本版本标识，未进入编辑", "bad"); return; }
    const cur = D.scripts.find(x => x.id === sid);
    if (!cur) { App.toast("剧本版本不存在或已不可见", "bad"); return; }
    const p0 = DB.state.prj(cur.project);
    if (!p0 || !DB.derived.canViewProject(p0)) { App.toast("剧本所属项目不在当前可见范围", "bad"); return; }
    if (cur.locked && p0 && ["剧本创作中", "待剧本审核"].indexOf(p0.status) < 0) {
      App.toast("项目已进入「" + p0.status + "」，锁定版本不能直接派生；请从剧本审核页发起局部修改，走变更评估", "bad");
      return;
    }
    App.modal({
      title: "编辑剧本 · 生成新版本", sub: "不覆盖已锁定版本；保存后产生候选版本并需重新审核",
      body: U.fSelect("编辑范围", "scope", ["单场", "单集", "全剧"], { required: true }) +
        U.fField("定位", "locate", { required: true, minlen: 3, placeholder: "例如：E14 / S02" }) +
        U.fTextarea("修改内容", "text", { required: true, minlen: 30, rows: 5, placeholder: "直接写入要替换的正文，至少 30 字" }) +
        U.fTextarea("修改原因", "why", { required: true, minlen: 8, rows: 2 }),
      submitText: "保存为候选版本",
      onSubmit(d) {
        return App.job({
          title: "保存剧本新版本", steps: ["校验定位与范围", "写入新候选版本", "重算规模统计", "提交审核提醒"],
          run() {
            const n = Number(String(cur.version).replace("v", "")) + 1;
            const id = cur.id.replace(/-V\d+$/, "-V" + n);
            const s = { id: id, project: cur.project, version: "v" + n, status: "待审核", episodes: cur.episodes, scenes: cur.scenes + (d.scope === "单场" ? 1 : 0), shots: cur.shots, lines: cur.lines + 4, by: DB.state.actor(), at: DB.state.at(), note: "编辑 " + d.locate + "：" + d.text.slice(0, 30), locked: false };
            D.scripts.unshift(s);
            const p = DB.state.prj(cur.project);
            if (p && p.status === "剧本创作中") DB.state.moveTo(p, "待剧本审核", "编辑产生候选版本 " + id);
            p.scriptVersion = id + "（候选）";
            DB.state.log("剧本 " + id, "编辑并生成候选版本", "成功", id);
            DB.state.notify({ type: "待剧本审核", project: cur.project, title: id + " 候选版本待审核", reason: d.why, impact: "审核通过前下游保持阻塞", action: "执行节点 A 审核", owner: p ? p.owner : DB.state.actor(), link: "creation/review" });
            return { ok: true, msg: "已生成候选版本 " + id + "，需重新审核" };
          },
          after(out) { if (out && out.ok) App.go("creation/review", { id: cur.project }); }
        });
      }
    });
  });

  App.on("creation.partialScript", (el) => {
    if (!App.guard("script.review")) return;
    const sid = el && el.dataset ? el.dataset.id : "";
    const curPid = (App.currentProject() || {}).id || "";
    const cur = sid ? D.scripts.find(x => x.id === sid) : D.scripts.find(x => x.project === curPid && (x.locked || x.status === "已锁定"));
    if (!cur) { App.toast("当前项目没有可修改的正式剧本版本", "bad"); return; }
    const p = DB.state.prj(cur.project);
    if (!p) { App.toast("剧本所属项目不存在", "bad"); return; }
    if (!DB.derived.canViewProject(p)) { App.toast("剧本所属项目不在当前可见范围", "bad"); return; }
    if (["已交付", "已归档", "已终止"].indexOf(p.status) >= 0) {
      App.toast("项目已" + p.status + "，修改必须新建 V2，不能改动冻结版本", "bad");
      return;
    }
    App.modal({
      title: "指定位置局部修改 · " + cur.id, sub: "只改指定集 / 场，不重跑整本剧本；受影响镜头标记为需复核",
      body: U.fField("修改范围", "range", { required: true, minlen: 3, placeholder: "例如：E14 / S02" }) +
        U.fTextarea("修改要求", "note", { required: true, minlen: 10, rows: 3 }) +
        U.fCheck("保留下游已生成内容（仅标记需复核）", "keep", { checked: true }),
      submitText: "创建局部修改",
      validate(d) {
        if (!/E\s*\d{1,2}/.test(d.range || "")) return { range: "范围必须包含集号，例如 E14 / S02" };
        return {};
      },
      onSubmit(d) {
        return App.job({
          title: "创建局部修改任务", steps: ["解析目标范围", "创建修订任务", "标记受影响对象"],
          run() {
            const epMatch = /E\s*(\d{1,2})/.exec(d.range);
            const ep = epMatch ? Number(epMatch[1]) : 0;
            if (!ep || ep < 1 || ep > (p.episodes || 24)) return { ok: false, msg: "集号超出项目范围（1–" + (p.episodes || 24) + "）", fields: { range: "请输入项目内的集号" } };
            const affected = D.shots.filter(s => s.project === cur.project && s.ep === ep && s.status === "已通过");
            if (!affected.length) return { ok: false, msg: "第 " + ep + " 集当前没有已通过镜头需要标记复核；可直接派生新版本", fields: { range: "该集无已通过镜头" } };
            if (!d.keep) return { ok: false, msg: "当前版本下必须保留下游内容并标记复核，待修订稿审核通过后再重新生成", fields: { keep: "必须保留并标记复核" } };
            const t = { id: "T-" + (8800 + D.tasks.length), project: cur.project, ep: ep, scene: "—", shot: "—", kind: "剧本局部修订", stage: "创意与剧本", status: "待执行", priority: "高", deps: [], parallelGroup: "SCR", input: d.range, output: "局部修订稿", model: "推理模型 R1", config: "PRV-05", executor: DB.state.actor(), resourceOwner: DB.state.actor(), attempt: 0, maxAttempts: 3, est: 3, actual: 0, failedCost: 0, submitAt: "—", failReason: "—", qc: "—" };
            D.tasks.unshift(t);
            affected.forEach(s => { s.status = "需复核"; s.version = "上游剧本局部修改待复核"; });
            const e = D.episodes.find(x => x.project === cur.project && x.no === ep);
            if (e) { e.qc = "进行中"; e.status = "剧本修订待复核"; }
            D.timelines.filter(tl => tl.project === cur.project && tl.ep === ep).forEach(tl => { tl.stale = (tl.stale || 0) + 1; tl.status = "标脏"; });
            DB.state.log("剧本 " + cur.id, "局部修改：" + d.range + "，受影响镜头 " + affected.length + " 个", "成功", t.id);
            return { ok: true, msg: "已创建局部修改任务 " + t.id + "，标记 " + affected.length + " 个受影响镜头为需复核" };
          }
        });
      }
    });
  });

  App.on("creation.rerunBreakdown", (el) => {
    if (!App.guard("creation.write")) return;
    const picked = el && el.dataset.id ? DB.state.prj(el.dataset.id) : App.currentProject();
    const p = picked;
    if (!p) { App.toast("缺少项目上下文，未重新拆解；请从项目流水线进入", "bad"); return; }
    if (!DB.derived.canViewProject(p)) { App.toast("项目不在当前可见范围，未重新拆解", "bad"); return; }
    App.confirm("重新拆解 " + p.name, "将基于锁定版本重建对象；已生成的镜头与资产不会被删除，但会重新校验引用。", () => {
      App.job({
        title: "重新拆解剧本", sub: p.id + " · 基于锁定版本重建集 / 场 / 人物 / 场景 / 道具 / 镜头对象",
        steps: ["读取锁定剧本", "重建结构化对象", "校验引用完整性", "生成镜头契约草案"],
        run() { return DB.state.breakdown(p.id); },
        after(out) { if (out && out.ok) App.go("creation/breakdown", { id: p.id }); }
      });
    }, "重新拆解");
  });
})();


