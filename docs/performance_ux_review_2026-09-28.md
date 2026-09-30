# Performance and UX review — 28 September 2026

**Review snapshot, 28 September.** On 30 September the user approved Q1, Q2,
Q3, M4 and M2a; they are implemented locally and recorded in
`docs/changelog.md`. References below to pending approval and no implementation
describe the original review state. Q3 needs a separate deployment to change
live cache headers. The user subsequently removed M4's pause-button proposal;
the implemented slideshow instead bounds images and preserves transition
continuity. M8 remains an investigation proposal.

Reviewed `C:\git\hub_v3`, branch `main`, commit `f81f58a`. The working tree was
clean when the review began. This report is internal and must stay outside the
deployment payload.

## Recommended order

1. Fix the country-page mobile overflow and shorten the mobile catalogue hero
   (Q1, Q2 below).
2. Give hashed assets a long immutable cache lifetime, while retaining HTML
   revalidation (Q3).
3. Bound homepage slideshow downloads and add pause (M4); replace product-page
   full-group enumeration with a verified narrow lookup for related-language
   data where the group query supports it (M8).
4. Expire the in-memory catalogue promise after its 15-minute TTL so a later
   navigation obtains current group data (M2a). Preserve the settled display in
   an already open page unless a separate live-update policy is approved.

Defer the larger pathway, cross-surface cache, homepage bundle and shared-shell
changes (M1, S1, M3, S2) until an instrumented browser baseline shows their
effect. The catalogue pathway remains an observed mobile UX issue.

These are concrete proposals supported by emitted bundle sizes, source paths,
HTTP headers and browser geometry. **This is not a completed Web Vitals
benchmark.** The missing measurements and the exact follow-up method are below.
No runtime speed-up is claimed before implementation and comparable profiling.

## Scope, environments and evidence quality

The original request named the review deployment. The user subsequently
identified **https://data-in-emergencies.fao.org/** as the production reference.
It is now the primary deployed reference; observations from the older review
site are explicitly separated.

| Environment | Observed identity / role |
|---|---|
| Local production build | `npm run build`; Vite build succeeded in 13.65 s; main `index-DX_xswtY.js`, CSS `index-BLhKjJfZ.css` |
| Local preview | `npm run preview -- --host 127.0.0.1 --port 4174 --strictPort --mode http-test` |
| Production | Main `index-DH-jr9TK.js`; CSS `index-BLhKjJfZ.css`; homepage and public routes inspected |
| Older review | Main `index-Dc5CoVxy.js`; CSS `index-Cbwh0eZO.css`; public-route checks from the first review pass |

A different JS hash alone does not establish which commits differ: environment
configuration also changes output. Production and local emitted CSS names match.
Do not mix deployment timings into a local before/after comparison. The source
`HUB_ORIGIN` already names production (`src/lib/hubOrigin.ts:21`).

### What was measured

- All emitted JS/CSS chunk sizes and gzip sizes using Node `fs` and
  `zlib.gzipSync`; decimal kB throughout (1 kB = 1,000 bytes).
- Static route dependency closures, counting each shared JS chunk once.
- Vite's in-memory `generateBundle` module graph, without writing source or
  changing the build configuration.
- Public HTTP response headers through unauthenticated HEAD requests.
- Browser-rendered headings, result counts, focus state, control dimensions,
  viewport/document widths and selected interactions.
- A live public group first-page probe: 912 records, 100 per page, therefore
  **10 search requests** to enumerate the group; first-page JSON was
  **212,951 decoded bytes**. This is neither a total transfer measurement nor a
  browser waterfall. Counts are a snapshot, not a fixed contract.

### What could not be measured

The built-in browser exposes DOM/AX inspection, screenshots and viewport sizing,
but its available capabilities do not expose cache disabling, network/CPU
throttling, request interception or performance traces. Its read-only evaluation
scope does not expose `performance.getEntriesByType`. Therefore **TTFB, FCP,
LCP and its element, CLS, INP/event latency, long tasks, total network bytes,
request counts and slowest/blocking requests were not measured in-browser**.
Tool-call durations are not substituted for those metrics. No cache-cold or
throttled run is claimed. Ordinary reloads and route visits used uncontrolled
browser cache state.

The first signed-in local pass resolved 209 aggregate surveys and 208 microdata
surveys. Liberia round 3 V1 preflight confirmed **1,746 records / one table**.
The licence/download step was handed to the user; acceptance was reported, but
the next observation still found the download disabled. After the interruption,
the session was signed out. **No completed microdata download, worker timing,
protected-map measurement or protected production acceptance is claimed.**
Credentials, tokens, session storage and protected row contents were not read or
included in this report. No account form was submitted.

## Baseline per route

JS columns are the **local build's static dependency closure**, not actual
network transfer. CSS is the sum of applicable emitted initial stylesheets;
route-triggered map assets, fonts, images, analytics, ArcGIS responses and
embedded applications are excluded. Gzip is a comparison baseline: production
was also observed using Brotli.

**All cold/warm unthrottled, Fast 4G and Slow 4G timing, transfer and Web Vitals
cells are unmeasured.** The last two profiles also need 4× CPU slowdown. This
table records only emitted code costs, not browser transfer or runtime speed.

| Route | Initial JS kB / gzip | Initial CSS gzip kB |
|---|---:|---:|
| `/` | 470.38 / 133.76 | 53.66 |
| `/catalog`, filtered/search | 484.96 / 138.74 | 53.66 |
| `/catalog/34e84a9b46c849c9afa6f8738be4ca91` | 520.61 / 152.15 | 53.66 |
| `/countries` | 730.20 / 209.24 | 53.66 |
| `/countries/NER` | 782.34 / 227.95 | 53.66 |
| `/hazard-impact-assessments` | 743.49 / 213.49 | 53.66 |
| `/flood-services` → `/flood-analysis` | 490.83 / 140.97 | 53.66 |
| `/monitoring-system` | 492.27 / 141.62 | 56.08 |
| `/monitoring` (Hub shell only) | 474.20 / 135.61 | 53.66 |
| `/data` (public overview) | 480.82 / 137.02 | 60.69 |
| `/data/guide` | 496.52 / 142.85 | 60.69 |
| `/about` | 477.61 / 136.18 | 53.66 |
| `/photo-galleries` | 478.24 / 137.40 | 53.66 |
| `/contact` | 472.29 / 134.60 | 53.66 |
| `/data/surveys` (additional protected scope) | 647.40 / 181.22 | 65.22 |
| `/data/:datasetId` (additional scope) | 682.60 / 198.50 | 63.53 |

### Functional and responsive evidence

- Local public shells for the requested routes rendered; `/flood-services`
  resolves to the renamed flood-analysis page. Review public shells were also
  checked. Production spot checks covered these routes except a complete
  dashboard interaction session; the production product route was observed in
  its checking state during the route sweep, not certified as fully settled.
- Local responsive width sweep covered `/`, catalogue, country index/Niger,
  hazards, floods, survey catalogue, data overview/guide, about, galleries and
  contact at requested widths **375, 768, 1280 and 1920 px**. With the browser's
  scrollbar, measured content widths were 360, 753, 1265 and 1905 px.
  All sampled shells matched document width except Niger at 375: **702 vs
  360 px**. Production reproduced that exact mobile overflow. These are shell
  and layout checks, not certification of every settled component at every size.
- Catalogue showed 731 product families / 57 countries. Country=Niger produced
  33 results. Free text `Niger` produced 62 (it also matches Nigeria); this is
  expected substring search, not a country-filter failure. A nonsense query
  produced zero results, disabled zero-count pathways and clear-filter recovery.
- The mobile filter disclosure is already implemented; its six native selects
  measured **44 px high**. Do not re-propose the old missing disclosure or
  19 px filter defect as new work.
- Production catalogue at 375: first article top **1,165.30 px**; pathway group
  **285.60 px high**; filter block **156.70 px high**. The first card is more
  than one screen below the header even with the disclosure closed.
- Skip-link activation focused `MAIN#top`; the next Tab reached the photo credit
  link. This verifies the skip action, not a full keyboard/screen-reader audit.
- Review PDF sample opened on request and rendered page 1 of **15**. The local
  product shell had no horizontal overflow at 375. PDF zoom and download timing
  were not re-benchmarked.
- Review `/monitoring` rendered the embedded Explorer landing interface. Local
  `/monitoring` displayed an iframe refusal for `diem-monitoring.apps.fao.org`.
  Treat local embed testing as environment-dependent; do not weaken framing or
  authentication policy to make localhost resemble production.
- Loading shells, catalogue skeleton/empty recovery and protected preflight
  were observed. ArcGIS outages, broken thumbnails and contact-form submission
  were not injected or exercised. Error fallbacks were inspected in source.
- FAO header/footer, blue/deep-blue anchors and labelled catalogue pathways are
  present. The sampled homepage heading accent computes to light blue
  `rgb(168, 213, 223)`, not orange. Full WCAG 2.2 AA contrast, target-spacing and
  assistive-technology conformance remain unverified; no blanket pass is claimed.

## Bundle and delivery assessment

The shared entry costs **470.38 kB JS / 133.76 kB gzip**, including the eagerly
preloaded auth chunk. Every public route also starts with **323.34 kB CSS /
53.66 kB gzip**. A small Contact component therefore does not imply a small
Contact first load.

| Library / content | Current boundary | Assessment |
|---|---|---|
| MapLibre | Dynamic import in `src/components/datasetBasemap.ts:90`; 286.77 kB gzip JS plus 10.06 kB gzip CSS | Already deferred to map setup; not an ordinary homepage cost |
| Leaflet | Static inside lazy DatasetExplorer; explorer chunk 56.03 kB gzip | Route-split, but still loaded for an explorer route before an authenticated map is necessarily useful; inspect after profiling |
| PDF.js | Lazy `PdfPreview` in `src/pages/CatalogProduct.tsx:25`, mounted on request | Correct boundary; viewer 132.55 kB gzip plus worker 298.88 kB gzip, before the PDF itself |
| d3-geo / topojson / UN geometry | Country/impact map route dependencies; geometry chunk 58.71 kB gzip | Kept off homepage; country/hazard routes pay eagerly for the map |
| write-excel-file | `import()` at `src/services/dataExplorer.ts:776` | Correct click-time boundary; 19.95 kB gzip with its compressor dependencies |
| fflate package worker | `new Worker` at `src/services/surveyBundle.ts:150` | Worker emitted at 9.01 kB / 4.57 kB gzip; buffers transferred, cancellation terminates worker; do not move back onto main thread |
| DOMPurify | Separate 10.89 kB gzip chunk imported by country/product HTML renderers | Appropriate; never remove sanitization for a small byte saving |
| Country metadata | `@d3-maps/atlas` metadata participates in shared entry | 79,608 rendered module bytes before final minification; a projection of static country fields is a candidate, not an ArcGIS record mirror |
| Homepage / hero manifest | `App` eagerly imported in `src/main.tsx:4`; `HeroImage` eager URL glob | Homepage-exclusive code enters the common graph; glob emits URL strings, **not downloads of every image** |

Largest source modules in the in-memory Rollup graph included React DOM
(552,879 rendered bytes), PDF.js (787,912), Leaflet (473,952), MapLibre
(1,060,905), UN world topology (220,852), and DOMPurify (117,701).
These pre-final-minification module sizes are not additive gzip attribution.

Fonts are already local WOFF2 with `font-display: swap` and unicode ranges
(`src/assets/fonts/fonts.css`). Open Sans Latin is 48.32 kB, Merriweather Latin
97.55 kB. The vendored theme's network font/icon imports are stripped by
`vite.config.ts`; Bootstrap is Reboot only. No new CDN/font migration is needed.
There is no explicit initial font or hero preload in the HTML; evaluate a
single first-image/Open Sans preload only after identifying the actual LCP
element. Blindly preloading both fonts and several images may worsen contention.

Hero photography already uses responsive AVIF/WebP/JPEG sources and high
priority for the initial image (`src/components/HeroImage.tsx`). Image masters
are outside the deployable source. Four flood-page illustrative JPEGs still
total **1,281.93 kB** (252.42 + 297.01 + 356.70 + 375.80); they are lazy-loaded,
so optimization mainly benefits readers scrolling into those sections.
`public/` contains the legacy redirect pair and `robots.txt`, not a hidden
collection of large image masters. Confirm `public/` delivery separately when
reconciling deployment source; it is not evidence of an initial image payload.

### Hosting

There is no root `firebase.json` in this development checkout. The source
template is in `scripts/sync-web-repository.ps1:88`; the generated checkout
`C:\git\fao-oer-diem-hub\firebase.json` contains HTML/SPA `no-cache` rules and
no explicit immutable `/assets/**` rule.

| Probe | Observed Cache-Control | Compression |
|---|---|---|
| Production `/` | `no-cache` | gzip on the HEAD response |
| Production hashed main JS | `public,max-age=3600` | br |
| Production hashed main CSS | `public,max-age=3600` | br |
| Older review `/` and sampled assets | `max-age=3600` | br |

One production probe sequence timed out after the homepage; bounded asset
retries succeeded. No production document-TTFB conclusion follows from that.
Compression is already functioning. Propose immutable caching for hashed
assets, not a new compression package. Keep HTML, callbacks and API responses
out of that rule. The review HTML mismatch is deployment maintenance, not a
production defect.

## Source-backed findings

Impact 1–5 is a judgement about users affected and severity, not a measured
runtime effect. The recommended order above also reflects implementation risk.

| ID | Type | Evidence and root cause | Impact / effort |
|---|---|---|---|
| F1 | UX, accessibility | Niger document 702 px in a 360 px viewport, local and production. Round table is 696 px. `.country-timeline-scroll` has overflow but no positioning containment (`src/countries.css:349`); absolute `.sr-only` descendants can escape it (`src/styles.css:56`). The adjacent coverage matrix already documents/fixes this exact containment pattern at `src/countries.css:391`. | 5 / minutes; verify fix |
| F2 | UX | First catalogue card at y=1,165 px on 375 px mobile; vertical pathways consume 286 px. A later global 440 px hero rule overrides the earlier compact rule (`src/catalog.css:309` vs `:60`); pathway buttons each span a row at `:114`. | 5 / <1 h hero; 2–4 h pathways |
| F3 | Performance | Hashed production assets expire after 3,600 s; template has only HTML rules. Returning visits after that lifetime must revalidate/refetch unchanged assets. | 4 / <1 h configuration; deployment remains separately authorized |
| F4 | Correctness | The 15-minute TTL is consulted only before `catalogPromise` exists. `src/services/countries.ts:480` returns that promise indefinitely; background refresh at `:496` only writes storage, not live state. This can retain withdrawn/stale membership in discovery for a long-lived tab. Product detail separately checks current membership, but listings still need the group gate. No live withdrawal was induced. | 4 / about 1 h for expiry; live updates separate |
| F5 | Performance | `fetchCatalog` independently enumerates all pages (`src/services/arcgis.ts:45`). Impact/flood (`src/services/impactAssessments.ts:73`) and survey catalogue (`src/services/monitoringProducts.ts:137`) do not share the country-catalogue promise. At the observed 912 records, each fresh full enumeration means 10 search calls, plus group metadata on `fetchCatalog`. | 3 / 1–2 days; baseline first |
| F6 | Performance | Every product page calls `useCountryCatalog` at `src/pages/CatalogProduct.tsx:67`, in parallel with its narrow current-membership lookup at `:100`; all survey releases are then read at `:141`. The complete catalogue mainly supplies language siblings (`:192`). A one-product visit can initiate 10 group pages. The current product itself renders when its narrow lookup completes; the full group request is not a render blocker, but it consumes bandwidth concurrently. | 5 / validate narrow query before estimating fix |
| F7 | Performance | All routes inherit 133.76 kB gzip JS and 53.66 kB gzip CSS before route additions. Homepage is eager; country, impact, programme, catalogue and product styles are all imported from `src/main.tsx:20`. | 3 / 1–2 days; baseline first |
| F8 | UX, accessibility, performance | Homepage rotates 22 photographs every 6 s, mounts the next at 3 s, and progressively retains mounted images (`src/components/HomeHeroSlideshow.tsx:41–104`). Production progressed from 1 to 5 hero images during inspection. Only the search button was exposed in the hero; there is no pause control. Reduced-motion skips rotation but still schedules the second image. | 5 / 0.5 day |
| F9 | UX, performance | One top-level Suspense wraps all routes (`src/main.tsx:104`); the fallback replaces the route with one spinner/status message (`:51`). Header/footer are inside pages. Observed “Opening DIEM Hub 3.0…” screens therefore remove navigation during first lazy-route loads. | 3 / 1–2 days; baseline first |
| F10 | UX, stability risk | Homepage inserts Latest evidence only after catalogue resolution (`src/App.tsx:85`); FeaturedEvidence returns null until data exists (`src/components/FeaturedEvidence.tsx:50`). Two sections can appear above content the reader is already using. This is a layout-shift mechanism, **not a measured CLS failure**. | 2 / 0.5 day; measure CLS first |
| F11 | Performance | Four flood screenshots total 1.282 MB as JPEG; no responsive modern alternatives for those four imports (`src/pages/FloodServices.tsx:3`). Already lazy, so not the first-load priority. | 3 / 2–4 h |
| F12 | UX / resilience | Local embedded dashboard refused to connect while review rendered it. Hub shell has one iframe and no visible direct-open/retry fallback (`src/pages/MonitoringSystem.tsx:124`). A framing/network failure leaves users without an in-context recovery action. | 2 / 2–4 h; observe production failure first |

### Catalogue implementation details that matter to the plan

Pagination is already concurrent after the first total-bearing page; do not
describe it as ten serial round trips. The public raw and country-normalized
catalogues also have **different projections**: country discovery excludes
non-discoverable roles. Simply replacing `fetchCatalog` with
`fetchCountryCatalog` would silently remove legitimate programme resources.

Progressive loading already exists on `/catalog`, but subscription handling is
incomplete: a late `onProgress` caller receives `latestPartial` once and then
only the shared final promise (`src/services/countries.ts:480`). It is not added
to a listener set. A catalogue navigation during an initial homepage fetch can
therefore lose intermediate updates. This is a source finding, not a timed
browser reproduction. Fix it alongside F4, not by enabling progressive updates
on every page (which would make statistics and country lookups churn).

`countries.ts:304` and the product lookup have no request AbortSignal or finite
timeout; the hook's `active` flag stops stale React updates, not network work.
Do not attach one component's abort controller directly to a shared request:
other consumers may still need it. Use bounded request lifetime plus explicit
subscriber ownership. By contrast, photo galleries already deduplicate
in-flight work and enforce a 15-minute in-memory TTL while respecting caller
cancellation after completion. Reuse that reasoning, not necessarily that exact
implementation for a membership-sensitive catalogue.

Country editorial resolves its service, then queries profile/highlights in
parallel. Promotions' legacy fallback has an item → service definition → table
query chain. Those are metadata-discovery dependencies, not arbitrary code to
parallelize; keep them off the critical route and cache only suitable public
metadata. Survey-release pagination is sequential on `exceededTransferLimit`;
do not assume its total or page count is known in advance.

### Existing backlog, reconciled rather than rediscovered

Read alongside `docs/design_review_2026-09-03.md` and
`docs/design_review_2026-09-07.md`.

- Keep the shipped fixes: Reboot-only Bootstrap, self-hosted fonts/icons,
  `w=400` thumbnails, on-demand PDF viewer, progressive catalogue, skip link,
  product detail routes, URL filters, responsive filter disclosure and tests.
- Undated bilingual country context is already §7.1 of the September 7 review
  and item 9 of September 3. Production Niger still shows **2023** appeal figures
  and **1,315 characters** of combined context without a review date. This is
  editorial follow-up requiring its own approval; it is **not included as a
  newly discovered quick fix**, especially given the earlier declined work.
- Do not revive declined series grouping, metadata-health panels, change
  digests or a map-first catalogue under the label of performance work.
- Full WCAG verification remains a follow-up. Current measured select heights
  and skip focus contradict some old failures; do not repeat those failures.

## Implementation plan — approval required

Gains below are **targets or source-derived avoided work**, not measured
before/after improvements. Each approved item must be a separate concern, with
`npm run build`, `npm test` and focused browser checks after implementation.

### Quick wins — each under one hour

| ID | Concrete change / files | Expected gain | Risk and verification |
|---|---|---|---|
| Q1 | Contain round-table absolute accessibility text within its scroller. `src/countries.css`; inspect `src/components/CountryRoundTimeline.tsx` only if needed. | Document width 702 → 360 px in the recorded mobile case; preserve table's own horizontal scroll. | Low. Verify 375/768/1280/1920, keyboard access to final round, visible sticky headings, no clipping of readable text. Do not use global `overflow-x:hidden` to conceal the problem. |
| Q2 | Put the compact catalogue hero rule after the late full-size rule; target about 240–280 px at mobile widths, with sufficient text space. `src/catalog.css`. | Approximately 160–200 px less scrolling before controls/results; no claimed LCP saving. | Low. Check long translated/title text, 200% zoom, 375/768, photo credit and contrast. |
| Q3 | Add `Cache-Control: public,max-age=31536000,immutable` for fingerprinted `/assets/**` in `scripts/sync-web-repository.ps1`; generated `firebase.json` only in a separately approved deployment step. | Avoid routine one-hour revalidation of unchanged JS/CSS/fonts/images; cold-load gain zero. | Low if limited to hashed assets. Confirm HTML stays `no-cache`, callback/API remain excluded, old-tab chunk recovery still works. Verify deployed headers only after authorized deployment. |

### Medium changes

| ID | Concrete change / files | Expected gain | Risk and verification |
|---|---|---|---|
| M1 | On compact catalogue layouts, replace six full-width pathway rows with one labelled pathway control and visible active-filter summary/count. Keep desktop tabs. `src/pages/Catalog.tsx`, `src/catalog.css`. | Reduce recorded pathway block from 286 px toward 44–72 px; combined with Q2, target first card within roughly 750 px. | Medium, 2–4 h. Defer until Q2 is measured; preserve counts, URL, clear filters, zero-result recovery, keyboard semantics and current selected state. |
| M2a | Expire the settled `catalogPromise` when its data passes the 15-minute TTL, so the next load in that tab rechecks ArcGIS membership. Keep an already open page stable; do not push partial refreshes into it. `src/services/countries.ts`, focused tests. | Remove unbounded stale-memory lifetime without changing the current reader's view. | Low/medium, about 1 h. Fake-clock TTL, background-cache race, changed membership, failure/retry tests. Do not silently serve expired group membership. |
| M2b | If later justified, notify opted-in consumers of completed refreshes and deliver progress to every late catalogue subscriber. `src/services/countries.ts`, `src/hooks/useCountryCatalog.ts`. | Restore progressive delivery for late subscribers; live updates are a separate product policy. | Medium, 0.5–1 day. Decide whether a currently open listing should change under the reader; preserve completed figures and editorial lookups. |
| M3 | Lazy-load homepage-exclusive code, extract genuinely shared components/services so they do not force App back into the entry, and project static country metadata to fields actually used. `src/main.tsx`, `src/App.tsx`, `src/services/countries.ts`, relevant shared modules. | Working target: remove 10–25 kB gzip from non-home initial JS; verify actual graph before promising a number. | Medium, 0.5–1 day. Inspect final imports for circular/shared pulls; verify names, ISO codes, metadata, auth restoration and home LCP. No local mirror of ArcGIS records. |
| M4 | Add an explicit pause/resume control; stop preloading/rotation off-screen; retain only active/previous/next images; avoid second-image preload under reduced motion. `src/components/HomeHeroSlideshow.tsx`, `src/fao-adaptation.css`. | Bound mounted hero images to 2–3 instead of up to 22; avoid later downloads when paused/off-screen. | Medium, 0.5 day. Verify credit matches image, transition layering, reduced motion, keyboard focus, tab visibility and first hero priority. Browser caching does not eliminate image decode and memory costs when remounting. |
| M5 | Reserve stable space for homepage evidence sections or keep them below initially usable content; use neutral skeletons matching final geometry. `src/App.tsx`, `src/components/FeaturedEvidence.tsx`, `src/hub-home.css`, `src/promotions.css`. | Reduce shift from two late-inserted sections; target CLS ≤0.1 once instrumented. | Medium, 0.5 day. Slow/outage states must not leave large unexplained blank blocks; counts must not appear final before complete. |
| M6 | Encode the four flood illustrations as responsive AVIF/WebP with JPEG fallback and dimensions. `src/pages/FloodServices.tsx`, `src/assets/eve/`, image-generation script as appropriate. | Target ≤500 kB combined at equivalent rendered desktop sizes vs 1,282 kB JPEG originals; measure perceptual quality. | Low/medium, 2–4 h. Preserve map labels, credits, alt text and crop; keep lazy loading. |
| M7 | Add a visible token-free “Open Survey Explorer” fallback plus loading/retry guidance to the iframe shell. `src/pages/MonitoringSystem.tsx`, route CSS. | One usable recovery path when the frame fails; no iframe byte reduction claimed. | Medium, 2–4 h. Review `docs/authentication.md`; use the configured origin, preserve share state, never put credentials in the link. A timeout means “taking longer”, not proof of failure. |
| M8 | Validate a narrow Hub-group query for the current product's language family, then use it instead of `useCountryCatalog` on product detail. Gate the full survey-release read to products that can link to a monitoring round. `src/pages/CatalogProduct.tsx`, `src/services/countries.ts`, `src/services/monitoring.ts`. | Candidate reduction from 10 group pages to one or a few family reads on a cold product visit. Deferring the existing unconditional request to idle would ease load contention but **not** total bytes. | Medium/high, estimate after query validation. The language editions and citation are visible, so on-demand loading would change their current behavior. Test tagged/untagged families, removed members, supporting items, gallery redirects and citation completeness. Retain current membership check. |

### Structural changes

| ID | Concrete change / files | Expected gain | Risk and verification |
|---|---|---|---|
| S1 | Shared, bounded, anonymous raw group retrieval in `src/services/arcgis.ts`; keep country normalization in `countries.ts` and programme projections separate. Update impact/monitoring consumers and hooks. | Eliminate one repeated 10-page enumeration plus metadata request per reusable navigation in the measured catalogue size. Measure actual wire savings later. | High, 1–2 days. Distinguish public and authenticated identities; never put Contributor/private results in anonymous session cache. Preserve all role/tag/category gates and cancellation ownership. Coordinate with M2a. |
| S2 | Move shared header/footer outside the route Suspense boundary, give route content a stable loading region, and move route-specific CSS imports to lazy routes in controlled stages. `src/main.tsx`, page wrappers, common layout component, route styles. | Keep navigation available during lazy imports; target shared CSS ≤40 kB gzip vs 53.66, and smaller public first-load parse work. | Medium/high, 1–2 days. CSS order/specificity and global selectors can regress across navigation; test direct entry and every route order, active nav, full-screen iframe and errors. Do not indiscriminately purge FAO classes driven by remote content. |
| S3 | Add repeatable local performance measurement and budget checks after approval. `package.json`, a focused measurement script/config and CI workflow in its owning repository. | Converts currently missing Web Vitals evidence into an enforceable baseline. No direct user speed gain. | Medium. Keep traces free of credentials and protected rows; no production telemetry service or third-party CDN added by default. |

Do Q1/Q2 first, then Q3, M4, M8 and M2a. The production asset rule needs its
own deployment authorization. Defer M1, M2b, M3, M5, M7 and S1–S3 until an
instrumented baseline or a verified user failure justifies their cost. M6 is a
contained image task for later. Do not implement every item merely because it
appears here.

## Reproducible profiling follow-up

1. Record commit, build mode, browser version, hardware, viewport/DPR and exact
   deployment asset hashes. Use the production build, not the Vite dev server.
2. With an instrumentation-capable browser, measure every route in the baseline
   table under unthrottled, Fast 4G and Slow 4G profiles; record the actual
   throughput/latency parameters because profile names differ between tools.
   Use 4× CPU for both throttled profiles. Run each condition three times and
   report median and range, keeping production and local results separate.
3. Define cold HTTP cache and cold public application cache independently.
   Clear only the named public catalogue cache for a public cold run. Do not
   dump or indiscriminately clear auth storage. For warm reloads retain both;
   separately measure warm client-side route changes, since they reuse memory.
4. Record navigation TTFB/FCP; observe buffered LCP and its element until a
   fixed end point; calculate CLS excluding recent-input shifts. Capture resource
   counts and transferred/decoded bytes separately, with redirects and frames.
   Report unknown cross-origin byte sizes as unknown, not zero.
5. Capture long tasks and lab interaction duration for: catalogue query/filter,
   country-map selection, PDF open/next/zoom, route transitions, and one small
   package build. Do not label a single click as field INP. INP requires a
   representative interaction session; field p75 needs real-user sampling.
6. Measure `/monitoring` twice: Hub shell and embedded application. A fast host
   LCP is not proof that the embedded survey is usable. Do likewise for external
   contact/video content where appropriate.
7. For downloads, user signs in and accepts the licence; start timing at the
   enabled Download control, record preparing/fetching/compressing/completion,
   package bytes, record count and cancellation responsiveness. Never store a
   token-bearing HAR or screenshot credentials; retain sanitized aggregates only.
8. Inject ArcGIS and image failures locally with an approved test harness;
   inspect retry, empty results, stale membership, missing metadata, offline fonts
   and iframe failure. Repeat 375/768/1280/1920 plus keyboard and 200% zoom.

## Proposed budgets

These are proposed guardrails, not assertions that the current site passes.
Measure the complete static dependency closure, not just the named route file.

| Scope | Initial guardrail | Improvement target |
|---|---|---|
| Home and ordinary public route JS | ≤155 kB gzip | ≤120 kB on simple routes |
| Country/impact map route JS | ≤235 kB gzip | ≤200 kB, or defer map work without delaying directory use |
| Survey workspace JS | ≤190 kB gzip before compression | ≤170 kB |
| Dataset explorer JS | ≤210 kB gzip before dynamic basemap | Revisit after authenticated map trace |
| Dynamic MapLibre | ≤300 kB gzip JS; ≤11 kB CSS | Keep off routes that do not render it |
| PDF viewer + worker | ≤450 kB gzip, loaded only after request | Preserve request-time loading |
| Shared CSS | ≤55 kB gzip initially | ≤40 kB |
| LCP | ≤2.5 s representative unthrottled / field p75 goal | Document a separate achievable throttled target after baseline |
| CLS | ≤0.1 per measured session | No large late section insertion |
| INP | ≤200 ms field p75 goal | Lab interactions ≤200 ms as a separate diagnostic |
| Main-thread long task | Flag tasks >50 ms | Investigate repeatable tasks associated with visible delay |
| Responsive layout | No document overflow at requested widths | Wide tables scroll only in their labelled region |
| Request reuse | One shared anonymous enumeration per valid cache lifetime | Targeted product lookup instead of full discovery load |

## Non-goals and do-not-do list

- Do not copy ArcGIS catalogue records into a competing local/backend source of
  truth. A bounded cache must be explicitly revalidated against ArcGIS.
- Do not weaken Hub-group membership, discoverability, restricted-microdata or
  item-level authorization gates to save requests. Do not persist private
  responses into public caches or share them across identities.
- Do not expose credentials, long-lived tokens or client secrets; do not place
  tokens in URLs, screenshots, traces, reports or generated navigation links.
- Do not loosen redirect/origin checks, iframe policy or the authenticated
  postMessage bridge. Read authentication/data-access contracts for any changes.
- Do not add third-party font/icon CDNs or undo the theme-import stripping.
- Do not remove sanitization, attribution, FAO/UN map boundaries or disclaimers
  to reduce bundles. Do not rebuild the external Monitoring or EVE applications
  as part of a Hub optimization.
- Do not prefetch every route/map/PDF, preload every font, or introduce a service
  worker/offline catalogue without a separate freshness and authorization design.
- Do not call every missing AbortController a bug: shared consumers need proper
  lifetime ownership. Do not make all paginated services blindly concurrent.
- Do not redesign the institutional brand, change taxonomy, alter live ArcGIS
  editorial records, or revive previously declined product features.
- Do not commit, push, synchronize deployment checkouts or run a deployment
  workflow as part of this review. Approval of a plan item is not deployment
  authorization.

## Completion and remaining limitations

Build passed. No application code, configuration, ArcGIS data or deployment was
changed. There are no before/after runtime metrics because nothing was
implemented. This report and its handoff are the only intended tracked edits.

Remaining work: instrumentation-backed cold/warm/throttled metrics; full
keyboard/contrast/error-injection pass; protected map and actual package
download after a fresh user-managed session. None of these gaps invalidates the
measured mobile geometry, emitted bundle costs or source-backed request/cache
findings, but they limit claims about real-user speed and WCAG conformance.

## Appendix — emitted JS and CSS chunks

The table below is generated from the successful local `dist/assets` build with
Node `zlib.gzipSync`. Asset filename hashes identify this measurement only.

| Asset | Raw kB | Gzip kB |
| --- | ---: | ---: |
| `AboutDiem-yPdYkp9b.js` | 7.22 | 2.42 |
| `Catalog-CsX2uqkD.js` | 12.89 | 4.13 |
| `CatalogProduct-CI8SsW83.js` | 15.91 | 4.85 |
| `CitationText-D3ix9XPE.js` | 2.31 | 1.16 |
| `Contact-DjvkVFux.js` | 1.91 | 0.84 |
| `CountryDetail-DwvVisJf.js` | 29.68 | 9.18 |
| `CountryExplorer-Dle62a99.js` | 11.92 | 4.03 |
| `CountryMap-CI5jUs9_.js` | 4.38 | 1.91 |
| `DataAccess-C7Sy4LLK.js` | 10.44 | 3.27 |
| `DataGuide-C1yg2axy.js` | 23.84 | 7.94 |
| `DatasetExplorer-B5hqByzJ.css` | 33.09 | 9.87 |
| `DatasetExplorer-CV4BXbcr.js` | 187.98 | 56.03 |
| `FloodServices-CqL9EJdZ.js` | 18.98 | 6.47 |
| `HazardImpactAssessments-hGDQhjTL.js` | 29.81 | 10.32 |
| `HouseholdMonitoring-D--aA8hY.js` | 20.38 | 7.10 |
| `HouseholdMonitoring-wevONSH7.css` | 8.98 | 2.42 |
| `LegacyHubRoute-ECAIXBUM.js` | 1.41 | 0.78 |
| `MapDisclaimer-CrIpxtKW.js` | 1.18 | 0.64 |
| `MicrodataRequest-CV1qf4iZ.js` | 2.99 | 1.20 |
| `MonitoringSystem-BdGTcZdC.js` | 2.30 | 1.09 |
| `NotFound-Dn7VsQuZ.js` | 0.68 | 0.40 |
| `PdfPreview-LAu6eood.js` | 447.47 | 132.55 |
| `PhotoGalleries-B3ZgT90M.js` | 3.45 | 1.49 |
| `PhotoGalleryCard-DpSO9jTF.js` | 1.30 | 0.66 |
| `SurveyWorkspace-DRCUze62.css` | 23.89 | 4.53 |
| `SurveyWorkspace-LCb-mA0n.js` | 154.64 | 39.79 |
| `UnBoundaries-dAOm4_aP.js` | 23.26 | 9.33 |
| `auth-BkGMCxuu.js` | 32.24 | 10.23 |
| `bundleCompression.worker-DO7fejMk.js` | 9.01 | 4.57 |
| `catalogFilters-DbepIRrm.js` | 1.24 | 0.61 |
| `data-access-Cq8WfnGD.css` | 38.79 | 7.04 |
| `impactAssessments-CEe4OxOG.js` | 1.47 | 0.74 |
| `index-BLhKjJfZ.css` | 323.34 | 53.66 |
| `index-CTXUgEVK.js` | 71.70 | 19.95 |
| `index-DX_xswtY.js` | 438.14 | 123.53 |
| `leaflet-maplibre-gl-CFV6e9fl.js` | 1060.85 | 286.77 |
| `maplibre-gl-B-YMMjus.css` | 69.94 | 10.06 |
| `monitoringEmbed-BdrUiHTL.js` | 1.51 | 0.76 |
| `oauth-callback-BJt5XjjL.js` | 0.22 | 0.20 |
| `pdf.worker.min-wgc6bjNh.mjs` | 1078.61 | 298.88 |
| `photoGalleries-BecYShqx.js` | 3.11 | 1.50 |
| `purify.es-bRchjNq8.js` | 28.91 | 10.89 |
| `unGeometry-BJsDOMOY.js` | 217.39 | 58.71 |
| `useMediaQuery-tGfvennn.js` | 0.44 | 0.25 |
| `visibility-BPa8L9ko.js` | 22.37 | 7.67 |
