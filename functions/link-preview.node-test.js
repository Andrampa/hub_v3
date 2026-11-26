'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { applyMetadata, createHandler, createResolver, normalisePath, requestOrigin } = require('./link-preview')

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta
      name="description"
      content="Default description."
    />
    <meta property="og:title" content="DIEM Hub | Data in Emergencies | FAO" />
    <meta property="og:url" content="https://data-in-emergencies.fao.org/" />
    <link rel="canonical" href="https://data-in-emergencies.fao.org/" />
    <title>DIEM Hub | Data in Emergencies | FAO</title>
  </head>
  <body><div id="root"></div><script type="module" src="/assets/index-abc.js"></script></body>
</html>`

const ITEM_ID = 'a'.repeat(32)

function fakeResponse() {
  const res = { headers: {}, statusCode: 0, body: undefined }
  res.set = (key, value) => { res.headers[key] = value; return res }
  res.status = (code) => { res.statusCode = code; return res }
  res.send = (body) => { res.body = body; return res }
  return res
}

test('normalises trailing slashes and query strings', () => {
  assert.equal(normalisePath('/about/'), '/about')
  assert.equal(normalisePath('/catalog?country=NER'), '/catalog')
  assert.equal(normalisePath('/'), '/')
})

test('replaces existing head tags and adds missing ones once', () => {
  const html = applyMetadata(TEMPLATE, {
    title: 'Afghanistan | DIEM Hub | FAO',
    description: 'Text with "quotes" & <tags>',
    url: 'https://data-in-emergencies.fao.org/countries/afg',
    image: 'https://example.org/image.png',
  })
  assert.match(html, /<title>Afghanistan \| DIEM Hub \| FAO<\/title>/)
  assert.match(html, /<meta property="og:title" content="Afghanistan \| DIEM Hub \| FAO" \/>/)
  assert.match(html, /<meta name="description" content="Text with &quot;quotes&quot; &amp; &lt;tags&gt;" \/>/)
  assert.match(html, /<link rel="canonical" href="https:\/\/data-in-emergencies.fao.org\/countries\/afg" \/>/)
  assert.equal((html.match(/og:title/g) || []).length, 1)
  assert.equal((html.match(/name="description"/g) || []).length, 1)
  assert.match(html, /<meta property="og:image" content="https:\/\/example.org\/image.png" \/>\n[\s\S]*<\/head>/)
  assert.match(html, /src="\/assets\/index-abc.js"/, 'the app bundle reference is untouched')
})

test('resolves fixed routes, redirects and countries', async () => {
  const resolve = createResolver({ countries: { AFG: 'Afghanistan' }, fetchItem: async () => null })
  assert.equal((await resolve('/hazard-impact-assessments')).title, 'Hazard impact assessments')
  assert.equal((await resolve('/flood-services')).path, '/flood-analysis')
  const country = await resolve('/countries/AFG')
  assert.equal(country.title, 'Afghanistan')
  assert.equal(country.path, '/countries/afg')
  assert.equal((await resolve('/countries/cross-country')).title, 'Cross-country analysis')
  assert.equal(await resolve('/countries/zzz'), null)
  assert.equal(await resolve('/no-such-page'), null)
})

test('resolves public products and caches the lookup', async () => {
  let calls = 0
  const resolve = createResolver({
    fetchItem: async () => {
      calls += 1
      return { id: ITEM_ID, title: 'Afghanistan: DIEM brief', snippet: '  Round 12   results ', thumbnail: 'thumbnail/x.png', access: 'public' }
    },
  })
  const first = await resolve(`/catalog/${ITEM_ID.toUpperCase()}`)
  await resolve(`/catalog/${ITEM_ID}`)
  assert.equal(calls, 1)
  assert.equal(first.title, 'Afghanistan: DIEM brief')
  assert.equal(first.description, 'Round 12 results')
  assert.equal(first.path, `/catalog/${ITEM_ID}`)
  assert.match(first.image, /\/content\/items\/a{32}\/info\/thumbnail\/x\.png\?w=800$/)
})

test('keeps defaults for unknown or private products', async () => {
  const resolve = createResolver({ fetchItem: async () => null })
  assert.equal(await resolve(`/catalog/${ITEM_ID}`), null)
  assert.equal(await resolve('/catalog/not-an-id'), null)
})

test('handler serves the route metadata as cacheable html', async () => {
  const handler = createHandler({
    loadTemplate: async () => TEMPLATE,
    resolve: createResolver({ countries: { NER: 'Niger' } }),
  })
  const res = fakeResponse()
  await handler({ method: 'GET', path: '/countries/ner' }, res)
  assert.equal(res.statusCode, 200)
  assert.match(res.headers['Content-Type'], /text\/html/)
  assert.match(res.headers['Cache-Control'], /s-maxage=300/)
  assert.match(res.body, /<title>Niger \| DIEM Hub \| FAO<\/title>/)
})

test('handler falls back to the unmodified page when metadata fails', async () => {
  const handler = createHandler({
    loadTemplate: async () => TEMPLATE,
    resolve: async () => { throw new Error('ArcGIS down') },
    log: { error() {} },
  })
  const res = fakeResponse()
  await handler({ method: 'GET', path: `/catalog/${ITEM_ID}` }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body, TEMPLATE)
})

test('handler rejects non-read methods', async () => {
  const handler = createHandler({ loadTemplate: async () => TEMPLATE, resolve: async () => null })
  const res = fakeResponse()
  await handler({ method: 'POST', path: '/about' }, res)
  assert.equal(res.statusCode, 405)
})

test('names explorer views from country, round and theme', async () => {
  const resolve = createResolver({ countries: { MMR: 'Myanmar', AFG: 'Afghanistan' } })
  const view = await resolve('/monitoring?theme=shocks&iso=MMR&round=14&field=shock_lostemplorwork_1')
  assert.equal(view.title, 'Myanmar · Round 14 · Shocks and income | Household Survey Explorer')
  assert.equal(view.description, 'DIEM household survey results for Myanmar, round 14: shocks and income, in the interactive Household Survey Explorer.')
  assert.equal(view.photo, 'drc-phone-interview-round-8-2024')
  assert.match(view.path, /^\/monitoring\?theme=shocks&iso=MMR&round=14/)
  assert.equal((await resolve('/monitoring?iso=AFG')).photo, 'afghanistan-terraced-valley-interview-2023')
})

test('ignores unknown explorer values and falls back to the plain explorer', async () => {
  const resolve = createResolver({ countries: {} })
  assert.equal((await resolve('/monitoring?iso=<x>&round=abc&theme=nope')).title, 'Household Survey Explorer')
  assert.equal((await resolve('/monitoring')).title, 'Household Survey Explorer')
})

test('assigns section and country photos', async () => {
  const resolve = createResolver({ countries: { AFG: 'Afghanistan', MLI: 'Mali' } })
  assert.equal((await resolve('/about')).photo, 'drc-field-mission-team-2025')
  assert.equal((await resolve('/countries/afg')).photo, 'afghanistan-terraced-valley-interview-2023')
  assert.equal((await resolve('/countries/mli')).photo, 'afghanistan-mountain-interview-2025')
  assert.equal((await resolve('/countries/cross-country')).photo, 'cyclone-freddy-madagascar-2023')
})

test('serves photos from the requesting Hub host only', () => {
  const req = (host) => ({ headers: { 'x-forwarded-host': host } })
  assert.equal(requestOrigin(req('fao-oer-review.web.app')), 'https://fao-oer-review.web.app')
  assert.equal(requestOrigin(req('data-in-emergencies.fao.org')), 'https://data-in-emergencies.fao.org')
  assert.equal(requestOrigin(req('evil.example.com')), 'https://data-in-emergencies.fao.org')
  assert.equal(requestOrigin({ headers: {} }), 'https://data-in-emergencies.fao.org')
})

test('every referenced preview photo is published', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const routes = require('./link-preview-routes')
  const names = new Set([
    routes.DEFAULT_IMAGE, routes.EXPLORER_IMAGE, routes.CROSS_COUNTRY_IMAGE,
    ...Object.values(routes.COUNTRY_IMAGES),
    ...Object.values(routes.STATIC_ROUTES).map((route) => route.image).filter(Boolean),
  ])
  for (const name of names) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'link-previews', `${name}.jpg`)), name)
  }
})
