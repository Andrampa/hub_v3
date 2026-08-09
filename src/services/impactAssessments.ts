import type { ArcGISItem } from '../types'
import { isHazardImpactAssessment } from '../lib/catalog'
import { countryDefinition } from './countries'
import { fetchCatalog } from './arcgis'

const CATEGORY_ROOT = '/Categories/'
const EXACT_TAG = 'impact assessment'

export interface ImpactAssessmentResource extends ArcGISItem {
  countries: string[]
  shockTypes: string[]
  contentRoles: string[]
  geographicScopes: string[]
  languages: string[]
  pillars: string[]
  assessmentYear: number
}

export interface ImpactCountrySummary {
  iso3: string
  name: string
  resourceCount: number
  latestModified: number
}

export interface ImpactAssessmentCatalog {
  items: ImpactAssessmentResource[]
  countries: ImpactCountrySummary[]
  shockTypes: string[]
  years: number[]
  languages: string[]
  fetchedAt: Date
}

function categoryValues(categories: string[], branch: string) {
  const prefix = `${CATEGORY_ROOT}${branch}/`
  return [...new Set(categories
    .filter((category) => category.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((category) => category.slice(prefix.length).trim())
    .filter(Boolean))]
}

function assessmentYear(item: ArcGISItem) {
  const text = `${item.title} ${item.snippet || ''}`
  const years = [...text.matchAll(/\b(20\d{2})\b/g)]
    .map((match) => Number(match[1]))
    .filter((year) => year >= 2000 && year <= new Date().getUTCFullYear() + 1)
  return years.length ? Math.max(...years) : new Date(item.modified).getUTCFullYear()
}

function hasExactTag(item: ArcGISItem) {
  return (item.tags || []).some((tag) => tag.trim().toLowerCase() === EXACT_TAG)
}

function normalize(item: ArcGISItem): ImpactAssessmentResource {
  const categories = item.groupCategories || []
  return {
    ...item,
    countries: categoryValues(categories, 'Countries').map((value) => value.toUpperCase()),
    shockTypes: categoryValues(categories, 'Shock types'),
    contentRoles: categoryValues(categories, 'Content roles'),
    geographicScopes: categoryValues(categories, 'Geographic scope'),
    languages: categoryValues(categories, 'Languages'),
    pillars: categoryValues(categories, 'DIEM pillars'),
    assessmentYear: assessmentYear(item),
  }
}

export async function fetchImpactAssessmentCatalog(
  signal?: AbortSignal,
): Promise<ImpactAssessmentCatalog> {
  const catalog = await fetchCatalog(signal)
  const items = catalog.items
    .filter(hasExactTag)
    .map(normalize)
    .filter(isHazardImpactAssessment)
    .sort((a, b) => b.modified - a.modified)

  const countryCodes = [...new Set(items.flatMap((item) => item.countries))]
  const countries = countryCodes.map((iso3) => {
    const resources = items.filter((item) => item.countries.includes(iso3))
    return {
      iso3,
      name: countryDefinition(iso3).name,
      resourceCount: resources.length,
      latestModified: Math.max(...resources.map((item) => item.modified), 0),
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  return {
    items,
    countries,
    shockTypes: [...new Set(items.flatMap((item) => item.shockTypes))].sort(),
    years: [...new Set(items.map((item) => item.assessmentYear))].sort((a, b) => b - a),
    languages: [...new Set(items.flatMap((item) => item.languages))].sort(),
    fetchedAt: catalog.fetchedAt,
  }
}
