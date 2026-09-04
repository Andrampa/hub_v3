export const DATA_PORTAL = 'https://hqfao.maps.arcgis.com'
export const DATA_REST = 'https://hqfao-hub.maps.arcgis.com/sharing/rest'

export type DataResourceKind =
  | 'microdata'
  | 'aggregate'
  | 'reference'
  | 'metadata'

export type ResourceAccess = 'checking' | 'available' | 'restricted' | 'error'

/**
 * DIEM questionnaire generations. Definitions are shared with the Monitoring
 * dashboard user guide; changing one without the other makes the two products
 * contradict each other.
 */
export type DataGeneration = 'v1' | 'v2' | 'v3'

export interface GenerationProfile {
  id: DataGeneration
  label: string
  name: string
  period: string
  summary: string
  comparability: string
}

/**
 * The generation shown first, as the standard users should be building on.
 * Moving an older generation out of the archive is a single edit here; the page
 * derives its whole structure from this value.
 */
export const REFERENCE_GENERATION: DataGeneration = 'v3'

export const GENERATIONS: Record<DataGeneration, GenerationProfile> = {
  v3: {
    id: 'v3',
    label: 'V3',
    name: '2026 questionnaire generation',
    period: '2026 onwards',
    summary:
      'The new DIEM standard, produced by the 2026 revision of the household questionnaire. From the third quarter of 2026 every DIEM survey is collected with this questionnaire, so all incoming data flows through V3 only.',
    comparability:
      'V3 restructures fields, domains and derived indicators. Treat comparisons with V2 and V1 as limited unless a variable is explicitly documented as unchanged.',
  },
  v2: {
    id: 'v2',
    label: 'V2',
    name: 'December 2022 questionnaire generation',
    period: 'December 2022 – 2026',
    summary:
      'Surveys collected from December 2022 with the second-generation questionnaire. This is the largest published DIEM series.',
    comparability:
      'V2 changed field names, definitions and codebooks relative to V1. For some variables comparability with V1 is limited or impossible and should be approached with caution.',
  },
  v1: {
    id: 'v1',
    label: 'V1',
    name: 'Original questionnaire generation',
    period: 'Before December 2022',
    summary:
      'Surveys collected before December 2022 with the first DIEM questionnaire, retained so early monitoring rounds stay reproducible.',
    comparability:
      'V1 uses a different data structure, field set and codebook. Combining it with later generations requires the archived field descriptions and careful variable-by-variable checking.',
  },
}

export const ARCHIVE_GENERATIONS = (['v2', 'v1'] as DataGeneration[]).filter(
  (generation) => generation !== REFERENCE_GENERATION,
)

export interface ProtectedDataResource {
  id: string
  version: DataGeneration
  fallbackTitle: string
  description: string
  kind: DataResourceKind
  period?: string
  /** Thematic aggregation layer, used to group aggregated products by theme. */
  thematicLayer?: string
  /** Administrative family the aggregation follows. */
  admFamily?: string
  /**
   * The published service currently carries test records rather than real
   * survey data. The UI must say so wherever the resource is offered.
   */
  preview?: boolean
  /**
   * Documentation held outside the community portal. These are opened as plain
   * links and are never resolved against ArcGIS, so a cross-portal item never
   * shows a false "availability check failed".
   */
  staticLink?: string
  href?: string
}

export interface ProtectedArcGISItem {
  id: string
  title: string
  type: string
  owner: string
  created?: number
  modified: number
  url?: string
  access: string
  snippet?: string
  description?: string
  licenseInfo?: string
  numViews?: number
  size?: number
  thumbnail?: string
}

/**
 * ArcGIS supplies a thumbnail for almost every item, but most DIEM data items
 * carry a portal default or a shared per-country tile rather than anything that
 * describes the dataset. Showing those makes a set of cards look identical and
 * says nothing, so only a distinctive image earns the space.
 */
const GENERIC_THUMBNAILS = /^(thumbnail\/)?(ago_downloaded|thumbnail)\.(png|jpe?g|gif)$/i

export function protectedItemThumbnailUrl(item?: ProtectedArcGISItem) {
  if (!item?.thumbnail || GENERIC_THUMBNAILS.test(item.thumbnail)) return undefined
  return `${DATA_REST}/content/items/${item.id}/info/${item.thumbnail}?w=400`
}

export interface ResolvedDataResource extends ProtectedDataResource {
  access: ResourceAccess
  item?: ProtectedArcGISItem
}

export type ProtectedRequester = <T>(url: string, params?: Record<string, unknown>) => Promise<T>

export const MICRODATA_RESOURCES: ProtectedDataResource[] = [
  {
    id: 'fd3f8386f8dd40abaa6fdbc033580b65',
    version: 'v3',
    fallbackTitle: 'Household microdata — mandatory indicators',
    description: 'Core household-level variables collected in every V3 survey, including the calculated food-security indicators.',
    kind: 'microdata',
    period: '2026 onwards',
    preview: true,
  },
  {
    id: '877fb415ef4e4ef28967fa4b49670ee5',
    version: 'v3',
    fallbackTitle: 'Household microdata — optional indicators',
    description: 'Additional household-level variables asked in selected V3 surveys, joined to the mandatory table on survey and household identifiers.',
    kind: 'microdata',
    period: '2026 onwards',
    preview: true,
  },
  {
    id: '2d15e5b7768949b4905e452fcc5e0440',
    version: 'v2',
    fallbackTitle: 'DIEM Household Surveys Microdata',
    description: 'Fully anonymized household survey records collected with the V2 questionnaire.',
    kind: 'microdata',
    period: '2023–2026',
    href: 'https://data-in-emergencies.fao.org/maps/2d15e5b7768949b4905e452fcc5e0440',
  },
  {
    id: 'f1d017ac889f44ceae76d07977eb5bc1',
    version: 'v1',
    fallbackTitle: 'DIEM Household Surveys Microdata — archived',
    description: 'Household survey records collected with the original questionnaire and data structure.',
    kind: 'microdata',
    period: '2021–2022',
    href: 'https://data-in-emergencies.fao.org/maps/f1d017ac889f44ceae76d07977eb5bc1',
  },
]

export const AGGREGATE_RESOURCES: ProtectedDataResource[] = [
  {
    id: 'f6b197ea47bd4663aa0ccd10b4d4ea9d',
    version: 'v3',
    fallbackTitle: 'Income and shocks',
    description: 'Weighted aggregates covering income change, shocks and their severity.',
    kind: 'aggregate',
    thematicLayer: 'Income and shocks',
    admFamily: 'Survey-representative',
    preview: true,
  },
  {
    id: 'f6f876ca3a4d4108becd17da8247b78e',
    version: 'v3',
    fallbackTitle: 'Crop production',
    description: 'Weighted aggregates covering crop production, constraints and marketing.',
    kind: 'aggregate',
    thematicLayer: 'Crop production',
    admFamily: 'Survey-representative',
    preview: true,
  },
  {
    id: 'a313b15f51d34c2b8cb3516274461ec1',
    version: 'v3',
    fallbackTitle: 'Livestock and fisheries',
    description: 'Weighted aggregates covering livestock and aquatic production and their constraints.',
    kind: 'aggregate',
    thematicLayer: 'Livestock and fisheries',
    admFamily: 'Survey-representative',
    preview: true,
  },
  {
    id: 'a870f5dac1064aab806258e8c3bdd284',
    version: 'v3',
    fallbackTitle: 'Food security and needs',
    description: 'Weighted aggregates covering food-security outcomes, coping and assistance needs.',
    kind: 'aggregate',
    thematicLayer: 'Food security and needs',
    admFamily: 'Survey-representative',
    preview: true,
  },
  {
    id: '4f1fd777958a4495bd2b4a5c024df779',
    version: 'v3',
    fallbackTitle: 'Optional indicators',
    description: 'Weighted aggregates for questions asked only in selected V3 surveys.',
    kind: 'aggregate',
    thematicLayer: 'Optional indicators',
    admFamily: 'Survey-representative',
    preview: true,
  },
  {
    id: '499917f1518141209c2a6de55a79d991',
    version: 'v2',
    fallbackTitle: 'Incomes, Shocks and Needs',
    description: 'Aggregated indicators concerning income, shocks, assistance and priority needs.',
    kind: 'aggregate',
    thematicLayer: 'Incomes, shocks and needs',
    admFamily: 'ADM1 / ADM2',
    href: 'https://data-in-emergencies.fao.org/maps/499917f1518141209c2a6de55a79d991',
  },
  {
    id: '1b006938d6a344aeb5a309f69f3e344b',
    version: 'v2',
    fallbackTitle: 'Crop Production',
    description: 'Aggregated indicators concerning crop production and agricultural conditions.',
    kind: 'aggregate',
    thematicLayer: 'Crop production',
    admFamily: 'ADM1 / ADM2',
    href: 'https://data-in-emergencies.fao.org/maps/1b006938d6a344aeb5a309f69f3e344b',
  },
  {
    id: '71460258c059453d8eab2d7c56a7b0c5',
    version: 'v2',
    fallbackTitle: 'Livestock Production',
    description: 'Aggregated indicators concerning livestock assets, production and constraints.',
    kind: 'aggregate',
    thematicLayer: 'Livestock production',
    admFamily: 'ADM1 / ADM2',
    href: 'https://data-in-emergencies.fao.org/maps/71460258c059453d8eab2d7c56a7b0c5',
  },
  {
    id: 'fbef5b1ef85840838166a6b4d359f9bb',
    version: 'v2',
    fallbackTitle: 'Food Security',
    description: 'Aggregated food-consumption and food-security indicators from DIEM monitoring.',
    kind: 'aggregate',
    thematicLayer: 'Food security',
    admFamily: 'ADM1 / ADM2',
    href: 'https://data-in-emergencies.fao.org/maps/fbef5b1ef85840838166a6b4d359f9bb',
  },
  {
    id: '6e4f7208540643e68531d15b2e08e8dd',
    version: 'v1',
    fallbackTitle: 'Incomes, Shocks and Needs — archived',
    description: 'Archived aggregated indicators using the original questionnaire structure.',
    kind: 'aggregate',
    thematicLayer: 'Incomes, shocks and needs',
    admFamily: 'ADM1 / ADM2',
    href: 'https://data-in-emergencies.fao.org/maps/6e4f7208540643e68531d15b2e08e8dd',
  },
  {
    id: 'ffe31542ff8841dba63e701f09d877e7',
    version: 'v1',
    fallbackTitle: 'Crop Production — archived',
    description: 'Archived aggregated crop-production indicators using the earlier data structure.',
    kind: 'aggregate',
    thematicLayer: 'Crop production',
    admFamily: 'ADM1 / ADM2',
    href: 'https://data-in-emergencies.fao.org/maps/ffe31542ff8841dba63e701f09d877e7',
  },
  {
    id: 'eab64778a6de4936b51a869acf589936',
    version: 'v1',
    fallbackTitle: 'Livestock Production — archived',
    description: 'Archived aggregated livestock indicators using the earlier data structure.',
    kind: 'aggregate',
    thematicLayer: 'Livestock production',
    admFamily: 'ADM1 / ADM2',
    href: 'https://data-in-emergencies.fao.org/maps/eab64778a6de4936b51a869acf589936',
  },
  {
    id: '263f1c1964164ebe82382a03b4a4e1ea',
    version: 'v1',
    fallbackTitle: 'Food Security — archived',
    description: 'Archived aggregated food-security indicators using the earlier data structure.',
    kind: 'aggregate',
    thematicLayer: 'Food security',
    admFamily: 'ADM1 / ADM2',
    href: 'https://data-in-emergencies.fao.org/maps/263f1c1964164ebe82382a03b4a4e1ea',
  },
]

export const REFERENCE_RESOURCES: ProtectedDataResource[] = [
  {
    id: '3596c3ad318849068eda21517ade30be',
    version: 'v3',
    fallbackTitle: 'Current administrative reference boundaries',
    description: 'Operational ADM1 and ADM2 reference boundaries currently used by DIEM surveys.',
    kind: 'reference',
    period: 'Current',
    href: 'https://data-in-emergencies.fao.org/maps/3596c3ad318849068eda21517ade30be/about',
  },
  {
    id: '9b28ef1ee39842bd96919a05ddc136a7',
    version: 'v3',
    fallbackTitle: 'Archived administrative reference boundaries',
    description: 'Previous boundary configurations retained for historical survey traceability.',
    kind: 'reference',
    period: 'Archive',
    href: 'https://data-in-emergencies.fao.org/maps/9b28ef1ee39842bd96919a05ddc136a7/about',
  },
]

export const DOCUMENTATION_RESOURCES: ProtectedDataResource[] = [
  {
    id: '04287fcadb994341b0b70d19c8a02035',
    version: 'v2',
    fallbackTitle: 'Field descriptions',
    description: 'Variable names, definitions and interpretation guidance for V2 microdata and aggregated data.',
    kind: 'metadata',
    href: 'https://data-in-emergencies.fao.org/documents/04287fcadb994341b0b70d19c8a02035/about',
  },
  {
    id: '41fa55934d2f462f86cd381ee8dc1fda',
    version: 'v2',
    fallbackTitle: 'Microdata codebook',
    description: 'Official coded values and labels used in the V2 household microdata.',
    kind: 'metadata',
    href: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/41fa55934d2f462f86cd381ee8dc1fda/data',
  },
  {
    id: '01595314154948719aca7325d88c782a',
    version: 'v2',
    fallbackTitle: 'Detailed metadata (SDMX)',
    description: 'SDMX-based metadata describing the V2 aggregated thematic datasets.',
    kind: 'metadata',
    href: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/01595314154948719aca7325d88c782a/data',
  },
  {
    id: '9d0ec676be324584b257315be2fe0d17',
    version: 'v1',
    fallbackTitle: 'Aggregated data field descriptions — archived',
    description: 'Field descriptions for the archived aggregated thematic datasets.',
    kind: 'metadata',
    staticLink: 'https://www.arcgis.com/sharing/rest/content/items/9d0ec676be324584b257315be2fe0d17/data',
  },
  {
    id: 'e256f41d26ae4dc9b5906270a1116d33',
    version: 'v1',
    fallbackTitle: 'Microdata field descriptions — archived',
    description: 'Field descriptions for the archived household microdata.',
    kind: 'metadata',
    staticLink: 'https://www.arcgis.com/sharing/rest/content/items/e256f41d26ae4dc9b5906270a1116d33/data',
  },
  {
    id: 'e59d08ded7c1440587493bf65236cf44',
    version: 'v1',
    fallbackTitle: 'Microdata codebooks — archived',
    description: 'Coded values and labels used in the archived household microdata.',
    kind: 'metadata',
    staticLink: 'https://www.arcgis.com/sharing/rest/content/items/e59d08ded7c1440587493bf65236cf44/data',
  },
]

export const ALL_PROTECTED_DATA_RESOURCES = [
  ...MICRODATA_RESOURCES,
  ...AGGREGATE_RESOURCES,
  ...REFERENCE_RESOURCES,
  ...DOCUMENTATION_RESOURCES,
]

export function resourcesForGeneration<T extends ProtectedDataResource>(
  resources: T[],
  generation: DataGeneration,
) {
  return resources.filter((resource) => resource.version === generation)
}

function isRestricted(error: unknown) {
  const candidate = error as { code?: string | number; message?: string }
  return String(candidate.code) === '403' || /403|permission|access denied|not authorized/i.test(candidate.message || '')
}

export async function resolveProtectedResource(
  resource: ProtectedDataResource,
  requester: ProtectedRequester,
): Promise<ResolvedDataResource> {
  // Documentation held on another portal is a plain download, not a protected
  // item; requesting it here would only manufacture a misleading error state.
  if (resource.staticLink) return { ...resource, access: 'available' }
  try {
    const item = await requester<ProtectedArcGISItem>(`${DATA_REST}/content/items/${resource.id}`)
    return { ...resource, access: 'available', item }
  } catch (error) {
    return { ...resource, access: isRestricted(error) ? 'restricted' : 'error' }
  }
}

export async function fetchProtectedDataWorkspace(requester: ProtectedRequester) {
  return Promise.all(ALL_PROTECTED_DATA_RESOURCES.map((resource) => resolveProtectedResource(resource, requester)))
}

export function authoritativeResourceUrl(resource: ResolvedDataResource) {
  return resource.staticLink || `${DATA_PORTAL}/home/item.html?id=${resource.id}`
}
