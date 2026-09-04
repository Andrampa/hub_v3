import DOMPurify from 'dompurify'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useCountryCatalog } from '../hooks/useCountryCatalog'
import { usePageMetadata } from '../hooks/usePageMetadata'
import { formatDate } from '../lib/catalog'
import { groupProductFamilies, itemLanguage } from '../lib/productFamilies'
import { CITATION_LANGUAGES, citationFor, citationRound, defaultCitationLanguage, type CitationLanguage } from '../lib/citation'
import { itemResourceAction, itemThumbnail } from '../services/arcgis'
import { countryDefinition, fetchCurrentCatalogProduct, pathwayLabel, type CountryResource } from '../services/countries'

type ProductState =
  | { status: 'loading' }
  | { status: 'available'; item: CountryResource }
  | { status: 'unavailable' }
  | { status: 'error'; message: string }

const PdfPreview = lazy(() => import('../components/PdfPreview').then((module) => ({ default: module.PdfPreview })))

/**
 * The licence a reuser needs before they download, rather than a paragraph of
 * boilerplate. ArcGIS `licenseInfo` is free HTML and averages a few hundred
 * bytes of it across the group, so a recognizable Creative Commons statement is
 * reduced to its name and left as a link; anything else is offered as the
 * publisher wrote it, behind a disclosure, and a product with no licence
 * recorded says nothing rather than implying one.
 */
const CC_LICENCES: Array<{ pattern: RegExp; label: string; href: string }> = [
  { pattern: /CC[\s-]?BY[\s-]?NC[\s-]?SA[\s-]?4/i, label: 'CC BY-NC-SA 4.0', href: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
  { pattern: /CC[\s-]?BY[\s-]?NC[\s-]?4/i, label: 'CC BY-NC 4.0', href: 'https://creativecommons.org/licenses/by-nc/4.0/' },
  { pattern: /CC[\s-]?BY[\s-]?SA[\s-]?4/i, label: 'CC BY-SA 4.0', href: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { pattern: /CC[\s-]?BY[\s-]?4|creativecommons\.org\/licenses\/by\/4/i, label: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' },
  { pattern: /CC[\s-]?BY[\s-]?NC[\s-]?SA[\s-]?3(\.0)?[\s-]?IGO/i, label: 'CC BY-NC-SA 3.0 IGO', href: 'https://creativecommons.org/licenses/by-nc-sa/3.0/igo/' },
  { pattern: /CC[\s-]?BY[\s-]?NC[\s-]?3(\.0)?[\s-]?IGO/i, label: 'CC BY-NC 3.0 IGO', href: 'https://creativecommons.org/licenses/by-nc/3.0/igo/' },
  { pattern: /CC[\s-]?BY[\s-]?SA[\s-]?3(\.0)?[\s-]?IGO/i, label: 'CC BY-SA 3.0 IGO', href: 'https://creativecommons.org/licenses/by-sa/3.0/igo/' },
  { pattern: /CC[\s-]?BY[\s-]?3|creativecommons\.org\/licenses\/by\/3/i, label: 'CC BY 3.0 IGO', href: 'https://creativecommons.org/licenses/by/3.0/igo/' },
]

function licenceFor(item: CountryResource) {
  const raw = item.licenseInfo?.trim()
  if (!raw) return undefined
  const text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  const known = CC_LICENCES.find((licence) => licence.pattern.test(text))
  return known
    ? { label: known.label, href: known.href }
    : { html: DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } }) }
}

function publicCategories(item: CountryResource) {
  return [...new Set((item.groupCategories || [])
    .filter((category) => !category.toLowerCase().includes('/catalog role/'))
    .map((category) => category.replace(/^\/categories\//i, '').split('/').join(' · ').trim())
    .filter(Boolean))]
}

export default function CatalogProduct() {
  const { itemId = '' } = useParams()
  const { catalog } = useCountryCatalog()
  const [state, setState] = useState<ProductState>({ status: 'loading' })
  const [copied, setCopied] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    let active = true
    setPreviewOpen(false)
    setState({ status: 'loading' })
    void fetchCurrentCatalogProduct(itemId)
      .then((item) => {
        if (active) setState(item ? { status: 'available', item } : { status: 'unavailable' })
      })
      .catch((error: unknown) => {
        if (active) setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'The ArcGIS catalogue could not be reached.',
        })
      })
    return () => { active = false }
  }, [itemId])

  const item = state.status === 'available' ? state.item : undefined

  /**
   * The citation offers the three reference forms DIEM publishes, and opens on
   * the product's own language where that is one of them, so the common case is
   * a copy without a choice.
   */
  const [chosenCitationLanguage, setChosenCitationLanguage] = useState<CitationLanguage>()
  const citationLanguage = chosenCitationLanguage || (item ? defaultCitationLanguage(item) : 'English')
  const setCitationLanguage = setChosenCitationLanguage
  /**
   * A product page is the one URL on the Hub worth indexing per product, so it
   * carries structured data naming the publisher, the catalogue date and the
   * stable item id. The id is cited rather than the title because titles are
   * edited in the content group and the id is not.
   */
  usePageMetadata({
    title: item?.title || (state.status === 'loading' ? undefined : 'Product unavailable'),
    description: item?.snippet?.trim() || (item ? `A DIEM product published through the DIEM Hub content group in ${formatDate(item.created)}.` : undefined),
    structuredData: item
      ? {
          '@type': 'CreativeWork',
          name: item.title,
          description: item.snippet?.trim(),
          identifier: item.id,
          url: `https://data-in-emergencies.fao.org/catalog/${item.id}`,
          datePublished: new Date(item.created).toISOString().slice(0, 10),
          inLanguage: itemLanguage(item),
          encodingFormat: item.type,
          isPartOf: { '@type': 'DataCatalog', name: 'DIEM Hub catalogue', url: 'https://data-in-emergencies.fao.org/catalog' },
          publisher: {
            '@type': 'Organization',
            name: 'Food and Agriculture Organization of the United Nations',
            alternateName: 'FAO',
            url: 'https://www.fao.org',
          },
        }
      : undefined,
  })
  const action = item ? itemResourceAction(item) : undefined
  const family = useMemo(() => {
    if (!catalog || !item) return undefined
    return groupProductFamilies([...catalog.items.filter((candidate) => candidate.id !== item.id), item])
      .find((candidate) => candidate.variants.some((variant) => variant.id === item.id))
  }, [catalog, item])
  const citationSiblings = family?.variants.filter((variant) => variant.id !== item?.id) || []
  const citation = item
    ? citationFor(item, citationLanguage, { round: citationRound(item, citationSiblings) })
    : undefined
  const countries = item?.countries.map(countryDefinition) || []
  const categories = item ? publicCategories(item) : []
  const licence = item ? licenceFor(item) : undefined
  const description = item?.description
    ? DOMPurify.sanitize(item.description, { USE_PROFILES: { html: true } })
    : undefined

  const copyCitation = async () => {
    if (!citation) return
    await navigator.clipboard.writeText(citation)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2200)
  }

  const openPreview = () => {
    setPreviewOpen(true)
    window.setTimeout(() => document.getElementById('product-preview-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  return (
    <>
      <SiteHeader />
      <main className="catalog-product-page" id="main-content">
        <div className="section-wrap">
          <nav className="catalog-product-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link><span aria-hidden="true">/</span>
            <Link to="/catalog">Catalogue</Link><span aria-hidden="true">/</span>
            <span aria-current="page">Product</span>
          </nav>

          {state.status === 'loading' && (
            <section className="catalog-product-status" role="status">
              <span className="loader" /><h1>Checking this product…</h1>
              <p>Confirming that it is still published in the DIEM Hub catalogue.</p>
            </section>
          )}
          {state.status === 'error' && (
            <section className="catalog-product-status" role="alert">
              <span className="kicker">Catalogue unavailable</span>
              <h1>We could not check this product</h1><p>{state.message}</p>
              <button type="button" onClick={() => window.location.reload()}>Try again</button>
            </section>
          )}
          {state.status === 'unavailable' && (
            <section className="catalog-product-status">
              <span className="kicker">Product unavailable</span>
              <h1>This product is no longer published in the DIEM Hub catalogue</h1>
              <p>It may have been withdrawn, moved or had its sharing changed in ArcGIS Online.</p>
              <div><Link to="/catalog">Browse the current catalogue</Link><Link to="/contact">Contact DIEM</Link></div>
            </section>
          )}
          {item && action && (
            <article className="catalog-product">
              <header className="catalog-product-hero">
                <div>
                  <span className="kicker">{item.productTypes.join(' · ')}</span>
                  <h1>{item.title.trim()}</h1>
                  <p>{item.snippet?.trim() || 'An authoritative product published through the DIEM Hub content group.'}</p>
                  {item.type === 'PDF' ? (
                    <div className="catalog-product-hero-actions">
                      <button className="catalog-product-action" type="button" onClick={openPreview}>Preview PDF <i className="bi bi-file-earmark-pdf" aria-hidden="true" /></button>
                      <a className="catalog-product-action catalog-product-action--secondary" href={action.href}>Download PDF <i className="bi bi-download" aria-hidden="true" /></a>
                    </div>
                  ) : (
                    <a className="catalog-product-action" href={action.href} target="_blank" rel="noreferrer">
                      {action.label}<i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                    </a>
                  )}
                  <p className="catalog-product-action-note">{item.type === 'PDF' ? 'Preview in the Hub or download the original file.' : 'Opens the authoritative resource in a new tab.'}</p>
                  {licence && (
                    <div className="catalog-product-licence">
                      {'label' in licence && licence.label ? (
                        <>Licence: <a href={licence.href} target="_blank" rel="noreferrer">{licence.label}</a></>
                      ) : (
                        <details>
                          <summary>Licence and conditions of use</summary>
                          <span dangerouslySetInnerHTML={{ __html: licence.html || '' }} />
                        </details>
                      )}
                    </div>
                  )}
                </div>
                {item.thumbnail && <img src={itemThumbnail(item)} alt="" />}
              </header>

              {/* Product details run across the page rather than down a column.
                  Most products carry no description - the overview is one line
                  or a photo credit - so a tall right-hand rail left a column of
                  white space beside it and pushed the citation below the fold. */}
              <section className="catalog-product-facts" aria-label="Product details">
                <dl>
                  <div><dt>Format</dt><dd>{item.type}</dd></div>
                  <div><dt>Added to catalogue</dt><dd><time dateTime={new Date(item.created).toISOString()}>{formatDate(item.created)}</time></dd></div>
                  <div><dt>Countries</dt><dd>{countries.length ? countries.map((country) => country.name).join(', ') : 'Not assigned'}</dd></div>
                  <div><dt>Evidence pathway</dt><dd>{item.evidencePathways.map(pathwayLabel).join(', ') || 'Not assigned'}</dd></div>
                  <div><dt>ArcGIS item ID</dt><dd><code>{item.id}</code></dd></div>
                </dl>
                {categories.length > 0 && (
                  <div className="catalog-product-categories">
                    <h2>Content categories</h2>
                    <ul>{categories.map((category) => <li key={category}>{category}</li>)}</ul>
                  </div>
                )}
              </section>

              <div className="catalog-product-layout">
                <section className="catalog-product-description" aria-labelledby="about-product">
                  <span className="kicker">About this product</span>
                  <h2 id="about-product">Overview</h2>
                  {description
                    ? <div dangerouslySetInnerHTML={{ __html: description }} />
                    : <p>No detailed description has been supplied for this product. Download or open the resource to see its content.</p>}

                  {family && family.languages.length > 1 && (
                    <div className="catalog-product-editions">
                      <h2>Available languages</h2>
                      <ul>{family.languages.map(({ language, item: variant }) => (
                        <li key={variant.id}><Link aria-current={variant.id === item.id ? 'page' : undefined} to={`/catalog/${variant.id}`}>{language}</Link></li>
                      ))}</ul>
                    </div>
                  )}
                </section>

                <section className="catalog-product-citation" aria-labelledby="citation-heading">
                  <div className="catalog-product-citation-head">
                    <h2 id="citation-heading">Citation</h2>
                    <div className="catalog-product-citation-languages" role="group" aria-label="Citation language">
                      {CITATION_LANGUAGES.map((language) => (
                        <button
                          type="button"
                          key={language}
                          aria-pressed={language === citationLanguage}
                          onClick={() => setCitationLanguage(language)}
                        >{language}</button>
                      ))}
                    </div>
                  </div>
                  <p>{citation}</p>
                  <button type="button" className="catalog-product-citation-copy" onClick={() => void copyCitation()}>{copied ? 'Citation copied' : 'Copy citation'}</button>
                </section>
              </div>

              {item.type === 'PDF' && (
                <section className="catalog-product-preview" aria-labelledby="product-preview-title">
                  <div className="catalog-product-preview-heading">
                    <div>
                      <span className="kicker">Document preview</span>
                      <h2 id="product-preview-title">Read the PDF in the Hub</h2>
                      <p>The document loads only when you request it. You can also download the original PDF.</p>
                    </div>
                    <div className="catalog-product-preview-actions">
                      <button
                        type="button"
                        aria-expanded={previewOpen}
                        aria-controls="product-pdf-preview"
                        onClick={() => setPreviewOpen((open) => !open)}
                      >
                        {previewOpen ? 'Hide preview' : 'Preview PDF'}
                      </button>
                      <a href={action.href}>Download PDF <i className="bi bi-download" aria-hidden="true" /></a>
                    </div>
                  </div>
                  {previewOpen && (
                    <div className="catalog-product-preview-frame" id="product-pdf-preview">
                      <Suspense fallback={<div className="catalog-pdf-loading" role="status"><span className="loader" />Preparing PDF viewer…</div>}>
                        <PdfPreview title={item.title.trim()} url={action.href} />
                      </Suspense>
                      <p>Preview unavailable or difficult to read? <a href={action.href}>Download the PDF</a>.</p>
                    </div>
                  )}
                </section>
              )}
            </article>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
