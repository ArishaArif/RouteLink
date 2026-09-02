# QA Findings — Backend Integration Testing

Tested against real backend code (not dummy data).

## Fixed — Day 2/3 session

- `.env` was missing DB connection vars and `JWT_SECRET` — added and confirmed working
- Database existed but had no tables — ran `node scripts/db-sync.js` to build them from models
- Postman collection had Login/Signup incorrectly set to Bearer Token auth — fixed to No Auth

## Fixed — Day 4 session

- **`npm run smoke:day3` was failing and then crashing.** `POST /api/hazards` gained the
  `X-Ingest-Key` guard (`middleware/ingestAuth.js`) but the smoke script still posted with no
  key, so it got `401` instead of `201`. The run then died in `render()` with
  `Cannot read properties of undefined (reading 'length')` because the step's projector read
  `b.alert` off an error body. Script now sends the key, and `render`/`projectSafely` report a
  failed step instead of taking the whole suite down.
- **The hazard smoke steps were not re-runnable.** They posted a fixed `rawText`, so the
  second run hit the dedupe path and got `200 duplicate` where it expected `201`. Payloads are
  now stamped per run, and the dedupe behaviour has its own explicit test.
- **Guides could never retrieve their own phone number.** `GET /api/guides` and
  `GET /api/guides/:id` had no auth middleware at all, so `req.user` was always `undefined`
  and the `canSeePhone()` branch in `controllers/guideController.js` was unreachable. Added
  `optionalAuth` (populates `req.user` when a token is present, never rejects) and applied it
  to both public reads.
- **Itineraries had no write path.** Nothing in the codebase ever inserted an `Itinerary` row,
  so the `source: 'stored'` branch of the itinerary read was dead code and every caller got
  placeholders. Added `PUT /api/trips/:id/itinerary`.

## Verified clean — Day 5 session (2026-09-02)

Full backend health check, no code changes required:

- `npm test` load check — all routers and models resolve
- `npm run smoke` **43/43**, `npm run smoke:day3` **67/67**, `npm run smoke:day4` **47/47** — 157 checks, 0 failures
- **Schema drift check passed.** All 7 models match `information_schema` column for
  column, with no orphan columns. All 8 enum types present and correct, including
  `requested` in `enum_bookings_status` and the three `enum_itineraries_*` types.
  This is the project's recurring failure mode, so it is now checked explicitly
  rather than inferred from green tests.
- Server log clean across all three suites — zero error, warning or unhandled-rejection lines in 231 lines.

## API contract mismatches

**Create Trip — resolved Day 2/3.** Postman originally assumed `destination`,
`duration_days`, `start_date` (snake_case); the backend requires `title`,
`destination`, `startDate`, `endDate` (camelCase). Mobile was told before building
the Trip Planner screen.

**Naming convention — resolved Day 4.** The snake/camel split cost a rebuild once,
and AI/ML sends snake_case while this API emits camelCase. Rather than pick a side,
the itinerary write endpoint now accepts either and always responds in camelCase.
See `API_CONTRACT.md` §1 — note that the dual-case acceptance is scoped to that one
endpoint and does not generalise.

**Postman collection — 10 of 16 requests fail (Day 5).** Replayed against the live
server with `base_url` and a valid token supplied, so setup was not the cause. Every
failure is the collection asserting a shape this API has never had: integer ids
against UUID keys, snake_case booking fields, `sender_id`/`message` instead of `text`,
`duration_days` on a trip, a nested `location` + `type: "landslide"` on hazard ingest
with no `X-Ingest-Key`, and two `/api/sos` requests (one never specified, one not yet
built). Seven built endpoints have no request at all. Full table and the handover note
for the integration role are in `API_CONTRACT.md` §13.

The earlier line above about Login/Signup being "fixed to No Auth" applies only to a
local Postman workspace — **the circulated JSON still has `Login` set to Bearer auth**,
along with empty `base_url`/`token` variables and two leftover `postman-echo.com`
requests. The file needs regenerating against `API_CONTRACT.md` §11, not patching.

**Mobile types are out of date.** `RouteLinkMobile/src/types/index.ts` disagrees with the API
on hazard severity casing, coordinate shape, timestamp field name, activity element type, and
several field names. Full table in `API_CONTRACT.md` §8 — Mobile's to fix.

## Routes

Built: Auth, Trips, Itinerary (read + write), Guide Marketplace, Bookings, Chat, Hazard Alerts.

Still missing: **SOS** — `GET /api/sos/nearest` is specified in `SOS_DECISION.md` but not
implemented. Nothing should integrate against it yet. `POST /api/sos` is a separate matter:
the Postman collection calls it, but it has never been specified anywhere and no design for
it exists. Do not treat it as backlog until the team agrees what it should do.

## Open questions for the team

- `PATCH /api/bookings/:id/status` has no transition guard, so `cancelled` → `confirmed` is
  currently accepted. That is a business rule rather than a bug, so it has been left alone —
  the team should decide which transitions are legal before it is enforced in code.

## Confirmed working end-to-end

- Signup → creates user, returns JWT token
- Login → returns JWT token
- Create Trip (correct field names + Bearer token) → creates real trip in DB
- `npm run smoke` — 43 checks
- `npm run smoke:day3` — guides, bookings, chat, hazard ingest
- `npm run smoke:day4` — itinerary contract, marketplace hand-off, write auth
