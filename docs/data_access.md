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
- Explorer: real ArcGIS service geometry where available, attribute filter builder, matching-record count, table preview, copyable service/query URLs, and current-filter CSV/GeoJSON downloads.
- Microdata: current versus archived structure, anonymization note and one-year renewable access pathway.
- Aggregated data: switch between current and 2021–2022 archive across four thematic areas.
- Guides and metadata: protected French/Spanish guides, field descriptions, codebook and questionnaires.
- Boundaries: current and historical ADM1/ADM2 operational references.
- Tools: microdata labelling repository, DIEM API examples and FAO Microdata Catalogue.
- Citations: copyable English, French and Spanish citation text plus licensing.

## Explorer and Download Strategy

The application resolves the configured ArcGIS item to its feature service and layer after login. It uses the active identity for count, preview, geometry and export queries, while keeping the user inside Hub 3.0.

- Map preview uses real GeoJSON geometry from up to 3,000 matching records.
- Table preview returns the first 30 matching records.
- CSV and GeoJSON are generated locally from authenticated filtered queries of up to 20,000 records.
- API links expose the service, layer, filtered query, item and item-data endpoints without including a token. Users supply their own authenticated session or token in scripts and GIS tools.

CSV and GeoJSON are generated directly in the browser from bounded, authenticated feature-service queries. ArcGIS Hub SaaS previously supplied a separate server-side download pipeline for cached and packaged formats. Shapefile, KML/KMZ, File Geodatabase, GeoPackage, SQLite and large exports therefore require either a validated Hub export configuration for these private items or a DIEM-owned export worker. They must not be presented as active controls until that server-side path passes an authenticated end-to-end test. Do not expose a token in a hand-built URL or attempt owner-only ArcGIS export operations from the browser.

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
