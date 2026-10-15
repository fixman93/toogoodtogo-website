import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MapPinned, X } from 'lucide-react'
import type { BoundingBox, GeoPoint, OfferFilters } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { OfferCard } from '@/components/offers/OfferCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocation } from '@/features/location/location-context'
import { useOfferLocations, useOffers } from '@/hooks/api'
import { t } from '@/i18n'

const OffersMap = lazy(() => import('./OffersMap'))

const NEAREST_LIMIT = 12

/** Rounding keeps tiny pans from producing new query keys. */
const round = (n: number) => Math.round(n * 1000) / 1000
const roundBox = (b: BoundingBox): BoundingBox => ({ minLat: round(b.minLat), maxLat: round(b.maxLat), minLng: round(b.minLng), maxLng: round(b.maxLng) })

/**
 * Map mode of the Browse page.
 * - Starts from the device's current location (asks for GPS on open).
 * - Pins: every location with live offers in the visible area, at any zoom.
 * - Below the map: offers nearest to the user, or the tapped location's offers.
 */
export function MapView({ filters }: { filters: OfferFilters }) {
  const { location, locateDevice } = useLocation()
  const user: GeoPoint = { lat: location.lat, lng: location.lng }
  const [bbox, setBbox] = useState<BoundingBox | null>(null)
  const [selectedId, setSelectedId] = useState<string>()

  // Current location is the primary starting point: ask for it once when the
  // map opens, unless the user has already blocked location access.
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    const permissions = navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    void (permissions ?? Promise.resolve({ state: 'prompt' } as PermissionStatus))
      .then((status) => status.state !== 'denied' && locateDevice())
      .catch(() => locateDevice())
  }, [locateDevice])

  const pins = useOfferLocations(bbox && { ...filters, ...bbox })
  const nearest = useOffers({ ...filters, lat: user.lat, lng: user.lng, sort: 'distance', limit: NEAREST_LIMIT })
  const selected = useOffers({ ...filters, businessId: selectedId, lat: user.lat, lng: user.lng, sort: 'pickup', limit: 30 }, { enabled: !!selectedId })

  const locations = useMemo(() => pins.data ?? [], [pins.data])
  const selectedLocation = locations.find((l) => l.businessId === selectedId)
  const list = selectedId ? selected : nearest

  return (
    <div className="space-y-4">
      <div className="relative isolate h-[46dvh] min-h-72 overflow-hidden rounded-3xl border bg-muted lg:h-[65vh]">
        <Suspense
          fallback={
            <div className="flex size-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              {t('map.loading')}
            </div>
          }
        >
          <OffersMap
            locations={locations}
            initialCenter={user}
            user={location.source === 'gps' ? user : null}
            // Re-center whenever the user's location changes (GPS fix, city pick).
            flyTo={{ target: user, version: `${user.lat},${user.lng}` }}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onViewportChange={(b) => setBbox(roundBox(b))}
          />
        </Suspense>
        {pins.isFetching && (
          <span className="pointer-events-none absolute top-3 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-card/95 px-3 py-1.5 text-xs font-semibold shadow">
            <Loader2 className="size-3.5 animate-spin" />
            {t('common.loading')}
          </span>
        )}
        {pins.isSuccess && !pins.isFetching && locations.length === 0 && (
          <span className="pointer-events-none absolute inset-x-6 bottom-6 z-[1000] rounded-2xl bg-card/95 px-4 py-3 text-center text-sm font-medium shadow">
            {t('map.empty')}
          </span>
        )}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-lg font-bold">{selectedId ? (selectedLocation?.name ?? '…') : t('map.nearest')}</h2>
          {selectedId && (
            <Button size="sm" variant="ghost" onClick={() => setSelectedId(undefined)}>
              <X />
              {t('map.closeSelection')}
            </Button>
          )}
        </div>
        {list.isError ? (
          <ErrorState onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <Skeleton className="h-60 rounded-2xl" />
        ) : !list.data?.data.length ? (
          <EmptyState icon={MapPinned} title={t('browse.emptyTitle')} className="py-8" />
        ) : (
          <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {list.data.data.map((offer) => (
              <OfferCard key={offer.id} offer={offer} className="w-[80vw] max-w-80 shrink-0 snap-start" />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
