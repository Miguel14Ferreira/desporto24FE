# Jynlo — Visual Language, Concept 1

**Status:** Pilot on Communities. Desktop-first. Do not interpret this document as a mandate to redesign unrelated screens during feature tickets.

## Product principles

1. **Game/social first:** every view answers "where can I play, with whom, and what happens next?".
2. **Clear hierarchy:** a single useful primary action. Avoid stacking equally bright CTAs.
3. **A community has personality:** use real member-uploaded cover photography; if no photo exists, show a tasteful, accessible fallback.
4. **Familiar controls:** preserve route destinations, terms, access rights, and keyboard usability when updating visuals.
5. **Not a business dashboard:** keep social content prominent and avoid decorative metrics with no real data.
6. **Accessible and fast:** AA-minded contrast, `focus-visible`, reduced motion, lazy assets if needed. Do not hide private content for purely visual reasons.
7. **Stable now, mobile later:** desktop is the visual priority; avoid horizontal overflow on narrow viewports.

## Design tokens

Source of truth: `src/styles/jynlo-foundations.css`.

| Token | Use |
|---|---|
| `--jynlo-ui-canvas` | dark navy page background |
| `--jynlo-ui-surface` | card panels and group previews |
| `--jynlo-ui-surface-raised` | feed/chat cards and secondary panels |
| `--jynlo-ui-outline` | low-contrast surface separation |
| `--jynlo-ui-text` / `--jynlo-ui-muted` | primary and secondary typography |
| `--jynlo-ui-brand` | green accent for positive/primary actions |
| `--jynlo-ui-radius-sm/md/lg` | input, card, hero curvature |
| `--jynlo-ui-shadow` | subtle raised panel depth |
| `--jynlo-ui-container` | common content maximum width |

Do **not** redefine legacy `--d24-*` tokens in this pilot; they still serve older screens. Preserve the existing `jynlo-action` variants.

## Reusable vocabulary

- `.jynlo-ui-surface`: generic raised surface.
- `.jynlo-ui-section-heading`: title and secondary action.
- `.jynlo-ui-overline`: compact section label.
- `.jynlo-ui-eyecatching-image`: cover image with `object-fit: cover`.

## Screen patterns

**Discover/list:** restrained overline, clear title/subtitle, one meaningful CTA; editorial featured area where appropriate; 3-column photo-forward grid (data-driven, not artificial activity counts); descriptive empty state.

**Detail:** large 16:10 cover plus identity, privacy badge and role indicator; segmented, horizontally scrollable tabs; readable content column; secondary actions visually quiet.

**Social:** text/media and member conversation remain primary. Data-entry controls stay accessible; prefer actual content to extra marketing copy.

## Pilot implementation

- `src/styles/jynlo-communities-concept-one.css` contains ONLY selectors scoped to `.communities-page.jynlo-c1`.
- `communities.component.html` adds the root scope class and semantic "My Communities" heading.
- Existing community module logic, router destinations, file-upload behavior, API clients, chat/feed permissions, and translations remain unchanged except for added subtitle text.
- Angular component CSS stays untouched to avoid exceeding its existing production style budget.

## Visual regression / release checklist

- A member opens `/menu/communities` and sees their community photo cards; a new account still sees onboarding; `view=explore` still works.
- Card with photo, card without photo, long community name and multiple sports remain readable.
- Community detail shows a wider cover, owner/admin/member status, proper actions and all original tabs (Feed, Chat, Sessions, Members, competitions when eligible).
- Owner can change and remove the photo as before. Non-admin never sees management controls.
- Feed and Chat text controls, loading/error feedback and moderation retain their behavior.
- Keyboard focus, tab order and narrow viewport do not break.
- Automated Angular tests and production build must pass before merging.
- Publish one manual frontend deploy only after visual review; no backend/database work is part of this PR.

## Later adoption

Once the Communities desktop pilot is accepted, reuse the tokens and primitives **one feature area at a time**: Sessions and postgame → User profiles → Home/social feed → Administration. Do not migrate everything in one PR.

## Second screen migration — Sessions and Games (Oct 22, 2026)

The original Communities pilot is live and approved. The next strictly visual
migration is in `src/styles/jynlo-sessions-concept-one.css`, scoped to page roots
with `jynlo-c1 jynlo-games`. Four routes opt in:

- `/menu/events`: matching game discovery results and filter/nearby panels.
- `/menu/createEvent`: calmer create-session form, preserving venue database,
  Maps URL and live GPS selection.
- `/menu/events/:id`: larger game header/cover, booking/attendance and postgame
  panels, with all permission-bound controls intact.
- `/menu/my-sessions`: upcoming game highlight and organized match cards.

No new data, counts, badges, images or endpoints are invented. The matching
behavior, form validation, private-address permissions, attendance, postgame,
ratings and organizer restrictions remain untouched.

Manual visual review should check:
1. Nearby on/off, empty/error states, sorting/filtering and navigation in Explore.
2. All three location selection modes, sports/districts, and create/preview.
3. Joined/not-joined/organizer/detail flows, including restricted address.
4. My games: created, joined, waitlisted, attendance and cancel confirmation.
5. Desktop first; narrow viewport and keyboard focus must remain usable.

Do not combine this update with pending share/Google Maps functional PRs. Roll
out Profiles and Main Feed only after this pilot's visual and test acceptance.

## Third screen migration — Social/Profiles/Discovery

Scoped CSS: `src/styles/jynlo-social-concept-one.css`. Five desktop areas
opt into the shared tokens with `jynlo-c1 jynlo-social`:

- Personal Profile: stronger identity portrait and readable achievements.
- People / Player profiles: consistent search grid, player cards and public profile.
- Main Social Feed: lively but calm composer, real post cards, weekly hub and suggestions.
- Discover: clear where/when/who search panels with common surfaces.
- Public Home: the same brand vocabulary for the hero, discover preview and communities.

All existing query parameters, privacy decisions, follow and friend actions,
post composer, upload controls and public preview routes are preserved; no new
statistics or invented profile data. No backend changes.

Acceptance: validate individual/other profiles, privacy and follow states, full
post composer/comments, week recommendations, discover empty/full results, and
anonymous homepage before another rollout. No mobile redesign in this wave.


## Fourth screen migration — secondary journeys (Oct 22, 2026)

`src/styles/jynlo-secondary-concept-one.css` is the scoped design
layer for six further desktop pages, opted in with
`jynlo-c1 jynlo-secondary`:

- Main logged-in menu/dashboard (`menu`)
- Notifications and the selected notice detail
- Friends/search and friends actions
- One-to-one chat and existing message composer
- Edit personal profile, including photo and MFA settings
- Create a community, including larger 3:2 image preview

**No** changes to TypeScript, permissions, API contracts, routes, chat
transport, notification deletion rules, security/MFA logic or profile
upload validation. Never replace danger actions with the positive green
accent. Text still controls name/pseudonym privacy and data access.

The next separate task is the admin surface, which needs denser
information design and should not be mixed with social screen styles.

### Visual checks before considering the new look finished

1. Menu cards/profile and logout on desktop.
2. Notifications: empty, unread, selected, mark-as-read, clear-all
   confirmation, security-related actions.
3. Friends: populated/empty/filtered, contextual menu, blocked state.
4. Chat: direct messages, blocked state, emoji picker, composer and
   long messages; do not regress automatic refresh.
5. Profile editing: saved/pending photo, cropping, validation, MFA
   flows, error states and disabled fields.
6. Community creation: original form fields, large preview,
   no-photo fallback, upload errors and navigation.

GitHub CI is necessary but not a substitute for browser visual review.
