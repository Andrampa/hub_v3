# Handoff

## In Progress

Impact-assessment group categorization is complete for the 141 items carrying
the exact `Impact Assessment` tag in group
`ab8a43038b6347ac93507988f7e2a90b`. The live category schema includes the
reviewed country, shock, role, scope, language and DIEM-pillar branches.
`scripts/categorize_impact_assessments.py` assigned and group-scoped verification
confirmed every item; `impact_assessment_category_review.csv` records all 141
rows with `verified` status. Both provisioning scripts have safe dry-run
defaults for future reuse.

The first public Hazard Impact Assessments page is implemented at
`/hazard-impact-assessments`. It combines the Living Shock Atlas, a latest
editorial row, category-driven filters, individual assessment dossiers and an
alternate evidence timeline. Live anonymous verification returned 124 public
assessment resources, 45 represented countries and nine shock types; Nigeria
filtered to eight resources and the timeline grouped them by year. Desktop and
390 px mobile layouts were checked with no console warnings or errors. Related
resources remain individual dossiers until publishers add a stable
assessment/event identifier that can support explicit multi-item grouping.
The atlas SVG must remain excluded from the icon-only SVG rule in
`src/styles.css`; otherwise it collapses to `1.15em` at the map's top-left.

The homepage innovation code is complete: a catalog-derived Latest evidence
strip, manual programme carousel, and native dwell/scroll-triggered campaign
card are implemented and the production build passes. The carousel has reviewed
built-in content and the campaign service temporarily reads legacy public popup
item `015a1eabdb454d1c90fd9ad282e407e6`, so the code does not depend on immediate
ArcGIS provisioning. The compatibility reader discovers the live table ID
(`20`) from the service definition. Editors start with `docs/editor_guide.md`.

Editorial deployment remains an external administrator step. Run
`scripts/provision_hub_promotions.py` from an ArcGIS Pro Python environment,
record the returned production/staging view item IDs in the corresponding
deployment environments, and follow `docs/hub_promotions.md`. The exact next
code/configuration file is `.env.example`; the exact verification command is
`npm run build`. Before production deployment, manually verify `/` at desktop,
tablet and mobile widths, including banner pause/focus, every carousel link,
reduced motion, popup scroll/dwell timing, dismissal recurrence, and the
staging-to-production content transition.

The public catalog, country explorer, protected data workspace, internal dataset explorer, and OAuth with PKCE are implemented. End-to-end protected-data acceptance still requires human tests with one approved and one unapproved community account. The first required live check is `/data/499917f1518141209c2a6de55a79d991`: corrected polygon rendering, feature selection, zoom/reset, filters, CSV/GeoJSON, packaged Excel/Shapefile/KML/FileGDB/GeoPackage/SQLite downloads and token-free API links. Packaged downloads now follow the documented DIEM Hub v1 asynchronous generator contract, keep its required short-lived token inside the auth provider and reject status/error payloads or invalid file signatures. Verify that the current `where` clause is honored by every format and record any source item whose export configuration rejects a format.

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
