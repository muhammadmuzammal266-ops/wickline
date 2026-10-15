# Wickline Charts

Free live charts for crypto, US stocks, forex, gold, stock indices, commodities and bonds, in your browser. It has candles, indicators, drawing tools, bar replay, a watchlist, price alerts and optional Google sign-in.

## What's in this folder

| File | What it is |
|---|---|
| `config.js` | **Your settings.** Site name, helper address, accounts, default chart and watchlist. This is the file you'll edit most. Never put a secret key here: everyone can read it. |
| `index.html`, `app.js` | The app. You don't need to touch them to change settings. |
| `vendor/` | The chart library and the sign-in library, served from your own site (with their licences). |
| `privacy.html` | The privacy policy, linked from the sign-in window and the page footer. |
| `oanda-worker.js` | Your Cloudflare helper. It keeps your OANDA token and Twelve Data key secret. See below. |
| `favicon.svg`, `icon-*.png`, `apple-touch-icon.png`, `manifest.webmanifest`, `og-image.png` | Icons, phone home-screen support and the picture shown when someone shares your link. |

## Change a setting (no coding needed)

1. On GitHub, open `config.js` and click the pencil icon (**Edit this file**).
2. Change the value between the quote marks. Keep the quotes and commas.
3. Click **Commit changes**.
4. Your live site updates in about a minute. Refresh the page to see it.

## Where the prices come from

- **Crypto:** Binance public market data (live). Where Binance doesn't answer (for example in the UK and US), the page switches to OKX, then Bybit, automatically.
- **Forex, gold, indices, commodities and bonds:** OANDA, through your Cloudflare helper. Without it, the 12 major forex pairs come from Kraken and gold follows PAX Gold, both live with no key.
- **US stocks and ETFs:** Twelve Data, through your Cloudflare helper.
- When a market can't be reached, the page shows real prices saved when it was built, clearly marked "saved". The older candles on those charts are illustrative.

Market data is for information only and is not financial advice.

## Your Cloudflare helper (keeps your keys secret)

`oanda-worker.js` runs free on Cloudflare. Your secret keys live in its settings, so they never reach visitors' browsers. It only allows reading market data: it can't place trades or see your balance. It also limits how fast any one visitor can call it, and shares answers between visitors so your free allowances last.

### Set it up or update it

1. In Cloudflare, go to **Workers & Pages** and open your Worker (or **Create** one with **Start with Hello World!**, named `wickline-oanda`).
2. Click **Edit code**, replace everything with the whole of `oanda-worker.js` from this repository, and click **Deploy**.
3. In the Worker's **Settings → Variables and Secrets**, add:
   - `OANDA_TOKEN` (type **Secret**): your OANDA token, from hub.oanda.com → Tools → API.
   - `TD_KEY` (type **Secret**): your Twelve Data API key, from your Twelve Data dashboard.
   - `ALLOWED_ORIGIN` (type **Text**): your site address, for example `https://yourname.github.io`.
4. Put the Worker's address (for example `https://wickline-oanda.yourname.workers.dev`) in `proxy` in `config.js`.

Twelve Data's free plan allows 8 requests a minute and 800 a day, shared by every visitor. When it runs out, stocks show their saved price until midnight UTC. A visitor can paste their own free key under **Data sources** (the price badge, top right); it stays in their browser and goes only to Twelve Data.

Before showing OANDA prices to the public, check OANDA's terms. Brokers often license their price data for your own use only.

## Trade journal

The **Journal** tab (top left) is a trading journal. People log each trade (symbol, long or short, entry and exit, size, fees, stop, target, strategy, tags, a 1–5 rating and notes) and the page works out the result, the R-multiple and the holding time. It shows the net result, win rate, profit factor, average win and loss, largest drawdown, an equity curve, a calendar of daily results, and results by symbol and by strategy, with filters. Trades can be exported to and imported from CSV, opened on the chart, and a long or short position drawn on the chart can be added to the journal in one click. Journal trades also appear as markers on the chart.

Signed-in people's journals are kept in their account (the `trades` table in Supabase, private to each person). Without signing in, the journal is kept in the browser and moves into the account at the next sign-in.

## Accounts (Sign in with Google)

People can use the site without signing in. Signing in saves their watchlist, drawings, indicators, alerts, chart settings and trade journal to their account, so they follow them to any device. Accounts live in Supabase, where database rules let each person read and change only their own data. **Delete my account** in the profile menu removes an account and everything saved to it.

The setup has three parts:

1. **Google Cloud** (console.cloud.google.com): an OAuth client of type *Web application*, with your site as an authorized JavaScript origin and `https://<your-project>.supabase.co/auth/v1/callback` as the authorized redirect URI. Publish the app under **Audience** so anyone can sign in.
2. **Supabase** (Authentication): turn on the Google provider with that client's ID and secret. Under URL Configuration, set the Site URL to your site and add `https://yourname.github.io/wickline/**` to the redirect URLs.
3. **config.js:** `supabaseUrl` and `supabaseKey` (the *publishable* key from Supabase's API settings). These two are meant to be public.

## Security

- No secret keys are in this repository or the page. They live in Cloudflare's encrypted settings.
- A strict Content Security Policy only lets the page run its own code and talk to the market-data, helper and account services it uses.
- The chart and sign-in libraries are served from this site, not from a third-party CDN.
- The page refuses to run inside another website's frame.
- Saved data coming back from an account is checked before it's used.
- Keep two-step sign-in turned on for the accounts that control the site: GitHub, Google, Cloudflare, Supabase, OANDA and Twelve Data.

## Change something bigger

- **Rename the site:** change `siteName` in `config.js`. To also change the name in search results and link previews, edit the `<title>` and `og:title` lines near the top of `index.html`.
- **Default watchlist:** edit `defaultWatchlist` in `config.js`. It only applies to first-time visitors, because returning visitors keep their own list.
- **Ticker formats:** crypto as a Binance pair (`BTCUSDT`), US stocks and ETFs as tickers (`AAPL`, `SPY`), forex with a slash (`EUR/USD`, `XAU/USD`), indices, commodities and bonds as OANDA names with a slash (`SPX500/USD`, `WTICO/USD`, `USB10Y/USD`).

## Share a chart

The address bar always matches the chart you're looking at. For example, `?s=AAPL&tf=1d` opens Apple on daily candles. You can also click the link icon, top right, to copy the link.

## Credits

Charts are drawn with [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) (Apache 2.0 licence). The "Charts by TradingView Lightweight Charts" line under the side panel is the attribution its licence asks for, so keep it if you change the page. Sign-in uses [supabase-js](https://github.com/supabase/supabase-js) (MIT licence).
