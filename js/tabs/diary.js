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
  let pinBuf = '';
  let fpChecked = false;   // 이 화면에서 지문을 쓸 수 있는지 한 번만 확인
  let fpUsable = false;

  function entryOf(date) {
    return Store.all('diary').find(function (x) { return x.date === date; }) || null;
  }

  function recent() {
    return Store.all('diary').slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    }).slice(0, 6);
  }

  /* ---------- 잠금 화면 ---------- */
  function lockScreenHTML() {
    return '' +
      '<div class="lock-screen">' +
        '<div class="lock-badge" aria-hidden="true">🔒</div>' +
        '<h2 class="lock-title">일기 잠금</h2>' +
        '<p class="lock-msg" id="lock-msg">4자리 비밀번호를 눌러 주세요</p>' +
        '<div class="pin-dots" id="pin-dots" aria-label="비밀번호 4자리">' +
          '<i></i><i></i><i></i><i></i>' +
        '</div>' +
        '<button type="button" class="btn-finger" id="finger-btn" hidden>👆 지문으로 열기</button>' +
        '<div class="keypad" id="keypad">' +
          ['1','2','3','4','5','6','7','8','9'].map(function (n) {
            return '<button type="button" class="key" data-key="' + n + '">' + n + '</button>';
          }).join('') +
          '<button type="button" class="key key-blank" data-key="blank" aria-hidden="true" tabindex="-1"></button>' +
          '<button type="button" class="key" data-key="0">0</button>' +
          '<button type="button" class="key key-del" data-key="del" aria-label="한 자리 지우기">⌫</button>' +
        '</div>' +
        '<p class="lock-foot">지문을 등록해 두면 지문으로도 열 수 있어요.<br>비밀번호를 잊으면 일기를 열 수 없으니 꼭 기억해 주세요.</p>' +
      '</div>';
  }

  function paintDots() {
    const dots = host && host.querySelectorAll('#pin-dots i');
    if (!dots) return;
    dots.forEach(function (d, i) { d.classList.toggle('is-on', i < pinBuf.length); });
  }

  function lockMsg(text, bad) {
    const m = host && host.querySelector('#lock-msg');
    if (!m) return;
    m.textContent = text;
    m.classList.toggle('is-bad', !!bad);
  }

  function shake() {
    const box = host && host.querySelector('.pin-dots');
    if (!box) return;
    box.classList.remove('shake');
    void box.offsetWidth;
    box.classList.add('shake');
  }

  function renderLock() {
    if (window.App && App.setSubtitle) App.setSubtitle('잠금 상태');
    host.innerHTML = lockScreenHTML();
    paintDots();

    // 지문 버튼: 이 기기에서 쓸 수 있을 때만 보여 줍니다.
    const fb = host.querySelector('#finger-btn');
    if (fb && DiaryLock.hasFingerprint()) {
      if (fpChecked) {
        if (fpUsable) fb.hidden = false;
      } else {
        DiaryLock.platformAvailable().then(function (ok) {
          fpChecked = true;
          fpUsable = ok;
          const b = host && host.querySelector('#finger-btn');
          if (b) b.hidden = !ok;
        });
      }
    }

    host.querySelectorAll('#keypad [data-key]').forEach(function (b) {
      b.addEventListener('click', function () { pressKey(b.dataset.key); });
    });

    if (fb) {
      fb.addEventListener('click', function () {
        fb.disabled = true;
        DiaryLock.unlockWithFingerprint().then(function (r) {
          const again = host && host.querySelector('#finger-btn');
          if (again) again.disabled = false;
          if (r.ok) {
            pinBuf = '';
            UI.toast('지문으로 열었어요');
            render();
          } else if (r.message) {
            lockMsg(r.message, true);
          }
        });
      });
    }
  }

  function keyHandler(e) {
    if (!host || !DiaryLock.isLocked() || (window.App && App.active !== 'diary')) return;
    if (/^\d$/.test(e.key)) { pressKey(e.key); return; }
    if (e.key === 'Backspace') { e.preventDefault(); pressKey('del'); }
  }

  function pressKey(k) {
    if (k === 'blank') return;
    if (k === 'del') {
      pinBuf = pinBuf.slice(0, -1);
      paintDots();
      lockMsg('4자리 비밀번호를 눌러 주세요', false);
      return;
    }
    if (pinBuf.length >= 4) return;
    pinBuf += k;
    paintDots();
    if (pinBuf.length === 4) {
      const pin = pinBuf;
      setTimeout(function () {
        if (Store.checkDiaryPin(pin)) {
          pinBuf = '';
          DiaryLock.unlock();
          UI.toast('잠금을 풀었어요');
          render();
        } else {
          pinBuf = '';
          paintDots();
          shake();
          lockMsg('비밀번호가 맞지 않아요. 다시 눌러 주세요.', true);
        }
      }, 130);
    }
  }

  function render() {
    if (!host) return;
    if (DiaryLock.isLocked()) { renderLock(); return; }
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
        (DiaryLock.enabled() ? '<button type="button" class="lock-now" id="lock-now" aria-label="일기 잠그기" title="일기 잠그기">🔒</button>' : '') +
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

    const lockBtn = host.querySelector('#lock-now');
    if (lockBtn) {
      lockBtn.addEventListener('click', function () {
        flush();
        DiaryLock.lock();
        pinBuf = '';
        lockMsg('4자리 비밀번호를 눌러 주세요', false);
        render();
        UI.toast('일기를 잠갔어요');
      });
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

  document.addEventListener('keydown', keyHandler);

  // 검색 결과에서 특정 날짜의 일기로 바로 이동할 때 씁니다.
  function openDate(date) {
    if (date) selected = String(date);
  }

  T.diary = {
    id: 'diary',
    onLeave: onLeave,
    openDate: openDate,
    refresh: function () { if (host) render(); },
    label: '일기',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.2 5.8A2.6 2.6 0 0 1 6.8 3.2h12.4v14.2H6.8a2.6 2.6 0 0 0-2.6 2.6z"/><path d="M4.2 20a2.6 2.6 0 0 1 2.6-2.6h12.4V20z"/><path d="M8.4 7.6h7"/></svg>',
    title: '일기',
    render: function (root) {
      host = root;
      render();
    }
  };
})();
