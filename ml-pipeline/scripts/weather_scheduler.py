"""
weather_scheduler.py
----------------------
Day 2, Part 2: weather-based scheduling logic.

Given a destination's real forecast, decide which of that destination's
nearby/similar activity categories make sense on which day. This is a
RULE-BASED system, not a trained model -- there's no dataset of "which
weather suits which activity," that's genuinely subjective/common-sense
knowledge, so we encode it directly rather than pretending we need ML
for something a simple lookup table solves better and more transparently.

Run: python scripts/weather_scheduler.py
"""

import os
import math
import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

DESTINATIONS_PATH = "data/processed/destinations_clean.csv"

# Known coordinates for Northern Pakistan tourism hubs -- used as a
# fallback anchor point when we're not fetching live weather (mock mode)
# and don't have a real API response to read coordinates from.
CITY_COORDS = {
    "Skardu": (35.2971, 75.6333),
    "Hunza": (36.3167, 74.6500),
    "Gilgit": (35.9221, 74.3087),
    "Naran": (34.9042, 73.6500),
    "Chilas": (35.4227, 74.1015),
}

# How far from the queried city a destination can be and still count as
# "nearby" for recommendation purposes. Northern Pakistan's valleys are
# spread out, so 120km is generous enough to return a few real options
# without suggesting somewhere a day's drive away.
PROXIMITY_RADIUS_KM = 120

# Which categories are safe/pleasant in which weather condition.
# Note: "mosque" and "fort" are NOT treated as rain/snow-safe here even
# though they're technically indoor-ish -- many are open-air heritage
# sites (courtyards, exposed walkways), so recommending them on a rainy
# day would be misleading. Only genuinely fully-enclosed categories go
# in "indoor_safe".
INDOOR_SAFE_CATEGORIES = ["museum", "mall"]

CATEGORY_WEATHER_RULES = {
    "clear": {
        "ideal_for": ["lake", "meadow", "valley", "mountainous", "mountain_pass", "glacier",
                      "hill station", "waterfall", "island", "mosque", "fort", "historical"],
        "avoid": [],
    },
    "clouds": {
        "ideal_for": ["valley", "hill station", "mosque", "fort", "museum", "historical"],
        "avoid": ["glacier", "mountain_pass"],
    },
    "rain": {
        "ideal_for": INDOOR_SAFE_CATEGORIES,
        "avoid": ["lake", "meadow", "waterfall", "mountain_pass", "glacier", "mountainous",
                  "mosque", "fort"],
    },
    "snow": {
        "ideal_for": INDOOR_SAFE_CATEGORIES,
        "avoid": ["mountain_pass", "glacier", "lake", "meadow", "waterfall", "mountainous",
                  "mosque", "fort"],
    },
}

# When a day is rain/snow AND the destination catalog has no (or too few)
# genuinely indoor attractions nearby, we don't invent restaurant/hotel
# names -- we don't have that data. Tourist_Destinations.csv only covers
# attractions, not lodging/dining, which is the Guide Marketplace
# feature's job (Backend owns that data). This message is the honest
# hand-off point instead of fabricating results.
FALLBACK_MESSAGE = (
    "No safe outdoor attractions recommended right now. "
    "Suggest resting at your hotel and exploring nearby local restaurants "
    "(see Guide Marketplace for verified options)."
)

# --- Backend integration (per API_CONTRACT.md §5) ---
MODEL_VERSION = "heat-sched-v0.1.0"

# Contract §3: heatTier is a Postgres enum with exactly these 5 values.
# Our own classify_heat() only distinguishes 3 internal tiers (comfortable/
# hot/extreme) -- that internal granularity stays as-is (it's what drives
# build_intraday_plan's actual safety logic below), this table is ONLY the
# translation applied right before a payload leaves for the backend, so a
# stray "comfortable" never reaches PUT /api/trips/:id/itinerary and gets a
# 400 back for an unrecognized enum value.
HEAT_TIER_TO_CONTRACT = {
    "comfortable": "mild",
    "hot": "hot",
    "extreme": "extreme",
}

# Contract §3: slotType is a separate enum (outdoor_active | outdoor_light |
# indoor_rest | travel | mixed) that shares no values with our internal
# slot_type labels (outdoor_ok / limited_outdoor / limited_outdoor_hot /
# indoor_only_extreme_heat). Same approach: internal labels are untouched,
# this table only translates outgoing payloads.
SLOT_TYPE_TO_CONTRACT = {
    "outdoor_ok": "outdoor_active",
    "limited_outdoor": "outdoor_light",
    "limited_outdoor_hot": "outdoor_light",
    "indoor_only_extreme_heat": "indoor_rest",
}

HAZARD_ALERTS_PATH = "data/processed/hazard_alerts.csv"

# --- Heat safety tiers (matters most Jun-Aug in Pakistan) ---
# Rain/snow are about avoiding hazard exposure; heat is about avoiding
# heatstroke risk. A "clear, sunny" day is exactly when heat becomes
# dangerous, so this needs to be a SEPARATE check layered on top of the
# condition rules above, not folded into them.
HEAT_TIERS = [
    # (max_temp_exclusive, tier_name)
    (33, "comfortable"),
    (38, "hot"),
    (float("inf"), "extreme"),
]


def classify_heat(temp_c: float) -> str:
    for max_temp, tier in HEAT_TIERS:
        if temp_c < max_temp:
            return tier
    return "extreme"  # unreachable given inf above, but keeps the function total


def get_city_coords(city: str, api_key: str) -> tuple:
    """
    Resolve a city name to (lat, lon) BEFORE calling the forecast API --
    and crucially, do it via OpenWeatherMap's dedicated Geocoding API,
    not the forecast endpoint's built-in q=CityName search.

    Why this matters: q=CityName on the /forecast endpoint uses an old,
    incomplete static city list that's especially weak for small towns
    (exactly what happened here -- "Hunza,PK" either silently matched
    the wrong place, or 404'd outright, inconsistently). The Geocoding
    API is the currently-recommended, more accurate way to turn a place
    name into coordinates, and once we have coordinates we call the
    forecast endpoint by lat/lon instead -- which has no ambiguity at all.
    """
    if city in CITY_COORDS:
        return CITY_COORDS[city]

    url = "http://api.openweathermap.org/geo/1.0/direct"
    params = {"q": f"{city},PK", "limit": 1, "appid": api_key}
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    results = resp.json()

    if not results:
        raise ValueError(
            f"Could not geocode '{city}'. Add it manually to CITY_COORDS with "
            f"real coordinates (check Google Maps) instead of relying on text search."
        )

    return results[0]["lat"], results[0]["lon"]


def fetch_full_forecast(lat: float, lon: float, api_key: str) -> list:
    """
    Unlike fetch_forecast() (which keeps only the 12:00 reading per day),
    this keeps EVERY 3-hour reading OpenWeatherMap gives us -- we need
    multiple time-of-day readings per day to catch "40°C at 2pm, 30°C at
    6pm" swings that a single daily snapshot would completely miss.

    Called with lat/lon directly (see get_city_coords) rather than a
    city name string -- this avoids OpenWeatherMap's unreliable
    name-based city matching entirely.
    """
    url = "https://api.openweathermap.org/data/2.5/forecast"
    params = {"lat": lat, "lon": lon, "appid": api_key, "units": "metric"}
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()["list"]


def build_intraday_plan(forecast_entries: list, df: pd.DataFrame, top_n: int = 6,
                          exclude: list = None) -> pd.DataFrame:
    """
    For each 3-hour time slot, combine TWO independent safety checks:
      1. Weather condition (rain/snow -> avoid open/hazardous spots)
      2. Heat tier (extreme heat -> avoid ANY outdoor spot, regardless
         of category -- a lake or valley is just as dangerous as a
         mountain pass at 42°C)

    Both must pass for a slot to be marked outdoor-safe. This mirrors
    exactly what you described: same location, same category, but
    whether it's a good time to go depends on WHEN, not just WHERE.

    top_n defaults to 6 rather than 3 -- enough for a frontend swipe/pick
    UI to have real options, not just the same 3 names every single call.
    exclude is a list of destination names to skip (e.g. already
    visited/dismissed by this user) -- Backend supplies this list based
    on stored user state; this function just filters against it.
    """
    rows = []
    for entry in forecast_entries:
        date, time = entry["dt_txt"].split(" ")
        time = time[:5]  # "HH:MM"
        temp = entry["main"]["temp"]
        condition = classify_condition(entry["weather"][0]["main"])
        heat_tier = classify_heat(temp)

        weather_rule = CATEGORY_WEATHER_RULES[condition]
        weather_ok_categories = set(weather_rule["ideal_for"]) - set(weather_rule["avoid"])

        if heat_tier == "extreme":
            safe_categories = set(INDOOR_SAFE_CATEGORIES)
            slot_type = "indoor_only_extreme_heat"
        elif heat_tier == "hot":
            heat_tolerant = {"lake", "waterfall", "island"}
            safe_categories = (weather_ok_categories & heat_tolerant) | set(INDOOR_SAFE_CATEGORIES)
            slot_type = "limited_outdoor_hot"
        else:
            safe_categories = weather_ok_categories
            slot_type = "outdoor_ok" if condition in ("clear", "clouds") else "limited_outdoor"

        candidates = df[df["category"].isin(safe_categories)]
        if exclude:
            # Case-insensitive, matching the convention in
            # content_recommender.py's recommend_similar/recommend_by_preferences.
            # A plain .isin(exclude) is case-SENSITIVE -- "hunza valley"
            # from a client wouldn't have matched stored "Hunza Valley"
            # and would have silently failed to exclude anything.
            exclude_lower = set(n.lower() for n in exclude)
            candidates = candidates[~candidates["name"].str.lower().isin(exclude_lower)]

        picks = candidates["name"].head(top_n).tolist()
        suggestion = ", ".join(picks) if picks else FALLBACK_MESSAGE
        needs_marketplace_data = len(picks) == 0

        rows.append({
            "date": date, "time": time, "temp_c": temp, "condition": condition,
            "heat_tier": heat_tier, "slot_type": slot_type, "suggestion": suggestion,
            "needs_marketplace_data": needs_marketplace_data,
        })

    return pd.DataFrame(rows)


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    """
    Great-circle distance between two lat/long points, in kilometers.
    Simple Euclidean distance (treating lat/long like flat x/y coordinates)
    gets increasingly wrong the further apart two points are, because the
    Earth is a sphere, not a grid -- haversine accounts for that curvature
    and is the standard formula for this.
    """
    R = 6371  # Earth's radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def filter_nearby_destinations(df: pd.DataFrame, center_lat: float, center_lon: float,
                                 radius_km: float = PROXIMITY_RADIUS_KM) -> pd.DataFrame:
    """
    Scope the destination catalog down to places actually near the
    queried city, before any category/weather filtering happens. This is
    the fix for the "same results no matter what city" bug -- without
    this, every query just returns the same top-N-by-category from the
    entire 69-destination national catalog.
    """
    df = df.copy()
    df["distance_km"] = df.apply(
        lambda row: haversine_km(center_lat, center_lon, row["latitude"], row["longitude"]), axis=1
    )
    nearby = df[df["distance_km"] <= radius_km].sort_values("distance_km")

    if len(nearby) == 0:
        # No honest fallback here either -- better to say so than silently
        # return unrelated destinations from the other end of the country.
        print(f"No destinations found within {radius_km}km of ({center_lat}, {center_lon}).")
    return nearby


def classify_condition(weather_main: str) -> str:
    """Map OpenWeatherMap's many specific labels down to our 4 rule buckets."""
    weather_main = weather_main.lower()
    if "rain" in weather_main or "drizzle" in weather_main or "thunderstorm" in weather_main:
        return "rain"
    if "snow" in weather_main:
        return "snow"
    if "cloud" in weather_main:
        return "clouds"
    return "clear"


def summarize_day(day_df: pd.DataFrame) -> dict:
    """
    Collapse a day's worth of time-slots into one summary line for
    calendar/overview UI, without re-implementing any weather/heat logic
    -- it just reads the slot_type labels build_intraday_plan already produced.
    """
    date = day_df["date"].iloc[0]
    outdoor_slots = day_df[day_df["slot_type"] == "outdoor_ok"]
    avg_temp = round(day_df["temp_c"].mean(), 1)

    if len(outdoor_slots) == len(day_df):
        summary = "Good outdoor day all day."
    elif len(outdoor_slots) == 0:
        summary = "Not a good outdoor day — stay indoors / rest."
    else:
        good_times = ", ".join(outdoor_slots["time"].tolist())
        summary = f"Mixed day — best outdoor windows: {good_times}."

    # Surface the single best pick from the best available slot, for a
    # "featured suggestion" on the day card.
    best_slot = day_df.loc[day_df["slot_type"].eq("outdoor_ok"), "suggestion"]
    featured = best_slot.iloc[0] if len(best_slot) > 0 else day_df["suggestion"].iloc[0]

    return {"date": date, "avg_temp_c": avg_temp, "summary": summary, "featured_suggestion": featured}


def build_day_plan(forecast_entries: list, df: pd.DataFrame) -> pd.DataFrame:
    """
    Daily summary view for calendar-style UI (e.g. "Day 1: mostly clear,
    best outdoor window 9am-11am"). This is now a ROLLUP of the intraday
    plan, not a separate rule-check -- so heat/weather logic only lives
    in one place (build_intraday_plan) and can't drift out of sync.
    """
    intraday = build_intraday_plan(forecast_entries, df)
    summaries = [summarize_day(day_df) for _, day_df in intraday.groupby("date")]
    return pd.DataFrame(summaries)


def map_heat_tier(internal_tier: str) -> str:
    """Translate our internal heat tier to the contract's §3 enum. Unknown
    input maps to None rather than guessing -- an omitted heatTier is valid
    per §3 ('nullable at the day level'); a made-up enum value is not."""
    return HEAT_TIER_TO_CONTRACT.get(internal_tier)


def map_slot_type(internal_slot_type: str) -> str:
    """Translate our internal slot_type to the contract's §3 enum."""
    return SLOT_TYPE_TO_CONTRACT.get(internal_slot_type)


def load_hazard_context(region_names: list) -> dict:
    """
    Build the day-level hazardContext object from hazard_news_scraper.py's
    output (data/processed/hazard_alerts.csv), scoped to the destinations
    actually in play for this itinerary. Per §2, hazardContext is free-form
    JSON that ML owns and the backend stores unchanged -- so this shape can
    evolve without a backend deploy.

    Falls back to a zero-alert object (not an error) if the hazard file
    doesn't exist yet -- weather scheduling shouldn't fail just because the
    hazard pipeline hasn't been run in this session.
    """
    try:
        alerts_df = pd.read_csv(HAZARD_ALERTS_PATH)
    except FileNotFoundError:
        return {"activeAlerts": 0}

    if len(alerts_df) == 0 or "matched_destinations" not in alerts_df.columns:
        return {"activeAlerts": 0}

    region_set = set(n.lower() for n in region_names)
    matches = alerts_df[alerts_df["matched_destinations"].fillna("").apply(
        lambda s: any(name.strip().lower() in region_set for name in s.split(","))
    )]

    if len(matches) == 0:
        return {"activeAlerts": 0}

    return {
        "activeAlerts": int(len(matches)),
        "recentTitles": matches["title"].head(3).tolist(),
    }


def build_itinerary_days(intraday: pd.DataFrame, nearby_df: pd.DataFrame,
                           start_day_number: int = 1) -> list:
    """
    Roll the per-time-slot intraday plan up into one payload object per
    calendar date, shaped exactly per §5's request body: dayNumber, date,
    slotType, heatTier, weatherContext, hazardContext, activities[].

    Day-level slotType: if every slot that day maps to the same contract
    value, use that value; otherwise "mixed" (a real value in §3's
    vocabulary, not a fallback hack -- it's specifically for days that
    genuinely combine outdoor and indoor/rest time).

    Day-level heatTier: the single most severe tier reached that day
    (extreme > hot > mild) -- a day is only as heat-safe as its worst hour,
    so summarizing by "average" would understate real risk.
    """
    region_names = nearby_df["name"].tolist()
    hazard_context = load_hazard_context(region_names)

    heat_severity_order = ["mild", "hot", "extreme"]
    days_payload = []

    for day_number, (date, day_df) in enumerate(intraday.groupby("date"), start=start_day_number):
        mapped_slot_types = day_df["slot_type"].map(map_slot_type)
        mapped_heat_tiers = day_df["heat_tier"].map(map_heat_tier)

        unique_slot_types = mapped_slot_types.dropna().unique().tolist()
        day_slot_type = unique_slot_types[0] if len(unique_slot_types) == 1 else "mixed"

        present_tiers = [t for t in heat_severity_order if t in mapped_heat_tiers.values]
        day_heat_tier = present_tiers[-1] if present_tiers else None

        activities = [
            {
                "time": row["time"],
                "title": row["suggestion"],
                "slotType": map_slot_type(row["slot_type"]),
            }
            for _, row in day_df.iterrows()
        ]

        day_payload = {
            "dayNumber": day_number,
            "date": date,
            "slotType": day_slot_type,
            "heatTier": day_heat_tier,
            "weatherContext": {
                # Cast off numpy's float64 explicitly -- it looks and prints
                # like a plain float, but json.dumps() (which requests uses
                # internally for `json=payload`) raises TypeError on it,
                # so this isn't optional even though the dry-run print above
                # shows it "working" fine.
                "avgTempC": round(float(day_df["temp_c"].mean()), 1),
                "condition": day_df["condition"].mode().iloc[0],
            },
            "hazardContext": hazard_context,
            "activities": activities,
        }

        # §4: only needed when overriding the backend's default. The
        # backend already sets needsMarketplaceData: true automatically on
        # any indoor_rest day, so we only send it explicitly when a day
        # NEEDS real options but isn't purely indoor_rest (e.g. "mixed"
        # with an indoor block) -- otherwise the default silently misses it.
        if day_slot_type == "mixed" and any(
            row["needs_marketplace_data"] for _, row in day_df.iterrows()
        ):
            day_payload["needsMarketplaceData"] = True

        if day_df["needs_marketplace_data"].any():
            fallback_row = day_df[day_df["needs_marketplace_data"]].iloc[0]
            day_payload["fallbackMessage"] = fallback_row["suggestion"]

        days_payload.append(day_payload)

    return days_payload


def post_itinerary(days_payload: list, trip_id: str, base_url: str, ingest_key: str) -> dict:
    """
    PUT the built itinerary to the backend per §5. Uses the ML service key
    (X-Ingest-Key), which per §5's auth table "may write any trip" --
    same convention hazard_news_scraper.py already uses for /api/hazards.

    Note §5's replace semantics: any day previously stored and not present
    in this payload is deleted -- this call always sends the FULL itinerary
    for the trip, never a partial update.
    """
    url = f"{base_url}/api/trips/{trip_id}/itinerary"
    headers = {"X-Ingest-Key": ingest_key}
    payload = {"modelVersion": MODEL_VERSION, "days": days_payload}

    resp = requests.put(url, json=payload, headers=headers, timeout=15)

    if resp.status_code == 200:
        data = resp.json()
        # §5: "ignoredFields ... check it in CI" -- unrecognized day-level
        # keys don't fail the request, they just get silently dropped, so
        # a naming typo here would otherwise go unnoticed indefinitely.
        ignored = data.get("ignoredFields")
        if ignored:
            print(f"  [warning] backend ignored unrecognized fields: {ignored}")
        print(f"  [ok] wrote {len(days_payload)} day(s) to trip {trip_id} "
              f"(writtenBy={data.get('writtenBy')})")
        return data
    elif resp.status_code == 400:
        print(f"  [400] itinerary rejected: {resp.json()}")
    elif resp.status_code == 401:
        print("  [401] Unauthorized -- check ML_SERVICE_KEY matches the backend's X-Ingest-Key")
    elif resp.status_code == 404:
        print(f"  [404] trip {trip_id} not found (or token doesn't own it)")
    else:
        print(f"  [{resp.status_code}] {resp.text[:200]}")
    return {}


def build_mixed_week_mock() -> list:
    """A 2-day mock spanning clear/hot, rain, and cool evening -- enough
    variety to see build_day_plan's rollup summaries differ day to day."""
    return [
        {"dt_txt": "2026-07-06 09:00:00", "main": {"temp": 32}, "weather": [{"main": "Clear"}]},
        {"dt_txt": "2026-07-06 12:00:00", "main": {"temp": 39}, "weather": [{"main": "Clear"}]},
        {"dt_txt": "2026-07-06 15:00:00", "main": {"temp": 40}, "weather": [{"main": "Clear"}]},
        {"dt_txt": "2026-07-06 18:00:00", "main": {"temp": 30}, "weather": [{"main": "Clear"}]},
        {"dt_txt": "2026-07-07 09:00:00", "main": {"temp": 24}, "weather": [{"main": "Rain"}]},
        {"dt_txt": "2026-07-07 12:00:00", "main": {"temp": 25}, "weather": [{"main": "Rain"}]},
        {"dt_txt": "2026-07-07 15:00:00", "main": {"temp": 26}, "weather": [{"main": "Clouds"}]},
        {"dt_txt": "2026-07-07 18:00:00", "main": {"temp": 23}, "weather": [{"main": "Clear"}]},
    ]


def main(city: str = "Hunza"):
    df = pd.read_csv(DESTINATIONS_PATH)
    api_key = os.getenv("WEATHER_API_KEY")

    if api_key:
        city_lat, city_lon = get_city_coords(city, api_key)
        print(f"Resolved '{city}' to coordinates ({city_lat}, {city_lon})\n")
        entries = fetch_full_forecast(city_lat, city_lon, api_key)
    else:
        print(f"--- No WEATHER_API_KEY found -- using MOCK forecast for demonstration (city: {city}) ---\n")
        entries = build_mixed_week_mock()
        city_lat, city_lon = CITY_COORDS.get(city, CITY_COORDS["Skardu"])

    nearby_df = filter_nearby_destinations(df, city_lat, city_lon)
    print(f"Found {len(nearby_df)} destinations within {PROXIMITY_RADIUS_KM}km of {city}: "
          f"{', '.join(nearby_df['name'].head(8).tolist())}{' ...' if len(nearby_df) > 8 else ''}\n")

    print("--- Daily summary (calendar view) ---")
    print(build_day_plan(entries, nearby_df).to_string(index=False))

    intraday = build_intraday_plan(entries, nearby_df)
    print("\n--- Intraday detail (heat + weather aware) ---")
    print(intraday.to_string(index=False))

    # Push to backend per API_CONTRACT.md §5. Runs live only if
    # API_BASE_URL, ML_SERVICE_KEY, and TRIP_ID are all set; otherwise
    # prints exactly what WOULD be sent, mirroring the dry-run convention
    # hazard_news_scraper.py already uses for /api/hazards -- so the
    # payload shape can be reviewed/shared with Backend before anything
    # actually writes to a trip.
    days_payload = build_itinerary_days(intraday, nearby_df)

    api_base_url = os.getenv("API_BASE_URL")
    ingest_key = os.getenv("ML_SERVICE_KEY")
    trip_id = os.getenv("TRIP_ID")

    print(f"\n--- Backend itinerary push ({len(days_payload)} day(s)) ---")
    if api_base_url and ingest_key and trip_id:
        post_itinerary(days_payload, trip_id, api_base_url, ingest_key)
    else:
        missing = [name for name, val in
                   [("API_BASE_URL", api_base_url), ("ML_SERVICE_KEY", ingest_key), ("TRIP_ID", trip_id)]
                   if not val]
        print(f"DRY RUN ({', '.join(missing)} not set) -- payload that would be sent:")
        for day in days_payload:
            print(f"  {day}")


if __name__ == "__main__":
    main()