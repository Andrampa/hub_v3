import { useEffect, useMemo, useState } from 'react'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { fetchPhotoGalleries, type PhotoGallery } from '../services/photoGalleries'

function formatGalleryDate(date: Date) {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date)
}

function GalleryCard({ gallery }: { gallery: PhotoGallery }) {
  const [imageFailed, setImageFailed] = useState(false)
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
          <span>{gallery.countryName || gallery.countryIso3 || 'Regional'}</span>
          <time dateTime={gallery.date.toISOString()}>{formatGalleryDate(gallery.date)}</time>
        </div>
        <h2>{gallery.title}</h2>
        {gallery.summary && <p>{gallery.summary}</p>}
        <div className="gallery-card-footer">
          {gallery.eventOrRound && <span>{gallery.eventOrRound}</span>}
          <small>{gallery.credit}</small>
        </div>
      </div>
    </article>
  )
}

export default function PhotoGalleries() {
  const [galleries, setGalleries] = useState<PhotoGallery[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [country, setCountry] = useState('All countries')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetchPhotoGalleries(controller.signal)
      .then(setGalleries)
      .catch((reason: Error) => {
        if (reason.name !== 'AbortError') setError(reason.message)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [reloadKey])

  const countries = useMemo(() => [...new Set(galleries.map((gallery) => gallery.countryName).filter(Boolean))].sort(), [galleries])
  const visible = country === 'All countries' ? galleries : galleries.filter((gallery) => gallery.countryName === country)

  return (
    <>
      <SiteHeader active="about" />
      <main className="gallery-page">
        <section className="gallery-hero">
          <div className="section-wrap">
            <span className="eyebrow"><span /> DIEM in the field</span>
            <h1>Photo galleries</h1>
            <p>See how DIEM teams and partners collect evidence with farming communities in countries affected by food crises and shocks.</p>
            <a href="https://www.flickr.com/photos/faoemergencies/albums/" target="_blank" rel="noreferrer">Explore all FAO emergencies albums on Flickr ↗</a>
          </div>
        </section>
        <section className="gallery-catalogue section-wrap" aria-labelledby="gallery-heading">
          <div className="gallery-heading">
            <div><span className="kicker">Field evidence</span><h2 id="gallery-heading">Latest galleries</h2></div>
            {countries.length > 1 && (
              <label>Country<select value={country} onChange={(event) => setCountry(event.target.value)}><option>All countries</option>{countries.map((name) => <option key={name}>{name}</option>)}</select></label>
            )}
          </div>
          {loading && <div className="gallery-state" role="status"><span className="loader" /> Loading photo galleries…</div>}
          {!loading && error && <div className="gallery-state gallery-state--error" role="alert"><strong>Photo galleries are temporarily unavailable.</strong><span>{error}</span><button type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button></div>}
          {!loading && !error && visible.length === 0 && <div className="gallery-state"><strong>No published galleries found.</strong><span>Try another country or return later.</span></div>}
          {!loading && !error && visible.length > 0 && <div className="gallery-grid">{visible.map((gallery) => <GalleryCard key={gallery.id} gallery={gallery} />)}</div>}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
