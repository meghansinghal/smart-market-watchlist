# What Did I Miss? — Smart Market Watchlist

A watchlist that filters attention rather than showing every stock the same
way. Instead of a wall of tickers and raw percentages, it tracks what you
last saw for each symbol and surfaces a plain-language read on what's
actually changed since — backed by a deterministic scoring engine, not an
LLM.

## How it works

1. **Market data** — fetched from Yahoo Finance (or a deterministic
   synthetic provider for offline/demo use), normalized into a
   `MarketObservation`, and classified by freshness (`LIVE` / `DELAYED` /
   `CLOSED` / `STALE` / `CACHED` / `STATIC`) so the UI never claims a price
   is "live" when the market's closed.
2. **The Meaningful Change Engine** compares the current observation
   against your last checkpoint for that symbol and scores it on four axes
   — price movement, how unusual that move is for the stock's own history,
   divergence from its sector benchmark, and volume — before classifying
   it `NORMAL` / `NOTABLE` / `SIGNIFICANT` and generating a deterministic,
   human-readable explanation.
3. **Checkpoints** record "what you last saw" per symbol. They only update
   once the dashboard has actually rendered fresh, trustworthy data and the
   client acknowledges it — never from stale or fallback data.

## Multi-user, without authentication

The app supports multiple users with fully isolated state — **without any
login, password, session, or OAuth**. A small "Viewing as" switcher in the
header lets you pick a seeded demo identity (Meghan, Siya, Karan, Aditi,
Arush); switching is a plain client-side selection, not a security
boundary.

- `WatchlistItem` and `Checkpoint` belong to a user.
- `MarketObservation` and `HistoricalBar` are global/shared — every user is
  looking at the same market.
- Two users can watch the same symbol and see entirely different "since
  your last visit" results, because their checkpoints differ, even though
  they're comparing against the identical underlying observation.

## Market Simulation

A secondary, collapsible **"Market simulation"** panel (collapsed by
default, always present in the running app — not gated behind a flag) lets
you force a symbol's synthetic market data into a specific condition, for
testing and exploring how the app responds:

| Scenario            | What it simulates                                   |
| -------------------- | --------------------------------------------------- |
| `NORMAL_MARKET`       | Ordinary day-to-day movement (the default)           |
| `PRICE_SHOCK`         | A large (7–10%) price move                           |
| `VOLUME_SPIKE`        | A volume surge with little price movement            |
| `SECTOR_DIVERGENCE`   | A move uncorrelated with the sector benchmark        |
| `STALE_DATA`          | Data that hasn't updated in several trading days      |
| `PROVIDER_FAILURE`    | The market data provider throwing an error            |

This is **market-data/testing infrastructure, not a presenter-only demo
mode**. Forcing a scenario never assigns a classification directly — it
only changes what price, volume, or timestamp the synthetic provider
generates for that symbol. The resulting `MarketObservation` is persisted
and scored by the same Meaningful Change Engine, the same freshness rules,
and the same fallback chain as data from any other source:

```
scenario selection → SyntheticMarketDataProvider → MarketObservation
  → persistence → Meaningful Change Engine → classification → explanation → UI
```

A `PRICE_SHOCK` only reads as `SIGNIFICANT` because the engine scored an
8% move as significant — the same way it would for a real 8% move from
Yahoo. `STALE_DATA` is classified `LIMITED` via the same freshness/age
rule real stale data hits. `PROVIDER_FAILURE` triggers the same
cached → static-snapshot → unavailable fallback chain a genuine outage
would. See `tests/unit/marketSimulation.test.ts` for the tests that pin
this down.

Because the underlying market data is shared, a scenario you force affects
every user watching that symbol — but since checkpoints are per-user, each
user's *classification* of that shared move can still differ.

## Running locally

```bash
docker compose up -d db   # Postgres
npm install
npm run db:migrate        # apply migrations
npm run db:seed           # seed 5 demo users + their watchlists
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). By default
`MARKET_DATA_PROVIDER=synthetic` in `.env`, so the app runs fully offline
with deterministic data — set it to `yahoo` to use real market data.

## Testing

```bash
npm run test       # unit tests (vitest)
npm run test:e2e   # end-to-end tests (playwright), synthetic mode
npm run typecheck
npm run lint
```

## Other useful commands

```bash
npm run build       # production build
npm run db:studio   # Prisma Studio — inspect the database
```

CI (`.github/workflows/ci.yml`) runs all of the above against an ephemeral
Postgres container on every push/PR.
