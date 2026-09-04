"""
app.py
-------
FastAPI microservice wrapping the AI/ML pipeline (content_recommender,
weather_scheduler, hazard_classifier) as callable HTTP endpoints -- the
"wrap models as a callable service so Backend can call them" step.

Run: uvicorn app:app --reload
"""

from fastapi import FastAPI, Query, HTTPException
from typing import List, Optional
from pydantic import BaseModel
import os
import pandas as pd

from scripts.content_recommender import (
    build_content_profile,
    build_similarity_matrix,
    recommend_similar,
    recommend_by_preferences,
)
from scripts.weather_scheduler import (
    build_intraday_plan,
    build_mixed_week_mock,
    filter_nearby_destinations,
    get_city_coords,
    fetch_full_forecast,
    CITY_COORDS,
)
from scripts.hazard_classifier import predict_hazard

app = FastAPI(title="RouteLink ML Microservice", version="1.0.0")

DESTINATIONS_PATH = "data/processed/destinations_clean.csv"

# --- Load once at startup, not per-request -------------------------------
# The original code called `pd.read_csv(...)` inside every single endpoint,
# and get_similar_recommendations rebuilt the TF-IDF similarity matrix
# (69x69 cosine_similarity, plus a full TfidfVectorizer fit) on every call
# too. None of that data changes between requests, so it's loaded once here
# and reused -- this is also what makes the fix below possible, since
# recommend_similar needs a similarity_matrix that was never being built at
# all in the original file.
_destinations_df = pd.read_csv(DESTINATIONS_PATH)
_content_profiles = build_content_profile(_destinations_df)
_similarity_matrix, _ = build_similarity_matrix(_content_profiles)


# Request Schemas
class RecByPrefRequest(BaseModel):
    categories: List[str]
    province: Optional[str] = None
    top_n: int = 5
    exclude: Optional[List[str]] = []


class IntradayPlanRequest(BaseModel):
    city: str
    exclude: Optional[List[str]] = []


class HazardPredictRequest(BaseModel):
    texts: List[str]


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "RouteLink ML Pipeline"}


@app.post("/api/recommend/preferences")
def get_recommendations_by_pref(req: RecByPrefRequest):
    """
    BUG (original): called as
    `recommend_by_preferences(df, req.province, req.category, req.top_n, req.exclude)`
    -- 4 positional arguments after `df`. The real signature is
    `recommend_by_preferences(df, preferred_categories, top_n=8, exclude=None)`,
    only 3 parameters after `df`, and there is no `province` parameter at
    all. This would raise `TypeError: recommend_by_preferences() takes from
    2 to 4 positional arguments but 5 were given` on the very first call --
    not a subtle bug, the endpoint could never have worked.

    FIX: call the function with the categories list it actually expects,
    over-fetch (score every destination, not just top_n) so a province
    filter applied afterward still has enough left to slice from, then
    filter by province in this layer and cut to top_n.
    """
    recs = recommend_by_preferences(
        _destinations_df, req.categories, top_n=len(_destinations_df), exclude=req.exclude
    )

    if req.province:
        recs = recs[recs["province"].str.lower() == req.province.lower()]

    return recs.head(req.top_n).to_dict(orient="records")


@app.post("/api/recommend/similar/{dest_name}")
def get_similar_recommendations(dest_name: str, top_n: int = 5,
                                 exclude: Optional[List[str]] = Query(default=[])):
    """
    BUG (original): called as `recommend_similar(df, dest_name, top_n, exclude)`.
    The real signature is
    `recommend_similar(df, similarity_matrix, name, top_n=8, exclude=None)`
    -- a precomputed similarity_matrix is a required second argument that
    was never built or passed. Positionally, `dest_name` (a string) landed
    in the `similarity_matrix` slot and `top_n` (an int) landed in the
    `name` slot, so this would fail on the first real call, not under load.

    FIX: use the module-level `_similarity_matrix` built once at startup,
    and validate the destination exists before calling, so an unknown name
    returns a real 404 instead of a silently empty list (recommend_similar
    itself only prints a warning and returns an empty DataFrame on a miss --
    fine for a CLI script, not for an HTTP service Backend depends on).
    """
    if dest_name.lower() not in _destinations_df["name"].str.lower().values:
        raise HTTPException(status_code=404, detail=f"Destination '{dest_name}' not found in catalog")

    recs = recommend_similar(_destinations_df, _similarity_matrix, dest_name, top_n, exclude)
    return recs.to_dict(orient="records")


@app.post("/api/schedule/intraday")
def get_intraday_schedule(req: IntradayPlanRequest):
    """
    FIX: previously only checked `city in CITY_COORDS` (5 hardcoded
    cities), 400-ing on anything else even when a live WEATHER_API_KEY
    was available and could geocode it via get_city_coords(). Now uses
    the same resolution path weather_scheduler.py's own main() uses:
    CITY_COORDS first (fast, no API call for known hubs), falling back to
    live geocoding. Also now pulls a real forecast when WEATHER_API_KEY is
    set, instead of always using the mock week -- matching main()'s
    behavior so the service and the CLI script no longer diverge.
    """
    api_key = os.getenv("WEATHER_API_KEY")

    try:
        if api_key:
            lat, lon = get_city_coords(req.city, api_key)
        elif req.city in CITY_COORDS:
            lat, lon = CITY_COORDS[req.city]
        else:
            raise HTTPException(
                status_code=400,
                detail=f"City '{req.city}' not in CITY_COORDS and no WEATHER_API_KEY "
                       f"set to geocode it live.",
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    nearby = filter_nearby_destinations(_destinations_df, lat, lon)

    if api_key:
        entries = fetch_full_forecast(lat, lon, api_key)
    else:
        entries = build_mixed_week_mock()

    plan = build_intraday_plan(entries, nearby, top_n=6, exclude=req.exclude)
    return plan.to_dict(orient="records")


@app.post("/api/predict/hazard")
def predict_hazard_endpoint(req: HazardPredictRequest):
    """
    NEW ENDPOINT. app.py already imported `predict_hazard` from
    hazard_classifier.py, but that function didn't exist there yet (see
    the hazard_classifier.py fix), AND even if it had, nothing in app.py
    ever called it -- there was no route for it. The import alone would
    have crashed the service at startup (ImportError) before any endpoint
    could run; adding the function without also exposing it here would
    leave the hazard model with no callable entry point at all, despite
    that being an explicit workplan item.
    """
    return predict_hazard(req.texts)