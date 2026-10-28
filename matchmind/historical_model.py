"""Transparent historical-score baseline; deliberately not labelled as AI."""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Sequence


class InsufficientHistoricalData(ValueError):
    pass


def estimate_expected_goals(
    history: Sequence[dict[str, Any]], *, home_team_id: int | None, away_team_id: int | None,
    kickoff_utc: str, min_league_matches: int = 20, min_team_matches: int = 3,
) -> dict[str, Any]:
    """Estimate match xG from previous completed scores with exponential time decay.

    Home/away venue averages provide the league baseline; team attack and defensive
    concession rates are smoothed toward league averages. Only the caller's
    pre-kickoff history may be passed to this function.
    """
    if home_team_id is None or away_team_id is None:
        raise InsufficientHistoricalData("Stable team IDs are required for a historical forecast.")
    parsed_target = datetime.fromisoformat(kickoff_utc.replace("Z", "+00:00"))
    if parsed_target.tzinfo is None:
        parsed_target = parsed_target.replace(tzinfo=timezone.utc)

    completed: list[tuple[dict[str, Any], float]] = []
    for match in history:
        try:
            when = datetime.fromisoformat(str(match["kickoff_utc"]).replace("Z", "+00:00"))
            if when.tzinfo is None:
                when = when.replace(tzinfo=timezone.utc)
            hg, ag = int(match["home_goals"]), int(match["away_goals"])
        except (KeyError, TypeError, ValueError):
            continue
        if when >= parsed_target or hg < 0 or ag < 0:
            continue
        age_days = max(0.0, (parsed_target - when).total_seconds() / 86400.0)
        weight = math.exp(-age_days / 540.0)
        completed.append((match, weight))
    if len(completed) < min_league_matches:
        raise InsufficientHistoricalData(
            f"Only {len(completed)} eligible completed matches are available; at least {min_league_matches} are required."
        )

    total_weight = sum(weight for _, weight in completed)
    home_goals = sum(int(m["home_goals"]) * w for m, w in completed) / total_weight
    away_goals = sum(int(m["away_goals"]) * w for m, w in completed) / total_weight
    if home_goals <= 0 or away_goals <= 0:
        raise InsufficientHistoricalData("The historical sample has an invalid zero-goal league baseline.")

    # For each team, aggregate goals for/against across home and away appearances.
    stats: dict[int, dict[str, float]] = defaultdict(lambda: {"for": 0.0, "against": 0.0, "matches": 0.0, "raw_matches": 0.0})
    for match, weight in completed:
        try:
            h_id, a_id = int(match["home_team_id"]), int(match["away_team_id"])
            hg, ag = int(match["home_goals"]), int(match["away_goals"])
        except (KeyError, TypeError, ValueError):
            continue
        stats[h_id]["for"] += hg * weight
        stats[h_id]["against"] += ag * weight
        stats[h_id]["matches"] += weight
        stats[h_id]["raw_matches"] += 1
        stats[a_id]["for"] += ag * weight
        stats[a_id]["against"] += hg * weight
        stats[a_id]["matches"] += weight
        stats[a_id]["raw_matches"] += 1
    league_per_team_match = (home_goals + away_goals) / 2.0
    shrinkage = 5.0

    def strengths(team_id: int) -> tuple[float, float, int]:
        row = stats.get(int(team_id))
        if not row or row["raw_matches"] < min_team_matches:
            raise InsufficientHistoricalData(
                f"Team ID {team_id} has fewer than {min_team_matches} eligible historical appearances."
            )
        matches = row["matches"]
        avg_for = (row["for"] + shrinkage * league_per_team_match) / (matches + shrinkage)
        avg_against = (row["against"] + shrinkage * league_per_team_match) / (matches + shrinkage)
        return avg_for / league_per_team_match, avg_against / league_per_team_match, int(row["raw_matches"])

    home_attack, home_defence, home_n = strengths(int(home_team_id))
    away_attack, away_defence, away_n = strengths(int(away_team_id))
    home_xg = min(6.0, max(0.05, home_goals * home_attack * away_defence))
    away_xg = min(6.0, max(0.05, away_goals * away_attack * home_defence))
    return {
        "home_xg": round(home_xg, 4), "away_xg": round(away_xg, 4),
        "method": "time-decayed weighted Poisson baseline from completed historical scores",
        "league_matches_used": len(completed), "team_history": {"home_team_matches": home_n, "away_team_matches": away_n},
        "time_decay_half_life_days": round(540.0 * math.log(2), 1), "shrinkage_matches": shrinkage,
        "disclaimer": "Baseline estimated from historical final scores; not a trained AI model and not evidence of profitable betting.",
    }