import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CatalogContentCard } from './CatalogContentCard'
import type { ProductFamily } from '../lib/productFamilies'
import { CROSS_COUNTRY_CODE, countryDefinition, type CountryResource } from '../services/countries'
import { buildDistinctThumbnailIndex } from '../services/arcgis'

type EvidenceFamily = ProductFamily<CountryResource>

/** One country per card until the grid is full, so the homepage sample stays geographically broad. */
function familyCountry(family: EvidenceFamily) {
  const code = family.variants.flatMap((variant) => variant.countries).find((value) => value !== CROSS_COUNTRY_CODE)
  return code ? countryDefinition(code).name : 'Cross-country'
}

/**
 * Selection is by catalogue entry date and country spread only. It used to
 * require a thumbnail, which silently ranked the products carrying a shared
 * country basemap above newer ones with none; cards now render a typed panel
 * when there is no distinguishing image, so the image is no longer a gate.
 */
function selectEvidence(families: EvidenceFamily[]) {
  const candidates = [...families].sort((a, b) => b.latestCreated - a.latestCreated)
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
  const evidence = useMemo(() => selectEvidence(families), [families])
  const thumbnailIndex = useMemo(
    () => buildDistinctThumbnailIndex(families.flatMap((family) => family.variants)),
    [families],
  )
  if (!evidence.length) return null

  return (
    <section className="featured-evidence" id="featured-evidence" aria-labelledby="featured-evidence-title">
      <div className="section-wrap">
        <div className="section-heading">
          <div><span className="kicker">Evidence in focus</span><h2 id="featured-evidence-title">Recently added to the catalogue</h2></div>
          <Link to="/catalog">View all products <span aria-hidden="true">→</span></Link>
        </div>
        {/* Same card as the catalogue and country pages, so a product is characterized identically everywhere. */}
        <div className="card-grid featured-evidence-grid">
          {evidence.map((family) => <CatalogContentCard family={family} thumbnailIndex={thumbnailIndex} key={family.id} />)}
        </div>
      </div>
    </section>
  )
}
