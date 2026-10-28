# Data integration plan

This document defines the required source pipeline before any real-world forecast can be shown.

## Required data families

| Family | Required fields | How it affects the model |
|---|---|---|
| Match history | kickoff UTC, competition, season, teams, score, source | Attack/defence strength, home advantage, team form |
| Team match stats | shots, shots on target, xG where licensed, possession, cards | Additional features and model diagnostics |
| Player stats | player/team IDs, minutes, starts, goals, assists, role, date | Player contribution estimates adjusted for minutes and opposition |
| Availability | player ID, status, reason if public, expected return, observed time, source | Squad-strength uncertainty and lineup scenarios |
| Odds snapshots | bookmaker, market, selection, decimal odds, timestamp, source | Overround, consensus, line movement, divergence |
| Final results | verified result and settlement rules | Out-of-sample evaluation |

## Provider integration rules

- Keep provider adapters separate from model code.
- Read credentials only from environment variables or a secrets manager.
- Never log API keys or include them in error messages.
- Respect rate limits, plan limits, robots/terms and retention rights.
- Cache responses where provider terms allow it.
- Record `source`, `source_url`, `retrieved_at`, competition coverage and licence/plan note.
- Mark data as missing or stale; do not fabricate injury reports or projected lineups.
- Make the UI show the timestamp and provider coverage for each prediction.

## Candidate sources to evaluate

- **API-Football:** candidate for fixtures, teams, player statistics, sidelined/injury reports and odds. Exact endpoints, historical depth and rate limits depend on the active subscription. Do not enable an adapter until credentials and allowed usage are confirmed.
- **StatsBomb Open Data:** selected competitions and event data; attribution and coverage restrictions apply.
- **football-data.co.uk:** useful for manual, offline personal review of historical results and odds where terms permit. Do not scrape it or use it for automated AI training under terms that disallow that activity.

## Data quality checks before modelling

1. Normalize team/player IDs; names alone are not stable identifiers.
2. Normalize kickoff times to UTC and preserve original source time.
3. Prevent leakage: only use information available before kickoff for a historical forecast.
4. Store odds snapshots separately from match outcomes.
5. De-duplicate fixtures and validate scores/settlement.
6. Track injury-report freshness and conflicting sources.
7. Run chronological train/validation/test splits by date.
8. Publish sample size, missingness, calibration and error metrics beside any model score.

## Provider activation gate

Real data is **not active** in the current version. Activation requires a selected provider, a key stored privately, a review of permitted personal use and a successful smoke test. Until then the API only uses user-supplied xG or odds.
