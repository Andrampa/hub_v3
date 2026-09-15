import { useMemo, useState } from 'react'
import { useHref, useNavigate } from 'react-router-dom'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import world from '@d3-maps/atlas/world/countries/countries-110m'
import countryMetadata from '@d3-maps/atlas/metadata/countries'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { ImpactCountrySummary } from '../services/impactAssessments'
import type { HubLinkTarget } from '../services/countries'
import { MapDisclaimer } from './MapDisclaimer'
import { ShockGlyph } from './ShockSymbol'

/** One recently released product placed on one country. */
export interface AtlasRelease {
  id: string
  /** The product id, shared by its symbols on every country. */
  itemId: string
  title: string
  iso3: string
  shock?: string
  date: string
  link: HubLinkTarget
}

const SYMBOL_RADIUS = 9
const SYMBOL_SPACING = 17
const SYMBOLS_PER_COUNTRY = 3

interface WorldProperties {
  id?: string
  name?: string
  [key: string]: unknown
}

interface AtlasCountryMetadata {
  adm0A3: string
  isoA3?: string
}

const topology = world as unknown as Topology<{
  features: GeometryCollection<WorldProperties>
}>

const worldFeatures = feature(
  topology,
  topology.objects.features,
) as unknown as FeatureCollection<Geometry, WorldProperties>

const atlasIdToIso = new Map(
  (countryMetadata as AtlasCountryMetadata[]).map((country) => [
    country.adm0A3,
    country.isoA3 || country.adm0A3,
  ]),
)

function featureIso(country: Feature<Geometry, WorldProperties>) {
  const atlasId = String(country.properties?.id || country.id || '').toUpperCase()
  return atlasIdToIso.get(atlasId) || atlasId
}

export function ImpactAtlasMap({
  countries,
  visibleIso,
  selectedIso,
  onSelect,
  releases = [],
  highlightedItemId,
}: {
  countries: ImpactCountrySummary[]
  visibleIso?: Set<string>
  selectedIso?: string
  onSelect: (iso3: string) => void
  releases?: AtlasRelease[]
  /** A product highlighted from outside the map, such as its card below. */
  highlightedItemId?: string
}) {
  const [hoveredIso, setHoveredIso] = useState<string>()
  const [hoveredRelease, setHoveredRelease] = useState<AtlasRelease>()
  const countryByIso = useMemo(
    () => new Map(countries.map((country) => [country.iso3, country])),
    [countries],
  )
  const paths = useMemo(() => {
    const visibleFeatures = visibleIso
      ? worldFeatures.features.filter((country) => visibleIso.has(featureIso(country)))
      : []
    const projectionTarget: FeatureCollection<Geometry, WorldProperties> = visibleFeatures.length
      ? { type: 'FeatureCollection', features: visibleFeatures }
      : worldFeatures
    const projection = geoNaturalEarth1().fitExtent([[12, 12], [948, 465]], projectionTarget)
    const path = geoPath(projection)
    return worldFeatures.features.map((country) => ({
      iso3: featureIso(country),
      d: path(country) || '',
      centroid: path.centroid(country),
    }))
  }, [visibleIso])
  // Symbols sit side by side on the country centroid, capped per country with a
  // "+N" count, so a country with several recent releases stays readable.
  const symbols = useMemo(() => {
    const centroidByIso = new Map(paths.map(({ iso3, centroid }) => [iso3, centroid]))
    const byCountry = new Map<string, AtlasRelease[]>()
    releases.forEach((release) => {
      if (visibleIso && !visibleIso.has(release.iso3)) return
      byCountry.set(release.iso3, [...byCountry.get(release.iso3) || [], release])
    })
    return [...byCountry.entries()].flatMap(([iso3, group]) => {
      const centroid = centroidByIso.get(iso3)
      // Small states absent from the 110m atlas still appear in the list below.
      if (!centroid || !Number.isFinite(centroid[0])) return []
      const shown = group.slice(0, SYMBOLS_PER_COUNTRY)
      const offset = ((shown.length - 1) * SYMBOL_SPACING) / 2
      return [{
        iso3,
        overflow: group.length - shown.length,
        overflowX: centroid[0] + offset + SYMBOL_RADIUS + 3,
        y: centroid[1],
        items: shown.map((release, index) => ({
          release,
          x: centroid[0] - offset + index * SYMBOL_SPACING,
        })),
      }]
    })
  }, [paths, releases, visibleIso])
  const highlighted = hoveredIso ? countryByIso.get(hoveredIso) : undefined

  return (
    <>
      <div className="impact-map-wrap">
        {/* A group, not an image; see CountryMap for why `role="img"` around
            country links is wrong and what axe reports. */}
        <svg
          className="impact-map"
          viewBox="0 0 960 480"
          role="group"
          aria-label={`Living Shock Atlas: ${countries.length} countries with hazard impact assessments`}
          aria-describedby="impact-map-description"
        >
        <title>Living Shock Atlas</title>
        <desc id="impact-map-description">Select a highlighted country to filter the assessment dossiers below.</desc>
        {paths.map(({ iso3, d }) => {
          const summary = countryByIso.get(iso3)
          if (!summary) return <path className="impact-map-country" d={d} key={iso3} />
          const selected = selectedIso === iso3
          const isVisible = !visibleIso || visibleIso.has(iso3)
          return (
            <a
              href="#impact-results"
              aria-label={`${summary.name}, ${summary.resourceCount} assessment${summary.resourceCount === 1 ? '' : 's'}`}
              // The country whose filter is applied, named as such rather than
              // only drawn differently.
              aria-current={selected ? 'true' : undefined}
              key={iso3}
              onClick={() => onSelect(iso3)}
              onMouseEnter={() => setHoveredIso(iso3)}
              onMouseLeave={() => setHoveredIso(undefined)}
              onFocus={() => setHoveredIso(iso3)}
              onBlur={() => setHoveredIso(undefined)}
            >
              <path
                className={`impact-map-country impact-map-country--covered${isVisible ? '' : ' impact-map-country--dimmed'}${selected ? ' is-selected' : ''}`}
                d={d}
              />
            </a>
          )
        })}
        {symbols.length > 0 && (
          <g className={`impact-map-releases${highlightedItemId ? ' has-highlight' : ''}`}>
            {symbols.map((group) => (
              <g key={group.iso3}>
                {group.items.map(({ release, x }) => (
                  <ReleaseSymbol key={release.id} release={release} x={x} y={group.y} highlighted={release.itemId === highlightedItemId} onHover={setHoveredRelease} />
                ))}
                {group.overflow > 0 && (
                  <text className="impact-map-release-more" x={group.overflowX} y={group.y + 4} aria-hidden="true">+{group.overflow}</text>
                )}
              </g>
            ))}
          </g>
        )}
        </svg>
        <div className="impact-map-caption" aria-live="polite">
        {hoveredRelease ? (
          <>
            <strong>{hoveredRelease.title}</strong>
            <span>{hoveredRelease.shock || 'Hazard impact'} · Released {hoveredRelease.date} · Select to open</span>
          </>
        ) : highlighted ? (
          <>
            <strong>{highlighted.name}</strong>
            <span>
              {highlighted.resourceCount} assessment{highlighted.resourceCount === 1 ? '' : 's'} · Select to filter
            </span>
          </>
        ) : selectedIso && countryByIso.get(selectedIso) ? (
          <>
            <strong>{countryByIso.get(selectedIso)!.name}</strong>
            <span>Country filter active · Select it again from the filter to change</span>
          </>
        ) : (
          <>
            <strong>Explore the atlas</strong>
            <span>Choose a highlighted country or use the filters below.</span>
          </>
        )}
        </div>
      </div>
      <MapDisclaimer />
    </>
  )
}

function ReleaseSymbol({
  release,
  x,
  y,
  highlighted,
  onHover,
}: {
  release: AtlasRelease
  highlighted: boolean
  x: number
  y: number
  onHover: (release?: AtlasRelease) => void
}) {
  const navigate = useNavigate()
  const productHref = useHref(release.link.kind === 'product' ? release.link.to : '#')
  const label = `${release.shock || 'Hazard impact'}: ${release.title}, released ${release.date}`
  const className = `impact-map-release${highlighted ? ' is-highlighted' : ''}`
  const handlers = {
    onMouseEnter: () => onHover(release),
    onMouseLeave: () => onHover(undefined),
    onFocus: () => onHover(release),
    onBlur: () => onHover(undefined),
  }
  const body = (
    <g transform={`translate(${x} ${y})`}>
      <ShockGlyph shock={release.shock} radius={SYMBOL_RADIUS} />
    </g>
  )

  if (release.link.kind === 'external') {
    return (
      <a className={className} href={release.link.href} target="_blank" rel="noreferrer" aria-label={label} {...handlers}>
        {body}
      </a>
    )
  }
  const to = release.link.to
  return (
    <a
      className={className}
      href={productHref}
      aria-label={label}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        event.preventDefault()
        navigate(to)
      }}
      {...handlers}
    >
      {body}
    </a>
  )
}
