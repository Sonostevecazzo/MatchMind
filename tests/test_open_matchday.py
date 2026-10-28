from __future__ import annotations

import httpx
from fastapi.testclient import TestClient

from matchmind.providers.open_matchday import OpenMatchdayClient
from matchmind.storage import MatchMindStore
from matchmind.api import app


def test_open_matchday_csv_imports_results_and_fixtures_without_key():
    def handler(request):
        if "results_2627.csv" in str(request.url):
            return httpx.Response(200, text="date,time,home,away,ft_home,ft_away,ht_home,ht_away,home_shots,away_shots\n2026-08-15,18:00,Team A,Team B,2,1,1,0,12,8\n")
        if "fixtures_2627.csv" in str(request.url):
            return httpx.Response(200, text="gw,date,time,home,away\n2,2026-08-22,15:00,Team C,Team D\n")
        return httpx.Response(404)

    http = httpx.Client(transport=httpx.MockTransport(handler))
    with OpenMatchdayClient(http_client=http) as client:
        records = client.fixtures("ITA_1_serie-a", 2026)
    http.close()
    assert len(records) == 2
    finished = next(row for row in records if row["teams"]["home"]["name"] == "Team A")
    upcoming = next(row for row in records if row["teams"]["home"]["name"] == "Team C")
    assert finished["goals"] == {"home": 2, "away": 1}
    assert finished["fixture"]["status"]["short"] == "FT"
    assert finished["_source"] == "open-matchday"
    assert finished["_statistics"]["home_shots"] == "12"
    assert upcoming["goals"] == {"home": None, "away": None}
    assert upcoming["fixture"]["status"]["short"] == "NS"


def test_open_matchday_records_store_with_correct_source(tmp_path):
    store = MatchMindStore(tmp_path / "public.csv.db")
    record = {
        "fixture": {"id": 123, "date": "2026-08-15T17:00:00+00:00", "status": {"short": "FT"}},
        "league": {"id": 456, "name": "ITA_1_serie-a", "season": 2026},
        "teams": {"home": {"id": 11, "name": "Team A"}, "away": {"id": 12, "name": "Team B"}},
        "goals": {"home": 2, "away": 1},
        "_source": "open-matchday",
        "_source_url": "https://github.com/oladeeayo/open-matchday",
    }
    assert store.upsert_fixtures([record]) == 1
    row = store.get_fixture(123)
    assert row["source"] == "open-matchday"
    assert row["source_url"] == "https://github.com/oladeeayo/open-matchday"


def test_open_matchday_sync_endpoint_needs_no_api_key(monkeypatch, tmp_path):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path/'endpoint.db'}")
    monkeypatch.delenv("API_FOOTBALL_KEY", raising=False)

    def handler(request):
        if "results_2627.csv" in str(request.url):
            return httpx.Response(200, text="date,time,home,away,ft_home,ft_away\n2026-08-15,18:00,Team A,Team B,2,1\n")
        if "fixtures_2627.csv" in str(request.url):
            return httpx.Response(200, text="gw,date,time,home,away\n")
        return httpx.Response(404)

    import matchmind.api as api_module
    from matchmind.providers import open_matchday
    original = open_matchday.OpenMatchdayClient

    class FakeClient:
        def __init__(self): self.client = original(http_client=httpx.Client(transport=httpx.MockTransport(handler)))
        def __enter__(self): return self
        def __exit__(self, *_): self.client.close()
        def fixtures(self, **kwargs): return self.client.fixtures(**kwargs)

    monkeypatch.setattr(api_module, "OpenMatchdayClient", FakeClient)
    with TestClient(app) as client:
        response = client.post("/sync/open-matchday?league_slug=ITA_1_serie-a&season=2026")
    assert response.status_code == 200, response.text
    assert response.json()["api_key_required"] is False
    assert response.json()["completed_results"] == 1
