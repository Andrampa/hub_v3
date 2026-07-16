# Authentication

## Purpose

DIEM Hub 3.0 accepts ArcGIS accounts that are enabled members of the FAO Data in Emergency Community organization. Public catalog use remains anonymous.

## Fixed ArcGIS Configuration

- OAuth client ID: `7ZnjQhVHwjuYi1FM`
- Community portal: `https://hqfao-hub.maps.arcgis.com`
- Community organization ID: `D5aXW6TZFpeM2wke`
- Development callback: `https://localhost:5173/oauth-callback.html`

The client ID is public application configuration. No client secret belongs in this browser application.

## Runtime Flow

1. User selects **Sign in** or **Create account**.
2. ArcGIS REST JS starts authorization-code OAuth with PKCE in a popup.
3. ArcGIS shows the community organization login page. Its native **No account?** link creates an account in the same community.
4. `oauth-callback.html` completes the code exchange.
5. The app loads the signed-in ArcGIS user and requires `orgId === D5aXW6TZFpeM2wke` and `disabled !== true`.
6. A valid identity is retained in `sessionStorage` for reloads in the same browser tab.
7. Sign-out revokes the ArcGIS session where possible and always removes local session data.

The context exposes `requestProtected` for JSON requests and `downloadProtected` for binary export responses used by `/data`. Both closures retain the identity manager and token inside the provider; page components receive neither.

## Security Invariants

- Never accept a username, email domain, role, tag, or UI choice as proof of membership.
- Never expose or request an ArcGIS password or client secret.
- Reject accounts from FAO's employee organization and every unrelated ArcGIS organization.
- Let ArcGIS sharing and group membership authorize protected items; successful login alone does not grant item access.
- Do not request protected data metadata before authentication or render stale protected state after sign-out.
- Do not log serialized sessions, access tokens, refresh tokens, or OAuth callback query parameters.
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
