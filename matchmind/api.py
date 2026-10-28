"""MatchMind HTTP API and optional local daily synchronization scheduler."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from pathlib import Path
from pydantic import BaseModel, Field

from .analysis import compare_market
from .historical_model import InsufficientHistoricalData, estimate_expected_goals
from .fixture_odds import analyse_fixture_odds
from .model import forecast_markets, market_dict
from .providers.api_football import ApiFootballClient, ProviderAPIError, ProviderConfigurationError, ProviderError
from .providers.open_matchday import OpenMatchdayClient, OpenMatchdayError, DEFAULT_LEAGUE as DEFAULT_OPEN_MATCHDAY_LEAGUE
from .storage import MatchMindStore
from .sync import MatchMindSync, active_season_year, run_public_csv_sync, run_scheduled_sync

try:
    from apscheduler.schedulers.background import BackgroundScheduler
except ImportError:  # keeps analytical endpoints usable if scheduler isn't installed
    BackgroundScheduler = None  # type: ignore[assignment,misc]


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def _start_scheduler():
    api_auto = _truthy(os.getenv("MATCHMIND_AUTO_SYNC", "false")) and _configured()
    public_auto = _truthy(os.getenv("MATCHMIND_PUBLIC_AUTO_SYNC", "false"))
    if not api_auto and not public_auto:
        return None
    if BackgroundScheduler is None:
        raise RuntimeError("Automatic synchronization requires APScheduler; install project runtime dependencies.")

    timezone_name = os.getenv("MATCHMIND_TIMEZONE", "Europe/Rome")
    timezone = ZoneInfo(timezone_name)
    scheduler = BackgroundScheduler(timezone=timezone)

    if api_auto:
        hour = int(os.getenv("MATCHMIND_SYNC_HOUR", "4"))
        minute = int(os.getenv("MATCHMIND_SYNC_MINUTE", "20"))
        if hour not in range(24) or minute not in range(60):
            raise RuntimeError("MATCHMIND_SYNC_HOUR must be 0-23 and MATCHMIND_SYNC_MINUTE must be 0-59.")
        scheduler.add_job(
            run_scheduled_sync, "cron", hour=hour, minute=minute,
            id="matchmind-daily-sync", replace_existing=True, max_instances=1, coalesce=True
        )
        if _truthy(os.getenv("MATCHMIND_SYNC_ON_STARTUP", "true")):
            scheduler.add_job(
                run_scheduled_sync, "date", run_date=datetime.now(timezone) + timedelta(seconds=8),
                id="matchmind-startup-sync", max_instances=1
            )

    if public_auto:
        public_hour = int(os.getenv("MATCHMIND_PUBLIC_SYNC_HOUR", "4"))
        public_minute = int(os.getenv("MATCHMIND_PUBLIC_SYNC_MINUTE", "5"))
        if public_hour not in range(24) or public_minute not in range(60):
            raise RuntimeError("MATCHMIND_PUBLIC_SYNC_HOUR must be 0-23 and MATCHMIND_PUBLIC_SYNC_MINUTE must be 0-59.")
        scheduler.add_job(
            run_public_csv_sync, "cron", hour=public_hour, minute=public_minute,
            id="matchmind-public-daily-sync", replace_existing=True, max_instances=1, coalesce=True
        )
        if _truthy(os.getenv("MATCHMIND_PUBLIC_SYNC_ON_STARTUP", "true")):
            scheduler.add_job(
                run_public_csv_sync, "date", run_date=datetime.now(timezone) + timedelta(seconds=8),
                id="matchmind-public-startup-sync", max_instances=1
            )

    scheduler.start()
    return scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = _start_scheduler()
    app.state.sync_scheduler = scheduler
    try:
        yield
    finally:
        if scheduler is not None:
            scheduler.shutdown(wait=False)


app = FastAPI(
    title="MatchMind — AI Sports Lab", version="0.2.0",
    description="Private-first football data pipeline and transparent statistical baseline. Not a trained AI model.",
    lifespan=lifespan,
)


class ForecastRequest(BaseModel):
    home_xg: float = Field(ge=0, le=12)
    away_xg: float = Field(ge=0, le=12)
    max_goals: int = Field(default=12, ge=4, le=30)


class MarketRequest(BaseModel):
    selections: list[str]
    odds: list[float]
    model_probabilities: list[float] | None = None


def _configured() -> bool:
    return bool(os.getenv("API_FOOTBALL_KEY", "").strip())


def _store() -> MatchMindStore:
    try:
        return MatchMindStore()
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _sync_call(method: str, *, league_id: int, season: int, team_id: int | None = None, date_from: str | None = None, date_to: str | None = None, date: str | None = None):
    if not _configured():
        raise HTTPException(status_code=503, detail="Live provider not configured. Set API_FOOTBALL_KEY in the environment; do not put it in the repository.")
    store = _store()
    with ApiFootballClient() as client:
        service = MatchMindSync(store=store, client=client)
        try:
            if method == "fixtures":
                return service.fixtures(league_id, season, date_from=date_from, date_to=date_to)
            if method == "injuries":
                return service.injuries(league_id, season, date=date)
            if method == "odds":
                return service.odds(league_id, season, date=date)
            if method == "players" and team_id is not None:
                return service.players(league_id, season, team_id)
            if method == "all":
                return service.all(league_id, season)
        except ProviderConfigurationError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except ProviderError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except Exception as exc:
            # Don't expose stack traces, request headers, or credentials to HTTP clients.
            raise HTTPException(status_code=500, detail=f"Synchronization failed ({type(exc).__name__}); inspect local logs.") from exc
        finally:
            service.close()
    raise HTTPException(status_code=400, detail="Unsupported sync operation.")


@app.get("/", include_in_schema=False)
def dashboard():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


@app.get("/health")
def health():
    return {"status": "ok", "mode": "local", "provider": "API-Football",
            "live_data_configured": _configured(),
            "automatic_sync_enabled": _truthy(os.getenv("MATCHMIND_AUTO_SYNC", "false")) and _configured(),
            "public_data_provider": "open-matchday",
            "public_data_api_key_required": False,
            "public_automatic_sync_enabled": _truthy(os.getenv("MATCHMIND_PUBLIC_AUTO_SYNC", "false")),
            "trained_model_configured": False,
            "historical_baseline_available": _store().coverage()["fixtures"]["count"] > 0}


@app.get("/provider/status")
def provider_status():
    key_present = _configured()
    return {"provider": "API-Football", "configured": key_present,
            "automatic_sync_enabled": _truthy(os.getenv("MATCHMIND_AUTO_SYNC", "false")) and key_present,
            "public_data_provider": "open-matchday",
            "public_data_api_key_required": False,
            "public_automatic_sync_enabled": _truthy(os.getenv("MATCHMIND_PUBLIC_AUTO_SYNC", "false")),
            "public_competitions": [p.strip() for p in os.getenv("MATCHMIND_PUBLIC_LEAGUES", DEFAULT_OPEN_MATCHDAY_LEAGUE).split(",") if p.strip()],
            "database": "sqlite", "active_season_default": active_season_year(),
            "configured_leagues": [p.strip() for p in os.getenv("MATCHMIND_LEAGUES", "135").split(",") if p.strip()],
            "historical_seasons": max(0, min(5, int(os.getenv("MATCHMIND_HISTORY_SEASONS", "2")))),
            "scope": "Public mode provides daily fixtures/results and available match stats; odds, injuries and player availability require other feeds."}


@app.get("/data/coverage")
def data_coverage():
    return _store().coverage()


@app.get("/provider/coverage")
def provider_coverage(league_id: int = Query(default=135, gt=0), season: int = Query(default_factory=active_season_year, ge=2000, le=2100)):
    if not _configured():
        raise HTTPException(status_code=503, detail="Live provider not configured. Set API_FOOTBALL_KEY privately in the environment.")
    with ApiFootballClient() as client:
        try:
            return client.league_coverage(league_id, season)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except ProviderError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/data/fixtures")
def data_fixtures(
    league_id: int | None = Query(default=None, gt=0),
    season: int | None = Query(default=None, ge=2000, le=2100),
    source: str | None = Query(default=None, min_length=1, max_length=64),
    limit: int = Query(default=100, ge=1, le=500),
):
    return {"fixtures": _store().list_fixtures(league_id=league_id, season=season, source=source, limit=limit)}


@app.get("/data/players/{team_id}")
def data_players(team_id: int, season: int | None = Query(default=None, ge=2000, le=2100), limit: int = Query(default=100, ge=1, le=500)):
    if team_id <= 0:
        raise HTTPException(status_code=422, detail="team_id must be positive")
    return {"players": _store().player_statistics_for_team(team_id, season, limit=limit)}


@app.post("/sync/open-matchday")
def sync_open_matchday(
    league_slug: str = Query(default=DEFAULT_OPEN_MATCHDAY_LEAGUE, min_length=3, max_length=80),
    season: int = Query(default_factory=active_season_year, ge=2000, le=2100),
):
    """Import public fixtures/results from open-matchday; no API key required."""
    try:
        with OpenMatchdayClient() as client:
            records = client.fixtures(league_slug=league_slug, season=season)
        if not records:
            raise HTTPException(status_code=404, detail="No CSV rows found for this competition and season; verify the folder name and season on the source repository.")
        stored = _store().upsert_fixtures(records)
        completed = sum(1 for row in records if row["goals"]["home"] is not None and row["goals"]["away"] is not None)
        return {
            "provider": "open-matchday", "api_key_required": False,
            "league_slug": league_slug, "season": season,
            "fetched": len(records), "stored_or_updated": stored,
            "completed_results": completed, "scheduled_fixtures": len(records) - completed,
            "status": "success",
            "limitations": ["No bookmaker odds, injuries, lineups or complete player data.", "Coverage and statistics vary by competition.", "Source data are refreshed daily, not live."],
            "source_url": "https://github.com/oladeeayo/open-matchday",
        }
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except OpenMatchdayError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/sync/fixtures")
def sync_fixtures(league_id: int = Query(default=135, gt=0), season: int = Query(default_factory=active_season_year, ge=2000, le=2100), date_from: str | None = None, date_to: str | None = None):
    return _sync_call("fixtures", league_id=league_id, season=season, date_from=date_from, date_to=date_to)


@app.post("/sync/injuries")
def sync_injuries(league_id: int = Query(default=135, gt=0), season: int = Query(default_factory=active_season_year, ge=2000, le=2100), date: str | None = None):
    return _sync_call("injuries", league_id=league_id, season=season, date=date)


@app.post("/sync/odds")
def sync_odds(league_id: int = Query(default=135, gt=0), season: int = Query(default_factory=active_season_year, ge=2000, le=2100), date: str | None = None):
    return _sync_call("odds", league_id=league_id, season=season, date=date)


@app.post("/sync/players")
def sync_players(league_id: int = Query(default=135, gt=0), season: int = Query(default_factory=active_season_year, ge=2000, le=2100), team_id: int = Query(gt=0)):
    return _sync_call("players", league_id=league_id, season=season, team_id=team_id)


@app.post("/sync/all")
def sync_all(league_id: int = Query(default=135, gt=0), season: int = Query(default_factory=active_season_year, ge=2000, le=2100)):
    return _sync_call("all", league_id=league_id, season=season)


@app.post("/forecast")
def forecast(request: ForecastRequest):
    try:
        return {"mode": "statistical_baseline", "source": "user_supplied_xg", "markets": market_dict(forecast_markets(request.home_xg, request.away_xg, request.max_goals))}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/forecast/fixture/{fixture_id}")
def forecast_stored_fixture(fixture_id: int):
    store = _store()
    fixture = store.get_fixture(fixture_id)
    if fixture is None:
        raise HTTPException(status_code=404, detail="Fixture not found in the local database. Sync fixtures first.")
    history = store.completed_fixtures_before(fixture["league_id"], fixture["kickoff_utc"], limit=5000)
    try:
        estimated = estimate_expected_goals(history, home_team_id=fixture["home_team_id"], away_team_id=fixture["away_team_id"], kickoff_utc=fixture["kickoff_utc"])
    except InsufficientHistoricalData as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    markets = market_dict(forecast_markets(estimated["home_xg"], estimated["away_xg"]))
    injuries = store.injuries_for_fixture(fixture_id)
    odds = store.odds_for_fixture(fixture_id)
    home_players = store.player_statistics_for_team(fixture["home_team_id"], fixture["season"], limit=8) if fixture["home_team_id"] is not None else []
    away_players = store.player_statistics_for_team(fixture["away_team_id"], fixture["season"], limit=8) if fixture["away_team_id"] is not None else []
    odds_analysis = analyse_fixture_odds(odds, markets)
    return {"fixture": {"fixture_id": fixture["fixture_id"], "kickoff_utc": fixture["kickoff_utc"], "league": fixture["league_name"], "season": fixture["season"], "home_team": fixture["home_team"], "away_team": fixture["away_team"], "home_team_id": fixture["home_team_id"], "away_team_id": fixture["away_team_id"], "status": fixture["status_short"]},
            "mode": "historical_score_statistical_baseline", "source": "locally_stored_provider_data", "expected_goals_estimate": estimated,
            "markets": markets, "data_context": {"injury_records": len(injuries), "odds_snapshot_records": len(odds), "home_player_records": len(home_players), "away_player_records": len(away_players), "injury_effect_in_model": False, "odds_used_to_calibrate_forecast": False,
            "note": "Injury, player and bookmaker data are shown as context only; their predictive effects must be calibrated on out-of-sample historical data before they influence probabilities."},
            "players": {"home": home_players, "away": away_players}, "injuries": injuries, "odds": odds[:200], "odds_analysis": odds_analysis}


@app.post("/odds/analyse")
def analyse_odds(request: MarketRequest):
    try:
        return compare_market(request.selections, request.odds, request.model_probabilities)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc