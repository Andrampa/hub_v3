/**
 * Search-param filter validation shared by `/catalog` and `/countries/:iso3`.
 *
 * Both surfaces carry their filter state in the URL, and AGENTS.md is explicit
 * that titles, tags and categories in the content group are mutable. A shared or
 * bookmarked link therefore outlives the value it names: `?product=Country+Brief`
 * kept applying a filter no product carries while the Product select displayed
 * "All products", so the reader was told to remove a filter no control showed.
 *
 * The rule here is that a value the controls cannot currently produce is not a
 * filter. It is read as the default, named to the reader, and dropped from the
 * URL.
 */

/**
 * Pathway value for products carrying no pathway category at all. Without it
 * the pathway counts add up to less than the total with no way to see the
 * difference, which reads as a broken count rather than as missing metadata.
 */
export const UNASSIGNED_PATHWAY = 'No pathway assigned'

/** Shipped briefly under the institutional word; shared links still carry it. */
export const LEGACY_UNASSIGNED_PATHWAY = 'No pillar assigned'

export interface FilterSpec {
  /** Search-param name. */
  key: string
  /** The value meaning "not filtered"; the param is absent in that state. */
  defaultValue: string
  /**
   * Every value the controls can currently produce. Undefined while the
   * catalogue that defines those values is still loading, which suspends
   * validation rather than stripping filters that are about to become valid.
   */
  allowed?: readonly string[]
  /** Superseded values a shared link may still carry, mapped to the current one. */
  aliases?: Record<string, string>
}

export interface UnsupportedFilter {
  key: string
  /** Exactly what the URL carried, so the notice can quote it. */
  value: string
}

export interface FilterReadResult {
  /** The applied value per key: always one the controls can display. */
  values: Record<string, string>
  unsupported: UnsupportedFilter[]
}

export function readFilters(params: URLSearchParams, specs: FilterSpec[]): FilterReadResult {
  const values: Record<string, string> = {}
  const unsupported: UnsupportedFilter[] = []
  specs.forEach((spec) => {
    const raw = params.get(spec.key)
    if (raw === null || raw === '') {
      values[spec.key] = spec.defaultValue
      return
    }
    const resolved = spec.aliases?.[raw] ?? raw
    if (resolved === spec.defaultValue) {
      values[spec.key] = spec.defaultValue
      return
    }
    if (spec.allowed && !spec.allowed.includes(resolved)) {
      values[spec.key] = spec.defaultValue
      unsupported.push({ key: spec.key, value: raw })
      return
    }
    values[spec.key] = resolved
  })
  return { values, unsupported }
}

/**
 * The same params without the values that no longer exist. Pagination goes with
 * them: a page number is only meaningful against the filter set that produced it.
 */
export function stripUnsupportedFilters(params: URLSearchParams, unsupported: UnsupportedFilter[]) {
  const next = new URLSearchParams(params)
  unsupported.forEach(({ key }) => next.delete(key))
  if (unsupported.length) next.delete('page')
  return next
}

/** One line naming what was dropped, so a dead link explains itself. */
export function unsupportedFilterMessage(unsupported: UnsupportedFilter[]) {
  if (!unsupported.length) return ''
  const quoted = unsupported.map(({ value }) => `“${value}”`).join(', ')
  return unsupported.length === 1
    ? `The filter ${quoted} is no longer used in this catalogue and has been removed from your link.`
    : `These filters are no longer used in this catalogue and have been removed from your link: ${quoted}.`
}

/** A stable identity for a set of dropped filters, for effect dependencies. */
export function unsupportedFilterKey(unsupported: UnsupportedFilter[]) {
  return unsupported.map(({ key, value }) => `${key}=${value}`).join('&')
}

/**
 * One applied filter, described for a chip the reader can remove.
 *
 * The collapsed mobile filter panel has to say what is applied without the
 * controls being on screen, and it has to say it in the same words the controls
 * use: the pathway stored as "Seasonal calendar" is "Agricultural calendar"
 * everywhere a reader sees it, and a country is a name, not an ISO3 code. The
 * caller supplies those display strings; this module only decides what counts
 * as applied and how the removal is named.
 */
export interface ActiveFilterInput {
  /** Search-param name, so removal is a plain param delete. */
  key: string
  /** The control's own caption: "Country", "Evidence pathway". */
  label: string
  value: string
  defaultValue: string
  /** What the reader sees. Defaults to the stored value. */
  display?: string
  /**
   * An ordering control rather than a filter, so its chip offers to reset it
   * rather than to remove it. Sorting by title does not exclude anything, and
   * "Remove sort filter" would describe an action the control does not perform.
   */
  resets?: boolean
}

export interface ActiveFilter {
  key: string
  label: string
  value: string
  display: string
  defaultValue: string
  /** Accessible name for the chip's remove control. */
  removeLabel: string
}

export function activeFilters(inputs: ActiveFilterInput[]): ActiveFilter[] {
  return inputs
    .filter(({ value, defaultValue }) => Boolean(value) && value !== defaultValue)
    .map(({ key, label, value, defaultValue, display, resets }) => ({
      key,
      label,
      value,
      defaultValue,
      display: display || value,
      // "Remove country filter: Niger" rather than a row of identical
      // "Remove" buttons, which is what a screen reader would otherwise read
      // out five times.
      removeLabel: resets
        ? `Reset ${label.toLowerCase()}: ${display || value}`
        : `Remove ${label.toLowerCase()} filter: ${display || value}`,
    }))
}

/** What the disclosure control counts, so "Filters (2)" matches the chips. */
export function activeFilterCount(inputs: ActiveFilterInput[]) {
  return activeFilters(inputs).length
}
