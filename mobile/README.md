# MatchMind Mobile PWA

Smartphone-first static web app. Forecast calculations run in the browser; the app does not require a MatchMind API server or a computer that stays on.

## Cloudflare Pages deployment

Create a Cloudflare Pages project connected to the public GitHub repository:
- Production branch: `main`
- Root directory: `mobile`
- Framework preset: None
- Build command: leave blank
- Build output directory: `.`

After the first deploy, Cloudflare assigns a `*.pages.dev` address; no purchased domain is required.

### Access and privacy

The deployed app is public: anyone who has its Pages URL can open and use it. Do not enter or store sensitive personal data in the app. Match forecasts are calculated locally in the browser.

### Free-first data setup

The base PWA works without paid services, API keys, or a separate MatchMind server. Calendar data, historical results and forecasts are loaded or calculated in the browser.

The only optional API integration currently implemented is the Live Match Centre:
- **ESPN public scoreboard** is the no-key fallback for Serie A and UEFA Champions League. It is an unofficial public feed with no service-level guarantee; scores may be delayed and detailed events, statistics or lineups may be missing.
- **API-Football** can provide richer live match details when coverage is available. The optional free plan has a limited daily request quota (advertised as 100 requests/day; check the provider's current terms and coverage). Add `API_FOOTBALL_KEY` only as an encrypted Cloudflare Pages secret. The Live endpoint consolidates match details into one fixture request and uses edge caching to reduce calls.

No API key is required for the calendar, historical analysis, predictions or local bet-slip builder. Do not configure paid odds providers to use the current app: bookmaker odds, direct Sisal account access, ticket import/OCR, injuries and player statistics are **not currently integrated**. The legacy `functions/api/player-context.js` endpoint is intentionally disabled and returns HTTP 410.

The service worker caches the app shell (pages, CSS and JavaScript) for previously visited routes, but deliberately does not cache API responses. Match data and historical results are stored separately in the browser cache; offline views therefore depend on the last successful data refresh. Newly published fixtures and scores require a network connection.

## Data and limitations

- Current Serie A results/fixtures: open-matchday public CSV, refreshed when the app opens; openfootball/football.json fills missing current-season fixtures/results when available.
- Historical Serie A scores: public football-dataset CSVs where available, with openfootball JSON as a fallback for missing seasons.
- Recent team-related articles: keyless Google News RSS search on each match detail page (up to six links from the previous 21 days). Headlines are editorial context only, not verified injury/lineup reports and not model inputs.
- Forecasts: Elo is used for 1X2 probabilities when the competition has at least 30 prior results and each team has at least 10 prior matches; Poisson continues to drive expected goals, score matrix, BTTS and Over/Under. The Elo rating starts at 1500, uses K=20, a 40-point home advantage and a smoothed historical draw prior. The chronological Elo backtest is independent of the production model and is displayed beside a Poisson-only baseline; MatchMind Adaptive AI runs a daily walk-forward calibration on the available historical results on each device. It trains a temperature parameter for 1X2 probabilities, reserves the latest 30% of out-of-sample forecasts for validation, and activates calibration only with at least 120 eligible forecasts, at least 40 validation cases, and improvement in both log loss and Brier score. If any gate fails, the Elo 1X2 probabilities remain unchanged. The model is stored in that browser's localStorage and is retrained when the data signature changes or a new day begins; there is no shared server-side model across devices. The adaptive layer learns only a temperature calibration; Elo team ratings are reconstructed from historical results. The app trains each configured competition separately from the full unfiltered history array; however, the current public archive contains five prior seasons for Serie A only. Champions League currently has current-season results but no multi-season historical archive in this feed, so its calibration correctly remains inactive until enough historical data is supplied. 1X2, BTTS and Over/Under 1.5/2.5/3.5. The match centre reports the historical date range and each team's actual sample size; a sample is labelled adequate only when at least 10 prior matches per team are available. The Intelligence page also runs a chronological walk-forward backtest: each tested fixture is forecast only with earlier-dated results, and fixtures are excluded unless both teams have at least 10 prior matches and the historical baseline has at least 30 prior matches. It reports 1X2 accuracy, log loss, multiclass Brier score, calibration bands and comparison with a Laplace-smoothed historical 1X2-frequency baseline.
- A local browser cache keeps the last loaded match data available if the data provider is temporarily unavailable after the app is open.
- Live Match Centre: API-Football is optional and may return events, statistics and lineups only when the provider's plan and competition coverage support them; ESPN is the no-key fallback.
- Bookmaker odds and Sisal: not integrated in this version. The app does not calculate odds-based expected value or bookmaker payouts.
- Player injuries and player-season statistics: not integrated in this version.
- Bet slips: selections and monitoring are managed locally in the browser using statistical probabilities and available final scores. The app does not connect to a Sisal account or import tickets automatically.
- Missing keys, provider quota exhaustion and absent coverage are shown rather than filled with invented data. Secrets remain server-side.
- The no-key calendar sources do not provide dependable player-level form, injuries, lineups or current pre-match odds. ESPN is only a fallback for live scores; it does not guarantee detailed event or team-stat coverage.
- Data providers can change URLs, coverage or availability; the app handles missing historical seasons gracefully.
- This is a research aid, not a validated profitable betting system. Adaptive AI calibration is experimental, device-local and only activated after out-of-sample validation; the optional generative explanation layer is rule-based and does not call a paid external LLM. Source attribution is shown in the app.


## Forecast validation — reproducible benchmark

A chronological walk-forward benchmark was run on the public Serie A CSV seasons 2021/22 through 2025/26 from [qhtexas/football-dataset](https://github.com/qhtexas/football-dataset/tree/main/datasets/serie-a). The extracted archive contained 1,900 completed fixtures from 2021-08-21 to 2026-05-24. The current Poisson model produced 1,733 eligible out-of-sample forecasts from 2021-10-30 to 2026-05-24 after requiring at least 30 earlier league matches and at least 10 earlier matches for each participating team. All fixtures on the target date were excluded from that forecast's history.

| Model | Accuracy | Multiclass log loss | Multiclass Brier |
| --- | ---: | ---: | ---: |
| Current Poisson model | 50.03% | 1.0173 | 0.6090 |
| Laplace-smoothed league-frequency baseline | 40.33% | 1.0875 | 0.6591 |

The current model improved all three aggregate metrics in this specific five-season sample. The Wilson 95% interval for its accuracy is approximately 47.68%–52.38%. This interval concerns top-pick accuracy only; it does not establish a stable advantage over the baseline. The 80%–100% top-pick confidence band contained only 20 forecasts and achieved a 65% hit rate, so high-confidence forecasts require particular caution.

A controlled venue-split experiment was also evaluated on the same 1,733 fixtures. It used each home team's prior home matches and each away team's prior away matches, with shrinkage toward league averages (five pseudo-matches). It did not improve on the current model: accuracy 50.09%, log loss 1.0213 and Brier 0.6113. It was therefore not adopted. This is an important negative result: added complexity is not automatically an improvement.

The Intelligence page now reports calibration by 1/X/2 outcome, a Wilson interval for accuracy, and season-by-season diagnostics. The in-app backtest explicitly bypasses any locally stored adaptive calibration and evaluates the unchanged Poisson baseline, avoiding contamination from a model trained on the same archive. Adaptive calibration is evaluated separately on its chronological holdout. The in-app backtest is recomputed from the currently loaded archive, so its results may differ if the provider changes or extends the data. This benchmark is a historical diagnostic, not a guarantee of future performance, a bookmaker comparison, or a profitability test. The public dataset's historical availability and completeness are external dependencies.


## Multi-screen navigation

The mobile PWA is organised into separate routes rather than one long dashboard:
- `index.html`: home, upcoming fixtures and followed teams.
- `matches.html`: match calendar with date, team, round and status filters.
- `explore.html`: available competition and team directory.
- `league.html`: Serie A standings, fixtures and season totals.
- `team.html`: individual team profile and recent form.
- `match.html`: match details, local statistical estimates and available prematch context.
- `players.html`: player search and recent appearances, subject to API-Football coverage.
- `analysis-lab.html`: dedicated MatchMind intelligence entry point.
- `data.html`: provider status and data coverage.
- `settings.html`: provider configuration, session key testing and app preferences.
- `legacy-workbench.html`: preserved previous analysis workbench for continuity.

The shared navigation and data layer lives in `site-core.js`; page-specific rendering lives in `site-pages.js`; responsive presentation lives in `site.css`. The service worker caches the independent screens and their shared assets for app-shell use. The mobile navigation provides five primary destinations: Home, Partite, Club, Analisi and Impostazioni. Provider coverage is linked from Impostazioni.


## Bet slip checker

The **Le mie scommesse** screen (bets.html) accepts text copied from a Sisal ticket, groups fixture and market lines, matches upcoming Serie A fixtures in the local calendar, and compares the selected market with the local Poisson estimate. If a market is not recognised, the user can choose the correct market manually; the screen can also show the highest-probability market for a fixture as an alternative to review.

The **Verifica quote Sisal** action calls the existing same-origin Cloudflare Pages Function (type=match) and reads only the supported Sisal IT odds returned by OddsPapi. It does not request Sisal credentials, log into a betting account, or place a bet. Quotes are market- and fixture-specific and may be unavailable; the UI surfaces provider errors rather than filling missing prices.

The **Costruttore probabilistico** defaults to a 55% minimum estimated probability for the complete combination and limits the proposal to five selections. It only uses upcoming fixtures for which both teams meet the current historical-sample adequacy rule. The joint probability is the product of the individual model probabilities and explicitly assumes independence between matches; this assumption is not verified. The model is a Poisson baseline, not a validated betting strategy. The threshold is not a guarantee, an expected return, or evidence of positive value. The imported ticket draft is saved in the current browser's local storage on that device only; do not use shared devices for personal ticket records.
## Quote comparison and betting-analysis guidance

The match detail page can compare available pre-match 1X2, BTTS and Over/Under 2.5 prices from Sisal IT only. It displays the provider and last update, uses the Sisal price returned for each outcome, removes the market overround by normalizing implied probabilities, and compares those values with the local Poisson estimate.

A possible positive-value signal is shown only when:
- the historical sample meets the existing minimum threshold;
- the provider supplied a quote timestamp no older than two hours;
- at least two outcomes in the same market can be compared; and
- the model's theoretical expected value is above +3%.

Expected value is calculated as `(model_probability × decimal_odds) − 1`. This is an exploratory model-vs-market comparison, not evidence of a proven betting edge. The local Poisson model is not independently calibrated or validated for profitability; positive EV can be misleading when its probabilities are inaccurate. The backtest is a predictive-quality diagnostic, not a profitability test: it does not simulate odds, bookmaker margin, stake sizing, limits or transaction costs. If data are missing, stale, or insufficient, the app should say that no suggestion is available rather than inventing one. The most likely outcome and the best-priced/value candidate are shown as different concepts.

The **Fonti e copertura** page links to the upstream datasets and providers and explains their role and limitations. Provider API keys must remain encrypted Cloudflare Pages secrets.


## Team and competition identity

Team crests and the Serie A competition mark use API-Sports media URLs. Team names from the public CSV are normalized and mapped to stable API-Football team IDs; unknown names retain a generated initials fallback rather than displaying an unrelated crest. The league mark uses competition ID 135. Logo assets are loaded lazily and are not counted against the API-Football daily request quota according to its documentation. API-Sports states that third-party marks are supplied for identification only and may require separate permission from the relevant clubs or rights holders; verify licensing before public or commercial distribution.

The match calendar includes a team dropdown in addition to search, date, round and season filters. Filter state is reset together from the clear-filters action.


## Experimental Elo benchmark

The Intelligence page also reports a chronological Elo benchmark against the Poisson-only baseline. It starts unseen teams at 1500, normalizes known Serie A aliases, uses K=20 and a fixed 40-point home advantage, and derives draw probability from a Beta-smoothed draw frequency observed strictly before the target date. The expected-score conversion is constrained to valid 1X2 probabilities. All fixtures on the same calendar date are forecast from the same pre-date rating snapshot; ratings and the draw prior are updated only after the entire date has been scored. A team absent from the historical archive (including a promoted team) therefore receives the neutral 1500 prior. Production Elo parameters are fixed at K=20 and 40 home-advantage points; the current replay uses a chronological 70/30 split. Draw probabilities use a smoothed historical prior rather than a separately fitted calibration model. Elo is used for production 1X2 forecasts when the sample gate passes. Its output is exploratory and must be judged by log loss and Brier alongside sample size, not accuracy alone. Elo now supplies production 1X2 probabilities when sample gates pass; Poisson remains the production source for xG, score matrix, BTTS and Over/Under. The AI temperature calibration is trained on the production 1X2 probabilities and remains disabled unless it improves both validation metrics.


### Elo parameter selection and holdout result

The production Elo parameters remain fixed at K=20 and home advantage=40; they were not selected using the final holdout. A reproducible local replay on the five OpenFootball Serie A seasons (2021-08-21 to 2026-05-24) yielded 1,687 eligible forecasts. On the final chronological 30% (507 forecasts, 2025-01-15 to 2026-05-24), Elo achieved 55.03% top-pick accuracy, 0.9685 log loss and 0.5735 multiclass Brier; the Poisson-only baseline on the same fixtures achieved 55.82%, 0.9817 and 0.5839. Elo therefore improved probability quality (log loss and Brier) but had slightly lower top-pick accuracy. The replay mirrors the production algorithm and data rules; the in-app backtest is the authoritative live diagnostic and may differ if upstream data change. This is one historical holdout, not proof of future performance or profitability.


## Classifica, obiettivi stagionali e schedine per turno

Il motore `rounds.js` aggiunge il contesto della classifica alla data di ogni partita: punti, posizione, partite giocate, differenza reti e distanza dalle prime posizioni. Le etichette (zona Champions, zona Europa, corsa alle coppe, lotta salvezza, zona retrocessione) sono inferenze basate sulla classifica disponibile e sul numero di squadre della stagione; non sono dichiarazioni ufficiali dei club. Il calcolo usa solo risultati con data strettamente precedente alla partita analizzata e azzera la classifica al cambio di stagione.

La pagina Intelligence genera tre schedine per il turno successivo:
- 1X2: per ogni partita seleziona il segno con probabilità stimata più alta.
- Gol/No Gol: seleziona l'esito BTTS con probabilità più alta.
- Under/Over 2,5: seleziona il lato della linea 2,5 con probabilità più alta.

Per ogni gamba mostra la probabilità marginale. La probabilità complessiva è il prodotto delle probabilità delle singole selezioni, calcolato in log-spazio per evitare underflow numerico. Se anche una sola partita non ha un campione minimo adeguato, la probabilità complessiva viene omessa invece di essere inventata. Il prodotto assume indipendenza tra le partite: è una stima semplificata, non una probabilità congiunta calibrata. Le schedine non sono una raccomandazione di puntata e non dimostrano redditività.

Le probabilità delle schedine riutilizzano il modello Poisson esistente. Il contesto classifica è mostrato separatamente e non modifica ancora le probabilità: prima di introdurre un aggiustamento motivazionale servono un backtest walk-forward multi-stagione, confronto con Poisson senza contesto e calibrazione separata per mercato. Questa scelta evita di attribuire coefficienti arbitrari alla cosiddetta motivazione.


## Centro Live e simulazione

- La rotta `/api/live-match` usa un secret server-side Cloudflare per il provider live; la chiave non entra nel bundle del browser.
- Il piano gratuito API-Football dichiara 100 richieste al giorno. MatchMind aggiorna il punteggio live ogni 5 minuti e mette in cache la lista e il dettaglio partita per 5 minuti. Il dettaglio partita usa una sola richiesta `/fixtures?id=` per punteggio, eventi, statistiche e formazioni. Il monitoraggio schedine si aggiorna ogni 15 minuti solo quando la vista è aperta e ci sono eventi previsti nella data corrente. Il Live è adattivo: 5 minuti durante il gioco, 15 minuti prima del calcio d'inizio, 30 minuti se non ci sono eventi live e nessun polling dopo la fine.
- Il campo 2D è una rappresentazione tattica illustrativa basata sulle formazioni iniziali (se disponibili) e su statistiche aggregate per pressione/pallone. Sotto il campo sono elencati titolari e riserve forniti dal provider. Non è tracking GPS/optical né una ricostruzione della posizione live dei calciatori.
- Senza il secret, il Live mostra una condizione non disponibile, mentre calendario e analisi storiche continuano a funzionare.
