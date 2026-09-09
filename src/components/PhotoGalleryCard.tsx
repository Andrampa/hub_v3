import { useState } from 'react'
import type { PhotoGallery } from '../services/photoGalleries'

function formatGalleryDate(date: Date) {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date)
}

interface PhotoGalleryCardProps {
  gallery: PhotoGallery
  /**
   * Heading level for the gallery title. The gallery page lists galleries as
   * its own content, while a country page nests them under a section heading,
   * so the same card has to sit at a different depth without repeating itself.
   */
  headingLevel?: 'h2' | 'h3'
  /** Hidden on a country page, where every card already shares one country. */
  showCountry?: boolean
}

/**
 * Catalogue titles are stored as '<place> | <description>'. Under a heading
 * that already names the country, that prefix is said three times on one
 * screen. It is dropped only when it repeats a name this gallery actually
 * records, so a title that leads with anything else is left as the editor
 * wrote it.
 */
function displayTitle(gallery: PhotoGallery, showCountry: boolean) {
  if (showCountry) return gallery.title
  const [prefix, ...rest] = gallery.title.split(' | ')
  const repeatsCountry = rest.length > 0
    && prefix.trim().toLowerCase() === gallery.countryName.trim().toLowerCase()
  return repeatsCountry ? rest.join(' | ') : gallery.title
}

export function PhotoGalleryCard({ gallery, headingLevel = 'h2', showCountry = true }: PhotoGalleryCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const Heading = headingLevel

  return (
    <article className={`gallery-card${gallery.featured ? ' gallery-card--featured' : ''}`}>
      <a className="gallery-card-image" href={gallery.flickrUrl} target="_blank" rel="noreferrer">
        {gallery.thumbnailUrl && !imageFailed
          ? <img src={gallery.thumbnailUrl} alt={gallery.thumbnailAlt} loading="lazy" onError={() => setImageFailed(true)} />
          : <span aria-hidden="true">DIEM</span>}
        <span>View on Flickr ↗</span>
      </a>
      <div className="gallery-card-copy">
        <div className="gallery-card-meta">
          {showCountry && <span>{gallery.countryName || gallery.countryIso3 || 'Regional'}</span>}
          <time dateTime={gallery.date.toISOString()}>{formatGalleryDate(gallery.date)}</time>
        </div>
        <Heading>{displayTitle(gallery, showCountry)}</Heading>
        {gallery.summary && <p>{gallery.summary}</p>}
        <div className="gallery-card-footer">
          {gallery.eventOrRound && <span>{gallery.eventOrRound}</span>}
          <small>{gallery.credit}</small>
        </div>
      </div>
    </article>
  )
}
