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

  /* ---------- 일기 잠금 ---------- */
  function lockSectionHTML() {
    const on = Store.lockReady();
    const c = Store.diaryLock();
    const fpOn = !!(c.webauthn && c.webauthn.id);
    const fpSupported = !!(window.DiaryLock && DiaryLock.supported());

    const fpSub = !fpSupported
      ? '이 브라우저에서는 지문을 쓸 수 없어요 · PIN으로 열 수 있어요'
      : (fpOn ? '등록됐어요 · 잠금 화면에서 한 번에 열 수 있어요'
              : '이 기기의 지문으로도 일기를 열 수 있게 해요');

    return '' +
      '<div class="sec-head"><h2>일기 잠금</h2><span class="sub">4자리 비밀번호 · 지문</span></div>' +
      '<div class="set-card">' +
        '<div class="set-row lock-row">' +
          '<span class="sicon">🔒</span>' +
          '<span class="stext"><span class="stitle">일기 잠금</span>' +
            '<span class="ssub">' + (on ? '켜짐 · 일기 탭을 열 때 비밀번호를 물어보아요' : '꺼짐 · 지금은 누구나 일기를 볼 수 있어요') + '</span></span>' +
          '<button type="button" class="pin-toggle mini' + (on ? ' is-on' : '') + '" id="lock-toggle" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="일기 잠금"><span class="sw"></span></button>' +
        '</div>' +
        '<button type="button" class="set-row" id="btn-pin">' +
          '<span class="sicon">🔢</span><span class="stext"><span class="stitle">' + (on ? '비밀번호 바꾸기' : '비밀번호 만들기') + '</span>' +
          '<span class="ssub">' + (on ? '지금 쓰는 4자리를 확인한 뒤 새 4자리로 바꿔요' : '숫자 4자리를 정하면 잠금을 켜요') + '</span></span><span class="chev">›</span>' +
        '</button>' +
        '<div class="set-row lock-row' + (fpSupported && on ? '' : ' is-disabled') + '">' +
          '<span class="sicon">👆</span><span class="stext"><span class="stitle">지문으로 열기</span>' +
          '<span class="ssub">' + (on ? fpSub : '일기 잠금을 먼저 켜 주세요') + '</span></span>' +
          (fpSupported && on
            ? '<button type="button" class="pin-toggle mini' + (fpOn ? ' is-on' : '') + '" id="fp-toggle" role="switch" aria-checked="' + (fpOn ? 'true' : 'false') + '" aria-label="지문으로 열기"><span class="sw"></span></button>'
            : '<span class="chev" aria-hidden="true">' + (fpSupported ? '' : '·') + '</span>') +
        '</div>' +
        (fpOn ? '<button type="button" class="set-row" id="btn-fp-again">' +
          '<span class="sicon">🔄</span><span class="stext"><span class="stitle">지문 다시 등록</span>' +
          '<span class="ssub">기기를 바꿔서 지문이 열리지 않을 때 눌러 주세요</span></span><span class="chev">›</span></button>' : '') +
        (on ? '<button type="button" class="set-row danger" id="btn-lock-off">' +
          '<span class="sicon">🔓</span><span class="stext"><span class="stitle">잠금 끄기</span>' +
          '<span class="ssub">비밀번호를 확인한 뒤 잠금을 끄고 지문 등록도 지워요</span></span><span class="chev">›</span></button>' : '') +
      '</div>' +
      '<div class="info-box lock-note">' +
        '이 잠금은 <b>화면을 가리는 잠금</b>이에요. 폰 안 브라우저 저장소의 일기를 암호화하지는 않아요.' +
        '<div class="tiny">비밀번호를 잊으면 앱에서 일기를 열 수 없어요. 꼭 기억해 두시고, 폰을 바꾸기 전에는 백업 파일을 따로 보관해 주세요.</div>' +
      '</div>';
  }

  function onlyDigits(input) {
    if (!input) return;
    input.addEventListener('input', function () {
      input.value = String(input.value).replace(/[^0-9]/g, '').slice(0, 4);
    });
  }

  // needCurrent: 지금 비밀번호를 먼저 확인할지
  function openPinSheet(opts) {
    const o = opts || {};
    const body = '' +
      (o.needCurrent ? '<div class="field"><label>지금 비밀번호</label>' +
        '<input class="input pin-input" name="cur" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="숫자 4자리"></div>' : '') +
      '<div class="field"><label>' + (o.needCurrent ? '새 비밀번호' : '비밀번호 (4자리)') + '</label>' +
        '<input class="input pin-input" name="pin1" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="숫자 4자리"></div>' +
      '<div class="field"><label>한 번 더</label>' +
        '<input class="input pin-input" name="pin2" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="같은 숫자 4자리"></div>' +
      '<div class="helper">잊으면 앱에서 잠금을 풀 수 없어요. 꼭 기억해 주세요.</div>';

    UI.openSheet({
      title: o.title || '일기 비밀번호',
      body: body,
      buttons: [
        { label: o.confirmLabel || '저장', kind: 'primary', submit: true, onClick: function (form) {
            if (o.needCurrent) {
              const cur = form.querySelector('input[name="cur"]').value;
              if (!Store.checkDiaryPin(cur)) { UI.toast('지금 비밀번호가 맞지 않아요'); return false; }
            }
            const p1 = form.querySelector('input[name="pin1"]').value;
            const p2 = form.querySelector('input[name="pin2"]').value;
            if (!/^\d{4}$/.test(p1)) { UI.toast('숫자 4자리를 눌러 주세요'); return false; }
            if (p1 !== p2) { UI.toast('두 번 넣은 숫자가 달라요'); return false; }
            Store.setDiaryPin(p1);
            if (window.DiaryLock) DiaryLock.lock();
            render();
            UI.toast(o.doneMessage || '비밀번호를 정했어요 · 일기 잠금을 켰어요');
          } },
        { label: '취소', kind: 'ghost' }
      ],
      onMount: function (form) {
        form.querySelectorAll('input.pin-input').forEach(onlyDigits);
      }
    });
  }

  function askPinThen(opts) {
    UI.openSheet({
      title: opts.title,
      body: '<div class="field"><label>지금 비밀번호</label>' +
        '<input class="input pin-input" name="cur" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="숫자 4자리"></div>' +
        (opts.helper ? '<div class="helper">' + opts.helper + '</div>' : ''),
      buttons: [
        { label: opts.confirmLabel || '확인', kind: 'primary', submit: true, onClick: function (form) {
            const cur = form.querySelector('input[name="cur"]').value;
            if (!Store.checkDiaryPin(cur)) { UI.toast('비밀번호가 맞지 않아요'); return false; }
            opts.onOk();
          } },
        { label: '취소', kind: 'ghost' }
      ],
      onMount: function (form) { form.querySelectorAll('input.pin-input').forEach(onlyDigits); }
    });
  }

  function bindLock() {
    const lockToggle = host.querySelector('#lock-toggle');
    if (lockToggle) {
      lockToggle.addEventListener('click', function () {
        if (Store.lockReady()) {
          askPinThen({
            title: '일기 잠금을 끌까요?',
            confirmLabel: '잠금 끄기',
            helper: '잠금을 끄면 지문 등록도 함께 지워집니다.',
            onOk: function () {
              Store.setDiaryLockEnabled(false);
              if (window.DiaryLock) DiaryLock.unlock();
              UI.toast('일기 잠금을 껐어요');
              render();
            }
          });
        } else {
          openPinSheet({ title: '일기 비밀번호 만들기' });
        }
      });
    }

    const pinBtn = host.querySelector('#btn-pin');
    if (pinBtn) {
      pinBtn.addEventListener('click', function () {
        if (Store.lockReady()) {
          openPinSheet({ title: '일기 비밀번호 바꾸기', needCurrent: true, doneMessage: '비밀번호를 바꿨어요' });
        } else {
          openPinSheet({ title: '일기 비밀번호 만들기' });
        }
      });
    }

    const lockOff = host.querySelector('#btn-lock-off');
    if (lockOff) {
      lockOff.addEventListener('click', function () {
        askPinThen({
          title: '잠금을 끝낼까요?',
          confirmLabel: '잠금 끄기',
          helper: '비밀번호와 지문 등록이 모두 지워집니다.',
          onOk: function () {
            Store.clearDiaryLock();
            if (window.DiaryLock) DiaryLock.unlock();
            UI.toast('일기 잠금을 껐어요');
            render();
          }
        });
      });
    }

    const fpToggle = host.querySelector('#fp-toggle');
    if (fpToggle) {
      fpToggle.addEventListener('click', function () {
        const c = Store.diaryLock();
        if (c.webauthn && c.webauthn.id) {
          Store.setDiaryWebauthn(null);
          UI.toast('지문 등록을 해제했어요 · PIN으로 열 수 있어요');
          render();
          return;
        }
        // 지문은 사용자가 누른 바로 그 클릭 안에서 요청해야 해요.
        DiaryLock.registerFingerprint().then(function (r) {
          if (r.ok) {
            UI.toast('지문을 등록했어요');
            render();
          } else {
            UI.toast(r.message || '지문을 등록하지 못했어요');
          }
        });
      });
    }

    const fpAgain = host.querySelector('#btn-fp-again');
    if (fpAgain) {
      fpAgain.addEventListener('click', function () {
        DiaryLock.registerFingerprint().then(function (r) {
          if (r.ok) { UI.toast('지문을 다시 등록했어요'); render(); }
          else UI.toast(r.message || '지문을 등록하지 못했어요');
        });
      });
    }
  }

  function exportJSON() {
    // 일기 잠금이 켜져 있으면 백업 파일을 내보내기 전에 비밀번호를 확인합니다.
    if (window.DiaryLock && Store.lockReady() && DiaryLock.isLocked()) {
      askPinThen({
        title: '백업을 내보낼까요?',
        confirmLabel: '내보내기',
        helper: '백업 파일에는 일기 내용도 함께 담겨요.',
        onOk: function () { exportJSONNow(); }
      });
      return;
    }
    exportJSONNow();
  }

  function exportJSONNow() {
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
      lockSectionHTML() +
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

    bindLock();

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
