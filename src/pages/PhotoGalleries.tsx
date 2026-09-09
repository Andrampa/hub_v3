import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PhotoGalleryCard } from '../components/PhotoGalleryCard'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { countryDefinition } from '../services/countries'
import { fetchPhotoGalleries, type PhotoGallery } from '../services/photoGalleries'
import { usePageMetadata } from '../hooks/usePageMetadata'

const ALL_COUNTRIES = 'All countries'

/**
 * Filter options built from stored country codes.
 *
 * A gallery shared by two countries is offered under each of them, and a
 * gallery that records no code stays discoverable under 'All countries' rather
 * than being filed under a country nobody assigned it to. The label prefers the
 * canonical country name so the picker agrees with country pages.
 */
function countryOptions(galleries: PhotoGallery[]) {
  const names = new Map<string, string>()
  galleries.forEach((gallery) => {
    gallery.countryIso3List.forEach((code) => {
      if (names.has(code)) return
      const definition = countryDefinition(code)
      names.set(code, definition.name === code ? gallery.countryName || code : definition.name)
    })
  })
  return [...names.entries()]
    .map(([iso3, name]) => ({ iso3, name }))
    .sort((first, second) => first.name.localeCompare(second.name))
}

export default function PhotoGalleries() {
  usePageMetadata({
    title: 'Photo galleries',
    description: 'Photographs from DIEM field work: how teams and partners collect evidence with farming communities in countries affected by food crises and shocks, drawn from the FAO emergencies albums.',
  })
  const [galleries, setGalleries] = useState<PhotoGallery[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const [reloadKey, setReloadKey] = useState(0)

  const selectedCountry = (searchParams.get('country') || '').trim().toUpperCase()
  /**
   * Set when a legacy StoryMap wrapper's Hub address resolved to one gallery.
   * The reader asked for that gallery, so it is shown on its own, with a way
   * back to the full collection. An id that matches nothing falls back to the
   * whole listing rather than to an empty page.
   */
  const requestedGallery = (searchParams.get('gallery') || '').trim()

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

  const options = useMemo(() => countryOptions(galleries), [galleries])
  const single = requestedGallery
    ? galleries.find((gallery) => gallery.id === requestedGallery)
    : undefined
  const visible = single
    ? [single]
    : selectedCountry
      ? galleries.filter((gallery) => gallery.countryIso3List.includes(selectedCountry))
      : galleries

  function selectCountry(iso3: string) {
    const next = new URLSearchParams(searchParams)
    next.delete('gallery')
    if (iso3 === ALL_COUNTRIES) next.delete('country')
    else next.set('country', iso3)
    setSearchParams(next, { replace: true })
  }

  function showAll() {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  return (
    <>
      <SiteHeader />
      <main id="top" className="gallery-page">
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
            <div>
              <span className="kicker">Field evidence</span>
              <h2 id="gallery-heading">{single ? single.countryName || 'Photo gallery' : 'Latest galleries'}</h2>
              {single && <button type="button" className="gallery-show-all" onClick={showAll}>Show all photo galleries</button>}
            </div>
            {!single && options.length > 1 && (
              <label>Country<select value={selectedCountry || ALL_COUNTRIES} onChange={(event) => selectCountry(event.target.value)}><option>{ALL_COUNTRIES}</option>{options.map((option) => <option key={option.iso3} value={option.iso3}>{option.name}</option>)}</select></label>
            )}
          </div>
          {loading && <div className="gallery-state" role="status"><span className="loader" /> Loading photo galleries…</div>}
          {!loading && error && <div className="gallery-state gallery-state--error" role="alert"><strong>Photo galleries are temporarily unavailable.</strong><span>{error}</span><button type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button></div>}
          {!loading && !error && visible.length === 0 && <div className="gallery-state"><strong>No published galleries found.</strong><span>Try another country or return later.</span></div>}
          {!loading && !error && visible.length > 0 && <div className="gallery-grid">{visible.map((gallery) => <PhotoGalleryCard key={gallery.id} gallery={gallery} />)}</div>}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
