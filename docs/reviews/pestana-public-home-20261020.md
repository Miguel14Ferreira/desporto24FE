# Jynlo home — real public discovery, 20 October 2026

Miguel Pestana's latest review notes that the public homepage explains the value proposition but does not show real activity. This implementation is a bounded, **public read-only** frontend candidate.

- Fetch `SessionService.discover({ privateGame: false })`; display max 3 future OPEN/FULL sessions that are explicitly public or not marked COMMUNITY_ONLY, and are not private.
- Session cards link only to the existing public `/sessions/{id}` preview (not to private participant lists or authenticated session edit flows).
- Fetch at most three consecutive `VenueService.suggest(..., page)` pages, stopping early when four usable venues are found; display max 4 records that have name, locality and nonblank sport. Keep earlier valid results if a later page fails. Never claim booking availability.
- No fake sessions, no invented public statistics, no GPS permissions, no payment features. Show honest empty or failed-to-load messages.
- Public filters for **sport** (suggestions from the existing shared catalogue) and **locality** search only existing public session/venue endpoints; searching and clearing never require login. A new search cancels prior requests so stale responses cannot overwrite the latest results.
- PT/EN strings and **nine** Jasmine unit tests in source, including filtering, clearing, and latest-search-wins regressions. Browser and Angular unit tests **not executed**.
- Before release validate anonymous CORS, actual backend status enum, empty datasets, and data protection: venue and session summaries must remain strictly public. No backend/DB changes, no merge or deploy without approval.
