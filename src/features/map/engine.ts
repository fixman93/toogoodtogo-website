/**
 * Map engine shared by every map in the app. Two engines with the same API:
 * - Mapbox GL (like Wolt) when VITE_MAPBOX_TOKEN is set — Mapbox styles/tiles,
 *   free up to 50k map loads a month, then paid;
 * - otherwise MapLibre GL with free OpenFreeMap tiles (no key, no limits).
 * Both libraries are big, so they are loaded on first use.
 */
import type { ExpressionSpecification, Map as MlMap } from 'maplibre-gl'
// MapLibre draws tiles in a Web Worker; let Vite bundle it and tell MapLibre where it is
// (its own guess points to the wrong place once bundled). Only a URL — loaded if MapLibre is used.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { script } from '@/i18n'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
/** Mapbox style (e.g. streets-v12, light-v11, or your own from Mapbox Studio). */
const MAPBOX_STYLE = (import.meta.env.VITE_MAPBOX_STYLE as string | undefined) || 'mapbox://styles/mapbox/streets-v12'
/** OpenFreeMap styles: liberty (colourful), positron (light grey), bright. */
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

export type Gl = Pick<typeof import('maplibre-gl'), 'Map' | 'Marker' | 'NavigationControl' | 'LngLatBounds'>
export type Engine = { gl: Gl; style: string; kind: 'mapbox' | 'maplibre' }

let engine: Promise<Engine> | null = null
export function loadEngine(): Promise<Engine> {
  engine ??= (async () => {
    if (MAPBOX_TOKEN) {
      const [{ default: mapboxgl }] = await Promise.all([import('mapbox-gl'), import('mapbox-gl/dist/mapbox-gl.css')])
      mapboxgl.accessToken = MAPBOX_TOKEN
      return { gl: mapboxgl as unknown as Gl, style: MAPBOX_STYLE, kind: 'mapbox' }
    }
    const [maplibre] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
    maplibre.setWorkerUrl(workerUrl)
    return { gl: maplibre, style: OPENFREEMAP_STYLE, kind: 'maplibre' }
  })()
  return engine
}

/** Place names in the app's script: Latin by default, Cyrillic when chosen (falls back to the local name). */
export function localizeLabels(map: MlMap, kind: Engine['kind']) {
  // OpenMapTiles (OpenFreeMap) uses "name:xx", Mapbox Streets uses "name_xx".
  const f = (lang: string) => ['get', kind === 'mapbox' ? `name_${lang}` : `name:${lang}`]
  const name = (
    script === 'cyrl'
      ? ['coalesce', f('sr'), ...(kind === 'maplibre' ? [['get', 'name:nonlatin']] : []), ['get', 'name']]
      : ['coalesce', f('sr-Latn'), ...(kind === 'maplibre' ? [['get', 'name:latin']] : []), ['get', 'name']]
  ) as unknown as ExpressionSpecification
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue
    const field = map.getLayoutProperty(layer.id, 'text-field')
    // Only layers that show a name (not house numbers, road shields, …).
    if (field && JSON.stringify(field).includes('name')) map.setLayoutProperty(layer.id, 'text-field', name)
  }
}

/** Keep the attribution as the small (i) button; it opens on tap. */
export function collapseAttribution(container: HTMLElement) {
  container.querySelector('.maplibregl-compact-show, .mapboxgl-compact-show')?.classList.remove('maplibregl-compact-show', 'mapboxgl-compact-show')
}
