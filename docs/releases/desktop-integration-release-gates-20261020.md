# Jynlo desktop integration — release gates (20 Oct 2026)

**Status:** DRAFT / NOT LIVE. Candidate desktop CI passed at FE #128 commit `e01048d`, but real authenticated end-to-end checks and owner sign-off are still required. This is a release checklist, not permission to merge or deploy.

## Candidate and boundaries

- Integration base: [FE PR #125](https://github.com/Miguel14Ferreira/desporto24FE/pull/125), branch `integration/desktop-pestana-20261020`, targeting `preview/render-fullstack`.
- Consolidated candidate **to approve**: [FE PR #128](https://github.com/Miguel14Ferreira/desporto24FE/pull/128), branch `release/desktop-ux-20261020`, based on #125 and verified at commit `e01048d501a6b06cbc065740940d9b7d7b911f2a`. Includes public-home, navigation, scroll restoration and synthetic authenticated-community browser QA; do not confuse its verified SHA with later edits.
- Sources: FE #122 (discover/sessions/venues), FE #123 (auth UX), FE #124 (public homepage), followed by bounded desktop quality/participation/organizer fixes in #125. The candidate is large (~51 changed paths before this document); **do not add unrelated features to this release**.
- Backend **LIVE base**: `feature/desporto24-preview-deploy`, commit `ac07f09c492d36c74c6fcb02456a7b56e3e3ec33`. The FE may be reviewed against this existing API for read-only compatibility.
- Backend **security candidate**: [BE #127](https://github.com/Miguel14Ferreira/desporto24BE/pull/127), draft, **not live**. It combines refresh cookie Origin validation + temporary login throttle; it requires real-flow QA before deployment. Do not assume BE #127 is required to test FE #125 locally or deploy it together without review.
- Backend **venue catalogue candidate**: [BE #124](https://github.com/Miguel14Ferreira/desporto24BE/pull/124), draft, **not live**. Its Liquibase PostgreSQL 16 fixture tests pass, but the production backup/restore check and actual-data duplicate review, including São Jacinto, remain blockers for this *separate* data release.
- Render FE service `desporto24-web` stays on `preview/render-fullstack`; auto-deploy is disabled. No automatic publication occurs from PR work.
- Render production state inspected 20 Oct: FE latest LIVE commit `5fb36fe24a1400bc7460dfe8821f16c8566d590b`; API `desporto24-api` latest LIVE commit `ac07f09c492d36c74c6fcb02456a7b56e3e3ec33`; both services have auto-deploy disabled. No new deployment has been triggered.

## Release gates

- [x] Integrated candidate uses an explicit draft PR, leaving LIVE untouched.
- [x] Angular Jasmine suite and production build verified on consolidated FE #128 source commit `e01048d501a6b06cbc065740940d9b7d7b911f2a`: [CI #39459504654](https://github.com/Miguel14Ferreira/desporto24FE/actions/runs/39459504654), **847/847 tests** and production build SUCCESS. The temporary CI SHA `31cde2f2b8a0a37802fc16f13c6c009c224fcd0c` differs **only in the workflow YAML** to enable the browser steps; it was closed without merge.
- [x] **Isolated synthetic desktop-browser smoke** verified on the same application sources: 7 guest scenarios/6 screenshots, 5 synthetic JWT/MFA scenarios and 6 authenticated-community flow screenshots; zero browser JS exceptions reported. The browser intercepted all API traffic, without real accounts or backend writes.
- [x] **Read-only LIVE public API contract smoke** passed independently on the upstream #125 commit `7e9ddaac5d260370a33632a4de617e42d0ca5e25`: [CI #39458207186](https://github.com/Miguel14Ferreira/desporto24FE/actions/runs/39458207186). Verified anonymous GET session discovery, bounded venue suggestions and a public-session preview including privacy-field shape. No production writes or credentials.
- [ ] Perform real authenticated E2E and manual screenshot review with temporary test accounts on a controlled candidate or approved release: actual login/refresh, Google OAuth/MFA, invitations, join/waitlist, community owner/member permissions, and session creation. Synthetic JWTs cannot validate backend authorization.
- [ ] If the source candidate changes after `e01048d`, rerun full CI on the newly frozen SHA; do not reuse a previous green result as current-head evidence.
- [ ] Guest homepage: no login required; public session search and bounded venues load; empty/error/retry states; session/venue values are not invented.
- [ ] Guest shared link `/sessions/:id`: OPEN, FULL, cancelled, nonexistent, wrong/invalid IDs, malformed dates and no participant-identity leakage. Follow login/registration return URLs without automatic joining.
- [ ] Auth on desktop: email/username login, Google OAuth, MFA, confirmation/recovery, and return-to-session behavior (including opening confirmation emails in another browser). Do not send test credentials to CI logs.
- [ ] Signed-in discover: available vs FULL waitlist, private/community-only exclusion, unknown venue environment, district/venue search and approximate Google Maps fallback for missing coordinates.
- [ ] Session flow: join, leave, promotion notification, current membership/waitlist position, organiser roster access without joining, confirmed vs externally counted places, private-session restrictions.
- [ ] Visual review in PT and EN at typical desktop widths; check layout, navigation, errors, accessibility and mobile overflow (mobile product polish can follow desktop, but no broken viewport).
- [x] Public read-only API smoke on the LIVE backend **passed**, with the exact evidence above; **never mutate production data through this test**.
- [ ] Explicit owner approval to merge; confirm current target branch has not diverged, CI applies to final HEAD, and only intended commits are included.
- [ ] Explicit owner approval for Render deploy, separate from merge approval; assess minutes/cost and publish only a selected SHA. Validate live SHA, service health and rollback path.

## Latest verified evidence and known limitations

| Gate | Evidence | Current status |
| --- | --- | --- |
| Angular tests + build | FE #128 source `e01048d` / [CI #39459504654](https://github.com/Miguel14Ferreira/desporto24FE/actions/runs/39459504654) | 847/847 PASS; production build PASS |
| Synthetic guest Chromium | Same run and source | 7 scenarios, 6 screenshots, 0 JS exceptions |
| Synthetic MFA Chromium | Same run and source | 5 cases incl. expired challenge renewal; PASS |
| Synthetic community journeys | Same run and source | login, search, private join request, community creation, invite, "sessions only", new-session form; PASS |
| Anonymous LIVE backend GET contracts | FE #125 `7e9dda` / [CI #39458207186](https://github.com/Miguel14Ferreira/desporto24FE/actions/runs/39458207186) | All three checked public endpoints PASS, no writes |
| Real authenticated browser QA | Not executed | **BLOCKER before release authorization** |
| Final target branch SHA + deployment verification | No merge or deploy | **BLOCKER** |

The green browser tests use mock data, **not real account credentials**. They do not establish Google OAuth integration, production refresh-cookie behavior, invitation delivery, protected backend permissions or DB persistence. Backend security and venue-catalogue draft PRs must not be merged as incidental dependencies.

Nonblocking performance warnings from the final candidate build: initial bundle about **1.47 MB** (warning threshold 1 MB), `communities.component.css` **30.59 kB** (20 kB), and `session-details.component.css` **21.40 kB** (20 kB). These deserve a separate performance task; don't silently increase warning budgets.

### Safe rollback before a manual Render deploy

- Preserve the last verified FE LIVE commit `5fb36fe24a1400bc7460dfe8821f16c8566d590b` and Render deployment `dep-dbb5ch9jfumc73d9eggg` as the known-good baseline before promotion.
- Publish only the newly approved target SHA after confirming CI, then check that Render reports `live` on that exact SHA and smoke the homepage and public session/venue endpoints.
- If release checks fail, revert/publish the known-good FE release through the documented, authorized Render workflow; **do not change the backend, database schema, or enable auto-deploy as part of frontend rollback**.

## Deployment sequencing

1. Freeze the combined FE #128 candidate (which includes FE #125). Allow only defect fixes and evidence updates. Keep backend DB changes out of this frontend release.
2. Preserve the passing synthetic CI evidence above; complete real browser E2E and owner sign-off. Any candidate source change requires revalidation against the new frozen HEAD.
3. On approval, merge FE #125 first and FE #128 next into `preview/render-fullstack`, confirming the merge-base after each operation and revalidating the exact resulting target SHA. Request **separate explicit approval** for the FE merge and the manual Render publication. Auto-deploy remains off unless separately authorized.
4. Treat BE #127 auth hardening as an independent approved release. Confirm allowed frontend Origin, refresh cookies, Google OAuth and MFA on the combined version before deploying the security candidate.
5. Treat BE #124/Liquibase national venues as a **separate controlled data migration**; do not couple to desktop publication while the real backup and duplicate gates remain open.

## Safety/expense rules

No implicit merges, deployments, database writes, service changes or new paid products. Use free public GitHub Actions CI where possible; prefer one complete validation per candidate over duplicated workflows. Never run the production migration based solely on fixture results. Preserve production data and a verifiable rollback plan.

**Decision checkpoint:** frontend unit tests/build alone are not sufficient to declare the release ready. Once E2E, compatibility and owner-approval gates are met, choose an explicit SHA and publish in a controlled way.
