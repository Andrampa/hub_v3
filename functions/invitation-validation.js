'use strict'

const { createHash } = require('node:crypto')

const COMMUNITY_ORG_ID = 'D5aXW6TZFpeM2wke'
const REGISTRY_ITEM_ID = 'e186ea5b20774a94914bfeda23242f43'
const GLOBAL_REST = 'https://www.arcgis.com/sharing/rest'
const MAX_GROUP_IDS = 20
const MAX_BODY_BYTES = 4096
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 20
const attempts = new Map()

function json(res, status, payload) {
  res.status(status).set('Cache-Control', 'no-store').set('Content-Type', 'application/json').send(JSON.stringify(payload))
}

function bearer(req) {
  const match = /^Bearer\s+([^\s]+)$/i.exec(req.get('authorization') || '')
  return match?.[1]
}

function exactIds(value) {
  if (!Array.isArray(value) || value.length > MAX_GROUP_IDS) return null
  const ids = value.filter((id) => typeof id === 'string' && /^[0-9a-f]{32}$/i.test(id))
  if (ids.length !== value.length) return null
  return [...new Set(ids.map((id) => id.toLowerCase()))]
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

async function arcgisJson(url, options = {}) {
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload || payload.error) throw new Error('ArcGIS request failed')
  return payload
}

async function caller(token) {
  return arcgisJson(`${GLOBAL_REST}/community/self?f=json`, {
    headers: { 'X-Esri-Authorization': `Bearer ${token}` },
  })
}

function allowedCaller(self) {
  return typeof self.username === 'string'
    && self.orgId === COMMUNITY_ORG_ID
    && self.disabled !== true
}

function rateAllowed(username, now = Date.now()) {
  const key = createHash('sha256').update(username.toLowerCase()).digest('hex')
  const recent = (attempts.get(key) || []).filter((time) => now - time < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) return false
  recent.push(now)
  attempts.set(key, recent)
  return true
}

async function appToken(clientId, clientSecret) {
  const body = new URLSearchParams({
    f: 'json',
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  })
  const payload = await arcgisJson(`${GLOBAL_REST}/oauth2/token`, { method: 'POST', body })
  if (typeof payload.access_token !== 'string') throw new Error('ArcGIS application token missing')
  return payload.access_token
}

function completeGrant(row, now) {
  const version = String(row.questionnaire_version || '').toLowerCase()
  const componentsPresent = version === 'v3'
    ? /^[0-9a-f]{32}$/i.test(row.core_view_item_id || '') && /^[0-9a-f]{32}$/i.test(row.optional_view_item_id || '')
    : ['v1', 'v2'].includes(version) && /^[0-9a-f]{32}$/i.test(row.legacy_view_item_id || '')
  return row.status === 'invited'
    && Number(row.access_duration_hours) === 168
    && Number(row.invited_utc) > 0
    && Number(row.expires_utc) > now
    && Number(row.invitation_expires_utc) > now
    && componentsPresent
}

async function registryRows(token, username, groupIds) {
  const item = await arcgisJson(`${GLOBAL_REST}/content/items/${REGISTRY_ITEM_ID}?f=json`, {
    headers: { 'X-Esri-Authorization': `Bearer ${token}` },
  })
  if (!item.url || item.access === 'public' || item.access === 'org') throw new Error('Registry privacy contract failed')
  const where = `recipient_username = ${sql(username)} AND status = 'invited' AND grant_group_id IN (${groupIds.map(sql).join(',')})`
  const body = new URLSearchParams({
    f: 'json', where, returnGeometry: 'false',
    outFields: 'grant_id,recipient_username,questionnaire_version,status,access_duration_hours,invited_utc,invitation_expires_utc,expires_utc,grant_group_id,legacy_view_item_id,core_view_item_id,optional_view_item_id',
  })
  const result = await arcgisJson(`${String(item.url).replace(/\/$/, '')}/0/query`, {
    method: 'POST', body, headers: { 'X-Esri-Authorization': `Bearer ${token}` },
  })
  return (result.features || []).map((feature) => feature.attributes || {})
}

function sameOrigin(req) {
  const origin = req.get('origin')
  if (!origin) return true
  try {
    const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim().toLowerCase()
    return new URL(origin).host.toLowerCase() === host
  } catch {
    return false
  }
}

function createHandler({ clientId, clientSecret }) {
  return async (req, res) => {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' })
    if (!sameOrigin(req)) return json(res, 403, { error: 'Cross-origin requests are not allowed.' })
    if (Number(req.get('content-length') || 0) > MAX_BODY_BYTES) return json(res, 413, { error: 'Request too large.' })
    const groupIds = exactIds(req.body?.groupIds)
    if (!groupIds || groupIds.length === 0) return json(res, 400, { error: 'groupIds must contain 1–20 ArcGIS group IDs.' })
    const userToken = bearer(req)
    if (!userToken) return json(res, 401, { error: 'ArcGIS authentication required.' })

    try {
      const self = await caller(userToken)
      if (!allowedCaller(self)) return json(res, 403, { error: 'An enabled DIEM Community account is required.' })
      if (!rateAllowed(self.username)) return json(res, 429, { error: 'Too many validation requests. Please try again shortly.' })

      const token = await appToken(clientId(), clientSecret())
      const rows = await registryRows(token, self.username, groupIds)
      const validGroupIds = [...new Set(rows
        .filter((row) => completeGrant(row, Date.now()))
        .map((row) => String(row.grant_group_id).toLowerCase()))]
      return json(res, 200, { validGroupIds })
    } catch (error) {
      console.error('microdata invitation validation failed', { message: error instanceof Error ? error.message : 'unknown' })
      return json(res, 503, { error: 'Invitation validation is temporarily unavailable.' })
    }
  }
}

module.exports = { createHandler, exactIds, allowedCaller, completeGrant, sameOrigin }
