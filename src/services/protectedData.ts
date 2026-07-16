export const DATA_PORTAL = 'https://hqfao.maps.arcgis.com'
export const DATA_REST = 'https://hqfao-hub.maps.arcgis.com/sharing/rest'

export type DataResourceKind =
  | 'microdata'
  | 'aggregate'
  | 'guide'
  | 'reference'
  | 'metadata'

export type ResourceAccess = 'checking' | 'available' | 'restricted' | 'error'

export interface ProtectedDataResource {
  id: string
  fallbackTitle: string
  description: string
  kind: DataResourceKind
  period?: string
  language?: 'English' | 'Français' | 'Español'
  archived?: boolean
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
}

export interface ResolvedDataResource extends ProtectedDataResource {
  access: ResourceAccess
  item?: ProtectedArcGISItem
}

export type ProtectedRequester = <T>(url: string, params?: Record<string, unknown>) => Promise<T>

export const MICRODATA_RESOURCES: ProtectedDataResource[] = [
  {
    id: '2d15e5b7768949b4905e452fcc5e0440',
    fallbackTitle: 'DIEM Household Surveys Microdata',
    description: 'Fully anonymized household survey records using the current questionnaire structure.',
    kind: 'microdata',
    period: '2023–present',
    href: 'https://data-in-emergencies.fao.org/maps/2d15e5b7768949b4905e452fcc5e0440',
  },
  {
    id: 'f1d017ac889f44ceae76d07977eb5bc1',
    fallbackTitle: 'DIEM Household Surveys Microdata — archived',
    description: 'Household survey records collected with the previous questionnaire and data structure.',
    kind: 'microdata',
    period: '2021–2022',
    archived: true,
    href: 'https://data-in-emergencies.fao.org/maps/f1d017ac889f44ceae76d07977eb5bc1',
  },
]

export const AGGREGATE_RESOURCES: ProtectedDataResource[] = [
  {
    id: '499917f1518141209c2a6de55a79d991',
    fallbackTitle: 'Incomes, Shocks and Needs',
    description: 'Aggregated indicators concerning income, shocks, assistance and priority needs.',
    kind: 'aggregate',
    period: 'Current',
    href: 'https://data-in-emergencies.fao.org/maps/499917f1518141209c2a6de55a79d991',
  },
  {
    id: '1b006938d6a344aeb5a309f69f3e344b',
    fallbackTitle: 'Crop Production',
    description: 'Aggregated indicators concerning crop production and agricultural conditions.',
    kind: 'aggregate',
    period: 'Current',
    href: 'https://data-in-emergencies.fao.org/maps/1b006938d6a344aeb5a309f69f3e344b',
  },
  {
    id: '71460258c059453d8eab2d7c56a7b0c5',
    fallbackTitle: 'Livestock Production',
    description: 'Aggregated indicators concerning livestock assets, production and constraints.',
    kind: 'aggregate',
    period: 'Current',
    href: 'https://data-in-emergencies.fao.org/maps/71460258c059453d8eab2d7c56a7b0c5',
  },
  {
    id: 'fbef5b1ef85840838166a6b4d359f9bb',
    fallbackTitle: 'Food Security',
    description: 'Aggregated food-consumption and food-security indicators from DIEM monitoring.',
    kind: 'aggregate',
    period: 'Current',
    href: 'https://data-in-emergencies.fao.org/maps/fbef5b1ef85840838166a6b4d359f9bb',
  },
  {
    id: '6e4f7208540643e68531d15b2e08e8dd',
    fallbackTitle: 'Incomes, Shocks and Needs — archived',
    description: 'Archived aggregated indicators using the 2021–2022 questionnaire structure.',
    kind: 'aggregate',
    period: '2021–2022',
    archived: true,
    href: 'https://data-in-emergencies.fao.org/maps/6e4f7208540643e68531d15b2e08e8dd',
  },
  {
    id: 'ffe31542ff8841dba63e701f09d877e7',
    fallbackTitle: 'Crop Production — archived',
    description: 'Archived aggregated crop-production indicators using the earlier data structure.',
    kind: 'aggregate',
    period: '2021–2022',
    archived: true,
    href: 'https://data-in-emergencies.fao.org/maps/ffe31542ff8841dba63e701f09d877e7',
  },
  {
    id: 'eab64778a6de4936b51a869acf589936',
    fallbackTitle: 'Livestock Production — archived',
    description: 'Archived aggregated livestock indicators using the earlier data structure.',
    kind: 'aggregate',
    period: '2021–2022',
    archived: true,
    href: 'https://data-in-emergencies.fao.org/maps/eab64778a6de4936b51a869acf589936',
  },
  {
    id: '263f1c1964164ebe82382a03b4a4e1ea',
    fallbackTitle: 'Food Security — archived',
    description: 'Archived aggregated food-security indicators using the earlier data structure.',
    kind: 'aggregate',
    period: '2021–2022',
    archived: true,
    href: 'https://data-in-emergencies.fao.org/maps/263f1c1964164ebe82382a03b4a4e1ea',
  },
]

export const GUIDE_RESOURCES: ProtectedDataResource[] = [
  {
    id: '3acfbae8a5204d00aec8735e94875e9b',
    fallbackTitle: 'Guide utilisateur pour l’accès aux données DIEM',
    description: 'Guide d’accès aux données et aux téléchargements DIEM en français.',
    kind: 'guide',
    language: 'Français',
    href: 'https://data-in-emergencies.fao.org/documents/3acfbae8a5204d00aec8735e94875e9b',
  },
  {
    id: 'f24f986b11ea4615a441ff58687a91dc',
    fallbackTitle: 'Guía de usuario para el acceso a datos DIEM',
    description: 'Guía en español para acceder y descargar datos DIEM.',
    kind: 'guide',
    language: 'Español',
    href: 'https://data-in-emergencies.fao.org/documents/f24f986b11ea4615a441ff58687a91dc/about',
  },
]

export const REFERENCE_RESOURCES: ProtectedDataResource[] = [
  {
    id: '3596c3ad318849068eda21517ade30be',
    fallbackTitle: 'Current administrative reference boundaries',
    description: 'Operational ADM1 and ADM2 reference boundaries currently used by DIEM surveys.',
    kind: 'reference',
    period: 'Current',
    href: 'https://data-in-emergencies.fao.org/maps/3596c3ad318849068eda21517ade30be/about',
  },
  {
    id: '9b28ef1ee39842bd96919a05ddc136a7',
    fallbackTitle: 'Archived administrative reference boundaries',
    description: 'Previous boundary configurations retained for historical survey traceability.',
    kind: 'reference',
    period: 'Archive',
    archived: true,
    href: 'https://data-in-emergencies.fao.org/maps/9b28ef1ee39842bd96919a05ddc136a7/about',
  },
]

export const SUPPORTING_RESOURCES: ProtectedDataResource[] = [
  {
    id: '04287fcadb994341b0b70d19c8a02035',
    fallbackTitle: 'Current field descriptions',
    description: 'Variable names, definitions and interpretation guidance for current DIEM data.',
    kind: 'metadata',
    href: 'https://data-in-emergencies.fao.org/documents/04287fcadb994341b0b70d19c8a02035/about',
  },
  {
    id: '41fa55934d2f462f86cd381ee8dc1fda',
    fallbackTitle: 'Current microdata codebook',
    description: 'Official coded values and labels used in the current household microdata.',
    kind: 'metadata',
    href: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/41fa55934d2f462f86cd381ee8dc1fda/data',
  },
  {
    id: '01595314154948719aca7325d88c782a',
    fallbackTitle: 'Aggregated data metadata',
    description: 'Detailed machine-readable metadata for the aggregated thematic datasets.',
    kind: 'metadata',
    href: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/01595314154948719aca7325d88c782a/data',
  },
]

export const ALL_PROTECTED_DATA_RESOURCES = [
  ...MICRODATA_RESOURCES,
  ...AGGREGATE_RESOURCES,
  ...GUIDE_RESOURCES,
  ...REFERENCE_RESOURCES,
  ...SUPPORTING_RESOURCES,
]

function isRestricted(error: unknown) {
  const candidate = error as { code?: string | number; message?: string }
  return String(candidate.code) === '403' || /403|permission|access denied|not authorized/i.test(candidate.message || '')
}

export async function resolveProtectedResource(
  resource: ProtectedDataResource,
  requester: ProtectedRequester,
): Promise<ResolvedDataResource> {
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
  return `${DATA_PORTAL}/home/item.html?id=${resource.id}`
}
