# `/data` strategy: three questionnaire generations, one publication tier

Status: 2026-09-03. **Phase A is implemented**; Phases B, C and D remain.
The editor decided on the same day to place V3 in the reference slot
immediately, accepting its test records because the Hub is not on production.
Read with `docs/data_access.md` (the shipped contract) and
`docs/authentication.md`.

## 1. Publication layers: what exists today

> Do we already have views for publication, or do we use the same layers that
> populate the dashboards?

### V1/V2 - two parallel stacks

| Purpose | What it is |
|---|---|
| Dissemination | The four thematic aggregated items (`499917f1...`, `1b006938...`, `71460258...`, `fbef5b1e...`), their four archived twins, and the microdata items (`2d15e5b7...`, `f1d017ac...`) |
| Dashboards | `diem_adm_repr_{1..4}_mview`, `diem_master_table_202210/FeatureServer/20`, `DIEM_dashboard_pie_charts/20`, `diem_master_mview_histogram/43` |

Two copies of the same evidence on different refresh paths. A user can read a
number in a dashboard and download a different number for the same admin unit
and round.

### V3 - already collapsed into one tier

`hh_survey_v3` Phase 5 (`publish_agol_tables.py`) publishes into AGOL folder
`HH infrastructure 3.0`, **Query capability only**:

- 20 `_mview_noshape` aggregation tables (adm0/adm1/adm2/adm_repr x 5 thematic layers)
- 2 household projections (core + optional), joined on `survey_id` + `hh_id`
- 5 aggregate-only focus tables, the long crop-sales aggregate, the focus
  registry, the optional-question manifest

22 of the 30 services in the contract are implemented. Aggregate, manifest,
registry, catalogue and boundary services are public; the two household
projections are shared only with the DIEM Community household group. Phase 6 -
the dashboards - reads exactly these services.

## 2. Is a dissemination view necessary?

**Yes, but for sharing separation, not for enforcement.** The distinction
matters because it decides how much work Phase B is.

- A view does **not** stop extraction. The aggregation services must stay public
  for the dashboards to query them anonymously, and a public service is
  extractable by anyone who reads the network tab. That is accepted.
- A view **is** required the moment the download item's sharing must differ from
  the dashboard item's sharing. One item cannot be simultaneously public (so the
  dashboard can query it) and community-only (so its ArcGIS item page and Hub
  dataset route are not anonymously downloadable). A view is the only way to
  have both, because it is a separate item ID with its own sharing.
- The view also carries the **publication metadata** the infrastructure table
  should not have to carry: dissemination title, description, licence, thumbnail,
  field aliases, categories, update cadence - all changeable without touching
  what the dashboard depends on.

Since no field hiding is required, each dissemination view is a 1:1 pointer over
its source table, differing only in sharing and metadata. Cheap to create, and
the whole point is that it can be re-scoped later without a dashboard regression.

**The account gate itself lives in the Hub UI**, as it does today: sign-in before
explore or download. That is the honest boundary and it is unchanged by whether a
view exists.

### Best practice, restated

1. **One physical source per (generation, thematic layer, admin family).** Never
   a dissemination *copy*. Views are pointers; copies drift.
2. **Create a view only for sharing separation, publication metadata, or an
   ad-hoc grant.** Not for symmetry.
3. **Thematic grouping is presentation, not storage.** Group the 5 aggregation
   layers as themes in the Hub UI; do not rebuild the legacy four-table shape in
   the infrastructure.
4. **The download unit is a survey slice** - `(country, round, admin level,
   theme)` - not the appended global table.

## 3. Timing: build the page now, create the views later

Do **not** create V3 dissemination views or treat V3 item IDs as final yet.

`hh_survey_v3/docs/project_status.md` (2026-09-02): the whole stack is rebuilt
from scratch against the final questionnaire when the first real data arrives,
the rebuild trigger has not been met, and register items 2, 14 and 16 are open
schema changes. Phase 5 preserves item IDs **only** when hosted and staged
schemas match.

**Placeholder decision.** Until the views exist, the V3 manifest entries point at
the public Phase 5 source item IDs:

| Slot | Placeholder item |
|---|---|
| Income and shocks | `f6b197ea47bd4663aa0ccd10b4d4ea9d` |
| Crop production | `f6f876ca3a4d4108becd17da8247b78e` |
| Livestock and fisheries | `a313b15f51d34c2b8cb3516274461ec1` |
| Food security and needs | `a870f5dac1064aab806258e8c3bdd284` |
| Aggregated optional indicators | `4f1fd777958a4495bd2b4a5c024df779` |
| Household - mandatory | `fd3f8386f8dd40abaa6fdbc033580b65` |
| Household - optional | `877fb415ef4e4ef28967fa4b49670ee5` |

(Source: `DATA_ACCESS_CONFIG` in `hh_survey_v3/development/phase6_web_app/js/core/config.js`.)

**Hard constraint on the placeholders.** These services currently hold
*simulated* data (COD, NGA, TCD at round 99). Every V3 entry therefore carries
`preview: true`, which drives a per-card test-records flag and a section notice.
Downloads are live, which is acceptable only while the Hub is off production —
see section 4. Before any production cutover, either real data has replaced the
test load or those flags must still be set.

## 4. V3 as the reference, two archives beneath it

The information architecture is **not** three peer generations. It is one
reference generation, with two levels of archived data disclosed beneath it,
each carrying its own complete documentation set in an expandable section.

| Slot | Generation | Period | Documentation |
|---|---|---|---|
| Reference | V3 | 2026 questionnaire generation | published with the first V3 survey |
| Archive 1 | V2 | December 2022 - 2025 | current field descriptions, codebook, SDMX metadata |
| Archive 2 | V1 | before December 2022 | archived field descriptions and codebooks |

Definitions follow
`hh_survey_v3/development/phase6_web_app/docs/dashboard_user_guide.md` so the
Hub and the dashboards cannot contradict each other.

**Decided: V3 occupies the reference slot now.** Its Phase 5 services hold
simulated COD/NGA/TCD round-99 records, which is acceptable because the Hub is
not on production yet. Every V3 entry is marked `preview: true`, each card
carries a test-records flag, and the section carries a notice telling readers
not to cite the figures as survey results. Clear the flags when real data lands.

`REFERENCE_GENERATION` in `src/services/protectedData.ts` is the single value
that decides which generation holds the slot, so the arrangement can be changed
without a layout or component rewrite.

**Before production, verify** that no V3 preview flag survives into a production
build — a test figure presented as a survey result is the one failure this page
cannot afford.

Other rules:

- The comparability caution appears once, attached to the generation, not
  repeated per card.
- An archive is **expandable and collapsed by default**. Its data and its
  documentation live together inside it, so a user never has to reason about
  which codebook belongs to which period.
- A generation with no published items renders a **state**, not an empty grid.
- Every manifest entry gains `version` and `status`; aggregated entries also gain
  `thematicLayer` and `admFamily`.

## 5. Access model: three tiers

| Tier | Who | Sees |
|---|---|---|
| 1 | Anonymous | General instructions only: what data exists, what each generation is, and how to obtain access. No protected metadata is requested. |
| 2 | Enabled member of the DIEM community organization (`D5aXW6TZFpeM2wke`) | Everything in tier 1, plus aggregated data - explore and download - plus the full microdata licence text with the access-request form directly beneath it. |
| 3 | Tier 2 **and** member of the household-data group (`3f1e99b44e3e4107957de001a1242a70`) | Everything, including microdata explore and download. |

This supersedes the earlier suggestion that anonymous visitors browse the
aggregated catalogue. Anonymous is instructions only.

Rules that follow from it:

- **Tier is presentation; ArcGIS sharing is authorization.** The tier decides
  what a user is *offered*; every protected item is still resolved against the
  active identity, and a resolution failure is what actually withholds it.
  `deriveCommunityCapabilities` may order and label sections and must never
  authorize.
- **Tier 2 is derived from organization membership, not from the aggregated-data
  group.** Account creation auto-provisions privileges, so in practice the two
  coincide - but not for the first ten minutes or so. If the UI gated tier 2 on
  group `c8ae74a0f2de480abe6f72876a52b0cc`, a brand-new account would see the
  aggregated section vanish rather than fail informatively.
- **Handle the provisioning window explicitly.** When a tier-2 user's aggregated
  item resolves as `restricted`, do not show the generic "additional access
  required". Show that privileges take about ten minutes to activate after
  account creation, with a retry. This is the single most common "it does not
  work" report, and today's copy actively misleads on it.
- **Microdata licence sits at tier 2, not tier 3.** A user must be able to read
  the terms and the request form before having access - that is the point of
  showing them. The form goes immediately below the licence text.
- Administrative reference boundaries, API documentation and analysis tools sit
  at tier 2 with the aggregated data.

## 6. Microdata: three doors

1. **FAM (default, general users).** Anonymized DIEM microdata are published to
   the FAO Food and Agriculture Microdata Catalogue within about six months of
   the aggregated data being released on the Hub. The window is used for final
   editing, polishing and additional disclosure control before permanent open
   release. Keep the wording general; do not publish a precise SLA.
2. **DIEM Hub microdata items** for community members holding household-data
   access: current V2 (2023-present) and archived V1 (2021-2022), coded, with
   field descriptions and codebooks.
3. **Request form** for surveys not yet in FAM, when access is needed sooner for
   operational or research purposes. Keep linking the existing form as-is - it is
   a general request today. Country and round selection is a later change to the
   form itself, outside this repository; do not build Hub-side prefill until the
   form has those fields.

The published conditions, recovered from the legacy guide, must be carried over:
requests are evaluated within about two working days; access is granted in
exceptional and justified cases, to institutional email addresses; permission is
valid for a week and extendable.

**Licence placement.** The full microdata licence - confidentiality, research and
statistical use only, no commercial requesters, no redissemination, report
inadvertent disclosure - is rendered in full on the page at tier 2, with the
request form immediately beneath it, so the terms are read in the same movement
as the request. No separate acceptance checkbox: the form is the acceptance
point, and the conditions are restated in the grant.

**Fulfilment is internal and stays off the site.** When a request is approved the
team creates a temporary hosted view with a `viewDefinitionQuery` on
`adm0_iso3` + `round`, shares it to a content group with a single member, and
revokes it on expiry. Prototype tooling:
`C:\git\AGOL_mgmt\scripts\AGOL_create_layer_views.py`,
`AGOL_create_view_from_layer.py`,
`AGOL_revoke_access_to_old_microdata_users.py`. The procedure is not finalized,
is not described on the Hub, and needs no Hub feature: the granted user receives
the item link directly. Revisit only if the team later wants the grant to surface
inside `/data`.

## 7. Dashboard to Hub deep-link contract (concrete gap)

The dashboard's Data access modal builds legacy Hub URLs:

```
https://data-in-emergencies.fao.org/datasets/<itemId>[_0]/explore?filters=<base64 {round, adm0_iso3}>
```

Hub 3.0's `/data/:datasetId` holds filters in local `useState` with **no URL
state**, so none of those links survive the migration.

1. Add URL state to `DatasetExplorer` - `?country=ISO3&round=N`, resolved against
   the layer's country/round fields, existing filter UI unchanged.
2. Repoint `DATA_ACCESS_CONFIG.hubDatasetRoot` in `hh_survey_v3` to the Hub 3.0
   route, and settle how the new route addresses layers (the `_0` suffix).

This is the highest-value small change on the page: it is what makes "explore it
in the dashboard, download exactly what you saw" true.

## 8. One guide, on the new Hub

**All of this lives in the website. No PDF.** The legacy guides (`3acfbae8...`
EN, `f24f986b...` FR) are retired outright rather than kept as parallel
downloads - they document the old Hub's download flow screen by screen, and a
downloadable copy is exactly how the two guides would drift apart again. Their
substance is largely still valid and is carried across into the page. The Hub
owns this guide; the dashboard links to it instead of restating it. Translation
is deferred, so the page ships in English first.

Proposed structure, merging the legacy guide's table of contents with what is new:

1. **What DIEM is** - programme, coverage, DIEM-Monitoring overview.
2. **Three data infrastructures** - V1, V2, V3: periods, what changed, what is
   comparable, where each one's data and metadata live. *New; this is the section
   that did not exist before and is the main reason for rewriting the guide.*
3. **Data accessibility** - who can access what, account creation, the ~10-minute
   privilege activation, aggregated to ADM1/ADM2 for any account.
4. **Aggregated data** - thematic areas, admin levels, release cadence
   (aggregated datasets available roughly three weeks after collection), how to
   filter and download in Hub 3.0.
5. **Microdata** - the three doors in section 6, coded format, codebooks,
   labelling tools.
6. **Metadata and documentation** - field descriptions, codebooks,
   questionnaires (template Kobo and GeoPoll, plus survey-specific), SDMX
   metadata, survey-specific methodologies, food security indicators.
7. **Administrative reference boundaries** - current and archived, pcode
   traceability.
8. **Methodology notes** - sampling and stratification, weighting
   (`weight_base`, `weight_quota`, `weight_wealth` -> `weight_final`), precision,
   skip patterns and why an empty field means "not eligible", Yemen HFM, the
   aquaculture sub-sample caveat.
9. **API** - endpoints, the notebook repository, token handling.
10. **Citation** - the generic Hub citation in English, French and Spanish. The
    per-country "assessment results" variant from the legacy guide is dropped;
    one form, consistently applied.
11. **Licensing** - aggregated (CC BY 4.0 + FAO Statistical Database Terms of
    Use) **and microdata**, which is a different and stricter regime.

**Gap worth naming:** the current `/data` page publishes only the aggregated
CC BY 4.0 licence. The legacy guide's **microdata licence** - confidentiality,
research and statistical use only, no commercial requesters, no
redissemination, report inadvertent disclosure - is absent from Hub 3.0
entirely. It must be restored before microdata download is offered.

Route: `/data/guide`, a dedicated page rather than expandable blocks inside
`/data`. Reason: `/data` is a workspace people return to in order to *act* -
filter, explore, download - while the guide is read once, linked from elsewhere,
and cited by the dashboard. Burying it in accordions inside the workspace makes
both jobs worse, and it needs its own shareable URL. `/data` keeps short
contextual pointers into the relevant guide sections.

The guide itself is public. It contains no protected metadata, it is the thing a
tier-1 anonymous visitor most needs, and it is what should be indexable.

## 9. Sections that stay, permanently

Aggregated data, microdata, administrative reference boundaries, documentation
and metadata, API and analysis tools, citation, licensing (both regimes). Added:
questionnaire generations.

## 10. Phasing

**Phase A - implemented 2026-09-03**

1. Version model and manifest refactor in `src/services/protectedData.ts`
   (`version`, `status`, `thematicLayer`, `admFamily`; existing item IDs unchanged;
   V3 slots filled with the section 3 placeholders, all marked `placeholder`),
   plus the single configuration value that names the reference generation.
2. `/data` restructured: reference generation first, archives expandable and
   collapsed, section list per 9.
3. Three access tiers per section 5, including the ten-minute provisioning
   message replacing the generic restricted copy.
4. Microdata block: FAM default with the general six-month wording, full licence
   text at tier 2, the existing request form as-is directly beneath it, and the
   request conditions from section 6.
5. Explorer URL state (`country`, `round`) and the documented deep-link contract.
6. `/data/guide` - public, English, full content per section 8. Retire the PDF
   links.

**Phase B - when the V3 rebuild lands**

1. Create one dissemination view per published V3 table: 1:1 pointer, no field
   hiding, community sharing, publication metadata.
2. Replace the placeholder item IDs with the view item IDs and clear `placeholder`.
3. Publish V3 field descriptions, codebook and SDMX metadata items.
4. Flip the reference generation to V3; V2 drops into archive beside V1.

**Phase C - microdata grants (internal, not a Hub feature)**

1. Country and round selection added to the request form.
2. Productionise create-view / one-member-group / revoke-on-expiry.

**Phase D - unchanged**

The DIEM-owned asynchronous export service in `docs/data_access.md`, which
removes the legacy Hub generator and the 20,000-record cap.

## 11. Settled, and what remains

Settled on 2026-09-03: everything in the website with no PDF, translation
deferred; full microdata licence at tier 2 with the request form beneath it;
generic citation only; dedicated `/data/guide` route; V3-first architecture with
two archives; the three access tiers in section 5.

Also settled: aggregated items are shared to group
`c8ae74a0f2de480abe6f72876a52b0cc` (so the provisioning notice is warranted);
boundaries sit at tier 2 and are named on the anonymous page; V3 is announced as
the new standard from the 2026 questionnaire revision, with all surveys from Q3
2026 flowing through it.

Remaining:

- **Authenticated acceptance test.** The tiered workspace has not been exercised
  with a real account. It needs one run per tier: a brand-new account inside the
  provisioning window, a community member without microdata access, and a
  household-data group member. In particular, confirm that the V3 Phase 5 items
  resolve through the community portal REST endpoint the way the older items do.
- **Guide ownership.** Who maintains `/data/guide` once the dashboard links to it
  rather than restating the same material in `dashboard_user_guide.md`.
- **Dead CSS.** The retired guide-language panel, collection switch and access
  pathway rules are still in `src/data-access.css`.
