/* ============================================================
   模块：制作（production）
   分集 / 剧本 / 资产 / 分镜
   ============================================================ */
(function () {
  function st() { return App.state; }
  var epFilter = "all";
  var shotView = "grid";
  var shotFilter = "all";
  var assetFilter = "all";
  var assetQuery = "";
  var activeScene = 0;

  /* ================= 分集 ================= */
  function episodesPage() {
    var s = st();
    var counts = { all: s.episodes.length, locked: 0, review: 0, draft: 0, pending: 0 };
    s.episodes.forEach(function (e) { counts[e.status] = (counts[e.status] || 0) + 1; });
    var list = s.episodes.filter(function (e) { return epFilter === "all" || e.status === epFilter; });
    var cards = list.map(function (e) {
      return '<button class="ep-card' + (e.no === "01" ? " is-current" : "") + '" data-act="ep" data-no="' + e.no + '">' +
        '<span class="ep-no">EP' + e.no + " · " + UI.esc(e.chapters) + '</span><span class="ep-title">' + UI.esc(e.title) + "</span>" +
        '<span class="tiny muted" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + UI.esc(e.hook) + "</span>" +
        '<span class="ep-foot">' + UI.statusBadge(e.status) + '<span class="tiny mono">' + UI.esc(e.duration) + "</span></span></button>";
    }).join("");
    var tabs = UI.tabs([
      { key: "all", label: "全部", count: counts.all },
      { key: "locked", label: "已锁版", count: counts.locked },
      { key: "review", label: "待确认", count: counts.review || 0 },
      { key: "draft", label: "草稿", count: counts.draft },
      { key: "pending", label: "待生成", count: counts.pending }
    ], epFilter, "filter");

    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Season · 12 episodes", title: "分集与剧本", desc: "用季卡管理 12 集节奏。EP01 已锁版，其余可批量生成剧本；章节映射决定每集覆盖的原文范围。",
        actions: (App.hasPerm("script:write") ? '<button class="btn" data-act="map">' + UI.icon("list") + '章节映射</button><button class="btn" data-act="replan">' + UI.icon("refresh") + '重分集</button><button class="btn btn-primary" data-act="batch">' + UI.icon("spark") + "批量生成剧本</button>" : '<span class="badge b-locked">当前身份只读</span>') }) +
      '<div class="grid g4 mb-16">' + UI.stat({ label: "总集数", value: "12", unit: "集", delta: "24 章 · 2 章/集" }) +
      UI.stat({ label: "已锁版", value: String(counts.locked), unit: "集", delta: "EP01 已记录 PASS" }) +
      UI.stat({ label: "剧本草稿", value: String(counts.draft), unit: "集", delta: "等待导演确认" }) +
      UI.stat({ label: "待生成", value: String(counts.pending), unit: "集", delta: "可用批量生成" }) + "</div>" +
      '<div class="card"><div class="card-head"><div><h3>季卡</h3><div class="ch-sub">12 集 · 9:16 竖屏 · 目标单集 90 秒</div></div>' + UI.badge("EP01 完成度 " + App.epProgress("01") + "%", "b-active") + "</div>" +
      '<div class="card-body">' + tabs + '<div class="ep-grid">' + cards + "</div>" +
      (list.length ? "" : UI.empty("没有符合条件的剧集", "切换状态筛选，或批量生成新剧本。")) + "</div>" +
      '<div class="card-foot"><span class="tiny muted">章节映射 · 第 1–24 章 / 每集 2 章</span><span class="tiny muted">最近更新 今天 00:12 · 陈默</span></div></div>' +
      '<div class="notice info mt-16">' + UI.icon("lock", 15) + "<span>锁版剧本不可直接编辑；修改会创建新版本并保留旧版。导出必须使用已锁版剧本。</span></div></div>";
  }

  function openEpisode(no) {
    var e = st().episodes.filter(function (x) { return x.no === no; })[0];
    if (!e) return;
    var body = '<div class="row" style="gap:14px;margin-bottom:14px"><div class="poster" style="width:92px;flex:0 0 92px"><span class="p-no">EP' + e.no + '</span><span class="p-label">' + UI.esc(e.title) + '</span></div>' +
      '<div><div class="row">' + UI.statusBadge(e.status) + '<span class="tag">' + UI.esc(e.chapters) + '</span></div><div class="small muted mt-8">' + UI.esc(e.hook) + "</div>" +
      '<div class="kv mt-12" style="grid-template-columns:64px 1fr"><div class="k">场次</div><div class="v">8 场</div><div class="k">时长</div><div class="v">' + e.duration + '</div><div class="k">画幅</div><div class="v">9:16 · 30fps</div></div></div></div>' +
      '<div class="form-grid"><div class="field span2"><label>本集钩子</label><textarea class="textarea" rows="3" id="epHook">' + UI.esc(e.hook) + "</textarea></div>" +
      '<div class="field"><label>起始章节</label><input class="input" value="' + UI.esc(e.chapters) + '" disabled></div><div class="field"><label>目标时长</label><input class="input" value="90 秒" disabled></div></div>';
    App.drawer({
      eyebrow: "Episode", title: "EP" + e.no + " · " + e.title, sub: "第 " + e.no + " 集 / 共 12 集", body: body,
      footer: (App.hasPerm("script:write") ? '<button class="btn" data-close>关闭</button><button class="btn btn-primary" id="epGen">生成 / 重新生成剧本</button>' : '<button class="btn" data-close>关闭</button>'),
      onMount: function (el, close) {
        var b = el.querySelector("#epGen");
        if (!b) return;
        b.addEventListener("click", function () {
          close();
          App.navigate("production/script", { ep: e.no });
          App.toast("已进入剧本", "EP" + e.no + " 使用演示剧本模板，可继续编辑。", "info");
        });
      }
    });
  }

  function mapModal() {
    var s = st();
    var rows = s.episodes.map(function (e) {
      var start = (parseInt(e.no, 10) - 1) * 2 + 1;
      return '<div class="entity-confirm-row"><span class="mono tiny muted" style="width:34px">EP' + e.no + '</span><span style="flex:1">' + UI.esc(e.title) + '</span>' +
        '<select class="select" style="width:78px" data-map-start="' + e.no + '">' + [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24].map(function (n) { return '<option' + (n === start ? " selected" : "") + ">第 " + n + " 章</option>"; }).join("") + "</select>" +
        '<span class="tiny muted">至</span><select class="select" style="width:78px" data-map-end="' + e.no + '">' + [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24].map(function (n) { return '<option' + (n === start + 1 ? " selected" : "") + ">第 " + n + " 章</option>"; }).join("") + "</select></div>";
    }).join("");
    App.modal({
      title: "章节映射", sub: "调整每集起始章节。保存后需重新确认分集钩子，已锁版剧本不受影响。", size: "lg",
      body: '<div class="notice info mb-12">' + UI.icon("alert", 15) + "<span>24 章原文 / 12 集。当前每集 2 章，修改只影响未锁版剧集。</span></div>" +
        '<div style="max-height:52vh;overflow:auto">' + rows + "</div>",
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="mapSave">保存映射</button>',
      onMount: function (el, close) {
        el.querySelector("#mapSave").addEventListener("click", function () {
          close(); App.toast("映射已保存", "12 集章节边界已更新，3 集钩子已标记待确认。", "success");
        });
      }
    });
  }

  function batchModal() {
    var s = st();
    var pending = s.episodes.filter(function (e) { return e.status === "pending" || e.status === "draft"; });
    if (!pending.length) { App.toast("没有待生成剧集", "所有剧集都已有剧本。", "info"); return; }
    var body = '<div class="notice info mb-12">' + UI.icon("spark", 15) + "<span>将按季卡顺序生成 " + pending.length + " 集剧本，预计 3 分 20 秒。</span></div>" +
      '<div style="max-height:42vh;overflow:auto">' + pending.map(function (e) {
        return '<label class="entity-confirm-row"><input type="checkbox" data-batch="' + e.no + '" checked><span style="flex:1"><b>EP' + e.no + ' · ' + UI.esc(e.title) + '</b><span class="tiny muted" style="display:block">' + UI.esc(e.chapters) + " · 8 场</span></span>" + UI.statusBadge(e.status) + "</label>";
      }).join("") + "</div>";
    App.modal({
      title: "批量生成剧本", sub: "使用已确认的故事圣经与章节边界", size: "lg", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="batchGo">开始生成</button>',
      onMount: function (el, close) {
        el.querySelector("#batchGo").addEventListener("click", function () {
          var picks = [];
          el.querySelectorAll("[data-batch]:checked").forEach(function (c) { picks.push(c.getAttribute("data-batch")); });
          close();
          runBatch(picks);
        });
      }
    });
  }

  function runBatch(picks) {
    var body = '<div class="stack"><div class="notice info">' + UI.icon("spark", 15) + "<span>正在生成 " + picks.length + " 集剧本…</span></div>" +
      '<div id="batchBar">' + UI.progress(0) + '</div><div class="export-log mt-12" id="batchLog"></div></div>';
    App.modal({
      title: "生成中", sub: "EP 剧本 · 结构 → 对白 → 钩子 → 一致性", body: body, footer: '<button class="btn" data-close>后台运行</button>',
      onMount: function (el, close) {
        var done = 0, timer = setInterval(function () {
          var bar = el.querySelector("#batchBar .progress > i"); if (!bar) { clearInterval(timer); return; }
          done = Math.min(picks.length, done + 1);
          var pct = Math.round(done / picks.length * 100);
          bar.style.width = pct + "%";
          el.querySelector("#batchLog").innerHTML += "<div>[EP" + picks[done - 1] + "] 剧本草稿生成完成 · 8 场 / 19 条对白</div>";
          if (done >= picks.length) {
            picks.forEach(function (no) {
              st().episodes.forEach(function (e) { if (e.no === no && e.status !== "locked") e.status = "draft"; });
            });
            clearInterval(timer);
            setTimeout(function () {
              close();
              App.refresh();
              App.toast("生成完成", picks.length + " 集剧本草稿已写入，等待导演确认。", "success");
            }, 500);
          }
        }, 550);
      }
    });
  }

  function replanModal() {
    App.confirm({
      title: "重新分集", message: "按当前章节映射重新生成 12 集边界与钩子？", danger: true,
      detail: "已锁版剧本不受影响；草稿与待生成剧集会重新排队。",
      okText: "确认重分集",
      then: null
    }).then(function (ok) {
      if (!ok) return;
      st().episodes.forEach(function (e) { if (e.status !== "locked") e.status = "pending"; });
      st().pipeline.episodes = "active";
      App.refresh();
      App.toast("已重分集", "10 集进入待生成队列，EP01 锁版保留。", "warn");
    });
  }

  /* ================= 剧本 ================= */
  function scriptPage(params) {
    var epNo = params && params.ep ? params.ep : "01";
    var s = st();
    var ep = s.episodes.filter(function (x) { return x.no === epNo; })[0] || s.episodes[0];
    if (epNo !== "01") {
      return '<div class="page">' + UI.pageHead({ eyebrow: "Script editor", title: "EP" + ep.no + " · " + ep.title, desc: "本集剧本尚未生成。可先批量生成，或返回 EP01 查看完整编辑器。",
        actions: '<a class="btn" href="' + App.link("production/episodes") + '">返回季卡</a>' + (App.hasPerm("script:write") ? '<button class="btn btn-primary" data-act="genthis">生成本集剧本</button>' : "") }) +
        '<div class="card"><div class="card-body">' + UI.empty("还没有剧本正文", "EP" + ep.no + " 处于「" + ep.status + "」状态。生成后会得到 8 场结构与对白草稿。", '<button class="btn mt-16" data-act="genthis">生成本集剧本</button>') + "</div></div></div>";
    }
    var chips = s.episodes.map(function (e) {
      return '<a class="chip' + (e.no === epNo ? " on" : "") + '" href="' + App.link("production/script", { ep: e.no }) + '">EP' + e.no + "</a>";
    }).join("");
    var edit = App.hasPerm("script:write");
    var scenes = s.scenes.map(function (sc, i) {
      return '<button class="scene-item' + (i === activeScene ? " active" : "") + '" data-scene="' + i + '"><b>' + sc.no + " · " + UI.esc(sc.slug) + '</b><small>' + UI.esc(sc.setting) + " · " + sc.pages + ' 页</small></button>';
    }).join("");
    var paper = s.scenes.map(function (sc, i) {
      return '<div id="sceneBlock' + i + '"><div class="sp-scene">' + sc.no + ". " + UI.esc(sc.slug) + "　" + UI.esc(sc.setting) + "</div>" +
        sc.body.map(function (b) {
          if (b[0] === "dialog") return '<div class="sp-dialog"><b>' + UI.esc(b[1]) + '</b><div contenteditable="' + (edit ? "true" : "false") + '">' + UI.esc(b[2]) + "</div></div>";
          return '<p class="sp-action" contenteditable="' + (edit ? "true" : "false") + '">' + UI.esc(b[1]) + "</p>";
        }).join("") + "</div>";
    }).join('<div class="sp-line"></div>');
    var checks = [["8 场结构完整", true], ["角色引用 4 / 4", true], ["19 条对白已分配声线", true], ["第 5–6 场转场偏快", false], ["EP01 已锁版 v6", true]];
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Script editor · EP" + ep.no, title: "EP01 · 雨夜书店", desc: "8 场 · 1'32\" · 19 条对白。支持直接编辑、⌘S 保存、保存新版本与锁版。",
        actions: '<div class="script-meta-bar">' + UI.statusBadge("locked", "已锁版 v6") + '<span class="dirty-dot" id="dirtyDot"></span></div>' +
          (edit ? '<button class="btn" data-act="version">保存新版本</button><button class="btn btn-soft" data-act="optimize">' + UI.icon("spark") + 'AI 优化本场</button><button class="btn btn-primary" data-act="save">' + UI.icon("edit") + "保存 · ⌘S</button>" : '<span class="badge b-locked">只读身份</span>') }) +
      '<div class="card mb-12"><div class="card-body tight row wrap" style="gap:6px">' + chips + '<span class="small muted" style="margin-left:auto">EP01 是唯一含完整正文的演示剧集</span></div></div>' +
      '<div class="script-grid">' +
      '<div class="scene-list"><div class="card-head" style="padding:10px 12px"><h3 style="font-size:11px">场次</h3><span class="tag">8</span></div>' + scenes + "</div>" +
      '<div><div class="script-paper" id="paper"><div class="sp-title">长夜将明</div><div class="sp-meta">EP01 · 雨夜书店 · 第 6 版 · 9:16</div>' + paper + "</div>" +
      '<div class="between mt-12"><button class="btn btn-sm" data-act="add-scene">' + UI.icon("plus") + '新增场次</button><span class="tiny muted">点击场次跳转 · 编辑后出现橙色脏标 · ⌘S 保存</span></div></div>' +
      '<div class="inspector"><div class="inspector-block"><h4>引用与检查</h4>' + checks.map(function (c) {
        return '<div class="check-row"><span class="' + (c[1] ? "ok" : "warn") + '">' + UI.icon(c[1] ? "check" : "alert", 13) + '</span><span>' + c[0] + "</span></div>";
      }).join("") + "</div>" +
      '<div class="inspector-block"><h4>本集引用</h4>' + s.characters.slice(0, 4).map(function (c) {
        return '<div class="list-row" style="padding:6px 0">' + UI.avatar(c.name, "sm", c.color) + '<span class="lr-main"><span class="lr-title">' + UI.esc(c.name) + '</span><span class="lr-sub">' + UI.esc(c.anchor) + "</span></span></div>";
      }).join("") + '<div class="tiny muted mt-8">资产：书店橱窗、黑皮账簿、红围巾</div></div>' +
      '<div class="inspector-block"><h4>版本记录</h4><div class="list-row"><span class="mono tiny">v6</span><span class="lr-main"><span class="lr-title">锁版 · 陈默</span><span class="lr-sub">今天 09:12</span></span><span class="badge b-teal">当前</span></div>' +
      '<div class="list-row"><span class="mono tiny">v5</span><span class="lr-main"><span class="lr-title">修改第 7 场雨声</span><span class="lr-sub">昨天 23:48 · 苏禾</span></span></div></div></div>' +
      "</div></div>";
  }

  function saveScript(newVersion) {
    var s = st();
    if (newVersion) {
      var n = parseInt(String(s.scriptVersion).replace(/[^0-9]/g, ""), 10) + 1;
      s.scriptVersion = "v" + n;
      s.episodes[0].status = "review";
      s.activity.unshift([App.nowStamp(), App.currentUser.name, "保存 EP01 剧本 " + s.scriptVersion + "，提交导演确认", "script"]);
      App.refresh();
      App.toast("新版本已保存", "EP01 剧本 " + s.scriptVersion + " 已提交确认，旧版本保留。", "success");
    } else {
      var dot = document.getElementById("dirtyDot");
      if (dot) dot.classList.remove("show");
      App.toast("已保存", "EP01 剧本草稿已保存到内存。刷新页面会回到演示初始状态。", "success");
    }
  }

  function optimizeScene() {
    var body = '<div class="stack"><div class="notice info">' + UI.icon("spark", 15) + "<span>只优化当前场次的动作与对白节奏，不改变人物锚点和剧情事实。</span></div>" +
      '<div class="field"><label>优化目标</label><select class="select"><option>增强压迫感</option><option>缩短 15% 时长</option><option>补足环境音提示</option></select></div>' +
      '<div class="tiny muted">当前场次：' + (activeScene + 1) + " / 8</div><div id=\"optBar\">" + UI.progress(0) + "</div></div>";
    App.modal({
      title: "AI 优化本场", sub: "使用 mork-llm-7b · 只生成建议，不自动替换", body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="optGo">生成建议</button>',
      onMount: function (el, close) {
        el.querySelector("#optGo").addEventListener("click", function () {
          var bar = el.querySelector("#optBar .progress > i");
          var pct = 0, timer = setInterval(function () {
            pct += 20; if (bar) bar.style.width = pct + "%";
            if (pct >= 100) { clearInterval(timer); setTimeout(function () { close(); App.toast("优化建议已生成", "第 " + (activeScene + 1) + " 场可缩短 6 秒，已放入版本对比。", "success"); }, 300); }
          }, 260);
        });
      }
    });
  }

  function versionModal() {
    App.modal({
      title: "版本记录", sub: "EP01 剧本 · 最近 5 个版本",
      body: '<div class="stack">' + [["v6", "今天 09:12", "陈默", "锁版；修正第 7 场雨声", true], ["v5", "昨天 23:48", "苏禾", "调整第 5–6 场转场"], ["v4", "昨天 18:30", "顾青", "重写阿棠出场对白"], ["v3", "11-19 16:05", "顾青", "新增第 8 场结尾钩子"], ["v2", "11-18 11:20", "陈默", "导入初稿后结构整理"]].map(function (v) {
        return '<div class="list-row"><span class="mono tiny" style="width:26px">' + v[0] + '</span><span class="lr-main"><span class="lr-title">' + v[3] + '</span><span class="lr-sub">' + v[1] + " · " + v[2] + "</span></span>" + (v[4] ? '<span class="badge b-active">当前</span>' : '<button class="btn btn-xs" data-act="compare" data-ver="' + v[0] + '">对比</button>') + "</div>";
      }).join("") + "</div>",
      footer: '<button class="btn" data-close>关闭</button>' + (App.hasPerm("script:write") ? '<button class="btn btn-primary" id="verNew">保存为新版本</button>' : ""),
      onMount: function (el, close) {
        var b = el.querySelector("#verNew");
        if (b) b.addEventListener("click", function () { close(); saveScript(true); });
        el.addEventListener("click", function (e) {
          var c = e.target.closest('[data-act="compare"]');
          if (c) App.toast("版本对比", c.getAttribute("data-ver") + " 与当前版本的差异将在接入版本服务后展示。", "warn");
        });
      }
    });
  }

  /* ================= 资产 ================= */
  function assetsPage() {
    var s = st();
    var all = s.characters.concat(s.assets);
    var counts = {
      character: s.characters.length, scene: s.assets.filter(function (a) { return a.type === "scene"; }).length,
      prop: s.assets.filter(function (a) { return a.type === "prop"; }).length, costume: s.assets.filter(function (a) { return a.type === "costume"; }).length
    };
    var tabs = UI.tabs([{ key: "all", label: "全部", count: all.length }, { key: "character", label: "角色", count: counts.character }, { key: "scene", label: "场景", count: counts.scene }, { key: "prop", label: "道具", count: counts.prop }, { key: "costume", label: "服装", count: counts.costume }], assetFilter, "type");
    var cards = all.map(function (a) {
      var kind = a.type || "character";
      return '<button class="asset-card" data-asset="' + a.id + '" data-kind="' + kind + '" data-name="' + UI.esc(a.name) + '" data-type="' + kind + '">' +
        UI.assetThumb(a) + '<div class="ac-body"><div class="ac-name">' + UI.esc(a.name) + '</div><div class="ac-meta"><span>' + UI.esc(a.version) + '</span><span>' + a.refs + ' 引用</span></div></div></button>';
    }).join("");
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Asset library · 18 items", title: "资产库", desc: "角色、场景、道具与服装的参考图与版本。锁定参考后，生成任务必须使用锁定版本。",
        actions: '<button class="btn" data-act="check">' + UI.icon("check") + '一致性检查</button>' + (App.hasPerm("asset:write") ? '<button class="btn" data-act="new">' + UI.icon("plus") + '新增资产</button><button class="btn btn-primary" data-act="batch">' + UI.icon("spark") + "批量生成参考</button>" : "") }) +
      '<div class="grid g4 mb-16">' + UI.stat({ label: "角色", value: "6", unit: "项", delta: "4 项已锁定" }) +
      UI.stat({ label: "场景", value: "6", unit: "项", delta: "核心场景 2 项" }) +
      UI.stat({ label: "道具", value: "5", unit: "项", delta: "账簿 / 围巾 / 钥匙" }) +
      UI.stat({ label: "服装", value: "1", unit: "项", delta: "周砚 · 雨夜装" }) + "</div>" +
      '<div class="card"><div class="card-head"><div><h3>资产与参考</h3><div class="ch-sub">共 18 项 · 6 角色 + 12 项制作资产</div></div>' +
      '<div class="filter-bar"><div class="filter-search">' + UI.icon("search", 15) + '<input class="input" id="assetSearch" placeholder="搜索名称或版本…" value="' + UI.esc(assetQuery) + '"></div></div></div>' +
      '<div class="card-body">' + tabs + '<div class="asset-grid" id="assetGrid">' + cards + '</div><div id="assetEmpty"></div></div></div>' +
      '<div class="notice info mt-16">' + UI.icon("lock", 15) + "<span>参考图版本被锁定后，镜头合同会冻结该版本；重新生成不会改动已送审镜头。</span></div></div>";
  }

  function filterAssets() {
    var grid = document.getElementById("assetGrid"); if (!grid) return;
    var q = assetQuery.toLowerCase(), n = 0;
    grid.querySelectorAll("[data-asset]").forEach(function (el) {
      var type = el.getAttribute("data-type"), name = el.getAttribute("data-name").toLowerCase();
      var ok = (assetFilter === "all" || type === assetFilter) && (!q || name.indexOf(q) > -1);
      el.style.display = ok ? "" : "none"; if (ok) n++;
    });
    var empty = document.getElementById("assetEmpty");
    if (empty) empty.innerHTML = n ? "" : UI.empty("没有匹配的资产", "调整类型或搜索关键词。");
  }

  function openAsset(id, kind) {
    var item = kind === "character" ? st().characters.filter(function (x) { return x.id === id; })[0] : st().assets.filter(function (x) { return x.id === id; })[0];
    if (!item) return;
    var body = '<div class="asset-thumb" style="aspect-ratio:4/3;margin-bottom:14px;background:linear-gradient(155deg,' + UI.hexA(item.color || "#7a6a55", .2) + "," + (item.color || "#7a6a55") + ')"><span class="at-glyph" style="font-size:44px">' + UI.esc(item.initial || item.name.charAt(0)) + "</span></div>" +
      '<div class="row mb-12">' + UI.statusBadge(item.status) + '<span class="tag">' + UI.esc(item.version) + '</span><span class="tiny muted">' + item.refs + " 个引用 · " + (item.shots || 3) + ' 个镜头</span></div>' +
      '<div class="form-grid"><div class="field span2"><label>名称</label><input class="input" value="' + UI.esc(item.name) + '" disabled></div>' +
      '<div class="field span2"><label>设定描述</label><textarea class="textarea" id="assetDesc" rows="3">' + UI.esc(item.desc) + "</textarea></div>" +
      '<div class="field span2"><label>参考提示词</label><textarea class="textarea" id="assetPrompt" rows="2">' + UI.esc(item.prompt || item.anchor || "") + "</textarea></div></div>" +
      '<div class="notice mt-12">' + UI.icon("image", 15) + "<span>生成新参考会创建一个候选版本，不会自动覆盖当前锁定版本。</span></div>";
    App.drawer({
      eyebrow: "Asset detail", title: item.name, sub: (item.role || "制作资产") + " · " + item.version, body: body,
      footer: '<button class="btn" data-close>关闭</button>' + (App.hasPerm("asset:write") ? '<button class="btn" id="assetLock">' + (item.status === "locked" ? "解除锁定" : "锁定参考") + '</button><button class="btn btn-primary" id="assetGen">生成新参考</button>' : ""),
      onMount: function (el, close) {
        var lock = el.querySelector("#assetLock");
        if (lock) lock.addEventListener("click", function () {
          item.status = item.status === "locked" ? "ready" : "locked";
          close(); App.refresh(); App.toast("参考状态已更新", item.name + " 现在为「" + item.status + "」。", "success");
        });
        var gen = el.querySelector("#assetGen");
        if (gen) gen.addEventListener("click", function () {
          close();
          var n = parseInt(String(item.version).replace(/[^0-9]/g, ""), 10) + 1;
          item.version = "REF v" + n; item.status = "review"; item.refs = (item.refs || 0) + 1;
          st().activity.unshift([App.nowStamp(), App.currentUser.name, "生成「" + item.name + "」参考候选 " + item.version, "asset"]);
          App.refresh(); App.toast("候选已生成", item.name + " " + item.version + " 已提交一致性检查。", "success");
        });
      }
    });
  }

  function checkAssets() {
    var s = st();
    App.modal({
      title: "一致性检查", sub: "18 项资产 · 对照视觉锚点与镜头引用", size: "lg",
      body: '<div class="notice success mb-12">' + UI.icon("check", 15) + "<span>15 项通过，2 项警告，1 项缺少有效参考。</span></div>" +
        '<div class="stack">' + s.assets.slice(0, 8).map(function (a) {
          var tone = a.status === "draft" ? "warning" : "ready";
          return '<div class="list-row">' + UI.assetThumb(a, "thumb-xs") + '<span class="lr-main"><span class="lr-title">' + UI.esc(a.name) + '</span><span class="lr-sub">' + UI.esc(a.version) + " · " + a.refs + ' 个引用</span></span>' + UI.statusBadge(tone) + "</div>";
        }).join("") + "</div>",
      footer: '<button class="btn" data-close>关闭</button><button class="btn btn-primary" data-close>应用建议</button>'
    });
  }

  function batchAssets() {
    App.modal({
      title: "批量生成参考", sub: "为草稿资产生成 2 张候选，进入一致性检查", body:
        '<div class="notice info">' + UI.icon("spark", 15) + "<span>将处理「铅字盘」「沈知白」等 3 项草稿资产。每项生成 2 张候选。</span></div><div class=\"mt-16\" id=\"baBar\">" + UI.progress(0) + "</div>",
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="baGo">开始生成</button>',
      onMount: function (el, close) {
        el.querySelector("#baGo").addEventListener("click", function () {
          var p = 0, timer = setInterval(function () {
            p += 20; var bar = el.querySelector("#baBar .progress > i"); if (bar) bar.style.width = p + "%";
            if (p >= 100) { clearInterval(timer); setTimeout(function () { close(); App.refresh(); App.toast("候选已生成", "3 项资产 · 6 张候选待检查。", "success"); }, 300); }
          }, 300);
        });
      }
    });
  }

  /* ================= 分镜 ================= */
  function storyboardPage() {
    var s = st();
    var counts = { all: s.shots.length, ready: 0, review: 0, generating: 0, todo: 0 };
    s.shots.forEach(function (x) { counts[x.status] = (counts[x.status] || 0) + 1; });
    var list = s.shots.filter(function (x) { return shotFilter === "all" || x.status === shotFilter; });
    var cards = list.map(function (sh) {
      return '<button class="shot-card" data-shot="' + sh.id + '"><div class="shot-frame" style="background-image:url(' + shotBg(sh) + ')"><span class="shot-no">' + sh.id + '</span><span class="shot-dur">' + sh.duration + 's</span></div>' +
        '<div class="shot-body"><div class="shot-title">' + UI.esc(sh.title) + '</div><div class="shot-meta">' + UI.esc(sh.size) + " · " + UI.esc(sh.move) + "</div></div></button>";
    }).join("");
    var tabs = UI.tabs([{ key: "all", label: "全部", count: counts.all }, { key: "ready", label: "已就绪", count: counts.ready }, { key: "review", label: "待确认", count: counts.review }, { key: "generating", label: "生成中", count: counts.generating }, { key: "todo", label: "未开始", count: counts.todo }], shotFilter, "sfilter");
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Storyboard · EP01", title: "分镜台", desc: "12 个镜头，每个镜头都绑定 Shot Contract：景别、运镜、时长、色彩与参考资产。",
        actions: '<a class="btn" href="' + App.link("production/canvas") + '">画布视图</a><div class="btn-group"><button class="' + (shotView === "grid" ? "active" : "") + '" data-act="view" data-view="grid">网格</button><button class="' + (shotView === "list" ? "active" : "") + '" data-act="view" data-view="list">列表</button></div>' + (App.hasPerm("board:write") ? '<button class="btn btn-primary" data-act="batch">' + UI.icon("spark") + "批量生成候选</button>" : "") }) +
      '<div class="grid g4 mb-16">' + UI.stat({ label: "镜头总数", value: "12", delta: "EP01 · 8 场" }) +
      UI.stat({ label: "已就绪", value: String(counts.ready), delta: "可直接进入时间线" }) +
      UI.stat({ label: "待确认", value: String(counts.review), delta: "需导演确认" }) +
      UI.stat({ label: "未开始", value: String(counts.todo), delta: "可批量生成" }) + "</div>" +
      '<div class="card"><div class="card-head"><div><h3>镜头列表</h3><div class="ch-sub">9:16 · 30fps · 目标 92 秒</div></div><span class="badge b-teal">' + counts.ready + " / 12 就绪</span></div>" +
      '<div class="card-body">' + tabs +
      (shotView === "grid" ? '<div class="shot-grid">' + cards + "</div>" : shotList(list)) +
      (list.length ? "" : UI.empty("没有符合条件的镜头", "切换筛选，或批量生成候选。")) + "</div></div>" +
      '<div class="notice info mt-16">' + UI.icon("alert", 15) + "<span>Shot Contract 会冻结参考资产版本。修改 Contract 后，已有候选会被标记需重生成。</span></div></div>";
  }
  function shotBg(sh) {
    return sh.id === "S0104" || sh.id === "S0105" ? UI.scene("bookstore") : sh.id === "S0107" || sh.id === "S0108" ? UI.scene("alley") : sh.id === "S0109" ? UI.scene("room") : UI.scene("bookstore");
  }
  function shotList(list) {
    return '<div>' + list.map(function (sh) {
      return '<button class="shot-list-row" data-shot="' + sh.id + '" style="width:100%;border-left:0;border-right:0;border-top:0;background:none;text-align:left"><span class="mono tiny">' + sh.id + '</span><span><b>' + UI.esc(sh.title) + '</b><span class="t-sub">' + UI.esc(sh.size) + " · " + UI.esc(sh.move) + '</span></span><span class="tiny muted">' + UI.esc(sh.params) + '</span><span class="mono tiny">' + sh.duration + 's</span>' + UI.statusBadge(sh.status) + "</button>";
    }).join("") + "</div>";
  }

  function openShot(id) {
    var sh = st().shots.filter(function (x) { return x.id === id; })[0]; if (!sh) return;
    var body = '<div class="poster" style="aspect-ratio:9/16;max-width:220px;margin:0 auto 14px;background-image:url(' + shotBg(sh) + ')"><span class="p-no">' + sh.id + '</span><span class="p-label">' + UI.esc(sh.title) + '</span></div>' +
      '<div class="form-grid"><div class="field"><label>景别</label><input class="input" id="scSize" value="' + UI.esc(sh.size) + '"></div><div class="field"><label>运镜</label><input class="input" id="scMove" value="' + UI.esc(sh.move) + '"></div>' +
      '<div class="field"><label>时长（秒）</label><input class="input" id="scDur" value="' + sh.duration + '"></div><div class="field"><label>画幅 / 色彩</label><input class="input" value="' + UI.esc(sh.params) + '" disabled></div>' +
      '<div class="field span2"><label>镜头描述</label><textarea class="textarea" id="scNote" rows="3">' + UI.esc(sh.note) + "</textarea></div></div>" +
      '<div class="notice mt-12">引用资产：长夜书店 · 橱窗 / 黑皮账簿 / 周砚 · 雨夜装（锁定 REF v3 / v2 / v1）</div>';
    App.drawer({
      eyebrow: "Shot contract", title: sh.id + " · " + sh.title, sub: "EP01 · 第 " + (parseInt(sh.no.slice(-2), 10) || 1) + " 镜 · " + sh.duration + "s", body: body,
      footer: '<button class="btn" data-close>关闭</button>' + (App.hasPerm("board:write") ? '<button class="btn" id="shotReview">送审</button><button class="btn btn-primary" id="shotGen">生成候选</button>' : ""),
      onMount: function (el, close) {
        var gen = el.querySelector("#shotGen");
        if (gen) gen.addEventListener("click", function () {
          sh.size = el.querySelector("#scSize").value; sh.move = el.querySelector("#scMove").value; sh.duration = el.querySelector("#scDur").value; sh.note = el.querySelector("#scNote").value;
          sh.status = "review"; close(); App.refresh(); App.toast("候选生成中", sh.id + " 已加入生成队列，预计 2 分钟。", "success");
        });
        var rev = el.querySelector("#shotReview");
        if (rev) rev.addEventListener("click", function () {
          sh.status = "review"; close(); App.refresh(); App.toast("已送审", sh.id + " 已进入质检队列。", "success");
        });
      }
    });
  }

  function batchShots() {
    App.modal({
      title: "批量生成候选", sub: "为未开始镜头生成 2 个候选", body: '<div class="notice info">' + UI.icon("spark", 15) + "<span>共 3 个未开始镜头，预计 6 分钟。生成后会进入「待确认」。</span></div><div class=\"mt-16\" id=\"bsBar\">" + UI.progress(0) + "</div>",
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="bsGo">开始</button>',
      onMount: function (el, close) {
        el.querySelector("#bsGo").addEventListener("click", function () {
          var p = 0, timer = setInterval(function () {
            p += 25; var bar = el.querySelector("#bsBar .progress > i"); if (bar) bar.style.width = p + "%";
            if (p >= 100) { clearInterval(timer); st().shots.forEach(function (sh) { if (sh.status === "todo") sh.status = "review"; }); setTimeout(function () { close(); App.refresh(); App.toast("候选已生成", "3 个镜头进入待确认。", "success"); }, 300); }
          }, 300);
        });
      }
    });
  }

  /* ================= V5 · 分镜画布 ================= */
  var selNode = "n-s107";
  var NODE_META = {
    character: { label: "角色", icon: "users", tone: "gold" },
    scene: { label: "场景", icon: "folder", tone: "teal" },
    prop: { label: "道具", icon: "lock", tone: "info" },
    shot: { label: "镜头", icon: "activity", tone: "accent" }
  };

  function canvasPage() {
    var s = st();
    var nodes = s.canvasNodes, edges = s.canvasEdges;
    var metaById = {};
    nodes.forEach(function (n) { metaById[n.id] = n; });

    var edgesHTML = edges.map(function (e) {
      var a = metaById[e.from], b = metaById[e.to];
      if (!a || !b) return "";
      return '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" class="canvas-edge"/>';
    }).join("");

    var nodesHTML = nodes.map(function (n) {
      var m = NODE_META[n.type];
      var active = n.id === selNode;
      return '<button class="canvas-node node-' + m.tone + (active ? " active" : "") + '" data-node="' + n.id + '" style="left:' + n.x + "%;top:" + n.y + '%">' +
        '<span class="cn-icon">' + UI.icon(m.icon, 14) + '</span><span class="cn-body"><span class="cn-label">' + UI.esc(n.label) + '</span><span class="cn-sub">' + UI.esc(n.sub) + "</span></span>" +
        UI.statusBadge(n.status) + "</button>";
    }).join("");

    var sel = metaById[selNode];
    var related = edges.filter(function (e) { return e.from === selNode || e.to === selNode; }).map(function (e) {
      var otherId = e.from === selNode ? e.to : e.from;
      var o = metaById[otherId]; return o ? o : null;
    }).filter(Boolean);
    var selMeta = sel ? NODE_META[sel.type] : null;

    var sideBody = sel ?
      '<div class="kv"><div class="k">类型</div><div class="v">' + (selMeta ? selMeta.label : "—") + '</div><div class="k">状态</div><div class="v">' + UI.statusBadge(sel.status) + '</div><div class="k">说明</div><div class="v">' + UI.esc(sel.sub) + "</div></div>" +
      '<div class="mt-12"><div class="tiny muted mb-8">关联节点</div>' + (related.length ? related.map(function (r) {
        var rm = NODE_META[r.type];
        return '<div class="list-row" data-node="' + r.id + '"><span class="cn-icon sm">' + UI.icon(rm.icon, 13) + "</span><span class=\"lr-main\"><span class=\"lr-title\">" + UI.esc(r.label) + '</span><span class="lr-sub">' + UI.esc(r.sub) + "</span></span></div>";
      }).join("") : '<div class="tiny muted">暂无关联</div>') + "</div>"
      : UI.empty("未选中节点", "点击画布中的角色、场景、道具或镜头节点查看详情。");

    var sideAction = sel && sel.type === "shot"
      ? '<button class="btn btn-primary btn-block" data-act="open-shot-node">' + UI.icon("activity", 14) + "打开镜头合同</button>"
      : sel
        ? '<button class="btn btn-block" data-act="open-asset-node">' + UI.icon("folder", 14) + "查看资产</button>"
        : "";

    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Canvas · EP01", title: "分镜画布", desc: "以节点编排角色、场景、道具与镜头；连线表达引用与生成关系，与分镜台网格视图互为补充。",
        actions: '<a class="btn" href="' + App.link("production/storyboard") + '">' + UI.icon("grid") + "网格视图</a>" + (App.hasPerm("board:write") ? '<button class="btn btn-primary" data-act="canvas-add">' + UI.icon("plus") + "新增节点</button>" : "") }) +
      '<div class="grid g-3-1">' +
      UI.card({
        title: "EP01 关系画布", sub: "角色 / 场景 / 道具 → 镜头 · 节点位置为演示布局", cls: "flush",
        head: '<div class="legend">' + Object.keys(NODE_META).map(function (k) { var m = NODE_META[k]; return '<span class="legend-item"><span class="legend-dot node-' + m.tone + '"></span>' + m.label + "</span>"; }).join("") + "</div>",
        body: '<div class="canvas-board"><svg class="canvas-svg" viewBox="0 0 100 100" preserveAspectRatio="none">' + edgesHTML + "</svg>" + nodesHTML + "</div>"
      }) +
      UI.card({ title: "节点详情", sub: sel ? sel.label : "未选中", body: sideBody, bodyCls: "stack", foot: sideAction }) +
      "</div>" +
      '<div class="notice info mt-16">' + UI.icon("alert", 15) + "<span>画布只调整编排与引用关系；镜头参数、参考版本与提示词仍在分镜台 Shot Contract 中冻结。3D 导演台预演列入路线观察项，原型不提供。</span></div></div>";
  }

  /* ================= V5 · 配音台 ================= */
  var dubFilter = "all";

  function dubbingPage() {
    var s = st();
    var lines = s.dubbingLines;
    var counts = { all: lines.length, done: 0, review: 0, todo: 0 };
    lines.forEach(function (l) { counts[l.status] = (counts[l.status] || 0) + 1; });
    var list = lines.filter(function (l) { return dubFilter === "all" || l.status === dubFilter; });

    function roleName(id) { var c = s.characters.filter(function (x) { return x.id === id; })[0]; return c ? c.name : "旁白"; }
    function voiceName(id) { var v = s.voices.filter(function (x) { return x.id === id; })[0]; return v ? v.name : "—"; }

    var voiceCards = s.voices.map(function (v) {
      var role = v.roleId ? roleName(v.roleId) : "旁白 / 通用";
      return '<div class="voice-card"><div class="row between"><div class="row" style="gap:9px"><span class="voice-avatar">' + UI.avatar(role.charAt(0), "", "gold") + '</span><span><div class="voice-name">' + UI.esc(v.name) + '</div><div class="voice-sub">' + UI.esc(role) + " · " + UI.esc(v.lang) + "</div></span></div>" +
        (v.status === "bound" ? UI.badge("已绑定", "b-done") : UI.badge("待绑定", "b-todo")) + "</div>" +
      '<div class="voice-tone">' + UI.esc(v.tone) + "</div>" +
      '<div class="row between mt-8"><span class="tiny muted">' + UI.esc(v.ref) + "</span><button class=\"btn btn-xs btn-ghost\" data-act=\"voice-play\" data-id=\"" + v.id + "\">" + UI.icon("play", 12) + "试听 " + v.sample + "</button></div></div>";
    }).join("");

    var rows = list.map(function (l) {
      var lip = l.lip === "matched" ? '<span class="badge b-done">已匹配</span>' : l.lip === "pending" ? '<span class="badge b-warn">待匹配</span>' : '<span class="badge b-todo">无对白</span>';
      var action = l.status === "done"
        ? '<button class="btn btn-xs" data-act="line-play" data-id="' + l.id + '">' + UI.icon("play", 12) + "试听</button>"
        : '<button class="btn btn-xs btn-soft" data-act="line-synth" data-id="' + l.id + '">' + UI.icon("refresh", 12) + (l.status === "review" ? "重新合成" : "合成") + "</button>";
      return '<tr><td class="mono tiny">' + l.id + "</td><td class=\"mono tiny\">" + UI.esc(l.shot) + "</td><td><b>" + UI.esc(roleName(l.roleId)) + "</b></td><td>" + UI.esc(l.line) + "</td><td class=\"tiny mono\">" + l.dur + "</td><td class=\"small\">" + UI.esc(voiceName(l.voice)) + "</td><td>" + lip + "</td><td>" + UI.statusBadge(l.status === "done" ? "done" : l.status === "review" ? "review" : "todo") + "</td><td>" + action + "</td></tr>";
    });

    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Dubbing · EP01", title: "配音台", desc: "按角色绑定音色，合成对白与旁白；配音行回写时间线音频轨，对口型状态随画面生成结果更新。",
        actions: '<button class="btn" data-act="voice-library">' + UI.icon("sliders") + "音色管理</button>" + (App.hasPerm("timeline:write") ? '<button class="btn btn-primary" data-act="dub-batch">' + UI.icon("spark") + "批量合成待办</button>" : '<span class="badge b-locked">当前身份只读</span>') }) +
      '<div class="grid g4 mb-16">' +
      UI.stat({ label: "配音行", value: String(counts.all), unit: "条", delta: "EP01 · 19 条对白" }) +
      UI.stat({ label: "已合成", value: String(counts.done), delta: "可进入时间线" }) +
      UI.stat({ label: "待确认", value: String(counts.review), delta: "需复核情绪与停顿" }) +
      UI.stat({ label: "待开始", value: String(counts.todo), delta: "等待画面锁定" }) + "</div>" +
      '<div class="grid g-1-2">' +
      UI.card({ title: "音色库", sub: "5 个本地音色 · 未克隆外部样本", body: '<div class="stack">' + voiceCards + "</div>" }) +
      UI.card({
        title: "对白配音", sub: "合成结果回写 A1 · 对白轨",
        head: UI.tabs([{ key: "all", label: "全部", count: counts.all }, { key: "done", label: "已合成", count: counts.done }, { key: "review", label: "待确认", count: counts.review }, { key: "todo", label: "待开始", count: counts.todo }], dubFilter, "dfilter"),
        body: UI.table(["编号", "镜头", "角色", "台词", "时长", "音色", "对口型", "状态", "操作"], rows)
      }) + "</div>" +
      '<div class="notice info mt-16">' + UI.icon("lock", 15) + "<span>配音仅使用组织内本地音色或经合同审查的 TTS 渠道；不上传演员声音样本用于外部克隆。旁白行不参与对口型匹配。</span></div></div>";
  }

  AppModule.register({
    group: "production", label: "制作", icon: "grid",
    routes: [
      { path: "production/episodes", title: "分集与剧本", icon: "grid", render: episodesPage, badge: "12",
        mount: function (root) {
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]"); if (b) {
              var act = b.getAttribute("data-act");
              if (act === "filter") { epFilter = b.getAttribute("data-key"); App.refresh(); }
              if (act === "map") mapModal();
              if (act === "batch") batchModal();
              if (act === "replan") replanModal();
            }
            var ep = e.target.closest("[data-no]"); if (ep) openEpisode(ep.getAttribute("data-no"));
          });
        }
      },
      { path: "production/script", title: "剧本编辑器", icon: "feather", nav: false, navParent: "production/episodes", render: scriptPage,
        mount: function (root) {
          root.addEventListener("input", function (e) {
            var dot = document.getElementById("dirtyDot");
            if (dot && e.target.isContentEditable) dot.classList.add("show");
          });
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]"); if (!b) { var sc = e.target.closest("[data-scene]"); if (sc) { activeScene = Number(sc.getAttribute("data-scene")); App.navigate("production/script", { ep: "01" }); setTimeout(function(){ var blk=document.getElementById("sceneBlock"+activeScene); if(blk) blk.scrollIntoView({behavior:"smooth",block:"center"}); },30); } return; }
            var act = b.getAttribute("data-act");
            if (act === "save") { if (App.hasPerm("script:write")) saveScript(false); }
            if (act === "version") { if (App.hasPerm("script:write")) versionModal(); }
            if (act === "optimize") { if (App.hasPerm("script:write")) optimizeScene(); }
            if (act === "add-scene") { App.toast("已新增场次", "空白场次已追加到剧本末尾。", "success"); }
            if (act === "genthis") { App.toast("已加入队列", "EP02 剧本生成中，预计 40 秒。", "success"); }
          });
          root.addEventListener("keydown", function (e) {
            if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === "s") { e.preventDefault(); if (App.hasPerm("script:write")) saveScript(false); }
          });
        }
      },
      { path: "production/assets", title: "资产库", icon: "image", render: assetsPage,
        mount: function (root, params) {
          var search = root.querySelector("#assetSearch");
          if (search) {
            search.addEventListener("input", function () { assetQuery = search.value; filterAssets(); });
            filterAssets();
          }
          if (params.id) setTimeout(function () {
            var kind = st().characters.filter(function (x) { return x.id === params.id; }).length ? "character" : "asset";
            openAsset(params.id, kind);
          }, 20);
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]"); if (b) {
              var act = b.getAttribute("data-act");
              if (act === "type") { assetFilter = b.getAttribute("data-key"); App.refresh(); }
              if (act === "check") checkAssets();
              if (act === "batch") batchAssets();
              if (act === "new") App.toast("新增资产", "请在「故事圣经」中新增设定；资产库会自动同步。", "info");
            }
            var card = e.target.closest("[data-asset]"); if (card) openAsset(card.getAttribute("data-asset"), card.getAttribute("data-kind"));
          });
        }
      },
      { path: "production/storyboard", title: "分镜台", icon: "activity", render: storyboardPage,
        mount: function (root, params) {
          if (params.shot) setTimeout(function () { openShot(params.shot); }, 20);
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]"); if (b) {
              var act = b.getAttribute("data-act");
              if (act === "view") { shotView = b.getAttribute("data-view"); App.refresh(); }
              if (act === "sfilter") { shotFilter = b.getAttribute("data-key"); App.refresh(); }
              if (act === "batch") batchShots();
            }
            var sh = e.target.closest("[data-shot]"); if (sh) openShot(sh.getAttribute("data-shot"));
          });
        }
      },
      { path: "production/canvas", title: "分镜画布", icon: "grid", render: canvasPage,
        mount: function (root) {
          root.addEventListener("click", function (e) {
            var node = e.target.closest("[data-node]");
            if (node) { selNode = node.getAttribute("data-node"); App.refresh(); return; }
            var b = e.target.closest("[data-act]"); if (!b) return;
            var act = b.getAttribute("data-act");
            if (act === "open-shot-node") App.navigate("production/storyboard");
            else if (act === "open-asset-node") App.navigate("production/assets");
            else if (act === "canvas-add") App.toast("新增节点", "原型中新增节点可在后续迭代接入画布拖拽与连接。", "info");
          });
        }
      },
      { path: "production/dubbing", title: "配音台", icon: "feather", render: dubbingPage,
        mount: function (root) {
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]"); if (!b) return;
            var act = b.getAttribute("data-act");
            if (act === "dfilter") { dubFilter = b.getAttribute("data-key"); App.refresh(); }
            else if (act === "voice-play") App.toast("试听", "原型不包含真实音频，播放头为模拟状态。", "info");
            else if (act === "line-play") App.toast("试听", "配音行 " + b.getAttribute("data-id") + " 模拟播放中。", "info");
            else if (act === "line-synth") App.toast("合成任务已提交", "配音行 " + b.getAttribute("data-id") + " 已进入 TTS 队列。", "success");
            else if (act === "voice-library") App.toast("音色管理", "音色新增与参考音频上传将在 Provider 配置中开放。", "info");
            else if (act === "dub-batch") App.toast("批量合成", "待开始与待确认配音行已加入队列。", "success");
          });
        }
      }
    ]
  });
})();
