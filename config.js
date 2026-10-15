/*
  Wickline settings
  -----------------
  Change the values below, then save (on GitHub: "Commit changes").
  Your live site updates about a minute later.
  Keep the quote marks and commas exactly as they are.

  Never put a secret here (an OANDA token, a Twelve Data key, a password). Everyone can read this file.
  Secret keys belong in your Cloudflare helper's settings instead (see the README).
*/
window.WICKLINE_CONFIG = {

  // The name shown in the top-left corner and in the browser tab.
  siteName: 'Wickline',

  // Your Cloudflare helper (oanda-worker.js). It keeps your OANDA token and Twelve Data key secret
  // and gives every visitor live forex, gold, indices, commodities, bonds and US stocks.
  proxy: 'https://wickline-oanda.muhammadmuzammal266.workers.dev',

  // Accounts (Sign in with Google), from your Supabase project's API settings.
  // These two values are meant to be public: the database rules keep each person's data private.
  supabaseUrl: 'https://glrpxhvjixgybqwqwryq.supabase.co',
  supabaseKey: 'sb_publishable_UVYDkAhtRroQPYYEzA5pew_jKF1u72l',

  // The chart a first-time visitor sees.
  // Crypto: a Binance pair such as 'BTCUSDT'. Stock: 'AAPL'. Forex: 'EUR/USD'. Index: 'SPX500/USD'.
  defaultSymbol: 'BTCUSDT',

  // One of: '1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'
  defaultTimeframe: '1h',

  // The starting watchlist for first-time visitors. Everyone can change their own list on the page.
  defaultWatchlist: [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT',
    'AAPL', 'NVDA', 'TSLA', 'MSFT', 'SPY',
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD',
  ],

};
