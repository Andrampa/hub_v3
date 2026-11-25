'use strict'

/**
 * Link-preview metadata for fixed Hub routes.
 *
 * Mirrors the `usePageMetadata` call in each page (src/pages/*.tsx and
 * src/App.tsx). When a page's title or description changes, change it here too,
 * or shared links keep the old text. Dynamic routes (/catalog/:itemId,
 * /countries/:iso3) are resolved in link-preview.js.
 */

const SITE_NAME = 'DIEM Hub'

const STATIC_ROUTES = {
  '/': {
    title: 'Data in Emergencies',
    description: 'Regularly collected evidence on how shocks affect agricultural livelihoods and food security in fragile and risk-prone contexts: household monitoring, hazard impact assessments, flood services and country evidence.',
  },
  '/catalog': {
    title: 'Catalogue',
    description: 'Published DIEM products: monitoring briefs, assessment reports, questionnaires, presentations and maps, filterable by evidence pathway, product type, country and year.',
  },
  '/countries': {
    title: 'Countries',
    description: 'DIEM evidence by country: an atlas, a country directory and a publication matrix showing which products exist where.',
  },
  '/data/guide': {
    title: 'Data access guide',
    description: 'How to find, download, interpret and cite DIEM monitoring data: what is published, which questionnaire generation produced it, how access is granted, and the required citation. Public guide; the data itself needs a DIEM community account.',
  },
  '/data/microdata-request': {
    title: 'Microdata request',
    description: 'Request household-level DIEM microdata from a recent survey for research or operational purposes, before it is published in the FAO Food and Agriculture Microdata Catalogue.',
  },
  '/data/surveys': {
    title: 'Your surveys',
    description: 'Sign in with a DIEM community account to choose surveys and download aggregated household survey data with its documentation.',
  },
  '/monitoring-system': {
    title: 'Surveys catalogue',
    description: 'DIEM household survey rounds: which countries are in the field, which rounds have been released, and the published briefs, presentations, questionnaires and datasets that belong to each round.',
  },
  '/monitoring': {
    title: 'Household Survey Explorer',
    description: 'The full-screen DIEM Household Survey Explorer: compare indicators, countries and monitoring rounds from the household survey series in one interactive application.',
  },
  '/flood-analysis': {
    title: 'Flood analysis',
    description: 'DIEM flood services: the EVE 2.0 exposure model and field data modes, VISTA satellite products and flood impact assessments, connecting hazard, exposure, observation and field evidence into one traceable workflow.',
  },
  '/hazard-impact-assessments': {
    title: 'Hazard impact assessments',
    description: 'DIEM rapid assessments of how floods, droughts, conflict and other hazards affect agriculture, food security and rural livelihoods, with a shock atlas, per-assessment dossiers and an evidence timeline.',
  },
  '/about': {
    title: 'About DIEM',
    description: 'What Data in Emergencies is: an FAO information system that collects primary household data in food crisis countries so decisions about agricultural livelihoods rest on current evidence, and how its monitoring, assessment and analysis work fits together.',
  },
  '/contact': {
    title: 'Contact us',
    description: 'Contact the FAO Data in Emergencies team about DIEM products, data and community access, flood-service access, or collaboration on monitoring and impact assessment.',
  },
  '/photo-galleries': {
    title: 'Photo galleries',
    description: 'Photographs from DIEM field work: how teams and partners collect evidence with farming communities in countries affected by food crises and shocks, drawn from the FAO emergencies albums.',
  },
}

// Old addresses that the app redirects; a pasted old link previews as its destination.
STATIC_ROUTES['/data'] = { ...STATIC_ROUTES['/data/guide'], canonical: '/data/guide' }
STATIC_ROUTES['/flood-services'] = { ...STATIC_ROUTES['/flood-analysis'], canonical: '/flood-analysis' }
STATIC_ROUTES['/search'] = { ...STATIC_ROUTES['/catalog'], canonical: '/catalog' }

module.exports = { SITE_NAME, STATIC_ROUTES }
