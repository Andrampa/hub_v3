# Development Workflow

## Branching And Handoffs

The repository currently uses `main` and has no initial commit. Do not commit or push without explicit user instruction. Follow the short Claude/Codex worktree handoff rule in `AGENTS.md`.

## Local Run

```powershell
npm install
npm run dev
```

The development server uses `https://localhost:5173` because that exact OAuth callback origin is registered with ArcGIS. A browser may require local certificate acceptance on first use. Do not substitute `127.0.0.1` for authentication testing unless its callback is separately registered.

The monitoring iframe defaults to the colleague-review deployment. Set
`VITE_MONITORING_DASHBOARD_URL` from `.env.example` when validating another
monitoring-app origin; never put credentials in this setting.

For anonymous visual checks in automated browsers that reject the local certificate, `npx vite --mode http-test` starts an HTTP-only server on `127.0.0.1:4174`. This mode is not valid for OAuth acceptance testing.

## Build

```powershell
npm run build
```

The build performs TypeScript project checking before producing `dist/`.

## Tests

No automated test framework is configured yet. Add one when behavior is complex enough to justify the dependency; do not treat build success as UI verification.

## Hub Catalog Category Audit

Run `scripts/categorize_hub_catalog.py` from an authenticated ArcGIS Pro Python
environment to prepare the complete Hub catalog review. The script is
audit-only: it reads the Hub and Countries groups, preserves every existing Hub
category path, proposes additions only for empty branches, and writes
`hub_catalog_category_review.csv`. It has no ArcGIS assignment operation.
The authenticated audit can include non-public editor-visible item metadata, so
this CSV is intentionally ignored by Git and must remain local.

The first run must keep `AUDIT_ONLY = "true"` and
`OVERWRITE_REVIEW_CSV = "false"`. Review conflicts and taxonomy suggestions in
the CSV before authorizing any separate application phase. Never overwrite a
CSV containing editorial decisions without preserving it first.

For every row, the required preservation invariant is:

```text
existing_hub_categories is a subset of final_expected_categories
```

Countries-group assignments are migration evidence only. When the Hub already
has a value in the same branch, the script preserves the Hub value and records
any disagreement for human review.

## Manual Verification Expectations

- Load the live public catalog and compare the total with ArcGIS.
- Exercise search, every filter, sorting, pagination, and no-result state.
- Open cards with direct URLs and cards that fall back to ArcGIS item pages.
- Check wide, tablet, and mobile layouts.
- On `/monitoring`, verify Hub-to-dashboard deep links, live dashboard-to-Hub URL updates, reload restoration, Back/Forward, Copy Link, standalone dashboard links, and rejection of messages from unrelated origins.
- Check `/countries`, a populated `/countries/:iso3` route, `/countries/cross-country`, URL-backed filters, map links, and country search.
- Confirm the live country total against ArcGIS and preserve directory access for countries without generalized map geometry.
- Simulate request failure and confirm retry messaging when changing the service layer.
- For authentication, follow the matrix in `docs/authentication.md`. Never use production administrator credentials for browser automation or store credentials in test files.
- For `/data`, verify the anonymous gate and use separate approved/unapproved non-administrator community accounts to test resource sharing. Confirm that sign-out removes protected metadata and actions.
- With an approved account, open each `/data/:datasetId` route, verify live service metadata, apply text and numeric filters, inspect both a spatial and table-only resource, export CSV/GeoJSON and each enabled packaged format, and confirm copied API links contain no token. Inspect at least one polygon layer for correct ring rendering, feature selection, zoom and reset behavior.

## Documentation Workflow

Update the focused contract document and `docs/changelog.md` whenever behavior changes. Use `docs/handoff.md` only for unfinished work.

Production hosts must provide an SPA fallback to `index.html` for direct country-route navigation.

## Web Publishing

The FAO deployment repository is a deliberately minimal source-only checkout at
`C:\git\fao-oer-diem-hub`; it is not a second development workspace. To prepare
it after an approved change, run:

```powershell
.\scripts\sync-web-repository.ps1
```

The script validates the target path and Git remote, then copies an explicit
allowlist of the React source and build configuration. It excludes agent/AI
context, internal documentation, local environment files, and `dist/`. Inspect
the target repository’s diff, then commit and push it independently. Use
`-AllowDirtyDeploymentRepository` only for an intentional, reviewed migration.
