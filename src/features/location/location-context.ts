import { createContext, useContext } from 'react'
import type { GeoPoint } from '@/api/types'

export interface UserLocation extends GeoPoint {
  label: string
  /** City id from market config, or "gps" for device location. */
  source: string
}

export interface LocationContextValue {
  location: UserLocation
  setCity: (cityId: string) => void
  locateDevice: () => Promise<void>
  isLocating: boolean
  error: string | null
}

export const LocationContext = createContext<LocationContextValue | null>(null)

export function useLocation() {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocation must be used inside <LocationProvider>')
  return ctx
}
