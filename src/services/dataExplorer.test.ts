import { describe, expect, it } from 'vitest'
import { isExplorableProduct } from './arcgis'
import { parsePublicDatasetAddress } from './dataExplorer'

const ID = 'f0e0a74518e54394a7e5d5a90bfd3e25'

describe('public dataset addresses', () => {
  it('reads a bare item id', () => {
    expect(parsePublicDatasetAddress(ID)).toEqual({ itemId: ID, layerId: undefined })
  })

  it("reads the legacy Hub's <id>_<layer> form", () => {
    expect(parsePublicDatasetAddress(`${ID.toUpperCase()}_6`)).toEqual({ itemId: ID, layerId: 6 })
  })

  it('rejects anything that is not an item id', () => {
    expect(parsePublicDatasetAddress('eve_mastertable_adm0')).toBeUndefined()
    expect(parsePublicDatasetAddress(`${ID}_x`)).toBeUndefined()
  })
})

describe('explorable catalogue products', () => {
  const service = { type: 'Feature Service', access: 'public', url: 'https://services5.arcgis.com/x/arcgis/rest/services/t/FeatureServer' }

  it('opens a public feature service', () => {
    expect(isExplorableProduct(service)).toBe(true)
  })

  it('keeps shared, URL-less and non-service items on their ordinary action', () => {
    expect(isExplorableProduct({ ...service, access: 'org' })).toBe(false)
    expect(isExplorableProduct({ ...service, url: undefined })).toBe(false)
    expect(isExplorableProduct({ ...service, type: 'Dashboard' })).toBe(false)
  })
})
