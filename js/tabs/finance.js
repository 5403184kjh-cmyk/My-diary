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

  const TYPES = {
    income: { label: '수입', cls: 'inc', sign: 1 },
    expense: { label: '지출', cls: 'exp', sign: -1 }
  };

  /* ---------- 카테고리 이름에서 그림(이모지)과 글자를 나눕니다 ---------- */
  function catParts(label) {
    const s = String(label == null ? '' : label).trim();
    const m = s.match(/^([^\p{L}\p{N}]+)\s*(.*)$/u);
    if (m && m[2]) return { icon: m[1].trim(), name: m[2].trim() };
    return { icon: '', name: s };
  }
  function catIcon(label) {
    const p = catParts(label);
    return p.icon || (p.name ? p.name.slice(0, 1) : '·');
  }
  function catName(label) {
    const p = catParts(label);
    return p.name || String(label == null ? '' : label);
  }

  // 원형 그래프 색 (밝고 선명하게)
  const PIE_COLORS = ['#E0552F', '#C97D0A', '#AE8400', '#2E8B57', '#2276C4', '#7050C8', '#D23A75', '#857A6C'];

  let host = null;
  let ym = UI.ymOf(UI.todayISO());
  let book = 'general';
  let view = 'list';          // list | stats
  let filter = 'all';         // all | income | expense
  let statType = 'income';    // stats에서 보고 있는 구분

  /* ---------- 일반 가계부 기간 (시작일 자유 설정) ---------- */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function monthLen(y, m) { return new Date(y, m, 0).getDate(); }
  function shiftYM(y, m, n) {
    const d = new Date(y, m - 1 + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  }
  // 그 달의 기간 시작일 (시작일 16일이면 2026-11-16, 말일이면 2026-11-30)
  function startInMonth(y, m, sdOpt) {
    const sd = sdOpt === undefined ? Store.financeSettings().startDay : sdOpt;
    if (sd === 'last') return y + '-' + pad2(m) + '-' + pad2(monthLen(y, m));
    const day = Math.min(Number(sd) || 1, monthLen(y, m));
    return y + '-' + pad2(m) + '-' + pad2(day);
  }
  function nextStart(s, sdOpt) { const p = s.split('-').map(Number); const n = shiftYM(p[0], p[1], 1); return startInMonth(n.y, n.m, sdOpt); }
  function prevStart(s, sdOpt) { const p = s.split('-').map(Number); const n = shiftYM(p[0], p[1], -1); return startInMonth(n.y, n.m, sdOpt); }
  function periodOf(startISO) { return { start: startISO, end: UI.isoAdd(nextStart(startISO), -1) }; }
  function periodStartOf(dateISO, sdOpt) {
    const p = String(dateISO).split('-').map(Number);
    const cand = startInMonth(p[0], p[1], sdOpt);
    if (String(dateISO) >= cand) return cand;
    const n = shiftYM(p[0], p[1], -1);
    return startInMonth(n.y, n.m, sdOpt);
  }
  function dot(isoStr) { const p = String(isoStr).split('-').map(Number); return p[0] + '.' + p[1] + '.' + p[2]; }
  function periodLabel(p) { return dot(p.start) + ' ~ ' + dot(p.end); }
  function shortPeriod(p) {
    const s = p.start.split('-').map(Number), e = p.end.split('-').map(Number);
    if (s[0] !== e[0]) return dot(p.start) + ' ~ ' + dot(p.end);
    return s[1] + '.' + s[2] + ' ~ ' + e[1] + '.' + e[2];
  }
  function curPeriod() { return periodOf(periodStart); }

  let periodStart = periodStartOf(UI.todayISO());   // 일반 가계부에서 지금 보고 있는 기간의 시작일

  /* ---------- 데이터 ---------- */
  function bookItems() {
    const p = book === 'general' ? curPeriod() : null;
    return Store.all('finance').filter(function (x) {
      if ((x.book || 'general') !== book) return false;
      if (p) return x.date >= p.start && x.date <= p.end;   // 일반 가계부는 사용자 지정 기간
      return UI.ymOf(x.date) === ym;                        // 재테크 가계부는 달 단위
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

  function periodTag() {
    const cur = periodStartOf(UI.todayISO());
    const p = periodStart.split('-').map(Number), c = cur.split('-').map(Number);
    const diff = (p[0] - c[0]) * 12 + (p[1] - c[1]);
    if (diff === 0) return '이번 기간';
    if (diff === -1) return '지난 기간';
    if (diff === 1) return '다음 기간';
    return Math.abs(diff) + '기간 ' + (diff < 0 ? '전' : '후');
  }

  function startDayText() {
    const d = Store.financeSettings().startDay;
    return d === 'last' ? '말일 시작' : d + '일 시작';
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

  function formatPeriodHeadHTML(p) {
    return '' +
      '<div class="period-head">' +
        '<button type="button" class="pnav" data-pnav="-1" aria-label="이전 기간">' + ICON.left + '</button>' +
        '<div class="period-mid">' +
          '<span class="period-range">' + periodLabel(p) + '</span>' +
          '<span class="period-sub">' + startDayText() + ' · ' + periodTag() + '</span>' +
        '</div>' +
        '<button type="button" class="pnav" data-pnav="1" aria-label="다음 기간">' + ICON.right + '</button>' +
      '</div>';
  }

  function budgetHTML(list) {
    if (book !== 'general') return '';
    const f = Store.financeSettings();
    const exp = sumOf(list, 'expense');

    if (!f.budget) {
      return '<div class="budget budget-empty">' +
        '<button type="button" class="budget-set" id="btn-budget">🎯 이번 기간 예산 정하기</button>' +
        '<div class="helper" style="margin-top:6px">예산을 정하면 남은 금액과 진행률을 보여드려요.</div>' +
      '</div>';
    }

    const pct = (exp / f.budget) * 100;
    const over = exp > f.budget;
    const left = f.budget - exp;
    const w = Math.max(0, Math.min(100, pct));
    return '' +
      '<div class="budget">' +
        '<div class="budget-head">' +
          '<span>기간 예산 <b>' + UI.fmtWon(f.budget) + '</b></span>' +
          '<button type="button" class="budget-set" id="btn-budget">고치기</button>' +
        '</div>' +
        '<div class="budget-bar' + (over ? ' is-over' : '') + '" role="img" aria-label="예산 사용률 ' + Math.round(pct) + '%"><i style="width:' + w.toFixed(1) + '%"></i></div>' +
        '<div class="budget-foot">' +
          '<span>지출 <b class="exp">' + UI.fmtWon(exp) + '</b></span>' +
          '<span>' + (over
            ? '초과 <b class="exp">' + UI.fmtWon(-left) + '</b>'
            : '남은 <b class="inc">' + UI.fmtWon(left) + '</b>') +
            ' · ' + Math.round(pct) + '% 사용</span>' +
        '</div>' +
      '</div>';
  }

  function summaryHTML(list) {
    const inc = sumOf(list, 'income');
    const exp = sumOf(list, 'expense');
    const net = inc - exp;
    const head = book === 'general'
      ? formatPeriodHeadHTML(curPeriod())
      : '<div class="summary-top">' +
          '<div class="month-nav">' +
            '<button type="button" data-nav="-1" aria-label="이전 달">' + ICON.left + '</button>' +
            '<span class="month-label">' + UI.koMonth(ym) + '</span>' +
            '<button type="button" data-nav="1" aria-label="다음 달">' + ICON.right + '</button>' +
          '</div>' +
          '<span class="pill">' + BOOKS[book].short + ' · ' + monthTag() + '</span>' +
        '</div>';

    return '' +
      '<section class="summary summary-' + book + '">' +
        head +
        '<div class="net">' +
          '<span class="label">순수익</span>' +
          '<span class="value ' + (net > 0 ? 'up' : (net < 0 ? 'down' : '')) + '">' + UI.fmtSigned(net) + '</span>' +
        '</div>' +
        '<div class="summary-grid summary-grid-2">' +
          '<div class="sg"><div class="k">수입</div><div class="v inc">' + UI.fmtWon(inc) + '</div></div>' +
          '<div class="sg"><div class="k">지출</div><div class="v exp">' + UI.fmtWon(exp) + '</div></div>' +
        '</div>' +
        budgetHTML(list) +
      '</section>';
  }

  function toolsHTML() {
    if (book !== 'general') return '';
    const n = Store.recurringRules().length;
    const f = Store.financeSettings();
    return '<div class="fin-tools">' +
      '<button type="button" class="mini-btn terra" id="btn-recurring">🔄 고정 수입/지출' + (n ? ' ' + n : '') + '</button>' +
      '<button type="button" class="mini-btn" id="btn-cats">🗂 카테고리 관리</button>' +
    '</div>' +
    '<button type="button" class="mini-btn terra fin-budget-bar" id="btn-budget">🎯 예산·기간 설정 · ' + startDayText() +
      ' · ' + (f.budget ? UI.fmtWon(f.budget) : '예산 없음') + '</button>';
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
    const cat = item.category || '🧾 기타';
    return '' +
      '<button type="button" class="fin-row" data-id="' + item.id + '">' +
        '<span class="cat-ic ' + t.cls + '">' + UI.esc(catIcon(cat)) + '</span>' +
        '<span class="fin-main">' +
          '<span class="fin-cat">' + UI.esc(catName(cat)) +
            '<span class="type-badge ' + (item.type === 'income' ? 'inc-b' : 'exp-b') + '">' + t.label + '</span>' +
            (item.recurring ? '<span class="type-badge fix-b">고정</span>' : '') +
          '</span>' +
          '<span class="fin-memo">' + UI.esc(item.memo || catName(cat)) + '</span>' +
        '</span>' +
        '<span class="fin-amt ' + t.cls + '">' + amountText(item) + '</span>' +
      '</button>';
  }

  function listHTML(list) {
    if (!list.length) {
      const where = book === 'general' ? '이 기간' : '이 달';
      return '<div class="empty"><span class="emo">🧾</span>' +
        (filter === 'all' ? '이 장부에는 ' + where + ' 내역이 아직 없어요.' : '이 구분의 내역이 없어요.') +
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
      if (!map[c]) map[c] = { cat: c, amount: 0, count: 0 };
      map[c].amount += (Number(x.amount) || 0);
      map[c].count += 1;
    });
    const total = Object.keys(map).reduce(function (a, k) { return a + map[k].amount; }, 0);
    return Object.keys(map).map(function (k) {
      const r = map[k];
      return {
        cat: r.cat,
        name: catName(k),
        amount: r.amount,
        count: r.count,
        pct: total ? (r.amount / total) * 100 : 0
      };
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
    const where = book === 'general' ? '기간' : '달';
    return '<div class="st-rows">' + rows.map(function (row, i) {
      return '<button type="button" class="st-row st-row-btn" data-scat="' + UI.esc(row.cat) + '" aria-label="' + UI.esc(row.name) + ' 내역 보기">' +
        '<span class="st-badge" style="background:' + PIE_COLORS[i % PIE_COLORS.length] + '">' + Math.round(row.pct) + '%</span>' +
        '<span class="st-name">' + UI.esc(row.name) + '</span>' +
        '<span class="st-cnt">' + row.count + '건</span>' +
        '<span class="st-amt">' + UI.fmtWon(row.amount) + '</span>' +
        '<span class="st-go" aria-hidden="true">›</span>' +
      '</button>';
    }).join('') + '</div>' +
      '<div class="st-total"><span>' + TYPES[statType].label + ' 합계</span><b>' + UI.fmtWon(total) + '</b></div>' +
      '<div class="helper st-hint">카테고리를 누르면 이 ' + where + '의 내역을 하나씩 볼 수 있어요.</div>';
  }

  /* ---------- 카테고리 상세 (통계 행을 누르면 그 달의 내역) ---------- */
  function catItems(cat, type) {
    return bookItems().filter(function (x) {
      return x.type === type && (x.category || '기타') === cat;
    }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }

  function detailRowHTML(item) {
    const t = TYPES[item.type] || TYPES.expense;
    const d = UI.parseISO(item.date);
    const title = String(item.memo || '').trim() || catName(item.category || '기타');
    const method = String(item.method || '').trim();
    return '<button type="button" class="sd-row" data-id="' + UI.esc(item.id) + '">' +
        '<span class="sd-date"><b>' + (d.getMonth() + 1) + '/' + d.getDate() + '</b><i>' + UI.WEEK[d.getDay()] + '</i></span>' +
        '<span class="sd-main">' +
          '<span class="sd-title">' + UI.esc(title) +
            (item.recurring ? '<span class="type-badge fix-b">고정</span>' : '') +
          '</span>' +
          (method ? '<span class="sd-sub">' + UI.esc(method) + '</span>' : '') +
        '</span>' +
        '<span class="sd-amt ' + t.cls + '">' + amountText(item) + '</span>' +
      '</button>';
  }

  function openCatDetail(cat, type) {
    const items = catItems(cat, type);
    const sum = items.reduce(function (a, x) { return a + (Number(x.amount) || 0); }, 0);
    const t = TYPES[type] || TYPES.expense;
    const rangeTxt = book === 'general' ? periodLabel(curPeriod()) : UI.koMonth(ym);

    const body = items.length
      ? '<div class="sd-list">' + items.map(detailRowHTML).join('') + '</div>' +
        '<div class="helper" style="margin:10px 2px 2px">내역을 누르면 고치거나 지울 수 있어요.</div>'
      : '<div class="empty"><span class="emo">🧾</span>이 카테고리에는 이 ' + (book === 'general' ? '기간' : '달') + ' 내역이 없어요.</div>';

    function backToDetail() {
      if (!catItems(cat, type).length) return;   // 다 지웠으면 통계 화면에 그대로
      openCatDetail(cat, type);
    }

    UI.openSheet({
      title: catName(cat) + ' (' + rangeTxt + ')',
      subtitle: t.label + ' · 총 ' + items.length + '건 / 합계 ' + UI.fmtWon(sum),
      body: body,
      noFocus: true,
      buttons: [{ label: '닫기', kind: 'ghost' }],
      onMount: function (form) {
        form.querySelectorAll('.sd-row').forEach(function (b) {
          b.addEventListener('click', function () {
            const item = Store.find('finance', b.dataset.id);
            if (item) openEditor(item, { back: backToDetail });
          });
        });
      }
    });
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
        : '<div class="empty"><span class="emo">📊</span>이 ' + (book === 'general' ? '기간' : '달') + '에는 ' + TYPES[statType].label + ' 내역이 없어요.<br>내역을 남기면 그래프가 그려져요.</div>');
  }

  /* ---------- 그리기 ---------- */
  function render() {
    if (!host) return;
    // 설정된 시작일과 보고 있는 기간의 시작일이 어긋나면(설정을 바꿨을 때) 오늘이 들어 있는 기간으로 맞춥니다.
    try {
      const sd = Store.financeSettings().startDay;
      const ps = periodStart.split('-').map(Number);
      if (periodStart !== startInMonth(ps[0], ps[1], sd)) periodStart = periodStartOf(UI.todayISO(), sd);
    } catch (e) { console.warn(e); }
    // 고정 수입/지출 중 아직 기록되지 않은, 날짜가 지난 건을 먼저 반영합니다.
    // 지금 보고 있는 기간이 두 달에 걸쳐 있으면 그 두 달을 함께 확인하되(오늘까지 도래한 날짜만),
    // 지난 기간을 넘겨 볼 때 과거 달이 새로 만들어지지는 않게 "오늘이 들어 있는 기간"만 채웁니다.
    try {
      const p = book === 'general' ? periodOf(periodStartOf(UI.todayISO())) : null;
      Store.autoPostRecurring(null, p ? { from: p.start, to: p.end } : null);
    } catch (e) { console.warn(e); }
    const all = bookItems();
    let list = all.slice();
    if (filter !== 'all') list = list.filter(function (x) { return x.type === filter; });

    host.innerHTML = '' +
      bookSwitchHTML() +
      summaryHTML(all) +
      toolsHTML() +
      viewSwitchHTML() +
      (view === 'list' ? filtersHTML() + '<div id="fin-list">' + listHTML(list) + '</div>' : statsHTML(all));

    const inc = sumOf(all, 'income'), exp = sumOf(all, 'expense');
    if (window.App && App.setSubtitle) {
      const span = book === 'general' ? shortPeriod(curPeriod()) : UI.koMonth(ym);
      App.setSubtitle(BOOKS[book].short + ' · ' + span + ' · 순수익 ' + UI.fmtSigned(inc - exp));
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
    host.querySelectorAll('[data-pnav]').forEach(function (b) {
      b.addEventListener('click', function () {
        const n = Number(b.dataset.pnav);
        periodStart = n < 0 ? prevStart(periodStart) : nextStart(periodStart);
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
    host.querySelectorAll('[data-scat]').forEach(function (b) {
      b.addEventListener('click', function () {
        openCatDetail(b.dataset.scat, statType);
      });
    });
    host.querySelectorAll('.fin-row').forEach(function (b) {
      b.addEventListener('click', function () {
        const item = Store.find('finance', b.dataset.id);
        if (item) openEditor(item);
      });
    });
    const reBtn = host.querySelector('#btn-recurring');
    if (reBtn) reBtn.addEventListener('click', openRecurring);
    const catBtn = host.querySelector('#btn-cats');
    if (catBtn) catBtn.addEventListener('click', openCatManager);
    host.querySelectorAll('#btn-budget').forEach(function (b) {
      b.addEventListener('click', openFinanceSetup);
    });
  }

  /* ---------- 고정 수입/지출 ---------- */
  function money(n) { return Number(n || 0).toLocaleString('ko-KR'); }

  function recRowHTML(r) {
    const t = r.type === 'income' ? TYPES.income : TYPES.expense;
    const on = r.active !== false;
    return '<div class="rec-row' + (on ? '' : ' is-off') + '">' +
      '<button type="button" class="rec-main" data-rec="' + UI.esc(r.id) + '">' +
        '<span class="cat-ic ' + t.cls + '">' + UI.esc(catIcon(r.category)) + '</span>' +
        '<span class="fin-main">' +
          '<span class="fin-cat">' + UI.esc(r.name) + '</span>' +
          '<span class="fin-memo">매월(' + r.day + '일) · ' + UI.esc(catName(r.category)) + ' · ' + UI.esc(r.method) + '</span>' +
        '</span>' +
        '<span class="fin-amt ' + t.cls + '">' + (r.type === 'income' ? '+' : '-') + money(r.amount) + '원</span>' +
      '</button>' +
      '<button type="button" class="rec-toggle' + (on ? ' is-on' : '') + '" data-rec-toggle="' + UI.esc(r.id) + '" aria-label="' + (on ? '중지' : '다시 켜기') + '">' + (on ? '켜짐' : '중지') + '</button>' +
    '</div>';
  }

  function recurringListHTML() {
    const rows = Store.recurringRules();
    const t = Store.recurringTotals();
    return '' +
      '<div class="rec-total">매월' +
        '<span>수입 <b class="inc">' + money(t.income) + '원</b></span>' +
        '<span>지출 <b class="exp">' + money(t.expense) + '원</b></span>' +
        '<span class="rec-cnt">' + rows.length + '건</span>' +
      '</div>' +
      '<button type="button" class="btn small block" id="rec-post">이번 달 미반영분 지금 반영</button>' +
      (rows.length
        ? '<div class="rec-list">' + rows.map(recRowHTML).join('') + '</div>'
        : '<div class="empty" style="padding:28px 8px"><span class="emo">🔄</span>아직 고정 내역이 없어요.<br>월급·보험료·통신비처럼 매달 같은 내역을 넣어 두면<br>그 날짜에 맞춰 자동으로 기록돼요.</div>') +
      '<div class="helper" style="margin-top:10px">고정 내역은 일반 가계부에만 기록되고, 이미 반영된 달은 다시 넣지 않아요. 항목을 눌러 고치거나 지울 수 있어요.</div>';
  }

  function drawRec() {
    const wrap = document.getElementById('rec-wrap');
    if (!wrap) return;
    wrap.innerHTML = recurringListHTML();
    bindRecList(wrap);
  }

  function bindRecList(scope) {
    scope.querySelectorAll('.rec-main').forEach(function (b) {
      b.addEventListener('click', function () {
        const rule = Store.recurringRules().find(function (r) { return r.id === b.dataset.rec; });
        if (rule) openRuleEditor(rule);
      });
    });
    scope.querySelectorAll('[data-rec-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        const row = Store.toggleRecurring(b.dataset.recToggle);
        drawRec();
        render();
        if (row) UI.toast(row.active ? '다시 자동 기록해요' : '자동 기록을 멈췄어요');
      });
    });
    const post = scope.querySelector('#rec-post');
    if (post) {
      post.addEventListener('click', function () {
        const n = Store.autoPostRecurring();
        drawRec();
        render();
        UI.toast(n ? n + '건을 이번 달 가계부에 반영했어요' : '이번 달은 이미 다 반영했어요');
      });
    }
  }

  function openRecurring() {
    UI.openSheet({
      title: '고정 수입/지출',
      subtitle: '매달 정해진 날에 자동 기록',
      body: '<div id="rec-wrap">' + recurringListHTML() + '</div>',
      noFocus: true,
      buttons: [
        { label: '＋ 추가', kind: 'primary', keepOpen: true, onClick: function () { openRuleEditor(null); } },
        { label: '닫기', kind: 'ghost' }
      ],
      onMount: function (form) { bindRecList(form); }
    });
  }

  function openRuleEditor(rule) {
    const isNew = !rule;
    let type = isNew ? 'expense' : (rule.type || 'expense');
    let cat = isNew ? '' : (rule.category || '');
    let method = isNew ? '현금' : (rule.method || '현금');
    let active = isNew ? true : (rule.active !== false);

    function catChips(t, chosen) {
      const list = Store.catList('general', t).slice();
      if (chosen && list.indexOf(chosen) < 0) list.push(chosen);
      if (!list.length) return '<div class="helper">카테고리가 없어요. 「카테고리 관리」에서 먼저 만들어 주세요.</div>';
      return list.map(function (c) {
        return '<button type="button" class="chip ' + (c === chosen ? 'is-on' : '') + '" data-rcat="' + UI.esc(c) + '">' + UI.esc(c) + '</button>';
      }).join('');
    }

    function methodChips(chosen) {
      const list = ['현금', '카드', '계좌이체', '휴대폰'];
      if (chosen && list.indexOf(chosen) < 0) list.push(chosen);
      return list.map(function (m) {
        return '<button type="button" class="chip ' + (m === chosen ? 'is-on' : '') + '" data-rmethod="' + UI.esc(m) + '">' + UI.esc(m) + '</button>';
      }).join('');
    }

    function bindCatChips(chips) {
      if (!chips) return;
      chips.querySelectorAll('[data-rcat]').forEach(function (b) {
        b.addEventListener('click', function () {
          cat = b.dataset.rcat;
          chips.querySelectorAll('[data-rcat]').forEach(function (x) {
            x.classList.toggle('is-on', x.dataset.rcat === cat);
          });
        });
      });
    }

    const body = '' +
      '<div class="field"><label>항목명</label>' +
        '<input class="input" id="rec-name" maxlength="40" autocomplete="off" placeholder="예: 휴대폰 요금" value="' + UI.esc(isNew ? '' : rule.name) + '">' +
      '</div>' +
      '<div class="field"><label>구분</label>' +
        '<div class="seg seg-2" id="rec-type">' +
          ['expense', 'income'].map(function (t) {
            return '<button type="button" data-type="' + t + '" class="' + (t === type ? 'is-on' : '') + '">' + TYPES[t].label + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="field"><label>금액</label>' +
        '<div class="amount-wrap">' +
          '<input class="input amount-input" id="rec-amount" inputmode="numeric" autocomplete="off" value="' + (isNew ? '' : Number(rule.amount || 0).toLocaleString('ko-KR')) + '" aria-label="금액">' +
          '<span class="amount-unit">원</span>' +
        '</div>' +
      '</div>' +
      '<div class="field"><label>매월 며칠</label>' +
        '<div class="rec-day-wrap">' +
          '<input class="input" type="number" id="rec-day" min="1" max="31" inputmode="numeric" value="' + (isNew ? new Date().getDate() : rule.day) + '" aria-label="매월 며칠">' +
          '<span class="rec-day-unit">일</span>' +
        '</div>' +
        '<div class="helper">31일처럼 없는 달은 그 달 마지막 날로 맞춰 기록해요.</div>' +
      '</div>' +
      '<div class="field"><span class="field-label">카테고리</span>' +
        '<div class="chips" id="rec-cats">' + catChips(type, cat) + '</div>' +
      '</div>' +
      '<div class="field"><span class="field-label">결제수단</span>' +
        '<div class="chips" id="rec-methods">' + methodChips(method) + '</div>' +
      '</div>' +
      '<div class="field"><span class="field-label">활성</span>' +
        '<button type="button" class="pin-toggle mini' + (active ? ' is-on' : '') + '" id="rec-active" role="switch" aria-checked="' + (active ? 'true' : 'false') + '" aria-label="활성">' +
          '<span class="sw"></span><span id="rec-active-txt">' + (active ? '자동 기록 켜짐' : '자동 기록 멈춤') + '</span></button>' +
      '</div>';

    const buttons = [
      { label: isNew ? '추가' : '저장', kind: 'primary', submit: true, keepOpen: true, onClick: function (form) {
          const name = form.querySelector('#rec-name').value.trim();
          const amount = UI.parseAmount(form.querySelector('#rec-amount').value);
          const day = Math.round(Number(form.querySelector('#rec-day').value) || 1);
          if (!name) { UI.toast('항목명을 적어 주세요'); return false; }
          if (!amount) { UI.toast('금액을 적어 주세요'); return false; }
          const data = {
            name: name,
            type: type,
            amount: amount,
            day: Math.min(31, Math.max(1, day)),
            category: cat || (type === 'income' ? '기타수입' : '🧾 기타'),
            method: method,
            active: active
          };
          if (isNew) Store.addRecurring(data);
          else Store.updateRecurring(rule.id, data);
          UI.toast(isNew ? '고정 내역을 추가했어요' : '저장했어요');
          render();
          openRecurring();
          return false;
        } },
      { label: '취소', kind: 'ghost', keepOpen: true, onClick: function () { openRecurring(); return false; } }
    ];

    if (!isNew) {
      buttons.splice(1, 0, { label: '삭제', kind: 'danger', keepOpen: true, onClick: function () {
        UI.confirmDialog({
          title: '고정 내역을 지울까요?',
          message: '“' + rule.name + '” 고정 내역을 지웁니다. 이미 기록된 가계부 내역은 그대로 남아요.',
          confirmLabel: '삭제',
          danger: true,
          onConfirm: function () {
            Store.removeRecurring(rule.id);
            UI.toast('지웠어요');
            render();
            openRecurring();
          }
        });
      } });
    }

    UI.openSheet({
      title: isNew ? '고정 내역 추가' : '고정 내역 수정',
      subtitle: '이 날짜에 맞춰 일반 가계부에 자동으로 기록해요',
      body: body,
      buttons: buttons,
      noFocus: !isNew,
      onMount: function (form) {
        UI.bindAmount(form.querySelector('#rec-amount'));

        form.querySelectorAll('#rec-type [data-type]').forEach(function (b) {
          b.addEventListener('click', function () {
            type = b.dataset.type;
            cat = '';
            form.querySelectorAll('#rec-type [data-type]').forEach(function (x) {
              x.classList.toggle('is-on', x.dataset.type === type);
            });
            const chips = form.querySelector('#rec-cats');
            chips.innerHTML = catChips(type, '');
            bindCatChips(chips);
          });
        });
        bindCatChips(form.querySelector('#rec-cats'));

        form.querySelectorAll('#rec-methods [data-rmethod]').forEach(function (b) {
          b.addEventListener('click', function () {
            method = b.dataset.rmethod;
            form.querySelectorAll('#rec-methods [data-rmethod]').forEach(function (x) {
              x.classList.toggle('is-on', x.dataset.rmethod === method);
            });
          });
        });

        const act = form.querySelector('#rec-active');
        if (act) {
          act.addEventListener('click', function () {
            active = !active;
            act.classList.toggle('is-on', active);
            act.setAttribute('aria-checked', active ? 'true' : 'false');
            form.querySelector('#rec-active-txt').textContent = active ? '자동 기록 켜짐' : '자동 기록 멈춤';
          });
        }

        const dayEl = form.querySelector('#rec-day');
        if (dayEl) {
          dayEl.addEventListener('input', function () {
            const v = String(dayEl.value).replace(/[^0-9]/g, '').slice(0, 2);
            if (dayEl.value !== v) dayEl.value = v;
          });
        }
      }
    });
  }

  /* ---------- 카테고리 관리 ---------- */
  function openCatManager() {
    let tab = 'expense';
    let formEl = null;

    function rowsHTML() {
      const list = Store.catList('general', tab);
      if (!list.length) return '<div class="helper">카테고리가 하나도 없어요. 아래에서 추가해 보세요.</div>';
      return list.map(function (l) {
        return '<div class="cat-man-row">' +
          '<span class="cat-ic">' + UI.esc(catIcon(l)) + '</span>' +
          '<input class="cat-man-input" data-old="' + UI.esc(l) + '" data-icon="' + UI.esc(catParts(l).icon) + '" value="' + UI.esc(catName(l)) + '" maxlength="24" aria-label="' + UI.esc(catName(l)) + '">' +
          '<button type="button" class="cat-man-del" data-del="' + UI.esc(l) + '" aria-label="' + UI.esc(catName(l)) + ' 지우기">✕</button>' +
        '</div>';
      }).join('');
    }

    function draw() {
      if (!formEl) return;
      const listEl = formEl.querySelector('#cat-man-list');
      if (!listEl) return;
      listEl.innerHTML = rowsHTML();
      bindList();
    }

    function rename(input) {
      const from = input.dataset.old;
      const typed = input.value.trim();
      if (!typed) { input.value = catName(from); UI.toast('이름을 비울 수 없어요'); return; }
      const p = catParts(typed);
      const icon = p.icon || input.dataset.icon || '';
      const to = p.icon ? typed : (icon ? icon + ' ' + p.name : typed);
      if (to === from) return;
      if (!Store.renameCategory('general', tab, from, to)) {
        input.value = catName(from);
        UI.toast('같은 이름의 카테고리가 이미 있어요');
        return;
      }
      UI.toast('이름을 바꿨어요');
      draw();
      render();
    }

    function bindList() {
      if (!formEl) return;
      formEl.querySelectorAll('.cat-man-input').forEach(function (input) {
        input.addEventListener('change', function () { rename(input); });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        });
      });
      formEl.querySelectorAll('.cat-man-del').forEach(function (b) {
        b.addEventListener('click', function () {
          Store.removeCategory('general', tab, b.dataset.del);
          UI.toast('카테고리를 지웠어요');
          draw();
          render();
        });
      });
    }

    function addFromInput() {
      const input = formEl.querySelector('#cat-new');
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      if (!Store.addCategory('general', tab, v)) {
        UI.toast('같은 이름의 카테고리가 이미 있어요');
        return;
      }
      input.value = '';
      UI.toast('카테고리를 추가했어요');
      draw();
      render();
    }

    const body = '' +
      '<div class="seg seg-2" id="cat-tab">' +
        '<button type="button" data-ctab="expense" class="is-on">지출</button>' +
        '<button type="button" data-ctab="income">수입</button>' +
      '</div>' +
      '<div class="helper" style="margin:9px 0 10px">이름을 고치면 지난 내역의 카테고리도 함께 바뀌고, 지워도 지난 내역은 그대로 남아요. 이모지를 앞에 붙이면 아이콘으로 보여요.</div>' +
      '<div class="cat-man-list" id="cat-man-list">' + rowsHTML() + '</div>' +
      '<div class="cat-man-add">' +
        '<input class="input" id="cat-new" maxlength="24" placeholder="예: 🍽️ 식비" aria-label="새 카테고리">' +
        '<button type="button" class="btn small primary" id="cat-add">추가</button>' +
      '</div>' +
      '<button type="button" class="btn small ghost block" id="cat-reset" style="margin-top:8px">기본 카테고리로 되돌리기</button>';

    UI.openSheet({
      title: '카테고리 관리',
      subtitle: '일반 가계부 ' + (tab === 'expense' ? '지출' : '수입') + ' 카테고리',
      body: body,
      noFocus: true,
      buttons: [{ label: '닫기', kind: 'ghost' }],
      onMount: function (form) {
        formEl = form;
        form.querySelectorAll('[data-ctab]').forEach(function (b) {
          b.addEventListener('click', function () {
            tab = b.dataset.ctab;
            form.querySelectorAll('[data-ctab]').forEach(function (x) {
              x.classList.toggle('is-on', x.dataset.ctab === tab);
            });
            const sub = form.closest('.sheet') && form.closest('.sheet').querySelector('.sheet-head p');
            if (sub) sub.textContent = '일반 가계부 ' + (tab === 'expense' ? '지출' : '수입') + ' 카테고리';
            draw();
          });
        });
        bindList();

        form.querySelector('#cat-add').addEventListener('click', addFromInput);
        form.querySelector('#cat-new').addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); addFromInput(); }
        });
        form.querySelector('#cat-reset').addEventListener('click', function () {
          UI.confirmDialog({
            title: '기본 카테고리로 되돌릴까요?',
            message: '일반 가계부 ' + (tab === 'expense' ? '지출' : '수입') + ' 카테고리를 처음 19가지 목록으로 되돌려요. 지난 내역은 그대로 남아요.',
            confirmLabel: '되돌리기',
            danger: true,
            onConfirm: function () {
              Store.resetCatList('general', tab);
              UI.toast('기본 카테고리로 되돌렸어요');
              render();
              openCatManager();
            }
          });
        });
      }
    });
  }

  /* ---------- 예산 · 기간 시작일 설정 ---------- */
  function openFinanceSetup() {
    const f = Store.financeSettings();
    let day = f.startDay;
    const today = UI.todayISO();

    function chipsHTML() {
      const days = [1, 5, 10, 15, 16, 20, 25, 28];
      let html = days.map(function (d) {
        return '<button type="button" class="chip' + (day === d ? ' is-on' : '') + '" data-day="' + d + '">' + d + '일</button>';
      }).join('');
      html += '<button type="button" class="chip' + (day === 'last' ? ' is-on' : '') + '" data-day="last">그 달 말일</button>';
      return html;
    }

    const body = '' +
      '<div class="field"><label>한 기간을 며칠부터 셀까요?</label>' +
        '<div class="chips" id="bg-days">' + chipsHTML() + '</div>' +
        '<div class="rec-day-wrap" style="margin-top:9px">' +
          '<input class="input" type="number" id="bg-day" min="1" max="28" inputmode="numeric" placeholder="1~28" value="' + (day === 'last' ? '' : day) + '" aria-label="매월 시작일">' +
          '<span class="rec-day-unit">일</span>' +
        '</div>' +
        '<div class="helper">1일부터가 아니어도 괜찮아요. 16일을 고르면 <b>11.16 ~ 12.15</b>처럼 그날부터 다음 달 하루 전까지가 한 기간이 돼요. (1~28일 또는 말일)</div>' +
      '</div>' +
      '<div class="bg-preview" id="bg-preview"></div>' +
      '<div class="field"><label>한 기간 예산 (지출)</label>' +
        '<div class="amount-wrap">' +
          '<input class="input amount-input" id="bg-budget" inputmode="numeric" autocomplete="off" placeholder="예: 2,000,000" value="' + (f.budget ? Number(f.budget).toLocaleString('ko-KR') : '') + '" aria-label="한 기간 예산">' +
          '<span class="amount-unit">원</span>' +
        '</div>' +
        '<div class="helper">비워 두면 예산 없이 내역만 보여드려요. 기간을 넘겨 봐도 같은 예산으로 계산해요.</div>' +
      '</div>';

    UI.openSheet({
      title: '예산 · 기간 설정',
      subtitle: '일반 가계부에만 적용돼요 · 재테크 가계부는 1일~말일 그대로',
      body: body,
      noFocus: true,
      buttons: [
        { label: '저장', kind: 'primary', submit: true, onClick: function (form) {
            const budget = UI.parseAmount(form.querySelector('#bg-budget').value);
            Store.setFinanceSettings({ startDay: day, budget: budget });
            periodStart = periodStartOf(UI.todayISO());
            render();
            UI.toast(day === 'last' ? '말일부터 시작하는 기간으로 저장했어요' : day + '일부터 시작하는 기간으로 저장했어요');
          } },
        { label: '취소', kind: 'ghost' }
      ],
      onMount: function (form) {
        UI.bindAmount(form.querySelector('#bg-budget'));
        const dayInput = form.querySelector('#bg-day');
        const prev = form.querySelector('#bg-preview');

        function syncChips() {
          form.querySelectorAll('#bg-days [data-day]').forEach(function (b) {
            b.classList.toggle('is-on', String(b.dataset.day) === String(day));
          });
        }

        function preview() {
          const start = periodStartOf(today, day);
          const p = { start: start, end: UI.isoAdd(nextStart(start, day), -1) };
          const n = nextStart(start, day);
          const p2 = { start: n, end: UI.isoAdd(nextStart(n, day), -1) };
          prev.innerHTML = '<span>지금 이 설정이면</span><b>' + periodLabel(p) + '</b>' +
            '<span class="bg-next">다음 기간 ' + shortPeriod(p2) + '</span>';
        }

        form.querySelectorAll('#bg-days [data-day]').forEach(function (b) {
          b.addEventListener('click', function () {
            day = b.dataset.day === 'last' ? 'last' : Number(b.dataset.day);
            dayInput.value = day === 'last' ? '' : day;
            syncChips();
            preview();
          });
        });

        dayInput.addEventListener('input', function () {
          const v = String(dayInput.value).replace(/[^0-9]/g, '').slice(0, 2);
          if (dayInput.value !== v) dayInput.value = v;
          if (v) {
            let n = Number(v);
            if (n > 28) { n = 28; dayInput.value = '28'; }
            day = Math.max(1, n);
            syncChips();
            preview();
          }
        });
        dayInput.addEventListener('blur', function () {
          if (!dayInput.value) {
            if (day === 'last') return;
            dayInput.value = day;
            return;
          }
          let n = Math.min(28, Math.max(1, Number(dayInput.value) || 1));
          day = n;
          dayInput.value = n;
          syncChips();
          preview();
        });

        syncChips();
        preview();
      }
    });
  }

  /* ---------- 입력 ---------- */
  function defaultDate() {
    const t = UI.todayISO();
    if (book === 'general') {
      const p = curPeriod();
      return (t >= p.start && t <= p.end) ? t : p.start;
    }
    return UI.ymOf(t) === ym ? t : ym + '-01';
  }

  function chipsHTML(type, chosen) {
    const list = Store.catList(book, type);
    return list.map(function (c) {
      return '<button type="button" class="chip ' + (c === chosen ? 'is-on' : '') + '" data-cat="' + UI.esc(c) + '">' + UI.esc(c) + '</button>';
    }).join('') + '<button type="button" class="chip chip-add" data-cat-custom="1">＋ 직접</button>';
  }

  function openEditor(item, opts) {
    const isNew = !item;
    const back = opts && typeof opts.back === 'function' ? opts.back : null;
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
        '<input class="input" type="date" id="fin-date" value="' + UI.esc(isNew ? defaultDate() : item.date) + '">' +
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
          if (customMode && category) Store.addCategory(book, type, category);
          if (isNew) {
            Store.add('finance', { date: date, book: book, type: type, amount: amount, category: category, memo: memo });
          } else {
            Store.update('finance', item.id, { date: date, book: book, type: type, amount: amount, category: category, memo: memo });
          }
          if (book === 'general') periodStart = periodStartOf(date);
          else ym = UI.ymOf(date);
          filter = 'all';
          render();
          UI.toast(isNew ? '내역을 기록했어요' : '저장했어요');
          if (back) setTimeout(back, 0);
        } },
      { label: '취소', kind: 'ghost', onClick: function () {
        if (back) setTimeout(back, 0);
      } }
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
            if (back) setTimeout(back, 0);
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
