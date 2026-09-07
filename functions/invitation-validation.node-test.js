'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { allowedCaller, completeGrant, exactIds, sameOrigin } = require('./invitation-validation')

test('accepts only a bounded list of exact group IDs', () => {
  const id = 'a'.repeat(32)
  assert.deepEqual(exactIds([id, id.toUpperCase()]), [id])
  assert.equal(exactIds(['not-an-id']), null)
  assert.equal(exactIds(Array.from({ length: 21 }, () => id)), null)
})

test('derives eligibility from ArcGIS self rather than browser identity', () => {
  assert.equal(allowedCaller({ username: 'recipient', orgId: 'D5aXW6TZFpeM2wke', disabled: false }), true)
  assert.equal(allowedCaller({ username: 'recipient', orgId: 'other' }), false)
  assert.equal(allowedCaller({ username: 'recipient', orgId: 'D5aXW6TZFpeM2wke', disabled: true }), false)
})

test('requires a live seven-day invited grant with all version components', () => {
  const now = 1_000
  const base = {
    status: 'invited', access_duration_hours: 168, invited_utc: 100,
    invitation_expires_utc: 2_000, expires_utc: 2_000,
    questionnaire_version: 'v3', core_view_item_id: 'a'.repeat(32), optional_view_item_id: 'b'.repeat(32),
  }
  assert.equal(completeGrant(base, now), true)
  assert.equal(completeGrant({ ...base, expires_utc: now }, now), false)
  assert.equal(completeGrant({ ...base, optional_view_item_id: null }, now), false)
})

test('accepts only same-origin browser calls', () => {
  const request = (origin, host) => ({ get: (name) => ({ origin, host }[name]) })
  assert.equal(sameOrigin(request('https://example.org', 'example.org')), true)
  assert.equal(sameOrigin(request('https://evil.example', 'example.org')), false)
})
