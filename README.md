# What Did I Miss? — Smart Market Watchlist

A watchlist that filters attention rather than showing every stock the same
way. Instead of a wall of tickers and raw percentages, it tracks what you
last saw for each symbol and surfaces a plain-language read on what's
actually changed since — backed by a deterministic scoring engine, not an
LLM.

## How it works

1. **Market data** — this deployment runs entirely on a deterministic
   synthetic provider: no dependency on Yahoo Finance or any external
   market-data API. Every symbol's price/volume/history is generated from
   a seeded random walk (same symbol + same day always produces the same
   numbers), normalized into a `MarketObservation` exactly like a real
   provider's data would be, and classified by freshness (`LIVE` /
   `DELAYED` / `CLOSED` / `STALE` / `CACHED` / `STATIC`). Synthetic data is
   never classified `LIVE`/`DELAYED` regardless of its own timestamp —
   those two states are reserved for genuine real-time data from a real
   provider, so the UI can never present simulated data as live. Business
   logic depends only on the `IMarketDataProvider` interface, never on a
   concrete provider — a real one can be added later behind that same
   interface without touching `marketDataService`, the change engine, or
   the UI.
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
login, password, session, or OAuth**. A "Viewing as" switcher in the
sidebar lets you pick a seeded demo identity (Meghan, Siya, Karan, Aditi,
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
any future provider. `STALE_DATA` is classified `LIMITED` via the same
freshness/age rule real stale data hits. `PROVIDER_FAILURE` triggers the
same cached → static-snapshot → unavailable fallback chain a genuine
outage would. See `tests/unit/marketSimulation.test.ts` for the tests
that pin this down.

Because the underlying market data is shared, a scenario you force affects
every user watching that symbol — but since checkpoints are per-user, each
user's *classification* of that shared move can still differ.

## Persistence and scale

Two of the take-home's "you decide" architecture questions, answered by
what's already here rather than speculative infrastructure:

**Persists across sessions and devices** — watchlist items and checkpoints
live in Postgres, not memory or `localStorage`, so they survive restarts
and are visible from any browser the moment you pick the same demo user
from the switcher. The only thing that's device-local is *which* demo user
you're currently viewing as (a plain `localStorage` value) — making that
follow you across devices would require some form of login, which is
exactly what this app deliberately doesn't have.

**Scales for larger watchlists and more users** — the data model already
supports it: relational tables with proper composite keys, and market data
fetched and cached once per symbol regardless of how many users are
watching it (see "Multi-user" above). With the synthetic provider there's
no external network call or rate limit to worry about — a dashboard load
still fans out one provider call per watchlist symbol, but each is a local,
deterministic computation. If a real provider is added back later behind
`IMarketDataProvider`, that fan-out becomes a real external-request
concern again (the app previously used a `ConcurrencyLimiter` for exactly
this against Yahoo — removed along with the rest of the Yahoo-specific
code, since nothing depends on it while only the synthetic provider is
wired up, but the same pattern would come back with a real provider). The
UI also has no pagination; fine for a handful of symbols, but a version
built for dozens-plus per user would want to batch that fan-out into a
single provider call and virtualize the list.

## Running locally

```bash
docker compose up -d db   # Postgres
npm install
npm run db:migrate        # apply migrations
npm run db:seed           # seed 5 demo users + their watchlists
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs fully
offline on deterministic synthetic data — no external API key or network
access needed.

## Deployment (Vercel)

1. Import this repository as a new Vercel project.
2. Add a Postgres database (Vercel's Storage tab, or any hosted Postgres —
   Neon, Supabase, etc.) and set two environment variables on the project:
   - `DATABASE_URL` — a *pooled* connection string, if your provider offers
     one (Neon's does, under "Pooled connection" in its dashboard).
     `src/lib/prisma.ts` caches one client per warm serverless instance,
     which is correct and safe on its own, but enough concurrent
     cold-started instances can still open more direct Postgres
     connections than a small plan allows; a pooled connection string is
     the standard fix.
   - `DIRECT_URL` — the same database's *unpooled/direct* connection
     string (Neon's dashboard also shows this, right next to the pooled
     one). `prisma migrate deploy` takes a Postgres advisory lock, which a
     pooled (PgBouncer transaction-mode) connection can't reliably hold —
     using the pooled URL here fails with `P1002: timed out trying to
     acquire a postgres advisory lock`. Migrations use `directUrl`
     specifically (see `prisma/schema.prisma`); the running app still only
     ever uses the pooled `DATABASE_URL`.
3. Deploy. `postinstall` runs `prisma generate`, and `vercel.json`'s
   `buildCommand` runs `prisma migrate deploy` before `next build`, so
   schema migrations apply automatically on every deploy — no manual
   migration step. (This is Vercel-specific, not part of the plain
   `npm run build` script, since a local Docker image build has no
   reachable database to migrate against at build time — see the
   `Dockerfile`, which already runs migrations at container start
   instead.)
4. After the first successful deploy, seed the 5 demo users once, pointed
   at the production database:
   ```bash
   DATABASE_URL="<production connection string>" npx tsx prisma/seed.ts
   ```
   The seed is idempotent (upsert-based), so re-running it later is safe.

The deployed app uses only the synthetic provider — see "Market data"
above for why that's a deliberate choice, not a limitation: every number
shown is clearly simulated (never classified `LIVE`), and Market
Simulation demonstrates the full real classification pipeline on demand
without depending on any external service staying up.

## Testing

```bash
npm run test       # unit tests (vitest)
npm run test:e2e   # end-to-end tests (playwright)
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
