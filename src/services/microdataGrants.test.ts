import { describe, expect, it, vi } from 'vitest'
import { catalogueVisible } from './arcgis'
import { deriveCommunityCapabilities, DIEM_ACCESS_GROUPS } from './auth'
import {
  ACCESS_TAG,
  buildGrantBundles,
  fetchCurrentUserMicrodataGrants,
  hasRestrictedMicrodataTag,
  parseGrantMetadata,
  resolveGrantView,
  describeExportPolicy,
  type GrantArcGISItem,
  type ResolvedGrantView,
} from './microdataGrants'
import type { ArcGISItem } from '../types'

const V3_CORE_ITEM: GrantArcGISItem = {
  id: 'core-item',
  title: 'diem_microdata_access_request_2026_001_v3_core',
  type: 'Feature Service',
  owner: 'diem_publisher',
  url: 'https://services.arcgis.com/fake/arcgis/rest/services/core/FeatureServer',
  tags: [ACCESS_TAG, 'diem-microdata-grant-request-2026-001', 'diem-microdata-component-core', 'DIEM V3'],
  properties: {
    diemRestrictedMicrodata: {
      schemaVersion: 1,
      grantId: 'request-2026-001',
      questionnaireVersion: 'v3',
      component: 'core',
      surveyScope: [{ adm0_iso3: 'COD', round: 12 }, { adm0_iso3: 'NGA', round: 8 }],
    },
  },
}

const V3_OPTIONAL_ITEM: GrantArcGISItem = {
  ...V3_CORE_ITEM,
  id: 'optional-item',
  title: 'diem_microdata_access_request_2026_001_v3_optional',
  url: 'https://services.arcgis.com/fake/arcgis/rest/services/optional/FeatureServer',
  tags: [ACCESS_TAG, 'diem-microdata-component-optional', 'DIEM V3'],
  properties: {
    diemRestrictedMicrodata: {
      schemaVersion: 1,
      grantId: 'request-2026-001',
      questionnaireVersion: 'v3',
      component: 'optional',
      surveyScope: [{ adm0_iso3: 'COD', round: 12 }, { adm0_iso3: 'NGA', round: 8 }],
    },
  },
}

const V2_LEGACY_ITEM: GrantArcGISItem = {
  id: 'legacy-v2-item',
  title: 'diem_microdata_access_request_2026_001_v2_legacy',
  type: 'Feature Service',
  owner: 'diem_publisher',
  url: 'https://services.arcgis.com/fake/arcgis/rest/services/v2/FeatureServer',
  tags: [ACCESS_TAG, 'diem-microdata-component-legacy', 'DIEM V2'],
  properties: {
    diemRestrictedMicrodata: {
      schemaVersion: 1,
      grantId: 'request-2026-001',
      questionnaireVersion: 'v2',
      component: 'legacy',
      surveyScope: [{ adm0_iso3: 'SOM', round: 4 }],
    },
  },
}

/**
 * A stand-in for the authenticated requester. `denied` names item IDs ArcGIS
 * rejects, which is how revocation and expiry actually reach the Hub.
 */
function fakeRequester(options: {
  items?: GrantArcGISItem[]
  searchResults?: GrantArcGISItem[]
  groups?: Array<{ id: string; tags: string[] }>
  groupContent?: Record<string, GrantArcGISItem[]>
  denied?: string[]
  capabilities?: Record<string, string>
  failSearch?: boolean
}) {
  const denied = new Set(options.denied || [])
  return vi.fn(async (url: string) => {
    if (url.endsWith('/sharing/rest/search')) {
      if (options.failSearch) throw new Error('search unavailable')
      return { results: options.searchResults ?? [] }
    }
    if (url.endsWith('/community/self')) return { groups: options.groups ?? [] }
    const groupMatch = url.match(/\/content\/groups\/([^/]+)\/search$/)
    if (groupMatch) return { results: options.groupContent?.[groupMatch[1]] ?? [] }
    const itemMatch = url.match(/\/content\/items\/(.+)$/)
    if (itemMatch) {
      const id = itemMatch[1]
      if (denied.has(id)) throw new Error('403 access denied')
      const item = (options.items || []).find((candidate) => candidate.id === id)
      if (!item) throw new Error('404 item not found')
      return item
    }
    if (url.endsWith('/FeatureServer')) {
      return { capabilities: options.capabilities?.[url] ?? 'Query' }
    }
    throw new Error(`unexpected request: ${url}`)
  }) as unknown as <T>(url: string, params?: Record<string, unknown>) => Promise<T>
}

describe('access matrix', () => {
  it('keeps the legacy household capability independent of temporary grants', () => {
    const legacyOnly = deriveCommunityCapabilities([DIEM_ACCESS_GROUPS.householdData])
    expect(legacyOnly.householdData).toBe(true)

    // A temporary-grant recipient is deliberately not in the legacy group, and
    // must not be given the generation-wide master layers by side effect.
    const grantRecipient = deriveCommunityCapabilities([])
    expect(grantRecipient.householdData).toBe(false)
    expect(grantRecipient.aggregatedData).toBe(false)
  })

  it('treats a contributor as holding both broad data capabilities', () => {
    const contributor = deriveCommunityCapabilities([DIEM_ACCESS_GROUPS.contributor])
    expect(contributor.householdData).toBe(true)
    expect(contributor.aggregatedData).toBe(true)
  })
})

describe('catalogue exclusion', () => {
  it('drops managed grant views from the ordinary catalogue', () => {
    const grantItem = { id: 'g1', tags: [ACCESS_TAG, 'DIEM V3'] } as unknown as ArcGISItem
    const ordinary = { id: 'o1', tags: ['DIEM', 'aggregated data'] } as unknown as ArcGISItem
    expect(catalogueVisible(grantItem)).toBe(false)
    expect(catalogueVisible(ordinary)).toBe(true)
  })

  it('matches the tag regardless of case or surrounding whitespace', () => {
    expect(hasRestrictedMicrodataTag([' diem RESTRICTED microdata '])).toBe(true)
    expect(hasRestrictedMicrodataTag(['DIEM restricted microdata grant'])).toBe(false)
    expect(hasRestrictedMicrodataTag(undefined)).toBe(false)
  })
})

describe('grant metadata', () => {
  it('reads the managed properties block', () => {
    const metadata = parseGrantMetadata(V3_CORE_ITEM)
    expect(metadata).toMatchObject({
      grantId: 'request-2026-001',
      questionnaireVersion: 'v3',
      component: 'core',
    })
    expect(metadata?.surveyScope).toEqual([
      { adm0_iso3: 'COD', round: 12 },
      { adm0_iso3: 'NGA', round: 8 },
    ])
  })

  it('falls back to tags when a search result carries no properties', () => {
    const searchShape: GrantArcGISItem = {
      ...V3_CORE_ITEM,
      properties: undefined,
      tags: [ACCESS_TAG, 'diem-microdata-grant-request-2026-001', 'diem-microdata-component-core', 'DIEM V3'],
    }
    expect(parseGrantMetadata(searchShape)).toMatchObject({
      grantId: 'request-2026-001',
      questionnaireVersion: 'v3',
      component: 'core',
    })
  })

  it('rejects an item whose component or version cannot be determined', () => {
    expect(parseGrantMetadata({ ...V3_CORE_ITEM, properties: undefined, tags: [ACCESS_TAG] })).toBeNull()
    expect(parseGrantMetadata({ ...V3_CORE_ITEM, tags: ['something else'] })).toBeNull()
  })
})

function view(overrides: Partial<ResolvedGrantView>): ResolvedGrantView {
  return {
    schemaVersion: 1,
    grantId: 'request-2026-001',
    questionnaireVersion: 'v3',
    component: 'core',
    surveyScope: [{ adm0_iso3: 'COD', round: 12 }],
    itemId: 'x',
    title: 'x',
    bulkExportEnabled: false,
    ...overrides,
  }
}

describe('bundle construction', () => {
  it('pairs the V3 core and optional components into one bundle', () => {
    const bundles = buildGrantBundles([
      view({ itemId: 'optional-item', component: 'optional' }),
      view({ itemId: 'core-item', component: 'core' }),
    ])
    expect(bundles).toHaveLength(1)
    expect(bundles[0].views.map((entry) => entry.component)).toEqual(['core', 'optional'])
    expect(bundles[0].joinKeys).toEqual(['survey_id', 'hh_id'])
  })

  it('separates V1 and V2 even though both use the legacy component', () => {
    const bundles = buildGrantBundles([
      view({ itemId: 'v1', component: 'legacy', questionnaireVersion: 'v1' }),
      view({ itemId: 'v2', component: 'legacy', questionnaireVersion: 'v2' }),
    ])
    expect(bundles).toHaveLength(2)
    expect(bundles.map((bundle) => bundle.questionnaireVersion)).toEqual(['v1', 'v2'])
    expect(bundles.every((bundle) => bundle.joinKeys.length === 0)).toBe(true)
  })

  it('builds one complete bundle per version when a request spans generations', () => {
    const bundles = buildGrantBundles([
      view({ itemId: 'v2', component: 'legacy', questionnaireVersion: 'v2' }),
      view({ itemId: 'core-item', component: 'core' }),
      view({ itemId: 'optional-item', component: 'optional' }),
    ])
    expect(bundles).toHaveLength(2)
    const v3 = bundles.find((bundle) => bundle.questionnaireVersion === 'v3')
    expect(v3?.views).toHaveLength(2)
    // V1/V2 documentation is already published; V3 is not, so its bundle must
    // render the explicit missing-documentation state rather than borrow V2's.
    expect(v3?.documentation).toHaveLength(0)
    expect(bundles.find((bundle) => bundle.questionnaireVersion === 'v2')?.documentation.length).toBeGreaterThan(0)
  })

  it('offers bulk export only when every view in the bundle carries it', () => {
    const mixed = buildGrantBundles([
      view({ itemId: 'core-item', component: 'core', bulkExportEnabled: true }),
      view({ itemId: 'optional-item', component: 'optional', bulkExportEnabled: false }),
    ])
    expect(mixed[0].bulkExportEnabled).toBe(false)
    expect(describeExportPolicy(mixed[0])).toBe('Bulk export is not enabled for this grant.')

    const both = buildGrantBundles([view({ bulkExportEnabled: true })])
    expect(describeExportPolicy(both[0])).toBe('Bulk export is enabled for this grant.')
  })
})

describe('discovery', () => {
  it('finds grants through the global authenticated search', async () => {
    const requester = fakeRequester({
      searchResults: [V3_CORE_ITEM, V3_OPTIONAL_ITEM],
      items: [V3_CORE_ITEM, V3_OPTIONAL_ITEM],
    })
    const discovery = await fetchCurrentUserMicrodataGrants(requester)
    expect(discovery.source).toBe('search')
    expect(discovery.bundles).toHaveLength(1)
    expect(discovery.bundles[0].views).toHaveLength(2)
  })

  it('falls back to private grant groups when search returns nothing', async () => {
    const requester = fakeRequester({
      searchResults: [],
      groups: [
        { id: 'grant-group', tags: ['DIEM restricted microdata grant', 'diem-microdata-grant-request-2026-001'] },
        { id: 'unrelated-group', tags: ['DIEM'] },
      ],
      groupContent: { 'grant-group': [V2_LEGACY_ITEM] },
      items: [V2_LEGACY_ITEM],
    })
    const discovery = await fetchCurrentUserMicrodataGrants(requester)
    expect(discovery.source).toBe('groups')
    expect(discovery.bundles[0].questionnaireVersion).toBe('v2')
  })

  it('reports no grants for an account that holds none', async () => {
    const discovery = await fetchCurrentUserMicrodataGrants(fakeRequester({ searchResults: [], groups: [] }))
    expect(discovery.bundles).toEqual([])
    expect(discovery.source).toBe('none')
    expect(discovery.error).toBeUndefined()
  })

  it('surfaces a discovery failure without claiming the account has no access', async () => {
    const requester = fakeRequester({ failSearch: true, groups: [] })
    const broken = vi.fn(async (url: string) => {
      if (url.endsWith('/community/self')) throw new Error('network down')
      return (requester as unknown as (u: string) => Promise<unknown>)(url)
    }) as unknown as <T>(url: string) => Promise<T>
    const discovery = await fetchCurrentUserMicrodataGrants(broken)
    expect(discovery.error).toBeTruthy()
    expect(discovery.bundles).toEqual([])
  })
})

describe('expiry and revocation', () => {
  it('drops a view ArcGIS no longer resolves', async () => {
    const requester = fakeRequester({
      searchResults: [V3_CORE_ITEM, V3_OPTIONAL_ITEM],
      items: [V3_CORE_ITEM, V3_OPTIONAL_ITEM],
      denied: ['optional-item'],
    })
    const discovery = await fetchCurrentUserMicrodataGrants(requester)
    expect(discovery.bundles[0].views.map((entry) => entry.itemId)).toEqual(['core-item'])
  })

  it('returns nothing once every view in the grant is gone', async () => {
    const requester = fakeRequester({
      searchResults: [V3_CORE_ITEM],
      items: [V3_CORE_ITEM],
      denied: ['core-item'],
    })
    expect((await fetchCurrentUserMicrodataGrants(requester)).bundles).toEqual([])
  })

  it('reads bulk export from the Extract capability, never from the item alone', async () => {
    const exportable = fakeRequester({
      items: [V3_CORE_ITEM],
      capabilities: { [V3_CORE_ITEM.url as string]: 'Query,Extract' },
    })
    expect((await resolveGrantView('core-item', exportable))?.bulkExportEnabled).toBe(true)

    const queryOnly = fakeRequester({ items: [V3_CORE_ITEM] })
    expect((await resolveGrantView('core-item', queryOnly))?.bulkExportEnabled).toBe(false)
  })
})

describe('V3 source replacement', () => {
  it('follows rebuilt Phase 5 sources without any hardcoded source ID', async () => {
    // After the post-pilot rebuild the same grant is provisioned over new
    // source services, so the item IDs, service URLs and source tags all
    // change. Only the grant contract stays constant, and that is all the Hub
    // reads, so the bundle must come out identical in shape.
    const rebuiltCore: GrantArcGISItem = {
      ...V3_CORE_ITEM,
      id: 'rebuilt-core',
      url: 'https://services.arcgis.com/fake/arcgis/rest/services/rebuilt_core/FeatureServer',
      tags: [ACCESS_TAG, 'diem-microdata-component-core', 'DIEM V3', 'diem-microdata-source-newsourceid'],
    }
    const rebuiltOptional: GrantArcGISItem = {
      ...V3_OPTIONAL_ITEM,
      id: 'rebuilt-optional',
      url: 'https://services.arcgis.com/fake/arcgis/rest/services/rebuilt_optional/FeatureServer',
      tags: [ACCESS_TAG, 'diem-microdata-component-optional', 'DIEM V3', 'diem-microdata-source-newsourceid'],
    }
    const requester = fakeRequester({
      searchResults: [rebuiltCore, rebuiltOptional],
      items: [rebuiltCore, rebuiltOptional],
    })
    const discovery = await fetchCurrentUserMicrodataGrants(requester)
    expect(discovery.bundles).toHaveLength(1)
    expect(discovery.bundles[0].questionnaireVersion).toBe('v3')
    expect(discovery.bundles[0].views.map((entry) => entry.component)).toEqual(['core', 'optional'])
  })
})
