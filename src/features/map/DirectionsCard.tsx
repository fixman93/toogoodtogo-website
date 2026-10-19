import { Suspense, useState, type FormEvent } from 'react'
import { Bike, Car, ExternalLink, Footprints, Loader2, LocateFixed, MapPin, Navigation, Search } from 'lucide-react'
import type { Address, GeoPoint } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocation } from '@/features/location/location-context'
import { t } from '@/i18n'
import { lazyWithReload } from '@/lib/chunks'
import { formatDistance } from '@/lib/format'
import { directionsUrl } from '@/lib/geo'
import { fetchRoute, formatDuration, searchPlace, type Route, type TravelMode } from '@/lib/route'
import { cn } from '@/lib/utils'

const PlaceMap = lazyWithReload(() => import('./PlaceMap'))

const MODES: { mode: TravelMode; icon: typeof Car }[] = [
  { mode: 'walking', icon: Footprints },
  { mode: 'driving', icon: Car },
  { mode: 'cycling', icon: Bike },
]

/** The device's position right now (the app's location may be a chosen city). */
const devicePosition = () =>
  new Promise<GeoPoint>((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('unsupported'))
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), reject, { enableHighAccuracy: true, timeout: 15_000 })
  })

/**
 * Address card with a map of the partner's location and a route to it:
 * from the user's location or any typed address, on foot, by car or by bike.
 */
export function DirectionsCard({ name, address, point }: { name: string; address: Address; point: GeoPoint }) {
  const { location, isDeviceLocation } = useLocation()
  const [from, setFrom] = useState<'me' | 'address'>('me')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<TravelMode>('walking')
  const [start, setStart] = useState<GeoPoint | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const show = async (nextMode = mode, knownStart?: GeoPoint) => {
    setPending(true)
    setError(null)
    try {
      let origin = knownStart
      if (!origin && from === 'me') {
        origin = isDeviceLocation ? { lat: location.lat, lng: location.lng } : await devicePosition().catch(() => undefined)
        if (!origin) throw new Error(t('location.denied'))
      }
      if (!origin) {
        origin = (await searchPlace(query.trim(), address.countryCode, point)) ?? undefined
        if (!origin) throw new Error(t('route.addressNotFound'))
      }
      const found = await fetchRoute(origin, point, nextMode)
      if (!found) throw new Error(t('route.notFound'))
      setStart(origin)
      setRoute(found)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('route.notFound'))
    } finally {
      setPending(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void show()
  }

  const ModeIcon = MODES.find((m) => m.mode === mode)!.icon

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="size-5 text-primary" />
          {t('offer.address')}
        </CardTitle>
        <p className="text-sm">
          {address.street}, {address.city}
        </p>
      </CardHeader>
      <div className="relative isolate h-64 border-y bg-muted">
        <Suspense fallback={<Skeleton className="absolute inset-0 rounded-none" />}>
          <PlaceMap place={point} label={name} start={start} line={route?.line} />
        </Suspense>
      </div>

      <form onSubmit={onSubmit} className="space-y-3 p-4">
        <p className="flex items-center gap-2 font-bold">
          <Navigation className="size-4 text-primary" />
          {t('route.title')}
        </p>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1" role="radiogroup" aria-label={t('route.from')}>
          {(['me', 'address'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={from === value}
              onClick={() => {
                setFrom(value)
                setError(null)
              }}
              className={cn('flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold', from === value ? 'bg-background shadow' : 'text-muted-foreground')}
            >
              {value === 'me' ? <LocateFixed className="size-4" /> : <Search className="size-4" />}
              {value === 'me' ? t('route.fromMe') : t('route.fromAddress')}
            </button>
          ))}
        </div>
        {from === 'address' && (
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('route.addressPlaceholder')} aria-label={t('route.fromAddress')} autoComplete="street-address" />
        )}
        <div className="flex gap-2" role="radiogroup" aria-label={t('route.mode')}>
          {MODES.map(({ mode: m, icon: Icon }) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => {
                setMode(m)
                // A route is already shown: recompute it for the new mode from the same start.
                if (start) void show(m, start)
              }}
              className={cn('flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border text-sm font-semibold', mode === m ? 'border-primary bg-secondary text-primary' : 'bg-card')}
            >
              <Icon className="size-4" />
              {t(`route.${m}`)}
            </button>
          ))}
        </div>
        <Button type="submit" className="w-full" disabled={pending || (from === 'address' && query.trim().length < 3)}>
          {pending ? <Loader2 className="animate-spin" /> : <Navigation />}
          {t('route.show')}
        </Button>

        {route && !error && (
          <p className="flex items-center gap-3 rounded-xl bg-secondary px-3 py-2.5 text-secondary-foreground" aria-live="polite">
            <ModeIcon className="size-5 shrink-0 text-primary" />
            <span className="text-lg font-extrabold">{formatDuration(route.seconds)}</span>
            <span className="text-sm text-muted-foreground">{formatDistance(route.meters)}</span>
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}

        <Button asChild variant="outline" className="w-full">
          <a href={directionsUrl(point, start, route ? mode : undefined)} target="_blank" rel="noreferrer">
            {t('route.openGoogle')}
            <ExternalLink />
          </a>
        </Button>
      </form>
    </Card>
  )
}
