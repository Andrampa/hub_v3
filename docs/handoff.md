# Handoff

## In Progress

The public catalog, country explorer, protected data workspace, internal dataset explorer, and OAuth with PKCE are implemented. End-to-end protected-data acceptance still requires human tests with one approved and one unapproved community account. The first required live check is `/data/499917f1518141209c2a6de55a79d991`: corrected polygon rendering, feature selection, zoom/reset, filters, CSV/GeoJSON, packaged Excel/Shapefile/KML/FileGDB/GeoPackage/SQLite downloads and token-free API links. Packaged downloads now use the existing DIEM Hub v1 generator; verify that the current `where` clause is honored by every format and record any source item whose export configuration rejects a format.

The decision is to defer the DIEM-owned large-export backend to Phase 2. Phase 1 remains a static React deployment with ArcGIS Online as the authoritative backend. Every portal download format is disabled above 20,000 matching records; the UI recommends country/round filters and generates Python/R object-ID batching scripts for bulk API extraction. Phase 2 must replace the legacy Hub generator with a DIEM API, job queue/worker, temporary object storage and expiring download URLs before Hub can be retired permanently.

The dataset map now uses Leaflet with public ArcGIS light-gray base/reference tiles, pan/zoom, filtered-extent reset, feature hover/click details and a Hub-style item/layer metadata stack. Reference tiles are held in a dedicated pane below vector geometry. Leaflet's renderer classes are excluded from the global icon SVG rule; without that exclusion the vector canvas is clipped to `1.15em` and features appear missing even though bounds are valid. Build verification passes, but the authenticated map, filters, generated scripts and real downloads still need a human acceptance test because the Codex in-app browser has no DIEM community session.

## Resume Checklist

1. Run `git status --short`.
2. Read `AGENTS.md` and `docs/context_index.md`.
3. Run `npm run build`.
4. For authentication work, read `docs/authentication.md` and inspect `src/services/auth.ts` first.
5. For country work, read `docs/country_explorer.md` and inspect `src/services/countries.ts` first.
6. For protected downloads, read `docs/data_access.md` and inspect `src/services/protectedData.ts` first.
7. For Phase 2 export work, decide the FAO-approved hosting, queue and temporary object-storage platform before implementing the backend.
