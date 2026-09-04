"""
hazard_keywords.py
--------------------
Shared hazard keyword list used by BOTH hazard_news_scraper.py's
pre-classification gate AND hazard_classifier.py's predict_hazard().
Previously this list only lived inside hazard_news_scraper.py, which
meant the news pipeline had two layers of defense (keyword gate + ML
threshold) but predict_hazard() -- called directly by the /api/predict/hazard
endpoint -- had only one (raw ML confidence). That gap is exactly why
"Lovely weather today" could get flagged as a hazard at 0.359 confidence:
nothing was checking whether the text contained an actual hazard word.

Keeping this list in one file means both callers stay in sync -- add a
keyword here once, both the scraper and the standalone classifier see it,
instead of two lists silently drifting apart over time.
"""

HAZARD_KEYWORDS = ["landslide", "flood", "avalanche", "road closed", "road blocked",
                   "snowfall", "glacier", "blocked", "closure", "stranded", "rescue"]