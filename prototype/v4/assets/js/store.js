/* ============================================================
   长夜制作台 V4 · 状态与工具
   ============================================================ */
window.SP = window.SP || {};

(function () {
  var KEY = "sp_v4_state_v1";

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  SP.KEY = KEY;

  SP.get = function () {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) {
        var fresh = SPData.seed();
        localStorage.setItem(KEY, JSON.stringify(fresh));
        return fresh;
      }
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) throw new Error("stale");
      return parsed;
    } catch (e) {
      var seed = SPData.seed();
      try { localStorage.setItem(KEY, JSON.stringify(seed)); } catch (err) {}
      return seed;
    }
  };

  SP.save = function (state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  };

  SP.update = function (fn) {
    var s = SP.get();
    fn(s);
    SP.save(s);
    return s;
  };

  SP.reset = function () {
    var seed = SPData.seed();
    SP.save(seed);
    return seed;
  };

  SP.ep = function (no) {
    var s = SP.get();
    return s.episodes.filter(function (e) { return e.no === no; })[0];
  };

  SP.escape = function (str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  SP.fmtTime = function (sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  };

  SP.fmtDuration = function (sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + "'" + String(s).padStart(2, "0") + "\"";
  };

  SP.money = function (n) {
    return "¥" + Number(n || 0).toLocaleString("zh-CN");
  };

  SP.query = function (name) {
    var q = new URLSearchParams(window.location.search);
    return q.get(name);
  };

  SP.uid = function (prefix) {
    return (prefix || "id") + "-" + Math.random().toString(36).slice(2, 7);
  };

  SP.pipelineStages = [
    { key: "story", name: "故事圣经", href: "story.html", meta: "设定已锁定" },
    { key: "episodes", name: "剧本分集", href: "episodes.html", meta: "EP01 已锁版" },
    { key: "assets", name: "资产设定", href: "assets.html", meta: "12 项制作资产" },
    { key: "board", name: "分镜契约", href: "storyboard.html", meta: "12 镜头" },
    { key: "generate", name: "画面生成", href: "tasks.html", meta: "1 个任务运行中" },
    { key: "qa", name: "质检审核", href: "review.html", meta: "EP01 待审核" },
    { key: "timeline", name: "剪辑合成", href: "timeline.html", meta: "TL v4 粗剪" },
    { key: "export", name: "成片交付", href: "export.html", meta: "等待审核解锁" }
  ];

  SP.stageLabel = function (status) {
    return {
      done: "已完成", active: "进行中", review: "待审核",
      todo: "待开始", locked: "未解锁", failed: "失败"
    }[status] || "待开始";
  };

  SP.epStatus = function (status) {
    return {
      locked: "已锁版", draft: "草稿", pending: "待生成", review: "待审核"
    }[status] || status;
  };

  SP.taskRunning = function () {
    return SP.get().tasks.filter(function (t) { return t.status === "running" || t.status === "queued"; }).length;
  };

  SP.canExport = function () {
    var s = SP.get();
    return s.qa.status === "approved";
  };

  SP.epProgress = function (no) {
    var s = SP.get();
    if (no === "01") {
      var steps = [1, 1, 1, 1, 0, 0, 0, 0];
      if (s.qa.status === "approved") { steps[5] = 1; steps[6] = 1; }
      if (s.exports.some(function (e) { return e.status === "succeeded" && e.target.indexOf("EP01") === 0; })) steps[7] = 1;
      return Math.round(steps.filter(Boolean).length / 8 * 100);
    }
    return 0;
  };

  SP.patchPipeline = function (s) {
    s.pipeline.story = "done";
    s.pipeline.episodes = s.episodes.filter(function (e) { return e.status === "locked"; }).length > 0 ? "done" : "active";
    s.pipeline.assets = "active";
    s.pipeline.board = "active";
    s.pipeline.generate = "active";
    if (s.qa.status === "approved") {
      s.pipeline.qa = "done";
      s.pipeline.timeline = "done";
      s.pipeline.export = "active";
    } else {
      s.pipeline.qa = "review";
      s.pipeline.timeline = "locked";
      s.pipeline.export = "locked";
    }
    return s;
  };

  SP.init = function () {
    var s = SP.get();
    return SP.patchPipeline(s);
  };
})();
