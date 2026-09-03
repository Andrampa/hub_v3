const DEFAULT_PHOTO_GALLERY_SERVICE_URL = 'https://services5.arcgis.com/sjP4Ugu5s0dZWLjd/arcgis/rest/services/DIEM_Hub_3.0_%E2%80%94_Photo_gallery_catalogue/FeatureServer/0'

export interface PhotoGallery {
  id: string
  title: string
  summary: string
  flickrUrl: string
  thumbnailUrl: string
  thumbnailAlt: string
  countryIso3: string
  countryName: string
  eventOrRound: string
  date: Date
  featured: boolean
  displayOrder: number
  credit: string
}

interface GalleryAttributes {
  gallery_id?: string
  title?: string
  summary?: string
  flickr_url?: string
  thumbnail_url?: string
  thumbnail_alt?: string
  country_iso3?: string
  country_name?: string
  event_or_round?: string
  gallery_date?: number | string
  featured?: number
  display_order?: number
  credit?: string
}

interface GalleryQueryResponse {
  features?: Array<{ attributes: GalleryAttributes }>
  exceededTransferLimit?: boolean
  error?: { message?: string }
}

const PAGE_SIZE = 100

function serviceUrl() {
  const configured = import.meta.env.VITE_PHOTO_GALLERY_SERVICE_URL?.trim()
  return (configured || DEFAULT_PHOTO_GALLERY_SERVICE_URL).replace(/\/$/, '')
}

function safeExternalUrl(value: string | undefined, kind: 'flickr' | 'thumbnail') {
  if (!value) return ''
  try {
    const url = new URL(value)
    const isFlickrGallery = kind === 'flickr'
      && url.protocol === 'https:'
      && url.hostname === 'www.flickr.com'
      && /^\/photos\/faoemergencies\/(?:albums|sets)\//.test(url.pathname)
    const isFlickrImage = kind === 'thumbnail'
      && url.protocol === 'https:'
      && url.hostname === 'live.staticflickr.com'
    return isFlickrGallery || isFlickrImage ? url.href : ''
  } catch {
    return ''
  }
}

function normalizeGallery(attributes: GalleryAttributes): PhotoGallery | undefined {
  const id = String(attributes.gallery_id || '').trim()
  const title = String(attributes.title || '').trim()
  const flickrUrl = safeExternalUrl(attributes.flickr_url, 'flickr')
  const rawDate = attributes.gallery_date
  const date = new Date(typeof rawDate === 'number' ? rawDate : String(rawDate || ''))
  if (!id || !title || !flickrUrl || Number.isNaN(date.getTime())) return undefined

  return {
    id,
    title,
    summary: String(attributes.summary || '').trim(),
    flickrUrl,
    thumbnailUrl: safeExternalUrl(attributes.thumbnail_url, 'thumbnail'),
    thumbnailAlt: String(attributes.thumbnail_alt || '').trim(),
    countryIso3: String(attributes.country_iso3 || '').trim().toUpperCase(),
    countryName: String(attributes.country_name || '').trim(),
    eventOrRound: String(attributes.event_or_round || '').trim(),
    date,
    featured: Number(attributes.featured) === 1,
    displayOrder: Number(attributes.display_order) || 0,
    credit: String(attributes.credit || 'FAO emergencies / Flickr').trim(),
  }
}

export async function fetchPhotoGalleries(signal?: AbortSignal): Promise<PhotoGallery[]> {
  const galleries: PhotoGallery[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams({
      f: 'json',
      where: "publication_status = 'Published'",
      outFields: 'gallery_id,title,summary,flickr_url,thumbnail_url,thumbnail_alt,country_iso3,country_name,event_or_round,gallery_date,featured,display_order,credit',
      orderByFields: 'gallery_date DESC, display_order ASC',
      returnGeometry: 'false',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
    })
    const response = await fetch(`${serviceUrl()}/query?${params}`, { signal })
    if (!response.ok) throw new Error(`Photo gallery service request failed (${response.status})`)
    const data = await response.json() as GalleryQueryResponse
    if (data.error) throw new Error(data.error.message || 'Photo gallery service request failed')
    const page = (data.features || [])
      .map(({ attributes }) => normalizeGallery(attributes))
      .filter((gallery): gallery is PhotoGallery => Boolean(gallery))
    galleries.push(...page)
    hasMore = Boolean(data.exceededTransferLimit) && page.length > 0
    offset += PAGE_SIZE
  }

  return galleries
}
