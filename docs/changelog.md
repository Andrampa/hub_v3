# Changelog

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
