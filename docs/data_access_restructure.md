# `/data` restructure: surveys as the unit of discovery

Status: section 13 steps 1-7 implemented and step 8 partly, 2026-09-21; not yet
committed. The live signed-in package test (section 14) is outstanding. Grants
now live in the workspace, but presenting and counting them by survey (step 8)
and microdata packages (step 9) are not done.
Supersedes the `/data` information
architecture in `docs/data_access_strategy.md` sections 4-9; that document
remains authoritative for the generation model, the publication-tier decision and
the dissemination-view reasoning. Read with `docs/data_access.md` (the shipped
contract), `docs/temporary_microdata_grants.md` and `docs/authentication.md`.

## 1. The problem

`/data` currently presents DIEM data the way DIEM builds it: by infrastructure
generation. A signed-in member meets three generations, four thematic items per
generation, boundaries, documentation columns, API tools, licences and the
microdata routes on one page, and must work out for themselves which
infrastructure holds the survey they came for.

Nobody arrives wanting an infrastructure. They arrive wanting Nigeria round 8.

The restructure makes the **survey** - one `(country, round)` collection - the
unit of discovery, and reduces the infrastructure to what it is: an
implementation detail the Hub resolves on the user's behalf.

## 2. Non-negotiables

These are unchanged by this work and every step must preserve them.

- **Routes.** `/data/:datasetId`, `/data/grants/:datasetId`,
  `/datasets/:datasetId` and `/datasets/:datasetId/explore`, including the
  `?country=ISO3&round=N` deep-link contract in `docs/data_access.md`. External
  applications - the Household Survey Explorer dashboards among them - link to
  these with query parameters. They are a public contract.
- **AGOL items, layers and sharing.** No item is renamed, re-shared, replaced or
  wrapped. The Hub AGOL group keeps working as the direct access path it is.
- **Authorization is ArcGIS.** Every count, badge and list in this plan is
  presentation. What a user can actually open is still decided by resolving the
  item against the active identity, exactly as `docs/data_access.md` states.
- **No expiry date for temporary grants.** `docs/temporary_microdata_grants.md`
  forbids it: the seven-day window runs from *issuance*, the end date lives in a
  private registry the browser must never read, and a date rendered from a guess
  is worse than no date because the recipient plans around it. The Hub
  calculates nothing and counts down nothing.

## 3. Information architecture

### `/data` - public overview

Short, educational, and the same page whether signed in or out. Its whole job is
to get a first-time visitor to the right path.

1. Hero: access DIEM household survey data.
2. **Two side-by-side choices**: aggregated data, household microdata. What each
   is, who can get it, what is required to access it. Never "what it costs" -
   nothing here is paid for and the word implies otherwise. On mobile these
   stack, aggregated first.
3. **Three steps**: sign in, choose surveys, download data and documentation.
4. **Compact V1-V3 timeline**, stating that the Hub selects the infrastructure
   automatically. Not a decision the visitor is asked to make, and not the first
   thing they meet.
5. Primary CTA: open the survey data workspace.
6. Secondary links: `/data/guide`, the microdata request form, FAM.

Removed from `/data`: the per-generation dataset inventory (`PublicInventory`),
the dataset card grids, the documentation columns, the boundary section, the API
and tools section, and the full licence text. Detailed licences, methodology,
boundaries and API guidance already live in `/data/guide` and belong there.
`PublicInventory` collapses into the timeline as a compact summary.

Signed in, `/data` gains one card linking into the workspace. It does not become
a second workspace.

### 3.1 `/data/guide` changes in the same release

The guide is a valid home for the material leaving `/data` - it already carries
licensing, methodology, boundaries, documentation, API guidance and the microdata
terms. But three passages describe the workspace being replaced and go stale the
moment `/data` changes:

- `src/pages/DataGuide.tsx:113` promises that archived generations are collapsed
  in the workspace. There are no generation blocks in the new workspace.
- `src/pages/DataGuide.tsx:133` instructs the reader to choose a generation and a
  thematic dataset, then filter by country and round. The new journey reverses
  that order, which is the entire point of the restructure.
- `src/pages/DataGuide.tsx:205` says the French and Spanish citations can be
  copied from the workspace. That citation section is being removed.

The replacement download instructions:

1. Open the survey workspace.
2. Choose country and round.
3. Choose all available themes, or specific themes.
4. Review the package.
5. Download the data and its metadata.

**The French and Spanish citation text moves into the guide.** It is being
removed from `/data`, and losing two of the three languages would be a
regression, not a simplification.

### `/data/surveys` - authenticated workspace

Page title **Survey data workspace**; navigation and CTA label **Your surveys**.
Signed out, this route renders a **sign-in gate that preserves the destination**,
so sign-in returns the visitor here rather than to `/data`.

Two modes, implemented as accessible tabs, never sharing a selection - different
licences, different structures, different authorization:

1. **Aggregated data**
2. **Microdata access**

Switching modes preserves the other mode's selection for the visit and says that
the two packages are separate. User-facing language is *selection* and *package*;
never *cart*.

```text
Survey data workspace
├── Access summary
│   ├── Aggregated survey data: 43 surveys
│   └── Microdata: available by request / 12 approved surveys
├── [ Aggregated data | Microdata access ]
├── 1. Select surveys
├── 2. Choose thematic areas
├── 3. Review package
└── Download
```

Progressive sections on one page, not separate routes. A later step is **not
literally disabled**: every step's heading stays visible and states its own
prerequisite - "Choose at least one survey to continue to thematic areas" -
because a large disabled fieldset is something a keyboard or screen-reader user
cannot enter or understand. Use collapsed or inactive presentation instead. When
a step becomes available, focus does not move on its own; the user activates
*Continue to thematic areas*.

At the foot, collapsed: **Technical resources and source datasets** - the
existing infrastructure grids, documentation, boundaries and API links, rebuilt
as compact list rows (title, generation, thematic area, source status, Explore,
ArcGIS item). This is a technical reference, not a second discovery experience,
and the large dataset cards do not move here intact.

## 4. Survey identity and the availability matrix

The internal key is **`generation + adm0_iso3 + round`**, because the generation
decides the schema, the metadata and the source service. (This first said round
numbers collide across infrastructures. The survey register shows they do not
within a country: rounds are numbered per country across the whole programme,
so Nigeria's rounds 1-3 are V1 and 4 onwards V2. The same round value does
recur across countries. The generation stays in the key regardless, since it
is what selects the schema and documentation.) The display stays "Nigeria · Round 8" with a secondary
generation badge.

`src/services/surveyAccess.ts` queries each accessible thematic resource and
builds an availability matrix, not a flat list:

```text
Survey
  ├─ generation
  ├─ country, round
  ├─ collection period, when available
  ├─ available themes
  ├─ source item and layer per theme
  └─ declared administrative coverage (manifest hint, not measured coverage)
```

Discovery is a live two-field distinct query per service, which is what the
manifest's own item IDs resolve to. **Measured 2026-09-20** against the five
public V3 services:
`query?where=1=1&outFields=adm0_iso3,round&returnDistinctValues=true` answers in
0.64-0.71 s each and the five parallelize, so first paint costs roughly one
second for that generation.

### Authenticated V2/V1 probe, 2026-09-20

The same signed-in Hub session that resolves the protected explorer was used;
no token was copied out of the authentication boundary. Both generations expose
the same canonical discovery fields, **`adm0_iso3` and `round`**, so the adapter
does not need a title- or alias-based field guess. V1 was also verified through a
real filtered request: `adm0_iso3 = 'AFG'` resolved 96 of 709 rows from layer 0.
The signed-in explorer exposed numeric comparison operators for `round` in both
generations; the loaded distinct values were integers 1-31 in the sampled V2
source and 1-9 in the sampled V1 source. The current explorer does not expose a
null-count predicate, so discovery does not assume that every row is usable: it
keeps valid identities, counts rows lacking a valid ISO3/integer round, names the
affected source and marks the overall result partial.

| Generation | Theme | Item | Resolved layer | Rows | Fields |
|---|---|---|---|---:|---:|
| V2 | Incomes, shocks and needs | `499917f1518141209c2a6de55a79d991` | `diem_adm_repr_1_mview` | 2,698 | 311 |
| V2 | Crop production | `1b006938d6a344aeb5a309f69f3e344b` | `diem_adm_repr_2_mview` | 2,324 | 244 |
| V2 | Livestock production | `71460258c059453d8eab2d7c56a7b0c5` | `diem_adm_repr_3_mview` | 2,324 | 210 |
| V2 | Food security | `fbef5b1ef85840838166a6b4d359f9bb` | `diem_adm_repr_4_mview` | 2,698 | 369 |
| V1 | Incomes, shocks and needs | `6e4f7208540643e68531d15b2e08e8dd` | `hh_adm1_1_mview` | 709 | 306 |
| V1 | Crop production | `ffe31542ff8841dba63e701f09d877e7` | `hh_adm1_2_mview` | 709 | 189 |
| V1 | Livestock production | `eab64778a6de4936b51a869acf589936` | `hh_adm1_3_mview` | 709 | 172 |
| V1 | Food security | `263f1c1964164ebe82382a03b4a4e1ea` | `hh_adm1_4_mview` | 692 | 329 |

The browser explorer became usable in roughly 3.0-5.5 seconds for each V1
resource when opened serially; a sampled V2 resource settled in roughly 4
seconds. Those figures include item, schema, count, map and preview requests, so
they are a conservative upper bound rather than the latency of the lightweight
two-field discovery query. The workspace must issue the theme queries in
parallel and reveal confirmed survey rows progressively instead of blocking the
whole picker behind the slowest service.

The probe also settles three contract details:

- The unequal theme row counts in both generations prove that a flat
  "survey has every theme" model is false; the availability matrix is required.
- V2 sources already exceed a 2,000-row service page. Package data queries must
  paginate. Discovery must also keep requesting ordered distinct pages while a
  page is full, rather than trusting `exceededTransferLimit` alone, because an
  explicit record-count cap may suppress that flag.
- V1 exposes 30 distinct ISO3 codes but its country-name choices include two
  spellings for the Democratic Republic of the Congo. Identity and de-duplication
  must therefore use ISO3, never the rendered country label.

The decision is to keep **live discovery as the primary path**, with the hybrid
fallback below retained for individual sources that time out or fail. A source
failure produces a partial, named state; it does not hold an otherwise usable
picker on a single blocking spinner.

Results are cached in memory for the active authenticated requester, with an
explicit refresh. They are **not** serialized to `sessionStorage`: discovery is
a protected ArcGIS response, and `docs/authentication.md` requires protected
responses to remain in React/runtime memory. The later selection state may keep
only versioned stable survey keys in `sessionStorage`, as section 9 specifies,
and sign-out clears those keys.

If live discovery proves too slow at scale, the fallback is **not** the
monitoring survey-release table on its own. That table
(`fetchCountryMonitoringCoverage` in `src/services/monitoring.ts`) can supply
candidate `(country, round)` records, but it cannot supply per-theme
availability, the actual source item and layer, the publication state or the
administrative coverage - so it cannot construct a package, and on its own it
produces a fast, optimistic picker whose rows fail later.

The fallback is therefore hybrid:

1. The monitoring table produces a **candidate** survey list.
2. Actual theme availability is resolved from the ArcGIS services when a survey
   is selected.
3. A survey does not enter the confirmed access count until at least one
   accessible source has been verified.
4. Full preflight runs before download is enabled.

**Theme availability is not a single state.** These are materially different
situations for an analyst and must read differently everywhere they appear:

- *Not collected for this survey* - expected omission, disclosed during
  selection.
- *Not yet published* - a publication state.
- *Could not be retrieved* - an unexpected failure, which aborts the package
  rather than quietly shrinking it.

## 5. V3 test records: excluded from normal discovery

Every V3 aggregate service today holds simulated records only. Measured
2026-09-20, all five return exactly `COD/99`, `NGA/99`, `TCD/99` - three
fabricated surveys at a round number that does not exist.

An earlier draft of this plan let them into the picker behind a badge and a
README warning. That is not sufficient: once a CSV is separated from its archive,
the badge and the README are gone and the numbers look like evidence.

Therefore:

- `/data` explains that V3 is the current infrastructure, being prepared for real
  surveys.
- The workspace says "No production V3 surveys are available yet" when that is
  the case.
- The V3 services are exposed under the collapsed **Test and technical
  resources** section.
- **Test surveys never contribute to any "N surveys available" count.**

### Test-data mode, precisely

The technical section lists *source datasets*; the picker lists *surveys*. They
are different objects, so "make the rows selectable" is not a well-defined
instruction. The behaviour is:

- The technical section carries one control: **Open test-data mode**.
- Activating it adds the three test surveys to the main picker - it does not make
  dataset rows selectable.
- A persistent orange **Test data mode** banner sits above the picker while it is
  active.
- The URL may carry a harmless `?test=1`, so the mode is shareable; the selection
  itself stays in session storage.
- **Contributors only** (added 2026-09-21). Every test survey is `opendata = 0`,
  which only a Contributor may see under the content-visibility rule, so for
  anyone else the mode would open onto an empty list. The control is not shown
  to them and `?test=1` is ignored.
- Leaving test mode clears every test selection.
- **Production and test surveys can never be in the same package.** Separate
  packages is a stronger guarantee than filenames and warnings alone, which are
  the layer that survives a CSV being pulled out of its archive.
- Test packages still carry `TEST_DATA` in the archive name, every directory name
  and every CSV name, and the warning still appears in the selection, review and
  download states.

This must hold before production. `docs/data_access_strategy.md` section 4 names
a test figure presented as a survey result as the one failure this page cannot
afford.

## 6. Access summary

Modest access cards, not oversized KPI tiles for numbers that may be partial.

> **Aggregated survey data**
> 43 surveys available across two questionnaire generations.
> Last checked just now.

The number of generations is **generated from the confirmed surveys**, never
written as a constant. Production V3 contributes zero surveys today, so a static
"across three questionnaire generations" would be false on the day it shipped.

When some services fail to answer, the number is never presented as the total:

> 39 surveys confirmed. Four data sources could not be checked. **Check again**

Microdata states, and the copy for each:

| State | Copy |
|---|---|
| No grant | Microdata is available by request. |
| Temporary grant, scope countable | 12 approved surveys are currently available. |
| Active but uncountable | Temporary microdata access is active. Open it to view the approved surveys. |
| Legacy household-data group or contributor | Household microdata collections are available to your account. |
| Expired or revoked | Previous scope removed; return to the request-oriented state. |

Counting rules, because there are two independent access paths:

- **Temporary grants**: union the accessible grants'
  `(questionnaireVersion, adm0_iso3, round)` scope from the parsed item metadata
  (`GrantItemMetadata` in `src/services/microdataGrants.ts`). No extra queries.
- **Legacy household-data members and contributors**
  (`capabilities.householdData` in `src/services/auth.ts`): distinct surveys
  queried from the protected microdata resources they actually resolve. If that
  is slow or unreliable, use the uncountable wording rather than a wrong number.

The detailed microdata area may explain that temporary access normally lasts
seven days from invitation issuance. The summary must not imply a countdown, and
nothing anywhere renders a date.

## 7. Survey picker

A searchable results list or compact table - not a dropdown, which does not
survive multi-selection or keyboard use at this scale.

Columns: checkbox, country, round, collection period or year, **questionnaire**
(V1 / V2 / V3), available themes, **data status** (Published / Not yet published
/ Test data), optional "View details". Country and round are visually dominant;
the questionnaire is secondary, because the system resolves it.

The two are deliberately separate columns. A single status reading "current /
archived / test" invites *current* to be read as survey recency when it actually
describes the questionnaire generation.

Filters: search country, country, collection year, generation, selected only,
clear all.

Header: `43 surveys available · 6 selected`. For ordinary members: "You can
select up to 10 surveys in one package." At ten, disable only the remaining
unchecked boxes and say why; never disable the whole list and never make the user
guess which selection to drop.

On mobile, rows become compact selectable cards rather than a horizontally
scrolling table.

## 8. Theme selection

Two choices: **All available themes**, or **Choose thematic areas**.

Each custom checkbox states its reach against the current selection:

> Food security — available for 8 of 10 selected surveys

Choosing a partially available theme discloses which survey-theme combinations
will be omitted, before download. Availability is never communicated by colour
alone.

## 9. Persistent package summary

Desktop: a compact sticky panel beside the flow - surveys selected, themes
selected, files expected, estimated records, test-data presence, remove all,
continue to review.

Mobile: a non-obstructive bottom action bar (`6 surveys selected · Review
package`) opening an inline panel or accessible bottom sheet that covers neither
the filters nor the result rows.

Selections survive an accidental refresh in the same tab via `sessionStorage`.
Protected microdata selection state is cleared on sign-out, which the existing
cross-tab sign-out announcement already provides a hook for
(`docs/authentication.md`). Grant details never go into a shareable URL or
`localStorage`.

**Stored state is the stable selection keys plus a schema version, and nothing
else** - no counts, no grant metadata, no resolved permissions, all of which can
be stale or privileged by the time they are read back. On restore, every survey
key is revalidated against fresh discovery, entries that no longer resolve are
dropped, and the removal is stated rather than silent:

> Two previously selected surveys are no longer available and were removed.

## 10. Review and download

The preflight line (`6 surveys · 3 themes · 17 files · ~42,000 records`) leads
into a concrete table:

| Survey | Generation | Included themes | Files | Records | Notes |
|---|---|---|---|---|---|
| Nigeria, Round 8 | V2 | 3 | 3 | 8,421 | Complete |
| Chad, Round 12 | V3 | 2 | 2 | 5,108 | Crop theme not collected |

The primary action names its result: **Download 17 files for 6 surveys**.

Immediately before generating, state: archive filename, estimated size when
reliable, licence, any missing combinations, any test-data warning, and whether
every preflight check succeeded.

Generation shows stages - checking access, counting records, downloading file 7
of 17, adding metadata, compressing package, ready - with Cancel available
throughout, progress announced through `aria-live="polite"`, and focus moved to
the completion or error summary at the end.

On failure: preserve every selection, name the failed survey and theme, offer
Retry, never download a partial archive silently, never force the user to rebuild
a selection.

## 11. Package contract

One archive, folders inside it. No nested zips.

```text
DIEM_aggregated_2026-09-20.zip
├─ README.txt
├─ manifest.json
├─ LICENCE.txt
├─ NGA_R08_v2/
│  ├─ survey.txt
│  ├─ data/
│  │  ├─ NGA_R08_v2_food-security.csv
│  │  └─ NGA_R08_v2_crop-production.csv
│  └─ documentation_and_metadata.txt
└─ COD_R12_v3/
   └─ ...
```

The layout is identical for one survey and for ten, so a script written against
one package works against every package.

- CSV is the bundle format for every generation in the first release. Excel is a
  later addition.
- The generation appears in every directory and file name. Once files are
  unzipped, nothing else prevents a V2 and a V3 table from being combined by
  accident.
- `documentation_and_metadata.txt` (2026-09-21, replacing `metadata/fields.csv`,
  `layer-schema.json` and `resources.txt`, which repeated the raw layer schema
  without explaining it) links, per survey: the generation and why generations
  differ (`/data/guide#generations`), that generation's aggregated field
  descriptions and metadata (or says none are published yet), the administrative
  reference boundaries, the API and analysis tools, the exact source services,
  and the data access guide. Same content as the end of the survey workspace.
- `manifest.json` records item ID, layer ID, item-modified timestamp,
  generation, filter expression, record count, collection date, access date, and
  the query endpoint and parameters **stored separately**. No token-bearing URL
  is ever written into an archive.
- `README.txt` is the human recap of the same content, including a "not
  included" section naming every omitted combination and why.
- The user's account name is **not** written into the archive. It adds privacy
  exposure and improves nothing.
- `LICENCE.txt`: CC BY 4.0 and the FAO Statistical Database Terms of Use for
  aggregated data.

`fflate` is added as a lazy chunk, as `write-excel-file` already is.

## 12. Limits

- **Ten surveys per package** for community members. Not a daily or lifetime
  quota: this application is static and has no backend to account for one. The
  wording is "up to ten surveys in one download package".
- **Contributors get a measured package budget**, not the word "unlimited". An
  unbounded browser operation exhausts memory or dies mid-download. The budget -
  total estimated records and file count - is set from the step-1 and step-5
  measurements, and a contributor who needs more builds more than one package.
- **Every individual file remains subject to the 20,000-record browser export
  limit** documented in `docs/data_access.md`. Larger extractions belong to the
  generated Python/R scripts today and to the planned asynchronous export service
  (Phase D) in the end.
- The ten-survey cap is a usability guardrail, not a control. The aggregate
  services are public and directly queryable; the cap shapes ordinary use and
  protects nothing. Say so here rather than implying otherwise.

## 13. Build sequence

**The replacement must exist before the current page is dismantled.** `/data`
today is where an authenticated member reaches the dataset grids, documentation,
boundaries and tools. Restructuring it before `/data/surveys` works would, if the
two shipped separately, take all of that away and give nothing back. The new
public page and the new workspace **switch atomically, in one release**.

1. **Completed 2026-09-20 - measure live survey discovery** against the real
   accessible services, authenticated for V2 and V1: field mappings, resolved
   layers, row counts, pagination implications and browser response times are in
   section 4. V3 was measured the same day.
2. **Completed 2026-09-20 - `src/services/surveyAccess.ts` contract**:
   generation-aware survey identities, theme availability, source items,
   partial and error states, requester-scoped in-memory cache with explicit
   refresh, progressive per-source updates, ordered pagination with an explicit
   exhaustion guard, production/test separation and tests. Invalid identity
   rows are counted and reported without discarding the valid rows from that
   source. UI wiring remains step 3.
3. **Completed 2026-09-21 - `/data/surveys` read-only**, reachable at its own route: access summary,
   filters, selection, availability badges, collapsed technical section. Verify
   the catalogue is truthful before building any download.
4. **Completed 2026-09-21 - update `/data/guide`** per section 3.1, including moving the French and
   Spanish citation text into it.
5. **Completed 2026-09-21 - restructure `/data`** into the public overview, reduce `PublicInventory` to
   the compact summary, and expose the workspace CTA - all in the same release.
6. **Completed 2026-09-21 - single-survey aggregated package**: extract reusable paged-query helpers
   from `src/services/dataExplorer.ts`, add preflight counts, schema metadata,
   archive generation.
7. **Completed 2026-09-21 - multi-survey packages**: the ten-survey limit, size budgeting, progress,
   cancellation, transactional failure, lazy zip library.
8. **Partly done 2026-09-21 - temporary microdata access** presented by survey. The grants now live in the workspace microdata tab and `GRANTS_ROUTE` opens it; presenting and counting them by survey is not done; keep the existing explorer
   and download actions; no fabricated dates; no package download when
   `bulkExportEnabled` is false.
9. **Microdata packages, separately and later** - only once the licence, V3
   documentation availability, the V3 core/optional pairing on
   `survey_id + hh_id` and grant revalidation are settled.
10. **Regression and acceptance testing** per section 14.

## 14. Acceptance criteria

Product and UX:

- A first-time visitor can explain the difference between aggregated data and
  microdata without opening the guide.
- A user can select and download one survey without understanding V1, V2 or V3.
- No normal workflow can produce or count simulated V3 data.
- A selection survives an error and a refresh within the tab.
- Every zero, loading, partial and failed state has specific copy and a next
  action.

Accessibility:

- The whole workflow is keyboard-operable.
- Checkbox groups use `fieldset` and `legend`.
- Status is carried in text, not colour alone.
- Focus moves appropriately after preflight, failure and completion.
- Progress is announced to assistive technology.
- At 200% zoom and 375 px width, no selection or review control becomes
  unreachable.

Regression - these must be exercised explicitly:

- `/data/:datasetId`, `/data/grants/:datasetId`, `/datasets/:datasetId`,
  `/datasets/:datasetId/explore`, and `?country=`/`?round=` deep links from the
  dashboards.

Account states - all five:

- an ordinary community member;
- a new account still inside the provisioning window;
- a temporary-grant recipient;
- a legacy household-data group member;
- a contributor.

## 15. Replacing the V3 pilot items after the rebuild

Status: planned 2026-09-21, not implemented. V3 is in its pilot phase: every V3
item the Hub reads today holds simulated COD/NGA/TCD round-99 records, all
`opendata = 0`, and is flagged `preview: true`. The rebuild against the final
questionnaire (hh_survey_v3 register item 10) will replace those items. The
goal is that swapping them is a configuration change, reviewed in one place,
with no code edits.

### What is already swap-proof

- **One manifest.** The seven V3 IDs and their `preview` flags live only in
  `src/services/protectedData.ts`. Discovery, the `/data` overview, the
  workspace's technical resources and the dataset explorer
  (`resourceForDataset`) all derive from it.
- **Schema read at runtime.** Country and round field names, the layer id and
  the `opendata` flag are discovered from each layer (`surveyAccess.ts`,
  `visibility.ts`), so a rebuilt schema with renamed or added fields needs no
  code change.
- **Generation resolved per survey.** Nothing keys on a V3 item ID outside the
  manifest.

### What is not, and the change that fixes it

**1. One slot, two items.** The agreed rebuild topology makes each V3 service
two items: a private mother table shared with Contributors, and a public hosted
view exposing only `opendata = 1` rows. The Hub should read the public view for
everyone, and the mother table only for Contributors (staging and validation).
The manifest holds one ID per slot, so it cannot express that.

Change: give each V3 manifest entry `publicViewId` and `contributorSourceId`
in place of the single `id`, plus one resolver - "which item does this viewer
read?" - used by discovery, the explorer and the technical list. V1/V2 entries
keep a single `id`, which the resolver returns for both scopes. With this in
place the Hub's `opendata = 1` client filter (section 4, `visibility.ts`)
becomes defence in depth over a real ArcGIS boundary rather than the only
line.

**2. Pilot flags scattered through entries.** `preview: true` sits on seven
separate objects. Replace it with one generation-level switch -
`V3_STATUS: 'pilot' | 'production'` beside `REFERENCE_GENERATION` - read
everywhere `preview` is read today (discovery's test exclusion, the overview's
"no production data yet" line, the microdata test-records label). Going live is
then one line.

**3. The swap itself as a checked list, not a memory.** Gather the V3 IDs into
one exported block at the top of the manifest (`V3_ITEMS`), with the
theme/component each serves. Add a test that fails if `V3_STATUS` is
`production` while any V3 item still resolves to a known pilot ID, so going
live without replacing an ID cannot pass CI.

**4. Two repositories, one list.** The dashboard keeps its own copy of the same
V3 IDs in `DATA_ACCESS_CONFIG`
(`hh_survey_v3/development/phase6_web_app/js/core/config.js`). The rebuild must
update both, together. Record that in both repositories' rebuild checklists;
generating one from the other is possible but crosses a repository boundary
and is not proposed here.

### The switch-over checklist (when the rebuilt items exist)

1. Record each new public-view and mother-table item ID in `V3_ITEMS`.
2. Confirm each public view's definition query exposes only `opendata = 1`, and
   each mother table is shared only with the Contributors group.
3. Add the V3 documentation entries (field descriptions, codebook, SDMX) to
   `DOCUMENTATION_RESOURCES`, each with an `audience`.
4. Set `V3_STATUS: 'production'`.
5. Run the tests, including the pilot-ID guard, and the section 14 account
   states, now with real V3 surveys.
6. Update the dashboard's `DATA_ACCESS_CONFIG` in the same release.

### Found while planning, separate from the swap

The dashboard's `HUB_DATA_URL` (`hh_survey_v3/.../js/core/config.js`) sends
signed-in users to `/data` "for aggregated downloads, microdata and the request
form". `/data` is now the public overview; those things live in
`/data/surveys`. That link should move to the workspace. It is a one-line change
in the other repository, not made from here.

## 16. Open items

- **Discovery performance in the new adapter.** The authenticated probe gives a
  conservative full-explorer timing, not isolated two-field-query timings.
  Instrument the parallel `surveyAccess.ts` requests and verify progressive
  partial rendering before setting a durable timeout budget; do not regress to a
  page-wide loading gate.
- **Administrative coverage per generation.** The service contract currently
  carries `declaredAdministrativeCoverage`, copied from the protected-resource
  manifest, and deliberately does not call it measured or published coverage.
  V2 publishes ADM1 and ADM2 within one item; the V3 placeholders are
  survey-representative only. Measure the actual coverage before presenting it
  in the picker or deciding whether an admin-level control is useful.
- **Contributor package budget** numbers, from the step-1 and step-5
  measurements.
- **Microdata packaging** is deliberately unplanned here beyond section 13 step
  8.
