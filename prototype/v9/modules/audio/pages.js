/* 模块：audio 音频与字幕（员工工作台） */
(function () {
  const U = UI, D = DB, SCOPE = "audio";
  const projectOfShot = (shot) => String(shot || "").match(/SH-(\d+)/) ? "SP-" + String(shot).match(/SH-(\d+)/)[1] : "";
  const voiceProject = (v) => v.project || "";
  const lipProject = (l) => projectOfShot(l.shot) || (D.dialogues.find(d => d.id === l.line) || {}).project || "";

  AppModule.register({
    group: "audio", label: "音频与字幕", icon: "audio", order: 6, end: "workspace",
    routes: [
      {
        path: "audio/dialogue", title: "对白配音", icon: "audio", permission: "production.write",
        desc: "对白按「台词 → 音色 → 情绪 → 回听校验」推进；生成成功不等于可用，必须回听与 ASR 一致才可进入后期。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.projectGuard("音频与字幕 / 对白配音", "对白配音按项目与集读取锁定剧本；未选择项目时不会串用其他项目的声音或台词。");
          const pid = p.id;
          const list = D.dialogues.filter(x => x.project === pid).sort((a, b) => (a.ep - b.ep) || String(a.id).localeCompare(String(b.id)));
          const canEdit = !!p && ["已交付", "已归档"].indexOf(p.status) < 0;
          const rows = list.map(x =>
            '<tr><td>' + U.code(x.id) + '<div class="faint small">' + U.esc(x.project) + " · E" + x.ep + "</div></td><td>" + U.esc(x.char) + '</td><td class="cell-wrap">' + U.esc(x.text) + '</td><td class="cell-wrap muted">' + U.esc(x.voice) + " · " + U.esc(x.emotion) + "</td><td>" + U.esc(x.audio) + "</td><td>" + U.esc(x.asr) + "</td><td>" + U.pill(x.status) + '</td><td class="num">¥' + x.cost.toFixed(1) + "</td><td>" +
            U.btn("回听", "audio.listen", "sm", { id: x.id }) + (canEdit ? " " + U.btn("重生成", "audio.regenLine", "sm", { id: x.id }) : "") + "</td></tr>").join("");
          const passed = list.filter(x => x.status === "已通过").length;
          const running = list.filter(x => x.status === "执行中").length;
          const fix = list.filter(x => x.status === "待修复").length;
          const rest = list.length - passed - running - fix;
          const bad = list.filter(x => /不一致|偏低|待校对/.test(String(x.asr || "")));
          const cost = list.reduce((s, x) => s + (Number(x.cost) || 0), 0);
          const lips = D.lipSync.filter(l => lipProject(l) === pid).sort((a, b) => String(a.id).localeCompare(String(b.id)));
          const lipCost = lips.reduce((s, l) => s + (Number(l.cost) || 0), 0);
          const eps = [...new Set(list.map(x => x.ep))].sort((a, b) => a - b);
          const epText = eps.length ? "E" + eps.join(" / E") : "暂无已录对白";
          const first = bad[0];
          return U.page("音频与字幕 / 对白配音", "对白配音", "情绪与语气按剧本标注；不得自行改写台词，改台词必须回剧本版本。",
            (canEdit ? U.btn("批量生成对白", "audio.batchDialogue", "primary", { pid: pid }) : "") + U.btn("查看声音档案", "audio.toVoice", "", { pid: pid }),            '<div class="grid grid-4">' +
              U.metric("对白总数", String(list.length), U.esc(p ? p.name : pid) + " · " + epText, "▤") +
              U.metric("已通过", String(passed), "ASR 回听一致", "✓") +
              U.metric("回听异常", String(bad.length), "ASR 与文本 / 音量不符", "!") +
              U.metric("对白成本", "¥" + DB.state.money(cost), "按条计费 · 失败也入账", "¥") +
            "</div>" +
            U.card("对白清单 · " + U.esc(p ? p.name : pid), U.table(["对白", "角色", "台词", "音色 / 情绪", "音频", "回听", "状态", "成本", "操作"], rows, "当前项目暂无可配音对白"), list.length ? "按对白对象逐条生成，改台词必须回剧本" : "当前项目暂无可配音对白") +
            '<div class="split mt-4"><div class="stack">' +
              U.card("生成与校验规则", U.table(["阶段", "要求", "不通过处理"], [
                ["台词来源", "锁定剧本版本中的对白对象", "回剧本修改，不在配音页改词"],
                ["音色", "绑定声音档案版本", "缺失则阻断，不临时试音"],
                ["情绪", "按场次情绪标注", "情绪不符判 REVIEW_REQUIRED"],
                ["回听", "ASR 与文本一致 + 音量达标", "重生成或调整语气后重试"]
              ].map(r => "<tr><td class=\"cell-strong\">" + r[0] + '</td><td class="cell-wrap">' + r[1] + '</td><td class="cell-wrap muted">' + r[2] + "</td></tr>").join("")), "不通过项必须重生成或明确接受") +
              U.card("当前项目音频成本", U.listRows([["对白生成", "¥" + DB.state.money(cost)], ["口型对齐", "¥" + DB.state.money(lipCost)], ["合计", "¥" + DB.state.money(cost + lipCost)]]) , "只统计当前项目已入账记录") +
            '</div><div class="stack">' +
              U.card("对白状态分布", U.donut([
                { label: "已通过", value: passed, color: "var(--ok)" },
                { label: "执行中", value: running, color: "var(--accent)" },
                { label: "待修复", value: fix, color: "var(--warn)" },
                { label: "未生成", value: Math.max(0, rest), color: "var(--line-strong)" }
              ], "对白", String(list.length)), "按当前项目对白条目计数") +
              U.notice("口径与规则见《口径与规则汇总》§R-05：异常提示", "info") +
            "</div></div>"
          );
        }
      },
      {
        path: "audio/voice", title: "声音档案", icon: "users", permission: "production.write",
        desc: "音色属于人物档案的一部分：语言、音高、语速、情绪范围与权利状态。真人克隆必须留存授权。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.projectGuard("音频与字幕 / 声音档案", "声音档案与项目人物绑定；未选择项目时不展示其他角色的音色与授权。");
          const pid = p.id;
          const voices = D.voiceProfiles.filter(v => voiceProject(v) === pid);
          const canEdit = !!p && ["已交付", "已归档"].indexOf(p.status) < 0;
          const rows = voices.map(v =>
            '<tr><td>' + U.code(v.id) + "</td><td>" + U.entity(v.char, v.lang) + '</td><td class="cell-wrap">' + U.esc(v.timbre) + '</td><td>' + U.esc(v.rate) + '</td><td class="cell-wrap muted">' + U.esc(v.emotion) + '</td><td class="cell-wrap">' + U.esc(v.rights) + "</td><td>" + U.esc(v.coverage) + "</td><td>" + U.pill(v.status) + "</td><td>" +
            U.btn("试听", "audio.previewVoice", "sm", { id: v.id }) + " " + U.btn("档案", "audio.voiceDetail", "sm", { id: v.id }) + "</td></tr>").join("");
          const risk = voices.find(v => /待复核|到期|停用/.test(String(v.status)));
          const list = D.dialogues.filter(x => x.project === pid).sort((a, b) => (a.ep - b.ep) || String(a.id).localeCompare(String(b.id)));
          const badDlg = list.filter(x => /不一致|偏低/.test(String(x.asr || ""))).length;
          const badLip = D.lipSync.filter(l => lipProject(l) === pid && l.status !== "已通过").length;
          const badSub = D.subtitles.filter(s => s.project === pid && s.status !== "已通过").length;
          return U.page("音频与字幕 / 声音档案", "声音档案", "声音档案版本变更会影响已生成对白与口型；变更前必须列出受影响集次。",
            (canEdit ? U.btn("新建声音档案", "audio.newVoice", "primary", { pid: pid }) + U.btn("授权复核", "audio.rightsCheck", "primary", { pid: pid }) : U.btn("授权台账", "audio.toRights", "", { pid: pid })),
            U.card("声音档案 · " + U.esc(p ? p.name : pid), U.table(["档案", "角色 / 语言", "音色", "语速", "情绪范围", "权利来源", "覆盖集次", "状态", "操作"], rows, "当前项目还没有声音档案"), voices.length ? "每个角色一份档案，版本变更需列出受影响对白" : "当前项目还没有声音档案") +
            '<div class="split mt-4"><div class="stack">' +
              (risk ? U.card("授权风险 · " + risk.id, U.desc([["角色", risk.char], ["语言", risk.lang], ["权利来源", risk.rights], ["覆盖", risk.coverage], ["状态", risk.status], ["影响", "未解除前相关对白不可进入交付"]]) +
                '<div class="btn-row-inline">' + (canEdit ? U.btn("续期登记", "audio.renew", "primary", { id: risk.id, pid: pid }) + U.btn("替换音色", "audio.replaceVoice", "", { id: risk.id, pid: pid }) : U.btn("授权台账", "audio.toRights", "", { pid: pid })) + "</div>", "授权到期前必须续期或替换") :
                U.card("授权状态", U.notice("当前项目没有授权临期或停用的声音档案；交付前仍会按项目授权台账复核。", "ok"), "按项目复核")) +
              U.card("试听占位", U.notice("静态原型不内置媒体文件：试听入口展示音色参数与波形结构，不播放音频。", "info") +
                '<div class="wave-box"><span class="wave-line"></span><span class="faint small">48kHz · 单声道 · −16 LUFS（参数取自最近一次生成记录）</span></div>', "不伪造音频内容") +
            '</div><div class="stack">' +
              U.card("音频异常 · " + U.esc(p ? p.name : pid), '<div class="kv-grid">' + U.kv("对白异常", badDlg + " 条") + U.kv("口型不匹配", badLip + " 条") + U.kv("字幕待处理", badSub + " 条") + U.kv("声音档案", voices.length + " 份") + "</div>", "当前项目实际记录") +
              U.notice("音色与成本口径：一人一档、跨集同版本、真人声音须留授权；语音按生成秒数计费，失败与重试同样入账（§R-08 / §R-09）。", "info") +
            "</div></div>"
          );
        }
      },
      {
        path: "audio/bgm", title: "配乐与音效", icon: "audio", permission: "production.write",
        desc: "配乐与音效必须可追溯来源与授权。来源不明或授权不明确的素材一律阻断交付，不用「先交付后补」。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.projectGuard("音频与字幕 / 配乐与音效", "配乐与音效授权按项目登记；未选择项目时不允许借用其他项目的素材台账。");
          const pid = p.id;
          const assets = D.audioAssets.filter(a => a.project === pid);
          const canEdit = !!p && ["已交付", "已归档"].indexOf(p.status) < 0;
          const rows = assets.map(a =>
            '<tr><td>' + U.entity(a.name, a.id, "♫") + '</td><td>' + U.esc(a.project) + '</td><td>' + U.esc(a.type) + '</td><td class="cell-wrap muted">' + U.esc(a.source) + '</td><td class="cell-wrap">' + U.esc(a.rights) + '</td><td>' + U.esc(a.used) + '</td><td class="cell-wrap">' + U.esc(a.mix) + "</td><td>" + U.pill(a.status) + "</td><td>" +
            U.btn("详情", "audio.assetDetail", "sm", { id: a.id }) + (canEdit ? " " + U.btn("替换素材", "audio.replaceAsset", "sm", { id: a.id }) : "") + "</td></tr>").join("");
          const blocked = assets.filter(a => /阻断|待复检/.test(String(a.status)));
          const first = blocked[0];
          return U.page("音频与字幕 / 配乐与音效", "配乐与音效", "素材入库时登记来源、授权与使用范围；交付前按授权再次校验。",
            (canEdit ? U.btn("登记素材", "audio.newAsset", "primary", { pid: pid }) : "") + U.btn("授权台账", "audio.toRights", "", { pid: pid }),
            U.card("素材台账 · " + U.esc(p ? p.name : pid), U.table(["素材", "项目", "类型", "来源", "授权", "使用位置", "混音参数", "状态", "操作"], rows, "当前项目还没有登记音频素材"), assets.length ? "入库即登记来源与授权，交付前再次复核" : "当前项目还没有登记音频素材") +
            '<div class="split mt-4"><div class="stack">' +
              (first ? U.card("授权阻断 · " + first.id, U.notice(first.name + " 的授权为「" + first.rights + "」，在补授权或替换前不得进入交付。", "bad") +
                U.desc([["素材", first.name], ["使用位置", first.used], ["授权状态", first.rights], ["处置选项", "补授权 / 替换 / 删除该处"]]) +
                '<div class="btn-row-inline">' + (canEdit ? U.btn("补登记授权", "audio.fixRights", "primary", { id: first.id, pid: pid }) + U.btn("替换素材", "audio.replaceAsset", "", { id: first.id }) : U.btn("授权台账", "audio.toRights", "", { pid: pid })) + "</div>", "阻断项不进入交付包") :
                U.card("授权状态", U.notice("当前项目没有阻断或待复检的音频素材。", "ok"), "交付前仍会再次校验授权")) +
              U.card("混音标准", U.table(["项目", "标准", "说明"], [
                ["对白", "−16 LUFS ± 2", "主声道基准"],
                ["配乐", "−18 LUFS", "侧链回避对白"],
                ["音效", "−12 dB 峰值", "不遮盖对白"],
                ["整体", "无削波 / 无静音段", "交付前整轨检查"]
              ].map(r => "<tr><td>" + r[0] + "</td><td>" + r[1] + '</td><td class="cell-wrap muted">' + r[2] + "</td></tr>").join("")), "标准随交付要求配置") +
            '</div><div class="stack">' +
              U.card("授权类型", U.listRows([["平台内生成", "按供应商商用条款留档"], ["第三方素材库", "需订阅许可证明"], ["企业自有", "内部素材编号"], ["开源字体 / 音乐", "保留许可声明与出处"]]) , "无证明即视为未授权") +
              U.card("使用建议", U.listRows([["同一配乐", "不超过 3 集连续使用"], ["音效复用", "同场景音效保持同一素材"], ["替换", "替换后需重新混音并整轨检查"], ["留痕", "替换原因、操作者与时间写审计"]]) , "复用不等于免费") +
              U.card("素材状态", '<div class="kv-grid">' + U.kv("已通过", assets.filter(a => a.status === "已通过").length) + U.kv("待校验", assets.filter(a => a.status === "待校验" || a.status === "待确认").length) + U.kv("阻断 / 待复检", blocked.length) + U.kv("总素材", assets.length) + "</div>", "当前项目实际素材") +
            "</div></div>"
          );
        }
      },
      {
        path: "audio/subtitle", title: "字幕与口型", icon: "scissors", permission: "production.write",
        desc: "字幕以整数毫秒对齐时间线，口型按对白帧对齐；两者都以「集」为单位校验，不整剧一次性声称通过。",
        render(query) {
          const p = App.currentProject(query);
          if (!p) return U.projectGuard("音频与字幕 / 字幕与口型", "字幕与口型按集校验，必须绑定当前项目；未选择项目时不会展示其他项目的时间轴。");
          const pid = p.id;
          const tab = App.get(SCOPE, "subTab", "sub");
          const canEdit = !!p && ["已交付", "已归档"].indexOf(p.status) < 0;
          const subs = D.subtitles.filter(s => s.project === pid).sort((a, b) => a.ep - b.ep);
          const lips = D.lipSync.filter(l => lipProject(l) === pid).sort((a, b) => String(a.id).localeCompare(String(b.id)));
          const subRows = subs.map(s =>
            '<tr><td>' + U.esc(s.project) + '</td><td class="num">E' + s.ep + "</td><td>" + U.code(s.version) + "</td><td class=\"num\">" + s.lines + '</td><td class="cell-wrap muted">' + U.esc(s.timeline) + '</td><td class="cell-wrap">' + U.esc(s.asr) + '</td><td class="cell-wrap">' + U.esc(s.style) + "</td><td>" + U.pill(s.status) + "</td><td>" +
            (canEdit ? U.btn("校对", "audio.proofSub", "sm", { p: s.project, ep: s.ep }) : "—") + "</td></tr>").join("");
          const lipRows = lips.map(l =>
            '<tr><td>' + U.code(l.id) + "</td><td>" + U.code(l.line) + "</td><td>" + U.code(l.shot) + "</td><td>" + U.esc(l.model) + '</td><td class="num">' + U.esc(l.match) + '</td><td class="num">' + U.esc(l.duration) + "</td><td>" + U.pill(l.status) + '</td><td class="num">¥' + l.cost.toFixed(1) + "</td><td>" +
            (canEdit ? U.btn("重做", "audio.redoLip", "sm", { id: l.id }) : "—") + "</td></tr>").join("");
          const body = tab === "sub"
            ? U.table(["项目", "集", "版本", "行数", "时间轴", "ASR 校对", "样式", "状态", "操作"], subRows, "当前项目暂无字幕版本")
            : U.table(["口型记录", "对白", "镜头", "模型", "匹配度", "时长", "状态", "成本", "操作"], lipRows, "当前项目暂无口型记录");
          const subBad = subs.filter(s => s.status !== "已通过");
          const lipBad = lips.filter(l => l.status !== "已通过");
          return U.page("音频与字幕 / 字幕与口型", "字幕与口型", "字幕错字、时间轴重叠与口型错位都会进入质量门禁；不靠人工目测「差不多」。",
            (canEdit ? U.btn("生成字幕", "audio.genSub", "primary", { pid: pid }) + U.btn("批量口型对齐", "audio.batchLip", "", { pid: pid }) : U.btn("授权台账", "audio.toRights", "", { pid: pid })),
            U.card("", U.tabs([{ value: "sub", label: "字幕版本", count: subs.length }, { value: "lip", label: "口型对齐", count: lips.length }], tab, "audio.subTab") + body, "按集校验，不整剧一次性声称通过") +
            '<div class="grid grid-2 mt-4">' +
              U.card("字幕校验项 · " + U.esc(p ? p.name : pid), U.table(["项", "标准", "当前问题"], [
                ["错字", "ASR 与最终对白一致", subBad.length ? subBad.length + " 集字幕待校对" : "无待校对字幕"],
                ["时间轴", "整数毫秒、无重叠、无漂移", subs.filter(s => String(s.timeline).indexOf("重叠") >= 0).length ? "存在重叠记录" : "无累计漂移"],
                ["样式", "字号 34 / 安全区 12% / 单行 14 字", subs.every(s => String(s.style).indexOf("字号 34") >= 0) ? "符合" : "待统一"],
                ["标点", "句末标点统一", subBad.length ? "待复核" : "已校验"],
                ["敏感词", "合规词典命中即阻断", "0 命中"]
              ].map(r => "<tr><td>" + r[0] + "</td><td class=\"cell-wrap\">" + r[1] + '</td><td class="cell-wrap muted">' + U.esc(r[2]) + "</td></tr>").join("")), "校验结果进入分集质量报告") +
              U.notice("口型与字幕口径：口型按对白帧对齐、台词变更须重做口型，匹配度低于 85% 判人工；本原型不含真实字幕与音频文件（§R-06 / §R-07）。", "info") +
            "</div>"
          );
        }
      }
    ]
  });

  /* ---------- 动作 ---------- */
  App.on("audio.toVoice", (el) => App.go("audio/voice", { id: (el && el.dataset && el.dataset.pid) || (App.current().query || {}).id || ((App.currentProject() || {}).id || "") }));
  App.on("audio.toRights", (el) => App.go("compliance/rights", { id: (el && el.dataset && el.dataset.pid) || (App.current().query || {}).id || ((App.currentProject() || {}).id || "") }));
  App.on("audio.subTab", (el) => { App.set(SCOPE, "subTab", el.dataset.value); App.refresh(); });
})();

/* ===== v9.1 真实流程层：音频对白 → 口型 → 字幕 → 授权 ===== */
(function () {
  const U = UI, D = DB;

  App.on("audio.listen", (el) => {
    const d = D.dialogues.find(x => x.id === el.dataset.id);
    if (!d) return;
    App.drawer("对白回听 · " + d.id, U.notice("原型不加载真实音频文件：以下为对齐与元信息，实际系统在此播放并提供逐字时间轴。", "info") +
      U.desc([["角色 / 集", d.char + " · E" + d.ep], ["台词", d.text], ["音色档案", d.voice], ["情绪", d.emotion], ["音频状态", d.audio], ["ASR 回听", d.asr], ["计费", "¥" + d.cost]])
      + '<div class="btn-row-inline">' + U.btn("重生成", "audio.regenLine", "primary", { id: d.id }) + "</div>");
  });

  App.on("audio.regenLine", (el) => {
    if (!App.guard("production.write")) return;
    const d = D.dialogues.find(x => x.id === el.dataset.id);
    if (!d) return;
    App.closeDrawer();
    App.modal({
      title: "重生成对白 · " + d.id, sub: "原音频保留为历史版本；下游口型将标记需重做",
      body: U.fTextarea("调整说明", "note", { required: true, minlen: 8, rows: 3, placeholder: "例如：压低语速，句尾更轻" }) +
        U.fCheck("同步标记下游口型需重做", "lip", { checked: true }),
      submitText: "生成",
      onSubmit(x) {
        return App.job({
          title: "重生成对白", steps: ["校验音色授权", "调用语音合成", "ASR 回听校验", "标记下游口型"],
          run() {
            const v = D.voiceProfiles.find(p => voiceProject(p) === d.project && d.voice.indexOf(p.char) >= 0);
            if (!v || v.status !== "启用") return { ok: false, msg: "音色档案不可用（" + (v ? v.status : "未匹配") + "），无法生成" };
            const ver = "v" + ((d.audio || "").match(/\d+/) ? Number((d.audio.match(/\d+/) || ["0"])[0]) + 1 : 1);
            d.audio = "已生成 " + ver; d.asr = "回听一致"; d.status = "已通过"; d.cost = 3.2;
            DB.state.spend(d.project, 3.2, { cap: "音频生成", note: "重生成对白 " + d.id });
            if (x.lip) {
              D.lipSync.filter(l => l.line === d.id).forEach(l => { l.status = "需重做"; l.match = "待重做"; });
            }
            DB.state.log("对白 " + d.id, "重生成 " + ver + "：" + x.note, "成功", d.id);
            return { ok: true, msg: "已生成 " + ver + "，ASR 回听一致；下游口型 " + (x.lip ? "已标记需重做" : "未标记") };
          }
        });
      }
    });
  });

  App.on("audio.batchDialogue", (el) => {
    if (!App.guard("production.write")) return;
    const pid = (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "");
    const p = D.projects.find(x => x.id === pid);
    if (!p) return App.toast("项目不存在：" + pid, "bad");
    const list = D.dialogues.filter(d => d.project === pid);
    const pend = list.filter(d => d.status !== "已通过");
    if (!list.length) { App.toast("《" + p.name + "》还没有对白对象，需先锁定剧本并拆解出对白", "bad"); return; }
    if (!pend.length) { App.toast("《" + p.name + "》的对白已全部生成", "bad"); return; }
    const eps = [...new Set(pend.map(d => d.ep))].sort((a, b) => a - b);
    App.confirm("批量生成对白 · " + p.name, "E" + eps.join(" / E") + " 共 " + pend.length + " 条待生成，预计 ¥" + DB.state.money(pend.length * 3.2) + "；生成后逐条 ASR 回听。", () => {
      App.job({
        title: "批量生成对白", steps: ["校验音色档案", "分配并行额度", "逐条合成与回听", "写入用量"],
        run() {
          let ok = 0, block = [];
          pend.forEach(d => {
            const v = D.voiceProfiles.find(pv => voiceProject(pv) === pid && d.voice.indexOf(pv.char) >= 0);
            if (!v || v.status !== "启用") { block.push(d.id); return; }
            d.audio = "已生成 v1"; d.asr = "回听一致"; d.status = "已通过"; d.cost = 3.2;
            DB.state.spend(d.project, 3.2, { cap: "音频生成", note: "对白 " + d.id });
            ok += 1;
          });
          DB.state.log(p.name + " 对白批量", "生成 " + ok + " 条", "成功", pid);
          return { ok: ok > 0, msg: "已生成 " + ok + " 条" + (block.length ? "；" + block.length + " 条因音色停用被拦" : "") + "，扣费 ¥" + DB.state.money(ok * 3.2) };
        }
      });
    }, "批量生成");
  });

  App.on("audio.previewVoice", (el) => {
    const v = D.voiceProfiles.find(p => p.id === (el && el.dataset && el.dataset.id));
    App.drawer("音色参数" + (v ? " · " + v.char : ""), U.notice("原型不含真实音频，试听在正式系统中播放样段；此处展示可核验的参数与授权口径。", "info") +
      (v ? U.desc([["档案", v.id], ["角色", v.char], ["语种", v.lang], ["音色", v.timbre], ["语速", v.rate], ["情绪区间", v.emotion], ["权利", v.rights], ["覆盖", v.coverage], ["状态", v.status]]) : U.empty("未选择音色档案")));
  });

  App.on("audio.voiceDetail", (el) => {
    const v = D.voiceProfiles.find(p => p.id === el.dataset.id);
    if (!v) return;
    App.drawer("声音档案 · " + v.id, U.desc([["角色", v.char], ["语种", v.lang], ["音色", v.timbre], ["语速", v.rate], ["情绪区间", v.emotion], ["权利依据", v.rights], ["覆盖集次", v.coverage], ["状态", v.status]]) +
      '<div class="btn-row-inline">' + U.btn("试听", "audio.previewVoice", "sm", { id: v.id }) +
      (v.status === "启用" ? U.btn("停用档案", "audio.disableVoice", "sm", { id: v.id }) : U.btn("启用档案", "audio.enableVoice", "sm", { id: v.id })) + "</div>");
  });

  App.on("audio.disableVoice", (el) => {
    if (!App.guard("production.write")) return;
    const v = D.voiceProfiles.find(p => p.id === el.dataset.id);
    if (!v) return;
    const pid = voiceProject(v);
    const used = D.dialogues.filter(d => d.project === pid && String(d.voice).indexOf(v.char) >= 0 && d.status !== "已通过").length;
    App.confirm("停用声音档案", v.char + " 仍有 " + used + " 条未完成对白；停用后这些对白无法生成，需先替换音色。", () => {
      v.status = "停用";
      DB.state.log("音色 " + v.id, "停用（未完成对白 " + used + " 条）", "成功", v.id);
      App.closeDrawer(); App.toast("已停用 " + v.id, "warn"); App.refresh();
    }, "停用");
  });
  App.on("audio.enableVoice", (el) => {
    if (!App.guard("production.write")) return;
    const v = D.voiceProfiles.find(p => p.id === el.dataset.id);
    v.status = "启用";
    DB.state.log("音色 " + v.id, "启用", "成功", v.id);
    App.closeDrawer(); App.toast("已启用 " + v.id); App.refresh();
  });

  App.on("audio.newVoice", (el) => {
    if (!App.guard("production.write")) return;
    const pid = (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "");
    const p = D.projects.find(x => x.id === pid);
    if (!p) return App.toast("项目不存在：" + pid, "bad");
    const chars = D.characters.filter(c => c.project === pid);
    if (!chars.length) { App.toast("《" + p.name + "》还没有人物档案，需先在导演规划建立人物", "bad"); return; }
    App.modal({
      title: "新建声音档案 · " + p.name, sub: "无授权依据的音色不得用于商业交付",
      body: U.fSelect("角色", "char", chars.map(c => ({ value: c.name, label: c.name + "（" + c.id + "）" })), { required: true }) +
        U.fSelect("语种", "lang", ["普通话", "粤语", "英语"]) + U.fField("音色描述", "timbre", { required: true, minlen: 4 }) + U.fField("语速", "rate", { required: true, placeholder: "例如 偏慢 0.92" }) +
        U.fSelect("授权依据", "rights", ["AI 合成音色 · 供应商商用条款已留档", "真人配音授权（需上传授权书）"], { required: true }) +
        U.fField("覆盖集次", "coverage", { required: true, placeholder: "例如 第 1–24 集" }),
      submitText: "创建档案",
      onSubmit(d) {
        return App.job({
          title: "创建声音档案", steps: ["校验授权依据", "写入档案"],
          run() {
            if (D.voiceProfiles.some(v => voiceProject(v) === pid && v.char === d.char)) return { ok: false, msg: "该项目「" + d.char + "」已有声音档案，不能重复建档" };
            const id = "VO-" + String(D.voiceProfiles.length + 1).padStart(2, "0");
            D.voiceProfiles.push({ id: id, project: pid, char: d.char, lang: d.lang, timbre: d.timbre, rate: d.rate, emotion: "待定义", rights: d.rights, coverage: d.coverage, status: "启用" });
            DB.state.log("音色 " + id, "新建：" + d.char + " · " + pid, "成功", id);
            return { ok: true, msg: "声音档案已创建：" + id };
          }
        });
      }
    });
  });

  App.on("audio.renew", (el) => {
    if (!App.guard("production.write")) return;
    const v = D.voiceProfiles.find(x => x.id === ((el && el.dataset && el.dataset.id) || ""));
    if (!v) return App.toast("未指定需要续期的声音档案", "bad");
    App.modal({
      title: "续期授权 · " + v.id, sub: v.char + " · 需要供应商回执编号，口头确认不入账",
      body: U.fField("续期至", "until", { required: true, placeholder: "2027-11-30", rule: "date" }) + U.fField("回执编号", "proof", { required: true, minlen: 6 }) + U.fTextarea("说明", "note", { rows: 2 }),
      submitText: "提交续期",
      onSubmit(d) {
        return App.job({
          title: "授权续期", steps: ["校验回执", "更新有效期", "写审计"],
          run() {
            v.rights = v.rights.replace(/·\s*至\s*\d{4}-\d{2}-\d{2}/, "").replace(/\s*·\s*$/, "") + " · 至 " + d.until + " · 回执 " + d.proof;
            v.status = "启用";
            DB.state.log("音色 " + v.id, "续期至 " + d.until + "，回执 " + d.proof, "成功", v.id);
            return { ok: true, msg: v.id + " 已续期至 " + d.until + "，回执已留档" };
          }
        });
      }
    });
  });

  App.on("audio.replaceVoice", (el) => {
    if (!App.guard("production.write")) return;
    const pid = (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "");
    const old = D.voiceProfiles.find(v => v.id === ((el && el.dataset && el.dataset.id) || ""));
    if (!old) return App.toast("未指定需要替换的声音档案", "bad");
    const affected = D.dialogues.filter(d => d.project === pid && String(d.voice).indexOf(old.char) >= 0);
    const options = D.voiceProfiles.filter(v => voiceProject(v) === pid && v.id !== old.id && v.status === "启用").map(v => v.id + " · " + v.char);
    if (!options.length) { App.toast("当前项目没有其他可用音色，无法替换", "bad"); return; }
    App.modal({
      title: "替换音色 · " + old.id, sub: "替换需重跑受影响对白与口型；" + affected.length + " 条对白将标记需重做",
      body: U.fSelect("新音色档案", "to", options, { required: true }) + U.fTextarea("替换原因", "note", { required: true, minlen: 10, rows: 3 }),
      submitText: "替换并标记重跑",
      onSubmit(d) {
        return App.job({
          title: "替换音色", steps: ["校验新档案可用", "更新对白引用", "标记口型需重做"],
          run() {
            const id = String(d.to).split(" · ")[0];
            const v = D.voiceProfiles.find(pv => pv.id === id);
            if (!v) return { ok: false, msg: "新音色档案不存在：" + id };
            if (v.status !== "启用") return { ok: false, msg: "新音色档案状态为「" + v.status + "」，不可替换" };
            affected.forEach(x => { x.audio = "需重做"; x.asr = "—"; x.status = "需重做"; x.voice = v.char + " · 声音档案 " + v.id; });
            D.lipSync.filter(l => affected.some(x => x.id === l.line)).forEach(l => { l.status = "需重做"; l.match = "待重做"; });
            old.status = "已替换";
            DB.state.log("音色替换", old.id + " → " + v.id + "：" + d.note, "成功", v.id);
            return { ok: true, msg: "已替换，标记 " + affected.length + " 条对白与对应口型需重做" };
          }
        });
      }
    });
  });

  App.on("audio.rightsCheck", (el) => {
    if (!App.guard("production.write")) return;
    const pid = (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "");
    const p = D.projects.find(x => x.id === pid);
    App.job({
      title: "授权复核 · " + (p ? p.name : pid), steps: ["读取当前项目授权台账", "校验有效期与渠道范围", "输出阻断项"],
      run() {
        const rows = (D.rights || []).filter(r => !r.project || r.project === pid);
        const bad = rows.filter(r => /阻断|到期|停用/.test(String(r.status)));
        return { ok: true, msg: "授权复核完成：当前项目共 " + rows.length + " 项，阻断/临期 " + bad.length + " 项" + (bad.length ? "：" + bad.map(r => r.id).join("、") : "") };
      },
      after() { App.go("compliance/rights", { id: pid }); }
    });
  });

  App.on("audio.newAsset", (el) => {
    if (!App.guard("production.write")) return;
    const pid = (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "");
    const p = D.projects.find(x => x.id === pid);
    if (!p) return App.toast("项目不存在：" + pid, "bad");
    App.modal({
      title: "新增音频素材 · " + p.name, sub: "素材必须登记来源与授权范围",
      body: U.fSelect("类型", "type", ["配乐", "音效", "环境声"], { required: true }) + U.fField("名称", "name", { required: true, minlen: 3 }) +
        U.fSelect("来源", "source", ["AI 生成 · 配乐模型 M1", "企业素材库", "外部采购（需授权书）"], { required: true }) +
        U.fField("授权范围", "rights", { required: true, minlen: 4 }) + U.fField("使用集次", "used", { required: true }),
      submitText: "登记素材",
      onSubmit(d) {
        return App.job({
          title: "登记音频素材", steps: ["校验来源与授权", "写入素材库"],
          run() {
            const id = "AU-" + pid.slice(3) + "-" + d.type + "-" + String(D.audioAssets.filter(a => a.project === pid).length + 1).padStart(2, "0");
            D.audioAssets.push({ id: id, project: pid, type: d.type, name: d.name, source: d.source, rights: d.rights, used: d.used, mix: "待设定", status: "待确认" });
            DB.state.log("音频素材 " + id, "登记：" + d.name + " · " + pid, "成功", id);
            return { ok: true, msg: "素材已登记：" + id + "（待确认后方可用于混音）" };
          }
        });
      }
    });
  });

  App.on("audio.assetDetail", (el) => {
    const a = D.audioAssets.find(x => x.id === el.dataset.id);
    if (!a) return;
    App.drawer("音频素材 · " + a.id, U.desc([["类型", a.type], ["名称", a.name], ["来源", a.source], ["授权", a.rights], ["使用", a.used], ["混音", a.mix], ["状态", a.status]]) +
      '<div class="btn-row-inline">' + (a.status === "待确认" ? U.btn("确认可用", "audio.confirmAsset", "primary", { id: a.id }) : "") + "</div>");
  });
  App.on("audio.confirmAsset", (el) => {
    if (!App.guard("production.write")) return;
    const a = D.audioAssets.find(x => x.id === el.dataset.id);
    a.status = "已确认";
    DB.state.log("音频素材 " + a.id, "确认可用", "成功", a.id);
    App.closeDrawer(); App.toast("已确认 " + a.id); App.refresh();
  });

  App.on("audio.replaceAsset", (el) => {
    if (!App.guard("production.write")) return;
    const a = D.audioAssets.find(x => x.id === el.dataset.id);
    if (!a) return App.toast("未指定需要替换的音频素材", "bad");
    const p = D.projects.find(x => x.id === a.project);
    App.modal({
      title: "替换音频素材 · " + a.name, sub: (p ? p.name + " · " : "") + a.used + "；替换后必须重新混音与复检",
      body: U.fSelect("替换为", "to", ["企业自有素材 · SP-OWN-118", "AI 生成配乐（平台授权）", "开源音乐（CC0）"], { required: true }) +
        U.fTextarea("替换原因", "note", { required: true, minlen: 8, rows: 3 }) +
        U.fCheck("替换后重新混音并整轨检查", "mix", { checked: true }),
      submitText: "确认替换",
      onSubmit(d) {
        return App.job({
          title: "替换音频素材", steps: ["校验新素材授权", "替换引用", "标记复检范围"],
          run() {
            if (!d.mix) return { ok: false, msg: "必须确认重新混音与整轨检查" };
            a.source = d.to;
            a.rights = d.to.indexOf("企业自有") >= 0 ? "企业自有 · 可商用" : d.to.indexOf("CC0") >= 0 ? "CC0 · 保留出处" : "平台授权 · 可商用";
            a.status = "待复检";
            a.mix = "待重新混音";
            const rr = D.rights.find(r => (!r.project || r.project === a.project) && /阻断|到期|缺失/.test(String(r.status) + " " + String(r.proof)) && String(r.subject).indexOf(a.name) >= 0);
            if (rr) { rr.status = "有效"; rr.proof = "替换素材授权 · " + d.to; rr.term = "长期 · 随项目"; rr.review = "已复核"; }
            D.timelines.filter(t => t.project === a.project).forEach(t => { t.stale = (t.stale || 0) + 1; });
            DB.state.log("音频素材 " + a.id, "替换为 " + d.to + "：" + d.note, "成功", a.id);
            return { ok: true, msg: "已替换 " + a.id + "，需重新混音并复检" + (rr ? "；关联授权 " + rr.id + " 已按新素材补齐" : "") };
          }
        });
      }
    });
  });

  App.on("audio.fixRights", (el) => {
    if (!App.guard("production.write")) return;
    const a = D.audioAssets.find(x => x.id === ((el && el.dataset && el.dataset.id) || ""));
    if (!a) return App.toast("未指定需要修复的音频素材", "bad");
    App.modal({
      title: "修复授权 · " + a.name, sub: "阻断素材未解除前不得输出交付",
      body: U.fSelect("处理方式", "way", ["续期授权", "替换为已授权素材", "删除该处使用并重混"], { required: true }) +
        U.fField("回执 / 替换素材编号", "proof", { required: true }) + U.fTextarea("说明", "note", { required: true, minlen: 8 }),
      submitText: "提交",
      onSubmit(d) {
        return App.job({
          title: "修复授权阻断", steps: ["校验处理方式", "更新素材授权", "标记复检范围"],
          run() {
            if (d.way === "删除该处使用并重混") {
              a.used = "已移除使用"; a.status = "已移除";
              DB.state.log("音频素材 " + a.id, "移除使用：" + d.note, "成功", a.id);
              return { ok: true, msg: "已移除使用，需重混并重新质检" };
            }
            if (d.way === "替换为已授权素材") {
              a.source = "替换素材 · " + d.proof;
              a.rights = "已授权 · 回执 " + d.proof;
              a.status = "待复检";
            } else {
              a.rights = "第三方授权 · " + d.proof + " · 至 " + (d.until || "待登记");
              a.status = "待复核";
            }
            DB.state.log("音频素材 " + a.id, d.way + "：" + d.note + " · 回执 " + d.proof, "成功", a.id);
            return { ok: true, msg: "授权已更新，需复检通过后才解除交付阻断" };
          }
        });
      }
    });
  });

  App.on("audio.proofSub", (el) => {
    if (!App.guard("production.write")) return;
    const pid = el.dataset.p || ((App.currentProject() || {}).id || "");
    const ep = Number(el.dataset.ep);
    const s = D.subtitles.find(x => x.project === pid && x.ep === ep);
    if (!s) return App.toast("该集尚未生成字幕，无法校对", "bad");
    App.modal({
      title: "字幕校对 · " + pid + " · E" + ep, sub: "修正错字与时间轴重叠后生成新版本；校对结论写回该集字幕状态",
      body: U.fField("错字修正条数", "typo", { required: true, type: "number", min: 0, max: 200, value: "0" }) +
        U.fField("时间轴修正条数", "time", { required: true, type: "number", min: 0, max: 200, value: "0" }) +
        U.fTextarea("校对说明", "note", { required: true, minlen: 6, rows: 2, placeholder: "例如：合并 3 处重叠行，统一句末标点" }),
      submitText: "保存校对版本",
      onSubmit(d) {
        return App.job({
          title: "保存字幕校对", steps: ["校验修正记录", "生成新版本", "更新分集质检"],
          run() {
            const n = Number((String(s.version).match(/\bv(\d+)\b/) || [])[1] || 1) + 1;
            s.version = "SUB-" + String(ep).padStart(2, "0") + " v" + n;
            s.asr = "错字 " + d.typo + " · 校对" + (Number(d.typo) === 0 ? "完成" : "后待复核");
            s.timeline = Number(d.time) === 0 ? "整数毫秒 · 无累计漂移" : "整数毫秒 · 已修正 " + d.time + " 处";
            s.status = (Number(d.typo) === 0 && Number(d.time) === 0) ? "已通过" : "待复核";
            DB.state.log("字幕 " + pid + " E" + ep, "校对：" + d.note + " → " + s.status, "成功", s.version);
            return { ok: true, msg: "已保存 " + s.version + "，状态" + s.status };
          }
        });
      }
    });
  });

  App.on("audio.genSub", (el) => {
    if (!App.guard("production.write")) return;
    const pid = (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "");
    const p = D.projects.find(x => x.id === pid);
    const eps = D.episodes.filter(e => e.project === pid).sort((a, b) => (a.no || a.ep) - (b.no || b.ep));
    if (!p || !eps.length) return App.toast("当前项目还没有分集结构，无法生成字幕", "bad");
    const existing = D.subtitles.filter(s => s.project === pid);
    const firstOpen = eps.find(e => !existing.some(s => s.ep === (e.no || e.ep))) || eps[0];
    const opts = eps.map(e => {
      const no = e.no || e.ep;
      const has = existing.some(s => s.ep === no);
      return { value: String(no), label: "E" + String(no).padStart(2, "0") + " · " + e.title + (has ? " · 已有字幕" : " · 未生成") };
    });
    App.modal({
      title: "生成字幕 · " + p.name, sub: "基于对白与时间线生成；生成后必须人工校对才能通过",
      body: U.fSelect("集次", "ep", opts, { required: true, value: String(firstOpen.no || firstOpen.ep), full: true }) +
        U.fSelect("样式基线", "style", ["字号 34 / 安全区 12% / 单行 14 字", "字号 30 / 安全区 10% / 单行 16 字"], { required: true }),
      submitText: "生成字幕",
      onSubmit(d) {
        return App.job({
          title: "生成字幕", steps: ["读取对白与时间线", "生成字幕轨", "写入版本与费用"],
          run() {
            const ep = Number(d.ep);
            const shots = D.shots.filter(s => s.project === pid && s.ep === ep);
            if (!shots.length) return { ok: false, msg: "E" + ep + " 还没有镜头，不能生成字幕" };
            let s = D.subtitles.find(x => x.project === pid && x.ep === ep);
            const lines = s && s.lines ? s.lines : Math.max(12, Math.min(120, shots.length * 3));
            const cost = Math.round(lines * (D.pricing ? D.pricing.subtitlePerLine : 0.3) * 10) / 10;
            if (!s) {
              s = { project: pid, ep: ep, version: "SUB-" + String(ep).padStart(2, "0") + " v1", lines: lines, timeline: "整数毫秒 · 待复核", asr: "错字 2 · 待校对", style: d.style, status: "处理中" };
              D.subtitles.push(s);
            } else {
              const n = Number((String(s.version).match(/\bv(\d+)\b/) || [])[1] || 1) + 1;
              s.version = "SUB-" + String(ep).padStart(2, "0") + " v" + n;
              s.lines = lines; s.timeline = "整数毫秒 · 待复核"; s.asr = "错字 2 · 待校对"; s.style = d.style; s.status = "处理中";
            }
            DB.state.spend(pid, cost, { cap: "字幕生成", note: "生成 " + s.version });
            DB.state.log("字幕 " + pid + " E" + ep, "生成 " + s.version, "成功", s.version);
            return { ok: true, msg: "已生成 " + s.version + "（" + lines + " 行），扣费 ¥" + DB.state.money(cost) + "；需校对后转已通过" };
          }
        });
      }
    });
  });

  App.on("audio.batchLip", (el) => {
    if (!App.guard("production.write")) return;
    const pid = (el && el.dataset && el.dataset.pid) || ((App.currentProject() || {}).id || "");
    const pend = D.lipSync.filter(l => lipProject(l) === pid && l.status !== "已通过" && l.status !== "需重做");
    if (!pend.length) { App.toast("当前项目没有待生成的口型对齐", "bad"); return; }
    App.confirm("批量口型对齐 · " + pid, "共 " + pend.length + " 条，预计 ¥" + DB.state.money(pend.length * 5.6) + "；匹配度低于 85% 判待人工。", () => {
      App.job({
        title: "批量口型对齐", steps: ["读取对白音频", "逐条对齐", "匹配度判定"],
        run() {
          let ok = 0;
          pend.forEach(l => {
            l.status = "已通过"; l.match = "93% 帧对齐"; l.cost = 5.6;
            DB.state.spend(pid, 5.6, { cap: "音频生成", note: "口型 " + l.id });
            ok += 1;
          });
          DB.state.log("口型对齐 " + pid, "完成 " + ok + " 条", "成功", pid);
          return { ok: true, msg: "已对齐 " + ok + " 条，扣费 ¥" + DB.state.money(ok * 5.6) };
        }
      });
    }, "开始对齐");
  });

  App.on("audio.redoLip", (el) => {
    if (!App.guard("production.write")) return;
    const l = D.lipSync.find(x => x.id === el.dataset.id);
    if (!l) return;
    const pid = lipProject(l);
    const p = D.projects.find(x => x.id === pid);
    App.modal({
      title: "重做口型 · " + l.id, sub: (p ? p.name + " · " : "") + "按最新对白音频重做；旧结果保留",
      body: U.fTextarea("原因", "note", { required: true, minlen: 8, rows: 3 }),
      submitText: "重做",
      onSubmit(d) {
        return App.job({
          title: "重做口型", steps: ["校验对白音频版本", "创建对齐任务", "写入费用"],
          run() {
            const dl = D.dialogues.find(x => x.id === l.line);
            if (dl && dl.status !== "已通过") return { ok: false, msg: "对白 " + l.line + " 尚未生成完成，不能做口型" };
            l.status = "排队中"; l.match = "待生成"; l.cost = 5.6;
            DB.state.spend(pid, 5.6, { cap: "音频生成", note: "重做口型 " + l.id });
            DB.state.log("口型 " + l.id, "重做：" + d.note, "成功", l.id);
            return { ok: true, msg: "已提交重做，排队中" };
          }
        });
      }
    });
  });
})();

