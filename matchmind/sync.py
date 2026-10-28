"""Orchestrate provider pulls and persist each sync attempt to SQLite."""
from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Callable
from zoneinfo import ZoneInfo

from .providers.api_football import ApiFootballClient, ProviderConfigurationError, ProviderError
from .providers.open_matchday import OpenMatchdayClient, OpenMatchdayError, DEFAULT_LEAGUE as DEFAULT_OPEN_MATCHDAY_LEAGUE, league_id_for_slug
from .storage import MatchMindStore


def active_season_year(now: datetime | None = None, start_month: int = 7) -> int:
    """Return the season's starting year; July is the default season boundary."""
    current = now or datetime.now(ZoneInfo(os.getenv("MATCHMIND_TIMEZONE", "Europe/Rome")))
    if not 1 <= int(start_month) <= 12:
        raise ValueError("start_month must be in [1, 12]")
    return current.year if current.month >= int(start_month) else current.year - 1


class MatchMindSync:
    def __init__(self, store: MatchMindStore | None = None, client: ApiFootballClient | None = None) -> None:
        self.store = store or MatchMindStore()
        self.client = client or ApiFootballClient()
        self._owns_client = client is None

    def close(self) -> None:
        if self._owns_client:
            self.client.close()

    def __enter__(self) -> "MatchMindSync":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def _run(self, data_type: str, league: int, season: int, pull: Callable[[], list[dict[str, Any]]], save: Callable[[list[dict[str, Any]]], int]) -> dict[str, Any]:
        sync_id = self.store.start_sync(data_type, league, season)
        try:
            records = pull()
            stored = save(records)
            self.store.finish_sync(sync_id, status="success", records_count=stored)
            return {"sync_id": sync_id, "data_type": data_type, "league_id": int(league), "season": int(season), "fetched": len(records), "stored_or_updated": stored, "status": "success"}
        except Exception as exc:
            # Provider exceptions are deliberately sanitized and never include request headers.
            message = str(exc)[:500] if isinstance(exc, (ProviderError, ValueError)) else f"Unexpected {type(exc).__name__} during sync."
            self.store.finish_sync(sync_id, status="failed", error_message=message)
            raise

    def fixtures(self, league: int, season: int, *, date_from: str | None = None, date_to: str | None = None) -> dict[str, Any]:
        return self._run("fixtures", league, season,
            lambda: self.client.fixtures(league, season, date_from=date_from, date_to=date_to), self.store.upsert_fixtures)

    def injuries(self, league: int, season: int, *, date: str | None = None) -> dict[str, Any]:
        return self._run("injuries", league, season,
            lambda: self.client.injuries(league, season, date=date), self.store.upsert_injuries)

    def odds(self, league: int, season: int, *, date: str | None = None) -> dict[str, Any]:
        return self._run("odds", league, season,
            lambda: self.client.odds(league, season, date=date), self.store.upsert_odds)

    def players(self, league: int, season: int, team: int) -> dict[str, Any]:
        return self._run("player_statistics", league, season,
            lambda: self.client.player_statistics(league, season, team), self.store.upsert_player_statistics)

    def all(self, league: int, season: int, *, include_injuries: bool = True, include_odds: bool = True) -> dict[str, Any]:
        result: dict[str, Any] = {"provider": "API-Football", "league_id": int(league), "season": int(season), "syncs": [], "warnings": []}
        # Fixtures are the core; a secondary endpoint being unavailable should not hide a successful fixture import.
        result["syncs"].append(self.fixtures(league, season))
        if include_injuries:
            try:
                result["syncs"].append(self.injuries(league, season))
            except Exception as exc:
                result["warnings"].append(f"Injuries sync failed: {str(exc)[:200]}")
        if include_odds:
            try:
                result["syncs"].append(self.odds(league, season))
            except Exception as exc:
                result["warnings"].append(f"Odds sync failed: {str(exc)[:200]}")
        result["status"] = "partial" if result["warnings"] else "success"
        return result


def run_scheduled_sync() -> dict[str, Any]:
    """Synchronize configured leagues: current and recent historical fixtures, current injuries/odds."""
    client = ApiFootballClient()
    if not client.configured:
        client.close()
        raise ProviderConfigurationError("Automatic sync requires API_FOOTBALL_KEY.")
    leagues = [int(part.strip()) for part in os.getenv("MATCHMIND_LEAGUES", "135").split(",") if part.strip()]
    history_years = max(0, min(5, int(os.getenv("MATCHMIND_HISTORY_SEASONS", "2"))))
    current = active_season_year()
    store = MatchMindStore()
    service = MatchMindSync(store=store, client=client)
    output: dict[str, Any] = {"provider": "API-Football", "season": current, "leagues": []}
    try:
        for league in leagues:
            league_result: dict[str, Any] = {"league_id": league, "seasons": []}
            for season in range(current - history_years, current + 1):
                one: dict[str, Any] = {"season": season, "syncs": []}
                try:
                    one["syncs"].append(service.fixtures(league, season))
                    if season == current and os.getenv("MATCHMIND_AUTO_SYNC_PLAYERS", "false").lower() in {"1", "true", "yes", "on"}:
                        fixture_rows = store.list_fixtures(league_id=league, season=season, limit=500)
                        team_ids = sorted({int(v) for match in fixture_rows for v in (match.get("home_team_id"), match.get("away_team_id")) if v is not None})
                        player_warnings: list[str] = []
                        for team_id in team_ids:
                            try:
                                one["syncs"].append(service.players(league, season, team_id))
                            except Exception as exc:
                                player_warnings.append(f"Player statistics sync failed for team {team_id}: {str(exc)[:160]}")
                        if player_warnings:
                            one["warnings"] = one.get("warnings", []) + player_warnings
                    if season == current:
                        try:
                            one["syncs"].append(service.injuries(league, season))
                        except Exception as exc:
                            one["warnings"] = one.get("warnings", []) + [f"Injuries sync failed: {str(exc)[:200]}"]
                        try:
                            one["syncs"].append(service.odds(league, season))
                        except Exception as exc:
                            one["warnings"] = one.get("warnings", []) + [f"Odds sync failed: {str(exc)[:200]}"]
                    one["status"] = "success" if not one.get("warnings") else "partial"
                except Exception as exc:
                    one["status"] = "failed"
                    one["error"] = str(exc)[:300]
                league_result["seasons"].append(one)
            output["leagues"].append(league_result)
        output["status"] = "success" if all(s.get("status") == "success" for l in output["leagues"] for s in l["seasons"]) else "partial"
        return output
    finally:
        service.close()
        client.close()

def run_public_csv_sync() -> dict[str, Any]:
    """Refresh configured competitions from the public no-key CSV source."""
    raw_leagues = os.getenv("MATCHMIND_PUBLIC_LEAGUES", DEFAULT_OPEN_MATCHDAY_LEAGUE)
    leagues = [part.strip() for part in raw_leagues.split(",") if part.strip()]
    if not leagues:
        raise ValueError("MATCHMIND_PUBLIC_LEAGUES must contain at least one competition folder.")
    season = int(os.getenv("MATCHMIND_PUBLIC_SEASON", str(active_season_year())))
    if not 2000 <= season <= 2100:
        raise ValueError("MATCHMIND_PUBLIC_SEASON must be a season start year between 2000 and 2100.")

    store = MatchMindStore()
    output: dict[str, Any] = {
        "provider": "open-matchday",
        "api_key_required": False,
        "season": season,
        "competitions": [],
        "source_url": "https://github.com/oladeeayo/open-matchday",
    }
    with OpenMatchdayClient() as client:
        for slug in leagues:
            competition: dict[str, Any] = {"league_slug": slug, "season": season}
            sync_id: int | None = None
            try:
                league_id = league_id_for_slug(slug)
                sync_id = store.start_sync("public_csv_fixtures", league_id, season, source="open-matchday")
                records = client.fixtures(league_slug=slug, season=season)
                if not records:
                    raise OpenMatchdayError(
                        "No rows found for this competition/season. Verify the source folder and season file."
                    )
                stored = store.upsert_fixtures(records)
                completed = sum(
                    1 for row in records
                    if row.get("goals", {}).get("home") is not None
                    and row.get("goals", {}).get("away") is not None
                )
                store.finish_sync(sync_id, status="success", records_count=stored)
                competition.update({
                    "league_id": league_id,
                    "fetched": len(records),
                    "stored_or_updated": stored,
                    "completed_results": completed,
                    "scheduled_fixtures": len(records) - completed,
                    "status": "success",
                })
            except (OpenMatchdayError, ValueError) as exc:
                if sync_id is not None:
                    store.finish_sync(sync_id, status="failed", error_message=str(exc)[:500])
                competition.update({"status": "failed", "error": str(exc)[:300]})
            except Exception as exc:
                if sync_id is not None:
                    store.finish_sync(sync_id, status="failed", error_message=f"Unexpected {type(exc).__name__}")
                competition.update({"status": "failed", "error": f"Unexpected {type(exc).__name__} during public data sync."})
            output["competitions"].append(competition)
    statuses = [row["status"] for row in output["competitions"]]
    output["status"] = "success" if statuses and all(status == "success" for status in statuses) else (
        "failed" if statuses and all(status == "failed" for status in statuses) else "partial"
    )
    output["last_retrieved_at"] = datetime.now(ZoneInfo(os.getenv("MATCHMIND_TIMEZONE", "Europe/Rome"))).isoformat()
    return output
