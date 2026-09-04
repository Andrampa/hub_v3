# Design and Product Review - 2026-09-03

Anonymous review of the running application against a public-facing FAO
institutional standard. Conducted on the dev server at `127.0.0.1:4174` at
1440, 768 and 390 px, covering `/`, `/catalog`, `/countries`,
`/countries/NER`, `/data`, `/data/:datasetId` and the 404 route, in loading,
empty, filtered and error states. Findings were cross-checked against the live
DIEM Hub content group `ab8a43038b6347ac93507988f7e2a90b`, which returned 991
records and 817 discoverable product families at the time of review.

This document is the backlog; pick items from it rather than treating it as a
completed plan. Findings were recorded before any code changed. Items marked
`[SHIPPED]` have since been applied; their text is left as written so the
before-state stays legible, with an implementation note where the delivered fix
differs from the one first proposed.

## Status

| Field | Value |
|---|---|
| Reviewed | 2026-09-03 |
| Base commit | `113d271` |
| Items agreed | Top 10 items 1-8, 10; lens 2, 6 and 7 items |
| Items shipped | Top 10 items 1-8 and 10; lens phases 1 and 2 (2026-09-03); the 2026-09-04 addendum, options A, B and C, as the product page; lenses 2, 6 and 7 apart from the CSS bundle; public dataset metadata (lens 3); the round timeline, the coverage matrix and the language badge (lens 5) (2026-09-04) |
| Open, highest value | None selected. Lens 4, item 9, series grouping, the metadata health panel, the change digest and the map-first catalogue were all declined by the editor; the CSS bundle split remains the one open technical item |

Update the two rows above as work is selected and completed, and record shipped
items in `docs/changelog.md`.

---

## Top 10 changes, ranked by impact over effort

### 1. Delete the demo copy shipped on every country page [SHIPPED]

`/countries/NER` renders, twice: "A recent addition to this country evidence
collection, selected to demonstrate how editors can introduce a featured
resource before its card." Each card beneath carries a `DEMO CURATION` badge
and "...selected to demonstrate the country-page curation layout. Editors can
replace this text with a short explanation of why the evidence matters."

This is instructional scaffolding on a public route.

**Edit.** In `src/services/countryEditorial.ts`, make demo highlights opt-in:
render the "In evidence" section only when a country has real editorial
highlights, and remove the fallback strings rather than shipping them as
content.

Impact: credibility. Effort: hours.

**Implementation note.** `fetchPublishedEditorial` now drops rows where
`is_demo = 1`, so demo prose can never reach a public page whatever an editor
publishes. A check against the live editorial table found that **all 73
published highlight rows, across all 55 countries, are demo rows**, so the
"In evidence" band is currently absent site-wide. That is the intended
behaviour, not a regression: the band returns for a country as soon as an
editor publishes a highlight with `is_demo = 0`. The country introduction
(profile) is unaffected and still renders.

### 2. Stop presenting the ArcGIS `modified` timestamp as a publication date [SHIPPED]

Every date on the site comes from `item.modified`. The homepage section headed
"Recently published across DIEM" shows eight items all dated 24 Aug 2026, which
is the day the bulk category migration touched them, not a publication date.
The same field drives the Year facet (`src/lib/catalog.ts:59`), so nearly the
whole catalogue reports 2026, and the default "Recently updated" sort ranks by
re-tagging order.

**Edit.** Label the field honestly at `src/components/CatalogContentCard.tsx:61`
("Updated 24 Aug 2026"); rename the homepage section to "Recently updated in
the catalogue"; derive the Year facet from the round or period in the title or
from a category, falling back to "Year not recorded" instead of silently using
`modified`.

Impact: trust. Effort: half a day.

**Implementation note.** The title-parsing idea in the Edit above was tested
against the live group and rejected: only 20 percent of titles contain a
four-digit year, and many of those are comparison years rather than publication
years ("Rice Production Trend: 2021 compared to 2020"), so a parser would have
invented wrong dates for a fifth of the catalogue and left the rest unlabelled.

`created` was used instead. It is untouched by re-tagging and spans the
programme: 2021 (108 items), 2022 (182), 2023 (218), 2024 (179), 2025 (226),
2026 (71). Shipped as: cards read "Added \<date\>" from `created`; the facet is
"Year added" and now offers 2021-2026 instead of collapsing to 2026; sort
options are "Recently added" / "Oldest first" over a new
`ProductFamily.latestCreated`; the homepage section is "Recently added to the
catalogue"; the banner's "New" badge tracks `created`.

`latestModified` is retained where an update date is genuinely meant - the
country hero's "latest update" stat and the atlas tooltip. The `newest` and
`oldest` URL sort values are unchanged, so existing shared links still work.

### 3. Reconcile the two country counts [SHIPPED]

The homepage states `42 - Countries covered`. `/countries` states
`54 - Countries with evidence`. The 42 is the hardcoded
`MONITORING_COUNTRIES_COVERED` constant at `src/services/monitoring.ts:57`
("Verified 28 July 2026"), sitting beside three live figures in the same tile
row.

**Edit.** Either compute it from the same catalogue the atlas uses, or relabel
it to what it actually counts ("42 countries with household monitoring") and
move it into the monitoring tier. Show the as-at date in the tile, not only in
a code comment.

Impact: trust. Effort: hours.

**Implementation note.** The two figures count genuinely different populations,
so they were separated rather than merged. The monitoring tier now reads
"Countries surveyed" (42, the fixed monitoring-system figure) and the evidence
tier gained "Countries with evidence" (live from the content group, currently
54). A footnote under the block dates the fixed figure and states that the
evidence figures are read live. This also fills the empty third grid cell noted
in lens 1.

### 4. Put the catalogue in the primary navigation [SHIPPED]

The desktop header at `src/components/SiteHeader.tsx:26-71` has no link to
`/catalog`. The largest surface on the site - 817 products, six facets, 52
pages - is reachable only from one slide of the homepage carousel or a
mid-page "View all products" link. The mobile menu does include it, labelled
"Products", so the two navigations disagree about what the site contains. The
mobile menu also omits `/data` and the Household Survey Explorer, both present
in the desktop dropdown.

**Edit.** Add a top-level Catalogue item to `.nav-links`, use one label in both
navigations, and add the two missing destinations to the mobile menu.

Impact: journey. Effort: hours.

**Implementation note.** "Catalogue" is now the last item in the desktop
`.nav-links` and carries the active state on `/catalog`. The mobile menu was
reordered to mirror the desktop information architecture: Home, Catalogue,
Countries, Hazard impacts, Flood services, then a Household surveys group
holding Surveys catalogue, Survey explorer and Data access, then About DIEM.
Verified with no horizontal overflow at 390, 768 and 1440 px.

### 5. Make facet counts respond to the active filter [SHIPPED]

`src/pages/Catalog.tsx:130` and `:141` compute the pillar tab counts from
`families`, never `filteredFamilies`. Filtering to Niger with a nonsense query
produces a results line reading `0 products found` while the tabs above still
advertise `817 / 400 / 118 / 3 / 44`. The pillar counts also sum to 565 of 817,
a gap the "All pathways" label conceals.

**Edit.** Count within the current non-pillar filter set, and add an explicit
"No pillar assigned" tab so the arithmetic is visible rather than hidden.

Impact: correctness. Effort: hours.

**Implementation note.** A `familiesBeforePathway` set now applies every filter
except the pillar, and each tab counts within it, so a tab states how many
results choosing it would actually give. A `No pillar assigned` tab and a
matching select option were added; the counts now reconcile in the open
catalogue (400 + 118 + 3 + 44 + 252 = 817) and under a filter (Niger:
23 + 2 + 0 + 2 + 16 = 43). A tab whose count is zero is shown rather than
hidden, because hiding it would silently change the arithmetic a reader is
checking, but it is disabled so it is never a dead click.

### 6. Suppress the summary when it merely repeats the title [SHIPPED]

Cards read "Mali - DIEM Monitoring Brief - Round 7" followed by the description
"DIEM Monitoring Brief - Round 7". On a 16-card grid this is a full column of
redundant text and the single loudest reason the catalogue looks
machine-generated. `src/components/CatalogContentCard.tsx:27` takes
`snippet || description` with no comparison to the title, and line 74 fills the
gap with "Open this resource to view its complete description and metadata."

**Edit.** Drop the summary when it is a substring of the title after
normalisation. Where there is genuinely nothing, print "No description in the
catalogue record" instead of an instruction to go elsewhere.

Impact: craft. Effort: hours.

**Implementation note.** `distinctSummary` in `src/lib/catalog.ts` drops a
snippet whose folded text is a substring of the folded title, or the reverse.
The fallback is `NO_SUMMARY_LABEL` - "No description in the catalogue record."
- set in italic at reduced opacity, so a thin record reads as thin rather than
as an instruction to go elsewhere.

### 7. Replace the identical map thumbnails with a typed record block [SHIPPED]

On `/countries/NER` all 43 cards carry the same Niger basemap tile. On
`/catalog` the first screen shows four near-identical ArcGIS extents. The image
occupies roughly 40 percent of every card and carries no information, which
actively defeats scanning.

**Edit.** In `itemThumbnail` (`src/services/arcgis.ts:77`), keep the thumbnail
only where it differs from its siblings; otherwise render a compact typed block
- product type, round number, format, record count, language - in the mono
face.

Impact: craft. Effort: 1-2 days.

**Implementation note.** Duplicate images are detected by thumbnail *file name*,
which is the field that actually repeats: `thumbnail/thumb_NER.jpg` covers 41
Niger products and `thumbnail/ago_downloaded.png` covers 155 items, while every
item still gets its own URL because the URL carries the item id. Measured on the
live group, 862 of 991 items share a name and only 108 are unique.

`buildDistinctThumbnailIndex` collects the names used exactly once and
`distinctThumbnail` returns a URL only for those. Everything else renders a
plate carrying `itemEdition` - the round, cycle, month/year or year parsed from
the title - in large type on the existing pathway-coloured ground, which already
encodes the pillar. The plate sits top-left so it clears the product badge the
FAO theme moves to the bottom-left, and its rule overrides the watermark
selector in `styles.css` that targets any span inside a card image.

`FeaturedEvidence` no longer requires a thumbnail when choosing homepage cards.
That filter had been quietly ranking products carrying a shared country basemap
above newer ones with no image at all.

### 8. Cache the catalogue across reloads and show the shell immediately [SHIPPED]

A cold load fires 16 ArcGIS requests, of which 11 are paged group searches of
100 records each, before anything renders. `/countries` holds a centred spinner
for roughly five seconds. The only cache is the in-memory promise at
`src/services/countries.ts:261`, so a hard reload, a new tab or a returning
visitor pays the full cost again. `fetchedAt` is recorded and never used, and
`fetchCountryCatalog()` accepts no `AbortSignal`, so `useCountryCatalog` cannot
cancel it.

**Edit.** Persist the normalised catalogue to `sessionStorage` keyed on group
id, render it immediately, and revalidate in the background against `fetchedAt`
with a short TTL. Render the filter bar and card skeletons on first paint
instead of a blocking spinner.

ArcGIS Online must remain the authoritative source. See "Do not do", item 1.

Impact: performance. Effort: 1-2 days.

**Implementation note.** The normalized group is written to `sessionStorage`
under a versioned key. A copy younger than 15 minutes resolves immediately while
a background refresh updates the cache for the next load; anything older waits
for the network as before. Measured: a cold load takes about 5 s and 11 paged
requests, a cached load resolves in 21 ms with identical counts (856 items, 54
countries). ArcGIS stays authoritative - every load still revalidates, and a
read or write failure is caught and ignored rather than surfaced.

Only the declared contract is persisted. `normalizeItem` spreads the raw ArcGIS
item, so fields this application never reads rode along: `licenseInfo` alone was
498 kB of licence boilerplate and is read only for protected data items, while
`typeKeywords` and `accessInformation` are read nowhere. Projecting to the typed
fields took the cache from 1855 kB to 706 kB.

The catalogue's blocking spinner was replaced by the real filter bar plus a
16-card skeleton grid occupying the same geometry as a page of results.

### 9. Split the bilingual country introduction

`/countries/NER` prints the full English "About Niger" text and then, with no
heading, divider or control, the entire French translation immediately beneath
it, including a second "Plus d'informations" link list duplicating the first.
Both versions present 2023 figures ("FAO requires USD 25.6 million for 2023",
"the recent coup d'etat") as current, with no as-at date.

**Edit.** In `src/components/CountryEditorial.tsx`, render one language with a
control to switch. Date the block from the editorial record and show "Country
context, last reviewed <date>".

Impact: content. Effort: half a day.

### 10. Add a skip link and stop emitting a `<nav>` per card [SHIPPED]

There is no skip link on any route; every page places roughly twenty header
links and two dropdowns ahead of the content for a keyboard user.
`src/components/CatalogContentCard.tsx:86` wraps each card's language chips in
`<nav aria-label="Available languages for ...">`, producing 16 navigation
landmarks per catalogue page. No image on any page declares `width`/`height`,
and all 16 thumbnails use `loading="lazy"`, including those above the fold.

**Edit.** Add a skip link to `SiteHeader`; change the language nav to a `<ul>`
with a visually hidden label; set intrinsic dimensions on thumbnails and drop
`lazy` from the first row.

Impact: accessibility. Effort: hours.

**Implementation note.** The skip link is the first focusable element in
`SiteHeader`, off-screen until focused. Only five of the twenty page components
give their `<main>` an id, so the target is resolved at click time rather than
through a fixed hash: the handler finds `main`, applies `tabindex="-1"` and
moves focus. Without that tabindex the browser scrolls but leaves the cursor in
the header, and the next Tab returns to the navigation. Verified end to end on
`/catalog`: Tab reveals the link, activating it focuses `<main>`, and the next
Tab lands on the search box. **Tab stops before the search box: 19 to 2.**

The per-card language `<nav>` is now a `<div>` holding a `<ul>` labelled by its
own "Available in" text. Landmark counts fell from 6 to 3 on
`/catalog?country=NER` and from 4 to 4 on a country page where the remaining
landmarks are all genuine (Primary, Mobile, Breadcrumb, Country resource pages).
The chips are pixel-identical - the flex row, 48x21 px bordered links and 34 px
block height are unchanged.

The image half of this item was withdrawn. The claim of layout shift was wrong:
`.card-image` and `.hub-area-image` set a fixed 175 px height with
`object-fit: cover`, so the container reserves the space whether or not the
image has loaded. Item 7 separately added intrinsic dimensions to card
thumbnails. What remains is minor - four homepage images sit at 880 px against
a 900 px fold and are marked `loading="lazy"` - and was left alone.

---

## Findings by lens

### 1. Visual craft

**Two of the three declared typefaces never load.** `:root` declares
`font-family: 'DM Sans'` at `src/styles.css:4`. Six rules declare
`'Source Serif 4'` for the italic hero accent: `.hero h1 em`,
`.countries-hero h1 em`, `.impact-hero-content h1 em`, `.about-hero h1 em`,
`.programme-hero h1 em` and `.country-editorial-richtext`. There is no
`@font-face` and no font link in `index.html`. Measured on the rendered
homepage, `.hero h1 em` computes to Open Sans - not Source Serif and not the
Georgia fallback, because the FAO theme overrides it. The intended
serif/sans contrast in "decisions can't wait." does not exist on screen; the
accent differs from its heading only in colour.

Similarly `--ink: #18333f` is defined and then beaten by `body { color: #545454 }`
at `src/fao-adaptation.css:26`. All body copy renders at a washed mid-grey the
token system says it should not be.

**There is no colour system, only a token veneer.** 464 distinct hex values
across 952 colour declarations, against 7 CSS custom properties. The greys
alone include `#60747b`, `#60737a`, `#60767e`, `#617278`, `#61747a`, `#61757c`,
`#61767e`, `#62747a` and `#62767d` - values inside a range no eye can separate,
each written by hand at a different moment. This is the mechanism by which the
site will keep drifting.

Border-radius is disciplined: 0 and 2px dominate, with 50 percent for avatars.
The site is not over-rounded. 48 distinct `box-shadow` values are the same
sprawl in a different property.

**The type scale is a long tail, and its tail is illegible.** 165 declarations
sit below 12px against 25 at 14px: 63 uses of 9px, 12 of 8px, 90 of 10px, 73 of
11px. `.member-name small` is 9px; `.nav-dropdown-menu small` is 10px. Sizes
run 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 28, 42 and 45
plus five different `clamp()` ranges for headings that all mean "page title".

**Spacing and alignment inconsistencies visible in one screen.**

- The four "Explore the Hub" cards have 2-, 3-, 2- and 2-line bodies, so the
  "Explore" affordance sits at four different heights; no baseline lock on the
  card footer.
- "DIEM in numbers" lays out three figures in tier one and two in tier two on a
  `repeat(3, 1fr)` grid (`src/styles.css:99`), leaving an empty third cell.
- At 768 px the catalogue filter bar wraps 1 / 3 / 2 and orphans "Seasonal
  calendar" onto its own chip row.
- At 390 px the hero's `min-height: 545px` (`src/styles.css:71`) leaves roughly
  250 px of empty deep blue below the last element.

**Orange has drifted into being a generic accent.** Against the AGENTS.md rule
"orange sparingly for urgency/action", orange currently marks every `.eyebrow`
and `.kicker` on the site (`src/styles.css:75`), the active nav underline, the
hero search submit button, the left rule on every `.pn-tier-label`, the
dropdown hover rail, and the third access-tier card on `/data` - which is the
least urgent state on that page. Reserve it for the hero CTA and genuine
alerts; move eyebrows and rails to deep blue.

**Light-only, and that is defensible.** Nothing in the CSS responds to a dark
preference. For an FAO institutional site this is a legitimate choice, but it
should be a stated one.

### 2. "Made by AI" tells

**The catalogue introduces itself four times before showing a product.**
Between header and first filter the visitor reads: eyebrow PUBLIC CATALOG, h1
"Explore DIEM products", a hero paragraph, eyebrow FIND EVIDENCE, h2 "The
complete collection", then another explanatory paragraph. About 250 px of a
900 px viewport spent saying "this is the catalogue".

Currently, at `src/pages/Catalog.tsx:113`:

> Explore DIEM products
> Search the complete public collection of evidence, data, maps and analytical
> resources.

Rewrite:

> DIEM catalogue
> 817 published products from 54 countries, drawn live from the DIEM Hub
> content group in ArcGIS Online. Filter by pillar, product type, country or
> year.

Then delete the second heading block entirely and let the filter bar follow the
h1.

**Gradient-free, but still the four-feature-card grid.** Four cards of
identical weight, identical photo aspect and identical "Explore" affordance,
under a heading with a right-hand paragraph that re-lists the four card titles
(`src/components/HubAreaCards.tsx:106`):

> Move directly to household monitoring, hazard impacts, flood services or
> country evidence.

Delete that line; the cards are directly below it. Give the four unequal
weight: "Country evidence" is the entry point most first-time visitors need and
the only one leading to a real index, while "Flood services" is a programme
explainer.

Card copy currently, at `HubAreaCards.tsx:22`:

> Explore assessment dossiers and the Living Shock Atlas by country, hazard and
> year.

Rewrite:

> 122 hazard impact assessments, indexed by country, shock type and year.

**A carousel in prime position where two of three slides say "Coming soon".**
"Products, research and risk" gives a full-width band to a three-slide
carousel. Slide 1 links to the catalogue. Slides 2 (DIEM-Research) and 3
(DIEM-Risk) are non-links reading "Coming soon" with an empty grey panel where
the image should be (`HubAreaCards.tsx:47-56`). A visitor who operates the
control is rewarded twice with nothing.

Slide 1's illustration - ArcGIS item `d923904e390c4d57a814c1ca77a9cbe1` - is
the clearest generated-image tell on the site: a stylised farmer in a wheat
field with floating chart glyphs, a rising line graph, "+4.4 / +6.1" figures
and glowing circular icons. On a page whose other imagery is real field
photography it reads as stock AI art.

Remove the carousel. Make the catalogue a plain full-width band with the live
count; move DIEM-Research and DIEM-Risk to a one-line "In development" note.
Replace the illustration with a photograph or nothing.

**Filler that hides missing metadata**, at
`src/components/CatalogContentCard.tsx:74`:

> Open this resource to view its complete description and metadata.

Rewrite:

> No description in the catalogue record.

The first pretends there is something to find and sends the reader off-site to
discover there is not. The second is true and creates pressure on editors to
fix the record.

**"DIEM in numbers" is close to filler stats, and one number is fake.**
820,548 surveyed households, 232 surveys, 42 countries, 122 hazard impact
assessments, 817 public resources. Four are live; 42 is hardcoded. There is no
note on how households are counted, over what period, or from which service -
only a small "Since June 2020" in the corner. Keep the block, but add one line
of provenance naming the statistics service and the as-at date.

**What the site does not do.** Three tells from the brief are absent and should
not be "fixed": there are no emoji headings anywhere; there is no gradient hero
(it is flat deep blue with a subtle grid mask); corners are not over-rounded.
The 404 page - "This DIEM Hub page does not exist. The address may be outdated,
or the content may have moved into the country or data workspace." - is
well-written, specific, and offers two real recoveries.

### 3. Information architecture and the three real journeys

**Task 1, find the data for a country.** Home to Countries to map or directory
to `/countries/NER` works well. The directory card (ISO3, region, flag, product
count, per-type breakdown) is the best component on the site; the country hero,
breadcrumb and outline map are good.

Where it stalls: the page then runs about 4,000 px - bilingual editorial, demo
highlights, monitoring band, EVE band, product-type tiles, then a second
search/year/sort bar and 43 cards. The tiles say "14 Country Briefs", the
pillar chips say "Regular monitoring 23 / Hazard impact 2 / Seasonal calendar
2" against "All pathways 43", and the two sets of numbers are never reconciled
on screen. Nothing about the tiles indicates whether they filter the list below
or navigate away. The dead end is at the card: every product link opens a new
tab straight to ArcGIS, so the journey ends by leaving the Hub.

**Task 2, find recent evidence on a theme.** A visitor with "floods" in mind
has three entry points: the Flood services nav item (a programme explainer
about EVE and VISTA), the Hazard impacts nav item, and `/catalog?q=flood`. None
is presented as the theme index, and there is no theme facet - the six controls
are Pillar, Product, Country, Format, Year, Sort. "Pillar" is the closest, and
the label means nothing to an outsider even though its options are
recognisable.

Wasted click: the homepage "Recently published across DIEM" strip shows eight
cards sharing one bulk-update date, so the section answers a question nobody
asked - what did ArcGIS touch most recently?

**Task 3, request access to protected data.** `/data` is the best-written page
in the app. "Accounts are free. Privileges take about ten minutes to activate
after you create one." The three-tier explanation is specific about what each
tier opens and correctly notes that signing in is not the same as being granted
access. The V3/V2/V1 generation cards are genuinely useful.

But signed out the page lists zero datasets. There is no inventory of what
exists - no countries, rounds, variables, record counts or licence text. The
visitor is asked to create an account to find out whether the account is worth
creating. A shared deep link to `/data/:datasetId` renders a centred gate
reading only "Sign in to explore this dataset"; it never names the dataset, and
an invalid id renders the same page rather than a 404.

Publish the manifest metadata - title, generation, countries, rounds, record
count, licence, last update - as public content and gate only the records and
the download. The gate then reads "Sign in to download DIEM aggregated
indicators, ADM1, V2 - 34 countries - rounds 1-14", which is a reason to sign
in. See "Do not do", item 2, for the boundary this must not cross.

**Every page ends in a dead end.** `src/components/SiteFooter.tsx:18-25`
contains six FAO corporate legal links and nothing else - no catalogue, no
countries, no data access, no about. On a site whose pages run 2,500-4,000 px,
the reader who scrolls to the bottom is offered only a way off the site.

### 4. Functionality gaps

**Working already, and better than expected.** Verified live:
`?country=NER&sort=oldest&q=flood&page=3` all round-trip; filters reset the
page; `q` uses `replace` so typing does not spam history; an out-of-range page
self-corrects (`src/pages/Catalog.tsx:90-107`). Result counts are present and
live-regioned. The empty state offers "Clear filters". Pagination is real and
not capped at 100 records - `fetchCatalog` pages the whole group. These are the
things catalogues of this kind usually get wrong.

**No product page, so no deep link, no citation, no related items.** Every
product link is `target="_blank"` to ArcGIS - at
`src/components/CatalogContentCard.tsx:47` and again at `:73`, two separate
links to the same destination and two tab stops per card. Consequences: nothing
on the Hub is citable; there is no place to show the full description, tags,
extent, other rounds of the same series or further language editions beyond two
chips; there is no related-products surface; and no download or citation
affordance exists anywhere on the site.

**The rest of the gap list.**

- No multi-select facets. Every filter is a single-value `<select>`; you cannot
  ask for Niger and Mali, or 2024 and 2025.
- No language facet, despite 39 reviewed multilingual families and language
  chips on the cards.
- No page-size control and no jump-to-page. 52 pages, Previous/Next only.
- Paging does not scroll to the top of the results; `update('page', ...)` at
  `Catalog.tsx:149` changes the URL and leaves the viewport where it was.
- Breadcrumbs exist only on country detail. `/catalog`, `/data` and the
  programme pages have none; the catalogue offers a lone "Back to DIEM Hub" at
  the very bottom.
- The empty state does not name the culprit. It says "Try removing a filter"
  without saying which filter removed the last result, and offers only
  all-or-nothing "Clear filters".
- No shareable "copy link to this view", even though the URL is already
  correct.
- No per-route `<title>` or meta. `index.html` ships one static title and
  description for all fourteen routes; no canonical, no Open Graph, no
  `schema.org/Dataset`.

### 5. High-leverage additions

All eight exploit metadata already present in the ArcGIS group response. None
needs a new backend, and none creates a competing source of truth.

**Round timeline per country.** Country pages already know each product's
series and round number. Render them as a horizontal round axis: one column per
round, dots for brief, questionnaire, presentation and EVE report. A gap in the
row reads immediately as "round 6 has no brief", which is the question a
country analyst arrives with, and it turns a 43-card list into a picture of
coverage. Value: high. Effort: 2-3 days. Risk: round numbers are parsed from
titles, so a mis-parse shows a false gap - render only what parses and label
the rest "unsequenced".

**"What changed this month" digest.** Every item's `created` and `modified` are
already fetched. Replace the marquee with a dated digest: new items this month,
items whose metadata changed, countries that gained a round, grouped by week
with counts. Converts the weakest section into the most repeat-worthy one and
is honest about the published/updated distinction the site currently blurs.
Value: high. Effort: 1-2 days. Risk: a bulk re-tagging day such as 24 Aug 2026
produces a 900-item "change" - cap and label such days as maintenance.

**Coverage matrix, countries by product type.** `summarizeCountry` already
computes `typeCounts` per country. Render the whole thing as one dense matrix
on `/countries`: 54 rows, ten product-type columns, cell equals count, empty
equals no coverage, every cell linking to a pre-filtered catalogue URL the
routing already supports. Value: very high; no other DIEM surface shows this.
Effort: 2 days. Risk: publicly exposes coverage gaps - a feature, but confirm
with the programme first.

**Metadata health panel, published not hidden.** `CountryCatalog.diagnostics`
already counts items without a country, without a product type, with malformed
types, and excluded by catalog role, and none of it is rendered. Publish it on
an about-the-catalogue page. Institutions that publish their own metadata gaps
are trusted more, not less, and it gives editors a live worklist. Value: high.
Effort: half a day; the numbers already exist. Risk: must be framed as data
quality, never as taxonomy - see lens 7.

**Series grouping in the catalogue.** Language variants are already grouped
into families. Apply the same idea one level up and collapse "Niger - DIEM
Monitoring Brief - Rounds 4 to 11" into one expandable row. On the Niger page
that turns 43 near-identical cards into roughly 8 series, removing most of the
repetition that makes the grid look generated, without touching an ArcGIS
record. Value: high. Effort: 2-3 days. Risk: titles are mutable - group only on
an exact prefix match plus a trailing round number and leave everything else
ungrouped.

**Copy citation, per product.** Item id, title, publisher, year and canonical
ArcGIS URL are all in hand. One button produces a formatted citation and a
persistent link. Table stakes for an FAO evidence catalogue and currently
absent. Value: medium-high. Effort: half a day once a product page exists.
Risk: titles change - cite the item id as the stable identifier, per AGENTS.md.

**Map-first catalogue view.** The atlas on `/countries` and the country facet
on `/catalog` are the same data seen twice. Add a map toggle to the catalogue:
current filters shade the choropleth by result count, clicking a country adds
it to the filter. Reuses `ImpactAtlasMap` and existing URL state; no new
dependency. Value: medium-high. Effort: 2 days. Risk: the FAO boundary
disclaimer must travel with every map instance.

**Language-complete badge on families.** Show "English only" or "English -
French" consistently on every card rather than only on multi-variant ones, and
add the language facet. This also surfaces the two mis-tagged records in lens 7
instead of hiding them. Value: medium. Effort: half a day. Risk: depends on
`DIEM-LANGUAGE:` tags being correct - add a title-marker cross-check.

### 6. Modern web practice

**The whole catalogue is downloaded before anything renders.**
`fetchCountryCatalog` awaits page 1, fires the remaining ten in parallel,
normalises 991 records, then resolves; only then does a card appear. The one
cache is a module-level promise with no persistence, no TTL and no
revalidation, and the function accepts no `AbortSignal`. The loading copy is
good - "Building the country evidence index / Reading the latest country and
product classifications..." - but a spinner with honest text is still a
five-second wall.

**A 495 KB render-blocking stylesheet on every route.** JavaScript is properly
route-split, and three stylesheets (`DatasetExplorer`, `HouseholdMonitoring`,
`data-access`) are split out too. Everything else is bundled into a single
`dist/assets/index-*.css` of 495 KB, linked from `index.html` and therefore
render-blocking on all fourteen routes: `catalog.css`, `countries.css`,
`impact-assessments.css`, `promotions.css`, `programme-pages.css`,
`survey-releases.css`, all of Bootstrap, and the 143 KB FAO theme. The theme
alone carries 379 `url()` references, mostly around 250 country flag SVGs of
which the site uses 54, and pulls Montserrat, Merriweather, Open Sans, Cairo
and a complete Noto Sans JP family; the site renders no Japanese.

Measured from `npm run build` at commit `113d271`, not from the dev server.

**Guaranteed layout shift, delayed LCP.** None of the 18 images on a catalogue
page declares intrinsic dimensions, so every thumbnail grid reflows as it
loads. All 16 thumbnails are `loading="lazy"`, including the four above the
fold, which delays the largest contentful paint rather than helping it.
Thumbnails are requested at `?w=800` and displayed at roughly 280 px.

**Keyboard and screen-reader detail.**

- No skip link on any route.
- 16 spurious `<nav>` landmarks per catalogue page from per-card language
  lists.
- Nav dropdown triggers carry `aria-haspopup="true"` but no `aria-expanded` and
  no `aria-controls`; menus open on `:hover`/`:focus-within` only
  (`src/styles.css:44`), so there is no explicit open state to announce and no
  Escape-to-close.
- Each card exposes two tab stops to the same URL.
- Sub-11px text is used for real content, not only labels.
- `SiteHeader`'s `active` prop is passed by hand per route, so `NotFound`
  highlights "Home" and the 404 claims you are on the homepage.

Credit where due: `prefers-reduced-motion` is genuinely respected in six
stylesheets and in `src/components/ProgrammeNumbers.tsx:24`; the marquee pauses
on hover, on focus and on an explicit user control, and duplicates its track
with `aria-hidden` and `tabIndex={-1}`. That component is carefully built - the
objection to it is editorial, not technical.

**Fourteen routes, one title.** Nothing sets a per-route `document.title`.
Every page is "DIEM Hub 3.0 | Data in Emergencies" in the tab, in bookmarks, in
history and in shared link previews. No canonical, no Open Graph image, no
structured data. For a public catalogue whose purpose is discovery this is the
largest untapped return on a day's work.

### 7. Trust and credibility

**The UI trusts the family tags without a sanity check, and two are wrong.**
Queried against the live group, 37 items carry `DIEM-LANGUAGE:French`. Two are
not French. "Honduras - DIEM Monitoring Executive Brief - Round 4" is tagged
French and paired with a Spanish sibling, so its card on the catalogue's first
page offers "Available in: French, Spanish" for a Honduran document with no
French edition. "Nigeria - Household Questionnaire - Round8" is likewise tagged
French.

`itemLanguage` at `src/lib/productFamilies.ts:36` checks the tag first and
returns immediately, never cross-checking the title marker it already knows how
to parse three lines below. Reverse that precedence, or flag disagreement
rather than silently trusting the tag.

**Where the provisional-taxonomy rule is being strained.** The AGENTS.md rule
is respected where it matters most: the country page carries "Product
classifications are maintained in the DIEM Hub content group", and the
catalogue links "View source group". Both are correct and should stay. Three
places strain it:

- "Pillar" as a filter label on `/catalog`. The word is institutional
  vocabulary implying an approved programme structure; these are group
  categories added during an additive audit. Rename to "Category (DIEM Hub
  content group)" or "Evidence type".
- "Unclassified" as a badge (`CatalogContentCard.tsx:29` and `:55`). It reads
  as a verdict on the product. "Type not recorded" describes the record, which
  is what is actually true.
- The homepage `itemTheme` matcher at `src/lib/catalog.ts:19` guesses a theme
  by regex over title and tags. It is documented as a presentation aid, but
  nothing on screen says so.

**Nothing on the site says when it last read ArcGIS.** `CatalogData.fetchedAt`
and `CountryCatalog.fetchedAt` are both captured and neither is rendered. A
catalogue over a live upstream should say "Read from the DIEM Hub content group
at 14:22 UTC" in the results meta line. It costs nothing, explains why a count
changed between visits, and is the cheapest credibility gain available.

**Undated context presented as current.** "To assist 1.13 million people FAO
requires USD 25.6 million for 2023" and "the recent coup d'etat" are rendered
without any date, in 2026, above live 2026 catalogue records. Every editorial
block needs a visible review date, and stale ones should say so.

**Carried forward from the handoff, not a new finding.** V3 occupies the
reference slot on `/data` with simulated COD/NGA/TCD round-99 records, flagged
per card and by a section notice. The flagging is honest and adequate for a
review environment. Listed here only so it does not fall off the launch
checklist: `REFERENCE_GENERATION` in `src/services/protectedData.ts` is the
single control, and no preview flag may survive a production cutover.

---

## Do not do

Tempting changes that would make this product worse.

1. **Do not cache the catalogue into a local JSON file or a database.** The
   five-second load is real and a build-time snapshot is the obvious fix. It is
   also a direct violation of the first rule in AGENTS.md: ArcGIS Online is
   authoritative and must not gain a competitor. Solve it with a session-scoped
   cache plus revalidation.

2. **Do not filter protected content in the UI to make `/data` feel richer.**
   Showing dataset metadata publicly is the recommendation in lens 3. Showing
   records, previews or download links the user's ArcGIS token would not
   authorise is not. Content visibility must end up enforced by sharing and the
   active token; a UI filter that looks the same is a security regression.

3. **Do not add a dark mode.** The colour layer is already fighting itself -
   464 hex literals against 7 tokens, the FAO theme overriding `--ink` and the
   hero serif. A second palette on that foundation doubles a problem not yet
   solved once. Consolidate to tokens first.

4. **Do not replace the ArcGIS thumbnails with generated illustrations.** The
   identical basemap tiles are useless and should go. Replacing them with AI
   imagery - the route already taken on the portfolio carousel - moves the site
   further from institutional credibility. Type, real photography, or nothing.

5. **Do not enable the timed pop-up campaign.** `EditorialPopup` fires on a
   4.5-second dwell plus a scroll trigger and remembers dismissal for a
   configurable number of days. It is currently dormant. On a public UN
   evidence site an interstitial that interrupts a reader mid-page has no
   defence. If a campaign must be promoted, give it an inline band.

6. **Do not "fix" the country directory cards.** ISO3, region, flag, product
   count and per-type breakdown in a quiet bordered card is the best-designed
   component in the app and the only place the data's shape is visible. Any
   harmonisation pass should move the rest of the site toward it.

7. **Do not soften the 404 or the `/data` access copy.** "Accounts are free.
   Privileges take about ten minutes to activate after you create one" and
   "What you can actually download is decided by the permissions attached to
   your account, not by signing in" are the two best sentences on the site.
   Rewrite everything else toward this register, not away from it.

8. **Do not delete the marquee's pause controls while removing the marquee.**
   If "Latest evidence" becomes the change digest proposed in lens 5, keep the
   reduced-motion handling, the hover/focus pause and the aria-hidden duplicate
   track. Only the editorial premise is wrong.

---

## Verification method

- Dev server `npx vite --mode http-test` on `http://127.0.0.1:4174`, anonymous
  session, no signed-in pass.
- Viewport emulation at 1440x900, 768x1024 and 390x780.
- Live queries against
  `https://www.arcgis.com/sharing/rest/content/groups/ab8a43038b6347ac93507988f7e2a90b/search`
  for the language-tag and record-count findings.
- CSS token, colour and type counts taken by static census over `src/*.css`.
- Computed styles read from the rendered homepage for the typeface and body
  colour findings.

The authenticated `/data` workspace was **not** exercised; that pass remains
open in `docs/handoff.md`.

---

# Addendum, 2026-09-04: where a product click goes

Added after the review above was written and phases 1 and 2 were shipped.
Triggered by a reader question: clicking a card opened a new tab on
`arcgis.com/home/item.html?id=...`, leaving the Hub. Measurements are against
the live content group on 2026-09-04 and the group is changing daily; re-count
before acting on them.

## The finding

`itemDestination` (`src/services/arcgis.ts:82`) returns `item.url`, falling
back to the ArcGIS item page when the item has none. For an uploaded file that
fallback is a **detour, not a destination**: the reader lands on an ArcGIS
interface and still has to click again to reach the document.

Of 991 records in the group at time of measurement:

| Kind | Count | Where a click lands today |
|---|---|---|
| Uploaded files: Excel 250, PDF 203, Image 44, PowerPoint 4, Shapefile 1, CSV 1 | **503** | ArcGIS item page - a detour |
| ArcGIS apps: Web Map 37, Hub Page 26, Dashboard 14, Form 7, Service Definition 2 | 86 | item page - correct, the app lives there |
| External `url`: openknowledge.fao.org 247, storymaps 84, services5 37, doi.org 20, other 14 | 402 | the real destination - already correct |

**About half the catalogue sends the reader somewhere they did not ask for.**

The file itself is one URL away. `GET /sharing/rest/content/items/<id>/data`
was confirmed on several public items to return `200` with the correct type
(`application/pdf`, `application/vnd.openxmlformats-...sheet`) and the original
filename, for example `EVE_biweeklyreport_MOZ_period_55_en.pdf`.

## Options

**A. Link straight to the file.** Hours. For the 503 file items, point at
`/data`. PDFs open in the browser's viewer, spreadsheets download under their
real name, and the ArcGIS detour disappears. Gating is unchanged: ArcGIS
enforces item sharing on that endpoint exactly as on the item page, and the
catalogue lists only public items. Needs the failure path in the next section.

**B. A Hub product page at `/catalog/:id`.** Three to five days. The
structural fix already argued for in lens 4: description, provenance, dates,
language editions, other rounds in the series, a citation and a download button
using A's URL. Deep links, shareable products and related items all follow from
it, and it is the only place a withdrawn item can fail gracefully.

**C. Preview the document inside the Hub.** One to two days *on top of B*, not
instead of it - a preview needs a page to sit on. Two corrections to the first
assessment of this option:

- The size objection was a generalisation from a single 6.6 MB outlier. Over a
  40-item sample the median PDF is **1.29 MB**, p90 7.5 MB, max 17 MB, with 7 of
  40 above 5 MB. The median case is fine to preview; only the tail is a problem,
  which argues for a size threshold rather than for dropping the option.
- Whether ArcGIS permits framing these files is **unverified**. A first iframe
  test appeared to succeed but had run against a 403 error page, which also
  fires `load`; a retry against a file that genuinely serves was inconclusive in
  the review browser, which has no PDF viewer. Decide C by opening
  `/sharing/rest/content/items/<id>/data` in an iframe in a real browser.

**D. Label the link.** One hour. Mark it "opens in ArcGIS". Honest, but the
detour remains.

Suggested order: A with a failure path, then B, then C if the framing test
passes, with a size cap and a download link above it.

## Catalogue volatility, and what it means for A

While this addendum was being written, the item that prompted the question was
withdrawn from the group. Its metadata read normally at the start of the
session - "Mozambique - EVE biweekly report for Period #55", public PDF, 6.6 MB
- and twenty minutes later both the item endpoint and `/data` returned a
genuine ArcGIS 403, with a full group scan no longer finding it.

Over the same session the group went from **991 items to 913**. Either an
editor was changing sharing at the time or a bulk operation was running; that
should be confirmed with the content owners rather than assumed.

Two consequences:

1. **Option A needs a graceful failure.** A direct `/data` link for a withdrawn
   item drops the reader on a bare ArcGIS 403 page, which is worse than the item
   page it replaced, because the item page at least explains itself. The link
   should resolve through a Hub route that can say "this product is no longer
   published".
2. **The session cache makes a stale card more likely to be seen.** The
   catalogue is held in `sessionStorage` for fifteen minutes, so a reader can be
   looking at a card for an item that has since been unshared. That is the right
   trade for load time and it does not need reverting, but it does mean the
   Hub should treat "the item is gone" as a normal state rather than an
   exception.
