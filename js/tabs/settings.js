/* =========================================================
   tabs/settings.js — 설정 · 데이터 관리(백업/복원)
   ========================================================= */
(function () {
  'use strict';
  const T = (window.Tabs = window.Tabs || {});
  let host = null;

  function countOf(payload) {
    const src = payload && payload.data ? payload.data : payload;
    const out = { schedule: 0, finance: 0, card: 0, memo: 0, page: 0, diary: 0, dream: 0 };
    if (!src || typeof src !== 'object') return out;
    Object.keys(out).forEach(function (k) {
      const key = Store.COLLECTIONS[k].key;
      const arr = src[k] && src[k][key];
      out[k] = Array.isArray(arr) ? arr.length : 0;
    });
    return out;
  }

  /* ---------- 테마 ---------- */
  function themeSectionHTML() {
    const cur = Theme.current();
    return '' +
      '<div class="sec-head"><h2>테마 색상</h2><span class="sub">내 마음대로</span></div>' +
      '<div class="set-card theme-set">' +
        '<div class="theme-inline">' +
          Theme.PRESETS.map(function (p) {
            return '<button type="button" class="ti-dot' + (p.id === cur.preset ? ' is-on' : '') + '" data-preset="' + p.id + '" ' +
              'style="--tc:' + p.accent + '" aria-label="' + p.label + '">' + p.emoji + '</button>';
          }).join('') +
          '<label class="ti-custom" title="직접 고르기">' +
            '<input type="color" id="settings-color" value="' + cur.accent + '" aria-label="직접 고를 색">' +
            '<span>＋</span>' +
          '</label>' +
        '</div>' +
        '<div class="theme-inline-cap" id="theme-inline-cap">지금은 <b>' + themeName(cur) + '</b> 테마예요 · 오른쪽 위 🎨에서 크게 볼 수 있어요</div>' +
      '</div>';
  }

  function themeName(cur) {
    if (cur.preset === 'custom') return '내가 고른 색';
    const p = Theme.PRESETS.find(function (x) { return x.id === cur.preset; });
    return p ? p.label : '기본';
  }

  function exportJSON() {
    try {
      const payload = Store.exportPayload();
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '다이어리-백업-' + UI.todayISO() + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      UI.toast('백업 파일을 내려받았어요 (다운로드 폴더)');
    } catch (e) {
      console.warn(e);
      UI.toast('백업 파일을 만들지 못했어요');
    }
  }

  function pickFile() {
    const input = host.querySelector('#import-file');
    if (input) input.click();
  }

  function handleFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      let payload;
      try {
        payload = JSON.parse(String(reader.result));
      } catch (e) {
        UI.toast('백업 파일을 읽지 못했어요. JSON 파일인지 확인해 주세요.');
        return;
      }
      askImport(payload);
    };
    reader.onerror = function () { UI.toast('파일을 열지 못했어요'); };
    reader.readAsText(file);
    input.value = '';
  }

  function askImport(payload) {
    const c = countOf(payload);
    const total = c.schedule + c.finance + c.card + c.memo + c.page + c.diary + c.dream;
    if (!total) {
      UI.toast('백업 파일에 담긴 내용이 없어요');
      return;
    }
    UI.openDialog({
      title: '백업을 불러올까요?',
      html: '이 파일에는 일정 <b>' + c.schedule + '</b> · 가계부 <b>' + c.finance + '</b> · 카드 <b>' + c.card + '</b> · 메모 <b>' + c.memo + '</b> · 다이어리 <b>' + c.page + '장</b> · 일기 <b>' + c.diary + '</b> · 꿈 <b>' + c.dream + '</b>개가 들어 있어요.<br><br>' +
        '<b>합치기</b>는 지금 내용을 두고 겹치지 않는 것만 더해요.<br>' +
        '<b>덮어쓰기</b>는 지금 내용을 모두 지우고 파일 내용으로 바꿔요.',
      buttons: [
        { label: '취소', kind: 'ghost' },
        { label: '합치기', kind: 'primary', onClick: function () { doImport(payload, 'merge'); } },
        { label: '덮어쓰기', kind: 'danger', onClick: function () { doImport(payload, 'replace'); } }
      ]
    });
  }

  function doImport(payload, mode) {
    try {
      const r = Store.importPayload(payload, mode);
      UI.toast(mode === 'replace' ? '백업으로 되돌렸어요 (' + r.added + '개)' : r.added + '개를 더했어요');
      render();
    } catch (e) {
      console.warn(e);
      UI.toast(e.message || '불러오지 못했어요');
    }
  }

  function render() {
    if (!host) return;
    const c = Store.counts();
    const sample = Store.sampleCount();
    const kb = (Store.storageBytes() / 1024).toFixed(1);
    const saved = Store.state.settings.updatedAt;

    host.innerHTML = '' +
      themeSectionHTML() +
      '<div class="sec-head"><h2>데이터 관리</h2><span class="sub">폰을 바꿀 때 꼭 백업</span></div>' +
      '<div class="set-card">' +
        '<button type="button" class="set-row" id="btn-export">' +
          '<span class="sicon">⬇️</span><span class="stext"><span class="stitle">JSON으로 백업 내보내기</span>' +
          '<span class="ssub">일정·가계부·카드·메모·다이어리·일기·꿈을 파일 하나로</span></span><span class="chev">›</span>' +
        '</button>' +
        '<button type="button" class="set-row" id="btn-import">' +
          '<span class="sicon">⬆️</span><span class="stext"><span class="stitle">백업 불러오기</span>' +
          '<span class="ssub">내려받아 둔 JSON 파일을 그대로 복원해요</span></span><span class="chev">›</span>' +
        '</button>' +
        '<button type="button" class="set-row" id="btn-clear-sample" ' + (sample ? '' : 'disabled') + '>' +
          '<span class="sicon">🧹</span><span class="stext"><span class="stitle">샘플 데이터 지우기</span>' +
          '<span class="ssub">' + (sample ? '예시로 넣은 ' + sample + '개만 지워요' : '지울 샘플 데이터가 없어요') + '</span></span><span class="chev">›</span>' +
        '</button>' +
        '<button type="button" class="set-row danger" id="btn-reset">' +
          '<span class="sicon">🗑️</span><span class="stext"><span class="stitle">모든 데이터 지우기</span>' +
          '<span class="ssub">처음 상태로 되돌려요 (되돌릴 수 없어요)</span></span><span class="chev">›</span>' +
        '</button>' +
        '<input type="file" id="import-file" accept="application/json,.json" style="display:none">' +
      '</div>' +

      '<div class="sec-head"><h2>저장된 내용</h2><span class="sub">이 폰의 브라우저에만</span></div>' +
      '<div class="counts-grid">' +
        '<div class="count-cell"><b>' + c.schedule + '</b><span>일정</span></div>' +
        '<div class="count-cell"><b>' + c.finance + '</b><span>가계부</span></div>' +
        '<div class="count-cell"><b>' + c.card + '</b><span>카드</span></div>' +
        '<div class="count-cell"><b>' + c.memo + '</b><span>메모</span></div>' +
        '<div class="count-cell"><b>' + Store.writtenPages() + '</b><span>다이어리</span></div>' +
        '<div class="count-cell"><b>' + c.diary + '</b><span>일기</span></div>' +
        '<div class="count-cell"><b>' + c.dream + '</b><span>꿈</span></div>' +
      '</div>' +
      '<div class="info-box" style="margin-top:10px">' +
        '저장 위치: 이 기기의 브라우저 저장소 (localStorage)<br>' +
        '마지막 저장: ' + (saved ? UI.relTime(saved) : '아직 없음') + ' · ' + kb + ' KB' +
      '</div>' +

      '<div class="sec-head"><h2>홈 화면에 추가</h2><span class="sub">앱처럼 쓰기</span></div>' +
      '<div class="info-box">' +
        '<b>안드로이드 크롬</b>' +
        '<ol>' +
          '<li>이 페이지를 크롬으로 엽니다 (인터넷 주소가 있어야 해요)</li>' +
          '<li>오른쪽 위 ⋮ 메뉴 → <b>홈 화면에 추가</b></li>' +
          '<li>이름을 확인하고 추가하면 아이콘이 생겨요</li>' +
        '</ol>' +
        '<div class="tiny">인터넷이 잠깐 끊겨도 열리도록 만들어 두었어요. 데이터는 서버로 보내지 않고 이 폰에만 저장돼요.</div>' +
      '</div>' +

      '<div class="sec-head"><h2>앱 정보</h2></div>' +
      '<div class="info-box">' +
        '<b>나의 다이어리</b> v' + Store.APP_VERSION + '<br>' +
        '일정 · 가계부 · 메모 · 일기 · 꿈을 한곳에 모은 개인용 웹앱이에요.' +
        '<div class="tiny">새 탭(예: 운동 기록, 카드 실적)은 js/tabs 폴더에 파일을 하나 더하면 붙일 수 있게 만들어 두었어요.</div>' +
      '</div>' +
      '<div class="app-foot">매일의 기록이 차곡차곡 쌓이기를 🌿</div>';

    if (window.App && App.setSubtitle) App.setSubtitle('데이터 백업과 앱 설정');

    bind();
  }

  function bind() {
    // 테마 프리셋·직접 고르기 (설정 화면에서 바로)
    host.querySelectorAll('.ti-dot').forEach(function (b) {
      b.addEventListener('click', function () {
        Theme.setPreset(b.dataset.preset);
        host.querySelectorAll('.ti-dot').forEach(function (x) {
          x.classList.toggle('is-on', x.dataset.preset === b.dataset.preset);
        });
        const cap = host.querySelector('#theme-inline-cap');
        if (cap) cap.innerHTML = '지금은 <b>' + themeName(Theme.current()) + '</b> 테마예요 · 오른쪽 위 🎨에서 크게 볼 수 있어요';
        UI.toast(Theme.presetOf(b.dataset.preset).label + ' 테마로 바꿨어요');
      });
    });
    const colorEl = host.querySelector('#settings-color');
    if (colorEl) {
      colorEl.addEventListener('input', function () {
        Theme.setCustom(colorEl.value);
        host.querySelectorAll('.ti-dot').forEach(function (x) { x.classList.remove('is-on'); });
        const cap = host.querySelector('#theme-inline-cap');
        if (cap) cap.innerHTML = '지금은 <b>내가 고른 색</b> 테마예요 (' + String(colorEl.value).toUpperCase() + ')';
      });
    }

    host.querySelector('#btn-export').addEventListener('click', exportJSON);
    host.querySelector('#btn-import').addEventListener('click', pickFile);
    host.querySelector('#import-file').addEventListener('change', function () { handleFile(this); });

    const cs = host.querySelector('#btn-clear-sample');
    if (cs && !cs.disabled) {
      cs.addEventListener('click', function () {
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

    host.querySelector('#btn-reset').addEventListener('click', function () {
      UI.confirmDialog({
        title: '모든 데이터를 지울까요?',
        message: '일정 ' + Store.counts().schedule + '개, 가계부 ' + Store.counts().finance + '개, 카드 ' + Store.counts().card + '장, 메모 ' + Store.counts().memo + '개, 다이어리 ' + Store.writtenPages() + '장, 일기 ' + Store.counts().diary + '개, 꿈 ' + Store.counts().dream + '개가 모두 사라져요. 먼저 백업해 두는 것을 권해요.',
        confirmLabel: '모두 지우기',
        danger: true,
        onConfirm: function () {
          Store.reset();
          UI.toast('모든 데이터를 지웠어요');
          render();
        }
      });
    });
  }

  T.settings = {
    id: 'settings',
    label: '설정',
    icon: '',
    title: '설정',
    render: function (root) {
      host = root;
      render();
    },
    refresh: function () {
      if (host) render();
    }
  };
})();
