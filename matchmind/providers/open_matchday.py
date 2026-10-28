"""No-key CSV adapter for the public open-matchday football dataset.

Coverage is limited to fixtures, results and whichever match statistics the source
publishes. It does not provide odds, injuries, line-ups or complete player data.
"""
from __future__ import annotations

import csv
import hashlib
import io
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

BASE_URL = "https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data"
SOURCE_NAME = "open-matchday"
SOURCE_URL = "https://github.com/oladeeayo/open-matchday"
DEFAULT_LEAGUE = "ITA_1_serie-a"
DEFAULT_TIMEOUT = 20.0


class OpenMatchdayError(RuntimeError):
    """The public CSV source could not provide usable data."""


def _stable_id(value: str) -> int:
    # Keep IDs positive and within SQLite's signed 32-bit range.
    return (int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:8], 16) & 0x7FFFFFFF) or 1


def _season_code(start_year: int) -> str:
    if not 2000 <= int(start_year) <= 2100:
        raise ValueError("season must be a start year between 2000 and 2100")
    return f"{int(start_year) % 100:02d}{(int(start_year) + 1) % 100:02d}"


def _kickoff_utc(day: str, time_text: str) -> str:
    match_day = date.fromisoformat(day.strip())
    if time_text and time_text.strip():
        parsed_time = datetime.strptime(time_text.strip()[:5], "%H:%M").time()
        # Dataset documents times using a fixed CET-1 convention (not DST-aware).
        local_fixed = datetime.combine(match_day, parsed_time, tzinfo=timezone(timedelta(hours=1)))
    else:
        # Date-only fixtures are kept at midday to avoid fabricating a kickoff time.
        local_fixed = datetime.combine(match_day, datetime.min.time().replace(hour=12), tzinfo=timezone.utc)
    return local_fixed.astimezone(timezone.utc).isoformat()


def _parse_csv(body: str) -> list[dict[str, str]]:
    try:
        return list(csv.DictReader(io.StringIO(body.lstrip("\ufeff"))))
    except (csv.Error, UnicodeError) as exc:
        raise OpenMatchdayError("Public football CSV could not be parsed.") from exc


class OpenMatchdayClient:
    """Fetch current or historical season CSVs without account credentials."""

    def __init__(self, *, http_client: httpx.Client | None = None, timeout: float = DEFAULT_TIMEOUT) -> None:
        self._owns_client = http_client is None
        self._http = http_client or httpx.Client(timeout=timeout, follow_redirects=True)

    def close(self) -> None:
        if self._owns_client:
            self._http.close()

    def __enter__(self) -> "OpenMatchdayClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def _csv(self, league_slug: str, filename: str, season_code: str) -> list[dict[str, str]]:
        if not league_slug or "/" in league_slug or ".." in league_slug:
            raise ValueError("league_slug must be a single competition folder name")
        url = f"{BASE_URL}/{league_slug}/{filename}_{season_code}.csv"
        try:
            response = self._http.get(url, headers={"Accept": "text/csv", "User-Agent": "MatchMind-personal-research/0.3"})
        except httpx.RequestError as exc:
            raise OpenMatchdayError("Could not reach the public football CSV source.") from exc
        if response.status_code == 404:
            return []
        if response.status_code >= 400:
            raise OpenMatchdayError(f"Public football CSV source returned HTTP {response.status_code}.")
        return _parse_csv(response.text)

    def fixtures(self, league_slug: str = DEFAULT_LEAGUE, season: int = 2026) -> list[dict[str, Any]]:
        code = _season_code(season)
        # A maximum of two small CSV requests per league/season sync.
        results = self._csv(league_slug, "results", code)
        scheduled = self._csv(league_slug, "fixtures", code)
        rows: dict[tuple[str, str, str], dict[str, str]] = {}
        for row in results + scheduled:
            home = (row.get("home") or "").strip()
            away = (row.get("away") or "").strip()
            day = (row.get("date") or "").strip()
            if not home or not away or not day:
                continue
            try:
                kickoff = _kickoff_utc(day, row.get("time") or "")
            except (ValueError, TypeError):
                continue
            rows[(kickoff[:10], home.casefold(), away.casefold())] = {**row, "_kickoff_utc": kickoff, "_home": home, "_away": away}
        output: list[dict[str, Any]] = []
        league_id = _stable_id("open-matchday:league:" + league_slug)
        for row in rows.values():
            home, away = row["_home"], row["_away"]
            kickoff = row["_kickoff_utc"]
            match_key = f"{league_slug}|{season}|{kickoff[:10]}|{home.casefold()}|{away.casefold()}"
            raw_home, raw_away = row.get("ft_home"), row.get("ft_away")
            try:
                home_goals = int(raw_home) if raw_home not in (None, "") else None
                away_goals = int(raw_away) if raw_away not in (None, "") else None
            except ValueError:
                home_goals = away_goals = None
            status = "FT" if home_goals is not None and away_goals is not None else "NS"
            fixture_id = _stable_id("open-matchday:fixture:" + match_key)
            output.append({
                "fixture": {"id": fixture_id, "date": kickoff, "status": {"short": status}},
                "league": {"id": league_id, "name": league_slug, "season": int(season)},
                "teams": {
                    "home": {"id": _stable_id("open-matchday:team:" + home.casefold()), "name": home},
                    "away": {"id": _stable_id("open-matchday:team:" + away.casefold()), "name": away},
                },
                "goals": {"home": home_goals, "away": away_goals},
                "_source": SOURCE_NAME,
                "_source_url": SOURCE_URL,
                "_statistics": {key: row.get(key) for key in (
                    "ht_home", "ht_away", "home_shots", "away_shots", "home_shots_on_target",
                    "away_shots_on_target", "home_corners", "away_corners", "home_yellow",
                    "away_yellow", "home_red", "away_red", "goal_minutes"
                ) if row.get(key) not in (None, "")},
            })
        return sorted(output, key=lambda item: item["fixture"]["date"])
