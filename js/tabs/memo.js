/* =========================================================
   tabs/memo.js — 메모
   · 포스트잇 : 색색의 카드
   · 공책    : 줄노트 한 페이지에 길게 쓰고 좌우로 넘기는 메모장
   · 글자 서식(공책·포스트잇 모두) : 굵게 · 밑줄 · 취소선 · 크기 · 형광펜 · 글자색
   · 저장은 m.html(서식 HTML)과 m.text(순수 글자)를 함께 갱신해
     예전 메모·검색·백업과 그대로 호환됩니다.
   ========================================================= */
(function () {
  'use strict';
  const T = (window.Tabs = window.Tabs || {});

  const ICON = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4.2-1 9.3-9.3a2.1 2.1 0 0 0-3-3L5.2 16z"/><path d="M14.2 6.8l3 3"/></svg>',
    eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.4 19.4H5.6a1.4 1.4 0 0 1-1-.4l-1.5-1.5a1.4 1.4 0 0 1 0-2l8.2-8.2a1.4 1.4 0 0 1 2 0l3.6 3.6a1.4 1.4 0 0 1 0 2l-6.5 6.5z"/><path d="M20.5 19.4h-6.6"/></svg>'
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

  /* ---------- 서식 팔레트 ---------- */
  const MARK_COLORS = [
    { id: 'yellow', hex: '#FFF07A', label: '노랑' },
    { id: 'green', hex: '#C9F2A6', label: '연두' },
    { id: 'pink', hex: '#FFC7DA', label: '분홍' },
    { id: 'blue', hex: '#BFE4FF', label: '하늘' }
  ];
  const FG_COLORS = [
    { id: 'ink', hex: '#3F3931', label: '검정' },
    { id: 'red', hex: '#C2461B', label: '빨강' },
    { id: 'blue', hex: '#1B63C2', label: '파랑' },
    { id: 'green', hex: '#1C7A46', label: '초록' }
  ];
  const SIZES = [
    { id: 'small', px: 12, label: '작게', cmd: '2' },
    { id: 'normal', px: 14.5, label: '보통', cmd: '3' },
    { id: 'large', px: 18, label: '크게', cmd: '5' },
    { id: 'huge', px: 22, label: '아주 크게', cmd: '7' }
  ];
  const SIZE_BY_KEYWORD = {
    'xx-small': 10, 'x-small': 11, 'small': 12, 'medium': 0,
    'large': 16.5, 'x-large': 18, 'xx-large': 20, 'xxx-large': 22
  };
  const BASE_PX = 14.5;              // 공책·시트 기본 글자 크기

  let host = null;
  let mode = (function () {
    try { return localStorage.getItem('myDiaryApp.memoMode') || 'postit'; } catch (e) { return 'postit'; }
  })();
  let nbId = null;             // 공책에서 보고 있는 메모 id
  let saveTimer = null;
  const freshIds = {};         // 이번에 새로 만든 쪽(비어 있으면 정리)

  /* ============================================================
     1. 서식 HTML 다루기 (만들기 · 정리 · 글자만 뽑기)
     ============================================================ */
  const OK_TAGS = {
    B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, STRIKE: 1, DEL: 1,
    SPAN: 1, FONT: 1, MARK: 1, BR: 1, DIV: 1, P: 1
  };
  const DROP_TAGS = {
    SCRIPT: 1, STYLE: 1, IFRAME: 1, FRAME: 1, OBJECT: 1, EMBED: 1, APPLET: 1,
    LINK: 1, META: 1, BASE: 1, IMG: 1, PICTURE: 1, SVG: 1, MATH: 1, CANVAS: 1,
    FORM: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, LABEL: 1,
    VIDEO: 1, AUDIO: 1, SOURCE: 1, TRACK: 1, TEMPLATE: 1, NOSCRIPT: 1, SLOT: 1,
    A: 1, TABLE: 1, THEAD: 1, TBODY: 1, TFOOT: 1, TR: 1, TD: 1, TH: 1
  };

  function isColorValue(v) {
    const s = String(v || '').trim();
    if (!s || s.length > 40) return false;
    if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return true;
    if (/^rgba?\(\s*[\d.,%\s/]+\)$/i.test(s)) return true;
    if (/^hsla?\(\s*[\d.,%\s/]+\)$/i.test(s)) return true;
    if (/^[a-zA-Z]{3,20}$/.test(s)) return !/^(url|expression|javascript|var|calc)$/i.test(s);
    return false;
  }

  // 글자 크기: px 값만 받고, 브라우저가 넣는 keyword 는 우리 크기(px)로 바꿉니다.
  function cleanFontSize(v) {
    const s = String(v || '').trim().toLowerCase();
    const m = /^(\d+(?:\.\d+)?)px$/.exec(s);
    if (m) {
      const n = Math.round(parseFloat(m[1]));
      return n >= 9 && n <= 40 ? n + 'px' : '';
    }
    if (Object.prototype.hasOwnProperty.call(SIZE_BY_KEYWORD, s)) {
      const n = SIZE_BY_KEYWORD[s];
      return n ? n + 'px' : '';
    }
    return '';
  }

  function filterStyle(str) {
    if (!str) return '';
    const out = [];
    String(str).split(';').forEach(function (part) {
      const i = part.indexOf(':');
      if (i < 0) return;
      const prop = part.slice(0, i).trim().toLowerCase();
      let val = part.slice(i + 1).trim();
      if (!prop || !val || val.length > 60) return;
      if (prop === 'color' || prop === 'background-color') {
        if (isColorValue(val)) out.push(prop + ':' + val);
        return;
      }
      if (prop === 'font-size') {
        const px = cleanFontSize(val);
        if (px) out.push('font-size:' + px);
        return;
      }
      if (prop === 'font-weight') {
        if (/^(bold|normal|[1-9]00)$/i.test(val)) out.push('font-weight:' + val.toLowerCase());
        return;
      }
      if (prop === 'font-style') {
        if (/^(italic|normal)$/i.test(val)) out.push('font-style:' + val.toLowerCase());
        return;
      }
      if (prop === 'text-decoration' || prop === 'text-decoration-line') {
        val = val.toLowerCase().replace(/\s+/g, ' ');
        if (/^(none|underline|line-through|overline|underline line-through|line-through underline)( solid)?$/.test(val)) {
          out.push('text-decoration:' + val.replace(/ solid$/, ''));
        }
      }
    });
    return out.join(';');
  }

  function cleanNode(parent) {
    const kids = Array.prototype.slice.call(parent.childNodes);
    for (let i = 0; i < kids.length; i++) {
      const n = kids[i];
      if (!n || !n.parentNode) continue;
      if (n.nodeType === 3) {
        n.nodeValue = String(n.nodeValue).replace(/[\u200B\uFEFF]/g, '');
        continue;
      }
      if (n.nodeType !== 1) { n.parentNode.removeChild(n); continue; }
      const tag = n.tagName;
      if (DROP_TAGS[tag]) { n.parentNode.removeChild(n); continue; }
      if (!OK_TAGS[tag]) {
        // 허용하지 않는 태그는 안의 글자만 남깁니다.
        cleanNode(n);
        while (n.firstChild) parent.insertBefore(n.firstChild, n);
        parent.removeChild(n);
        continue;
      }
      let style = filterStyle(n.getAttribute('style'));
      const fColor = tag === 'FONT' ? (n.getAttribute('color') || '') : '';
      const fSize = tag === 'FONT' ? (n.getAttribute('size') || '') : '';
      Array.prototype.slice.call(n.attributes).forEach(function (a) { n.removeAttribute(a.name); });
      if (tag === 'FONT') {
        const map = { 1: '10px', 2: '12px', 3: '', 4: '16.5px', 5: '18px', 6: '20px', 7: '22px' };
        if (map[fSize]) style = 'font-size:' + map[fSize] + (style ? ';' + style : '');
        if (isColorValue(fColor)) style = 'color:' + fColor + (style ? ';' + style : '');
        const sp = document.createElement('span');
        if (style) sp.setAttribute('style', style);
        while (n.firstChild) sp.appendChild(n.firstChild);
        parent.replaceChild(sp, n);
        cleanNode(sp);
        continue;
      }
      if (style) n.setAttribute('style', style);
      cleanNode(n);
    }
  }

  /** 위험한 태그·속성을 걷어낸 안전한 HTML 로 되돌립니다. */
  function sanitizeHTML(html) {
    let s = String(html == null ? '' : html);
    if (!s) return '';
    if (s.length > 80000) s = s.slice(0, 80000);
    const tpl = document.createElement('template');
    tpl.innerHTML = s;
    cleanNode(tpl.content);
    return tpl.innerHTML;
  }

  /** 서식 HTML → 순수 글자(검색·미리보기·백업 호환용) */
  function htmlToText(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html == null ? '' : html);
    const out = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) { out.push(String(n.nodeValue)); return; }
        if (n.nodeType !== 1) return;
        if (n.tagName === 'BR') { out.push('\n'); return; }
        const block = n.tagName === 'DIV' || n.tagName === 'P';
        if (block && out.length && out[out.length - 1].slice(-1) !== '\n') out.push('\n');
        walk(n);
        if (block && out.length && out[out.length - 1].slice(-1) !== '\n') out.push('\n');
      });
    })(tpl.content);
    return out.join('')
      .replace(/[\u200B\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+$/, '')
      .replace(/^\n+/, '');
  }

  /** 순수 글자 → 우리 서식 HTML (줄바꿈 그대로) */
  function textToHTML(text) {
    const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    return lines.map(function (l) {
      return '<div>' + (l ? UI.esc(l) : '<br>') + '</div>';
    }).join('');
  }

  /** 메모 하나의 서식 HTML (예전 메모는 m.text 에서 안전하게 만들어 냅니다) */
  function memoHTML(m) {
    const raw = m && typeof m.html === 'string' ? sanitizeHTML(m.html) : '';
    if (raw && htmlToText(raw).trim()) return raw;
    return textToHTML(m && m.text);
  }

  /** 포스트잇 카드용: 태그는 살리고 문단은 줄바꿈으로, 글자 크기는 뺍니다. */
  function previewHTML(m) {
    const tpl = document.createElement('template');
    tpl.innerHTML = memoHTML(m);
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType !== 1) return;
        walk(n);
        if (n.tagName === 'DIV' || n.tagName === 'P') {
          while (n.firstChild) node.insertBefore(n.firstChild, n);
          node.insertBefore(document.createElement('br'), n);
          node.removeChild(n);
        }
      });
    })(tpl.content);
    Array.prototype.slice.call(tpl.content.querySelectorAll('[style]')).forEach(function (n) {
      const keep = String(n.getAttribute('style') || '').split(';').filter(function (p) {
        return p && !/^\s*font-size/i.test(p);
      }).join(';');
      if (keep) n.setAttribute('style', keep); else n.removeAttribute('style');
    });
    return String(tpl.innerHTML).replace(/(?:<br>)+$/, '').replace(/^(?:<br>)+/, '');
  }

  /* ============================================================
     2. 글자 서식 실행 (선택 영역 · 커서 유지)
     ============================================================ */
  function hexToRgb(hex) {
    const h = String(hex || '').replace('#', '');
    const n = h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h;
    return 'rgb(' + parseInt(n.slice(0, 2), 16) + ', ' + parseInt(n.slice(2, 4), 16) + ', ' + parseInt(n.slice(4, 6), 16) + ')';
  }

  function execCmd(cmd, val) {
    try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
    try { return document.execCommand(cmd, false, val == null ? null : val); } catch (e) { return false; }
  }

  function restoreSel(ed) {
    const sel = window.getSelection();
    if (!sel || !ed) return;
    if (sel.rangeCount) {
      const r0 = sel.getRangeAt(0);
      if (r0 && ed.contains(r0.commonAncestorContainer)) return;
    }
    const saved = ed._rtRange;
    if (saved && ed.contains(saved.startContainer) && ed.contains(saved.endContainer)) {
      try { sel.removeAllRanges(); sel.addRange(saved); return; } catch (e) {}
    }
    const r = document.createRange();
    r.selectNodeContents(ed);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  function saveSel(ed) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !ed) return;
    const r = sel.getRangeAt(0);
    if (!ed.contains(r.commonAncestorContainer)) return;
    try { ed._rtRange = r.cloneRange(); } catch (e) {}
  }

  // 글자 크기별 줄 높이 — 줄노트의 28px 줄에 그대로 앉도록 맞춰 둡니다.
  // (저장할 때는 line-height 를 지우고, 화면에 그릴 때만 붙입니다)
  const SIZE_LINE_HEIGHT = { '12px': '26px', '18px': '25px', '22px': '21px' };

  // 브라우저가 넣은 글자 크기(keyword)를 우리 px 크기로 바꿔 둡니다.
  function normalizeSizes(ed) {
    if (!ed) return;
    const nodes = ed.querySelectorAll('span[style],font');
    Array.prototype.forEach.call(nodes, function (n) {
      const cur = n.getAttribute('style') || '';
      if (cur && !/font-size/i.test(cur)) return;
      let next = filterStyle(cur);
      const m = /font-size:\s*([\d.]+px)/i.exec(next);
      if (m) {
        const lh = SIZE_LINE_HEIGHT[m[1].toLowerCase()] || '';
        if (lh) next += ';line-height:' + lh;
      }
      if (next !== cur) n.setAttribute('style', next);
    });
  }

  function caretEl(ed) {
    const sel = window.getSelection();
    let node = null;
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0);
      if (ed.contains(r.startContainer)) node = r.startContainer;
    }
    if (!node && ed._rtRange && ed.contains(ed._rtRange.startContainer)) node = ed._rtRange.startContainer;
    if (!node) return null;
    const el = node.nodeType === 1 ? node : node.parentElement;
    return el && ed.contains(el) ? el : null;
  }

  function setBtnOn(bar, kind, on) {
    if (!bar) return;
    bar.querySelectorAll('[data-rt="' + kind + '"]').forEach(function (b) {
      b.classList.toggle('is-on', !!on);
      if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function syncBarFor(ed) {
    const bar = ed && ed._rtBar;
    if (!bar) return;
    let b = false, u = false, s = false;
    try {
      b = document.queryCommandState('bold');
      u = document.queryCommandState('underline');
      s = document.queryCommandState('strikeThrough');
    } catch (e) {}
    setBtnOn(bar, 'bold', b);
    setBtnOn(bar, 'underline', u);
    setBtnOn(bar, 'strike', s);

    let fs = 0, bg = '', fg = '';
    const el = caretEl(ed);
    if (el) {
      try {
        const st = window.getComputedStyle(el);
        fs = parseFloat(st.fontSize) || 0;
        bg = st.backgroundColor || '';
        fg = st.color || '';
      } catch (e) {}
    }
    let bestId = '';
    let diff = 99;
    SIZES.forEach(function (z) {
      const d = Math.abs(z.px - fs);
      if (d < diff) { diff = d; bestId = z.id; }
    });
    if (diff > 2) bestId = '';
    bar.querySelectorAll('[data-rt="size"]').forEach(function (x) {
      x.classList.toggle('is-on', x.dataset.size === bestId);
    });
    bar.querySelectorAll('[data-rt="mark"]').forEach(function (x) {
      x.classList.toggle('is-on', !!bg && bg === hexToRgb(x.dataset.hex));
    });
    bar.querySelectorAll('[data-rt="color"]').forEach(function (x) {
      x.classList.toggle('is-on', !!fg && fg === hexToRgb(x.dataset.hex));
    });
  }

  function applySize(ed, sizeId) {
    const z = SIZES.find(function (x) { return x.id === sizeId; });
    if (!z) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const r = sel.getRangeAt(0);

    if (r.collapsed) {
      // 커서만 있을 때: 이어서 치는 글자에 크기가 붙도록 표시용 span 을 넣습니다.
      const span = document.createElement('span');
      span.setAttribute('style', 'font-size:' + z.px + 'px');
      span.appendChild(document.createTextNode('\u200B'));
      try { r.insertNode(span); } catch (e) { return; }
      const nr = document.createRange();
      nr.setStart(span.firstChild, 1);
      nr.collapse(true);
      sel.removeAllRanges();
      sel.addRange(nr);
      try { ed._rtRange = nr.cloneRange(); } catch (e) {}
      return;
    }
    execCmd('fontSize', z.cmd);
    normalizeSizes(ed);
  }

  /**
   * 툴바 연결. bar 안의 버튼을 누르면 ed 의 선택 영역에 서식을 넣습니다.
   * (버튼을 누를 때 선택 영역이 날아가지 않도록 mousedown 을 막고,
   *  터치에서는 마지막 선택 영역을 기억했다가 되살립니다.)
   */
  function bindToolbar(bar, getEditor, onEdit) {
    if (!bar) return;
    const ed = getEditor();
    if (!ed) return;
    ed._rtBar = bar;

    bar.addEventListener('mousedown', function (e) {
      if (e.target.closest('button')) e.preventDefault();
    });
    bar.addEventListener('touchstart', function (e) {
      saveSel(ed);                        // 손가락이 닿는 순간의 선택 영역을 기억
      e.stopPropagation();                // 시트 끌어내리기·쪽 넘기기와 겹치지 않게
    }, { passive: true });

    bar.addEventListener('click', function (e) {
      const btn = e.target.closest('button[data-rt]');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      ed.focus({ preventScroll: true });
      restoreSel(ed);

      const kind = btn.dataset.rt;
      if (kind === 'bold') execCmd('bold');
      else if (kind === 'underline') execCmd('underline');
      else if (kind === 'strike') execCmd('strikeThrough');
      else if (kind === 'size') applySize(ed, btn.dataset.size);
      else if (kind === 'mark') execCmd('hiliteColor', btn.dataset.hex);
      else if (kind === 'markOff') execCmd('hiliteColor', 'transparent');
      else if (kind === 'color') execCmd('foreColor', btn.dataset.hex);
      else if (kind === 'clear') {
        execCmd('removeFormat');
        execCmd('hiliteColor', 'transparent');
      }
      normalizeSizes(ed);
      syncEmpty(ed);
      syncBarFor(ed);
      if (typeof onEdit === 'function') onEdit();
    });

    // 버튼을 누른 뒤에도 선택 영역을 기억해 둡니다.
    bar.addEventListener('mouseup', function () { saveSel(ed); });
  }

  let selWatched = false;
  function watchSelection() {
    if (selWatched) return;
    selWatched = true;
    document.addEventListener('selectionchange', function () {
      const list = Array.prototype.slice.call(document.querySelectorAll('#nb-text, #memo-text'));
      if (!list.length) return;
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      const c = r.commonAncestorContainer;
      for (let i = 0; i < list.length; i++) {
        if (list[i].contains(c)) {
          try { list[i]._rtRange = r.cloneRange(); } catch (e) {}
          syncBarFor(list[i]);
          return;
        }
      }
    });
  }

  function syncEmpty(ed) {
    if (!ed) return;
    const t = String(ed.textContent || '').replace(/[\u200B\uFEFF]/g, '').trim();
    ed.setAttribute('data-empty', t ? '0' : '1');
  }

  function bindRichInput(ed) {
    // 붙여넣기는 글자만(서식은 앱 밖에서 온 것 그대로 가져오지 않습니다)
    ed.addEventListener('paste', function (e) {
      if (!e.clipboardData) return;
      e.preventDefault();
      const text = String(e.clipboardData.getData('text/plain') || '').replace(/\r\n?/g, '\n');
      if (text) execCmd('insertText', text);
      normalizeSizes(ed);
      syncEmpty(ed);
    });
    // 끌어다 놓기로 사진·링크가 들어오지 않게
    ed.addEventListener('drop', function (e) { e.preventDefault(); });
    ed.addEventListener('dragover', function (e) { e.preventDefault(); });
  }

  function placeCaret(ed, atEnd) {
    if (!ed) return;
    try { ed.focus({ preventScroll: true }); } catch (e) {}
    const r = document.createRange();
    r.selectNodeContents(ed);
    r.collapse(!atEnd);
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(r);
    try { ed._rtRange = r.cloneRange(); } catch (e) {}
  }

  /* ---------- 툴바 마크업 ---------- */
  function toolbarHTML(id) {
    const row1 =
      '<div class="rt-row">' +
        '<button type="button" class="rt-b rt-bb" data-rt="bold" aria-label="굵게" aria-pressed="false" title="굵게"><b>B</b></button>' +
        '<button type="button" class="rt-b rt-bu" data-rt="underline" aria-label="밑줄" aria-pressed="false" title="밑줄"><u>U</u></button>' +
        '<button type="button" class="rt-b rt-bs" data-rt="strike" aria-label="취소선" aria-pressed="false" title="취소선"><s>S</s></button>' +
        '<span class="rt-sep"></span>' +
        SIZES.map(function (z) {
          return '<button type="button" class="rt-b rt-size" data-rt="size" data-size="' + z.id + '" aria-label="글자 ' + z.label + '" title="글자 ' + z.label + '" style="font-size:' + (z.px - 1.5) + 'px">가</button>';
        }).join('') +
        '<span class="rt-sep"></span>' +
        '<button type="button" class="rt-b" data-rt="clear" aria-label="서식 지우기" title="서식 지우기">' + ICON.eraser + '</button>' +
      '</div>';
    const row2 =
      '<div class="rt-row">' +
        '<span class="rt-lab">형광</span>' +
        MARK_COLORS.map(function (c) {
          return '<button type="button" class="rt-dot" data-rt="mark" data-hex="' + c.hex + '" style="background:' + c.hex + '" aria-label="형광펜 ' + c.label + '" title="형광펜 ' + c.label + '"></button>';
        }).join('') +
        '<button type="button" class="rt-b rt-off" data-rt="markOff" aria-label="형광펜 없애기" title="형광펜 없애기">✕</button>' +
        '<span class="rt-sep"></span>' +
        '<span class="rt-lab">글자</span>' +
        FG_COLORS.map(function (c) {
          return '<button type="button" class="rt-dot" data-rt="color" data-hex="' + c.hex + '" style="background:' + c.hex + '" aria-label="글자색 ' + c.label + '" title="글자색 ' + c.label + '"></button>';
        }).join('') +
      '</div>';
    return '<div class="rt-bar" id="' + id + '" role="toolbar" aria-label="글자 서식">' + row1 + row2 + '</div>';
  }

  /* ============================================================
     3. 목록 · 포스트잇
     ============================================================ */
  function sorted() {
    return Store.all('memo').slice().sort(function (a, b) {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
    });
  }

  function setMode(m) {
    if (mode === m) return;
    flush();
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

  function cardHTML(m) {
    const preview = previewHTML(m);
    return '' +
      '<div class="memo-card ' + colorCls(m.color) + (m.pinned ? ' is-pinned' : '') + '" data-id="' + m.id + '">' +
        '<button type="button" class="mc-open" data-act="open">' +
          '<span class="txt">' + (preview ? preview : '<span class="mc-empty">빈 메모 — 눌러서 쓰기</span>') + '</span>' +
          '<span class="ft"><span>' + (m.pinned ? '📌 ' : '') + UI.relTime(m.updatedAt || m.createdAt) + '</span></span>' +
        '</button>' +
        '<button type="button" class="mc-edit" data-act="edit" aria-label="메모 고치기">' + ICON.pen + '</button>' +
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

  /* ============================================================
     4. 공책
     ============================================================ */
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
    const html = memoHTML(m);

    return '' +
      '<div class="nb-bar">' +
        '<span class="nb-count">' + (idx + 1) + ' / ' + list.length + ' 쪽</span>' +
        '<span class="nb-auto">적으면 바로 저장돼요</span>' +
        '<button type="button" class="nb-tool" data-nav="meta" aria-label="이 쪽 색·고정·고치기">' + ICON.pen + '</button>' +
      '</div>' +
      '<div class="nb-slot" id="nb-slot">' +
        '<div class="nb-page ' + colorCls(m.color) + '" id="nb-page">' +
          '<div class="nb-head">' +
            '<span class="nb-no">No. ' + (idx + 1) + '</span>' +
            '<span class="nb-date">' + dateStr + (m.pinned ? ' · 📌' : '') + '</span>' +
          '</div>' +
          toolbarHTML('rt-bar') +
          '<div class="nb-lines" id="nb-text" contenteditable="true" role="textbox" aria-multiline="true" ' +
            'spellcheck="false" data-ph="생각, 기억해 둘 것, 오늘의 메모…" data-empty="' + (htmlToText(html).trim() ? '0' : '1') + '">' + html + '</div>' +
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

  /* ---------- 저장 ---------- */
  function saveEditor(el, id) {
    if (!el || !id) return;
    const m = Store.find('memo', id);
    if (!m) return;
    normalizeSizes(el);
    const html = sanitizeHTML(el.innerHTML);
    const text = htmlToText(el.innerHTML);
    if ((m.html || '') === html && (m.text || '') === text) return;
    Store.update('memo', id, { html: html, text: text });
  }

  function scheduleSave(el, id) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveEditor(el, id); }, 400);
  }

  function flush() {
    const el = host && host.querySelector('#nb-text');
    if (!el) return;
    clearTimeout(saveTimer);
    const m = currentMemo();
    if (m) saveEditor(el, m.id);
  }

  function pruneFresh() {
    const el = host && host.querySelector('#nb-text');
    const cur = currentMemo();
    Object.keys(freshIds).forEach(function (id) {
      const row = Store.find('memo', id);
      if (!row) { delete freshIds[id]; return; }
      let text = String(row.text || '').trim();
      if (cur && cur.id === id && el) text = htmlToText(el.innerHTML).trim();
      if (!text) {
        Store.remove('memo', id);
        if (nbId === id) nbId = null;
      }
      delete freshIds[id];
    });
  }

  function goNb(step) {
    if (step === 'new') {
      flush();
      const m = Store.add('memo', { text: '', html: '', color: COLORS[Store.all('memo').length % COLORS.length].id, pinned: false });
      freshIds[m.id] = true;
      nbId = m.id;
      render();
      placeCaret(host.querySelector('#nb-text'), false);
      return;
    }
    if (step === 'meta') {
      flush();
      const m = currentMemo();
      if (m) openEditor(m);
      return;
    }
    flush();
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

  /* ============================================================
     5. 그리기 · 이벤트
     ============================================================ */
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
      normalizeSizes(text);
      syncEmpty(text);
      watchSelection();
      bindToolbar(host.querySelector('#rt-bar'), function () { return text; }, function () {
        scheduleSave(text, nbId);
      });
      bindRichInput(text);
      text.addEventListener('input', function () {
        syncEmpty(text);
        normalizeSizes(text);
        scheduleSave(text, nbId);
      });
      text.addEventListener('blur', function () { flush(); });
      text.addEventListener('keyup', function () { saveSel(text); syncBarFor(text); });
      text.addEventListener('mouseup', function () { saveSel(text); syncBarFor(text); });
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
        if (e.target.closest && e.target.closest('#nb-text, .rt-bar')) { tracking = false; return; }
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

  /* ============================================================
     6. 메모 고치기 시트 (글자 서식 · 색 · 고정)
     ============================================================ */
  function openEditor(memo) {
    const isNew = !memo;
    let color = isNew ? 'cream' : (memo.color || 'cream');
    let pinned = isNew ? false : !!memo.pinned;

    const body = '' +
      '<div class="field">' +
        toolbarHTML('memo-rt') +
        '<div class="input memo-rich" id="memo-text" contenteditable="true" role="textbox" aria-multiline="true" ' +
          'spellcheck="false" data-ph="생각, 할 일, 기억해 둘 것…" data-empty="1"></div>' +
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
          const el = form.querySelector('#memo-text');
          if (!el) return false;
          normalizeSizes(el);
          const html = sanitizeHTML(el.innerHTML);
          const text = htmlToText(el.innerHTML);
          if (isNew && !text.trim()) {
            try { el.focus({ preventScroll: true }); } catch (e) {}
            UI.toast('내용을 적어 주세요');
            return false;
          }
          if (isNew) {
            const row = Store.add('memo', { text: text, html: html, color: color, pinned: pinned });
            nbId = row.id;
          } else {
            Store.update('memo', memo.id, { text: text, html: html, color: color, pinned: pinned });
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
      title: isNew ? '메모 쓰기' : '메모 고치기',
      subtitle: isNew ? '' : '공책에서 바로 고쳐도 저장돼요',
      body: body,
      buttons: buttons,
      noFocus: true,
      onMount: function (form) {
        const el = form.querySelector('#memo-text');
        if (el) {
          el.innerHTML = isNew ? '' : memoHTML(memo);
          normalizeSizes(el);
          syncEmpty(el);
          watchSelection();
          bindToolbar(form.querySelector('#memo-rt'), function () { return el; });
          bindRichInput(el);
          el.addEventListener('input', function () {
            syncEmpty(el);
            normalizeSizes(el);
          });
          el.addEventListener('keyup', function () { saveSel(el); syncBarFor(el); });
          el.addEventListener('mouseup', function () { saveSel(el); syncBarFor(el); });
          // 시트를 아래로 끌어내리는 동작이 글쓰기·버튼 누르기와 겹치지 않게
          ['touchstart', 'touchmove'].forEach(function (ev) {
            el.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true });
          });
          const bar = form.querySelector('#memo-rt');
          if (bar) {
            ['touchstart', 'touchmove'].forEach(function (ev) {
              bar.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true });
            });
          }
          setTimeout(function () {
            placeCaret(el, isNew ? false : true);
            syncBarFor(el);
          }, 180);
        }

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
      if (mode === 'note') { flush(); pruneFresh(); }
    }
  };
})();
