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
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.9l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z"/></svg>'
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
    try { localStorage.setItem('myDiaryApp.scheduleMode', m); } catch (e) {}
    render();
    window.scrollTo(0, 0);
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

    let cells = '';
    for (let i = 0; i < firstDown; i++) cells += '<div class="cal-cell empty"></div>';
    for (let d = 1; d <= days; d++) {
      const date = y + '-' + pad(m) + '-' + pad(d);
      const list = itemsOf(date);
      const undone = list.filter(function (x) { return !x.done; }).length;
      const starred = list.some(function (x) { return x.star; });
      const note = Store.pageOf(date);
      let dots = '';
      if (list.length) {
        dots = (starred ? '<i class="star"></i>' : '') + '<i class="' + (undone ? '' : 'done') + '"></i>';
      }
      if (note && String(note.body || '').trim()) dots += '<i class="note"></i>';
      const cls = ['cal-cell'];
      if (date === today) cls.push('is-today');
      if (date === selected) cls.push('is-sel');
      cells += '<button type="button" class="' + cls.join(' ') + '" data-date="' + date + '" aria-label="' + date + '">' +
        '<span class="num">' + d + '</span><span class="dots">' + dots + '</span></button>';
    }

    return '' +
      '<section class="cal">' +
        '<div class="cal-head">' +
          '<div class="cal-title">' + UI.koMonth(ym) + '</div>' +
          '<div class="cal-nav">' +
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
      '<div class="task ' + (it.done ? 'is-done ' : '') + (it.star ? 'is-important' : '') + '" data-id="' + it.id + '">' +
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
    if (mode === 'paper') {
      ym = UI.ymOf(selected);
      host.innerHTML = modeSwitchHTML() + paperHTML();
      bindPaper();
    } else {
      const list = sortItems(itemsOf(selected));
      const todayCount = itemsOf(today).filter(function (x) { return !x.done; }).length;
      host.innerHTML = modeSwitchHTML() + sampleBanner() + calendarViewHTML();
      if (window.App && App.setSubtitle) {
        App.setSubtitle(UI.koDateFull(today) + ' · 오늘 할 일 ' + todayCount + '개');
      }
      bindCalendar(list);
    }

    host.querySelectorAll('[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.dataset.mode); });
    });
  }

  function bindCalendar(list) {
    const cal = host.querySelector('.cal');
    if (cal) {
      cal.addEventListener('click', function (e) {
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
          selected = cell.dataset.date;
          render();
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
            Store.add('schedule', { date: date, text: text, time: time, star: star, done: false });
          } else {
            Store.update('schedule', item.id, { date: date, text: text, time: time, star: star });
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
      }
    });
  }

  /* ---------- 탭 생명주기 ---------- */
  function onEnter() {
    if (!host) return;
    const today = UI.todayISO();
    if (UI.ymOf(selected) !== UI.ymOf(today)) selected = today;
    ym = UI.ymOf(selected);
  }

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
