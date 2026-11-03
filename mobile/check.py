"""Static validation for MatchMind's multi-screen smartphone PWA."""
from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
assert manifest.get("name") and manifest.get("display") == "standalone"
assert (ROOT / "sw.js").is_file()

required_pages = [
    "index.html", "matches.html", "explore.html", "league.html",
    "team.html", "match.html", "players.html", "analysis-lab.html", "bets.html", "data.html", "settings.html",
]
for name in required_pages:
    page = ROOT / name
    assert page.is_file(), f"Missing screen: {name}"
    html = page.read_text(encoding="utf-8")
    assert '<html lang="it">' in html, f"{name} must declare Italian language"
    if name == "matches.html":
        assert "matchesSection" in html and "location.replace(target.href)" in html, "Legacy match route must redirect to the Home calendar"
        continue
    assert "site-core.js" in html, f"{name} must use shared navigation"
    assert "mobile-readable.css" in html, f"{name} must load the dedicated mobile typography layer"
    if name == "bets.html":
        assert "bets-engine.js" in html and "bets.js" in html, "Bet checker must load its engine and controller"
        assert re.search(r'<input id="slipImage"[^>]*accept="image/\*"[^>]*hidden>', html), "Screenshot picker must accept gallery images"
        assert not re.search(r'<input id="slipImage"[^>]*capture=', html), "Screenshot picker must not force the camera"
    else:
        assert "site-pages.js" in html, f"{name} must use the shared page controller"

# The legacy workbench is retained as a fallback and its original inline JS is syntax-checked.
legacy = (ROOT / "legacy-workbench.html").read_text(encoding="utf-8")
legacy_scripts = re.findall(r"<script>(.*?)</script>", legacy, flags=re.DOTALL)
if len(legacy_scripts) != 1:
    raise SystemExit(f"Expected one legacy inline app script, found {len(legacy_scripts)}")
with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8") as handle:
    handle.write(legacy_scripts[0])
    handle.flush()
    subprocess.run(["node", "--check", handle.name], check=True)

for filename in ["site-core.js", "site-pages.js", "bets-engine.js", "tipsaudit.js", "bets.js", "elo.js", "rounds.js", "sw.js"]:
    subprocess.run(["node", "--check", str(ROOT / filename)], check=True)

for path in [
    ROOT / "functions" / "_middleware.js",
    ROOT / "functions" / "api" / "player-context.js",
]:
    subprocess.run(["node", "--check", str(path)], check=True)

subprocess.run(["node", "--test", str(ROOT / "tests" / "player-context.test.mjs")], check=True)
subprocess.run(["node", "--test", str(ROOT / "tests" / "backtest.test.mjs")], check=True)
subprocess.run(["node", "--test", str(ROOT / "tests" / "elo.test.mjs")], check=True)
subprocess.run(["node", "--test", str(ROOT / "tests" / "rounds.test.mjs")], check=True)
subprocess.run(["node", "--test", str(ROOT / "tests" / "bets-engine.test.cjs")], check=True)
subprocess.run(["node", "--test", str(ROOT / "tests" / "tipsaudit.test.cjs")], check=True)

# Check the app's four main destinations and that page-specific routes are linked.
home = (ROOT / "index.html").read_text(encoding="utf-8")
assert 'href="bets.html"' in home, "Bet checker is missing from the home shortcuts"

assert 'pitch-art' not in home and 'home-hero-art' not in home, "Home page must not render the football pitch illustration"
lab = (ROOT / "analysis-lab.html").read_text(encoding="utf-8")
for control in ["assistantStake", "assistantMinPayout", "assistantMaxPayout", "assistantLegs", "assistantGenerate", "assistantResult"]:
    assert control in lab, f"Missing bet assistant control: {control}"
assert "buildAssistant" in (ROOT / "rounds.js").read_text(encoding="utf-8"), "Missing target-based bet assistant optimizer"
settings = (ROOT / "settings.html").read_text(encoding="utf-8")
for control in ["apiFootballKey", "saveSessionKey", "testSessionKey", "clearSessionKey", "testPulseScoreKey"]:
    assert f'id="{control}"' in settings, f"Missing optional provider control: {control}"
pages = (ROOT / "site-pages.js").read_text(encoding="utf-8")
core = (ROOT / "site-core.js").read_text(encoding="utf-8")
for secret in ["matchmind-api-football-session-key", "matchmind-oddspapi-session-key"]:
    assert secret in pages, f"Missing optional settings session-key handling: {secret}"
    assert secret in core, f"Missing optional request header for session key: {secret}"
assert "type=odds-batch" not in pages, "The paid alternate odds aggregator must not be a required source"
assert "function eventForecast" in core and "eventForecast," in core, "Free event forecast engine is missing"
assert "home_corners_1h" in core and "home_yellow" in core, "Open-matchday event fields are not parsed"

css = (ROOT / "site.css").read_text(encoding="utf-8")
assert "grid-template-columns:repeat(4,minmax(0,1fr))" in css, "Mobile navigation must use four primary destinations"
core = (ROOT / "site-core.js").read_text(encoding="utf-8")
for route in ["index.html", "analysis-lab.html", "bets.html", "explore.html"]:
    assert route in core, f"Missing primary navigation route: {route}"
for label in ["Home", "Analisi", "Scommesse", "Altro"]:
    assert label in core, f"Missing primary navigation label: {label}"
assert "page==='bets'?'bets'" in core, "Bet manager must have its own active navigation state"
assert "(page==='matches'||page==='match'||page==='league')?'home'" in core, "Match and league screens must return to the Home destination"
home = (ROOT / "index.html").read_text(encoding="utf-8")
for hook in ["homePlayed", "homeUpcoming", "homeTeams", "homeStatus", "homeDot", "matchesSection", "matchSearch", "matchFilters", "matchList", "homeFavorites", "globalStatus"]:
    assert hook in home, f"Home controller hook was removed: {hook}"
for route in ["analysis-lab.html", "bets.html", "league.html", "explore.html"]:
    assert f'href="{route}"' in home, f"Home quick access is missing {route}"
matches_page = (ROOT / "matches.html").read_text(encoding="utf-8")
assert "location.replace(target.href)" in matches_page, "Old Partite URL must redirect to the Home calendar"
for hook in ["matchSearch", "matchDate", "matchTeam", "matchRound", "matchSeason", "matchFilters", "clearMatchFilters", "matchList"]:
    assert hook in home, f"Home calendar lost filter controller hook: {hook}"
assert '<details class="match-filter-advanced">' in home, "Advanced match filters should use an accessible disclosure"
assert 'href="league.html"' in home, "Standings must remain reachable from the Home calendar"
assert "AI Insights" in (ROOT / "analysis-lab.html").read_text(encoding="utf-8"), "AI Insights destination is missing"
assert "scoreMatrix" in core, "Correct-score probability matrix is missing from the forecast model"
# Forecast transparency and stable team identity checks.
assert "frosinone:512" in core, "Missing Frosinone crest mapping"
assert "sampleEnough:h.played>=10&&a.played>=10" in core, "Forecast adequacy must require 10 prior matches per team"
assert "function backtest(rows)" in core, "Missing chronological out-of-sample backtest"
assert "byClass" in core and "accuracyCI" in core and "bySeason" in core, "Missing detailed backtest diagnostics"
elo = (ROOT / "elo.js").read_text(encoding="utf-8")
assert "sameDateSnapshot:true" in elo and "aliasNormalization:true" in elo, "Missing Elo leakage and identity safeguards"
assert "elo.js" in (ROOT / "analysis-lab.html").read_text(encoding="utf-8"), "Elo engine is not loaded by the Intelligence page"
assert "rounds.js" in (ROOT / "analysis-lab.html").read_text(encoding="utf-8"), "Round analysis engine is not loaded by the Intelligence page"
assert "rounds.js" in (ROOT / "sw.js").read_text(encoding="utf-8"), "Round analysis engine is not cached by the service worker"
assert "bets.html" in (ROOT / "sw.js").read_text(encoding="utf-8"), "Bet checker page is not cached by the service worker"
assert "'./mobile-readable.css'" in (ROOT / "sw.js").read_text(encoding="utf-8"), "Dedicated mobile typography layer is missing from the PWA app shell"
assert re.search(r"matchmind-pwa-v\d+-\d{8}", (ROOT / "sw.js").read_text(encoding="utf-8")), "PWA cache version was not bumped after a frontend change"
assert "tipsaudit.js" in (ROOT / "sw.js").read_text(encoding="utf-8"), "TipsAudit keyless odds module is not cached by the service worker"
assert "tipsaudit.js" in (ROOT / "bets.html").read_text(encoding="utf-8"), "TipsAudit keyless odds module is not loaded by the bet checker"
assert "bets-engine.js" in (ROOT / "sw.js").read_text(encoding="utf-8") and "bets.js" in (ROOT / "sw.js").read_text(encoding="utf-8"), "Bet checker assets are not cached by the service worker"
assert "roundTickets" in (ROOT / "analysis-lab.html").read_text(encoding="utf-8"), "Missing next-round ticket panel"
assert "Classifica e obiettivi stagionali" in (ROOT / "site-pages.js").read_text(encoding="utf-8"), "Missing match-specific league context"
rounds = (ROOT / "rounds.js").read_text(encoding="utf-8")
assert "m.date<localDate" in rounds and "options.isUpcoming" in rounds, "Ticket engine must exclude past unplayed fixtures"
assert "Number.isFinite(v)" in rounds and "valid.length!==legs.length" in rounds, "Ticket probabilities must reject invalid or incomplete legs"
assert "m.date<date" in rounds, "League snapshots must exclude same-date and future results"
assert "loadData,backtest" in core, "Backtest helper is not exposed to the UI"
pages_js = (ROOT / "site-pages.js").read_text(encoding="utf-8")
for phrase in ["Partite usate", "Periodo storico complessivo", "Campione squadra incompleto", "CALIBRAZIONE PER ESITO", "STABILITÀ NEL TEMPO"]:
    assert phrase in pages_js, f"Missing forecast transparency label: {phrase}"

assert "forecastBacktest" in (ROOT / "analysis-lab.html").read_text(encoding="utf-8"), "Missing historical backtest panel"
print("MatchMind PWA, syntax, provider API and chronological backtest tests passed.")

# Local ticket archive, live-score refresh and provider transparency.
bets_html = (ROOT / "bets.html").read_text(encoding="utf-8")
bets_js = (ROOT / "bets.js").read_text(encoding="utf-8")
for control in ["manualSlipSummary", "manualOdds", "buildTicket", "slipArchive", "refreshArchive", "refreshSisal"]:
    assert f'id="{control}"' in bets_html, f"Missing bet manager control: {control}"
assert "matchmind-slip-archive-v1" in bets_js, "Local bet archive is missing"
assert "type=live" in bets_js, "Archive live-score refresh is missing"
assert "function getLiveFixtures" in (ROOT / "functions" / "api" / "player-context.js").read_text(encoding="utf-8"), "Live Serie A endpoint is missing"
assert "font-size:17px !important" in (ROOT / "mobile-readable.css").read_text(encoding="utf-8"), "Readable typography overrides are missing"
for page_name in ["explore.html", "data.html"]:
    page_html = (ROOT / page_name).read_text(encoding="utf-8")
    assert page_html.count("mobile-readable.css") == 1, f"{page_name} must load the mobile typography layer exactly once"
print("MatchMind PWA, syntax, provider API, archive and chronological backtest checks passed.")
