# MatchMind Mobile PWA

Smartphone-first static web app. Forecast calculations run in the browser; the app does not require a MatchMind API server or a computer that stays on.

## Cloudflare Pages deployment

Create a Cloudflare Pages project connected to this private GitHub repository:
- Production branch: `main`
- Root directory: `mobile`
- Framework preset: None
- Build command: leave blank
- Build output directory: `.`

After the first deploy, Cloudflare assigns a `*.pages.dev` address; no purchased domain is required.

### Access and privacy

The deployed app is public: anyone who has its Pages URL can open and use it. Do not enter or store sensitive personal data in the app. Match forecasts are calculated locally in the browser.

### Enable additional data sources with free tiers

The `functions/api/player-context.js` endpoint calls providers from Cloudflare Pages Functions. The preferred setup stores provider keys as encrypted Cloudflare secrets. The Settings screen also supports an optional API-Football key for the current browser session: it is held in `sessionStorage` and sent to the same-origin Pages Function in a request header, never in the URL or response. This is browser-accessible session storage, not encrypted server-side storage; use it only on a trusted personal device. For persistent multi-device use, configure the Cloudflare secret.

Optional sources:

- **The Odds API** as an optional 1X2 feed from available European bookmakers: get a key at https://the-odds-api.com/. Coverage and quota depend on the current plan; the feed is not a substitute for Sisal-specific prices.
- **OddsPapi** for Sisal IT quotes only: create a key at https://oddspapi.io/sportsbooks/sisal-it. MatchMind requests only `sisal.it` and supported 1X2, BTTS and Over/Under 2.5 markets. Fixture data are cached for 30 minutes, market metadata for 24 hours, and match quotes for 15 minutes; the browser reuses match context for 5 minutes.
- **PulseScore Sisal API** as the primary direct Sisal feed: obtain a key at https://pulsescore.net/dashboard. MatchMind authenticates server-side with the `x-secret` header, reads the Italian Serie A fixture list, then requests the selected event's full board. It maps full-time 1X2, BTTS and Over/Under 2.5 into the quote comparison. Fixture and event responses are cached for 60 seconds.
- **football-data.org** as a Serie A calendar/results fallback: register at https://www.football-data.org/client/register. Its free tier includes Serie A fixtures and delayed scores, with 10 requests/minute. MatchMind calls it only when the primary public CSV is unavailable and caches the season response for six hours.
- **API-Football** as the primary Live Match Centre feed and optional source for reported injuries, player-season stats and recent player appearances: create an account at https://dashboard.api-football.com/register. The Live endpoint uses one fixture-detail request for events, statistics and lineups when coverage is available.
- **ESPN public scoreboard** as the no-key Live fallback for Serie A and UEFA Champions League: https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard and https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard. MatchMind uses it when API_FOOTBALL_KEY is missing or API-Football fails. These endpoints are undocumented/unofficial and have no service-level guarantee; scores may be delayed and detailed events, statistics or lineups may be missing.

In Cloudflare **Settings → Variables and Secrets**, add each available key as an **encrypted secret**:

| Secret name | Enables |
| --- | --- |
| `THE_ODDS_API_KEY` | Alternative 1X2 quotes from available EU bookmakers |
| `PULSESCORE_API_KEY` | Primary direct Sisal IT feed: Serie A fixtures and full match boards |
| `ODDSPAPI_API_KEY` | Optional fallback for Sisal IT pre-match quotes and the odds comparison |
| `FOOTBALL_DATA_API_KEY` | Backup Serie A fixtures/results when the primary CSV source is down |
| `API_FOOTBALL_KEY` | Injuries, player statistics and recent appearances |

After saving secrets, trigger a new deployment. PulseScore is the preferred Sisal source when `PULSESCORE_API_KEY` is present; OddsPapi is used as a fallback only when configured. You can add only the providers you want; the base app and existing public CSV source continue to work without them. Open **Impostazioni** to enter and test an API-Football key for the current browser session, or configure encrypted secrets in Cloudflare for persistent use. The **Fonti e copertura** page shows which connections are active.

API-Football injury data is cached at the edge for up to four hours and player searches/form for up to six hours. A recent-form lookup can use multiple provider calls; avoid repeatedly forcing the same search. Provider quotas, coverage and update timing can change.

The service worker caches the app-shell pages, CSS and JavaScript for previously visited routes, but deliberately does not cache API responses. Match data and historical results are stored separately in the browser cache; offline views therefore depend on the last successful data refresh. Newly published fixtures, scores and news require a network connection.

## Data and limitations

- Current Serie A results/fixtures: open-matchday public CSV, refreshed when the app opens; openfootball/football.json fills missing current-season fixtures/results when available.
- Historical Serie A scores: public football-dataset CSVs where available, with openfootball JSON as a fallback for missing seasons.
- Recent team-related articles: keyless Google News RSS search on each match detail page (up to six links from the previous 21 days). Headlines are editorial context only, not verified injury/lineup reports and not model inputs.
- Forecasts: transparent Poisson baseline calculated locally; 1X2, BTTS and Over/Under 1.5/2.5/3.5. The match centre reports the historical date range and each team's actual sample size; a sample is labelled adequate only when at least 10 prior matches per team are available. The Intelligence page also runs a chronological walk-forward backtest: each tested fixture is forecast only with earlier-dated results, and fixtures are excluded unless both teams have at least 10 prior matches and the historical baseline has at least 30 prior matches. It reports 1X2 accuracy, log loss, multiclass Brier score, calibration bands and comparison with a Laplace-smoothed historical 1X2-frequency baseline.
- A local browser cache keeps the last loaded match data available if the data provider is temporarily unavailable after the app is open.
- Optional API-Football module: upcoming reported injuries/questionable players and a search for Serie A player season statistics plus up to five recent appearances (minutes, goals, assists, rating and other fields where the provider supplies them).
- Optional OddsPapi module: Sisal IT prices for supported 1X2, BTTS and Over/Under 2.5 markets; the app compares them to MatchMind's estimate. Quotes are available only when Sisal offers the market for that fixture.
- Optional football-data.org fallback: current season fixtures and delayed results when the primary public CSV source cannot be reached.
- Potential value is flagged at estimated EV of at least +3% only when the historical sample is sufficient. If injury data is missing or incomplete, the comparison uses the base historical estimate, labels it as such and asks the user to verify lineups; no partial injury adjustment is applied.
- Missing keys, provider quota exhaustion and absent coverage are shown rather than filled with invented data. Secrets remain server-side.
- The no-key calendar sources do not provide dependable player-level form, injuries, lineups or current pre-match odds. ESPN is only a fallback for live scores; it does not guarantee detailed event or team-stat coverage.
- Data providers can change URLs, coverage or availability; the app handles missing historical seasons gracefully.
- This is a research aid, not a trained AI model or a validated profitable betting system. Source attribution is shown in the app.


## Forecast validation — reproducible benchmark

A chronological walk-forward benchmark was run on the public Serie A CSV seasons 2021/22 through 2025/26 from [qhtexas/football-dataset](https://github.com/qhtexas/football-dataset/tree/main/datasets/serie-a). The extracted archive contained 1,900 completed fixtures from 2021-08-21 to 2026-05-24. The current Poisson model produced 1,733 eligible out-of-sample forecasts from 2021-10-30 to 2026-05-24 after requiring at least 30 earlier league matches and at least 10 earlier matches for each participating team. All fixtures on the target date were excluded from that forecast's history.

| Model | Accuracy | Multiclass log loss | Multiclass Brier |
| --- | ---: | ---: | ---: |
| Current Poisson model | 50.03% | 1.0173 | 0.6090 |
| Laplace-smoothed league-frequency baseline | 40.33% | 1.0875 | 0.6591 |

The current model improved all three aggregate metrics in this specific five-season sample. The Wilson 95% interval for its accuracy is approximately 47.68%–52.38%. This interval concerns top-pick accuracy only; it does not establish a stable advantage over the baseline. The 80%–100% top-pick confidence band contained only 20 forecasts and achieved a 65% hit rate, so high-confidence forecasts require particular caution.

A controlled venue-split experiment was also evaluated on the same 1,733 fixtures. It used each home team's prior home matches and each away team's prior away matches, with shrinkage toward league averages (five pseudo-matches). It did not improve on the current model: accuracy 50.09%, log loss 1.0213 and Brier 0.6113. It was therefore not adopted. This is an important negative result: added complexity is not automatically an improvement.

The Intelligence page now reports calibration by 1/X/2 outcome, a Wilson interval for accuracy, and season-by-season diagnostics. The in-app backtest is recomputed from the currently loaded archive, so its results may differ if the provider changes or extends the data. This benchmark is a historical diagnostic, not a guarantee of future performance, a bookmaker comparison, or a profitability test. The public dataset's historical availability and completeness are external dependencies.


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

The Intelligence page also computes an independent, chronological Elo experiment. It starts unseen teams at 1500, normalizes known Serie A aliases, uses K=20 and a fixed 40-point home advantage, and derives draw probability from a Beta-smoothed draw frequency observed strictly before the target date. The expected-score conversion is constrained to valid 1X2 probabilities. All fixtures on the same calendar date are forecast from the same pre-date rating snapshot; ratings and the draw prior are updated only after the entire date has been scored. A team absent from the historical archive (including a promoted team) therefore receives the neutral 1500 prior. The Elo experiment's K and home-advantage parameters are selected on the pre-holdout training period only; the 2025/26 season remains a chronological holdout. Draw probabilities use a smoothed historical prior rather than a separately fitted calibration model. Elo is not used by production match forecasts. Its output is exploratory and must be judged by log loss and Brier alongside sample size, not accuracy alone. The current Poisson forecast remains unchanged.


### Elo parameter selection and holdout result

A small, predeclared grid was evaluated using only forecasts dated before 2025-08-01: K in {10, 15, 20, 25, 30} and home advantage in {40, 50, 60, 65, 70, 80} Elo points. The pair with the lowest training log loss was K=20 and home advantage=40. These settings were then evaluated on the untouched 2025/26 holdout (2025-08-01 through 2026-05-24), containing 370 eligible fixtures. Elo achieved 50.54% accuracy, 1.0116 log loss and 0.5984 multiclass Brier; Poisson on the same holdout fixtures achieved 50.00%, 1.0196 and 0.6098 respectively. On the full 1,733-forecast archive, selected Elo achieved 51.82% accuracy, 1.0010 log loss and 0.5976 Brier. This is encouraging but not definitive: the holdout contains one season only, the parameter grid is modest, and no market-odds or profitability test has been performed. Elo remains an experiment and Poisson remains the production match forecast. The separate fixed-parameter K=20 / home-advantage=65 experiment was not retained after the chronological holdout comparison.


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
