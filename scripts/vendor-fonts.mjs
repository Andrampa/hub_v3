import fs from 'node:fs'
import path from 'node:path'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const OUT_DIR = path.resolve('src/assets/fonts')
// English, French, Spanish and Portuguese are what the Hub renders. Anything
// outside these ranges falls back to the system stack rather than breaking.


const FAMILIES = [
  { name: 'Open Sans', query: 'Open+Sans:wght@300;400;500;600;700;800', weight: '300 800', slug: 'open-sans', ranges: ['latin', 'latin-ext'] },
  // Merriweather is reached only through the theme's blockquote and story-card
  // rules, which on this site means one citation block on /data/guide and any
  // blockquote an editor writes into country rich text. latin-ext would be a
  // second 73 kB for content that does not exist; those characters fall back to
  // the system serif.
  { name: 'Merriweather', query: 'Merriweather:wght@300;400;700', weight: '300 700', slug: 'merriweather', ranges: ['latin'] },
]

fs.mkdirSync(OUT_DIR, { recursive: true })

const faces = []
for (const family of FAMILIES) {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${family.query}&display=swap`, {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())

  const blocks = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([\s\S]*?)\}/g)]
  for (const range of family.ranges) {
    const matching = blocks.filter((b) => b[1] === range)
    if (!matching.length) throw new Error(`${family.name}: no ${range} block`)
    const urls = new Set(matching.map((b) => b[2].match(/url\((https[^)]*)\)/)[1]))
    if (urls.size !== 1) throw new Error(`${family.name}/${range}: expected one variable file, got ${urls.size}`)
    const url = [...urls][0]
    const unicodeRange = matching[0][2].match(/unicode-range: ([^;]+);/)[1].trim()
    const file = `${family.slug}-${range}.woff2`
    const bytes = Buffer.from(await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.arrayBuffer()))
    fs.writeFileSync(path.join(OUT_DIR, file), bytes)
    faces.push({ family: family.name, weight: family.weight, file, unicodeRange, range, bytes: bytes.length, source: url })
    console.log(`${family.name} ${range}: ${file} ${(bytes.length / 1024).toFixed(1)} kB (weights ${matching.map((b) => b[2].match(/font-weight: (\d+)/)[1]).join(',')} share one variable file)`)
  }
}

const header = `/*
 * Open Sans and Merriweather, self-hosted.
 *
 * The vendored FAO theme reaches both through @import url(fonts.googleapis.com)
 * at the top of a render-blocking stylesheet. That is two serial round trips
 * before first paint - the browser cannot even discover the font files until it
 * has downloaded and parsed 295 kB of CSS, resolved googleapis.com, and parsed
 * a second stylesheet to find gstatic.com - and it sends the IP address of
 * every visitor to an FAO site to Google, on a page that links to FAO's own
 * data-protection policy.
 *
 * Both families are served by Google as variable fonts, so all six Open Sans
 * weights and all three Merriweather weights come from one file per
 * unicode-range. Only latin and latin-ext are vendored: the Hub renders
 * English, French, Spanish and Portuguese, and a character outside these ranges
 * falls back to the system stack, which is degradation rather than breakage.
 *
 * Both are licensed under the SIL Open Font License 1.1, which permits
 * redistribution. Regenerate with scripts/vendor-fonts.mjs when the theme
 * changes the families or weights it asks for.
 *
 * Generated ${new Date().toISOString().slice(0, 10)} from:
${faces.map((f) => ` *   ${f.source}`).join('\n')}
 */
`

const rules = faces.map((face) => `@font-face {
  font-family: '${face.family}';
  font-style: normal;
  font-weight: ${face.weight};
  font-stretch: 100%;
  font-display: swap;
  src: url('./${face.file}') format('woff2');
  unicode-range: ${face.unicodeRange};
}`).join('\n\n')

fs.writeFileSync(path.join(OUT_DIR, 'fonts.css'), `${header}\n${rules}\n`)
console.log(`\nwrote ${path.join(OUT_DIR, 'fonts.css')}`)
console.log(`total ${(faces.reduce((sum, f) => sum + f.bytes, 0) / 1024).toFixed(1)} kB across ${faces.length} files`)
