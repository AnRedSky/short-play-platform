/* derived.js：派生数据层（数据层扩展，挂在 DB 命名空间下）。
   所有跨页指标只在这里计算，页面不得再用系数或对象 ID 编造事实。
   运行时身份由应用层注入（App.start → DB.derived.bind），本层不反向依赖应用层。 */
DB.derived = (function () {
  const D = DB;

  const fallbackIdentity = function () {
    return (D.identities && D.identities[0]) || { id: "u-01", name: "系统", role: "owner", userId: "u-01" };
  };
  let ctx = { identity: fallbackIdentity };
  function bind(context) { if (context && context.identity) ctx = { identity: context.identity }; }
  function currentIdentity() { return ctx.identity() || fallbackIdentity(); }

  function actor(me) { return me || currentIdentity(); }

  function actorUser(me) {
    const a = actor(me);
    if (a.userId) return D.users.find(u => u.id === a.userId) || null;
    const name = String(a.name || "").split(" · ")[0];
    return D.users.find(u => u.name === name) || null;
  }

  function isPrivileged(me) {
    const r = actor(me).role;
    return r === "admin" || r === "auditor";
  }

  function visibleProjects(me) {
    const a = actor(me);
    const u = actorUser(a);
    if (isPrivileged(a)) return D.projects.slice();
    if (a.role === "dept") return D.projects.filter(p => p.dept === a.dept || p.deptId === "D-" + a.dept);
    if (a.role === "ops") return [];
    if (!u) return [];
    return D.projects.filter(p => p.ownerId === u.id || (p.members || []).some(m => m.userId === u.id));
  }

  function canViewProject(p, me) {
    if (!p) return false;
    const who = me && typeof me === "object" ? me : undefined;
    return visibleProjects(who).some(x => x.id === p.id);
  }

  function visibleMembers(me) {
    const a = actor(me);
    if (isPrivileged(a)) return D.users.slice();
    if (a.role === "dept") return D.users.filter(u => u.dept === a.dept);
    if (a.role === "ops") return [];
    const ids = {};
    visibleProjects(a).forEach(p => {
      if (p.ownerId) ids[p.ownerId] = 1;
      (p.members || []).forEach(m => { if (m.userId) ids[m.userId] = 1; });
    });
    return D.users.filter(u => ids[u.id]);
  }

  function visibleCosts(me) {
    const ids = visibleProjects(me).map(p => p.id);
    return D.costs.filter(c => ids.indexOf(c.project) >= 0);
  }

  function visibleBudgets(me) {
    const a = actor(me);
    if (isPrivileged(a)) return D.budgets.slice();
    if (a.role === "dept") {
      const dept = D.budgets.filter(b => b.scope === "部门" && b.name === a.dept);
      const proj = D.budgets.filter(b => b.scope === "项目" && visibleProjects(a).some(p => b.name.indexOf(p.id) === 0));
      return dept.concat(proj);
    }
    if (a.role === "owner" || a.role === "staff") {
      return D.budgets.filter(b => b.scope === "项目" && visibleProjects(a).some(p => b.name.indexOf(p.id) === 0));
    }
    return [];
  }

  function scopeLabel(me) {
    const a = actor(me);
    if (a.role === "admin") return "企业全量";
    if (a.role === "auditor") return "企业只读汇总";
    if (a.role === "dept") return a.dept + " · 本部门";
    if (a.role === "ops") return "无业务数据权限";
    return "本人负责或参与的项目";
  }

  /* 「我的项目」= 本人负责或被授权的项目；与「可见范围」不是同一件事（管理员可见全量但不拥有项目） */
  function myProjects(me) {
    const a = actor(me);
    const u = actorUser(a);
    if (!u) return [];
    return D.projects.filter(p => p.ownerId === u.id || (p.members || []).some(m => m.userId === u.id));
  }

  function projectIdOfReport(r) { return String(r.object || "").split(" ")[0]; }

  function qualityOf(p) {
    const reps = D.qualityReports.filter(r => projectIdOfReport(r) === p.id);
    return {
      reports: reps,
      pass: reps.filter(r => r.result === "PASS").length,
      review: reps.filter(r => r.result === "REVIEW_REQUIRED").length,
      fail: reps.filter(r => r.result === "FAIL").length,
      last: reps[0] || null
    };
  }

  function reviewsOf(p) { return D.reviews.filter(r => r.project === p.id); }

  function deliveriesOf(p) {
    return D.deliveries.filter(d => d.project === p.id && String(d.status).indexOf("未生成") < 0);
  }

  function risksOf(p) { return D.risks.filter(r => r.project === p.id && r.status !== "已闭环"); }

  function money(n) { return "¥" + Number(n || 0).toLocaleString("zh-CN"); }

  function home(me) {
    const a = actor(me);
    const mine = myProjects(a);
    const ids = mine.map(p => p.id);
    const openTasks = D.tasks.filter(t => ids.indexOf(t.project) >= 0 && ["排队中", "执行中"].indexOf(t.status) >= 0);
    const reviewOpen = D.reviews.filter(r => ids.indexOf(r.project) >= 0 && r.result !== "通过").length
      + D.qualityReports.filter(r => ids.indexOf(projectIdOfReport(r)) >= 0 && r.result === "REVIEW_REQUIRED").length;
    const cost = mine.reduce((s, p) => s + Number(p.actual || 0), 0);
    const budget = mine.reduce((s, p) => s + Number(p.budget || 0), 0);
    const doneDeliveries = D.deliveries.filter(d => ids.indexOf(d.project) >= 0 && ["已交付", "已归档"].indexOf(d.status) >= 0);
    const deliveredEpisodes = doneDeliveries.reduce((s, d) => s + Number(d.episodes || 0), 0);
    return {
      mine: mine,
      own: mine.filter(p => p.ownerId === (actorUser(a) || {}).id).length,
      join: mine.length - mine.filter(p => p.ownerId === (actorUser(a) || {}).id).length,
      decisions: reviewOpen,
      tasks: openTasks.length,
      queued: openTasks.filter(t => t.status === "排队中").length,
      running: openTasks.filter(t => t.status === "执行中").length,
      cost: cost,
      budget: budget,
      budgetPct: budget ? Math.round(cost / budget * 100) : 0,
      deliveredEpisodes: deliveredEpisodes,
      deliveries: doneDeliveries.length
    };
  }

  function projectSummary(p) {
    const q = qualityOf(p), rv = reviewsOf(p), dp = deliveriesOf(p), rk = risksOf(p);
    return { quality: q, reviews: rv, deliveries: dp, risks: rk };
  }

  /* 项目制作流水线：页面上的阶段、进度与「下一步」只能由业务事实投影出来 */
  function workflow(p) {
    if (!p) return null;
    const eps = D.episodes.filter(e => e.project === p.id);
    const shots = D.shots.filter(s => s.project === p.id);
    const passedShots = shots.filter(s => s.status === "已通过");
    const badShots = shots.filter(s => s.status !== "已通过");
    const humanShots = shots.filter(s => s.status === "待人工处理" || s.status === "待人工判断");
    const locked = D.scripts.find(s => s.project === p.id && s.locked);
    const candidates = D.scripts.filter(s => s.project === p.id && s.status === "待审核");
    const plan = D.plans.filter(x => x.project === p.id).slice(-1)[0] || null;
    const chars = D.characters.filter(c => c.project === p.id);
    const locs = D.locations.filter(l => l.project === p.id);
    const assetLocked = ["已完成", "已交付", "已归档"].indexOf(p.status) >= 0;
    const pendingAssets = assetLocked ? [] : chars.filter(c => c.status === "待确认").concat(locs.filter(l => l.status === "待确认"));
    const subs = D.subtitles.filter(s => s.project === p.id);
    const tls = D.timelines.filter(t => t.project === p.id);
    const stale = tls.reduce((n, t) => n + (t.stale || 0), 0);
    const safeSubs = eps.length ? eps.every(e => subs.some(s => s.ep === e.no && s.status === "已通过")) : false;
    const passEps = eps.filter(e => e.qc === "PASS");
    const total = p.episodes || 0;
    const pct = total ? Math.round(passEps.length / total * 100) : 0;
    const bg = DB.state.budgetOf(p.id);
    const bgPct = bg && bg.total ? Math.round(bg.used / bg.total * 100) : 0;
    const gProd = DB.state.gate(p.id, "生产");
    const gDel = DB.state.gate(p.id, "交付");
    const stat = p.status;

    const stages = [
      { key: "script", label: "剧本锁定", meta: locked ? locked.id : "尚未锁定", state: locked ? "done" : (["剧本创作中", "待剧本审核"].indexOf(stat) >= 0 ? "now" : "wait") },
      { key: "breakdown", label: "拆解与资产", meta: shots.length ? shots.length + " 镜 · " + chars.length + " 角色" : "尚未拆解", state: shots.length && !pendingAssets.length ? "done" : (stat === "生产准备中" ? "now" : "wait") },
      { key: "plan", label: "计划固化", meta: plan ? (plan.status + " · " + plan.id) : "尚未生成计划", state: plan && plan.status === "已固化" ? "done" : (shots.length && !pendingAssets.length && stat === "生产准备中" ? "now" : "wait") },
      { key: "video", label: "视频生产", meta: shots.length ? passedShots.length + " / " + shots.length + " 镜通过" : "待拆解", state: shots.length && passedShots.length === shots.length ? "done" : (stat === "生产中" ? "now" : "wait") },
      { key: "post", label: "字幕与混音", meta: eps.length ? subs.filter(s => s.status === "已通过").length + " / " + eps.length + " 集" : "待生产", state: eps.length && safeSubs && !stale ? "done" : (stat === "后期制作中" ? "now" : "wait") },
      { key: "qc", label: "整集质检", meta: passEps.length + " / " + total + " 集 PASS", state: total && passEps.length === total ? "done" : (stat === "质量检测中" ? "now" : "wait") },
      { key: "final", label: "终审", meta: ["已完成", "已交付", "已归档"].indexOf(stat) >= 0 ? "已通过" : "待质检完成", state: ["已完成", "已交付", "已归档"].indexOf(stat) >= 0 ? "done" : (stat === "待最终审核" ? "now" : "wait") },
      { key: "delivery", label: "交付归档", meta: stat === "已归档" ? "已归档" : stat === "已交付" ? "已交付" : "未交付", state: ["已交付", "已归档"].indexOf(stat) >= 0 ? "done" : (stat === "已完成" ? "now" : "wait") }
    ];

    const next = [];
    if (stat === "草稿") next.push({ key: "brief", title: "填写并提交创意设定", why: "项目只有名称，AI 无法生成可比较的创意方案", cta: "去写创意", action: "projects.wfBrief", tone: "primary" });
    else if (stat === "创意策划中") next.push({ key: "plans", title: "选定一个创意方案", why: "方案未选定，剧本生成会缺少基准", cta: "看方案", action: "projects.wfBrief", tone: "primary" });
    else if (stat === "剧本创作中") next.push({ key: "script", title: "生成候选剧本", why: "已选定方案，但还没有可审核的完整剧本", cta: "生成剧本", action: "projects.wfGenerateScript", tone: "primary" });
    else if (stat === "待剧本审核") next.push({ key: "review", title: "审核并锁定剧本", why: (candidates[0] ? candidates[0].id : "候选剧本") + " 待人工判断；未锁定前拆解与生产全部阻塞", cta: "审核剧本", action: "projects.wfApprove", tone: "primary" });
    else if (stat === "生产准备中") {
      if (!locked) next.push({ key: "lock", title: "先锁定正式剧本", why: "拆解必须引用唯一正式版本", cta: "去审核", action: "projects.wfGoReview", tone: "primary" });
      else if (eps.length < total || !shots.length) next.push({ key: "breakdown", title: "拆解剧本，生成 " + total + " 集镜头契约", why: "当前只有 " + eps.length + " 集、" + shots.length + " 个镜头，无法覆盖全剧", cta: "开始拆解", action: "projects.wfBreakdown", tone: "primary" });
      else if (pendingAssets.length) next.push({ key: "asset", title: "确认 " + pendingAssets.length + " 个角色 / 场景", why: pendingAssets.map(x => x.name).join("、") + " 未确认，固化后会出现人物不一致", cta: "去确认", action: "projects.wfAssets", tone: "primary" });
      else if (!plan || plan.status !== "已固化") next.push({ key: "freeze", title: "固化镜头生产计划", why: "镜头契约与资产已齐，固化后才能提交生产任务", cta: "固化计划", action: "projects.wfFreeze", tone: "primary" });
    } else if (stat === "生产中") {
      if (humanShots.length) next.push({ key: "human", title: "处理第 " + humanShots[0].ep + " 集待人工镜头", why: humanShots[0].id + " 需要人工判断后才能继续整集生产", cta: "处理镜头", action: "projects.wfQuality", tone: "warn" });
      else next.push({ key: "produce", title: "从第 " + (eps.filter(e => e.qc !== "PASS").slice(0, 1)[0] || eps[0] || { no: 1 }).no + " 集连续生产", why: passedShots.length + " / " + (shots.length || total * 18) + " 镜已通过；按集提交、执行、下载并逐镜质检", cta: "开始连续生产", action: "projects.wfBatch", tone: "primary" });
    } else if (stat === "后期制作中") {
      const missingSubEps = eps.filter(e => !subs.some(x => x.ep === e.no));
      const pendingSubEps = eps.filter(e => {
        const s = subs.find(x => x.ep === e.no);
        return s && s.status !== "已通过";
      });
      if (stale) next.push({ key: "timeline", title: "重出第 " + (tls.filter(t => t.stale > 0)[0] || { ep: 1 }).ep + " 集时间线", why: "有 " + stale + " 处片段被上游版本标脏，直接合成会与镜头库不一致", cta: "重出时间线", action: "projects.wfTimeline", tone: "warn" });
      else if (missingSubEps.length) next.push({ key: "post", title: "生成其余 " + missingSubEps.length + " 集字幕并合成", why: "E" + missingSubEps.map(e => e.no).join("、E") + " 还没有字幕；生成后需逐集人工校对", cta: "生成字幕", action: "projects.wfFinishPost", tone: "primary" });
      else if (pendingSubEps.length) next.push({ key: "subs", title: "校对已生成的 " + pendingSubEps.length + " 集字幕", why: "E" + pendingSubEps.map(e => e.no).join("、E") + " 字幕仍未通过；字幕未校对不能进入整集质检", cta: "去字幕校对", action: "projects.wfSubtitle", tone: "warn" });
      else next.push({ key: "post", title: "完成混音与合成 " + total + " 集", why: "字幕已全部通过；时间线合成后进入整集质检", cta: "完成后期", action: "projects.wfFinishPost", tone: "primary" });
    } else if (stat === "质量检测中") next.push({ key: "qc", title: "执行整集质检", why: "已通过 " + passEps.length + " / " + total + " 集；剩余集数需逐集检测", cta: "开始质检", action: "projects.wfQcAll", tone: "primary" });
    else if (stat === "待最终审核") next.push({ key: "final", title: "终审全 " + total + " 集", why: "质检已全部通过，终审结论决定能否生成交付包", cta: "终审", action: "projects.wfFinal", tone: "primary" });
    else if (stat === "已完成") {
      const pendingDp = D.deliveries.find(d => d.project === p.id && d.status === "待确认");
      const failed = gDel.items.filter(i => !i.ok);
      next.push(pendingDp
        ? { key: "confirmDelivery", title: "确认交付并冻结 " + pendingDp.id, why: "交付包已生成，确认后 V1 冻结，历史不可覆盖", cta: "确认交付", action: "projects.wfDelivery", tone: "primary" }
        : !gDel.ok
          ? { key: "deliveryGate", title: "先解除交付阻断", why: "交付门禁未通过：" + failed.map(i => i.label + (i.note ? "（" + i.note + "）" : "")).join("、") + "；不处理无法生成交付包", cta: "处理阻断", action: "projects.wfRights", tone: "warn" }
          : { key: "delivery", title: "生成交付包", why: "终审已通过，交付清单校验通过后生成 V1", cta: "生成交付包", action: "projects.wfDelivery", tone: "primary" });
    }
    else if (stat === "已交付") next.push({ key: "archive", title: "归档项目与交付资产", why: "交付已完成，归档后资产转只读", cta: "归档", action: "projects.wfArchive", tone: "primary" });
    else if (stat === "已归档") next.push({ key: "done", title: "本项目已归档", why: "只读可查；如需修改，新建 V2，不覆盖历史", cta: "查看交付包", action: "projects.wfDelivery", tone: "ghost" });
    else if (stat === "已暂停") next.push({ key: "resume", title: "恢复项目", why: "项目处于暂停，任务已挂起", cta: "恢复", action: "projects.wfResume", tone: "primary" });
    else if (stat === "异常中") next.push({ key: "resume", title: "处理异常并恢复", why: "存在失败任务或阻断项", cta: "查看异常", action: "projects.wfQuality", tone: "warn" });

    if (bg && bg.total && bgPct >= 85 && stat !== "已归档") {
      next.push({ key: "budget", title: "预算已用 " + bgPct + "%，需确认追加", why: "剩余 ¥" + Math.round(bg.total - bg.used) + "，后续任务会被预算预检拦截", cta: "调整预算", action: "projects.wfBudget", tone: "warn" });
    }
    if (!next.length) next.push({ key: "open", title: "查看项目详情", why: "当前没有待处理动作", cta: "打开", action: "projects.wfOpen", tone: "ghost" });

    return {
      stages: stages, next: next, eps: eps, shots: shots, passedShots: passedShots, badShots: badShots,
      humanShots: humanShots, locked: locked, candidates: candidates, plan: plan, chars: chars, locs: locs,
      pendingAssets: pendingAssets, subs: subs, timelines: tls, stale: stale, passEps: passEps,
      total: total, pct: pct, bg: bg, bgPct: bgPct, gateProduction: gProd, gateDelivery: gDel
    };
  }

  return {
    bind: bind, identity: currentIdentity,
    actorUser, visibleProjects, canViewProject, visibleMembers, visibleCosts, visibleBudgets, scopeLabel,
    myProjects, home, projectIdOfReport, qualityOf, reviewsOf, deliveriesOf, risksOf, money, projectSummary, workflow
  };
})();
