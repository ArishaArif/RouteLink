\# SOS Nearest Service Lookup — Decision (Updated)



Primary: Mapbox Search/Geocoding API — Mapbox account is working (token active), consistent with map screen provider, avoids running two different map/location providers.

Fallback: OpenStreetMap + Overpass API — free, no billing needed, use if Mapbox billing/limits ever become an issue.

Backup safety net: Static list of known emergency numbers per region, for offline/failure cases.



Endpoint stays the same either way: GET /api/sos/nearest?lat=X\&lng=Y

Backend swaps the underlying data source if needed — no contract change needed for Mobile.



Update note: Originally planned OSM-first due to Google Maps billing being blocked. Switched primary to Mapbox since that account is working and already used for the map screen (Day 3).

