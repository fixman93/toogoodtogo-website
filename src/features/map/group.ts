import type { GeoPoint, Offer } from '@/api/types'

export interface MapLocation {
  businessId: string
  name: string
  location: GeoPoint
  offers: Offer[]
}

/** Group offers by their business so each location gets one pin. */
export function groupByLocation(offers: Offer[]): MapLocation[] {
  const map = new Map<string, MapLocation>()
  for (const offer of offers) {
    const entry = map.get(offer.businessId) ?? { businessId: offer.businessId, name: offer.business.name, location: offer.business.location, offers: [] }
    entry.offers.push(offer)
    map.set(offer.businessId, entry)
  }
  return [...map.values()]
}
