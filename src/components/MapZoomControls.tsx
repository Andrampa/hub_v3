import { MAX_ZOOM, MIN_ZOOM, type useMapZoom } from './useMapZoom'

export function MapZoomControls({ zoom }: { zoom: ReturnType<typeof useMapZoom> }) {
  const { view, zoomIn, zoomOut, reset } = zoom
  return (
    <div className="map-zoom" role="group" aria-label="Map zoom">
      <button type="button" onClick={zoomIn} disabled={view.k >= MAX_ZOOM} aria-label="Zoom in">+</button>
      <button type="button" onClick={zoomOut} disabled={view.k <= MIN_ZOOM} aria-label="Zoom out">−</button>
      <button type="button" onClick={reset} disabled={view.k === MIN_ZOOM} aria-label="Reset map view">⟲</button>
    </div>
  )
}
