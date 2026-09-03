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

    print("\n--- Intraday detail (heat + weather aware) ---")
    print(build_intraday_plan(entries, nearby_df).to_string(index=False))


if __name__ == "__main__":
    main()