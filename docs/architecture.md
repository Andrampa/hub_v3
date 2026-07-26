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

1. The router selects the homepage, monitoring-system page, flood-services page, contact page, country explorer, country detail, or protected data page.
2. The selected screen starts its group requests; country routes share a cached country-catalog promise.
3. The service reads the total and requests remaining 100-item pages.
4. The UI derives overview counts or authoritative group-category assignments.
5. Search and filters operate locally over the loaded public catalog.
6. Item cards open the authoritative resource URL or ArcGIS item page.

Authentication initializes independently. It restores a same-tab session when present; otherwise public catalog loading remains anonymous. Interactive sign-in uses a popup callback, then validates the returned ArcGIS user's community organization before exposing an authenticated state.

The `/data` route requests no protected item metadata for anonymous visitors. After login it uses the context-owned authenticated request closure to resolve each configured item. ArcGIS responses determine available, restricted, and error states.

## Core Modules

- `src/App.tsx`: current screen, state, derived views, and components.
- `src/main.tsx`: browser routing and lazy-loaded country screens.
- `src/pages/CountryExplorer.tsx`: map, region filters, search, and directory.
- `src/pages/CountryDetail.tsx`: country profile and resource-library state.
- `src/services/countries.ts`: country-group pagination, category normalization, and summaries.
- `src/components/CountryMap.tsx`: projected published world geometry.
- `src/pages/DataAccess.tsx`: protected data gate and authenticated workspace.
- `src/pages/MonitoringSystem.tsx`: the `/monitoring` shell, which embeds the live DIEM monitoring dashboard and provides a new-tab fallback.
- `src/services/monitoringEmbed.ts`: monitoring-app URL configuration, bridge message validation, visualization-state normalization, and Hub URL construction.
- `src/services/monitoring.ts`: public monitoring-statistics and survey-schedule queries, legacy rule normalization, pagination and response validation.
- `src/pages/FloodServices.tsx`: public DIEM flood-service access and internal field-reporting access pathway.
- `src/pages/Contact.tsx`: embedded and direct DIEM contact-form access.
- `src/pages/DatasetExplorer.tsx`: internal map, filter, preview, export and API experience for a protected data service.
- `src/components/DatasetGeometryMap.tsx`: Leaflet map over the public ArcGIS light-gray basemap, with filtered service geometry, tooltips, popups and extent controls.
- `src/services/protectedData.ts`: protected item manifest and permission-aware metadata resolution.
- `src/services/dataExplorer.ts`: feature-service discovery, safe filter clauses, previews, exports and API URLs.
- `src/data-access.css`: data workspace visual and responsive behavior.
- `src/services/arcgis.ts`: portal constants, pagination, fetch validation, resource URLs.
- `src/services/auth.ts`: OAuth configuration, session lifecycle, and community validation.
- `src/auth/AuthContext.tsx`: React authentication states and actions.
- `src/lib/catalog.ts`: metadata cleanup, dates, and provisional classification.
- `src/types.ts`: remote and application types.
- `src/styles.css`: visual system and responsive behavior.

## Important Invariants

- Public-group membership defines the current catalog boundary.
- Country and product assignments come from the country group's `groupCategories`, never title inference.
- Item IDs are keys; title uniqueness is not assumed.
- Theme and country inference never determines authorization.
- ArcGIS errors produce an explicit retry state.
- Authentication requires the exact community organization ID; authenticated status never replaces item-level ArcGIS authorization.
- Tokens and the identity manager stay outside page components; protected JSON and binary resources are requested through `AuthContext.requestProtected` and `AuthContext.downloadProtected`.
- Data explorer API links never embed a token; browser exports use in-memory authenticated requests with a bounded record limit.

## Infrastructure

Any static host that supports the Vite `dist/` output and rewrites SPA routes to `index.html` is sufficient. Packaged downloads also require the existing DIEM Hub generator to remain reachable and the source items to retain their export configuration. Hosting and deployment are not yet selected.

## Monitoring embed-link contract

The Hub treats the query string on `/monitoring` as dashboard visualization state and forwards it to the iframe. It adds only two reserved bridge parameters: `diemEmbed=hub` and `diemHubShareUrl`, the canonical Hub `/monitoring` URL calculated from the current browser origin and pathname. The dashboard must exclude those bridge parameters from its visualization state.

Current monitoring deployment: `https://diem-monitoring-review.web.app/`. A deployment may override it with `VITE_MONITORING_DASHBOARD_URL`; the value must be a complete HTTP(S) base URL. Hub and monitoring authentication remain intentionally separate for now.

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
