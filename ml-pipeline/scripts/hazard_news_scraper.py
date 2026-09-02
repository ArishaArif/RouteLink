"""
hazard_news_scraper.py
------------------------
Day 3: pull real news headlines, classify each one with the trained
hazard model, and figure out WHICH destination(s) each hazard report is
actually about (location extraction).

Run: python scripts/hazard_news_scraper.py
"""

import os
import re
import requests
import feedparser
import pandas as pd
import joblib
from dotenv import load_dotenv

load_dotenv()

DESTINATIONS_PATH = "data/processed/destinations_clean.csv"
MODEL_PATH = "models/hazard_classifier.joblib"
VECTORIZER_PATH = "models/hazard_vectorizer.joblib"
OUTPUT_PATH = "data/processed/hazard_alerts.csv"

# We tried NewsAPI's AND/OR/quoted-phrase boolean syntax and confirmed
# (empirically, via totalResults counts) that it's NOT being honored on
# this plan -- it silently falls back to loose "matches any word"
# relevance search. Rather than fight the API's query parser, we query
# with simple, individual terms (which reliably surfaces real hazard
# articles, proven in the very first run) and let OUR OWN keyword gate
# below do the actual precision filtering in code, where we have full
# control and can verify it's correct (see passes_keyword_gate).
SEARCH_QUERIES = ["landslide Pakistan", "flood Pakistan", "avalanche Pakistan",
                   "road closed Pakistan", "heavy snowfall Pakistan"]

# Domain restriction to Dawn/Tribune/Geo/etc. returned ZERO results even
# before adding any query terms -- meaning these Pakistani regional
# outlets likely aren't in NewsAPI's indexed source list at all on this
# plan. This is a real coverage limitation, not a bug -- dropped for now.

# A hard keyword gate applied BEFORE the ML classifier even runs. This
# catches what a loose search still lets through: an article can mention
# "Pakistan" and "flood" separately in unrelated sentences and still not
# actually be a hazard report. Requiring an explicit hazard word AND a
# Pakistan/region mention in the SAME text is a cheap, high-precision
# filter -- most of yesterday's junk (crime stories, elections, sports)
# would never pass this, regardless of what the ML model thinks.
HAZARD_KEYWORDS = ["landslide", "flood", "avalanche", "road closed", "road blocked",
                   "snowfall", "glacier", "blocked", "closure", "stranded", "rescue"]

# Northern Pakistan tourism provinces -- where hazard/rerouting logic
# actually matters for this app (per the problem statement). Punjab/
# Sindh/Balochistan destinations exist in the catalog but aren't part of
# the mountain-hazard use case, so they're deliberately excluded here.
NORTHERN_PROVINCES = ["Gilgit-Baltistan", "Khyber Pakhtunkhwa", "Azad Kashmir"]

# Direct RSS feeds from Pakistani outlets -- this is the actual fix for
# the "coverage gap" problem. NewsAPI's /everything endpoint only indexes
# a curated global source list, which is why domain-restricting to these
# exact outlets returned ZERO results earlier -- they're likely not in
# that index at all. Their own RSS feeds are free, public, unlimited, and
# carry genuinely local coverage that never gets picked up internationally
# (a routine Karakoram Highway closure won't make CNN, but it WILL be on
# Dawn's own Pakistan feed).
RSS_FEEDS = {
    "Dawn": "https://www.dawn.com/feeds/pakistan",
    "Tribune": "https://tribune.com.pk/feed/pakistan",
}


def fetch_rss_articles() -> pd.DataFrame:
    """
    Pull recent articles directly from Pakistani news RSS feeds, in the
    same (title, description, source, published_at, url) shape as
    fetch_news(), so both sources can flow through the same gate +
    classifier + location pipeline without special-casing.
    """
    rows = []
    for source_name, feed_url in RSS_FEEDS.items():
        feed = feedparser.parse(feed_url)
        if feed.bozo:  # feedparser's flag for "this didn't parse cleanly"
            print(f"[{source_name}] RSS feed had a parsing issue: {feed.bozo_exception}")
        for entry in feed.entries:
            rows.append({
                "title": entry.get("title", ""),
                "description": entry.get("summary", "") or "",
                "source": source_name,
                "published_at": entry.get("published", ""),
                "url": entry.get("link", ""),
            })
        print(f"[{source_name} RSS] fetched {len(feed.entries)} entries")

    df = pd.DataFrame(rows, columns=["title", "description", "source", "published_at", "url"])
    return df


def build_region_keywords(destinations_df: pd.DataFrame) -> list:
    """
    Rather than hand-maintaining a small, easily-stale list of place
    names, derive region keywords directly from the destination catalog:
    every destination NAME in a northern province, plus the province
    names themselves. This scales automatically as the catalog grows --
    add a new destination to Tourist_Destinations.csv and it's
    automatically recognized here too, no code change needed.
    """
    northern = destinations_df[destinations_df["province"].isin(NORTHERN_PROVINCES)]
    name_keywords = [n.lower() for n in northern["name"].tolist()]
    province_keywords = [p.lower() for p in NORTHERN_PROVINCES]
    # Include alias names too (e.g. "naran" isn't a catalog name -- the
    # catalog only has "Kiwai Kaghan" -- but it's a real place people
    # search/write about, and DESTINATION_ALIASES already tracks this
    # mapping for location-matching; reusing it here keeps both systems
    # in sync instead of maintaining two separate place-name lists.
    alias_keywords = list(DESTINATION_ALIASES.keys())
    broad_terms = ["pakistan", "karakoram", "himalaya"]
    return list(dict.fromkeys(name_keywords + province_keywords + alias_keywords + broad_terms))

# News articles use colloquial/common place names that don't always match
# your catalog's exact naming (e.g. "Naran" and "Babusar Top" are common
# real-world names, but the dataset only has "Kiwai Kaghan" for that
# region). Exact string matching against destination names alone silently
# misses these -- this alias table maps the common news-language name to
# the catalog entry it should count as a match for.
DESTINATION_ALIASES = {
    "naran": "Kiwai Kaghan",
    "kaghan valley": "Kiwai Kaghan",
    "kaghan": "Kiwai Kaghan",
    "babusar top": "Kiwai Kaghan",
    "babusar pass": "Kiwai Kaghan",
    "murree": "Bhurban",
    "gilgit city": "Gilgit-Baltistan",
    "hunza": "Hunza Valley",
}


def passes_keyword_gate(text: str, region_keywords: list) -> bool:
    text = text.lower()
    has_hazard_word = any(kw in text for kw in HAZARD_KEYWORDS)
    has_region_word = any(kw in text for kw in region_keywords)
    return has_hazard_word and has_region_word


def fetch_news(api_key: str) -> pd.DataFrame:
    """
    Query NewsAPI with several simple, individual terms (proven to
    surface real results) and combine + de-dupe. Precision filtering
    happens afterward via passes_keyword_gate, not via the API's query syntax.
    """
    url = "https://newsapi.org/v2/everything"
    all_articles = []

    for query in SEARCH_QUERIES:
        params = {"q": query, "language": "en", "sortBy": "publishedAt",
                  "pageSize": 20, "apiKey": api_key}
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()

        # NewsAPI can return HTTP 200 with {"status": "error", ...} in the
        # body -- checking only the HTTP status code would miss this.
        if data.get("status") != "ok":
            print(f"[{query!r}] NewsAPI error: {data.get('code')} -- {data.get('message')}")
            continue

        print(f"[{query!r}] totalResults: {data.get('totalResults', 0)}")
        for a in data.get("articles", []):
            all_articles.append({
                "title": a.get("title", ""),
                "description": a.get("description", "") or "",
                "source": a.get("source", {}).get("name", ""),
                "published_at": a.get("publishedAt", ""),
                "url": a.get("url", ""),
            })

    # Explicit columns even when all_articles is empty -- otherwise
    # pd.DataFrame([]) has NO columns at all, and every downstream
    # df["title"] crashes with a confusing KeyError instead of a clear
    # "0 articles found" message.
    df = pd.DataFrame(all_articles, columns=["title", "description", "source", "published_at", "url"])
    df = df.drop_duplicates(subset="url").reset_index(drop=True)
    print(f"Fetched {len(df)} unique articles across {len(SEARCH_QUERIES)} queries")
    return df


def fetch_news_mock() -> pd.DataFrame:
    """
    Offline fallback -- NewsAPI isn't reachable from this sandbox. Includes
    a mix of real hazard reports AND realistic noise (crime/sports/politics
    articles that mention Pakistan in passing) -- exactly the kind of junk
    that showed up in the real run, so we can verify the keyword gate
    actually filters it out before it ever reaches the ML model.
    """
    mock_articles = [
        {"title": "Landslide blocks Karakoram Highway near Chilas",
         "description": "Heavy rain triggered a landslide, cutting off the route to Skardu.",
         "source": "Dawn News", "published_at": "2026-08-30T10:00:00Z", "url": "https://example.com/1"},
        {"title": "Flash floods reported near Naran bazaar",
         "description": "Tourists advised to avoid Kaghan Valley and Babusar Top until further notice.",
         "source": "Geo News", "published_at": "2026-08-30T09:00:00Z", "url": "https://example.com/2"},
        {"title": "Hunza Valley apricot festival draws record crowds",
         "description": "Local vendors report a booming tourist season in Hunza this year.",
         "source": "The News", "published_at": "2026-08-29T14:00:00Z", "url": "https://example.com/3"},
        {"title": "Khunjerab Pass closed due to heavy snowfall",
         "description": "Authorities shut the border crossing until conditions improve.",
         "source": "Dawn News", "published_at": "2026-08-29T08:00:00Z", "url": "https://example.com/4"},
        {"title": "New restaurant opens in Skardu city center",
         "description": "A popular local chef expands to a second location.",
         "source": "Local Times", "published_at": "2026-08-28T12:00:00Z", "url": "https://example.com/5"},
        {"title": "Man sentenced 20 yrs RI for raping 12 year old",
         "description": "A court in Punjab handed down the sentence Tuesday.",
         "source": "The Times of India", "published_at": "2026-08-28T09:00:00Z", "url": "https://example.com/6"},
        {"title": "Kazakhstan to replace Singapore at women's Asian hockey c'ship in Bhopal",
         "description": "The Asian Hockey Federation confirmed the change on Monday.",
         "source": "The Times of India", "published_at": "2026-08-27T09:00:00Z", "url": "https://example.com/7"},
    ]
    df = pd.DataFrame(mock_articles)
    print(f"Using {len(df)} MOCK articles (no NEWS_API_KEY / offline demo)")
    return df


def classify_articles(df: pd.DataFrame, hazard_threshold: float = 0.35) -> pd.DataFrame:
    """
    Apply the Day-1 trained classifier to each article's title+description.
    Loading the saved model/vectorizer means we don't retrain on every
    run -- training happens once (hazard_classifier.py), inference
    happens here, as many times as needed.

    hazard_threshold defaults to 0.35, not the usual 0.5. Tested against
    the held-out test set: at 0.5, the model misses 31% of real hazards
    (recall 0.69) to keep precision high; at 0.35, recall rises to 0.83
    (catches far more real hazards) while precision only drops to 0.71.
    For a safety app, a missed landslide warning is worse than one extra
    false alert, so recall is the metric worth protecting here.
    """
    model = joblib.load(MODEL_PATH)
    vectorizer = joblib.load(VECTORIZER_PATH)

    df = df.copy()
    combined_text = df["title"] + " " + df["description"]
    X = vectorizer.transform(combined_text)

    # predict_proba gives a confidence score, not just a hard 0/1 label --
    # this is what lets us choose our OWN threshold instead of accepting
    # the model's default 0.5 cutoff.
    df["hazard_confidence"] = model.predict_proba(X)[:, 1].round(3)
    df["is_hazard"] = (df["hazard_confidence"] >= hazard_threshold).astype(int)

    return df


def extract_locations(df: pd.DataFrame, destinations_df: pd.DataFrame) -> pd.DataFrame:
    """
    Location extraction via two passes:
      1. Direct match against known destination names (exact catalog names).
      2. Alias match -- catches common news-language place names (like
         "Naran") that map to a differently-named catalog entry (like
         "Kiwai Kaghan"), via DESTINATION_ALIASES.

    Still not a trained NER model -- deliberately not one, since matching
    against our own closed catalog (+ known aliases) is simpler and more
    precise than a general-purpose place-name extractor would be here.
    """
    df = df.copy()
    combined_text = (df["title"] + " " + df["description"]).str.lower()

    destination_names = destinations_df["name"].tolist()

    def find_matches(text: str) -> str:
        direct_matches = [name for name in destination_names if name.lower() in text]

        alias_matches = [
            catalog_name for alias, catalog_name in DESTINATION_ALIASES.items()
            if alias in text
        ]

        # dict.fromkeys() de-dupes while preserving order -- multiple
        # aliases (e.g. "Naran" AND "Kaghan Valley" AND "Babusar Top" all
        # appearing in one article) can point to the SAME catalog entry
        # ("Kiwai Kaghan"), and a plain list would list it once per alias.
        all_matches = list(dict.fromkeys(direct_matches + alias_matches))
        return ", ".join(all_matches) if all_matches else ""

    df["matched_destinations"] = combined_text.apply(find_matches)
    return df


def main():
    api_key = os.getenv("NEWS_API_KEY")
    destinations_df = pd.read_csv(DESTINATIONS_PATH)

    if api_key:
        newsapi_df = fetch_news(api_key)
    else:
        print("--- No NEWS_API_KEY found -- using MOCK articles for demonstration ---")
        newsapi_df = fetch_news_mock()

    rss_df = fetch_rss_articles()

    # Combine both sources -- RSS specifically targets the coverage gap
    # NewsAPI can't fill (genuinely local news that never goes global),
    # while NewsAPI still adds breadth from other sources. De-dupe by URL
    # in case the same story gets picked up by both.
    articles_df = pd.concat([newsapi_df, rss_df], ignore_index=True)
    articles_df = articles_df.drop_duplicates(subset="url").reset_index(drop=True)
    print(f"Combined pool: {len(articles_df)} unique articles (NewsAPI + RSS)")

    # Gate BEFORE classification: cheap, transparent, and catches most
    # off-topic noise (crime, sports, politics) regardless of what the
    # ML model would have guessed. The model only ever sees articles that
    # already look plausibly relevant -- it's refining, not filtering from scratch.
    if len(articles_df) == 0:
        print("No articles fetched at all -- check your NEWS_API_KEY / query.")
        return

    combined_text = articles_df["title"] + " " + articles_df["description"]
    region_keywords = build_region_keywords(destinations_df)
    print(f"Region gate built from catalog: {len(region_keywords)} place/region terms")
    gate_mask = combined_text.apply(lambda t: passes_keyword_gate(t, region_keywords))
    dropped = len(articles_df) - gate_mask.sum()
    print(f"Keyword gate: kept {gate_mask.sum()} of {len(articles_df)} articles "
          f"({dropped} dropped as off-topic before classification)")

    if gate_mask.sum() == 0:
        print("\nGate rejected everything -- sample of what came back, for debugging:")
        print(articles_df["title"].head(5).to_string(index=False))
        return

    articles_df = articles_df[gate_mask].reset_index(drop=True)

    articles_df = classify_articles(articles_df)
    articles_df = extract_locations(articles_df, destinations_df)

    hazard_alerts = articles_df[articles_df["is_hazard"] == 1].copy()

    print(f"\n{len(hazard_alerts)} of {len(articles_df)} gated articles classified as real hazards\n")
    display_cols = ["title", "hazard_confidence", "matched_destinations", "source"]
    print(articles_df[display_cols + ["is_hazard"]].to_string(index=False))

    hazard_alerts[display_cols + ["published_at", "url"]].to_csv(OUTPUT_PATH, index=False)
    print(f"\nSaved {len(hazard_alerts)} hazard alerts to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()