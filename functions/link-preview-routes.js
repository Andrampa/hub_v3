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

/**
 * Preview photos are served from public/link-previews/<name>.jpg, a fixed URL
 * that survives rebuilds (the page heroes in src/assets are renamed per build).
 * Each route uses the hero of its own page where it has one.
 */
const DEFAULT_IMAGE = 'afghanistan-mountain-interview-2025'
const EXPLORER_IMAGE = 'drc-phone-interview-round-8-2024'
const CROSS_COUNTRY_IMAGE = 'cyclone-freddy-madagascar-2023'

/** Countries with a field photo of their own; others use DEFAULT_IMAGE. */
const COUNTRY_IMAGES = {
  AFG: 'afghanistan-terraced-valley-interview-2023',
  BGD: 'bangladesh-haor-flood-2024',
  CAF: 'car-bria-interview-2024',
  COD: 'drc-ndjili-rice-harvest-2025',
  COL: 'colombia-quipama-doorstep-2023',
  GTM: 'guatemala-maize-field-interview-2022',
  PAK: 'pakistan-sheep-flock-2022',
  SYR: 'syria-earthquake-farm-damage-2023',
  ZMB: 'zambia-drought-2024',
}

/** Household Survey Explorer themes (src/services/monitoringThemes.ts). */
const EXPLORER_THEMES = {
  shocks: 'Shocks and income',
  crop: 'Crop',
  livestock: 'Livestock',
  food_security: 'Food security',
  needs: 'Needs',
}

const STATIC_ROUTES = {
  '/': {
    image: 'afghanistan-mountain-interview-2025',
    title: 'Data in Emergencies',
    description: 'Regularly collected evidence on how shocks affect agricultural livelihoods and food security in fragile and risk-prone contexts: household monitoring, hazard impact assessments, flood services and country evidence.',
  },
  '/catalog': {
    image: 'drc-ndjili-field-team-2025',
    title: 'Catalogue',
    description: 'Published DIEM products: monitoring briefs, assessment reports, questionnaires, presentations and maps, filterable by evidence pathway, product type, country and year.',
  },
  '/countries': {
    image: 'drc-ndjili-market-gardens-2025',
    title: 'Countries',
    description: 'DIEM evidence by country: an atlas, a country directory and a publication matrix showing which products exist where.',
  },
  '/data/guide': {
    image: 'afghanistan-f2f-smartphone-interview-2024',
    title: 'Data access guide',
    description: 'How to find, download, interpret and cite DIEM monitoring data: what is published, which questionnaire generation produced it, how access is granted, and the required citation. Public guide; the data itself needs a DIEM community account.',
  },
  '/data/microdata-request': {
    image: 'afghanistan-f2f-smartphone-interview-2024',
    title: 'Microdata request',
    description: 'Request household-level DIEM microdata from a recent survey for research or operational purposes, before it is published in the FAO Food and Agriculture Microdata Catalogue.',
  },
  '/data/surveys': {
    image: 'afghanistan-f2f-smartphone-interview-2024',
    title: 'Your surveys',
    description: 'Sign in with a DIEM community account to choose surveys and download aggregated household survey data with its documentation.',
  },
  '/monitoring-system': {
    image: 'afghanistan-household-visit-round-10-2025',
    title: 'Surveys catalogue',
    description: 'DIEM household survey rounds: which countries are in the field, which rounds have been released, and the published briefs, presentations, questionnaires and datasets that belong to each round.',
  },
  '/monitoring': {
    image: 'drc-phone-interview-round-8-2024',
    title: 'Household Survey Explorer',
    description: 'The full-screen DIEM Household Survey Explorer: compare indicators, countries and monitoring rounds from the household survey series in one interactive application.',
  },
  '/flood-analysis': {
    image: 'bangladesh-haor-flood-2024',
    title: 'Flood analysis',
    description: 'DIEM flood services: the EVE 2.0 exposure model and field data modes, VISTA satellite products and flood impact assessments, connecting hazard, exposure, observation and field evidence into one traceable workflow.',
  },
  '/hazard-impact-assessments': {
    image: 'syria-earthquake-impact-2023',
    title: 'Hazard impact assessments',
    description: 'DIEM rapid assessments of how floods, droughts, conflict and other hazards affect agriculture, food security and rural livelihoods, with a shock atlas, per-assessment dossiers and an evidence timeline.',
  },
  '/about': {
    image: 'drc-field-mission-team-2025',
    title: 'About DIEM',
    description: 'What Data in Emergencies is: an FAO information system that collects primary household data in food crisis countries so decisions about agricultural livelihoods rest on current evidence, and how its monitoring, assessment and analysis work fits together.',
  },
  '/contact': {
    image: 'drc-field-mission-team-2025',
    title: 'Contact us',
    description: 'Contact the FAO Data in Emergencies team about DIEM products, data and community access, flood-service access, or collaboration on monitoring and impact assessment.',
  },
  '/photo-galleries': {
    image: 'afghanistan-mountain-interview-2025',
    title: 'Photo galleries',
    description: 'Photographs from DIEM field work: how teams and partners collect evidence with farming communities in countries affected by food crises and shocks, drawn from the FAO emergencies albums.',
  },
}

// Old addresses that the app redirects; a pasted old link previews as its destination.
STATIC_ROUTES['/data'] = { ...STATIC_ROUTES['/data/guide'], canonical: '/data/guide' }
STATIC_ROUTES['/flood-services'] = { ...STATIC_ROUTES['/flood-analysis'], canonical: '/flood-analysis' }
STATIC_ROUTES['/search'] = { ...STATIC_ROUTES['/catalog'], canonical: '/catalog' }

module.exports = { COUNTRY_IMAGES, CROSS_COUNTRY_IMAGE, DEFAULT_IMAGE, EXPLORER_IMAGE, EXPLORER_THEMES, SITE_NAME, STATIC_ROUTES }
