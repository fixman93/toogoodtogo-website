/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the REST API. Defaults to "/api" (proxied by Vite in dev). */
  readonly VITE_API_URL?: string
  /** "mock" serves bundled demo data; "http" calls the real backend. */
  readonly VITE_API_MODE?: 'mock' | 'http'
  /** Market code from src/config/markets.ts, e.g. "RS". */
  readonly VITE_MARKET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
