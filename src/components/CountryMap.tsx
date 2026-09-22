import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo'
import type { FeatureCollection, MultiPolygon } from 'geojson'
import type { CountrySummary } from '../services/countries'
import { countryWithDisputedSurroundings, worldAreaCollection, worldAreas, worldBoundaries } from '../lib/unGeometry'
import { MapDisclaimer } from './MapDisclaimer'
import { MapZoomControls } from './MapZoomControls'
import { UnBoundaries } from './UnBoundaries'
import { MAP_HEIGHT, MAP_WIDTH, useMapZoom } from './useMapZoom'

// A legacy Tanzania code still accepted by the catalog normalization.
function geometryIso(iso3: string) {
  return iso3 === 'TZN' ? 'TZA' : iso3
}

export function CountryMap({
  countries,
  visibleIso,
}: {
  countries: CountrySummary[]
  visibleIso?: Set<string>
}) {
  const [hoveredIso, setHoveredIso] = useState<string>()
  const zoom = useMapZoom(visibleIso)
  const summaryByIso = useMemo(
    () => new Map(countries.map((country) => [country.iso3, country])),
    [countries],
  )
  const { areas, path } = useMemo(() => {
    const visibleFeatures = visibleIso
      ? worldAreas.filter((area) => area.kind === 'country' && visibleIso.has(area.iso3)).map((area) => area.feature)
      : []
    const projectionTarget: FeatureCollection<MultiPolygon> = visibleFeatures.length
      ? { type: 'FeatureCollection', features: visibleFeatures }
      : worldAreaCollection
    const projection = geoNaturalEarth1().fitExtent([[12, 12], [MAP_WIDTH - 12, MAP_HEIGHT - 15]], projectionTarget)
    const path = geoPath(projection)
    return {
      path,
      areas: worldAreas.map((area) => ({
        iso3: area.iso3,
        kind: area.kind,
        d: path(area.feature) || '',
      })),
    }
  }, [visibleIso])
  const hovered = hoveredIso ? summaryByIso.get(hoveredIso) : undefined
  const mappedCount = areas.filter(({ iso3, kind }) => kind === 'country' && summaryByIso.has(iso3)).length

  return (
    <>
      <div className="country-map-wrap">
        <MapZoomControls zoom={zoom} />
        {/* A group, not an image. Every highlighted country inside is a link, and
            `role="img"` declares its children presentational: assistive
            technology was told to ignore exactly the things it can operate, and
            axe reported it as nested-interactive. `group` keeps one named
            container around the set while leaving the links addressable. */}
        <svg
          ref={zoom.svgRef}
          className="country-map"
          {...zoom.svgHandlers}
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          role="group"
          aria-label={`World map of DIEM countries: ${mappedCount} of ${countries.length} highlighted`}
          aria-describedby="country-map-description"
        >
        <title>Countries covered by DIEM</title>
        <desc id="country-map-description">Covered countries with geometry at this map scale are highlighted. Use the complete country directory below for keyboard navigation and small island states.</desc>
        <g transform={zoom.transform}>
        {areas.map(({ iso3, kind, d }) => {
          if (kind === 'neutral') return <path className="map-country map-area--neutral" d={d} key={iso3} />
          const summary = kind === 'country' ? summaryByIso.get(iso3) : undefined
          if (!summary) return <path className="map-country" d={d} key={iso3} />
          const isVisible = !visibleIso || visibleIso.has(iso3)
          return (
            <Link
              to={`/countries/${iso3.toLowerCase()}`}
              aria-label={`${summary.name}, ${summary.resourceCount} ${summary.resourceCount === 1 ? 'product' : 'products'}`}
              key={iso3}
              onMouseEnter={() => setHoveredIso(iso3)}
              onMouseLeave={() => setHoveredIso(undefined)}
              onFocus={() => setHoveredIso(iso3)}
              onBlur={() => setHoveredIso(undefined)}
            >
              <path className={`map-country map-country--covered${isVisible ? '' : ' map-country--dimmed'}`} d={d} />
            </Link>
          )
        })}
        <UnBoundaries boundaries={worldBoundaries} path={path} />
        </g>
        </svg>
        <div className="map-selection" aria-live="polite">
        {hovered ? (
          <><strong>{hovered.name}</strong><span>{hovered.resourceCount} {hovered.resourceCount === 1 ? 'product' : 'products'} · Latest publication {new Date(hovered.latestPublished).getUTCFullYear()}</span></>
        ) : (
          <><strong>Explore the map</strong><span>Select a highlighted country or use the directory below.</span></>
        )}
        </div>
      </div>
      <MapDisclaimer />
    </>
  )
}

/**
 * A country's outline for its profile page, drawn with any neutral area it
 * touches (India with Jammu and Kashmir) and the UN lines around them. The
 * frame fits those shapes only, never the unrelated neighbours.
 */
export function CountryShape({ iso3, name }: { iso3: string; name: string }) {
  const shape = useMemo(() => {
    const surroundings = countryWithDisputedSurroundings(geometryIso(iso3))
    if (!surroundings) return undefined
    const { country, neutral, boundaries } = surroundings
    const frame: FeatureCollection<MultiPolygon> = {
      type: 'FeatureCollection',
      features: [country.feature, ...neutral.map((area) => area.feature)],
    }
    const path = geoPath(geoMercator().fitExtent([[22, 16], [238, 174]], frame))
    return {
      country: path(country.feature) || '',
      neutral: neutral.map((area) => ({ iso3: area.iso3, d: path(area.feature) || '' })),
      boundaries,
      path,
    }
  }, [iso3])

  if (!shape) return <div className="country-shape country-shape--fallback" aria-hidden="true">{iso3}</div>
  return (
    <svg className="country-shape" viewBox="0 0 260 190" role="img" aria-label={`Map outline of ${name}`}>
      <title>{name}</title>
      {shape.neutral.map(({ iso3: code, d }) => <path className="map-area--neutral" d={d} key={code} />)}
      <path className="country-shape-country" d={shape.country} />
      <UnBoundaries boundaries={shape.boundaries} path={shape.path} />
    </svg>
  )
}
