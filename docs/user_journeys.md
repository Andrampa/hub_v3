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

## Public Discovery Journey

1. User sees catalog scope and DIEM purpose.
2. User searches a country, theme, or resource phrase.
3. User narrows by broad content family, provisional theme, year, and sort order.
4. User scans consistent cards with type, date, geography, and summary.
5. User opens the authoritative resource in a new tab.

Success means reaching relevant evidence with its original context and metadata intact.

## Country Discovery Journey

1. User searches by country name or ISO3, selects a region, or explores the map.
2. The complete directory remains available when generalized map geometry omits a small island state.
3. User opens a country profile and sees its resource count, product coverage, and latest update.
4. User filters by publisher-maintained product category, text, or year and can share the resulting URL.
5. User opens the authoritative resource; cross-country products follow the same library pattern.

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
