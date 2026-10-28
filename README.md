# RealChart

Free live charts for crypto, US stocks, forex, gold, stock indices, commodities and bonds, in your browser. It has candles, indicators, drawing tools, bar replay, a watchlist, price alerts, a trade journal, an Ideas page where traders share their analysis, and optional Google sign-in.

## What's in this folder

| File | What it is |
|---|---|
| `config.js` | **Your settings.** Site name, helper address, accounts, default chart and watchlist. This is the file you'll edit most. Never put a secret key here: everyone can read it. |
| `index.html`, `app.js` | The app. You don't need to touch them to change settings. |
| `vendor/` | The chart library and the sign-in library, served from your own site (with their licences). |
| `privacy.html` | The privacy policy, linked from the sign-in window and the page footer. |
| `rules.html` | The community rules for Ideas, linked from the Publish idea window. |
| `helper/` | Your Cloudflare helper (`oanda-worker.js` and its settings file `wrangler.toml`). It keeps your OANDA, Twelve Data and cTrader keys secret. See below. |
| `favicon.svg`, `icon-*.png`, `apple-touch-icon.png`, `manifest.webmanifest`, `og-image.png` | Icons, phone home-screen support and the picture shown when someone shares your link. |

## Change a setting (no coding needed)

1. On GitHub, open `config.js` and click the pencil icon (**Edit this file**).
2. Change the value between the quote marks. Keep the quotes and commas.
3. Click **Commit changes**.
4. Your live site updates in about a minute. Refresh the page to see it.

## Where the prices come from

- **Crypto:** Binance public market data (live). Where Binance doesn't answer (for example in the UK and US), the page switches to OKX, then Bybit, automatically.
- **Forex, gold, indices and commodities:** a cTrader broker's prices, if you set up cTrader on your helper (see below). Markets that broker doesn't offer, and bonds, keep using the next source.
- **Forex, gold, indices, commodities and bonds:** OANDA, through your Cloudflare helper. Without it, the 12 major forex pairs come from Kraken and gold follows PAX Gold, both live with no key.
- **US stocks and ETFs:** Twelve Data, through your Cloudflare helper.
- When a market can't be reached, the page shows real prices saved when it was built, clearly marked "saved". The older candles on those charts are illustrative.

Market data is for information only and is not financial advice.

## Your Cloudflare helper (keeps your keys secret)

`helper/oanda-worker.js` runs free on Cloudflare. Your secret keys live in its settings, so they never reach visitors' browsers. It only allows reading market data: it can't place trades or see your balance. It also limits how fast any one visitor can call it, and shares answers between visitors so your free allowances last.

### Set it up or update it

The cTrader part needs a Cloudflare *Durable Object*, which Cloudflare only creates from code in a repository. So connect the Worker to this GitHub repository once; after that, Cloudflare redeploys the helper by itself whenever the `helper/` folder changes.

1. In Cloudflare, go to **Workers & Pages** and open your Worker `wickline-oanda` (or **Create** one with **Start with Hello World!** and that name).
2. Open **Settings → Build** and click **Connect** next to *Git repository*. Choose GitHub, this repository and the `main` branch.
3. Set **Root directory** to `helper`, leave the build command empty, keep the deploy command `npx wrangler deploy`, and set **Build watch paths** to `helper/*`. Save. The first deploy takes about a minute.
4. In the Worker's **Settings → Variables and Secrets**, add:
   - `OANDA_TOKEN` (type **Secret**): your OANDA token, from hub.oanda.com → Tools → API.
   - `TD_KEY` (type **Secret**): your Twelve Data API key, from your Twelve Data dashboard.
   - `ALLOWED_ORIGIN` (type **Text**): your site address, for example `https://realchart.trade`.
5. Put the Worker's address (for example `https://wickline-oanda.yourname.workers.dev`) in `proxy` in `config.js`.

Without cTrader, you can instead click **Edit code**, paste the whole of `helper/oanda-worker.js` and click **Deploy**; the cTrader part then stays switched off.

Twelve Data's free plan allows 8 requests a minute and 800 a day, shared by every visitor. When it runs out, stocks show their saved price until midnight UTC. A visitor can paste their own free key under **Data sources** (the price badge, top right); it stays in their browser and goes only to Twelve Data.

Before showing OANDA prices to the public, check OANDA's terms. Brokers often license their price data for your own use only.

### cTrader prices (optional)

With cTrader, forex, gold, indices and commodities come from a broker's live prices, with full candle history, through the free cTrader Open API.

1. Sign in at [openapi.ctrader.com](https://openapi.ctrader.com) with your cTrader ID and register an application. Spotware reviews it and emails you when it's approved.
2. On the approved application, open **Playground**, choose the **Accounts** scope (view only) and click **Get token**. Keep that page open.
3. In the Worker's **Settings → Variables and Secrets**, add these as type **Secret**:
   - `CT_CLIENT_ID` and `CT_CLIENT_SECRET`: from your application's page.
   - `CT_REFRESH_TOKEN`: the refresh token from the Playground. (`CT_ACCESS_TOKEN`, the access token, is optional.)
   - Optional, type **Text**: `CT_ACCOUNT`, the account number to read prices from. Otherwise the first account is used.
4. Open `https://<your helper address>/ct/status`. It should say `"ok":true` and name your broker.

Visitors' pages pick it up by themselves within the hour.

How it works:
- **One connection for everyone.** Spotware asks apps to keep at most one connection per server, so the helper holds a single connection and passes prices to every visitor.
- **Tokens renew themselves.** cTrader tokens last 30 days and change each time they're renewed, so the helper renews them and keeps the newest pair. Paste a new refresh token only if you revoke the app's access.
- **It fits the free plan.** While someone is watching, the connection stays open, which uses about 10,800 of Cloudflare's 13,000 free daily GB-seconds if someone watches all day. With nobody watching for 10 minutes, it disconnects.
- **Unmatched markets keep their usual source.** Brokers name markets differently (for example `US500` for the S&P 500). The page matches the common names, and anything it can't match, or whose price doesn't fit, keeps using OANDA or the next source.

Before showing a broker's prices to the public, get the broker's written permission. Asking as its partner (an introducing broker) helps.

## Timeframes and chart types

The timeframe bar has 1m to 1W. The arrow at its end opens every timeframe: 3m, 45m, 2h, 3h, 6h, 8h, 12h, 3D, 1M and more, plus any length typed in (for example 90 minutes or 2 weeks). A star keeps a timeframe on the bar. Timeframes a price source doesn't offer are built from its shorter candles (45m from 15m, 1M from days), and the newest bar is rebuilt exactly as each live candle changes.

Crypto charts from Binance also have seconds: 1s, 5s, 15s, 30s, or any number of seconds typed in. They're built from Binance's 1-second candles. Other markets' sources start at 1 minute, so a seconds chart switches to 1m when you open one of them.

The download button next to the camera saves the chart's bars, with the values of the indicators on it, as a CSV file. It works for crypto charts; the price sources for other markets don't allow their prices to be downloaded.

The chart type menu has 14 types: bars, candles, hollow candles, Heikin Ashi, columns, line, line with markers, step line, area, baseline, and four that ignore time: Renko, Line break, Kagi and Point & figure. Their box size is automatic (the average true range of the last 14 candles) or set with the gear button next to the menu. Indicators are worked out on what is drawn. Bar replay needs a time-based type.

## Chart layouts

The **Layout** button shows 1, 2, 3, 4, 6, 8 or 16 charts at once. Each extra chart has its own symbol (click its name to search) and timeframe, a live price and volume. The arrow button, or a double-click, swaps that chart with the main one, where the drawing tools, indicators and trading are. The layout is remembered, and kept in the account for signed-in people. On phones the charts stack one under another.

## Indicators

The **Indicators** button lists 67 indicators in five groups, with a search box:

- **Moving averages:** SMA, EMA, WMA, Hull, Double EMA, Triple EMA, Smoothed, Volume Weighted, Arnaud Legoux, Least Squares, McGinley Dynamic, Moving Average Ribbon, Envelope.
- **Trend:** Ichimoku Cloud, Parabolic SAR, SuperTrend, ADX/DMI, Aroon, Vortex, Williams Alligator, Choppiness Index, Zig Zag, Williams Fractals.
- **Oscillators:** RSI, MACD, Stochastic, Stochastic RSI, CCI, Williams %R, Rate of Change, Awesome Oscillator, Detrended Price Oscillator, TRIX, Price Oscillator, Ultimate Oscillator, True Strength Index, Momentum, Balance of Power, Chande Momentum, Coppock Curve, Know Sure Thing, Fisher Transform, Relative Vigor Index, Bull Bear Power, Connors RSI.
- **Volatility:** Bollinger Bands, Keltner Channels, Donchian Channels, ATR, Bollinger BandWidth, Bollinger Bands %B, Standard Deviation, Historical Volatility, Mass Index.
- **Volume:** Volume, VWAP, On Balance Volume, Money Flow Index, Chaikin Money Flow, Accumulation/Distribution, Chaikin Oscillator, Price Volume Trend, Ease of Movement, Volume Oscillator, Klinger Oscillator, Elder Force Index, Volume Profile (visible range).

Up to 50 can be on a chart. Each can be shown, hidden, recoloured or set up from its name on the chart, and the formulas follow the usual TradingView defaults. With many indicators on the chart, the list of names can be folded away with the small arrow under them.

## Drawing tools

The toolbar on the left has 29 drawing tools, plus the price alert tool. The main ones sit on the bar; the rest open from small groups next to them:

- **Lines:** trend line, ray, horizontal line, extended line, info line, arrow, horizontal ray, vertical line, cross line.
- **Shapes:** rectangle, ellipse, triangle, brush, highlighter.
- **Fibonacci, channels and pitchforks:** Fib retracement, trend-based Fib extension, Fib time zones, parallel channel, regression trend, pitchfork.
- **Text and marks:** text, price label, arrow marks up and down.
- **Measuring and ranges:** measure, date range, price range, long and short positions.

Drawings are saved with the chart and can go into published ideas.

## Watchlists and alerts

People can keep up to 20 watchlists. Click the watchlist's name to switch, make a new one, copy, rename or delete one. Up to 1,000 price alerts can be set; they're checked while the site is open.

## Trade journal

The **Journal** tab (top left) is a trading journal. People log each trade (symbol, long or short, entry and exit, size, fees, stop, target, strategy, tags, a 1–5 rating and notes) and the page works out the result, the R-multiple and the holding time. It shows the net result, win rate, profit factor, average win and loss, largest drawdown, an equity curve, a calendar of daily results, results by symbol and by strategy, long and short, by day of the week and by trading session, habits (streaks, time in winners and losers, best and worst day) and a monthly report, all with filters. **Report (PDF)** makes a printable report of the trades shown, saved as a PDF from the browser's Print window. Trades can be exported to and imported from CSV, opened on the chart, and a long or short position drawn on the chart can be added to the journal in one click. Journal trades also appear as markers on the chart.

Signed-in people's journals are kept in their account (the `trades` table in Supabase, private to each person). Without signing in, the journal is kept in the browser and moves into the account at the next sign-in.

## Paper trading

Practise trading with virtual money, like TradingView's paper trading. Everything is in the page; nothing goes to a broker.

- **Accounts:** people can keep up to 20 paper accounts, each with its own name and starting balance (from $100 to $1,000,000,000, with quick picks from $1K to $1M), its own leverage and commission. The account button at the left of the trading panel switches between them or makes a new one; the Account tab lists them all with their equity and return, and can rename, reset or delete them. Live-price accounts trade on live prices; bar replay accounts trade inside a bar replay.
- **Prop challenge:** a live-price account can be a prop challenge, like a prop firm's evaluation: a profit target, a daily loss limit, a maximum loss, minimum trading days and an optional time limit (presets: two-step phase 1 and 2, one-step; or custom). Losses count open trades, and the daily limit runs from the equity at the start of each day (00:00 UTC). Breaking a limit closes the positions and ends the challenge; reaching the target on enough trading days passes it. The Account tab shows each rule's progress.
- **The Journal question:** the first order in an account (or the new-account form) asks whether that account's closed trades go into the Journal. If yes, they're added with the tag "Paper" (and "Replay" for replay accounts) and the strategy "Paper · account name", so the Journal's statistics and filters cover them. It can be changed in the Account tab.
- **Placing orders:** the **Buy** and **Sell** buttons at the top right of the chart (with a quantity box), the **Trade** button in the top bar, **Shift B** / **Shift S**, or a right-click on a price for a limit or stop order there. The order ticket has market, limit, stop and stop-limit orders, a take profit and stop loss in price, pips (or ticks), % or $, a trailing stop, "size by risk" (works out the quantity from what you'd lose at the stop), Day or Until-cancelled duration, and shows the order value, margin and reward to risk. One-click trading can be turned on in the Account tab.
- **On the chart:** the position, its take profit and stop loss, and working orders are drawn as lines with their profit or loss. Drag a line to change it, drag the position line up or down to add a take profit or stop loss, click × to close or cancel, click a label to edit. Fills show as arrows.
- **The trading panel** under the chart: Positions (with live P&L, TP/SL, partial close, break-even, reverse and close), Orders (working, filled, cancelled, with modify and cancel), History (closed trades and an account log) and Account (figures, the list of accounts, leverage for each market, commission, the Journal choice, display options, and Reset with any starting balance).
- **Bar replay trading:** while a replay runs, trades go to a replay account and fill from the replayed bars as they play (dated at the replayed time). Leaving the replay, stepping back, jumping to another bar or switching symbol closes the replay positions at the last replayed price.
- **How it works:** one position per symbol (buys and sells net out). Buys fill at the ask and sells at the bid where the data has them. Positions are valued in US dollars (other currencies are converted with live rates). If equity falls below half the margin in use, the biggest losers are closed (a margin call). Live orders fill while RealChart is open; when it's opened again, orders and stops the price reached in the meantime are filled from the price history, at the time they happened. Markets that aren't live on the site can't be traded, and stock orders placed while the market is shut fill when it opens. Only one browser tab runs the live accounts, so two tabs never fill the same order twice.
- **Saving:** kept in the browser, and in the person's account when signed in (inside `user_state`; older closed orders and history are trimmed so the record stays within its size limit).

## Ideas

The **Ideas** tab is where people share how they read a chart, like TradingView's ideas. On the chart, someone sets up the symbol, timeframe, drawings and indicators, presses **Publish idea**, and adds a title, a long / short / neutral call and their analysis. Everyone can browse ideas (filtered by market, direction, symbol or author, newest or most liked), open one to see the author's chart with their drawings, press **What happened next** to add the prices since it was published, or open it on the live chart. Signed-in people can like ideas and comment.

An idea's chart is saved as numbers (price bars, drawings and indicator settings), never as an uploaded picture, so nobody can upload images through it. Once published, the chart and the call can't be changed; the title and text can be fixed for an hour.

**Moderating.** Anyone signed in can report an idea or comment. You're the moderator: when you're signed in, the Ideas page shows a **Reports** button with the reports waiting, and each idea and comment has a **Hide** button. Hiding removes it for everyone except its author. You can also delete any idea or comment. The rules people agree to are in `rules.html`.

To add another moderator, open Supabase → SQL Editor and run (with their email):

```sql
insert into private.admins (user_id) select id from auth.users where email = 'their.email@example.com';
```

Ideas, likes, comments and reports live in Supabase (`ideas`, `idea_likes`, `idea_comments`, `reports`). Database rules let anyone read published ideas and comments, but only their authors can change or delete them, only moderators can hide them or read reports, and each person can publish up to 10 ideas a day.

## Accounts (Sign in with Google)

People can use the site without signing in. Signing in saves their watchlist, drawings, indicators, alerts, chart settings and trade journal to their account, so they follow them to any device. Accounts live in Supabase, where database rules let each person read and change only their own data. **Delete my account** in the profile menu removes an account and everything saved to it.

The setup has three parts:

1. **Google Cloud** (console.cloud.google.com): an OAuth client of type *Web application*, with your site as an authorized JavaScript origin and `https://<your-project>.supabase.co/auth/v1/callback` as the authorized redirect URI. Publish the app under **Audience** so anyone can sign in.
2. **Supabase** (Authentication): turn on the Google provider with that client's ID and secret. Under URL Configuration, set the Site URL to your site and add `https://realchart.trade/**` to the redirect URLs.
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
