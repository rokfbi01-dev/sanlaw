/* 국민주택채권 즉시매도 할인율 — 자동 반영 + 사무소 확인값 (Cloudflare Pages Functions)
   경로: /api/bond-rate
   GET  → {rate, date, today, basis, src, updatedAt, checkedAt}   (누구나 조회 — 계산기가 자동으로 읽음)
          · date  = 이 할인율이 적용되는 날(우리은행 고시표의 날짜)
          · basis = 'next'(다음 영업일 값) / 'today'(오늘 값) / 'stale'(새 값을 아직 못 받음 — 가장 최근 값)
          ?log=1 → 최근 조회 기록(조회 시각·받은 날짜) — 게시 시각 점검용
   POST → 사무소만 저장 (Authorization: Bearer <BOND_ADMIN_KEY>)  본문 {rate, date?}
          자동값이 은행 고시율과 다를 때 손으로 바로잡는 용도. date를 주지 않으면 지금 화면에 보이는 적용일.
   필요한 설정(Cloudflare Pages 프로젝트 — 종전과 같음): KV 바인딩 BOND_KV · 비밀 변수 BOND_ADMIN_KEY

   2026-11-19 자동 반영 추가(법무사님 지시).
   2026-11-22 개정(법무사님 지시) — 조회 시각을 정하고, 우리은행 고시표의 날짜를 그대로 쓴다.
   ▸ 고시표에는 영업일만 올라온다. 그래서 공휴일 목록이나 요일 규칙 없이 표의 날짜로 판단한다.
   ▸ 보여 주는 값(법무사님 결정): 표에 다음 영업일 값이 올라와 있으면 그 값, 아직 없으면 오늘 값.
     다음 영업일 값은 업무마감 뒤에 게시되므로(우리은행 화면 안내문 「업무마감 후 소액채권전담증권사는 다음 영업일 적용될
     채권가격을 한국거래소에 신고」), 평일에는 18:30 조회 뒤부터, 주말·공휴일에는 내내 다음 영업일 값이 나온다.
     당일 업무가 끝난 뒤에는 그날 할인율로 채권을 살 일이 없기 때문이다.
   ▸ 조회 시각(한국 시각) — 그 시각이 지난 뒤 처음 계산기를 여는 때에 한 번만 조회한다.
       18:30  다음 영업일 값을 아직 받지 못했으면 조회
       00:30  그날 값도 다음 영업일 값도 없으면 조회(18:30에 못 받은 경우 보충)
       08:00  영업일(고시표에 그날 줄이 있는 날) 업무 시작 전 한 번 점검 — 은행이 값을 고쳤으면 반영.
              그날 값도 다음 영업일 값도 없을 때도 조회(보충). 주말·공휴일(그날 줄 없이 다음 영업일 값만 있음)은 건너뜀
     다음 영업일 값을 받아 게시한 뒤에는 08:00 점검 말고는 조회하지 않는다(법무사님 지시) — 주말·연휴에는 조회가 없다.
     실패하면 30분 뒤에 다시 시도한다. 그 밖의 시각에는 우리은행에 접속하지 않는다.
   ▸ 우리은행 공개 조회 화면(로그인·인증 없음)에 사람이 「조회」를 누를 때와 같은 요청을 보낸다.
     인증·보안 우회, 비공개 API, 세션 정보 사용 없음. 할인율은 과세구분 「개인」 기준(우리은행 화면 안내문). */
const STATE = 'bond-state';                  // {rows:[{date,rate}], office:{date:rate}, slotDone, lastTry, checkedAt, log:[]}
const OLD_KEY = 'bond-rate';                 // 2026-11-19판 저장값(처음 한 번 옮겨 담는다)
const RETRY_MS = 30 * 60 * 1000;
const KEEP_DAYS = 45;                        // 표 줄 보관 기간
const LOG_MAX = 80;
const HIST_TTL = 60 * 60 * 24 * 400;
const SRC_URL = 'https://svc.wooribank.com/svc/Dream?withyou=HBNHB0036&cc=c004893:c004893';
const SLOTS = ['00:30', '08:00', '18:30'];
const HDR = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: HDR });
const validRate = r => Number.isFinite(r) && r > 0 && r < 50;
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

/* 한국 시각 — 서버 시계 기준(의뢰인 기기 시계를 믿지 않는다) */
function kst(ms) {
  const iso = new Date(ms + 9 * 3600 * 1000).toISOString();
  return { date: iso.slice(0, 10), hm: iso.slice(11, 16), stamp: iso.slice(0, 16) };
}
function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/* 지금까지 지나간 가장 최근 조회 시각 → {stamp:'YYYY-MM-DDTHH:MM', date, hm} */
function lastSlot(now) {
  const k = kst(now);
  const cands = [];
  for (const d of [addDays(k.date, -1), k.date]) for (const hm of SLOTS) cands.push({ stamp: d + 'T' + hm, date: d, hm });
  return cands.filter(c => c.stamp <= k.stamp).pop();
}
function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/* 우리은행 월별 고시표 → [{date, rate}] */
export function parseWoori(html) {
  const re = /<td[^>]*>\s*(\d{4})\.(\d{2})\.(\d{2})\s*<\/td>\s*<td[^>]*>\s*([\d,]+)\s*<\/td>\s*<td[^>]*>\s*([\d.]+)\s*<\/td>\s*<td[^>]*>\s*([\d.]+)\s*<\/td>/g;
  const rows = []; let m;
  while ((m = re.exec(html))) {
    const rate = Number(m[6]);
    if (validRate(rate)) rows.push({ date: `${m[1]}-${m[2]}-${m[3]}`, rate: Math.round(rate * 100000) / 100000 });
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
const ymOf = date => date.slice(0, 4) + date.slice(5, 7);

/* 표에서 보여 줄 값 고르기 — 다음 영업일 줄 → 없으면 오늘 줄 → 그것도 없으면 가장 최근 줄 */
export function pick(state, today) {
  const rows = (state.rows || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  let r = rows.find(x => x.date > today), basis = 'next';
  if (!r) { r = rows.find(x => x.date === today); basis = 'today'; }
  if (!r) { r = rows.filter(x => x.date < today).pop(); basis = 'stale'; }
  if (!r) return null;
  const off = state.office && state.office[r.date];
  return {
    rate: validRate(off) ? off : r.rate, date: r.date, today, basis,
    src: validRate(off) ? 'office' : 'woori',
    updatedAt: r.at || state.checkedAt || '', checkedAt: state.checkedAt || ''
  };
}
/* 이 조회 시각에 우리은행을 조회할지 — 고시표 날짜만으로 판단(공휴일 목록 불필요) */
export function shouldFetch(state, slot) {
  const rows = state.rows || [];
  if (!rows.length) return true;                                   // 처음
  const hasDay = rows.some(x => x.date === slot.date);
  const hasNext = rows.some(x => x.date > slot.date);
  if (slot.hm === '18:30') return !hasNext;                        // 다음 영업일 값 받기
  if (slot.hm === '08:00') return hasDay || !hasNext;              // 영업일 아침 점검(주말·공휴일은 건너뜀)
  return !hasDay && !hasNext;                                      // 00:30 — 받을 값이 아직 없을 때만 보충
}
async function loadState(kv) {
  let st = await kv.get(STATE, 'json');
  if (st) return st;
  st = { rows: [], office: {}, slotDone: '', lastTry: 0, checkedAt: '', log: [] };
  const old = await kv.get(OLD_KEY, 'json');                      // 2026-11-19판 값 옮겨 담기
  if (old && validDate(old.date) && validRate(Number(old.rate))) {
    st.rows.push({ date: old.date, rate: Number(old.rate), at: old.updatedAt || '' });
    if (old.src === 'office' || !old.src) st.office[old.date] = Number(old.rate);
  }
  return st;
}
function merge(st, got, nowIso, today) {
  const map = new Map((st.rows || []).map(x => [x.date, x]));
  const fresh = [];
  for (const g of got) {
    const o = map.get(g.date);
    if (!o || o.rate !== g.rate) { map.set(g.date, { date: g.date, rate: g.rate, at: nowIso }); fresh.push(g); }
  }
  const from = addDays(today, -KEEP_DAYS);
  st.rows = [...map.values()].filter(x => x.date >= from).sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const d of Object.keys(st.office || {})) if (d < from) delete st.office[d];
  return fresh;
}
async function fetchAround(date, getMonth) {
  const ym = ymOf(date);
  let got = await getMonth(ym);
  if (!got.some(x => x.date > date) && Number(date.slice(8)) >= 20) {        // 월말 — 다음 달 첫 영업일
    const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
    got = got.concat(await getMonth(ymOf(d.toISOString().slice(0, 10))));
  }
  if (!got.some(x => x.date <= date)) {                                        // 월초 — 지난달 마지막 값
    const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(0);
    got = got.concat(await getMonth(ymOf(d.toISOString().slice(0, 10))));
  }
  return got;
}

export async function handleGet(env, now, getMonth = fetchMonth, wantLog = false) {
  if (!env.BOND_KV) return json({ error: 'KV 미설정' }, 503);
  const kv = env.BOND_KV;
  const st = await loadState(kv);
  const k = kst(now), slot = lastSlot(now);
  let dirty = false;
  if (slot && st.slotDone < slot.stamp) {
    if (!shouldFetch(st, slot)) { st.slotDone = slot.stamp; dirty = true; }       // 이번 시각은 건너뜀(주말·공휴일 등)
    else if (now - (st.lastTry || 0) > RETRY_MS) {
      st.lastTry = now;
      const nowIso = new Date(now).toISOString();
      try {
        const got = await fetchAround(slot.date, getMonth);
        if (!got.length) throw new Error('고시표를 읽지 못함');                       // 화면 모양이 바뀐 경우 등 — 실패로 보고 30분 뒤 다시
        const fresh = merge(st, got, nowIso, k.date);
        st.checkedAt = nowIso; st.slotDone = slot.stamp;
        st.log = (st.log || []).concat([{ at: nowIso, slot: slot.stamp, ok: true, fresh: fresh.map(x => x.date) }]).slice(-LOG_MAX);
        for (const f of fresh) await kv.put('hist:' + f.date, JSON.stringify({ rate: f.rate, date: f.date, at: nowIso, src: 'woori' }), { expirationTtl: HIST_TTL });
      } catch (e) {
        st.log = (st.log || []).concat([{ at: nowIso, slot: slot.stamp, ok: false }]).slice(-LOG_MAX);   // 실패 — 30분 뒤 다시
      }
      dirty = true;
    }
  }
  if (dirty) await kv.put(STATE, JSON.stringify(st));
  if (wantLog) return json({ slotDone: st.slotDone, checkedAt: st.checkedAt, rows: st.rows, log: st.log });
  const v = pick(st, k.date);
  if (!v) return json({ error: '등록된 값 없음' }, 404);
  return json(v);
}

export async function onRequestGet({ request, env }) {
  let wantLog = false;
  try { wantLog = new URL(request.url).searchParams.get('log') === '1'; } catch (e) {}
  return handleGet(env, Date.now(), fetchMonth, wantLog);
}

export async function handlePost(request, env, now) {
  if (!env.BOND_KV || !env.BOND_ADMIN_KEY) return json({ error: '서버 설정(KV·비밀번호)이 없습니다' }, 503);
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!safeEqual(token, env.BOND_ADMIN_KEY)) return json({ error: '비밀번호 불일치' }, 401);
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: '형식 오류' }, 400); }
  const rate = Number(body && body.rate);
  if (!validRate(rate)) return json({ error: '할인율은 0 초과 50 미만이어야 합니다' }, 400);
  const kv = env.BOND_KV, st = await loadState(kv), today = kst(now).date;
  const shown = pick(st, today);
  const date = validDate(body.date) ? body.date : (shown ? shown.date : today);
  if (date < addDays(today, -7) || date > addDays(today, 10)) return json({ error: '적용일은 오늘 앞뒤 열흘 안이어야 합니다' }, 400);
  st.office = st.office || {};
  st.office[date] = Math.round(rate * 100000) / 100000;
  if (!st.rows.some(x => x.date === date)) st.rows.push({ date, rate: st.office[date], at: new Date(now).toISOString() });
  await kv.put(STATE, JSON.stringify(st));
  await kv.put('hist:' + date, JSON.stringify({ rate: st.office[date], date, at: new Date(now).toISOString(), src: 'office' }), { expirationTtl: HIST_TTL });
  return json(pick(st, today));
}
export async function onRequestPost({ request, env }) { return handlePost(request, env, Date.now()); }

export async function onRequest() {
  return json({ error: '허용되지 않는 방식' }, 405);
}
