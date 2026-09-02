# RouteLink API Contract

Owner: Backend. Consumers: AI/ML pipeline, Mobile.

This file is the agreed shape of the data crossing team boundaries. If you need
a field that is not here, raise it before shipping against it — the Day 2/3
rebuild recorded in `QA_FINDINGS.md` happened because two sides assumed
different field names.

**Start here if you are wiring up a client:** §10 (all ids are UUIDs), §11 (the
complete endpoint list), §12 (booking / chat / guide bodies). Those three cover
the mistakes that have actually been made against this API. §13 explains why the
shared Postman collection is not a substitute for this file.

---

## 1. Naming: send either case, receive camelCase

Every response this API produces uses **camelCase**. That is unconditional.

On the itinerary write endpoint, requests may use **either** camelCase or
snake_case. `heat_tier` and `heatTier` are both accepted and mean the same
thing. If both appear in one object, camelCase wins.

| accepted in a request | always returned as |
| --- | --- |
| `day_number` / `dayNumber` | `dayNumber` |
| `slot_type` / `slotType` | `slotType` |
| `heat_tier` / `heatTier` | `heatTier` |
| `needs_marketplace_data` / `needsMarketplaceData` | `needsMarketplaceData` |
| `fallback_message` / `fallbackMessage` | `fallbackMessage` |
| `weather_context` / `weatherContext` | `weatherContext` |
| `hazard_context` / `hazardContext` | `hazardContext` |
| `model_version` / `modelVersion` | `modelVersion` |

ML can keep emitting snake_case. Mobile can keep parsing camelCase. Neither
side has to change.

**The dual-case acceptance stops at that one endpoint.** `PUT
/api/trips/:id/itinerary` is the only route that reads both cases. Everywhere
else — trips, bookings, chat, guides, hazard ingest — the request body is
**camelCase only**, and most of those routes reject unrecognised keys with a
`400` rather than ignoring them. Sending `guide_id` or `duration_days` to those
routes is an error, not a tolerated alias. Do not generalise §1 beyond the
itinerary write.

---

## 2. Where `heat_tier` / `slot_type` live

**On the itinerary, not on the hazard alert.**

The request asked for these "alongside whatever hazard/weather fields you'd
already agreed on". The only object that carries both weather *and* hazard
context is an itinerary day, so that is where the scheduling fields go. A
`HazardAlert` describes an event in a region; it has no notion of a trip day or
a time slot, so putting a heat tier on one would have nothing to key off.

An itinerary day therefore carries all four together:

```json
{
  "slotType": "indoor_rest",
  "heatTier": "extreme",
  "weatherContext": { "highC": 41, "lowC": 27, "condition": "heatwave" },
  "hazardContext": { "activeAlerts": 1, "category": "weather" }
}
```

`weatherContext` and `hazardContext` are free-form JSON objects. The backend
stores and returns them unchanged and does not validate their interior — ML
owns those shapes and can evolve them without a backend deploy.

---

## 3. Vocabularies

```
heatTier   cool | mild | warm | hot | extreme
slotType   outdoor_active | outdoor_light | indoor_rest | travel | mixed
```

Both are nullable at the day level. Both are also accepted on individual
entries inside `activities`, so a day that is `mixed` overall can still mark
its 14:00 slot `indoor_rest`.

These are Postgres enums. Adding a value is a two-line change (the array in
`utils/itineraryContract.js`, plus an `ALTER TYPE ... ADD VALUE IF NOT EXISTS`
following the pattern in `scripts/db-migrate-day3.js`) — ask and it can ship
same day. Sending a value outside the list returns `400`, it does not silently
coerce.

---

## 4. `needs_marketplace_data` — the hand-off flag

This is the explicit agreement that was asked for, and it is enforced in code
rather than by convention.

**The rule:** if a day has `slotType: "indoor_rest"` and the request does not
say otherwise, the backend sets `needsMarketplaceData: true` on that day. ML
does not have to remember to set it.

ML can override it explicitly — sending `needs_marketplace_data: false` on an
`indoor_rest` day is honoured — but the default means the safe case is the one
you get for free.

**What the flag means:** the model is declaring that this day needs real
lodging/dining/guide options, and that it is *not* supplying them. Nothing in
the ML payload is expected to contain a hotel or restaurant name. If one ever
appears in an itinerary, it did not come from this contract.

**What the backend does with it:** every flagged day comes back with a
`marketplace` object built from backend-owned rows:

```json
"marketplace": {
  "region": "Hunza Valley",
  "guides": [ { "id": "...", "name": "...", "region": "...", "pricePerDay": 7500, "rating": 4.8 } ],
  "lodging": [],
  "dining": []
}
```

- `guides` — real rows from the `guides` table, filtered to `isAvailable` and a
  region matching the trip destination, best-rated first, capped at 10. Phone
  numbers are never included here.
- `lodging` and `dining` — **always empty arrays today.** There is no hotel or
  restaurant table in this backend yet. They are present so the shape does not
  change when that inventory lands. An empty array means "the backend has none",
  never "ask the model for some".

Days that are not flagged have no `marketplace` key at all.

`fallbackMessage` is stored verbatim and returned unchanged — it is ML's copy,
and the backend does not rewrite it.

---

## 5. `PUT /api/trips/:id/itinerary`

Writes the generated plan for a trip. **Replace semantics**: the days you send
become the complete itinerary for that trip; any day previously stored and not
present in the new payload is deleted. The whole write is one transaction, so a
rejected payload leaves the existing itinerary untouched.

### Auth — either credential works

| credential | header | ownership |
| --- | --- | --- |
| ML service | `X-Ingest-Key: <ML_SERVICE_KEY>` | may write any trip |
| Trip owner | `Authorization: Bearer <jwt>` | may write only their own trips |

Neither ⇒ `401`. A valid token for a trip you do not own ⇒ `404` (not `403`,
so the endpoint does not confirm that a trip id exists).

A service write is stored as `source: "ml"`; an owner write as
`source: "manual"`. Send a top-level `source` of `"ml"` or `"manual"` to
override — useful if the mobile app is relaying model output under a user token.

### Request

```json
{
  "modelVersion": "heat-sched-v0.3.1",
  "days": [
    {
      "dayNumber": 1,
      "date": "2026-10-05",
      "slotType": "outdoor_active",
      "heatTier": "mild",
      "weatherContext": { "highC": 18, "condition": "clear" },
      "hazardContext": { "activeAlerts": 0 },
      "activities": [
        { "time": "08:00", "title": "Baltit Fort walk", "slotType": "outdoor_active" }
      ]
    },
    {
      "dayNumber": 2,
      "date": "2026-10-06",
      "slotType": "indoor_rest",
      "heatTier": "extreme",
      "fallbackMessage": "Outdoor activity is unsafe at this heat tier. See the Guide Marketplace for verified options.",
      "activities": [{ "time": "11:00", "title": "Rest and refuel" }]
    }
  ]
}
```

| field | required | rules |
| --- | --- | --- |
| `days` | yes | array, 1–60 entries |
| `days[].dayNumber` | yes | positive integer, unique within the payload |
| `days[].date` | yes | `YYYY-MM-DD`, real calendar date, **within the trip's start/end** |
| `days[].activities` | yes | array of objects, ≤ 50; may be `[]` |
| `days[].slotType` | no | from the vocabulary above |
| `days[].heatTier` | no | from the vocabulary above |
| `days[].needsMarketplaceData` | no | boolean; defaults per §4 |
| `days[].fallbackMessage` | no | string, ≤ 500 chars |
| `days[].weatherContext` | no | object, contents not inspected |
| `days[].hazardContext` | no | object, contents not inspected |
| `modelVersion` | no | non-empty string; per-day override allowed |

### Response `200`

The stored itinerary, plus:

- `writtenBy` — `"service"` or `"owner"`
- `ignoredFields` — **read this.** Unknown day-level keys are not rejected, so
  ML can add fields ahead of a backend deploy without being blocked. Every
  unrecognised key is listed here instead. A typo like `heat_teir` shows up in
  this array rather than failing loudly, so check it in CI.

### Errors

`400` with `{ "error": "Validation failed", "details": [...] }`, one entry per
problem, addressed as `days[2].heatTier` so you can find it. `404` for an
unknown trip or a token that does not own it.

---

## 6. `GET /api/trips/:id/itinerary`

Auth: `requireAuth`, trip owner only. (The service key is deliberately not
accepted here — `PUT` already returns the stored result, so ML never needs to
read back.)

Always returns the same day shape, whether stored or not:

- `source: "stored"` — real rows written through `PUT`.
- `source: "placeholder"` — nothing has been written yet, so the backend
  synthesises one day per trip date. Placeholder days always have
  `slotType: null`, `heatTier: null`, `needsMarketplaceData: false`,
  `fallbackMessage: null`, `hazardContext: null` and `source: "placeholder"`.

**Mobile: the keys are always present.** Never branch on a missing key —
branch on `source`, or on `needsMarketplaceData`.

---

## 7. `POST /api/hazards` — unchanged, and strict

Auth: `X-Ingest-Key` (same key as above). This endpoint **rejects unknown
fields with a `400`** — deliberately, and it is covered by a test. It does not
behave like the itinerary endpoint's `ignoredFields`.

So: adding a field to hazard ingest needs a backend change first. Tell Backend,
ship the change, then send it. Accepted fields are exactly `sourceType`,
`rawText`, `hazardType`, `region`, `latitude`, `longitude`, `severity`,
`expiresAt`, `description`.

```
hazardType   weather | health | safety | political | natural_disaster | other
severity     low | medium | high | critical
```

Re-posting an identical `(region, hazardType, rawText)` returns `200` with
`duplicate: true` and the original row rather than creating a second alert.
`latitude` and `longitude` must be sent together or not at all.

---

## 8. Open mismatches — Mobile

`RouteLinkMobile/src/types/index.ts` does not currently match what this API
returns. Backend has not changed these types (mobile is not Backend's to edit);
they are listed here so Mobile can correct them.

| location | mobile type says | API actually returns |
| --- | --- | --- |
| `HazardAlert.severity` | `'LOW' \| 'MEDIUM' \| 'HIGH'` | lowercase, and there is a fourth value: `'low' \| 'medium' \| 'high' \| 'critical'` |
| `HazardAlert.locationName` | `string` | field is named `region` |
| `HazardAlert.coordinates` | `{ latitude, longitude }` | flat `latitude` and `longitude`, and both may be `null` |
| `HazardAlert.timestamp` | `string` | field is named `createdAt` |
| `HazardAlert` | — | also returns `hazardType`, `rawText`, `sourceType`, `isActive`, `expiresAt` |
| `TripDay.activities` | `string[]` | array of **objects** (`{ time, title, location, notes, slotType?, heatTier? }`) |
| `TripDay.title` | `string` | does not exist; a day has `dayNumber` and `date` |
| `TripDay.weatherForecast` | `string` | field is `weatherContext`, an object |
| `TripItinerary.durationDays` | `number` | field is `days`, a **count** — see the row below before renaming anything |
| `TripItinerary.days` | `TripDay[]` | **name collision — read this one twice.** On the response, `days` is a `number` (how many days) and the array of day objects is `itinerary`. Renaming `durationDays` to `days` without also renaming `days` to `itinerary` produces a type that iterates a number. |
| `TripItinerary.id` | `string` | field is `tripId` |
| `TripItinerary.startDate` | `string` | **not returned at all** by either itinerary endpoint — read it from the trip, or from `itinerary[0].date` |
| `TripItinerary` | — | also returns `source` (`"stored"` \| `"placeholder"`) and `modelVersion`, plus `generatedAt` on placeholder responses only |
| `TripDay` | — | also returns `id` (`null` on placeholder days) and `tripId` |
| `HazardAlert.description` | `string` (required) | nullable — must be `string \| null` |
| `Guide.phone` | `string` (required) | omitted unless you are the listing owner or an admin — must be optional |
| `Guide` | — | also returns `userId`, `languages`, `bio`, `isAvailable`, `createdAt`, `updatedAt`, `user` |

Mobile also has **no type at all** for `Trip`, `Booking` or `ChatMessage`, and no auth/user type. Those
three endpoints are built and tested; the types simply do not exist yet.

**Numbers are numbers.** Every `DECIMAL` column (`budget`, `pricePerDay`, `rating`, `totalPrice`,
`latitude`, `longitude`) is coerced by `utils/numeric.js` and crosses the wire as a JSON number, not a
string. Do **not** wrap these in `parseFloat` — that guidance applied before `numericGetter` existed and
is no longer correct. `null` stays `null`.

`TripDay` will also need the new optional fields: `slotType`, `heatTier`,
`needsMarketplaceData`, `fallbackMessage`, `hazardContext`, `source`,
`marketplace`.

---

## 9. Not built

`GET /api/sos/nearest` is specified in `SOS_DECISION.md` and is still not
implemented. It returns `404`. Nothing should be integrated against it yet.

`POST /api/sos` appears in the shared Postman collection but has **never been
specified anywhere** — not in `SOS_DECISION.md`, not here. It does not exist and
no design for it has been agreed. If a panic-button write endpoint is wanted,
that is a new conversation, not a missing implementation. See §13.

---

## 10. Identifiers are UUIDs

Every primary key in this API is a **UUID v4 string**, generated by the
database. There are no integer ids anywhere, and there never were.

```
04b8f4e2-1c9d-4a77-9f3e-2b6a5c8d1e40      valid
1                                          400 Validation failed
```

A malformed id returns `400` with a message naming the parameter (`Trip id must
be a valid UUID`), **not** a `404`. This is deliberate: a `404` would suggest the
row is missing, when the real problem is the id never could have matched.

That applies to `tripId`, `guideId`, `bookingId`, `userId` and itinerary day
`id`, in path parameters and in request bodies alike.

**For clients:** never hardcode an id. Capture it from the response that created
the row — `POST /api/trips` returns `trip.id`, `POST /api/bookings` returns
`booking.id`, `GET /api/guides` returns `guides[].id`. In Postman that is a
two-line test script (§13); in Mobile it is whatever your state layer already
does with a created record.

---

## 11. Endpoint index

Complete as of 2026-09-02. Auth column: **none** = public, **JWT** = header
`Authorization: Bearer <token>`, **key** = header `X-Ingest-Key`, **optional** =
JWT read if present but never required (affects which fields come back).

| method | path | auth | notes |
| --- | --- | --- | --- |
| `GET` | `/health` | none | `{ status, db }`; `503` if Postgres is unreachable |
| `POST` | `/api/auth/signup` | none | `name`, `email`, `password`; optional `role`. Returns `user` + `token` |
| `POST` | `/api/auth/login` | none | `email`, `password`. Returns `user` + `token`. **Send no Authorization header** |
| `POST` | `/api/trips` | JWT | `title`, `destination`, `startDate`, `endDate`; optional `budget`, `status` |
| `GET` | `/api/trips` | JWT | caller's own trips only; paginated |
| `GET` | `/api/trips/:id` | JWT | owner only, else `404` |
| `PATCH` | `/api/trips/:id` | JWT | see §12 for the updatable set |
| `DELETE` | `/api/trips/:id` | JWT | owner only |
| `GET` | `/api/trips/:id/itinerary` | JWT | §6. Falls back to placeholder days when nothing is stored |
| `PUT` | `/api/trips/:id/itinerary` | JWT **or** key | §5. The only dual-case route. Service key may cross trip ownership |
| `GET` | `/api/guides` | optional | public list; `phone` withheld unless owner/admin |
| `GET` | `/api/guides/:id` | optional | same phone rule |
| `POST` | `/api/guides` | JWT + role `guide` | create own listing |
| `PATCH` | `/api/guides/:id` | JWT | owner only; see §12 |
| `POST` | `/api/bookings` | JWT | §12 |
| `GET` | `/api/bookings` | JWT | bookings where caller is traveler or guide |
| `PATCH` | `/api/bookings/:id/status` | JWT | guide or admin only — a traveler gets `403`. §12 |
| `POST` | `/api/bookings/:id/messages` | JWT | participants only. §12 |
| `GET` | `/api/bookings/:id/messages` | JWT | participants only; paginated |
| `POST` | `/api/hazards` | key | §7. Strict — rejects unknown fields |
| `GET` | `/api/hazards` | none | optional `?region=`; active alerts, severity-ranked |

Non-participants on a booking get `404`, not `403` — the API does not confirm
that a booking exists to someone who has no part in it.

---

## 12. Bookings, chat and guide bodies

These were built on Day 3 and documented only in passing. Written out here
because they are the shapes clients get wrong most often.

### `POST /api/bookings`

```json
{
  "tripId": "<uuid>",
  "guideId": "<uuid>",
  "startDate": "2026-09-11",
  "endDate": "2026-09-13"
}
```

All four are required. **A booking is a date range, not a single day** — there is
no `date` field. `totalPrice` is computed by the backend from the guide's
`pricePerDay` and the inclusive day count; do not send it.

Rejections worth coding for: dates outside the parent trip's range (`400`),
booking your own listing (`400`), a guide with `isAvailable: false` (`409`), and
an overlapping booking on that guide (`409`, with the conflicting range in
`conflict`).

### `PATCH /api/bookings/:id/status`

```json
{ "status": "confirmed" }
```

Settable values are `confirmed`, `cancelled`, `completed` only. `requested` and
`pending` are entry states the backend assigns; you cannot `PATCH` back to them.
Only the assigned guide or an admin may call this — a traveler gets `403`.

There is still **no transition guard**: `cancelled` → `confirmed` is currently
accepted. That is an open business-rule question in `QA_FINDINGS.md`, not a
guarantee — do not build a client that depends on the current permissiveness.

### `POST /api/bookings/:id/messages`

```json
{ "text": "Looking forward to the trip" }
```

`text` is the only accepted field, max 4000 characters. **Do not send a sender
id.** The sender is taken from the JWT — a client claiming its own identity in
the body would be a way to post as someone else, so the field does not exist.
Responses carry `senderId` and a nested `sender: { id, name }`.

### `PATCH /api/trips/:id`

Updatable: `title`, `destination`, `startDate`, `endDate`, `status`, `budget`.
Anything else returns `400` listing the accepted set. There is **no
`duration_days`** field on a trip in any form — duration is derived from
`startDate` and `endDate`.

### `POST` / `PATCH /api/guides/:id`

Fields: `region`, `languages`, `bio`, `phone`, `pricePerDay`, `isAvailable`.
`POST` requires the `guide` role; `PATCH` is owner-only.

---

## 13. The Postman collection is not the contract

`RouteLink API.postman_collection.json`, as circulated, was hand-written ahead of
the backend and never reconciled against it. Replayed against the running server
on 2026-09-02 — with `base_url` and a valid token supplied, so setup was not the
cause — **6 of its 16 requests passed and 10 failed.**

The failures are not backend bugs. Each one is the collection asserting a shape
this API has never had:

| collection request | fails | cause |
| --- | --- | --- |
| `GET/PATCH/DELETE /api/trips/1`, `GET /api/trips/1/itinerary` | `400` | integer id against a UUID key — §10 |
| `GET /api/guides/1` | `400` | same |
| `POST /api/bookings/1/messages` | `400` | same, plus `sender_id`/`message` instead of `text` — §12 |
| `POST /api/bookings` | `400` | `guide_id`, `trip_id`, single `date` — should be `tripId`, `guideId`, `startDate`, `endDate` |
| `PATCH /api/trips/1` | `400` | sends `duration_days`, which does not exist |
| `POST /api/hazards` | `401` | no `X-Ingest-Key`; body also uses nested `location` and `type: "landslide"` instead of flat `latitude`/`longitude` and a `hazardType` from the enum |
| `POST /api/sos` | `404` | endpoint was never specified — §9 |
| `GET /api/sos/nearest` | `404` | specified, not yet built — §9 |

Also wrong but not fatal: `base_url` and `token` ship as empty strings, so as
handed over *every* request fails on an unresolved variable; `Login` is set to
Bearer auth and sends a token to obtain a token; two `postman-echo.com` sample
requests are still in the file; and no request captures an id or token into a
variable, which is how hardcoded `1`s got baked in.

Seven built endpoints have **no request at all**: `PUT /api/trips/:id/itinerary`,
`POST /api/guides`, `PATCH /api/guides/:id`, `GET /api/bookings`, `PATCH
/api/bookings/:id/status`, `GET /api/bookings/:id/messages`, `GET /health`.

**Until the collection is regenerated against §11, treat this file as the only
source of truth.** A red request in that collection is not evidence of a backend
defect — check the shape here first.

