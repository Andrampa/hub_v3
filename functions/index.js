'use strict'

const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { createHandler } = require('./invitation-validation')

const clientId = defineSecret('DIEM_ARCGIS_ADMIN_CLIENT_ID')
const clientSecret = defineSecret('DIEM_ARCGIS_ADMIN_CLIENT_SECRET')

exports.validateMicrodataInvitations = onRequest({
  region: 'europe-west1',
  secrets: [clientId, clientSecret],
  maxInstances: 10,
  timeoutSeconds: 20,
  memory: '256MiB',
}, createHandler({ clientId: () => clientId.value(), clientSecret: () => clientSecret.value() }))

// Serves index.html with per-route title, description and image so links
// pasted into Teams, Outlook or Slack preview the page they point to.
exports.linkPreview = onRequest({
  region: 'europe-west1',
  maxInstances: 20,
  timeoutSeconds: 10,
  memory: '256MiB',
}, require('./link-preview').createDefaultHandler())
