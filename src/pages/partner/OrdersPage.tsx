import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, ClipboardList, Clock, Loader2, ScanLine } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { Reservation } from '@/api/types'
import { ConfirmDelete } from '@/components/common/ConfirmDelete'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { StatusBadge } from '@/components/reservations/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { market } from '@/config/markets'
import { PartnerGuard } from '@/features/business/PartnerGuard'
import { useCancelReservation, useCollectReservation, usePartnerOrders } from '@/hooks/api'
import { t } from '@/i18n'
import { formatMoney, formatPickupWindow } from '@/lib/format'
import { addDays, toZonedInput } from '@/lib/time'
import { cn } from '@/lib/utils'

type StatusFilter = 'active' | 'collected' | 'cancelled' | 'expired' | undefined

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn('h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors', active ? 'border-primary bg-secondary text-primary' : 'bg-card hover:bg-muted')}
    >
      {children}
    </button>
  )
}

function OrderRow({ r }: { r: Reservation }) {
  const collect = useCollectReservation()
  const cancel = useCancelReservation()
  const active = r.status === 'confirmed' || r.status === 'pending_payment'
  const error = collect.error ?? null
  return (
    <li className="space-y-2 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            <span className="font-mono text-primary">{r.code}</span> · {r.customer?.name ?? '—'}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {r.quantity} × {r.offer.title} · {r.business.name}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" />
            {formatPickupWindow(r.pickupStart, r.pickupEnd, r.timezone)} · <strong className="text-foreground">{formatMoney(r.totalMinor, r.currency)}</strong>
          </p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      {active && (
        <div className="flex flex-wrap items-start gap-2">
          <Button size="sm" disabled={collect.isPending} onClick={() => collect.mutate({ id: r.id })}>
            {collect.isPending && <Loader2 className="animate-spin" />}
            {t('orders.giveOut')}
          </Button>
          <ConfirmDelete
            label={t('orders.cancel')}
            question={t('orders.cancelConfirm', { code: r.code })}
            onConfirm={() => cancel.mutate(r.id)}
            pending={cancel.isPending}
            error={cancel.error}
            className="basis-full sm:basis-auto"
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error instanceof ApiError ? error.message : t('common.errorText')}
        </p>
      )}
    </li>
  )
}

function Orders() {
  const today = toZonedInput(new Date(), market.timezone).date
  const [date, setDate] = useState(today)
  const [status, setStatus] = useState<StatusFilter>('active')
  const { data, isLoading, isError, refetch, isFetching } = usePartnerOrders(date === today ? undefined : date, status)
  const days = [
    { value: addDays(today, -1), label: t('sales.yesterday') },
    { value: today, label: t('sales.today') },
    { value: addDays(today, 1), label: t('sales.tomorrow') },
  ]
  const statuses: { value: StatusFilter; label: string }[] = [
    { value: 'active', label: t('orders.active') },
    { value: 'collected', label: t('orders.collected') },
    { value: 'cancelled', label: t('orders.cancelled') },
    { value: 'expired', label: t('orders.expired') },
    { value: undefined, label: t('orders.all') },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {days.map((d) => (
          <Chip key={d.value} active={date === d.value} onClick={() => setDate(d.value)}>
            {d.label}
          </Chip>
        ))}
        <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-10 w-auto rounded-full" aria-label="Datum" />
      </div>
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {statuses.map((s) => (
          <Chip key={s.label} active={status === s.value} onClick={() => setStatus(s.value)}>
            {s.label}
          </Chip>
        ))}
      </div>
      {isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data?.data.length ? (
        <EmptyState icon={ClipboardList} title={t('orders.empty')} className="py-10" />
      ) : (
        <Card className={cn('overflow-hidden', isFetching && 'opacity-70')}>
          <ul className="divide-y">
            {data.data.map((r) => (
              <OrderRow key={r.id} r={r} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

export function OrdersPage() {
  return (
    <div>
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link to="/business">
          <ArrowLeft />
          {t('business.title')}
        </Link>
      </Button>
      <PageHeader
        title={t('orders.title')}
        subtitle={t('orders.intro')}
        actions={
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/business/scan">
              <ScanLine />
              {t('business.scan')}
            </Link>
          </Button>
        }
      />
      <PartnerGuard>
        <Orders />
      </PartnerGuard>
    </div>
  )
}
