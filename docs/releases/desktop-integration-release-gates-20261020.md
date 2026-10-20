# Jynlo desktop integration — release gates (20 Oct 2026)

**Status:** DRAFT / NOT LIVE. This is a release checklist, not permission to merge or deploy.

## Candidate and boundaries

- Frontend candidate: [FE PR #125](https://github.com/Miguel14Ferreira/desporto24FE/pull/125), branch `integration/desktop-pestana-20261020`, targeting `preview/render-fullstack`.
- Sources: FE #122 (discover/sessions/venues), FE #123 (auth UX), FE #124 (public homepage), followed by bounded desktop quality/participation/organizer fixes in #125. The candidate is large (~51 changed paths before this document); **do not add unrelated features to this release**.
- Backend **LIVE base**: `feature/desporto24-preview-deploy`, commit `ac07f09c492d36c74c6fcb02456a7b56e3e3ec33`. The FE may be reviewed against this existing API for read-only compatibility.
- Backend **security candidate**: [BE #127](https://github.com/Miguel14Ferreira/desporto24BE/pull/127), draft, **not live**. It combines refresh cookie Origin validation + temporary login throttle; it requires real-flow QA before deployment. Do not assume BE #127 is required to test FE #125 locally or deploy it together without review.
- Backend **venue catalogue candidate**: [BE #124](https://github.com/Miguel14Ferreira/desporto24BE/pull/124), draft, **not live**. Its Liquibase PostgreSQL 16 fixture tests pass, but the production backup/restore check and actual-data duplicate review, including São Jacinto, remain blockers for this *separate* data release.
- Render FE service `desporto24-web` stays on `preview/render-fullstack`; auto-deploy is disabled. No automatic publication occurs from PR work.

## Release gates

- [x] Integrated candidate uses an explicit draft PR, leaving LIVE untouched.
- [x] Complete Angular Jasmine suite and production build passed on the preceding FE commit `75a8dd1`: [CI run](https://github.com/Miguel14Ferreira/desporto24FE/actions/runs/39448336341), **842/842 tests**. This does not validate later commits.
- [ ] Complete Angular suite **and production build pass on the *final frozen HEAD*** of FE #125. Preserve the exact SHA and run URL in the PR before approval.
- [ ] Browser E2E on the **candidate built from that exact HEAD**, not the current LIVE website. Prefer desktop. Verify screenshots/no console errors. Do not equate Jasmine unit tests with E2E.
- [ ] Guest homepage: no login required; public session search and bounded venues load; empty/error/retry states; session/venue values are not invented.
- [ ] Guest shared link `/sessions/:id`: OPEN, FULL, cancelled, nonexistent, wrong/invalid IDs, malformed dates and no participant-identity leakage. Follow login/registration return URLs without automatic joining.
- [ ] Auth on desktop: email/username login, Google OAuth, MFA, confirmation/recovery, and return-to-session behavior (including opening confirmation emails in another browser). Do not send test credentials to CI logs.
- [ ] Signed-in discover: available vs FULL waitlist, private/community-only exclusion, unknown venue environment, district/venue search and approximate Google Maps fallback for missing coordinates.
- [ ] Session flow: join, leave, promotion notification, current membership/waitlist position, organiser roster access without joining, confirmed vs externally counted places, private-session restrictions.
- [ ] Visual review in PT and EN at typical desktop widths; check layout, navigation, errors, accessibility and mobile overflow (mobile product polish can follow desktop, but no broken viewport).
- [ ] Public read-only API smoke on the LIVE backend can provide compatibility evidence; **never mutate production data through the smoke test**.
- [ ] Explicit owner approval to merge; confirm current target branch has not diverged, CI applies to final HEAD, and only intended commits are included.
- [ ] Explicit owner approval for Render deploy, separate from merge approval; assess minutes/cost and publish only a selected SHA. Validate live SHA, service health and rollback path.

## Deployment sequencing

1. Freeze FE #125: only defect fixes and evidence updates. Keep backend DB changes out of this frontend release.
2. Run final CI; perform candidate browser E2E using isolated/mocked or disposable test data; record the exact HEAD.
3. When ready, request **separate explicit approval** for FE merge and Render publication. Autodeploy remains off unless separately authorized.
4. Treat BE #127 auth hardening as an independent approved release. Confirm allowed frontend Origin, refresh cookies, Google OAuth and MFA on the combined version before deploying the security candidate.
5. Treat BE #124/Liquibase national venues as a **separate controlled data migration**; do not couple to desktop publication while the real backup and duplicate gates remain open.

## Safety/expense rules

No implicit merges, deployments, database writes, service changes or new paid products. Use free public GitHub Actions CI where possible; prefer one complete validation per candidate over duplicated workflows. Never run the production migration based solely on fixture results. Preserve production data and a verifiable rollback plan.

**Decision checkpoint:** frontend unit tests/build alone are not sufficient to declare the release ready. Once E2E, compatibility and owner-approval gates are met, choose an explicit SHA and publish in a controlled way.
