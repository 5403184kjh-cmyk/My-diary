/* =========================================================
   tabs/finance.js — 가계부
   · 일반 가계부  : 생활 수입·지출
   · 재테크 가계부: 카드테크·포인트·주식·투자
   두 장부는 완전히 따로 계산됩니다. 내역 / 통계(원형 그래프)
   ========================================================= */
(function () {
  'use strict';
  const T = (window.Tabs = window.Tabs || {});

  const ICON = {
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
  };

  const BOOKS = {
    general: { id: 'general', label: '일반 가계부', short: '일반', sub: '생활 수입·지출' },
    invest: { id: 'invest', label: '재테크 가계부', short: '재테크', sub: '카드테크·포인트·주식' }
  };
  const BOOK_ORDER = ['general', 'invest'];

  const CATS = {
    general: {
      expense: ['식비', '장보기', '카페', '교통', '생활', '의료', '교육', '기타'],
      income: ['급여', '부수입', '중고거래', '환급', '용돈', '기타']
    },
    invest: {
      income: ['카드테크', '포인트&현금', '주식', '투자', '공모주', '이자/배당', '기타'],
      expense: ['수수료', '세금', '손실', '기타']
    }
  };

  const TYPES = {
    income: { label: '수입', cls: 'inc', sign: 1 },
    expense: { label: '지출', cls: 'exp', sign: -1 }
  };

  // 원형 그래프 색 (밝고 선명하게)
  const PIE_COLORS = ['#E0552F', '#C97D0A', '#AE8400', '#2E8B57', '#2276C4', '#7050C8', '#D23A75', '#857A6C'];

  let host = null;
  let ym = UI.ymOf(UI.todayISO());
  let book = 'general';
  let view = 'list';          // list | stats
  let filter = 'all';         // all | income | expense
  let statType = 'income';    // stats에서 보고 있는 구분

  /* ---------- 데이터 ---------- */
  function bookItems() {
    return Store.all('finance').filter(function (x) {
      return (x.book || 'general') === book && UI.ymOf(x.date) === ym;
    });
  }

  function sumOf(list, type) {
    return list.filter(function (x) { return x.type === type; })
      .reduce(function (a, x) { return a + (Number(x.amount) || 0); }, 0);
  }

  function monthTag() {
    const cur = UI.ymOf(UI.todayISO());
    const p = ym.split('-').map(Number), c = cur.split('-').map(Number);
    const diff = (p[0] - c[0]) * 12 + (p[1] - c[1]);
    if (diff === 0) return '이번 달';
    if (diff === -1) return '지난 달';
    if (diff === 1) return '다음 달';
    return Math.abs(diff) + '개월 ' + (diff < 0 ? '전' : '후');
  }

  function amountText(item) {
    const t = TYPES[item.type] || TYPES.expense;
    return (t.sign < 0 ? '-' : '+') + Number(item.amount || 0).toLocaleString('ko-KR') + '원';
  }

  function groupByDate(list) {
    const map = {};
    list.forEach(function (x) {
      (map[x.date] = map[x.date] || []).push(x);
    });
    return Object.keys(map).sort().reverse().map(function (d) {
      return { date: d, items: map[d] };
    });
  }

  /* ---------- 머리 ---------- */
  function bookSwitchHTML() {
    return '<div class="seg seg-top seg-2">' +
      BOOK_ORDER.map(function (b) {
        return '<button type="button" data-book="' + b + '" class="' + (book === b ? 'is-on' : '') + '">' + BOOKS[b].label + '</button>';
      }).join('') +
    '</div>';
  }

  function summaryHTML(list) {
    const inc = sumOf(list, 'income');
    const exp = sumOf(list, 'expense');
    const net = inc - exp;
    return '' +
      '<section class="summary summary-' + book + '">' +
        '<div class="summary-top">' +
          '<div class="month-nav">' +
            '<button type="button" data-nav="-1" aria-label="이전 달">' + ICON.left + '</button>' +
            '<span class="month-label">' + UI.koMonth(ym) + '</span>' +
            '<button type="button" data-nav="1" aria-label="다음 달">' + ICON.right + '</button>' +
          '</div>' +
          '<span class="pill">' + BOOKS[book].short + ' · ' + monthTag() + '</span>' +
        '</div>' +
        '<div class="net">' +
          '<span class="label">순수익</span>' +
          '<span class="value ' + (net > 0 ? 'up' : (net < 0 ? 'down' : '')) + '">' + UI.fmtSigned(net) + '</span>' +
        '</div>' +
        '<div class="summary-grid summary-grid-2">' +
          '<div class="sg"><div class="k">수입</div><div class="v inc">' + UI.fmtWon(inc) + '</div></div>' +
          '<div class="sg"><div class="k">지출</div><div class="v exp">' + UI.fmtWon(exp) + '</div></div>' +
        '</div>' +
      '</section>';
  }

  function viewSwitchHTML() {
    return '<div class="fin-views">' +
      '<button type="button" data-view="list" class="' + (view === 'list' ? 'is-on' : '') + '">내역</button>' +
      '<button type="button" data-view="stats" class="' + (view === 'stats' ? 'is-on' : '') + '">📊 통계</button>' +
    '</div>';
  }

  function filtersHTML() {
    const opts = [['all', '전체'], ['income', '수입'], ['expense', '지출']];
    return '<div class="filters">' + opts.map(function (o) {
      return '<button type="button" data-filter="' + o[0] + '" class="' + (filter === o[0] ? 'is-on' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }

  function rowHTML(item) {
    const t = TYPES[item.type] || TYPES.expense;
    const cat = item.category || '기타';
    return '' +
      '<button type="button" class="fin-row" data-id="' + item.id + '">' +
        '<span class="cat-ic ' + t.cls + '">' + UI.esc(cat.slice(0, 1)) + '</span>' +
        '<span class="fin-main">' +
          '<span class="fin-cat">' + UI.esc(cat) + '<span class="type-badge ' + (item.type === 'income' ? 'inc-b' : 'exp-b') + '">' + t.label + '</span></span>' +
          '<span class="fin-memo">' + UI.esc(item.memo || cat) + '</span>' +
        '</span>' +
        '<span class="fin-amt ' + t.cls + '">' + amountText(item) + '</span>' +
      '</button>';
  }

  function listHTML(list) {
    if (!list.length) {
      return '<div class="empty"><span class="emo">🧾</span>' +
        (filter === 'all' ? '이 장부에는 이 달 내역이 아직 없어요.' : '이 구분의 내역이 없어요.') +
        '<br>아래 ＋ 버튼으로 첫 기록을 남겨 보세요.</div>';
    }
    return groupByDate(list).map(function (g) {
      let net = 0;
      g.items.forEach(function (x) {
        const t = TYPES[x.type] || TYPES.expense;
        net += t.sign * (Number(x.amount) || 0);
      });
      const rel = UI.dayLabel(g.date);
      const dateLabel = (rel === '오늘' || rel === '내일' || rel === '어제') ? rel + ' · ' + UI.koDate(g.date) : UI.koDate(g.date);
      return '<div class="fin-group">' +
        '<div class="fin-date"><span>' + dateLabel + '</span>' +
          '<span class="sum">' + UI.fmtSigned(net) + '</span></div>' +
        g.items.sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); })
          .map(rowHTML).join('') +
      '</div>';
    }).join('');
  }

  /* ---------- 통계 (원형 그래프) ---------- */
  function catTotals(list, type) {
    const map = {};
    list.filter(function (x) { return x.type === type; }).forEach(function (x) {
      const c = x.category || '기타';
      map[c] = (map[c] || 0) + (Number(x.amount) || 0);
    });
    const total = Object.keys(map).reduce(function (a, k) { return a + map[k]; }, 0);
    return Object.keys(map).map(function (k) {
      return { name: k, amount: map[k], pct: total ? (map[k] / total) * 100 : 0 };
    }).sort(function (a, b) { return b.amount - a.amount; });
  }

  function arcPath(cx, cy, r, a0, a1) {
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    return 'M ' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ' L ' + x0.toFixed(2) + ' ' + y0.toFixed(2) +
      ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' Z';
  }

  function pieSVG(rows) {
    const W = 360, H = 278, cx = 180, cy = 138, r = 66;
    const total = rows.reduce(function (a, x) { return a + x.amount; }, 0);
    if (!total) return '';

    // 조각 각도
    let a = -Math.PI / 2;
    rows.forEach(function (row) {
      const sweep = (row.amount / total) * Math.PI * 2;
      row.a0 = a;
      row.a1 = a + sweep;
      a = row.a1;
      row.mid = (row.a0 + row.a1) / 2;
    });

    // 라벨 자리 잡기 (겹치면 위아래로 밀어냄)
    const right = [], left = [], top = [], bottom = [];
    rows.forEach(function (row) {
      if (row.a1 - row.a0 < 0.0001) return;
      const cos = Math.cos(row.mid), sin = Math.sin(row.mid);
      if (cos > 0.28) right.push(row);
      else if (cos < -0.28) left.push(row);
      else if (sin < 0) top.push(row);
      else bottom.push(row);
    });

    function spread(arr, minGap, lo, hi) {
      arr.sort(function (p, q) { return p.labelY - q.labelY; });
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].labelY - arr[i - 1].labelY < minGap) arr[i].labelY = arr[i - 1].labelY + minGap;
      }
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].labelY > hi) arr[i].labelY = hi - (arr.length - 1 - i) * minGap;
      }
      arr.forEach(function (row) { row.labelY = Math.max(lo, Math.min(hi, row.labelY)); });
    }

    right.forEach(function (row) { row.labelY = cy + Math.sin(row.mid) * (r + 10); });
    left.forEach(function (row) { row.labelY = cy + Math.sin(row.mid) * (r + 10); });
    spread(right, 29, 18, H - 22);
    spread(left, 29, 18, H - 22);

    let slices = '', labels = '';
    rows.forEach(function (row, i) {
      const color = PIE_COLORS[i % PIE_COLORS.length];
      const cos = Math.cos(row.mid), sin = Math.sin(row.mid);
      const isSide = cos > 0.28 || cos < -0.28;
      let lx, ly, anchor, elbowX, elbowY, lineEndX, lineEndY;

      if (isSide) {
        lx = cos > 0 ? cx + r + 34 : cx - r - 34;
        ly = row.labelY;
        anchor = cos > 0 ? 'start' : 'end';
        elbowX = cx + cos * (r + 20);
        elbowY = cy + sin * (r + 20);
        lineEndX = lx + (cos > 0 ? -6 : 6);
        lineEndY = ly - 6;
      } else {
        const up = sin < 0;
        lx = cx + cos * (r * 0.55);
        ly = up ? cy - r - 30 : cy + r + 36;
        anchor = 'middle';
        elbowX = cx + cos * (r + 6);
        elbowY = up ? cy - r - 10 : cy + r + 10;
        lineEndX = lx;
        lineEndY = up ? ly + 10 : ly - 20;
        // 위/아래 라벨끼리 겹치지 않게 좌우로 살짝
        lx = Math.max(40, Math.min(W - 40, lx));
      }

      if (row.a1 - row.a0 >= Math.PI * 2 - 0.0001) {
        slices += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color + '"/>';
      } else if (row.a1 - row.a0 > 0.0001) {
        slices += '<path d="' + arcPath(cx, cy, r, row.a0, row.a1) + '" fill="' + color + '" stroke="#fff" stroke-width="1.6"/>';
      }

      labels += '<polyline points="' +
          (cx + cos * (r + 1)).toFixed(1) + ',' + (cy + sin * (r + 1)).toFixed(1) + ' ' +
          elbowX.toFixed(1) + ',' + elbowY.toFixed(1) + ' ' +
          lineEndX.toFixed(1) + ',' + lineEndY.toFixed(1) +
        '" fill="none" stroke="' + color + '" stroke-width="1.1" opacity=".85"/>' +
        '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anchor + '" class="pie-name">' + UI.esc(row.name) + '</text>' +
        '<text x="' + lx.toFixed(1) + '" y="' + (ly + 13).toFixed(1) + '" text-anchor="' + anchor + '" class="pie-pct">' + row.pct.toFixed(1) + '%</text>';
    });

    return '<svg class="pie" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="카테고리별 비율 원형 그래프">' +
      slices + labels + '</svg>';
  }

  function statRowsHTML(rows, total) {
    return '<div class="st-rows">' + rows.map(function (row, i) {
      return '<div class="st-row">' +
        '<span class="st-badge" style="background:' + PIE_COLORS[i % PIE_COLORS.length] + '">' + Math.round(row.pct) + '%</span>' +
        '<span class="st-name">' + UI.esc(row.name) + '</span>' +
        '<span class="st-amt">' + UI.fmtWon(row.amount) + '</span>' +
      '</div>';
    }).join('') + '</div>' +
      '<div class="st-total"><span>' + TYPES[statType].label + ' 합계</span><b>' + UI.fmtWon(total) + '</b></div>';
  }

  function statsHTML(list) {
    const inc = sumOf(list, 'income');
    const exp = sumOf(list, 'expense');
    const rows = catTotals(list, statType);
    const total = statType === 'income' ? inc : exp;

    return '' +
      '<div class="st-switch">' +
        '<button type="button" data-stype="income" class="' + (statType === 'income' ? 'is-on' : '') + '">' +
          '수입 <b>' + UI.fmtWon(inc) + '</b></button>' +
        '<button type="button" data-stype="expense" class="' + (statType === 'expense' ? 'is-on' : '') + '">' +
          '지출 <b>' + UI.fmtWon(exp) + '</b></button>' +
      '</div>' +
      (rows.length
        ? '<div class="pie-card">' + pieSVG(rows) + '</div>' + statRowsHTML(rows, total)
        : '<div class="empty"><span class="emo">📊</span>이 달에는 ' + TYPES[statType].label + ' 내역이 없어요.<br>내역을 남기면 그래프가 그려져요.</div>');
  }

  /* ---------- 그리기 ---------- */
  function render() {
    if (!host) return;
    const all = bookItems();
    let list = all.slice();
    if (filter !== 'all') list = list.filter(function (x) { return x.type === filter; });

    host.innerHTML = '' +
      bookSwitchHTML() +
      summaryHTML(all) +
      viewSwitchHTML() +
      (view === 'list' ? filtersHTML() + '<div id="fin-list">' + listHTML(list) + '</div>' : statsHTML(all));

    const inc = sumOf(all, 'income'), exp = sumOf(all, 'expense');
    if (window.App && App.setSubtitle) {
      App.setSubtitle(BOOKS[book].short + ' · ' + UI.koMonth(ym) + ' · 순수익 ' + UI.fmtSigned(inc - exp));
    }
    if (window.App && App.showFab) {
      if (view === 'stats') App.hideFab();
      else App.showFab({ label: '내역', onClick: function () { openEditor(null); } });
    }

    bind();
  }

  function bind() {
    host.querySelectorAll('[data-book]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (book === b.dataset.book) return;
        book = b.dataset.book;
        filter = 'all';
        statType = 'income';
        render();
      });
    });
    host.querySelectorAll('[data-nav]').forEach(function (b) {
      b.addEventListener('click', function () {
        ym = UI.monthShift(ym, Number(b.dataset.nav));
        render();
      });
    });
    host.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () {
        view = b.dataset.view;
        render();
      });
    });
    host.querySelectorAll('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        filter = b.dataset.filter;
        render();
      });
    });
    host.querySelectorAll('[data-stype]').forEach(function (b) {
      b.addEventListener('click', function () {
        statType = b.dataset.stype;
        render();
      });
    });
    host.querySelectorAll('.fin-row').forEach(function (b) {
      b.addEventListener('click', function () {
        const item = Store.find('finance', b.dataset.id);
        if (item) openEditor(item);
      });
    });
  }

  /* ---------- 입력 ---------- */
  function chipsHTML(type, chosen) {
    const list = CATS[book][type].concat(Store.customCats(book, type).filter(function (c) {
      return CATS[book][type].indexOf(c) < 0;
    }));
    return list.map(function (c) {
      return '<button type="button" class="chip ' + (c === chosen ? 'is-on' : '') + '" data-cat="' + UI.esc(c) + '">' + UI.esc(c) + '</button>';
    }).join('') + '<button type="button" class="chip chip-add" data-cat-custom="1">＋ 직접</button>';
  }

  function openEditor(item) {
    const isNew = !item;
    let type = isNew ? 'expense' : (item.type || 'expense');
    let cat = isNew ? '' : (item.category || '');
    let customMode = false;

    const body = '' +
      '<div class="field">' +
        '<div class="seg seg-2" id="type-seg">' +
          ['income', 'expense'].map(function (t) {
            return '<button type="button" data-type="' + t + '" class="' + (t === type ? 'is-on' : '') + '">' + TYPES[t].label + '</button>';
          }).join('') +
        '</div>' +
        '<div class="helper">' + BOOKS[book].label + '에 기록해요 (다른 장부와 섞이지 않아요)</div>' +
      '</div>' +
      '<div class="field"><label>금액</label>' +
        '<div class="amount-wrap">' +
          '<input class="input amount-input" id="fin-amount" inputmode="numeric" autocomplete="off" ' +
            'value="' + (isNew ? '' : Number(item.amount || 0).toLocaleString('ko-KR')) + '" aria-label="금액">' +
          '<span class="amount-unit">원</span>' +
        '</div>' +
      '</div>' +
      '<div class="field"><span class="field-label">카테고리</span>' +
        '<div class="chips" id="cat-chips">' + chipsHTML(type, cat) + '</div>' +
        '<input class="input" id="cat-custom" placeholder="카테고리 직접 입력 (다음에도 남아요)" value="' + UI.esc(cat) + '" style="display:none;margin-top:8px" maxlength="12">' +
      '</div>' +
      '<div class="field"><label>날짜</label>' +
        '<input class="input" type="date" id="fin-date" value="' + UI.esc(isNew ? (UI.ymOf(UI.todayISO()) === ym ? UI.todayISO() : ym + '-01') : item.date) + '">' +
      '</div>' +
      '<div class="field"><label>메모 (선택)</label>' +
        '<input class="input" type="text" id="fin-memo" maxlength="80" placeholder="예: 이번 주 장보기" value="' + UI.esc(isNew ? '' : (item.memo || '')) + '">' +
      '</div>';

    const buttons = [
      { label: isNew ? '추가' : '저장', kind: 'primary', submit: true, onClick: function (form) {
          const amount = UI.parseAmount(form.querySelector('#fin-amount').value);
          const date = form.querySelector('#fin-date').value || UI.todayISO();
          const memo = form.querySelector('#fin-memo').value.trim();
          const customEl = form.querySelector('#cat-custom');
          let category = customMode ? customEl.value.trim() : cat;
          if (!category && customEl.value.trim()) category = customEl.value.trim();
          if (!category) category = '기타';
          if (!amount) {
            form.querySelector('#fin-amount').focus();
            UI.toast('금액을 적어 주세요');
            return false;
          }
          if (customMode && category) Store.addCustomCat(book, type, category);
          if (isNew) {
            Store.add('finance', { date: date, book: book, type: type, amount: amount, category: category, memo: memo });
          } else {
            Store.update('finance', item.id, { date: date, book: book, type: type, amount: amount, category: category, memo: memo });
          }
          ym = UI.ymOf(date);
          filter = 'all';
          render();
          UI.toast(isNew ? '내역을 기록했어요' : '저장했어요');
        } },
      { label: '취소', kind: 'ghost' }
    ];
    if (!isNew) {
      buttons.splice(1, 0, { label: '삭제', kind: 'danger', keepOpen: true, onClick: function (form, closeSheet) {
        closeSheet();
        UI.confirmDialog({
          title: '내역을 삭제할까요?',
          message: '“' + (item.category || '기타') + ' ' + UI.fmtWon(item.amount) + '” 내역을 지웁니다.',
          confirmLabel: '삭제',
          danger: true,
          onConfirm: function () {
            Store.remove('finance', item.id);
            render();
            UI.toast('삭제했어요');
          }
        });
      } });
    }

    UI.openSheet({
      title: isNew ? BOOKS[book].label + ' · 내역 추가' : '내역 수정',
      body: body,
      buttons: buttons,
      noFocus: !isNew,
      onMount: function (form) {
        UI.bindAmount(form.querySelector('#fin-amount'));

        form.querySelectorAll('#type-seg [data-type]').forEach(function (b) {
          b.addEventListener('click', function () {
            type = b.dataset.type;
            cat = '';
            customMode = false;
            form.querySelectorAll('#type-seg [data-type]').forEach(function (x) {
              x.classList.toggle('is-on', x.dataset.type === type);
            });
            const chips = form.querySelector('#cat-chips');
            chips.innerHTML = chipsHTML(type, '');
            bindChips(chips, form);
            const custom = form.querySelector('#cat-custom');
            custom.value = '';
            custom.style.display = 'none';
          });
        });

        bindChips(form.querySelector('#cat-chips'), form);
      }
    });

    function bindChips(chips, form) {
      chips.querySelectorAll('[data-cat]').forEach(function (b) {
        b.addEventListener('click', function () {
          cat = b.dataset.cat;
          customMode = false;
          const custom = form.querySelector('#cat-custom');
          custom.style.display = 'none';
          chips.querySelectorAll('[data-cat]').forEach(function (x) {
            x.classList.toggle('is-on', x.dataset.cat === cat);
          });
        });
      });
      const addBtn = chips.querySelector('[data-cat-custom]');
      if (addBtn) {
        addBtn.addEventListener('click', function () {
          const custom = form.querySelector('#cat-custom');
          customMode = true;
          cat = '';
          chips.querySelectorAll('[data-cat]').forEach(function (x) { x.classList.remove('is-on'); });
          custom.style.display = '';
          setTimeout(function () { custom.focus(); }, 60);
        });
      }
    }
  }

  T.finance = {
    id: 'finance',
    label: '가계부',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7.4A2.4 2.4 0 0 1 6.4 5h11.2A2.4 2.4 0 0 1 20 7.4v9.2A2.4 2.4 0 0 1 17.6 19H6.4A2.4 2.4 0 0 1 4 16.6z"/><path d="M4 9.4h16"/><path d="M7.6 13.2h4.2"/><circle cx="16.4" cy="15.4" r=".9" fill="currentColor" stroke="none"/></svg>',
    title: '가계부',
    render: function (root) {
      host = root;
      render();
    }
  };
})();
