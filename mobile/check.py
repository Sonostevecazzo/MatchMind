"""Structural and regression checks for the MatchMind mobile PWA."""
import json, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
manifest=json.loads((ROOT/"manifest.webmanifest").read_text(encoding="utf-8"))
assert manifest.get("name") and manifest.get("display")=="standalone"
required=["index.html","matches.html","live.html","explore.html","league.html","team.html","match.html","players.html","analysis-lab.html","bets.html","data.html","settings.html","nba.html"]
for name in required:
    path=ROOT/name
    assert path.is_file(), f"Missing screen: {name}"
    html=path.read_text(encoding="utf-8")
    assert '<html lang="it">' in html, f"{name} must declare Italian"
for name in ["site-core.js","sports-switch.js","bets.js","bets-engine.js","ai-engine.js","elo.js","live.js","site-pages.js","sisal-bridge.js","sw.js","nba.js","nba-builder.js"]:
    subprocess.run(["node","--check",str(ROOT/name)],check=True)
subprocess.run(["node","--check",str(ROOT/"scripts"/"sisal-matchmind.user.js")],check=True)
subprocess.run(["node","--check",str(ROOT/"nba-engine.mjs")],check=True)
core=(ROOT/"site-core.js").read_text(encoding="utf-8")
api=(ROOT/"functions"/"api"/"competition-calendar.js").read_text(encoding="utf-8")
assert all(name in core for name in ['"serie-a"','"champions-league"','"europa-league"','"nations-league"'])
assert all(name in api for name in ['"serie-a"','"champions-league"','"europa-league"','"nations-league"'])
assert 'slug: "uefa.nations"' in api
assert "fetchDirectNationsLeague" in core and "fetchCompetitionFromEspn" in api and "slug: \"uefa.nations\"" in api
assert "matchmind-multipage-cache-v16-cornerflick-nations-history" in core
# The GitHub Pages data path must retain an official Nations League fallback.
assert "fetchCornerflickNationsHistory" in core and "fetchCornerflickNationsHistory" in api
assert "cornerflick.com/football/leagues/nations-league/results/season.json" in core
assert "cornerflick.com/football/leagues/nations-league/results/season.json" in api
assert "function nationsLeagueOfficialFallback" in core
assert 'const official=nationsLeagueOfficialFallback()' in core
assert "Calendario futuro: fallback ufficiale UEFA" in core

assert "football-only interface" in (ROOT/"sports-switch.js").read_text(encoding="utf-8")
assert "nbaIntegratedView" not in (ROOT/"matches.html").read_text(encoding="utf-8")
assert "nbaIntegratedView" not in (ROOT/"live.html").read_text(encoding="utf-8")
assert "nbaIntegratedView" not in (ROOT/"bets.html").read_text(encoding="utf-8")
# The standalone NBA page must load the Sisal bridge before its transfer handler.
nba_html=(ROOT/"nba.html").read_text(encoding="utf-8")
assert nba_html.index("sisal-bridge.js") < nba_html.index("nba.js")
sw=(ROOT/"sw.js").read_text(encoding="utf-8")
for asset in ["./nba.html","./nba.css","./nba.js","./nba-builder.js","./nba-engine.mjs"]:
    assert asset in sw, f"Missing NBA PWA cache asset: {asset}"
# Execute every unit/regression test, not only syntax checks.
test_files=sorted((ROOT/"tests").glob("*.test.mjs"))+sorted((ROOT/"tests").glob("*.test.cjs"))
assert test_files, "No JavaScript regression tests discovered"
subprocess.run(["node","--test",*[str(path) for path in test_files]],cwd=ROOT,check=True)
print(f"MatchMind PWA checks and {len(test_files)} JavaScript test files passed.")
