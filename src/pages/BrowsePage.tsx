import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { List, Loader2, LocateFixed, Map as MapIcon, SearchX, Search, SlidersHorizontal } from 'lucide-react'
import { CATEGORIES, type Category, type OfferQuery, type OfferSort, type PickupDay, type TimeOfDay } from '@/api/types'
import { Sheet } from '@/components/common/Sheet'
import { EmptyState, ErrorState, OfferCardSkeleton } from '@/components/common/StateViews'
import { CategoryChips } from '@/components/offers/CategoryChips'
import { OfferCard } from '@/components/offers/OfferCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select'
import { currencyInfo, market } from '@/config/markets'
import { useLocation } from '@/features/location/location-context'
import { MapView } from '@/features/map/MapView'
import { useOffers } from '@/hooks/api'
import { t } from '@/i18n'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 24
const DISTANCES = [1, 3, 5, 10, 25]
// Price filter in the visitor's currency; the API compares it only with offers in that currency.
const PRICE = currencyInfo(market.currency)
const SORTS: OfferSort[] = ['distance', 'price', 'popularity', 'rating', 'pickup']
const FILTER_KEYS = ['maxDistanceKm', 'maxPriceMinor', 'pickupDay', 'timeOfDay'] as const

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T | undefined; label: string }[]
  value: T | undefined
  onChange: (value: T | undefined) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value ?? 'any'}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-10 rounded-full border px-4 text-sm font-semibold transition-colors',
            value === o.value ? 'border-primary bg-secondary text-primary' : 'bg-card hover:bg-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-bold">{label}</legend>
      {children}
    </fieldset>
  )
}

export function BrowsePage() {
  const [params, setParams] = useSearchParams()
  const { location, locateDevice, isLocating, error: locationError } = useLocation()
  const view = params.get('view') === 'map' ? 'map' : 'list'
  const mapFullscreen = view === 'map' && params.get('full') === '1'
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const setParam = (key: string, value: string | number | undefined) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === undefined || value === '') next.delete(key)
        else next.set(key, String(value))
        return next
      },
      { replace: true },
    )
    setLimit(PAGE_SIZE)
  }

  const onSearchChange = (value: string) => {
    setSearch(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setParam('q', value.trim() || undefined), 300)
  }

  const categoryParam = params.get('category') as Category | null
  const query: OfferQuery = {
    q: params.get('q') ?? undefined,
    category: categoryParam && CATEGORIES.includes(categoryParam) ? categoryParam : undefined,
    sort: (params.get('sort') as OfferSort) ?? 'distance',
    maxDistanceKm: params.get('maxDistanceKm') ? Number(params.get('maxDistanceKm')) : undefined,
    maxPriceMinor: params.get('maxPriceMinor') ? Number(params.get('maxPriceMinor')) : undefined,
    currency: params.get('maxPriceMinor') ? market.currency : undefined,
    pickupDay: (params.get('pickupDay') as PickupDay) ?? undefined,
    timeOfDay: (params.get('timeOfDay') as TimeOfDay) ?? undefined,
    lat: location.lat,
    lng: location.lng,
    limit,
  }
  const activeFilterCount = FILTER_KEYS.filter((k) => params.has(k)).length
  const { data, isLoading, isError, refetch, isFetching } = useOffers(query, { enabled: view === 'list' })

  const setMapFullscreen = useCallback((on: boolean) => setParam('full', on ? '1' : undefined), []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Use the device's real position and sort by it. */
  const nearMe = async () => {
    if (await locateDevice()) setParam('sort', 'distance')
  }

  const filters = (
    <div className="space-y-6">
      {view === 'list' && (
        <FilterGroup label={t('browse.distance')}>
          <Segmented
            value={query.maxDistanceKm ? String(query.maxDistanceKm) : undefined}
            onChange={(v) => setParam('maxDistanceKm', v)}
            options={[{ value: undefined, label: t('browse.distanceAny') }, ...DISTANCES.map((d) => ({ value: String(d), label: `${d} km` }))]}
          />
        </FilterGroup>
      )}
      <FilterGroup label={t('browse.maxPrice')}>
        <Segmented
          value={query.maxPriceMinor ? String(query.maxPriceMinor) : undefined}
          onChange={(v) => setParam('maxPriceMinor', v)}
          options={[
            { value: undefined, label: t('browse.priceAny') },
            ...PRICE.priceSteps.map((p) => {
              const minor = p * PRICE.minorUnits
              return { value: String(minor), label: `≤ ${formatMoney(minor)}` }
            }),
          ]}
        />
      </FilterGroup>
      <FilterGroup label={t('browse.pickupDay')}>
        <Segmented<PickupDay>
          value={query.pickupDay}
          onChange={(v) => setParam('pickupDay', v)}
          options={[
            { value: undefined, label: t('browse.anyDay') },
            { value: 'today', label: t('browse.today') },
            { value: 'tomorrow', label: t('browse.tomorrow') },
          ]}
        />
      </FilterGroup>
      <FilterGroup label={t('browse.pickupTime')}>
        <Segmented<TimeOfDay>
          value={query.timeOfDay}
          onChange={(v) => setParam('timeOfDay', v)}
          options={[
            { value: undefined, label: t('browse.anyTime') },
            { value: 'morning', label: t('browse.morning') },
            { value: 'afternoon', label: t('browse.afternoon') },
            { value: 'evening', label: t('browse.evening') },
          ]}
        />
      </FilterGroup>
      {activeFilterCount > 0 && (
        <Button variant="ghost" className="w-full" onClick={() => setParams((prev) => {
          const next = new URLSearchParams(prev)
          FILTER_KEYS.forEach((k) => next.delete(k))
          return next
        })}>
          {t('browse.reset')}
        </Button>
      )}
    </div>
  )

  const total = data?.meta.total ?? 0

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{t('browse.title')}</h1>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('browse.searchPlaceholder')}
            aria-label={t('browse.searchPlaceholder')}
            className="rounded-full pl-12"
          />
        </div>
        <Button variant="outline" className="relative lg:hidden" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal />
          <span className="sr-only sm:not-sr-only">{t('browse.filters')}</span>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      <CategoryChips value={query.category} onChange={(c) => setParam('category', c)} className="mb-4" />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label={t('map.title')} className="inline-flex rounded-full bg-muted p-1">
          {(['list', 'map'] as const).map((id) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={view === id}
              onClick={() => {
                setParams(
                  (prev) => {
                    const next = new URLSearchParams(prev)
                    if (id === 'map') next.set('view', 'map')
                    else next.delete('view')
                    next.delete('full')
                    return next
                  },
                  { replace: true },
                )
              }}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-all',
                view === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
              )}
            >
              {id === 'map' ? <MapIcon className="size-4" /> : <List className="size-4" />}
              {t(id === 'map' ? 'browse.viewMap' : 'browse.viewList')}
            </button>
          ))}
        </div>
        <Button variant={location.source === 'gps' ? 'secondary' : 'outline'} size="sm" className="h-11" onClick={nearMe} disabled={isLocating}>
          {isLocating ? <Loader2 className="animate-spin" /> : <LocateFixed />}
          {t('location.nearMe')}
        </Button>
        {locationError && (
          <p role="alert" className="basis-full text-sm font-medium text-destructive">
            {locationError}
          </p>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border bg-card p-5">{filters}</div>
        </aside>

        {view === 'map' ? (
          <MapView
            fullscreen={mapFullscreen}
            onFullscreenChange={setMapFullscreen}
            filters={{ q: query.q, category: query.category, maxPriceMinor: query.maxPriceMinor, currency: query.currency, pickupDay: query.pickupDay, timeOfDay: query.timeOfDay }}
          />
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
                {!isLoading && t('browse.results', { count: total })}
              </p>
              <label className="flex items-center gap-2 text-sm">
                <span className="hidden font-medium text-muted-foreground sm:inline">{t('browse.sort')}</span>
                <NativeSelect value={query.sort} onChange={(e) => setParam('sort', e.target.value)} className="h-10 w-auto rounded-full">
                  {SORTS.map((s) => (
                    <option key={s} value={s}>
                      {t(`browse.sort.${s}`)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            </div>

            {isError ? (
              <ErrorState onRetry={() => refetch()} />
            ) : isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <OfferCardSkeleton key={i} />
                ))}
              </div>
            ) : total === 0 ? (
              <EmptyState icon={SearchX} title={t('browse.emptyTitle')} text={t('browse.emptyText')} />
            ) : (
              <>
                <div className={cn('grid gap-4 transition-opacity sm:grid-cols-2 2xl:grid-cols-3', isFetching && 'opacity-70')}>
                  {data!.data.map((offer) => (
                    <OfferCard key={offer.id} offer={offer} />
                  ))}
                </div>
                {data!.data.length < total && (
                  <div className="mt-6 flex justify-center">
                    <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)} disabled={isFetching}>
                      {t('discover.seeAll')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('browse.filters')}>
        {filters}
        <Button className="mt-6 w-full" size="lg" onClick={() => setFiltersOpen(false)}>
          {t('browse.results', { count: total })}
        </Button>
      </Sheet>
    </div>
  )
}
