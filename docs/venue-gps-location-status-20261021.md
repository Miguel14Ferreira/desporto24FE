# GPS-only Jynlo venue details — presentation only

The detail page hides synthetic map-coordinate strings in the Postal address field, when the backend reports GPS_ONLY_ADDRESS_UNKNOWN or when a legacy response contains an OSM placeholder. It shows 'Morada por confirmar' or its English translation and links to the existing GPS pin. An address text is NOT labelled independently verified. Unknown GPS falls back to a clearly approximate Google Maps search, without appending fake text.

Backend API PR #152 adds an optional read-only locationStatus property; this frontend remains backwards-compatible when the backend LIVE has not yet been updated. No venue creation, GPS/geocoding, import, Liquibase or backend schema changes; no app writes or deployment with this draft PR.
