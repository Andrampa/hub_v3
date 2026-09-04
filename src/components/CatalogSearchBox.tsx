import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildCatalogSearchIndex, extractItemIds, searchCatalog, searchCountries } from '../lib/catalogSearch'
import type { ProductFamily } from '../lib/productFamilies'
import { itemDestination } from '../services/arcgis'
import type { CountryResource, CountrySummary } from '../services/countries'

interface Suggestion {
  key: string
  kind: 'country' | 'product' | 'all'
  label: string
  detail: string
  /** Internal route, or an external product URL opened in a new tab. */
  to?: string
  href?: string
  /** inline only: apply this country as a filter rather than navigating. */
  iso3?: string
}

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
}

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
}

/**
 * `hero` navigates away on selection: the homepage's job is to send the reader
 * somewhere. `inline` is for a page that is already showing results, so the
 * value is owned by the caller and typing narrows the grid underneath; a
 * country suggestion applies that filter in place instead of leaving.
 */
type SearchVariant = 'hero' | 'inline'

export function CatalogSearchBox({
  families,
  countries,
  variant = 'hero',
  value,
  onValueChange,
  onCountrySelect,
}: {
  families: ProductFamily<CountryResource>[]
  countries: CountrySummary[]
  variant?: SearchVariant
  /** inline only: the query the page is filtering by. */
  value?: string
  /** inline only: called on every keystroke so the caller can drive the filter. */
  onValueChange?: (value: string) => void
  /** inline only: called when a country suggestion is chosen. */
  onCountrySelect?: (iso3: string) => void
}) {
  const inline = variant === 'inline'
  const navigate = useNavigate()
  const listId = useId()
  const [ownQuery, setOwnQuery] = useState('')
  const query = inline ? value ?? '' : ownQuery
  const setQuery = (next: string) => {
    if (inline) onValueChange?.(next)
    else setOwnQuery(next)
  }
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // Indexing waits for the first interaction so it never lands in homepage load.
  const [indexRequested, setIndexRequested] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  const index = useMemo(
    () => (indexRequested ? buildCatalogSearchIndex(families) : undefined),
    [families, indexRequested],
  )
  // Matching is sub-millisecond, so the input stays live and React yields the
  // suggestion render instead of a timer holding results back.
  const deferredQuery = useDeferredValue(query)

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!index || deferredQuery.trim().length < 2) return []
    const matchedCountries = searchCountries(countries, deferredQuery)
    const matchedFamilies = searchCatalog(index, deferredQuery, matchedCountries.length ? 5 : 7)
    const items: Suggestion[] = [
      ...matchedCountries.map((country) => ({
        key: `country-${country.iso3}`,
        kind: 'country' as const,
        label: country.name,
        detail: `${country.resourceCount} ${country.resourceCount === 1 ? 'product' : 'products'}`,
        ...(inline ? { iso3: country.iso3 } : { to: `/countries/${country.iso3.toLowerCase()}` }),
      })),
      ...matchedFamilies.map(({ family }) => ({
        key: `product-${family.id}`,
        kind: 'product' as const,
        label: family.primary.title.trim(),
        detail: family.primary.productTypes[0] || family.primary.type,
        href: itemDestination(family.primary),
      })),
    ]
    if (!items.length) return []
    // The catalogue is already showing every result, so a "see all" row there
    // would lead back to the page the reader is standing on. An id lookup has
    // its answer in the list already, and the row would echo the pasted URL.
    if (inline || extractItemIds(deferredQuery).length) return items
    return [...items, {
      key: 'all',
      kind: 'all',
      label: `See all results for “${deferredQuery.trim()}”`,
      detail: '',
      to: `/catalog?q=${encodeURIComponent(deferredQuery.trim())}`,
    }]
  }, [countries, deferredQuery, index, inline])

  useEffect(() => setActive(-1), [deferredQuery])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
  }, [open])

  const goToCatalog = () => {
    const value = query.trim()
    navigate(value ? `/catalog?q=${encodeURIComponent(value)}` : '/catalog')
  }

  const choose = (suggestion: Suggestion) => {
    setOpen(false)
    if (suggestion.iso3) onCountrySelect?.(suggestion.iso3)
    else if (suggestion.to) navigate(suggestion.to)
    else if (suggestion.href) window.open(suggestion.href, '_blank', 'noopener,noreferrer')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const selection = suggestions[active]
    if (selection) choose(selection)
    // Inline, the grid already reflects the query; there is nowhere to submit to.
    else if (!inline) goToCatalog()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false)
      setActive(-1)
      return
    }
    if (!suggestions.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => {
        const next = current + step
        if (next < 0) return suggestions.length - 1
        return next >= suggestions.length ? 0 : next
      })
    }
  }

  const expanded = open && suggestions.length > 0

  const inputId = `${listId}-input`

  return (
    <div className={inline ? 'inline-search-wrap' : 'hero-search-wrap'} ref={wrapper}>
      {/* Carries the same caption and frame as the five filter cells beside it,
          so the search reads as one of the controls rather than as loose text. */}
      {inline && <span className="inline-search-caption" aria-hidden="true">Search</span>}
      <form className={inline ? 'inline-search' : 'hero-search'} role="search" onSubmit={submit}>
        <SearchIcon />
        <label className="sr-only" htmlFor={inputId}>Search the DIEM product catalog</label>
        <input
          id={inputId}
          type="search"
          role="combobox"
          autoComplete="off"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          placeholder={inline ? 'Search products, countries or topics…' : 'Search by country, theme or resource…'}
          value={query}
          onFocus={() => { setIndexRequested(true); setOpen(true) }}
          onChange={(event) => { setIndexRequested(true); setQuery(event.target.value); setOpen(true) }}
          onKeyDown={onKeyDown}
        />
        {!inline && <button type="submit" aria-label="Search the product catalog"><ArrowIcon /></button>}
      </form>
      {expanded && (
        <ul className={`hero-suggestions${inline ? ' hero-suggestions--inline' : ''}`} id={listId} role="listbox" aria-label="Search suggestions">
          {suggestions.map((suggestion, position) => (
            <li
              className={`hero-suggestion hero-suggestion--${suggestion.kind}${position === active ? ' is-active' : ''}`}
              id={`${listId}-${position}`}
              role="option"
              aria-selected={position === active}
              key={suggestion.key}
              onMouseEnter={() => setActive(position)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
            >
              <span className="hero-suggestion-label">{suggestion.label}</span>
              {suggestion.detail && <span className="hero-suggestion-detail">{suggestion.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {expanded ? `${suggestions.length - 1} suggestions available.` : ''}
      </p>
    </div>
  )
}
