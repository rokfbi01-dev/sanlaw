/* 국민주택채권 즉시매도 할인율 — 자동 반영 + 사무소 확인값 (Cloudflare Pages Functions)
   경로: /api/bond-rate
   GET  → {rate, date, updatedAt, src}  (누구나 조회 — 계산기가 자동으로 읽음)
          그날 값이 아직 없으면 우리은행(주택도시기금 수탁은행) 「1종 채권 매도단가/수익률/할인율」
          고시표에서 가장 최근 영업일 값을 가져와 저장한다(src:'woori').
          · 주택도시기금 누리집의 같은 메뉴도 이 우리은행 화면을 그대로 띄운다.
          · 로그인·인증이 필요 없는 공개 조회 화면을 그대로 한 번 조회할 뿐이며, 실패하면 30분 동안 다시 시도하지 않는다.
          · 할인율은 과세구분 「개인」 기준(우리은행 화면 안내문).
   POST → 사무소만 저장 (Authorization: Bearer <BOND_ADMIN_KEY>)  본문 {rate}  — 자동값이 틀릴 때 손으로 바로잡는 용도(src:'office')
   필요한 설정(Cloudflare Pages 프로젝트 — 종전과 같음):
     · KV 바인딩  BOND_KV
     · 비밀 변수  BOND_ADMIN_KEY
   2026-11-19 개정: 자동 반영 추가(법무사님 지시). 종전 「사무소 확인값만 저장」 방식은 POST로 그대로 남김. */
const KEY = 'bond-rate';
const TRY_KEY = 'auto:lastTry';
const RETRY_MS = 30 * 60 * 1000;            // 자동 조회 간격(실패·주말 포함) 30분
const SRC_URL = 'https://svc.wooribank.com/svc/Dream?withyou=HBNHB0036&cc=c004893:c004893';
const HIST_TTL = 60 * 60 * 24 * 400;         // 날짜별 기록 약 13개월 보관
const HDR = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: HDR });

/* 한국 날짜(YYYY-MM-DD) — 서버 시계 기준, 의뢰인 기기 날짜를 믿지 않는다 */
function kstToday() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
/* 길이가 달라도 시간 차이가 드러나지 않게 비교 */
function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
const validRate = r => Number.isFinite(r) && r > 0 && r < 50;

/* 우리은행 월별 고시표 한 달치 → [{date, price, yield, rate}] */
function parseWoori(html) {
  const re = /<td[^>]*>\s*(\d{4})\.(\d{2})\.(\d{2})\s*<\/td>\s*<td[^>]*>\s*([\d,]+)\s*<\/td>\s*<td[^>]*>\s*([\d.]+)\s*<\/td>\s*<td[^>]*>\s*([\d.]+)\s*<\/td>/g;
  const rows = []; let m;
  while ((m = re.exec(html))) {
    rows.push({ date: `${m[1]}-${m[2]}-${m[3]}`, price: Number(m[4].replace(/,/g, '')), yield: Number(m[5]), rate: Number(m[6]) });
  }
  return rows;
}
async function fetchMonth(ym) {               // ym = 'YYYYMM'
  const body = new URLSearchParams({ MODE: '1', BSDT_YM: ym, STD_YEAR: ym.slice(0, 4), STD_MONTH: ym.slice(4) });
  const r = await fetch(SRC_URL, {
    method: 'POST', body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; sanlaw.co.kr bond-rate)' }
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return parseWoori(await r.text());
}
/* 오늘 이전(오늘 포함) 가장 최근 고시값. 이달 표가 비어 있으면(월초) 지난달 표를 본다 */
async function latestRate(today, getMonth = fetchMonth) {
  const ym = today.slice(0, 4) + today.slice(5, 7);
  let rows = (await getMonth(ym)).filter(x => x.date <= today && validRate(x.rate));
  if (!rows.length) {
    const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(0);   // 지난달 말일
    rows = (await getMonth(d.toISOString().slice(0, 7).replace('-', ''))).filter(x => x.date <= today && validRate(x.rate));
  }
  if (!rows.length) return null;
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const last = rows[rows.length - 1];
  return { rate: Math.round(last.rate * 100000) / 100000, date: last.date, updatedAt: new Date().toISOString(), src: 'woori' };
}

export async function onRequestGet({ env }) {
  if (!env.BOND_KV) return json({ error: 'KV 미설정' }, 503);
  const today = kstToday();
  let v = await env.BOND_KV.get(KEY, 'json');
  if (v && v.date === today) return json(v);                  // 오늘 값(자동·사무소)이 있으면 그대로

  const last = Number(await env.BOND_KV.get(TRY_KEY)) || 0;
  if (Date.now() - last > RETRY_MS) {
    await env.BOND_KV.put(TRY_KEY, String(Date.now()), { expirationTtl: 3600 });
    try {
      const a = await latestRate(today);
      /* 더 새 날짜이면 저장. 같은 날짜에 사무소가 손으로 넣은 값이 있으면 사무소 값을 존중한다 */
      if (a && (!v || a.date > v.date || (a.date === v.date && v.src === 'woori' && a.rate !== v.rate))) {
        await env.BOND_KV.put(KEY, JSON.stringify(a));
        await env.BOND_KV.put('hist:' + a.date, JSON.stringify(a), { expirationTtl: HIST_TTL });
        v = a;
      }
    } catch (e) { /* 조회 실패 — 마지막 저장값을 그대로 쓴다 */ }
  }
  if (!v) return json({ error: '등록된 값 없음' }, 404);
  return json(v);
}

export async function onRequestPost({ request, env }) {
  if (!env.BOND_KV || !env.BOND_ADMIN_KEY) return json({ error: '서버 설정(KV·비밀번호)이 없습니다' }, 503);
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!safeEqual(token, env.BOND_ADMIN_KEY)) return json({ error: '비밀번호 불일치' }, 401);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: '형식 오류' }, 400); }
  const rate = Number(body && body.rate);
  if (!validRate(rate)) return json({ error: '할인율은 0 초과 50 미만이어야 합니다' }, 400);

  const rec = { rate: Math.round(rate * 100000) / 100000, date: kstToday(), updatedAt: new Date().toISOString(), src: 'office' };
  await env.BOND_KV.put(KEY, JSON.stringify(rec));
  await env.BOND_KV.put('hist:' + rec.date, JSON.stringify(rec), { expirationTtl: HIST_TTL });
  return json(rec);
}

export async function onRequest() {
  return json({ error: '허용되지 않는 방식' }, 405);
}
