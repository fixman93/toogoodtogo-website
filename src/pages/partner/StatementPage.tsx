import { useState } from 'react'
import { ReceiptText } from 'lucide-react'
import type { StatementTotals } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PartnerPageShell } from '@/features/business/PartnerPageShell'
import { usePartnerStatement } from '@/hooks/api'
import { t } from '@/i18n'
import { formatMoney } from '@/lib/format'
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

function Statement() {
  const [month, setMonth] = useState(currentMonth())
  const { data, isLoading, isError, refetch } = usePartnerStatement(month)
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-semibold">
        {t('statement.month')}
        <Input type="month" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-10 w-auto rounded-full" />
      </label>
      {isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data.orders === 0 ? (
        <EmptyState icon={ReceiptText} title={t('statement.empty')} className="py-8" />
      ) : (
        <>
          <Card className="p-5">
            <StatementSummary s={data} currency={data.currency} />
          </Card>
          <div className="grid gap-3 lg:grid-cols-2">
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
