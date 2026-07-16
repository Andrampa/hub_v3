# Services And Data

## Runtime Data Principle

ArcGIS Online is authoritative. The browser fetches current metadata on every application load and retains it only in memory.

## Main Service / Data Configuration

`src/services/arcgis.ts` contains:

- Portal: `https://www.arcgis.com`
- Content group: `ab8a43038b6347ac93507988f7e2a90b`
- Search page size: 100

`src/services/countries.ts` contains:

- Country group: `c27d3dbba52343c6addfd61edaaa3e86`
- Group-content search pagination and in-memory request caching
- ISO3 and Item Type category parsing and normalization
- Country summaries and cross-country (`XXX`) content

`src/services/protectedData.ts` contains stable item IDs for the authenticated data workspace and resolves their metadata through the active community identity. The service preserves restricted and request-failure states per item instead of treating a successful login as blanket authorization.

`src/services/dataExplorer.ts` resolves a permitted item to its feature service and first available layer or table. It only accepts configured item IDs, builds clauses from layer schema fields, and keeps client-side preview/export limits explicit.

The first response provides `total`; remaining pages are fetched concurrently. No token is used in Phase 1.

Authentication uses the separate community portal and OAuth client described in `docs/authentication.md`. The public catalog still uses anonymous requests. Protected catalog requests will receive the active user authentication manager only after their group IDs and product behavior are approved.

## Shared Service Utilities

- `fetchCatalog`: group plus complete paginated item inventory.
- `fetchCountryCatalog`: complete country-group inventory with group categories.
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
