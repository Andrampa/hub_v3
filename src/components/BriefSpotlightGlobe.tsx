import { geoDistance, geoGraticule, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo'
import type { MultiPolygon, Polygon } from 'geojson'
import { useLayoutEffect, useRef } from 'react'
import globeData from '../data/briefSpotlightShapes.json'

type Coordinates = [number, number]
type Area = Polygon | MultiPolygon
const { land, countries } = globeData as unknown as {
  land: Area
  countries: Partial<Record<string, { center: Coordinates; outline: Area }>>
}
const grid = geoGraticule().stepMajor([45, 45]).stepMinor([45, 45]).precision(12)()
const travelZoom = 0.89
const ease = (t: number) => t * t * (3 - 2 * t)

interface GlobeFrame {
  center: Coordinates
  zoom: number
  outline: Area
  highlight: number
}

export function BriefSpotlightGlobe({ iso3, animate }: { iso3: string; animate: boolean }) {
  const globe = useRef<SVGGElement>(null)
  const landPath = useRef<SVGPathElement>(null)
  const gridPath = useRef<SVGPathElement>(null)
  const outlinePath = useRef<SVGPathElement>(null)
  const camera = useRef<GlobeFrame>(undefined)
  const country = countries[iso3]

  useLayoutEffect(() => {
    if (!country) return
    const target: GlobeFrame = { ...country, zoom: 1, highlight: 1 }
    const projection = geoOrthographic().translate([100, 100]).scale(96).precision(0.8)
    const path = geoPath(projection).digits(1)
    function draw(frame: GlobeFrame) {
      camera.current = frame
      const { center, zoom, outline, highlight } = frame
      globe.current?.setAttribute('transform', `translate(100 100) scale(${zoom}) translate(-100 -100)`)
      projection.rotate([-center[0], -center[1]])
      landPath.current?.setAttribute('d', path(land) ?? '')
      gridPath.current?.setAttribute('d', path(grid) ?? '')
      outlinePath.current?.setAttribute('d', path(outline) ?? '')
      outlinePath.current?.setAttribute('opacity', String(highlight))
    }

    const start = camera.current ?? target
    const distance = geoDistance(start.center, target.center)
    if (!animate || (distance < 0.001 && start.zoom === 1)) {
      draw(target)
      return
    }

    const route = geoInterpolate(start.center, target.center)
    const duration = Math.min(3500, Math.max(1750, distance * 1700))
    let frame: number
    const started = performance.now()
    draw(start)
    function rotate(now: number) {
      const progress = Math.min(1, (now - started) / duration)
      const departing = progress < 0.5
      const phase = ease(departing ? progress * 2 : progress * 2 - 1)
      draw(progress === 1 ? target : {
        center: route(ease(progress)),
        zoom: departing ? start.zoom + (travelZoom - start.zoom) * phase : travelZoom + (1 - travelZoom) * phase,
        outline: departing ? start.outline : target.outline,
        highlight: departing ? start.highlight * (1 - phase) : phase,
      })
      if (progress < 1) frame = requestAnimationFrame(rotate)
    }
    frame = requestAnimationFrame(rotate)
    return () => cancelAnimationFrame(frame)
  }, [country, animate])

  if (!country) return null
  return (
    <svg className="country-shape bs-globe" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <g ref={globe}>
        <circle className="bs-globe-sphere" cx="100" cy="100" r="96" />
        <path ref={landPath} className="bs-globe-land" />
        <path ref={gridPath} className="bs-globe-grid" />
        <path ref={outlinePath} className="bs-globe-country" />
      </g>
    </svg>
  )
}
