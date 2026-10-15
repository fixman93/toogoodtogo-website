import { lazy, Suspense, useMemo, useState } from 'react'
import { Loader2, MapPinned, X } from 'lucide-react'
import type { GeoPoint, Offer, OfferQuery } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { OfferCard } from '@/components/offers/OfferCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocation } from '@/features/location/location-context'
import { useOffers } from '@/hooks/api'
import { t } from '@/i18n'
import { distanceMeters } from '@/lib/geo'
import { groupByLocation } from './group'

const OffersMap = lazy(() => import('./OffersMap'))

/** API returns at most 100 offers per request — plenty for one map viewport. */
const MAP_LIMIT = 100
const MAX_RADIUS_KM = 50
/** Load a bit beyond the screen so nearby pins are already there when panning. */
const PREFETCH_FACTOR = 1.5
const MIN_RADIUS_KM = 3

/**
 * Map mode of the Browse page. Loads offers around the visible map area,
 * while distances on the cards are always measured from the user.
 */
export function MapView({ filters }: { filters: Omit<OfferQuery, 'lat' | 'lng' | 'sort' | 'limit' | 'maxDistanceKm'> }) {
  const { location } = useLocation()
  const user: GeoPoint = { lat: location.lat, lng: location.lng }
  const [viewport, setViewport] = useState<{ center: GeoPoint; radiusKm: number }>({ center: user, radiusKm: 5 })
  const [selectedId, setSelectedId] = useState<string>()

  const { data, isLoading, isError, isFetching, refetch } = useOffers({
    ...filters,
    lat: round(viewport.center.lat),
    lng: round(viewport.center.lng),
    maxDistanceKm: Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, Math.ceil(viewport.radiusKm * PREFETCH_FACTOR))),
    sort: 'distance',
    limit: MAP_LIMIT,
  })

  // Distance from the user (not from the map center) for every card.
  const offers: Offer[] = useMemo(
    () =>
      (data?.data ?? [])
        .map((o) => ({ ...o, distanceMeters: Math.round(distanceMeters(user, o.business.location)) }))
        .sort((a, b) => Number(a.quantityAvailable === 0) - Number(b.quantityAvailable === 0) || a.distanceMeters - b.distanceMeters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, user.lat, user.lng],
  )
  const locations = useMemo(() => groupByLocation(offers), [offers])
  const selected = locations.find((l) => l.businessId === selectedId)
  const shown = selected ? selected.offers : offers.slice(0, 12)

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
            // Re-center whenever the user's location changes (e.g. "Najbliže meni").
            flyTo={{ target: user, version: `${user.lat},${user.lng}` }}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onViewportChange={(center, radiusKm) => setViewport({ center, radiusKm })}
          />
        </Suspense>
        {isFetching && (
          <span className="pointer-events-none absolute top-3 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-card/95 px-3 py-1.5 text-xs font-semibold shadow">
            <Loader2 className="size-3.5 animate-spin" />
            {t('common.loading')}
          </span>
        )}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-lg font-bold">{selected ? selected.name : t('map.nearest')}</h2>
          {selected && (
            <Button size="sm" variant="ghost" onClick={() => setSelectedId(undefined)}>
              <X />
              {t('map.closeSelection')}
            </Button>
          )}
        </div>
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <Skeleton className="h-60 rounded-2xl" />
        ) : shown.length === 0 ? (
          <EmptyState icon={MapPinned} title={t('map.empty')} className="py-8" />
        ) : (
          <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {shown.map((offer) => (
              <OfferCard key={offer.id} offer={offer} className="w-[80vw] max-w-80 shrink-0 snap-start" />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/** Rounding keeps tiny pans from producing new query keys. */
const round = (n: number) => Math.round(n * 1000) / 1000
