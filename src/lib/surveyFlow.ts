/**
 * The URL contract of the guided Your surveys flow (/data/surveys).
 *
 * The URL carries intent, never completed prerequisites: which data type, which
 * step was asked for, and which surveys a link wanted selected. A finished
 * access check or an accepted licence is never read from it, so a refreshed or
 * shared `step=download` goes back to the earliest step that still needs doing.
 *
 *   type     aggregated | microdata          absent: the entry choice
 *   step     surveys | options | review | licence | download
 *   surveys  canonical keys, comma-separated  v2:AFG:8,v1:NGA:3
 *   country  ISO3, the short incoming form   AFG
 *   round    with country, one round         8
 *   test     1, Contributor test mode (unchanged)
 *
 * Selection parameters are read once, applied against what the signed-in
 * account can actually open, and then removed from the URL; session storage
 * keeps the selection through a refresh after that.
 */

export type FlowType = 'aggregated' | 'microdata'
export type FlowStep = 'surveys' | 'options' | 'review' | 'licence' | 'download'

export const FLOW_STEPS: Record<FlowType, FlowStep[]> = {
  aggregated: ['surveys', 'options', 'review', 'download'],
  microdata: ['surveys', 'options', 'review', 'licence', 'download'],
}

export const FLOW_STEP_LABELS: Record<FlowStep, string> = {
  surveys: 'Surveys',
  options: 'Options',
  review: 'Review',
  licence: 'Licence',
  download: 'Download',
}

const SELECTION_PARAMS = ['surveys', 'country', 'round'] as const
const SURVEY_KEY = /^v[1-9]:[A-Z]{3}:\d{1,4}$/

export interface SurveyRequest {
  /** Exact keys from `surveys`, invalid entries dropped. */
  keys: string[]
  /** `country`, upper-cased, when it is a plausible ISO3 code. */
  country?: string
  /** `round` with `country`; ignored on its own. */
  round?: number
}

export function flowType(params: URLSearchParams): FlowType | undefined {
  const value = params.get('type')
  return value === 'aggregated' || value === 'microdata' ? value : undefined
}

/** The step asked for, or the first one when it is missing or not in this flow. */
export function requestedStep(params: URLSearchParams, type: FlowType): FlowStep {
  const value = params.get('step') as FlowStep | null
  return value && FLOW_STEPS[type].includes(value) ? value : 'surveys'
}

export function surveyRequest(params: URLSearchParams): SurveyRequest | undefined {
  const keys = [...new Set((params.get('surveys') || '').split(',')
    .map((key) => key.trim())
    .map((key) => key.replace(/^(v\d):([a-z]{3}):/i, (_match, generation: string, iso3: string) => `${generation.toLowerCase()}:${iso3.toUpperCase()}:`))
    .filter((key) => SURVEY_KEY.test(key)))]
  const countryValue = (params.get('country') || '').trim().toUpperCase()
  const country = /^[A-Z]{3}$/.test(countryValue) ? countryValue : undefined
  const roundValue = Number(params.get('round'))
  const round = country && Number.isInteger(roundValue) && roundValue > 0 ? roundValue : undefined
  if (!keys.length && !country) return undefined
  return { keys, country, round }
}

export function hasSurveyRequest(params: URLSearchParams) {
  return SELECTION_PARAMS.some((name) => params.has(name))
}

export interface RequestableSurvey {
  key: string
  adm0Iso3: string
  countryName: string
  round: number
}

export interface ResolvedSurveyRequest {
  /** Keys to select, in request order, never more than `limit`. */
  keys: string[]
  /** Countries to open in the list. */
  countries: string[]
  /** Requested surveys this account was not shown, in words. */
  missing: string[]
  /** Requested surveys left out because the package limit was reached. */
  overLimit: string[]
  /** A country-and-round request that matched more than one generation. */
  ambiguous?: string
}

/**
 * Turns a request into a selection, using only surveys the account was offered.
 *
 * A requested survey that is not in `available` is named in `missing`, never
 * silently dropped. Whether that means "not available to you" or "not
 * confirmed yet" depends on whether discovery finished, which the caller knows.
 */
export function resolveSurveyRequest(
  request: SurveyRequest,
  available: RequestableSurvey[],
  limit = Number.POSITIVE_INFINITY,
): ResolvedSurveyRequest {
  const byKey = new Map(available.map((survey) => [survey.key, survey]))
  const wanted: RequestableSurvey[] = []
  const missing: string[] = []
  let ambiguous: string | undefined
  for (const key of request.keys) {
    const survey = byKey.get(key)
    if (survey) wanted.push(survey)
    else {
      const [, iso3, round] = key.split(':')
      missing.push(`${available.find((entry) => entry.adm0Iso3 === iso3)?.countryName || iso3} round ${round}`)
    }
  }
  const countries = new Set(wanted.map((survey) => survey.adm0Iso3))
  if (request.country) {
    const inCountry = available.filter((survey) => survey.adm0Iso3 === request.country)
    if (inCountry.length) countries.add(request.country)
    if (request.round !== undefined) {
      const matches = inCountry.filter((survey) => survey.round === request.round)
      const name = inCountry[0]?.countryName || request.country
      if (matches.length === 1) wanted.push(matches[0])
      else if (matches.length > 1) ambiguous = `${name} round ${request.round}`
      else missing.push(`${name} round ${request.round}`)
    } else if (!inCountry.length) {
      missing.push(request.country)
    }
  }
  const unique = [...new Map(wanted.map((survey) => [survey.key, survey])).values()]
  return {
    keys: unique.slice(0, limit).map((survey) => survey.key),
    countries: [...countries],
    missing,
    overLimit: unique.slice(limit).map((survey) => `${survey.countryName} round ${survey.round}`),
    ambiguous,
  }
}

function listed(items: string[]) {
  return items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * What a link asked for and did not get, in words, or nothing when it got all of it.
 *
 * `complete` is whether every source answered. Without it a missing survey is
 * only unconfirmed, and saying "not available" would turn a network failure
 * into a statement about the person's access.
 */
export function describeRequestOutcome(outcome: ResolvedSurveyRequest & { complete: boolean; limit: number }) {
  const sentences: string[] = []
  if (outcome.missing.length) {
    const verb = outcome.missing.length === 1 ? 'is' : 'are'
    sentences.push(outcome.complete
      ? `${listed(outcome.missing)} ${verb} not among the surveys your account can download here. It may not be released yet, or may need additional access.`
      : `${listed(outcome.missing)} could not be confirmed because a data source did not answer. Check again, or choose another survey.`)
  }
  if (outcome.overLimit.length) {
    sentences.push(`One package holds up to ${outcome.limit} surveys, so ${listed(outcome.overLimit)} ${outcome.overLimit.length === 1 ? 'was' : 'were'} not selected.`)
  }
  if (outcome.ambiguous) {
    sentences.push(`${outcome.ambiguous} exists in more than one questionnaire generation. Choose the one you need below.`)
  }
  return sentences.length ? sentences.join(' ') : undefined
}

/**
 * The step to show: the one asked for, unless an earlier step is unfinished.
 *
 * `ready(step)` says whether a step's own prerequisites are met, i.e. whether
 * the user may stand on it. The first step is always reachable.
 */
export function guardedStep(steps: FlowStep[], requested: FlowStep, ready: (step: FlowStep) => boolean): FlowStep {
  const index = Math.max(0, steps.indexOf(requested))
  for (let position = 1; position <= index; position += 1) {
    if (!ready(steps[position])) return steps[position - 1]
  }
  return steps[index]
}

/** A copy of `params` with the given entries set, or removed when undefined. */
export function withFlowParams(params: URLSearchParams, patch: Partial<Record<'type' | 'step' | 'surveys' | 'country' | 'round', string | undefined>>) {
  const next = new URLSearchParams(params)
  for (const [name, value] of Object.entries(patch)) {
    if (value === undefined) next.delete(name)
    else next.set(name, value)
  }
  return next
}

export function withoutSurveyRequest(params: URLSearchParams) {
  const next = new URLSearchParams(params)
  for (const name of SELECTION_PARAMS) next.delete(name)
  return next
}

/** The path a country page or a survey card links to. */
export function surveyDataPath(options: { type?: FlowType; country?: string; round?: number } = {}) {
  const params = new URLSearchParams()
  if (options.type) params.set('type', options.type)
  if (options.country) params.set('country', options.country.toUpperCase())
  if (options.country && options.round !== undefined) params.set('round', String(options.round))
  const query = params.toString()
  return `/data/surveys${query ? `?${query}` : ''}`
}
