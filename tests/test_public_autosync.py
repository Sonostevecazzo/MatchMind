from __future__ import annotations

from matchmind.storage import MatchMindStore
import matchmind.sync as sync_module
import matchmind.api as api_module


def _fixture():
    return {
        "fixture": {"id": 123, "date": "2026-08-15T17:00:00+00:00", "status": {"short": "FT"}},
        "league": {"id": 456, "name": "ITA_1_serie-a", "season": 2026},
        "teams": {
            "home": {"id": 11, "name": "Inter"},
            "away": {"id": 12, "name": "Roma"},
        },
        "goals": {"home": 2, "away": 1},
        "_source": "open-matchday",
        "_source_url": "https://github.com/oladeeayo/open-matchday",
    }


def test_public_csv_sync_persists_data_without_api_key(monkeypatch, tmp_path):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path/'matchmind.db'}")
    monkeypatch.delenv("API_FOOTBALL_KEY", raising=False)
    monkeypatch.setenv("MATCHMIND_PUBLIC_LEAGUES", "ITA_1_serie-a")
    monkeypatch.setenv("MATCHMIND_PUBLIC_SEASON", "2026")

    class FakeClient:
        def __enter__(self): return self
        def __exit__(self, *_): return None
        def fixtures(self, league_slug, season):
            assert league_slug == "ITA_1_serie-a"
            assert season == 2026
            return [_fixture()]

    monkeypatch.setattr(sync_module, "OpenMatchdayClient", FakeClient)
    result = sync_module.run_public_csv_sync()
    assert result["status"] == "success"
    assert result["api_key_required"] is False
    assert result["competitions"][0]["completed_results"] == 1
    assert MatchMindStore(tmp_path / "matchmind.db").get_fixture(123)["source"] == "open-matchday"


def test_public_sync_scheduler_does_not_need_api_key(monkeypatch):
    monkeypatch.delenv("API_FOOTBALL_KEY", raising=False)
    monkeypatch.setenv("MATCHMIND_AUTO_SYNC", "false")
    monkeypatch.setenv("MATCHMIND_PUBLIC_AUTO_SYNC", "true")
    monkeypatch.setenv("MATCHMIND_PUBLIC_SYNC_ON_STARTUP", "true")
    jobs = []

    class FakeScheduler:
        def __init__(self, **kwargs):
            self.kwargs = kwargs
        def add_job(self, fn, trigger, **kwargs):
            jobs.append((fn.__name__, trigger, kwargs))
        def start(self): pass
        def shutdown(self, **kwargs): pass

    monkeypatch.setattr(api_module, "BackgroundScheduler", FakeScheduler)
    scheduler = api_module._start_scheduler()
    assert scheduler is not None
    assert any(fn == "run_public_csv_sync" and trigger == "cron" for fn, trigger, _ in jobs)
    assert any(fn == "run_public_csv_sync" and trigger == "date" for fn, trigger, _ in jobs)
    assert not any(fn == "run_scheduled_sync" for fn, _, _ in jobs)
