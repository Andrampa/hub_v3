# Changelog

All notable documentation and implementation changes. Most recent entry first.

## Current State

- Status: public catalog, country explorer, protected data workspace, and DIEM community authentication implemented
- Active branch/workflow: `main`, uncommitted initial setup
- In progress: end-to-end community-account acceptance test; see `docs/handoff.md`

## Lessons Learned

- 2026-07-16: The supplied microdata, aggregated, guide and boundary items reject anonymous metadata requests, so the data page must authenticate before inventory loading and preserve ArcGIS item/group authorization.
- 2026-07-16: Large or heterogeneous ArcGIS datasets should initially use the authoritative item download workflow; native browser exports require service-by-service capability and size validation.
- 2026-07-16: Protected feature services can power an internal explorer after ArcGIS has authorized the item; schema-driven filters and bounded browser exports avoid duplicating data or exposing credentials.

- 2026-07-16: Group-specific category assignments are returned by `/content/groups/{groupId}/search`; global search is insufficient for the country experience.
- 2026-07-16: Observed country assignments can be ahead of the group category schema, so the directory must derive from item assignments and normalize defensively.
- 2026-07-16: Generalized world geometry omits some small island states; the searchable directory must remain the complete navigation surface.

- 2026-07-16: The new OAuth application's organization-specific authorize screen already provides community account creation, so Hub 3.0 does not need to reuse or modify the current Hub client ID.
- 2026-07-16: Vite 8 requires Node 20.19 or newer; this repository pins Vite 6 for compatibility with the available Node 20.18 runtime.
- 2026-07-16: The public content group contains more than 1,000 records and requires pagination; exact totals must be derived live.
- 2026-07-16: Titles, tags, summaries, and thumbnails are not uniformly populated, so UI classification and fallbacks must remain defensive.
- 2026-07-16: Title prefixes are too inconsistent for a defensible country count; the overview uses an exact content-format count instead.

## 2026-07-16 - codex - DIEM community authentication

- Added ArcGIS authorization-code OAuth with PKCE using independent client ID `7ZnjQhVHwjuYi1FM`.
- Added strict enabled-user validation against community organization `D5aXW6TZFpeM2wke`.
- Added sign-in, community account creation, same-tab session restoration, sign-out, and error states.
- Added an HTTPS localhost callback and documented redirect/cutover safeguards.

## 2026-07-16 - codex - Protected DIEM data workspace

- Added a login-only `/data` route with an informative anonymous gate.
- Added protected microdata, aggregated datasets, multilingual guides, boundaries, metadata, API/tooling, citation and licensing sections.
- Added item-level ArcGIS permission checks and access-request states without exposing the identity manager or tokens to page components.
- Added responsive layouts down to 320px and documented the access and download contracts.

## 2026-07-16 - codex - Internal dataset explorer

- Replaced protected dataset actions that opened ArcGIS Online with internal `/data/:datasetId` explore routes.
- Added live feature-service map previews, table previews, safe attribute filters, matching counts and token-free API links.
- Added bounded authenticated CSV and GeoJSON exports so users can download current filtered data from within Hub 3.0.

## 2026-07-16 - codex - Country explorer

- Added routed country discovery over the live 970-item DIEM country group.
- Added a projected world map, region filters, ISO3/name search, and a complete 54-country directory.
- Added country and cross-country profiles with product, query, year, sort, pagination, and shareable URL state.
- Added defensive group-category normalization and documented the publisher contract and SPA hosting requirement.

## 2026-07-16 - codex - Public catalog foundation

- Created the Tier M React, TypeScript, and Vite project.
- Added the live paginated ArcGIS Online catalog service.
- Added overview statistics, format visualization, search, filters, sorting, cards, and responsive states.
- Added focused project, architecture, service, workflow, journey, and agent-context documentation.
