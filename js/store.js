/* =========================================================
   store.js — 데이터 보관함
   localStorage 저장/불러오기, 백업(내보내기·가져오기), 샘플 데이터
   ========================================================= */
window.Store = (function () {
  'use strict';

  const KEY = 'myDiaryApp.v1';
  const VERSION = 2;
  const APP_VERSION = '1.3.0';

  // 컬렉션 정의: 이름 -> 데이터 키 / 표시 이름
  const COLLECTIONS = {
    schedule: { key: 'items', label: '일정' },
    finance: { key: 'items', label: '가계부' },
    memo: { key: 'items', label: '메모' },
    card: { key: 'items', label: '카드' },
    page: { key: 'items', label: '다이어리' },
    diary: { key: 'entries', label: '일기' },
    dream: { key: 'items', label: '꿈' },
    links: { key: 'items', label: '바로가기' }
  };

  // 테마 기본값 (테마는 settings 안에 함께 저장돼 백업에도 들어갑니다)
  const THEME_DEFAULT = { preset: 'terra', accent: '#C1684A', bg: '#FAF7F2' };

  function blank() {
    return {
      app: 'my-diary-app',
      version: VERSION,
      schedule: { items: [] },
      finance: { items: [] },
      memo: { items: [] },
      card: { items: [] },
      page: { items: [] },
      diary: { entries: [] },
      dream: { items: [] },
      links: { items: [] },
      settings: {
        seeded: false,
        createdAt: new Date().toISOString(),
        updatedAt: null,
        theme: Object.assign({}, THEME_DEFAULT),
        cats: { general: { expense: [], income: [] }, invest: { expense: [], income: [] } },
        // 일기 잠금: { enabled, hash, salt, webauthn: { id } | null, updatedAt }
        diaryLock: { enabled: false, hash: '', salt: '', webauthn: null, updatedAt: null }
      }
    };
  }

  let state = blank();
  const listeners = [];

  /* ---------- 내부 도우미 ---------- */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function iso(d) {
    const x = d || new Date();
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  }

  function isoAdd(baseIso, days) {
    const p = String(baseIso).split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + days);
    return iso(d);
  }

  function normalize(raw) {
    const out = blank();
    if (!raw || typeof raw !== 'object') return out;

    Object.keys(COLLECTIONS).forEach(function (name) {
      const k = COLLECTIONS[name].key;
      const src = raw[name];
      const arr = src && Object.prototype.toString.call(src[k]) === '[object Array]' ? src[k] : [];
      out[name][k] = arr
        .filter(function (x) { return x && typeof x === 'object' && x.id; })
        .map(function (x) { return Object.assign({}, x); });
    });

    if (raw.settings && typeof raw.settings === 'object') {
      Object.assign(out.settings, raw.settings);
    }
    if (!out.settings.theme || typeof out.settings.theme !== 'object') {
      out.settings.theme = Object.assign({}, THEME_DEFAULT);
    }
    if (!out.settings.cats || typeof out.settings.cats !== 'object') {
      out.settings.cats = { general: { expense: [], income: [] }, invest: { expense: [], income: [] } };
    }
    ['general', 'invest'].forEach(function (b) {
      if (!out.settings.cats[b]) out.settings.cats[b] = { expense: [], income: [] };
      ['expense', 'income'].forEach(function (t) {
        if (Object.prototype.toString.call(out.settings.cats[b][t]) !== '[object Array]') {
          out.settings.cats[b][t] = [];
        }
      });
    });

    // 일기 잠금 설정 (예전 백업 파일에는 없으므로 기본값을 채웁니다)
    const lock = out.settings.diaryLock;
    if (!lock || typeof lock !== 'object') {
      out.settings.diaryLock = { enabled: false, hash: '', salt: '', webauthn: null, updatedAt: null };
    } else {
      out.settings.diaryLock = {
        enabled: !!lock.enabled,
        hash: typeof lock.hash === 'string' ? lock.hash : '',
        salt: typeof lock.salt === 'string' ? lock.salt : '',
        webauthn: lock.webauthn && typeof lock.webauthn === 'object' ? Object.assign({}, lock.webauthn) : null,
        updatedAt: lock.updatedAt || null
      };
      // 잠금을 켰는데 비밀번호가 없으면 잠글 수 없으니 꺼 둡니다.
      if (out.settings.diaryLock.enabled && !out.settings.diaryLock.hash) {
        out.settings.diaryLock.enabled = false;
        out.settings.diaryLock.webauthn = null;
      }
    }
    return out;
  }

  /* 예전 가계부(v1)의 '재테크' 구분을 두 장부 구조로 옮깁니다. */
  const OLD_INVEST_CAT = {
    '포인트': '포인트&현금', '배당': '이자/배당', '이자': '이자/배당', '펀드': '투자', '이벤트': '포인트&현금', '공모주': '공모주'
  };

  function migrate() {
    let changed = false;
    state.finance.items.forEach(function (it) {
      if (!it.book) {
        if (it.type === 'invest') {
          it.book = 'invest';
          it.type = 'income';
          if (it.category && OLD_INVEST_CAT[it.category]) it.category = OLD_INVEST_CAT[it.category];
        } else {
          it.book = 'general';
        }
        changed = true;
      }
      if (it.type !== 'income' && it.type !== 'expense') { it.type = 'expense'; changed = true; }
      if (it.book !== 'general' && it.book !== 'invest') { it.book = 'general'; changed = true; }
    });
    if (state.version !== VERSION) { state.version = VERSION; changed = true; }
    return changed;
  }

  function notify() {
    listeners.slice().forEach(function (fn) {
      try { fn(state); } catch (e) { console.warn(e); }
    });
  }

  /* ---------- 기본 API ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = normalize(JSON.parse(raw));
    } catch (e) {
      console.warn('저장된 데이터를 읽지 못했습니다.', e);
    }
    if (migrate()) save();
    return state;
  }

  function save() {
    state.settings.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('저장 실패', e);
      return false;
    }
  }

  function all(name) {
    const c = COLLECTIONS[name];
    return c ? state[name][c.key] : [];
  }

  function find(name, id) {
    return all(name).find(function (x) { return x.id === id; }) || null;
  }

  function add(name, item) {
    const c = COLLECTIONS[name];
    if (!c) return null;
    const now = new Date().toISOString();
    const row = Object.assign({ id: uid(name.slice(0, 3)), createdAt: now, updatedAt: now }, item);
    state[name][c.key].push(row);
    save();
    notify();
    return row;
  }

  function update(name, id, patch) {
    const row = find(name, id);
    if (!row) return null;
    Object.assign(row, patch, { updatedAt: new Date().toISOString() });
    save();
    notify();
    return row;
  }

  function remove(name, id) {
    const c = COLLECTIONS[name];
    if (!c) return false;
    const arr = state[name][c.key];
    const i = arr.findIndex(function (x) { return x.id === id; });
    if (i < 0) return false;
    arr.splice(i, 1);
    save();
    notify();
    return true;
  }

  function counts() {
    const out = {};
    Object.keys(COLLECTIONS).forEach(function (name) {
      out[name] = all(name).length;
    });
    return out;
  }

  function sampleCount() {
    let n = 0;
    Object.keys(COLLECTIONS).forEach(function (name) {
      n += all(name).filter(function (x) { return x.sample; }).length;
    });
    return n;
  }

  function clearSamples() {
    let n = 0;
    Object.keys(COLLECTIONS).forEach(function (name) {
      const k = COLLECTIONS[name].key;
      const before = state[name][k].length;
      state[name][k] = state[name][k].filter(function (x) { return !x.sample; });
      n += before - state[name][k].length;
    });
    save();
    notify();
    return n;
  }

  function reset() {
    state = blank();
    state.settings.seeded = true; // 다시 샘플이 생기지 않도록
    save();
    notify();
  }

  /* ---------- 다이어리 한 장(날짜별 줄노트) ---------- */
  function pageOf(date) {
    return state.page.items.find(function (x) { return x.date === date; }) || null;
  }

  function savePage(date, body) {
    const row = pageOf(date);
    if (row) {
      row.body = body;
      row.updatedAt = new Date().toISOString();
      save();
      return row;
    }
    return add('page', { date: date, body: body });
  }

  function writtenPages() {
    return state.page.items.filter(function (x) { return String(x.body || '').trim() !== ''; }).length;
  }

  /* ---------- 일기 잠금 ---------- */
  // 4자리 PIN을 바로 알아보기 어렵게 만들기만 하는 화면 잠금용 해시입니다.
  // (저장된 일기 자체를 암호화하지는 않습니다.)
  function hashPin(pin, salt) {
    let s = String(salt) + '|' + String(pin) + '|' + String(salt);
    let h1 = 0x811c9dc5 >>> 0;
    let h2 = 0x9e3779b9 >>> 0;
    for (let round = 0; round < 4000; round++) {
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i) + (round & 0xff);
        h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
        h2 = (Math.imul(h2 + c, 2654435761) >>> 0);
      }
      h1 = (h1 ^ (h2 >>> 7)) >>> 0;
      s = h1.toString(36) + h2.toString(36) + round.toString(36);
    }
    return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }

  function diaryLock() {
    if (!state.settings.diaryLock) {
      state.settings.diaryLock = { enabled: false, hash: '', salt: '', webauthn: null, updatedAt: null };
    }
    return state.settings.diaryLock;
  }

  function lockReady() {
    const l = diaryLock();
    return !!(l.enabled && l.hash && l.salt);
  }

  function setDiaryPin(pin) {
    const p = String(pin || '').replace(/[^0-9]/g, '');
    if (!/^\d{4}$/.test(p)) return false;
    const l = diaryLock();
    l.salt = uid('s');
    l.hash = hashPin(p, l.salt);
    l.enabled = true;
    l.updatedAt = new Date().toISOString();
    save();
    return true;
  }

  function checkDiaryPin(pin) {
    const l = diaryLock();
    if (!l.hash || !l.salt) return false;
    const p = String(pin || '').replace(/[^0-9]/g, '');
    if (!/^\d{4}$/.test(p)) return false;
    return hashPin(p, l.salt) === l.hash;
  }

  function setDiaryLockEnabled(on) {
    const l = diaryLock();
    if (on && !l.hash) return false;
    l.enabled = !!on;
    if (!l.enabled) l.webauthn = null; // 잠금을 끄면 지문 등록도 함께 해제
    l.updatedAt = new Date().toISOString();
    save();
    return true;
  }

  // 지문(생체인증) 등록 정보 — 자격증명 id만 저장합니다.
  function setDiaryWebauthn(info) {
    const l = diaryLock();
    l.webauthn = info && info.id ? { id: String(info.id), addedAt: new Date().toISOString() } : null;
    l.updatedAt = new Date().toISOString();
    save();
    return l.webauthn;
  }

  function clearDiaryLock() {
    state.settings.diaryLock = { enabled: false, hash: '', salt: '', webauthn: null, updatedAt: new Date().toISOString() };
    save();
  }

  /* ---------- 테마 ---------- */
  function setTheme(theme) {
    state.settings.theme = Object.assign({}, THEME_DEFAULT, state.settings.theme || {}, theme || {});
    save();
    return state.settings.theme;
  }

  /* ---------- 직접 추가한 카테고리 ---------- */
  function customCats(book, type) {
    const s = state.settings;
    if (!s.cats || !s.cats[book] || !s.cats[book][type]) return [];
    return s.cats[book][type].slice();
  }

  function addCustomCat(book, type, name) {
    const n = String(name || '').trim();
    if (!n) return false;
    if (!state.settings.cats) state.settings.cats = { general: { expense: [], income: [] }, invest: { expense: [], income: [] } };
    if (!state.settings.cats[book]) state.settings.cats[book] = { expense: [], income: [] };
    const arr = state.settings.cats[book][type] || (state.settings.cats[book][type] = []);
    if (arr.indexOf(n) >= 0) return false;
    arr.push(n);
    save();
    return true;
  }

  /* ---------- 백업 ---------- */
  function exportPayload() {
    return {
      app: 'my-diary-app',
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      data: JSON.parse(JSON.stringify({
        version: VERSION,
        schedule: state.schedule,
        finance: state.finance,
        memo: state.memo,
        card: state.card,
        page: state.page,
        diary: state.diary,
        dream: state.dream,
        links: state.links,
        settings: state.settings
      }))
    };
  }

  function importPayload(payload, mode) {
    const src = payload && payload.data ? payload.data : payload;
    if (!src || typeof src !== 'object') {
      throw new Error('백업 파일의 형식을 알 수 없습니다.');
    }
    const incoming = normalize(src);
    const result = { added: 0, replaced: false };

    if (mode === 'replace') {
      state = incoming;
      state.settings.seeded = true;
      result.replaced = true;
      Object.keys(COLLECTIONS).forEach(function (name) { result.added += all(name).length; });
    } else {
      Object.keys(COLLECTIONS).forEach(function (name) {
        const k = COLLECTIONS[name].key;
        const existing = new Set(state[name][k].map(function (x) { return x.id; }));
        incoming[name][k].forEach(function (row) {
          if (!existing.has(row.id)) {
            state[name][k].push(row);
            existing.add(row.id);
            result.added += 1;
          }
        });
      });
      state.settings.seeded = true;
    }

    save();
    notify();
    return result;
  }

  function storageBytes() {
    try { return new Blob([localStorage.getItem(KEY) || '']).size; }
    catch (e) { return (localStorage.getItem(KEY) || '').length; }
  }

  /* ---------- 샘플 데이터 ---------- */
  // 예시용 그림(사진 자리에 넣어 둘 따뜻한 새벽 풍경)을 캔버스로 그립니다.
  function samplePhoto() {
    try {
      const c = document.createElement('canvas');
      c.width = 720; c.height = 540;
      const x = c.getContext('2d');

      const sky = x.createLinearGradient(0, 0, 120, 540);
      sky.addColorStop(0, '#FBEFE0');
      sky.addColorStop(0.42, '#F6D8BE');
      sky.addColorStop(0.78, '#EFC3A0');
      sky.addColorStop(1, '#E7B08A');
      x.fillStyle = sky;
      x.fillRect(0, 0, 720, 540);

      // 따뜻한 빛망울
      const bokeh = [
        [520, 150, 92, '255,248,232', 0.55],
        [610, 250, 58, '255,242,214', 0.45],
        [430, 96, 44, '255,250,238', 0.45],
        [180, 120, 70, '255,244,224', 0.35],
        [96, 250, 40, '255,247,230', 0.35],
        [300, 210, 30, '255,249,235', 0.30],
        [660, 90, 26, '255,252,242', 0.40],
        [250, 330, 54, '255,238,214', 0.30],
        [560, 360, 34, '255,240,220', 0.28]
      ];
      bokeh.forEach(function (b) {
        const g = x.createRadialGradient(b[0], b[1], 1, b[0], b[1], b[2]);
        g.addColorStop(0, 'rgba(' + b[3] + ',' + b[4] + ')');
        g.addColorStop(0.6, 'rgba(' + b[3] + ',' + (b[4] * 0.45).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + b[3] + ',0)');
        x.fillStyle = g;
        x.beginPath(); x.arc(b[0], b[1], b[2], 0, Math.PI * 2); x.fill();
      });

      // 은은한 세이지빛
      const sages = [[110, 420, 120, 0.16], [640, 470, 150, 0.14], [350, 500, 160, 0.12]];
      sages.forEach(function (b) {
        const g = x.createRadialGradient(b[0], b[1], 2, b[0], b[1], b[2]);
        g.addColorStop(0, 'rgba(126,148,120,' + b[3] + ')');
        g.addColorStop(1, 'rgba(126,148,120,0)');
        x.fillStyle = g;
        x.beginPath(); x.arc(b[0], b[1], b[2], 0, Math.PI * 2); x.fill();
      });

      // 부드러운 비네트
      const v = x.createRadialGradient(360, 270, 160, 360, 270, 470);
      v.addColorStop(0, 'rgba(120,80,50,0)');
      v.addColorStop(1, 'rgba(120,80,50,0.12)');
      x.fillStyle = v;
      x.fillRect(0, 0, 720, 540);

      return c.toDataURL('image/jpeg', 0.72);
    } catch (e) {
      return '';
    }
  }

  function seedSample() {
    const t = iso();
    const y = isoAdd(t, -1);
    const tm = isoAdd(t, 1);
    const d2 = isoAdd(t, 2);
    const d3 = isoAdd(t, 3);
    const d5 = isoAdd(t, -5);
    const d8 = isoAdd(t, -8);

    function task(date, text, extra) {
      return Object.assign({ date: date, text: text, done: false, star: false, time: '', sample: true }, extra || {});
    }
    function fin(date, book, type, amount, category, memo) {
      return { date: date, book: book, type: type, amount: amount, category: category, memo: memo || '', sample: true };
    }

    state.schedule.items = [
      task(t, '아침 스트레칭 10분', { time: '08:00', done: true }),
      task(t, '책 읽기 30분', { time: '09:30', star: true }),
      task(t, '저녁 장보기 (우유·달걀)', { time: '18:00' }),
      task(tm, '가방 정리하기', { star: true }),
      task(tm, '포인트 적립 확인', { time: '3번' }),
      task(d2, '미용실 예약 전화하기', { time: '1번', star: true }),
      task(d3, '주말 영화 보기', { time: '11:00' })
    ];

    state.finance.items = [
      fin(t, 'general', 'income', 45000, '중고거래', '안 쓰는 책 판매'),
      fin(t, 'general', 'expense', 5800, '카페', '친구와 커피'),
      fin(y, 'general', 'expense', 42300, '장보기', '이번 주 장보기'),
      fin(isoAdd(t, -2), 'general', 'expense', 4200, '교통', '버스·지하철'),
      fin(isoAdd(t, -3), 'general', 'expense', 12900, '교육', '온라인 강의'),
      fin(t, 'invest', 'income', 176958, '카드테크', '카드 포인트 적립'),
      fin(t, 'invest', 'income', 128962, '포인트&현금', '포인트 전환'),
      fin(t, 'invest', 'income', 93784, '주식', '배당금 입금'),
      fin(t, 'invest', 'income', 3685, '투자', '소액 투자 수익'),
      fin(t, 'invest', 'expense', 4592, '기타', '거래 수수료'),
      fin(d5, 'invest', 'income', 84500, '주식', '매도 수익')
    ];

    state.page.items = [
      {
        date: t,
        body: '아침에 스트레칭 10분\n9시에 오늘 할 일 확인\n오후엔 책 읽고 장바구니 정리\n저녁엔 가족과 잠깐 산책',
        sample: true
      },
      {
        date: y,
        body: '장 보고 따뜻한 차 한 잔.\n내일은 미용실 예약 전화하기.',
        sample: true
      }
    ];

    state.card.items = [
      {
        issuer: 'A카드사', name: '샘플 카드 A', color: '#00A19C',
        target: 300000, current: 180000,
        payDay: '25일', expiry: '11/28',
        benefits: '여행·숙박 5% 적립, 해외 결제 수수료 무료\n국내 가맹점 1% 기본 적립 · 실적 30만원 이상',
        photos: [], sample: true
      },
      {
        issuer: 'B카드사', name: '샘플 카드 B', color: '#E4002B',
        target: 300000, current: 300000,
        payDay: '14일', expiry: '09/29',
        benefits: '간편결제 3% 적립(이벤트 시 5%), 커피 전문점 50% 할인\n전월실적 30만원 · 통신·공과금은 적립 제외',
        photos: [], sample: true
      },
      {
        issuer: 'C카드사', name: '샘플 카드 C', color: '#0046FF',
        target: 300000, current: 124500,
        payDay: '20일', expiry: '06/30',
        benefits: '1,000원 미만 절사 후 남은 금액 적립 · 자주 쓰는 곳 3%\n생활 요금·보험료 적립 제외',
        photos: [], sample: true
      }
    ];

    state.memo.items = [
      {
        text: '이번 달 체크리스트\n· 장보기 목록\n· 예약 확인\n· 청구서 정리',
        color: 'cream', pinned: true, sample: true
      },
      {
        text: '물 마시기 자주 하기',
        color: 'sage', pinned: false, sample: true
      },
      {
        text: '주말에 갈 곳\n- 동네 산책로\n- 주말 오후',
        color: 'rose', pinned: false, sample: true
      },
      {
        text: '이번 달 카드 실적 남은 금액 확인',
        color: 'sky', pinned: false, sample: true
      }
    ];

    state.diary.entries = [
      {
        date: t, mood: '🥰', title: '오늘의 기록',
        body: '오전에 책을 읽고 장바구니도 정리했다.\n저녁에는 가족과 잠깐 산책.\n내일은 미용실 예약 전화하기.',
        sample: true
      },
      {
        date: y, mood: '😊', title: '평범한 하루',
        body: '장을 보고 집에서 저녁을 먹었다. 날이 추워져서 따뜻한 차를 자주 마시는 중.',
        sample: true
      }
    ];

    state.dream.items = [
      {
        title: '매일 아침 30분, 나를 위한 시간',
        text: '일어나서 스트레칭 10분, 책 한 장 읽기.',
        target: '매일',
        photo: '',
        sample: true
      },
      {
        title: '가족과 함께하는 바다 여행',
        text: '내년 봄, 가족과 함께 바다 보러 가기.\n사진 많이 찍고 맛있는 것도 먹기.',
        target: '2027년 봄',
        photo: samplePhoto(),
        sample: true
      }
    ];

    // 모든 샘플에 id와 시간을 붙여, 고치기·지우기가 정상 동작하고 다시 열어도 남도록 합니다.
    Object.keys(COLLECTIONS).forEach(function (name) {
      const key = COLLECTIONS[name].key;
      state[name][key].forEach(function (row, i) {
        if (!row.id) row.id = uid(name.slice(0, 3));
        if (!row.createdAt) row.createdAt = new Date(Date.now() - (200 - i) * 60000).toISOString();
        if (!row.updatedAt) row.updatedAt = row.createdAt;
      });
    });

    state.settings.seeded = true;
    save();
    notify();
  }

  /* ---------- 초기화 ---------- */
  load();

  return {
    KEY: KEY,
    VERSION: VERSION,
    APP_VERSION: APP_VERSION,
    COLLECTIONS: COLLECTIONS,
    get state() { return state; },
    load: load,
    save: save,
    all: all,
    find: find,
    add: add,
    update: update,
    remove: remove,
    counts: counts,
    sampleCount: sampleCount,
    clearSamples: clearSamples,
    reset: reset,
    exportPayload: exportPayload,
    importPayload: importPayload,
    storageBytes: storageBytes,
    pageOf: pageOf,
    savePage: savePage,
    writtenPages: writtenPages,
    setTheme: setTheme,
    diaryLock: diaryLock,
    lockReady: lockReady,
    setDiaryPin: setDiaryPin,
    checkDiaryPin: checkDiaryPin,
    setDiaryLockEnabled: setDiaryLockEnabled,
    setDiaryWebauthn: setDiaryWebauthn,
    clearDiaryLock: clearDiaryLock,
    customCats: customCats,
    addCustomCat: addCustomCat,
    THEME_DEFAULT: THEME_DEFAULT,
    seedSample: seedSample,
    subscribe: function (fn) { listeners.push(fn); return function () { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    uid: uid,
    iso: iso,
    isoAdd: isoAdd
  };
})();
