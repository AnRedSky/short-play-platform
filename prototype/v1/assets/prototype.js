/* ==========================================================================
   短剧智能生产平台 · 原型外壳
   统一渲染侧边导航 / 顶栏 / 项目模块页签，并提供原型交互原语。
   页面只写业务内容：<aside data-nav></aside> <header data-topbar></header>
   ========================================================================== */
(function () {
  "use strict";

  const IN_PAGES = /\/pages\//.test(window.location.pathname);
  const h = (file) => (IN_PAGES ? file : "pages/" + file);
  const home = IN_PAGES ? "../index.html" : "index.html";

  /* ---------- 图标（统一 1.6px 线宽，24×24） ---------- */
  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 2.7-4.5 6-4.5s6 1.5 6 4.5"/><path d="M16 6.5a2.6 2.6 0 0 1 0 5"/><path d="M18 19c0-2.2-.8-3.4-2-4"/>',
    shield: '<path d="M12 3l7 3v6c0 4-3 7-7 9-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    building: '<path d="M4 20V6l8-3v17"/><path d="M12 20V9l8 3v8"/><path d="M2 20h20"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h4v18H6a2 2 0 0 1-2-2z"/><path d="M14 3h4a2 2 0 0 1 2 2v14H14"/><path d="M8 8h0"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 15h18M8 4v16M16 4v16"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-4-9 7"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9"/>',
    rows: '<rect x="3" y="4" width="18" height="5"/><rect x="3" y="12" width="11" height="5"/><rect x="16" y="12" width="5" height="5"/>',
    download: '<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    upload: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
    bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    arrowRight: '<path d="M4 12h15"/><path d="M14 7l5 5-5 5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M12 3l9 16H3z"/><path d="M12 9v4M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5"/>',
    x: '<path d="M6 6l12 12M18 6l-12 12"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.6 6.4"/><path d="M20 4v7h-7"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4L11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    dots: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
    scissors: '<circle cx="7" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><path d="M9.5 8.5L20 19M9.5 15.5L20 5"/>',
  };

  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || "") + "</svg>";
  }
  window.icon = svg;

  /* ---------- 配置 ---------- */
  const PROJECT = { name: "长夜将明", code: "NYJM-26", meta: "12 集 · 竖屏 9:16" };

  const NAV = [
    {
      label: "工作台",
      items: [{ key: "dashboard", file: "dashboard.html", icon: "grid", text: "企业工作台" }],
    },
    {
      label: "项目",
      items: [
        { key: "projects", file: "projects.html", icon: "folder", text: "项目空间" },
        { key: "flow", file: "flow.html", icon: "play", text: "制作流程" },
        { key: "project-overview", file: "project-overview.html", icon: "gauge", text: "生产概览", dot: true },
      ],
    },
    {
      label: "企业",
      items: [
        { key: "users", file: "users.html", icon: "users", text: "成员" },
        { key: "roles", file: "roles.html", icon: "shield", text: "角色与权限" },
        { key: "organizations", file: "organizations.html", icon: "building", text: "部门与组织" },
      ],
    },
    {
      label: "配置与运营",
      items: [
        { key: "providers", file: "providers.html", icon: "sparkles", text: "能力与 Provider" },
        { key: "usage", file: "usage.html", icon: "gauge", text: "用量与成本" },
        { key: "audit", file: "audit.html", icon: "rows", text: "审计日志" },
      ],
    },
    {
      label: "原型",
      items: [
        { key: "states", file: "states.html", icon: "layers", text: "交互状态规范" },
        { key: "index", file: home, icon: "dots", text: "原型总览" },
      ],
    },
  ];

  const TABS = [
    { key: "flow", file: "flow.html", text: "制作流程" },
    { key: "project-overview", file: "project-overview.html", text: "概览" },
    { key: "ideas", file: "ideas.html", text: "创意与立项" },
    { key: "stories", file: "stories.html", text: "故事圣经" },
    { key: "episodes", file: "episodes.html", text: "剧集与剧本" },
    { key: "assets", file: "assets.html", text: "资产库" },
    { key: "storyboards", file: "storyboards.html", text: "分镜与镜头" },
    { key: "workflows", file: "workflows.html", text: "生产流水线" },
    { key: "tasks", file: "tasks.html", text: "AI 任务" },
    { key: "reviews", file: "reviews.html", text: "质量与审核" },
    { key: "editor", file: "editor.html", text: "时间线" },
    { key: "exports", file: "exports.html", text: "成片导出" },
    { key: "settings", file: "settings.html", text: "设置" },
  ];

  const CRUMB = {
    dashboard: ["工作台", "企业工作台"],
    projects: ["工作台", "项目空间"],
    users: ["企业", "成员"],
    roles: ["企业", "角色与权限"],
    organizations: ["企业", "部门与组织"],
    providers: ["配置与运营", "能力与 Provider"],
    usage: ["配置与运营", "用量与成本"],
    audit: ["配置与运营", "审计日志"],
    ideas: ["项目", "创意与立项"],
    flow: ["项目", "制作流程"],
    workflows: ["项目", "生产流水线"],
    settings: ["项目", "项目设置"],
    states: ["原型", "交互状态规范"],
    index: ["原型", "系统原型总览"],
  };

  const page = document.body.dataset.page || "";
  const isIndex = page === "index";
  const user = { name: "陈默", role: "制片人 · PRODUCER", initial: "陈" };

  /* ---------- 侧边导航 ---------- */
  function renderSidebar(el) {
    let html =
      '<a class="brand" href="' + (IN_PAGES ? "../index.html" : "index.html") + '">' +
      '<span class="brand-mark">' + svg("film") + "</span>" +
      '<span class="brand-text"><strong>短剧生产平台</strong><small>SHORT-PLAY STUDIO</small></span></a>';

    NAV.forEach((group) => {
      html += '<div class="nav-group"><div class="nav-label">' + group.label + "</div>";
      group.items.forEach((it) => {
        if (it.key === "project-overview" && !document.body.dataset.project) return;
        const active = it.key === page ? " active" : "";
        const dot = it.dot && it.key === "project-overview" ? '<span class="badge-dot">7</span>' : "";
        html +=
          '<a class="nav-link' + active + '" href="' + (it.key === "index" ? it.file : IN_PAGES ? it.file : "pages/" + it.file) + '">' +
          svg(it.icon) + "<span>" + it.text + "</span>" + dot + "</a>";
      });
      html += "</div>";
    });

    html +=
      '<div class="sidebar-foot">' +
      "<strong>私有化部署 · 企业空间</strong>" +
      "组织：星野文化传播<br>环境：staging · v0.9.4<br>" +
      '<a href="' + (IN_PAGES ? "../README.md" : "README.md") + '">原型说明 README ↗</a>' +
      "</div>";
    el.innerHTML = html;
  }

  /* ---------- 顶栏 ---------- */
  function renderTopbar(el) {
    const crumb = CRUMB[page] || ["项目", TABS.find((t) => t.key === page) ? TABS.find((t) => t.key === page).text : PROJECT.name];
    let crumbs = crumb.map((c, i) => (i === crumb.length - 1 ? "<b>" + c + "</b>" : c + '<span class="sep">/</span>')).join("");

    let left = '<div class="topbar-crumbs">' + crumbs + "</div>";
    if (document.body.dataset.project) {
      left +=
        '<button class="project-switch" type="button" data-toast="项目切换需服务端重新下发权限上下文，原型中仅展示选择器">' +
        '<span class="pcode">' + PROJECT.code + '</span><span>' + PROJECT.name + "</span>" + svg("chevron") + "</button>";
    }

    const right =
      '<div class="topbar-right">' +
      '<span class="demo-chip">原型演示数据 · 未接后端</span>' +
      '<button class="icon-btn" type="button" data-toast="通知中心：待审核 3 · 任务失败 2 · 预算预警 1">' + svg("bell") + '<i class="dot"></i></button>' +
      '<div class="user-chip"><span class="avatar">' + user.initial + '</span><span class="user-chip-text"><strong>' + user.name + "</strong><small>" + user.role + "</small></span></div>" +
      "</div>";

    el.innerHTML = left + right;
  }

  /* ---------- 项目模块页签 ---------- */
  function renderTabs(el) {
    if (!document.body.dataset.project) {
      el.remove();
      return;
    }
    let html = TABS.map(
      (t) => '<a class="' + (t.key === page ? "active" : "") + '" href="' + t.file + '">' + t.text + "</a>"
    ).join("");
    html +=
      '<span class="tab-tail"><span class="pill plain accent">' + PROJECT.meta + '</span></span>';
    el.innerHTML = html;
  }

  /* ---------- 交互原语 ---------- */
  const P = {
    toast(msg) {
      let stack = document.querySelector(".toast-stack");
      if (!stack) {
        stack = document.createElement("div");
        stack.className = "toast-stack";
        document.body.appendChild(stack);
      }
      const t = document.createElement("div");
      t.className = "toast";
      t.innerHTML = svg("check") + "<span>" + msg + "</span>";
      stack.appendChild(t);
      setTimeout(() => t.remove(), 2600);
    },
    openDrawer(id) {
      const d = document.getElementById(id);
      if (!d) return;
      d.classList.add("open");
      const b = document.getElementById(id + "-backdrop");
      if (b) b.classList.add("open");
    },
    closeDrawer(id) {
      const d = document.getElementById(id);
      if (!d) return;
      d.classList.remove("open");
      const b = document.getElementById(id + "-backdrop");
      if (b) b.classList.remove("open");
    },
    openModal(id) {
      const m = document.getElementById(id);
      if (!m) return;
      m.classList.add("open");
      const b = document.getElementById(id + "-backdrop");
      if (b) b.classList.add("open");
    },
    closeModal(id) {
      const m = document.getElementById(id);
      if (!m) return;
      m.classList.remove("open");
      const b = document.getElementById(id + "-backdrop");
      if (b) b.classList.remove("open");
    },
    setPill(el, text, cls) {
      if (!el) return;
      el.className = "pill " + cls;
      el.textContent = text;
    },
  };
  window.P = P;

  /* ---------- 全局事件委托 ---------- */
  document.addEventListener("click", (e) => {
    const toastEl = e.target.closest("[data-toast]");
    if (toastEl) P.toast(toastEl.dataset.toast);

    const drawer = e.target.closest("[data-drawer]");
    if (drawer && !e.target.closest("button, a, input, select, textarea")) P.openDrawer(drawer.dataset.drawer);

    const closeDrawer = e.target.closest("[data-close-drawer]");
    if (closeDrawer) P.closeDrawer(closeDrawer.dataset.closeDrawer);

    const modal = e.target.closest("[data-modal]");
    if (modal) P.openModal(modal.dataset.modal);

    const closeModal = e.target.closest("[data-close-modal]");
    if (closeModal) P.closeModal(closeModal.dataset.closeModal);

    const bd = e.target.closest(".drawer-backdrop");
    if (bd) bd.classList.remove("open");
    const mb = e.target.closest(".modal-backdrop");
    if (mb) mb.classList.remove("open");

    // 选中行
    const row = e.target.closest("tr[data-row]");
    if (row && !e.target.closest("a,button,input,select")) {
      const table = row.closest("tbody");
      table.querySelectorAll("tr.is-selected").forEach((r) => r.classList.remove("is-selected"));
      row.classList.add("is-selected");
    }

    // 选择卡
    const sel = e.target.closest("[data-select]");
    if (sel && !e.target.closest("a,button")) {
      const group = sel.closest("[data-select-group]");
      if (group) group.querySelectorAll(".on").forEach((n) => n.classList.remove("on"));
      sel.classList.add("on");
      const target = sel.dataset.select;
      const panel = document.querySelector("[data-select-target='" + (sel.dataset.group || "") + "']");
      if (panel && target) {
        panel.querySelectorAll("[data-bind]").forEach((n) => {
          const v = sel.getAttribute("data-" + n.dataset.bind);
          if (v) n.textContent = v;
        });
      }
    }

    // 页签组
    const tab = e.target.closest("[data-tab]");
    if (tab) {
      const group = tab.closest("[data-tabgroup]");
      if (group) {
        group.querySelectorAll("[data-tab]").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const name = tab.dataset.tab;
        document.querySelectorAll("[data-panel]").forEach((p) => {
          p.hidden = p.dataset.panel !== name;
        });
      }
    }

    // 过滤 chip
    const filter = e.target.closest("[data-filter]");
    if (filter) {
      const group = filter.closest("[data-filter-group]");
      if (group) {
        group.querySelectorAll("[data-filter]").forEach((c) => c.classList.remove("active"));
        filter.classList.add("active");
        const key = filter.dataset.filter;
        const scope = group.dataset.filterGroup;
        document.querySelectorAll("[data-status-group='" + scope + "'] [data-status]").forEach((tr) => {
          tr.style.display = key === "all" || tr.dataset.status === key ? "" : "none";
        });
      }
    }

    // 演示开关
    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      const target = document.getElementById(toggle.dataset.toggle);
      if (target) {
        target.hidden = !target.hidden;
        toggle.classList.toggle("active", !target.hidden);
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".drawer-backdrop.open").forEach((b) => b.classList.remove("open"));
      document.querySelectorAll(".modal-backdrop.open").forEach((b) => b.classList.remove("open"));
    }
  });

  /* ---------- 组装 ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    const sb = document.querySelector("[data-nav]");
    if (sb) renderSidebar(sb);
    const tb = document.querySelector("[data-topbar]");
    if (tb) renderTopbar(tb);
    const tabs = document.querySelector("[data-tabs]");
    if (tabs) renderTabs(tabs);

    // 统一给静态内容补图标占位 <i data-icon="name"></i>
    document.querySelectorAll("i[data-icon]").forEach((n) => {
      n.innerHTML = svg(n.dataset.icon);
      n.style.display = "inline-flex";
    });
  });
})();
