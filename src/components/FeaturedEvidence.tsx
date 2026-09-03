import { Link } from 'react-router-dom'
import { CatalogContentCard } from './CatalogContentCard'
import type { ProductFamily } from '../lib/productFamilies'
import { CROSS_COUNTRY_CODE, countryDefinition, type CountryResource } from '../services/countries'
import { itemThumbnail } from '../services/arcgis'

type EvidenceFamily = ProductFamily<CountryResource>

/** One country per card until the grid is full, so the homepage sample stays geographically broad. */
function familyCountry(family: EvidenceFamily) {
  const code = family.variants.flatMap((variant) => variant.countries).find((value) => value !== CROSS_COUNTRY_CODE)
  return code ? countryDefinition(code).name : 'Cross-country'
}

function selectEvidence(families: EvidenceFamily[]) {
  const candidates = [...families]
    .sort((a, b) => b.latestModified - a.latestModified)
    .filter((family) => itemThumbnail(family.primary))
  const selected: EvidenceFamily[] = []
  const countries = new Set<string>()
  for (const family of candidates) {
    const country = familyCountry(family)
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

export function FeaturedEvidence({ families }: { families: EvidenceFamily[] }) {
  const evidence = selectEvidence(families)
  if (!evidence.length) return null

  return (
    <section className="featured-evidence" id="featured-evidence" aria-labelledby="featured-evidence-title">
      <div className="section-wrap">
        <div className="section-heading">
          <div><span className="kicker">Evidence in focus</span><h2 id="featured-evidence-title">Recently published across DIEM</h2></div>
          <Link to="/catalog">View all products <span aria-hidden="true">→</span></Link>
        </div>
        {/* Same card as the catalogue and country pages, so a product is characterized identically everywhere. */}
        <div className="card-grid featured-evidence-grid">
          {evidence.map((family) => <CatalogContentCard family={family} key={family.id} />)}
        </div>
      </div>
    </section>
  )
}
