// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableIframePageLoading":true,"disableCSSFileLoading":true,"disableJavaScriptFileLoading":true,"handleDisabledFileLoadingAsSuccess":true,"navigation":{"disableChildFrameNavigation":true,"disableChildPageNavigation":true}}}
import { describe, expect, it } from 'vitest'
import { buildDiagramDocument, DIAGRAM_CSP, sanitizeDiagram, sanitizeDiagramCss } from './diagramDocument'
import { loadDiagramSource } from '../services/architectureDiagrams'

const hostile = `<title>Hostile</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo">
<link rel="stylesheet" href="https://evil.example/x.css">
<style>
@import url("https://evil.example/import.css");
.a { background: url(https://evil.example/pixel.png); }
.b { background-image: url( 'data:image/svg+xml;utf8,<svg/>' ); }
.c { width: expression(alert(1)); behavior: url(x.htc); }
.d { marker-end: url(#af); }
@font-face { font-family: X; src: url(https://evil.example/font.woff2); }
</style>
<div class="wrap">
  <script>alert(1)</script>
  <img src="https://evil.example/i.png" onerror="alert(1)">
  <p onclick="alert(1)" style="background:url(https://evil.example/s.png)">Text <a href="javascript:alert(1)">bad link</a> <a href="https://github.com/x">ok link</a></p>
  <iframe src="https://evil.example"></iframe><object data="x"></object><embed src="x"><form action="https://evil.example"><input name="q"></form>
  <svg viewBox="0 0 10 10" role="img" aria-label="A labelled drawing">
    <defs><marker id="af"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>
    <rect class="box" x="1" y="1" width="5" height="5" onload="alert(1)"/>
    <path class="flow" d="M0 0 L5 5" marker-end="url(#af)"/>
    <path d="M0 0" marker-start="url(https://evil.example/m.svg#x)"/>
    <use href="https://evil.example/sprite.svg#a"/>
    <image href="https://evil.example/i.png"/>
    <foreignObject><div>html</div></foreignObject>
    <animate attributeName="href" to="javascript:alert(1)"/>
    <a href="javascript:alert(1)"><text x="1" y="1">svg link</text></a>
    <text x="1" y="9">Label</text>
  </svg>
</div>`

describe('sanitizeDiagramCss', () => {
  it('removes imports, external urls, font faces and legacy script hooks but keeps local markers', () => {
    const css = sanitizeDiagramCss('@import url(x.css); .a{background:url(https://e/p.png)} .d{marker-end:url(#af)} @font-face{src:url(f.woff2)} .c{width:expression(1);behavior:url(x)}')
    expect(css).not.toMatch(/@import|https:|@font-face|expression\(|behavior:/i)
    expect(css).toContain('url(#af)')
  })
})

describe('sanitizeDiagram', () => {
  const { body, css, title } = sanitizeDiagram(hostile)

  it('drops every script, handler and active element', () => {
    expect(body).not.toMatch(/<script|onerror|onclick|onload|<iframe|<object|<embed|<form|<input|<img|<use|<image|<foreignObject|<animate/i)
    expect(body).not.toMatch(/javascript:/i)
  })

  it('leaves no network reference in markup or styles', () => {
    expect(body).not.toMatch(/https?:/i)
    expect(css).not.toMatch(/https?:|@import/i)
    expect(body).not.toMatch(/\sstyle=/i)
  })

  it('turns links into text so the frame cannot navigate', () => {
    expect(body).not.toMatch(/<a\b/i)
    expect(body).toContain('ok link')
    expect(body).toContain('svg link')
  })

  it('keeps the SVG, its accessible name and local arrowheads', () => {
    expect(title).toBe('Hostile')
    expect(body).toMatch(/<svg[^>]*role="img"/)
    expect(body).toContain('aria-label="A labelled drawing"')
    expect(body).toContain('marker-end="url(#af)"')
    expect(body).not.toContain('marker-start')
    expect(body).toContain('<marker id="af"')
  })
})

describe('buildDiagramDocument', () => {
  it('builds a complete document with a restrictive CSP and the light theme', () => {
    const html = buildDiagramDocument(hostile)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="en" data-theme="light">')
    expect(html).toContain(`content="${DIAGRAM_CSP}"`)
    expect(DIAGRAM_CSP).toContain("default-src 'none'")
    expect(DIAGRAM_CSP).not.toMatch(/script-src|https?:/)
    expect(html).not.toMatch(/fonts\.googleapis|evil\.example/)
  })

  it('accepts data: fonts only', () => {
    const good = '@font-face { font-family: "Open Sans"; src: url(data:font/woff2;base64,AAAA) format("woff2"); }'
    expect(buildDiagramDocument(hostile, { fontFaceCss: good })).toContain('data:font/woff2;base64,AAAA')
    const bad = '@font-face { font-family: "Open Sans"; src: url(https://evil.example/f.woff2); }'
    expect(buildDiagramDocument(hostile, { fontFaceCss: bad })).not.toContain('evil.example')
  })

  it('records provenance without letting it close the comment', () => {
    const html = buildDiagramDocument(hostile, { provenance: 'Source x --> <script>' })
    expect(html).toContain('<!-- Source x -> <script> -->')
    expect(html.match(/-->/g)).toHaveLength(1)
  })

  it.each(['monitoring', 'hub', 'eve', 'vista'])('renders the %s diagram without losing its drawing', async (key) => {
    const source = await loadDiagramSource(key)
    const html = buildDiagramDocument(source)
    const rendered = new DOMParser().parseFromString(html, 'text/html')
    const original = new DOMParser().parseFromString(source, 'text/html')
    expect(source).toMatch(/^<!doctype html>/i)
    expect(original.documentElement.lang).toBe('en')
    expect(original.querySelector('meta[charset]')?.getAttribute('charset')).toBe('utf-8')
    expect(original.querySelector('meta[name="viewport"]')).not.toBe(null)
    expect(rendered.querySelector('.reading-sequence ol')?.children.length).toBeGreaterThanOrEqual(4)
    expect(rendered.querySelector('.architecture-status')?.textContent).toMatch(/ · As of \d{1,2} [A-Z][a-z]+ \d{4}\./)
    expect(rendered.querySelectorAll('svg rect').length).toBe(original.querySelectorAll('svg rect').length)
    expect(rendered.querySelectorAll('svg text').length).toBe(original.querySelectorAll('svg text').length)
    expect(rendered.querySelectorAll('[marker-end]').length).toBe(original.querySelectorAll('[marker-end]').length)
    expect(rendered.querySelector('svg')?.getAttribute('aria-label')).toBe(original.querySelector('svg')?.getAttribute('aria-label'))
    expect(rendered.querySelector('.legend')).not.toBe(null)
    expect(rendered.querySelectorAll('a')).toHaveLength(0)
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  })
})

describe('status line', () => {
  const source = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>S</title></head><body><div class="wrap"><p class="architecture-status"><strong>Current implementation</strong> · As of 22 October 2026.</p><svg role="img" aria-label="A drawing with a long enough label"></svg></div></body></html>'

  it('keeps the status line in standalone copies and drops it from the Hub view', () => {
    expect(buildDiagramDocument(source)).toContain('architecture-status')
    expect(buildDiagramDocument(source, { hideStatus: true })).not.toContain('architecture-status')
    expect(buildDiagramDocument(source, { hideStatus: true })).toContain('A drawing with a long enough label')
  })
})
