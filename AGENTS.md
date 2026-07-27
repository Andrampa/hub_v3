# AGENTS.md

## Project

DIEM Hub 3.0 is a React/TypeScript public catalog over FAO DIEM content held in ArcGIS Online.

## Hard Rules

- ArcGIS Online is authoritative; do not copy catalog records into a competing source of truth.
- Keep general catalog endpoints in `src/services/arcgis.ts` and country-group contracts in `src/services/countries.ts`.
- Treat item IDs as stable identifiers. Titles, tags, URLs, and counts can change.
- Never expose ArcGIS client secrets, credentials, or long-lived tokens in browser code.
- Read `docs/authentication.md` before changing OAuth, sessions, redirect URLs, or protected requests.
- Read `docs/data_access.md` before changing protected datasets, item IDs, access-request behavior, or download links.
- Content visibility must eventually be enforced by ArcGIS sharing and the active user's token, not UI filters or tags.
- Existing apps and dashboards are external resources unless a task explicitly adds an integration.
- Preserve unrelated user changes and never commit unless explicitly requested.

## Architecture Short Form

`main.tsx` owns routing; `App.tsx` owns the homepage; `pages/Country*.tsx` own country discovery; `pages/DataAccess.tsx` owns the protected workspace. `services/arcgis.ts` owns shared remote utilities, `services/countries.ts` owns country category normalization, and `services/protectedData.ts` owns protected item configuration. See `docs/architecture.md` before changing boundaries.

## Design Style

Use FAO blue and deep blue as institutional anchors, orange sparingly for urgency/action, strong whitespace, accessible contrast, and evidence-led editorial language. Do not imply that provisional tag/title classifications are official DIEM taxonomy.

## Fragile Areas

- ArcGIS search is paginated to 100 records and returns mutable metadata.
- Homepage country/theme values are inferred presentation aids; country pages instead rely on mutable group-category assignments.
- Some items have missing summaries, thumbnails, tags, or repeated titles.
- External thumbnails and resources can fail independently from the catalog.
- Protected data items may be available to different ArcGIS groups; organization authentication is not proof of item access.

## Documentation

Use `docs/context_index.md` to select focused references. Update `docs/changelog.md` for notable changes and `docs/handoff.md` when work remains incomplete.

## Task Completion Protocol

1. Run `npm run build`.
2. Manually verify loading, empty/error states, filters, cards, links, and responsive behavior when UI changed.
3. Update focused docs if behavior or contracts changed.
4. Report changed files, verification, and remaining risks.

## Web Publishing Contract

`C:\git\hub_v3` is the complete development repository. The separate checkout
`C:\git\fao-oer-diem-hub`, whose `origin` must be
`https://github.com/un-fao/fao-oer-diem-hub.git`, is the public deployment
repository for Firebase Hosting.

When the user says “commit and push to web”, “commit and push to colleagues”,
or “commit and push to prod”, first commit/push any explicitly requested
development changes here, then run `scripts/sync-web-repository.ps1` to prepare
the deployment checkout. The deployment repository receives only the minimal
source required to build and deploy the React app: `src/`, the Vite entry HTML,
TypeScript/Vite configuration, package manifests, Firebase configuration, and
the deployment GitHub Actions workflow. Do not copy AI/agent context,
`.agents/`, `AGENTS.md`, `CLAUDE.md`, `CODEX.md`, internal documentation,
handoff material, local environment files, or generated `dist/` output.

The deployment workflow builds the app in GitHub Actions and Firebase publishes
`dist/`. Before committing there, inspect the diff and verify `npm run build`.
“Web” and “colleagues” mean the review/staging environment. “Prod” requires an
explicitly authorized production GitHub Actions deployment after the push; a
push alone must not be represented as production deployment.

Pushing either deployment repository does **not** deploy it. Both FAO deployment
repositories use the GitHub Actions **Manual Deploy** (`workflow_dispatch`)
workflow; the user runs it manually on `main` with environment
`fao-oer-review`. Do not trigger that workflow unless the user explicitly asks.

The embedded monitoring dashboard is at
`https://diem-monitoring-review.web.app/`; the Hub review origin is
`https://fao-oer-review.web.app/`, while `https://data-in-emergencies.fao.org/`
is the production Hub origin. For the cross-domain ArcGIS token handoff, read
`docs/authentication.md` before changing either iframe or authentication code.

## Agent Handoff Protocol

Record unfinished work in `docs/handoff.md` with status, exact next file, and exact verification command.

### Claude <-> Codex Worktree Handoff

Do not assume another agent's uncommitted changes are visible in a different worktree. State the branch, worktree, commit status, changed files, next file, and verification command. The receiving agent must inspect status before editing.

## Suggested Reading Order

1. `AGENTS.md`
2. `docs/context_index.md`
3. `docs/handoff.md` when work may be active
4. Only the focused documents routed by the context index
