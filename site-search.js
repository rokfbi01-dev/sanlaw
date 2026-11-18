/* ═══════════════════════════════════════════════════════════════
   산 법무사 사무소 — 업무 및 내용으로 찾기 (2026-11-18)
   ─ 쓰는 법: 검색창을 둘 자리에 <div id="sanSearch"></div> 를 두고
             </body> 앞에 <script src="site-search.js?v=20261118" defer></script>
   ─ data-gate="chk" : 첫 화면처럼 면책 확인란이 있는 페이지에서 그 확인란 id.
                        확인 전에는 결과를 눌러도 열리지 않고 확인란을 먼저 보여 준다.
   ─ 색인: site-search-index.json (업무카드·준비중 항목·계산기 화면·안내 페이지)
           처음 검색창을 누를 때 한 번만 불러온다.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var mount = document.getElementById('sanSearch');
  if (!mount || mount.getAttribute('data-ready')) return;
  mount.setAttribute('data-ready', '1');
  var VER = '20261118';
  var GATE = mount.getAttribute('data-gate');

  /* ── 모양 (페이지에 한 번만) ── */
  var css = ''
    + '#sanSearch{position:relative;max-width:620px;margin:0 auto 30px;text-align:left;font-family:inherit;z-index:30;}'
    + '#sanSearch .ss-lab{display:block;font-size:13.5px;font-weight:700;letter-spacing:.02em;color:#e9d8b4;margin:0 0 7px 4px;}'
    + '#sanSearch.ss-light .ss-lab{color:#7a5230;}'
    + '#sanSearch .ss-bar{display:flex;align-items:center;height:38px;box-sizing:border-box;background:#fff;border:2px solid #c9a46a;border-radius:9px;box-shadow:0 3px 10px rgba(0,0,0,.16);overflow:hidden;}'
    + '#sanSearch .ss-bar:focus-within{border-color:#a47148;box-shadow:0 0 0 3px rgba(201,164,106,.35),0 6px 22px rgba(0,0,0,.18);}'
    + '#sanSearch .ss-ico{flex:0 0 auto;padding:0 2px 0 11px;color:#a47148;display:flex;}'
    + '#sanSearch input{flex:1 1 auto;min-width:0;height:100%;border:0;outline:0;background:transparent;font:inherit;font-size:14.5px;color:#241a10;padding:0 8px;}'
    + '#sanSearch input::-webkit-search-cancel-button{display:none;}'
    + '#sanSearch .ss-clr{flex:0 0 auto;display:none;align-items:center;gap:3px;border:0;background:#f1ece2;color:#6b5d49;font:inherit;font-size:12.5px;font-weight:700;border-radius:12px;padding:3px 9px;margin-right:6px;cursor:pointer;}'
    + '#sanSearch.ss-has .ss-clr{display:inline-flex;}'
    + '#sanSearch .ss-clr:hover{background:#e6dcc9;color:#3d2f1d;}'
    + '#sanSearch input::placeholder{color:#9a8f7c;}'
    + '#sanSearch .ss-go{flex:0 0 auto;border:0;background:#7a5230;color:#fff;font:inherit;font-size:14px;font-weight:700;padding:0 16px;align-self:stretch;cursor:pointer;}'
    + '#sanSearch .ss-go:hover{background:#5f3f24;}'
    + '#sanSearch .ss-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:9px 2px 0;font-size:12.5px;color:#d9ccb3;align-items:center;}'
    + '#sanSearch.ss-light .ss-chips{color:#6b6252;}'
    + '#sanSearch .ss-chip{border:1px solid rgba(233,216,180,.55);background:rgba(255,255,255,.08);color:#f3e7cf;border-radius:14px;padding:3px 10px;font:inherit;font-size:12.5px;cursor:pointer;}'
    + '#sanSearch.ss-light .ss-chip{border-color:#e3d3b4;background:#fff;color:#7a5230;}'
    + '#sanSearch .ss-chip:hover{background:rgba(255,255,255,.2);}'
    + '#sanSearch.ss-light .ss-chip:hover{background:#f8f1e4;}'
    + '#sanSearch .ss-box{position:relative;}'
    + '#sanSearch .ss-panel{display:none;position:absolute;left:0;right:0;top:100%;margin-top:8px;background:#fff;border:1px solid #e7e0d4;border-radius:14px;box-shadow:0 14px 40px rgba(30,20,10,.28);max-height:min(70vh,620px);overflow:auto;color:#241a10;}'
    + '#sanSearch.ss-open .ss-panel{display:block;}'
    + '#sanSearch .ss-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 16px;font-size:13px;color:#7a6e5b;border-bottom:1px solid #f0e9dc;position:sticky;top:0;background:#fff;z-index:1;}'
    + '#sanSearch .ss-x{border:1px solid #e3d8c3;background:#fff;font:inherit;font-size:12.5px;font-weight:700;line-height:1;color:#6b5d49;cursor:pointer;padding:5px 10px;border-radius:12px;white-space:nowrap;}'
    + '#sanSearch .ss-x:hover{background:#f6f1e7;}'
    + '#sanSearch .ss-gate{margin:12px 14px 4px;padding:11px 13px;background:#f8f5ee;border:1px solid #e7e0d4;border-left:4px solid #a47148;border-radius:0 10px 10px 0;font-size:13.5px;line-height:1.7;color:#4a4437;}'
    + '#sanSearch .ss-gate label{display:flex;align-items:center;gap:8px;margin-top:7px;font-weight:700;color:#241a10;cursor:pointer;}'
    + '#sanSearch .ss-gate input{width:19px;height:19px;accent-color:#a47148;flex:0 0 auto;padding:0;}'
    + '#sanSearch .ss-gate.ss-shake{border-left-color:#c0392b;background:#fdf1ee;}'
    + '#sanSearch .ss-gmore{display:none;border:0;background:none;padding:2px 0 0;font:inherit;font-size:12.5px;font-weight:700;color:#7a5230;text-decoration:underline;cursor:pointer;}'
    + '#sanSearch ul{list-style:none;margin:0;padding:4px 0;}'
    + '#sanSearch li{display:flex;align-items:flex-start;gap:10px;padding:0 10px 0 0;border-top:1px solid #f4efe6;}'
    + '#sanSearch li:first-child{border-top:0;}'
    + '#sanSearch li a.ss-main{flex:1 1 auto;display:block;padding:11px 6px 11px 16px;text-decoration:none;color:inherit;min-width:0;}'
    + '#sanSearch li.ss-act,#sanSearch li:hover{background:#fbf7ef;}'
    + '#sanSearch .ss-t{font-size:15.5px;font-weight:700;line-height:1.5;color:#241a10;}'
    + '#sanSearch .ss-t mark,#sanSearch .ss-s mark{background:#fbe6b5;color:inherit;padding:0 1px;border-radius:2px;}'
    + '#sanSearch .ss-p{font-size:12.5px;color:#8a7f6c;margin-top:2px;}'
    + '#sanSearch .ss-s{font-size:13px;color:#5a5246;margin-top:3px;line-height:1.6;}'
    + '#sanSearch .ss-b{display:inline-block;font-size:11.5px;font-weight:800;border-radius:6px;padding:1px 7px;margin-right:6px;vertical-align:2px;}'
    + '#sanSearch .ss-b.card{background:#f3e6cc;color:#7a5230;}'
    + '#sanSearch .ss-b.calc{background:#e3f1e6;color:#2f6b3d;}'
    + '#sanSearch .ss-b.page{background:#e6eef7;color:#2c5282;}'
    + '#sanSearch .ss-b.soon{background:#eeeeee;color:#666;}'
    + '#sanSearch a.ss-calc{flex:0 0 auto;margin-top:12px;font-size:12.5px;font-weight:700;color:#2f6b3d;background:#eef7ef;border:1px solid #cfe5d3;border-radius:14px;padding:4px 10px;text-decoration:none;white-space:nowrap;}'
    + '#sanSearch a.ss-calc:hover{background:#dff0e3;}'
    + '#sanSearch .ss-more{display:block;width:calc(100% - 28px);margin:6px 14px 12px;border:1px solid #e7e0d4;background:#fff;border-radius:10px;padding:9px;font:inherit;font-size:14px;font-weight:700;color:#7a5230;cursor:pointer;}'
    + '#sanSearch .ss-none{padding:18px 16px 16px;font-size:14.5px;line-height:1.75;color:#4a4437;}'
    + '#sanSearch .ss-none a{color:#7a5230;font-weight:800;}'
    + '#sanSearch .ss-part{padding:8px 16px;font-size:12.5px;color:#a3742f;background:#fffaf0;}'
    + '#sanSearch .ss-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}'
    + '@media (max-width:560px){#sanSearch{margin-bottom:24px;}#sanSearch .ss-bar{height:38px;}#sanSearch input{font-size:16px;}#sanSearch .ss-go{padding:0 13px;font-size:14px;}#sanSearch .ss-chips>span{display:none;}'
    + '#sanSearch .ss-gate{font-size:12.5px;margin:10px 10px 4px;}#sanSearch .ss-gate:not(.ss-full) .ss-gt{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}#sanSearch .ss-gate:not(.ss-full) .ss-gmore{display:inline-block;}'
    + '#sanSearch .ss-panel{max-height:68vh;}#sanSearch li{flex-wrap:wrap;padding:0 0 10px;}#sanSearch li a.ss-main{padding-bottom:4px;}#sanSearch a.ss-calc{margin:0 0 0 16px;}}'
    /* 2026-11-18 휴대폰·태블릿: 결과 창이 아래 화면 위에 겹쳐 뜨지 않고, 아래 내용을 밀어 내리며 그 자리에 펼쳐진다 */
    /* 2026-11-18 휴대폰: 결과 글씨·여백을 줄이고 「비용 계산」 단추를 작게 */
    + '@media (max-width:560px){#sanSearch .ss-lab{font-size:12px;margin-bottom:6px;}#sanSearch .ss-chips{gap:5px;margin-top:7px;}#sanSearch .ss-chip{font-size:12px;padding:2px 9px;}'
    + '#sanSearch .ss-head{padding:7px 12px;font-size:12px;}#sanSearch .ss-x{font-size:12px;padding:4px 9px;}'
    + '#sanSearch li a.ss-main{padding:9px 10px 3px 12px;}#sanSearch .ss-t{font-size:14px;line-height:1.45;}#sanSearch .ss-b{font-size:10.5px;padding:0 5px;margin-right:5px;}'
    + '#sanSearch .ss-p{font-size:11.5px;margin-top:1px;}#sanSearch .ss-s{font-size:12px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}'
    + '#sanSearch li{padding-bottom:8px;}#sanSearch a.ss-calc{margin:2px 0 0 12px;font-size:11.5px;padding:2px 8px;}'
    + '#sanSearch .ss-gate{font-size:12px;padding:9px 11px;}#sanSearch .ss-gate label{font-size:12px;}#sanSearch .ss-more{font-size:13px;padding:8px;margin:4px 12px 10px;width:calc(100% - 24px);}#sanSearch .ss-none{font-size:13px;}}'
    + '@media (max-width:768px){#sanSearch .ss-panel{position:static;margin-top:8px;max-height:none;overflow:visible;box-shadow:0 6px 18px rgba(30,20,10,.22);}#sanSearch .ss-head{position:static;}}'
    + '@media print{#sanSearch{display:none!important;}}';
  if (!document.getElementById('ss-css')) {
    var st = document.createElement('style'); st.id = 'ss-css'; st.textContent = css; document.head.appendChild(st);
  }

  /* ── 화면 ── */
  var EX = ['빚 상속', '형제 도장', '전세보증금', '유언장', '부모님 치매', '법인설립', '가압류', '이혼 재산분할'];
  mount.innerHTML =
    '<label class="ss-lab" for="ssQ">🔎 업무 및 내용으로 찾기 — 지금 상황을 쉬운 말로 적어 보세요</label>'
    + '<div class="ss-box"><div class="ss-bar" role="search">'
    + '<span class="ss-ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg></span>'
    + '<input id="ssQ" type="search" autocomplete="off" enterkeyhint="search" placeholder="예: 형제가 상속 도장을 안 찍어 줘요" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ssList">'
    + '<button type="button" class="ss-clr" aria-label="검색어 지우기">✕ 지우기</button>'
    + '<button type="button" class="ss-go">찾기</button></div>'
    + '<div class="ss-panel" id="ssPanel" aria-live="polite"></div></div>'
    + '<div class="ss-chips"><span>자주 찾는 말:</span>' + EX.map(function (w) { return '<button type="button" class="ss-chip">' + w + '</button>'; }).join('') + '</div>';
  if (mount.className.indexOf('ss-light') < 0 && mount.getAttribute('data-theme') === 'light') mount.className += ' ss-light';
  var q = mount.querySelector('#ssQ'), panel = mount.querySelector('#ssPanel');

  /* ── 색인 불러오기 ── */
  var DOCS = null, loading = null;
  function load() {
    if (DOCS) return Promise.resolve(DOCS);
    if (loading) return loading;
    loading = fetch('site-search-index.json?v=' + VER).then(function (r) { return r.json(); }).then(function (d) {
      d.forEach(function (x) {
        x._f = {
          t: nz(x.t), a: nz(x.a), h: nz(x.h), c: nz(x.c), s: nz(x.s), w: nz(x.w), x: nz(x.x), b: nz(x.b)
        };
      });
      DOCS = d; return d;
    }).catch(function () { loading = null; DOCS = null; throw new Error('index'); });
    return loading;
  }
  function nz(s) { return (s || '').toLowerCase().replace(/[\s·ㆍ\-—–_,.()「」『』'"“”‘’\[\]]+/g, ''); }

  /* ── 쉬운 말 → 법률 용어 (한쪽만 맞아도 찾도록) ── */
  var SYN = {
    '빚': ['채무', '부채', '한정승인', '상속포기'], '채무': ['빚'], '부채': ['빚', '채무'],
    '돌아가': ['사망', '상속'], '돌아가신': ['사망', '상속'], '사망': ['상속'],
    '집주인': ['임대인'], '세입자': ['임차인'], '월세': ['차임', '임대차'], '전세금': ['전세보증금', '보증금'],
    '유언장': ['유언'], '도장': ['인감', '날인', '협의분할'], '치매': ['후견', '성년후견', '한정후견'],
    '회사': ['법인', '주식회사'], '사업자': ['법인'], '월급': ['급여'], '급여': ['월급'],
    '땅': ['토지', '부동산'], '집': ['주택', '부동산', '아파트'], '아파트': ['주택', '부동산'],
    '떼인': ['가압류', '대여금', '채권'], '파혼': ['약혼'], '대출': ['근저당'], '공증': ['공정증서'],
    '이름': ['개명', '상호'], '바꾸': ['변경', '정정'], '고치': ['정정', '변경'], '명의': ['소유권이전', '등기'], '형제': ['형제자매', '상속인'], '압류': ['가압류'],
    '물려받': ['상속'], '포기': ['상속포기']
  };
  var STOP = ['어떻게', '어떡해', '하나요', '해야', '해야하나요', '방법', '있나요', '되나요', '알려주세요', '주세요', '싶어요', '싶은데', '관련', '문의', '저는', '제가', '내가', '우리', '좀', '것', '수', '때', '경우', '무엇', '뭐', '왜', '언제', '어디', '절차', '하려면', '하고싶어요', '더', '좀', '꼭', '또', '다', '잘', '안', '못', '많아', '많은', '많이', '너무', '정말', '진짜', '그냥', '계속', '지금'];
  /* 비용·서류처럼 어느 안내에나 붙는 말은 꼭 맞지 않아도 되는 말로 본다(맞으면 점수만 조금 더) */
  var SOFT = ['비용', '수수료', '서류', '준비서류', '방법', '신청', '안내', '기간', '얼마', '계산', '견적', '양식'];
  var COST = ['비용', '수수료', '얼마', '계산', '견적'];
  var ENDS = ['하고싶어요', '싶어요', '으려면', '하려면', '했어요', '했는데', '할까요', '습니다', '인가요', '이에요', '주세요', '려면', '으면', '는데', '어요', '아요', '해요', '나요', '까요', '세요', '니다', '예요', '에요', '줘요', '에서', '으로', '까지', '부터', '에게', '한테', '처럼', '보다', '이랑', '은', '는', '이', '가', '을', '를', '에', '의', '도', '만', '과', '와', '로', '요'];
  function stem(t) {
    for (var i = 0; i < ENDS.length; i++) {
      var e = ENDS[i];
      if (t.length - e.length >= 2 && t.slice(-e.length) === e) return t.slice(0, -e.length);
      if (e.length === 1 && t.length === 2 && t.slice(-1) === e && SYN[t[0]]) return t[0];   /* 빚이 → 빚 */
    }
    return t;
  }
  function tokens(s) {
    var raw = s.toLowerCase().split(/[\s,.;/·]+/).filter(Boolean), out = [];
    raw.forEach(function (t) {
      t = t.replace(/[?!~"'()「」]/g, ''); if (!t) return;
      if (STOP.indexOf(t) >= 0) return;
      var st = stem(t); if (STOP.indexOf(st) >= 0) return;
      var alts = [st]; if (st !== t) alts.unshift(t);
      Object.keys(SYN).forEach(function (k) { if (st.indexOf(k) === 0 || st === k) alts = alts.concat(SYN[k]); });
      out.push({ raw: t, soft: SOFT.indexOf(st) >= 0 || SOFT.indexOf(t) >= 0, cost: COST.indexOf(st) >= 0,
                 alts: alts.map(nz).filter(function (a, i, arr) { return a && arr.indexOf(a) === i; }) });
    });
    return out;
  }

  /* ── 점수 매기기 ── */
  var W = { t: 12, a: 8, h: 6, c: 5, x: 3, s: 4, w: 4, b: 1 };
  var KB = { card: 3, page: 1, calc: 0, soon: -3 };
  function search(str) {
    var toks = tokens(str); if (!toks.length) return { full: [], part: [] };
    var whole = nz(str), full = [], part = [];
    var need = toks.filter(function (t) { return !t.soft; }).length || toks.length;
    var wantCost = toks.some(function (t) { return t.cost; });
    DOCS.forEach(function (d) {
      var sc = 0, hit = 0;
      toks.forEach(function (tk) {
        var best = 0;
        tk.alts.forEach(function (a, ai) {
          Object.keys(W).forEach(function (f) {
            if (d._f[f] && d._f[f].indexOf(a) >= 0) { var v = W[f] * (ai === 0 || a === nz(tk.raw) ? 1 : 0.7); if (v > best) best = v; }
          });
        });
        if (best > 0) { if (!tk.soft || need === toks.length) hit++; sc += best; }
      });
      if (!hit) return;
      if (wantCost && (d.k === 'calc' || d.x)) sc += d.k === 'calc' ? 8 : 3;   /* 비용을 묻으면 계산기를 앞으로 */
      if (d.k === 'soon' && !(d._f.t.indexOf(toks[0].alts[0]) >= 0 || hit >= need)) return;
      if (whole.length >= 2 && d._f.t.indexOf(whole) >= 0) sc += 15;
      sc += KB[d.k] || 0;
      (hit >= need ? full : part).push({ d: d, s: sc, h: hit });
    });
    var by = function (a, b) { return b.s - a.s || (a.d.t.length - b.d.t.length); };
    full.sort(by); part.sort(function (a, b) { return b.h - a.h || by(a, b); });
    return { full: full, part: part, toks: toks };
  }

  /* ── 그리기 ── */
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mark(text, toks) {
    var h = esc(text);
    var words = [];
    toks.forEach(function (tk) { [tk.raw].concat(tk.alts).forEach(function (a) { if (a && a.length >= 1 && words.indexOf(a) < 0) words.push(a); }); });
    words.sort(function (a, b) { return b.length - a.length; });
    words.forEach(function (w) {
      var re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      h = h.replace(/(<[^>]*>)|([^<]+)/g, function (m, tag, txt) { return tag ? tag : txt.replace(re, '<mark>$1</mark>'); });
    });
    return h;
  }
  var BADGE = { card: '업무카드', calc: '비용 계산기', page: '안내', soon: '준비중' };
  var FIRST = (window.matchMedia && window.matchMedia('(max-width:560px)').matches) ? 6 : 8;   /* 휴대폰은 처음 6건 */
  var shown = FIRST, last = null;
  function agreed() { if (!GATE) return true; var c = document.getElementById(GATE); return !c || c.checked; }
  function gateHtml() {
    if (agreed()) return '';
    var src = document.querySelector('.pa-notice');
    var txt = src ? src.cloneNode(true) : null;
    if (txt) { var l = txt.querySelector('label'); if (l) l.remove(); }
    return '<div class="ss-gate" id="ssGate"><span class="ss-gt">' + (txt ? txt.innerHTML.trim() : '<b>[면책 안내]</b> 본 자료는 일반적인 법률정보이며 개별 사건에 대한 법률자문이 아닙니다.') + '</span>'
      + '<button type="button" class="ss-gmore">면책 안내 전체 보기</button>'
      + '<label><input type="checkbox" id="ssAgree"> 위 면책 사항을 확인하였습니다. (확인하시면 아래 결과를 바로 여실 수 있습니다)</label></div>';
  }
  function row(r, toks) {
    var d = r.d, href = d.k === 'soon' ? 'index.html#contact' : d.u;
    var snip = d.k === 'soon' ? '아직 안내를 준비 중입니다 — 상담으로 바로 도와드립니다' : (d.h || d.s || '');
    if (snip.length > 90) snip = snip.slice(0, 88) + '…';
    var calc = d.x ? '<a class="ss-calc" href="tools-calculator.html#s=' + encodeURIComponent(d.x) + '" title="' + esc(d.x) + ' 계산 화면">🧮 비용 계산</a>' : '';
    return '<li role="option"><a class="ss-main" href="' + esc(href) + '">'
      + '<div class="ss-t"><span class="ss-b ' + d.k + '">' + BADGE[d.k] + '</span>' + mark(d.t, toks) + '</div>'
      + '<div class="ss-p">' + esc(d.c || '') + '</div>'
      + (snip ? '<div class="ss-s">' + mark(snip, toks) + '</div>' : '')
      + '</a>' + calc + '</li>';
  }
  function contactHref() { return 'index.html#contact'; }
  function render(str) {
    var R = search(str); last = R;
    var list = R.full.length ? R.full : R.part;
    var html = '<div class="ss-head"><span>' + (list.length ? '「' + esc(str) + '」 찾은 결과 ' + list.length + '건' : '「' + esc(str) + '」') + '</span><button type="button" class="ss-x" aria-label="검색 결과 닫기">닫기 ✕</button></div>';
    html += gateHtml();
    if (!list.length) {
      html += '<div class="ss-none">맞는 안내를 찾지 못했습니다.<br>다른 쉬운 말로 다시 찾아보시거나, <a href="' + contactHref() + '">상담 문의</a>로 상황을 알려 주시면 맞는 길을 안내해 드리겠습니다.</div>';
    } else {
      if (!R.full.length) html += '<div class="ss-part">적으신 말이 모두 들어 있는 안내는 없어, 일부 낱말이 맞는 것을 보여 드립니다.</div>';
      html += '<ul id="ssList" role="listbox">' + list.slice(0, shown).map(function (r) { return row(r, R.toks); }).join('') + '</ul>';
      if (list.length > shown) html += '<button type="button" class="ss-more">결과 더 보기 (' + (list.length - shown) + '건 더)</button>';
    }
    panel.innerHTML = html; act = -1;
    open(true);
    var ag = panel.querySelector('#ssAgree');
    if (ag) ag.addEventListener('change', function () {
      var c = document.getElementById(GATE);
      if (c && ag.checked) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }
      var g = panel.querySelector('#ssGate'); if (g && ag.checked) g.remove();
    });
  }
  function open(on) { mount.classList.toggle('ss-open', !!on); q.setAttribute('aria-expanded', on ? 'true' : 'false'); }

  var timer = null;
  function run(now) {
    var v = q.value.trim();
    clearTimeout(timer);
    if (!v) { open(false); return; }
    timer = setTimeout(function () {
      load().then(function () { shown = FIRST; render(v); })
        .catch(function () { panel.innerHTML = '<div class="ss-none">검색 자료를 불러오지 못했습니다. 잠시 뒤 다시 해 보시거나 <a href="' + contactHref() + '">상담 문의</a>를 이용해 주십시오.</div>'; open(true); });
    }, now ? 0 : 140);
  }
  function has() { mount.classList.toggle('ss-has', !!q.value); }
  q.addEventListener('input', function () { has(); run(false); });
  mount.querySelector('.ss-clr').addEventListener('click', function () { q.value = ''; has(); open(false); q.focus(); });
  var hold = false;   /* 닫기 직후 입력칸으로 초점이 돌아올 때 창이 다시 열리지 않게 */
  q.addEventListener('focus', function () { load().catch(function () {}); if (hold) { hold = false; return; } if (q.value.trim()) run(true); });
  mount.querySelector('.ss-go').addEventListener('click', function () { run(true); q.focus(); });
  mount.querySelectorAll('.ss-chip').forEach(function (b) { b.addEventListener('click', function () { q.value = b.textContent; has(); run(true); q.focus(); }); });

  /* 결과 누르기 — 면책 확인 전이면 막고 확인란을 보여 준다 */
  panel.addEventListener('click', function (e) {
    if (e.target.closest('.ss-x')) { clearTimeout(timer); open(false); return; }   /* 2026-11-18 휴대폰에서 닫기를 눌러도 다시 열리던 오류 수정 */
    if (e.target.closest('.ss-gmore')) { var gg = panel.querySelector('#ssGate'); if (gg) gg.classList.add('ss-full'); return; }
    if (e.target.closest('.ss-more')) { shown += 12; render(q.value.trim()); return; }
    var a = e.target.closest('a');
    if (a && !a.closest('.ss-gate') && !a.closest('.ss-none') && !agreed()) {
      e.preventDefault();
      var g = panel.querySelector('#ssGate');
      if (g) { g.classList.add('ss-shake'); g.scrollIntoView({ block: 'nearest' }); var cb = g.querySelector('input'); if (cb) cb.focus(); }
    }
  });
  /* 키보드: ↑↓ 고르기 · Enter 열기 · Esc 닫기 */
  var act = -1;
  q.addEventListener('keydown', function (e) {
    var items = panel.querySelectorAll('li');
    if (e.key === 'Escape') { open(false); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return; e.preventDefault();
      act = e.key === 'ArrowDown' ? Math.min(items.length - 1, act + 1) : Math.max(0, act - 1);
      items.forEach(function (li, i) { li.classList.toggle('ss-act', i === act); });
      items[act].scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!mount.classList.contains('ss-open')) { run(true); return; }
      var li = items[act >= 0 ? act : 0];
      var a = li && li.querySelector('a.ss-main');
      if (a) { if (!agreed()) { a.click(); return; } location.href = a.getAttribute('href'); }
      else run(true);
    }
  });
  document.addEventListener('click', function (e) { if (!e.target.isConnected || mount.contains(e.target)) return; open(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mount.classList.contains('ss-open')) { open(false); if (document.activeElement !== q) { hold = true; q.focus(); } } });
})();
