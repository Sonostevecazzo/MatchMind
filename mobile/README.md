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

- **OddsPapi** for Sisal IT quotes only: create a key at https://oddspapi.io/sportsbooks/sisal-it. MatchMind requests only `sisal.it` and supported 1X2, BTTS and Over/Under 2.5 markets. Fixture data are cached for 30 minutes, market metadata for 24 hours, and match quotes for 15 minutes; the browser reuses match context for 5 minutes.
- **football-data.org** as a Serie A calendar/results fallback: register at https://www.football-data.org/client/register. Its free tier includes Serie A fixtures and delayed scores, with 10 requests/minute. MatchMind calls it only when the primary public CSV is unavailable and caches the season response for six hours.
- **API-Football** for reported injuries, player-season stats and recent player appearances: create a free account at https://dashboard.api-football.com/register. Its free tier currently lists 100 requests/day. This source is still needed for Serie A injury and player data; the two alternatives above do not replace it.

In Cloudflare **Settings → Variables and Secrets**, add each available key as an **encrypted secret**:

| Secret name | Enables |
| --- | --- |
| `ODDSPAPI_API_KEY` | Sisal IT pre-match quotes and the odds comparison |
| `FOOTBALL_DATA_API_KEY` | Backup Serie A fixtures/results when the primary CSV source is down |
| `API_FOOTBALL_KEY` | Injuries, player statistics and recent appearances |

After saving secrets, trigger a new deployment. You can add only the providers you want; the base app and existing public CSV source continue to work without them. Open **Impostazioni** to enter and test an API-Football key for the current browser session, or configure encrypted secrets in Cloudflare for persistent use. The **Fonti e copertura** page shows which connections are active.

API-Football injury data is cached at the edge for up to four hours and player searches/form for up to six hours. A recent-form lookup can use multiple provider calls; avoid repeatedly forcing the same search. Provider quotas, coverage and update timing can change.

The app service worker does not cache the HTML page. Data already stored by the browser remains on that phone; lock your device.

## Data and limitations

- Current Serie A results/fixtures: open-matchday public CSV, refreshed when the app opens.
- Historical Serie A scores: public football-dataset CSVs where available.
- Forecasts: transparent Poisson baseline calculated locally; 1X2, BTTS and Over/Under 1.5/2.5/3.5. The match centre reports the historical date range and each team's actual sample size; a sample is labelled adequate only when at least 10 prior matches per team are available.
- A local browser cache keeps the last loaded match data available if the data provider is temporarily unavailable after the app is open.
- Optional API-Football module: upcoming reported injuries/questionable players and a search for Serie A player season statistics plus up to five recent appearances (minutes, goals, assists, rating and other fields where the provider supplies them).
- Optional OddsPapi module: Sisal IT prices for supported 1X2, BTTS and Over/Under 2.5 markets; the app compares them to MatchMind's estimate. Quotes are available only when Sisal offers the market for that fixture.
- Optional football-data.org fallback: current season fixtures and delayed results when the primary public CSV source cannot be reached.
- Potential value is flagged at estimated EV of at least +5% only when the historical sample is sufficient. If injury data is missing or incomplete, the comparison uses the base historical estimate, labels it as such and asks the user to verify lineups; no partial injury adjustment is applied.
- Missing keys, provider quota exhaustion and absent coverage are shown rather than filled with invented data. Secrets remain server-side.
- The no-key public CSV source does not provide dependable player-level form, injuries, lineups or current pre-match odds.
- Data providers can change URLs, coverage or availability; the app handles missing historical seasons gracefully.
- This is a research aid, not a trained AI model or a validated profitable betting system. Source attribution is shown in the app.


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


## Quote comparison and betting-analysis guidance

The match detail page can compare available pre-match 1X2, BTTS and Over/Under 2.5 prices from Sisal IT only. It displays the provider and last update, uses the Sisal price returned for each outcome, removes the market overround by normalizing implied probabilities, and compares those values with the local Poisson estimate.

A possible positive-value signal is shown only when:
- the historical sample meets the existing minimum threshold;
- the provider supplied a quote timestamp no older than two hours;
- at least two outcomes in the same market can be compared; and
- the model's theoretical expected value is above +3%.

Expected value is calculated as `(model_probability × decimal_odds) − 1`. This is an exploratory model-vs-market comparison, not evidence of a proven betting edge. The local Poisson model is not independently calibrated or validated for profitability; positive EV can be misleading when its probabilities are inaccurate. If data are missing, stale, or insufficient, the app should say that no suggestion is available rather than inventing one. The most likely outcome and the best-priced/value candidate are shown as different concepts.

The **Fonti e copertura** page links to the upstream datasets and providers and explains their role and limitations. Provider API keys must remain encrypted Cloudflare Pages secrets.


## Team and competition identity

Team crests and the Serie A competition mark use API-Sports media URLs. Team names from the public CSV are normalized and mapped to stable API-Football team IDs; unknown names retain a generated initials fallback rather than displaying an unrelated crest. The league mark uses competition ID 135. Logo assets are loaded lazily and are not counted against the API-Football daily request quota according to its documentation. API-Sports states that third-party marks are supplied for identification only and may require separate permission from the relevant clubs or rights holders; verify licensing before public or commercial distribution.

The match calendar includes a team dropdown in addition to search, date, round and season filters. Filter state is reset together from the clear-filters action.
