import { useState, type ReactNode } from 'react'
import { Megaphone, ReceiptText } from 'lucide-react'
import type { OutstandingMonth, PartnerPayment, Settlement, SettlementStatus, StatementTotals } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PartnerPageShell } from '@/features/business/PartnerPageShell'
import { useOutstanding, usePartnerStatement } from '@/hooks/api'
import { activeLocale, t } from '@/i18n'
import { formatDate, formatMoney } from '@/lib/format'
import { currentMonth } from '@/lib/time'
import { cn } from '@/lib/utils'

const pct = (rate: number) => `${Math.round(rate * 1000) / 10}%`

/** Revenue → commission → balance block (partner page and admin finance tab). */
export function StatementSummary({ s, rate, currency }: { s: StatementTotals; rate?: number; currency: string }) {
  const rows: [string, number, string?][] = [
    [t('statement.revenue'), s.revenueMinor],
    [t('statement.platformDiscount'), s.platformDiscountMinor],
    [t('statement.gross'), s.grossMinor, 'font-semibold'],
    [t('statement.commission', { rate: rate != null ? pct(rate) : '' }).replace(' ()', ''), s.commissionMinor],
    // Paid promotions are added to what the partner owes.
    ...(s.boostMinor ? ([[t('statement.boosts'), s.boostMinor]] as [string, number][]) : []),
  ]
  const owes = s.balanceMinor >= 0
  return (
    <dl className="divide-y text-sm">
      <div className="flex justify-between py-2">
        <dt className="text-muted-foreground">{t('statement.orders')}</dt>
        <dd>
          {t('statement.ordersCount', { count: s.orders })} · {t('offer.bags', { count: s.bags })}
        </dd>
      </div>
      {rows.map(([label, value, cls]) => (
        <div key={label} className={cn('flex justify-between py-2', cls)}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular-nums">{formatMoney(value, currency)}</dd>
        </div>
      ))}
      <div className="flex justify-between py-2.5 text-base font-extrabold">
        <dt>{owes ? t('statement.balance') : t('statement.balanceCredit')}</dt>
        <dd className={cn('tabular-nums', !owes && 'text-success')}>{formatMoney(Math.abs(s.balanceMinor), currency)}</dd>
      </div>
    </dl>
  )
}

const SETTLE_BADGE = { none: 'muted', unpaid: 'destructive', partial: 'accent', paid: 'success', overpaid: 'secondary' } as const

export function SettlementBadge({ status }: { status: SettlementStatus }) {
  return <Badge variant={SETTLE_BADGE[status]}>{t(`settle.status.${status}`)}</Badge>
}

const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat(activeLocale, { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 15))
}
/** Paid / still open for one month, with the recorded payments (partner page and admin finance). */
export function SettlementInfo({
  s,
  payments,
  currency,
  paymentAction,
}: {
  s: Settlement
  payments: PartnerPayment[]
  currency: string
  paymentAction?: (p: PartnerPayment) => ReactNode
}) {
  if (s.status === 'none') return null
  const credit = s.remainingMinor < 0
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SettlementBadge status={s.status} />
        <span className="text-muted-foreground">
          {t('settle.settled')}: <span className="font-semibold text-foreground tabular-nums">{formatMoney(Math.abs(s.settledMinor), currency)}</span>
        </span>
      </div>
      {s.remainingMinor !== 0 && (
        <p className={cn('flex justify-between font-bold', credit ? 'text-success' : 'text-destructive')}>
          <span>{credit ? t('settle.remainingCredit') : t('settle.remaining')}</span>
          <span className="tabular-nums">{formatMoney(Math.abs(s.remainingMinor), currency)}</span>
        </p>
      )}
      {payments.length > 0 && (
        <ul className="space-y-1.5">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-muted/50 px-3 py-2">
              <span className="min-w-0">
                <span className="font-semibold tabular-nums">{formatMoney(p.amountMinor, currency)}</span>
                <span className="text-muted-foreground">
                  {' · '}
                  {formatDate(p.paidAt)} · {t(`settle.method.${p.method}`)}
                  {p.direction === 'to_partner' && ` · ${t('settle.direction.to_partner')}`}
                  {p.recordedBy && ` · ${t('settle.recordedBy', { name: p.recordedBy })}`}
                </span>
                {p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}
              </span>
              {paymentAction?.(p)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Months not fully settled; clicking one opens it. */
export function OpenMonths({ months, currency, onOpen }: { months: OutstandingMonth[]; currency: string; onOpen: (month: string) => void }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {months.map((m) => (
        <li key={m.month}>
          <button
            type="button"
            onClick={() => onOpen(m.month)}
            className="flex min-h-9 items-center gap-2 rounded-full border bg-card px-3 text-sm hover:bg-muted"
            title={t('finance.openMonth')}
          >
            <span className="font-semibold capitalize">{monthLabel(m.month)}</span>
            <span className={cn('tabular-nums', m.remainingMinor < 0 ? 'text-success' : 'text-destructive')}>{formatMoney(Math.abs(m.remainingMinor), currency)}</span>
            {m.inProgress && <span className="text-xs text-muted-foreground">({t('finance.inProgress')})</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

function MyOpenMonths({ onOpen }: { onOpen: (month: string) => void }) {
  const { data } = useOutstanding(false)
  const me = data?.partners[0]
  if (!data || !me || me.months.length === 0) return null
  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold">{t('statement.openMonths')}</h2>
        {me.dueMinor > 0 && (
          <span className="text-sm">
            {t('statement.dueTotal')}: <span className="font-bold text-destructive tabular-nums">{formatMoney(me.dueMinor, me.currency)}</span>
          </span>
        )}
      </div>
      <OpenMonths months={me.months} currency={me.currency} onOpen={onOpen} />
    </Card>
  )
}

function Statement() {
  const [month, setMonth] = useState(currentMonth())
  const { data, isLoading, isError, refetch } = usePartnerStatement(month)
  return (
    <div className="space-y-4">
      <MyOpenMonths onOpen={setMonth} />
      <label className="flex items-center gap-2 text-sm font-semibold">
        {t('statement.month')}
        <Input type="month" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-10 w-auto rounded-full" />
      </label>
      {isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data.orders === 0 && data.payments.length === 0 && !data.boostMinor ? (
        <EmptyState icon={ReceiptText} title={t('statement.empty')} className="py-8" />
      ) : (
        <>
          <Card className="space-y-4 p-5">
            <StatementSummary s={data} currency={data.currency} />
            <SettlementInfo s={data} payments={data.payments} currency={data.currency} />
          </Card>
          <div className="grid gap-3 lg:grid-cols-2">
            {!!data.boosts?.length && (
              <Card className="space-y-2 p-4 lg:col-span-2">
                <p className="flex items-center gap-2 font-bold">
                  <Megaphone className="size-4 text-primary" />
                  {t('statement.boosts')}
                </p>
                <ul className="divide-y text-sm">
                  {data.boosts.map((b) => (
                    <li key={b.id} className="flex items-start justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{b.offerTitle}</span>
                        <span className="text-xs text-muted-foreground">
                          {b.kind === 'top' ? t('boost.top') : t('boost.pushDone', { count: b.recipients ?? 0 })} · {b.businessName} · {formatDate(b.createdAt)}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatMoney(b.priceMinor, b.currency)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {data.businesses
              .filter((b) => b.orders > 0)
              .map((b) => (
                <Card key={b.businessId} className="p-4">
                  <p className="mb-1 font-bold">{b.name}</p>
                  <StatementSummary s={b} rate={b.rate} currency={data.currency} />
                </Card>
              ))}
          </div>
        </>
      )}
    </div>
  )
}

export function StatementPage() {
  return (
    <PartnerPageShell title={t('statement.title')} intro={t('statement.intro')}>
      <Statement />
    </PartnerPageShell>
  )
}
