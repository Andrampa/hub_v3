import { useMemo, useState } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import world from '@d3-maps/atlas/world/countries/countries-110m'
import countryMetadata from '@d3-maps/atlas/metadata/countries'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { ImpactCountrySummary } from '../services/impactAssessments'

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
  selectedIso,
  onSelect,
}: {
  countries: ImpactCountrySummary[]
  selectedIso?: string
  onSelect: (iso3: string) => void
}) {
  const [hoveredIso, setHoveredIso] = useState<string>()
  const countryByIso = useMemo(
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
  const highlighted = hoveredIso ? countryByIso.get(hoveredIso) : undefined

  return (
    <div className="impact-map-wrap">
      <svg
        className="impact-map"
        viewBox="0 0 960 480"
        role="img"
        aria-label={`Living Shock Atlas showing ${countries.length} countries with hazard impact assessments`}
      >
        <title>Living Shock Atlas</title>
        <desc>Select a highlighted country to filter the assessment dossiers below.</desc>
        {paths.map(({ iso3, d }) => {
          const summary = countryByIso.get(iso3)
          if (!summary) return <path className="impact-map-country" d={d} key={iso3} />
          const selected = selectedIso === iso3
          return (
            <a
              href="#impact-results"
              aria-label={`${summary.name}, ${summary.resourceCount} assessment${summary.resourceCount === 1 ? '' : 's'}`}
              key={iso3}
              onClick={() => onSelect(iso3)}
              onMouseEnter={() => setHoveredIso(iso3)}
              onMouseLeave={() => setHoveredIso(undefined)}
              onFocus={() => setHoveredIso(iso3)}
              onBlur={() => setHoveredIso(undefined)}
            >
              <path
                className={`impact-map-country impact-map-country--covered${selected ? ' is-selected' : ''}`}
                d={d}
              />
            </a>
          )
        })}
      </svg>
      <div className="impact-map-caption" aria-live="polite">
        {highlighted ? (
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
  )
}
