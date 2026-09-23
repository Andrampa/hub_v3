# Authenticated Data Access

## Purpose

`/data` is the public overview of DIEM survey data. The protected workspace - aggregated indicators chosen by survey, household microdata, operational boundaries, metadata and analysis tools - is `/data/surveys`; see `docs/data_access_restructure.md`.

The current production Hub remains unchanged. ArcGIS Online remains authoritative for every item and download.

## Access Tiers

| Tier | Who | Sees |
|---|---|---|
| 1 | Anonymous | General instructions only: the access ladder, the three questionnaire generations, the microdata routes, and the public guide at `/data/guide`. No protected metadata is requested. |
| 2 | Enabled member of community organization `D5aXW6TZFpeM2wke` | Aggregated data, administrative boundaries, documentation, API and tools, plus the full microdata licence with the request form beneath it. |
| 3 | Tier 2 and member of household-data group `3f1e99b44e3e4107957de001a1242a70` | Everything, including the household microdata datasets. |

Tier decides what is *offered*. ArcGIS item sharing decides what is *authorized*;
every protected item is still resolved against the active identity.

Tier 2 and `capabilities.aggregatedData` are derived from validated organization
membership, not from the aggregated-data group
(`c8ae74a0f2de480abe6f72876a52b0cc`). ArcGIS cannot add Hub community
accounts to that FAO group itself; the internal community-sync notebook
(`scripts/agol_notebooks/`, see its README) adds new accounts on its next
scheduled run, planned every 15 minutes.

The provisioning notice is shown when **no aggregated dataset resolved as
available at all**, and on no other condition. Deriving it from
`capabilities.aggregatedData` instead produced a false alarm for accounts that
could plainly see their data — group-membership derivation and item resolution
can disagree, and only resolution reflects what the user actually has. The
notice offers the provisioning window as a likely explanation rather than
asserting it, and offers a re-check.

When every production source returns 403, the workspace does not report
"0 surveys": that would describe the catalogue rather than the authorization
failure. It identifies the delayed ArcGIS provisioning explicitly and directs
older accounts to the Hub team.

Presentation rule: dataset cards lead with the curated manifest label, not the
live ArcGIS title. Infrastructure services are named for the pipeline that
builds them (`diem_adm_repr_1_mview_noshape`), which is correct in ArcGIS and
unreadable in a catalogue card. The live title is still rendered as a subdued
source line, so the underlying service is never concealed.

## Access Model

1. Anonymous visitors can see the purpose and access instructions, but no protected item metadata is requested.
2. The user signs in through the independent DIEM Hub 3.0 OAuth client.
3. Authentication requires an enabled member of community organization `D5aXW6TZFpeM2wke`.
4. The application requests each protected item with the active ArcGIS identity.
5. ArcGIS item and group sharing determines whether the resource is available.
6. A signed-in user without microdata permission receives the access-request pathway rather than a download link.

Country-page Monitoring panels provide shortcuts into the relevant workspace
sections. Aggregated-data group members see the aggregate shortcut;
household-data group members see the microdata shortcut; Contributors inherit
both. The workspace still resolves every item with the active identity before
showing an explorer or download action.

The UI must never infer protected access from login alone. Organization login opens the workspace; ArcGIS sharing authorizes each resource.

## Request Boundary

`AuthContext.requestProtected` closes over the active `ArcGISIdentityManager` and delegates authenticated requests to ArcGIS REST JS. Components never receive, serialize or append access tokens.

Protected responses are held only in React memory. They are cleared when authentication is lost or the user signs out.

## Questionnaire Generations

Every manifest entry carries a `version` of `v1`, `v2` or `v3`, and
`REFERENCE_GENERATION` in `src/services/protectedData.ts` names the one shown
first. Definitions match the Monitoring dashboard user guide; changing one
without the other makes the two products contradict each other.

| Generation | Period | Role |
|---|---|---|
| V3 | 2026 onwards | Reference. From Q3 2026 every survey uses this questionnaire, so all incoming data flows through V3 only. |
| V2 | December 2022 – 2026 | Archive |
| V1 | Before December 2022 | Archive |

Surveys are chosen by country and round, not by generation: the workspace
resolves each survey's generation and packages that generation's field schema
and documentation links with it, so a reader never has to work out which
codebook belongs to which period. `REFERENCE_GENERATION` still decides which
generation the `/data` timeline presents as the current standard.

V3 entries are marked `preview: true`. Their Phase 5 services are published and
queryable but currently hold simulated records, and the UI must say so wherever
they are offered. Clear the flag when real survey data replaces the test load.

## Resource Manifest

`src/services/protectedData.ts` is the typed manifest for:

- household microdata for each generation;
- aggregated thematic datasets for each generation;
- current and archived administrative boundaries;
- field descriptions, codebooks and SDMX metadata, tagged by generation.

Stable item IDs are configuration. Titles and modified dates are read live after login. Provided legacy Hub URLs are retained as migration references, while available resources open their authoritative ArcGIS item page.

Documentation held on another portal carries `staticLink` and is never resolved
against ArcGIS, because a cross-portal request would only manufacture a
misleading "availability check failed" state for a public download.

The French and Spanish PDF guides are retired. All guidance now lives in the web
guide, so the two cannot drift apart; translation is deferred.

## Public Data Access Guide

`/data/guide` is a public route owned by the Hub, covering DIEM, the three
generations, the access tiers, aggregated data, microdata and its two routes,
documentation, boundaries, methodology, the API, citation and both licence
regimes. It holds no protected metadata, is what an anonymous visitor most
needs, and is the page the Monitoring dashboard should link to instead of
restating the same material.

Microdata carries a separate and stricter licence than aggregated data —
confidentiality, research and statistical use only, no commercial requesters, no
redissemination. It is published in full at tier 2, with the request form
directly beneath it, so the terms are read in the same movement as the request.
That licence must be present wherever microdata download is offered.

## Dataset Deep Links

`/data/:datasetId` accepts `?country=ISO3&round=N`. `deepLinkFields` resolves
those against the layer schema — preferring an ISO3 field over a country name,
because that is what the Monitoring dashboard sends and what survives spelling
and language differences — and `filtersFromDeepLink` seeds the filter set once,
when the schema is first known. Later filter edits own the URL, and the two
filters are mirrored back into it so a filtered view stays shareable.

This is the entry contract replacing the dashboard's legacy
`.../datasets/<itemId>/explore?filters=<base64>` links. Repointing
`DATA_ACCESS_CONFIG.hubDatasetRoot` lives in the Monitoring repository and has
not been done yet.

## User Experience

- `/data`: a public overview, identical signed in or out apart from the hero
  action. It explains aggregated data against household microdata (who can get
  each and what is required), the three steps to the data, and the
  questionnaire generations as a compact timeline, then routes to the survey
  data workspace. It lists no dataset and requests no protected item metadata.
  The `#aggregated` and `#microdata` anchors are kept for country-page links.
- `/data/surveys`: the survey data workspace, where data is chosen by country
  and round and downloaded as a package. See `docs/data_access_restructure.md`.
  It also holds what `/data` used to carry for signed-in members: temporary
  microdata grants, household microdata collections, the full microdata licence,
  and — under technical resources — the source datasets, boundaries,
  documentation and API tools. `GRANTS_ROUTE` (`/data/surveys#temporary-microdata`)
  opens its microdata tab directly for a newly accepted grant.
- `/data/:datasetId`: internal dataset explorer for supported microdata, aggregated data and boundary resources.
- Explorer: real ArcGIS service geometry where available, interactive labelled basemap with selectable features and extent controls, live item/layer metadata, recommended country/round filters, matching-record count, table preview, copyable service/query URLs, and current-filter downloads.
- Every dataset explorer links to the current administrative reference boundary
  dataset so analysts can join survey and aggregate records to the matching
  ADM geometry through the published administrative codes.
- Microdata (workspace tab): FAM as the default route with its publication lag, direct request as the exception, temporary grants, household collections for household-data members, and the full microdata licence from `src/components/MicrodataLicence.tsx`. The survey-first picker merges accessible master and temporary-grant scopes, allows up to ten surveys per package, offers V3 mandatory/optional choice, and performs live access-and-record-count preflight before the cancellable archive download. The browser package limits are 50,000 records, 40 MB of actual encoded CSV and 20 data files; if a limit or live authorization check fails, no partial archive is offered.
- Aggregated data (workspace): chosen by survey, with its generation resolved automatically. Multi-survey packages offer separate survey folders or combined CSVs per compatible source and generation. The review counts output files for the selected layout while separately limiting source slices and records.
- Documentation: field descriptions, codebooks and SDMX metadata per generation, each declaring an `audience` so aggregated packages link only aggregated documentation.
- Boundaries: current and historical ADM1/ADM2 operational references, under workspace technical resources.
- Tools: microdata labelling repository and DIEM API examples, under workspace technical resources.
- Citations: English, French and Spanish citation text plus both licences, in `/data/guide`.

## Content visibility

The Hub applies the rule defined for the DIEM dashboard in register item 10 of
`hh_survey_v3/docs/deferred_infrastructure_changes.md`, from one module,
`src/services/visibility.ts`:

- A **Contributor** (member of the Contributors group,
  `capabilities.contributor`) sees every row, including data not yet validated
  for publication.
- Everyone else (DIEM community members) is filtered at two levels:
  - **Survey level:** the workspace offers only surveys whose survey-register
    row (`OER_Monitoring_System_View`) is `round_validated = Yes`, matched on
    ISO3 and round number (`fetchValidatedSurveyKeys`). If the register cannot
    be read, discovery fails closed and says so.
  - **Feature level:** within those surveys, only rows with `opendata = 1`.
- **Survey data only** (aggregated tables and household microdata, grant views
  included). Administrative boundaries, documentation
  and public catalogue datasets are outside it: they carry no flag and are
  public by nature.
- **Unflagged aggregated layers fail open** (the survey-level gate still
  applies); withholding them hid every published survey from community members.
- **Unflagged microdata fails closed.** A layer with no `opendata` field has no row marked released,
  so a non-Contributor gets nothing from it: discovery marks the source
  `withheld` (not a failure, and not counted against the total) and the dataset
  explorer says the dataset has not been released instead of showing "0
  records". Every generation's pipeline writes the field, so this should only
  ever surface a misconfigured layer.

**The Hub does not currently behave like the dashboard.** The rule is shared;
the enforcement is not:

| | Hub | Dashboard today |
|---|---|---|
| `opendata = 1` filter | Enforced | Off (`enforceOpendata: false` until real surveys carry `opendata = 1`) |
| Layer without the field | Withheld from non-Contributors unless its resource explicitly declares a release-filtered ArcGIS view | Shown unfiltered |
| Survey register `round_validated` | Applied in the survey workspace | Hides unvalidated surveys |

So today a non-Contributor can see `opendata = 0` rows in the dashboard that the
Hub hides. The two converge when the dashboard sets `enforceOpendata: true` at
the rebuild; the fail-closed and register differences remain.

The survey-level gate applies in the survey workspace (discovery, and so every
count, extract and manifest) and in the dataset explorer, where it becomes a
`(iso3 = 'AFG' AND round IN (1,2)) OR ...` clause ANDed with the row clause
(`validatedSurveyClause`). The explorer queries nothing until the register has
answered, and says so if it cannot be read. The feature-level clause applies in discovery (it
is stored on each theme, so `surveySliceWhere` carries it), in the dataset
explorer's single `where` (count, preview, map, downloads, API links, scripts),
and the explorer's filter-option lists. Discovery results are cached per
visibility scope. Test-data mode is Contributor-only, because every test survey
is `opendata = 0`; `?test=1` is ignored for anyone else.

**This is presentation, not security.** An unrestricted feature service returns
every row to anyone who queries it directly. The V1/V2 microdata items are
release-filtered ArcGIS views created with `opendata = 1` in the view definition;
they intentionally omit that field from their schema. Only those two items are
declared `releaseFiltered` in `src/services/protectedData.ts`. Undeclared
unflagged microdata still fails closed. ArcGIS view sharing and its server-side
definition are the actual boundary; the broader rebuild topology is in
`docs/data_access_restructure.md` section 15.

## Public Dataset Explorer

`/datasets/:itemId` opens the same explorer for a public catalogue dataset, with
no sign-in. It also accepts the legacy Hub's `/datasets/<id>_<layer>/explore`
address and opens that layer. An item qualifies when it is a discoverable
product of the content group (resolved exactly as its product page is), is
shared publicly, and is an ArcGIS `Feature Service` with a URL
(`isExplorableProduct` in `src/services/arcgis.ts`). Its product page then leads
with **Explore and download data** and keeps the raw service as a secondary
link. Queries run anonymously; CSV, Excel and GeoJSON are built in the browser
as for protected data, the Python/R scripts need no account, and Shapefile/KML
packaging is not offered because the export generator needs a signed-in
session. The administrative-boundary shortcut is protected data and is not
shown.

## Explorer and Download Strategy

The application resolves the configured ArcGIS item to its feature service and layer after login. It uses the active identity for count, preview, geometry and export queries, while keeping the user inside Hub 3.0.

- Map preview converts native ArcGIS geometry from up to 250 records in the current map extent. The 250-feature budget is a rendering limit, not a data limit: the query carries the map's envelope, so zooming into a crowded area spends the same budget on a smaller area and progressively reveals every feature in it. The map reframes itself only when the filter changes, never on a pan, and says whether it is showing a sample of the view or all of it. It converts geometry, preserves polygon ring direction and holes, and renders it through Leaflet over the FAO-customised ArcGIS vector basemap with UN boundaries and names, or over the bundled UN geometry when that basemap cannot be drawn (see `docs/services_and_data.md`). The full map disclaimer sits below the map. Users can pan, zoom, reset to the filtered extent, hover and select features.
- Table preview returns the first 30 matching records. It scrolls inside a bounded height with a sticky header, and a synced horizontal scrollbar sits above the table so wide schemas can be scrolled without leaving the column names.
- CSV, Excel and GeoJSON are generated locally from authenticated filtered queries of up to 20,000 records. Pagination is driven by the count captured before export, advances by the number of records actually returned, and uses object-ID ordering where the layer exposes it; incomplete exports fail explicitly instead of silently truncating. CSV includes a UTF-8 byte-order mark for reliable accented text in Excel. The Excel workbook is written with `write-excel-file`, loaded as a lazy chunk so the library is fetched only when a user asks for that format; field aliases form a frozen header row and numeric fields are written as numbers.
- Filter values come from a dropdown wherever the attribute offers a bounded list: a coded-value domain is used directly, and otherwise the service answers a `returnDistinctValues` query capped at 500 options. That query is unfiltered, so the option list describes the dataset rather than the current selection, and its cost does not grow with table size. Attributes with more distinct values, and the `contains` and numeric comparisons, stay free text.
- The download panel states what a file will contain -- the filtered record count, or that no filters are applied and the file is the whole dataset -- next to the format buttons.
- Dataset cards show the ArcGIS item thumbnail when the item has a distinctive one. Portal defaults (`ago_downloaded.png`, `thumbnail.png`) are suppressed, because they make every card look alike and describe nothing.
- API links expose the service, layer, filtered query, item page and item-metadata endpoints without including a token. Users supply their own authenticated session or token in scripts and GIS tools. The item-`/data` endpoint is deliberately absent: hosted feature services have no uploaded data file, so it returned an empty body for every explorer dataset.

Every portal download format is disabled while the current filtered result exceeds 20,000 records. The filter selector prioritizes country and survey-round fields, and the download panel explains whether the current result is ready or needs further filtering. When the result is over the limit the panel replaces the buttons' explanation with the routes that have no such limit: narrowing to a country and round, the bulk Python/R scripts, and direct service queries. CSV, Excel and GeoJSON are generated directly in the browser from bounded, authenticated feature-service queries. Shapefile and KML/KMZ use ArcGIS’s own Hub export generator, `hub.arcgis.com/api/download/v1/items/{itemId}/{format}` with the selected layer and current `where` clause; that generator serves only csv, shapefile, geojson and kml, so Excel, File Geodatabase, GeoPackage and SQLite are no longer offered through it. The request uses `AuthContext.downloadProtected`; tokens are never exposed to page components. The export origin is `hub.arcgis.com`, the ArcGIS service that issued the token, rather than the Hub’s own domain, where the previous site proxied this generator. The provider adds the token to each URL it requests itself, and drops it from a `resultUrl` the job status points at another origin; an HTTP redirect is followed by `fetch` with the query string it was given, so the token travels with it. The provider follows the documented `202` status URL until a file is ready, rejects HTML/JSON/empty responses as files, and the explorer verifies ZIP and KML signatures before starting the browser download. Availability still depends on the source item's ArcGIS Hub export settings, so every format requires an authenticated acceptance test and returns an explicit error when generation is unavailable.

For bulk extraction, the explorer generates downloadable and copyable Python and R scripts. Each script includes the current filter, plus commented examples for an `adm0_ISO3 = 'AFG'` country filter and a combined country/round filter that a new user can enable and edit. It requests object IDs first, queries records in 1,000-ID batches and writes a CSV. The scripts prompt for the DIEM community username and password at run time and exchange them for a token through `generateToken`, so nothing sensitive is written into the file and a long extraction does not die when a pasted token expires. The Python script uses `getpass` in a real terminal and a masked standard-library dialog under IDLE, whose shell cannot suppress password echo. Credentials are never embedded by the portal and never leave the user's machine except to the community portal. This exchange requires an ArcGIS built-in community account; accounts federated through enterprise SSO have no password to present and must supply a token instead.

File Geodatabase cannot currently be offered as a Hub download. Although some
source FeatureServer definitions advertise `filegdb`, ArcGIS Online's item
export operation is restricted to the item owner or an administrator, the
DIEM Hub v1 generator has no `/filegdb` route, and `createReplica` requires a
sync-enabled service. Add FileGDB only through the Phase 2 DIEM-owned export
service; do not expose a format button based solely on `supportedExportFormats`.

### Export-service decision (Phase 2)

DIEM Hub 3.0 will ultimately remove this remaining ArcGIS Hub dependency through a DIEM-owned asynchronous export service. That service will authorize a request against ArcGIS Online, paginate large feature queries, generate server-side packages, store each file temporarily and return an expiring download URL. It requires API/worker hosting, a queue and temporary object storage, so it is explicitly deferred to Phase 2 rather than being bundled into the initial static web-app deployment.

Until Phase 2 is delivered, all portal file formats are limited to filtered results of 20,000 features or fewer. Generated Python/R scripts, API links and the ArcGIS item/service pages are the routes for larger or specialist workflows. The legacy Hub generator is transitional only and must not be treated as the permanent download contract.

## Failure States

- `restricted`: ArcGIS rejected the item; microdata shows the access form.
- `error`: availability could not be checked; the workspace offers a retry.
- expired session: authentication restoration returns the user to the anonymous gate.
- sign-out: identity, protected metadata and links are removed from the page.

## Human Acceptance Test

Use real non-administrator test accounts for:

- community member with approved microdata access;
- community member without microdata access;
- unrelated ArcGIS account;
- expired community session.

Confirm that aggregated datasets and language guides have the intended ArcGIS audience. If they should be available to every community member, their items or containing group must be shared accordingly.
