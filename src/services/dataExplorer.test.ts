import { describe, expect, it } from 'vitest'
import { isExplorableProduct } from './arcgis'
import { csvCell, parsePublicDatasetAddress, rowsToCsv } from './dataExplorer'

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

describe('CSV cells', () => {
  it('writes empty, numeric and plain text values unchanged', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
    expect(csvCell(0)).toBe('0')
    expect(csvCell(42.5)).toBe('42.5')
    expect(csvCell(-99)).toBe('-99')
    expect(csvCell('-99')).toBe('-99')
    expect(csvCell('+5')).toBe('+5')
    expect(csvCell('Nigeria')).toBe('Nigeria')
  })

  it('quotes commas and doubles embedded quotes', () => {
    expect(csvCell('Kano, Nigeria')).toBe('"Kano, Nigeria"')
    expect(csvCell('the "other" option')).toBe('"the ""other"" option"')
  })

  it('quotes every line-break form, including a bare carriage return', () => {
    expect(csvCell('a\nb')).toBe('"a\nb"')
    expect(csvCell('a\r\nb')).toBe('"a\r\nb"')
    expect(csvCell('a\rb')).toBe('"a\rb"')
  })

  it('neutralises formula-like text but not numbers', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+cmd')).toBe("'+cmd")
    expect(csvCell('- none')).toBe("'- none")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(csvCell('\tx')).toBe("'\tx")
    expect(csvCell('\rx')).toBe(`"'\rx"`)
    expect(csvCell('-1+2')).toBe("'-1+2")
    expect(csvCell('-3.5e2')).toBe('-3.5e2')
    expect(csvCell('-.5')).toBe('-.5')
    expect(csvCell('a=b')).toBe('a=b')
  })

  it('keeps one record per row when text contains line breaks', () => {
    const csv = rowsToCsv(['id', 'note'], [{ id: 1, note: 'x\ry' }, { id: 2, note: 'z' }])
    expect(csv).toBe('\uFEFFid,note\r\n1,"x\ry"\r\n2,z')
  })
})
