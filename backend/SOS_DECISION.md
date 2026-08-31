\# SOS Nearest Service Lookup — Decision



Primary (for now): OpenStreetMap + Overpass API — free, no billing blocker, works today.

Planned upgrade: Google Places API (Nearby Search) — once billing/card issue is resolved, for better data accuracy.

Fallback: Static list of known emergency numbers per region, in case both APIs fail or are unreachable.



Endpoint stays the same either way: GET /api/sos/nearest?lat=X\&lng=Y

Backend just swaps the underlying data source when ready — no contract change needed for Mobile.

