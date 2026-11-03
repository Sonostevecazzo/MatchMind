#!/usr/bin/env python3
"""Fetch and parse the public Sisal football quote sheet into MatchMind JSON.

The sheet is linked from Sisal's public "Foglio Quote" page and is a dated
snapshot, not a guaranteed live price feed. Quotes are never invented.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

import pdfplumber
from bs4 import BeautifulSoup

SISAL_QUOTES_PAGE = "https://www.sisal.it/scommesse-matchpoint/foglio-quote"
FALLBACK_PDF_URL = (
    "https://landing.sisal.it/volantini/Scommesse_Sport/Quote/"
    "calcio%20base%20per%20manifestazione.pdf"
)
USER_AGENT = "MatchMind quote reader/1.0 (public Sisal quote sheet)"
DATE_RE = re.compile(r"^(\d{1,2})/(\d{1,2})$")
TIME_RE = re.compile(r"^\d{1,2}[.:]\d{2}$")
COLUMN_X = {
    "home": 260.5,
    "draw": 275.5,
    "away": 290.5,
    "under15": 402.2,
    "over15": 417.2,
    "under25": 432.2,
    "over25": 447.2,
    "under35": 462.2,
    "over35": 477.2,
    "bttsYes": 492.2,
    "bttsNo": 507.2,
}


def request_bytes(url: str) -> tuple[bytes, dict[str, str], str]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/pdf,text/html;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read(), dict(response.headers.items()), response.geturl()


def quote_pdf_url() -> str:
    try:
        html, _, page_url = request_bytes(SISAL_QUOTES_PAGE)
        soup = BeautifulSoup(html, "html.parser")
        for anchor in soup.find_all("a", href=True):
            label = " ".join(anchor.get_text(" ", strip=True).split()).casefold()
            if "calcio base per manifestazione" in label and "top" not in label:
                return urljoin(page_url, anchor["href"])
    except Exception as exc:
        print(f"Sisal quote index unavailable; using published PDF URL: {exc}", file=sys.stderr)
    return FALLBACK_PDF_URL


def number_value(text: str | None) -> float | None:
    if not text:
        return None
    raw = text.strip().replace(" ", "")
    normalized = raw.replace(".", "").replace(",", ".") if "," in raw else raw
    try:
        value = float(normalized)
    except ValueError:
        return None
    return value if value > 1 else None


def date_with_year(day: int, month: int, today: date) -> str:
    year = today.year
    if month < today.month - 6:
        year += 1
    elif month > today.month + 6:
        year -= 1
    return date(year, month, day).isoformat()


def nearest_text(words: list[dict], x: float) -> str | None:
    candidates = [
        (abs(float(word["x0"]) - x), word["text"])
        for word in words
        if abs(float(word["x0"]) - x) <= 2.2
    ]
    if not candidates:
        return None
    _, text = min(candidates, key=lambda item: item[0])
    return text


def read_matches(pdf_bytes: bytes, today: date) -> list[dict]:
    matches_by_key: dict[tuple[str, str, str], dict] = {}
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            words = page.extract_words(x_tolerance=1, y_tolerance=2, keep_blank_chars=False)
            starts = [
                word for word in words
                if float(word["x0"]) < 35 and DATE_RE.fullmatch(word["text"].strip())
            ]
            for start in starts:
                row_y = float(start["top"])
                row = [
                    word for word in words
                    if abs(float(word["top"]) - row_y) <= 1.6
                ]
                date_match = DATE_RE.fullmatch(start["text"].strip())
                if not date_match:
                    continue
                time_word = next(
                    (w["text"] for w in row
                     if 35 <= float(w["x0"]) < 59 and TIME_RE.fullmatch(w["text"].strip())),
                    None,
                )
                home = " ".join(
                    w["text"] for w in sorted(row, key=lambda item: item["x0"])
                    if 100 <= float(w["x0"]) < 179
                ).strip()
                away = " ".join(
                    w["text"] for w in sorted(row, key=lambda item: item["x0"])
                    if 179 <= float(w["x0"]) < 250
                ).strip()
                if not time_word or not home or not away:
                    continue

                try:
                    kickoff = date_with_year(int(date_match.group(1)), int(date_match.group(2)), today)
                except ValueError:
                    continue

                odds = {
                    key: number_value(nearest_text(row, x))
                    for key, x in COLUMN_X.items()
                }
                if any(odds.get(key) is None for key in ("home", "draw", "away")):
                    continue

                time_value = time_word.replace(".", ":")
                key = (kickoff, home.casefold(), away.casefold())
                matches_by_key[key] = {
                    "date": kickoff,
                    "time": time_value,
                    "home": home,
                    "away": away,
                    "odds": odds,
                }

    return sorted(
        matches_by_key.values(),
        key=lambda item: (item["date"], item["time"], item["home"], item["away"]),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("mobile/sisal-quotes.json"),
        help="path for the generated JSON snapshot",
    )
    parser.add_argument(
        "--pdf",
        type=Path,
        help="parse an already-downloaded PDF instead of fetching Sisal",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=45,
        help="keep only matches from today through this many days ahead",
    )
    args = parser.parse_args()

    now = datetime.now(ZoneInfo("Europe/Rome"))
    if args.pdf:
        pdf_bytes = args.pdf.read_bytes()
        source_url = FALLBACK_PDF_URL
        response_headers: dict[str, str] = {}
    else:
        pdf_url = quote_pdf_url()
        pdf_bytes, response_headers, source_url = request_bytes(pdf_url)

    horizon = now.date().fromordinal(now.date().toordinal() + max(1, args.days))
    matches = [
        match for match in read_matches(pdf_bytes, now.date())
        if now.date().isoformat() <= match["date"] <= horizon.isoformat()
    ]
    if not matches:
        raise SystemExit("Sisal PDF parsed, but no quoted matches fall in the next %s days." % max(1, args.days))

    snapshot = {
        "schemaVersion": 1,
        "source": "Sisal · Foglio quote per manifestazione",
        "sourcePage": SISAL_QUOTES_PAGE,
        "sourceUrl": source_url,
        "checkedAt": now.isoformat(timespec="seconds"),
        "sourceLastModified": response_headers.get("Last-Modified"),
        "pdfSha256": hashlib.sha256(pdf_bytes).hexdigest(),
        "matchCount": len(matches),
        "matches": matches,
    }
    if args.output.exists():
        try:
            current = json.loads(args.output.read_text(encoding="utf-8"))
            if current.get("pdfSha256") == snapshot["pdfSha256"] and current.get("matches") == matches:
                print("Sisal quote sheet is unchanged; keeping the current snapshot.")
                return 0
        except (OSError, json.JSONDecodeError):
            pass
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"Saved {len(matches)} matches to {args.output}")
    print(f"Source: {source_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
