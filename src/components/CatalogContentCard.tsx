import { Link } from 'react-router-dom'
import { distinctSummary, formatDate, itemEdition } from '../lib/catalog'
import { distinctThumbnail, itemProductPath, itemThumbnail } from '../services/arcgis'
import {
  CROSS_COUNTRY_CODE,
  EVIDENCE_PATHWAYS,
  UNRECORDED_PRODUCT_TYPE,
  pathwayLabel,
  UNRECORDED_PRODUCT_TYPE_LABEL,
  countryDefinition,
  type CountryResource,
  type EvidencePathway,
} from '../services/countries'
import { UNRECORDED_LANGUAGE, itemLanguage, type ProductFamily } from '../lib/productFamilies'

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

export function CatalogContentCard({
  family,
  thumbnailIndex,
}: {
  family: ProductFamily<CountryResource>
  /** Thumbnail names unique in the catalogue; see buildDistinctThumbnailIndex. */
  thumbnailIndex: Set<string>
}) {
  const item = family.primary
  const thumbnail = itemThumbnail(item)
  const summary = distinctSummary(item)
  // Most of the group shares a per-country basemap or an ArcGIS default, so the
  // image alone cannot tell one product in a series from the next. The round is
  // marked on those cards; a thumbnail that is unique to its product is left clean.
  const edition = distinctThumbnail(item, thumbnailIndex) ? undefined : itemEdition(item)
  const destination = itemProductPath(item)
  const soleLanguage = itemLanguage(item)
  const recordedType = item.productTypes.find((type) => type !== UNRECORDED_PRODUCT_TYPE)
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
      <Link
        className={`card-image card-image--${accent}`}
        to={destination}
        aria-label={`Open ${item.title}`}
      >
        {thumbnail
          ? <img src={thumbnail} alt="" loading="lazy" width={800} height={500} />
          : <span className="card-image-plate">{edition}</span>}
        {thumbnail && edition && <span className="card-edition">{edition}</span>}
        <span className={`type-badge${recordedType ? '' : ' type-badge--unclassified'}`}>{recordedType || UNRECORDED_PRODUCT_TYPE_LABEL}</span>
      </Link>
      <div className="card-body">
        {/* `created` is when the product entered the catalogue. `modified` is the
            last edit to the ArcGIS record, which bulk re-categorization rewrites,
            so it is never presented here as if it were a publication date. */}
        <div className="card-context">
          <span>{item.type}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={new Date(item.created).toISOString()}>Added {formatDate(item.created)}</time>
        </div>
        {pathways.length > 0 && (
          <ul className="catalog-pathways" aria-label="Evidence pathways">
            {pathways.map((pathway) => (
              <li className={`catalog-pathway catalog-pathway--${pathwaySlug(pathway)}`} key={pathway}>
                <i className={`bi ${PATHWAY_ICONS[pathway]}`} aria-hidden="true" />
                {pathwayLabel(pathway)}
              </li>
            ))}
          </ul>
        )}
        <h3><Link to={destination}>{item.title.trim()}</Link></h3>
        {summary && <p>{summary}</p>}
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
        {/* A list, not a <nav>. As a landmark every card added an entry to the
            screen-reader landmark menu, burying the page's real regions under
            one "Available languages for ..." per card.

            Shown for a single edition too, so that a one-language product can
            be told from one whose other editions failed to group; a lone
            edition is stated rather than linked, because the link would lead
            back to the card the reader is already on. A record that declares no
            language says nothing at all rather than announcing the gap to a
            reader who cannot act on it. */}
        {(family.variants.length > 1 || soleLanguage !== UNRECORDED_LANGUAGE) && (
        <div className="card-languages">
          <span id={`languages-${item.id}`}>Available in</span>
          {family.variants.length > 1 ? (
            <ul aria-labelledby={`languages-${item.id}`}>
              {family.languages.map(({ language, item: variant }) => (
                <li key={variant.id}>
                  <Link to={itemProductPath(variant)}>
                    {language}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <span className="card-language-only">{soleLanguage}</span>
          )}
        </div>
        )}
      </div>
    </article>
  )
}
