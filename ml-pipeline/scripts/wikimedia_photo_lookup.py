import requests

HEADERS = {
    "User-Agent": "RouteLinkApp/1.0 (Hackathon project; contact: your-email@example.com)"
}

def find_best_page_title(place_name: str) -> str | None:
    """
    Search Wikipedia for the best matching page title, rather than
    guessing the exact title ourselves (handles ambiguous short names
    like "Naran" which might not be an exact page title on its own).
    """
    search_url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "list": "search",
        "srsearch": f"{place_name} Pakistan",
        "format": "json",
        "srlimit": 1,
    }
    response = requests.get(search_url, headers=HEADERS, params=params, timeout=10)
    data = response.json()
    results = data.get("query", {}).get("search", [])
    if not results:
        return None
    return results[0]["title"]


def get_photo_url(place_name: str) -> str | None:
    best_title = find_best_page_title(place_name)
    if not best_title:
        return None

    formatted_title = best_title.replace(" ", "_")
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{formatted_title}"
    response = requests.get(url, headers=HEADERS, timeout=10)

    if response.status_code != 200:
        return None

    data = response.json()
    if "originalimage" in data:
        return data["originalimage"]["source"]
    return None


test_places = ["Hunza Valley", "Skardu", "Attabad Lake", "Naran", "Fairy Meadows"]

for place in test_places:
    photo = get_photo_url(place)
    print(f"{place}: {photo if photo else 'NO IMAGE FOUND'}")