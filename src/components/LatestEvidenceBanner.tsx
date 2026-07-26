import { useMemo, useState } from 'react'
import { formatDate } from '../lib/catalog'
import { itemDestination } from '../services/arcgis'
import type { ArcGISItem } from '../types'

const FEATURED_TAGS = new Set(['impact assessment', 'country brief'])
const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
const MAX_ITEMS = 6

function isFeatured(item: ArcGISItem) {
  return item.tags?.some((tag) => FEATURED_TAGS.has(tag.trim().toLowerCase()))
}

function BannerItems({ items, duplicate = false }: { items: ArcGISItem[], duplicate?: boolean }) {
  return (
    <div className="latest-evidence-group" aria-hidden={duplicate || undefined}>
      {items.map((item) => {
        const recent = Date.now() - item.modified <= NEW_WINDOW_MS
        return (
          <article className="latest-evidence-item" key={`${duplicate ? 'duplicate-' : ''}${item.id}`}>
            {recent && <span className="latest-evidence-new">New</span>}
            <time dateTime={new Date(item.modified).toISOString()}>{formatDate(item.modified)}</time>
            <span>{item.type}</span>
            <a
              href={itemDestination(item)}
              target="_blank"
              rel="noreferrer"
              tabIndex={duplicate ? -1 : undefined}
            >
              {item.title.trim()}
            </a>
          </article>
        )
      })}
    </div>
  )
}

export function LatestEvidenceBanner({ items }: { items: ArcGISItem[] }) {
  const [userPaused, setUserPaused] = useState(false)
  const [interactionPaused, setInteractionPaused] = useState(false)
  const featured = useMemo(
    () => items.filter(isFeatured).sort((a, b) => b.modified - a.modified).slice(0, MAX_ITEMS),
    [items],
  )
  const paused = userPaused || interactionPaused

  if (!featured.length) return null

  return (
    <section className="latest-evidence" aria-labelledby="latest-evidence-title">
      <div className="latest-evidence-label">
        <span id="latest-evidence-title">Latest evidence</span>
        <button
          type="button"
          onClick={() => setUserPaused((value) => !value)}
          aria-pressed={userPaused}
        >
          {userPaused ? 'Play' : 'Pause'}
          <span aria-hidden="true">{userPaused ? '▶' : 'Ⅱ'}</span>
        </button>
      </div>
      <div
        className="latest-evidence-viewport"
        onMouseEnter={() => setInteractionPaused(true)}
        onMouseLeave={() => setInteractionPaused(false)}
        onFocus={() => setInteractionPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false)
        }}
      >
        <div className={`latest-evidence-track${paused ? ' is-paused' : ''}`}>
          <BannerItems items={featured} />
          <BannerItems items={featured} duplicate />
        </div>
      </div>
      <a className="latest-evidence-all" href="#catalog">View catalog</a>
    </section>
  )
}
