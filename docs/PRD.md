# ChartGuesser — Product Requirements Document

**Status:** Draft v1.0
**Last updated:** 2026-07-21
**Scope:** MVP

---

## 1. Overview

ChartGuesser is a real-time, multiplayer browser game inspired by GeoGuesser. Instead of guessing a location from a Street View image, players guess the **stock ticker** behind an anonymized candlestick chart. The fastest correct guess wins the round.

A match is created by one player who shares a link. Once both players have joined and marked themselves ready, the chart UI loads and the game begins.

### 1.1 Goals

- Ship a playable 2-player MVP that two friends can complete end-to-end via a shared link.
- Deliver a TradingView-style candlestick chart experience (timeframes, candle types) without leaking the ticker.
- Make round/match configuration flexible enough to support different ticker universes and round counts.

### 1.2 Non-goals (MVP)

- Accounts, authentication, and persistent user profiles.
- Public matchmaking / queue.
- Leaderboards, ranked mode, match history.
- More than 2 concurrent players per match.
- Mobile-native apps.
- Paid/premium data integrations.

---

## 2. Personas

| Persona | Description |
|---|---|
| **Host** | Creates the match, picks configuration (ticker universe, rounds, anonymization options), shares the link. Also plays. |
| **Guest** | Joins via link, enters a display name, marks ready, plays. |
| **Spectator** | Out of scope for MVP. |

---

## 3. User Stories

1. As a host, I can create a new match and receive a shareable link.
2. As a host, I can configure the match: ticker universe, number of rounds, anonymization options.
3. As a guest, I can open the link and join the match by entering a display name (no account).
4. As either player, I can mark myself ready; once both are ready, the match starts automatically.
5. As a player, I see a candlestick chart with timeframe controls (daily, weekly, etc.) and candle style toggles, but the ticker is hidden.
6. As a player, I can type a ticker into an autocomplete search box and submit a guess.
7. As a player, the first correct guess wins the round; the faster submission wins ties.
8. As a player, I see round results (winner, correct ticker, both players' guesses and times) after each round.
9. As a player, I see the overall match winner after the configured number of rounds.
10. As either player, I can leave/disconnect; the other player is notified.

---

## 4. Functional Requirements

### 4.1 Match lifecycle

- **Create:** Host opens the app, clicks "Create Match", configures options (see 4.2), and gets a unique link of the form `/{matchId}`.
- **Join:** Guest opens the link, enters a display name, lands in the match lobby.
- **Lobby:** Both players see each other's display names and a "Ready" toggle. The match starts when both are ready.
- **In-match:** Rounds run sequentially (see 4.4).
- **End:** After the configured number of rounds, the match summary is shown.

### 4.2 Match configuration (host only, at create time)

| Option | Type | Values |
|---|---|---|
| Ticker universe | single-select | `S&P 500`, `Nasdaq 100`, `Dow 30`, (future: more categories) |
| Rounds | integer | 1, 3, 5, 7, 10 (default 5) |
| Round timer | integer (seconds) | 30, 60, 90, 120 (default 60) |
| Starting HP | integer | 50, 100, 150, 200 (default 100) |
| Anonymize date axis | boolean | on/off (default on) |
| Anonymize price axis | boolean | on/off (default off) |
| Timeframe | single-select | Daily, Weekly, Monthly (default Daily) |

> The ticker is **always hidden**. The two anonymization toggles are additional options the host can layer on.

### 4.3 Chart UI

- Candlestick chart rendered in the browser, TradingView-like in feel.
- **Candle style:** candlesticks (default). Optional: hollow candles, Heikin-Ashi (future).
- **Timeframe controls:** Daily / Weekly / Monthly, switchable live during a round. The selected timeframe is the same chart, re-aggregated — not a different random sample.
- **Visible data:** a fixed window of N candles (default 200) sampled from a random non-recent period (last 90 days excluded to reduce recency bias).
- **Hidden:** ticker symbol, company name, exchange, sector, news, any text that could identify the security.
- **Anonymization (host-configured):**
  - Date axis hidden → show relative index (e.g. `-200 ... 0`) instead of dates.
  - Price axis hidden → show normalized scale (e.g. `0 ... 100` based on window min/max) instead of absolute prices.
- **Volume:** shown as a sub-pane (toggleable). Volume values are also subject to the price-axis anonymization rule when enabled.
- **Interactions:** pan, zoom, crosshair, tooltip with OHLCV — but tooltip text follows the same anonymization rules.

### 4.4 Round flow

1. Server picks a random ticker from the selected universe and a random eligible time window.
2. Server pushes chart data to both players simultaneously.
3. A round timer starts (duration from match config, default 60s).
4. Players type into the autocomplete box and submit a guess.
   - Autocomplete source = the selected ticker universe list.
   - Submission locks that player's guess for the round.
5. The round ends when:
   - A player submits the correct ticker → that player deals damage to the opponent (see 4.5) and the round ends immediately, or
   - Both players have submitted (correct or not), or
   - The round timer expires.
6. On round end, server reveals: correct ticker, both players' guesses, submission timestamps, damage dealt, and updated HP for both players.
7. Next round begins after a short intermission (default 5s), unless a player's HP has reached 0 (see 4.5).

### 4.5 Winning — Health Bar Duel

Inspired by GeoGuesser's battle/duel modes. Each player has a health bar (HP). Correct, fast guesses **damage the opponent**. First to drop the opponent's HP to 0 wins the match.

- **Starting HP:** from match config (default 100), same for both players, persists across all rounds.
- **Damage on a correct guess:** based on how fast the guess was relative to the round timer.

  ```
  damage = round( (timeLimit - secondsToCorrect) / timeLimit * maxDamage )
  ```

  - `maxDamage` = 35 (tunable). So an instant correct guess deals ~35 HP; a guess in the last second deals ~0.
  - `secondsToCorrect` is server-authoritative (server receive time − round start time).
- **Wrong guess:** deals 0 damage. No self-damage in MVP (we may add a small self-penalty later to discourage spam).
- **Both correct in the same round:** both players deal damage based on their own `secondsToCorrect`, applied simultaneously. If this would drop both to ≤0, the player with the higher remaining HP wins; if equal, the faster guesser wins.
- **One correct, one wrong/timed out:** only the correct player deals damage.
- **Both wrong/timed out:** no damage; round is a draw.
- **Match end conditions:**
  - A player's HP reaches 0 at any point → the other player wins the match immediately (even if rounds remain).
  - All configured rounds complete with both players above 0 → the player with higher HP wins.
  - HP tie after all rounds → tie broken by total `secondsToCorrect` across rounds where the player guessed correctly (lower wins); if still tied, the match is a draw.
- **HP display:** both players' HP bars are visible at all times during a match (top bar), so players can see how close they are to winning/losing and feel the pressure.

### 4.6 Disconnect handling

- If a player disconnects: the other player sees a "Opponent disconnected" notice and is given the option to wait (30s) or end the match.
- If the disconnected player rejoins via the same link within 30s, the match resumes.
- After 30s, the match is abandoned.

---

## 5. Data Source

- **Provider:** Yahoo Finance (via a lightweight, rate-limited fetcher) or Stooq as a fallback. No API key required.
- **Caching:** Server caches OHLCV by `(ticker, timeframe, day)` to avoid redundant upstream calls and to respect rate limits.
- **Universe lists:** Maintained as static JSON files in the repo (e.g. `data/universes/sp500.json`) refreshed periodically via script.
- **Sampling:** Server selects a ticker uniformly at random from the universe, then a random start date such that the window ends at least 90 days before today.

### 5.1 Universe catalog extension

- Every match stores an immutable snapshot of its resolved stock tickers.
- Selecting an ETF means playing its equity constituents; the ETF symbol is not itself a guess target.
- Free ETF coverage is issuer-adapter based and intentionally explicit. Unsupported and non-transparent funds are rejected rather than represented by incomplete top holdings.
- The AI Bottlenecks built-in spans semiconductors, equipment, optics, networking, memory, power, cooling, grid hardware, and construction.
- Anonymous users can publish immutable 2–200-stock community lists to Postgres. Built-in and private custom lists remain available when the database is down.
- The creator and both lobby players can preview the exact ticker pool before the match starts.

---

## 6. Technical Architecture (MVP)

### 6.1 Stack

- **Framework:** Next.js (App Router) + TypeScript.
- **Real-time:** Next.js Route Handlers + a WebSocket server (Node `ws` or Socket.io) running alongside the Next server; clients connect via WebSocket for match state.
- **State:** In-memory match state on the server (no DB for MVP). Match state is ephemeral and lost on server restart — acceptable for MVP.
- **Charting:** `lightweight-charts` by TradingView (open source, MIT) — fits the candlestick/timeframe requirement and is small.
- **Styling:** Tailwind CSS.
- **Deployment:** Single Node process; suitable for Vercel-compatible or any Node host that supports WebSockets (e.g. Railway, Fly.io).

### 6.2 Components

```
client (browser)
  ├─ Lobby UI        — display name, ready toggle, config summary
  ├─ Chart view      — lightweight-charts + timeframe controls + autocomplete + HP bars
  └─ Round result UI — reveal ticker, guesses, times, damage, updated HP

server (Next.js + WS)
  ├─ REST route: POST /api/match            — create match, returns matchId + link
  ├─ REST route: GET  /api/match/:id        — fetch match config (for guest landing)
  ├─ WS server:    /ws/:matchId             — join, ready, guess, round events
  ├─ Match manager (in-memory)              — lobby, rounds, scoring, disconnects
  ├─ Chart service                           — fetch + cache OHLCV, sample windows
  └─ Universe registry                       — load static JSON universe files
```

### 6.3 WebSocket protocol (sketch)

Client → Server:
- `join { displayName }`
- `ready { ready: boolean }`
- `guess { ticker: string, submittedAt: number }`

Server → Client (broadcast to match):
- `playerJoined { players: [...] }`
- `readyState { players: [{ id, name, ready }] }`
- `matchStart { config }`
- `roundStart { window: OHLCV[], timeframe, anonymize: {...}, roundIndex, totalRounds, timeLimit, hp: {p1, p2} }`
- `roundEnd { correctTicker, guesses: [...], damage: {p1, p2}, hp: {p1, p2}, winner }`
- `matchEnd { winner, finalHp, roundsWon, totalTimeToCorrect }`
- `opponentDisconnected { graceUntil }`
- `opponentRejoined`

---

## 7. Key UX Details

- **Landing:** Single hero CTA "Create Match". Below it: "Have a link? Paste it / open it."
- **Lobby:** Two avatar slots (display name + ready badge). Match config shown read-only to the guest.
- **Chart screen:** Chart fills most of the viewport. Top bar: round X/Y, round timer, and **both players' HP bars with current HP values**. Bottom bar: autocomplete input + "Submit Guess" button. Submit is disabled until a valid ticker from the autocomplete list is selected.
- **Round result:** Full-screen modal overlay with the revealed ticker, both guesses, submission times, **damage dealt to each player**, updated HP bars, and a "Next round in 5s…" countdown (or "Match over" if a player's HP hit 0).
- **Match end:** Final scoreboard showing remaining HP, rounds won, total time-to-correct, the winner, plus "Play again (same config)" and "New match" buttons.

---

## 8. Anonymization Rules (summary)

| Element | Default | Optional host toggle |
|---|---|---|
| Ticker symbol | Hidden | — (always hidden) |
| Company name / exchange / sector | Hidden | — (always hidden) |
| Date axis | Hidden (relative index shown) | Can be turned off (real dates shown) |
| Price axis | Shown | Can be turned on to hide (normalized scale) |
| Volume pane | Shown | Follows price-axis rule |
| Tooltip OHLCV | Shown | Follows both axis rules |
| Timeframe selector | Visible & switchable | — |

---

## 9. Edge Cases & Constraints

- **Insufficient history:** a ticker with fewer than N candles for the chosen timeframe is skipped and another is sampled.
- **Delisted / changed tickers:** universe lists should be refreshed; MVP tolerates occasional 404s by re-sampling.
- **Rate limits:** Yahoo Finance is aggressively rate-limited; the cache + pre-warm step on match creation mitigates this. If a fetch fails, fall back to Stooq.
- **Clock skew:** all timestamps are server-authoritative; client `submittedAt` is overwritten by server receive time for damage calculation.
- **Both submit correct in same round:** both deal damage based on their own `secondsToCorrect`, applied simultaneously. If both would drop to ≤0 HP, higher remaining HP wins; tie → faster guesser wins.
- **No correct guesses in a round:** no damage dealt; round is a draw; proceeds to next round.
- **HP reaches 0 mid-round:** match ends immediately; remaining rounds are skipped.
- **`maxDamage` tuning:** 35 is the MVP default; should be tuned so a typical 5-round match can reasonably end in a KO without making early rounds trivial.

---

## 10. MVP Acceptance Criteria

1. Host can create a match, pick a universe + rounds + round timer + starting HP + anonymization options, and copy a shareable link.
2. Guest can open the link, enter a display name, and join the lobby without any account.
3. Match auto-starts when both players are ready.
4. Each round renders an anonymized candlestick chart with working Daily/Weekly/Monthly timeframe switches.
5. Autocomplete input restricts guesses to the selected universe.
6. A correct guess deals damage to the opponent proportional to how fast it was submitted; both players' HP bars update live.
7. The match ends as soon as a player's HP reaches 0, or after all configured rounds — the winner is determined per the rules in §4.5.
8. Match summary displays final HP, rounds won, and the winner.
9. Disconnect of one player is surfaced to the other within a few seconds.

---

## 11. Out of Scope / Future (documented, not built in MVP)

- Accounts, persistent stats, match history.
- Public matchmaking and ranked queues.
- 3+ player matches and spectator mode.
- Custom universes, crypto, international markets.
- Heikin-Ashi / hollow candles / indicators overlay.
- Replays and shareable match links post-hoc.
- Mobile-native builds.
