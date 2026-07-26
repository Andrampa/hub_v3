/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COUNTRY_EDITORIAL_SERVICE_URL?: string
  readonly VITE_HUB_PROMOTIONS_CHANNEL?: 'prod' | 'stg'
  readonly VITE_HUB_PROMOTIONS_SERVICE_URL?: string
  readonly VITE_HUB_PROMOTIONS_VIEW_ITEM_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
