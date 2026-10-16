/**
 * After a new deploy the hashed JS files of the previous version are gone. A
 * tab (or home-screen app) that was open before the deploy then fails to load
 * a lazy chunk ("Failed to fetch dynamically imported module"). The fix is to
 * load the new version: reload once, guarded so a real outage can't loop.
 */
import { lazy, type ComponentType } from 'react'

const RELOAD_KEY = 'zalogaj.chunkReloadAt'
const GUARD_MS = 15_000

export const isChunkLoadError = (error: unknown) =>
  error instanceof Error &&
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(
    `${error.name} ${error.message}`,
  )

/** Reload to the latest version; returns false if we already did so moments ago (then show the error). */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < GUARD_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    /* storage unavailable: still try once */
  }
  window.location.reload()
  return true
}

/** React.lazy that reloads to the new version when its chunk no longer exists. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same constraint as React.lazy
export function lazyWithReload<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch((error: unknown) => {
      if (isChunkLoadError(error) && reloadForNewVersion()) return new Promise<never>(() => {})
      throw error
    }),
  )
}

/** Vite fires this when a preloaded chunk/CSS fails (same cause). */
export function handlePreloadErrors() {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewVersion()) event.preventDefault()
  })
}
