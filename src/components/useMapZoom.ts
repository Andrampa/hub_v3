import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

// Wheel, drag, pinch and button zoom for the Hub's projected SVG world maps.
// The view is a translate and scale of one group inside a fixed viewBox.

export const MAP_WIDTH = 960
export const MAP_HEIGHT = 480
// A country-level map: the geometry is generalized for this zoom, and past it
// the simplified outlines show (scripts/build_un_boundaries.mjs).
export const MIN_ZOOM = 1
export const MAX_ZOOM = 4
const DRAG_THRESHOLD = 4

export interface MapView { k: number; x: number; y: number }
export const INITIAL_VIEW: MapView = { k: 1, x: 0, y: 0 }

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

function toViewBox(svg: SVGSVGElement, clientX: number, clientY: number) {
  const rect = svg.getBoundingClientRect()
  return {
    x: ((clientX - rect.left) * MAP_WIDTH) / rect.width,
    y: ((clientY - rect.top) * MAP_HEIGHT) / rect.height,
  }
}

/**
 * @param resetKey Any value whose change refits the projection, such as a region
 * filter; the previous zoom no longer applies to the new fit.
 */
export function useMapZoom(resetKey: unknown) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<MapView>(INITIAL_VIEW)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ dragged: boolean; startX: number; startY: number; pinchDistance?: number } | undefined>(undefined)

  useEffect(() => setView(INITIAL_VIEW), [resetKey])

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

  // Ending a drag must not select or open the country under the pointer.
  const onClickCapture = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (gesture.current?.dragged) {
      event.preventDefault()
      event.stopPropagation()
    }
    gesture.current = undefined
  }

  const zoomBy = (factor: number) => setView((current) => zoomView(current, current.k * factor, MAP_WIDTH / 2, MAP_HEIGHT / 2))

  return {
    svgRef,
    view,
    svgHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onClickCapture,
    },
    zoomIn: () => zoomBy(1.6),
    zoomOut: () => zoomBy(1 / 1.6),
    reset: () => setView(INITIAL_VIEW),
    transform: `translate(${view.x} ${view.y}) scale(${view.k})`,
  }
}
