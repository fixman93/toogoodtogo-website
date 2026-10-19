import { Suspense, useEffect, useRef, useState } from 'react'
import { Bike, CheckCircle2, ChefHat, Clock, DoorOpen } from 'lucide-react'
import { DeliveryChat } from './DeliveryChat'
import type { Reservation } from '@/api/types'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { t } from '@/i18n'
import { lazyWithReload } from '@/lib/chunks'
import { formatPickupWindow } from '@/lib/format'
import { fetchRoute, formatDuration, type Route } from '@/lib/route'
import { cn } from '@/lib/utils'

const TrackingMap = lazyWithReload(() => import('./TrackingMap'))

/** Re-route at most this often (each one is a Directions API call). */
const ROUTE_EVERY_MS = 30_000
/** A position older than this is shown as "last seen …". */
const STALE_MS = 2 * 60_000

const STEPS = [
  { stage: 'preparing', icon: ChefHat },
  { stage: 'on_the_way', icon: Bike },
  { stage: 'delivered', icon: CheckCircle2 },
] as const

/**
 * Customer's view of a delivery: progress, the courier on a live map (the
 * reservation is polled every few seconds) and the time until arrival.
 */
export function DeliveryTracker({ reservation: r }: { reservation: Reservation }) {
  const d = r.delivery!
  const courier = d.courierLocation ? { lat: d.courierLocation.lat, lng: d.courierLocation.lng } : null
  const [route, setRoute] = useState<Route | null>(null)
  const lastRouted = useRef(0)
  const [now, setNow] = useState(() => Date.now())

  // Time until arrival: route from the courier to the door, refreshed every 30 s while they move.
  useEffect(() => {
    if (!courier || d.stage !== 'on_the_way' || Date.now() - lastRouted.current < ROUTE_EVERY_MS) return
    lastRouted.current = Date.now()
    void fetchRoute(courier, d.location, 'driving')
      .then(setRoute)
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courier?.lat, courier?.lng, d.stage])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])

  const stage = r.status === 'collected' ? 'delivered' : d.stage
  const current = STEPS.findIndex((s) => s.stage === stage)
  const seenAgo = d.courierLocation ? now - new Date(d.courierLocation.at).getTime() : null

  return (
    <Card className="overflow-hidden">
      {stage === 'on_the_way' && d.arrivedAt && (
        <div role="status" className="flex items-center gap-3 bg-accent p-4 text-accent-foreground">
          <DoorOpen className="size-7 shrink-0" />
          <div>
            <p className="font-extrabold">{t('track.arrived')}</p>
            <p className="text-sm">{t('track.arrivedText', { code: r.code })}</p>
          </div>
        </div>
      )}
      <div className="space-y-3 p-5">
        <p className="text-lg font-extrabold">
          {stage === 'delivered'
            ? t('track.delivered')
            : stage === 'on_the_way'
              ? t('track.onTheWay', { name: d.courierName ?? t('track.courier') })
              : t('track.preparing')}
        </p>
        {stage === 'on_the_way' && route && (
          <p className="flex items-center gap-2 text-sm" aria-live="polite">
            <Clock className="size-4 text-primary" />
            {t('track.eta', { time: formatDuration(route.seconds) })}
          </p>
        )}
        {stage === 'preparing' && (
          <p className="text-sm text-muted-foreground">{t('track.preparingText', { window: formatPickupWindow(r.pickupStart, r.pickupEnd, r.timezone) })}</p>
        )}
        <ol className="flex items-center gap-2" aria-label={t('track.progress')}>
          {STEPS.map(({ stage: s, icon: Icon }, i) => (
            <li key={s} className="flex flex-1 flex-col items-center gap-1 text-center">
              <span className={cn('flex h-1.5 w-full rounded-full', i <= current ? 'bg-primary' : 'bg-muted')} />
              <span className={cn('flex items-center gap-1 text-xs font-semibold', i <= current ? 'text-primary' : 'text-muted-foreground')} aria-current={i === current ? 'step' : undefined}>
                <Icon className="size-3.5" />
                {t(`track.step.${s}`)}
              </span>
            </li>
          ))}
        </ol>
        <DeliveryChat reservation={r} side="customer" />
      </div>
      {stage !== 'delivered' && (
        <div className="relative isolate h-72 border-t bg-muted">
          <Suspense fallback={<Skeleton className="absolute inset-0 rounded-none" />}>
            <TrackingMap
              shop={r.business.location}
              shopLabel={r.business.name}
              destination={d.location}
              destinationLabel={d.address}
              courier={stage === 'on_the_way' ? courier : null}
              courierLabel={d.courierName ?? t('track.courier')}
              line={stage === 'on_the_way' ? route?.line : null}
            />
          </Suspense>
          {stage === 'on_the_way' && seenAgo != null && seenAgo > STALE_MS && (
            <p className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-background/95 px-3 py-1.5 text-xs font-semibold shadow">
              {t('track.lastSeen', { minutes: String(Math.round(seenAgo / 60_000)) })}
            </p>
          )}
          {stage === 'on_the_way' && !courier && (
            <p className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-background/95 px-3 py-1.5 text-xs font-semibold shadow">{t('track.waitingGps')}</p>
          )}
        </div>
      )}
    </Card>
  )
}
