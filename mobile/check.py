"""Static validation for MatchMind PWA with a public calendar and optional Live provider."""
from __future__ import annotations
import json, re, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent
manifest=json.loads((ROOT/"manifest.webmanifest").read_text(encoding="utf-8"))
assert manifest.get("name") and manifest.get("display")=="standalone"
assert (ROOT/"sw.js").is_file()
required=["index.html","matches.html","live.html","nba.html","explore.html","league.html","team.html","match.html","players.html","analysis-lab.html","bets.html","data.html","settings.html"]
for name in required:
 p=ROOT/name
 assert p.is_file(),f"Missing screen: {name}"
 html=p.read_text(encoding="utf-8")
 assert '<html lang="it">' in html,f"{name} must declare Italian"
 if name=="matches.html":
  assert 'id="matchFilters"' in html and 'id="matchList"' in html
  assert 'id="matchSlipPreview"' not in html
 if name=="analysis-lab.html":
  assert 'id="analysisOverview"' in html and "bets-engine.js" in html
 if name!="index.html": assert "site-core.js" in html and "mobile-readable.css" in html
 if name=="bets.html":
  assert "bets-engine.js" in html and "sisal-bridge.js" in html and "bets.js" in html
  assert 'data-bets-tab="create"' in html and 'data-bets-tab="live"' in html and 'data-bets-tab="archive"' in html
  assert 'id="openTickets"' in html and 'id="slipArchive"' in html
 elif name=="live.html":
  assert "live.js" in html and "live.css" in html and 'id="livePitch"' in html and 'id="liveLineups"' in html and 'id="refreshLiveDetail"' in html
 elif name not in ("index.html","nba.html"): assert "site-pages.js" in html
legacy=(ROOT/"legacy-workbench.html").read_text(encoding="utf-8")
scripts=re.findall(r"<script>(.*?)</script>",legacy,flags=re.DOTALL)
assert len(scripts)==1
with tempfile.NamedTemporaryFile("w",suffix=".js",encoding="utf-8") as handle:
 handle.write(scripts[0]);handle.flush();subprocess.run(["node","--check",handle.name],check=True)
for filename in ["site-core.js","notifications.js","ai-engine.js","site-pages.js","bets-engine.js","sisal-bridge.js","tipsaudit.js","bets.js","live.js","nba.js","nba-builder.js","elo.js","rounds.js","sw.js"]:
 subprocess.run(["node","--check",str(ROOT/filename)],check=True)
subprocess.run(["node","--check",str(ROOT/"scripts"/"sisal-matchmind.user.js")],check=True)
for path in [ROOT/"functions"/"_middleware.js",ROOT/"functions"/"api"/"public-calendar.js",ROOT/"functions"/"api"/"player-context.js",ROOT/"functions"/"api"/"live-match.js",ROOT/"functions"/"api"/"athletic-news.js",ROOT/"functions"/"api"/"public"/"nba.js",ROOT/"nba-engine.mjs"]:
 subprocess.run(["node","--input-type=module","--check"],input=path.read_text(encoding="utf-8"),text=True,check=True)
for test in ["ai-engine.test.mjs","public-calendar.test.mjs","live-match.test.mjs","backtest.test.mjs","elo.test.mjs","rounds.test.mjs","bets-engine.test.cjs","sisal-bridge.test.cjs","tipsaudit.test.cjs","nba-engine.test.mjs","nba-builder.test.cjs","sisal-bridge.test.cjs","sisal-model-guard.test.cjs","sisal-transfer.test.mjs"]:
 subprocess.run(["node","--test",str(ROOT/"tests"/test)],check=True)
core=(ROOT/"site-core.js").read_text(encoding="utf-8")
calendar=(ROOT/"functions"/"api"/"public-calendar.js").read_text(encoding="utf-8")
assert "./api/public-calendar" in core and "open-matchday" in calendar
assert "europa-league" in core and "UEFA_1_europa-league" in calendar
assert '"europa-league": 3' in (ROOT/"functions"/"api"/"live-match.js").read_text(encoding="utf-8")
assert '"europa-league": "uefa.europa"' in (ROOT/"functions"/"api"/"live-match.js").read_text(encoding="utf-8")
assert (ROOT/"functions"/"api"/"athletic-news.js").is_file()
assert "athleticNews" in (ROOT/"explore.html").read_text(encoding="utf-8")
assert "api/athletic-news" in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert "API_FOOTBALL_KEY" not in core and "X-MatchMind-API-Key" not in core
assert "media.api-sports.io" not in core
nba_html=(ROOT/"nba.html").read_text(encoding="utf-8")
nba_core=(ROOT/"nba.js").read_text(encoding="utf-8")
nba_builder=(ROOT/"nba-builder.js").read_text(encoding="utf-8")
nba_engine=(ROOT/"nba-engine.mjs").read_text(encoding="utf-8")
assert 'data-page="nba"' in nba_html and 'id="nbaSlip"' in nba_html
assert "nba-builder.js" in nba_html and "nba.js" in nba_html
assert "matchmind-manual-selections-v1" in nba_core and "matchmind-slip-archive-v2" in nba_core
assert "calculate" in nba_builder and "predictNba" in nba_engine
assert "./nba.html" in (ROOT/"sw.js").read_text(encoding="utf-8")
assert "./nba.js" in (ROOT/"sw.js").read_text(encoding="utf-8")
assert 'href="matches.html"' in (ROOT/"index.html").read_text(encoding="utf-8")
assert 'location.replace(target)' in (ROOT/"index.html").read_text(encoding="utf-8")
assert 'globalSlipDock' in core and 'matchmind:picks-updated' in core
assert 'global-slip-remove' in core and '<svg viewBox="0 0 24 24"' in core
assert 'global-slip-chevron' not in core
assert 'appearance:none!important' in (ROOT/"site.css").read_text(encoding="utf-8")
assert "bets.html" in core and "Schedina" in core
assert "live.html" in core and "Live" in core
assert core.index("['matches.html','matches','Calcio']") < core.index("['live.html','live','Live']")
assert "competitionTabs" in core and "competition-tab" in core
assert "page==='live'?'live'" in core and "page==='nba'?'nba'" in core and "page==='mind'?'mind'" in core
assert "playerApi(" not in core and "playerApi(" not in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert "function backtest(rows)" in core
assert "window.MatchMindAI.train" in core
assert "trainAvailableModels(data.history)" not in core, "AI calibration must not run on the mobile UI thread"
assert "AbortSignal.timeout(25000)" in core
assert "ai-engine.js" in (ROOT/"sw.js").read_text(encoding="utf-8")
assert "scoreMatrix" in core
assert "sampleEnough:minTeamSample>=10" in core and "matchStandingsContext" in core
assert "buildAssistant" in (ROOT/"rounds.js").read_text(encoding="utf-8")
assert "matchmind-pwa-v101-20261111-sisal-bottomsheet" in (ROOT/"sw.js").read_text(encoding="utf-8")
assert 'omonia:' in core and "assets.footylogos.com/logos/ac-omonia-nicosia/" in core
assert "hapoelbeersheva" in core and "assets.footylogos.com/logos/hapoel-beer-sheva/" in core
assert "teamLogoUrl" in core and "https://assets.footylogos.com/logos/" in core
assert "home:'homeNextMatches'" in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert "site.api.espn.com" in (ROOT/"functions"/"api"/"live-match.js").read_text(encoding="utf-8")
assert "./live.html" in (ROOT/"sw.js").read_text(encoding="utf-8")
assert "./functions/api/live-match.js" not in (ROOT/"sw.js").read_text(encoding="utf-8")
assert "900000" in (ROOT/"bets.js").read_text(encoding="utf-8")
assert "300000" in (ROOT/"live.js").read_text(encoding="utf-8")
assert "900000" in (ROOT/"live.js").read_text(encoding="utf-8")
assert "1800000" in (ROOT/"live.js").read_text(encoding="utf-8")
assert "context, 300" in (ROOT/"functions"/"api"/"live-match.js").read_text(encoding="utf-8")
assert "./analysis.css" in (ROOT/"sw.js").read_text(encoding="utf-8")
assert "playerApi(" not in core and "playerApi(" not in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert "./live.html" in (ROOT/"sw.js").read_text(encoding="utf-8")
assert (ROOT/"functions"/"api"/"live-match.js").is_file()
bets_html=(ROOT/"bets.html").read_text(encoding="utf-8")
assert 'id="targetProbability"' in bets_html and 'type="range"' in bets_html
assert 'min="0"' in bets_html and 'max="100"' in bets_html
assert 'id="manualFixtures"' not in bets_html and 'id="manualSlipSummary"' in bets_html
assert 'href="./matches.html"' in bets_html and "aggiunto dalla pagina Partite" in bets_html
assert "globalSlipDock" in core
bets_js=(ROOT/"bets.js").read_text(encoding="utf-8")
assert "MatchMindSisalBridge" in bets_js and "playerApi" not in bets_js
assert "ENGINE().marketLabel(" not in bets_js and "const label=marketLabel(mKey)" in bets_js
bets_page=(ROOT/"bets.html").read_text(encoding="utf-8")
assert 'id="sendSelectionsToSisal"' in bets_page and "raw.githubusercontent.com" in bets_page
assert "./sisal-bridge.js" in (ROOT/"sw.js").read_text(encoding="utf-8")
assert "matchStandingsContext" in core and "pointsPerGame" in core

assert "home_corners_1h" in calendar and "home_yellow" in calendar
print("MatchMind PWA, public data source, optional Live provider, syntax and model checks passed.")

assert "shownLimit=12" in (ROOT/"site-pages.js").read_text(encoding="utf-8")
site_pages=(ROOT/"site-pages.js").read_text(encoding="utf-8")
assert "let matchFilter='upcoming',shownLimit=12,activeMatches=[],strategyFilter='all';" in site_pages
assert "shownLimit+=12" in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert "forecastMemo" in core and "memoKey&&forecastMemo.has(memoKey)" in core
assert "caches.default" in calendar and "cache.put(cacheKey" in calendar
assert "s-maxage=900" in (ROOT/"functions"/"_middleware.js").read_text(encoding="utf-8")
assert "matchmind-pwa-v100-20261111-sisal-navigation" in (ROOT/"sw.js").read_text(encoding="utf-8")

assert "matchmind-manual-selections-v1" in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert "setTimeout(next,0)" in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert "manual-slip-dropdown" in (ROOT/"bets.js").read_text(encoding="utf-8")
assert (ROOT/"notifications.js").is_file()
assert "upcomingMatches" in (ROOT/"live.html").read_text(encoding="utf-8")
assert "upcomingMatches" in (ROOT/"live.js").read_text(encoding="utf-8")
assert "live-sim-metrics" in (ROOT/"live.js").read_text(encoding="utf-8")
assert "notifyDetailChanges" in (ROOT/"live.js").read_text(encoding="utf-8")
assert "statusCode" in (ROOT/"live.js").read_text(encoding="utf-8")
assert "kickoffTimestamp" in (ROOT/"live.js").read_text(encoding="utf-8")
assert "notificationclick" in (ROOT/"sw.js").read_text(encoding="utf-8")
assert (ROOT/"sw.js").read_text(encoding="utf-8").count("notificationclick") == 1
assert "MMNotifications" in (ROOT/"notifications.js").read_text(encoding="utf-8")
assert "remote Web Push needs a server sender" in (ROOT/"notifications.js").read_text(encoding="utf-8")
assert "live-sim-track" in (ROOT/"live.css").read_text(encoding="utf-8")
assert "data-notification-category" in (ROOT/"live.html").read_text(encoding="utf-8")
assert "proposal-summary" in (ROOT/"bets.js").read_text(encoding="utf-8")
assert "proposal-leg-match" in (ROOT/"bets.js").read_text(encoding="utf-8")
assert "item.isRealOdd&&item.ev>0" in (ROOT/"bets.js").read_text(encoding="utf-8")
assert "Non calcolabile senza quote reali" in (ROOT/"bets.js").read_text(encoding="utf-8")
assert "Nessuna opportunità +EV verificabile" in (ROOT/"bets.js").read_text(encoding="utf-8")
assert 'rows.length===1?"pronostico":"pronostici"' in (ROOT/"bets.js").read_text(encoding="utf-8")
assert "Feed integrato non disponibile su GitHub Pages" in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert ".replace(/[.!?]+$/,'')" in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert "b.setAttribute('aria-label',b.title)" in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert "Aggiungi '+proposal.length+' selezioni" in (ROOT/"bets.js").read_text(encoding="utf-8")
assert "position:relative;top:auto;z-index:1" in (ROOT/"mobile-readable.css").read_text(encoding="utf-8")

assert "combo-goals" in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert "combo-btts" in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert 'id="saveManualSlip"' in (ROOT/"bets.html").read_text(encoding="utf-8")
assert "saveCurrentSlip" in (ROOT/"bets.js").read_text(encoding="utf-8")
assert "Apri schedina NBA" in (ROOT/"site-core.js").read_text(encoding="utf-8") and "data-slip-confirm" in (ROOT/"site-core.js").read_text(encoding="utf-8")
assert "is-expanded" in (ROOT/"site-core.js").read_text(encoding="utf-8")
assert "repeat(5,minmax(0,1fr))" in (ROOT/"site.css").read_text(encoding="utf-8")
assert "NBA_MARKETS" in (ROOT/"sisal-bridge.js").read_text(encoding="utf-8")

assert "builderStrategyPills" in (ROOT/"bets.html").read_text(encoding="utf-8")
assert "generateMotivation" in (ROOT/"bets.js").read_text(encoding="utf-8")
assert "proposal-variant-tabs" in (ROOT/"bets.js").read_text(encoding="utf-8")
assert "strategy-match-badge" in (ROOT/"site-pages.js").read_text(encoding="utf-8")
assert "strategyBanner" in (ROOT/"matches.html").read_text(encoding="utf-8")
assert "fixtures-odds.json" in (ROOT/"sw.js").read_text(encoding="utf-8")
