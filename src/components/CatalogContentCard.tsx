import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { distinctSummary, formatDate, itemEdition, itemTypeLabel } from '../lib/catalog'
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
  roundEditionOnly = false,
  linkedTags = false,
}: {
  family: ProductFamily<CountryResource>
  /** Thumbnail names unique in the catalogue; see buildDistinctThumbnailIndex. */
  thumbnailIndex: Set<string>
  /** Homepage cards need a round marker, but not a year repeated above the full added date. */
  roundEditionOnly?: boolean
  /** Homepage discovery tags confirm before leaving for a broader result set. */
  linkedTags?: boolean
}) {
  const navigate = useNavigate()
  const [relatedDestination, setRelatedDestination] = useState<{ label: string, to: string }>()
  const dialogRef = useRef<HTMLDivElement>(null)
  const item = family.primary
  const thumbnail = itemThumbnail(item)
  const summary = distinctSummary(item)
  // Most of the group shares a per-country basemap or an ArcGIS default, so the
  // image alone cannot tell one product in a series from the next. The round is
  // marked on those cards; a thumbnail that is unique to its product is left clean.
  const inferredEdition = distinctThumbnail(item, thumbnailIndex) ? undefined : itemEdition(item)
  const edition = roundEditionOnly && !inferredEdition?.startsWith('Round ') ? undefined : inferredEdition
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

  useEffect(() => {
    if (!relatedDestination) return
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRelatedDestination(undefined)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [relatedDestination])

  const offerRelated = (label: string, to: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    setRelatedDestination({ label, to })
  }

  return (
    <article className="content-card">
      {/* The image is a pointer shortcut to the destination the title links to,
          not a second keyboard stop to the same URL: it is an empty overlay
          link, out of the tab order and out of the accessibility tree. The
          product type, edition and image sit outside it, so nothing a reader
          needs is hidden along with the duplicate stop. */}
      <div className={`card-image card-image--${accent}`}>
        {thumbnail
          ? <img src={thumbnail} alt="" loading="lazy" width={800} height={500} />
          : <span className="card-image-plate">{edition}</span>}
        {thumbnail && edition && <span className="card-edition">{edition}</span>}
        <span className={`type-badge${recordedType ? '' : ' type-badge--unclassified'}`}>{recordedType || UNRECORDED_PRODUCT_TYPE_LABEL}</span>
        <Link className="card-media-link" to={destination} tabIndex={-1} aria-hidden="true" />
      </div>
      <div className="card-body">
        {/* `created` is when the product entered the catalogue. `modified` is the
            last edit to the ArcGIS record, which bulk re-categorization rewrites,
            so it is never presented here as if it were a publication date. */}
        <div className="card-context">
          <span>{itemTypeLabel(item)}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={new Date(item.created).toISOString()}>Added {formatDate(item.created)}</time>
        </div>
        {pathways.length > 0 && (
          <ul className="catalog-pathways" aria-label="Evidence pathways">
            {pathways.map((pathway) => {
              const content = <><i className={`bi ${PATHWAY_ICONS[pathway]}`} aria-hidden="true" />{pathwayLabel(pathway)}</>
              return (
                <li className={`catalog-pathway catalog-pathway--${pathwaySlug(pathway)}`} key={pathway}>
                  {linkedTags
                    ? <Link className="catalog-tag-link" to={`/catalog?pathway=${encodeURIComponent(pathway)}`} onClick={offerRelated(pathwayLabel(pathway), `/catalog?pathway=${encodeURIComponent(pathway)}`)}>{content}</Link>
                    : content}
                </li>
              )
            })}
          </ul>
        )}
        <h3><Link to={destination}>{item.title.trim()}</Link></h3>
        {summary && <p>{summary}</p>}
        <div className="card-footer">
          <span className="catalog-country" title={countryLabel}>
            {linkedTags && visibleCountries.length > 0 ? visibleCountries.map((country, index) => (
              <span className="catalog-country-entry" key={country.iso3}>
                {index > 0 && <span aria-hidden="true">, </span>}
                <Link className="catalog-country-link" to={`/countries/${country.iso3.toLowerCase()}`} onClick={offerRelated(country.name, `/countries/${country.iso3.toLowerCase()}`)}>
                  <i className={`flag flag-small flag-${country.iso3.toLowerCase()}`} aria-hidden="true" />
                  <span>{country.name}</span>
                </Link>
              </span>
            )) : (
              <>
                {visibleCountries.length > 0 && <span className="catalog-country-flags" aria-hidden="true">{visibleCountries.map((country) => <i className={`flag flag-small flag-${country.iso3.toLowerCase()}`} key={country.iso3} />)}</span>}
                <span>{countryLabel}</span>
              </>
            )}
            {linkedTags && countries.length > 2 && <span> +{countries.length - 2}</span>}
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
      {relatedDestination && (
        <div className="related-dialog-backdrop" onClick={() => setRelatedDestination(undefined)}>
          <div className="related-dialog" role="dialog" aria-modal="true" aria-labelledby={`related-dialog-${item.id}`} tabIndex={-1} ref={dialogRef} onClick={(event) => event.stopPropagation()}>
            <span className="kicker">Explore related evidence</span>
            <h2 id={`related-dialog-${item.id}`}>See all products related to {relatedDestination.label}?</h2>
            <p>You’ll leave this page and open the related collection.</p>
            <div className="related-dialog-actions">
              <button type="button" onClick={() => navigate(relatedDestination.to)}>Yes, show products</button>
              <button type="button" onClick={() => setRelatedDestination(undefined)}>No, stay here</button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
