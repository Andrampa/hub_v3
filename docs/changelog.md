# Changelog

## 2026-09-04 - Audit: where a product click goes

Documentation only; recorded as an addendum in
`docs/design_review_2026-09-03.md`.

- Measured what a card click actually opens. Of 991 records, 503 are uploaded
  files whose click lands on an ArcGIS item page rather than the document -
  about half the catalogue. 402 carry an external url and already go to the
  real destination; 86 are ArcGIS apps for which the item page is correct.
- Confirmed `/sharing/rest/content/items/<id>/data` serves the file itself with
  the right content type and original filename, so a direct link is available.
- Recorded four options with effort, and corrected two claims made when the
  question was first answered: the file-size objection to an in-Hub preview was
  a generalisation from one 6.6 MB outlier when the median PDF is 1.29 MB, and
  the iframe feasibility test that appeared to pass had run against a 403 error
  page, so whether ArcGIS permits framing is still unverified.
- Noted that the content group shrank from 991 to 913 items during the session
  and that the item prompting the question was withdrawn mid-session. A direct
  file link therefore needs a Hub-side failure path, and the fifteen-minute
  session cache means a stale card is a normal state to design for. Whether the
  group change was expected needs confirming with the content owners.

## 2026-09-04 - Dataset explorer: map extent loading, download scope, cross-tab session

- The map now loads geometry for the current extent rather than a fixed 250
  features for the whole filter. Zooming into a crowded area spends the same
  rendering budget on a smaller area, so features appear progressively instead
  of the map showing the same arbitrary sample at every zoom. A hint says so
  when what is drawn is a sample, and the map reframes only when the filter
  changes, never on a pan.
- The download panel states what a file will contain: the filtered record
  count, or that no filters are applied and the file is the whole dataset.
- Bulk Python/R scripts authenticate with the community username and password,
  prompted for at run time, instead of a pasted token. A token expires within
  the hour, so a long extraction could die halfway through and the user had to
  find the token first; nothing sensitive is written into the script file.
  Enterprise-SSO accounts cannot use this exchange and still need a token.
- Dataset cards show the ArcGIS item thumbnail when the item has a distinctive
  one. Portal defaults are suppressed, and the image is fetched with the token
  in a header so it never appears in a URL.
- A tab opened after sign-in adopts the session from a tab already open,
  over a same-origin `BroadcastChannel`, instead of landing on the sign-in
  gate. The token stays out of `localStorage` and cookies, so this adds no new
  place it is persisted; sign-out is announced on the same channel.

## 2026-09-04 - Dataset explorer: downloads, filter value lists, API links

- Removed the item-`/data` API link. Hosted feature services carry no uploaded
  data file, so `/sharing/rest/content/items/{id}/data?f=json` returned an
  empty body for every explorer dataset. The row now offers the item-metadata
  endpoint, which is what a scripter actually wants there.
- Excel is now written in the browser instead of requested from the DIEM Hub
  export generator, which cannot produce it. That generator serves only csv,
  shapefile, geojson and kml, so Excel, File Geodatabase, GeoPackage and SQLite
  were buttons that could never succeed -- and on a non-spatial table Excel was
  the only button shown. The three remaining unsupported formats are withdrawn
  until Phase 2 owns generation. `write-excel-file` loads as a lazy chunk, so
  the library is fetched only when a user asks for a workbook.
- Filter values are a dropdown wherever the attribute offers a bounded list,
  taken from a coded-value domain where one exists and otherwise from an
  unfiltered `returnDistinctValues` query capped at 500 options. The server
  does the distinct, so the cost does not grow with table size; higher-cardinality
  attributes fall back to the text input they had before.
- Over the 20,000-record limit the download panel now explains why the limit
  exists and lists the three routes that have no limit, rather than only saying
  a filter is required.

## 2026-09-03 - Design review phase 2: readability, colour and orange

- Put a readability floor under the type scale. 241 declarations sat between
  8 px and 11 px; two tokens replace the four sizes plus four sub-floor rem
  values, and nothing renders below 11 px.
- Consolidated the palette. 467 distinct hex values clustered into 131
  perceptually distinguishable colours, so 336 were invisible duplicates;
  they now collapse to their cluster's most-used member, and six with a real
  role are named as tokens. Distinct hexes fall to 166.
- Corrected the grey text ramp rather than only deduplicating it: three of its
  five steps failed WCAG AA on white, at 4.17, 3.84 and 2.91 to one. Two steps
  replace them at 6.91 and 5.88. Grey text failing 4.5:1 falls from 292
  instances to zero; the 35 that remain are brand orange or a light accent on
  blue, which is a decision about the brand colour.
- Reserved orange for urgency, per AGENTS.md. It had become the general accent:
  every section eyebrow, the decorative rails, the ISO code and arrow on all 54
  country cards. Elements rendering orange text fall from 90 to a handful of
  status markers. This also cleared a pre-existing 2.58:1 eyebrow.
- Fixed the catalogue search cell, which had no frame and read as loose text on
  the filter bar, and replaced its "paste an item ID" placeholder.

## 2026-09-03 - Item id search, and the type-ahead on the catalogue

- Item ids are indexed and a complete id is treated as a lookup rather than as
  words to search for. A bare id, an ArcGIS item URL, a REST URL and an
  uppercase id all resolve to the product; a variant's id finds its family; a
  partial id still matches through the scored path. `/catalog?q=<id>` is
  shareable.
- The catalogue's plain search input is replaced by the homepage search
  component, so a query means the same thing on both surfaces. A `variant` prop
  separates the behaviours: `hero` navigates away, `inline` is owned by the
  page, so typing drives `?q=` and narrows the grid live, a country suggestion
  applies that filter in place, and the "see all results" row is dropped.

## 2026-09-03 - Design review phase 1: six quick wins

Six independent changes drawn from the visual-craft, generated-copy and
functionality lenses of `docs/design_review_2026-09-03.md`, each committed
separately.

- Every route sets its own page title. All fourteen were previously "DIEM Hub
  3.0 | Data in Emergencies" in the tab, in history, in a bookmark and in a
  shared link. Country and dataset pages hold the title back until their
  subject resolves.
- The catalogue states what it holds instead of announcing itself four times.
  One heading replaces two, and the subtitle carries the live product and
  country counts and names the content group. The filter bar moves from roughly
  700 px down the page to 456 px.
- The homepage portfolio carousel is replaced by a plain catalogue band. Two of
  its three slides were inert "Coming soon" panels and the first used a
  generated illustration among field photography. DIEM-Research and DIEM-Risk
  are dropped rather than advertised as absent.
- The footer gained three columns of site navigation above the FAO legal row;
  it previously offered only ways off the site.
- Turning a catalogue or country page returns the reader to the results
  heading. This needed the scroll to run after paint, because scroll anchoring
  undoes it in the click handler.
- The `DM Sans` and `Source Serif 4` declarations are removed. No webfont is
  loaded anywhere in the application, so neither ever rendered; the change is a
  pure deletion with the reasoning recorded in `src/styles.css`.

## 2026-09-03 - Restore card thumbnails and apply design review item 10

- Restored the thumbnail on every card that has one, reversing the part of item
  7 that hid shared images. The round or edition is kept as a small chip over
  the image, shown only where the thumbnail is a shared country basemap or an
  ArcGIS default and so cannot separate one product in a series from the next.
  The full-panel fallback now appears only for the items with no thumbnail at
  all.
- Added a skip link as the first focusable element on every page. It is
  off-screen until focused, and resolves its target at click time because most
  page components do not give their `main` an id. Tab stops before the
  catalogue search box drop from 19 to 2 (WCAG 2.4.1 Bypass Blocks).
- Replaced the per-card language `nav` with a labelled list. Each card was
  adding a navigation landmark, so a screen reader's landmark menu listed
  "Available languages for ..." once per card instead of the page's real
  regions; landmarks on a filtered catalogue page fall from 6 to 3. The chips
  render identically.
- The image half of item 10 was withdrawn after measurement: card and hub-area
  image containers set a fixed height, so missing intrinsic dimensions caused no
  layout shift.

## 2026-09-03 - Apply design review items 5 to 8

- Pillar tab counts are now computed within every other active filter, so a
  filtered view no longer advertises catalogue-wide totals beside a zero result.
  Added a `No pillar assigned` tab and select option, which makes the counts
  reconcile with the total for the first time; a tab whose count is zero is
  disabled rather than hidden.
- Dropped card summaries that only restate the title, which was most of the
  catalogue, and replaced the "Open this resource to view its complete
  description and metadata" filler with "No description in the catalogue
  record."
- Card thumbnails are now shown only when the image file distinguishes one
  product from another; 862 of 991 items share a thumbnail name such as a
  per-country basemap or an ArcGIS default. The rest render a plate carrying
  the round or edition parsed from the title, on the existing pathway-coloured
  ground, so a page of one country's briefs is scannable. Homepage card
  selection no longer requires a thumbnail.
- Cached the normalized content group in `sessionStorage` for 15 minutes with a
  background refresh: a cold load takes about 5 s and 11 paged requests, a
  cached load 21 ms with identical counts. Only the typed contract is persisted,
  which took the entry from 1855 kB to 706 kB. ArcGIS remains authoritative and
  every load still revalidates.
- Replaced the catalogue's blocking spinner with the live filter bar and a
  skeleton grid matching a page of results.

## 2026-09-03 - Apply design review items 1 to 4

- Stopped publishing demo country highlights: `fetchPublishedEditorial` drops
  `is_demo` rows, so the placeholder prose describing the curation layout, and
  its "Demo curation" badge, no longer reach public country pages. Every
  published highlight row is currently a demo, so the "In evidence" band is
  absent until editors publish reviewed highlights.
- Replaced `modified` with `created` wherever a date was presented to readers.
  Cards read "Added <date>", the facet is "Year added" and now spans 2021-2026
  instead of collapsing to 2026, sort reads "Recently added" / "Oldest first"
  over a new `ProductFamily.latestCreated`, the homepage section is "Recently
  added to the catalogue", and the banner's "New" badge tracks catalogue entry.
  `modified` is retained only where an update date is meant. Existing `newest`
  and `oldest` sort links keep working.
- Separated the two country figures that previously contradicted each other:
  "Countries surveyed" (42, monitoring system) sits in the monitoring tier and
  "Countries with evidence" (live, currently 54) in the evidence tier, with a
  footnote dating the fixed figure and attributing the live ones.
- Added Catalogue to the desktop primary navigation, which previously had no
  link to `/catalog` at all, and rebuilt the mobile menu to mirror the desktop
  structure, including the Data access and Survey explorer destinations that
  were unreachable on mobile.

## 2026-09-03 - Record the public-launch design and product review

- Added `docs/design_review_2026-09-03.md`: an anonymous review of the running
  application at 1440, 768 and 390 px across the homepage, catalogue, country
  explorer, country detail, data workspace and 404 routes, in loading, empty,
  filtered and error states.
- Recorded ten prioritised changes, findings across visual craft, generated-copy
  tells, information architecture, functionality gaps, proposed additions, web
  practice and trust, plus an explicit do-not-do list.
- Confirmed against the live content group that two records carry an incorrect
  `DIEM-LANGUAGE:French` tag, that the homepage country figure is a hardcoded
  constant disagreeing with the live country explorer, and that `Source Serif 4`
  and `DM Sans` are declared but never loaded.
- Documentation only; no application behavior changed.

## 2026-09-03 - Replace photo-gallery StoryMap wrappers

- Created and published a protected, authoritative ArcGIS catalogue for photo
  gallery metadata, then locked its public service to read-only access.
- Migrated the five supplied legacy StoryMaps to canonical FAO emergencies
  Flickr albums with reviewed titles, countries, dates, thumbnails and credits.
- Added ten further supplied Flickr albums directly to the same catalogue,
  bringing the initial public gallery collection to fifteen records.
- Added eleven further reviewed Flickr albums, including DIEM Monitoring and
  DIEM-Impact work from 2022–23, bringing the public collection to 26 records.
- Added a native `/photo-galleries` page with responsive cards, country
  filtering, loading/error/empty states and resilient external images.
- Added Photo galleries to the About DIEM desktop and mobile menus; legacy
  StoryMaps are no longer part of the Hub discovery path.

## 2026-09-03 - Add the About DIEM section

- Replaced the single Contact header choice with an About DIEM menu that groups
  What is DIEM? above Contact us on desktop and mobile navigation.
- Added a public programme overview explaining DIEM's purpose, evidence cycle
  and principal Hub pathways, with the introductory and DIEM-user-story videos.
- Marked the household, flood and risk data-explorer proposal as accomplished:
  household data is downloadable through the Hub, while EVE provides flood and
  Exposure Model risk downloads documented on the Hub's Flood services page.
- Added the newsletter invitation and account-creation route for updates about
  assessments, datasets, initiatives and events, completing the proposed
  About/impact/video/newsletter area.

## 2026-09-03 - Distinguish country evidence pathways

- Added URL-backed country filtering for Regular monitoring, Hazard impact,
  Research & analysis and Seasonal calendar, while preserving the existing
  product-type facet.
- Added accessible text labels reinforced by Bootstrap icons and restrained FAO
  palette accents on country product cards; color is never the only signal.
- Derived pathways from controlled `DIEM pillars` categories, using the
  explicit `Product types/Crop calendar` assignment for Seasonal calendar and
  no title/tag inference.
- Marked the proposed four-part analytical product grouping as accomplished.

## 2026-09-03 - Link EVE-active countries to their Overview

- Added a lightweight, cached lookup against the authoritative EVE ADM0 master
  catalog, with dynamic table resolution and no geometry or dekad payloads.
- Country pages now show a direct EVE Overview action only when their normalized
  ISO3 code occurs in that live catalog. The optional lookup fails independently
  from country evidence and household-monitoring coverage.
- Documented that EVE catalog membership means regular-monitoring coverage, not
  confirmation that the latest global dekad has arrived.
- Marked country links to household, flood and risk explorers as accomplished:
  EVE Overview includes both regular flood monitoring and the embedded flood
  Exposure Model risk pathway.

## 2026-09-03 - Consolidate Hub principles and operating model

- Expanded `docs/hub_concepts.md` into the single reference for the Hub's
  purpose, operating model, public-visibility and authorization boundaries,
  editorial ownership, data-quality limits and roadmap status.
- Added a practical review test for future features and editorial workflows.

## 2026-09-02 - Document Hub concepts and editorial scope

- Added a concise overview of the Hub's data model, sections, discovery
  functions and editor-controlled content.
- Mapped the proposed programme structure to accomplished, partial
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
