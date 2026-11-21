/* ============================================================
   模块：交付（delivery）
   导出交付
   ============================================================ */
(function () {
  function st() { return App.state; }
  var spec = 0;
  var lastRun = null;
  var SPECS = [
    { key: "vertical", name: "竖屏 9:16 · 1080×1920 · 30fps", desc: "主交付 · MP4 / H.264 / AAC", ext: ".mp4", size: "约 78 MB" },
    { key: "horizontal", name: "横屏 16:9 · 1920×1080 · 30fps", desc: "客户审阅 · MP4 / H.264", ext: ".mp4", size: "约 142 MB" },
    { key: "srt", name: "字幕文件 · SRT / UTF-8", desc: "19 条对白 · 含时间码", ext: ".srt", size: "约 8 KB" },
    { key: "review", name: "审阅版 · 720p · 带水印", desc: "低码率样片 · 可分享链接", ext: ".mp4", size: "约 31 MB" }
  ];

  function exportPage() {
    var s = st(), approved = s.qa.status === "approved";
    var gate = approved
      ? '<div class="gate-card ok"><div class="row"><span style="color:var(--success)">' + UI.icon("check", 20) + '</span><div class="lr-main"><b>质量门禁 PASS</b><div class="tiny muted">EP01 · PASS · 已解锁时间线与导出，可创建交付任务</div></div><span class="badge b-done">READY</span></div></div>'
      : '<div class="gate-card"><div class="row"><span style="color:var(--danger)">' + UI.icon("lock", 20) + '</span><div class="lr-main"><b>质量门禁 PASS 后才能发布</b><div class="tiny muted">当前门禁结果：' + (s.qa.status === "rejected" ? "FAIL" : "REVIEW_REQUIRED") + '。请先完成人工复核并记录 PASS。</div></div><a class="btn btn-sm" href="' + App.link("review/qa") + '">去复核</a></div></div>';

    var specs = SPECS.map(function (x, i) {
      return '<button class="spec-option' + (i === spec ? " active" : "") + '" data-act="spec" data-i="' + i + '"><span class="so-radio"></span><span class="so-main"><b>' + x.name + '</b><small>' + x.desc + " · " + x.size + "</small></span></button>";
    }).join("");

    var history = s.exports.map(function (e) {
      return '<div class="export-history-row"><span class="mono tiny">' + e.id + '</span><span><b>' + UI.esc(e.ver) + '</b><span class="t-sub">' + UI.esc(e.profile) + '</span></span><span class="eh-size tiny muted">' + UI.esc(e.size) + '</span><span>' + UI.statusBadge(e.status) + '</span>' +
        '<button class="btn btn-xs" data-act="history" data-id="' + e.id + '">' + (e.status === "succeeded" ? "清单" : "诊断") + "</button></div>";
    }).join("");

    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Delivery · EP01", title: "导出交付", desc: "冻结剧本、资产与时间线版本，经 ffprobe、完整解码与 checksum 后才发布。MP4 为演示记录，字幕与清单可真实下载。",
        actions: '<span class="badge ' + (approved ? "b-done" : "b-warn") + '">' + (approved ? "可导出" : "未解锁") + '</span><button class="btn" data-act="state">' + UI.icon("download") + "导出项目状态</button>" }) +
      gate +
      '<div class="export-layout mt-16"><div class="stack">' +
      '<div class="card"><div class="card-head"><div><h3>交付规格</h3><div class="ch-sub">一次导出只生成一种主产物</div></div><span class="tag">4 种</span></div><div class="card-body"><div class="spec-list">' + specs + "</div></div></div>" +
      '<div class="card"><div class="card-head"><h3>导出设置</h3></div><div class="card-body"><div class="form-grid">' +
      '<div class="field span2"><label>文件名</label><input class="input" id="expName" value="EP01_v5' + SPECS[spec].ext + '"><span class="hint">导出后自动追加版本与 checksum 前缀。</span></div>' +
      '<div class="field"><label>帧率</label><select class="select"><option>30 fps</option><option>24 fps</option></select></div><div class="field"><label>色彩</label><select class="select"><option>Rec.709</option><option>P3-D65</option></select></div>' +
      '<div class="field span2"><label class="checkline"><input type="checkbox" checked> 压制字幕轨</label><label class="checkline"><input type="checkbox"> 添加片尾水印</label><label class="checkline"><input type="checkbox" checked> 完成后通知项目成员</label></div></div>' +
      '<div class="row mt-16"><button class="btn btn-primary" data-act="run"' + (approved && App.hasPerm("export:run") ? "" : " disabled") + '>' + UI.icon("download") + "创建导出任务</button>" +
      '<button class="btn btn-ghost" data-act="fail-demo"' + (approved && App.hasPerm("export:run") ? "" : " disabled") + '>演示失败诊断</button></div></div></div></div>' +

      '<div class="stack"><div class="card"><div class="card-head"><h3>冻结输入</h3><span class="tiny muted">创建时锁定</span></div><div class="card-body"><div class="kv">' +
      '<div class="k">剧本</div><div class="v">EP01 · v6 已锁版</div><div class="k">资产</div><div class="v">18 项 · 参考版本锁定</div><div class="k">分镜</div><div class="v">12 镜头 · 5 就绪</div><div class="k">时间线</div><div class="v">TL v4 · 92s</div><div class="k">质量门禁</div><div class="v">' + (approved ? "PASS" : "REVIEW_REQUIRED") + "</div></div></div></div>" +
      '<div class="card"><div class="card-head"><h3>导出任务</h3></div><div class="card-body" id="exportProgress">' + (lastRun ? runHTML(lastRun) : (approved ? '<div class="tiny muted">尚未创建任务。选择规格后点击「创建导出任务」，任务会依次完成完整解码与 checksum。</div>' : '<div class="notice warn">' + UI.icon("alert", 15) + '<span>导出被质量门禁拦截。先到质检页记录 PASS。<a href="' + App.link("review/qa") + '">前往质检</a></span></div>')) + "</div></div>" +
      '<div class="card"><div class="card-head"><h3>历史记录</h3><span class="tiny muted">永久保留</span></div><div class="card-body tight"><div class="history-scroll">' + history + "</div></div></div></div></div></div>";
  }

  function runHTML(run) {
    if (!run) return "";
    return '<div class="row mb-12">' + UI.statusBadge(run.status) + '<span class="mono tiny">' + UI.esc(run.id) + '</span><span class="tiny muted" style="margin-left:auto">' + UI.esc(run.profile) + "</span></div>" +
      '<div id="runBar">' + UI.progress(run.pct) + '</div><div class="export-log mt-8" id="runLog">' + run.log.map(function (l) { return "<div>" + UI.esc(l) + "</div>"; }).join("") + "</div>";
  }

  function runExport(fail) {
    var s = st();
    if (!App.hasPerm("export:run")) { App.toast("暂无权限", "当前身份只能查看导出记录，不能创建交付任务。", "warn"); return; }
    if (s.qa.status !== "approved") { App.toast("导出被拦截", "质检尚未通过，不能创建交付任务。", "danger"); return; }
    var nameInput = document.getElementById("expName");
    var name = nameInput ? nameInput.value.trim() : "";
    if (!name) { App.toast("缺少文件名", "请填写导出文件名。", "danger"); return; }
    if (!/\.(mp4|srt|zip)$/i.test(name)) name += SPECS[spec].ext;
    var id = "EX-" + String(212 + s.exports.length).padStart(4, "0");
    var profile = SPECS[spec].name;
    var run = { id: id, status: "running", pct: 0, profile: profile, log: ["[" + App.nowStamp() + "] 任务已创建，冻结剧本 v6 / 资产 18 项 / TL v4", "[" + App.nowStamp() + "] ffmpeg 初始化 · " + profile] };
    lastRun = run;
    var box = document.getElementById("exportProgress");
    if (box) box.innerHTML = runHTML(run);

    var steps = fail
      ? [["ffmpeg 编码", 28], ["音轨校验失败", 28]]
      : [["ffmpeg 编码", 32], ["ffprobe 校验", 52], ["完整解码", 76], ["checksum", 94], ["发布", 100]];
    var i = 0, timer = setInterval(function () {
      if (!lastRun) { clearInterval(timer); return; }
      var step = steps[i];
      if (!step) { clearInterval(timer); return; }
      run.pct = step[1];
      var bar = document.getElementById("runBar") ? document.getElementById("runBar").querySelector(".progress > i") : null;
      if (bar) bar.style.width = run.pct + "%";
      var log = document.getElementById("runLog");
      if (log) log.innerHTML += "<div>[" + App.nowStamp() + "] " + step[0] + (fail ? " · 第 42s 音轨缺失" : " 完成") + "</div>";
      if (fail && i === 1) {
        clearInterval(timer);
        run.status = "failed";
        s.exports.unshift({ id: id, target: "EP01 · 雨夜书店", profile: profile, status: "failed", size: "—", duration: "—", createdAt: "今天 " + App.nowStamp(), checksum: "—", ver: name, error: "FFMPEG_ENCODE_FAILED · 第 42s 音轨缺失" });
        App.refresh();
        App.toast("导出失败", "FFMPEG_ENCODE_FAILED · 第 42s 音轨缺失，已保留诊断。", "danger");
        return;
      }
      i++;
      if (i >= steps.length) {
        clearInterval(timer);
        run.status = "succeeded"; run.pct = 100;
        var rec = { id: id, target: "EP01 · 雨夜书店", profile: profile, status: "succeeded", size: SPECS[spec].size.replace("约 ", ""), duration: "1'32\"", createdAt: "今天 " + App.nowStamp(), checksum: "a71e…9f3c", ver: name };
        s.exports.unshift(rec);
        s.activity.unshift([App.nowStamp(), App.currentUser.name, "创建导出任务 " + id + " · " + profile, "ok"]);
        App.refresh();
        App.toast("导出完成", id + " 已通过 ffprobe、完整解码与 checksum。", "success");
      }
    }, fail ? 500 : 620);
  }

  function history(id) {
    var e = st().exports.filter(function (x) { return x.id === id; })[0]; if (!e) return;
    if (e.status === "succeeded") { downloadManifest(e); return; }
    App.modal({
      title: "导出诊断", sub: e.id + " · " + e.profile, size: "lg",
      body: '<div class="notice danger">' + UI.icon("alert", 15) + "<span>" + UI.esc(e.error || "未知错误") + "</span></div>" +
        '<div class="export-log mt-12"><div>[18:02] ffmpeg 开始编码 · 1080×1920 · 30fps</div><div>[18:03] 第 42s 检测到音频帧缺失</div><div>[18:03] 编码终止，退出码 1</div><div>[18:04] ffprobe 确认：video 92s / audio 41.6s</div></div>' +
        '<div class="notice warn mt-12">建议：重新合成 A1 对白轨，确认 42s 处无空帧后重试。</div>',
      footer: '<button class="btn" data-close>关闭</button><button class="btn btn-primary" data-close>创建返工任务</button>'
    });
  }

  function downloadManifest(e) {
    var txt = "长夜制作台 · 交付清单\n\n导出 ID：" + e.id + "\n项目：长夜将明（NYJM-26）\n集数：EP01 雨夜书店\n规格：" + e.profile + "\n文件：" + e.ver + "\n大小：" + e.size + "\n时长：" + e.duration + "\nchecksum：" + e.checksum + "\n创建：" + e.createdAt +
      "\n\n伴随产物：\n- EP01_v5.srt（字幕，UTF-8）\n- EP01_质量门禁报告.txt（PASS / REVIEW_REQUIRED / FAIL）\n- EP01_shot_contracts.json（12 镜头）\n\n说明：纯静态原型不生成真实 MP4；此清单为可下载的演示交付物。\n";
    App.download(e.ver.replace(/\.[^.]+$/, "") + "_交付清单.txt", txt);
    App.toast("交付清单已下载", e.id, "success");
  }

  function stateExport() {
    var s = st();
    var data = JSON.stringify({ project: s.project, qa: s.qa, timeline: s.timeline, exports: s.exports }, null, 2);
    App.download(s.project.code + "_state.json", data, "application/json;charset=utf-8");
    App.toast("项目状态已导出", "包含项目、QA、时间线与导出历史。", "success");
  }

  AppModule.register({
    group: "delivery", label: "交付", icon: "download",
    routes: [
      { path: "delivery/export", title: "导出交付", icon: "download", render: exportPage,
        mount: function (root) {
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]"); if (!b) return;
            var act = b.getAttribute("data-act");
            if (act === "spec") { spec = Number(b.getAttribute("data-i")); App.refresh(); }
            if (act === "run") runExport(false);
            if (act === "fail-demo") runExport(true);
            if (act === "history") history(b.getAttribute("data-id"));
            if (act === "state") stateExport();
          });
        }
      }
    ]
  });
})();
