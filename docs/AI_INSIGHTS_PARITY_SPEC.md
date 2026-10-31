# MatchMind AI Insights — feature-parity specification

**Research date:** 2026-11-01  
**Scope:** AI match analysis only. This document does not propose copying SofaScore source code, private endpoints, branding, screenshots, or proprietary model weights. The target is an independently implemented feature set with comparable user-visible behaviour.

## 1. Evidence about SofaScore AI Insights

### Officially documented

SofaScore's own FAQ identifies **Sofascore Analyst (AI Insights)** as a premium pre-match football-analysis feature. It says the available match insights can include:

- Full-time 1X2 probabilities.
- Both-teams-to-score (BTTS) prediction.
- Total-goals and total-corners projections.
- Head-to-head comparison.
- Recent team form.
- Key players and injuries.
- Tactical and statistical overview.
- A post-match update that lets the user compare the forecast with the final result.

The same FAQ says coverage spans 180+ football leagues, while warning that the available content varies by match. It does not publish the internal model architecture, features' weights, training process, calibration data, or a verified historical prediction record.

Official documentation: https://sofascore.helpscoutdocs.com/article/231-what-is-sofascore-analyst-ai-insights

The FAQ's official screenshots expose additional output details:
- Pre-match forecast summary: projected yellow cards, projected corners, BTTS, most likely full-time winner and home/draw/away probabilities.
- A correct-score probability matrix.
- On a finished match, a view switch between pre-match and half-time analysis, plus a visible check of whether the predicted winner was correct.

Screenshots:
- Pre-match: https://d33v4339jhl8k0.cloudfront.net/docs/assets/59dc89a4042863379ddc8809/images/698dd6934bfa24dbaea591e2/file-bAfPwfuEW7.png
- Post-match: https://d33v4339jhl8k0.cloudfront.net/docs/assets/59dc89a4042863379ddc8809/images/698dd76601066426f096e0df/file-9WkKLkkXK2.png

The Italian App Store listing's August 2026 release notes mention new Plus and Pro subscription plans that unlock extra match insights, analysis and win probabilities. The public FAQ labels AI Insights as a premium feature but does not give a stable country-independent price or a complete plan-entitlement matrix. MatchMind must not hard-code SofaScore's plan names or pricing.

App Store listing: https://apps.apple.com/it/app/sofascore-risultati-diretta/id1176147574

### Additional feature discovery — unofficial source

A third-party API marketplace documents a post-match endpoint purporting to return SofaScore AI Insights. Its example response exposes a richer possible payload:

- Prediction fields: yellow cards, corners, BTTS, normal-time score, 1X2 winning probabilities and a score-probability matrix.
- Narrative sections: match context, current form, head-to-head, key players/tactical notes, referee/cards/corners and match prediction.
- Half-time predictions: next team to score, next player to score, second-half over 1.5 goals and projected full-time score.
- Half-time narrative: match context at the break, attack momentum, tactical notes, key player performances, discipline/corners and second-half outlook.

Reference: https://zylalabs.com/api-marketplace/sports%2B%26%2Bgaming/sofascore%2B-%2Blive%2Bapi/12787

This is **not official SofaScore documentation** and must be treated as a feature-discovery example only. Its sample output is not proof that every field is available for every match, nor proof of SofaScore's internal calculation method. Do not make MatchMind depend on this API or on undocumented SofaScore endpoints.

A third-party review also describes the Pro plan as including AI Insights, form, injury, corner, card and referee patterns. Treat subscription labels and entitlements as regional/app-version dependent:
https://with-bet.com/tools/stats/sofascore

## 2. MatchMind baseline at the research date

The inspected main branch already has part of the required statistical foundation:

| Capability | Existing state |
|---|---|
| 1X2 probabilities | Implemented in the browser Poisson baseline and Python statistical model |
| BTTS and goal totals | Implemented from the goal-score probability distribution |
| Expected goals | Estimated from historical goals; not event-derived xG |
| Correct-score distribution | A score matrix exists in matchmind/model.py; the mobile match UI does not currently render the full probability heatmap |
| Recent team form | Last-ten results with last-five W/D/L indicators in the mobile data layer |
| Chronological standings context | Implemented in mobile/rounds.js, excluding same-date and future results |
| Injuries/player context | Optional API-Football integration exists; coverage depends on provider plan and match lookup |
| Player season/recent statistics | Optional API-Football integration exists |
| Odds | Optional The Odds API / OddsPapi integrations exist; these are contextual and not automatically valid model inputs |
| H2H insight section | No dedicated AI Insights comparison/narrative section verified in the current match screen |
| Corners and yellow-card forecasts | Not implemented as validated forecasts |
| Referee pattern analysis | Not implemented |
| Match-event/tactical narrative | News and basic team context exist; no complete structured tactical analysis |
| Half-time prediction | Not implemented |
| Immutable pre-match/half-time forecast snapshots | Not implemented as a complete lifecycle |
| Post-match forecast audit | A chronological 1X2 backtest exists, but not an immutable per-match pre-match/half-time Insights record |
| Trained AI/LLM analyst | Not present; the current probability engine is statistical, not a trained AI model |

Important source files inspected:
- mobile/site-core.js
- mobile/site-pages.js
- mobile/rounds.js
- mobile/analysis-lab.html
- mobile/functions/api/player-context.js
- matchmind/model.py
- matchmind/historical_model.py
- matchmind/storage.py
- matchmind/api.py

The current public CSV fallback primarily supplies fixtures and scores. It does not provide the event-level match statistics, referees, player availability and live state needed to make the full premium-style analysis credible. In addition, the most recent live-provider smoke check failed because the configured API-Football free plan did not cover Serie A season 2026; the downstream live fixture/injury/odds checks were therefore not completed.

## 3. Independent MatchMind implementation

Implement this as a new **AI Insights** layer over MatchMind's existing data and model. Keep the predictor, evidence builder and language-generation layer separate.

### A. Pre-match forecast card

Render these outputs on each eligible match:

1. Full-time winner label and 1X2 probabilities (must sum to 100%).
2. BTTS Yes/No.
3. Expected total goals and goal-line probabilities.
4. Expected total corners.
5. Expected total yellow cards.
6. Correct-score probability heatmap (at least 0–5 goals per side, with an explicit residual/tail treatment).
7. Forecast timestamp, model version, history window, sample size and data freshness.
8. A clear reason when a field is not available or a sample is insufficient.

Never convert missing statistics to zero and never present a league average as if it were a match-specific forecast.

### B. Statistical models

**Goals / scoreline**
- Upgrade the existing goals-only Poisson baseline toward a time-decayed Dixon–Coles or bivariate-Poisson score model.
- Estimate team attack/defence separately for home and away, with league-level shrinkage and opponent-strength adjustment.
- Use xG only where the provider supplies comparable, licensed xG data; do not relabel goals-derived estimates as observed xG.
- Derive 1X2, BTTS, goal totals and the correct-score matrix from the same score distribution so outputs remain mathematically coherent.
- Calibrate probabilities on chronological out-of-sample seasons. Store calibration version and test sample size.

**Corners**
- Build a separate count model, beginning with a negative-binomial model (or Poisson if the observed dispersion supports it).
- Candidate inputs: each team's home/away corners for and against, competition baseline, recent trend, possession/territory proxies, shots/crosses/attacks where available, opponent profile and match state.
- Output expected total, a prediction interval and probabilities for selected lines only when the sample and calibration are adequate.

**Yellow cards**
- Build a separate count model using referee cards per match, each team's cards/fouls, competition baseline, home/away splits and historical match context.
- Do not infer a referee average when the referee is unknown.
- Output expected total and uncertainty interval. Treat red cards separately rather than silently folding them into yellow cards.

Goals, corners and cards are different statistical targets and must not share one improvised formula. Each requires its own historical target data, evaluation and calibration.

### C. Evidence panels and narrative

Generate structured, traceable sections:

1. **Match context:** competition, date, venue and standings snapshot as of kick-off.
2. **Recent form:** last 5 and last 10, with home/away splits, goals for/against and sample dates.
3. **Head-to-head:** recent meetings before kick-off, with the number of matches and date range. Avoid overstating H2H when the sample is small or managers/squads have changed.
4. **Key players and availability:** injuries, suspensions, probable/confirmed lineup, player minutes, starts, goals, assists and role-specific metrics when provided.
5. **Tactical matchup:** evidence-backed style indicators such as possession, shot volume, pressing proxies, crosses, set pieces and defensive/attacking tendencies. If event/positional data are unavailable, show a limited statistical overview, not invented tactical claims.
6. **Referee, cards and corners:** referee identity and historical averages, team discipline and set-piece/corner trends, each with sample size.
7. **Model verdict:** the strongest signals, counter-signals, uncertainty and missing data.

An optional LLM may turn this structured evidence into readable Italian. The LLM must not calculate or invent probabilities, player absences, referees, quotes or statistics. Every numerical statement must link to a stored field, source and as_of timestamp. If a data field is unavailable, the narrative must say so.

### D. Half-time / in-play analysis

Only enable this view when a licensed live feed provides a valid score, match minute, events and relevant half-time statistics.

At half-time, calculate a new conditional forecast using:
- current score and remaining time;
- red cards and substitutions;
- shots and shots on target;
- xG/chance quality if available;
- corners, possession, dangerous attacks and other tracked statistics.

Outputs may include:
- probability of the next goal by team;
- second-half goal distribution and Over 0.5 / Over 1.5 probabilities;
- projected full-time score distribution;
- remaining corners/cards where the data and model are validated;
- player-to-score projection only when the starting/active lineup and player-level evidence are sufficient.

Keep the pre-match forecast immutable. Store a separate half-time snapshot. Do not rewrite a failed pre-match forecast with the live or final result.

### E. Post-match review

After full-time:
- compare the frozen pre-match and half-time forecasts with the actual result;
- grade winner, BTTS, goals, corners and cards separately;
- show correct/incorrect outcomes without hiding failures;
- report sample size, Brier score/log loss for probabilities, calibration by confidence band, and MAE/Poisson deviance for count forecasts;
- show results by league and model version;
- never imply profitability from hit rate alone.

For old matches that have no frozen forecast record, label any reconstructed estimate **historical replay**, not an actual pre-match prediction.

## 4. Data provider requirements

### Existing provider: API-Football

Its public documentation lists fixtures/statistics fields including shots, fouls, corners, possession, yellow/red cards, saves and passing statistics. It supports half-specific statistics through half=true; its events endpoint supplies goals, cards and substitutions. Coverage and historical availability vary by league/season and plan.

Documentation:
- https://www.api-football.com/documentation_v3
- https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide

This is the lowest-friction integration path because MatchMind already has an API-Football adapter. But the current free-plan 2026 Serie A coverage failure is a hard blocker; a working API key alone is not proof of season/endpoint coverage.

### Alternative to evaluate: Sportmonks

Sportmonks advertises fixtures, events, detailed team/player match statistics, lineups, injuries/suspensions, referee data, historical records and xG. Its public football API page currently lists Growth starting at €99/month for up to 30 leagues and Pro at €249/month for up to 120 leagues. Prices and data coverage must be rechecked before a purchase.

- https://www.sportmonks.com/football-api/
- https://www.sportmonks.com/football-api/football-stats-api/

### Public fallback

Keep the existing public results/fixtures fallback for basic goals and form calculations only. It is not a substitute for historical corners, cards, referee, lineup, injury and event-statistics feeds.

## 5. Proposed internal data contract

Every incoming statistic should be normalized into a common shape, independent of provider:

- fixture_id, league_id, season, kickoff_utc
- team_id, opponent_id, home_away
- stat_type, stat_value, period (FT, HT, 1H, 2H)
- player_id or referee_id where relevant
- source, source_record_id, retrieved_at, valid_at
- coverage_status and a nullable value (never replace missing values with zero)

Persist immutable forecast snapshots with:
- fixture_id, forecast_stage (PREMATCH, HALFTIME, optional live minute)
- created_at, as_of, model_version, data_snapshot_id
- structured predictions, confidence/sample checks, source coverage and disclaimer

This schema is necessary for no-lookahead guarantees, auditability and honest post-match grading.

## 6. Delivery phases and acceptance criteria

**Phase 1 — MatchMind AI Insights UI and scoreline output**
- Add an AI Insights panel using existing 1X2 / BTTS / goals estimates.
- Render the correct-score probability matrix from the same distribution.
- Add evidence blocks for recent form, H2H and available injuries/player context.
- Distinguish observed values, model estimates and unavailable values.
- Tests cover probability normalization, score-matrix reconciliation, date cut-offs and insufficient history.

**Phase 2 — Corners and cards**
- Add historical match-statistics ingestion and storage.
- Add separate count models, data freshness and sample gates.
- Tests cover missing referee/stats, small samples, home/away effects, over-dispersion and chronological leakage.
- Do not show projected values until backtest and calibration gates pass.

**Phase 3 — Tactical and player intelligence**
- Add lineups, player match statistics, injuries/suspensions, referee data and tactical indicators through a licensed provider.
- Make narratives evidence-grounded and source-traceable.
- Tests verify that unsupported claims cannot be generated from absent fields.

**Phase 4 — Half-time and post-match lifecycle**
- Capture immutable pre-match and half-time snapshots.
- Add conditional second-half models only when live data coverage is confirmed.
- Grade all predictions after full-time, including misses.
- Publish calibration and error metrics by market/league/model version.

### Release gate

Do not call the feature complete until:
1. fixtures, match stats, injuries/player availability and (where applicable) referee data pass live endpoint smoke checks for the actual target competitions and current season;
2. model outputs pass chronological out-of-sample evaluation and calibration checks;
3. every AI narrative number is traceable to a normalized data record;
4. the pre-match forecast is persisted before kick-off and cannot be overwritten;
5. the post-match audit grades every eligible forecast.

**Positioning:** MatchMind can reproduce the documented user-facing AI Insights workflow, but it cannot honestly claim to reproduce SofaScore's proprietary model or achieve the same accuracy. MatchMind's implementation should be independently built, measurable and transparent.
