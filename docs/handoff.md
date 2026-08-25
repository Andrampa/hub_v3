# Handoff

## In Progress

The `/flood-services` page was restructured on 2026-08-25 to match the
consolidated EVE 2.0 platform in `C:\gitao-oer-eve-app`. Floodex and both
ArcGIS attachment-viewer field-reporting applications are retired; their
capabilities are now the EVE Exposure Model and Field Data modes. EVE 2.0 is
published at `https://diem-eve.apps.fao.org/`. The page presents a four-step
pathway, all eight EVE capabilities grouped, the VISTA reference with its
public Earth Engine comparison explorer
(`https://fao-oer.projects.earthengine.app/view/vistaproductscomparisonapp`)
and bucket browser (`https://diem.fao.org/vista/vista_bucket_browser.html`),
a catalog-driven assessment list and a DIEM Community access block.

Four EVE/VISTA interface figures were added on 2026-08-25 under
`src/assets/eve/`. The Field Data figure shows the Madagascar Cyclones Fytia
and Gezani workspace with real submissions; it was inspected before use and
contains no identifiable people, no reporter names and no precise addresses,
and its map points sit at country scale. Data-owner clearance for publishing
Madagascar and Mozambique field submissions on a public page was not
explicitly recorded; the editor authorized publication directly. Screenshots
age with the application, so recapture them when EVE's interface changes.

The assessment list reuses `fetchImpactAssessmentCatalog` and filters on the
reviewed `Shock types/Flood` category, which currently returns 37 items. That
category is only populated for items carrying the exact `impact assessment`
tag, so a flood product without that tag will not appear here; extending the
tag is an editorial decision, not a code change. `npm run build` passes and
anonymous verification at 375, 768 and 1280 px returned the live 37-item count,
no console errors and no horizontal overflow. Remaining: confirm with the
content owners that the VISTA bucket browser is an acceptable public link on
the Hub, and that `docs/DIEM_Flood_Package_Two_Pager.docx` should be reissued,
since it still presents Floodex and VISTA as standalone applications.

Country discovery has been cut over from the former Countries group to the
authoritative Hub content group. The final missing `COD` and `LBY` assignments
were applied and verified additively on 2026-08-25. Runtime country eligibility
now requires exact `Catalog role/Discoverable product`; country and product
facets use the Hub `Countries` and `Product types` branches, while the
cross-country route derives from `Geographic scope/Multi-country`.
`scripts/provision_country_editorial.py` follows the same contract and the
obsolete orphan-sharing script was removed. The former ArcGIS group has not
been deleted or unshared; that remains a separate owner decision after review.
Anonymous acceptance QA returned 54 countries and 815 public discoverable
product families; both multi-country products, the corrected DRC and Libya
questionnaires, supporting-component exclusion, Hub source links, singular
result copy and the 390 x 844 layout were verified with no console errors or
horizontal overflow.

The additive whole-catalog category audit is implemented in
`scripts/categorize_hub_catalog.py` and has been run once from the authenticated
ArcGIS Pro environment. That run was audit-only and made no ArcGIS changes.
The resulting `hub_catalog_category_review.csv` contains 1,084 editor-visible
Hub items, 316 additive proposals and 11 conflicts; all 1,084 rows remain
marked `review`, and every preservation check passed. The CSV is intentionally
Git-ignored because this repository is public while the authenticated audit can
include non-public item metadata. The exact next local file is
`hub_catalog_category_review.csv`: review its additions, conflicts,
catalog-role suggestions and product-type suggestions before designing a
separate application phase. Existing Hub category paths are authoritative;
the required invariant is that each row's `existing_hub_categories` remains a
subset of `final_expected_categories`. Re-run the audit only after preserving
editorial decisions and explicitly setting `OVERWRITE_AUDIT_CSV = "true"`.
The exact verification command remains `npm run build` in the repository.

The script now also contains guarded `prepare` and `apply` modes. Prepare mode
was run successfully on 2026-08-24: all 1,084 rows and their order were
preserved, the editable override/approval fields and audit signatures were
added, and a dated local backup was created. The review preparation was then
expanded with multilingual product-family proposals; these are presentation
relationships only and do not change ArcGIS categories or merge item IDs.
On 2026-08-24 the editor confirmed all proposed families: the CSV now records
39 approved families across 78 variant rows, with one canonical variant per
family. Conservative editorial pre-approval also populated 996 catalog roles,
829 normalized legacy product-type decisions and 996 `apply` decisions. All 11
conflict rows explicitly reject automatic country/scope additions so existing
Hub assignments remain unchanged; 88 low-evidence rows remain `review`.
The editor subsequently changed those 88 rows to `exclude` and corrected 82
product-type decisions. Excel converted all `modified` timestamps to scientific
notation; the local CSV was repaired from the trusted pre-Excel backup without
changing editorial fields. All 1,084 audit signatures now validate, with 996
`apply`, 88 `exclude` and zero `review` rows.
The reviewed Catalog role and Product types branches were added to the live Hub
schema with an exact 14-node guard. A representative ten-item pilot succeeded,
and all remaining approved rows were then assigned. The client process ended
before recording its final local status, so reconcile mode compared exact live
sets and marked them verified without another ArcGIS write. Final live preflight
reports 996 verified, zero pending and 88 editor-excluded rows unchanged. Every
original Hub category is preserved. The licensed interpreter is
`C:\Users\Amparore\AppData\Local\anaconda3\envs\env202409\python.exe`.

Multilingual family application is complete. The guarded
`scripts/apply_product_family_tags.py` workflow appended and group-scoped
verified exact `DIEM-FAMILY:<canonical-item-id>` and
`DIEM-LANGUAGE:<language>` tags on all 78 reviewed variants across 39 families;
zero variants remain pending and every pre-existing tag was preserved. The
homepage and country discovery surfaces now count, search, filter, sort and
paginate families while showing direct links for each reviewed language.
Anonymous browser QA returned 950 homepage products, 42 Niger products, no
unspecified visible language labels, successful French-variant search, no
console errors and no horizontal overflow at 390 x 844. Build verification
passes. This implementation is included in the current development change set.

The household monitoring product library is implemented below the arrival and
departure board. It joins Hub-group items to authoritative monitoring-round
item IDs and offers country, product type, year, language and search filters;
Interactive charts are intentionally not a product category. The live category
schema and item assignments still require an ArcGIS Pro session with an
initialized license. From that session, run
`scripts/configure_hub_group_categories.py` in dry-run mode and review the new
Monitoring products branch, then run
`scripts/categorize_monitoring_products.py` with its default `DRY_RUN = "true"`
and review `monitoring_product_category_review.csv`. The existing review CSV
has been prepared with `review_decision`: 364 high-confidence rows default to
`apply`, while 38 medium/low rows remain `review`. Resolve each remaining row
to `apply` or `exclude`; use the `override_*` columns only to correct a
proposed country, product type, language or scope. The categorization script
will refuse to assign anything while any row remains `review`. Only after
review, apply the schema first and the item categories second by changing the
corresponding safety switches. The exact application verification command remains
`npm run build`; category verification is also built into the assignment
script. The schema script is additive-only: it copies all existing
impact-assessment paths unchanged, adds the Monitoring products branch and
only the missing monitoring-country leaves `KHM` and `PSE`, and refuses to
write if a conflicting Monitoring products branch already exists. Attempts from the shell made no ArcGIS changes because the clone has a
broken `lxml` native dependency and the standard environment has no initialized
product license.

The product library now uses the existing Contributor capability
(`ad13b87919464cb6b9bb6cd8defa0257`) without changing the public release
board. Anonymous QA returned published-round products only, no unlinked “Other
resources,” preserved Full board/Arrivals/Departures, produced no browser
errors, and showed no page overflow at 375, 768, 1024 or 1440 px. A real
signed-in acceptance test remains: confirm a Contributor sees current incoming
product links and categorized unlinked resources, then sign out and confirm
they disappear immediately.

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
