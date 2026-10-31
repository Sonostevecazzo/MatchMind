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
    "team.html", "match.html", "players.html", "analysis-lab.html", "data.html", "settings.html",
]
for name in required_pages:
    page = ROOT / name
    assert page.is_file(), f"Missing screen: {name}"
    html = page.read_text(encoding="utf-8")
    assert '<html lang="it">' in html, f"{name} must declare Italian language"
    assert 'site-core.js' in html and 'site-pages.js' in html, f"{name} must use shared navigation and page controller"

# The legacy workbench is retained as a fallback and its original inline JS is syntax-checked.
legacy = (ROOT / "legacy-workbench.html").read_text(encoding="utf-8")
legacy_scripts = re.findall(r"<script>(.*?)</script>", legacy, flags=re.DOTALL)
if len(legacy_scripts) != 1:
    raise SystemExit(f"Expected one legacy inline app script, found {len(legacy_scripts)}")
with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8") as handle:
    handle.write(legacy_scripts[0])
    handle.flush()
    subprocess.run(["node", "--check", handle.name], check=True)

for filename in ["site-core.js", "site-pages.js", "sw.js"]:
    subprocess.run(["node", "--check", str(ROOT / filename)], check=True)

for path in [
    ROOT / "functions" / "_middleware.js",
    ROOT / "functions" / "api" / "player-context.js",
]:
    subprocess.run(["node", "--check", str(path)], check=True)

subprocess.run(["node", "--test", str(ROOT / "tests" / "player-context.test.mjs")], check=True)
subprocess.run(["node", "--test", str(ROOT / "tests" / "backtest.test.mjs")], check=True)

# Check the app's four main destinations and that page-specific routes are linked.
core = (ROOT / "site-core.js").read_text(encoding="utf-8")
for route in ["index.html", "matches.html", "explore.html", "analysis-lab.html", "settings.html"]:
    assert route in core, f"Missing primary navigation route: {route}"
# Forecast transparency and stable team identity checks.
assert "frosinone:512" in core, "Missing Frosinone crest mapping"
assert "sampleEnough:h.played>=10&&a.played>=10" in core, "Forecast adequacy must require 10 prior matches per team"
assert "function backtest(rows)" in core, "Missing chronological out-of-sample backtest"
assert "byClass" in core and "accuracyCI" in core and "bySeason" in core, "Missing detailed backtest diagnostics"
assert "loadData,backtest" in core, "Backtest helper is not exposed to the UI"
pages_js = (ROOT / "site-pages.js").read_text(encoding="utf-8")
for phrase in ["Partite usate", "Periodo storico complessivo", "Campione squadra incompleto", "CALIBRAZIONE PER ESITO", "STABILITÀ NEL TEMPO"]:
    assert phrase in pages_js, f"Missing forecast transparency label: {phrase}"

assert "forecastBacktest" in (ROOT / "analysis-lab.html").read_text(encoding="utf-8"), "Missing historical backtest panel"
print("MatchMind PWA, syntax, provider API and chronological backtest tests passed.")
