import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { market } from '@/config/markets'
import { t } from '@/i18n'
import { LocationContext, type LocationContextValue, type UserLocation } from './location-context'

const STORAGE_KEY = 'foodnesi.location'

function cityLocation(cityId: string): UserLocation {
  const city = market.cities.find((c) => c.id === cityId) ?? market.cities[0]
  return { lat: city.lat, lng: city.lng, label: city.name, source: city.id }
}

function storedLocation(): UserLocation | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as UserLocation
  } catch {
    /* ignore */
  }
  return null
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [hadStoredLocation] = useState(() => storedLocation() != null)
  const [location, setLocation] = useState<UserLocation>(() => storedLocation() ?? cityLocation(market.defaultCityId))
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const persist = useCallback((next: UserLocation) => {
    setLocation(next)
    setError(null)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const locateDevice = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        // Browsers only expose geolocation on HTTPS (or localhost).
        if (!window.isSecureContext) {
          setError(t('location.insecure'))
          return resolve(false)
        }
        if (!('geolocation' in navigator)) {
          setError(t('location.unavailable'))
          return resolve(false)
        }
        setIsLocating(true)
        setError(null)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            persist({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: t('location.current'), source: 'gps' })
            setIsLocating(false)
            resolve(true)
          },
          (err) => {
            setError(err.code === err.PERMISSION_DENIED ? t('location.denied') : t('location.unavailable'))
            setIsLocating(false)
            resolve(false)
          },
          // Precise fix for "nearest"; reuse a position up to 1 minute old.
          { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
        )
      }),
    [persist],
  )

  // First visit: the device location is the primary choice. Ask once; if it's
  // refused or unavailable, the default city stays selected.
  const triedFirstVisit = useRef(false)
  useEffect(() => {
    if (hadStoredLocation || triedFirstVisit.current || !window.isSecureContext) return
    triedFirstVisit.current = true
    const permissions = navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    void (permissions ?? Promise.resolve({ state: 'prompt' } as PermissionStatus))
      .then((status) => status.state !== 'denied' && locateDevice())
      .catch(() => undefined)
  }, [hadStoredLocation, locateDevice])

  const value = useMemo<LocationContextValue>(() => {
    const isDeviceLocation = location.source === 'gps'
    return {
      location,
      isDeviceLocation,
      setCity: (id) => persist(cityLocation(id)),
      locateDevice,
      isLocating,
      error,
    }
  }, [location, persist, locateDevice, isLocating, error])

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}
