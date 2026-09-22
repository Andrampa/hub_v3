import type { GeoPath } from 'd3-geo'
import type { BoundaryGroup } from '../lib/unGeometry'

/**
 * UN boundary lines drawn over the area fills, one path per UN symbol. Area
 * fills carry no outline of their own, so every boundary on the map is one of
 * these lines, styled from the UN `bdytyp` attribute. They take no pointer
 * events, so they never cover a country link.
 */
export function UnBoundaries({ boundaries, path }: { boundaries: BoundaryGroup[]; path: GeoPath }) {
  return (
    <g className="map-boundaries" aria-hidden="true">
      {boundaries.map(({ style, geometry }) => (
        <path key={style} className={`map-boundary map-boundary--${style}`} d={path(geometry) || ''} />
      ))}
    </g>
  )
}
