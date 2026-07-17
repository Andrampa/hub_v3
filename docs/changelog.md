# Changelog

## 2026-07-17

- Hardened browser CSV and GeoJSON exports against silent ArcGIS pagination truncation; CSV now opens accented text reliably in Excel.
- Implemented the documented asynchronous ArcGIS Hub v1 packaged-download flow inside the authentication boundary, including same-origin token handling, polling, error-response detection and file-signature validation.
- Stabilized authentication request callbacks to avoid unrelated protected-data refreshes when UI error state changes.
- Made text `contains` filters treat `%` and `_` as literal user input instead of unintended SQL wildcards.
- Added a dedicated not-found route instead of sending unknown URLs to the country explorer.

All notable documentation and implementation changes. Most recent entry first.

## Current State

- Status: public catalog, country explorer, protected data workspace, and DIEM community authentication implemented
- Active branch/workflow: `main`, map/export improvements pending review
- In progress: end-to-end community-account acceptance test; see `docs/handoff.md`

## Lessons Learned

- 2026-07-16: ArcGIS polygon outer rings use the opposite winding direction from GeoJSON; conversion must reverse and group rings before D3 projection or the map renders the polygon complement.
- 2026-07-16: The current Hub publishes packaged downloads through `/api/download/v1/items/{itemId}/{format}`; the new frontend can bridge to it with the active identity while keeping direct CSV/GeoJSON queries local.
- 2026-07-16: The project deliberately defers the DIEM-owned asynchronous export service to Phase 2. The initial static portal retains a 20,000-feature browser-export limit and treats legacy Hub package generation as transitional.
- 2026-07-16: Every Phase 1 portal format is now gated at 20,000 matching records; country/round fields are prioritized and generated Python/R scripts support larger authenticated API extraction.
- 2026-07-16: The dataset preview now uses an interactive Leaflet/ArcGIS light-gray basemap with feature inspection, extent reset and a live Hub-style metadata stack.
- 2026-07-16: Corrected Leaflet layer ordering and excluded its renderer SVG from the global icon rule; DIEM geometry now retains its full map canvas and draws above reference tiles.
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
- Corrected ArcGIS polygon winding and added a wide reference map with selection, zoom, reset and clearer feature context.
- Activated authenticated Excel, Shapefile, KML/KMZ, File Geodatabase, GeoPackage and SQLite requests through the existing DIEM Hub generator.

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
