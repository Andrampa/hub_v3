/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COUNTRY_EDITORIAL_SERVICE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
