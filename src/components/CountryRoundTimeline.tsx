import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { itemRound } from '../lib/catalog'
import { itemProductPath } from '../services/arcgis'
import { PRODUCT_TYPES, UNRECORDED_PRODUCT_TYPE, type CountryResource, type ProductType } from '../services/countries'
import { itemLanguage, type ProductFamily } from '../lib/productFamilies'

/**
 * A country page lists 40-odd near-identical cards, which answers "what exists"
 * but never "what is missing". The question a country analyst arrives with is
 * whether round 6 has a brief, and a list cannot show an absence.
 *
 * Rounds run across, product types down, so a gap in a row reads as a gap in
 * coverage at a glance. Round numbers are parsed from titles - the content
 * group holds no round field - so only products whose title states a round can
 * appear here; everything else is counted underneath rather than silently
 * dropped, because an unparsed title would otherwise render as a false gap.
 */
const MINIMUM_ROUNDS = 2

interface RoundEntry {
  family: ProductFamily<CountryResource>
  round: number
  type: ProductType
}

interface Selection {
  type: ProductType
  round: number
}

interface Cell {
  round: number
  families: ProductFamily<CountryResource>[]
}

/**
 * What separates one product in a cell from the next. Most multi-product cells
 * hold language editions that were published without the family tag that would
 * have grouped them, so the language is the distinguishing fact a reader needs
 * before choosing; a grouped family already carries its own editions.
 */
function familyLanguages(family: ProductFamily<CountryResource>) {
  const languages = family.languages.length
    ? family.languages.map((entry) => entry.language)
    : [itemLanguage(family.primary)]
  return languages.join(', ')
}

function typeOf(family: ProductFamily<CountryResource>) {
  return family.primary.productTypes.find((type) => type !== UNRECORDED_PRODUCT_TYPE)
}

export function CountryRoundTimeline({ families, countryName }: {
  families: ProductFamily<CountryResource>[]
  countryName: string
}) {
  const [selected, setSelected] = useState<Selection>()
  const panelId = useId()

  const sequenced = families.flatMap<RoundEntry>((family) => {
    const round = itemRound(family.primary)
    const type = typeOf(family)
    return round && type ? [{ family, round, type }] : []
  })

  const rounds = [...new Set(sequenced.map((entry) => entry.round))].sort((a, b) => a - b)
  const unsequenced = families.length - sequenced.length

  const chosenFamilies = selected
    ? sequenced.filter((entry) => entry.type === selected.type && entry.round === selected.round).map((entry) => entry.family)
    : []

  // A country switch keeps the component mounted, so a selection made on one
  // country would otherwise survive into the next and point at nothing.
  useEffect(() => setSelected(undefined), [countryName])

  // One round is a fact, not a timeline, and drawing a single column would
  // imply a series where there is none.
  if (rounds.length < MINIMUM_ROUNDS) return null

  const rows = PRODUCT_TYPES
    .filter((type) => sequenced.some((entry) => entry.type === type))
    .map((type) => ({
      type,
      cells: rounds.map<Cell>((round) => ({
        round,
        families: sequenced.filter((entry) => entry.type === type && entry.round === round).map((entry) => entry.family),
      })),
    }))

  return (
    <section className="country-timeline section-wrap" aria-labelledby="round-timeline-heading">
      <div className="country-section-heading">
        <div>
          <span className="kicker">Coverage by round</span>
          <h2 id="round-timeline-heading">What exists for each round</h2>
        </div>
        <p>
          Products that belong to a numbered survey round.
          {unsequenced > 0 && ` ${unsequenced} further ${unsequenced === 1 ? 'product is' : 'products are'} not listed here.`}
        </p>
      </div>

      <div className="country-timeline-scroll">
        <table className="country-timeline-grid">
          <caption className="sr-only">{countryName}: which products exist for each survey round</caption>
          <thead>
            <tr>
              <th scope="col">Product</th>
              {rounds.map((round) => <th scope="col" key={round}><span aria-hidden="true">R{round}</span><span className="sr-only">Round {round}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.type}>
                <th scope="row">{row.type}</th>
                {row.cells.map((cell) => {
                  const chosen = selected && selected.type === row.type && selected.round === cell.round
                  return (
                    <td key={cell.round} className={`${cell.families.length ? 'is-present' : 'is-absent'}${chosen ? ' is-chosen' : ''}`}>
                      {cell.families.length === 1 && (
                        <Link to={itemProductPath(cell.families[0].primary)}>
                          <span aria-hidden="true">●</span>
                          <span className="sr-only">{row.type}, round {cell.round}</span>
                        </Link>
                      )}
                      {cell.families.length > 1 && (
                        <button
                          type="button"
                          aria-expanded={Boolean(chosen)}
                          aria-controls={chosen ? panelId : undefined}
                          onClick={() => setSelected(chosen ? undefined : { type: row.type, round: cell.round })}
                        >
                          <span aria-hidden="true">{cell.families.length}</span>
                          <span className="sr-only">
                            {row.type}, round {cell.round}: choose one of {cell.families.length} products
                          </span>
                        </button>
                      )}
                      {!cell.families.length && <span className="sr-only">No {row.type} for round {cell.round}</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      {chosenFamilies.length > 0 && selected && (
        <div className="country-timeline-choice" id={panelId}>
          <div className="country-timeline-choice-head">
            <strong>{selected.type}, round {selected.round}</strong>
            <span>{chosenFamilies.length} products</span>
            <button type="button" onClick={() => setSelected(undefined)}>Close<span aria-hidden="true"> ×</span></button>
          </div>
          <ul>
            {chosenFamilies.map((family) => (
              <li key={family.id}>
                <Link to={itemProductPath(family.primary)}>{family.primary.title}</Link>
                <span>{familyLanguages(family)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="country-timeline-legend">
        <span><i className="country-timeline-key country-timeline-key--present" aria-hidden="true" />One product, linked</span>
        <span><i className="country-timeline-key country-timeline-key--multiple" aria-hidden="true">2</i>More than one; pick which to open</span>
        <span><i className="country-timeline-key country-timeline-key--absent" aria-hidden="true" />Nothing published for that round</span>
      </p>
    </section>
  )
}
