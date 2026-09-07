# RouteLink AI/ML — Full Verification Checklist

Run every command from the `ml-pipeline/` root, with your venv activated
(`.venv\Scripts\activate` on Windows). Run them in this order.

---

## 1. Data pipeline

```
python scripts/load_destinations.py
```
**Expect:** "Loaded 69 destinations across 16 categories" (or similar), 0 missing values, saves to `data/processed/destinations_clean.csv`. No traceback.

```
python scripts/load_ratings.py
```
**Expect:** "Reshaped into 125582 (user, category, rating) rows" (or similar), saves `data/processed/ratings_long.csv`. No traceback.

---

## 2. Recommender

```
python scripts/content_recommender.py
```
**Expect:** Three sections print — "More like this" for Hunza Valley, preference-based results for lakes/meadows, and mosques/historical. All results should be real destination names with sensible similarity scores between 0–1.

---

## 3. Weather scheduler

```
python scripts/weather_scheduler.py
```
**Expect:** Two tables — a daily summary and an intraday (heat + weather aware) breakdown for Hunza. If `WEATHER_API_KEY` is set in `.env`, this uses live data; otherwise a mock week. No traceback.

To test a different city:
```
python -c "from scripts.weather_scheduler import main; main(city='Naran')"
```

---

## 4. Hazard classifier

```
python scripts/hazard_classifier.py
```
**Expect:** "Combined training set: 7644 total examples", accuracy around 0.81, and in the final predictions section:
```
[HAZARD] Road blocked near Chilas due to sudden landslide
[not hazard] Had a wonderful time hiking in Fairy Meadows today
[not hazard] Hunza Valley apricot festival draws record crowds
[HAZARD] Khunjerab Pass closed due to heavy snowfall
```
If any of these four flip to the wrong label, something regressed — stop and investigate before continuing.

**Direct sanity check** (catches the "Lovely weather today" issue specifically):
```
python -c "from scripts.hazard_classifier import predict_hazard; [print(r) for r in predict_hazard(['Lovely weather today', 'Landslide blocks Karakoram Highway near Chilas'])]"
```
**Expect:** first result `is_hazard: False`, second `is_hazard: True`.

---

## 5. Hazard news scraper (full pipeline)

```
python scripts/hazard_news_scraper.py
```
**Expect:** query totals printed, RSS feed status printed, "Keyword gate: kept X of Y articles", a table of classified hazard articles, then either real POST results (if `ML_SERVICE_KEY` + `API_BASE_URL` are set and Backend's server is running) or a clearly labeled DRY RUN payload printout. No traceback.

---

## 6. Full FastAPI service — all 5 endpoints

Start the service in one terminal:
```
uvicorn app:app --reload
```
Then, in a second terminal, hit each endpoint:

```
curl http://localhost:8000/health
```
**Expect:** `{"status":"ok","service":"RouteLink ML Pipeline"}`

```
curl -X POST http://localhost:8000/api/recommend/preferences -H "Content-Type: application/json" -d "{\"categories\": [\"lake\", \"meadow\"], \"top_n\": 3}"
```
**Expect:** a JSON list of 3 destinations with `match_score`.

```
curl -X POST "http://localhost:8000/api/recommend/similar/Hunza%20Valley?top_n=3"
```
**Expect:** a JSON list of 3 similar destinations.

```
curl -X POST "http://localhost:8000/api/recommend/similar/NotARealPlace"
```
**Expect:** HTTP 404, not a 500 crash.

```
curl -X POST http://localhost:8000/api/schedule/intraday -H "Content-Type: application/json" -d "{\"city\": \"Hunza\"}"
```
**Expect:** a JSON list of time-slot rows with `slot_type`, `heat_tier`, `suggestion`.

```
curl -X POST http://localhost:8000/api/predict/hazard -H "Content-Type: application/json" -d "{\"texts\": [\"Landslide near Chilas\", \"Lovely weather today\"]}"
```
**Expect:** first `is_hazard: true`, second `is_hazard: false`.

---

## If everything above matches "Expect" — the AI/ML pipeline is genuinely verified end to end, safe to report as done to the team.
