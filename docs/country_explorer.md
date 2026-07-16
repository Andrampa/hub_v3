# Country Explorer

## Purpose

The country explorer is the public, country-first entry point to DIEM material. It reads the curated **Data in Emergencies Hub - Countries** ArcGIS group and does not copy or modify its content.

## Routes

- `/countries`: searchable map and country directory.
- `/countries/:iso3`: country profile, product filters, search, year, sort, and pagination.
- `/countries/cross-country`: resources categorized as `XXX` for multi-country analysis.

Static hosting must rewrite unknown application paths to `index.html`; otherwise direct visits to country detail URLs will return a host-level 404.

## ArcGIS Contract

- Group ID: `c27d3dbba52343c6addfd61edaaa3e86`
- Group content endpoint: `GET https://www.arcgis.com/sharing/rest/content/groups/{groupId}/search`
- Page size: 100; follow `nextStart` until complete.
- Country assignment: `/Categories/Countries/{ISO3}` in each result's `groupCategories`.
- Product assignment: `/Categories/Item Type/{value}` in `groupCategories`.

The group-content search endpoint is required because global search results do not include group-specific category assignments.

## Normalization

`src/services/countries.ts` normalizes category values defensively:

- trims category segments and accepts upper-case three-letter country codes;
- treats `XXX` as cross-country content;
- maps legacy `TZN` metadata to Tanzania while preserving the assigned route code;
- maps `Country Reports` to `Assessment Reports` and `DIEM EVE` to `EVE flood reports`;
- recovers list-like product labels published as a single category string;
- keeps multiple country or product assignments when present.

Observed assignments define the directory. The ArcGIS category schema alone is not sufficient because assigned country codes can exist before they appear in the schema.

## Current Live Baseline

On 2026-07-16 the group returned 970 items, 54 country codes, and 2 cross-country resources. Metadata remains mutable. Some records lack country or product categories, and a small number carry multiple assignments; the interface excludes uncategorized records from country pages without changing ArcGIS.

## Map Behavior

The map uses published 110m world geometry and links available shapes by ISO3. Tiny island states omitted by that generalized geometry remain fully accessible in search and the country directory. The directory is the complete and accessible navigation surface; the map is an additional spatial entry point.

## Filter State

Country resource filters use query parameters so views can be shared:

- `q`: text query
- `type`: product category
- `year`: modified year
- `sort`: `latest`, `oldest`, or `title`

All filtering is client-side after the public group has loaded. This presentation state never grants or removes ArcGIS access.
