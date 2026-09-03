from fastapi import FastAPI, Query, HTTPException, Header
from typing import List, Optional
from pydantic import BaseModel
import pandas as pd

from scripts.content_recommender import recommend_similar, recommend_by_preferences
from scripts.weather_scheduler import build_intraday_plan, filter_nearby_destinations, CITY_COORDS
from scripts.hazard_classifier import predict_hazard

app = FastAPI(title="RouteLink ML Microservice", version="1.0.0")

# Request Schemas
class RecByPrefRequest(BaseModel):
    province: str
    category: str
    top_n: int = 5
    exclude: Optional[List[str]] = []

class IntradayPlanRequest(BaseModel):
    city: str
    exclude: Optional[List[str]] = []

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "RouteLink ML Pipeline"}

@app.post("/api/recommend/preferences")
def get_recommendations_by_pref(req: RecByPrefRequest):
    df = pd.read_csv("data/processed/destinations_clean.csv")
    recs = recommend_by_preferences(df, req.province, req.category, req.top_n, req.exclude)
    return recs.to_dict(orient="records")

@app.post("/api/recommend/similar/{dest_name}")
def get_similar_recommendations(dest_name: str, top_n: int = 5, exclude: Optional[List[str]] = Query(default=[])):
    df = pd.read_csv("data/processed/destinations_clean.csv")
    recs = recommend_similar(df, dest_name, top_n, exclude)
    return recs.to_dict(orient="records")

@app.post("/api/schedule/intraday")
def get_intraday_schedule(req: IntradayPlanRequest):
    if req.city not in CITY_COORDS:
        raise HTTPException(status_code=400, detail=f"City '{req.city}' coordinates not found.")
    df = pd.read_csv("data/processed/destinations_clean.csv")
    lat, lon = CITY_COORDS[req.city]
    nearby = filter_nearby_destinations(df, lat, lon)
    
    # Generate intraday plan mock/live structure
    from scripts.weather_scheduler import build_mixed_week_mock
    entries = build_mixed_week_mock()
    plan = build_intraday_plan(entries, nearby, top_n=6, exclude=req.exclude)
    return plan.to_dict(orient="records")