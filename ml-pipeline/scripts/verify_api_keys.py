"""
verify_api_keys.py
--------------------
Sanity check that your .env file is set up correctly, and that each API
key actually works, before you build real logic on top of them.

Run: python scripts/verify_api_keys.py
"""

import os
import requests
from dotenv import load_dotenv

# load_dotenv() reads your .env file and injects its contents into
# os.environ, so os.getenv("WEATHER_API_KEY") below can find them.
# This keeps secrets out of your source code entirely -- the code just
# asks the environment for a value, and never contains the value itself.
load_dotenv()


def check_key_present(name: str) -> str | None:
    value = os.getenv(name)
    if not value:
        print(f"[MISSING] {name} is empty in your .env file")
        return None
    print(f"[OK]      {name} is set")
    return value


def test_weather_api(api_key: str) -> None:
    """A cheap, real call to confirm the key is valid: current weather for Skardu."""
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q": "Skardu,PK", "appid": api_key, "units": "metric"}
    resp = requests.get(url, params=params, timeout=10)

    if resp.status_code == 200:
        data = resp.json()
        temp = data["main"]["temp"]
        print(f"[OK]      Weather API responded -- Skardu is currently {temp}°C")
    else:
        print(f"[FAILED]  Weather API returned status {resp.status_code}: {resp.text[:150]}")


def test_news_api(api_key: str) -> None:
    """A cheap, real call: search for one recent hazard-related headline."""
    url = "https://newsapi.org/v2/everything"
    params = {"q": "landslide Pakistan", "pageSize": 1, "apiKey": api_key}
    resp = requests.get(url, params=params, timeout=10)

    if resp.status_code == 200:
        data = resp.json()
        count = data.get("totalResults", 0)
        print(f"[OK]      News API responded -- found {count} matching articles")
    else:
        print(f"[FAILED]  News API returned status {resp.status_code}: {resp.text[:150]}")


def test_twitter_api(bearer_token: str) -> None:
    """
    A cheap, real call: recent search for one hazard-related term.

    NOTE: Twitter/X's search endpoints run on a pay-per-use credit model.
    A 402 here means your key is VALID and authenticating correctly --
    you're just out of credits. This is expected on the free tier and is
    NOT a bug. Twitter is treated as optional/deferred for this prototype;
    NewsAPI is the primary hazard-signal source.
    """
    url = "https://api.twitter.com/2/tweets/search/recent"
    headers = {"Authorization": f"Bearer {bearer_token}"}
    params = {"query": "landslide Pakistan", "max_results": 10}
    resp = requests.get(url, headers=headers, params=params, timeout=10)

    if resp.status_code == 200:
        data = resp.json()
        count = len(data.get("data", []))
        print(f"[OK]      Twitter API responded -- fetched {count} recent tweets")
    elif resp.status_code == 429:
        print("[WARNING] Twitter API rate-limited (this is common on the free tier -- key still works)")
    elif resp.status_code == 402:
        print("[DEFERRED] Twitter API credits depleted -- key is valid, but X's free tier has no")
        print("           search credits left. Treated as optional for this prototype; using")
        print("           NewsAPI as the primary hazard-signal source instead.")
    else:
        print(f"[FAILED]  Twitter API returned status {resp.status_code}: {resp.text[:150]}")


def main():
    print("--- Checking .env values are present ---")
    weather_key = check_key_present("WEATHER_API_KEY")
    news_key = check_key_present("NEWS_API_KEY")
    twitter_token = check_key_present("TWITTER_BEARER_TOKEN")

    print("\n--- Testing each API with a real request ---")
    if weather_key:
        test_weather_api(weather_key)
    if news_key:
        test_news_api(news_key)
    if twitter_token:
        test_twitter_api(twitter_token)


if __name__ == "__main__":
    main()