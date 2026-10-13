/*
  Wickline settings
  -----------------
  Change the values below, then save (on GitHub: "Commit changes").
  Your live site updates about a minute later.
  Keep the quote marks and commas exactly as they are.
*/
window.WICKLINE_CONFIG = {

  // The name shown in the top-left corner and in the browser tab.
  siteName: 'Wickline',

  // Free Twelve Data API key: gives every visitor live US stock and forex prices.
  // Get one at https://twelvedata.com/pricing (Basic plan, free) and paste it between the quotes.
  // Leave it empty and stocks and forex show saved prices instead. Crypto is always live.
  // Note: anyone can see this key in the page code. The free plan allows 800 requests a day.
  twelveDataKey: '',

  // OANDA prices for forex and gold, for EVERY visitor (optional).
  // Leave empty to let each person connect their own OANDA account under "Data sources".
  // To use your account for everyone, set up the free proxy in oanda-worker.js (see the README)
  // and paste its address here, for example 'https://wickline-oanda.yourname.workers.dev'.
  // Never paste your OANDA token itself into this file.
  oandaProxy: '',

  // The chart a first-time visitor sees.
  // Crypto: a Binance pair such as 'BTCUSDT'. Stock: 'AAPL'. Forex: 'EUR/USD'.
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
