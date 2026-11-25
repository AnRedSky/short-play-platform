/* 模块：post 后期、终审与交付（员工工作台） */
(function () {
  const U = UI, D = DB, SCOPE = "post";
  const epOf = (p) => D.episodes.filter(e => e.project === p);
  const pct = (p) => D.derived.progressOf(p).pct;
  const frozenOf = (pid) => {
    const p = D.projects.find(x => x.id === pid);
    return p && ["已交付", "已归档"].indexOf(p.status) >= 0 ? p : null;
  };

  /* ---------- 作品（原 post/works，B2·M2 并入交付包的「作品」tab） ----------
     作品是交付后的外部形态：与交付包绑定、版本冻结，后续改动一律走新版本链。
     作品清单、状态口径、交付摘要、新版本链规则全部按单一项目投影。 */
  const worksBlock = (p) => {
    const works = D.works.filter(w => w.project === p.id);
    const rows = works.map(w =>
      '<tr><td>' + U.entity(w.name, w.project, "▣") + "</td><td>" + U.pill(w.status) + '</td><td class="num">' + U.esc(w.episodes) + "</td><td>" + U.esc(w.duration) + "</td><td>" + U.esc(w.delivered) + "</td><td>" + U.esc(w.version) + '</td><td class="cell-wrap muted">' + U.esc(w.next) + "</td><td>" +
      U.btn("版本链", "post.versionChain", "sm", { p: w.project }) + " " + U.btn("详情", "post.workDetail", "sm", { p: w.project }) + (w.status === "已交付" && App.can("project.create") ? " " + U.btn("新建 V2", "post.newVersion", "sm", { id: w.project }) : "") + "</td></tr>").join("");
    const dps = D.deliveries.filter(x => x.project === p.id).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const dp = dps[0];
    const rv = D.reviews.filter(r => r.project === p.id).slice(-1)[0];
    return U.card("作品清单 · " + U.esc(p.name), U.table(["作品", "状态", "集数", "时长", "交付日", "版本", "后续", "操作"], rows, "当前项目还没有已登记的作品"), "仅显示所选项目的作品") +
      '<div class="split mt-4"><div class="stack">' +
        U.card("作品状态口径", U.table(["状态", "含义", "可做操作"], [
          ["制作中", "生产未完成", "推进生产"],
          ["已交付", "已生成交付包", "可新建版本"],
          ["返工中", "指定镜头返工", "只处理返工项"],
          ["已归档", "长期只读", "只读可查"]
        ].map(r => '<tr><td class="cell-strong">' + r[0] + '</td><td class="cell-wrap">' + r[1] + '</td><td class="cell-wrap muted">' + r[2] + "</td></tr>").join("")), "状态由系统推进，人工不可直接改") +
        U.card("交付后可发生的变更", U.listRows([["新版本", "新建 V2，不覆盖 V1"], ["补交付", "追加文件进新版本链"], ["下线", "只改状态，不删文件"], ["撤回", "需审计留痕"]]) , "不允许原地修改已交付文件") +
      '</div><div class="stack">' +
        U.card("交付摘要 · " + U.esc(p.name), dp ? U.desc([["项目", dp.project + " " + p.name], ["交付包", dp.id + " " + dp.version], ["集数", dp.episodes + " / " + (p.episodes || "—")], ["交付时间", dp.at], ["审核人", dp.reviewer], ["校验", dp.checksum], ["状态", dp.status + (dp.frozen ? " · 冻结" : "")]]) : U.empty("尚无交付包", "当前项目还没有生成交付包；交付摘要会在确认接收后写入。"), dp ? "交付摘要不随新版本改变" : "交付后生成") +
        U.card("新版本链规则", U.notice(dp ? "交付后如出现新素材或新集次，必须新建版本链并在作品详情标注差异；不得覆盖历史交付包。" : "交付包生成并确认后，作品才进入交付状态；历史版本永久可查。", "info")) +
        U.card("最近审核", rv ? U.desc([["记录", rv.id], ["项目", rv.project], ["对象", rv.object], ["结论", rv.result], ["审核人", rv.auditor], ["时间", rv.at]]) : U.notice("当前项目还没有成片审核记录。", "warn"), "审核记录来自真实项目") +
      "</div></div>";
  };

  AppModule.register({
    group: "post", label: "后期与剪辑", icon: "scissors", order: 7, end: "workspace",
    routes: [
      {
        path: "post/timeline", title: "时间线与剪辑", icon: "scissors", permission: "post.write",
        desc: "时间线以集为单位：镜头片段、对白、音乐、音效、字幕、特效分轨排布，任何上游版本变更都会标脏。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.projectGuard("后期与剪辑 / 时间线与剪辑", "时间线与剪辑以集为单位绑定项目；未选择项目时不会展示其他项目的轨道或标脏记录。");
          const pid = p.id;
          const tls = D.timelines.filter(t => t.project === pid);
          const requested = Number((query && query.ep) || App.get(SCOPE, "ep", 17));
          const cur = tls.some(t => t.ep === requested) ? requested : (tls[0] ? tls[0].ep : 1);
          const tl = D.timelines.find(t => t.project === pid && t.ep === Number(cur));
          const rows = tls.sort((a, b) => a.ep - b.ep).map(t =>
            '<tr><td>' + U.esc(t.project) + '</td><td class="num">E' + t.ep + "</td><td>" + U.code(t.version) + '</td><td class="num">' + t.tracks + " 轨 / " + t.clips + " 段</td><td>" + U.esc(t.duration) + '</td><td class="cell-wrap muted">' + U.esc(t.timebase) + "</td><td>" + (t.stale ? U.pill("标脏 " + t.stale + " 段", "warn") : U.pill("无标脏", "ok")) + "</td><td>" + U.pill(t.status) + "</td><td>" +
            U.btn("打开", "post.openTimeline", "sm", { ep: t.ep, pid: pid }) + "</td></tr>").join("");
          const epShots = D.shots.filter(s => s.project === pid && s.ep === Number(cur)).sort((a, b) => a.order - b.order);
          const secOf = s => Number(String(s.duration || "").replace(/[^\d.]/g, "")) || 4;
          const dialogueShots = epShots.filter(s => String(s.line || "—") !== "—");
          const sfxShots = epShots.filter(s => String(s.voice || "—") !== "—").slice(0, 8);
          const trackHtml = [
            { name: "视频轨", tone: "accent", items: epShots.slice(0, 18).map(s => ({ label: s.no, w: secOf(s) })) },
            { name: "对白轨", tone: "ok", items: dialogueShots.slice(0, 10).map(s => ({ label: "DL-" + String(s.no).replace("SH-", ""), w: secOf(s) + 2 })) },
            { name: "音乐轨", tone: "info", items: [{ label: "BGM-E" + cur + " · 主段", w: 58 }, { label: "BGM-E" + cur + "b · 尾段", w: 22 }] },
            { name: "音效轨", tone: "warn", items: sfxShots.map(s => ({ label: String(s.voice).slice(0, 12), w: secOf(s) })) },
            { name: "字幕轨", tone: "muted", items: [{ label: "SUB-E" + cur + " v1", w: 86 }] },
            { name: "特效轨", tone: "muted", items: [{ label: "跨场雨雾叠加", w: 28 }, { label: "闪白", w: 6 }] }
          ].map(t =>
            '<div class="track-row"><span class="track-name">' + U.esc(t.name) + '</span><span class="track-lane">' +
            (t.items.length ? t.items.map(it => '<span class="clip ' + U.esc(t.tone || "") + '" style="flex:' + Math.max(4, Number(it.w) || 4) + '" title="' + U.esc(it.label) + '">' + U.esc(it.label) + "</span>").join("") : '<span class="muted small">本集无片段</span>') +
            "</span></div>").join("");
          const canEdit = ["生产中", "制作中", "视频生产中", "后期制作中"].indexOf(p.status) >= 0;
          return U.page("后期与剪辑 / 时间线与剪辑", "时间线与剪辑", "剪辑只能消费已通过质检的镜头；未通过质检的镜头不得直接入轨以免返工扩散。",
            (canEdit ? U.btn("新建集时间线", "post.newTimeline", "primary", { pid: pid, ep: cur }) + U.btn("输出成片", "post.exportTimeline", "", { pid: pid, ep: cur }) : "") + U.btn("去分集成片", "post.toEpisodes", canEdit ? "" : "primary", { id: pid }),
            U.card("时间线清单", U.table(["项目", "集", "版本", "轨 / 段", "时长", "时基", "标脏", "状态", "操作"], rows), "按集分列，标脏片段会在输出前阻断") +
            '<div class="split mt-4"><div class="stack-wide">' +
              U.card("E" + cur + " 时间线 · " + (tl ? tl.version : "未创建"), trackHtml +
                (tl && tl.stale ? U.notice("有 " + tl.stale + " 段片段被上游版本标脏：需替换片段后重新输出，否则成片与镜头库不一致。", "warn") : ""),
                "轨内时长按 PTS 对齐，不按秒取整") +
              U.card("剪辑要点", U.listRows([["入轨门禁", "镜头质量 PASS 才可入轨"], ["钩子前置", "前 3 秒必须出现冲突或悬念"], ["节奏", "单集 90±5 秒，无超过 3 秒的空镜"], ["转场", "同场景用硬切，跨场用雨雾 / 闪白特效"], ["字幕", "与时间线同版本，不单独替换"]]), "剪辑决策写入版本记录") +
            '</div><div class="stack">' +
              U.card("时间线结构", U.donut([
                { label: "视频轨", value: epShots.length || 1, color: "var(--accent)" },
                { label: "对白轨", value: epShots.filter(s => s.dialogue).length, color: "var(--ok)" },
                { label: "音乐轨", value: tl ? 2 : 0, color: "var(--info)" },
                { label: "音效轨", value: epShots.filter(s => s.sfx || s.sound).length, color: "var(--warn)" }
              ], "镜头", epShots.length + " 镜"), "按当前集镜头类型统计") +
              U.card("标脏片段", U.table(["片段", "原因", "处理"], (tl && tl.stale ? [["当前集片段", "上游镜头新版本未采用", "替换后重出"]] : []).map(r => "<tr><td>" + U.code(r[0]) + '</td><td class="cell-wrap">' + r[1] + '</td><td class="cell-wrap muted">' + r[2] + "</td></tr>").join(""), "无标脏片段")) +
              U.card("输出规格", U.desc([["画幅", "1080×1920 · 9:16"], ["编码", "H.264 · 8 Mbps"], ["音频", "AAC 48k · 立体声"], ["时基", "PTS + 1/25"], ["命名", pid + "_E" + cur + "_V" + (tl ? String(tl.version).match(/V(\d+)/)?.[1] || "1" : "1") + ".mp4"]]) , "输出即冻结该版本，不覆盖") +
            "</div></div>"
          );
        }
      },
      {
        path: "post/episodes", title: "分集成片", icon: "film", permission: "post.write",
        desc: "分集成片是最终审核的最小单位：每集独立质检、独立审核结论，整剧集数齐备才允许生成交付包。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.projectGuard("后期与剪辑 / 分集成片", "分集成片按项目统计集数完成度；未选择项目时不会把其他项目的集数当成当前进度。");
          const pid = p.id;
          const wf = DB.derived.workflow(p);
          const rightsItem = wf.gateDelivery.items.find(i => i.key === "rights");
          const eps = wf.eps;
          const producing = eps.filter(e => ["生产中", "视频已齐 · 待后期"].indexOf(e.status) >= 0).length;
          const waiting = eps.filter(e => ["待生产", "未开始"].indexOf(e.status) >= 0 || e.qc === "未开始").length;
          const delivered = eps.filter(e => ["已交付", "已归档", "成片已输出"].indexOf(e.status) >= 0).length;
          const rows = eps.map(e =>
            '<tr><td class="num">E' + String(e.no).padStart(2, "0") + '</td><td class="cell-strong">' + U.esc(e.title) + '</td><td class="num">' + e.scenes + '</td><td class="num">' + e.shots + "</td><td>" + U.esc(e.duration) + "</td><td>" + U.pill(e.qc) + "</td><td>" + U.pill(e.status) + "</td><td>" +
            U.btn("镜头与报告", "projects.wfEpDetail", "sm", { pid: p.id, ep: e.no }) + "</td></tr>").join("");
          return U.page("后期与剪辑 / 分集成片", "分集成片", "整剧交付前每一集都要有质检结论；缺一集即视为集数不完整。",
            U.btn("打开制作流水线", "projects.wfOpen", "primary", { pid: p.id }) + U.btn("进入终审", "post.toReview", "", { id: p.id }),
            '<div class="grid grid-4">' +
              U.metric("目标集数", String(p.episodes), U.esc(p.duration), "▤") +
              U.metric("已通过", String(wf.passEps.length), "含整集质检 PASS", "✓") +
              U.metric("后期中", String(producing), "视频已齐 / 字幕合成", "◐") +
              U.metric("待生产", String(waiting), "尚未生成镜头", "○") +
            "</div>" +
            U.card("分集成片 · " + U.esc(p.name), U.table(["集", "标题", "场", "镜头", "时长", "质检", "状态", "操作"], rows), "分集是终审与交付的最小单位") +
            '<div class="split mt-4"><div class="stack">' +
              U.card("分集完成度", U.progress(wf.pct, wf.passEps.length + " / " + p.episodes + " 集通过 · " + wf.pct + "%", wf.pct >= 85 ? "warn" : "") +
                U.listRows([["已交付", delivered + " 集"], ["可交付（质检通过）", wf.passEps.length + " 集"], ["不可交付", (p.episodes - wf.passEps.length) + " 集"]]) , "集数未齐不允许生成整剧交付包") +
              U.card("成片输出规格", U.desc([["分辨率", p.ratio], ["帧率", "25 fps"], ["单集时长", p.duration], ["字幕", "硬字幕 + 独立 SRT"], ["命名", p.id + "_E01_V1"]]) , "输出后写入成片资产") +
            '</div><div class="stack">' +
              U.card("分集质检结论", U.table(["集", "结论", "不通过项"], eps.slice(-8).map(e => {
                const rep = D.qualityReports.find(r => String(r.object).indexOf(p.id + " / 第 " + e.no + " ") >= 0);
                return ["E" + String(e.no).padStart(2, "0"), e.qc, rep ? (rep.note || "—") : "尚无整集报告"];
              }).map(r => "<tr><td>" + U.code(r[0]) + "</td><td>" + U.pill(r[1]) + '</td><td class="cell-wrap muted">' + U.esc(r[2]) + "</td></tr>").join(""), "尚无质检结论")) +
              U.card("整剧打包条件", U.listRows([["集数完整", eps.length + " / " + p.episodes], ["全部 PASS", wf.passEps.length + " 集"], ["字幕与时间线一致", wf.stale ? "标脏 " + wf.stale : "无标脏"], ["授权齐备", rightsItem && rightsItem.ok ? "已齐备" : "存在阻断"]]) , "任一不满足即不允许生成交付包") +
            "</div></div>"
          );
        }
      },
      {
        path: "post/review", title: "最终成片审核", icon: "check", permission: "final.review",
        group: "delivery", groupLabel: "审核与交付", groupOrder: 8.5, groupIcon: "check",
        desc: "节点 B 是唯一的人工成片审核：可整剧通过，也可指定镜头返工，不允许「整剧重做」式的粗放结论。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.projectGuard("审核与交付 / 最终成片审核", "终审必须绑定项目与全剧质检结果；未选择项目时不会显示其他项目的审核记录。");
          const pid = p.id;
          const wf = DB.derived.workflow(p);
          const list = D.reviews.filter(r => r.project === p.id && r.node.indexOf("成片") >= 0);
          const rows = list.map(r =>
            '<tr><td>' + U.code(r.id) + '<div class="faint small">' + U.esc(r.project) + "</div></td><td>" + U.esc(r.object) + '</td><td class="cell-wrap">' + U.esc(r.note) + "</td><td>" + U.esc(r.auditor) + "</td><td>" + U.esc(r.at) + "</td><td>" + U.pill(r.result) + '</td><td class="cell-wrap muted">' + U.esc(r.follow) + "</td><td>" +
            U.btn("详情", "post.reviewDetail", "sm", { id: r.id }) + "</td></tr>").join("");
          const chk = D.reviewChecklist[1];
          const passed = list.filter(r => String(r.result).indexOf("通过") >= 0).length;
          const rework = list.filter(r => String(r.result).indexOf("返工") >= 0).length;
          const auditors = [...new Set(list.map(r => r.auditor))];
          const blockers = wf.gateDelivery.items.filter(i => !i.ok);
          const canFinal = p.status === "待最终审核";
          return U.page("审核与交付 / 最终成片审核", "最终成片审核", "审核基于「集」与「镜头」定位问题，不写主观整体评价；结论直接决定返工范围。",
            U.btn(canFinal ? "进入终审" : "打开制作流水线", canFinal ? "projects.wfFinal" : "projects.wfOpen", "primary", { pid: p.id }) + U.btn("审核记录", "post.reviewHistory", "", { pid: p.id }),
            '<div class="grid grid-4">' +
              U.metric("待审核", canFinal ? "1 项" : "0 项", canFinal ? "质检已完成，等待终审" : "当前状态「" + p.status + "」", "▤") +
              U.metric("已通过", String(passed), "当前项目审核记录", "✓") +
              U.metric("指定返工", String(rework), "返工记录", "!") +
              U.metric("审核人", String(auditors.length), "参与过本项目审核", "人") +
            "</div>" +
            U.card("成片审核记录 · " + U.esc(p.name), U.table(["记录", "对象", "结论说明", "审核人", "时间", "结论", "后续", "操作"], rows, "当前项目还没有成片审核记录")) +
            '<div class="split mt-4"><div class="stack">' +
              U.card("审核清单（节点 B · 10 项）", U.table(["审核项", "判定要点", "不通过处理"], chk.items.map(it => [it, "按集 / 镜头取证", "定位到具体集或镜头"]).map(r => '<tr><td class="cell-strong">' + r[0] + '</td><td class="cell-wrap muted">' + r[1] + '</td><td class="cell-wrap muted">' + r[2] + "</td></tr>").join("")), "清单项不允许跳过") +
              U.card("审核结论口径（业务方案 §16.3 · 四种结论）", U.table(["结论", "后续动作"], [
                ["通过交付", "进入交付流程，生成交付包"],
                ["指定镜头 / 片段返工", "建立局部返工任务，仅重做指定内容"],
                ["退回后期", "回到后期制作，重做时间线或合成"],
                ["终止交付", "记录原因，取消交付，保留全部记录"]
              ].map(r => '<tr><td class="cell-strong">' + r[0] + '</td><td class="cell-wrap muted">' + r[1] + "</td></tr>").join("")), "不存在「差不多通过」；任何未解决项都必须落到具体集次与镜头") +
            '</div><div class="stack">' +
              U.card("当前审核对象 · " + U.esc(p.name), U.desc([["项目", p.id + " " + p.name], ["范围", wf.passEps.length + " / " + p.episodes + " 集质检通过"], ["时间线", wf.timelines.length ? wf.timelines.map(t => t.version).slice(-1)[0] : "尚未创建"], ["质检", wf.passEps.length + " 集 PASS"], ["阻断项", blockers.length ? blockers.map(i => i.label).join("、") : "无"], ["升级规则", "4 小时未处理自动升级至部门管理员"]]) +
                '<div class="btn-row-inline">' + U.btn(canFinal ? "去终审" : "去流水线", canFinal ? "projects.wfFinal" : "projects.wfOpen", "primary", { pid: p.id }) + (["后期制作中", "质量检测中", "待最终审核"].indexOf(p.status) >= 0 ? U.btn("指定返工", "projects.wfQuality", "", { pid: p.id }) : "") + "</div>", "审核动作在制作流水线执行") +
              U.card("判定维度", U.listRows([["剧情完整", "单集有起承转合"], ["人物一致", "与档案一致"], ["画面", "无崩坏 / 无错位"], ["音频", "音量与口型达标"], ["字幕", "无错字、无重叠"], ["合规", "无敏感元素"]]) , "不通过必须有取证") +
            "</div></div>"
          );
        }
      },
      {
        path: "post/delivery", title: "交付包", icon: "archive", permission: ["delivery.read", "delivery.execute"],
        group: "delivery", groupLabel: "审核与交付", groupOrder: 8.5, groupIcon: "check",
        desc: "交付包是冻结产物：9 类内容逐项核验、附校验摘要，生成后不接受修改，只能新建下一版本。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.projectGuard("审核与交付 / 交付包", "交付包与项目版本一一对应；未选择项目时不允许生成或确认任何交付冻结版本。");
          const pid = p.id;
          const wf = DB.derived.workflow(p);
          const list = D.deliveries.filter(x => x.project === p.id);
          const rows = list.map(x =>
            '<tr><td>' + U.code(x.id) + "</td><td>" + U.esc(x.project) + "</td><td>" + U.esc(x.version) + '</td><td class="num">' + x.episodes + '</td><td class="num">' + x.files + "</td><td>" + U.esc(x.size) + '</td><td class="cell-wrap">' + U.esc(x.checksum) + "</td><td>" + U.esc(x.reviewer) + "</td><td>" + U.esc(x.at) + "</td><td>" + U.pill(x.status) + "</td><td>" +
            U.btn("交付清单", "post.deliveryDetail", "sm", { id: x.id }) + "</td></tr>").join("");
          const dp = list.slice(-1)[0];
          const rightsOk = (wf.gateDelivery.items.find(i => i.key === "rights") || {}).ok;
          const allReady = (dp && dp.status === "已交付") || (wf.passEps.length === p.episodes && wf.gateDelivery.ok);
          const chk = D.deliveryChecklist.map(c => {
            const st = allReady ? "已就绪" : (c.item.indexOf("授权") >= 0 ? (rightsOk ? "已就绪" : "缺失") : "待补");
            return "<tr><td class=\"cell-strong\">" + U.esc(c.item) + "</td><td>" + (c.required ? U.pill("必需", "accent") : U.pill("可选", "outline")) + "</td><td>" + U.pill(st) + "</td></tr>";
          }).join("");
          const blockers = wf.gateDelivery.items.filter(i => !i.ok);
          const delivered = list.filter(x => x.status === "已交付").length;
          const pending = list.filter(x => x.status === "待核验" || x.status === "待确认").length;
          const noteText = blockers.length
            ? null
            : (dp && dp.status === "已交付")
              ? "本项目交付包 " + dp.id + " 已交付并冻结；如需变更，请新建版本链，不得覆盖历史包。"
              : wf.gateDelivery.ok
                ? "当前项目交付门禁已满足，可按流程生成交付包。"
                : "当前项目交付门禁未满足，暂不可生成交付包。";
          const cta = !App.can("delivery.execute")
            ? U.btn("返回项目列表", "common.projects") + '<span class="faint small" style="margin-left:8px">当前身份只读：交付记录可查，生成/确认需交付执行权限</span>'
            : p.status === "已完成"
            ? (dp && ["待确认", "待核验"].indexOf(dp.status) >= 0
              ? U.btn("确认交付并冻结", "projects.wfDelivery", "primary", { pid: p.id })
              : wf.gateDelivery.ok
                ? U.btn("生成交付包", "projects.wfDelivery", "primary", { pid: p.id })
                : U.btn("处理交付阻断", "projects.wfRights", "primary", { pid: p.id }))
            : p.status === "待最终审核"
              ? U.btn("进入终审", "projects.wfFinal", "primary", { pid: p.id })
              : U.btn("打开制作流水线", "projects.wfOpen", "primary", { pid: p.id });
          const tab = App.get(SCOPE, "tab", "delivery");
          const tabsBar = U.card("", U.tabs([
            { value: "delivery", label: "交付包", count: list.length },
            { value: "works", label: "作品", count: D.works.filter(w => w.project === p.id).length }
          ], tab, "post.tab"));
          return U.page("审核与交付 / 交付包", "交付包", "生成交付包是流程终点：集数不齐、授权不齐、质检未过一律不允许生成。",
            cta,
            tabsBar + (tab === "works" ? worksBlock(p) : '<div class="grid grid-4">' +
              U.metric("已交付", String(delivered), U.esc(p.name), "✓") +
              U.metric("待核验", String(pending), "确认后冻结", "○") +
              U.metric("交付内容项", D.deliveryChecklist.length + " 类", "按清单逐项核验", "▤") +
              U.metric("阻断项", String(blockers.length), blockers.length ? blockers.map(i => i.label).join("、") : "无阻断", "!") +
            "</div>" +
            '<div class="split"><div class="stack-wide">' +
              U.card("交付包清单 · " + U.esc(p.name), U.table(["交付包", "项目", "版本", "集数", "文件", "体积", "校验", "审核人", "时间", "状态", "操作"], rows, "当前项目还没有生成交付包")) +
              U.card("交付内容模板（9 类）", U.table(["内容项", "要求", "状态"], chk), "具体项目按清单逐项核验") +
            '</div><div class="stack">' +
              U.card("生成前检查", U.listRows([
                ["集数完整", wf.passEps.length + " / " + p.episodes + " 集通过质检"],
                ["全部集 PASS", wf.passEps.length === p.episodes ? "已完成" : "未完成"],
                ["字幕与时间线一致", wf.subs.filter(s => s.status === "已通过").length + " / " + p.episodes + " 集字幕通过"],
                ["授权齐备", (wf.gateDelivery.items.find(i => i.key === "rights") || {}).ok ? "已齐备" : "存在阻断"],
                ["交付门禁", wf.gateDelivery.ok ? "可生成" : "未满足"]
              ]), "不允许绕过阻断项") +
              U.notice("交付口径：阻断项不进交付包；交付包生成即冻结，补交付只进新版本链（§R-28 / §R-29）。", "info") +
            "</div></div>")
          );
        }
      },
      {
        path: "post/versions", title: "版本链", icon: "chain", permission: "post.write",
        desc: "从剧本到交付，每个对象都保留版本链：版本不覆盖、可追溯来源、可回指引用。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.projectGuard("后期与剪辑 / 版本链", "版本链只沿当前项目回溯；未选择项目时不会显示其他项目的剧本、时间线与交付版本。");
          const pid = p.id;
          const wf = DB.derived.workflow(p);
          const script = D.scripts.find(s => s.project === p.id && s.locked);
          const tl = wf.timelines.slice(-1)[0];
          const dp = D.deliveries.filter(x => x.project === p.id).slice(-1)[0];
          const sub = wf.subs.slice(-1)[0];
          const chain = U.chain([
            { label: script ? script.id : "剧本未锁定", meta: script ? "已锁定" : "待审核", state: script ? "done" : "now" },
            { label: "分集大纲", meta: wf.eps.length + " 集", state: wf.eps.length ? "done" : "" },
            { label: "镜头库", meta: wf.shots.length + " 镜头", state: wf.shots.length ? "done" : "" },
            { label: "时间线", meta: tl ? tl.version + (tl.stale ? " · 标脏 " + tl.stale : "") : "未创建", state: tl ? (tl.stale ? "now" : "done") : "" },
            { label: "分集成片", meta: wf.passEps.length + " / " + p.episodes, state: wf.passEps.length === p.episodes ? "done" : "" },
            { label: "交付包", meta: dp ? dp.id : "未生成", state: dp ? "done" : "" }
          ]);
          const rows = [
            [script ? script.id : "—", "剧本", script ? "正式 · 锁定" : "未锁定", wf.eps.length + " 集 / " + wf.shots.length + " 镜头", script ? "下游唯一基准" : "需先锁定剧本"],
            [tl ? tl.version : "—", "时间线（当前集）", tl ? tl.status : "未创建", tl ? tl.tracks + " 轨 / " + tl.clips + " 段" : "—", tl && tl.stale ? "标脏 " + tl.stale + " 段" : "无标脏"],
            [sub ? sub.version : "—", "字幕", sub ? sub.status : "未生成", sub ? sub.ep + " 集 · " + sub.lines + " 行" : "—", sub ? sub.timeline : "需先生成"],
            [dp ? dp.id : "—", "交付包", dp ? dp.status : "未生成", dp ? dp.episodes + " 集 / " + dp.files + " 文件" : "—", dp ? (dp.frozen ? "已冻结" : "待确认") : "交付门禁未满足"]
          ].map(r => "<tr><td>" + U.code(r[0]) + "</td><td>" + U.esc(r[1]) + "</td><td>" + U.pill(r[2]) + '</td><td class="num">' + U.esc(r[3]) + '</td><td class="cell-wrap muted">' + U.esc(r[4]) + "</td></tr>").join("");
          return U.page("后期与剪辑 / 版本链", "版本链", "版本号是唯一身份：改内容不改版本是禁止的。",
            U.btn("回指引用检查", "post.refCheck", "primary", { pid: p.id }) + U.btn("资产库", "post.toAssets", "", { id: p.id }) + (["已交付", "已归档"].indexOf(p.status) >= 0 && App.can("project.create") ? U.btn("新建 V2 版本链", "post.newVersion", "", { id: p.id }) : ""),
            U.card("链路视图 · " + U.esc(p.name), chain, "箭头表示下游消费上游") +
            U.card("版本记录 · " + U.esc(p.name), U.table(["对象", "类型", "状态", "规模", "说明"], rows, "当前项目还没有版本记录")) +
            '<div class="grid grid-2 mt-4">' +
              U.notice("口径与规则见《口径与规则汇总》§R-31：版本规则", "info") +
              U.card("当前版本状态", U.listRows([["剧本", script ? script.id : "未锁定"], ["镜头", wf.shots.length + " 个（" + wf.passedShots.length + " 通过）"], ["时间线", wf.timelines.length + " 条"], ["字幕", wf.subs.filter(s => s.status === "已通过").length + " / " + p.episodes + " 集通过"], ["交付包", dp ? dp.id + " · " + dp.status : "未生成"]]) , "只读投影") +
            "</div>"
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("post.toEpisodes", (el) => App.go("post/episodes", { id: (el && el.dataset && el.dataset.id) || (App.current().query || {}).id || ((App.currentProject() || {}).id || "") }));
  App.on("post.toReview", (el) => App.go("post/review", { id: (el && el.dataset && el.dataset.id) || (App.current().query || {}).id || ((App.currentProject() || {}).id || "") }));
  App.on("post.toDelivery", (el) => App.go("post/delivery", { id: (el && el.dataset && el.dataset.id) || (App.current().query || {}).id || ((App.currentProject() || {}).id || "") }));
  App.on("post.tab", (el) => { App.set(SCOPE, "tab", el.dataset.value); App.refresh(); });
  App.on("post.toAssets", (el) => { const pid = (el && el.dataset && el.dataset.id) || (App.current().query || {}).id; App.go("assets/library", pid ? { id: pid } : undefined); });
  App.on("post.openTimeline", (el) => {
    const ep = Number(el.dataset.ep) || 17;
    App.set(SCOPE, "ep", ep);
    App.go("post/timeline", { ep: ep, id: (el.dataset.pid || (App.current().query || {}).id || ((App.currentProject() || {}).id || "")) });
  });
  App.on("post.epPreview", (el) => App.drawer("预览 · E" + el.dataset.ep, U.notice("原型不含真实视频文件：此处展示画幅、时长与字幕示例，不播放。", "info") + '<div class="shot-frame" style="aspect-ratio:9/16;max-width:260px"><span class="frame-tag">E' + U.esc(el.dataset.ep) + '</span><span class="frame-meta">1080×1920 · 25fps</span></div>'));
  App.on("post.reviewDetail", (el) => {
    const r = D.reviews.find(x => x.id === el.dataset.id);
    if (!r) return;
    App.drawer("审核记录 · " + r.id, U.desc([["节点", r.node], ["对象", r.object], ["版本", r.version], ["审核人", r.auditor + " · " + r.role], ["时间", r.at], ["结论", r.result], ["问题定位", r.positions], ["关联任务", r.tasks], ["后续", r.follow]]) + U.notice(r.note, "info"));
  });
  App.on("post.reviewHistory", (el) => {
    const pid = (el && el.dataset && el.dataset.pid) || (App.current().query || {}).id || ((App.currentProject() || {}).id || "");
    const rows = D.reviews.filter(r => r.project === pid && (String(r.node).indexOf("成片") >= 0 || String(r.node).indexOf("终审") >= 0));
    App.drawer("成片审核记录 · " + pid, rows.length ? U.table(["记录", "节点", "对象", "结论", "审核人", "时间"], rows.map(r =>
      "<tr><td>" + U.code(r.id) + "</td><td>" + U.esc(r.node) + '</td><td class="cell-wrap">' + U.esc(r.object) + "</td><td>" + U.pill(r.result) + "</td><td>" + U.esc(r.auditor) + '</td><td class="idx">' + U.esc(r.at) + "</td></tr>").join("")) : U.empty("暂无审核记录", "当前项目还没有成片审核记录。"));
  });
 })();

/* ===== v9.1 真实流程层：时间线输出 → 分集质检 → 终审 → 交付 ===== */
(function () {
  const U = UI, D = DB;
  const pidOf = (el) => (el && el.dataset && el.dataset.pid) || (App.current().query || {}).id || ((App.currentProject() || {}).id || "");
  const epsOf = (pid) => D.episodes.filter(e => e.project === pid);

  function blockRights() {
    const rows = (D.rights || []).filter(r => r.status === "阻断");
    return rows;
  }

  App.on("post.newTimeline", (el) => {
    if (!App.guard("post.write")) return;
    const qid = (el && el.dataset && el.dataset.pid) || (App.current().query || {}).id || ((App.currentProject() || {}).id || "");
    const frozen = frozenOf(qid);
    if (frozen) { App.toast("《" + frozen.name + "》当前状态「" + frozen.status + "」，时间线只读；如需修改请新建版本链", "bad"); return; }
    const avail = D.episodes.filter(e => e.project === qid).filter(e => !D.timelines.some(t => t.project === qid && t.ep === e.no));
    if (!avail.length) { App.toast("当前项目所有集次均已有时间线", "bad"); return; }
    App.modal({
      title: "新建时间线", sub: "时间线按集次建立；重复集次将被拦截",
      body: U.fSelect("集次", "ep", avail.map(e => ({ value: String(e.no), label: "E" + e.no + " · " + e.title })), { required: true }) +
        U.fField("剪辑说明", "note", { required: true, minlen: 6, rows: 2 }) +
        U.notice("时间线引用镜头采用版本；采用版本变更会使片段标脏。", "info"),
      submitText: "创建时间线",
      onSubmit(d) {
        return App.job({
          title: "创建时间线", steps: ["校验集次与镜头齐备", "建立轨道与片段引用"],
          run() {
            const ep = Number(d.ep);
            if (D.timelines.some(t => t.project === qid && t.ep === ep)) return { ok: false, msg: "E" + ep + " 已存在时间线，请勿重复创建" };
            const shots = D.shots.filter(s => s.project === qid && s.ep === ep);
            if (!shots.length) return { ok: false, msg: "E" + ep + " 没有分镜，需先完成分镜拆解" };
            D.timelines.push({ project: qid, ep: ep, version: "TL-" + qid.replace("SP-", "") + "-E" + ep + "-V1", tracks: 6, clips: shots.length, duration: "草稿", timebase: "PTS + 1/25 时基", status: "编辑中", stale: 0 });
            DB.state.log("时间线 E" + ep, "新建：" + d.note, "成功", "TL-E" + ep);
            return { ok: true, msg: "E" + ep + " 时间线 V1 已建立（" + shots.length + " 个片段）" };
          }
        });
      }
    });
  });

  App.on("post.exportTimeline", (el) => {
    if (!App.guard("post.write")) return;
    const qid = (el && el.dataset && el.dataset.pid) || (App.current().query || {}).id || ((App.currentProject() || {}).id || "");
    const frozen = frozenOf(qid);
    if (frozen) { App.toast("《" + frozen.name + "》当前状态「" + frozen.status + "」，成片版本已冻结，不能再次输出", "bad"); return; }
    const ep = Number((el && el.dataset && el.dataset.ep) || (App.current().query || {}).ep || App.get(SCOPE, "ep", 17));
    const tl = D.timelines.find(t => t.project === qid && t.ep === ep);
    const e = D.episodes.find(x => x.project === qid && x.no === ep);
    if (!tl) { App.toast("E" + ep + " 没有时间线", "bad"); return; }
    if (tl.stale > 0) { App.toast("存在 " + tl.stale + " 个标脏片段，需替换采用版本后才能输出", "bad"); return; }
    const sub = D.subtitles.find(s => s.project === qid && s.ep === ep);
    if (!sub || sub.status !== "已通过") { App.toast("E" + ep + " 字幕为「" + (sub ? sub.status : "未生成") + "」，需校对通过后才能输出", "bad"); return; }
    if (!e || e.qc !== "PASS") { App.toast("E" + ep + " 质检未通过（" + (e ? e.qc : "无记录") + "），不能输出成片", "bad"); return; }
    App.modal({
      title: "输出成片 · E" + ep, sub: "输出 H.264 MP4 1080×1920；输出后版本冻结并写入成片资产",
      body: U.fSelect("输出规格", "spec", ["H.264 MP4 · 1080×1920 · 25fps", "H.264 MP4 · 720×1280 · 25fps"], { required: true }) +
        U.fCheck("确认引用版本为最终采用版本", "okv", { checked: true }),
      submitText: "开始输出",
      onSubmit(d) {
        return App.job({
          title: "输出成片", steps: ["冻结时间线版本", "渲染与封装", "写入成片资产", "登记分集状态"],
          run() {
            if (!d.okv) return { ok: false, msg: "需确认引用版本为最终采用版本", fields: { okv: "请勾选确认" } };
            const ver = qid + "_E" + ep + "_V" + (String(tl.version).match(/V(\d+)/) ? String(tl.version).match(/V(\d+)/)[1] : "1") + ".mp4";
            tl.status = "已输出";
            e.status = "成片已输出"; e.qc = "PASS";
            DB.state.log("时间线 E" + ep, "输出成片 " + ver + "（" + d.spec + "）", "成功", tl.version);
            return { ok: true, msg: "已输出 " + ver + "，版本已冻结" };
          }
        });
      }
    });
  });

  App.on("post.epQc", (el) => {
    const ep = Number(el.dataset.ep);
    const pid = pidOf(el);
    const frozen = frozenOf(pid);
    const e = epsOf(pid).find(x => x.no === ep);
    const shots = D.shots.filter(s => s.project === pid && s.ep === ep);
    const cnt = k => shots.filter(s => s.status === k).length;
    const rep = D.qualityReports.find(r => String(r.object).indexOf(pid + " / 第 " + ep + " 集") >= 0);
    App.drawer("质检报告 · E" + ep + " " + (e ? e.title : ""),
      U.desc([["项目", pid], ["集", "E" + ep], ["场 / 镜头", (e ? e.scenes : 0) + " 场 / " + shots.length + " 镜头"], ["时长", e ? e.duration : "—"], ["镜头状态", "已通过 " + cnt("已通过") + " · 待质检 " + cnt("待质检") + " · 执行中 " + cnt("执行中") + " · 需复核 " + cnt("需复核")], ["质检结论", e ? e.qc : "—"], ["报告", rep ? rep.id + "（" + rep.result + "）" : "未生成"]]) +
      '<div class="btn-row-inline">' + (frozen ? U.notice("《" + frozen.name + "》当前状态「" + frozen.status + "」，集级质检只读。", "info") : U.btn("执行集级质检", "post.runEpQc", "primary", { ep: ep, pid: pid })) + "</div>");
  });

  App.on("post.runEpQc", (el) => {
    const ep = Number(el.dataset.ep);
    const pid = pidOf(el);
    const frozen = frozenOf(pid);
    if (frozen) { App.toast("《" + frozen.name + "》当前状态「" + frozen.status + "」，集级质检只读", "bad"); return; }
    App.job({
      title: "集级质检 · E" + ep, steps: ["读取镜头质检结果", "按契约检测集级项", "写入报告"],
      run() {
        const shots = D.shots.filter(s => s.project === pid && s.ep === ep);
        if (!shots.length) return { ok: false, msg: "该集没有分镜记录" };
        const notPass = shots.filter(s => s.status !== "已通过");
        if (notPass.length) return { ok: false, msg: "仍有 " + notPass.length + " 个镜头未通过（" + notPass.slice(0, 3).map(s => s.no).join("、") + "），集级质检不可执行" };
        const e = epsOf(pid).find(x => x.no === ep);
        if (!e) return { ok: false, msg: "项目 " + pid + " 没有 E" + ep + " 分集记录" };
        e.qc = "PASS"; e.status = "已通过质检";
        const rid = "QR-" + pid.replace("SP-", "") + "-E" + ep;
        const old = D.qualityReports.findIndex(r => r.id === rid);
        const rep = { id: rid, object: pid + " / 第 " + ep + " 集成片", level: "单集级", version: "EP" + ep + " v1", result: "PASS", items: 42, issues: 0, review: 0, fail: 0, engine: "质检模型 Q1（独立检测能力）", at: DB.state.at(), note: "集级质检通过" };
        if (old >= 0) D.qualityReports[old] = rep; else D.qualityReports.unshift(rep);
        DB.state.log("分集 E" + ep, "集级质检通过 · " + pid, "成功", rid);
        return { ok: true, msg: "E" + ep + " 集级质检 PASS，已写入报告 " + rid };
      }
    });
  });


  App.on("post.deliveryDetail", (el) => {
    const x = D.deliveries.find(d => d.id === el.dataset.id);
    if (!x) return;
    App.drawer("交付包 · " + x.id, U.desc([["项目", x.project], ["版本", x.version], ["集数", x.episodes], ["文件数", x.files], ["体积", x.size], ["校验", x.checksum], ["审核人", x.reviewer], ["时间", x.at], ["接收方", x.receiver], ["状态", x.status], ["冻结", x.frozen ? "是" : "否"]]) +
      (x.note ? U.notice(x.note, "info") : "") +
      '<div class="btn-row-inline">' + (x.status === "待核验" ? U.btn("确认接收", "post.confirmDelivery", "primary", { id: x.id }) + U.btn("作废交付包", "post.voidDelivery", "sm", { id: x.id }) : "") +
      (x.status === "已交付" ? (App.can("project.manage") ? U.btn("归档项目", "post.archiveProject", "sm", { id: x.project }) : "") : "") + "</div>");
  });

  App.on("post.confirmDelivery", (el) => {
    if (!App.guard("delivery.execute")) return;
    const x = D.deliveries.find(d => d.id === el.dataset.id);
    if (!x) return;
    App.closeDrawer();
    App.modal({
      title: "确认接收 · " + x.id, sub: "接收方核验校验和与集次范围后确认；确认即冻结，不可修改",
      body: U.fField("校验和复核", "sum", { required: true, placeholder: "粘贴接收方计算的 sha256 前缀", hint: "与交付包记录 " + x.checksum + " 比对" }) +
        U.fTextarea("接收说明", "note", { required: true, minlen: 8, rows: 3 }),
      submitText: "确认交付",
      onSubmit(d) {
        return App.job({
          title: "确认交付", steps: ["比对校验和", "冻结交付包", "更新作品与项目"],
          run() {
            const okSum = String(d.sum).replace(/[^0-9a-z]/gi, "").slice(0, 4).toLowerCase();
            const refSum = String(x.checksum).replace(/[^0-9a-z]/gi, "");
            if (refSum.indexOf(okSum) < 0) return { ok: false, msg: "校验和不一致，接收方需重新下载后比对", fields: { sum: "与记录不一致" } };
            x.status = "已交付"; x.frozen = true; x.at = DB.state.at();
            const w = D.works.find(w => w.project === x.project);
            if (w) { w.status = "已交付（分批）"; w.delivered = DB.state.time(); w.version = x.version + " · 冻结"; w.next = "继续生产剩余集次，新建 V2"; }
            DB.state.log("交付 " + x.id, "接收方确认：" + d.note, "成功", x.id);
            return { ok: true, msg: "交付包 " + x.id + " 已确认并冻结" };
          }
        });
      }
    });
  });

  App.on("post.voidDelivery", (el) => {
    if (!App.guard("delivery.execute")) return;
    const x = D.deliveries.find(d => d.id === el.dataset.id);
    App.confirm("作废交付包", x.id + " 尚未被接收；作废后需重新生成，已产生的打包成本不退。", () => {
      x.status = "已作废"; x.frozen = false;
      DB.state.log("交付 " + x.id, "作废交付包", "成功", x.id);
      App.closeDrawer(); App.toast("已作废 " + x.id, "warn"); App.refresh();
    }, "作废");
  });

  App.on("post.archiveProject", (el) => {
    if (!App.guard("delivery.execute")) return;
    const id = el.dataset.id;
    App.job({ title: "归档项目", steps: ["校验交付状态", "归档资产与作品"], run() { return DB.state.archive(id); } });
  });

  App.on("post.workDetail", (el) => {
    const w = D.works.find(w => w.project === el.dataset.p);
    if (!w) return;
    const p = D.projects.find(x => x.id === w.project);
    App.drawer("作品 · " + w.name, U.desc([["项目", w.project], ["项目状态", p ? p.status : "—"], ["作品状态", w.status], ["集数", w.episodes], ["总时长", w.duration], ["交付日", w.delivered], ["版本", w.version], ["后续", w.next]]) +
      U.notice("作品状态由交付与归档结果驱动，人工不可直接修改。", "info") +
      '<div class="btn-row-inline">' + (p && p.status === "已交付" ? (App.can("project.manage") ? U.btn("归档项目", "post.archiveProject", "primary", { id: p.id }) : "") : "") + "</div>");
  });

  App.on("post.qcIssues", (el) => {
    const pid = pidOf(el);
    const rows = epsOf(pid).filter(e => e.qc !== "PASS").map(e => "E" + e.no + " " + e.title + " · " + (e.qc === "进行中" ? "质检进行中" : e.qc === "未开始" ? "未开始" : e.qc));
    App.drawer("未通过质检清单 · " + pid, rows.length ? U.listRows(rows.map(r => [r, "需处理"])) : U.empty("当前项目没有未通过质检的集次"));
  });

  App.on("post.versionChain", (el) => {
    const p = el.dataset.p || pidOf(el);
    const script = (D.scripts || []).find(s => s.project === p);
    const tl = D.timelines.filter(t => t.project === p);
    const dl = D.deliveries.filter(d => d.project === p);
    const pj = D.projects.find(x => x.id === p);
    const canNew = pj && ["已交付", "已归档"].indexOf(pj.status) >= 0 && App.can("project.create");
    App.drawer("版本链 · " + p, U.listRows([
      ["剧本", script ? script.id + " · " + script.version + " · " + script.status : "—"],
      ["分镜", (D.shots || []).filter(s => s.project === p).length + " 个镜头"],
      ["时间线", tl.length ? tl.map(t => "E" + t.ep + " " + t.version).join("；") : "—"],
      ["成片", dl.length ? dl.map(d => d.version).join("；") : "—"],
      ["交付", dl.length ? dl.map(d => d.id + " · " + d.status).join("；") : "未生成"]
    ]) + (canNew ? '<div class="btn-row-inline">' + U.btn("从此版本新建 V2", "post.newVersion", "primary", { id: p }) + "</div>" : ""));
  });

  App.on("post.newVersion", (el) => {
    if (!App.guard("project.create")) return;
    const src = D.projects.find(x => x.id === (el && el.dataset && (el.dataset.id || el.dataset.pid)));
    if (!src) { App.toast("来源项目不存在", "bad"); return; }
    if (!DB.derived.canViewProject(src)) { App.toast("来源项目不在当前可见范围", "bad"); return; }
    if (["已交付", "已归档"].indexOf(src.status) < 0) { App.toast("只有已交付或已归档项目可新建版本链", "bad"); return; }
    const n = 2 + D.projects.filter(x => x.originProject === src.id).length;
    const baseName = String(src.name).replace(/ · V\d+$/, "");
    const brief = D.briefs.find(b => b.project === src.id);
    App.modal({
      title: "新建 V2 版本链", sub: "新版本以新项目建立，复制设定与规模后重新走剧本审核；V1 交付包与历史记录不变",
      body: U.fField("新版本名称", "name", { value: baseName + " · V" + n, required: true }) +
        U.fField("集数", "episodes", { value: String(src.episodes), required: true, type: "number" }) +
        U.fField("预算", "budget", { value: String(DB.derived.budgetOfProject(src).total), required: true, type: "number" }) +
        U.fTextarea("版本说明", "note", { required: true, minlen: 8, rows: 2, value: "基于 " + src.id + " 交付版本建立 " + "V" + n + "，保留原交付包" }) +
        U.notice("新版本不会复制镜头、时间线与交付包；这些对象必须在新项目中重新生产与质检。", "info"),
      submitText: "建立版本链",
      onSubmit(d) {
        return App.job({
          title: "新建版本链", steps: ["校验来源交付状态", "复制项目设定并建立草稿", "写入版本关系与审计"],
          run() {
            const r = DB.state.createProject({
              name: d.name, episodes: d.episodes, budget: d.budget, genre: src.genre, audience: src.audience,
              duration: src.duration, style: src.style, constraints: src.constraints, delivery: src.delivery,
              ratio: src.ratio, language: src.language, dept: src.dept, brief: brief ? brief.note : "基于 " + src.id + " 新建版本"
            });
            if (!r.ok) return r;
            const np = r.data;
            np.originProject = src.id;
            np.versionLabel = "V" + n;
            np.updated = DB.state.at();
            const nb = D.briefs.find(b => b.project === np.id);
            if (nb && brief) { nb.mode = brief.mode; nb.status = "待提交"; }
            DB.state.log("项目 " + np.id, "从 " + src.id + " 新建 V" + n + " 版本链：" + d.note, "成功", np.id);
            DB.state.notify({ type: "版本链", project: np.id, title: np.name + " 已建立 V" + n, reason: "来源 " + src.id + " 已" + src.status, impact: "需重新提交创意设定、生成剧本并审核", action: "进入新项目继续创作", owner: np.owner, link: "projects/detail?id=" + np.id });
            return { ok: true, msg: "已建立 " + np.id + "（V" + n + "），V1 交付包不变", id: np.id };
          },
          after(out) { if (out && out.ok && out.id) App.go("projects/detail", { id: out.id }); }
        });
      }
    });
  });

  App.on("post.refCheck", (el) => {
    const pid = (el && el.dataset && el.dataset.pid) || (App.current().query || {}).id || ((App.currentProject() || {}).id || "");
    const a = D.assets.find(x => x.id === el.dataset.id) || D.assets.find(x => x.project === pid && Number(x.refs) > 0);
    if (!a) { App.toast("当前项目没有可做引用检查的资产", "bad"); return; }
    const refs = a.refs || 0;
    App.drawer("引用检查 · " + a.id, U.desc([["项目", a.project], ["资产", a.name], ["类型", a.type], ["状态", a.status], ["正式", a.formal ? "是" : "否"], ["下游引用", refs + " 处"]]) +
      (refs > 0 ? U.notice("存在 " + refs + " 处下游引用（时间线 / 分集交付），删除会破坏历史，已阻断。", "bad") : U.notice("无下游引用，可删除（需二次确认）", "ok")));
  });
})();


