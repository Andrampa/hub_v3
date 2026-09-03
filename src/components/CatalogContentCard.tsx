import { cleanText, formatDate } from '../lib/catalog'
import { itemDestination, itemThumbnail } from '../services/arcgis'
import {
  CROSS_COUNTRY_CODE,
  EVIDENCE_PATHWAYS,
  countryDefinition,
  type CountryResource,
  type EvidencePathway,
} from '../services/countries'
import type { ProductFamily } from '../lib/productFamilies'

/** Shared with the country pages so one product is labelled identically wherever it appears. */
const PATHWAY_ICONS: Record<EvidencePathway, string> = {
  'Regular monitoring': 'bi-activity',
  'Hazard impact': 'bi-bullseye',
  'Research & analysis': 'bi-journal-richtext',
  'Seasonal calendar': 'bi-calendar3',
}

export function pathwaySlug(value: string) {
  return value.toLowerCase().replace(/[^a-z]+/g, '-')
}

export function CatalogContentCard({ family }: { family: ProductFamily<CountryResource> }) {
  const item = family.primary
  const thumbnail = itemThumbnail(item)
  const summary = cleanText(item.snippet || item.description)
  const destination = itemDestination(item)
  const product = item.productTypes[0] || 'Unclassified'
  const pathways = EVIDENCE_PATHWAYS.filter((pathway) => (
    family.variants.some((variant) => variant.evidencePathways.includes(pathway))
  ))
  // The image accent follows the publisher-assigned pillar rather than a theme
  // guessed from the title, so the colour means the same thing on every surface.
  const accent = pathways.length ? pathwaySlug(pathways[0]) : 'unclassified'
  const countryCodes = [...new Set(family.variants.flatMap((variant) => variant.countries))]
    .filter((code) => code !== CROSS_COUNTRY_CODE)
  const countries = countryCodes.map(countryDefinition)
  const crossCountry = family.variants.some((variant) => variant.countries.includes(CROSS_COUNTRY_CODE))
  const visibleCountries = countries.slice(0, 2)
  const countryLabel = countries.length
    ? countries.map((country) => country.name).join(', ')
    : crossCountry ? 'Cross-country' : 'Country not assigned'

  return (
    <article className="content-card">
      <a
        className={`card-image card-image--${accent}`}
        href={destination}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${item.title}`}
      >
        {thumbnail ? <img src={thumbnail} alt="" loading="lazy" /> : <span>DIEM</span>}
        <span className={`type-badge${product === 'Unclassified' ? ' type-badge--unclassified' : ''}`}>{product}</span>
      </a>
      <div className="card-body">
        <div className="card-context">
          <span>{item.type}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={new Date(item.modified).toISOString()}>{formatDate(item.modified)}</time>
        </div>
        {pathways.length > 0 && (
          <ul className="catalog-pathways" aria-label="Evidence pathways">
            {pathways.map((pathway) => (
              <li className={`catalog-pathway catalog-pathway--${pathwaySlug(pathway)}`} key={pathway}>
                <i className={`bi ${PATHWAY_ICONS[pathway]}`} aria-hidden="true" />
                {pathway}
              </li>
            ))}
          </ul>
        )}
        <h3><a href={destination} target="_blank" rel="noreferrer">{item.title.trim()}</a></h3>
        <p>{summary || 'Open this resource to view its complete description and metadata.'}</p>
        <div className="card-footer">
          <span className="catalog-country" title={countryLabel}>
            {visibleCountries.length > 0 && (
              <span className="catalog-country-flags" role="img" aria-label={countryLabel}>
                {visibleCountries.map((country) => <i className={`flag flag-small flag-${country.iso3.toLowerCase()}`} aria-hidden="true" key={country.iso3} />)}
              </span>
            )}
            <span>{countries.length > 2 ? `${visibleCountries.map((country) => country.name).join(', ')} +${countries.length - 2}` : countryLabel}</span>
          </span>
        </div>
        {family.variants.length > 1 && (
          <nav className="card-languages" aria-label={`Available languages for ${item.title.trim()}`}>
            <span>Available in</span>
            <div>
              {family.languages.map(({ language, item: variant }) => (
                <a href={itemDestination(variant)} target="_blank" rel="noreferrer" key={variant.id}>
                  {language}
                </a>
              ))}
            </div>
          </nav>
        )}
      </div>
    </article>
  )
}
