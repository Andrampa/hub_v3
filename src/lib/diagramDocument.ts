import openSansLatinUrl from '../assets/fonts/open-sans-latin.woff2?url'

/**
 * Turns a source architecture diagram into a complete, inert HTML document for
 * a sandboxed `srcdoc` iframe or a download.
 *
 * The sources are trusted repository files, but they are still treated as
 * untrusted markup: they are parsed (never inserted into the Hub DOM),
 * sanitized against an allowlist, stripped of every network reference, and
 * given a restrictive CSP. The iframe that shows them has neither
 * `allow-scripts` nor `allow-same-origin`, so this is defence in depth.
 */

export const DIAGRAM_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  'font-src data:',
  'img-src data:',
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

/**
 * Everything the diagrams use, and nothing that can run, load or navigate.
 * Unlisted elements are removed with their content; links become plain text.
 * A hand-written allowlist rather than DOMPurify: DOMPurify returns its input
 * unchanged when it judges the environment unsupported, which fails open.
 */
const ALLOWED_ELEMENTS = new Set([
  'div', 'header', 'section', 'figure', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'p', 'span', 'i', 'b', 'em',
  'strong', 'small', 'code', 'br', 'ul', 'ol', 'li', 'details', 'summary', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
  'svg', 'g', 'defs', 'marker', 'path', 'rect', 'text', 'tspan', 'line', 'polyline', 'polygon', 'circle',
  'ellipse',
])
const ALLOWED_ATTRIBUTES = new Set([
  'class', 'id', 'role', 'aria-label', 'aria-hidden', 'aria-describedby', 'aria-labelledby', 'scope', 'colspan',
  'rowspan', 'viewbox', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'd',
  'points', 'transform', 'text-anchor', 'dominant-baseline', 'marker-end', 'marker-start', 'marker-mid', 'refx',
  'refy', 'markerwidth', 'markerheight', 'markerunits', 'orient', 'xmlns', 'dx', 'dy',
])
const LOCAL_URL = /^url\(#[A-Za-z][\w-]*\)$/

function sanitizeElement(element: Element) {
  for (const child of Array.from(element.children)) {
    const name = child.localName.toLowerCase()
    if (name === 'a') {
      // A sandboxed frame may still navigate itself, replacing the diagram;
      // related diagrams and source links live in the Hub interface instead.
      const span = child.ownerDocument.createElement('span')
      span.className = 'diagram-link-text'
      span.append(...Array.from(child.childNodes))
      child.replaceWith(span)
      sanitizeElement(span)
      continue
    }
    if (!ALLOWED_ELEMENTS.has(name)) {
      child.remove()
      continue
    }
    for (const attribute of Array.from(child.attributes)) {
      const attributeName = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      const allowed = ALLOWED_ATTRIBUTES.has(attributeName)
        && !/javascript:|data:|expression\(/i.test(value)
        && (!/url\(/i.test(value) || LOCAL_URL.test(value))
      if (!allowed) child.removeAttribute(attribute.name)
    }
    sanitizeElement(child)
  }
}

/** True when a url() argument points somewhere other than an id in this document. */
const EXTERNAL_URL = /url\(\s*(['"]?)(?!#)[^)]*\)/gi

/**
 * Removes every way a stylesheet can make a request. Only `url(#id)`, which
 * the diagrams use for SVG arrowheads, survives.
 */
export function sanitizeDiagramCss(css: string) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@import[^;]*;?/gi, '')
    .replace(/@font-face\s*\{[^}]*\}/gi, '')
    .replace(EXTERNAL_URL, 'none')
    .replace(/expression\s*\(/gi, 'invalid(')
    .replace(/(-moz-binding|behavior)\s*:/gi, 'invalid-property:')
    .replace(/<\/style/gi, '')
}

export interface SanitizedDiagram {
  title: string
  css: string
  body: string
}

export function sanitizeDiagram(source: string, { hideStatus = false }: { hideStatus?: boolean } = {}): SanitizedDiagram {
  const parsed = new DOMParser().parseFromString(source, 'text/html')
  const title = parsed.querySelector('title')?.textContent?.trim() || 'Architecture diagram'
  const css = Array.from(parsed.querySelectorAll('style'), (style) => sanitizeDiagramCss(style.textContent || '')).join('\n')
  sanitizeElement(parsed.body)
  // The Hub shows the status line in its own panel; a standalone copy keeps it.
  if (hideStatus) for (const status of Array.from(parsed.body.querySelectorAll('.architecture-status'))) status.remove()
  return { title, css, body: parsed.body.innerHTML }
}

/**
 * The Hub's own type in place of the diagrams' Google Fonts. Archivo and IBM
 * Plex were what the box sizes were tuned to; the label-fit check in
 * docs/architecture_diagrams.md covers this substitution.
 */
function fontOverrides(fontFaceCss: string) {
  return `${fontFaceCss}
:root:root {
  --display: "Open Sans", "Segoe UI", Arial, sans-serif;
  --body: "Open Sans", "Segoe UI", Arial, sans-serif;
  --mono: ui-monospace, "Cascadia Mono", Consolas, "SFMono-Regular", monospace;
}
.diagram-link-text { color: inherit; }`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`)
}

export interface DiagramDocumentOptions {
  /** Inline @font-face rules using data: URLs only. */
  fontFaceCss?: string
  /** The Hub has no dark theme, so the resolved theme is always light. */
  theme?: 'light' | 'dark'
  /** Prepended as an HTML comment; used to date a downloaded copy. */
  provenance?: string
  /** Drop the source's status line, for the Hub view that shows it alongside. */
  hideStatus?: boolean
}

export function buildDiagramDocument(source: string, options: DiagramDocumentOptions = {}) {
  const { title, css, body } = sanitizeDiagram(source, { hideStatus: options.hideStatus })
  const fontFaceCss = sanitizeFontFaceCss(options.fontFaceCss || '')
  const comment = options.provenance ? `<!-- ${options.provenance.replace(/--/g, '-')} -->\n` : ''
  return `<!doctype html>
${comment}<html lang="en" data-theme="${options.theme || 'light'}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${DIAGRAM_CSP}">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${css}
${fontOverrides(fontFaceCss)}
</style>
</head>
<body>
${body}
</body>
</html>`
}

/** Font CSS may carry data: fonts and nothing else. */
function sanitizeFontFaceCss(css: string) {
  if (/@import|<\/style|expression\s*\(/i.test(css)) return ''
  const urls = css.match(/url\([^)]*\)/gi) || []
  return urls.every((url) => /^url\(\s*['"]?data:font\/woff2;base64,[A-Za-z0-9+/=]+['"]?\s*\)$/i.test(url)) ? css : ''
}

let fontFaceCssPromise: Promise<string> | null = null

/**
 * A sandboxed frame has an opaque origin and cannot load the Hub's font file,
 * so the parent reads it once (same origin, already cached by the page) and
 * passes it in as a data: URL. A failure falls back to system fonts.
 */
export function loadDiagramFontFaceCss(): Promise<string> {
  fontFaceCssPromise ||= fetch(openSansLatinUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.arrayBuffer()
    })
    .then((buffer) => {
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
      }
      return `@font-face { font-family: "Open Sans"; font-style: normal; font-weight: 300 800; font-display: block; src: url(data:font/woff2;base64,${btoa(binary)}) format("woff2"); }`
    })
    .catch(() => {
      fontFaceCssPromise = null
      return ''
    })
  return fontFaceCssPromise
}
