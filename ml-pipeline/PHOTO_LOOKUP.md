\# Photo Sourcing for Attractions — Wikimedia Commons Approach



\## The problem



`Tourist\_Destinations.csv` has no images, and the swipe-card recommendation UI

needs a photo per attraction. Photo sourcing was agreed to be Maps/Integration's

responsibility, since it's a data-lookup problem similar to the Maps/SOS work

already happening on that side.



\## Why not Google Places API



Google Places API (specifically its Place Photos feature) was the obvious

first choice — excellent coverage, real user-submitted photos, well-documented.



It was ruled out for now because Google Cloud billing has been broken all

day on the Maps/Integration side of this project: two different cards tried,

two different decline errors (`OR\_MIVEM\_02`, then `OR\_CCREU\_01`), never

resolved. Rather than build a new feature on top of an account that's already

failed twice today, this uses a free alternative instead.



\## The solution: Wikipedia / Wikimedia Commons



\*\*Approach:\*\* for each place name, search Wikipedia (biased toward Pakistan

results) to find the correct matching page, then fetch that page's main photo

via Wikipedia's public REST API.



\*\*Why search first instead of guessing the page title directly:\*\* short or

common place names (like "Naran") don't always match Wikipedia's exact page

title, and guessing wrong just returns a 404. Searching first and taking the

top result handles this automatically.



\*\*Gotcha found during testing:\*\* Wikipedia returns a `403 Forbidden` if you

don't send an identifying `User-Agent` header — this is their bot policy,

not a real authentication wall. Any identifying string works; see

`wikimedia\_photo\_lookup.py` for the exact header used.



\## Test results



Ran against 5 real destinations from this project's target region:



| Place | Result |

|---|---|

| Hunza Valley | ✅ Real photo found |

| Skardu | ✅ Real photo found |

| Attabad Lake | ✅ Real photo found |

| Naran | ✅ Real photo found (after adding search-first logic) |

| Fairy Meadows | ✅ Real photo found |



\*\*5/5 hit rate\*\* on this sample. One caveat worth knowing: Naran's matched

photo is actually titled "Siri Paye, Shogran, Kaghan Valley" — a real place

in the same valley/region, but not Naran town itself. The search found the

closest well-documented match rather than an exact one. Worth a quick manual

glance over the final destination list before shipping, rather than trusting

every automated match blindly — for most well-known named places this won't

be an issue, but it's a real limitation of the search-based approach.



\## What this does and doesn't solve



\*\*Solves:\*\* getting a real, free, no-billing photo for well-known named

attractions — which is most of what `Tourist\_Destinations.csv` likely

contains (forts, valleys, lakes, heritage sites).



\*\*Doesn't solve:\*\* guaranteed coverage for small, obscure, or very

local spots that don't have their own Wikipedia page. For those, a

placeholder/fallback image is still needed — `get\_photo\_url()` returns

`None` in that case, which the caller should handle gracefully rather

than treating as an error.



\## Using this



The reusable function is `get\_photo\_url(place\_name: str) -> str | None` in

`wikimedia\_photo\_lookup.py`. Feed it any place name, get back a full-resolution

image URL or `None`. Not yet wired into the actual recommendation pipeline or

`AttractionSpot.imageUrl` — that's the next step once the real dataset

(`Tourist\_Destinations.csv`) is available to run this against the full list

rather than just the 5 test names above.



\## Open questions for whoever wires this in



\- Should this run once at data-load time (and cache results), or on-demand

&#x20; per API request? Wikipedia's API is free but not instant — caching avoids

&#x20; re-fetching the same photo for the same place repeatedly.

\- What should the fallback image be for the `None` case (no Wikipedia photo

&#x20; found)? A generic "no image available" placeholder, or something themed

&#x20; to the destination's category (mountain, lake, fort, etc.)?

