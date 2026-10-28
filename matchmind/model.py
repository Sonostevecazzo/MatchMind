"""Transparent football modelling primitives; Poisson is a baseline, not trained AI."""
from __future__ import annotations
import math
from dataclasses import dataclass
from typing import Iterable

@dataclass(frozen=True)
class MarketProbabilities:
    home_win: float
    draw: float
    away_win: float
    btts_yes: float
    btts_no: float
    over_15: float
    under_15: float
    over_25: float
    under_25: float
    over_35: float
    under_35: float
    expected_home_goals: float
    expected_away_goals: float

def _validate_lambda(value: float, name: str) -> float:
    value=float(value)
    if not math.isfinite(value) or value < 0 or value > 12:
        raise ValueError(f"{name} must be a finite number in [0, 12]")
    return value

def poisson_pmf(lam: float, goals: int) -> float:
    lam=_validate_lambda(lam,"lambda")
    if not isinstance(goals,int) or goals < 0:
        raise ValueError("goals must be a non-negative integer")
    if lam == 0:
        return 1.0 if goals == 0 else 0.0
    return math.exp(-lam + goals*math.log(lam)-math.lgamma(goals+1))

def score_matrix(home_xg: float, away_xg: float, max_goals: int=12) -> list[list[float]]:
    home_xg=_validate_lambda(home_xg,"home_xg")
    away_xg=_validate_lambda(away_xg,"away_xg")
    if not 4 <= max_goals <= 30:
        raise ValueError("max_goals must be in [4, 30]")
    hp=[poisson_pmf(home_xg,g) for g in range(max_goals+1)]
    ap=[poisson_pmf(away_xg,g) for g in range(max_goals+1)]
    matrix=[[h*a for a in ap] for h in hp]
    total=sum(sum(row) for row in matrix)
    return [[v/total for v in row] for row in matrix]

def forecast_markets(home_xg: float, away_xg: float, max_goals: int=12) -> MarketProbabilities:
    matrix=score_matrix(home_xg,away_xg,max_goals)
    home=draw=away=btts=over15=over25=over35=0.0
    for hg,row in enumerate(matrix):
        for ag,p in enumerate(row):
            if hg>ag: home+=p
            elif hg==ag: draw+=p
            else: away+=p
            if hg>0 and ag>0: btts+=p
            if hg+ag>=2: over15+=p
            if hg+ag>=3: over25+=p
            if hg+ag>=4: over35+=p
    return MarketProbabilities(
        home_win=home,draw=draw,away_win=away,btts_yes=btts,btts_no=1-btts,
        over_15=over15,under_15=1-over15,over_25=over25,under_25=1-over25,
        over_35=over35,under_35=1-over35,
        expected_home_goals=_validate_lambda(home_xg,"home_xg"),
        expected_away_goals=_validate_lambda(away_xg,"away_xg"))

def market_dict(probabilities: MarketProbabilities) -> dict[str,float]:
    return {k:round(v,6) for k,v in probabilities.__dict__.items()}

def implied_probabilities(odds: Iterable[float]) -> list[float]:
    values=[float(x) for x in odds]
    if not values: raise ValueError("at least one price is required")
    if any(not math.isfinite(x) or x<=1.0 for x in values):
        raise ValueError("decimal odds must be finite and greater than 1")
    return [1.0/x for x in values]

def overround(odds: Iterable[float]) -> float:
    return sum(implied_probabilities(odds))-1.0

def devig_proportional(odds: Iterable[float]) -> list[float]:
    raw=implied_probabilities(odds)
    total=sum(raw)
    return [p/total for p in raw]

def expected_value(probability: float, decimal_odds: float) -> float:
    p=float(probability); o=float(decimal_odds)
    if not math.isfinite(p) or not 0<=p<=1: raise ValueError("probability must be in [0, 1]")
    if not math.isfinite(o) or o<=1: raise ValueError("decimal_odds must be > 1")
    return p*o-1.0

def odds_divergence(model_probability: float, market_probability: float) -> float:
    for label,value in (("model_probability",model_probability),("market_probability",market_probability)):
        if not math.isfinite(value) or not 0<=value<=1: raise ValueError(f"{label} must be in [0, 1]")
    return model_probability-market_probability
