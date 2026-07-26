# User Journeys

## Primary Personas

- Decision-maker seeking recent country evidence.
- Analyst or researcher seeking data or methodology.
- Practitioner browsing monitoring, impact, or early-warning products.

## Entry Points

- Homepage search.
- Catalog filters.
- Overview format chart.
- Country explorer and direct `/countries/:iso3` links.
- Household monitoring, flood services, and contact navigation links.

## Programme Pages

1. A visitor opens `/monitoring`, understands the household-monitoring system, sees current progress figures, and scans one live survey pipeline with forthcoming releases first and published products below. The visitor can search, filter by status, progressively reveal older releases, and open the available survey explorer, brief, findings, questionnaire, report, or charts.
2. A visitor opens `/flood-services`, reaches EVE 2.0 or Floodex, or follows the clear contact path for internal field-reporting applications.
3. A visitor opens `/contact` and completes the embedded ArcGIS contact form or opens it in a new tab.

## Public Discovery Journey

1. User sees catalog scope and DIEM purpose.
2. User searches a country, theme, or resource phrase.
3. User narrows by broad content family, provisional theme, year, and sort order.
4. User scans consistent cards with type, date, geography, and summary.
5. User opens the authoritative resource in a new tab.

Success means reaching relevant evidence with its original context and metadata intact.

## Authenticated Data Journey

1. Anonymous user opens `/data` and sees the collections, protection rationale and sign-in action without protected metadata.
2. User signs in with an enabled DIEM community identity and returns to the workspace.
3. The page checks each item against ArcGIS sharing and clearly distinguishes available and restricted resources.
4. User opens current or archived microdata, aggregated thematic data, language guides or administrative boundaries.
5. A user without microdata permission follows the renewable one-year access-request pathway.
6. User can reach field descriptions, codebooks, questionnaires, API examples, labelling tools, citations and licensing from the same workspace.

## Dataset Explorer Journey

1. Authenticated user selects an available microdata, aggregated or boundary dataset.
2. The internal `/data/:datasetId` route reads the permitted ArcGIS service and layer.
3. User composes attribute filters, sees the matching record count and inspects the map or tabular preview.
4. User downloads the current filtered result as CSV or GeoJSON, or copies a token-free service/query URL for scripted or GIS use.
5. A large export explains the browser limit and directs the user to use the service API rather than silently truncating data.

## Country Discovery Journey

1. User searches by country name or ISO3, selects a region, or explores the map.
2. The complete directory remains available when generalized map geometry omits a small island state.
3. User opens a country profile and sees its resource count, product coverage, and latest update.
4. Where published household-monitoring rounds exist, the user can open the
   latest public round or compare public rounds in the embedded Monitoring
   application.
5. User filters by publisher-maintained product category, text, or year and can share the resulting URL.
6. User opens the authoritative resource; cross-country products follow the same library pattern.

## Failure / Empty States

- ArcGIS unavailable: explain the failure and offer retry.
- No match: suggest broadening search or removing filters.
- Missing summary/thumbnail: show a useful fallback without hiding the item.
- Broken external resource: ArcGIS ownership remains visible through the source catalog link.

## Key UX Principles

- Lead with user concepts, not ArcGIS implementation types.
- Make freshness and source clear.
- Never imply inferred classifications are authoritative.
- Keep urgent visual language restrained and accessible.
