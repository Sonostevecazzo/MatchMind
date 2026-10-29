# MatchMind Mobile PWA

Smartphone-first static web app. Forecast calculations run in the browser; the app does not require a MatchMind API server or a computer that stays on.

## Cloudflare Pages deployment

Create a Cloudflare Pages project connected to this private GitHub repository:
- Production branch: `main`
- Root directory: `mobile`
- Framework preset: None
- Build command: leave blank
- Build output directory: `.`

After the first deploy, Cloudflare assigns a `*.pages.dev` address; no purchased domain is required. In the Pages project, open **Settings → General → Enable access policy** and configure Cloudflare Access to protect the production `pages.dev` hostname. Restrict access to your own email/identity. Verify the actual hostname is protected before using it; do not rely on a client-side password screen for security.

## Data and limitations

- Current Serie A results/fixtures: open-matchday public CSV, refreshed when the app opens.
- Historical Serie A scores: public football-dataset CSVs where available.
- Forecasts: transparent Poisson baseline calculated locally; 1X2, BTTS and Over/Under 1.5/2.5/3.5.
- A local browser cache keeps the last loaded data available if the network is temporarily unavailable.
- The no-key public source does not provide dependable player-level form, injuries, lineups or current pre-match odds. The app clearly labels those as unavailable instead of fabricating them. Connecting those inputs requires a source that provides them and may require an API key or different terms.
- Data providers can change URLs, coverage or availability; the app handles missing historical seasons gracefully.
- This is a research aid, not a trained AI model or a validated profitable betting system. Source attribution is shown in the app.

The app is static: no personal analysis or credentials are uploaded to a MatchMind backend. Cloudflare Access protects who can open the website; it does not make the upstream public CSV data private.
