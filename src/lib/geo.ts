import type { GeoPoint } from '@/api/types'
import { market } from '@/config/markets'

/** Great-circle distance in meters. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function directionsUrl(point: GeoPoint): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`
}

export function osmEmbedUrl(point: GeoPoint, delta = 0.006): string {
  const bbox = [point.lng - delta, point.lat - delta / 2, point.lng + delta, point.lat + delta / 2].join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${point.lat},${point.lng}`
}

/** True when the point lies inside the active market's country bounds. */
export function isInMarket(point: GeoPoint): boolean {
  const b = market.bounds
  return point.lat >= b.minLat && point.lat <= b.maxLat && point.lng >= b.minLng && point.lng <= b.maxLng
}
