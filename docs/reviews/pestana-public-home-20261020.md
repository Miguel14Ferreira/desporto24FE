# Jynlo home — real public discovery, 20 October 2026

Miguel Pestana's latest review notes that the public homepage explains the value proposition but does not show real activity. This implementation is a bounded, **public read-only** frontend candidate.

- Fetch `SessionService.discover({ privateGame: false })`; display max 3 future OPEN/FULL sessions that are explicitly public or not marked COMMUNITY_ONLY, and are not private.
- Session cards link only to the existing public `/sessions/{id}` preview (not to private participant lists or authenticated session edit flows).
- Session cards display **1 spot**, **N spots** or **Full** using existing public `participantCount`, `maxParticipants` and `status`. `FULL` takes precedence; missing, negative or invalid capacity does not produce fabricated available places.
- Fetch at most three consecutive `VenueService.suggest(..., page)` pages, stopping early when four usable venues are found; display max 4 records that have name, locality and nonblank sport. Keep earlier valid results if a later page fails. Never claim booking availability.
- No fake sessions, no invented public statistics, no GPS permissions, no payment features. Show honest empty or failed-to-load messages.
- Public filters for **sport** (suggestions from the existing shared catalogue) and **locality** search only existing public session/venue endpoints; searching and clearing never require login. A new search cancels prior requests so stale responses cannot overwrite the latest results.
- PT/EN strings and **twelve** Jasmine unit tests in source, including filtering, clearing, latest-search-wins, public availability/full status, and invalid-capacity regressions. Browser and Angular unit tests **not executed**; live API not reachable from this tool environment, so anonymous runtime remains unverified.
- Before release validate anonymous CORS, empty datasets, and data protection: venue and session summaries must remain strictly public. No backend/DB changes, no merge or deploy without approval.
