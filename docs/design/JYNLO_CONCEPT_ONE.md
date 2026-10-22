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
