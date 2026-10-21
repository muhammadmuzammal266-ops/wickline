// Refuse to run inside another website's frame (GitHub Pages can't send a header for this).
if (window.top !== window.self) { document.documentElement.style.display = 'none'; throw new Error('RealChart must be opened directly.'); }
(function () {
'use strict';

/* ---------- small helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const ICON = {
  cursor: '<path d="M12 3v7M12 14v7M3 12h7M14 12h7"/>',
  trend: '<path d="M6.4 17.6L17.6 6.4"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/>',
  ray: '<circle cx="5" cy="17" r="2"/><path d="M6.8 16L21 8"/><path d="M17 7.4l4 .6-1.6 3.7"/>',
  hline: '<path d="M3 12h7M14 12h7"/><circle cx="12" cy="12" r="2"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  fib: '<path d="M4 5h16M4 10h16M4 14h16M4 19h16"/>',
  measure: '<path d="M3.5 16.5L16.5 3.5l4 4-13 13z"/><path d="M7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2"/>',
  alert: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  magnet: '<path d="M6 3v9a6 6 0 0 0 12 0V3h-4v9a2 2 0 0 1-4 0V3z"/><path d="M6 7h4M14 7h4"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><path d="M4 4l16 16"/>',
  gear: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z"/>',
  bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  long: '<path d="M4 20h16"/><path d="M5 16l4.5-4.5 3 3L19 8"/><path d="M14.5 8H19v4.5"/>',
  short: '<path d="M4 20h16"/><path d="M5 6l4.5 4.5 3-3L19 14"/><path d="M14.5 14H19V9.5"/>',
  replay: '<path d="M11.5 7l-6 5 6 5z"/><path d="M19.5 7l-6 5 6 5z"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M7 5.5h3.5v13H7zM13.5 5.5H17v13h-3.5z"/>',
  stepFwd: '<path d="M6 6.5v11l8-5.5z"/><path d="M17.5 6.5v11"/>',
  stepBack: '<path d="M18 6.5v11l-8-5.5z"/><path d="M6.5 6.5v11"/>',
  pick: '<path d="M12 3v18"/><path d="M7.5 8.5L4 12l3.5 3.5M16.5 8.5L20 12l-3.5 3.5"/>',
  live: '<path d="M5 7l5 5-5 5M11 7l5 5-5 5"/><path d="M19.5 6v12"/>',
};
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const LWC = window.LightweightCharts;
if (!LWC) {
  $('#veilSpin').hidden = true;
  $('#veilText').textContent = "The chart library didn't load. Check your internet connection and reload the page.";
  return;
}
const { createChart, createTextWatermark, CandlestickSeries, BarSeries, LineSeries, AreaSeries, HistogramSeries, BaselineSeries, LineStyle, CrosshairMode } = LWC;

/* ---------- storage (per browser, optional) ---------- */
const NS = 'wickline:';
const store = {
  get(k, d) { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } if (store.onSet) store.onSet(k); },
  raw(k, v) { try { if (v == null) localStorage.removeItem(NS + k); else localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },   // no syncing
  onSet: null,
};
// Earlier versions let people paste an OANDA token, which was kept in the browser. That's gone: remove any saved copy.
try { localStorage.removeItem(NS + 'oanda'); } catch (e) { /* storage unavailable */ }

/* ---------- site settings from config.js ---------- */
const CFG = Object.assign({ siteName: 'RealChart', twelveDataKey: '', proxy: '', supabaseUrl: '', supabaseKey: '', defaultSymbol: 'BTCUSDT', defaultTimeframe: '1h', defaultWatchlist: null }, window.WICKLINE_CONFIG || {});
// The site's Cloudflare helper: keeps the OANDA and Twelve Data keys off the page.
const API = (v => (/^https:\/\/[a-z0-9.-]+$/i.test(v) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(v) ? v : ''))(String(CFG.proxy || CFG.oandaProxy || '').trim().replace(/\/+$/, ''));
CFG.siteName = String(CFG.siteName || 'RealChart').slice(0, 40);
CFG.twelveDataKey = String(CFG.twelveDataKey || '').trim();

/* ---------- market vocabulary ---------- */
const TFS = [
  { id: '1m', label: '1m', sec: 60 }, { id: '5m', label: '5m', sec: 300 }, { id: '15m', label: '15m', sec: 900 }, { id: '30m', label: '30m', sec: 1800 },
  { id: '1h', label: '1h', sec: 3600 }, { id: '4h', label: '4h', sec: 14400 },
  { id: '1d', label: '1D', sec: 86400 }, { id: '1w', label: '1W', sec: 604800 },
];
const tfOf = id => TFS.find(t => t.id === id) || TFS[3];
const DAY = 86400, WEEK = 604800, YEAR = 31536000;
const COINS = { BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BNB: 'BNB', XRP: 'XRP', DOGE: 'Dogecoin', ADA: 'Cardano', LINK: 'Chainlink', AVAX: 'Avalanche', LTC: 'Litecoin', DOT: 'Polkadot', TRX: 'TRON', TON: 'Toncoin', SUI: 'Sui', NEAR: 'NEAR Protocol', ATOM: 'Cosmos', UNI: 'Uniswap', APT: 'Aptos', ARB: 'Arbitrum', OP: 'Optimism', SHIB: 'Shiba Inu', PEPE: 'Pepe', BCH: 'Bitcoin Cash', ETC: 'Ethereum Classic', FIL: 'Filecoin', AAVE: 'Aave', INJ: 'Injective', HBAR: 'Hedera', XLM: 'Stellar', ICP: 'Internet Computer', SEI: 'Sei', TIA: 'Celestia', RENDER: 'Render', FET: 'Fetch.ai', WIF: 'dogwifhat', ENA: 'Ethena', TAO: 'Bittensor', PAXG: 'PAX Gold', WLD: 'Worldcoin', ALGO: 'Algorand', VET: 'VeChain', SAND: 'The Sandbox', CRV: 'Curve', LDO: 'Lido DAO', JUP: 'Jupiter', BONK: 'Bonk', FLOKI: 'Floki', USDC: 'USD Coin', FDUSD: 'First Digital USD' };
const QUOTES = ['USDT', 'USDC', 'FDUSD', 'TUSD', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY', 'BRL', 'JPY', 'DAI'];
const QUOTE_NAMES = { USDT: 'TetherUS', USDC: 'USD Coin', FDUSD: 'First Digital USD', BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', EUR: 'Euro', TRY: 'Turkish lira', BRL: 'Brazilian real', JPY: 'Japanese yen', TUSD: 'TrueUSD', DAI: 'Dai' };
function splitSym(s) { for (const q of QUOTES) if (s.endsWith(q) && s.length > q.length) return [s.slice(0, -q.length), q]; return [s, '']; }

// Demo starting values. Crypto: price, annual volatility, 24h turnover in the quote currency.
const CRYPTO_DEMO = {
  BTCUSDT: [98450, 0.55, 1.9e9], ETHUSDT: [3418, 0.7, 1.1e9], SOLUSDT: [168.4, 0.95, 4.2e8], BNBUSDT: [642.1, 0.6, 1.6e8],
  XRPUSDT: [2.412, 0.9, 3.1e8], DOGEUSDT: [0.21354, 1.1, 2.2e8], ADAUSDT: [0.7241, 1.0, 9.0e7], LINKUSDT: [17.36, 1.0, 7.5e7],
  AVAXUSDT: [28.91, 1.05, 6.1e7], LTCUSDT: [92.4, 0.85, 5.2e7], DOTUSDT: [5.183, 1.0, 3.8e7], TRXUSDT: [0.2743, 0.6, 4.4e7],
  SUIUSDT: [3.684, 1.2, 1.4e8], NEARUSDT: [4.96, 1.1, 4.0e7], ATOMUSDT: [6.42, 0.95, 2.4e7],
  UNIUSDT: [9.87, 1.05, 3.1e7], APTUSDT: [7.15, 1.1, 2.6e7], ARBUSDT: [0.612, 1.15, 3.3e7], OPUSDT: [1.214, 1.15, 2.5e7],
  BCHUSDT: [468.2, 0.85, 4.1e7], AAVEUSDT: [284.6, 1.0, 5.6e7], XLMUSDT: [0.3921, 0.95, 2.7e7], ETHBTC: [0.03472, 0.45, 1.8e7],
};
// US stocks and ETFs: ticker, name, demo price, annual volatility, daily dollar volume.
const STOCKS = [
  ['AAPL', 'Apple', 254.6, 0.28, 1.3e10], ['MSFT', 'Microsoft', 521.4, 0.24, 1.0e10], ['NVDA', 'NVIDIA', 186.3, 0.48, 3.2e10], ['AMZN', 'Amazon', 224.8, 0.32, 1.0e10],
  ['GOOGL', 'Alphabet (Class A)', 246.1, 0.3, 8e9], ['META', 'Meta Platforms', 718.5, 0.36, 9e9], ['TSLA', 'Tesla', 432.7, 0.6, 3.0e10], ['AVGO', 'Broadcom', 338.9, 0.45, 8e9],
  ['BRK.B', 'Berkshire Hathaway (Class B)', 489.2, 0.18, 2e9], ['JPM', 'JPMorgan Chase', 301.4, 0.24, 3e9], ['V', 'Visa', 346.2, 0.2, 2.5e9], ['MA', 'Mastercard', 574.8, 0.22, 2e9],
  ['UNH', 'UnitedHealth Group', 351.6, 0.4, 3e9], ['XOM', 'Exxon Mobil', 114.9, 0.24, 2e9], ['JNJ', 'Johnson & Johnson', 186.7, 0.18, 1.8e9], ['WMT', 'Walmart', 102.3, 0.2, 2e9],
  ['PG', 'Procter & Gamble', 153.8, 0.17, 1.3e9], ['HD', 'Home Depot', 402.1, 0.24, 1.5e9], ['COST', 'Costco', 928.4, 0.22, 2e9], ['NFLX', 'Netflix', 118.6, 0.38, 4e9],
  ['AMD', 'AMD', 214.5, 0.55, 8e9], ['INTC', 'Intel', 36.8, 0.5, 3e9], ['ORCL', 'Oracle', 284.3, 0.45, 6e9], ['CRM', 'Salesforce', 244.6, 0.33, 2e9],
  ['ADBE', 'Adobe', 351.2, 0.33, 1.5e9], ['KO', 'Coca-Cola', 68.4, 0.15, 1.2e9], ['PEP', 'PepsiCo', 146.9, 0.18, 1.1e9], ['DIS', 'Walt Disney', 112.7, 0.28, 1.2e9],
  ['BA', 'Boeing', 218.4, 0.35, 2e9], ['NKE', 'Nike', 68.2, 0.36, 1.2e9], ['PLTR', 'Palantir', 178.6, 0.65, 9e9], ['UBER', 'Uber', 96.1, 0.4, 2e9],
  ['COIN', 'Coinbase', 331.5, 0.75, 3e9], ['PYPL', 'PayPal', 68.9, 0.36, 1.1e9], ['SHOP', 'Shopify', 152.4, 0.5, 1.5e9], ['BAC', 'Bank of America', 50.4, 0.26, 2e9],
  ['MCD', "McDonald's", 301.2, 0.17, 1.1e9], ['CSCO', 'Cisco', 69.8, 0.22, 1.4e9], ['QCOM', 'Qualcomm', 164.3, 0.35, 1.5e9], ['IBM', 'IBM', 281.5, 0.27, 1.4e9],
  ['GE', 'GE Aerospace', 291.7, 0.32, 1.5e9],
  ['SPY', 'SPDR S&P 500 ETF', 669.8, 0.16, 3.0e10], ['QQQ', 'Invesco QQQ (Nasdaq-100)', 603.4, 0.2, 1.8e10], ['DIA', 'SPDR Dow Jones Industrial ETF', 462.1, 0.15, 1.2e9],
  ['IWM', 'iShares Russell 2000 ETF', 246.3, 0.22, 6e9], ['VOO', 'Vanguard S&P 500 ETF', 615.7, 0.16, 3e9], ['GLD', 'SPDR Gold Shares', 368.9, 0.18, 3e9],
];
const ETFS = new Set(['SPY', 'QQQ', 'DIA', 'IWM', 'VOO', 'GLD']);
// Forex and metals: pair, name, demo price, annual volatility.
const FX = [
  ['EUR/USD', 'Euro / US dollar', 1.1652, 0.07], ['GBP/USD', 'British pound / US dollar', 1.3418, 0.08], ['USD/JPY', 'US dollar / Japanese yen', 150.24, 0.1],
  ['USD/CHF', 'US dollar / Swiss franc', 0.7981, 0.08], ['AUD/USD', 'Australian dollar / US dollar', 0.6587, 0.1], ['USD/CAD', 'US dollar / Canadian dollar', 1.3952, 0.06],
  ['NZD/USD', 'New Zealand dollar / US dollar', 0.5779, 0.1], ['EUR/GBP', 'Euro / British pound', 0.8684, 0.06], ['EUR/JPY', 'Euro / Japanese yen', 175.06, 0.1],
  ['GBP/JPY', 'British pound / Japanese yen', 201.58, 0.11], ['EUR/CHF', 'Euro / Swiss franc', 0.9299, 0.06], ['AUD/JPY', 'Australian dollar / Japanese yen', 98.97, 0.12],
  ['GBP/CHF', 'British pound / Swiss franc', 1.0709, 0.08], ['EUR/AUD', 'Euro / Australian dollar', 1.7689, 0.09], ['CHF/JPY', 'Swiss franc / Japanese yen', 188.24, 0.1],
  ['USD/TRY', 'US dollar / Turkish lira', 41.86, 0.12], ['USD/ZAR', 'US dollar / South African rand', 17.32, 0.15], ['USD/MXN', 'US dollar / Mexican peso', 18.41, 0.13],
  ['USD/INR', 'US dollar / Indian rupee', 88.74, 0.05], ['USD/PKR', 'US dollar / Pakistani rupee', 281.45, 0.04], ['USD/CNY', 'US dollar / Chinese yuan', 6.6921, 0.04],
  ['XAU/USD', 'Gold / US dollar', 3998.6, 0.2], ['XAG/USD', 'Silver / US dollar', 48.27, 0.3],
];
// Indices, commodities and bonds: OANDA instruments, live through the site's OANDA connection.
// instrument, category, name, search words, close Tue 13 Oct 2026, close Mon 12 Oct 2026, decimals (OANDA daily candles, 5 pm New York)
const CFDS = [
  ['SPX500_USD', 'index', 'US S&P 500', 'SPX US500 SP500 S&P SNP', 7816.2, 7816.6, 1],
  ['NAS100_USD', 'index', 'US Nasdaq 100', 'NDX US100 NASDAQ NAS100 TECH100', 30592.0, 30689.4, 1],
  ['US30_USD', 'index', 'US Wall St 30 (Dow Jones)', 'DOW DJI DJIA US30 WALLSTREET', 51715.2, 51911.1, 1],
  ['US2000_USD', 'index', 'US Russell 2000', 'RUT RUSSELL US2000 SMALLCAP', 2787.77, 2798.73, 3],
  ['UK100_GBP', 'index', 'UK 100 (FTSE 100)', 'FTSE UKX UK100 FOOTSIE', 10664.0, 10656.0, 1],
  ['DE30_EUR', 'index', 'Germany 40 (DAX)', 'DAX GER40 DE40 DE30 GERMANY', 25315.6, 25260.8, 1],
  ['FR40_EUR', 'index', 'France 40 (CAC 40)', 'CAC FRA40 FR40 FRANCE', 7836.0, 7796.2, 1],
  ['EU50_EUR', 'index', 'Europe 50 (Euro Stoxx 50)', 'STOXX SX5E EU50 EUROSTOXX EUROPE', 6191.9, 6194.4, 1],
  ['JP225_USD', 'index', 'Japan 225 (Nikkei 225)', 'NIKKEI NI225 N225 JP225 JAPAN', 67998.9, 68248.9, 1],
  ['HK33_HKD', 'index', 'Hong Kong 33 (Hang Seng)', 'HSI HANGSENG HK50 HK33 HONGKONG', 24309.2, 24197.7, 1],
  ['AU200_AUD', 'index', 'Australia 200 (ASX 200)', 'ASX XJO AUS200 AU200 AUSTRALIA', 8747.8, 8773.9, 1],
  ['CN50_USD', 'index', 'China A50', 'CHINA A50 CN50 FTSEA50', 13729.4, 13756.4, 1],
  ['CH20_CHF', 'index', 'Switzerland 20 (SMI)', 'SMI SWISS SWI20 CH20 SWITZERLAND', 13929.2, 13870.2, 1],
  ['NL25_EUR', 'index', 'Netherlands 25 (AEX)', 'AEX NETH25 NL25 DUTCH NETHERLANDS', 1133.95, 1134.68, 3],
  ['ESPIX_EUR', 'index', 'Spain 35 (IBEX 35)', 'IBEX ESP35 SPAIN ESPIX', 19199.0, 19276.9, 1],
  ['SG30_SGD', 'index', 'Singapore 30', 'SGX STI SING30 SG30 SINGAPORE', 504.8, 504.2, 2],
  ['WTICO_USD', 'futures', 'WTI crude oil', 'OIL CRUDE WTI USOIL CL', 95.728, 94.19, 3],
  ['BCO_USD', 'futures', 'Brent crude oil', 'OIL CRUDE BRENT UKOIL BRN', 108.668, 108.376, 3],
  ['NATGAS_USD', 'futures', 'Natural gas', 'GAS NATGAS NG', 3.249, 3.105, 3],
  ['XCU_USD', 'futures', 'Copper', 'COPPER HG XCU', 6.64198, 6.67542, 5],
  ['XPT_USD', 'futures', 'Platinum', 'PLATINUM XPT PL', 1647.929, 1675.112, 3],
  ['XPD_USD', 'futures', 'Palladium', 'PALLADIUM XPD PA', 1116.377, 1131.579, 3],
  ['CORN_USD', 'futures', 'Corn', 'CORN ZC GRAIN', 4.695, 4.701, 3],
  ['WHEAT_USD', 'futures', 'Wheat', 'WHEAT ZW GRAIN', 6.593, 6.625, 3],
  ['SOYBN_USD', 'futures', 'Soybeans', 'SOYBEANS SOY ZS GRAIN', 12.768, 12.815, 3],
  ['SUGAR_USD', 'futures', 'Sugar', 'SUGAR SB', 0.20174, 0.19938, 5],
  ['USB02Y_USD', 'bond', 'US 2-year Treasury note (price)', 'US02Y TREASURY ZT 2Y TNOTE', 101.904, 101.87, 3],
  ['USB05Y_USD', 'bond', 'US 5-year Treasury note (price)', 'US05Y TREASURY ZF 5Y TNOTE', 103.758, 103.661, 3],
  ['USB10Y_USD', 'bond', 'US 10-year Treasury note (price)', 'US10Y TREASURY ZN 10Y TNOTE', 104.936, 104.75, 3],
  ['USB30Y_USD', 'bond', 'US 30-year Treasury bond (price)', 'US30Y TREASURY ZB 30Y TBOND', 104.15, 103.622, 3],
  ['UK10YB_GBP', 'bond', 'UK 10-year gilt (price)', 'GILT UK10Y GILTS', 83.848, 83.909, 3],
  ['DE10YB_EUR', 'bond', 'German 10-year Bund (price)', 'BUND DE10Y GERMANY', 121.556, 121.504, 3],
];
const CFD = {};
CFDS.forEach(([inst, cat, name, words, last, prev, prec]) => { CFD['FX:' + inst.replace('_', '/')] = { cat, name, words: words.split(' '), last, prev, prec }; });
// More US funds (ETFs), live through Twelve Data.
const FUNDS = [
  ['VTI', 'Vanguard Total Stock Market ETF'], ['IBIT', 'iShares Bitcoin Trust ETF'], ['TLT', 'iShares 20+ Year Treasury Bond ETF'], ['SLV', 'iShares Silver Trust'],
  ['XLK', 'Technology Select Sector SPDR'], ['XLF', 'Financial Select Sector SPDR'], ['XLE', 'Energy Select Sector SPDR'], ['XLV', 'Health Care Select Sector SPDR'],
  ['SMH', 'VanEck Semiconductor ETF'], ['ARKK', 'ARK Innovation ETF'], ['SCHD', 'Schwab US Dividend Equity ETF'], ['JEPI', 'JPMorgan Equity Premium Income ETF'],
  ['EEM', 'iShares MSCI Emerging Markets ETF'], ['VWO', 'Vanguard FTSE Emerging Markets ETF'], ['EFA', 'iShares MSCI EAFE ETF'], ['VEA', 'Vanguard FTSE Developed Markets ETF'],
  ['HYG', 'iShares High Yield Corporate Bond ETF'], ['LQD', 'iShares Investment Grade Corporate Bond ETF'], ['AGG', 'iShares Core US Aggregate Bond ETF'], ['BND', 'Vanguard Total Bond Market ETF'],
  ['IEF', 'iShares 7-10 Year Treasury Bond ETF'], ['USO', 'United States Oil Fund'], ['VNQ', 'Vanguard Real Estate ETF'], ['SOXX', 'iShares Semiconductor ETF'],
  ['XLI', 'Industrial Select Sector SPDR'], ['XLY', 'Consumer Discretionary Select Sector SPDR'], ['XLP', 'Consumer Staples Select Sector SPDR'], ['XLU', 'Utilities Select Sector SPDR'],
];
FUNDS.forEach(([t]) => ETFS.add(t));
const DEMO = {}, NAMES = {}, POP = {};
Object.keys(CRYPTO_DEMO).forEach((s, i) => { DEMO['BINANCE:' + s] = CRYPTO_DEMO[s]; POP['BINANCE:' + s] = i; });
STOCKS.forEach(([s, n, p, v, t], i) => { DEMO['US:' + s] = [p, v, t]; NAMES['US:' + s] = n; POP['US:' + s] = i; });
FX.forEach(([s, n, p, v], i) => { DEMO['FX:' + s] = [p, v, 0]; NAMES['FX:' + s] = n; POP['FX:' + s] = i; });
FUNDS.forEach(([s, n], i) => { NAMES['US:' + s] = n; POP['US:' + s] = 60 + i; });
Object.entries(CFD).forEach(([id, c], i) => { NAMES[id] = c.name; POP[id] = i; DEMO[id] = [c.last, c.cat === 'bond' ? 0.06 : c.cat === 'index' ? 0.18 : 0.3, 0]; });
// What a symbol is, for the watchlist sections and the search chips (the data source follows classOf).
function catOf(id) {
  const c = classOf(id);
  if (c === 'stock') return ETFS.has(rawOf(id)) ? 'fund' : 'stock';
  if (c === 'forex') return CFD[id] ? CFD[id].cat : 'forex';
  return 'crypto';
}

/* ---------- real prices saved when the page was built ----------
   Used whenever live data can't be reached (for example inside the Claude preview).
   Crypto: Binance public market data at 2026-10-12 00:23 UTC.
   US stocks & ETFs: closing price and change on Fri 9 Oct 2026 (Slickcharts).
   Forex: European Central Bank reference rates for Thu 8 and Fri 9 Oct 2026 (Frankfurter), units per US dollar.
   USD/PKR: ExchangeRate-API daily rate of 11 Oct 2026. Gold and silver: Gold API, Fri 9 Oct close. */
const SNAP = {
  at: 1791764620,
  date: '2026-10-09',
  crypto: { // last, 24h open, 24h high, 24h low, 24h volume (base), 24h turnover (quote)
    BTCUSDT: [83804.01, 82995.70, 84199.00, 82804.65, 7021.21312, 585512717.0],
    ETHUSDT: [2539.77, 2506.55, 2555.22, 2497.85, 197509.2173, 497724863.6],
    SOLUSDT: [111.29, 110.05, 112.75, 108.96, 1070661.41, 118367354.0],
    BNBUSDT: [753.63, 749.00, 758.44, 744.77, 53810.035, 40427337.47],
    XRPUSDT: [1.4097, 1.4020, 1.4300, 1.3872, 41382235, 58155826.13],
    DOGEUSDT: [0.08682, 0.08585, 0.08767, 0.08490, 314818216, 27126173.72],
    ADAUSDT: [0.2516, 0.2488, 0.2565, 0.2451, 101702166.8, 25383494.41],
    LINKUSDT: [13.366, 13.012, 13.487, 12.837, 1272017.55, 16743396.64],
    UNIUSDT: [7.740, 7.606, 7.901, 7.468, 4650479.38, 35713172.97],
    APTUSDT: [0.8999, 0.8704, 0.9655, 0.8374, 27385435.44, 24725875.71],
    ARBUSDT: [0.1988, 0.1894, 0.2031, 0.1885, 89307609.4, 17624002.45],
    OPUSDT: [0.1431, 0.1394, 0.1465, 0.1378, 65547613.94, 9336505.46],
    BCHUSDT: [286.50, 279.40, 287.20, 275.30, 23917.352, 6734225.62],
    AAVEUSDT: [172.45, 168.33, 173.03, 166.48, 79568.069, 13446443.11],
    XLMUSDT: [0.2028, 0.1965, 0.2061, 0.1943, 62745145, 12562654.86],
    ETHBTC: [0.03032, 0.03020, 0.03042, 0.03009, 4738.8591, 143.36117385],
    // last price only
    AVAXUSDT: [10.961], LTCUSDT: [64.72], DOTUSDT: [1.251], TRXUSDT: [0.3303], SUIUSDT: [1.1253], NEARUSDT: [5.862], ATOMUSDT: [1.912],
  },
  stocks: { // close, change on the day
    AAPL: [336.64, -3.78], MSFT: [535.07, 12.46], NVDA: [229.28, -1.20], AMZN: [262.43, 8.37], GOOGL: [351.66, 3.37], META: [718.67, -2.22],
    TSLA: [382.70, 7.70], AVGO: [361.54, 1.40], 'BRK.B': [515.62, 4.57], JPM: [332.99, 1.57], V: [385.45, 10.35], MA: [589.14, 14.38],
    UNH: [379.30, 8.35], XOM: [168.94, 0.44], JNJ: [261.44, 4.96], WMT: [111.35, 0.79], PG: [151.23, 0.64], HD: [290.74, -4.73],
    COST: [946.92, -1.00], NFLX: [70.30, -1.27], AMD: [608.10, -12.58], INTC: [104.70, -2.38], ORCL: [141.40, 5.71], CRM: [229.13, 1.33],
    ADBE: [242.27, 1.22], KO: [88.05, 0.28], PEP: [125.97, -2.37], DIS: [108.05, 1.03], BA: [190.37, 2.62], NKE: [34.71, -0.03],
    PLTR: [209.05, 10.27], UBER: [71.51, 1.27], COIN: [179.39, 7.39], PYPL: [55.53, 0.51], SHOP: [170.85, 6.29], BAC: [54.32, 0.71],
    MCD: [235.23, -1.67], CSCO: [118.39, 3.50], QCOM: [175.50, -0.51], IBM: [227.13, 0.52], GE: [308.20, 2.58],
    SPY: [778.57, 4.64], QQQ: [751.27, 3.69], DIA: [516.11, 4.46], IWM: [278.94, 1.37], VOO: [715.59, 4.31], GLD: [394.44, -5.63],
  },
  fx: {
    now: { AUD: 1.4324, CAD: 1.4226, CHF: 0.83107, CNY: 6.6921, EUR: 0.89238, GBP: 0.75641, INR: 96.73, JPY: 158.25, MXN: 18.2001, NZD: 1.7813, TRY: 49.173, ZAR: 16.5331 },
    prev: { AUD: 1.4402, CAD: 1.4262, CHF: 0.83372, CNY: 6.7023, EUR: 0.89397, GBP: 0.75718, INR: 96.78, JPY: 158.28, MXN: 18.0127, NZD: 1.7892, TRY: 49.215, ZAR: 16.6505 },
  },
  pkr: 276.868026,
  metals: { XAU: 4195.600098, XAG: 60.949001 },
};
function snapOf(id) {
  const c = classOf(id), r = rawOf(id);
  if (c === 'crypto') {
    const a = SNAP.crypto[r]; if (!a) return null;
    return { last: a[0], ref: a[1] ?? null, high: a[2] ?? null, low: a[3] ?? null, vol: a[4] ?? null, qvol: a[5] ?? null, prevClose: null };
  }
  if (c === 'stock') {
    const a = SNAP.stocks[r]; if (!a) return null;
    return { last: a[0], ref: a[0] - a[1], prevClose: a[0] - a[1], high: null, low: null, vol: null, qvol: null };
  }
  if (CFD[id]) { const k = CFD[id]; return { last: k.last, ref: k.prev, prevClose: k.prev, high: null, low: null, vol: null, qvol: null }; }
  const [b, q] = r.split('/');
  const none = { ref: null, prevClose: null, high: null, low: null, vol: null, qvol: null };
  if (SNAP.metals[b]) return q === 'USD' ? Object.assign({ last: SNAP.metals[b] }, none) : null;
  if (b === 'USD' && q === 'PKR') return Object.assign({ last: SNAP.pkr }, none);
  const rate = (tbl, cur) => (cur === 'USD' ? 1 : tbl[cur]);
  const last = rate(SNAP.fx.now, q) / rate(SNAP.fx.now, b), prev = rate(SNAP.fx.prev, q) / rate(SNAP.fx.prev, b);
  if (!isFinite(last)) return null;
  return Object.assign({}, none, { last, ref: isFinite(prev) ? prev : null, prevClose: isFinite(prev) ? prev : null });
}
const snapDay = () => SNAP.date.split('-').map(Number);
// The moment each saved price belongs to, and the moment its reference (24h ago / previous close) belongs to.
function snapTime(id) {
  if (CFD[id]) return nyTime(2026, 10, 13, 17, 0) - 1;
  const c = classOf(id); if (c === 'crypto') return SNAP.at;
  const [y, m, d] = snapDay(); return nyTime(y, m, d, c === 'stock' ? 16 : 17, 0) - 1;
}
function anchorTime(id) {
  if (CFD[id]) return nyTime(2026, 10, 12, 17, 0);
  const c = classOf(id); const [y, m, d] = snapDay();
  if (c === 'crypto') return SNAP.at - DAY;
  if (c === 'stock') return sessOpen(y, m, d);
  return Date.UTC(y, m - 1, d) / 1000;
}
function asOfText(id) {
  const c = classOf(id), r = rawOf(id);
  if (c === 'crypto') { const d = new Date(SNAP.at * 1000); return `${d.getDate()} ${MON[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())} your time`; }
  if (CFD[id]) return 'the Tue 13 Oct close';
  if (c === 'stock' || /^X(AU|AG)\//.test(r)) return 'the Fri 9 Oct close';
  if (r === 'USD/PKR') return 'the 11 Oct daily rate';
  return 'the ECB rate for Fri 9 Oct';
}

/* ---------- symbol ids: BINANCE:BTCUSDT, US:AAPL, FX:EUR/USD ---------- */
const classOf = id => (id.startsWith('US:') ? 'stock' : id.startsWith('FX:') ? 'forex' : 'crypto');
const rawOf = id => id.slice(id.indexOf(':') + 1);
const label = id => rawOf(id);
const migrateId = s => (typeof s === 'string' && s.includes(':') ? s : 'BINANCE:' + s);
function symParts(id) {
  const r = rawOf(id), c = classOf(id);
  if (c === 'crypto') return splitSym(r);
  if (c === 'forex') { const [b, q] = r.split('/'); return [b, '/' + (q || '')]; }
  return [r, ''];
}
function nameOf(id) {
  if (classOf(id) === 'crypto') { const [b, q] = splitSym(rawOf(id)); return `${COINS[b] || b} / ${QUOTE_NAMES[q] || q || 'Quote'}`; }
  const t = S.tickers[id];
  return NAMES[id] || (t && t.name) || rawOf(id);
}
function kindOf(id) {
  const c = classOf(id), r = rawOf(id);
  if (c === 'crypto') return 'Crypto';
  if (CFD[id]) return { index: 'Index', futures: 'Commodity', bond: 'Bond' }[CFD[id].cat];
  if (c === 'forex') return /^X(AU|AG|PT|PD)\//.test(r) ? 'Metal' : 'Forex';
  return ETFS.has(r) ? 'ETF' : 'US stock';
}

/* ---------- formatting ---------- */
function precFor(id, p) {
  if (CFD[id]) return CFD[id].prec;
  const a = Math.abs(p), c = classOf(id);
  if (c === 'forex') return a >= 1000 ? 2 : a >= 20 ? 3 : 5;
  if (c === 'stock') return a >= 1 ? 2 : 4;
  if (a >= 10) return 2; if (a >= 1) return 4; if (a >= 0.01) return 5; if (a >= 0.0001) return 7; return 8;
}
const NF = {};
function fmtP(p, prec) {
  if (p == null || !isFinite(p)) return '—';
  const k = prec == null ? S.prec : prec;
  if (!NF[k]) NF[k] = new Intl.NumberFormat('en-US', { minimumFractionDigits: k, maximumFractionDigits: k });
  return NF[k].format(p).replace('-', '−');
}
const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '');
const fmtSigned = (v, prec) => sign(v) + fmtP(Math.abs(v), prec);
const fmtPct = v => (isFinite(v) ? sign(v) + Math.abs(v).toFixed(2) + '%' : '—');
const CF = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const fmtVol = v => (v == null || !isFinite(v) ? '—' : CF.format(v));
const pad = n => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Daily and weekly bars are dated in UTC, so a bar never shows the previous day for viewers west of London.
function dparts(sec, tf) {
  const d = new Date(sec * 1000), u = tfOf(tf || S.tf).sec >= DAY;
  return u ? { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), w: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() }
           : { y: d.getFullYear(), mo: d.getMonth(), d: d.getDate(), w: d.getDay(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds() };
}
function fmtTime(sec, tf) {
  const p = dparts(sec, tf);
  const day = `${DOW[p.w]} ${p.d} ${MON[p.mo]} '${String(p.y).slice(2)}`;
  return tfOf(tf || S.tf).sec < DAY ? `${day}  ${pad(p.h)}:${pad(p.mi)}` : day;
}
function tickFmt(time, type, locale, tf) {
  const p = dparts(time, tf);
  switch (type) {
    case 0: return String(p.y);
    case 1: return MON[p.mo];
    case 2: return String(p.d);
    case 3: return `${pad(p.h)}:${pad(p.mi)}`;
    default: return `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`;
  }
}
function fmtSpan(sec) {
  sec = Math.abs(sec);
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.round((sec % 3600) / 60);
  if (d) return `${d}d ${h}h`; if (h) return `${h}h ${m}m`; return `${m}m`;
}
function fmtCountdown(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  if (d) return `${d}d ${pad(h)}:${pad(m)}:${pad(x)}`;
  if (h) return `${h}:${pad(m)}:${pad(x)}`;
  return `${pad(m)}:${pad(x)}`;
}
function tzLabel() {
  const off = -new Date().getTimezoneOffset(); const h = Math.floor(Math.abs(off) / 60), m = Math.abs(off) % 60;
  return `UTC${off >= 0 ? '+' : '−'}${h}${m ? ':' + pad(m) : ''}`;
}

/* ---------- New York market clock ---------- */
const NYF = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const nyCache = new Map();
function ny(ts) {
  const key = Math.floor(ts / 60);
  let p = nyCache.get(key);
  if (!p) {
    const o = {}; for (const part of NYF.formatToParts(new Date(key * 60000))) o[part.type] = part.value;
    p = { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, dow: WD[o.weekday] };
    p.mins = p.h * 60 + p.mi;
    if (nyCache.size > 30000) nyCache.clear();
    nyCache.set(key, p);
  }
  return p;
}
function nyOffset(ts) { const p = ny(ts); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) / 1000 - Math.floor(ts / 60) * 60; }
function nyTime(y, m, d, h, mi) { const g = Date.UTC(y, m - 1, d, h, mi) / 1000; return g - nyOffset(g - nyOffset(g)); }
function isOpenAt(cls, ts) {
  if (cls === 'crypto') return true;
  const p = ny(ts);
  if (cls === 'stock') return p.dow >= 1 && p.dow <= 5 && p.mins >= 570 && p.mins < 960; // 09:30–16:00 New York
  if (p.dow === 6) return false;                                                       // forex: Sun 17:00 → Fri 17:00 New York
  if (p.dow === 5) return p.mins < 1020;
  if (p.dow === 0) return p.mins >= 1020;
  return true;
}
const marketOpen = id => isOpenAt(classOf(id), Date.now() / 1000);
const isWeekendYMD = (y, m, d) => { const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return w === 0 || w === 6; };
function prevWeekday(y, m, d) {
  let t = Date.UTC(y, m - 1, d) / 1000;
  do { t -= DAY; } while ([0, 6].includes(new Date(t * 1000).getUTCDay()));
  const x = new Date(t * 1000); return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()];
}
const sessOpen = (y, m, d) => nyTime(y, m, d, 9, 30);
function alignTime(now, sec) { return sec === WEEK ? Math.floor((now - 345600) / WEEK) * WEEK + 345600 : Math.floor(now / sec) * sec; }
// Open time of the most recent bar that exists for this market, and of the bar before a given one.
function latestBar(cls, sec, now) {
  if (cls === 'crypto') return alignTime(now, sec);
  if (sec >= DAY) {
    const p = cls === 'forex' ? ny(now + 25200) : ny(now);
    let ymd = [p.y, p.m, p.d];
    if (isWeekendYMD(...ymd) || (cls === 'stock' && p.mins < 570)) ymd = prevWeekday(...ymd);
    const t = Date.UTC(ymd[0], ymd[1] - 1, ymd[2]) / 1000;
    return sec >= WEEK ? t - ((new Date(t * 1000).getUTCDay() + 6) % 7) * DAY : t;
  }
  if (cls === 'stock') {
    const p = ny(now);
    if (!isWeekendYMD(p.y, p.m, p.d) && p.mins >= 570) {
      const o = sessOpen(p.y, p.m, p.d);
      return now < o + 23400 ? o + Math.floor((now - o) / sec) * sec : o + Math.floor(23399 / sec) * sec;
    }
    const ymd = prevWeekday(p.y, p.m, p.d); return sessOpen(...ymd) + Math.floor(23399 / sec) * sec;
  }
  let t = alignTime(now, sec), guard = 0; while (!isOpenAt('forex', t) && guard++ < 6000) t -= sec; return t;
}
function prevBar(cls, sec, t) {
  if (cls === 'crypto') return t - sec;
  if (sec >= DAY) {
    if (sec >= WEEK) return t - WEEK;
    let x = t - DAY; while ([0, 6].includes(new Date(x * 1000).getUTCDay())) x -= DAY; return x;
  }
  if (cls === 'stock') {
    const p = ny(t); const o = sessOpen(p.y, p.m, p.d);
    if (t - sec >= o) return t - sec;
    const ymd = prevWeekday(p.y, p.m, p.d); return sessOpen(...ymd) + Math.floor(23399 / sec) * sec;
  }
  let x = t - sec, guard = 0; while (!isOpenAt('forex', x) && guard++ < 6000) x -= sec; return x;
}

/* ---------- state ---------- */
// Reads tickers the way people write them (in config.js or a shared link): BTCUSDT, AAPL, EUR/USD, EUR-USD, US:AAPL.
function parseSymbol(v) {
  if (!v || typeof v !== 'string') return null;
  v = v.trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9.:/_-]{1,24}$/.test(v)) return null;
  if (/^(BINANCE|US|FX):./.test(v)) return v;
  const fx = v.match(/^([A-Z]{3})[-/_]([A-Z]{3})$/);
  if (fx) return `FX:${fx[1]}/${fx[2]}`;
  const cfd = Object.keys(CFD).find(id => { const r = rawOf(id); return v === r.replace('/', '-') || v === r.replace('/', '_') || v === r.replace('/', ''); });
  if (cfd) return cfd;
  if (STOCKS.some(s => s[0] === v)) return 'US:' + v;
  const fx6 = FX.find(s => s[0].replace('/', '') === v);
  if (fx6) return 'FX:' + fx6[0];
  const [base, quote] = splitSym(v);
  if (CRYPTO_DEMO[v] || (quote && base.length >= 2)) return 'BINANCE:' + v;
  return 'US:' + v;
}
const BUILTIN_WATCH = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'AAPL', 'NVDA', 'TSLA', 'MSFT', 'SPY', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD'];
const DEFAULT_WATCH = Array.from(new Set((Array.isArray(CFG.defaultWatchlist) && CFG.defaultWatchlist.length ? CFG.defaultWatchlist : BUILTIN_WATCH).map(parseSymbol).filter(Boolean)));
const DEFAULT_SYMBOL = parseSymbol(CFG.defaultSymbol) || 'BINANCE:BTCUSDT';
const DEFAULT_TF = TFS.some(t => t.id === CFG.defaultTimeframe) ? CFG.defaultTimeframe : '1h';
const DEFAULT_IND = [
  { id: 'vol1', type: 'vol', params: {}, color: null },
  { id: 'ema1', type: 'ema', params: { len: 21 }, color: '#d4891c' },
  { id: 'sma1', type: 'sma', params: { len: 50 }, color: '#2f7fe0' },
  { id: 'rsi1', type: 'rsi', params: { len: 14 }, color: '#9b5de5' },
];
const S = {
  symbol: migrateId(store.get('symbol', DEFAULT_SYMBOL)),
  tf: store.get('tf', DEFAULT_TF),
  type: store.get('type', 'candles'),
  scaleMode: store.get('scale', 0),
  watch: store.get('watch', null),
  ind: store.get('ind', DEFAULT_IND),
  drawings: store.get('drawings', {}),
  alerts: store.get('alerts', []),
  magnet: store.get('magnet', true),
  tool: 'cursor',
  bars: [], ha: [], prec: 2,
  tickers: {},
  ready: false, binance: false, tdReach: false, goldApi: false, sandbox: false, spot: {},
  main: null, rts: [], alertLines: [],
  selected: null, draft: null, measure: null,
  cross: null, crossPrice: null,
  token: 0, older: false, noMore: false,
  undo: {},
};
if (!TFS.some(t => t.id === S.tf)) S.tf = DEFAULT_TF;
if (!['candles', 'bars', 'heikin', 'line', 'area'].includes(S.type)) S.type = 'candles';
if (![0, 1, 2].includes(S.scaleMode)) S.scaleMode = 0;
if (!Array.isArray(S.watch)) S.watch = DEFAULT_WATCH.slice();
S.watch = Array.from(new Set(S.watch.map(migrateId)));
if (store.get('ver', 1) < 2) {   // one-time upgrade for watchlists saved before stocks and forex existed
  if (!S.watch.some(id => classOf(id) !== 'crypto')) S.watch = S.watch.concat(DEFAULT_WATCH.filter(id => classOf(id) !== 'crypto'));
  store.set('ver', 2);
}
// A shared link (?s=AAPL&tf=1h, or #AAPL) opens that chart.
(function readLink() {
  let q = null, h = '';
  try { q = new URLSearchParams(location.search); h = location.hash.slice(1); } catch (e) { /* no access to the address */ }
  const s = parseSymbol((q && (q.get('s') || q.get('symbol'))) || (/^[A-Za-z0-9._-]{1,20}$/.test(h) ? h : ''));
  if (s) S.symbol = s;
  const tf = q && q.get('tf');
  if (tf && TFS.some(t => t.id === tf)) S.tf = tf;
})();
if (!Array.isArray(S.alerts)) S.alerts = [];
S.alerts.forEach(a => { a.sym = migrateId(a.sym); });
if (!S.drawings || typeof S.drawings !== 'object') S.drawings = {};
Object.keys(S.drawings).forEach(k => { if (!k.includes(':')) { S.drawings[migrateId(k)] = S.drawings[k]; delete S.drawings[k]; } });
store.set('watch', S.watch);

/* ---------- colours from the page tokens ---------- */
let C = {};
const FONT_DATA = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace";
function tok(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function readColors() {
  C = { bg: tok('--bg'), panel: tok('--panel'), panel2: tok('--panel-2'), line: tok('--line'), grid: tok('--grid'), fg: tok('--fg'), muted: tok('--muted'), faint: tok('--faint'), accent: tok('--accent'), up: tok('--up'), down: tok('--down'), draw: tok('--draw'), crossLabel: tok('--cross-label') };
}
function alpha(hex, a) {
  let h = String(hex || '#888888').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
readColors();

/* ---------- chart ---------- */
const wrap = $('#wrap');
const chart = createChart($('#chart'), {
  autoSize: true,
  layout: { background: { type: 'solid', color: C.panel }, textColor: C.muted, fontSize: 11, fontFamily: FONT_DATA, attributionLogo: false, panes: { enableResize: true, separatorColor: C.line, separatorHoverColor: alpha(C.accent, 0.35) } },
  grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: C.line },
  timeScale: { borderColor: C.line, timeVisible: true, secondsVisible: false, rightOffset: 10, barSpacing: 8, minBarSpacing: 1.2, tickMarkFormatter: tickFmt },
  localization: { timeFormatter: t => fmtTime(t) },
});

function pricePF(prec) { return { type: 'price', precision: prec, minMove: Number((Math.pow(10, -prec)).toFixed(prec)) }; }
function hasVol() { return S.rts.some(r => r.inst.type === 'vol'); }
function mainMargins() { return hasVol() ? { top: 0.08, bottom: 0.2 } : { top: 0.08, bottom: 0.06 }; }

function mainStyle() {
  const pf = pricePF(S.prec);
  switch (S.type) {
    case 'line': return [LineSeries, { color: C.draw, lineWidth: 2, priceFormat: pf }];
    case 'area': return [AreaSeries, { lineColor: C.draw, topColor: alpha(C.draw, 0.28), bottomColor: alpha(C.draw, 0.02), lineWidth: 2, priceFormat: pf }];
    case 'bars': return [BarSeries, { upColor: C.up, downColor: C.down, thinBars: false, priceFormat: pf }];
    default: return [CandlestickSeries, { upColor: C.up, downColor: C.down, borderUpColor: C.up, borderDownColor: C.down, wickUpColor: C.up, wickDownColor: C.down, priceFormat: pf }];
  }
}
function createMain() {
  if (S.main) { chart.removeSeries(S.main); S.main = null; S.alertLines = []; }
  const [def, opts] = mainStyle();
  S.main = chart.addSeries(def, Object.assign({ lastValueVisible: true, priceLineVisible: true }, opts), 0);
  S.main.priceScale().applyOptions({ mode: S.scaleMode, autoScale: true, scaleMargins: mainMargins() });
  const p0 = chart.panes()[0];
  if (p0 && p0.setPreserveEmptyPane) p0.setPreserveEmptyPane(true);
  orderPane0();
  if (S.bars.length) setMainData();
  syncAlertLines(); syncTradeMarks();
}
function orderPane0() {
  const v = S.rts.find(r => r.inst.type === 'vol');
  try { if (v) { v.series[0].setSeriesOrder(0); S.main.setSeriesOrder(1); } S.rts.forEach(r => (r.fills || []).forEach(f => f.s.setSeriesOrder(0))); } catch (e) { /* ordering is cosmetic */ }
}
function haAt(i) {
  const b = S.bars[i]; const c = (b.open + b.high + b.low + b.close) / 4; const p = S.ha[i - 1];
  const o = p ? (p.open + p.close) / 2 : (b.open + b.close) / 2;
  S.ha[i] = { time: b.time, open: o, high: Math.max(b.high, o, c), low: Math.min(b.low, o, c), close: c };
}
function computeHA() { S.ha = new Array(S.bars.length); for (let i = 0; i < S.bars.length; i++) haAt(i); }
function mainPoint(i) {
  const b = S.bars[i];
  if (S.type === 'line' || S.type === 'area') return { time: b.time, value: b.close };
  if (S.type === 'heikin') return S.ha[i];
  return { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close };
}
function setMainData() { if (S.type === 'heikin') computeHA(); S.main.setData(S.bars.map((_, i) => mainPoint(i))); }

/* ---------- indicators ---------- */
const IND = {
  sma: { label: 'Moving Average', short: p => `SMA ${p.len}`, desc: 'Simple average of the last N closes.', params: [{ k: 'len', label: 'Length', def: 50, min: 1, max: 500, step: 1 }] },
  ema: { label: 'Exponential Moving Average', short: p => `EMA ${p.len}`, desc: 'An average that weights recent closes more.', params: [{ k: 'len', label: 'Length', def: 21, min: 1, max: 500, step: 1 }] },
  bb: { label: 'Bollinger Bands', short: p => `BB ${p.len} ${p.mult}`, desc: 'Average with bands N standard deviations away.', params: [{ k: 'len', label: 'Length', def: 20, min: 2, max: 300, step: 1 }, { k: 'mult', label: 'Std. deviations', def: 2, min: 0.5, max: 5, step: 0.1 }] },
  vol: { label: 'Volume', short: () => 'Vol', desc: 'Amount traded in each bar, coloured by direction. Forex has no central volume.', params: [], nocolor: true },
  rsi: { label: 'Relative Strength Index', short: p => `RSI ${p.len}`, desc: 'Momentum from 0 to 100. Above 70 is stretched, below 30 is washed out.', params: [{ k: 'len', label: 'Length', def: 14, min: 2, max: 100, step: 1 }], pane: true },
  macd: { label: 'MACD', short: p => `MACD ${p.fast} ${p.slow} ${p.signal}`, desc: 'Gap between a fast and slow EMA, with a signal line.', params: [{ k: 'fast', label: 'Fast length', def: 12, min: 1, max: 200, step: 1 }, { k: 'slow', label: 'Slow length', def: 26, min: 2, max: 300, step: 1 }, { k: 'signal', label: 'Signal length', def: 9, min: 1, max: 100, step: 1 }], pane: true },
};
const PALETTE = ['#d4891c', '#2f7fe0', '#9b5de5', '#13a3b8', '#d8487f', '#6f9a1a'];
const SIGNAL = '#e0892a';
Object.assign(IND, {
  vwap: { label: 'VWAP', short: () => 'VWAP', desc: 'Volume-weighted average price. Restarts each day (each month on daily bars). Blank for forex, which has no volume.', params: [] },
  stoch: { label: 'Stochastic', short: p => `Stoch ${p.k} ${p.smooth} ${p.d}`, desc: 'Where the close sits in the recent high–low range, from 0 to 100.', params: [{ k: 'k', label: '%K length', def: 14, min: 2, max: 200, step: 1 }, { k: 'smooth', label: '%K smoothing', def: 3, min: 1, max: 50, step: 1 }, { k: 'd', label: '%D length', def: 3, min: 1, max: 50, step: 1 }], pane: true },
  atr: { label: 'Average True Range', short: p => `ATR ${p.len}`, desc: 'Average size of each bar’s move, gaps included. Handy for setting stop distances.', params: [{ k: 'len', label: 'Length', def: 14, min: 1, max: 200, step: 1 }], pane: true },
});
// ----- more indicators -----
// Each one says how to work it out (compute) and how to draw it (series, levels, range, fills), so the same
// definition draws on the live chart and on an idea's chart. Formulas follow the common TradingView defaults.
const IND_CATS = [['ma', 'Moving averages'], ['trend', 'Trend'], ['osc', 'Oscillators'], ['volatility', 'Volatility'], ['volume', 'Volume']];
Object.assign(IND.sma, { cat: 'ma', alias: 'sma simple' });
Object.assign(IND.ema, { cat: 'ma', alias: 'exponential' });
Object.assign(IND.bb, { cat: 'volatility', alias: 'bollinger bands', fills: [{ a: 0, b: 2, mode: 'band' }] });
Object.assign(IND.vol, { cat: 'volume' });
Object.assign(IND.rsi, { cat: 'osc', alias: 'relative strength' });
Object.assign(IND.macd, { cat: 'osc', alias: 'moving average convergence divergence', check: p => (p.fast >= p.slow ? 'Fast length must be shorter than slow length' : '') });
Object.assign(IND.vwap, { cat: 'volume', alias: 'volume weighted average price' });
Object.assign(IND.stoch, { cat: 'osc', alias: 'stochastic oscillator' });
Object.assign(IND.atr, { cat: 'volatility', alias: 'average true range' });
const L1 = c => c;
const SIG = c => (c === SIGNAL ? '#d8487f' : SIGNAL);
Object.assign(IND, {
  wma: { cat: 'ma', label: 'Weighted Moving Average', alias: 'wma linear weighted', short: p => `WMA ${p.len}`, desc: 'An average where each newer close counts a little more than the one before it.',
    params: [{ k: 'len', label: 'Length', def: 20, min: 1, max: 500, step: 1 }], fmt: 'price',
    series: [{ color: L1 }], compute: (B, p) => [wma(B.map(b => b.close), p.len)] },
  hma: { cat: 'ma', label: 'Hull Moving Average', alias: 'hma hull', short: p => `HMA ${p.len}`, desc: 'A fast, smooth average that follows turns with very little lag.',
    params: [{ k: 'len', label: 'Length', def: 21, min: 2, max: 500, step: 1 }], fmt: 'price',
    series: [{ color: L1 }], compute: (B, p) => [hma(B.map(b => b.close), p.len)] },
  ichimoku: { cat: 'trend', label: 'Ichimoku Cloud', alias: 'ichimoku kinko hyo cloud tenkan kijun senkou chikou', nocolor: true,
    short: p => `Ichimoku ${p.conv} ${p.base} ${p.spanB} ${p.disp}`, desc: 'Conversion and base lines, a lagging line and a cloud that shows support, resistance and trend. The cloud is drawn up to the latest bar.',
    params: [{ k: 'conv', label: 'Conversion line length', def: 9, min: 1, max: 100, step: 1 }, { k: 'base', label: 'Base line length', def: 26, min: 1, max: 200, step: 1 },
      { k: 'spanB', label: 'Leading span B length', def: 52, min: 1, max: 300, step: 1 }, { k: 'disp', label: 'Displacement', def: 26, min: 1, max: 100, step: 1 }], fmt: 'price',
    series: [{ name: 'Conversion', color: () => '#2f7fe0', width: 1 }, { name: 'Base', color: () => '#d8487f', width: 1 }, { name: 'Lagging', color: () => '#6f9a1a', width: 1, lag: true },
      { name: 'Leading A', color: () => C.up, width: 1, last: false }, { name: 'Leading B', color: () => C.down, width: 1, last: false }],
    fills: [{ a: 3, b: 4, mode: 'cloud' }], compute: (B, p) => ichimoku(B, p) },
  psar: { cat: 'trend', label: 'Parabolic SAR', alias: 'sar stop and reverse parabolic', short: p => `SAR ${p.start} ${p.inc} ${p.max}`,
    desc: 'Dots that trail the price and flip sides when the trend turns. Often used as a trailing stop.',
    params: [{ k: 'start', label: 'Start', def: 0.02, min: 0.001, max: 0.5, step: 0.001 }, { k: 'inc', label: 'Increment', def: 0.02, min: 0.001, max: 0.5, step: 0.001 },
      { k: 'max', label: 'Maximum', def: 0.2, min: 0.01, max: 1, step: 0.01 }], fmt: 'price',
    check: p => (p.start > p.max ? 'Start must not be bigger than the maximum' : ''),
    series: [{ kind: 'dots', color: L1 }], compute: (B, p) => [psar(B, p.start, p.inc, p.max)] },
  supertrend: { cat: 'trend', label: 'SuperTrend', alias: 'super trend atr', nocolor: true, short: p => `SuperTrend ${p.len} ${p.factor}`,
    desc: 'A line under the price in an uptrend (green) and above it in a downtrend (red), based on the average true range.',
    params: [{ k: 'len', label: 'ATR length', def: 10, min: 1, max: 100, step: 1 }, { k: 'factor', label: 'Factor', def: 3, min: 0.5, max: 10, step: 0.1 }], fmt: 'price',
    series: [{ name: 'Up', color: () => C.up, gaps: true }, { name: 'Down', color: () => C.down, gaps: true }], compute: (B, p) => supertrend(B, p.len, p.factor) },
  adx: { cat: 'trend', label: 'Average Directional Index (DMI)', alias: 'adx dmi directional movement +di -di', pane: true, short: p => `ADX ${p.len} ${p.smooth}`,
    desc: 'How strong the trend is (ADX), with +DI and −DI showing which side is winning. Above 25 is usually a strong trend.',
    params: [{ k: 'len', label: 'DI length', def: 14, min: 1, max: 100, step: 1 }, { k: 'smooth', label: 'ADX smoothing', def: 14, min: 1, max: 100, step: 1 }], fmt: 'fixed', levels: [25],
    series: [{ name: 'ADX', color: L1 }, { name: '+DI', color: () => C.up, width: 1 }, { name: '−DI', color: () => C.down, width: 1 }], compute: (B, p) => adx(B, p.len, p.smooth) },
  cci: { cat: 'osc', label: 'Commodity Channel Index', alias: 'cci', pane: true, short: p => `CCI ${p.len}`,
    desc: 'How far the price is from its average. Above +100 is stretched up, below −100 stretched down.',
    params: [{ k: 'len', label: 'Length', def: 20, min: 2, max: 200, step: 1 }], fmt: 'fixed', levels: [100, -100],
    series: [{ color: L1 }], compute: (B, p) => [cci(B, p.len)] },
  willr: { cat: 'osc', label: 'Williams %R', alias: 'williams r percent', pane: true, short: p => `%R ${p.len}`,
    desc: 'Where the close sits in the recent range, from 0 to −100. Above −20 is stretched up, below −80 stretched down.',
    params: [{ k: 'len', label: 'Length', def: 14, min: 2, max: 200, step: 1 }], fmt: 'fixed', levels: [-20, -80], range: [-100, 0],
    series: [{ color: L1 }], compute: (B, p) => [willr(B, p.len)] },
  stochrsi: { cat: 'osc', label: 'Stochastic RSI', alias: 'stoch rsi stochrsi', pane: true, short: p => `Stoch RSI ${p.k} ${p.d} ${p.rsi} ${p.stoch}`,
    desc: 'The Stochastic worked out on the RSI instead of the price, so it moves faster. Above 80 is stretched, below 20 washed out.',
    params: [{ k: 'k', label: '%K smoothing', def: 3, min: 1, max: 50, step: 1 }, { k: 'd', label: '%D smoothing', def: 3, min: 1, max: 50, step: 1 },
      { k: 'rsi', label: 'RSI length', def: 14, min: 2, max: 100, step: 1 }, { k: 'stoch', label: 'Stochastic length', def: 14, min: 2, max: 100, step: 1 }], fmt: 'fixed', levels: [80, 20], range: [0, 100],
    series: [{ name: '%K', color: L1 }, { name: '%D', color: SIG, width: 1 }], compute: (B, p) => stochrsi(B, p.rsi, p.stoch, p.k, p.d) },
  roc: { cat: 'osc', label: 'Rate of Change', alias: 'roc momentum percent', pane: true, short: p => `ROC ${p.len}`,
    desc: 'The percentage change from N bars ago. Above zero means the price is higher than it was.',
    params: [{ k: 'len', label: 'Length', def: 9, min: 1, max: 200, step: 1 }], fmt: 'fixed', levels: [0],
    series: [{ color: L1 }], compute: (B, p) => [roc(B, p.len)] },
  ao: { cat: 'osc', label: 'Awesome Oscillator', alias: 'ao bill williams', pane: true, nocolor: true, short: p => `AO ${p.fast} ${p.slow}`,
    desc: 'Momentum as bars: the gap between a 5 and 34 bar average of the midpoint. Green when rising, red when falling.',
    params: [{ k: 'fast', label: 'Fast length', def: 5, min: 1, max: 100, step: 1 }, { k: 'slow', label: 'Slow length', def: 34, min: 2, max: 300, step: 1 }], fmt: 'fine',
    check: p => (p.fast >= p.slow ? 'Fast length must be shorter than slow length' : ''),
    series: [{ kind: 'hist', rule: 'rise' }], compute: (B, p) => [ao(B, p.fast, p.slow)] },
  keltner: { cat: 'volatility', label: 'Keltner Channels', alias: 'keltner channel kc', short: p => `KC ${p.len} ${p.mult} ${p.atr}`,
    desc: 'An average with bands a multiple of the average true range away. Bands widen when the market gets busier.',
    params: [{ k: 'len', label: 'Length', def: 20, min: 1, max: 300, step: 1 }, { k: 'mult', label: 'Multiplier', def: 2, min: 0.5, max: 5, step: 0.1 }, { k: 'atr', label: 'ATR length', def: 10, min: 1, max: 100, step: 1 }], fmt: 'price',
    series: [{ name: 'Upper', color: L1, width: 1 }, { name: 'Basis', color: L1, width: 1, dashed: true }, { name: 'Lower', color: L1, width: 1 }],
    fills: [{ a: 0, b: 2, mode: 'band' }], compute: (B, p) => keltner(B, p.len, p.mult, p.atr) },
  donchian: { cat: 'volatility', label: 'Donchian Channels', alias: 'donchian channel dc breakout', short: p => `DC ${p.len}`,
    desc: 'The highest high and lowest low of the last N bars, with the midpoint. A close outside the channel is a breakout.',
    params: [{ k: 'len', label: 'Length', def: 20, min: 2, max: 300, step: 1 }], fmt: 'price',
    series: [{ name: 'Upper', color: L1, width: 1 }, { name: 'Basis', color: L1, width: 1, dashed: true }, { name: 'Lower', color: L1, width: 1 }],
    fills: [{ a: 0, b: 2, mode: 'band' }], compute: (B, p) => donchian(B, p.len) },
  obv: { cat: 'volume', label: 'On Balance Volume', alias: 'obv', pane: true, short: () => 'OBV',
    desc: 'A running total that adds volume on up bars and takes it away on down bars. Blank for markets without volume, such as forex.',
    params: [], fmt: 'vol', series: [{ color: L1 }], compute: B => [obv(B)] },
  mfi: { cat: 'volume', label: 'Money Flow Index', alias: 'mfi volume rsi', pane: true, short: p => `MFI ${p.len}`,
    desc: 'Like the RSI, but weighted by volume, from 0 to 100. Blank for markets without volume, such as forex.',
    params: [{ k: 'len', label: 'Length', def: 14, min: 2, max: 100, step: 1 }], fmt: 'fixed', levels: [80, 20], range: [0, 100],
    series: [{ color: L1 }], compute: (B, p) => [mfi(B, p.len)] },
  cmf: { cat: 'volume', label: 'Chaikin Money Flow', alias: 'cmf chaikin', pane: true, short: p => `CMF ${p.len}`,
    desc: 'Whether money is flowing in (above zero) or out (below zero) over N bars. Blank for markets without volume, such as forex.',
    params: [{ k: 'len', label: 'Length', def: 20, min: 2, max: 200, step: 1 }], fmt: 'fixed3', levels: [0],
    series: [{ color: L1 }], compute: (B, p) => [cmf(B, p.len)] },
});
const FMT_OF = { sma: 'price', ema: 'price', bb: 'price', vwap: 'price', atr: 'price', macd: 'fine' };
const indFmt = type => IND[type].fmt || FMT_OF[type] || '';
const specOf = (type, k) => (IND[type] && IND[type].series ? IND[type].series[k] : null);

// ----- the maths -----
function wma(a, n) {   // weights 1..n, newest heaviest; restarts after a gap
  const o = new Array(a.length).fill(null), den = (n * (n + 1)) / 2;
  let run = 0, sum = 0, wsum = 0;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v == null || !isFinite(v)) { run = 0; sum = 0; wsum = 0; continue; }
    if (run < n) { run++; wsum += run * v; sum += v; if (run === n) o[i] = wsum / den; }
    else { wsum = wsum + n * v - sum; sum = sum + v - a[i - n]; o[i] = wsum / den; }
  }
  return o;
}
function hma(a, n) {
  const half = wma(a, Math.max(1, Math.floor(n / 2))), full = wma(a, n);
  const diff = a.map((_, i) => (half[i] != null && full[i] != null ? 2 * half[i] - full[i] : null));
  return wma(diff, Math.max(1, Math.floor(Math.sqrt(n))));
}
function rma(a, n) {   // Wilder's smoothing, as TradingView's ta.rma; skips leading gaps
  const o = new Array(a.length).fill(null); let prev = null, cnt = 0, sum = 0;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v == null || !isFinite(v)) { if (prev == null) { cnt = 0; sum = 0; } continue; }
    if (prev == null) { sum += v; cnt++; if (cnt === n) { prev = sum / n; o[i] = prev; } }
    else { prev = (prev * (n - 1) + v) / n; o[i] = prev; }
  }
  return o;
}
function rolling(a, n, max) {   // highest (or lowest) of the last n values, in one pass
  const o = new Array(a.length).fill(null), q = []; let head = 0;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    while (q.length > head && (max ? a[q[q.length - 1]] <= v : a[q[q.length - 1]] >= v)) q.pop();
    q.push(i);
    if (q[head] <= i - n) head++;
    if (i >= n - 1) o[i] = a[q[head]];
  }
  return o;
}
const highs = B => B.map(b => b.high), lows = B => B.map(b => b.low), closes = B => B.map(b => b.close);
const hasVolume = B => B.some(b => b.volume > 0);
function midOf(B, n) { const h = rolling(highs(B), n, true), l = rolling(lows(B), n, false); return h.map((v, i) => (v != null && l[i] != null ? (v + l[i]) / 2 : null)); }
function ichimoku(B, p) {
  const n = B.length, conv = midOf(B, p.conv), base = midOf(B, p.base), spanB = midOf(B, p.spanB), d = p.disp - 1;
  const spanA = conv.map((v, i) => (v != null && base[i] != null ? (v + base[i]) / 2 : null));
  const leadA = new Array(n).fill(null), leadB = new Array(n).fill(null), lag = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i - d >= 0) { leadA[i] = spanA[i - d]; leadB[i] = spanB[i - d]; }
    if (i + d < n) lag[i] = B[i + d].close;
  }
  return [conv, base, lag, leadA, leadB];
}
function psar(B, start, inc, max) {   // as TradingView's ta.sar
  const n = B.length, o = new Array(n).fill(null); if (n < 2) return o;
  let res = 0, ext = 0, af = start, below = true;
  for (let i = 1; i < n; i++) {
    const b = B[i]; let first = false;
    if (i === 1) {
      if (b.close > B[0].close) { below = true; ext = b.high; res = B[0].low; } else { below = false; ext = b.low; res = B[0].high; }
      first = true; af = start;
    }
    res += af * (ext - res);
    if (below) { if (res > b.low) { first = true; below = false; res = Math.max(b.high, ext); ext = b.low; af = start; } }
    else if (res < b.high) { first = true; below = true; res = Math.min(b.low, ext); ext = b.high; af = start; }
    if (!first) {
      if (below) { if (b.high > ext) { ext = b.high; af = Math.min(af + inc, max); } }
      else if (b.low < ext) { ext = b.low; af = Math.min(af + inc, max); }
    }
    if (below) { res = Math.min(res, B[i - 1].low); if (i > 1) res = Math.min(res, B[i - 2].low); }
    else { res = Math.max(res, B[i - 1].high); if (i > 1) res = Math.max(res, B[i - 2].high); }
    o[i] = res;
  }
  return o;
}
function supertrend(B, len, factor) {   // as TradingView's ta.supertrend
  const n = B.length, a = atr(B, len), upL = new Array(n).fill(null), dnL = new Array(n).fill(null);
  let pu = null, pl = null, pst = null;
  for (let i = 0; i < n; i++) {
    if (a[i] == null) continue;
    const b = B[i], hl2 = (b.high + b.low) / 2;
    let ub = hl2 + factor * a[i], lb = hl2 - factor * a[i];
    if (pu != null) { const pc = B[i - 1].close; lb = lb > pl || pc < pl ? lb : pl; ub = ub < pu || pc > pu ? ub : pu; }
    const isUp = pst == null ? false : pst === pu ? b.close > ub : !(b.close < lb);
    const st = isUp ? lb : ub;
    if (isUp) upL[i] = st; else dnL[i] = st;
    pu = ub; pl = lb; pst = st;
  }
  return [upL, dnL];
}
function adx(B, len, smooth) {
  const n = B.length, pdm = new Array(n).fill(null), mdm = new Array(n).fill(null), tr = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    const b = B[i], p = B[i - 1], upM = b.high - p.high, dnM = p.low - b.low;
    pdm[i] = upM > dnM && upM > 0 ? upM : 0; mdm[i] = dnM > upM && dnM > 0 ? dnM : 0;
    tr[i] = Math.max(b.high - b.low, Math.abs(b.high - p.close), Math.abs(b.low - p.close));
  }
  const str = rma(tr, len), sp = rma(pdm, len), sm = rma(mdm, len);
  const pdi = str.map((t, i) => (t ? (100 * sp[i]) / t : null)), mdi = str.map((t, i) => (t ? (100 * sm[i]) / t : null));
  const dx = pdi.map((v, i) => (v == null || mdi[i] == null ? null : v + mdi[i] === 0 ? 0 : (100 * Math.abs(v - mdi[i])) / (v + mdi[i])));
  return [rma(dx, smooth), pdi, mdi];
}
function cci(B, len) {
  const tp = B.map(b => (b.high + b.low + b.close) / 3), ma = sma(tp, len), o = new Array(B.length).fill(null);
  for (let i = len - 1; i < B.length; i++) {
    let md = 0; for (let j = i - len + 1; j <= i; j++) md += Math.abs(tp[j] - ma[i]);
    md /= len; o[i] = md ? (tp[i] - ma[i]) / (0.015 * md) : 0;
  }
  return o;
}
function willr(B, len) {
  const h = rolling(highs(B), len, true), l = rolling(lows(B), len, false);
  return B.map((b, i) => (h[i] == null ? null : h[i] === l[i] ? -50 : ((h[i] - b.close) / (h[i] - l[i])) * -100));
}
function stochrsi(B, rsiLen, stLen, kLen, dLen) {
  const r = rsi(closes(B), rsiLen), st = new Array(B.length).fill(null);
  for (let i = 0; i < r.length; i++) {
    if (i < stLen - 1) continue;
    let hi = -Infinity, lo = Infinity, ok = true;
    for (let j = i - stLen + 1; j <= i; j++) { const v = r[j]; if (v == null) { ok = false; break; } if (v > hi) hi = v; if (v < lo) lo = v; }
    if (ok) st[i] = hi === lo ? 50 : ((r[i] - lo) / (hi - lo)) * 100;
  }
  const k = smaN(st, kLen);
  return [k, smaN(k, dLen)];
}
function roc(B, len) { return B.map((b, i) => (i >= len && B[i - len].close ? (100 * (b.close - B[i - len].close)) / B[i - len].close : null)); }
function ao(B, fast, slow) {
  const m = B.map(b => (b.high + b.low) / 2), f = sma(m, fast), s = sma(m, slow);
  return m.map((_, i) => (f[i] != null && s[i] != null ? f[i] - s[i] : null));
}
function keltner(B, len, mult, atrLen) {
  const basis = ema(closes(B), len), a = atr(B, atrLen);
  return [basis.map((v, i) => (v != null && a[i] != null ? v + mult * a[i] : null)), basis, basis.map((v, i) => (v != null && a[i] != null ? v - mult * a[i] : null))];
}
function donchian(B, len) {
  const h = rolling(highs(B), len, true), l = rolling(lows(B), len, false);
  return [h, h.map((v, i) => (v != null ? (v + l[i]) / 2 : null)), l];
}
function obv(B) {
  const o = new Array(B.length).fill(null); if (!hasVolume(B) || !B.length) return o;
  let t = 0; o[0] = 0;
  for (let i = 1; i < B.length; i++) { const c = B[i].close, p = B[i - 1].close, v = B[i].volume || 0; t += c > p ? v : c < p ? -v : 0; o[i] = t; }
  return o;
}
function mfi(B, len) {
  const n = B.length, o = new Array(n).fill(null); if (!hasVolume(B)) return o;
  const tp = B.map(b => (b.high + b.low + b.close) / 3), pos = new Array(n).fill(0), neg = new Array(n).fill(0);
  for (let i = 1; i < n; i++) { const f = tp[i] * (B[i].volume || 0); if (tp[i] > tp[i - 1]) pos[i] = f; else if (tp[i] < tp[i - 1]) neg[i] = f; }
  let ps = 0, ns = 0;
  for (let i = 1; i < n; i++) {
    ps += pos[i]; ns += neg[i];
    if (i > len) { ps -= pos[i - len]; ns -= neg[i - len]; }
    if (i >= len) o[i] = ns === 0 ? (ps === 0 ? 50 : 100) : 100 - 100 / (1 + ps / ns);
  }
  return o;
}
function cmf(B, len) {
  const n = B.length, o = new Array(n).fill(null); if (!hasVolume(B)) return o;
  let mv = 0, vv = 0;
  const mfv = B.map(b => (b.high === b.low ? 0 : ((b.close - b.low - (b.high - b.close)) / (b.high - b.low)) * (b.volume || 0)));
  for (let i = 0; i < n; i++) {
    mv += mfv[i]; vv += B[i].volume || 0;
    if (i >= len) { mv -= mfv[i - len]; vv -= B[i - len].volume || 0; }
    if (i >= len - 1) o[i] = vv > 0 ? mv / vv : null;
  }
  return o;
}

// ----- shaded areas between two lines (Bollinger, Keltner and Donchian bands, the Ichimoku cloud) -----
// A small custom series for the chart library, so the shading sits behind the candles on any chart.
class BandFill {
  constructor() { this.d = null; this.o = null; const self = this; this.r = { draw: (t, toY) => self.draw(t, toY) }; }
  renderer() { return this.r; }
  update(data, options) { this.d = data; this.o = options; }
  priceValueBuilder(row) { return [row.a, row.b]; }
  isWhitespace(row) { return row.a === undefined || row.b === undefined; }
  defaultOptions() { return { upColor: 'rgba(38,184,146,0.12)', downColor: 'rgba(240,82,104,0.12)' }; }
  draw(target, toY) {
    const d = this.d, o = this.o; if (!d || !d.bars.length || !d.visibleRange) return;
    target.useBitmapCoordinateSpace(scope => {
      const g = scope.context, hr = scope.horizontalPixelRatio, vr = scope.verticalPixelRatio;
      const from = Math.max(0, d.visibleRange.from - 1), to = Math.min(d.bars.length, d.visibleRange.to + 2);
      let run = [], runUp = null;
      const flush = () => {
        if (run.length > 1) {
          g.beginPath(); g.moveTo(run[0][0], run[0][1]);
          for (let i = 1; i < run.length; i++) g.lineTo(run[i][0], run[i][1]);
          for (let i = run.length - 1; i >= 0; i--) g.lineTo(run[i][0], run[i][2]);
          g.closePath(); g.fillStyle = runUp ? o.upColor : o.downColor; g.fill();
        }
        run = [];
      };
      let prev = null;
      for (let i = from; i < to; i++) {
        const bar = d.bars[i], v = bar.originalData;
        if (!v || v.a === undefined || v.b === undefined) { flush(); prev = null; continue; }
        const ya = toY(v.a), yb = toY(v.b); if (ya == null || yb == null) { flush(); prev = null; continue; }
        const pt = [bar.x * hr, ya * vr, yb * vr], up = v.a >= v.b;
        if (prev && up !== runUp) {   // the lines cross: close this shade where they meet and start the next there
          const d0 = prev[1] - prev[2], d1 = pt[1] - pt[2], t = d0 / (d0 - d1 || 1), x = prev[0] + t * (pt[0] - prev[0]), y = prev[1] + t * (pt[1] - prev[1]);
          run.push([x, y, y]); flush(); run.push([x, y, y]);
        }
        runUp = up; run.push(pt); prev = pt;
      }
      flush();
    });
  }
}
function fillColors(inst, f) {
  if (f.mode === 'cloud') return { upColor: alpha(C.up, 0.13), downColor: alpha(C.down, 0.13) };
  const c = alpha(inst.color || C.draw, 0.07); return { upColor: c, downColor: c };
}
function fillData(f, out, bars) {
  const A = out[f.a] || [], Bv = out[f.b] || [], d = [];
  for (let i = 0; i < bars.length; i++) { const a = A[i], b = Bv[i]; if (a != null && b != null && isFinite(a) && isFinite(b)) d.push({ time: bars[i].time, a, b }); }
  return d;
}
function histUp(type, out, k, i) {
  const sp = specOf(type, k), v = out[k][i];
  if (sp && sp.rule === 'rise') { const p = out[k][i - 1]; return p == null || v >= p; }
  return v >= 0;
}

function sma(a, n) { const o = new Array(a.length).fill(null); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; } return o; }
function ema(a, n) {
  const o = new Array(a.length).fill(null); const k = 2 / (n + 1); let prev = null, cnt = 0, sum = 0;
  for (let i = 0; i < a.length; i++) {
    const v = a[i]; if (v == null) continue;
    if (prev == null) { sum += v; cnt++; if (cnt === n) { prev = sum / n; o[i] = prev; } }
    else { prev = v * k + prev * (1 - k); o[i] = prev; }
  }
  return o;
}
function bbands(a, n, m) {
  const up = new Array(a.length).fill(null), mid = new Array(a.length).fill(null), lo = new Array(a.length).fill(null);
  let s = 0, ss = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i]; ss += a[i] * a[i];
    if (i >= n) { s -= a[i - n]; ss -= a[i - n] * a[i - n]; }
    if (i >= n - 1) { const mean = s / n; const sd = Math.sqrt(Math.max(0, ss / n - mean * mean)); mid[i] = mean; up[i] = mean + m * sd; lo[i] = mean - m * sd; }
  }
  return [up, mid, lo];
}
function rsi(a, n) {
  const o = new Array(a.length).fill(null); let g = 0, l = 0;
  for (let i = 1; i < a.length; i++) {
    const d = a[i] - a[i - 1], u = d > 0 ? d : 0, w = d < 0 ? -d : 0;
    if (i <= n) { g += u; l += w; if (i === n) { g /= n; l /= n; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } }
    else { g = (g * (n - 1) + u) / n; l = (l * (n - 1) + w) / n; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
  }
  return o;
}
function macd(a, f, s, sig) {
  const ef = ema(a, f), es = ema(a, s);
  const m = a.map((_, i) => (ef[i] != null && es[i] != null ? ef[i] - es[i] : null));
  const sg = ema(m, sig);
  const h = m.map((v, i) => (v != null && sg[i] != null ? v - sg[i] : null));
  return [h, m, sg];
}
function smaN(a, n) { // simple average that skips leading gaps
  const o = new Array(a.length).fill(null); let s = 0, c = 0;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v == null) { s = 0; c = 0; continue; }
    s += v; c++;
    if (c > n) { s -= a[i - n]; c = n; }
    if (c === n) o[i] = s / n;
  }
  return o;
}
function stoch(bars, n, sm, dn) {
  const raw = bars.map((b, i) => {
    if (i < n - 1) return null;
    let hh = -Infinity, ll = Infinity;
    for (let j = i - n + 1; j <= i; j++) { if (bars[j].high > hh) hh = bars[j].high; if (bars[j].low < ll) ll = bars[j].low; }
    return hh === ll ? 50 : ((b.close - ll) / (hh - ll)) * 100;
  });
  const k = sm > 1 ? smaN(raw, sm) : raw;
  return [k, smaN(k, dn)];
}
function atr(bars, n) {
  const o = new Array(bars.length).fill(null); let prev = null, sum = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], pc = i ? bars[i - 1].close : b.close;
    const tr = Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
    if (i < n) { sum += tr; if (i === n - 1) { prev = sum / n; o[i] = prev; } }
    else { prev = (prev * (n - 1) + tr) / n; o[i] = prev; }
  }
  return o;
}
function vwapKey(t, tf, sym) {
  const sec = tfOf(tf || S.tf).sec, d = new Date(t * 1000);
  if (sec >= WEEK) return d.getUTCFullYear();
  if (sec >= DAY) return d.getUTCFullYear() * 12 + d.getUTCMonth();
  if (classOf(sym || S.symbol) === 'stock') { const p = ny(t); return p.y * 10000 + p.m * 100 + p.d; }
  return Math.floor(t / DAY);
}
function vwap(bars, tf, sym) {
  const o = new Array(bars.length).fill(null); let key = null, pv = 0, vv = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], k = vwapKey(b.time, tf, sym);
    if (k !== key) { key = k; pv = 0; vv = 0; }
    const v = b.volume > 0 ? b.volume : 0;
    pv += ((b.high + b.low + b.close) / 3) * v; vv += v;
    o[i] = vv > 0 ? pv / vv : null;
  }
  return o;
}

function normInst(inst) {
  const def = IND[inst && inst.type]; if (!def) return null;
  const params = {};
  for (const p of def.params) { const v = Number(inst.params && inst.params[p.k]); params[p.k] = isFinite(v) ? clamp(v, p.min, p.max) : p.def; }
  const color = typeof inst.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(inst.color) ? inst.color : PALETTE[0];
  return { id: typeof inst.id === 'string' ? inst.id.slice(0, 20) : uid(), type: inst.type, params, color: def.nocolor ? null : color, hidden: !!inst.hidden };
}
function seriesColor(rt, k) {
  const c = rt.inst.color, sp = specOf(rt.inst.type, k);
  if (sp) return sp.kind === 'hist' ? C.muted : sp.color ? sp.color(c) : c;
  if (rt.inst.type === 'macd') return k === 1 ? c : k === 2 ? (c === SIGNAL ? '#d8487f' : SIGNAL) : C.muted;
  if (rt.inst.type === 'stoch') return k === 0 ? c : (c === SIGNAL ? '#d8487f' : SIGNAL);
  if (rt.inst.type === 'vol') return C.muted;
  return c;
}
// The series an indicator draws with, on any chart (the live chart or an idea's chart).
function indSeries(ch, inst, prec, paneIdx) {
  const rt = { series: [], lines: [] };
  const base = { priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false, visible: !inst.hidden };
  const pf = pricePF(prec);
  const chart = ch;
  switch (inst.type) {
    case 'sma': case 'ema':
      rt.series.push(chart.addSeries(LineSeries, Object.assign({}, base, { color: inst.color, lineWidth: 2, priceFormat: pf }), 0));
      break;
    case 'bb':
      rt.series.push(
        chart.addSeries(LineSeries, Object.assign({}, base, { color: inst.color, lineWidth: 1, priceFormat: pf }), 0),
        chart.addSeries(LineSeries, Object.assign({}, base, { color: inst.color, lineWidth: 1, lineStyle: LineStyle.Dashed, lastValueVisible: false, priceFormat: pf }), 0),
        chart.addSeries(LineSeries, Object.assign({}, base, { color: inst.color, lineWidth: 1, priceFormat: pf }), 0));
      break;
    case 'vwap':
      rt.series.push(chart.addSeries(LineSeries, Object.assign({}, base, { color: inst.color, lineWidth: 2, priceFormat: pf }), 0));
      break;
    case 'atr':
      rt.series.push(chart.addSeries(LineSeries, Object.assign({}, base, { color: inst.color, lineWidth: 2, priceFormat: pf }), paneIdx));
      break;
    case 'stoch': {
      const pf2 = { type: 'price', precision: 2, minMove: 0.01 }, range = () => ({ priceRange: { minValue: 0, maxValue: 100 } });
      const k = chart.addSeries(LineSeries, Object.assign({}, base, { color: inst.color, lineWidth: 2, priceFormat: pf2, autoscaleInfoProvider: range }), paneIdx);
      const d = chart.addSeries(LineSeries, Object.assign({}, base, { color: seriesColor({ inst }, 1), lineWidth: 1, priceFormat: pf2, autoscaleInfoProvider: range }), paneIdx);
      rt.lines.push(k.createPriceLine({ price: 80, color: C.faint, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false }));
      rt.lines.push(k.createPriceLine({ price: 20, color: C.faint, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false }));
      rt.series.push(k, d);
      break;
    }
    case 'vol': {
      const s = chart.addSeries(HistogramSeries, Object.assign({}, base, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false }), 0);
      s.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      rt.series.push(s);
      break;
    }
    case 'rsi': {
      const s = chart.addSeries(LineSeries, Object.assign({}, base, { color: inst.color, lineWidth: 2, priceFormat: { type: 'price', precision: 2, minMove: 0.01 }, autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) }), paneIdx);
      rt.lines.push(s.createPriceLine({ price: 70, color: C.faint, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false }));
      rt.lines.push(s.createPriceLine({ price: 30, color: C.faint, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false }));
      rt.series.push(s);
      break;
    }
    case 'macd': {
      const p2 = pricePF(Math.min(8, prec + 2));
      rt.series.push(
        chart.addSeries(HistogramSeries, Object.assign({}, base, { priceFormat: p2, lastValueVisible: false }), paneIdx),
        chart.addSeries(LineSeries, Object.assign({}, base, { color: seriesColor({ inst }, 1), lineWidth: 2, priceFormat: p2 }), paneIdx),
        chart.addSeries(LineSeries, Object.assign({}, base, { color: seriesColor({ inst }, 2), lineWidth: 1, priceFormat: p2 }), paneIdx));
      break;
    }
  }
  const def = IND[inst.type];
  if (def.series) {
    const f = def.fmt, fmt = f === 'price' ? pf : f === 'fine' ? pricePF(Math.min(8, prec + 2)) : f === 'vol' ? { type: 'volume' } : f === 'fixed3' ? { type: 'price', precision: 3, minMove: 0.001 } : { type: 'price', precision: 2, minMove: 0.01 };
    const range = def.range ? () => ({ priceRange: { minValue: def.range[0], maxValue: def.range[1] } }) : null;
    def.series.forEach((sp, k) => {
      const o = Object.assign({}, base, { priceFormat: fmt }, range ? { autoscaleInfoProvider: range } : {});
      if (sp.kind === 'hist') { rt.series.push(chart.addSeries(HistogramSeries, Object.assign(o, { lastValueVisible: false }), paneIdx)); return; }
      Object.assign(o, { color: seriesColor({ inst }, k), lineWidth: sp.width || 2, lineStyle: sp.dashed ? LineStyle.Dashed : LineStyle.Solid, lastValueVisible: sp.last !== false });
      if (sp.kind === 'dots') Object.assign(o, { lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 2 });
      rt.series.push(chart.addSeries(LineSeries, o, paneIdx));
    });
    (def.levels || []).forEach(v => rt.lines.push(rt.series[0].createPriceLine({ price: v, color: C.faint, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false })));
  }
  rt.fills = (def.fills || []).map(f => {
    const s = chart.addCustomSeries(new BandFill(), Object.assign({ priceLineVisible: false, lastValueVisible: false, visible: !inst.hidden, autoscaleInfoProvider: () => null }, fillColors(inst, f)), paneIdx);
    try { s.setSeriesOrder(0); } catch (e) { /* ordering is cosmetic */ }
    return Object.assign({ s }, f);
  });
  return rt;
}
function addRt(inst) {
  const def = IND[inst.type];
  const rt = Object.assign({ inst, out: null, vals: [] }, indSeries(chart, inst, S.prec, def.pane ? chart.panes().length : 0));
  makeLegendRow(rt);
  S.rts.push(rt);
  if (S.bars.length) setRtData(rt);
  if (inst.type === 'vol') { orderPane0(); S.main.priceScale().applyOptions({ scaleMargins: mainMargins() }); }
  if (def.pane) restretch();
  return rt;
}
function removeRt(rt) {
  rt.series.forEach(s => chart.removeSeries(s)); rt.fills.forEach(f => chart.removeSeries(f.s));
  rt.row.remove(); if (rt.paneLg) rt.paneLg.remove(); updateFold();
  S.rts.splice(S.rts.indexOf(rt), 1);
  if (rt.inst.type === 'vol') S.main.priceScale().applyOptions({ scaleMargins: mainMargins() });
  restretch(); saveInd(); markDirty();
}
const mainStretch = n => Math.max(3, (n - 1) * 0.8);   // the price pane keeps most of the room, even with many indicator panes
function restretch() { const ps = chart.panes(); ps.forEach((p, i) => { try { p.setStretchFactor(i === 0 ? mainStretch(ps.length) : 1); } catch (e) { /* older pane API */ } }); markDirty(); }
function saveInd() { S.ind = S.rts.map(r => r.inst); store.set('ind', S.ind); }

function indCompute(inst, bars, tf, sym) {
  if (IND[inst.type].compute) return IND[inst.type].compute(bars, inst.params, tf, sym);
  const p = inst.params; const cl = bars.map(b => b.close);
  switch (inst.type) {
    case 'sma': return [sma(cl, p.len)];
    case 'ema': return [ema(cl, p.len)];
    case 'bb': return bbands(cl, p.len, p.mult);
    case 'vwap': return [vwap(bars, tf, sym)];
    case 'stoch': return stoch(bars, p.k, p.smooth, p.d);
    case 'atr': return [atr(bars, p.len)];
    case 'vol': return [bars.map(b => b.volume)];
    case 'rsi': return [rsi(cl, p.len)];
    case 'macd': return macd(cl, p.fast, p.slow, p.signal);
  }
  return [];
}
function computeRt(rt) { rt.out = indCompute(rt.inst, S.bars); }
function indPoint(type, out, k, i, bars) {
  const v = out[k][i]; const t = bars[i].time;
  if (type === 'vol') { const b = bars[i]; return { time: t, value: v, color: alpha(b.close >= b.open ? C.up : C.down, 0.42) }; }
  const sp = specOf(type, k);
  if (sp && sp.kind === 'hist') return { time: t, value: v, color: alpha(histUp(type, out, k, i) ? C.up : C.down, 0.75) };
  if (type === 'macd' && k === 0) {
    const pv = out[0][i - 1];
    const strong = pv == null || (v >= 0 ? v >= pv : v <= pv);
    return { time: t, value: v, color: alpha(v >= 0 ? C.up : C.down, strong ? 0.8 : 0.38) };
  }
  return { time: t, value: v };
}
function rtPoint(rt, k, i) { return indPoint(rt.inst.type, rt.out, k, i, S.bars); }
function indData(type, out, k, bars) {   // a series' points; lines that switch on and off (SuperTrend) get gaps
  const arr = out[k] || [], gaps = (specOf(type, k) || {}).gaps, d = []; let on = false;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v != null && isFinite(v)) { d.push(indPoint(type, out, k, i, bars)); on = true; }
    else if (gaps && on) d.push({ time: bars[i].time });
  }
  return d;
}
function indApply(rt, out, bars) {
  rt.series.forEach((s, k) => s.setData(indData(rt.inst.type, out, k, bars)));
  (rt.fills || []).forEach(f => f.s.setData(fillData(f, out, bars)));
}
function setRtData(rt) { computeRt(rt); indApply(rt, rt.out, S.bars); }
function updateRtLast(rt) {
  computeRt(rt); const i = S.bars.length - 1, t = S.bars[i].time;
  rt.series.forEach((s, k) => {
    const arr = rt.out[k], v = arr[i], sp = specOf(rt.inst.type, k) || {};
    try {
      if (v != null && isFinite(v)) s.update(rtPoint(rt, k, i));
      else if (sp.gaps) s.update({ time: t });
      else if (sp.lag) { let j = i; while (j >= 0 && arr[j] == null) j--; if (j >= 0) s.update(rtPoint(rt, k, j)); }
    } catch (e) { /* the chart keeps the previous point */ }
  });
  rt.fills.forEach(f => { const a = rt.out[f.a][i], b = rt.out[f.b][i]; if (a != null && b != null) { try { f.s.update({ time: t, a, b }); } catch (e) { /* keep the previous point */ } } });
}
function recolorRt(rt) {
  const t = rt.inst.type;
  if (['sma', 'ema', 'bb', 'rsi', 'vwap', 'atr'].includes(t)) rt.series.forEach(s => s.applyOptions({ color: rt.inst.color }));
  if (t === 'stoch') { rt.series[0].applyOptions({ color: seriesColor(rt, 0) }); rt.series[1].applyOptions({ color: seriesColor(rt, 1) }); }
  if (t === 'macd') { rt.series[1].applyOptions({ color: seriesColor(rt, 1) }); rt.series[2].applyOptions({ color: seriesColor(rt, 2) }); }
  rt.lines.forEach(l => l.applyOptions({ color: C.faint }));
  if (t === 'vol' || t === 'macd') { if (S.bars.length) setRtData(rt); }
  recolorSpec(rt);
  rt.vals.forEach((v, k) => { v.style.color = seriesColor(rt, k); });
}
function recolorSpec(rt) {   // indicators drawn from a definition, on any chart
  const sp = IND[rt.inst.type].series;
  if (sp) sp.forEach((x, k) => { if (x.kind !== 'hist') rt.series[k].applyOptions({ color: seriesColor(rt, k) }); });
  (rt.fills || []).forEach(f => f.s.applyOptions(fillColors(rt.inst, f)));
  if (sp && sp.some(x => x.kind === 'hist') && S.rts.includes(rt) && S.bars.length) setRtData(rt);
}
function addIndicator(type) {
  const def = IND[type]; const used = S.rts.map(r => r.inst.color);
  const params = {}; def.params.forEach(p => { params[p.k] = p.def; });
  const inst = normInst({ type, params, color: PALETTE.find(c => !used.includes(c)) || PALETTE[S.rts.length % PALETTE.length] });
  addRt(inst); saveInd(); updateLegend(); markDirty();
  toast(`Added ${def.short(inst.params)}`);
}

/* ---------- legend ---------- */
const L = { title: $('#lgTitle'), ohlc: $('#ohlc'), o: $('#lgO'), h: $('#lgH'), l: $('#lgL'), c: $('#lgC'), chg: $('#lgChg'), rows: $('#lgRows') };
function makeLegendRow(rt) {
  const def = IND[rt.inst.type];
  const row = el('div', 'lg-row' + (rt.inst.hidden ? ' off' : ''));
  const nm = el('span', 'nm', def.short(rt.inst.params));
  const vals = el('span', 'vals');
  rt.vals = rt.series.map((_, k) => { const v = el('span', 'v', '—'); v.style.color = seriesColor(rt, k); vals.append(v); return v; });
  const ctl = el('span', 'lg-ctl');
  const eye = el('button'); eye.innerHTML = svg(rt.inst.hidden ? 'eyeOff' : 'eye'); eye.title = 'Show or hide'; eye.setAttribute('aria-label', `Show or hide ${def.short(rt.inst.params)}`);
  eye.onclick = () => { rt.inst.hidden = !rt.inst.hidden; rt.series.concat(rt.fills.map(f => f.s)).forEach(s => s.applyOptions({ visible: !rt.inst.hidden })); row.classList.toggle('off', rt.inst.hidden); eye.innerHTML = svg(rt.inst.hidden ? 'eyeOff' : 'eye'); saveInd(); };
  ctl.append(eye);
  if (def.params.length || !def.nocolor) {
    const gear = el('button'); gear.innerHTML = svg('gear'); gear.title = 'Settings'; gear.setAttribute('aria-label', `Settings for ${def.short(rt.inst.params)}`);
    gear.onclick = () => openSettings(rt); ctl.append(gear);
  }
  const rm = el('button'); rm.innerHTML = svg('x'); rm.title = 'Remove'; rm.setAttribute('aria-label', `Remove ${def.short(rt.inst.params)}`);
  rm.onclick = () => removeRt(rt); ctl.append(rm);
  row.append(nm, vals, ctl);
  rt.row = row; rt.nm = nm;
  if (def.pane) { rt.paneLg = el('div', 'pane-lg'); rt.paneLg.append(row); wrap.append(rt.paneLg); }
  else { L.rows.append(row); updateFold(); }
}
// Lots of indicators: the legend stays inside the price pane and can be folded away, like TradingView's.
function updateFold() {
  const b = $('#lgFold'), n = L.rows.children.length, open = !store.get('lgFold', false);
  b.hidden = n < 2; L.rows.classList.toggle('folded', !open || n < 1);
  if (n < 2) L.rows.classList.remove('folded');
  b.setAttribute('aria-expanded', String(open));
  b.lastChild.textContent = open ? '' : `${n} indicators`;
  b.title = open ? 'Hide the indicator list' : 'Show the indicator list';
  b.setAttribute('aria-label', b.title);
  markDirty();
}
$('#lgFold').onclick = () => { store.raw('lgFold', !store.get('lgFold', false)); updateFold(); };
function fmtInd(rt, k, v) {
  const t = rt.inst.type, f = indFmt(t);
  if (t === 'vol') return v ? fmtVol(v) : '—';
  if (f === 'vol') return fmtVol(v);
  if (t === 'rsi' || t === 'stoch' || f === 'fixed') return v.toFixed(2);
  if (f === 'fixed3') return v.toFixed(3);
  if (f === 'fine') return fmtP(v, Math.min(8, S.prec + 2));
  return fmtP(v);
}
function updateLegend() {
  const n = S.bars.length; if (!n) return;
  const i = S.cross && S.cross.idx >= 0 ? S.cross.idx : n - 1;
  const b = S.type === 'heikin' && S.ha[i] ? S.ha[i] : S.bars[i]; if (!b) return;
  const pb = S.type === 'heikin' ? S.ha[i - 1] : S.bars[i - 1];
  const ref = pb ? pb.close : b.open; const ch = b.close - ref; const pct = (ch / ref) * 100;
  L.ohlc.className = 'ohlc ' + (b.close >= b.open ? 'up' : 'down');
  L.o.textContent = fmtP(b.open); L.h.textContent = fmtP(b.high); L.l.textContent = fmtP(b.low); L.c.textContent = fmtP(b.close);
  L.chg.textContent = `${fmtSigned(ch)} (${fmtPct(pct)})`; L.chg.className = 'lg-chg ' + (ch >= 0 ? 'up' : 'down');
  for (const rt of S.rts) {
    rt.vals.forEach((v, k) => {
      const arr = rt.out && rt.out[k]; const x = arr ? arr[i] : null;
      v.textContent = x == null || !isFinite(x) ? '—' : fmtInd(rt, k, x);
      if (rt.inst.type === 'vol') v.style.color = S.bars[i].close >= S.bars[i].open ? C.up : C.down;
      if (rt.inst.type === 'macd' && k === 0 && x != null) v.style.color = x >= 0 ? C.up : C.down;
      if (x != null && (specOf(rt.inst.type, k) || {}).kind === 'hist') v.style.color = histUp(rt.inst.type, rt.out, k, i) ? C.up : C.down;
    });
  }
}
function placePaneLegends() {
  const panes = chart.panes(); const wr = wrap.getBoundingClientRect();
  try { L.rows.style.maxHeight = Math.max(44, panes[0].getHeight() - L.rows.offsetTop - 40) + 'px'; } catch (e) { /* keep the CSS default */ }
  for (const rt of S.rts) {
    if (!rt.paneLg) continue;
    const idx = panes.findIndex(p => p.getSeries().includes(rt.series[0]));
    const node = idx >= 0 && panes[idx].getHTMLElement ? panes[idx].getHTMLElement() : null;
    if (!node) continue;
    rt.paneLg.style.top = (node.getBoundingClientRect().top - wr.top + 4) + 'px';
  }
}
const SRC_NAME = { binance: 'Binance', td: 'Twelve Data', demo: 'Saved price', paxg: 'via PAXG', metal: 'gold-api.com', oanda: 'OANDA', kraken: 'Kraken' };
function setTitle() {
  const src = S.ready ? srcOf(S.symbol) : null;
  L.title.innerHTML = '';
  L.title.append(document.createTextNode(label(S.symbol) + ' '));
  L.title.append(el('span', null, `· ${tfOf(S.tf).label}${src ? ' · ' + SRC_NAME[src] : ''}`));
  $('#symName').textContent = label(S.symbol);
  $('#symEx').textContent = src ? SRC_NAME[src] : kindOf(S.symbol);
}

/* ---------- watermark ---------- */
let wm = null;
function updateWatermark() {
  const small = wrap.clientWidth < 620;
  const lines = [{ text: `${label(S.symbol)} · ${tfOf(S.tf).label}`, color: alpha(C.fg, 0.055), fontSize: small ? 28 : 46, fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontStyle: '' }];
  try {
    if (!wm) wm = createTextWatermark(chart.panes()[0], { horzAlign: 'center', vertAlign: 'center', lines });
    else wm.applyOptions({ lines });
  } catch (e) { /* watermark is decorative */ }
}

/* ---------- coordinate mapping for drawings ---------- */
function mapper() { return S.main && S.bars.length >= 2 ? mapperFor(chart, S.main, S.bars, tfOf(S.tf).sec) : null; }
function mapperFor(ch, s, T, step) {   // time and price <-> pixels on a chart, for drawings
  if (!s || T.length < 2) return null;
  const ts = ch.timeScale(); const vr = ts.getVisibleLogicalRange(); if (!vr) return null;
  const L0 = Math.floor(vr.from); const x0 = ts.logicalToCoordinate(L0); const x1 = ts.logicalToCoordinate(L0 + 20);
  if (x0 == null) return null;
  let sp = x1 != null ? (x1 - x0) / 20 : ts.options().barSpacing;
  if (!isFinite(sp) || sp <= 0) sp = ts.options().barSpacing || 6;
  const n = T.length;
  const tToL = t => {
    if (t <= T[0].time) return (t - T[0].time) / step;
    if (t >= T[n - 1].time) return n - 1 + (t - T[n - 1].time) / step;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T[mid].time <= t) lo = mid; else hi = mid; }
    return lo + (t - T[lo].time) / (T[hi].time - T[lo].time);
  };
  const LToT = Lg => {
    if (Lg <= 0) return T[0].time + Lg * step;
    if (Lg >= n - 1) return T[n - 1].time + (Lg - (n - 1)) * step;
    const i = Math.floor(Lg); return T[i].time + (Lg - i) * (T[i + 1].time - T[i].time);
  };
  return {
    sp,
    L: x => L0 + (x - x0) / sp,
    x: t => x0 + (tToL(t) - L0) * sp,
    t: x => LToT(L0 + (x - x0) / sp),
    y: p => s.priceToCoordinate(p),
    p: y => s.coordinateToPrice(y),
  };
}
function pointAt(x, y, snap) {
  const m = mapper(); if (!m) return null;
  let p = m.p(y); let t = m.t(x);
  if (p == null) return null;
  if (snap && S.magnet) {
    const i = Math.round(m.L(x)); const b = S.bars[i];
    if (b) {
      let best = null, bd = 18;
      for (const v of [b.open, b.high, b.low, b.close]) { const yy = m.y(v); if (yy == null) continue; const d = Math.abs(yy - y); if (d < bd) { bd = d; best = v; } }
      if (best != null) { p = best; t = b.time; }
    }
  }
  return { t, p };
}

/* ---------- drawing overlay ---------- */
const ov = $('#overlay'); let octx = ov.getContext('2d'); const wmBrand = $('#wmBrand');
function withCtx(ctx, prec, fn) {   // paint with the drawing code on another canvas, at another price precision
  const o = octx, p = S.prec; octx = ctx; S.prec = prec;
  try { fn(); } finally { octx = o; S.prec = p; }
}
let dpr = 1, ovW = 0, ovH = 0, dirty = true, lastSig = '';
function markDirty() { dirty = true; }
function sizeOverlay() {
  const r = wrap.getBoundingClientRect(); dpr = window.devicePixelRatio || 1; ovW = r.width; ovH = r.height;
  ov.width = Math.max(1, Math.round(ovW * dpr)); ov.height = Math.max(1, Math.round(ovH * dpr));
  ov.style.width = ovW + 'px'; ov.style.height = ovH + 'px'; dirty = true;
}
new ResizeObserver(() => { sizeOverlay(); updateWatermark(); }).observe(wrap);
const curDrawings = () => (S.drawings[S.symbol] = S.drawings[S.symbol] || []);
const findDrawing = id => curDrawings().find(d => d.id === id);
const FIB = [[0, null], [0.236, '#e2494f'], [0.382, '#e8902e'], [0.5, '#3aa76d'], [0.618, '#13a3b8'], [0.786, '#3f7fe6'], [1, null]];
const TOOL_NAMES = { trend: 'Trend line', ray: 'Ray', hline: 'Horizontal line', rect: 'Rectangle', fib: 'Fib retracement', long: 'Long position', short: 'Short position' };
const isPos = d => d && (d.type === 'long' || d.type === 'short');

function rr(x, y, w, h, r) { octx.beginPath(); if (octx.roundRect) octx.roundRect(x, y, w, h, r); else octx.rect(x, y, w, h); }
function seg(x1, y1, x2, y2) { octx.beginPath(); octx.moveTo(x1, y1); octx.lineTo(x2, y2); octx.stroke(); }
function handle(x, y, col) { octx.beginPath(); octx.arc(x, y, 4.5, 0, Math.PI * 2); octx.fillStyle = C.panel; octx.fill(); octx.lineWidth = 2; octx.strokeStyle = col; octx.stroke(); }
function arrowHead(x1, y1, x2, y2) {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6;
  octx.beginPath(); octx.moveTo(x2, y2); octx.lineTo(x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45));
  octx.moveTo(x2, y2); octx.lineTo(x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45)); octx.stroke();
}
function priceTag(W, y, price, col) {
  const txt = fmtP(price); octx.font = `500 11px ${FONT_DATA}`;
  const w = octx.measureText(txt).width + 10;
  octx.fillStyle = col; rr(W - w - 3, y - 9, w, 18, 3); octx.fill();
  octx.fillStyle = C.panel; octx.textBaseline = 'middle'; octx.fillText(txt, W - w + 2, y + 0.5);
}
function drawShape(d, m, W, H, sel, draft) {
  const col = d.color || C.draw;
  const x1 = m.x(d.p1.t), y1 = m.y(d.p1.p);
  if (y1 == null) return;
  const x2 = d.p2 ? m.x(d.p2.t) : null, y2 = d.p2 ? m.y(d.p2.p) : null;
  if (d.p2 && y2 == null) return;
  octx.lineWidth = 2; octx.strokeStyle = col; octx.setLineDash([]);
  switch (d.type) {
    case 'hline':
      seg(0, y1, W, y1); priceTag(W, y1, d.p1.p, col);
      if (sel) handle(clamp(x1, 12, W - 90), y1, col);
      break;
    case 'trend':
      seg(x1, y1, x2, y2);
      if (sel || draft) { handle(x1, y1, col); handle(x2, y2, col); }
      break;
    case 'ray': {
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      seg(x1, y1, x1 + ((x2 - x1) / len) * 1e4, y1 + ((y2 - y1) / len) * 1e4);
      if (sel || draft) { handle(x1, y1, col); handle(x2, y2, col); }
      break;
    }
    case 'rect': {
      const x = Math.min(x1, x2), y = Math.min(y1, y2), w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
      octx.fillStyle = alpha(col, 0.12); octx.fillRect(x, y, w, h);
      octx.lineWidth = 1.5; octx.strokeRect(x, y, w, h);
      if (sel || draft) { handle(x1, y1, col); handle(x2, y2, col); }
      break;
    }
    case 'long': case 'short':
      drawPosition(d, m, W, sel, draft);
      break;
    case 'fib': {
      const xa = Math.min(x1, x2), xb = Math.max(x1, x2);
      let prevY = null;
      octx.font = `500 11px ${FONT_DATA}`; octx.textBaseline = 'bottom';
      FIB.forEach(([lv, lc]) => {
        const price = d.p2.p + (d.p1.p - d.p2.p) * lv; const y = m.y(price); if (y == null) return;
        const c = lc || C.faint;
        if (prevY != null) { octx.fillStyle = alpha(c, 0.07); octx.fillRect(xa, Math.min(prevY, y), xb - xa, Math.abs(y - prevY)); }
        octx.strokeStyle = c; octx.lineWidth = 1.2; seg(xa, y, xb, y);
        octx.fillStyle = c; octx.fillText(`${lv} (${fmtP(price)})`, xa + 4, y - 2);
        prevY = y;
      });
      octx.strokeStyle = alpha(col, 0.7); octx.lineWidth = 1; octx.setLineDash([4, 4]); seg(x1, y1, x2, y2); octx.setLineDash([]);
      if (sel || draft) { handle(x1, y1, col); handle(x2, y2, col); }
      break;
    }
  }
}
function drawMeasure(d, m) {
  const x1 = m.x(d.p1.t), y1 = m.y(d.p1.p), x2 = m.x(d.p2.t), y2 = m.y(d.p2.p);
  if (y1 == null || y2 == null) return;
  const dp = d.p2.p - d.p1.p, pct = (dp / d.p1.p) * 100, up = dp >= 0, col = up ? C.up : C.down;
  const bars = Math.round(m.L(x2) - m.L(x1)), dt = d.p2.t - d.p1.t;
  octx.fillStyle = alpha(col, 0.14); octx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  octx.strokeStyle = col; octx.lineWidth = 1.3; octx.setLineDash([]);
  seg(mx, y1, mx, y2); if (Math.abs(y2 - y1) > 10) arrowHead(mx, y1, mx, y2);
  seg(x1, my, x2, my); if (Math.abs(x2 - x1) > 10) arrowHead(x1, my, x2, my);
  const lines = [`${fmtSigned(dp)} (${fmtPct(pct)})`, `${Math.abs(bars)} bars · ${fmtSpan(dt)}`];
  octx.font = `500 11.5px ${FONT_DATA}`;
  const w = Math.max(...lines.map(s => octx.measureText(s).width)) + 18, h = 40;
  const bx = mx - w / 2, by = up ? Math.min(y1, y2) - h - 6 : Math.max(y1, y2) + 6;
  octx.fillStyle = col; rr(bx, by, w, h, 5); octx.fill();
  octx.fillStyle = C.panel; octx.textBaseline = 'middle'; octx.textAlign = 'center';
  octx.fillText(lines[0], mx, by + 13); octx.fillText(lines[1], mx, by + 28);
  octx.textAlign = 'start';
}
// Long/short position: p1 = entry (price, start time), p2 = stop (price, end time), tp = target price.
// While drawing, the second point is the target if it is on the winning side, otherwise the stop (2:1 by default).
function posLevels(d) {
  const entry = d.p1.p;
  if (d.tp != null) return { entry, stop: d.p2.p, target: d.tp };
  const q = d.p2.p, good = d.type === 'long' ? q > entry : q < entry;
  if (q === entry) return { entry, stop: entry, target: entry };
  return good ? { entry, target: q, stop: entry - (q - entry) / 2 } : { entry, stop: q, target: entry + (entry - q) * 2 };
}
function posBox(d, m) {
  const lv = posLevels(d);
  const x1 = m.x(d.p1.t); let x2 = m.x(d.p2.t);
  if (d.tp == null && Math.abs(x2 - x1) < 12) x2 = x1 + 25 * m.sp;
  const yE = m.y(lv.entry), yS = m.y(lv.stop), yT = m.y(lv.target);
  if (yE == null || yS == null || yT == null) return null;
  return { lv, xa: Math.min(x1, x2), xb: Math.max(x1, x2), yE, yS, yT };
}
function pill(x, y, text, bg, align, W) {
  octx.font = `600 11px ${FONT_DATA}`;
  const w = octx.measureText(text).width + 12, h = 18;
  let bx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  if (W) bx = clamp(bx, 2, W - w - 2);
  octx.fillStyle = bg; rr(bx, y - h / 2, w, h, 4); octx.fill();
  octx.fillStyle = C.panel; octx.textBaseline = 'middle'; octx.textAlign = 'left';
  octx.fillText(text, bx + 6, y + 0.5);
  return w;
}
function drawPosition(d, m, W, sel, draft) {
  const b = posBox(d, m); if (!b) return;
  const { lv, xa, xb, yE, yS, yT } = b, w = Math.max(1, xb - xa);
  octx.setLineDash([]);
  octx.fillStyle = alpha(C.up, 0.16); octx.fillRect(xa, Math.min(yE, yT), w, Math.abs(yT - yE));
  octx.fillStyle = alpha(C.down, 0.16); octx.fillRect(xa, Math.min(yE, yS), w, Math.abs(yS - yE));
  octx.lineWidth = 1;
  octx.strokeStyle = alpha(C.up, 0.75); seg(xa, yT, xb, yT);
  octx.strokeStyle = alpha(C.down, 0.75); seg(xa, yS, xb, yS);
  octx.strokeStyle = C.muted; octx.lineWidth = 1.5; seg(xa, yE, xb, yE);
  const pct = p => fmtPct(((p - lv.entry) / lv.entry) * 100);
  const risk = Math.abs(lv.entry - lv.stop), reward = Math.abs(lv.target - lv.entry);
  const rr = risk > 0 ? (reward / risk).toFixed(2) : '—';
  const cx = (xa + xb) / 2;
  pill(cx, yT + (yT <= yE ? -12 : 12), `Target ${fmtP(lv.target)} (${pct(lv.target)})`, C.up, 'center', W);
  pill(cx, yS + (yS >= yE ? 12 : -12), `Stop ${fmtP(lv.stop)} (${pct(lv.stop)})`, C.down, 'center', W);
  const txt = `${d.type === 'long' ? 'Long' : 'Short'} ${fmtP(lv.entry)} · R:R ${rr}`;
  octx.font = `600 11px ${FONT_DATA}`;
  const tw = octx.measureText(txt).width + 12;
  if (xb + 8 + tw <= W) pill(xb + 8, yE, txt, C.muted, 'left', W); else pill(xa - 8, yE, txt, C.muted, 'right', W);
  if (sel || draft) { handle(xa, yT, C.up); handle(xa, yS, C.down); handle(xa, yE, C.muted); if (sel) handle(xb, yE, C.muted); }
}
function drawOverlay(m) {
  octx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.clearRect(0, 0, ovW, ovH);
  if (!m) return;
  let ps; try { ps = chart.paneSize(0); } catch (e) { return; }
  const W = ps.width, H = ps.height;
  octx.save(); octx.beginPath(); octx.rect(0, 0, W, H); octx.clip();
  if (S.idea && S.idea.symbol === S.symbol) drawIdeaLayer(m, W, H);
  for (const d of curDrawings()) drawShape(d, m, W, H, d.id === S.selected, false);
  if (S.draft && S.draft.type !== 'measure') drawShape(S.draft, m, W, H, false, true);
  const meas = S.draft && S.draft.type === 'measure' ? S.draft : S.measure;
  if (meas) drawMeasure(meas, m);
  Paper.draw(m, W, H);
  if (R.picking && R.hoverX != null && R.hoverX >= 0 && R.hoverX <= W) {
    const i = rpPickIndex(R.hoverX), x = i == null ? R.hoverX : m.x(S.bars[i].time) + m.sp / 2;
    octx.fillStyle = alpha(C.panel, 0.62); octx.fillRect(x, 0, W - x, H);
    octx.strokeStyle = C.accent; octx.lineWidth = 1.5; octx.setLineDash([5, 4]); seg(x, 0, x, H); octx.setLineDash([]);
  }
  octx.restore();
  drawBarTimer(m, W, H);
}
// Time left in the live bar, shown right under the live price on the price scale (like TradingView).
function barEnd() {
  if (!S.ready || R.on || !S.bars.length || srcOf(S.symbol) === 'demo') return null;
  const cls = classOf(S.symbol), now = Date.now() / 1000;
  if (!openNow(S.symbol) && !isOpenAt(cls, now)) return null;
  let end = S.bars[S.bars.length - 1].time + tfOf(S.tf).sec;
  if (cls === 'stock' && tfOf(S.tf).sec < DAY) { const p = ny(now); end = Math.min(end, sessOpen(p.y, p.m, p.d) + 23400); }
  return end;
}
function inkOn(hex) {   // dark or light text for a coloured label, the way the chart library picks it
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim()); if (!m) return '#fff';
  const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.199 * r + 0.687 * g + 0.114 * b > 160 ? '#000' : '#fff';
}
function drawBarTimer(m, W, H) {
  const end = barEnd(); if (end == null || !S.main) return;
  const pt = mainPoint(S.bars.length - 1); if (!pt) return;
  const price = pt.close != null ? pt.close : pt.value, y = m.y(price);
  if (y == null || y < 0 || y > H) return;
  const col = S.type === 'line' || S.type === 'area' ? C.draw : pt.close >= pt.open ? C.up : C.down;
  octx.font = `11px ${FONT_DATA}`;
  // same width as the chart's own price label just above, so the two read as one tag
  const x = W, w = TIMER.left + 1 + octx.measureText(price.toFixed(S.prec)).width + TIMER.right;
  const top = Math.round(y + TIMER.gap), h = TIMER.h;
  octx.fillStyle = col; octx.beginPath();
  if (octx.roundRect) octx.roundRect(x, top, w, h, [0, 0, 2, 2]); else octx.rect(x, top, w, h);
  octx.fill();
  octx.fillStyle = inkOn(col); octx.textBaseline = 'middle'; octx.textAlign = 'left';
  octx.fillText(fmtCountdown(end - Date.now() / 1000), x + TIMER.left, top + h / 2 + 0.5);
}
const TIMER = { gap: 8, h: 15, left: 8.5, right: 6 };
function frame() {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  const m = mapper();
  let sig = `${ovW}x${ovH}`;
  if (m) { const ref = S.bars[S.bars.length - 1].close; sig += `|${m.x(S.bars[0].time).toFixed(2)}|${m.sp.toFixed(4)}|${m.y(ref)}|${m.y(ref * 1.05)}`; }
  try { sig += '|' + chart.panes().map(p => p.getHeight()).join(','); } catch (e) { /* ignore */ }
  if (!dirty && sig === lastSig) return;
  lastSig = sig; dirty = false;
  drawOverlay(m); placePaneLegends();
  try { const b = (chart.timeScale().height() + 10) + 'px'; if (wmBrand.style.bottom !== b) wmBrand.style.bottom = b; } catch (e) { /* keep the CSS default */ }
}

function hitTest(x, y) {
  const m = mapper(); if (!m) return null;
  const ps = chart.paneSize(0); if (x > ps.width || y > ps.height) return null;
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
  const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };
  let best = null, bd = 7;
  const list = curDrawings();
  for (let k = list.length - 1; k >= 0; k--) {
    const d = list[k];
    if (isPos(d)) {
      const b = posBox(d, m); if (!b) continue;
      if (dist(x, y, b.xa, b.yT) < 9) return { d, part: 'tp' };
      if (dist(x, y, b.xa, b.yS) < 9) return { d, part: 'stop' };
      if (dist(x, y, b.xa, b.yE) < 9) return { d, part: 'entry' };
      if (dist(x, y, b.xb, b.yE) < 9) return { d, part: 'end' };
      if (bd > 0 && x >= b.xa - 4 && x <= b.xb + 4 && y >= Math.min(b.yS, b.yT) - 4 && y <= Math.max(b.yS, b.yT) + 4) { bd = 0; best = { d, part: 'body' }; }
      continue;
    }
    const x1 = m.x(d.p1.t), y1 = m.y(d.p1.p); if (y1 == null) continue;
    const x2 = d.p2 ? m.x(d.p2.t) : 0, y2 = d.p2 ? m.y(d.p2.p) : 0;
    if (d.p2) { if (dist(x, y, x1, y1) < 9) return { d, part: 'p1' }; if (dist(x, y, x2, y2) < 9) return { d, part: 'p2' }; }
    let dd = Infinity;
    if (d.type === 'hline') dd = Math.abs(y - y1);
    else if (d.type === 'trend') dd = segDist(x, y, x1, y1, x2, y2);
    else if (d.type === 'ray') { const len = Math.hypot(x2 - x1, y2 - y1) || 1; dd = segDist(x, y, x1, y1, x1 + ((x2 - x1) / len) * 1e4, y1 + ((y2 - y1) / len) * 1e4); }
    else if (d.type === 'rect' || d.type === 'fib') {
      if (x >= Math.min(x1, x2) - 4 && x <= Math.max(x1, x2) + 4 && y >= Math.min(y1, y2) - 4 && y <= Math.max(y1, y2) + 4) dd = 0;
    }
    if (dd < bd) { bd = dd; best = { d, part: 'body' }; }
  }
  return best;
}

/* ---------- drawing actions ---------- */
function saveDrawings() { store.set('drawings', S.drawings); }
function pushUndo() { const st = (S.undo[S.symbol] = S.undo[S.symbol] || []); st.push(JSON.stringify(curDrawings())); if (st.length > 60) st.shift(); }
function undo() {
  const st = S.undo[S.symbol];
  if (!st || !st.length) { toast('Nothing to undo'); return; }
  S.drawings[S.symbol] = JSON.parse(st.pop()); select(null); saveDrawings(); markDirty();
}
function addDrawing(d) { pushUndo(); d.id = uid(); d.color = null; curDrawings().push(d); saveDrawings(); select(d.id); }
function deleteSelected() {
  if (!S.selected) return;
  pushUndo(); S.drawings[S.symbol] = curDrawings().filter(d => d.id !== S.selected); saveDrawings(); select(null);
}
const SEL_COLORS = [null, '#d4891c', '#e2494f', '#3aa76d', '#9b5de5', '#13a3b8'];
function select(id) {
  S.selected = id;
  const bar = $('#selbar');
  const d = id ? findDrawing(id) : null;
  if (!d) { S.selected = null; bar.hidden = true; markDirty(); return; }
  bar.hidden = false; $('#hint').hidden = true;
  $('#selName').textContent = TOOL_NAMES[d.type] || 'Drawing';
  $('#selJournal').hidden = !isPos(d);
  const sw = $('#selSw'); sw.replaceChildren(); sw.hidden = isPos(d);
  for (const c of SEL_COLORS) {
    const b = el('button', 'sw'); b.style.background = c || C.draw;
    b.setAttribute('aria-label', c ? `Colour ${c}` : 'Default colour'); b.setAttribute('aria-pressed', String((d.color || null) === c));
    b.onclick = () => { pushUndo(); d.color = c; saveDrawings(); select(d.id); };
    sw.append(b);
  }
  markDirty();
}
$('#selDel').onclick = deleteSelected;

const HINTS = {
  trend: ['Click where the line starts', 'Click where the line ends'],
  ray: ['Click where the ray starts', 'Click a second point to aim it'],
  hline: ['Click a price level'],
  rect: ['Click one corner', 'Click the opposite corner'],
  fib: ['Click the swing start (level 1)', 'Click the swing end (level 0)'],
  measure: ['Click where to measure from', 'Click where to measure to'],
  alert: ['Click a price to set an alert'],
  long: ['Click your entry price', 'Click your target (higher) or stop (lower)'],
  short: ['Click your entry price', 'Click your target (lower) or stop (higher)'],
};
function setHint() {
  const h = HINTS[S.tool]; const box = $('#hint');
  if (R.picking) { $('#hintText').textContent = 'Click the bar to start the replay from'; box.hidden = false; $('#selbar').hidden = true; return; }
  if (!h) { box.hidden = true; return; }
  $('#hintText').textContent = h[S.draft ? 1 : 0] || h[0];
  box.hidden = false; $('#selbar').hidden = true;
}
function setTool(t) {
  if (R.picking) { R.picking = false; R.hoverX = null; renderReplay(); }
  if (t === S.tool && t !== 'cursor') t = 'cursor';
  S.tool = t; S.draft = null;
  if (t !== 'cursor') select(null);
  renderToolState(); setHint(); markDirty();
}
function finishTool() { S.tool = 'cursor'; S.draft = null; renderToolState(); setHint(); markDirty(); }

// Placement clicks come from our own pointer events (the chart library ignores a second
// click within 500 ms) and from the library's tap event on touch; duplicates are dropped.
let lastPlace = { t: 0, x: -99, y: -99 };
function placeAt(x, y) {
  let ps; try { ps = chart.paneSize(0); } catch (e) { return; }
  if (x < 0 || y < 0 || x > ps.width || y > ps.height) return;
  const now = performance.now();
  if (now - lastPlace.t < 350 && Math.hypot(x - lastPlace.x, y - lastPlace.y) < 8) return;
  lastPlace = { t: now, x, y };
  if (R.picking) { rpPickAt(x); return; }
  if (S.tool === 'cursor') { if (S.measure) { S.measure = null; markDirty(); } return; }
  const pt = pointAt(x, y, true); if (!pt) return;
  const t = S.tool;
  if (t === 'hline') { addDrawing({ type: 'hline', p1: pt }); finishTool(); return; }
  if (t === 'alert') { const ap = pointAt(x, y, false); if (ap) createAlert(S.symbol, ap.p); finishTool(); return; }
  if (!S.draft) { S.draft = { type: t, p1: pt, p2: pt }; setHint(); markDirty(); return; }
  if (t === 'long' || t === 'short') {
    const p1 = S.draft.p1, m = mapper(), lv = posLevels({ type: t, p1, p2: pt });
    let t2 = pt.t;
    if (m && Math.abs(m.x(pt.t) - m.x(p1.t)) < 12) t2 = m.t(m.x(p1.t) + 25 * m.sp);
    S.draft = null; finishTool();
    if (lv.stop === lv.entry) { toast('Pick a price above or below your entry.'); return; }
    addDrawing({ type: t, p1, p2: { t: t2, p: lv.stop }, tp: lv.target });
    return;
  }
  const done = { type: t, p1: S.draft.p1, p2: pt };
  S.draft = null;
  if (t === 'measure') { S.measure = done; finishTool(); }
  else { addDrawing(done); finishTool(); }
}
chart.subscribeClick(param => {
  if (!param.point || (param.paneIndex || 0) !== 0) return;
  placeAt(param.point.x, param.point.y);
});
chart.subscribeCrosshairMove(param => {
  if (!param.point || param.time == null) S.cross = null;
  else S.cross = { idx: findIdx(param.time) };
  const onMain = param.point && (param.paneIndex || 0) === 0 && S.main;
  S.crossPrice = onMain ? S.main.coordinateToPrice(param.point.y) : null;
  if (S.draft && onMain) { const p = pointAt(param.point.x, param.point.y, true); if (p) { S.draft.p2 = p; markDirty(); } }
  if (R.picking) { R.hoverX = param.point ? param.point.x : null; markDirty(); }
  updateLegend();
});
function findIdx(t) {
  const T = S.bars; let lo = 0, hi = T.length - 1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (T[mid].time === t) return mid; if (T[mid].time < t) lo = mid + 1; else hi = mid - 1; }
  return -1;
}

/* drag existing drawings (cursor mode) */
let drag = null, press = null;
wrap.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  if (e.target.closest('.lg-row, .float, .latest, .veil')) return;
  const r = wrap.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
  press = { x, y, id: e.pointerId };
  if (Paper.pointerDown(e, x, y)) { press = null; return; }   // paper trading lines on the chart
  if (S.tool !== 'cursor' || S.draft || R.picking) return;
  const h = hitTest(x, y);
  if (!h) { if (S.selected) select(null); return; }
  press = null;
  e.stopPropagation(); e.preventDefault();
  select(h.d.id);
  drag = { id: h.d.id, part: h.part, sx: x, sy: y, orig: JSON.parse(JSON.stringify(h.d)), before: JSON.stringify(curDrawings()), moved: false };
}, true);
['mousedown', 'touchstart'].forEach(ev => wrap.addEventListener(ev, e => { if (drag) e.stopPropagation(); }, { capture: true, passive: true }));
window.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
window.addEventListener('pointermove', e => {
  if (!drag) return;
  const r = wrap.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
  const dx = x - drag.sx, dy = y - drag.sy; if (!drag.moved && Math.hypot(dx, dy) < 3) return;
  drag.moved = true;
  const d = findDrawing(drag.id); const m = mapper(); if (!d || !m) return;
  const o = drag.orig;
  if (drag.part === 'body') {
    const mv = pt => { const yy = m.y(pt.p); return { t: m.t(m.x(pt.t) + dx), p: yy == null ? pt.p : m.p(yy + dy) }; };
    d.p1 = mv(o.p1); if (o.p2) d.p2 = mv(o.p2);
    if (o.tp != null) { const yy = m.y(o.tp); d.tp = yy == null ? o.tp : m.p(yy + dy); }
  } else if (drag.part === 'p1' || drag.part === 'p2') {
    const p = pointAt(x, y, true); if (p) d[drag.part] = p;
  } else {
    const s = pointAt(x, y, true), p = s ? s.p : m.p(y); if (p == null) return;
    if (drag.part === 'tp') d.tp = p;
    else if (drag.part === 'stop') d.p2 = { t: d.p2.t, p };
    else if (drag.part === 'entry') d.p1 = { t: d.p1.t, p };
    else if (drag.part === 'end') { const t = m.t(x); if (d.p2.t >= d.p1.t) d.p2 = { t, p: d.p2.p }; else d.p1 = { t, p: d.p1.p }; }
  }
  markDirty();
});
window.addEventListener('pointerup', e => {
  if (press && e.pointerId === press.id) {
    const r = wrap.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (Math.hypot(x - press.x, y - press.y) < 6) placeAt(x, y);
    press = null;
  }
  if (!drag) return;
  if (drag.moved) { (S.undo[S.symbol] = S.undo[S.symbol] || []).push(drag.before); saveDrawings(); }
  drag = null;
});
window.addEventListener('pointercancel', () => { press = null; });

/* ---------- alerts ---------- */
let actx = null;
document.addEventListener('pointerdown', () => { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } } }, { capture: true, once: true });
function beep() {
  if (!actx) return;
  try {
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1175, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.45);
  } catch (e) { /* sound is optional */ }
}
// System notifications let alerts reach you while this tab is in the background (hosted site only).
function askNotify() {
  try {
    if (S.sandbox || !('Notification' in window) || Notification.permission !== 'default') return;
    const r = Notification.requestPermission(); if (r && r.catch) r.catch(() => {});
  } catch (e) { /* notifications unavailable */ }
}
function notify(title, body) {
  try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: 'icon-192.png' }); }
  catch (e) { /* some phones only allow notifications from installed apps */ }
}
function lastPrice(id) { const t = S.tickers[id]; if (t) return t.last; const a = R.on ? R.full : S.bars; if (id === S.symbol && a.length) return a[a.length - 1].close; return null; }
function createAlert(id, price) {
  const last = lastPrice(id);
  if (last == null || !isFinite(price) || price <= 0) { toast('Prices are still loading. Try again in a moment.'); return; }
  const dir = price >= last ? 'above' : 'below';
  const prec = precFor(id, last);
  price = Number(price.toFixed(prec));
  S.alerts.push({ id: uid(), sym: id, price, dir, at: Date.now(), hit: null });
  store.set('alerts', S.alerts); renderAlerts(); syncAlertLines(); ensureTickerSubs();
  toast(`Alert set: ${label(id)} crossing ${dir} ${fmtP(price, prec)}`);
  askNotify();
}
function checkAlerts(id, last) {
  let changed = false;
  for (const a of S.alerts) {
    if (a.sym !== id || a.hit) continue;
    if ((a.dir === 'above' && last >= a.price) || (a.dir === 'below' && last <= a.price)) {
      a.hit = Date.now(); changed = true;
      const msg = `${label(id)} crossed ${a.dir} ${fmtP(a.price, precFor(id, a.price))}`;
      toast(msg, 'alert'); beep(); notify(`${label(id)} price alert`, `${msg}. Last price ${fmtP(last, precFor(id, last))}.`);
    }
  }
  if (changed) { store.set('alerts', S.alerts); renderAlerts(); syncAlertLines(); }
}
function syncAlertLines() {
  if (!S.main) return;
  S.alertLines.forEach(l => { try { S.main.removePriceLine(l); } catch (e) { /* already gone */ } });
  S.alertLines = S.alerts.filter(a => a.sym === S.symbol && !a.hit).map(a => S.main.createPriceLine({ price: a.price, color: C.accent, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Alert' }));
}
function renderAlerts() {
  const list = $('#alList'); list.replaceChildren();
  const active = S.alerts.filter(a => !a.hit).length;
  $('#alCount').textContent = S.alerts.length ? String(active) : '';
  if (!S.alerts.length) { list.append(el('li', 'empty', 'No alerts yet. Add one below, or pick the bell tool and click the chart.')); return; }
  const items = S.alerts.slice().sort((a, b) => (!!a.hit - !!b.hit) || b.at - a.at);
  for (const a of items) {
    const li = el('li', 'al-item' + (a.hit ? ' hit' : ''));
    const txt = el('div');
    txt.append(el('div', 's', label(a.sym)), el('div', 'c', `Crosses ${a.dir} ${fmtP(a.price, precFor(a.sym, a.price))}`));
    const chip = el('span', 'chip' + (a.hit ? '' : ' live'), a.hit ? `Hit ${pad(new Date(a.hit).getHours())}:${pad(new Date(a.hit).getMinutes())}` : 'Active');
    const rm = el('button', 'wl-x'); rm.innerHTML = svg('x'); rm.style.opacity = 1; rm.setAttribute('aria-label', `Delete alert for ${label(a.sym)}`);
    rm.onclick = () => { S.alerts = S.alerts.filter(x => x.id !== a.id); store.set('alerts', S.alerts); renderAlerts(); syncAlertLines(); };
    li.append(txt, chip, rm); list.append(li);
  }
}
$('#alForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = parseFloat(String($('#alPrice').value).replace(/,/g, ''));
  if (!isFinite(v) || v <= 0) { toast('Enter a price, for example ' + fmtP(lastPrice(S.symbol) || 100)); $('#alPrice').focus(); return; }
  createAlert(S.symbol, v); $('#alPrice').value = '';
});

/* ---------- watchlist & details ---------- */
const wl = $('#wl');
const GROUPS = [['stock', 'Stocks'], ['fund', 'Funds'], ['futures', 'Futures'], ['forex', 'Forex'], ['crypto', 'Crypto'], ['index', 'Indices'], ['bond', 'Bonds']];
let wlFold = new Set(store.get('wlFold', []));   // sections someone has folded away
function renderWatch() {
  wl.replaceChildren();
  $('#wlCount').textContent = String(S.watch.length);
  for (const [cls, title] of GROUPS) {
    const ids = S.watch.filter(id => catOf(id) === cls); if (!ids.length) continue;
    const g = el('li', 'wl-group'); g.dataset.cls = cls;
    const open = !wlFold.has(cls);
    const h = el('button', 'wl-gh'); h.setAttribute('aria-expanded', String(open));
    h.title = open ? `Fold the ${title} section` : `Show the ${title} section`;
    h.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4h7L6 8.5z"/></svg>';
    h.append(el('span', null, title), el('span', 'n', String(ids.length)));
    h.onclick = () => { if (open) wlFold.add(cls); else wlFold.delete(cls); store.set('wlFold', [...wlFold]); renderWatch(); };
    g.append(h);
    if (S.ready) g.append(el('span', 'st', ids.every(id => srcOf(id) === 'demo') ? 'Saved prices · not live' : cls === 'crypto' ? 'Open 24/7' : marketOpen(ids[0]) ? 'Market open' : 'Market closed'));
    wl.append(g);
    if (!open) continue;
    for (const id of ids) {
      const [b, q] = symParts(id);
      const li = el('li', 'wl-item' + (id === S.symbol ? ' active' : '')); li.dataset.sym = id;
      const main = el('button', 'wl-main'); main.title = nameOf(id);
      const name = el('span', 'wl-sym'); name.append(el('b', null, b), el('span', null, q));
      main.append(name, el('span', 'px', '—'), el('span', 'chg', '—'));
      main.onclick = () => setSymbol(id);
      const x = el('button', 'wl-x'); x.innerHTML = svg('x'); x.setAttribute('aria-label', `Remove ${label(id)} from the watchlist`);
      x.onclick = () => { S.watch = S.watch.filter(s => s !== id); store.set('watch', S.watch); renderWatch(); ensureTickerSubs(); };
      li.append(main, x); wl.append(li);
      if (S.tickers[id]) updateWatchRow(id, null);
    }
  }
}
function updateWatchRow(id, prev) {
  const li = Array.from(wl.children).find(n => n.dataset && n.dataset.sym === id); const t = S.tickers[id]; if (!li || !t) return;
  const px = li.querySelector('.px'), ch = li.querySelector('.chg');
  px.textContent = fmtP(t.last, t.prec);
  const pct = t.ref ? ((t.last - t.ref) / t.ref) * 100 : NaN;
  if (t.src === 'demo') { ch.textContent = 'saved'; ch.className = 'chg saved'; ch.title = `Not live. Real price from ${asOfText(id)}.`; }
  else { ch.textContent = fmtPct(pct); ch.className = 'chg' + (isFinite(pct) ? (pct >= 0 ? ' up' : ' down') : ''); ch.title = ''; }
  if (prev && prev.last !== t.last) { px.classList.remove('fu', 'fd'); void px.offsetWidth; px.classList.add(t.last > prev.last ? 'fu' : 'fd'); }
}
function addWatch(id) { if (!S.watch.includes(id)) { S.watch.push(id); store.set('watch', S.watch); renderWatch(); ensureTickerSubs(); } }
$('#wlAdd').onclick = () => openSearch('add');

function renderDetails() {
  const id = S.symbol, cls = classOf(id), src = S.ready ? srcOf(id) : null;
  const [b, q] = symParts(id);
  updateDocTitle();
  $('#dSym').textContent = label(id);
  const t = S.tickers[id];
  $('#dName').textContent = nameOf(id) + (t && t.exchange ? ' · ' + t.exchange : '');
  $('#dFeed').textContent = !src ? '' : src === 'demo' ? 'Saved price · not live' : src === 'binance' ? `${Live.name} · Spot` : src === 'paxg' ? `${Live.name} · PAXG/USDT` : src === 'metal' ? 'gold-api.com · live' : src === 'kraken' ? `Kraken · ${id === GOLD ? 'PAXG/USD' : rawOf(id)}`
    : src === 'oanda' ? 'OANDA · live' : `Twelve Data · ${kindOf(id)}`;
  $('#alLabel').textContent = `Alert me when ${label(id)} crosses`;
  const open = openNow(id), allDay = cls === 'crypto' || src === 'paxg' || (src === 'kraken' && id === GOLD), roll24 = cls === 'crypto' || src === 'paxg';
  const mk = $('#dMkt'); mk.className = 'mkt' + (open ? ' open' : '');
  mk.lastElementChild.textContent = allDay ? 'Open 24/7' : open ? 'Market open' : cls === 'stock' ? 'Closed · opens 09:30 New York' : 'Closed · opens Sun 17:00 New York';
  $('#dRange').textContent = roll24 ? '24h range' : 'Day range';
  const st = $('#dStats'); st.replaceChildren();
  const stat = (k, v) => { const d = el('div'); d.append(el('dt', null, k), el('dd', null, v)); st.append(d); };
  const has = v => v != null && isFinite(v);
  if (!t) { ['#dPx', '#dChg'].forEach(s => { $(s).textContent = '—'; }); $('#dRangeBox').hidden = true; return; }
  $('#dPx').textContent = fmtP(t.last, t.prec);
  const dc = $('#dChg');
  if (has(t.ref) && t.ref) {
    const ch = t.last - t.ref, pct = (ch / t.ref) * 100;
    dc.textContent = `${fmtSigned(ch, t.prec)}  ${fmtPct(pct)}  ${roll24 ? '24h' : t.src === 'demo' ? 'on the day' : 'today'}`;
    dc.className = 'd-chg ' + (ch >= 0 ? 'up' : 'down');
  } else { dc.textContent = 'Daily change not available'; dc.className = 'd-chg'; }
  const range = has(t.high) && has(t.low);
  $('#dRangeBox').hidden = !range;
  if (range) {
    $('#dLo').textContent = fmtP(t.low, t.prec); $('#dHi').textContent = fmtP(t.high, t.prec);
    $('#dMark').style.left = (t.high > t.low ? clamp(((t.last - t.low) / (t.high - t.low)) * 100, 0, 100) : 50) + '%';
  }
  if (t.src === 'demo') stat('Price as of', asOfText(id).replace(/^the /, ''));
  if (t.src === 'paxg' || (t.src === 'kraken' && id === GOLD)) {
    stat('Spot gold (XAU)', S.spot.XAU ? fmtP(S.spot.XAU.price, 2) : '—');
    if (t.src === 'kraken' && has(t.bid)) stat('Bid / ask', `${fmtP(t.bid, 2)} / ${fmtP(t.ask, 2)}`);
    if (has(t.vol)) stat('24h volume', `${fmtVol(t.vol)} PAXG`);
  } else if (t.src === 'kraken') {
    if (has(t.bid)) { stat('Bid', fmtP(t.bid, t.prec)); stat('Ask', fmtP(t.ask, t.prec)); }
    stat('Source', 'Kraken market');
  } else if (t.src === 'oanda') {
    if (has(t.bid)) { stat('Bid', fmtP(t.bid, t.prec)); stat('Ask', fmtP(t.ask, t.prec)); stat('Spread', fmtP(t.ask - t.bid, t.prec)); }
    if (has(t.prevClose)) stat('Prev close', fmtP(t.prevClose, t.prec));
  } else if (t.src === 'metal') {
    stat('Source', 'gold-api.com spot');
    if (t.at) { const u = new Date(t.at); stat('Last update', `${pad(u.getHours())}:${pad(u.getMinutes())}:${pad(u.getSeconds())}`); }
  } else if (cls === 'crypto') { if (has(t.vol)) stat('24h volume', `${fmtVol(t.vol)} ${b}`); if (has(t.qvol)) stat('24h turnover', `${fmtVol(t.qvol)} ${q}`); }
  else if (cls === 'stock') {
    if (has(t.vol)) stat('Volume', fmtVol(t.vol));
    if (has(t.prevClose)) stat('Prev close', fmtP(t.prevClose, t.prec));
    if (t.w52) { stat('52-week low', fmtP(t.w52.low, t.prec)); stat('52-week high', fmtP(t.w52.high, t.prec)); }
  } else { if (has(t.prevClose)) stat('Prev close', fmtP(t.prevClose, t.prec)); stat('Trading hours', 'Sun 17:00 – Fri 17:00 NY'); }
  $('#alPrice').placeholder = fmtP(t.last, t.prec);
}
function onTicker(t) {
  const prev = S.tickers[t.sym]; t.prec = precFor(t.sym, t.last || 1);
  S.tickers[t.sym] = t;
  updateWatchRow(t.sym, prev);
  if (t.sym === S.symbol) renderDetails();
  Home.onTicker(t);
  if (!t.stand) { checkAlerts(t.sym, t.last); Paper.onPrice(t.sym); }   // a saved stand-in price never sets off an alert or fills an order
}
function tickerSet() { const set = new Set(S.watch); set.add(S.symbol); S.alerts.forEach(a => { if (!a.hit) set.add(a.sym); }); Paper.symbols().forEach(id => set.add(id)); Home.symbols().forEach(id => set.add(id)); return Array.from(set); }

/* ---------- network helpers ---------- */
function fetchT(url, ms, opts) {
  const ac = new AbortController(); const id = setTimeout(() => ac.abort(), ms || 8000);
  return fetch(url, Object.assign({}, opts, { signal: ac.signal })).finally(() => clearTimeout(id));
}
const conn = { binance: 'live', td: 'live' };
function setConn(k, v) { conn[k] = v; renderFeed(); }
// opts.init(send) runs on every (re)connect to subscribe; opts.ping is sent every opts.every ms to keep the line open.
function sock(url, onMsg, key, opts) {
  const h = { ws: null, closed: false, retry: 0, pt: null };
  const open = () => {
    try { h.ws = new WebSocket(url); } catch (e) { schedule(); return; }
    const ws = h.ws;
    ws.onmessage = ev => { try { onMsg(JSON.parse(ev.data)); } catch (e) { /* skip bad frame or "pong" */ } };
    ws.onopen = () => {
      if (h.retry > 0 && h.onReconnect) h.onReconnect(); h.retry = 0; setConn(key, 'live');
      if (opts && opts.init) opts.init(m => { try { ws.send(typeof m === 'string' ? m : JSON.stringify(m)); } catch (e) { /* closed */ } });
      clearInterval(h.pt);
      if (opts && opts.ping) h.pt = setInterval(() => { try { ws.send(opts.ping); } catch (e) { /* closed */ } }, opts.every || 20000);
    };
    ws.onclose = () => { clearInterval(h.pt); if (!h.closed && h.ws === ws) schedule(); };
  };
  const schedule = () => { if (h.closed) return; setConn(key, 'reconnecting'); h.retry++; setTimeout(() => { if (!h.closed) open(); }, Math.min(15000, 800 * Math.pow(2, h.retry))); };
  h.close = () => { h.closed = true; clearInterval(h.pt); try { if (h.ws) h.ws.close(1000); } catch (e) { /* ignore */ } };
  open();
  return h;
}

/* ---------- crypto: Binance public market data (no key) ---------- */
const Binance = {
  name: 'Binance', paxg: true, rest: null, wss: null, universe: null,
  async probe() {
    const hosts = [['https://data-api.binance.vision', 'wss://data-stream.binance.vision'], ['https://api.binance.com', 'wss://stream.binance.com:9443']];
    for (const [r, w] of hosts) {
      try { const res = await fetchT(`${r}/api/v3/ticker/price?symbol=BTCUSDT`, 4500); if (res.ok) { const j = await res.json(); if (j && j.price) { this.rest = r; this.wss = w; return true; } } }
      catch (e) { /* try the next host */ }
    }
    return false;
  },
  async klines(id, tf, beforeSec) {
    const sym = rawOf(id);
    const u = `${this.rest}/api/v3/klines?symbol=${sym}&interval=${tf}&limit=1000${beforeSec ? `&endTime=${beforeSec * 1000 - 1}` : ''}`;
    const r = await fetchT(u, 12000);
    if (!r.ok) throw new Error(r.status === 400 ? `Binance doesn't list ${sym}.` : `Binance answered with error ${r.status}.`);
    const a = await r.json();
    return a.map(k => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
  },
  async tickers(syms) {
    const conv = x => ({ sym: 'BINANCE:' + x.symbol, last: +x.lastPrice, ref: +x.openPrice, high: +x.highPrice, low: +x.lowPrice, vol: +x.volume, qvol: +x.quoteVolume, src: 'binance' });
    try {
      const r = await fetchT(`${this.rest}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(syms))}`, 10000);
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()).map(conv);
    } catch (e) {
      const res = await Promise.allSettled(syms.map(s => fetchT(`${this.rest}/api/v3/ticker/24hr?symbol=${s}`, 10000).then(r => (r.ok ? r.json() : null))));
      return res.filter(x => x.status === 'fulfilled' && x.value).map(x => conv(x.value));
    }
  },
  async list() {
    if (this.universe) return this.universe;
    const r = await fetchT(`${this.rest}/api/v3/ticker/price`, 15000);
    this.universe = (await r.json()).map(x => x.symbol);
    return this.universe;
  },
  kline(id, tf, cb) {
    return sock(`${this.wss}/ws/${rawOf(id).toLowerCase()}@kline_${tf}`, m => { const k = m.k; if (k) cb({ time: k.t / 1000, open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v }); }, 'binance');
  },
  tickerStream(syms, cb) {
    return sock(`${this.wss}/stream?streams=${syms.map(s => s.toLowerCase() + '@miniTicker').join('/')}`, m => { const x = m.data; if (x) cb({ sym: 'BINANCE:' + x.s, last: +x.c, ref: +x.o, high: +x.h, low: +x.l, vol: +x.v, qvol: +x.q, src: 'binance' }); }, 'binance');
  },
};

/* ---------- crypto backups: OKX and Bybit (no key) ----------
   Binance refuses browser requests from some countries (for example the UK and US). The page then uses the first of
   these that answers. Symbols stay in Binance style inside the page (BTCUSDT); each provider translates. */
const OKX_BAR = { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1H', '4h': '4H', '1d': '1Dutc', '1w': '1Wutc' };
const OKX = {
  name: 'OKX', paxg: true, rest: 'https://www.okx.com', universe: null, map: {},
  inst(raw) { if (this.map[raw]) return this.map[raw]; const [b, q] = splitSym(raw); return q ? `${b}-${q}` : raw; },
  async probe() {
    try { const r = await fetchT(this.rest + '/api/v5/market/ticker?instId=BTC-USDT', 4500); const j = await r.json(); return !!(j && j.code === '0'); }
    catch (e) { return false; }
  },
  async get(path) {
    const r = await fetchT(this.rest + path, 12000); const j = await r.json();
    if (!j || j.code !== '0') throw new Error(j && j.msg ? `OKX: ${j.msg}` : `OKX answered with error ${r.status}.`);
    return j.data || [];
  },
  bar: k => ({ time: +k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }),
  async klines(id, tf, before) {
    const inst = this.inst(rawOf(id)), bar = OKX_BAR[tf], rows = [];
    let after = before ? before * 1000 : 0;
    if (!before) { rows.push(...await this.get(`/api/v5/market/candles?instId=${inst}&bar=${bar}&limit=300`)); if (rows.length) after = rows[rows.length - 1][0]; }
    for (let i = 0; i < (before ? 5 : 3) && (after || before); i++) {   // older pages, 100 bars each
      const more = await this.get(`/api/v5/market/history-candles?instId=${inst}&bar=${bar}&limit=100&after=${after}`);
      if (!more.length) break;
      rows.push(...more); after = more[more.length - 1][0];
    }
    if (!rows.length && !before) throw new Error(`OKX doesn't list ${rawOf(id)}.`);
    const seen = new Set();
    return rows.map(this.bar).filter(b => !seen.has(b.time) && seen.add(b.time)).sort((a, b) => a.time - b.time);
  },
  conv(x) { return { sym: 'BINANCE:' + x.instId.replace('-', ''), last: +x.last, ref: +x.open24h, high: +x.high24h, low: +x.low24h, vol: +x.vol24h, qvol: +x.volCcy24h, src: 'binance' }; },
  learn(all) { this.universe = all.map(x => { const raw = x.instId.replace('-', ''); this.map[raw] = x.instId; return raw; }); },
  async tickers(syms) {
    const all = await this.get('/api/v5/market/tickers?instType=SPOT'); this.learn(all);
    const want = new Set(syms.map(s => this.inst(s)));
    return all.filter(x => want.has(x.instId)).map(x => this.conv(x));
  },
  async list() { if (!this.universe) this.learn(await this.get('/api/v5/market/tickers?instType=SPOT')); return this.universe; },
  kline(id, tf, cb) {
    const ch = 'candle' + OKX_BAR[tf], inst = this.inst(rawOf(id));
    return sock('wss://ws.okx.com:8443/ws/v5/business', m => {
      if (m.arg && m.arg.channel === ch && Array.isArray(m.data)) m.data.forEach(k => cb(this.bar(k)));
    }, 'binance', { init: send => send({ op: 'subscribe', args: [{ channel: ch, instId: inst }] }), ping: 'ping', every: 25000 });
  },
  tickerStream(syms, cb) {
    return sock('wss://ws.okx.com:8443/ws/v5/public', m => {
      if (m.arg && m.arg.channel === 'tickers' && Array.isArray(m.data)) m.data.forEach(x => cb(this.conv(x)));
    }, 'binance', { init: send => send({ op: 'subscribe', args: syms.map(s => ({ channel: 'tickers', instId: this.inst(s) })) }), ping: 'ping', every: 25000 });
  },
};
const BYBIT_INT = { '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': 'D', '1w': 'W' };
const Bybit = {
  name: 'Bybit', paxg: false, rest: 'https://api.bybit.com', universe: null,
  async probe() {
    try { const r = await fetchT(this.rest + '/v5/market/tickers?category=spot&symbol=BTCUSDT', 4500); const j = await r.json(); return !!(j && j.retCode === 0); }
    catch (e) { return false; }
  },
  async get(path) {
    const r = await fetchT(this.rest + path, 12000); const j = await r.json();
    if (!j || j.retCode !== 0) throw new Error(j && j.retMsg ? `Bybit: ${j.retMsg}` : `Bybit answered with error ${r.status}.`);
    return j.result || {};
  },
  async klines(id, tf, before) {
    const res = await this.get(`/v5/market/kline?category=spot&symbol=${rawOf(id)}&interval=${BYBIT_INT[tf]}&limit=1000${before ? `&end=${before * 1000 - 1}` : ''}`);
    return (res.list || []).map(k => ({ time: +k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] })).sort((a, b) => a.time - b.time);
  },
  conv(x) { return { sym: 'BINANCE:' + x.symbol, last: +x.lastPrice, ref: +x.prevPrice24h, high: +x.highPrice24h, low: +x.lowPrice24h, vol: +x.volume24h, qvol: +x.turnover24h, src: 'binance' }; },
  async tickers(syms) {
    const res = await this.get('/v5/market/tickers?category=spot'); const all = res.list || [];
    this.universe = all.map(x => x.symbol);
    const want = new Set(syms); return all.filter(x => want.has(x.symbol)).map(x => this.conv(x));
  },
  async list() { if (!this.universe) await this.tickers([]); return this.universe; },
  kline(id, tf, cb) {
    const topic = `kline.${BYBIT_INT[tf]}.${rawOf(id)}`;
    return sock('wss://stream.bybit.com/v5/public/spot', m => {
      if (m.topic === topic && Array.isArray(m.data)) m.data.forEach(k => cb({ time: k.start / 1000, open: +k.open, high: +k.high, low: +k.low, close: +k.close, volume: +k.volume }));
    }, 'binance', { init: send => send({ op: 'subscribe', args: [topic] }), ping: JSON.stringify({ op: 'ping' }), every: 20000 });
  },
  tickerStream(syms, cb) {
    return sock('wss://stream.bybit.com/v5/public/spot', m => {
      if (m.topic && m.topic.startsWith('tickers.') && m.data) cb(this.conv(m.data));
    }, 'binance', { init: send => { for (let i = 0; i < syms.length; i += 10) send({ op: 'subscribe', args: syms.slice(i, i + 10).map(s => 'tickers.' + s) }); }, ping: JSON.stringify({ op: 'ping' }), every: 20000 });
  },
};
// The rest of the page talks to "Live", which forwards to whichever exchange answered first in this order.
let CX = Binance;
const Live = {
  get name() { return CX.name; },
  get paxg() { return CX.paxg; },
  get universe() { return CX.universe; },
  async probe() {
    const order = [Binance, OKX, Bybit], ok = await Promise.all(order.map(p => p.probe()));
    const i = ok.indexOf(true); if (i < 0) return false;
    CX = order[i]; SRC_NAME.binance = CX.name; return true;
  },
  klines: (id, tf, before) => CX.klines(id, tf, before),
  tickers: syms => CX.tickers(syms),
  list: () => CX.list(),
  kline: (id, tf, cb) => CX.kline(id, tf, cb),
  tickerStream: (syms, cb) => CX.tickerStream(syms, cb),
};

/* ---------- stocks & forex: Twelve Data (free key; 8 requests/min, 800/day) ---------- */
class TDErr extends Error { constructor(code, msg) { super(msg || 'Twelve Data error'); this.code = code; } }
const TD_INT = { '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min', '1h': '1h', '4h': '4h', '1d': '1day', '1w': '1week' };
const TD = {
  // A visitor's own key goes straight to Twelve Data. Otherwise requests go through the site's helper, which adds the key.
  key: store.get('tdkey', '') || (API ? 'site' : CFG.twelveDataKey),
  base() { return this.key === 'site' ? API + '/td' : 'https://api.twelvedata.com'; },
  state: 'nokey',          // nokey | ok | bad | offline
  q: [], stamps: [], timer: null, pausedUntil: 0, nextAt: 0, limitDay: '',
  usage: store.get('tdusage', { d: '', n: 0 }),
  today() { return new Date().toISOString().slice(0, 10); },
  used() { if (this.usage.d !== this.today()) this.usage = { d: this.today(), n: 0 }; return this.usage.n; },
  // Today's free allowance is used up: stop asking and show saved prices until midnight UTC.
  outOfDay() {
    this.q.splice(0).forEach(j => j.reject(new TDErr(429, 'daily')));
    if (this.state !== 'ok') return;
    this.state = 'limit'; this.limitDay = this.today();
    toast(tdMessage(new TDErr(429, 'daily')));
    setTimeout(switchSources, 0);
  },
  request(path, params, credits, prio, stale) {
    return new Promise((resolve, reject) => {
      this.q.push({ path, params, credits, prio: prio || 0, stale, resolve, reject });
      this.q.sort((a, b) => b.prio - a.prio);
      // a chart request shouldn't sit behind a watchlist refresh that is waiting for its turn
      if (this.timer && this.q[0].prio > 1) { clearTimeout(this.timer); this.timer = null; }
      this.pump();
    });
  },
  pump() {
    if (this.timer) return;
    while (this.q.length && this.q[0].stale && this.q[0].stale()) this.q.shift().reject(new TDErr(-1, 'stale'));
    const job = this.q[0]; if (!job) return;
    const now = Date.now();
    this.stamps = this.stamps.filter(s => now - s.t < 61000);
    const inWin = this.stamps.reduce((a, s) => a + s.c, 0);
    if (this.used() + job.credits > 795) { this.outOfDay(); return; }
    // Of the 8 requests allowed each minute, watchlist refreshes may use 4 and the first fill 6, so opening a chart rarely waits.
    const cap = job.prio >= 3 ? 8 : job.prio === 2 ? 6 : 4;
    let wait = 0;
    if (now < this.pausedUntil) wait = this.pausedUntil - now;
    else if (inWin + job.credits > cap && this.stamps.length) {
      let used = inWin; wait = 0;
      for (const s of this.stamps) { used -= s.c; wait = 61000 - (now - s.t); if (used + job.credits <= cap) break; }
    }
    if (wait > 0) { this.nextAt = now + wait; this.timer = setTimeout(() => { this.timer = null; this.pump(); }, wait + 50); return; }
    this.nextAt = 0;
    this.q.shift();
    this.stamps.push({ t: now, c: job.credits });
    this.usage.n += job.credits; store.set('tdusage', this.usage);
    this.run(job);
    setTimeout(() => this.pump(), 0);
  },
  async run(job) {
    const u = new URL(this.base() + job.path);
    for (const [k, v] of Object.entries(job.params)) u.searchParams.set(k, v);
    if (this.key !== 'site') u.searchParams.set('apikey', this.key);
    let j;
    try { const r = await fetchT(u.toString(), 15000); j = await r.json(); }
    catch (e) { job.reject(new TDErr(0, 'network')); return; }
    if (j && j.status === 'error') {
      if (j.code === 429 && /for the day|next day/i.test(j.message || '')) { job.reject(new TDErr(429, 'daily')); this.outOfDay(); return; }
      if (j.code === 429) this.pausedUntil = Date.now() + 61000;
      job.reject(new TDErr(j.code || 400, String(j.message || '').replace(/\*\*/g, '')));
      return;
    }
    job.resolve(j);
  },
};
const tdLive = () => !!TD.key && TD.state === 'ok';
function tdMessage(e, id) {
  switch (e.code) {
    case 401: return TD.key === 'site' ? "Live US stock prices aren't available right now, so they show saved prices." : 'Twelve Data rejected the API key. Check it in Data sources.';
    case 429: return e.message === 'daily' ? "Today's 800 free Twelve Data requests are used up, so stocks show saved prices until midnight UTC." : 'Twelve Data allows 8 requests a minute on the free plan. Try again in a minute.';
    case 0: return "Couldn't reach Twelve Data. Check your connection.";
    case 400: case 404: return id ? `Twelve Data doesn't have ${label(id)}, or it needs a paid plan.` : (e.message || 'Twelve Data could not find that symbol.');
    case 403: return id ? `${label(id)} needs a paid Twelve Data plan.` : (e.message || 'That symbol needs a paid Twelve Data plan.');
    default: return e.message || 'Twelve Data returned an error.';
  }
}
function handleTdErr(e) {
  if (!e || e.code === -1) return true;
  if (e.code === 401 && TD.state !== 'bad') { TD.state = 'bad'; toast(tdMessage(e)); switchSources(); return true; }
  if (e.code === 0 && TD.state === 'ok') { TD.state = 'offline'; toast("Couldn't reach Twelve Data, so stocks and forex show saved prices."); switchSources(); return true; }
  return false;
}
function tdTime(s) {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) / 1000 : NaN;
}
function tdBars(j) {
  const out = []; const seen = new Set();
  for (const v of (j && Array.isArray(j.values) ? j.values : [])) {
    const b = { time: tdTime(v.datetime), open: +v.open, high: +v.high, low: +v.low, close: +v.close, volume: v.volume != null ? +v.volume : 0 };
    if (isFinite(b.time) && isFinite(b.close) && !seen.has(b.time)) { seen.add(b.time); out.push(b); }
  }
  return out.sort((a, b) => a.time - b.time);
}
function utcStamp(s) { const d = new Date(s * 1000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`; }
const TDFeed = {
  async klines(id, tf, beforeSec) {
    const token = S.token;
    const params = { symbol: rawOf(id), interval: TD_INT[tf], outputsize: 1000, timezone: 'UTC', order: 'asc' };
    if (beforeSec) params.end_date = utcStamp(beforeSec - 1);
    const j = await TD.request('/time_series', params, 1, beforeSec ? 2 : 3, () => token !== S.token);
    return tdBars(j);
  },
};
function tdTicker(id, q) {
  const last = +q.close, prevClose = +q.previous_close;
  const w = q.fifty_two_week;
  return {
    sym: id, last, ref: isFinite(prevClose) && prevClose ? prevClose : +q.open, prevClose,
    high: Math.max(+q.high || last, last), low: Math.min(+q.low || last, last),
    vol: q.volume != null && q.volume !== '' ? +q.volume : null, qvol: null,
    name: q.name, exchange: q.exchange, w52: w ? { low: +w.low, high: +w.high } : null, src: 'td',
  };
}
const tdPending = new Set();
function tdQuote(ids, prio) {
  ids = ids.filter(id => !tdPending.has(id));
  for (let i = 0; i < ids.length; i += 4) {
    const batch = ids.slice(i, i + 4); batch.forEach(id => tdPending.add(id));
    const syms = batch.map(rawOf);
    let again = false;
    TD.request('/quote', { symbol: syms.join(',') }, batch.length, prio || 1)
      .then(j => {
        const map = batch.length === 1 ? { [syms[0]]: j } : j;
        batch.forEach(id => { const q = map && map[rawOf(id)]; if (q && q.close != null && q.status !== 'error' && tdLive()) onTicker(Object.assign(tdTicker(id, q), { _dv: (S.tickers[id] || {})._dv })); });
      })
      // The site key is shared by every visitor, so a minute can be used up by someone else: the queue pauses, then this tries again.
      .catch(e => { if (!handleTdErr(e) && e.code === 429 && e.message !== 'daily') again = true; })
      .finally(() => {
        batch.forEach(id => tdPending.delete(id));
        if (again && tdLive()) { const set = tickerSet(); tdQuote(batch.filter(id => set.includes(id) && !(S.tickers[id] && S.tickers[id].src === 'td')), prio); }
      });
  }
}
// One streaming connection, up to 8 symbols on the free plan. Symbols it can't stream are polled.
const TDWS = {
  ws: null, want: [], subs: new Set(), fails: new Set(), ids: new Map(), hb: null, retry: 0, closed: true,
  connect() {
    // The free plan allows one streaming connection per key, so a key shared by every visitor (config.js) uses
    // regular refreshes instead; a visitor's own key streams.
    if (!tdLive() || !store.get('tdkey', '')) return;
    this.closed = false;
    try { this.ws = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(TD.key)}`); } catch (e) { this.ws = null; return; }
    this.ws.onopen = () => { this.retry = 0; this.subs = new Set(); this.sync(); clearInterval(this.hb); this.hb = setInterval(() => this.send({ action: 'heartbeat' }), 10000); };
    this.ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.event === 'price') onTdTick(m);
      else if (m.event === 'subscribe-status') {
        (m.fails || []).forEach(f => this.fails.add(f && f.symbol ? f.symbol : String(f)));
        (m.success || []).forEach(s => this.fails.delete(s && s.symbol ? s.symbol : String(s)));
      }
    };
    this.ws.onclose = () => {
      clearInterval(this.hb); this.ws = null; this.subs = new Set();
      if (!this.closed && tdLive()) setTimeout(() => { if (!this.closed && !this.ws) this.connect(); }, Math.min(60000, 3000 * Math.pow(2, this.retry++)));
    };
  },
  close() { this.closed = true; clearInterval(this.hb); try { if (this.ws) this.ws.close(1000); } catch (e) { /* ignore */ } this.ws = null; this.subs = new Set(); this.fails = new Set(); },
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },
  setWanted(ids) { this.want = ids.slice(0, 8); this.ids = new Map(this.want.map(id => [rawOf(id), id])); this.sync(); },
  sync() {
    if (!this.ws || this.ws.readyState !== 1) return;
    const want = new Set(this.want.map(rawOf));
    const add = [...want].filter(s => !this.subs.has(s)), rem = [...this.subs].filter(s => !want.has(s));
    if (rem.length) this.send({ action: 'unsubscribe', params: { symbols: rem.join(',') } });
    if (add.length) this.send({ action: 'subscribe', params: { symbols: add.join(',') } });
    this.subs = want;
  },
  covers(id) { const s = rawOf(id); return !!this.ws && this.ws.readyState === 1 && this.subs.has(s) && !this.fails.has(s); },
};
function onTdTick(m) {
  const id = TDWS.ids.get(m.symbol); if (!id || !tdLive()) return;
  const price = +m.price; if (!isFinite(price)) return;
  const prev = S.tickers[id];
  const t = Object.assign({ ref: price, high: price, low: price, vol: null, qvol: null }, prev || {}, { sym: id, src: 'td', last: price });
  t.high = Math.max(t.high, price); t.low = Math.min(t.low, price);
  let dv = 0;
  if (m.day_volume != null && isFinite(+m.day_volume)) { const v = +m.day_volume; if (t._dv != null && v >= t._dv) dv = v - t._dv; t._dv = v; t.vol = v; }
  onTicker(t);
  if (id === S.symbol && S.bars.length && srcOf(id) === 'td') tickBar(price, +m.timestamp || Date.now() / 1000, dv);
}
function tickBar(price, ts, dv) {
  const arr = R.on ? R.full : S.bars;
  const sec = tfOf(S.tf).sec, last = arr[arr.length - 1];
  if (ts < last.time) return;
  const k = Math.floor((ts - last.time) / sec);
  if (k >= 1) onBar({ time: last.time + k * sec, open: price, high: price, low: price, close: price, volume: dv || 0 });
  else onBar({ time: last.time, open: last.open, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price, volume: last.volume + (dv || 0) });
}
async function pollSeries() {
  const id = S.symbol, token = S.token;
  try {
    const j = await TD.request('/time_series', { symbol: rawOf(id), interval: TD_INT[S.tf], outputsize: 3, timezone: 'UTC', order: 'asc' }, 1, 2, () => token !== S.token);
    if (token !== S.token) return;
    tdBars(j).forEach(b => { if (S.bars.length && b.time >= S.bars[S.bars.length - 1].time) onBar(b); });
    const t = S.tickers[id], a = R.on ? R.full : S.bars, lb = a[a.length - 1];   // the live bar, even during a replay
    if (t && lb) onTicker(Object.assign({}, t, { last: lb.close, high: Math.max(t.high, lb.close), low: Math.min(t.low, lb.close) }));
  } catch (e) { handleTdErr(e); }
}
let tdSeriesAt = 0, tdQuoteAt = Date.now();
setInterval(() => {
  if (TD.state === 'limit' && TD.today() !== TD.limitDay) { TD.state = 'ok'; switchSources(); }
  if (!tdLive() || !S.ready) return;
  const now = Date.now();
  if (srcOf(S.symbol) === 'td' && !TDWS.covers(S.symbol) && marketOpen(S.symbol) && S.bars.length && now - tdSeriesAt > 60000) { tdSeriesAt = now; pollSeries(); }
  if (now - tdQuoteAt > 600000) {
    tdQuoteAt = now;
    const ids = tickerSet().filter(id => srcOf(id) === 'td' && marketOpen(id) && !TDWS.covers(id));
    if (ids.length) tdQuote(ids, 1);
  }
}, 15000);

/* ---------- demo feed: seeded markets that follow real trading hours ---------- */
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function barSigma(cls, sigma, sec) {
  if (sec >= WEEK) return sigma / Math.sqrt(52);
  if (sec >= DAY) return sigma / Math.sqrt(cls === 'crypto' ? 365 : cls === 'stock' ? 252 : 260);
  return sigma * Math.sqrt(sec / (cls === 'crypto' ? YEAR : cls === 'stock' ? 252 * 23400 : 260 * DAY));
}
function dayFrac(cls, sec) { if (sec >= WEEK) return cls === 'crypto' ? 7 : 5; if (sec >= DAY) return 1; return sec / (cls === 'stock' ? 23400 : DAY); }
// Used when live data can't be reached: each symbol shows its saved real price, which does not move.
// Earlier candles are illustrative; they are pinned so the last close and the 24h / previous-close
// reference match the real saved values.
const Demo = {
  st: {}, hist: {},
  ensure(id) {
    if (id in this.st) return this.st[id];
    const snap = snapOf(id);
    if (!snap) return (this.st[id] = null);
    const cfg = DEMO[id] || [snap.last, 0.4, 0]; const cls = classOf(id);
    const qv = cls === 'crypto' ? (snap.qvol || cfg[2]) : cls === 'stock' ? cfg[2] : 0;
    return (this.st[id] = Object.assign({ cls, sigma: cfg[1], qv, price: snap.last, at: snapTime(id) }, snap));
  },
  ticker(id) {
    const s = this.ensure(id); if (!s) return null;
    return { sym: id, last: s.last, ref: s.ref, high: s.high, low: s.low, vol: s.vol, qvol: s.qvol, prevClose: s.prevClose, w52: null, src: 'demo' };
  },
  create(id, tf, count) {
    const s = this.st[id], cls = s.cls, sec = tfOf(tf).sec, r = rng(hash(id + '|' + tf));
    const sig = barSigma(cls, s.sigma, sec);
    const t0 = latestBar(cls, sec, s.at);
    const frac = clamp((s.at - t0) / sec, 0.05, 1);
    const h = { r, sig, sec, cls, vol: 1, k: 0, ph1: r() * 6.28, ph2: r() * 6.28, qv: s.qv, bars: [] };
    const o = s.price / Math.exp(gauss(r) * sig * Math.sqrt(frac));
    h.bars = [this.bar(h, t0, o, s.price, sig * Math.sqrt(frac), frac)];
    this.extend(h, count || 700);
    if (s.ref != null && sec <= DAY) {
      const T = anchorTime(id); let j = -1;
      for (let i = h.bars.length - 2; i >= 0; i--) if (h.bars[i].time + sec <= T) { j = i; break; }
      this.anchor(h.bars, j, s.ref);
    }
    this.hist[id + '|' + tf] = h;
    return h;
  },
  // Bend the illustrative history so bar j closes at the real reference price; the last close stays put.
  anchor(bars, j, ref) {
    const n = bars.length; if (j < 0 || j >= n - 1 || !(ref > 0)) return;
    const d = Math.log(ref / bars[j].close);
    const cAt = i => (i <= j ? d : (d * (n - 1 - i)) / (n - 1 - j));
    for (let i = 0; i < n; i++) {
      const b = bars[i], co = cAt(Math.max(0, i - 1)), cc = cAt(i);
      const o = b.open * Math.exp(co), c = b.close * Math.exp(cc);
      b.high = Math.max(b.high * Math.exp(Math.max(co, cc)), o, c);
      b.low = Math.min(b.low * Math.exp(Math.min(co, cc)), o, c);
      b.open = o; b.close = c;
    }
  },
  bar(h, t, o, c, s, frac) {
    const hi = Math.max(o, c) * Math.exp(Math.abs(gauss(h.r)) * s * 0.55);
    const lo = Math.min(o, c) * Math.exp(-Math.abs(gauss(h.r)) * s * 0.55);
    let volume = 0;
    if (h.qv) {
      const move = Math.abs(Math.log(c / o)) / (h.sig || 1e-9);
      volume = (h.qv / c) * dayFrac(h.cls, h.sec) * (frac || 1) * (0.45 + 0.55 * move) * Math.exp(gauss(h.r) * 0.35);
    }
    return { time: t, open: o, high: hi, low: lo, close: c, volume };
  },
  extend(h, n) {
    const out = []; let close = h.bars[0].open; let t = h.bars[0].time;
    for (let i = 0; i < n; i++) {
      t = prevBar(h.cls, h.sec, t); h.k++;
      h.vol = clamp(h.vol * 0.9 + 0.1 * (0.45 + 0.7 * Math.abs(gauss(h.r))), 0.6, 1.6);
      const drift = h.sig * (0.13 * Math.sin(h.k / 53 + h.ph1) + 0.08 * Math.sin(h.k / 17 + h.ph2));
      const ret = drift + h.sig * h.vol * gauss(h.r);
      const open = close / Math.exp(ret);
      out.push(this.bar(h, t, open, close, h.sig * h.vol, 1));
      close = open;
    }
    out.reverse(); h.bars = out.concat(h.bars);
    return out;
  },
  async klines(id, tf, beforeSec) {
    if (!this.ensure(id)) {
      throw new Error(`There's no saved price for ${label(id)}. ` + (S.sandbox ? 'Host this page to load live prices.' : classOf(id) === 'crypto' ? "No crypto exchange can be reached right now." : 'Connect OANDA or add a free Twelve Data key in Data sources for live prices.'));
    }
    if (!beforeSec) return this.create(id, tf, 700).bars.map(b => Object.assign({}, b));
    const h = this.hist[id + '|' + tf];
    if (!h || h.bars.length > 6000) return [];
    return this.extend(h, 500).map(b => Object.assign({}, b));
  },
};

/* ---------- forex majors and gold without a key: Kraken ----------
   Kraken's public market data (no key, browser-friendly) has live EUR/USD and 11 other major pairs, plus PAX Gold
   (PAXG/USD), which trades within cents of spot gold. Used when OANDA and Twelve Data aren't set up. */
const KRAKEN_PAIR = { 'EUR/USD': 'EURUSD', 'GBP/USD': 'GBPUSD', 'USD/JPY': 'USDJPY', 'USD/CHF': 'USDCHF', 'USD/CAD': 'USDCAD', 'AUD/USD': 'AUDUSD',
  'EUR/GBP': 'EURGBP', 'EUR/JPY': 'EURJPY', 'EUR/CHF': 'EURCHF', 'EUR/AUD': 'EURAUD', 'EUR/CAD': 'EURCAD', 'AUD/JPY': 'AUDJPY', 'XAU/USD': 'PAXGUSD' };
const KR_INT = { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440, '1w': 10080 };
const krNorm = k => (k.length === 8 && /^[XZ]/.test(k) && /^[XZ]/.test(k.slice(4)) ? k.slice(1, 4) + k.slice(5) : k);
const Kraken = {
  ok: false, rest: 'https://api.kraken.com/0/public', syncAt: 0, busy: false,
  pair: id => KRAKEN_PAIR[rawOf(id)],
  has(id) { return this.ok && classOf(id) === 'forex' && !!this.pair(id); },
  async get(path) {
    const r = await fetchT(this.rest + path, 12000); const j = await r.json();
    if (j.error && j.error.length) throw new Error('Kraken: ' + j.error.join(', '));
    return j.result || {};
  },
  async probe() { try { this.ok = Object.keys(await this.get('/Ticker?pair=EURUSD')).length > 0; } catch (e) { this.ok = false; } return this.ok; },
  rows(res) { const e = Object.entries(res).find(([k]) => k !== 'last'); return e ? e[1] : []; },
  bar: k => ({ time: +k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[6] }),
  async klines(id, tf, before) {
    if (before) return [];   // Kraken serves the most recent 720 bars
    const bars = this.rows(await this.get(`/OHLC?pair=${this.pair(id)}&interval=${KR_INT[tf]}`)).map(this.bar);
    if (!bars.length) throw new Error(`Kraken has no prices for ${label(id)} right now.`);
    return bars;
  },
  async tail(id, tf, since) { return this.rows(await this.get(`/OHLC?pair=${this.pair(id)}&interval=${KR_INT[tf]}&since=${since}`)).map(this.bar); },
  async tickers(ids) {
    const res = await this.get(`/Ticker?pair=${ids.map(id => this.pair(id)).join(',')}`);
    const byAlt = {}; ids.forEach(id => { byAlt[this.pair(id)] = id; });
    const out = [];
    for (const [k, v] of Object.entries(res)) {
      const id = byAlt[k] || byAlt[krNorm(k)]; if (!id) continue;
      const bid = +v.b[0], ask = +v.a[0], last = +v.c[0], mid = (bid + ask) / 2;
      const price = ask > bid && (ask - bid) / mid < 0.0005 ? mid : last;   // a thin book uses the last trade instead
      out.push({ sym: id, src: 'kraken', last: price, bid, ask, ref: +v.o || null, prevClose: null,
        high: Math.max(+v.h[0], price), low: Math.min(+v.l[0], price), vol: null, qvol: null });
    }
    return out;
  },
};
async function pollKraken() {
  if (Kraken.busy || !Kraken.ok || !S.ready) return;
  if (document.hidden) { if (Date.now() - (Kraken.bgAt || 0) < 10000) return; Kraken.bgAt = Date.now(); }   // slower in a background tab, so alerts still fire
  const ids = tickerSet().filter(id => srcOf(id) === 'kraken');
  if (!ids.length) return;
  Kraken.busy = true;
  try {
    for (const t of await Kraken.tickers(ids)) {
      onTicker(t);
      if (t.sym === S.symbol && S.bars.length && openNow(t.sym)) tickBar(t.last, Date.now() / 1000, 0);
    }
    if (srcOf(S.symbol) === 'kraken' && S.bars.length && Date.now() - Kraken.syncAt > 15000) {   // keep the live candle exact
      Kraken.syncAt = Date.now(); const token = S.token, a = R.on ? R.full : S.bars, since = a[a.length - 1].time - 1;
      const tail = await Kraken.tail(S.symbol, S.tf, since);
      if (token === S.token) tail.forEach(b => { if (S.bars.length && b.time >= S.bars[S.bars.length - 1].time) onBar(b); });
    }
  } catch (e) { /* try again on the next round */ }
  finally { Kraken.busy = false; }
}
setInterval(pollKraken, 2000);

/* ---------- forex, gold, indices, commodities & bonds: OANDA ----------
   Only through the site's helper (set proxy in config.js; see oanda-worker.js). The OANDA token stays on Cloudflare,
   so no trading token ever reaches a visitor's browser. */
class OErr extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const O_GRAN = { '1m': 'M1', '5m': 'M5', '15m': 'M15', '30m': 'M30', '1h': 'H1', '4h': 'H4', '1d': 'D', '1w': 'W' };
const OANDA = {
  proxy: API,
  state: 'off', refs: {}, refsAt: 0, syncAt: 0, busy: false,
  configured() { return !!this.proxy; },
  active() { return this.state === 'ok'; },
  base() { return this.proxy; },
  inst: id => rawOf(id).replace('/', '_'),
  async get(path) {
    const headers = { 'Accept-Datetime-Format': 'UNIX' };
    let r;
    try { r = await fetchT(this.base() + path, 12000, { headers }); } catch (e) { throw new OErr(0, "Couldn't reach OANDA. Check your connection."); }
    let j = null; try { j = await r.json(); } catch (e) { /* not JSON */ }
    if (r.status === 401 || r.status === 403) throw new OErr(401, 'OANDA rejected the token.');
    if (!r.ok) throw new OErr(r.status, (j && j.errorMessage) || `OANDA answered with error ${r.status}.`);
    return j || {};
  },
  async connect() {
    if (!this.proxy) throw new OErr(0, 'OANDA is not set up for this site.');
    await this.get('/v3/instruments/EUR_USD/candles?count=1&granularity=M1&price=M'); this.state = 'ok';
  },
  async candles(id, gran, count, to) {
    const j = await this.get(`/v3/instruments/${this.inst(id)}/candles?price=M&granularity=${gran}&count=${count}&alignmentTimezone=UTC&dailyAlignment=0&weeklyAlignment=Monday${to ? `&to=${to}` : ''}`);
    return (j.candles || []).filter(c => c.mid).map(c => ({ time: Math.round(+c.time), open: +c.mid.o, high: +c.mid.h, low: +c.mid.l, close: +c.mid.c, volume: +c.volume || 0 }));
  },
  async klines(id, tf, before) {
    const bars = await this.candles(id, O_GRAN[tf], 1000, before);
    if (!bars.length && !before) throw new OErr(404, `OANDA doesn't offer ${label(id)} on this account.`);
    return before ? bars.filter(b => b.time < before) : bars;
  },
  async prices(ids) {
    const j = await this.get(`/v3/accounts/_/pricing?instruments=${ids.map(id => this.inst(id)).join(',')}`);
    return (j.prices || []).map(oPrice).filter(p => isFinite(p.mid));
  },
  async dayRef(id) {   // previous close and today's range, days starting 00:00 UTC
    const d = await this.candles(id, 'D', 2);
    if (d.length) this.refs[id] = { prev: d.length > 1 ? d[d.length - 2].close : d[0].open, high: d[d.length - 1].high, low: d[d.length - 1].low };
  },
};
function oPrice(p) {
  const bid = +(p.bids && p.bids[0] ? p.bids[0].price : p.closeoutBid), ask = +(p.asks && p.asks[0] ? p.asks[0].price : p.closeoutAsk);
  return { inst: p.instrument, bid, ask, mid: (bid + ask) / 2 };
}
function onOandaPrice(p, ids) {
  const id = (ids || tickerSet()).find(x => classOf(x) === 'forex' && OANDA.inst(x) === p.inst);
  if (!id || srcOf(id) !== 'oanda' || !isFinite(p.mid)) return;
  const r = OANDA.refs[id] || {};
  onTicker({ sym: id, src: 'oanda', last: p.mid, bid: p.bid, ask: p.ask, ref: r.prev ?? null, prevClose: r.prev ?? null,
    high: r.high != null ? Math.max(r.high, p.mid) : null, low: r.low != null ? Math.min(r.low, p.mid) : null, vol: null, qvol: null });
  if (id === S.symbol && S.bars.length && marketOpen(id)) tickBar(p.mid, Date.now() / 1000, 0);
}
// With the site's proxy (OANDA for everyone), prices stream over one long request per visitor instead of a request
// every second or two, which keeps the free Cloudflare plan's daily allowance for a lot of visitors.
const OStream = {
  ctl: null, key: '', live: false, fails: 0, lastAt: 0, again: null,
  want() { return OANDA.proxy && OANDA.active() && S.ready ? tickerSet().filter(id => srcOf(id) === 'oanda').map(OANDA.inst).sort().join(',') : ''; },
  sync() {
    const key = this.want();
    if (key === this.key && (this.ctl || this.again)) return;
    this.stop(); this.key = key;
    if (key && typeof ReadableStream !== 'undefined') this.run(key);
  },
  stop() { clearTimeout(this.again); this.again = null; const c = this.ctl; this.ctl = null; this.live = false; if (c) c.abort(); },
  async run(key) {
    const ctl = this.ctl = new AbortController();
    try {
      const r = await fetch(`${OANDA.proxy}/v3/accounts/_/pricing/stream?instruments=${key}`, { signal: ctl.signal, headers: { 'Accept-Datetime-Format': 'UNIX' } });
      if (!r.ok || !r.body) throw new Error('stream ' + r.status);
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line || this.ctl !== ctl) continue;
          let m; try { m = JSON.parse(line); } catch (e) { continue; }
          this.lastAt = Date.now(); this.live = true; this.fails = 0; OANDA.fails = 0;
          if (m.type === 'PRICE') onOandaPrice(oPrice(m));
        }
      }
    } catch (e) { /* stopped, or the connection dropped */ }
    if (this.ctl !== ctl) return;
    this.ctl = null; this.live = false; this.fails++;
    // Reconnect after a pause. Meanwhile, regular price requests carry on.
    this.again = setTimeout(() => { this.again = null; this.key = ''; this.sync(); }, Math.min(60000, 1000 * 2 ** Math.min(this.fails, 6)));
  },
  check() {   // OANDA sends a heartbeat every 5 s; a silent stream has dropped
    if (this.ctl && this.live && Date.now() - this.lastAt > 20000) { this.stop(); this.key = ''; this.sync(); }
    else this.sync();
  },
};
async function pollOanda() {
  if (OANDA.busy || !OANDA.active() || !S.ready) return;
  OStream.check();
  if (document.hidden) { if (Date.now() - (OANDA.bgAt || 0) < 10000) return; OANDA.bgAt = Date.now(); }   // slower in a background tab, so alerts still fire
  const ids = tickerSet().filter(id => srcOf(id) === 'oanda');
  if (!ids.length) return;
  // Through the shared proxy: prices come from the stream, so ask only while it's down, and less often.
  const streamed = OANDA.proxy && OStream.live;
  if (OANDA.proxy && !streamed && Date.now() - (OANDA.pollAt || 0) < 3000) return;
  OANDA.busy = true;
  try {
    const stale = Date.now() - OANDA.refsAt > 600000, need = ids.filter(id => stale || !OANDA.refs[id]);
    if (need.length) { if (stale) OANDA.refsAt = Date.now(); await Promise.all(need.map(id => OANDA.dayRef(id).catch(() => {}))); }
    if (!streamed) { OANDA.pollAt = Date.now(); for (const p of await OANDA.prices(ids)) onOandaPrice(p, ids); }
    if (srcOf(S.symbol) === 'oanda' && S.bars.length && Date.now() - OANDA.syncAt > (OANDA.proxy ? 60000 : 10000)) {   // keep the live candle exact
      OANDA.syncAt = Date.now(); const token = S.token;
      const tail = await OANDA.candles(S.symbol, O_GRAN[S.tf], 3);
      if (token === S.token) tail.forEach(b => { if (S.bars.length && b.time >= S.bars[S.bars.length - 1].time) onBar(b); });
    }
    OANDA.fails = 0;
  } catch (e) { handleOandaErr(e); }
  finally { OANDA.busy = false; }
}
function handleOandaErr(e) {
  if (!e || !OANDA.active()) return;
  if (e.code === 401) {
    OANDA.state = 'bad'; OStream.stop();
    toast(OANDA.proxy ? "The site's OANDA connection was refused, so forex and gold use Kraken for now." : 'OANDA rejected the token, so forex and gold use the other sources again. Check it in Data sources.');
    switchSources();
    return;
  }
  // Not answering (offline, or the proxy's free daily allowance is used up): use the other live sources and keep trying quietly.
  OANDA.fails = (OANDA.fails || 0) + 1;
  if (OANDA.fails >= 3 && !OStream.live) {
    OANDA.state = 'offline'; OANDA.fails = 0; OStream.stop();
    toast("OANDA isn't answering, so forex and gold use Kraken for now. It reconnects by itself.");
    switchSources(); retryOanda(30000);
  }
}
setInterval(pollOanda, 1500);
// A saved token is kept even when OANDA doesn't answer at start-up; keep trying quietly until it does.
let oandaRetry = null;
function retryOanda(delay) {
  clearTimeout(oandaRetry);
  oandaRetry = setTimeout(async () => {
    if (!OANDA.configured() || OANDA.active() || (OANDA.state === 'bad' && !OANDA.proxy)) return;
    try {
      await OANDA.connect();
      toast('Reconnected to OANDA.'); switchSources();
      if ($('#srcDlg').open) renderSources();
    } catch (e) {
      if (e.code === 401) { OANDA.state = 'bad'; if ($('#srcDlg').open) renderSources(); return; }
      retryOanda(20000);
    }
  }, delay == null ? 0 : delay);
}
window.addEventListener('online', () => { if (OANDA.state === 'offline') retryOanda(1000); });

/* ---------- gold & silver without a key ----------
   Gold: PAX Gold (PAXG/USDT) on Binance, a token backed by physical gold that tracks spot gold.
   It streams live around the clock with full candle history. The spot price is shown alongside from gold-api.com.
   Silver: live spot price from gold-api.com (free, no key, browser-friendly); its older candles are illustrative. */
const GOLD = 'FX:XAU/USD', SILVER = 'FX:XAG/USD', METAL_SYM = { 'FX:XAU/USD': 'XAU', 'FX:XAG/USD': 'XAG' };
const binId = id => (id === GOLD && srcOf(id) === 'paxg' ? 'BINANCE:PAXGUSDT' : id);
const openNow = id => srcOf(id) === 'paxg' || (id === GOLD && srcOf(id) === 'kraken') || marketOpen(id);
const PaxgFeed = { klines: (id, tf, before) => Live.klines('BINANCE:PAXGUSDT', tf, before) };
const GoldApi = {
  async price(sym) {
    const r = await fetchT(`https://api.gold-api.com/price/${sym}`, 8000);
    if (!r.ok) throw new Error('gold-api ' + r.status);
    const j = await r.json(), p = +j.price;
    if (!isFinite(p) || p <= 0) throw new Error('gold-api: no price');
    return { price: p, at: Date.parse(j.updatedAt) || Date.now() };
  },
};
function metalTicker(id, q) {
  const prev = S.tickers[id] && S.tickers[id].src === 'metal' ? S.tickers[id] : null;
  return { sym: id, src: 'metal', last: q.price, at: q.at, ref: prev ? prev.ref : null, prevClose: null, high: null, low: null, vol: null, qvol: null };
}
let metalBusy = false;
async function pollMetals() {
  if (metalBusy || !S.ready || !S.goldApi) return;
  metalBusy = true;
  try {
    const want = tickerSet().filter(id => srcOf(id) === 'metal');
    if (S.symbol === GOLD && ['paxg', 'kraken'].includes(srcOf(GOLD))) want.push('spot');
    for (const id of want) {
      try {
        const q = await GoldApi.price(id === 'spot' ? 'XAU' : METAL_SYM[id]);
        if (id === 'spot') { S.spot.XAU = q; if (S.symbol === GOLD) renderDetails(); continue; }
        onTicker(metalTicker(id, q));
        if (id === S.symbol && S.bars.length && srcOf(id) === 'metal') tickBar(q.price, Date.now() / 1000, 0);
      } catch (e) { /* try again next round */ }
    }
  } finally { metalBusy = false; }
}
const MetalFeed = {
  async klines(id, tf, before) {
    const s = Demo.ensure(id);
    if (s && !before) {
      let t = S.tickers[id];
      if (!(t && t.src === 'metal')) { try { t = metalTicker(id, await GoldApi.price(METAL_SYM[id])); onTicker(t); } catch (e) { t = null; } }
      if (t) { s.price = s.last = t.last; s.at = Date.now() / 1000; }
    }
    return Demo.klines(id, tf, before);
  },
};

/* ---------- which source serves a symbol ---------- */
function srcOf(id) {
  if (classOf(id) === 'crypto') return S.binance ? 'binance' : 'demo';
  if (CFD[id]) return OANDA.active() ? 'oanda' : 'demo';
  if (classOf(id) === 'forex' && OANDA.active()) return 'oanda';
  if (Kraken.has(id)) return 'kraken';   // live with no limits, so the free Twelve Data allowance is kept for stocks
  if (tdLive()) return 'td';
  if (id === GOLD) return S.binance && Live.paxg ? 'paxg' : S.goldApi ? 'metal' : 'demo';
  if (id === SILVER && S.goldApi) return 'metal';
  return 'demo';
}
const feedFor = id => ({ binance: Live, td: TDFeed, demo: Demo, paxg: PaxgFeed, metal: MetalFeed, oanda: OANDA, kraken: Kraken })[srcOf(id)];
function onBinTicker(t) {
  onTicker(t);
  if (t.sym === 'BINANCE:PAXGUSDT' && srcOf(GOLD) === 'paxg') onTicker(Object.assign({}, t, { sym: GOLD, src: 'paxg' }));
}

/* ---------- loading data ---------- */
let klineSock = null, binSock = null, binKey = '';
function ensureTickerSubs() {
  if (!S.ready) return;
  const list = tickerSet();
  const bin = list.filter(id => srcOf(id) === 'binance').map(rawOf);
  if (list.some(id => srcOf(id) === 'paxg') && !bin.includes('PAXGUSDT')) bin.push('PAXGUSDT');
  const key = bin.slice().sort().join(',');
  if (key !== binKey) {
    binKey = key; if (binSock) { binSock.close(); binSock = null; }
    if (bin.length) {
      binSock = Live.tickerStream(bin, onBinTicker);
      binSock.onReconnect = () => Live.tickers(bin).then(a => a.forEach(onBinTicker)).catch(() => {});
      Live.tickers(bin).then(a => a.forEach(onBinTicker)).catch(() => {});
    }
  }
  if (list.some(id => srcOf(id) === 'metal' && !(S.tickers[id] && S.tickers[id].src === 'metal'))) pollMetals();
  if (list.some(id => srcOf(id) === 'oanda' && !(S.tickers[id] && S.tickers[id].src === 'oanda'))) pollOanda();
  OStream.sync();
  if (list.some(id => srcOf(id) === 'kraken' && !(S.tickers[id] && S.tickers[id].src === 'kraken'))) pollKraken();
  list.filter(id => srcOf(id) === 'demo' && !(S.tickers[id] && S.tickers[id].src === 'demo')).forEach(id => { const t = Demo.ticker(id); if (t) onTicker(t); });
  const td = list.filter(id => srcOf(id) === 'td');
  TDWS.setWanted(td.includes(S.symbol) ? [S.symbol].concat(td.filter(x => x !== S.symbol)) : td);
  const missing = td.filter(id => !(S.tickers[id] && S.tickers[id].src === 'td'));
  // Until the live quote arrives, show the saved real price, marked "saved".
  missing.forEach(id => { if (!S.tickers[id]) { const t = Demo.ticker(id); if (t) onTicker(Object.assign(t, { stand: true })); } });
  if (missing.length) tdQuote(missing, 2);   // may use the whole minute's allowance, so the list fills straight away
}
function switchSources() {
  TDWS.close(); if (tdLive()) TDWS.connect();
  Object.keys(S.tickers).forEach(id => { if (classOf(id) !== 'crypto') delete S.tickers[id]; });
  if (classOf(S.symbol) !== 'crypto') loadChart();
  renderWatch(); ensureTickerSubs(); renderDetails(); renderFeed();
}
function onBar(b) {
  if (R.on) { rpMerge(b); return; }
  const n = S.bars.length; if (!n || !S.main) return;
  const last = S.bars[n - 1];
  if (b.time < last.time) return;
  if (b.time === last.time) S.bars[n - 1] = b; else S.bars.push(b);
  const i = S.bars.length - 1;
  if (S.type === 'heikin') haAt(i);
  S.main.update(mainPoint(i));
  for (const rt of S.rts) updateRtLast(rt);
  if (!S.cross) updateLegend();
}
function veil(text, retry) {
  const v = $('#veil');
  if (text == null) { v.hidden = true; return; }
  v.hidden = false; $('#veilText').textContent = text; $('#veilSpin').hidden = !!retry; $('#veilRetry').hidden = !retry;
}
$('#veilRetry').onclick = () => loadChart();
async function loadChart() {
  const token = ++S.token; S.noMore = false; S.older = false;
  setTitle(); updateWatermark(); renderTfState(); renderFeed();
  const src = srcOf(S.symbol);
  veil(`Loading ${label(S.symbol)} · ${tfOf(S.tf).label}`);
  if (klineSock) { klineSock.close(); klineSock = null; }
  try {
    const bars = await feedFor(S.symbol).klines(S.symbol, S.tf);
    if (token !== S.token) return;
    if (!bars.length) throw new Error(`No price history for ${label(S.symbol)} yet.`);
    S.bars = bars; S.prec = precFor(S.symbol, bars[bars.length - 1].close);
    if (R.on) rpRebase(bars);   // keep replaying from the same moment on the new symbol or timeframe
    S.main.applyOptions({ priceFormat: pricePF(S.prec) });
    for (const rt of S.rts) {
      const f = indFmt(rt.inst.type);
      if (f === 'price') rt.series.forEach(s => s.applyOptions({ priceFormat: pricePF(S.prec) }));
      if (f === 'fine') rt.series.forEach(s => s.applyOptions({ priceFormat: pricePF(Math.min(8, S.prec + 2)) }));
    }
    // The chart library trips over a crosshair resting on bars that are about to be replaced, so lift it first.
    try { chart.clearCrosshairPosition(); } catch (e) { /* older library */ }
    setMainData(); S.rts.forEach(setRtData);
    chart.timeScale().scrollToRealTime();
    S.main.priceScale().applyOptions({ autoScale: true });
    syncTradeMarks(); if (S.focusTime) focusChart();
    veil(null); S.cross = null; updateLegend(); renderDetails(); syncAlertLines(); markDirty(); clockTick();
    if (src === 'binance' || src === 'paxg') {
      klineSock = Live.kline(binId(S.symbol), S.tf, onBar);
      klineSock.onReconnect = () => refreshTail(token);
    }
    if (src === 'td') tdSeriesAt = Date.now();
    if (src === 'oanda') OANDA.syncAt = Date.now();
    if (src === 'kraken') Kraken.syncAt = Date.now();
  } catch (e) {
    if (token !== S.token) return;
    if (e instanceof TDErr) { if (e.code === -1 || handleTdErr(e)) return; veil(tdMessage(e, S.symbol), true); return; }
    if (e instanceof OErr) { if (e.code === 401) { handleOandaErr(e); return; } veil(e.message, true); return; }
    veil(e && e.message && !/abort/i.test(e.message) ? e.message : `Couldn't load ${label(S.symbol)}. Check your connection.`, true);
  }
}
async function refreshTail(token) {
  try {
    const fresh = await Live.klines(binId(S.symbol), S.tf);
    if (token !== S.token || !fresh.length) return;
    const first = fresh[0].time;
    if (R.on) { R.full = R.full.filter(b => b.time < first).concat(fresh); R.idx = rpIndexFor(R.full, R.time); return; }
    const keep = S.bars.filter(b => b.time < first);
    S.bars = keep.concat(fresh); setMainData(); S.rts.forEach(setRtData); updateLegend(); markDirty();
  } catch (e) { /* the stream keeps retrying */ }
}
async function loadOlder() {
  S.older = true; const token = S.token;
  try {
    const older = await feedFor(S.symbol).klines(S.symbol, S.tf, S.bars[0].time);
    if (token !== S.token) return;
    const first = S.bars[0].time; const add = older.filter(b => b.time < first);
    if (!add.length || S.bars.length > 12000) { S.noMore = true; return; }
    if (R.on) { R.full = add.concat(R.full); R.idx += add.length; }
    S.bars = add.concat(S.bars); setMainData(); S.rts.forEach(setRtData); markDirty();
  } catch (e) {
    if (e instanceof TDErr) { handleTdErr(e); if (e.code !== 429) { S.noMore = true; return; } }
    setTimeout(() => { if (token === S.token) S.older = false; }, 30000); return;
  }
  if (token === S.token) S.older = false;
}
chart.timeScale().subscribeVisibleLogicalRangeChange(r => {
  markDirty();
  if (!r || !S.bars.length) return;
  $('#latest').hidden = r.to > S.bars.length - 2;
  if (r.from < 30 && !S.older && !S.noMore) loadOlder();
});
$('#latest').onclick = () => chart.timeScale().scrollToRealTime();

/* ---------- bar replay ----------
   Pick a past bar: the chart shows history up to it, then plays forward bar by bar.
   R.full keeps the whole history (and keeps taking live updates); S.bars is what the chart shows. */
const R = { on: false, picking: false, full: null, idx: 0, time: 0, playing: false, timer: null, hoverX: null, speed: +store.get('rpSpeed', 1) || 1 };
function rpIndexFor(arr, t) {   // last bar at or before t
  let lo = 0, hi = arr.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid].time <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}
function rpPickIndex(x) {
  const m = mapper(); if (!m) return null;
  const n = S.bars.length, max = R.on ? n - 1 : n - 2;   // leave at least one bar to play
  return max < 1 ? null : clamp(Math.round(m.L(x)), 1, max);
}
function rpStartPick() {
  if (S.bars.length < 3 || !$('#veil').hidden) { toast('Wait for the chart to load, then try again.'); return; }
  if (S.tool !== 'cursor' || S.draft) finishTool();
  select(null); rpPause();
  R.picking = true; R.hoverX = null;
  renderReplay(); markDirty();
}
function rpCancelPick() { R.picking = false; R.hoverX = null; renderReplay(); markDirty(); }
function rpPickAt(x) {
  const i = rpPickIndex(x); if (i == null) return;
  if (R.on) Paper.replayClose('Jumped to another bar');   // replay positions can't carry over to a different moment
  if (!R.on) { R.full = S.bars; R.on = true; }
  R.picking = false; R.hoverX = null;
  R.idx = i; R.time = R.full[i].time;
  S.bars = R.full.slice(0, i + 1);
  Paper.replayStart();
  rpRedraw(); renderReplay();
}
function rpRebase(bars) {   // a new symbol or timeframe loaded during a replay
  R.full = bars;
  let i = rpIndexFor(bars, R.time);
  if (i < 1) { i = Math.min(bars.length - 1, 1); toast(`${label(S.symbol)}'s history here starts later, so the replay starts at its first bars.`); }
  R.idx = i; R.time = bars[i].time;
  S.bars = bars.slice(0, i + 1);
  Paper.replayClose(`Switched to ${label(S.symbol)}`, true); Paper.replayStart();
  renderReplay();
}
function rpRedraw() {
  try { chart.clearCrosshairPosition(); } catch (e) { /* older library */ }
  setMainData(); S.rts.forEach(setRtData); syncTradeMarks();
  chart.timeScale().scrollToRealTime();
  S.main.priceScale().applyOptions({ autoScale: true });
  S.cross = null; updateLegend(); syncAlertLines(); markDirty(); clockTick();
}
function rpStep() {
  if (!R.on) return false;
  if (R.idx >= R.full.length - 1) { rpPause(); toast('The replay has caught up with the latest bar. Press Live to leave replay.'); return false; }
  R.idx++; const b = R.full[R.idx]; R.time = b.time;
  S.bars.push(b); const i = S.bars.length - 1;
  if (S.type === 'heikin') haAt(i);
  S.main.update(mainPoint(i));
  for (const rt of S.rts) updateRtLast(rt);
  if (!S.cross) updateLegend();
  renderReplayInfo(); markDirty();
  Paper.replayBar(b);   // replay trading fills from the new bar
  return true;
}
function rpBack() {
  if (!R.on || R.idx <= 1) return;
  Paper.replayClose('Stepped back');
  R.idx--; S.bars.pop(); R.time = S.bars[S.bars.length - 1].time;
  setMainData(); S.rts.forEach(setRtData);
  if (!S.cross) updateLegend();
  renderReplayInfo(); markDirty();
}
function rpPlay() {
  if (!R.on || R.playing) return;
  if (R.idx >= R.full.length - 1) { toast('The replay is already at the latest bar. Pick an earlier bar to replay.'); return; }
  R.playing = true; rpTick(); renderReplayInfo();
}
function rpTick() {
  clearTimeout(R.timer);
  if (R.playing) R.timer = setTimeout(() => { if (rpStep()) rpTick(); }, 1000 / R.speed);
}
function rpPause() { R.playing = false; clearTimeout(R.timer); renderReplayInfo(); }
function rpExit() {
  rpPause(); R.picking = false; R.hoverX = null;
  if (R.on) { Paper.replayClose('Replay ended'); S.bars = R.full; R.full = null; R.on = false; rpRedraw(); }
  renderReplay(); Paper.refresh();
}
function rpMerge(b) {   // a live update while replaying: store it; show it only if the replay sits on that very bar
  const F = R.full, n = F.length; if (!n) return;
  const atEnd = R.idx === n - 1, last = F[n - 1];
  if (b.time > last.time) { F.push(b); if (atEnd) renderReplayInfo(); }
  else if (b.time === last.time) F[n - 1] = b;
  else { const i = rpIndexFor(F, b.time); if (i >= 0 && F[i].time === b.time) F[i] = b; else return; }
  if (atEnd && b.time === R.time && S.bars.length) {
    const i = S.bars.length - 1; S.bars[i] = b;
    if (S.type === 'heikin') haAt(i);
    S.main.update(mainPoint(i)); for (const rt of S.rts) updateRtLast(rt);
    if (!S.cross) updateLegend();
  }
}
function renderReplayInfo() {
  if (!R.on) return;
  $('#rpDate').replaceChildren(el('b', null, 'Replay'), document.createTextNode(fmtTime(R.time)));
  $('#rpPlay').innerHTML = svg(R.playing ? 'pause' : 'play');
  $('#rpPlay').title = R.playing ? 'Pause (Space)' : 'Play (Space)'; $('#rpPlay').setAttribute('aria-label', R.playing ? 'Pause' : 'Play');
  $('#rpBack').disabled = R.idx <= 1; $('#rpFwd').disabled = R.idx >= R.full.length - 1;
}
function renderReplay() {
  $('#rpBar').hidden = !R.on || R.picking;
  wrap.classList.toggle('replaying', R.on && !R.picking);
  $('#replayBtn').setAttribute('aria-pressed', String(R.on || R.picking));
  setHint(); renderReplayInfo(); clockTick();
}
$('#rpPick').innerHTML = svg('pick'); $('#rpBack').innerHTML = svg('stepBack'); $('#rpFwd').innerHTML = svg('stepFwd'); $('#rpExit').innerHTML = svg('x');
$('#rpLive').insertAdjacentHTML('beforeend', svg('live'));
$('#rpSpeed').value = String(R.speed);
if (!$('#rpSpeed').value) { R.speed = 1; $('#rpSpeed').value = '1'; }
$('#replayBtn').onclick = () => { if (R.on) rpExit(); else if (R.picking) rpCancelPick(); else rpStartPick(); };
$('#rpPick').onclick = rpStartPick;
$('#rpPlay').onclick = () => { if (R.playing) rpPause(); else rpPlay(); };
$('#rpFwd').onclick = () => { rpPause(); rpStep(); };
$('#rpBack').onclick = () => { rpPause(); rpBack(); };
$('#rpSpeed').onchange = e => { R.speed = +e.target.value || 1; store.set('rpSpeed', R.speed); e.target.blur(); if (R.playing) rpTick(); };
$('#rpLive').onclick = rpExit;
$('#rpExit').onclick = rpExit;

/* ---------- symbol / timeframe / type ---------- */
function setSymbol(id) {
  if (id === S.symbol) return;
  if (S.idea && S.idea.symbol !== id) ideaLayerOff();
  S.symbol = id; store.set('symbol', id);
  S.draft = null; S.measure = null; select(null);
  wl.querySelectorAll('.wl-item').forEach(li => li.classList.toggle('active', li.dataset.sym === id));
  renderDetails(); loadChart(); ensureTickerSubs(); updateUrl();
}
function setTf(tf) { if (tf === S.tf) return; S.tf = tf; store.set('tf', tf); S.draft = null; S.measure = null; loadChart(); updateUrl(); }
function renderTf() {
  const seg = $('#tfSeg'); seg.replaceChildren();
  for (const t of TFS) { const b = el('button', 'btn', t.label); b.dataset.tf = t.id; b.title = `${t.label} bars`; b.onclick = () => setTf(t.id); seg.append(b); }
  renderTfState();
}
function renderTfState() { document.querySelectorAll('#tfSeg .btn').forEach(b => { const on = b.dataset.tf === S.tf; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); }
$('#typeSel').value = S.type;
$('#typeSel').onchange = e => { S.type = e.target.value; store.set('type', S.type); createMain(); updateLegend(); markDirty(); };

/* ---------- toolbar ---------- */
const TOOLS = [['cursor', 'Crosshair', 'Esc'], ['trend', 'Trend line', 'Alt+T'], ['ray', 'Ray', ''], ['hline', 'Horizontal line', 'Alt+H'], ['rect', 'Rectangle', 'Alt+R'], ['fib', 'Fib retracement', 'Alt+F'], ['measure', 'Measure', 'Alt+M'], ['long', 'Long position', 'Alt+L'], ['short', 'Short position', 'Alt+S'], ['alert', 'Price alert', 'Alt+A']];
let clearArm = null;
function renderTools() {
  const bar = $('#tools'); bar.replaceChildren();
  for (const [id, name, key] of TOOLS) {
    const b = el('button', 'tool'); b.dataset.tool = id; b.innerHTML = svg(id);
    b.title = key ? `${name} (${key})` : name; b.setAttribute('aria-label', name);
    b.onclick = () => setTool(id); bar.append(b);
  }
  bar.append(el('span', 'hsep'));
  const mag = el('button', 'tool'); mag.id = 'magBtn'; mag.innerHTML = svg('magnet'); mag.title = 'Magnet: snap points to open, high, low or close'; mag.setAttribute('aria-label', 'Magnet');
  mag.onclick = () => { S.magnet = !S.magnet; store.set('magnet', S.magnet); renderToolState(); toast(S.magnet ? 'Magnet on: points snap to candles' : 'Magnet off'); };
  const un = el('button', 'tool'); un.innerHTML = svg('undo'); un.title = 'Undo drawing (Ctrl+Z)'; un.setAttribute('aria-label', 'Undo drawing'); un.onclick = undo;
  const tr = el('button', 'tool'); tr.id = 'clearBtn'; tr.innerHTML = svg('trash'); tr.title = 'Remove all drawings on this symbol'; tr.setAttribute('aria-label', 'Remove all drawings');
  tr.onclick = () => {
    const n = curDrawings().length;
    if (!n) { toast(`No drawings on ${label(S.symbol)}`); return; }
    if (clearArm) { clearTimeout(clearArm); clearArm = null; tr.classList.remove('arm'); pushUndo(); S.drawings[S.symbol] = []; saveDrawings(); select(null); toast(`Removed ${n} drawing${n > 1 ? 's' : ''}. Ctrl+Z brings them back.`); return; }
    tr.classList.add('arm'); toast(`Click the bin again to remove ${n} drawing${n > 1 ? 's' : ''}`);
    clearArm = setTimeout(() => { clearArm = null; tr.classList.remove('arm'); }, 3000);
  };
  bar.append(mag, un, tr);
  renderToolState();
}
function renderToolState() {
  document.querySelectorAll('.tool[data-tool]').forEach(b => { const on = b.dataset.tool === S.tool; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  const mag = $('#magBtn'); if (mag) { mag.classList.toggle('on', S.magnet); mag.setAttribute('aria-pressed', String(S.magnet)); }
}

/* ---------- scale buttons, clock, countdown ---------- */
function setScaleMode(mode) { S.scaleMode = mode; store.set('scale', mode); S.main.priceScale().applyOptions({ mode }); renderScale(); markDirty(); }
function renderScale() {
  $('#scPct').classList.toggle('on', S.scaleMode === 2); $('#scLog').classList.toggle('on', S.scaleMode === 1);
  let auto = true; try { auto = S.main.priceScale().options().autoScale; } catch (e) { /* ignore */ }
  $('#scAuto').classList.toggle('on', auto);
}
$('#scPct').onclick = () => setScaleMode(S.scaleMode === 2 ? 0 : 2);
$('#scLog').onclick = () => setScaleMode(S.scaleMode === 1 ? 0 : 1);
$('#scAuto').onclick = () => { S.main.priceScale().applyOptions({ autoScale: true }); renderScale(); markDirty(); };
let lastOpenState = '';
function clockTick() {
  const d = new Date(), now = d.getTime() / 1000;
  markDirty();   // the timer under the live price ticks every second
  $('#clock').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${tzLabel()}`;
  const cd = $('#countdown'); cd.replaceChildren();
  if (S.bars.length) {
    const cls = classOf(S.symbol);
    if (R.on) cd.append(el('b', null, 'Replay'), document.createTextNode(' · watchlist stays live'));
    else if (S.ready && srcOf(S.symbol) === 'demo') cd.append(el('b', null, 'Saved price'));
    else if (!(S.ready && openNow(S.symbol)) && !isOpenAt(cls, now)) cd.append(el('b', null, 'Market closed'));
    else {
      let end = S.bars[S.bars.length - 1].time + tfOf(S.tf).sec;
      if (cls === 'stock' && tfOf(S.tf).sec < DAY) { const p = ny(now); end = Math.min(end, sessOpen(p.y, p.m, p.d) + 23400); }
      cd.append(document.createTextNode('Bar closes in '), el('b', null, fmtCountdown(end - now)));
    }
  }
  renderScale();
  // explain an unavoidable wait for the free Twelve Data plan's per-minute limit
  if (!$('#veil').hidden && $('#veilRetry').hidden && S.ready && srcOf(S.symbol) === 'td' && TD.nextAt > Date.now()) {
    $('#veilText').textContent = `Loading ${label(S.symbol)} in ${Math.ceil((TD.nextAt - Date.now()) / 1000)} s. Twelve Data's free plan allows 8 requests a minute.`;
  }
  // refresh "market open/closed" labels when a session starts or ends
  const sig = ['stock', 'forex'].map(c => isOpenAt(c, now)).join();
  if (S.ready && sig !== lastOpenState) { if (lastOpenState) { renderWatch(); renderDetails(); } lastOpenState = sig; }
}
setInterval(clockTick, 1000);

/* ---------- symbol search ---------- */
const sDlg = $('#searchDlg'), sInput = $('#searchInput'), sList = $('#searchList');
let sMode = 'open', sTab = 'all', sIdx = 0, sItems = [], sReq = 0;
function openSearch(mode, seed) {
  sMode = mode; $('#searchTitle').textContent = mode === 'add' ? 'Add to watchlist' : 'Symbol search';
  sInput.value = seed || ''; if (!sDlg.open) sDlg.showModal(); sInput.focus();
  runSearch();
}
$('#sTabs').addEventListener('click', e => {
  const b = e.target.closest('.s-tab'); if (!b) return;
  sTab = b.dataset.tab;
  document.querySelectorAll('#sTabs .s-tab').forEach(x => x.setAttribute('aria-selected', String(x === b)));
  runSearch(); sInput.focus();
});
async function cryptoUniverse() {
  if (S.binance) { try { return (await Live.list()).map(s => 'BINANCE:' + s); } catch (e) { /* fall back to the short list */ } }
  return Object.keys(CRYPTO_DEMO).map(s => 'BINANCE:' + s);
}
async function runSearch() {
  const req = ++sReq;
  const q = sInput.value.trim().toUpperCase().replace(/[^A-Z0-9/. ]/g, '');
  const qa = q.replace(/[^A-Z0-9]/g, '');
  let uni = [];
  const want = c => sTab === 'all' || sTab === c;
  const few = (list, n) => (sTab === 'all' && !qa ? list.slice(0, n) : list);   // "All" with nothing typed: a few of each
  if (want('stock')) uni = uni.concat(few(STOCKS.filter(s => !ETFS.has(s[0])).map(s => 'US:' + s[0]), 8));
  if (want('fund')) uni = uni.concat(few(STOCKS.filter(s => ETFS.has(s[0])).map(s => s[0]).concat(FUNDS.map(s => s[0])).map(s => 'US:' + s), 4));
  if (want('futures')) uni = uni.concat(few(Object.keys(CFD).filter(id => CFD[id].cat === 'futures'), 4));
  if (want('forex')) uni = uni.concat(few(FX.map(s => 'FX:' + s[0]), 6));
  if (want('crypto')) {
    if (S.binance && !Live.universe && qa) sList.replaceChildren(el('li', 'empty', 'Loading pairs…'));
    uni = uni.concat(qa || sTab === 'crypto' ? await cryptoUniverse() : Object.keys(CRYPTO_DEMO).slice(0, 6).map(s => 'BINANCE:' + s));
  }
  if (want('index')) uni = uni.concat(few(Object.keys(CFD).filter(id => CFD[id].cat === 'index'), 5));
  if (want('bond')) uni = uni.concat(few(Object.keys(CFD).filter(id => CFD[id].cat === 'bond'), 3));
  if (req !== sReq) return;
  const score = id => {
    if (!qa) return 2;
    const r = rawOf(id).replace(/[^A-Z0-9]/g, ''); const nm = nameOf(id).toUpperCase();
    if (r === qa) return 0; if (r.startsWith(qa)) return 1; if (nm.startsWith(q)) return 2;
    if (CFD[id] && CFD[id].words.some(w => w.replace(/[^A-Z0-9]/g, '').startsWith(qa))) return 2;
    if (classOf(id) === 'crypto' && splitSym(r)[0] === qa) return 1;
    if (r.includes(qa)) return 3; if (q.length > 2 && nm.includes(q)) return 4; return -1;
  };
  const pop = id => {
    if (id in POP) return POP[id] + (classOf(id) === 'crypto' ? 0.5 : 0);
    const qi = QUOTES.indexOf(splitSym(rawOf(id))[1]); return 100 + (qi < 0 ? 50 : qi * 5);
  };
  let res = uni.map(id => [id, score(id)]).filter(x => x[1] >= 0);
  if (qa) res.sort((a, b) => a[1] - b[1] || pop(a[0]) - pop(b[0]) || a[0].length - b[0].length);
  res = res.map(x => x[0]);
  // tickers that aren't in the built-in lists
  const extra = [];
  const stockLike = /^[A-Z]{1,5}(\.[A-Z])?$/.test(q.replace(/ /g, ''));
  const fxm = q.replace(/ /g, '').match(/^([A-Z]{3})\/?([A-Z]{3})$/);
  if (tdLive() && stockLike && (want('stock') || want('fund')) && !res.includes('US:' + q)) extra.push({ id: 'US:' + q, note: `Open ${q} as a US stock` });
  if ((tdLive() || OANDA.active()) && fxm && (sTab === 'all' || sTab === 'forex') && !res.includes(`FX:${fxm[1]}/${fxm[2]}`) && !res.some(id => rawOf(id) === fxm[1] + fxm[2])) extra.push({ id: `FX:${fxm[1]}/${fxm[2]}`, note: `Open ${fxm[1]}/${fxm[2]} as a forex pair` });
  const exact = res.length > 0 && score(res[0]) === 0;
  sItems = res.slice(0, 80).map(id => ({ id }));
  if (!exact) sItems = sItems.length ? sItems.concat(extra) : extra;
  sIdx = 0; renderSearch(q);
  const cfdTab = ['futures', 'index', 'bond'].includes(sTab);
  $('#searchFoot').textContent = (cfdTab ? (OANDA.active() ? 'Live from OANDA' + (sTab === 'futures' ? ', tracking the futures markets' : sTab === 'bond' ? ' (bond prices, not yields)' : '') + ' · ' : 'Saved prices until OANDA is connected · ')
    : srcOf('US:AAPL') === 'demo' ? 'Stocks and forex show saved prices until live data is available · ' : '') + '↑ ↓ to move, Enter to open';
}
function renderSearch(q) {
  sList.replaceChildren();
  if (!sItems.length) { sList.append(el('li', 'empty', `Nothing matches “${q}”.`)); return; }
  sItems.forEach((it, i) => {
    const id = it.id; const [b, qq] = symParts(id);
    const li = el('li', 's-item' + (i === sIdx ? ' cur' : '')); li.setAttribute('role', 'option');
    const main = el('button', 's-main');
    const name = el('b'); name.append(document.createTextNode(b), el('span', null, classOf(id) === 'crypto' && qq ? ' / ' + qq : qq));
    main.append(name, el('em', null, it.note || nameOf(id)));
    main.onclick = () => choose(id);
    const tag = el('span', 's-tag', kindOf(id));
    const star = el('button', 'star'); star.innerHTML = svg('star');
    const sync = () => { const on = S.watch.includes(id); star.setAttribute('aria-pressed', String(on)); star.setAttribute('aria-label', on ? `Remove ${label(id)} from the watchlist` : `Add ${label(id)} to the watchlist`); };
    star.onclick = () => {
      if (S.watch.includes(id)) { S.watch = S.watch.filter(s => s !== id); store.set('watch', S.watch); renderWatch(); ensureTickerSubs(); }
      else addWatch(id);
      sync();
    };
    sync();
    li.append(main, tag, star); sList.append(li);
  });
}
function choose(id) { if (sMode === 'add') addWatch(id); sDlg.close(); if (curView() !== 'chart') { setView('chart', true); window.scrollTo(0, 0); } setSymbol(id); }
sInput.addEventListener('input', runSearch);
sInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if (!sItems.length) return;
    sIdx = (sIdx + (e.key === 'ArrowDown' ? 1 : -1) + sItems.length) % sItems.length;
    sList.querySelectorAll('.s-item').forEach((li, i) => li.classList.toggle('cur', i === sIdx));
    const cur = sList.children[sIdx]; if (cur) cur.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') { e.preventDefault(); if (sItems[sIdx]) choose(sItems[sIdx].id); }
});
$('#symBtn').onclick = () => openSearch('open');
$('#dSym').onclick = () => openSearch('open');

/* ---------- indicator dialogs ---------- */
const iDlg = $('#indDlg');
let indCat = 'all';
function indMatches() {   // the indicators that fit the search box and the chosen group
  const q = $('#indSearch').value.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean);
  return Object.entries(IND).filter(([type, def]) => {
    if (indCat !== 'all' && def.cat !== indCat) return false;
    const hay = `${def.label} ${def.short(Object.fromEntries(def.params.map(p => [p.k, p.def])))} ${def.alias || ''} ${type}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
}
function renderIndTabs() {
  const tabs = $('#indTabs'); tabs.replaceChildren();
  for (const [v, name] of [['all', 'All']].concat(IND_CATS)) {
    const b = el('button', 's-tab', name); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(indCat === v));
    b.onclick = () => { indCat = v; renderIndTabs(); renderIndList(); }; tabs.append(b);
  }
}
function renderIndList() {
  const list = $('#indList'); list.replaceChildren();
  const found = indMatches(), grouped = !$('#indSearch').value.trim() && indCat === 'all';
  if (!found.length) { list.append(el('li', 'i-none', 'No indicator matches. Try another name, such as RSI or moving average.')); return; }
  const order = IND_CATS.map(c => c[0]);
  found.sort((a, b) => order.indexOf(a[1].cat) - order.indexOf(b[1].cat));
  let cat = null;
  for (const [type, def] of found) {
    if (grouped && def.cat !== cat) { cat = def.cat; list.append(el('li', 'i-grp', (IND_CATS.find(c => c[0] === cat) || [, ''])[1])); }
    const n = S.rts.filter(r => r.inst.type === type).length;
    const b = el('button', 'i-item'); b.dataset.type = type;
    const add = el('span', 'add'); if (n) add.append(el('span', null, `${n} on chart`)); add.append(document.createTextNode('Add'));
    b.append(el('b', null, def.label), add, el('small', null, def.desc));
    b.onclick = () => { if (type === 'vol' && n) { toast('Volume is already on the chart'); return; } addIndicator(type); renderIndList(); };
    const li = el('li'); li.append(b); list.append(li);
  }
}
$('#indSearch').oninput = () => renderIndList();
$('#indSearch').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const first = $('#indList .i-item'); if (first) first.click(); } };
$('#indBtn').onclick = () => { $('#indSearch').value = ''; indCat = 'all'; renderIndTabs(); renderIndList(); iDlg.showModal(); $('#indSearch').focus(); };
const setDlg = $('#setDlg'); let setRt = null, setColor = null;
function openSettings(rt) {
  setRt = rt; setColor = rt.inst.color;
  const def = IND[rt.inst.type];
  $('#setTitle').textContent = `${def.label} settings`;
  const f = $('#setFields'); f.replaceChildren();
  for (const p of def.params) {
    const lab = el('label', null, p.label);
    const inp = el('input', 'field'); inp.type = 'number'; inp.id = 'set-' + p.k; inp.min = p.min; inp.max = p.max; inp.step = p.step; inp.value = rt.inst.params[p.k];
    lab.append(inp); f.append(lab);
  }
  $('#setColorWrap').hidden = !!def.nocolor;
  const sw = $('#setSw'); sw.replaceChildren();
  for (const c of PALETTE) {
    const b = el('button', 'sw'); b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', `Colour ${c}`); b.setAttribute('aria-pressed', String(c === setColor));
    b.onclick = () => { setColor = c; sw.querySelectorAll('.sw').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
    sw.append(b);
  }
  setDlg.showModal();
}
$('#setForm').addEventListener('submit', e => {
  e.preventDefault(); if (!setRt) return;
  const def = IND[setRt.inst.type]; const params = {};
  for (const p of def.params) {
    const v = Number($('#set-' + p.k).value);
    if (!isFinite(v) || v < p.min || v > p.max) { toast(`${p.label} must be between ${p.min} and ${p.max}`); $('#set-' + p.k).focus(); return; }
    params[p.k] = p.step < 1 ? v : Math.round(v);
  }
  const bad = def.check ? def.check(params) : ''; if (bad) { toast(bad); return; }
  setRt.inst.params = params; if (!def.nocolor) setRt.inst.color = setColor;
  setRt.nm.textContent = def.short(params);
  recolorRt(setRt); if (S.bars.length) setRtData(setRt);
  saveInd(); updateLegend(); setDlg.close();
});

/* ---------- feed badge & data sources ---------- */
function renderFeed() {
  const b = $('#feedBtn'), note = $('#srcNote');
  let state = 'connecting', lbl = 'Connecting';
  if (S.ready) {
    const src = srcOf(S.symbol);
    if (src === 'demo') { state = 'demo'; lbl = 'Not live'; }
    else if (src === 'binance' || src === 'paxg') { state = conn.binance === 'reconnecting' ? 'reconnecting' : 'live'; lbl = state !== 'live' ? 'Reconnecting' : src === 'paxg' ? 'Live · PAXG' : 'Live · ' + Live.name; }
    else if (src === 'oanda') { state = 'live'; lbl = 'Live · OANDA'; }
    else if (src === 'metal') { state = 'live'; lbl = 'Live price'; }
    else if (src === 'kraken') { state = 'live'; lbl = S.symbol === GOLD ? 'Live · PAXG' : 'Live · Kraken'; }
    else { state = 'live'; lbl = 'Live · Twelve Data'; }
    note.hidden = !['demo', 'paxg', 'metal', 'kraken'].includes(src);
    if (src === 'paxg') note.textContent = 'Gold shown as PAX Gold (PAXG), a gold-backed token that tracks spot gold. Add a Twelve Data key for exact spot XAU/USD.';
    if (src === 'kraken') note.textContent = S.symbol === GOLD ? 'Gold shown as PAX Gold on Kraken, which trades within cents of spot gold. The spot price is on the right.' : `Live ${label(S.symbol)} from Kraken’s market, which tracks the interbank rate closely.`;
    if (src === 'metal') note.textContent = 'Live spot price from gold-api.com. Earlier candles are illustrative.';
    note.title = note.textContent;
    if (src === 'demo') {
      const asof = asOfText(S.symbol);
      note.textContent = S.sandbox ? `Not live: this page can't reach the internet here. Showing the real price from ${asof}.`
        : classOf(S.symbol) === 'crypto' ? `No crypto exchange can be reached, so this is the real price from ${asof}.`
        : TD.state === 'bad' ? `Twelve Data key rejected, so this is the real price from ${asof}.`
        : TD.state === 'limit' ? `Today's free Twelve Data allowance is used up, so this is the real price from ${asof}. Live prices return at midnight UTC.`
        : `Real price from ${asof}. Add a free Twelve Data key for live prices.`;
      note.title = note.textContent + ' Earlier candles are illustrative.';
    }
  }
  b.dataset.state = state; $('#feedLbl').textContent = lbl;
}
$('#srcNote').onclick = () => openSources();
$('#feedBtn').onclick = () => openSources();
function stateChip(text, kind) { return el('span', 'state ' + kind, text); }
function openSources() { renderSources(); if (!$('#srcDlg').open) $('#srcDlg').showModal(); }
function renderSources() {
  const body = $('#srcBody'); body.replaceChildren();
  if (S.sandbox) {
    const box = el('div', 'src');
    const h = el('div', 'src-h'); h.append(el('b', null, 'Why prices here are not live'), stateChip('Saved prices', 'warn'));
    box.append(h, el('p', null, "This preview can't reach the internet. Each price shown is a real price saved when the page was built (see the list below), and it does not move. The earlier candles on the chart are illustrative: they end at the real price, but their shape is not real market history."),
      el('p', null, 'Put the page on any free web host and it switches to live prices by itself:'));
    const ol = el('ol', 'steps');
    ['Get this page as a single index.html file.', 'Drag it onto Netlify Drop, or upload it to GitHub Pages or Cloudflare Pages.', 'Open the link you get. Crypto goes live straight away. For stocks and forex, add a free Twelve Data key in this window.'].forEach(t => ol.append(el('li', null, t)));
    const links = el('div', 'links');
    [['Netlify Drop', 'https://app.netlify.com/drop'], ['GitHub Pages', 'https://pages.github.com/'], ['Cloudflare Pages', 'https://pages.cloudflare.com/']].forEach(([n, u]) => { const a = el('a', null, n); a.href = u; a.target = '_blank'; a.rel = 'noopener'; links.append(a); });
    box.append(ol, links); body.append(box);
  }
  // crypto
  const cb = el('div', 'src'); const ch = el('div', 'src-h');
  ch.append(el('b', null, `Crypto · ${S.binance ? Live.name : 'Binance, OKX or Bybit'}`), S.binance ? stateChip(conn.binance === 'reconnecting' ? 'Reconnecting' : 'Live', conn.binance === 'reconnecting' ? 'warn' : 'ok') : stateChip('Saved prices', 'warn'));
  cb.append(ch, el('p', 'fine', S.binance
    ? `Real-time spot prices from ${Live.name}’s public market data. No key needed.${Live.name !== 'Binance' ? ' Binance doesn’t answer from your location, so the page switched to ' + Live.name + ' automatically.' : ''}`
    : "None of Binance, OKX or Bybit can be reached from here, so crypto shows the saved prices listed below."));
  body.append(cb);
  // stocks & forex
  // forex & gold from OANDA
  const ob = el('div', 'src'), oh = el('div', 'src-h');
  const oChip = { ok: ['Connected', 'ok'], bad: ['Token rejected', 'bad'], offline: ["Can't reach OANDA", 'warn'], off: ['Not connected', 'warn'] }[OANDA.state];
  oh.append(el('b', null, 'Forex & gold · OANDA'), stateChip(oChip[0], oChip[1]));
  ob.append(oh);
  ob.append(el('p', 'fine', OANDA.proxy
    ? 'This site shows OANDA’s forex, gold, indices, commodities and bonds to every visitor, through the site’s own secure helper. Nobody needs to enter a token.'
    : 'OANDA isn’t set up for this site. Forex and gold come from the other sources below.'));
  body.append(ob);

  const tb = el('div', 'src'); const th = el('div', 'src-h');
  const tState = { ok: ['Live', 'ok'], bad: ['Key rejected', 'bad'], offline: [TD.key ? 'Unreachable' : 'Saved prices', 'warn'], nokey: ['No key · saved prices', 'warn'], limit: ['Used up today', 'warn'] }[TD.state] || ['Saved prices', 'warn'];
  th.append(el('b', null, 'US stocks, ETFs & forex · Twelve Data'), stateChip(tState[0], tState[1]));
  tb.append(th, el('p', 'fine', 'Real prices for US stocks and ETFs come from Twelve Data.'));
  if ((API || CFG.twelveDataKey) && !store.get('tdkey', '')) tb.append(el('p', 'fine', 'This site already has a key, kept safely on its own helper, so stocks are live for every visitor. You only need your own free key if the shared daily limit runs out. Your own key stays in this browser and is only sent to Twelve Data.'));
  if (!S.sandbox) {
    const ol = el('ol', 'steps');
    ['Create a free Twelve Data account (Basic plan).', 'Copy the API key from your Twelve Data dashboard.', 'Paste it below and press Save.'].forEach(t => ol.append(el('li', null, t)));
    const links = el('div', 'links'); const a = el('a', null, 'Get a free Twelve Data key'); a.href = 'https://twelvedata.com/pricing'; a.target = '_blank'; a.rel = 'noopener'; links.append(a);
    const form = el('form'); form.noValidate = true;
    const lab = el('label', 'fine', 'API key'); lab.htmlFor = 'tdKey';
    const row = el('div', 'key-row');
    const inp = el('input', 'field'); inp.id = 'tdKey'; inp.type = 'password'; inp.autocomplete = 'off'; inp.spellcheck = false; const own = !!store.get('tdkey', '');
    inp.placeholder = own ? 'Your key is saved · paste a new one to replace it' : (API || CFG.twelveDataKey) ? 'Optional: use your own key instead' : 'Paste your key';
    const save = el('button', 'primary', 'Save'); save.type = 'submit';
    row.append(inp, save);
    if (own) {
      const rm = el('button', 'ghost', 'Remove key'); rm.type = 'button';
      rm.onclick = () => {
        store.set('tdkey', ''); TD.key = API ? 'site' : CFG.twelveDataKey; TD.state = !TD.key ? 'nokey' : S.tdReach ? 'ok' : 'offline';
        switchSources(); renderSources();
        toast(TD.key ? 'Your key was removed. Using the site’s data again.' : 'Key removed. Stocks and forex now show saved prices.');
      };
      row.append(rm);
    }
    form.append(lab, row);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = inp.value.trim();
      if (!/^[A-Za-z0-9_-]{8,80}$/.test(v)) { toast("That doesn't look like a Twelve Data key. Copy it again from your dashboard."); inp.focus(); return; }
      TD.key = v; store.set('tdkey', v); TD.state = S.tdReach ? 'ok' : 'offline';
      switchSources(); renderSources();
      toast(TD.state === 'ok' ? 'Key saved. Loading real stock and forex prices.' : "Key saved, but Twelve Data can't be reached right now.");
    });
    tb.append(ol, links, form);
    const used = TD.used();
    const us = el('div', 'usage'); const meter = el('div', 'meter'); const fill = el('i'); fill.style.width = Math.min(100, (used / 800) * 100) + '%'; meter.append(fill);
    us.append(el('span', null, `Used today in this browser: ${used} of 800 free requests (resets at midnight UTC)`), meter);
    tb.append(us, el('p', 'fine', 'To stay inside the free plan (8 requests a minute), the page streams up to 8 symbols live and refreshes the rest every 10 minutes. Opening a chart uses one request.'));
  }
  body.append(tb);
  const kb = el('div', 'src'), kh = el('div', 'src-h');
  kh.append(el('b', null, 'Forex majors & gold · Kraken (no key)'), Kraken.ok ? stateChip('Live', 'ok') : stateChip('Not reachable', 'warn'));
  kb.append(kh, el('p', 'fine', 'For every visitor, with nothing to set up: EUR/USD, GBP/USD, USD/JPY, USD/CHF, USD/CAD, AUD/USD, EUR/GBP, EUR/JPY, EUR/CHF, EUR/AUD, EUR/CAD and AUD/JPY come live from Kraken’s public market data, and gold comes from PAX Gold on Kraken, which trades within cents of spot. OANDA or Twelve Data take over when connected. Other pairs (such as USD/PKR, USD/TRY or USD/INR) need one of those.'));
  body.append(kb);
  const gs = srcOf(GOLD), mb = el('div', 'src'), mh = el('div', 'src-h');
  mh.append(el('b', null, 'Gold & silver without a key'), stateChip(gs === 'td' ? 'Using Twelve Data' : gs === 'demo' ? 'Saved prices' : 'Live', gs === 'demo' ? 'warn' : 'ok'));
  mb.append(mh, el('p', 'fine', 'Without OANDA or a Twelve Data key, gold follows PAX Gold (PAXG/USDT on Binance or OKX), a token backed by physical gold. It tracks spot gold closely, usually within a few dollars, and also trades at weekends. The spot price from gold-api.com is shown next to it. Silver uses the live spot price from gold-api.com, with illustrative older candles. Add a Twelve Data key for exact spot XAU/USD and XAG/USD candles.'));
  body.append(mb);
  if (!S.binance || !tdLive()) {
    const sb = el('div', 'src'); const sh = el('div', 'src-h');
    sh.append(el('b', null, 'Saved prices used when a market isn’t live'), stateChip('Not live', 'warn'));
    const ul = el('ol', 'steps');
    [`Crypto: Binance, ${asOfText('BINANCE:BTCUSDT')}.`,
     'US stocks and ETFs: closing prices on Fri 9 Oct (Slickcharts).',
     'Forex: European Central Bank reference rates for Fri 9 Oct, with change from Thu 8 Oct (via Frankfurter). USD/PKR: ExchangeRate-API, 11 Oct.',
     'Gold and silver: Fri 9 Oct close (Gold API). Daily change not available.'].forEach(t => ul.append(el('li', null, t)));
    sb.append(sh, ul, el('p', 'fine', 'These were saved when the page was built and do not update. Earlier candles on the chart are illustrative.'));
    body.append(sb);
  }
  body.append(el('p', 'fine', `Times are shown in your time zone (${tzLabel()}); daily bars are dated in UTC. Market data is for information only and is not financial advice.`));
}

/* ---------- chart image, share link, full screen, shortcuts, tab title ---------- */
const FONT_BODY = "'IBM Plex Sans', system-ui, sans-serif";
function shareQuery() {
  const r = rawOf(S.symbol), s = classOf(S.symbol) === 'forex' ? r.replace('/', '-') : r;
  return `?s=${encodeURIComponent(s)}&tf=${S.tf}`;
}
function shareUrl() { return location.href.split(/[?#]/)[0] + shareQuery(); }
function updateUrl() {
  if (!S.ready || S.sandbox || curView() !== 'chart') return;
  try { history.replaceState(null, '', shareQuery()); } catch (e) { /* address can't be changed here */ }
}
function updateDocTitle() {
  if (curView() === 'home') { document.title = `${CFG.siteName} · Free live charts, paper trading and a trading journal`; return; }
  if (curView() === 'journal') { document.title = `Trade journal · ${CFG.siteName}`; return; }
  if (curView() === 'ideas') { document.title = ID.open && ID.cur ? `${ID.cur.title} · Ideas · ${CFG.siteName}` : `Ideas · ${CFG.siteName}`; return; }
  const t = S.tickers[S.symbol];
  const px = t ? ' ' + fmtP(t.last, t.prec) : '';
  const pct = t && t.ref ? ' ' + fmtPct(((t.last - t.ref) / t.ref) * 100) : '';
  document.title = `${label(S.symbol)}${px}${pct} · ${CFG.siteName}`;
}
$('#linkBtn').onclick = () => {
  const url = shareUrl();
  try { navigator.clipboard.writeText(url).then(() => toast('Link copied. Anyone who opens it sees this chart.'), () => toast(url)); }
  catch (e) { toast(url); }
};
$('#snapBtn').onclick = () => {
  try {
    if (!S.bars.length) { toast('Wait for the chart to load first.'); return; }
    const shot = chart.takeScreenshot();
    const W = shot.width, H = shot.height, k = W / Math.max(1, wrap.clientWidth), head = Math.round(40 * k);
    const out = document.createElement('canvas'); out.width = W; out.height = H + head;
    const g = out.getContext('2d');
    g.fillStyle = C.panel; g.fillRect(0, 0, out.width, out.height);
    g.drawImage(shot, 0, head);
    g.drawImage(ov, 0, head, W, H);
    g.strokeStyle = C.line; g.lineWidth = Math.max(1, k); g.beginPath(); g.moveTo(0, head - 0.5); g.lineTo(W, head - 0.5); g.stroke();
    const last = S.bars[S.bars.length - 1];
    g.textBaseline = 'middle'; g.fillStyle = C.fg; g.font = `600 ${Math.round(15 * k)}px ${FONT_BODY}`;
    g.fillText(`${label(S.symbol)} · ${tfOf(S.tf).label} · ${fmtP(last.close)}${R.on ? ` · Replay ${fmtTime(R.time)}` : ''}`, 12 * k, head / 2);
    const d = new Date();
    g.textAlign = 'right'; g.fillStyle = C.muted; g.font = `400 ${Math.round(12 * k)}px ${FONT_BODY}`;
    g.fillText(`${CFG.siteName} · ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`, W - 12 * k, head / 2);
    out.toBlob(b => {
      if (!b) { toast("Couldn't save the chart image."); return; }
      const url = URL.createObjectURL(b), a = document.createElement('a');
      a.href = url; a.download = `${label(S.symbol).replace('/', '')}-${S.tf}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.png`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Chart image saved to your downloads.');
    }, 'image/png');
  } catch (e) { toast("Couldn't save the chart image."); }
};
$('#fsBtn').hidden = !document.fullscreenEnabled;
$('#fsBtn').onclick = () => {
  const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  if (p && p.catch) p.catch(() => toast("Full screen isn't available here."));
};
document.addEventListener('fullscreenchange', () => $('#fsBtn').setAttribute('aria-pressed', String(!!document.fullscreenElement)));
const helpDlg = $('#helpDlg');
function openHelp() { if (!helpDlg.open) helpDlg.showModal(); }
$('#helpBtn').onclick = openHelp;

// Catch up after the tab has been in the background for a while.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (!S.ready || !hiddenAt || Date.now() - hiddenAt < 60000) return;
  const src = srcOf(S.symbol);
  if ((src === 'binance' || src === 'paxg') && S.bars.length) refreshTail(S.token);
  if (src === 'td' && S.bars.length && marketOpen(S.symbol)) { tdSeriesAt = Date.now(); pollSeries(); }
  if (tdLive()) {
    const ids = tickerSet().filter(id => srcOf(id) === 'td' && marketOpen(id) && !TDWS.covers(id));
    if (ids.length) { tdQuoteAt = Date.now(); tdQuote(ids, 1); }
  }
});

/* ---------- dialogs: shared close behaviour ---------- */
document.querySelectorAll('dialog').forEach(d => {
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
});

/* ---------- toasts ---------- */
function toast(msg, kind) {
  const t = el('div', 'toast' + (kind ? ' ' + kind : ''));
  if (kind === 'alert') t.innerHTML = svg('bell');
  t.append(el('span', null, msg));
  const box = $('#toasts'); box.append(t);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => t.remove(), kind === 'alert' ? 9000 : 3600);
}

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.target.isContentEditable) return;
  if (document.querySelector('dialog[open]')) return;
  if (curView() === 'home' && !e.ctrlKey && !e.metaKey && !e.altKey && (/^[a-z0-9]$/i.test(e.key) || e.key === '/')) { e.preventDefault(); openSearch('open', e.key === '/' ? '' : e.key); return; }   // typing on the home page searches
  if (curView() !== 'chart') return;
  if (e.key === 'Escape' && R.picking) { rpCancelPick(); return; }
  if (e.key === 'Escape') { if (S.tool !== 'cursor' || S.draft) finishTool(); select(null); S.measure = null; markDirty(); return; }
  if (R.on && !R.picking && e.key === ' ') {
    e.preventDefault();
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();   // so Space doesn't also press the focused button
    if (R.playing) rpPause(); else rpPlay(); return;
  }
  if (R.on && !R.picking && e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); rpPause(); if (e.key === 'ArrowRight') rpStep(); else rpBack(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && S.selected) { e.preventDefault(); deleteSelected(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const k = (e.code || '').replace('Key', '').toLowerCase();
    if (k === 'a') { e.preventDefault(); if (S.crossPrice != null) createAlert(S.symbol, S.crossPrice); else setTool('alert'); return; }
    const map = { t: 'trend', h: 'hline', f: 'fib', r: 'rect', m: 'measure', l: 'long', s: 'short' };
    if (map[k]) { e.preventDefault(); setTool(map[k]); }
    return;
  }
  if (e.key === '?') { e.preventDefault(); openHelp(); return; }
  if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && (e.code === 'KeyB' || e.code === 'KeyS')) { e.preventDefault(); Paper.hotkey(e.code === 'KeyB' ? 'buy' : 'sell'); return; }
  if (!e.ctrlKey && !e.metaKey && /^[a-z0-9]$/i.test(e.key)) { e.preventDefault(); openSearch('open', e.key); }
});

/* ---------- theme ---------- */
const mq = window.matchMedia('(prefers-color-scheme: dark)');
function isDark() { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : mq.matches; }
$('#themeBtn').onclick = () => { const t = isDark() ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', t); store.set('theme', t); };
{ const t = store.get('theme', ''); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); }
function applyTheme() {
  readColors();
  chart.applyOptions({
    layout: { background: { type: 'solid', color: C.panel }, textColor: C.muted, panes: { separatorColor: C.line, separatorHoverColor: alpha(C.accent, 0.35) } },
    grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
    crosshair: { vertLine: { color: C.faint, labelBackgroundColor: C.crossLabel }, horzLine: { color: C.faint, labelBackgroundColor: C.crossLabel } },
    rightPriceScale: { borderColor: C.line }, timeScale: { borderColor: C.line },
  });
  if (S.main) { S.main.applyOptions(mainStyle()[1]); syncAlertLines(); }
  S.rts.forEach(recolorRt);
  updateWatermark(); updateLegend(); if (S.selected) select(S.selected); markDirty();
  if (JR.eq) {
    JR.eq.applyOptions({ layout: { background: { type: 'solid', color: C.panel }, textColor: C.muted }, grid: { horzLines: { color: C.grid } }, crosshair: { vertLine: { color: C.faint, labelBackgroundColor: C.crossLabel } } });
    JR.eqSeries.applyOptions({ topLineColor: C.up, topFillColor1: alpha(C.up, 0.14), topFillColor2: alpha(C.up, 0.02), bottomLineColor: C.down, bottomFillColor1: alpha(C.down, 0.02), bottomFillColor2: alpha(C.down, 0.14) });
  }
  syncTradeMarks();
  ideasRetheme();
}
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
if (mq.addEventListener) mq.addEventListener('change', applyTheme);

/* ---------- accounts: sign in with Google, profile, and syncing the setup across devices ----------
   Supabase keeps the accounts. The browser only ever holds the public "publishable" key; the database rules
   (row level security) let each person read and change only their own profile and saved setup. */
const SYNC_KEYS = ['watch', 'wlFold', 'drawings', 'ind', 'alerts', 'symbol', 'tf', 'type', 'scale', 'magnet', 'rpSpeed', 'theme', 'jset', 'paper'];
function cleanState(d) {   // saved data is checked before it's used, whatever is in the database
  const o = {}; if (!d || typeof d !== 'object' || Array.isArray(d)) return o;
  const isId = v => typeof v === 'string' && v.length <= 40 && /^[A-Z0-9.:/_-]+$/.test(v);
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  if (Array.isArray(d.watch)) o.watch = d.watch.filter(isId).slice(0, 300);
  if (Array.isArray(d.wlFold)) o.wlFold = d.wlFold.filter(v => typeof v === 'string' && /^[a-z]{3,8}$/.test(v)).slice(0, 10);
  if (isObj(d.drawings)) { o.drawings = {}; for (const [k, v] of Object.entries(d.drawings)) if (isId(k) && Array.isArray(v)) o.drawings[k] = v.filter(x => isObj(x) && typeof x.type === 'string' && x.type.length < 12).slice(0, 500); }
  if (Array.isArray(d.ind)) o.ind = d.ind.filter(x => isObj(x) && typeof x.type === 'string').slice(0, 30);
  if (Array.isArray(d.alerts)) o.alerts = d.alerts.filter(x => isObj(x) && isId(x.sym) && typeof x.price === 'number' && isFinite(x.price) && (x.dir === 'above' || x.dir === 'below')).slice(0, 200);
  if (isId(d.symbol)) o.symbol = d.symbol;
  if (TFS.some(t => t.id === d.tf)) o.tf = d.tf;
  if (['candles', 'bars', 'heikin', 'line', 'area'].includes(d.type)) o.type = d.type;
  if ([0, 1, 2].includes(d.scale)) o.scale = d.scale;
  if (typeof d.magnet === 'boolean') o.magnet = d.magnet;
  if (typeof d.rpSpeed === 'number' && d.rpSpeed > 0 && d.rpSpeed <= 50) o.rpSpeed = d.rpSpeed;
  if (d.theme === 'light' || d.theme === 'dark') o.theme = d.theme;
  if (isObj(d.jset) && typeof d.jset.ccy === 'string' && /^[A-Z]{3}$/.test(d.jset.ccy)) o.jset = { ccy: d.jset.ccy };
  if (isObj(d.paper)) o.paper = ptClean(d.paper);
  return o;
}
const safeAvatar = u => (typeof u === 'string' && /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\/[^\s"'<>]*$/i.test(u) ? u : '');
const Auth = {
  sb: null, user: null, profile: null, status: 'saved', timer: null, busy: false, again: false,
  enabled() {
    return !!(window.supabase && window.supabase.createClient && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(CFG.supabaseUrl) && /^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(CFG.supabaseKey)
      && location.protocol === 'https:' && window.top === window.self);
  },
  async init() {
    if (!this.enabled()) return;
    this.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'wickline-auth' },
    });
    $('#acctBtn').hidden = false; this.render();
    // Don't call Supabase from inside this callback (it can deadlock); hand off to the next turn.
    this.sb.auth.onAuthStateChange((event, session) => setTimeout(() => this.onSession(event, session), 0));
    const q = new URLSearchParams(location.search);
    if (q.get('error')) toast(q.get('error') === 'access_denied' ? 'Sign-in was cancelled.' : "Sign-in didn't work. Please try again.");
  },
  async onSession(event, session) {
    const u = session && session.user;
    // tidy the address after coming back from Google
    const url = new URL(location.href);
    if (['code', 'error', 'error_code', 'error_description', 'state'].some(k => url.searchParams.has(k))) {
      ['code', 'error', 'error_code', 'error_description', 'state'].forEach(k => url.searchParams.delete(k));
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    if (u && (!this.user || this.user.id !== u.id)) {
      this.user = u; this.render();
      store.onSet = k => { if (SYNC_KEYS.includes(k)) this.schedule(); };
      await this.loadProfile();
      await this.pull();
      await Journal.account();
      Ideas.account();
      if (event === 'SIGNED_IN' && !sessionStorage.getItem('wickline:welcomed')) { sessionStorage.setItem('wickline:welcomed', '1'); toast(`Signed in as ${this.name()}. Your setup is saved to your account.`); }
    } else if (!u && this.user) {
      this.user = null; this.profile = null; store.onSet = null; this.render(); Ideas.account();
    }
  },
  name() { return (this.profile && this.profile.display_name) || (this.user && (this.user.user_metadata.full_name || this.user.email)) || 'you'; },
  async loadProfile() {
    const { data } = await this.sb.from('profiles').select('display_name, avatar_url').eq('id', this.user.id).maybeSingle();
    this.profile = data || { display_name: this.user.user_metadata.full_name || '', avatar_url: this.user.user_metadata.avatar_url || '' };
    this.render();
  },
  async pull() {
    const { data, error } = await this.sb.from('user_state').select('data, updated_at').eq('user_id', this.user.id).maybeSingle();
    if (error) { this.setStatus('error'); return; }
    if (!data) { await this.save(); return; }   // first sign-in: this browser's setup becomes the account's
    if (data.updated_at === store.get('syncedAt', '')) { this.setStatus('saved'); return; }   // already up to date
    // The account was changed on another device (or this is a new one): use the account's setup.
    const clean = cleanState(data.data);
    if (sessionStorage.getItem('wickline:applied') === data.updated_at) return;   // never reload twice for the same version
    sessionStorage.setItem('wickline:applied', data.updated_at);
    for (const k of SYNC_KEYS) if (k in clean) store.raw(k, clean[k]);
    store.raw('syncedAt', data.updated_at);
    location.replace(location.pathname + viewQuery());   // a clean address, so the account's chart opens (not the one in the old address)
  },
  schedule() {
    if (!this.user) return;
    clearTimeout(this.timer); this.setStatus('saving');
    this.timer = setTimeout(() => this.save(), 1500);
  },
  async save() {
    if (!this.user) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true; clearTimeout(this.timer); this.timer = null;
    const data = {}; for (const k of SYNC_KEYS) { const v = store.get(k, null); if (v != null) data[k] = v; }
    try {
      const { data: row, error } = await this.sb.from('user_state').upsert({ user_id: this.user.id, data }, { onConflict: 'user_id' }).select('updated_at').single();
      if (error) throw error;
      store.raw('syncedAt', row.updated_at); this.setStatus('saved');
    } catch (e) {
      this.setStatus('error'); clearTimeout(this.timer); this.timer = setTimeout(() => this.save(), 30000);
    } finally {
      this.busy = false;
      if (this.again) { this.again = false; this.save(); }
    }
  },
  setStatus(st) { this.status = st; const box = $('#acctSync'); if (box) { box.dataset.s = st; box.lastChild.textContent = { saved: 'Your setup is saved to your account.', saving: 'Saving…', error: "Couldn't save. It will try again in a moment." }[st]; } },
  signIn() {
    $('#googleBtn').disabled = true;
    const back = curView() === 'chart' ? shareQuery() : viewQuery();
    this.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname + back } })
      .then(({ error }) => { if (error) { $('#googleBtn').disabled = false; toast("Couldn't start sign-in. Please try again."); } });
  },
  forgetLocal() { for (const k of SYNC_KEYS.concat(['syncedAt'])) store.raw(k, null); },
  async signOut() {
    clearTimeout(this.timer); if (this.status === 'saving') await this.save();
    await this.sb.auth.signOut({ scope: 'local' }).catch(() => {});
    this.forgetLocal();   // don't leave this account's setup on a shared computer
    location.reload();
  },
  async deleteAccount() {
    const go = $('#delGo'); go.disabled = true; go.textContent = 'Deleting…';
    const { data, error } = await this.sb.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
    if (error || !data || !data.deleted) { go.disabled = false; go.textContent = 'Delete my account'; toast("The account couldn't be deleted. Please try again."); return; }
    await this.sb.auth.signOut({ scope: 'local' }).catch(() => {});
    this.forgetLocal(); sessionStorage.setItem('wickline:deleted', '1');
    location.reload();
  },
  pic(cls) {
    const box = el('span', cls), src = safeAvatar(this.profile && this.profile.avatar_url);
    if (src) { const img = el('img', 'avatar'); img.alt = ''; img.referrerPolicy = 'no-referrer'; img.src = src; img.onerror = () => { img.replaceWith(el('span', 'avatar-letter', this.name().trim().charAt(0).toUpperCase() || '?')); }; box.append(img); }
    else box.append(el('span', 'avatar-letter', this.name().trim().charAt(0).toUpperCase() || '?'));
    return box;
  },
  render() {
    const b = $('#acctBtn'); b.replaceChildren();
    if (!this.user) {
      b.className = 'acct-btn'; b.title = 'Sign in to save your setup to your account'; b.setAttribute('aria-label', 'Sign in');
      b.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.8 19.5c1.3-3.3 4-5 7.2-5s5.9 1.7 7.2 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>');
      b.append(el('span', null, 'Sign in'));
      $('#acctMenu').hidden = true;
    } else {
      b.className = 'acct-btn in'; b.title = `Signed in as ${this.name()}`; b.setAttribute('aria-label', `Your account: ${this.name()}`);
      b.append(this.pic('pic-small'));
      if (!$('#acctMenu').hidden) this.renderMenu();
    }
  },
  renderMenu() {
    const m = $('#acctMenu'); m.replaceChildren();
    const top = el('div', 'acct-top'); const who = el('div'); who.style.minWidth = '0';
    who.append(el('b', null, this.name()), el('span', null, this.user.email || ''));
    top.append(this.pic('pic'), who);
    const sync = el('p', 'acct-sync'); sync.id = 'acctSync'; sync.append(el('i'), el('span', null, ''));
    const acts = el('div', 'acct-actions');
    const out = el('button', 'ghost', 'Sign out'); out.type = 'button'; out.onclick = () => this.signOut();
    const del = el('button', 'danger', 'Delete my account…'); del.type = 'button';
    del.onclick = () => { m.hidden = true; $('#delConfirm').value = ''; $('#delGo').disabled = true; $('#delGo').textContent = 'Delete my account'; $('#delDlg').showModal(); $('#delConfirm').focus(); };
    acts.append(out, del);
    const links = el('p', 'acct-links'); const pv = el('a', null, 'Privacy policy'); pv.href = 'privacy.html'; pv.target = '_blank'; pv.rel = 'noopener'; links.append(pv);
    m.append(top, sync, acts, links); this.setStatus(this.status);
  },
};
$('#acctBtn').onclick = e => {
  e.stopPropagation();
  if (!Auth.user) { $('#googleBtn').disabled = false; $('#signInDlg').showModal(); return; }
  const m = $('#acctMenu'); m.hidden = !m.hidden; if (!m.hidden) Auth.renderMenu();
};
document.addEventListener('click', e => { const m = $('#acctMenu'); if (!m.hidden && !m.contains(e.target)) m.hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#acctMenu').hidden = true; });
$('#googleBtn').onclick = () => Auth.signIn();
$('#delConfirm').oninput = e => { $('#delGo').disabled = e.target.value.trim() !== 'DELETE'; };
$('#delGo').onclick = () => { if ($('#delConfirm').value.trim() === 'DELETE') Auth.deleteAccount(); };
document.addEventListener('visibilitychange', () => { if (document.hidden && Auth.timer) Auth.save(); });   // don't lose a change when the tab is closed
if (sessionStorage.getItem('wickline:deleted')) { sessionStorage.removeItem('wickline:deleted'); setTimeout(() => toast('Your account and everything saved to it have been deleted.'), 600); }

/* ---------- pages: Chart, Ideas and Journal ---------- */
const VIEWS = ['home', 'chart', 'ideas', 'journal'];
const curView = () => (VIEWS.includes(document.body.dataset.view) ? document.body.dataset.view : 'chart');
function viewQuery(v) {
  v = v || curView();
  if (v === 'journal') return '?view=journal';
  if (v === 'ideas') return '?view=ideas' + (ID.open ? '&idea=' + ID.open : '');
  if (v === 'chart') return '?view=chart';
  return '';   // home
}
function setView(v, push) {
  v = VIEWS.includes(v) ? v : 'chart';
  document.body.dataset.view = v;
  $('#journal').hidden = v !== 'journal'; $('#ideas').hidden = v !== 'ideas'; $('#home').hidden = v !== 'home';
  document.querySelectorAll('.view-tab').forEach(a => a.setAttribute('aria-current', a.dataset.view === v ? 'page' : 'false'));
  let url;
  if (v === 'chart') {
    const q = new URLSearchParams(location.search); q.delete('view'); q.delete('idea');
    url = location.pathname + (S.ready && !S.sandbox ? shareQuery() : (String(q) ? '?' + q : '?view=chart'));
  } else url = location.pathname + viewQuery(v);
  try { if (push && url !== location.pathname + location.search) history.pushState({ view: v }, '', url); else history.replaceState({ view: v }, '', url); } catch (e) { /* address can't be changed here */ }
  $('#acctMenu').hidden = true; jTipHide();
  if (v === 'home') Home.show();
  if (v === 'journal') Journal.show();
  else if (v === 'ideas') Ideas.show();
  else requestAnimationFrame(() => { sizeOverlay(); markDirty(); if (S.focusTime) focusChart(); });
  if (v !== 'ideas') Ideas.leave();
  updateDocTitle();
}
function readViewFromUrl() {
  const q = new URLSearchParams(location.search), v = q.get('view'), id = q.get('idea');
  ID.open = v === 'ideas' && isUuid(id) ? id.toLowerCase() : null;
  if (VIEWS.includes(v)) return v;
  return q.get('s') || q.get('symbol') || /^#[A-Za-z0-9._-]{1,20}$/.test(location.hash) ? 'chart' : 'home';   // a shared chart link opens the chart; the bare address, the home page
}
$('.brand').onclick = e => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); setView('home', true); window.scrollTo(0, 0); };
document.querySelectorAll('.view-tab').forEach(a => { a.onclick = e => { e.preventDefault(); if (a.dataset.view === 'ideas') ID.open = null; setView(a.dataset.view, true); }; });
window.addEventListener('popstate', () => setView(readViewFromUrl()));
document.body.dataset.view = 'chart';

/* ---------- trade journal ----------
   Signed in: trades live in the person's account (the Supabase "trades" table, private to them).
   Signed out: they're kept in this browser, and move into the account at the next sign-in. */
const JR = { trades: [], loaded: false, eq: null, eqSeries: null, eqPts: [], month: null, shown: 50, editing: null, side: 'long', tags: [], rating: null, delArm: 0,
  f: { range: 'all', side: 'all', result: 'all', strategy: '', q: '', day: '' } };
const JR_TAGS = ['Followed plan', 'FOMO', 'Revenge trade', 'Early exit', 'Late entry', 'Moved stop', 'Too big', 'Overtrading', 'News'];
const JR_COLS = 'id,symbol,side,opened_at,closed_at,entry,exit,qty,fees,stop,target,pnl,strategy,tags,rating,notes';
const JR_CSV = ['symbol', 'side', 'opened_at', 'closed_at', 'entry', 'exit', 'qty', 'fees', 'stop', 'target', 'pnl', 'strategy', 'tags', 'rating', 'notes'];
const CCYS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'PKR', 'INR', 'AED', 'SAR', 'TRY', 'ZAR', 'SGD', 'HKD'];
const jset = () => { const v = store.get('jset', null); return { ccy: v && CCYS.includes(v.ccy) ? v.ccy : 'USD' }; };
const jRemote = () => !!(Auth.user && Auth.sb);
const jNum = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(/[, ]/g, '')); return isFinite(n) ? n : null; };
const jDayKey = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const toLocalInput = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function jClean(t) {   // a trade from anywhere (account, browser, import) is checked before it's used
  if (!t || typeof t !== 'object') return null;
  const symbol = parseSymbol(String(t.symbol || '')); if (!symbol) return null;
  const side = t.side === 'short' ? 'short' : t.side === 'long' ? 'long' : null; if (!side) return null;
  const opened = Date.parse(t.opened_at); if (!isFinite(opened)) return null;
  const entry = jNum(t.entry), qty = jNum(t.qty); if (!(entry > 0 && entry < 1e12) || !(qty > 0 && qty < 1e15)) return null;
  let exit = jNum(t.exit), closed = t.closed_at ? Date.parse(t.closed_at) : NaN;
  if (!(exit > 0 && exit < 1e12)) { exit = null; closed = NaN; } else if (!isFinite(closed) || closed < opened) closed = Math.max(opened, isFinite(closed) ? closed : opened);
  const pos = v => { const n = jNum(v); return n > 0 && n < 1e12 ? n : null; };
  const pnl = jNum(t.pnl);
  const tags = Array.isArray(t.tags) ? t.tags : typeof t.tags === 'string' ? t.tags.split(/[;|]/) : [];
  const rating = Math.round(jNum(t.rating));
  return {
    id: typeof t.id === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(t.id) ? t.id : 'local-' + uid(),
    symbol, side, opened_at: new Date(opened).toISOString(), closed_at: exit != null ? new Date(closed).toISOString() : null,
    entry, exit, qty, fees: Math.min(1e11, Math.max(0, jNum(t.fees) || 0)), stop: pos(t.stop), target: pos(t.target),
    pnl: exit != null && pnl != null && Math.abs(pnl) < 1e15 ? pnl : null,
    strategy: String(t.strategy || '').trim().slice(0, 60),
    tags: Array.from(new Set(tags.map(x => String(x).trim().slice(0, 24)).filter(Boolean))).slice(0, 20),
    rating: rating >= 1 && rating <= 5 ? rating : null, notes: String(t.notes || '').slice(0, 5000),
  };
}
const jRow = t => { const { id, ...row } = t; return row; };   // what's sent to the account (the database makes the id)
function jCalc(t) {
  const dir = t.side === 'long' ? 1 : -1, closed = t.exit != null;
  const gross = closed ? (t.exit - t.entry) * t.qty * dir : null;
  const auto = closed ? gross - (t.fees || 0) : null;
  const risk = t.stop != null && t.stop !== t.entry ? Math.abs(t.entry - t.stop) * t.qty : null;
  return { closed, gross, auto, net: closed ? (t.pnl != null ? t.pnl : auto) : null, r: closed && risk ? auto / risk : null,
    pct: closed ? ((t.exit - t.entry) / t.entry) * 100 * dir : null, held: closed ? (Date.parse(t.closed_at) - Date.parse(t.opened_at)) / 1000 : null };
}
function quoteCcy(id) {
  const c = classOf(id), r = rawOf(id);
  if (c === 'stock') return 'USD';
  if (c === 'forex') return r.split('/')[1] || 'USD';
  const q = splitSym(r)[1]; return ['USDT', 'USDC', 'FDUSD', 'TUSD', 'DAI'].includes(q) ? 'USD' : q || 'USD';
}
const MONEY = {};
function money(v, signed, compact) {
  if (v == null || !isFinite(v)) return '—';
  const ccy = jset().ccy, k = ccy + (signed ? 's' : '') + (compact ? 'c' : '');
  if (!MONEY[k]) {
    try { MONEY[k] = new Intl.NumberFormat(undefined, { style: 'currency', currency: ccy, signDisplay: signed ? 'exceptZero' : 'auto', notation: compact ? 'compact' : 'standard', maximumFractionDigits: compact ? 1 : 2, minimumFractionDigits: compact ? 0 : 2 }); }
    catch (e) { MONEY[k] = { format: n => (signed && n > 0 ? '+' : '') + n.toFixed(2) + ' ' + ccy }; }
  }
  return MONEY[k].format(compact && Math.abs(v) < 1000 ? Math.round(v) : v);
}
const fmtR = r => (r == null || !isFinite(r) ? '—' : (r > 0 ? '+' : '') + r.toFixed(2) + 'R');
function fmtHeld(s) {
  if (s == null) return '';
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h ' + Math.round((s % 3600) / 60) + 'm';
  return Math.floor(s / 86400) + 'd ' + Math.round((s % 86400) / 3600) + 'h';
}
const jWhen = iso => { const d = new Date(iso); return `${d.getDate()} ${MON[d.getMonth()]} ${String(d.getFullYear()).slice(2)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const tradePx = (t, v) => (v == null ? '—' : fmtP(v, precFor(t.symbol, t.entry)));

// ----- storage -----
async function jLoad() {
  if (jRemote()) {
    const all = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await Auth.sb.from('trades').select(JR_COLS).order('opened_at', { ascending: false }).range(from, from + 999);
      if (error) throw error;
      all.push(...data); if (data.length < 1000) break;
    }
    JR.trades = all.map(jClean).filter(Boolean);
  } else {
    const v = store.get('journal', []);
    JR.trades = (Array.isArray(v) ? v : []).map(jClean).filter(Boolean);
  }
  JR.loaded = true;
}
const jKeepLocal = () => store.raw('journal', JR.trades);
async function jInsert(list) {
  if (!list.length) return 0;
  if (jRemote()) {
    let n = 0;
    for (let i = 0; i < list.length; i += 500) {
      const { data, error } = await Auth.sb.from('trades').insert(list.slice(i, i + 500).map(jRow)).select(JR_COLS);
      if (error) throw error;
      JR.trades.push(...data.map(jClean).filter(Boolean)); n += data.length;
    }
    return n;
  }
  JR.trades.push(...list); jKeepLocal(); return list.length;
}
async function jUpdate(id, t) {
  if (jRemote()) {
    const { data, error } = await Auth.sb.from('trades').update(jRow(t)).eq('id', id).select(JR_COLS).single();
    if (error) throw error;
    t = jClean(data);
  } else t.id = id;
  JR.trades = JR.trades.map(x => (x.id === id ? t : x)); if (!jRemote()) jKeepLocal();
}
async function jDelete(id) {
  if (jRemote()) { const { error } = await Auth.sb.from('trades').delete().eq('id', id); if (error) throw error; }
  JR.trades = JR.trades.filter(x => x.id !== id); if (!jRemote()) jKeepLocal();
}
async function jAdopt() {   // trades kept in this browser move into the account at sign-in
  const v = store.get('journal', []);
  const local = (Array.isArray(v) ? v : []).map(jClean).filter(Boolean);
  if (!local.length || !jRemote()) return;
  try {
    for (let i = 0; i < local.length; i += 500) {
      const { error } = await Auth.sb.from('trades').insert(local.slice(i, i + 500).map(jRow));
      if (error) throw error;
    }
  } catch (e) { toast("Your journal couldn't be moved into your account yet. It's still saved in this browser."); return; }
  store.raw('journal', null);
  toast(`Moved ${local.length} trade${local.length === 1 ? '' : 's'} from this browser into your account.`);
}

// ----- filtering and statistics -----
function jRangeStart(r) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (r === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
  if (r === 'month') { d.setDate(1); return d.getTime(); }
  if (r === '30') return d.getTime() - 29 * 864e5;
  if (r === '90') return d.getTime() - 89 * 864e5;
  if (r === 'year') { d.setMonth(0, 1); return d.getTime(); }
  return -Infinity;
}
function jFiltered(skipDay) {
  const f = JR.f, from = jRangeStart(f.range), q = f.q.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return JR.trades.filter(t => {
    const c = jCalc(t), when = Date.parse(t.closed_at || t.opened_at);
    if (when < from) return false;
    if (!skipDay && f.day && !(t.closed_at && jDayKey(Date.parse(t.closed_at)) === f.day)) return false;   // a calendar day shows the trades closed that day, like its total
    if (f.side !== 'all' && t.side !== f.side) return false;
    if (f.result === 'win' && !(c.net > 0)) return false;
    if (f.result === 'loss' && !(c.net < 0)) return false;
    if (f.result === 'open' && c.closed) return false;
    if (f.strategy && t.strategy !== f.strategy) return false;
    if (q && !label(t.symbol).replace(/[^A-Z0-9]/g, '').includes(q) && !nameOf(t.symbol).toUpperCase().replace(/[^A-Z0-9]/g, '').includes(q)) return false;
    return true;
  });
}
function jStats(list) {
  const closed = list.filter(t => t.exit != null).map(t => ({ t, c: jCalc(t) })).sort((a, b) => Date.parse(a.t.closed_at) - Date.parse(b.t.closed_at));
  let net = 0, gw = 0, gl = 0, wins = 0, losses = 0, best = null, worst = null, eq = 0, peak = 0, dd = 0;
  const rs = [];
  for (const { c } of closed) {
    net += c.net;
    if (c.net > 0) { wins++; gw += c.net; } else if (c.net < 0) { losses++; gl += c.net; }
    if (best == null || c.net > best) best = c.net;
    if (worst == null || c.net < worst) worst = c.net;
    eq += c.net; peak = Math.max(peak, eq); dd = Math.min(dd, eq - peak);
    if (c.r != null && isFinite(c.r)) rs.push(c.r);
  }
  const n = closed.length;
  return { closed, n, open: list.length - n, net, wins, losses, winRate: n ? wins / n : null, avgWin: wins ? gw / wins : null, avgLoss: losses ? gl / losses : null,
    pf: gl < 0 ? gw / -gl : gw > 0 ? Infinity : null, exp: n ? net / n : null, avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null, best, worst, maxDD: dd };
}

// ----- tooltip (hover and keyboard focus) -----
function jTip(target, build) {
  const show = () => {
    const tip = $('#jTip'); tip.replaceChildren(); build(tip); tip.hidden = false;
    const r = target.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.top - h - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.left = clamp(x, 8, innerWidth - w - 8) + 'px'; tip.style.top = clamp(y, 8, innerHeight - h - 8) + 'px';
  };
  target.addEventListener('pointerenter', show); target.addEventListener('focus', show);
  target.addEventListener('pointerleave', jTipHide); target.addEventListener('blur', jTipHide);
}
function jTipHide() { const t = $('#jTip'); if (t) t.hidden = true; }
const tipLine = (tip, strong, text, cls) => { const row = el('div'); const b = el('b', cls || null, strong); row.append(b); if (text) row.append(document.createTextNode(' '), el('span', null, text)); tip.append(row); };
const signCls = v => (v > 0 ? 'up-t' : v < 0 ? 'dn-t' : null);

// ----- rendering -----
const Journal = {
  init() {
    const sel = $('#jCcy'); CCYS.forEach(c => { const o = el('option', null, c); o.value = c; sel.append(o); }); sel.value = jset().ccy;
    jLoad().then(() => { this.changed(); }).catch(() => {});
  },
  async account() {   // signed in: bring in browser trades, then load the account's journal
    await jAdopt();
    try { await jLoad(); } catch (e) { toast("Your journal couldn't be loaded. Check your connection."); }
    this.changed();
  },
  changed() {
    if (curView() === 'journal') this.render();
    syncTradeMarks();
  },
  async show() {
    if (!JR.loaded) { try { await jLoad(); } catch (e) { /* render what's there */ } }
    this.render();
  },
  render() {
    const signedIn = jRemote(), sub = $('#jSub'); sub.replaceChildren();
    if (signedIn) sub.textContent = 'Saved to your account. Only you can see it.';
    else if (Auth.sb) {
      sub.append(document.createTextNode('Saved in this browser only. '));
      const b = el('button', null, 'Sign in'); b.type = 'button'; b.onclick = () => $('#acctBtn').click();
      sub.append(b, document.createTextNode(' to keep it in your account and use it on any device.'));
    } else sub.textContent = 'Saved in this browser.';
    const any = JR.trades.length > 0;
    $('#jEmpty').hidden = any; $('#jBody').hidden = !any; $('.j-filters').hidden = !any; $('#jExport').hidden = !any;
    // strategy filter options
    const ss = $('#jStrategy'), cur = JR.f.strategy, strategies = Array.from(new Set(JR.trades.map(t => t.strategy).filter(Boolean))).sort();
    ss.replaceChildren(el('option', null, 'All strategies')); ss.firstChild.value = '';
    strategies.forEach(x => { const o = el('option', null, x); o.value = x; ss.append(o); });
    if (!strategies.includes(cur)) JR.f.strategy = ''; ss.value = JR.f.strategy;
    const chip = $('#jDayChip'); chip.replaceChildren();
    if (JR.f.day) {
      const [y, m, d] = JR.f.day.split('-').map(Number);
      const c = el('span', 'j-chip-day', `${d} ${MON[m - 1]} ${y}`); const x = el('button'); x.type = 'button'; x.innerHTML = svg('x'); x.setAttribute('aria-label', 'Show all days');
      x.onclick = () => { JR.f.day = ''; this.render(); }; c.append(x); chip.append(c);
    }
    if (!any) return;
    const list = jFiltered(), st = jStats(list);
    this.kpis(st); this.equity(st); this.calendar(jFiltered(true)); this.bars('#jBySym', list, t => label(t.symbol)); this.bars('#jByStrat', list, t => t.strategy || 'No strategy');
    this.table(list);
  },
  kpis(st) {
    const box = $('#jKpis'); box.replaceChildren();
    const tile = (k, v, s, hero, cls) => { const d = el('div', 'j-tile' + (hero ? ' hero' : '')); d.append(el('p', 'k', k)); const vv = el('div', 'v' + (cls ? ' ' + cls : ''), v); d.append(vv); if (s) d.append(el('div', 's', s)); box.append(d); };
    tile('Net result', money(st.net, true), `${st.n} closed trade${st.n === 1 ? '' : 's'}${st.open ? ` · ${st.open} open` : ''}`, true, signCls(st.net));
    tile('Win rate', st.winRate == null ? '—' : Math.round(st.winRate * 100) + '%', st.n ? `${st.wins} won · ${st.losses} lost` : '');
    tile('Profit factor', st.pf == null ? '—' : st.pf === Infinity ? 'No losses' : st.pf.toFixed(2), 'Money won ÷ money lost');
    tile('Average win / loss', st.avgWin == null && st.avgLoss == null ? '—' : `${money(st.avgWin)} / ${money(st.avgLoss)}`, `Per trade: ${money(st.exp, true)}${st.avgR != null ? ' · ' + fmtR(st.avgR) : ''}`);
    tile('Largest drawdown', st.n ? money(st.maxDD) : '—', st.n ? `Best ${money(st.best, true)} · worst ${money(st.worst, true)}` : '');
  },
  equity(st) {
    const box = $('#jEq'), read = $('#jEqRead');
    if (st.closed.length < 1) { if (JR.eq) { JR.eq.remove(); JR.eq = null; } box.replaceChildren(el('div', 'j-noeq', 'Close a trade to start your equity curve.')); read.textContent = ''; return; }
    if (!JR.eq) {
      box.replaceChildren();
      JR.eq = createChart(box, {
        autoSize: true,
        layout: { background: { type: 'solid', color: C.panel }, textColor: C.muted, fontSize: 11, fontFamily: FONT_DATA, attributionLogo: false },
        grid: { vertLines: { visible: false }, horzLines: { color: C.grid } },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, tickMarkFormatter: tickFmt },
        crosshair: { mode: CrosshairMode.Magnet, vertLine: { color: C.faint, labelBackgroundColor: C.crossLabel }, horzLine: { visible: false, labelVisible: false } },
        handleScroll: false, handleScale: false,
        localization: { timeFormatter: t => fmtTime(t), priceFormatter: v => money(v, false, true) },
      });
      JR.eqSeries = JR.eq.addSeries(BaselineSeries, {
        baseValue: { type: 'price', price: 0 }, lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
        topLineColor: C.up, topFillColor1: alpha(C.up, 0.14), topFillColor2: alpha(C.up, 0.02),
        bottomLineColor: C.down, bottomFillColor1: alpha(C.down, 0.02), bottomFillColor2: alpha(C.down, 0.14),
        priceFormat: { type: 'custom', formatter: v => money(v, false, true), minMove: 0.01 },
      });
      JR.eq.subscribeCrosshairMove(p => {
        const pt = p && p.time != null ? JR.eqPts.find(x => x.time === p.time) : null;
        if (!pt || !pt.t) { jEqDefault(); return; }
        read.textContent = `${jWhen(pt.t.closed_at)} · ${label(pt.t.symbol)} ${money(pt.net, true)} · total ${money(pt.value, true)}`;
      });
    }
    const pts = []; let eq = 0, last = -Infinity;
    const t0 = Math.floor(Date.parse(st.closed[0].t.opened_at) / 1000);
    pts.push({ time: t0, value: 0 }); last = t0;
    for (const { t, c } of st.closed) { eq += c.net; let s = Math.floor(Date.parse(t.closed_at) / 1000); if (s <= last) s = last + 1; last = s; pts.push({ time: s, value: eq, t, net: c.net }); }
    JR.eqPts = pts;
    JR.eqSeries.setData(pts.map(x => ({ time: x.time, value: x.value })));
    JR.eq.timeScale().fitContent();
    jEqDefault();
  },
  calendar(list) {
    if (!JR.month) {
      const lastClosed = list.filter(t => t.closed_at).map(t => Date.parse(t.closed_at)).sort((a, b) => b - a)[0];
      const d = new Date(lastClosed || Date.now()); JR.month = { y: d.getFullYear(), m: d.getMonth() };
    }
    const { y, m } = JR.month, first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
    $('#jMonth').textContent = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const by = {};
    for (const t of list) {
      if (t.exit == null) continue;
      const k = jDayKey(Date.parse(t.closed_at)), c = jCalc(t), o = (by[k] = by[k] || { net: 0, n: 0, w: 0 });
      o.net += c.net; o.n++; if (c.net > 0) o.w++;
    }
    let total = 0, maxAbs = 0;
    for (let d = 1; d <= days; d++) { const o = by[jDayKey(new Date(y, m, d).getTime())]; if (o) { total += o.net; maxAbs = Math.max(maxAbs, Math.abs(o.net)); } }
    $('#jCalTotal').textContent = money(total, true);
    const cal = $('#jCal'); cal.replaceChildren();
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(n => cal.append(el('div', 'dow', n)));
    for (let i = 0; i < lead; i++) cal.append(el('div', 'j-day empty'));
    const today = jDayKey(Date.now());
    for (let d = 1; d <= days; d++) {
      const key = jDayKey(new Date(y, m, d).getTime()), o = by[key];
      const cell = el('button', 'j-day' + (key === today ? ' today' : '') + (key === JR.f.day ? ' sel' : '')); cell.type = 'button';
      cell.append(el('span', 'd', String(d)));
      if (o) {
        const share = maxAbs ? Math.abs(o.net) / maxAbs : 0, tint = Math.round(12 + share * 30);
        if (o.net !== 0) cell.style.background = `color-mix(in srgb, var(${o.net > 0 ? '--up' : '--down'}) ${tint}%, var(--panel))`;
        cell.append(el('span', 'a', money(o.net, true, true)));
        cell.setAttribute('aria-label', `${d} ${MON[m]}: ${money(o.net, true)}, ${o.n} trade${o.n === 1 ? '' : 's'}`);
        jTip(cell, tip => { tipLine(tip, money(o.net, true), first.toLocaleDateString(undefined, { month: 'short' }) + ' ' + d, signCls(o.net)); tipLine(tip, String(o.n), `trade${o.n === 1 ? '' : 's'} · ${o.w} won`); tipLine(tip, '', 'Click to see these trades'); });
        cell.onclick = () => { JR.f.day = JR.f.day === key ? '' : key; this.render(); };
      } else { cell.setAttribute('aria-label', `${d} ${MON[m]}: no closed trades`); cell.tabIndex = -1; }
      cal.append(cell);
    }
  },
  bars(sel, list, keyFn) {
    const box = $(sel); box.replaceChildren();
    const g = {};
    for (const t of list) { if (t.exit == null) continue; const k = keyFn(t), c = jCalc(t), o = (g[k] = g[k] || { net: 0, n: 0, w: 0 }); o.net += c.net; o.n++; if (c.net > 0) o.w++; }
    let rows = Object.entries(g).sort((a, b) => b[1].net - a[1].net);
    if (!rows.length) { box.append(el('p', 'j-none', 'No closed trades here yet.')); return; }
    if (rows.length > 8) {
      const byMag = rows.slice().sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net)), keep = new Set(byMag.slice(0, 7).map(r => r[0]));
      const rest = rows.filter(r => !keep.has(r[0])).reduce((a, [, v]) => ({ net: a.net + v.net, n: a.n + v.n, w: a.w + v.w }), { net: 0, n: 0, w: 0 });
      rows = rows.filter(r => keep.has(r[0])).concat([[`Other (${Object.keys(g).length - 7})`, rest]]);
    }
    const max = Math.max(1e-9, ...rows.map(([, v]) => Math.abs(v.net)));
    for (const [name, v] of rows) {
      const row = el('div', 'j-bar'); row.tabIndex = 0;
      const tr = el('span', 'tr'), bar = el('i', v.net >= 0 ? 'up' : 'dn'); bar.style.width = `calc(${(Math.abs(v.net) / max) * 49}% - 1px)`;
      if (v.net !== 0) tr.append(bar);
      row.append(el('span', 'nm', name), tr, el('span', 'val', money(v.net, true)));
      row.setAttribute('aria-label', `${name}: ${money(v.net, true)} from ${v.n} trades`);
      jTip(row, tip => { tipLine(tip, money(v.net, true), name, signCls(v.net)); tipLine(tip, `${v.n}`, `trade${v.n === 1 ? '' : 's'} · ${Math.round((v.w / v.n) * 100)}% won`); });
      box.append(row);
    }
  },
  table(list) {
    const box = $('#jTable'); box.replaceChildren();
    $('#jCount').textContent = String(list.length);
    const h = el('div', 'j-row h'); h.setAttribute('role', 'row');
    ['Entry time', 'Symbol', 'Side', 'Entry', 'Exit', 'Size', 'Net result', 'R', 'Strategy', 'Rating'].forEach((n, i) => { const c = el('span', i >= 3 && i <= 7 ? 'num' : null, n); c.setAttribute('role', 'columnheader'); h.append(c); });
    box.append(h);
    if (!list.length) { box.append(el('p', 'j-none', 'No trades match these filters.')); $('#jMore').hidden = true; return; }
    const sorted = list.slice().sort((a, b) => Date.parse(b.opened_at) - Date.parse(a.opened_at));
    for (const t of sorted.slice(0, JR.shown)) {
      const c = jCalc(t), row = el('div', 'j-row'); row.setAttribute('role', 'row'); row.tabIndex = 0;
      const [b, q] = symParts(t.symbol);
      const sym = el('span', 'sym c-sym'); sym.append(document.createTextNode(b), el('em', null, q));
      const side = el('span', 'c-side'); side.append(el('span', 'side-pill ' + t.side, t.side === 'long' ? 'Long' : 'Short'));
      const pnl = el('span', 'num c-pnl ' + (signCls(c.net) || ''));
      if (c.closed) pnl.textContent = money(c.net, true); else pnl.append(el('span', 'open-pill', 'Open'));
      const rate = el('span', 'stars c-rate'); if (t.rating) { rate.append(document.createTextNode('★'.repeat(t.rating))); rate.append(el('span', 'off', '★'.repeat(5 - t.rating))); } else rate.append(el('span', 'muted', '—'));
      row.append(el('span', 'muted c-date', jWhen(t.opened_at)), sym, side, el('span', 'num c-entry', tradePx(t, t.entry)), el('span', 'num c-exit', tradePx(t, t.exit)),
        el('span', 'num c-qty', String(+t.qty.toPrecision(10))), pnl, el('span', 'num c-r muted', fmtR(c.r)), el('span', 'muted c-strat', t.strategy || '—'), rate,
        el('span', 'c-meta', `${t.side === 'long' ? 'Long' : 'Short'} · ${jWhen(t.opened_at)}${t.strategy ? ' · ' + t.strategy : ''}`));
      row.onclick = () => this.edit(t.id);
      row.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.edit(t.id); } };
      box.append(row);
    }
    $('#jMore').hidden = sorted.length <= JR.shown;
  },

  // ----- the trade form -----
  open(t, prefill) {
    JR.editing = t ? t.id : null; JR.delArm = 0;
    const v = t || prefill || {};
    $('#tTitle').textContent = t ? 'Edit trade' : 'New trade';
    $('#tSym').value = v.symbol ? label(v.symbol) : '';
    JR.side = v.side === 'short' ? 'short' : 'long';
    $('#tOpen').value = toLocalInput(v.opened_at ? Date.parse(v.opened_at) : Date.now());
    $('#tClose').value = v.closed_at ? toLocalInput(Date.parse(v.closed_at)) : '';
    const num = (id, x) => { $(id).value = x == null ? '' : String(x); };
    num('#tEntry', v.entry); num('#tQty', v.qty); num('#tExit', v.exit); num('#tFees', v.fees || ''); num('#tStop', v.stop); num('#tTarget', v.target); num('#tPnl', v.pnl);
    $('#tStrat').value = v.strategy || ''; $('#tNotes').value = v.notes || '';
    JR.tags = (v.tags || []).slice(); JR.rating = v.rating || null;
    $('#tDel').hidden = !t; $('#tDel').textContent = 'Delete'; $('#tChart').hidden = !t;
    const sl = $('#tSymList'); sl.replaceChildren();
    const seen = new Set();
    S.watch.concat(STOCKS.map(s => 'US:' + s[0]), FX.map(s => 'FX:' + s[0]), Object.keys(CFD), Object.keys(CRYPTO_DEMO).map(s => 'BINANCE:' + s)).forEach(id => {
      const l = label(id); if (seen.has(l)) return; seen.add(l); const o = el('option'); o.value = l; o.label = nameOf(id); sl.append(o);
    });
    const st = $('#tStratList'); st.replaceChildren();
    Array.from(new Set(JR.trades.map(x => x.strategy).filter(Boolean))).forEach(x => { const o = el('option'); o.value = x; st.append(o); });
    this.formSide(); this.formTags(); this.formRate(); this.preview();
    $('#tradeDlg').showModal();
    if (!v.symbol) $('#tSym').focus();
  },
  edit(id) { const t = JR.trades.find(x => x.id === id); if (t) this.open(t); },
  formSide() { document.querySelectorAll('#tSide .btn').forEach(b => { const on = b.dataset.side === JR.side; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); },
  formTags() {
    const box = $('#tTags'); box.replaceChildren();
    const all = JR_TAGS.concat(JR.tags.filter(x => !JR_TAGS.includes(x)));
    for (const name of all) {
      const b = el('button', 't-tag', name); b.type = 'button'; b.setAttribute('aria-pressed', String(JR.tags.includes(name)));
      b.onclick = () => { JR.tags = JR.tags.includes(name) ? JR.tags.filter(x => x !== name) : JR.tags.concat(name).slice(0, 20); this.formTags(); };
      box.append(b);
    }
    const inp = el('input', 'field'); inp.placeholder = '+ Add tag'; inp.maxLength = 24; inp.setAttribute('aria-label', 'Add a tag');
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const v = inp.value.trim().slice(0, 24); if (v && !JR.tags.includes(v)) { JR.tags = JR.tags.concat(v).slice(0, 20); this.formTags(); $('#tTags input').focus(); } } };
    box.append(inp);
  },
  formRate() {
    const box = $('#tRate'); box.replaceChildren();
    for (let i = 1; i <= 5; i++) {
      const b = el('button', JR.rating >= i ? 'on' : null, '★'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(JR.rating === i)); b.setAttribute('aria-label', `${i} out of 5`);
      b.onclick = () => { JR.rating = JR.rating === i ? null : i; this.formRate(); };
      box.append(b);
    }
  },
  read(strict) {   // the form as a trade, or null with a message when strict
    const fail = (msg, sel) => { if (strict) { toast(msg); if (sel) $(sel).focus(); } return null; };
    const symbol = parseSymbol($('#tSym').value); if (!symbol) return fail('Type the symbol you traded, for example AAPL or EUR/USD.', '#tSym');
    const opened = Date.parse($('#tOpen').value); if (!isFinite(opened)) return fail('Add the time you entered the trade.', '#tOpen');
    const entry = jNum($('#tEntry').value); if (!(entry > 0)) return fail('Add the entry price.', '#tEntry');
    const qty = jNum($('#tQty').value); if (!(qty > 0)) return fail('Add the size of the trade (units, shares or lots).', '#tQty');
    const exitRaw = $('#tExit').value.trim(), exit = jNum(exitRaw);
    if (exitRaw && !(exit > 0)) return fail('The exit price must be a number above zero.', '#tExit');
    let closed = Date.parse($('#tClose').value);
    if (exit != null && !isFinite(closed)) closed = Math.max(opened, Date.now());
    if (exit != null && closed < opened) return fail('The exit time is before the entry time.', '#tClose');
    for (const [sel, nm] of [['#tStop', 'stop loss'], ['#tTarget', 'take profit'], ['#tFees', 'fees']]) { const raw = $(sel).value.trim(); if (raw && !(jNum(raw) >= 0)) return fail(`The ${nm} must be a number.`, sel); }
    const pnlRaw = $('#tPnl').value.trim(); if (pnlRaw && jNum(pnlRaw) == null) return fail('The net result must be a number, for example -25.50.', '#tPnl');
    return jClean({ id: JR.editing || undefined, symbol, side: JR.side, opened_at: new Date(opened).toISOString(), closed_at: exit != null ? new Date(closed).toISOString() : null,
      entry, exit, qty, fees: $('#tFees').value, stop: $('#tStop').value, target: $('#tTarget').value, pnl: exit != null ? pnlRaw : '', strategy: $('#tStrat').value,
      tags: JR.tags, rating: JR.rating, notes: $('#tNotes').value });
  },
  preview() {
    const box = $('#tCalc'); box.replaceChildren();
    const t = this.read(false), sym = parseSymbol($('#tSym').value), qc = sym ? quoteCcy(sym) : '', acct = jset().ccy;
    const hint = $('#tPnlHint'), pnlIn = $('#tPnl');
    if (!t) { box.append(el('span', null, 'Fill in the symbol, entry and size to see the result here.')); pnlIn.placeholder = ''; hint.textContent = 'worked out for you'; return; }
    const c = jCalc(t);
    const risk = t.stop != null ? Math.abs(t.entry - t.stop) * t.qty : null, reward = t.target != null ? Math.abs(t.target - t.entry) * t.qty : null;
    if (!c.closed) {
      box.append(el('span', null, 'Open trade. Add the exit price when you close it.'));
      if (risk) box.append(el('span', null, `Risk ${fmtP(risk, 2)} ${qc}${reward ? ` · reward ${fmtP(reward, 2)} ${qc} (${(reward / risk).toFixed(1)} : 1)` : ''}`));
      pnlIn.placeholder = ''; hint.textContent = 'after you close it'; return;
    }
    const sameCcy = qc === acct;
    pnlIn.placeholder = sameCcy ? fmtP(c.auto, 2) : '';
    hint.textContent = sameCcy ? 'worked out for you' : `type it in ${acct}`;
    const shown = t.pnl != null ? money(t.pnl, true) : sameCcy ? money(c.auto, true) : `${c.auto > 0 ? '+' : ''}${fmtP(c.auto, 2)} ${qc}`;
    const res = el('span'); res.append(document.createTextNode('Result '), el('b', signCls(t.pnl != null ? t.pnl : c.auto), shown)); box.append(res);
    box.append(el('span', null, `${c.pct > 0 ? '+' : ''}${c.pct.toFixed(2)}%`));
    if (c.r != null) box.append(el('span', null, fmtR(c.r)));
    box.append(el('span', null, 'held ' + fmtHeld(c.held)));
    if (!sameCcy && t.pnl == null) box.append(el('span', null, `This market is priced in ${qc}. Type the result in ${acct} under Net result so your totals add up.`));
  },
  async save() {
    const t = this.read(true); if (!t) return;
    const go = $('#tSave'); go.disabled = true;
    try {
      if (JR.editing) { await jUpdate(JR.editing, t); toast('Trade updated.'); }
      else { await jInsert([t]); toast('Trade saved to your journal.'); }
      $('#tradeDlg').close(); this.changed();
    } catch (e) { toast("The trade couldn't be saved. Check your connection and try again."); }
    finally { go.disabled = false; }
  },
  async remove() {
    const b = $('#tDel');
    if (Date.now() - JR.delArm > 4000) { JR.delArm = Date.now(); b.textContent = 'Click again to delete'; setTimeout(() => { if (b.textContent !== 'Delete' && Date.now() - JR.delArm >= 4000) b.textContent = 'Delete'; }, 4100); return; }
    b.disabled = true;
    try { await jDelete(JR.editing); $('#tradeDlg').close(); toast('Trade deleted.'); this.changed(); }
    catch (e) { toast("The trade couldn't be deleted. Please try again."); }
    finally { b.disabled = false; b.textContent = 'Delete'; JR.delArm = 0; }
  },
  fromPosition(d) {   // a long/short position drawn on the chart becomes a new journal entry
    if (!isPos(d)) return;
    const lv = posLevels(d), r = v => Number(v.toFixed(Math.max(S.prec, 2)));
    setView('journal', true);
    this.open(null, { symbol: S.symbol, side: d.type, opened_at: new Date(Math.min(Date.now(), d.p1.t * 1000)).toISOString(), entry: r(lv.entry), stop: r(lv.stop), target: r(lv.target) });
  },
  openOnChart() {
    const t = JR.trades.find(x => x.id === JR.editing); if (!t) return;
    $('#tradeDlg').close();
    S.focusTime = Math.floor(Date.parse(t.opened_at) / 1000);
    setView('chart', true);
    if (t.symbol !== S.symbol) setSymbol(t.symbol); else focusChart();
  },

  // ----- CSV -----
  exportCsv() {
    const cell = (v, text) => {
      if (v == null) return '';
      let s = String(v);
      if (text && /^[=+\-@\t\r]/.test(s)) s = "'" + s;   // stops a spreadsheet from running a cell as a formula
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [JR_CSV.join(',')];
    for (const t of JR.trades.slice().sort((a, b) => Date.parse(a.opened_at) - Date.parse(b.opened_at))) {
      lines.push([cell(label(t.symbol), true), t.side, t.opened_at, cell(t.closed_at), t.entry, cell(t.exit), t.qty, t.fees, cell(t.stop), cell(t.target), cell(t.pnl),
        cell(t.strategy, true), cell(t.tags.join('; '), true), cell(t.rating), cell(t.notes, true)].join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = el('a'); a.href = URL.createObjectURL(blob); a.download = `${CFG.siteName.replace(/[^A-Za-z0-9]+/g, '-')}-journal-${jDayKey(Date.now())}.csv`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
  async importCsv(file) {
    if (!file) return;
    if (file.size > 2e6) { toast('That file is too big. The limit is 2 MB.'); return; }
    let text; try { text = await file.text(); } catch (e) { toast("That file couldn't be read."); return; }
    const rows = parseCsv(text.replace(/^﻿/, ''));
    if (rows.length < 2) { toast('No trades found in that file.'); return; }
    const head = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    if (!head.includes('symbol') || !head.includes('entry')) { toast('That file needs at least symbol, side, opened_at, entry and qty columns. Export a CSV here to see the format.'); return; }
    const unq = v => (typeof v === 'string' && /^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v);
    const trades = []; let skipped = 0;
    for (const r of rows.slice(1, 5001)) {
      if (!r.some(x => x.trim())) continue;
      const o = {}; head.forEach((h, i) => { o[h] = unq(r[i] != null ? r[i] : ''); });
      delete o.id;
      const t = jClean(o); if (t) trades.push(t); else skipped++;
    }
    if (!trades.length) { toast(`No trades could be read from that file${skipped ? ` (${skipped} rows skipped)` : ''}.`); return; }
    try { const n = await jInsert(trades); toast(`Imported ${n} trade${n === 1 ? '' : 's'}${skipped ? `. ${skipped} row${skipped === 1 ? '' : 's'} couldn't be read and were skipped.` : '.'}`); this.changed(); }
    catch (e) { toast("The trades couldn't be imported. Please try again."); }
  },
};
function jEqDefault() { const p = JR.eqPts[JR.eqPts.length - 1]; $('#jEqRead').textContent = p ? `Total ${money(p.value, true)}` : ''; }
function parseCsv(text) {   // RFC 4180: quoted fields, doubled quotes, line breaks inside quotes
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// ----- your journal's trades on the chart -----
let tMarks = null, tMarksOn = null;
function syncTradeMarks() {
  if (!S.main || !LWC.createSeriesMarkers) return;
  if (tMarksOn !== S.main) { tMarks = null; tMarksOn = S.main; }
  const T = S.bars, m = [];
  if (T.length) {   // paper trading executions, on live prices or in a replay
    const first = T[0].time, lastT = T[T.length - 1].time + tfOf(S.tf).sec;
    for (const x of Paper.marks()) { if (x.at < first || x.at > lastT) continue; m.push({ time: T[Math.max(0, rpIndexFor(T, x.at))].time, position: x.buy ? 'belowBar' : 'aboveBar', shape: x.buy ? 'arrowUp' : 'arrowDown', color: x.buy ? C.up : C.down, text: x.text }); }
    m.sort((x, y) => x.time - y.time);
  }
  if (!R.on && T.length) {
    const first = T[0].time, step = tfOf(S.tf).sec, lastT = T[T.length - 1].time + step;
    const at = s => (s < first || s > lastT ? null : T[Math.max(0, rpIndexFor(T, s))].time);
    for (const t of JR.trades) {
      if (t.symbol !== S.symbol) continue;
      if (PT.s.ui.exec && t.tags.includes('Paper')) continue;   // paper trades show as executions instead
      const long = t.side === 'long', a = at(Date.parse(t.opened_at) / 1000);
      if (a != null) m.push({ time: a, position: long ? 'belowBar' : 'aboveBar', shape: long ? 'arrowUp' : 'arrowDown', color: C.draw, text: (long ? 'Buy ' : 'Sell ') + fmtP(t.entry, S.prec) });
      if (t.exit != null) { const b = at(Date.parse(t.closed_at) / 1000), c = jCalc(t); if (b != null) m.push({ time: b, position: long ? 'aboveBar' : 'belowBar', shape: 'circle', color: c.net >= 0 ? C.up : C.down, text: money(c.net, true) }); }
    }
    m.sort((x, y) => x.time - y.time);
  }
  if (!tMarks) { if (m.length) tMarks = LWC.createSeriesMarkers(S.main, m); } else tMarks.setMarkers(m);
}
function focusChart() {
  const sec = S.focusTime; if (!sec || !S.bars.length || curView() !== 'chart') return;
  S.focusTime = 0;
  const i = rpIndexFor(S.bars, sec);
  if (i < 0) { toast(S.idea ? 'This idea is older than the chart history loaded here. Try a higher timeframe, such as 1D.' : 'This trade is older than the chart history loaded here. Try a higher timeframe, such as 1D.'); return; }
  chart.timeScale().setVisibleLogicalRange({ from: i - 60, to: i + 40 });
}

// ----- controls -----
$('#jNew').onclick = () => Journal.open(null);
$('#jFirst').onclick = () => Journal.open(null);
$('#jExport').onclick = () => Journal.exportCsv();
$('#jImport').onclick = () => $('#jFile').click();
$('#jFile').onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; Journal.importCsv(f); };
$('#jRange').onchange = e => { JR.f.range = e.target.value; JR.f.day = ''; Journal.render(); };
$('#jResult').onchange = e => { JR.f.result = e.target.value; Journal.render(); };
$('#jStrategy').onchange = e => { JR.f.strategy = e.target.value; Journal.render(); };
$('#jSearch').oninput = e => { JR.f.q = e.target.value; Journal.render(); };
$('#jSide').onclick = e => { const b = e.target.closest('.btn'); if (!b) return; JR.f.side = b.dataset.v; document.querySelectorAll('#jSide .btn').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); Journal.render(); };
$('#jCcy').onchange = e => { store.set('jset', { ccy: e.target.value }); Journal.render(); syncTradeMarks(); };
$('#jPrev').onclick = () => { const m = JR.month; JR.month = m.m === 0 ? { y: m.y - 1, m: 11 } : { y: m.y, m: m.m - 1 }; Journal.calendar(jFiltered(true)); };
$('#jNext').onclick = () => { const m = JR.month; JR.month = m.m === 11 ? { y: m.y + 1, m: 0 } : { y: m.y, m: m.m + 1 }; Journal.calendar(jFiltered(true)); };
$('#jMore').onclick = () => { JR.shown += 100; Journal.table(jFiltered()); };
$('#tSide').onclick = e => { const b = e.target.closest('.btn'); if (!b) return; JR.side = b.dataset.side; Journal.formSide(); Journal.preview(); };
$('#tForm').addEventListener('input', () => Journal.preview());
$('#tForm').addEventListener('submit', e => { e.preventDefault(); Journal.save(); });
$('#tDel').onclick = () => Journal.remove();
$('#tChart').onclick = () => Journal.openOnChart();
$('#selJournal').onclick = () => { const d = S.selected && findDrawing(S.selected); if (d) Journal.fromPosition(d); };
document.addEventListener('scroll', jTipHide, true);

/* ---------- ideas ----------
   People publish their view of a chart: the bars they were looking at, their drawings and indicators, a title,
   a long / short / neutral call and their analysis. Everyone can read ideas; signed-in people like and comment.
   An idea's chart is stored as numbers (never a picture), checked again whenever it's read back, and drawn here.
   The database rules (Supabase) decide who may publish, change, delete or moderate: this code only asks. */
Object.assign(ICON, {
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  chat: '<path d="M5 5h14v10H10l-4 3.5V15H5z"/>',
  share: '<path d="M14 5h5v5M19 5l-8 8"/><path d="M17 14v5H5V7h5"/>',
  flag: '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.5.9-1.6 2.5-3.2 3.8M6.6 7.6C4.6 8.9 3.1 10.8 2.5 12c1 1.8 4.5 6 9.5 6 1.5 0 2.9-.4 4.1-1"/>',
  eye: '<path d="M2.5 12c1-1.8 4.5-6 9.5-6s8.5 4.2 9.5 6c-1 1.8-4.5 6-9.5 6s-8.5-4.2-9.5-6z"/><circle cx="12" cy="12" r="3"/>',
  next: '<path d="M4 18l6-6-6-6"/><path d="M12 18h8"/>',
  open: '<path d="M4 19l5-6 4 3 7-9"/><path d="M15 7h5v5"/>',
});
const ID = { who: null, open: null, cur: null, list: [], page: 0, done: false, loading: false, req: 0, dreq: 0, failed: false, scroll: 0,
  f: { market: 'all', dir: 'all', sort: 'new', q: '', mine: false, author: null, authorName: '' },
  liked: new Set(), admin: false, mod: false, comments: [], editing: null, reportFor: null };
S.idea = null;   // an idea shown on top of the live chart
const IDEA_PAGE = 24;
const IDEA_LIST = 'id,user_id,symbol,market,tf,direction,title,excerpt,thumb,likes,comments,hidden,created_at,author:profiles(display_name,avatar_url)';
const IDEA_FULL = 'id,user_id,symbol,market,tf,direction,title,body,price,chart,likes,comments,hidden,created_at,updated_at,author:profiles(display_name,avatar_url)';
const COMMENT_COLS = 'id,idea_id,user_id,body,hidden,created_at,author:profiles(display_name,avatar_url)';
const MARKETS = [['all', 'All'], ['crypto', 'Crypto'], ['stock', 'Stocks'], ['fund', 'Funds'], ['forex', 'Forex'], ['index', 'Indices'], ['futures', 'Futures'], ['bond', 'Bonds']];
const MARKET_NAME = { crypto: 'Crypto', stock: 'US stock', fund: 'Fund', forex: 'Forex', index: 'Index', futures: 'Commodity', bond: 'Bond' };
const DIR_NAME = { long: 'Long', short: 'Short', neutral: 'Neutral' };
const DRAW_TYPES = ['trend', 'ray', 'hline', 'rect', 'fib', 'long', 'short'];
const REASONS = { spam: 'Spam', abuse: 'Abuse', misleading: 'Scam or misleading', illegal: 'Illegal', other: 'Other' };
const isUuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const finite = v => typeof v === 'number' && isFinite(v);
const isoOk = v => (typeof v === 'string' && isFinite(Date.parse(v)) ? v : new Date().toISOString());
const ideaUrl = id => location.origin + location.pathname + '?view=ideas&idea=' + id;

// ----- checking what comes back from the database -----
function cleanDrawing(d) {
  if (!d || typeof d !== 'object' || !DRAW_TYPES.includes(d.type)) return null;
  const pt = q => (q && typeof q === 'object' && finite(q.t) && finite(q.p) && Math.abs(q.t) < 1e10 && Math.abs(q.p) < 1e13 ? { t: q.t, p: q.p } : null);
  const p1 = pt(d.p1); if (!p1) return null;
  const o = { type: d.type, p1, color: typeof d.color === 'string' && /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : null };
  if (d.type !== 'hline') { const p2 = pt(d.p2); if (!p2) return null; o.p2 = p2; }
  if (d.type === 'long' || d.type === 'short') o.tp = finite(d.tp) && Math.abs(d.tp) < 1e13 ? d.tp : null;
  return o;
}
function cleanBars(a, max) {   // [[time, open, high, low, close, volume], ...], all or nothing
  if (!Array.isArray(a) || a.length > max) return [];
  const out = []; let last = -Infinity;
  for (const r of a) {
    if (!Array.isArray(r) || r.length < 5) return [];
    const [t, o, h, l, c] = r;
    if (![t, o, h, l, c].every(finite) || t <= last || t < 0 || t > 1e10 || [o, h, l, c].some(v => Math.abs(v) > 1e13)) return [];
    out.push({ time: t, open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c, volume: finite(r[5]) && r[5] > 0 ? r[5] : 0 });
    last = t;
  }
  return out;
}
function cleanRange(r, n) {
  return Array.isArray(r) && finite(r[0]) && finite(r[1]) && r[1] - r[0] >= 2 ? [clamp(r[0], -200, n), clamp(r[1], 2, n + 500)] : [Math.max(0, n - 120), n + 4];
}
const cleanType = t => (['candles', 'bars', 'heikin', 'line', 'area'].includes(t) ? t : 'candles');
const cleanPrec = p => (Number.isInteger(p) && p >= 0 && p <= 10 ? p : 2);
function cleanChart(c) {
  if (!c || typeof c !== 'object' || c.v !== 1) return null;
  const bars = cleanBars(c.b, 1200); if (bars.length < 2) return null;
  return {
    bars, r: cleanRange(c.r, bars.length), type: cleanType(c.ty), prec: cleanPrec(c.p),
    drawings: (Array.isArray(c.d) ? c.d.slice(0, 100) : []).map(cleanDrawing).filter(Boolean),
    ind: (Array.isArray(c.i) ? c.i.slice(0, 12) : []).map(x => (x && typeof x === 'object' ? normInst({ type: x.type, params: x.params, color: x.color }) : null)).filter(Boolean),
  };
}
function cleanThumb(t) {
  if (!t || typeof t !== 'object') return null;
  const bars = cleanBars(t.b, 200); if (bars.length < 2) return null;
  return { bars, r: cleanRange(t.r, bars.length), type: cleanType(t.ty), prec: cleanPrec(t.p), drawings: (Array.isArray(t.d) ? t.d.slice(0, 50) : []).map(cleanDrawing).filter(Boolean) };
}
function cleanAuthor(a) {
  a = a && typeof a === 'object' ? a : {};
  return { name: String(a.display_name || '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Trader', avatar: safeAvatar(a.avatar_url) };
}
function cleanIdea(row, full) {
  if (!row || !isUuid(row.id) || !isUuid(row.user_id)) return null;
  const sym = parseSymbol(row.symbol);
  if (!sym || sym !== row.symbol) return null;
  const it = {
    id: row.id.toLowerCase(), user_id: row.user_id.toLowerCase(), symbol: sym,
    market: MARKET_NAME[row.market] ? row.market : catOf(sym),
    tf: TFS.some(t => t.id === row.tf) ? row.tf : '1h',
    direction: DIR_NAME[row.direction] ? row.direction : 'neutral',
    title: String(row.title || '').slice(0, 100) || 'Untitled idea',
    likes: Math.max(0, Math.floor(Number(row.likes) || 0)), comments: Math.max(0, Math.floor(Number(row.comments) || 0)), hidden: row.hidden === true,
    created_at: isoOk(row.created_at), updated_at: isoOk(row.updated_at || row.created_at),
    author: cleanAuthor(row.author),
  };
  if (full) {
    it.body = String(row.body || '').slice(0, 5000);
    const p = Number(row.price); it.price = isFinite(p) && p > 0 ? p : null;
    it.chart = cleanChart(row.chart); if (!it.chart) return null;
  } else {
    it.excerpt = String(row.excerpt || '').slice(0, 240);
    it.thumb = cleanThumb(row.thumb);
  }
  return it;
}
function cleanComment(row) {
  if (!row || !isUuid(row.id) || !isUuid(row.user_id)) return null;
  return { id: row.id.toLowerCase(), user_id: row.user_id.toLowerCase(), body: String(row.body || '').slice(0, 1500), hidden: row.hidden === true, created_at: isoOk(row.created_at), author: cleanAuthor(row.author) };
}

// ----- small pieces -----
function avatarEl(name, url, cls) {
  const box = el('span', cls || 'pic'), src = safeAvatar(url);
  const letter = () => el('span', 'avatar-letter', String(name || '?').trim().charAt(0).toUpperCase() || '?');
  if (src) { const img = el('img', 'avatar'); img.alt = ''; img.referrerPolicy = 'no-referrer'; img.loading = 'lazy'; img.src = src; img.onerror = () => img.replaceWith(letter()); box.append(img); }
  else box.append(letter());
  return box;
}
function ago(iso) {
  const ms = Date.parse(iso), s = (Date.now() - ms) / 1000, d = new Date(ms);
  const n = (v, w) => `${v} ${w}${v === 1 ? '' : 's'} ago`;
  if (s < 60) return 'just now';
  if (s < 3600) return n(Math.floor(s / 60), 'minute');
  if (s < 86400) return n(Math.floor(s / 3600), 'hour');
  if (s < 7 * 86400) return n(Math.floor(s / 86400), 'day');
  return `${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
const fullWhen = iso => { const d = new Date(iso); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function dirPill(dir) { const p = el('span', 'dir ' + dir, DIR_NAME[dir]); p.title = { long: 'Expects the price to rise', short: 'Expects the price to fall', neutral: 'No clear direction' }[dir]; return p; }
function iconBtn(cls, icon, text, title) {
  const b = el('button', cls); b.type = 'button'; b.innerHTML = svg(icon);
  if (text != null) b.append(el('span', null, text));
  if (title) { b.title = title; if (text == null) b.setAttribute('aria-label', title); }
  return b;
}
function statEl(icon, n, on, what) {
  const s = el('span', 'i-stat' + (on ? ' on' : '')); s.innerHTML = svg(icon); s.append(document.createTextNode(String(n)));
  s.setAttribute('aria-label', `${n} ${what}${n === 1 ? '' : 's'}`); s.title = s.getAttribute('aria-label');
  return s;
}
function openSignIn() { $('#googleBtn').disabled = false; if (!$('#signInDlg').open) $('#signInDlg').showModal(); }
function errText(e, fallback) {   // the database's own messages (limits, edit window) are written for people; others aren't
  const m = e && e.message ? String(e.message) : '';
  if (e && e.code === '23514' && m && !/violates|constraint/i.test(m)) return m;
  if (e && (e.code === '42501' || /row-level security/i.test(m))) return "You can't do that.";
  return fallback;
}
function heikinOf(B) {
  const out = []; let prev = null;
  for (const b of B) {
    const c = (b.open + b.high + b.low + b.close) / 4, o = prev ? (prev.open + prev.close) / 2 : (b.open + b.close) / 2;
    prev = { time: b.time, open: o, high: Math.max(b.high, o, c), low: Math.min(b.low, o, c), close: c }; out.push(prev);
  }
  return out;
}
function seriesStyle(type, prec) {   // the live chart's look, for an idea's chart
  const pf = pricePF(prec);
  switch (type) {
    case 'line': return [LineSeries, { color: C.draw, lineWidth: 2, priceFormat: pf }];
    case 'area': return [AreaSeries, { lineColor: C.draw, topColor: alpha(C.draw, 0.28), bottomColor: alpha(C.draw, 0.02), lineWidth: 2, priceFormat: pf }];
    case 'bars': return [BarSeries, { upColor: C.up, downColor: C.down, thinBars: false, priceFormat: pf }];
    default: return [CandlestickSeries, { upColor: C.up, downColor: C.down, borderUpColor: C.up, borderDownColor: C.down, wickUpColor: C.up, wickDownColor: C.down, priceFormat: pf }];
  }
}
function brandMark() { const w = $('#wmBrand').cloneNode(true); w.removeAttribute('id'); w.querySelectorAll('[id]').forEach(x => x.removeAttribute('id')); return w; }

// ----- the chart a person is about to publish -----
function captureIdea() {
  const T = S.bars, n = T.length; if (n < 10 || !S.main) return null;
  const vr = chart.timeScale().getVisibleLogicalRange(); if (!vr) return null;
  let from = Math.max(0, Math.floor(vr.from)); const to = Math.min(n - 1, Math.ceil(vr.to));
  if (to - from < 4) return null;
  if (to - from + 1 > 600) from = to - 599;   // zoomed far out: the latest 600 bars on screen
  const start = Math.max(0, from - 200);      // a little history before the view, so the indicators start right
  const dec = Math.min(10, S.prec + 2), rd = v => Number(v.toFixed(dec));
  const b = T.slice(start, to + 1).map(x => [x.time, rd(x.open), rd(x.high), rd(x.low), rd(x.close), x.volume > 0 ? Number(Number(x.volume).toPrecision(5)) : 0]);
  return {
    symbol: S.symbol, tf: S.tf, price: T[n - 1].close,
    chart: {
      v: 1, b, r: [Math.max(vr.from, from) - start, vr.to - start], ty: S.type, p: S.prec,
      d: curDrawings().map(cleanDrawing).filter(Boolean).slice(0, 100),
      i: S.rts.filter(rt => !rt.inst.hidden).slice(0, 12).map(rt => ({ type: rt.inst.type, params: rt.inst.params, color: rt.inst.color })),
    },
  };
}
function thumbOf(c) {   // up to 120 candles covering the view, for the idea cards
  const f = Math.max(0, Math.floor(c.r[0])), l = Math.min(c.b.length - 1, Math.ceil(c.r[1]));
  const vis = c.b.slice(f, l + 1), k = Math.max(1, Math.ceil(vis.length / 120)), sig = v => Number(v.toPrecision(7)), out = [];
  for (let i = 0; i < vis.length; i += k) {
    const g = vis.slice(i, i + k);
    out.push([g[0][0], sig(g[0][1]), sig(Math.max(...g.map(x => x[2]))), sig(Math.min(...g.map(x => x[3]))), sig(g[g.length - 1][4])]);
  }
  return { b: out, r: [(c.r[0] - f) / k, (c.r[1] - f) / k], ty: c.ty, p: c.p, d: c.d.slice(0, 50) };
}

// ----- drawing an idea's chart without the chart library (cards and the publish preview) -----
function staticMapper(T, r0, sp, left, yP, pOf) {
  const n = T.length, step = n > 1 ? (T[n - 1].time - T[0].time) / (n - 1) || 60 : 60;
  const tToL = t => {
    if (t <= T[0].time) return (t - T[0].time) / step;
    if (t >= T[n - 1].time) return n - 1 + (t - T[n - 1].time) / step;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T[mid].time <= t) lo = mid; else hi = mid; }
    return lo + (t - T[lo].time) / (T[hi].time - T[lo].time);
  };
  const LToT = Lg => (Lg <= 0 ? T[0].time + Lg * step : Lg >= n - 1 ? T[n - 1].time + (Lg - (n - 1)) * step : T[Math.floor(Lg)].time + (Lg - Math.floor(Lg)) * (T[Math.floor(Lg) + 1].time - T[Math.floor(Lg)].time));
  return { sp, L: x => r0 + (x - left) / sp, x: t => left + (tToL(t) - r0) * sp, t: x => LToT(r0 + (x - left) / sp), y: yP, p: pOf };
}
function drawThumb(cv, th) {
  const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = C.panel; g.fillRect(0, 0, W, H);
  if (!th) { g.fillStyle = C.faint; g.font = `12px ${FONT_BODY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Chart not available', W / 2, H / 2); return; }
  const B = th.type === 'heikin' ? heikinOf(th.bars) : th.bars, n = B.length, [r0, r1] = th.r;
  const left = 6, right = 6, top = 28, bottom = 10, sp = (W - left - right) / Math.max(1, r1 - r0);
  let lo = Infinity, hi = -Infinity;
  for (let i = Math.max(0, Math.floor(r0)); i <= Math.min(n - 1, Math.ceil(r1)); i++) { lo = Math.min(lo, B[i].low); hi = Math.max(hi, B[i].high); }
  if (!isFinite(lo)) { lo = Math.min(...B.map(b => b.low)); hi = Math.max(...B.map(b => b.high)); }
  {   // keep drawings that sit in the view inside the picture, within reason
    const t0 = B[Math.max(0, Math.floor(r0))].time, t1 = B[Math.min(n - 1, Math.ceil(r1))].time, span = hi - lo;
    for (const d of th.drawings) {
      const pts = [d.p1, d.p2].filter(Boolean);
      if (d.type !== 'hline' && !pts.some(q => q.t >= t0 && q.t <= t1)) continue;
      const ps = pts.map(q => q.p); if (d.tp != null) ps.push(d.tp);
      for (const v of ps) if (v > lo - span * 0.6 && v < hi + span * 0.6) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    }
  }
  if (hi - lo < Math.abs(hi) * 1e-9) { hi += Math.abs(hi) * 0.01 || 1; lo -= Math.abs(lo) * 0.01 || 1; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const yP = p => top + ((hi - p) / (hi - lo)) * (H - top - bottom), pOf = y => hi - ((y - top) / (H - top - bottom)) * (hi - lo);
  const xL = L => left + (L - r0) * sp;
  g.strokeStyle = C.grid; g.lineWidth = 1;
  for (let k = 1; k <= 3; k++) { const y = Math.round(top + ((H - top - bottom) * k) / 4) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  if (th.type === 'line' || th.type === 'area') {
    g.beginPath(); B.forEach((b, i) => { const x = xL(i), y = yP(b.close); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    if (th.type === 'area') {
      g.save(); g.lineTo(xL(n - 1), H); g.lineTo(xL(0), H); g.closePath();
      const gr = g.createLinearGradient(0, top, 0, H); gr.addColorStop(0, alpha(C.draw, 0.28)); gr.addColorStop(1, alpha(C.draw, 0.02)); g.fillStyle = gr; g.fill(); g.restore();
      g.beginPath(); B.forEach((b, i) => { const x = xL(i), y = yP(b.close); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    }
    g.strokeStyle = C.draw; g.lineWidth = 1.6; g.stroke();
  } else {
    const bw = Math.max(1, Math.min(14, sp * 0.62));
    for (let i = 0; i < n; i++) {
      const b = B[i], x = xL(i); if (x < -bw || x > W + bw) continue;
      const col = b.close >= b.open ? C.up : C.down; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
      if (th.type === 'bars') {
        g.beginPath(); g.moveTo(Math.round(x) + 0.5, yP(b.high)); g.lineTo(Math.round(x) + 0.5, yP(b.low));
        g.moveTo(x - bw / 2, yP(b.open)); g.lineTo(x, yP(b.open)); g.moveTo(x, yP(b.close)); g.lineTo(x + bw / 2, yP(b.close)); g.stroke();
      } else {
        g.beginPath(); g.moveTo(Math.round(x) + 0.5, yP(b.high)); g.lineTo(Math.round(x) + 0.5, yP(b.low)); g.stroke();
        const yo = yP(b.open), yc = yP(b.close); g.fillRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(1, Math.abs(yc - yo)));
      }
    }
  }
  if (th.drawings.length) {
    const m = staticMapper(th.bars, r0, sp, left, yP, pOf);
    withCtx(g, th.prec, () => { g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip(); for (const d of th.drawings) drawShape(d, m, W, H, false, false); g.restore(); });
  }
}

// ----- an idea's chart, interactive, drawn with the chart library -----
const IV = { ch: null, main: null, box: null, ov: null, ctx: null, it: null, bars: [], step: 3600, rts: [], raf: 0, sig: '', dirty: true, next: false, lg: null };
function ideaChartClose() {
  cancelAnimationFrame(IV.raf); IV.raf = 0;
  if (IV.ch) { try { IV.ch.remove(); } catch (e) { /* already gone */ } }
  Object.assign(IV, { ch: null, main: null, box: null, ov: null, ctx: null, it: null, bars: [], rts: [], sig: '', next: false, lg: null });
}
function ideaChartOpen(box, it) {
  ideaChartClose();
  const c = it.chart; IV.it = it; IV.box = box; IV.bars = c.bars.slice(); IV.step = tfOf(it.tf).sec;
  const holder = el('div', 'lwc'); IV.ov = el('canvas', 'i-ov'); IV.ctx = IV.ov.getContext('2d');
  IV.lg = el('div', 'legend'); box.replaceChildren(holder, IV.ov, IV.lg, brandMark());
  IV.ch = createChart(holder, {
    autoSize: true,
    layout: { background: { type: 'solid', color: C.panel }, textColor: C.muted, fontSize: 11, fontFamily: FONT_DATA, attributionLogo: false, panes: { enableResize: false, separatorColor: C.line } },
    grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
    crosshair: { mode: CrosshairMode.Normal, vertLine: { color: C.faint, labelBackgroundColor: C.crossLabel }, horzLine: { color: C.faint, labelBackgroundColor: C.crossLabel } },
    rightPriceScale: { borderColor: C.line },
    timeScale: { borderColor: C.line, timeVisible: IV.step < DAY, secondsVisible: false, rightOffset: 0, barSpacing: 8, minBarSpacing: 0.5, tickMarkFormatter: (t, ty, loc) => tickFmt(t, ty, loc, it.tf) },
    localization: { timeFormatter: t => fmtTime(t, it.tf) },
  });
  const [def, opts] = seriesStyle(c.type, c.prec);
  IV.main = IV.ch.addSeries(def, Object.assign({ lastValueVisible: true, priceLineVisible: false }, opts), 0);
  const vol = c.ind.some(x => x.type === 'vol');
  IV.main.priceScale().applyOptions({ autoScale: true, scaleMargins: vol ? { top: 0.08, bottom: 0.2 } : { top: 0.08, bottom: 0.06 } });
  IV.rts = c.ind.map(inst => Object.assign({ inst }, indSeries(IV.ch, inst, c.prec, IND[inst.type].pane ? IV.ch.panes().length : 0)));
  { const ps = IV.ch.panes(); ps.forEach((p, i) => { try { p.setStretchFactor(i === 0 ? mainStretch(ps.length) : 1); } catch (e) { /* older pane API */ } }); }
  ideaChartData();
  IV.ch.timeScale().setVisibleLogicalRange({ from: c.r[0], to: c.r[1] });
  IV.ch.subscribeCrosshairMove(p => ideaLegend(p && p.time != null ? p.time : null));
  ideaLegend(null);
  IV.raf = requestAnimationFrame(ideaFrame);
}
function ideaChartData() {
  const c = IV.it.chart, B = IV.bars;
  const pts = c.type === 'line' || c.type === 'area' ? B.map(b => ({ time: b.time, value: b.close })) : c.type === 'heikin' ? heikinOf(B) : B.map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }));
  try { IV.ch.clearCrosshairPosition(); } catch (e) { /* older library */ }
  IV.main.setData(pts);
  for (const rt of IV.rts) {
    indApply(rt, indCompute(rt.inst, B, IV.it.tf, IV.it.symbol), B);
  }
  IV.dirty = true;
}
function ideaLegend(time) {
  const it = IV.it; if (!it || !IV.lg) return;
  const B = IV.bars, i = time == null ? B.length - 1 : Math.max(0, rpIndexFor(B, time)), b = B[i];
  const head = el('div', 'lg-head'), title = el('span', 'lg-title', `${label(it.symbol)} `);
  title.append(el('span', null, `· ${tfOf(it.tf).label} · ${nameOf(it.symbol)}`));
  head.append(title);
  if (b) {
    const o = el('span', 'ohlc ' + (b.close >= b.open ? 'up' : 'down'));
    [['O', b.open], ['H', b.high], ['L', b.low], ['C', b.close]].forEach(([k, v]) => { const s = el('span'); s.append(el('i', null, k), el('b', null, fmtP(v, it.chart.prec))); o.append(s); });
    head.append(o);
  }
  IV.lg.replaceChildren(head);
}
function ideaFrame() {
  IV.raf = requestAnimationFrame(ideaFrame);
  if (!IV.ch || document.hidden || !IV.box) return;
  const W = IV.box.clientWidth, H = IV.box.clientHeight; if (!W || !H) return;
  const m = mapperFor(IV.ch, IV.main, IV.bars, IV.step);
  let sig = `${W}x${H}`;
  if (m) { const ref = IV.bars[IV.bars.length - 1].close; sig += `|${m.x(IV.bars[0].time).toFixed(2)}|${m.sp.toFixed(4)}|${m.y(ref)}|${m.y(ref * 1.05)}`; }
  try { sig += '|' + IV.ch.panes().map(p => p.getHeight()).join(','); } catch (e) { /* ignore */ }
  if (sig === IV.sig && !IV.dirty) return;
  IV.sig = sig; IV.dirty = false;
  const dpr = window.devicePixelRatio || 1, g = IV.ctx;
  IV.ov.width = Math.round(W * dpr); IV.ov.height = Math.round(H * dpr); IV.ov.style.width = W + 'px'; IV.ov.style.height = H + 'px';
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (!m) return;
  let ps; try { ps = IV.ch.paneSize(0); } catch (e) { return; }
  const it = IV.it, pub = Date.parse(it.created_at) / 1000, xp = m.x(pub);
  g.save(); g.beginPath(); g.rect(0, 0, ps.width, ps.height); g.clip();
  if (IV.next && xp < ps.width) { g.fillStyle = alpha(C.accent, 0.06); g.fillRect(Math.max(0, xp), 0, ps.width - Math.max(0, xp), ps.height); }
  withCtx(g, it.chart.prec, () => {
    for (const d of it.chart.drawings) drawShape(d, m, ps.width, ps.height, false, false);
    if (xp >= 0 && xp <= ps.width) {
      g.strokeStyle = alpha(C.accent, 0.85); g.lineWidth = 1; g.setLineDash([4, 4]); seg(Math.round(xp) + 0.5, 0, Math.round(xp) + 0.5, ps.height); g.setLineDash([]);
      pill(xp, ps.height - 14, 'Published', C.accent, 'center', ps.width);
    }
  });
  g.restore();
}
async function ideaNext(btn) {   // load today's prices after the idea, on the same chart
  const it = IV.it; if (!it || IV.next) return;
  if (!S.ready) { toast('Still connecting to market data. Try again in a moment.'); return; }
  if (srcOf(it.symbol) === 'demo' || S.sandbox) { toast(`Live prices for ${label(it.symbol)} aren't available right now.`); return; }
  const txt = btn.lastChild.textContent; btn.disabled = true; btn.lastChild.textContent = 'Loading prices…';
  try {
    const feed = feedFor(it.symbol), lastT = it.chart.bars[it.chart.bars.length - 1].time;
    let fresh = await feed.klines(it.symbol, it.tf);
    for (let k = 0; k < 6 && fresh.length && fresh[0].time > lastT + IV.step; k++) {   // reach back to the idea
      const older = await feed.klines(it.symbol, it.tf, fresh[0].time), add = older.filter(b => b.time < fresh[0].time);
      if (!add.length) break; fresh = add.concat(fresh);
    }
    if (IV.it !== it) return;
    const after = fresh.filter(b => b.time > lastT).map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume || 0 }));
    if (!after.length) { toast('No newer prices yet. Check back later.'); return; }
    IV.bars = it.chart.bars.concat(after); IV.next = true; ideaChartData(); ideaLegend(null);
    IV.ch.timeScale().setVisibleLogicalRange({ from: Math.max(0, Math.min(it.chart.r[0], IV.bars.length - 300)), to: IV.bars.length + 6 });
    btn.hidden = true;
    Ideas.nextNote(IV.bars[IV.bars.length - 1].close, after[0].time > lastT + IV.step * 3);
  } catch (e) {
    if (IV.it === it) toast("Newer prices couldn't be loaded. Please try again.");
  } finally { if (btn.isConnected) { btn.disabled = false; btn.lastChild.textContent = txt; } }
}

// ----- an idea on top of the live chart -----
function drawIdeaLayer(m, W, H) {
  const L = S.idea;
  for (const d of L.drawings) drawShape(d, m, W, H, false, false);
  const x = m.x(L.at);
  if (x >= 0 && x <= W) {
    octx.strokeStyle = alpha(C.accent, 0.85); octx.lineWidth = 1; octx.setLineDash([4, 4]); seg(Math.round(x) + 0.5, 0, Math.round(x) + 0.5, H); octx.setLineDash([]);
    pill(x, Math.max(14, Math.min(H - 14, ovH - 92)), 'Idea published', C.accent, 'center', W);   // clear of the legend and of the idea banner
  }
}
function ideaLayerOn(it) {
  S.idea = { id: it.id, symbol: it.symbol, tf: it.tf, title: it.title, author: it.author.name, drawings: it.chart.drawings, at: Math.floor(Date.parse(it.created_at) / 1000) };
  const nm = $('#ideaBarName'); nm.replaceChildren(document.createTextNode('Idea: '), el('b', null, it.title), document.createTextNode(` · ${it.author.name}`));
  nm.title = `${it.title} by ${it.author.name}`;
  $('#ideaCopy').hidden = !it.chart.drawings.length;
  $('#ideaBar').hidden = false; wrap.classList.add('idea-on'); markDirty();
}
function ideaLayerOff() { S.idea = null; $('#ideaBar').hidden = true; wrap.classList.remove('idea-on'); markDirty(); }
function openChartAt(sym, tf, focus) {
  S.focusTime = focus || 0;
  const tfChange = tf && tf !== S.tf;
  if (tfChange) { S.tf = tf; store.set('tf', tf); S.draft = null; S.measure = null; }
  setView('chart', true);
  if (sym !== S.symbol) setSymbol(sym);
  else if (tfChange) { loadChart(); updateUrl(); }
  else focusChart();
}
$('#ideaClose').onclick = ideaLayerOff;
$('#ideaBack').onclick = () => { if (S.idea) Ideas.open(S.idea.id, true); };
$('#ideaCopy').onclick = () => {
  const L = S.idea; if (!L || L.symbol !== S.symbol) return;
  pushUndo(); const list = curDrawings();
  L.drawings.forEach(d => list.push(Object.assign(JSON.parse(JSON.stringify(d)), { id: uid() })));
  saveDrawings(); toast(`Added ${L.drawings.length} drawing${L.drawings.length === 1 ? '' : 's'} to your chart.`); ideaLayerOff();
};

// ----- publishing -----
const Pub = {
  cap: null, dir: null,
  open() {
    if (!Auth.sb) { toast("Publishing ideas needs the site's accounts, which aren't set up here."); return; }
    if (!Auth.user) { openSignIn(); return; }
    if (R.on) { toast('Leave bar replay first. Ideas are published from the live chart.'); return; }
    if (!S.ready || S.sandbox || !S.bars.length || srcOf(S.symbol) === 'demo') { toast("This chart isn't showing live prices right now, so it can't be published as an idea."); return; }
    const cap = captureIdea();
    if (!cap) { toast('Scroll the chart so the bars you want to talk about are on screen, then try again.'); return; }
    this.cap = cap; ID.editing = null;
    $('#pTitleH').textContent = 'Publish idea'; $('#pGo').textContent = 'Publish idea';
    $('#pDirWrap').hidden = false; $('#pWhoWrap').hidden = false; $('#pFine').hidden = false; $('#pErr').hidden = true;
    $('#pName').value = (Auth.profile && Auth.profile.display_name) || '';
    $('#pPic').replaceWith(Object.assign(Auth.pic('pic'), { id: 'pPic' }));
    const nd = cap.chart.d.length, ni = cap.chart.i.length, info = $('#pInfo'); info.replaceChildren();
    info.append(el('b', null, `${label(cap.symbol)} · ${tfOf(cap.tf).label}`), document.createTextNode(` ${nameOf(cap.symbol)} · ${nd} drawing${nd === 1 ? '' : 's'} · ${ni} indicator${ni === 1 ? '' : 's'} · the chart exactly as you see it now`));
    this.setDir(this.dir); this.count();
    $('#publishDlg').showModal();
    requestAnimationFrame(() => drawThumb($('#pCanvas'), cleanThumb(thumbOf(cap.chart))));
    $('#pTitle').focus();
  },
  edit(it) {
    ID.editing = it.id; this.cap = null;
    $('#pTitleH').textContent = 'Edit idea'; $('#pGo').textContent = 'Save changes';
    $('#pDirWrap').hidden = true; $('#pWhoWrap').hidden = true; $('#pFine').hidden = true; $('#pErr').hidden = true;
    $('#pTitle').value = it.title; $('#pBody').value = it.body;
    const info = $('#pInfo'); info.replaceChildren(el('b', null, `${label(it.symbol)} · ${tfOf(it.tf).label}`), document.createTextNode(` · ${DIR_NAME[it.direction]} · the chart and the call can't be changed`));
    this.count(); $('#publishDlg').showModal();
    requestAnimationFrame(() => drawThumb($('#pCanvas'), cleanThumb(thumbOf({ b: it.chart.bars.map(b => [b.time, b.open, b.high, b.low, b.close]), r: it.chart.r, ty: it.chart.type, p: it.chart.prec, d: it.chart.drawings }))));
  },
  setDir(d) {
    this.dir = DIR_NAME[d] ? d : null;
    document.querySelectorAll('#pDir .btn').forEach(b => { const on = b.dataset.dir === this.dir; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  },
  count() { const n = $('#pBody').value.length; $('#pCount').textContent = `${n.toLocaleString('en-US')} / 5,000`; },
  err(msg) { const e = $('#pErr'); e.textContent = msg; e.hidden = !msg; },
  async submit() {
    const title = $('#pTitle').value.replace(/\s+/g, ' ').trim(), body = $('#pBody').value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
    const name = $('#pName').value.replace(/\s+/g, ' ').trim();
    if (title.length < 5) return this.err('Give your idea a title of at least 5 characters.');
    if (!ID.editing && !this.dir) return this.err('Choose your view: long, short or neutral.');
    if (body.length < 20) return this.err('Write a sentence or two about what you see (at least 20 characters).');
    if (!ID.editing && name.length < 2) return this.err('Enter the name to show on your ideas (at least 2 characters).');
    if (!Auth.user) { openSignIn(); return; }
    this.err(''); const go = $('#pGo'); go.disabled = true;
    try {
      if (ID.editing) {
        const { data, error } = await Auth.sb.from('ideas').update({ title, body }).eq('id', ID.editing).select(IDEA_FULL).single();
        if (error) throw error;
        const it = cleanIdea(data, true); if (it) { ID.cur = it; Ideas.patchList(it); }
        $('#publishDlg').close(); toast('Idea updated.'); Ideas.renderDetail(); return;
      }
      if (name !== ((Auth.profile && Auth.profile.display_name) || '')) {
        const { error } = await Auth.sb.from('profiles').update({ display_name: name }).eq('id', Auth.user.id);
        if (error) throw error;
        if (Auth.profile) Auth.profile.display_name = name; Auth.render();
      }
      const cap = this.cap;
      const row = { symbol: cap.symbol, market: catOf(cap.symbol), tf: cap.tf, direction: this.dir, title, body, price: cap.price, chart: cap.chart, thumb: thumbOf(cap.chart) };
      const { data, error } = await Auth.sb.from('ideas').insert(row).select('id').single();
      if (error) throw error;
      $('#publishDlg').close(); $('#pTitle').value = ''; $('#pBody').value = ''; this.setDir(null);
      toast('Your idea is published.'); ID.list = []; ID.page = 0;
      Ideas.open(String(data.id).toLowerCase(), true);
    } catch (e) {
      this.err(errText(e, ID.editing ? "The idea couldn't be saved. Check your connection and try again." : "The idea couldn't be published. Check your connection and try again."));
    } finally { go.disabled = false; }
  },
};
$('#ideaBtn').onclick = () => Pub.open();
$('#pDir').onclick = e => { const b = e.target.closest('.btn'); if (b) Pub.setDir(b.dataset.dir); };
$('#pBody').oninput = () => Pub.count();
$('#pForm').addEventListener('submit', e => { e.preventDefault(); Pub.submit(); });

// ----- reports -----
function openReport(kind, id) {
  if (!Auth.user) { openSignIn(); return; }
  ID.reportFor = { kind, id };
  $('#rTitle').textContent = kind === 'idea' ? 'Report this idea' : 'Report this comment';
  $('#rForm').reset(); $('#rGo').disabled = true; $('#reportDlg').showModal();
}
$('#rReasons').onchange = () => { $('#rGo').disabled = !$('#rForm').querySelector('input[name="reason"]:checked'); };
$('#rForm').addEventListener('submit', async e => {
  e.preventDefault();
  const pick = $('#rForm').querySelector('input[name="reason"]:checked'), f = ID.reportFor; if (!pick || !f) return;
  const go = $('#rGo'); go.disabled = true;
  const row = { reason: pick.value, note: $('#rNote').value.trim().slice(0, 500) }; row[f.kind === 'idea' ? 'idea_id' : 'comment_id'] = f.id;
  const { error } = await Auth.sb.from('reports').insert(row);
  go.disabled = false;
  if (error && error.code === '23505') { $('#reportDlg').close(); toast("You've already reported this. Thanks."); return; }
  if (error) { toast(errText(error, "The report couldn't be sent. Please try again.")); return; }
  $('#reportDlg').close(); toast('Thanks. The moderator will take a look.');
});

// ----- the Ideas page -----
function ideasRetheme() {
  if (curView() === 'ideas') Ideas.paintThumbs();
  if (IV.ch) {
    IV.ch.applyOptions({
      layout: { background: { type: 'solid', color: C.panel }, textColor: C.muted, panes: { separatorColor: C.line } },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      crosshair: { vertLine: { color: C.faint, labelBackgroundColor: C.crossLabel }, horzLine: { color: C.faint, labelBackgroundColor: C.crossLabel } },
      rightPriceScale: { borderColor: C.line }, timeScale: { borderColor: C.line },
    });
    IV.main.applyOptions(seriesStyle(IV.it.chart.type, IV.it.chart.prec)[1]);
    IV.rts.forEach(rt => { rt.lines.forEach(l => l.applyOptions({ color: C.faint })); recolorSpec(rt); });
    ideaChartData();
  }
}
const Ideas = {
  boot() { this.renderMarkets(); this.renderFilters(); },
  async account() {   // someone signed in or out
    const who = Auth.user ? Auth.user.id : null;
    ID.liked = new Set(); ID.admin = false;
    if (who && Auth.sb) { try { const { data } = await Auth.sb.rpc('is_admin'); ID.admin = data === true; } catch (e) { /* not a moderator */ } }
    if (!who) { ID.f.mine = false; ID.mod = false; }
    this.renderFilters(); this.modCount();
    if (who !== ID.who) { ID.who = who; if (curView() === 'ideas') this.show(true); }
  },
  show(refresh) {
    const box = $('#ideas');
    $('#iFeed').hidden = !!ID.open || ID.mod; $('#iDetail').hidden = !ID.open; $('#iMod').hidden = !ID.mod || !!ID.open;
    if (!Auth.sb) { this.unavailable(); return; }
    if (ID.open) { if (refresh || !ID.cur || ID.cur.id !== ID.open) this.detail(ID.open); else if (!IV.ch) this.renderDetail(); box.scrollTop = 0; }
    else {
      ideaChartClose();
      if (ID.mod) this.modList();
      else if (refresh || (!ID.list.length && !ID.loading)) this.feed(true);
      else { this.renderGrid(); requestAnimationFrame(() => { box.scrollTop = ID.scroll; }); }
    }
    $('#iSub').textContent = Auth.user ? 'Chart analysis shared by traders. Ideas are opinions, not financial advice.' : 'Chart analysis shared by traders. Sign in to publish, like and comment. Ideas are opinions, not financial advice.';
    updateDocTitle();
  },
  leave() { ideaChartClose(); },
  open(id, push) {
    if (!ID.open) ID.scroll = $('#ideas').scrollTop;
    ID.open = id; ID.mod = false; ID.cur = ID.cur && ID.cur.id === id ? ID.cur : null;
    setView('ideas', push); window.scrollTo(0, 0);
  },
  toFeed() { ID.open = null; ID.mod = false; setView('ideas', true); },
  unavailable() {
    $('#iFeed').hidden = false; $('#iDetail').hidden = true; $('#iMod').hidden = true;
    $('.i-filters').hidden = true; $('#iGrid').replaceChildren(); $('#iMore').hidden = true; $('#iPublish').hidden = true;
    const e = $('#iEmpty'); e.hidden = false;
    e.replaceChildren(el('h2', null, 'Ideas need accounts'), el('p', null, "Ideas are stored with the site's accounts, which aren't set up in this copy of the page. Open the published site to read and share ideas."));
  },

  // ----- the feed -----
  renderMarkets() {
    const box = $('#iMarkets'); box.replaceChildren();
    for (const [v, name] of MARKETS) {
      const b = el('button', 's-tab', name); b.type = 'button'; b.setAttribute('aria-pressed', String(ID.f.market === v)); b.setAttribute('aria-selected', String(ID.f.market === v));
      b.onclick = () => { ID.f.market = v; this.renderMarkets(); this.feed(true); }; box.append(b);
    }
  },
  renderFilters() {
    $('#iMine').hidden = !Auth.user; $('#iMine').setAttribute('aria-pressed', String(ID.f.mine));
    $('#iModBtn').hidden = !ID.admin;
    const chip = $('#iChip'); chip.replaceChildren();
    if (ID.f.author) {
      const c = el('span', 'i-chip-author'); c.append(el('span', null, `Ideas by ${ID.f.authorName}`));
      const x = el('button'); x.type = 'button'; x.innerHTML = svg('x'); x.setAttribute('aria-label', 'Show ideas by everyone');
      x.onclick = () => { ID.f.author = null; this.renderFilters(); this.feed(true); }; c.append(x); chip.append(c);
    }
  },
  filtered() { const f = ID.f; return f.market !== 'all' || f.dir !== 'all' || f.q || f.mine || f.author; },
  byAuthor(uid, name) { ID.f.author = uid; ID.f.authorName = name; ID.f.mine = false; ID.open = null; ID.mod = false; ID.list = []; this.renderFilters(); setView('ideas', true); },
  skeleton() { const g = $('#iGrid'); g.replaceChildren(); for (let i = 0; i < 6; i++) g.append(el('div', 'i-skel')); $('#iEmpty').hidden = true; $('#iMore').hidden = true; },
  async feed(reset) {
    if (!Auth.sb) { this.unavailable(); return; }
    $('.i-filters').hidden = false; $('#iPublish').hidden = false;
    if (reset) { ID.list = []; ID.page = 0; ID.done = false; ID.scroll = 0; this.skeleton(); }
    const req = ++ID.req; ID.loading = true; ID.failed = false; $('#iMore').disabled = true;
    try {
      const f = ID.f;
      let q = Auth.sb.from('ideas').select(IDEA_LIST);
      if (f.mine && Auth.user) q = q.eq('user_id', Auth.user.id); else q = q.eq('hidden', false);
      if (f.author) q = q.eq('user_id', f.author);
      if (f.market !== 'all') q = q.eq('market', f.market);
      if (f.dir !== 'all') q = q.eq('direction', f.dir);
      if (f.q) {
        const id = parseSymbol(f.q);
        if (id && (NAMES[id] || DEMO[id] || CFD[id] || classOf(id) === 'crypto')) q = q.eq('symbol', id);
        else q = q.ilike('symbol', `%:${f.q}%`);
      }
      if (f.sort === 'new') q = q.order('created_at', { ascending: false });
      else {
        if (f.sort !== 'all') q = q.gte('created_at', new Date(Date.now() - (f.sort === 'week' ? 7 : 30) * 864e5).toISOString());
        q = q.order('likes', { ascending: false }).order('created_at', { ascending: false });
      }
      const from = ID.page * IDEA_PAGE;
      const { data, error } = await q.range(from, from + IDEA_PAGE - 1);
      if (req !== ID.req) return;
      if (error) throw error;
      const seen = new Set(ID.list.map(x => x.id));
      const rows = (data || []).map(r => cleanIdea(r, false)).filter(x => x && !seen.has(x.id));
      await this.loadLiked(rows.map(r => r.id));
      if (req !== ID.req) return;
      ID.list = ID.list.concat(rows); ID.page++; ID.done = (data || []).length < IDEA_PAGE;
    } catch (e) {
      if (req !== ID.req) return;
      ID.failed = true;
    }
    ID.loading = false; this.renderGrid();
  },
  async loadLiked(ids) {
    if (!Auth.user || !ids.length) return;
    try { const { data } = await Auth.sb.from('idea_likes').select('idea_id').in('idea_id', ids); (data || []).forEach(r => { if (isUuid(r.idea_id)) ID.liked.add(r.idea_id.toLowerCase()); }); } catch (e) { /* hearts stay empty */ }
  },
  renderGrid() {
    const grid = $('#iGrid'), empty = $('#iEmpty'); grid.replaceChildren();
    $('#iMore').hidden = ID.done || !ID.list.length || ID.failed; $('#iMore').disabled = false;
    if (!ID.list.length) {
      empty.hidden = false; empty.replaceChildren();
      if (ID.failed) {
        const b = el('button', 'primary', 'Try again'); b.type = 'button'; b.onclick = () => this.feed(true);
        empty.append(el('h2', null, "Ideas couldn't be loaded"), el('p', null, 'Check your connection and try again.'), b);
      } else if (this.filtered()) {
        const b = el('button', 'ghost', 'Show all ideas'); b.type = 'button';
        b.onclick = () => { Object.assign(ID.f, { market: 'all', dir: 'all', q: '', mine: false, author: null }); $('#iSearch').value = ''; this.setDirSeg(); this.renderMarkets(); this.renderFilters(); this.feed(true); };
        empty.append(el('h2', null, ID.f.mine ? "You haven't published any ideas yet" : 'No ideas match'), el('p', null, ID.f.mine ? 'Open a chart, draw your levels and press Publish idea at the top.' : 'Try another market or symbol, or show all ideas.'), b);
      } else {
        const b = el('button', 'primary', '+ Publish the first idea'); b.type = 'button'; b.onclick = () => this.startPublish();
        empty.append(el('h2', null, 'No ideas yet'), el('p', null, 'Share how you read a chart: open one, draw your levels and press Publish idea at the top. Your idea shows here for everyone.'), b);
      }
      return;
    }
    empty.hidden = true;
    for (const it of ID.list) grid.append(this.card(it));
    this.paintThumbs();
  },
  card(it) {
    const card = el('article', 'i-card');
    const fig = el('div', 'i-thumb'), cv = el('canvas'); cv.setAttribute('aria-hidden', 'true'); cv._thumb = it.thumb;
    fig.append(cv, el('span', 'i-sym', `${label(it.symbol)} · ${tfOf(it.tf).label}`));
    const b = el('div', 'i-card-b'), pills = el('div', 'i-pills'); pills.append(dirPill(it.direction));
    if (it.hidden) pills.append(el('span', 'hid-pill', 'Hidden by the moderator'));
    const h = el('h3'), a = el('a', null, it.title); a.href = '?view=ideas&idea=' + it.id;
    a.onclick = e => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); this.open(it.id, true); };
    h.append(a); b.append(pills, h, el('p', 'i-ex', it.excerpt));
    const foot = el('div', 'i-foot'), who = el('button', 'i-author'); who.type = 'button'; who.title = `More ideas by ${it.author.name}`;
    who.append(avatarEl(it.author.name, it.author.avatar), el('span', null, it.author.name)); who.onclick = () => this.byAuthor(it.user_id, it.author.name);
    const when = el('span', 'i-when', ago(it.created_at)); when.title = fullWhen(it.created_at);
    foot.append(who, when, statEl('heart', it.likes, ID.liked.has(it.id), 'like'), statEl('chat', it.comments, false, 'comment'));
    card.append(fig, b, foot);
    return card;
  },
  paintThumbs() { requestAnimationFrame(() => document.querySelectorAll('#iGrid canvas').forEach(cv => drawThumb(cv, cv._thumb))); },
  setDirSeg() { document.querySelectorAll('#iDir .btn').forEach(x => { const on = x.dataset.v === ID.f.dir; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); },
  patchList(it) { const x = ID.list.find(y => y.id === it.id); if (x) { x.title = it.title; x.likes = it.likes; x.comments = it.comments; x.hidden = it.hidden; if (it.body != null) x.excerpt = it.body.slice(0, 240); } },
  startPublish() {
    setView('chart', true);
    toast('Set up the chart you want to share (symbol, timeframe and drawings), then press Publish idea at the top.');
    const b = $('#ideaBtn'); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
  },

  // ----- one idea -----
  async detail(id) {
    const box = $('#iDetail'); ideaChartClose();
    box.replaceChildren(el('div', 'i-skel'));
    ID.cur = null; ID.comments = [];
    const req = ++ID.dreq;
    try {
      const { data, error } = await Auth.sb.from('ideas').select(IDEA_FULL).eq('id', id).maybeSingle();
      if (req !== ID.dreq) return;
      if (error) throw error;
      const it = data && cleanIdea(data, true);
      if (!it) { this.gone(false); return; }
      if (Auth.user && it.user_id !== Auth.user.id) {
        const { data: l } = await Auth.sb.from('idea_likes').select('idea_id').eq('idea_id', id).maybeSingle();
        if (l) ID.liked.add(id); else ID.liked.delete(id);
      }
      if (req !== ID.dreq) return;
      ID.cur = it; this.patchList(it); updateDocTitle();
      this.renderDetail(); this.loadComments(it);
    } catch (e) { if (req === ID.dreq) this.gone(true); }
  },
  gone(failed) {
    const box = $('#iDetail'), g = el('div', 'i-gone'), b = el('button', 'primary', failed ? 'Try again' : 'See all ideas'); b.type = 'button';
    b.onclick = () => (failed ? this.detail(ID.open) : this.toFeed());
    g.append(el('h2', null, failed ? "This idea couldn't be loaded" : "This idea isn't available"), el('p', null, failed ? 'Check your connection and try again.' : 'It may have been deleted by its author or hidden by the moderator.'), b);
    box.replaceChildren(g); updateDocTitle();
  },
  renderDetail() {
    const it = ID.cur; if (!it) return;
    const box = $('#iDetail'), main = el('div', 'i-main'), aside = el('aside', 'i-aside');
    const mine = !!(Auth.user && Auth.user.id === it.user_id);
    // heading
    const top = el('div', 'i-top'), back = iconBtn('i-back', 'back', 'All ideas'); back.onclick = () => this.toFeed();
    const meta = el('div', 'i-meta'), symB = el('button', 'sym', `${label(it.symbol)} · ${tfOf(it.tf).label}`); symB.type = 'button'; symB.title = 'Open this chart'; symB.onclick = () => openChartAt(it.symbol, it.tf);
    const who = el('button', 'i-author'); who.type = 'button'; who.append(avatarEl(it.author.name, it.author.avatar), el('span', null, it.author.name)); who.onclick = () => this.byAuthor(it.user_id, it.author.name);
    const when = el('span', null, ago(it.created_at)); when.title = fullWhen(it.created_at);
    meta.append(dirPill(it.direction), symB, who, when);
    if (Date.parse(it.updated_at) - Date.parse(it.created_at) > 60000) meta.append(el('span', null, 'edited'));
    top.append(back, el('h1', 'i-title', it.title), meta);
    main.append(top);
    if (it.hidden) {
      const ban = el('div', 'i-banner'); ban.append(el('b', null, 'Hidden.'), document.createTextNode(ID.admin ? ' Only you and the author can see this idea.' : ' The moderator has hidden this idea. Only you can see it.'));
      if (ID.admin) { const u = el('button', 'ghost', 'Show it again'); u.type = 'button'; u.onclick = () => this.moderate('idea', it.id, 'unhide'); ban.append(u); }
      main.append(ban);
    }
    // chart
    const chartBox = el('div', 'i-chart'); chartBox.setAttribute('role', 'img'); chartBox.setAttribute('aria-label', `Chart of ${label(it.symbol)} on ${tfOf(it.tf).label} bars as published, with the author's drawings`);
    const bar = el('div', 'i-chart-bar');
    const nextB = iconBtn('ghost', 'next', 'What happened next', 'Add the prices since this idea was published'); nextB.onclick = () => ideaNext(nextB);
    const liveB = iconBtn('ghost', 'open', 'Open on live chart', "Open this market on the live chart with the author's drawings"); liveB.onclick = () => { ideaLayerOn(it); openChartAt(it.symbol, it.tf, S.idea.at); };
    const note = el('span', 'i-next-note'); note.id = 'iNextNote';
    bar.append(nextB, liveB, note);
    main.append(chartBox, bar);
    // actions
    const acts = el('div', 'i-actions');
    const like = iconBtn('ghost i-like', 'heart', null, mine ? "Likes on your idea" : 'Like this idea'); like.append(el('b', null, String(it.likes))); like.setAttribute('aria-pressed', String(ID.liked.has(it.id)));
    like.setAttribute('aria-label', `${mine ? 'Likes' : 'Like'}: ${it.likes}`); like.onclick = () => this.like(like);
    const com = iconBtn('ghost', 'chat', String(it.comments), 'Go to the comments'); com.id = 'iComBtn'; com.onclick = () => { const s = $('#iComments'); if (s) { s.scrollIntoView({ behavior: 'smooth', block: 'start' }); const t = s.querySelector('textarea'); if (t) setTimeout(() => t.focus({ preventScroll: true }), 300); } };
    const share = iconBtn('ghost', 'share', 'Share', 'Copy a link to this idea'); share.onclick = () => {
      const url = ideaUrl(it.id);
      try { navigator.clipboard.writeText(url).then(() => toast('Link copied. Anyone can open it.'), () => toast(url)); } catch (e) { toast(url); }
    };
    acts.append(like, com, share);
    if (!mine) { const rep = iconBtn('ghost', 'flag', 'Report', 'Report this idea to the moderator'); rep.onclick = () => openReport('idea', it.id); acts.append(rep); }
    if (mine && Date.now() - Date.parse(it.created_at) < 3600e3) { const ed = iconBtn('ghost', 'pen', 'Edit', 'Fix the title or text (for an hour after publishing)'); ed.onclick = () => Pub.edit(it); acts.append(ed); }
    if (ID.admin && !it.hidden && !mine) { const hd = iconBtn('ghost', 'eyeoff', 'Hide', 'Hide this idea from everyone'); hd.onclick = () => this.moderate('idea', it.id, 'hide'); acts.append(hd); }
    if (mine || ID.admin) { const del = iconBtn('danger', 'trash', 'Delete', 'Delete this idea'); del.onclick = () => this.remove(del); acts.append(del); }
    main.append(acts);
    // the analysis
    const body = el('div', 'i-body'); body.append(el('p', 'i-text', it.body), el('p', 'i-disc', "This is the author's opinion, not financial advice. Prices can move against any idea."));
    main.append(body);
    const coms = el('section', 'i-com'); coms.id = 'iComments'; coms.setAttribute('aria-label', 'Comments'); main.append(coms);
    // side panel
    const who2 = el('div', 'i-card2'), wrow = el('div', 'i-who'), wtxt = el('div'); wtxt.style.minWidth = '0';
    const more = el('button', null, `More ideas by ${it.author.name}`); more.type = 'button'; more.onclick = () => this.byAuthor(it.user_id, it.author.name);
    wtxt.append(el('b', null, it.author.name), more); wrow.append(avatarEl(it.author.name, it.author.avatar), wtxt); who2.append(el('h2', null, 'Author'), wrow);
    const facts = el('div', 'i-card2'), dl = el('dl', 'i-facts'); dl.id = 'iFacts';
    const fact = (k, v) => { dl.append(el('dt', null, k)); const dd = el('dd'); if (typeof v === 'string') dd.textContent = v; else dd.append(v); dl.append(dd); return dd; };
    const symB2 = el('button', null, label(it.symbol)); symB2.type = 'button'; symB2.title = 'Open this chart'; symB2.onclick = () => openChartAt(it.symbol, it.tf);
    fact('Symbol', symB2); fact('Market', MARKET_NAME[it.market] || kindOf(it.symbol)); fact('Timeframe', tfOf(it.tf).label); fact('Call', DIR_NAME[it.direction]);
    fact('Price then', it.price != null ? fmtP(it.price, it.chart.prec) : '—'); fact('Published', fullWhen(it.created_at));
    facts.append(el('h2', null, 'The idea'), dl);
    const moreBox = el('div', 'i-card2'); moreBox.id = 'iMoreBox'; moreBox.append(el('h2', null, `More on ${label(it.symbol)}`), el('p', 'fine', 'Loading…'));
    aside.append(who2, facts, moreBox);
    box.replaceChildren(main, aside);
    ideaChartOpen(chartBox, it);
    this.renderComments(); this.loadMore(it);
  },
  nextNote(now, gap) {
    const it = ID.cur; if (!it) return;
    const n = $('#iNextNote'), dl = $('#iFacts'); if (!n || !dl) return;
    const chg = it.price ? ((now - it.price) / it.price) * 100 : null;
    n.replaceChildren(document.createTextNode('Since the idea: '), el('b', chg > 0 ? 'up-t' : chg < 0 ? 'dn-t' : null, fmtPct(chg)));
    if (it.direction !== 'neutral' && chg != null && chg !== 0) n.append(document.createTextNode((chg > 0) === (it.direction === 'long') ? ', in favour of the call' : ', against the call'));
    if (gap) n.append(document.createTextNode('. Some bars in between are missing.'));
    dl.append(el('dt', null, 'Price now'), el('dd', null, fmtP(now, it.chart.prec)), el('dt', null, 'Change since'));
    dl.append(el('dd', chg > 0 ? 'up-t' : chg < 0 ? 'dn-t' : null, fmtPct(chg)));
  },
  async like(btn) {
    const it = ID.cur; if (!it) return;
    if (!Auth.user) { openSignIn(); return; }
    if (it.user_id === Auth.user.id) { toast("You can't like your own idea."); return; }
    const on = !ID.liked.has(it.id), paint = () => { btn.setAttribute('aria-pressed', String(ID.liked.has(it.id))); btn.querySelector('b').textContent = String(it.likes); btn.setAttribute('aria-label', `Like: ${it.likes}`); this.patchList(it); };
    const flip = v => { if (v) ID.liked.add(it.id); else ID.liked.delete(it.id); it.likes = Math.max(0, it.likes + (v ? 1 : -1)); paint(); };
    flip(on); btn.disabled = true;
    try {
      const r = on ? await Auth.sb.from('idea_likes').insert({ idea_id: it.id }) : await Auth.sb.from('idea_likes').delete().eq('idea_id', it.id).eq('user_id', Auth.user.id);
      if (r.error && !(on && r.error.code === '23505')) throw r.error;
    } catch (e) { flip(!on); toast("That didn't work. Please try again."); }
    finally { btn.disabled = false; }
  },
  async remove(btn) {
    const it = ID.cur; if (!it) return;
    if (!btn._arm || Date.now() - btn._arm > 4000) {
      btn._arm = Date.now(); btn.lastChild.textContent = 'Click again to delete';
      setTimeout(() => { if (btn.isConnected && Date.now() - btn._arm >= 4000) btn.lastChild.textContent = 'Delete'; }, 4100); return;
    }
    btn.disabled = true;
    const { error, count } = await Auth.sb.from('ideas').delete({ count: 'exact' }).eq('id', it.id);
    btn.disabled = false;
    if (error || count === 0) { toast(errText(error, "The idea couldn't be deleted. Please try again.")); return; }
    ID.list = ID.list.filter(x => x.id !== it.id); ID.cur = null;
    if (S.idea && S.idea.id === it.id) ideaLayerOff();
    toast('Idea deleted.'); this.toFeed();
  },
  async moderate(kind, id, action) {
    const { error } = await Auth.sb.rpc('moderate', { kind, target: id, action });
    if (error) { toast(errText(error, "That didn't work. Please try again.")); return false; }
    toast({ hide: kind === 'idea' ? 'Idea hidden. Only its author can see it now.' : 'Comment hidden.', unhide: kind === 'idea' ? 'The idea is visible again.' : 'The comment is visible again.', dismiss: 'Report dismissed.' }[action]);
    if (kind === 'idea' && ID.cur && ID.cur.id === id && action !== 'dismiss') { ID.cur.hidden = action === 'hide'; this.patchList(ID.cur); this.renderDetail(); }
    if (kind === 'comment') { const c = ID.comments.find(x => x.id === id); if (c && action !== 'dismiss') { const was = c.hidden; c.hidden = action === 'hide'; if (ID.cur && was !== c.hidden) { ID.cur.comments += c.hidden ? -1 : 1; this.syncComCount(); } this.renderComments(); } }
    this.modCount(); if (ID.mod && !ID.open) this.modList();
    return true;
  },
  async loadMore(it) {
    const box = $('#iMoreBox'); if (!box) return;
    let rows = [];
    try {
      const { data } = await Auth.sb.from('ideas').select('id,user_id,symbol,title,direction,likes,created_at,author:profiles(display_name)').eq('symbol', it.symbol).eq('hidden', false).neq('id', it.id).order('created_at', { ascending: false }).limit(5);
      rows = (data || []).filter(r => isUuid(r.id));
    } catch (e) { /* leave it empty */ }
    if (!box.isConnected || !ID.cur || ID.cur.id !== it.id) return;
    const list = el('div', 'i-more');
    for (const r of rows) {
      const a = el('a'); a.href = '?view=ideas&idea=' + r.id.toLowerCase();
      a.onclick = e => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); this.open(r.id.toLowerCase(), true); };
      const line = el('span'); line.append(dirPill(DIR_NAME[r.direction] ? r.direction : 'neutral'), document.createTextNode(`${cleanAuthor(r.author).name} · ${ago(isoOk(r.created_at))}`));
      a.append(el('b', null, String(r.title || '').slice(0, 100)), line); list.append(a);
    }
    box.replaceChildren(el('h2', null, `More on ${label(it.symbol)}`));
    if (rows.length) box.append(list); else box.append(el('p', 'fine', `No other ideas on ${label(it.symbol)} yet.`));
  },

  // ----- comments -----
  async loadComments(it) {
    try {
      const { data, error } = await Auth.sb.from('idea_comments').select(COMMENT_COLS).eq('idea_id', it.id).order('created_at', { ascending: true }).limit(500);
      if (error) throw error;
      if (!ID.cur || ID.cur.id !== it.id) return;
      ID.comments = (data || []).map(cleanComment).filter(Boolean); ID.comFail = false;
    } catch (e) { ID.comFail = true; }
    this.renderComments();
  },
  syncComCount() {
    const b = $('#iComBtn'); if (b && ID.cur) b.lastChild.textContent = String(ID.cur.comments);
    if (ID.cur) this.patchList(ID.cur);
  },
  renderComments() {
    const sec = $('#iComments'), it = ID.cur; if (!sec || !it) return;
    const shown = ID.comments.filter(c => !c.hidden).length;
    const h = el('h2', null, 'Comments'); h.append(el('span', null, String(shown)));
    sec.replaceChildren(h);
    if (ID.comFail) sec.append(el('p', 'fine', "Comments couldn't be loaded."));
    else if (!ID.comments.length) sec.append(el('p', 'fine', 'No comments yet. Start the conversation.'));
    for (const c of ID.comments) sec.append(this.comment(c, it));
    if (Auth.user) {
      const f = el('form', 'i-form'); f.noValidate = true;
      const ta = el('textarea', 'field'); ta.maxLength = 1500; ta.rows = 3; ta.placeholder = 'Add a comment'; ta.setAttribute('aria-label', 'Add a comment');
      const row = el('div', 'row'), hint = el('p', 'fine', 'Be kind and stay on topic.'), cnt = el('span', 'p-count', ''), go = el('button', 'primary', 'Post comment'); go.type = 'submit';
      ta.oninput = () => { cnt.textContent = ta.value.length > 1200 ? `${ta.value.length} / 1,500` : ''; };
      row.append(hint, cnt, go); f.append(ta, row);
      f.addEventListener('submit', e => { e.preventDefault(); this.postComment(ta, go); });
      sec.append(f);
    } else if (Auth.sb) {
      const p = el('p', 'fine'), b = el('button', null, 'Sign in'); b.type = 'button'; b.style.cssText = 'color:var(--accent);font-weight:600;padding:0'; b.onclick = openSignIn;
      p.append(b, document.createTextNode(' to like ideas and join the conversation.')); sec.append(p);
    }
  },
  comment(c, it) {
    const row = el('div', 'i-c' + (c.hidden ? ' hidden' : '')), head = el('div', 'i-c-h');
    head.append(el('b', null, c.author.name));
    if (c.user_id === it.user_id) head.append(el('span', 'by-author', 'Author'));
    const t = el('span', null, ago(c.created_at)); t.title = fullWhen(c.created_at); head.append(t);
    if (c.hidden) head.append(el('span', 'hid-pill', 'Hidden'));
    const acts = el('span', 'acts'), me = Auth.user && Auth.user.id;
    if (me && c.user_id !== me && !c.hidden) { const r = el('button', null, 'Report'); r.type = 'button'; r.onclick = () => openReport('comment', c.id); acts.append(r); }
    if (ID.admin && c.user_id !== me) { const hb = el('button', null, c.hidden ? 'Show' : 'Hide'); hb.type = 'button'; hb.onclick = () => this.moderate('comment', c.id, c.hidden ? 'unhide' : 'hide'); acts.append(hb); }
    if (me && (c.user_id === me || it.user_id === me || ID.admin)) { const d = el('button', 'warn', 'Delete'); d.type = 'button'; d.onclick = () => this.delComment(c, d); acts.append(d); }
    head.append(acts);
    row.append(avatarEl(c.author.name, c.author.avatar), head, el('p', null, c.hidden && !ID.admin && c.user_id !== me ? 'This comment was hidden by the moderator.' : c.body));
    return row;
  },
  async postComment(ta, go) {
    const it = ID.cur; if (!it || !Auth.user) return;
    const body = ta.value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
    if (!body) { ta.focus(); return; }
    go.disabled = true;
    try {
      const { data, error } = await Auth.sb.from('idea_comments').insert({ idea_id: it.id, body: body.slice(0, 1500) }).select(COMMENT_COLS).single();
      if (error) throw error;
      const c = cleanComment(data);
      if (c) { if (!c.author || c.author.name === 'Trader') c.author = { name: Auth.name(), avatar: safeAvatar(Auth.profile && Auth.profile.avatar_url) }; ID.comments.push(c); }
      it.comments++; this.syncComCount(); this.renderComments();
      const s = $('#iComments'); if (s) s.lastElementChild.scrollIntoView({ block: 'nearest' });
    } catch (e) { go.disabled = false; toast(errText(e, "Your comment couldn't be posted. Please try again.")); }
  },
  async delComment(c, btn) {
    if (!btn._arm || Date.now() - btn._arm > 4000) {
      btn._arm = Date.now(); btn.textContent = 'Click again to delete';
      setTimeout(() => { if (btn.isConnected && Date.now() - btn._arm >= 4000) btn.textContent = 'Delete'; }, 4100); return;
    }
    btn.disabled = true;
    const { error, count } = await Auth.sb.from('idea_comments').delete({ count: 'exact' }).eq('id', c.id);
    if (error || count === 0) { btn.disabled = false; toast(errText(error, "The comment couldn't be deleted. Please try again.")); return; }
    ID.comments = ID.comments.filter(x => x.id !== c.id);
    if (ID.cur && !c.hidden) { ID.cur.comments = Math.max(0, ID.cur.comments - 1); this.syncComCount(); }
    this.renderComments(); toast('Comment deleted.');
  },

  // ----- moderation (the site owner) -----
  async modCount() {
    const b = $('#iModBtn'); b.hidden = !ID.admin; if (!ID.admin || !Auth.sb) return;
    try { const { count } = await Auth.sb.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false); b.textContent = count ? `Reports (${count})` : 'Reports'; }
    catch (e) { b.textContent = 'Reports'; }
  },
  async modList() {
    const box = $('#iMod'), head = el('div', 'j-head'), t = el('div'), back = iconBtn('i-back', 'back', 'All ideas'); back.onclick = () => this.toFeed();
    t.append(back, el('h1', null, 'Reports'), el('p', 'j-sub', 'Ideas and comments people have reported. Hiding something removes it for everyone except its author.'));
    head.append(t); box.replaceChildren(head, el('div', 'i-skel'));
    let rows = [];
    try {
      const { data, error } = await Auth.sb.from('reports').select('id,reason,note,created_at,idea_id,comment_id,idea:ideas(id,title,hidden),comment:idea_comments(id,body,idea_id,hidden)').eq('resolved', false).order('created_at', { ascending: false }).limit(300);
      if (error) throw error; rows = data || [];
    } catch (e) { box.replaceChildren(head, el('p', 'fine', "Reports couldn't be loaded. Please try again.")); return; }
    const groups = new Map();
    for (const r of rows) {
      const kind = r.comment_id ? 'comment' : 'idea', id = String(r.comment_id || r.idea_id || '').toLowerCase(); if (!isUuid(id)) continue;
      let g = groups.get(id);
      if (!g) {
        const tgt = kind === 'idea' ? r.idea : r.comment;
        g = { kind, id, text: kind === 'idea' ? String(tgt && tgt.title || 'An idea') : String(tgt && tgt.body || 'A comment'), ideaId: kind === 'idea' ? id : String(tgt && tgt.idea_id || '').toLowerCase(), hidden: !!(tgt && tgt.hidden), reasons: {}, notes: [] };
        groups.set(id, g);
      }
      g.reasons[r.reason] = (g.reasons[r.reason] || 0) + 1;
      if (r.note) g.notes.push(String(r.note).slice(0, 500));
    }
    box.replaceChildren(head);
    if (!groups.size) { box.append(el('div', 'i-gone', 'No open reports.')); return; }
    for (const g of groups.values()) {
      const row = el('div', 'i-mod-row'), what = el('div'), n = Object.values(g.reasons).reduce((a, b) => a + b, 0);
      what.append(el('div', 'what', `${g.kind === 'idea' ? 'Idea' : 'Comment'}${g.hidden ? ' · hidden' : ''}`), el('p', 'txt', g.text));
      const why = el('div', 'why', `${n} report${n === 1 ? '' : 's'}: ${Object.entries(g.reasons).map(([k, v]) => `${REASONS[k] || k}${v > 1 ? ' ×' + v : ''}`).join(', ')}${g.notes.length ? ' · “' + g.notes.slice(0, 3).join('” “') + '”' : ''}`);
      const acts = el('div', 'acts');
      if (isUuid(g.ideaId)) { const o = el('button', 'ghost', 'Open'); o.type = 'button'; o.onclick = () => this.open(g.ideaId, true); acts.append(o); }
      const hb = el('button', 'ghost', g.hidden ? 'Show again' : 'Hide'); hb.type = 'button'; hb.onclick = () => this.moderate(g.kind, g.id, g.hidden ? 'unhide' : 'hide');
      const db = el('button', 'ghost', 'Dismiss'); db.type = 'button'; db.title = 'Nothing wrong: close these reports'; db.onclick = () => this.moderate(g.kind, g.id, 'dismiss');
      acts.append(hb, db); row.append(what, acts, why); box.append(row);
    }
  },
};

// ----- controls -----
$('#iPublish').onclick = () => Ideas.startPublish();
$('#iMore').onclick = () => Ideas.feed(false);
$('#iSort').onchange = e => { ID.f.sort = e.target.value; Ideas.feed(true); };
$('#iDir').onclick = e => { const b = e.target.closest('.btn'); if (!b) return; ID.f.dir = b.dataset.v; Ideas.setDirSeg(); Ideas.feed(true); };
$('#iMine').onclick = () => { ID.f.mine = !ID.f.mine; if (ID.f.mine) ID.f.author = null; Ideas.renderFilters(); Ideas.feed(true); };
$('#iModBtn').onclick = () => { ID.mod = true; ID.open = null; setView('ideas', true); };
{
  let t = null;
  const go = () => { const v = $('#iSearch').value.toUpperCase().replace(/[^A-Z0-9./-]/g, '').slice(0, 20); if (v === ID.f.q) return; ID.f.q = v; Ideas.feed(true); };
  $('#iSearch').oninput = () => { clearTimeout(t); t = setTimeout(go, 450); };
  $('#iSearch').onkeydown = e => { if (e.key === 'Enter') { clearTimeout(t); go(); } };
}
new ResizeObserver(() => { if (curView() === 'ideas' && !ID.open) Ideas.paintThumbs(); }).observe($('#iGrid'));

/* ---------- paper trading ----------
   Practise trading with virtual money. People can keep several paper accounts, each with its own starting
   balance. "Live" accounts trade on live prices: orders fill from the same prices the chart shows while the page
   is open, and when it's opened again, orders and stops that would have filled in the meantime are filled from
   the price history. "Replay" accounts trade inside a bar replay, filling from the bars as they play.
   Each symbol has one position: buys and sells net out, the way TradingView's paper account works.
   Kept in this browser, and in the person's account when signed in. */
const PT_LEV_DEF = { crypto: 2, stock: 4, fund: 4, forex: 50, index: 20, futures: 20, bond: 10 };
const PT_MKTS = [['crypto', 'Crypto'], ['stock', 'US stocks'], ['fund', 'Funds (ETFs)'], ['forex', 'Forex and metals'], ['index', 'Indices'], ['futures', 'Commodities'], ['bond', 'Bonds']];
const PT_LEVS = [1, 2, 3, 4, 5, 10, 20, 30, 50, 100, 200, 500];
const PT_TYPES = { market: 'Market', limit: 'Limit', stop: 'Stop', stoplimit: 'Stop limit' };
const PT_WHY = { tp: 'Take profit', sl: 'Stop loss', trail: 'Trailing stop', close: 'Closed by you', stopout: 'Margin call', reverse: 'Reversed', order: 'Order', replay: 'Replay ended' };
const PT_FIX = { HKD: 0.1286, SGD: 0.775, BRL: 0.18 };   // rough rates for the few currencies with no live pair here
const PT_SIZES = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 1000000];
const PT_MAX_ACCTS = 8;
const ptNum = v => { if (v == null || v === '') return null; const n = Number(String(v).replace(/[,\s$]/g, '').replace('−', '-')); return isFinite(n) ? n : null; };
const ptUiDefaults = () => ({ qt: true, one: false, lines: true, exec: true, sound: true });
const ptSetDefaults = () => ({ lev: Object.assign({}, PT_LEV_DEF), comm: 0, journal: null });   // journal: null until the person chooses
function ptNewAcct(name, start, kind, journal) {
  const a = { id: uid(), name, kind: kind === 'replay' ? 'replay' : 'live', start, bal: start, pos: [], ord: [], hist: [], log: [], set: ptSetDefaults(), at: Date.now() };
  a.set.journal = journal === true || journal === false ? journal : null;
  return a;
}

function ptCleanAcct(d, fallback) {   // one account, checked before it's used
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : null);
  const pos = v => num(v, 1e-12, 1e12);
  const sym = v => (typeof v === 'string' && v.length <= 40 && /^(BINANCE|US|FX):[A-Z0-9./_-]+$/.test(v) ? v : null);
  const id = v => (typeof v === 'string' && /^[a-z0-9]{1,16}$/.test(v) ? v : uid());
  const ms = v => num(v, 1e11, 9e12);
  const txt = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, n) : '');
  const f = fallback || {};
  const start = num(d.start, 100, 1e9) || f.start || 100000;
  const o = ptNewAcct(txt(d.name, 30).trim() || f.name || 'Paper account', start, d.kind || f.kind, null);
  o.id = typeof d.id === 'string' && /^[a-z0-9]{1,16}$/.test(d.id) ? d.id : f.id || o.id;
  o.at = ms(d.at) || o.at;
  o.bal = num(d.bal, -1e13, 1e13); if (o.bal == null) o.bal = start;
  const seen = new Set();
  if (Array.isArray(d.pos)) o.pos = d.pos.filter(isObj).map(p => ({ id: id(p.id), sym: sym(p.sym), qty: num(p.qty, -1e12, 1e12), avg: pos(p.avg), at: ms(p.at) || Date.now(), tp: pos(p.tp), sl: pos(p.sl), trail: pos(p.trail), fees: num(p.fees, 0, 1e12) || 0 }))
    .filter(p => p.sym && p.qty && p.avg && !seen.has(p.sym) && seen.add(p.sym)).slice(0, 200);
  if (Array.isArray(d.ord)) o.ord = d.ord.filter(isObj).map(x => ({
    id: id(x.id), sym: sym(x.sym), side: x.side === 'buy' || x.side === 'sell' ? x.side : null, type: PT_TYPES[x.type] ? x.type : null,
    qty: pos(x.qty), lim: pos(x.lim), stp: pos(x.stp), tp: pos(x.tp), sl: pos(x.sl), trail: pos(x.trail), tif: x.tif === 'day' ? 'day' : 'gtc', exp: ms(x.exp),
    st: ['working', 'filled', 'cancelled', 'rejected'].includes(x.st) ? x.st : null, at: ms(x.at) || Date.now(), upd: ms(x.upd) || ms(x.at) || Date.now(),
    fill: pos(x.fill), fillAt: ms(x.fillAt), why: txt(x.why, 120), trig: x.trig === true, tag: PT_WHY[x.tag] ? x.tag : null,
  })).filter(x => x.sym && x.side && x.type && x.qty && x.st && (!['limit', 'stoplimit'].includes(x.type) || x.lim) && (!['stop', 'stoplimit'].includes(x.type) || x.stp)).slice(-600);
  if (Array.isArray(d.hist)) o.hist = d.hist.filter(isObj).map(h => ({ id: id(h.id), sym: sym(h.sym), side: h.side === 'long' || h.side === 'short' ? h.side : null, qty: pos(h.qty), entry: pos(h.entry), exit: pos(h.exit),
    at: ms(h.at), end: ms(h.end), pnl: num(h.pnl, -1e13, 1e13), fees: num(h.fees, 0, 1e12) || 0, why: PT_WHY[h.why] ? h.why : 'order' })).filter(h => h.sym && h.side && h.qty && h.entry && h.exit && h.at && h.end && h.pnl != null).slice(-300);
  if (Array.isArray(d.log)) o.log = d.log.filter(isObj).map(l => ({ t: ms(l.t), m: txt(l.m, 200), k: ['fill', 'info', 'warn', 'reject', 'cancel'].includes(l.k) ? l.k : 'info' })).filter(l => l.t && l.m).slice(-150);
  if (isObj(d.set)) {
    const s = d.set;
    if (isObj(s.lev)) PT_MKTS.forEach(([k]) => { if (PT_LEVS.includes(s.lev[k])) o.set.lev[k] = s.lev[k]; });
    const c = num(s.comm, 0, 5); if (c != null) o.set.comm = c;
    if (typeof s.journal === 'boolean' && f.keepJournal !== false) o.set.journal = s.journal;
  }
  return o;
}
function ptClean(d) {   // the whole paper trading store, from anywhere (this browser, the account, another tab)
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const out = { v: 2, cur: '', rcur: '', accts: [], ui: ptUiDefaults() };
  if (isObj(d) && Array.isArray(d.accts)) {
    const ids = new Set();
    out.accts = d.accts.filter(isObj).slice(0, PT_MAX_ACCTS).map(a => ptCleanAcct(a)).filter(a => !ids.has(a.id) && ids.add(a.id));
    if (typeof d.cur === 'string') out.cur = d.cur;
    if (typeof d.rcur === 'string') out.rcur = d.rcur;
    if (isObj(d.ui)) Object.keys(out.ui).forEach(k => { if (typeof d.ui[k] === 'boolean') out.ui[k] = d.ui[k]; });
  } else if (isObj(d) && (Array.isArray(d.pos) || typeof d.bal === 'number')) {   // the first version kept one account; it becomes "Main account"
    out.accts = [ptCleanAcct(d, { id: 'main', name: 'Main account', kind: 'live', keepJournal: false })];
    if (isObj(d.set)) Object.keys(out.ui).forEach(k => { if (typeof d.set[k] === 'boolean') out.ui[k] = d.set[k]; });
  }
  if (!out.accts.some(a => a.kind === 'live')) { const m = ptNewAcct('Main account', 100000, 'live', null); m.id = 'main'; out.accts.unshift(m); out.accts = out.accts.slice(0, PT_MAX_ACCTS); }
  if (!out.accts.some(a => a.id === out.cur && a.kind === 'live')) out.cur = out.accts.find(a => a.kind === 'live').id;
  if (!out.accts.some(a => a.id === out.rcur && a.kind === 'replay')) out.rcur = (out.accts.find(a => a.kind === 'replay') || { id: '' }).id;
  return out;
}

const PT = { s: ptClean(store.get('paper', null)), leader: false, catching: new Set(), relevant: new Set(), hits: [], drag: null, uiT: 0, tab: store.get('ptTab', 'pos'), ordView: 'working', histView: 'trades',
  open: !!store.get('ptOpen', false), trailMoved: 0, sig: '', t: null, rlast: {}, confirm: null, jAsk: null };
if (!['pos', 'ord', 'hist', 'acct'].includes(PT.tab)) PT.tab = 'pos';
const ptLiveAccts = () => PT.s.accts.filter(a => a.kind === 'live');
const ptLiveAcct = () => PT.s.accts.find(a => a.id === PT.s.cur && a.kind === 'live') || ptLiveAccts()[0];
function ptReplayAcct(create) {
  let a = PT.s.accts.find(x => x.id === PT.s.rcur && x.kind === 'replay') || PT.s.accts.find(x => x.kind === 'replay');
  if (!a && create) {
    if (PT.s.accts.length >= PT_MAX_ACCTS) return null;
    a = ptNewAcct('Replay account', 100000, 'replay', null); PT.s.accts.push(a); PT.s.rcur = a.id;
  }
  return a || null;
}
const ptA = () => (R.on ? ptReplayAcct(true) || ptLiveAcct() : ptLiveAcct());   // the account on screen
const ptAcctById = id => PT.s.accts.find(a => a.id === id) || null;

// ----- prices, money and sizes -----
function ptQuoteLive(id) {
  const t = S.tickers[id]; let last = t && t.last > 0 ? t.last : null;
  if (last == null && id === S.symbol && !R.on && S.bars.length) last = S.bars[S.bars.length - 1].close;
  if (!(last > 0)) return null;
  const spread = t && t.bid > 0 && t.ask > 0 && t.bid <= t.ask && Math.abs(t.ask - t.bid) / last < 0.05;
  return { last, bid: spread ? t.bid : last, ask: spread ? t.ask : last };
}
function ptQuoteFor(a, id) {   // a replay account sees the replayed bar, not today's price
  if (a.kind !== 'replay') return ptQuoteLive(id);
  if (R.on && !R.picking && id === S.symbol && S.bars.length) { const c = S.bars[S.bars.length - 1].close; return { last: c, bid: c, ask: c }; }
  const r = PT.rlast[id]; return r > 0 ? { last: r, bid: r, ask: r } : null;
}
const ptQ = id => ptQuoteFor(ptA(), id);
const ptLive = id => S.ready && srcOf(id) !== 'demo' && !!S.tickers[id] && !S.tickers[id].stand && S.tickers[id].src !== 'demo';
const ptTradable = (a, id) => (a.kind === 'replay' ? R.on && !R.picking && id === S.symbol && S.bars.length > 0 : ptLive(id));
const ptCanFill = (a, id) => (a.kind === 'replay' ? ptTradable(a, id) : ptLive(id) && openNow(id));
const ptNow = a => (a.kind === 'replay' && R.on && S.bars.length ? (S.bars[S.bars.length - 1].time + tfOf(S.tf).sec) * 1000 - 1000 : Date.now());   // replay time: the end of the last bar shown
function ptConvSym(ccy) {
  if (!ccy || ccy === 'USD') return null;
  if (['BTC', 'ETH', 'BNB'].includes(ccy)) return { id: 'BINANCE:' + ccy + 'USDT', inv: false };
  if (FX.some(f => f[0] === ccy + '/USD')) return { id: 'FX:' + ccy + '/USD', inv: false };
  if (FX.some(f => f[0] === 'USD/' + ccy)) return { id: 'FX:USD/' + ccy, inv: true };
  return null;
}
function ptConv(sym) {   // US dollars per 1 unit of the symbol's quote currency
  const c = quoteCcy(sym); if (c === 'USD') return 1;
  const cs = ptConvSym(c);
  if (cs) { const q = ptQuoteLive(cs.id), px = q ? q.last : DEMO[cs.id] && DEMO[cs.id][0]; if (px > 0) return cs.inv ? 1 / px : px; }
  return PT_FIX[c] || 1;
}
const ptLev = (a, sym) => a.set.lev[catOf(sym)] || 1;
function ptStep(id) {
  const c = catOf(id);
  if (c === 'forex' || c === 'stock' || c === 'fund') return 1;
  if (c === 'crypto') { const q = ptQ(id), p = q ? q.last : (DEMO[id] && DEMO[id][0]) || 1; return p >= 10000 ? 1e-5 : p >= 100 ? 1e-4 : p >= 1 ? 1e-2 : 1; }
  return 0.1;
}
const ptDec = step => (step >= 1 ? 0 : Math.round(-Math.log10(step)));
const ptRoundQty = (id, q) => { const s = ptStep(id), d = ptDec(s); return Number((Math.floor(q / s + 1e-7) * s).toFixed(d)); };
const ptFix = (id, q) => Number(q.toFixed(Math.max(ptDec(ptStep(id)), 8)));
function ptFmtQty(id, q) { const d = ptDec(ptStep(id)); return new Intl.NumberFormat('en-US', { maximumFractionDigits: Math.min(8, d + 2) }).format(Math.abs(q)); }
const USDF = {};
function usd(v, signed, compact) {
  if (v == null || !isFinite(v)) return '—';
  const k = (signed ? 's' : '') + (compact ? 'c' : '');
  if (!USDF[k]) USDF[k] = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', signDisplay: signed ? 'exceptZero' : 'auto', notation: compact ? 'compact' : 'standard', maximumFractionDigits: compact ? 1 : 2, minimumFractionDigits: compact ? 0 : 2 });
  return USDF[k].format(v).replace('-', '−');
}
const ptPx = (id, p) => (p == null ? '—' : fmtP(p, precFor(id, p)));
const ptPip = id => (classOf(id) === 'forex' && !CFD[id] ? (/JPY$/.test(rawOf(id)) || /^X(AU|AG)\//.test(rawOf(id)) ? 0.01 : 0.0001) : Math.pow(10, -precFor(id, (ptQ(id) || { last: 1 }).last)));
const ptPipName = id => (classOf(id) === 'forex' && !CFD[id] ? 'pips' : 'ticks');
function ptDefQty(id) {
  const saved = store.get('ptQty', {}); if (saved && saved[id] > 0) return saved[id];
  const c = catOf(id), q = ptQ(id), p = q ? q.last : (DEMO[id] && DEMO[id][0]) || 1;
  if (c === 'forex' && !/^X(AU|AG)\//.test(rawOf(id))) return 10000;
  return Math.max(ptStep(id), ptRoundQty(id, 1000 / (p * ptConv(id))));   // about $1,000 worth
}
function ptRememberQty(id, q) { const s = store.get('ptQty', {}) || {}; s[id] = q; const keys = Object.keys(s); if (keys.length > 80) delete s[keys[0]]; store.raw('ptQty', s); }
const ptSideWord = s => (s === 'buy' ? 'Buy' : 'Sell');
function ptDesc(o) {
  const q = ptFmtQty(o.sym, o.qty), base = `${ptSideWord(o.side)} ${q} ${label(o.sym)}`;
  if (o.type === 'market') return `${base} at market`;
  if (o.type === 'limit') return `${base} limit at ${ptPx(o.sym, o.lim)}`;
  if (o.type === 'stop') return `${base} stop at ${ptPx(o.sym, o.stp)}`;
  return `${base} stop ${ptPx(o.sym, o.stp)}, limit ${ptPx(o.sym, o.lim)}`;
}
function ptMetrics(a) {
  let upl = 0, margin = 0;
  const rows = a.pos.map(p => {
    const q = ptQuoteFor(a, p.sym), conv = ptConv(p.sym), mark = q ? (p.qty > 0 ? q.bid : q.ask) : p.avg;
    const pl = (mark - p.avg) * p.qty * conv, value = Math.abs(p.qty) * mark * conv, m = value / ptLev(a, p.sym);
    upl += pl; margin += m;
    return { p, q, mark, pl, pct: ((mark - p.avg) / p.avg) * 100 * Math.sign(p.qty), value, margin: m };
  });
  const equity = a.bal + upl;
  return { rows, upl, margin, equity, avail: equity - margin, realized: a.bal - a.start };
}
function ptLog(a, m, k) { a.log.push({ t: Date.now(), m, k: k || 'info' }); }
function ptNotice(a, msg, kind) {
  toast(msg, kind === 'warn' ? 'alert' : null);
  if (PT.s.ui.sound) beep();
  if (a.kind === 'live') notify('Paper trading', msg);
}

// ----- the engine: orders, fills, positions (for one account) -----
function ptExec(a, o, px, when, tag) {   // fill an order at a price. Returns false if it was rejected.
  const sym = o.sym, conv = ptConv(sym), lev = ptLev(a, sym);
  const dq = o.side === 'buy' ? o.qty : -o.qty;
  const p = a.pos.find(x => x.sym === sym), old = p ? p.qty : 0, nw = ptFix(sym, old + dq);
  const added = !old || Math.sign(old) === Math.sign(dq) ? Math.abs(dq) : Math.sign(nw) !== Math.sign(old) ? Math.abs(nw) : 0;
  const comm = Math.abs(dq) * px * conv * (a.set.comm / 100);
  if (added > 0) {   // there must be enough margin for what this adds
    const m = ptMetrics(a), cur = p ? Math.abs(old) * px * conv / lev : 0, after = m.margin - cur + Math.abs(nw) * px * conv / lev;
    if (after > m.equity - comm + 1e-9) {
      o.st = 'rejected'; o.upd = when; o.why = `Not enough margin: needs ${usd(Math.abs(nw) * px * conv / lev)}, ${usd(Math.max(0, m.equity - m.margin + cur))} available`;
      ptLog(a, `Rejected: ${ptDesc(o)}. ${o.why}.`, 'reject'); ptNotice(a, `Order rejected: not enough margin for ${ptFmtQty(sym, o.qty)} ${label(sym)} (${a.name}).`, 'warn');
      return false;
    }
  }
  let closedTrade = null;
  if (old && Math.sign(old) !== Math.sign(dq)) {   // the part that closes the position books its profit or loss
    const closed = Math.min(Math.abs(old), Math.abs(dq));
    const gross = (px - p.avg) * closed * Math.sign(old) * conv;
    const feeOpen = p.fees * (closed / Math.abs(old)), feeClose = comm * (closed / Math.abs(dq));
    a.bal += gross - feeClose; p.fees = Math.max(0, p.fees - feeOpen);
    closedTrade = { id: uid(), sym, side: old > 0 ? 'long' : 'short', qty: ptFix(sym, closed), entry: p.avg, exit: px, at: p.at, end: when, pnl: gross - feeOpen - feeClose, fees: feeOpen + feeClose, why: tag || 'order' };
    a.hist.push(closedTrade); ptJournal(a, closedTrade, p);
  }
  if (!nw) a.pos = a.pos.filter(x => x !== p);
  else if (!old || Math.sign(nw) !== Math.sign(old)) {   // a new position, or the order flipped it to the other side
    const fee = comm * (Math.abs(nw) / Math.abs(dq)); a.bal -= fee;
    const np = { id: uid(), sym, qty: nw, avg: px, at: when, tp: o.tp || null, sl: o.sl || null, trail: o.trail || null, fees: fee };
    if (p) a.pos = a.pos.map(x => (x === p ? np : x)); else a.pos.push(np);
  } else if (Math.abs(nw) > Math.abs(old)) {   // adding to it
    p.avg = (p.avg * Math.abs(old) + px * Math.abs(dq)) / Math.abs(nw); p.qty = nw; p.fees += comm; a.bal -= comm;
    if (o.tp) p.tp = o.tp; if (o.sl) p.sl = o.sl; if (o.trail) p.trail = o.trail;
  } else p.qty = nw;   // a partial close
  o.st = 'filled'; o.fill = px; o.fillAt = when; o.upd = when; if (tag) o.tag = tag;
  const q = ptFmtQty(sym, o.qty), at = ptPx(sym, px), where = PT.s.accts.length > 1 ? ` (${a.name})` : '';
  ptLog(a, `Filled: ${ptSideWord(o.side)} ${q} ${label(sym)} at ${at}${closedTrade ? ` · ${usd(closedTrade.pnl, true)}` : ''}${tag && tag !== 'order' ? ` (${PT_WHY[tag]})` : ''}`, 'fill');
  if (tag === 'tp' || tag === 'sl' || tag === 'trail') ptNotice(a, `${PT_WHY[tag]} hit: ${label(sym)} closed at ${at}, ${usd(closedTrade.pnl, true)}${where}`);
  else if (tag === 'stopout') ptNotice(a, `Margin call: your ${label(sym)} position was closed at ${at}, ${usd(closedTrade.pnl, true)}${where}`, 'warn');
  else if (tag !== 'replay') ptNotice(a, `Filled: ${ptSideWord(o.side)} ${q} ${label(sym)} at ${at}${closedTrade ? `, ${usd(closedTrade.pnl, true)}` : ''}${where}`);
  return true;
}
function ptNewOrder(spec, now) {
  return { id: uid(), sym: spec.sym, side: spec.side, type: spec.type, qty: spec.qty, lim: spec.lim || null, stp: spec.stp || null, tp: spec.tp || null, sl: spec.sl || null, trail: spec.trail || null,
    tif: spec.tif === 'day' && spec.type !== 'market' ? 'day' : 'gtc', exp: spec.tif === 'day' && spec.type !== 'market' ? ptDayEnd(spec.sym, now) : null,
    st: 'working', at: now, upd: now, fill: null, fillAt: null, why: '', trig: false, tag: spec.tag || null };
}
// Check an account's working orders and its position's stops for one symbol at a price. `path` means the price moved
// there smoothly from the last check (price history or replay), so orders fill exactly at their price, not the market's.
function ptEval(a, sym, q, when, path) {
  let changed = false;
  for (const o of a.ord.slice()) {
    if (o.sym !== sym || o.st !== 'working' || o.at > when) continue;
    const buy = o.side === 'buy', mk = buy ? q.ask : q.bid;
    const limitFill = lim => (buy ? mk <= lim : mk >= lim) ? (path ? lim : buy ? Math.min(lim, mk) : Math.max(lim, mk)) : null;
    let px = null;
    if (o.type === 'market') px = mk;
    else if (o.type === 'limit' || (o.type === 'stoplimit' && o.trig)) px = limitFill(o.lim);
    else if (o.type === 'stop') { if (buy ? mk >= o.stp : mk <= o.stp) px = path ? o.stp : mk; }
    else if (o.type === 'stoplimit' && (buy ? mk >= o.stp : mk <= o.stp)) {
      o.trig = true; o.upd = when; changed = true; ptLog(a, `Triggered: ${ptDesc(o)}. It's now a limit order.`, 'info');
      px = limitFill(o.lim);
    }
    if (px != null) { ptExec(a, o, px, when, o.tag); changed = true; }
  }
  const p = a.pos.find(x => x.sym === sym);
  if (p && p.at <= when) {
    const long = p.qty > 0, mk = long ? q.bid : q.ask;
    if (p.trail) { const ns = long ? mk - p.trail : mk + p.trail; if (p.sl == null || (long ? ns > p.sl : ns < p.sl)) { p.sl = ns; PT.trailMoved = PT.trailMoved || Date.now(); } }
    let hit = null, px = null;
    if (p.sl != null && (long ? mk <= p.sl : mk >= p.sl)) { hit = p.trail ? 'trail' : 'sl'; px = path ? p.sl : mk; }
    else if (p.tp != null && (long ? mk >= p.tp : mk <= p.tp)) { hit = 'tp'; px = path ? p.tp : long ? Math.max(p.tp, mk) : Math.min(p.tp, mk); }
    if (hit) { ptClosePos(a, p, px, when, hit); changed = true; }
  }
  return changed;
}
function ptClosePos(a, p, px, when, tag, qty) {
  const o = ptNewOrder({ sym: p.sym, side: p.qty > 0 ? 'sell' : 'buy', type: 'market', qty: qty || Math.abs(p.qty), tag }, when);
  a.ord.push(o); ptExec(a, o, px, when, tag); return o;
}
function ptMarginCheck(a, when) {   // below half the margin in use, the biggest losers are closed (a margin call)
  let any = false;
  for (let guard = 0; guard < 50; guard++) {
    const m = ptMetrics(a); if (!(m.margin > 0) || m.equity >= m.margin * 0.5) return any;
    const r = m.rows.filter(x => x.q && ptCanFill(a, x.p.sym)).sort((x, y) => x.pl - y.pl)[0]; if (!r) return any;
    ptLog(a, `Margin call: equity ${usd(m.equity)} fell below half the margin in use (${usd(m.margin)}).`, 'warn');
    ptClosePos(a, r.p, r.p.qty > 0 ? r.q.bid : r.q.ask, when, 'stopout'); any = true;
  }
  return any;
}
function ptDayEnd(id, now) {   // when a Day order expires: the end of that day's session
  const cls = classOf(id);
  if (cls === 'crypto') { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); }
  const p = ny(now / 1000);
  if (cls === 'stock') {
    let y = p.y, m = p.m, d = p.d, guard = 0;
    const close = () => nyTime(y, m, d, 16, 0) * 1000;
    while ((isWeekendYMD(y, m, d) || close() <= now) && guard++ < 10) { const x = new Date(Date.UTC(y, m - 1, d + 1)); y = x.getUTCFullYear(); m = x.getUTCMonth() + 1; d = x.getUTCDate(); }
    return close();
  }
  let t = nyTime(p.y, p.m, p.d, 17, 0) * 1000; if (t <= now) t += 864e5; return t;
}
function ptExpire(a, now) {
  let n = 0;
  for (const o of a.ord) if (o.st === 'working' && o.exp && o.exp <= now) { o.st = 'cancelled'; o.upd = now; o.why = 'Expired at the end of the day'; n++; ptLog(a, `Expired: ${ptDesc(o)} (Day order).`, 'cancel'); }
  return n;
}
function ptJournal(a, h, p) {
  if (a.set.journal !== true) return;
  if (a.kind === 'live' && !PT.leader) return;   // only the tab that runs the live accounts writes them to the journal
  const t = jClean({ symbol: h.sym, side: h.side, opened_at: new Date(h.at).toISOString(), closed_at: new Date(h.end).toISOString(), entry: h.entry, exit: h.exit, qty: h.qty, fees: Math.round(h.fees * 100) / 100,
    stop: p.sl || null, target: p.tp || null, pnl: Math.round(h.pnl * 100) / 100, strategy: ptJournalName(a), tags: a.kind === 'replay' ? ['Paper', 'Replay'] : ['Paper'],
    notes: `${a.kind === 'replay' ? 'Bar replay' : 'Paper'} trade in ${a.name}. ${PT_WHY[h.why] || 'Closed'}.` });
  if (!t) return;
  const go = tries => { if (!JR.loaded) { if (tries < 20) setTimeout(() => go(tries + 1), 1500); return; } jInsert([t]).then(() => Journal.changed()).catch(() => {}); };
  go(0);
}
const ptJournalName = a => ('Paper · ' + a.name).slice(0, 60);
function ptKeep() { const n = Math.max(1, PT.s.accts.length); return { done: Math.min(150, Math.floor(400 / n)), hist: Math.min(300, Math.floor(600 / n)), log: Math.min(150, Math.floor(300 / n)) }; }   // the account record has a size limit
function ptTrim(a, k) {
  const working = a.ord.filter(o => o.st === 'working'), done = a.ord.filter(o => o.st !== 'working').sort((x, y) => x.upd - y.upd).slice(-k.done);
  a.ord = working.concat(done).sort((x, y) => x.at - y.at);
  a.hist = a.hist.slice(-k.hist); a.log = a.log.slice(-k.log);
}
function ptStats(a) {
  const h = a.hist; let w = 0, gw = 0, gl = 0;
  h.forEach(x => { if (x.pnl > 0) { w++; gw += x.pnl; } else if (x.pnl < 0) gl += x.pnl; });
  return { n: h.length, win: h.length ? w / h.length : null, pf: gl < 0 ? gw / -gl : gw > 0 ? Infinity : null, net: h.reduce((s, x) => s + x.pnl, 0) };
}

// ----- placing, changing and cancelling -----
function ptCheckOrder(a, spec) {   // returns a reason the order can't be placed, or ''
  const id = spec.sym;
  if (a.kind === 'live' && R.on) return 'Bar replay is on, so orders go to a replay account. Leave replay to trade on live prices.';
  if (a.kind === 'replay') {
    if (!R.on) return 'Start a bar replay to trade in a replay account.';
    if (R.picking) return 'Pick the bar to replay from first.';
    if (id !== S.symbol) return `In bar replay you can only trade the symbol being replayed (${label(S.symbol)}).`;
  } else if (!ptLive(id)) return srcOf(id) === 'demo' ? `${label(id)} isn't live on RealChart right now, so it can't be traded.` : `Waiting for a live price for ${label(id)}…`;
  const q = ptQuoteFor(a, id);
  if (!q) return `Waiting for a price for ${label(id)}…`;
  if (!(spec.qty > 0)) return 'Enter a quantity.';
  if (spec.qty < ptStep(id) - 1e-12) return `The smallest quantity for ${label(id)} is ${ptFmtQty(id, ptStep(id))}.`;
  const buy = spec.side === 'buy', mk = buy ? q.ask : q.bid;
  if (['limit', 'stoplimit'].includes(spec.type) && !(spec.lim > 0)) return 'Enter a limit price.';
  if (['stop', 'stoplimit'].includes(spec.type) && !(spec.stp > 0)) return 'Enter a stop price.';
  if (spec.type === 'stop' || spec.type === 'stoplimit') { if (buy ? spec.stp <= mk : spec.stp >= mk) return `A ${buy ? 'buy' : 'sell'} stop must be ${buy ? 'above' : 'below'} the current price (${ptPx(id, mk)}).`; }
  const ref = spec.type === 'market' ? mk : spec.type === 'stop' ? spec.stp : spec.lim;
  if (spec.tp != null && (buy ? spec.tp <= ref : spec.tp >= ref)) return `Take profit must be ${buy ? 'above' : 'below'} the entry price (${ptPx(id, ref)}).`;
  if (spec.sl != null && (buy ? spec.sl >= ref : spec.sl <= ref)) return `Stop loss must be ${buy ? 'below' : 'above'} the entry price (${ptPx(id, ref)}).`;
  return '';
}
// Places an order. The first order in an account asks whether its trades go into the Journal; `done` runs once it's placed.
function ptPlace(a, spec, done) {
  const err = ptCheckOrder(a, spec); if (err) { toast(err); return null; }
  if (a.set.journal == null) { ptAskJournal(a, () => { const o = ptPlace(a, spec); if (o && done) done(o); }); return null; }
  const now = ptNow(a), o = ptNewOrder(spec, now);
  a.ord.push(o); ptLog(a, `Placed: ${ptDesc(o)}${o.tif === 'day' ? ' (Day)' : ''}.`, 'info'); ptRememberQty(o.sym, o.qty);
  if ((a.kind === 'replay' || PT.leader) && ptCanFill(a, o.sym)) { const q = ptQuoteFor(a, o.sym); if (q) ptEval(a, o.sym, q, now, false); }
  if (o.st === 'working') toast(o.type === 'market' ? (openNow(o.sym) || a.kind === 'replay' ? `Order sent: ${ptDesc(o)}` : `${label(o.sym)}'s market is closed. Your order fills when it opens.`) : `Order placed: ${ptDesc(o)}`);
  Paper.changed(); if (done) done(o); return o;
}
function ptCancel(a, o, why) {
  if (!o || o.st !== 'working') return;
  o.st = 'cancelled'; o.upd = ptNow(a); o.why = why || 'Cancelled by you'; ptLog(a, `Cancelled: ${ptDesc(o)}.`, 'cancel');
}
function ptCloseNow(a, p, qty, tag) {   // close all or part of a position at the market
  if (!ptTradable(a, p.sym)) { toast(a.kind === 'replay' ? `Show ${label(p.sym)} in the replay to close this position.` : `${label(p.sym)} isn't live right now, so the position can't be closed.`); return; }
  if (a.ord.some(o => o.st === 'working' && o.sym === p.sym && o.type === 'market' && (o.tag === 'close' || o.tag === 'reverse'))) { toast(`A closing order for ${label(p.sym)} is already waiting for the market to open.`); return; }
  const now = ptNow(a);
  const o = ptNewOrder({ sym: p.sym, side: p.qty > 0 ? 'sell' : 'buy', type: 'market', qty: qty || Math.abs(p.qty), tag: tag || 'close' }, now);
  a.ord.push(o);
  if (ptCanFill(a, p.sym)) { const q = ptQuoteFor(a, p.sym); ptExec(a, o, p.qty > 0 ? q.bid : q.ask, now, o.tag); }
  else toast(`${label(p.sym)}'s market is closed. The position closes when it opens.`);
  Paper.changed();
}
function ptReverse(a, p) {
  if (!ptCanFill(a, p.sym)) { toast(`${label(p.sym)} can't be traded right now${ptLive(p.sym) ? ': its market is closed' : ''}.`); return; }
  const now = ptNow(a), q = ptQuoteFor(a, p.sym), side = p.qty > 0 ? 'sell' : 'buy', qty = ptFix(p.sym, Math.abs(p.qty) * 2);
  const o = ptNewOrder({ sym: p.sym, side, type: 'market', qty, tag: 'reverse' }, now);
  a.ord.push(o); ptExec(a, o, side === 'buy' ? q.ask : q.bid, now, 'reverse'); Paper.changed();
}
function ptMark(a, p) { const q = ptQuoteFor(a, p.sym); return q ? (p.qty > 0 ? q.bid : q.ask) : p.avg; }
function ptBracketErr(a, p, kind, v) {   // a position's take profit and stop loss must sit on the right side of the price
  if (v == null) return '';
  const long = p.qty > 0, mk = ptMark(a, p);
  if (kind === 'tp' && (long ? v <= mk : v >= mk)) return `Take profit must be ${long ? 'above' : 'below'} the current price (${ptPx(p.sym, mk)}).`;
  if (kind === 'sl' && (long ? v >= mk : v <= mk)) return `Stop loss must be ${long ? 'below' : 'above'} the current price (${ptPx(p.sym, mk)}).`;
  return '';
}
// trailOn: the stop follows the price at its current distance from it
function ptSetBrackets(a, p, tp, sl, trailOn) {
  const err = ptBracketErr(a, p, 'tp', tp) || ptBracketErr(a, p, 'sl', sl); if (err) return err;
  p.tp = tp || null; p.sl = sl || null; p.trail = trailOn && sl ? Math.abs(ptMark(a, p) - sl) : null;
  ptLog(a, `${label(p.sym)} position: take profit ${p.tp ? ptPx(p.sym, p.tp) : 'none'}, stop loss ${p.sl ? ptPx(p.sym, p.sl) + (p.trail ? ' (trailing)' : '') : 'none'}.`, 'info');
  return '';
}

// ----- accounts: switch, create, rename, delete, and the Journal question -----
function ptSwitch(id) {
  const a = ptAcctById(id); if (!a) return;
  if (a.kind === 'live') PT.s.cur = a.id; else PT.s.rcur = a.id;
  if ($('#ordDlg').open) $('#ordDlg').close();
  Paper.changed(); toast(`Now trading in ${a.name}${a.kind === 'replay' && !R.on ? ' (used during bar replay)' : ''}.`);
}
function ptAskJournal(a, then) {
  PT.jAsk = { aid: a.id, then };
  $('#pjTitle').textContent = 'Add paper trades to your Journal?';
  $('#pjText').textContent = `When a trade in “${a.name}” closes, it can be added to your trade journal automatically, tagged “Paper”${a.kind === 'replay' ? ' and “Replay”' : ''}, so the Journal's statistics include it. Or keep this account's trades separate.`;
  $('#ptJDlg').showModal();
}
function ptAnswerJournal(yes) {
  const q = PT.jAsk; PT.jAsk = null; $('#ptJDlg').close();
  const a = q && ptAcctById(q.aid); if (!a) return;
  a.set.journal = yes; ptLog(a, yes ? 'Closed trades will be added to the Journal.' : 'Closed trades are kept out of the Journal.', 'info');
  Paper.save(); toast(yes ? `${a.name}: closed trades will go into your Journal.` : `${a.name}: trades stay out of your Journal. You can change this in the Account tab.`);
  if (q.then) q.then();
}
function ptNewAcctDlg(kind) {
  if (PT.s.accts.length >= PT_MAX_ACCTS) { toast(`You can have up to ${PT_MAX_ACCTS} paper accounts. Delete one to make another.`); return; }
  const dlg = $('#ptNewDlg'); dlg.dataset.kind = kind || (R.on ? 'replay' : 'live');
  const n = PT.s.accts.length + 1;
  $('#pnName').value = `Account ${n}`; $('#pnBal').value = '10000'; $('#pnErr').hidden = true;
  dlg.querySelectorAll('input[name="pnj"]').forEach(r => { r.checked = false; });
  ptNewRender(); dlg.showModal(); setTimeout(() => $('#pnName').select(), 30);
}
function ptNewRender() {
  const dlg = $('#ptNewDlg'), kind = dlg.dataset.kind, bal = ptNum($('#pnBal').value);
  dlg.querySelectorAll('#pnKind .btn').forEach(b => { const on = b.dataset.kind === kind; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  dlg.querySelectorAll('#pnSizes button').forEach(b => b.classList.toggle('on', +b.dataset.v === bal));
  $('#pnKindNote').textContent = kind === 'replay' ? 'Trades in a bar replay: start a replay, then buy and sell as the bars play.' : 'Trades on live prices, like a real account.';
}
function ptNewSubmit() {
  const dlg = $('#ptNewDlg'), name = $('#pnName').value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 30), bal = ptNum($('#pnBal').value), j = dlg.querySelector('input[name="pnj"]:checked');
  const err = !name ? 'Give the account a name.' : !(bal >= 100 && bal <= 1e9) ? 'The starting balance must be between $100 and $1,000,000,000.' : !j ? 'Choose whether its trades go into your Journal.' : PT.s.accts.some(a => a.name.toLowerCase() === name.toLowerCase()) ? 'You already have an account with that name.' : '';
  if (err) { $('#pnErr').textContent = err; $('#pnErr').hidden = false; return; }
  const kind = dlg.dataset.kind, a = ptNewAcct(name, Math.round(bal * 100) / 100, kind, j.value === 'yes'), cur = ptA();
  a.set.lev = Object.assign({}, cur.set.lev); a.set.comm = cur.set.comm;   // the same trading settings as the account in use
  PT.s.accts.push(a); if (kind === 'live') PT.s.cur = a.id; else PT.s.rcur = a.id;
  ptLog(a, `Account opened with ${usd(a.start)}.`, 'info');
  dlg.close(); if ($('#ordDlg').open) $('#ordDlg').close();
  Paper.changed(); toast(`${a.name} is ready with ${usd(a.start)}${kind === 'replay' && !R.on ? '. Start a bar replay to trade in it.' : '.'}`);
}
function ptDeleteAcct(a) {
  const same = PT.s.accts.filter(x => x.kind === a.kind && x !== a);
  if (!same.length) { toast(`Keep at least one ${a.kind === 'replay' ? 'replay' : 'live-price'} account. Reset it instead.`); return; }
  ptConfirm(`Delete ${a.name}?`, `This deletes the account with its positions, orders and history. Trades already added to your Journal stay there.`, 'Delete account', () => {
    PT.s.accts = PT.s.accts.filter(x => x !== a);
    if (PT.s.cur === a.id) PT.s.cur = ptLiveAccts()[0].id;
    if (PT.s.rcur === a.id) PT.s.rcur = (PT.s.accts.find(x => x.kind === 'replay') || { id: '' }).id;
    Paper.changed(); toast(`${a.name} deleted.`);
  });
}

// ----- the paper trading object the rest of the page talks to -----
const Paper = {
  boot() {
    window.addEventListener('storage', e => {   // another tab changed the accounts
      if (e.key !== NS + 'paper') return;
      PT.s = ptClean(store.get('paper', null));
      if (this.relevantSet()) ensureTickerSubs();
      let changed = false;
      if (PT.leader) for (const a of ptLiveAccts()) for (const s of new Set(a.ord.filter(o => o.st === 'working').map(o => o.sym).concat(a.pos.map(p => p.sym)))) {
        if (ptCanFill(a, s) && !PT.catching.has(s)) { const q = ptQuoteLive(s); if (q && ptEval(a, s, q, Date.now(), false)) changed = true; }
      }
      if (changed) this.changed(); else { this.refresh(); syncTradeMarks(); }
    });
    // Only one tab runs the live accounts (fills orders), so two open tabs never fill the same order twice.
    try {
      if (navigator.locks && navigator.locks.request) navigator.locks.request('realchart-paper', () => new Promise(() => { PT.leader = true; if (S.ready) this.catchUp(); }));
      else PT.leader = true;
    } catch (e) { PT.leader = true; }
    setInterval(() => this.tick(), 1000);
    ptUiInit(); if (PT.open) ptSetOpen(true);   // a panel left open stays open
    this.refresh();
  },
  ready() { this.relevantSet(); if (PT.leader) this.catchUp(); ptQtSync(); },
  relevantSet() {   // symbols the live accounts need prices for
    const s = new Set();
    for (const a of ptLiveAccts()) {
      a.pos.forEach(p => { s.add(p.sym); const cs = ptConvSym(quoteCcy(p.sym)); if (cs) s.add(cs.id); });
      a.ord.forEach(o => { if (o.st === 'working') s.add(o.sym); });
    }
    const before = [...PT.relevant].sort().join(); PT.relevant = s;
    return before !== [...s].sort().join();
  },
  symbols() { return [...PT.relevant]; },
  onPrice(sym) {
    if (sym === S.symbol && !R.on) ptQtSync();
    if (!PT.relevant.has(sym)) return;
    if (PT.leader && !PT.catching.has(sym) && ptLive(sym) && openNow(sym)) {
      const q = ptQuoteLive(sym); let changed = false;
      if (q) for (const a of ptLiveAccts()) if (a.ord.some(o => o.sym === sym && o.st === 'working') || a.pos.some(p => p.sym === sym)) { if (ptEval(a, sym, q, Date.now(), false)) changed = true; }
      if (changed) { this.changed(); return; }
    }
    if (sym === S.symbol && !R.on && ptLiveAcct().pos.some(p => p.sym === sym)) markDirty();
    this.ui();
  },
  tick() {
    const now = Date.now();
    if (PT.leader && S.ready) {
      let changed = false;
      for (const a of ptLiveAccts()) { if (ptExpire(a, now)) changed = true; if (ptMarginCheck(a, now)) changed = true; }
      if (changed) this.changed();
      else if (PT.trailMoved && now - PT.trailMoved > 8000) { PT.trailMoved = 0; this.save(); }
      if (!PT.catching.size && (!this.seenAt || now - this.seenAt > 10000)) { this.seenAt = now; store.raw('ptSeen', now); }
    }
    ptQtSync();
  },
  async catchUp() {   // orders and stops in the live accounts that would have filled while the page was closed
    if (this.caught) return; this.caught = true;
    const seen = +store.get('ptSeen', 0), now = Date.now();
    if (!(seen > 0) || now - seen < 60000) return;
    const syms = new Set();
    for (const a of ptLiveAccts()) {
      a.ord.forEach(o => { if (o.st === 'working' && o.type !== 'market' && o.at < now) syms.add(o.sym); });
      a.pos.forEach(p => { if (p.tp || p.sl || p.trail) syms.add(p.sym); });
    }
    const filled = () => ptLiveAccts().reduce((n, a) => n + a.ord.filter(o => o.st === 'filled').length, 0), done0 = filled();
    for (const sym of syms) {
      if (srcOf(sym) === 'demo') continue;
      PT.catching.add(sym);
      try {
        const gap = (now - seen) / 1000, tf = gap <= 15 * 3600 ? '1m' : gap <= 9 * DAY ? '15m' : '1h', step = tfOf(tf).sec;
        const bars = await feedFor(sym).klines(sym, tf);
        for (const b of bars) {
          const t0 = b.time * 1000;
          if (t0 < seen || t0 + step * 1000 > now) continue;   // only bars that started after the page was last open and have finished
          const pts = b.close >= b.open ? [b.open, b.low, b.high, b.close] : [b.open, b.high, b.low, b.close];
          for (const a of ptLiveAccts()) pts.forEach((px, i) => ptEval(a, sym, { bid: px, ask: px, last: px }, t0 + i * step * 250, i > 0));
        }
      } catch (e) { /* that market's history isn't available; its live prices take over */ }
      PT.catching.delete(sym);
    }
    const n = filled() - done0;
    if (n) { toast(`While you were away, ${n} paper order${n === 1 ? '' : 's'} filled. See the Orders tab.`); this.changed(); }
    store.raw('ptSeen', Date.now());
  },
  // ----- bar replay -----
  replayStart() { const a = ptReplayAcct(true); if (S.bars.length) PT.rlast[S.symbol] = S.bars[S.bars.length - 1].close; if (a) this.changed(); },
  replayBar(b) {   // a new bar appeared in the replay: fill from it
    const a = ptReplayAcct(); if (!a) return;
    PT.rlast[S.symbol] = b.close;
    let changed = false;
    if (a.ord.some(o => o.sym === S.symbol && o.st === 'working') || a.pos.some(p => p.sym === S.symbol)) {
      const step = tfOf(S.tf).sec, t0 = b.time * 1000, pts = b.close >= b.open ? [b.open, b.low, b.high, b.close] : [b.open, b.high, b.low, b.close];
      pts.forEach((px, i) => { if (ptEval(a, S.symbol, { bid: px, ask: px, last: px }, t0 + i * step * 250, i > 0)) changed = true; });
    }
    if (ptExpire(a, (b.time + tfOf(S.tf).sec) * 1000)) changed = true;
    if (ptMarginCheck(a, (b.time + tfOf(S.tf).sec) * 1000 - 1000)) changed = true;
    if (changed) this.changed();
    else if (a.pos.length) { markDirty(); this.ui(); }
    ptQtSync();
  },
  // Leaving the replay, going back in it, or jumping to another bar closes the replay positions at the last replayed
  // price and cancels the replay orders, since the bars they depend on change. otherOnly: only those not on the chart's symbol.
  replayClose(why, otherOnly) {
    const a = ptReplayAcct(); if (!a) return;
    const pos = a.pos.filter(p => !otherOnly || p.sym !== S.symbol), ords = a.ord.filter(o => o.st === 'working' && (!otherOnly || o.sym !== S.symbol));
    if (!pos.length && !ords.length) return;
    const now = ptNow(a);
    ords.forEach(o => ptCancel(a, o, why));
    pos.forEach(p => { const q = ptQuoteFor(a, p.sym), px = q ? (p.qty > 0 ? q.bid : q.ask) : p.avg; ptClosePos(a, p, px, now, 'replay'); });
    if (pos.length) toast(`${why}: ${pos.length} replay position${pos.length === 1 ? ' was' : 's were'} closed at the last replayed price.`);
    this.changed();
  },
  save() { const k = ptKeep(); PT.s.accts.forEach(a => ptTrim(a, k)); store.set('paper', PT.s); },
  changed() {   // after anything in the accounts changed
    this.save();
    if (this.relevantSet()) ensureTickerSubs();
    this.refresh(); syncTradeMarks();
  },
  refresh() { this.relevantSet(); ptRenderPanel(true); ptQtSync(); ptTicketLive(); markDirty(); },
  ui() { if (!PT.uiT) PT.uiT = setTimeout(() => { PT.uiT = 0; ptRenderPanel(false); ptTicketLive(); }, 250); },
  draw(m, W, H) { ptDraw(m, W, H); },
  pointerDown(e, x, y) { return ptPointerDown(e, x, y); },
  marks() {   // executions in the account on screen, for the chart
    if (!PT.s.ui.exec) return [];
    return ptA().ord.filter(o => o.st === 'filled' && o.sym === S.symbol && o.fillAt).map(o => ({ at: o.fillAt / 1000, buy: o.side === 'buy', text: `${ptSideWord(o.side)} ${ptFmtQty(o.sym, o.qty)}` }));
  },
  hotkey(side) { ptTicket({ sym: S.symbol, side }); },
};

// ----- quick trade buttons on the chart -----
function ptQtSync() {
  const box = $('#qt'); if (!box) return;
  const id = S.symbol, a = ptA(), show = S.ready && PT.s.ui.qt && !R.picking && curView() === 'chart';
  box.hidden = !show; wrap.classList.toggle('qt-on', show); box.classList.toggle('replay', R.on);
  if (!show) return;
  const ok = ptTradable(a, id), q = ptQuoteFor(a, id);
  box.classList.toggle('off', !ok);
  box.title = R.on ? `Bar replay trading in ${a.name}` : !ok ? `${label(id)} isn't live right now, so it can't be traded` : PT.s.ui.one ? 'One-click trading is on: Buy and Sell place market orders straight away' : `Paper trading in ${a.name}: click Buy or Sell to open an order`;
  $('#qtBid').textContent = q ? ptPx(id, q.bid) : '—'; $('#qtAsk').textContent = q ? ptPx(id, q.ask) : '—';
  const sp = q ? q.ask - q.bid : 0;
  $('#qtSpread').textContent = R.on ? 'replay' : q && sp > 0 ? (sp / ptPip(id)).toFixed(classOf(id) === 'forex' && !CFD[id] ? 1 : 0) : '';
  const qi = $('#qtQty');
  if (qi.dataset.sym !== id && document.activeElement !== qi) { qi.dataset.sym = id; qi.value = ptFmtQty(id, ptDefQty(id)).replace(/,/g, ''); }
  try { const w = chart.priceScale('right').width(); if (w && box.dataset.w !== String(w)) { box.dataset.w = String(w); box.style.right = (w + 10) + 'px'; } } catch (e) { /* keep the CSS default */ }
}
function ptQtQty() { const v = ptNum($('#qtQty').value); return v > 0 ? ptRoundQty(S.symbol, v) : ptDefQty(S.symbol); }
function ptQuick(side) {
  const id = S.symbol, qty = ptQtQty(), a = ptA();
  if (PT.s.ui.one && ptTradable(a, id)) ptPlace(a, { sym: id, side, type: 'market', qty });
  else ptTicket({ sym: id, side, qty });
}

// ----- the order ticket -----
const ptTA = () => (PT.t && ptAcctById(PT.t.aid)) || ptA();   // the account the ticket is for
function ptTicket(opts) {
  const id = opts.sym || S.symbol, a = ptA();
  const t = PT.t = { aid: a.id, mode: opts.mode || 'new', sym: id, side: opts.side || 'buy', type: opts.type || 'market', oid: opts.oid || null, pid: opts.pid || null };
  const dlg = $('#ordDlg'), o = t.oid ? a.ord.find(x => x.id === t.oid) : null, p = t.pid ? a.pos.find(x => x.id === t.pid) : null;
  if (t.mode === 'modify' && !o) return; if (t.mode === 'pos' && !p) return;
  dlg.dataset.mode = t.mode; dlg.classList.toggle('replay', a.kind === 'replay');
  $('#oTitle').textContent = t.mode === 'modify' ? `Modify order · ${label(id)}` : t.mode === 'pos' ? `${label(id)} position` : label(id);
  $('#oName').textContent = `${a.kind === 'replay' ? 'Bar replay · ' : ''}${a.name} · ${nameOf(id)}`;
  const q = ptQuoteFor(a, id), px = q ? q.last : null, prec = px ? precFor(id, px) : 2;
  const setPx = (sel, v) => { $(sel).value = v != null ? Number(v).toFixed(prec) : ''; };
  if (o) { t.side = o.side; t.type = o.type; setPx('#oLim', o.lim); setPx('#oStop', o.stp); $('#oQty').value = String(o.qty); $('#oTif').value = o.tif; }
  else if (p) { t.side = p.qty > 0 ? 'buy' : 'sell'; $('#oQty').value = String(Math.abs(p.qty)); $('#oPartQty').value = String(ptRoundQty(id, Math.abs(p.qty) / 2) || Math.abs(p.qty)); }
  else {
    $('#oQty').value = String(opts.qty || ptDefQty(id)); $('#oTif').value = 'gtc';
    const base = opts.price || px;
    if (base) { const gap = opts.price ? 0 : base * 0.005, buy = t.side === 'buy';
      setPx('#oLim', opts.price || (t.type === 'stoplimit' ? base + (buy ? 2 : -2) * gap : base + (buy ? -gap : gap)));
      setPx('#oStop', opts.price || base + (buy ? gap : -gap)); }
  }
  const tp = o ? o.tp : p ? p.tp : null, sl = o ? o.sl : p ? p.sl : null, trail = o ? o.trail : p ? p.trail : null;
  $('#oTpOn').checked = tp != null; $('#oSlOn').checked = sl != null; $('#oTrail').checked = !!trail;
  ['#oTpMode', '#oSlMode'].forEach(x => { $(x).value = 'price'; $(x).dataset.prev = 'price'; }); setPx('#oTp', tp); setPx('#oSl', sl);
  $('#oRiskOn').checked = false;
  {   // ready-made take profit and stop loss where there's none yet: 2:1, sized to how much the market usually moves
    const ref = p ? ptMark(a, p) : ptTicketRef(), c = catOf(id), r = (c === 'forex' && !/^X(AU|AG)\//.test(rawOf(id)) ? 0.25 : c === 'bond' ? 0.2 : c === 'crypto' ? 1 : 0.5) / 100, b = t.side === 'buy' ? 1 : -1;
    if (ref) { if (tp == null) setPx('#oTp', ref * (1 + 2 * r * b)); if (sl == null) setPx('#oSl', ref * (1 - r * b)); }
  }
  $('#oUnit').textContent = { stock: 'shares', fund: 'shares', crypto: splitSym(rawOf(id))[0] || 'coins' }[catOf(id)] || 'units';
  t.touched = { tp: tp != null, sl: sl != null }; t.ref = ptTicketRef();
  ptTicketRender();
  if (!dlg.open) {
    if (matchMedia('(max-width: 880px)').matches) { dlg.style.left = dlg.style.top = ''; dlg.showModal(); }
    else { const at = store.get('ptDlgAt', null); dlg.show(); if (at && at.l >= 0 && at.t >= 0 && at.l < innerWidth - 120 && at.t < innerHeight - 120) { dlg.style.left = at.l + 'px'; dlg.style.top = at.t + 'px'; } }
  }
  setTimeout(() => { const f = t.mode === 'pos' ? $('#oTp') : ['limit', 'stoplimit'].includes(t.type) ? $('#oLim') : t.type === 'stop' ? $('#oStop') : $('#oQty'); if (f && !f.disabled) f.focus({ preventScroll: true }); }, 30);
}
function ptTicketRef() {   // the entry price the brackets are measured from
  const t = PT.t; if (!t) return null;
  const a = ptTA();
  if (t.mode === 'pos') { const p = a.pos.find(x => x.id === t.pid); return p ? p.avg : null; }
  const q = ptQuoteFor(a, t.sym);
  if (t.type === 'market') return q ? (t.side === 'buy' ? q.ask : q.bid) : null;
  if (t.type === 'stop') return ptNum($('#oStop').value);
  return ptNum($('#oLim').value);
}
function ptFollowRef() {   // the take profit and stop loss move with the entry price until you set them yourself
  const t = PT.t; if (!t || t.mode === 'pos') return;
  const ref = ptTicketRef(); if (!(ref > 0)) return;
  if (t.ref > 0 && ref !== t.ref) ['tp', 'sl'].forEach(w => {
    if (t.touched[w] || $(w === 'tp' ? '#oTpMode' : '#oSlMode').value !== 'price') return;
    const inp = $(w === 'tp' ? '#oTp' : '#oSl'), v = ptNum(inp.value); if (v > 0) inp.value = (v + ref - t.ref).toFixed(precFor(t.sym, ref));
  });
  t.ref = ref;
}
function ptBracketPrice(which) {   // the take-profit or stop-loss price from what's typed, in whichever unit
  const t = PT.t, on = $(which === 'tp' ? '#oTpOn' : '#oSlOn').checked; if (!on) return null;
  const v = ptNum($(which === 'tp' ? '#oTp' : '#oSl').value), mode = $(which === 'tp' ? '#oTpMode' : '#oSlMode').value, ref = ptTicketRef();
  if (v == null || !(v > 0)) return NaN;
  if (mode === 'price') return v;
  if (!ref) return NaN;
  const dir = (t.side === 'buy' ? 1 : -1) * (which === 'tp' ? 1 : -1);
  if (mode === 'pips') return ref + dir * v * ptPip(t.sym);
  if (mode === 'pct') return ref * (1 + dir * v / 100);
  if (which === 'sl' && t.mode === 'new' && $('#oRiskOn').checked) return NaN;   // sizing by risk needs the stop as a price, pips or %, not dollars
  const qty = ptTicketQty(true); if (!(qty > 0)) return NaN;
  return ref + dir * v / (qty * ptConv(t.sym));
}
function ptTicketQty(raw) {
  const t = PT.t; if (!t) return null;
  if (t.mode === 'new' && $('#oRiskOn').checked) {
    const sl = ptBracketPrice('sl'), ref = ptTicketRef(), r = ptNum($('#oRisk').value);
    if (!(sl > 0) || !ref || !(r > 0) || sl === ref) return null;
    const risk = $('#oRiskMode').value === 'pct' ? ptMetrics(ptTA()).equity * r / 100 : r;
    return ptRoundQty(t.sym, risk / (Math.abs(ref - sl) * ptConv(t.sym)));
  }
  const v = ptNum($('#oQty').value); if (!(v > 0)) return null;
  return raw ? v : ptRoundQty(t.sym, v);
}
function ptTicketSpec() {
  const t = PT.t, spec = { sym: t.sym, side: t.side, type: t.type, qty: ptTicketQty(), tif: $('#oTif').value };
  if (['limit', 'stoplimit'].includes(t.type)) spec.lim = ptNum($('#oLim').value);
  if (['stop', 'stoplimit'].includes(t.type)) spec.stp = ptNum($('#oStop').value);
  const tp = ptBracketPrice('tp'), sl = ptBracketPrice('sl'), ref = ptTicketRef();
  if (tp != null) spec.tp = tp; if (sl != null) spec.sl = sl;
  if (sl != null && $('#oTrail').checked && ref && sl > 0) spec.trail = Math.abs(ref - sl);
  return spec;
}
function ptTicketRender() {
  const t = PT.t; if (!t) return;
  const dlg = $('#ordDlg'), pos = t.mode === 'pos', mod = t.mode === 'modify';
  dlg.querySelectorAll('#oSide .o-sb').forEach(b => { const on = b.dataset.side === t.side; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); b.disabled = mod || pos; });
  dlg.querySelectorAll('#oType .btn').forEach(b => { const on = b.dataset.type === t.type; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); b.disabled = mod && !on; });
  $('#oType').hidden = pos; $('#oSide').hidden = pos;
  $('#oLimRow').hidden = pos || !['limit', 'stoplimit'].includes(t.type);
  $('#oStopRow').hidden = pos || !['stop', 'stoplimit'].includes(t.type);
  $('#oTifRow').hidden = pos || t.type === 'market';
  $('#oQtyRow').hidden = pos; $('#oRiskWrap').hidden = pos || mod;
  $('#oPart').hidden = !pos; $('#oBe').hidden = !pos;
  const risk = !pos && !mod && $('#oRiskOn').checked; $('#oRiskRow').hidden = !risk; $('#oQty').disabled = risk;
  if (risk && !$('#oSlOn').checked) $('#oSlOn').checked = true;
  $('#oTpRow').hidden = !$('#oTpOn').checked; $('#oSlRow').hidden = !$('#oSlOn').checked;
  const pn = ptPipName(t.sym); dlg.querySelectorAll('option[value="pips"]').forEach(op => { op.textContent = pn === 'pips' ? 'Pips' : 'Ticks'; });
  ptTicketLive();
}
function ptTicketLive() {   // prices, estimates and the summary; runs as prices move
  const t = PT.t, dlg = $('#ordDlg'); if (!t || !dlg.open) return;
  const a = ptAcctById(t.aid); if (!a) { dlg.close(); return; }
  const id = t.sym, q = ptQuoteFor(a, id), conv = ptConv(id), m = ptMetrics(a);
  $('#oBid').textContent = q ? ptPx(id, q.bid) : '—'; $('#oAsk').textContent = q ? ptPx(id, q.ask) : '—';
  const sp = q ? q.ask - q.bid : 0; $('#oSpread').textContent = a.kind === 'replay' ? 'replay' : q && sp > 0 ? `${(sp / ptPip(id)).toFixed(1)} ${ptPipName(id)}` : '';
  const ref = ptTicketRef(), qty = t.mode === 'pos' ? Math.abs((a.pos.find(x => x.id === t.pid) || { qty: 0 }).qty) : ptTicketQty();
  if (t.mode === 'new' && $('#oRiskOn').checked) { $('#oQty').value = qty ? String(qty) : ''; $('#oRiskInfo').textContent = qty ? `${ptFmtQty(id, qty)} ${$('#oUnit').textContent}` : 'Set a stop loss to size by risk'; }
  const est = (which, node) => {
    const pr = ptBracketPrice(which); node.textContent = '';
    if (pr == null) return;
    if (!(pr > 0) || !ref || !qty) { node.textContent = '—'; return; }
    const dir = t.side === 'buy' ? 1 : -1, pnl = (pr - ref) * qty * dir * conv;
    node.textContent = `${$(which === 'tp' ? '#oTpMode' : '#oSlMode').value === 'price' ? '' : 'at ' + ptPx(id, pr) + ' · '}${usd(pnl, true)} · ${fmtPct(((pr - ref) / ref) * 100 * dir)}`;
    node.className = 'o-est ' + (pnl >= 0 ? 'up-t' : 'dn-t');
  };
  est('tp', $('#oTpEst')); est('sl', $('#oSlEst'));
  const sum = $('#oSum'); sum.replaceChildren();
  const row = (k, v, cls) => { const d = el('div'); d.append(el('dt', null, k), el('dd', cls || null, v)); sum.append(d); };
  let err = '';
  if (t.mode === 'pos') {
    const p = a.pos.find(x => x.id === t.pid); if (!p) { dlg.close(); return; }
    const r = m.rows.find(x => x.p === p);
    row('Entry price', ptPx(id, p.avg)); row('Open P&L', usd(r.pl, true), r.pl >= 0 ? 'up-t' : 'dn-t');
    const tp = ptBracketPrice('tp'), sl = ptBracketPrice('sl');
    if (tp > 0 && sl > 0) row('Reward to risk', (Math.abs(tp - p.avg) / Math.abs(p.avg - sl)).toFixed(2));
    err = Number.isNaN(tp) ? 'Enter a take profit, or untick it.' : Number.isNaN(sl) ? 'Enter a stop loss, or untick it.' : ptBracketErr(a, p, 'tp', tp) || ptBracketErr(a, p, 'sl', sl);
    $('#oGo').textContent = 'Save'; $('#oGo').className = 'primary o-go';
  } else {
    const spec = ptTicketSpec(), value = qty && ref ? qty * ref * conv : null, lev = ptLev(a, id);
    row('Order value', value ? usd(value) : '—'); row('Margin needed', value ? `${usd(value / lev)} (1:${lev})` : '—'); row('Available', usd(m.avail));
    if (a.set.comm) row('Commission', value ? usd(value * a.set.comm / 100) : '—');
    if (spec.tp > 0 && spec.sl > 0 && ref) row('Reward to risk', (Math.abs(spec.tp - ref) / Math.abs(ref - spec.sl)).toFixed(2));
    const riskUsd = t.mode === 'new' && $('#oRiskOn').checked && $('#oSlMode').value === 'usd';
    err = riskUsd ? 'When sizing by risk, set the stop loss as a price, pips or %.'
      : Number.isNaN(spec.tp) ? 'Enter a take profit, or untick it.' : Number.isNaN(spec.sl) ? 'Enter a stop loss, or untick it.'
      : t.mode === 'modify' ? ptCheckModify(a, spec) : ptCheckOrder(a, spec);
    if (!err && t.mode === 'new' && value) {
      const p = a.pos.find(x => x.sym === id), dq = t.side === 'buy' ? qty : -qty, old = p ? p.qty : 0;
      const adds = !old || Math.sign(old) === Math.sign(dq) || Math.abs(dq) > Math.abs(old);
      if (adds && value / lev > m.avail + (p && Math.sign(old) !== Math.sign(dq) ? Math.abs(old) * ref * conv / lev : 0)) err = `Not enough margin: this needs ${usd(value / lev)} and ${usd(Math.max(0, m.avail))} is available. Lower the quantity, or raise leverage in the Account tab.`;
    }
    const word = t.mode === 'modify' ? 'Modify order' : `${ptSideWord(t.side)} ${qty ? ptFmtQty(id, qty) : ''} ${t.type === 'market' ? 'at market' : PT_TYPES[t.type].toLowerCase()}`;
    $('#oGo').textContent = word.replace(/\s+/g, ' ').trim(); $('#oGo').className = 'o-go ' + t.side;
  }
  const w = $('#oWarn'); w.hidden = !err; w.textContent = err; $('#oGo').disabled = !!err;
}
function ptCheckModify(a, spec) {
  const o = a.ord.find(x => x.id === PT.t.oid); if (!o || o.st !== 'working') return 'This order is no longer working.';
  return ptCheckOrder(a, o.trig ? Object.assign({}, spec, { type: 'limit' }) : spec);   // a triggered stop limit is a limit order now
}
function ptTicketSubmit() {
  const t = PT.t; if (!t) return;
  const a = ptAcctById(t.aid); if (!a) return;
  if (t.mode === 'pos') {
    const p = a.pos.find(x => x.id === t.pid); if (!p) return;
    const tp = ptBracketPrice('tp'), sl = ptBracketPrice('sl');
    if (Number.isNaN(tp) || Number.isNaN(sl)) { toast('Check the take profit and stop loss.'); return; }
    const err = ptSetBrackets(a, p, tp, sl, sl > 0 && $('#oTrail').checked); if (err) { toast(err); return; }
    $('#ordDlg').close(); Paper.changed(); toast(`${label(p.sym)} position updated.`); return;
  }
  const spec = ptTicketSpec();
  if (Number.isNaN(spec.tp) || Number.isNaN(spec.sl)) { toast('Check the take profit and stop loss.'); return; }
  if (t.mode === 'modify') {
    const o = a.ord.find(x => x.id === t.oid), err = ptCheckModify(a, spec); if (err) { toast(err); return; }
    Object.assign(o, { qty: spec.qty, lim: spec.lim || null, stp: spec.stp || null, tp: spec.tp || null, sl: spec.sl || null, trail: spec.trail || null, tif: spec.type === 'market' ? 'gtc' : spec.tif, upd: ptNow(a) });
    o.exp = o.tif === 'day' ? (o.exp || ptDayEnd(o.sym, ptNow(a))) : null;
    ptLog(a, `Modified: ${ptDesc(o)}.`, 'info'); $('#ordDlg').close();
    if ((a.kind === 'replay' || PT.leader) && ptCanFill(a, o.sym)) { const q = ptQuoteFor(a, o.sym); if (q) ptEval(a, o.sym, q, ptNow(a), false); }
    Paper.changed(); toast(`Order modified: ${ptDesc(o)}`); return;
  }
  ptPlace(a, spec, () => { if ($('#ordDlg').open) $('#ordDlg').close(); });
}
function ptBracketMode(which) {   // switching between price, pips, % and $ keeps the same price
  const inp = $(which === 'tp' ? '#oTp' : '#oSl'), sel = $(which === 'tp' ? '#oTpMode' : '#oSlMode');
  const prev = sel.dataset.prev || 'price'; sel.dataset.prev = sel.value;
  const now = sel.value; sel.value = prev; const pr = ptBracketPrice(which); sel.value = now;
  const t = PT.t, ref = ptTicketRef(), id = t.sym;
  if (!(pr > 0) || !ref) { inp.value = ''; ptTicketLive(); return; }
  const dist = Math.abs(pr - ref), qty = ptTicketQty(true) || 0;
  inp.value = now === 'price' ? pr.toFixed(precFor(id, pr)) : now === 'pips' ? (dist / ptPip(id)).toFixed(1) : now === 'pct' ? ((dist / ref) * 100).toFixed(2) : (dist * qty * ptConv(id)).toFixed(2);
  ptTicketLive();
}
function ptFlipBrackets() {   // switching buy and sell mirrors the take profit and stop loss around the entry
  const ref = ptTicketRef(); if (!ref) return;
  ['tp', 'sl'].forEach(w => { const sel = $(w === 'tp' ? '#oTpMode' : '#oSlMode'), inp = $(w === 'tp' ? '#oTp' : '#oSl'); if (sel.value !== 'price') return; const v = ptNum(inp.value); if (v > 0) inp.value = (2 * ref - v).toFixed(precFor(PT.t.sym, ref)); });
}
function ptConfirm(title, text, go, fn, bal) {
  $('#pcTitle').textContent = title; $('#pcText').textContent = text; $('#pcGo').textContent = go;
  $('#pcBalWrap').hidden = !bal; if (bal) $('#pcBal').value = String(bal);
  PT.confirm = fn; $('#ptConfirm').showModal();
}
function ptUiInit() {
  const dlg = $('#ordDlg');
  dlg.querySelectorAll('#oSide .o-sb').forEach(b => { b.onclick = () => { if (PT.t.side === b.dataset.side) return; PT.t.side = b.dataset.side; ptFlipBrackets(); PT.t.ref = ptTicketRef(); ptTicketRender(); }; });
  dlg.querySelectorAll('#oType .btn').forEach(b => { b.onclick = () => { PT.t.type = b.dataset.type; const q = ptQuoteFor(ptTA(), PT.t.sym); if (q) { const prec = precFor(PT.t.sym, q.last), g = q.last * 0.005, buy = PT.t.side === 'buy';
    if (!ptNum($('#oLim').value)) $('#oLim').value = (q.last + (buy ? -g : g)).toFixed(prec); if (!ptNum($('#oStop').value)) $('#oStop').value = (q.last + (buy ? g : -g)).toFixed(prec); } ptFollowRef(); ptTicketRender(); }; });
  ['#oLim', '#oStop'].forEach(s => $(s).addEventListener('input', () => { ptFollowRef(); ptTicketLive(); }));
  ['#oTp', '#oSl'].forEach(s => $(s).addEventListener('input', () => { if (PT.t) PT.t.touched[s === '#oTp' ? 'tp' : 'sl'] = true; ptTicketLive(); }));
  ['#oQty', '#oRisk', '#oPartQty'].forEach(s => $(s).addEventListener('input', () => ptTicketLive()));
  { // drag the ticket by its title
    const head = dlg.querySelector('.dlg-h'); let dr = null;
    head.addEventListener('pointerdown', e => { if (dlg.matches(':modal') || e.target.closest('button')) return; const r = dlg.getBoundingClientRect(); dr = { x: e.clientX - r.left, y: e.clientY - r.top }; head.setPointerCapture(e.pointerId); e.preventDefault(); });
    head.addEventListener('pointermove', e => { if (!dr) return; dlg.style.left = clamp(e.clientX - dr.x, 0, innerWidth - dlg.offsetWidth) + 'px'; dlg.style.top = clamp(e.clientY - dr.y, 0, innerHeight - 80) + 'px'; });
    head.addEventListener('pointerup', () => { if (!dr) return; dr = null; store.raw('ptDlgAt', { l: parseInt(dlg.style.left, 10) || 0, t: parseInt(dlg.style.top, 10) || 0 }); });
  }
  ['#oTpOn', '#oSlOn', '#oRiskOn', '#oTrail', '#oTif', '#oRiskMode'].forEach(s => $(s).addEventListener('change', () => ptTicketRender()));
  $('#oTpMode').addEventListener('change', () => ptBracketMode('tp')); $('#oSlMode').addEventListener('change', () => ptBracketMode('sl'));
  $('#oForm').addEventListener('submit', e => { e.preventDefault(); ptTicketSubmit(); });
  $('#oBe').onclick = () => { const a = ptTA(), p = PT.t && a.pos.find(x => x.id === PT.t.pid); if (!p) return; $('#oSlOn').checked = true; $('#oSlMode').value = 'price'; $('#oSlMode').dataset.prev = 'price'; $('#oSl').value = p.avg.toFixed(precFor(p.sym, p.avg)); ptTicketRender(); };
  $('#oPartGo').onclick = () => { const a = ptTA(), p = a.pos.find(x => x.id === PT.t.pid), v = ptNum($('#oPartQty').value); if (!p) return; const qn = v > 0 ? ptRoundQty(p.sym, Math.min(v, Math.abs(p.qty))) : 0; if (!qn) { toast('Enter how much to close.'); return; } dlg.close(); ptCloseNow(a, p, qn); };
  $('#oPartBtns').querySelectorAll('button').forEach(b => { b.onclick = () => { const p = ptTA().pos.find(x => x.id === PT.t.pid); if (p) $('#oPartQty').value = String(ptRoundQty(p.sym, Math.abs(p.qty) * (+b.dataset.f)) || Math.abs(p.qty)); }; });
  dlg.addEventListener('keydown', e => { if (e.key === 'Escape' && !dlg.matches(':modal')) { e.preventDefault(); dlg.close(); } });
  dlg.addEventListener('close', () => { PT.t = null; });
  $('#qtBuy').onclick = () => ptQuick('buy'); $('#qtSell').onclick = () => ptQuick('sell');
  $('#qtQty').addEventListener('change', () => { const v = ptNum($('#qtQty').value); if (v > 0) { const r = ptRoundQty(S.symbol, v) || ptStep(S.symbol); ptRememberQty(S.symbol, r); $('#qtQty').value = String(r); } });
  $('#qtQty').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); });
  $('#tradeBtn').onclick = () => ptTicket({ sym: S.symbol, side: 'buy' });
  $('#tpTrade').onclick = () => ptTicket({ sym: S.symbol, side: 'buy' });
  $('#tpFold').onclick = () => ptSetOpen(!PT.open);
  $('#tp').querySelectorAll('.tp-tab').forEach(b => { b.onclick = () => { PT.tab = b.dataset.tab; store.raw('ptTab', PT.tab); ptSetOpen(true); ptRenderPanel(true); }; });
  ptGripInit();
  // account switcher
  $('#tpAcct').onclick = e => { e.stopPropagation(); const m = $('#tpMenu'); if (m.hidden) ptAcctMenu(); else m.hidden = true; };
  document.addEventListener('pointerdown', e => { const m = $('#tpMenu'); if (!m.hidden && !m.contains(e.target) && !$('#tpAcct').contains(e.target)) m.hidden = true; }, true);
  // dialogs: confirm, new account, the Journal question
  $('#ptConfirm').addEventListener('close', () => { PT.confirm = null; });
  $('#pcGo').onclick = () => { const fn = PT.confirm; $('#ptConfirm').close(); if (fn) fn(); };
  $('#pjYes').onclick = () => ptAnswerJournal(true); $('#pjNo').onclick = () => ptAnswerJournal(false);
  $('#ptJDlg').addEventListener('close', () => { if (PT.jAsk) { PT.jAsk = null; toast('Order not placed.'); } });
  const nd = $('#ptNewDlg');
  PT_SIZES.forEach(v => { const b = el('button', 'pn-size', usd(v, false, true).replace('.0', '')); b.type = 'button'; b.dataset.v = String(v); b.onclick = () => { $('#pnBal').value = String(v); ptNewRender(); }; $('#pnSizes').append(b); });
  nd.querySelectorAll('#pnKind .btn').forEach(b => { b.onclick = () => { nd.dataset.kind = b.dataset.kind; ptNewRender(); }; });
  $('#pnBal').addEventListener('input', ptNewRender);
  $('#pnForm').addEventListener('submit', e => { e.preventDefault(); ptNewSubmit(); });
  // the right-click menu and the chart lines
  document.addEventListener('pointerdown', e => { const m = $('#ctxMenu'); if (!m.hidden && !m.contains(e.target)) m.hidden = true; }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#ctxMenu').hidden = true; $('#tpMenu').hidden = true; } });
  window.addEventListener('blur', () => { $('#ctxMenu').hidden = true; });
  wrap.addEventListener('contextmenu', e => ptMenuAt(e));
  wrap.addEventListener('pointermove', e => { if (PT.drag || e.buttons) return; const r = wrap.getBoundingClientRect(), h = ptHit(e.clientX - r.left, e.clientY - r.top); wrap.classList.toggle('pt-ns', !!h && h.part !== 'close'); wrap.classList.toggle('pt-hand', !!h && h.part === 'close'); });
  wrap.addEventListener('pointerleave', () => wrap.classList.remove('pt-ns', 'pt-hand'));
  ['mousedown', 'touchstart'].forEach(ev => wrap.addEventListener(ev, e => { if (PT.drag) e.stopPropagation(); }, { capture: true, passive: true }));
  window.addEventListener('touchmove', e => { if (PT.drag) e.preventDefault(); }, { passive: false });
  window.addEventListener('pointermove', ptPointerMove);
  window.addEventListener('pointerup', ptPointerUp);
  window.addEventListener('pointercancel', () => { if (PT.drag) { PT.drag = null; markDirty(); } });
}

// ----- the trading panel under the chart -----
function ptSetOpen(on) {
  PT.open = on; store.raw('ptOpen', on);
  const tp = $('#tp'); tp.classList.toggle('open', on); $('#tpBody').hidden = !on; $('#tpFold').setAttribute('aria-expanded', String(on));
  const h = +store.get('ptH', 0); if (h) tp.style.setProperty('--tp-h', h + 'px');
  ptRenderPanel(true); requestAnimationFrame(() => { sizeOverlay(); markDirty(); });
}
function ptGripInit() {
  const grip = $('#tpGrip'), tp = $('#tp'); let st = null;
  grip.addEventListener('pointerdown', e => { st = { y: e.clientY, h: tp.getBoundingClientRect().height }; grip.setPointerCapture(e.pointerId); e.preventDefault(); });
  grip.addEventListener('pointermove', e => { if (!st) return; const max = Math.max(160, $('.stage').getBoundingClientRect().height - 180), h = clamp(st.h + (st.y - e.clientY), 120, max); tp.style.setProperty('--tp-h', h + 'px'); });
  grip.addEventListener('pointerup', () => { if (!st) return; st = null; store.raw('ptH', Math.round(tp.getBoundingClientRect().height)); sizeOverlay(); markDirty(); });
}
function ptAcctMenu() {   // the account switcher: the accounts for live prices, or for bar replay while replaying
  const m = $('#tpMenu'), kind = R.on ? 'replay' : 'live', cur = ptA(); m.replaceChildren();
  m.append(el('div', 'tp-menu-h', R.on ? 'Bar replay accounts' : 'Live-price accounts'));
  PT.s.accts.filter(a => a.kind === kind).forEach(a => {
    const b = el('button', 'tp-menu-i' + (a === cur ? ' on' : '')); b.type = 'button'; b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(a === cur));
    const eq = ptMetrics(a).equity;
    b.append(el('span', 'nm', a.name), el('span', 'eq ' + (eq > a.start ? 'up-t' : eq < a.start ? 'dn-t' : ''), usd(eq)), el('span', 'st', `started ${usd(a.start, false, true)}`));
    b.onclick = () => { m.hidden = true; if (a !== cur) ptSwitch(a.id); };
    m.append(b);
  });
  const other = PT.s.accts.filter(a => a.kind !== kind).length;
  if (other) m.append(el('div', 'tp-menu-note', R.on ? `${other} live-price account${other === 1 ? '' : 's'}: leave replay to use ${other === 1 ? 'it' : 'them'}.` : `${other} bar replay account${other === 1 ? '' : 's'}: used while you replay.`));
  m.append(el('div', 'ctx-sep'));
  const nb = el('button', 'tp-menu-i act', 'New account…'); nb.type = 'button'; nb.onclick = () => { m.hidden = true; ptNewAcctDlg(kind); }; m.append(nb);
  const mb = el('button', 'tp-menu-i act', 'Manage accounts'); mb.type = 'button'; mb.onclick = () => { m.hidden = true; PT.tab = 'acct'; store.raw('ptTab', 'acct'); ptSetOpen(true); }; m.append(mb);
  m.hidden = false;
  const r = $('#tpAcct').getBoundingClientRect(), h = m.offsetHeight, w = m.offsetWidth;
  const up = r.top - h - 6 > 8 || r.bottom + h + 6 > innerHeight;
  m.style.left = clamp(r.left, 8, innerWidth - w - 8) + 'px'; m.style.top = (up ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
}
function ptBtn(text, cls, fn, title) { const b = el('button', cls || null, text); b.type = 'button'; if (title) { b.title = title; b.setAttribute('aria-label', title); } b.onclick = e => { e.stopPropagation(); fn(); }; return b; }
function ptXBtn(fn, title) { const b = ptBtn('', 'x', fn, title); b.innerHTML = svg('x'); return b; }
const ptWhen = ms => { const d = new Date(ms), today = new Date(); const same = d.toDateString() === today.toDateString(); return (same ? '' : `${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() !== today.getFullYear() ? ' ' + d.getFullYear() : ''} `) + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
function ptCell(tr, text, cls, f) { const td = el('td', cls || null, text); if (f) td.dataset.f = f; tr.append(td); return td; }
function ptSymCell(tr, id) { const td = el('td', 'sym'); const b = ptBtn(label(id), null, () => { if (id !== S.symbol) setSymbol(id); }, `Show ${label(id)} on the chart`); td.append(b); tr.append(td); }
function ptSidePill(tr, side) { const td = el('td'); td.append(el('span', 'side-pill ' + side, { buy: 'Buy', sell: 'Sell', long: 'Long', short: 'Short' }[side])); tr.append(td); }
function ptTable(heads) {
  const box = el('div', 'tp-scroll'), t = el('table', 'tp-t'), thead = el('thead'), tr = el('tr');
  heads.forEach(h => { const [txt, cls] = Array.isArray(h) ? h : [h]; tr.append(el('th', cls || null, txt)); });
  thead.append(tr); t.append(thead, el('tbody')); box.append(t); return { box, body: t.tBodies[0] };
}
function ptRenderSummary(a, m) {
  const sum = $('#tpSum'); sum.replaceChildren();
  const item = (k, v, cls, lvl) => { const d = el('div', lvl ? 'l' + lvl : null); d.append(el('dt', null, k), el('dd', cls || null, v)); sum.append(d); };   // l2 and l1 make way on smaller screens
  item('Balance', usd(a.bal), null, 2); item('Equity', usd(m.equity));
  item('Open P&L', usd(m.upl, true), m.upl > 0 ? 'up-t' : m.upl < 0 ? 'dn-t' : null);
  item('Margin', usd(m.margin), null, 2); item('Available', usd(m.avail), m.avail < 0 ? 'dn-t' : null, 1);
  const np = a.pos.length, no = a.ord.filter(o => o.st === 'working').length;
  $('#tpNPos').textContent = np ? String(np) : ''; $('#tpNOrd').textContent = no ? String(no) : '';
  $('#tpAcctName').textContent = a.name; $('#tpAcctKind').textContent = a.kind === 'replay' ? 'Replay' : 'Paper';
  $('#tpAcct').classList.toggle('replay', a.kind === 'replay'); $('#tp').classList.toggle('replay', a.kind === 'replay');
  $('#tpAcct').title = `${a.name}: ${a.kind === 'replay' ? 'bar replay' : 'live-price'} paper account, started with ${usd(a.start)}. Click to switch or add accounts.`;
}
function ptRenderPanel(full) {
  const box = $('#tpBody'); if (!box) return;
  const a = ptA(), m = ptMetrics(a); ptRenderSummary(a, m);
  $('#tp').querySelectorAll('.tp-tab').forEach(b => b.setAttribute('aria-selected', String(PT.open && b.dataset.tab === PT.tab)));
  if (!PT.open) return;
  const sig = a.id + '|' + PT.tab + '|' + PT.ordView + '|' + PT.histView + '|' + a.pos.map(p => [p.id, p.qty, p.tp, p.sl, !!p.trail].join()).join(';') + '|' + a.ord.map(o => o.id + o.st + o.trig + o.qty + o.lim + o.stp + o.tp + o.sl).join(';') + '|' + a.hist.length + '|' + a.log.length + '|' + JSON.stringify(a.set) + '|' + a.start + '|' + a.name + '|' + JSON.stringify(PT.s.ui) + '|' + PT.s.accts.length;
  if (!full && sig === PT.sig) { ptLiveCells(m); return; }
  PT.sig = sig; box.replaceChildren();
  if (PT.tab === 'pos') ptRenderPositions(box, a, m);
  else if (PT.tab === 'ord') ptRenderOrders(box, a);
  else if (PT.tab === 'hist') ptRenderHistory(box, a);
  else ptRenderAccount(box, a, m);
}
function ptLiveCells(m) {
  $('#tpBody').querySelectorAll('tr[data-pid]').forEach(tr => {
    const r = m.rows.find(x => x.p.id === tr.dataset.pid); if (!r) return;
    const set = (f, v, cls) => { const td = tr.querySelector(`[data-f="${f}"]`); if (td) { td.textContent = v; if (cls != null) td.className = 'num ' + cls; } };
    set('last', ptPx(r.p.sym, r.mark)); set('pl', usd(r.pl, true), r.pl > 0 ? 'up-t' : r.pl < 0 ? 'dn-t' : ''); set('pct', fmtPct(r.pct), r.pct > 0 ? 'up-t' : r.pct < 0 ? 'dn-t' : ''); set('val', usd(r.value));
  });
  const tot = $('#tpBody [data-f="tot"]'); if (tot) { tot.textContent = usd(m.upl, true); tot.className = m.upl > 0 ? 'up-t' : m.upl < 0 ? 'dn-t' : ''; }
}
function ptEmpty(box, text, action) { const d = el('div', 'tp-empty'); d.append(el('p', null, text)); if (action) d.append(action); box.append(d); }
function ptRenderPositions(box, a, m) {
  if (!a.pos.length) {
    ptEmpty(box, a.kind === 'replay' ? 'No open replay positions. Use Buy or Sell while the bars play: orders fill from the replayed bars.' : `No open positions in ${a.name}. Use Buy or Sell on the chart, or the Trade button, to open one with virtual money.`, ptBtn('Place an order', 'primary', () => ptTicket({ sym: S.symbol, side: 'buy' })));
    return;
  }
  const bar = el('div', 'tp-bar'); const tot = el('span'); tot.append(document.createTextNode(`${a.pos.length} position${a.pos.length === 1 ? '' : 's'} · open P&L `)); const tv = el('b', null, ''); tv.dataset.f = 'tot'; tot.append(tv);
  bar.append(tot, el('span', 'spacer'), ptBtn('Close all', 'ghost sm', () => ptConfirm('Close all positions?', `This closes all ${a.pos.length} positions in ${a.name} at the market price.`, 'Close all', () => {
    a.pos.slice().forEach(p => { if (ptCanFill(a, p.sym)) { const q = ptQuoteFor(a, p.sym); ptClosePos(a, p, p.qty > 0 ? q.bid : q.ask, ptNow(a), 'close'); } else toast(`${label(p.sym)}: market closed, not closed.`); });
    Paper.changed();
  })));
  box.append(bar);
  const { box: tb, body } = ptTable(['Symbol', 'Side', ['Qty', 'num'], ['Avg price', 'num'], ['Last', 'num'], ['Open P&L', 'num'], ['P&L %', 'num'], ['Take profit', 'num'], ['Stop loss', 'num'], ['Value', 'num'], ['', 'act']]);
  for (const r of m.rows) {
    const p = r.p, tr = el('tr'); tr.dataset.pid = p.id;
    ptSymCell(tr, p.sym); ptSidePill(tr, p.qty > 0 ? 'long' : 'short');
    ptCell(tr, ptFmtQty(p.sym, p.qty), 'num'); ptCell(tr, ptPx(p.sym, p.avg), 'num'); ptCell(tr, '', 'num', 'last'); ptCell(tr, '', 'num', 'pl'); ptCell(tr, '', 'num', 'pct');
    ptCell(tr, p.tp ? ptPx(p.sym, p.tp) : '—', 'num'); ptCell(tr, p.sl ? ptPx(p.sym, p.sl) + (p.trail ? ' ↗' : '') : '—', 'num').title = p.trail ? 'Trailing stop' : ''; ptCell(tr, '', 'num', 'val');
    const acts = el('td', 'act'); const g = el('div', 'tp-acts');
    g.append(ptBtn('TP/SL', null, () => ptTicket({ sym: p.sym, mode: 'pos', pid: p.id }), `Take profit, stop loss or close part of ${label(p.sym)}`),
      ptBtn('Reverse', null, () => ptReverse(a, p), `Reverse: turn this ${p.qty > 0 ? 'long into a short' : 'short into a long'} of the same size`),
      ptXBtn(() => ptCloseNow(a, p), `Close the ${label(p.sym)} position`));
    acts.append(g); tr.append(acts); body.append(tr);
  }
  box.append(tb); ptLiveCells(m);
}
function ptStatus(o) { return o.st === 'working' ? (o.trig ? 'Triggered' : 'Working') : o.st === 'cancelled' && /^Expired/.test(o.why) ? 'Expired' : { filled: 'Filled', cancelled: 'Cancelled', rejected: 'Rejected' }[o.st]; }
function ptRenderOrders(box, a) {
  const bar = el('div', 'tp-bar'), seg = el('div', 'seg tp-seg');
  [['working', 'Working'], ['filled', 'Filled'], ['cancelled', 'Cancelled'], ['all', 'All']].forEach(([k, t]) => seg.append(ptBtn(t, 'btn' + (PT.ordView === k ? ' on' : ''), () => { PT.ordView = k; ptRenderPanel(true); })));
  bar.append(seg, el('span', 'spacer'));
  const working = a.ord.filter(o => o.st === 'working');
  if (working.length) bar.append(ptBtn('Cancel all', 'ghost sm', () => ptConfirm('Cancel all orders?', `This cancels ${working.length} working order${working.length === 1 ? '' : 's'} in ${a.name}.`, 'Cancel all', () => { working.forEach(o => ptCancel(a, o)); Paper.changed(); })));
  box.append(bar);
  const list = a.ord.filter(o => PT.ordView === 'all' || (PT.ordView === 'cancelled' ? o.st === 'cancelled' || o.st === 'rejected' : o.st === PT.ordView)).slice().sort((x, y) => (PT.ordView === 'working' ? x.at - y.at : y.upd - x.upd));
  if (!list.length) { ptEmpty(box, PT.ordView === 'working' ? 'No working orders. Limit and stop orders wait here until the price reaches them.' : 'Nothing here yet.'); return; }
  const { box: tb, body } = ptTable(['Placed', 'Symbol', 'Side', 'Type', ['Qty', 'num'], ['Limit', 'num'], ['Stop', 'num'], ['TP', 'num'], ['SL', 'num'], 'Duration', 'Status', ['Fill price', 'num'], ['', 'act']]);
  for (const o of list) {
    const tr = el('tr'); tr.dataset.oid = o.id;
    ptCell(tr, ptWhen(o.at), 'muted'); ptSymCell(tr, o.sym); ptSidePill(tr, o.side);
    ptCell(tr, o.tag && o.tag !== 'order' ? `${PT_TYPES[o.type]} · ${PT_WHY[o.tag]}` : PT_TYPES[o.type]);
    ptCell(tr, ptFmtQty(o.sym, o.qty), 'num'); ptCell(tr, o.lim ? ptPx(o.sym, o.lim) : '—', 'num'); ptCell(tr, o.stp ? ptPx(o.sym, o.stp) : '—', 'num');
    ptCell(tr, o.tp ? ptPx(o.sym, o.tp) : '—', 'num'); ptCell(tr, o.sl ? ptPx(o.sym, o.sl) + (o.trail ? ' ↗' : '') : '—', 'num');
    ptCell(tr, o.type === 'market' ? '—' : o.tif === 'day' ? 'Day' : 'Until cancelled');
    const st = ptCell(tr, ptStatus(o), 'st st-' + o.st); if (o.why) st.title = o.why;
    ptCell(tr, o.fill ? ptPx(o.sym, o.fill) : '—', 'num');
    const acts = el('td', 'act'); const g = el('div', 'tp-acts');
    if (o.st === 'working') g.append(ptBtn('Modify', null, () => ptTicket({ sym: o.sym, mode: 'modify', oid: o.id }), 'Change this order'), ptXBtn(() => { ptCancel(a, o); Paper.changed(); }, 'Cancel this order'));
    acts.append(g); tr.append(acts); body.append(tr);
  }
  box.append(tb);
}
function ptRenderHistory(box, a) {
  const bar = el('div', 'tp-bar'), seg = el('div', 'seg tp-seg');
  [['trades', 'Closed trades'], ['log', 'Account log']].forEach(([k, t]) => seg.append(ptBtn(t, 'btn' + (PT.histView === k ? ' on' : ''), () => { PT.histView = k; ptRenderPanel(true); })));
  bar.append(seg, el('span', 'spacer'));
  const st = ptStats(a);
  if (PT.histView === 'trades' && st.n) bar.append(el('span', 'muted', `${st.n} trade${st.n === 1 ? '' : 's'} · ${Math.round(st.win * 100)}% won · `), el('b', st.net >= 0 ? 'up-t' : 'dn-t', usd(st.net, true)));
  if (PT.histView === 'trades' && a.set.journal === true && st.n) bar.append(ptBtn('Statistics in the Journal', 'ghost sm', () => { JR.f.strategy = ptJournalName(a); setView('journal', true); }));
  box.append(bar);
  if (PT.histView === 'log') {
    if (!a.log.length) { ptEmpty(box, 'Your account activity shows here.'); return; }
    const ul = el('ul', 'tp-log');
    a.log.slice().reverse().forEach(l => { const li = el('li', 'k-' + l.k); li.append(el('time', null, ptWhen(l.t)), el('span', null, l.m)); ul.append(li); });
    box.append(ul); return;
  }
  if (!a.hist.length) { ptEmpty(box, 'Trades you close show here with their profit or loss.'); return; }
  const { box: tb, body } = ptTable(['Closed', 'Symbol', 'Side', ['Qty', 'num'], ['Entry', 'num'], ['Exit', 'num'], ['P&L', 'num'], ['Fees', 'num'], ['Held', 'num'], 'Reason']);
  a.hist.slice().reverse().forEach(h => {
    const tr = el('tr'); ptCell(tr, ptWhen(h.end), 'muted'); ptSymCell(tr, h.sym); ptSidePill(tr, h.side);
    ptCell(tr, ptFmtQty(h.sym, h.qty), 'num'); ptCell(tr, ptPx(h.sym, h.entry), 'num'); ptCell(tr, ptPx(h.sym, h.exit), 'num');
    ptCell(tr, usd(h.pnl, true), 'num ' + (h.pnl > 0 ? 'up-t' : h.pnl < 0 ? 'dn-t' : '')); ptCell(tr, h.fees ? usd(h.fees) : '—', 'num'); ptCell(tr, fmtHeld((h.end - h.at) / 1000), 'num'); ptCell(tr, PT_WHY[h.why] || '');
    body.append(tr);
  });
  box.append(tb);
}
function ptRenderAccount(box, a, m) {
  const st = ptStats(a);
  // which account, and the others
  const head = el('div', 'tp-ahead');
  const nm = el('input', 'field tp-aname'); nm.value = a.name; nm.maxLength = 30; nm.setAttribute('aria-label', 'Account name');
  nm.onchange = () => { const v = nm.value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 30); if (!v || PT.s.accts.some(x => x !== a && x.name.toLowerCase() === v.toLowerCase())) { toast(!v ? 'Give the account a name.' : 'You already have an account with that name.'); nm.value = a.name; return; } ptLog(a, `Renamed from ${a.name} to ${v}.`, 'info'); a.name = v; Paper.changed(); };
  nm.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') nm.blur(); });
  head.append(nm, el('span', 'chip' + (a.kind === 'replay' ? ' live' : ''), a.kind === 'replay' ? 'Bar replay' : 'Live prices'), el('span', 'muted', `Started with ${usd(a.start)} · opened ${new Date(a.at).toLocaleDateString()}`), el('span', 'spacer'),
    ptBtn('New account…', 'ghost sm', () => ptNewAcctDlg(a.kind)));
  box.append(head);
  const k = el('div', 'tp-kpis');
  const tile = (key, v, cls, sub) => { const d = el('div', 'tp-tile'); d.append(el('p', 'k', key), el('p', 'v ' + (cls || ''), v)); if (sub) d.append(el('p', 's', sub)); k.append(d); };
  tile('Equity', usd(m.equity), null, `Started with ${usd(a.start)}`);
  tile('Balance', usd(a.bal), null, 'Cash, with closed trades');
  tile('Realised P&L', usd(m.realized, true), m.realized > 0 ? 'up-t' : m.realized < 0 ? 'dn-t' : '', fmtPct((m.realized / a.start) * 100) + ' since the start');
  tile('Open P&L', usd(m.upl, true), m.upl > 0 ? 'up-t' : m.upl < 0 ? 'dn-t' : '', `${a.pos.length} open position${a.pos.length === 1 ? '' : 's'}`);
  tile('Margin in use', usd(m.margin), null, `${usd(m.avail)} available`);
  tile('Win rate', st.win == null ? '—' : Math.round(st.win * 100) + '%', null, `${st.n} closed trade${st.n === 1 ? '' : 's'}`);
  tile('Profit factor', st.pf == null ? '—' : st.pf === Infinity ? '∞' : st.pf.toFixed(2), null, 'Gross profit ÷ gross loss');
  box.append(k);
  // all accounts at a glance
  if (PT.s.accts.length > 1) {
    const { box: tb, body } = ptTable(['Account', 'Type', ['Started with', 'num'], ['Equity', 'num'], ['Return', 'num'], ['Trades', 'num'], 'Journal', ['', 'act']]);
    tb.classList.add('tp-accts');
    PT.s.accts.forEach(x => {
      const mx = ptMetrics(x), tr = el('tr'); if (x === a) tr.className = 'cur';
      const nc = el('td', 'nm'); nc.append(el('b', null, x.name)); if (x === a) nc.append(el('span', 'chip live', 'In use')); tr.append(nc);
      ptCell(tr, x.kind === 'replay' ? 'Bar replay' : 'Live prices'); ptCell(tr, usd(x.start), 'num'); ptCell(tr, usd(mx.equity), 'num');
      const ret = ((mx.equity - x.start) / x.start) * 100; ptCell(tr, fmtPct(ret), 'num ' + (ret > 0 ? 'up-t' : ret < 0 ? 'dn-t' : '')); ptCell(tr, String(x.hist.length), 'num');
      ptCell(tr, x.set.journal === true ? 'Added' : x.set.journal === false ? 'Separate' : 'Not chosen', 'muted');
      const acts = el('td', 'act'), g = el('div', 'tp-acts');
      const usable = x.kind === (R.on ? 'replay' : 'live');
      if (x !== a && usable) g.append(ptBtn('Use', null, () => ptSwitch(x.id), `Trade in ${x.name}`));
      g.append(ptXBtn(() => ptDeleteAcct(x), `Delete ${x.name}`));
      acts.append(g); tr.append(acts); body.append(tr);
    });
    box.append(tb);
  }
  const set = el('div', 'tp-set');
  const lev = el('fieldset', 'tp-lev'); lev.append(el('legend', null, `Leverage · ${a.name}`));
  PT_MKTS.forEach(([key, name]) => {
    const lab = el('label'); lab.append(el('span', null, name)); const w = el('span', 'selwrap'), sel = el('select');
    PT_LEVS.forEach(v => { const o = el('option', null, '1:' + v); o.value = String(v); sel.append(o); }); sel.value = String(a.set.lev[key]);
    sel.onchange = () => { a.set.lev[key] = +sel.value; ptLog(a, `Leverage for ${name.toLowerCase()} set to 1:${sel.value}.`, 'info'); Paper.changed(); };
    w.append(sel); lab.append(w); lev.append(lab);
  });
  const opts = el('fieldset', 'tp-opts'); opts.append(el('legend', null, 'Trading'));
  const cl = el('label', 'tp-comm'); cl.append(el('span', null, `Commission (% of each trade) · ${a.name}`));
  const ci = el('input', 'field'); ci.inputMode = 'decimal'; ci.value = String(a.set.comm); ci.setAttribute('aria-label', 'Commission percent');
  ci.onchange = () => { const v = ptNum(ci.value); if (v == null || v < 0 || v > 5) { toast('Commission must be between 0 and 5%.'); ci.value = String(a.set.comm); return; } a.set.comm = v; Paper.changed(); };
  cl.append(ci); opts.append(cl);
  const jr = el('div', 'tp-jr'); jr.append(el('span', null, `Add ${a.name}'s closed trades to the Journal`));
  const jseg = el('div', 'seg tp-seg');
  [[true, 'Yes'], [false, 'No']].forEach(([v, t]) => jseg.append(ptBtn(t, 'btn' + (a.set.journal === v ? ' on' : ''), () => { a.set.journal = v; ptLog(a, v ? 'Closed trades will be added to the Journal.' : 'Closed trades are kept out of the Journal.', 'info'); Paper.changed(); })));
  jr.append(jseg); if (a.set.journal == null) jr.append(el('span', 'muted', `Not chosen yet: you'll be asked at the first order`));
  opts.append(jr);
  [['qt', 'Show Buy and Sell buttons on the chart'], ['one', 'One-click trading (the chart buttons place market orders straight away)'], ['lines', 'Show positions and orders on the chart'], ['exec', 'Show executions on the chart'], ['sound', 'Sound when an order fills']].forEach(([key, text]) => {
    const lab = el('label', 'tp-chk'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!PT.s.ui[key];
    cb.onchange = () => { PT.s.ui[key] = cb.checked; Paper.changed(); };
    lab.append(cb, el('span', null, text)); opts.append(lab);
  });
  const reset = el('div', 'tp-reset');
  reset.append(el('p', 'fine', a.kind === 'replay'
      ? 'A replay account trades inside a bar replay: orders fill from the bars as they play. Leaving the replay, stepping back or jumping to another bar closes its positions at the last replayed price.'
      : 'Paper trading uses virtual money on live prices. Orders fill while RealChart is open; when you come back, orders and stops that would have filled while it was closed are filled from the price history. Real trading can fill differently (slippage, spreads, partial fills).'),
    ptBtn('Reset account…', 'danger', () => ptConfirm(`Reset ${a.name}`, 'This closes all positions, cancels all orders and clears the history, then starts again with the balance below. Trades already added to your Journal stay there.', 'Reset account', () => {
      const v = ptNum($('#pcBal').value), start = v >= 100 && v <= 1e9 ? Math.round(v * 100) / 100 : a.start;
      Object.assign(a, { start, bal: start, pos: [], ord: [], hist: [], log: [] }); ptLog(a, `Account reset with ${usd(start)}.`, 'info'); Paper.changed(); toast(`${a.name} reset to ${usd(start)}.`);
    }, a.start)));
  set.append(lev, opts, reset); box.append(set);
}

// ----- positions and orders on the chart -----
function ptLabelBox(x, y, parts, col) {   // a label made of segments; returns each segment's box
  octx.font = `600 11px ${FONT_DATA}`;
  const h = 20, pad = 7, out = [];
  let cx = x;
  const widths = parts.map(p => (p.x ? 20 : octx.measureText(p.t).width + pad * 2));
  const w = widths.reduce((s, v) => s + v, 0);
  octx.fillStyle = C.panel; rr(x, y - h / 2, w, h, 4); octx.fill();
  parts.forEach((p, i) => {
    const pw = widths[i];
    if (p.fill) { octx.fillStyle = col; octx.save(); rr(x, y - h / 2, w, h, 4); octx.clip(); octx.fillRect(cx, y - h / 2, pw, h); octx.restore(); }
    if (i) { octx.strokeStyle = alpha(col, 0.5); octx.lineWidth = 1; seg(cx + 0.5, y - h / 2 + 3, cx + 0.5, y + h / 2 - 3); }
    octx.fillStyle = p.fill ? inkOn(col) : p.color || C.fg; octx.textBaseline = 'middle'; octx.textAlign = 'left';
    if (p.x) { octx.strokeStyle = C.muted; octx.lineWidth = 1.5; const c = cx + pw / 2; seg(c - 3.5, y - 3.5, c + 3.5, y + 3.5); seg(c + 3.5, y - 3.5, c - 3.5, y + 3.5); }
    else octx.fillText(p.t, cx + pad, y + 0.5);
    out.push({ x: cx, y: y - h / 2, w: pw, h, part: p.part });
    cx += pw;
  });
  octx.strokeStyle = col; octx.lineWidth = 1; rr(x + 0.5, y - h / 2 + 0.5, w - 1, h - 1, 4); octx.stroke();
  return { boxes: out, w };
}
function ptDraw(m, W, H) {
  PT.hits = [];
  if (!PT.s.ui.lines || R.picking || !S.bars.length) { ptHitsOut(); return; }
  const a = ptA(), id = S.symbol, p = a.pos.find(x => x.sym === id), ords = a.ord.filter(o => o.sym === id && o.st === 'working');
  if (!p && !ords.length) { ptHitsOut(); return; }
  const d = PT.drag, q = ptQuoteFor(a, id), conv = ptConv(id), prec = S.prec;
  const lines = [];
  const pnlAt = (price, qty, entry) => (price - entry) * qty * conv;
  if (p) {
    const long = p.qty > 0, mark = q ? (long ? q.bid : q.ask) : p.avg, pl = pnlAt(mark, p.qty, p.avg);
    lines.push({ price: p.avg, col: C.draw, dash: [], kind: 'pos', ref: p, parts: [{ t: `${long ? 'Long' : 'Short'} ${ptFmtQty(id, p.qty)}`, fill: true, part: 'body' }, { t: usd(pl, true), color: pl >= 0 ? C.up : C.down, part: 'body' }, { x: true, part: 'close' }] });
    const br = (kind, price) => {
      if (price == null) return;
      const v = pnlAt(price, p.qty, p.avg), c = kind === 'tp' ? C.up : C.down;
      lines.push({ price, col: c, dash: [5, 4], kind, ref: p, parts: [{ t: kind === 'tp' ? 'TP' : p.trail ? 'Trailing SL' : 'SL', fill: true, part: 'body' }, { t: `${usd(v, true)} · ${fmtPct(((price - p.avg) / p.avg) * 100 * Math.sign(p.qty))}`, color: v >= 0 ? C.up : C.down, part: 'body' }, { x: true, part: 'close' }] });
    };
    const tp = d && d.kind === 'tp' && d.ref === p && d.moved ? d.price : p.tp, sl = d && d.kind === 'sl' && d.ref === p && d.moved ? d.price : p.sl;
    br('tp', tp); br('sl', sl);
    if (d && d.kind === 'pos' && d.ref === p && d.moved && d.price != null) {   // dragging out a new take profit or stop loss from the position
      const isTp = long ? d.price > p.avg : d.price < p.avg; br(isTp ? 'tp' : 'sl', d.price);
    }
  }
  for (const o of ords) {
    const buy = o.side === 'buy', col = buy ? C.up : C.down, mv = d && d.kind === 'ord' && d.ref === o && d.moved;
    const pr = o.type === 'stop' || (o.type === 'stoplimit' && !o.trig) ? o.stp : o.lim;
    const price = mv ? d.price : pr;
    if (price == null) continue;   // a market order waiting for the market to open
    const tName = o.type === 'stoplimit' ? (o.trig ? 'Limit' : 'Stop limit') : PT_TYPES[o.type];
    lines.push({ price, col, dash: [2, 3], kind: 'ord', ref: o, parts: [{ t: `${ptSideWord(o.side)} ${tName} ${ptFmtQty(id, o.qty)}`, fill: true, part: 'body' }, { t: fmtP(price, prec), color: C.fg, part: 'body' }, { x: true, part: 'close' }] });
    if (o.type === 'stoplimit' && !o.trig && o.lim) lines.push({ price: mv ? o.lim + (d.price - o.stp) : o.lim, col: alpha(col, 0.6), dash: [1, 4], kind: 'none', parts: null });
    const ob = (kind, bp) => { if (bp == null) return; const mvb = d && d.kind === 'o' + kind && d.ref === o && d.moved; lines.push({ price: mvb ? d.price : bp, col: alpha(kind === 'tp' ? C.up : C.down, 0.7), dash: [1, 3], kind: 'o' + kind, ref: o, parts: [{ t: kind === 'tp' ? 'TP' : 'SL', fill: true, part: 'body' }, { t: fmtP(mvb ? d.price : bp, prec), color: C.muted, part: 'body' }, { x: true, part: 'close' }] }); };
    ob('tp', o.tp); ob('sl', o.sl);
  }
  // lines, then labels on top (nudged apart when they would overlap), then the price tags on the scale
  const placed = [];
  for (const L of lines) L.y = m.y(L.price);
  const vis = lines.filter(L => L.y != null && isFinite(L.y));
  for (const L of vis) {
    if (L.y < -20 || L.y > H + 20) continue;
    octx.strokeStyle = L.col; octx.lineWidth = L.kind === 'pos' ? 1.5 : 1; octx.setLineDash(L.dash); seg(0, Math.round(L.y) + 0.5, W, Math.round(L.y) + 0.5); octx.setLineDash([]);
  }
  // labels line up in one column, left of the price tags, and step around the chart's Buy/Sell buttons
  octx.font = `600 11px ${FONT_DATA}`;
  const widthOf = parts => parts.reduce((s, pt) => s + (pt.x ? 20 : octx.measureText(pt.t).width + 14), 0);
  const maxW = Math.max(0, ...vis.filter(L => L.parts).map(L => widthOf(L.parts)));
  const lx0 = Math.max(8, W - 92 - maxW), qb = ptQtBox();
  vis.slice().sort((x, y) => x.y - y.y).forEach(L => {
    if (!L.parts) return;
    let ly = clamp(L.y, 12, H - 12);
    for (const pY of placed) if (Math.abs(pY - ly) < 22) ly = pY + 22;
    placed.push(ly);
    const w = widthOf(L.parts); let lx = lx0;
    if (qb && ly - 10 < qb.y + qb.h + 4 && lx + w > qb.x - 6) lx = Math.max(8, qb.x - 8 - w);
    const lab = ptLabelBox(lx, ly, L.parts, L.kind === 'pos' ? C.draw : L.col);
    lab.boxes.forEach(b => PT.hits.push(Object.assign(b, { kind: L.kind, ref: L.ref, lineY: L.y })));
    PT.hits.push({ x: 0, y: L.y - 4, w: W, h: 8, part: 'line', kind: L.kind, ref: L.ref, lineY: L.y });
  });
  for (const L of vis) if (L.y >= 0 && L.y <= H && L.parts) priceTag(W, L.y, L.price, L.kind === 'pos' ? C.draw : L.col);
  ptHitsOut();
}
function ptQtBox() {
  const b = $('#qt'); if (!b || b.hidden || !b.offsetWidth) return null;
  const r = b.getBoundingClientRect(), w = wrap.getBoundingClientRect();
  return { x: r.left - w.left, y: r.top - w.top, w: r.width, h: r.height };
}
function ptHitsOut() {   // where the lines and labels are, for the automated tests
  const v = PT.hits.map(h => [h.kind, h.part, Math.round(h.x), Math.round(h.y), Math.round(h.w), Math.round(h.h)].join(',')).join(';');
  if (ov.dataset.pt !== v) ov.dataset.pt = v;
}
function ptHit(x, y) {
  if (!PT.hits.length || S.tool !== 'cursor' || S.draft || R.picking) return null;
  let best = null;
  for (const h of PT.hits) {
    if (x < h.x || x > h.x + h.w || y < h.y || y > h.y + h.h) continue;
    if (h.part === 'close' || h.part === 'body') return h;   // labels win over lines
    if (!best || Math.abs(h.lineY - y) < Math.abs(best.lineY - y)) best = h;
  }
  return best;
}
function ptPointerDown(e, x, y) {
  const h = ptHit(x, y); if (!h) return false;
  e.stopPropagation(); e.preventDefault();
  if (h.part === 'close') { ptLineClose(h); return true; }
  PT.drag = { kind: h.kind, ref: h.ref, sx: x, sy: y, moved: false, price: null, click: h.part === 'body' };
  return true;
}
function ptPointerMove(e) {
  const d = PT.drag; if (!d) return;
  const r = wrap.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (!d.moved && Math.hypot(x - d.sx, y - d.sy) < 4) return;
  const m = mapper(); if (!m) return;
  const p = m.p(y); if (p == null || !(p > 0)) return;
  d.moved = true; d.price = Number(p.toFixed(S.prec)); markDirty();
}
function ptPointerUp() {
  const d = PT.drag; if (!d) return; PT.drag = null;
  if (!d.moved) { if (d.click) ptLineOpen(d); markDirty(); return; }
  const v = d.price, a = ptA(); let err = '';
  if (d.kind === 'pos' || d.kind === 'tp' || d.kind === 'sl') {
    const p = a.pos.find(x => x === d.ref); if (!p) { markDirty(); return; }
    const long = p.qty > 0;
    const kind = d.kind === 'pos' ? ((long ? v > p.avg : v < p.avg) ? 'tp' : 'sl') : d.kind;
    err = ptBracketErr(a, p, kind, v);
    if (!err) {
      if (kind === 'tp') p.tp = v; else { p.sl = v; if (p.trail) p.trail = Math.abs(ptMark(a, p) - v); }
      ptLog(a, `${label(p.sym)} position: ${kind === 'tp' ? 'take profit' : p.trail ? 'trailing stop' : 'stop loss'} moved to ${ptPx(p.sym, v)}.`, 'info');
    }
  } else if (d.kind === 'ord' || d.kind === 'otp' || d.kind === 'osl') {
    const o = a.ord.find(x => x === d.ref && x.st === 'working'); if (!o) { markDirty(); return; }
    const spec = { sym: o.sym, side: o.side, type: o.type, qty: o.qty, lim: o.lim, stp: o.stp, tp: o.tp, sl: o.sl };
    if (d.kind === 'ord') { if (o.type === 'stop') spec.stp = v; else if (o.type === 'limit' || o.trig) spec.lim = v; else { spec.lim = Number((o.lim + (v - o.stp)).toFixed(S.prec)); spec.stp = v; } }
    else if (d.kind === 'otp') spec.tp = v; else spec.sl = v;
    if (o.trig) spec.type = 'limit';
    err = ptCheckOrder(a, spec);
    if (!err) { o.lim = spec.lim; o.stp = spec.stp; o.tp = spec.tp; o.sl = spec.sl; if (o.trail && spec.sl) o.trail = Math.abs((o.type === 'stop' ? o.stp : o.lim) - spec.sl); o.upd = ptNow(a); ptLog(a, `Modified: ${ptDesc(o)}.`, 'info');
      if ((a.kind === 'replay' || PT.leader) && ptCanFill(a, o.sym)) { const q = ptQuoteFor(a, o.sym); if (q) ptEval(a, o.sym, q, ptNow(a), false); } }
  }
  if (err) toast(err);
  Paper.changed();
}
function ptLineClose(h) {
  const a = ptA();
  if (h.kind === 'pos') { const p = a.pos.find(x => x === h.ref); if (p) ptCloseNow(a, p); return; }
  if (h.kind === 'tp' || h.kind === 'sl') { const p = a.pos.find(x => x === h.ref); if (!p) return; if (h.kind === 'tp') p.tp = null; else { p.sl = null; p.trail = null; } ptLog(a, `${label(p.sym)} position: ${h.kind === 'tp' ? 'take profit' : 'stop loss'} removed.`, 'info'); Paper.changed(); return; }
  if (h.kind === 'ord') { ptCancel(a, h.ref); Paper.changed(); return; }
  if (h.kind === 'otp' || h.kind === 'osl') { const o = h.ref; if (h.kind === 'otp') o.tp = null; else { o.sl = null; o.trail = null; } o.upd = ptNow(a); Paper.changed(); }
}
function ptLineOpen(d) {
  const a = ptA();
  if (d.kind === 'pos' || d.kind === 'tp' || d.kind === 'sl') { const p = a.pos.find(x => x === d.ref); if (p) ptTicket({ sym: p.sym, mode: 'pos', pid: p.id }); }
  else if (d.kind === 'ord' || d.kind === 'otp' || d.kind === 'osl') { const o = d.ref; if (o && o.st === 'working') ptTicket({ sym: o.sym, mode: 'modify', oid: o.id }); }
}

// ----- right-click menu on the chart -----
function ptMenuAt(e) {
  if (curView() !== 'chart' || R.picking || S.tool !== 'cursor') return;
  const r = wrap.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  let ps; try { ps = chart.paneSize(0); } catch (er) { return; }
  if (x < 0 || y < 0 || x > ps.width || y > ps.height) return;
  const m = mapper(); if (!m) return;
  const raw = m.p(y); if (raw == null || !(raw > 0)) return;
  e.preventDefault();
  const a = ptA(), id = S.symbol, price = Number(raw.toFixed(S.prec)), q = ptQuoteFor(a, id), ok = ptTradable(a, id), qty = ptQtQty(), menu = $('#ctxMenu');
  menu.replaceChildren();
  const item = (text, fn, cls, dis) => { const b = el('button', 'ctx-i' + (cls ? ' ' + cls : ''), text); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.disabled = !!dis; b.onclick = () => { menu.hidden = true; fn(); }; menu.append(b); };
  menu.append(el('div', 'ctx-h', `${label(id)} at ${fmtP(price, S.prec)}${R.on ? ' · replay' : ''}`));
  if (!ok) menu.append(el('div', 'ctx-note', `${label(id)} isn't live right now, so it can't be traded.`));
  else if (q) {
    const below = price < q.last, qs = ptFmtQty(id, qty);
    if (below) { item(`Buy ${qs} limit at ${fmtP(price, S.prec)}`, () => ptPlace(a, { sym: id, side: 'buy', type: 'limit', qty, lim: price }), 'buy'); item(`Sell ${qs} stop at ${fmtP(price, S.prec)}`, () => ptPlace(a, { sym: id, side: 'sell', type: 'stop', qty, stp: price }), 'sell'); }
    else { item(`Sell ${qs} limit at ${fmtP(price, S.prec)}`, () => ptPlace(a, { sym: id, side: 'sell', type: 'limit', qty, lim: price }), 'sell'); item(`Buy ${qs} stop at ${fmtP(price, S.prec)}`, () => ptPlace(a, { sym: id, side: 'buy', type: 'stop', qty, stp: price }), 'buy'); }
    item('New order at this price…', () => ptTicket({ sym: id, side: below ? 'buy' : 'sell', type: 'limit', price, qty }));
  }
  if (!R.on) { menu.append(el('div', 'ctx-sep')); item(`Add alert at ${fmtP(price, S.prec)}`, () => createAlert(id, price)); }
  menu.hidden = false;
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = clamp(e.clientX, 8, innerWidth - w - 8) + 'px'; menu.style.top = clamp(e.clientY, 8, innerHeight - h - 8) + 'px';
  const first = menu.querySelector('button:not(:disabled)'); if (first) first.focus({ preventScroll: true });
}

/* ---------- home page ----------
   The first thing people see at the site's address: what RealChart does, a picture of it, live markets, the day's
   crypto movers, the latest community ideas and the features. Shared chart links (?s=…) still open the chart. */
const HOME_TILES = ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT', 'BINANCE:SOLUSDT', 'FX:XAU/USD', 'FX:EUR/USD', 'FX:SPX500/USD', 'FX:NAS100/USD', 'FX:WTICO/USD'];
const HOME_NAMES = { 'BINANCE:BTCUSDT': 'Bitcoin', 'BINANCE:ETHUSDT': 'Ethereum', 'BINANCE:SOLUSDT': 'Solana', 'FX:XAU/USD': 'Gold', 'FX:EUR/USD': 'Euro / US dollar', 'FX:SPX500/USD': 'S&P 500', 'FX:NAS100/USD': 'Nasdaq 100', 'FX:WTICO/USD': 'WTI crude oil' };
const HOME_MOVERS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'LINK', 'AVAX', 'LTC', 'DOT', 'TRX', 'SUI', 'NEAR', 'ATOM', 'UNI', 'APT', 'ARB', 'OP', 'BCH', 'AAVE', 'XLM', 'PEPE', 'SHIB', 'INJ', 'FET', 'RENDER', 'WIF', 'ENA', 'TAO', 'HBAR', 'FIL'].map(c => c + 'USDT');
const HOME_ICON = {
  chart: '<path d="M4 19h16"/><path d="M7 15V9M7 9V6M12 16v-6M12 10V5M17 14v-3M17 11V8"/><rect x="5.5" y="9" width="3" height="5" rx=".6"/><rect x="10.5" y="10" width="3" height="5" rx=".6"/><rect x="15.5" y="11" width="3" height="3" rx=".6"/>',
  paper: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
  replay: '<path d="M11.5 7l-6 5 6 5z"/><path d="M19.5 7l-6 5 6 5z"/>',
  journal: '<path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2z"/><path d="M6 18a2 2 0 0 1 2-2h11"/><path d="M10 8h6M10 11h4"/>',
  ideas: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  alert: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
};
const homeSvg = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${HOME_ICON[n]}</svg>`;
const Home = {
  built: false, spark: {}, sparkAt: {}, moversAt: 0, ideasAt: 0, timer: null,
  symbols() { return curView() === 'home' && S.ready ? HOME_TILES : []; },
  show() {
    if (!this.built) this.build();
    if (!S.ready) return;   // the rest waits for the market data to connect (see ready)
    ensureTickerSubs(); this.tiles(); this.loadSparks(); this.movers(); this.ideas();
    clearInterval(this.timer); this.timer = setInterval(() => { if (curView() !== 'home') { clearInterval(this.timer); return; } this.movers(); this.loadSparks(); }, 60000);
  },
  ready() { if (curView() === 'home') this.show(); },
  build() {
    this.built = true;
    const box = $('#hTiles');
    HOME_TILES.forEach(id => {
      const b = el('button', 'h-tile'); b.type = 'button'; b.dataset.sym = id; b.title = `Open ${label(id)} on the chart`;
      const top = el('span', 'h-t-top'); top.append(el('b', null, HOME_NAMES[id] || label(id)), el('span', 'h-t-sym', label(id)));
      const cv = el('canvas'); cv.setAttribute('aria-hidden', 'true');
      b.append(top, el('span', 'h-t-px', '—'), el('span', 'h-t-chg', ''), cv);
      b.onclick = () => this.open(id);
      box.append(b);
    });
    const feats = [
      ['chart', 'Live charts', 'Crypto, US stocks, forex, indices and commodities, with 25 indicators, drawing tools and 8 timeframes.', 'Open the chart', () => this.go('chart')],
      ['paper', 'Paper trading', 'Practise with virtual money on live prices: market, limit and stop orders, take profit and stop loss, several accounts.', 'Start practising', () => this.practise()],
      ['replay', 'Bar replay', 'Rewind the market to any bar and trade it forward, bar by bar, to test your plan without waiting.', 'Try a replay', () => { this.go('chart'); setTimeout(() => rpStartPick(), 300); }],
      ['journal', 'Trade journal', 'Log your trades and see your win rate, profit factor, equity curve and a calendar of your results.', 'Open the journal', () => this.go('journal')],
      ['ideas', 'Community ideas', 'See how other traders read the chart, and publish your own view with your drawings.', 'Browse ideas', () => this.go('ideas')],
      ['alert', 'Alerts and watchlist', 'Keep the markets you follow in one list, and get an alert the moment a price is crossed.', 'Set an alert', () => this.go('chart')],
    ];
    const fb = $('#hFeats');
    feats.forEach(([icon, title, text, cta, fn]) => {
      const c = el('article', 'h-feat'), ic = el('span', 'h-feat-ic'); ic.innerHTML = homeSvg(icon);
      const go = el('button', 'h-feat-go', cta + ' →'); go.type = 'button'; go.onclick = fn;
      c.append(ic, el('h3', null, title), el('p', null, text), go); fb.append(c);
    });
    $('#hSearch').onclick = () => openSearch('open');
    $('#hOpen').onclick = e => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); this.go('chart'); };
    $('#hPaper').onclick = () => this.practise();
    $('#hAllIdeas').onclick = e => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); this.go('ideas'); };
    $('#hMarketsOpen').onclick = e => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); this.go('chart'); };
    new MutationObserver(() => this.redraw()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (mq.addEventListener) mq.addEventListener('change', () => this.redraw());
    window.addEventListener('resize', () => { if (curView() === 'home') this.redraw(); });
  },
  go(v) { if (v === 'ideas') ID.open = null; setView(v, true); window.scrollTo(0, 0); },
  open(id) { setView('chart', true); window.scrollTo(0, 0); if (id !== S.symbol) setSymbol(id); },
  practise() { this.go('chart'); ptSetOpen(true); setTimeout(() => ptTicket({ sym: S.symbol, side: 'buy' }), 200); },
  tiles() { HOME_TILES.forEach(id => this.tile(id)); },
  tile(id) {
    const b = $(`#hTiles .h-tile[data-sym="${id}"]`), t = S.tickers[id]; if (!b) return;
    const px = b.querySelector('.h-t-px'), ch = b.querySelector('.h-t-chg');
    if (!t) { px.textContent = '—'; ch.textContent = ''; return; }
    px.textContent = fmtP(t.last, t.prec || precFor(id, t.last));
    if (t.src === 'demo' || t.stand) { ch.textContent = 'saved price'; ch.className = 'h-t-chg saved'; }
    else { const pct = t.ref ? ((t.last - t.ref) / t.ref) * 100 : NaN; ch.textContent = isFinite(pct) ? fmtPct(pct) : ''; ch.className = 'h-t-chg ' + (pct > 0 ? 'up' : pct < 0 ? 'down' : ''); }
  },
  onTicker(t) { if (curView() === 'home' && this.built && HOME_TILES.includes(t.sym)) this.tile(t.sym); },
  async loadSparks() {   // the last two days, hour by hour
    for (const id of HOME_TILES) {
      if (srcOf(id) === 'demo' || (this.sparkAt[id] && Date.now() - this.sparkAt[id] < 9 * 60000)) continue;
      this.sparkAt[id] = Date.now();
      try { const bars = await feedFor(id).klines(id, '1h'); this.spark[id] = bars.slice(-48).map(b => b.close); this.drawSpark(id); } catch (e) { this.sparkAt[id] = 0; }
    }
  },
  drawSpark(id) {
    const b = $(`#hTiles .h-tile[data-sym="${id}"]`), pts = this.spark[id]; if (!b || !pts || pts.length < 2) return;
    const cv = b.querySelector('canvas'), r = cv.getBoundingClientRect(); if (!r.width) return;
    const d = window.devicePixelRatio || 1; cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
    const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, r.width, r.height);
    const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1, w = r.width, h = r.height - 2;
    const X = i => (i / (pts.length - 1)) * w, Y = v => 1 + h - ((v - lo) / span) * h;
    const col = pts[pts.length - 1] >= pts[0] ? C.up : C.down;
    g.beginPath(); pts.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))));
    g.strokeStyle = col; g.lineWidth = 1.6; g.lineJoin = 'round'; g.stroke();
    g.lineTo(w, h + 1); g.lineTo(0, h + 1); g.closePath();
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, alpha(col, 0.22)); grad.addColorStop(1, alpha(col, 0)); g.fillStyle = grad; g.fill();
  },
  redraw() { if (!this.built) return; requestAnimationFrame(() => HOME_TILES.forEach(id => this.drawSpark(id))); },
  async movers() {
    const card = $('#hMovers');
    if (!S.binance) { card.hidden = true; return; }
    card.hidden = false;
    if (Date.now() - this.moversAt < 50000) return;
    this.moversAt = Date.now();
    let list;
    try { list = await Live.tickers(HOME_MOVERS); } catch (e) { this.moversAt = 0; return; }
    const rows = list.filter(t => t.last > 0 && t.ref > 0).map(t => ({ id: t.sym, last: t.last, pct: ((t.last - t.ref) / t.ref) * 100 })).sort((a, b) => b.pct - a.pct);
    const fill = (sel, items) => {
      const ul = $(sel); ul.replaceChildren();
      items.forEach(x => {
        const li = el('li'), b = el('button', 'h-mv'); b.type = 'button'; b.title = `Open ${label(x.id)} on the chart`;
        const [base] = splitSym(rawOf(x.id));
        b.append(el('b', null, base), el('span', 'nm', COINS[base] || base), el('span', 'px', fmtP(x.last, precFor(x.id, x.last))), el('span', 'pc ' + (x.pct >= 0 ? 'up' : 'down'), fmtPct(x.pct)));
        b.onclick = () => this.open(x.id); li.append(b); ul.append(li);
      });
    };
    fill('#hUp', rows.slice(0, 5)); fill('#hDown', rows.slice(-5).reverse());
  },
  async ideas() {
    const card = $('#hIdeasCard'), box = $('#hIdeas');
    if (!Auth.sb) { card.hidden = true; return; }
    card.hidden = false;
    if (Date.now() - this.ideasAt < 120000 && box.children.length) return;
    this.ideasAt = Date.now();
    try {
      const { data, error } = await Auth.sb.from('ideas').select(IDEA_LIST).eq('hidden', false).order('created_at', { ascending: false }).limit(3);
      if (error) throw error;
      const rows = (data || []).map(r => cleanIdea(r, false)).filter(Boolean);
      box.replaceChildren();
      if (!rows.length) {
        const p = el('div', 'h-empty'); const b = el('button', 'primary', 'Publish the first idea'); b.type = 'button'; b.onclick = () => Ideas.startPublish();
        p.append(el('p', null, 'No ideas yet. Share how you read a chart: open one, draw your levels and publish it.'), b); box.append(p); return;
      }
      rows.forEach(it => box.append(Ideas.card(it)));
      requestAnimationFrame(() => box.querySelectorAll('canvas').forEach(cv => drawThumb(cv, cv._thumb)));
    } catch (e) { this.ideasAt = 0; if (!box.children.length) box.append(el('p', 'h-empty', "Ideas couldn't be loaded right now.")); }
  },
};

/* ---------- boot ---------- */
async function probeTD() {
  if (TD.key === 'site') { try { return (await fetchT(API + '/', 4500)).ok; } catch (e) { return false; } }
  // Any HTTP answer means the page can reach Twelve Data; the public demo key costs nothing.
  try { await fetchT('https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&outputsize=1&apikey=demo', 4500); return true; }
  catch (e) { return false; }
}
async function boot() {
  $('.brand .word').textContent = CFG.siteName; $('.brand').setAttribute('aria-label', CFG.siteName); $('#wmWord').textContent = CFG.siteName;
  renderTools(); renderTf(); renderAlerts(); clockTick();
  createMain();
  (Array.isArray(S.ind) ? S.ind : DEFAULT_IND).map(normInst).filter(Boolean).forEach(addRt);
  saveInd(); applyTheme(); sizeOverlay(); requestAnimationFrame(frame);
  renderWatch(); renderDetails(); renderFeed(); veil('Connecting to market data…');
  Journal.init();
  Paper.boot();
  Auth.init().catch(() => { /* the site works without accounts */ });
  Ideas.boot();
  { const v = readViewFromUrl(); if (v !== 'chart') setView(v); }
  const oandaUp = OANDA.configured() ? OANDA.connect().then(() => true, e => { OANDA.state = e.code === 401 ? 'bad' : 'offline'; return false; }) : Promise.resolve(false);
  const [bin, tdOk, goldOk, oaOk, krOk] = await Promise.all([Live.probe(), probeTD(), GoldApi.price('XAU').then(q => { S.spot.XAU = q; return true; }, () => false), oandaUp, Kraken.probe()]);
  S.binance = bin; S.tdReach = tdOk; S.goldApi = goldOk; S.sandbox = !bin && !tdOk && !goldOk && !oaOk && !krOk;
  if (OANDA.state === 'offline') retryOanda(8000);
  if (goldOk) setInterval(pollMetals, 10000);
  TD.state = !tdOk ? 'offline' : TD.key ? 'ok' : 'nokey';
  S.ready = true;
  $('#snapBtn').hidden = S.sandbox; $('#linkBtn').hidden = S.sandbox;
  updateUrl();
  lastOpenState = ['stock', 'forex'].map(c => isOpenAt(c, Date.now() / 1000)).join();
  renderWatch(); renderDetails(); renderFeed();
  if (tdLive()) TDWS.connect();
  const first = loadChart();   // queue the chart request before the watchlist quotes
  ensureTickerSubs();
  Paper.ready();
  Home.ready();
  await first;
}
boot();
})();
