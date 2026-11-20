/* =========================================================
   ui.js — 공통 UI 도우미 (날짜/금액/토스트/시트/대화상자)
   ========================================================= */
window.UI = (function () {
  'use strict';

  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /* ---------- 날짜 ---------- */
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const pad = function (n) { return String(n).padStart(2, '0'); };

  function iso(d) {
    const x = d || new Date();
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  }
  function parseISO(s) {
    const p = String(s).split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }
  function todayISO() { return iso(new Date()); }
  function isoAdd(s, n) {
    const d = parseISO(s);
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  function weekday(s) { return WEEK[parseISO(s).getDay()]; }
  function koDate(s) {
    const d = parseISO(s);
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WEEK[d.getDay()] + ')';
  }
  function koDateFull(s) {
    const d = parseISO(s);
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + WEEK[d.getDay()] + '요일';
  }
  function dayLabel(s) {
    const t = todayISO();
    if (s === t) return '오늘';
    if (s === isoAdd(t, 1)) return '내일';
    if (s === isoAdd(t, -1)) return '어제';
    return koDate(s);
  }
  function koMonth(ym) {
    const p = String(ym).split('-').map(Number);
    return p[0] + '년 ' + p[1] + '월';
  }
  function monthShift(ym, n) {
    const p = String(ym).split('-').map(Number);
    const d = new Date(p[0], p[1] - 1 + n, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  function ymOf(s) { return String(s).slice(0, 7); }

  /* 종이 다이어리 머리글용 영문 표기 */
  const WEEK_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  function enDow(s) { return WEEK_EN[parseISO(s).getDay()]; }
  function enMon(s) { return MON_EN[parseISO(s).getMonth()]; }
  // ISO 주차 (월요일 시작, 목요일이 속한 주)
  function isoWeek(s) {
    const d = parseISO(s);
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = (t.getDay() + 6) % 7;
    t.setDate(t.getDate() - day + 3);
    const first = new Date(t.getFullYear(), 0, 4);
    const fday = (first.getDay() + 6) % 7;
    first.setDate(first.getDate() - fday + 3);
    return 1 + Math.round((t - first) / 604800000);
  }

  /* ---------- 금액 ---------- */
  function parseAmount(str) {
    return Number(String(str == null ? '' : str).replace(/[^\d-]/g, '')) || 0;
  }
  function fmtWon(n) {
    const v = Math.round(Number(n) || 0);
    return v.toLocaleString('ko-KR') + '원';
  }
  function fmtSigned(n) {
    const v = Math.round(Number(n) || 0);
    const sign = v > 0 ? '+' : (v < 0 ? '-' : '');
    return sign + Math.abs(v).toLocaleString('ko-KR') + '원';
  }
  function bindAmount(input) {
    if (!input) return;
    const apply = function () {
      const digits = String(input.value).replace(/[^\d]/g, '').slice(0, 12);
      input.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
    };
    input.addEventListener('input', apply);
    apply();
  }

  /* ---------- 사진 줄이기 ---------- */
  // 긴 변을 maxSize 픽셀로 줄이고 JPEG로 저장해 localStorage 부담을 덜어 줍니다.
  function resizeImage(file, maxSize, quality) {
    const max = maxSize || 1000;
    const q = quality || 0.72;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('이미지 파일이 아니에요'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = function () { reject(new Error('사진을 읽지 못했어요')); };
      reader.onload = function () {
        const img = new Image();
        img.onerror = function () { reject(new Error('사진을 열지 못했어요')); };
        img.onload = function () {
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (!w || !h) { reject(new Error('사진 크기를 알 수 없어요')); return; }
          if (w > max || h > max) {
            const ratio = Math.min(max / w, max / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', q);
          resolve({ dataUrl: dataUrl, width: w, height: h, bytes: Math.round(dataUrl.length * 0.75) });
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function fmtBytes(n) {
    if (n < 1024) return n + 'B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + 'KB';
    return (n / 1024 / 1024).toFixed(1) + 'MB';
  }

  /* ---------- 토스트 ---------- */
  let toastTimer = null;
  function toast(msg, ms) {
    const box = $('#toast');
    if (!box) return;
    box.textContent = msg;
    box.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.classList.remove('is-on'); }, ms || 2200);
  }

  /* ---------- 시트 / 대화상자 ---------- */
  const root = function () { return $('#sheet-root'); };
  let isOpen = false;
  let closeTimer = null;

  function lockScroll(on) {
    document.documentElement.classList.toggle('sheet-open', !!on);
    document.body.style.overflow = on ? 'hidden' : '';
  }

  function openMarkup(inner, opts) {
    const r = root();
    clearTimeout(closeTimer);
    r.innerHTML = '<div class="sheet-backdrop" data-close="1"></div>' + inner;
    r.classList.add('is-open');
    r.setAttribute('aria-hidden', 'false');
    isOpen = true;
    lockScroll(true);

    const backdrop = r.querySelector('.sheet-backdrop');
    if (backdrop && opts && opts.dismissible !== false) {
      backdrop.addEventListener('click', close);
    }
    return r;
  }

  function close() {
    const r = root();
    if (!r || !isOpen) return;
    r.classList.remove('is-open');
    r.setAttribute('aria-hidden', 'true');
    isOpen = false;
    lockScroll(false);
    closeTimer = setTimeout(function () {
      if (!isOpen) { r.innerHTML = ''; }
    }, 300);
  }

  /**
   * openSheet({ title, subtitle, body, buttons, onMount, noFocus })
   * buttons: [{ label, kind:'primary'|'ghost'|'danger'|'plain', onClick(form, close), submit:true }]
   */
  function openSheet(opts) {
    const buttons = opts.buttons || [];
    const foot = buttons.map(function (b, i) {
      const kind = b.kind === 'primary' ? 'primary' : (b.kind === 'danger' ? 'danger' : (b.kind === 'ghost' ? 'ghost' : ''));
      const type = b.submit ? 'submit' : 'button';
      return '<button type="' + type + '" class="btn ' + kind + '" data-btn="' + i + '">' + esc(b.label) + '</button>';
    }).join('');

    const html =
      '<section class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || '') + '">' +
        '<div class="sheet-grab"></div>' +
        '<header class="sheet-head"><h2>' + esc(opts.title || '') + '</h2>' +
          (opts.subtitle ? '<p>' + esc(opts.subtitle) + '</p>' : '') +
        '</header>' +
        '<form class="sheet-form" id="sheet-form" novalidate>' +
          '<div class="sheet-body">' + (opts.body || '') + '</div>' +
          (foot ? '<footer class="sheet-foot">' + foot + '</footer>' : '') +
        '</form>' +
      '</section>';

    const r = openMarkup(html, opts);
    const sheet = r.querySelector('.sheet');
    const form = r.querySelector('#sheet-form');

    buttons.forEach(function (b, i) {
      const btn = r.querySelector('[data-btn="' + i + '"]');
      if (!btn) return;
      btn.addEventListener('click', function (ev) {
        if (btn.type === 'submit') return; // 폼 제출 쪽에서 한 번만 처리
        ev.preventDefault();
        if (typeof b.onClick === 'function') {
          const keep = b.onClick(form, close);
          if (keep === false) return;
        }
        if (!b.keepOpen) close();
      });
    });

    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        const primary = buttons.find(function (b) { return b.submit; }) || buttons.find(function (b) { return b.kind === 'primary'; });
        if (primary && typeof primary.onClick === 'function') {
          const keep = primary.onClick(form, close);
          if (keep === false) return;
          if (!primary.keepOpen) close();
        }
      });
    }

    // 아래로 스와이프해서 닫기
    let startY = null;
    sheet.addEventListener('touchstart', function (e) {
      if (sheet.querySelector('.sheet-body').scrollTop > 0) return;
      startY = e.touches[0].clientY;
    }, { passive: true });
    sheet.addEventListener('touchmove', function (e) {
      if (startY == null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) sheet.style.transform = 'translate(-50%,' + dy + 'px)';
    }, { passive: true });
    sheet.addEventListener('touchend', function () {
      if (startY == null) return;
      const dy = parseFloat((sheet.style.transform.match(/,\s*(-?\d+(?:\.\d+)?)px/) || [0, 0])[1]) || 0;
      sheet.style.transform = '';
      startY = null;
      if (dy > 90) close();
    });

    if (typeof opts.onMount === 'function') opts.onMount(form, r);

    if (!opts.noFocus) {
      const first = form && form.querySelector('input:not([type="hidden"]):not([type="date"]), textarea');
      if (first) {
        // 키보드가 올라오며 화면이 밀리지 않도록 살짝 늦게
        setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) {} }, 120);
      }
    }
    return { close: close, root: r, form: form };
  }

  /**
   * openDialog({ title, message, buttons:[{label, kind, onClick}] })
   */
  function openDialog(opts) {
    const buttons = opts.buttons || [];
    const acts = buttons.map(function (b, i) {
      const kind = b.kind === 'primary' ? 'primary' : (b.kind === 'danger' ? 'danger' : (b.kind === 'ghost' ? 'ghost' : ''));
      return '<button type="button" class="btn ' + kind + '" data-btn="' + i + '">' + esc(b.label) + '</button>';
    }).join('');

    const html =
      '<section class="dialog-card" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || '') + '">' +
        '<h3>' + esc(opts.title || '') + '</h3>' +
        '<p>' + (opts.html || esc(opts.message || '')) + '</p>' +
        '<div class="dialog-acts">' + acts + '</div>' +
      '</section>';

    const r = openMarkup(html, { dismissible: true });
    buttons.forEach(function (b, i) {
      const btn = r.querySelector('[data-btn="' + i + '"]');
      if (!btn) return;
      btn.addEventListener('click', function () {
        close();
        if (typeof b.onClick === 'function') b.onClick();
      });
    });
    return { close: close };
  }

  function confirmDialog(opts) {
    return openDialog({
      title: opts.title,
      message: opts.message,
      buttons: [
        { label: opts.cancelLabel || '취소', kind: 'ghost' },
        { label: opts.confirmLabel || '확인', kind: opts.danger ? 'danger' : 'primary', onClick: opts.onConfirm }
      ]
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) close();
  });

  /* ---------- 기타 ---------- */
  function debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  function relTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '방금';
    if (diff < 3600) return Math.floor(diff / 60) + '분 전';
    if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }

  return {
    $: $, $$: $$, esc: esc, el: el,
    iso: iso, parseISO: parseISO, todayISO: todayISO, isoAdd: isoAdd,
    weekday: weekday, koDate: koDate, koDateFull: koDateFull, dayLabel: dayLabel,
    koMonth: koMonth, monthShift: monthShift, ymOf: ymOf, WEEK: WEEK,
    enDow: enDow, enMon: enMon, isoWeek: isoWeek,
    parseAmount: parseAmount, fmtWon: fmtWon, fmtSigned: fmtSigned, bindAmount: bindAmount,
    resizeImage: resizeImage, fmtBytes: fmtBytes,
    toast: toast, openSheet: openSheet, closeSheet: close, openDialog: openDialog, confirmDialog: confirmDialog,
    debounce: debounce, relTime: relTime
  };
})();
