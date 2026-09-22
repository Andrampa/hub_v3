import type { LayerSpecification, StyleSpecification, VectorSourceSpecification } from 'maplibre-gl'

// The dataset explorer's background: the FAO-customised ArcGIS vector style that
// draws the UN boundaries (UNEP-WCMC's republication of UN Geospatial's
// `UN_Basemap`) over the Esri World Basemap v2 land and water. The style is
// read at runtime, so a change made in ArcGIS reaches the Hub without a code
// change; `docs/service_manifest.md` lists every item it depends on.

export const BASEMAP_STYLE_ITEM = '58420c8cfe754b11ba4d9ecd07a62da0'
const STYLE_URL = `https://www.arcgis.com/sharing/rest/content/items/${BASEMAP_STYLE_ITEM}/resources/styles/root.json`

/** UN country names, carried by the style's UN source but hidden as authored. */
export const UN_LABEL_SOURCE_LAYER = 'Countries_Separated_with_associated_territories/label'

export const BASEMAP_ATTRIBUTION = 'Boundaries and names: United Nations Geospatial · Basemap: Esri'
/** The offline fallback draws only UN Geodata simplified. */
export const FALLBACK_ATTRIBUTION = 'Boundaries: United Nations Geospatial'

interface VectorTileServiceInfo {
  tiles?: string[]
  /** The deepest level the service has tiles for; MapLibre overzooms past it. */
  maxLOD?: number
}

/**
 * Makes the ArcGIS style readable by MapLibre and applies the Hub's one
 * editorial choice. ArcGIS gives vector sources only a service `url`, whose JSON
 * is not TileJSON, so each source gets explicit tiles and its real maximum
 * level. The UN country-name layers are shown, because the Hub labels countries
 * with UN names rather than Esri's. Nothing else in the authored style changes.
 */
export function prepareBasemapStyle(style: StyleSpecification, services: Record<string, VectorTileServiceInfo>): StyleSpecification {
  const sources: StyleSpecification['sources'] = {}
  for (const [id, source] of Object.entries(style.sources)) {
    if (source.type !== 'vector' || !source.url) {
      sources[id] = source
      continue
    }
    const info = services[source.url] || {}
    const template = info.tiles?.[0] || 'tile/{z}/{y}/{x}.pbf'
    const { url, ...rest } = source as VectorSourceSpecification & { url: string }
    sources[id] = {
      ...rest,
      tiles: [/^https?:/.test(template) ? template : `${url.replace(/\/$/, '')}/${template}`],
      ...(typeof info.maxLOD === 'number' ? { maxzoom: info.maxLOD } : {}),
    }
  }
  const layers = style.layers.map((layer): LayerSpecification => {
    if (!('source-layer' in layer) || layer['source-layer'] !== UN_LABEL_SOURCE_LAYER || layer.type !== 'symbol') return layer
    return {
      ...layer,
      layout: { ...layer.layout, visibility: 'visible' },
      // Authored without colour; set to sit quietly on the light basemap.
      paint: { 'text-color': '#4d5c62', 'text-halo-color': 'rgba(255,255,255,.85)', 'text-halo-width': 1, ...layer.paint },
    }
  })
  return { ...style, sources, layers }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.json() as Promise<T>
}

export async function loadBasemapStyle(signal?: AbortSignal): Promise<StyleSpecification> {
  const style = await getJson<StyleSpecification>(STYLE_URL, signal)
  const serviceUrls = [...new Set(Object.values(style.sources)
    .flatMap((source) => (source.type === 'vector' && source.url ? [source.url] : [])))]
  const services = Object.fromEntries(await Promise.all(serviceUrls.map(async (url) =>
    [url, await getJson<VectorTileServiceInfo>(`${url}?f=json`, signal)] as const)))
  return prepareBasemapStyle(style, services)
}
