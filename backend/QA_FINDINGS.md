\# QA Findings — Day 2/3 Backend Integration Test



Tested Auth + Trip flow against real backend code (not dummy data).



\## Fixed during this session

\- `.env` was missing DB connection vars and JWT\_SECRET — added and confirmed working

\- Database existed but had no tables — ran `node scripts/db-sync.js` to build them from models

\- Postman collection had Login/Signup incorrectly set to Bearer Token auth — fixed to No Auth



\## Important: API contract mismatches found (needs team attention)



\*\*Create Trip — actual required fields differ from what we assumed on Day 1:\*\*

\- Postman originally assumed: `destination`, `duration\_days`, `start\_date` (snake\_case)

\- Backend actually requires: `title`, `destination`, `startDate`, `endDate` (camelCase)

\- \*\*Action: tell Mobile (A) before they build Trip Planner screen against the old shape\*\*



\## Missing routes (not built yet as of this session)

\- Guide Marketplace — no route file exists

\- Hazard Alerts — no route file exists

\- SOS — no route file exists

\- Only `auth.js` and `trips.js` exist in `backend/routes/`



\## Routes that exist but weren't in original Postman collection

\- `GET /api/trips` (List Trips) — added

\- `PATCH /api/trips/:id` (Update Trip) — added



\## Confirmed working end-to-end

\- Signup → creates user, returns JWT token

\- Login → returns JWT token

\- Create Trip (with correct field names + Bearer token) → creates real trip in DB


## Expo Go / SDK 57 compatibility issue
Project uses Expo SDK 57 (very recent release). Expo Go's matching version isn't yet available on Apple App Store (as of Sept 2, still in Apple review). iPhone users get "incompatible version" error when scanning QR code.

Not a bug in our code, App Store timing issue only. Final built app (via EAS Build) will run fine on iPhone regardless.

Workarounds for testing during development:
- Use Android phone with direct APK download (expo.dev/go?sdkVersion=57&platform=android&device=true)
- Use Android emulator via Android Studio
- Or wait for Apple review to clear

