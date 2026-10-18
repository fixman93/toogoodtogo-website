import { useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { Reservation } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { PartnerPageShell } from '@/features/business/PartnerPageShell'
import { useDisputePickup, usePartnerIntegrity } from '@/hooks/api'
import { t } from '@/i18n'
import { formatPickupWindow } from '@/lib/format'
import { cn } from '@/lib/utils'

const PERIODS = [7, 30, 90] as const
const pct = (v: number) => `${Math.round(v * 100)}%`

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <Card className="space-y-1 p-4">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-extrabold tabular-nums', tone === 'good' && 'text-success', tone === 'bad' && 'text-destructive')}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
}

/** A pickup the customer confirmed because it wasn't scanned; the partner can dispute it. */
function ConfirmedRow({ r }: { r: Reservation }) {
  const dispute = useDisputePickup()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            <span className="font-mono text-primary">{r.code}</span> · {r.customer?.name ?? '—'}
          </p>
          <p className="text-sm text-muted-foreground">
            {r.quantity} × {r.offer.title} · {r.business.name} · {formatPickupWindow(r.pickupStart, r.pickupEnd, r.timezone)}
          </p>
        </div>
        {r.dispute ? (
          <Badge variant={r.dispute.status === 'upheld' ? 'success' : r.dispute.status === 'rejected' ? 'destructive' : 'accent'}>{t(`pickups.dispute.${r.dispute.status}`)}</Badge>
        ) : (
          <Badge variant="destructive">{t('pickups.notScanned')}</Badge>
        )}
      </div>
      {r.dispute?.note && <p className="text-sm text-muted-foreground">{r.dispute.note}</p>}
      {!r.dispute && !open && (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          {t('pickups.disputeAction')}
        </Button>
      )}
      {!r.dispute && open && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            dispute.mutate({ id: r.id, reason: reason.trim() }, { onSuccess: () => setOpen(false) })
          }}
        >
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('pickups.disputePlaceholder')} maxLength={500} rows={2} aria-label={t('pickups.disputeAction')} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={dispute.isPending || reason.trim().length < 5}>
              {dispute.isPending && <Loader2 className="animate-spin" />}
              {t('pickups.disputeSend')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {t('settle.cancel')}
            </Button>
          </div>
          {dispute.isError && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {dispute.error instanceof ApiError ? dispute.error.message : t('common.errorText')}
            </p>
          )}
        </form>
      )}
    </li>
  )
}

function Pickups() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30)
  const { data, isLoading, isError, refetch } = usePartnerIntegrity(days)
  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {PERIODS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={cn('h-10 rounded-full border px-4 text-sm font-semibold', days === d ? 'border-primary bg-secondary text-primary' : 'bg-card hover:bg-muted')}
          >
            {t('pickups.lastDays', { days: d })}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t('pickups.collected')} value={String(data.collected)} sub={t('pickups.ofFinished', { total: data.total })} />
            <Stat label={t('pickups.scanned')} value={data.collected ? pct(data.scannedRate) : '—'} tone={data.collected && data.scannedRate >= 0.9 ? 'good' : undefined} sub={t('pickups.scannedSub')} />
            <Stat
              label={t('pickups.noShow')}
              value={data.total ? pct(data.noShowRate) : '—'}
              tone={data.total >= 8 && data.noShowRate > data.platformNoShowRate * 2 ? 'bad' : undefined}
              sub={t('pickups.platformAvg', { rate: pct(data.platformNoShowRate) })}
            />
            <Stat label={t('pickups.byCustomer')} value={String(data.viaCustomer)} tone={data.viaCustomer ? 'bad' : 'good'} sub={t('pickups.byCustomerSub')} />
          </div>

          <Card className="flex gap-3 border-primary/30 bg-secondary/50 p-4 text-sm">
            <ShieldCheck className="size-5 shrink-0 text-primary" />
            <div className="space-y-1">
              <p className="font-bold">{t('pickups.howTitle')}</p>
              <p>{t('pickups.howText')}</p>
            </div>
          </Card>

          <section className="space-y-3">
            <h2 className="font-bold">{t('pickups.confirmedTitle')}</h2>
            {data.customerConfirmed.length === 0 ? (
              <EmptyState icon={ShieldCheck} title={t('pickups.confirmedEmpty')} className="py-8" />
            ) : (
              <Card className="overflow-hidden">
                <ul className="divide-y">
                  {data.customerConfirmed.map((r) => (
                    <ConfirmedRow key={r.id} r={r} />
                  ))}
                </ul>
              </Card>
            )}
            {data.customerConfirmed.length > 0 && <p className="text-xs text-muted-foreground">{t('pickups.disputeRule')}</p>}
          </section>
        </>
      )}
    </div>
  )
}

export function PickupsPage() {
  return (
    <PartnerPageShell title={t('pickups.title')} intro={t('pickups.intro')}>
      <Pickups />
    </PartnerPageShell>
  )
}
