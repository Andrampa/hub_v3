# Design and Product Review — 2026-09-07

Internal document. Not published, not deployed. `docs/` is excluded from the
deployment allowlist in `scripts/sync-web-repository.ps1`, so this file stays in
`C:\git\hub_v3` and never reaches `fao-oer-diem-hub` or Firebase Hosting.

Multidisciplinary review of DIEM Hub 3.0 against a public-facing FAO
institutional standard, conducted anonymously on the running application. This
review supersedes nothing in `docs/design_review_2026-09-03.md`; that document
remains the backlog of record for items still marked open there. Section 3 below
reconciles it against what the code and the running site now actually do.

## Status of this backlog

Findings below were recorded before any code changed and are left as written, so
the before-state stays legible. Applied items are marked here, not rewritten in
place; record shipped work in `docs/changelog.md`.

| Field | Value |
|---|---|
| Reviewed | 2026-09-07, commit `84ba9cb` |
| Applied 2026-09-07 | Recommendations **2** (PDF zoom, §7.2), **3** (four surfaces bypassing the product page, §7.3), **4** (thumbnail upscaling, §7.4), **5** (filter target size, §7.5), **6** (data-generation contrast, §7.6), **7** (progressive catalogue loading, §7.7), **8** (third-party CDN imports, §7.8), **9** (tests, §7.9), **17** (sitemap, robots, noindex, §7.14) |
| Open, highest value | **1** — the undated bilingual country editorial block (§7.1). Nothing else on this list has its ratio of institutional risk removed to effort spent. |
| Partially applied | **5**: targets now clear 24 px, but the mobile filter bar grew 522 → 575 px. The "Filters" disclosure with active-filter chips, which is what fixes that, is still open. **7**: progressive delivery is opt-in and only `/catalog` opts in, deliberately (see the changelog). **8**: fonts and icons are self-hosted, but the theme's 251 flag rules and 369 `www.fao.org` asset references were left alone — trimming them to the 54 countries in use breaks when a 55th appears. **17**: descriptions for the remaining 11 routes (recommendation 18) are still open. |
| Residual after **3** | One item — the "Mozambique Floods January 2026" Dashboard — carries neither a catalog role nor a `url`, so it still resolves to an ArcGIS item page. That is an editorial fix in the content group, not a code fix. |
| **Correction to §3** | The reconciliation table credits commit `3b94562` with making `itemLanguage` read the title marker before the `DIEM-LANGUAGE` tag. **That is wrong.** `3b94562` changed `scripts/categorize_monitoring_products.py` and the ArcGIS data, never `src/lib/productFamilies.ts`; the runtime still trusts the tag first with no cross-check. The 2026-09-03 finding was resolved in data, not in code — a live check on 2026-09-07 found 0 of 75 tagged items disagreeing with their title marker — so nothing is currently mislabelled, but the guard that review asked for does not exist. Pinned in `src/lib/productFamilies.test.ts`. |
| Found while testing | Two live defects, both fixed 2026-09-07: `itemRound` did not recognise Spanish `Ronda`, so nine Honduras, Colombia and Guatemala reports carried no round; and `itemTheme`/`itemCountry` were unreferenced dead code in which `itemCountry` returned the whole title as a country name for 171 of the 900 records. Neither appears anywhere in the findings below — writing the tests is what surfaced them. |

---

## 1. Executive summary

### Overall assessment

Four days of work since the 2026-09-03 review have changed this product's
character. The catalogue now has a Hub-owned product page with a citation, a
licence and a PDF preview; facet counts reconcile arithmetically; every route
has a title and a canonical URL; the footer navigates; the colour layer has been
consolidated from 464 hand-written hex values to 180 against 24 tokens; the
palette now passes automated contrast checking on `/` and `/catalog` with zero
failures. The `/data` workspace publishes its inventory to anonymous readers,
which was the single most-argued recommendation of the previous review. The
codebase is unusually well-documented: nearly every non-obvious decision carries
a comment stating the measurement that drove it, including measurements that
*rejected* an earlier recommendation. That is a rare and valuable practice and
it made this review faster and more accurate.

What remains is a different shape of problem from last time. The previous review
found a site that looked machine-generated; this one finds a site that looks
professionally made and still has a small number of specific, load-bearing
defects — most of them at the edges the team has not yet had reason to walk:
mobile, low vision, slow connections, and the surfaces that were built before
the product page existed and were never migrated onto it.

The most serious single problem is not technical. Every country page on the site
carries an editorial block that presents 2023 humanitarian caseload and funding
figures, and a 2023 coup, as current facts in September 2026, with no review
date anywhere on the page, immediately above live catalogue records. That was
recommendation 9 of the previous review. It is the only one of the ten that has
not been touched at all.

### Five strongest qualities

1. **The cross-origin message bridge to the monitoring dashboard**
   (`src/pages/MonitoringSystem.tsx:42-104`). Explicit target origin on every
   post, `event.origin` *and* `event.source` checked on receipt, and the frame
   identity re-checked after the token is minted and before it is posted, so a
   remounted iframe cannot receive a token intended for its predecessor. This is
   better than most production code that does this.
2. **Arithmetic that closes in public.** `/catalog` pathway tabs read
   533 + 126 + 4 + 44 + 8 = 715 = the stated total, under a filter as well as
   open, and a zero tab is shown-but-disabled rather than hidden so the reader
   can check the sum. Very few catalogues do this.
3. **The product-unavailable state** (`src/pages/CatalogProduct.tsx`). The
   product page re-resolves each item against the live group rather than the
   cache, so a withdrawn item produces a Hub page explaining itself instead of a
   bare ArcGIS 403. This directly implements the lesson of the 2026-09-04
   addendum and is the right architecture for a catalogue over mutable upstream.
4. **The register of the `/data` copy.** "What you can actually download is
   decided by the permissions attached to your account, not by signing in" is
   the best sentence on the site and the surrounding page holds that standard.
   The public collection inventory added since the last review turns `/data`
   from a locked door into a reason to knock.
5. **Defence in depth on visibility.** `catalogueVisible` in
   `src/services/arcgis.ts:78` filters restricted microdata views out of the
   catalogue even though provisioning already refuses to share them there, and
   the comment says exactly why. The catalogue is fetched anonymously with no
   token at all, so a signed-in user sees precisely what an anonymous one sees.
   Both are correct fail-safe choices.

### Five most important weaknesses

1. **Three-year-old country context published as current, in two undated
   languages, on 55 country pages.** `/countries/ner` renders 1,350 px — the
   largest section on the page — of English prose followed immediately, with no
   heading, divider, language control or `lang` attribute, by its complete
   French translation, including a duplicate link list. Both halves state
   "3.2 million people projected to be in high acute food insecurity",
   "FAO requires USD 25.6 million for 2023" and "the recent coup d'état" with no
   as-at date. An analyst can cite these as September 2026 figures.
2. **The PDF zoom control does nothing.** Confirmed by measurement: at 125 %
   the canvas backing store is 1200 px and the displayed width is 1006 px; at
   200 % the backing store is 1920 px and the displayed width is still 1006 px,
   because `max-width: 100 %` clamps it. A low-vision reader who presses Zoom in
   gets a sharper image at identical size, four times the render cost, and no
   magnification. At 375 px the same viewer renders an A4 page 273 px wide.
3. **Four discovery surfaces still send readers off the Hub on the first
   click.** The homepage "Latest evidence" strip, the whole
   `/hazard-impact-assessments` page (124 assessments), the monitoring product
   library and the `/flood-services` assessment list all use `itemDestination`
   rather than `itemProductPath`, so they bypass the product page, its citation,
   its licence, its preview and its graceful-withdrawal state — and for the
   ~half of the group that is an uploaded file with no `url`, they land the
   reader on the ArcGIS item-page detour the 2026-09-04 addendum documented.
4. **The catalogue costs 1.86 MB of JSON and about 1 MB of upscaled thumbnails
   before a slow-connection reader sees anything useful.** Nine paged group
   searches transfer 1,859 kB to render 16 cards. Separately, thumbnails are
   requested at `?w=800` from a 500 × 500 source and displayed at 285 × 138:
   66,582 bytes each where the unsized original is 6,943 bytes, so roughly
   0.95 MB per catalogue page buys no additional detail whatsoever.
5. **One test file.** `npm test` runs 19 tests, all of them in
   `microdataGrants.test.ts`. There is no test for `distinctSummary`,
   `itemRound`, `itemYear`, `itemEdition`, `groupProductFamilies`,
   `itemLanguage`, `citationFor`, `buildCatalogSearchIndex`, or the category
   normalization in `services/countries.ts` — all pure functions, all trivially
   testable, and collectively the logic that decides what every card says.

### The single highest-leverage next action

**Date the country editorial block, split its two languages, and hide anything
whose review date is older than a stated threshold.** It is roughly a day of
work in `src/components/CountryEditorial.tsx` and
`src/services/countryEditorial.ts`, it removes the only place on the site where
an FAO surface asserts stale humanitarian facts as current, and it recovers
about a quarter of the vertical length of all 55 country pages. Nothing else
on this list has that ratio of institutional risk removed to effort spent.

---

## 2. Review scope and evidence

### Baseline

| Field | Value |
|---|---|
| Repository | `C:\git\hub_v3` |
| Branch | `main` |
| Commit | `84ba9cb92e3d55f0090b7e7863e28358525d49dc` — *feat(data): show each user only the microdata they were granted*, 2026-09-04 17:09 +0200 |
| Working tree | Clean apart from untracked `.claude/` |
| Previous review baseline | `113d271` (2026-09-03) — 30 commits behind this one |

### Environments tested

- **Local dev server only.** `npx vite --mode http-test` on
  `http://127.0.0.1:4174` (the `web-http` entry in `.claude/launch.json`),
  anonymous session throughout. No signed-in pass was possible: this review had
  no DIEM community credentials.
- **Live ArcGIS Online**, queried directly for cross-checking: content group
  `ab8a43038b6347ac93507988f7e2a90b` and individual item and thumbnail
  endpoints.
- **No review or production deployment was compared.** Every observation below
  is from the local dev server at commit `84ba9cb` or from a direct live ArcGIS
  query, and each finding says which.

### Build and test results

```
npm run build   → exit 0, built in 4.14 s
npx tsc -b      → exit 0
npx vitest run  → 1 file, 19 tests, all passing
```

Built artefact sizes worth recording:

| Asset | Size | gzip |
|---|---|---|
| `assets/index-*.css` (render-blocking, all routes) | 294.99 kB | 48.17 kB |
| `assets/index-*.js` (entry) | 379.73 kB | 109.77 kB |
| `assets/PdfPreview-*.js` (lazy) | 446.83 kB | 132.27 kB |
| `assets/pdf.worker.min-*.mjs` (lazy) | 1,078.61 kB | — |
| `assets/DatasetExplorer-*.js` (lazy) | 194.61 kB | 57.91 kB |
| `assets/bangladesh-flood-2020-*.jpg` | 3,691.22 kB | — |
| `assets/zambia-drought-2024-*.jpg` | 3,311.08 kB | — |
| `assets/cyclone-freddy-madagascar-2023-*.jpg` | 2,177.30 kB | — |

The three hero photographs total **9.2 MB of unoptimised JPEG** shipped as
build assets. They are route-split, but any reader who reaches `/countries/:iso3`,
`/flood-services` or `/hazard-impact-assessments` pays for one of them.

### Live catalogue counts at time of review

Measured 2026-09-07 09:16–09:31 UTC against the live group:

| Quantity | Value |
|---|---|
| Items in the DIEM Hub content group | **900** |
| After `catalogueVisible` and `Catalog role/Discoverable product` | **755** |
| Excluded by catalog role (`diagnostics.excludedByCatalogRole`) | **145** |
| Product families after language grouping (the public "products" figure) | **715** |
| Countries with evidence | **54** |
| Discoverable products carrying no country (`diagnostics.withoutCountry`) | **6** |
| Discoverable products with no product type (`diagnostics.withoutType`) | **17** |
| Malformed product types | **0** |
| sessionStorage cache size after a cold load | **662 kB** |

**The group is shrinking fast and nobody on the Hub side knows why.** On
2026-09-03 it held 991 items and 817 families; during that review session it
fell to 913; today it holds 900 and 715. That is a **12 % fall in public product
families in four days**. This may be entirely legitimate editorial work, but it
is not visible anywhere and it should be confirmed with the content owners
before launch (see Open questions).

### Routes, products and formats sampled

Routes: `/`, `/catalog`, `/catalog?product=Assessment+Reports`,
`/catalog?content=Documents&product=Country+Brief` (deliberately invalid),
`/catalog/34e84a9b46c849c9afa6f8738be4ca91` (PDF, Nepal),
`/catalog/00000000000000000000000000000000` (well-formed, absent),
`/catalog/not-an-id` (malformed), `/countries`, `/countries/ner`,
`/countries/ner?type=Questionnaires&pathway=Seasonal+calendar`, `/data`,
`/data/guide`, `/data/499917f1518141209c2a6de55a79d991` (anonymous gate),
`/data/garbageid`, `/hazard-impact-assessments`, `/no-such-page`.

Formats sampled across cards and product pages: PDF, Document Link, StoryMap,
Microsoft Excel, Image. Metadata-quality levels sampled: products with a
distinct thumbnail and products sharing a country basemap; products with a
distinct summary and products whose snippet restates the title; English-only
families and French/Spanish multi-variant families; products with a CC licence
and products with none.

### Viewports and interaction methods

375 × 812, 768 × 1024 and 1440 × 900, all with emulation applied to the tab.
Interaction by pointer (clicks on real refs), by programmatic DOM inspection of
tab order, ARIA attributes, computed styles and bounding boxes, and by
`performance.getEntriesByType('resource')` for network accounting. Contrast was
checked by computing WCAG 2.x luminance ratios over every text-bearing element
on a page against its first non-transparent ancestor background.

### Important limitations

- **No authenticated pass.** Everything behind the `/data` gate, the dataset
  explorer, packaged downloads, and the temporary microdata grants feature is
  untested here. `docs/handoff.md` already records these as the outstanding
  acceptance tests and this review does not change that.
- **`loading="lazy"` images never fetched in the review browser.** Zero of 16
  catalogue thumbnails issued a network request even when scrolled into view;
  removing the attribute made the same URL load in 4 s. This is an automation
  artefact, not a product defect, but it means **no thumbnail was visually
  confirmed** and all thumbnail findings below are from URL and byte-size
  measurement rather than from looking at the rendered grid.
- **No assistive-technology testing.** No screen reader, no magnifier, no switch
  device, no real touch device. Accessibility findings are split below into
  confirmed violations (measured against a numeric success criterion) and risks
  that need a specialist pass.
- **No Lighthouse / Core Web Vitals run.** LCP, CLS and INP are inferred from
  resource accounting and layout inspection, not measured. They are labelled as
  inferences.
- **Single-session sampling of a mutable upstream.** Every count above moves.

---

## 3. Previous-review reconciliation

Verified against the running application and the code at `84ba9cb`, not against
the `[SHIPPED]` markers in the previous document.

### Implemented, and confirmed working

| Previous item | Evidence today |
|---|---|
| **1.** Delete demo copy from country pages | `/countries/ner` shows no `DEMO CURATION` badge and no "In evidence" band. `fetchPublishedEditorial` drops `is_demo = 1`. |
| **2.** Stop presenting `modified` as a publication date | Cards read "Added 31 Aug 2026" from `created`; the facet is "Year added" and offers 2021–2026; the homepage section is "Recently added to the catalogue". The `created` decision, and the evidence that rejected title-year parsing, are recorded in `src/lib/catalog.ts:59`. |
| **3.** Reconcile the two country counts | Homepage now reads "42 countries surveyed" in the monitoring tier and "54 countries with evidence" in the evidence tier, with a dated footnote. Consistent with `/countries` and `/catalog`. |
| **4.** Catalogue in the primary navigation | "Catalogue" is the last desktop nav item and carries the active state; the mobile menu mirrors the desktop IA and now includes `/data` and the survey explorer. |
| **5.** Facet counts respond to the active filter | Confirmed by measurement: 533 + 126 + 4 + 44 + 8 = 715. A "No pathway assigned" tab exists. |
| **6.** Suppress summaries that repeat the title | `distinctSummary` implemented; fallback is "No description in the catalogue record." |
| **8.** Cache the catalogue and show the shell immediately | `sessionStorage` cache keyed on group id with a 15-minute TTL, background revalidation, and a typed projection that keeps the payload at 662 kB. The catalogue renders its real filter bar plus a 16-card skeleton, not a spinner. |
| **10.** Skip link, and no `<nav>` per card | Skip link is the first focusable element and resolves `<main>` at click time with a programmatic `tabindex`. Card languages are a labelled `<ul>`; `/catalog` reports 3 real landmarks. |
| Lens 1 — the two typefaces that never loaded | Removed. Only explanatory comments remain in `styles.css`. |
| Lens 2 — catalogue announces itself four times | One `<h1>`, one subtitle that states the holdings and their source. |
| Lens 2 — the "Coming soon" carousel | Replaced by a plain full-width catalogue band with the live count. |
| Lens 3 — every page ends in a dead end | `SiteFooter` now carries a three-column site navigation above the corporate legal row. |
| Lens 4 — no product page | `/catalog/:itemId` exists with description, provenance, dates, language editions, licence, citation in three languages, and a PDF preview. |
| Lens 4 — paging does not scroll | Both `/catalog` and `/countries/:iso3` bring the results heading back into view, with the scroll-anchoring reason documented. |
| Lens 4 — no per-route `<title>` or meta | Every route sets a title, canonical and Open Graph tags via `usePageMetadata`; `/catalog`, `/catalog/:id`, `/countries` and `/countries/:iso3` also emit descriptions and JSON-LD. |
| Lens 5 — round timeline, coverage matrix, language badge | All three shipped. The coverage matrix sits in its own `overflow-x: auto` container and does **not** overflow the page at 375 px (measured: `document.body.scrollWidth` 375). |
| Lens 6 — 495 kB render-blocking stylesheet | Now 294.99 kB / 48.17 kB gzip, after dropping Bootstrap for its Reboot and stripping three unused theme font imports at build time. |
| Lens 7 — language tag trusted without a check | `itemLanguage` now reads the title marker first (commit `3b94562`). |
| Lens 7 — "Unclassified" as a badge | Now "Type not recorded", with the sentinel/label split documented at `services/countries.ts:16`. |
| Lens 7 — "Pillar" as an institutional label | Renamed to "Evidence pathway"; "Seasonal calendar" reads "Agricultural calendar" via `pathwayLabel`. |
| Lens 7 — nothing says when ArcGIS was last read | `/catalog` results meta shows "Read at 09:16 UTC". |
| Lens 3 — publish `/data` manifest metadata publicly | Anonymous `/data` now lists every collection by generation, with themes and counts, and states that records and downloads are what require an account. |

### Partially implemented

| Item | What is done | What is not |
|---|---|---|
| **7.** Replace identical map thumbnails | The `buildDistinctThumbnailIndex` / `distinctThumbnail` machinery exists and an edition plate is rendered when no image exists. | The behaviour was **reverted** by commit `e9d209c` ("restore card thumbnails"): `CatalogContentCard` computes `thumbnail = itemThumbnail(item)` unconditionally and only uses the distinctness test to decide whether to overlay an edition badge. Every card with any thumbnail shows it, so `/catalog` page 1 renders 11 distinct per-country basemap files across 16 cards. See §7.6 — this is now a performance finding rather than a craft one. |
| Per-route discovery metadata | Titles, canonicals and OG tags on all 15 routes. | Only 4 of 15 routes set a description or structured data. `/about`, `/data`, `/data/guide`, `/flood-services`, `/hazard-impact-assessments`, `/monitoring-system`, `/photo-galleries`, `/contact` and the two dataset routes all serve the generic `index.html` description, "DIEM Hub 3.0 makes public Data in Emergencies evidence easier to discover and use." |
| Colour system | 464 → **180** distinct hex values, 952 → **658** colour declarations, 7 → **24** custom properties. Zero automated contrast failures on `/` and `/catalog`. | The token layer is now **double-declared**: `--fao-blue`, `--deep-blue`, `--ink`, `--orange`, `--mist`, `--line` and `--paper` are defined in both `styles.css` and `fao-adaptation.css`, and the second wins. See §7.11. |
| `/data/:datasetId` deep-link gate | A known dataset id now names itself: "Sign in to explore Incomes, Shocks and Needs." | An unknown id renders the identical gate with generic copy rather than a 404, so a mistyped link reads as a permissions problem. |
| Lens 4 gap list | Breadcrumbs on the product page; empty state with "Clear filters" on both discovery surfaces; result counts live-regioned on `/catalog`. | No multi-select facets, no language facet, no page-size control, no jump-to-page, no "copy link to this view", and the empty state still does not name which filter removed the last result. |

### Superseded

- **Item 7's proposed fix** was tried, measured and reversed in favour of
  restoring thumbnails. That is a legitimate editorial call; the review below
  treats the current behaviour on its own terms.
- **Item 2's proposed title-year parser** was tested against the live group and
  rejected with evidence (only 20 % of titles carry a four-digit year, many of
  them comparison years). `created` was used instead. This is exactly the kind
  of challenge to a prior recommendation the process should produce.

### Still outstanding

- **Item 9 — split the bilingual country introduction.** Untouched. See §7.1.
- Multi-select facets, language facet, page-size control, jump-to-page,
  copy-link-to-view, culprit-naming empty state (lens 4).
- The `EditorialPopup` interstitial remains wired and one ArcGIS row away from
  firing (previous "Do not do" item 5). Still dormant in this environment; still
  a launch-gate risk rather than a current defect.

### Declined by the editor, and correctly left alone

Series grouping in the catalogue, the metadata health panel, the "what changed
this month" digest, and the map-first catalogue view. This review does not
re-litigate them, with one caveat: `CountryCatalog.diagnostics` is still
computed on every load, written into the 662 kB session cache and rendered
nowhere. If the panel is permanently declined, delete the computation; carrying
dead data through a cache is worse than either shipping it or dropping it.

### Regressed or newly introduced since 2026-09-03

- **Thumbnails restored at `?w=800`** reintroduced roughly 1 MB per catalogue
  page that the previous change had removed, and at a width the source image
  cannot supply (§7.6).
- **The 2026-09-04 addendum's option A was applied only to the product page.**
  Four surfaces still route through `itemDestination` (§7.3), so the detour the
  addendum identified persists on the homepage strip and across the whole
  hazard-impacts page.
- **Box-shadow sprawl grew slightly**, 48 → 51 distinct values, while the colour
  layer was being consolidated.

---

## 4. Scorecard

Scored 1 (unacceptable) to 5 (exemplary). Deliberately not averaged: the low
scores are concentrated in two lenses and averaging would hide that.

| # | Lens | Score | Why |
|---|---|---|---|
| 1 | Product purpose and value proposition | **4** | The homepage answers "what is this and what is in it" in one screen with live counts; the four area cards lead to real indexes. Loses a point because a first-time visitor still cannot tell from `/` what DIEM *does* versus what it *publishes* — "About DIEM" is buried in a dropdown, and the hero states a value, not an activity. |
| 2 | Information architecture and navigation | **4** | Catalogue in both navigations, footer site map, working breadcrumbs on the deepest routes, URL-backed state on `/catalog`. Loses a point for `/countries` having no `<h1>` and no country search, and for country-page pagination and region filtering being invisible to the URL. |
| 3 | Usability and task completion | **3** | Search, filters, sort, pagination and reset all work and round-trip. But a product tile click on a country page moves nothing on screen; unknown URL filter values apply silently while the control shows the opposite; the results line prints a stored value the UI never displays; and four surfaces end the journey off-site. |
| 4 | Content design and editorial quality | **3** | The `/data` and 404 copy are genuinely excellent and `distinctSummary` removed the loudest machine-generated tell. Held down almost entirely by the undated bilingual country block, which is the largest single body of prose on the site and the least trustworthy. |
| 5 | Visual design and FAO identity | **4** | Restrained, institutional, no gradient hero, no over-rounding, disciplined radii, and — measured — zero contrast failures on the two highest-traffic routes. Loses a point for the duplicated token layer, 51 shadow values, and orange marking "Archived" as loudly as "Current standard". |
| 6 | Responsive and mobile experience | **2** | No horizontal overflow at any width tested, and the coverage matrix is correctly contained. But the primary filter controls are 19 px tall, the catalogue spends 522 px of a 812 px screen on filters before the first card, `/countries` is 20,850 px long with no search, and the PDF viewer renders an A4 page 273 px wide with a zoom button that does nothing. |
| 7 | Accessibility | **3** | Real, deliberate work here: skip link, focus-visible ring, `prefers-reduced-motion` in seven stylesheets, a correct combobox with `aria-activedescendant`, landmark hygiene, reduced tab stops on language chips. Pulled down by three confirmed WCAG 2.2 AA failures (§7.4, §7.5, §7.7) and a missing `<h1>`. |
| 8 | Performance and efficiency | **2** | Route splitting, lazy PDF worker, session cache with revalidation, and a stylesheet cut by 40 % are all correct. Overwhelmed by 1.86 MB of JSON before first render, ~0.95 MB of pointlessly upscaled thumbnails per page, 9.2 MB of unoptimised hero JPEGs, and three serial `@import`s to two third-party CDNs at the head of the render-blocking stylesheet. |
| 9 | Reliability and resilience | **4** | The product page re-resolves against the live group and fails gracefully; error states carry retry actions; the editorial banner degrades on image error; cache read/write failures are swallowed. Loses a point because the in-session promise never refreshes, and because a 12 % catalogue contraction in four days passed unnoticed and unexplained. |
| 10 | Technical architecture and maintainability | **4** | Clear service boundaries that match `docs/architecture.md`, no `any` leakage, `tsc -b` clean, sanitised HTML at all three injection sites, and comments that record the measurement behind each decision. Loses a point for the duplicated token layer, `useCountryCatalog` still ignoring `AbortSignal`, and near-duplicate filter/pagination logic in `Catalog.tsx` and `CountryDetail.tsx` that has already drifted apart in three observable ways. |
| 11 | Security, privacy and access control | **4** | Anonymous catalogue fetch, `catalogueVisible` defence in depth, token in `sessionStorage` only, same-origin `BroadcastChannel` handoff with a documented rationale, rigorous `postMessage` discipline, `rel="noreferrer"` on all seven `target="_blank"` links, DOMPurify on every `dangerouslySetInnerHTML`. Loses a point only for the third-party CDN dependency, which sends every visitor's IP to Google Fonts and jsDelivr from a site carrying an FAO data-protection link. |
| 12 | Search-engine and link discoverability | **2** | Per-route titles, canonicals, OG tags and JSON-LD on the four routes that matter most are real progress. But the site is client-rendered with an empty `<div id="root">`, there is no `sitemap.xml` and no `robots.txt` anywhere in the repository, 715 product pages are reachable only by executing JavaScript, and every unavailable product and unknown route returns HTTP 200. |
| 13 | Quality assurance and observability | **2** | One test file, 19 tests, none of them covering catalogue logic. No error reporting, no way to detect that the group lost 91 items, no monitoring of the external services the pages depend on. |

---

## 5. Journey assessment

### J1 — First-time visitor who does not know what DIEM is

**Works.** `/` states the purpose in one line, gives four typed entry points with
live counts ("54 countries, 715 products"), a searchable hero, and a "DIEM in
numbers" block with a provenance footnote naming the as-at dates. The visitor
can tell within one screen that this is a catalogue of food-security evidence.

**Friction.** "What is DIEM?" is inside an "About DIEM" dropdown, so the answer
to the visitor's actual first question is two interactions away and behind a
hover menu. The hero states a value proposition ("Evidence where decisions can't
wait") rather than an activity; a reader who wants "what does this programme
do" has nowhere obvious to go.

**Consequence.** Low. The path to content is good; the path to context is not.

### J2 — Government or humanitarian analyst seeking the latest data for a country

**Works.** `/countries` → map or directory → `/countries/ner` is clean. The
country hero, breadcrumb, outline map, round timeline ("What exists for each
round") and reconciled product tiles are all good, and the tiles now sum
correctly for products (12+2+1+12+2+3+1 = 33 = the stated total).

**Friction.**
- The first 1,350 px below the hero is the undated bilingual editorial block.
  The analyst's eye lands on "3.2 million people projected to be in high acute
  food insecurity" and "FAO requires USD 25.6 million for 2023" with no date
  attached, in September 2026.
- Clicking a product tile filters the list but does not move the viewport, and
  the list is ~500 px further down, so the click appears to do nothing.
- The pathway tiles sum to 32 against a stated 33; there is no "No pathway
  assigned" tile here as there is on `/catalog`.
- Selecting the "Agricultural calendar" tile produces a results line reading
  "0 products found · **Seasonal calendar** · Questionnaires" — a term that
  appears nowhere else in the interface.
- Turning to page 2 of the 33 products leaves the URL at
  `/countries/ner` and adds no history entry, so page 2 cannot be shared and
  Back leaves the country entirely.

**Consequence.** High. This is the Hub's most important journey and it is the
one carrying the stale-figures risk. An analyst who cites the country block is
citing 2023.

### J3 — FAO country-office or field user on a slow mobile connection

**Fails on cost, not on layout.** Nothing overflows at 375 px, the coverage
matrix scrolls inside its own container, and the mobile menu mirrors the desktop
IA. But:

- The catalogue must transfer **1,859 kB of JSON across nine requests** before
  it can show a single real card. On a 400 kbps effective link that is roughly
  37 seconds. The skeleton grid is honest about it but does not shorten it.
- Each of the 16 thumbnails is a **66,582-byte** request for a 500 × 500 source
  displayed at 285 × 138. Roughly 0.95 MB per page, none of it buying detail.
- The six filter controls occupy **522 px** of an 812 px screen, and the first
  product card begins at document y = **1397** — about 1.7 screens of scrolling
  past controls before any content.
- Each control is a `<select>` **291 × 19 px**. Nineteen CSS pixels tall, on a
  phone.
- Opening a PDF preview downloads the whole document (median ~1.3 MB per the
  previous review's sampling) to render a page **273 px wide**, with a zoom
  button that cannot enlarge it.

**Consequence.** Very high. This is the user group the programme exists to
serve and the one the current build serves worst.

### J4 — Researcher looking for a specific report, dataset, round or citation

**Works well, and is the biggest improvement since the last review.** The
type-ahead resolves countries, products and item ids; `/catalog/:id` gives a
stable Hub URL, the ArcGIS item id printed as the durable identifier, a licence
resolved to a named Creative Commons link where recognisable, and a citation in
English, French or Spanish with a copy button. `schema.org/CreativeWork` is
emitted.

**Friction.** No language facet and no multi-select, so "French editions from
Mali and Niger" is not expressible. The breadcrumb's last crumb reads "Product"
rather than the product's name. `navigator.clipboard.writeText` is called
without a `catch`, so a denied clipboard permission silently does nothing and
raises an unhandled rejection.

**Consequence.** Low-to-medium. The core need is now met.

### J5 — Arriving through a shared deep link to a product

**Works, including the hard case.** `/catalog/<absent-but-well-formed-id>`
re-resolves against the live group and renders "This product is no longer
published in the DIEM Hub catalogue… It may have been withdrawn, moved or had
its sharing changed in ArcGIS Online", with two recovery links. This is
precisely right.

**Friction.** A *malformed* id (`/catalog/not-an-id`) produces the identical
"no longer published" page, telling the reader something existed when nothing
ever could have. Both cases return HTTP 200, so a search engine keeps indexing
withdrawn products.

**Consequence.** Low for humans, medium for crawlers.

### J6 — Keyboard-only user

**Works.** Skip link is the first focusable element and correctly moves focus
into `<main>` rather than only scrolling. A global `:focus-visible` ring (3 px
orange, 2 px offset) is defined. Dropdown menus are `visibility: hidden` when
closed, so their links are genuinely out of the tab order, and `Escape` closes
a menu and returns focus to its trigger. Pathway tabs are buttons with
`aria-pressed`. The search combobox supports arrow keys and
`aria-activedescendant`.

**Friction.** Every catalogue card exposes **two tab stops to the same URL** —
the image link ("Open <title>") and the title link. Sixteen cards therefore cost
32 stops where 16 would do. Confirmed at `CatalogContentCard.tsx:68` and `:87`;
the same pattern is in `CountryDetail.tsx:77`/`:96` and
`HazardImpactAssessments.tsx:45`/`:76`. This was raised in the previous review
and not addressed.

**Consequence.** Medium. Not a blocker; a persistent tax.

### J7 — Screen reader or magnification

**Confirmed problems, all specific:**
- `/countries` has **no `<h1>`**; its outline begins at `<h2>`.
- The French half of every country editorial block carries **no `lang`
  attribute** — and `DOMPurify`'s `ALLOWED_ATTR` in `CountryEditorial.tsx:41`
  does not include `lang`, so an editor could not add one even if they tried.
  A screen reader reads ~600 words of French with an English voice.
- The country page's results line (`CountryDetail.tsx:404`) has **no
  `aria-live`**, while the near-identical line on `/catalog` does. Filtering a
  country page announces nothing.
- The PDF preview is a `<canvas>` with an `aria-label` and **no text layer**, so
  the document is an image to a screen reader and to Ctrl-F. The prominent
  "Download the PDF" alternative mitigates this but does not remove it.
- The zoom control does not magnify (§7.2).

**Consequence.** High for the magnification case specifically.

### J8 — Internal editor trying to understand how ArcGIS metadata appears

**Better than expected.** "Product classifications are maintained in the DIEM
Hub content group" appears on country pages; "View source group ↗" links out
from both discovery surfaces; the product page prints the ArcGIS item id and its
content categories verbatim; "Type not recorded" and "No description in the
catalogue record" describe the record honestly rather than the product.

**Friction.** An editor cannot see that **145 items are excluded by catalog
role**, that **6 discoverable products carry no country** and are therefore
invisible on `/countries`, or that **17 carry no product type** — all four
numbers are computed on every load and displayed nowhere.

**Consequence.** Medium, and entirely an editorial-tooling gap.

### J9 — Returning user comparing related products, countries or rounds

**Works.** The round timeline turns a country's list into a picture of coverage;
the coverage matrix does the same across all 54 countries and links each cell to
a pre-filtered catalogue URL; language editions are cross-linked from both the
card and the product page.

**Friction.** No way to compare two countries side by side, and no "copy link to
this view" even though `/catalog` URLs are already correct and shareable. On
country pages the comparison state (page, region) is not in the URL at all.

**Consequence.** Low.

---

## 6. Prioritized recommendations

Sorted by priority, then by expected overall impact. "Quick win" = under a day
and independent of everything else.

| # | Pri | Finding | Evidence | Users / journey | Recommended change | User impact | Inst. impact | Effort | Conf. | Dependencies |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **P0** | 2023 humanitarian figures and "the recent coup d'état" published as current, undated, in two undivided languages, on 55 country pages | `/countries/ner`, `.country-editorial` measured at 1,350 px; `langAttrs: []`; text quoted in §7.1 | J2, J7 — analysts, screen readers | Render one language with a switch; stamp "Country context, last reviewed \<date\>" from the editorial record; suppress or visibly flag a profile older than a stated threshold; add `lang` to `ALLOWED_ATTR` | Very high | Very high | 1–2 days | High | Needs a review-date column on the editorial table (`docs/country_editorial.md`) |
| 2 | **P1** | PDF zoom control produces no magnification; preview is 273 px wide at 375 px | Measured: 125 % → canvas 1200 px / CSS 1006 px; 200 % → canvas 1920 px / CSS 1006 px | J3, J7 — low vision, mobile | Drive display width from `scale` and let the wrapper scroll; or remove the control and keep only Download | High | Medium | Hours | High | None — quick win |
| 3 | **P1** | Homepage strip, `/hazard-impact-assessments`, monitoring library and `/flood-services` bypass the product page and send readers to ArcGIS | `grep itemDestination`: 4 call sites vs 8 for `itemProductPath` | J1, J2, J5 — all discovery | Route all four through `itemProductPath`; keep `itemDestination` only inside `itemResourceAction` | High | High | 1 day | High | Product page (done) |
| 4 | **P1** | Thumbnails requested at `?w=800` from a 500 × 500 source, shown at 285 × 138 | Measured: no param 6,943 B; `?w=400` 26,524 B; `?w=800` 66,582 B; source 500 × 500 | J3 — slow connections | Request at the source's own size (drop `w`, or `?w=400` for 2× DPR); drop `loading="lazy"` from the first row | High | Medium | Hours | High | None — quick win |
| 5 | **P1** | Catalogue filter `<select>` controls are 291 × 19 px — WCAG 2.2 AA 2.5.8 failure | Measured at 375 px on `/catalog` | J3, J7 | Give every select a ≥ 44 px touch target on small screens; collapse the bar behind a "Filters" disclosure with active-filter chips | High | Medium | 1 day | High | None |
| 6 | **P1** | V3/V2/V1 status labels at 2.42:1 — WCAG 1.4.3 failure; and orange marks "Archived" as loudly as "Current standard" | `data-access.css:198`, `--orange` #f58320 on #f4f9f8 at 11 px | J3 (data seekers), J7 | Deep blue for "Current standard", neutral grey for "Archived"; raise to `--text-small` | Medium | High | Hours | High | None — quick win |
| 7 | **P1** | 1,859 kB of JSON across 9 requests before the first card | Measured live, 2026-09-07 | J3 | Render page 1 as soon as it resolves and page the rest in behind it; request only the fields the app reads if the endpoint permits | Very high | Medium | 2–3 days | Medium | Must not create a competing catalogue (AGENTS.md) |
| 8 | **P1** | Three `@import`s at the head of the render-blocking CSS pull Google Fonts and Bootstrap Icons from third-party CDNs | `dist/assets/index-*.css` first 300 bytes; `bootstrap-icons` in `package.json` but imported nowhere in `src/` | J3; FAO data protection | Self-host Open Sans, Merriweather and the ~20 Bootstrap Icons actually used; delete the CDN imports in the same build plugin that already strips three fonts | High | High | 1–2 days | High | Extends `dropUnusedThemeFonts` in `vite.config.ts` |
| 9 | **P1** | One test file; zero coverage of catalogue logic | `npx vitest run` → 19 tests, all `microdataGrants` | All journeys (regression risk) | Unit-test `lib/catalog.ts`, `lib/productFamilies.ts`, `lib/citation.ts`, `lib/catalogSearch.ts` and the category extractors in `services/countries.ts` against fixture items | Medium | High | 2–3 days | High | None |
| 10 | **P2** | `/countries` has no `<h1>`; no country search; 17,627 px of directory at 375 px | Measured | J2, J7 | Add an `<h1>`; add a country filter input; put region in the URL | Medium | Medium | 1 day | High | None |
| 11 | **P2** | Country-page pagination is React state, not URL; filter changes use `replace` so no history | `Next` → URL unchanged, `history.length` delta 0 | J2, J9 | Move `page` into `useSearchParams`; match `/catalog`'s replace policy (`q` only) | Medium | Medium | Hours | High | None — quick win |
| 12 | **P2** | Country results line prints the stored value "Seasonal calendar" instead of "Agricultural calendar" | `/countries/ner?pathway=Seasonal+calendar` → "0 products found · Seasonal calendar" | J2 | Apply `pathwayLabel()` at `CountryDetail.tsx:404` | Low | Medium | Minutes | High | None — quick win |
| 13 | **P2** | Country results line has no `aria-live`; `/catalog`'s does | `CountryDetail.tsx:404` vs `Catalog.tsx` results meta | J7 | Add `aria-live="polite"` | Medium | Medium | Minutes | High | None — quick win |
| 14 | **P2** | Unknown URL filter values apply silently while the control shows the opposite | `/catalog?product=Country+Brief` → "0 products found · Country Brief" with Product select on "All products" | J5 | Validate params against available values; ignore unknown ones and show a dismissible notice | Medium | Medium | Hours | High | None |
| 15 | **P2** | Two tab stops per card to the same URL, on three surfaces | `CatalogContentCard.tsx:68`/`:87` and two others | J6 | `tabIndex={-1}` + `aria-hidden` on the image link | Medium | Low | Hours | High | None — quick win |
| 16 | **P2** | Design tokens double-declared; `--deep-blue` and `--fao-navy` are the same colour at runtime despite a comment saying otherwise | Runtime: both `#1c4767`; `--ink` `#545454` not `#18333f` | Maintainers | One `:root` block; delete the duplicates; fix or remove the stale comment at `styles.css:24` | Low | Medium | Hours | High | None — quick win |
| 17 | **P2** | No `sitemap.xml`, no `robots.txt`; CSR-only; soft-404s | Repository search; `index.html` is an empty root div | Public discovery | Generate a sitemap at build time from the group; add `robots.txt`; add `<meta name="robots" content="noindex">` on the unavailable-product state | Medium | High | 1–2 days | High | Sitemap generation touches the deployment workflow |
| 18 | **P2** | 11 of 15 routes serve the generic homepage description | Measured on `/hazard-impact-assessments` | Public discovery | Give each route a description; add JSON-LD where a type genuinely applies | Low | Medium | Hours | High | None |
| 19 | **P2** | Country product tile click filters without moving the viewport | `scrollY` delta 0 after tile click | J2 | Reuse the existing `resultsRef` scroll on filter change, not only on page change | Medium | Low | Hours | High | None — quick win |
| 20 | **P2** | 9.2 MB of unoptimised hero JPEGs in `dist` | Build output | J3 | Re-encode to WebP/AVIF at delivery width; keep JPEG fallback | Medium | Low | Hours | High | None — quick win |
| 21 | **P3** | Malformed item id renders "no longer published" | `/catalog/not-an-id` | J5 | Distinguish "not a DIEM item id" from "withdrawn" | Low | Low | Hours | High | None |
| 22 | **P3** | Unknown `/data/:id` renders the sign-in gate, not a 404 | `/data/garbageid` | J5 | 404 for an id absent from the manifest | Low | Low | Hours | High | None |
| 23 | **P3** | PDF canvas has no text layer | `PdfPreview.tsx` | J7 | Render pdf.js text layer, or state that the preview is an image and the PDF is the accessible copy | Medium | Low | 1 day | High | None |
| 24 | **P3** | Language chips are 55 × 23 px — 1 px under the 24 px minimum | Measured at 375 px | J3, J7 | Raise to 24 px | Low | Low | Minutes | High | None — quick win |
| 25 | **P3** | `navigator.clipboard.writeText` uncaught | `CatalogProduct.tsx:` `copyCitation` | J4 | `try/catch` with a visible fallback (select the text) | Low | Low | Minutes | High | None — quick win |
| 26 | **P3** | Combobox missing `aria-autocomplete="list"` | Measured on `/` | J7 | Add the attribute | Low | Low | Minutes | High | None — quick win |
| 27 | **P3** | Product breadcrumb's last crumb reads "Product" | `/catalog/:id` | J4 | Use the product title, truncated | Low | Low | Minutes | High | None — quick win |
| 28 | **P3** | In-session catalogue promise never refreshes; background revalidation only updates the cache | `services/countries.ts:388-410` | J9 | Swap the resolved catalogue when the background refresh returns, or surface "newer data available" | Low | Low | Hours | High | None |
| 29 | **P3** | `diagnostics` computed, cached and never rendered; `useCountryCatalog` ignores `AbortSignal`; `bootstrap-icons` dependency unused in `src` | Code inspection | Maintainers | Ship the panel or delete the computation; thread an `AbortSignal`; drop or actually use the package | Low | Low | Hours | High | Overlaps #8 |
| 30 | **P3** | Country pathway tiles sum to 32 against a stated 33 | `/countries/ner` | J2 | Add the "No pathway assigned" tile, as `/catalog` has | Low | Low | Hours | High | None |

---

## 7. Detailed findings

### 7.1 — P0. Stale country context, undated, in two undivided languages

**Observed.** `/countries/ner` at 1440 px. Immediately below the country hero,
`.country-editorial` occupies **1,350 px of a 5,908 px page** — the largest
section on the route. It renders, in this order and with no heading, divider,
tab, control or visual separation between them:

> The Niger faces a worsening humanitarian crisis due to the recent coup d'état
> … In Niger, DIEM has been conducting surveys since September 2020. Further
> information: 3.2 million people projected to be in high acute food insecurity
> · To assist 1.13 million people FAO requires USD 25.6 million for 2023 ·
> Agricultural calendar
>
> Le Niger est confronté à une crise humanitaire qui s'aggrave en raison du
> récent coup d'État … Plus d'informations: 3,2 millions de personnes en
> situation d'insécurité alimentaire aiguë · Pour soutenir 1,13 million de
> personnes, la FAO a besoin de 25,6 millions d'USD en 2023 · Calendrier
> agricole

`document.querySelectorAll('[lang]')` inside that block returns an empty list,
and `document.documentElement.lang` is `"en"`.

**Why it matters.** Three separate failures compound:

- *Factual.* The Niger coup was July 2023. The IPC figure links to a March 2023
  bulletin. The funding requirement is explicitly "for 2023". Today is
  2026-09-07. Nothing on the page carries a date. An FAO evidence hub is exactly
  the source an analyst will treat as current, and these figures sit directly
  above live 2026 catalogue records that *are* current, which lends them
  borrowed credibility.
- *Editorial.* Publishing the same content twice, back to back, with a duplicated
  link list, is the most visible craft failure remaining on the site and it is on
  all 55 country pages.
- *Accessibility.* With no `lang="fr"`, a screen reader pronounces ~250 words of
  French with an English voice engine — WCAG 3.1.2 Language of Parts (AA).
  Worse, `CountryEditorial.tsx:41` sets `ALLOWED_ATTR: ['href', 'title']`, so
  DOMPurify strips a `lang` attribute even if an editor supplies one. The fix
  therefore has to happen in code, not in content.

**Recommended solution.**
1. Add `lang` (and `dir`) to `ALLOWED_ATTR` in `CountryEditorial.tsx`.
2. Store the two languages as separate fields on the editorial record and render
   one at a time behind a small language control, defaulting to the site
   language.
3. Add a review-date column and print "Country context, last reviewed
   \<date\>" beneath the block.
4. Below a configured staleness threshold, either suppress the block entirely or
   render it under an explicit "Last reviewed \<date\>; figures may be out of
   date" notice. Suppression is safer for launch.

**Alternatives considered.** *Leave it and fix the content.* Rejected: 55
countries of content editing is slower than the code change, and without a date
field the same drift recurs. *Show both languages but divide them with
headings.* Rejected as insufficient — the dating problem is the serious half.

**Risks and trade-offs.** Suppressing stale profiles empties a large band on
country pages until editors refresh them, which will look like a regression to
anyone who does not know why. Mitigate by shipping the date first, in the same
release, so the emptiness is explained.

**Acceptance criteria.**
- No country page renders two languages of the same profile simultaneously.
- Every rendered profile shows a review date sourced from the editorial record.
- A profile whose review date exceeds the threshold is either hidden or carries
  a visible staleness notice.
- Non-English profile text is wrapped in an element with the correct `lang`, and
  that attribute survives sanitisation.
- No page asserts a year-specific figure without a visible date.

**Files and routes.** `src/components/CountryEditorial.tsx`,
`src/services/countryEditorial.ts`, `docs/country_editorial.md`,
`scripts/provision_country_editorial.py`. Route `/countries/:iso3`, all 55.

---

### 7.2 — P1. The PDF zoom control does not zoom

**Observed.** `/catalog/34e84a9b46c849c9afa6f8738be4ca91`, 1440 px, preview
opened. Measured directly:

| Zoom label | `canvas.width` (backing store) | `getComputedStyle(canvas).width` |
|---|---|---|
| 125 % (default) | 1200 | **1006 px** |
| 200 % (after three presses of Zoom in) | 1920 | **1006 px** |

`max-width: 100%` on the canvas clamps every scale to the container. At 375 px
the same page renders at **273 px CSS wide** — an A4 page whose body text is
roughly 4 px tall — and the zoom control is equally inert there.

**Why it matters.** This is the one control on the site whose entire purpose is
to serve readers who cannot read the default size, and it does nothing. It is a
functional failure that presents as an accessibility failure: the affordance
implies magnification is available, so a low-vision reader who needs it will try
it, get nothing, and reasonably conclude the document is unreadable rather than
that the button is broken. It also quadruples render cost at 200 % for no
benefit — on a low-powered mobile device, that is a visible stall for nothing.

**Evidence.** Measurements above; `src/components/PdfPreview.tsx` (`scale` state
feeds `page.getViewport({ scale })` and the canvas backing store only);
`src/catalog-product.css` (`.catalog-pdf-canvas-wrap` is `overflow-x: auto`, so
the container is already prepared to scroll a wider child).

**Recommended solution.** Set the canvas's CSS width from the viewport width in
device-independent pixels rather than leaving it to `max-width: 100%`: keep the
backing store at `scale × devicePixelRatio` for sharpness and set
`style.width = viewport.width / devicePixelRatio` so the rendered page actually
grows. The wrapper already scrolls. On small screens, start at a
fit-to-width scale rather than a fixed 1.25.

**Alternatives considered.** *Remove the zoom control and keep only Download.*
Cheaper and honest, and acceptable if the fix is deferred — but it abandons the
one reader the control exists for. *Use the browser's native PDF viewer in an
`<iframe>`.* Rejected: the 2026-09-04 addendum recorded that ArcGIS framing of
`/data` is unverified, and a native viewer cannot be styled or guaranteed
present.

**Risks and trade-offs.** A page rendered at 200 % on mobile is a large canvas;
cap the maximum backing-store dimension so a 17 MB tail-case PDF at 200 % does
not exhaust memory on a low-end device.

**Acceptance criteria.**
- At 200 %, the rendered page is measurably twice the CSS width it has at 100 %.
- At 375 px the viewer opens fit-to-width and the reader can zoom to at least
  200 % with horizontal scrolling inside the wrapper only.
- Page scroll width never exceeds the viewport at any zoom level.
- Canvas backing store is capped and the cap is documented.

**Files and routes.** `src/components/PdfPreview.tsx`,
`src/catalog-product.css`. Route `/catalog/:itemId` for `type === 'PDF'`.

---

### 7.3 — P1. Four surfaces still leave the Hub on the first click

**Observed.** `itemProductPath` (→ `/catalog/:id`) is used by
`CatalogContentCard`, `CatalogSearchBox`, `CountryEditorial`,
`CountryRoundTimeline` and `CountryDetail`. `itemDestination` (→ the external
URL, or the ArcGIS item page as a fallback) is still used directly by:

| File | Surface | Scale |
|---|---|---|
| `src/components/LatestEvidenceBanner.tsx:28` | Homepage "Latest evidence" strip | The most prominent product links on `/` |
| `src/pages/HazardImpactAssessments.tsx:45, :76` | Every dossier card image *and* its link | 124 assessments, the whole route |
| `src/components/MonitoringProducts.tsx:35` | Monitoring product library | `/monitoring-system` |
| `src/pages/FloodServices.tsx:407` | Flood assessment list | 37 items |

**Why it matters.** The 2026-09-04 addendum established that roughly half the
group are uploaded files with no `url`, for which `itemDestination` returns the
ArcGIS item page — a detour, not a destination. It also established that a
withdrawn item on that path lands the reader on a bare ArcGIS 403. The product
page was built precisely to fix both, and then four surfaces were left on the
old path. The consequences are concrete: on `/hazard-impact-assessments` — a
whole route, 124 items — nothing is citable, no licence is shown, no PDF can be
previewed, no language editions are offered, and a withdrawn assessment produces
an ArcGIS error page instead of the Hub's well-written explanation. The homepage
strip has the same problem in the most visible position on the site.

**Evidence.** `grep -rn "itemProductPath\|itemDestination" src/`, reproduced
above.

**Recommended solution.** Change all four to `itemProductPath`. Keep
`itemDestination` for the one place it is genuinely right — inside
`itemResourceAction`, which the product page uses to build its "Open resource" /
"Download PDF" action.

**Alternatives considered.** *Label the links "opens in ArcGIS".* Honest, but
the addendum already rejected it: the detour remains and the citation, licence
and graceful-failure benefits are still lost. *Leave hazard impacts alone
because its cards are "dossiers".* Rejected — a dossier is a product; its
readers need citations more than most.

**Risks and trade-offs.** One extra click for the ~40 % of items whose `url` is
already the real destination (openknowledge.fao.org, doi.org, storymaps). That is
the intended trade: the product page is where the citation and licence live. If
the extra hop proves costly, the mitigation is to make the product page's
primary action unmissable, not to bypass the page.

**Acceptance criteria.**
- No component outside `itemResourceAction` calls `itemDestination`.
- A withdrawn item reached from the homepage strip or a hazard-impact card
  renders the Hub's "no longer published" state.
- Each of the four surfaces exposes one tab stop per product, not two.

**Files and routes.** The four files above. Routes `/`,
`/hazard-impact-assessments`, `/monitoring-system`, `/flood-services`.

---

### 7.4 — P1. Thumbnails upscaled to `?w=800` from a 500 px source

**Observed.** `itemThumbnail` (`src/services/arcgis.ts:87`) appends `?w=800`.
Measured against the live endpoint for
`items/34e84a9b46c849c9afa6f8738be4ca91/info/thumbnail/thumb_NPL.jpg`:

| Request | Bytes |
|---|---|
| no parameter | 6,943 |
| `?w=200` | 6,943 (source is smaller; served as-is) |
| `?w=400` | 26,524 |
| `?w=800` | **66,582** |

The source image is **500 × 500**. The card displays it at **285 × 138** CSS
pixels. So `?w=800` asks ArcGIS to upscale a 500 px image to 800 px, costing
**9.6× the bytes of the original for zero additional detail**, to fill a 285 px
box.

At 16 cards per catalogue page — page 1 renders 16 `<img>` elements across 11
distinct thumbnail files — that is roughly **0.95 MB per page**, none of which
buys anything a reader can see. Every card also carries `loading="lazy"`,
including the four above the fold, so the images that could contribute to LCP
are the ones deferred.

**Why it matters.** This is the largest avoidable cost on the journey the
programme cares most about (J3). It is also pure waste: unlike the JSON payload,
which at least carries information, these bytes carry none.

**Evidence.** `curl` measurements above (live ArcGIS, 2026-09-07);
`CatalogContentCard.tsx:37` and `:69`; `document.querySelectorAll('.card-grid img')`
returning 16 elements with `loading="lazy"` and `width="800"`.

Note also that the declared intrinsic ratio is wrong: `width={800} height={500}`
is 1.6, while the rendered box is 285 × 138 ≈ 2.07. CSS fixes the height so
there is no layout shift, but the attributes are misinformation.

**Recommended solution.** Drop the `w` parameter, or set it from the largest
size the card actually renders at 2× DPR (`?w=600`). Remove `loading="lazy"`
from the first row of the grid. Correct or remove the `width`/`height`
attributes.

**Alternatives considered.** *Reinstate the previous review's item-7 behaviour
and show no image where it is not distinct.* That was tried and reversed by the
editor; this review does not reopen it. Fixing the width achieves most of the
byte saving without reopening the design argument.

**Risks and trade-offs.** On a 3× DPR phone a 500 px source at 285 px display is
already below native sharpness; `?w=800` does not fix that, since the pixels do
not exist. If sharper thumbnails are wanted, the source images have to change in
ArcGIS.

**Acceptance criteria.** A catalogue page transfers under 200 kB of thumbnails.
No above-the-fold card image is `loading="lazy"`. No declared intrinsic ratio
differs from the rendered box by more than 10 %.

**Files and routes.** `src/services/arcgis.ts:87`,
`src/components/CatalogContentCard.tsx`. Routes `/catalog`,
`/countries/:iso3`, `/`.

---

### 7.5 — P1. Filter controls are 19 px tall (WCAG 2.2 AA 2.5.8)

**Observed.** `/catalog` at 375 × 812. Every one of the six
`.catalog-filter-bar select` elements measures **291 × 19 px**. WCAG 2.2 AA
SC 2.5.8 Target Size (Minimum) requires 24 × 24 CSS px unless an exception
applies; none does here. The wrapping `<label>` is 64 px tall but clicking its
text does not open the native dropdown on all platforms, so the effective
pointer target is the 19 px control.

Two related measurements from the same page:

- The filter bar occupies **522 px** of an 812 px viewport.
- The first product card begins at document **y = 1397** — the reader scrolls
  about 1.7 screens past controls before reaching content.
- Language chips on cards measure **55 × 23 px**, one pixel under the same
  minimum.

**Why it matters.** These six controls are the entire filtering interface of the
Hub's largest surface, and on the device most of the target audience uses they
are almost impossible to hit accurately. Combined with the 522 px of vertical
cost, the mobile catalogue is a form the reader must scroll through rather than
a set of results they can refine.

**Evidence.** `getBoundingClientRect()` on each control and on
`.catalog-filter-bar`, and on `.content-card:first-child`, at 375 × 812.

**Recommended solution.** Give selects a minimum height of 44 px on small
screens (48 px is the comfortable FAO-scale value). Then collapse the whole bar
behind a "Filters" disclosure below 768 px, with the currently active filters
shown as removable chips, so the default mobile view is search + results.

**Alternatives considered.** *Only raise the height.* Fixes the conformance
failure but leaves the 522 px cost, and taller controls make it worse. *Make the
`<label>` the target.* Does not reliably open a native select.

**Risks and trade-offs.** A collapsed filter bar hides discoverable facets. The
active-filter chips are what prevent that; do not ship the disclosure without
them.

**Acceptance criteria.** No interactive control on any route measures under
24 × 24 CSS px at 320, 375 or 768 px. At 375 px, the first result card is
visible within one viewport height of the page heading.

**Files and routes.** `src/catalog.css`, `src/pages/Catalog.tsx`. Routes
`/catalog`, `/countries/:iso3`, `/hazard-impact-assessments`.

---

### 7.6 — P1. Contrast failure on the data-generation status labels

**Observed.** `/data` at 1440 px. Automated contrast sweep over every
text-bearing element returned two failures on the whole page:

| Text | Selector | Colour on background | Size | Ratio | Required |
|---|---|---|---|---|---|
| "Current standard", "Archived" ×2 | `.generation-strip-topline span` | `#f58320` on `#f4f9f8` | 11 px, 700 | **2.42:1** | 4.5:1 |
| "11 sections · public" | (guide card) | `#cfe4f1` on `#116aab` | 12 px | **4.36:1** | 4.5:1 |

`/` and `/catalog` returned **zero** failures at any size, which is a real
achievement of the September palette work and is why these two stand out.

**Why it matters.** The V3 / V2 / V1 strip is where a data seeker decides which
questionnaire generation to use. "Current standard" versus "Archived" is the
most consequential distinction on the page, it is set in the smallest type on
the page, and it fails contrast by a factor of nearly two. There is also a
semantic problem underneath the colour one: the same orange marks the current
generation and the archived ones, so the colour carries no information at all —
and AGENTS.md reserves orange for "urgency/action", which "Archived" is the
opposite of.

**Evidence.** Computed-style sweep above; `src/data-access.css:198`
(`color: var(--orange); font-size: var(--text-micro)`), with `--orange`
resolving to `#f58320` from `fao-adaptation.css:15` and `--text-micro` to 11 px.

**Recommended solution.** `--deep-blue` for "Current standard", a neutral
`--ink-faint` grey for "Archived", and raise the size from `--text-micro` to
`--text-small`. Nudge the guide-card caption to a lighter tint or a larger size
to clear 4.5:1.

**Alternatives considered.** *Darken `--orange` globally.* Rejected: orange is
used correctly elsewhere (hero CTA, active nav rule) where it sits on dark
grounds or as a non-text indicator, and darkening it site-wide to fix one 11 px
label would flatten a working accent.

**Risks and trade-offs.** None material.

**Acceptance criteria.** Every text node on `/data` reaches 4.5:1 (3:1 for large
text). "Current standard" and "Archived" are visually distinguishable by
something other than a shared colour.

**Files and routes.** `src/data-access.css:198`. Route `/data`.

---

### 7.7 — P1. 1.86 MB of JSON before the first card

**Observed.** Live measurement from the running application, 2026-09-07:

| Metric | Value |
|---|---|
| Group total | 900 items |
| Paged requests to fetch it | **9** |
| Raw JSON transferred | **1,859 kB** |
| Elapsed on a fast office connection | 870 ms (first page 288 ms) |
| Records needed to paint the first screen | 16 |

`requestCatalog` (`services/countries.ts:411`) awaits page 1, fires the other
eight in parallel, then normalises all 900 before resolving. Nothing renders
until every page is in. The session cache (662 kB projected, 15-minute TTL)
makes the *second* load fast, and the skeleton grid is honest about the wait,
but the first load of the day on a slow link is a wall: at 400 kbps effective,
1.86 MB is roughly **37 seconds**.

**Why it matters.** J3 is the journey the programme exists for. It is also the
journey most likely to be abandoned.

**Evidence.** `fetch` timings and byte counts executed in the page against the
live endpoint; `performance.getEntriesByType('resource')` showing 9
`content/groups/.../search` entries on a cold catalogue load.

**Recommended solution.** Resolve and render page 1 immediately, then merge the
remaining eight pages as they arrive, updating counts and facets live with the
"Read at HH:MM UTC" line already present to explain the movement. This keeps
ArcGIS authoritative (nothing is snapshotted) and satisfies the AGENTS.md rule,
while cutting time-to-first-card by roughly 90 %. Separately, if the group
search endpoint honours a field projection, request only the fields
`projectForCache` already declares — `licenseInfo` alone was measured at 498 kB
across the group by the previous review and is read only for protected items.

**Alternatives considered.** *Build-time snapshot.* Explicitly forbidden by
AGENTS.md and by the previous review's "Do not do" item 1. *Raise the page size
above 100.* ArcGIS caps it. *Lengthen the cache TTL.* Helps returning visitors
only, and increases the window in which a withdrawn item is still shown.

**Risks and trade-offs.** Progressive counts move under the reader while pages
land. Mitigate by holding the facet controls disabled until the last page
resolves, or by labelling the count "715 so far" until complete — the second is
more honest and cheaper.

**Acceptance criteria.** First real card painted after one network round trip.
Facet counts are either final or explicitly marked provisional. Total catalogue
count matches the group total once loading completes. No regression in the
cached-load path (currently ~21 ms).

**Files and routes.** `src/services/countries.ts`,
`src/hooks/useCountryCatalog.ts`, `src/pages/Catalog.tsx`. Routes `/catalog`,
`/countries`, `/countries/:iso3`, `/`.

---

### 7.8 — P1. Third-party CDN dependencies at the head of the render-blocking CSS

**Observed.** The built `dist/assets/index-e1Wn0MAE.css` — linked from
`index.html` and therefore render-blocking on all 15 routes — begins:

```css
@import"https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap";
@import"https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700;800&display=swap";
@import"https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css";
```

The `dropUnusedThemeFonts` plugin in `vite.config.ts` correctly strips
Montserrat, Cairo and Noto Sans JP, but leaves the mechanism and the remaining
three imports intact. The same stylesheet also carries **369 references to
`https://www.fao.org`** — chiefly `images/corporatelibraries/flags/<iso3>.svg`
for **251 country flags**, of which the Hub uses 54, plus SDG icons.

`bootstrap-icons` is listed in `package.json` dependencies but is **imported
nowhere in `src/`**. Every `bi bi-*` icon on the site — the pathway icons on
every card, the download and external-link glyphs on the product page, the PDF
toolbar chevrons — resolves through the jsDelivr copy pulled in by the theme.

**Why it matters.** Three distinct problems:

- *Performance.* A CSS `@import` inside a render-blocking stylesheet is a serial
  round trip. Before first paint the browser must resolve
  `fonts.googleapis.com`, then `fonts.gstatic.com` for the font files, then
  `cdn.jsdelivr.net`, then jsDelivr again for the icon `woff2` — four or five
  extra DNS + TLS handshakes on a high-latency mobile link, each one blocking.
- *Reliability.* If jsDelivr is unreachable — blocked, throttled, or simply slow
  in a fragile-context network — every icon on the Hub disappears with no
  fallback. Same for Google Fonts and the body typeface.
- *Institutional and data protection.* An FAO site that links to
  "Data protection and privacy" in its own footer sends every visitor's IP
  address to Google and to a commercial CDN on every page load, with no notice
  and no way to decline. Whatever the legal position, this is a question that
  should be answered deliberately rather than inherited from a vendored theme.

**Evidence.** `head -c 300 dist/assets/index-e1Wn0MAE.css`;
`grep -oE "https?://[a-z0-9.-]+" dist/assets/index-*.css | sort | uniq -c` →
369 `www.fao.org`, 2 `fonts.googleapis.com`, 1 `cdn.jsdelivr.net`;
`grep -rn "bootstrap-icons" src/` → no matches.

**Recommended solution.** Extend the existing build plugin — it already
demonstrates the pattern and the reasoning is already documented in
`vite.config.ts` — to strip all three remaining `@import`s. Self-host Open Sans
and Merriweather as `woff2` in `src/assets/fao/`. Subset Bootstrap Icons to the
~20 glyphs the Hub actually uses and inline them, or replace them with the
inline SVGs the codebase already uses elsewhere (`CatalogSearchBox.tsx:20`
shows the house style). Trim the flag rules to the 54 ISO codes in use, or
self-host those SVGs.

**Alternatives considered.** *`<link rel="preconnect">` to the three origins.*
Reduces the handshake cost but keeps the availability and privacy dependencies.
*Leave it, since the theme is a vendor snapshot.* The plugin already establishes
that trimming the snapshot at build time is the accepted approach here.

**Risks and trade-offs.** Self-hosting fonts diverges from the FAO Design System
delivery model; confirm with whoever owns the theme. Subsetting icons risks a
missing glyph if a component adds one later — add a build check that every
`bi-*` class used in `src/` is in the subset.

**Acceptance criteria.** The built render-blocking stylesheet contains zero
`@import` statements and references no origin other than the deployment origin.
Every icon and both typefaces render with the network restricted to the
deployment origin. Flag rules in the bundle cover only ISO codes present in the
content group.

**Files and routes.** `vite.config.ts`, `src/assets/fao/fao-theme.min.css`
(via the plugin, not edited), `package.json`. All routes.

---

### 7.9 — P1. One test file

**Observed.** `npx vitest run` → 1 file, 19 tests, all in
`src/services/microdataGrants.test.ts`, all passing.

Untested, and all pure functions with no I/O:

| Module | Functions | What breaks silently if they regress |
|---|---|---|
| `lib/catalog.ts` | `distinctSummary`, `itemYear`, `itemEdition`, `itemRound`, `itemTheme`, `itemCountry`, `isHazardImpactAssessment` | Every card's summary, date, round badge and the 122-item headline figure |
| `lib/productFamilies.ts` | `groupProductFamilies`, `itemLanguage` | The 715 figure, every language chip, and the two mis-tagged French records the previous review found |
| `lib/citation.ts` | `citationFor`, `citationRound`, `defaultCitationLanguage` | Every citation the Hub emits |
| `lib/catalogSearch.ts` | `buildCatalogSearchIndex`, `matchingFamilyIds` | Search and the type-ahead |
| `services/countries.ts` | `extractCountries`, `extractProductTypes`, `extractEvidencePathways`, `isDiscoverableProduct`, `isMultiCountry` | Which items are public at all, and every facet |

**Why it matters.** `services/countries.ts` decides what the public sees; a
regression in `isDiscoverableProduct` would either hide the catalogue or expose
items the editors excluded, and nothing would catch it before a human noticed.
`itemLanguage` has already been wrong in production once, in a way the previous
review found by hand against the live group. These are the cheapest tests in the
codebase — no mocking, no DOM, fixture arrays of ArcGIS-shaped objects.

**Evidence.** `find src -name '*.test.*'` → one file. `npx vitest run` output.

**Recommended solution.** Add one test file per module above, with fixtures
drawn from real group records (including the awkward ones: the Honduras record
mis-tagged French, a title with a three-digit "round", a title with a comparison
year, an item with no `groupCategories`, a family with one variant). Add a
smoke test asserting that `groupProductFamilies` over a fixture set produces the
expected family count, so the headline figure has a regression guard.

**Alternatives considered.** *Component or end-to-end tests first.* Higher value
per test in principle, far higher cost and maintenance, and they would not have
caught the language-tag bug any earlier than the pure-function test would.

**Risks and trade-offs.** Fixtures drift from live ArcGIS shapes. Keep them
small and typed against `ArcGISItem` so `tsc -b` catches contract changes.

**Acceptance criteria.** Every exported function in the five modules above has
at least one test covering its documented edge case. `npm test` fails if
`isDiscoverableProduct` stops requiring the exact
`/Categories/Catalog role/Discoverable product` path.

**Files.** New tests beside each module. `docs/development_workflow.md` should be
updated — it still states "No automated test framework is configured yet",
which has not been true since `vitest` was added.

---

### 7.10 — P2. `/countries` structure, search and length

**Observed.**
- The page has **no `<h1>`**. Its heading outline begins "H2 Where DIEM works",
  "H2 Cross-country analysis", "H2 Country publication matrix", "H2 Browse the
  collection", then 54 `<h3>` country names.
- There is **no search input anywhere in `<main>`** — the only filter is six
  region buttons.
- The region filter is React state, so it is absent from the URL: a filtered
  view cannot be shared and Back does not restore it.
- At 375 px the page is **20,850 px** tall, of which `.country-directory` is
  **17,627 px** — about 21 screen-heights of country cards with no pagination,
  no A–Z index and no jump.
- The coverage matrix is correctly contained: `.coverage-matrix-scroll` is
  `overflow-x: auto`, the table is 897 px inside a 341 px container, and
  `document.body.scrollWidth` stays at 375. **No page overflow.**

**Why it matters.** A page with no `<h1>` gives screen-reader and search-engine
users no title for the document (WCAG 2.4.6 / 1.3.1 practice). A directory of 54
items with no text filter, on a page whose other surfaces all have one, forces
either 21 screens of scrolling or a detour through the map — which needs precise
pointing and is not usable by touch at small sizes.

**Evidence.** `document.querySelectorAll('h1').length` → 0;
`document.querySelectorAll('main input').length` → 0;
section heights measured via `getBoundingClientRect`.

**Recommended solution.** Add an `<h1>` ("Countries" or "DIEM evidence by
country"). Add a country filter input above the directory, reusing the existing
`CatalogSearchBox` country-matching logic. Put `region` and the filter text in
`useSearchParams`. Consider collapsing the directory to a compact list below
768 px.

**Acceptance criteria.** `/countries` has exactly one `<h1>`. A country can be
reached by typing three letters. Region and text filter round-trip through the
URL. The page is under 8,000 px at 375 px.

**Files and routes.** `src/pages/CountryExplorer.tsx`, `src/countries.css`.
Route `/countries`.

---

### 7.11 — P2. Country-page state is invisible to the URL, and two label defects

Three separate defects on the same route, all cheap, grouped because they share
a file.

**a. Pagination is not in the URL.** Measured on `/countries/ner` (33 products,
3 pages): clicking Next changed the label to "Page 2 of 3" while
`location.href` stayed `http://127.0.0.1:4174/countries/ner` and
`history.length` did not change. Page 2 cannot be shared or bookmarked, and Back
leaves the country page entirely. `/catalog` does this correctly with a `page`
search param. Fix: move `page` into `useSearchParams` (`CountryDetail.tsx:132`).

**b. Filter changes leave no history.** `setFilter` uses
`setSearchParams(next, { replace: true })` for *every* key
(`CountryDetail.tsx:~295`), whereas `/catalog` uses `replace` only for `q` — the
documented reason being that typing should not spam history. On the country page
that reasoning has been over-applied to selects and tiles, so a reader who
filters three times and presses Back leaves the country instead of stepping back
one filter. Fix: match `/catalog`'s policy.

**c. The results line prints a value the UI never shows.** Selecting the
"Agricultural calendar" tile produces
`/countries/ner?type=Questionnaires&pathway=Seasonal+calendar` and a results line
reading **"0 products found · Seasonal calendar · Questionnaires"**. The tile
says "Agricultural calendar"; `pathwayLabel()` is applied to the tiles but not
at `CountryDetail.tsx:404`. Commit `82271da` ("read Seasonal calendar as
Agricultural calendar") missed this call site. Fix: wrap the value in
`pathwayLabel()`.

Two smaller things in the same area: the results line has **no `aria-live`**
where `/catalog`'s has one, so filtering announces nothing to a screen reader;
and clicking a product tile filters without moving the viewport
(`scrollY` delta measured at 0) even though the results are ~500 px below and
the component already owns a `resultsRef` scroll used for pagination.

The empty state itself is fine — "No matching evidence found · Try a broader
search or remove a product or year filter" with a working "Clear filters"
button — except that it does not mention the pathway filter, which is what was
actually applied.

**Acceptance criteria.** Page, region, and every filter round-trip through the
URL on `/countries/:iso3` exactly as they do on `/catalog`. No results line
prints a stored value that does not appear in the interface. Filtering
announces the new count. A tile click brings the results into view.

**Files and routes.** `src/pages/CountryDetail.tsx` (lines ~132, ~295, 404).
Route `/countries/:iso3`.

---

### 7.12 — P2. Unknown URL filter values apply silently and disagree with the controls

**Observed.** `/catalog?content=Documents&product=Country+Brief` — note the
singular, where the stored value is `Country Briefs` — renders:

- results meta: **"0 products found · Country Brief"**
- Product select: **"All products"**
- the empty state: "No matching evidence found · Try removing a filter"

The filter is applied but the control that owns it displays the opposite, so the
reader is told to remove a filter they can see is not set. The same happens for
any renamed or mistyped `pathway`, `product`, `country` or `year`.

**Why it matters.** AGENTS.md states plainly that titles, tags and categories
are mutable. Product types have already been renamed once in this codebase
(`Seasonal calendar` → displayed as `Agricultural calendar`). Every shared or
bookmarked link carrying a value that later changes will degrade into this exact
state: zero results, no explanation, and a control that denies the filter
exists.

**Evidence.** Reproduced above on the running application at 1440 px.

**Recommended solution.** Validate each search param against the values actually
present in the loaded catalogue. Drop unknown ones from the applied filter set,
and render one dismissible line: "The filter 'Country Brief' is no longer used
in the catalogue and has been ignored." Do not rewrite the URL silently — the
reader may want to see what they sent.

**Alternatives considered.** *Reflect the unknown value in the control by adding
a phantom option.* Makes the controls honest but leaves the reader with a dead
filter and no explanation. *Redirect to `/catalog`.* Discards intent the reader
may still be able to salvage.

**Acceptance criteria.** No combination of search params can produce a state
where the results line names a filter that no control shows. An unknown value
produces an explanatory notice and non-empty results.

**Files and routes.** `src/pages/Catalog.tsx` (param reads, ~lines 60-70).
Routes `/catalog`, `/countries/:iso3`.

---

### 7.13 — P2. The design-token layer is declared twice, and disagrees with itself

**Observed.** Seven custom properties are defined in **both** `src/styles.css`
and `src/fao-adaptation.css`. Because `fao-adaptation.css` is imported last in
`main.tsx`, it wins. Runtime values read from
`getComputedStyle(document.documentElement)`:

| Token | `styles.css` says | `fao-adaptation.css` says | Runtime |
|---|---|---|---|
| `--fao-blue` | `#116aab` | `#116aab` | `#116aab` |
| `--deep-blue` | `#05466c` | `#1c4767` | **`#1c4767`** |
| `--fao-navy` | `#1c4767` | — | `#1c4767` |
| `--ink` | `#18333f` | `#545454` | **`#545454`** |
| `--orange` | `#f47929` | `#f58320` | **`#f58320`** |
| `--line` | `#d7dfdd` | `#d9d9d9` | **`#d9d9d9`** |
| `--paper` | `#ffffff` | `#fff` | `#fff` |
| `--mist` | `#e5ecf4` | `#e5ecf4` | `#e5ecf4` |

**`--deep-blue` and `--fao-navy` are the same colour at runtime**, and
`styles.css:24` carries the comment *"The FAO theme's own deep blue, distinct
from --deep-blue above"* — which is now false. `--ink` is the washed `#545454`
the previous review objected to, rather than the `#18333f` the token file
claims. A developer reading `styles.css`, which is where the token block looks
like it lives, gets four wrong values out of eight.

Wider census, for comparison with 2026-09-03:

| Metric | 2026-09-03 | 2026-09-07 |
|---|---|---|
| Distinct hex literals in `src/*.css` | 464 | **180** |
| Total colour declarations | 952 | **658** |
| Custom properties | 7 | **24** |
| Distinct `box-shadow` values | 48 | **51** |
| Literal `font-size` values under 12 px | 165 declarations | **0** |
| Total CSS lines | — | 3,981 |

The consolidation is real and substantial. The duplicated `:root` is the one
thing that will unwind it, because the two blocks will drift independently.

**Why it matters.** Purely maintainability, but at the exact point where the
previous review identified the drift mechanism. Two competing definitions of the
same token is how 24 properties become 40 and 180 hex values become 300 again.

**Recommended solution.** Keep one `:root` block. Move the FAO-theme-derived
values (`--ink: #545454`, `--orange: #f58320`, `--line: #d9d9d9`,
`--deep-blue: #1c4767`) into `styles.css` as the single source, delete the block
in `fao-adaptation.css`, and either delete `--fao-navy` or give it a genuinely
different value. Fix the stale comment.

**Acceptance criteria.** `grep -rn "^\s*--[a-z-]*:" src/*.css` shows each token
defined exactly once. No two tokens resolve to the same value unless one is
documented as an alias. Rendered output is byte-identical before and after.

**Files.** `src/styles.css:17-47`, `src/fao-adaptation.css:8-22`.

---

### 7.14 — P2. Public discoverability of a client-rendered catalogue

**Observed.**
- `index.html` ships `<div id="root"></div>` and a module script. There is no
  server-rendered or pre-rendered content on any route.
- No `sitemap.xml` and no `robots.txt` exist anywhere in the repository, and
  there is no `public/` directory to hold them.
- Every route returns HTTP 200, including `/no-such-page`, a withdrawn product,
  and an unknown dataset id — all soft-404s.
- 11 of 15 routes serve the generic `index.html` description.

**What is already right, and should not be redone.** Per-route `<title>`,
`<link rel="canonical">`, `og:title`, `og:url`, `og:image` and `twitter:card`
are set correctly on every route including the 404 — verified on
`/hazard-impact-assessments` and `/data/guide`, both of which returned their own
canonical, not the homepage's. `/catalog` emits `DataCatalog` JSON-LD,
`/catalog/:id` emits `CreativeWork` with the ArcGIS item id as `identifier`, and
`/countries/:iso3` emits `CollectionPage` with a `Country`. `/catalog`'s
canonical correctly drops the query string. This is careful work.

**Why it matters.** The Hub's stated purpose is making evidence easier to
discover. 715 product pages that only exist after JavaScript executes, with no
sitemap to tell a crawler they exist, are discoverable only to crawlers that
both render and guess the URLs. Soft-404s compound it: withdrawn products stay
indexed and keep serving 200s to a crawler.

**Recommended solution.** In rough order of value per day:
1. Generate `sitemap.xml` at build time from the content group — one entry per
   `/catalog/:id`, per `/countries/:iso3`, plus the static routes. This is the
   single highest-value item and needs no rendering change.
2. Add `robots.txt` pointing at the sitemap.
3. Emit `<meta name="robots" content="noindex">` from `usePageMetadata` when a
   route resolves to an unavailable product or a 404, so soft-404s stop
   accumulating.
4. Give the remaining 11 routes their own descriptions.
5. Only then consider pre-rendering. Static pre-rendering of 715 product pages
   would snapshot mutable ArcGIS metadata into build output, which is close to
   the line AGENTS.md draws; if it is pursued, pre-render the *static* routes and
   the catalogue shell only, and leave product pages client-rendered.

**Risks and trade-offs.** A build-time sitemap is a snapshot of a group that
lost 12 % of its items in four days; stale sitemap entries produce soft-404s of
their own. Regenerate on each deploy and accept the drift, or generate it from a
scheduled job rather than from the build.

**Acceptance criteria.** `sitemap.xml` and `robots.txt` are served from the
deployment origin. Every product page and country page appears in the sitemap.
An unavailable product serves `noindex`. Every route has a distinct description.

**Files and routes.** `vite.config.ts` (a build plugin),
`src/hooks/usePageMetadata.ts`, each page component. The deployment repository's
hosting config must serve the two new files.

---

### 7.15 — P3. Smaller confirmed defects

Each verified, each cheap, listed without the full template.

- **Malformed item id reads as a withdrawal.** `/catalog/not-an-id` renders
  "This product is no longer published in the DIEM Hub catalogue", the same page
  a genuinely withdrawn item gets. `fetchCurrentCatalogProduct` already returns
  `undefined` early for anything that is not 32 hex characters
  (`services/countries.ts:272`); distinguish that case in the UI.
- **Unknown `/data/:id` renders the sign-in gate.** `/data/garbageid` shows
  "Sign in to explore this dataset", so a mistyped or dead link reads as a
  permissions problem. A known id correctly names itself ("Sign in to explore
  Incomes, Shocks and Needs"), which is the improvement to preserve; add a 404
  for ids absent from the manifest.
- **PDF preview has no text layer.** The `<canvas>` carries an `aria-label` and
  nothing else, so the document is an image to a screen reader and to Ctrl-F.
  The prominent "Download the PDF" link is a real mitigation; either render the
  pdf.js text layer or state in the preview heading that the PDF is the
  accessible copy.
- **Language chips are 55 × 23 px**, one pixel under the 24 px minimum.
- **`aria-autocomplete="list"` is missing** from the search combobox. Everything
  else in that pattern is right — `role="combobox"`, `aria-expanded`,
  `aria-controls`, `aria-activedescendant`, a `role="listbox"` with
  `role="option"` children, arrow-key handling and a `sr-only`
  `aria-live="polite"` status line.
- **`navigator.clipboard.writeText` has no `catch`** in `copyCitation`
  (`CatalogProduct.tsx`). A denied permission produces an unhandled rejection
  and a button that silently does nothing.
- **The product breadcrumb's last crumb reads "Product"** rather than the
  product's name.
- **Country pathway tiles sum to 32 against a stated 33** on `/countries/ner`,
  because there is no "No pathway assigned" tile as there is on `/catalog`.
- **The in-session catalogue promise never refreshes.** `catalogPromise`
  (`services/countries.ts:388`) is a module-level promise held for the life of
  the tab; the background revalidation writes to `sessionStorage` but never
  replaces the resolved value, so a long-lived tab can show 15-minute-old counts
  indefinitely while the cache underneath is current.
- **`useCountryCatalog` still accepts no `AbortSignal`**, and `fetchPage` does
  not thread one, so a navigation away mid-load cannot cancel nine in-flight
  requests. Raised in the previous review; unchanged.
- **`CountryCatalog.diagnostics`** is computed, serialised into the 662 kB
  session cache and rendered nowhere. Current values: 145 excluded by catalog
  role, 6 without a country, 17 without a type, 0 malformed.
- **`bootstrap-icons` is a `package.json` dependency imported nowhere in
  `src/`**, while the icons themselves load from jsDelivr (§7.8).
- **`docs/development_workflow.md` states "No automated test framework is
  configured yet"**, which stopped being true when `vitest` was added.
- **Three hero JPEGs total 9.2 MB** in `dist/assets` with no modern format or
  responsive variants.
- **Duplicate tab stops per card** on three surfaces (§ J6).

---

## 8. Implementation roadmap

### Immediate — hours to 2 days

Quick wins, independent of each other, all shippable in one release.

1. PDF zoom actually zooms (#2).
2. Thumbnail width and above-fold `loading` (#4).
3. Data-generation label colour and size (#6).
4. `pathwayLabel()` on the country results line (#12).
5. `aria-live` on the country results line (#13).
6. Country pagination into the URL; match `/catalog`'s replace policy (#11).
7. Single tab stop per card on all three surfaces (#15).
8. One `:root` token block; fix the stale comment (#16).
9. Language chips to 24 px; `aria-autocomplete`; clipboard `catch`; breadcrumb
   title; "No pathway assigned" tile on country pages (#24–27, #30).
10. Re-encode the three hero JPEGs (#20).

### Near term — approximately 1–2 weeks

11. **Country editorial: date it, split it, `lang` it, suppress the stale**
    (#1). Start here; it is the P0 and it has a content dependency, so the
    schema change should land early.
12. Route the four remaining surfaces through the product page (#3).
13. Filter target sizes and a mobile filter disclosure with active chips (#5).
14. Self-host fonts and icons; strip the remaining `@import`s; trim the flag
    rules (#8).
15. `sitemap.xml`, `robots.txt`, `noindex` on soft-404s, per-route descriptions
    (#17, #18).
16. Unit tests for the five pure-function modules (#9).
17. `/countries`: `<h1>`, country search, region in the URL (#10).
18. URL filter-value validation with an explanatory notice (#14).
19. Scroll to results on tile click (#19).

### Strategic — approximately 1–2 months

20. **Progressive catalogue loading** (#7). The largest single performance win
    and the one that most needs care, because it changes when counts are final.
21. **Thread `AbortSignal` through the catalogue service** and make the
    background revalidation replace the in-session value. Prerequisite for 20.
22. **Extract the shared discovery surface.** `Catalog.tsx` and
    `CountryDetail.tsx` now hold near-duplicate filter, sort, pagination and
    empty-state logic that has already drifted in three observable ways (URL
    page, `aria-live`, `pathwayLabel`). A shared hook owning filter state,
    URL serialisation and pagination would make findings #11, #12, #13 and #14
    single fixes instead of four.
23. **Decide the diagnostics question.** Ship the metadata-health panel or
    delete the computation and stop caching it.
24. **Resolve the third-party CDN policy** with FAO web and data protection,
    then implement whatever it says (input to #8).

### Optional experiments

- A "copy link to this view" control on `/catalog`; the URL is already correct.
- Multi-select facets and a language facet, both requested by the previous
  review and still open.
- Pre-rendering the static routes and the catalogue shell only.
- Publishing the group-contraction figure as a visible "catalogue changes"
  line, which would have surfaced the 991 → 900 drop without anyone looking.

---

## 9. Verification plan

For each of the most important improvements, what must be true afterwards and
how to prove it. Nothing here should be signed off from code inspection alone.

**Country editorial (#1).** Load five country pages spanning regions and
languages — NER, HND, BGD, COD, MLI. Confirm: one language rendered at a time; a
visible review date on each; a profile past the threshold either hidden or
flagged; `document.querySelectorAll('[lang]')` non-empty inside the block;
`.country-editorial` height reduced by roughly half. Read one French block with
a screen reader and confirm the voice switches. Confirm no page states a
year-specific figure without a visible date.

**PDF zoom (#2).** On a PDF product at 1440 px and at 375 px, record
`getComputedStyle(canvas).width` at 100 %, 150 % and 200 %. Assert it scales
proportionally. Assert `document.body.scrollWidth === document.documentElement.clientWidth`
at every zoom level and both widths. Open a tail-case PDF (the 17 MB item from
the previous review's sample) at 200 % on a throttled mobile profile and confirm
it does not stall or crash.

**Product-page routing (#3).** `grep -rn "itemDestination" src/` returns matches
only inside `itemResourceAction`. Click one card from each of the four surfaces
and confirm the URL becomes `/catalog/:id`. Withdraw a test item from the group
in ArcGIS, then click its homepage-strip card and confirm the Hub's
"no longer published" page rather than an ArcGIS 403.

**Thumbnails and CDN (#4, #8).** From a cold cache with the network limited to
the deployment origin, load `/catalog` and confirm: every icon renders; both
typefaces render; total image transfer under 200 kB; zero requests to
`fonts.googleapis.com`, `fonts.gstatic.com` or `cdn.jsdelivr.net`. Then measure
LCP on a Fast 3G profile before and after; record both numbers.

**Target size and contrast (#5, #6).** Re-run the two scripted sweeps used for
this review — the bounding-box sweep for sub-24 px interactive elements and the
luminance sweep for text — across `/`, `/catalog`, `/countries`,
`/countries/ner`, `/data`, `/data/guide`, `/catalog/:id`,
`/hazard-impact-assessments`, at 375, 768 and 1440 px. Both must return empty.
Keep the two scripts in the repository so this is repeatable rather than
re-derived.

**Progressive loading (#7).** On a Fast 3G profile with an empty session cache,
record the timestamp of the first real (non-skeleton) card. Target: under 3
seconds, against roughly 37 seconds implied today. Assert the final count equals
the group total, that facet counts are either final or marked provisional
throughout, and that the warm-cache path is still under 100 ms.

**Tests (#9).** `npm test` fails when `isDiscoverableProduct` is altered to
accept a partial category match; fails when `itemLanguage` is reverted to
tag-first precedence; fails when `itemRound` accepts a three-digit number.

**Discoverability (#17).** Fetch `sitemap.xml` from the deployment origin and
assert it contains one entry per current product family and per country. Fetch a
withdrawn product URL and assert `noindex` is present after render. Run Google's
Rich Results test against one product page and one country page.

**Regression sweep for everything.** `npm run build`, `npx tsc -b`, `npm test`,
then the manual matrix in `docs/development_workflow.md`: all filters, sort,
pagination, empty state, both discovery surfaces, 375 / 768 / 1024 / 1440 px, no
console errors, no horizontal overflow. Plus the two anonymous gates
(`/data`, `/data/:id`) and the three failure routes (`/no-such-page`,
`/catalog/<absent>`, `/catalog/<malformed>`).

---

## 10. What should not be changed

1. **The `postMessage` bridge in `MonitoringSystem.tsx`.** Target origin on
   every send, `origin` *and* `source` checked on receipt, frame identity
   re-verified after the token is minted. Do not simplify any of the three.
2. **The anonymous catalogue fetch.** `fetchCountryCatalog` uses no token, so a
   signed-in user provably sees the same public set as an anonymous one. Do not
   "improve" this by passing the user's token to enrich the catalogue.
3. **`catalogueVisible`.** A filter that should match nothing in a correct
   deployment, kept because it is what survives a provisioning mistake, with the
   reasoning in the comment. Keep both the filter and the comment.
4. **The product-unavailable state and its live re-resolution.** Resolving each
   product against the group rather than the cache is the correct architecture
   for a catalogue over mutable upstream, and the copy is right.
5. **The `/data` copy register, and the 404 copy.** Unchanged advice from the
   previous review, and it still holds.
6. **The country directory card.** Still the best-composed component on the
   site.
7. **The comment culture.** Comments that record the measurement behind a
   decision — including `styles.css`'s note on the fonts that were removed,
   `lib/catalog.ts:59` on why `created` beat a title parser, `arcgis.ts:90` on
   the 862-of-991 thumbnail census, and `NavDropdown.tsx` on why `:focus-within`
   had to go — are the reason this review could reconcile the previous one
   accurately. Do not let a tidy-up strip them.
8. **The facet arithmetic, including the disabled zero tab.** Showing a zero
   count rather than hiding it, so the sum a reader checks still closes, is a
   deliberate and correct choice.
9. **The combobox implementation** in `CatalogSearchBox.tsx`, apart from adding
   the one missing attribute.
10. **`prefers-reduced-motion` handling** across seven stylesheets and
    `ProgrammeNumbers.tsx`, and the marquee's pause-on-hover, pause-on-focus,
    explicit control and `aria-hidden` duplicate track. If the marquee is ever
    replaced, carry all of it across.
11. **The session cache design** — versioned key, 15-minute TTL, background
    revalidation, typed projection, failures swallowed. Fix the in-session
    staleness (#28) without touching this shape.
12. **The `EditorialPopup` staying dormant.** Previous "Do not do" item 5 stands.

---

## 11. Open questions

Only questions that cannot be answered from the repository or the running
interface.

1. **Why has the content group lost 91 items and 102 public product families
   since 2026-09-03?** 991 → 913 (mid-session, 09-03) → 900 (09-07), and
   817 → 715 families. Is this deliberate editorial withdrawal, an in-progress
   re-sharing exercise, or an accident? Until this is answered, no count on the
   Hub can be presented as stable, and the launch date should not be set.
2. **What is the review cadence and owner for country editorial profiles?** The
   fix for #1 needs a threshold ("hide after N months") and someone accountable
   for refreshing 55 profiles. Without both, the code change moves the problem
   rather than solving it.
3. **Is FAO comfortable with visitor IP addresses reaching Google Fonts and
   jsDelivr from a page carrying the FAO data-protection link?** This determines
   whether #8 is a performance task or a compliance task, and therefore its
   priority.
4. **Is the FAO Design System theme allowed to be trimmed further?**
   `vite.config.ts` already strips three font imports on the argument that the
   vendored file must stay byte-exact. Extending that to the icon CDN and the
   251 flag rules is the same argument at larger scale, but it should be
   confirmed with the theme's owners.
5. **What is the intended relationship between `/hazard-impact-assessments`,
   `/flood-services` and `/catalog`?** All three list overlapping subsets of the
   same group with different card designs, different link targets and different
   filters. Are the first two thematic *views* of the catalogue, or standalone
   programme pages that happen to list products? The answer decides whether #3
   is a small routing fix or the start of a consolidation.
6. **Is the "Countries surveyed = 42" figure still current?** It is hardcoded in
   `services/monitoring.ts` and footnoted "verified 28 Jul 2026", six weeks ago.
   Who re-verifies it, and how often?
7. **When does `REFERENCE_GENERATION` stop pointing at V3 preview data?** Every
   V3 manifest entry still carries `preview: true` and `/data` still says
   "Published with reference records for review; real survey data follows." This
   is correct for a review environment and must not survive a production
   cutover; `docs/handoff.md` records it, and it belongs on the launch gate.
8. **Has anyone confirmed that publishing the coverage matrix is acceptable to
   the programme?** It makes coverage *gaps* legible across 54 countries. The
   previous review flagged this as a question and it shipped; confirm it was
   asked.

---

## If we only do five things

Ordered by expected improvement to the Hub's overall quality.

1. **Date and de-duplicate the country editorial block, and hide what is
   stale.** (#1, P0, 1–2 days.) Removes the only place the Hub asserts
   three-year-old humanitarian figures as current, on all 55 country pages, and
   shortens the most important journey by a quarter.
2. **Route the last four surfaces through the product page.** (#3, P1, 1 day.)
   Makes 124 hazard-impact assessments and the homepage's most prominent strip
   citable, licensed, previewable and gracefully recoverable — finishing work
   that is already 80 % done.
3. **Fix the mobile and low-vision failures: PDF zoom, 19 px filter targets, the
   2.42:1 status labels.** (#2, #5, #6, P1, ~2 days combined.) Three confirmed
   WCAG 2.2 AA failures, all on the journeys the programme most needs to serve,
   all cheap.
4. **Cut the cost of a first load: thumbnail widths, self-hosted fonts and
   icons, then progressive catalogue rendering.** (#4, #8, #7, P1, ~1 week for
   the first two and 2–3 days for the third.) Takes the slow-connection journey
   from roughly 37 seconds and 2.8 MB to something a field user will wait for.
5. **Put the catalogue's pure logic under test, and generate a sitemap.**
   (#9, #17, P1/P2, ~4 days combined.) The first stops the next silent
   regression in what every card says; the second is the difference between 715
   product pages existing and 715 product pages being findable.
