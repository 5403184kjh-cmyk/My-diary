/* =========================================================
   tabs/dream.js — 꿈 (비전보드)
   사진 + 제목 + 다짐 글 + 목표 시기를 카드로 모아 매일 봅니다.
   ========================================================= */
(function () {
  'use strict';
  const T = (window.Tabs = window.Tabs || {});

  const ICON = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
  };

  let host = null;

  function dreams() {
    return Store.all('dream').slice().sort(function (a, b) {
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
  }

  function dayOfYear() {
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 86400000);
  }

  function todaysDream(list) {
    if (!list.length) return null;
    return list[dayOfYear() % list.length];
  }

  function heroHTML(d) {
    if (!d) return '';
    const hasPhoto = !!d.photo;
    return '' +
      '<button type="button" class="dream-hero" data-id="' + d.id + '">' +
        '<div class="hero-media ' + (hasPhoto ? '' : 'no-photo') + '">' +
          (hasPhoto ? '<img src="' + d.photo + '" alt="">' : '<span class="hero-emoji">✨</span>') +
        '</div>' +
        '<div class="hero-cap">' +
          '<span class="hero-badge">오늘의 꿈 · ' + UI.koDate(UI.todayISO()) + '</span>' +
          '<h2>' + UI.esc(d.title || '나의 꿈') + '</h2>' +
          (d.text ? '<p>' + UI.esc(d.text) + '</p>' : '') +
          (d.target ? '<span class="hero-target">' + UI.esc(d.target) + '</span>' : '') +
        '</div>' +
      '</button>';
  }

  function cardHTML(d) {
    const hasPhoto = !!d.photo;
    return '' +
      '<button type="button" class="dream-card" data-id="' + d.id + '">' +
        '<div class="dc-media ' + (hasPhoto ? '' : 'no-photo') + '">' +
          (hasPhoto ? '<img src="' + d.photo + '" alt="" loading="lazy">' : '<span>✨</span>') +
        '</div>' +
        '<div class="dc-cap">' +
          '<span class="dc-title">' + UI.esc(d.title || '나의 꿈') + '</span>' +
          (d.target ? '<span class="dc-target">' + UI.esc(d.target) + '</span>' : '<span class="dc-target muted">꿈</span>') +
        '</div>' +
      '</button>';
  }

  function render() {
    if (!host) return;
    const list = dreams();
    const today = todaysDream(list);
    const rest = list;

    host.innerHTML = '' +
      (list.length
        ? '<div class="sec-head"><h2>오늘의 꿈</h2><span class="sub">매일 한 장씩</span></div>' +
          heroHTML(today) +
          '<div class="sec-head"><h2>모아 둔 꿈 ' + list.length + '개</h2>' +
            '<button type="button" class="mini-btn terra" id="dream-add">＋ 꿈 적기</button></div>' +
          '<div class="dream-grid">' + rest.map(cardHTML).join('') + '</div>'
        : '<div class="empty" style="padding-top:56px"><span class="emo">✨</span>' +
          '아직 적어 둔 꿈이 없어요.<br>사진 한 장과 짧은 글로<br>매일 보고 싶은 꿈을 남겨 보세요.</div>');

    if (window.App && App.setSubtitle) {
      App.setSubtitle(list.length ? '오늘의 꿈 · 매일 한 장씩 바뀌어요' : '사진과 글로 꿈을 모아 두세요');
    }
    if (window.App && App.hideFab) App.hideFab();

    bind();
  }

  function bind() {
    host.querySelectorAll('[data-id]').forEach(function (b) {
      b.addEventListener('click', function () {
        const item = Store.find('dream', b.dataset.id);
        if (item) openEditor(item);
      });
    });
    const add = host.querySelector('#dream-add');
    if (add) add.addEventListener('click', function () { openEditor(null); });
  }

  function openEditor(item) {
    const isNew = !item;
    let photo = isNew ? '' : (item.photo || '');

    const body = '' +
      '<div class="field">' +
        '<span class="field-label">사진</span>' +
        '<div class="photo-box ' + (photo ? 'has-photo' : '') + '" id="photo-box">' +
          '<img id="photo-img" alt="" ' + (photo ? 'src="' + photo + '"' : 'style="display:none"') + '>' +
          '<div class="photo-empty" id="photo-empty" ' + (photo ? 'style="display:none"' : '') + '>📷<span>사진 고르기</span></div>' +
          '<button type="button" class="photo-del" id="photo-del" ' + (photo ? '' : 'hidden') + '>✕</button>' +
        '</div>' +
        '<input type="file" id="photo-input" accept="image/*" style="display:none">' +
        '<div class="helper" id="photo-help">사진은 폰 화면에 맞게 자동으로 줄여서 저장해요. 백업 파일에도 함께 담겨요.</div>' +
      '</div>' +
      '<div class="field"><label>꿈 제목</label>' +
        '<input class="input" id="dream-title" type="text" maxlength="40" placeholder="예: 가족과 바다 여행" value="' + UI.esc(isNew ? '' : (item.title || '')) + '">' +
      '</div>' +
      '<div class="field"><label>다짐 · 글</label>' +
        '<textarea class="input" id="dream-text" rows="4" maxlength="600" placeholder="이루고 싶은 마음, 그날의 나에게 하고 싶은 말">' + UI.esc(isNew ? '' : (item.text || '')) + '</textarea>' +
      '</div>' +
      '<div class="field"><label>목표 시기 (선택)</label>' +
        '<input class="input" id="dream-target" type="text" maxlength="20" placeholder="예: 2027년 봄 / 매일" value="' + UI.esc(isNew ? '' : (item.target || '')) + '">' +
      '</div>';

    const buttons = [
      { label: isNew ? '추가' : '저장', kind: 'primary', submit: true, onClick: function (form) {
          const title = form.querySelector('#dream-title').value.trim();
          const text = form.querySelector('#dream-text').value.trim();
          const target = form.querySelector('#dream-target').value.trim();
          if (!title) {
            const input = form.querySelector('#dream-title');
            input.focus();
            UI.toast('꿈 제목을 적어 주세요');
            return false;
          }
          if (isNew) {
            Store.add('dream', { title: title, text: text, target: target, photo: photo });
          } else {
            Store.update('dream', item.id, { title: title, text: text, target: target, photo: photo });
          }
          render();
          UI.toast(isNew ? '꿈을 남겼어요' : '저장했어요');
          if (Store.storageBytes() > 4.5 * 1024 * 1024) {
            setTimeout(function () {
              UI.toast('저장 공간이 거의 찼어요. 사진을 줄이거나 백업 후 정리해 주세요.', 4200);
            }, 2300);
          }
        } },
      { label: '취소', kind: 'ghost' }
    ];
    if (!isNew) {
      buttons.splice(1, 0, { label: '삭제', kind: 'danger', keepOpen: true, onClick: function (form, closeSheet) {
        closeSheet();
        UI.confirmDialog({
          title: '이 꿈을 지울까요?',
          message: '“' + (item.title || '나의 꿈') + '” 카드를 지웁니다. 되돌릴 수 없어요.',
          confirmLabel: '삭제',
          danger: true,
          onConfirm: function () {
            Store.remove('dream', item.id);
            render();
            UI.toast('삭제했어요');
          }
        });
      } });
    }

    UI.openSheet({
      title: isNew ? '꿈 적기' : '꿈 고치기',
      subtitle: '사진은 한 장, 글로는 마음껏 적어 보세요',
      body: body,
      buttons: buttons,
      noFocus: !isNew,
      onMount: function (form) {
        const box = form.querySelector('#photo-box');
        const input = form.querySelector('#photo-input');
        const img = form.querySelector('#photo-img');
        const empty = form.querySelector('#photo-empty');
        const del = form.querySelector('#photo-del');
        const help = form.querySelector('#photo-help');

        function paint() {
          if (photo) {
            img.src = photo;
            img.style.display = '';
            empty.style.display = 'none';
            del.hidden = false;
            box.classList.add('has-photo');
          } else {
            img.removeAttribute('src');
            img.style.display = 'none';
            empty.style.display = '';
            del.hidden = true;
            box.classList.remove('has-photo');
          }
        }

        box.addEventListener('click', function (e) {
          if (e.target === del) return;
          input.click();
        });

        input.addEventListener('change', function () {
          const file = input.files && input.files[0];
          if (!file) return;
          help.textContent = '사진을 줄이는 중…';
          UI.resizeImage(file, 1000, 0.72).then(function (res) {
            photo = res.dataUrl;
            paint();
            input.value = '';
            help.textContent = '사진을 넣었어요 (' + UI.fmtBytes(res.bytes) + ' · ' + res.width + '×' + res.height + ')';
          }).catch(function (err) {
            input.value = '';
            help.textContent = '사진은 폰 화면에 맞게 자동으로 줄여서 저장해요.';
            UI.toast(err && err.message ? err.message : '사진을 넣지 못했어요');
          });
        });

        del.addEventListener('click', function (e) {
          e.stopPropagation();
          photo = '';
          paint();
          help.textContent = '사진을 뺐어요. 다시 고르려면 위를 눌러 주세요.';
        });
      }
    });
  }

  T.dream = {
    id: 'dream',
    label: '꿈',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.4l1.85 4.95 4.95 1.85-4.95 1.85L12 17l-1.85-4.95L5.2 10.2l4.95-1.85z"/><path d="M18.4 15.4l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/></svg>',
    title: '꿈',
    render: function (root) {
      host = root;
      render();
    }
  };
})();
