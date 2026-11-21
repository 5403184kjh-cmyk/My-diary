/* =========================================================
   tabs/links.js — 바로가기 (자주 가는 사이트 모음)
   · 삼성 폴더처럼 3열(넓은 화면 4열) 둥근 아이콘 격자
   · 추가·수정·삭제·순서·묶음(분류)
   · 데이터는 이 폰의 브라우저 저장소에만 저장됩니다
   ========================================================= */
(function () {
  'use strict';
  const T = (window.Tabs = window.Tabs || {});

  const COLORS = [
    { v: '#5B8DEF', label: '파랑' },
    { v: '#3E9E8F', label: '청록' },
    { v: '#7C9375', label: '세이지' },
    { v: '#B98B2E', label: '골드' },
    { v: '#C1684A', label: '테라' },
    { v: '#D2688A', label: '로즈' },
    { v: '#8A6FD1', label: '보라' },
    { v: '#4B4B55', label: '차콜' }
  ];
  const DEFAULT_COLOR = COLORS[0].v;
  const EMOJIS = [
    '🔗', '🌐', '📰', '🛒', '💰', '🏦', '📊', '📈',
    '🎬', '🎵', '📚', '✈️', '🏠', '💬', '📮', '🧾',
    '🎁', '🩺', '🍳', '☕', '🚌', '🌤️', '🧺', '🎓',
    '🗺️', '📍', '📱', '🏥', '🏪', '🚗'
  ];

  let host = null;
  let editing = false;
  let bound = false;
  let pressTimer = null;
  let pressFired = false;

  const HEX = /^#[0-9a-fA-F]{6}$/;

  /* ---------- 값 다듬기 ---------- */
  function safeColor(c) {
    return HEX.test(String(c || '')) ? String(c) : DEFAULT_COLOR;
  }

  function firstChar(name) {
    const s = String(name || '').trim();
    if (!s) return '?';
    const ch = Array.from(s)[0];
    return /[a-z]/i.test(ch) ? ch.toUpperCase() : ch;
  }

  // 주소 보정: https:// 자동, http/https만 허용
  function normUrl(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    if (s.length > 600) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) {
      if (!/^https?:\/\//i.test(s)) return '';
    } else {
      s = 'https://' + s.replace(/^\/+/, '');
    }
    s = s.replace(/\s+/g, '');
    let u;
    try { u = new URL(s); } catch (e) { return ''; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (!u.hostname || u.hostname.indexOf('.') < 0) return '';
    return u.href;
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  /* ---------- 묶음 ---------- */
  function sections() {
    const arr = Store.all('links');
    const order = [];
    const map = {};
    arr.forEach(function (x) {
      const g = String(x.group || '').trim();
      if (!map[g]) { map[g] = { title: g, items: [] }; order.push(g); }
      map[g].items.push(x);
    });
    // 묶지 않은 것은 늘 맨 위, 묶음은 처음 나온 순서대로
    order.sort(function (a, b) {
      if (a === b) return 0;
      if (a === '') return -1;
      if (b === '') return 1;
      return 0;
    });
    return order.map(function (g) { return map[g]; });
  }

  function groupNames() {
    const out = [];
    sections().forEach(function (s) {
      if (s.title && out.indexOf(s.title) < 0) out.push(s.title);
    });
    return out;
  }

  /* ---------- 그리기 ---------- */
  function tileHTML(x) {
    const color = safeColor(x.color);
    const emoji = String(x.emoji || '').trim();
    const inner = emoji
      ? '<span class="lk-emo">' + UI.esc(emoji) + '</span>'
      : '<span class="lk-ch">' + UI.esc(firstChar(x.name)) + '</span>';
    const sub = x.note ? ' title="' + UI.esc(x.note) + '"' : '';
    return '' +
      '<div class="lk-cell' + (editing ? ' is-editing' : '') + '" data-id="' + UI.esc(x.id) + '">' +
        '<button type="button" class="lk-open" data-act="open" aria-label="' + UI.esc(x.name) + ' 열기"' + sub + '>' +
          '<span class="lk-icon" style="--lk:' + color + '">' + inner + '</span>' +
          '<span class="lk-name">' + UI.esc(x.name) + '</span>' +
        '</button>' +
        '<button type="button" class="lk-badge lk-edit" data-act="edit" aria-label="' + UI.esc(x.name) + ' 수정">✎</button>' +
        '<button type="button" class="lk-badge lk-del" data-act="del" aria-label="' + UI.esc(x.name) + ' 삭제">✕</button>' +
      '</div>';
  }

  function addTileHTML() {
    return '' +
      '<div class="lk-cell lk-add-cell">' +
        '<button type="button" class="lk-open" data-act="add" aria-label="바로가기 추가">' +
          '<span class="lk-icon lk-icon-add">＋</span>' +
          '<span class="lk-name">추가</span>' +
        '</button>' +
      '</div>';
  }

  function sameGrid(list, headHTML, withAdd) {
    return (headHTML || '') +
      '<div class="lk-grid">' + list.map(tileHTML).join('') + (withAdd ? addTileHTML() : '') + '</div>';
  }

  function render() {
    if (!host) return;
    const arr = Store.all('links');
    if (!arr.length) editing = false;
    const secs = sections();
    const showHead = secs.filter(function (s) { return s.title; }).length > 0 &&
                     (secs.length > 1 || (secs[0] && secs[0].title));

    let body = '';
    if (!arr.length) {
      body = '<div class="empty lk-empty"><span class="emo">🔗</span>' +
        '자주 가는 사이트를 담아 두는 곳이에요.<br>아래 <b>＋ 추가</b>를 눌러 첫 바로가기를 만들어 보세요.</div>' +
        sameGrid([], '', true);
    } else {
      body = secs.map(function (s, i) {
        const last = i === secs.length - 1;
        const head = (showHead && s.title) ? '<div class="lk-sec-head">' + UI.esc(s.title) + '</div>' : '';
        return sameGrid(s.items, head, last);
      }).join('');
    }

    host.innerHTML = '' +
      '<div class="lk-top">' +
        '<span class="lk-count">바로가기 ' + arr.length + '개</span>' +
        (arr.length
          ? '<button type="button" class="mini-btn' + (editing ? ' terra' : '') + '" data-act="editing">' + (editing ? '편집 끝내기' : '편집') + '</button>'
          : '') +
      '</div>' +
      body +
      '<p class="lk-hint">' +
        (editing
          ? '✎ 로 고치고 ✕ 로 지워요 · 아이콘을 누르면 수정 창이 열려요'
          : '아이콘을 누르면 새 탭에서 열려요 · 길게 누르면 편집') +
      '</p>';

    if (window.App && App.setSubtitle) {
      App.setSubtitle(arr.length
        ? (editing ? '편집 중 · 아이콘을 눌러 고치거나 지워요' : '자주 가는 곳을 한 번에 열어요')
        : '자주 가는 사이트를 모아 두세요');
    }
    if (window.App && App.showFab) {
      App.showFab({ label: '바로가기', onClick: function () { openEditor(null); } });
    }
  }

  /* ---------- 열기 · 편집 · 삭제 ---------- */
  function findById(id) {
    return Store.all('links').find(function (x) { return x.id === id; }) || null;
  }

  function openSite(x) {
    const url = normUrl(x.url);
    if (!url) { UI.toast('주소를 열 수 없어요 · ✎로 주소를 고쳐 주세요'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function askDelete(x) {
    UI.confirmDialog({
      title: '바로가기를 지울까요?',
      message: '‘' + String(x.name || '').slice(0, 40) + '’를 이 목록에서 지웁니다. 되돌릴 수 없어요.',
      confirmLabel: '삭제',
      danger: true,
      onConfirm: function () {
        Store.remove('links', x.id);
        render();
        UI.toast('바로가기를 지웠어요');
      }
    });
  }

  function moveItem(id, dir) {
    const secs = sections();
    let si = -1, ii = -1;
    secs.forEach(function (s, i) {
      const j = s.items.findIndex(function (x) { return x.id === id; });
      if (j >= 0) { si = i; ii = j; }
    });
    if (si < 0) return false;
    const items = secs[si].items;
    const j = ii + dir;
    if (j < 0 || j >= items.length) return false;
    const tmp = items[ii]; items[ii] = items[j]; items[j] = tmp;
    const flat = [];
    secs.forEach(function (s) { s.items.forEach(function (x) { flat.push(x); }); });
    Store.state.links.items = flat;
    Store.save();
    return true;
  }

  // 지금 고른 이모지가 목록에 없으면(예전 백업) 맨 앞에 한 칸 더 보여 줍니다
  function emojiList(current) {
    const list = EMOJIS.slice();
    if (current && list.indexOf(current) < 0) list.unshift(current);
    return list;
  }

  /* ---------- 추가·수정 시트 ---------- */
  function openEditor(item) {
    const isNew = !item;
    const fromEdit = editing;
    let color = safeColor(isNew ? DEFAULT_COLOR : item.color);
    let emoji = isNew ? '' : String(item.emoji || '').trim();
    let group = isNew ? '' : String(item.group || '');

    const body = '' +
      '<div class="lk-prev">' +
        '<span class="lk-icon" id="lk-prev-icon" style="--lk:' + color + '"></span>' +
        '<span class="lk-prev-txt"><b id="lk-prev-name">' + UI.esc(isNew ? '새 바로가기' : item.name) + '</b>' +
          '<span id="lk-prev-host">' + UI.esc(isNew ? '아이콘을 눌러 새 탭에서 열려요' : (hostOf(normUrl(item.url)) || '주소를 확인해 주세요')) + '</span></span>' +
      '</div>' +

      '<div class="field"><label for="lk-name">이름</label>' +
        '<input class="input" id="lk-name" maxlength="24" autocomplete="off" placeholder="예: 네이버" value="' + UI.esc(isNew ? '' : item.name) + '"></div>' +

      '<div class="field"><label for="lk-url">주소</label>' +
        '<input class="input" id="lk-url" type="text" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" ' +
          'placeholder="https://example.com" value="' + UI.esc(isNew ? '' : item.url) + '">' +
        '<div class="helper">https:// 는 자동으로 붙여요</div></div>' +

      '<div class="field"><span class="field-label">아이콘</span>' +
        '<div class="lk-emo-pick" id="lk-emojis">' +
          '<button type="button" class="lk-emo-btn lk-emo-letter' + (emoji ? '' : ' is-on') + '" data-emoji="" aria-label="이름 첫 글자">가</button>' +
          emojiList(emoji).map(function (e) {
            return '<button type="button" class="lk-emo-btn' + (e === emoji ? ' is-on' : '') + '" data-emoji="' + UI.esc(e) + '">' + UI.esc(e) + '</button>';
          }).join('') +
        '</div></div>' +

      '<div class="field"><span class="field-label">색</span>' +
        '<div class="swatches" id="lk-colors">' +
          COLORS.map(function (c) {
            return '<button type="button" class="lk-sw' + (c.v === color ? ' is-on' : '') + '" data-color="' + c.v + '" ' +
              'style="background:' + c.v + '" aria-label="' + c.label + '"></button>';
          }).join('') +
        '</div></div>' +

      '<div class="field"><label for="lk-group">묶음 (선택)</label>' +
        '<input class="input" id="lk-group" maxlength="12" autocomplete="off" placeholder="예: 쇼핑, 금융" value="' + UI.esc(group) + '">' +
        (groupNames().length
          ? '<div class="chips lk-group-chips" id="lk-groups">' + groupNames().map(function (g) {
              return '<button type="button" class="chip" data-group="' + UI.esc(g) + '">' + UI.esc(g) + '</button>';
            }).join('') + '</div>'
          : '<div class="helper">비워 두면 묶지 않고 한 줄로 모여요</div>') +
        '</div>' +

      '<div class="field"><label for="lk-note">메모 (선택)</label>' +
        '<textarea class="input" id="lk-note" rows="2" maxlength="200" placeholder="아이디·용도처럼 기억해 둘 것">' + UI.esc(isNew ? '' : (item.note || '')) + '</textarea></div>' +

      (isNew ? '' :
        '<div class="field"><span class="field-label">순서</span>' +
          '<div class="lk-order">' +
            '<button type="button" data-move="-1">◀ 앞으로</button>' +
            '<span class="lk-order-pos" id="lk-pos"></span>' +
            '<button type="button" data-move="1">뒤로 ▶</button>' +
          '</div></div>');

    const buttons = [
      { label: isNew ? '추가' : '저장', kind: 'primary', submit: true, onClick: function (form) {
          const nameEl = form.querySelector('#lk-name');
          const urlEl = form.querySelector('#lk-url');
          const name = String(nameEl.value || '').trim().replace(/\s+/g, ' ');
          const url = normUrl(urlEl.value);
          if (!name) { UI.toast('이름을 적어 주세요'); nameEl.focus(); return false; }
          if (!url) { UI.toast('주소를 확인해 주세요 · 예: naver.com'); urlEl.focus(); return false; }
          const data = {
            name: name.slice(0, 24),
            url: url,
            emoji: emoji,
            color: color,
            group: String(form.querySelector('#lk-group').value || '').trim().slice(0, 12),
            note: String(form.querySelector('#lk-note').value || '').trim().slice(0, 200)
          };
          if (isNew) {
            Store.add('links', data);
          } else {
            Store.update('links', item.id, data);
          }
          editing = fromEdit;
          render();
          UI.toast(isNew ? '바로가기를 담았어요' : '바로가기를 고쳤어요');
        } },
      { label: '취소', kind: 'ghost' }
    ];

    if (!isNew) {
      buttons.splice(1, 0, { label: '삭제', kind: 'danger', keepOpen: true, onClick: function (form, closeSheet) {
        closeSheet();
        askDelete(item);
      } });
    }

    UI.openSheet({
      title: isNew ? '바로가기 추가' : '바로가기 수정',
      subtitle: isNew ? '이 폰에만 저장돼요' : (hostOf(normUrl(item.url)) || ''),
      body: body,
      buttons: buttons,
      noFocus: !isNew,
      onMount: function (form) {
        const prevIcon = form.querySelector('#lk-prev-icon');
        const prevName = form.querySelector('#lk-prev-name');
        const prevHost = form.querySelector('#lk-prev-host');

        function paint() {
          const name = String(form.querySelector('#lk-name').value || '').trim();
          prevIcon.style.setProperty('--lk', color);
          prevIcon.innerHTML = emoji
            ? '<span class="lk-emo">' + UI.esc(emoji) + '</span>'
            : (name ? '<span class="lk-ch">' + UI.esc(firstChar(name)) + '</span>'
                    : '<span class="lk-emo">🔗</span>');
          prevName.textContent = name || (isNew ? '새 바로가기' : item.name);
        }

        form.querySelector('#lk-name').addEventListener('input', paint);
        form.querySelector('#lk-url').addEventListener('input', function () {
          const h = hostOf(normUrl(this.value));
          prevHost.textContent = h || (this.value.trim() ? '주소를 확인해 주세요' : '아이콘을 눌러 새 탭에서 열려요');
        });

        form.querySelectorAll('#lk-emojis [data-emoji]').forEach(function (b) {
          b.addEventListener('click', function () {
            emoji = b.dataset.emoji || '';
            form.querySelectorAll('#lk-emojis [data-emoji]').forEach(function (x) {
              x.classList.toggle('is-on', (x.dataset.emoji || '') === emoji);
            });
            paint();
          });
        });

        form.querySelectorAll('#lk-colors [data-color]').forEach(function (b) {
          b.addEventListener('click', function () {
            color = b.dataset.color;
            form.querySelectorAll('#lk-colors [data-color]').forEach(function (x) {
              x.classList.toggle('is-on', x.dataset.color === color);
            });
            paint();
          });
        });

        const chips = form.querySelectorAll('#lk-groups [data-group]');
        chips.forEach(function (b) {
          b.addEventListener('click', function () {
            const g = b.dataset.group || '';
            const el = form.querySelector('#lk-group');
            el.value = el.value.trim() === g ? '' : g;
            chips.forEach(function (x) { x.classList.toggle('is-on', x.dataset.group === el.value.trim()); });
          });
        });

        if (!isNew) {
          const posEl = form.querySelector('#lk-pos');
          function paintPos() {
            const secs = sections();
            let label = '';
            secs.forEach(function (s) {
              const i = s.items.findIndex(function (x) { return x.id === item.id; });
              if (i >= 0) label = (i + 1) + ' / ' + s.items.length + (s.title ? ' · ' + s.title : '');
            });
            if (posEl) posEl.textContent = label;
          }
          paintPos();
          form.querySelectorAll('.lk-order [data-move]').forEach(function (b) {
            b.addEventListener('click', function () {
              const ok = moveItem(item.id, Number(b.dataset.move));
              if (!ok) { UI.toast(Number(b.dataset.move) < 0 ? '맨 앞이에요' : '맨 뒤예요'); return; }
              paintPos();
              render();
            });
          });
        }

        paint();
      }
    });
  }

  /* ---------- 이벤트 ---------- */
  function bind() {
    if (!host || bound) return;
    bound = true;

    host.addEventListener('click', function (e) {
      if (pressFired) { pressFired = false; return; }
      const btn = e.target.closest('[data-act]');
      if (!btn || !host.contains(btn)) return;
      const act = btn.dataset.act;

      if (act === 'editing') {
        editing = !editing;
        render();
        if (editing) UI.toast('편집 모드 · ✎ 수정, ✕ 삭제');
        return;
      }
      if (act === 'add') { openEditor(null); return; }

      const cell = btn.closest('.lk-cell[data-id]');
      const item = cell ? findById(cell.dataset.id) : null;
      if (!item) return;

      if (act === 'edit') { openEditor(item); return; }
      if (act === 'del') { askDelete(item); return; }
      if (act === 'open') {
        if (editing) openEditor(item);
        else openSite(item);
      }
    });

    // 길게 누르면 편집 모드
    host.addEventListener('pointerdown', function (e) {
      if (editing) return;
      const cell = e.target.closest('.lk-cell[data-id]');
      if (!cell) return;
      clearTimeout(pressTimer);
      pressFired = false;
      pressTimer = setTimeout(function () {
        pressFired = true;
        editing = true;
        render();
        UI.toast('편집 모드 · ✎ 수정, ✕ 삭제');
        // 길게 누른 뒤 따라오는 클릭 한 번만 무시합니다
        setTimeout(function () { pressFired = false; }, 800);
      }, 520);
    });
    ['pointerup', 'pointercancel', 'pointerleave', 'pointermove'].forEach(function (ev) {
      host.addEventListener(ev, function () { clearTimeout(pressTimer); });
    });
    host.addEventListener('contextmenu', function (e) {
      if (e.target.closest('.lk-cell[data-id]')) e.preventDefault();
    });
  }

  T.links = {
    id: 'links',
    label: '바로가기',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.6 14.4a3.6 3.6 0 0 1 0-5.1l2.6-2.6a3.6 3.6 0 0 1 5.1 5.1l-1.3 1.3"/><path d="M14.4 9.6a3.6 3.6 0 0 1 0 5.1l-2.6 2.6a3.6 3.6 0 0 1-5.1-5.1l1.3-1.3"/></svg>',
    title: '바로가기',
    render: function (root) {
      host = root;
      bind();
      render();
    }
  };
})();
