# MatchMind recovery audit — 2026-11-10

## Recovery baseline

- Canonical source: `Sonostevecazzo/MatchMind`
- Baseline branch: `main`
- Recovery checkpoint: `recovery/baseline-2026-11-10` (created from `main`; no source files changed)
- Main was at commit `2baf528fd7493d269ac517e1c96d98f83836a16d` when checkpointed.
- The latest Mobile PWA checks and GitHub Pages deployment both completed successfully.

## Branch review

The older UX/navigation, adaptive-AI, and scroll-fix branches were compared against current `main`. They are substantially behind and have diverged. They are not safe candidates for wholesale merging:

- `feat/multipage-sofascore-navigation`: 30 commits ahead, 378 behind
- `feat/phase-1-ux-navigation`: 327 ahead, 184 behind
- `fix/mobile-page-scroll`: 4 ahead, 186 behind
- `fix/mobile-main-thread-and-calendar`: 2 ahead, 179 behind
- `feat/matchmind-adaptive-ai`: 19 ahead, 183 behind
- `ui/sofascore-inspired-refresh`: 7 ahead, 396 behind

The current `main` already contains the multi-page PWA, adaptive model code, dedicated mobile typography/scroll overrides, match filters, local bet builder, and automated validation. Replacing it with an older branch would discard later work.

## Validation observed

- Latest `Mobile PWA checks` run: success.
- Latest `Deploy MatchMind Mobile to GitHub Pages` run: success.
- The validation job ran `python mobile/check.py`, including JavaScript syntax checks and the mobile test suites.

## Important product/data limitations

The current mobile README explicitly states that bookmaker odds, direct Sisal account access, ticket import/OCR, injuries, and player statistics are not integrated in this PWA baseline. Do not present these as working features unless separately implemented and verified.

## Next engineering pass

1. Exercise the deployed PWA on a real Android viewport and verify scrolling, navigation, filtering, and the persistent slip.
2. Reproduce any remaining UI defects before editing production files.
3. Make isolated fixes on a dedicated feature branch, run the full mobile checks, and merge only after review.
