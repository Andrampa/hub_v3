# Services And Data

## Runtime Data Principle

ArcGIS Online is authoritative. The browser fetches current metadata on every application load and retains it only in memory.

## Main Service / Data Configuration

`src/services/arcgis.ts` contains:

- Portal: `https://www.arcgis.com`
- Content group: `ab8a43038b6347ac93507988f7e2a90b`
- Search page size: 100

`src/services/countries.ts` contains:

- Hub content-group pagination and in-memory request caching
- exact `Catalog role/Discoverable product` eligibility
- ISO3 and unified `Product types` category parsing and normalization
- country summaries and cross-country content derived from
  `Geographic scope/Multi-country`

`src/services/impactAssessments.ts` contains:

- Exact, case-insensitive `Impact Assessment` tag eligibility within the Hub content group
- Normalization of the Countries, Shock type, Content role, Geographic scope, Languages and DIEM pillars category branches
- Public assessment-type filtering, country summaries and filter vocabularies for the Living Shock Atlas and dossier/timeline views

`src/services/countryEditorial.ts` contains:

- Stable public editorial-view item ID `bfabf1dc1d354b3c92a3c801b0376452`
- Runtime discovery of the view's mutable FeatureServer URL
- Published country-introduction and highlight queries
- Optional per-highlight lead text displayed above each curated card
- Item-ID resolution against the active country catalog
- HTTP(S)-only image URL validation

`src/services/hubPromotions.ts` contains:

- reviewed built-in programme slides used when no editorial view is configured;
- production/staging channel selection from deployment configuration;
- runtime discovery of a configured read-only promotion view;
- HTTP(S) image and destination validation, optional Hub-relative destinations,
  publication windows and stable campaign dismissal IDs;
- a temporary read-only fallback to legacy popup item
  `015a1eabdb454d1c90fd9ad282e407e6`.

The Latest evidence strip does not make a second ArcGIS request. It derives up
to six current items from the already-loaded catalog using exact,
case-insensitive matches for publisher-provided tags `Impact assessment` and
`Country brief`.

`src/services/protectedData.ts` contains stable item IDs for the authenticated data workspace and resolves their metadata through the active community identity. The service preserves restricted and request-failure states per item instead of treating a successful login as blanket authorization.

`src/services/dataExplorer.ts` resolves a permitted item to its feature service and first available layer or table. It only accepts configured item IDs, builds clauses from layer schema fields, and keeps client-side preview/export limits explicit.

`src/services/monitoring.ts` reads the public monitoring statistics service and the public `OER_Monitoring_System_View` item (`9a548eaacfb34089b21e0b28685955db`, layer `0`). The survey pipeline preserves the reviewed legacy dashboard rules: upcoming surveys are unvalidated, current, non-Uganda rounds; published surveys are validated records with a publication date. Placeholder rounds 98 and 99 remain excluded. Product item IDs are linked to their authoritative ArcGIS item pages, while the country brief and survey explorer retain their established DIEM Hub routes.

`src/services/monitoringProducts.ts` joins those authoritative survey-round
product item IDs to the Hub content-group inventory. The join makes group
membership a prerequisite for discovery and supplies stable country/round
relationships. Unlinked items are eligible only through the Household
monitoring system pillar, the Monitoring products category branch, or a small
set of exact publisher tags. Exact `Impact Assessment` tag matches are excluded
when a legacy round-table link conflicts with the item's published identity.
The controlled monitoring product taxonomy omits Interactive charts; chart
links remain available on the release board.

Product-library visibility is audience-aware without changing the release
board: public and non-Contributor sessions receive only products linked to
validated/published rows, while recognized Contributors may also receive
product links on current incoming rows and categorized unlinked monitoring
resources. `fetchSurveyReleases` keeps its original default behavior for the
public board; its opt-in option exposes incoming-row product links only to the
Contributor library caller. Obsolete rows, placeholder rounds 98/99 and the
existing reviewed exclusions remain filtered by `src/services/monitoring.ts`.

The homepage renders that pipeline as the arrival and departure board through
`src/components/SurveyReleases.tsx`. The component pages the whole layer once,
keeps the service ordering (inbound rounds first by expected publication, then
published rounds most recent first), and filters by status client-side. Arrivals
are rounds still inbound and Departures are rounds already released; the status
column keeps the literal Incoming/Published wording so the board framing never
changes what a row asserts. When the layer holds no unvalidated, non-outdated
rounds the Arrivals count is legitimately zero; this is a data state, not a
failure, and the board says so.

`src/services/monitoringThemes.ts` resolves which thematic areas the Monitoring
application can open for one survey, mirroring that application's own
`resolveTheme` rule so a deep link is never offered for an area it would refuse
to enter. Native V2 rounds - validated legacy rounds collected on or after
2022-10-01 that appear in both public V2 services - are probed with the same
statistics and rollup queries the application runs. Older iframe-legacy rounds
have no probeable data, so availability is the set of per-theme legacy
dashboards recorded on the survey row. Fisheries is never offered because the
application excludes it for every legacy survey, and every board round is
legacy. The theme registry and its probe fields are vendored from the
application's `question-metadata-v2.json`: that file is served without CORS
headers and cannot be read cross-origin. The V2 questionnaire is frozen, so the
copy is stable, but it must be regenerated if the application regenerates its
metadata. The shared native-V2 key set is deliberately not cancellable; binding
it to one caller's AbortSignal would poison the cached promise for every later
caller.

Country pages use `fetchCountryMonitoringCoverage` from the same service. The
request is filtered server-side by ISO3, validated status, and non-outdated
status, returns no geometry, and requests only the small set of fields needed
for the coverage panel. The panel links to `/monitoring?iso={ISO3}&round={n}`
or the same state with `mode=trends`. Anonymous visibility is enforced again
inside the Monitoring application; the Hub link does not grant access.

The first response provides `total`; remaining pages are fetched concurrently. No token is used in Phase 1.

Authentication uses the separate community portal and OAuth client described in `docs/authentication.md`. The public catalog still uses anonymous requests. Protected catalog requests will receive the active user authentication manager only after their group IDs and product behavior are approved.

## Shared Service Utilities

- `fetchCatalog`: group plus complete paginated item inventory.
- `fetchImpactAssessmentCatalog`: exact-tag assessment inventory and normalized Hub group-category facets.
- `fetchCountryCatalog`: complete country-group inventory with group categories.
- `fetchCountryEditorial`: published introduction, image fields, and valid highlighted items for one country.
- `fetchHubPromotions`: validated programme slides and at most one active popup campaign for the configured publication channel.
- `fetchCountryMonitoringCoverage`: public Monitoring-app coverage and latest visible round for one ISO3 country.
- `fetchSurveyReleases`: complete forthcoming and published survey round list, ordered by arrival, with linked survey products.
- `fetchSurveyThemes`: thematic areas the Monitoring application can open for one survey round.
- `resourcesForCountry`: resources assigned to an ISO3 code.
- `fetchProtectedDataWorkspace`: permission-aware protected item inventory.
- `authoritativeResourceUrl`: authenticated ArcGIS item details/download destination.
- `fetchDatasetDefinition`, `fetchRecordCount`, `fetchTablePreview`, and `fetchGeometryPreview`: internal protected explorer requests.
- `downloadCsv` and `downloadGeoJson`: browser-generated exports capped at 20,000 matching records.
- `bulkDownloadScripts`: token-free Python/R templates that preserve the current filter and batch large ArcGIS queries by object ID.
- `hubDownloadRequest`: authenticated bridge to the existing DIEM Hub packaged-download generator for formats that require server-side creation.
- `itemThumbnail`: ArcGIS thumbnail URL.
- `itemDestination`: published URL when present, otherwise ArcGIS item page.

## Base Data Sources

The public group contains documents, files, StoryMaps, web maps, services, Hub pages, dashboards, forms, and applications. Search result fields used include ID, title, type, owner, dates, tags, summary, thumbnail, URL, access, and licence metadata.

## Caches

Only React in-memory state. Browser and ArcGIS HTTP caches may apply. There is no service worker or persistent application cache. Protected item metadata is removed when authentication is lost.

## Data Drift Risks

- Counts and newest dates change as publishers edit the group.
- Titles and tags are inconsistent; missing values are expected.
- Repeated titles can identify different ArcGIS items.
- Homepage country/theme classifications remain provisional inferences.
- Country pages depend on publisher-maintained group categories, which can be missing, malformed, or multiply assigned.
- A resource URL can fail while the ArcGIS item remains valid.
- Item metadata may not expose a feature service, a service may have tables instead of geometry, and service field schemas can change without code changes.
- Packaged formats depend on the existing Hub download generator and each item's export configuration; a format can fail independently even when live queries succeed.
- The dataset map uses the public ArcGIS World Light Gray Canvas base and reference tile services. Failure of those tiles must not block filters, table previews, API links or downloads.

Future thematic sections should define explicit item IDs, controlled categories, or reviewed query rules. Protected requests must pass the active ArcGIS authentication manager through the service boundary and rely on ArcGIS access responses.
