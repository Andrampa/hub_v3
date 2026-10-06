import { DOCUMENTATION_RESOURCES, GENERATIONS, authoritativeResourceUrl, type DataGeneration } from '../services/protectedData'

export function MicrodataDocumentation({ versions }: { versions: DataGeneration[] }) {
  const unique = [...new Set(versions)].sort()
  if (!unique.length) return null
  return <details className="microdata-help microdata-documentation" role="group" aria-label="Microdata documentation">
    <summary title="V1, V2 and V3 identify the data infrastructure and its questionnaire and file structure.">Documentation: {unique.map((version) => GENERATIONS[version].label).join(' · ')}</summary>
    {unique.map((version) => {
      // Aggregate-only SDMX documents do not describe household microdata.
      const resources = DOCUMENTATION_RESOURCES.filter((resource) => resource.version === version && resource.audience !== 'aggregate')
      return <div key={version}><p><strong>{GENERATIONS[version].label}</strong></p>
        {resources.length ? <ul>{resources.map((resource) => <li key={resource.id}><a href={authoritativeResourceUrl({ ...resource, access: 'available' })} target="_blank" rel="noreferrer">{resource.fallbackTitle}</a></li>)}</ul>
          : <p>{GENERATIONS[version].label} documentation is not yet published. Field names are included with each download.</p>}
      </div>
    })}
  </details>
}
