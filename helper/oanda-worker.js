/*
  RealChart helper (Cloudflare Worker, free plan)
  ----------------------------------------------
  Keeps your secret keys on Cloudflare, so they never reach visitors' browsers:
    - OANDA: forex, gold, indices, commodities and bonds (candles and prices, one-off or streamed)
    - Twelve Data: US stocks and ETFs (quotes and candles)
    - cTrader (Open API): a broker's forex, indices, metals and commodities, through ONE shared connection
      (Spotware asks apps to keep at most one connection per environment), held by the CTHub Durable Object
  It only allows reading market data. It cannot place trades or read your balance.

  Setup: see README.md. In the Worker's Settings → Variables and Secrets add:
    OANDA_TOKEN     (type: Secret)  your OANDA personal access token
    TD_KEY          (type: Secret)  your Twelve Data API key
    ALLOWED_ORIGIN  (type: Text)    your site's address, e.g. https://realchart.trade (several allowed, separated by commas)
  Optional:
    OANDA_ENV       practice or live. Found automatically from the token if left out.
    OANDA_ACCOUNT   your account ID. The first account is used if left out.
  cTrader (optional; needs the CT_HUB Durable Object binding from wrangler.toml):
    CT_CLIENT_ID      (type: Secret)  your Open API app's Client ID
    CT_CLIENT_SECRET  (type: Secret)  your Open API app's Secret
    CT_REFRESH_TOKEN  (type: Secret)  the refresh token from the app's Playground (scope: Accounts, view only)
    CT_ACCESS_TOKEN   (type: Secret)  optional: the access token from the Playground
    CT_ACCOUNT        (type: Text)    optional: the account number to read prices from. The first account is used if left out.
  cTrader tokens last 30 days and change each time they're renewed, so the helper renews them itself and keeps the
  newest pair in the Durable Object's storage. Paste a new refresh token only if you revoke access.
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

// ---------- cTrader: the routes visitors call; the connection itself lives in CTHub below ----------
const CT_TF = { '1m': ['M1', 60], '5m': ['M5', 300], '15m': ['M15', 900], '30m': ['M30', 1800], '1h': ['H1', 3600], '4h': ['H4', 14400], '1d': ['D1', 86400], '1w': ['W1', 604800] };
// Countries that must not see the broker's prices (FP Markets' list: its restricted countries, the European Economic Area,
// and places on the FATF and EU/UN sanctions lists; T1 is Tor and XX unknown). CT_BLOCK replaces the list (two-letter codes,
// separated by commas); CT_BLOCK_UK=1 adds the United Kingdom.
const CT_BLOCK_DEFAULT = 'AF,CU,CA,IQ,IN,IR,LR,LY,MM,PS,RU,SO,SY,SD,YE,US,KP,BY,SS,' +
  'AT,BE,BG,HR,CY,CZ,DK,EE,FI,FR,DE,GR,HU,IE,IT,LV,LT,LU,MT,NL,PL,PT,RO,SK,SI,ES,SE,IS,LI,NO,T1,XX';
function ctCountry(request, env) {
  if (env.CT_TEST_HOST) return String(request.headers.get('X-Test-Country') || '').toUpperCase();   // the local tests only
  return String((request.cf && request.cf.country) || 'XX').toUpperCase();
}
function ctBlocked(request, env) {
  const cc = ctCountry(request, env); if (!cc) return '';
  const list = new Set(String(env.CT_BLOCK || CT_BLOCK_DEFAULT).toUpperCase().split(/[\s,]+/).filter(Boolean));
  if (String(env.CT_BLOCK_UK || '') === '1') list.add('GB');
  return list.has(cc) ? cc : '';
}
function ctReady(env) { return !!(env.CT_HUB && env.CT_CLIENT_ID && env.CT_CLIENT_SECRET && (env.CT_REFRESH_TOKEN || env.CT_ACCESS_TOKEN)); }
async function ctRoute(request, env, url, reply, json) {
  if (!ctReady(env)) return json({ ok: false, code: 'not_setup', message: "cTrader isn't set up on this helper." }, 404);
  const blocked = ctBlocked(request, env);   // checked before anything is cached or streamed
  if (blocked) return json({ ok: false, code: 'region', country: blocked, message: "The broker's prices aren't available in your country." }, 451);
  const hub = env.CT_HUB.get(env.CT_HUB.idFromName('hub'));
  const p = url.pathname, q = url.searchParams;
  if (p === '/ct/live') {   // live prices: one WebSocket per visitor, all fed from the hub's single cTrader connection
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return reply('Expected a WebSocket.', 426);
    return hub.fetch(new Request('https://hub/live', request));
  }
  let path, ttl;
  if (p === '/ct/status') { path = '/status'; ttl = 5000; }
  else if (p === '/ct/symbols') { path = '/symbols'; ttl = 600000; }
  else if (p === '/ct/bars') {
    const id = q.get('id') || '', tf = q.get('tf') || '', count = Number(q.get('count') || 500), to = q.get('to');
    if (!/^\d{1,12}$/.test(id) || !CT_TF[tf] || !Number.isInteger(count) || count < 1 || count > 1000 || (to != null && !/^\d{9,11}$/.test(to))) return json({ ok: false, code: 'bad_request', message: 'Bad request.' }, 400);
    path = `/bars?id=${id}&tf=${tf}&count=${count}${to ? `&to=${to}` : ''}`;
    ttl = to && Number(to) < Date.now() / 1000 - 2 * CT_TF[tf][1] ? 3600000 : 5000;   // older pages never change; the newest page does
  } else return json({ ok: false, code: 'not_found', message: 'Not found.' }, 404);
  try {
    const r = await remembered('ct:' + path, ttl, async () => {
      const res = await hub.fetch('https://hub' + path);
      return { status: res.status, body: await res.text() };
    });
    return reply(r.body, r.status, 'application/json');
  } catch (e) {
    return json({ ok: false, code: 'unavailable', message: "Couldn't reach the cTrader connection." }, 503);
  }
}

export default {
  async fetch(request, env) {
    // ALLOWED_ORIGIN can list several addresses, separated by commas (for example the site's own domain and www).
    const allowedList = String(env.ALLOWED_ORIGIN || '*').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
    const from = request.headers.get('Origin');
    const anyOrigin = allowedList.includes('*');
    const origin = anyOrigin ? '*' : (from && allowedList.includes(from) ? from : allowedList[0]);
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
    if (from && !anyOrigin && !allowedList.includes(from)) return reply('Not allowed from this website.', 403);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!allowed(ip)) return json({ status: 'error', code: 429, message: 'Too many requests. Please slow down.' }, 429);

    const url = new URL(request.url);
    if (url.pathname === '/') return reply('RealChart helper is running.', 200);
    if (url.pathname.startsWith('/ct/')) return ctRoute(request, env, url, reply, json);

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

// ---------- cTrader hub (Durable Object): one connection to cTrader, shared by every visitor ----------
// JSON over WebSocket (port 5036). Message numbers are from Spotware's OpenApiMessages.proto.
const PT = { HEARTBEAT: 51, ERROR: 50, APP_AUTH: 2100, APP_AUTH_RES: 2101, ACCT_AUTH: 2102, ACCT_AUTH_RES: 2103,
  SYMBOLS: 2114, SYMBOLS_RES: 2115, SYMBOL_BY_ID: 2116, SYMBOL_BY_ID_RES: 2117, SUB_SPOTS: 2127, SUB_SPOTS_RES: 2128,
  UNSUB_SPOTS: 2129, UNSUB_SPOTS_RES: 2130, SPOT: 2131, BARS: 2137, BARS_RES: 2138, OA_ERROR: 2142,
  TOKEN_INVALIDATED: 2147, CLIENT_DISCONNECT: 2148, ACCOUNTS: 2149, ACCOUNTS_RES: 2150, CATEGORIES: 2160, CATEGORIES_RES: 2161,
  ACCT_DISCONNECT: 2164, REFRESH: 2173, REFRESH_RES: 2174 };
const CT_HOST = { demo: 'https://demo.ctraderapi.com:5036', live: 'https://live.ctraderapi.com:5036' };
// The widest time span one trendbar request may cover. cTrader's limits aren't published, so these start
// cautious and shrink further if cTrader says a request is too wide.
const CT_SPAN = { M1: 302400000, M5: 302400000, M15: 21168000000, M30: 21168000000, H1: 21168000000, H4: 31622400000, D1: 31622400000, W1: 157852800000 };
const DAY = 86400000;
const num = v => (v == null ? undefined : Number(v));
class CtErr extends Error { constructor(code, message, status) { super(message); this.code = code; this.status = status || 503; } }
function ctMessage(code, desc) {
  if (code === 'CH_CLIENT_AUTH_FAILURE') return "cTrader didn't accept the app's Client ID or Secret, or the app isn't approved yet.";
  if (code === 'CH_ACCESS_TOKEN_INVALID' || code === 'ACCESS_DENIED' || code === 'INVALID_TOKEN') return "cTrader didn't accept the token. Get a new refresh token in the app's Playground.";
  if (code === 'CH_CTID_TRADER_ACCOUNT_NOT_FOUND') return "cTrader couldn't find that trading account. Check CT_ACCOUNT.";
  if (code === 'SERVER_IS_UNDER_MAINTENANCE') return 'cTrader is under maintenance. Prices come back when it ends.';
  return desc ? `cTrader: ${String(desc).slice(0, 200)}` : `cTrader answered ${code || 'with an error'}.`;
}
async function sha(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export class CTHub {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    this.ws = null; this.state = 'off'; this.error = ''; this.opening = null; this.failAt = 0; this.fails = 0;
    this.waits = new Map(); this.n = 0;
    this.acct = null; this.tok = null;
    this.list = null; this.listAt = 0; this.digits = {}; this.loadingList = null;
    this.subs = new Set(); this.last = new Map(); this.dirty = new Set(); this.flushT = null;
    this.histChain = Promise.resolve(); this.histAt = 0; this.span = Object.assign({}, CT_SPAN);
    this.bars = new Map(); this.usedAt = Date.now(); this.beat = null; this.again = null; this.checkAt = 0;
  }

  // ----- requests from the Worker -----
  async fetch(request) {
    const url = new URL(request.url);
    this.usedAt = Date.now(); this.keepAlarm();
    const out = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
    try {
      if (url.pathname === '/live') return this.accept();
      if (url.pathname === '/status') {
        try { await this.ensure(); } catch (e) { /* reported below */ }
        const a = this.acct;
        return out({ ok: this.state === 'ready', state: this.state, message: this.state === 'ready' ? '' : this.error,
          broker: a ? a.broker : '', live: a ? a.live : null, account: a ? a.login : null, symbols: this.list ? this.list.length : 0 }, this.state === 'ready' ? 200 : 503);
      }
      await this.ensure();
      if (url.pathname === '/symbols') return out({ ok: true, broker: this.acct.broker, live: this.acct.live, symbols: await this.symbols() });
      if (url.pathname === '/bars') {
        const q = url.searchParams;
        return out({ ok: true, bars: await this.history(Number(q.get('id')), q.get('tf'), Number(q.get('count')), q.get('to') ? Number(q.get('to')) : 0) });
      }
      return out({ ok: false, code: 'not_found', message: 'Not found.' }, 404);
    } catch (e) {
      return out({ ok: false, code: e.code || 'error', message: e.message || 'Something went wrong.' }, e.status || 503);
    }
  }

  // ----- the connection -----
  ensure() {
    if (this.state === 'ready' && this.ws) return Promise.resolve();
    if (this.opening) return this.opening;
    const wait = Math.min(300000, 2000 * 2 ** Math.min(this.fails, 8));   // after a failure, don't hammer cTrader
    if (this.failAt && Date.now() - this.failAt < wait) return Promise.reject(new CtErr('retry_later', this.error || 'cTrader is not connected yet.'));
    this.opening = this.open().then(() => { this.fails = 0; this.failAt = 0; this.error = ''; },
      e => { this.fails++; this.failAt = Date.now(); this.error = e.message; this.close('error'); throw e; })
      .finally(() => { this.opening = null; });
    return this.opening;
  }

  async open(hop) {
    const env = this.env;
    let host = env.CT_ENV === 'live' || env.CT_ENV === 'demo' ? env.CT_ENV : (await this.ctx.storage.get('host')) || 'demo';
    this.state = 'connecting';
    await this.connect(host);
    await this.call(PT.APP_AUTH, { clientId: env.CT_CLIENT_ID, clientSecret: env.CT_CLIENT_SECRET }, PT.APP_AUTH_RES);
    const tok = await this.tokens();
    if (!tok.access || tok.exp - Date.now() < 7 * DAY) await this.renew();
    let list;
    try { list = await this.call(PT.ACCOUNTS, { accessToken: this.tok.access }, PT.ACCOUNTS_RES); }
    catch (e) { if (e.code !== 'CH_ACCESS_TOKEN_INVALID' || !this.tok.refresh) throw e; await this.renew(); list = await this.call(PT.ACCOUNTS, { accessToken: this.tok.access }, PT.ACCOUNTS_RES); }
    const accts = (list.ctidTraderAccount || []).map(a => ({ id: num(a.ctidTraderAccountId), login: num(a.traderLogin), live: !!a.isLive, broker: a.brokerTitleShort || '' }));
    const want = String(env.CT_ACCOUNT || '').trim();
    const pick = want ? accts.find(a => String(a.login) === want || String(a.id) === want) : (accts.find(a => (a.live ? 'live' : 'demo') === host) || accts[0]);
    if (!pick) throw new CtErr('no_account', want ? `There's no account ${want} on this cTrader login.` : 'This cTrader login has no trading accounts.');
    const need = pick.live ? 'live' : 'demo';
    if (need !== host) {   // demo and live accounts each have their own server
      if (hop) throw new CtErr('wrong_server', 'cTrader sent the account to the other server twice.');
      await this.ctx.storage.put('host', need); this.close('switch'); return this.open(true);
    }
    await this.call(PT.ACCT_AUTH, { ctidTraderAccountId: pick.id, accessToken: this.tok.access }, PT.ACCT_AUTH_RES);
    this.acct = pick; this.state = 'ready'; this.subs = new Set();
    this.resub();
  }

  async connect(host) {
    const test = String(this.env.CT_TEST_HOST || '');
    const base = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(test) ? test : CT_HOST[host];   // a local stand-in, for tests only
    const r = await fetch(base, { headers: { Upgrade: 'websocket' } });
    const ws = r.webSocket;
    if (!ws) throw new CtErr('unreachable', "Couldn't connect to cTrader.");
    ws.accept();
    this.ws = ws;
    ws.addEventListener('message', ev => this.onMessage(ws, ev.data));
    ws.addEventListener('close', () => { if (this.ws === ws) this.dropped('closed'); });
    ws.addEventListener('error', () => { if (this.ws === ws) this.dropped('error'); });
    clearInterval(this.beat);
    this.beat = setInterval(() => this.tick(), 10000);   // cTrader expects a heartbeat every 10 seconds
  }

  tick() {
    if (!this.ws) return;
    try { this.ws.send(JSON.stringify({ payloadType: PT.HEARTBEAT, payload: {} })); } catch (e) { this.dropped('error'); return; }
    for (const c of this.ctx.getWebSockets()) { try { c.send('{"hb":1}'); } catch (e) { /* gone */ } }
    if (this.state === 'ready' && Date.now() - this.checkAt > 600000) {   // every 10 minutes: renew the token in good time
      this.checkAt = Date.now();
      if (this.tok && this.tok.refresh && this.tok.exp - Date.now() < 7 * DAY) this.renew().catch(e => { this.error = e.message; });
    }
    if (!this.ctx.getWebSockets().length && Date.now() - this.usedAt > 600000) this.close('idle');   // nobody watching: let go
  }

  dropped(why) {
    const watched = this.ctx.getWebSockets().length > 0;
    this.close(why);
    if (watched) { clearTimeout(this.again); this.again = setTimeout(() => { this.again = null; this.ensure().catch(() => {}); }, Math.min(60000, 2000 * 2 ** Math.min(this.fails, 5))); }
  }

  close(why) {
    clearInterval(this.beat); this.beat = null;
    const ws = this.ws; this.ws = null;
    if (ws) { try { ws.close(1000, why); } catch (e) { /* already closed */ } }
    if (this.state !== 'off') this.state = why === 'idle' ? 'idle' : 'off';
    this.subs = new Set();
    for (const [, w] of this.waits) { clearTimeout(w.t); w.rej(new CtErr('disconnected', 'The cTrader connection closed.')); }
    this.waits.clear();
  }

  call(type, payload, resType, ms) {
    if (!this.ws) return Promise.reject(new CtErr('disconnected', 'cTrader is not connected.'));
    const id = 'rc' + (++this.n);
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.waits.delete(id); rej(new CtErr('timeout', 'cTrader took too long to answer.')); }, ms || 20000);
      this.waits.set(id, { res, rej, t, resType });
      try { this.ws.send(JSON.stringify({ clientMsgId: id, payloadType: type, payload })); }
      catch (e) { clearTimeout(t); this.waits.delete(id); rej(new CtErr('disconnected', 'cTrader is not connected.')); }
    });
  }

  onMessage(ws, data) {
    if (ws !== this.ws) return;
    let m; try { m = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data)); } catch (e) { return; }
    const type = num(m.payloadType), p = m.payload || {};
    const w = m.clientMsgId && this.waits.get(m.clientMsgId);
    if (w) {
      this.waits.delete(m.clientMsgId); clearTimeout(w.t);
      if (type === PT.OA_ERROR || type === PT.ERROR) { const e = new CtErr(p.errorCode || 'error', ctMessage(p.errorCode, p.description)); e.retryAfter = num(p.retryAfter); w.rej(e); }
      else w.res(p);
      return;
    }
    if (type === PT.SPOT) this.onSpot(p);
    else if (type === PT.TOKEN_INVALIDATED || type === PT.ACCT_DISCONNECT) { this.error = p.reason || 'cTrader ended the session.'; this.dropped('session'); }
    else if (type === PT.CLIENT_DISCONNECT) { this.error = p.reason ? `cTrader: ${p.reason}` : 'cTrader closed the connection.'; this.fails = Math.max(this.fails, 3); this.failAt = Date.now(); this.dropped('kicked'); }
  }

  // ----- tokens: the newest pair is kept in storage, because renewing one makes the old pair stop working -----
  async tokens() {
    const env = this.env;
    const seed = await sha(`${env.CT_ACCESS_TOKEN || ''}|${env.CT_REFRESH_TOKEN || ''}`);
    let t = await this.ctx.storage.get('tok');
    if (!t || t.seed !== seed) {   // first run, or new tokens were pasted into the settings
      t = { access: env.CT_ACCESS_TOKEN || '', refresh: env.CT_REFRESH_TOKEN || '', exp: env.CT_ACCESS_TOKEN ? Date.now() + 20 * DAY : 0, seed };
      await this.ctx.storage.put('tok', t);
    }
    return (this.tok = t);
  }

  async renew() {
    const t = this.tok;
    if (!t || !t.refresh) { if (t && t.access) return t; throw new CtErr('no_token', 'No cTrader refresh token is set up.'); }
    let r;
    try { r = await this.call(PT.REFRESH, { refreshToken: t.refresh }, PT.REFRESH_RES); }
    catch (e) { if (e.code === 'disconnected' || e.code === 'timeout') throw e; throw new CtErr('token', "cTrader didn't accept the refresh token. Get a new one in the app's Playground and paste it into CT_REFRESH_TOKEN."); }
    if (!r.accessToken || !r.refreshToken) throw new CtErr('token', "cTrader didn't send a new token.");
    this.tok = { access: r.accessToken, refresh: r.refreshToken, exp: Date.now() + (num(r.expiresIn) || 2628000) * 1000, seed: t.seed };
    await this.ctx.storage.put('tok', this.tok);
    return this.tok;
  }

  // ----- symbols -----
  async symbols() {
    if (this.list && Date.now() - this.listAt < 6 * 3600000) return this.list;
    if (!this.loadingList) this.loadingList = this.loadSymbols().finally(() => { this.loadingList = null; });
    return this.loadingList;
  }

  async loadSymbols() {
    const acct = this.acct.id;
    const [ls, cs] = await Promise.all([
      this.call(PT.SYMBOLS, { ctidTraderAccountId: acct }, PT.SYMBOLS_RES, 30000),
      this.call(PT.CATEGORIES, { ctidTraderAccountId: acct }, PT.CATEGORIES_RES).catch(() => ({})),
    ]);
    const cat = {}; for (const c of cs.symbolCategory || []) cat[num(c.id)] = c.name;
    const light = (ls.symbol || []).filter(s => s.enabled !== false && s.symbolName);
    // Price digits are only in the full symbol details, which are large, so they're kept for a day.
    const saved = (await this.ctx.storage.get('digits')) || {};
    if (saved.acct === acct && Date.now() - saved.at < DAY) this.digits = saved.d;
    else {
      const d = {}, ids = light.map(s => num(s.symbolId));
      for (let i = 0; i < ids.length; i += 100) {
        const r = await this.call(PT.SYMBOL_BY_ID, { ctidTraderAccountId: acct, symbolId: ids.slice(i, i + 100) }, PT.SYMBOL_BY_ID_RES, 30000);
        for (const s of r.symbol || []) d[num(s.symbolId)] = num(s.digits);
      }
      this.digits = d;
      await this.ctx.storage.put('digits', { acct, at: Date.now(), d });
    }
    light.sort((a, b) => (num(a.sortingNumber) || 0) - (num(b.sortingNumber) || 0));
    this.list = light.map(s => ({ id: num(s.symbolId), name: s.symbolName, desc: s.description || '', cat: cat[num(s.symbolCategoryId)] || '', digits: this.digits[num(s.symbolId)] ?? 5 }));
    this.known = new Set(this.list.map(s => s.id));
    this.listAt = Date.now();
    return this.list;
  }

  // ----- candle history: at most 5 requests a second on the connection, shared by everyone -----
  hist(fn) {
    const run = this.histChain.then(async () => {
      const gap = 220 - (Date.now() - this.histAt);
      if (gap > 0) await new Promise(r => setTimeout(r, gap));
      this.histAt = Date.now();
      return fn();
    });
    this.histChain = run.catch(() => {});
    return run;
  }

  async history(id, tf, count, toSec) {
    const [period, sec] = CT_TF[tf];
    await this.symbols();
    if (!this.known.has(id)) throw new CtErr('unknown_symbol', "This broker doesn't offer that symbol.", 404);
    const key = `${id}|${tf}|${count}|${toSec}`, hit = this.bars.get(key);
    if (hit && (hit.wait || Date.now() - hit.at < (toSec ? 3600000 : 4000))) return hit.wait || hit.bars;
    const wait = this.loadBars(id, period, sec, count, toSec);
    this.bars.set(key, { wait });
    try {
      const bars = await wait;
      this.bars.set(key, { at: Date.now(), bars });
      if (this.bars.size > 400) for (const [k, v] of this.bars) { if (v.at && Date.now() - v.at > 600000) this.bars.delete(k); }
      return bars;
    } catch (e) { this.bars.delete(key); throw e; }
  }

  async loadBars(id, period, sec, count, toSec) {
    const digits = this.digits[id] ?? 5, f = 10 ** digits;
    const px = v => Math.round((Number(v) / 100000) * f) / f;
    const got = new Map();
    let to = toSec ? toSec * 1000 - 1 : Date.now(), shrink = 0;
    for (let chunk = 0; chunk < 6 && got.size < count && to > 946684800000; chunk++) {   // back to the year 2000 at most
      const span = Math.min((count - got.size) * sec * 1000 * (sec >= 604800 ? 1.1 : 1.6) + 3 * DAY, this.span[period]);
      const from = Math.max(0, to - span);
      let r;
      try {
        r = await this.hist(() => this.call(PT.BARS, { ctidTraderAccountId: this.acct.id, fromTimestamp: Math.round(from), toTimestamp: Math.round(to), period, symbolId: id, count: count - got.size }, PT.BARS_RES, 30000));
      } catch (e) {
        if (e.code === 'INVALID_REQUEST' && shrink < 4 && this.span[period] > DAY) { this.span[period] = Math.floor(span / 2); shrink++; chunk--; continue; }   // too wide: learn a smaller span
        if (e.code === 'BLOCKED_PAYLOAD_TYPE' && shrink < 4) { shrink++; await new Promise(r2 => setTimeout(r2, Math.min(5000, (e.retryAfter || 1) * 1000))); chunk--; continue; }
        if (got.size) break;
        throw e;
      }
      for (const b of r.trendbar || []) {
        const low = Number(b.low), t = num(b.utcTimestampInMinutes) * 60;
        if (!isFinite(low) || !isFinite(t)) continue;
        got.set(t, { time: t, open: px(low + Number(b.deltaOpen || 0)), high: px(low + Number(b.deltaHigh || 0)), low: px(low), close: px(low + Number(b.deltaClose || 0)), volume: Number(b.volume) || 0 });
      }
      to = from - 1;
    }
    return [...got.values()].sort((a, b) => a.time - b.time).slice(-count);
  }

  // ----- live prices -----
  accept() {
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ ids: [] });
    this.ensure().catch(() => {});
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, msg) {
    let m; try { m = JSON.parse(typeof msg === 'string' ? msg : new TextDecoder().decode(msg)); } catch (e) { return; }
    if (!m || !Array.isArray(m.ids)) return;
    const ids = [...new Set(m.ids.map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 40);
    ws.serializeAttachment({ ids });
    this.usedAt = Date.now();
    try { await this.ensure(); await this.symbols(); } catch (e) { try { ws.send(JSON.stringify({ err: e.message })); } catch (e2) { /* gone */ } return; }
    const snap = ids.filter(id => { const l = this.last.get(id); return l && l.bid != null && l.ask != null; }).map(id => this.row(id));
    if (snap.length) { try { ws.send(JSON.stringify({ q: snap })); } catch (e) { /* gone */ } }
    this.resub();
  }

  webSocketClose(ws) { try { ws.close(1000, 'bye'); } catch (e) { /* closed */ } this.usedAt = Date.now(); setTimeout(() => this.resub(), 1000); }
  webSocketError() { this.usedAt = Date.now(); setTimeout(() => this.resub(), 1000); }

  wanted() {
    const all = new Set();
    for (const c of this.ctx.getWebSockets()) { const a = c.deserializeAttachment(); for (const id of (a && a.ids) || []) all.add(id); }
    return all;
  }

  resub() {
    if (this.state !== 'ready' || !this.known) return;
    const want = this.wanted();
    const add = [...want].filter(id => !this.subs.has(id) && this.known.has(id));
    const drop = [...this.subs].filter(id => !want.has(id));
    const acct = this.acct.id;
    if (add.length) {
      add.forEach(id => this.subs.add(id));
      this.call(PT.SUB_SPOTS, { ctidTraderAccountId: acct, symbolId: add, subscribeToSpotTimestamp: true }, PT.SUB_SPOTS_RES)
        .catch(e => { if (e.code !== 'ALREADY_SUBSCRIBED') add.forEach(id => this.subs.delete(id)); });
    }
    if (drop.length) {
      drop.forEach(id => { this.subs.delete(id); this.last.delete(id); });
      this.call(PT.UNSUB_SPOTS, { ctidTraderAccountId: acct, symbolId: drop }, PT.UNSUB_SPOTS_RES).catch(() => {});
    }
  }

  onSpot(p) {
    const id = num(p.symbolId), o = this.last.get(id) || {};
    const bid = p.bid != null ? Number(p.bid) : o.bid, ask = p.ask != null ? Number(p.ask) : o.ask;   // an update may carry only one side
    this.last.set(id, { bid, ask, t: num(p.timestamp) || Date.now() });
    this.dirty.add(id);
    if (!this.flushT) this.flushT = setTimeout(() => this.flush(), 250);   // several ticks a second become one message
  }

  row(id) {
    const s = this.last.get(id), f = 10 ** (this.digits[id] ?? 5);
    const px = v => (v == null || !isFinite(v) ? null : Math.round((v / 100000) * f) / f);
    return [id, px(s.bid), px(s.ask), s.t];
  }

  flush() {
    this.flushT = null;
    const dirty = this.dirty; this.dirty = new Set();
    if (!dirty.size) return;
    const rows = new Map(); for (const id of dirty) { const l = this.last.get(id); if (l && l.bid != null && l.ask != null) rows.set(id, this.row(id)); }   // a quote goes out once both sides are known
    for (const c of this.ctx.getWebSockets()) {
      const a = c.deserializeAttachment(), mine = ((a && a.ids) || []).filter(id => rows.has(id)).map(id => rows.get(id));
      if (mine.length) { try { c.send(JSON.stringify({ q: mine })); } catch (e) { /* gone */ } }
    }
  }

  // ----- housekeeping: renew the token even when nobody visits, and keep the alarm going -----
  keepAlarm() { this.ctx.storage.getAlarm().then(a => { if (!a) this.ctx.storage.setAlarm(Date.now() + 12 * 3600000); }).catch(() => {}); }

  async alarm() {
    try {
      const t = (await this.ctx.storage.get('tok')) || null;
      if (ctReady(this.env) && (!t || !t.access || t.exp - Date.now() < 7 * DAY)) {
        const idle = this.state !== 'ready';
        await this.ensure();   // renews while connecting
        if (this.tok && this.tok.exp - Date.now() < 7 * DAY) await this.renew();
        if (idle && !this.ctx.getWebSockets().length) this.close('idle');
      }
    } catch (e) { this.error = e.message; }
    await this.ctx.storage.setAlarm(Date.now() + 12 * 3600000);
  }
}
