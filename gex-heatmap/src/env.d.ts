/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: string
  readonly VITE_OPTIONS_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
