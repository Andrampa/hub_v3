import { useEffect, useRef, useState, type CSSProperties } from 'react'
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
  const [{ active, previous, transitioning, leavingTransform }, setSlide] = useState({
    active: 0, previous: -1, transitioning: false, leavingTransform: '',
  })
  const slidesRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState === 'visible')
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  // The pan starts a frame after a slide becomes active. Setting both at once
  // left the first slide, active from its first paint, with no change for the
  // pan transition to run from.
  const [panning, setPanning] = useState(-1)
  // Preload just the next frame halfway through this slide's display time.
  const [preloadNext, setPreloadNext] = useState(false)
  const motionStopped = !visible || !pageVisible

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReducedMotion(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    if (slidesRef.current) observer.observe(slidesRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onChange = () => setPageVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  useEffect(() => {
    if (motionStopped || reducedMotion) return
    const timer = window.setTimeout(() => setPreloadNext(true), SLIDE_MS / 2)
    return () => window.clearTimeout(timer)
  }, [active, motionStopped, reducedMotion])

  useEffect(() => {
    if (motionStopped || reducedMotion) return
    const timer = window.setInterval(() => {
      const outgoing = slidesRef.current?.querySelector('.hero-slide.is-active')
      const transform = outgoing ? getComputedStyle(outgoing).transform : ''
      setPreloadNext(false)
      // The outgoing and entering frames must be present in the same render.
      setSlide(({ active: index }) => ({ active: (index + 1) % SLIDES.length, previous: index, transitioning: true, leavingTransform: transform }))
    }, SLIDE_MS)
    return () => window.clearInterval(timer)
  }, [motionStopped, reducedMotion])

  useEffect(() => {
    if (motionStopped || reducedMotion) return
    // Long enough for the starting position to be painted before the pan
    // begins. A timer rather than animation frames, which a browser withholds
    // from a page it considers hidden.
    const timer = window.setTimeout(() => setPanning(active), 80)
    return () => window.clearTimeout(timer)
  }, [active, motionStopped, reducedMotion])

  useEffect(() => {
    if (previous < 0 || motionStopped) return
    const timer = window.setTimeout(() => {
      setSlide((current) => current.active === active ? { ...current, previous: -1, transitioning: false, leavingTransform: '' } : current)
    }, TRANSITION_MS)
    return () => window.clearTimeout(timer)
  }, [active, previous, motionStopped])

  const next = (active + 1) % SLIDES.length
  const mounted = [active, ...(previous >= 0 ? [previous] : []), ...(preloadNext && !motionStopped && !reducedMotion ? [next] : [])]

  const slideClass = (index: number) => [
    'hero-image hero-slide',
    index === active && ' is-active',
    index === active && index === panning && ' is-panning',
    transitioning && index === active && ' is-entering',
    transitioning && index === previous && ' is-leaving',
  ].filter(Boolean).join('')

  return (
    <>
      <div className="hero-slides" aria-hidden="true" ref={slidesRef}>
        {[...new Set(mounted)].sort((a, b) => a - b).map((index) => {
          const slide = SLIDES[index]
          return (
            <HeroImage
              key={slide.name}
              name={slide.name}
              className={slideClass(index)}
              priority={index === 0 && active === 0}
              style={{ '--hero-slide-y': slide.y, ...(index === previous && leavingTransform ? { transform: leavingTransform, transition: 'none' } : {}) } as CSSProperties}
            />
          )
        })}
      </div>
      <HeroCredit name={SLIDES[active].name} />
    </>
  )
}
