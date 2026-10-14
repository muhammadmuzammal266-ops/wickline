/*
  OANDA proxy for Wickline (Cloudflare Worker, free plan)
  -------------------------------------------------------
  Lets every visitor of your site see OANDA forex and gold prices without your OANDA token ever
  reaching their browser. It only allows read-only requests: candles and current prices
  (one-off or streamed). It cannot place trades or read your balance.

  Setup: see "OANDA for everyone" in README.md. In the Worker's Settings → Variables and Secrets add:
    OANDA_TOKEN     (type: Secret)  your OANDA personal access token. This is the only one you need.
  Optional:
    OANDA_ENV       practice or live. Found automatically from the token if left out.
    OANDA_ACCOUNT   your account ID, e.g. 101-004-1234567-001. The first account is used if left out.
    ALLOWED_ORIGIN  your site's address, e.g. https://yourname.github.io, to let only your site use it.
*/
let found = null;   // { env, account }, worked out once per Worker instance

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
const rest = e => (e === 'live' ? 'https://api-fxtrade.oanda.com' : 'https://api-fxpractice.oanda.com');
const stream = e => (e === 'live' ? 'https://stream-fxtrade.oanda.com' : 'https://stream-fxpractice.oanda.com');

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept-Datetime-Format',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    const reply = (body, status) => new Response(body, { status, headers: Object.assign({ 'Content-Type': 'text/plain' }, cors) });
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return reply('Only GET is allowed.', 405);
    if (!env.OANDA_TOKEN) return reply('OANDA_TOKEN is not set in the Worker settings.', 500);

    const url = new URL(request.url);
    if (url.pathname === '/') return reply('Wickline OANDA proxy is running.', 200);
    const isCandles = /^\/v3\/instruments\/[A-Z0-9]{2,10}_[A-Z0-9]{2,10}\/candles$/.test(url.pathname);
    const isPricing = url.pathname === '/v3/accounts/_/pricing';
    const isStream = url.pathname === '/v3/accounts/_/pricing/stream';
    if (!isCandles && !isPricing && !isStream) return reply('Not allowed.', 403);

    // Pass on only the read-only options the page uses.
    const allowed = isCandles
      ? ['price', 'granularity', 'count', 'from', 'to', 'alignmentTimezone', 'dailyAlignment', 'weeklyAlignment']
      : ['instruments'];
    const query = new URLSearchParams();
    for (const k of allowed) if (url.searchParams.has(k)) query.set(k, url.searchParams.get(k));
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
    response.headers.set('Cache-Control', 'no-store');
    return response;
  },
};
