/* =========================================================
   tabs/schedule.js — 일정
   · 다이어리 : 종이 다이어리 한 장씩 넘기는 줄노트 뷰 (기본)
   · 달력    : 월간 캘린더 + 날짜별 할 일
   ========================================================= */
(function () {
  'use strict';
  const T = (window.Tabs = window.Tabs || {});
  const pad = function (n) { return String(n).padStart(2, '0'); };

  const ICON = {
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.9l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.6"/><path d="M16 16l4.2 4.2"/></svg>'
  };

  const LINE = 30;      // 줄노트 한 줄 높이(px)
  const MIN_LINES = 8;  // 노트 영역 최소 줄 수

  let host = null;
  let ym = UI.ymOf(UI.todayISO());
  let selected = UI.todayISO();
  let mode = (function () {
    try { return localStorage.getItem('myDiaryApp.scheduleMode') || 'paper'; } catch (e) { return 'paper'; }
  })();
  let saveTimer = null;
  let turning = false;
  let query = '';                 // 검색어
  let resizeTimer = null;
  let lastWidth = window.innerWidth;  // 마지막으로 확인한 창 너비

  /* ---------- 달력 막대 색 ---------- */
  // 일정 제목에 자주 쓰는 낱말이 있으면 그 계열 색으로, 없으면 제목마다 늘 같은 색으로 보여 줍니다.
  const PALETTE = {
    rose:   { bg: '#FEAAC1', fg: '#7A0522' },
    coral:  { bg: '#FDC2AA', fg: '#7C2303' },
    blue:   { bg: '#A7CBFB', fg: '#033277' },
    green:  { bg: '#A3F0C0', fg: '#04672F' },
    purple: { bg: '#D3B6F6', fg: '#3A0773' },
    teal:   { bg: '#9FF4F3', fg: '#01656A' },
    gold:   { bg: '#FDDE9B', fg: '#7A4B00' },
    gray:   { bg: '#DDD6D0', fg: '#574533' }
  };
  const PALETTE_ORDER = ['rose', 'coral', 'blue', 'green', 'purple', 'teal', 'gold', 'gray'];
  const COLOR_RULES = [
    { re: /(생리|생리통|생리시작|PMS)/i, c: 'rose' },
    { re: /(병원|치과|의원|한의원|약국|약\b|검진|혈압|접종|진료|처방|주사|임플란트|스케일링|건강)/, c: 'coral' },
    { re: /(카드|실적|결제|은행|이자|포인트|급여|연금|보험|세금|납부|지로|대출|청구|환전|적립|페이)/i, c: 'blue' },
    { re: /(장보기|마트|수퍼|슈퍼|구매|주문|배송|택배|통관|장바구니|시장)/, c: 'green' },
    { re: /(학교|학원|교육|대회|시험|숙제|선생님|상담|과제|입학)/, c: 'purple' },
    { re: /(여행|항공|비행기|비자|거주증|대사관|영사관|이사|호텔)/, c: 'teal' },
    { re: /(생일|기념일|명절|추석|설날|크리스마스|파티|선물|축하)/, c: 'gold' }
  ];
  const FALLBACK = ['blue', 'green', 'purple', 'gold', 'teal', 'gray'];

  function hashOf(str) {
    let h = 2166136261 >>> 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function hexFg(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return '#3B3026';
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return L > 0.62 ? '#3B3026' : '#FFFFFF';
  }

  // 일정 하나의 색 { bg, fg, key }
  function colorOf(it) {
    const own = it && it.color ? String(it.color) : '';
    if (own && PALETTE[own]) return Object.assign({ key: own }, PALETTE[own]);
    if (/^#[0-9a-f]{6}$/i.test(own)) return { key: 'custom', bg: own, fg: hexFg(own) };
    const text = String(it && it.text || '');
    for (let i = 0; i < COLOR_RULES.length; i++) {
      if (COLOR_RULES[i].re.test(text)) return Object.assign({ key: COLOR_RULES[i].c }, PALETTE[COLOR_RULES[i].c]);
    }
    const key = FALLBACK[hashOf(text) % FALLBACK.length];
    return Object.assign({ key: key }, PALETTE[key]);
  }

  function colorVars(it) {
    const c = colorOf(it);
    return '--cb:' + c.bg + ';--cf:' + c.fg;
  }

  /* ---------- 막대/점 보기 ---------- */
  let chipMode = (function () {
    try { return localStorage.getItem('myDiaryApp.calView') === 'dot' ? 'dot' : 'bar'; } catch (e) { return 'bar'; }
  })();

  function chipsPerDay() {
    const w = window.innerWidth || 390;
    if (w >= 768) return 6;
    if (w >= 600) return 5;
    if (w >= 400) return 4;
    return 3;
  }

  function setChipMode(m) {
    chipMode = m === 'dot' ? 'dot' : 'bar';
    try { localStorage.setItem('myDiaryApp.calView', chipMode); } catch (e) {}
    render();
  }

  /* ---------- 공통 ---------- */
  function itemsOf(date) {
    return Store.all('schedule').filter(function (x) { return x.date === date; });
  }

  function sortItems(list) {
    return list.slice().sort(function (a, b) {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      if (!!a.star !== !!b.star) return a.star ? -1 : 1;
      const ta = String(a.time || ''), tb = String(b.time || '');
      if (ta !== tb) { if (!ta) return 1; if (!tb) return -1; return ta.localeCompare(tb, 'ko'); }
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
  }

  function setMode(m) {
    if (mode === m) return;
    pinNote();
    mode = m;
    query = '';
    try { localStorage.setItem('myDiaryApp.scheduleMode', m); } catch (e) {}
    render();
    window.scrollTo(0, 0);
  }

  function searchHTML() {
    const q = query;
    return '' +
      '<form class="searchbar" id="sched-search" autocomplete="off" role="search">' +
        '<span class="sb-icon" aria-hidden="true">' + ICON.search + '</span>' +
        '<input id="sched-q" type="text" inputmode="search" enterkeyhint="search" ' +
          'placeholder="일정·다이어리·메모 검색 (예: 생리, 치과)" aria-label="일정·다이어리·메모 검색" ' +
          'value="' + UI.esc(q) + '">' +
        '<button type="button" class="sb-clear" id="sb-clear" aria-label="검색 지우기"' + (q ? '' : ' hidden') + '>✕</button>' +
      '</form>' +
      '<div class="search-panel" id="search-panel"' + (q ? '' : ' hidden') + '></div>';
  }

  function modeSwitchHTML() {
    return '<div class="seg seg-top">' +
      '<button type="button" data-mode="paper" class="' + (mode === 'paper' ? 'is-on' : '') + '">📖 다이어리</button>' +
      '<button type="button" data-mode="calendar" class="' + (mode === 'calendar' ? 'is-on' : '') + '">📅 달력</button>' +
    '</div>';
  }

  /* ---------- 종이 다이어리 ---------- */
  function paperHTML() {
    const date = selected;
    const today = UI.todayISO();
    const page = Store.pageOf(date);
    const body = page ? (page.body || '') : '';
    const todos = sortItems(itemsOf(date));
    const week = UI.isoWeek(date);
    const d = UI.parseISO(date);
    const rel = date === today ? '오늘' : (date === UI.isoAdd(today, 1) ? '내일' : (date === UI.isoAdd(today, -1) ? '어제' : ''));

    const rows = todos.map(function (it) {
      return '<div class="pp-row' + (it.done ? ' is-done' : '') + '" data-id="' + it.id + '">' +
        '<button type="button" class="pp-dot" data-act="toggle" aria-label="완료 표시" aria-pressed="' + (it.done ? 'true' : 'false') + '">' +
          '<span class="dot-mark">•</span><span class="check-mark">✓</span>' +
        '</button>' +
        '<button type="button" class="pp-txt" data-act="edit">' +
          '<span class="pp-label">' + UI.esc(it.text) + '</span>' +
          (it.star ? ' <span class="pp-star">★</span>' : '') +
          (it.time ? ' <span class="pp-time">' + UI.esc(it.time) + '</span>' : '') +
        '</button>' +
      '</div>';
    }).join('');

    return '' +
      '<div class="pp-slot" id="pp-slot">' +
        '<div class="pp" id="pp">' +
          '<div class="pp-tape"></div>' +
          '<div class="pp-head">' +
            '<div class="pp-head-top">' +
              '<span class="pp-year">' + d.getFullYear() + '</span>' +
              '<span class="pp-week">WEEK ' + week + '</span>' +
            '</div>' +
            '<div class="pp-date">' +
              '<span class="pp-dow">' + UI.enDow(date) + '</span>' +
              '<div class="pp-date-main">' +
                '<span class="pp-mon">' + UI.enMon(date) + '</span>' +
                '<span class="pp-day">' + d.getDate() + '</span>' +
              '</div>' +
            '</div>' +
            (rel ? '<span class="pp-rel">' + rel + '</span>' : '') +
          '</div>' +
          '<div class="pp-body">' +
            '<textarea class="pp-note" id="pp-note" spellcheck="false" rows="' + MIN_LINES + '" ' +
              'placeholder="오늘 있었던 일, 기억해 둘 것…" aria-label="' + UI.koDateFull(date) + ' 메모">' + UI.esc(body) + '</textarea>' +
          '</div>' +
          '<div class="pp-todo">' +
            '<div class="pp-todo-label">TO DO:</div>' +
            (rows || '<div class="pp-todo-empty">아직 할 일이 없어요. 아래 줄에 적어 보세요.</div>') +
            '<form class="pp-add" id="pp-add" autocomplete="off">' +
              '<span class="pp-dot is-add"><span class="dot-mark">•</span></span>' +
              '<input type="text" name="text" maxlength="200" placeholder="할 일 적기" enterkeyhint="done" aria-label="할 일 추가">' +
            '</form>' +
          '</div>' +
          '<div class="pp-foot">' +
            '<span>' + d.getFullYear() + '. ' + pad(d.getMonth() + 1) + '.</span>' +
            '<span class="pp-foot-mid">' + UI.WEEK[d.getDay()] + '요일</span>' +
            '<span>' + pad(d.getDate()) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pp-nav">' +
        '<button type="button" data-step="-1" aria-label="이전 날">◀ 이전 날</button>' +
        '<button type="button" data-step="today" class="pp-today">오늘</button>' +
        '<button type="button" data-step="1" aria-label="다음 날">다음 날 ▶</button>' +
      '</div>' +
      '<p class="pp-hint">좌우로 넘겨도 하루씩 넘어가요 · 적으면 바로 저장돼요</p>';
  }

  function fitNote() {
    const el = host && host.querySelector('#pp-note');
    if (!el) return;
    el.style.height = 'auto';
    const lines = Math.max(MIN_LINES, Math.ceil((el.scrollHeight - 2) / LINE));
    el.style.height = (lines * LINE) + 'px';
  }

  function pinNote() {
    const el = host && host.querySelector('#pp-note');
    if (!el) return;
    clearTimeout(saveTimer);
    const page = Store.pageOf(selected);
    if (!page && !el.value.trim()) return;
    if (page && page.body === el.value) return;
    Store.savePage(selected, el.value);
  }

  function go(step) {
    if (turning) return;
    pinNote();
    let dir, next;
    if (step === 'today') {
      const t = UI.todayISO();
      if (selected === t) { UI.toast('오늘 페이지예요'); return; }
      dir = UI.parseISO(t) > UI.parseISO(selected) ? 1 : -1;
      next = t;
    } else {
      dir = Number(step);
      next = UI.isoAdd(selected, dir);
    }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const paper = host && host.querySelector('.pp');

    if (!paper || reduce) { selected = next; render(); return; }

    turning = true;
    paper.classList.add(dir > 0 ? 'pp-out-next' : 'pp-out-prev');
    setTimeout(function () {
      selected = next;
      render();
      const p2 = host.querySelector('.pp');
      if (p2) p2.classList.add(dir > 0 ? 'pp-in-next' : 'pp-in-prev');
      setTimeout(function () { turning = false; }, 60);
    }, 165);
  }

  function bindPaper() {
    const note = host.querySelector('#pp-note');
    if (note) {
      fitNote();
      note.addEventListener('input', function () {
        fitNote();
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
          Store.savePage(selected, note.value);
        }, 400);
      });
      note.addEventListener('blur', pinNote);
    }

    host.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () { go(b.dataset.step); });
    });

    const slot = host.querySelector('#pp-slot');
    if (slot) {
      let sx = 0, sy = 0, tracking = false, moved = false;
      slot.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        sx = e.touches[0].clientX; sy = e.touches[0].clientY;
        tracking = true; moved = false;
      }, { passive: true });
      slot.addEventListener('touchmove', function (e) {
        if (!tracking) return;
        const dx = e.touches[0].clientX - sx;
        const dy = e.touches[0].clientY - sy;
        if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          moved = true;
          if (e.cancelable) e.preventDefault();
        }
      }, { passive: false });
      slot.addEventListener('touchend', function (e) {
        if (!tracking) return;
        tracking = false;
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - sx;
        const dy = t.clientY - sy;
        if (moved && Math.abs(dx) > 54 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          go(dx < 0 ? 1 : -1);
        }
      });
    }

    const add = host.querySelector('#pp-add');
    if (add) {
      add.addEventListener('submit', function (e) {
        e.preventDefault();
        const input = add.querySelector('input[name="text"]');
        const text = input.value.trim();
        if (!text) { input.focus(); return; }
        Store.add('schedule', { date: selected, text: text, done: false, star: false, time: '' });
        input.value = '';
        render();
      });
    }

    host.querySelectorAll('.pp-row').forEach(function (row) {
      row.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const id = row.dataset.id;
        const item = Store.find('schedule', id);
        if (!item) return;
        if (btn.dataset.act === 'toggle') {
          Store.update('schedule', id, { done: !item.done });
          render();
        } else {
          openEditor(item);
        }
      });
    });

    if (window.App && App.setSubtitle) {
      const n = itemsOf(selected).filter(function (x) { return !x.done; }).length;
      const hasNote = !!(Store.pageOf(selected) && String(Store.pageOf(selected).body || '').trim());
      App.setSubtitle(UI.koDateFull(selected) + (n ? ' · 할 일 ' + n + '개' : '') + (hasNote ? ' · 메모 있음' : ''));
    }
  }

  /* ---------- 달력 ---------- */
  function calendarHTML() {
    const p = ym.split('-').map(Number);
    const y = p[0], m = p[1];
    const firstDown = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate();
    const today = UI.todayISO();

    const bar = chipMode === 'bar';
    const maxChips = chipsPerDay();

    let cells = '';
    for (let i = 0; i < firstDown; i++) cells += '<div class="cal-cell empty"></div>';
    for (let d = 1; d <= days; d++) {
      const date = y + '-' + pad(m) + '-' + pad(d);
      const list = itemsOf(date);
      const undone = list.filter(function (x) { return !x.done; }).length;
      const starred = list.some(function (x) { return x.star; });
      const note = Store.pageOf(date);
      const hasNote = !!(note && String(note.body || '').trim());
      const cls = ['cal-cell'];
      if (date === today) cls.push('is-today');
      if (date === selected) cls.push('is-sel');

      let inner = '<span class="num">' + d + '</span>';
      if (bar) {
        cls.push('with-chips');
        const sorted = sortItems(list);
        const shown = sorted.slice(0, maxChips);
        const rest = sorted.length - shown.length;
        inner += '<span class="chips">' + shown.map(function (it) {
          const label = String(it.text || '').trim() || '(제목 없음)';
          return '<span class="cal-chip' + (it.done ? ' is-done' : '') + '" style="' + colorVars(it) + '" ' +
            'title="' + UI.esc((it.time ? it.time + ' · ' : '') + label) + '">' + UI.esc(label) + '</span>';
        }).join('') +
          (rest > 0 ? '<span class="cal-more" title="이 날 일정 모두 보기">+' + rest + '</span>' : '') +
          (hasNote ? '<span class="note-dot" aria-hidden="true"></span>' : '') +
        '</span>';
      } else {
        let dots = '';
        if (list.length) {
          dots = (starred ? '<i class="star"></i>' : '') + '<i class="' + (undone ? '' : 'done') + '"></i>';
        }
        if (hasNote) dots += '<i class="note"></i>';
        inner += '<span class="dots">' + dots + '</span>';
      }

      const aria = UI.koDate(date) + (list.length ? ' · 일정 ' + list.length + '개' : ' · 일정 없음') +
        (hasNote ? ' · 메모 있음' : '');
      cells += '<button type="button" class="' + cls.join(' ') + '" data-date="' + date + '" aria-label="' + UI.esc(aria) + '">' +
        inner + '</button>';
    }

    return '' +
      '<section class="cal">' +
        '<div class="cal-head">' +
          '<div class="cal-title">' + UI.koMonth(ym) + '</div>' +
          '<div class="cal-nav">' +
            '<div class="cal-view-seg" role="group" aria-label="달력 보기 방식">' +
              '<button type="button" data-calview="bar" class="' + (chipMode === 'bar' ? 'is-on' : '') + '" aria-label="막대 보기" aria-pressed="' + (chipMode === 'bar') + '">▤</button>' +
              '<button type="button" data-calview="dot" class="' + (chipMode === 'dot' ? 'is-on' : '') + '" aria-label="점 보기" aria-pressed="' + (chipMode === 'dot') + '">•••</button>' +
            '</div>' +
            '<button type="button" data-nav="-1" aria-label="이전 달">' + ICON.left + '</button>' +
            '<button type="button" data-nav="1" aria-label="다음 달">' + ICON.right + '</button>' +
            '<button type="button" class="today-btn" data-nav="today">오늘</button>' +
          '</div>' +
        '</div>' +
        '<div class="cal-grid">' +
          ['일', '월', '화', '수', '목', '금', '토'].map(function (w, i) {
            return '<div class="cal-dow ' + (i === 0 ? 'sun' : i === 6 ? 'sat' : '') + '">' + w + '</div>';
          }).join('') +
          cells +
        '</div>' +
      '</section>';
  }

  function sampleBanner() {
    const n = Store.sampleCount();
    if (!n) return '';
    return '<div class="sample-note"><span>예시 데이터예요. 지우고 직접 쓰셔도 돼요.</span>' +
      '<button type="button" data-act="clear-sample">샘플 지우기</button></div>';
  }

  function taskHTML(it) {
    const meta = [];
    if (it.time) meta.push('<span class="chip-time">' + UI.esc(it.time) + '</span>');
    if (it.star) meta.push('<span>중요</span>');
    return '' +
      '<div class="task has-accent ' + (it.done ? 'is-done ' : '') + (it.star ? 'is-important' : '') + '" data-id="' + it.id + '" style="' + colorVars(it) + '">' +
        '<i class="task-accent" aria-hidden="true"></i>' +
        '<button type="button" class="check" data-act="toggle" aria-label="완료 표시" aria-pressed="' + (it.done ? 'true' : 'false') + '">' + ICON.check + '</button>' +
        '<button type="button" class="task-main" data-act="edit">' +
          '<span class="task-text">' + UI.esc(it.text) + '</span>' +
          (meta.length ? '<span class="task-meta">' + meta.join('') + '</span>' : '') +
        '</button>' +
        '<button type="button" class="star ' + (it.star ? 'is-on' : '') + '" data-act="star" aria-label="중요 표시">' + ICON.star + '</button>' +
      '</div>';
  }

  function calendarViewHTML() {
    const today = UI.todayISO();
    const list = sortItems(itemsOf(selected));
    const done = list.filter(function (x) { return x.done; }).length;
    const rel = selected === today ? '오늘' : (selected === UI.isoAdd(today, 1) ? '내일' : (selected === UI.isoAdd(today, -1) ? '어제' : ''));

    return '' +
      calendarHTML() +
      '<div class="day-head">' +
        '<h2>' + UI.koDate(selected) + (rel ? '<span>' + rel + '</span>' : '') + '</h2>' +
        (list.length ? '<div class="progress">' + done + '/' + list.length + ' 완료</div>' : '') +
      '</div>' +
      '<form class="quick-add" id="quick-add" autocomplete="off">' +
        '<input name="text" type="text" placeholder="할 일을 적어 두세요" enterkeyhint="done" maxlength="200" aria-label="할 일 입력">' +
        '<button type="submit" aria-label="추가">' + ICON.plus + '</button>' +
      '</form>' +
      '<div class="tasks" id="task-list">' +
        (list.length ? list.map(taskHTML).join('') :
          '<div class="empty"><span class="emo">🗓️</span>이 날의 할 일이 아직 없어요.<br>위에 적고 ＋를 눌러 보세요.</div>') +
      '</div>';
  }

  /* ---------- 그리기 ---------- */
  function render() {
    if (!host) return;
    const today = UI.todayISO();
    let main = '';
    if (mode === 'paper') {
      ym = UI.ymOf(selected);
      main = paperHTML();
    } else {
      main = sampleBanner() + calendarViewHTML();
    }
    host.innerHTML = modeSwitchHTML() + searchHTML() + '<div class="sched-main" id="sched-main">' + main + '</div>';

    if (mode === 'paper') {
      bindPaper();
    } else {
      const list = sortItems(itemsOf(selected));
      const todayCount = itemsOf(today).filter(function (x) { return !x.done; }).length;
      if (window.App && App.setSubtitle) {
        App.setSubtitle(UI.koDateFull(today) + ' · 오늘 할 일 ' + todayCount + '개');
      }
      bindCalendar(list);
    }

    host.querySelectorAll('[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.dataset.mode); });
    });

    bindSearch();
  }

  /* ---------- 검색 ---------- */
  function norm(s) { return String(s == null ? '' : s).toLowerCase(); }

  function isoOfTs(ts) {
    const s = String(ts || '');
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : UI.todayISO();
  }

  function excerpt(text, needle, len) {
    const flat = String(text || '').replace(/\s+/g, ' ').trim();
    const i = flat.toLowerCase().indexOf(needle.toLowerCase());
    const max = len || 60;
    if (i < 0 || flat.length <= max) return flat.slice(0, max + 20) + (flat.length > max + 20 ? '…' : '');
    const start = Math.max(0, i - Math.floor((max - needle.length) / 2));
    return (start > 0 ? '…' : '') + flat.slice(start, start + max) + (start + max < flat.length ? '…' : '');
  }

  function highlight(text, needle) {
    const safe = UI.esc(text);
    const n = UI.esc(needle);
    if (!n) return safe;
    const re = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return safe.replace(re, function (m) { return '<mark>' + m + '</mark>'; });
  }

  function searchAll(q) {
    const needle = norm(q).trim();
    const rows = [];
    let lockedN = 0;

    Store.all('schedule').forEach(function (it) {
      if ((norm(it.text) + ' ' + norm(it.time) + ' ' + norm(it.memo)).indexOf(needle) >= 0) {
        rows.push({ kind: 'schedule', id: it.id, date: it.date, text: it.text || '', time: it.time || '', item: it, ts: norm(it.createdAt) });
      }
    });

    Store.all('page').forEach(function (p) {
      if (norm(p.body).indexOf(needle) >= 0) {
        rows.push({ kind: 'page', id: p.id, date: p.date, text: p.body || '', time: '', item: p, ts: norm(p.updatedAt) });
      }
    });

    const diaryLocked = !!(window.DiaryLock && DiaryLock.isLocked());
    Store.all('diary').forEach(function (d) {
      if ((norm(d.title) + ' ' + norm(d.body)).indexOf(needle) >= 0) {
        if (diaryLocked) { lockedN++; return; }
        rows.push({ kind: 'diary', id: d.id, date: d.date, text: (d.title ? d.title + ' · ' : '') + (d.body || ''), time: '', item: d, ts: norm(d.updatedAt) });
      }
    });

    Store.all('memo').forEach(function (m) {
      if (norm(m.text).indexOf(needle) >= 0) {
        rows.push({ kind: 'memo', id: m.id, date: isoOfTs(m.updatedAt || m.createdAt), text: m.text || '', time: '', item: m, ts: norm(m.updatedAt || m.createdAt) });
      }
    });

    rows.sort(function (a, b) {
      if (a.date !== b.date) return String(b.date).localeCompare(String(a.date));
      return String(b.ts).localeCompare(String(a.ts));
    });
    const total = rows.length;
    const LIMIT = 200;
    return { rows: total > LIMIT ? rows.slice(0, LIMIT) : rows, total: total, lockedN: lockedN };
  }

  function resultRowHTML(r, needle) {
    const label = { schedule: '일정', page: '다이어리', diary: '일기', memo: '메모' }[r.kind] || '';
    const marker = r.kind === 'schedule'
      ? '<i class="sr-bar" style="' + colorVars(r.item) + '" aria-hidden="true"></i>'
      : '<i class="sr-ico" aria-hidden="true">' + ({ page: '✍️', diary: '📖', memo: '🗒️' }[r.kind] || '•') + '</i>';
    const meta = (r.time ? UI.esc(r.time) + ' · ' : '') + label + (r.item && r.item.done ? ' · 완료' : '') +
      (r.kind === 'memo' ? ' · ' + UI.relTime(r.item.updatedAt || r.item.createdAt) : '');
    return '<button type="button" class="sr-row" data-kind="' + r.kind + '" data-id="' + r.id + '" data-date="' + r.date + '">' +
      marker +
      '<span class="sr-main"><span class="sr-title">' + highlight(excerpt(r.text, needle, 64), needle) + '</span>' +
      '<span class="sr-meta">' + meta + '</span></span>' +
      '<span class="sr-go" aria-hidden="true">›</span>' +
    '</button>';
  }

  function resultsHTML(res, needle) {
    let html = '<div class="search-meta">‘<b>' + UI.esc(needle) + '</b>’ <span class="n">' + (res.total || res.rows.length) + '건</span> · 최신순</div>';
    if (res.lockedN) {
      html += '<div class="search-locked">🔒 잠긴 일기 ' + res.lockedN + '건은 잠금을 풀어야 찾을 수 있어요.</div>';
    }
    if (!res.rows.length) {
      return html + '<div class="search-empty">‘' + UI.esc(needle) + '’가 들어간 기록을 찾지 못했어요.<br>낱말을 줄여서 다시 찾아보세요.</div>';
    }
    let last = '';
    res.rows.forEach(function (r) {
      if (r.date !== last) {
        last = r.date;
        html += '<div class="sr-date"><span>' + UI.parseISO(r.date).getFullYear() + '</span>' + UI.koDate(r.date) + '</div>';
      }
      html += resultRowHTML(r, needle);
    });
    if (res.total > res.rows.length) {
      html += '<div class="search-empty">' + res.total + '건 중 최근 ' + res.rows.length + '건만 보여 드려요.<br>낱말을 더 넣어 좁혀 보세요.</div>';
    }
    return html;
  }

  function paintSearch(q) {
    const panel = host && host.querySelector('#search-panel');
    const clear = host && host.querySelector('#sb-clear');
    if (!panel) return;
    const needle = String(q || '').trim();
    if (clear) clear.hidden = !needle;
    host.classList.toggle('is-searching', !!needle);
    if (!needle) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    panel.hidden = false;
    panel.innerHTML = resultsHTML(searchAll(needle), needle);
  }

  function openResult(kind, id, date) {
    if (kind === 'schedule') {
      selected = date;
      ym = UI.ymOf(date);
      mode = 'calendar';
      try { localStorage.setItem('myDiaryApp.scheduleMode', mode); } catch (e) {}
      query = '';
      render();
      window.scrollTo(0, 0);
      const head = host.querySelector('.day-head');
      if (head) {
        head.classList.add('is-flash');
        setTimeout(function () { head.classList.remove('is-flash'); }, 1600);
      }
    } else if (kind === 'page') {
      selected = date;
      ym = UI.ymOf(date);
      mode = 'paper';
      try { localStorage.setItem('myDiaryApp.scheduleMode', mode); } catch (e) {}
      query = '';
      render();
      window.scrollTo(0, 0);
    } else if (kind === 'diary') {
      if (Tabs.diary && Tabs.diary.openDate) Tabs.diary.openDate(date);
      query = '';
      if (window.App) App.go('diary');
    } else if (kind === 'memo') {
      const m = Store.find('memo', id);
      if (!m) return;
      UI.openSheet({
        title: '메모',
        subtitle: UI.relTime(m.updatedAt || m.createdAt) + '에 고침',
        body: '<div class="memo-full">' + UI.esc(m.text).replace(/\n/g, '<br>') + '</div>',
        buttons: [
          { label: '메모 탭에서 보기', kind: 'primary', onClick: function () { if (window.App) App.go('memo'); } },
          { label: '닫기', kind: 'ghost' }
        ]
      });
    }
  }

  function bindSearch() {
    const form = host.querySelector('#sched-search');
    const input = host.querySelector('#sched-q');
    const clear = host.querySelector('#sb-clear');
    const panel = host.querySelector('#search-panel');
    if (!form || !input) return;

    input.addEventListener('input', function () {
      query = input.value;
      paintSearch(query);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        input.value = '';
        query = '';
        paintSearch('');
      }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      input.blur();
    });
    if (clear) {
      clear.addEventListener('click', function () {
        input.value = '';
        query = '';
        paintSearch('');
        input.focus();
      });
    }
    if (panel) {
      panel.addEventListener('click', function (e) {
        const row = e.target.closest('.sr-row');
        if (row) openResult(row.dataset.kind, row.dataset.id, row.dataset.date);
      });
    }
    paintSearch(query);
  }

  function bindCalendar(list) {
    const cal = host.querySelector('.cal');
    if (cal) {
      cal.addEventListener('click', function (e) {
        const view = e.target.closest('[data-calview]');
        if (view) { setChipMode(view.dataset.calview); return; }
        const nav = e.target.closest('[data-nav]');
        if (nav) {
          const v = nav.dataset.nav;
          if (v === 'today') {
            ym = UI.ymOf(UI.todayISO());
            selected = UI.todayISO();
          } else {
            ym = UI.monthShift(ym, Number(v));
            const today = UI.todayISO();
            selected = UI.ymOf(today) === ym ? today : ym + '-01';
          }
          render();
          return;
        }
        const cell = e.target.closest('[data-date]');
        if (cell) {
          const hasMore = !!cell.querySelector('.cal-more');
          selected = cell.dataset.date;
          render();
          // ‘+N’을 눌렀을 때는 그날 일정 전체를 바로 볼 수 있게 목록으로 내려 줍니다.
          if (hasMore) {
            const head = host.querySelector('.day-head');
            if (head) { try { head.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (err) {} }
          }
        }
      });
    }

    const form = host.querySelector('#quick-add');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const input = form.querySelector('input[name="text"]');
        const text = input.value.trim();
        if (!text) { input.focus(); UI.toast('할 일을 먼저 적어 주세요'); return; }
        Store.add('schedule', { date: selected, text: text, done: false, star: false, time: '' });
        render();
        const again = host.querySelector('#quick-add input');
        if (again) again.focus({ preventScroll: true });
      });
    }

    const listEl = host.querySelector('#task-list');
    if (listEl) {
      listEl.addEventListener('click', function (e) {
        const row = e.target.closest('.task');
        if (!row) return;
        const id = row.dataset.id;
        const actEl = e.target.closest('[data-act]');
        if (!actEl) return;
        const act = actEl.dataset.act;
        const item = Store.find('schedule', id);
        if (!item) return;

        if (act === 'toggle') {
          Store.update('schedule', id, { done: !item.done });
          render();
        } else if (act === 'star') {
          Store.update('schedule', id, { star: !item.star });
          render();
        } else if (act === 'edit') {
          openEditor(item);
        }
      });
    }

    const sampleBtn = host.querySelector('[data-act="clear-sample"]');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', function () {
        const n = Store.sampleCount();
        UI.confirmDialog({
          title: '샘플 데이터를 지울까요?',
          message: '예시로 넣어 둔 ' + n + '개만 지우고, 직접 입력한 내용은 그대로 남겨요.',
          confirmLabel: '지우기',
          danger: true,
          onConfirm: function () {
            Store.clearSamples();
            UI.toast('샘플 데이터를 지웠어요');
            render();
          }
        });
      });
    }
  }

  /* ---------- 할 일 수정 시트 ---------- */
  function openEditor(item) {
    const isNew = !item;
    let star = isNew ? false : !!item.star;
    let picked = isNew ? '' : String(item.color || '');
    const autoColor = colorOf({ text: (isNew ? '' : item.text) || '', color: '' });

    const swatches = PALETTE_ORDER.map(function (k) {
      return '<button type="button" class="cp-dot' + (picked === k ? ' is-on' : '') + '" data-color="' + k + '" ' +
        'style="--cb:' + PALETTE[k].bg + ';--cf:' + PALETTE[k].fg + '" aria-label="' + k + '"></button>';
    }).join('');

    const body = '' +
      '<div class="field"><label>할 일</label>' +
        '<input class="input" name="text" type="text" maxlength="200" placeholder="예: 책 읽기 30분" value="' + UI.esc(isNew ? '' : item.text) + '">' +
      '</div>' +
      '<div class="field"><label>날짜</label>' +
        '<input class="input" name="date" type="date" value="' + UI.esc(isNew ? selected : item.date) + '">' +
      '</div>' +
      '<div class="field"><label>시간·순번 메모 (선택)</label>' +
        '<input class="input" name="time" type="text" maxlength="20" placeholder="예: 09:00 또는 3번" value="' + UI.esc(isNew ? '' : (item.time || '')) + '">' +
        '<div class="helper">달력처럼 순번(1번, 2번)으로 적어도 돼요.</div>' +
      '</div>' +
      '<div class="field"><label>달력 막대 색 (선택)</label>' +
        '<div class="color-pick" id="color-pick">' +
          '<button type="button" class="cp-auto' + (picked ? '' : ' is-on') + '" data-color="" style="--cb:' + autoColor.bg + ';--cf:' + autoColor.fg + '">자동</button>' +
          swatches +
        '</div>' +
        '<div class="helper">그냥 두면 제목에 맞춰 알맞은 색을 골라 드려요.</div>' +
      '</div>' +
      '<div class="field"><button type="button" class="pin-toggle ' + (star ? 'is-on' : '') + '" id="star-toggle">' +
        '<span class="sw"></span>중요하게 표시 (★)</button></div>';

    const buttons = [
      { label: isNew ? '추가' : '저장', kind: 'primary', submit: true, onClick: function (form) {
          const text = form.querySelector('input[name="text"]').value.trim();
          const date = form.querySelector('input[name="date"]').value || selected;
          const time = form.querySelector('input[name="time"]').value.trim();
          if (!text) {
            form.querySelector('input[name="text"]').focus();
            UI.toast('할 일을 적어 주세요');
            return false;
          }
          if (isNew) {
            Store.add('schedule', { date: date, text: text, time: time, star: star, done: false, color: picked });
          } else {
            Store.update('schedule', item.id, { date: date, text: text, time: time, star: star, color: picked });
          }
          selected = date;
          ym = UI.ymOf(date);
          render();
          UI.toast(isNew ? '할 일을 추가했어요' : '저장했어요');
        } },
      { label: '취소', kind: 'ghost' }
    ];
    if (!isNew) {
      buttons.splice(1, 0, { label: '삭제', kind: 'danger', keepOpen: true, onClick: function (form, closeSheet) {
        closeSheet();
        UI.confirmDialog({
          title: '할 일을 삭제할까요?',
          message: '“' + item.text + '” 을(를) 지웁니다. 되돌릴 수 없어요.',
          confirmLabel: '삭제',
          danger: true,
          onConfirm: function () {
            Store.remove('schedule', item.id);
            render();
            UI.toast('삭제했어요');
          }
        });
      } });
    }

    UI.openSheet({
      title: isNew ? '할 일 추가' : '할 일 수정',
      body: body,
      buttons: buttons,
      noFocus: !isNew,
      onMount: function (form) {
        const toggle = form.querySelector('#star-toggle');
        if (toggle) {
          toggle.addEventListener('click', function () {
            star = !star;
            toggle.classList.toggle('is-on', star);
          });
        }
        const pick = form.querySelector('#color-pick');
        if (pick) {
          pick.addEventListener('click', function (e) {
            const b = e.target.closest('[data-color]');
            if (!b) return;
            picked = b.dataset.color || '';
            pick.querySelectorAll('[data-color]').forEach(function (x) {
              x.classList.toggle('is-on', (x.dataset.color || '') === picked);
            });
          });
        }
      }
    });
  }

  /* ---------- 탭 생명주기 ---------- */
  function onEnter() {
    if (!host) return;
    const today = UI.todayISO();
    if (UI.ymOf(selected) !== UI.ymOf(today)) selected = today;
    ym = UI.ymOf(selected);
    query = '';
  }

  // 창 너비가 바뀌면(폰 가로/태블릿) 하루에 보이는 막대 수를 다시 셉니다.
  // 주의: 폰에서 일기 입력칸을 누르면 키보드가 올라오며 resize가 오는데,
  // 이때 다시 그리면 보고 있던 화면이 달력으로 덮여 버립니다.
  // 그래서 (1) 일정 탭이 아닐 때는 아무 것도 하지 않고, (2) 실제로 너비가 바뀌었을 때만 다시 그립니다.
  window.addEventListener('resize', function () {
    const width = window.innerWidth;
    if (width === lastWidth) return;   // 높이만 바뀐 경우(키보드)는 넘어갑니다.
    lastWidth = width;
    if (!host) return;
    if (window.App && App.active !== 'schedule') return;
    if (mode !== 'calendar' || chipMode !== 'bar') return;
    if (document.activeElement && document.activeElement.id === 'sched-q') return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { render(); }, 220);
  });

  document.addEventListener('keydown', function (e) {
    if (!host || mode !== 'paper') return;
    if (window.App && App.active !== 'schedule') return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  });

  T.schedule = {
    id: 'schedule',
    label: '일정',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.2" y="5" width="17.6" height="15.6" rx="3.6"/><path d="M8 3.4v3.4M16 3.4v3.4M3.2 10h17.6"/><circle cx="8.4" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="15.6" cy="14" r="1" fill="currentColor" stroke="none"/></svg>',
    title: '일정',
    render: function (root) {
      host = root;
      onEnter();
      render();
    },
    onLeave: function () {
      if (mode === 'paper') pinNote();
    }
  };
})();
