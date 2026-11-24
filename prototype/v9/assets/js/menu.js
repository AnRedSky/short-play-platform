/* menu.js：菜单栏布局组件（组件层 · 独立可观测状态管理）。
 *
 * 布局口径：
 *   一级菜单 = 顶层导航域，垂直固定在左侧固定区域（宽度由 --sidebar-w / Menu.setWidth 配置）。
 *   二级菜单 = 流程节点，折叠式垂直列表；同一时刻只展开当前激活一级菜单下的二级列表。
 *   三级（子）菜单 = 具体操作，渲染在主工作区顶部的横向按钮组中，超宽自动横向滚动。
 *
 * 分层口径：组件层不依赖应用层（不引用 App），运行时能力通过 init() 注入；
 * 菜单数据由外部传入，组件不内置任何业务路由或字典。
 *
 * 公共方法：
 *   Menu.init(options)                 初始化（注入菜单数据、权限判定、选中回调）
 *   Menu.build()                       按当前权限重建菜单并渲染
 *   Menu.getState()                    查询当前激活状态（只读副本）
 *   Menu.setActive(next, options)      手动切换菜单（l1 / l2 / l3 可组合）
 *   Menu.selectPath(path, options)     按路由定位菜单（路由 → 菜单 反向同步）
 *   Menu.on(event, handler) / off      订阅 / 取消订阅统一事件通知
 *   Menu.destroy()                     卸载组件
 */
window.Menu = (function () {
  /* ============================================================
   * 类型定义
   * ============================================================
   * @typedef {Object} MenuItem
   * @property {string} id          子菜单唯一标识（三级）
   * @property {string} label       显示文案
   * @property {string} path        对应路由，格式 域/页面
   * @property {string} [perm]      权限码；缺省表示所有可见身份均可访问
   * @property {boolean} [hidden]   仅参与状态解析，不在界面呈现（详情页等上下文页）
   *
   * @typedef {Object} MenuBranch
   * @property {string} id          二级菜单唯一标识（流程节点）
   * @property {string} label       显示文案
   * @property {MenuItem[]} items   三级子菜单列表
   *
   * @typedef {Object} MenuGroup
   * @property {string} id          一级菜单唯一标识（顶层导航域）
   * @property {string} label       显示文案
   * @property {string} [icon]      图标键，由图标工厂提供
   * @property {MenuBranch[]} children 二级菜单列表
   *
   * @typedef {Object} MenuState
   * @property {string} l1          当前激活一级菜单 ID
   * @property {string} l2          当前激活二级菜单 ID
   * @property {string} l3          当前激活子菜单 ID
   * @property {string} path        当前激活子菜单对应路由
   *
   * @typedef {Object} MenuOptions
   * @property {MenuGroup[]} tree   菜单数据（外部传入）
   * @property {(perm: string) => boolean} [can] 权限判定函数，缺省为全部放行
   * @property {(path: string, state: MenuState) => void} [onSelect] 选中回调
   * @property {number} [width]     左侧菜单宽度（px），缺省沿用 CSS 令牌
   * @property {string} [iconOf]    图标工厂（name, size） => svg 字符串
   */

  /* ============================================================
   * 内部状态
   * ============================================================ */
  /** @type {MenuOptions} */
  const CFG = { tree: [], can: () => true, onSelect: null, width: 0, iconOf: null };
  /** @type {MenuState} */
  const STATE = { l1: "", l2: "", l3: "", path: "" };
  /** 一级菜单展开状态：记录每个一级菜单当前展开的二级菜单 ID */
  const EXPANDED = {};
  /** 事件监听器：{ change: Set<Function> } */
  const LISTENERS = { change: new Set() };
  /** 渲染容器 */
  const DOM = { nav: null, bar: null, status: null };
  /** 路由同步进行中标记：避免「菜单 → 路由 → 菜单」回环 */
  let syncing = false;

  /* ============================================================
   * 基础工具
   * ============================================================ */
  function esc(value) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, c => map[c]);
  }
  function allowed(item) {
    if (!item || item.hidden) return false;
    if (!item.perm) return true;
    try { return !!CFG.can(item.perm); } catch (e) { return false; }
  }
  /** 当前身份可见的菜单树（过滤无权限分支与子菜单） */
  function visibleTree() {
    const out = [];
    (CFG.tree || []).forEach(group => {
      const children = (group.children || []).map(branch => ({
        id: branch.id,
        label: branch.label,
        items: (branch.items || []).filter(allowed)
      })).filter(b => b.items.length);
      if (children.length) out.push({ id: group.id, label: group.label, icon: group.icon || "grid", children: children });
    });
    return out;
  }
  /** 路由 → 菜单定位索引（含 hidden 项，保证详情页也能同步状态） */
  function pathIndex() {
    const map = {};
    (CFG.tree || []).forEach(group => {
      (group.children || []).forEach(branch => {
        (branch.items || []).forEach(item => {
          if (item.path) map[item.path] = { l1: group.id, l2: branch.id, l3: item.id, item: item, branch: branch, group: group };
        });
      });
    });
    return map;
  }
  function findGroup(id) { return (CFG.tree || []).find(g => g.id === id) || null; }
  function findBranch(groupId, branchId) {
    const g = findGroup(groupId);
    return g ? (g.children || []).find(b => b.id === branchId) || null : null;
  }
  function firstVisibleItem(branch) {
    if (!branch) return null;
    const list = (branch.items || []).filter(allowed);
    return list.length ? list[0] : null;
  }

  /* ============================================================
   * 事件通知（统一出口）
   * ============================================================ */
  function emit(reason) {
    const snapshot = getState();
    LISTENERS.change.forEach(fn => {
      try { fn(snapshot, reason); } catch (e) { if (window.console) console.error(e); }
    });
    try {
      window.dispatchEvent(new CustomEvent("menu:change", { detail: { state: snapshot, reason: reason } }));
    } catch (e) { /* 无 CustomEvent 环境时忽略 */ }
  }

  /* ============================================================
   * 渲染
   * ============================================================ */
  function iconHtml(name) {
    if (typeof CFG.iconOf === "function") {
      try { return CFG.iconOf(name, 16); } catch (e) { return ""; }
    }
    return "";
  }

  /** 渲染左侧一级菜单 + 折叠式二级菜单 */
  function renderNav(tree) {
    if (!DOM.nav) return;
    const html = tree.map(group => {
      const active = group.id === STATE.l1;
      const expanded = active && EXPANDED[group.id];
      const count = group.children.reduce((n, b) => n + b.items.length, 0);
      const branchHtml = group.children.map(branch => {
        const bActive = branch.id === STATE.l2 && expanded;
        return '<div class="menu-l2-wrap' + (bActive ? " is-active" : "") + '">' +
          '<button type="button" class="menu-l2-item" role="menuitem" tabindex="-1" data-l2="' + esc(branch.id) + '"' +
          (bActive ? ' aria-current="true"' : "") + '>' + esc(branch.label) +
          '<span class="menu-l2-count">' + branch.items.length + '</span></button></div>';
      }).join("");
      return '<div class="menu-l1-wrap' + (active ? " is-active" : "") + (expanded ? " is-open" : "") + '" data-l1="' + esc(group.id) + '">' +
        '<button type="button" class="menu-l1" role="menuitem" id="menu-l1-' + esc(group.id) + '"' +
        ' aria-expanded="' + (expanded ? "true" : "false") + '"' +
        ' aria-controls="menu-branch-' + esc(group.id) + '"' +
        ' data-l1="' + esc(group.id) + '"' +
        ' tabindex="' + (active ? "0" : "-1") + '">' +
        '<span class="menu-l1-ico" aria-hidden="true">' + iconHtml(group.icon) + '</span>' +
        '<span class="menu-l1-text"><b>' + esc(group.label) + '</b><small>' + count + ' 项操作</small></span>' +
        '<span class="menu-l1-chev" aria-hidden="true">›</span></button>' +
        '<div class="menu-l2" id="menu-branch-' + esc(group.id) + '" role="menu" aria-labelledby="menu-l1-' + esc(group.id) + '">' +
        branchHtml + '</div></div>';
    }).join("");
    DOM.nav.innerHTML = '<div class="menu-groups" role="menubar" aria-orientation="vertical" aria-label="主导航">' + html + '</div>';
  }

  /** 渲染主工作区顶部的横向子菜单按钮组 */
  function renderBar(tree) {
    if (!DOM.bar) return;
    const group = tree.find(g => g.id === STATE.l1);
    const branch = group ? group.children.find(b => b.id === STATE.l2) : null;
    if (!branch) {
      DOM.bar.innerHTML = '<div class="submenu-bar is-empty" role="toolbar" aria-label="子菜单"><span class="submenu-empty">当前一级菜单下无可用子菜单</span></div>';
      return;
    }
    const buttons = branch.items.map(item => {
      const active = item.id === STATE.l3;
      return '<button type="button" class="submenu-btn' + (active ? " is-active" : "") + '" data-l3="' + esc(item.id) + '"' +
        ' data-path="' + esc(item.path) + '"' +
        ' tabindex="' + (active ? "0" : "-1") + '"' +
        ' aria-current="' + (active ? "page" : "false") + '"' +
        ' title="' + esc(item.label) + '">' + esc(item.label) + '</button>';
    }).join("");
    DOM.bar.innerHTML = '<div class="submenu-bar" role="toolbar" aria-label="' + esc(branch.label) + ' 子菜单">' +
      '<span class="submenu-title">' + esc(group.label) + ' / ' + esc(branch.label) + '</span>' +
      '<div class="submenu-scroll" tabindex="0" role="group" aria-label="子菜单按钮组，可横向滚动">' + buttons + '</div></div>';
  }

  /** 重新解析容器节点：应用层每次重绘外壳都会替换 DOM，这里按 id 重新绑定，避免指向已卸载节点 */
  function resolveDom() {
    DOM.nav = document.getElementById("menu-root");
    DOM.bar = document.getElementById("submenu-root");
    DOM.status = document.getElementById("menu-status");
  }

  /** 全量渲染（侧栏 + 横向条） */
  function render() {
    resolveDom();
    const tree = visibleTree();
    renderNav(tree);
    renderBar(tree);
    if (DOM.status) {
      const group = tree.find(g => g.id === STATE.l1);
      const branch = group ? group.children.find(b => b.id === STATE.l2) : null;
      const item = branch ? branch.items.find(i => i.id === STATE.l3) : null;
      DOM.status.textContent = "当前菜单：" + (group ? group.label : "无") + " / " + (branch ? branch.label : "无") + " / " + (item ? item.label : "无");
    }
  }

  /* ============================================================
   * 状态切换
   * ============================================================ */
  /**
   * 手动切换菜单状态；仅传入 l1 时自动展开该一级菜单并选中其默认二级 / 子菜单。
   * @param {{l1?:string,l2?:string,l3?:string,path?:string}} next
   * @param {{silent?:boolean, navigate?:boolean, reason?:string}} [options]
   */
  function setActive(next, options) {
    const o = options || {};
    const tree = visibleTree();
    const n = next || {};
    let groupId = n.l1 || STATE.l1;
    let branchId = n.l2 || "";
    let itemId = n.l3 || "";
    let path = n.path || "";

    /* 路由定位优先：传入 path 时按索引解析层级 */
    if (path) {
      const idx = pathIndex()[path];
      if (idx) { groupId = idx.l1; branchId = idx.l2; itemId = idx.l3; }
    }
    const group = tree.find(g => g.id === groupId) || tree[0];
    if (!group) return getState();

    /* 未指定二级时取该一级菜单下第一个可见二级 */
    if (!branchId || !group.children.some(b => b.id === branchId)) {
      const expanded = EXPANDED[group.id];
      branchId = (expanded && group.children.some(b => b.id === expanded))
        ? expanded
        : (group.children[0] || {}).id || "";
    }
    const branch = group.children.find(b => b.id === branchId) || group.children[0];
    if (!branch) return getState();

    /* 未指定子菜单时取该二级菜单的默认（第一个可见）子菜单 */
    if (!itemId || !branch.items.some(i => i.id === itemId)) {
      const def = firstVisibleItem(branch);
      itemId = def ? def.id : "";
      path = def ? def.path : path;
    } else {
      const it = branch.items.find(i => i.id === itemId);
      if (it) path = it.path;
    }

    const changed = groupId !== STATE.l1 || branchId !== STATE.l2 || itemId !== STATE.l3;
    STATE.l1 = groupId;
    STATE.l2 = branchId;
    STATE.l3 = itemId;
    STATE.path = path;
    EXPANDED[groupId] = branchId;

    render();
    if (changed && !o.silent) emit(o.reason || "setActive");
    if (changed && o.navigate !== false && path && typeof CFG.onSelect === "function") {
      try { CFG.onSelect(path, getState()); } catch (e) { if (window.console) console.error(e); }
    }
    return getState();
  }

  /**
   * 按路由反向同步菜单状态（不触发导航，避免与菜单点击形成回环）。
   * @param {string} path
   */
  function selectPath(path, options) {
    const o = options || {};
    const idx = pathIndex()[path];
    if (!idx) {
      /* 路由不在菜单树中（如详情页）：按最近的祖先分支定位，保留当前子菜单 */
      return getState();
    }
    const was = getState();
    const tree = visibleTree();
    const group = tree.find(g => g.id === idx.l1);
    if (!group) return getState();
    const branch = group.children.find(b => b.id === idx.l2);
    if (!branch) return getState();
    const item = branch.items.find(i => i.id === idx.l3);
    if (!item) return getState();
    const changed = was.l1 !== idx.l1 || was.l2 !== idx.l2 || was.l3 !== idx.l3;
    STATE.l1 = idx.l1; STATE.l2 = idx.l2; STATE.l3 = idx.l3; STATE.path = item.path;
    EXPANDED[idx.l1] = idx.l2;
    render();
    if (changed && !o.silent) emit(o.reason || "route");
    return getState();
  }

  /* ============================================================
   * 键盘与焦点管理
   * ============================================================ */
  function focusables(container, selector) {
    return Array.prototype.slice.call(container.querySelectorAll(selector)).filter(el => !el.disabled && el.offsetParent !== null);
  }
  function moveFocus(list, current, delta) {
    if (!list.length) return null;
    let i = list.indexOf(current);
    if (i < 0) i = 0;
    else i = (i + delta + list.length) % list.length;
    const el = list[i];
    if (!el) return null;
    list.forEach(x => x.setAttribute("tabindex", "-1"));
    el.setAttribute("tabindex", "0");
    el.focus();
    if (el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "nearest" });
    return el;
  }

  /** 一级 / 二级菜单键盘导航 */
  function onNavKeydown(e) {
    resolveDom();
    const key = e.key;
    const l1Btn = e.target.closest(".menu-l1");
    if (l1Btn) {
      const l1s = focusables(DOM.nav, ".menu-l1");
      if (key === "ArrowDown" || key === "ArrowUp") {
        e.preventDefault();
        moveFocus(l1s, l1Btn, key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (key === "ArrowRight") {
        e.preventDefault();
        setActive({ l1: l1Btn.dataset.l1 }, { reason: "keyboard" });
        const first = DOM.nav.querySelector('.menu-l1-wrap[data-l1="' + l1Btn.dataset.l1 + '"] .menu-l2-item');
        if (first) first.focus();
        return;
      }
      if (key === "ArrowLeft") {
        e.preventDefault();
        return;
      }
      if (key === "Enter" || key === " ") {
        e.preventDefault();
        const id = l1Btn.dataset.l1;
        const expanded = EXPANDED[id];
        const already = STATE.l1 === id && expanded === STATE.l2;
        if (already) {
          /* 再次按下：折叠当前一级菜单的二级列表 */
          delete EXPANDED[id];
          render();
          emit("collapse");
        } else {
          setActive({ l1: id }, { reason: "keyboard" });
        }
        return;
      }
      if (key === "Home" || key === "End") {
        e.preventDefault();
        moveFocus(l1s, l1Btn, key === "Home" ? -l1s.length : l1s.length);
        return;
      }
      return;
    }
    const l2Btn = e.target.closest(".menu-l2-item");
    if (l2Btn) {
      const wrap = l2Btn.closest(".menu-l1-wrap");
      const l2s = focusables(wrap, ".menu-l2-item");
      if (key === "ArrowDown" || key === "ArrowUp") {
        e.preventDefault();
        moveFocus(l2s, l2Btn, key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (key === "ArrowRight" || key === "Enter" || key === " ") {
        e.preventDefault();
        setActive({ l1: wrap.dataset.l1, l2: l2Btn.dataset.l2 }, { reason: "keyboard" });
        const btn = DOM.bar.querySelector(".submenu-btn.is-active");
        if (btn) btn.focus();
        return;
      }
      if (key === "ArrowLeft") {
        e.preventDefault();
        const l1 = wrap.querySelector(".menu-l1");
        if (l1) l1.focus();
        return;
      }
      if (key === "Home" || key === "End") {
        e.preventDefault();
        moveFocus(l2s, l2Btn, key === "Home" ? -l2s.length : l2s.length);
      }
    }
  }

  /** 横向子菜单按钮组键盘导航 */
  function onBarKeydown(e) {
    resolveDom();
    const key = e.key;
    const btn = e.target.closest(".submenu-btn");
    if (!btn) return;
    const list = focusables(DOM.bar, ".submenu-btn");
    if (key === "ArrowRight" || key === "ArrowDown") {
      e.preventDefault();
      moveFocus(list, btn, 1);
      return;
    }
    if (key === "ArrowLeft" || key === "ArrowUp") {
      e.preventDefault();
      moveFocus(list, btn, -1);
      return;
    }
    if (key === "Home" || key === "End") {
      e.preventDefault();
      moveFocus(list, btn, key === "Home" ? -list.length : list.length);
      return;
    }
    if (key === "Enter" || key === " ") {
      e.preventDefault();
      setActive({ path: btn.dataset.path }, { reason: "keyboard" });
      return;
    }
    if (key === "ArrowDown") {
      e.preventDefault();
    }
  }

  /* ============================================================
   * 事件绑定（document 级委托：应用层重绘外壳时容器会被替换，委托监听保持有效）
   * ============================================================ */
  let bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener("click", e => {
      const nav = document.getElementById("menu-root");
      if (nav && nav.contains(e.target)) {
        const l1 = e.target.closest(".menu-l1");
        if (l1) {
          const id = l1.dataset.l1;
          const expanded = EXPANDED[id];
          if (STATE.l1 === id && expanded === STATE.l2) {
            delete EXPANDED[id];
            render();
            emit("collapse");
          } else {
            setActive({ l1: id }, { reason: "click" });
          }
          return;
        }
        const l2 = e.target.closest(".menu-l2-item");
        if (l2) {
          const wrap = l2.closest(".menu-l1-wrap");
          setActive({ l1: wrap.dataset.l1, l2: l2.dataset.l2 }, { reason: "click" });
          return;
        }
      }
      const bar = document.getElementById("submenu-root");
      if (bar && bar.contains(e.target)) {
        const btn = e.target.closest(".submenu-btn");
        if (btn) setActive({ path: btn.dataset.path }, { reason: "click" });
      }
    });

    document.addEventListener("keydown", e => {
      const nav = document.getElementById("menu-root");
      if (nav && nav.contains(e.target)) { onNavKeydown(e); return; }
      const bar = document.getElementById("submenu-root");
      if (bar && bar.contains(e.target)) onBarKeydown(e);
    });
  }

  /* ============================================================
   * 对外接口
   * ============================================================ */
  /**
   * 初始化组件。
   * @param {MenuOptions} options
   */
  function init(options) {
    const o = options || {};
    /* 重新初始化视为一次全新装配：清空激活态与展开记录 */
    STATE.l1 = ""; STATE.l2 = ""; STATE.l3 = ""; STATE.path = "";
    Object.keys(EXPANDED).forEach(k => { delete EXPANDED[k]; });
    CFG.tree = o.tree || [];
    CFG.can = typeof o.can === "function" ? o.can : () => true;
    CFG.onSelect = typeof o.onSelect === "function" ? o.onSelect : null;
    CFG.iconOf = typeof o.iconOf === "function" ? o.iconOf : null;
    resolveDom();
    if (o.width) {
      CFG.width = o.width;
      document.documentElement.style.setProperty("--sidebar-w", o.width + "px");
    }
    build();
    bind();
    return getState();
  }

  /** 按当前权限重建菜单（身份切换后调用） */
  function build() {
    const tree = visibleTree();
    /* 当前激活项在新权限下不可见时，回退到第一个可用分支 */
    const group = tree.find(g => g.id === STATE.l1);
    const branch = group ? group.children.find(b => b.id === STATE.l2) : null;
    if (!group || !branch) {
      const first = tree[0];
      if (first) {
        const b = first.children[0];
        const it = b ? firstVisibleItem(b) : null;
        STATE.l1 = first.id; STATE.l2 = b ? b.id : ""; STATE.l3 = it ? it.id : ""; STATE.path = it ? it.path : "";
        EXPANDED[first.id] = STATE.l2;
      } else {
        /* 当前身份没有任何可见菜单：清空激活态，避免残留上一身份的选中项 */
        STATE.l1 = ""; STATE.l2 = ""; STATE.l3 = ""; STATE.path = "";
        Object.keys(EXPANDED).forEach(k => { delete EXPANDED[k]; });
      }
    }
    render();
    return getState();
  }

  /** 查询当前激活状态（返回只读副本） */
  function getState() {
    return Object.freeze({ l1: STATE.l1, l2: STATE.l2, l3: STATE.l3, path: STATE.path });
  }

  /**
   * 订阅统一事件通知。
   * @param {"change"} event
   * @param {(state: MenuState, reason: string) => void} handler
   */
  function on(event, handler) {
    if (!LISTENERS[event]) LISTENERS[event] = new Set();
    LISTENERS[event].add(handler);
    return () => off(event, handler);
  }
  function off(event, handler) {
    if (LISTENERS[event]) LISTENERS[event].delete(handler);
  }

  function destroy() {
    LISTENERS.change.clear();
    DOM.nav = null; DOM.bar = null; DOM.status = null;
  }

  return {
    init: init,
    build: build,
    render: render,
    getState: getState,
    setActive: setActive,
    selectPath: selectPath,
    on: on,
    off: off,
    destroy: destroy,
    /** 内部：供应用层在路由变化后静默同步 */
    _sync: function (path) { syncing = true; selectPath(path, { silent: true, reason: "route" }); syncing = false; },
    _isSyncing: function () { return syncing; }
  };
})();
