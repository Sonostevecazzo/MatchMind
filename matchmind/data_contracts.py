"""Provider-independent contracts; data adapters must preserve source lineage."""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

@dataclass(frozen=True)
class MatchRecord:
    match_id: str
    date_utc: datetime
    competition: str
    season: str
    home_team: str
    away_team: str
    home_goals: Optional[int]
    away_goals: Optional[int]
    source: str
    source_url: str
    retrieved_at: datetime
    licence_note: str

@dataclass(frozen=True)
class PlayerAvailability:
    player_id: str
    player_name: str
    team_id: str
    status: str
    reason: Optional[str]
    expected_return: Optional[datetime]
    source: str
    source_url: str
    retrieved_at: datetime
    confidence: str

@dataclass(frozen=True)
class OddsRecord:
    match_id: str
    market: str
    selection: str
    bookmaker: str
    decimal_odds: float
    observed_at: datetime
    source: str
    source_url: str
    licence_note: str
