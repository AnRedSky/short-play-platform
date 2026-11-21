/* ============================================================
   模块：故事（story）
   故事圣经 / 小说改编
   ============================================================ */
(function () {
  function st() { return App.state; }
  var TABS = [
    { key: "character", label: "人物" },
    { key: "scene", label: "场景" },
    { key: "prop", label: "道具" },
    { key: "costume", label: "服装" },
    { key: "relations", label: "关系图" }
  ];

  function entityCard(x, kind) {
    var glyph = x.initial || x.name.charAt(0);
    return '<button class="entity-card" data-entity="' + x.id + '" data-kind="' + kind + '">' +
      '<div class="ec-top" style="background:linear-gradient(145deg,' + UI.hexA(x.color || "#8a7a62", .18) + "," + (x.color || "#8a7a62") + ')"><span class="ec-glyph">' + UI.esc(glyph) + '</span><span class="ec-ver">' + UI.badge(x.version || "REF v0", x.status === "locked" ? "b-teal" : "b-todo") + "</span></div>" +
      '<div class="ec-body"><div class="ec-name">' + UI.esc(x.name) + '</div><div class="ec-role">' + UI.esc(x.role || ({ scene: "场景", prop: "道具", costume: "服装" })[kind]) + "</div>" +
      '<div class="ec-anchor">' + UI.esc(x.anchor || x.desc) + "</div>" +
      '<div class="ec-foot"><span class="tiny muted">' + (x.refs || 0) + " 个引用</span>" + UI.statusBadge(x.status) + "</div></div></button>";
  }

  function entityGrid(kind) {
    var s = st();
    var arr = kind === "character" ? s.characters : s.assets.filter(function (a) { return a.type === kind; });
    return '<div class="entity-grid">' + arr.map(function (x) { return entityCard(x, kind); }).join("") + "</div>" +
      (arr.length ? "" : UI.empty("还没有设定", "新增一个设定，AI 会在后续镜头中引用它。"));
  }

  function relationSVG() {
    var s = st();
    var pos = {
      "周砚": [350, 150], "林晚": [500, 70], "陈叙": [520, 200], "阿棠": [220, 78], "老秦": [130, 190], "沈知白": [195, 262]
    };
    var colors = { mystery: "#b0853c", warm: "#2f6f68", conflict: "#bf443a" };
    var lines = s.relations.map(function (r) {
      var a = pos[r.from], b = pos[r.to];
      if (!a || !b) return "";
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 18;
      return '<path d="M' + a[0] + " " + a[1] + " Q" + mx + " " + my + " " + b[0] + " " + b[1] + '" fill="none" stroke="' + (colors[r.type] || "#a9a294") + '" stroke-width="1.5" stroke-dasharray="' + (r.type === "conflict" ? "5 4" : "none") + '" opacity=".78"/>' +
        '<text x="' + mx + '" y="' + (my - 2) + '" text-anchor="middle" font-size="8" fill="#77746b">' + UI.esc(r.label) + "</text>";
    }).join("");
    var nodes = Object.keys(pos).map(function (name) {
      var c = s.characters.filter(function (x) { return x.name === name; })[0] || { color: "#8a7a62", initial: name.charAt(0) };
      return '<g transform="translate(' + pos[name][0] + "," + pos[name][1] + ')"><circle r="24" fill="' + UI.hexA(c.color, .9) + '" stroke="#fff" stroke-width="2"/><text y="4" text-anchor="middle" font-family="Songti SC,serif" font-size="11" fill="#fff">' + UI.esc(name) + "</text></g>";
    }).join("");
    return '<div class="relation-map"><svg viewBox="0 0 660 330" role="img" aria-label="人物关系图">' + lines + nodes + "</svg>" +
      '<div class="row wrap tiny muted" style="justify-content:center;gap:16px"><span><i class="dot" style="background:#b0853c"></i> 悬念</span><span><i class="dot" style="background:#2f6f68"></i> 温情</span><span><i class="dot" style="background:#bf443a"></i> 冲突</span></div></div>';
  }

  function storyPage(params) {
    var tab = params.tab || "character";
    if (TABS.every(function (t) { return t.key !== tab; })) tab = "character";
    var tabs = UI.tabs(TABS.map(function (t) {
      var n = t.key === "character" ? st().characters.length : t.key === "relations" ? st().relations.length : st().assets.filter(function (a) { return a.type === t.key; }).length;
      return { key: t.key, label: t.label, count: t.key === "relations" ? undefined : n };
    }), tab, "tab");
    var body = tab === "relations" ? relationSVG() : entityGrid(tab);
    var count = tab === "character" ? st().characters.length : tab === "relations" ? st().relations.length : st().assets.filter(function (a) { return a.type === tab; }).length;
    var total = st().characters.length + st().assets.length;
    return '<div class="page">' +
      UI.pageHead({ eyebrow: "Story bible · " + st().storyVersion, title: "故事圣经", desc: "锁定人物、场景、道具与服装的视觉锚点。下游剧本、分镜和生成都会引用这里的版本。",
        actions: '<a class="btn" href="' + App.link("story/import") + '">小说改编</a>' + (App.hasPerm("story:write") ? '<button class="btn" data-act="check">' + UI.icon("check") + '一致性检查</button><button class="btn" data-act="new">' + UI.icon("plus") + '新增设定</button><button class="btn btn-primary" data-act="version">保存新版本</button>' : '<span class="badge b-locked">只读身份</span>') }) +
      '<div class="card"><div class="card-head"><div><h3>设定库</h3><div class="ch-sub">共 ' + total + ' 项 · ' + st().characters.length + ' 角色 + ' + st().assets.length + ' 项制作资产 · 当前 <b>' + st().storyVersion + "</b></div></div><span class=\"badge b-teal\">" + count + " 项当前视图</span></div>" +
      '<div class="card-body">' + tabs + body + "</div></div>" +
      '<div class="notice info mt-16">' + UI.icon("lock", 15) + "<span>保存设定会产生新版本；已被镜头引用的资产会标记待检查。导出前必须通过质检 gate。</span></div></div>";
  }

  function openEntity(id, kind) {
    var s = st();
    var item = kind === "character" ? s.characters.filter(function (x) { return x.id === id; })[0] : s.assets.filter(function (x) { return x.id === id; })[0];
    if (!item) return;
    var isChar = kind === "character";
    var body = '<div class="row" style="gap:14px;align-items:flex-start;margin-bottom:14px">' +
      '<div class="asset-thumb" style="width:92px;flex:0 0 92px;aspect-ratio:4/5;background:linear-gradient(155deg,' + UI.hexA(item.color || "#7a6a55", .2) + "," + (item.color || "#7a6a55") + ')"><span class="at-glyph">' + UI.esc(item.initial || item.name.charAt(0)) + "</span></div>" +
      '<div><div class="badge b-teal">' + UI.esc(item.version) + '</div><div class="tiny muted mt-8">引用 ' + (item.refs || 0) + ' 个下游对象 · 状态 ' + UI.esc(item.status) + "</div>" +
      '<div class="tiny muted">最近更新：今天 10:24 · 陈默</div></div></div>' +
      '<div class="form-grid">' +
      '<div class="field span2"><label>名称</label><input class="input" value="' + UI.esc(item.name) + '" disabled></div>' +
      (isChar ? '<div class="field"><label>角色定位</label><input class="input" id="efRole" value="' + UI.esc(item.role) + '"></div><div class="field"><label>声音 / 说话方式</label><input class="input" id="efVoice" value="' + UI.esc(item.voice || "") + '"></div>' : "") +
      '<div class="field span2"><label>设定描述</label><textarea class="textarea" id="efDesc" rows="4">' + UI.esc(item.desc) + "</textarea></div>" +
      (isChar ? '<div class="field span2"><label>视觉锚点</label><textarea class="textarea" id="efAnchor" rows="2">' + UI.esc(item.anchor || "") + '</textarea><span class="hint">至少 3 个稳定特征，避免生成时角色漂移。</span></div>' :
        '<div class="field span2"><label>生成提示词</label><textarea class="textarea" id="efPrompt" rows="3">' + UI.esc(item.prompt || "") + '</textarea><span class="hint">用于参考图与画面生成，修改后需重新生成参考。</span></div>') +
      "</div>" +
      '<div class="notice mt-16">此设定已被 <b>' + (item.refs || 0) + '</b> 个镜头引用。保存会产生新版本，受影响的镜头会被标记待检查。</div>';
    if (!App.hasPerm("story:write")) {
      App.drawer({ eyebrow: "Story bible", title: item.name, sub: item.version + " · " + (item.role || "资产设定"), body: body, footer: '<button class="btn" data-close>关闭</button>' });
      return;
    }
    App.drawer({
      eyebrow: "Story bible", title: item.name, sub: item.version + " · " + (item.role || "资产设定"), body: body,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="saveEntity">保存设定</button>',
      onMount: function (el, close) {
        el.querySelector("#saveEntity").addEventListener("click", function () {
          var desc = el.querySelector("#efDesc").value.trim();
          if (!desc) { App.toast("无法保存", "设定描述不能为空。", "danger"); return; }
          App.state.characters.concat(App.state.assets).forEach(function (x) {
            if (x.id !== item.id) return;
            x.desc = desc;
            if (isChar) {
              x.role = el.querySelector("#efRole").value.trim();
              x.anchor = el.querySelector("#efAnchor").value.trim();
              x.voice = el.querySelector("#efVoice").value.trim();
              x.version = "REF v" + (parseInt(String(x.version).replace(/[^0-9]/g, ""), 10) + 1);
            } else x.prompt = el.querySelector("#efPrompt").value.trim();
            x.status = "review";
          });
          App.state.activity.unshift([App.nowStamp(), App.currentUser.name, "更新「" + item.name + "」设定并保存新版本", "script"]);
          close(); App.refresh();
          App.toast("设定已保存", "新版本已生成，受影响的下游对象已标记待检查。", "success");
        });
      }
    });
  }

  function newEntity() {
    var body = '<div class="form-grid">' +
      '<div class="field"><label>类型</label><select class="select" id="neType"><option value="character">人物</option><option value="scene">场景</option><option value="prop">道具</option><option value="costume">服装</option></select></div>' +
      '<div class="field"><label>名称<span class="req">*</span></label><input class="input" id="neName" placeholder="例如：旧钟楼"><span class="err-msg" id="neErr">请填写名称</span></div>' +
      '<div class="field span2"><label>一句话设定</label><textarea class="textarea" id="neDesc" rows="3" placeholder="它在故事里承担什么作用？最稳定的视觉特征是什么？"></textarea></div></div>' +
      '<div class="notice info mt-16">新增设定会进入「草稿」状态，确认后再锁定为参考版本。</div>';
    App.modal({
      title: "新增设定", sub: "人物、场景、道具与服装都从这里进入故事圣经。",
      body: body, footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="neSave">创建设定</button>',
      onMount: function (el, close) {
        el.querySelector("#neSave").addEventListener("click", function () {
          var name = el.querySelector("#neName").value.trim();
          if (!name) { el.querySelector("#neErr").classList.add("show"); return; }
          var type = el.querySelector("#neType").value;
          var desc = el.querySelector("#neDesc").value.trim() || "演示设定，待补充视觉锚点。";
          var base = { id: "new-" + Date.now(), name: name, type: type, status: "draft", refs: 0, version: "REF v0", desc: desc, color: "#7a6a55", initial: name.charAt(0) };
          if (type === "character") {
            base.role = "新增角色"; base.anchor = desc; base.voice = "待确定";
            App.state.characters.push(base);
          } else {
            base.prompt = desc;
            App.state.assets.push(base);
          }
          close(); App.refresh();
          App.toast("已创建", "「" + name + "」已加入故事圣经草稿。", "success");
        });
      }
    });
  }

  function bumpVersion() {
    var n = parseInt(String(st().storyVersion).replace(/[^0-9]/g, ""), 10) + 1;
    st().storyVersion = "v" + n;
    st().activity.unshift([App.nowStamp(), App.currentUser.name, "保存故事圣经 " + st().storyVersion + " 并锁定 18 项设定", "script"]);
    App.refresh();
    App.toast("版本已保存", "故事圣经 " + st().storyVersion + " 已锁定，下游引用已刷新。", "success");
  }

  function consistency() {
    var s = st();
    App.modal({
      title: "一致性检查", sub: "检查视觉锚点、参考版本与镜头引用", size: "lg",
      body: '<div class="stack"><div class="notice success">' + UI.icon("check", 15) + "<span>18 项设定中 15 项已锁定参考；3 项仍为草稿。</span></div>" +
        s.characters.map(function (c) {
          return '<div class="list-row">' + UI.avatar(c.name, "sm", c.color) + '<span class="lr-main"><span class="lr-title">' + UI.esc(c.name) + '</span><span class="lr-sub">' + UI.esc(c.anchor) + '</span></span>' + UI.statusBadge(c.status) + "</div>";
        }).join("") + "</div>",
      footer: '<button class="btn" data-close>关闭</button><a class="btn btn-primary" href="' + App.link("production/assets") + '">去补参考</a>'
    });
  }

  /* ---------- 小说改编 ---------- */
  var wiz = null;
  function initWiz() {
    wiz = { step: 1, source: "", fileName: "", authorized: false, perEp: 2, entities: {} };
  }

  function importPage() {
    if (!wiz) initWiz();
    var steps = ["源文导入", "章节边界", "实体确认", "生成分集"];
    var head = '<div class="page">' + UI.pageHead({ eyebrow: "Import · Novel to series", title: "小说改编", desc: "一次导入、三次确认：章节边界 → 实体确认 → 生成分集。所有解析均为前端模拟。", actions: '<a class="btn" href="' + App.link("story/bible") + '">故事圣经</a>' + (App.hasPerm("story:write") ? '<button class="btn" data-act="reset">重新开始</button>' : "") });
    var stepper = '<div class="wizard-steps">' + steps.map(function (x, i) {
      var n = i + 1, cls = n < wiz.step ? "done" : n === wiz.step ? "active" : "";
      return '<div class="wiz-step ' + cls + '"><span class="n">' + (n < wiz.step ? "✓" : n) + "</span><span>" + x + "</span></div>";
    }).join("") + "</div>";

    var content = "";
    if (wiz.step === 1) {
      content = '<div class="wiz-panel"><div class="grid g2"><div>' +
        '<div class="dropzone"><div class="dz-icon">' + UI.icon("upload", 22) + '</div><b>导入小说原文</b><p>支持 .txt / .md；原型只在本地读取，不上传。</p>' +
        '<div class="row mt-16" style="justify-content:center;gap:8px"><button class="btn" data-act="pick">选择文件</button><button class="btn btn-ghost" data-act="sample">使用示例小说</button></div>' +
        '<input type="file" id="filePick" accept=".txt,.md" hidden>' + (wiz.fileName ? '<div class="notice success mt-16">' + UI.icon("check", 15) + "<span>已读取 <b>" + UI.esc(wiz.fileName) + "</b> · " + wiz.source.length + " 字</span></div>" : "") + "</div></div>" +
        '<div><div class="field"><label>原文预览</label><textarea class="textarea" id="srcText" rows="12" placeholder="粘贴小说开头，或从左侧选择文件。">' + UI.esc(wiz.source) + '</textarea><span class="hint">建议 2,000 字以上，章节标题用「第 N 章」。</span></div>' +
        '<label class="checkline mt-12"><input type="checkbox" id="authCheck"' + (wiz.authorized ? " checked" : "") + '><span>我确认拥有该作品的改编授权，且内容不涉及侵权与敏感信息。<span class="req">*</span></span></label>' +
        '<div class="err-msg" id="authErr">请先确认改编授权。</div>' +
        '<div class="notice warn mt-12">' + UI.icon("alert", 15) + "<span>原型不调用解析模型。示例小说会使用内置 24 章数据。</span></div></div></div></div>";
    }
    if (wiz.step === 2) {
      var chs = st().chapters.slice(0, 16);
      content = '<div class="wiz-panel"><div class="between mb-12"><div><b>识别到 24 章 · 约 7.2 万字</b><div class="tiny muted">建议每 2 章合并为 1 集，共 12 集。可拖动顺序或并入相邻章节。</div></div>' +
        '<div class="row"><span class="tiny muted">每集</span><select class="select" id="perEp" style="width:84px"><option value="2"' + (wiz.perEp === 2 ? " selected" : "") + '>2 章</option><option value="3"' + (wiz.perEp === 3 ? " selected" : "") + '>3 章</option></select></div></div>' +
        '<div class="grid g2"><div class="card card-pad" style="max-height:420px;overflow:auto">' + chs.map(function (c, i) {
          return '<div class="chapter-row"><span class="ch-no">' + c.no + '</span><span class="ch-main"><span>' + UI.esc(c.title) + '</span><span class="ch-sub">' + c.words + " 字 · 第 " + Math.floor(i / wiz.perEp + 1) + '</span></span><span class="badge b-teal">EP' + String(Math.min(12, Math.floor(i / wiz.perEp + 1))).padStart(2, "0") + "</span></div>";
        }).join("") + '</div><div><div class="card card-pad"><div class="eyebrow">分集预览</div><div class="stack mt-12">' + [1, 2, 3, 4, 5, 6].map(function (n) {
          return '<div class="list-row"><span class="mono tiny muted">EP0' + n + '</span><span class="lr-main"><span class="lr-title">第 ' + ((n - 1) * wiz.perEp + 1) + "–" + (n * wiz.perEp) + ' 章</span><span class="lr-sub">约 ' + Math.round(((n - 1) * wiz.perEp + 1) * 3000 / 2) + ' 字 · 钩子待生成</span></span>' + UI.badge("草稿", "b-todo") + "</div>";
        }).join("") + '</div></div><div class="notice info mt-12">章节拆分只影响分集边界，不修改原文。锁版剧本不会被覆盖。</div></div></div></div>';
    }
    if (wiz.step === 3) {
      var ents = st().entities.slice(0, 10);
      content = '<div class="wiz-panel"><div class="between mb-12"><div><b>抽取 46 个实体 · 8 个待确认</b><div class="tiny muted">合并同名实体，忽略一次性路人。确认后的实体进入故事圣经。</div></div><span class="badge b-warn">8 待确认</span></div>' +
        '<div class="grid g2"><div class="card card-pad" style="max-height:420px;overflow:auto">' + ents.map(function (e, i) {
          var on = wiz.entities[e.name] === undefined ? e.status === "confirmed" : wiz.entities[e.name];
          return '<label class="entity-confirm-row"><input type="checkbox" data-ent="' + UI.esc(e.name) + '"' + (on ? " checked" : "") + '><span style="flex:1"><b>' + UI.esc(e.name) + '</b><span class="tiny muted" style="display:block">' + UI.esc(e.type) + " · 出现 " + e.mentions + " 次 · " + UI.esc(e.note) + '</span></span><span class="badge ' + (e.status === "confirmed" ? "b-done" : "b-warn") + '">' + (e.status === "confirmed" ? "已确认" : "待确认") + "</span></label>";
        }).join("") + '</div><div><div class="card card-pad"><div class="eyebrow">合并建议</div><div class="stack mt-12">' +
          '<div class="list-row"><span class="lr-main"><span class="lr-title">「沈知白」与「沈先生」</span><span class="lr-sub">文本相似 · 出现 54 次</span></span><button class="btn btn-xs" data-act="merge">合并</button></div>' +
          '<div class="list-row"><span class="lr-main"><span class="lr-title">「长夜书店」与「旧书店」</span><span class="lr-sub">同一地点 · 出现 121 次</span></span><button class="btn btn-xs" data-act="merge">合并</button></div>' +
          '<div class="list-row"><span class="lr-main"><span class="lr-title">「天台」</span><span class="lr-sub">第 7、9 集重复出现</span></span><button class="btn btn-xs" data-act="merge">保留</button></div></div></div>' +
          '<div class="notice success mt-12">' + UI.icon("check", 15) + "<span>已确认 38 / 46 个实体。</span></div></div></div></div>";
    }
    if (wiz.step === 4) {
      content = '<div class="wiz-panel"><div class="grid g-2-1"><div><div class="card card-pad"><div class="eyebrow">生成计划</div><div class="stack mt-12">' +
        ['12 集分集大纲', '每集 3 个钩子与结尾悬念', '人物小传与视觉锚点初稿', '12 集季卡与章节映射'].map(function (x) {
          return '<div class="list-row"><span class="ok" style="color:var(--success)">' + UI.icon("check", 15) + '</span><span class="lr-main"><span class="lr-title">' + x + '</span></span></div>';
        }).join("") + '</div></div><div class="notice warn mt-12">' + UI.icon("alert", 15) + "<span>原型不调用真实模型，生成结果为内置演示数据。</span></div></div>" +
        '<div><div class="card card-pad"><div class="eyebrow">本次输入</div><div class="kv mt-12"><div class="k">原文</div><div class="v">' + (wiz.fileName ? UI.esc(wiz.fileName) : "示例小说") + '</div><div class="k">章节</div><div class="v">24 章 / ' + wiz.perEp + ' 章每集</div><div class="k">分集</div><div class="v">12 集</div><div class="k">实体</div><div class="v">46 个 / 38 确认</div><div class="k">预计</div><div class="v">约 2 分 10 秒</div></div>' +
        '<button class="btn btn-primary btn-block mt-16" data-act="generate">生成 12 集大纲</button></div></div></div></div>';
    }

    var foot = '<div class="between mt-16"><button class="btn" data-act="back"' + (wiz.step === 1 ? " disabled" : "") + '>上一步</button>' +
      (wiz.step < 4 ? '<button class="btn btn-primary" data-act="next">下一步 · ' + steps[wiz.step] + "</button>" : '<span class="tiny muted">确认后进入分集与剧本</span>') + "</div>";
    return head + '<div class="card"><div class="card-body">' + stepper + content + foot + "</div></div></div>";
  }

  var Actions = {
    next: function () {
      if (wiz.step === 1) {
        var text = document.getElementById("srcText").value.trim();
        var auth = document.getElementById("authCheck").checked;
        wiz.source = text;
        wiz.authorized = auth;
        if (!text) { App.toast("缺少原文", "请粘贴小说原文，或使用示例小说。", "warn"); return; }
        if (!auth) { document.getElementById("authErr").classList.add("show"); App.toast("需要授权确认", "请勾选改编授权后再继续。", "danger"); return; }
      }
      if (wiz.step === 2) {
        var sel = document.getElementById("perEp");
        if (sel) wiz.perEp = Number(sel.value);
      }
      if (wiz.step < 4) { wiz.step++; App.refresh(); }
    },
    back: function () { if (wiz.step > 1) { wiz.step--; App.refresh(); } },
    sample: function () {
      wiz.fileName = "长夜将明_原文.txt";
      wiz.source = "第一章 雨夜来客\n\n暴雨封街，长夜书店的玻璃像被人用指节不停敲打……\n\n第二章 黑皮账簿\n\n账簿第一页写着周砚的名字，和第二天的日期……\n\n（示例节选，完整演示使用内置 24 章数据）";
      App.refresh();
    },
    pick: function () {
      var input = document.getElementById("filePick");
      if (!input) return;
      input.click();
    },
    generate: function () {
      var body = '<div class="stack"><div class="notice info">' + UI.icon("spark", 15) + "<span>正在生成 12 集大纲与分集钩子，请保持页面打开。</span></div>" +
        '<div id="genBar">' + UI.progress(0) + '</div><div class="tiny muted mt-8" id="genMsg">准备输入…</div>' +
        '<div class="export-log mt-12" id="genLog"><div>[00:00] 冻结原文与实体版本</div></div></div>';
      App.modal({
        title: "生成分集", sub: "解析 → 大纲 → 钩子 → 季卡", body: body, footer: '<button class="btn" data-close>后台运行</button>',
        onMount: function (el, close) {
          var pcts = [12, 36, 58, 76, 92, 100];
          var msgs = ["解析 24 章结构…", "抽取分集钩子…", "生成 12 集大纲…", "校验人物与场景引用…", "写入季卡…", "完成"];
          var i = 0;
          var timer = setInterval(function () {
            var bar = el.querySelector("#genBar .progress > i");
            if (!bar) { clearInterval(timer); return; }
            bar.style.width = pcts[i] + "%";
            el.querySelector("#genMsg").textContent = msgs[i];
            el.querySelector("#genLog").innerHTML += "<div>[" + App.nowStamp() + "] " + msgs[i] + "</div>";
            i++;
            if (i >= pcts.length) {
              clearInterval(timer);
              st().pipeline.episodes = "active";
              st().activity.unshift([App.nowStamp(), "系统", "《长夜将明》生成 12 集大纲与钩子", "ok"]);
              setTimeout(function () {
                close();
                App.navigate("production/episodes");
                App.toast("分集已生成", "12 集季卡与章节映射已写入，可批量生成剧本。", "success");
              }, 600);
            }
          }, 380);
        }
      });
    },
    reset: function () { initWiz(); App.refresh(); },
    merge: function () { App.toast("已合并", "同名实体已合并，关系引用保留。", "success"); }
  };

  AppModule.register({
    group: "story", label: "故事", icon: "book",
    routes: [
      {
        path: "story/bible", title: "故事圣经", icon: "book", render: storyPage,
        mount: function (root, params) {
          if (params.id) {
            var kind = params.tab === "scene" || params.tab === "prop" || params.tab === "costume" ? params.tab : "character";
            setTimeout(function () { openEntity(params.id, kind); }, 30);
          }
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]"); if (b) {
              var act = b.getAttribute("data-act");
              if (act === "tab") App.navigate("story/bible", { tab: b.getAttribute("data-key") });
              if (act === "new") { if (App.hasPerm("story:write")) newEntity(); else App.toast("暂无权限", "当前身份只能查看故事圣经。", "warn"); }
              if (act === "version") { if (App.hasPerm("story:write")) bumpVersion(); else App.toast("暂无权限", "当前身份不能保存版本。", "warn"); }
              if (act === "check") consistency();
            }
            var card = e.target.closest("[data-entity]");
            if (card) openEntity(card.getAttribute("data-entity"), card.getAttribute("data-kind"));
          });
        }
      },
      {
        path: "story/import", title: "小说改编", icon: "feather", render: importPage,
        mount: function (root) {
          root.addEventListener("change", function (e) {
            if (e.target.id === "authCheck") { wiz.authorized = e.target.checked; document.getElementById("authErr").classList.remove("show"); }
            if (e.target.id === "filePick" && e.target.files && e.target.files[0]) {
              var f = e.target.files[0];
              var reader = new FileReader();
              reader.onload = function () { wiz.fileName = f.name; wiz.source = String(reader.result || "").slice(0, 12000); App.refresh(); App.toast("已读取", f.name, "success"); };
              reader.readAsText(f, "utf-8");
            }
            if (e.target.matches("[data-ent]")) wiz.entities[e.target.getAttribute("data-ent")] = e.target.checked;
            if (e.target.id === "perEp") { wiz.perEp = Number(e.target.value); App.refresh(); }
          });
          root.addEventListener("click", function (e) {
            var b = e.target.closest("[data-act]"); if (!b) return;
            var act = b.getAttribute("data-act");
            if (act === "next") Actions.next();
            if (act === "back") Actions.back();
            if (act === "sample") Actions.sample();
            if (act === "pick") Actions.pick();
            if (act === "generate") Actions.generate();
            if (act === "reset") Actions.reset();
            if (act === "merge") Actions.merge();
          });
        }
      }
    ]
  });
})();
