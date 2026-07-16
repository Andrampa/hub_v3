# Service Manifest

## Rules

- Public calls use HTTPS and `f=json`.
- Search by stable group ID.
- Paginate until the returned `total` is covered.
- Do not add secrets to source or environment variables exposed to Vite.

| Purpose | Method and endpoint | Authentication | Runtime use |
|---|---|---|---|
| Group metadata | `GET /sharing/rest/community/groups/{groupId}` | None for public group | Initial load |
| Group items | `GET /sharing/rest/search?q=group:{groupId}` | None for public items | Initial load, paginated |
| Country group items and categories | `GET /sharing/rest/content/groups/{groupId}/search` | None for public items | Country routes, paginated |
| Thumbnail | `GET /sharing/rest/content/items/{itemId}/info/{thumbnail}` | None for public item | Lazy card image |
| Item page | `/home/item.html?id={itemId}` | ArcGIS handles it | External fallback link |
| OAuth authorize/token | `/sharing/rest/oauth2/*` on `hqfao-hub.maps.arcgis.com` | OAuth client + PKCE | Interactive sign-in/account creation |
| Current user | `/sharing/rest/community/users/{username}` | Active user session | Post-login organization validation |

Portal origin: `https://www.arcgis.com`.
