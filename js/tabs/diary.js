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
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15"/><path d="M9.5 7V4.8h5V7"/><path d="M6.5 7l.8 12.2A1.6 1.6 0 0 0 8.9 20.8h6.2a1.6 1.6 0 0 0 1.6-1.6L17.5 7"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.4 8.6a2.4 2.4 0 0 1 2.4-2.4h1.5l1-1.8h5.4l1 1.8h1.5a2.4 2.4 0 0 1 2.4 2.4v8.2a2.4 2.4 0 0 1-2.4 2.4H5.8a2.4 2.4 0 0 1-2.4-2.4z"/><circle cx="12" cy="13" r="3.4"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
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

  // 사진·동영상 첨부
  let mediaItems = [];     // 지금 날짜 일기에 붙은 첨부 정보(가벼운 메타만)
  let mediaUrls = [];      // 화면에 보여 주려고 만든 임시 주소(다 쓰면 풀어 줍니다)
  let mediaSeq = 0;        // 화면을 다시 그릴 때마다 올려서 늦게 도착한 사진을 버립니다
  let mediaBusy = false;
  let lightbox = null;     // 크게 보기 창
  let lightboxUrls = [];   // 크게 보기에 쓰는 임시 주소
  let lightboxKey = null;  // 크게 보기 키보드 처리

  function entryOf(date) {
    return Store.all('diary').find(function (x) { return x.date === date; }) || null;
  }

  function recent() {
    return Store.all('diary').slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    }).slice(0, 6);
  }

  /* ---------- 첨부한 사진·동영상 ---------- */
  function kindOf(m) { return m && m.kind === 'video' ? 'video' : 'image'; }

  function mediaBadge(row) {
    const list = row && Array.isArray(row.media) ? row.media : [];
    if (!list.length) return '';
    const videos = list.filter(function (m) { return kindOf(m) === 'video'; }).length;
    const photos = list.length - videos;
    const parts = [];
    if (photos) parts.push('📷 ' + photos);
    if (videos) parts.push('🎬 ' + videos);
    return '<span class="rmedia">' + parts.join('&nbsp; ') + '</span>';
  }

  function mediaSectionHTML() {
    const tiles = mediaItems.map(function (m) {
      const video = kindOf(m) === 'video';
      return '<div class="m-tile' + (video ? ' is-video' : '') + '" data-media="' + UI.esc(m.id) + '">' +
        '<span class="m-ph" aria-hidden="true">' + (video ? '🎬' : '🖼️') + '</span>' +
        (video ? '<span class="m-play" aria-hidden="true">▶</span>' : '') +
        '<button type="button" class="m-x" data-media-del="' + UI.esc(m.id) + '" aria-label="첨부 삭제">' + ICON.close + '</button>' +
      '</div>';
    }).join('');

    const total = mediaItems.reduce(function (n, m) { return n + (Number(m.size) || 0); }, 0);
    const hint = mediaItems.length
      ? mediaItems.length + '개 · ' + UI.fmtBytes(total)
      : '사진·동영상은 이 기기에 저장돼요';

    return '' +
      (mediaItems.length ? '<div class="m-grid" id="d-media-grid">' + tiles + '</div>' : '') +
      '<div class="m-bar">' +
        '<button type="button" class="m-add" id="d-media-add"' + (mediaBusy ? ' disabled' : '') + '>' +
          ICON.camera + '<span>' + (mediaBusy ? '붙이는 중…' : '사진·동영상 추가') + '</span>' +
          (mediaItems.length ? '<b class="m-count">' + mediaItems.length + '</b>' : '') +
        '</button>' +
        '<span class="m-hint" id="d-media-hint">' + hint + '</span>' +
      '</div>' +
      '<input type="file" id="d-media-input" accept="image/*,video/*" multiple hidden>' +
      '';
  }

  // 첨부 영역만 다시 그립니다(입력 중인 글·커서를 건드리지 않도록).
  function paintMedia() {
    const sec = host && host.querySelector('#d-media-sec');
    if (!sec) return;
    sec.innerHTML = mediaSectionHTML();
    bindMedia();
    hydrateMedia();
  }

  function clearMediaUrls() {
    mediaSeq++;
    mediaUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    mediaUrls = [];
  }

  // 보관함에서 꺼내 화면에 보여 줍니다.
  function hydrateMedia() {
    clearMediaUrls();
    const grid = host && host.querySelector('#d-media-grid');
    if (!grid || !mediaItems.length) return;
    if (!window.MediaStore) return;
    const seq = mediaSeq;

    mediaItems.forEach(function (m) {
      MediaStore.get(m.id).then(function (blob) {
        if (seq !== mediaSeq) return;
        const tile = grid.querySelector('[data-media="' + m.id + '"]');
        if (!tile) return;
        if (!blob) { tile.classList.add('is-broken'); return; }

        let url = '';
        try { url = URL.createObjectURL(blob); } catch (e) { tile.classList.add('is-broken'); return; }
        mediaUrls.push(url);

        if (kindOf(m) === 'video') {
          const v = document.createElement('video');
          v.className = 'm-video';
          v.muted = true;
          v.playsInline = true;
          v.setAttribute('playsinline', '');
          v.setAttribute('preload', 'metadata');
          v.setAttribute('aria-label', m.name || '동영상');
          v.src = url + '#t=0.1';   // 첫 장면이 미리 보이도록

          // 첫 장면이 그려지면 🎬 자리를 감춥니다.
          const ready = function () { tile.classList.add('is-ready'); };
          v.addEventListener('loadeddata', ready);
          v.addEventListener('seeked', ready);
          v.addEventListener('loadedmetadata', function () {
            try {
              if (isFinite(v.duration) && v.duration > 0) v.currentTime = Math.min(0.3, v.duration / 10);
            } catch (e) {}
            setTimeout(ready, 700);
          });
          v.addEventListener('error', function () { tile.classList.add('is-broken'); });
          tile.insertBefore(v, tile.firstChild);
          if (v.readyState >= 2) ready();
        } else {
          const img = document.createElement('img');
          img.className = 'm-img';
          img.alt = m.name || '사진';
          img.decoding = 'async';
          img.loading = 'lazy';
          img.src = url;
          img.addEventListener('load', function () { tile.classList.add('is-ready'); });
          img.addEventListener('error', function () { tile.classList.add('is-broken'); });
          tile.insertBefore(img, tile.firstChild);
          if (img.complete) tile.classList.add('is-ready');
        }
      }).catch(function () {
        const tile = grid.querySelector('[data-media="' + m.id + '"]');
        if (tile) tile.classList.add('is-broken');
      });
    });
  }

  function bindMedia() {
    const add = host && host.querySelector('#d-media-add');
    if (add) {
      add.addEventListener('click', function () {
        if (mediaBusy) return;
        const input = host.querySelector('#d-media-input');
        if (!input) return;
        if (!window.MediaStore || !MediaStore.supported()) {
          UI.toast('이 브라우저에서는 사진·동영상을 붙일 수 없어요');
          return;
        }
        input.value = '';
        input.click();
      });
    }

    const input = host && host.querySelector('#d-media-input');
    if (input) {
      input.addEventListener('change', function () {
        const files = Array.prototype.slice.call(input.files || []);
        input.value = '';
        handleFiles(files);
      });
    }

    host.querySelectorAll('#d-media-sec .m-tile').forEach(function (tile) {
      tile.addEventListener('click', function (e) {
        if (e.target.closest('.m-x')) return;
        openLightbox(tile.dataset.media);
      });
    });

    host.querySelectorAll('#d-media-sec [data-media-del]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        removeMedia(b.dataset.mediaDel);
      });
    });
  }

  function isVideoFile(f) {
    if (!f) return false;
    if (/^video\//i.test(f.type || '')) return true;
    return /\.(mp4|mov|m4v|webm|ogv|3gp)$/i.test(f.name || '');
  }

  function isImageFile(f) {
    if (!f) return false;
    if (/^image\//i.test(f.type || '')) return true;
    return /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)$/i.test(f.name || '');
  }

  function handleFiles(files) {
    const picked = (files || []).filter(function (f) { return isImageFile(f) || isVideoFile(f); });
    if (!picked.length) {
      UI.toast('사진이나 동영상 파일만 붙일 수 있어요');
      return;
    }
    addFiles(picked);
  }

  async function addFiles(files) {
    mediaBusy = true;
    paintMedia();
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const video = isVideoFile(f);
      try {
        let blob = f;
        if (!video) {
          const res = await MediaStore.compressImage(f, MediaStore.IMAGE_MAX || 1400, 0.82);
          blob = res && res.blob ? res.blob : f;
        }
        if (!blob || !blob.size) throw new Error('빈 파일');

        const id = Store.uid('media');
        await MediaStore.put(id, blob);

        mediaItems.push({
          id: id,
          kind: video ? 'video' : 'image',
          name: String(f.name || (video ? '동영상' : '사진')).slice(0, 80),
          mime: blob.type || f.type || (video ? 'video/mp4' : 'image/jpeg'),
          size: blob.size
        });
        persistMedia();
      } catch (e) {
        failed++;
        console.warn('첨부하지 못했어요', e);
      }
    }

    mediaBusy = false;
    paintMedia();

    if (failed && failed === files.length) {
      UI.toast('사진·동영상을 저장하지 못했어요. 저장 공간이 부족한지 확인해 주세요');
    } else if (failed) {
      UI.toast(failed + '개는 붙이지 못했어요');
    } else {
      UI.toast(files.length + '개를 붙였어요');
    }
  }

  // 첨부 목록을 일기에 저장합니다(글이 없어도 사진만으로 일기가 만들어집니다).
  function persistMedia() {
    const entry = entryOf(selected);
    if (entry) return Store.update('diary', entry.id, { media: mediaItems.slice() });
    if (!mediaItems.length) return null;
    const titleEl = host && host.querySelector('#d-title');
    const bodyEl = host && host.querySelector('#d-body');
    const row = Store.add('diary', {
      date: selected,
      mood: mood || '',
      title: titleEl ? titleEl.value.trim() : '',
      body: bodyEl ? bodyEl.value : '',
      media: mediaItems.slice()
    });
    ensureDeleteButton();
    if (titleEl && bodyEl) setStatus('저장됨');
    return row;
  }

  function removeMedia(id) {
    const i = mediaItems.findIndex(function (m) { return m.id === id; });
    if (i < 0) return;
    mediaItems.splice(i, 1);

    const entry = entryOf(selected);
    const titleEl = host && host.querySelector('#d-title');
    const bodyEl = host && host.querySelector('#d-body');
    const hasText = (titleEl && titleEl.value.trim()) || (bodyEl && bodyEl.value.trim()) || mood;

    if (entry && !mediaItems.length && !hasText) {
      // 사진만 있던 일기에서 마지막 사진까지 지우면 빈 일기는 남기지 않습니다.
      Store.remove('diary', entry.id);
    } else {
      persistMedia();
    }

    if (window.MediaStore) MediaStore.del(id).catch(function () {});
    paintMedia();
    UI.toast('첨부를 지웠어요');
  }

  /* ---------- 크게 보기 (카드 사진 보기와 같은 모양) ---------- */
  function revokeLightboxUrls() {
    lightboxUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    lightboxUrls = [];
  }

  function closeLightbox() {
    const box = lightbox;
    lightbox = null;
    if (box) {
      if (box.parentNode) box.parentNode.removeChild(box);
      document.documentElement.classList.remove('lb-open');
    }
    if (lightboxKey) { document.removeEventListener('keydown', lightboxKey); lightboxKey = null; }
    revokeLightboxUrls();
  }

  function openLightbox(id) {
    const items = mediaItems.slice();
    const start = items.findIndex(function (m) { return m.id === id; });
    if (!items.length || start < 0 || !window.MediaStore) return;
    closeLightbox();

    const seq = mediaSeq;
    Promise.all(items.map(function (m) {
      return MediaStore.get(m.id).catch(function () { return null; });
    })).then(function (blobs) {
      if (seq !== mediaSeq || lightbox) return;

      const urls = blobs.map(function (b) {
        if (!b) return '';
        try {
          const u = URL.createObjectURL(b);
          lightboxUrls.push(u);
          return u;
        } catch (e) { return ''; }
      });
      if (!urls.some(Boolean)) { UI.toast('첨부한 파일을 열지 못했어요'); return; }

      let idx = start;
      const many = items.length > 1;
      const box = document.createElement('div');
      box.className = 'lb';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', '첨부한 사진·동영상 크게 보기');
      box.innerHTML = '' +
        '<div class="lb-top"><span class="lb-count"></span>' +
          '<button type="button" class="lb-close" aria-label="닫기">' + ICON.close + '</button></div>' +
        '<div class="lb-stage"></div>' +
        (many
          ? '<div class="lb-bar">' +
              '<button type="button" class="lb-prev" aria-label="이전">◀</button>' +
              '<span class="lb-title"></span>' +
              '<button type="button" class="lb-next" aria-label="다음">▶</button>' +
            '</div>'
          : '<div class="lb-bar"><span class="lb-title"></span></div>');

      document.body.appendChild(box);
      document.documentElement.classList.add('lb-open');
      lightbox = box;

      const stage = box.querySelector('.lb-stage');
      const counter = box.querySelector('.lb-count');

      function paint() {
        const item = items[idx];
        const video = kindOf(item) === 'video';
        const url = urls[idx] || '';
        stage.innerHTML = '';

        if (!url) {
          stage.innerHTML = '<p class="lb-missing">이 파일을 열지 못했어요</p>';
        } else if (video) {
          const v = document.createElement('video');
          v.src = url;
          v.controls = true;
          v.playsInline = true;
          v.setAttribute('playsinline', '');
          v.setAttribute('preload', 'metadata');
          stage.appendChild(v);
        } else {
          const img = document.createElement('img');
          img.src = url;
          img.alt = item.name || '사진';
          stage.appendChild(img);
        }

        if (counter) counter.textContent = (idx + 1) + ' / ' + items.length;
        const title = box.querySelector('.lb-title');
        if (title) title.textContent = item.name || (video ? '동영상' : '사진');
        const prev = box.querySelector('.lb-prev');
        const next = box.querySelector('.lb-next');
        if (prev) prev.disabled = idx <= 0;
        if (next) next.disabled = idx >= items.length - 1;
      }

      function move(d) {
        const to = idx + d;
        if (to < 0 || to >= items.length) return;
        idx = to;
        paint();
      }

      lightboxKey = function (e) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') move(-1);
        if (e.key === 'ArrowRight') move(1);
      };

      box.querySelector('.lb-close').addEventListener('click', closeLightbox);
      const prev = box.querySelector('.lb-prev');
      const next = box.querySelector('.lb-next');
      if (prev) prev.addEventListener('click', function () { move(-1); });
      if (next) next.addEventListener('click', function () { move(1); });
      box.addEventListener('click', function (e) {
        if (e.target === box || (e.target.classList && e.target.classList.contains('lb-stage'))) closeLightbox();
      });

      let sx = 0;
      box.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
      box.addEventListener('touchend', function (e) {
        const t = e.changedTouches && e.changedTouches[0];
        if (!t || !many) return;
        const dx = t.clientX - sx;
        if (Math.abs(dx) < 50) return;
        move(dx < 0 ? 1 : -1);
      });

      document.addEventListener('keydown', lightboxKey);
      paint();
    }).catch(function () {
      UI.toast('첨부한 파일을 열지 못했어요');
    });
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
    if (DiaryLock.isLocked()) { clearMediaUrls(); renderLock(); return; }
    const entry = entryOf(selected);
    mood = entry && entry.mood ? entry.mood : '';
    mediaItems = entry && Array.isArray(entry.media)
      ? entry.media.filter(function (m) { return m && m.id; })
      : [];

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
        '<div class="media-sec" id="d-media-sec">' + mediaSectionHTML() + '</div>' +
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
                '<span class="rprev">' + UI.esc((r.title ? r.title + ' · ' : '') + (r.body || '').replace(/\s+/g, ' ').slice(0, 40)) + '</span>' +
                mediaBadge(r) + '</span>' +
            '</button>';
          }).join('') + '</div>'
        : '<div class="empty" style="padding:18px 10px">아직 쓴 일기가 없어요.</div>') +
      '<div style="height:8px"></div>';

    if (window.App && App.setSubtitle) {
      App.setSubtitle(UI.koDateFull(selected));
    }

    bind();
    bindMedia();
    hydrateMedia();
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
    const hasText = titleEl.value.trim() || bodyEl.value.trim() || mood || mediaItems.length;
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
        const ids = (Array.isArray(entry.media) ? entry.media : []).map(function (m) { return m && m.id; }).filter(Boolean);
        Store.remove('diary', entry.id);
        if (ids.length && window.MediaStore) MediaStore.delMany(ids).catch(function () {});
        mediaItems = [];
        clearMediaUrls();
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
    const empty = !title && !body.trim() && !mood && !mediaItems.length;
    const entry = entryOf(selected);

    if (empty) {
      if (!silent) UI.toast('내용을 적어 주세요');
      return false;
    }

    if (entry) {
      Store.update('diary', entry.id, { mood: mood, title: title, body: body, media: mediaItems.slice() });
    } else {
      Store.add('diary', { date: selected, mood: mood, title: title, body: body, media: mediaItems.slice() });
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
    closeLightbox();
    if (host && host.querySelector('#d-title') && host.querySelector('#d-body')) saveNow(true);
    clearMediaUrls();   // 사진·동영상에 쓰던 임시 주소를 돌려줍니다.
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
