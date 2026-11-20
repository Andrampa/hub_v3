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
  /**
   * Set only on a resource built from a photo-gallery catalogue row: the row's
   * `gallery_id`. Such a resource is not an ArcGIS item; it links to
   * `/photo-galleries?gallery=<id>` and shows the Flickr cover.
   */
  galleryId?: string
  galleryThumbnailUrl?: string
  /** Field date of a gallery resource (when the photographs were taken), epoch ms. */
  galleryDate?: number
  /** First Hub publication of a gallery resource, epoch ms; absent when unknown. */
  galleryPublishedOn?: number
}

export interface CatalogData {
  group: ArcGISGroup
  items: ArcGISItem[]
  fetchedAt: Date
}

export type SortOption = 'newest' | 'oldest' | 'title'
