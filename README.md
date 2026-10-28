# MatchMind — Private Football Analytics Lab

MatchMind is a local-first football data pipeline and probability workbench. It imports provider data into a source-attributed SQLite database, offers a dark dashboard, and computes transparent statistical estimates for 1X2, Gol/No Gol and Over/Under 1.5, 2.5 and 3.5.

**It is not yet a trained AI model.** The built-in forecast is a transparent Poisson baseline. The provider adapter and local scheduled synchronizer are implemented, but live data require a valid API-Football key and plan coverage. No real key, live response, or prediction performance result is bundled into the repository.

## Quick start (macOS/Linux)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
# Edit .env privately and set API_FOOTBALL_KEY=your_key_here
set -a; source .env; set +a
uvicorn matchmind.api:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000` for the dashboard, or `http://127.0.0.1:8000/docs` for API docs. By default the server binds to loopback, and automatic sync is disabled until explicitly enabled.

To keep the app and its database running in a persistent local container, create `.env` from `.env.example`, set the key privately, then run `docker compose up --build -d`. The Compose port is bound to `127.0.0.1` and `./data` is mounted persistently. Stop it with `docker compose down`.

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

The separate `provider-live-smoke` GitHub Actions workflow can be run manually or daily. To enable a real provider test without exposing credentials, add a repository Actions secret named `API_FOOTBALL_KEY` under **Settings → Secrets and variables → Actions**. The workflow checks the selected league/season coverage and exercises the fixtures, injuries and odds endpoints. If the secret is absent, the live check is intentionally skipped; the standard CI still runs mock-based tests. Never commit the key or paste it into a chat. The local application still needs the key in its own private `.env` file.

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

## Security and responsible use

- Never commit `.env`, API keys, tokens, or the local SQLite database.
- Run on `127.0.0.1` for personal use. Do not expose this service to the internet without authentication, HTTPS, access controls, and request-rate limits.
- API key presence does not guarantee endpoint access, plan quota, data completeness, historical odds, or injury coverage.
- Verify the provider's current licensing and permitted use. Do not scrape data sources whose terms prohibit it.
- Market divergence and price movements are statistical observations, not proof of deliberate bookmaker manipulation. Probabilities, expected value and historical performance do not guarantee profit.

## Remaining model-validation work

The import pipeline is usable once credentials and provider access are configured. A production-grade AI model still needs a defined licensed data coverage, walk-forward evaluation by date, calibration reports, benchmark comparisons (including a Dixon–Coles model), closing-line validation, monitoring for missing/stale reports, and documented out-of-sample performance before it should be described as validated.