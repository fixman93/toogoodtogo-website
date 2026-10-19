import { useState } from 'react'
import { CheckCircle2, Loader2, LocateFixed, Search, Store, Truck } from 'lucide-react'
import type { BusinessSummary, DeliverySettings, GeoPoint } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { t } from '@/i18n'
import { formatDistance, formatMoney } from '@/lib/format'
import { distanceMeters } from '@/lib/geo'
import { reverseGeocode, searchPlace } from '@/lib/route'
import { cn } from '@/lib/utils'
import { deliveryFee, savedTarget, type DeliveryTarget } from './delivery'

const devicePosition = () =>
  new Promise<GeoPoint>((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('unsupported'))
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), reject, { enableHighAccuracy: true, timeout: 15_000 })
  })

/**
 * "Preuzimanje u lokalu" or "Dostava" (when the location delivers), and for
 * delivery: the address (typed or from GPS), checked against the zone.
 */
export function FulfillmentPicker({
  business,
  delivery,
  currency,
  subtotalMinor,
  mode,
  onModeChange,
  target,
  onTargetChange,
}: {
  business: BusinessSummary
  delivery: DeliverySettings
  currency: string
  subtotalMinor: number
  mode: 'pickup' | 'delivery'
  onModeChange: (mode: 'pickup' | 'delivery') => void
  /** A found address inside the zone, or null. */
  target: DeliveryTarget | null
  onTargetChange: (target: DeliveryTarget | null) => void
}) {
  const [query, setQuery] = useState(() => target?.address ?? savedTarget()?.address ?? '')
  const [note, setNote] = useState(() => target?.note ?? savedTarget()?.note ?? '')
  const [found, setFound] = useState<{ address: string; point: GeoPoint } | null>(() => target ?? savedTarget())
  const [pending, setPending] = useState<'search' | 'gps' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fee = deliveryFee(delivery, subtotalMinor)
  const meters = found ? distanceMeters(business.location, found.point) : null
  const inZone = meters != null && meters <= delivery.radiusKm * 1000

  // Report a usable target upward whenever address/note/zone change.
  const publish = (next: { address: string; point: GeoPoint } | null, nextNote = note) => {
    setFound(next)
    const ok = next && distanceMeters(business.location, next.point) <= delivery.radiusKm * 1000
    onTargetChange(ok ? { address: next.address, point: next.point, note: nextNote.trim() } : null)
  }

  const search = async () => {
    setPending('search')
    setError(null)
    try {
      const point = await searchPlace(query.trim(), business.address.countryCode, business.location)
      if (!point) setError(t('route.addressNotFound'))
      publish(point ? { address: query.trim(), point } : null)
    } catch {
      setError(t('route.addressNotFound'))
    } finally {
      setPending(null)
    }
  }

  const useGps = async () => {
    setPending('gps')
    setError(null)
    try {
      const point = await devicePosition()
      const address = (await reverseGeocode(point).catch(() => null)) ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
      setQuery(address)
      publish({ address, point })
    } catch {
      setError(t('location.denied'))
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="radiogroup" aria-label={t('delivery.how')}>
        {(['pickup', 'delivery'] as const).map((value) => {
          const Icon = value === 'pickup' ? Store : Truck
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => {
                onModeChange(value)
                // A remembered address counts right away.
                if (value === 'delivery' && found) publish(found)
              }}
              className={cn('flex min-h-12 flex-col items-center justify-center rounded-xl px-2 py-1.5 text-sm font-semibold', mode === value ? 'bg-background shadow' : 'text-muted-foreground')}
            >
              <span className="flex items-center gap-1.5">
                <Icon className="size-4" />
                {value === 'pickup' ? t('delivery.pickup') : t('delivery.delivery')}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {value === 'pickup' ? t('delivery.free') : fee === 0 ? t('delivery.free') : `+ ${formatMoney(fee, currency)}`}
              </span>
            </button>
          )
        })}
      </div>

      {mode === 'delivery' && (
        <div className="space-y-2 text-left">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                // A changed address must be found again.
                if (found) publish(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim().length >= 3) {
                  e.preventDefault()
                  void search()
                }
              }}
              placeholder={t('delivery.addressPlaceholder')}
              aria-label={t('delivery.address')}
              autoComplete="street-address"
              className="h-11"
            />
            <Button type="button" variant="secondary" className="h-11" disabled={!!pending || query.trim().length < 3} onClick={search} aria-label={t('delivery.find')}>
              {pending === 'search' ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
          </div>
          <Button type="button" variant="outline" size="sm" className="w-full" disabled={!!pending} onClick={useGps}>
            {pending === 'gps' ? <Loader2 className="animate-spin" /> : <LocateFixed />}
            {t('delivery.useMyLocation')}
          </Button>
          {found && meters != null && (
            <p className={cn('flex items-start gap-1.5 text-xs font-semibold', inZone ? 'text-success' : 'text-destructive')} role={inZone ? undefined : 'alert'}>
              {inZone && <CheckCircle2 className="size-4 shrink-0" />}
              {inZone
                ? t('delivery.inZone', { distance: formatDistance(meters) ?? '' })
                : t('delivery.outOfZone', { distance: formatDistance(meters) ?? '', radius: String(delivery.radiusKm).replace('.', ',') })}
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs font-semibold text-destructive">
              {error}
            </p>
          )}
          <Input
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              if (found && inZone) onTargetChange({ address: found.address, point: found.point, note: e.target.value.trim() })
            }}
            maxLength={300}
            placeholder={t('delivery.notePlaceholder')}
            aria-label={t('delivery.note')}
            className="h-11"
          />
        </div>
      )}
    </div>
  )
}
