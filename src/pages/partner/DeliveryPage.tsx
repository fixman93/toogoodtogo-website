import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, DoorOpen, Bike, CheckCircle2, Clock, ExternalLink, Loader2, MapPin, Navigation, Phone, ScanLine, Truck } from 'lucide-react'
import { ApiError } from '@/api/client'
import { reservationsApi } from '@/api/services'
import type { GeoPoint, Reservation } from '@/api/types'
import { ConfirmDelete } from '@/components/common/ConfirmDelete'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StaffGuard } from '@/features/business/PartnerGuard'
import { useCollectReservation, useCourierArrived, useReservation, useStartDelivery } from '@/hooks/api'
import { DeliveryChat } from '@/features/delivery/DeliveryChat'
import { t } from '@/i18n'
import { lazyWithReload } from '@/lib/chunks'
import { formatMoney, formatPickupWindow } from '@/lib/format'
import { directionsUrl, distanceMeters } from '@/lib/geo'
import { fetchRoute, formatDuration, type Route } from '@/lib/route'

const TrackingMap = lazyWithReload(() => import('@/features/delivery/TrackingMap'))

/** Send the position at most this often, or sooner after moving this far. */
const SEND_EVERY_MS = 5_000
const SEND_AFTER_M = 25
const ROUTE_EVERY_MS = 30_000

type Sharing = 'off' | 'on' | 'denied' | 'taken_over'

/**
 * While delivering: watch the phone's GPS, send it to the server (the
 * customer sees it live), keep the screen on, and route to the address.
 */
function useCourierGps(reservationId: string, active: boolean) {
  const [position, setPosition] = useState<GeoPoint | null>(null)
  const [sharing, setSharing] = useState<Sharing>('off')
  const lastSent = useRef<{ at: number; point: GeoPoint } | null>(null)
  const supported = 'geolocation' in navigator

  useEffect(() => {
    if (!active || !supported) return
    let stopped = false
    // Keep the screen on (the browser stops GPS when the phone locks).
    let wakeLock: { release: () => Promise<void> } | null = null
    const lockScreen = () =>
      (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
        ?.request('screen')
        .then((lock) => {
          wakeLock = lock
        })
        .catch(() => undefined)
    void lockScreen()
    const onVisible = () => document.visibilityState === 'visible' && void lockScreen()
    document.addEventListener('visibilitychange', onVisible)

    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        if (stopped) return
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPosition(point)
        setSharing((s) => (s === 'taken_over' ? s : 'on'))
        const last = lastSent.current
        if (last && Date.now() - last.at < SEND_EVERY_MS && distanceMeters(last.point, point) < SEND_AFTER_M) return
        lastSent.current = { at: Date.now(), point }
        reservationsApi.courierLocation(reservationId, { ...point, heading: pos.coords.heading }).catch((error: unknown) => {
          // Delivered, cancelled or a colleague took it over: stop sending.
          if (error instanceof ApiError && error.status === 409) setSharing('taken_over')
        })
      },
      () => setSharing('denied'),
      { enableHighAccuracy: true, maximumAge: 3_000, timeout: 20_000 },
    )
    return () => {
      stopped = true
      navigator.geolocation.clearWatch(watch)
      document.removeEventListener('visibilitychange', onVisible)
      void wakeLock?.release().catch(() => undefined)
    }
  }, [reservationId, active, supported])

  return { position, sharing: supported ? sharing : ('denied' as Sharing) }
}

function Courier({ r }: { r: Reservation }) {
  const d = r.delivery!
  const start = useStartDelivery()
  const arrived = useCourierArrived()
  const collect = useCollectReservation()
  const active = r.status === 'confirmed'
  // Sending starts with "Krećem" on this phone (also after a reload: "Nastavi").
  const [driving, setDriving] = useState(false)
  const { position, sharing } = useCourierGps(r.id, driving && active && d.stage === 'on_the_way')
  const [route, setRoute] = useState<Route | null>(null)
  const lastRouted = useRef(0)

  useEffect(() => {
    if (!position || !driving || Date.now() - lastRouted.current < ROUTE_EVERY_MS) return
    lastRouted.current = Date.now()
    void fetchRoute(position, d.location, 'driving')
      .then(setRoute)
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, driving])

  const go = () => start.mutate(r.id, { onSuccess: () => setDriving(true) })

  if (r.status === 'collected') {
    return (
      <div role="status" className="flex items-center gap-3 rounded-2xl bg-success/12 p-5 font-semibold text-success">
        <CheckCircle2 className="size-7 shrink-0" />
        {t('courier.done')}
      </div>
    )
  }
  if (!active) return <EmptyState icon={Truck} title={t('courier.notActive')} />

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="space-y-2 p-5">
          <p className="flex items-center justify-between gap-2">
            <span className="font-mono text-lg font-bold text-primary">{r.code}</span>
            <span className="text-lg font-extrabold">{formatMoney(r.amountDueMinor, r.currency)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {r.quantity} × {r.offer.title} · {t('courier.collect', { amount: formatMoney(r.amountDueMinor, r.currency) })}
          </p>
          <p className="flex items-start gap-2 font-semibold">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              {d.address}
              {d.note && <span className="block text-sm font-normal text-muted-foreground">{d.note}</span>}
            </span>
          </p>
          <p className="flex items-center gap-2 text-sm">
            <Clock className="size-4 shrink-0 text-primary" />
            {formatPickupWindow(r.pickupStart, r.pickupEnd, r.timezone)}
            {route && driving && <strong className="ml-auto">{t('courier.eta', { time: formatDuration(route.seconds) })}</strong>}
          </p>
          {r.customer && (
            <p className="flex items-center gap-2 text-sm">
              <span className="font-semibold">{r.customer.name}</span>
              {r.customer.phone && (
                <a href={`tel:${r.customer.phone}`} className="ml-auto flex items-center gap-1 font-semibold text-primary">
                  <Phone className="size-4" />
                  {t('courier.call')}
                </a>
              )}
            </p>
          )}
        </div>
        <div className="relative isolate h-72 border-t bg-muted">
          <Suspense fallback={<Skeleton className="absolute inset-0 rounded-none" />}>
            <TrackingMap
              shop={r.business.location}
              shopLabel={r.business.name}
              destination={d.location}
              destinationLabel={d.address}
              courier={driving ? position : null}
              courierLabel={t('courier.you')}
              line={driving ? route?.line : null}
            />
          </Suspense>
        </div>
      </Card>

      {!driving ? (
        <Button size="lg" className="w-full" disabled={start.isPending} onClick={go}>
          {start.isPending ? <Loader2 className="animate-spin" /> : <Bike />}
          {d.stage === 'on_the_way' ? t('courier.resume') : t('courier.start')}
        </Button>
      ) : (
        <p
          role="status"
          className={
            sharing === 'on'
              ? 'flex items-center gap-2 rounded-xl bg-success/12 p-3 text-sm font-semibold text-success'
              : 'rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive'
          }
        >
          {sharing === 'on' && <span className="size-2.5 animate-pulse rounded-full bg-success" />}
          {sharing === 'on'
            ? t('courier.sharing')
            : sharing === 'denied'
              ? t('courier.gpsDenied')
              : sharing === 'taken_over'
                ? t('courier.takenOver')
                : t('courier.waitingGps')}
        </p>
      )}
      {driving && sharing === 'on' && <p className="text-center text-xs text-muted-foreground">{t('courier.keepOpen')}</p>}
      {d.stage === 'on_the_way' &&
        (d.arrivedAt ? (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-accent/30 p-3 text-sm font-semibold">
            <DoorOpen className="size-5 shrink-0" />
            {t('courier.arrivedSent')}
          </p>
        ) : (
          <Button size="lg" variant="secondary" className="w-full" disabled={arrived.isPending} onClick={() => arrived.mutate(r.id)}>
            {arrived.isPending ? <Loader2 className="animate-spin" /> : <DoorOpen />}
            {t('courier.arrived')}
          </Button>
        ))}
      <DeliveryChat reservation={r} side="courier" />
      {start.isError && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {start.error instanceof ApiError ? start.error.message : t('common.errorText')}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline">
          <a href={directionsUrl(d.location, position, 'driving')} target="_blank" rel="noreferrer">
            <Navigation />
            {t('courier.navigate')}
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
        <Button asChild>
          <Link to="/business/scan">
            <ScanLine />
            {t('courier.scan')}
          </Link>
        </Button>
      </div>
      <ConfirmDelete
        size="default"
        label={t('courier.deliveredNoScan')}
        question={t('courier.deliveredNoScanConfirm', { code: r.code })}
        hint={t('courier.deliveredNoScanHint')}
        onConfirm={() => collect.mutate({ id: r.id })}
        pending={collect.isPending}
        error={collect.error}
      />
    </div>
  )
}

function DeliveryDetails({ id }: { id: string }) {
  const { data, isLoading, isError, refetch } = useReservation(id)
  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />
  if (!data.delivery) return <EmptyState icon={Truck} title={t('courier.notDelivery')} />
  return <Courier r={data} />
}

/** Courier screen for one delivery (partner staff). */
export function DeliveryPage() {
  const { id } = useParams()
  return (
    <div className="mx-auto max-w-2xl">
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link to="/business/orders">
          <ArrowLeft />
          {t('orders.title')}
        </Link>
      </Button>
      <PageHeader title={t('courier.title')} />
      <StaffGuard>{id && <DeliveryDetails id={id} />}</StaffGuard>
    </div>
  )
}
