"""Structural and regression checks for the MatchMind mobile PWA."""
import json, re, subprocess
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
assert "// @version      3.6.5" in sisal and 'const MM_SCRIPT_VERSION = "3.6.5"' in sisal, "Sisal userscript release metadata must match"
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

# Screen roles, mobile navigation and filter-first builder.
home_html=(ROOT/"index.html").read_text(encoding="utf-8")
analysis_html=(ROOT/"analysis-lab.html").read_text(encoding="utf-8")
core=(ROOT/"site-core.js").read_text(encoding="utf-8")
pages=(ROOT/"site-pages.js").read_text(encoding="utf-8")
site_css=(ROOT/"site.css").read_text(encoding="utf-8")
readable_css=(ROOT/"mobile-readable.css").read_text(encoding="utf-8")
assert 'data-page="home"' in home_html and 'id="homeNextMatches"' in home_html
assert 'data-page="mind"' in analysis_html and 'id="analysisOverview"' in analysis_html
assert "Le tue partite" not in analysis_html
assert "next.slice(0,3).map(matchCard)" in pages
assert "const secondary=[" in core and "analysis-lab.html" in core and "settings.html" in core
assert 'href="index.html" aria-label="MatchMind Home"' in core
assert 'id="builderTeam"' in bets_html and 'id="builderDate"' in bets_html
assert 'id="builderRound"' in bets_html and 'id="builderSample"' in bets_html
assert "builderCandidateSet" in bets and "builderSample" in bets
assert "height:100dvh;overflow:hidden" not in site_css
assert ":is(p, span, b, strong, a, label, small" not in readable_css
assert manifest.get("start_url")=="./"
all_mobile_html="\n".join(p.read_text(encoding="utf-8") for p in ROOT.glob("*.html"))
assert not re.search(r"\bcapture\s*=",all_mobile_html,re.IGNORECASE)
assert 'id="ticketScreenshot"' in bets_html and 'accept="image/*"' in bets_html
share=manifest.get("share_target",{})
assert share.get("action")=="./share-target" and share.get("method")=="POST"
assert any(x.get("name")=="screenshot" and "image/*" in x.get("accept",[]) for x in share.get("params",{}).get("files",[]))
assert "consumeSharedScreenshot" in bets and "previewScreenshot" in bets
assert "matchmind-pwa-v162-mobile-offline-shell" in sw
assert "normalized.search=''" in sw and "analysis-lab.html" in sw
for asset in ["./site-core.js","./analysis.css","./research-engine.js","./rounds.js","./analysis-lab.html","./league.html","./explore.html","./players.html","./data.html","./settings.html"]:
 assert asset in sw, f"Secondary PWA route or dependency is not precached: {asset}"

print(f"MatchMind PWA checks and {len(test_files)} JavaScript test files passed.")
