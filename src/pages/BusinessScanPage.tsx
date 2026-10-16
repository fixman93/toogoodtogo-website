import { useCallback, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, CheckCircle2, Clock, Loader2, ShoppingBag, XCircle } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { Business, Reservation } from '@/api/types'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { CameraScanner } from '@/features/business/CameraScanner'
import { StaffGuard } from '@/features/business/PartnerGuard'
import { useAuth } from '@/features/auth/auth-context'
import { useBusinessReservations, useCollectReservation, useMyBusinesses, useWorkplaces } from '@/hooks/api'
import { t } from '@/i18n'
import { formatMoney, formatPickupWindow } from '@/lib/format'
import { parsePickupQr } from '@/lib/pickup'

type Outcome = { ok: true; reservation: Reservation } | { ok: false; message: string }

const RESULT_HOLD_MS = 3_000

function ResultCard({ outcome }: { outcome: Outcome }) {
  if (!outcome.ok) {
    return (
      <div role="alert" className="flex items-center gap-3 rounded-2xl bg-destructive/10 p-4 font-semibold text-destructive">
        <XCircle className="size-7 shrink-0" />
        {outcome.message}
      </div>
    )
  }
  const r = outcome.reservation
  const payAtCounter = r.payment.method === 'pay_at_pickup'
  return (
    <div role="status" className="space-y-3 rounded-2xl border-2 border-success bg-success/10 p-5">
      <p className="flex items-center gap-2 font-bold text-success">
        <CheckCircle2 className="size-6" />
        {t('business.collectedOk')} · {r.code}
      </p>
      <p className="text-3xl font-extrabold">{t('business.handOver', { count: r.quantity })}</p>
      <p className="text-sm">
        <strong>{r.customer?.name}</strong> · {r.offer.title}
      </p>
      <div className="flex items-center justify-between rounded-xl bg-card p-3">
        <span className="text-sm font-semibold text-muted-foreground">{payAtCounter ? t('business.charge') : t('business.paidOnline')}</span>
        <span className="text-2xl font-extrabold">{formatMoney(r.totalMinor, r.currency)}</span>
      </div>
    </div>
  )
}

function ExpectedPickups({ business, onGiveOut, pendingId }: { business: Business; onGiveOut: (r: Reservation) => void; pendingId?: string }) {
  const { data, isLoading } = useBusinessReservations(business.id)
  const confirmed = data?.data.filter((r) => r.status === 'confirmed') ?? []
  return (
    <Card className="overflow-hidden">
      <p className="border-b px-4 py-3 font-bold">{business.name}</p>
      {isLoading ? (
        <Skeleton className="m-4 h-12" />
      ) : confirmed.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t('business.expectedEmpty')}</p>
      ) : (
        <ul className="divide-y">
          {confirmed.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  <span className="font-mono text-primary">{r.code}</span> · {r.customer?.name}
                </p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ShoppingBag className="size-3.5" />
                  {r.quantity} × {r.offer.title}
                  <Clock className="ml-1 size-3.5" />
                  {formatPickupWindow(r.pickupStart, r.pickupEnd, r.timezone)}
                </p>
              </div>
              <Button size="sm" variant="secondary" disabled={pendingId === r.id} onClick={() => onGiveOut(r)}>
                {pendingId === r.id && <Loader2 className="animate-spin" />}
                {t('business.giveOut')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Scanner() {
  const { hasRole } = useAuth()
  const isStaff = hasRole('staff')
  const owned = useMyBusinesses()
  const workplaces = useWorkplaces(isStaff)
  // Staff see the locations they work at; owners their own.
  const businesses = isStaff ? { isLoading: workplaces.isLoading, data: { data: (workplaces.data ?? []) as unknown as Business[] } } : owned
  const collect = useCollectReservation()
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingId, setPendingId] = useState<string>()
  const lastScan = useRef({ text: '', at: 0 })

  const run = useCallback(
    async (input: Parameters<typeof collect.mutateAsync>[0]) => {
      setBusy(true)
      try {
        const reservation = await collect.mutateAsync(input)
        setOutcome({ ok: true, reservation })
        navigator.vibrate?.(120)
      } catch (error) {
        setOutcome({ ok: false, message: error instanceof ApiError ? error.message : t('common.errorText') })
        navigator.vibrate?.([60, 60, 60])
      } finally {
        // Keep the result on screen briefly before accepting the next scan.
        setTimeout(() => setBusy(false), RESULT_HOLD_MS)
      }
    },
    [collect],
  )

  const onScan = useCallback(
    (text: string) => {
      const now = Date.now()
      if (text === lastScan.current.text && now - lastScan.current.at < 8_000) return
      lastScan.current = { text, at: now }
      const parsed = parsePickupQr(text)
      if (!parsed) setOutcome({ ok: false, message: t('business.invalidQr') })
      else void run(parsed)
    },
    [run],
  )

  const onManual = (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    void run({ code }).then(() => setCode(''))
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        {/* Result first: on a phone it must be visible without scrolling. */}
        <div aria-live="polite">{outcome && <ResultCard outcome={outcome} />}</div>
        <CameraScanner onScan={onScan} paused={busy} />
        <form onSubmit={onManual} className="space-y-2">
          <Label htmlFor="pickup-code">{t('business.manualCode')}</Label>
          <div className="flex gap-2">
            <Input
              id="pickup-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="FN-4F7K"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-lg tracking-widest"
            />
            <Button type="submit" disabled={collect.isPending || !code.trim()}>
              {collect.isPending && <Loader2 className="animate-spin" />}
              {t('business.confirm')}
            </Button>
          </div>
        </form>
      </div>

      <section className="space-y-3">
        <h2 className="font-bold">{t('business.expected')}</h2>
        {businesses.isLoading ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : (
          businesses.data?.data.map((b) => (
            <ExpectedPickups
              key={b.id}
              business={b}
              pendingId={pendingId}
              onGiveOut={(r) => {
                setPendingId(r.id)
                void run({ id: r.id }).finally(() => setPendingId(undefined))
              }}
            />
          ))
        )}
      </section>
    </div>
  )
}

export function BusinessScanPage() {
  return (
    <div>
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link to="/business">
          <ArrowLeft />
          {t('business.title')}
        </Link>
      </Button>
      <PageHeader title={t('business.scanTitle')} subtitle={t('business.scanIntro')} />
      <StaffGuard>
        <Scanner />
      </StaffGuard>
    </div>
  )
}
