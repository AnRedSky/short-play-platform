/* 应用层：路由注册表、导航装配、项目上下文、权限判定、内存态与统一反馈。 */
window.App = (function () {
  const HOME = 'overview/home';

  const App = {
    routes: [],
    groups: [],
    current: null,
    menuState: {},
    pendingConfirm: null,
    toastTimer: 0,
    actionHandlers: {},
    submitHandlers: {},
    saveTimer: 0,
    storageKey: 'framework.v7.state',

    /* ---------- 启动与骨架 ---------- */
    start() {
      this.restore();
      this.mobileQuery = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null;
      this.mobileMode = !!(this.mobileQuery && this.mobileQuery.matches);
      if (this.mobileQuery && this.mobileQuery.addEventListener) {
        this.mobileQuery.addEventListener('change', event => {
          this.mobileMode = event.matches;
          this.renderShell();
          this.renderRoute();
        });
      }
      this.renderShell();
      document.addEventListener('click', e => this.handleClick(e));
      document.addEventListener('change', e => this.handleChange(e));
      document.addEventListener('input', e => {
        if (e.target.matches('[data-filter]')) this.applyFilters(e.target);
        else if (e.target.matches('.field')) this.clearFieldError(e.target);
        if (e.target.matches('[data-project-field="brief"]')) {
          const counter = document.querySelector('[data-brief-count]');
          if (counter) counter.textContent = String(e.target.value || '').trim().length;
        }
      });
      document.addEventListener('submit', e => this.handleSubmit(e));
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const overlay = document.getElementById('overlay-root');
        if (overlay && overlay.innerHTML) this.closeOverlay();
        else if (this.mobileMode) this.setNav(false);
      });
      window.addEventListener('hashchange', () => this.renderRoute());
      window.addEventListener('pagehide', () => this.saveNow());
      if (!location.hash) location.hash = '#/' + this.homePath();
      this.renderRoute();
    },

    /* ---------- 演示状态持久化：刷新后保留业务操作结果 ---------- */
    restore() {
      try {
        const raw = window.localStorage && window.localStorage.getItem(this.storageKey);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (!saved || saved.v !== DB.meta.version || !saved.data) return;
        const seedProjects = DB.projects;
        const seedTenants = DB.tenants;
        const seedUsers = DB.users;
        const lists = ['projects', 'tenants', 'users', 'assets', 'audits', 'crossAuthorizations', 'schedule', 'postJobs', 'channels', 'releases', 'models', 'deliveries', 'scriptVersions', 'shots', 'productionTasks', 'qualityChecks', 'reviews', 'impactAnalyses', 'projectHandovers', 'analyticsSnapshots', 'compliance'];
        lists.forEach(key => {
          if (Array.isArray(saved.data[key])) DB[key] = saved.data[key];
        });
        if (saved.data.enterprise) DB.enterprise = Object.assign({}, DB.enterprise, saved.data.enterprise);
        if (saved.data.runtime) {
          DB.runtime = Object.assign({}, DB.runtime, saved.data.runtime);
          DB.runtime.config = Object.assign({}, DB.runtime.config, saved.data.runtime.config || {});
        }
        if (saved.data.reviews === undefined) DB.reviews = DB.reviews || [];
        /* 兼容早期演示存档：补齐新增字段，并把资产的项目引用从标题迁移为项目 ID */
        DB.projects = DB.projects.map(p => Object.assign({}, seedProjects.find(s => s.id === p.id) || {}, p));
        DB.users = DB.users.map(u => Object.assign({}, seedUsers.find(s => s.id === u.id) || {}, u));
        DB.tenants = DB.tenants.map(t => Object.assign({}, seedTenants.find(s => s.id === t.id) || {}, t));
        DB.assets.forEach(asset => {
          const project = DB.projects.find(p => p.id === asset.project || p.title === asset.project) || seedProjects.find(p => p.id === asset.project || p.title === asset.project);
          if (project) asset.project = project.id;
        });
        if (saved.data.state) Object.assign(DB.state, saved.data.state);
      } catch (error) {
        if (!/opaque origins|SecurityError|localStorage/i.test(error && error.message || '')) console.warn('[proto] 本地状态恢复失败，已使用初始数据', error && error.message);
      }
    },

    save() {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = window.setTimeout(() => this.saveNow(), 120);
    },

    saveNow() {
      try {
        if (!window.localStorage) return;
        const data = { state: DB.state, enterprise: DB.enterprise, runtime: DB.runtime };
        ['projects', 'tenants', 'users', 'assets', 'audits', 'crossAuthorizations', 'schedule', 'postJobs', 'channels', 'releases', 'models', 'deliveries', 'scriptVersions', 'shots', 'productionTasks', 'qualityChecks', 'reviews', 'impactAnalyses', 'projectHandovers', 'analyticsSnapshots', 'compliance'].forEach(key => { data[key] = DB[key]; });
        window.localStorage.setItem(this.storageKey, JSON.stringify({ v: DB.meta.version, data: data }));
      } catch (error) {
        if (!/opaque origins|SecurityError|localStorage/i.test(error && error.message || '')) console.warn('[proto] 本地状态保存失败', error && error.message);
      }
    },

    resetDemo() {
      try { window.localStorage.removeItem(this.storageKey); } catch (error) { /* 忽略不可用存储 */ }
      location.reload();
    },

    renderShell() {
      this.syncContext();
      const drawerWasOpen = this.mobileMode && !!document.querySelector('.sidebar.is-open');
      const nav = this.navGroups().map(group => {
        const routes = group.stages.reduce((acc, stage) => acc.concat(stage.routes.filter(r => this.allowed(r))), []);
        if (!routes.length) return '';
        const open = group.key === 'workflow' ? true : this.groupOpen(group.key, group);
        const stages = group.stages.map(stage => {
          const list = stage.routes.filter(r => this.allowed(r));
          if (!list.length) return '';
          const items = list.map(r => {
            const badge = this.badgeText(r);
            return `<a class="nav-link" href="#/${this.esc(r.path)}" data-route="${this.esc(r.path)}"><span class="nav-icon" aria-hidden="true">${this.esc(r.icon)}</span><span class="nav-label">${this.esc(r.title)}</span>${badge ? `<span class="nav-count">${this.esc(badge)}</span>` : ''}</a>`;
          }).join('');
          return `<div class="nav-stage" data-nav-stage="${this.esc(stage.key)}"><div class="nav-stage-head"><span class="nav-stage-index">${this.esc(stage.index)}</span><span class="nav-stage-name">${this.esc(stage.label)}</span><span class="nav-stage-count">${list.length}</span></div>${items}</div>`;
        }).join('');
        const panel = `<div class="nav-submenu" id="nav-${this.esc(group.key)}" data-nav-panel="${this.esc(group.key)}" ${open ? '' : 'hidden'}>${stages}</div>`;
        if (group.key === 'workflow') {
          return `<section class="nav-group nav-group-flat" data-nav-group="${this.esc(group.key)}">${panel}</section>`;
        }
        return `<section class="nav-group" data-nav-group="${this.esc(group.key)}"><button class="nav-group-toggle" type="button" data-nav-group="${this.esc(group.key)}" aria-expanded="${open}" aria-controls="nav-${this.esc(group.key)}"><span class="nav-group-icon" aria-hidden="true">${this.esc(group.icon)}</span><span class="nav-group-title">${this.esc(group.label)}</span><span class="nav-group-total">${routes.length}</span><span class="nav-group-chevron" aria-hidden="true">${open ? '▾' : '▸'}</span></button>${panel}</section>`;
      }).join('');

      const tenants = this.availableTenants();
      const projects = this.accessibleProjects();
      const identity = this.identity();
      const tenantOptions = tenants.map(t => `<option value="${this.esc(t.id)}" ${t.id === DB.state.tenant ? 'selected' : ''}>${this.esc(t.name)}</option>`).join('');
      const projectOptions = projects.map(p => `<option value="${this.esc(p.id)}" ${p.id === DB.state.projectId ? 'selected' : ''}>${this.esc(p.title)}</option>`).join('');
      const identityOptions = DB.identities.map(i => `<option value="${this.esc(i.role)}" ${i.role === DB.state.identity ? 'selected' : ''}>${this.esc(i.label)}</option>`).join('');

      document.getElementById('app').innerHTML = `<div class="shell"><aside class="sidebar" id="side-nav"><nav class="side-navigation" aria-label="业务主导航">${nav}</nav></aside><div class="nav-scrim" data-action="nav:close"></div><main class="main"><div class="route-progress" id="route-progress" aria-hidden="true"></div><header class="topbar"><button class="nav-toggle" type="button" data-action="nav:toggle" aria-label="打开导航菜单" aria-expanded="${drawerWasOpen ? 'true' : 'false'}" aria-controls="side-nav">≡ 导航</button><div class="crumb"><span class="crumb-product">${this.esc(DB.meta.product)}</span><span class="muted">/</span><span id="crumb-group">工作台</span><span class="muted">/</span><b id="crumb-title">工作总览</b></div><div class="top-actions"><select class="top-select" id="tenant-select" aria-label="切换租户工作空间" ${tenants.length ? '' : 'hidden'}>${tenantOptions}</select><select class="top-select project-select" id="project-select" aria-label="切换当前项目" ${projects.length ? '' : 'hidden'}>${projectOptions}</select><select class="top-select" id="identity-select" aria-label="切换演示身份">${identityOptions}</select><div class="avatar" aria-hidden="true">${this.esc(identity.user.slice(0, 1))}</div><div class="user-meta"><b id="user-name">${this.esc(identity.user)}</b><span id="user-role">${this.esc(DB.roleNames[DB.state.identity] || '未知身份')}</span></div></div></header><div id="view" aria-live="polite"></div></main></div>`;
      if (drawerWasOpen) this.setNav(true);
    },

    /* ---------- 窄屏导航抽屉 ---------- */
    setNav(open) {
      const side = document.getElementById('side-nav');
      const scrim = document.querySelector('.nav-scrim');
      const toggle = document.querySelector('.nav-toggle');
      if (!side) return;
      side.classList.toggle('is-open', open);
      if (scrim) scrim.classList.toggle('is-on', open);
      if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    },

    toggleNav() { const side = document.getElementById('side-nav'); this.setNav(!!side && !side.classList.contains('is-open')); },

    closeNav() { if (this.mobileMode) this.setNav(false); },

    /* ---------- 路由 ---------- */
    register(definition) {
      if (!definition || !definition.group || !Array.isArray(definition.routes)) {
        console.warn('[proto] 模块注册参数不完整，已跳过', definition && definition.group);
        return;
      }
      const groupKey = String(definition.group).toLowerCase();
      if (!/^[a-z0-9-]+$/.test(groupKey)) console.warn('[proto] 分组键建议使用 kebab-case', groupKey);
      let group = this.groups.find(g => g.group === groupKey);
      if (!group) {
        group = { group: groupKey, label: definition.label || groupKey, icon: definition.icon || '◈', routes: [] };
        this.groups.push(group);
      }
      definition.routes.forEach(route => {
        if (!route || !route.path || typeof route.render !== 'function') {
          console.warn('[proto] 路由定义缺少 path 或 render，已跳过', groupKey);
          return;
        }
        if (!route.path.startsWith(groupKey + '/')) console.warn('[proto] 路由前缀与分组不一致', route.path);
        if (this.routes.some(r => r.path === route.path)) {
          console.warn('[proto] 重复路由已忽略', route.path);
          return;
        }
        const stageKey = route.stage || definition.stage || groupKey;
        if (Array.isArray(DB.flow) && DB.flow.length && !DB.flow.some(g => (g.stages || []).some(s => s.key === stageKey))) {
          console.warn('[proto] 路由所属工作台环节未在 DB.flow 中登记', route.path, stageKey);
        }
        const normalized = {
          path: route.path,
          group: groupKey,
          stage: stageKey,
          order: route.order || 0,
          title: route.title || route.path,
          icon: route.icon || '·',
          badge: route.badge || '',
          permission: route.permission || groupKey,
          render: route.render
        };
        this.routes.push(normalized);
        group.routes.push(normalized);
      });
    },

    renderRoute() {
      this.syncContext();
      this.closeNav();
      this.pulseProgress();
      const raw = decodeURIComponent(location.hash.replace(/^#\/?/, '')) || '';
      const splitAt = raw.indexOf('?');
      const pathPart = splitAt > -1 ? raw.slice(0, splitAt) : raw;
      const params = new URLSearchParams(splitAt > -1 ? raw.slice(splitAt + 1) : '');
      this.focusContext(params.get('id'));
      const path = pathPart || this.homePath();
      const route = this.routes.find(r => r.path === path);
      const view = document.getElementById('view');
      if (!view) return;

      if (!route) {
        this.current = null;
        this.setCrumb('页面不存在', '导航', '404');
        document.title = `页面不存在 · ${DB.meta.product} ${DB.meta.version}`;
        this.markNav(null);
        view.innerHTML = `<section class="page"><div class="card">${UI.empty('页面不存在（404）', '该地址没有注册在当前版本的导航中，请返回可用页面。', UI.btn('返回可用首页', 'go:' + this.homePath(), 'btn-primary'))}</div></section>`;
        this.playEnter(view);
        return;
      }

      if (!this.allowed(route)) {
        this.current = null;
        this.setCrumb('访问范围受限', '权限', '403');
        document.title = `访问范围受限 · ${DB.meta.product} ${DB.meta.version}`;
        this.markNav(null);
        view.innerHTML = `<section class="page"><div class="card">${UI.empty('暂无权限（403）', '当前身份「' + (DB.roleNames[DB.state.identity] || '未知身份') + '」没有此业务域的访问权限，可切换身份或联系企业管理员开通。', UI.btn('返回可用首页', 'go:' + this.homePath(), 'btn-primary'))}</div></section>`;
        this.playEnter(view);
        return;
      }

      this.current = route;
      const flowGroup = (DB.flow || []).find(group => (group.stages || []).some(stage => stage.key === route.stage));
      const stageDef = flowGroup ? flowGroup.stages.find(stage => stage.key === route.stage) : null;
      this.setCrumb(route.title, flowGroup ? flowGroup.label : '', stageDef ? stageDef.label : '');
      this.markNav(path);
      const navGroup = this.navGroups().find(g => g.stages.some(s => s.routes.some(r => r.path === path)));
      if (navGroup && !this.groupOpen(navGroup.key, navGroup)) this.toggleGroup(navGroup.key);
      document.title = route.title + ' · ' + DB.meta.product + ' ' + DB.meta.version;
      try {
        const html = route.render(params);
        view.innerHTML = html || `<div class="card">${UI.empty('页面暂无内容', '该页面返回空视图，请检查模块渲染配置。', UI.btn('返回可用首页', 'go:' + this.homePath(), 'btn-primary'))}</div>`;
      } catch (error) {
        console.error('[proto] 页面渲染失败', route.path, error);
        view.innerHTML = `<div class="card">${UI.empty('页面渲染失败', '当前页面无法渲染，已保留导航与其他页面可用。', UI.btn('返回可用首页', 'go:' + this.homePath(), 'btn-primary'))}</div>`;
      }
      this.playEnter(view);
      this.refreshProjectSelector();
      window.scrollTo({ top: 0, behavior: 'auto' });
    },

    /* 页面切换：淡入 + 轻微上移，避免白屏；进度条给出即时反馈 */
    playEnter(view) {
      if (!view) return;
      view.classList.remove('view-enter');
      void view.offsetWidth;
      view.classList.add('view-enter');
    },

    pulseProgress() {
      const bar = document.getElementById('route-progress');
      if (!bar) return;
      window.clearTimeout(this.progressTimer);
      bar.classList.remove('is-done');
      bar.style.width = '0';
      window.requestAnimationFrame(() => { bar.style.width = '68%'; });
      this.progressTimer = window.setTimeout(() => {
        bar.style.width = '100%';
        bar.classList.add('is-done');
        window.setTimeout(() => { bar.style.width = '0'; bar.classList.remove('is-done'); }, 240);
      }, 320);
    },

    homePath() {
      const route = this.routes.find(r => this.allowed(r));
      return route ? route.path : HOME;
    },

    setCrumb(title, groupLabel, stageLabel) {
      const crumb = document.getElementById('crumb-title');
      const group = document.getElementById('crumb-group');
      if (crumb) crumb.textContent = title;
      if (group) group.textContent = [groupLabel, stageLabel].filter(Boolean).join(' · ') || '工作台';
    },

    markNav(path) {
      document.querySelectorAll('.nav-link').forEach(link => {
        const active = path !== null && link.dataset.route === path;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      document.querySelectorAll('.nav-stage').forEach(stage => stage.classList.toggle('is-active', !!stage.querySelector('.nav-link.active')));
    },

    /* 导航模型：一级（工作台 / 企业与平台）→ 制作环节 → 页面，全部由路由 stage 派生 */
    navGroups() {
      const flow = Array.isArray(DB.flow) && DB.flow.length
        ? DB.flow
        : [{ group: 'workflow', label: '工作台', icon: '◫', defaultOpen: true, stages: this.groups.map(g => ({ key: g.group, label: g.label })) }];
      let index = 0;
      return flow.map(group => ({
        key: group.group,
        label: group.label,
        icon: group.icon || '◈',
        defaultOpen: group.defaultOpen !== false,
        stages: (group.stages || []).map(stage => {
          index += 1;
          return { key: stage.key, label: stage.label, index: String(index).padStart(2, '0'), routes: this.routes.filter(r => (r.stage || r.group) === stage.key).sort((a, b) => (a.order || 99) - (b.order || 99)) };
        })
      })).filter(group => group.stages.length);
    },

    navigate(path) {
      const target = '#/' + path;
      if (location.hash === target) this.renderRoute();
      else location.hash = target;
    },

    /* 跳转时同步项目 / 租户上下文，避免详情页与顶栏选择器脱节 */
    go(target) {
      const splitAt = target.indexOf('?');
      const path = splitAt > -1 ? target.slice(0, splitAt) : target;
      const params = new URLSearchParams(splitAt > -1 ? target.slice(splitAt + 1) : '');
      this.focusContext(params.get('id'));
      this.navigate(path + (splitAt > -1 ? target.slice(splitAt) : ''));
    },

    /* 深链与列表跳转统一同步项目/租户上下文，避免页面展示 A、操作落到 B */
    focusContext(id) {
      if (!id) return;
      const tenantIds = this.availableTenants().map(t => t.id);
      const identity = this.identity();
      const projectHit = DB.projects.find(p => p.id === id && tenantIds.indexOf(p.tenant) > -1 && (DB.state.identity !== 'employee' || p.owner === identity.user));
      if (projectHit) {
        DB.state.tenant = projectHit.tenant;
        DB.state.projectId = projectHit.id;
      } else if (tenantIds.indexOf(id) > -1) {
        DB.state.tenant = id;
      }
    },

    groupOpen(key, group) {
      if (key === 'workflow') return true;
      const state = this.menuState[key];
      if (state !== undefined) return state !== false;
      if (this.mobileMode) return false;
      return !group || group.defaultOpen !== false;
    },

    toggleGroup(key) {
      const panel = document.querySelector('[data-nav-panel="' + key + '"]');
      const next = panel ? panel.hidden : true;
      this.menuState[key] = next;
      const toggle = document.querySelector('.nav-group-toggle[data-nav-group="' + key + '"]');
      if (panel) panel.hidden = !next;
      if (toggle) {
        toggle.setAttribute('aria-expanded', String(next));
        const chevron = toggle.querySelector('.nav-group-chevron');
        if (chevron) chevron.textContent = next ? '▾' : '▸';
      }
    },

    /* ---------- 身份、权限与上下文 ---------- */
    allowed(route) {
      const codes = DB.permissions[DB.state.identity] || [];
      return codes.indexOf('*') > -1 || codes.indexOf(route.permission || route.group) > -1;
    },

    badgeText(route) {
      const value = typeof route.badge === 'function' ? route.badge() : route.badge;
      return value ? String(value) : '';
    },

    identity() {
      return DB.identities.find(i => i.role === DB.state.identity) || DB.identities[0];
    },

    tenant() {
      return DB.tenants.find(t => t.id === DB.state.tenant) || null;
    },

    tenantName() {
      const tenant = this.tenant();
      if (tenant) return tenant.name;
      return DB.state.identity === 'platform' ? '平台运维域' : '未选择租户';
    },

    availableTenants() {
      const identity = this.identity();
      const ids = identity && identity.tenants ? identity.tenants : [];
      return DB.tenants.filter(t => ids.indexOf(t.id) > -1 && t.status !== '已归档');
    },

    accessibleProjects() {
      const identity = this.identity();
      const ids = this.availableTenants().map(t => t.id);
      return DB.projects.filter(p => p.tenant === DB.state.tenant && ids.indexOf(p.tenant) > -1 && (DB.state.identity !== 'employee' || p.owner === identity.user));
    },

    resolveTenant(id) {
      return (id ? DB.tenants.find(t => t.id === id) : null) || this.tenant();
    },

    resolveProject(id) {
      const list = this.accessibleProjects();
      return (id ? list.find(p => p.id === id) : null) || list.find(p => p.id === DB.state.projectId) || list[0] || null;
    },

    project() {
      return this.resolveProject(DB.state.projectId);
    },

    projectName() {
      const project = this.project();
      return project ? project.title : '未选择项目';
    },

    syncContext() {
      const tenants = this.availableTenants();
      if (!tenants.some(t => t.id === DB.state.tenant)) DB.state.tenant = tenants[0] ? tenants[0].id : '';
      const projects = this.accessibleProjects();
      if (!projects.some(p => p.id === DB.state.projectId)) DB.state.projectId = projects[0] ? projects[0].id : '';
    },

    refreshProjectSelector() {
      const select = document.getElementById('project-select');
      if (!select) return;
      const projects = this.accessibleProjects();
      select.hidden = !projects.length;
      select.innerHTML = projects.map(p => `<option value="${this.esc(p.id)}" ${p.id === DB.state.projectId ? 'selected' : ''}>${this.esc(p.title)}</option>`).join('');
      const tenantSelect = document.getElementById('tenant-select');
      if (tenantSelect && Array.prototype.some.call(tenantSelect.options, option => option.value === DB.state.tenant)) tenantSelect.value = DB.state.tenant;
    },

    esc(value) {
      return UI.esc(value);
    },

    /* ---------- 反馈与筛选 ---------- */
    toast(message, type, title) {
      const root = document.getElementById('toast-root');
      if (!root) return;
      const kind = type || 'success';
      const icons = { success: '✓', error: '!', warning: '!', info: 'ℹ' };
      const node = document.createElement('div');
      node.className = 'toast toast-' + kind;
      node.setAttribute('role', kind === 'error' ? 'alert' : 'status');
      node.innerHTML = `<span class="toast-icon" aria-hidden="true">${icons[kind] || '✓'}</span><div class="toast-body">${title ? `<b>${this.esc(title)}</b>` : ''}<span>${this.esc(message)}</span></div><button type="button" class="toast-close" data-action="toast:close" aria-label="关闭提示">×</button>`;
      while (root.children.length >= 3) root.removeChild(root.firstElementChild);
      root.appendChild(node);
      window.requestAnimationFrame(() => node.classList.add('is-in'));
      window.setTimeout(() => this.dismissToast(node), kind === 'error' ? 4200 : 3200);
    },

    dismissToast(node) {
      if (!node || !node.parentNode) return;
      node.classList.remove('is-in');
      node.classList.add('is-out');
      window.setTimeout(() => { if (node.parentNode) node.parentNode.removeChild(node); }, 200);
    },

    logAudit(action, target, result, type) {
      const now = new Date();
      const pad = v => String(v).padStart(2, '0');
      DB.audits.unshift({
        time: pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()),
        actor: this.identity().user,
        action: action,
        target: target,
        result: result || '成功',
        type: type || '项目'
      });
      if (DB.audits.length > 12) DB.audits.pop();
      this.save();
    },

    runAction(button, work, options) {
      if (button && button.disabled) return;
      const previous = button ? button.innerHTML : '';
      const opts = options || {};
      if (button) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.innerHTML = '<span class="button-spinner" aria-hidden="true"></span>' + (opts.loading || '处理中…');
      }
      const delay = opts.delay === undefined ? 260 : opts.delay;
      const start = () => window.setTimeout(() => {
        try {
          work();
        } catch (error) {
          console.error('[proto] 动作执行失败', error);
          this.toast(error && error.message ? error.message : '操作未能完成，请检查输入后重试', 'error');
        } finally {
          if (button && button.isConnected) {
            button.disabled = false;
            button.removeAttribute('aria-busy');
            button.innerHTML = previous;
          }
        }
      }, delay);
      window.requestAnimationFrame(start);
    },

    modal(title, body, submitLabel, action, options) {
      const overlay = document.getElementById('overlay-root');
      if (!overlay) return;
      const opts = options || {};
      overlay.innerHTML = `<div class="modal-backdrop" data-action="modal:backdrop"><section class="modal${opts.wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${this.esc(title)}"><header class="modal-head"><div><div class="modal-title">${this.esc(title)}</div>${opts.subtitle ? `<div class="modal-sub">${this.esc(opts.subtitle)}</div>` : ''}</div><button class="icon-btn" type="button" data-action="modal:close" aria-label="关闭">×</button></header><form id="modal-form" novalidate><div class="modal-body">${body}</div><footer class="modal-foot">${opts.hideCancel ? '' : `<button type="button" class="btn" data-action="modal:close">取消</button>`}<button type="submit" class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-submit-action="${this.esc(action || 'modal:close')}">${this.esc(submitLabel || '确认')}</button></footer></form></section></div>`;
      const first = overlay.querySelector('input:not([type=hidden]), textarea, select, button');
      if (first) first.focus();
    },

    drawer(title, body, options) {
      const overlay = document.getElementById('overlay-root');
      if (!overlay) return;
      const opts = options || {};
      overlay.innerHTML = `<div class="drawer-backdrop" data-action="drawer:backdrop"><aside class="drawer" role="dialog" aria-modal="true" aria-label="${this.esc(title)}"><header class="drawer-head"><div><div class="modal-title">${this.esc(title)}</div>${opts.subtitle ? `<div class="modal-sub">${this.esc(opts.subtitle)}</div>` : ''}</div><button class="icon-btn" type="button" data-action="overlay:close" aria-label="关闭">×</button></header><div class="drawer-body">${body}</div>${opts.footer ? `<footer class="drawer-foot">${opts.footer}</footer>` : ''}</aside></div>`;
      window.requestAnimationFrame(() => { const panel = overlay.querySelector('.drawer'); if (panel) panel.classList.add('is-in'); });
      const first = overlay.querySelector('button');
      if (first) first.focus();
    },

    confirm(title, message, label, work, options) {
      const opts = options || {};
      this.pendingConfirm = work;
      const details = opts.details && opts.details.length
        ? `<dl class="confirm-meta">${opts.details.map(item => `<div><dt>${this.esc(item.key)}</dt><dd>${this.esc(item.value)}</dd></div>`).join('')}</dl>`
        : '';
      this.modal(title, `<p class="prose">${this.esc(message)}</p>${details}${opts.note ? `<div class="notice ${opts.danger ? 'warn' : ''} section-gap">${this.esc(opts.note)}</div>` : ''}`, label, 'confirm:run', { danger: opts.danger, hideCancel: false });
    },

    closeOverlay() {
      this.pendingConfirm = null;
      const overlay = document.getElementById('overlay-root');
      if (overlay) overlay.innerHTML = '';
    },

    closeModal() { this.closeOverlay(); },

    /* ---------- 提交校验：必填、长度、数字范围、邮箱 ---------- */
    fieldWrapOf(field) { return field.closest('.field-wrap'); },

    setFieldError(field, message) {
      const wrap = this.fieldWrapOf(field);
      if (!wrap) return;
      wrap.classList.add('is-invalid');
      const slot = wrap.querySelector('.field-error');
      if (slot) { slot.textContent = message; slot.hidden = false; }
      field.setAttribute('aria-invalid', 'true');
    },

    clearFieldError(field) {
      const wrap = this.fieldWrapOf(field);
      if (!wrap) return;
      wrap.classList.remove('is-invalid');
      const slot = wrap.querySelector('.field-error');
      if (slot) { slot.textContent = ''; slot.hidden = true; }
      field.removeAttribute('aria-invalid');
    },

    validateField(field) {
      const wrap = this.fieldWrapOf(field);
      const label = wrap ? (wrap.querySelector('.field-label') || {}).textContent || '该字段' : '该字段';
      const custom = field.dataset.message || field.dataset.msg || '';
      const value = String(field.value || '').trim();
      if (field.required && !value) return custom || '请填写' + label.replace('*', '');
      if (value && field.minLength > 0 && value.length < field.minLength) return custom || label.replace('*', '') + '至少需要 ' + field.minLength + ' 个字符';
      if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return custom || '请输入有效的邮箱地址';
      if (value && field.type === 'number') {
        const num = Number(value);
        if (!Number.isFinite(num)) return custom || '请输入有效数字';
        if (field.min !== '' && Number(field.min) && num < Number(field.min)) return custom || '不能小于 ' + field.min;
        if (field.max !== '' && Number(field.max) && num > Number(field.max)) return custom || '不能大于 ' + field.max;
      }
      return '';
    },

    validateForm(form) {
      let firstBad = null;
      let count = 0;
      Array.from(form.querySelectorAll('.field')).forEach(field => {
        const message = this.validateField(field);
        if (message) {
          count += 1;
          this.setFieldError(field, message);
          if (!firstBad) firstBad = field;
        } else this.clearFieldError(field);
      });
      if (firstBad) {
        firstBad.focus();
        firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      if (count) this.toast('有 ' + count + ' 项输入需要修正，请检查标红字段', 'error', '提交未通过');
      return count === 0;
    },

    /* ---------- 文件导出（浏览器内生成，不连接服务端） ---------- */
    download(filename, content, type) {
      try {
        const blob = new Blob([content], { type: type || 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1200);
        this.toast('已生成并开始下载 ' + filename);
      } catch (error) {
        console.error('[proto] 导出失败', error);
        this.toast('当前环境不支持文件下载，已保留页面内数据', 'error');
      }
    },

    toCSV(headers, rows) {
      const cell = value => '"' + String(value === null || value === undefined ? '' : value).replace(/"/g, '""') + '"';
      return '\uFEFF' + [headers.map(cell).join(','), rows.map(row => row.map(cell).join(',')).join('\n')].join('\n');
    },

    /* 统一筛选：文本搜索 + 下拉条件组合，命中为空时展示空态行 */
    applyFilters(source) {
      const root = (source && source.closest('.card')) || document;
      const search = root.querySelector('[data-filter]');
      const query = search ? search.value.trim().toLowerCase() : '';
      const select = root.querySelector('[data-row-filter]');
      const key = select ? select.dataset.rowFilter : '';
      const value = select ? select.value : 'all';
      let visible = 0;
      root.querySelectorAll('[data-row]').forEach(row => {
        const textHit = !query || (row.dataset.search || '').toLowerCase().indexOf(query) > -1;
        const selectHit = !key || value === 'all' || row.dataset[key] === value;
        row.hidden = !(textHit && selectHit);
        if (!row.hidden) visible += 1;
      });
      const emptyRow = root.querySelector('[data-empty-row]');
      if (emptyRow) emptyRow.hidden = visible > 0;
    },

    /* ---------- 事件 ---------- */
    handleChange(event) {
      const target = event.target;

      if (target.id === 'tenant-select') {
        DB.state.tenant = target.value;
        this.syncContext();
        this.renderShell();
        this.renderRoute();
        this.save();
        this.toast('工作空间已切换，项目与列表已按授权范围刷新');
        return;
      }

      if (target.id === 'project-select') {
        DB.state.projectId = target.value;
        this.save();
        this.renderRoute();
        this.toast('当前项目已切换：' + this.projectName());
        return;
      }

      if (target.id === 'identity-select') {
        DB.state.identity = target.value;
        this.syncContext();
        this.renderShell();
        this.renderRoute();
        this.save();
        this.toast('演示身份已切换：' + (DB.roleNames[DB.state.identity] || '未知身份'));
        return;
      }

      if (target.matches('[data-project-field]')) {
        const project = this.project();
        if (project) { project[target.dataset.projectField] = target.value; this.save(); }
        return;
      }

      if (target.matches('[data-review-check]')) {
        const project = this.project();
        if (project) {
          const index = Number(target.dataset.reviewCheck);
          const list = project.reviewChecks || [];
          project.reviewChecks = target.checked ? Array.from(new Set(list.concat(index))) : list.filter(i => i !== index);
          this.save();
          const count = document.querySelector('[data-review-count]');
          const progress = document.querySelector('[data-review-progress]');
          const done = project.reviewChecks.length;
          const total = document.querySelectorAll('[data-review-check]').length || 9;
          if (count) count.innerHTML = UI.tag(done + ' / ' + total, done >= total ? 'green' : 'orange');
          if (progress) progress.textContent = done >= total ? '全部项目已确认' : '请逐项确认后再提交（已确认 ' + done + ' 项）';
        }
        return;
      }

      if (target.matches('[data-row-filter]')) this.applyFilters(target);
    },

    isArchivedProjectContext(targetId) {
      const route = this.current;
      if (!route) return false;
      if (!['project', 'script', 'assets', 'shoot', 'post', 'deliver', 'release'].includes(route.stage)) return false;
      if (targetId) {
        const target = DB.projects.find(p => p.id === targetId);
        if (target && !target.archived && target.status !== '已归档' && !target.terminated && target.status !== '已终止') return false;
      }
      const project = this.project();
      return !!project && (!!project.archived || project.status === '已归档' || !!project.terminated || project.status === '已终止');
    },

    projectFrozenMessage() {
      const project = this.project();
      return project && (project.terminated || project.status === '已终止')
        ? '项目已终止，仅支持查看与导出，不能继续生产或交付'
        : '项目已归档，仅支持查看与导出，请先恢复项目';
    },

    archivedActionAllowed(action) {
      if (['project:restore', 'project:new', 'project:create', 'project:export', 'confirm:run', 'tab', 'filter:clear', 'modal:close', 'overlay:close', 'toast:close', 'nav:toggle', 'nav:close', 'modal:backdrop', 'drawer:backdrop'].includes(action)) return true;
      return /^(script:download|script:versions|asset:view|asset:download|shot:view|post:view|review:preview|review:export|delivery:manifest|delivery:report|task:view|task:export|quality:report|overview:refresh|analytics:)/.test(action);
    },

    handleClick(event) {
      const groupToggle = event.target.closest('.nav-group-toggle');
      if (groupToggle) {
        this.toggleGroup(groupToggle.dataset.navGroup);
        return;
      }

      const trigger = event.target.closest('[data-action]');
      if (!trigger) return;
      const action = trigger.dataset.action;

      if (action.indexOf('go:') === 0) {
        this.go(action.slice(3));
        return;
      }

      if (this.isArchivedProjectContext(trigger.dataset.id) && !this.archivedActionAllowed(action)) {
        this.toast(this.projectFrozenMessage(), 'warning', '只读项目');
        return;
      }

      if (action === 'modal:close') this.closeModal();
      else if (action === 'overlay:close') this.closeOverlay();
      else if (action === 'toast:close') { const toast = trigger.closest('.toast'); this.dismissToast(toast); }
      else if (action === 'nav:toggle') this.toggleNav();
      else if (action === 'nav:close') this.setNav(false);
      else if (action === 'modal:backdrop') { if (event.target === trigger) this.closeModal(); }
      else if (action === 'drawer:backdrop') { if (event.target === trigger) this.closeOverlay(); }
      else if (action === 'project:new') this.newProject();
      else if (action === 'tenant:new') this.newTenant();
      else if (action === 'member:invite') this.inviteMember();
      else if (action === 'script:generate') this.runAction(trigger, () => this.generateScript(), { loading: 'AI 正在生成剧本…', delay: 900 });
      else if (action === 'production:start') this.confirm('启动生产计划', '启动后当前项目按阶段依赖自动展开生产任务，剧本审核未通过时不允许启动。', '启动生产', () => this.startProduction());
      else if (action === 'delivery:publish') {
        const project = this.project();
        this.confirm('生成交付包并归档', '归档会写入正式交付记录并冻结当前版本，属于不可逆操作。', '确认归档', () => this.publishDelivery(), project ? { details: [{ key: '项目', value: project.title }, { key: '集数', value: (project.done || 0) + ' / ' + project.episodes }, { key: '版本', value: 'V1' }] } : {});
      }
      else if (action === 'cross:revoke') this.confirm('撤销跨租户授权', '撤销后授权对象立即失去对应租户范围的访问能力，历史访问记录保留。', '确认撤销', () => this.revokeAuthorization(trigger.dataset.id));
      else if (action === 'asset:open') this.toast('资产详情为演示入口：版本、来源项目与租户归属可追溯');
      else if (action === 'tab') this.switchTab(trigger);
      else if (action === 'filter:clear') {
        const root = trigger.closest('.card') || document;
        const search = root.querySelector('[data-filter]');
        const select = root.querySelector('[data-row-filter]');
        if (search) search.value = '';
        if (select) select.value = 'all';
        this.applyFilters(trigger);
      } else if (this.actionHandlers[action]) this.actionHandlers[action](trigger, event);
      else console.warn('[proto] 未登记的操作', action);
    },

    onAction(name, handler) {
      if (typeof handler === 'function') this.actionHandlers[name] = handler;
    },

    onSubmit(name, handler) {
      if (typeof handler === 'function') this.submitHandlers[name] = handler;
    },

    switchTab(tab) {
      const scope = tab.closest('.card') || document;
      scope.querySelectorAll('.tab').forEach(item => {
        const active = item === tab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      scope.querySelectorAll('[data-tab-panel]').forEach(panel => { panel.hidden = panel.dataset.tabPanel !== tab.dataset.target; });
    },

    handleSubmit(event) {
      if (event.target.id !== 'modal-form') return;
      event.preventDefault();
      if (!this.validateForm(event.target)) return;
      const form = new FormData(event.target);
      const action = event.submitter ? event.submitter.dataset.submitAction : '';
      const submit = event.submitter;
      if (action !== 'confirm:run' && this.isArchivedProjectContext(action === 'project:update' ? this.editingProjectId : null) && !this.archivedActionAllowed(action)) {
        this.closeModal();
        this.toast(this.projectFrozenMessage(), 'warning', '只读项目');
        return;
      }
      if (submit) {
        submit.disabled = true;
        submit.setAttribute('aria-busy', 'true');
        submit.innerHTML = '<span class="button-spinner" aria-hidden="true"></span>提交中…';
      }
      window.requestAnimationFrame(() => {
        try {
          const done = this.processModalSubmit(form, action);
          if (done === false && submit && submit.isConnected) {
            submit.disabled = false;
            submit.removeAttribute('aria-busy');
            submit.textContent = '重试';
          }
        } catch (error) {
          console.error('[proto] 弹窗提交失败', error);
          this.toast(error && error.message ? error.message : '提交失败，请检查后重试', 'error');
          if (submit && submit.isConnected) {
            submit.disabled = false;
            submit.removeAttribute('aria-busy');
            submit.textContent = '重试';
          }
        }
      });
    },

    processModalSubmit(form, action) {
      if (action === 'confirm:run') {
        const work = this.pendingConfirm;
        this.pendingConfirm = null;
        this.closeModal();
        if (typeof work === 'function') work();
        return true;
      }

      const handler = this.submitHandlers[action];
      if (handler) {
        const result = handler(form, this);
        return result === undefined ? true : result;
      }

      if (action === 'project:create') {
        const title = String(form.get('title') || '').trim();
        if (!title) {
          this.toast('请填写项目名称', 'error');
          return false;
        }
        const episodes = Math.max(1, Number(form.get('episodes') || DB.runtime.config.defaultEpisodes || 12));
        const project = {
          id: 'SP-2604' + String(DB.projects.length + 1),
          title: title,
          genre: String(form.get('genre') || '都市 / 情感'),
          owner: this.identity().user,
          tenant: DB.state.tenant,
          episodes: episodes,
          done: 0,
          status: '草稿',
          updated: '刚刚',
          stage: '创意策划',
          projectType: '自制短剧',
          cost: 0,
          quality: 0,
          qualityState: '待检测',
          deliveredEpisodes: 0,
          shotCount: episodes * 8,
          coverAssets: 0,
          scriptVersion: 1,
          brief: String(form.get('brief') || ''),
          audience: '',
          visualStyle: '',
          duration: Math.max(1, Number(form.get('duration') || 2)),
          budget: Math.max(0, Number(form.get('budget') || 0)),
          priority: '普通',
          archived: false,
          createdAt: '刚刚',
          scriptApproved: false,
          productionStarted: false
        };
        DB.projects.unshift(project);
        DB.state.projectId = project.id;
        this.logAudit('创建创作项目', project.title + ' / ' + project.id);
        this.save();
        this.closeModal();
        this.renderShell();
        this.navigate('studio/brief');
        this.toast('项目「' + project.title + '」已创建，已进入创作需求', 'success', '创建成功');
        return true;
      }

      if (action === 'tenant:create') {
        const name = String(form.get('name') || '').trim();
        if (!name) {
          this.toast('请填写租户名称', 'error');
          return false;
        }
        const id = 'tn-' + Date.now();
        DB.tenants.unshift({
          id: id,
          name: name,
          code: 'NEW-' + String(DB.tenants.length + 1).padStart(2, '0'),
          owner: String(form.get('owner') || '待指定'),
          admin: String(form.get('owner') || '待指定'),
          unit: String(form.get('unit') || '待分配组织单元'),
          members: 0,
          projects: 0,
          budget: Number(form.get('budget') || 0),
          used: 0,
          quotaConcurrency: 3,
          quotaStorage: 240,
          status: '运行中'
        });
        const identity = this.identity();
        if (identity && identity.tenants && identity.tenants.indexOf(id) === -1) identity.tenants.push(id);
        DB.state.tenant = id;
        this.logAudit('创建内部租户空间', name);
        this.save();
        this.closeModal();
        this.renderShell();
        this.renderRoute();
        this.toast('内部租户空间「' + name + '」已创建并切换', 'success', '创建成功');
        return true;
      }

      if (action === 'member:invite') {
        const name = String(form.get('name') || '').trim();
        const email = String(form.get('email') || '').trim();
        if (!name || !email) {
          this.toast('请填写员工姓名和企业邮箱', 'error');
          return false;
        }
        DB.users.unshift({
          id: 'u' + Date.now(),
          name: name,
          email: email,
          role: String(form.get('role') || 'employee'),
          tenant: DB.state.tenant,
          tenants: [{ tenant: DB.state.tenant, role: String(form.get('role') || 'employee') }],
          status: '待邀请',
          projects: 0,
          delivered: 0,
          episodes: 0,
          completed: 0,
          access: '待邀请确认',
          cost: 0,
          joined: '—',
          lastActive: '—'
        });
        this.logAudit('邀请员工加入租户', name + ' / ' + email, '成功', '组织');
        this.save();
        this.closeModal();
        this.toast('已向 ' + name + ' 发送邀请，状态为待邀请', 'success', '邀请已发送');
        this.renderRoute();
        return true;
      }
    },

    /* ---------- 质量检查：十维独立检查对象，缺省时按项目生成 ---------- */
    ensureQualityChecks(project) {
      if (!Array.isArray(DB.qualityChecks)) DB.qualityChecks = [];
      const dims = ['剧本质量', '内容合规', '人物一致性', '场景一致性', '视频质量', '表演质量', '音频质量', '字幕质量', '剪辑质量', '成片质量'];
      let rows = DB.qualityChecks.filter(q => q.project === project.id);
      if (!rows.length) {
        rows = dims.map((dimension, index) => ({
          id: 'QC-' + project.id.replace('SP-', '') + '-' + String(index + 1).padStart(2, '0'),
          project: project.id,
          tenant: project.tenant,
          dimension: dimension,
          status: project.qualityState === '已通过' ? '通过' : '待检测',
          score: project.quality || 0,
          issues: 0,
          note: project.qualityState === '已通过' ? '历史质量记录已通过，未保留逐维明细' : '尚未执行该维度检查',
          target: '待定位',
          task: '—'
        }));
        DB.qualityChecks = DB.qualityChecks.concat(rows);
        this.save();
      }
      return dims.map(name => rows.find(row => row.dimension === name)).filter(Boolean);
    },

    qualitySummary(project) {
      const rows = this.ensureQualityChecks(project);
      const scored = rows.filter(row => row.score > 0);
      const pass = rows.filter(row => row.status === '通过').length;
      const warn = rows.filter(row => row.status === '警告').length;
      const fail = rows.filter(row => row.status === '不合格' || row.status === '返工中').length;
      const pending = rows.filter(row => row.status === '待检测').length;
      return {
        rows: rows,
        pass: pass, warn: warn, fail: fail, pending: pending,
        score: scored.length ? Math.round(scored.reduce((sum, row) => sum + row.score, 0) / scored.length) : 0
      };
    },

    recordReview(project, type, result, note, followup) {
      if (!Array.isArray(DB.reviews)) DB.reviews = [];
      const stamp = new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-');
      const version = type === '剧本审核' ? 'V' + (project.scriptVersion || 1) : 'V' + (project.scriptVersion || 1) + ' 成片';
      DB.reviews.unshift({
        id: 'RV-' + String(project.id).replace('SP-', '') + '-' + Date.now().toString().slice(-4),
        project: project.id,
        tenant: project.tenant,
        type: type,
        subject: project.title,
        version: version,
        reviewer: this.identity().user,
        time: stamp,
        result: result,
        note: note || '未填写',
        tasks: (DB.productionTasks || []).filter(t => t.project === project.id && t.status !== '已完成').map(t => t.id).join('、') || '—',
        followup: followup || '—'
      });
    },

    taskSummary(project) {
      const list = (DB.productionTasks || []).filter(t => t.project === project.id);
      return {
        total: list.length,
        running: list.filter(t => t.status === '执行中').length,
        failed: list.filter(t => t.status === '失败待重试').length,
        blocked: list.filter(t => t.status === '异常暂停').length,
        done: list.filter(t => t.status === '已完成').length,
        cost: list.reduce((sum, t) => sum + (t.cost || 0), 0),
        failedCost: list.reduce((sum, t) => sum + (t.failedCost || 0), 0),
        retries: list.reduce((sum, t) => sum + Math.max(0, (t.attempt || 0) - 1), 0)
      };
    },

    /* ---------- 镜头生产单元：按项目派生并在本地保留状态 ---------- */
    ensureShots(project) {
      if (!Array.isArray(DB.shots)) DB.shots = [];
      const limit = Math.min(12, project.shotCount || project.episodes * 8);
      let units = DB.shots.filter(s => s.project === project.id);
      if (!units.length) {
        const totalDone = Math.min(limit, Math.round(limit * (project.done || 0) / Math.max(project.episodes, 1)));
        units = Array.from({ length: limit }, (_, index) => ({
          id: 'SH-' + project.id.replace('SP-', '') + '-' + String(index + 1).padStart(3, '0'),
          project: project.id,
          tenant: project.tenant,
          no: index + 1,
          title: '镜头生产单元 ' + String(index + 1).padStart(2, '0'),
          prompt: '第 ' + (Math.floor(index / 8) + 1) + ' 集 · 场景 ' + (index % 8 + 1) + ' · 人物一致性参考已锁定',
          status: index < totalDone ? '已完成' : '待生成',
          duration: 2 + (index % 3),
          updated: '—'
        }));
        DB.shots = DB.shots.concat(units);
        this.save();
      }
      return units.sort((a, b) => a.no - b.no);
    },

    /* ---------- 弹窗表单 ---------- */
    newProject() {
      const tenant = this.tenantName();
      const genreOptions = [{ value: '', label: '请选择题材' }, { value: '都市 / 情感', label: '都市 / 情感' }, { value: '悬疑 / 反转', label: '悬疑 / 反转' }, { value: '古装 / 爱情', label: '古装 / 爱情' }, { value: '现实 / 成长', label: '现实 / 成长' }];
      this.modal('创建短剧项目', `<div class="form-grid">${UI.fField('项目名称', 'title', { required: true, placeholder: '填写暂定片名，后续可修改', minlength: 2, maxlength: 30, msg: '项目名称需 2–30 个字符' })}${UI.fSelect('题材方向', 'genre', genreOptions, { required: true, msg: '请选择题材方向' })}${UI.fField('计划集数', 'episodes', { value: String(DB.runtime.config.defaultEpisodes || 12), type: 'number', min: 1, max: 100, required: true, hint: '1–100 集，可在项目档案中调整' })}${UI.fField('单集时长（分钟）', 'duration', { value: '2', type: 'number', min: 1, max: 15, required: true })}${UI.fField('项目归属', 'tenantName', { value: tenant, readonly: true })}${UI.fField('计划预算（元）', 'budget', { value: String(DB.runtime.config.defaultProjectBudget || 30000), type: 'number', min: 1000, step: 1000 })}<label class="field-wrap full"><span class="field-label">创作目标<i class="req" aria-hidden="true">*</i></span><textarea class="field" name="brief" rows="4" required minlength="20" maxlength="500" data-msg="创作目标至少 20 个字符，便于后续生成剧本" placeholder="题材、核心冲突、受众、风格等"></textarea><span class="field-error" hidden></span><span class="field-hint">至少 20 字；提交后将进入创作需求页面。</span></label></div>`, '创建项目', 'project:create', { subtitle: '项目归属当前租户，创建后自动切换上下文' });
    },

    newTenant() {
      this.modal('新建内部租户空间', `<div class="notice">租户是企业内部组织与数据隔离单元，不是独立企业或 SaaS 客户。</div><div class="form-grid section-gap">${UI.fField('租户名称', 'name', { required: true, minlength: 2, maxlength: 30 })}${UI.fField('负责人', 'owner', { required: true })}${UI.fField('预算上限（元）', 'budget', { value: '30000', type: 'number', min: 1000, step: 1000, required: true })}</div>`, '创建租户', 'tenant:create');
    },

    inviteMember() {
      this.modal('邀请员工加入当前租户', `<div class="form-grid">${UI.fField('员工姓名', 'name', { required: true, minlength: 2, maxlength: 20 })}${UI.fField('企业邮箱', 'email', { type: 'email', required: true, placeholder: 'name@company.com', msg: '请输入有效的企业邮箱' })}${UI.fSelect('租户内角色', 'role', [{ value: 'employee', label: '普通员工' }, { value: 'tenant', label: '租户管理员' }, { value: 'auditor', label: '审计查看' }], { required: true })}</div>`, '加入邀请队列', 'member:invite', { subtitle: '邀请后状态为待邀请，需对方确认后生效' });
    },

    /* ---------- 业务动作（仅改内存态，不接真实服务） ---------- */
    generateScript() {
      const project = this.project();
      if (!project) { this.toast('请先创建或选择一个项目', 'error'); return; }
      if (project.scriptApproved) { this.toast('当前剧本已通过审核并锁定，如需修改请先退回', 'error'); return; }
      if (project.status === '待剧本审核') { this.toast('当前项目剧本已在待审核队列中', 'error'); return; }
      const briefField = document.querySelector('[data-project-field="brief"]');
      if (briefField) project.brief = briefField.value;
      if (String(project.brief || '').trim().length < 20) {
        if (briefField) { this.setFieldError(briefField, '创作需求至少 20 个字符'); briefField.focus(); }
        this.toast('请先补充至少 20 个字符的创作需求', 'error', '无法生成剧本');
        return;
      }
      if (!project.audience) { this.toast('请选择目标受众', 'error', '无法生成剧本'); const el = document.querySelector('[name="audience"]'); if (el) el.focus(); return; }
      if (!project.visualStyle) { this.toast('请选择视觉风格', 'error', '无法生成剧本'); const el = document.querySelector('[name="visualStyle"]'); if (el) el.focus(); return; }
      const nextVersion = (project.scriptVersion || 1) + 1;
      project.status = '待剧本审核';
      project.stage = '剧本审核';
      project.scriptVersion = nextVersion;
      project.updated = '刚刚';
      DB.scriptVersions.unshift({
        id: 'SV-' + project.id + '-' + nextVersion,
        project: project.id,
        tenant: project.tenant,
        version: nextVersion,
        status: '待审核',
        author: 'AI 编剧',
        createdAt: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-'),
        words: Math.max(6000, project.episodes * 1200),
        note: '按当前创作需求生成的新候选版本'
      });
      this.logAudit('触发 AI 剧本生成', project.title + ' / V' + nextVersion, '待处置', '项目');
      this.recordReview(project, '剧本审核', '待审核', 'V' + nextVersion + ' 已生成，等待人工确认', '待人工决策');
      this.toast('「' + project.title + '」V' + nextVersion + ' 剧本已生成，进入待审核', 'success', '生成完成');
      this.renderRoute();
    },

    approveScript() {
      const project = this.project();
      if (!project) { this.toast('没有可审核的当前项目', 'error'); return; }
      if (project.scriptApproved) { this.toast('当前剧本版本已确认，无需重复审核', 'error'); return; }
      const version = DB.scriptVersions.find(v => v.project === project.id && v.version === (project.scriptVersion || 1));
      if (version) version.status = '已通过';
      project.status = '生产准备中';
      project.stage = '导演分镜';
      project.scriptApproved = true;
      project.updated = '刚刚';
      this.recordReview(project, '剧本审核', '通过', project.scriptReviewNote || '确认故事方向、分集结构、人物设定与合规风险', '进入导演分镜与视觉规划');
      this.logAudit('确认正式剧本版本', project.title + ' / V' + (project.scriptVersion || 1));
      this.toast('「' + project.title + '」剧本 V' + (project.scriptVersion || 1) + ' 已锁定，流程进入视觉规划', 'success', '审核通过');
      this.renderRoute();
    },

    returnScript(reason) {
      const project = this.project();
      if (!project) { this.toast('没有可退回的当前项目', 'error'); return; }
      const version = DB.scriptVersions.find(v => v.project === project.id && v.version === (project.scriptVersion || 1));
      if (version) { version.status = '退回修改'; version.note = reason || version.note; }
      project.status = '创作中';
      project.stage = '剧本修改';
      project.scriptApproved = false;
      project.updated = '刚刚';
      this.recordReview(project, '剧本审核', '退回修改', reason || '剧本退回修改', '生成修订版本后重新提交审核');
      this.logAudit('退回剧本修改', project.title + ' / V' + (project.scriptVersion || 1), '待处置');
      this.toast('「' + project.title + '」剧本已退回修改', 'warning', '已退回');
      this.renderRoute();
    },

    startProduction() {
      const project = this.project();
      if (!project) { this.toast('请先选择项目', 'error'); return; }
      if (!project.scriptApproved) { this.toast('请先完成当前项目的剧本审核', 'error'); return; }
      if (project.productionStarted) { this.toast('当前项目的生产计划已在运行', 'error'); return; }
      project.productionStarted = true;
      project.status = '生产中';
      project.stage = '视频生产';
      this.logAudit('启动生产计划', project.title + ' / ' + project.id);
      this.toast('「' + project.title + '」生产计划已启动（演示状态），任务依赖已展开');
      this.renderRoute();
    },

    resolveException(strategy, note) {
      const project = this.project();
      if (!project || String(project.status).indexOf('异常') === -1) { this.toast('当前项目没有待处置的生产异常', 'error'); return; }
      project.exceptionResolved = true;
      project.status = '生产中';
      project.stage = '音频合成';
      project.updated = '刚刚';
      DB.postJobs.filter(j => j.project === project.id && j.status === '异常暂停').forEach(j => { j.status = '执行中'; j.updated = '刚刚'; });
      DB.schedule.filter(s => s.project === project.id && s.status === '已暂停').forEach(s => { s.status = '执行中'; });
      this.logAudit('异常恢复 · ' + (strategy || '切换备用能力'), project.title + ' / ' + (note || project.stage), '待处置', '生产');
      this.toast('「' + project.title + '」异常已恢复，受影响任务重新进入执行', 'success', '已恢复');
      this.renderRoute();
    },

    approveFinal() {
      const project = this.project();
      if (!project) { this.toast('没有可终审的当前项目', 'error'); return; }
      if (project.delivered) { this.toast('当前项目已完成交付归档', 'error'); return; }
      if (project.finalApproved) { this.toast('当前项目最终审核已通过', 'error'); return; }
      if ((project.done || 0) < project.episodes) { this.toast('当前项目尚有 ' + (project.episodes - (project.done || 0)) + ' 集未完成，不能进入最终审核', 'error'); return; }
      if (!Array.isArray(project.reviewChecks) || project.reviewChecks.length < 9) { this.toast('请先逐项确认最终审核清单', 'error', '清单未完成'); return; }
      project.finalApproved = true;
      project.status = '已完成';
      project.stage = '交付准备';
      project.qualityState = '已通过';
      project.updated = '刚刚';
      this.recordReview(project, '成片审核', '通过', project.finalReviewNote || '确认剧情、人物、画面、音频、字幕、集数与合规', '生成交付包并归档');
      this.logAudit('通过最终成片审核', project.title + ' / 全 ' + project.episodes + ' 集', '成功', '交付');
      this.save();
      this.toast('「' + project.title + '」最终成片审核通过，允许创建交付包', 'success', '审核通过');
      this.renderRoute();
    },

    publishDelivery() {
      const project = this.project();
      if (!project) { this.toast('请先选择项目', 'error'); return; }
      if (!project.finalApproved) { this.toast('请先完成当前项目的最终成片审核', 'error'); return; }
      if (project.delivered) { this.toast('当前项目已完成交付归档', 'error'); return; }
      project.delivered = true;
      project.deliveredEpisodes = project.episodes;
      project.status = '已完成';
      project.stage = '已归档';
      project.done = project.episodes;
      project.updated = '刚刚';
      const serial = 'DL-' + String(26030 + DB.deliveries.length + 1).slice(-5);
      DB.deliveries.unshift({
        id: serial, project: project.id, tenant: project.tenant,
        manifest: serial + '_交付包_V1', files: project.episodes + 9, size: '17.4 GB',
        status: '已归档', createdAt: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-'), operator: this.identity().user
      });
      this.logAudit('完成作品交付归档', project.title + ' / ' + serial, '成功', '交付');
      this.save();
      this.toast('「' + project.title + '」交付包已生成并归档，交付单 ' + serial, 'success', '归档完成');
      this.renderRoute();
    },

    revokeAuthorization(id) {
      const item = DB.crossAuthorizations.find(x => x.id === id);
      if (!item) { this.toast('未找到该授权记录', 'error'); return; }
      if (item.status !== '有效') { this.toast('该授权已处于不可撤销状态', 'error'); return; }
      item.status = '已撤销';
      this.logAudit('撤销跨租户授权', item.id + ' / ' + item.actor);
      this.toast('跨租户授权已撤销');
      this.renderRoute();
    }
  };

  return App;
})();

window.AppModule = { register: definition => window.App.register(definition) };

