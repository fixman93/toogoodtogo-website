import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Clock, PackageCheck, PackageOpen, ShoppingBag, Wallet, type LucideIcon } from 'lucide-react'
import type { SalesCounts, SalesOfferRow, SalesReport } from '@/api/types'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { market } from '@/config/markets'
import { PartnerGuard } from '@/features/business/PartnerGuard'
import { usePartnerSales } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate, formatMoney, formatPickupWindow } from '@/lib/format'
import { addDays, toZonedInput } from '@/lib/time'
import { cn } from '@/lib/utils'

const STATUS_BADGE = { active: 'success', paused: 'accent', expired: 'muted', archived: 'muted' } as const

function Tile({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card className="p-4">
      <Icon className={cn('mb-2 size-5 text-primary', tone)} />
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
}

/** Totals used both on this page and as the "today" strip in the portal. */
export function SalesTiles({ report }: { report: SalesCounts & { currency: string } }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile icon={ShoppingBag} label={t('sales.sold')} value={String(report.bagsSold)} sub={report.bagsCancelled ? `${t('sales.cancelled')}: ${report.bagsCancelled}` : undefined} />
      <Tile icon={PackageCheck} label={t('sales.collected')} value={String(report.bagsCollected)} tone="text-success" sub={`${t('sales.pending')}: ${report.bagsPending}`} />
      <Tile icon={PackageOpen} label={t('sales.remaining')} value={String(report.bagsRemaining)} sub={t('sales.remainingOf', { total: report.bagsTotal })} />
      <Tile
        icon={Wallet}
        label={t('sales.revenue')}
        value={formatMoney(report.revenueMinor, report.currency)}
        sub={report.expectedRevenueMinor ? t('sales.expected', { amount: formatMoney(report.expectedRevenueMinor, report.currency) }) : undefined}
      />
    </div>
  )
}

/** Stacked bar: collected · pending · no-show · remaining, out of all bags. */
function StockBar({ row }: { row: SalesCounts }) {
  const total = Math.max(row.bagsTotal, 1)
  const parts = [
    { value: row.bagsCollected, className: 'bg-success' },
    { value: row.bagsPending, className: 'bg-primary' },
    { value: row.bagsNoShow, className: 'bg-warning' },
    { value: row.bagsRemaining, className: 'bg-muted-foreground/25' },
  ]
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      {parts.map((p, i) => (p.value > 0 ? <span key={i} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} /> : null))}
    </div>
  )
}

function OfferSalesRow({ row }: { row: SalesOfferRow }) {
  return (
    <li className="space-y-2 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{row.title}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" />
            {formatPickupWindow(row.pickupStart, row.pickupEnd, row.timezone)} · {formatMoney(row.priceMinor, row.currency)}
          </p>
        </div>
        <Badge variant={STATUS_BADGE[row.status]}>{t(`sales.status.${row.status}`)}</Badge>
      </div>
      <StockBar row={row} />
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
        <span>
          <strong>{row.bagsSold}</strong>/{row.bagsTotal} {t('sales.sold').toLowerCase()}
        </span>
        <span className="text-success">
          {t('sales.collected')}: <strong>{row.bagsCollected}</strong>
        </span>
        {row.bagsPending > 0 && (
          <span>
            {t('sales.pending')}: <strong>{row.bagsPending}</strong>
          </span>
        )}
        {row.bagsNoShow > 0 && (
          <span className="text-accent-foreground">
            {t('sales.noShow')}: <strong>{row.bagsNoShow}</strong>
          </span>
        )}
        <span className="text-muted-foreground">
          {t('sales.remaining')}: <strong>{row.bagsRemaining}</strong>
        </span>
        {row.revenueMinor > 0 && <span className="ml-auto font-semibold">{formatMoney(row.revenueMinor, row.currency)}</span>}
      </p>
    </li>
  )
}

function Report({ report }: { report: SalesReport }) {
  const withOffers = report.businesses.filter((b) => b.offers.length > 0)
  return (
    <div className="space-y-5">
      <SalesTiles report={report} />
      {withOffers.length === 0 ? (
        <EmptyState icon={PackageOpen} title={t('sales.empty')} className="py-10" />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t('sales.legend')}</p>
          <div className="grid gap-4 xl:grid-cols-2">
            {withOffers.map((b) => (
              <Card key={b.id} className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b p-4">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{b.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {b.address.street}, {b.address.city}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <p>
                      <strong>{b.bagsSold}</strong>/{b.bagsTotal} {t('sales.sold').toLowerCase()}
                    </p>
                    <p className="text-muted-foreground">{formatMoney(b.revenueMinor, report.currency)}</p>
                  </div>
                </div>
                <ul className="divide-y">
                  {b.offers.map((o) => (
                    <OfferSalesRow key={o.id} row={o} />
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Sales() {
  const today = toZonedInput(new Date(), market.timezone).date
  const [date, setDate] = useState(today)
  const { data, isLoading, isError, refetch } = usePartnerSales(date === today ? undefined : date)
  const choices = [
    { value: addDays(today, -1), label: t('sales.yesterday') },
    { value: today, label: t('sales.today') },
    { value: addDays(today, 1), label: t('sales.tomorrow') },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {choices.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={date === c.value}
            onClick={() => setDate(c.value)}
            className={cn(
              'h-10 rounded-full border px-4 text-sm font-semibold transition-colors',
              date === c.value ? 'border-primary bg-secondary text-primary' : 'bg-card hover:bg-muted',
            )}
          >
            {c.label}
          </button>
        ))}
        <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-10 w-auto rounded-full" aria-label="Datum" />
      </div>
      <p className="text-sm font-semibold">{formatDate(`${date}T12:00:00Z`)}</p>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <Report report={data} />
      )}
    </div>
  )
}

export function SalesPage() {
  return (
    <div>
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link to="/business">
          <ArrowLeft />
          {t('business.title')}
        </Link>
      </Button>
      <PageHeader title={t('sales.title')} subtitle={t('sales.intro')} />
      <PartnerGuard>
        <Sales />
      </PartnerGuard>
    </div>
  )
}
