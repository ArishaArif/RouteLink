# SOS Nearest Service Lookup — Decision (Updated)

**Status: not implemented.** This records the agreed approach; no code exists yet.

Primary: Mapbox Search/Geocoding API — Mapbox account is working (token active), consistent with map screen provider, avoids running two different map/location providers.

Planned upgrade: Google Places API (Nearby Search) — once the billing/card issue is resolved, for better data accuracy.

Fallback: static list of known emergency numbers per region, in case both APIs fail or are unreachable.

Endpoint stays the same either way:

GET /api/sos/nearest?lat=X&lng=Y


Backend just swaps the underlying data source when ready — no contract change needed for Mobile. Mobile should not integrate against this endpoint until it is built.

Update note: Originally planned OSM-first due to Google Maps billing being blocked. Switched primary to Mapbox since that account is working and already used for the map screen (Day 3).