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
| Protected data item | `GET /sharing/rest/content/items/{itemId}` on the community portal | Active community identity; ArcGIS item/group sharing | Authenticated `/data` workspace |
| Protected feature service and layer | `GET {item.url}` and `GET {item.url}/{layerId}` | Active community identity | Internal `/data/:datasetId` schema discovery |
| Filtered layer query | `GET {item.url}/{layerId}/query` | Active community identity | Record count, map/table preview, CSV and GeoJSON export |
| Packaged dataset export | `GET https://data-in-emergencies.fao.org/api/download/v1/items/{itemId}/{format}` with `layers` and `where` | Active community identity | Excel, Shapefile, KML/KMZ, File Geodatabase, GeoPackage and SQLite downloads |
| Dataset basemap | `https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}` and `.../World_Light_Gray_Reference/...` | Public | Interactive geographic context and labels behind filtered DIEM features |

Portal origin: `https://www.arcgis.com`.
