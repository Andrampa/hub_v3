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
| Hub-group visibility gate | `GET /sharing/rest/search?q=group:{countryGroupId} -group:{contentGroupId}` | None for public items | Country routes; returns only the curation gap, so the cost tracks violations rather than catalogue size |
| Monitoring homepage statistics | `GET {monitoringStatisticsUrl}/0/query` on `services5.arcgis.com` | None, query-only | Homepage figures: surveyed households, surveys, last publication date |
| Country editorial view item | `GET /sharing/rest/content/items/bfabf1dc1d354b3c92a3c801b0376452` | None | Resolve the current public FeatureServer URL |
| Country editorial tables | Public view tables `0` and `1` | None, query-only | Country introduction, imagery, and highlighted item IDs |
| Hub promotion view item | `GET /sharing/rest/content/items/{configuredPromotionViewId}` | None for public view | Resolve the configured production or staging FeatureServer URL |
| Hub promotion tables | Configured public view tables `0` and `1` | None, query-only | Programme slides and popup campaigns |
| Legacy popup item | `GET /sharing/rest/content/items/015a1eabdb454d1c90fd9ad282e407e6`, service definition, and discovered table `20` | None while public | Compatibility campaign fallback until promotion views are configured |
| Thumbnail | `GET /sharing/rest/content/items/{itemId}/info/{thumbnail}` | None for public item | Lazy card image |
| Item page | `/home/item.html?id={itemId}` | ArcGIS handles it | External fallback link |
| OAuth authorize/token | `/sharing/rest/oauth2/*` on `hqfao-hub.maps.arcgis.com` | OAuth client + PKCE | Interactive sign-in/account creation |
| Current user | `/sharing/rest/community/users/{username}` | Active user session | Post-login organization validation |
| Protected data item | `GET /sharing/rest/content/items/{itemId}` on the community portal | Active community identity; ArcGIS item/group sharing | Authenticated `/data` workspace |
| Protected feature service and layer | `GET {item.url}` and `GET {item.url}/{layerId}` | Active community identity | Internal `/data/:datasetId` schema discovery |
| Filtered layer query | `GET {item.url}/{layerId}/query` | Active community identity | Record count, map/table preview, CSV and GeoJSON export |
| Packaged dataset export | `GET https://data-in-emergencies.fao.org/api/download/v1/items/{itemId}/{format}` with `layers` and `where` | Active community identity | Excel, Shapefile, KML/KMZ, File Geodatabase, GeoPackage and SQLite downloads |
| World geometry (build time only) | `GET https://pro-ags2.dfs.un.org/arcgis/rest/services/Hosted/UN_Geodata_simplified/FeatureServer/{1,2}/query` (UN Geospatial, item `fa74ef8499094e41bf0d025006e37fc9`) | Public | `npm run build:boundaries` writes `src/assets/geo/un-world.topo.json`; no runtime request |
| Dataset basemap style | `GET /sharing/rest/content/items/58420c8cfe754b11ba4d9ecd07a62da0/resources/styles/root.json` on `www.arcgis.com`, then `{source url}?f=json` for each vector source | Public | Background of `/data/:datasetId` maps. Owner `Andrea.Amparore_hqfao` until moved to an institutional account |
| Dataset basemap tiles and resources | Esri `https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer` (tiles, fonts); UNEP-WCMC `https://tiles.arcgis.com/tiles/Mj0hjvkNtV7NRhA7/arcgis/rest/services/UN_Basemap/VectorTileServer` (UN boundaries, Abyei, UN names); sprite item `f114e97a90d84e43ad1b3f9a04256f88` (owner `Andrea.Amparore_hqfao`) | Public | Drawn by MapLibre; on failure the map uses the bundled UN Geodata simplified geometry |

Portal origin: `https://www.arcgis.com`.
