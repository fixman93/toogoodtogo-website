import type { GeoPoint } from '@/api/types'

/** Great-circle distance in meters. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const GOOGLE_MODE = { walking: 'walking', driving: 'driving', cycling: 'bicycling' } as const

/** Google Maps directions to `point` (from the phone's location unless `from` is given). */
export function directionsUrl(point: GeoPoint, from?: GeoPoint | null, mode?: keyof typeof GOOGLE_MODE): string {
  const origin = from ? `&origin=${from.lat},${from.lng}` : ''
  const travel = mode ? `&travelmode=${GOOGLE_MODE[mode]}` : ''
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}${origin}${travel}`
}

export function osmEmbedUrl(point: GeoPoint, delta = 0.006): string {
  const bbox = [point.lng - delta, point.lat - delta / 2, point.lng + delta, point.lat + delta / 2].join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${point.lat},${point.lng}`
}
