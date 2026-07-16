import { useMemo, useState } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import world from '@d3-maps/atlas/world/countries/countries-110m'
import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'

interface WorldProperties { id?: string; [key: string]: unknown }

const topology = world as unknown as Topology<{ features: GeometryCollection<WorldProperties> }>
const worldFeatures = feature(topology, topology.objects.features) as unknown as FeatureCollection<Geometry, WorldProperties>

function featureLabel(properties: GeoJsonProperties | null) {
  if (!properties) return 'Selected feature'
  const pair = Object.entries(properties).find(([key, value]) => /name|adm0|country|iso/i.test(key) && value !== null && value !== undefined)
  return pair ? String(pair[1]) : 'Selected feature'
}

export function DatasetGeometryMap({
  collection,
  totalCount,
}: {
  collection: FeatureCollection<Geometry, GeoJsonProperties>
  totalCount: number
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number>()
  const paths = useMemo(() => {
    if (!collection.features.length) return { base: [], features: [] as string[] }
    const projection = geoMercator().fitExtent([[20, 18], [940, 452]], collection)
    const path = geoPath(projection)
    return {
      base: worldFeatures.features.map((country) => path(country) || ''),
      features: collection.features.map((item) => path(item) || ''),
    }
  }, [collection])
  const hovered = hoveredIndex === undefined ? undefined : collection.features[hoveredIndex]
  const previewNote = collection.features.length < totalCount ? `Showing ${collection.features.length.toLocaleString()} mapped records` : `${collection.features.length.toLocaleString()} mapped records`

  if (!collection.features.length) {
    return <div className="dataset-map-empty"><strong>No mappable records for the current filters.</strong><span>Use the table preview and API links to inspect this dataset.</span></div>
  }

  return (
    <div className="dataset-map-shell">
      <svg className="dataset-map" viewBox="0 0 960 470" role="img" aria-label={`${previewNote} in the selected DIEM dataset`}>
        <title>Filtered DIEM dataset map</title>
        <desc>Real geometry returned by the selected ArcGIS feature service. Select a feature to inspect its available attributes.</desc>
        <g className="dataset-map-base">{paths.base.map((d, index) => <path d={d} key={index} />)}</g>
        <g className="dataset-map-features">{paths.features.map((d, index) => <path d={d} key={index} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(undefined)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(undefined)} />)}</g>
      </svg>
      <div className="dataset-map-summary" aria-live="polite">
        {hovered ? <><strong>{featureLabel(hovered.properties)}</strong><span>{Object.keys(hovered.properties || {}).length} available attributes</span></> : <><strong>{previewNote}</strong><span>Hover or focus a feature to inspect it.</span></>}
      </div>
    </div>
  )
}
