// Copies the built index.html and an ISO3 -> country name table next to the
// linkPreview Cloud Function, so it serves exactly the page Hosting just built.
// Runs as the last step of `npm run build`; the output is generated, not committed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import countryMetadata from '@d3-maps/atlas/metadata/countries'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'functions', 'link-preview-generated')
mkdirSync(outDir, { recursive: true })

writeFileSync(join(outDir, 'index.html'), readFileSync(join(root, 'dist', 'index.html')))

const countries = {}
for (const country of countryMetadata) {
  if (country.isoA3 && /^[A-Z]{3}$/.test(country.isoA3) && country.name) countries[country.isoA3] = country.name
}
// Same alias the app applies in countryDefinition (src/services/countries.ts).
if (countries.TZA) countries.TZN = countries.TZA
writeFileSync(join(outDir, 'countries.json'), JSON.stringify(countries))

console.log(`link preview: template and ${Object.keys(countries).length} country names written to functions/link-preview-generated`)
