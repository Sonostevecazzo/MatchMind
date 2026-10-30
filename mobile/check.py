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
    "team.html", "match.html", "players.html", "analysis-lab.html", "data.html",
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

# Check the app's four main destinations and that page-specific routes are linked.
core = (ROOT / "site-core.js").read_text(encoding="utf-8")
for route in ["index.html", "matches.html", "explore.html", "analysis-lab.html"]:
    assert route in core, f"Missing primary navigation route: {route}"
print("MatchMind multi-screen PWA, shared scripts, service worker, middleware and player API tests passed.")
