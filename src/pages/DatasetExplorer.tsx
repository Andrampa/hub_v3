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
  BROWSER_EXPORT_LIMIT,
  bulkDownloadScripts,
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
  hubDownloadRequest,
  resourceForDataset,
  usableFields,
  validatePackagedDownload,
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

function formatItemDate(value?: number) {
  if (!value) return 'Not provided'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
}

function recommendedFilterFields(fields: FeatureField[]) {
  return fields.filter((field) => /(^|_)(adm0_(name|iso3)|country|iso3|round|survey_round|cycle)($|_)/i.test(field.name))
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
  const recommendedFields = useMemo(() => recommendedFilterFields(fields), [fields])
  const remainingFields = useMemo(() => fields.filter((field) => !recommendedFields.includes(field)), [fields, recommendedFields])
  const draftFieldDefinition = fields.find((field) => field.name === draftField)
  const where = useMemo(() => buildWhere(filters, fields), [filters, fields])
  const links = definition ? apiLinks(definition, where) : undefined
  const scripts = definition ? bulkDownloadScripts(definition, where) : undefined
  const overDownloadLimit = count !== undefined && count > BROWSER_EXPORT_LIMIT

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

  function downloadScript(source: string, filename: string, type: string) {
    downloadBlob(new Blob([source], { type }), filename)
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

  async function exportServerFormat(format: typeof HUB_DOWNLOAD_FORMATS[number]['format']) {
    if (!definition || count === undefined) return
    if (count > BROWSER_EXPORT_LIMIT) {
      setDownloadState(`Filter this result to ${BROWSER_EXPORT_LIMIT.toLocaleString()} records or fewer before downloading.`)
      return
    }
    const { descriptor, url, params } = hubDownloadRequest(definition, format, where)
    setDownloadState(`Requesting ${descriptor.label} from the DIEM export service...`)
    try {
      const blob = await auth.downloadProtected(url, params)
      const validated = await validatePackagedDownload(blob, format)
      downloadBlob(validated.blob, `${definition.resource.fallbackTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}.${validated.extension}`)
      setDownloadState(`${descriptor.label} download started.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setDownloadState(`${descriptor.label} could not be generated. ${message || 'The source item may not have this export format enabled.'}`)
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
                <section className="dataset-info-stack" aria-labelledby="dataset-about-heading">
                  <span className="dataset-info-type">{definition.resource.item?.type || (definition.isTable ? 'Feature Table' : 'Feature Layer')}</span>
                  <h2 id="dataset-about-heading">{definition.resource.item?.title || definition.resource.fallbackTitle}</h2>
                  <p className="dataset-info-owner">Published by <strong>{definition.resource.item?.owner || 'FAO DIEM'}</strong></p>
                  <p>{definition.resource.item?.snippet || definition.resource.description}</p>
                  <div className="dataset-info-actions"><a href="#dataset-table">View data table</a><a href="#dataset-download">Download options</a></div>
                  <a className="dataset-arcgis-link" href={links?.item} target="_blank" rel="noreferrer">View full ArcGIS details <ExplorerIcon name="external"/></a>
                  <dl>
                    <div><dt>Published</dt><dd>{formatItemDate(definition.resource.item?.created)}</dd></div>
                    <div><dt>Information updated</dt><dd>{formatItemDate(definition.resource.item?.modified)}</dd></div>
                    <div><dt>Data updated</dt><dd>{formatItemDate(definition.layer.editingInfo?.lastEditDate)}</dd></div>
                    <div><dt>Records</dt><dd>{count === undefined ? 'Loading…' : count.toLocaleString()}</dd></div>
                    <div><dt>Sharing</dt><dd>{definition.resource.item?.access === 'public' ? 'Public' : 'DIEM community access'}</dd></div>
                    <div><dt>License</dt><dd>{definition.resource.item?.licenseInfo ? 'See item terms' : 'Creative Commons Attribution 4.0'}</dd></div>
                    <div><dt>Layer</dt><dd>{definition.layer.name}</dd></div>
                    <div><dt>Attributes</dt><dd>{fields.length.toLocaleString()}</dd></div>
                  </dl>
                </section>
                <div className="control-panel-heading"><span><ExplorerIcon name="filter"/></span><div><strong>Filters</strong><small>Start with country and survey round to create a focused extract.</small></div></div>
                <div className="filter-builder">
                  <label><span>Attribute</span><select value={draftField} onChange={(event) => { setDraftField(event.target.value); setDraftOperator('equals') }}>{recommendedFields.length > 0 && <optgroup label="Recommended: country and round">{recommendedFields.map((field) => <option value={field.name} key={field.name}>{fieldLabel(field)}</option>)}</optgroup>}<optgroup label="All attributes">{remainingFields.map((field) => <option value={field.name} key={field.name}>{fieldLabel(field)}</option>)}</optgroup></select></label>
                  <label><span>Condition</span><select value={draftOperator} onChange={(event) => setDraftOperator(event.target.value as DatasetFilter['operator'])}>{operatorOptions(draftFieldDefinition).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                  <label><span>Value</span><input value={draftValue} onChange={(event) => setDraftValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addFilter() }} placeholder={fieldIsText(draftFieldDefinition) ? 'Enter a value' : 'Enter a number'} /></label>
                  <button type="button" onClick={addFilter} disabled={!draftValue.trim()}>Add filter <ExplorerIcon name="arrow"/></button>
                </div>
                <div className="active-filters" aria-live="polite">{filters.length ? filters.map((filter) => <span key={filter.id}>{fieldLabel(fields.find((field) => field.name === filter.fieldName) || { name: filter.fieldName, alias: filter.fieldName, type: '' })} <em>{filter.operator === 'contains' ? 'contains' : filter.operator === 'greaterThan' ? '>' : filter.operator === 'lessThan' ? '<' : '='}</em> {filter.value}<button type="button" onClick={() => setFilters((current) => current.filter((candidate) => candidate.id !== filter.id))} aria-label={`Remove ${filter.fieldName} filter`}><ExplorerIcon name="close"/></button></span>) : <p>No filters applied. Choose a country and round before downloading.</p>}</div>
                {filters.length > 0 && <button className="clear-filters" type="button" onClick={() => setFilters([])}>Clear all filters</button>}
                <div className="download-panel" id="dataset-download">
                  <div><ExplorerIcon name="download"/><strong>Download filtered data</strong><p>The portal prepares files only when the current result contains 20,000 records or fewer.</p></div>
                  <div className={`download-limit ${overDownloadLimit ? 'is-over-limit' : 'is-ready'}`} role="status">
                    <strong>{count === undefined ? 'Checking result size…' : overDownloadLimit ? `${count.toLocaleString()} records — filter required` : `${count.toLocaleString()} records — ready`}</strong>
                    <span>{overDownloadLimit ? 'Add country and round filters, or use a bulk API script below.' : `Within the ${BROWSER_EXPORT_LIMIT.toLocaleString()}-record download limit.`}</span>
                  </div>
                  <span className="download-group-label">Direct downloads</span>
                  <div className="download-format-grid"><button type="button" onClick={() => void exportCsv()} disabled={count === undefined || isQuerying || overDownloadLimit}>CSV</button>{!definition.isTable && <button type="button" onClick={() => void exportGeoJson()} disabled={count === undefined || isQuerying || overDownloadLimit}>GeoJSON</button>}</div>
                  <span className="download-group-label">Packaged formats</span>
                  <div className="download-format-grid">{HUB_DOWNLOAD_FORMATS.filter((candidate) => !['csv', 'geojson'].includes(candidate.format) && (!candidate.spatial || !definition.isTable)).map((candidate) => <button type="button" key={candidate.format} onClick={() => void exportServerFormat(candidate.format)} disabled={count === undefined || isQuerying || overDownloadLimit}>{candidate.label}</button>)}</div>
                  {downloadState && <p className="download-status" role="status">{downloadState}</p>}
                </div>
                <details className="bulk-script-panel">
                  <summary><ExplorerIcon name="code"/> Bulk API scripts <span>Python and R</span></summary>
                  {scripts && <div><p>For larger extractions, run a script with your own short-lived ArcGIS token. The current filters are already included.</p><div className="script-actions"><button type="button" onClick={() => downloadScript(scripts.python, 'diem-bulk-download.py', 'text/x-python')}>Download Python</button><button type="button" onClick={() => void copy('python-script', scripts.python)}>{copied === 'python-script' ? 'Python copied' : 'Copy Python'}</button><button type="button" onClick={() => downloadScript(scripts.r, 'diem-bulk-download.R', 'text/x-r-source')}>Download R</button><button type="button" onClick={() => void copy('r-script', scripts.r)}>{copied === 'r-script' ? 'R copied' : 'Copy R'}</button></div></div>}
                </details>
                <details className="api-panel"><summary><ExplorerIcon name="code"/> API links <span>Use in scripts and GIS tools</span></summary>{links && <div>{Object.entries(links).map(([label, value]) => <div key={label}><strong>{label === 'query' ? 'Filtered query' : label}</strong><code>{value}</code><button type="button" onClick={() => void copy(label, value)}>{copied === label ? <ExplorerIcon name="check"/> : <ExplorerIcon name="copy"/>}<span>{copied === label ? 'Copied' : 'Copy'}</span></button></div>)}</div>}</details>
              </aside>
              <div className="dataset-results-panel">
                <div className="dataset-results-toolbar"><span>{isQuerying ? 'Refreshing filtered results...' : `Previewing ${previewRows.length.toLocaleString()} records`}</span><span>{definition.layer.name}</span></div>
                {!definition.isTable && (isMapLoading ? <div className="dataset-map-loading"><span className="loader"/><strong>Loading map geometry</strong><p>The data table remains available while spatial features load.</p></div> : geometry ? <DatasetGeometryMap collection={geometry} totalCount={count || 0} /> : <div className="dataset-map-unavailable"><strong>Map preview is temporarily unavailable.</strong><p>{mapError || 'The service did not return geometry for the current filters.'}</p></div>)}
                <section className="dataset-table-section" id="dataset-table" aria-labelledby="table-preview-heading"><div><span className="kicker">Record preview</span><h2 id="table-preview-heading">Inspect the matching data</h2><p className="table-help">All {fields.length.toLocaleString()} attributes are included. Scroll horizontally to inspect the complete schema.</p></div>{queryError ? <p className="dataset-query-error">{queryError}</p> : <div className="dataset-table-scroll"><table><thead><tr>{visibleColumns.map((column) => <th key={column}>{fieldLabel(fields.find((field) => field.name === column) || { name: column, alias: column, type: '' })}</th>)}</tr></thead><tbody>{previewRows.map((row, rowIndex) => <tr key={rowIndex}>{visibleColumns.map((column) => <td key={column}>{row[column] === null || row[column] === undefined ? '—' : String(row[column])}</td>)}</tr>)}</tbody></table>{!previewRows.length && !isQuerying && <p className="dataset-no-results">No records match the current filters.</p>}</div>}</section>
              </div>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
