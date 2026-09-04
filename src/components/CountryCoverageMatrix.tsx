import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { type CountryResource, type CountrySummary, type ProductType } from '../services/countries'
import type { ProductFamily } from '../lib/productFamilies'

/**
 * Which countries have which kinds of evidence, as one grid. The directory
 * answers that country by country, so learning that Niger has briefs but no
 * seasonal calendar and Somalia the reverse means opening 54 pages; the shape
 * of the collection is the one thing no existing surface shows.
 *
 * Counts are of product families, not records, so a cell agrees with the number
 * the catalogue shows when the reader follows it: two language editions of one
 * brief are one product in both places. Every cell is a link into the catalogue
 * with the country and product type already applied.
 */
interface CoverageRow {
  country: CountrySummary
  total: number
  counts: Map<ProductType, number>
}

/**
 * Column order and grouping. Products from the household monitoring system sit
 * together under one tint so the survey cycle reads as one block rather than as
 * four unrelated columns; the remaining groups keep the neutral ground until
 * they are given their own.
 *
 * `DIEM EVE` is left out: it is a superseded tag whose products are carried by
 * `EVE flood reports`, and showing both invites a reader to compare a live
 * column against a retired one.
 */
const COLUMN_GROUPS: Array<{ id: string; types: ProductType[] }> = [
  { id: 'monitoring', types: ['Country Briefs', 'Key Findings Presentations', 'Questionnaires', 'Photo gallery'] },
  { id: 'assessment', types: ['Assessment Reports', 'EVE flood reports'] },
  { id: 'other', types: ['Crop calendar', 'Storymaps', 'Other DIEM documents'] },
]

const ORDERED_TYPES = COLUMN_GROUPS.flatMap((group) => group.types)

function groupOf(type: ProductType) {
  return COLUMN_GROUPS.find((group) => group.types.includes(type))?.id || 'other'
}

function catalogHref(iso3: string, type?: ProductType) {
  const params = new URLSearchParams({ country: iso3 })
  if (type) params.set('product', type)
  return `/catalog?${params}`
}

export function CountryCoverageMatrix({ countries, families }: {
  countries: CountrySummary[]
  families: ProductFamily<CountryResource>[]
}) {
  const rows = useMemo<CoverageRow[]>(() => {
    const wanted = new Set(countries.map((country) => country.iso3))
    const counts = new Map<string, Map<ProductType, number>>()
    const totals = new Map<string, number>()

    // One pass over the families rather than a filter per cell: 54 countries by
    // ten types is 540 filters over the whole catalogue otherwise.
    for (const family of families) {
      const iso3s = new Set(family.variants.flatMap((variant) => variant.countries).filter((iso3) => wanted.has(iso3)))
      if (!iso3s.size) continue
      const types = new Set(family.variants.flatMap((variant) => variant.productTypes))
      for (const iso3 of iso3s) {
        totals.set(iso3, (totals.get(iso3) || 0) + 1)
        const row = counts.get(iso3) || new Map<ProductType, number>()
        for (const type of types) row.set(type, (row.get(type) || 0) + 1)
        counts.set(iso3, row)
      }
    }

    return countries.map((country) => ({
      country,
      total: totals.get(country.iso3) || 0,
      counts: counts.get(country.iso3) || new Map(),
    }))
  }, [countries, families])

  const columns = useMemo(
    () => ORDERED_TYPES.filter((type) => rows.some((row) => row.counts.get(type))),
    [rows],
  )

  if (rows.length < 2 || columns.length < 2) return null

  // How many countries have any, rather than how many products exist: a product
  // published for three countries is one product, so summing the column would
  // count it three times and disagree with the catalogue.
  const countriesCovered = new Map(columns.map((type) => [
    type,
    rows.filter((row) => row.counts.get(type)).length,
  ]))

  return (
    <section className="coverage-matrix section-wrap" aria-labelledby="coverage-matrix-heading">
      <div className="country-section-heading">
        <div>
          <span className="kicker">Coverage</span>
          <h2 id="coverage-matrix-heading">Country publication matrix</h2>
        </div>
        <p>Select any figure to open the catalogue for that country and product type. Scroll inside the table for the rest of the {rows.length} countries and their product types.</p>
      </div>

      {/* Focusable and labelled, because a scroll container that only responds
          to a pointer strands a keyboard user at the fourteenth of 54 rows. */}
      <div className="coverage-matrix-scroll" tabIndex={0} role="region" aria-label="Country publication matrix, scrollable">
        <table className="coverage-matrix-grid">
          <caption className="sr-only">Product counts by country and product type</caption>
          <thead>
            <tr>
              <th scope="col">Country</th>
              <th scope="col" className="coverage-matrix-total">All</th>
              {columns.map((type) => <th scope="col" key={type} className={`coverage-matrix-group coverage-matrix-group--${groupOf(type)}`}>{type}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.country.iso3}>
                <th scope="row">
                  <Link to={`/countries/${row.country.iso3.toLowerCase()}`}>{row.country.name}</Link>
                </th>
                <td className="coverage-matrix-total">
                  <Link to={catalogHref(row.country.iso3)}>{row.total}</Link>
                </td>
                {columns.map((type) => {
                  const count = row.counts.get(type) || 0
                  return (
                    <td key={type} className={`coverage-matrix-group coverage-matrix-group--${groupOf(type)} ${count ? 'is-present' : 'is-absent'}`}>
                      {count ? (
                        <Link to={catalogHref(row.country.iso3, type)}>
                          <span aria-hidden="true">{count}</span>
                          <span className="sr-only">{count} {type} for {row.country.name}</span>
                        </Link>
                      ) : (
                        <span className="sr-only">No {type} for {row.country.name}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Countries with any</th>
              <td className="coverage-matrix-total">{rows.length}</td>
              {columns.map((type) => <td key={type} className={`coverage-matrix-group coverage-matrix-group--${groupOf(type)}`}>{countriesCovered.get(type)}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
