/* =========================================================
   theme.js — 테마 색상
   프리셋 6종 + 직접 고른 색. 고르는 즉시 CSS 변수가 바뀌어
   앱 전체(탭바·버튼·달력·다이어리 포인트)에 적용됩니다.
   ========================================================= */
window.Theme = (function () {
  'use strict';

  // 프리셋: accent(포인트 색) + bg(종이 바탕색)
  const PRESETS = [
    { id: 'terra',    label: '크림·테라코타', emoji: '🍂', accent: '#C1684A', bg: '#FAF7F2' },
    { id: 'cherry',   label: '벚꽃 핑크',     emoji: '🌸', accent: '#D2718C', bg: '#FDF6F7' },
    { id: 'basil',    label: '바질 그린',     emoji: '🌿', accent: '#6E9163', bg: '#F7FAF4' },
    { id: 'lavender', label: '라벤더',        emoji: '💜', accent: '#8A79B8', bg: '#F8F6FC' },
    { id: 'sky',      label: '스카이 블루',   emoji: '🌊', accent: '#4E8DBE', bg: '#F5F9FC' },
    { id: 'sand',     label: '모래·골드',     emoji: '🌾', accent: '#B08A3E', bg: '#FBF7EC' }
  ];

  const DEFAULT_BG = '#FAF7F2';

  /* ---------- 색 계산 도우미 ---------- */
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

  function hexToRgb(hex) {
    let h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) h = 'C1684A';
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function rgbToHex(c) {
    const f = function (v) { return clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'); };
    return '#' + f(c.r) + f(c.g) + f(c.b);
  }

  function rgbToHsl(c) {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    s = clamp(s, 0, 100) / 100;
    l = clamp(l, 0, 100) / 100;
    if (s === 0) {
      const v = Math.round(l * 255);
      return { r: v, g: v, b: v };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = function (t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return {
      r: Math.round(hue(h + 1 / 3) * 255),
      g: Math.round(hue(h) * 255),
      b: Math.round(hue(h - 1 / 3) * 255)
    };
  }

  function hsl(h, s, l) { return rgbToHex(hslToRgb(h, s, l)); }

  // 두 색을 섞습니다 (t = b의 비율)
  function mix(a, b, t) {
    const x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex({
      r: x.r + (y.r - x.r) * t,
      g: x.g + (y.g - x.g) * t,
      b: x.b + (y.b - x.b) * t
    });
  }

  /* ---------- 팔레트 만들기 ---------- */
  function palette(accentHex, bgHex) {
    const a = hexToRgb(accentHex);
    const h = rgbToHsl(a);
    const bg = bgHex || mix(accentHex, DEFAULT_BG, 0.94); // 직접 고른 색은 종이 바탕도 살짝 물들입니다
    return {
      accent: rgbToHex(a),
      accentDark: hsl(h.h, clamp(h.s * 0.96, 18, 80), clamp(h.l - 9, 18, 70)),
      accentSoft: hsl(h.h, clamp(h.s * 0.7, 14, 60), 92),
      bg: bg,
      bgSoft: mix(bg, accentHex, 0.10),
      line: mix(bg, accentHex, 0.17),
      lineSoft: mix(bg, accentHex, 0.09)
    };
  }

  /* ---------- CSS 변수 적용 ---------- */
  function applyVars(p) {
    const root = document.documentElement;
    const set = function (k, v) { root.style.setProperty(k, v); };
    set('--terra', p.accent);
    set('--terra-dark', p.accentDark);
    set('--terra-soft', p.accentSoft);
    set('--accent', p.accent);
    set('--accent-dark', p.accentDark);
    set('--accent-soft', p.accentSoft);
    set('--paper-bg', p.bg);
    set('--bg', p.bg);
    set('--bg-soft', p.bgSoft);
    set('--line', p.line);
    set('--line-soft', p.lineSoft);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', p.bg);
  }

  function presetOf(id) {
    return PRESETS.find(function (x) { return x.id === id; }) || PRESETS[0];
  }

  function current() {
    const t = (Store.state.settings && Store.state.settings.theme) || {};
    return {
      preset: t.preset || 'terra',
      accent: t.accent || '#C1684A',
      bg: t.bg || '#FAF7F2'
    };
  }

  function apply(theme) {
    const t = theme || current();
    applyVars(palette(t.accent, t.bg));
  }

  function setPreset(id) {
    const p = presetOf(id);
    const saved = Store.setTheme({ preset: p.id, accent: p.accent, bg: p.bg });
    applyVars(palette(saved.accent, saved.bg));
    return saved;
  }

  function setCustom(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(String(hex || ''))) return current();
    const bg = mix(hex, DEFAULT_BG, 0.95);
    const saved = Store.setTheme({ preset: 'custom', accent: hex, bg: bg });
    applyVars(palette(saved.accent, saved.bg));
    return saved;
  }

  function reset() {
    return setPreset('terra');
  }

  function init() {
    apply(current());
  }

  /* ---------- 테마 고르기 시트 ---------- */
  function openSheet(onDone) {
    const cur = current();
    const body = '' +
      '<div class="theme-pick" id="theme-pick">' +
        PRESETS.map(function (p) {
          const on = p.id === cur.preset ? ' is-on' : '';
          return '<button type="button" class="theme-opt' + on + '" data-preset="' + p.id + '">' +
            '<span class="theme-dot" style="background:' + p.accent + '">' + p.emoji + '</span>' +
            '<span class="theme-name">' + p.label + '</span>' +
            '<span class="theme-check">✓</span>' +
          '</button>';
        }).join('') +
      '</div>' +
      '<div class="theme-custom">' +
        '<div class="theme-custom-row">' +
          '<input type="color" id="theme-color" value="' + cur.accent + '" aria-label="직접 고를 포인트 색">' +
          '<div class="theme-custom-text">' +
            '<b>내가 직접 고르기</b>' +
            '<span>색을 누르면 바로 바뀌어요 · <em id="theme-hex">' + cur.accent.toUpperCase() + '</em></span>' +
          '</div>' +
        '</div>' +
        '<div class="theme-preview" id="theme-preview">' +
          '<span class="tp-chip" id="tp-chip">포인트</span>' +
          '<span class="tp-btn" id="tp-btn">버튼</span>' +
          '<span class="tp-line">달력 · 다이어리에도 함께 적용</span>' +
        '</div>' +
      '</div>';

    UI.openSheet({
      title: '🎨 테마 색상',
      subtitle: '고르는 즉시 앱 전체 색이 바뀌어요',
      body: body,
      buttons: [
        { label: '기본으로', kind: 'ghost', keepOpen: true, onClick: function () {
            reset();
            openSheetRefresh();
            UI.toast('기본 테마로 돌렸어요');
          } },
        { label: '닫기', kind: 'primary' }
      ],
      noFocus: true,
      onMount: function (form) {
        const pick = form.querySelector('#theme-pick');
        const colorEl = form.querySelector('#theme-color');
        const hexEl = form.querySelector('#theme-hex');

        function markPreset() {
          const pid = current().preset;
          pick.querySelectorAll('[data-preset]').forEach(function (b) {
            b.classList.toggle('is-on', b.dataset.preset === pid);
          });
        }

        pick.addEventListener('click', function (e) {
          const b = e.target.closest('[data-preset]');
          if (!b) return;
          setPreset(b.dataset.preset);
          markPreset();
          colorEl.value = current().accent;
          hexEl.textContent = current().accent.toUpperCase();
          if (typeof onDone === 'function') onDone();
          UI.toast(presetOf(b.dataset.preset).label + ' 테마로 바꿨어요');
        });

        colorEl.addEventListener('input', function () {
          setCustom(colorEl.value);
          markPreset();
          hexEl.textContent = String(colorEl.value).toUpperCase();
          if (typeof onDone === 'function') onDone();
        });
        colorEl.addEventListener('change', function () {
          UI.toast('내가 고른 색으로 바꿨어요');
        });
      }
    });

    // 시트를 다시 그리지 않고 프리셋 표시만 새로 고칩니다.
    function openSheetRefresh() {
      const pick = document.getElementById('theme-pick');
      const colorEl = document.getElementById('theme-color');
      const hexEl = document.getElementById('theme-hex');
      if (!pick) return;
      const pid = current().preset;
      pick.querySelectorAll('[data-preset]').forEach(function (b) {
        b.classList.toggle('is-on', b.dataset.preset === pid);
      });
      if (colorEl) colorEl.value = current().accent;
      if (hexEl) hexEl.textContent = current().accent.toUpperCase();
      if (typeof onDone === 'function') onDone();
    }
  }

  return {
    PRESETS: PRESETS,
    init: init,
    apply: apply,
    current: current,
    presetOf: presetOf,
    setPreset: setPreset,
    setCustom: setCustom,
    reset: reset,
    openSheet: openSheet,
    palette: palette,
    mix: mix
  };
})();
