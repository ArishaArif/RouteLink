# SOS Nearest Service Lookup — Decision

**Status: not implemented.** This records the agreed approach; no code exists yet.

Primary (for now): OpenStreetMap + Overpass API — free, no billing blocker, works today.

Planned upgrade: Google Places API (Nearby Search) — once the billing/card issue is resolved,
for better data accuracy.

Fallback: static list of known emergency numbers per region, in case both APIs fail or are
unreachable.

Endpoint stays the same either way:

```
GET /api/sos/nearest?lat=X&lng=Y
```

Backend just swaps the underlying data source when ready — no contract change needed for
Mobile. Mobile should not integrate against this endpoint until it is built.
