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
│   │   ├── ChatMessage.js          # Messages on a Booking thread
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
│   │   ├── chatController.js       # booking message threads
│   │   └── hazardController.js     # NLP alert ingest + public feed
│   ├── scripts/
│   │   ├── db-sync.js              # npm run db:sync
│   │   ├── db-migrate-day3.js      # enum backfill migration
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
| `POST` | `/api/bookings/:id/messages` | Bearer, participant | Send a message |
| `GET` | `/api/bookings/:id/messages` | Bearer, participant | Read the thread |
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
5. Sync models → tables:
   ```bash
   npm run db:sync
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

### Test suites

With the server running:

```bash
npm test           # module + router resolution
npm run smoke      # auth, trips, itinerary placeholder, ownership
npm run smoke:day3 # guides, bookings, chat, hazard ingest
npm run smoke:day4 # itinerary write contract, marketplace hand-off, write auth
```

## ⚠️ Not yet built

`GET /api/sos/nearest` — the data-source decision is recorded in
[`backend/SOS_DECISION.md`](backend/SOS_DECISION.md), but the endpoint does not exist.
Mobile should not integrate against it yet.
