# MatchMind — Phase 1 UX redesign

## Product direction

Build a mobile-first football analytics PWA that combines the navigation clarity of FotMob and Flashscore, the statistical presentation patterns of SofaScore, and the bet-history/price-analysis workflows of Pikkit and Betstamp. MatchMind keeps its own visual identity and only reuses patterns, not third-party branding or assets.

## Current screen inventory

- `index.html`: Serie A dashboard, upcoming fixtures, saved clubs and quick links.
- `matches.html`: fixture calendar, date/team/round filters and historical results.
- `match.html`: match centre, team form, model probabilities, score matrix and contextual data.
- `league.html`: standings, fixtures and season statistics.
- `analysis-lab.html`: model insights, backtesting and round/ticket analysis.
- `bets.html`: Sisal ticket text import, market recognition, odds verification and probabilistic checks.
- `explore.html`: club directory and saved clubs.
- `team.html`: club profile and recent results.
- `players.html`: player lookup through optional provider.
- `data.html`: data-source and provider coverage.
- `settings.html`: optional provider keys and local settings.

## Phase 1 delivery sequence

### 1. Navigation and information architecture
- Five persistent destinations: Home, Partite, Analisi, Scommesse, Altro.
- Group league standings under Partite; keep the league page reachable through Home quick actions and secondary navigation.
- Give the bet manager a first-class destination and a correct active state.
- Preserve direct URLs and existing page controllers.

### 2. Home dashboard
- Replace the oversized marketing-first layout with an actionable Serie A overview.
- Keep the live data status, completed/upcoming counts, team count, next fixtures and favourites.
- Provide direct shortcuts to Analisi, Scommesse, Classifica and Esplora.
- Do not invent match, model or provider data.

### 3. Match and competition screens
- Standardize match cards, club crests, date grouping, state labels and responsive spacing.
- Make the match centre the primary detail view, with clear hierarchy between match context, probability estimates, historical form and source coverage.
- Keep standings and fixtures reachable without duplicating data logic.

### 4. Analysis and bet-management screens
- Separate model output from bookmaker prices and from user-entered bets.
- Surface sample adequacy, data freshness, source and model limitations close to the relevant metric.
- Use progressive disclosure: concise summary first, detailed diagnostics on demand.
- Keep Sisal verification read-only; never request bookmaker credentials or place bets.

### 5. Quality and accessibility
- Mobile-first layout, five-column bottom navigation, safe-area padding and no horizontal overflow.
- Visible keyboard focus, semantic landmarks, accessible labels and reduced-motion support.
- Preserve all existing DOM IDs used by page controllers unless controller and tests are updated together.

## Design principles

- Original MatchMind dark palette with restrained lime accent.
- Clear score/fixture hierarchy inspired by live-score apps.
- Compact metric cards and charts only where they clarify a decision.
- Consistent spacing, radii, typography and status semantics.
- No decorative stats, fabricated data, misleading confidence badges or guaranteed-win language.
- Use real team crests where already available; no copied third-party app screenshots or proprietary artwork.

## Phase 1 acceptance criteria

- All existing HTML routes remain available.
- Five primary navigation destinations render on mobile and desktop.
- Active navigation state is correct for Home, Partite, Match, Serie A, Analisi, Scommesse and secondary pages.
- Home controller hooks remain intact.
- Existing data loading, match forecast, ticket analysis and provider calls remain unchanged.
- `node --check` passes for all PWA scripts.
- Existing Node tests pass.
- `python mobile/check.py` passes.
- GitHub Actions checks pass before merge.
- Manual Android checks cover 360px, 390px and 430px widths, vertical scrolling, safe-area navigation and offline cache.

## Implementation notes

Phase 1 starts with navigation and the Home dashboard. Match, analysis and bet screens are restyled incrementally after the first slice is validated. No statistical model or data-provider behavior is changed in this phase.
