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

The `functions/api/player-context.js` endpoint calls providers from Cloudflare Pages Functions. Keys stay on the server and are never inserted into browser code or sent back to the page.

Optional sources:

- **The Odds API** for international bookmaker quotes: create a free key at https://the-odds-api.com/. Its Starter plan currently includes 500 credits/month. MatchMind requests European 1X2 and totals markets; one uncached request costs 2 credits and the shared response is cached at Cloudflare for 90 minutes. The browser reuses a match quote for at most 45 minutes. The provider's available bookmakers and markets can vary by match.
- **football-data.org** as a Serie A calendar/results fallback: register at https://www.football-data.org/client/register. Its free tier includes Serie A fixtures and delayed scores, with 10 requests/minute. MatchMind calls it only when the primary public CSV is unavailable and caches the season response for six hours.
- **API-Football** for reported injuries, player-season stats and recent player appearances: create a free account at https://dashboard.api-football.com/register. Its free tier currently lists 100 requests/day. This source is still needed for Serie A injury and player data; the two alternatives above do not replace it.

In Cloudflare **Settings → Variables and Secrets**, add each available key as an **encrypted secret**:

| Secret name | Enables |
| --- | --- |
| `THE_ODDS_API_KEY` | International pre-match quotes and the odds comparison |
| `FOOTBALL_DATA_API_KEY` | Backup Serie A fixtures/results when the primary CSV source is down |
| `API_FOOTBALL_KEY` | Injuries, player statistics and recent appearances; also a fallback for quotes |

After saving secrets, trigger a new deployment. You can add only the providers you want; the base app and existing public CSV source continue to work without them. Open the app's **Giocatori** or **Dati e copertura** section to see which connections are active.

API-Football injury data is cached at the edge for up to four hours and player searches/form for up to six hours. A recent-form lookup can use multiple provider calls; avoid repeatedly forcing the same search. Provider quotas, coverage and update timing can change.

The app service worker does not cache the HTML page. Data already stored by the browser remains on that phone; lock your device.

## Data and limitations

- Current Serie A results/fixtures: open-matchday public CSV, refreshed when the app opens.
- Historical Serie A scores: public football-dataset CSVs where available.
- Forecasts: transparent Poisson baseline calculated locally; 1X2, BTTS and Over/Under 1.5/2.5/3.5.
- A local browser cache keeps the last loaded match data available if the data provider is temporarily unavailable after the app is open.
- Optional API-Football module: upcoming reported injuries/questionable players and a search for Serie A player season statistics plus up to five recent appearances (minutes, goals, assists, rating and other fields where the provider supplies them).
- Optional The Odds API module: European bookmaker prices for supported 1X2 and main totals markets; the app compares them to MatchMind's estimate. The free monthly credit quota can be exhausted.
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
- `legacy-workbench.html`: preserved previous analysis workbench for continuity.

The shared navigation and data layer lives in `site-core.js`; page-specific rendering lives in `site-pages.js`; responsive presentation lives in `site.css`. The service worker caches the independent screens and their shared assets for app-shell use. The home navigation shows only four primary destinations; contextual screens are reached from Explore, fixtures, teams or the match detail.
