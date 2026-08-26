import { Link } from 'react-router-dom'
import { cleanText, formatDate, itemCountry } from '../lib/catalog'
import type { ProductFamily } from '../lib/productFamilies'
import { itemDestination, itemThumbnail } from '../services/arcgis'

function selectEvidence(families: ProductFamily[]) {
  const candidates = [...families]
    .sort((a, b) => b.latestModified - a.latestModified)
    .filter((family) => itemThumbnail(family.primary))
  const selected: ProductFamily[] = []
  const countries = new Set<string>()
  for (const family of candidates) {
    const country = itemCountry(family.primary) || 'Cross-country'
    if (countries.has(country)) continue
    selected.push(family)
    countries.add(country)
    if (selected.length === 8) return selected
  }
  for (const family of candidates) {
    if (selected.some((item) => item.id === family.id)) continue
    selected.push(family)
    if (selected.length === 8) break
  }
  return selected
}

export function FeaturedEvidence({ families }: { families: ProductFamily[] }) {
  const evidence = selectEvidence(families)
  if (!evidence.length) return null

  return (
    <section className="featured-evidence" id="featured-evidence" aria-labelledby="featured-evidence-title">
      <div className="section-wrap">
        <div className="section-heading">
          <div><span className="kicker">Evidence in focus</span><h2 id="featured-evidence-title">Recently published across DIEM</h2></div>
          <Link to="/catalog">View all products <span aria-hidden="true">→</span></Link>
        </div>
        <div className="featured-evidence-grid">
          {evidence.map((family) => {
            const item = family.primary
            const destination = itemDestination(item)
            return (
              <article className="featured-evidence-card" key={family.id}>
                <a href={destination} target="_blank" rel="noreferrer" className="featured-evidence-image" aria-label={`Open ${item.title}`}>
                  <img src={itemThumbnail(item)} alt="" loading="lazy" />
                </a>
                <div className="featured-evidence-body">
                  <div><span>{item.type}</span><time dateTime={new Date(item.modified).toISOString()}>{formatDate(item.modified)}</time></div>
                  <h3><a href={destination} target="_blank" rel="noreferrer">{item.title.trim()}</a></h3>
                  <p>{cleanText(item.snippet || item.description) || 'Open the resource for its complete description and metadata.'}</p>
                  <span>{itemCountry(item) || 'Cross-country'}</span>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
