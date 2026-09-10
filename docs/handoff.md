# Handoff

## Waiting on the publications editor: DIEM in fixed-publication citations

Status: the two-form citation contract (`docs/services_and_data.md#citations`)
is implemented, tested and on `main`. Andrea asked Paige (FAO publications
editor, 2026-09-10) whether leaving DIEM out of the fixed-publication form
(`FAO. Year. *Title*. Rome. URL.`) is deliberate, since the data citation
agreed earlier names `DIEM-Monitoring` and `In: DIEM Hub`.

- If she keeps her template: nothing to do; remove this entry.
- If DIEM should return: change `citationSegments` / `citationModel` in
  `src/lib/citation.ts` (the series-by-pathway mapping removed in this change
  is in git history), then update the static-form tests in
  `src/lib/citation.test.ts` and the Citations section of
  `docs/services_and_data.md`.
- Verify: `npx vitest run src/lib/citation.test.ts`, then `npm run build`.

## Pending ArcGIS work: retire the photo-gallery StoryMap wrappers

Country pages now read field photographs from the photo-gallery catalogue
(`24afb02b6cf549f99380cd6b3780691b`) and no longer need the StoryMap wrappers
that were created only to carry a Flickr link. **No ArcGIS change has been made.**
The 27 wrappers are still in the content group `ab8a43038b6347ac93507988f7e2a90b`,
still carry `Product types/Photo gallery`, `DIEM pillars/Household monitoring
system` and `Catalog role/Discoverable product`, and so still appear as country
products with a wrapper creation date instead of the field date.

### Step 1 — two catalogue rows record no country code (blocking)

`global-diem-activities-2024` and `irq-lbn-monitoring-2022` have an empty
`country_iso3`, so they reach no country page and no longer appear as their own
option in the gallery page's country picker. They remain listed under All
countries.

- Set `irq-lbn-monitoring-2022` to `IRQ;LBN`. The Hub then shows it on both
  country pages and on the cross-country page.
- Leave `global-diem-activities-2024` empty, or add an explicit scope column if
  global galleries should surface on the cross-country page. The Hub will not
  infer global scope from an empty field.

Note that the `DIEM 2024 - Photo Gallery` wrapper is categorised `Countries/PAK`
although its album is the global 2024 activities album. Do not copy that
assignment into the catalogue.

### Step 2 — backfill `legacy_item_id` (22 rows)

**Required before Step 3, though nothing is broken while it waits.** All 27
wrappers already send readers to their gallery: five through `legacy_item_id`,
the other 22 through the album read from the wrapper itself. That fallback needs
the wrapper to still be readable as a product, so it stops working the moment
Step 3 removes them from the group. Backfill first, then remove: doing it in the
other order leaves 22 Hub addresses dead-ending on "Product unavailable".

The mapping below was verified by comparing the Flickr album ID inside each
wrapper against each row's `flickr_url`, not by title, and every wrapper
matched. `irq-lbn-monitoring-2022` corresponds to two wrappers; record both,
separated by a semicolon.

| Wrapper item | Wrapper title | Country category | Catalogue row | `legacy_item_id` |
|---|---|---|---|---|
| `4d69851d11774fc6bb436108f423ed74` | Democratic Republic of the Congo - Photo gallery - Field mission | COD | `cod-field-mission-2025-07` | set |
| `abf39060608b4341b94a163b9dcd60b6` | Afghanistan - Photo gallery - Round 10 | AFG | `afg-monitoring-r10` | set |
| `e5f1726ba193445e9d79b9f024904bfd` | Chad - Photo Gallery - Round 8 | TCD | `tcd-monitoring-r8` | set |
| `b22ad08d56144be2b947a2564636a6e6` | Democratic Republic of the Congo - Photo gallery - Round 9 | COD | `cod-monitoring-r9` | set |
| `09c644077b054756918c502fce6f873a` | Chad - Photo Gallery - Round 7 | TCD | `tcd-monitoring-r7` | set |
| `a1e64777d4fa40859796aba1b9b60219` | Afghanistan - Photo Gallery - Round 9 | AFG | `afg-monitoring-r9` | to backfill |
| `3813345b89ec4cd2ac66d8164b77ad77` | DIEM 2024 - Photo Gallery | PAK | `global-diem-activities-2024` | to backfill |
| `8135c10847e548759ced2e5c49a1eaa2` | Sierra Leone - Photo Gallery - Round 12 | SLE | `sle-monitoring-r12` | to backfill |
| `cec78a2c06dd49cd896697c102c2d61f` | The Sudan - Photo gallery | SDN | `sdn-monitoring-r5-markets-livestock` | to backfill |
| `826a1ab8daf34d69989491122ae4aa39` | Pakistan - Photo Gallery - Round 5 | PAK | `pak-monitoring-r5` | to backfill |
| `ae704cae4f1f429f82262fbeda839712` | Nigeria - Photo gallery | NGA | `nga-inputs-r1` | to backfill |
| `b835b311171649fda644e28ca39a94ac` | Afghanistan - Photo gallery - Round 8 | AFG | `afg-monitoring-r8` | to backfill |
| `2927b91000214833bd34fb47fbee8f92` | Central African Republic - Photo gallery - Round 5 | CAF | `caf-monitoring-r5` | to backfill |
| `69c938229ce64678ba4a2cb9b3764ece` | Sierra Leone - Photo gallery - Round 11 | SLE | `sle-monitoring-r11` | to backfill |
| `0d8aded638cd42a387df0c77fc820d35` | Nigeria - Photo gallery - Round 6 | NGA | `nga-monitoring-r6` | to backfill |
| `7410f3d3b6e241c9acbbdcd9b3c7774f` | Chad - Photo gallery - Round 5 | TCD | `tcd-monitoring-r5` | to backfill |
| `fbf8aeef7a68455990a330c42aba9246` | Democratic Republic of the Congo - Photo gallery | COD | `cod-impact-ituri-2023-08` | to backfill |
| `3f740be1a5dc4b30a52d41b63c8e9b62` | Colombia - Photo gallery - Round 3 | COL | `col-monitoring-r3` | to backfill |
| `1ed19c38b6434205a19c17503fbe5391` | The Syrian Arab Republic - Photo gallery | SYR | `syr-impact-earthquake-2023` | to backfill |
| `eb002a5b919d49019604627bd68660c2` | Afghanistan - Photo gallery - Round 6 | AFG | `afg-monitoring-r6` | to backfill |
| `2195be40b125443d91dea90eaba0942a` | Sierra Leone - Photo gallery - Round 9 | SLE | `sle-monitoring-r9` | to backfill |
| `8158243997d54dfc9bd035c08eb9a5b7` | Guatemala - Photo gallery - Round 1 | GTM | `gtm-monitoring-r1` | to backfill |
| `c19d2a911002483788e289293501875f` | Iraq - Photo gallery - Round 8 | IRQ | `irq-lbn-monitoring-2022` | to backfill |
| `2967bf588f36424592cfee80af2a1c0c` | Lebanon - Photo gallery - Round 3 | LBN | `irq-lbn-monitoring-2022` | to backfill |
| `498a4c9d0d2444aeb2c0ddaaeb730db1` | Pakistan - Photo gallery - Round 3 | PAK | `pak-monitoring-r3` | to backfill |
| `da3e9a53ed6247d59703ee8b7da80c7e` | Somalia - Photo gallery - Round 4 | SOM | `som-monitoring-r4` | to backfill |
| `92ec8caf6e8a4e15ac055b838069699a` | Afghanistan - Photo gallery - Round 5 | AFG | `afg-monitoring-r5` | to backfill |

### Step 3 — remove the wrappers from the content group

Remove all 27 items from `ab8a43038b6347ac93507988f7e2a90b`. **Do not delete the
StoryMap items**: they stay public in ArcGIS, so links already circulating keep
resolving. Removing them from the group is what ends Hub discovery.

Expect country product counts and product-type counts to fall for AFG, CAF, COD,
COL, GTM, IRQ, LBN, NGA, PAK, SDN, SLE, SOM, SYR and TCD. That is the intended
outcome of galleries ceasing to be catalogue products, not a regression.

### Step 4 — retire the category and the code path

Once no item carries it, remove the `Product types/Photo gallery` branch from
the group category schema and drop `'Photo gallery'` from `PRODUCT_TYPES` in
`src/services/countries.ts`.

### Step 5 — legacy redirect: implemented

`/catalog/<wrapper-id>` resolves through `legacy_item_id` to
`/photo-galleries?gallery=<gallery-id>`, which shows that gallery with a link to
its Flickr album and a way back to the collection. It works both while a wrapper
is still in the group and after it is removed, so no Hub URL dead-ends and no
reader passes through a StoryMap. Rows without `legacy_item_id` are not
redirected, which is why Step 2 comes first.

Nothing here needs doing for galleries published from now on: a gallery with no
wrapper leaves `legacy_item_id` empty and is unaffected.

Verification after each ArcGIS step: `npm run build`, `npx vitest run`, then open
`/countries/AFG`, `/countries/TCD`, `/countries/IRQ`, `/countries/LBN`,
`/photo-galleries?country=AFG` and
`/catalog/4d69851d11774fc6bb436108f423ed74`, which must land on the DRC field
mission gallery.

## Resolved: hosting-only deploy fallback has been reverted

On 2026-09-08 the deploy was briefly reduced to
Hosting only because the Firebase Gen 2 Function secrets did not exist. CSI
(Eugenio) reported the configuration under way, and the fallback was reverted:

- `fao-oer-diem-hub` 7b5c8fcd reverts 6e92caf5 — `--only hosting,functions` and
  the `/api/microdata/invitations/validate` rewrite are both back.
- This repository 9815912 reverts 4a7abf1 — the `scripts/sync-web-repository.ps1`
  templates that regenerate those two files are back in their normal form. A
  clean re-run of the sync afterwards produced no drift, which is the check that
  the two repositories agree.

**Not yet verified against a live deploy.** The secrets
`DIEM_ARCGIS_ADMIN_CLIENT_ID` and `DIEM_ARCGIS_ADMIN_CLIENT_SECRET` were being
configured while this revert was made, and no deployment has been run since. If
Manual Deploy fails on a missing secret, CSI has not finished; re-apply the
fallback by reverting the two reverts rather than inventing a new one.

After a successful deploy, confirm that
`POST /api/microdata/invitations/validate` answers with JSON rather than the SPA
shell, then run the acceptance test described in the section below.


## Pending deployment: direct temporary-microdata invitation validation

The Hub frontend and Firebase Function scaffold now implement the same-origin
`POST /api/microdata/invitations/validate` contract. No credentials were added
and nothing was deployed. Before publishing, an FAO ArcGIS administrator must
create or select least-privilege OAuth credentials with explicit read access to
private registry item `e186ea5b20774a94914bfeda23242f43`, then configure
Firebase secrets `DIEM_ARCGIS_ADMIN_CLIENT_ID` and
`DIEM_ARCGIS_ADMIN_CLIENT_SECRET` in each intended environment. The credentials
must not use `Andrea.Amparore_hqfaohub`; that account has no role.

After the infrastructure decision is approved, the exact next deployment file
is `scripts/sync-web-repository.ps1`: run it to prepare
`C:\git\fao-oer-diem-hub`, inspect both repository diffs, and verify with
`npm test`, `npm test --prefix functions`, and `npm run build`. Then perform a
real acceptance test with an invited, enabled Community nonmember and confirm
that the Hub validates, accepts with the recipient token, reads membership back,
and reveals only that recipient's temporary views. The Manual Deploy workflow
must not be triggered without explicit authorization.

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

On 2026-09-04 the extent-loading loop was fixed by keeping the existing Leaflet
map mounted while a new extent query runs. Geometry requests now also discard a
stale ArcGIS `displayField` unless it exists in the live field schema; this is
required by administrative reference item `3596c3ad318849068eda21517ade30be`,
whose layer 0 advertises missing field `admin2Name_en`. Its equivalent corrected
public query returned 250 polygons successfully. Generated Python bulk scripts
now use a masked Tk dialog under IDLE and `getpass` in a real terminal. FileGDB
was not exposed: the live DIEM v1 `/filegdb` route returns 404, ArcGIS item
export is owner/admin-only, and this reference service has Sync disabled. The
required authenticated acceptance pass remains the two dataset routes named
above, plus running a newly generated Python script from IDLE.

## Resume Checklist

1. Run `git status --short`.
2. Read `AGENTS.md` and `docs/context_index.md`.
3. Run `npm run build`.
4. For authentication work, read `docs/authentication.md` and inspect `src/services/auth.ts` first.
5. For country work, read `docs/country_explorer.md` and inspect `src/services/countries.ts` first.
6. For protected downloads, read `docs/data_access.md` and inspect `src/services/protectedData.ts` first.
7. For Phase 2 export work, decide the FAO-approved hosting, queue and temporary object-storage platform before implementing the backend.

## Data access rework - Phase A shipped 2026-09-03, Phases B/C open

`/data` was restructured on 2026-09-03 around questionnaire generations, three
access tiers and a public guide. The design record is
`docs/data_access_strategy.md`; the shipped contract is `docs/data_access.md`.
Changed files: `src/services/protectedData.ts`, `src/services/dataExplorer.ts`,
`src/pages/DataAccess.tsx`, `src/pages/DatasetExplorer.tsx`,
`src/pages/DataGuide.tsx` (new), `src/main.tsx`, `src/data-access.css`.

Verification done: `npm run build` passes; anonymous `/data` and `/data/guide`
render with no console errors and no horizontal overflow at 375, 768 and 1280 px.

**Not verified, and the exact next task.** The authenticated workspace has never
been exercised with a real account. Sign in and run one pass per tier: a
brand-new account inside the ten-minute provisioning window (expect the
provisioning banner, not "additional access required"), a community member
without microdata access (expect aggregated data plus the licence and request
form, and the locked-microdata message), and a household-data group member
(expect the microdata datasets). Specifically confirm that the seven V3 Phase 5
item IDs resolve through `https://hqfao-hub.maps.arcgis.com/sharing/rest` the
way the older V2 items do; they are configured but have never been resolved by
this application. Verification command: `npm run build`, then the dev server.

**V3 is in the reference slot with test data.** Its Phase 5 services hold
simulated COD/NGA/TCD round-99 records. Every V3 manifest entry carries
`preview: true`, which drives a per-card flag and a section notice. This is
acceptable only while the Hub is off production. Before any production cutover,
confirm no preview flag is still set, or that real data has replaced the test
load. `REFERENCE_GENERATION` in `src/services/protectedData.ts` is the single
value controlling which generation leads.

**Phase B**, when the V3 rebuild lands: create one dissemination view per
published V3 table (1:1 pointer, no field hiding, community sharing, publication
metadata), replace the placeholder item IDs with the view item IDs, clear the
preview flags, and publish V3 field descriptions, codebook and SDMX metadata.

**Phase C**, microdata grants: add country and round selection to the ArcGIS
request form, then productionise the temporary-view, one-member-group and
revoke-on-expiry procedure. This is internal tooling and is deliberately not
described on the Hub.

**Cross-repository, not started.** The Monitoring dashboard still builds legacy
Hub links in `DATA_ACCESS_CONFIG.hubDatasetRoot`
(`C:\git\hh_survey_v3\development\phase6_web_app\js\core\config.js`). Hub 3.0 now
accepts `?country=ISO3&round=N` on `/data/:datasetId`; repointing that config and
settling the `_0` layer-suffix convention is a change in that repository.

Also open: who maintains `/data/guide` now that it supersedes the same material
in the dashboard user guide, and the dead CSS left in `src/data-access.css` from
the retired guide-language panel, collection switch and access pathway.

## Temporary microdata grants — code complete, live test outstanding

**Status: implemented, never resolved a real grant.** Typecheck, `npm run build`
and `npm test` (38 tests) pass. Every ArcGIS response in the tests is mocked, so
nothing about the Hub-side shape is confirmed against live ArcGIS.

Part 1 wrote `src/services/microdataGrants.ts`,
`src/components/TemporaryMicrodataGrants.tsx`, `fetchGrantDatasetDefinition` in
`src/services/dataExplorer.ts`, the `/data/grants/:datasetId` route and the
`catalogueVisible` exclusion. Part 2 (2026-09-07) reordered discovery to lead
with group membership, hardened metadata validation, and added
`src/services/microdataGrantInvitations.ts`,
`src/components/MicrodataInvitationNotice.tsx`, `assertCommunityAccount` in
`src/services/auth.ts` and `src/services/microdataGrantInvitations.test.ts`.
Behaviour and rationale are in `docs/temporary_microdata_grants.md`.

**The exact next task: the live pass with
`andrea.amparore_faohub_testaccount`.** Provision a grant for that Community
account from the FAO side, then, signed in as it, confirm in order:

1. before accepting, the header shows the pending-access notice, and `/data`
   shows no grants section at all;
2. the notice's group is tag-confirmed and offers in-place acceptance — if the
   group is unreadable before joining, the notice falls back to the ArcGIS
   notifications link and that is the supported behaviour, not a bug to fix;
3. accepting inside the Hub succeeds and the `/data` grants section appears
   without a reload;
4. `GrantDiscovery.source` — group membership is expected to carry it. If it
   reports `search` only, group enumeration failed and that is the finding worth
   recording; if it reports `groups` only, the supplementary search contributes
   nothing across organizations and can be removed.
5. the bundle shows the exact approved `(country, round)` pairs, the V3 core and
   optional views both open, and no filter in the explorer returns a row outside
   the approved scope;
6. download controls appear only if the grant was provisioned with
   `--allow-export`;
7. an unrelated Community account sees no notice and no grants section;
8. after revocation, the grant disappears on the next check;
9. the pending notice says the seven days started when the invitation was
   issued, and shows no date. Do not read the live test as confirming a
   seven-day window from acceptance: the clock started at issuance, so a grant
   provisioned days before the test may have less time left than expected, or
   none. If nothing resolves after a confirmed acceptance, check the issue date
   before treating it as a discovery failure.

Verification command: `npm test`, then `npm run build` and the dev server on
port 5173 signed in as the test recipient.

**Not verifiable offline.** The exact response shape of
`/community/users/<username>/invitations` and whether an invited non-member can
read a private FAO group are both assumptions; the code degrades to the ArcGIS
notifications link if either is wrong, and the live pass is what settles them.

**Deliberate:** the grants section renders nothing at all when the account holds
no grant — no empty state, no notice. Do not reintroduce one.

**Still open:** expiry dates and countdowns are not shown, because that needs a
secure server-side projection of the private registry and no backend exists. The
Hub shows active versus unavailable only, derived from ArcGIS rather than a
clock. There is no administration UI and none should be added; registering,
approving, provisioning, suspending and expiring grants are FAO Management tasks
run from the Python scripts in `hh_survey_v3/management/data_sharing`.
