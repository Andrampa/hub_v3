# Development Workflow

## Branching And Handoffs

The repository currently uses `main` and has no initial commit. Do not commit or push without explicit user instruction. Follow the short Claude/Codex worktree handoff rule in `AGENTS.md`.

## Local Run

```powershell
npm install
npm run dev
```

The development server uses `https://localhost:5173` because that exact OAuth callback origin is registered with ArcGIS. A browser may require local certificate acceptance on first use. Do not substitute `127.0.0.1` for authentication testing unless its callback is separately registered.

## Build

```powershell
npm run build
```

The build performs TypeScript project checking before producing `dist/`.

## Tests

No automated test framework is configured yet. Add one when behavior is complex enough to justify the dependency; do not treat build success as UI verification.

## Manual Verification Expectations

- Load the live public catalog and compare the total with ArcGIS.
- Exercise search, every filter, sorting, pagination, and no-result state.
- Open cards with direct URLs and cards that fall back to ArcGIS item pages.
- Check wide, tablet, and mobile layouts.
- Check `/countries`, a populated `/countries/:iso3` route, `/countries/cross-country`, URL-backed filters, map links, and country search.
- Confirm the live country total against ArcGIS and preserve directory access for countries without generalized map geometry.
- Simulate request failure and confirm retry messaging when changing the service layer.
- For authentication, follow the matrix in `docs/authentication.md`. Never use production administrator credentials for browser automation or store credentials in test files.
- For `/data`, verify the anonymous gate and use separate approved/unapproved non-administrator community accounts to test resource sharing. Confirm that sign-out removes protected metadata and actions.
- With an approved account, open each `/data/:datasetId` route, verify live service metadata, apply text and numeric filters, inspect both a spatial and table-only resource, export CSV/GeoJSON, and confirm copied API links contain no token.

## Documentation Workflow

Update the focused contract document and `docs/changelog.md` whenever behavior changes. Use `docs/handoff.md` only for unfinished work.

Production hosts must provide an SPA fallback to `index.html` for direct country-route navigation.
