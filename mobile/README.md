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

### Protect it with your own username and password

The Pages Function at `functions/_middleware.js` protects all app paths using HTTP Basic authentication. In Cloudflare dashboard:
1. Open **Workers & Pages → your MatchMind Pages project → Settings → Variables and Secrets**.
2. Add `MATCHMIND_USERNAME` as a text variable with your chosen username.
3. Add `MATCHMIND_PASSWORD` as an encrypted secret with a long, unique password.
4. Save your changes.

### Enable injuries and player form (optional, free API tier)

The `functions/api/player-context.js` endpoint keeps the API key on Cloudflare's server; it is never inserted into browser code. To enable it:
1. Create a free API-Football account at https://dashboard.api-football.com/register. The provider currently lists a free tier of 100 requests/day without requiring a credit card.
2. Copy your API key from its dashboard.
3. In Cloudflare **Settings → Variables and Secrets**, add `API_FOOTBALL_KEY` as an **encrypted secret**. Do not place it in `index.html`, GitHub source, or a public setting.
4. Save all variables/secrets and trigger a new deployment. Without the API key, the base app still works and the player module explains why its data is disabled.
5. Open your `*.pages.dev` URL on your phone. The browser asks for the username and password. Use HTTPS only; do not share the URL or credentials.

The API-Football free tier is limited to 100 requests per day. Injury data is cached at the edge for up to four hours and player searches/form for up to six hours. A recent-form lookup can use multiple provider calls; avoid repeatedly forcing the same search. Coverage and update timing are controlled by the provider.

The app service worker deliberately does not cache the protected HTML page, so offline mode cannot bypass the authentication check. Data already stored by the browser remains on that phone; lock your device.

## Data and limitations

- Current Serie A results/fixtures: open-matchday public CSV, refreshed when the app opens.
- Historical Serie A scores: public football-dataset CSVs where available.
- Forecasts: transparent Poisson baseline calculated locally; 1X2, BTTS and Over/Under 1.5/2.5/3.5.
- A local browser cache keeps the last loaded match data available if the data provider is temporarily unavailable after the app is open.
- Optional API-Football module: upcoming reported injuries/questionable players and a search for Serie A player season statistics plus up to five recent appearances (minutes, goals, assists, rating and other fields where the provider supplies them).
- Player context requires the server-side encrypted `API_FOOTBALL_KEY` secret. It is intentionally not bundled in the PWA. If that secret is missing or the free quota is exhausted, the app explains the limitation rather than inventing values.
- The no-key public CSV source does not provide dependable player-level form, injuries, lineups or current pre-match odds.
- Data providers can change URLs, coverage or availability; the app handles missing historical seasons gracefully.
- This is a research aid, not a trained AI model or a validated profitable betting system. Source attribution is shown in the app.
