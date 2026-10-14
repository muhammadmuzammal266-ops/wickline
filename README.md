# Wickline Charts

Free live charts for crypto, US stocks, forex and gold, in your browser. It has candles, indicators, drawing tools, a watchlist and price alerts.

## What's in this folder

| File | What it is |
|---|---|
| `config.js` | **Your settings.** Site name, Twelve Data key, default chart and watchlist. This is the file you'll edit most. |
| `index.html` | The whole app. You don't need to touch it to change settings. |
| `oanda-worker.js` | Optional. A small free proxy (Cloudflare Worker) that shows OANDA prices to every visitor. See below. |
| `favicon.svg`, `icon-*.png`, `apple-touch-icon.png` | The site icon (browser tab, phone home screen). |
| `manifest.webmanifest` | Lets people add the site to their phone's home screen like an app. |
| `og-image.png` | The preview picture shown when someone shares your link. |

## Change a setting (no coding needed)

1. On GitHub, open `config.js` and click the pencil icon (**Edit this file**).
2. Change the value between the quote marks. Keep the quotes and commas.
3. Click **Commit changes**.
4. Your live site updates in about a minute. Refresh the page to see it.

## Turn on live stock prices

Crypto, the major forex pairs and gold are always live, with no key needed. US stocks need a free key from Twelve Data:

1. Sign up at <https://twelvedata.com/pricing> and pick the free **Basic** plan.
2. Copy your API key from the Twelve Data dashboard.
3. Paste it into `config.js` between the quotes on the `twelveDataKey:` line, then commit.

Things to know about the free plan:

- It allows **8 requests a minute and 800 a day**, shared by everyone who visits your site. To make that last, the page uses the key only for what the free sources don't cover: stocks, less common forex pairs and silver.
- With the shared key, the open stock chart refreshes every minute and watchlist stock prices every 10 minutes. A visitor who pastes their own key under **Data sources** (the price badge, top right) gets a live stream instead.
- Anyone can see the key in the page code. The worst that can happen is someone uses up your daily allowance.
- When the allowance runs out, stocks show the last saved price until midnight UTC.

## OANDA prices for forex and gold

### Just for you (no setup)

1. On the live site, click the price badge (top right) to open **Data sources**.
2. Under **Forex & gold · OANDA**, paste your OANDA personal access token. To get one, sign in at <https://hub.oanda.com>, click **Tools → API → Generate**, and copy the token.
3. Choose **Practice** or **Live** to match the account and press **Connect**.

Forex and gold then come straight from OANDA, with bid, ask and spread. The token is saved only in that browser. It can place trades on your account, so only connect on your own device, and use a practice account if you can.

### OANDA for everyone (free Cloudflare Worker, about 10 minutes)

This shows OANDA prices to every visitor without putting your token in the page.

1. Create a free account at <https://dash.cloudflare.com/sign-up>.
2. Go to **Workers & Pages**, click **Create**, then **Start with Hello World!** (or **Create Worker**). Name it `wickline-oanda` and click **Deploy**.
3. Click **Edit code**, delete what's there, paste the whole of `oanda-worker.js` from this repository, and click **Deploy**.
4. Open the Worker's **Settings → Variables and Secrets**, click **Add**, choose type **Secret**, name it `OANDA_TOKEN`, paste your OANDA token as the value, and click **Deploy**. The Worker works out your account and whether it's Practice or Live by itself.
5. Copy the Worker's address, for example `https://wickline-oanda.yourname.workers.dev`, and paste it into `oandaProxy` in `config.js`. Commit the change.

The Worker only allows reading candles and prices. It can't place trades or see your balance. Prices stream to each visitor over one connection, so the free Cloudflare plan (100,000 requests a day) covers a lot of visitors. If the Worker ever stops answering, the page switches forex and gold to Kraken by itself and reconnects later.

Optional settings for the Worker: `ALLOWED_ORIGIN` (your site address, so only your site can use it), `OANDA_ENV` (`practice` or `live`) and `OANDA_ACCOUNT` (a specific account ID).

Before showing OANDA prices to the public, check OANDA's terms. Brokers often license their price data for your own use only.

## Change something bigger

- **Rename the site:** change `siteName` in `config.js`. To also change the name shown in search results and link previews, edit the `<title>` and `og:title` lines near the top of `index.html`.
- **Default watchlist:** edit `defaultWatchlist` in `config.js`. It only applies to first-time visitors, because returning visitors keep their own list.
- **Ticker formats:** crypto as a Binance pair (`BTCUSDT`, `ETHBTC`), US stocks as tickers (`AAPL`, `BRK.B`), forex with a slash (`EUR/USD`, `XAU/USD`).

## Share a chart

The address bar always matches the chart you're looking at. For example, `?s=AAPL&tf=1d` opens Apple on daily candles. You can also click the link icon, top right, to copy the link.

## Where the data comes from

- Crypto: Binance public market data (live). Where Binance doesn't answer (for example in the UK and US), the page switches to OKX, then Bybit, automatically.
- Forex and gold: OANDA when the site's Worker is set up, or when a visitor connects their own account. Otherwise the 12 major forex pairs come from Kraken and gold follows PAX Gold (PAXG), both live with no key. Other pairs use Twelve Data, and silver uses gold-api.com.
- US stocks and ETFs: Twelve Data (needs the key in `config.js`).
- Without a live connection, the page shows real prices saved on 9–12 October 2026, clearly marked "Not live". The older candles on those charts are illustrative.

Market data is for information only and is not financial advice.

## Credits

Charts are drawn with [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) (Apache 2.0 licence). The small TradingView logo on the chart is the attribution its licence asks for.
