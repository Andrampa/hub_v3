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
a Community user. ArcGIS Online is one platform, not two portals: the FAO and
Community organization URLs are not separate Enterprise deployments and need no
second OAuth application. The recipient's exact Community username is invited to
the private FAO grant group as an external member, which the provisioning script
gates behind explicit `allow_external_user` approval, and accepting that
invitation is what makes the FAO-owned items reachable.

Discovery therefore starts from **group membership**, which is the fact the whole
feature turns on. `src/services/microdataGrants.ts` reads
`/community/self` on the global AGOL endpoint
`https://www.arcgis.com/sharing/rest`, keeps only groups carrying the exact tag
`DIEM restricted microdata grant`, reads each of those groups' content, and keeps
only items carrying the exact tag `DIEM restricted microdata`. This asks ArcGIS
directly rather than an index, which is what makes it dependable for externally
shared, freshly created private items.

A global authenticated search for the same item tag runs alongside it as a
**supplement**, unfiltered by organization. Its results are merged, deduplicated
by item ID, and put through exactly the same re-resolution. It is not the
primary path: a cross-organization search over a private item depends on index
timing the Hub does not control. `GrantDiscovery.source` records which path
produced the candidates (`groups`, `search`, `groups+search`) so the live test
can tell whether the search branch contributes anything at all.

A group-path failure is reported to the user; a search-path failure is not,
because the feature never depended on it. Neither path is an authorization
decision — discovery only narrows what is asked about, and ArcGIS answers.

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

## The invitation, and the gap it leaves

Between approval and acceptance a recipient holds nothing. ArcGIS gives them no
membership until they accept the invitation themselves, so discovery correctly
returns empty and the Hub would otherwise show them the same nothing it shows
everybody else — while the only clue sits in an ArcGIS notifications page most
DIEM recipients have never opened.

`src/services/microdataGrantInvitations.ts` reads the signed-in user's own
pending invitations (`/community/users/<username>/invitations`, scoped by ArcGIS
to the caller) and `src/components/MicrodataInvitationDialog.tsx` presents them.

It is a **modal**, not a banner. The first version was a thin strip under the
header, and it was the wrong shape for the situation: a recipient losing a day
of a seven-day window to a notice they scrolled past has been failed by the
interface, not informed by it. The dialog is styled as an important action
rather than an error — blue frame, one amber warning panel — because an
approved grant is good news that happens to arrive on a clock.

Two states, and the difference matters:

- **Confirmed.** The invitation's group carries the exact
  `DIEM restricted microdata grant` tag. The dialog names the grant and offers
  **Accept invitation and open data**, through the documented per-user accept
  operation on the user's own token. On success it closes, shows a success
  notice, and navigates to `/data#temporary-microdata`; the grants section
  scrolls itself into view once discovery has produced the bundle, so the button
  ends where it promises.
- **Unverified.** The group cannot be read before joining it, so the dialog
  offers **Open ArcGIS notifications** and no acceptance control of any kind. A
  group title is not a fact about who created the group, and the Hub never
  infers a grant from one. Returning to the Hub re-reads invitations, membership
  and grants on window focus, so acceptance in ArcGIS lands here without a
  reload.

**Remind me later** closes the dialog for the current visit only. It is held in
React state and written nowhere: a dismissal on disk would go on hiding a live,
expiring grant on every later visit, and the recipient would never learn why
nothing arrived. A header indicator stays for the rest of the visit and reopens
the dialog, and the next authenticated visit shows the dialog again while the
invitation is still pending. An accepted, withdrawn or expired invitation
removes both.

Accessibility: `role="dialog"`, `aria-modal`, `aria-labelledby` and
`aria-describedby`; focus moves to the dialog on open, is trapped while it is
open and restored on close; Escape closes it like Remind me later; the warning
carries an icon and the words "Time limited" so it never depends on colour; and
the entry animation is behind `prefers-reduced-motion`. The dialog is
nearly full-screen below 640 px.

The accept call is sent over **POST**, which is the only method the ArcGIS
operation takes. `requestProtected` accepts a per-call `method` and defaults to
`POST`, which is what every caller already sent; GET is never the default,
because the ArcGIS SDK encodes parameters — the token among them — into the
query string for GET requests.

Acceptance is confirmed, not assumed. The Hub raises the access-change event
only when all of these hold:

1. `success` is exactly `true`;
2. every field ArcGIS echoed matches the invitation that was sent, ignoring
   case. The documented response is
   `{"success": true, "id": …, "username": …, "groupId": …}`, so the invitation
   is checked against `id`; `invitationId` is tolerated as an undocumented alias
   and checked when present, but it is never what the Hub expects;
3. the membership itself reads back from `/community/self` as this user in that
   group.

Check 3 is what actually proves the group and the user, so a genuine response
that omits the echoed fields still succeeds while a hollow one does not.

A new membership does not always appear on `/community/self` immediately, so a
`not yet` answer — and a failed read — is retried on a fixed, bounded schedule
of 250 ms, 500 ms and 750 ms: four reads over at most a second and a half. That
covers propagation without inventing anything, because the event still waits for
ArcGIS to say the user is in the group.

Two answers are refused outright rather than retried, since waiting cannot make
them trustworthy: one naming a different user, and one naming nobody at all. An
authenticated `/community/self` always identifies its caller, so a response
without a username is malformed, and a malformed answer must never be read as
agreement.

Anything missing, malformed or mismatched leaves the notice standing and sends
the user to ArcGIS: whether an invitation was accepted is ArcGIS's to confirm,
never the Hub's to declare.

Acceptance grants nothing by itself: it establishes the membership ArcGIS then
uses to decide what the identity may read. On success the module raises the
`onGrantAccessChanged` event, the `/data` grants section re-runs discovery, and
the grant appears in the same visit. Returning from the ArcGIS tab re-checks on
window focus, so accepting there clears the notice too. Nothing about
invitations is stored.

The Hub never adds anyone to a group, never invites, never uses an
administrator token, and has no management interface. Approving, provisioning,
suspending and expiring grants remain FAO Management operations in the Python
scripts.

## The access window runs from issuance

Seven days, counted from when the invitation was **issued**. Acceptance does not
start the clock and accepting late does not extend it, so a recipient who
accepts on day five has two days rather than seven. A daily backend worker
deletes the temporary views and the grant group when they fall due.

This reverses an earlier ArcGIS policy under which the window began at verified
acceptance, and any Hub copy still saying "access starts when you accept" is now
a promise the platform does not keep. The wording lives in
`INVITATION_ACCESS_WINDOW_NOTE` and `UNCONFIRMED_INVITATION_NOTE` in
`src/services/microdataGrantInvitations.ts`, stated once and covered by tests, so
the policy cannot drift back into the interface unnoticed.

**No exact date is displayed, deliberately.** The end date lives in the private
registry, which the browser must never read, and the ArcGIS invitation response
carries no timestamp this Hub would trust as policy. A date rendered from a
guess is worse than no date at all, because a recipient would plan their work
around it. The notice gives the fact that is both true and actionable instead:
the clock is already running, so accept now.

The Hub therefore calculates nothing, counts down nothing and enforces nothing.
The ArcGIS items and the group remain the authorization boundary: when the
worker deletes them, the views stop resolving and the grant disappears from the
workspace on the next check, exactly as a revocation already did. Expiry needs
no separate handling in this codebase because it is indistinguishable, from the
browser, from any other withdrawal of access.

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

Validation is strict, and every failure drops the item rather than guessing —
showing the wrong generation or the wrong scope beside real microdata is worse
than not listing it:

- `schemaVersion` must be one this Hub reads (`1`). A later provisioning release
  may change what the fields mean, and reading it as though it were this one
  could misstate the approved scope.
- `grantId`, `component` and `questionnaireVersion` must all resolve.
- The component must be one that version actually produces: `legacy` for V1 and
  V2, `core` or `optional` for V3.
- `surveyScope` must contain at least one valid `(adm0_iso3, round)` pair. A
  managed block carrying none is incomplete, not unrestricted.

The tag fallback is exempt from the scope rule, because a search-result
candidate has no `properties` block to carry one; it is re-read from the full
item, which does, before anything is displayed.

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
FAO Management members. The Hub shows only active versus unavailable, which it
derives from ArcGIS rather than from a clock.

An exact expiry date is not a missing feature waiting on plumbing. Displaying
one would require a trustworthy server-side projection of the private registry,
and the registry is private precisely because it carries recipients, approval
references and deadlines. Since the seven days run from issuance and the daily
worker removes access on time, a countdown would add nothing the notice does not
already say, at the cost of a new path out of the registry.

## Tests

`npm test` (Vitest; the grant suites are `microdataGrants.test.ts`,
`microdataGrantInvitations.test.ts` and `MicrodataInvitationDialog.test.tsx`) covers:

- Community login accepted, FAO organizational login rejected, disabled account
  rejected;
- the access matrix, and legacy-group access staying independent of grants;
- catalogue exclusion and exact tag matching;
- discovery through an externally owned group, exact group-tag selection, the
  supplementary search, merging both paths, and search failure being survivable;
- metadata validation: schema version, component/version agreement, required
  survey scope, and the tag fallback;
- V1, V2 and V3 bundle construction, multiple independent bundles across
  versions, and the V3 missing-documentation state;
- unauthorized and deleted items disappearing, and a revoked grant dropping on
  the next check;
- export controls derived from the ArcGIS `Extract` capability;
- invitation listing, ignoring non-grant groups, refusing to infer a grant from
  a title, and the in-page access-change refresh;
- acceptance sending POST, being impossible over GET against a method-gated
  endpoint, matching the documented `id` field and the `invitationId` alias, and
  rejecting missing, false, non-object, mismatched and membership-contradicted
  responses with no access-change event raised;
- membership confirmation retrying a not-yet-propagated membership on the exact
  bounded schedule, giving up after it, and failing closed without retrying when
  `/community/self` names nobody. The delay is injected, so the retry schedule
  is asserted rather than waited out;
- the access-window wording: seven days from issuance, accepting late not
  extending it, no date of any shape, and an explicit guard against the retired
  "access starts when you accept";
- no bundle or view carrying a field shaped like a deadline, and expiry reaching
  the Hub the same way revocation does — the item stops resolving;
- the dialog itself: both states and their primary actions, no acceptance
  control for an unverified group, "Remind me later" closing for the visit only
  while the indicator stays, the dialog returning on the next visit, the focus
  refresh, the success refresh and navigation, the invitation disappearing,
  dialog semantics, focus management, the focus trap, Escape, and that no
  dismissal is written to `localStorage` or `sessionStorage`.

All ArcGIS responses are mocked. No test performs a live ArcGIS call.
