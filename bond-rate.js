/* ============================================================================
   국민주택채권 할인율 자동조회 — Cloudflare Pages Functions
   ★ 2026-08-16 엔드포인트 확정판 (저장된 조회화면 HTML에서 역추출·검증 완료)

   배치 위치 : GitHub 리포(rokfbi01-dev/sanlaw)  functions/api/bond-rate.js
   호출 주소 : https://sanlaw.co.kr/api/bond-rate
   배포      : 이 파일을 리포에 넣고 push → Cloudflare 자동 배포

   ── 확정된 수집 방식 ───────────────────────────────────────────────────
     URL    : https://svc.wooribank.com/svc/Dream?withyou=HBNHB0036&cc=c004893:c004893
     METHOD : POST  (GET은 서버가 파라미터를 버리고 초기화면으로 되돌립니다 — 실측 확인)
     BODY   : MODE=1&BSDT_YM=YYYYMM&STD_YEAR=YYYY&STD_MONTH=MM
     인코딩 : UTF-8
     결과표 : <caption>예금/신탁 목록</caption>
              <tr><td>2026.08.03</td><td>8,506</td><td>4.252</td><td>15.13027</td></tr>
              열 순서 = 기준일 · 매도단가 · 수익률 · 할인율
     보안토큰: 없음 (CSRF·nonce 미사용 확인)

   ── 알아둘 점 ─────────────────────────────────────────────────────────
     · 할인율은 「과세구분 개인」 기준입니다. 법인·비과세는 값이 다릅니다.
     · 다음 영업일 적용분이 전날 미리 올라옵니다(한국거래소 신고 방식).
       그래서 주말·공휴일에는 「다음 영업일 예정분」이 잡히며, 이를 구분해 표시합니다.
     · 휴일은 행 자체가 없습니다(예: 2026.08.17 대체공휴일 → 행 없음).
   ========================================================================== */

const ENDPOINT = 'https://svc.wooribank.com/svc/Dream?withyou=HBNHB0036&cc=c004893:c004893';
const CACHE_SEC = 60 * 60 * 3;   // 3시간
const UA = 'sanlaw-calc/1.0 (+https://sanlaw.co.kr; 법무사 보수계산기 할인율 표시용; 1일 수회 조회)';

/* 오늘 날짜(KST). Cloudflare는 UTC로 돌아가므로 9시간을 더한다 */
function kstToday() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
function ymOf(dateStr, back) {
  const y = +dateStr.slice(0, 4), m = +dateStr.slice(5, 7) - (back || 0);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return { y: String(d.getUTCFullYear()), m: String(d.getUTCMonth() + 1).padStart(2, '0') };
}

/* 한 달치 표를 받아 행 배열로 돌려준다 */
async function fetchMonth(y, m) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'user-agent': UA,
      'accept-language': 'ko-KR,ko;q=0.9',
    },
    body: 'MODE=1&BSDT_YM=' + y + m + '&STD_YEAR=' + y + '&STD_MONTH=' + m,
  });
  if (!res.ok) return [];
  const html = await res.text();

  /* 결과표 구간만 잘라낸 뒤 파싱 — 정규식이 문서 전체를 훑지 않게 해 CPU를 아낀다 */
  const s = html.indexOf('예금/신탁 목록');
  if (s < 0) return [];
  const seg = html.slice(s, html.indexOf('</table>', s));

  const rows = [];
  const re = /<tr>\s*<td>(\d{4})\.(\d{2})\.(\d{2})<\/td>\s*<td>([\d,]+)<\/td>\s*<td>([\d.]+)<\/td>\s*<td>([\d.]+)<\/td>\s*<\/tr>/g;
  let x;
  while ((x = re.exec(seg)) !== null) {
    rows.push({
      date: x[1] + '-' + x[2] + '-' + x[3],
      price: +x[4].replace(/,/g, ''),   // 매도단가
      yieldRate: +x[5],                 // 수익률
      rate: +x[6],                      // 할인율 ← 계산기가 쓰는 값
    });
  }
  return rows;
}

/* 이상치 방어 — 파싱이 어긋난 숫자가 의뢰인 견적에 그대로 들어가는 것을 막는다 */
const sane = r => r && isFinite(r.rate) && r.rate > 0 && r.rate < 40
                    && isFinite(r.price) && r.price > 1000 && r.price <= 10000;

/* 어느 행을 쓸지 고른다
     today    : 오늘 자 고시가 있다 → 그대로 사용
     upcoming : 오늘 자가 없고 미래 행이 있다 → 다음 영업일 적용 예정분(주말·공휴일)
     past     : 둘 다 없다 → 마지막 영업일 값 (반드시 화면에 경고 표시) */
function pick(rows, today) {
  const ok = rows.filter(sane).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!ok.length) return null;
  const exact = ok.find(r => r.date === today);
  if (exact) return Object.assign({}, exact, { status: 'today' });
  const next = ok.find(r => r.date > today);
  if (next) return Object.assign({}, next, { status: 'upcoming' });
  const past = ok.filter(r => r.date < today);
  if (past.length) return Object.assign({}, past[past.length - 1], { status: 'past' });
  return null;
}

const reply = (o) => new Response(JSON.stringify(o), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + CACHE_SEC,
  },
});

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const debug = url.searchParams.get('debug') === '1';

  /* 엣지 캐시 — 여기서 끝나면 외부 호출 0회 */
  const cache = caches.default;
  const key = new Request(url.origin + '/api/bond-rate', context.request);
  if (!debug) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }

  const today = kstToday();
  try {
    const cur = ymOf(today, 0);
    let rows = await fetchMonth(cur.y, cur.m);

    /* 월초라 이번 달 표가 비었거나 짧으면 지난달까지 합쳐 본다 (외부 호출 최대 2회) */
    if (rows.filter(sane).length < 3) {
      const prev = ymOf(today, 1);
      rows = (await fetchMonth(prev.y, prev.m)).concat(rows);
    }

    const p = pick(rows, today);
    if (!p) {
      return reply({
        ok: false, reason: '표를 읽지 못했습니다', rowsFound: rows.length,
        rows: debug ? rows.slice(0, 5) : undefined,
      });
    }

    const out = {
      ok: true,
      rate: p.rate,              // 할인율(%) — 계산기 bondRate 칸에 그대로 들어갑니다
      price: p.price,            // 매도단가(액면 10,000원 기준)
      yieldRate: p.yieldRate,    // 수익률
      baseDate: p.date,          // 고시 기준일
      status: p.status,          // today / upcoming / past
      stale: p.status === 'past',
      source: '주택도시기금(우리은행 채권조회)',
      taxType: '개인',
      fetchedAt: new Date().toISOString(),
      note: '과세구분 「개인」 기준입니다. 법인·비과세는 값이 다릅니다. 최종 금액은 매도 시점 고시에 따릅니다.',
    };
    if (debug) out.rows = rows;

    const res = reply(out);
    if (!debug) context.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    /* 실패해도 계산기는 종전대로 수동입력으로 동작합니다 */
    return reply({ ok: false, reason: '조회 실패: ' + (e && e.message) });
  }
}
