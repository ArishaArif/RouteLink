# RouteLink

An AI-powered travel planning and hazard-detection application built to tackle safety challenges for domestic tourists, specifically focusing on Northern Pakistan. The main features include weather-integrated itinerary scheduling, real-time hazard alerts powered by natural language processing (NLP), and a geolocation-based SOS tool.

## 🗂️ Project Structure

```text
├── backend/                        # Node.js + Express API
│   ├── config/
│   │   └── database.js             # Sequelize/Postgres connection setup
│   ├── models/
│   │   ├── User.js                 # Traveler/guide account + ML-facing preferences
│   │   ├── Trip.js                 # A traveler's trip (destination, dates, status)
│   │   ├── Itinerary.js            # One row per day of a Trip + heat/slot scheduling fields
│   │   ├── Guide.js                # Guide profile (extends a User)
│   │   ├── Booking.js              # Links Trip + Guide + User
│   │   ├── HazardAlert.js          # Region-based alerts fed by the NLP pipeline
│   │   └── index.js                # Model loader + all associations
│   ├── middleware/
│   │   ├── auth.js                 # requireAuth / optionalAuth / requireAuthOrService / requireRole
│   │   └── ingestAuth.js           # X-Ingest-Key verification for trusted services
│   ├── routes/                     # Express routers
│   │   ├── auth.js  trips.js  guides.js  bookings.js  hazards.js
│   ├── controllers/                # Route handler logic
│   │   ├── authController.js       # signup / login
│   │   ├── tripController.js       # trip CRUD
│   │   ├── itineraryController.js  # itinerary read/write + marketplace hand-off
│   │   ├── guideController.js      # guide marketplace
│   │   ├── bookingController.js    # bookings + status transitions
│   │   └── hazardController.js     # NLP alert ingest + public feed
│   ├── scripts/
│   │   ├── db-sync.js              # npm run db:sync
│   │   ├── db-migrate-day3.js      # enum backfill migration
│   │   ├── db-migrate-day4.js      # itinerary schema migration (slot/heat tier, marketplace fields)
│   │   ├── smoke-test.js           # npm run smoke
│   │   ├── smoke-day3.js           # npm run smoke:day3
│   │   └── smoke-day4.js           # npm run smoke:day4
│   ├── utils/
│   │   ├── jwt.js                  # signToken / verifyToken
│   │   ├── validate.js             # shared request validators
│   │   ├── numeric.js              # DECIMAL -> number getters
│   │   └── itineraryContract.js    # heat tier / slot type vocab + snake_case normalization
│   ├── server.js                   # App entry point + /health route
│   ├── API_CONTRACT.md             # Cross-team contract (ML + Mobile) — read this first
│   ├── QA_FINDINGS.md              # Integration test findings
│   ├── SOS_DECISION.md             # SOS data-source decision (endpoint not yet built)
│   ├── .env.example
│   └── package.json
├── ml-pipeline/                    # Python AI/ML pipeline (hazard NLP, recommender data prep)
|   |── data/
│   |  ├── raw/                     # Untouched source datasets (gitignored)
│   |  └── processed/               # Cleaned data the models train/run on (gitignored)
|   ├── models/                     # Saved trained model + vectorizer (.joblib, gitignored)
|   ├── scripts/
│   |   ├── load_destinations.py    # Clean + tag the destination catalog
│   |   ├── load_ratings.py         # Reshape Google review ratings into long format
│   |   ├── content_recommender.py  # TF-IDF + cosine similarity recommender
│   |   ├── weather_scheduler.py    # Heat/weather-aware intraday scheduling + itinerary push
│   |   ├── hazard_keywords.py      # Shared hazard keyword list (classifier + scraper)
│   |   ├── hazard_classifier.py    # Trains + persists the hazard NLP model
│   |   ├── hazard_news_scraper.py  # Live news/RSS ingest -> classify -> push to Backend
|   |   ├── verify_api_keys.py      #Sanity check that .env file is set up correctly
|   |   └── wikimedia_photo_lookup.py# Downloads + caches one photo per destination locally
|   ├── app.py                      # FastAPI microservice wrapping the above
|   ├── VERIFICATION_CHECKLIST.md   # Step-by-step commands to verify the whole pipeline
|   ├── requirements.txt
|   └── .env.example                # Real secrets (gitignored, never committed)
├── RouteLinkMobile/                # Expo / React Native app
├── .github/workflows/ci.yml
└── README.md
```

## 🔌 Backend API

Base URL: `http://localhost:5000`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | none | Liveness + DB connectivity |
| `POST` | `/api/auth/signup` | none | Create account, returns JWT |
| `POST` | `/api/auth/login` | none | Returns JWT |
| `POST` | `/api/trips` | Bearer | Create trip |
| `GET` | `/api/trips` | Bearer | List own trips (paginated) |
| `GET` | `/api/trips/:id` | Bearer | Read own trip |
| `PATCH` | `/api/trips/:id` | Bearer | Update own trip |
| `DELETE` | `/api/trips/:id` | Bearer | Delete own trip |
| `GET` | `/api/trips/:id/itinerary` | Bearer | Stored itinerary, or generated placeholder days |
| `PUT` | `/api/trips/:id/itinerary` | Bearer **or** `X-Ingest-Key` | Write the generated itinerary |
| `GET` | `/api/guides` | optional | Browse marketplace (filter `region`, `language`) |
| `GET` | `/api/guides/:id` | optional | Single guide profile |
| `POST` | `/api/guides` | Bearer, role `guide` | Create own listing |
| `PATCH` | `/api/guides/:id` | Bearer, owner | Update own listing |
| `POST` | `/api/bookings` | Bearer | Request a guide for a trip |
| `GET` | `/api/bookings` | Bearer | Bookings where you are traveler or guide |
| `PATCH` | `/api/bookings/:id/status` | Bearer, guide/admin | Confirm / cancel / complete |
| `POST` | `/api/hazards` | `X-Ingest-Key` | NLP pipeline ingest (strict, deduped) |
| `GET` | `/api/hazards` | none | Public alert feed (filter `region`) |

`optional` auth means the route is public, but sending a valid token unlocks
owner-only fields (a guide sees their own phone number, an anonymous caller does not).

**Cross-team field shapes, the heat-tier/slot-type vocabulary and the
`needsMarketplaceData` hand-off rule live in [`backend/API_CONTRACT.md`](backend/API_CONTRACT.md).**
Read that before integrating from the ML pipeline or the mobile app.

## 🚀 Local Setup & Installation

### Prerequisites

- Node.js 18+
- PostgreSQL server running locally

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your local env file:
   ```bash
   cp .env.example .env
   # then fill in DB_USER / DB_PASSWORD / JWT_SECRET / ML_SERVICE_KEY
   ```
4. Create the Postgres database. **The name must match `DB_NAME` in your `.env`** —
   `.env.example` ships with `DB_NAME=Routelink`:
   ```bash
   createdb Routelink
   ```
5. Sync models → tables, then apply the Day 3/4 migrations:
   ```bash
   npm run db:sync
   node scripts/db-migrate-day3.js
   node scripts/db-migrate-day4.js
   ```
6. Run the server:
   ```bash
   npm run dev        # nodemon, auto-restart
   # or
   npm start
   ```

Confirm it's working:

```bash
curl http://localhost:5000/health
# { "status": "ok", "db": "connected" }
```

### Mobile Setup

1. Navigate to the mobile app directory:
   ```bash
   cd RouteLinkMobile
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your local env file:
   ```bash
   New-Item .env   # Windows PowerShell
   # or: touch .env   # macOS/Linux
   ```
   Add:
   ```
   EXPO_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
   ```
4. Start the app:
   ```bash
   npm start
   ```
5. Open it:
   - Press `a` for Android emulator (requires Android Studio set up)
   - Or scan the QR code with Expo Go on a physical device
   - **Note:** this project uses Expo SDK 57. If Expo Go on your phone shows an "incompatible version" error, the App Store/Play Store build may not have caught up yet — use an Android emulator as a fallback until it does.

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | no | Defaults to `5000` |
| `NODE_ENV` | no | `development` enables SQL logging |
| `DATABASE_URL` | no | If set, overrides the discrete `DB_*` vars |
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | yes | Postgres connection |
| `JWT_SECRET` | yes | Token signing — server throws without it |
| `JWT_EXPIRES_IN` | no | Defaults to `7d` |
| `ML_SERVICE_KEY` | yes | Shared secret for `X-Ingest-Key`. Guards hazard ingest and itinerary writes |
| `HAZARD_INGEST_KEY` | no | Legacy name for the same secret, still honoured as a fallback |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | yes (Mobile) | Mapbox access token for the map screen — see Mobile Setup above |

### Test suites

With the server running:

```bash
npm test           # module + router resolution
npm run smoke      # auth, trips, itinerary placeholder, ownership
npm run smoke:day3 # guides, bookings, hazard ingest
npm run smoke:day4 # itinerary write contract, marketplace hand-off, write auth
```
## ⚠️ Not yet built 
`GET /api/sos/nearest` — the data-source decision is recorded in
[`backend/SOS_DECISION.md`](backend/SOS_DECISION.md), but the endpoint does not exist.
Mobile should not integrate against it yet.

## 📱 RouteLink Mobile

The mobile frontend for **RouteLink**, built with **React Native** and **Expo SDK 52** using TypeScript. This section covers ownership, structure, and setup for the `RouteLinkMobile/` module.

### 🎯 Ownership

As Mobile Lead, this repository module tracks all end-to-end user interfaces, navigation flows, and API integrations across the 6-day sprint:

* **Trip Planning & Itinerary:** Weather-integrated day-by-day scheduler with spot exclusion controls ("Already Visited" / "Interested").
* **Guide Marketplace:** Local guide directory filtering by region, language, and rating with booking request hooks.
* **Safety & Hazard Alerts:** Top-level alert banner rendering real-time NLP-detected hazards.
* **Emergency SOS:** Dedicated geolocation panic interface with direct emergency hotlines (Rescue 1122, Tourist Police).

### 📁 Directory Architecture

```text
RouteLinkMobile/
├── assets/                      # App branding, icons, splash screens, and static images
├── src/
│   ├── components/
│   │   ├── AttractionCard.tsx   # Interactive card rendering spot details & intraday weather
│   │   └── HazardBanner.tsx     # Top-level notification banner for active NLP hazards
│   ├── context/
│   │   └── TripContext.tsx      # Global React Context for itinerary state & preferences
│   ├── screens/
│   │   ├── TripPlannerScreen.tsx      # Destination/duration input & day-by-day scheduler
│   │   ├── GuideMarketplaceScreen.tsx # Regional guide discovery & booking requests
│   │   └── SOSScreen.tsx              # Emergency dispatch screen with GPS coordinates & hotlines
│   ├── services/
│   │   └── api.ts               # Unified Axios/Fetch API client & endpoint definitions
│   └── types/
│       └── index.ts             # TypeScript interfaces (Trips, Hazards, Guides)
├── App.tsx                      # Root navigation tabs (Planner, Guides, SOS)
├── app.json                     # Expo app configuration & metadata
├── index.ts                     # Expo entry point (registerRootComponent)
├── package.json                 # Mobile dependencies & scripts
└── tsconfig.json                # TypeScript configuration
```

### 🚀 Getting Started

**Prerequisites**
- Node.js: v18+
- Package Manager: npm (v9+)
- Expo Go installed on a physical iOS/Android device, OR an Android Studio / iOS Simulator set up locally.

**Local Installation & Running**

1. Navigate to the mobile folder:
   ```bash
   cd RouteLinkMobile
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in `RouteLinkMobile/`:
   ```bash
   # Windows PowerShell
   New-Item .env

   # macOS/Linux
   touch .env
   ```
4. Add required environment keys:
   ```
   EXPO_PUBLIC_API_BASE_URL=http://localhost:5000/api
   EXPO_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
   ```
5. Start the Expo dev server:
   ```bash
   npx expo start
   ```

**Running on Devices / Emulators**
- **Android Emulator:** press `a` in the terminal.
- **iOS Simulator:** press `i` in the terminal (macOS only).
- **Web Preview:** press `w` in the terminal.
- **Physical Device:** scan the terminal QR code with Expo Go (Android) or the default Camera app (iOS).

> **Note on Expo SDK version:** ensure Expo Go on physical hardware matches the SDK version this project targets. If a version-mismatch error occurs, use an Android Emulator as the primary demo target instead.

### 🔌 Integrated Endpoint Contracts (`services/api.ts`)

| Feature | Target Endpoint | Purpose |
| --- | --- | --- |
| Trips | `POST /api/trips` | Save user destination and trip timeline |
| Itinerary | `GET /api/trips/:id/itinerary` | Retrieve generated weather & activity schedule |
| Marketplace | `GET /api/guides` | Fetch available local guides filtered by region |
| Bookings | `POST /api/bookings` | Submit booking request to a guide |
| Hazards | `GET /api/hazards` | Retrieve active NLP-flagged regional hazards |

> **SOS note:** `GET /api/sos/nearest` is not yet built on the backend (see `backend/SOS_DECISION.md`). Do not integrate the SOS screen against it yet.
npm run smoke:day4 # itinerary write contract, marketplace hand-off, write auth
> 
## ML Pipeline
 
The AI/ML core of **RouteLink**: a content-based destination recommender, a
weather- and heat-aware itinerary scheduler, and an NLP hazard-detection
pipeline that scrapes news/RSS, classifies real hazards, and pushes alerts
into the Backend via `POST /api/hazards`.
 
### Ownership
 
This AI/ML module owns:
 
* **Recommendation engine:** content-based filtering (TF-IDF + cosine
  similarity) over the 69-destination catalog, with support for excluding
  already-visited/dismissed spots.
* **Weather-aware scheduling:** intraday (3-hour-slot) recommendations that
  factor in both weather condition *and* heat-tier safety, scoped to
  destinations actually near the requested city.
* **Hazard NLP pipeline:** a trained classifier (Naive Bayes + TF-IDF) that
  flags real hazard reports from live news/RSS text, with location
  extraction against the destination catalog and a keyword gate to filter
  out off-topic noise before classification.
* **FastAPI microservice (`app.py`):** wraps all of the above as callable
  HTTP endpoints for Backend to consume.

### ML Service Endpoints (`app.py`)
 
Runs independently from the Backend Node service, on its own port.
 
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `POST` | `/api/recommend/preferences` | Recommend destinations by preferred categories (+ optional province filter, exclude list) |
| `POST` | `/api/recommend/similar/{dest_name}` | "More like this" recommendations for a given destination |
| `POST` | `/api/schedule/intraday` | Heat/weather-aware time-slot schedule for a city |
| `POST` | `/api/predict/hazard` | Classify a batch of raw text as hazard / not-hazard |
 
**This service's own port is separate from Backend's `:5000`.** `API_BASE_URL`
in `ml-pipeline/.env` points the other way — it's where *this* pipeline sends
hazard alerts *to* (Backend), not where this service itself listens.
 
### Data Sources
 
The destination catalog, rating data, and hazard-classifier training data
are all built from public datasets — not scraped or fabricated:
 
| Dataset | Used for | Source |
| --- | --- | --- |
| Top Tourist Destinations in Pakistan | Destination catalog (69 attractions, categories, coordinates) | [Kaggle](https://www.kaggle.com/datasets/naseeruddin444/top-tourist-destinations-in-pakistan) |
| Travel Review Ratings (UCI) | Collaborative-filtering rating structure (125K+ user–category ratings) | [Kaggle](https://www.kaggle.com/datasets/ishbhms/travel-review-ratings) |
| NLP with Disaster Tweets | Base training data for the hazard classifier (7,613 labeled tweets) | [Kaggle competition](https://www.kaggle.com/competitions/nlp-getting-started) |
 
The hazard classifier is further fine-tuned on a small hand-labeled set of
Pakistan-specific examples (`data/raw/pakistan_hazard_examples.csv`) to
correct for the base dataset's generic/global vocabulary.
 
### Destination Photos
 
`wikimedia_photo_lookup.py` looks up one photo per destination from
Wikipedia/Wikimedia and **downloads it locally** — the app serves images
from disk instead of hitting Wikimedia on every request, avoiding rate
limits and giving Mobile/Frontend fast, reliable image loads.
 
```bash
python scripts/wikimedia_photo_lookup.py
```
 
**Outputs:**
- `data/processed/destination_images/` — the downloaded image files
- `data/processed/destination_photos.csv` — maps each destination name to
  its local image path, plus `source` (`wikipedia_exact` / `category_fallback`
  / `none`) so it's clear which photos are an exact match vs. a generic
  category placeholder (e.g. a generic "Lake" photo when no exact photo
  exists for that specific destination).
This is a one-time (resumable) data-prep step, not something that runs at
request time — it's deliberately slow (rate-limited to be a respectful
Wikimedia API citizen) and safe to re-run, since it skips any destination
that already has a local image.
 
### Local Setup & Installation
 
**Prerequisites**
- Python 3.11+
1. Navigate to the ML pipeline directory:
```bash
   cd ml-pipeline
```
2. Create and activate a virtual environment:
```bash
   python3 -m venv .venv
   source .venv/bin/activate      # macOS/Linux
   .venv\Scripts\activate         # Windows
```
3. Install dependencies:
```bash
   pip install -r requirements.txt
```
4. Create your local env file:
```bash
   cp .env.example .env
   # then fill in WEATHER_API_KEY / NEWS_API_KEY / ML_SERVICE_KEY
```
5. Build the processed data + train the hazard model (first-time setup):
```bash
   python scripts/load_destinations.py
   python scripts/load_ratings.py
   python scripts/hazard_classifier.py
```
6. Run the ML microservice:
```bash
   uvicorn app:app --reload
```
 
Confirm it's working:
 
```bash
curl http://localhost:8000/health
# {"status":"ok","service":"RouteLink ML Pipeline"}
```
 
### Environment variables
 
| Variable | Required | Notes |
| --- | --- | --- |
| `WEATHER_API_KEY` | yes | OpenWeatherMap — live forecasts for scheduling |
| `NEWS_API_KEY` | yes | NewsAPI.org — hazard news search |
| `TWITTER_BEARER_TOKEN` `TWITTER_API_KEY` `TWITTER_API_SECRET` | no | Deferred this sprint — X's free tier has no search credits. Kept wired for later. |
| `API_BASE_URL` | yes | Backend's URL, e.g. `http://localhost:5000` — where hazard alerts get POSTed *to* |
| `ML_SERVICE_KEY` | yes | Shared secret sent as `X-Ingest-Key` when pushing to Backend — must match Backend's own `ML_SERVICE_KEY` |
| `ML_SERVICE_PORT` | no | Defaults to `8000` |
 
### Running the hazard pipeline
 
```bash
python scripts/hazard_news_scraper.py
```
 
Fetches live news + RSS, gates on hazard/region keywords, classifies with
the trained model, extracts destination matches, and pushes results to
Backend's `POST /api/hazards` (or prints a dry-run payload if
`ML_SERVICE_KEY`/`API_BASE_URL` aren't set).
 
### Verifying everything works
 
**See [`ml-pipeline/VERIFICATION_CHECKLIST.md`](ml-pipeline/VERIFICATION_CHECKLIST.md)**
for the full command-by-command checklist covering data loading, the
recommender, the scheduler, the hazard classifier, the news scraper, and
all 5 FastAPI endpoints — with expected output for each, so a fresh
clone can be confirmed working end to end before a demo.
 
 
