/*
  OANDA proxy for Wickline (Cloudflare Worker, free plan)
  -------------------------------------------------------
  Lets every visitor of your site see OANDA forex and gold prices without your OANDA token ever
  reaching their browser. It only allows two read-only requests: candles and current prices.
  It cannot place trades or read your balance.

  Setup: see "OANDA for everyone" in README.md. In the Worker's Settings → Variables and Secrets add:
    OANDA_TOKEN     (type: Secret)  your OANDA personal access token
    OANDA_ACCOUNT   (type: Text)    your account ID, e.g. 101-004-1234567-001
    OANDA_ENV       (type: Text)    practice  or  live
    ALLOWED_ORIGIN  (type: Text)    your site's address, e.g. https://yourname.github.io
*/
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept-Datetime-Format',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return new Response('Only GET is allowed.', { status: 405, headers: cors });

    const url = new URL(request.url);
    const isCandles = /^\/v3\/instruments\/[A-Z0-9]{2,10}_[A-Z0-9]{2,10}\/candles$/.test(url.pathname);
    const isPricing = url.pathname === '/v3/accounts/_/pricing';
    if (!isCandles && !isPricing) return new Response('Not allowed.', { status: 403, headers: cors });

    // Pass on only the read-only options the page uses.
    const allowed = isCandles
      ? ['price', 'granularity', 'count', 'from', 'to', 'alignmentTimezone', 'dailyAlignment', 'weeklyAlignment']
      : ['instruments'];
    const query = new URLSearchParams();
    for (const k of allowed) if (url.searchParams.has(k)) query.set(k, url.searchParams.get(k));

    const base = env.OANDA_ENV === 'live' ? 'https://api-fxtrade.oanda.com' : 'https://api-fxpractice.oanda.com';
    const path = isPricing ? `/v3/accounts/${env.OANDA_ACCOUNT}/pricing` : url.pathname;
    const upstream = await fetch(`${base}${path}?${query}`, {
      headers: {
        Authorization: `Bearer ${env.OANDA_TOKEN}`,
        'Accept-Datetime-Format': request.headers.get('Accept-Datetime-Format') === 'UNIX' ? 'UNIX' : 'RFC3339',
      },
    });
    const response = new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
    for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  },
};
