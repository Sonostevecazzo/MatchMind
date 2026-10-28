"""Bookmaker price comparison and transparent anomaly flags."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Sequence
from .model import devig_proportional, odds_divergence, overround

@dataclass(frozen=True)
class OddsSnapshot:
    bookmaker: str
    market: str
    selection: str
    decimal_odds: float
    observed_at: datetime
    source: str

def compare_market(selections: Sequence[str], odds: Sequence[float],
                   model_probabilities: Sequence[float] | None=None) -> dict:
    if len(selections)!=len(odds): raise ValueError("selections and odds must have equal length")
    if model_probabilities is not None and len(model_probabilities)!=len(odds):
        raise ValueError("model_probabilities and odds must have equal length")
    raw=[1.0/float(o) for o in odds]
    clean=devig_proportional(odds)
    margin=overround(odds)
    rows=[]
    for i,name in enumerate(selections):
        row={"selection":name,"decimal_odds":float(odds[i]),
             "raw_implied_probability":raw[i],"devigged_market_probability":clean[i]}
        if model_probabilities is not None:
            p=float(model_probabilities[i])
            row["model_probability"]=p
            row["model_minus_market"]=odds_divergence(p,clean[i])
            row["theoretical_ev_per_unit"]=p*float(odds[i])-1
        rows.append(row)
    flags=[]
    if margin>=0.08:
        flags.append({"code":"high_market_margin","severity":"review","detail":"Overround at least 8%; compare equivalent markets."})
    elif margin<0:
        flags.append({"code":"negative_overround","severity":"info","detail":"Apparent arbitrage only if selections, rules and timestamps are comparable."})
    if model_probabilities is not None and any(abs(r["model_minus_market"])>=0.08 for r in rows):
        flags.append({"code":"model_market_divergence","severity":"review","detail":"At least one outcome differs by 8 percentage points; inspect model uncertainty and data freshness."})
    return {"overround":margin,"theoretical_payout_ratio":1/(1+margin) if margin>-1 else None,
            "method":"proportional de-vig; compare alternative methods before conclusions",
            "selections":rows,"flags":flags,
            "interpretation":"Flags indicate observable price characteristics, not evidence of intentional manipulation."}

def utc_now() -> datetime:
    return datetime.now(timezone.utc)
