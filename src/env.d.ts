/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the REST API. Defaults to "/api" (proxied by Vite in dev). */
  readonly VITE_API_URL?: string
  /** Market code from src/config/markets.ts, e.g. "RS". */
  readonly VITE_MARKET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
