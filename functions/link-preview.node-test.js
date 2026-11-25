'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { applyMetadata, createHandler, createResolver, normalisePath } = require('./link-preview')

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
