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
4. Save and trigger a new deployment. If either value is missing, the app fails closed and returns HTTP 503.
5. Open the `*.pages.dev` URL from your phone. The browser will ask for username and password. Use HTTPS only; do not share the URL or credentials.

The app service worker deliberately does not cache the protected HTML page, so offline mode cannot bypass the authentication check. Data already stored by the browser remains on that phone; lock your device.

## Data and limitations

- Current Serie A results/fixtures: open-matchday public CSV, refreshed when the app opens.
- Historical Serie A scores: public football-dataset CSVs where available.
- Forecasts: transparent Poisson baseline calculated locally; 1X2, BTTS and Over/Under 1.5/2.5/3.5.
- A local browser cache keeps the last loaded match data available if the data provider is temporarily unavailable after the app is open.
- The no-key public source does not provide dependable player-level form, injuries, lineups or current pre-match odds. The app clearly labels those as unavailable instead of fabricating them. Connecting those inputs requires a source that provides them and may require an API key or different terms.
- Data providers can change URLs, coverage or availability; the app handles missing historical seasons gracefully.
- This is a research aid, not a trained AI model or a validated profitable betting system. Source attribution is shown in the app.
