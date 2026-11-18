"""Structural and regression checks for the MatchMind mobile PWA."""
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
bets=(ROOT/"bets.js").read_text(encoding="utf-8")
sisal=(ROOT/"scripts"/"sisal-matchmind.user.js").read_text(encoding="utf-8")
settings=(ROOT/"settings.html").read_text(encoding="utf-8")
pages=(ROOT/"site-pages.js").read_text(encoding="utf-8")
readme=(ROOT/"README.md").read_text(encoding="utf-8")
assert bets.count('data-duplicate-ticket=') == 2, "Both open and archived tickets must expose duplication"
assert "function duplicateTicket(ticket)" in bets and 'status:"Da giocare",result:null' in bets
assert 'const MATCHMIND_URL = "https://matchmind-3te.pages.dev/bets.html"' in sisal, "Sisal overlay must link to the main MatchMind app"
assert "// @version      3.6.3" in sisal and 'const MM_SCRIPT_VERSION = "3.6.3"' in sisal, "Sisal userscript release metadata must match"
assert 'x.sport !== "nba"' in sisal and 'competition: String(x.competition || "serie-a")' in sisal, "MatchMind handoff must accept football only and retain competition"
assert "non sono integrati: non è stato verificato un endpoint pubblico gratuito e stabile" in pages, "Unverified model providers must not be presented as active"
assert "does not call OddsPapi or any paid odds service" in readme and "returned by OddsPapi" not in readme, "Do not document a paid/unverified odds integration as active"
assert "Il Live funziona solo se API_FOOTBALL_KEY" not in settings, "ESPN must remain available without API keys"
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

# Prediction-only PWA: the installed shell must not preload Live, Archive or NBA assets.
bets_html=(ROOT/"bets.html").read_text(encoding="utf-8")
assert 'data-title="Previsioni"' in bets_html
assert 'data-bets-tab="live"' not in bets_html and 'data-bets-tab="archive"' not in bets_html
sw=(ROOT/"sw.js").read_text(encoding="utf-8")
for asset in ["./live.html","./nba.html","./nba.css","./nba.js","./nba-builder.js","./nba-engine.mjs"]:
    assert asset not in sw, f"Obsolete asset still preloaded by prediction-only PWA: {asset}"
# Execute every unit/regression test, not only syntax checks.
test_files=sorted((ROOT/"tests").glob("*.test.mjs"))+sorted((ROOT/"tests").glob("*.test.cjs"))
assert test_files, "No JavaScript regression tests discovered"
subprocess.run(["node","--test",*[str(path) for path in test_files]],cwd=ROOT,check=True)
print(f"MatchMind PWA checks and {len(test_files)} JavaScript test files passed.")
