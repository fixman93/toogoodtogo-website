import type { DeliverySettings, GeoPoint } from '@/api/types'

export interface DeliveryTarget {
  address: string
  point: GeoPoint
  note: string
}

/** Last delivery address on this device (a convenience; the server checks the zone again). */
const SAVED_KEY = 'foodnesi.deliveryAddress'
export function savedTarget(): DeliveryTarget | null {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) ?? 'null') as DeliveryTarget | null
    return v && typeof v.address === 'string' && typeof v.point?.lat === 'number' ? v : null
  } catch {
    return null
  }
}
export function rememberTarget(target: DeliveryTarget) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(target))
  } catch {
    // Private mode etc. — nothing to remember.
  }
}

/** Fee for this order: free from the threshold (on the bags' total). */
export const deliveryFee = (d: DeliverySettings, subtotalMinor: number) => (d.freeFromMinor != null && subtotalMinor >= d.freeFromMinor ? 0 : d.feeMinor)
