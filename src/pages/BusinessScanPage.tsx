import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Loader2, ScanLine, ShoppingBag, Store, XCircle } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { Business, Reservation, ScanVerdict } from '@/api/types'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { CameraScanner } from '@/features/business/CameraScanner'
import { StaffGuard } from '@/features/business/PartnerGuard'
import { useAuth } from '@/features/auth/auth-context'
import { useBusinessReservations, useCollectReservation, useMyBusinesses, useVerifyCode, useWorkplaces } from '@/hooks/api'
import { t } from '@/i18n'
import { formatMoney, formatPickupWindow, formatTime } from '@/lib/format'
import { parsePickupQr } from '@/lib/pickup'
import { scanFeedback, unlockAudio } from '@/lib/scan-feedback'
import { scannerPrefs } from '@/lib/scanner-prefs'
import { cn } from '@/lib/utils'

type CodeInput = { code: string; reservationId?: string } | { id: string }

/** What the answer panel shows. `handedOver` = the bag was just given out. */
type Result =
  | { kind: 'checking' }
  | { kind: 'verdict'; verdict: ScanVerdict | 'invalid_qr' | 'error'; reservation?: Reservation; businessName?: string; message?: string; input?: CodeInput }
  | { kind: 'handedOver'; reservation: Reservation }

type Tone = 'ok' | 'warn' | 'error'
/** Valid → green; valid but outside the pickup window → amber (can still hand over); anything else → red. */
const toneOf = (verdict: string): Tone => (verdict === 'valid' ? 'ok' : verdict === 'early' || verdict === 'late' ? 'warn' : 'error')
/** After handing over, the scanner is ready for the next customer by itself. */
const NEXT_SCAN_MS = 3_500

function verdictText(r: Extract<Result, { kind: 'verdict' }>): { title: string; detail?: string } {
  const res = r.reservation
  switch (r.verdict) {
    case 'valid':
      return { title: t('scan.valid') }
    case 'early':
      return { title: t('scan.early'), detail: res && t('scan.earlyDetail', { time: formatTime(res.pickupStart, res.timezone) }) }
    case 'late':
      return { title: t('scan.late'), detail: res && t('scan.lateDetail', { time: formatTime(res.pickupEnd, res.timezone) }) }
    case 'already_collected':
      return { title: t('scan.alreadyCollected'), detail: res?.collectedAt ? t('scan.collectedAt', { time: formatTime(res.collectedAt, res.timezone) }) : undefined }
    case 'cancelled':
      return { title: t('scan.cancelled') }
    case 'expired':
      return { title: t('scan.expired'), detail: res && t('scan.expiredDetail', { time: formatTime(res.pickupEnd, res.timezone) }) }
    case 'not_paid':
      return { title: t('scan.notPaid') }
    case 'not_found':
      return { title: t('scan.notFound'), detail: t('scan.notFoundDetail') }
    case 'other_location':
      return { title: t('scan.otherLocation'), detail: r.businessName ? t('scan.otherLocationDetail', { name: r.businessName }) : undefined }
    case 'ambiguous':
      return { title: t('scan.ambiguous'), detail: t('scan.ambiguousDetail') }
    case 'invalid_qr':
      return { title: t('business.invalidQr'), detail: t('scan.notFoundDetail') }
    default:
      return { title: t('common.errorTitle'), detail: r.message }
  }
}

/** `charge`: show what to collect at the till (not for codes that must not be handed over). */
function Details({ r, charge = true }: { r: Reservation; charge?: boolean }) {
  const payAtCounter = r.payment.method === 'pay_at_pickup'
  return (
    <div className="space-y-2">
      <p className="text-lg">
        <strong>{r.customer?.name ?? '—'}</strong> · <span className="font-mono">{r.code}</span>
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5">
          <ShoppingBag className="size-4" />
          {r.quantity} × {r.offer.title}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="size-4" />
          {formatPickupWindow(r.pickupStart, r.pickupEnd, r.timezone)}
        </span>
        <span className="flex items-center gap-1.5">
          <Store className="size-4" />
          {r.business.name}
        </span>
      </p>
      {charge && (
        <div className="flex items-center justify-between rounded-xl bg-card p-3 text-foreground">
          <span className="text-sm font-semibold text-muted-foreground">{payAtCounter ? t('business.charge') : t('business.paidOnline')}</span>
          <span className="text-2xl font-extrabold tabular-nums">{formatMoney(r.totalMinor, r.currency)}</span>
        </div>
      )}
    </div>
  )
}

function Panel({ tone, icon, title, detail, children }: { tone: Tone; icon: ReactNode; title: string; detail?: string; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      data-tone={tone}
      className={cn(
        'space-y-4 rounded-3xl border-4 p-5',
        tone === 'ok' && 'border-success bg-success/15',
        tone === 'warn' && 'border-accent bg-accent/25',
        tone === 'error' && 'border-destructive bg-destructive/10',
      )}
    >
      <div className={cn('flex items-start gap-3', tone === 'ok' && 'text-success', tone === 'warn' && 'text-accent-foreground', tone === 'error' && 'text-destructive')}>
        {icon}
        <div>
          <p className="text-2xl leading-tight font-extrabold">{title}</p>
          {detail && <p className="mt-1 font-semibold text-foreground">{detail}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

/** Full-width, colour-coded answer: readable at a glance across the counter. */
function ResultPanel({
  result,
  onHandOver,
  onNext,
  handingOver,
  error,
}: {
  result: Result
  onHandOver: () => void
  onNext: () => void
  handingOver: boolean
  error: string | null
}) {
  if (result.kind === 'checking') {
    return (
      <div className="flex items-center gap-3 rounded-3xl bg-muted p-5 text-lg font-semibold">
        <Loader2 className="size-6 animate-spin" />
        {t('scan.checking')}
      </div>
    )
  }
  if (result.kind === 'handedOver') {
    const r = result.reservation
    return (
      <Panel tone="ok" icon={<CheckCircle2 className="size-9 shrink-0" />} title={t('scan.handedOver', { count: r.quantity })}>
        <Details r={r} />
        <Button variant="outline" size="lg" className="h-14 w-full bg-card text-lg" onClick={onNext}>
          <ScanLine />
          {t('scan.next')}
        </Button>
      </Panel>
    )
  }
  const { title, detail } = verdictText(result)
  const tone = toneOf(result.verdict)
  const canHandOver = !!result.reservation && tone !== 'error'
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'warn' ? AlertTriangle : XCircle
  return (
    <Panel tone={tone} icon={<Icon className="size-9 shrink-0" />} title={title} detail={detail}>
      {result.reservation && <Details r={result.reservation} charge={canHandOver} />}
      {error && (
        <p role="alert" className="rounded-lg bg-card p-2 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        {canHandOver && (
          <Button size="lg" className="h-14 w-full text-lg sm:w-auto sm:flex-1" disabled={handingOver} onClick={onHandOver}>
            {handingOver ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {tone === 'warn' ? t('scan.handOverAnyway') : t('business.handOver', { count: result.reservation!.quantity })}
          </Button>
        )}
        <Button variant="outline" size="lg" className={cn('h-14 bg-card text-lg', !canHandOver && 'w-full')} onClick={onNext}>
          <ScanLine />
          {canHandOver ? t('scan.cancel') : t('scan.next')}
        </Button>
      </div>
    </Panel>
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

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 shrink-0 accent-[var(--primary)]" />
      {label}
    </label>
  )
}

function Scanner() {
  const { hasRole } = useAuth()
  const isStaff = hasRole('staff')
  const owned = useMyBusinesses()
  const workplaces = useWorkplaces(isStaff)
  // Staff see the locations they work at; owners their own.
  const businesses = isStaff ? { isLoading: workplaces.isLoading, data: { data: (workplaces.data ?? []) as unknown as Business[] } } : owned
  const verify = useVerifyCode()
  const collect = useCollectReservation()
  const [result, setResult] = useState<Result | null>(null)
  const [handError, setHandError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [pendingId, setPendingId] = useState<string>()
  const [autoCollect, setAutoCollect] = useState(scannerPrefs.autoCollect)
  const [openOnLaunch, setOpenOnLaunch] = useState(scannerPrefs.openOnLaunch)
  const lastScan = useRef({ text: '', at: 0 })
  const nextTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => clearTimeout(nextTimer.current), [])
  // Keep the answer in view on a phone.
  useEffect(() => {
    if (result && result.kind !== 'checking') panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [result])

  const reset = useCallback(() => {
    clearTimeout(nextTimer.current)
    setResult(null)
    setHandError(null)
    lastScan.current = { text: '', at: 0 }
  }, [])

  const handOver = useCallback(
    async (input: CodeInput) => {
      setHandError(null)
      try {
        const reservation = await collect.mutateAsync(input)
        setResult({ kind: 'handedOver', reservation })
        scanFeedback('ok')
        clearTimeout(nextTimer.current)
        nextTimer.current = setTimeout(reset, NEXT_SCAN_MS)
      } catch (error) {
        setHandError(error instanceof ApiError ? error.message : t('common.errorText'))
        scanFeedback('error')
      }
    },
    [collect, reset],
  )

  const check = useCallback(
    async (input: { code: string; reservationId?: string }) => {
      setHandError(null)
      setResult({ kind: 'checking' })
      try {
        const answer = await verify.mutateAsync(input)
        // Hand over by id from now on: exact, even if the typed code were ambiguous.
        const exact = answer.reservation ? { code: answer.reservation.code, reservationId: answer.reservation.id } : input
        setResult({ kind: 'verdict', ...answer, input: exact })
        if (answer.verdict === 'valid' && autoCollect) return handOver(exact)
        scanFeedback(toneOf(answer.verdict))
      } catch (error) {
        setResult({ kind: 'verdict', verdict: 'error', message: error instanceof ApiError ? error.message : t('common.errorText') })
        scanFeedback('error')
      }
    },
    [verify, autoCollect, handOver],
  )

  const onScan = useCallback(
    (text: string) => {
      const now = Date.now()
      if (text === lastScan.current.text && now - lastScan.current.at < 8_000) return
      lastScan.current = { text, at: now }
      const parsed = parsePickupQr(text)
      if (!parsed) {
        setResult({ kind: 'verdict', verdict: 'invalid_qr' })
        scanFeedback('error')
      } else void check(parsed)
    },
    [check],
  )

  const onManual = (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    void check({ code }).then(() => setCode(''))
  }

  const verdictInput = result?.kind === 'verdict' ? result.input : undefined

  return (
    <div className="grid gap-6 lg:grid-cols-2" onPointerDown={unlockAudio}>
      <div className="space-y-4">
        {/* Answer first: on a phone it must be visible without scrolling. */}
        <div ref={panelRef} aria-live="polite" className="scroll-mt-20">
          {result && (
            <ResultPanel
              result={result}
              error={handError}
              handingOver={collect.isPending}
              onHandOver={() => verdictInput && void handOver(verdictInput)}
              onNext={reset}
            />
          )}
        </div>
        <CameraScanner onScan={onScan} paused={!!result} />
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
            <Button type="submit" disabled={verify.isPending || !code.trim()}>
              {verify.isPending && <Loader2 className="animate-spin" />}
              {t('scan.check')}
            </Button>
          </div>
        </form>
        <div className="rounded-2xl border bg-card px-4 py-1">
          <Toggle
            checked={autoCollect}
            onChange={(v) => {
              setAutoCollect(v)
              scannerPrefs.setAutoCollect(v)
            }}
            label={t('scan.autoCollect')}
          />
          <Toggle
            checked={openOnLaunch}
            onChange={(v) => {
              setOpenOnLaunch(v)
              scannerPrefs.setOpenOnLaunch(v)
            }}
            label={t('scan.openOnLaunch')}
          />
        </div>
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
                void handOver({ id: r.id }).finally(() => setPendingId(undefined))
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
