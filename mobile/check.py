"""Static validation for MatchMind's football-only, no-key PWA."""
from __future__ import annotations
import json, re, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent
manifest=json.loads((ROOT/"manifest.webmanifest").read_text(encoding="utf-8"))
assert manifest.get("name") and manifest.get("display")=="standalone"
assert (ROOT/"sw.js").is_file()
required=["index.html","matches.html","explore.html","league.html","team.html","match.html","players.html","analysis-lab.html","bets.html","data.html","settings.html"]
for name in required:
 p=ROOT/name
 assert p.is_file(),f"Missing screen: {name}"
 html=p.read_text(encoding="utf-8")
 assert '<html lang="it">' in html,f"{name} must declare Italian"
 if name=="matches.html":
  assert "location.replace(target.href)" in html
  continue
 assert "site-core.js" in html and "mobile-readable.css" in html
 if name=="bets.html":
  assert "bets-engine.js" in html and "bets.js" in html
 else: assert "site-pages.js" in html
legacy=(ROOT/"legacy-workbench.html").read_text(encoding="utf-8")
scripts=re.findall(r"<script>(.*?)</script>",legacy,flags=re.DOTALL)
assert len(scripts)==1
with tempfile.NamedTemporaryFile("w",suffix=".js",encoding="utf-8") as handle:
 handle.write(scripts[0]);handle.flush();subprocess.run(["node","--check",handle.name],check=True)
for filename in ["site-core.js","site-pages.js","bets-engine.js","tipsaudit.js","bets.js","elo.js","rounds.js","sw.js"]:
 subprocess.run(["node","--check",str(ROOT/filename)],check=True)
for path in [ROOT/"functions"/"_middleware.js",ROOT/"functions"/"api"/"public-calendar.js",ROOT/"functions"/"api"/"player-context.js"]:
 subprocess.run(["node","--check",str(path)],check=True)
for test in ["public-calendar.test.mjs","backtest.test.mjs","elo.test.mjs","rounds.test.mjs","bets-engine.test.cjs","tipsaudit.test.cjs"]:
 subprocess.run(["node","--test",str(ROOT/"tests"/test)],check=True)
core=(ROOT/"site-core.js").read_text(encoding="utf-8")
calendar=(ROOT/"functions"/"api"/"public-calendar.js").read_text(encoding="utf-8")
assert "./api/public-calendar" in core and "open-matchday" in calendar
assert "API_FOOTBALL_KEY" not in core and "X-MatchMind-API-Key" not in core
assert "media.api-sports.io" not in core
assert "nba.html" not in (ROOT/"sw.js").read_text(encoding="utf-8")
assert not (ROOT/"nba.html").exists() and not (ROOT/"nba.js").exists()
assert 'href="bets.html"' in (ROOT/"index.html").read_text(encoding="utf-8")
assert "function backtest(rows)" in core
assert "scoreMatrix" in core
assert "sampleEnough:h.played>=10&&a.played>=10" in core
assert "buildAssistant" in (ROOT/"rounds.js").read_text(encoding="utf-8")
assert "matchmind-pwa-v52-20261104-football-only" in (ROOT/"sw.js").read_text(encoding="utf-8")
assert "home_corners_1h" in calendar and "home_yellow" in calendar
print("MatchMind football-only PWA, no-key data source, syntax and model checks passed.")
