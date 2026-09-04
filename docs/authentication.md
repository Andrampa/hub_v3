# Authentication

## Purpose

DIEM Hub 3.0 accepts ArcGIS accounts that are enabled members of the FAO Data in Emergency Community organization. Public catalog use remains anonymous.

## Fixed ArcGIS Configuration

- OAuth client ID: `7ZnjQhVHwjuYi1FM`
- Community portal: `https://hqfao-hub.maps.arcgis.com`
- Community organization ID: `D5aXW6TZFpeM2wke`
- Development callbacks: `https://localhost:5173/oauth-callback.html` and `https://localhost:5174/oauth-callback.html`.

The redirect URI is always derived from `window.location.origin`, in development
as well as production. It must never be hardcoded to one development port. When
the page origin and the redirect origin differ — which is what a hardcoded port
produces as soon as Vite falls back to another port, or a second server holds the
usual one — the OAuth popup lands cross-origin to its opener and the SDK's
`postMessage` handshake fails with an opaque frame-access error that says nothing
about OAuth:

> Failed to read a named property 'dispatchEvent' from 'Window': Blocked a frame
> with origin "https://localhost:5173" from accessing a cross-origin frame.

Deriving the origin means the only remaining failure is an unregistered origin,
which ArcGIS reports plainly. Every development port actually used must be
registered as a redirect URL on the OAuth application; `127.0.0.1` is a different
origin from `localhost` and needs its own registration.

The client ID is public application configuration. No client secret belongs in this browser application.

## Runtime Flow

1. User selects **Sign in** or **Create account**.
2. ArcGIS REST JS starts authorization-code OAuth with PKCE in a popup.
3. ArcGIS shows the community organization login page. Its native **No account?** link creates an account in the same community.
4. `oauth-callback.html` completes the code exchange.
5. The app loads the signed-in ArcGIS user and requires `orgId === D5aXW6TZFpeM2wke` and `disabled !== true`.
6. A valid identity is retained in `sessionStorage` for reloads in the same browser tab. A tab opened later has no `sessionStorage` of its own, so it asks the tabs already open for the session over a same-origin `BroadcastChannel` before showing the sign-in gate, and adopts the first one offered. The token is still never written to `localStorage` or a cookie; when no other tab is open, the new tab signs in normally. A sign-out is announced on the same channel so no other tab keeps a revoked identity on screen.
7. Sign-out revokes the ArcGIS session where possible and always removes local session data.

The context exposes `requestProtected` for JSON requests and `downloadProtected` for binary export responses used by `/data`. Both closures retain the identity manager and token inside the provider; page components receive neither.

After organization validation, the Hub also derives the same cumulative access
capabilities used by the Monitoring application:

- Contributors (`ad13b87919464cb6b9bb6cd8defa0257`) receive analysis tools,
  aggregated-data access, and household-data access.
- Aggregated data (`c8ae74a0f2de480abe6f72876a52b0cc`) enables aggregate
  dataset entry points.
- Household data (`3f1e99b44e3e4107957de001a1242a70`) enables household
  microdata entry points.

These capabilities govern navigation visibility only. The destination dataset
still has to accept the active identity through its ArcGIS sharing settings.

On `/monitoring-system`, Contributor capability also expands only the survey
product library. Anonymous visitors and authenticated non-Contributors see
products explicitly linked to validated/published survey rows. Contributors
see links from published and current incoming rows and categorized monitoring
resources not yet linked from the survey configuration table. The arrival and
departure board remains public for every audience so forthcoming surveys stay
visible. Contributor catalog reads use the authenticated request boundary;
page components never receive the token.

The transitional ArcGIS Hub Download API is not an ArcGIS-federated feature-service hostname, so `downloadProtected` does not pass it to ArcGIS REST JS authentication. It follows the Hub v1 contract inside the provider: adds the short-lived ArcGIS token to same-origin Hub requests, follows documented `202` job-status responses, and never forwards that token to a different origin. Phase 2 removes this query-token transport together with the legacy Hub export dependency.

## Embedded Monitoring Dashboard Handoff

### Related repositories, domains, and release boundary

| Role | Local checkout / GitHub repository | Review origin |
|---|---|---|
| Hub source | `C:\git\hub_v3` / `Andrampa/hub_v3` | `https://fao-oer-review.web.app/` |
| Hub Firebase source | `C:\git\fao-oer-diem-hub` / `un-fao/fao-oer-diem-hub` | `https://fao-oer-review.web.app/` |
| Monitoring source | `C:\git\hh_survey_v3` / `Andrampa/hh_survey_v3` | n/a |
| Monitoring Firebase source | `C:\git\fao-oer-diem-monitoring-app` / `un-fao/fao-oer-diem-monitoring-app` | `https://diem-monitoring-review.web.app/` |

The Hub embeds the Monitoring production origin,
`https://diem-monitoring.apps.fao.org/`, by default. Review builds may opt into
the Firebase review origin with `VITE_MONITORING_DASHBOARD_URL`; the
origin-pinned handoff below automatically trusts only the configured iframe.

`https://data-in-emergencies.fao.org/` is the Hub production origin. A push to
either FAO Firebase repository updates review source only; it does not deploy.
The user manually runs each repository's **Manual Deploy** GitHub Actions
workflow on `main` with environment `fao-oer-review`. Do not trigger it unless
explicitly asked.

The Monitoring dashboard is served from a different registrable domain, so it
cannot see this Hub's `sessionStorage` session. Cookies are not a usable
transport: there is no shared parent domain, an iframe cookie would be a
third-party cookie (blocked or partitioned by current browsers), and the ArcGIS
SDK needs JavaScript read access so it could not be `HttpOnly`.

`MonitoringSystem` therefore hands the dashboard an ArcGIS token over the
origin-pinned `postMessage` bridge: the dashboard announces
`diem-monitoring:auth-ready`, the Hub replies with `diem-hub:auth` carrying
`{ portal, token, expires }`, and re-sends on every auth change and shortly
before expiry. `token: null` signals sign-out.

`embedCredential` on the auth context is a deliberate, narrow exception to the
rule that components never receive the token. Only `MonitoringSystem` may call
it, and only to feed this bridge.

- The target origin is derived from the configured dashboard URL and is always
  explicit, never `*`.
- The iframe's `contentWindow` is re-checked after the token is minted, so a
  frame that was replaced mid-flight never receives it.
- Only the token travels. The dashboard re-derives organization membership and
  group capabilities from `/community/self` itself; the Hub does not assert
  identity or capabilities to it.

## Security Invariants

- Never accept a username, email domain, role, tag, or UI choice as proof of membership.
- Never expose or request an ArcGIS password or client secret.
- Reject accounts from FAO's employee organization and every unrelated ArcGIS organization.
- Let ArcGIS sharing and group membership authorize protected items; successful login alone does not grant item access.
- Never infer Monitoring analysis or dataset capabilities from organization
  membership alone; use the recognized group memberships.
- Do not request protected data metadata before authentication or render stale protected state after sign-out.
- Do not log serialized sessions, access tokens, refresh tokens, or OAuth callback query parameters.
- Never place the ArcGIS token in the embedded dashboard's iframe URL, a cookie, or `localStorage`; the `postMessage` bridge is its only transport.
- Never place the token in any URL, including image `src` attributes. Protected item thumbnails are fetched with an `X-Esri-Authorization` header through `fetchProtectedImage` and rendered from an object URL.
- Cross-tab session handoff may use only same-origin, in-memory transport (`BroadcastChannel`). It must not introduce a new place the token is persisted.
- Never let the embedded dashboard assert who the user is; it receives a credential, not a claim.
- Account creation remains owned by the ArcGIS community organization.

## Deployment And Redirects

Redirect URLs must match registered OAuth credential URLs. Add a separate HTTPS staging callback before deployment. Add `https://data-in-emergencies.fao.org/oauth-callback.html` only as part of an approved production cutover. Adding a redirect does not change DNS or the current Hub; do not edit or reuse the current Hub OAuth application.

## Test Matrix

- Anonymous public access.
- Existing enabled DIEM community member.
- New DIEM community account created from the ArcGIS prompt.
- Account from the employee organization.
- Account from an unrelated ArcGIS organization.
- Disabled community account.
- Popup cancellation or blocking.
- Expired session restoration.
- Sign-out and reload.
- Protected item shared and not shared with the active community member.
