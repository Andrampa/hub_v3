import { useEffect, useState, type CSSProperties } from 'react'
import { HeroCredit } from './HeroCredit'
import { HeroImage, type HeroName } from './HeroImage'

/**
 * The homepage photographs, rotating behind the hero copy.
 *
 * Several fieldwork scenes rather than one, so no single respondent becomes the
 * permanent face of the site: interviews mixed with the hazards DIEM assesses
 * (earthquake, flood) and the cultivation it protects. Each new photograph rises
 * over the last in six staggered columns, like bars in a chart. The first slide
 * is also what reduced-motion and no-script visitors keep. `y` is each frame's
 * vertical crop.
 */
const SLIDES: Array<{ name: HeroName, y: string }> = [
  { name: 'drc-phone-interview-round-8-2024', y: '40%' },
  { name: 'syria-earthquake-assessment-2023', y: '45%' },
  { name: 'afghanistan-mountain-interview-2025', y: '45%' },
  { name: 'car-ouadda-interview-2024', y: '30%' },
  { name: 'bangladesh-haor-flood-2024', y: '58%' },
  { name: 'guatemala-maize-field-interview-2022', y: '40%' },
  { name: 'afghanistan-terraced-valley-interview-2023', y: '45%' },
  { name: 'drc-ndjili-rice-harvest-2025', y: '45%' },
  { name: 'car-cooking-fire-interview-2024', y: '25%' },
  { name: 'drc-banana-motorbike-road-2023', y: '55%' },
  { name: 'car-bria-interview-2024', y: '40%' },
  { name: 'syria-earthquake-farm-damage-2023', y: '55%' },
  { name: 'drc-ndjili-rice-threshing-2025', y: '40%' },
  { name: 'afghanistan-market-interview-2023', y: '45%' },
  { name: 'drc-ndjili-river-canoe-2025', y: '60%' },
  { name: 'colombia-quipama-doorstep-2023', y: '35%' },
  { name: 'drc-lakeshore-fish-cleaning-2023', y: '50%' },
  { name: 'drc-ndjili-rice-inspection-2025', y: '82%' },
  { name: 'drc-ndjili-riverbank-canoes-2025', y: '55%' },
  { name: 'drc-ndjili-threshing-team-2025', y: '38%' },
  { name: 'pakistan-sheep-flock-2022', y: '60%' },
  { name: 'drc-diem-officers-2023', y: '25%' },
]

// Keep in step with the pan duration in fao-adaptation.css.
const SLIDE_MS = 6000
// Longer than the strip reveal in fao-adaptation.css.
const TRANSITION_MS = 1500

export function HomeHeroSlideshow() {
  const [active, setActive] = useState(0)
  // The slide being covered, kept visible beneath the reveal.
  const [previous, setPrevious] = useState(-1)
  const [transitioning, setTransitioning] = useState(false)
  // The pan starts a frame after a slide becomes active. Setting both at once
  // left the first slide, active from its first paint, with no change for the
  // pan transition to run from.
  const [panning, setPanning] = useState(-1)
  // Slides are mounted one ahead of the one showing, so each is ready before it
  // appears. The second waits a moment, so its download and decode do not
  // compete with the first paint and the first slide's drift.
  const [mounted, setMounted] = useState(1)

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted((count) => Math.max(count, 2)), SLIDE_MS / 2)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      // A background tab keeps its place instead of cycling unseen.
      if (document.visibilityState !== 'visible') return
      setActive((index) => {
        setPrevious(index)
        return (index + 1) % SLIDES.length
      })
    }, SLIDE_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (active > 0) setMounted((count) => Math.max(count, Math.min(SLIDES.length, active + 2)))
    // Long enough for the starting position to be painted before the pan
    // begins. A timer rather than animation frames, which a browser withholds
    // from a page it considers hidden.
    const timer = window.setTimeout(() => setPanning(active), 80)
    return () => window.clearTimeout(timer)
  }, [active])

  useEffect(() => {
    if (previous < 0) return
    setTransitioning(true)
    const timer = window.setTimeout(() => setTransitioning(false), TRANSITION_MS)
    return () => window.clearTimeout(timer)
  }, [active, previous])

  const slideClass = (index: number) => [
    'hero-image hero-slide',
    index === active && ' is-active',
    index === active && index === panning && ' is-panning',
    transitioning && index === active && ' is-entering',
    transitioning && index === previous && ' is-leaving',
  ].filter(Boolean).join('')

  return (
    <>
      <div className="hero-slides" aria-hidden="true">
        {SLIDES.slice(0, mounted).map((slide, index) => (
          <HeroImage
            key={slide.name}
            name={slide.name}
            className={slideClass(index)}
            priority={index === 0}
            style={{ '--hero-slide-y': slide.y } as CSSProperties}
          />
        ))}
      </div>
      <HeroCredit name={SLIDES[active].name} />
    </>
  )
}
