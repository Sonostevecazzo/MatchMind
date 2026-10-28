# MatchMind — Football Analytics Lab

Private-first football modelling workbench for 1X2, BTTS (Gol/No Gol), Over/Under, bookmaker-margin analysis, and statistical anomaly detection.

> Demo values are not live forecasts. Statistical deviations do not by themselves prove deliberate bookmaker manipulation.

## Included
- Poisson score-distribution baseline from expected goals (xG).
- Probabilities for 1X2, BTTS, Over/Under 1.5, 2.5 and 3.5.
- Implied probabilities, overround, proportional de-vigging, expected value and model-market divergence.
- Transparent anomaly flags.
- Brier score, log loss and calibration-bin evaluation helpers.
- Local FastAPI endpoints, CLI, tests, provider-independent data contracts.

## Quick start
Python 3.11+ recommended.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m matchmind.cli demo
python -m matchmind.cli analyse --home-xg 1.55 --away-xg 1.10
pytest -q
uvicorn matchmind.api:app --reload
```

Open http://127.0.0.1:8000/docs for local API docs. Do not expose it publicly without authentication, HTTPS, rate limiting and secrets management.

## Data sources and licensing
- Historical results/odds: football-data.co.uk offers downloadable files for personal research, but its terms restrict commercial use and automated bots/scrapers/AI training products. This repository does not scrape it or use it for automated AI training. Download manually only if your intended use is permitted.
- Player statistics, injuries, squads and odds: API-Football documents endpoints for these categories. Availability and historical coverage depend on plan. Store credentials in environment variables; never commit API keys.
- StatsBomb Open Data covers selected competitions and requires attribution for published research/insights. Verify terms and coverage before use.

Every injury, lineup or odds record must preserve source and retrieval time. Missing/stale data should lower confidence rather than be silently treated as fact.

## Model roadmap
1. Fit team attack/defence strengths and home advantage from licensed historical data.
2. Compare Poisson, Dixon-Coles and other models using chronological walk-forward tests.
3. Add player availability only when source-verified and timestamped; calibrate its effect instead of applying arbitrary penalties.
4. Compare independent estimates with de-vigged bookmaker consensus and record odds snapshots.
5. Evaluate with Brier score, log loss, calibration, sample size and closing-line comparisons.
6. Label anomalies as observable signals, never as proof of intentional manipulation.

## Current limitations
This is a tested statistical scaffold, not yet a trained AI model and not connected to live sports data. No live predictions, injuries or odds are configured until a licensed provider and credentials/data are supplied.