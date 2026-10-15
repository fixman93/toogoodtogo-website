import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { market } from '@/config/markets'
import { t } from '@/i18n'
import { LocationContext, type LocationContextValue, type UserLocation } from './location-context'

const STORAGE_KEY = 'zalogaj.location'

function cityLocation(cityId: string): UserLocation {
  const city = market.cities.find((c) => c.id === cityId) ?? market.cities[0]
  return { lat: city.lat, lng: city.lng, label: city.name, source: city.id }
}

function initialLocation(): UserLocation {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as UserLocation
  } catch {
    /* ignore */
  }
  return cityLocation(market.defaultCityId)
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<UserLocation>(initialLocation)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const persist = useCallback((next: UserLocation) => {
    setLocation(next)
    setError(null)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const locateDevice = useCallback(
    () =>
      new Promise<void>((resolve) => {
        if (!('geolocation' in navigator)) {
          setError(t('location.denied'))
          return resolve()
        }
        setIsLocating(true)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            persist({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: t('location.current'), source: 'gps' })
            setIsLocating(false)
            resolve()
          },
          () => {
            setError(t('location.denied'))
            setIsLocating(false)
            resolve()
          },
          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
        )
      }),
    [persist],
  )

  const value = useMemo<LocationContextValue>(
    () => ({ location, setCity: (id) => persist(cityLocation(id)), locateDevice, isLocating, error }),
    [location, persist, locateDevice, isLocating, error],
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}
