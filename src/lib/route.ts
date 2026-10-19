import type { GeoPoint } from '@/api/types'
import { MAPBOX_TOKEN } from '@/config/maps'

export type TravelMode = 'walking' | 'driving' | 'cycling'

export interface Route {
  meters: number
  seconds: number
  /** [lng, lat] points of the route line. */
  line: [number, number][]
}

/** Without a Mapbox token: OSRM servers of the OpenStreetMap community (free, light use only). */
const OSRM_PROFILE: Record<TravelMode, string> = { walking: 'routed-foot', driving: 'routed-car', cycling: 'routed-bike' }

/** Route from → to (Mapbox Directions, or OSRM without a token); null when none is found. */
export async function fetchRoute(from: GeoPoint, to: GeoPoint, mode: TravelMode): Promise<Route | null> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
  const url = MAPBOX_TOKEN
    ? `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coords}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
    : `https://routing.openstreetmap.de/${OSRM_PROFILE[mode]}/route/v1/driving/${coords}?geometries=geojson&overview=full`
  const res = await fetch(url)
  if (!res.ok) return null
  const body = (await res.json()) as { routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] }
  const route = body.routes?.[0]
  return route ? { meters: route.distance, seconds: route.duration, line: route.geometry.coordinates } : null
}

/** Free-text address → point, preferring results near `near` (Mapbox Geocoding, or Nominatim without a token). */
export async function searchPlace(query: string, countryCode: string, near: GeoPoint): Promise<GeoPoint | null> {
  if (MAPBOX_TOKEN) {
    const params = new URLSearchParams({ access_token: MAPBOX_TOKEN, limit: '1', country: countryCode.toLowerCase(), proximity: `${near.lng},${near.lat}`, language: 'sr' })
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`)
    if (!res.ok) return null
    const [hit] = ((await res.json()) as { features?: { center: [number, number] }[] }).features ?? []
    return hit ? { lng: hit.center[0], lat: hit.center[1] } : null
  }
  const params = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: countryCode.toLowerCase(), q: query })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const [hit] = (await res.json()) as { lat: string; lon: string }[]
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null
}

/** "12 min", "1 h 05 min". */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}

const CYR_TO_LAT: Record<string, string> = Object.fromEntries(
  'а a б b в v г g д d ђ đ е e ж ž з z и i ј j к k л l љ lj м m н n њ nj о o п p р r с s т t ћ ć у u ф f х h ц c ч č џ dž ш š'
    .split(' ')
    .reduce<[string, string][]>((pairs, v, i, all) => (i % 2 ? pairs : [...pairs, [v, all[i + 1]]]), []),
)
/** Mapbox returns Serbian names in Cyrillic; the app writes Latin. */
const toLatin = (text: string) =>
  text.replace(/[\u0400-\u04FF]/g, (c) => {
    const lower = CYR_TO_LAT[c.toLowerCase()]
    if (lower == null) return c
    return c === c.toLowerCase() ? lower : lower[0].toUpperCase() + lower.slice(1)
  })

/** Point → short street address ("Cara Dušana 45, Beograd"); null when unknown. */
export async function reverseGeocode(point: GeoPoint): Promise<string | null> {
  if (MAPBOX_TOKEN) {
    const params = new URLSearchParams({ access_token: MAPBOX_TOKEN, limit: '1', types: 'address', language: 'sr' })
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${point.lng},${point.lat}.json?${params}`)
    if (!res.ok) return null
    const [hit] = ((await res.json()) as { features?: { address?: string; text: string; context?: { id: string; text: string }[] }[] }).features ?? []
    if (!hit) return null
    const city = hit.context?.find((c) => c.id.startsWith('place'))?.text
    return toLatin([[hit.text, hit.address].filter(Boolean).join(' '), city].filter(Boolean).join(', '))
  }
  const params = new URLSearchParams({ format: 'jsonv2', lat: String(point.lat), lon: String(point.lng), zoom: '18', addressdetails: '1' })
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const a = ((await res.json()) as { address?: Record<string, string> }).address
  if (!a) return null
  const city = a.city ?? a.town ?? a.village
  return toLatin([[a.road, a.house_number].filter(Boolean).join(' '), city].filter(Boolean).join(', ')) || null
}
