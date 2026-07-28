import type { SurveyRelease } from './monitoring'

/**
 * Thematic-area availability for one survey.
 *
 * This mirrors the Monitoring application's own `resolveTheme` rule so the Hub
 * never offers a thematic area that application would refuse to open. The
 * application decides in two different ways, and so does this module:
 *
 * - Native V2 surveys (validated legacy rounds whose collection started on or
 *   after the V2 cutoff, present in both V2 services) are probed against the
 *   same public microdata and histogram layers the application probes.
 * - Older iframe-legacy surveys have no probeable data; the application renders
 *   their per-theme legacy dashboards instead, so availability is the set of
 *   dashboards the survey row carries (`SurveyRelease.legacyThemes`).
 *
 * Fisheries is never offered: the application excludes it for every legacy
 * survey, and every round on the board is legacy.
 */

const ARCGIS_SERVICES_ROOT = 'https://services5.arcgis.com/sjP4Ugu5s0dZWLjd/arcgis/rest/services'
const V2_MICRODATA_QUERY = `${ARCGIS_SERVICES_ROOT}/DIEM_dashboard_pie_charts/FeatureServer/20/query`
const V2_HISTOGRAM_QUERY = `${ARCGIS_SERVICES_ROOT}/diem_master_mview_histogram/FeatureServer/43/query`

// The application only opens the native V2 experience for rounds collected from
// this date onwards; earlier rounds stay on their legacy dashboards.
const NATIVE_V2_MIN_START = Date.parse('2022-10-01')

export interface ThemeOption {
  id: string
  label: string
}

interface ThemeDefinition extends ThemeOption {
  microdataCounts: string[]
  microdataSums: string[]
  histogramOptions: string[]
}

interface QueryResponse {
  features?: Array<{ attributes?: Record<string, unknown> }>
  error?: { message?: string }
}

async function queryLayer(url: string, body: URLSearchParams, signal?: AbortSignal) {
  // POST, not GET: the histogram probe names roughly ninety option fields and
  // overruns the URL length limit as a query string.
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal,
  })
  if (!response.ok) throw new Error(`Thematic availability request failed (${response.status})`)
  const data = await response.json() as QueryResponse
  if (data.error) throw new Error(data.error.message || 'Thematic availability could not be read.')
  return data
}

// Theme registry and availability probe fields, copied from the Monitoring
// application's `legacy-v2/data/question-metadata-v2.json` (questionnaire v2,
// generated 2026-07-23). It is vendored rather than fetched because that file is
// served without CORS headers and the browser cannot read it cross-origin.
// The V2 questionnaire is frozen, so these field lists are stable; if the
// application regenerates them, regenerate this list from the same source.
// Fisheries is deliberately absent: the application excludes it for every
// legacy survey, and every round on the board is legacy.
const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: 'shocks',
    label: 'Shocks & income',
    microdataCounts: ['income_main', 'income_main_comp', 'income_sec'],
    microdataSums: [],
    histogramOptions: [
      'shock_noshock',
      'shock_sicknessordeathofhh',
      'shock_lostemplorwork',
      'shock_otherintrahhshock',
      'shock_higherfoodprices',
      'shock_higherfuelprices',
      'shock_mvtrestrict',
      'shock_othereconomicshock',
      'shock_pestoutbreak',
      'shock_plantdisease',
      'shock_animaldisease',
      'shock_napasture',
      'shock_othercropandlivests',
      'shock_coldtemporhail',
      'shock_flood',
      'shock_hurricane',
      'shock_drought',
      'shock_earthquake',
      'shock_landslides',
      'shock_firenatural',
      'shock_othernathazard',
      'shock_violenceinsecconf',
      'shock_theftofprodassets',
      'shock_firemanmade',
      'shock_othermanmadehazard',
      'shock_dk',
      'shock_ref',
    ],
  },
  {
    id: 'crop',
    label: 'Crop',
    microdataCounts: ['crp_main', 'crp_area_change', 'crp_harv_change'],
    microdataSums: ['resp_iscropproducer'],
    histogramOptions: [
      'crp_proddif_plant_disease',
      'crp_proddif_pest_outbreak',
      'crp_proddif_animal_grazing',
      'crp_proddif_access_plot',
      'crp_proddif_access_fertilize',
      'crp_proddif_seed_quality',
      'crp_proddif_seed_quantity',
      'crp_proddif_access_pesticide',
      'crp_proddif_access_labour',
      'crp_proddif_access_machinery',
      'crp_proddif_access_fuel',
      'crp_proddif_soil_erosion',
      'crp_proddif_lack_irrigation',
      'crp_proddif_excess_water',
      'crp_proddif_access_credit',
      'crp_proddif_other',
      'crp_proddif_dk',
      'crp_proddif_ref',
    ],
  },
  {
    id: 'livestock',
    label: 'Livestock',
    microdataCounts: ['ls_main', 'ls_proddif', 'ls_num_increased'],
    microdataSums: ['resp_islsproducer'],
    histogramOptions: [
      'ls_num_no_change',
      'ls_num_inc_less_sales',
      'ls_num_inc_more_birth',
      'ls_num_inc_more_acquired',
      'ls_num_inc_received_free',
      'ls_num_dec_poor_health',
      'ls_num_dec_death',
      'ls_num_dec_sales_good_price',
      'ls_num_dec_sales_distress',
      'ls_num_dec_escape_stolen',
      'ls_num_dec_consumed',
      'ls_num_inc_dec_other',
      'ls_num_inc_dec_dk',
      'ls_num_inc_dec_ref',
    ],
  },
  {
    id: 'food_security',
    label: 'Food security',
    microdataCounts: ['fies_ranout_hhs', 'fies_hungry_hhs', 'fies_whlday_hhs'],
    microdataSums: [],
    histogramOptions: [
      'hdds_cereals',
      'hdds_rootstubers',
      'hdds_vegetables',
      'hdds_fruits',
      'hdds_meat',
      'hdds_eggs',
      'hdds_fish',
      'hdds_legumes',
      'hdds_milkdairy',
      'hdds_oils',
      'hdds_sugar',
      'hdds_condiments',
    ],
  },
  {
    id: 'needs',
    label: 'Needs',
    microdataCounts: ['need', 'assistance_quality'],
    microdataSums: [],
    histogramOptions: [
      'need_food',
      'need_cash',
      'need_vouchers_fair',
      'need_crop_inputs',
      'need_crop_infrastructure',
      'need_crop_knowledge',
      'need_ls_feed',
      'need_ls_vet_service',
      'need_ls_infrastructure',
      'need_ls_knowledge',
      'need_fish_inputs',
      'need_fish_infrastructure',
      'need_fish_knowledge',
      'need_env_infra_rehab',
      'need_cold_storage',
      'need_marketing_supp',
      'need_other',
      'need_dk',
      'need_ref',
    ],
  },
]

let nativeV2Keys: Promise<Set<string>> | undefined

/**
 * Survey keys (`ISO|round`) carried by both V2 services, as the application
 * requires.
 *
 * Deliberately not cancellable. The result is shared by every caller, so
 * honouring one caller's AbortSignal would reject the cached promise for all
 * later callers - closing the chooser once would leave it permanently stuck.
 * The request is small and the answer changes only when a survey is published.
 */
function loadNativeV2Keys() {
  nativeV2Keys ??= (async () => {
    const keysFrom = async (url: string, where: string) => {
      const data = await queryLayer(url, new URLSearchParams({
        f: 'json',
        where,
        outFields: 'adm0_iso3,round',
        returnDistinctValues: 'true',
        returnGeometry: 'false',
        resultRecordCount: '2000',
      }))
      return new Set((data.features || []).flatMap((feature) => {
        const iso = String(feature.attributes?.adm0_iso3 ?? '').trim().toUpperCase()
        const round = String(feature.attributes?.round ?? '').trim()
        return iso && round ? [`${iso}|${round}`] : []
      }))
    }

    const [microdata, histogram] = await Promise.all([
      keysFrom(V2_MICRODATA_QUERY, '1=1'),
      keysFrom(V2_HISTOGRAM_QUERY, 'hh_agricactivity = -1 AND adm_level = 0'),
    ])
    return new Set([...microdata].filter((key) => histogram.has(key)))
  })().catch((reason: Error) => {
    nativeV2Keys = undefined
    throw reason
  })
  return nativeV2Keys
}

function isNativeV2(release: SurveyRelease, keys: Set<string>) {
  const start = release.collectionStart
  if (!Number.isFinite(start) || (start as number) < NATIVE_V2_MIN_START) return false
  return keys.has(`${release.iso3}|${release.roundValue}`)
}

/** One statistics request plus one rollup request, exactly as the application probes. */
async function probeThemes(release: SurveyRelease, themes: ThemeDefinition[], signal?: AbortSignal) {
  const counts = [...new Set(themes.flatMap((theme) => theme.microdataCounts))]
  const sums = [...new Set(themes.flatMap((theme) => theme.microdataSums))]
  const options = [...new Set(themes.flatMap((theme) => theme.histogramOptions))]
  const where = `adm0_iso3 = '${release.iso3}' AND round = ${Number(release.roundValue)}`

  const [microdata, histogram] = await Promise.all([
    queryLayer(V2_MICRODATA_QUERY, new URLSearchParams({
      f: 'json',
      where,
      returnGeometry: 'false',
      outStatistics: JSON.stringify([
        ...counts.map((field, index) => ({
          statisticType: 'count', onStatisticField: field, outStatisticFieldName: `c_${index}`,
        })),
        ...sums.map((field, index) => ({
          statisticType: 'sum', onStatisticField: field, outStatisticFieldName: `s_${index}`,
        })),
      ]),
    }), signal),
    queryLayer(V2_HISTOGRAM_QUERY, new URLSearchParams({
      f: 'json',
      where: `${where} AND hh_agricactivity = -1 AND adm_level = 0`,
      returnGeometry: 'false',
      outFields: options.join(','),
      resultRecordCount: '2',
    }), signal),
  ])

  const statistics = microdata.features?.[0]?.attributes || {}
  // More than one row means the selection is not a single admin-0 rollup, so
  // the option shares cannot be read; the application ignores them too.
  const rollup = histogram.features?.length === 1 ? histogram.features[0].attributes || {} : {}
  const statistic = (prefix: string, list: string[], field: string) =>
    Number(statistics[`${prefix}_${list.indexOf(field)}`] || 0)

  return themes.filter((theme) => (
    theme.microdataCounts.some((field) => statistic('c', counts, field) > 0)
    || theme.microdataSums.some((field) => statistic('s', sums, field) > 0)
    || theme.histogramOptions.reduce((total, field) => total + Number(rollup[field] || 0), 0) > 0
  ))
}

/**
 * Thematic areas the Monitoring application can actually open for this survey,
 * in the application's own registry order. An empty result means the survey has
 * no thematic area to deep link into.
 */
export async function fetchSurveyThemes(
  release: SurveyRelease,
  signal?: AbortSignal,
): Promise<ThemeOption[]> {
  const keys = await loadNativeV2Keys()
  const available = isNativeV2(release, keys)
    ? await probeThemes(release, THEME_DEFINITIONS, signal)
    : THEME_DEFINITIONS.filter((theme) => release.legacyThemes.includes(theme.id))

  return available.map(({ id, label }) => ({ id, label }))
}
