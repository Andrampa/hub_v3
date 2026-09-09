/**
 * Regenerates the responsive hero variants in `src/assets/heroes`.
 *
 *   npm run optimize:heroes
 *
 * The three hero photographs are 4,000-5,700 px camera originals totalling
 * 8.75 MB, and every one of them is rendered as a full-bleed `object-fit: cover`
 * band under a heavy blue overlay. A phone on a field connection was downloading
 * a 3.5 MB JPEG to fill a 375 px band.
 *
 * This writes AVIF and WebP at every width in `src/assets/heroes/heroes.json`
 * plus one JPEG fallback per image, so the browser picks the smallest encoding
 * it understands at the size it will actually paint. Nothing is cropped: the
 * source aspect ratio is preserved and the framing stays with `object-fit` and
 * `object-position` in CSS, so the editorial composition is untouched.
 *
 * The masters live in `assets-source/heroes`, outside `src` and outside the
 * deployment payload in `scripts/sync-web-repository.ps1`: they are the input to
 * this script, never something a browser should be asked to download. The
 * variants are committed, so a clean checkout builds without running this.
 *
 * `heroes.json` is the contract between this script and
 * `src/components/HeroImage.tsx`. Change a width or add a hero there, run this,
 * and commit both the manifest and the files it wrote.
 */
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT_DIR = join(ROOT, 'src/assets/heroes')
const MANIFEST_PATH = join(OUTPUT_DIR, 'heroes.json')

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
const { widths, fallbackWidth, quality, sourceDirectory, heroes } = manifest
const SOURCE_DIR = join(ROOT, sourceDirectory)

if (!widths.includes(fallbackWidth)) {
  throw new Error(`heroes.json: fallbackWidth ${fallbackWidth} is not one of the generated widths`)
}

function fileName(name, width, format) {
  return `${name}-${width}.${format === 'jpeg' ? 'jpg' : format}`
}

async function emit(source, name, width, format) {
  const pipeline = sharp(source).resize({ width, withoutEnlargement: true })
  const buffer = await (format === 'avif'
    ? pipeline.avif({ quality: quality.avif, effort: 6 })
    : format === 'webp'
      ? pipeline.webp({ quality: quality.webp, effort: 6 })
      // mozjpeg at this quality is visually clean under the overlay and roughly
      // a third smaller than libjpeg at the same number.
      : pipeline.jpeg({ quality: quality.jpeg, mozjpeg: true, progressive: true })
  ).toBuffer()
  await writeFile(join(OUTPUT_DIR, fileName(name, width, format)), buffer)
  return buffer.length
}

await mkdir(OUTPUT_DIR, { recursive: true })

const expected = new Set(['heroes.json'])
let sourceBytes = 0
let generatedBytes = 0

for (const [name, hero] of Object.entries(heroes)) {
  const source = join(SOURCE_DIR, hero.source)
  const metadata = await sharp(source).metadata()
  if (metadata.width !== hero.width || metadata.height !== hero.height) {
    // HeroImage declares the fallback's intrinsic size from these numbers, so a
    // silent mismatch would ship the wrong aspect ratio to the layout.
    throw new Error(
      `heroes.json: ${name} is recorded as ${hero.width}x${hero.height} but the master is ${metadata.width}x${metadata.height}`,
    )
  }
  const original = (await stat(source)).size
  sourceBytes += original
  console.log(`${name}  ${metadata.width}x${metadata.height}  ${(original / 1048576).toFixed(2)} MB`)

  // A master narrower than the widest slot would otherwise be written out under
  // a filename claiming a width it does not have, and `HeroImage` would offer
  // the browser a mislabelled `srcset` candidate. Widths above the master are
  // simply not generated; the smallest is always kept so every hero has one.
  const heroWidths = widths.filter((width) => width <= metadata.width)
  if (heroWidths.length === 0) heroWidths.push(Math.min(...widths))
  const heroFallbackWidth = Math.max(...heroWidths.filter((width) => width <= fallbackWidth))

  for (const width of heroWidths) {
    for (const format of ['avif', 'webp']) {
      const bytes = await emit(source, name, width, format)
      generatedBytes += bytes
      expected.add(fileName(name, width, format))
      console.log(`  ${String(width).padStart(4)} ${format.padEnd(4)} ${(bytes / 1024).toFixed(0).padStart(5)} kB`)
    }
  }
  const bytes = await emit(source, name, heroFallbackWidth, 'jpeg')
  generatedBytes += bytes
  expected.add(fileName(name, heroFallbackWidth, 'jpeg'))
  console.log(`  ${heroFallbackWidth} jpg  ${(bytes / 1024).toFixed(0).padStart(5)} kB`)
}

// A width removed from the manifest would otherwise leave an orphan in the
// bundle directory, still committed and never referenced.
const stale = (await readdir(OUTPUT_DIR)).filter((entry) => !expected.has(entry))
for (const entry of stale) {
  await unlink(join(OUTPUT_DIR, entry))
  console.log(`removed stale ${entry}`)
}

console.log(`\nmasters      ${(sourceBytes / 1048576).toFixed(2)} MB (${sourceDirectory}, not deployed)`)
console.log(`variants     ${(generatedBytes / 1048576).toFixed(2)} MB across ${expected.size - 1} files`)
