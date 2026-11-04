# MatchMind — Football Analytics Lab

MatchMind is a local-first football data pipeline and probability workbench. It imports provider data into a source-attributed SQLite database, offers a dark dashboard, and computes transparent statistical estimates for 1X2, Gol/No Gol and Over/Under 1.5, 2.5 and 3.5.

**It is not yet a trained AI model.** The built-in forecast is a transparent Poisson baseline. The API-Football adapter and local scheduled synchronizer are implemented, and a separate no-key public CSV importer is available for supported competitions. API-Football-only feeds still require a valid key and plan coverage. No real key, live response, or prediction performance result is bundled into the repository.

## Optional API-Football setup

You can start with API-Football's **$0 Free plan**. The provider currently advertises 100 requests per day and says no credit card is required for the free version. The plan lists fixtures, statistics, player information, injuries, pre-match/in-play odds and predictions among its endpoint categories, but available seasons and actual coverage may vary. Check the current plan and coverage before relying on any feed: [API-Football pricing](https://www.api-football.com/pricing).

1. For the no-key mode, copy `.env.example` to `.env`; no account or key is needed.
2. For API-Football-only feeds, you may separately create an account, activate the Free plan and add the key locally.
3. Run the app as described below, then inspect `/provider/status`, `/provider/coverage` and `/data/coverage`.

The free plan still requires a provider account and API key; it is **not** a no-registration/no-key data source. Never paste the key into chat, commit it, or put it in `.env.example`. The app cannot bypass the provider's request quota or endpoint restrictions. For a low quota, sync only the leagues and date ranges you need; automatic player sync is off by default because it can consume many requests.

## Automatic no-key Serie A data refresh

MatchMind can automatically refresh fixtures and results from [open-matchday](https://github.com/oladeeayo/open-matchday), a public daily-updated CSV dataset that does not require registration or an API key. The default competition is Italy's Serie A.

The example configuration enables this mode by default:
- It runs shortly after the application starts.
- It refreshes once per day at 04:05 Europe/Rome while the MatchMind API process is running.
- It stores fixtures and completed scores in the local SQLite database, preserving the source and sync history.
- It uses the current season automatically; `2026` means 2026/27. You can configure additional competition folder slugs in `MATCHMIND_PUBLIC_LEAGUES`.

To activate it, create `.env` from `.env.example`, then load the variables and start the server:

```bash
cp .env.example .env
set -a; source .env; set +a
uvicorn matchmind.api:app --host 127.0.0.1 --port 8000
```

No API key is needed. Keep the app running for the daily scheduler to execute; if the process stops or the machine is off, no scheduled refresh happens during that period. Check `/health`, `/data/coverage` and `/data/fixtures` to see whether data have been imported. A one-off manual sync remains available as a fallback:

```bash
curl -X POST "http://127.0.0.1:8000/sync/open-matchday?league_slug=ITA_1_serie-a&season=2026"
```

**Limits:** the source updates daily, not live, and its coverage/statistics vary. It provides results and fixtures plus some match statistics, but not bookmaker odds, injuries, lineups or complete player data. Its terms allow informational non-commercial use with attribution and prohibit selling or sublicensing this compilation; upstream providers may have additional terms. See [open-matchday source and terms](https://github.com/oladeeayo/open-matchday).

## Quick start (macOS/Linux)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
# Optional: set API_FOOTBALL_KEY only if you want to use API-Football as an additional source
set -a; source .env; set +a
uvicorn matchmind.api:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000` for the dashboard, or `http://127.0.0.1:8000/docs` for API docs. By default the server binds to loopback. If you use `.env.example`, public Serie A sync is enabled without an API key.

To keep the app and its database running in a persistent local container, create `.env` from `.env.example` and run `docker compose up --build -d`. No API key is required for automatic public Serie A sync. The Compose port is bound to `127.0.0.1` and `./data` is mounted persistently. Stop it with `docker compose down`.

## Automatic synchronization

In `.env`, set:

```dotenv
API_FOOTBALL_KEY=...
MATCHMIND_AUTO_SYNC=true
MATCHMIND_SYNC_ON_STARTUP=true
MATCHMIND_SYNC_HOUR=4
MATCHMIND_SYNC_MINUTE=20
MATCHMIND_TIMEZONE=Europe/Rome
MATCHMIND_LEAGUES=135
MATCHMIND_HISTORY_SEASONS=2
MATCHMIND_AUTO_SYNC_PLAYERS=false
DATABASE_URL=sqlite:///./data/matchmind.db
```

When the API process is running, MatchMind will run a first sync shortly after startup and then a daily sync at 04:20 Europe/Rome. It imports fixtures for the current and configured previous seasons, plus current-season injuries and bookmaker odds. Player statistics are optional because pulling every team can consume significant API quota; enable `MATCHMIND_AUTO_SYNC_PLAYERS=true` only if the subscription permits. The configured database path is persistent across restarts.

The cron scheduler runs **only while the API process is alive**. For a desktop setup, keep the process running or configure a local service manager such as `launchd` (macOS) or systemd (Linux). If it is not running, no background sync occurs.

### Manual sync commands

```bash
matchmind sync --league 135 --season 2026 --data all
matchmind sync --league 135 --season 2026 --data fixtures
matchmind sync --league 135 --season 2026 --data players --team 489
```

API endpoints include `POST /sync/all`, `POST /sync/fixtures`, `POST /sync/injuries`, `POST /sync/odds`, and `POST /sync/players`. Read `/provider/status` and `/data/coverage` to verify configuration and import results. The default league ID 135 is commonly used for Italian Serie A in API-Football; confirm competition IDs and plan coverage against the provider's current dashboard.

## Automatic live-provider verification

The separate `provider-live-smoke` GitHub Actions workflow runs daily and can also be started manually. Add a repository Actions secret named `API_FOOTBALL_KEY` under **Settings → Secrets and variables → Actions**. Its live step is deliberately a hard gate: it must execute and verify explicit fixtures, injuries and odds coverage for the active Serie A season, then call all three endpoints. A missing key, unsupported season, missing coverage or endpoint error fails the job; it is not counted as a successful skip. Provider access is plan- and season-dependent, so a key alone does not establish live coverage. The local application still needs the key in its own private `.env` file.

## What gets stored

SQLite tables store fixture metadata and final scores, player-availability reports, player seasonal statistics, each distinct bookmaker/market/selection price snapshot, source URLs, provider timestamps and local retrieval timestamps. Sync attempts are logged. Repeated identical odds snapshots are deduplicated. Provider errors do not turn into fake records.

The dashboard also analyses complete, comparable bookmaker snapshots for 1X2, Gol/No Gol and supported Over/Under lines. It calculates overround, proportional de-vigged market probabilities, model/market divergence and theoretical expected value, and flags large margins or differences for review. Incomplete or unrecognised markets are skipped rather than treated as comparable. Player season statistics and injury reports are shown as sourced context; their effects are not applied to forecasts until validated on out-of-sample data.

The forecast-from-fixture endpoint only estimates expected goals from completed results with kickoff timestamps before the fixture. It uses a time-decayed, smoothed team-strength baseline and requires sufficient match history. Injury and odds records are shown as context but are **not** arbitrarily applied as multipliers to probabilities: their effects must be estimated and validated on held-out data first.

## Verification

```bash
pytest -q
python -m matchmind.cli demo
python -m compileall -q matchmind
```

Automated tests use mocked HTTP responses and a temporary SQLite database. They test pagination, secret handling, storage idempotence, market probabilities, historical cut-off logic and the missing-key failure path. This validates software behaviour without pretending the live provider has been contacted.

## Private cloud access

The API supports HTTP Basic authentication via environment variables. For any internet-accessible deployment, set `MATCHMIND_REQUIRE_AUTH=true`, `MATCHMIND_AUTH_USERNAME`, and a long unique `MATCHMIND_AUTH_PASSWORD` in the hosting provider's secret/environment settings. Never commit real credentials. Authentication protects the dashboard, API routes, health endpoint, and interactive API documentation. Use HTTPS only; the hosting platform or reverse proxy must terminate TLS. If auth is enabled but credentials are missing, the app fails closed with HTTP 503 rather than exposing the service.

**Hosting note:** the current database is SQLite and the daily scheduler runs inside the web process. Many free web-hosting tiers sleep and/or have ephemeral filesystems; on those tiers, scheduled sync may not run while sleeping and SQLite data can be lost on redeploy. Choose a host with persistent disk and a continuously running container/VM if you need durable history and dependable daily sync. Do not deploy publicly until authentication and persistent storage are configured.

## Security and responsible use

- Never commit `.env`, API keys, tokens, or the local SQLite database.
- Run on `127.0.0.1` for personal use. Do not expose this service to the internet without authentication, HTTPS, access controls, and request-rate limits.
- API key presence does not guarantee endpoint access, plan quota, data completeness, historical odds, or injury coverage.
- Verify the provider's current licensing and permitted use. Do not scrape data sources whose terms prohibit it.
- Market divergence and price movements are statistical observations, not proof of deliberate bookmaker manipulation. Probabilities, expected value and historical performance do not guarantee profit.

## Remaining model-validation work

The import pipeline is usable once credentials and provider access are configured. A production-grade AI model still needs a defined licensed data coverage, walk-forward evaluation by date, calibration reports, benchmark comparisons (including a Dixon–Coles model), closing-line validation, monitoring for missing/stale reports, and documented out-of-sample performance before it should be described as validated.


## Keyless mobile data sources

The mobile PWA can load Serie A fixtures and results without API credentials. It tries the public [open-matchday CSV dataset](https://github.com/oladeeayo/open-matchday) first, then uses the public-domain [openfootball/football.json](https://github.com/openfootball/football.json) feed to fill missing results or fixtures. Historical matches are loaded from the existing football-dataset CSV archive, with openfootball JSON as a fallback. The interface shows the active sources and the local retrieval time; cached data are identified as offline data.

These public feeds do **not** provide bookmaker odds, official lineups or confirmed injuries. The match detail page also requests a keyless Google News RSS search for recent articles connected to the two teams; it displays headline, publisher and publication date with a link to the original page. RSS results are editorial context only: they are not treated as confirmed team news, injury reports or numerical performance data and never alter model probabilities. The feed is cached at the Cloudflare edge for 15 minutes and limited to six articles from the last 21 days.

The assistant can produce a probability-only shortlist when no odds feed is configured, but it explicitly does not calculate a bookmaker payout, expected value or a profitable stake. Price-based proposals still require current odds from an enabled provider.
