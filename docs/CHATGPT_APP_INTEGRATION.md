# MatchMind ChatGPT App — integration plan

This branch adds the ChatGPT integration layer without replacing the existing MatchMind engine or mobile PWA.

## Existing components preserved

- FastAPI backend in `matchmind/api.py`
- SQLite persistence and source lineage in `matchmind/storage.py`
- Historical, time-decayed Poisson baseline in `matchmind/historical_model.py`
- Transparent market / odds analysis in `matchmind/analysis.py` and `matchmind/fixture_odds.py`
- Public no-key Serie A fixture/result adapter in `matchmind/providers/open_matchday.py`
- Existing mobile bet builder and PWA in `mobile/`

## Integration architecture

ChatGPT App (Apps SDK UI) -> remote MCP server -> existing MatchMind HTTP API -> existing SQLite-backed engine.

The MCP adapter must remain a thin orchestration layer. It must not duplicate probability calculations or create synthetic fixtures, prices, injuries, lineups, or model confidence.

## Tool surface

1. `matchmind_status`: check API health, provider status, coverage, freshness, and model status.
2. `list_fixtures`: list stored upcoming fixtures, including provider, source URL, and retrieval timestamp.
3. `sync_public_serie_a`: request the existing no-key open-matchday sync.
4. `analyse_fixture`: retrieve forecast for a stored fixture, return explicit insufficient-data status when the history gate fails.
5. `analyse_market`: compare a user-supplied/current odds snapshot only when a complete comparable market is available.
6. `evaluate_bet_slip`: validate odds, calculate combined odds and break-even probability, and only calculate model probability for independent fixtures with real model output; label correlation as unmodelled unless supported.
7. `save_slip`, `list_slips`, `update_slip`, `delete_slip`: persistence, backed by a dedicated table and ownership/authentication.

## Data and forecast limitations

- open-matchday is a daily public CSV source: fixtures and historical results, not bookmaker prices, injuries, lineups, or live scores.
- API-Football remains optional and is not enabled by default. A key must be deployed as a server secret; never commit it or ask user to paste it in chat.
- Existing Poisson calculation is a transparent baseline, not a trained AI model or validated betting edge.
- The app must display the source, last-updated timestamp, freshness, sample size, method, and limitations for every forecast.
- No recommendation may be described as profitable or guaranteed. Never invent probabilities or quotes.

## Security and deployment gate

- MCP endpoint must be HTTPS and authenticated.
- Do not expose the existing FastAPI service publicly without authentication, HTTPS, rate limits, and persistent storage.
- Store MCP credentials and any optional provider credentials in deployment secrets only.
- Keep tool outputs bounded and avoid exposing raw provider payloads or private config.
- The ChatGPT app cannot run until the MCP server is deployed to a reachable HTTPS URL and configured in ChatGPT's developer/app integration settings.

## Delivery sequence

1. Keep this branch isolated from production.
2. Implement MCP adapter and schema tests against the existing FastAPI API.
3. Add persistent bet-slip endpoints and migration only after reviewing existing mobile bet persistence to avoid incompatible duplicate schemas.
4. Deploy to a private HTTPS environment; run smoke tests.
5. Configure ChatGPT app and test end-to-end.
6. Merge only after CI and manual verification.

## Current status

Planning branch created from `main`. No runtime code, production data, or existing application behaviour has been changed by this document.
