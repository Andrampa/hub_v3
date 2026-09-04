import { useEffect, useRef, useState } from 'react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export function PdfPreview({ title, url }: { title: string, url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy>()
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.25)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const task = getDocument({ url, withCredentials: false })
    let active = true
    setDocument(undefined)
    setPageNumber(1)
    setError(undefined)
    void task.promise
      .then((pdf) => { if (active) setDocument(pdf) })
      .catch(() => { if (active) setError('The PDF preview could not be loaded.') })
    return () => {
      active = false
      void task.destroy()
    }
  }, [url])

  useEffect(() => {
    if (!document || !canvasRef.current) return
    let renderTask: RenderTask | undefined
    let active = true
    void document.getPage(pageNumber).then((page) => {
      if (!active || !canvasRef.current) return
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas is unavailable')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      renderTask = page.render({ canvas, canvasContext: context, viewport })
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
  }, [document, pageNumber, scale])

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
          <button type="button" disabled={scale <= .75} onClick={() => setScale((value) => Math.max(.75, value - .25))} aria-label="Zoom out"><i className="bi bi-dash-lg" aria-hidden="true" /></button>
          <span>{Math.round(scale * 100)}%</span>
          <button type="button" disabled={scale >= 2} onClick={() => setScale((value) => Math.min(2, value + .25))} aria-label="Zoom in"><i className="bi bi-plus-lg" aria-hidden="true" /></button>
        </div>
      </div>
      <div className="catalog-pdf-canvas-wrap">
        <canvas ref={canvasRef} aria-label={`${title}, page ${pageNumber} of ${document.numPages}`} />
      </div>
    </div>
  )
}
