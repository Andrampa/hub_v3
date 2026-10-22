import { describe, expect, it } from 'vitest'
import {
  FLOW_STEPS,
  describeRequestOutcome,
  flowType,
  guardedStep,
  requestedStep,
  resolveSurveyRequest,
  surveyDataPath,
  surveyRequest,
  withoutSurveyRequest,
} from './surveyFlow'

const params = (query: string) => new URLSearchParams(query)
const survey = (generation: string, iso3: string, round: number, countryName = iso3) => ({
  key: `${generation}:${iso3}:${round}`, adm0Iso3: iso3, countryName, round,
})

describe('reading the URL', () => {
  it('accepts only the two data types and the steps of that flow', () => {
    expect(flowType(params('type=microdata'))).toBe('microdata')
    expect(flowType(params('type=other'))).toBeUndefined()
    expect(requestedStep(params('step=licence'), 'microdata')).toBe('licence')
    // Aggregated data has no licence step to stand on.
    expect(requestedStep(params('step=licence'), 'aggregated')).toBe('surveys')
    expect(requestedStep(params(''), 'aggregated')).toBe('surveys')
  })

  it('normalizes canonical keys and drops malformed ones', () => {
    expect(surveyRequest(params('surveys=V2:afg:8,nonsense,v1:NGA:3,v2:AFG:8'))?.keys).toEqual(['v2:AFG:8', 'v1:NGA:3'])
  })

  it('reads the short country-and-round form, and ignores a round without a country', () => {
    expect(surveyRequest(params('country=afg&round=8'))).toEqual({ keys: [], country: 'AFG', round: 8 })
    expect(surveyRequest(params('round=8'))).toBeUndefined()
    expect(surveyRequest(params('country=AFG&round=x'))).toEqual({ keys: [], country: 'AFG', round: undefined })
  })

  it('removes only the selection parameters once applied', () => {
    expect(withoutSurveyRequest(params('type=aggregated&country=AFG&round=8&test=1')).toString()).toBe('type=aggregated&test=1')
  })

  it('builds the links other pages use', () => {
    expect(surveyDataPath({ type: 'microdata', country: 'afg' })).toBe('/data/surveys?type=microdata&country=AFG')
    expect(surveyDataPath({ country: 'AFG', round: 13 })).toBe('/data/surveys?country=AFG&round=13')
    expect(surveyDataPath()).toBe('/data/surveys')
  })
})

describe('resolving a request', () => {
  const offered = [survey('v2', 'AFG', 8, 'Afghanistan'), survey('v1', 'AFG', 3, 'Afghanistan'), survey('v2', 'NGA', 8, 'Nigeria')]

  it('selects only what the account was offered and names the rest', () => {
    const outcome = resolveSurveyRequest({ keys: ['v2:AFG:8', 'v2:AFG:99'], country: undefined }, offered)
    expect(outcome.keys).toEqual(['v2:AFG:8'])
    expect(outcome.missing).toEqual(['Afghanistan round 99'])
    expect(outcome.countries).toEqual(['AFG'])
  })

  it('opens a country without selecting anything when no round is given', () => {
    expect(resolveSurveyRequest({ keys: [], country: 'AFG' }, offered)).toMatchObject({ keys: [], countries: ['AFG'], missing: [] })
  })

  it('refuses to guess between generations for one country and round', () => {
    const outcome = resolveSurveyRequest({ keys: [], country: 'AFG', round: 8 }, [...offered, survey('v1', 'AFG', 8, 'Afghanistan')])
    expect(outcome.keys).toEqual([])
    expect(outcome.ambiguous).toBe('Afghanistan round 8')
  })

  it('stops at the package limit and says which surveys were left out', () => {
    const outcome = resolveSurveyRequest({ keys: ['v2:AFG:8', 'v1:AFG:3', 'v2:NGA:8'] }, offered, 2)
    expect(outcome.keys).toEqual(['v2:AFG:8', 'v1:AFG:3'])
    expect(outcome.overLimit).toEqual(['Nigeria round 8'])
  })
})

describe('describing the outcome', () => {
  const base = { keys: [], countries: [], missing: [], overLimit: [], limit: 10 }

  it('says nothing when the request was met', () => {
    expect(describeRequestOutcome({ ...base, complete: true })).toBeUndefined()
  })

  it('separates "not offered" from "not confirmed"', () => {
    expect(describeRequestOutcome({ ...base, missing: ['Afghanistan round 13'], complete: true }))
      .toContain('is not among the surveys your account can download here')
    const unconfirmed = describeRequestOutcome({ ...base, missing: ['Afghanistan round 13'], complete: false })
    expect(unconfirmed).toContain('could not be confirmed')
    expect(unconfirmed).not.toContain('not among')
  })
})

describe('step guards', () => {
  it('returns the step before the first unfinished one', () => {
    const ready = (step: string) => step !== 'licence'
    expect(guardedStep(FLOW_STEPS.microdata, 'download', ready)).toBe('review')
    expect(guardedStep(FLOW_STEPS.microdata, 'review', ready)).toBe('review')
    expect(guardedStep(FLOW_STEPS.microdata, 'options', () => false)).toBe('surveys')
  })
})
