import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BellRing, CheckCircle2, Clock, Loader2, Maximize, ScanLine, Truck, Volume2, VolumeX } from 'lucide-react'
import { ApiError } from '@/api/client'
import { partnerApi } from '@/api/services'
import type { Reservation } from '@/api/types'
import { ErrorState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { arrivedRecently } from '@/features/reservations/arrival'
import { StaffGuard } from '@/features/business/PartnerGuard'
import { useCollectReservation, useWorkplaces } from '@/hooks/api'
import { t } from '@/i18n'
import { formatMoney, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Poll often: the tablet is the shop's "doorbell" for new orders. */
const POLL_MS = 10_000
const SOUND_KEY = 'foodnesi.counter.sound'
const LOCATION_KEY = 'foodnesi.counter.location'

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // private mode
  }
}

/** Two short tones ("ding-dong") with Web Audio — no sound file needed. */
function chime(ctx: AudioContext) {
  const now = ctx.currentTime
  for (const [i, freq] of [880, 660].entries()) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.0001, now + i * 0.25)
    gain.gain.exponentialRampToValueAtTime(0.4, now + i * 0.25 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.25 + 0.45)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now + i * 0.25)
    osc.stop(now + i * 0.25 + 0.5)
  }
}

/** Keep the tablet's screen on while this page is open. */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const request = () =>
      (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
        ?.request('screen')
        .then((l) => {
          lock = l
        })
        .catch(() => undefined)
    void request()
    const onVisible = () => document.visibilityState === 'visible' && void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => undefined)
    }
  }, [])
}

function OrderTile({ r, fresh }: { r: Reservation; fresh: boolean }) {
  const collect = useCollectReservation()
  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-2xl border-2 bg-card p-4 shadow-card transition-colors',
        fresh ? 'zl-card-in border-accent ring-4 ring-accent/40' : 'border-transparent',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-3xl font-extrabold tracking-wider text-primary">{r.code.replace(/^FN-/, '')}</span>
        {r.delivery ? (
          <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
            <Truck className="size-3.5" />
            {t(`orders.delivery.${r.delivery.stage}`)}
          </span>
        ) : arrivedRecently(r) ? (
          <span className="rounded-full bg-success px-2.5 py-1 text-xs font-bold text-white">{t('arrival.partnerBadge')}</span>
        ) : (
          fresh && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">{t('counter.new')}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold">{r.customer?.name ?? '—'}</p>
        <p className="text-base">
          <strong>{r.quantity} ×</strong> {r.offer.title}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" />
          {formatTime(r.pickupStart, r.timezone)}–{formatTime(r.pickupEnd, r.timezone)} · <strong className="text-foreground">{formatMoney(r.amountDueMinor ?? r.totalMinor, r.currency)}</strong>
        </p>
        {r.delivery && <p className="mt-1 truncate text-sm">{r.delivery.address}</p>}
      </div>
      {r.delivery ? (
        <Button asChild size="lg" variant="secondary" className="h-14 text-base">
          <Link to={`/business/deliveries/${r.id}`}>
            <Truck />
            {r.delivery.stage === 'on_the_way' ? t('orders.deliveryOpen') : t('orders.deliveryStart')}
          </Link>
        </Button>
      ) : (
        <Button size="lg" className="h-14 text-base" disabled={collect.isPending} onClick={() => collect.mutate({ id: r.id })}>
          {collect.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          {t('orders.giveOut')}
        </Button>
      )}
      {collect.isError && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {collect.error instanceof ApiError ? collect.error.message : t('common.errorText')}
        </p>
      )}
    </li>
  )
}

function Counter() {
  useWakeLock()
  const places = useWorkplaces(true)
  const [location, setLocation] = useState<string>(() => read(LOCATION_KEY) ?? 'all')
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['partner', 'orders', 'counter', location],
    queryFn: () => partnerApi.orders({ status: 'active', ...(location !== 'all' ? { businessId: location } : {}) }),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  })
  const orders = data?.data ?? []

  // New orders since the page opened: highlight + chime.
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [sound, setSound] = useState(() => read(SOUND_KEY) === 'on')
  const audio = useRef<AudioContext | null>(null)
  useEffect(() => {
    if (!data) return
    const ids = data.data.map((r) => r.id)
    if (seen.current) {
      const added = ids.filter((id) => !seen.current!.has(id))
      if (added.length) {
        setFresh((f) => new Set([...f, ...added]))
        if (sound && audio.current) chime(audio.current)
      }
    }
    seen.current = new Set([...(seen.current ?? []), ...ids])
  }, [data, sound])

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    write(SOUND_KEY, next ? 'on' : 'off')
    if (next) {
      // Browsers only allow audio after a tap.
      audio.current ??= new AudioContext()
      void audio.current.resume().then(() => chime(audio.current!))
    }
  }
  // Sound was on last time: the first tap anywhere re-arms it.
  useEffect(() => {
    if (!sound || audio.current) return
    const arm = () => {
      audio.current ??= new AudioContext()
      void audio.current.resume()
    }
    window.addEventListener('pointerdown', arm, { once: true })
    return () => window.removeEventListener('pointerdown', arm)
  }, [sound])

  const pickups = orders.filter((r) => !r.delivery)
  const deliveries = orders.filter((r) => r.delivery)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(places.data?.length ?? 0) > 1 && (
          <div className="scrollbar-none flex gap-2 overflow-x-auto">
            {[{ id: 'all', name: t('counter.allLocations') }, ...(places.data ?? [])].map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={location === b.id}
                onClick={() => {
                  setLocation(b.id)
                  write(LOCATION_KEY, b.id)
                  seen.current = null
                  setFresh(new Set())
                }}
                className={cn('h-10 shrink-0 rounded-full border px-4 text-sm font-semibold', location === b.id ? 'border-primary bg-secondary text-primary' : 'bg-card')}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant={sound ? 'secondary' : 'outline'} onClick={toggleSound} aria-pressed={sound}>
            {sound ? <Volume2 /> : <VolumeX />}
            {sound ? t('counter.soundOn') : t('counter.soundOff')}
          </Button>
          <Button variant="outline" size="icon" aria-label={t('counter.fullscreen')} onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}>
            <Maximize />
          </Button>
          <Button asChild>
            <Link to="/business/scan">
              <ScanLine />
              {t('business.scan')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-3xl font-extrabold">{t('counter.waiting', { count: orders.length })}</p>
        {deliveries.length > 0 && <p className="text-sm text-muted-foreground">{t('counter.deliveries', { count: deliveries.length })}</p>}
        {dataUpdatedAt > 0 && <p className="ml-auto text-xs text-muted-foreground">{t('counter.updated', { time: formatTime(new Date(dataUpdatedAt).toISOString()) })}</p>}
      </div>
      {!sound && (
        <button type="button" onClick={toggleSound} className="flex w-full items-center gap-2 rounded-xl bg-accent/25 p-3 text-left text-sm font-semibold">
          <BellRing className="size-5 shrink-0" />
          {t('counter.enableSound')}
        </button>
      )}

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed p-12 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <p className="mt-3 text-xl font-bold">{t('counter.empty')}</p>
          <p className="text-muted-foreground">{t('counter.emptyText')}</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...pickups, ...deliveries].map((r) => (
            <OrderTile key={r.id} r={r} fresh={fresh.has(r.id)} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** Tablet on the counter: today's open orders, big buttons, a chime for new ones. */
export function CounterPage() {
  return (
    <div>
      <Button asChild variant="ghost" className="mb-2 -ml-3">
        <Link to="/business">
          <ArrowLeft />
          {t('business.title')}
        </Link>
      </Button>
      <h1 className="mb-4 text-2xl font-extrabold">{t('counter.title')}</h1>
      <StaffGuard>
        <Counter />
      </StaffGuard>
    </div>
  )
}
