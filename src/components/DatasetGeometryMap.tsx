import { useEffect, useMemo, useRef, useState } from 'react'
import L, { type GeoJSON as LeafletGeoJSON, type Layer } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'

function propertyValue(properties: GeoJsonProperties | null, patterns: RegExp[]) {
  if (!properties) return undefined
  for (const pattern of patterns) {
    const pair = Object.entries(properties).find(([key, value]) => pattern.test(key) && value !== null && value !== undefined && value !== '')
    if (pair) return String(pair[1])
  }
  return undefined
}

function featureDetails(properties: GeoJsonProperties | null) {
  const place = propertyValue(properties, [/^adm2_name$/i, /^adm1_name$/i, /^adm_name$/i, /^name$/i]) || 'Mapped feature'
  const country = propertyValue(properties, [/^adm0_name$/i, /^country$/i, /^adm0_iso3$/i])
  const round = propertyValue(properties, [/^round$/i, /survey.*round/i, /round.*name/i, /^cycle$/i])
  return { place, country: country && country !== place ? country : undefined, round }
}

function popupContent(properties: GeoJsonProperties | null) {
  const details = featureDetails(properties)
  const container = document.createElement('div')
  container.className = 'dataset-map-popup'
  const heading = document.createElement('strong')
  heading.textContent = details.place
  container.append(heading)
  for (const value of [details.country, details.round ? `Round ${details.round}` : undefined].filter(Boolean)) {
    const line = document.createElement('span')
    line.textContent = value as string
    container.append(line)
  }
  return container
}

export function DatasetGeometryMap({
  collection,
  totalCount,
}: {
  collection: FeatureCollection<Geometry, GeoJsonProperties>
  totalCount: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | undefined>(undefined)
  const dataLayerRef = useRef<LeafletGeoJSON | undefined>(undefined)
  const [selected, setSelected] = useState<{ place: string; country?: string; round?: string }>()
  const [mapReady, setMapReady] = useState(false)

  const previewNote = useMemo(() => collection.features.length < totalCount
    ? `Showing ${collection.features.length.toLocaleString()} of ${totalCount.toLocaleString()} mapped records`
    : `${collection.features.length.toLocaleString()} mapped records`, [collection.features.length, totalCount])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [8, 20],
      zoom: 3,
      minZoom: 2,
      maxZoom: 12,
      zoomControl: true,
      attributionControl: true,
    })
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Basemap © Esri, HERE, Garmin, FAO, NOAA, USGS',
      maxZoom: 16,
    }).addTo(map)
    const referencePane = map.createPane('diemReferencePane')
    referencePane.style.zIndex = '350'
    referencePane.style.pointerEvents = 'none'
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16,
      pane: 'diemReferencePane',
    }).addTo(map)
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map)
    mapRef.current = map
    setMapReady(true)
    return () => {
      map.remove()
      mapRef.current = undefined
      dataLayerRef.current = undefined
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    dataLayerRef.current?.remove()
    setSelected(undefined)
    const layer = L.geoJSON(collection as FeatureCollection, {
      style: {
        color: '#f8fbfc',
        weight: 1.35,
        fillColor: '#0072bc',
        fillOpacity: 0.82,
      },
      pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
        radius: 5,
        color: '#ffffff',
        weight: 1,
        fillColor: '#0072bc',
        fillOpacity: 0.95,
      }),
      onEachFeature: (feature: Feature<Geometry, GeoJsonProperties>, featureLayer: Layer) => {
        const details = featureDetails(feature.properties)
        featureLayer.bindTooltip(details.place, { sticky: true, direction: 'top' })
        featureLayer.bindPopup(popupContent(feature.properties), { closeButton: false })
        featureLayer.on('click', () => setSelected(details))
        featureLayer.on('mouseover', () => {
          if (featureLayer instanceof L.Path) featureLayer.setStyle({ fillColor: '#f47929', fillOpacity: 0.92 })
        })
        featureLayer.on('mouseout', () => {
          if (featureLayer instanceof L.Path) featureLayer.setStyle({ fillColor: '#0072bc', fillOpacity: 0.82 })
        })
      },
    }).addTo(map)
    layer.bringToFront()
    dataLayerRef.current = layer
    const bounds = layer.getBounds()
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 7 })
    window.setTimeout(() => map.invalidateSize(), 0)
  }, [collection, mapReady])

  function resetExtent() {
    const bounds = dataLayerRef.current?.getBounds()
    if (bounds?.isValid()) mapRef.current?.fitBounds(bounds, { padding: [32, 32], maxZoom: 7 })
  }

  if (!collection.features.length) {
    return <div className="dataset-map-empty"><strong>No mappable records for the current filters.</strong><span>Use the table preview and API links to inspect this dataset.</span></div>
  }

  return (
    <section className="dataset-map-shell" aria-label="Interactive map preview">
      <div ref={containerRef} className="dataset-leaflet-map" />
      <div className="dataset-map-summary" aria-live="polite">
        <strong>{selected?.place || previewNote}</strong>
        <span>{selected ? [selected.country, selected.round ? `Round ${selected.round}` : undefined].filter(Boolean).join(' · ') || 'Selected feature' : 'Select a feature to inspect its location and survey context.'}</span>
      </div>
      <button type="button" className="dataset-map-reset" onClick={resetExtent}>Reset data extent</button>
      <div className="dataset-map-legend"><span /> Filtered DIEM features</div>
    </section>
  )
}
