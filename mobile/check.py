"""Static validation for MatchMind's football-only, no-key PWA."""
from __future__ import annotations
import json, re, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent
manifest=json.loads((ROOT/"manifest.webmanifest").read_text(encoding="utf-8"))
assert manifest.get("name") and manifest.get("display")=="standalone"
assert (ROOT/"sw.js").is_file()
required=["index.html","matches.html","live.html","explore.html","league.html","team.html","match.html","players.html","analysis-lab.html","bets.html","data.html","settings.html"]
for name in required:
 p=ROOT/name
 assert p.is_file(),f"Missing screen: {name}"
 html=p.read_text(encoding="utf-8")
 assert '<html lang="it">' in html,f"{name} must declare Italian"
 if name=="matches.html":
  assert 'id="matchFilters"' in html and 'id="matchList"' in html
  assert 'id="matchSlipPreview"' in html
 assert "site-core.js" in html and "mobile-readable.css" in html
 if name=="bets.html":
  assert "bets-engine.js" in html and "bets.js" in html
  assert 'data-bets-tab="create"' in html and 'data-bets-tab="live"' in html and 'data-bets-tab="archive"' in html
  assert 'id="openTickets"' in html and 'id="slipArchive"' in html
 elif name=="live.html":
  assert "live.js" in html and "live.css" in html and 'id="livePitch"' in html
 else: assert "site-pages.js" in html
legacy=(ROOT/"legacy-workbench.html").read_text(encoding="utf-8")
scripts=re.findall(r"<script>(.*?)</script>",legacy,flags=re.DOTALL)
assert len(scripts)==1
with tempfile.NamedTemporaryFile("w",suffix=".js",encoding="utf-8") as handle:
 handle.write(scripts[0]);handle.flush();subprocess.run(["node","--check",handle.name],check=True)
for filename in ["site-core.js","site-pages.js","bets-engine.js","tipsaudit.js","bets.js","live.js","elo.js","rounds.js","sw.js"]:
 subprocess.run(["node","--check",str(ROOT/filename)],check=True)
for path in [ROOT/"functions"/"_middleware.js",ROOT/"functions"/"api"/"public-calendar.js",ROOT/"functions"/"api"/"player-context.js",ROOT/"functions"/"api"/"live-match.js"]:
 subprocess.run(["node","--check",str(path)],check=True)
for test in ["public-calendar.test.mjs","live-match.test.mjs","backtest.test.mjs","elo.test.mjs","rounds.test.mjs","bets-engine.test.cjs","tipsaudit.test.cjs"]:
 subprocess.run(["node","--test",str(ROOT/"tests"/test)],check=True)
core=(ROOT/"site-core.js").read_text(encoding="utf-8")
calendar=(ROOT/"functions"/"api"/"public-calendar.js").read_text(encoding="utf-8")
assert "./api/public-calendar" in core and "open-matchday" in calendar
assert "API_FOOTBALL_KEY" not in core and "X-MatchMind-API-Key" not in core
assert "media.api-sports.io" not in core
assert "nba.html" not in (ROOT/"sw.js").read_text(encoding="utf-8")
assert not (ROOT/"nba.html").exists() and not (ROOT/"nba.js").exists()
assert 'href="matches.html"' in (ROOT/"index.html").read_text(encoding="utf-8")
assert "bets.html" in core and "Schedina" in core
assert "live.html" in core and "Live" in core
assert "page==='live'?'live'" in core and "page==='mind'?'mind'" in core
assert "playerApi(" not in core and "playerApi(" not in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert "function backtest(rows)" in core
assert "scoreMatrix" in core
assert "sampleEnough:minTeamSample>=10" in core and "matchStandingsContext" in core
assert "buildAssistant" in (ROOT/"rounds.js").read_text(encoding="utf-8")
assert "matchmind-pwa-v58-20261104-live-matchsim" in (ROOT/"sw.js").read_text(encoding="utf-8")
assert "./live.html" in (ROOT/"sw.js").read_text(encoding="utf-8")
assert "./analysis.css" in (ROOT/"sw.js").read_text(encoding="utf-8")
assert "playerApi(" not in core and "playerApi(" not in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert "./live.html" in (ROOT/"sw.js").read_text(encoding="utf-8")
assert (ROOT/"functions"/"api"/"live-match.js").is_file()
bets_html=(ROOT/"bets.html").read_text(encoding="utf-8")
assert 'id="targetProbability"' in bets_html and 'type="range"' in bets_html
assert 'min="0"' in bets_html and 'max="100"' in bets_html
assert 'id="manualFixtures"' in bets_html and 'id="manualSlipSummary"' in bets_html
assert 'id="matchSlipPreview"' in (ROOT/"matches.html").read_text(encoding="utf-8")
bets_js=(ROOT/"bets.js").read_text(encoding="utf-8")
assert "Sisal" not in bets_js and "playerApi" not in bets_js
assert "matchStandingsContext" in core and "pointsPerGame" in core

assert "home_corners_1h" in calendar and "home_yellow" in calendar
print("MatchMind football-only PWA, no-key data source, syntax and model checks passed.")
