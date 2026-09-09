import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PhotoGalleryCard } from './PhotoGalleryCard'
import { CROSS_COUNTRY_CODE } from '../services/countries'
import { fetchPhotoGalleries, galleriesForCountry, type PhotoGallery } from '../services/photoGalleries'

/** Enough to show the collection exists without competing with the evidence. */
const MAX_CARDS = 3

interface CountryPhotoGalleriesProps {
  countryName: string
  iso3: string
}

/**
 * Field photographs for one country, read from the gallery catalogue.
 *
 * The catalogue is the only source: galleries are not catalogue products, carry
 * no product type or pillar, and are dated by the field work rather than by
 * when a record was created. The band renders nothing at all when the country
 * has no galleries or the catalogue cannot be read, because photographs are
 * supplementary here and must never stand between a reader and the country's
 * evidence.
 *
 * The cross-country page shows galleries that record more than one country,
 * which is what makes them cross-country. A gallery recording no country at all
 * is not shown there: nothing states that it is global, and absence is not a
 * claim about scope.
 */
export function CountryPhotoGalleries({ countryName, iso3 }: CountryPhotoGalleriesProps) {
  const [galleries, setGalleries] = useState<PhotoGallery[]>([])

  useEffect(() => {
    const controller = new AbortController()
    setGalleries([])
    fetchPhotoGalleries(controller.signal)
      .then((all) => {
        setGalleries(iso3 === CROSS_COUNTRY_CODE
          ? all.filter((gallery) => gallery.countryIso3List.length > 1)
          : galleriesForCountry(all, iso3))
      })
      .catch(() => {
        // Supplementary content: an unavailable catalogue leaves the band out.
      })
    return () => controller.abort()
  }, [iso3])

  if (!galleries.length) return null

  const visible = galleries.slice(0, MAX_CARDS)

  return (
    <section className="country-galleries section-wrap" aria-labelledby="country-galleries-heading">
      <div className="country-section-heading">
        <div>
          <span className="kicker">DIEM in the field</span>
          <h2 id="country-galleries-heading">Photographs from {countryName}</h2>
        </div>
        <Link to={`/photo-galleries${iso3 === CROSS_COUNTRY_CODE ? '' : `?country=${iso3}`}`}>
          All photo galleries
        </Link>
      </div>
      <div className="country-galleries-grid">
        {visible.map((gallery) => (
          <PhotoGalleryCard key={gallery.id} gallery={gallery} headingLevel="h3" showCountry={false} />
        ))}
      </div>
    </section>
  )
}
