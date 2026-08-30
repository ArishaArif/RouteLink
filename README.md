# RouteLink
An AI-powered travel planning and hazard-detection application built to tackle safety challenges for domestic tourists, specifically focusing on Northern Pakistan. The main features include weather-integrated itinerary scheduling, real-time hazard alerts powered by natural language processing (NLP), and a geolocation-based SOS tool.

## 🗂️ Project Structure

```text
├── backend/                   # Node.js + Express API
│   ├── config/
│   │   └── database.js       # Sequelize/Postgres connection setup
│   ├── models/
│   │   ├── User.js           # Traveler/guide account + ML-facing preferences
│   │   ├── Trip.js           # A traveler's trip (destination, dates, status)
│   │   ├── Itinerary.js      # One row per day of a Trip
│   │   ├── Guide.js          # Guide profile (extends a User)
│   │   ├── Booking.js        # Links Trip + Guide + User
│   │   ├── HazardAlert.js    # Region-based alerts fed by the NLP pipeline
│   │   └── index.js          # Model loader + all associations
│   ├── middleware/
│   │   └── auth.js           # requireAuth / requireRole (JWT verification)
│   ├── routes/                # Express routers (Day 2+, currently empty)
│   ├── controllers/           # Route handler logic (Day 2+, currently empty)
│   ├── scripts/
│   │   └── db-sync.js        # npm run db:sync — syncs models to Postgres
│   ├── utils/
│   │   └── jwt.js            # signToken / verifyToken helpers
│   ├── server.js             # App entry point + /health route
│   ├── .env.example          # Placeholder env values
│   └── package.json
├── README.md
└── .gitignore
```

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
   # then fill in DB_USER / DB_PASSWORD / JWT_SECRET etc.
   ```
4. Create the Postgres database (name must match `DB_NAME` in `.env`):
   ```bash
   createdb routelink_dev
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

