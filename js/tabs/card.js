/* =========================================================
   tabs/card.js — 카드
   카드사별 카드의 혜택·실적·결제일·만기일을 한곳에.
   혜택 캡처는 여러 장 붙이고, 누르면 크게 볼 수 있어요.
   ========================================================= */
(function () {
  'use strict';
  const T = (window.Tabs = window.Tabs || {});

  const ICON = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4.2-1 9.3-9.3a2.1 2.1 0 0 0-3-3L5.2 16z"/><path d="M14.2 6.8l3 3"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  const ISSUERS = [
    { name: '신한', color: '#0046FF' },
    { name: '국민', color: '#F5A800' },
    { name: '우리', color: '#0067AC' },
    { name: '하나', color: '#008485' },
    { name: 'NH농협', color: '#00A19C' },
    { name: 'BC', color: '#E4002B' },
    { name: '롯데', color: '#D6002F' },
    { name: '케이뱅크', color: '#222222' },
    { name: '네이버페이', color: '#03C75A' },
    { name: '삼성', color: '#1428A0' },
    { name: '현대', color: '#E60012' },
    { name: '우체국', color: '#E8442E' }
  ];

  let host = null;

  function cards() {
    return Store.all('card').slice().sort(function (a, b) {
      const pa = Number(a.current || 0) / (Number(a.target || 0) || 1);
      const pb = Number(b.current || 0) / (Number(b.target || 0) || 1);
      if (pa >= 1 !== pb >= 1) return pa >= 1 ? 1 : -1;   // 아직 못 채운 카드부터
      return String(a.issuer || '').localeCompare(String(b.issuer || ''), 'ko');
    });
  }

  function colorOf(c) { return c.color || '#7C7C7C'; }

  function progressOf(c) {
    const t = Number(c.target || 0), cur = Number(c.current || 0);
    if (!t) return { pct: 0, remain: 0, done: false, hasTarget: false };
    const pct = Math.min(100, Math.round((cur / t) * 100));
    return { pct: pct, remain: Math.max(0, t - cur), done: cur >= t, hasTarget: true };
  }

  /* ---------- 카드 한 장 ---------- */
  function cardHTML(c) {
    const p = progressOf(c);
    const color = colorOf(c);
    const photos = c.photos || [];
    const metaBits = [];
    if (c.payDay) metaBits.push('결제일 ' + UI.esc(c.payDay));
    if (c.expiry) metaBits.push('만기 ' + UI.esc(c.expiry));

    const thumbs = photos.map(function (src, i) {
      return '<button type="button" class="cc-thumb" data-photo="' + i + '" aria-label="혜택 캡처 ' + (i + 1) + ' 크게 보기">' +
        '<img src="' + src + '" alt="" loading="lazy">' +
      '</button>';
    }).join('');

    return '' +
      '<article class="cc" data-id="' + c.id + '" style="--cc:' + color + '">' +
        '<div class="cc-face">' +
          '<div class="cc-face-top">' +
            '<span class="cc-issuer">' + UI.esc(c.issuer || '카드') + '</span>' +
            '<button type="button" class="cc-edit" data-act="edit" aria-label="카드 고치기">' + ICON.pen + '</button>' +
          '</div>' +
          '<div class="cc-name">' + UI.esc(c.name || '이름 없는 카드') + '</div>' +
          '<div class="cc-meta">' + (metaBits.length ? metaBits.join(' · ') : '결제일·만기 적어 두기') + '</div>' +
          '<i class="cc-shine"></i>' +
        '</div>' +
        '<div class="cc-body">' +
          '<div class="cc-prog">' +
            '<div class="cc-prog-line">' +
              '<span class="k">실적</span>' +
              (p.hasTarget
                ? '<span class="v"><b>' + UI.fmtWon(c.current) + '</b> / ' + UI.fmtWon(c.target) + '</span>'
                : '<span class="v muted">목표를 정해 두면 채운 만큼 보여요</span>') +
            '</div>' +
            (p.hasTarget ? '<div class="cc-bar"><i style="width:' + p.pct + '%"></i></div>' : '') +
            (p.hasTarget
              ? '<div class="cc-remain"><span>' + (p.done ? '<b class="done">실적 달성 🎉</b>' : '<b>' + UI.fmtWon(p.remain) + '</b> 남았어요') + '</span><span>' + p.pct + '%</span></div>'
              : '') +
          '</div>' +
          (c.benefits ? '<p class="cc-benefit">' + UI.esc(c.benefits) + '</p>' : '') +
          '<div class="cc-photos">' + thumbs +
            '<button type="button" class="cc-addphoto" data-act="photo">' + ICON.plus + '<span>혜택 캡처</span></button>' +
          '</div>' +
          '<div class="cc-actions">' +
            '<button type="button" data-act="spend">＋ 실적 채우기</button>' +
            '<button type="button" data-act="edit">수정</button>' +
          '</div>' +
        '</div>' +
        '<input type="file" class="cc-file" accept="image/*" multiple hidden>' +
      '</article>';
  }

  function render() {
    if (!host) return;
    const list = cards();
    const unmet = list.filter(function (c) { return !progressOf(c).done; }).length;

    host.innerHTML = '' +
      '<div class="sec-head"><h2>내 카드 ' + list.length + '장</h2>' +
        '<span class="sub">' + (unmet ? unmet + '장 실적 남음' : '실적 모두 채웠어요') + '</span></div>' +
      (list.length
        ? '<div class="cc-list">' + list.map(cardHTML).join('') + '</div>'
        : '<div class="empty"><span class="emo">💳</span>아직 담아 둔 카드가 없어요.<br>아래 ＋ 카드로 첫 카드를 담아 보세요.</div>') +
      '<p class="cc-hint">혜택 캡처를 눌러 크게 보고, 손가락으로 좌우 넘겨 다음 장을 볼 수 있어요.</p>';

    if (window.App && App.setSubtitle) {
      App.setSubtitle(list.length ? '카드 ' + list.length + '장 · ' + (unmet ? unmet + '장 실적 채우는 중' : '실적 완료') : '카드 혜택과 실적을 모아 두세요');
    }
    if (window.App && App.showFab) App.showFab({ label: '카드', onClick: function () { openEditor(null); } });

    bind();
  }

  function bind() {
    host.querySelectorAll('.cc').forEach(function (el) {
      const id = el.dataset.id;
      const c = Store.find('card', id);
      if (!c) return;

      el.querySelectorAll('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          const act = btn.dataset.act;
          if (act === 'edit') openEditor(c);
          else if (act === 'spend') openSpend(c);
          else if (act === 'photo') {
            const input = el.querySelector('.cc-file');
            if (input) input.click();
          }
        });
      });

      const file = el.querySelector('.cc-file');
      if (file) {
        file.addEventListener('change', function () {
          const files = Array.prototype.slice.call(file.files || []);
          if (!files.length) return;
          UI.toast(files.length + '장을 넣는 중…');
          resizeAll(files).then(function (urls) {
            const cur = Store.find('card', id);
            file.value = '';
            if (!cur) return;
            Store.update('card', id, { photos: (cur.photos || []).concat(urls) });
            render();
            UI.toast(urls.length + '장을 담았어요');
          }).catch(function () {
            file.value = '';
            UI.toast('사진을 넣지 못했어요');
          });
        });
      }

      el.querySelectorAll('[data-photo]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          const cur = Store.find('card', id);
          if (!cur) return;
          openLightbox(cur.photos || [], Number(b.dataset.photo), cur.name || '');
        });
      });
    });
  }

  // 사진 여러 장을 줄여서 dataURL 목록으로 돌려줍니다.
  function resizeAll(files) {
    const out = [];
    let i = 0;
    return new Promise(function (resolve, reject) {
      function next() {
        if (i >= files.length) { resolve(out); return; }
        UI.resizeImage(files[i++], 1400, 0.78).then(function (res) {
          out.push(res.dataUrl);
          next();
        }).catch(reject);
      }
      next();
    });
  }

  /* ---------- 라이트박스 ---------- */
  function openLightbox(photos, start, title) {
    if (!photos.length) return;
    let idx = Math.max(0, Math.min(photos.length - 1, start || 0));

    const box = document.createElement('div');
    box.className = 'lb';
    box.innerHTML = '' +
      '<div class="lb-top">' +
        '<span class="lb-count"></span>' +
        '<button type="button" class="lb-close" aria-label="닫기">' + ICON.close + '</button>' +
      '</div>' +
      '<div class="lb-stage"><img alt="' + UI.esc(title) + ' 혜택 캡처"></div>' +
      '<div class="lb-bar">' +
        '<button type="button" class="lb-prev" aria-label="이전 사진">◀</button>' +
        '<span class="lb-title">' + UI.esc(title) + '</span>' +
        '<button type="button" class="lb-next" aria-label="다음 사진">▶</button>' +
      '</div>';
    document.body.appendChild(box);
    document.documentElement.classList.add('lb-open');

    const img = box.querySelector('img');
    const count = box.querySelector('.lb-count');

    function paint() {
      img.src = photos[idx];
      count.textContent = (idx + 1) + ' / ' + photos.length;
      box.querySelector('.lb-prev').disabled = idx === 0;
      box.querySelector('.lb-next').disabled = idx >= photos.length - 1;
    }

    function close() {
      box.remove();
      document.documentElement.classList.remove('lb-open');
      document.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft' && idx > 0) { idx--; paint(); }
      if (e.key === 'ArrowRight' && idx < photos.length - 1) { idx++; paint(); }
    }

    box.querySelector('.lb-close').addEventListener('click', close);
    box.querySelector('.lb-prev').addEventListener('click', function () { if (idx > 0) { idx--; paint(); } });
    box.querySelector('.lb-next').addEventListener('click', function () { if (idx < photos.length - 1) { idx++; paint(); } });
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.classList.contains('lb-stage')) close();
    });

    let sx = 0;
    box.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - sx;
      if (Math.abs(dx) < 50) return;
      if (dx < 0 && idx < photos.length - 1) { idx++; paint(); }
      if (dx > 0 && idx > 0) { idx--; paint(); }
    });

    document.addEventListener('keydown', onKey);
    paint();
  }

  /* ---------- 실적 채우기 ---------- */
  function openSpend(card) {
    UI.openSheet({
      title: '실적 채우기',
      subtitle: card.name + ' · 지금 ' + UI.fmtWon(card.current || 0),
      body: '<div class="field"><label>이번에 쓴 금액</label>' +
        '<div class="amount-wrap">' +
          '<input class="input amount-input" id="spend-amount" inputmode="numeric" autocomplete="off" aria-label="금액">' +
          '<span class="amount-unit">원</span>' +
        '</div>' +
        '<div class="helper">더한 금액은 카드의 현재 실적에 바로 반영돼요.</div>' +
      '</div>',
      buttons: [
        { label: '더하기', kind: 'primary', submit: true, onClick: function (form) {
            const add = UI.parseAmount(form.querySelector('#spend-amount').value);
            if (!add) { form.querySelector('#spend-amount').focus(); UI.toast('금액을 적어 주세요'); return false; }
            Store.update('card', card.id, { current: Number(card.current || 0) + add });
            render();
            UI.toast(UI.fmtWon(add) + ' 더했어요');
          } },
        { label: '취소', kind: 'ghost' }
      ],
      onMount: function (form) {
        UI.bindAmount(form.querySelector('#spend-amount'));
      }
    });
  }

  /* ---------- 카드 추가·수정 ---------- */
  function openEditor(card) {
    const isNew = !card;
    let color = isNew ? ISSUERS[0].color : colorOf(card);
    let photos = isNew ? [] : (card.photos || []).slice();

    const body = '' +
      '<div class="field">' +
        '<div class="chips" id="issuer-seg">' +
          ISSUERS.map(function (i) {
            const on = isNew ? i.name === '신한' : (card.issuer || '') === i.name;
            return '<button type="button" class="issuer-chip' + (on ? ' is-on' : '') + '" data-issuer="' + i.name + '" data-color="' + i.color + '" ' +
              'style="--ic:' + i.color + '">' + i.name + '</button>';
          }).join('') +
        '</div>' +
        '<input class="input" id="card-issuer" placeholder="카드사 (직접 입력)" maxlength="20" value="' + UI.esc(isNew ? '신한' : (card.issuer || '')) + '" style="margin-top:8px">' +
      '</div>' +
      '<div class="field"><label>카드 이름</label>' +
        '<input class="input" id="card-name" maxlength="40" placeholder="예: ○○카드" value="' + UI.esc(isNew ? '' : (card.name || '')) + '">' +
      '</div>' +
      '<div class="field"><span class="field-label">카드 색</span>' +
        '<div class="color-row">' +
          ISSUERS.map(function (i) {
            return '<button type="button" class="color-dot' + (i.color === color ? ' is-on' : '') + '" data-color="' + i.color + '" ' +
              'style="background:' + i.color + '" aria-label="' + i.name + ' 색"></button>';
          }).join('') +
          '<input type="color" id="card-color" class="color-input" value="' + color + '" aria-label="직접 색 고르기">' +
        '</div>' +
      '</div>' +
      '<div class="field"><label>실적 (목표 / 지금까지)</label>' +
        '<div class="two-col">' +
          '<div class="amount-wrap"><input class="input amount-input" id="card-target" inputmode="numeric" placeholder="목표" value="' + (isNew ? '300,000' : (Number(card.target || 0) ? Number(card.target).toLocaleString('ko-KR') : '')) + '"><span class="amount-unit">원</span></div>' +
          '<div class="amount-wrap"><input class="input amount-input" id="card-current" inputmode="numeric" placeholder="채운 금액" value="' + (isNew ? '0' : (Number(card.current || 0) ? Number(card.current).toLocaleString('ko-KR') : '')) + '"><span class="amount-unit">원</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="field"><label>결제일 · 만기일 (선택)</label>' +
        '<div class="two-col">' +
          '<input class="input" id="card-pay" placeholder="결제일 25일" maxlength="16" value="' + UI.esc(isNew ? '' : (card.payDay || '')) + '">' +
          '<input class="input" id="card-exp" placeholder="만기 11/28" maxlength="16" value="' + UI.esc(isNew ? '' : (card.expiry || '')) + '">' +
        '</div>' +
      '</div>' +
      '<div class="field"><label>혜택 · 주의사항 메모</label>' +
        '<textarea class="input" id="card-benefit" rows="4" maxlength="600" placeholder="예: 여행·숙박 5% 적립, 해외 결제 수수료 무료 · 실적 30만원">' + UI.esc(isNew ? '' : (card.benefits || '')) + '</textarea>' +
      '</div>' +
      '<div class="field"><span class="field-label">혜택 캡처 (' + photos.length + '장)</span>' +
        '<div class="edit-photos" id="edit-photos"></div>' +
        '<button type="button" class="mini-btn terra" id="add-photos">📷 사진 여러 장 넣기</button>' +
        '<input type="file" id="photo-input" accept="image/*" multiple hidden>' +
        '<div class="helper">사진은 폰 화면에 맞게 자동으로 줄여서 저장하고, 백업 파일에도 함께 담겨요.</div>' +
      '</div>';

    const buttons = [
      { label: isNew ? '추가' : '저장', kind: 'primary', submit: true, onClick: function (form) {
          const name = form.querySelector('#card-name').value.trim();
          const issuer = form.querySelector('#card-issuer').value.trim();
          if (!name) { form.querySelector('#card-name').focus(); UI.toast('카드 이름을 적어 주세요'); return false; }
          const row = {
            issuer: issuer || '카드',
            name: name,
            color: color,
            target: UI.parseAmount(form.querySelector('#card-target').value),
            current: UI.parseAmount(form.querySelector('#card-current').value),
            payDay: form.querySelector('#card-pay').value.trim(),
            expiry: form.querySelector('#card-exp').value.trim(),
            benefits: form.querySelector('#card-benefit').value.trim(),
            photos: photos
          };
          if (isNew) Store.add('card', row);
          else Store.update('card', card.id, row);
          render();
          UI.toast(isNew ? '카드를 담았어요' : '저장했어요');
        } },
      { label: '취소', kind: 'ghost' }
    ];
    if (!isNew) {
      buttons.splice(1, 0, { label: '삭제', kind: 'danger', keepOpen: true, onClick: function (form, closeSheet) {
        closeSheet();
        UI.confirmDialog({
          title: '이 카드를 지울까요?',
          message: '“' + (card.name || '카드') + '” 정보와 혜택 캡처가 함께 사라져요.',
          confirmLabel: '삭제',
          danger: true,
          onConfirm: function () {
            Store.remove('card', card.id);
            render();
            UI.toast('지웠어요');
          }
        });
      } });
    }

    UI.openSheet({
      title: isNew ? '카드 담기' : '카드 고치기',
      body: body,
      buttons: buttons,
      noFocus: !isNew,
      onMount: function (form) {
        const issuerInput = form.querySelector('#card-issuer');
        const colorInput = form.querySelector('#card-color');
        const photoBox = form.querySelector('#edit-photos');
        const fileInput = form.querySelector('#photo-input');

        form.querySelectorAll('#issuer-seg [data-issuer]').forEach(function (b) {
          b.addEventListener('click', function () {
            form.querySelectorAll('#issuer-seg [data-issuer]').forEach(function (x) { x.classList.remove('is-on'); });
            b.classList.add('is-on');
            issuerInput.value = b.dataset.issuer;
            color = b.dataset.color;
            colorInput.value = color;
            form.querySelectorAll('.color-dot').forEach(function (d) {
              d.classList.toggle('is-on', d.dataset.color === color);
            });
          });
        });

        form.querySelectorAll('.color-dot').forEach(function (d) {
          d.addEventListener('click', function () {
            color = d.dataset.color;
            colorInput.value = color;
            form.querySelectorAll('.color-dot').forEach(function (x) {
              x.classList.toggle('is-on', x.dataset.color === color);
            });
          });
        });
        colorInput.addEventListener('input', function () {
          color = colorInput.value;
          form.querySelectorAll('.color-dot').forEach(function (x) { x.classList.remove('is-on'); });
        });

        UI.bindAmount(form.querySelector('#card-target'));
        UI.bindAmount(form.querySelector('#card-current'));

        function paintPhotos() {
          photoBox.innerHTML = photos.length ? photos.map(function (src, i) {
            return '<div class="ep-item"><img src="' + src + '" alt=""><button type="button" class="ep-del" data-del="' + i + '" aria-label="사진 빼기">✕</button></div>';
          }).join('') : '<div class="ep-empty">아직 캡처가 없어요</div>';
          photoBox.querySelectorAll('[data-del]').forEach(function (b) {
            b.addEventListener('click', function () {
              photos.splice(Number(b.dataset.del), 1);
              paintPhotos();
            });
          });
          const label = form.querySelector('#add-photos');
          if (label) label.textContent = '📷 사진 ' + (photos.length ? '더 ' : '') + '넣기 (' + photos.length + '장)';
        }
        paintPhotos();

        form.querySelector('#add-photos').addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
          const files = Array.prototype.slice.call(fileInput.files || []);
          if (!files.length) return;
          const label = form.querySelector('#add-photos');
          if (label) label.textContent = '사진 줄이는 중…';
          resizeAll(files).then(function (urls) {
            photos = photos.concat(urls);
            fileInput.value = '';
            paintPhotos();
            UI.toast(urls.length + '장을 넣었어요');
          }).catch(function () {
            fileInput.value = '';
            paintPhotos();
            UI.toast('사진을 넣지 못했어요');
          });
        });
      }
    });
  }

  T.card = {
    id: 'card',
    label: '카드',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.6" y="5.4" width="18.8" height="13.2" rx="3"/><path d="M2.6 9.6h18.8"/><path d="M6 14.6h3.4"/><circle cx="17.2" cy="14.6" r="1.1" fill="currentColor" stroke="none"/></svg>',
    title: '카드',
    render: function (root) {
      host = root;
      render();
    }
  };
})();
