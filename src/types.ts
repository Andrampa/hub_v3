export interface ArcGISGroup {
  id: string
  title: string
  snippet?: string
  owner: string
  access: string
  created: number
  modified: number
}

export interface ArcGISItem {
  id: string
  title: string
  type: string
  owner: string
  created: number
  modified: number
  tags?: string[]
  typeKeywords?: string[]
  snippet?: string
  description?: string
  thumbnail?: string
  url?: string
  access: string
  licenseInfo?: string
  groupCategories?: string[]
}

export interface CatalogData {
  group: ArcGISGroup
  items: ArcGISItem[]
  fetchedAt: Date
}

export type SortOption = 'newest' | 'oldest' | 'title'
