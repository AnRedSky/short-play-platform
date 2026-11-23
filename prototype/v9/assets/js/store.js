/* store.js：业务状态层（应用层与模块层共用）。
   职责：唯一允许改写业务状态的地方。所有写操作 = 状态机校验 → 数据变更 → 副作用（审计 / 通知 / 成本 / 资产）。
   页面只读 DB 与 Store 投影；动作只调用 Store.ops，不直接改字典。刷新后回到初始演示数据（内存态）。 */
window.Store = (function () {
  const D = DB;
  const CLOCK = { day: "2026-11-22", minute: 11 * 60 + 2 };
  const INITIAL = JSON.parse(JSON.stringify(D));
  const INITIAL_CLOCK = { day: CLOCK.day, minute: CLOCK.minute };
  const STATE_KEY = "shortplay.workbench.v937";
  let seq = 0;

  /* ---------- 本地持久化：真实操作可以跨刷新继续 ---------- */
  function persist() {
    try {
      window.localStorage.setItem(STATE_KEY, JSON.stringify({
        v: 930, at: new Date().toISOString(), clock: CLOCK, seq: seq, db: D
      }));
    } catch (err) { /* 无 localStorage 的测试环境忽略 */ }
  }
  function restore() {
    try {
      const raw = window.localStorage.getItem(STATE_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw);
      if (!snap || snap.v !== 930 || !snap.db) return;
      Object.keys(INITIAL).forEach(function (k) {
        if (k === "currentIdentity") return;
        if (Object.prototype.hasOwnProperty.call(snap.db, k)) D[k] = snap.db[k];
      });
      /* 版本升级时只补静态字段（如样本标记、项目归属），不覆盖用户已产生的业务状态。 */
      Object.keys(INITIAL).forEach(function (k) {
        const base = INITIAL[k], cur = D[k];
        if (!Array.isArray(base) || !Array.isArray(cur)) return;
        const byId = {};
        base.forEach(function (item) { if (item && item.id) byId[item.id] = item; });
        cur.forEach(function (item) {
          const src = item && item.id ? byId[item.id] : null;
          if (!src) return;
          Object.keys(src).forEach(function (field) {
            if (!(field in item)) item[field] = src[field];
          });
        });
      });
      if (snap.clock) { CLOCK.day = snap.clock.day; CLOCK.minute = snap.clock.minute; }
      D.meta = Object.assign({}, D.meta || {}, INITIAL.meta || {});
      seq = snap.seq || 0;
    } catch (err) { /* 快照损坏时回退初始数据 */ }
  }
  restore();

  /* ---------- 时间与编号 ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function at() {
    CLOCK.minute += 1;
    const h = Math.floor(CLOCK.minute / 60) % 24, m = CLOCK.minute % 60;
    return CLOCK.day + " " + pad(h) + ":" + pad(m);
  }
  function time() { const s = at(); return s.slice(11); }
  function nid(prefix) { seq += 1; return prefix + "-" + String(700 + seq); }
  function actor() {
    const me = App.identity ? App.identity() : null;
    return me ? String(me.name).split(" · ")[0] : "系统";
  }

  /* ---------- 通用副作用 ---------- */
  function log(object, action, result, link) {
    D.audits.unshift({ time: at(), actor: actor(), object: object, action: action, result: result || "成功", src: "10.12.4.31 · 桌面端", link: link || "—" });
    return D.audits[0];
  }
  function notify(spec) {
    const row = {
      id: nid("N"), type: spec.type, project: spec.project || "—", title: spec.title,
      reason: spec.reason || "—", impact: spec.impact || "—", state: spec.state || "待处理",
      action: spec.action || "—", owner: spec.owner || actor(), link: spec.link || "", unread: true, at: at()
    };
    D.notifications.unshift(row);
    return row;
  }
  function money(n) { return Math.round(n * 100) / 100; }

  function budgetOf(projectId) {
    return D.budgets.find(b => b.scope === "项目" && String(b.name).indexOf(projectId) === 0);
  }
  function spend(projectId, amount, meta) {
    const m = meta || {};
    const p = prj(projectId);
    if (!p || !amount) return null;
    p.actual = money(p.actual + amount);
    const bg = budgetOf(projectId);
    if (bg) {
      bg.used = money(bg.used + amount);
      bg.state = bg.used >= bg.total * 0.85 ? "接近阈值" : "正常";
      p.budgetState = bg.state;
    }
    const dept = D.budgets.find(b => b.scope === "部门" && b.name === p.dept);
    if (dept) dept.used = money(dept.used + amount);
    const ent = D.budgets.find(b => b.scope === "企业");
    if (ent) ent.used = money(ent.used + amount);
    const row = {
      id: nid("CR"), project: projectId, ep: m.ep || "—", shot: m.shot || "—", task: m.task || "—",
      cap: m.cap || "视频生成", est: money(m.est || amount), actual: money(m.actual || 0), failed: money(m.failed || 0),
      bearer: m.bearer || "企业承担", source: m.source || "企业托管额度", provider: m.provider || "—",
      status: m.status || "已确认", bill: m.bill || "—"
    };
    D.costs.unshift(row);
    D.usage.unshift({ id: nid("US"), project: projectId, task: m.task || "—", cap: row.cap, unit: m.unit || "次", vendorQty: m.qty || "1", platformQty: m.qty || "1", src: row.provider, status: "已计量", at: at() });
    if (bg && bg.state === "接近阈值" && !bg.warned) {
      bg.warned = true;
      notify({ type: "预算提醒", project: projectId, title: p.name + " 预算接近阈值", reason: "已用 " + (Math.round(bg.used / bg.total * 1000) / 10) + "%，剩余 ¥" + money(bg.total - bg.used), impact: "超出部分的任务将被预算预检拦截", action: "调整预算或缩减范围", owner: p.owner, link: "cost/budget" });
    }
    return row;
  }

  /* ---------- 项目与状态机 ---------- */
  function prj(id) { return D.projects.find(p => p.id === id); }
  const FLOW = {
    "草稿": ["创意策划中", "已终止"],
    "创意策划中": ["剧本创作中", "已暂停", "已终止"],
    "剧本创作中": ["待剧本审核", "已暂停", "已终止"],
    "待剧本审核": ["生产准备中", "剧本创作中", "已暂停"],
    "生产准备中": ["生产中", "已暂停"],
    "生产中": ["后期制作中", "异常中", "已暂停"],
    "后期制作中": ["质量检测中", "已暂停"],
    "质量检测中": ["待最终审核", "后期制作中"],
    "待最终审核": ["已完成", "后期制作中"],
    "已完成": ["已交付", "后期制作中"],
    "已交付": ["已归档"],
    "已归档": [],
    "已暂停": ["生产中", "已终止"],
    "异常中": ["生产中", "已终止", "已暂停"],
    "已终止": []
  };
  function canMove(p, to) {
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.status === to) return { ok: false, msg: "项目已处于「" + to + "」状态" };
    const allow = FLOW[p.status] || [];
    if (allow.indexOf(to) < 0) return { ok: false, msg: "状态不允许：「" + p.status + "」不能直接进入「" + to + "」" };
    return { ok: true };
  }
  const PHASE_OF = {
    "草稿": "前期开发", "创意策划中": "前期开发", "剧本创作中": "剧本创作", "待剧本审核": "剧本审核",
    "生产准备中": "生产准备", "生产中": "视频生产", "后期制作中": "字幕与音频", "质量检测中": "质量检测",
    "待最终审核": "终审", "已完成": "终审与交付", "已交付": "交付", "已归档": "归档",
    "已暂停": "已暂停", "异常中": "异常处理", "已终止": "已终止"
  };

  function moveTo(p, to, note) {
    const chk = canMove(p, to);
    if (!chk.ok) return chk;
    const from = p.status;
    p.status = to;
    if (PHASE_OF[to]) p.phase = PHASE_OF[to];
    p.updated = at();
    p.history = (p.history || []).concat([{ from: from, to: to, at: p.updated, by: actor(), note: note || "—" }]);
    return { ok: true };
  }

  /* ---------- 门禁 ---------- */
  function gate(projectId, kind) {
    const p = prj(projectId);
    if (!p) return { ok: false, items: [{ label: "项目不存在", ok: false, note: projectId }] };
    const items = [];
    const locked = D.scripts.find(s => s.project === projectId && s.locked);
    const shots = D.shots.filter(s => s.project === projectId);
    const badShots = shots.filter(s => s.status !== "已通过");
    const tls = D.timelines.filter(t => t.project === projectId);
    const stale = tls.reduce((n, t) => n + (t.stale || 0), 0);
    const eps = D.episodes.filter(e => e.project === projectId);
    const passedEp = eps.filter(e => e.qc === "PASS");
    const badRights = D.rights.filter(r => r.status !== "有效" && (!r.project || r.project === projectId));
    const generalBadRights = D.rights.filter(r => r.status === "阻断交付" && (!r.project || r.project === projectId));
    const rightsBad = [...new Set(badRights.concat(generalBadRights).map(r => r.id))];
    const plan = D.plans.filter(x => x.project === projectId).slice(-1)[0];
    const pendingChars = D.characters.filter(c => c.project === projectId && c.status === "待确认");
    const pendingLocs = D.locations.filter(l => l.project === projectId && l.status === "待确认");
    const bg = budgetOf(projectId);

    if (kind !== "生产") items.push({ key: "script", label: "正式剧本已锁定", ok: !!locked, note: locked ? locked.id : "无锁定版本，下游不可启动" });
    if (kind === "生产") {
      items.push({ key: "script", label: "正式剧本已锁定", ok: !!locked, note: locked ? locked.id : "缺锁定剧本" });
      const contractReady = shots.length > 0 && shots.every(s => s.scene && s.desc && s.duration && s.chars);
      items.push({ key: "contract", label: plan && plan.status === "已固化" ? "镜头契约已固化" : "镜头契约完整", ok: contractReady && (!plan || plan.shots >= shots.length), note: shots.length ? shots.length + " 个镜头契约" + (plan ? " · " + plan.status : "") : "尚无镜头契约" });
      items.push({ key: "asset", label: "角色 / 场景资产已确认", ok: pendingChars.length === 0 && pendingLocs.length === 0, note: (pendingChars.concat(pendingLocs)).map(x => x.name).join("、") || "全部已确认" });
      items.push({ key: "rights", label: "授权无阻断项", ok: badRights.length === 0, note: badRights.map(r => r.id).join(" / ") || "角色 / 场景授权有效；音乐等素材在交付前复核" });
      items.push({ key: "budget", label: "预算未超限", ok: !bg || bg.used < bg.total, note: bg ? "已用 ¥" + bg.used + " / ¥" + bg.total : "未设置预算" });
    } else {
      items.push({ key: "shots", label: "全部镜头质量 PASS", ok: shots.length > 0 && badShots.length === 0, note: shots.length ? badShots.length + " 个镜头未通过" : "无镜头契约" });
      items.push({ key: "time", label: "时间线无标脏片段", ok: tls.length > 0 && stale === 0, note: tls.length ? stale + " 处标脏" : "无时间线" });
      items.push({ key: "ep", label: "全部分集质检通过", ok: eps.length > 0 && passedEp.length === eps.length && eps.length >= (p.episodes || 0), note: passedEp.length + " / " + Math.max(eps.length, p.episodes || 0) + " 集" });
      items.push({ key: "rights", label: "授权齐备", ok: rightsBad.length === 0, note: rightsBad.join(" / ") || "—" });
      items.push({ key: "budget", label: "预算未冻结", ok: !bg || bg.state !== "已冻结", note: bg ? bg.state : "—" });
    }
    return { ok: items.every(i => i.ok), items: items };
  }

  /* ---------- 创建项目 ---------- */
  function createProject(input) {
    const d = input || {};
    const name = String(d.name || "").trim();
    if (!name) return { ok: false, msg: "项目名称必填", fields: { name: "必填项，不能为空" } };
    if (name.length < 2 || name.length > 20) return { ok: false, msg: "项目名称长度不合法", fields: { name: "名称需 2–20 个字符（当前 " + name.length + "）" } };
    if (D.projects.some(p => p.name === name)) return { ok: false, msg: "同名项目已存在", fields: { name: "企业内项目名不可重复" } };
    const no = Number(String(d.episodes || "20").replace(/[^\d]/g, "")) || 20;
    if (no < 4 || no > 60) return { ok: false, msg: "集数不在企业策略范围", fields: { episodes: "集数需为 4–60 的整数" } };
    const budget = Number(String(d.budget || "12000").replace(/[^\d.]/g, "")) || 12000;
    const me = App.identity();
    const u = (D.users || []).find(x => x.id === me.userId) || {};
    const dept = String(d.dept || me.dept || "内容创新部");
    const need = budget;
    const deptBg = D.budgets.find(b => b.scope === "部门" && b.name === dept);
    if (deptBg) {
      const left = deptBg.total - deptBg.used - (deptBg.reserve || 0);
      if (need > left) return { ok: false, msg: "部门预算余额不足", fields: { budget: "部门可用余额 ¥" + Number(left).toLocaleString("zh-CN") + "，不足以覆盖 ¥" + need.toLocaleString("zh-CN") } };
    }
    const entBg = D.budgets.find(b => b.scope === "企业");
    if (entBg) {
      const left = entBg.total - entBg.used - (entBg.reserve || 0);
      if (need > left) return { ok: false, msg: "企业预算余额不足", fields: { budget: "企业可用余额 ¥" + Number(left).toLocaleString("zh-CN") + "，不足以覆盖 ¥" + need.toLocaleString("zh-CN") } };
    }
    const id = "SP-" + (26032 + D.projects.filter(p => p.id.indexOf("SP-2603") === 0 && Number(p.id.slice(3)) >= 26032).length);
    const p = {
      id: id, name: name, genre: d.genre || "都市 / 情感", audience: d.audience || "18–30 岁", episodes: no,
      duration: String(d.duration || "90").replace(/[^\d]/g, "") + " 秒 / 集",
      ratio: d.ratio || "9:16 · 1080×1920", language: d.language || "普通话", delivery: d.delivery || "分集 MP4 + 整剧打包 + 字幕文件",
      style: d.style || "待确认", constraints: d.constraints || "无", budget: budget, actual: 0, estimated: Math.round(budget * 0.62),
      status: "草稿", phase: "未启动", done: 0, delivered: 0, quality: "待检测",
      ownerId: u.id || me.userId || me.id, owner: u.name || String(me.name).split(" · ")[0],
      deptId: u.deptId || "D-01", dept: dept, budgetState: "正常",
      created: CLOCK.day, updated: at(), scriptVersion: "—", timelineVersion: "—",
      members: [{ userId: u.id || me.userId || me.id, role: "管理" }]
    };
    D.projects.unshift(p);
    D.budgets.unshift({ scope: "项目", name: id + " " + p.name, total: budget, used: 0, reserve: Math.round(budget * 0.12), state: "正常", owner: p.owner });
    D.briefs.unshift({ id: "CB-" + id.slice(3) + "-01", project: id, version: "v1", mode: d.mode || "自由描述", status: "草稿", by: p.owner, at: at(), note: d.brief || "待补充创作意图" });
    log("项目 " + id, "创建项目（草稿）", "成功", id);
    notify({ type: "项目创建", project: id, title: p.name + " 已创建，等待创意设定", reason: "项目处于草稿状态", impact: "未提交创意设定前不消耗模型额度", action: "填写并提交创意设定", owner: p.owner, link: "creation/brief" });
    return { ok: true, msg: "项目已创建：" + id, data: p };
  }

  /* ---------- brief → 方案 → 剧本 ---------- */
  function submitBrief(projectId, input) {
    const p = prj(projectId), d = input || {};
    if (!p) return { ok: false, msg: "项目不存在" };
    if (["草稿", "创意策划中"].indexOf(p.status) < 0) return { ok: false, msg: "项目当前「" + p.status + "」不可提交创意设定；已锁定项目只能走变更或新建 V2" };
    if (!d.text || d.text.length < 40) return { ok: false, msg: "创作意图至少 40 字，便于生成可比较的方案", fields: { text: "至少 40 字（当前 " + (d.text || "").length + " 字）" } };
    const words = ["血腥", "赌博", "毒品", "色情"];
    const hit = words.filter(w => d.text.indexOf(w) >= 0);
    if (hit.length) return { ok: false, msg: "文本预检未通过：" + hit.join("、") + " 属于禁止设定", fields: { text: "包含禁止词：" + hit.join("、") } };
    const prev = D.briefs.filter(b => b.project === projectId).sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))[0];
    let brief;
    if (prev) {
      const prefix = String(prev.id).replace(/-\d+$/, "");
      const seq = Number(String(prev.id).match(/-(\d+)$/) ? String(prev.id).match(/-(\d+)$/)[1] : 0) + 1;
      const ver = Number(String(prev.version || "v1").replace(/[^\d]/g, "")) + 1;
      brief = Object.assign({}, prev, { id: prefix + "-" + String(seq).padStart(2, "0"), version: "v" + ver, status: "已确认", mode: d.mode || prev.mode, note: d.text, by: actor(), at: at() });
      prev.status = "已被替代";
    } else {
      brief = { id: nid("CB"), project: projectId, version: "v1", status: "已确认", mode: d.mode, note: d.text, by: actor(), at: at() };
    }
    D.briefs.unshift(brief);
    const mv = p.status === "草稿" ? moveTo(p, "创意策划中", "提交创意设定") : { ok: p.status === "创意策划中", msg: p.status === "创意策划中" ? "" : "项目当前「" + p.status + "」不可提交创意设定" };
    if (!mv.ok) return mv;
    log("项目 " + projectId, "提交创意设定 并启动创意生成", "成功", brief.id);
    return { ok: true, msg: "创意设定已确认，已启动创意方案生成", data: brief };
  }

  function generatePlans(projectId) {
    const p = prj(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    const brief = D.briefs.find(b => b.project === projectId && b.status === "已确认");
    if (!brief) return { ok: false, msg: "无已确认创意设定，不能生成方案" };
    const base = D.creativePlans.find(x => x.project === projectId);
    const n = D.creativePlans.filter(x => x.project === projectId).length + 1;
    const plan = { id: "CP-" + projectId.slice(3) + "-" + String.fromCharCode(64 + n), project: projectId, title: p.name + " · 方案 " + n, selling: "由创意设定生成的可比较方案", theme: brief.note.slice(0, 24), hook: "开场 3 秒建立冲突", risk: "需人工判断与现有方向的差异", score: 80 + (n % 4), chosen: false };
    D.creativePlans.push(plan);
    spend(projectId, 6, { cap: "文本生成", task: "—", qty: "约 24k tokens", provider: "推理供应商" });
    log("项目 " + projectId, "生成创意方案（" + plan.id + "）", "成功", plan.id);
    return { ok: true, msg: "已生成新方案：" + plan.id, data: plan };
  }

  function choosePlan(planId) {
    const plan = D.creativePlans.find(x => x.id === planId);
    if (!plan) return { ok: false, msg: "方案不存在" };
    const p = prj(plan.project);
    if (p.status !== "创意策划中") return { ok: false, msg: "当前状态「" + p.status + "」不可变更选定方案" };
    D.creativePlans.forEach(x => { if (x.project === plan.project) x.chosen = (x.id === plan.id); });
    const mv = moveTo(p, "剧本创作中", "选定方案 " + plan.id);
    if (!mv.ok) return mv;
    log("项目 " + plan.project, "选定创意方案 " + plan.id, "成功", plan.id);
    return { ok: true, msg: "已选定方案，项目进入剧本创作中", data: plan };
  }

  function generateScript(projectId) {
    const p = prj(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.status !== "剧本创作中") return { ok: false, msg: "仅「剧本创作中」可生成剧本（当前：" + p.status + "）" };
    const chosen = D.creativePlans.find(x => x.project === projectId && x.chosen);
    if (!chosen) return { ok: false, msg: "尚未选定创意方案，不能生成剧本" };
    const n = D.scripts.filter(s => s.project === projectId).length + 1;
    const id = (projectId + "-V" + n).replace("SP-", "SCR-");
    const script = { id: id, project: projectId, version: "v" + n, status: "待审核", episodes: p.episodes, scenes: p.episodes * 6, shots: p.episodes * 18, lines: p.episodes * 60, by: actor(), at: at(), note: "基于 " + chosen.id + " 生成的候选版本，等待审核", locked: false };
    D.scripts.unshift(script);
    spend(projectId, 8, { cap: "文本生成", task: "—", qty: "约 68k tokens", provider: "推理供应商" });
    const mv = moveTo(p, "待剧本审核", "候选剧本 " + id + " 生成完成");
    if (!mv.ok) return mv;
    p.scriptVersion = id + "（候选）";
    log("项目 " + projectId, "生成候选剧本 " + id, "成功", id);
    notify({ type: "待剧本审核", project: projectId, title: "《" + p.name + "》" + id + " 待审核", reason: "候选剧本生成完成且自检通过", impact: "审核通过前下游生产全部阻塞", state: "待处理", action: "逐集预览后通过或退回", owner: p.owner, link: "creation/review" });
    return { ok: true, msg: "候选剧本已生成：" + id, data: script };
  }

  function approveScript(scriptId, input) {
    const s = D.scripts.find(x => x.id === scriptId);
    if (!s) return { ok: false, msg: "剧本版本不存在" };
    const d = input || {};
    if (!d.note || d.note.length < 10) return { ok: false, msg: "审核依据至少 10 字", fields: { note: "需说明检查项结论与残留风险" } };
    const p = prj(s.project);
    if (p.status !== "待剧本审核") return { ok: false, msg: "项目当前「" + p.status + "」，无法执行剧本审核" };
    D.scripts.forEach(x => { if (x.project === s.project) { x.locked = false; if (x.status === "待审核") x.status = "已废弃"; } });
    s.status = "已通过 · 正式版本"; s.locked = true; s.note = d.note;
    p.scriptVersion = s.id + "（正式，已锁定）";
    D.reviews.unshift({ id: nid("RV"), project: s.project, node: "剧本审核（节点 A）", object: s.id, version: s.version, auditor: actor(), role: App.role().name, at: at(), result: "通过", note: d.note, positions: d.positions || "全剧", tasks: "—", follow: "进入生产准备中" });
    const mv = moveTo(p, "生产准备中", "剧本审核通过并锁定 " + s.id);
    if (!mv.ok) return mv;
    p.phase = "导演规划";
    log("项目 " + s.project, "剧本审核通过并锁定 " + s.id, "成功", "RV-A");
    notify({ type: "剧本通过", project: s.project, title: "《" + p.name + "》剧本已锁定", reason: s.id + " 通过审核", impact: "下游镜头契约可固化，生产任务可提交", state: "已完成", action: "进入导演规划", owner: p.owner, link: "director/plan" });
    return { ok: true, msg: "剧本已锁定，项目进入生产准备中", data: s };
  }

  function rejectScript(scriptId, input) {
    const s = D.scripts.find(x => x.id === scriptId);
    if (!s) return { ok: false, msg: "剧本版本不存在" };
    const d = input || {};
    if (!d.positions || !d.note) return { ok: false, msg: "退回必须指明位置与修改建议", fields: { positions: !d.positions ? "必须填写具体位置" : "", note: !d.note ? "必须给出可执行建议" : "" } };
    const p = prj(s.project);
    s.status = "退回"; s.note = "退回意见：" + d.note;
    D.reviews.unshift({ id: nid("RV"), project: s.project, node: "剧本审核（节点 A）", object: s.id, version: s.version, auditor: actor(), role: App.role().name, at: at(), result: "退回修改", note: d.note, positions: d.positions, tasks: "生成修订任务", follow: "回到剧本创作中" });
    const mv = moveTo(p, "剧本创作中", "剧本 " + s.id + " 退回修改");
    if (!mv.ok) return mv;
    const task = { id: nid("T"), project: s.project, ep: "—", scene: "—", shot: "—", kind: "剧本修订", stage: "创意与剧本", status: "待执行", priority: "高", deps: [], parallelGroup: "SCR", input: s.id + " · " + d.positions, output: "候选剧本 v" + (Number(s.version.slice(1)) + 1), model: "推理模型 R1", config: "PRV-05", executor: p.owner, resourceOwner: p.owner, attempt: 0, maxAttempts: 3, est: 8, actual: 0, failedCost: 0, submitAt: "—", failReason: "—", qc: "—" };
    D.tasks.unshift(task);
    log("项目 " + s.project, "退回剧本 " + s.id + "（" + d.positions + "）", "成功", task.id);
    notify({ type: "剧本退回", project: s.project, title: "《" + p.name + "》剧本退回修改", reason: d.note.slice(0, 40), impact: "修订完成并重新审核前，下游保持阻塞", action: "按意见修订并重新提交审核", owner: s.by, link: "creation/script" });
    return { ok: true, msg: "已退回，修订任务 " + task.id + " 已创建", data: task };
  }

  /* ---------- 拆解产物：真实业务里必须一次生成完整分集、人物、场景、道具与镜头契约 ---------- */
  const EP_TITLES = ["雾里的地址", "第一封信", "没有寄件人", "旧城区的雨", "邮筒下的脚印", "第七个收件人",
    "回信", "雨夜跟踪", "天台上的对峙", "失约的渡口", "名字被划掉", "空白的信纸",
    "谁在敲门", "老周的账本", "被退回的包裹", "雨停之前", "第三封信", "旧城区的回声",
    "不许回头", "空信箱", "回信人", "雨夜对峙", "最后一班渡轮", "雾散之后"];

  function nextId(pool, prefix, width) {
    const max = pool.reduce(function (n, x) {
      const m = String(x.id || "").match(/(\d+)$/);
      return m ? Math.max(n, Number(m[1])) : n;
    }, 0);
    const s = String(max + 1);
    return prefix + "-" + (width ? ("000" + s).slice(-width) : s);
  }

  function ensureEpisodes(projectId) {
    const p = prj(projectId);
    const exist = D.episodes.filter(e => e.project === projectId);
    for (let no = 1; no <= (p.episodes || 0); no++) {
      if (exist.some(e => e.no === no)) continue;
      D.episodes.push({
        project: projectId, no: no, title: EP_TITLES[no - 1] || ("第 " + no + " 集"),
        scenes: 7, shots: 18, duration: "90 秒", status: "待生产", qc: "未开始"
      });
    }
    D.episodes.sort((a, b) => String(a.project).localeCompare(String(b.project)) || a.no - b.no);
  }

  function ensureBaseAssets(projectId) {
    const p = prj(projectId);
    if (!D.characters.some(c => c.project === projectId)) {
      const names = [["沈砚", "30", "窄脸 · 短碎发 · 左眉浅疤", "深灰长风衣 + 旧围巾"],
        ["苏晚", "27", "圆眼 · 低马尾 · 右耳小痣", "米白高领 + 深色外套"],
        ["周伯", "56", "方脸 · 灰白短发 · 深法令纹", "旧夹克 + 布帽"]];
      names.forEach(function (n, i) {
        D.characters.push({
          id: nextId(D.characters, "CH", 2), project: projectId, name: n[0], age: n[1], look: n[2],
          build: i === 0 ? "偏瘦、肩线下沉" : "中等身形", hair: i === 1 ? "低马尾 · 前额碎发" : "短碎发",
          costume: n[3], forbid: "不得改变面部识别点与发型轮廓，不得换装", refs: 3, version: "v1",
          rights: "AI 生成 · 无需真人授权", status: "待确认", reuse: "第 1–" + p.episodes + " 集"
        });
      });
    }
    if (!D.locations.some(l => l.project === projectId)) {
      const locs = [["旧城区 · 雨夜主街", "外景", "窄街 + 邮筒 + 三层旧楼", "钠灯暖光 + 冷雨反射", "冷灰 + 局部暖"],
        ["主角住所 · 内景", "内景", "小客厅 + 旧书桌 + 窗", "单侧窗光 + 台灯", "暖褐"],
        ["渡口 · 夜", "外景", "旧码头 + 集装箱 + 水面", "月光 + 船灯", "灰蓝"]];
      locs.forEach(function (l, i) {
        D.locations.push({
          id: nextId(D.locations, "LC", 2), project: projectId, name: l[0], type: l[1], layout: l[2],
          light: l[3], color: l[4], props: "门框、雨渍、旧招牌", refs: 3, version: "v1",
          rights: "AI 生成 · 无需授权", status: "待确认"
        });
      });
    }
    if (!D.props.some(x => x.project === projectId)) {
      D.props.push({
        id: nextId(D.props, "PR", 2), project: projectId, name: "第三封信", type: "关键道具",
        look: "米白信封 · 蓝色钢笔字 · 右下角雨渍", state: "完整 → 第 19 集被撕开", owner: "沈砚 → 苏晚",
        refs: 3, version: "v1", consistency: "待抽检"
      });
    }
  }

  function ensureEpisodeShots(projectId, ep) {
    const p = prj(projectId);
    const e = D.episodes.find(x => x.project === projectId && x.no === ep);
    if (!e) return [];
    const exist = D.shots.filter(s => s.project === projectId && s.ep === ep);
    if (exist.length >= 18) { e.shots = exist.length; return exist; }
    const chars = D.characters.filter(c => c.project === projectId);
    const locs = D.locations.filter(l => l.project === projectId);
    const frames = ["中景", "近景", "远景", "特写", "过肩", "全景"];
    const moves = ["固定", "缓慢推近", "手持跟拍", "横移", "固定", "拉远"];
    const suffix = projectId.slice(3);
    const out = [];
    for (let i = 1; i <= 18; i++) {
      const ch = chars[(i - 1) % Math.max(chars.length, 1)];
      const lc = locs[(i - 1) % Math.max(locs.length, 1)];
      const sid = "SH-" + suffix + "-E" + pad(ep) + "-" + pad(i);
      if (D.shots.some(x => x.id === sid)) continue;
      const shot = {
        id: sid, project: projectId, ep: ep,
        scene: "0" + Math.ceil(i / 3), no: "SH-" + pad(i), order: i,
        frame: frames[(i - 1) % frames.length], angle: i % 2 ? "平视" : "轻微俯拍",
        move: moves[(i - 1) % moves.length], lens: "35mm 倾向",
        desc: "第 " + ep + " 集 · " + (e.title || "") + " · 分镜 " + i + "（由锁定剧本拆解生成）",
        chars: ch ? ch.name : "—", emotion: i % 3 === 0 ? "紧绷" : "克制",
        line: i === 2 ? "「这封信不是给我的。」" : "—", voice: "环境声 + 雨声",
        duration: i === 8 || i === 16 ? "8 秒" : "5 秒",
        refs: [ch && ch.name, lc && lc.name].filter(Boolean).join(" · ") || "—",
        model: "视频模型 A", quality: "人物一致性 / 画面异常 / 时长", status: "待生成", version: "—"
      };
      D.shots.push(shot); out.push(shot);
    }
    e.scenes = 6;
    e.shots = D.shots.filter(x => x.project === projectId && x.ep === ep).length;
    return D.shots.filter(x => x.project === projectId && x.ep === ep);
  }

  function ensureEpisodeTimeline(projectId, ep) {
    const e = D.episodes.find(x => x.project === projectId && x.no === ep);
    const exist = D.timelines.find(t => t.project === projectId && t.ep === ep);
    if (exist) {
      if (exist.stale > 0) return exist;
      return exist;
    }
    const shots = D.shots.filter(s => s.project === projectId && s.ep === ep && s.status === "已通过");
    const suffix = projectId.slice(3);
    const row = {
      project: projectId, ep: ep, version: "TL-" + suffix + "-E" + pad(ep) + "-V1", tracks: 6,
      clips: shots.length + 2, duration: (e ? e.duration : "90 秒"), timebase: "PTS + 1/25 时基",
      status: "已输出", stale: 0
    };
    D.timelines.push(row);
    if (e) e.timeline = row.version;
    return row;
  }

  function breakdown(projectId) {
    const p = prj(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.status !== "生产准备中") return { ok: false, msg: "仅「生产准备中」可拆解（当前：" + p.status + "）" };
    const s = D.scripts.find(x => x.project === projectId && x.locked);
    if (!s) return { ok: false, msg: "无锁定剧本，拆解会引用错误基准，已阻断" };
    ensureEpisodes(projectId);
    ensureBaseAssets(projectId);
    for (let ep = 1; ep <= p.episodes; ep++) ensureEpisodeShots(projectId, ep);
    ensureBaseAssets(projectId);
    const n = D.plans.filter(x => x.project === projectId).length + 1;
    const epRows = D.episodes.filter(e => e.project === projectId);
    const shots = D.shots.filter(x => x.project === projectId);
    const plan = {
      id: "PP-" + projectId.slice(3) + "-V" + n, project: projectId, version: "v" + n,
      scope: "第 1–" + p.episodes + " 集", shots: shots.length,
      tasks: shots.length + epRows.length * 2, frozen: "—", status: "待固化",
      note: "由 " + s.id + " 拆解生成"    };
    plan.note = "由 " + s.id + " 拆解生成，已建 " + epRows.length + " 集、" + shots.length + " 个镜头契约、" + D.characters.filter(c => c.project === projectId).length + " 个角色，需导演确认后固化";
    D.plans.unshift(plan);
    s.scenes = epRows.reduce((sum, e) => sum + (e.scenes || 0), 0);
    s.shots = shots.length;
    log("项目 " + projectId, "拆解剧本 " + s.id + " 生成集/场/镜头对象", "成功", plan.id);
    notify({ type: "拆解完成", project: projectId, title: "《" + p.name + "》拆解完成", reason: epRows.length + " 集、" + shots.length + " 个镜头契约已生成", impact: "角色与场景待确认，确认后才能固化生产计划", state: "待处理", action: "确认角色 / 场景视觉设定", owner: p.owner, link: "director/plan" });
    return { ok: true, msg: "拆解完成：" + plan.id + "，" + shots.length + " 个镜头契约待导演确认", data: plan };
  }

  /* ---------- 导演规划 ---------- */
  function confirmAsset(kind, id) {
    const pool = kind === "character" ? D.characters : kind === "location" ? D.locations : D.props;
    const item = pool.find(x => x.id === id);
    if (!item) return { ok: false, msg: "资产不存在" };
    if (item.status === "已确认") return { ok: false, msg: item.name + " 已确认，无需重复操作" };
    item.status = "已确认";
    item.at = at(); item.by = actor();
    log("资产 " + id, "确认视觉设定（" + item.name + "）", "成功", id);
    return { ok: true, msg: "已确认：" + item.name };
  }

  function freezePlan(planId) {
    const plan = D.plans.find(x => x.id === planId);
    if (!plan) return { ok: false, msg: "生产计划不存在" };
    const p = prj(plan.project);
    const shots = D.shots.filter(s => s.project === plan.project);
    if (!shots.length) return { ok: false, msg: "无镜头契约，不能固化计划" };
    const pending = D.characters.filter(c => c.project === plan.project && c.status === "待确认").concat(D.locations.filter(l => l.project === plan.project && l.status === "待确认"));
    if (pending.length) return { ok: false, msg: "视觉设定未确认：" + pending.map(x => x.name).join("、") + "，固化会导致人物/场景不一致" };
    const g = gate(plan.project, "生产");
    if (!g.ok) return { ok: false, msg: "生产门禁未通过：" + g.items.filter(i => !i.ok).map(i => i.label).join("、"), data: g };
    plan.status = "已固化"; plan.frozen = at();
    const mv = moveTo(p, "生产中", "生产计划 " + plan.id + " 固化");
    if (!mv.ok) return mv;
    p.phase = "视频生产";
    log("项目 " + plan.project, "固化镜头生产计划 " + plan.id, "成功", plan.id);
    notify({ type: "生产启动", project: plan.project, title: "《" + p.name + "》进入生产中", reason: plan.id + " 已固化，含 " + plan.shots + " 个镜头", impact: "可按镜头提交生产任务", state: "处理中", action: "按场景顺序提交生产任务", owner: p.owner, link: "video/production" });
    return { ok: true, msg: "生产计划已固化，项目进入生产中", data: plan };
  }

  /* ---------- 任务 ---------- */
  function task(id) { return D.tasks.find(t => t.id === id); }
  function eligibility(t) {
    if (!t) return { ok: false, reason: "任务不存在" };
    if (["成功", "已取消"].indexOf(t.status) >= 0) return { ok: false, reason: "任务已终态（" + t.status + "），不能重复执行" };
    if (t.status === "已暂停") return { ok: false, reason: "任务已暂停，请先恢复" };
    const prov = D.providers.find(p => p.id === t.config);
    if (prov && prov.status !== "启用") return { ok: false, reason: "资源配置 " + prov.id + " 当前「" + prov.status + "」，不可提交（不会静默改用他人凭据）" };
    const deps = (t.deps || []).map(d => String(d).match(/T-\d+/)).filter(Boolean).map(m => m[0]);
    const undone = deps.filter(id => { const x = task(id); return x && x.status !== "成功"; });
    if (undone.length) return { ok: false, reason: "前置任务未完成：" + undone.join("、") };
    const bg = budgetOf(t.project);
    if (bg && bg.used + t.est > bg.total) return { ok: false, reason: "预算不足：剩余 ¥" + money(bg.total - bg.used) + "，本次预计 ¥" + t.est };
    return { ok: true };
  }

  function submitTask(input) {
    const d = input || {};
    const p = prj(d.project);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (["生产中", "后期制作中", "异常中"].indexOf(p.status) < 0) return { ok: false, msg: "项目当前「" + p.status + "」，不可提交生产任务" };
    if (p.status === "异常中") return { ok: false, msg: "项目处于异常中，需先恢复后才可提交新任务" };
    const shot = D.shots.find(s => s.id === d.shot);
    if (!shot) return { ok: false, msg: "请选择要生产的镜头（生产以镜头为最小单元）" };
    if (shot.status === "执行中" || shot.status === "排队中") return { ok: false, msg: shot.id + " 已有在执行任务，不可重复提交" };
    const model = d.model || shot.model;
    if (!model || model === "待选择") return { ok: false, msg: "未选择模型，路由策略无法确定" };
    if (String(model).indexOf("备用") >= 0 && (shot.refs || "").split("·").length >= 3) return { ok: false, msg: "备用模型不支持 3 张以上参考图，需先降级为无参考镜头或更换供应商" };
    const kind = d.kind || "视频生成";
    const est = money(Number(d.durationHint ? d.durationHint : 6) * 6.3);
    const t = {
      id: nid("T"), project: d.project, ep: shot.ep, scene: shot.scene, shot: shot.id, kind: kind, stage: kind === "对白配音" ? "音频" : "视频生产",
      status: "排队中", priority: d.priority || "中", deps: [], parallelGroup: "E" + pad(shot.ep), input: shot.refs, output: "MP4 1080×1920 · " + (shot.duration || "6 秒"),
      model: model, config: d.config || "PRV-01", executor: actor(), resourceOwner: actor(), attempt: 0, maxAttempts: 3,
      est: est, actual: 0, failedCost: 0, submitAt: time(), failReason: "—", qc: "待检"
    };
    const chk = eligibility(t);
    if (!chk.ok) return { ok: false, msg: chk.reason };
    D.tasks.unshift(t);
    shot.status = "排队中"; shot.version = "待生成";
    log("任务 " + t.id, "提交生产任务（" + shot.id + "）", "成功", t.id);
    return { ok: true, msg: "任务 " + t.id + " 已提交并排队", data: t };
  }

  function taskShot(t) {
    if (!t) return null;
    return D.shots.find(s => s.id === t.shot) ||
      D.shots.find(s => s.project === t.project && s.ep === Number(t.ep) && s.no === t.shot);
  }

  function runTask(id) {
    const t = task(id);
    const chk = eligibility(t);
    if (!chk.ok) return { ok: false, msg: chk.reason };
    const shot = taskShot(t);
    const attemptNo = (t.attempt || 0) + 1;
    t.attempt = attemptNo;
    t.status = "执行中"; t.submitAt = t.submitAt === "—" ? time() : t.submitAt;
    const prov = D.providers.find(p => p.id === t.config);
    const failReason = (function () {
      if (String(t.model).indexOf("备用") >= 0 && t.model.indexOf("video-b") < 0 && /备用/.test(t.model)) return "备用模型输出分辨率 720×1280，低于交付要求";
      if (prov && prov.test && prov.test.indexOf("失效") >= 0) return "供应商鉴权失败（凭据失效）";
      if (t.kind === "视频生成" && shot && shot.refs && shot.refs.split("·").length >= 4) return "生成结果人物一致性不足（参考图过载）";
      return "";
    })();
    const att = { id: "AT" + t.id.replace("T", "") + "-" + attemptNo, task: t.id, at: time(), status: failReason ? "失败" : "成功", model: t.model, reason: failReason || "—", cost: t.est };
    D.attempts.unshift(att);
    if (failReason) {
      t.failedCost = money((t.failedCost || 0) + t.est);
      spend(t.project, t.est, { task: t.id, cap: t.kind, ep: t.ep, shot: t.shot, est: t.est, failed: t.est, actual: 0, provider: prov ? prov.name : "—", qty: t.output, bearer: prov && prov.ownerId === App.identity().id ? "个人承担" : "企业承担" });
      if (attemptNo >= (t.maxAttempts || 3)) {
        t.status = "待人工处理"; t.failReason = failReason;
        const inc = { id: nid("IN"), project: t.project, type: "任务失败", first: at(), handled: attemptNo, last: at(), action: "按重试上限停止自动重试，转人工", decision: "等待人工决定：换模型 / 换素材 / 取消", result: "未闭环", next: "切换兼容模型或降低参考要求后重试", level: "项目负责人" };
        D.incidents.unshift(inc);
        notify({ type: "异常升级", project: t.project, title: "任务 " + t.id + " 重试达上限转人工", reason: failReason, impact: "该镜头及后续依赖任务暂停", action: "选择兼容模型或调整素材后重试", owner: actor(), link: "tasks/attempt" });
        log("任务 " + t.id, "失败重试达上限转人工", "待人工处理", t.id);
        if (shot) shot.status = "待人工处理";
        return { ok: false, msg: "第 " + attemptNo + " 次尝试失败：" + failReason + "；已达上限，转人工处理", data: t };
      }
      t.status = "失败"; t.failReason = failReason;
      log("任务 " + t.id, "执行失败（第 " + attemptNo + " 次）", "失败", att.id);
      return { ok: false, msg: "第 " + attemptNo + " 次尝试失败：" + failReason + "，可重试（新一次尝试）", data: t };
    }
    const actual = t.est;
    t.status = "成功"; t.actual = actual; t.qc = "待检"; t.failReason = "—";
    spend(t.project, actual, { task: t.id, cap: t.kind, ep: t.ep, shot: t.shot, est: t.est, actual: actual, provider: prov ? prov.name : "—", qty: t.output, bearer: prov && prov.ownerId === App.identity().id ? "个人承担" : "企业承担" });
    if (shot) { shot.status = "待质检"; shot.version = "生成版本 v" + attemptNo + " 待检"; }
    const n = D.assets.filter(a => a.project === t.project).length + 1;
    D.assets.unshift({ id: "A-" + (1200 + n), name: (shot ? shot.id : t.id) + " · 生成结果", cat: "分镜与镜头资产", project: t.project, type: "原始视频", version: "v" + attemptNo, versions: 1, origin: String(t.model) + " · 参数摘要 p-" + (9000 + n), creator: actor(), executor: actor(), size: "1080×1920 · " + (shot ? shot.duration : "6 秒") + " · MP4", checksum: "sha256:" + (100000 + n).toString(16) + "…d" + n, qc: "待检", rights: "AI 生成 · 无需授权", refs: 0, formal: false, at: at(), status: "待质检" });
    log("任务 " + t.id, "执行成功并持久化结果", "成功", t.id);
    return { ok: true, msg: "任务成功：" + t.id + "，已扣费 ¥" + actual + "，结果已持久化", data: t };
  }

  function qcShot(shotId) {
    const s = D.shots.find(x => x.id === shotId);
    if (!s) return { ok: false, msg: "镜头不存在" };
    if (s.status !== "待质检") return { ok: false, msg: "该镜头当前「" + s.status + "」，不在待质检状态" };
    const refCount = (s.refs || "").split("·").filter(Boolean).length;
    const issues = [];
    if (refCount >= 4) issues.push({ dim: "人物一致性", where: s.id + " · 00:02", level: "中", action: "重建参考后局部重生成", auto: "否" });
    if (s.duration && Number(String(s.duration).replace(/[^\d]/g, "")) > 10) issues.push({ dim: "时长", where: s.id, level: "低", action: "裁切至契约时长", auto: "是" });
    const result = issues.length ? "REVIEW_REQUIRED" : "PASS";
    s.qc = result;
    s.status = result === "PASS" ? "已通过" : "待人工判断";
    const assets = D.assets.filter(a => a.project === s.project && a.name.indexOf(s.id) >= 0 && a.status === "待质检");
    assets.forEach(a => { a.qc = result; a.status = result === "PASS" ? "正式" : "待复核"; a.formal = result === "PASS"; });
    const rep = { id: "QR-" + s.project.slice(3) + "-" + s.no + "-" + (D.qualityReports.filter(r => r.object.indexOf(s.id) >= 0).length + 1), object: s.project + " / " + s.id, level: "镜头级", version: s.version, result: result, items: 12, issues: issues.length, review: issues.length, fail: 0, engine: "视觉模型 V2", at: at(), note: issues.length ? issues.length + " 项待人工判断" : "镜头级检测全部通过" };
    D.qualityReports.unshift(rep);
    issues.forEach(i => D.qualityIssues.unshift({ report: rep.id, dim: i.dim, where: i.where, level: i.level, action: i.action, auto: i.auto }));
    log("镜头 " + s.id, "镜头级质量检测（" + result + "）", result === "PASS" ? "成功" : "待处理", rep.id);
    return { ok: result === "PASS", msg: result === "PASS" ? s.id + " 镜头级检测通过，资产转正式" : s.id + " 检测完成，" + issues.length + " 项待人工判断", data: rep };
  }
  function retryTask(id) {
    const t = task(id);
    if (!t) return { ok: false, msg: "任务不存在" };
    if (t.attempt >= t.maxAttempts) return { ok: false, msg: "已达重试上限（" + t.maxAttempts + " 次），需更换模型或调整素材后再提交" };
    if (t.status === "执行中") return { ok: false, msg: "任务正在执行，不能重试" };
    t.status = "排队中"; t.failReason = "—";
    log("任务 " + t.id, "重试（创建新一次尝试）", "成功", t.id);
    return { ok: true, msg: "已重新排队，将创建第 " + (t.attempt + 1) + " 次尝试", data: t };
  }

  function switchModel(id, modelName) {
    const t = task(id);
    if (!t) return { ok: false, msg: "任务不存在" };
    const compat = D.routePolicy.compat;
    const bad = compat.filter(c => !c.ok);
    if (modelName && String(modelName).indexOf("备用") >= 0 && bad.length) {
      return { ok: false, msg: "切换前兼容校验未通过：" + bad.map(b => b.item).join("、") + "；不可直接接管该镜头" };
    }
    t.model = modelName; t.status = "排队中"; t.failReason = "—";
    log("任务 " + t.id, "切换模型为 " + modelName, "成功", t.id);
    return { ok: true, msg: "已切换为 " + modelName + "，兼容校验通过后重新排队", data: t };
  }

  function cancelTask(id, reason) {
    const t = task(id);
    if (!t) return { ok: false, msg: "任务不存在" };
    if (t.status === "成功") return { ok: false, msg: "已成功任务不能取消" };
    t.status = "已取消"; t.failReason = reason || "用户取消";
    const shot = taskShot(t);
    if (shot && shot.status === "排队中") shot.status = "待生成";
    if (t.attempt > 0) {
      const cost = money(t.est * 0.3);
      t.failedCost = money((t.failedCost || 0) + cost);
      spend(t.project, cost, { task: t.id, cap: t.kind, ep: t.ep, shot: t.shot, est: t.est, failed: cost, actual: 0, status: "已确认", provider: "—" });
    }
    log("任务 " + t.id, "取消任务（" + t.failReason + "）", "成功", t.id);
    return { ok: true, msg: "任务已取消" + (t.attempt > 0 ? "，已产生费用 ¥" + money(t.est * 0.3) + " 入账" : ""), data: t };
  }

  /* 连续生产：按镜头提交 → 供应商执行 → 下载持久化 → 镜头质检，禁止把分集直接写成 PASS */
  function batchProduce(projectId, fromEp) {
    const p = prj(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.status !== "生产中") return { ok: false, msg: "当前「" + p.status + "」，仅生产中可连续生产" };
    ensureEpisodes(projectId);
    ensureBaseAssets(projectId);
    const start = Math.max(1, Number(fromEp) || 1);
    const eps = D.episodes.filter(e => e.project === projectId && e.no >= start);
    const todo = eps.filter(e => e.qc !== "PASS");
    if (!todo.length) return { ok: false, msg: "第 " + start + " 集起没有待生产的分集" };

    const human = D.shots.filter(s => s.project === projectId && s.ep >= start &&
      ["待人工处理", "待人工判断"].indexOf(s.status) >= 0);
    if (human.length) {
      return {
        ok: false, msg: "第 " + human[0].ep + " 集存在待人工处理镜头 " + human[0].id + "，连续生产已停止；先完成人工判断再继续",
        data: { blocked: "human", shot: human[0].id }
      };
    }

    const bg = budgetOf(projectId);
    let produced = 0, shotCount = 0, paid = 0, blocked = "", blockedEp = 0;
    for (const e of todo) {
      const shots = ensureEpisodeShots(projectId, e.no);
      const pending = shots.filter(s => s.status !== "已通过");
      const need = money(pending.length * 37.8);
      if (bg && bg.used + need > bg.total) {
        blocked = "预算不足：第 " + e.no + " 集需要约 ¥" + need + "，剩余 ¥" + money(bg.total - bg.used);
        blockedEp = e.no;
        break;
      }
      for (const s of pending) {
        let actualRun = null;
        if (["执行中", "排队中"].indexOf(s.status) >= 0) {
          const queued = D.tasks.find(t => t.project === projectId && ["执行中", "排队中"].indexOf(t.status) >= 0 && (t.shot === s.id || t.shot === s.no));
          if (!queued) { blocked = "镜头 " + s.id + " 显示" + s.status + "，但找不到对应任务，需人工核对"; blockedEp = e.no; break; }
          actualRun = runTask(queued.id);
        } else if (s.status === "待质检") {
          actualRun = { ok: true, data: { actual: 0 } };
        } else if (s.status === "待生成") {
          const sub = submitTask({ project: projectId, shot: s.id, model: s.model === "待选择" ? "视频模型 A" : s.model, config: "PRV-01" });
          if (!sub.ok) { blocked = "第 " + e.no + " 集提交任务失败：" + sub.msg; blockedEp = e.no; break; }
          actualRun = runTask(sub.data.id);
        } else {
          blocked = "镜头 " + s.id + " 当前「" + s.status + "」，需人工判断后才能继续";
          blockedEp = e.no;
          break;
        }
        if (!actualRun.ok) { blocked = "第 " + e.no + " 集执行失败：" + actualRun.msg; blockedEp = e.no; break; }
        const qc = qcShot(s.id);
        if (!qc.ok) { blocked = "第 " + e.no + " 集镜头 " + s.id + " 质检未通过：" + qc.msg; blockedEp = e.no; break; }
        paid += (actualRun.data && actualRun.data.actual) || 0;
        shotCount += 1;
      }
      if (blocked) break;
      ensureEpisodeTimeline(projectId, e.no);
      e.status = "视频已齐 · 待后期";
      e.duration = e.duration === "—" ? "90 秒" : e.duration;
      produced += 1;
    }

    p.done = D.episodes.filter(e => e.project === projectId && e.qc === "PASS").length;
    if (!blocked) {
      moveTo(p, "后期制作中", "全部分集视频生成与镜头质检完成，进入字幕 / 混音 / 合成");
      p.phase = "字幕与音频";
      notify({ type: "生产完成", project: projectId, title: "《" + p.name + "》视频生产完成", reason: shotCount + " 个镜头已下载持久化并通过镜头级质检", impact: "需完成字幕、混音与分集合成后才能做整集质检", state: "待处理", action: "生成字幕、混音并合成时间线", owner: p.owner, link: "post/episodes" });
    }
    log("项目 " + projectId, "连续生产第 " + start + " 集起（" + produced + " 集 / " + shotCount + " 镜头）", blocked ? "阻断" : "成功", projectId);
    return {
      ok: !blocked && produced > 0,
      msg: blocked || ("连续生产完成：" + produced + " 集、" + shotCount + " 个镜头，实际扣费 ¥" + money(paid)),
      data: { produced: produced, shots: shotCount, blocked: blocked, blockedEp: blockedEp }
    };
  }

  /* 后期完成：逐集生成字幕、清点音轨并合成时间线，全部完成后才允许整集质检 */
  function finishPost(projectId) {
    const p = prj(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.status !== "后期制作中") return { ok: false, msg: "当前「" + p.status + "」，仅后期制作中可执行字幕与合成" };
    const eps = D.episodes.filter(e => e.project === projectId && e.qc !== "PASS");
    if (!eps.length) return { ok: false, msg: "没有待后期处理的分集" };
    const blocked = [];
    const waitingSubs = [];
    let done = 0;
    for (const e of eps) {
      const shots = D.shots.filter(s => s.project === projectId && s.ep === e.no);
      const bad = shots.filter(s => s.status !== "已通过");
      if (!shots.length || bad.length) { blocked.push("第 " + e.no + " 集还有 " + bad.length + " 个镜头未通过"); continue; }
      let sub = D.subtitles.find(s => s.project === projectId && s.ep === e.no);
      if (!sub) {
        sub = { project: projectId, ep: e.no, version: "SUB-" + pad(e.no) + " v1", lines: Math.max(12, Math.min(120, shots.length * 3)), timeline: "整数毫秒 · 待校对", asr: "ASR 待比对 · 需人工校对", style: "字号 34 / 安全区 12% / 单行 14 字", status: "处理中" };
        D.subtitles.push(sub);
      }
      if (sub.status !== "已通过") { waitingSubs.push(e.no); continue; }
      const tl = ensureEpisodeTimeline(projectId, e.no);
      if (tl.stale > 0) { blocked.push("第 " + e.no + " 集时间线有 " + tl.stale + " 处标脏"); continue; }
      e.status = "后期完成 · 待质检";
      done += 1;
    }
    if (waitingSubs.length || blocked.length) {
      const parts = [];
      if (blocked.length) parts.push(blocked.join("；"));
      if (waitingSubs.length) parts.push("第 " + waitingSubs.join("、") + " 集字幕已生成但未校对，请到「字幕与口型」逐集校对通过后再完成后期");
      return { ok: false, msg: parts.join("；"), data: { toSubtitle: waitingSubs.length > 0, waitingSubs: waitingSubs, blocked: blocked } };
    }
    const mv = moveTo(p, "质量检测中", "字幕、混音与分集时间线合成完成");
    p.phase = "质量检测";
    p.done = D.episodes.filter(e => e.project === projectId && e.qc === "PASS").length;
    log("项目 " + projectId, "完成字幕 / 混音 / 合成（" + done + " 集）", "成功", projectId);
    notify({ type: "后期完成", project: projectId, title: "《" + p.name + "》分集成片已输出", reason: done + " 集字幕与时间线合成完成", impact: "进入整集质检，通过后才可终审", state: "待处理", action: "执行整集质检", owner: p.owner, link: "post/episodes" });
    return { ok: true, msg: "后期完成：" + done + " 集已合成，进入质量检测中", data: { done: done } };
  }

  /* 时间线重出：替换标脏片段后输出新版本，旧版本保留 */
  function resolveTimeline(projectId, ep, note) {
    const p = prj(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (["后期制作中", "质量检测中"].indexOf(p.status) < 0) return { ok: false, msg: "当前「" + p.status + "」，不可重出时间线" };
    const tl = D.timelines.find(t => t.project === projectId && t.ep === ep);
    if (!tl) return { ok: false, msg: "第 " + ep + " 集没有时间线" };
    if (!tl.stale) return { ok: false, msg: "第 " + ep + " 集没有标脏片段，无需重出" };
    if (!note || note.length < 8) return { ok: false, msg: "替换说明至少 8 字，需记录采用了哪个镜头版本", fields: { note: "说明替换依据" } };
    const n = Number((String(tl.version).match(/V(\d+)/) || [])[1] || 1) + 1;
    const old = tl.version;
    tl.version = "TL-" + projectId.slice(3) + "-E" + pad(ep) + "-V" + n;
    tl.stale = 0; tl.status = "已输出";
    tl.clips = D.shots.filter(s => s.project === projectId && s.ep === ep && s.status === "已通过").length + 2;
    log("时间线 " + old, "替换标脏片段并重出 " + tl.version + "（" + note + "）", "成功", tl.version);
    notify({ type: "时间线重出", project: projectId, title: "第 " + ep + " 集时间线已重出", reason: note, impact: "该集可继续合成与整集质检", state: "已完成", action: "继续后期合成", owner: p.owner, link: "post/timeline" });
    return { ok: true, msg: "第 " + ep + " 集时间线已重出：" + tl.version + "，标脏清零", data: tl };
  }

  /* 整集质检：逐集跑检测，绝不以分集数量冒充通过 */
  function qcAll(projectId) {
    const p = prj(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (["质量检测中", "后期制作中"].indexOf(p.status) < 0) return { ok: false, msg: "当前「" + p.status + "」，不可执行整集质检" };
    if (p.status === "后期制作中") {
      const mv = moveTo(p, "质量检测中", "开始整集质检");
      if (!mv.ok) return mv;
    }
    const eps = D.episodes.filter(e => e.project === projectId && e.qc !== "PASS");
    if (!eps.length) return { ok: false, msg: "全部分集已通过质检，无需重复执行" };
    let passed = 0;
    const failed = [];
    for (const e of eps) {
      const r = runQc(projectId, e.no);
      if (r.ok) passed += 1;
      else failed.push("第 " + e.no + " 集：" + r.msg);
    }
    p.done = D.episodes.filter(e => e.project === projectId && e.qc === "PASS").length;
    log("项目 " + projectId, "整集质检（通过 " + passed + " 集）", failed.length ? "待处理" : "成功", projectId);
    return {
      ok: failed.length === 0,
      msg: failed.length ? ("整集质检通过 " + passed + " 集；" + failed[0]) : ("整集质检完成：" + passed + " 集通过"),
      data: { passed: passed, failed: failed }
    };
  }

  /* ---------- 质量 ---------- */
  function runQc(projectId, ep) {
    const p = prj(projectId);
    const e = D.episodes.find(x => x.project === projectId && x.no === ep);
    if (!e) return { ok: false, msg: "分集不存在" };
    if (p.status !== "后期制作中" && p.status !== "质量检测中" && p.status !== "生产" ) {
      if (["生产中", "后期制作中", "质量检测中", "待最终审核"].indexOf(p.status) < 0) return { ok: false, msg: "当前状态「" + p.status + "」不可执行质检" };
    }
    const shots = D.shots.filter(s => s.project === projectId && s.ep === ep);
    const bad = shots.filter(s => s.status !== "已通过");
    const sub = D.subtitles.find(s => s.project === projectId && s.ep === ep);
    const tl = D.timelines.find(t => t.project === projectId && t.ep === ep);
    const issues = [];
    if (bad.length) issues.push({ dim: "人物一致性", where: "E" + ep + " / " + bad[0].id, level: "中", action: "局部重生成，保留同场景其余镜头", auto: "否" });
    if (sub && sub.status === "处理中") issues.push({ dim: "字幕质量", where: "E" + ep + " / " + sub.version, level: "中", action: "校对错字并复核时间轴", auto: "是" });
    if (tl && tl.stale > 0) issues.push({ dim: "剪辑质量", where: "E" + ep + " / " + tl.version, level: "中", action: "替换标脏片段后重新输出", auto: "是" });
    if (String(ep) === "9" && projectId === "SP-26015") issues.push({ dim: "内容合规", where: "E09 / S02 / SH-02 · 00:01", level: "高", action: "阻断下游；替换画面元素后重生成", auto: "否" });
    const fail = issues.some(i => i.dim === "内容合规");
    const result = fail ? "FAIL" : issues.length ? "REVIEW_REQUIRED" : "PASS";
    const id = "QR-" + projectId.slice(3) + "-E" + ep + "-" + (D.qualityReports.filter(r => r.object.indexOf(projectId + " / 第 " + ep + " ") >= 0).length + 1);
    D.qualityReports.unshift({ id: id, object: projectId + " / 第 " + ep + " 集成片", level: "单集级", version: (tl ? tl.version : "EP" + ep + " v1"), result: result, items: 40 + shots.length, issues: issues.length, review: issues.filter(i => i.level !== "高").length, fail: fail ? 1 : 0, engine: "质检模型 Q1 + 视觉模型 V2", at: at(), note: fail ? "存在合规阻断项" : issues.length ? issues.length + " 项待人工判断" : "全部检测项通过" });
    issues.forEach(i => D.qualityIssues.unshift({ report: id, dim: i.dim, where: i.where, level: i.level, action: i.action, auto: i.auto }));
    e.qc = result; e.status = result === "PASS" ? "已通过质检" : result === "FAIL" ? "质检不通过" : "待人工判断";
    if (p.status !== "质量检测中") moveTo(p, "质量检测中", "分集成片输出完成，系统自动进入质检");
    if (result === "FAIL") {
      moveTo(p, "后期制作中", "质检存在阻断项，回到后期重做");
    }
    log("项目 " + projectId, "执行第 " + ep + " 集质检（" + result + "）", result === "PASS" ? "成功" : "待处理", id);
    if (result !== "PASS") notify({ type: result === "FAIL" ? "质量不通过" : "质量待判断", project: projectId, title: "第 " + ep + " 集质检 " + result, reason: issues.map(i => i.dim).join("、"), impact: "未闭环前该集不可进入终审", action: "返工或人工确认并记录理由", owner: p.owner, link: "quality/reports" });
    maybeAutoReview(projectId);
    return { ok: result === "PASS", msg: result === "PASS" ? "第 " + ep + " 集质检通过" : result === "FAIL" ? "质检不通过，含合规阻断项，项目退回后期制作中" : "质检完成，有 " + issues.length + " 项待人工判断", data: { reportId: id, result: result } };
  }

  function maybeAutoReview(projectId) {
    const p = prj(projectId);
    const eps = D.episodes.filter(e => e.project === projectId);
    if (p.status === "质量检测中" && eps.length >= p.episodes && eps.every(e => e.qc === "PASS")) {
      moveTo(p, "待最终审核", "检测完成且无阻断项（系统自动进入）");
      p.quality = "通过";
      notify({ type: "待最终审核", project: projectId, title: "《" + p.name + "》全部集数质检通过，待终审", reason: "系统自动进入待最终审核", impact: "终审通过后方可生成交付包", action: "执行节点 B 终审", owner: p.owner, link: "post/review" });
      return true;
    }
    return false;
  }

  function judgeIssue(reportId, index, decision, note) {
    const report = D.qualityReports.find(r => r.id === reportId);
    if (!report) return { ok: false, msg: "质量报告不存在" };
    const issues = D.qualityIssues.filter(i => i.report === reportId);
    const issue = issues[index];
    if (!issue) return { ok: false, msg: "检测项不存在" };
    if (decision === "accept" && (!note || note.length < 8)) return { ok: false, msg: "接受现状必须记录理由（至少 8 字）", fields: { note: "需说明可接受的原因" } };
    issue.auto = issue.auto; issue.decision = decision; issue.note = note || ""; issue.by = actor(); issue.at = at();
    report.open = (report.open || 0) - 1;
    if (decision === "rework") {
      const n = D.reworkLedger.length + 1;
      D.reworkLedger.unshift({ id: "RW-" + reportId.split("-")[1] + "-" + (100 + n), project: report.object.split(" / ")[0], target: issue.where, type: issue.dim, round: issues.filter(i => i.decision === "rework").length + 1, cost: 0, old: "旧版本保留", status: "进行中", at: at() });
      log("质量报告 " + reportId, "发起返工（" + issue.dim + "）", "成功", "RW");
      return { ok: true, msg: "已创建返工项：" + issue.where };
    }
    const remaining = issues.filter(i => !i.decision).length;
    if (!remaining) {
      report.result = "PASS"; report.note = "人工判断完成：" + issues.filter(i => i.decision === "accept").length + " 项接受并记录理由";
      const proj = report.object.split(" / ")[0];
      const epNo = Number((report.object.match(/第 (\d+) 集/) || [])[1]);
      const ep = D.episodes.find(e => e.project === proj && e.no === epNo);
      if (ep) { ep.qc = "PASS"; ep.status = "已通过质检"; }
      maybeAutoReview(proj);
      log("质量报告 " + reportId, "人工判断完成，报告转 PASS", "成功", reportId);
    }
    return { ok: true, msg: "已记录判断：" + (decision === "accept" ? "接受现状" : "返工") + (remaining ? "，仍有 " + remaining + " 项待处理" : "，报告已转为通过") };
  }

  /* ---------- 终审 / 交付 / 归档 ---------- */
  function finalReview(projectId, input) {
    const p = prj(projectId), d = input || {};
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.status !== "待最终审核") return { ok: false, msg: "当前「" + p.status + "」，不处于待最终审核" };
    if (d.decision === "pass") {
      if (!d.note || d.note.length < 10) return { ok: false, msg: "终审依据至少 10 字", fields: { note: "需覆盖剧情、质量、合规、交付完整性" } };
      const mv = moveTo(p, "已完成", "终审通过");
      if (!mv.ok) return mv;
      D.reviews.unshift({ id: nid("RV"), project: projectId, node: "最终成片审核（节点 B）", object: p.timelineVersion + " / " + p.episodes + " 集", version: "v-current", auditor: actor(), role: App.role().name, at: at(), result: "通过", note: d.note, positions: "全 " + p.episodes + " 集", tasks: "—", follow: "可生成交付包" });
      log("项目 " + projectId, "终审通过（节点 B）", "成功", "RV-B");
      notify({ type: "终审通过", project: projectId, title: "《" + p.name + "》终审通过，可生成交付包", reason: "节点 B 审核通过", impact: "交付前仍需通过交付清单校验", action: "生成交付包并确认交付", owner: p.owner, link: "post/delivery" });
      return { ok: true, msg: "终审通过，项目进入已完成（可交付）" };
    }
    if (!d.positions || !d.note) return { ok: false, msg: "返工必须指定位置与理由", fields: { positions: !d.positions ? "请指定镜头或集" : "", note: !d.note ? "请说明返工理由" : "" } };
    const mv = moveTo(p, "后期制作中", "终审指定范围返工");
    if (!mv.ok) return mv;
    D.reviews.unshift({ id: nid("RV"), project: projectId, node: "最终成片审核（节点 B）", object: p.timelineVersion, version: "v-current", auditor: actor(), role: App.role().name, at: at(), result: "指定镜头返工", note: d.note, positions: d.positions, tasks: "建立局部返工任务", follow: "回到后期制作中" });
    D.qualityIssues.unshift({ report: "REVIEW-" + projectId, dim: "终审意见", where: d.positions, level: "中", action: "按终审意见局部返工", auto: "否" });
    log("项目 " + projectId, "终审指定返工 " + d.positions, "成功", "RV-B");
    return { ok: true, msg: "已记录返工范围，项目回到后期制作中" };
  }

  function generateDelivery(projectId) {
    const p = prj(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.status !== "已完成") return { ok: false, msg: "当前「" + p.status + "」，仅「已完成」可生成交付包" };
    const g = gate(projectId, "交付");
    if (!g.ok) return { ok: false, msg: "交付门禁未通过：" + g.items.filter(i => !i.ok).map(i => i.label).join("、"), data: g };
    const exists = D.deliveries.find(d => d.project === projectId && d.status !== "未生成（集数未齐）");
    if (exists) { p.status = "已交付"; moveTo(p, "已交付", "交付包已确认"); const chk = gate(projectId, "交付"); return { ok: false, msg: "交付包已存在：" + exists.id }; }
    const n = 1;
    const row = { id: "DP-" + projectId.slice(3) + "-0" + n, project: projectId, version: "V1", episodes: p.episodes, files: 11, size: "6.8 GB", checksum: "sha256:9f3a…c21", reviewer: actor(), at: at(), status: "待确认", receiver: "企业内容库", frozen: false };
    D.deliveries.unshift(row);
    log("项目 " + projectId, "生成交付包 " + row.id + "（待确认）", "成功", row.id);
    return { ok: true, msg: "交付包已生成：" + row.id + "，需确认交付后冻结版本", data: row };
  }

  function confirmDelivery(deliveryId, receiver) {
    const d = D.deliveries.find(x => x.id === deliveryId);
    if (!d) return { ok: false, msg: "交付包不存在" };
    if (d.status !== "待确认") return { ok: false, msg: "交付包状态「" + d.status + "」，不可重复确认" };
    const p = prj(d.project);
    d.status = "已交付"; d.frozen = true; d.receiver = receiver || d.receiver; d.at = at();
    const mv = moveTo(p, "已交付", "交付执行完成");
    if (!mv.ok) return mv;
    p.delivered = p.episodes; p.quality = "通过";
    const w = D.works.find(x => x.project === d.project);
    if (w) { w.status = "已交付"; w.episodes = p.episodes + " / " + p.episodes; w.delivered = CLOCK.day; w.version = "交付 " + d.version + " · 冻结"; w.next = "可新建 V2，不覆盖历史"; }
    else D.works.unshift({ project: d.project, name: p.name, status: "已交付", episodes: p.episodes + " / " + p.episodes, duration: "—", delivered: CLOCK.day, version: "交付 " + d.version + " · 冻结", next: "可新建 V2，不覆盖历史" });
    log("交付 " + d.id, "执行交付并冻结版本", "成功", d.id);
    notify({ type: "交付完成", project: d.project, title: "《" + p.name + "》交付包 " + d.id + " 已确认", reason: "终审通过且集数完整", impact: "交付 V1 已冻结，历史不可覆盖", state: "已完成", action: "查看交付包与校验摘要", owner: p.owner, link: "post/works" });
    return { ok: true, msg: "交付完成，版本已冻结", data: d };
  }

  function archive(pId) {
    const p = prj(pId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.status !== "已交付") return { ok: false, msg: "仅「已交付」项目可归档（当前：" + p.status + "）" };
    const mv = moveTo(p, "已归档", "资产归档完成");
    if (!mv.ok) return mv;
    const w = D.works.find(x => x.project === pId);
    if (w) { w.status = "已归档"; w.next = "只读可查"; }
    log("项目 " + pId, "归档项目与交付资产", "成功", pId);
    return { ok: true, msg: "项目已归档，资产转只读" };
  }

  function pause(projectId, reason) {
    const p = prj(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (!reason) return { ok: false, msg: "暂停必须填写原因", fields: { reason: "请填写暂停原因" } };
    const mv = moveTo(p, "已暂停", reason);
    if (!mv.ok) return mv;
    const running = D.tasks.filter(t => t.project === projectId && ["排队中", "执行中", "待执行"].indexOf(t.status) >= 0);
    running.forEach(t => { t.status = "已暂停"; });
    log("项目 " + projectId, "暂停项目（" + reason + "），暂停 " + running.length + " 个任务", "成功", projectId);
    return { ok: true, msg: "项目已暂停，受影响任务 " + running.length + " 个" };
  }
  function resume(projectId) {
    const p = prj(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.status !== "已暂停") return { ok: false, msg: "仅「已暂停」可恢复（当前：" + p.status + "）" };
    const mv = moveTo(p, "生产中", "恢复项目");
    if (!mv.ok) return mv;
    D.tasks.filter(t => t.project === projectId && t.status === "已暂停").forEach(t => { t.status = "排队中"; });
    log("项目 " + projectId, "恢复项目", "成功", projectId);
    return { ok: true, msg: "项目已恢复，暂停任务重新排队" };
  }
  function terminate(projectId, reason) {
    const p = prj(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (!reason) return { ok: false, msg: "终止必须记录原因", fields: { reason: "请填写终止原因与确认人" } };
    const mv = moveTo(p, "已终止", reason);
    if (!mv.ok) return mv;
    D.tasks.filter(t => t.project === projectId && ["排队中", "执行中", "待执行", "已暂停"].indexOf(t.status) >= 0).forEach(t => { t.status = "已取消"; t.failReason = "项目终止"; });
    log("项目 " + projectId, "终止项目（" + reason + "）", "成功", projectId);
    return { ok: true, msg: "项目已终止，下游计划取消" };
  }

  /* ---------- 授权 / 风险 / 凭据 / 资产 / 预算 ---------- */
  function renewRights(id, term) {
    const r = D.rights.find(x => x.id === id);
    if (!r) return { ok: false, msg: "授权不存在" };
    if (!term || !/^\d{4}-\d{2}-\d{2}$/.test(term)) return { ok: false, msg: "到期日格式应为 YYYY-MM-DD", fields: { term: "格式 YYYY-MM-DD" } };
    r.term = "至 " + term; r.status = "有效"; r.review = "已复核"; r.proof = r.proof === "缺失" ? "补签协议" : r.proof;
    log("授权 " + id, "续期至 " + term, "成功", id);
    return { ok: true, msg: "授权已续期至 " + term };
  }
  function replaceRightsAsset(id) {
    const r = D.rights.find(x => x.id === id);
    if (!r) return { ok: false, msg: "授权不存在" };
    r.status = "有效"; r.proof = "替换素材授权"; r.term = "长期 · 随项目"; r.review = "已复核";
    const key = String(r.subject || "").split("·").pop().trim();
    const inProject = x => !r.project || x.project === r.project;
    const a = D.assets.find(x => inProject(x) && key && String(x.name).indexOf(key) >= 0) ||
      D.assets.find(x => inProject(x) && Number(x.refs) > 0);
    if (a) { a.rights = "已替换 · 平台授权"; a.status = "正式"; a.formal = true; }
    const au = D.audioAssets.find(x => inProject(x) && key && String(x.name).indexOf(key) >= 0) ||
      D.audioAssets.find(x => inProject(x) && /阻断|待补/.test(String(x.rights)));
    if (au) { au.rights = "平台授权 · 全渠道"; au.status = "已通过"; }
    log("授权 " + id, "替换素材并补齐授权 · " + (r.project || "平台级"), "成功", id);
    return { ok: true, msg: "已替换素材并补齐授权，交付阻断解除" };
  }
  function closeRisk(id, note) {
    const r = D.risks.find(x => x.id === id);
    if (!r) return { ok: false, msg: "风险项不存在" };
    if (!note || note.length < 8) return { ok: false, msg: "闭环必须记录处理结论", fields: { note: "至少 8 字" } };
    r.status = "已闭环"; r.decision = note; r.at = at();
    log("风险 " + id, "闭环（" + r.type + "）", "成功", id);
    return { ok: true, msg: "风险已闭环：" + r.id };
  }
  function updateCredential(providerId, key) {
    const p = D.providers.find(x => x.id === providerId);
    if (!p) return { ok: false, msg: "资源配置不存在" };
    if (!key || key.length < 8) return { ok: false, msg: "凭据长度不足", fields: { key: "至少 8 位" } };
    p.masked = key.slice(0, 3) + "••••••••" + key.slice(-4);
    p.status = "启用"; p.test = "待验证";
    log("个人凭据 " + providerId, "凭据变更（仅记录元数据）", "成功", providerId);
    return { ok: true, msg: "凭据已更新（仅保存脱敏元数据），请执行连通性测试" };
  }
  function testProvider(providerId) {
    const p = D.providers.find(x => x.id === providerId);
    if (!p) return { ok: false, msg: "资源配置不存在" };
    if (p.status === "停用" && p.test.indexOf("失效") >= 0) return { ok: false, msg: "测试失败：401 鉴权失败，需先更新凭据" };
    if (p.status === "停用") return { ok: false, msg: "测试失败：资源配置已停用，请先启用" };
    p.status = "启用";
    p.test = "已验证 · " + at();
    log("个人凭据 " + providerId, "连通性测试", "成功", providerId);
    return { ok: true, msg: "测试通过：" + p.name };
  }
  function toggleProvider(providerId, on) {
    const p = D.providers.find(x => x.id === providerId);
    if (!p) return { ok: false, msg: "资源配置不存在" };
    p.status = on ? "启用" : "停用";
    log("个人凭据 " + providerId, on ? "启用资源配置" : "停用资源配置", "成功", providerId);
    return { ok: true, msg: p.name + (on ? " 已启用" : " 已停用") };
  }
  function removeAsset(assetId) {
    const a = D.assets.find(x => x.id === assetId);
    if (!a) return { ok: false, msg: "资产不存在" };
    if (a.refs > 0) return { ok: false, msg: "引用检查未通过：" + a.refs + " 处下游引用，删除会破坏历史，已阻断" };
    if (a.formal) return { ok: false, msg: "正式资产不可删除，只能新版本替代" };
    D.assets.splice(D.assets.indexOf(a), 1);
    log("资产 " + assetId, "删除资产（无引用）", "成功", assetId);
    return { ok: true, msg: "资产已删除：" + assetId };
  }
  function adjustBudget(projectId, total, reason) {
    const bg = budgetOf(projectId);
    if (!bg) return { ok: false, msg: "该项目未设置预算" };
    const n = Number(total);
    if (!n || n <= 0) return { ok: false, msg: "预算金额无效", fields: { total: "必须为正数" } };
    if (n < bg.used) return { ok: false, msg: "新预算低于已用金额（¥" + bg.used + "）", fields: { total: "不得低于已用 ¥" + bg.used } };
    if (!reason || reason.length < 8) return { ok: false, msg: "调整预算必须记录理由", fields: { reason: "至少 8 字" } };
    bg.total = n; bg.state = bg.used >= n * 0.85 ? "接近阈值" : "正常";
    const p = prj(projectId);
    if (p) { p.budget = n; p.budgetState = bg.state; }
    log("预算 " + projectId, "调整项目预算至 ¥" + n + "（" + reason + "）", "成功", projectId);
    return { ok: true, msg: "预算已调整为 ¥" + n };
  }
  function memberStatus(userId, action) {
    const u = D.users.find(x => x.id === userId);
    if (!u) return { ok: false, msg: "成员不存在" };
    if (action === "disable") { u.status = "停用"; u.session = "已冻结"; }
    if (action === "enable") { u.status = "在职"; u.session = "正常"; }
    log("员工 " + userId, action === "disable" ? "账号停用并冻结会话" : "恢复账号", "成功", userId);
    return { ok: true, msg: (action === "disable" ? "账号已停用，" : "账号已恢复，") + "会话" + (action === "disable" ? "已冻结" : "正常") };
  }

  /* ---------- 小说导入与改编 ---------- */
  function importNovel(input) {
    const d = input || {};
    const title = String(d.name || "").trim();
    const author = String(d.author || "").trim();
    const text = String(d.text || "").trim();
    if (!title) return { ok: false, msg: "小说名必填", fields: { name: "必填项，不能为空" } };
    if (title.length < 2 || title.length > 20) return { ok: false, msg: "小说名长度不合法", fields: { name: "名称需 2–20 个字符" } };
    if (!author) return { ok: false, msg: "原著作者必填", fields: { author: "必填项，不能为空" } };
    if (text.length < 300) return { ok: false, msg: "原文不足 300 字，无法支撑改编", fields: { text: "至少 300 字（当前 " + text.length + " 字）" } };
    if (!d.rights) return { ok: false, msg: "未确认改编授权", fields: { rights: "必须确认拥有改编权或已获授权" } };
    const chapters = (text.match(/第[0-9一二三四五六七八九十百千]+[章回节]/g) || []).length || Math.max(1, text.split(/\n\s*\n/).filter(x => x.trim().length > 60).length);

    const cp = createProject(Object.assign({ name: title }, {
      episodes: d.episodes, duration: d.duration, budget: d.budget, dept: d.dept,
      genre: d.genre, audience: d.audience, style: d.style || "按原著基调改编",
      constraints: d.constraints || "不得改变主线结局；不得新增原著不存在的主要人物",
      mode: "小说改编", brief: "改编自《" + title + "》（" + author + "），忠实度：" + (d.fidelity || "适度改编")
    }));
    if (!cp.ok) return cp;
    const p = cp.data;
    D.notifications = D.notifications.filter(n => !(n.project === p.id && /等待创意设定/.test(String(n.title || ""))));
    const brief = D.briefs.find(b => b.project === p.id);
    if (brief) { brief.status = "已确认"; brief.mode = "小说改编"; brief.note = "改编自《" + title + "》（" + author + "），原文 " + text.length + " 字 / " + chapters + " 章；忠实度：" + (d.fidelity || "适度改编"); }

    let mv = moveTo(p, "创意策划中", "导入小说并确认改编设定");
    if (!mv.ok) return mv;
    mv = moveTo(p, "剧本创作中", "按小说章节生成改编稿");
    if (!mv.ok) return mv;

    const n = D.scripts.filter(s => s.project === p.id).length + 1;
    const script = {
      id: ("SCR-" + p.id.slice(3) + "-V" + n), project: p.id, version: "v" + n, status: "待审核",
      episodes: p.episodes, scenes: p.episodes * 6, shots: p.episodes * 18, lines: p.episodes * 46,
      by: actor(), at: at(), locked: false,
      note: "小说改编：原文 " + text.length + " 字 / " + chapters + " 章；" + (d.fidelity || "适度改编") + "；保留主线与人物关系"
    };
    D.scripts.unshift(script);
    p.scriptVersion = script.id + "（候选）";
    p.phase = "改编稿待审核";

    const task = {
      id: nid("T"), project: p.id, ep: "—", scene: "—", shot: "—", kind: "小说改编", stage: "创意与剧本",
      status: "成功", priority: "高", deps: [], parallelGroup: "SCR",
      input: "《" + title + "》原文 " + text.length + " 字 / " + chapters + " 章",
      output: script.id + "（" + p.episodes + " 集改编大纲）", model: "推理模型 R1", config: "PRV-05",
      executor: actor(), resourceOwner: actor(), attempt: 1, maxAttempts: 3, est: 12.0, actual: 11.4,
      failedCost: 0, submitAt: time(), failReason: "—", qc: "结构校验通过"
    };
    D.tasks.unshift(task);
    spend(p.id, 11.4, { cap: "文本生成", task: task.id, qty: "约 " + (Math.round(text.length / 2 / 100) / 10) + " 万 tokens", provider: "推理供应商", note: "小说改编：" + title });

    mv = moveTo(p, "待剧本审核", "改编剧本 " + script.id + " 生成完成");
    if (!mv.ok) return mv;

    log("项目 " + p.id, "导入小说《" + title + "》并生成改编稿 " + script.id, "成功", script.id);
    notify({ type: "待剧本审核", project: p.id, title: "《" + title + "》小说改编稿待审核", reason: "原文 " + chapters + " 章已切分并生成 " + p.episodes + " 集改编稿", impact: "审核通过并锁定后才能拆解镜头", state: "待处理", action: "逐集预览后通过或退回", owner: p.owner, link: "creation/review" });
    return { ok: true, msg: "已创建改编项目 " + p.id + "，剧本候选 " + script.id + " 待审核", data: { project: p, script: script, task: task } };
  }

  /* 演示数据迁移：已在生产的项目必须拥有完整分集与镜头契约，避免「24 集项目只有 4 条分集」的结构性断裂 */
  function normalizeActiveProjects() {
    const active = ["生产准备中", "生产中", "后期制作中", "质量检测中", "待最终审核", "已完成", "已交付"];
    D.projects.filter(p => active.indexOf(p.status) >= 0).forEach(function (p) {
      const seedDone = Number(p.done || 0);
      ensureEpisodes(p.id);
      ensureBaseAssets(p.id);
      for (let ep = 1; ep <= (p.episodes || 0); ep++) {
        const e = D.episodes.find(x => x.project === p.id && x.no === ep);
        ensureEpisodeShots(p.id, ep);
        if (e && ep <= seedDone && e.qc !== "PASS") {
          e.qc = "PASS"; e.status = "已通过质检";
        }
        if (e && e.qc === "PASS") {
          D.shots.filter(s => s.project === p.id && s.ep === ep).forEach(s => {
            s.status = "已通过"; s.qc = "PASS"; s.version = s.version && s.version !== "—" ? s.version : "生成版本 v1";
          });
          ensureEpisodeTimeline(p.id, ep);
          if (!D.subtitles.some(s => s.project === p.id && s.ep === ep)) {
            D.subtitles.push({ project: p.id, ep: ep, version: "SUB-" + pad(ep) + " v1", lines: 88, timeline: "整数毫秒 · 无累计漂移", asr: "错字 0 · 校对完成", style: "字号 34 / 安全区 12% / 单行 14 字", status: "已通过" });
          }
        }
      }
      p.done = D.episodes.filter(e => e.project === p.id && e.qc === "PASS").length;
    });
  }
  normalizeActiveProjects();

  function reset() {
    Object.keys(INITIAL).forEach(function (k) {
      if (k === "currentIdentity") return;
      D[k] = JSON.parse(JSON.stringify(INITIAL[k]));
    });
    CLOCK.day = INITIAL_CLOCK.day; CLOCK.minute = INITIAL_CLOCK.minute; seq = 0;
    normalizeActiveProjects();
    try { window.localStorage.removeItem(STATE_KEY); } catch (err) { /* ignore */ }
    return { ok: true, msg: "已恢复初始演示数据" };
  }

  const RAW_OPS = {
    createProject: createProject, submitBrief: submitBrief, generatePlans: generatePlans, choosePlan: choosePlan,
    generateScript: generateScript, approveScript: approveScript, rejectScript: rejectScript, breakdown: breakdown,
    confirmAsset: confirmAsset, freezePlan: freezePlan,
    submitTask: submitTask, runTask: runTask, retryTask: retryTask, switchModel: switchModel, cancelTask: cancelTask, batchProduce: batchProduce,
    finishPost: finishPost, resolveTimeline: resolveTimeline, qcAll: qcAll,
    runQc: runQc, qcShot: qcShot, judgeIssue: judgeIssue,
    finalReview: finalReview, generateDelivery: generateDelivery, confirmDelivery: confirmDelivery, archive: archive,
    pause: pause, resume: resume, terminate: terminate,
    renewRights: renewRights, replaceRightsAsset: replaceRightsAsset, closeRisk: closeRisk,
    updateCredential: updateCredential, testProvider: testProvider, toggleProvider: toggleProvider,
    removeAsset: removeAsset, adjustBudget: adjustBudget, memberStatus: memberStatus, importNovel: importNovel
  };
  const ops = {};
  Object.keys(RAW_OPS).forEach(function (k) {
    ops[k] = function () {
      const out = RAW_OPS[k].apply(null, arguments);
      persist();
      return out;
    };
  });

  return {
    at: at, time: time, actor: actor, log: log, notify: notify, spend: spend, money: money,
    prj: prj, canMove: canMove, moveTo: moveTo, gate: gate, budgetOf: budgetOf,
    reset: reset, save: persist, ops: ops
  };
})();

