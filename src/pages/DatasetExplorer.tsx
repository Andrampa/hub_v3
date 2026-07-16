import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import '../dataset-explorer.css'
import { useAuth } from '../auth/AuthContext'
import { DatasetGeometryMap } from '../components/DatasetGeometryMap'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import {
  apiLinks,
  buildWhere,
  downloadCsv,
  downloadGeoJson,
  fetchDatasetDefinition,
  fetchGeometryPreview,
  fetchRecordCount,
  fetchTablePreview,
  fieldIsNumeric,
  fieldIsText,
  HUB_DOWNLOAD_FORMATS,
  resourceForDataset,
  usableFields,
  type DatasetDefinition,
  type DatasetFilter,
  type FeatureField,
} from '../services/dataExplorer'

type ExplorerIconName = 'arrow' | 'download' | 'code' | 'filter' | 'map' | 'table' | 'copy' | 'check' | 'external' | 'close'

function ExplorerIcon({ name }: { name: ExplorerIconName }) {
  const icons: Record<ExplorerIconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    code: <><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/></>,
    filter: <><path d="M4 5h16l-6 7v5l-4 2v-7z"/></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></>,
    table: <><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M9 9v11M15 9v11"/></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    external: <><path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{icons[name]}</svg>
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function withTimeout<T>(promise: Promise<T>, message: string, timeout = 18000) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(message)), timeout)),
  ])
}

function fieldLabel(field: FeatureField) {
  return field.alias || field.name
}

function initialField(fields: FeatureField[]) {
  return fields.find((field) => /adm0_name|country|iso3|location/i.test(field.name))?.name || fields[0]?.name || ''
}

function operatorOptions(field: FeatureField | undefined) {
  if (fieldIsNumeric(field)) return [
    { value: 'equals', label: 'is equal to' },
    { value: 'greaterThan', label: 'is greater than' },
    { value: 'lessThan', label: 'is less than' },
  ]
  return [
    { value: 'equals', label: 'is exactly' },
    { value: 'contains', label: 'contains' },
  ]
}

function ExplorerGate({ resourceName }: { resourceName: string }) {
  const auth = useAuth()
  return (
    <>
      <SiteHeader active="data" />
      <main className="dataset-explorer-gate section-wrap">
        <span className="kicker">Protected data explorer</span>
        <h1>Sign in to explore {resourceName}.</h1>
        <p>Filters, preview records, API links and downloads are available only to enabled DIEM community members with access to this ArcGIS dataset.</p>
        <button type="button" onClick={() => void auth.signIn()}>Sign in to explore data <ExplorerIcon name="arrow"/></button>
        <Link to="/data">Return to data access</Link>
      </main>
      <SiteFooter />
    </>
  )
}

export default function DatasetExplorer() {
  const { datasetId = '' } = useParams()
  const auth = useAuth()
  const [definition, setDefinition] = useState<DatasetDefinition>()
  const [definitionError, setDefinitionError] = useState<string>()
  const [filters, setFilters] = useState<DatasetFilter[]>([])
  const [draftField, setDraftField] = useState('')
  const [draftOperator, setDraftOperator] = useState<DatasetFilter['operator']>('equals')
  const [draftValue, setDraftValue] = useState('')
  const [count, setCount] = useState<number>()
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([])
  const [geometry, setGeometry] = useState<FeatureCollection<Geometry, GeoJsonProperties>>()
  const [isMapLoading, setIsMapLoading] = useState(false)
  const [mapError, setMapError] = useState<string>()
  const [queryError, setQueryError] = useState<string>()
  const [isQuerying, setIsQuerying] = useState(false)
  const [downloadState, setDownloadState] = useState<string>()
  const [copied, setCopied] = useState<string>()

  const resource = resourceForDataset(datasetId)
  const fields = useMemo(() => definition ? usableFields(definition.layer.fields) : [], [definition])
  const draftFieldDefinition = fields.find((field) => field.name === draftField)
  const where = useMemo(() => buildWhere(filters, fields), [filters, fields])
  const links = definition ? apiLinks(definition, where) : undefined

  useEffect(() => {
    if (auth.status !== 'authenticated' || !datasetId) return
    let active = true
    setDefinition(undefined)
    setDefinitionError(undefined)
    fetchDatasetDefinition(datasetId, auth.requestProtected)
      .then((result) => {
        if (!active) return
        setDefinition(result)
        setDraftField(initialField(usableFields(result.layer.fields)))
      })
      .catch((error: Error) => {
        if (active) setDefinitionError(error.message)
      })
    return () => { active = false }
  }, [auth.requestProtected, auth.status, datasetId])

  useEffect(() => {
    if (!definition) return
    let active = true
    setIsQuerying(true)
    setQueryError(undefined)
    Promise.allSettled([
      withTimeout(fetchRecordCount(definition, where, auth.requestProtected), 'The record count did not respond in time.'),
      withTimeout(fetchTablePreview(definition, where, auth.requestProtected), 'The table preview did not respond in time.'),
    ])
      .then(([countResult, tableResult]) => {
        if (!active) return
        const errors = [countResult, tableResult]
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
          .map((result) => result.reason instanceof Error ? result.reason.message : 'The data service could not complete a query.')
        if (countResult.status === 'fulfilled') setCount(countResult.value)
        if (tableResult.status === 'fulfilled') setPreviewRows((tableResult.value.features || []).map((feature) => feature.attributes))
        if (errors.length) setQueryError(errors.join(' '))
      })
      .finally(() => { if (active) setIsQuerying(false) })
    return () => { active = false }
  }, [auth.requestProtected, definition, where])

  useEffect(() => {
    if (!definition) return
    if (definition.isTable) {
      setGeometry(undefined)
      setMapError(undefined)
      setIsMapLoading(false)
      return
    }
    let active = true
    setIsMapLoading(true)
    setMapError(undefined)
    setGeometry(undefined)
    withTimeout(fetchGeometryPreview(definition, where, auth.requestProtected), 'The map preview did not respond in time.', 22000)
      .then((map) => { if (active) setGeometry(map) })
      .catch((error: Error) => { if (active) setMapError(error.message) })
      .finally(() => { if (active) setIsMapLoading(false) })
    return () => { active = false }
  }, [auth.requestProtected, definition, where])

  function addFilter() {
    if (!draftField || !draftValue.trim()) return
    setFilters((current) => [...current, { id: crypto.randomUUID(), fieldName: draftField, operator: draftOperator, value: draftValue.trim() }])
    setDraftValue('')
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(label)
    window.setTimeout(() => setCopied(undefined), 1800)
  }

  async function exportCsv() {
    if (!definition || count === undefined) return
    setDownloadState('Preparing CSV download...')
    try {
      const blob = await downloadCsv(definition, where, count, auth.requestProtected)
      downloadBlob(blob, `${definition.resource.fallbackTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}.csv`)
      setDownloadState('CSV download started.')
    } catch (error) {
      setDownloadState(error instanceof Error ? error.message : 'CSV download could not be prepared.')
    }
  }

  async function exportGeoJson() {
    if (!definition || count === undefined) return
    setDownloadState('Preparing GeoJSON download...')
    try {
      const blob = await downloadGeoJson(definition, where, count, auth.requestProtected)
      downloadBlob(blob, `${definition.resource.fallbackTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}.geojson`)
      setDownloadState('GeoJSON download started.')
    } catch (error) {
      setDownloadState(error instanceof Error ? error.message : 'GeoJSON download could not be prepared.')
    }
  }

  if (auth.status === 'loading') return <><SiteHeader active="data"/><main className="dataset-explorer-loading"><span className="loader"/><strong>Checking your DIEM session...</strong></main><SiteFooter/></>
  if (auth.status !== 'authenticated') return <ExplorerGate resourceName={resource?.fallbackTitle || 'this dataset'} />

  const visibleColumns = fields.map((field) => field.name)

  return (
    <>
      <SiteHeader active="data" />
      <main className="dataset-explorer">
        <header className="dataset-explorer-header">
          <div className="section-wrap">
            <nav className="dataset-breadcrumbs" aria-label="Breadcrumb"><Link to="/data">Data access</Link><span>/</span><span>Dataset explorer</span></nav>
            <div className="dataset-title-row"><div><span className="kicker">Live ArcGIS data service</span><h1>{definition?.resource.item?.title || resource?.fallbackTitle || 'Dataset explorer'}</h1><p>{definition?.resource.description || 'Explore, filter and download the selected DIEM data resource.'}</p></div><span className="dataset-access-badge">Authenticated access</span></div>
          </div>
        </header>

        {definitionError && <section className="dataset-explorer-error section-wrap" role="alert"><strong>This dataset cannot be opened for your account.</strong><p>{definitionError}</p><Link to="/data">Return to data access</Link></section>}
        {!definition && !definitionError && <main className="dataset-explorer-loading"><span className="loader"/><strong>Opening the data service</strong><p>Reading the layer schema and access permissions from ArcGIS Online...</p></main>}
        {definition && (
          <>
            <section className="dataset-command-bar">
              <div className="section-wrap">
                <span><strong>{count === undefined ? '—' : count.toLocaleString()}</strong> records{filters.length ? ' match current filters' : ' in this dataset'}</span>
                <span>{definition.isTable ? 'Tabular dataset' : 'Spatial dataset'}</span>
                <span>{fields.length} attributes</span>
              </div>
            </section>
            <section className="dataset-explorer-workspace section-wrap">
              <aside className="dataset-control-panel">
                <div className="control-panel-heading"><span><ExplorerIcon name="filter"/></span><div><strong>Filters</strong><small>Refine records before previewing or downloading.</small></div></div>
                <div className="filter-builder">
                  <label><span>Attribute</span><select value={draftField} onChange={(event) => { setDraftField(event.target.value); setDraftOperator('equals') }}>{fields.map((field) => <option value={field.name} key={field.name}>{fieldLabel(field)}</option>)}</select></label>
                  <label><span>Condition</span><select value={draftOperator} onChange={(event) => setDraftOperator(event.target.value as DatasetFilter['operator'])}>{operatorOptions(draftFieldDefinition).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                  <label><span>Value</span><input value={draftValue} onChange={(event) => setDraftValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addFilter() }} placeholder={fieldIsText(draftFieldDefinition) ? 'Enter a value' : 'Enter a number'} /></label>
                  <button type="button" onClick={addFilter} disabled={!draftValue.trim()}>Add filter <ExplorerIcon name="arrow"/></button>
                </div>
                <div className="active-filters" aria-live="polite">{filters.length ? filters.map((filter) => <span key={filter.id}>{fieldLabel(fields.find((field) => field.name === filter.fieldName) || { name: filter.fieldName, alias: filter.fieldName, type: '' })} <em>{filter.operator === 'contains' ? 'contains' : filter.operator === 'greaterThan' ? '>' : filter.operator === 'lessThan' ? '<' : '='}</em> {filter.value}<button type="button" onClick={() => setFilters((current) => current.filter((candidate) => candidate.id !== filter.id))} aria-label={`Remove ${filter.fieldName} filter`}><ExplorerIcon name="close"/></button></span>) : <p>No filters applied. The complete dataset is being queried.</p>}</div>
                {filters.length > 0 && <button className="clear-filters" type="button" onClick={() => setFilters([])}>Clear all filters</button>}
                <div className="download-panel"><div><ExplorerIcon name="download"/><strong>Download filtered data</strong><p>CSV and GeoJSON are generated directly from the current authenticated query.</p></div><span className="download-group-label">Available now</span><div className="download-format-grid"><button type="button" onClick={() => void exportCsv()} disabled={count === undefined || isQuerying}>CSV</button>{!definition.isTable && <button type="button" onClick={() => void exportGeoJson()} disabled={count === undefined || isQuerying}>GeoJSON</button>}</div>{!definition.isTable && <><span className="download-group-label">Requires export service</span><div className="download-format-grid">{HUB_DOWNLOAD_FORMATS.filter((candidate) => !['csv', 'geojson'].includes(candidate.format) && candidate.spatial).map((candidate) => <span className="download-format-pending" key={candidate.format} title="Requires a configured server-side export service">{candidate.label}</span>)}</div><p className="download-export-note">These packaged formats will be enabled after the Hub export configuration or replacement export worker is validated.</p></>}{downloadState && <p className="download-status" role="status">{downloadState}</p>}</div>
                <details className="api-panel"><summary><ExplorerIcon name="code"/> API links <span>Use in scripts and GIS tools</span></summary>{links && <div>{Object.entries(links).map(([label, value]) => <div key={label}><strong>{label === 'query' ? 'Filtered query' : label}</strong><code>{value}</code><button type="button" onClick={() => void copy(label, value)}>{copied === label ? <ExplorerIcon name="check"/> : <ExplorerIcon name="copy"/>}<span>{copied === label ? 'Copied' : 'Copy'}</span></button></div>)}</div>}</details>
              </aside>
              <div className="dataset-results-panel">
                <div className="dataset-results-toolbar"><span>{isQuerying ? 'Refreshing filtered results...' : `Previewing ${previewRows.length.toLocaleString()} records`}</span><span>{definition.layer.name}</span></div>
                {!definition.isTable && (isMapLoading ? <div className="dataset-map-loading"><span className="loader"/><strong>Loading map geometry</strong><p>The data table remains available while spatial features load.</p></div> : geometry ? <DatasetGeometryMap collection={geometry} totalCount={count || 0} /> : <div className="dataset-map-unavailable"><strong>Map preview is temporarily unavailable.</strong><p>{mapError || 'The service did not return geometry for the current filters.'}</p></div>)}
                <section className="dataset-table-section" aria-labelledby="table-preview-heading"><div><span className="kicker">Record preview</span><h2 id="table-preview-heading">Inspect the matching data</h2><p className="table-help">All {fields.length.toLocaleString()} attributes are included. Scroll horizontally to inspect the complete schema.</p></div>{queryError ? <p className="dataset-query-error">{queryError}</p> : <div className="dataset-table-scroll"><table><thead><tr>{visibleColumns.map((column) => <th key={column}>{fieldLabel(fields.find((field) => field.name === column) || { name: column, alias: column, type: '' })}</th>)}</tr></thead><tbody>{previewRows.map((row, rowIndex) => <tr key={rowIndex}>{visibleColumns.map((column) => <td key={column}>{row[column] === null || row[column] === undefined ? '—' : String(row[column])}</td>)}</tr>)}</tbody></table>{!previewRows.length && !isQuerying && <p className="dataset-no-results">No records match the current filters.</p>}</div>}</section>
              </div>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
