# Jynlo Concept 1 — Admin rollout

This is a **separate, admin-specific visual pilot**. It does not mix
administrator tools with social-feed cards or introduce new metrics.

The scoped design layer is
`src/styles/jynlo-admin-concept-one.css`, imported next to
`jynlo-foundations.css`. Only page roots with `jynlo-c1 jynlo-admin`
are affected.

Screens: administration hub, statistics (formerly audit log), attendance
disputes, ideas and suggestions, player administration, and user reports.

The UI should emphasize:
- Accurate server-provided statistics with clear captions; never invented
  live/online numbers.
- Readable tables for players, not a mobile-style grid.
- Strong separation of case list, details, status, and moderation controls.
- Dangerous moderation actions remain visually distinct from green CTAs.
- Confirmation, authorization, role checks and audit events remain unchanged.

No TypeScript, API, database, routes, moderation permissions or actions
are modified. CI must pass before merge; do not test destructive
moderation actions on real accounts just for visual review.

Check empty/full/error states, pagination, status transitions, keyboard
focus, tables at desktop widths and horizontal scroll on narrow screens.

Coordinate with the separate secondary-pages Concept 1 PR: merge both,
then perform **one** manual frontend deploy to minimize Render costs.
