import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { Link } from 'react-router-dom'
import { formatDate } from '../lib/catalog'
import { itemProductPath, itemThumbnail } from '../services/arcgis'
import type { CountryEditorialContent } from '../services/countryEditorial'

interface CountryEditorialProps {
  countryName: string
  content: CountryEditorialContent
}

function EditorialBanner({ source }: { source: string }) {
  const [available, setAvailable] = useState(true)

  useEffect(() => setAvailable(true), [source])

  if (!available) return null

  return <img className="country-editorial-banner-image" src={source} alt="" onError={() => setAvailable(false)} />
}

function RichText({
  value,
  format,
  compact = false,
}: {
  value: string
  format: 'plain' | 'html'
  compact?: boolean
}) {
  const className = compact
    ? 'country-editorial-richtext country-highlight-description'
    : 'country-editorial-richtext'
  if (format === 'plain') {
    return <div className={`${className} country-editorial-richtext--plain`}>{value}</div>
  }

  const html = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: compact
      ? ['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a']
      : ['p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'blockquote'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  })

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

export function CountryEditorial({ countryName, content }: CountryEditorialProps) {
  const { profile, highlights } = content
  if (!profile?.introContent && !highlights.length) return null

  const banner = profile?.heroImageUrl

  return (
    <section className="country-editorial" aria-labelledby="country-editorial-heading">
      <div className="section-wrap">
        {profile?.introContent && (
          <article className={`country-editorial-story${banner ? '' : ' country-editorial-story--no-image'}`}>
            {banner && (
              <div className="country-editorial-banner">
                <EditorialBanner source={banner} />
                <div className="country-editorial-banner-title">
                  <span>{profile.iso3}</span>
                  <strong>{profile.name || countryName}</strong>
                </div>
              </div>
            )}
            <div className="country-editorial-story-copy">
              <span className="kicker">{profile.isPreview ? 'Country context · preview' : 'Country context'}</span>
              <h2 id="country-editorial-heading">About {profile.name || countryName}</h2>
              <RichText value={profile.introContent} format={profile.contentFormat} />
            </div>
          </article>
        )}

        {highlights.length > 0 && (
          <div className="country-highlights">
            <div className="country-highlights-heading">
              <div>
                <span className="kicker">{content.isPreview ? 'Editorial preview' : 'Selected evidence'}</span>
                <h2 id={profile?.introContent ? undefined : 'country-editorial-heading'}>In evidence</h2>
              </div>
              {content.isPreview && <p>Demonstration selections from the most recently updated country evidence.</p>}
            </div>
            <div className={`country-highlight-grid country-highlight-grid--${Math.min(highlights.length, 2)}`}>
              {highlights.map(({ item, leadContent, leadFormat, headline, description, ctaLabel }) => {
                const thumbnail = itemThumbnail(item)
                return (
                  <div className="country-highlight-feature" key={item.id}>
                    {leadContent && (
                      <div className="country-highlight-lead">
                        <RichText value={leadContent} format={leadFormat} />
                      </div>
                    )}
                    <article className="country-highlight-card">
                      <Link className="country-highlight-image" to={itemProductPath(item)}>
                        {thumbnail ? <img src={thumbnail} alt="" loading="lazy" /> : <span aria-hidden="true">DIEM</span>}
                      </Link>
                      <div className="country-highlight-body">
                        <div className="country-highlight-meta">
                          <span>{item.productTypes[0] || item.type}</span>
                          <time dateTime={new Date(item.modified).toISOString()}>{formatDate(item.modified)}</time>
                        </div>
                        <h3>{headline}</h3>
                        {description && (
                          <RichText
                            value={description}
                            format={/<\/?[a-z][\s\S]*>/i.test(description) ? 'html' : 'plain'}
                            compact
                          />
                        )}
                        <div className="country-highlight-footer">
                          <Link to={itemProductPath(item)}>{ctaLabel}</Link>
                        </div>
                      </div>
                    </article>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
