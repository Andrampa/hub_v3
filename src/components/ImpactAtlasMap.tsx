import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
const MAP_WIDTH = 960
const MAP_HEIGHT = 480
// A country-level map: past this the 110m outlines break down.
const MIN_ZOOM = 1
const MAX_ZOOM = 8
const DRAG_THRESHOLD = 4

interface MapView { k: number; x: number; y: number }
const INITIAL_VIEW: MapView = { k: 1, x: 0, y: 0 }

/** Zooms about a point in viewBox units, keeping the map covering the frame. */
function zoomView(view: MapView, nextK: number, px: number, py: number): MapView {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextK))
  return clampView({ k, x: px - ((px - view.x) * k) / view.k, y: py - ((py - view.y) * k) / view.k })
}

function clampView({ k, x, y }: MapView): MapView {
  return {
    k,
    x: Math.min(0, Math.max(MAP_WIDTH * (1 - k), x)),
    y: Math.min(0, Math.max(MAP_HEIGHT * (1 - k), y)),
  }
}

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
        cx: centroid[0],
        cy: centroid[1],
        overflowDx: offset + SYMBOL_RADIUS + 3,
        items: shown.map((release, index) => ({
          release,
          dx: -offset + index * SYMBOL_SPACING,
        })),
      }]
    })
  }, [paths, releases, visibleIso])
  const highlighted = hoveredIso ? countryByIso.get(hoveredIso) : undefined

  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<MapView>(INITIAL_VIEW)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ dragged: boolean; startX: number; startY: number; pinchDistance?: number } | undefined>(undefined)

  // A region filter refits the projection, so the previous zoom no longer applies.
  useEffect(() => setView(INITIAL_VIEW), [visibleIso])

  // React attaches wheel listeners as passive, which would scroll the page too.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const point = toViewBox(svg, event.clientX, event.clientY)
      setView((current) => zoomView(current, current.k * Math.exp(-event.deltaY * 0.002), point.x, point.y))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 1) {
      gesture.current = { dragged: false, startX: event.clientX, startY: event.clientY }
    }
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId)
    const state = gesture.current
    if (!previous || !state) return
    const next = { x: event.clientX, y: event.clientY }
    pointers.current.set(event.pointerId, next)
    if (!state.dragged) {
      if (pointers.current.size < 2 && Math.hypot(next.x - state.startX, next.y - state.startY) < DRAG_THRESHOLD) return
      state.dragged = true
      // Captured only once dragging, so a plain click still reaches its country.
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (state.pinchDistance) {
        const mid = toViewBox(event.currentTarget, (a.x + b.x) / 2, (a.y + b.y) / 2)
        const ratio = distance / state.pinchDistance
        setView((current) => zoomView(current, current.k * ratio, mid.x, mid.y))
      }
      state.pinchDistance = distance
      return
    }
    const scale = MAP_WIDTH / event.currentTarget.getBoundingClientRect().width
    setView((current) => clampView({
      ...current,
      x: current.x + (next.x - previous.x) * scale,
      y: current.y + (next.y - previous.y) * scale,
    }))
  }

  const onPointerEnd = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId)
    if (gesture.current) gesture.current.pinchDistance = undefined
  }

  const zoomBy = (factor: number) => setView((current) => zoomView(current, current.k * factor, MAP_WIDTH / 2, MAP_HEIGHT / 2))

  return (
    <>
      <div className="impact-map-wrap">
        {/* A group, not an image; see CountryMap for why `role="img"` around
            country links is wrong and what axe reports. */}
        <div className="impact-map-zoom" role="group" aria-label="Map zoom">
          <button type="button" onClick={() => zoomBy(1.6)} disabled={view.k >= MAX_ZOOM} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => zoomBy(1 / 1.6)} disabled={view.k <= MIN_ZOOM} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => setView(INITIAL_VIEW)} disabled={view.k === MIN_ZOOM} aria-label="Reset map view">⟲</button>
        </div>
        <svg
          ref={svgRef}
          className="impact-map"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClickCapture={(event) => {
            // Ending a drag must not select the country or symbol under it.
            if (gesture.current?.dragged) {
              event.preventDefault()
              event.stopPropagation()
            }
            gesture.current = undefined
          }}
          viewBox="0 0 960 480"
          role="group"
          aria-label={`Living Shock Atlas: ${countries.length} countries with hazard impact assessments`}
          aria-describedby="impact-map-description"
        >
        <title>Living Shock Atlas</title>
        <desc id="impact-map-description">Select a highlighted country to filter the assessment dossiers below.</desc>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
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
        </g>
        {/* Symbols follow the zoom in position but keep their on-screen size. */}
        {symbols.length > 0 && (
          <g className={`impact-map-releases${highlightedItemId ? ' has-highlight' : ''}`}>
            {symbols.map((group) => (
              <g key={group.iso3}>
                {group.items.map(({ release, dx }) => (
                  <ReleaseSymbol key={release.id} release={release} x={group.cx * view.k + view.x + dx} y={group.cy * view.k + view.y} highlighted={release.itemId === highlightedItemId} onHover={setHoveredRelease} />
                ))}
                {group.overflow > 0 && (
                  <text className="impact-map-release-more" x={group.cx * view.k + view.x + group.overflowDx} y={group.cy * view.k + view.y + 4} aria-hidden="true">+{group.overflow}</text>
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

function toViewBox(svg: SVGSVGElement, clientX: number, clientY: number) {
  const rect = svg.getBoundingClientRect()
  return {
    x: ((clientX - rect.left) * MAP_WIDTH) / rect.width,
    y: ((clientY - rect.top) * MAP_HEIGHT) / rect.height,
  }
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
