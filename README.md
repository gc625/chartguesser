# ChartGuesser

GeoGuesser for stock charts. A 2-player real-time browser game: an anonymized candlestick chart loads for both players simultaneously, and the fastest correct ticker guess deals damage to the opponent's HP bar. First to drop the other to 0 HP wins.

See [`docs/PRD.md`](docs/PRD.md) for the full product spec.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind v4)
- Custom Node server (`server.ts`) serving HTTP + WebSocket on a single port
- `ws` for the real-time multiplayer layer
- `lightweight-charts` v5 for the TradingView-style chart
- `yahoo-finance2` v4 for free OHLCV data (no API key)
- In-memory match state (no database)

## Local development

```bash
npm install
npm run dev        # http://localhost:3000  (set PORT to override)
```

Open the app, create a match, copy the `/match/{id}` link, and send it to a friend. Both enter a display name, hit Ready, and the chart loads.

## Deploy to Render (free tier)

Render runs a single Node web service on one port — which is why the app uses a custom server that serves both HTTP and WebSocket on the same port.

### Option A — Blueprint (fastest)

1. Push this repo to GitHub.
2. On Render, click **New → Blueprint**, pick this repo. Render reads `render.yaml` and creates the service automatically.
3. Wait for build/deploy. You'll get a URL like `https://chartguesser.onrender.com`.

### Option B — Manual

1. **New → Web Service**, connect the GitHub repo.
2. Runtime: **Node**
3. Build Command: `npm install && npm run build`
4. Start Command: `npm run start`
5. Plan: **Free**
6. Deploy. Render provides `PORT` automatically.

### Notes

- Render's free web service **supports WebSockets**.
- The free plan **sleeps after ~15 min of inactivity** and wakes on the next HTTP request, so the first load after idle takes ~30s. Live matches are unaffected once awake.
- Match state is in-memory, so it's lost if the service restarts or sleeps. Fine for MVP play sessions.
- Yahoo Finance is rate-limited; the server caches OHLCV per `(ticker, interval)` and re-samples up to 8 tickers per round.

## Universe catalog

Matches snapshot their exact ticker pool when they are created. Players can choose:

- Built-ins: S&P 500, Nasdaq 100, Dow 30, and the curated 74-stock AI Bottlenecks universe.
- ETF constituents: the ETF itself is not guessed; its equity holdings become the ticker pool.
- Community lists: immutable anonymous lists stored in Postgres.
- Private custom lists of 2–200 US-listed stock symbols.

The free ETF resolver uses issuer-specific sources. SOXX and SMH have dated complete fallback snapshots because the iShares and VanEck sites can block automated requests; supported Invesco funds use its public DNG holdings endpoint. Unsupported or non-transparent ETFs return a clear error instead of an incomplete top-holdings list.

## Persistent community lists

Set `DATABASE_URL` to a managed Postgres database, such as Neon, before starting the service. Tables are created lazily at runtime; the equivalent schema is recorded in `db/migrations/001_universe_catalog.sql`.

Community submissions are anonymous, immutable, deduplicated, capped at 200 symbols, and rate-limited per process/IP. If Postgres is unavailable, built-in and private custom matches continue to work while community browsing and publishing are disabled.
