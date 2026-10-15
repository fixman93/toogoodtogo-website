import type { GeoPoint } from '@/api/types'

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
