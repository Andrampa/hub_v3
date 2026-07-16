# Architecture

## System Overview

```text
Browser
  -> React UI, auth state, and client-side filters
  -> ArcGIS OAuth with PKCE (optional community session)
  -> typed ArcGIS catalog service
  -> ArcGIS Online Portal REST API
  -> authoritative item/resource links
```

The initial release is a static single-page app with no custom backend or database.

## Startup / Execution Sequence

1. The router selects the homepage, country explorer, country detail, or protected data page.
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
- `src/pages/DatasetExplorer.tsx`: internal map, filter, preview, export and API experience for a protected data service.
- `src/components/DatasetGeometryMap.tsx`: projected service geometry over a published world basemap.
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
- Tokens and the identity manager stay outside page components; protected resources are requested through `AuthContext.requestProtected`.
- Data explorer API links never embed a token; browser exports use in-memory authenticated requests with a bounded record limit.

## Infrastructure

Any static host that supports the Vite `dist/` output and rewrites SPA routes to `index.html` is sufficient. Hosting and deployment are not yet selected.
