# Microdata access restructure

Planned rework of how household microdata is served in `/data/surveys`, so it
follows the survey-first shape already built for aggregated data: choose
surveys, review, download one package with its documentation.

This is a plan. Master and grant survey discovery and a separate, bounded
archive-builder prototype are implemented. The picker, review, download action
and live package-memory acceptance are not. The aggregated equivalent is
`docs/data_access_restructure.md`; this document states only what differs, and
inherits the rest.

## 1. What changes

Today the microdata tab is a route explainer. It names FAM as the default route,
the request form as the exception, lists the generation-wide household
collections as dataset cards, shows any temporary grants, and carries the full
licence. There is no survey picker and no package.

After this change a user who holds microdata access selects surveys from a list,
chooses which V3 components they want, reviews what will be built, and downloads
one archive. A user who holds nothing sees what they see today, unchanged.

## 2. Decisions taken

Recorded 2026-09-22, because each was contested during planning.

| Decision | Answer |
|---|---|
| Documentation in packages | **Version-matched links**, not embedded files. Same contract as aggregated packages. |
| Does a private grant bypass `opendata = 1`? | **No.** Contributors bypass it, because they may also see non-validated data. Every other account - household-data group or temporary grant - gets validated data only. |
| Bulk download from the master layers | **Yes**, per-survey extracts from the generation-wide layers, for accounts authorized to see them. |
| V3 mandatory and optional | **Two CSVs**, never auto-joined. |
| Survey cap | **Ten surveys per microdata package for every role, including Contributors.** Household volume and disclosure risk differ from aggregate packages, whose Contributor cap is unlimited. |
| Missing selected V3 optional component | **Block the entire package.** Do not silently omit a table the user requested; offer mandatory-only or a smaller selection instead. |

The grant decision does not change grant policy: Contributors bypass the row
gate; other viewers require `opendata = 1`. For the V1/V2 master items, that
restriction is enforced by their ArcGIS view definitions, which hide the field.
The resource manifest declares those two views explicitly.

## 3. Non-negotiables inherited

- ArcGIS item and view sharing is the authorization boundary. The Hub authorizes
  nothing; every item is re-resolved with the user's identity before it is
  listed and again before any export.
- The two access paths never feed each other. `capabilities.householdData` is
  not read to decide whether to show grants, and a grant is not read to decide
  whether to show master layers. See `docs/temporary_microdata_grants.md`.
- The grants section renders nothing at all when there is no grant. No empty
  state. An absence is not announced.
- The full microdata licence is present wherever download is offered, at the
  download point. Since 2026-09-25 (requested by the product owner) the package
  download sits in a final "Download" step directly under the review: the full
  licence is in a collapsed disclosure, and the always-visible download button
  stays disabled until the user checks "I have read the microdata licence and
  accept its conditions" inside it. Acceptance lasts for the page visit and is
  not stored; switching accounts clears it. After acceptance closes the
  disclosure, keyboard focus moves to the download button when the access
  check is complete. The button's hint describes checks in progress and errors.
- No account name or token-bearing URL is written into an archive. Protected
  rows belong only in the authorized CSVs inside that archive; never put them
  in browser storage, logs, URLs or the manifest.
- Test and production surveys can never be in the same package.

## 4. Access and discovery

Two sources, resolved separately and merged only for display.

**Master layers.** `MICRODATA_RESOURCES` in `src/services/protectedData.ts`: one
V2 item, one V1 item, and two V3 items. Discovery reuses the existing mechanics -
`discoverSource` and `fetchDistinctSurveys` in `src/services/surveyAccess.ts`
are already generic over a `ProtectedDataResource` and already branch on
`resource.kind` for visibility.

Reuse the mechanics; do not widen the aggregated entry point.
`discoverAggregatedSurveys` filters to aggregate resources, applies the
validated-survey register and keys an aggregate-specific cache. Extract the
shared parts and give microdata its own entry point with its own policy and its
own cache key, rather than making one function ambiguously generic.

**Grants.** `src/services/microdataGrants.ts` stays exactly as it is. Grants are
per-user filtered views scoped to approved `(version, country, round)` triples,
not generation-wide layers holding many surveys, so they are discovered by group
membership and item tag, not by distinct-value queries. `GrantBundle.surveyScope`
already yields the survey identities the picker needs.

Grant scope is approval metadata, not proof that the viewer can currently query
rows. For each scoped survey and component, confirm at least one matching row
under the same register and `opendata` gates used by the explorer. A scoped
survey with no visible rows is withheld or empty, not downloadable merely
because its identity occurs in the grant metadata.
Use a one-row query for this discovery check; count the selected components
only during preflight. Keep grant issues attributable to the item and survey:
unreadable item, changed grant, missing fields, and failed visibility query are
not the same state. Cancellation is not a grant failure.

**Merging.** A survey may be reachable by both paths. Resolve deterministically,
without asking the user: prefer the narrower active grant when its row scope
covers the survey and `bulkExportEnabled` is true; otherwise use the
independently authorized master source. Record which source authorized each
download in the manifest.

**Visibility, per the decision above.** For a non-Contributor, both gates apply:

- Survey level: only surveys whose register row is `round_validated = Yes`
  (`fetchValidatedSurveyKeys`, `src/services/monitoring.ts`).
- Row level: `opendata = 1` in the visible layer, or the same restriction
  enforced by an explicitly declared ArcGIS view definition.

A Contributor gets neither gate. An unflagged microdata layer without an
explicit `releaseFiltered` declaration still **fails closed** for everyone
else. The declaration is limited to the two V1/V2 master items whose view
definition filters `opendata = 1`; it is not inferred from the missing field.

**States.** Four, and they are different facts: nothing available; available;
withheld (the source carries no flag, so a non-Contributor sees none of it);
and could not be checked. Only the last offers a retry.

## 5. Selection

Surveys are the unit, exactly as for aggregates. The row shows country, round,
questionnaire generation, collection period where the register knows it, and
which source authorizes it.

- Up to **ten surveys in one package**. This is a usability guardrail, not a
  control, and must be worded as one. It protects nothing: an authorized user
  can query the same views directly. Saying otherwise would misrepresent a
  limit on sensitive records as a safeguard.
- Microdata selection is stored separately from aggregated selection, under its
  own account- and scope-scoped key, holding **only stable survey keys and a
  schema version** - never grant item IDs, never resolved permissions. Restored
  selections are revalidated against fresh discovery, and anything that no
  longer resolves is dropped with the removal stated.
- Selection clears on sign-out or loss of access.

## 6. The V3 component choice

V1 and V2 have one microdata table each, so there is no control to show. V3 has
two items - mandatory `fd3f8386f8dd40abaa6fdbc033580b65` and optional
`877fb415ef4e4ef28967fa4b49670ee5`.

- Default: **mandatory fields**.
- Offer **mandatory and optional** only when both components resolve as
  authorized for that survey. An unresolved optional view is not an empty
  optional table, and must never be presented as one.
- In a mixed-generation selection, label the control as V3-specific so nobody
  reads it as applying to their V2 surveys.
- The two tables are written as two CSVs and are **never joined**. The optional
  table covers a different row population - asked only in selected surveys - so
  joining would manufacture nulls indistinguishable from non-response. The
  `survey_id + hh_id` join is documented in the package metadata instead.

## 7. V3 is test data, and that decides its audience

Both V3 microdata items carry `preview: true`: simulated records published for
infrastructure review. Under the existing rule in `data_access_restructure.md`
section 5, test surveys reach the picker only in test-data mode, which is
**Contributor-only** - every test survey is `opendata = 0`, so for anyone else
the mode would open onto an empty list.

So V3 microdata packages are Contributor-only today, by the existing policy and
with no new decision. They carry `TEST_DATA` in the archive name, every
directory name and every CSV name, and cannot share a package with production
surveys. Clear the `preview` flag when real V3 data replaces the test load.

## 8. Package contract

A separate contract from the aggregated one. Microdata is not aggregated data
with different rows: different licence, different permissions, different volumes.

```text
DIEM_microdata_2026-09-22.zip
├─ README.txt
├─ manifest.json
├─ LICENCE.txt              microdata terms, not CC BY 4.0
└─ NGA_R08_v2/
   ├─ survey.txt
   ├─ data/
   │  └─ NGA_R08_v2_household.csv
   └─ documentation_and_metadata.txt
```

A V3 survey folder holds `..._household_mandatory.csv` and, when chosen,
`..._household_optional.csv`.

- **One folder per survey. No combined layout.** The aggregated
  combined-by-source option is deliberately not carried over. Merging household
  records from several surveys into one table is a different disclosure question
  from merging aggregates, and should be assessed on its own evidence if anyone
  asks for it.
- The generation appears in every directory and file name, so a V2 and a V3 table
  cannot be combined by accident once unzipped.
- `manifest.json` carries its own `package_schema_version`, independent of the
  aggregated manifest's. Per file: item ID, layer ID, item-modified timestamp,
  generation, component (`mandatory`, `optional` or `household`), the authorizing
  source (`master` or `grant`), row count, and the query endpoint and parameters
  stored separately. No token-bearing URL.
- `LICENCE.txt` is the microdata licence - confidentiality, research and
  statistical use only, no commercial requesters, no redissemination - not the
  aggregated CC BY 4.0 text.
- `README.txt` names every omitted survey and component with the reason, and
  states the V3 join explicitly.
- No account name in the archive.

### 8a. Coded and labelled values (`package_schema_version: 2`)

The picker offers **Coded values** (default), **Labels** or **Both**.

- Labels replace codes in the same columns: `..._labelled.csv` has the same
  field names, rows and row order as the coded file. Each page is fetched once
  and encoded into every requested output, so "Both" costs no extra requests.
- Labels come only from coded-value domains on the live layer schema. A null or
  empty value stays empty; a code with no domain entry stays as the raw code and
  is counted; a domain repeating a code with conflicting labels leaves that
  field coded. Range domains and fields without a domain pass through.
- **Gate.** `scripts/audit_microdata_domains.py` (read-only; ArcGIS Pro Python,
  `GIS("home")`) checks each master against its codebook (V1/V2), the V3 tables
  against each other, labels a spreadsheet could evaluate as formulas, and
  every grant view against its master. With `--write` it records a per-field
  SHA-256 domain digest for each passing component in
  `src/data/auditedDomains.json`. Preflight recomputes digests from the
  resolved schema: a master must be the audited item with every audited domain
  unchanged; a grant view may expose a subset of its master's fields but no
  changed or new domain. Any mismatch leaves labels unverified
  (`not_audited`, `domain_changed`, `view_differs`, `unsafe_label`) and refuses
  Labels/Both before any row is downloaded. Codes stay available. The picker
  disables Labels/Both outright for a generation with no audited component.
- **Mapping file.** Every survey folder has `value_labels.csv`
  (`component,item_id,layer_id,variable,code,label`) in every mode, listing only
  verified tables. An unverified table contributes no rows, so an unaudited
  mapping cannot be mistaken for a codebook; the README names it and why.
- **Manifest.** Top level: `values`, and `value_labels[]` with per-table
  `status`, `reason`, `basis` and `audited_at`. Per file: `values`
  (`coded`/`labelled`); labelled files add `label_source`, `labelled_fields`,
  `fields_without_domain`, `ambiguous_domains` and
  `unlabelled_codes: { field: { count, codes } }` (at most 20 sample codes).
- **Limits.** `sourceTables` (20) limits tables read; the review shows tables
  read and CSV files written separately. The 40 MB byte budget counts every CSV
  written, coded and labelled together, as chunks are encoded.
- **Digest parity.** `microdataLabels.test.ts` pins a SHA-256 test vector the
  Python script reproduces; change both together.

**Decision, 2026-09-25:** the ArcGIS domains are the authoritative labels; where
the V1/V2 codebooks differ, the codebook is out of date. The audit was re-run
with `--domains-authoritative`, which keeps codebook differences in the report
as warnings (basis `domains_authoritative`) while unsafe labels, conflicting
V3 tables and tables without domains still block. V1 (251 coded fields) and V2
(291) are recorded; V3 remains blocked with no domains. Fields without a domain
(e.g. `fcg`, `hhg`, `lcsi`, `rcsi_class`) stay coded in labelled files and are
listed under `fields_without_domain`.

First audit, 2026-09-25, against the codebooks (nothing recorded):

- V1 (251 coded fields) and V2 (291) are blocked by codebook differences:
  label wording (`fies_*_hhs`, `income_*`, `ls_*`, `crp_irrigation`), derived
  indicators with no domain (`fcg`, `hhg`, `lcsi`, `rcsi_class`), codes not in
  the codebook (`language`; V2 `fies_*_hhs` 888/999), `*_other` and
  `resp_is*producer` domains the codebook does not define, and an empty V2
  codebook label for `crp_storage` code 1.
- V3 mandatory and optional have **no** coded-value domains, so there is
  nothing to label from; the audit blocks tables with none.
- Both current grant views (V2) match their master, but carry no component
  tag or properties block, so the Hub does not list them.

## 9. Documentation in the package

Version-matched **links**, per the decision. Same fail-closed rule the
aggregated builder already uses: filter `DOCUMENTATION_RESOURCES` to the
survey's generation and to `audience` of `microdata` or `both`, and when none
exist, say so rather than pointing at another generation's codebook.

- V2: field descriptions `04287fcadb994341b0b70d19c8a02035` and microdata
  codebook `41fa55934d2f462f86cd381ee8dc1fda`.
- V1: archived field descriptions `e256f41d26ae4dc9b5906270a1116d33` and
  codebooks `e59d08ded7c1440587493bf65236cf44`, both `staticLink`.
- V3: **none published**. `DOCUMENTATION_RESOURCES` holds no V3 entry at all.
  A V3 package says so in the words already used for aggregates, and because V3
  is test data, this is a disclosed gap rather than a blocker. It becomes a
  release prerequisite when the `preview` flag clears: a production V3 package
  must not be presented as documented when it is not.

Embedding the actual files is out of scope and must not be promised. V1
documents and the V2 codebook live on other portals; `docs/data_access.md`
records that `staticLink` resources are never resolved against ArcGIS because a
cross-portal request manufactures a misleading failure state. If an offline
archive is wanted later, it starts by proving one cross-origin retrieval works,
as its own change.

## 10. Limits are measured, not inherited

The aggregated ceilings were set from a measured probe of aggregate tables. They
do not transfer: a single household table can hold far more rows than the
largest aggregate slice, and the aggregated builder holds every row in memory
before compressing.

Before any limit is written down, measure, with an authenticated account:

1. Row counts per survey and component for realistic V1, V2 and V3 selections.
2. Whether `fetchLayerRows` pagination is stable and complete at those volumes.
3. Representative extraction sizes and browser memory use. Once a prototype
   builder exists, measure peak memory for a ten-survey archive before enabling
   its download control.
4. The server export route's real ceiling. `downloadProtected` speaks the Hub
   Download API's 202-polling protocol, but it is single-item and
   `exportServerFormat` refuses above 20,000 records
   (`src/pages/DatasetExplorer.tsx`). It is a feasibility path to test, not an
   existing multi-survey packaging service.

Then set explicit microdata record and byte budgets from the measurements. If
realistic packages exceed what a browser can build, the answer is an authorized
server-side export workflow, not a button that routinely fails.

Keep from the aggregated builder: cancellation that terminates the compression
worker, staged progress, no partial archive on failure, and a final comparison
of downloaded rows against the preflight count. The prototype now encodes CSV
in bounded pages and checks encoded bytes as it goes, rather than first holding
every row in one array; compression and archive assembly still need measured
peak-memory validation before the UI enables download.

## 11. Preflight

As for aggregates, plus two microdata-specific rechecks immediately before
building:

- Re-resolve every selected item with the user's identity. A revoked grant or an
  unshared item removes its selection and explains itself without leaking what
  changed.
- Re-read `bulkExportEnabled` (the ArcGIS `Extract` capability). A grant approved
  without export keeps exploration and gets no package, worded as the policy it
  is rather than as a technical failure - the wording already used in
  `DatasetExplorer.tsx` is the model.

## 12. Build sequence

1. Initial row-count and extraction probes first (section 10). They can
   invalidate the proposed browser mechanism. Measure a ten-survey archive
   again after the prototype builder exists, before enabling its UI.
2. The V1/V2 master items are ArcGIS views with `opendata = 1` in their view
   definitions and that field hidden, as confirmed by their creator on
   2026-09-23. Declare those items release-filtered in the manifest; keep
   undeclared unflagged microdata sources fail-closed.
3. Extract the shared discovery mechanics from `surveyAccess.ts`; add a microdata
   entry point with its own policy and cache. Tested before any UI.
4. Merge master and grant survey lists for display, with the deterministic
   source rule.
5. Picker, selection storage, V3 component choice.
6. Review, preflight and the two rechecks.
7. `microdataBundle.ts` - its own builder, sharing `dataExplorer` helpers and the
   compression worker, not an option inside `surveyBundle.ts`.
8. UI integration, licence placement, states.
9. Docs: `data_access.md`, `temporary_microdata_grants.md`, `architecture.md`,
   `editor_guide.md` if the workflow changes, `changelog.md`, `handoff.md`.

## 13. Tests

No access; access-check failure; both paths and their overlap; the deterministic
source rule; revocation during download; export-disabled grant; the ten-survey
cap; V3 with and without the optional view; V3 optional unresolved versus empty;
zero rows; mixed generations; withheld unflagged layer; Contributor bypass versus
non-Contributor double gate; missing V3 documentation wording; pagination at
volume; cancellation; manifest counts matching CSV counts; and that no token,
account name or grant identifier reaches the archive or storage.

Then authenticated acceptance with three accounts: a household-data group member,
a temporary-grant holder with export enabled, and one with export disabled.

## 14. Open risks

- **V1/V2 master views hide `opendata`.** Checked in the signed-in
  explorer on 2026-09-22: V1 exposes 299 usable attributes and 187,400 total
  records; V2 exposes 354 usable attributes and 514,270 total records. Neither
  schema lists `opendata`. Their creator confirmed on 2026-09-23 that both are
  ArcGIS views defined with `opendata = 1`, with that field excluded. The Hub
  must trust only those explicit manifest declarations, not any unflagged
  microdata layer in general. Periodically verify the live view definitions;
  the Hub cannot enforce their hidden predicate client-side.
- **Live per-survey counts are measured, but not a maximum.** In the signed-in
  explorer, Nigeria V1 round 1 had 2,709 rows and Nigeria V2 round 8 had 5,025
  (2026-09-22). Additional 2026-09-23 checks: Yemen V1 round 4, 2,452; Yemen V2
  round 31, 3,300; Fiji V2 round 1, 1,300; Chad V1 round 2, 1,692; Chad V2
  round 10, 4,839. These are counts for country-and-round filters on the master
  tables, not a representative maximum or a ten-survey package test. All seven
  were under the explorer's existing 20,000-row single-extract ceiling.
- **V3 test components are much wider.** On 2026-09-23, simulated COD round 99
  returned 9,100 rows in each V3 component: 372 usable attributes in mandatory
  and 551 in optional. The optional choice would therefore write two full-width
  CSVs for that one test survey. These are preview records, not a production
  volume forecast; count equality alone does not verify household-key joins.
- **Package size and memory have representative probes, not worst-case bounds.** The browser builder may not be
  the right mechanism for every future household selection. On 2026-09-23,
  live browser probes measured Nigeria V2 round 8 at 3.6 MB CSV / 0.5 MB ZIP,
  V3 COD round 99 with both tables at 15.1 MB CSV / 2.2 MB ZIP, and ten
  production surveys at 19.3 MB CSV / 2.5 MB ZIP. Reported peak JS heap was
  approximately 57, 69 and 69 MB respectively. The enabled builder uses a
  conservative 50,000-record, 40 MB actual-CSV and 20-file ceiling; it aborts
  before archive creation if any ceiling is exceeded. These probes do not
  establish a maximum for future surveys or a low-memory device guarantee.
- **V3 documentation does not exist.** Disclosed while V3 is test data; a
  prerequisite once it is not.
