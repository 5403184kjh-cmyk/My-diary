/* =========================================================
   tabs/memo.js — 메모
   · 포스트잇 : 색색의 카드
   · 공책    : 줄노트 한 페이지에 길게 쓰고 좌우로 넘기는 메모장
   ========================================================= */
(function () {
  'use strict';
  const T = (window.Tabs = window.Tabs || {});

  const ICON = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4.2-1 9.3-9.3a2.1 2.1 0 0 0-3-3L5.2 16z"/><path d="M14.2 6.8l3 3"/></svg>'
  };

  const COLORS = [
    { id: 'cream', cls: 'c-cream', label: '크림' },
    { id: 'sage', cls: 'c-sage', label: '세이지' },
    { id: 'rose', cls: 'c-rose', label: '로즈' },
    { id: 'sky', cls: 'c-sky', label: '스카이' },
    { id: 'lilac', cls: 'c-lilac', label: '라일락' }
  ];
  const colorCls = function (id) {
    const c = COLORS.find(function (x) { return x.id === id; });
    return c ? c.cls : 'c-cream';
  };

  let host = null;
  let mode = (function () {
    try { return localStorage.getItem('myDiaryApp.memoMode') || 'postit'; } catch (e) { return 'postit'; }
  })();
  let nbId = null;             // 공책에서 보고 있는 메모 id
  let saveTimer = null;
  const freshIds = {};         // 이번에 새로 만든 쪽(비어 있으면 정리)

  function sorted() {
    return Store.all('memo').slice().sort(function (a, b) {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
    });
  }

  function setMode(m) {
    if (mode === m) return;
    pinCurrent();
    pruneFresh();
    mode = m;
    try { localStorage.setItem('myDiaryApp.memoMode', m); } catch (e) {}
    render();
  }

  function modeSwitchHTML() {
    return '<div class="seg seg-top">' +
      '<button type="button" data-mode="postit" class="' + (mode === 'postit' ? 'is-on' : '') + '">🗒️ 포스트잇</button>' +
      '<button type="button" data-mode="note" class="' + (mode === 'note' ? 'is-on' : '') + '">📓 공책</button>' +
    '</div>';
  }

  /* ---------- 포스트잇 ---------- */
  function cardHTML(m) {
    const preview = String(m.text || '').trim();
    return '' +
      '<div class="memo-card ' + colorCls(m.color) + (m.pinned ? ' is-pinned' : '') + '" data-id="' + m.id + '">' +
        '<button type="button" class="mc-open" data-act="open">' +
          '<span class="txt">' + (preview ? UI.esc(preview) : '<span class="mc-empty">빈 메모 — 눌러서 쓰기</span>') + '</span>' +
          '<span class="ft"><span>' + (m.pinned ? '📌 ' : '') + UI.relTime(m.updatedAt || m.createdAt) + '</span></span>' +
        '</button>' +
        '<button type="button" class="mc-edit" data-act="edit" aria-label="색·고정 바꾸기">' + ICON.pen + '</button>' +
      '</div>';
  }

  function postitHTML() {
    const list = sorted();
    const pinned = list.filter(function (x) { return x.pinned; }).length;
    return '' +
      '<div class="sec-head"><h2>메모 ' + list.length + '개</h2>' +
        (pinned ? '<span class="sub">📌 고정 ' + pinned + '</span>' : '<span class="sub">눌러서 공책으로 펼치기</span>') +
      '</div>' +
      (list.length
        ? '<div class="memo-grid">' + list.map(cardHTML).join('') + '</div>'
        : '<div class="empty"><span class="emo">📝</span>아직 메모가 없어요.<br>아래 ＋ 메모로 생각을 적어 두세요.</div>');
  }

  /* ---------- 공책 ---------- */
  function currentMemo() {
    const list = sorted();
    if (!list.length) return null;
    let m = list.find(function (x) { return x.id === nbId; });
    if (!m) { m = list[0]; nbId = m.id; }
    return m;
  }

  function nbIndex() {
    const list = sorted();
    return list.findIndex(function (x) { return x.id === nbId; });
  }

  function notebookHTML() {
    const list = sorted();
    const m = currentMemo();
    if (!m) {
      return '<div class="nb-empty">' +
        '<div class="empty"><span class="emo">📓</span>아직 공책이 비어 있어요.<br>새 쪽을 펼쳐 첫 메모를 적어 보세요.</div>' +
        '<button type="button" class="nb-new-big" data-nav="new">＋ 새 쪽 펼치기</button>' +
      '</div>';
    }
    const idx = Math.max(0, nbIndex());
    const d = m.createdAt ? new Date(m.createdAt) : new Date();
    const dateStr = isNaN(d.getTime()) ? '' : (d.getFullYear() + ' · ' + String(d.getMonth() + 1).padStart(2, '0') + ' · ' + String(d.getDate()).padStart(2, '0'));

    return '' +
      '<div class="nb-bar">' +
        '<span class="nb-count">' + (idx + 1) + ' / ' + list.length + ' 쪽</span>' +
        '<span class="nb-auto">적으면 바로 저장돼요</span>' +
        '<button type="button" class="nb-tool" data-nav="meta" aria-label="이 쪽 색·고정">' + ICON.pen + '</button>' +
      '</div>' +
      '<div class="nb-slot" id="nb-slot">' +
        '<div class="nb-page ' + colorCls(m.color) + '" id="nb-page">' +
          '<div class="nb-head">' +
            '<span class="nb-no">No. ' + (idx + 1) + '</span>' +
            '<span class="nb-date">' + dateStr + (m.pinned ? ' · 📌' : '') + '</span>' +
          '</div>' +
          '<textarea class="nb-lines" id="nb-text" spellcheck="false" ' +
            'placeholder="생각, 기억해 둘 것, 오늘의 메모…">' + UI.esc(m.text || '') + '</textarea>' +
          '<div class="nb-foot"><span>— ' + (idx + 1) + ' —</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="nb-nav">' +
        '<button type="button" data-nav="-1" ' + (idx === 0 ? 'disabled' : '') + '>◀ 이전 쪽</button>' +
        '<button type="button" data-nav="new" class="nb-add">' + ICON.plus + '새 쪽</button>' +
        '<button type="button" data-nav="1" ' + (idx >= list.length - 1 ? 'disabled' : '') + '>다음 쪽 ▶</button>' +
      '</div>' +
      '<p class="pp-hint">좌우로 넘기면 다음 메모장이 펼쳐져요</p>';
  }

  function pinCurrent() {
    const el = host && host.querySelector('#nb-text');
    if (!el) return;
    clearTimeout(saveTimer);
    const m = currentMemo();
    if (!m) return;
    const v = el.value;
    if ((m.text || '') === v) return;
    Store.update('memo', m.id, { text: v });
  }

  function pruneFresh() {
    const el = host && host.querySelector('#nb-text');
    const cur = currentMemo();
    Object.keys(freshIds).forEach(function (id) {
      const row = Store.find('memo', id);
      if (!row) { delete freshIds[id]; return; }
      let text = String(row.text || '').trim();
      if (cur && cur.id === id && el) text = el.value.trim();
      if (!text) {
        Store.remove('memo', id);
        if (nbId === id) nbId = null;
      }
      delete freshIds[id];
    });
  }

  function goNb(step) {
    if (step === 'new') {
      pinCurrent();
      const m = Store.add('memo', { text: '', color: COLORS[Store.all('memo').length % COLORS.length].id, pinned: false });
      freshIds[m.id] = true;
      nbId = m.id;
      render();
      const t = host.querySelector('#nb-text');
      if (t) { t.focus({ preventScroll: true }); t.setSelectionRange(0, 0); }
      return;
    }
    if (step === 'meta') {
      const m = currentMemo();
      if (m) openEditor(m);
      return;
    }
    pinCurrent();
    const list = sorted();
    const i = nbIndex();
    const next = list[i + Number(step)];
    if (!next) { UI.toast(step > 0 ? '마지막 쪽이에요' : '첫 쪽이에요'); return; }
    nbId = next.id;
    render();
    slide(Number(step));
  }

  function slide(dir) {
    const page = host.querySelector('#nb-page');
    if (!page) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    page.classList.add(dir > 0 ? 'nb-in-next' : 'nb-in-prev');
  }

  /* ---------- 그리기 ---------- */
  function render() {
    if (!host) return;
    host.innerHTML = modeSwitchHTML() + (mode === 'postit' ? postitHTML() : notebookHTML());

    if (mode === 'postit') {
      const list = sorted();
      const pinned = list.filter(function (x) { return x.pinned; }).length;
      if (window.App && App.setSubtitle) {
        App.setSubtitle(pinned ? '고정한 메모가 위에 보여요' : '카드를 누르면 공책으로 펼쳐져요');
      }
      if (window.App && App.showFab) App.showFab({ label: '메모', onClick: function () { openNewInNotebook(); } });
    } else {
      const list = sorted();
      if (window.App && App.setSubtitle) {
        App.setSubtitle(list.length ? '공책 ' + list.length + '쪽 · 좌우로 넘겨 보세요' : '첫 쪽을 펼쳐 보세요');
      }
      if (window.App && App.hideFab) App.hideFab();
    }

    bind();
  }

  function bind() {
    host.querySelectorAll('[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.dataset.mode); });
    });

    if (mode === 'postit') {
      host.querySelectorAll('.memo-card').forEach(function (card) {
        card.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-act]');
          const m = Store.find('memo', card.dataset.id);
          if (!m) return;
          const act = btn && btn.dataset.act;
          if (act === 'edit') { openEditor(m); return; }
          // 카드를 누르면 공책으로 펼칩니다
          nbId = m.id;
          setMode('note');
        });
      });
      return;
    }

    const text = host.querySelector('#nb-text');
    if (text) {
      text.addEventListener('input', function () {
        clearTimeout(saveTimer);
        const id = nbId;
        saveTimer = setTimeout(function () {
          Store.update('memo', id, { text: text.value });
        }, 400);
      });
      text.addEventListener('blur', pinCurrent);
    }

    host.querySelectorAll('[data-nav]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        goNb(b.dataset.nav === '-1' ? -1 : (b.dataset.nav === '1' ? 1 : b.dataset.nav));
      });
    });

    const slot = host.querySelector('#nb-slot');
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
          goNb(dx < 0 ? 1 : -1);
        }
      });
    }
  }

  function openNewInNotebook() {
    mode = 'note';
    try { localStorage.setItem('myDiaryApp.memoMode', 'note'); } catch (e) {}
    render();
    goNb('new');
  }

  /* ---------- 색·고정·삭제 시트 ---------- */
  function openEditor(memo) {
    const isNew = !memo;
    let color = isNew ? 'cream' : (memo.color || 'cream');
    let pinned = isNew ? false : !!memo.pinned;

    const body = '' +
      '<div class="field">' +
        '<textarea class="input" id="memo-text" rows="6" maxlength="4000" ' +
          'placeholder="생각, 할 일, 기억해 둘 것…">' + UI.esc(isNew ? '' : memo.text) + '</textarea>' +
      '</div>' +
      '<div class="field"><span class="field-label">색상</span>' +
        '<div class="swatches" id="memo-colors">' +
          COLORS.map(function (c) {
            return '<button type="button" class="swatch ' + c.cls + (c.id === color ? ' is-on' : '') + '" data-color="' + c.id + '" aria-label="' + c.label + '"></button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="field">' +
        '<button type="button" class="pin-toggle ' + (pinned ? 'is-on' : '') + '" id="memo-pin">' +
          '<span class="sw"></span>맨 위에 고정하기</button>' +
      '</div>';

    const buttons = [
      { label: isNew ? '추가' : '저장', kind: 'primary', submit: true, onClick: function (form) {
          const text = form.querySelector('#memo-text').value.trim();
          if (isNew) {
            if (!text) { form.querySelector('#memo-text').focus(); UI.toast('내용을 적어 주세요'); return false; }
            const row = Store.add('memo', { text: text, color: color, pinned: pinned });
            nbId = row.id;
          } else {
            Store.update('memo', memo.id, { text: text, color: color, pinned: pinned });
          }
          render();
          UI.toast(isNew ? '메모를 남겼어요' : '저장했어요');
        } },
      { label: '취소', kind: 'ghost' }
    ];
    if (!isNew) {
      buttons.splice(1, 0, { label: '삭제', kind: 'danger', keepOpen: true, onClick: function (form, closeSheet) {
        closeSheet();
        UI.confirmDialog({
          title: '메모를 삭제할까요?',
          message: '이 메모를 지웁니다. 되돌릴 수 없어요.',
          confirmLabel: '삭제',
          danger: true,
          onConfirm: function () {
            Store.remove('memo', memo.id);
            if (nbId === memo.id) nbId = null;
            render();
            UI.toast('삭제했어요');
          }
        });
      } });
    }

    UI.openSheet({
      title: isNew ? '메모 쓰기' : '메모 색·고정',
      subtitle: isNew ? '' : '공책에서 바로 고쳐도 저장돼요',
      body: body,
      buttons: buttons,
      noFocus: !isNew,
      onMount: function (form) {
        form.querySelectorAll('#memo-colors [data-color]').forEach(function (b) {
          b.addEventListener('click', function () {
            color = b.dataset.color;
            form.querySelectorAll('#memo-colors [data-color]').forEach(function (x) {
              x.classList.toggle('is-on', x.dataset.color === color);
            });
          });
        });
        const pin = form.querySelector('#memo-pin');
        pin.addEventListener('click', function () {
          pinned = !pinned;
          pin.classList.toggle('is-on', pinned);
        });
      }
    });
  }

  T.memo = {
    id: 'memo',
    label: '메모',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5.4 4.2h8.8L19.4 9.4v10.4a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19.8V5.6a1.4 1.4 0 0 1 1.4-1.4z"/><path d="M14.2 4.4v5.2h5.1"/><path d="M7.8 13.2h8.2M7.8 16.4h5.6"/></svg>',
    title: '메모',
    render: function (root) {
      host = root;
      render();
    },
    onLeave: function () {
      if (mode === 'note') { pinCurrent(); pruneFresh(); }
    }
  };
})();
