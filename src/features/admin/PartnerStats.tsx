import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/services'
import type { PartnerStatsRow } from '@/api/types'
import { Skeleton } from '@/components/ui/skeleton'
import { t } from '@/i18n'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

const PERIODS = [7, 30, 90, 0] as const
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—')

function Tile({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className="rounded-xl bg-card p-3 shadow-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-xl font-extrabold tabular-nums', tone === 'good' && 'text-success', tone === 'bad' && 'text-destructive', tone === 'warn' && 'text-accent-foreground')}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

/** Admin → Partneri: one partner's reservations by outcome (period selectable), per location. */
export function PartnerStats({ ownerId }: { ownerId: string }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30)
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'partner-stats', ownerId, days], queryFn: () => adminApi.partnerStats(ownerId, days) })
  const money = (minor: number) => (data?.currency ? formatMoney(minor, data.currency) : '—')
  const s: PartnerStatsRow | undefined = data?.totals
  const finished = s ? s.collected + s.expired : 0

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold">{t('pstats.title')}</p>
        <div className="flex gap-1">
          {PERIODS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className={cn('h-8 rounded-full border px-3 text-xs font-semibold', days === d ? 'border-primary bg-secondary text-primary' : 'bg-card')}
            >
              {d ? t('pickups.lastDays', { days: d }) : t('pstats.allTime')}
            </button>
          ))}
        </div>
      </div>
      {isLoading || !s ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : s.total === 0 ? (
        <p className="text-xs text-muted-foreground">{t('pstats.empty')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label={t('pstats.total')} value={s.total} sub={s.deliveries ? t('pstats.deliveries', { count: s.deliveries }) : undefined} />
            <Tile label={t('pstats.collected')} value={s.collected} tone="good" sub={t('pstats.collectedSub', { scanned: s.scanned, manual: s.manual, customer: s.byCustomer })} />
            <Tile label={t('pstats.expired')} value={s.expired} tone={s.expired ? 'bad' : undefined} sub={t('pstats.ofFinished', { pct: pct(s.expired, finished) })} />
            <Tile label={t('pstats.cancelled')} value={s.cancelledByCustomer + s.cancelledByPartner} sub={t('pstats.cancelledSub', { customer: s.cancelledByCustomer, partner: s.cancelledByPartner })} />
            <Tile label={t('pstats.active')} value={s.active} />
            <Tile label={t('pstats.revenue')} value={money(s.revenueMinor)} sub={t('offer.bags', { count: s.bagsCollected })} />
            <Tile label={t('pstats.expiredValue')} value={money(s.expiredValueMinor)} tone={s.expiredValueMinor ? 'warn' : undefined} />
            <Tile label={t('pstats.warnings')} value={s.arrivalWarnings} tone={s.arrivalWarnings ? 'bad' : undefined} />
          </div>
          {data!.locations.length > 1 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1.5 pr-2 font-semibold">{t('pstats.location')}</th>
                    <th className="px-2 text-right font-semibold">{t('pstats.total')}</th>
                    <th className="px-2 text-right font-semibold">{t('pstats.collected')}</th>
                    <th className="px-2 text-right font-semibold">{t('pstats.expiredShort')}</th>
                    <th className="px-2 text-right font-semibold">{t('pstats.cancelled')}</th>
                    <th className="px-2 text-right font-semibold">{t('pstats.activeShort')}</th>
                    <th className="pl-2 text-right font-semibold">{t('pstats.revenue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data!.locations.map((l) => (
                    <tr key={l.businessId} className={cn(l.total === 0 && 'text-muted-foreground')}>
                      <td className="py-1.5 pr-2 font-semibold">{l.name}</td>
                      <td className="px-2 text-right tabular-nums">{l.total}</td>
                      <td className="px-2 text-right text-success tabular-nums">{l.collected}</td>
                      <td className={cn('px-2 text-right tabular-nums', l.expired > 0 && 'text-destructive')}>{l.expired}</td>
                      <td className="px-2 text-right tabular-nums">{l.cancelledByCustomer + l.cancelledByPartner}</td>
                      <td className="px-2 text-right tabular-nums">{l.active}</td>
                      <td className="pl-2 text-right tabular-nums">{money(l.revenueMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
