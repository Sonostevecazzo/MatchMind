"""Small SQLite store for source-attributed football data and sync audit logs."""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

SOURCE_NAME = "API-Football"
SOURCE_FIXTURES = "https://www.api-football.com/documentation-v3#tag/Fixtures"
SOURCE_INJURIES = "https://www.api-football.com/documentation-v3#tag/Injuries"
SOURCE_ODDS = "https://www.api-football.com/documentation-v3#tag/Odds"


def _safe_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if result == result else None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(value: Any, *, fallback: datetime | None = None) -> str | None:
    if value is None or value == "":
        return fallback.astimezone(timezone.utc).isoformat() if fallback else None
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return fallback.astimezone(timezone.utc).isoformat() if fallback else None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


def database_path_from_env() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./data/matchmind.db").strip()
    if url.startswith("sqlite:///"):
        return url[len("sqlite:///"):]
    if url == ":memory:":
        return url
    raise ValueError("This build supports SQLite DATABASE_URL values only (for example sqlite:///./data/matchmind.db).")


class MatchMindStore:
    def __init__(self, database_path: str | Path | None = None) -> None:
        self.database_path = str(database_path or database_path_from_env())
        if self.database_path != ":memory:":
            Path(self.database_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.database_path, timeout=20)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        return db

    def _initialize(self) -> None:
        with self._connect() as db:
            db.executescript(
                """
                CREATE TABLE IF NOT EXISTS fixtures (
                    fixture_id INTEGER PRIMARY KEY,
                    kickoff_utc TEXT NOT NULL,
                    league_id INTEGER NOT NULL,
                    league_name TEXT NOT NULL,
                    season INTEGER NOT NULL,
                    home_team_id INTEGER,
                    home_team TEXT NOT NULL,
                    away_team_id INTEGER,
                    away_team TEXT NOT NULL,
                    status_short TEXT NOT NULL,
                    home_goals INTEGER,
                    away_goals INTEGER,
                    source TEXT NOT NULL,
                    source_url TEXT NOT NULL,
                    retrieved_at TEXT NOT NULL,
                    raw_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_fixtures_league_kickoff ON fixtures(league_id, kickoff_utc);
                CREATE INDEX IF NOT EXISTS idx_fixtures_season ON fixtures(league_id, season);
                CREATE TABLE IF NOT EXISTS injuries (
                    record_key TEXT PRIMARY KEY,
                    fixture_id INTEGER NOT NULL,
                    league_id INTEGER,
                    season INTEGER,
                    team_id INTEGER,
                    team_name TEXT,
                    player_id INTEGER,
                    player_name TEXT NOT NULL,
                    player_type TEXT,
                    status TEXT NOT NULL,
                    reason TEXT,
                    report_date TEXT,
                    source TEXT NOT NULL,
                    source_url TEXT NOT NULL,
                    retrieved_at TEXT NOT NULL,
                    raw_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_injuries_fixture ON injuries(fixture_id);
                CREATE TABLE IF NOT EXISTS player_statistics (
                    record_key TEXT PRIMARY KEY,
                    player_id INTEGER,
                    player_name TEXT NOT NULL,
                    team_id INTEGER,
                    team_name TEXT,
                    league_id INTEGER,
                    league_name TEXT,
                    season INTEGER,
                    appearances INTEGER,
                    starts INTEGER,
                    minutes INTEGER,
                    rating REAL,
                    goals INTEGER,
                    assists INTEGER,
                    yellow_cards INTEGER,
                    red_cards INTEGER,
                    source TEXT NOT NULL,
                    source_url TEXT NOT NULL,
                    retrieved_at TEXT NOT NULL,
                    raw_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_players_team_season ON player_statistics(team_id, season);
                CREATE TABLE IF NOT EXISTS odds_snapshots (
                    snapshot_id TEXT PRIMARY KEY,
                    fixture_id INTEGER NOT NULL,
                    league_id INTEGER,
                    season INTEGER,
                    bookmaker_id INTEGER,
                    bookmaker TEXT NOT NULL,
                    market_id INTEGER,
                    market TEXT NOT NULL,
                    selection TEXT NOT NULL,
                    decimal_odds REAL NOT NULL,
                    observed_at TEXT NOT NULL,
                    source TEXT NOT NULL,
                    source_url TEXT NOT NULL,
                    retrieved_at TEXT NOT NULL,
                    raw_json TEXT NOT NULL,
                    CHECK(decimal_odds > 1.0)
                );
                CREATE INDEX IF NOT EXISTS idx_odds_fixture ON odds_snapshots(fixture_id, observed_at);
                CREATE TABLE IF NOT EXISTS sync_runs (
                    sync_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data_type TEXT NOT NULL,
                    league_id INTEGER NOT NULL,
                    season INTEGER NOT NULL,
                    started_at TEXT NOT NULL,
                    finished_at TEXT,
                    status TEXT NOT NULL,
                    records_count INTEGER NOT NULL DEFAULT 0,
                    error_message TEXT,
                    source TEXT NOT NULL
                );
                """
            )

    def start_sync(self, data_type: str, league_id: int, season: int) -> int:
        with self._connect() as db:
            cursor = db.execute(
                "INSERT INTO sync_runs(data_type,league_id,season,started_at,status,source) VALUES(?,?,?,?,?,?)",
                (data_type, int(league_id), int(season), utc_now().isoformat(), "running", SOURCE_NAME),
            )
            return int(cursor.lastrowid)

    def finish_sync(self, sync_id: int, *, status: str, records_count: int = 0, error_message: str | None = None) -> None:
        with self._connect() as db:
            db.execute(
                "UPDATE sync_runs SET finished_at=?,status=?,records_count=?,error_message=? WHERE sync_id=?",
                (utc_now().isoformat(), status, int(records_count), (error_message or "")[:500] or None, int(sync_id)),
            )

    @staticmethod
    def _nested(row: dict[str, Any], *keys: str) -> Any:
        value: Any = row
        for key in keys:
            if not isinstance(value, dict):
                return None
            value = value.get(key)
        return value

    def upsert_fixtures(self, records: Iterable[dict[str, Any]]) -> int:
        count = 0
        now = utc_now().isoformat()
        with self._connect() as db:
            for item in records:
                fixture = item.get("fixture") or {}
                league = item.get("league") or {}
                teams = item.get("teams") or {}
                home = teams.get("home") or {}
                away = teams.get("away") or {}
                goals = item.get("goals") or {}
                if fixture.get("id") is None or not fixture.get("date") or not home.get("name") or not away.get("name"):
                    continue
                kickoff = iso_utc(fixture.get("date"))
                if not kickoff:
                    continue
                try:
                    fixture_id = int(fixture["id"])
                    league_id = int(league["id"])
                    season = int(league["season"])
                except (KeyError, TypeError, ValueError):
                    continue
                payload = (
                    fixture_id, kickoff, league_id, str(league.get("name") or league_id), season,
                    home.get("id"), str(home["name"]), away.get("id"), str(away["name"]),
                    str(self._nested(item, "fixture", "status", "short") or "UNK"),
                    goals.get("home"), goals.get("away"), SOURCE_NAME, SOURCE_FIXTURES, now,
                    json.dumps(item, ensure_ascii=False, separators=(",", ":")),
                )
                db.execute(
                    """INSERT INTO fixtures VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    ON CONFLICT(fixture_id) DO UPDATE SET
                    kickoff_utc=excluded.kickoff_utc,league_id=excluded.league_id,league_name=excluded.league_name,
                    season=excluded.season,home_team_id=excluded.home_team_id,home_team=excluded.home_team,
                    away_team_id=excluded.away_team_id,away_team=excluded.away_team,status_short=excluded.status_short,
                    home_goals=excluded.home_goals,away_goals=excluded.away_goals,source=excluded.source,
                    source_url=excluded.source_url,retrieved_at=excluded.retrieved_at,raw_json=excluded.raw_json""",
                    payload,
                )
                count += 1
        return count

    def upsert_injuries(self, records: Iterable[dict[str, Any]]) -> int:
        count = 0
        now = utc_now().isoformat()
        with self._connect() as db:
            for item in records:
                fixture = item.get("fixture") or {}
                league = item.get("league") or {}
                team = item.get("team") or {}
                player = item.get("player") or {}
                if fixture.get("id") is None or player.get("name") is None:
                    continue
                record_bits = [fixture.get("id"), player.get("id"), team.get("id"), player.get("name"), player.get("type"), player.get("reason"), player.get("date"), player.get("status")]
                record_key = hashlib.sha256(json.dumps(record_bits, ensure_ascii=False).encode()).hexdigest()
                payload = (
                    record_key, int(fixture["id"]), league.get("id"), league.get("season"), team.get("id"), team.get("name"),
                    player.get("id"), str(player["name"]), player.get("type"), str(player.get("status") or "unknown"),
                    player.get("reason"), iso_utc(player.get("date")), SOURCE_NAME, SOURCE_INJURIES, now,
                    json.dumps(item, ensure_ascii=False, separators=(",", ":")),
                )
                db.execute(
                    """INSERT INTO injuries VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    ON CONFLICT(record_key) DO UPDATE SET status=excluded.status,reason=excluded.reason,
                    report_date=excluded.report_date,retrieved_at=excluded.retrieved_at,raw_json=excluded.raw_json""",
                    payload,
                )
                count += 1
        return count

    def upsert_odds(self, records: Iterable[dict[str, Any]]) -> int:
        count = 0
        now_dt = utc_now()
        now = now_dt.isoformat()
        with self._connect() as db:
            for item in records:
                fixture = item.get("fixture") or {}
                league = item.get("league") or {}
                if fixture.get("id") is None:
                    continue
                observed_at = iso_utc(item.get("update"), fallback=now_dt) or now
                for bookmaker in item.get("bookmakers") or []:
                    for bet in bookmaker.get("bets") or []:
                        for selection in bet.get("values") or []:
                            try:
                                decimal_odds = float(selection.get("odd"))
                                if decimal_odds <= 1.0 or decimal_odds != decimal_odds:
                                    continue
                            except (TypeError, ValueError):
                                continue
                            row_bits = [fixture.get("id"), bookmaker.get("id"), bet.get("id"), selection.get("value"), decimal_odds, observed_at]
                            snapshot_id = hashlib.sha256(json.dumps(row_bits, ensure_ascii=False).encode()).hexdigest()
                            payload = (
                                snapshot_id, int(fixture["id"]), league.get("id"), league.get("season"), bookmaker.get("id"),
                                str(bookmaker.get("name") or "Unknown bookmaker"), bet.get("id"),
                                str(bet.get("name") or "Unknown market"), str(selection.get("value") or "Unknown selection"),
                                decimal_odds, observed_at, SOURCE_NAME, SOURCE_ODDS, now,
                                json.dumps({"fixture": fixture, "league": league, "bookmaker": bookmaker.get("name"), "bet": bet, "selection": selection}, ensure_ascii=False, separators=(",", ":")),
                            )
                            cursor = db.execute(
                                """INSERT OR IGNORE INTO odds_snapshots VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", payload
                            )
                            count += int(cursor.rowcount > 0)
        return count

    def upsert_player_statistics(self, records: Iterable[dict[str, Any]]) -> int:
        count = 0
        now = utc_now().isoformat()
        with self._connect() as db:
            for item in records:
                player = item.get("player") or {}
                for stat in item.get("statistics") or []:
                    team = stat.get("team") or {}
                    league = stat.get("league") or {}
                    games = stat.get("games") or {}
                    goals = stat.get("goals") or {}
                    cards = stat.get("cards") or {}
                    if player.get("id") is None or not player.get("name"):
                        continue
                    try:
                        league_id = int(league.get("id"))
                        season = int(league.get("season"))
                    except (TypeError, ValueError):
                        continue
                    row_bits = [player.get("id"), team.get("id"), league_id, season]
                    record_key = hashlib.sha256(json.dumps(row_bits).encode()).hexdigest()
                    payload = (
                        record_key, player.get("id"), str(player["name"]), team.get("id"), team.get("name"),
                        league_id, league.get("name"), season, games.get("appearences", games.get("appearances")),
                        games.get("lineups"), games.get("minutes"), _safe_float(games.get("rating")),
                        goals.get("total"), goals.get("assists"), cards.get("yellow"), cards.get("red"),
                        SOURCE_NAME, "https://www.api-football.com/documentation-v3#tag/Players", now,
                        json.dumps(item, ensure_ascii=False, separators=(",", ":")),
                    )
                    db.execute(
                        """INSERT INTO player_statistics VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                        ON CONFLICT(record_key) DO UPDATE SET player_name=excluded.player_name,team_name=excluded.team_name,
                        league_name=excluded.league_name,appearances=excluded.appearances,starts=excluded.starts,
                        minutes=excluded.minutes,rating=excluded.rating,goals=excluded.goals,assists=excluded.assists,
                        yellow_cards=excluded.yellow_cards,red_cards=excluded.red_cards,retrieved_at=excluded.retrieved_at,
                        raw_json=excluded.raw_json""", payload,
                    )
                    count += 1
        return count

    def player_statistics_for_team(self, team_id: int, season: int | None = None, *, limit: int = 100) -> list[dict[str, Any]]:
        conditions = ["team_id=?"]
        args: list[Any] = [int(team_id)]
        if season is not None:
            conditions.append("season=?")
            args.append(int(season))
        args.append(max(1, min(int(limit), 500)))
        with self._connect() as db:
            rows = db.execute(
                "SELECT player_id,player_name,team_id,team_name,league_id,league_name,season,appearances,starts,minutes,rating,goals,assists,yellow_cards,red_cards,source,source_url,retrieved_at FROM player_statistics WHERE " + " AND ".join(conditions) + " ORDER BY minutes DESC LIMIT ?",
                args,
            ).fetchall()
        return [dict(r) for r in rows]

    def get_fixture(self, fixture_id: int) -> dict[str, Any] | None:
        with self._connect() as db:
            row = db.execute("SELECT * FROM fixtures WHERE fixture_id=?", (int(fixture_id),)).fetchone()
        return dict(row) if row else None

    def list_fixtures(self, *, league_id: int | None = None, season: int | None = None, limit: int = 100) -> list[dict[str, Any]]:
        limit = max(1, min(int(limit), 500))
        conditions: list[str] = []
        args: list[Any] = []
        if league_id is not None:
            conditions.append("league_id=?"); args.append(int(league_id))
        if season is not None:
            conditions.append("season=?"); args.append(int(season))
        clause = " WHERE " + " AND ".join(conditions) if conditions else ""
        with self._connect() as db:
            rows = db.execute(f"SELECT fixture_id,kickoff_utc,league_id,league_name,season,home_team_id,home_team,away_team_id,away_team,status_short,home_goals,away_goals,source,source_url,retrieved_at FROM fixtures{clause} ORDER BY kickoff_utc DESC LIMIT ?", [*args, limit]).fetchall()
        return [dict(r) for r in rows]

    def completed_fixtures_before(self, league_id: int, kickoff_utc: str, *, limit: int = 5000) -> list[dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute(
                """SELECT fixture_id,kickoff_utc,league_id,league_name,season,home_team_id,home_team,away_team_id,away_team,
                status_short,home_goals,away_goals,source,source_url,retrieved_at FROM fixtures
                WHERE league_id=? AND kickoff_utc<? AND status_short IN ('FT','AET','PEN')
                AND home_goals IS NOT NULL AND away_goals IS NOT NULL
                ORDER BY kickoff_utc DESC LIMIT ?""",
                (int(league_id), kickoff_utc, max(1, min(int(limit), 10000))),
            ).fetchall()
        return [dict(r) for r in rows]

    def injuries_for_fixture(self, fixture_id: int) -> list[dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute(
                "SELECT fixture_id,team_name,player_id,player_name,player_type,status,reason,report_date,source,source_url,retrieved_at FROM injuries WHERE fixture_id=? ORDER BY team_name,player_name",
                (int(fixture_id),),
            ).fetchall()
        return [dict(r) for r in rows]

    def odds_for_fixture(self, fixture_id: int, *, limit: int = 1000) -> list[dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute(
                "SELECT fixture_id,bookmaker_id,bookmaker,market_id,market,selection,decimal_odds,observed_at,source,source_url,retrieved_at FROM odds_snapshots WHERE fixture_id=? ORDER BY observed_at DESC LIMIT ?",
                (int(fixture_id), max(1, min(int(limit), 5000))),
            ).fetchall()
        return [dict(r) for r in rows]

    def coverage(self) -> dict[str, Any]:
        with self._connect() as db:
            fixtures = db.execute("SELECT COUNT(*) AS c,MAX(retrieved_at) AS latest FROM fixtures").fetchone()
            injuries = db.execute("SELECT COUNT(*) AS c,MAX(retrieved_at) AS latest FROM injuries").fetchone()
            odds = db.execute("SELECT COUNT(*) AS c,MAX(retrieved_at) AS latest FROM odds_snapshots").fetchone()
            players = db.execute("SELECT COUNT(*) AS c,MAX(retrieved_at) AS latest FROM player_statistics").fetchone()
            recent_runs = db.execute("SELECT sync_id,data_type,league_id,season,started_at,finished_at,status,records_count,error_message FROM sync_runs ORDER BY sync_id DESC LIMIT 20").fetchall()
        return {
            "fixtures": {"count": fixtures["c"], "last_retrieved_at": fixtures["latest"]},
            "injuries": {"count": injuries["c"], "last_retrieved_at": injuries["latest"]},
            "odds_snapshots": {"count": odds["c"], "last_retrieved_at": odds["latest"]},
            "player_statistics": {"count": players["c"], "last_retrieved_at": players["latest"]},
            "recent_sync_runs": [dict(r) for r in recent_runs],
        }