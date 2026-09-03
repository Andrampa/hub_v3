# Architecture

## System Overview

```text
Browser
  -> React UI, auth state, and client-side filters
  -> ArcGIS OAuth with PKCE (optional community session)
  -> typed ArcGIS catalog service
  -> ArcGIS Online Portal REST API
  -> public ArcGIS light-gray basemap tiles
  -> existing DIEM Hub packaged-download generator (transitional)
  -> authoritative item/resource links
```

The initial release is a static single-page app with no custom backend or database. Packaged dataset formats temporarily reuse the existing DIEM Hub download generator; this is an external runtime dependency, not a competing data store.

## Startup / Execution Sequence

1. The router selects the homepage, complete product catalog, household monitoring release board,
   full-screen survey Explorer, hazard-impact assessment page, flood-services
   page, About DIEM overview, contact page, country explorer, country detail,
   or protected data page.
2. The selected screen starts its group requests; country routes share a cached country-catalog promise.
3. The service reads the total and requests remaining 100-item pages.
4. The UI derives overview counts or authoritative group-category assignments.
5. Search and filters operate locally over the loaded public catalog.
6. Item cards open the authoritative resource URL or ArcGIS item page.

The homepage derives its moving Latest evidence strip, focused evidence cards
and publication figures from the already-loaded public catalog. The complete
filterable collection lives at `/catalog`; homepage search passes its query to
that route. Popup configuration loads independently through the promotion
service, so a campaign failure does not block discovery.

Authentication initializes independently. It restores a same-tab session when present; otherwise public catalog loading remains anonymous. Interactive sign-in uses a popup callback, then validates the returned ArcGIS user's community organization before exposing an authenticated state.

The `/data` route requests no protected item metadata for anonymous visitors. After login it uses the context-owned authenticated request closure to resolve each configured item. ArcGIS responses determine available, restricted, and error states.

## Core Modules

- `src/App.tsx`: homepage pathways, recent evidence, programme figures and campaign state.
- `src/pages/Catalog.tsx`: complete public-catalog search, URL-backed filters, sorting and pagination.
- `src/hooks/useCatalog.ts`: shared public-catalog loading, retry and abort lifecycle.
- `src/main.tsx`: browser routing and lazy-loaded country screens.
- `src/pages/CountryExplorer.tsx`: map, region filters, search, and directory.
- `src/pages/CountryDetail.tsx`: country profile and resource-library state.
- `src/components/CountryEveOverview.tsx`: optional country-specific EVE
  regular-monitoring action.
- `src/services/eve.ts`: dynamic ADM0-table resolution, cached EVE country
  eligibility and validated Overview deep links.
- `src/pages/HazardImpactAssessments.tsx`: hybrid Living Shock Atlas, latest-assessment row, dossier library and evidence timeline.
- `src/services/impactAssessments.ts`: exact-tag eligibility, group-category normalization and assessment summaries.
- `src/components/ImpactAtlasMap.tsx`: category-driven map selection for the hazard-impact catalog.
- `src/services/countries.ts`: country-group pagination, category normalization, and summaries.
- `src/services/countryEditorial.ts`: public editorial-view discovery, country introduction queries, and highlighted-item resolution.
- `src/components/CountryEditorial.tsx`: sanitized rich text, country imagery, and curated evidence cards.
- `src/services/hubPromotions.ts`: promotion channels, ArcGIS view contract, validation, compatibility fallback, and built-in carousel slides.
- `src/components/LatestEvidenceBanner.tsx`: catalog-derived recent-evidence strip and motion controls.
- `src/components/HubAreaCards.tsx`: static programme/country pathways plus the manual Products, Research and Risk portfolio carousel.
- `src/components/FeaturedEvidence.tsx`: compact recent-evidence selection for the homepage.
- `src/components/EditorialPopup.tsx`: dwell/scroll-triggered, dismissible featured campaign.
- `src/components/CountryMap.tsx`: projected published world geometry.
- `src/pages/DataAccess.tsx`: protected data gate and authenticated workspace.
- `src/pages/HouseholdMonitoring.tsx`: the `/monitoring-system` survey release
  board and household monitoring product library.
- `src/components/MonitoringProducts.tsx`: country-and-round product discovery,
  controlled filters and product links below the release board.
- `src/services/monitoringProducts.ts`: Hub-group eligibility, monitoring-round
  item-ID matching and product-category normalization.
- `src/pages/MonitoringSystem.tsx`: the `/monitoring` shell, which embeds the
  live DIEM monitoring dashboard full screen.
- `src/services/monitoringEmbed.ts`: monitoring-app URL configuration, bridge message validation, visualization-state normalization, and Hub URL construction.
- `src/services/monitoring.ts`: public monitoring-statistics and survey-schedule queries, legacy rule normalization, pagination and response validation.
- `src/pages/FloodServices.tsx`: public DIEM flood-service pathway, EVE 2.0 capability presentation, VISTA reference access, catalog-driven flood assessments filtered on the `Shock types/Flood` category, and the DIEM Community access route.
- `src/pages/AboutDiem.tsx`: public programme overview, evidence-cycle pathways,
  official introductory/user-story videos and community newsletter invitation.
- `src/pages/Contact.tsx`: embedded and direct DIEM contact-form access.
- `src/pages/PhotoGalleries.tsx`: native public gallery discovery, country
  filtering, resilient Flickr thumbnails and direct album links.
- `src/services/photoGalleries.ts`: published-row queries against the public,
  read-only ArcGIS gallery catalogue plus Flickr URL validation.
- `src/pages/DatasetExplorer.tsx`: internal map, filter, preview, export and API experience for a protected data service.
- `src/components/DatasetGeometryMap.tsx`: Leaflet map over the public ArcGIS light-gray basemap, with filtered service geometry, tooltips, popups and extent controls.
- `src/services/protectedData.ts`: protected item manifest and permission-aware metadata resolution.
- `src/services/dataExplorer.ts`: feature-service discovery, safe filter clauses, previews, exports and API URLs.
- `src/data-access.css`: data workspace visual and responsive behavior.
- `src/services/arcgis.ts`: portal constants, pagination, fetch validation, resource URLs.
- `src/services/auth.ts`: OAuth configuration, session lifecycle, and community validation.
- `src/auth/AuthContext.tsx`: React authentication states and actions.
- `src/lib/catalog.ts`: metadata cleanup, dates, and provisional classification.
- `src/lib/productFamilies.ts`: exact family/language tag parsing, canonical
  variant selection, family-wide search text and language-link ordering.
- `src/types.ts`: remote and application types.
- `src/styles.css`: visual system and responsive behavior.

## Important Invariants

- Public-group membership defines the current catalog boundary.
- Hub content-group membership is the visibility boundary for every public
  product surface. Country discovery reads that group directly, requires the
  exact `Catalog role/Discoverable product` category, and never joins against
  or falls back to the retired Countries group.
- Hazard impact assessments are selected from Hub-group members carrying the exact `impact assessment` tag, excluding supporting service, web map and image types. Country, shock, role, scope and language facets come from that group's categories. The page does not infer multi-item event dossiers until a stable assessment/event identifier is published.
- Country and product assignments come from the Hub content group's
  `Countries`, `Product types`, `Catalog role`, and `Geographic scope`
  categories, never title inference.
- Item IDs are keys; title uniqueness is not assumed.
- Reviewed `DIEM-FAMILY:<canonical-item-id>` tags collapse translations into
  one public product on homepage and country discovery surfaces. Each variant
  remains independently linked, and untagged items remain one-item families.
- Reviewed `DIEM-LANGUAGE:<language>` tags are authoritative for variant link
  labels; title/category inference is only a compatibility fallback.
- Country highlights store item IDs only and render only when the referenced item remains in the active country's catalog.
- Theme and country inference never determines authorization.
- Promotion status, channels and hidden UI are editorial controls, never authorization.
- Flickr hosts gallery images, while ArcGIS item
  `24afb02b6cf549f99380cd6b3780691b` is the authoritative editorial catalogue
  for gallery titles, countries, dates, thumbnails and publication status.
- ArcGIS errors produce an explicit retry state.
- Authentication requires the exact community organization ID; authenticated status never replaces item-level ArcGIS authorization.
- Tokens and the identity manager stay outside page components; protected JSON and binary resources are requested through `AuthContext.requestProtected` and `AuthContext.downloadProtected`.
- Data explorer API links never embed a token; browser exports use in-memory authenticated requests with a bounded record limit.

## Infrastructure

Any static host that supports the Vite `dist/` output and rewrites SPA routes to `index.html` is sufficient. Packaged downloads also require the existing DIEM Hub generator to remain reachable and the source items to retain their export configuration. Hosting and deployment are not yet selected.

## Monitoring embed-link contract

The Hub treats the query string on `/monitoring` as dashboard visualization state and forwards it to the iframe. It adds only two reserved bridge parameters: `diemEmbed=hub` and `diemHubShareUrl`, the canonical Hub `/monitoring` URL calculated from the current browser origin and pathname. The dashboard must exclude those bridge parameters from its visualization state.

Current monitoring deployment: `https://diem-monitoring.apps.fao.org/`. This production origin is the application default. A deployment may override it with `VITE_MONITORING_DASHBOARD_URL`; the value must be a complete HTTP(S) base URL. Standalone Hub and dashboard sessions remain separate, but an embedded dashboard receives the active Hub's short-lived ArcGIS portal credential through the authenticated `postMessage` handoff documented in `docs/authentication.md`.

When embedded, the dashboard's **Copy link** action must use `diemHubShareUrl` as its base and append the current visualization parameters. When standalone, it must retain its own URL as the base. Neither application may hard-code a development or production Hub URL: the Hub supplies the value at runtime so a future production domain or route change needs no dashboard source edit.

Live synchronization uses a versioned `postMessage` contract:

- dashboard to Hub: `{ type: "diem-monitoring:url-state", version: 1, search }`;
- Hub to dashboard: `{ type: "diem-hub:url-state", version: 1, search }`.

`search` contains only the bounded visualization query string. The Hub accepts a dashboard message only when both `event.origin` matches the configured dashboard origin and `event.source` is the rendered iframe. The dashboard accepts a Hub message only from `window.parent` at the origin derived from the runtime `diemHubShareUrl`. Both sides strip the reserved integration parameters and reject payloads over 8,192 characters.

Dashboard-driven state replaces the visible Hub query with `history.replaceState`, so changing a control does not reload the iframe or create a synchronization loop. Hub route changes are sent back to the already-loaded iframe. The iframe remains independently usable: without valid embed metadata it reads and writes its own query/hash state and sends no parent messages.

### Monitoring domain transition

Hub-domain changes require no dashboard source change: deploy the Hub at the new origin and it supplies that origin through `diemHubShareUrl`. Monitoring-app-domain changes require setting `VITE_MONITORING_DASHBOARD_URL` in the Hub build. For a smooth transition:

1. deploy the same bridge-capable dashboard at both monitoring origins;
2. allow both monitoring origins in the Hub host's CSP `frame-src` and both Hub origins in the dashboard host's CSP `frame-ancestors`;
3. deploy the Hub with the new monitoring URL, then test standalone links, embedded deep links, live state synchronization, Copy Link, reload, and Back/Forward;
4. redirect old public routes to their new equivalents while preserving query strings; preserve URL fragments with a client-side transition page if old standalone hash links must migrate;
5. keep both CSP origins during the agreed transition window, then remove the old origin only after traffic and saved-link checks are clear.

The message bridge itself does not keep a static domain allowlist: each Hub build trusts only its configured iframe origin, while each iframe instance trusts only the parent origin supplied in its runtime canonical Hub URL. This permits old and new deployments to coexist safely during cutover.
