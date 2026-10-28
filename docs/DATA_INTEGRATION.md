# Data integration and model validation

## API-Football v3

Official documentation: https://www.api-football.com/documentation-v3

The adapter uses the `x-apisports-key` header and the documented `fixtures`, `injuries`, `odds`, `players` and `teams/statistics` API categories. It honours response pagination with a page safety limit and handles authentication, plan/coverage, network and rate-limit errors without logging credentials. Data availability changes by league, season, provider subscription and endpoint.

## Data lineage and schema

Each imported fixture, injury, player-statistics row and odds snapshot retains provider name, relevant documentation URL, provider timestamp where exposed, local `retrieved_at`, plus raw provider payload for auditing. SQLite uses unique keys/upserts for fixtures and seasonal player stats; odds snapshots are deduplicated by fixture, bookmaker, market, selection, price and provider update time. Sync history records success/failure counts.

## Scheduled sync

The optional APScheduler job runs inside the FastAPI process only when `MATCHMIND_AUTO_SYNC=true` and `API_FOOTBALL_KEY` is set. It syncs current and recent past seasons for fixtures, then current-season injury and odds data. The player stats sweep is opt-in due request quotas. Default schedule: 04:20 `Europe/Rome`, with a one-time sync after startup. Configure competition IDs and history depth using environment variables.

## Anti-leakage and model gate

Historical forecasts query only completed records with kickoff strictly earlier than the target fixture. At least 20 eligible league matches and 3 appearances per target team are required. The score-based baseline applies a 540-day exponential decay half-life and five-match shrinkage toward the league mean. It is a transparent baseline, not a trained AI model. Injury reports and bookmaker odds are presented as context but don't alter xG until their effect is calibrated on chronological held-out data.

Before any model is presented as validated, use rolling-origin/walk-forward evaluations and report Brier score, log loss, calibration, sample sizes, missingness, and appropriate baselines. Closing-line value is an additional diagnostic, not a guarantee of returns.

## Setup blockers

No provider secret is checked into the repository. Until a valid key is supplied to the runtime, live fetches intentionally return HTTP 503. A provider key must be set in an ignored local `.env`, an environment variable, or a secrets manager. Never paste it into a GitHub commit, issue, or ordinary chat message.