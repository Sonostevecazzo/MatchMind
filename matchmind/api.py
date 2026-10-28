"""Local FastAPI endpoints. No live data or trained AI is configured by default."""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from .analysis import compare_market
from .model import forecast_markets, market_dict

app=FastAPI(title="MatchMind Local API",version="0.1.0",
 description="Local statistical toolkit. Live data and trained AI are not configured by default.")

class ForecastRequest(BaseModel):
    home_xg: float=Field(ge=0,le=12)
    away_xg: float=Field(ge=0,le=12)
    max_goals: int=Field(default=12,ge=4,le=30)

class MarketRequest(BaseModel):
    selections: list[str]
    odds: list[float]
    model_probabilities: list[float] | None=None

@app.get("/health")
def health():
    return {"status":"ok","mode":"local","live_data_configured":False,"trained_model_configured":False}

@app.post("/forecast")
def forecast(request: ForecastRequest):
    try:
        return {"mode":"statistical_baseline","source":"user_supplied_xg",
                "markets":market_dict(forecast_markets(request.home_xg,request.away_xg,request.max_goals))}
    except ValueError as exc:
        raise HTTPException(status_code=422,detail=str(exc)) from exc

@app.post("/odds/analyse")
def analyse_odds(request: MarketRequest):
    try:
        return compare_market(request.selections,request.odds,request.model_probabilities)
    except ValueError as exc:
        raise HTTPException(status_code=422,detail=str(exc)) from exc
