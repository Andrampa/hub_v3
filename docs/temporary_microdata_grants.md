# Temporary microdata grants

How the Hub presents user-specific, time-limited microdata access. The
provisioning side is documented in
`hh_survey_v3/management/data_sharing/HUB_USER_MICRODATA_HANDOFF.md`, which is
the operational authority; this file covers only what the Hub does with the
result.

## The three access concepts, kept separate

| Concept | Source of truth | What the user sees |
| --- | --- | --- |
| Legacy privileged access | Community group `3f1e99b44e3e4107957de001a1242a70` | The generation-wide master microdata layers, exactly as before |
| Temporary grants | FAO-owned filtered views, shared to a private single-recipient group | Their own approved surveys, and nothing else |
| Request-access products | The static V1/V2/V3 product entries | Descriptions and the request form |

These do not feed each other. A grant recipient is deliberately not added to the
legacy group, so `householdData` stays false for them and they are never offered
a master layer. Neither capability is read to decide whether to show the other.

The grants section renders **nothing at all** unless the signed-in account holds
at least one resolved grant — no empty state, no "you have no access" notice.
Most users have no grant and never will, since the ordinary route to microdata
is FAM or a request; announcing an absence invents a lack where there was no
expectation. It also means an expired or revoked grant leaves no trace behind.

## Authentication stays Community-only

The Hub signs users in against the Community organization `D5aXW6TZFpeM2wke`
and nothing else. There is no FAO login, no portal selector and no second OAuth
flow. Registering, approving, provisioning, suspending and expiring grants are
FAO Management operations performed with the Python scripts, outside the Hub, so
the Hub carries no administration UI at all.

## Cross-organization discovery

Grants are FAO-owned items (`sjP4Ugu5s0dZWLjd`) while the recipient signs in as
a Community user. The recipient's exact Community username is invited to the
private FAO grant group as an external member, which the provisioning script
gates behind explicit `allow_external_user` approval.

Because the two organizations differ, discovery cannot go through the Community
portal's own search. `src/services/microdataGrants.ts` queries the **global**
AGOL endpoint `https://www.arcgis.com/sharing/rest` with the user's Community
token and no organization filter, for `tags:"DIEM restricted microdata"`. ArcGIS
scopes the response to what that identity can already see.

If the search returns nothing, the module falls back to enumerating the user's
own groups, selecting those tagged `DIEM restricted microdata grant`, and
reading their content directly. This covers search-index lag on a freshly
provisioned grant. It is a discovery convenience only: both paths converge on
the same per-item re-resolution, so the fallback is never a second authorization
path.

> **Acceptance requirement.** Live cross-organization search has not been
> verified against a real grant. Acceptance requires a Community test account
> added as an external member of an FAO temporary grant group, checking that
> (a) the global search returns the FAO-owned views, and (b) an unrelated
> Community account gets nothing. Until (a) passes, the group-enumeration
> fallback is what makes the feature work.

## Authorization is ArcGIS, always

The Hub authorizes nothing. Every item is re-resolved against ArcGIS with the
user's own token before it is listed, again when its explorer route is opened,
and again immediately before any export. An item that stops resolving — because
the expiry worker deleted it, or a suspension unshared it — simply stops
appearing.

Consequently:

- A hand-typed `/data/grants/<item-id>` URL grants nothing. The route's checks
  are presentation; ArcGIS rejects the metadata and feature queries.
- Registry contents, usernames and organization membership are never used as an
  authorization input.
- Nothing is written to `localStorage`, `sessionStorage` or IndexedDB. Grant
  metadata lives in React state for the life of the page and is dropped on
  sign-out, so a revoked grant cannot survive a reload.

## Item metadata contract

The provisioning script writes both a `properties` block and tags. The Hub reads
`properties.diemRestrictedMicrodata` when present and falls back to tags, since a
search result may carry tags alone:

```json
{
  "schemaVersion": 1,
  "grantId": "request-2026-001",
  "questionnaireVersion": "v3",
  "component": "core",
  "surveyScope": [{ "adm0_iso3": "COD", "round": 12 }]
}
```

An item whose grant ID, component or questionnaire version cannot be determined
confidently is dropped rather than guessed at — showing the wrong generation or
the wrong scope beside real microdata is worse than not listing it.

Recipient identity appears nowhere in item metadata. It lives in the private
group membership and the private registry.

## Bundles

One bundle per `(grantId, questionnaireVersion)`.

- **V1 and V2** each produce a single `legacy` view over the same legacy master,
  so the component cannot separate them — the questionnaire version does. A
  request spanning V2 and V3 is two complete bundles, not one mixed list,
  because their field sets and codebooks are not interchangeable.
- **V3** pairs `core` and `optional`, which join on `survey_id + hh_id`.

Each bundle carries its own version's documentation from
`DOCUMENTATION_RESOURCES`. V3 documentation is not yet published, so a V3 bundle
renders an explicit "not yet published" state. V1/V2 documentation is never
substituted for it.

## Export policy

Bulk export is read from the ArcGIS `Extract` capability on the view — the
switch the provisioning script sets from `--allow-export`. When it is absent the
Hub suppresses download buttons, packaged-format requests and the bulk-download
scripts, and the explorer re-checks before any export that survived a stale tab.

The wording is deliberately **"Bulk export is not enabled for this grant"**, not
a claim that the data cannot be downloaded. The view is Query-enabled, so an
authorized technical user can still read it record by record. Disabling ArcGIS
export is a policy control, not an anti-extraction control, and the copy must
keep saying so.

## Catalogue exclusion

Provisioning no longer shares grant views with Hub content group
`ab8a43038b6347ac93507988f7e2a90b`, so in a correct deployment the ordinary
catalogue cannot see them. `catalogueVisible` in `src/services/arcgis.ts` filters
the tag out of both the catalogue and the country explorer anyway. That filter is
the check that survives a provisioning mistake: a view shared there by accident
would otherwise become a public-facing catalogue card for one recipient's
approved surveys.

## No registry writes from the browser

There is no secure Hub-to-registry adapter, and the Hub is a static SPA with no
backend. Access requests and all administration remain Python-script tasks for
FAO Management members. A future expiry-date or countdown display needs a secure
server-side projection of the registry; until that exists the Hub shows only
active versus unavailable, which it derives from ArcGIS rather than from a clock.

## Tests

`npm test` (Vitest) covers the access matrix, catalogue exclusion, metadata
parsing and its tag fallback, bundle construction across versions, discovery
including the group fallback and the failure case, expiry/revocation dropping
views, export-capability reading, and V3 source replacement after the Phase 5
rebuild.
