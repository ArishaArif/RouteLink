## Confirmed working end-to-end

- Signup → creates user, returns JWT token
- Login → returns JWT token
- Create Trip (correct field names + Bearer token) → creates real trip in DB
- `npm run smoke` — 43 checks
- `npm run smoke:day3` — guides, bookings, chat, hazard ingest
- `npm run smoke:day4` — itinerary contract, marketplace hand-off, write auth

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
