"""Explicit live smoke test for the configured API-Football plan.

This command is intended for a manual run or a CI job with a secret injected
into the environment. It never prints credentials or fixture/player details.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from .providers.api_football import ApiFootballClient, ProviderError
from .sync import active_season_year


def missing_required_coverage(coverage: dict[str, object]) -> list[str]:
    """Return required features not explicitly covered for the chosen league."""
    missing: list[str] = []
    if not coverage.get("fixtures"):
        missing.append("fixtures")
    if coverage.get("injuries") is not True:
        missing.append("injuries")
    if coverage.get("odds") is not True:
        missing.append("odds")
    return missing


def main() -> int:
    if not os.getenv("API_FOOTBALL_KEY", "").strip():
        print("Live smoke skipped: API_FOOTBALL_KEY is not configured in the environment.", file=sys.stderr)
        return 2

    try:
        league_id = int(os.getenv("MATCHMIND_LIVE_SMOKE_LEAGUE", "135"))
        season = int(os.getenv("MATCHMIND_LIVE_SMOKE_SEASON", str(active_season_year())))
        timezone_name = os.getenv("MATCHMIND_TIMEZONE", "Europe/Rome")
        local_now = datetime.now(ZoneInfo(timezone_name))
        date_from = local_now.date().isoformat()
        date_to = (local_now.date() + timedelta(days=7)).isoformat()
        with ApiFootballClient() as client:
            metadata = client.league_coverage(league_id, season)
            season_data = metadata.get("season") or {}
            coverage = season_data.get("coverage") or {}
            missing = missing_required_coverage(coverage)
            if missing:
                print(json.dumps({
                    "status": "insufficient_plan_coverage", "league_id": league_id, "season": season,
                    "missing_required_coverage": missing,
                    "message": "The provider plan must explicitly cover fixtures, injuries and odds for this competition/season.",
                }, ensure_ascii=False, indent=2))
                return 2
            fixtures = client.fixtures(league_id, season, date_from=date_from, date_to=date_to, timezone=timezone_name)
            injuries = client.injuries(league_id, season, date=date_from)
            odds = client.odds(league_id, season, date=date_from, timezone=timezone_name)
        print(json.dumps({
            "status": "success", "provider": "API-Football", "league_id": league_id, "season": season,
            "coverage": {"fixtures": True, "injuries": True, "odds": True},
            "fixture_window": {"from": date_from, "to": date_to, "records_returned": len(fixtures)},
            "injury_endpoint": {"date": date_from, "records_returned": len(injuries)},
            "odds_endpoint": {"date": date_from, "records_returned": len(odds)},
            "note": "A zero record count can mean no data exists for the selected date; successful responses verify authentication and endpoint access, not forecast accuracy.",
        }, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, ProviderError, OSError) as exc:
        # Provider exceptions are sanitized by ApiFootballClient; never echo an environment variable.
        print(f"Live provider smoke failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())