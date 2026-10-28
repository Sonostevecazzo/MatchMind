from __future__ import annotations
import json
import sqlite3
from datetime import datetime, timezone, timedelta
import httpx
import pytest
from fastapi.testclient import TestClient

from matchmind.providers.api_football import ApiFootballClient, ProviderAPIError, ProviderConfigurationError
from matchmind.storage import MatchMindStore
from matchmind.historical_model import estimate_expected_goals, InsufficientHistoricalData
from matchmind.api import app


def fixture(fid, when, home_id=1, away_id=2, home_goals=1, away_goals=0, status="FT", season=2026):
    return {"fixture":{"id":fid,"date":when,"status":{"short":status}},
            "league":{"id":135,"name":"Serie A","season":season},
            "teams":{"home":{"id":home_id,"name":f"Team {home_id}"},"away":{"id":away_id,"name":f"Team {away_id}"}},
            "goals":{"home":home_goals,"away":away_goals}}


def test_provider_requires_key():
    with ApiFootballClient(api_key="") as client:
        with pytest.raises(ProviderConfigurationError):
            client.fixtures(135, 2026)


def test_provider_paginates_and_sends_key_header():
    seen=[]
    def handler(request):
        seen.append(request)
        page=int(request.url.params.get("page", "1"))
        payload={"errors":[],"paging":{"current":page,"total":2},"response":[{"page":page}]}
        return httpx.Response(200,json=payload)
    http= httpx.Client(transport=httpx.MockTransport(handler))
    with ApiFootballClient("unit-test-secret", http_client=http, max_pages=4) as client:
        result=client.get_all("fixtures", {"league":135,"season":2026})
    http.close()
    assert result==[{"page":1},{"page":2}]
    assert len(seen)==2
    assert all(r.headers["x-apisports-key"]=="unit-test-secret" for r in seen)
    assert all("unit-test-secret" not in str(r.url) for r in seen)


def test_provider_parses_league_coverage():
    def handler(request):
        assert request.url.path.endswith("/leagues")
        assert request.url.params["league"] == "135"
        return httpx.Response(200, json={"errors": [], "paging": {"current": 1, "total": 1}, "response": [
            {"league": {"id": 135, "name": "Serie A"}, "country": {"name": "Italy"},
             "seasons": [{"year": 2026, "coverage": {"fixtures": {"events": True}, "odds": False, "injuries": True}}]}
        ]})
    http = httpx.Client(transport=httpx.MockTransport(handler))
    with ApiFootballClient("test", http_client=http) as client:
        coverage = client.league_coverage(135, 2026)
    http.close()
    assert coverage["season"]["coverage"]["odds"] is False


def test_provider_sanitizes_auth_error():
    http=httpx.Client(transport=httpx.MockTransport(lambda req:httpx.Response(401,json={"errors":[]})))
    with ApiFootballClient("super-secret",http_client=http) as client:
        with pytest.raises(ProviderAPIError) as err:
            client.get_all("fixtures",{"league":135,"season":2026})
    http.close()
    assert "super-secret" not in str(err.value)
    assert "HTTP 401" in str(err.value)


def test_sqlite_upserts_fixtures_injuries_odds_and_player_stats(tmp_path):
    store=MatchMindStore(tmp_path/"matchmind.db")
    sample=fixture(10,"2026-08-01T15:00:00Z")
    assert store.upsert_fixtures([sample])==1
    assert store.upsert_fixtures([sample])==1
    found=store.get_fixture(10)
    assert found["home_team"]=="Team 1"
    assert found["status_short"]=="FT"
    injury={"fixture":{"id":10},"league":{"id":135,"season":2026},"team":{"id":1,"name":"Team 1"},"player":{"id":99,"name":"Player X","type":"Missing Fixture","reason":"Injury","date":"2026-08-01T12:00:00Z"}}
    assert store.upsert_injuries([injury])==1
    assert store.injuries_for_fixture(10)[0]["player_name"]=="Player X"
    odd={"fixture":{"id":10},"league":{"id":135,"season":2026},"update":"2026-08-01T12:00:00Z","bookmakers":[{"id":1,"name":"ExampleBook","bets":[{"id":1,"name":"Match Winner","values":[{"value":"Home","odd":"2.1"},{"value":"Draw","odd":"3.2"}]}]}]}
    assert store.upsert_odds([odd])==2
    assert store.upsert_odds([odd])==0
    assert len(store.odds_for_fixture(10))==2
    player={"player":{"id":99,"name":"Player X"},"statistics":[{"team":{"id":1,"name":"Team 1"},"league":{"id":135,"name":"Serie A","season":2026},"games":{"appearences":5,"lineups":3,"minutes":240,"rating":"7.1"},"goals":{"total":2,"assists":1},"cards":{"yellow":1,"red":0}}]}
    assert store.upsert_player_statistics([player])==1
    assert store.player_statistics_for_team(1,2026)[0]["goals"]==2
    coverage=store.coverage()
    assert coverage["fixtures"]["count"]==1
    assert coverage["injuries"]["count"]==1
    assert coverage["odds_snapshots"]["count"]==2
    assert coverage["player_statistics"]["count"]==1


def test_history_model_uses_only_pre_kickoff_completed_results():
    history=[]
    for i in range(30):
        when=f"2026-{(i//28)+1:02d}-{(i%28)+1:02d}T12:00:00+00:00"
        home_id=[1,3,2,4][i%4]
        away_id=[2,4,1,3][i%4]
        history.append({"fixture_id":i+1,"kickoff_utc":when,"home_team_id":home_id,"away_team_id":away_id,
                        "home_goals":1+(i%3==0),"away_goals":i%2,"status_short":"FT"})
    target="2026-03-20T12:00:00+00:00"
    result=estimate_expected_goals(history,home_team_id=1,away_team_id=2,kickoff_utc=target)
    assert 0.05<=result["home_xg"]<=6
    assert 0.05<=result["away_xg"]<=6
    assert result["league_matches_used"]==30
    with pytest.raises(InsufficientHistoricalData):
        estimate_expected_goals(history[:10],home_team_id=1,away_team_id=2,kickoff_utc=target)


def test_forecast_fixture_endpoint_uses_prior_results_only(tmp_path,monkeypatch):
    monkeypatch.setenv("DATABASE_URL",f"sqlite:///{tmp_path/'forecast.db'}")
    store = MatchMindStore(tmp_path/"forecast.db")
    base = datetime(2025, 1, 1, tzinfo=timezone.utc)
    for i in range(30):
        when = (base.replace(day=1) + timedelta(days=i*5)).isoformat()
        home_id = [1, 3, 2, 4][i % 4]
        away_id = [2, 4, 1, 3][i % 4]
        store.upsert_fixtures([fixture(100+i, when, home_id, away_id, 1+(i%2), i%2, "FT", 2025)])
    target = fixture(999,"2026-10-01T15:00:00Z",1,2,None,None,"NS",2026)
    store.upsert_fixtures([target])
    with TestClient(app) as client:
        response=client.post("/forecast/fixture/999")
    assert response.status_code==200, response.text
    payload=response.json()
    assert payload["expected_goals_estimate"]["league_matches_used"]==30
    assert "home_win" in payload["markets"]
    assert payload["data_context"]["injury_effect_in_model"] is False


def test_api_basics_and_live_sync_requires_key(tmp_path,monkeypatch):
    monkeypatch.setenv("DATABASE_URL",f"sqlite:///{tmp_path/'api.db'}")
    monkeypatch.delenv("API_FOOTBALL_KEY",raising=False)
    with TestClient(app) as client:
        assert client.get("/").status_code==200
        assert client.get("/health").json()["live_data_configured"] is False
        assert client.post("/sync/all").status_code==503
        assert client.post("/forecast",json={"home_xg":1.5,"away_xg":1.0}).status_code==200
        assert client.get("/data/coverage").json()["fixtures"]["count"]==0


def test_sync_all_records_partial_secondary_source_failures(tmp_path):
    class FakeClient:
        configured = True
        def fixtures(self, league, season, **kwargs): return [fixture(1,"2026-08-01T15:00:00Z")]
        def injuries(self, league, season, **kwargs): raise ProviderAPIError("injuries endpoint not covered by plan")
        def odds(self, league, season, **kwargs): raise ProviderAPIError("odds endpoint not covered by plan")
    from matchmind.sync import MatchMindSync
    service=MatchMindSync(store=MatchMindStore(tmp_path/"partial.db"),client=FakeClient())
    result=service.all(135,2026)
    assert result["status"]=="partial"
    assert len(result["syncs"])==1
    assert len(result["warnings"])==2
    assert result["syncs"][0]["stored_or_updated"]==1


def test_auto_sync_scheduler_is_opt_in_and_schedules_daily_job(monkeypatch):
    import matchmind.api as api_module
    monkeypatch.setenv("MATCHMIND_AUTO_SYNC","false")
    monkeypatch.setenv("API_FOOTBALL_KEY","")
    assert api_module._start_scheduler() is None

    created=[]
    class FakeScheduler:
        def __init__(self, **kwargs): self.kwargs=kwargs; self.jobs=[]; self.started=False
        def add_job(self, fn, trigger, **kwargs): self.jobs.append((trigger,kwargs))
        def start(self): self.started=True; created.append(self); return None
        def shutdown(self, **kwargs): pass
    monkeypatch.setattr(api_module,"BackgroundScheduler",FakeScheduler)
    monkeypatch.setenv("MATCHMIND_AUTO_SYNC","true")
    monkeypatch.setenv("API_FOOTBALL_KEY","dummy-not-used")
    monkeypatch.setenv("MATCHMIND_SYNC_ON_STARTUP","true")
    monkeypatch.setenv("MATCHMIND_SYNC_HOUR","4")
    monkeypatch.setenv("MATCHMIND_SYNC_MINUTE","20")
    scheduler=api_module._start_scheduler()
    assert scheduler is created[0]
    assert scheduler.started
    assert scheduler.kwargs["timezone"].key=="Europe/Rome"
    assert [j[0] for j in scheduler.jobs]==["cron","date"]