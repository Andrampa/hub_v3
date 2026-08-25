# Country Explorer

## Purpose

The country explorer is the public, country-first entry point to DIEM material.
It reads discoverable products directly from the authoritative **FAO Data in
Emergencies Hub Content** ArcGIS group. The former Countries group is not a
runtime or editorial dependency.

## Routes

- `/countries`: world map, country directory, and a live product-title search menu that links matching resources to their country library view.
- `/countries/:iso3`: country profile, product filters, search, year, sort, and pagination.
- `/countries/cross-country`: resources categorized as `XXX` for multi-country analysis.

Static hosting must rewrite unknown application paths to `index.html`; otherwise direct visits to country detail URLs will return a host-level 404.

## ArcGIS Contract

- Group ID: `ab8a43038b6347ac93507988f7e2a90b`
- Group content endpoint: `GET https://www.arcgis.com/sharing/rest/content/groups/{groupId}/search`
- Page size: 100; follow `nextStart` until complete.
- Country assignment: `/Categories/Countries/{ISO3}` in each result's `groupCategories`.
- Product assignment: `/Categories/Product types/{value}` in `groupCategories`.
- Product eligibility: exact `/Categories/Catalog role/Discoverable product`.
- Cross-country assignment: exact
  `/Categories/Geographic scope/Multi-country`, represented internally as
  route code `XXX`.

The group-content search endpoint is required because global search results do not include group-specific category assignments.

## Normalization

`src/services/countries.ts` normalizes category values defensively:

- trims category segments and accepts upper-case three-letter country codes;
- derives `XXX` cross-country content from the reviewed geographic scope;
- maps legacy `TZN` metadata to Tanzania while preserving the assigned route code;
- maps `Country Reports` to `Assessment Reports` and `DIEM EVE` to `EVE flood reports`;
- recovers list-like product labels published as a single category string;
- keeps multiple country or product assignments when present.

Observed assignments define the directory. The ArcGIS category schema alone is not sufficient because assigned country codes can exist before they appear in the schema.

## Migration Baseline

The 2026-08-25 cutover followed an exact review of 1,084 editor-visible Hub
items. All 829 legacy product-type decisions were present in the unified Hub
taxonomy. The final two missing country assignments (`COD` and `LBY`) were
added and verified without removing any existing category. Three incorrect or
obsolete legacy codes were deliberately not copied: Malawi uses `MWI`, Tanzania
uses `TZA`, and Togo uses `TGO`. Supporting components remain in the Hub group
but do not appear as independent country products.

## Map Behavior

The map uses published 110m world geometry and links available shapes by ISO3. Tiny island states omitted by that generalized geometry remain fully accessible in the country directory. The directory is the complete and accessible navigation surface; the map is an additional spatial entry point. Country cards use the local ISO metadata with FlagCDN images, hiding the image if that optional display asset fails.

## Filter State

Country resource filters use query parameters so views can be shared:

- `q`: text query
- `type`: product category
- `year`: modified year
- `sort`: `latest`, `oldest`, or `title`

All filtering is client-side after the public group has loaded. This presentation state never grants or removes ArcGIS access.

## Editorial Country Context

Country detail routes load a separate public, query-only ArcGIS table view for
country introductions, image URLs, and highlighted evidence. This content
appears above **Evidence collection** and does not alter country or product
classification.

Highlights reference stable ArcGIS item IDs and render only when the item is
still present in the current country's group-category results. See
`docs/country_editorial.md` for the table contract, editor workflow, HTML
sanitization, sharing model, and provisioning process.

## Monitoring Coverage

Standard country routes also make one ISO-filtered request to the public
`OER_Monitoring_System_View`. A compact **Household monitoring** panel appears
only when the Monitoring application has at least one public round for that
country. Public eligibility follows the Monitoring application contract:

- `round_validated = Yes`;
- `survey_outdated` is not `Yes`;
- placeholder rounds 98 and 99 are excluded.

The panel shows the number of public rounds and the latest public release. Its
main action deep-links through the Hub `/monitoring` route using the Monitoring
application's stable `iso` and `round` URL state. Signed-in users receive
additional actions according to their recognized ArcGIS groups:

- aggregate-data members can open the aggregated dataset workspace;
- household-data members can open the microdata workspace;
- Contributors can open `mode=trends` and `mode=anomalies`.

Contributors inherit both dataset capabilities. The destination application
and protected items independently apply their own access checks, so these
navigation controls are never treated as authorization.

Cross-country routes and countries without a public monitoring round do not
render the panel. A failed monitoring-coverage request is non-blocking and does
not affect the country editorial or Evidence collection.

## Latest Update

The country hero's **Latest update** is the most recent timestamp among:

1. the latest modified resource currently assigned to the country;
2. the edit timestamp of the published country introduction or highlighted
   editorial content;
3. the publication date of the latest public monitoring round.

Draft editorial rows are excluded because they are not part of the rendered
country page. This date is recalculated from live ArcGIS responses on each
page load.
