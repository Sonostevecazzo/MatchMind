# MatchMind Serie A redesign — prompt pack and execution log

Date: 2026-11-01  
Repository scope: `Sonostevecazzo/MatchMind` only.  
Competition scope: Italian Serie A only.

This file records the reusable prompts used as structured review checklists. They are written to be run against the repository, not as instructions to copy SofaScore's proprietary source, private APIs, models, logos or trade dress.

## Prompt 1 — Product and navigation auditor

> Act as a senior product designer auditing a football scores and analytics PWA. Inspect every mobile screen, route, menu item, shortcut and navigation state. Identify duplicate destinations, unclear labels, hidden functions, inconsistent active states, inaccessible controls and orphaned pages. Propose the smallest information architecture that makes the five primary tasks immediately reachable: Home, Partite, Serie A, AI Insights and Altro. Preserve all existing working capabilities and map secondary tasks into Altro or contextual entry points. Return a route matrix and concrete code-level edits.

### Execution result

- Replaced the previous six-item bottom bar with five stable destinations: Home, Partite, Serie A, AI Insights, Altro.
- Secondary screens (club profile, player lookup, bet checker, data coverage and settings) now map to Altro in the active navigation state.
- Moved the secondary destinations into the Altro screen; exposed the bet checker from Home and AI Insights.
- Kept direct match/team links and all existing page controllers.
- Removed the legacy workbench shortcut from the primary AI screen; retained the legacy file as a fallback rather than deleting code.

## Prompt 2 — Visual-system and mobile usability auditor

> Act as a lead interface designer for a premium live-sports application. Audit the existing CSS cascade, typography, spacing, cards, score presentation, forms, tabs, badges, icons and responsive behaviour. Produce a restrained dark visual system with high-contrast score typography, a single accent colour, compact match cards, clear section hierarchy, consistent touch targets and five-tab bottom navigation. Use original MatchMind styling; do not copy SofaScore logos or assets. Ensure the content pane remains scrollable above the fixed navigation and respect reduced-motion preferences.

### Execution result

- Standardized the visual palette around charcoal surfaces and a single lime accent.
- Normalized headers, cards, buttons, forms, match cards, statistics, tabs and settings panels.
- Replaced primary navigation glyphs with inline SVG line icons and updated favorite controls.
- Rebuilt the Home, Altro, Serie A and AI Insights screen content hierarchy.
- Fixed malformed duplicate markup in the Serie A page and a duplicate arrow in the former Explore screen.
- Kept a responsive five-column bottom bar, fixed above the safe-area inset.

## Prompt 3 — Match-detail and SofaScore-style insights auditor

> Act as a football analytics product architect. Compare the match-detail experience with the publicly documented SofaScore Analyst / AI Insights outputs. Identify which values can be derived coherently from the current MatchMind model and which require additional licensed data. Add a correct-score probability matrix only when it is derived from the same score distribution as 1X2 and goal markets. Never fabricate corners, cards, xG, injuries, lineups, referees or tactical metrics. Clearly distinguish a current pre-match estimate from a historical replay when no immutable forecast was stored before kick-off.

### Execution result

- Extended the existing Poisson forecast object with a 0–5 home/away correct-score matrix and an explicit residual probability for scores outside that grid.
- Added the matrix to the match detail page.
- Labelled completed-match estimates as historical replays and explicitly stated that they are not frozen pre-match forecasts.
- Kept unavailable markets and provider data out of the forecast rather than substituting invented numbers.

## Prompt 4 — Regression and accessibility reviewer

> Act as a QA engineer. Validate every route and required DOM identifier after the navigation and layout changes. Check JavaScript syntax, tab/filter event handlers, active navigation, PWA cache invalidation, responsive five-tab layout, safe-area spacing, keyboard focus, ARIA state and preservation of provider settings, bet-slip and player search functions. Run the repository's Python and Node test suites. Report every failed check; do not claim browser/device verification unless an actual browser run occurred.

### Execution result

- Updated the static PWA validator to assert the five primary destinations and the score-matrix model.
- Added accessible pressed/selected state updates for match filters and Serie A tabs.
- Bumped the service-worker cache key so deployed devices fetch the revised shell.
- Mobile PWA checks passed (workflow run 48).
- Python test matrix passed on Python 3.11, 3.12 and 3.13 (workflow run 444), including compile, pytest, CLI smoke test and the mobile static validator.
- JavaScript source files were syntax-checked; the correct-score matrix was exercised directly and its 36 cells plus residual mass summed to 1 within floating-point tolerance.
- Cloudflare Pages branch preview deployment succeeded for the redesign commit.
- No real Android device/screenshot test was available; visual QA on physical hardware remains a final manual check.

## Prompt 5 — Football data integrity reviewer

> Act as a model-risk reviewer for a Serie A-only football forecasting system. Verify chronological cut-offs, sample-size gates, source attribution, nullable missing data, probability normalization, score-matrix mass and separation of goals, corners and cards. Identify look-ahead leakage and misleading historical claims. Do not describe the baseline as trained AI or claim predictive superiority without out-of-sample evidence.

### Execution result

- Kept the existing minimum-history gate of ten prior matches per team for the mobile forecast.
- Added score-matrix probabilities from the same home/away goal intensities used by the existing Poisson market probabilities.
- Added an explicit tail mass for scorelines outside 0–5 goals.
- Corrected completed-match presentation to historical replay, not actual archived prediction.
- Corners, cards, referee patterns, tactical insights and half-time predictions remain blocked until appropriate Serie A historical/live data and calibrated models exist.

## Current limitations

- The visual changes have not yet been confirmed on a real Android device or by screenshot-based browser testing.
- The current model is a statistical Poisson baseline, not a trained AI model.
- Correct-score cells are model-derived probabilities, not SofaScore data.
- Corner, card, referee, lineup, player-impact and half-time projections are not yet implemented or validated.
- The public fixture/result fallback is not sufficient to support all Premium-style insights.
- No proprietary SofaScore code, endpoint, model weights, brand assets or private data were copied.

## Release checks

A release is not complete until the PR's Python tests, Node tests, static PWA validation and live-provider checks pass. Live provider coverage must be confirmed for the current Serie A season; a configured API key alone is not evidence of endpoint/season availability.
