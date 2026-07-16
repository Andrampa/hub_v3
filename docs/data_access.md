# Authenticated Data Access

## Purpose

`/data` is the protected DIEM download workspace for household microdata, aggregated indicators, operational boundaries, guides, metadata and analysis tools.

The current production Hub remains unchanged. ArcGIS Online remains authoritative for every item and download.

## Access Model

1. Anonymous visitors can see the purpose and access instructions, but no protected item metadata is requested.
2. The user signs in through the independent DIEM Hub 3.0 OAuth client.
3. Authentication requires an enabled member of community organization `D5aXW6TZFpeM2wke`.
4. The application requests each protected item with the active ArcGIS identity.
5. ArcGIS item and group sharing determines whether the resource is available.
6. A signed-in user without microdata permission receives the access-request pathway rather than a download link.

The UI must never infer protected access from login alone. Organization login opens the workspace; ArcGIS sharing authorizes each resource.

## Request Boundary

`AuthContext.requestProtected` closes over the active `ArcGISIdentityManager` and delegates authenticated requests to ArcGIS REST JS. Components never receive, serialize or append access tokens.

Protected responses are held only in React memory. They are cleared when authentication is lost or the user signs out.

## Resource Manifest

`src/services/protectedData.ts` is the typed manifest for:

- current and archived household microdata;
- four current and four archived aggregated thematic datasets;
- French and Spanish data-access guides;
- current and archived administrative boundaries;
- field descriptions, codebook and aggregated metadata.

Stable item IDs are configuration. Titles and modified dates are read live after login. Provided legacy Hub URLs are retained as migration references, while available resources open their authoritative ArcGIS item page.

## User Experience

- `/data` anonymous state: purpose, protection rationale, sign-in and access-form links.
- Authenticated hero: user identity and count of resources available to that account.
- `/data/:datasetId`: internal dataset explorer for supported microdata, aggregated data and boundary resources.
- Explorer: real ArcGIS service geometry where available, interactive labelled basemap with selectable features and extent controls, live item/layer metadata, recommended country/round filters, matching-record count, table preview, copyable service/query URLs, and current-filter downloads.
- Microdata: current versus archived structure, anonymization note and one-year renewable access pathway.
- Aggregated data: switch between current and 2021–2022 archive across four thematic areas.
- Guides and metadata: protected French/Spanish guides, field descriptions, codebook and questionnaires.
- Boundaries: current and historical ADM1/ADM2 operational references.
- Tools: microdata labelling repository, DIEM API examples and FAO Microdata Catalogue.
- Citations: copyable English, French and Spanish citation text plus licensing.

## Explorer and Download Strategy

The application resolves the configured ArcGIS item to its feature service and layer after login. It uses the active identity for count, preview, geometry and export queries, while keeping the user inside Hub 3.0.

- Map preview converts native ArcGIS geometry from up to 250 matching records, preserves polygon ring direction and holes, and renders it through Leaflet over ArcGIS Online's public light-gray base and reference tiles. Users can pan, zoom, reset to the filtered extent, hover and select features.
- Table preview returns the first 30 matching records.
- CSV and GeoJSON are generated locally from authenticated filtered queries of up to 20,000 records.
- API links expose the service, layer, filtered query, item and item-data endpoints without including a token. Users supply their own authenticated session or token in scripts and GIS tools.

Every portal download format is disabled while the current filtered result exceeds 20,000 records. The filter selector prioritizes country and survey-round fields, and the download panel explains whether the current result is ready or needs further filtering. CSV and GeoJSON are generated directly in the browser from bounded, authenticated feature-service queries. Excel, Shapefile, KML/KMZ, File Geodatabase, GeoPackage and SQLite currently use the existing DIEM Hub `/api/download/v1/items/{itemId}/{format}` generator with the selected layer and current `where` clause. The request uses `AuthContext.downloadProtected`; tokens are never placed in hand-built links or exposed to page components. Availability still depends on the source item's ArcGIS Hub export settings, so every format requires an authenticated acceptance test and returns an explicit error when generation is unavailable.

For bulk extraction, the explorer generates downloadable and copyable Python and R scripts. Each script includes the current filter, reads a user-supplied short-lived token from `ARCGIS_TOKEN`, requests object IDs first, queries records in 1,000-ID batches and writes a CSV. Tokens are never embedded by the portal.

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
