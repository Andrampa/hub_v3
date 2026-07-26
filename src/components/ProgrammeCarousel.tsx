import { useEffect, useState } from 'react'
import type { ProgrammeSlide } from '../services/hubPromotions'

function destinationProps(destination?: string) {
  if (!destination) return {}
  const external = /^https?:\/\//i.test(destination)
  return external ? { target: '_blank', rel: 'noreferrer' } : {}
}

export function ProgrammeCarousel({ slides }: { slides: ProgrammeSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0)
  }, [activeIndex, slides.length])

  if (!slides.length) return null

  const activeSlide = slides[activeIndex]
  const selectPrevious = () => setActiveIndex((activeIndex - 1 + slides.length) % slides.length)
  const selectNext = () => setActiveIndex((activeIndex + 1) % slides.length)

  return (
    <section
      className="programme-carousel section-wrap"
      aria-roledescription="carousel"
      aria-labelledby="programme-carousel-title"
    >
      <div className="programme-carousel-heading">
        <div>
          <span className="kicker">Explore DIEM</span>
          <h2 id="programme-carousel-title">Evidence systems for changing risks</h2>
        </div>
        <p>Move through DIEM’s monitoring, assessment, research and anticipatory-action pathways.</p>
      </div>

      <div className="programme-carousel-frame">
        <article
          key={activeSlide.id}
          className="programme-slide"
          aria-label={`${activeIndex + 1} of ${slides.length}: ${activeSlide.title}`}
        >
          <img src={activeSlide.imageUrl} alt={activeSlide.imageAlt} />
          <div className="programme-slide-overlay" />
          <div className="programme-slide-content">
            <span>{activeSlide.eyebrow}</span>
            <h3>{activeSlide.title}</h3>
            <p>{activeSlide.description}</p>
            {activeSlide.destination && activeSlide.ctaLabel && (
              <a href={activeSlide.destination} {...destinationProps(activeSlide.destination)}>
                {activeSlide.ctaLabel}
                <span aria-hidden="true">→</span>
              </a>
            )}
          </div>
        </article>

        <button
          className="programme-carousel-arrow programme-carousel-arrow--previous"
          type="button"
          onClick={selectPrevious}
          aria-label="Previous DIEM programme"
        >
          <span aria-hidden="true">←</span>
        </button>
        <button
          className="programme-carousel-arrow programme-carousel-arrow--next"
          type="button"
          onClick={selectNext}
          aria-label="Next DIEM programme"
        >
          <span aria-hidden="true">→</span>
        </button>

        <div className="programme-carousel-pagination" aria-label="Choose a DIEM programme">
          {slides.map((slide, index) => (
            <button
              type="button"
              key={slide.id}
              className={index === activeIndex ? 'is-active' : ''}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show ${slide.title}`}
              aria-current={index === activeIndex ? 'true' : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
