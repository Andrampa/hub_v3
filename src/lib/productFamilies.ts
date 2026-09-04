import type { ArcGISItem } from '../types'

const FAMILY_TAG_PREFIX = 'diem-family:'
/** Publishing plumbing that must never surface as searchable text. */
export const MACHINE_TAG_PATTERN = /^diem-(family|language):/i
const LANGUAGE_TAG_PREFIX = 'diem-language:'
const LANGUAGE_CATEGORY_PREFIX = '/categories/languages/'

export interface ProductFamily<T extends ArcGISItem = ArcGISItem> {
  id: string
  primary: T
  variants: T[]
  languages: Array<{ language: string; item: T }>
  /** Last ArcGIS record change across the family. Maintenance, not publication. */
  latestModified: number
  /** Newest catalogue entry date across the family. Survives re-tagging. */
  latestCreated: number
}

function familyId(item: ArcGISItem) {
  const value = item.tags
    ?.find((tag) => tag.trim().toLowerCase().startsWith(FAMILY_TAG_PREFIX))
    ?.trim()
    .slice(FAMILY_TAG_PREFIX.length)
    .trim()
    .toLowerCase()
  return value && /^[a-f0-9]{32}$/.test(value) ? value : item.id.toLowerCase()
}

function titleLanguage(title: string) {
  const marker = title.match(/(?:\((EN|FR|ES)\)|\b(English|French|Spanish|Français|Español))\s*$/i)
  const value = marker?.[1] || marker?.[2]
  if (!value) return undefined
  if (/^(fr|french|français)$/i.test(value)) return 'French'
  if (/^(es|spanish|español)$/i.test(value)) return 'Spanish'
  return 'English'
}

/** What `itemLanguage` returns when tag, title marker and category all miss. */
export const UNRECORDED_LANGUAGE = 'Language not specified'

export function itemLanguage(item: ArcGISItem) {
  const fromTag = item.tags
    ?.find((tag) => tag.trim().toLowerCase().startsWith(LANGUAGE_TAG_PREFIX))
    ?.trim()
    .slice(LANGUAGE_TAG_PREFIX.length)
    .trim()
  if (fromTag) return fromTag
  const fromTitle = titleLanguage(item.title)
  if (fromTitle) return fromTitle
  const category = item.groupCategories?.find((value) => (
    value.toLowerCase().startsWith(LANGUAGE_CATEGORY_PREFIX)
  ))
  if (category) return category.slice(LANGUAGE_CATEGORY_PREFIX.length)
  return UNRECORDED_LANGUAGE
}

const languageOrder = new Map([
  ['English', 0],
  ['French', 1],
  ['Spanish', 2],
])

export function groupProductFamilies<T extends ArcGISItem>(items: T[]): ProductFamily<T>[] {
  const groups = new Map<string, T[]>()
  items.forEach((item) => {
    const id = familyId(item)
    groups.set(id, [...(groups.get(id) || []), item])
  })
  return [...groups.entries()].map(([id, variants]) => {
    const primary = variants.find((item) => item.id.toLowerCase() === id)
      || [...variants].sort((a, b) => b.modified - a.modified)[0]
    const languages = variants
      .map((item) => ({ language: itemLanguage(item), item }))
      .sort((a, b) => (
        (languageOrder.get(a.language) ?? 99) - (languageOrder.get(b.language) ?? 99)
        || a.item.title.localeCompare(b.item.title)
      ))
    return {
      id,
      primary,
      variants,
      languages,
      latestModified: Math.max(...variants.map((item) => item.modified)),
      latestCreated: Math.max(...variants.map((item) => item.created)),
    }
  })
}

