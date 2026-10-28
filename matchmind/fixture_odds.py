"""Analyse complete, comparable bookmaker markets against model probabilities.

Only 1X2, BTTS and paired over/under totals are recognised. Incomplete or
ambiguous groups are ignored rather than presented as meaningful margins.
"""
from __future__ import annotations

import re
from collections import defaultdict
from typing import Any, Mapping, Sequence

from .analysis import compare_market

_NUMBER = re.compile(r"(?<!\d)(\d+(?:[.,]\d+)?)(?!\d)")


def _number(text: str) -> float | None:
    match = _NUMBER.search(text)
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", "."))
    except ValueError:
        return None


def _category(market: str) -> str | None:
    value = market.casefold().replace("–", "-")
    if any(token in value for token in ("match winner", "1x2", "fulltime result", "full time result", "match result")):
        return "1x2"
    if any(token in value for token in ("both teams score", "both teams to score", "btts")):
        return "btts"
    if any(token in value for token in ("over/under", "over under", "total goals", "goals over", "goals total")):
        return "totals"
    return None


def _selection_kind(category: str, selection: str) -> tuple[str, float | None] | None:
    value = selection.casefold().strip()
    compact = re.sub(r"\s+", " ", value)
    if category == "1x2":
        if compact in {"home", "1", "home win", "team 1", "local", "casa"}:
            return "home_win", None
        if compact in {"draw", "x", "tie", "equal"}:
            return "draw", None
        if compact in {"away", "2", "away win", "team 2", "trasferta"}:
            return "away_win", None
        return None
    if category == "btts":
        if compact in {"yes", "y", "gol", "btts yes", "both teams score - yes"}:
            return "btts_yes", None
        if compact in {"no", "n", "no gol", "btts no", "both teams score - no"}:
            return "btts_no", None
        return None
    if category == "totals":
        direction = "over" if compact.startswith("over") else "under" if compact.startswith("under") else None
        if direction is None:
            return None
        line = _number(compact)
        if line is None:
            return None
        return f"{direction}_{str(line).replace('.', '').replace(',', '')}", line
    return None


def analyse_fixture_odds(
    odds_rows: Sequence[Mapping[str, Any]], model_markets: Mapping[str, float], *, limit: int = 30
) -> list[dict[str, Any]]:
    """Return only complete, comparable 1X2, BTTS and Over/Under snapshots.

    Overround is calculated only when all selections in a recognized market
    are present at the same bookmaker and observation timestamp. Model EV and
    divergence are attached only when this baseline exposes that exact line.
    """
    grouped: dict[tuple[Any, ...], list[Mapping[str, Any]]] = defaultdict(list)
    for row in odds_rows:
        market = str(row.get("market") or "")
        category = _category(market)
        if category is None:
            continue
        selection = str(row.get("selection") or "")
        parsed = _selection_kind(category, selection)
        if parsed is None:
            continue
        selection_key, line = parsed
        group_line = line if category == "totals" else None
        key = (row.get("bookmaker_id"), row.get("market_id"), row.get("bookmaker"), market,
               row.get("observed_at"), category, group_line)
        # Retain the derived selection identity next to the source row.
        grouped[key].append({**dict(row), "_selection_key": selection_key, "_line": line})

    output: list[dict[str, Any]] = []
    expected: dict[str, set[str]] = {
        "1x2": {"home_win", "draw", "away_win"},
        "btts": {"btts_yes", "btts_no"},
    }
    for key, rows in grouped.items():
        bookmaker_id, market_id, bookmaker, market, observed_at, category, line = key
        parsed_keys = [str(r["_selection_key"]) for r in rows]
        if len(parsed_keys) != len(set(parsed_keys)):
            continue
        if category in expected:
            if set(parsed_keys) != expected[category]:
                continue
        elif category == "totals":
            if len(rows) != 2 or {k.split("_", 1)[0] for k in parsed_keys} != {"over", "under"}:
                continue
            if line is None or len({r.get("_line") for r in rows}) != 1:
                continue
        else:
            continue

        rows.sort(key=lambda r: (0 if r["_selection_key"] in ("home_win", "btts_yes") or str(r["_selection_key"]).startswith("over_") else 1))
        selections = [str(row.get("selection") or "") for row in rows]
        prices = [float(row["decimal_odds"]) for row in rows]
        probability_keys = [str(row["_selection_key"]) for row in rows]
        probabilities = [model_markets.get(name) for name in probability_keys]
        if any(p is None for p in probabilities):
            probabilities = None
        try:
            metrics = compare_market(selections, prices, probabilities)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
        output.append({
            "bookmaker_id": bookmaker_id,
            "bookmaker": bookmaker or "Unknown bookmaker",
            "market_id": market_id,
            "market": market,
            "category": category,
            "line": line,
            "observed_at": observed_at,
            **metrics,
        })

    output.sort(key=lambda item: str(item.get("observed_at") or ""), reverse=True)
    return output[:max(1, min(int(limit), 100))]