import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import world from '@d3-maps/atlas/world/countries/countries-110m'
import countryMetadata from '@d3-maps/atlas/metadata/countries'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { CountrySummary } from '../services/countries'

interface WorldProperties {
  id?: string
  name?: string
  [key: string]: unknown
}

const topology = world as unknown as Topology<{
  features: GeometryCollection<WorldProperties>
}>

const worldFeatures = feature(
  topology,
  topology.objects.features,
) as unknown as FeatureCollection<Geometry, WorldProperties>

interface AtlasCountryMetadata {
  adm0A3: string
  isoA3?: string
}

const atlasIdToIso = new Map(
  (countryMetadata as AtlasCountryMetadata[]).map((country) => [country.adm0A3, country.isoA3 || country.adm0A3]),
)

function featureIso(country: Feature<Geometry, WorldProperties>) {
  const atlasId = String(country.properties?.id || country.id || '').toUpperCase()
  const iso3 = atlasIdToIso.get(atlasId) || atlasId
  return iso3 === 'TZA' ? 'TZN' : iso3
}

export function CountryMap({
  countries,
  visibleIso,
}: {
  countries: CountrySummary[]
  visibleIso?: Set<string>
}) {
  const [hoveredIso, setHoveredIso] = useState<string>()
  const summaryByIso = useMemo(
    () => new Map(countries.map((country) => [country.iso3, country])),
    [countries],
  )
  const paths = useMemo(() => {
    const projection = geoNaturalEarth1().fitExtent([[12, 12], [948, 465]], worldFeatures)
    const path = geoPath(projection)
    return worldFeatures.features.map((country) => ({
      iso3: featureIso(country),
      d: path(country) || '',
    }))
  }, [])
  const hovered = hoveredIso ? summaryByIso.get(hoveredIso) : undefined
  const mappedCount = paths.filter(({ iso3 }) => summaryByIso.has(iso3)).length

  return (
    <div className="country-map-wrap">
      <svg
        className="country-map"
        viewBox="0 0 960 480"
        role="img"
        aria-label={`World map showing ${mappedCount} of ${countries.length} countries with DIEM resources`}
      >
        <title>Countries covered by DIEM</title>
        <desc>Covered countries with geometry at this map scale are highlighted. Use the complete country directory below for keyboard navigation and small island states.</desc>
        {paths.map(({ iso3, d }) => {
          const summary = summaryByIso.get(iso3)
          const isVisible = !visibleIso || visibleIso.has(iso3)
          if (!summary) return <path className="map-country" d={d} key={iso3} />
          return (
            <Link
              to={`/countries/${iso3.toLowerCase()}`}
              aria-label={`${summary.name}, ${summary.resourceCount} resources`}
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
      </svg>
      <div className="map-selection" aria-live="polite">
        {hovered ? (
          <><strong>{hovered.name}</strong><span>{hovered.resourceCount} resources · Updated {new Date(hovered.latestModified).getUTCFullYear()}</span></>
        ) : (
          <><strong>Explore the map</strong><span>Select a highlighted country or use the directory below.</span></>
        )}
      </div>
    </div>
  )
}

export function CountryShape({ iso3, name }: { iso3: string; name: string }) {
  const shape = useMemo(() => {
    const country = worldFeatures.features.find((candidate) => featureIso(candidate) === iso3)
    if (!country) return undefined
    const projection = geoMercator().fitExtent([[22, 16], [238, 174]], country)
    return geoPath(projection)(country) || undefined
  }, [iso3])

  if (!shape) return <div className="country-shape country-shape--fallback" aria-hidden="true">{iso3}</div>
  return (
    <svg className="country-shape" viewBox="0 0 260 190" role="img" aria-label={`Map outline of ${name}`}>
      <title>{name}</title>
      <path d={shape} />
    </svg>
  )
}
