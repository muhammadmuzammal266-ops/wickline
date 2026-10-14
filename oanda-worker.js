/*
  Wickline helper (Cloudflare Worker, free plan)
  ----------------------------------------------
  Keeps your secret keys on Cloudflare, so they never reach visitors' browsers:
    - OANDA: forex, gold, indices, commodities and bonds (candles and prices, one-off or streamed)
    - Twelve Data: US stocks and ETFs (quotes and candles)
  It only allows reading market data. It cannot place trades or read your balance.

  Setup: see README.md. In the Worker's Settings → Variables and Secrets add:
    OANDA_TOKEN     (type: Secret)  your OANDA personal access token
    TD_KEY          (type: Secret)  your Twelve Data API key
    ALLOWED_ORIGIN  (type: Text)    your site's address, e.g. https://yourname.github.io
  Optional:
    OANDA_ENV       practice or live. Found automatically from the token if left out.
    OANDA_ACCOUNT   your account ID. The first account is used if left out.
*/

// ---------- limits ----------
// Per visitor (by IP address), per Worker instance: generous for people, a wall for scripts that hammer it.
const PER_MINUTE = 240;
const hits = new Map();   // ip -> { n, reset }
function allowed(ip) {
  const now = Date.now();
  let h = hits.get(ip);
  if (!h || now > h.reset) { h = { n: 0, reset: now + 60000 }; hits.set(ip, h); }
  h.n++;
  if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  return h.n <= PER_MINUTE;
}

// ---------- short shared memory, so many visitors asking the same thing cost one upstream request ----------
const memo = new Map();   // url -> { at, ttl, status, body } or { wait: Promise }
async function remembered(url, ttl, load) {
  const now = Date.now(), m = memo.get(url);
  if (m && m.body != null && now - m.at < m.ttl) return m;
  if (m && m.wait) return m.wait;
  const wait = load().then(r => {
    const failed = r.status !== 200 || /"status"\s*:\s*"error"/.test(r.body.slice(0, 200));
    const entry = { at: Date.now(), ttl: failed ? Math.min(ttl, 10000) : ttl, status: r.status, body: r.body };   // errors are kept briefly, so a busy minute isn't retried by everyone at once
    memo.set(url, entry);
    if (memo.size > 800) for (const [k, v] of memo) if (v.body != null && Date.now() - v.at > 120000) memo.delete(k);
    return entry;
  }, e => { memo.delete(url); throw e; });
  memo.set(url, { wait });
  return wait;
}

// ---------- OANDA ----------
let found = null;   // { env, account }, worked out once per Worker instance
const rest = e => (e === 'live' ? 'https://api-fxtrade.oanda.com' : 'https://api-fxpractice.oanda.com');
const stream = e => (e === 'live' ? 'https://stream-fxtrade.oanda.com' : 'https://stream-fxpractice.oanda.com');
async function locate(env) {
  if (found) return found;
  const envs = env.OANDA_ENV === 'live' || env.OANDA_ENV === 'practice' ? [env.OANDA_ENV] : ['live', 'practice'];
  for (const e of envs) {
    const r = await fetch(`${rest(e)}/v3/accounts`, { headers: { Authorization: `Bearer ${env.OANDA_TOKEN}` } });
    if (r.status === 401 || r.status === 403) continue;   // the token belongs to the other environment
    if (!r.ok) throw new Error(`OANDA answered ${r.status}`);
    const j = await r.json();
    const account = env.OANDA_ACCOUNT || (j.accounts && j.accounts[0] && j.accounts[0].id);
    if (!account) throw new Error('This token has no OANDA account attached.');
    return (found = { env: e, account });
  }
  throw Object.assign(new Error('OANDA rejected the token. Check OANDA_TOKEN.'), { status: 401 });
}

// ---------- Twelve Data ----------
const TD_INTERVALS = new Set(['1min', '5min', '15min', '30min', '1h', '4h', '1day', '1week']);
const TD_SYMBOLS = /^[A-Z0-9.\/:-]{1,20}(,[A-Z0-9.\/:-]{1,20}){0,7}$/;   // up to 8 tickers
const TD_DATE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept-Datetime-Format',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    };
    const reply = (body, status, type) => new Response(body, { status, headers: Object.assign({ 'Content-Type': type || 'text/plain; charset=utf-8' }, cors) });
    const json = (obj, status) => reply(JSON.stringify(obj), status, 'application/json');
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return reply('Only GET is allowed.', 405);

    // Browsers on other websites are turned away (scripts can't be stopped this way, which is what the limits are for).
    const from = request.headers.get('Origin');
    if (from && origin !== '*' && from !== origin) return reply('Not allowed from this website.', 403);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!allowed(ip)) return json({ status: 'error', code: 429, message: 'Too many requests. Please slow down.' }, 429);

    const url = new URL(request.url);
    if (url.pathname === '/') return reply('Wickline helper is running.', 200);

    // ----- Twelve Data: /td/quote and /td/time_series -----
    if (url.pathname === '/td/quote' || url.pathname === '/td/time_series') {
      if (!env.TD_KEY) return json({ status: 'error', code: 401, message: "The site's Twelve Data key isn't set up." }, 200);
      const q = url.searchParams, out = new URLSearchParams();
      const symbol = (q.get('symbol') || '').toUpperCase();
      if (!TD_SYMBOLS.test(symbol)) return json({ status: 'error', code: 400, message: 'Bad symbol.' }, 400);
      out.set('symbol', symbol);
      let ttl = 15000;
      if (url.pathname === '/td/time_series') {
        const interval = q.get('interval') || '', size = Number(q.get('outputsize') || 30);
        if (!TD_INTERVALS.has(interval) || !Number.isInteger(size) || size < 1 || size > 5000) return json({ status: 'error', code: 400, message: 'Bad request.' }, 400);
        out.set('interval', interval); out.set('outputsize', String(size));
        for (const k of ['timezone', 'order', 'end_date']) {
          const v = q.get(k); if (v == null) continue;
          if ((k === 'timezone' && v !== 'UTC') || (k === 'order' && v !== 'asc' && v !== 'desc') || (k === 'end_date' && !TD_DATE.test(v))) return json({ status: 'error', code: 400, message: 'Bad request.' }, 400);
          out.set(k, v);
        }
        ttl = size <= 5 ? 15000 : 60000;   // the live candle refreshes often; long histories can be shared for a minute
      }
      const key = `${url.pathname}?${out}`;
      out.set('apikey', env.TD_KEY);
      try {
        const r = await remembered(key, ttl, async () => {
          const up = await fetch(`https://api.twelvedata.com${url.pathname.slice(3)}?${out}`);
          return { status: up.status, body: await up.text() };
        });
        return reply(r.body, r.status, 'application/json');
      } catch (e) {
        return json({ status: 'error', code: 502, message: "Couldn't reach Twelve Data." }, 502);
      }
    }

    // ----- OANDA: candles and prices -----
    if (!env.OANDA_TOKEN) return reply('OANDA_TOKEN is not set in the Worker settings.', 500);
    const isCandles = /^\/v3\/instruments\/[A-Z0-9]{2,10}_[A-Z0-9]{2,10}\/candles$/.test(url.pathname);
    const isPricing = url.pathname === '/v3/accounts/_/pricing';
    const isStream = url.pathname === '/v3/accounts/_/pricing/stream';
    if (!isCandles && !isPricing && !isStream) return reply('Not allowed.', 403);

    // Pass on only the read-only options the page uses.
    const allowedParams = isCandles
      ? ['price', 'granularity', 'count', 'from', 'to', 'alignmentTimezone', 'dailyAlignment', 'weeklyAlignment']
      : ['instruments'];
    const query = new URLSearchParams();
    for (const k of allowedParams) if (url.searchParams.has(k)) query.set(k, url.searchParams.get(k).slice(0, 64));
    if (!isCandles && !/^[A-Z0-9_,]{3,300}$/.test(query.get('instruments') || '')) return reply('Bad instruments.', 400);

    let where;
    try { where = await locate(env); } catch (e) { return reply(e.message, e.status || 502); }
    const base = isStream ? stream(where.env) : rest(where.env);
    const path = isCandles ? url.pathname : `/v3/accounts/${where.account}/pricing${isStream ? '/stream' : ''}`;
    const upstream = await fetch(`${base}${path}?${String(query).replace(/%2C/g, ',')}`, {
      headers: {
        Authorization: `Bearer ${env.OANDA_TOKEN}`,
        'Accept-Datetime-Format': request.headers.get('Accept-Datetime-Format') === 'UNIX' ? 'UNIX' : 'RFC3339',
      },
    });
    if (upstream.status === 401) found = null;   // look again next time, in case the token was changed
    // A stream stays open and passes each price straight through; it costs one request per visitor, not one per price.
    const response = new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': isStream ? 'application/octet-stream' : 'application/json' } });
    for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
    return response;
  },
};
