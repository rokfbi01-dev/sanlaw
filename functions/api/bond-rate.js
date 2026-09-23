/* 국민주택채권 즉시매도 할인율 — 사무소 확인값 공유 (Cloudflare Pages Functions)
   경로: /api/bond-rate
   GET  → {rate, date, updatedAt}  (누구나 조회 — 계산기가 자동으로 읽음)
   POST → 사무소만 저장 (Authorization: Bearer <BOND_ADMIN_KEY>)  본문 {rate}
   ※ 외부 기관·은행 사이트에 접속하지 않는다. 사무소가 직접 확인해 넣은 값만 저장한다.
   필요한 설정(Cloudflare Pages 프로젝트):
     · KV 바인딩  BOND_KV
     · 비밀 변수  BOND_ADMIN_KEY */
const KEY = 'bond-rate';
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

export async function onRequestGet({ env }) {
  if (!env.BOND_KV) return json({ error: 'KV 미설정' }, 503);
  const v = await env.BOND_KV.get(KEY, 'json');
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
  if (!Number.isFinite(rate) || rate <= 0 || rate >= 50) return json({ error: '할인율은 0 초과 50 미만이어야 합니다' }, 400);

  const rec = { rate: Math.round(rate * 100000) / 100000, date: kstToday(), updatedAt: new Date().toISOString() };
  await env.BOND_KV.put(KEY, JSON.stringify(rec));
  await env.BOND_KV.put('hist:' + rec.date, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 400 }); // 날짜별 기록 약 13개월 보관
  return json(rec);
}

export async function onRequest() {
  return json({ error: '허용되지 않는 방식' }, 405);
}
