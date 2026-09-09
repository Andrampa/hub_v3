import manifest from '../assets/heroes/heroes.json'

/**
 * Full-bleed hero photograph, delivered at the size the viewport will paint.
 *
 * The three heroes were camera originals — 4,000 to 5,700 px wide, 8.75 MB
 * together — served identically to a 375 px phone and a 1440 px desktop. They
 * are now pre-encoded to AVIF and WebP at several widths by
 * `scripts/optimize_hero_images.mjs` (`npm run optimize:heroes`), with one JPEG
 * for a browser that reads neither. Nothing is cropped: the variants keep the
 * source aspect ratio and the framing stays with `object-fit`/`object-position`
 * in CSS, so the editorial composition is exactly what it was.
 *
 * `heroes.json` is the single source of the widths and the master dimensions,
 * shared with the generator so the two cannot drift. The masters themselves live
 * in `assets-source/heroes`, outside the bundle and outside the deployment
 * payload.
 */

/**
 * Vite resolves the hashed URLs at build time. A glob rather than one import per
 * file, because the set of files is a property of the manifest.
 */
const generated = import.meta.glob('../assets/heroes/*.{avif,webp,jpg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

/** Each hero's key in the manifest, so a typo at a call site is a type error. */
export type HeroName = keyof typeof manifest.heroes

function variant(name: HeroName, width: number, extension: string) {
  return generated[`../assets/heroes/${name}-${width}.${extension}`]
}

/**
 * The JPEG the generator actually wrote: `fallbackWidth`, or the widest slot
 * below it when the master is narrower than that and the larger variants were
 * never generated.
 */
function fallback(name: HeroName) {
  const width = [...manifest.widths]
    .filter((candidate) => candidate <= manifest.fallbackWidth)
    .sort((a, b) => b - a)
    .find((candidate) => variant(name, candidate, 'jpg'))
  return width ? { url: variant(name, width, 'jpg'), width } : undefined
}

function srcSet(name: HeroName, extension: string) {
  return manifest.widths
    .map((width) => [variant(name, width, extension), width] as const)
    .filter(([url]) => Boolean(url))
    .map(([url, width]) => `${url} ${width}w`)
    .join(', ')
}

export function HeroImage({
  name,
  className,
  alt = '',
}: {
  name: HeroName
  className: string
  /**
   * Empty where the photograph is decorative — the heading beside it already
   * says what the page is about — and descriptive where it carries meaning of
   * its own. An omitted `alt` is the decorative case, stated deliberately.
   */
  alt?: string
}) {
  const hero = manifest.heroes[name]
  // The fallback's own pixel size, so the element declares the master's aspect
  // ratio rather than a guess.
  const jpeg = fallback(name)
  const scale = Math.min(1, (jpeg?.width ?? manifest.fallbackWidth) / hero.width)
  return (
    // `display: contents`, so the picture element adds no box of its own and the
    // image keeps positioning itself against the hero section as before.
    <picture className="hero-picture">
      <source type="image/avif" srcSet={srcSet(name, 'avif')} sizes="100vw" />
      <source type="image/webp" srcSet={srcSet(name, 'webp')} sizes="100vw" />
      <img
        className={className}
        src={jpeg?.url}
        alt={alt}
        width={Math.round(hero.width * scale)}
        height={Math.round(hero.height * scale)}
        // Above the fold on every route that uses it, so it is not deferred.
        decoding="async"
        fetchPriority="high"
      />
    </picture>
  )
}
