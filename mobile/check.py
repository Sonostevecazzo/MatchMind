"""Static validation for the smartphone PWA (no third-party dependencies)."""
from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
html = (ROOT / "index.html").read_text(encoding="utf-8")
manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
assert '<html lang="it">' in html
assert 'name' in manifest and manifest.get("display") == "standalone"
assert (ROOT / "sw.js").is_file()
scripts = re.findall(r"<script>(.*?)</script>", html, flags=re.DOTALL)
if len(scripts) != 1:
    raise SystemExit(f"Expected one inline app script, found {len(scripts)}")
with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8") as handle:
    handle.write(scripts[0])
    handle.flush()
    subprocess.run(["node", "--check", handle.name], check=True)
subprocess.run(["node", "--check", str(ROOT / "sw.js")], check=True)
print("Mobile PWA manifest and JavaScript syntax checks passed.")
