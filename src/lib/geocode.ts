import type { GeoPoint } from '@/api/types'
import { toLatin } from './route'

/**
 * Address → coordinates via OpenStreetMap Nominatim (free, no key; fine for
 * occasional partner edits — do not call it in loops, max ~1 request/second).
 */
export async function geocodeAddress(
  address: { street: string; city: string; postalCode?: string },
  countryCode: string,
): Promise<GeoPoint | null> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: countryCode.toLowerCase(),
    street: address.street,
    city: address.city,
    ...(address.postalCode ? { postalcode: address.postalCode } : {}),
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const [hit] = (await res.json()) as { lat: string; lon: string }[]
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null
}

export interface FoundAddress {
  /** "Cara Dušana 45" (without the number when the map has none there). */
  street?: string
  city?: string
  postalCode?: string
  /** ISO code, upper case ("RS"). */
  countryCode?: string
}

/** Coordinates → address parts for the location form (Nominatim, same limits as above). */
export async function reverseGeocodeAddress(point: GeoPoint): Promise<FoundAddress | null> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(point.lat),
    lon: String(point.lng),
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'sr-Latn,sr,hr,bs,en',
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const a = ((await res.json()) as { address?: Record<string, string> }).address
  if (!a) return null
  const road = a.road ?? a.pedestrian ?? a.square ?? a.footway
  const city = a.city ?? a.town ?? a.village ?? a.municipality
  return {
    street: road ? toLatin([road, a.house_number].filter(Boolean).join(' ')) : undefined,
    city: city ? toLatin(city) : undefined,
    postalCode: a.postcode,
    countryCode: a.country_code?.toUpperCase(),
  }
}
