import { createContext, useContext } from 'react'
import type { GeoPoint } from '@/api/types'

export interface UserLocation extends GeoPoint {
  label: string
  /** City id from market config, or "gps" for device location. */
  source: string
}

export interface LocationContextValue {
  location: UserLocation
  /** True when location is the device position (GPS), false for a chosen city. */
  isDeviceLocation: boolean
  setCity: (cityId: string) => void
  /** Asks the device for its real position; resolves true on success. */
  locateDevice: () => Promise<boolean>
  isLocating: boolean
  error: string | null
}

export const LocationContext = createContext<LocationContextValue | null>(null)

export function useLocation() {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocation must be used inside <LocationProvider>')
  return ctx
}
