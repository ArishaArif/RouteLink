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
import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

DESTINATIONS_PATH = "data/processed/destinations_clean.csv"

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


def fetch_full_forecast(city: str, api_key: str) -> list:
    """
    Unlike fetch_forecast() (which keeps only the 12:00 reading per day),
    this keeps EVERY 3-hour reading OpenWeatherMap gives us -- we need
    multiple time-of-day readings per day to catch "40°C at 2pm, 30°C at
    6pm" swings that a single daily snapshot would completely miss.
    """
    url = "https://api.openweathermap.org/data/2.5/forecast"
    params = {"q": f"{city},PK", "appid": api_key, "units": "metric"}
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()["list"]


def build_intraday_plan(forecast_entries: list, df: pd.DataFrame, top_n: int = 3) -> pd.DataFrame:
    """
    For each 3-hour time slot, combine TWO independent safety checks:
      1. Weather condition (rain/snow -> avoid open/hazardous spots)
      2. Heat tier (extreme heat -> avoid ANY outdoor spot, regardless
         of category -- a lake or valley is just as dangerous as a
         mountain pass at 42°C)

    Both must pass for a slot to be marked outdoor-safe. This mirrors
    exactly what you described: same location, same category, but
    whether it's a good time to go depends on WHEN, not just WHERE.
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
            # Too hot for ANY outdoor activity, no matter the category.
            safe_categories = set(INDOOR_SAFE_CATEGORIES)
            slot_type = "indoor_only_extreme_heat"
        elif heat_tier == "hot":
            # Warm enough that only water-adjacent/shaded outdoor spots
            # are reasonable, on top of whatever the weather condition allows.
            heat_tolerant = {"lake", "waterfall", "island"}
            safe_categories = (weather_ok_categories & heat_tolerant) | set(INDOOR_SAFE_CATEGORIES)
            slot_type = "limited_outdoor_hot"
        else:
            safe_categories = weather_ok_categories
            slot_type = "outdoor_ok" if condition in ("clear", "clouds") else "limited_outdoor"

        picks = df[df["category"].isin(safe_categories)]["name"].head(top_n).tolist()
        suggestion = ", ".join(picks) if picks else FALLBACK_MESSAGE

        rows.append({
            "date": date, "time": time, "temp_c": temp, "condition": condition,
            "heat_tier": heat_tier, "slot_type": slot_type, "suggestion": suggestion,
        })

    return pd.DataFrame(rows)


def fetch_forecast(city: str, api_key: str) -> list:
    """
    OpenWeatherMap's free 5-day/3-hour forecast endpoint. We only need
    ONE reading per day for a v1 scheduler, so we'll pick the midday
    (12:00) entry for each of the next 5 days -- a reasonable proxy for
    "what's this day like" without overcomplicating v1.
    """
    url = "https://api.openweathermap.org/data/2.5/forecast"
    params = {"q": f"{city},PK", "appid": api_key, "units": "metric"}
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    daily = [entry for entry in data["list"] if entry["dt_txt"].endswith("12:00:00")]
    return daily


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


def build_day_plan(forecast_days: list, df: pd.DataFrame, top_n: int = 3) -> pd.DataFrame:
    """
    For each forecast day, work out which condition bucket it falls into,
    then filter the destination catalog down to categories rated "ideal"
    for that condition (and explicitly exclude "avoid" categories, even
    if they'd otherwise sneak through).

    On rain/snow days specifically, if the catalog doesn't have enough
    genuinely indoor attractions near the plan, we fall back to an honest
    "stay indoors" message instead of forcing weak matches.
    """
    rows = []
    for i, entry in enumerate(forecast_days, start=1):
        date = entry["dt_txt"].split(" ")[0]
        temp = entry["main"]["temp"]
        condition = classify_condition(entry["weather"][0]["main"])
        rule = CATEGORY_WEATHER_RULES[condition]

        suitable = df[df["category"].isin(rule["ideal_for"]) & ~df["category"].isin(rule["avoid"])]
        picks = suitable["name"].head(top_n).tolist()

        is_bad_weather = condition in ("rain", "snow")
        if is_bad_weather and len(picks) < top_n:
            day_type = "indoor_rest"
            suggestion = FALLBACK_MESSAGE
        elif is_bad_weather:
            day_type = "limited_outdoor"
            suggestion = ", ".join(picks)
        else:
            day_type = "outdoor"
            suggestion = ", ".join(picks) if picks else FALLBACK_MESSAGE

        rows.append({
            "day": i, "date": date, "condition": condition, "temp_c": temp,
            "day_type": day_type, "suggested_activities": suggestion,
        })

    return pd.DataFrame(rows)


def build_day_plan_mock(df: pd.DataFrame) -> pd.DataFrame:
    """
    Offline fallback so this script (and this concept) can be demoed and
    understood without needing live internet/API access -- useful for
    testing the SCHEDULING LOGIC in isolation from the WEATHER FETCHING.
    Swap this out for build_day_plan() once you're running with a real key.
    """
    mock_forecast = [
        {"dt_txt": "2026-09-01 12:00:00", "main": {"temp": 18}, "weather": [{"main": "Clear"}]},
        {"dt_txt": "2026-09-02 12:00:00", "main": {"temp": 15}, "weather": [{"main": "Clouds"}]},
        {"dt_txt": "2026-09-03 12:00:00", "main": {"temp": 12}, "weather": [{"main": "Rain"}]},
        {"dt_txt": "2026-09-04 12:00:00", "main": {"temp": 5},  "weather": [{"main": "Snow"}]},
        {"dt_txt": "2026-09-05 12:00:00", "main": {"temp": 20}, "weather": [{"main": "Clear"}]},
    ]
    return build_day_plan(mock_forecast, df)


def build_intraday_plan_mock(df: pd.DataFrame) -> pd.DataFrame:
    """
    Offline demo matching your exact scenario: a Monday where it's 40°C
    at midday and cools to 30°C by evening. Notice the SAME day, SAME
    weather condition (clear), but a DIFFERENT recommendation depending
    on the hour -- that's the whole point of this feature.
    """
    mock_entries = [
        {"dt_txt": "2026-07-06 09:00:00", "main": {"temp": 32}, "weather": [{"main": "Clear"}]},
        {"dt_txt": "2026-07-06 12:00:00", "main": {"temp": 38}, "weather": [{"main": "Clear"}]},
        {"dt_txt": "2026-07-06 15:00:00", "main": {"temp": 40}, "weather": [{"main": "Clear"}]},
        {"dt_txt": "2026-07-06 18:00:00", "main": {"temp": 30}, "weather": [{"main": "Clear"}]},
        {"dt_txt": "2026-07-06 21:00:00", "main": {"temp": 26}, "weather": [{"main": "Clear"}]},
    ]
    return build_intraday_plan(mock_entries, df)


def main():
    df = pd.read_csv(DESTINATIONS_PATH)
    api_key = os.getenv("WEATHER_API_KEY")

    if api_key:
        print("--- Using LIVE forecast for Skardu (daily) ---")
        forecast_days = fetch_forecast("Skardu", api_key)
        plan = build_day_plan(forecast_days, df)
        print(plan.to_string(index=False))

        print("\n--- Using LIVE forecast for Skardu (intraday, heat-aware) ---")
        full_entries = fetch_full_forecast("Skardu", api_key)
        intraday_plan = build_intraday_plan(full_entries, df)
        print(intraday_plan.to_string(index=False))
    else:
        print("--- No WEATHER_API_KEY found -- using MOCK forecast for demonstration ---")
        plan = build_day_plan_mock(df)
        print(plan.to_string(index=False))

        print("\n--- MOCK intraday heat-aware plan (hot summer Monday) ---")
        intraday_plan = build_intraday_plan_mock(df)
        print(intraday_plan.to_string(index=False))


if __name__ == "__main__":
    main()