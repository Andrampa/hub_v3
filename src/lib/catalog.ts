import type { ArcGISItem } from '../types'

const themeMatchers: Array<[string, RegExp]> = [
  ['Monitoring', /country brief|household survey|diem charts|findings presentation|monitoring/i],
  ['Impact', /impact assessment|impact assesment/i],
  ['Early warning', /diem eve|early warning|eve biweekly/i],
  ['Stories', /storymap|story map/i],
  ['Agriculture', /crop calendar|agricultural calendar|agriculture/i],
]

const genericPrefixes = new Set([
  'cross-country findings',
  'data in emergencies',
  'diem',
  'global',
  'other',
])

export function itemTheme(item: ArcGISItem) {
  const haystack = [item.title, ...(item.tags || [])].join(' ')
  return themeMatchers.find(([, pattern]) => pattern.test(haystack))?.[0] || 'Other'
}

export function itemCountry(item: ArcGISItem) {
  const prefix = item.title.trim().split(/\s+-\s+/)[0]?.trim()
  if (!prefix || prefix.length > 45 || genericPrefixes.has(prefix.toLowerCase())) return undefined
  return prefix
}

export function itemYear(item: ArcGISItem) {
  return new Date(item.modified).getUTCFullYear()
}

export function cleanText(value?: string) {
  if (!value) return ''
  const document = new DOMParser().parseFromString(value, 'text/html')
  return document.body.textContent?.replace(/\s+/g, ' ').trim() || ''
}

export function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(timestamp))
}

