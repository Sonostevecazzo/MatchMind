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
    assert "site-core.js" in html, f"{name} must use shared navigation"
    if name == "bets.html":
        assert "bets-engine.js" in html and "bets.js" in html, "Bet checker must load its engine and controller"
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

for filename in ["site-core.js", "site-pages.js", "bets-engine.js", "bets.js", "elo.js", "rounds.js", "sw.js"]:
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

# Check the app's four main destinations and that page-specific routes are linked.
home = (ROOT / "index.html").read_text(encoding="utf-8")
assert 'href="bets.html"' in home, "Bet checker is missing from the home shortcuts"

assert 'pitch-art' not in home and 'home-hero-art' not in home, "Home page must not render the football pitch illustration"
lab = (ROOT / "analysis-lab.html").read_text(encoding="utf-8")
for control in ["assistantStake", "assistantMinPayout", "assistantMaxPayout", "assistantLegs", "assistantGenerate", "assistantResult"]:
    assert control in lab, f"Missing bet assistant control: {control}"
assert "buildAssistant" in (ROOT / "rounds.js").read_text(encoding="utf-8"), "Missing target-based bet assistant optimizer"
settings = (ROOT / "settings.html").read_text(encoding="utf-8")
for control in ["apiFootballKey", "oddsPapiKey", "theOddsApiKey", "footballDataKey",
                "saveOddsPapiKey", "saveTheOddsApiKey", "saveFootballDataKey"]:
    assert control in settings, f"Missing provider key control: {control}"
for secret in ["matchmind-oddspapi-session-key", "matchmind-the-odds-api-session-key",
               "matchmind-football-data-session-key"]:
    assert secret in (ROOT / "site-pages.js").read_text(encoding="utf-8"), f"Missing settings session-key handling: {secret}"
    assert secret in (ROOT / "site-core.js").read_text(encoding="utf-8"), f"Missing request header for session key: {secret}"
provider_api = (ROOT / "functions" / "api" / "player-context.js").read_text(encoding="utf-8")
for route in ['type === "test-oddspapi"', 'type === "test-the-odds-api"', 'type === "odds-batch"',
              "soccer_italy_serie_a", "normalizeTheOddsEvents"]:
    assert route in provider_api, f"Missing odds provider integration: {route}"
assert "type=odds-batch" in (ROOT / "site-pages.js").read_text(encoding="utf-8"), "Assistant must request the alternate batch odds feed"

css = (ROOT / "site.css").read_text(encoding="utf-8")
assert "grid-template-columns:repeat(6,minmax(0,1fr))" in css, "Mobile navigation must accommodate all six destinations"
core = (ROOT / "site-core.js").read_text(encoding="utf-8")
for route in ["index.html", "matches.html", "explore.html", "analysis-lab.html", "bets.html", "settings.html"]:
    assert route in core, f"Missing primary navigation route: {route}"
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
