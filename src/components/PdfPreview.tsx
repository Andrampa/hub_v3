import { useEffect, useRef, useState } from 'react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/**
 * Zoom is a multiple of the page's fitted width, not a pdf.js scale.
 *
 * The control used to set the pdf.js scale directly while the canvas carried
 * `max-width: 100%`, so raising the scale enlarged the backing store and the
 * CSS size never moved: measured at 1440 px, 125 % rendered a 1200 px canvas
 * displayed at 1006 px and 200 % rendered a 1920 px canvas displayed at the
 * same 1006 px. Pressing Zoom in produced a sharper image at identical size and
 * four times the render cost - nothing for the reader who needed it, which is
 * the only reader the control exists for.
 *
 * The scale is now derived from the width actually available, so 100 % always
 * means "fits the frame" at any viewport, and anything above it genuinely
 * magnifies and scrolls inside the frame. Zooming below the fitted width is not
 * offered: on a phone that produced the 273 px-wide page this replaces.
 */
const MIN_ZOOM = 1
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

/**
 * Ceiling on either canvas dimension. A tail-case page at 300 % on a 3x device
 * would otherwise ask for a backing store large enough to fail allocation on a
 * low-powered phone; past this point the page is drawn at reduced density
 * rather than not at all.
 */
const MAX_RASTER_EDGE = 4096

export function PdfPreview({ title, url }: { title: string, url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy>()
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  /** Width available to the page inside the scrolling frame, in CSS pixels. */
  const [frameWidth, setFrameWidth] = useState(0)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const task = getDocument({ url, withCredentials: false })
    let active = true
    setDocument(undefined)
    setPageNumber(1)
    setZoom(MIN_ZOOM)
    setError(undefined)
    void task.promise
      .then((pdf) => { if (active) setDocument(pdf) })
      .catch(() => { if (active) setError('The PDF preview could not be loaded.') })
    return () => {
      active = false
      void task.destroy()
    }
  }, [url])

  /**
   * The fitted width has to follow the frame, because the frame's padding
   * changes at the mobile breakpoint and a rotation changes its width without
   * remounting anything.
   */
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const measure = () => {
      const style = window.getComputedStyle(frame)
      const inset = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      setFrameWidth(Math.max(0, frame.clientWidth - inset))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [document])

  useEffect(() => {
    if (!document || !canvasRef.current || !frameWidth) return
    let renderTask: RenderTask | undefined
    let active = true
    void document.getPage(pageNumber).then((page) => {
      if (!active || !canvasRef.current) return
      const unscaled = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: (frameWidth / unscaled.width) * zoom })
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas is unavailable')
      const density = Math.min(
        window.devicePixelRatio || 1,
        2,
        MAX_RASTER_EDGE / Math.max(viewport.width, viewport.height),
      )
      canvas.width = Math.ceil(viewport.width * density)
      canvas.height = Math.ceil(viewport.height * density)
      // The CSS size is what the reader sees, so it - not the backing store -
      // is what the zoom control has to move. The frame scrolls past it.
      canvas.style.width = `${Math.round(viewport.width)}px`
      canvas.style.height = `${Math.round(viewport.height)}px`
      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: [density, 0, 0, density, 0, 0],
      })
      return renderTask.promise
    }).catch((reason: unknown) => {
      if (active && !(reason instanceof Error && reason.name === 'RenderingCancelledException')) {
        setError('This page could not be rendered. Open the PDF directly instead.')
      }
    })
    return () => {
      active = false
      renderTask?.cancel()
    }
  }, [document, frameWidth, pageNumber, zoom])

  if (error) return <p className="catalog-pdf-error" role="alert">{error} <a href={url}>Download the PDF</a>.</p>
  if (!document) return <div className="catalog-pdf-loading" role="status"><span className="loader" />Loading PDF preview…</div>

  return (
    <div className="catalog-pdf-viewer">
      <div className="catalog-pdf-toolbar" aria-label="PDF preview controls">
        <div>
          <button type="button" disabled={pageNumber === 1} onClick={() => setPageNumber((page) => page - 1)} aria-label="Previous PDF page"><i className="bi bi-chevron-left" aria-hidden="true" /> Previous</button>
          <span>Page {pageNumber} of {document.numPages}</span>
          <button type="button" disabled={pageNumber === document.numPages} onClick={() => setPageNumber((page) => page + 1)} aria-label="Next PDF page">Next <i className="bi bi-chevron-right" aria-hidden="true" /></button>
        </div>
        <div>
          <button type="button" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))} aria-label="Zoom out"><i className="bi bi-dash-lg" aria-hidden="true" /></button>
          {/* 100 % is the fitted width, so the number needs saying out loud. */}
          <span aria-label={`Zoom, ${Math.round(zoom * 100)} percent of the page width`}>{Math.round(zoom * 100)}%</span>
          <button type="button" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))} aria-label="Zoom in"><i className="bi bi-plus-lg" aria-hidden="true" /></button>
        </div>
      </div>
      <div className="catalog-pdf-canvas-wrap" ref={frameRef}>
        <canvas ref={canvasRef} aria-label={`${title}, page ${pageNumber} of ${document.numPages}`} />
      </div>
    </div>
  )
}
