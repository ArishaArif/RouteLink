## Confirmed working end-to-end

- Signup → creates user, returns JWT token
- Login → returns JWT token
- Create Trip (correct field names + Bearer token) → creates real trip in DB
- `npm run smoke` — 43 checks
- `npm run smoke:day3` — guides, bookings, chat, hazard ingest
- `npm run smoke:day4` — itinerary contract, marketplace hand-off, write auth
- `npm run smoke:integration` — security headers, hazard aliases, guide-side bookings, SOS, rate limits

**214 checks, 0 failures** as of 2026-09-02, against live Postgres.

> Note: this file previously carried the Day 2/3 and Day 4 "Fixed" sections, an API
> contract mismatch log, a Routes section and an open-questions list. Those were lost
> from the working tree and were never committed, so git cannot restore them. Ask
> Backend before assuming a past finding was resolved.

## Feature freeze / integration session (2026-09-02)

### Already done before this session — brief was stale

- **Ingest-key auth on `POST /api/hazards` was already built** (`middleware/ingestAuth.js`,
  timing-safe compare on `X-Ingest-Key`). `GET /api/hazards` is public, as intended.
- **`GET /api/bookings` already returned guide-side bookings** via `Op.or` on the caller's
  own listing, with a `viewerRole` per row. `PATCH /api/bookings/:id/status` was therefore
  already reachable for guides — now proven by test, including the traveler `403`.

### Fixed this session

- **Marketplace results were ordered by `Guide.rating`.** Every rating is `0.0` (no review
  system), so the sort was meaningless but read as quality ranking. Now ordered by
  `pricePerDay` then `createdAt`, with the reason recorded at the query.
- **Enrichment had no mock/real seam.** `attachMarketplace` lived inline in
  `controllers/itineraryController.js`. Extracted to `services/itineraryEnricher.js` and the
  AI/ML fetch isolated in `services/itinerarySource.js` — see `API_CONTRACT.md` §17.

### Added this session

- `helmet()` globally; rate limiting on `POST /api/auth/login` and `POST /api/hazards`
  (`middleware/rateLimit.js`). Limiter runs **before** the ingest-key check so the endpoint
  cannot be used to probe keys for free. Defaults are generous enough to run all suites
  repeatedly — tighten for production. §16.
- Hazard type alias mapping — 37 AI/ML labels (`flood`, `landslide`, `roadblock`, `glof`, …)
  map onto the six canonical enum values, case- and separator-insensitive. Unknown labels
  still `400`, and the error lists every alias. Response carries `hazardTypeMappedFrom`. §15.
- `POST /api/sos` and `GET /api/sos/nearest`, both against a mocked provider. §14.

### Open questions for the team

- **An SOS is not recorded anywhere.** `POST /api/sos` returns `persisted: false` — there is
  no `SosEvent` model and no audit trail, so if a traveler triggers an SOS and closes the
  app, no trace exists. Fine for the demo; needs a decision before it is more than that.
- **SOS requires a valid JWT.** That means it fails exactly when a token has expired, which
  is a bad property for an emergency endpoint. Left consistent with every other route
  pending a call from the team.
- `PATCH /api/bookings/:id/status` still has **no transition guard** — `cancelled` →
  `confirmed` is accepted. Business rule, not a bug; decide the legal transitions before
  enforcing them in code.
- The AI/ML mock is **off by default** (`ITINERARY_ML_MOCK=false`). Turning it on changes
  what `GET /api/trips/:id/itinerary` returns for an unstored trip, which QA's Day 4 suite
  asserts on. Flip it for the demo, not for the frozen contract.

## Expo Go / SDK 57 compatibility issue

Project uses Expo SDK 57 (very recent release). Expo Go's matching version isn't yet
available on Apple App Store (as of Sept 2, still in Apple review). iPhone users get
"incompatible version" error when scanning QR code.

Not a bug in our code, App Store timing issue only. Final built app (via EAS Build)
will run fine on iPhone regardless.

Workarounds for testing during development:
- Use Android phone with direct APK download (expo.dev/go?sdkVersion=57&platform=android&device=true)
- Use Android emulator via Android Studio
- Or wait for Apple review to clear

# QA Findings — Day 2/3 Backend Integration Test

Tested Auth + Trip flow against real backend code (not dummy data).

## Fixed during this session
- `.env` was missing DB connection vars and JWT_SECRET — added and confirmed working
- Database existed but had no tables — ran `node scripts/db-sync.js` to build them from models
- Postman collection had Login/Signup incorrectly set to Bearer Token auth — fixed to No Auth



## MAJOR UPDATE — 2026-09-02: Backend built and tested Guide Marketplace, Bookings, Chat, Hazards, Itinerary

Backend delivered API_CONTRACT.md (source of truth per §13, supersedes hand-written Postman assumptions) plus:
- controllers: bookingController, chatController, guideController, hazardController, itineraryController
- routes: bookings.js, guides.js, hazards.js
- migrations: db-migrate-day3.js (booking enum), db-migrate-day4.js (itinerary schema)
- Two automated smoke test suites: smoke-day3.js, smoke-day4.js

Ran both smoke tests locally against real DB:
- smoke-day3.js (Guides, Bookings, Chat, Hazards): 67 passed, 0 failed
- smoke-day4.js (Itinerary write/read, snake_case↔camelCase, marketplace hand-off): 47 passed, 0 failed
- Total: 114/114 passing, covering happy paths AND permission/validation/edge cases

Postman collection fully rebuilt against API_CONTRACT.md §11/§12 — old collection (6/16 passing) replaced. New collection: 21 requests across Health, Auth, Trips, Guides, Bookings, Hazards. All ids auto-captured via test scripts, no hardcoded UUIDs.

https://fa302518-826692.postman.co/workspace/Faizan-Ahmad's-Workspace~d1686dd6-8901-4e52-8517-04daee985e25/request/57856560-0ec29487-9dae-49b7-9a63-36a6fb65e869?action=share&creator=57856560&ctx=documentation

## No longer open
- ~~Guide Marketplace routes~~ — built and tested
- ~~Hazard Alerts routes~~ — built and tested
- ~~Postman field-name mismatches~~ — fixed via full rebuild

## Live manual verification — 2026-09-02 (post-rebuild)

Walked through the full rebuilt Postman collection live against the running server, all 6 folders:
- Auth: Signup, Login (token auto-capture confirmed working)
- Trips: Create, Get by ID, List (paginated), Get Itinerary (placeholder shape matches §6 exactly), Write Itinerary (owner token) — confirmed needsMarketplaceData auto-flag, real marketplace guide data, replace semantics, camelCase-out
- Guides: List (phone correctly hidden for non-owner), Get by ID
- Bookings: Create (overlap conflict correctly rejected with 409 on first attempt, succeeded on non-conflicting dates), List, Update Status (correctly 403'd for traveler — confirms permission check works, not a bug)
- Chat: Send message (senderId correctly taken from JWT not request body), Get messages (reads back correctly)
- Hazards: Report (ingestKey working), Get active alerts by region

Every response matched API_CONTRACT.md exactly. No discrepancies found between the contract, the smoke tests, and live manual testing. Backend's Day 3/4 build is confirmed solid across three independent verification methods (smoke tests, contract doc, manual QA).

## Still open
- SOS routes (`GET /api/sos/nearest`, `POST /api/sos`) — confirmed NOT built per API_CONTRACT.md §9. POST /api/sos was never even specified — needs a real design conversation, not just implementation.
- Mobile's local types (`RouteLinkMobile/src/types/index.ts`) are out of date vs actual API shapes — full list of mismatches in API_CONTRACT.md §8 (HazardAlert, TripDay, TripItinerary fields all differ from what Mobile currently expects)

## Routes that exist but weren't in original Postman collection
- `GET /api/trips` (List Trips) — added
- `PATCH /api/trips/:id` (Update Trip) — added

## Confirmed working end-to-end
- Signup → creates user, returns JWT token
- Login → returns JWT token
- Create Trip (with correct field names + Bearer token) → creates real trip in DB
- Get Trip by ID → returns correct trip data
- Get Itinerary for Trip → returns full day-by-day placeholder itinerary, clearly labeled "source": "placeholder" and "awaiting AI recommender" — good sign Backend built this to receive AI/ML's real output later
- Update Trip → correctly updates single field, confirms which field changed
- List Trips → returns array with count, correct for the one test trip

Note: Delete Trip not tested yet — intentionally held off since the test trip is still useful as sample data for Mobile (A) while they build screens. Test when ready to clean up.
