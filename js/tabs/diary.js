/* =========================================================
   tabs/diary.js — 일기 (날짜별 · 기분 이모지 · 줄노트)
   ========================================================= */
(function () {
  'use strict';
  const T = (window.Tabs = window.Tabs || {});

  const ICON = {
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 6.8"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15"/><path d="M9.5 7V4.8h5V7"/><path d="M6.5 7l.8 12.2A1.6 1.6 0 0 0 8.9 20.8h6.2a1.6 1.6 0 0 0 1.6-1.6L17.5 7"/></svg>'
  };

  const MOODS = [
    { e: '😊', label: '기쁨' },
    { e: '😐', label: '보통' },
    { e: '😔', label: '슬픔' },
    { e: '😤', label: '화남' },
    { e: '🥰', label: '설렘' }
  ];

  let host = null;
  let selected = UI.todayISO();
  let mood = '';
  let saveTimer = null;

  function entryOf(date) {
    return Store.all('diary').find(function (x) { return x.date === date; }) || null;
  }

  function recent() {
    return Store.all('diary').slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    }).slice(0, 6);
  }

  function render() {
    if (!host) return;
    const entry = entryOf(selected);
    mood = entry && entry.mood ? entry.mood : '';

    const isToday = selected === UI.todayISO();
    const rec = recent();

    host.innerHTML = '' +
      '<div class="diary-datebar">' +
        '<button type="button" data-day="-1" aria-label="이전 날">' + ICON.left + '</button>' +
        '<div class="dtext"><strong>' + UI.koDate(selected) + '</strong>' +
          '<span>' + UI.parseISO(selected).getFullYear() + '년' + (isToday ? ' · <b class="today-dot">오늘</b>' : '') + '</span></div>' +
        '<button type="button" data-day="1" aria-label="다음 날">' + ICON.right + '</button>' +
        (isToday ? '' : '<button type="button" class="mini-btn" id="go-today" style="flex:none;height:34px">오늘</button>') +
      '</div>' +

      '<div class="mood-row" id="mood-row">' +
        MOODS.map(function (m) {
          return '<button type="button" class="mood ' + (m.e === mood ? 'is-on' : '') + '" data-mood="' + m.e + '" aria-label="' + m.label + '">' +
            m.e + '<small>' + m.label + '</small></button>';
        }).join('') +
      '</div>' +

      '<div class="paper">' +
        '<input class="diary-title" id="d-title" type="text" maxlength="60" placeholder="제목 (선택)" value="' + UI.esc(entry ? entry.title || '' : '') + '">' +
        '<textarea class="diary-body" id="d-body" placeholder="오늘 있었던 일, 기억하고 싶은 마음…">' + UI.esc(entry ? entry.body || '' : '') + '</textarea>' +
      '</div>' +

      '<div class="diary-foot">' +
        '<span class="status" id="d-status">' + (entry ? '자동 저장돼요' : '쓰기 시작하면 자동 저장돼요') + '</span>' +
        '<span class="actions">' +
          (entry ? '<button type="button" class="btn small danger" id="d-del" aria-label="일기 삭제">' + ICON.trash + '</button>' : '') +
          '<button type="button" class="btn small primary" id="d-save">' + ICON.save + '저장</button>' +
        '</span>' +
      '</div>' +

      '<div class="sec-head"><h2>지난 일기</h2><span class="sub">' + Store.all('diary').length + '편</span></div>' +
      (rec.length
        ? '<div class="recent-list" id="recent-list">' + rec.map(function (r) {
            return '<button type="button" class="recent-item" data-date="' + r.date + '">' +
              '<span class="rmood">' + (r.mood || '📖') + '</span>' +
              '<span class="rmain"><span class="rdate">' + UI.koDate(r.date) + '</span>' +
                '<span class="rprev">' + UI.esc((r.title ? r.title + ' · ' : '') + (r.body || '').replace(/\s+/g, ' ').slice(0, 40)) + '</span></span>' +
            '</button>';
          }).join('') + '</div>'
        : '<div class="empty" style="padding:18px 10px">아직 쓴 일기가 없어요.</div>') +
      '<div style="height:8px"></div>';

    if (window.App && App.setSubtitle) {
      App.setSubtitle(UI.koDateFull(selected));
    }

    bind();
    grow();
  }

  function bind() {
    host.querySelectorAll('[data-day]').forEach(function (b) {
      b.addEventListener('click', function () {
        flush();
        selected = UI.isoAdd(selected, Number(b.dataset.day));
        render();
      });
    });

    const todayBtn = host.querySelector('#go-today');
    if (todayBtn) {
      todayBtn.addEventListener('click', function () { flush(); selected = UI.todayISO(); render(); });
    }

    host.querySelectorAll('#mood-row [data-mood]').forEach(function (b) {
      b.addEventListener('click', function () {
        mood = (mood === b.dataset.mood) ? '' : b.dataset.mood;
        host.querySelectorAll('#mood-row [data-mood]').forEach(function (x) {
          x.classList.toggle('is-on', x.dataset.mood === mood);
        });
        saveNow(true);
      });
    });

    const title = host.querySelector('#d-title');
    const body = host.querySelector('#d-body');
    const onEdit = function () {
      setStatus('저장 중…');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { saveNow(true); }, 700);
      grow();
    };
    title.addEventListener('input', onEdit);
    body.addEventListener('input', onEdit);

    const saveBtn = host.querySelector('#d-save');
    saveBtn.addEventListener('click', function () {
      if (saveNow(false)) UI.toast('일기를 저장했어요');
    });

    const del = host.querySelector('#d-del');
    if (del) del.addEventListener('click', askDelete);

    host.querySelectorAll('#recent-list [data-date]').forEach(function (b) {
      b.addEventListener('click', function () {
        flush();
        selected = b.dataset.date;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  // 날짜를 옮기기 전에 쓰던 내용을 먼저 저장
  function flush() {
    clearTimeout(saveTimer);
    const titleEl = host && host.querySelector('#d-title');
    const bodyEl = host && host.querySelector('#d-body');
    if (!titleEl || !bodyEl) return;
    const hasText = titleEl.value.trim() || bodyEl.value.trim() || mood;
    if (hasText) saveNow(true);
  }

  function askDelete() {
    const entry = entryOf(selected);
    if (!entry) return;
    UI.confirmDialog({
      title: '이 날의 일기를 삭제할까요?',
      message: UI.koDate(selected) + '에 쓴 일기를 지웁니다. 되돌릴 수 없어요.',
      confirmLabel: '삭제',
      danger: true,
      onConfirm: function () {
        Store.remove('diary', entry.id);
        UI.toast('일기를 삭제했어요');
        render();
      }
    });
  }

  function ensureDeleteButton() {
    const actions = host && host.querySelector('.actions');
    if (!actions || actions.querySelector('#d-del')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn small danger';
    btn.id = 'd-del';
    btn.setAttribute('aria-label', '일기 삭제');
    btn.innerHTML = ICON.trash;
    btn.addEventListener('click', askDelete);
    actions.insertBefore(btn, actions.firstChild);
  }

  function grow() {
    const body = host && host.querySelector('#d-body');
    if (!body) return;
    body.style.height = 'auto';
    body.style.height = Math.max(300, body.scrollHeight) + 'px';
  }

  function setStatus(text) {
    const s = host && host.querySelector('#d-status');
    if (s) s.textContent = text;
  }

  function saveNow(silent) {
    const titleEl = host && host.querySelector('#d-title');
    const bodyEl = host && host.querySelector('#d-body');
    if (!titleEl || !bodyEl) return false;

    const title = titleEl.value.trim();
    const body = bodyEl.value;
    const empty = !title && !body.trim() && !mood;
    const entry = entryOf(selected);

    if (empty) {
      if (!silent) UI.toast('내용을 적어 주세요');
      return false;
    }

    if (entry) {
      Store.update('diary', entry.id, { mood: mood, title: title, body: body });
    } else {
      Store.add('diary', { date: selected, mood: mood, title: title, body: body });
      ensureDeleteButton();
    }

    const t = new Date();
    setStatus('저장됨 · ' + (t.getHours() < 12 ? '오전 ' : '오후 ') + ((t.getHours() % 12) || 12) + ':' + String(t.getMinutes()).padStart(2, '0'));

    if (window.App && App.setSubtitle) {
      App.setSubtitle(UI.koDateFull(selected));
    }
    return true;
  }

  // 다른 탭으로 넘어가기 전에 쓰던 글을 저장
  function onLeave() {
    clearTimeout(saveTimer);
    if (host && host.querySelector('#d-title') && host.querySelector('#d-body')) saveNow(true);
  }

  T.diary = {
    id: 'diary',
    onLeave: onLeave,
    label: '일기',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.2 5.8A2.6 2.6 0 0 1 6.8 3.2h12.4v14.2H6.8a2.6 2.6 0 0 0-2.6 2.6z"/><path d="M4.2 20a2.6 2.6 0 0 1 2.6-2.6h12.4V20z"/><path d="M8.4 7.6h7"/></svg>',
    title: '일기',
    render: function (root) {
      host = root;
      render();
    }
  };
})();
