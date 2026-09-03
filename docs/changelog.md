# Changelog

## 2026-09-02 - Document Hub concepts and editorial scope

- Added a concise overview of the Hub's data model, sections, discovery
  functions and editor-controlled content.
- Mapped the structure proposed in Josselin's email to accomplished, partial
  and not-yet-implemented functionality without treating planned sections as
  delivered.

## 2026-08-26 - Reframe the homepage around DIEM pathways

- Replaced the homepage full product grid with four static Hub-section cards
  for household monitoring, hazard impact assessments, flood services and
  country evidence, followed by a manual three-card carousel for the complete
  product catalog, DIEM-Research and DIEM-Risk. The two unpublished areas are
  visible but intentionally have no links.
- Routed flood discovery through `/flood-services` rather than linking to EVE
  or the retired Floodex application directly from the homepage.
- Added the dedicated `/catalog` route with URL-preserved search, content/theme/year
  filters, sorting, pagination, retry, empty states and authoritative source links.
- Kept the moving Latest evidence strip, linked it to the new catalog, and added
  a compact evidence-in-focus selection rather than repeating the full collection.
- Made homepage search open the catalog with its query and added a responsive,
  toggle-based mobile navigation menu that includes Products.
- Delayed featured campaigns until visitors reach the evidence-in-focus section
  and reduced the campaign footprint on small screens.
- Expanded Recently published across DIEM from three oversized cards to eight
  compact cards, using a four-column desktop grid and tighter image, copy and
  spacing proportions while retaining responsive layouts.
- Compacted the dedicated catalog into a four-column desktop grid with 16
  products per page, shorter imagery and two-line title/summary limits. Removed
  the redundant View resource link because the card image and title already
  open the same authoritative destination; distinct language links remain.
- Added compact FAO flag marks to catalog cards and a URL-backed Country
  filter. Both use publisher-managed `Countries` group categories and the
  shared country normalization contract rather than title inference.
- Added country flags to household-monitoring product groups and aligned
  country-page resource cards with the catalogue's denser four-column layout,
  including compact flags and removal of the redundant open-resource action.

## 2026-08-26 - Preserve link contrast across interactive states

- Corrected the shared FAO hover treatment so links remain visible on dark-blue
  panels and filled blue/orange actions, including the Countries cross-country
  strip, homepage hero, programme CTAs, editorial panels, protected-data cards
  and campaign popup.
- Kept corporate footer links dark on hover and keyboard focus against the
  footer's light background.

## 2026-08-25 - Restructure flood services around the consolidated EVE 2.0

- Rebuilt `/flood-services` around one platform, one reference and one decision
  product, replacing the previous four-application presentation.
- Retired the standalone Floodex link and both ArcGIS attachment-viewer
  field-reporting links; those capabilities now live inside EVE 2.0 as its
  Exposure Model and Field Data modes.
- Repointed EVE 2.0 to `https://diem-eve.apps.fao.org/`.
- Added a four-step evidence pathway and a grouped EVE capability presentation
  covering all eight modes under Observe, Contextualize, Anticipate, Verify and
  Deliver, marking Field Data restricted and Exposure Model country-conditional.
- Added a VISTA section describing the seasonal reference behind EVE's
  exceptional-flood separation, with the public Earth Engine comparison explorer
  and the VISTA product bucket browser.
- Added a catalog-driven flood impact assessment list that reuses
  `fetchImpactAssessmentCatalog` and filters on the reviewed `Shock types/Flood`
  category, so the page carries no second discovery contract.
- Replaced the internal-applications section with a single access block routing
  DIEM Community requests to the public Survey123 form, noting that the same
  approval covers the Hub's contributor surfaces.
- Added four interface figures captured on 2026-08-25 and stored in
  `src/assets/eve/`: the EVE Overview for Mozambique (first dekad February
  2026) as a full-width anchor, the Exposure model and Field Data views inset
  within their capability groups, and the VISTA comparison explorer inside the
  dark reference section. All are lazy-loaded with explicit dimensions and
  descriptive alt text; browser chrome was cropped from the Overview capture
  and the Google Earth Engine shell header from the VISTA capture.
- Extended the capability-group model with an optional `figure`, so a mode
  screenshot is a data change rather than a layout change.
- Added a third VISTA card linking the published user guide at
  `https://diem.fao.org/vista/user_guide.html`, verified live before wiring.
- Added the VISTA consortium inside the VISTA section, on a white panel so the
  eight marks sit on a light ground within the deep-blue band. The consortium is
  scoped to VISTA alone: FAO and the European Commission's Joint Research Centre
  coordinate, with NOAA, RWTH Aachen University, the Dartmouth Flood Observatory,
  Columbia Climate School, WFP and Google contributing. Other flood-service
  components reuse open data such as the JRC RP20 scenario without that being a
  partnership, so no page-wide partnership claim is made.
- Added seven partner marks to `src/assets/partners/`, trimmed of surrounding
  whitespace and normalized to 120px tall for retina; the existing FAO SVG is
  reused. Emblem marks (NOAA, DFO, WFP) render taller than wordmarks so the row
  reads as optically even.
- Audited the finished page and fixed what the audit found: the renamed dark
  section had fallen out of the `fao-adaptation.css` dark-context selector
  lists, leaving its kicker at 1.73:1 on deep blue; a lone capability shrank to
  one auto-fit track whenever its group also carried a figure; and eight muted
  or accent colours failed WCAG AA. All page text now meets AA.
- Replaced the dead `.field-services` entry in both dark-context lists with
  `.flood-reference`, and darkened `.programme-section-heading > p` from
  `#6b7c82` to `#5d7077`, which also lifts the monitoring and contact pages.
- Renamed the homepage `floodex` programme slide to a flood-exposure slide and
  refreshed the EVE slide copy; removed the flood-intro, flood-services,
  field-services and field-contact-link styles that no longer had markup.

## 2026-08-25 - Retire the separate Countries content group

- Switched country discovery to the authoritative DIEM Hub content group and
  its reviewed Countries, Product types, Catalog role and Geographic scope
  categories.
- Added and verified the final `COD` and `LBY` country assignments without
  removing any existing Hub category.
- Limited country cards to exact Discoverable product assignments, derived the
  cross-country route from Multi-country scope, and removed the obsolete
  orphan-sharing workflow.
- Updated country-editorial provisioning to seed countries and highlights from
  discoverable Hub products rather than the former Countries group.

## 2026-08-25 - Household surveys navigation and release-board copy

- Renamed the first Household Surveys menu option to Surveys catalogue and
  clarified that it provides access to surveys and products.
- Renamed the release board to Incoming and published surveys and clarified
  that country briefs and other products are added when they become available.

## 2026-08-24 - Production monitoring embed

- Switched the Hub's default embedded Monitoring application from the Firebase
  review origin to `https://diem-monitoring.apps.fao.org/` while retaining an
  explicit environment override for review-origin testing.

## 2026-08-24 - Guarded catalog category review and application

- Expanded the whole-catalog categorization script with separate audit,
  local-review preparation and explicit application modes.
- Added Excel override fields for additive paths, catalog role and unified
  product type, while keeping existing Hub category paths immutable.
- Added stale-audit detection, exact approved-count and pilot limits, managed
  branch/schema validation, dated local backups, bounded batches and exact
  group-scoped read-back verification.
- Documented the conflict, proposal, catalog-role and product-taxonomy review
  workflow and kept all authenticated review/backup CSVs out of the public
  repository.
- Added conservative multilingual product-family proposals using explicit
  family tags, normalized language-marked titles, or matching country/product
  series/round evidence; all inferred relationships require editorial approval.
- Provisioned and verified the reviewed Catalog role and Product types schema
  branches, then assigned and group-scoped verified all 996 approved additive
  item-category decisions; 88 editor-excluded rows remained unchanged.
- Added live preflight, explicit pilot allowlisting and interrupted-run
  reconciliation while retaining audit-only defaults and exact preservation
  checks.
- Applied and group-scoped verified the 39 reviewed multilingual families (78
  variants) using exact family and reviewed-language tags while preserving all
  existing item tags.
- Collapsed tagged translations into one product across homepage and country
  discovery counts, search, filters, sorting, pagination and cards, with direct
  English, French and Spanish variant links.

## 2026-08-24 - Homepage caption and dark-panel contrast

- Removed the anonymous "Sourced live from the DIEM content platform" caption
  below the homepage search field while preserving the signed-in session status.
- Replaced orange text with a high-contrast light-orange variant on dark-blue
  panels, including the homepage principles, country headers and selected
  product filters.

## 2026-08-20 - Additive Hub catalog category audit

- Added an audit-only full-catalog categorization script that compares the Hub
  and legacy Countries groups and generates an editor review CSV without any
  ArcGIS write capability.
- Made existing Hub category paths immutable in every proposal, limited
  automatic additions to empty branches, and surfaced country/scope conflicts
  rather than replacing established assignments.
- Added catalog-role and unified-product-type suggestions as review evidence;
  these proposed taxonomy branches are not provisioned or assigned by the
  audit script.

## 2026-08-20 - Timeline completeness

- The hazard-impact timeline now previews up to three assessments for every
  matching year and provides a per-year action to reveal the complete year,
  preventing preview cards from being mistaken for the full annual collection.

## 2026-08-10 - Household monitoring product library

- Added a Hub-group-gated household monitoring product library below the
  arrival and departure board, grouped by the authoritative country and survey
  round relationships in the monitoring service.
- Added search and controlled country, product type, year and language filters;
  interactive charts remain available from the release board but are not a
  product category or library filter.
- Added a `Monitoring products` group-category branch and a guarded ArcGIS Pro
  categorization script that writes a review CSV, preserves unrelated category
  assignments, applies in batches and verifies group-scoped readback.
- Changed the schema script to an additive-only merge: it copies the live
  impact-assessment schema unchanged and appends `Monitoring products` plus
  only the missing monitoring-country leaves (`KHM`, `PSE`); a conflicting
  branch stops the script without writing.
- Excluded exact `Impact Assessment` tag matches from the monitoring library
  when legacy monitoring links conflict with the product's published identity.
- Added Contributor-aware product visibility using the existing stable group
  capability: public/non-Contributor sessions see published-round products;
  Contributors also see current incoming-round links and categorized unlinked
  resources. The public arrival/departure board remains unchanged.

## 2026-08-09 - Impact-assessment taxonomy and contrast repair

- Added a controlled ArcGIS group-category schema covering countries, shock
  types, content roles, geographic scope, languages and the four DIEM pillars.
- Added guarded ArcGIS Pro scripts to create the schema, infer categories for
  exact `Impact Assessment` tag matches, apply assignments in batches and
  verify them through the group-scoped search endpoint.
- Categorized and verified 141 impact-assessment items and recorded the final
  assignments, confidence and review notes in
  `impact_assessment_category_review.csv`.
- Corrected FAO-theme heading and label contrast across the Hub's dark surfaces.
- Added the header-accessible Hazard Impact Assessments page: a live Living
  Shock Atlas, latest-assessments editorial row, category filters, assessment
  dossiers and evidence timeline backed by the Hub content group.
- Switched shared Hub inventory pagination to the group-scoped ArcGIS endpoint
  so public pages receive the group's category assignments reliably.
- Exempted the Living Shock Atlas from the legacy global icon-SVG sizing rule,
  restoring the world geometry at its intended responsive width.

## 2026-08-01 - FAO Design System 3.6.8 adaptation

- Added the supplied FAO Design System reference package under
  `.agents/skills/fao-design-system` and integrated its official theme and
  approved English three-line logo as application assets.
- Added the Bootstrap 5 and Bootstrap Icons peer dependencies required by the
  FAO theme, and standardized the public Hub on Open Sans, FAO Blue, caption
  blue, restrained orange, square controls, flatter surfaces and conventional
  public-subsite spacing.
- Rebuilt the header and footer around the corporate FAO patterns, including a
  direct FAO home link, accessible mobile navigation, all six required policy
  links and a current-year copyright.
- Retained the auto-scrolling Latest evidence ticker, programme carousel and
  animated count-up metrics as deliberate modern interaction patterns within
  the more institutional FAO visual frame.
- Reduced gradients, decorative geometry, oversized display typography,
  shadows and hover lifts across homepage, country and data-access surfaces
  while preserving ArcGIS catalog, authentication, filter, map and resource
  behavior.

## 2026-07-28 - Household Surveys navigation

- Replaced the primary Monitoring link with a Household Surveys dropdown
  offering Monitoring System and Household Survey Explorer.
- Moved the arrival and departure board off the homepage and onto the new
  `/monitoring-system` page, preceded by a prominent Explorer invitation.
- Preserved `/monitoring` as the full-screen embedded Explorer so existing
  country, round, theme, URL-state and authentication handoffs remain intact.

## 2026-07-28 - DIEM in numbers and the Hub-group visibility rule

- Replaced the catalog stats strip and the Resources by format bar chart with a
  two-tier DIEM in numbers card: the monitoring operation (surveyed households,
  surveys, countries covered) above evidence published (hazard impact
  assessments, public resources), dated "Since June 2020".
- Consumed the previously orphaned `fetchMonitoringStatistics` pipeline, which
  already read the legacy homepage statistics table without any caller.
- Dropped "content formats" and "themes represented": both counted taxonomy
  values rather than programme results. Provinces covered is not reproduced
  because the statistics table no longer carries the field.
- Named the product family "Hazard impact assessments" everywhere on the Hub,
  since "impact" alone does not say impact of what.
- Counted hazard impact assessments from the already-loaded catalog, so the
  card adds one request in total, for the live monitoring figures only.
- Established the Hub-group visibility rule: a product outside the Hub content
  group is never shown. The country catalog now subtracts Countries-group items
  missing from the Hub group, reported as `diagnostics.outsideHubGroup`.
- Added `scripts/share-orphans-to-hub-group.ps1` to close the curation gap; it
  found eight legitimate products (EVE flood analyses, monitoring briefs, a
  questionnaire and reports) that the rule would otherwise hide.
- Held the countries-covered figure as a documented constant rather than a
  live distinct-value query, because it changes only when the programme starts
  monitoring a new country.
- Kept the card resilient: each tier fails independently, figures reveal once on
  scroll with a fallback so they never rest at zero, and animation is skipped
  under `prefers-reduced-motion` or in a hidden tab.

## 2026-07-28 - Arrival and departure board

- Restored the survey release list on the homepage as the arrival and departure
  board: household monitoring rounds ordered by arrival, above At a glance.
- Consumed the previously orphaned `fetchSurveyReleases` pipeline, which had
  survived the monitoring embed without any component rendering it.
- Presented the rounds as a split-flap terminal display with a live UTC board
  clock, staggered flap reveal, and Arrivals/Departures/Full board views with
  live counts, progressive row loading, and per-round product links including
  country briefs where the layer supplies them.
- Kept the display accessible: real table semantics, AA contrast on every board
  colour, and no motion under `prefers-reduced-motion`.
- Added Show all rounds beside Show more rounds, opening the board full screen
  with every round, a pinned bezel and column header, and Back to home plus
  Escape as the way out.
- Replaced the legacy Explore survey dashboard link with a thematic-area
  chooser that deep links into the embedded monitoring application at
  `/monitoring?iso=&round=&theme=`.
- Resolved offered thematic areas the way the monitoring application resolves
  them: native V2 rounds are probed against the same public V2 microdata and
  histogram layers, older rounds fall back to the per-theme legacy dashboards
  recorded on the survey row, and fisheries is never offered for legacy rounds.

## 2026-07-27 - Cross-repository web and authentication context

- Documented the Hub/Monitoring source and Firebase repositories, review and
  production origins, manual-deploy boundary, and embedded ArcGIS credential
  handoff in the authoritative authentication and publishing context.

## 2026-07-27

- Added the guarded source-only synchronization workflow for the FAO Firebase
  deployment repository, excluding AI/agent context and internal materials.
- Pinned the transitive `react-router` dependency to the Dependabot-patched
  8.3.0 release through the npm override contract.

## 2026-07-26

- Added a catalog-derived Latest evidence strip for current Impact assessment
  and Country brief items, including pause, mobile and reduced-motion behaviour.
- Added a manual, responsive Explore DIEM programme carousel without replacing
  the homepage's search-led hero.
- Rebuilt the legacy campaign iframe as a native dwell-and-scroll-triggered
  popup with stable-campaign dismissal recurrence and a legacy ArcGIS fallback.
- Added staging/production promotion channels, an ArcGIS Pro provisioning
  script, separate read-only view contract and editor runbook.
- Added one human-facing editor guide covering country introductions, country
  highlights, popup campaigns, programme slides, latest evidence and catalog
  metadata.
- Corrected the legacy popup compatibility reader to discover ArcGIS table
  `20` dynamically and moved its scroll trigger to the post-hero statistics.
- Added editor-managed country introductions and highlighted evidence above the
  country-page Evidence collection.
- Added safe optional HTML rendering, modern country-image panels, and
  responsive curated-resource cards.
- Provisioned a private two-table ArcGIS Online editorial source shared with the
  DIEM editor group and a public query-only view for the website.
- Seeded 55 country profiles from the legacy Hub country layer and 73
  deterministic demonstration highlights from recent country catalog items.
- Added the repeatable ArcGIS Pro provisioning script and editor runbook.
- Replaced enlarged 140×41 legacy thumbnails with the full 920×275
  `picture.jpg` attachments and redesigned the country narrative as a
  proportional banner followed by a readable editorial panel.
- Renamed the highlighted-resource section to **In evidence** and added optional
  plain-text or safe-HTML introductions above each curated card.
- Expanded the runbook with a non-technical editor quick guide and a
  Draft/Published review recommendation.
- Added a responsive Household monitoring panel to covered country pages,
  backed by an efficient ISO-filtered public-round query.
- Added latest-round and trends deep links into the Monitoring application,
  while retaining its anonymous validated/non-outdated visibility rules.
- Refined the panel copy to **Household monitoring system in {country}** and
  removed instructional public-access wording.
- Made Trends, Anomaly Detection, aggregated-data, and household-microdata
  actions conditional on the same ArcGIS access groups used by the Monitoring
  application.
- Expanded the country hero's Latest update calculation to include published
  editorial edits and newly published monitoring rounds as well as catalog
  resource modifications.

## 2026-07-26 - Live monitoring URL bridge

- Added versioned, origin-validated URL-state synchronization between the Hub `/monitoring` route and the embedded monitoring application without iframe reloads.
- Kept standalone monitoring query/hash links independent and made the monitoring deployment URL configurable with `VITE_MONITORING_DASHBOARD_URL`.
- Documented the shared embed contract, verification matrix, and smooth Hub/monitoring domain-transition procedure.

## 2026-07-19 - Unified monitoring survey pipeline

- Replaced the monitoring page's forthcoming-dashboard placeholder with a live, merged survey release feed sourced from the public `OER_Monitoring_System_View` ArcGIS layer.
- Preserved the legacy upcoming/published record rules, expected-publication estimate, exclusions, and established survey explorer/country brief links.
- Added search, status filters, live counts, progressive loading, responsive timeline cards, clear loading/error/empty states, and links for available survey products.
- Archived the supplied ArcGIS Dashboards definition as `docs/legacy/arcgis-dashboard-survey-release-lists.json` for reference.

## 2026-07-19

- Added public household-monitoring, flood-services and contact routes, with navigation and responsive layouts.
- Monitoring progress figures are read live from the public ArcGIS statistics table; the not-yet-hosted dashboard is explicitly marked as forthcoming.
- Added direct public access to EVE 2.0 and Floodex, clear internal-access labeling for Madagascar and Mozambique field-reporting applications, and the ArcGIS contact form.

## 2026-07-17

- Restored country world and profile-map rendering by excluding those SVGs from the global icon dimensions.
- Added image-based ISO flags to country-directory cards and changed the country explorer search to live product-title results.
- Kept local OAuth redirects pinned to the registered `https://localhost:5173/oauth-callback.html` callback during development.

## 2026-07-17

- Hardened browser CSV and GeoJSON exports against silent ArcGIS pagination truncation; CSV now opens accented text reliably in Excel.
- Implemented the documented asynchronous ArcGIS Hub v1 packaged-download flow inside the authentication boundary, including same-origin token handling, polling, error-response detection and file-signature validation.
- Stabilized authentication request callbacks to avoid unrelated protected-data refreshes when UI error state changes.
- Made text `contains` filters treat `%` and `_` as literal user input instead of unintended SQL wildcards.
- Added a dedicated not-found route instead of sending unknown URLs to the country explorer.

All notable documentation and implementation changes. Most recent entry first.

## 2026-08-25 - Programme hero photography

- Replaced the hazard-impact hero's mutable ArcGIS item thumbnail with a locally bundled photograph of the 2024 Zambian drought.
- Replaced the Cross-country analysis page's abstract global mark with a locally bundled NASA satellite image of Cyclone Freddy approaching Madagascar.
- Added a locally bundled Bangladesh flood photograph to the Flood Services hero, retaining a FAO deep-blue overlay for accessible text contrast.
- Kept both image imports inside the Vite asset pipeline so their URLs are generated correctly for local development and deployed builds.
- Renamed the homepage catalog navigation entry to **Home** in both desktop and mobile headers.

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
## 2026-07-24 - Embedded monitoring dashboard

- Made the live DIEM monitoring dashboard the core of `/monitoring`, while preserving the Hub URL and adding a new-tab fallback.
- Expanded the site footer with the requested FAO legacy navigation links and copyright line.
- Added a runtime monitoring-link contract so dashboard visualization URLs round-trip through `/monitoring` without hard-coded production addresses.
# 2026-08-10

- Added a same-origin Household Survey Explorer action to each linked monitoring survey header. The action preselects the survey country and round while leaving thematic-area selection to the Explorer landing step.

# 2026-09-03 - Data access restructured around questionnaire generations

- Replaced the `/data` "current versus archive" binary with an explicit
  questionnaire-generation model. `REFERENCE_GENERATION` in
  `src/services/protectedData.ts` names the generation shown first; older
  generations render as collapsed archives carrying their own datasets and their
  own field descriptions and codebooks.
- Placed V3 in the reference slot. Its Phase 5 services are published but hold
  simulated round-99 records, so every V3 entry is marked `preview` and the UI
  says so on each card and above the section. Clear those flags when real survey
  data replaces the test load, and verify none survive into a production build.
- Implemented three access tiers: anonymous sees instructions, the access ladder,
  the generations and the microdata routes but no dataset metadata; community
  members see aggregated data, boundaries, documentation, tools and the full
  microdata licence with the request form beneath it; household-data group
  members additionally see the microdata datasets.
- Added a provisioning notice for the roughly ten minutes between account
  creation and automatic group assignment. Aggregated items restricted while
  `capabilities.aggregatedData` is false is a provisioning window, not a
  permission problem, and the previous generic copy told users who had done
  everything right that they lacked access they already had.
- Restored the microdata licence, which Hub 3.0 had lost entirely: confidentiality,
  research and statistical use only, no commercial requesters, no redissemination.
  Only the aggregated CC BY 4.0 licence was published before.
- Made FAM the stated default route for microdata, with its publication lag and
  the reason for it, and direct request the documented exception including its
  evaluation time, institutional-email condition and one-year renewable term.
- Added the public `/data/guide` route covering DIEM, the three generations, the
  access tiers, aggregated data, microdata, documentation, boundaries,
  methodology, the API, citation and both licence regimes. Retired the French and
  Spanish PDF guides; all guidance now lives in the site so the two cannot drift.
- Added `?country=ISO3&round=N` deep links to `/data/:datasetId`, resolved against
  the layer schema and mirrored back into the URL. This is the entry contract
  replacing the Monitoring dashboard's legacy
  `/datasets/<itemId>/explore?filters=<base64>` links; repointing
  `DATA_ACCESS_CONFIG.hubDatasetRoot` lives in the Monitoring repository.
- Documentation held on another portal now carries `staticLink` and is never
  resolved against ArcGIS, so a public cross-portal download can no longer
  present itself as a failed availability check.
- Verified: `npm run build` passes; anonymous `/data` and `/data/guide` render
  with no console errors and no horizontal overflow at 375, 768 and 1280 px. The
  authenticated tiers are unverified and need a real-account acceptance run.

# 2026-09-03 - OAuth redirect derived from the serving origin

- Removed the hardcoded `https://localhost:5173/oauth-callback.html` development
  redirect. The redirect URI is now derived from `window.location.origin` in
  development as well as production.
- Why it mattered: whenever the page was served from any other port, the popup
  landed on the hardcoded origin, which is cross-origin to its opener, and the
  ArcGIS SDK's `postMessage` handshake died with "Blocked a frame with origin
  ... from accessing a cross-origin frame" — an error that names no OAuth
  concept and sends the reader towards the identity provider instead of the
  port. Deriving the origin leaves an unregistered origin as the only failure
  mode, which ArcGIS reports plainly.
- Every development port in use must be registered as a redirect URL on the OAuth
  application. 5173 and 5174 are both registered; `127.0.0.1` is a distinct
  origin from `localhost` and would need its own entry.
- Changed microdata grant duration from one year to one week, renewable, in the
  workspace and the guide.

# 2026-09-03 - Data workspace presentation and access-state corrections

- Fixed a false provisioning alarm. The banner was derived from
  `capabilities.aggregatedData`, so an account that could plainly see its
  datasets was still told its privileges were activating. It now appears only
  when no aggregated dataset resolved as available at all - the condition that
  actually blocks someone - and its wording no longer asserts a cause it cannot
  know.
- Dataset cards now lead with the curated label rather than the live ArcGIS
  title. Infrastructure services are named for the pipeline that builds them
  (`diem_adm_repr_1_mview_noshape`), which is right there and unreadable here.
  The live title is kept as a subdued monospace source line, so the underlying
  service is never hidden. Long service names no longer overflow the card.
- Removed the duplicated eyebrow. For an aggregated dataset the thematic layer
  is the title again, so the eyebrow now carries the period, or the generation
  and its period where no period is set.
- Shortened the access chip so it stays on one line; the action control at the
  foot of the card carries the longer explanation.
- Aggregated and microdata grids now flow with `auto-fit`, so five thematic
  layers no longer leave an orphan card on a second row.
- Made the data access guide prominent on the anonymous page: a dedicated
  "Start here" band above the access ladder, and the hero link promoted to a
  secondary button. It was previously a plain text link and easy to miss.
- Changed the gate eyebrow to "DIEM Household Monitoring System Data".
- V3 documentation now states that field descriptions, the codebook and the
  detailed metadata are in production, published with the first V3 survey, and
  that older-generation documentation is for orientation only because the field
  set and codes have changed. Same note added to the guide.
- Added `STYLE_PREVIEW` in `src/pages/DataAccess.tsx`: a layout harness that
  renders the authenticated workspace with fabricated resolutions so styling can
  be reviewed without a session. It bypasses the access tiers, so it must stay
  false outside a local styling pass. It is false.
- Verified: `npm run build` passes; `/data` renders the anonymous gate with the
  tiers restored, and no horizontal overflow at 375, 768 and 1280 px. The
  authenticated layout was reviewed through the harness, not through a real
  session; the tier behaviour itself still needs a real-account run.

# 2026-09-03 - Catalog cards carry the publisher's categorization

- `/catalog` now reads the same normalized source as the country pages
  (`useCountryCatalog`) instead of the raw group search. Categorization is
  therefore identical on both surfaces by construction rather than by two
  parallel implementations that can drift.
- Cards gained the product-type badge and the DIEM pillar pills already shown on
  country pages, with the same labels, icons and colours.
- Replaced the inferred "Theme" filter with authoritative "Pillar" and "Product"
  filters, plus a pillar quick-filter strip matching the country pages. The old
  theme was guessed from the title and tags, and `AGENTS.md` forbids presenting
  such guesses as official DIEM taxonomy - filtering on a guess while displaying
  the publisher's real categories would have been worse than either alone.
- The card image accent now follows the assigned pillar rather than the guessed
  theme, so a colour means the same thing everywhere.
- Root cause of "categorization is missing on some cards": `/catalog` listed
  every item in the Hub content group, including the 135 that are not
  `Catalog role/Discoverable product` - supporting layers, services and
  components that carry no product categories because they are not products.
  They are now excluded, matching the rule country discovery already follows.
  The catalog goes from 991 items to 856 discoverable items, 817 product
  families after language grouping.
- Remaining gaps are editorial, not code. Of the 856 discoverable items, 334
  carry no DIEM pillar, 34 carry no product type, and 28 carry no country. Those
  cards show a muted "Unclassified" badge and no pillar pill, which is honest
  about the assignment being absent. Closing them is an ArcGIS categorization
  task, not an application change.
- Verified: `npm run build` passes; `/catalog` returns 817 products with a
  product badge on every visible card, the pillar filter narrows correctly and
  round-trips through the URL, and there is no console error or horizontal
  overflow at 375, 768 and 1280 px.
