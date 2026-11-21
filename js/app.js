/* =========================================================
   app.js — 앱 시작, 탭 이동, 상단 바
   ========================================================= */
(function () {
  'use strict';

  const ORDER = ['schedule', 'finance', 'card', 'memo', 'diary', 'dream'];

  const ICONS = {
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.2 13.4a7.6 7.6 0 0 0 0-2.8l1.7-1.3-1.9-3.3-2 .8a7.4 7.4 0 0 0-2.4-1.4L14.3 3h-3.8l-.3 2.4A7.4 7.4 0 0 0 7.8 6.8l-2-.8L3.9 9.3l1.7 1.3a7.6 7.6 0 0 0 0 2.8L3.9 14.7l1.9 3.3 2-.8a7.4 7.4 0 0 0 2.4 1.4l.3 2.4h3.8l.3-2.4a7.4 7.4 0 0 0 2.4-1.4l2 .8 1.9-3.3z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  const view = document.getElementById('view');
  const tabbar = document.getElementById('tabbar');
  const fab = document.getElementById('fab');
  const headTitle = document.getElementById('head-title');
  const headSub = document.getElementById('head-sub');
  const headAction = document.getElementById('head-action');
  const headTheme = document.getElementById('head-theme');

  let active = 'schedule';
  let lastTab = 'schedule';

  const FAB_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

  function hideFab() {
    fab.hidden = true;
    fab.onclick = null;
    fab.innerHTML = '';
  }

  function showFab(opts) {
    fab.innerHTML = FAB_ICON + '<span>' + (opts.label || '') + '</span>';
    fab.hidden = false;
    fab.setAttribute('aria-label', opts.label || '추가');
    fab.onclick = function () { if (typeof opts.onClick === 'function') opts.onClick(); };
  }

  function initialTab() {
    let pick = '';
    try {
      pick = new URLSearchParams(location.search).get('tab') || '';
      if (!pick && location.hash) pick = location.hash.replace('#', '');
      if (!pick) pick = localStorage.getItem('myDiaryApp.tab') || '';
    } catch (e) {}
    return (ORDER.indexOf(pick) >= 0 || pick === 'settings') ? pick : 'schedule';
  }

  function buildTabbar() {
    tabbar.innerHTML = ORDER.map(function (id) {
      const t = Tabs[id];
      if (!t) return '';
      return '<button type="button" class="tab ' + (id === active ? 'is-active' : '') + '" data-tab="' + id + '">' +
        '<span class="tab-icon">' + t.icon + '</span><span class="tab-label">' + t.label + '</span></button>';
    }).join('');
  }

  function renderTopbar() {
    const tab = Tabs[active];
    headTitle.textContent = (tab && (tab.title || tab.label)) || '다이어리';
    const inSettings = active === 'settings';
    headAction.innerHTML = inSettings ? ICONS.close : ICONS.gear;
    headAction.setAttribute('aria-label', inSettings ? '설정 닫기' : '설정');
  }

  function go(id) {
    if (!Tabs[id]) return;
    // 떠나기 전에 저장할 것이 있으면 먼저 저장합니다 (일기 자동 저장 등)
    if (Tabs[active] && typeof Tabs[active].onLeave === 'function' && active !== id) {
      try { Tabs[active].onLeave(); } catch (e) { console.warn(e); }
    }
    if (id === 'settings') {
      if (active !== 'settings' && ORDER.indexOf(active) >= 0) lastTab = active;
    }
    active = id;
    document.body.dataset.tab = id;
    if (ORDER.indexOf(id) >= 0) {
      try { localStorage.setItem('myDiaryApp.tab', id); } catch (e) {}
    }
    buildTabbar();
    renderTopbar();
    hideFab();

    view.classList.remove('is-entering');
    void view.offsetWidth;
    Tabs[id].render(view);
    view.classList.add('is-entering');

    window.scrollTo(0, 0);
    try {
      const url = location.pathname + '?tab=' + id;
      history.replaceState(null, '', url);
    } catch (e) {}
  }

  window.App = {
    go: go,
    get active() { return active; },
    setSubtitle: function (text) { headSub.textContent = text || ''; },
    showFab: showFab,
    hideFab: hideFab
  };

  tabbar.addEventListener('click', function (e) {
    const b = e.target.closest('[data-tab]');
    if (b) go(b.dataset.tab);
  });

  headAction.addEventListener('click', function () {
    if (active === 'settings') go(lastTab);
    else go('settings');
  });

  if (headTheme) {
    headTheme.addEventListener('click', function () {
      Theme.openSheet(function () { renderTopbarSafe(); });
    });
  }

  function renderTopbarSafe() {
    if (active === 'settings' && Tabs.settings && typeof Tabs.settings.refresh === 'function') {
      try { Tabs.settings.refresh(); } catch (e) {}
    }
  }

  window.addEventListener('pagehide', function () {
    if (Tabs[active] && typeof Tabs[active].onLeave === 'function') {
      try { Tabs[active].onLeave(); } catch (e) {}
    }
  });

  /* ---------- 첫 실행: 샘플 데이터 ---------- */
  try { Theme.init(); } catch (e) { console.warn(e); }

  try {
    const total = ORDER.reduce(function (a, id) { return a + Store.all(id).length; }, 0);
    if (!Store.state.settings.seeded && total === 0) {
      Store.seedSample();
    }
  } catch (e) { console.warn(e); }

  /* ---------- 시작 ---------- */
  active = initialTab();
  if (active === 'settings') lastTab = 'schedule';
  document.body.dataset.tab = active;
  buildTabbar();
  renderTopbar();
  hideFab();
  Tabs[active].render(view);

  /* ---------- 오프라인(PWA) ---------- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
