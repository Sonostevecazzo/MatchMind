"""Static checks for the football-only MatchMind PWA."""
import json, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
manifest=json.loads((ROOT/"manifest.webmanifest").read_text(encoding="utf-8"))
assert manifest.get("name") and manifest.get("display")=="standalone"
required=["index.html","matches.html","live.html","explore.html","league.html","team.html","match.html","players.html","analysis-lab.html","bets.html","data.html","settings.html"]
for name in required:
    path=ROOT/name
    assert path.is_file(), f"Missing screen: {name}"
    html=path.read_text(encoding="utf-8")
    assert '<html lang="it">' in html, f"{name} must declare Italian"
for name in ["site-core.js","sports-switch.js","bets.js","bets-engine.js","ai-engine.js","elo.js","live.js","site-pages.js","sisal-bridge.js","sw.js"]:
    subprocess.run(["node","--check",str(ROOT/name)],check=True)
subprocess.run(["node","--check",str(ROOT/"scripts"/"sisal-matchmind.user.js")],check=True)
core=(ROOT/"site-core.js").read_text(encoding="utf-8")
api=(ROOT/"functions"/"api"/"competition-calendar.js").read_text(encoding="utf-8")
assert '"serie-a"' in core and '"nations-league"' in core
assert '"serie-a"' in api and '"nations-league"' in api
assert 'slug: "uefa.nations"' in api
assert "fetchDirectNationsLeague" in core and "fetchCompetitionFromEspn" in api and "slug: \"uefa.nations\"" in api
assert "matchmind-multipage-cache-v11-serie-a-nations-20261114" in core
assert "football-only interface" in (ROOT/"sports-switch.js").read_text(encoding="utf-8")
assert "nbaIntegratedView" not in (ROOT/"matches.html").read_text(encoding="utf-8")
assert "nbaIntegratedView" not in (ROOT/"live.html").read_text(encoding="utf-8")
assert "nbaIntegratedView" not in (ROOT/"bets.html").read_text(encoding="utf-8")
print("MatchMind football-only PWA and national-team calendar checks passed.")
