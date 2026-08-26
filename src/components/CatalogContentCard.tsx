import { cleanText, formatDate, itemTheme } from '../lib/catalog'
import { itemDestination, itemThumbnail } from '../services/arcgis'
import { countryDefinition, itemCountryCodes, itemHasMultiCountryScope } from '../services/countries'
import type { ProductFamily } from '../lib/productFamilies'

export function CatalogContentCard({ family }: { family: ProductFamily }) {
  const item = family.primary
  const thumbnail = itemThumbnail(item)
  const summary = cleanText(item.snippet || item.description)
  const theme = itemTheme(item)
  const destination = itemDestination(item)
  const countryCodes = [...new Set(family.variants.flatMap(itemCountryCodes))]
  const countries = countryCodes.map(countryDefinition)
  const multiCountry = family.variants.some(itemHasMultiCountryScope)
  const visibleCountries = countries.slice(0, 2)
  const countryLabel = countries.length
    ? countries.map((country) => country.name).join(', ')
    : multiCountry ? 'Cross-country' : 'Country not assigned'

  return (
    <article className="content-card">
      <a
        className={`card-image card-image--${theme.toLowerCase().replaceAll(' ', '-')}`}
        href={destination}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${item.title}`}
      >
        {thumbnail ? <img src={thumbnail} alt="" loading="lazy" /> : <span>DIEM</span>}
        <span className="type-badge">{item.type}</span>
      </a>
      <div className="card-body">
        <div className="card-context">
          <span>{theme}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={new Date(item.modified).toISOString()}>{formatDate(item.modified)}</time>
        </div>
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
