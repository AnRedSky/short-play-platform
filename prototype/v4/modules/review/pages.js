/* ============================================================
   模块：生成与审核（review）
   AI 任务 / 质检审核 / 剪辑时间线
   ============================================================ */
(function () {
  function st() { return App.state; }
  var taskFilter = "all";
  var taskTimer = null;
  var selectedClip = null;
  var zoom = 1;
  var playhead = 14;

  /* ================= 任务中心 ================= */
  function tasksPage() {
    var s = st();
    var counts = { all: s.tasks.length, running: 0, queued: 0, failed: 0, succeeded: 0 };
    s.tasks.forEach(function (t) { counts[t.status] = (counts[t.status] || 0) + 1; });
    var list = s.tasks.filter(function (t) { return taskFilter === "all" || t.status === taskFilter; });
    var tabs = UI.tabs([{ key: "all", label: "全部", count: counts.all }, { key: "running", label: "运行中", count: counts.running }, { key: "queued", label: "排队", count: counts.queued }, { key: "failed", label: "失败", count: counts.failed }, { key: "succeeded", label: "已完成", count: counts.succeeded }], taskFilter, "tfilter");
    var rows = list.map(function (t) {
      var pct = t.progress || 0;
      return '<tr data-task="' + t.id + '"><td><span class="mono tiny">' + t.id + '</span><span class="t-sub">' + UI.esc(t.type) + "</span></td>" +
        '<td><span class="t-strong">' + UI.esc(t.name) + '</span><span class="t-sub">' + UI.esc(t.target) + "</span></td>" +
        '<td><div class="task-progress">' + UI.progress(pct, t.status === "failed" ? "dark" : "") + '<span class="tiny muted">' + pct + '%</span></div></td>' +
        '<td>' + UI.statusBadge(t.status) + "</td><td><span class=\"mono tiny\">" + UI.esc(t.model) + '</span><span class="t-sub">' + UI.esc(t.started) + "</span></td>" +
        '<td><div class="cell-actions">' + (t.status === "failed" ? '<button class="btn btn-xs" data-act="retry" data-id="' + t.id + '">重试</button>' : "") +
        (t.status === "running" || t.status === "queued" ? '<button class="btn btn-xs" data-act="cancel" data-id="' + t.id + '">取消</button>' : "") +
        '<button class="btn btn-xs" data-act="detail" data-id="' + t.id + '">详情</button></div></td></tr>';
    }).join("");
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "AI operations", title: "AI 任务中心", desc: "所有生成、质检与解析任务共用队列。失败任务保留诊断信息，可调整参数后重试。",
        actions: (App.hasPerm("task:run") ? '<button class="btn btn-primary" data-act="new">' + UI.icon("plus") + "新建任务</button>" : '<span class="badge b-locked">只读身份</span>') }) +
      '<div class="grid g4 mb-16">' + UI.stat({ label: "队列槽位", value: "3", unit: "并发", delta: "1 空闲 · 2 占用" }) +
      UI.stat({ label: "运行中", value: String(counts.running + counts.queued), unit: "个", delta: "自动刷新进度" }) +
      UI.stat({ label: "失败", value: String(counts.failed), unit: "个", delta: "2 个可重试" }) +
      UI.stat({ label: "今日成本", value: "¥8.42", delta: "预算剩余 ¥5,158" }) + "</div>" +
      '<div class="card"><div class="card-head"><div><h3>任务队列</h3><div class="ch-sub">运行中任务每 3 秒推进一次；关闭页面即停止</div></div><span class="badge b-active"><span class="pulse"></span> ' + (counts.running + counts.queued) + " 个活动任务</span></div>" +
      '<div class="card-body tight">' + tabs + '<div class="table-wrap"><table><thead><tr><th>任务</th><th>对象</th><th>进度</th><th>状态</th><th>模型 / 开始</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      (list.length ? "" : UI.empty("没有符合条件的任务", "切换状态筛选，或新建一个生成任务。")) + "</div></div>" +
      '<div class="grid g-2-1 mt-16"><div class="card"><div class="card-head"><h3>队列槽位</h3><span class="tiny muted">3 并发 · 2 占用</span></div><div class="card-body"><div class="queue-grid">' +
      '<div class="queue-slot"><div class="qs-top"><span>槽位 1</span><span class="dot on"></span></div><div class="qs-main">T-2041 视频生成</div><div class="tiny muted">mork-video-2 · 1080p</div><div class="mt-8">' + UI.progress(32) + "</div></div>" +
      '<div class="queue-slot"><div class="qs-top"><span>槽位 2</span><span class="dot on"></span></div><div class="qs-main">T-2040 配音合成</div><div class="tiny muted">moss-tts-cn · 19 条</div><div class="mt-8">' + UI.progress(0) + "</div></div>" +
      '<div class="queue-slot" style="border-style:dashed"><div class="qs-top"><span>槽位 3</span><span class="dot"></span></div><div class="qs-main muted">空闲</div><div class="tiny muted">下一任务可直接开始</div></div></div></div></div>' +
      '<div class="card"><div class="card-head"><h3>失败诊断</h3><a class="btn btn-xs" href="' + App.link("review/tasks") + '" data-act="only-failed">只看失败</a></div><div class="card-body">' +
      (s.tasks.filter(function (t) { return t.status === "failed"; }).map(function (t) {
        return '<div class="list-row"><span style="color:var(--danger)">' + UI.icon("alert", 15) + '</span><span class="lr-main"><span class="lr-title">' + t.id + " · " + UI.esc(t.error || "任务失败") + '</span><span class="lr-sub">' + UI.esc(t.target) + " · " + UI.esc(t.model) + '</span></span><button class="btn btn-xs" data-act="retry" data-id="' + t.id + '">重试</button></div>';
      }).join("") || UI.empty("没有失败任务", "队列运行正常。")) + "</div></div></div></div>";
  }

  function taskDetail(id) {
    var t = st().tasks.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    var body = '<div class="row mb-12">' + UI.statusBadge(t.status) + '<span class="tag">' + UI.esc(t.type) + '</span><span class="tag">' + UI.esc(t.model) + "</span></div>" +
      '<div class="kv"><div class="k">目标</div><div class="v">' + UI.esc(t.target) + '</div><div class="k">开始</div><div class="v">' + UI.esc(t.started) + '</div><div class="k">耗时</div><div class="v">' + UI.esc(t.duration) + '</div><div class="k">成本</div><div class="v">¥' + t.cost.toFixed(2) + '</div><div class="k">进度</div><div class="v">' + t.progress + "%</div></div>" +
      (t.error ? '<div class="notice danger mt-12">' + UI.icon("alert", 15) + "<span>" + UI.esc(t.error) + "</span></div>" : "") +
      '<div class="eyebrow mt-16">事件流</div><div class="export-log mt-8" style="max-height:220px">' + t.logs.map(function (l) { return "<div>[" + l[0] + "] " + UI.esc(l[1]) + "</div>"; }).join("") + "</div>";
    App.drawer({
      eyebrow: "Task runtime", title: t.id, sub: t.name, body: body,
      footer: '<button class="btn" data-close>关闭</button>' + (t.status === "failed" ? '<button class="btn btn-primary" data-act-detail="retry">重试任务</button>' : ""),
      onMount: function (el, close) {
        var b = el.querySelector("[data-act-detail='retry']");
        if (b) b.addEventListener("click", function () { close(); retryTask(t.id); });
      }
    });
  }

  function retryTask(id) {
    var t = st().tasks.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    t.status = "queued"; t.progress = 0; t.started = App.nowStamp(); t.duration = "—"; t.error = "";
    t.logs.push([App.nowStamp(), "重新入队，冻结失败时的输入版本"]);
    App.refresh(); App.toast("已重新排队", id + " 将在空闲槽位开始。", "success");
  }

  function cancelTask(id) {
    var t = st().tasks.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    App.confirm({ title: "取消任务", message: "取消 " + id + "？", detail: "已产生的中间产物会保留，不会回滚已消耗的成本。", danger: true, okText: "取消任务" }).then(function (ok) {
      if (!ok) return;
      t.status = "cancelled"; t.progress = 0; t.logs.push([App.nowStamp(), "用户取消任务"]);
      App.refresh(); App.toast("任务已取消", id, "warn");
    });
  }

  function newTask() {
    var caps = ["视频生成", "图像生成", "文本生成", "语音合成", "质检"];
    var models = { "视频生成": ["mork-video-2"], "图像生成": ["mork-image-3"], "文本生成": ["mork-llm-7b"], "语音合成": ["moss-tts-cn"], "质检": ["qa-rules-2026.11"] };
    var opt = function (cap) { return '<option value="' + cap + '">' + cap + "</option>"; };
    var body = '<div class="form-grid"><div class="field"><label>能力</label><select class="select" id="ntCap">' + caps.map(opt).join("") + "</select></div>" +
      '<div class="field"><label>模型</label><select class="select" id="ntModel">' + models["视频生成"].map(function (m) { return "<option>" + m + "</option>"; }).join("") + "</select></div>" +
      '<div class="field span2"><label>任务对象</label><input class="input" id="ntTarget" value="EP01 / S0107 · 雨巷追踪"></div>' +
      '<div class="field span2"><label>备注</label><textarea class="textarea" id="ntNote" rows="2" placeholder="可选：说明这次重跑的原因或参数调整。"></textarea></div></div>' +
      '<div class="notice info mt-12">' + UI.icon("spark", 15) + "<span>创建后会进入队列。原型每 3 秒推进一次进度，刷新页面重置。</span></div>";
    App.modal({
      title: "新建任务", sub: "能力 → 模型 → 对象", size: "lg", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="ntGo">加入队列</button>',
      onMount: function (el, close) {
        el.querySelector("#ntCap").addEventListener("change", function () {
          var list = models[this.value] || [];
          el.querySelector("#ntModel").innerHTML = list.map(function (m) { return "<option>" + m + "</option>"; }).join("");
        });
        el.querySelector("#ntGo").addEventListener("click", function () {
          var cap = el.querySelector("#ntCap").value, model = el.querySelector("#ntModel").value, target = el.querySelector("#ntTarget").value.trim();
          var t = {
            id: "T-" + (2050 + st().tasks.length), name: cap + " · " + target, type: cap, model: model,
            status: "queued", progress: 0, cost: 0.12, started: App.nowStamp(), duration: "—", target: target,
            logs: [[App.nowStamp(), "任务已创建"], [App.nowStamp(), "进入队列，等待并发槽位"]]
          };
          st().tasks.unshift(t);
          close(); App.refresh(); App.toast("任务已创建", t.id + " 已进入队列。", "success");
        });
      }
    });
  }

  /* ================= 质检审核 ================= */
  function qaPage() {
    var s = st(), q = s.qa;
    var approved = q.status === "approved", rejected = q.status === "rejected";
    var checks = q.items.map(function (it) {
      return '<div class="qa-check"><span class="' + (it.result === "PASS" ? "ok" : "warn") + '">' + UI.icon(it.result === "PASS" ? "check" : "alert", 14) + '</span><span class="qc-main"><span>' + UI.esc(it.name) + '</span><span class="qc-sub">' + UI.esc(it.note) + '</span></span><span class="mono tiny">' + it.score + "</span></div>";
    }).join("");
    var comments = q.comments.map(function (c) {
      return '<div class="comment-row"><div class="comment-head">' + UI.avatar(c.author, "sm") + "<b>" + UI.esc(c.author) + "</b><span>" + UI.esc(c.role) + "</span><span>" + UI.esc(c.time) + "</span>" +
        '<span class="badge ' + (c.level === "需修改" ? "b-danger" : "b-todo") + '" style="margin-left:auto">' + UI.esc(c.level) + "</span></div>" +
        '<div class="comment-text">' + UI.esc(c.text) + '</div><div class="tiny muted">' + UI.esc(c.shot) + (c.resolved ? " · 已解决" : "") + "</div></div>";
    }).join("");
    var decision = '<div class="gate-card ' + (approved ? "ok" : "") + '"><div class="eyebrow">Review decision</div>' +
      '<div class="between mt-8"><div><b>' + (approved ? "已通过终审" : rejected ? "已退回修改" : "等待终审") + "</b><div class=\"tiny muted\">" + (approved ? "时间线与导出已解锁" : "通过后解锁时间线与导出") + "</div></div>" + UI.statusBadge(q.status) + "</div>" +
      '<div class="stack mt-12">' + (App.hasPerm("qa:review") && !approved ? '<button class="btn btn-primary btn-block" data-act="approve">' + UI.icon("check") + "通过审核</button>" : "") +
      (App.hasPerm("qa:review") && !rejected ? '<button class="btn btn-block" data-act="reject">退回修改</button>' : "") +
      '<button class="btn btn-block" data-act="download">' + UI.icon("download") + "下载审核报告</button></div>" +
      '<div class="tiny muted mt-12">' + (approved ? "EP01 已通过，可前往导出交付。" : "只有 PASS 才允许进入导出。") + "</div></div>";

    return '<div class="page">' +
      UI.pageHead({ eyebrow: "QA & review · EP01", title: "质检与审核", desc: "9:16 成片预览 + QA 规则结果 + 人工终审。审核结论会同步到流水线与导出 gate。",
        actions: '<span class="badge b-warn">QA 94 分</span><button class="btn" data-act="requalify">' + UI.icon("refresh") + "重新质检</button>" + (App.hasPerm("qa:review") && !approved ? '<button class="btn btn-primary" data-act="approve">' + UI.icon("check") + "通过审核</button>" : "") }) +
      '<div class="qa-grid"><div><div class="qa-video-card"><div class="player" style="background-image:url(' + UI.scene("bookstore") + ')"><span class="pl-scene">EP01 · S0109 · 00:42</span>' +
      '<div class="pl-caption">别翻下一页。</div><div class="pl-controls"><div class="pl-scrub" data-act="seek"><i id="scrubBar"></i></div><div class="pl-row"><button class="pl-play" data-act="play">' + UI.icon("play", 10) + '</button><span id="ptime">00:42 / 01:32</span><span style="margin-left:auto">9:16 · 1080p</span></div></div></div>' +
      '<div class="between mt-12"><div><b class="small">EP01 · 雨夜书店</b><div class="tiny muted">粗剪 v4 · 92s · 30fps</div></div><a class="btn btn-sm" href="' + App.link("review/timeline") + '">打开时间线</a></div></div>' +
      '<div class="card mt-16"><div class="card-head"><h3>质检项目</h3><span class="tiny muted">' + q.rule + " · " + q.checkedAt + '</span></div><div class="card-body tight">' + checks + "</div></div></div>" +
      '<div><div class="card"><div class="card-head"><div><h3>QA 结论</h3><div class="ch-sub">自动规则 + 人工复核</div></div></div><div class="card-body">' +
      '<div class="qa-score">' + UI.ring(94, 64) + '<div><div class="qs-num">94</div><div class="tiny muted">综合评分 · 5 项检查</div><div class="row mt-8">' + UI.badge("4 PASS", "b-done") + UI.badge("1 REVIEW", "b-warn") + "</div></div></div>" +
      '<div class="notice warn mt-12">' + UI.icon("alert", 15) + "<span>时序与节奏：第 5 场到第 6 场转场偏快，建议延长 0.4s。</span></div></div></div>" +
      decision + '<div class="card mt-16"><div class="card-head"><div><h3>批注</h3><div class="ch-sub">' + q.comments.length + " 条 · " + q.comments.filter(function (c) { return !c.resolved; }).length + ' 条未解决</div></div><button class="btn btn-xs" data-act="composer">添加批注</button></div><div class="card-body tight">' + comments + "</div>" +
      '<div class="card-foot" id="composerWrap" style="display:none"><div class="field" style="flex:1"><textarea class="textarea" id="commentText" rows="2" placeholder="描述问题、镜头与建议…"></textarea></div><button class="btn btn-primary" data-act="add-comment">保存</button></div></div>' +
      "</div></div></div>";
  }

  function addComment() {
    var wrap = document.getElementById("composerWrap");
    if (wrap) wrap.style.display = "flex";
    setTimeout(function () { var t = document.getElementById("commentText"); if (t) t.focus(); }, 20);
  }

  function saveComment() {
    var text = (document.getElementById("commentText") || {}).value || "";
    if (!text.trim()) { App.toast("无法保存", "批注内容不能为空。", "danger"); return; }
    st().qa.comments.push({ id: "c" + Date.now(), time: "01:08", shot: "S0109", author: App.currentUser.name, role: App.currentUser.role, text: text.trim(), level: "需修改", resolved: false });
    App.refresh(); App.toast("批注已添加", "已同步给导演与剪辑。", "success");
  }

  function approve() {
    App.confirm({
      title: "通过终审", message: "确认 EP01 通过质检，并解锁时间线与导出？", detail: "通过后本集状态变为「已通过」；后续修改需重新质检。", okText: "通过并解锁"
    }).then(function (ok) {
      if (!ok) return;
      var s = st();
      s.qa.status = "approved"; s.pipeline.qa = "done"; s.pipeline.timeline = "active"; s.pipeline.export = "active";
      s.timeline.approved = true; s.episodes[0].qa = 94;
      s.activity.unshift([App.nowStamp(), App.currentUser.name, "EP01 通过终审，解锁时间线与导出", "ok"]);
      App.refresh(); App.toast("已通过终审", "时间线与导出已解锁，可创建交付任务。", "success");
    });
  }

  function reject() {
    var body = '<div class="field"><label>退回原因<span class="req">*</span></label><textarea class="textarea" id="rejectReason" rows="4" placeholder="写明具体镜头、问题与修改建议。"></textarea><span class="err-msg" id="rjErr">请填写退回原因</span></div>' +
      '<div class="notice warn mt-12">' + UI.icon("alert", 15) + "<span>退回会锁定时间线与导出，并生成返工任务。</span></div>";
    App.modal({
      title: "退回修改", sub: "EP01 · 雨夜书店", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-danger" id="rjGo">确认退回</button>',
      onMount: function (el, close) {
        el.querySelector("#rjGo").addEventListener("click", function () {
          var reason = el.querySelector("#rejectReason").value.trim();
          if (!reason) { el.querySelector("#rjErr").classList.add("show"); return; }
          var s = st();
          s.qa.status = "rejected"; s.qa.reviewerNote = reason;
          s.pipeline.timeline = "locked"; s.pipeline.export = "locked"; s.timeline.approved = false;
          s.tasks.unshift({ id: "T-2051", name: "返工 · EP01 S0109 审讯对视", type: "视频生成", model: "mork-video-2", status: "queued", progress: 0, cost: 0, started: App.nowStamp(), duration: "—", target: "EP01 / S0109", logs: [[App.nowStamp(), "由审核退回自动生成"], [App.nowStamp(), reason]] });
          close(); App.refresh(); App.toast("已退回", "时间线与导出已锁定，返工任务 T-2051 已创建。", "warn");
        });
      }
    });
  }

  function requalify() {
    var body = '<div class="notice info">' + UI.icon("refresh", 15) + "<span>重新运行 5 项 QA 规则：画面、角色、字幕、节奏、安全。</span></div><div class=\"mt-16\" id=\"rqBar\">" + UI.progress(0) + "</div>";
    App.modal({
      title: "重新质检", sub: "qa-rules-2026.11", body: body, footer: '<button class="btn" data-close>后台运行</button>',
      onMount: function (el, close) {
        var p = 0, timer = setInterval(function () {
          p += 20; var b = el.querySelector("#rqBar .progress > i"); if (b) b.style.width = p + "%";
          if (p >= 100) {
            clearInterval(timer);
            st().qa.status = "review"; st().qa.score = 96; st().qa.checkedAt = "刚刚";
            setTimeout(function () { close(); App.refresh(); App.toast("质检完成", "综合评分 96 · 1 项建议调整，等待终审。", "success"); }, 300);
          }
        }, 320);
      }
    });
  }

  function downloadReport() {
    var q = st().qa;
    var txt = "长夜制作台 · EP01 审核报告\n\n项目：长夜将明（NYJM-26）\n集数：EP01 雨夜书店\n审核人：" + (q.reviewer || "周可") + "\n结论：" + q.status + "\n综合评分：" + q.score + "\n规则：" + q.rule + "\n时间：" + q.checkedAt + "\n\n检查项：\n" +
      q.items.map(function (x, i) { return (i + 1) + ". " + x.name + " · " + x.result + " · " + x.score + " 分\n   " + x.note; }).join("\n") +
      "\n\n批注：\n" + q.comments.map(function (c, i) { return (i + 1) + ". [" + c.time + " / " + c.shot + "] " + c.author + "：" + c.text; }).join("\n") +
      "\n\n说明：这是纯静态原型的演示报告，不含真实视频文件。\n";
    App.download("EP01_审核报告_" + (q.status === "approved" ? "通过" : "待审") + ".txt", txt);
    App.toast("报告已下载", "EP01_审核报告.txt", "success");
  }

  /* ================= 时间线 ================= */
  function timelinePage() {
    var tl = st().timeline;
    var approved = st().qa.status === "approved";
    var scale = 9 * zoom;
    var totalPx = Math.round(tl.duration * scale);
    var tracks = tl.tracks.map(function (tr) {
      var clips = tr.clips.map(function (c) {
        var sel = selectedClip && selectedClip.track === tr.id && selectedClip.clip === c.id;
        return '<div class="tl-clip ' + tr.type + (sel ? " selected" : "") + '" data-track="' + tr.id + '" data-clip="' + c.id + '" style="left:' + Math.round(c.start * scale) + "px;width:" + Math.round(c.dur * scale) + 'px;cursor:grab" title="' + UI.esc(c.name) + '">' +
          '<div class="c-name">' + UI.esc(c.name) + '</div><div class="c-meta">' + c.start.toFixed(1) + "s · " + c.dur + "s</div></div>";
      }).join("");
      return '<div class="tl-track" data-track-row="' + tr.id + '" style="width:' + totalPx + 'px">' + clips + "</div>";
    }).join("");
    var ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(function (s) {
      return '<span style="left:' + Math.round(s * scale) + 'px">' + s + "s</span>";
    }).join("");
    var selected = null, track = null;
    if (selectedClip) {
      track = tl.tracks.filter(function (x) { return x.id === selectedClip.track; })[0];
      selected = track && track.clips.filter(function (x) { return x.id === selectedClip.clip; })[0];
    }
    var inspector = selected ? '<div class="inspector-block"><div class="between"><h4>' + UI.esc(selected.name) + "</h4>" + UI.badge(track.type, "b-teal") + "</div>" +
      '<div class="kv mt-8"><div class="k">起点</div><div class="v mono">' + selected.start.toFixed(1) + 's</div><div class="k">时长</div><div class="v mono">' + selected.dur + 's</div><div class="k">源</div><div class="v mono">' + UI.esc(selected.source) + "</div></div>" +
      (track.type === "sub" ? '<div class="field mt-12"><label>字幕文本</label><textarea class="textarea" id="subText" rows="3">' + UI.esc(selected.name.indexOf("片名") > -1 ? "长夜将明" : "别翻下一页。") + '</textarea></div><button class="btn btn-sm btn-primary mt-8" data-act="save-sub">保存字幕</button>' : "") +
      "</div>" : '<div class="inspector-block"><div class="tiny muted">点击片段查看属性；拖动片段改变起点，超过相邻片段会自动吸附。</div></div>';
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Timeline · EP01", title: "剪辑时间线", desc: "4 轨 · 18 个片段 · 92 秒。拖动片段、缩放刻度、调整字幕，保存版本后进入导出。",
        actions: '<span class="badge ' + (approved ? "b-done" : "b-warn") + '">' + (approved ? "质检已通过" : "质检未通过") + '</span><button class="btn" data-act="save-version">' + UI.icon("plus") + "保存版本</button>" }) +
      (approved ? "" : '<div class="notice warn mb-12">' + UI.icon("lock", 15) + '<span>质检通过后才能发布导出。当前可查看与排练时间线，保存版本仅记录草稿。</span></div>') +
      '<div class="timeline-layout"><div class="tl-preview"><div class="poster" style="background-image:url(' + UI.scene("bookstore") + ')"><span class="p-no">EP01</span><span class="p-label">粗剪 v4 · 92s</span></div>' +
      '<div class="row mt-8" style="justify-content:space-between"><span class="tiny muted">00:' + String(playhead).padStart(2, "0") + '</span><span class="tiny muted">01:32</span></div></div>' +
      '<div><div class="tl-shell"><div class="tl-toolbar"><button class="tl-btn" data-act="play">' + UI.icon("play", 11) + '</button><span class="tl-tc">TC 00:00:' + String(playhead).padStart(2, "0") + ':00</span>' +
      '<span class="tiny">V2 · 主画面 / A1 对白</span><div class="spacer"></div><span class="tiny">缩放</span><input type="range" class="tl-zoom" min="1" max="2.5" step=".1" value="' + zoom + '" data-zoom>' +
      '<button class="tl-btn" data-act="fit">适配</button></div><div class="tl-ruler" style="width:' + totalPx + 'px">' + ticks + '</div><div class="tl-body"><div class="tl-heads">' +
      tl.tracks.map(function (tr) { return '<div class="th"><span class="dot" style="background:' + (tr.type === "video" ? "#8b7357" : tr.type === "sub" ? "#6f5b79" : "#4f6d84") + '"></span>' + UI.esc(tr.name) + (tr.type === "video" ? '<span class="lock">' + UI.icon("lock", 10) + "</span>" : "") + "</div>"; }).join("") +
      '</div><div class="tl-tracks">' + tracks + '<div class="tl-playhead" style="left:' + Math.round(playhead * scale) + 'px"></div></div></div></div>' +
      '<div class="row mt-12" style="justify-content:space-between"><span class="tiny muted">拖动片段：改变起点 · 右侧边缘拖动：改变时长 · 滚轮横向滚动</span><span class="tiny muted">18 个片段 · 4 轨</span></div></div>' +
      '<div class="tl-inspector"><div class="inspector-block"><div class="between"><h4>版本</h4><span class="tag">' + UI.esc(tl.version) + '</span></div><div class="tiny muted">' + UI.esc(tl.name) + " · " + tl.duration + "s · " + tl.fps + "fps</div><div class=\"tl-sum mt-8\">V2 主画面 7 段 · 字幕 3 段 · 对白 5 段 · 环境 3 段</div></div>" +
      inspector + '<div class="inspector-block"><h4>导出前检查</h4>' +
      [["画面全部生成", true], ["字幕 19 条已校对", true], ["对白音轨完整", true], ["质检 gate", approved]].map(function (c) {
        return '<div class="check-row"><span class="' + (c[1] ? "ok" : "warn") + '">' + UI.icon(c[1] ? "check" : "lock", 13) + "</span><span>" + c[0] + "</span></div>";
      }).join("") + '<a class="btn btn-primary btn-block mt-12" href="' + App.link("delivery/export") + '"' + (approved ? "" : ' aria-disabled="true"') + ">前往导出</a></div></div></div></div>";
  }

  function saveTimelineVersion() {
    var tl = st().timeline;
    var n = parseInt(String(tl.version).replace(/[^0-9]/g, ""), 10) + 1;
    tl.version = "TL v" + n;
    st().activity.unshift([App.nowStamp(), App.currentUser.name, "保存 " + tl.version + " 时间线版本", "script"]);
    App.refresh(); App.toast("版本已保存", tl.version + " 已记录；剪辑版本会随导出冻结。", "success");
  }

  AppModule.register({
    group: "review", label: "生成与审核", icon: "spark",
    routes: [
      { path: "review/tasks", title: "AI 任务中心", icon: "spark", badge: "tasks", render: tasksPage,
        mount: function (root) {
          if (taskTimer) clearInterval(taskTimer);
          taskTimer = setInterval(function () {
            if (!App.currentRoute || App.currentRoute.path !== "review/tasks") { clearInterval(taskTimer); taskTimer = null; return; }
            var running = st().tasks.filter(function (t) { return t.status === "running"; })[0];
            if (!running) {
              var q = st().tasks.filter(function (t) { return t.status === "queued"; })[0];
              if (q) { q.status = "running"; q.started = App.nowStamp(); q.logs.push([App.nowStamp(), "获得并发槽位，开始执行"]); }
              return;
            }
            running.progress = Math.min(100, running.progress + 3);
            var bar = root.querySelector('[data-task="' + running.id + '"] .progress > i');
            var pct = root.querySelector('[data-task="' + running.id + '"] .task-progress .tiny');
            if (bar) bar.style.width = running.progress + "%";
            if (pct) pct.textContent = running.progress + "%";
            if (running.progress >= 100) {
              running.status = "succeeded"; running.duration = "1m 40s";
              running.logs.push([App.nowStamp(), "任务完成，产物已写入"]);
              App.refresh();
            }
          }, 3000);
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]"); if (b) {
              var act = b.getAttribute("data-act");
              if (act === "tfilter") { taskFilter = b.getAttribute("data-key"); App.refresh(); }
              if (act === "detail") { taskDetail(b.getAttribute("data-id")); return; }
              if (act === "retry") { retryTask(b.getAttribute("data-id")); return; }
              if (act === "cancel") { cancelTask(b.getAttribute("data-id")); return; }
              if (act === "new") { newTask(); return; }
              if (act === "only-failed") { e.preventDefault(); taskFilter = "failed"; App.refresh(); return; }
            }
            var row = e.target.closest("[data-task]"); if (row && !e.target.closest("button")) taskDetail(row.getAttribute("data-task"));
          });
        }
      },
      { path: "review/qa", title: "质检与审核", icon: "check", render: qaPage,
        mount: function (root) {
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]"); if (!b) return;
            var act = b.getAttribute("data-act");
            if (act === "approve") approve();
            if (act === "reject") reject();
            if (act === "requalify") requalify();
            if (act === "composer") addComment();
            if (act === "add-comment") saveComment();
            if (act === "download") downloadReport();
            if (act === "play") { b.innerHTML = UI.icon("pause", 10); App.toast("播放演示", "原型不包含真实视频，播放头为模拟状态。", "info"); }
            if (act === "seek") { var bar = document.getElementById("scrubBar"); if (bar) { bar.style.width = "58%"; App.toast("已跳转", "模拟播放头 00:53。", "info"); } }
          });
        }
      },
      { path: "review/timeline", title: "剪辑时间线", icon: "scissors", render: timelinePage,
        mount: function (root) {
          root.addEventListener("input", function (e) {
            if (e.target.matches("[data-zoom]")) { zoom = Number(e.target.value); App.refresh(); }
          });
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]");
            if (b) {
              var act = b.getAttribute("data-act");
              if (act === "save-version") { if (App.hasPerm("timeline:write")) saveTimelineVersion(); else App.toast("暂无权限", "当前身份不能保存时间线版本。", "warn"); }
              if (act === "save-sub") { App.toast("字幕已保存", "SRT 时间码已更新。", "success"); }
              if (act === "play") { App.toast("预览", "播放头模拟推进中。", "info"); }
              if (act === "fit") { zoom = 1; App.refresh(); }
              return;
            }
            var clip = e.target.closest("[data-clip]");
            if (clip) { selectedClip = { track: clip.getAttribute("data-track"), clip: clip.getAttribute("data-clip") }; App.refresh(); }
          });
          root.addEventListener("pointerdown", function (e) {
            var clip = e.target.closest("[data-clip]"); if (!clip) return;
            var trackId = clip.getAttribute("data-track"), clipId = clip.getAttribute("data-clip");
            var tr = st().timeline.tracks.filter(function (x) { return x.id === trackId; })[0];
            var c = tr.clips.filter(function (x) { return x.id === clipId; })[0];
            if (!c) return;
            var startX = e.clientX, base = c.start, moved = false;
            function move(ev) {
              var dx = ev.clientX - startX;
              if (Math.abs(dx) > 3) moved = true;
              c.start = Math.max(0, Math.min(st().timeline.duration - c.dur, base + dx / (9 * zoom)));
              clip.style.left = Math.round(c.start * 9 * zoom) + "px";
            }
            function up() {
              document.removeEventListener("pointermove", move);
              document.removeEventListener("pointerup", up);
              if (moved) {
                selectedClip = { track: trackId, clip: clipId };
                App.refresh();
                App.toast("片段已移动", c.name + " 起点 " + c.start.toFixed(1) + "s", "success");
              }
            }
            document.addEventListener("pointermove", move);
            document.addEventListener("pointerup", up);
          });
        }
      }
    ]
  });
})();
