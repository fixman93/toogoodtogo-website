import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { reservationsApi } from '@/api/services'
import type { Reservation } from '@/api/types'
import { distanceMeters } from '@/lib/geo'

/** Only positions this close to the shop ever leave the phone. */
const SEND_WITHIN_M = 150
const SEND_EVERY_MS = 20_000
/** Arrival counts this long before/after the pickup window (same as the server). */
const MARGIN_MS = 15 * 60_000

export type ArrivalState = 'off' | 'ask' | 'watching' | 'arrived' | 'denied'

const inWindow = (r: Reservation, now = Date.now()) =>
  now >= new Date(r.pickupStart).getTime() - MARGIN_MS && now <= new Date(r.pickupEnd).getTime() + MARGIN_MS

/**
 * Arrival check: while the reservation is open in the app during the pickup
 * window, the phone tells the server when it is at the shop. If the bag then
 * isn't scanned, the platform gets a warning. Watching starts by itself when
 * location access is already allowed; otherwise the customer taps once.
 */
export function useArrivalCheck(r: Reservation | undefined) {
  const queryClient = useQueryClient()
  const [now, setNow] = useState(() => Date.now())
  const [state, setState] = useState<Exclude<ArrivalState, 'off' | 'arrived'>>('ask')
  const [arrivedHere, setArrivedHere] = useState(false)
  const lastSent = useRef(0)
  const eligible = !!r && r.status === 'confirmed' && !r.delivery && inWindow(r, now) && 'geolocation' in navigator

  // Re-check the window every minute (the page may stay open across the start).
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const start = useCallback(() => setState('watching'), [])

  // Location already allowed (e.g. for the map): start without asking.
  useEffect(() => {
    if (!eligible || state !== 'ask') return
    void navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((p) => p.state === 'granted' && setState('watching'))
      .catch(() => undefined)
  }, [eligible, state])

  useEffect(() => {
    if (!eligible || state !== 'watching' || !r) return
    const shop = r.business.location
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        if (distanceMeters(point, shop) > SEND_WITHIN_M || Date.now() - lastSent.current < SEND_EVERY_MS) return
        lastSent.current = Date.now()
        reservationsApi
          .presence(r.id, { ...point, accuracy: Math.round(pos.coords.accuracy) })
          .then((res) => {
            if (!res.recorded) return
            setArrivedHere(true)
            void queryClient.invalidateQueries({ queryKey: ['reservations', 'detail', r.id] })
          })
          .catch(() => undefined)
      },
      (error) => error.code === error.PERMISSION_DENIED && setState('denied'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    )
    return () => navigator.geolocation.clearWatch(watch)
  }, [eligible, state, r, queryClient])

  const arrived = arrivedHere || !!r?.presence
  return { state: (arrived ? 'arrived' : eligible ? state : 'off') as ArrivalState, start }
}
