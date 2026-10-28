import math
import pytest
from matchmind.model import devig_proportional, expected_value, forecast_markets, implied_probabilities, overround, poisson_pmf, score_matrix
from matchmind.analysis import compare_market
from matchmind.evaluation import multiclass_brier, multiclass_log_loss, calibration_bins

def test_poisson_zero_and_basic():
    assert poisson_pmf(0,0)==1
    assert poisson_pmf(0,1)==0
    assert poisson_pmf(1,0)==pytest.approx(math.exp(-1))

def test_score_matrix_normalized():
    assert sum(map(sum,score_matrix(1.4,1.1)))==pytest.approx(1.0,abs=1e-9)

def test_markets_complements_and_1x2_sum():
    p=forecast_markets(1.6,0.9)
    assert p.home_win+p.draw+p.away_win==pytest.approx(1.0)
    assert p.btts_yes+p.btts_no==pytest.approx(1.0)
    assert p.over_15+p.under_15==pytest.approx(1.0)
    assert p.over_25+p.under_25==pytest.approx(1.0)
    assert p.over_35+p.under_35==pytest.approx(1.0)
    assert p.over_15>=p.over_25>=p.over_35

def test_odds_math():
    odds=[2.0,3.5,4.0]
    raw=implied_probabilities(odds)
    assert sum(raw)==pytest.approx(1.0357142857)
    assert overround(odds)==pytest.approx(sum(raw)-1)
    assert sum(devig_proportional(odds))==pytest.approx(1.0)
    assert expected_value(0.55,2.0)==pytest.approx(0.1)

def test_invalid_values_rejected():
    with pytest.raises(ValueError): forecast_markets(-0.1,1.0)
    with pytest.raises(ValueError): implied_probabilities([1.0,2.0])

def test_anomaly_is_not_fraud_claim():
    result=compare_market(["1","X","2"],[1.8,3.5,4.5],[0.55,0.25,0.20])
    assert "overround" in result
    assert "not evidence" in result["interpretation"]

def test_evaluation_metrics():
    probs=[[0.7,0.2,0.1],[0.1,0.2,0.7]]
    outcomes=[0,2]
    assert multiclass_brier(probs,outcomes)>=0
    assert multiclass_log_loss(probs,outcomes)>0
    bins=calibration_bins([0.7,0.2],[1,0],bins=5)
    assert sum(b["count"] for b in bins)==2
