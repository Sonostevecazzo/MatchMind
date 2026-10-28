"""Evaluation metrics for historical, chronologically held-out forecasts."""
from __future__ import annotations
import math
from collections import defaultdict
from typing import Sequence

def multiclass_brier(probabilities: Sequence[Sequence[float]], outcomes: Sequence[int]) -> float:
    if len(probabilities)!=len(outcomes) or not outcomes: raise ValueError("probabilities and outcomes must have same non-zero length")
    scores=[]
    for row,outcome in zip(probabilities,outcomes):
        if not 0<=outcome<len(row): raise ValueError("outcome index outside probability row")
        if any(not math.isfinite(float(p)) or p<0 or p>1 for p in row): raise ValueError("probabilities must be in [0, 1]")
        if abs(sum(row)-1)>1e-6: raise ValueError("each probability row must sum to 1")
        scores.append(sum((p-(1.0 if i==outcome else 0.0))**2 for i,p in enumerate(row)))
    return sum(scores)/len(scores)

def multiclass_log_loss(probabilities: Sequence[Sequence[float]], outcomes: Sequence[int], eps: float=1e-15) -> float:
    if len(probabilities)!=len(outcomes) or not outcomes: raise ValueError("probabilities and outcomes must have same non-zero length")
    return -sum(math.log(max(eps,min(1.0,float(row[outcome])))) for row,outcome in zip(probabilities,outcomes))/len(outcomes)

def calibration_bins(probabilities: Sequence[float], outcomes: Sequence[int], bins: int=10) -> list[dict]:
    if len(probabilities)!=len(outcomes) or not outcomes: raise ValueError("probabilities and outcomes must have same non-zero length")
    if bins<2: raise ValueError("bins must be >= 2")
    groups=defaultdict(list)
    for p,y in zip(probabilities,outcomes):
        p=float(p)
        if not 0<=p<=1 or y not in (0,1): raise ValueError("probabilities must be [0,1] and outcomes binary")
        groups[min(bins-1,int(p*bins))].append((p,y))
    return [{"bin_lower":i/bins,"bin_upper":(i+1)/bins,"count":len(items),
             "mean_probability":sum(p for p,_ in items)/len(items),
             "observed_frequency":sum(y for _,y in items)/len(items)}
            for i,items in sorted(groups.items())]
