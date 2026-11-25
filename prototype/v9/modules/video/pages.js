/* 模块：video 视频生产（员工工作台） */
(function () {
  const U = UI, D = DB, SCOPE = "video";
  const vTasks = (pid) => D.tasks.filter(t => t.kind === "视频生成" && (!pid || t.project === pid));

  /* ---------- 镜头版本（原 video/results，B2·M3 并入预览与校验的「版本列表」tab） ----------
     同一镜头可有多次尝试与多个版本：采用、未采用、待复核都必须有明确结论与理由。 */
  const versionsBlock = (p) => {
    const pid = p.id;
    const frozen = ["已交付", "已归档"].indexOf(p.status) >= 0;
    const filter = App.get(SCOPE, "resFilter", "all");
    const tasks = D.tasks.filter(t => t.project === pid && t.kind === "视频生成");
    const versions = tasks.map(t => {
      const s = D.shots.find(x => x.id === t.shot) || D.shots.find(x => x.project === pid && x.ep === t.ep && x.no === t.shot);
      const state = t.status === "成功" && t.qc === "PASS" ? "已采用" : (t.status === "成功" || t.status === "待质检" ? "待复核" : (t.status === "失败" || t.status === "待人工处理" ? "未采用" : "待生成"));
      return { shot: s ? s.id : t.shot, v: state === "待生成" ? "—" : "v" + Math.max(1, Number(t.attempt) || 1), at: t.submitAt || "—", by: t.model, state: state, adopt: state === "已采用", note: t.failReason && t.failReason !== "—" ? t.failReason : (t.output || t.status) };
    });
    const list = filter === "all" ? versions : versions.filter(v => v.state === filter);
    const rows = list.map(v =>
      '<tr><td>' + U.code(v.shot) + "</td><td>" + U.code(v.v) + "</td><td>" + U.esc(v.by) + '</td><td class="idx">' + U.esc(v.at) + "</td><td>" + U.pill(v.state) + '</td><td class="cell-wrap muted">' + U.esc(v.note) + "</td><td>" +
      U.btn("预览", "video.preview", "sm", { shot: v.shot, v: v.v }) + (!frozen && !v.adopt && v.state !== "待生成" ? " " + U.btn("设为采用", "video.adopt", "sm", { shot: v.shot, v: v.v }) : "") + "</td></tr>").join("");
    const adopted = versions.filter(v => v.state === "已采用").length;
    const review = versions.filter(v => v.state === "待复核").length;
    const rejected = versions.filter(v => v.state === "未采用").length;
    const pending = versions.filter(v => v.state === "待生成").length;
    const avgAttempt = tasks.length ? (tasks.reduce((n, t) => n + (Number(t.attempt) || 0), 0) / tasks.length).toFixed(2) : "0";
    return '<div class="toolbar">' + U.seg([
        { value: "all", label: "全部" }, { value: "已采用", label: "已采用" }, { value: "待复核", label: "待复核" }, { value: "未采用", label: "未采用" }, { value: "待生成", label: "待生成" }
      ], filter, "video.filter") + '<span class="faint small">结论由人或质量门禁给出，不按时间自动采用</span></div>' +
      U.card("镜头版本 · " + rows.length + " 条", U.table(["镜头", "版本", "模型", "生成时间", "结论", "说明", "操作"], rows, tasks.length ? "该分类下暂无结果" : "当前项目还没有视频生成任务"), rows.length ? "版本并存，采用只标记不删除" : (tasks.length ? "该分类下暂无结果" : "当前项目还没有视频生成任务")) +
      '<div class="grid grid-2 mt-4">' +
        U.card("版本规则", U.listRows([
          ["多版本并存", "同一镜头可保留多个版本，采用版本标记但旧版本不删除"],
          ["采用依据", "质量报告 PASS + 与相邻镜头衔接检查"],
          ["未采用理由", "必须记录具体缺陷，便于提示词修正"],
          ["资产入库", "采用版本进入正式资产库，未采用保留临时区"],
          ["引用", "下游时间线引用具体版本号，不引用「最新」"]
        ]), "采用不等于覆盖") +
        U.card("结果统计", '<div class="kv-grid">' + U.kv("生成任务", String(tasks.length)) + U.kv("已采用", String(adopted)) + U.kv("待复核", String(review)) + U.kv("未采用", String(rejected)) + U.kv("待生成", String(pending)) + U.kv("平均尝试数", avgAttempt) + "</div>", "按任务尝试记录统计，不伪造完成度") +
      "</div>";
  };

  AppModule.register({
    group: "video", label: "视频生产", icon: "video", order: 5, end: "workspace",
    routes: [
      {
        path: "video/production", title: "视频生产队列", icon: "video", permission: "production.write",
        desc: "四状态分离：供应商调用成功、文件下载完成、资产持久化完成、质量检测通过，任一步未完成都不算生产成功。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.page("视频生产 / 生产队列", "项目不在可见范围", "该链接指向的项目不存在或当前身份无权查看；生产队列不会回退到其他项目。", U.btn("返回项目列表", "common.projects", "primary"), U.empty("无法读取项目", "请从项目列表或制作流水线进入可见项目。"));
          const pid = p.id;
          const list = vTasks(pid);
          if (["已交付", "已归档"].indexOf(p.status) >= 0) {
            return U.page("视频生产 / 生产队列", "视频生产 · " + p.name, "项目已交付，生产队列冻结：不得再提交新批次或重跑镜头，历史任务只读保留。",
              U.btn("项目档案", "projects.detail", "primary", { id: p.id }),
              U.card("生产队列 · 已冻结", U.empty(p.status + " · 不接受新生成", "如需变更，必须先按流程新建版本链；原交付包与生产记录不会被覆盖。", App.can("delivery.execute") ? U.btn("查看交付包", "post.toDelivery", "", { id: p.id }) : ""), "已交付项目只读")
            );
          }
          const eps = D.episodes.filter(e => e.project === pid).sort((a, b) => a.no - b.no);
          const shots = D.shots.filter(s => s.project === pid);
          const bg = DB.state.budgetOf(pid);
          const paused = App.get(SCOPE, "queuePaused:" + pid, false);
          const pageActions = U.btn("新建生成批次", "video.newBatch", "primary", { pid: pid }) + U.btn(paused ? "恢复本项目队列" : "暂停本项目队列", "video.pauseQueue", "", { pid: pid }) + U.btn("查看任务中心", "video.toTasks", "", { pid: pid });
          if (!list.length) {
            return U.page("视频生产 / 生产队列", "视频生产 · " + p.name, "只有当前项目的视频生成任务会进入这条队列；没有任务时不伪造进度。",
              pageActions,
              U.card("生产队列为空", U.empty("当前项目还没有视频生成任务", "从分镜板选择镜头提交，或新建一个分集批次。") +
                '<div class="btn-row-inline">' + U.btn("去分镜板", "video.toStoryboard", "", { id: pid }) + U.btn("新建生成批次", "video.newBatch", "primary", { pid: pid }) + "</div>",
                "任务、费用与质检记录仍按项目隔离")
            );
          }
          const selId = App.get(SCOPE, "task", list[0] ? list[0].id : "");
          const wantEp = Number((query && query.ep) || 0);
          const cur = list.find(t => t.id === selId) || (wantEp ? list.find(t => t.ep === wantEp) : null) || list[0];
          const shotOf = (t) => t ? D.shots.find(s => s.project === t.project && s.ep === t.ep && (s.id === t.shot || s.no === t.shot)) : null;
          const curShot = shotOf(cur);
          const stageImg = (curShot && U.storyFrame(curShot)) || "assets/img/covers/shot-post.jpg";
          const progOf = (t) => ({ "执行中": 68, "排队中": 12, "待执行": 0, "待人工处理": 88, "成功": 100 }[t.status] || 0);
          const toneOf = (t) => t.status === "执行中" ? "accent" : t.status === "待人工处理" ? "bad" : t.status === "排队中" ? "warn" : "muted";
          const pendingEps = eps.map(e => {
            const es = shots.filter(s => s.ep === e.no);
            const done = es.filter(s => s.status === "已通过").length;
            return { no: e.no, done: done, total: es.length };
          }).filter(e => e.total && e.done < e.total).slice(0, 3);
          const cost = list.reduce((n, t) => n + (Number(t.actual) || 0), 0);
          const est = list.reduce((n, t) => n + (Number(t.est) || 0), 0);
          const curProv = cur ? D.providers.find(x => x.id === cur.config) : null;
          const qNum = curProv ? Number((String(curProv.quota).match(/(\d+)%/) || [])[1] || 0) : 0;
          const mine = App.identity();
          const entProv = list.map(t => D.providers.find(x => x.id === t.config)).find(x => x && x.ownerId !== mine.userId && String(x.quota).indexOf("企业配额") >= 0) || null;
          const entNum = entProv ? Number((String(entProv.quota).match(/(\d+)%/) || [])[1] || 0) : 0;
          const qOps = D.ops.queue.find(q => q.name === "视频生成队列") || null;
          const active = list.filter(t => t.status === "执行中").length;
          return U.page("视频生产 / 生产队列", "视频生产 · " + p.name, "生成中的镜头在这里。队列按依赖排序，失败不吞、重试单独计费；每一步产物都能回到镜头契约。",
            pageActions,
            '<div class="video-studio">' +
              '<section class="take-stage">' +
                '<img src="' + U.esc(stageImg) + '" alt="当前生成镜头">' +
                '<div class="stage-top"><div>' + U.pill(cur ? cur.status : "—", toneOf(cur || {})) + ' ' + U.pill("E" + (cur ? cur.ep : "—") + " / " + (cur ? cur.shot : "—"), "outline") + '</div><span>' + (cur ? U.esc(cur.output) : "") + '</span></div>' +
                '<button type="button" class="stage-play" data-action="video.preview" data-shot="' + U.esc(curShot ? curShot.id : "") + '" aria-label="预览当前镜头">▶</button>' +
                '<div class="stage-bottom">' +
                  '<span class="kicker">' + (cur ? U.esc(cur.project) + " · E" + cur.ep + " / S" + cur.scene : "") + '</span>' +
                  '<h3>' + (curShot ? U.esc(curShot.desc) : "等待生成") + '</h3>' +
                  '<p class="stage-line">' + (curShot ? U.esc(curShot.line) + " · " + U.esc(curShot.frame) + " / " + U.esc(curShot.move) : "") + '</p>' +
                  '<div class="stage-progress"><div class="bar"><span style="width:' + (cur ? progOf(cur) : 0) + '%"></span></div><div class="meta"><span>' + (cur && cur.status === "执行中" ? "供应商生成中 · 已用 22 秒 / 预计 38 秒" : "等待调度") + '</span><b>' + (cur ? progOf(cur) : 0) + '%</b></div></div>' +
                  '<div class="stage-actions">' +
                    '<span class="chip">' + (cur ? U.esc(cur.model) + " · " + U.esc(cur.config) : "") + '</span><span class="chip">第 ' + (cur ? cur.attempt : 0) + " / " + (cur ? cur.maxAttempts : 0) + ' 次尝试</span><span class="chip">¥' + (cur ? cur.est : 0) + '</span>' +
                    '<span style="flex:1"></span>' + (cur ? U.btn("查看任务", "video.taskDetail", "sm", { id: cur.id }) +
                    (cur.status === "待人工处理" ? U.btn("处理失败", "video.handleFail", "primary", { id: cur.id }) : U.btn("进入预览评审", "video.toPreview", "sm", { shot: curShot ? curShot.id : "" })) : '<span class="faint small">等待可执行任务后再进入评审</span>') +
                  '</div>' +
                '</div>' +
              '</section>' +
              '<aside class="take-queue">' +
                '<div class="queue-head"><div><span class="kicker">生成队列 · ' + U.esc(p.name) + '</span><b>' + list.length + ' 个镜头</b></div><span class="faint small">按依赖与优先级排序</span></div>' +
                '<div class="queue-list">' + list.map(t => {
                  const sh = shotOf(t);
                  const img = (sh && U.storyFrame(sh)) || "assets/img/covers/shot-post.jpg";
                  const st = t.steps || { vendor: "未开始", download: "未开始", persist: "未开始", qc: "未开始" };
                  return '<div class="take-card' + (cur && t.id === cur.id ? " is-cur" : "") + '" data-action="video.selectTask" data-id="' + t.id + '">' +
                    '<span class="tc-thumb"><img src="' + U.esc(img) + '" alt=""><em>' + U.esc(t.shot) + '</em></span>' +
                    '<div class="tc-body"><div class="tc-top"><b>' + U.esc(t.kind) + ' · ' + U.esc(t.shot) + '</b><span class="tc-pill ' + toneOf(t) + '">' + U.esc(t.status) + '</span></div>' +
                      '<small>' + U.esc(t.model) + " · " + U.esc(t.config) + " · " + U.esc(t.output) + '</small>' +
                      /* 四状态分离：供应商任务 / 文件下载 / 资产持久化 / 质量检测，各自独立（业务方案 §8.2） */
                      '<div class="thread">' + U.pill("供应商 " + st.vendor) + U.pill("下载 " + st.download) + U.pill("持久化 " + st.persist) + U.pill("质检 " + st.qc) + '</div>' +
                      '<div class="tc-progress"><span style="width:' + progOf(t) + '%"></span></div>' +
                      '<div class="tc-foot"><span>E' + t.ep + " / S" + t.scene + '</span><span>' + t.attempt + "/" + t.maxAttempts + ' 次</span><span>¥' + t.est + "</span>" +
                        (t.failType && t.failType !== "—" ? '<span class="tc-fail">' + U.esc(t.failType) + "</span>" : "") +
                        (["排队中", "待执行", "待人工处理"].indexOf(t.status) >= 0 ? '<button type="button" class="tc-act" data-action="video.runTask" data-id="' + t.id + '">' + (t.status === "待人工处理" ? "处理" : "执行") + "</button>" : "") + '</div></div>' +
                  '</div>';
                }).join("") + '</div>' +
                '<div class="queue-foot">' + U.notice("同组并行上限 2；当前项目 " + list.length + " 个视频任务，仅显示本项目任务。", "info") + '</div>' +
              '</aside>' +
            '</div>' +
            '<div class="split mt-4"><div class="stack">' +
              U.card("四状态分离口径", '<div class="four-steps">' +
                [["01", "供应商调用成功", "回执到达", "超时 / 限流 / 鉴权失败"], ["02", "文件下载完成", "临时区完整", "断流 / 校验不通过"], ["03", "资产持久化完成", "正式存储 + 校验值", "存储失败 / 版本冲突"], ["04", "质量检测通过", "镜头级 PASS", "需人工判断 / FAIL"]].map(s =>
                  '<div class="four-step"><span class="fs-no">' + s[0] + '</span><div><b>' + s[1] + '</b><small>' + s[2] + '</small><em>失败：' + s[3] + '</em></div></div>').join("") + '</div>', "任一阶段未完成都不能标记成功") +
              U.card("失败处理与重试", U.listRows([
                ["重试", "新建 Attempt 记录，不覆盖原尝试；失败与重试均计费"],
                ["上限", "默认 3 次，达上限转「待人工处理」并通知"],
                ["备用模型", "切换前做兼容校验（时长 / 画幅 / 参考类型）"],
                ["取消", "仅未派发任务可无成本取消；已提交按供应商能力处理"]
              ]), "不允许静默改用他人凭据或默认模型", U.btn("全部尝试记录", "video.toAttempts", "sm")) +
            '</div><div class="stack">' +
              U.card("批次进度", pendingEps.length ? pendingEps.map(e => {
                const pct = Math.round(e.done / e.total * 100);
                return U.progress(pct, "E" + e.no + " · " + e.done + " / " + e.total + " 个镜头完成", pct >= 100 ? "ok" : pct ? "warn" : "bad");
              }).join("") : U.empty("所有分集镜头已通过", "当前项目没有待完成的分集批次"), "批次不改变集次结构") +
              U.card("资源配置占用",
                (curProv ? U.hbar(curProv.id + " " + (curProv.ownerId === mine.userId ? "个人自持" : curProv.owner + " 配额"), qNum, 100, "%") : '<div class="faint small">当前任务未绑定可用资源配置</div>') +
                (entProv ? U.hbar(entProv.id + " 企业托管", entNum, 100, "%") : '<div class="faint small">本项目未引用企业托管配额</div>') +
                U.hbar("本项目执行中", active, Math.max(list.length, 1), " / " + list.length + " 个任务"),
                (qOps ? "平台视频队列 " + qOps.concurrency + " · " + qOps.note : "未读取到平台视频队列") + "；并发与配额共同限制吞吐",
                (App.can("models.own") || App.can("models.manage")) ? U.btn("去资源配置", "video.toModels", "sm") : "") +
              U.notice("口径与规则见《口径与规则汇总》§R-41：成本提示", "info") +
            "</div></div>"
          );
        }
      },
      {
        path: "video/preview", title: "预览与校验", icon: "film", permission: "production.write",
        desc: "预览不提供真实视频素材：以画幅占位与契约摘要呈现评审结构，明确标注为静态展示态。",
        render(query) {
          const q = query || {};
          const shotHit = D.shots.find(x => x.id === q.shot || x.no === q.shot);
          const p = App.currentProject({ id: q.id || (shotHit && shotHit.project) || "" });
          if (!p) return U.page("视频生产 / 预览与校验", "项目不在可见范围", "该链接中的项目或镜头不属于当前身份可见范围，已阻止跨项目预览。", U.btn("返回项目列表", "common.projects", "primary"), U.empty("无法读取预览对象", "请从当前项目的生成结果进入。"));
          const pid = p.id;
          const frozen = ["已交付", "已归档"].indexOf(p.status) >= 0;
          const tab = App.get(SCOPE, "tab", "preview");
          const tabsBar = U.card("", U.tabs([
            { value: "preview", label: "预览与校验", count: 1 },
            { value: "versions", label: "版本列表", count: D.tasks.filter(t => t.project === pid && t.kind === "视频生成").length }
          ], tab, "video.tab"));
          if (tab === "versions") {
            return U.page("视频生产 / 预览与校验", "版本列表 · " + p.name, "同一镜头的多次尝试与多个版本都在这里：未采用的版本保留可追溯，不因采用新版本而删除。",
              U.btn("导出结果清单", "common.export"),
              tabsBar + versionsBlock(p));
          }
          const s = (shotHit && shotHit.project === pid ? shotHit : null) || (q.shot ? null : D.shots.filter(x => x.project === pid)[0]);
          if (!s) return U.page("视频生产 / 预览与校验", "预览与校验", "没有可预览的镜头。", U.btn("版本列表", "video.tab", "primary", { value: "versions" }), U.empty(q.shot ? "镜头不属于当前项目" : "暂无镜头", q.shot ? "当前链接中的镜头与项目不匹配，已阻止跨项目预览。" : "先从分镜板提交镜头生产。"));
          const frameImg = U.storyFrame(s) || "assets/img/covers/shot-post.jpg";
          const epShots = D.shots.filter(x => x.project === s.project && x.ep === s.ep).sort((a, b) => a.order - b.order);
          const idx = epShots.findIndex(x => x.id === s.id);
          const prev = idx > 0 ? epShots[idx - 1] : null;
          const next = idx >= 0 && idx < epShots.length - 1 ? epShots[idx + 1] : null;
          const neighbours = epShots.slice(Math.max(0, idx - 1), Math.max(4, idx + 2));
          const checks = [
            ["景别", s.frame, s.frame, "一致"],
            ["时长", s.duration, s.duration, "一致"],
            ["人物一致性", s.chars, "参考：" + s.refs, "需人工判断"],
            ["场景一致性", "当前场景版本", "参考：" + s.refs, "需人工判断"],
            ["画面异常", "无异常物体", "无明显异常", "通过"],
            ["口型", (String(s.line || "—") === "—" ? "本镜无对白" : "台词：" + s.line) + " · " + s.duration, "待比对成片", "待检"]
          ];
          const reviewCount = checks.filter(c => c[3] === "需人工判断").length;
          return U.page("视频生产 / 预览与校验", "预览与校验 · " + s.id, "以关键帧、时间线与契约逐项对照来评审；原型不加载真实成片，画面标注为静态关键帧。",
            U.btn("重新生成", "video.regenShot", "primary", { id: s.id }),
            tabsBar +
            '<div class="review-studio">' +
              '<section class="review-left">' +
                '<div class="phone-frame">' +
                  '<img src="' + U.esc(frameImg) + '" alt="' + U.esc(s.no) + ' 关键帧">' +
                  '<div class="phone-top">' + U.pill(s.status, "warn") + '<span class="mono">' + U.esc(s.no) + '</span></div>' +
                  '<button type="button" class="phone-play" data-action="video.playPreview" aria-label="播放预览">▶</button>' +
                  '<div class="phone-bottom">' +
                    '<div class="phone-meta"><b>E' + s.ep + " / S" + s.scene + " · " + U.esc(s.frame) + " · " + U.esc(s.move) + '</b><span>静态关键帧 · 非成片</span></div>' +
                    '<div class="scrub"><i style="width:52%"></i><em style="left:52%"></em></div>' +
                    '<div class="transport"><span>00:03</span><button type="button" data-action="video.toResults">≡</button><span>00:06</span></div>' +
                  '</div>' +
                '</div>' +
                '<div class="shot-strip"><div class="strip-label"><span class="kicker">同场景镜头</span><small>点击切换评审对象</small></div>' +
                  neighbours.map(n => '<button type="button" class="strip-item' + (n.id === s.id ? " is-cur" : "") + '" data-action="video.preview" data-shot="' + U.esc(n.id) + '"><img src="' + U.esc(U.storyFrame(n)) + '" alt=""><em>' + U.esc(n.no) + '</em></button>').join("") + '</div>' +
                U.card("与契约比对", '<div class="check-rows">' + checks.map(c =>
                  '<div class="check-row"><span class="cr-k">' + c[0] + '</span><span class="cr-v">' + U.esc(c[1]) + '</span><span class="cr-r">' + U.esc(c[2]) + '</span><span class="cr-s">' + U.pill(c[3]) + '</span></div>').join("") + '</div>', "比对结论进入质量报告") +
              '</section>' +
              '<aside class="review-side">' +
                U.card("采用决策", U.notice("当前结果存在 " + reviewCount + " 项需人工判断：可重新生成该镜头，或接受并记录理由。接受理由进入质量报告与审计。", "warn") +
                  '<div class="btn-col">' + (frozen ? '<span class="faint small">项目已交付，镜头只读；如需变更请新建版本链。</span>' : U.btn("接受并记录理由", "video.adoptCurrent", "primary", { id: s.id }) + U.btn("重新生成", "video.regenShot", "", { id: s.id })) + "</div>", "不能只点「通过」不写理由") +
                U.card("镜头摘要", U.desc([["镜头", s.no + " · E" + s.ep + " / S" + s.scene], ["画面", s.desc], ["景别 / 机位 / 运镜", s.frame + " · " + s.angle + " · " + s.move], ["时长", s.duration], ["引用资产", s.refs], ["模型 / 配置", s.model + " · " + (s.config || "个人自持配置")]]) , "契约是评审基准") +
                U.card("同组衔接", U.listRows([["前一镜头", prev ? prev.no + " · " + prev.frame + " · " + prev.desc : "无（本集首镜）"], ["本镜头", s.no + " · " + s.frame], ["后一镜头", next ? next.no + " · " + next.frame + " · " + next.desc : "无（本集末镜）"], ["衔接检查", "光线、雨量、道具状态与人物造型需连续"]]) , "衔接问题按镜头返工") +
              '</aside>' +
            '</div>'
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("video.filter", (el) => { App.set(SCOPE, "resFilter", el.dataset.value); App.refresh(); });
  App.on("video.toTasks", (el) => { const pid = el && el.dataset && el.dataset.pid; App.go("tasks/list", pid ? { id: pid } : undefined); });
  App.on("video.toAttempts", (el) => {
    App.set("tasks", "task", (el && el.dataset && el.dataset.id) || "");
    App.go("tasks/attempt");
  });
  App.on("video.tab", (el) => { App.set(SCOPE, "tab", el.dataset.value); App.refresh(); });
  App.on("video.toResults", (el) => {
    const q = App.current().query || {};
    const shot = D.shots.find(x => x.id === q.shot || x.no === q.shot);
    const pid = (el && el.dataset && el.dataset.id) || q.id || (shot && shot.project);
    App.set(SCOPE, "tab", "versions");
    App.go("video/preview", pid ? { id: pid } : undefined);
  });
  App.on("video.toPreview", (el) => {
    const shot = el && el.dataset ? el.dataset.shot : "";
    const hit = D.shots.find(x => x.id === shot || x.no === shot);
    App.set(SCOPE, "tab", "preview");
    App.go("video/preview", shot ? { shot: shot, id: (el.dataset.id || (hit && hit.project) || "") } : undefined);
  });
  App.on("video.toStoryboard", (el) => { App.set("director", "view", "board"); App.go("director/shots", { id: (el && el.dataset.id) || ((App.currentProject() || {}).id || "") }); });
  App.on("video.toModels", () => App.go(App.can("models.manage") ? "models/providers" : "models/config"));
  App.on("video.selectTask", (el) => { App.set(SCOPE, "task", el.dataset.id); App.refresh(); });
  App.on("video.closeAndGoAttempts", (el) => { App.set("tasks", "task", (el && el.dataset && el.dataset.id) || ""); App.closeDrawer(); App.go("tasks/attempt"); });
  App.on("video.playPreview", () => App.toast("原型未接入真实视频流；当前展示关键帧、时间线与契约校验"));
  App.on("video.preview", (el) => {
    const shot = el && el.dataset ? el.dataset.shot : "";
    const hit = D.shots.find(x => x.id === shot || x.no === shot);
    App.set(SCOPE, "tab", "preview");
    App.go("video/preview", { shot: shot, id: (el && el.dataset && el.dataset.id) || (hit && hit.project) || "" });
  });
})();


/* ===== v9.1 真实流程层：视频生产按任务 → 质检 → 资产持久化逐步执行 ===== */
(function () {
  const U = UI, D = DB;

  function frozenPid(pid) {
    const p = D.projects.find(x => x.id === pid);
    return p && ["已交付", "已归档"].indexOf(p.status) >= 0;
  }

  function shotOf(t) {
    const s = D.shots.find(x => x.id === t.shot);
    if (s) return s;
    return D.shots.find(x => x.project === t.project && x.ep === Number(t.ep) && x.no === t.shot) || null;
  }

  function normalize(t) {
    const s = shotOf(t);
    if (s && s.id !== t.shot) t.shot = s.id;
    return s;
  }

  function runOne(t) {
    normalize(t);
    const a = DB.state.runTask(t.id);
    if (!a.ok) return a;
    const q = DB.state.qcShot(t.shot);
    if (!q.ok) return { ok: true, msg: a.msg + "；" + q.msg };
    return { ok: true, msg: a.msg + "；" + q.msg };
  }

  App.on("video.runTask", (el) => {
    if (!App.guard("production.write")) return;
    const t = D.tasks.find(x => x.id === el.dataset.id);
    if (!t) return;
    normalize(t);
    if (t.status === "待质检") {
      App.job({ title: "镜头级质量检测", steps: ["读取契约检测项", "比对参考资产", "写入质量报告"], run() { return DB.state.qcShot(t.shot); } });
      return;
    }
    App.job({
      title: "执行生产任务 " + t.id, sub: "供应商调用 → 文件下载 → 资产持久化 → 镜头质检",
      steps: ["校验资源与依赖", "提交供应商调用", "下载并持久化结果", "镜头级质量检测"],
      run() { return runOne(t); }
    });
  });

  App.on("video.newBatch", (el) => {
    if (!App.guard("production.write")) return;
    const pid = (el && el.dataset.pid) || ((App.currentProject() || {}).id || "");
    const p = D.projects.find(x => x.id === pid);
    if (!p) { App.toast("未找到项目，无法建立生产批次", "bad"); return; }
    if (p.status !== "生产中") { App.toast("当前项目为「" + p.status + "」，只有「生产中」可以建立生成批次", "bad"); return; }
    const eps = D.episodes.filter(e => e.project === p.id && e.qc !== "PASS");
    if (!eps.length) { App.toast("该项目没有待生产分集", "bad"); return; }
    App.modal({
      title: "新建视频生成批次 · " + p.name, sub: "批次按集次组织，逐镜头执行并在成功后做镜头级质检",
      body: U.fSelect("集次", "ep", eps.map(e => ({ value: String(e.no), label: "E" + e.no + " · " + e.title + "（" + e.status + "）" })), { required: true }) +
        U.fField("并行上限", "parallel", { required: true, type: "number", min: 1, max: 4, value: "2", hint: "受资源配置与供应商配额共同限制" }) +
        U.fTextarea("批次说明", "note", { required: true, minlen: 8, rows: 3, placeholder: "例如：按场景顺序生产，优先高优先级镜头" }) +
        U.notice("批次只负责派发与排队；失败按 Attempt 计费，达上限转人工。", "info"),
      submitText: "建立批次并执行",
      onSubmit(d) {
        const ep = Number(d.ep);
        const shots = D.shots.filter(s => s.project === p.id && s.ep === ep && ["待生成", "待执行", "需复核", "待质检", "排队中"].indexOf(s.status) >= 0);
        if (!shots.length) { App.toast("该集没有可执行的镜头（可能已全部通过）", "bad"); return false; }
        return App.job({
          title: "执行 E" + ep + " 批次 · " + p.name, sub: "共 " + shots.length + " 个镜头；逐镜头提交 → 执行 → 质检",
          steps: ["提交批次与并行分组", "逐个镜头执行生成", "下载并持久化资产", "镜头级质量检测", "汇总批次结果"],
          run() {
            let okShot = 0, review = 0, blocked = [], cost = 0;
            const queue = [];
            shots.forEach(s => {
              if (s.status === "待质检") { const q = DB.state.qcShot(s.id); if (q.ok) okShot += 1; else review += 1; return; }
              const queued = D.tasks.find(t => t.shot === s.id && (t.status === "排队中" || t.status === "待执行"));
              if (queued) {
                queue.push(queued.id);
                return;
              }
              const sub = DB.state.submitTask({ project: p.id, shot: s.id, model: s.model && s.model !== "待选择" ? s.model : "视频模型 A", priority: "高" });
              if (!sub.ok) { blocked.push(s.id + "（" + sub.msg + "）"); return; }
              const run = DB.state.runTask(sub.data.id);
              cost += sub.data.actual || 0;
              if (!run.ok) { review += 1; return; }
              const q = DB.state.qcShot(s.id);
              if (q.ok) okShot += 1; else review += 1;
            });
            DB.state.log("项目 " + p.id, "执行 E" + ep + " 生产批次：" + d.note, okShot ? "成功" : "阻断", "batch-E" + ep);
            return {
              ok: okShot > 0 || review > 0,
              msg: "E" + ep + " 批次完成：通过 " + okShot + " 个 · 待判断 " + review + " 个 · 已排队待执行 " + queue.length + " 个 · 拦截 " + blocked.length + " 个" + (blocked.length ? "（" + blocked[0] + "）" : "") + "，实际扣费 ¥" + DB.state.money(cost)
            };
          }
        });
      }
    });
  });

  App.on("video.pauseQueue", (el) => {
    if (!App.guard("production.write")) return;
    const q = App.current().query || {};
    const pid = (el && el.dataset && el.dataset.pid) || q.id || ((App.currentProject() || {}).id || "");
    const key = "queuePaused:" + pid;
    const paused = App.get("video", key, false);
    const tasks = () => D.tasks.filter(t => t.project === pid && t.kind === "视频生成");
    if (paused) {
      App.confirm("恢复生产队列", "恢复后，本项目因队列暂停而转为「已暂停」的视频任务会重新排队；人工暂停或异常任务不自动恢复。", () => {
        App.set("video", key, false);
        const n = tasks().filter(t => t.status === "已暂停").length;
        tasks().filter(t => t.status === "已暂停").forEach(t => { t.status = "排队中"; });
        DB.state.log("生产队列", pid + " 恢复队列（" + n + " 个任务）", "成功", "queue");
        App.toast("已恢复 " + n + " 个视频任务"); App.refresh();
      }, "恢复队列");
      return;
    }
    App.confirm("暂停生产队列", "只暂停本项目排队中的视频生成任务；执行中任务按供应商能力自然结束，其他项目队列不受影响。", () => {
      App.set("video", key, true);
      const n = tasks().filter(t => t.status === "排队中").length;
      tasks().filter(t => t.status === "排队中").forEach(t => { t.status = "已暂停"; });
      DB.state.log("生产队列", pid + " 暂停队列（影响 " + n + " 个视频任务）", "成功", "queue");
      App.toast("本项目队列已暂停，受影响任务 " + n + " 个"); App.refresh();
    }, "暂停队列");
  });

  App.on("video.taskDetail", (el) => {
    const t = D.tasks.find(x => x.id === el.dataset.id);
    if (!t) return;
    const acts = [];
    if (["排队中", "待执行", "失败", "待质检"].indexOf(t.status) >= 0) acts.push(U.btn("执行", "video.runTask", "primary", { id: t.id }));
    if (t.status === "待人工处理" || t.status === "失败") acts.push(U.btn("处理失败", "video.handleFail", "primary", { id: t.id }));
    if (t.status !== "成功" && t.status !== "已取消") acts.push(U.btn("取消任务", "video.cancelTask", "sm", { id: t.id }));
    App.closeDrawer();
    App.drawer("任务 · " + t.id, U.desc([["项目 / 集 / 场 / 镜头", t.project + " · E" + t.ep + " / S" + t.scene + " / " + t.shot], ["类型 · 状态", t.kind + " · " + t.status], ["优先级 · 依赖", t.priority + " · " + (t.deps.join("；") || "无")], ["输入", t.input], ["输出", t.output], ["模型 / 配置", t.model + " · " + t.config], ["执行人 / 资源归属", t.executor + " / " + t.resourceOwner], ["尝试 / 上限", t.attempt + " / " + t.maxAttempts], ["预计 / 实际", "¥" + t.est + " / ¥" + t.actual], ["失败原因 · 质量", t.failReason + " · " + t.qc]]) +
      '<div class="btn-row-inline">' + acts.join("") + U.btn("查看尝试记录", "video.closeAndGoAttempts", "sm", { id: t.id }) + "</div>");
  });

  App.on("video.cancelTask", (el) => {
    if (!App.guard("production.write")) return;
    App.closeDrawer();
    const t = D.tasks.find(x => x.id === el.dataset.id);
    App.modal({
      title: "取消任务 · " + t.id, sub: "取消需要理由；已产生的费用仍入账，不因取消而丢弃",
      body: U.fSelect("取消原因", "reason", ["素材错误", "需求变更", "预算收回", "重复提交", "其他"], { required: true }) +
        U.fTextarea("补充说明", "note", { required: true, minlen: 8, rows: 3 }),
      submitText: "确认取消",
      onSubmit(d) { return App.job({ title: "取消任务", steps: ["校验任务状态", "写入取消原因", "结算已发生费用"], run() { return DB.state.cancelTask(t.id, d.reason + "：" + d.note); } }); }
    });
  });

  App.on("video.handleFail", (el) => {
    if (!App.guard("production.write")) return;
    const t = D.tasks.find(x => x.id === el.dataset.id);
    if (!t) return;
    if (frozenPid(t.project)) { App.toast("项目已交付，任务只读；变更需新建版本链", "bad"); return; }
    normalize(t);
    const ways = ["调整提示词后重试", "替换参考资产后重试", "切换备用模型（需兼容校验）", "接受当前结果并记录", "取消该镜头"];
    App.modal({
      title: "处理失败任务 · " + t.id, sub: t.failReason,
      body: U.fSelect("处理方式", "way", ways, { required: true }) +
        U.fTextarea("处理说明", "note", { required: true, minlen: 8, rows: 3, placeholder: "说明根因与下一步；不得只写「重试」" }) +
        U.notice("重试创建新 Attempt，原失败记录与费用保留；切换模型先做兼容校验。", "warn"),
      submitText: "提交处理",
      onSubmit(d) {
        return App.job({
          title: "处理失败任务", steps: ["校验处理方式", "写入处理记录", "更新任务状态"],
          run() {
            if (d.way === ways[2]) {
              const r = DB.state.switchModel(t.id, "视频模型 B（备用）");
              if (!r.ok) return r;
              return { ok: true, msg: r.msg };
            }
            if (d.way === ways[4]) return DB.state.cancelTask(t.id, "人工取消：" + d.note);
            if (d.way === ways[3]) {
              t.status = "成功"; t.qc = "REVIEW_REQUIRED"; t.failReason = d.note;
              const s = D.shots.find(x => x.id === t.shot);
              if (s) { s.status = "已通过"; s.qc = "REVIEW_REQUIRED"; }
              DB.state.log("任务 " + t.id, "接受当前结果并记录理由：" + d.note, "成功", t.id);
              return { ok: true, msg: "已接受当前结果，理由已写入质量与审计记录" };
            }
            const r = DB.state.retryTask(t.id);
            if (r.ok) DB.state.log("任务 " + t.id, "按处理方式重试：" + d.way + " · " + d.note, "成功", t.id);
            return r;
          }
        });
      }
    });
  });

  App.on("video.adopt", (el) => {
    if (!App.guard("production.write")) return;
    const s = D.shots.find(x => x.id === el.dataset.shot);
    if (s && frozenPid(s.project)) { App.toast("项目已交付，镜头只读；变更需新建版本链", "bad"); return; }
    App.modal({
      title: "设为采用版本", sub: (s ? s.no : "该镜头") + " " + (el.dataset.v || "") + " 将成为下游时间线引用版本",
      body: U.fTextarea("采用依据", "note", { required: true, minlen: 8, rows: 3, placeholder: "例如：与相邻镜头衔接自然，抽检通过" }),
      submitText: "设为采用",
      onSubmit(d) {
        return App.job({
          title: "设置采用版本", steps: ["校验版本状态", "写入采用关系", "更新镜头与资产引用"],
          run() {
            if (s) { s.version = (el.dataset.v || "v1") + " 采用"; s.status = "已通过"; }
            DB.state.log("镜头 " + (s ? s.id : "—"), "采用版本 " + (el.dataset.v || "v1") + "：" + d.note, "成功", s ? s.id : "—");
            return { ok: true, msg: "已设为采用版本" };
          }
        });
      }
    });
  });

  App.on("video.adoptCurrent", (el) => {
    if (!App.guard("production.write")) return;
    const s = D.shots.find(x => x.id === el.dataset.id);
    if (!s) return;
    if (frozenPid(s.project)) { App.toast("项目已交付，镜头只读；变更需新建版本链", "bad"); return; }
    App.modal({
      title: "接受当前结果 · " + s.id, sub: "接受缺陷必须说明为什么可接受，否则视为掩盖",
      body: U.fSelect("缺陷项", "item", ["人物一致性偏移", "场景光线偏差", "画面轻微异常", "口型偏差"], { required: true }) +
        U.fTextarea("接受理由", "note", { required: true, minlen: 10, rows: 3, placeholder: "例如：该镜头为 3 秒过场，眉疤不可见且不影响叙事" }) +
        U.fCheck("已通知项目负责人", "notify", { checked: true }),
      submitText: "记录并接受",
      onSubmit(d) {
        return App.job({
          title: "接受并记录理由", steps: ["校验理由完整性", "写入质量报告", "更新镜头状态"],
          run() {
            s.status = "已通过"; s.qc = "REVIEW_REQUIRED";
            D.qualityIssues.unshift({ report: "ACCEPT-" + s.id, dim: d.item, where: s.id, level: "低", action: "接受现状（已记录理由）", auto: "否", decision: "accept", note: d.note, by: DB.state.actor(), at: DB.state.at() });
            DB.state.log("镜头 " + s.id, "接受缺陷：" + d.item + " · " + d.note, "成功", s.id);
            return { ok: true, msg: "已接受并写入质量报告与审计" };
          }
        });
      }
    });
  });

  App.on("video.regenShot", (el) => {
    if (!App.guard("production.write")) return;
    const s = D.shots.find(x => x.id === el.dataset.id);
    if (!s) return;
    if (frozenPid(s.project)) { App.toast("项目已交付，镜头只读；变更需新建版本链", "bad"); return; }
    App.modal({
      title: "局部重生成 · " + s.id, sub: "按当前契约新建尝试，原结果与费用保留；单独计费",
      body: U.fSelect("问题类型", "type", ["画面异常", "人物不一致", "动作不符", "时长不符", "合规风险"], { required: true }) +
        U.fTextarea("调整说明", "note", { required: true, minlen: 8, rows: 3 }) +
        U.notice("返工必须指定问题镜头与问题类型（业务方案 §8.3）；不得因单个镜头问题无条件重做整集或整剧。", "warn"),
      submitText: "创建重生成",
      onSubmit(d) {
        return App.job({
          title: "创建重生成任务", steps: ["校验镜头状态", "创建任务并排队", "登记返工台账"],
          run() {
            const r = DB.state.submitTask({ project: s.project, shot: s.id, model: s.model && s.model !== "待选择" ? s.model : "视频模型 A", priority: "高" });
            if (r.ok) {
              DB.state.log("镜头 " + s.id, "局部重生成（" + d.type + "）：" + d.note, "成功", r.data.id);
              /* 返工台账登记问题类型；返工量计入返工率，不计入新增生成量（业务方案 §11.5） */
              const n = D.reworkLedger.length + 1;
              D.reworkLedger.unshift({ id: "RW-SHOT-" + (100 + n), project: s.project, target: s.id, type: d.type, round: 1, cost: r.data.est || 0, old: "旧版本与费用保留", status: "进行中", at: DB.state.at() });
            }
            return r;
          }
        });
      }
    });
  });
})();

