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

The first response provides `total`; remaining pages are fetched concurrently. No token is used in Phase 1.

Authentication uses the separate community portal and OAuth client described in `docs/authentication.md`. The public catalog still uses anonymous requests. Protected catalog requests will receive the active user authentication manager only after their group IDs and product behavior are approved.

## Shared Service Utilities

- `fetchCatalog`: group plus complete paginated item inventory.
- `fetchCountryCatalog`: complete country-group inventory with group categories.
- `resourcesForCountry`: resources assigned to an ISO3 code.
- `itemThumbnail`: ArcGIS thumbnail URL.
- `itemDestination`: published URL when present, otherwise ArcGIS item page.

## Base Data Sources

The public group contains documents, files, StoryMaps, web maps, services, Hub pages, dashboards, forms, and applications. Search result fields used include ID, title, type, owner, dates, tags, summary, thumbnail, URL, access, and licence metadata.

## Caches

Only React in-memory state. Browser and ArcGIS HTTP caches may apply. There is no service worker or persistent application cache.

## Data Drift Risks

- Counts and newest dates change as publishers edit the group.
- Titles and tags are inconsistent; missing values are expected.
- Repeated titles can identify different ArcGIS items.
- Homepage country/theme classifications remain provisional inferences.
- Country pages depend on publisher-maintained group categories, which can be missing, malformed, or multiply assigned.
- A resource URL can fail while the ArcGIS item remains valid.

Future thematic sections should define explicit item IDs, controlled categories, or reviewed query rules. Protected requests must pass the active ArcGIS authentication manager through the service boundary and rely on ArcGIS access responses.
