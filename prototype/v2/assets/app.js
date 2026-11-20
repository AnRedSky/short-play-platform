/* 长夜制作台 · shared shell + primitives */
(function () {
  'use strict';

  const ICONS = {
    grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
    check: '<path d="m5 12 5 5L20 6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    cpu: '<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
    wallet: '<path d="M4 7h16v12H4z"/><path d="M4 7V5h12v2M15 13h3"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.4 2.9-5 5.5-5s4.9 1.6 5.5 5M16 6.5c1.4.3 2.2 1.4 2.2 2.7 0 1.3-.8 2.3-2.2 2.6M17 14c2 .5 3.3 2 3.7 4.6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M18.5 5.5l-2 2M7.5 16.5l-2 2"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9Z"/><path d="M10 19h4"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrowRight: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    more: '<circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.5 6"/><path d="M20 5v6h-6"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
    alert: '<path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5M12 17h.01"/>',
    upload: '<path d="M12 19V6M7 11l5-5 5 5M5 4h14"/>',
    link: '<path d="M9 15l6-6M8 7H5a2 2 0 0 0 0 4H8M16 17h3a2 2 0 0 0 0-4h-3"/>',
    eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
    scissors: '<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="m8.5 8.5 11 9M8.5 15.5l11-9"/>',
    sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-2.2-.8-.8-2.2"/>',
    folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 5"/>',
    video: '<rect x="3" y="6" width="12" height="12" rx="1"/><path d="m15 10 6-3v10l-6-3"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    flag: '<path d="M5 21V4M5 4h13l-2 4 2 4H5"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>',
    dots: '<circle cx="12" cy="6" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="18" r="1"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 9.8 9.8Z"/>'
  };

  function icon(name) {
    const path = ICONS[name] || ICONS.dots;
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>';
  }

  function hydrateIcons(root) {
    (root || document).querySelectorAll('[data-i]').forEach(el => {
      el.innerHTML = icon(el.getAttribute('data-i'));
    });
  }

  const NAV = [
    { group: '项目', key: 'projects', label: '项目库', href: 'index.html', icon: 'folder' },
    { group: '项目', key: 'studio', label: '项目总览', href: 'studio.html', icon: 'film' },
    { group: '内容', key: 'episodes', label: '分集总览', href: 'episodes.html', icon: 'list' },
    { group: '内容', key: 'bible', label: '故事圣经', href: 'bible.html', icon: 'layers' },
    { group: '内容', key: 'assets', label: '资产库', href: 'assets.html', icon: 'image' },
    { group: '协作', key: 'tasks', label: '任务中心', href: 'tasks.html', icon: 'clock', count: '6' },
    { group: '协作', key: 'review', label: '审核队列', href: 'review.html', icon: 'check', count: '7' },
    { group: '配置', key: 'models', label: '模型接入', href: 'models.html', icon: 'cpu' },
    { group: '配置', key: 'usage', label: '成本用量', href: 'usage.html', icon: 'wallet' },
    { group: '配置', key: 'team', label: '团队设置', href: 'team.html', icon: 'users' }
  ];

  const TABS = [
    { key: 'studio', label: '本集制作', href: 'studio.html' },
    { key: 'script', label: '剧本', href: 'script.html' },
    { key: 'board', label: '分镜', href: 'board.html' },
    { key: 'voice', label: '配音', href: 'voice.html' },
    { key: 'timeline', label: '时间线', href: 'timeline.html' }
  ];

  const TABS_PAGES = { studio: 1, script: 1, board: 1, voice: 1, timeline: 1 };
  const PAGE_ALIAS = { index: 'projects', import: 'episodes', script: 'episodes', board: 'studio', voice: 'studio', timeline: 'studio' };

  function getTheme() {
    const fromDom = document.documentElement.getAttribute('data-theme');
    if (fromDom) return fromDom;
    try { return localStorage.getItem('sp_v2_theme') || 'dark'; } catch (e) { return 'dark'; }
  }

  function applyTheme(theme, persist) {
    const next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.setAttribute('data-color-mode', next);
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', next === 'light' ? '#f3efe6' : '#08090b');
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('data-i', next === 'light' ? 'moon' : 'sun');
      btn.setAttribute('title', next === 'light' ? '切换到暗色' : '切换到亮色');
      hydrateIcons(btn);
    }
    if (persist) {
      try { localStorage.setItem('sp_v2_theme', next); } catch (e) {}
    }
  }

  function railHTML(active) {
    const groups = [];
    NAV.forEach(n => {
      if (!groups.length || groups[groups.length - 1].name !== n.group) groups.push({ name: n.group, items: [] });
      groups[groups.length - 1].items.push(n);
    });
    return '<a class="rail-logo" href="index.html" title="长夜制作台">SP</a>' +
      '<nav class="rail-nav">' + groups.map(g =>
        '<div class="rail-group"><span class="rail-group-label">' + g.name + '</span>' +
        g.items.map(n =>
          '<a class="rail-link' + ((PAGE_ALIAS[active] || active) === n.key ? ' is-active' : '') + '" href="' + n.href + '" title="' + n.label + '">' +
          icon(n.icon) + '<span>' + n.label + '</span>' + (n.count ? '<i class="rail-count">' + n.count + '</i>' : '') + '</a>'
        ).join('') + '</div>'
      ).join('') + '</nav>' +
      '<div class="rail-spacer"></div>' +
      '<a class="icon-btn" href="team.html" data-i="settings" title="团队与设置" style="margin-bottom:10px"></a>' +
      '<a class="rail-user" href="team.html" title="团队设置">陈</a>';
  }

  function topbarHTML(opts) {
    return '<div class="crumb"><span>工作台</span><i>/</i><b>' + (opts.crumb || '制作台') + '</b></div>' +
      (opts.project === false ? '' :
        '<div class="project-pill">' +
          '<img class="cover" src="assets/img/hero-rain.jpg" alt="">' +
          '<b>长夜将明</b><span class="mono" style="font-size:9px;color:var(--dim)">NYJM-26</span>' +
          '<span class="ep">EP01</span>' +
        '</div>') +
      '<div class="topbar-spacer"></div>' +
      '<div class="budget-chip"><span>本月预算</span><b>¥6,204</b><span>/ 10,000</span></div>' +
      '<button class="icon-btn" id="theme-toggle" data-i="sun" title="切换到亮色"></button>' +
      '<button class="icon-btn" data-i="search" data-open="modal-search" title="快速查找"></button>' +
      '<a class="icon-btn" href="tasks.html" data-i="bell" title="任务与通知"></a>' +
      '<a class="avatar" href="team.html" title="团队设置">陈</a>';
  }

  function tabsHTML(active) {
    return '<span class="tabs-scope">单集工作区</span>' + TABS.map(t =>
      '<a class="tab' + (t.key === active ? ' is-active' : '') + '" href="' + t.href + '">' + t.label +
      (t.count ? '<span class="count">' + t.count + '</span>' : '') + '</a>'
    ).join('');
  }

  function installSearch() {
    if (document.getElementById('modal-search')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div class="modal search-modal" id="modal-search">' +
        '<div class="modal-head"><div><div class="eyebrow">QUICK JUMP</div><h2 style="margin:4px 0 0;font-size:18px">快速查找</h2></div>' +
        '<button class="icon-btn" data-close data-i="x" title="关闭"></button></div>' +
        '<div class="modal-body">' +
          '<input class="input search-input" id="global-search" placeholder="搜索页面、能力或集数，例如 故事圣经 / 审核 / EP03" autocomplete="off">' +
          '<div class="search-results" id="search-results"></div>' +
          '<div class="search-hint">Enter 打开第一个结果 · Esc 关闭</div>' +
        '</div>' +
      '</div>');
  }

  function renderSearch(query) {
    const q = String(query || '').trim().toLowerCase();
    const pool = [];
    NAV.forEach(n => pool.push({ label: n.label, meta: n.group, href: n.href }));
    TABS.forEach(t => pool.push({ label: t.label, meta: '单集工作区', href: t.href }));
    pool.push({ label: 'EP03 · 第三个名字', meta: '剧集', href: 'script.html?ep=03' });
    pool.push({ label: 'EP05 · 后巷的陌生人', meta: '剧集', href: 'script.html?ep=05' });
    pool.push({ label: '镜头批注与返工', meta: '审核', href: 'review.html' });
    pool.push({ label: '章节边界验收', meta: '改编', href: 'import.html' });
    const seen = {};
    const items = pool.filter(x => {
      if (!q || (x.label + ' ' + x.meta).toLowerCase().indexOf(q) > -1) {
        if (seen[x.label + x.href]) return false;
        seen[x.label + x.href] = 1;
        return true;
      }
      return false;
    }).slice(0, 9);
    const box = document.getElementById('search-results');
    if (!box) return;
    if (!items.length) {
      box.innerHTML = '<div class="empty-state" style="padding:24px 0">没有匹配的页面，试试“故事圣经”或“审核”。</div>';
      return;
    }
    box.innerHTML = items.map(x =>
      '<a class="search-row" href="' + x.href + '"><b>' + P.esc(x.label) + '</b><span>' + P.esc(x.meta) + '</span><i data-i="arrowRight"></i></a>'
    ).join('');
    hydrateIcons(box);
  }

  const P = {
    icon,
    hydrateIcons,
    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    time() {
      const d = new Date();
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
    },
    money(n) {
      return '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    toast(msg, ms) {
      let el = document.querySelector('.toast');
      if (!el) {
        el = document.createElement('div');
        el.className = 'toast';
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.classList.add('is-open');
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove('is-open'), ms || 2600);
    },
    openDrawer(id) {
      const d = document.getElementById(id);
      if (!d) return;
      P.closeModals();
      document.querySelectorAll('.drawer.is-open').forEach(x => x.classList.remove('is-open'));
      d.classList.add('is-open');
      const s = document.querySelector('.scrim');
      if (s) s.classList.add('is-open');
    },
    closeDrawers() {
      document.querySelectorAll('.drawer.is-open').forEach(x => x.classList.remove('is-open'));
      const s = document.querySelector('.scrim');
      if (s) s.classList.remove('is-open');
    },
    openModal(id) {
      const m = document.getElementById(id);
      if (!m) return;
      P.closeDrawers();
      m.classList.add('is-open');
      const s = document.querySelector('.scrim');
      if (s) s.classList.add('is-open');
      if (id === 'modal-search') setTimeout(function () {
        const input = document.getElementById('global-search');
        if (input) { input.focus(); input.select(); }
      }, 80);
    },
    closeModals() {
      document.querySelectorAll('.modal.is-open').forEach(x => x.classList.remove('is-open'));
      const s = document.querySelector('.scrim');
      if (s) s.classList.remove('is-open');
    },
    state() {
      try {
        const raw = localStorage.getItem('sp_v2_state');
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return {
        steps: {
          setup: { status: 'done' },
          script: { status: 'done' },
          assets: { status: 'done' },
          render: { status: 'pending' },
          voice: { status: 'locked' },
          qa: { status: 'locked' },
          export: { status: 'locked' }
        },
        current: 'render',
        renderRatio: '9:16 · 30fps',
        accepted: false,
        log: ['EP01 已载入 · 3 / 7 步完成']
      };
    },
    save(state) {
      try { localStorage.setItem('sp_v2_state', JSON.stringify(state)); } catch (e) {}
    },
    reset() {
      try { localStorage.removeItem('sp_v2_state'); } catch (e) {}
    },
    download(name, text, type) {
      const blob = new Blob([text], { type: type || 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 400);
    }
  };
  window.P = P;
  window.hydrateIcons = hydrateIcons;
  if (location.search.indexOf('debug') > -1) window.onerror = function (m, s, l) { document.title = 'ERR ' + m + ' @' + l; };

  document.addEventListener('DOMContentLoaded', function () {
    const body = document.body;
    const page = body.getAttribute('data-page') || '';
    const rail = document.getElementById('rail');
    const topbar = document.getElementById('topbar');
    const tabs = document.getElementById('tabs');
    if (rail) rail.innerHTML = railHTML(page);
    if (topbar) topbar.innerHTML = topbarHTML({ crumb: body.getAttribute('data-crumb') || '制作台', project: body.getAttribute('data-project') !== 'none' });
    if (tabs) { tabs.innerHTML = TABS_PAGES[page] ? tabsHTML(page) : ''; tabs.style.display = TABS_PAGES[page] ? '' : 'none'; }
    const forcedTheme = (location.search.match(/[?&]theme=(light|dark)/) || [])[1];
    applyTheme(forcedTheme || getTheme(), !!forcedTheme);
    installSearch();
    renderSearch('');
    hydrateIcons();

    window.addEventListener('storage', function (e) {
      if (e.key === 'sp_v2_theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        applyTheme(e.newValue, false);
      }
    });

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        const next = getTheme() === 'light' ? 'dark' : 'light';
        applyTheme(next, true);
        try { localStorage.setItem('sp_v2_theme', next); } catch (e) {}
        P.toast(next === 'light' ? '已切换到亮色模式' : '已切换到暗色模式');
      });
    }

    const searchInput = document.getElementById('global-search');
    if (searchInput) {
      searchInput.addEventListener('input', function () { renderSearch(this.value); });
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          const first = document.querySelector('#search-results .search-row');
          if (first) { e.preventDefault(); location.href = first.getAttribute('href'); }
        }
      });
    }

    const scrim = document.querySelector('.scrim');
    if (scrim) {
      scrim.addEventListener('click', function () {
        P.closeDrawers();
        P.closeModals();
      });
    }
    document.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', function () {
        P.closeDrawers();
        P.closeModals();
      });
    });
    document.addEventListener('click', e => {
      const opener = e.target.closest('[data-open]');
      if (!opener) return;
      const id = opener.getAttribute('data-open');
      const target = document.getElementById(id);
      if (!target) return;
      if (target.classList.contains('drawer')) P.openDrawer(id);
      else if (target.classList.contains('modal')) P.openModal(id);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { P.closeDrawers(); P.closeModals(); }
    });
    if (location.hash === '#search') setTimeout(function () { P.openModal('modal-search'); }, 0);
  });
})();
