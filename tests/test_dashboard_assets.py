"""Regression checks for the static dashboard shipped with the API."""
from __future__ import annotations

import shutil
import subprocess
from html.parser import HTMLParser
from pathlib import Path

import pytest


DASHBOARD = Path(__file__).parents[1] / "matchmind" / "static" / "index.html"


class _ScriptCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._inside = False
        self._parts: list[str] = []
        self.scripts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() == "script":
            self._inside = True
            self._parts = []

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self._inside:
            self.scripts.append("".join(self._parts))
            self._inside = False

    def handle_data(self, data: str) -> None:
        if self._inside:
            self._parts.append(data)


def test_dashboard_is_packaged_and_mentions_local_api() -> None:
    html = DASHBOARD.read_text(encoding="utf-8")
    assert "MatchMind" in html
    assert "/data/coverage" in html
    assert "/forecast/fixture/" in html
    assert "market('Under 1.5',p.under_15)" in html
    assert "market('Under 2.5',p.under_25)" in html
    assert "market('Under 3.5',p.under_35)" in html
    assert "oddsAnalysisHtml" in html
    assert "playerBlock" in html
    parser = _ScriptCollector()
    parser.feed(html)
    assert parser.scripts, "dashboard should contain its application JavaScript"


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is not installed")
def test_dashboard_inline_javascript_syntax(tmp_path: Path) -> None:
    parser = _ScriptCollector()
    parser.feed(DASHBOARD.read_text(encoding="utf-8"))
    assert parser.scripts
    node = shutil.which("node")
    assert node is not None
    for index, source in enumerate(parser.scripts):
        script = tmp_path / f"dashboard-{index}.js"
        script.write_text(source, encoding="utf-8")
        check = subprocess.run([node, "--check", str(script)], capture_output=True, text=True, check=False)
        assert check.returncode == 0, check.stderr
