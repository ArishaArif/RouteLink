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