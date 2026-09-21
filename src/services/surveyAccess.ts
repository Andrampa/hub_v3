import { countryDefinition } from './countries'
import {
  AGGREGATE_RESOURCES,
  resolveProtectedResource,
  type DataGeneration,
  type ProtectedDataResource,
  type ProtectedRequester,
} from './protectedData'
import {
  deepLinkFields,
  type FeatureLayerInfo,
  type FeatureServiceInfo,
} from './dataExplorer'
import { isWithheld, visibilityClause, visibilityScope, withVisibility } from './visibility'

const DISCOVERY_PAGE_LIMIT = 2_000
const MAX_DISCOVERY_PAGES = 100

export type SurveyDiscoveryStatus = 'complete' | 'partial' | 'unavailable' | 'failed'
/**
 * `withheld`: the viewer may not see this source's rows, because it carries no
 * `opendata` flag and the viewer is not a Contributor. Like `excluded-test`, it
 * is outside what this viewer's total should include - not a failure, and not a
 * reason to call the total incomplete.
 */
export type SurveySourceStatus = 'checking' | 'confirmed' | 'confirmed-with-warnings' | 'restricted' | 'failed' | 'excluded-test' | 'withheld'

export interface SurveyThemeSource {
  id: string
  label: string
  resourceId: string
  generation: DataGeneration
  itemModified?: number
  layerId: number
  layerName: string
  layerUrl: string
  /**
   * The country and round fields this layer actually exposes, kept from
   * discovery so a later count or extract can address the survey slice without
   * fetching the schema a second time. They are not assumed to be identical
   * across generations.
   */
  countryField: string
  roundField: string
  /**
   * The visibility clause for the viewer this theme was discovered for -
   * `opendata = 1` for a non-Contributor on a layer that carries the flag -
   * or undefined. Held here so every survey slice drawn from the theme applies
   * it through `surveySliceWhere`, without any caller having to remember to.
   */
  visibilityWhere?: string
  declaredAdministrativeCoverage?: string
  testData: boolean
}

export interface AvailableSurvey {
  key: string
  generation: DataGeneration
  adm0Iso3: string
  countryName: string
  round: number
  themes: SurveyThemeSource[]
  testData: boolean
}

export interface SurveySourceResult {
  resourceId: string
  generation: DataGeneration
  themeId: string
  themeLabel: string
  testData: boolean
  status: SurveySourceStatus
  surveyCount?: number
  /**
   * Rows carrying no country code at all. A row with nothing to key a survey by
   * cannot be one, so it is dropped silently and only counted: it is a shape of
   * the aggregate table, not a fault worth putting in front of a user.
   */
  blankIdentityCount?: number
  /** Rows that carried an identity the schema contract does not allow. */
  malformedIdentityCount?: number
  message?: string
}

export interface SurveyDiscoveryResult {
  status: SurveyDiscoveryStatus
  surveys: AvailableSurvey[]
  sources: SurveySourceResult[]
  pendingSourceCount: number
  /** Sources that answered, but with rows the schema contract does not allow. */
  warningSourceCount: number
  /** Sources that could not be read at all: restricted or failed. */
  unavailableSourceCount: number
  checkedAt: number
}

export interface SurveyDiscoveryOptions {
  includeTestData?: boolean
  /** Contributors see rows not yet released; everyone else only `opendata = 1`. */
  contributor?: boolean
  refresh?: boolean
  onProgress?: (result: SurveyDiscoveryResult) => void
  /**
   * Stops progress callbacks and releases the listener. A React caller aborts on
   * unmount, otherwise every remount leaves another live callback behind for the
   * rest of the session.
   */
  signal?: AbortSignal
}

interface QueryResponse {
  features?: Array<{ attributes: Record<string, unknown> }>
  exceededTransferLimit?: boolean
}

interface SurveyIdentity {
  adm0Iso3: string
  round: number
}

interface ConfirmedSource {
  source: SurveySourceResult
  theme: SurveyThemeSource
  surveys: SurveyIdentity[]
}

type SourceOutcome = ConfirmedSource | { source: SurveySourceResult }

function normalizedServiceUrl(value: string) {
  return value.replace(/\/+$/, '')
}

function themeId(resource: ProtectedDataResource) {
  return (resource.thematicLayer || resource.fallbackTitle)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function surveyKey(generation: DataGeneration, adm0Iso3: string, round: number) {
  return `${generation}:${adm0Iso3.toUpperCase()}:${round}`
}

function sourceSummary(
  resource: ProtectedDataResource,
  status: SurveySourceStatus,
  extra: Pick<SurveySourceResult, 'surveyCount' | 'blankIdentityCount' | 'malformedIdentityCount' | 'message'> = {},
): SurveySourceResult {
  return {
    resourceId: resource.id,
    generation: resource.version,
    themeId: themeId(resource),
    themeLabel: resource.thematicLayer || resource.fallbackTitle,
    testData: !!resource.preview,
    status,
    ...extra,
  }
}

function readableFailure(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'This source could not be checked.'
}

type IdentityOutcome =
  | { identity: SurveyIdentity }
  | { identity?: undefined; blank: true }
  | { identity?: undefined; blank?: false }

function parseIdentity(
  attributes: Record<string, unknown>,
  countryField: string,
  roundField: string,
): IdentityOutcome {
  const rawCountry = attributes[countryField]
  const adm0Iso3 = String(rawCountry ?? '').trim().toUpperCase()
  if (!adm0Iso3) return { blank: true }
  const round = Number(attributes[roundField])
  if (!/^[A-Z]{3}$/.test(adm0Iso3) || !Number.isInteger(round) || round < 0) return {}
  return { identity: { adm0Iso3, round } }
}

async function fetchDistinctSurveys(
  layerUrl: string,
  layer: FeatureLayerInfo,
  requester: ProtectedRequester,
  visibilityWhere: string | undefined,
) {
  const fields = deepLinkFields(layer.fields)
  if (!fields.country || !/iso3/i.test(fields.country.name) || !fields.round) {
    throw new Error('The source does not expose the required ISO3 and survey-round fields.')
  }

  const pageSize = Math.min(layer.maxRecordCount || DISCOVERY_PAGE_LIMIT, DISCOVERY_PAGE_LIMIT)
  const surveys = new Map<string, SurveyIdentity>()
  const countryField = fields.country.name
  const roundField = fields.round.name
  let offset = 0
  let exhausted = false
  let blankIdentityCount = 0
  let malformedIdentityCount = 0

  for (let pageNumber = 0; pageNumber < MAX_DISCOVERY_PAGES; pageNumber += 1) {
    const response = await requester<QueryResponse>(`${layerUrl}/query`, {
      // A survey none of whose rows are released is not offered at all.
      where: withVisibility('1=1', visibilityWhere),
      outFields: `${fields.country.name},${fields.round.name}`,
      returnDistinctValues: 'true',
      returnGeometry: 'false',
      orderByFields: `${fields.country.name} ASC,${fields.round.name} ASC`,
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
    })
    const features = response.features || []
    let added = 0

    for (const feature of features) {
      const outcome = parseIdentity(feature.attributes, fields.country.name, fields.round.name)
      const identity = outcome.identity
      if (!identity) {
        if (outcome.blank) blankIdentityCount += 1
        else malformedIdentityCount += 1
        continue
      }
      const key = `${identity.adm0Iso3}:${identity.round}`
      if (!surveys.has(key)) {
        surveys.set(key, identity)
        added += 1
      }
    }

    if (!features.length) {
      exhausted = true
      break
    }

    const mayHaveMore = response.exceededTransferLimit === true || features.length >= pageSize
    if (!mayHaveMore) {
      exhausted = true
      break
    }
    if (!added) throw new Error('The data service repeated a discovery page instead of advancing.')
    offset += features.length
  }

  if (!exhausted) {
    throw new Error('Survey discovery exceeded its pagination safety limit.')
  }
  return { surveys: Array.from(surveys.values()), blankIdentityCount, malformedIdentityCount, countryField, roundField }
}

async function discoverSource(
  resource: ProtectedDataResource,
  requester: ProtectedRequester,
  contributor: boolean,
): Promise<SourceOutcome> {
  try {
    const resolved = await resolveProtectedResource(resource, requester)
    if (resolved.access === 'restricted') return { source: sourceSummary(resource, 'restricted') }
    if (resolved.access !== 'available' || !resolved.item) {
      return { source: sourceSummary(resource, 'failed', { message: 'The source item could not be read.' }) }
    }
    if (!resolved.item.url) {
      return { source: sourceSummary(resource, 'failed', { message: 'The source item has no queryable service.' }) }
    }

    const serviceUrl = normalizedServiceUrl(resolved.item.url)
    const service = await requester<FeatureServiceInfo>(serviceUrl)
    const layerReference = service.layers?.[0] || service.tables?.[0]
    if (!layerReference) {
      return { source: sourceSummary(resource, 'failed', { message: 'The source service has no feature layer or table.' }) }
    }

    const layerUrl = `${serviceUrl}/${layerReference.id}`
    const layer = await requester<FeatureLayerInfo>(layerUrl)
    const visibilityWhere = visibilityClause(layer, contributor)
    // Fail closed, and say so: no flag means nothing is marked released. No query
    // is sent, since it could only come back empty.
    if (isWithheld(visibilityWhere)) {
      return { source: sourceSummary(resource, 'withheld', {
        message: 'This source carries no opendata flag, so none of its rows are marked as released. It is visible to Contributors only.',
      }) }
    }
    const discovery = await fetchDistinctSurveys(layerUrl, layer, requester, visibilityWhere)
    const { surveys, blankIdentityCount, malformedIdentityCount, countryField, roundField } = discovery
    const warning = malformedIdentityCount
      ? `${malformedIdentityCount} source row${malformedIdentityCount === 1 ? '' : 's'} carried a country code or round the survey schema does not allow, and ${malformedIdentityCount === 1 ? 'was' : 'were'} excluded from discovery.`
      : undefined
    const source = sourceSummary(resource, warning ? 'confirmed-with-warnings' : 'confirmed', {
      surveyCount: surveys.length,
      blankIdentityCount: blankIdentityCount || undefined,
      malformedIdentityCount: malformedIdentityCount || undefined,
      message: warning,
    })
    const theme: SurveyThemeSource = {
      id: source.themeId,
      label: source.themeLabel,
      resourceId: resource.id,
      generation: resource.version,
      itemModified: resolved.item.modified,
      layerId: layerReference.id,
      layerName: layer.name || layerReference.name,
      layerUrl,
      countryField,
      roundField,
      visibilityWhere,
      declaredAdministrativeCoverage: resource.admFamily,
      testData: !!resource.preview,
    }
    return { source, theme, surveys }
  } catch (error) {
    return { source: sourceSummary(resource, 'failed', { message: readableFailure(error) }) }
  }
}

/**
 * `status` describes access only: whether every source that should have been
 * read was read.
 *
 * A row-level warning deliberately does not demote it. The two were once the
 * same `partial`, which would have made the workspace say "sources could not be
 * checked" about sources it had just checked successfully. Callers that need to
 * mention warnings read `warningSourceCount`.
 */
function discoveryStatus(sources: SurveySourceResult[]): SurveyDiscoveryStatus {
  const attempted = sources.filter((source) => source.status !== 'excluded-test' && source.status !== 'withheld')
  if (!attempted.length) return 'unavailable'
  if (attempted.some((source) => source.status === 'checking')) return 'partial'
  const confirmed = attempted.filter((source) => (
    source.status === 'confirmed' || source.status === 'confirmed-with-warnings'
  )).length
  if (confirmed === attempted.length) return 'complete'
  if (confirmed > 0) return 'partial'
  return attempted.some((source) => source.status === 'failed') ? 'failed' : 'unavailable'
}

function buildDiscoveryResult(
  resources: readonly ProtectedDataResource[],
  outcomes: Array<SourceOutcome | undefined>,
  excluded: SurveySourceResult[],
): SurveyDiscoveryResult {
  const surveyMap = new Map<string, AvailableSurvey>()

  for (const outcome of outcomes) {
    if (!outcome || !('surveys' in outcome)) continue
    for (const identity of outcome.surveys) {
      const key = surveyKey(outcome.theme.generation, identity.adm0Iso3, identity.round)
      const current = surveyMap.get(key)
      if (current) {
        current.themes.push(outcome.theme)
        current.testData ||= outcome.theme.testData
        continue
      }
      surveyMap.set(key, {
        key,
        generation: outcome.theme.generation,
        adm0Iso3: identity.adm0Iso3,
        countryName: countryDefinition(identity.adm0Iso3).name,
        round: identity.round,
        themes: [outcome.theme],
        testData: outcome.theme.testData,
      })
    }
  }

  const surveys = Array.from(surveyMap.values())
    .map((survey) => ({ ...survey, themes: survey.themes.sort((left, right) => left.label.localeCompare(right.label)) }))
    .sort((left, right) => left.countryName.localeCompare(right.countryName)
      || left.round - right.round
      || left.generation.localeCompare(right.generation))
  const sources = [
    ...resources.map((resource, index) => outcomes[index]?.source || sourceSummary(resource, 'checking')),
    ...excluded,
  ]
  return {
    status: discoveryStatus(sources),
    surveys,
    sources,
    pendingSourceCount: resources.length - outcomes.filter((outcome) => !!outcome).length,
    warningSourceCount: sources.filter((source) => source.status === 'confirmed-with-warnings').length,
    unavailableSourceCount: sources.filter((source) => (
      source.status === 'restricted' || source.status === 'failed'
    )).length,
    checkedAt: Date.now(),
  }
}

/**
 * Resolve survey/theme availability from authoritative ArcGIS services.
 *
 * Every source settles independently. A protected or failed item therefore
 * produces a named partial state instead of erasing surveys confirmed by the
 * remaining themes.
 */
export async function discoverSurveyAvailability(
  resources: readonly ProtectedDataResource[],
  requester: ProtectedRequester,
  options: Pick<SurveyDiscoveryOptions, 'includeTestData' | 'contributor' | 'onProgress' | 'signal'> = {},
): Promise<SurveyDiscoveryResult> {
  const included = resources.filter((resource) => resource.kind === 'aggregate' && (options.includeTestData || !resource.preview))
  const excluded = resources
    .filter((resource) => resource.kind === 'aggregate' && resource.preview && !options.includeTestData)
    .map((resource) => sourceSummary(resource, 'excluded-test'))
  const outcomes: Array<SourceOutcome | undefined> = new Array(included.length)
  const report = (result: SurveyDiscoveryResult) => {
    if (options.signal?.aborted) return
    options.onProgress?.(result)
  }
  report(buildDiscoveryResult(included, outcomes, excluded))

  await Promise.all(included.map(async (resource, index) => {
    outcomes[index] = await discoverSource(resource, requester, Boolean(options.contributor))
    report(buildDiscoveryResult(included, outcomes, excluded))
  }))

  return buildDiscoveryResult(included, outcomes, excluded)
}

interface AggregateCacheEntry {
  promise: Promise<SurveyDiscoveryResult>
  latest?: SurveyDiscoveryResult
  listeners: Set<(result: SurveyDiscoveryResult) => void>
}

let aggregateCache = new WeakMap<ProtectedRequester, Map<string, AggregateCacheEntry>>()

type DiscoveryListener = (result: SurveyDiscoveryResult) => void

/**
 * Registers a progress listener that the caller's signal can take back again.
 *
 * Without this, a page that mounts, unmounts and mounts again leaves a callback
 * in the cached entry for the rest of the session, and every later source
 * settling calls all of them.
 */
function subscribe(listeners: Set<DiscoveryListener>, listener: DiscoveryListener, signal?: AbortSignal) {
  if (signal?.aborted) return
  listeners.add(listener)
  signal?.addEventListener('abort', () => listeners.delete(listener), { once: true })
}

/**
 * Cached aggregate discovery for the active authenticated requester.
 *
 * The cache deliberately stays in memory. ArcGIS responses are protected data
 * and must not be serialized to sessionStorage; only the later UI's stable
 * selection keys may use that storage, with sign-out clearing them.
 */
export function discoverAggregatedSurveys(
  requester: ProtectedRequester,
  options: SurveyDiscoveryOptions = {},
) {
  // The visibility scope is part of the key: a Contributor's discovery must never
  // be served to the same requester once treated as a non-Contributor, or back.
  const mode = `${options.includeTestData ? 'test' : 'production'}:${visibilityScope(Boolean(options.contributor))}`
  let requesterCache = aggregateCache.get(requester)
  if (!requesterCache) {
    requesterCache = new Map()
    aggregateCache.set(requester, requesterCache)
  }
  if (options.refresh) requesterCache.delete(mode)
  const existing = requesterCache.get(mode)
  if (existing) {
    if (options.onProgress) {
      subscribe(existing.listeners, options.onProgress, options.signal)
      if (existing.latest && !options.signal?.aborted) options.onProgress(existing.latest)
    }
    return existing.promise
  }

  const listeners = new Set<(result: SurveyDiscoveryResult) => void>()
  if (options.onProgress) subscribe(listeners, options.onProgress, options.signal)
  let latest: SurveyDiscoveryResult | undefined
  let entry: AggregateCacheEntry | undefined
  const promise = discoverSurveyAvailability(AGGREGATE_RESOURCES, requester, {
    includeTestData: options.includeTestData,
    contributor: options.contributor,
    onProgress: (result) => {
      latest = result
      if (entry) entry.latest = result
      for (const listener of listeners) listener(result)
    },
  })
  entry = { promise, latest, listeners }
  requesterCache.set(mode, entry)
  return promise
}

export interface SurveySliceCount {
  surveyKey: string
  themeId: string
  count?: number
  error?: string
}

/**
 * The filter that defines one survey's slice of a thematic table.
 *
 * Defined once here so the record count a user is shown at review, the CSV they
 * download and the query recorded in the package manifest are provably the same
 * clause. The ISO3 has already been validated against `^[A-Z]{3}$` by discovery
 * and the round is an integer, so neither can carry SQL; the quote escape stays
 * anyway, because the guarantee should not depend on a check made elsewhere.
 */
export function surveySliceWhere(survey: AvailableSurvey, theme: SurveyThemeSource) {
  const iso3 = survey.adm0Iso3.replaceAll("'", "''")
  return withVisibility(
    `${theme.countryField} = '${iso3}' AND ${theme.roundField} = ${Math.trunc(survey.round)}`,
    theme.visibilityWhere,
  )
}

/**
 * Counts the records behind each selected survey and theme, one query each.
 *
 * Failures are returned per slice rather than thrown: a review table that names
 * the one combination it could not measure is more use than an error that
 * replaces the whole estimate.
 */
export async function countSurveySlices(
  slices: Array<{ survey: AvailableSurvey; theme: SurveyThemeSource }>,
  requester: ProtectedRequester,
  onProgress?: (completed: number, total: number) => void,
): Promise<SurveySliceCount[]> {
  let completed = 0
  return Promise.all(slices.map(async ({ survey, theme }) => {
    try {
      const response = await requester<{ count?: number }>(`${theme.layerUrl}/query`, {
        where: surveySliceWhere(survey, theme),
        returnCountOnly: 'true',
        returnGeometry: 'false',
      })
      return { surveyKey: survey.key, themeId: theme.id, count: response.count || 0 }
    } catch (error) {
      return { surveyKey: survey.key, themeId: theme.id, error: readableFailure(error) }
    } finally {
      completed += 1
      onProgress?.(completed, slices.length)
    }
  }))
}

export function clearSurveyAccessCache(requester?: ProtectedRequester) {
  if (requester) aggregateCache.delete(requester)
  else aggregateCache = new WeakMap()
}
