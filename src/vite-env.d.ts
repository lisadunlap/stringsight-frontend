/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND?: string
  readonly VITE_DEMO?: string
  readonly VITE_DATASETS_URL?: string
  // add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
